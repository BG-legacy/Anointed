import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pino from 'pino';
import { config } from './config/index.js';
import { errorHandler, notFound, requestLogger } from './middleware/index.js';
import { database } from './services/database.js';
import { redis } from './services/redis.js';
import healthRoutes from './routes/health.js';

// Initialize logger
const logger = pino({
  level: config.logLevel,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});

// Create Express app
const app = express();

// Security middleware
app.use(helmet());

// CORS middleware
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger(logger));

// Initialize database and Redis connections
async function initializeServices() {
  try {
    await database.connect();
    await redis.connect();
    logger.info('All services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    // Don't exit in development, but log the error
    if (config.nodeEnv === 'production') {
      process.exit(1);
    }
  }
}

// Health check routes
app.use('/api/v1', healthRoutes);

// Legacy health check endpoint (for backward compatibility)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// API routes
app.get('/api', (req, res) => {
  res.json({
    message: 'Welcome to the API',
    version: '1.0.0',
  });
});

// 404 handler
app.use(notFound);

// Error handling middleware (must be last)
app.use(errorHandler(logger));

// Start server (only if not in test mode or when explicitly required)
let server;
if (config.nodeEnv !== 'test') {
  // Initialize services before starting server
  initializeServices().then(() => {
    server = app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
    });
  }).catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });
}

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  try {
    // Close database and Redis connections
    await Promise.all([
      database.disconnect(),
      redis.disconnect(),
    ]);

    if (server) {
      server.close(() => {
        logger.info('HTTP server closed.');
        process.exit(0);
      });

      // Force close server after 30 seconds
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 30000);
    } else {
      process.exit(0);
    }
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
