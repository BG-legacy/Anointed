// Jest setup file
import { config } from './index.js';

// Set test environment
process.env.NODE_ENV = 'test';

// Override config for testing
config.nodeEnv = 'test';
config.logLevel = 'silent';

describe('Config', () => {
  it('should have test environment configured', () => {
    expect(config.nodeEnv).toBe('test');
  });

  it('should have silent log level for tests', () => {
    expect(config.logLevel).toBe('silent');
  });

  it('should have required configuration properties', () => {
    expect(config).toHaveProperty('port');
    expect(config).toHaveProperty('nodeEnv');
    expect(config).toHaveProperty('logLevel');
  });
});

// Global test setup
beforeAll(() => {
  // Setup before all tests
});

afterAll(() => {
  // Cleanup after all tests
});

beforeEach(() => {
  // Setup before each test
});

afterEach(() => {
  // Cleanup after each test
});
