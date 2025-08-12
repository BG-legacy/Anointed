import { describe, beforeAll, afterAll, beforeEach, afterEach, test, expect } from '@jest/globals';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';
import { database } from '../../services/database.js';
import { redis } from '../../services/redis.js';

describe('Database Integration Tests', () => {
  let postgresContainer;
  let redisContainer;
  let originalDatabaseUrl;
  let originalRedisUrl;

  beforeAll(async () => {
    // Start PostgreSQL container
    postgresContainer = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('test_db')
      .withUsername('test_user')
      .withPassword('test_password')
      .start();

    // Start Redis container
    redisContainer = await new RedisContainer('redis:7-alpine')
      .start();

    // Update environment variables
    originalDatabaseUrl = process.env.DATABASE_URL;
    originalRedisUrl = process.env.REDIS_URL;
    
    process.env.DATABASE_URL = postgresContainer.getConnectionUri();
    process.env.REDIS_URL = `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`;

    // Connect to test databases
    await database.connect();
    await redis.connect();
  }, 60000);

  afterAll(async () => {
    // Disconnect from databases
    await database.disconnect();
    await redis.disconnect();

    // Stop containers
    await postgresContainer.stop();
    await redisContainer.stop();

    // Restore environment variables
    process.env.DATABASE_URL = originalDatabaseUrl;
    process.env.REDIS_URL = originalRedisUrl;
  }, 30000);

  describe('PostgreSQL Database', () => {
    test('should connect successfully', () => {
      expect(database.isConnected).toBe(true);
    });

    test('should execute queries', async () => {
      const result = await database.query('SELECT 1 as test_value');
      expect(result.rows[0].test_value).toBe(1);
    });

    test('should handle health checks', async () => {
      const isHealthy = await database.healthCheck();
      expect(isHealthy).toBe(true);
    });

    test('should create and query tables', async () => {
      // Create test table
      await database.query(`
        CREATE TABLE IF NOT EXISTS test_users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL
        )
      `);

      // Insert test data
      const insertResult = await database.query(
        'INSERT INTO test_users (name, email) VALUES ($1, $2) RETURNING id',
        ['Test User', 'test@example.com']
      );

      expect(insertResult.rows[0].id).toBeDefined();

      // Query test data
      const selectResult = await database.query(
        'SELECT * FROM test_users WHERE email = $1',
        ['test@example.com']
      );

      expect(selectResult.rows[0].name).toBe('Test User');
      expect(selectResult.rows[0].email).toBe('test@example.com');

      // Clean up
      await database.query('DROP TABLE test_users');
    });
  });

  describe('Redis Cache', () => {
    test('should connect successfully', () => {
      expect(redis.isConnected).toBe(true);
    });

    test('should set and get values', async () => {
      const testKey = 'test_key';
      const testValue = { message: 'Hello, Redis!' };

      await redis.set(testKey, testValue);
      const retrievedValue = await redis.get(testKey);

      expect(retrievedValue).toEqual(testValue);
    });

    test('should handle TTL expiration', async () => {
      const testKey = 'test_ttl_key';
      const testValue = { message: 'This will expire' };

      await redis.set(testKey, testValue, 1); // 1 second TTL
      
      // Should exist immediately
      let exists = await redis.exists(testKey);
      expect(exists).toBe(1);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      exists = await redis.exists(testKey);
      expect(exists).toBe(0);
    });

    test('should delete keys', async () => {
      const testKey = 'test_delete_key';
      const testValue = { message: 'To be deleted' };

      await redis.set(testKey, testValue);
      
      let exists = await redis.exists(testKey);
      expect(exists).toBe(1);

      await redis.del(testKey);
      
      exists = await redis.exists(testKey);
      expect(exists).toBe(0);
    });

    test('should handle health checks', async () => {
      const isHealthy = await redis.healthCheck();
      expect(isHealthy).toBe(true);
    });
  });

  describe('Combined Database and Redis Operations', () => {
    test('should handle caching database results', async () => {
      // Create test table
      await database.query(`
        CREATE TABLE IF NOT EXISTS cached_data (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Insert test data
      await database.query(
        'INSERT INTO cached_data (name) VALUES ($1)',
        ['Cached User']
      );

      // Query database
      const dbResult = await database.query(
        'SELECT * FROM cached_data WHERE name = $1',
        ['Cached User']
      );

      // Cache the result
      const cacheKey = 'cached_user:Cached User';
      await redis.set(cacheKey, dbResult.rows[0], 60); // 60 seconds TTL

      // Retrieve from cache
      const cachedResult = await redis.get(cacheKey);

      expect(cachedResult.name).toBe('Cached User');
      expect(cachedResult.id).toBe(dbResult.rows[0].id);

      // Clean up
      await database.query('DROP TABLE cached_data');
      await redis.del(cacheKey);
    });
  });
});
