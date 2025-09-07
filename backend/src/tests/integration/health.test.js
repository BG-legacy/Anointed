import { describe, beforeAll, afterAll, test, expect } from '@jest/globals';
import request from 'supertest';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';
import app from '../../server.js';
import { database } from '../../services/database.js';
import { redis } from '../../services/redis.js';

describe('Health Routes Integration Tests', () => {
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

  describe('GET /api/v1/healthz', () => {
    test('should return healthy status', async () => {
      const response = await request(app)
        .get('/api/v1/healthz')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        environment: expect.any(String),
        version: expect.any(String),
        timestamp: expect.any(String),
      });
    });
  });

  describe('GET /api/v1/readyz', () => {
    test('should return ready status when services are healthy', async () => {
      const response = await request(app)
        .get('/api/v1/readyz')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'ready',
        environment: expect.any(String),
        version: expect.any(String),
        timestamp: expect.any(String),
        checks: {
          database: true,
          redis: true,
        },
      });
    });

    test('should return not ready status when database is down', async () => {
      // Disconnect database
      await database.disconnect();

      const response = await request(app)
        .get('/api/v1/readyz')
        .expect(503);

      expect(response.body).toMatchObject({
        status: 'not ready',
        checks: {
          database: false,
          redis: true,
        },
      });

      // Reconnect for cleanup
      await database.connect();
    });

    test('should return not ready status when Redis is down', async () => {
      // Disconnect Redis
      await redis.disconnect();

      const response = await request(app)
        .get('/api/v1/readyz')
        .expect(503);

      expect(response.body).toMatchObject({
        status: 'not ready',
        checks: {
          database: true,
          redis: false,
        },
      });

      // Reconnect for cleanup
      await redis.connect();
    });
  });

  describe('GET /api/v1/version', () => {
    test('should return version information', async () => {
      const response = await request(app)
        .get('/api/v1/version')
        .expect(200);

      expect(response.body).toMatchObject({
        version: expect.any(String),
        name: expect.any(String),
        environment: expect.any(String),
        node_version: expect.any(String),
        uptime: expect.any(Number),
        timestamp: expect.any(String),
      });

      expect(response.body.node_version).toMatch(/^v\d+\.\d+\.\d+/);
      expect(response.body.uptime).toBeGreaterThan(0);
    });
  });
});
