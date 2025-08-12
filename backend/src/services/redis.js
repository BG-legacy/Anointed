import Redis from 'ioredis';
import { config } from '../config/index.js';
import pino from 'pino';

const logger = pino({ level: config.logLevel });

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      this.client = new Redis(config.redis.url, {
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxRetriesPerRequest: null,
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        logger.info('Successfully connected to Redis');
      });

      this.client.on('error', (error) => {
        this.isConnected = false;
        logger.error('Redis connection error:', error);
      });

      this.client.on('close', () => {
        this.isConnected = false;
        logger.info('Redis connection closed');
      });

      // Wait for connection to be established
      await this.client.ping();

      return this.client;
    } catch (error) {
      this.isConnected = false;
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      logger.info('Disconnected from Redis');
    }
  }

  async set(key, value, ttl = null) {
    if (!this.isConnected || !this.client) {
      throw new Error('Redis not connected');
    }

    try {
      if (ttl) {
        return await this.client.setex(key, ttl, JSON.stringify(value));
      }
      return await this.client.set(key, JSON.stringify(value));
    } catch (error) {
      logger.error('Redis SET error:', { key, error: error.message });
      throw error;
    }
  }

  async get(key) {
    if (!this.isConnected || !this.client) {
      throw new Error('Redis not connected');
    }

    try {
      const result = await this.client.get(key);
      return result ? JSON.parse(result) : null;
    } catch (error) {
      logger.error('Redis GET error:', { key, error: error.message });
      throw error;
    }
  }

  async del(key) {
    if (!this.isConnected || !this.client) {
      throw new Error('Redis not connected');
    }

    try {
      return await this.client.del(key);
    } catch (error) {
      logger.error('Redis DEL error:', { key, error: error.message });
      throw error;
    }
  }

  async exists(key) {
    if (!this.isConnected || !this.client) {
      throw new Error('Redis not connected');
    }

    try {
      return await this.client.exists(key);
    } catch (error) {
      logger.error('Redis EXISTS error:', { key, error: error.message });
      throw error;
    }
  }

  async healthCheck() {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis health check failed:', error);
      return false;
    }
  }
}

// Create and export a singleton instance
export const redis = new RedisService();
export default redis;
