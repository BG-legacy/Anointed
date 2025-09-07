import pg from 'pg';
import { config } from '../config/index.js';
import pino from 'pino';

const { Pool } = pg;
const logger = pino({ level: config.logLevel });

class Database {
  constructor() {
    this.pool = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      // Determine the database URL based on environment
      const dbUrl =
        config.supabase.databaseUrl[config.nodeEnv] || config.database.url;

      this.pool = new Pool({
        connectionString: dbUrl,
        max: config.database.maxConnections,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
        // Apply Supabase Postgres connection parameters
        options: `-c statement_timeout=${config.database.statementTimeout} -c idle_in_transaction_session_timeout=${config.database.idleInTransactionSessionTimeout}`,
      });

      // Test the connection and apply session-level parameters
      const client = await this.pool.connect();

      // Ensure extensions are available (they should be installed at database level)
      try {
        await client.query(`
          SET statement_timeout = '${config.database.statementTimeout}';
          SET idle_in_transaction_session_timeout = '${config.database.idleInTransactionSessionTimeout}';
        `);
        logger.info('Applied database session parameters successfully');
      } catch (paramError) {
        logger.warn(
          'Could not apply database session parameters:',
          paramError.message
        );
      }

      client.release();

      this.isConnected = true;
      logger.info('Successfully connected to PostgreSQL database', {
        environment: config.nodeEnv,
        statementTimeout: config.database.statementTimeout,
        idleTimeout: config.database.idleInTransactionSessionTimeout,
      });

      return this.pool;
    } catch (error) {
      this.isConnected = false;
      logger.error('Failed to connect to PostgreSQL database:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      logger.info('Disconnected from PostgreSQL database');
    }
  }

  async query(text, params) {
    if (!this.isConnected || !this.pool) {
      throw new Error('Database not connected');
    }

    try {
      const start = Date.now();
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;

      logger.debug('Executed query', { text, duration, rows: result.rowCount });
      return result;
    } catch (error) {
      logger.error('Database query error:', { text, error: error.message });
      throw error;
    }
  }

  async getClient() {
    if (!this.isConnected || !this.pool) {
      throw new Error('Database not connected');
    }
    return this.pool.connect();
  }

  async healthCheck() {
    try {
      const result = await this.query('SELECT 1 as healthy');
      return result.rows[0].healthy === 1;
    } catch (error) {
      logger.error('Database health check failed:', error);
      return false;
    }
  }
}

// Create and export a singleton instance
export const database = new Database();
export default database;
