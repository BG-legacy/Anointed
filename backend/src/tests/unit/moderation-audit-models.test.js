/**
 * Moderation and Audit Models Tests
 *
 * Comprehensive tests for ModerationAction and AuditLog models including relationships,
 * enum constraints, and business logic validation.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prismaService from '../../services/prisma.js';
import { UserRepository } from '../../repositories/index.js';

describe('Moderation and Audit Models', () => {
  let prisma;
  let userRepo;
  let testUsers = [];
  let testModerationActions = [];
  let testAuditLogs = [];
  let testPost;

  beforeAll(async () => {
    // Connect to database
    await prismaService.connect();
    prisma = prismaService.client;
    userRepo = new UserRepository();

    // Create test users
    const userData1 = {
      email: 'moderator@example.com',
      passwordHash: 'hashedPassword123',
      displayName: 'Test Moderator',
      tz: 'America/New_York',
    };
    const userData2 = {
      email: 'user@example.com',
      passwordHash: 'hashedPassword456',
      displayName: 'Test User',
      tz: 'America/Los_Angeles',
    };
    const userData3 = {
      email: 'admin@example.com',
      passwordHash: 'hashedPassword789',
      displayName: 'Test Admin',
      tz: 'America/Chicago',
    };

    testUsers.push(
      await userRepo.create(userData1),
      await userRepo.create(userData2),
      await userRepo.create(userData3)
    );

    // Create a test post for moderation actions
    testPost = await prisma.post.create({
      data: {
        userId: testUsers[1].id,
        type: 'POST',
        content: 'Test post content for moderation',
        status: 'ACTIVE',
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    for (const moderationAction of testModerationActions) {
      try {
        await prisma.moderationAction.delete({
          where: { id: moderationAction.id },
        });
      } catch {
        // Ignore cleanup errors
      }
    }

    for (const auditLog of testAuditLogs) {
      try {
        await prisma.auditLog.delete({
          where: { id: auditLog.id },
        });
      } catch {
        // Ignore cleanup errors
      }
    }

    // Clean up test post
    try {
      await prisma.post.delete({ where: { id: testPost.id } });
    } catch {
      // Ignore cleanup errors
    }

    // Clean up test users
    for (const user of testUsers) {
      try {
        await userRepo.hardDelete(user.id);
      } catch {
        // Ignore cleanup errors
      }
    }

    // Disconnect from database
    await prismaService.disconnect();
  });

  describe('ModerationAction Model', () => {
    it('should create a moderation action with APPROVE action', async () => {
      const moderationData = {
        entityType: 'post',
        entityId: testPost.id,
        actorId: testUsers[0].id, // moderator
        action: 'APPROVE',
        notes: 'Post content is appropriate and approved',
      };

      const moderationAction = await prisma.moderationAction.create({
        data: moderationData,
        include: {
          actor: true,
        },
      });

      testModerationActions.push(moderationAction);

      expect(moderationAction).toHaveProperty('id');
      expect(moderationAction.entityType).toBe('post');
      expect(moderationAction.entityId).toBe(testPost.id);
      expect(moderationAction.actorId).toBe(testUsers[0].id);
      expect(moderationAction.action).toBe('APPROVE');
      expect(moderationAction.notes).toBe('Post content is appropriate and approved');
      expect(moderationAction.createdAt).toBeInstanceOf(Date);
      expect(moderationAction.actor.email).toBe(testUsers[0].email);
    });

    it('should create a moderation action with REJECT action', async () => {
      const moderationData = {
        entityType: 'comment',
        entityId: testPost.id, // Using post ID as example entity
        actorId: testUsers[0].id,
        action: 'REJECT',
        notes: 'Content violates community guidelines',
      };

      const moderationAction = await prisma.moderationAction.create({
        data: moderationData,
        include: {
          actor: true,
        },
      });

      testModerationActions.push(moderationAction);

      expect(moderationAction.action).toBe('REJECT');
      expect(moderationAction.entityType).toBe('comment');
      expect(moderationAction.notes).toBe('Content violates community guidelines');
    });

    it('should create a moderation action with REMOVE action', async () => {
      const moderationData = {
        entityType: 'post',
        entityId: testPost.id,
        actorId: testUsers[2].id, // admin
        action: 'REMOVE',
        notes: 'Spam content removed',
      };

      const moderationAction = await prisma.moderationAction.create({
        data: moderationData,
        include: {
          actor: true,
        },
      });

      testModerationActions.push(moderationAction);

      expect(moderationAction.action).toBe('REMOVE');
      expect(moderationAction.actorId).toBe(testUsers[2].id);
      expect(moderationAction.actor.email).toBe(testUsers[2].email);
    });

    it('should create a moderation action with BAN action', async () => {
      const moderationData = {
        entityType: 'user',
        entityId: testUsers[1].id, // user being banned
        actorId: testUsers[2].id, // admin performing ban
        action: 'BAN',
        notes: 'Repeated violations of community standards',
      };

      const moderationAction = await prisma.moderationAction.create({
        data: moderationData,
        include: {
          actor: true,
        },
      });

      testModerationActions.push(moderationAction);

      expect(moderationAction.action).toBe('BAN');
      expect(moderationAction.entityType).toBe('user');
      expect(moderationAction.entityId).toBe(testUsers[1].id);
    });

    it('should create a moderation action without notes (optional field)', async () => {
      const moderationData = {
        entityType: 'post',
        entityId: testPost.id,
        actorId: testUsers[0].id,
        action: 'APPROVE',
      };

      const moderationAction = await prisma.moderationAction.create({
        data: moderationData,
      });

      testModerationActions.push(moderationAction);

      expect(moderationAction.notes).toBeNull();
      expect(moderationAction.action).toBe('APPROVE');
    });

    it('should reject invalid action enum values', async () => {
      const invalidModerationData = {
        entityType: 'post',
        entityId: testPost.id,
        actorId: testUsers[0].id,
        action: 'INVALID_ACTION',
      };

      await expect(
        prisma.moderationAction.create({ data: invalidModerationData })
      ).rejects.toThrow();
    });

    it('should find moderation actions by entity type', async () => {
      const postActions = await prisma.moderationAction.findMany({
        where: { entityType: 'post' },
        include: {
          actor: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(postActions.length).toBeGreaterThan(0);
      postActions.forEach((action) => {
        expect(action.entityType).toBe('post');
        expect(action.actor).toBeTruthy();
      });
    });

    it('should find moderation actions by actor', async () => {
      const moderatorActions = await prisma.moderationAction.findMany({
        where: { actorId: testUsers[0].id },
        include: {
          actor: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(moderatorActions.length).toBeGreaterThan(0);
      moderatorActions.forEach((action) => {
        expect(action.actorId).toBe(testUsers[0].id);
        expect(action.actor.email).toBe(testUsers[0].email);
      });
    });

    it('should find moderation actions by action type', async () => {
      const approveActions = await prisma.moderationAction.findMany({
        where: { action: 'APPROVE' },
      });

      const banActions = await prisma.moderationAction.findMany({
        where: { action: 'BAN' },
      });

      expect(approveActions.length).toBeGreaterThan(0);
      expect(banActions.length).toBe(1);

      approveActions.forEach((action) => {
        expect(action.action).toBe('APPROVE');
      });
      banActions.forEach((action) => {
        expect(action.action).toBe('BAN');
      });
    });

    it('should find moderation actions for a specific entity', async () => {
      const entityActions = await prisma.moderationAction.findMany({
        where: {
          entityType: 'post',
          entityId: testPost.id,
        },
        include: {
          actor: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(entityActions.length).toBeGreaterThan(0);
      entityActions.forEach((action) => {
        expect(action.entityType).toBe('post');
        expect(action.entityId).toBe(testPost.id);
      });
    });

    it('should count moderation actions by type', async () => {
      const actionCounts = await prisma.moderationAction.groupBy({
        by: ['action'],
        _count: {
          action: true,
        },
      });

      expect(actionCounts.length).toBeGreaterThan(0);
      
      const approveCount = actionCounts.find(item => item.action === 'APPROVE')?._count.action || 0;
      const banCount = actionCounts.find(item => item.action === 'BAN')?._count.action || 0;
      
      expect(approveCount).toBeGreaterThan(0);
      expect(banCount).toBe(1);
    });
  });

  describe('AuditLog Model', () => {
    it('should create an audit log with user ID', async () => {
      const auditData = {
        userId: testUsers[1].id,
        action: 'user_login',
        entityType: 'user',
        entityId: testUsers[1].id,
        metadata: {
          ip: '192.168.1.1',
          userAgent: 'Mozilla/5.0 Test Browser',
          loginMethod: 'email',
        },
      };

      const auditLog = await prisma.auditLog.create({
        data: auditData,
        include: {
          user: true,
        },
      });

      testAuditLogs.push(auditLog);

      expect(auditLog).toHaveProperty('id');
      expect(auditLog.userId).toBe(testUsers[1].id);
      expect(auditLog.action).toBe('user_login');
      expect(auditLog.entityType).toBe('user');
      expect(auditLog.entityId).toBe(testUsers[1].id);
      expect(auditLog.metadata).toEqual({
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser',
        loginMethod: 'email',
      });
      expect(auditLog.createdAt).toBeInstanceOf(Date);
      expect(auditLog.user.email).toBe(testUsers[1].email);
    });

    it('should create an audit log without user ID (system action)', async () => {
      const auditData = {
        action: 'system_cleanup',
        entityType: 'database',
        entityId: testUsers[0].id, // Use a valid UUID instead of string
        metadata: {
          operation: 'delete_expired_tokens',
          recordsAffected: 150,
          duration: '2.5s',
        },
      };

      const auditLog = await prisma.auditLog.create({
        data: auditData,
      });

      testAuditLogs.push(auditLog);

      expect(auditLog.userId).toBeNull();
      expect(auditLog.action).toBe('system_cleanup');
      expect(auditLog.entityType).toBe('database');
      expect(auditLog.entityId).toBe(testUsers[0].id);
      expect(auditLog.metadata.operation).toBe('delete_expired_tokens');
    });

    it('should create an audit log for post creation', async () => {
      const auditData = {
        userId: testUsers[1].id,
        action: 'post_created',
        entityType: 'post',
        entityId: testPost.id,
        metadata: {
          postType: 'POST',
          contentLength: testPost.content.length,
          groupId: null,
        },
      };

      const auditLog = await prisma.auditLog.create({
        data: auditData,
        include: {
          user: true,
        },
      });

      testAuditLogs.push(auditLog);

      expect(auditLog.action).toBe('post_created');
      expect(auditLog.entityType).toBe('post');
      expect(auditLog.entityId).toBe(testPost.id);
      expect(auditLog.metadata.postType).toBe('POST');
    });

    it('should create an audit log for moderation action', async () => {
      const moderationAction = testModerationActions[0];
      const auditData = {
        userId: moderationAction.actorId,
        action: 'moderation_action_performed',
        entityType: 'moderation_action',
        entityId: moderationAction.id,
        metadata: {
          moderationAction: moderationAction.action,
          targetEntityType: moderationAction.entityType,
          targetEntityId: moderationAction.entityId,
          notes: moderationAction.notes,
        },
      };

      const auditLog = await prisma.auditLog.create({
        data: auditData,
        include: {
          user: true,
        },
      });

      testAuditLogs.push(auditLog);

      expect(auditLog.action).toBe('moderation_action_performed');
      expect(auditLog.metadata.moderationAction).toBe(moderationAction.action);
      expect(auditLog.metadata.targetEntityType).toBe(moderationAction.entityType);
    });

    it('should create an audit log without metadata (optional field)', async () => {
      const auditData = {
        userId: testUsers[0].id,
        action: 'profile_updated',
        entityType: 'user',
        entityId: testUsers[0].id,
      };

      const auditLog = await prisma.auditLog.create({
        data: auditData,
      });

      testAuditLogs.push(auditLog);

      expect(auditLog.metadata).toBeNull();
      expect(auditLog.action).toBe('profile_updated');
    });

    it('should find audit logs by user', async () => {
      const userAuditLogs = await prisma.auditLog.findMany({
        where: { userId: testUsers[1].id },
        include: {
          user: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(userAuditLogs.length).toBeGreaterThan(0);
      userAuditLogs.forEach((log) => {
        expect(log.userId).toBe(testUsers[1].id);
        expect(log.user.email).toBe(testUsers[1].email);
      });
    });

    it('should find audit logs by action', async () => {
      const loginLogs = await prisma.auditLog.findMany({
        where: { action: 'user_login' },
        include: {
          user: true,
        },
      });

      expect(loginLogs.length).toBe(1);
      expect(loginLogs[0].action).toBe('user_login');
      expect(loginLogs[0].metadata.loginMethod).toBe('email');
    });

    it('should find audit logs by entity type and ID', async () => {
      const postLogs = await prisma.auditLog.findMany({
        where: {
          entityType: 'post',
          entityId: testPost.id,
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(postLogs.length).toBeGreaterThan(0);
      postLogs.forEach((log) => {
        expect(log.entityType).toBe('post');
        expect(log.entityId).toBe(testPost.id);
      });
    });

    it('should find system audit logs (no user ID)', async () => {
      const systemLogs = await prisma.auditLog.findMany({
        where: { userId: null },
        orderBy: { createdAt: 'desc' },
      });

      expect(systemLogs.length).toBeGreaterThan(0);
      systemLogs.forEach((log) => {
        expect(log.userId).toBeNull();
      });
    });

    it('should query audit logs with metadata filtering', async () => {
      // This would typically be done with a JSON query in a real application
      const allLogs = await prisma.auditLog.findMany({
        where: {
          action: {
            contains: 'login',
          },
        },
      });

      const loginLog = allLogs.find(log => log.action === 'user_login');
      expect(loginLog.metadata.ip).toBe('192.168.1.1');
    });

    it('should count audit logs by action type', async () => {
      const actionCounts = await prisma.auditLog.groupBy({
        by: ['action'],
        _count: {
          action: true,
        },
      });

      expect(actionCounts.length).toBeGreaterThan(0);
      
      const loginCount = actionCounts.find(item => item.action === 'user_login')?._count.action || 0;
      expect(loginCount).toBe(1);
    });
  });

  describe('Model Relationships and Integration', () => {
    it('should query user with their moderation actions and audit logs', async () => {
      const userWithActions = await prisma.user.findUnique({
        where: { id: testUsers[0].id },
        include: {
          moderationActions: {
            orderBy: { createdAt: 'desc' },
          },
          auditLogs: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      expect(userWithActions.moderationActions).toBeInstanceOf(Array);
      expect(userWithActions.auditLogs).toBeInstanceOf(Array);
      expect(userWithActions.moderationActions.length).toBeGreaterThan(0);
      expect(userWithActions.auditLogs.length).toBeGreaterThan(0);

      userWithActions.moderationActions.forEach((action) => {
        expect(action.actorId).toBe(testUsers[0].id);
      });

      userWithActions.auditLogs.forEach((log) => {
        expect(log.userId).toBe(testUsers[0].id);
      });
    });

    it('should handle cascade delete when user is deleted', async () => {
      // Create a temporary user for deletion test
      const tempUser = await userRepo.create({
        email: 'temp-user-delete@example.com',
        passwordHash: 'hashedPassword999',
        displayName: 'Temp User for Deletion',
        tz: 'UTC',
      });

      // Create moderation action and audit log for temp user
      const tempModerationAction = await prisma.moderationAction.create({
        data: {
          entityType: 'test',
          entityId: tempUser.id,
          actorId: tempUser.id,
          action: 'APPROVE',
          notes: 'Test action for deletion',
        },
      });

      const tempAuditLog = await prisma.auditLog.create({
        data: {
          userId: tempUser.id,
          action: 'test_action',
          entityType: 'test',
          entityId: tempUser.id,
        },
      });

      // Verify they exist
      expect(
        await prisma.moderationAction.findUnique({
          where: { id: tempModerationAction.id },
        })
      ).toBeTruthy();

      expect(
        await prisma.auditLog.findUnique({
          where: { id: tempAuditLog.id },
        })
      ).toBeTruthy();

      // Delete the user (hard delete)
      await userRepo.hardDelete(tempUser.id);

      // Verify moderation action is deleted (cascade)
      expect(
        await prisma.moderationAction.findUnique({
          where: { id: tempModerationAction.id },
        })
      ).toBeNull();

      // Verify audit log user reference is set to null (SetNull)
      const auditLogAfterDelete = await prisma.auditLog.findUnique({
        where: { id: tempAuditLog.id },
      });
      expect(auditLogAfterDelete.userId).toBeNull();

      // Clean up the audit log
      await prisma.auditLog.delete({
        where: { id: tempAuditLog.id },
      });
    });

    it('should create related audit logs for moderation actions', async () => {
      // This demonstrates how moderation actions might trigger audit logs
      const moderationAction = await prisma.moderationAction.create({
        data: {
          entityType: 'post',
          entityId: testPost.id,
          actorId: testUsers[2].id,
          action: 'REMOVE',
          notes: 'Content violates policy',
        },
      });

      testModerationActions.push(moderationAction);

      // Create corresponding audit log
      const auditLog = await prisma.auditLog.create({
        data: {
          userId: moderationAction.actorId,
          action: 'content_moderated',
          entityType: 'post',
          entityId: moderationAction.entityId,
          metadata: {
            moderationActionId: moderationAction.id,
            moderationType: moderationAction.action,
            reason: moderationAction.notes,
            timestamp: moderationAction.createdAt.toISOString(),
          },
        },
      });

      testAuditLogs.push(auditLog);

      // Verify the relationship
      expect(auditLog.metadata.moderationActionId).toBe(moderationAction.id);
      expect(auditLog.metadata.moderationType).toBe('REMOVE');
      expect(auditLog.entityId).toBe(moderationAction.entityId);
      expect(auditLog.userId).toBe(moderationAction.actorId);
    });
  });
});
