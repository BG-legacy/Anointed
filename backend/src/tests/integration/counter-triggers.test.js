/**
 * Counter Triggers Integration Tests
 * Tests for database triggers that maintain derived counter fields
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import prismaService from '../../services/prisma.js';

describe('Counter Triggers Integration Tests', () => {
  let prisma;
  let testUser1, testUser2, testPost, testPrayer, testGroup;

  beforeAll(async () => {
    // Connect to database
    await prismaService.connect();
    prisma = prismaService.client;
    // Create test users
    testUser1 = await prisma.user.create({
      data: {
        email: 'trigger-user1@test.com',
        passwordHash: 'hashedpassword123',
        displayName: 'Trigger Test User 1',
      },
    });

    testUser2 = await prisma.user.create({
      data: {
        email: 'trigger-user2@test.com',
        passwordHash: 'hashedpassword456',
        displayName: 'Trigger Test User 2',
      },
    });

    // Create test group
    testGroup = await prisma.group.create({
      data: {
        name: 'Trigger Test Group',
        description: 'A group for testing counter triggers',
        privacy: 'PUBLIC',
        createdBy: testUser1.id,
      },
    });

    // Create test post
    testPost = await prisma.post.create({
      data: {
        userId: testUser1.id,
        groupId: testGroup.id,
        type: 'POST',
        content: 'This is a test post for counter triggers',
        status: 'ACTIVE',
      },
    });

    // Create test prayer
    testPrayer = await prisma.prayer.create({
      data: {
        userId: testUser1.id,
        groupId: testGroup.id,
        title: 'Test Prayer for Counter Triggers',
        content: 'Please pray for this test to pass',
        status: 'OPEN',
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.comment.deleteMany({
      where: { userId: { in: [testUser1.id, testUser2.id] } },
    });
    await prisma.reaction.deleteMany({
      where: { userId: { in: [testUser1.id, testUser2.id] } },
    });
    await prisma.prayerCommit.deleteMany({
      where: { userId: { in: [testUser1.id, testUser2.id] } },
    });
    await prisma.post.deleteMany({
      where: { userId: { in: [testUser1.id, testUser2.id] } },
    });
    await prisma.prayer.deleteMany({
      where: { userId: { in: [testUser1.id, testUser2.id] } },
    });
    await prisma.group.deleteMany({
      where: { createdBy: { in: [testUser1.id, testUser2.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [testUser1.id, testUser2.id] } },
    });

    await prismaService.disconnect();
  });

  describe('Post Comment Counter Trigger', () => {
    beforeEach(async () => {
      // Reset post counters
      await prisma.post.update({
        where: { id: testPost.id },
        data: { commentCount: 0 },
      });
      // Delete any existing comments
      await prisma.comment.deleteMany({
        where: { postId: testPost.id },
      });
    });

    test('should increment comment_count when a comment is inserted', async () => {
      // Verify initial count
      let post = await prisma.post.findUnique({
        where: { id: testPost.id },
      });
      expect(post.commentCount).toBe(0);

      // Insert a comment
      await prisma.comment.create({
        data: {
          postId: testPost.id,
          userId: testUser1.id,
          content: 'First test comment',
        },
      });

      // Verify count incremented
      post = await prisma.post.findUnique({
        where: { id: testPost.id },
      });
      expect(post.commentCount).toBe(1);

      // Insert another comment
      await prisma.comment.create({
        data: {
          postId: testPost.id,
          userId: testUser2.id,
          content: 'Second test comment',
        },
      });

      // Verify count incremented again
      post = await prisma.post.findUnique({
        where: { id: testPost.id },
      });
      expect(post.commentCount).toBe(2);
    });

    test('should decrement comment_count when a comment is deleted', async () => {
      // Create comments first
      const comment1 = await prisma.comment.create({
        data: {
          postId: testPost.id,
          userId: testUser1.id,
          content: 'Comment to be deleted',
        },
      });

      await prisma.comment.create({
        data: {
          postId: testPost.id,
          userId: testUser2.id,
          content: 'Comment to stay',
        },
      });

      // Verify initial count
      let post = await prisma.post.findUnique({
        where: { id: testPost.id },
      });
      expect(post.commentCount).toBe(2);

      // Delete a comment
      await prisma.comment.delete({
        where: { id: comment1.id },
      });

      // Verify count decremented
      post = await prisma.post.findUnique({
        where: { id: testPost.id },
      });
      expect(post.commentCount).toBe(1);
    });

    test('should not decrement below zero', async () => {
      // Manually set count to 0
      await prisma.post.update({
        where: { id: testPost.id },
        data: { commentCount: 0 },
      });

      // Create and delete a comment
      const comment = await prisma.comment.create({
        data: {
          postId: testPost.id,
          userId: testUser1.id,
          content: 'Comment to test boundary',
        },
      });

      await prisma.comment.delete({
        where: { id: comment.id },
      });

      // Verify count is still 0
      const post = await prisma.post.findUnique({
        where: { id: testPost.id },
      });
      expect(post.commentCount).toBeGreaterThanOrEqual(0);
    });

    test('should handle soft-deleted comments correctly', async () => {
      // Create a comment
      const comment = await prisma.comment.create({
        data: {
          postId: testPost.id,
          userId: testUser1.id,
          content: 'Comment to be soft-deleted',
        },
      });

      // Verify count is 1
      let post = await prisma.post.findUnique({
        where: { id: testPost.id },
      });
      expect(post.commentCount).toBe(1);

      // Soft delete the comment
      await prisma.comment.update({
        where: { id: comment.id },
        data: { deletedAt: new Date() },
      });

      // Verify count decremented to 0
      post = await prisma.post.findUnique({
        where: { id: testPost.id },
      });
      expect(post.commentCount).toBe(0);

      // Restore the comment (set deletedAt back to null)
      await prisma.comment.update({
        where: { id: comment.id },
        data: { deletedAt: null },
      });

      // Verify count incremented back to 1
      post = await prisma.post.findUnique({
        where: { id: testPost.id },
      });
      expect(post.commentCount).toBe(1);
    });

    test('should not increment when inserting a soft-deleted comment', async () => {
      // Create a comment that is already soft-deleted
      await prisma.comment.create({
        data: {
          postId: testPost.id,
          userId: testUser1.id,
          content: 'Already soft-deleted comment',
          deletedAt: new Date(),
        },
      });

      // Verify count is still 0
      const post = await prisma.post.findUnique({
        where: { id: testPost.id },
      });
      expect(post.commentCount).toBe(0);
    });
  });

  describe('Post Reaction Counter Trigger', () => {
    beforeEach(async () => {
      // Reset post counters
      await prisma.post.update({
        where: { id: testPost.id },
        data: { reactionCount: 0 },
      });
      // Delete any existing reactions
      await prisma.reaction.deleteMany({
        where: { postId: testPost.id },
      });
    });

    test('should increment reaction_count when a reaction is inserted', async () => {
      // Verify initial count
      let post = await prisma.post.findUnique({
        where: { id: testPost.id },
      });
      expect(post.reactionCount).toBe(0);

      // Insert a reaction
      await prisma.reaction.create({
        data: {
          postId: testPost.id,
          userId: testUser1.id,
          type: 'LIKE',
        },
      });

      // Verify count incremented
      post = await prisma.post.findUnique({
        where: { id: testPost.id },
      });
      expect(post.reactionCount).toBe(1);

      // Insert another reaction (different type from same user)
      await prisma.reaction.create({
        data: {
          postId: testPost.id,
          userId: testUser1.id,
          type: 'AMEN',
        },
      });

      // Verify count incremented again
      post = await prisma.post.findUnique({
        where: { id: testPost.id },
      });
      expect(post.reactionCount).toBe(2);
    });

    test('should decrement reaction_count when a reaction is deleted', async () => {
      // Create reactions first
      const reaction1 = await prisma.reaction.create({
        data: {
          postId: testPost.id,
          userId: testUser1.id,
          type: 'LIKE',
        },
      });

      await prisma.reaction.create({
        data: {
          postId: testPost.id,
          userId: testUser2.id,
          type: 'PRAYER',
        },
      });

      // Verify initial count
      let post = await prisma.post.findUnique({
        where: { id: testPost.id },
      });
      expect(post.reactionCount).toBe(2);

      // Delete a reaction
      await prisma.reaction.delete({
        where: { id: reaction1.id },
      });

      // Verify count decremented
      post = await prisma.post.findUnique({
        where: { id: testPost.id },
      });
      expect(post.reactionCount).toBe(1);
    });

    test('should not decrement below zero', async () => {
      // Manually set count to 0
      await prisma.post.update({
        where: { id: testPost.id },
        data: { reactionCount: 0 },
      });

      // Create and delete a reaction
      const reaction = await prisma.reaction.create({
        data: {
          postId: testPost.id,
          userId: testUser1.id,
          type: 'AMEN',
        },
      });

      await prisma.reaction.delete({
        where: { id: reaction.id },
      });

      // Verify count is still 0
      const post = await prisma.post.findUnique({
        where: { id: testPost.id },
      });
      expect(post.reactionCount).toBeGreaterThanOrEqual(0);
    });

    test('should handle multiple reaction types correctly', async () => {
      // Create different types of reactions
      await prisma.reaction.create({
        data: {
          postId: testPost.id,
          userId: testUser1.id,
          type: 'LIKE',
        },
      });

      await prisma.reaction.create({
        data: {
          postId: testPost.id,
          userId: testUser1.id,
          type: 'AMEN',
        },
      });

      await prisma.reaction.create({
        data: {
          postId: testPost.id,
          userId: testUser2.id,
          type: 'PRAYER',
        },
      });

      // Verify count is 3
      const post = await prisma.post.findUnique({
        where: { id: testPost.id },
      });
      expect(post.reactionCount).toBe(3);
    });
  });

  describe('Prayer Commit Counter Trigger', () => {
    beforeEach(async () => {
      // Reset prayer counters
      await prisma.prayer.update({
        where: { id: testPrayer.id },
        data: { commitCount: 0 },
      });
      // Delete any existing prayer commits
      await prisma.prayerCommit.deleteMany({
        where: { prayerId: testPrayer.id },
      });
    });

    test('should increment commit_count when a prayer commit is inserted', async () => {
      // Verify initial count
      let prayer = await prisma.prayer.findUnique({
        where: { id: testPrayer.id },
      });
      expect(prayer.commitCount).toBe(0);

      // Insert a prayer commit
      await prisma.prayerCommit.create({
        data: {
          prayerId: testPrayer.id,
          userId: testUser1.id,
          message: 'Praying for you!',
        },
      });

      // Verify count incremented
      prayer = await prisma.prayer.findUnique({
        where: { id: testPrayer.id },
      });
      expect(prayer.commitCount).toBe(1);

      // Insert another prayer commit
      await prisma.prayerCommit.create({
        data: {
          prayerId: testPrayer.id,
          userId: testUser2.id,
          message: 'Praying as well!',
        },
      });

      // Verify count incremented again
      prayer = await prisma.prayer.findUnique({
        where: { id: testPrayer.id },
      });
      expect(prayer.commitCount).toBe(2);
    });

    test('should decrement commit_count when a prayer commit is deleted', async () => {
      // Create prayer commits first
      const commit1 = await prisma.prayerCommit.create({
        data: {
          prayerId: testPrayer.id,
          userId: testUser1.id,
          message: 'Commit to be deleted',
        },
      });

      await prisma.prayerCommit.create({
        data: {
          prayerId: testPrayer.id,
          userId: testUser2.id,
          message: 'Commit to stay',
        },
      });

      // Verify initial count
      let prayer = await prisma.prayer.findUnique({
        where: { id: testPrayer.id },
      });
      expect(prayer.commitCount).toBe(2);

      // Delete a prayer commit
      await prisma.prayerCommit.delete({
        where: { id: commit1.id },
      });

      // Verify count decremented
      prayer = await prisma.prayer.findUnique({
        where: { id: testPrayer.id },
      });
      expect(prayer.commitCount).toBe(1);
    });

    test('should not decrement below zero', async () => {
      // Manually set count to 0
      await prisma.prayer.update({
        where: { id: testPrayer.id },
        data: { commitCount: 0 },
      });

      // Create and delete a prayer commit
      const commit = await prisma.prayerCommit.create({
        data: {
          prayerId: testPrayer.id,
          userId: testUser1.id,
          message: 'Commit to test boundary',
        },
      });

      await prisma.prayerCommit.delete({
        where: { id: commit.id },
      });

      // Verify count is still 0
      const prayer = await prisma.prayer.findUnique({
        where: { id: testPrayer.id },
      });
      expect(prayer.commitCount).toBeGreaterThanOrEqual(0);
    });

    test('should handle multiple commits from different users', async () => {
      // Create multiple commits
      await prisma.prayerCommit.create({
        data: {
          prayerId: testPrayer.id,
          userId: testUser1.id,
          message: 'First prayer commitment',
        },
      });

      await prisma.prayerCommit.create({
        data: {
          prayerId: testPrayer.id,
          userId: testUser2.id,
          message: 'Second prayer commitment',
        },
      });

      await prisma.prayerCommit.create({
        data: {
          prayerId: testPrayer.id,
          userId: testUser1.id,
          message: 'Another commitment from user 1',
        },
      });

      // Verify count is 3
      const prayer = await prisma.prayer.findUnique({
        where: { id: testPrayer.id },
      });
      expect(prayer.commitCount).toBe(3);
    });
  });

  describe('Concurrent Operations', () => {
    beforeEach(async () => {
      // Reset post counters
      await prisma.post.update({
        where: { id: testPost.id },
        data: { commentCount: 0, reactionCount: 0 },
      });
      // Delete any existing comments and reactions
      await prisma.comment.deleteMany({
        where: { postId: testPost.id },
      });
      await prisma.reaction.deleteMany({
        where: { postId: testPost.id },
      });
    });

    test('should handle multiple concurrent comment insertions correctly', async () => {
      // Create multiple comments concurrently
      const commentPromises = Array.from({ length: 10 }, (_, i) =>
        prisma.comment.create({
          data: {
            postId: testPost.id,
            userId: i % 2 === 0 ? testUser1.id : testUser2.id,
            content: `Concurrent comment ${i}`,
          },
        })
      );

      await Promise.all(commentPromises);

      // Verify count is correct
      const post = await prisma.post.findUnique({
        where: { id: testPost.id },
      });
      expect(post.commentCount).toBe(10);
    });

    test('should handle concurrent mixed operations correctly', async () => {
      // Create some initial data
      const comment1 = await prisma.comment.create({
        data: {
          postId: testPost.id,
          userId: testUser1.id,
          content: 'Comment to be deleted',
        },
      });

      const reaction1 = await prisma.reaction.create({
        data: {
          postId: testPost.id,
          userId: testUser1.id,
          type: 'LIKE',
        },
      });

      // Perform mixed operations concurrently
      await Promise.all([
        // Add comments
        prisma.comment.create({
          data: {
            postId: testPost.id,
            userId: testUser2.id,
            content: 'New comment 1',
          },
        }),
        prisma.comment.create({
          data: {
            postId: testPost.id,
            userId: testUser1.id,
            content: 'New comment 2',
          },
        }),
        // Delete a comment
        prisma.comment.delete({
          where: { id: comment1.id },
        }),
        // Add reactions
        prisma.reaction.create({
          data: {
            postId: testPost.id,
            userId: testUser2.id,
            type: 'AMEN',
          },
        }),
        // Delete a reaction
        prisma.reaction.delete({
          where: { id: reaction1.id },
        }),
      ]);

      // Verify final counts
      const post = await prisma.post.findUnique({
        where: { id: testPost.id },
      });
      // Should have 2 comments (1 initial - 1 deleted + 2 added = 2)
      expect(post.commentCount).toBe(2);
      // Should have 1 reaction (1 initial - 1 deleted + 1 added = 1)
      expect(post.reactionCount).toBe(1);
    });
  });
});

