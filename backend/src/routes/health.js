import { Router } from 'express';
import { database } from '../services/database.js';
import { redis } from '../services/redis.js';
import { config } from '../config/index.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get package.json for version info
let packageInfo;
try {
  const packagePath = join(__dirname, '../../package.json');
  packageInfo = JSON.parse(readFileSync(packagePath, 'utf8'));
} catch {
  packageInfo = { version: 'unknown' };
}

/**
 * Basic health check endpoint
 * GET /api/v1/healthz
 */
router.get('/healthz', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
      version: packageInfo.version,
    };

    res.status(200).json(health);
  } catch {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Internal server error',
    });
  }
});

/**
 * Readiness check endpoint - checks dependencies
 * GET /api/v1/readyz
 */
router.get('/readyz', async (req, res) => {
  const checks = {
    database: false,
    redis: false,
  };

  let allHealthy = true;

  try {
    // Check database connection
    if (database.isConnected) {
      checks.database = await database.healthCheck();
    }
    if (!checks.database) allHealthy = false;

    // Check Redis connection
    if (redis.isConnected) {
      checks.redis = await redis.healthCheck();
    }
    if (!checks.redis) allHealthy = false;

    const readiness = {
      status: allHealthy ? 'ready' : 'not ready',
      timestamp: new Date().toISOString(),
      checks,
      environment: config.nodeEnv,
      version: packageInfo.version,
    };

    const statusCode = allHealthy ? 200 : 503;
    res.status(statusCode).json(readiness);
  } catch {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      checks,
    });
  }
});

/**
 * Version information endpoint
 * GET /api/v1/version
 */
router.get('/version', (req, res) => {
  const versionInfo = {
    version: packageInfo.version,
    name: packageInfo.name || 'anointed-backend',
    description: packageInfo.description || 'Anointed API Backend',
    environment: config.nodeEnv,
    node_version: process.version,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };

  res.status(200).json(versionInfo);
});

export default router;
