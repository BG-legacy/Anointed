import request from 'supertest';
import app from '../../server.js';

describe('Server - Unit Tests', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('environment');
    });
  });

  describe('GET /api/v1/healthz', () => {
    it('should return basic health check', async () => {
      const response = await request(app).get('/api/v1/healthz').expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('version');
    });
  });

  describe('GET /api/v1/version', () => {
    it('should return version information', async () => {
      const response = await request(app).get('/api/v1/version').expect(200);

      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('node_version');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  describe('GET /api', () => {
    it('should return welcome message', async () => {
      const response = await request(app).get('/api').expect(200);

      expect(response.body).toHaveProperty('message', 'Welcome to the API');
      expect(response.body).toHaveProperty('version', '1.0.0');
    });
  });

  describe('GET /nonexistent', () => {
    it('should return 404 for nonexistent routes', async () => {
      const response = await request(app).get('/nonexistent').expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });
  });
});
