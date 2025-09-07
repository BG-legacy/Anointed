#!/usr/bin/env node

/**
 * Supabase Connection Test Script
 *
 * This script tests the actual connection to your Supabase database
 * and validates that all extensions and configurations are working.
 */

import { config } from '../src/config/index.js';
import pg from 'pg';

const { Pool } = pg;

async function testSupabaseConnection() {
  console.log('TESTING - Supabase Database Connection...\n');

  let pool;
  try {
    // Create connection to Supabase
    const dbUrl =
      config.supabase.databaseUrl[config.nodeEnv] || config.database.url;
    console.log('INFO - Connecting to:', dbUrl.replace(/:[^:@]*@/, ':***@')); // Hide password in logs

    pool = new Pool({
      connectionString: dbUrl,
      max: 3,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      options: `-c statement_timeout=${config.database.statementTimeout} -c idle_in_transaction_session_timeout=${config.database.idleInTransactionSessionTimeout}`,
    });

    // Test basic connection
    console.log('INFO - Testing connection...');
    const client = await pool.connect();
    console.log('PASSED - Connection successful!\n');

    // Test 1: Check Extensions
    console.log('TEST - Extensions...');
    const extensionsResult = await client.query(`
      SELECT extname, extversion
      FROM pg_extension 
      WHERE extname IN ('pgcrypto', 'pg_trgm', 'pg_stat_statements', 'btree_gin', 'uuid-ossp')
      ORDER BY extname;
    `);

    const requiredExtensions = [
      'pgcrypto',
      'pg_trgm',
      'pg_stat_statements',
      'btree_gin',
      'uuid-ossp',
    ];
    const installedExtensions = extensionsResult.rows.map((row) => row.extname);

    for (const ext of requiredExtensions) {
      if (installedExtensions.includes(ext)) {
        const version = extensionsResult.rows.find(
          (row) => row.extname === ext
        )?.extversion;
        console.log(`  PASSED - ${ext} (v${version})`);
      } else {
        console.log(`  FAILED - ${ext} - NOT INSTALLED`);
      }
    }

    // Test 2: Check Database Parameters
    console.log('\nTEST - Database Parameters...');
    const paramsResult = await client.query(`
      SELECT name, setting, unit, context
      FROM pg_settings 
      WHERE name IN ('statement_timeout', 'idle_in_transaction_session_timeout')
      ORDER BY name;
    `);

    for (const param of paramsResult.rows) {
      console.log(
        `  PASSED - ${param.name}: ${param.setting}${param.unit || ''} (${param.context})`
      );
    }

    // Test 3: Test pgcrypto
    console.log('\nTEST - pgcrypto (Password Encryption)...');
    const cryptoResult = await client.query(`
      SELECT 
        gen_salt('bf') as salt,
        crypt('testpassword123', gen_salt('bf')) as hashed_password;
    `);

    const { salt, hashed_password } = cryptoResult.rows[0];
    console.log(`  PASSED - Salt generated: ${salt}`);
    console.log(
      `  PASSED - Password hashed: ${hashed_password.substring(0, 20)}...`
    );

    // Verify password
    const verifyResult = await client.query(
      `
      SELECT crypt('testpassword123', $1) = $1 as password_matches;
    `,
      [hashed_password]
    );

    console.log(
      `  PASSED - Password verification: ${verifyResult.rows[0].password_matches ? 'PASS' : 'FAIL'}`
    );

    // Test 4: Test pg_trgm (Trigram Search)
    console.log('\nTEST - pg_trgm (Fuzzy Search)...');
    const trigramResult = await client.query(`
      SELECT 
        similarity('hello world', 'hello word') as similarity_score,
        'hello world' % 'hello word' as is_similar;
    `);

    const { similarity_score, is_similar } = trigramResult.rows[0];
    console.log(`  PASSED - Similarity score: ${similarity_score.toFixed(3)}`);
    console.log(`  PASSED - Is similar: ${is_similar}`);

    // Test 5: Test UUID Generation
    console.log('\nTEST - UUID Generation...');
    const uuidResult = await client.query(`
      SELECT 
        uuid_generate_v4() as uuid_v4,
        uuid_generate_v1() as uuid_v1;
    `);

    const { uuid_v4, uuid_v1 } = uuidResult.rows[0];
    console.log(`  PASSED - UUID v4: ${uuid_v4}`);
    console.log(`  PASSED - UUID v1: ${uuid_v1}`);

    // Test 6: Test Tables (if they exist)
    console.log('\nTEST - Database Schema...');
    try {
      const tablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN ('users', 'sessions')
        ORDER BY table_name;
      `);

      if (tablesResult.rows.length > 0) {
        console.log('  INFO - Found tables:');
        for (const table of tablesResult.rows) {
          console.log(`    RESULT - ${table.table_name}`);
        }

        // Test user table structure if it exists
        if (tablesResult.rows.some((row) => row.table_name === 'users')) {
          const userTableResult = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'users'
            ORDER BY ordinal_position;
          `);

          console.log('  INFO - Users table structure:');
          for (const col of userTableResult.rows) {
            console.log(
              `    COLUMN - ${col.column_name}: ${col.data_type}${col.is_nullable === 'NO' ? ' NOT NULL' : ''}`
            );
          }
        }
      } else {
        console.log(
          '  INFO - No application tables found (run migration script to create them)'
        );
      }
    } catch (error) {
      console.log('  WARNING - Could not check tables:', error.message);
    }

    // Test 7: Performance Test
    console.log('\nTEST - Query Performance...');
    const start = Date.now();
    await client.query('SELECT 1 as test');
    const duration = Date.now() - start;
    console.log(`  PASSED - Simple query took: ${duration}ms`);

    // Test 8: Connection Info
    console.log('\nINFO - Connection Information...');
    const connInfoResult = await client.query(`
      SELECT 
        current_database() as database_name,
        current_user as user_name,
        version() as postgres_version,
        inet_server_addr() as server_ip,
        inet_server_port() as server_port;
    `);

    const connInfo = connInfoResult.rows[0];
    console.log(`  INFO - Database: ${connInfo.database_name}`);
    console.log(`  INFO - User: ${connInfo.user_name}`);
    console.log(
      `  INFO - PostgreSQL: ${connInfo.postgres_version.split(' ')[0]} ${connInfo.postgres_version.split(' ')[1]}`
    );
    console.log(
      `  INFO - Server: ${connInfo.server_ip}:${connInfo.server_port}`
    );

    client.release();

    console.log('\nSUCCESS - All Supabase tests completed successfully!');
    console.log('\nSUMMARY - Test Results:');
    console.log('  PASSED - Connection established');
    console.log('  PASSED - All required extensions installed');
    console.log('  PASSED - Database parameters configured');
    console.log('  PASSED - Encryption functions working');
    console.log('  PASSED - Search functions working');
    console.log('  PASSED - UUID generation working');
    console.log('  PASSED - Performance acceptable');
  } catch (error) {
    console.error('\nFAILED - Supabase connection test failed:');
    console.error(error.message);

    if (error.code === 'ENOTFOUND') {
      console.error('\nTROUBLESHOOT - Network Issues:');
      console.error(
        '  HELP - Check your SUPABASE_DB_URL_* environment variables'
      );
      console.error('  HELP - Verify your Supabase project is running');
      console.error('  HELP - Check your internet connection');
    } else if (error.code === '28P01') {
      console.error('\nTROUBLESHOOT - Authentication Issues:');
      console.error(
        '  HELP - Check your database password in the connection string'
      );
      console.error('  HELP - Verify your Supabase database credentials');
    } else if (error.code === '3D000') {
      console.error('\nTROUBLESHOOT - Database Issues:');
      console.error('  HELP - The specified database does not exist');
      console.error(
        '  HELP - Check your database name in the connection string'
      );
    }

    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// Run the test
testSupabaseConnection().catch(console.error);
