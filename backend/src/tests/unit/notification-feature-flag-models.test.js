/**
 * Notification and Feature Flag Models Tests
 *
 * Comprehensive tests for Notification and FeatureFlag models including relationships,
 * data constraints, and business logic validation.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prismaService from '../../services/prisma.js';
import { UserRepository } from '../../repositories/index.js';

describe('Notification and Feature Flag Models', () => {
  let prisma;
  let userRepo;
  let testUsers = [];
  let testNotifications = [];
  let testFeatureFlags = [];

  beforeAll(async () => {
    // Connect to database
    await prismaService.connect();
    prisma = prismaService.client;
    userRepo = new UserRepository();

    // Create test users with unique emails using timestamp
    const timestamp = Date.now();
    const userData1 = {
      email: `user1-${timestamp}@example.com`,
      passwordHash: 'hashedPassword123',
      displayName: 'Test User 1',
      tz: 'America/New_York',
    };
    const userData2 = {
      email: `user2-${timestamp}@example.com`,
      passwordHash: 'hashedPassword456',
      displayName: 'Test User 2',
      tz: 'America/Los_Angeles',
    };

    testUsers.push(
      await userRepo.create(userData1),
      await userRepo.create(userData2)
    );
  });

  afterAll(async () => {
    // Clean up test data
    if (testNotifications.length > 0) {
      await prisma.notification.deleteMany({
        where: {
          id: { in: testNotifications.map(n => n.id) }
        }
      });
    }

    if (testFeatureFlags.length > 0) {
      await prisma.featureFlag.deleteMany({
        where: {
          key: { in: testFeatureFlags.map(f => f.key) }
        }
      });
    }

    if (testUsers.length > 0) {
      await userRepo.hardDelete(testUsers[0].id);
      await userRepo.hardDelete(testUsers[1].id);
    }

    await prismaService.disconnect();
  });

  describe('Notification Model', () => {
    describe('CRUD Operations', () => {
      it('should create a notification with all required fields', async () => {
        const notificationData = {
          userId: testUsers[0].id,
          type: 'prayer_request',
          payload: {
            title: 'New Prayer Request',
            message: 'Please pray for healing',
            requestId: 'prayer-123'
          },
          read: false
        };

        const notification = await prisma.notification.create({
          data: notificationData
        });

        testNotifications.push(notification);

        expect(notification).toBeDefined();
        expect(notification.id).toBeDefined();
        expect(notification.userId).toBe(testUsers[0].id);
        expect(notification.type).toBe('prayer_request');
        expect(notification.payload).toEqual(notificationData.payload);
        expect(notification.read).toBe(false);
        expect(notification.createdAt).toBeDefined();
        expect(notification.deletedAt).toBeNull();
      });

      it('should create a notification with default read value as false', async () => {
        const notificationData = {
          userId: testUsers[1].id,
          type: 'mention',
          payload: {
            postId: 'post-456',
            mentionedBy: 'user-789'
          }
        };

        const notification = await prisma.notification.create({
          data: notificationData
        });

        testNotifications.push(notification);

        expect(notification.read).toBe(false);
      });

      it('should read notifications by user', async () => {
        const notifications = await prisma.notification.findMany({
          where: {
            userId: testUsers[0].id,
            deletedAt: null
          },
          orderBy: { createdAt: 'desc' }
        });

        expect(notifications.length).toBeGreaterThan(0);
        expect(notifications.every(n => n.userId === testUsers[0].id)).toBe(true);
      });

      it('should update notification read status', async () => {
        const notification = testNotifications[0];
        
        const updatedNotification = await prisma.notification.update({
          where: { id: notification.id },
          data: { read: true }
        });

        expect(updatedNotification.read).toBe(true);
      });

      it('should soft delete notification', async () => {
        const notification = testNotifications[0];
        const deletedAt = new Date();
        
        const updatedNotification = await prisma.notification.update({
          where: { id: notification.id },
          data: { deletedAt }
        });

        expect(updatedNotification.deletedAt).toBeDefined();
        expect(new Date(updatedNotification.deletedAt).getTime()).toBeCloseTo(deletedAt.getTime(), -2);
      });

      it('should filter out soft deleted notifications', async () => {
        const activeNotifications = await prisma.notification.findMany({
          where: {
            userId: testUsers[0].id,
            deletedAt: null
          }
        });

        const allNotifications = await prisma.notification.findMany({
          where: {
            userId: testUsers[0].id
          }
        });

        expect(activeNotifications.length).toBeLessThan(allNotifications.length);
      });
    });

    describe('Relationships', () => {
      it('should maintain relationship with User model', async () => {
        const notification = await prisma.notification.findFirst({
          where: {
            userId: testUsers[1].id,
            deletedAt: null
          },
          include: { user: true }
        });

        expect(notification).toBeDefined();
        expect(notification.user).toBeDefined();
        expect(notification.user.id).toBe(testUsers[1].id);
        expect(notification.user.email).toBe(testUsers[1].email);
      });

      it('should cascade delete notifications when user is deleted', async () => {
        // Create a temporary user for cascade test
        const tempUser = await userRepo.create({
          email: `temp-${Date.now()}@example.com`,
          passwordHash: 'hashedPassword',
          displayName: 'Temp User'
        });

        // Create a notification for this user
        const notification = await prisma.notification.create({
          data: {
            userId: tempUser.id,
            type: 'test',
            payload: { message: 'test' }
          }
        });

        // Delete the user
        await userRepo.hardDelete(tempUser.id);

        // Check that notification is also deleted
        const deletedNotification = await prisma.notification.findUnique({
          where: { id: notification.id }
        });

        expect(deletedNotification).toBeNull();
      });
    });

    describe('Data Validation', () => {
      it('should require userId field', async () => {
        await expect(
          prisma.notification.create({
            data: {
              type: 'test',
              payload: { message: 'test' }
              // userId is missing
            }
          })
        ).rejects.toThrow(/user/i);
      });

      it('should require type field', async () => {
        await expect(
          prisma.notification.create({
            data: {
              userId: testUsers[0].id,
              payload: { message: 'test' }
              // type is missing
            }
          })
        ).rejects.toThrow(/type/i);
      });

      it('should require payload field', async () => {
        await expect(
          prisma.notification.create({
            data: {
              userId: testUsers[0].id,
              type: 'test'
              // payload is missing
            }
          })
        ).rejects.toThrow(/payload/i);
      });

      it('should store complex JSON payload correctly', async () => {
        const complexPayload = {
          type: 'group_invite',
          groupId: 'group-123',
          groupName: 'Prayer Warriors',
          invitedBy: {
            id: 'user-456',
            name: 'John Doe'
          },
          actions: ['accept', 'decline'],
          metadata: {
            timestamp: new Date().toISOString(),
            priority: 'high'
          }
        };

        const notification = await prisma.notification.create({
          data: {
            userId: testUsers[0].id,
            type: 'group_invite',
            payload: complexPayload
          }
        });

        testNotifications.push(notification);

        expect(notification.payload).toEqual(complexPayload);
      });
    });

    describe('Queries and Filtering', () => {
      it('should filter notifications by type', async () => {
        // Create notifications of different types
        const mentionNotification = await prisma.notification.create({
          data: {
            userId: testUsers[0].id,
            type: 'mention',
            payload: { message: 'You were mentioned' }
          }
        });

        const prayerNotification = await prisma.notification.create({
          data: {
            userId: testUsers[0].id,
            type: 'prayer_answered',
            payload: { prayerId: 'prayer-123' }
          }
        });

        testNotifications.push(mentionNotification, prayerNotification);

        const mentionNotifications = await prisma.notification.findMany({
          where: {
            userId: testUsers[0].id,
            type: 'mention',
            deletedAt: null
          }
        });

        expect(mentionNotifications.length).toBeGreaterThan(0);
        expect(mentionNotifications.every(n => n.type === 'mention')).toBe(true);
      });

      it('should filter unread notifications', async () => {
        const unreadNotifications = await prisma.notification.findMany({
          where: {
            userId: testUsers[0].id,
            read: false,
            deletedAt: null
          }
        });

        expect(unreadNotifications.length).toBeGreaterThan(0);
        expect(unreadNotifications.every(n => n.read === false)).toBe(true);
      });

      it('should order notifications by creation date', async () => {
        const notifications = await prisma.notification.findMany({
          where: {
            userId: testUsers[0].id,
            deletedAt: null
          },
          orderBy: { createdAt: 'desc' }
        });

        for (let i = 1; i < notifications.length; i++) {
          expect(new Date(notifications[i-1].createdAt) >= new Date(notifications[i].createdAt)).toBe(true);
        }
      });
    });
  });

  describe('FeatureFlag Model', () => {
    describe('CRUD Operations', () => {
      it('should create a feature flag with all required fields', async () => {
        const flagData = {
          key: `test_feature_1_${Date.now()}`,
          enabled: true,
          payload: {
            description: 'Test feature for development',
            rolloutPercentage: 50
          }
        };

        const featureFlag = await prisma.featureFlag.create({
          data: flagData
        });

        testFeatureFlags.push(featureFlag);

        expect(featureFlag).toBeDefined();
        expect(featureFlag.key).toBe(flagData.key);
        expect(featureFlag.enabled).toBe(true);
        expect(featureFlag.payload).toEqual(flagData.payload);
        expect(featureFlag.updatedAt).toBeDefined();
      });

      it('should create a feature flag with default enabled value as false', async () => {
        const flagData = {
          key: `test_feature_2_${Date.now()}`
        };

        const featureFlag = await prisma.featureFlag.create({
          data: flagData
        });

        testFeatureFlags.push(featureFlag);

        expect(featureFlag.enabled).toBe(false);
        expect(featureFlag.payload).toBeNull();
      });

      it('should update feature flag enabled status', async () => {
        const featureFlag = testFeatureFlags[0];
        
        const updatedFlag = await prisma.featureFlag.update({
          where: { key: featureFlag.key },
          data: { enabled: false }
        });

        expect(updatedFlag.enabled).toBe(false);
        expect(new Date(updatedFlag.updatedAt) > new Date(featureFlag.updatedAt)).toBe(true);
      });

      it('should update feature flag payload', async () => {
        const featureFlag = testFeatureFlags[0];
        const newPayload = {
          description: 'Updated test feature',
          rolloutPercentage: 100,
          environments: ['development', 'staging']
        };
        
        const updatedFlag = await prisma.featureFlag.update({
          where: { key: featureFlag.key },
          data: { payload: newPayload }
        });

        expect(updatedFlag.payload).toEqual(newPayload);
      });

      it('should read feature flag by key', async () => {
        const firstFlag = testFeatureFlags[0];
        const featureFlag = await prisma.featureFlag.findUnique({
          where: { key: firstFlag.key }
        });

        expect(featureFlag).toBeDefined();
        expect(featureFlag.key).toBe(firstFlag.key);
      });

      it('should delete feature flag', async () => {
        // Create a temporary flag for deletion test
        const tempKey = `temp_feature_${Date.now()}`;
        const tempFlag = await prisma.featureFlag.create({
          data: {
            key: tempKey,
            enabled: false
          }
        });

        await prisma.featureFlag.delete({
          where: { key: tempFlag.key }
        });

        const deletedFlag = await prisma.featureFlag.findUnique({
          where: { key: tempKey }
        });

        expect(deletedFlag).toBeNull();
      });
    });

    describe('Data Validation', () => {
      it('should require unique key field', async () => {
        // Try to create a flag with existing key
        const existingKey = testFeatureFlags[0].key;
        await expect(
          prisma.featureFlag.create({
            data: {
              key: existingKey, // This key already exists from earlier test
              enabled: true
            }
          })
        ).rejects.toThrow(/unique/i);
      });

      it('should allow null payload', async () => {
        const featureFlag = await prisma.featureFlag.create({
          data: {
            key: `minimal_feature_${Date.now()}`,
            enabled: true,
            payload: null
          }
        });

        testFeatureFlags.push(featureFlag);

        expect(featureFlag.payload).toBeNull();
      });

      it('should store complex JSON payload correctly', async () => {
        const complexPayload = {
          feature: 'advanced_prayer_analytics',
          config: {
            enableMetrics: true,
            dataRetentionDays: 90,
            allowedUserRoles: ['admin', 'moderator']
          },
          rollout: {
            strategy: 'gradual',
            percentage: 25,
            targetGroups: ['beta_testers']
          }
        };

        const featureFlag = await prisma.featureFlag.create({
          data: {
            key: `complex_feature_${Date.now()}`,
            enabled: true,
            payload: complexPayload
          }
        });

        testFeatureFlags.push(featureFlag);

        expect(featureFlag.payload).toEqual(complexPayload);
      });
    });

    describe('Queries and Filtering', () => {
      it('should filter enabled feature flags', async () => {
        const enabledFlags = await prisma.featureFlag.findMany({
          where: { enabled: true }
        });

        expect(enabledFlags.length).toBeGreaterThan(0);
        expect(enabledFlags.every(f => f.enabled === true)).toBe(true);
      });

      it('should filter disabled feature flags', async () => {
        const disabledFlags = await prisma.featureFlag.findMany({
          where: { enabled: false }
        });

        expect(disabledFlags.length).toBeGreaterThan(0);
        expect(disabledFlags.every(f => f.enabled === false)).toBe(true);
      });

      it('should order feature flags by key', async () => {
        const flags = await prisma.featureFlag.findMany({
          orderBy: { key: 'asc' }
        });

        for (let i = 1; i < flags.length; i++) {
          expect(flags[i-1].key.localeCompare(flags[i].key)).toBeLessThanOrEqual(0);
        }
      });

      it('should find feature flags by key pattern', async () => {
        // Create flags with specific naming pattern
        const timestamp = Date.now();
        await prisma.featureFlag.create({
          data: {
            key: `prayer_feature_v1_${timestamp}`,
            enabled: true
          }
        });

        await prisma.featureFlag.create({
          data: {
            key: `prayer_feature_v2_${timestamp}`,
            enabled: false
          }
        });

        testFeatureFlags.push(
          { key: `prayer_feature_v1_${timestamp}` },
          { key: `prayer_feature_v2_${timestamp}` }
        );

        const prayerFeatures = await prisma.featureFlag.findMany({
          where: {
            key: {
              contains: 'prayer_feature'
            }
          }
        });

        expect(prayerFeatures.length).toBeGreaterThanOrEqual(2);
        expect(prayerFeatures.every(f => f.key.includes('prayer_feature'))).toBe(true);
      });
    });

    describe('updatedAt Behavior', () => {
      it('should automatically update updatedAt on modifications', async () => {
        const initialFlag = await prisma.featureFlag.create({
          data: {
            key: `auto_update_test_${Date.now()}`,
            enabled: false
          }
        });

        testFeatureFlags.push(initialFlag);

        const initialTime = new Date(initialFlag.updatedAt);

        // Wait a small amount to ensure different timestamp
        await new Promise(resolve => setTimeout(resolve, 10));

        const updatedFlag = await prisma.featureFlag.update({
          where: { key: initialFlag.key },
          data: { enabled: true }
        });

        const updatedTime = new Date(updatedFlag.updatedAt);

        expect(updatedTime > initialTime).toBe(true);
      });
    });
  });

  describe('Combined Model Scenarios', () => {
    it('should handle notification about feature flag changes', async () => {
      // Create a feature flag
      const featureFlag = await prisma.featureFlag.create({
        data: {
          key: `new_ui_feature_${Date.now()}`,
          enabled: true,
          payload: {
            description: 'New UI feature enabled',
            version: '2.0'
          }
        }
      });

      testFeatureFlags.push(featureFlag);

      // Create notification about the feature flag
      const notification = await prisma.notification.create({
        data: {
          userId: testUsers[0].id,
          type: 'feature_flag_update',
          payload: {
            featureKey: featureFlag.key,
            message: 'New feature available!',
            featureData: featureFlag.payload
          }
        }
      });

      testNotifications.push(notification);

      expect(notification.payload.featureKey).toBe(featureFlag.key);
      expect(notification.payload.featureData).toEqual(featureFlag.payload);
    });

    it('should support bulk operations for notifications', async () => {
      const bulkNotifications = [
        {
          userId: testUsers[0].id,
          type: 'bulk_test_1',
          payload: { message: 'Bulk message 1' }
        },
        {
          userId: testUsers[0].id,
          type: 'bulk_test_2',
          payload: { message: 'Bulk message 2' }
        },
        {
          userId: testUsers[1].id,
          type: 'bulk_test_3',
          payload: { message: 'Bulk message 3' }
        }
      ];

      const result = await prisma.notification.createMany({
        data: bulkNotifications
      });

      expect(result.count).toBe(3);

      // Clean up bulk notifications
      await prisma.notification.deleteMany({
        where: {
          type: {
            in: ['bulk_test_1', 'bulk_test_2', 'bulk_test_3']
          }
        }
      });
    });

    it('should support bulk operations for feature flags', async () => {
      const timestamp = Date.now();
      const bulkFlags = [
        {
          key: `bulk_flag_1_${timestamp}`,
          enabled: true,
          payload: { description: 'Bulk flag 1' }
        },
        {
          key: `bulk_flag_2_${timestamp}`,
          enabled: false,
          payload: { description: 'Bulk flag 2' }
        }
      ];

      const result = await prisma.featureFlag.createMany({
        data: bulkFlags
      });

      expect(result.count).toBe(2);

      testFeatureFlags.push(
        { key: `bulk_flag_1_${timestamp}` },
        { key: `bulk_flag_2_${timestamp}` }
      );
    });
  });
});
