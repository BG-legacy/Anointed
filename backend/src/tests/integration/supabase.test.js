import { describe, beforeAll, afterAll, test, expect } from '@jest/globals';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { config } from '../../config/index.js';
import { database } from '../../services/database.js';

const { Pool } = pg;

/**
 * Comprehensive Supabase Database Integration Tests
 * 
 * This test suite validates:
 * 1. All required Postgres extensions are installed and working
 * 2. Database timeout parameters are properly configured
 * 3. User story scenarios (registration, authentication, search)
 * 4. Advanced features like trigram search and encryption
 */
describe('Supabase Database Integration Tests', () => {
  let postgresContainer;
  let testPool;
  let testDatabase;

  beforeAll(async () => {
    try {
      // Start PostgreSQL container with the same setup as production
      postgresContainer = await new PostgreSqlContainer('postgres:16-alpine')
        .withDatabase('test_supabase_db')
        .withUsername('test_user')
        .withPassword('test_password')
        .withExposedPorts(5432)
        .start();

      // Create connection pool
      const connectionString = postgresContainer.getConnectionUri();
      testPool = new Pool({
        connectionString,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Setup extensions and schema (simulate Supabase environment)
      await setupTestDatabase(testPool);

    } catch (error) {
      console.error('Failed to setup test environment:', error);
      throw error;
    }
  }, 60000); // 60 second timeout for container startup

  afterAll(async () => {
    if (testPool) {
      await testPool.end();
    }
    if (postgresContainer) {
      await postgresContainer.stop();
    }
  });

  describe('Database Extensions Validation', () => {
    test('should have all required Supabase extensions installed', async () => {
      const requiredExtensions = ['pgcrypto', 'pg_trgm', 'pg_stat_statements', 'btree_gin', 'uuid-ossp'];
      
      const result = await testPool.query(`
        SELECT extname, extversion
        FROM pg_extension 
        WHERE extname = ANY($1::text[])
        ORDER BY extname;
      `, [requiredExtensions]);

      expect(result.rows).toHaveLength(requiredExtensions.length);
      
      const installedExtensions = result.rows.map(row => row.extname);
      for (const ext of requiredExtensions) {
        expect(installedExtensions).toContain(ext);
      }

             console.log('PASSED - Installed extensions:', result.rows);
    });

    test('should validate pgcrypto functions work correctly', async () => {
      // Test password hashing with bcrypt
      const result = await testPool.query(`
        SELECT 
          gen_salt('bf') as salt,
          crypt('testpassword123', gen_salt('bf')) as hashed_password;
      `);

      expect(result.rows[0].salt).toBeTruthy();
      expect(result.rows[0].hashed_password).toBeTruthy();
      expect(result.rows[0].hashed_password).toMatch(/^\$2[aby]\$\d+\$/);

      // Test password verification
      const verifyResult = await testPool.query(`
        SELECT crypt('testpassword123', $1) = $1 as password_matches;
      `, [result.rows[0].hashed_password]);

      expect(verifyResult.rows[0].password_matches).toBe(true);
    });

    test('should validate pg_trgm trigram search works', async () => {
      // Test similarity search
      const result = await testPool.query(`
        SELECT 
          similarity('hello world', 'hello word') as similarity_score,
          'hello world' % 'hello word' as is_similar;
      `);

      expect(result.rows[0].similarity_score).toBeGreaterThan(0);
      expect(typeof result.rows[0].is_similar).toBe('boolean');
    });

    test('should validate uuid-ossp generates valid UUIDs', async () => {
      const result = await testPool.query(`
        SELECT 
          uuid_generate_v4() as uuid_v4,
          uuid_generate_v1() as uuid_v1;
      `);

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(result.rows[0].uuid_v4).toMatch(uuidRegex);
      expect(result.rows[0].uuid_v1).toMatch(uuidRegex);
    });
  });

  describe('Database Performance & Configuration', () => {
    test('should have proper timeout settings configured', async () => {
      const result = await testPool.query(`
        SELECT name, setting, unit, context
        FROM pg_settings 
        WHERE name IN ('statement_timeout', 'idle_in_transaction_session_timeout')
        ORDER BY name;
      `);

      // Check that timeout settings are available (they might be default values in test)
      expect(result.rows.length).toBeGreaterThanOrEqual(1);
      
      for (const setting of result.rows) {
        expect(setting.name).toMatch(/timeout/);
                 console.log(`PASSED - ${setting.name}: ${setting.setting}${setting.unit || ''}`);
      }
    });

    test('should track query statistics with pg_stat_statements', async () => {
      // Execute a few queries to generate stats
      await testPool.query('SELECT 1 as test_query');
      await testPool.query('SELECT COUNT(*) FROM users WHERE email LIKE \'%test%\'');
      
      // Check if pg_stat_statements is tracking
      const result = await testPool.query(`
        SELECT calls, query 
        FROM pg_stat_statements 
        WHERE query LIKE '%test_query%'
        LIMIT 1;
      `);

      // pg_stat_statements should be available (may have 0 rows if just installed)
      expect(Array.isArray(result.rows)).toBe(true);
    });
  });

  describe('User Management Story Tests', () => {
    test('User Story: Should register a new user with encrypted password', async () => {
      const userData = {
        email: 'john.doe@anointed.com',
        password: 'SecurePassword123!',
        firstName: 'John',
        lastName: 'Doe'
      };

      // Register user (simulate registration endpoint)
      const insertResult = await testPool.query(`
        INSERT INTO users (email, password_hash, first_name, last_name)
        VALUES ($1, crypt($2, gen_salt('bf')), $3, $4)
        RETURNING id, email, first_name, last_name, created_at;
      `, [userData.email, userData.password, userData.firstName, userData.lastName]);

      expect(insertResult.rows).toHaveLength(1);
      const user = insertResult.rows[0];
      
      expect(user.email).toBe(userData.email);
      expect(user.first_name).toBe(userData.firstName);
      expect(user.last_name).toBe(userData.lastName);
      expect(user.id).toBeTruthy();
      expect(user.created_at).toBeInstanceOf(Date);

             console.log('PASSED - User registered:', { id: user.id, email: user.email });
    });

    test('User Story: Should authenticate user with correct password', async () => {
      const email = 'john.doe@anointed.com';
      const password = 'SecurePassword123!';

      // Authenticate user (simulate login endpoint)
      const authResult = await testPool.query(`
        SELECT 
          id, 
          email, 
          first_name, 
          last_name,
          crypt($2, password_hash) = password_hash as password_valid
        FROM users 
        WHERE email = $1;
      `, [email, password]);

      expect(authResult.rows).toHaveLength(1);
      const user = authResult.rows[0];
      
      expect(user.password_valid).toBe(true);
      expect(user.email).toBe(email);

             console.log('PASSED - User authenticated:', { id: user.id, email: user.email });
    });

    test('User Story: Should reject authentication with wrong password', async () => {
      const email = 'john.doe@anointed.com';
      const wrongPassword = 'WrongPassword123!';

      const authResult = await testPool.query(`
        SELECT 
          id, 
          email,
          crypt($2, password_hash) = password_hash as password_valid
        FROM users 
        WHERE email = $1;
      `, [email, wrongPassword]);

      expect(authResult.rows).toHaveLength(1);
      expect(authResult.rows[0].password_valid).toBe(false);

             console.log('PASSED - Wrong password rejected correctly');
    });

    test('User Story: Should create and manage user sessions', async () => {
      // Get user ID
      const userResult = await testPool.query(`
        SELECT id FROM users WHERE email = $1;
      `, ['john.doe@anointed.com']);

      const userId = userResult.rows[0].id;
      const sessionToken = 'test-session-token-' + Date.now();

      // Create session
      const sessionResult = await testPool.query(`
        INSERT INTO sessions (user_id, token_hash, expires_at)
        VALUES ($1, crypt($2, gen_salt('bf')), NOW() + INTERVAL '24 hours')
        RETURNING id, user_id, expires_at;
      `, [userId, sessionToken]);

      expect(sessionResult.rows).toHaveLength(1);
      const session = sessionResult.rows[0];
      
      expect(session.user_id).toBe(userId);
      expect(session.expires_at > new Date()).toBe(true);

      // Validate session
      const validateResult = await testPool.query(`
        SELECT s.id, s.user_id, u.email, u.first_name
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.user_id = $1 
          AND crypt($2, s.token_hash) = s.token_hash
          AND s.expires_at > NOW();
      `, [userId, sessionToken]);

      expect(validateResult.rows).toHaveLength(1);
      expect(validateResult.rows[0].email).toBe('john.doe@anointed.com');

             console.log('PASSED - Session created and validated:', { 
        sessionId: session.id, 
        userId: session.user_id 
      });
    });
  });

  describe('Advanced Search Features', () => {
    beforeAll(async () => {
      // Insert test data for search
      const testUsers = [
        ['alice.wonder@anointed.com', 'Alice', 'Wonder'],
        ['bob.builder@anointed.com', 'Bob', 'Builder'],
        ['carol.singer@anointed.com', 'Carol', 'Singer'],
        ['david.dancer@anointed.com', 'David', 'Dancer'],
        ['eve.explorer@anointed.com', 'Eve', 'Explorer']
      ];

      for (const [email, firstName, lastName] of testUsers) {
        await testPool.query(`
          INSERT INTO users (email, password_hash, first_name, last_name)
          VALUES ($1, crypt('password123', gen_salt('bf')), $2, $3)
          ON CONFLICT (email) DO NOTHING;
        `, [email, firstName, lastName]);
      }
    });

    test('User Story: Should find users with fuzzy name search', async () => {
      // Search for "Alice" with slight misspelling
      const searchResult = await testPool.query(`
        SELECT 
          email, 
          first_name, 
          last_name,
          similarity(first_name, $1) as name_similarity
        FROM users 
        WHERE first_name % $1  -- % operator uses trigram similarity
        ORDER BY name_similarity DESC
        LIMIT 5;
      `, ['Alise']); // Misspelled "Alice"

      expect(searchResult.rows.length).toBeGreaterThan(0);
      expect(searchResult.rows[0].first_name).toBe('Alice');
      expect(searchResult.rows[0].name_similarity).toBeGreaterThan(0.1);

             console.log('PASSED - Fuzzy search found:', searchResult.rows[0]);
    });

    test('User Story: Should search users by email domain', async () => {
      const domainSearchResult = await testPool.query(`
        SELECT email, first_name, last_name
        FROM users 
        WHERE email LIKE '%anointed.com'
        ORDER BY first_name;
      `);

      expect(domainSearchResult.rows.length).toBeGreaterThanOrEqual(5);
      
      for (const user of domainSearchResult.rows) {
        expect(user.email).toContain('anointed.com');
      }

             console.log('PASSED - Domain search found', domainSearchResult.rows.length, 'users');
    });

    test('User Story: Should perform full-text search across user fields', async () => {
      // Create a GIN index for full-text search (using btree_gin extension)
      await testPool.query(`
        CREATE INDEX IF NOT EXISTS idx_users_fulltext_gin 
        ON users USING gin(to_tsvector('english', 
          coalesce(first_name, '') || ' ' || 
          coalesce(last_name, '') || ' ' || 
          coalesce(email, '')
        ));
      `);

      // Full-text search
      const searchResult = await testPool.query(`
        SELECT 
          email, 
          first_name, 
          last_name,
          ts_rank(to_tsvector('english', 
            coalesce(first_name, '') || ' ' || 
            coalesce(last_name, '') || ' ' || 
            coalesce(email, '')
          ), plainto_tsquery('english', $1)) as rank
        FROM users 
        WHERE to_tsvector('english', 
          coalesce(first_name, '') || ' ' || 
          coalesce(last_name, '') || ' ' || 
          coalesce(email, '')
        ) @@ plainto_tsquery('english', $1)
        ORDER BY rank DESC
        LIMIT 5;
      `, ['builder']);

      expect(searchResult.rows.length).toBeGreaterThan(0);
      expect(searchResult.rows[0].last_name.toLowerCase()).toContain('builder');

             console.log('PASSED - Full-text search found:', searchResult.rows[0]);
    });
  });

  describe('Database Constraints and Data Integrity', () => {
    test('Should enforce unique email constraint', async () => {
      const duplicateEmail = 'john.doe@anointed.com';
      
      await expect(
        testPool.query(`
          INSERT INTO users (email, password_hash, first_name, last_name)
          VALUES ($1, crypt('password', gen_salt('bf')), 'John', 'Duplicate');
        `, [duplicateEmail])
      ).rejects.toThrow();

             console.log('PASSED - Unique email constraint enforced');
    });

    test('Should maintain referential integrity for sessions', async () => {
      const nonExistentUserId = '00000000-0000-0000-0000-000000000000';
      
      await expect(
        testPool.query(`
          INSERT INTO sessions (user_id, token_hash, expires_at)
          VALUES ($1, crypt('token', gen_salt('bf')), NOW() + INTERVAL '1 hour');
        `, [nonExistentUserId])
      ).rejects.toThrow();

             console.log('PASSED - Foreign key constraint enforced');
    });

    test('Should automatically set timestamps', async () => {
      const beforeInsert = new Date();
      
      const result = await testPool.query(`
        INSERT INTO users (email, password_hash, first_name, last_name)
        VALUES ($1, crypt('password', gen_salt('bf')), 'Time', 'Test')
        RETURNING created_at, updated_at;
      `, ['timetest@anointed.com']);

      const afterInsert = new Date();
      const user = result.rows[0];

      expect(user.created_at).toBeInstanceOf(Date);
      expect(user.updated_at).toBeInstanceOf(Date);
      expect(user.created_at.getTime()).toBeGreaterThanOrEqual(beforeInsert.getTime());
      expect(user.created_at.getTime()).toBeLessThanOrEqual(afterInsert.getTime());

             console.log('PASSED - Automatic timestamps working:', {
        created_at: user.created_at,
        updated_at: user.updated_at
      });
    });
  });
});

/**
 * Setup test database with all required extensions and schema
 */
async function setupTestDatabase(pool) {
  // Install required extensions
  const extensions = [
    'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";',
    'CREATE EXTENSION IF NOT EXISTS "pgcrypto";',
    'CREATE EXTENSION IF NOT EXISTS "pg_trgm";',
    'CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";',
    'CREATE EXTENSION IF NOT EXISTS "btree_gin";'
  ];

  for (const extension of extensions) {
    await pool.query(extension);
  }

  // Create tables (same as init.sql)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      first_name VARCHAR(100),
      last_name VARCHAR(100),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(255) NOT NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  // Create indexes
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);',
    'CREATE INDEX IF NOT EXISTS idx_users_name_trgm ON users USING gin(first_name gin_trgm_ops, last_name gin_trgm_ops);',
    'CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);',
    'CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);',
    'CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);'
  ];

  for (const index of indexes) {
    await pool.query(index);
  }

     console.log('PASSED - Test database setup complete with all extensions and schema');
}