#!/usr/bin/env node

/**
 * Enable Supabase Extensions Script
 *
 * This script connects to your Supabase database and enables
 * the required extensions for the Anointed application.
 */

import { config } from '../src/config/index.js';
import pg from 'pg';

const { Pool } = pg;

async function enableSupabaseExtensions() {
  console.log('🔧 Enabling Supabase Extensions...\n');

  let pool;
  try {
    // Create connection to Supabase
    const dbUrl =
      config.supabase.databaseUrl[config.nodeEnv] || config.database.url;
    console.log('📡 Connecting to Supabase...');

    pool = new Pool({
      connectionString: dbUrl,
      max: 3,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    const client = await pool.connect();
    console.log('✅ Connected successfully!\n');

    // List of extensions to enable
    const extensions = [
      { name: 'uuid-ossp', description: 'UUID generation functions' },
      { name: 'pgcrypto', description: 'Cryptographic functions' },
      {
        name: 'pg_trgm',
        description: 'Trigram similarity for fuzzy text search',
      },
      { name: 'pg_stat_statements', description: 'Query execution statistics' },
      { name: 'btree_gin', description: 'GIN indexes for btree operations' },
    ];

    console.log('🔌 Enabling extensions...');

    for (const ext of extensions) {
      try {
        console.log(`  🔄 Installing ${ext.name}...`);
        await client.query(`CREATE EXTENSION IF NOT EXISTS "${ext.name}";`);
        console.log(`  ✅ ${ext.name} - ${ext.description}`);
      } catch (error) {
        if (error.message.includes('permission denied')) {
          console.log(
            `  ⚠️  ${ext.name} - Permission denied (may require Supabase Pro plan)`
          );
        } else if (error.message.includes('does not exist')) {
          console.log(
            `  ❌ ${ext.name} - Not available in this Supabase instance`
          );
        } else {
          console.log(`  ⚠️  ${ext.name} - ${error.message}`);
        }
      }
    }

    console.log('\n📊 Checking final extension status...');
    const finalCheck = await client.query(`
      SELECT extname, extversion
      FROM pg_extension 
      WHERE extname IN ('pgcrypto', 'pg_trgm', 'pg_stat_statements', 'btree_gin', 'uuid-ossp')
      ORDER BY extname;
    `);

    console.log('📋 Installed extensions:');
    for (const ext of finalCheck.rows) {
      console.log(`  ✅ ${ext.extname} (v${ext.extversion})`);
    }

    // Check for missing extensions
    const installedNames = finalCheck.rows.map((row) => row.extname);
    const requiredNames = extensions.map((ext) => ext.name);
    const missing = requiredNames.filter(
      (name) => !installedNames.includes(name)
    );

    if (missing.length > 0) {
      console.log('\n⚠️  Missing extensions:');
      for (const name of missing) {
        console.log(`  ❌ ${name}`);
      }
      console.log(
        '\nℹ️  Note: Some extensions may require a Supabase Pro plan or may not be available in managed Supabase instances.'
      );
    } else {
      console.log('\n🎉 All required extensions are installed!');
    }

    // Set database parameters if possible
    console.log('\n⚙️  Setting database parameters...');
    try {
      await client.query(
        `ALTER DATABASE ${client.database} SET statement_timeout = '10s';`
      );
      console.log('  ✅ statement_timeout set to 10s');
    } catch (error) {
      console.log('  ⚠️  Could not set statement_timeout:', error.message);
    }

    try {
      await client.query(
        `ALTER DATABASE ${client.database} SET idle_in_transaction_session_timeout = '10s';`
      );
      console.log('  ✅ idle_in_transaction_session_timeout set to 10s');
    } catch (error) {
      console.log(
        '  ⚠️  Could not set idle_in_transaction_session_timeout:',
        error.message
      );
    }

    client.release();
    console.log('\n🎊 Extension setup completed!');
  } catch (error) {
    console.error('\n❌ Failed to enable extensions:');
    console.error(error.message);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// Run the script
enableSupabaseExtensions().catch(console.error);
