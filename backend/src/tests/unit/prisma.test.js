/**
 * Prisma Service Tests
 * 
 * Tests for Prisma client integration and repository functionality.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prismaService from '../../services/prisma.js';
import { UserRepository, UserSettingsRepository, DeviceRepository } from '../../repositories/index.js';

describe('Prisma Integration', () => {
  let userRepo, settingsRepo, deviceRepo;
  let testUser, testSettings, testDevice;

  beforeAll(async () => {
    // Initialize repositories
    userRepo = new UserRepository();
    settingsRepo = new UserSettingsRepository();
    deviceRepo = new DeviceRepository();

    // Connect to database
    await prismaService.connect();
  });

  afterAll(async () => {
    // Clean up test data
    if (testDevice) {
      try {
        await deviceRepo.delete(testDevice.id);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    
    if (testSettings) {
      try {
        await settingsRepo.delete(testSettings.userId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    
    if (testUser) {
      try {
        await userRepo.hardDelete(testUser.id);
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    // Disconnect from database
    await prismaService.disconnect();
  });

  describe('Database Connection', () => {
    it('should connect to the database', async () => {
      const isHealthy = await prismaService.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should get database info', async () => {
      const dbInfo = await prismaService.getDatabaseInfo();
      expect(dbInfo).toHaveProperty('postgres_version');
      expect(dbInfo).toHaveProperty('database_name');
    });
  });

  describe('User Repository', () => {
    it('should create a user', async () => {
      const userData = {
        email: 'test@example.com',
        passwordHash: 'hashedPassword123',
        displayName: 'Test User',
        tz: 'America/New_York',
      };

      testUser = await userRepo.create(userData);
      
      expect(testUser).toHaveProperty('id');
      expect(testUser.email).toBe(userData.email);
      expect(testUser.displayName).toBe(userData.displayName);
      expect(testUser.deletedAt).toBeNull();
    });

    it('should find user by email', async () => {
      const foundUser = await userRepo.findByEmail('test@example.com');
      
      expect(foundUser).toBeTruthy();
      expect(foundUser.id).toBe(testUser.id);
    });

    it('should check if email exists', async () => {
      const exists = await userRepo.emailExists('test@example.com');
      expect(exists).toBe(true);

      const notExists = await userRepo.emailExists('nonexistent@example.com');
      expect(notExists).toBe(false);
    });
  });

  describe('User Settings Repository', () => {
    it('should create user settings', async () => {
      const settingsData = {
        userId: testUser.id,
        bibleTranslation: 'NIV',
        denomination: 'Baptist',
        quietTimeStart: '06:00',
        quietTimeEnd: '07:00',
        pushOptIn: true,
      };

      testSettings = await settingsRepo.create(settingsData);
      
      expect(testSettings).toHaveProperty('userId');
      expect(testSettings.userId).toBe(testUser.id);
      expect(testSettings.bibleTranslation).toBe('NIV');
      expect(testSettings.pushOptIn).toBe(true);
    });

    it('should find settings by user ID', async () => {
      const foundSettings = await settingsRepo.findByUserId(testUser.id);
      
      expect(foundSettings).toBeTruthy();
      expect(foundSettings.userId).toBe(testUser.id);
      expect(foundSettings.bibleTranslation).toBe('NIV');
    });

    it('should update user settings', async () => {
      const updatedSettings = await settingsRepo.update(testUser.id, {
        bibleTranslation: 'ESV',
        denomination: 'Methodist',
      });
      
      expect(updatedSettings.bibleTranslation).toBe('ESV');
      expect(updatedSettings.denomination).toBe('Methodist');
    });
  });

  describe('Device Repository', () => {
    it('should create a device', async () => {
      const deviceData = {
        userId: testUser.id,
        platform: 'ios',
        pushToken: 'test-push-token-123',
      };

      testDevice = await deviceRepo.create(deviceData);
      
      expect(testDevice).toHaveProperty('id');
      expect(testDevice.userId).toBe(testUser.id);
      expect(testDevice.platform).toBe('ios');
      expect(testDevice.pushToken).toBe('test-push-token-123');
    });

    it('should find devices by user ID', async () => {
      const devices = await deviceRepo.findByUserId(testUser.id);
      
      expect(devices).toHaveLength(1);
      expect(devices[0].id).toBe(testDevice.id);
    });

    it('should update last seen timestamp', async () => {
      const originalLastSeen = testDevice.lastSeenAt;
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const updatedDevice = await deviceRepo.updateLastSeen(testDevice.id);
      
      expect(updatedDevice.lastSeenAt).not.toBe(originalLastSeen);
    });

    it('should get push tokens for user', async () => {
      const pushTokens = await deviceRepo.getPushTokensForUser(testUser.id);
      
      expect(pushTokens).toHaveLength(1);
      expect(pushTokens[0].token).toBe('test-push-token-123');
      expect(pushTokens[0].platform).toBe('ios');
    });
  });

  describe('Soft Delete Functionality', () => {
    it('should soft delete a user', async () => {
      const softDeletedUser = await userRepo.softDelete(testUser.id);
      
      expect(softDeletedUser.deletedAt).toBeTruthy();
      expect(softDeletedUser.deletedAt).toBeInstanceOf(Date);
    });

    it('should not find soft deleted user by email', async () => {
      const foundUser = await userRepo.findByEmail('test@example.com');
      expect(foundUser).toBeNull();
    });

    it('should restore soft deleted user', async () => {
      const restoredUser = await userRepo.restore(testUser.id);
      
      expect(restoredUser.deletedAt).toBeNull();
      
      // Should be able to find again
      const foundUser = await userRepo.findByEmail('test@example.com');
      expect(foundUser).toBeTruthy();
    });
  });
});

