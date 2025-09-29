/**
 * Database Constraint Tests
 *
 * Tests for foreign key constraints, check constraints, and unique constraints
 * including parallel operations and cascade behaviors.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prismaService from '../../services/prisma.js';
import { UserRepository } from '../../repositories/index.js';

describe('Database Constraints', () => {
  let prisma;
  let userRepo;
  let testUsers = [];
  let testGroups = [];
  let testPosts = [];

  beforeAll(async () => {
    // Connect to database
    await prismaService.connect();
    prisma = prismaService.client;
    userRepo = new UserRepository();

    // Create test users
    const userData1 = {
      email: 'constraint-user1@example.com',
      passwordHash: 'hashedPassword123',
      displayName: 'Constraint User 1',
      tz: 'America/New_York',
    };
    const userData2 = {
      email: 'constraint-user2@example.com',
      passwordHash: 'hashedPassword456',
      displayName: 'Constraint User 2',
      tz: 'America/Los_Angeles',
    };

    testUsers.push(
      await userRepo.create(userData1),
      await userRepo.create(userData2)
    );

    // Create test group
    const group = await prisma.group.create({
      data: {
        name: 'Constraint Test Group',
        description: 'Group for testing constraints',
        privacy: 'PUBLIC',
        createdBy: testUsers[0].id,
      },
    });
    testGroups.push(group);

    // Create test post
    const post = await prisma.post.create({
      data: {
        userId: testUsers[0].id,
        groupId: group.id,
        type: 'POST',
        content: 'Test post for constraint testing',
        status: 'ACTIVE',
      },
    });
    testPosts.push(post);
  });

  afterAll(async () => {
    // Clean up test data
    if (testPosts.length > 0) {
      await prisma.post.deleteMany({
        where: { id: { in: testPosts.map(p => p.id) } },
      });
    }
    if (testGroups.length > 0) {
      await prisma.group.deleteMany({
        where: { id: { in: testGroups.map(g => g.id) } },
      });
    }
    if (testUsers.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: testUsers.map(u => u.id) } },
      });
    }

    await prismaService.disconnect();
  });

  describe('Check Constraints', () => {
    it('should enforce XpEvent.amount >= 0', async () => {
      // Should succeed with positive amount
      const validXpEvent = await prisma.xpEvent.create({
        data: {
          userId: testUsers[0].id,
          fruit: 'LOVE',
          amount: 10,
          reason: 'Helped someone',
        },
      });
      expect(validXpEvent.amount).toBe(10);

      // Should succeed with zero amount
      const zeroXpEvent = await prisma.xpEvent.create({
        data: {
          userId: testUsers[0].id,
          fruit: 'JOY',
          amount: 0,
          reason: 'No points awarded',
        },
      });
      expect(zeroXpEvent.amount).toBe(0);

      // Should fail with negative amount
      await expect(
        prisma.xpEvent.create({
          data: {
            userId: testUsers[0].id,
            fruit: 'PEACE',
            amount: -5,
            reason: 'Should fail',
          },
        })
      ).rejects.toThrow();

      // Clean up
      await prisma.xpEvent.deleteMany({
        where: { id: { in: [validXpEvent.id, zeroXpEvent.id] } },
      });
    });

    it('should enforce Event.endsAt > startsAt', async () => {
      const startsAt = new Date('2024-01-01T10:00:00Z');
      const validEndsAt = new Date('2024-01-01T12:00:00Z');
      const invalidEndsAt = new Date('2024-01-01T08:00:00Z');

      // Should succeed when endsAt > startsAt
      const validEvent = await prisma.event.create({
        data: {
          title: 'Valid Event',
          startsAt,
          endsAt: validEndsAt,
          visibility: 'PUBLIC',
          createdBy: testUsers[0].id,
        },
      });
      expect(validEvent.endsAt.getTime()).toBeGreaterThan(validEvent.startsAt.getTime());

      // Should fail when endsAt <= startsAt
      await expect(
        prisma.event.create({
          data: {
            title: 'Invalid Event',
            startsAt,
            endsAt: invalidEndsAt,
            visibility: 'PUBLIC',
            createdBy: testUsers[0].id,
          },
        })
      ).rejects.toThrow();

      // Should fail when endsAt === startsAt
      await expect(
        prisma.event.create({
          data: {
            title: 'Same Time Event',
            startsAt,
            endsAt: startsAt,
            visibility: 'PUBLIC',
            createdBy: testUsers[0].id,
          },
        })
      ).rejects.toThrow();

      // Clean up
      await prisma.event.delete({ where: { id: validEvent.id } });
    });
  });

  describe('Unique Constraints', () => {
    it('should enforce unique reactions per post+user+type', async () => {
      // Create first reaction
      const reaction1 = await prisma.reaction.create({
        data: {
          postId: testPosts[0].id,
          userId: testUsers[0].id,
          type: 'LIKE',
        },
      });

      // Should fail to create duplicate reaction with same post+user+type
      await expect(
        prisma.reaction.create({
          data: {
            postId: testPosts[0].id,
            userId: testUsers[0].id,
            type: 'LIKE',
          },
        })
      ).rejects.toThrow();

      // Should succeed with different type
      const reaction2 = await prisma.reaction.create({
        data: {
          postId: testPosts[0].id,
          userId: testUsers[0].id,
          type: 'AMEN',
        },
      });

      // Should succeed with different user
      const reaction3 = await prisma.reaction.create({
        data: {
          postId: testPosts[0].id,
          userId: testUsers[1].id,
          type: 'LIKE',
        },
      });

      expect(reaction1.type).toBe('LIKE');
      expect(reaction2.type).toBe('AMEN');
      expect(reaction3.userId).toBe(testUsers[1].id);

      // Clean up
      await prisma.reaction.deleteMany({
        where: { id: { in: [reaction1.id, reaction2.id, reaction3.id] } },
      });
    });

    it('should handle parallel reaction inserts correctly (only 1 row)', async () => {
      // Attempt to create the same reaction simultaneously
      const reactionData = {
        postId: testPosts[0].id,
        userId: testUsers[0].id,
        type: 'PRAYER',
      };

      // Use Promise.allSettled to handle expected failures
      const results = await Promise.allSettled([
        prisma.reaction.create({ data: reactionData }),
        prisma.reaction.create({ data: reactionData }),
        prisma.reaction.create({ data: reactionData }),
      ]);

      // Only one should succeed
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      expect(successful.length).toBe(1);
      expect(failed.length).toBe(2);

      // Verify only one reaction exists
      const reactions = await prisma.reaction.findMany({
        where: reactionData,
      });
      expect(reactions.length).toBe(1);

      // Clean up
      if (successful.length > 0) {
        await prisma.reaction.delete({ where: { id: successful[0].value.id } });
      }
    });
  });

  describe('Foreign Key Constraints', () => {
    it('should null Prayer.linkedPostId when post is deleted (SET NULL)', async () => {
      // Create a post for linking
      const linkedPost = await prisma.post.create({
        data: {
          userId: testUsers[0].id,
          type: 'POST',
          content: 'Post to be linked to prayer',
          status: 'ACTIVE',
        },
      });

      // Create prayer linked to the post
      const prayer = await prisma.prayer.create({
        data: {
          userId: testUsers[0].id,
          linkedPostId: linkedPost.id,
          title: 'Test Prayer',
          content: 'Prayer linked to post',
          status: 'OPEN',
        },
      });

      expect(prayer.linkedPostId).toBe(linkedPost.id);

      // Delete the linked post
      await prisma.post.delete({ where: { id: linkedPost.id } });

      // Check that prayer.linkedPostId is now null
      const updatedPrayer = await prisma.prayer.findUnique({
        where: { id: prayer.id },
      });
      expect(updatedPrayer.linkedPostId).toBeNull();

      // Clean up
      await prisma.prayer.delete({ where: { id: prayer.id } });
    });

    it('should cascade delete children when parent is deleted', async () => {
      // Create a post with comments and reactions
      const parentPost = await prisma.post.create({
        data: {
          userId: testUsers[0].id,
          type: 'POST',
          content: 'Post to test cascade delete',
          status: 'ACTIVE',
        },
      });

      // Create comments
      const comment1 = await prisma.comment.create({
        data: {
          postId: parentPost.id,
          userId: testUsers[0].id,
          content: 'First comment',
        },
      });

      const comment2 = await prisma.comment.create({
        data: {
          postId: parentPost.id,
          userId: testUsers[1].id,
          content: 'Second comment',
        },
      });

      // Create reactions
      const reaction1 = await prisma.reaction.create({
        data: {
          postId: parentPost.id,
          userId: testUsers[0].id,
          type: 'LIKE',
        },
      });

      const reaction2 = await prisma.reaction.create({
        data: {
          postId: parentPost.id,
          userId: testUsers[1].id,
          type: 'AMEN',
        },
      });

      // Verify children exist
      expect(await prisma.comment.count({ where: { postId: parentPost.id } })).toBe(2);
      expect(await prisma.reaction.count({ where: { postId: parentPost.id } })).toBe(2);

      // Delete the parent post
      await prisma.post.delete({ where: { id: parentPost.id } });

      // Verify children are cascade deleted
      expect(await prisma.comment.count({ where: { postId: parentPost.id } })).toBe(0);
      expect(await prisma.reaction.count({ where: { postId: parentPost.id } })).toBe(0);

      // Verify specific children no longer exist
      expect(await prisma.comment.findUnique({ where: { id: comment1.id } })).toBeNull();
      expect(await prisma.comment.findUnique({ where: { id: comment2.id } })).toBeNull();
      expect(await prisma.reaction.findUnique({ where: { id: reaction1.id } })).toBeNull();
      expect(await prisma.reaction.findUnique({ where: { id: reaction2.id } })).toBeNull();
    });

    it('should restrict deletion when RESTRICT constraint is violated', async () => {
      // Test that user cannot be deleted when they have posts (due to RESTRICT)
      const userWithPosts = testUsers[0];
      
      // Verify user has posts
      const postCount = await prisma.post.count({ where: { userId: userWithPosts.id } });
      expect(postCount).toBeGreaterThan(0);

      // Attempt to delete user should fail due to RESTRICT constraint
      await expect(
        prisma.user.delete({ where: { id: userWithPosts.id } })
      ).rejects.toThrow();

      // User should still exist
      const user = await prisma.user.findUnique({ where: { id: userWithPosts.id } });
      expect(user).not.toBeNull();
    });
  });
});
