import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',

  // Database
  database: {
    url:
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5433/anointed',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
    // Connection parameters for Supabase Postgres
    statementTimeout: process.env.DB_STATEMENT_TIMEOUT || '10s',
    idleInTransactionSessionTimeout:
      process.env.DB_IDLE_IN_TRANSACTION_TIMEOUT || '10s',
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshSecret:
      process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-jwt-key',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  // Supabase
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE,
    anonKey: process.env.SUPABASE_ANON_KEY,
    bucket: process.env.SUPABASE_BUCKET,
    // Environment-specific configurations
    env: process.env.NODE_ENV || 'development',
    // Database connection string for different environments
    databaseUrl: {
      development: process.env.SUPABASE_DB_URL_DEV,
      staging: process.env.SUPABASE_DB_URL_STAGE,
      production: process.env.SUPABASE_DB_URL_PROD,
    },
  },

  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // limit each IP to 100 requests per windowMs
  },
};
