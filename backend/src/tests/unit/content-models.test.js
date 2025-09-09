/**
 * Content Models Tests
 *
 * Comprehensive tests for Post, Comment, and Reaction models including
 * relationships, enum constraints, JSONB handling, and unique constraints.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prismaService from '../../services/prisma.js';
import { UserRepository } from '../../repositories/index.js';

describe('Content Models', () => {
  let prisma;
  let userRepo;
  let testUsers = [];
  let testGroups = [];
  let testPosts = [];
  let testComments = [];
  let testReactions = [];

  beforeAll(async () => {
    // Connect to database
    await prismaService.connect();
    prisma = prismaService.client;
    userRepo = new UserRepository();

    // Create test users
    const userData1 = {
      email: 'post-author@example.com',
      passwordHash: 'hashedPassword123',
      displayName: 'Post Author',
      tz: 'America/New_York',
    };
    const userData2 = {
      email: 'content-user@example.com',
      passwordHash: 'hashedPassword456',
      displayName: 'Content User',
      tz: 'America/Los_Angeles',
    };
    const userData3 = {
      email: 'reactor@example.com',
      passwordHash: 'hashedPassword789',
      displayName: 'Reactor User',
      tz: 'America/Chicago',
    };

    testUsers.push(
      await userRepo.create(userData1),
      await userRepo.create(userData2),
      await userRepo.create(userData3)
    );

    // Create test groups
    const groupData1 = {
      name: 'Content Test Group',
      description: 'Group for testing content models',
      privacy: 'PUBLIC',
      createdBy: testUsers[0].id,
    };
    const groupData2 = {
      name: 'Private Content Group',
      privacy: 'PRIVATE',
      createdBy: testUsers[1].id,
    };

    testGroups.push(
      await prisma.group.create({ data: groupData1 }),
      await prisma.group.create({ data: groupData2 })
    );
  });

  afterAll(async () => {
    // Clean up test data in reverse dependency order
    for (const reaction of testReactions) {
      try {
        await prisma.reaction.delete({ where: { id: reaction.id } });
      } catch {
        // Ignore cleanup errors
      }
    }

    for (const comment of testComments) {
      try {
        await prisma.comment.delete({ where: { id: comment.id } });
      } catch {
        // Ignore cleanup errors
      }
    }

    for (const post of testPosts) {
      try {
        await prisma.post.delete({ where: { id: post.id } });
      } catch {
        // Ignore cleanup errors
      }
    }

    for (const group of testGroups) {
      try {
        await prisma.group.delete({ where: { id: group.id } });
      } catch {
        // Ignore cleanup errors
      }
    }

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

  describe('Post Model', () => {
    it('should create a simple post with default values', async () => {
      const postData = {
        userId: testUsers[0].id,
        content: 'This is a test post content',
      };

      const post = await prisma.post.create({
        data: postData,
        include: {
          user: true,
          group: true,
          _count: {
            select: {
              comments: true,
              reactions: true,
            },
          },
        },
      });

      testPosts.push(post);

      expect(post).toHaveProperty('id');
      expect(post.userId).toBe(testUsers[0].id);
      expect(post.groupId).toBeNull();
      expect(post.type).toBe('POST');
      expect(post.content).toBe(postData.content);
      expect(post.mediaUrls).toBeNull();
      expect(post.status).toBe('ACTIVE');
      expect(post.commentCount).toBe(0);
      expect(post.reactionCount).toBe(0);
      expect(post.createdAt).toBeInstanceOf(Date);
      expect(post.updatedAt).toBeInstanceOf(Date);
      expect(post.deletedAt).toBeNull();
      expect(post.user.email).toBe(testUsers[0].email);
      expect(post.group).toBeNull();
      expect(post._count.comments).toBe(0);
      expect(post._count.reactions).toBe(0);
    });

    it('should create a testimony post in a group', async () => {
      const postData = {
        userId: testUsers[1].id,
        groupId: testGroups[0].id,
        type: 'TESTIMONY',
        content: 'This is my testimony about God\'s goodness',
        status: 'ACTIVE',
      };

      const post = await prisma.post.create({
        data: postData,
        include: {
          user: true,
          group: true,
        },
      });

      testPosts.push(post);

      expect(post.type).toBe('TESTIMONY');
      expect(post.groupId).toBe(testGroups[0].id);
      expect(post.group.name).toBe(testGroups[0].name);
      expect(post.user.email).toBe(testUsers[1].email);
    });

    it('should create a post with media URLs in JSONB format', async () => {
      const mediaUrls = [
        'https://example.com/image1.jpg',
        'https://example.com/video1.mp4',
        'https://example.com/audio1.mp3',
      ];

      const postData = {
        userId: testUsers[2].id,
        content: 'Post with media attachments',
        mediaUrls: mediaUrls,
      };

      const post = await prisma.post.create({
        data: postData,
      });

      testPosts.push(post);

      expect(post.mediaUrls).toEqual(mediaUrls);
      expect(Array.isArray(post.mediaUrls)).toBe(true);
      expect(post.mediaUrls).toHaveLength(3);
    });

    it('should create a post with pending moderation status', async () => {
      const postData = {
        userId: testUsers[0].id,
        content: 'This post needs moderation',
        status: 'PENDING_MOD',
      };

      const post = await prisma.post.create({
        data: postData,
      });

      testPosts.push(post);

      expect(post.status).toBe('PENDING_MOD');
    });

    it('should reject invalid post type enum values', async () => {
      const postData = {
        userId: testUsers[0].id,
        content: 'Invalid type post',
        type: 'INVALID_TYPE',
      };

      await expect(
        prisma.post.create({ data: postData })
      ).rejects.toThrow();
    });

    it('should reject invalid post status enum values', async () => {
      const postData = {
        userId: testUsers[0].id,
        content: 'Invalid status post',
        status: 'INVALID_STATUS',
      };

      await expect(
        prisma.post.create({ data: postData })
      ).rejects.toThrow();
    });

    it('should update post content and counters', async () => {
      const originalPost = testPosts[0];
      const updateData = {
        content: 'Updated post content',
        commentCount: 5,
        reactionCount: 10,
        status: 'ACTIVE',
      };

      const updatedPost = await prisma.post.update({
        where: { id: originalPost.id },
        data: updateData,
      });

      expect(updatedPost.content).toBe(updateData.content);
      expect(updatedPost.commentCount).toBe(5);
      expect(updatedPost.reactionCount).toBe(10);
      expect(updatedPost.updatedAt.getTime()).toBeGreaterThan(
        originalPost.updatedAt.getTime()
      );
    });

    it('should soft delete a post', async () => {
      const postToDelete = testPosts[3];
      const deletedAt = new Date();

      const softDeletedPost = await prisma.post.update({
        where: { id: postToDelete.id },
        data: { deletedAt },
      });

      expect(softDeletedPost.deletedAt).toEqual(deletedAt);
    });

    it('should find posts by user', async () => {
      const userPosts = await prisma.post.findMany({
        where: {
          userId: testUsers[0].id,
          deletedAt: null,
        },
        include: {
          user: true,
          group: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(userPosts.length).toBeGreaterThan(0);
      userPosts.forEach((post) => {
        expect(post.userId).toBe(testUsers[0].id);
        expect(post.deletedAt).toBeNull();
      });
    });

    it('should find posts by group', async () => {
      const groupPosts = await prisma.post.findMany({
        where: {
          groupId: testGroups[0].id,
          deletedAt: null,
        },
        include: {
          user: true,
          group: true,
        },
      });

      expect(groupPosts.length).toBeGreaterThan(0);
      groupPosts.forEach((post) => {
        expect(post.groupId).toBe(testGroups[0].id);
        expect(post.group.name).toBe(testGroups[0].name);
      });
    });

    it('should find posts by type', async () => {
      const testimonies = await prisma.post.findMany({
        where: {
          type: 'TESTIMONY',
          deletedAt: null,
        },
      });

      const regularPosts = await prisma.post.findMany({
        where: {
          type: 'POST',
          deletedAt: null,
        },
      });

      expect(testimonies.length).toBeGreaterThan(0);
      expect(regularPosts.length).toBeGreaterThan(0);

      testimonies.forEach((post) => {
        expect(post.type).toBe('TESTIMONY');
      });
      regularPosts.forEach((post) => {
        expect(post.type).toBe('POST');
      });
    });

    it('should find posts by status', async () => {
      const activePosts = await prisma.post.findMany({
        where: { status: 'ACTIVE' },
      });

      const pendingPosts = await prisma.post.findMany({
        where: { status: 'PENDING_MOD' },
      });

      expect(activePosts.length).toBeGreaterThan(0);
      expect(pendingPosts.length).toBeGreaterThan(0);

      activePosts.forEach((post) => {
        expect(post.status).toBe('ACTIVE');
      });
      pendingPosts.forEach((post) => {
        expect(post.status).toBe('PENDING_MOD');
      });
    });
  });

  describe('Comment Model', () => {
    let testPost;

    beforeAll(async () => {
      // Create a post for comment testing
      testPost = await prisma.post.create({
        data: {
          userId: testUsers[0].id,
          content: 'Post for comment testing',
        },
      });
      testPosts.push(testPost);
    });

    it('should create a comment on a post', async () => {
      const commentData = {
        postId: testPost.id,
        userId: testUsers[1].id,
        content: 'This is a test comment',
      };

      const comment = await prisma.comment.create({
        data: commentData,
        include: {
          post: true,
          user: true,
        },
      });

      testComments.push(comment);

      expect(comment).toHaveProperty('id');
      expect(comment.postId).toBe(testPost.id);
      expect(comment.userId).toBe(testUsers[1].id);
      expect(comment.content).toBe(commentData.content);
      expect(comment.createdAt).toBeInstanceOf(Date);
      expect(comment.updatedAt).toBeInstanceOf(Date);
      expect(comment.deletedAt).toBeNull();
      expect(comment.post.id).toBe(testPost.id);
      expect(comment.user.email).toBe(testUsers[1].email);
    });

    it('should create multiple comments on the same post', async () => {
      const commentData1 = {
        postId: testPost.id,
        userId: testUsers[2].id,
        content: 'Second comment',
      };
      const commentData2 = {
        postId: testPost.id,
        userId: testUsers[0].id,
        content: 'Third comment',
      };

      const comment1 = await prisma.comment.create({ data: commentData1 });
      const comment2 = await prisma.comment.create({ data: commentData2 });

      testComments.push(comment1, comment2);

      expect(comment1.postId).toBe(testPost.id);
      expect(comment2.postId).toBe(testPost.id);
      expect(comment1.userId).toBe(testUsers[2].id);
      expect(comment2.userId).toBe(testUsers[0].id);
    });

    it('should update comment content', async () => {
      const originalComment = testComments[0];
      const updateData = {
        content: 'Updated comment content',
      };

      const updatedComment = await prisma.comment.update({
        where: { id: originalComment.id },
        data: updateData,
      });

      expect(updatedComment.content).toBe(updateData.content);
      expect(updatedComment.updatedAt.getTime()).toBeGreaterThan(
        originalComment.updatedAt.getTime()
      );
    });

    it('should soft delete a comment', async () => {
      const commentToDelete = testComments[1];
      const deletedAt = new Date();

      const softDeletedComment = await prisma.comment.update({
        where: { id: commentToDelete.id },
        data: { deletedAt },
      });

      expect(softDeletedComment.deletedAt).toEqual(deletedAt);
    });

    it('should find comments by post', async () => {
      const postComments = await prisma.comment.findMany({
        where: {
          postId: testPost.id,
          deletedAt: null,
        },
        include: {
          user: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      expect(postComments.length).toBeGreaterThan(0);
      postComments.forEach((comment) => {
        expect(comment.postId).toBe(testPost.id);
        expect(comment.deletedAt).toBeNull();
      });
    });

    it('should find comments by user', async () => {
      const userComments = await prisma.comment.findMany({
        where: {
          userId: testUsers[1].id,
          deletedAt: null,
        },
        include: {
          post: true,
        },
      });

      expect(userComments.length).toBeGreaterThan(0);
      userComments.forEach((comment) => {
        expect(comment.userId).toBe(testUsers[1].id);
        expect(comment.deletedAt).toBeNull();
      });
    });

    it('should handle cascade delete when post is deleted', async () => {
      // Create a temporary post and comment for deletion test
      const tempPost = await prisma.post.create({
        data: {
          userId: testUsers[0].id,
          content: 'Temp post for deletion test',
        },
      });

      const tempComment = await prisma.comment.create({
        data: {
          postId: tempPost.id,
          userId: testUsers[1].id,
          content: 'Temp comment',
        },
      });

      // Verify comment exists
      expect(
        await prisma.comment.findUnique({ where: { id: tempComment.id } })
      ).toBeTruthy();

      // Delete the post
      await prisma.post.delete({ where: { id: tempPost.id } });

      // Verify comment is also deleted (cascade)
      expect(
        await prisma.comment.findUnique({ where: { id: tempComment.id } })
      ).toBeNull();
    });
  });

  describe('Reaction Model', () => {
    let testPostForReactions;

    beforeAll(async () => {
      // Create a post for reaction testing
      testPostForReactions = await prisma.post.create({
        data: {
          userId: testUsers[0].id,
          content: 'Post for reaction testing',
        },
      });
      testPosts.push(testPostForReactions);
    });

    it('should create a LIKE reaction', async () => {
      const reactionData = {
        postId: testPostForReactions.id,
        userId: testUsers[1].id,
        type: 'LIKE',
      };

      const reaction = await prisma.reaction.create({
        data: reactionData,
        include: {
          post: true,
          user: true,
        },
      });

      testReactions.push(reaction);

      expect(reaction).toHaveProperty('id');
      expect(reaction.postId).toBe(testPostForReactions.id);
      expect(reaction.userId).toBe(testUsers[1].id);
      expect(reaction.type).toBe('LIKE');
      expect(reaction.createdAt).toBeInstanceOf(Date);
      expect(reaction.post.id).toBe(testPostForReactions.id);
      expect(reaction.user.email).toBe(testUsers[1].email);
    });

    it('should create AMEN and PRAYER reactions', async () => {
      const amenReactionData = {
        postId: testPostForReactions.id,
        userId: testUsers[2].id,
        type: 'AMEN',
      };
      const prayerReactionData = {
        postId: testPostForReactions.id,
        userId: testUsers[0].id,
        type: 'PRAYER',
      };

      const amenReaction = await prisma.reaction.create({ data: amenReactionData });
      const prayerReaction = await prisma.reaction.create({ data: prayerReactionData });

      testReactions.push(amenReaction, prayerReaction);

      expect(amenReaction.type).toBe('AMEN');
      expect(prayerReaction.type).toBe('PRAYER');
    });

    it('should allow multiple reaction types from same user', async () => {
      // User can have both LIKE and AMEN reactions on same post
      const secondReactionData = {
        postId: testPostForReactions.id,
        userId: testUsers[1].id,
        type: 'AMEN',
      };

      const secondReaction = await prisma.reaction.create({ 
        data: secondReactionData 
      });

      testReactions.push(secondReaction);

      expect(secondReaction.userId).toBe(testUsers[1].id);
      expect(secondReaction.type).toBe('AMEN');
    });

    it('should enforce unique constraint (postId, userId, type)', async () => {
      // Try to create duplicate LIKE reaction from same user
      const duplicateReactionData = {
        postId: testPostForReactions.id,
        userId: testUsers[1].id,
        type: 'LIKE', // Same as first reaction
      };

      await expect(
        prisma.reaction.create({ data: duplicateReactionData })
      ).rejects.toThrow();
    });

    it('should reject invalid reaction type enum values', async () => {
      const invalidReactionData = {
        postId: testPostForReactions.id,
        userId: testUsers[2].id,
        type: 'INVALID_REACTION',
      };

      await expect(
        prisma.reaction.create({ data: invalidReactionData })
      ).rejects.toThrow();
    });

    it('should find reactions by post', async () => {
      const postReactions = await prisma.reaction.findMany({
        where: { postId: testPostForReactions.id },
        include: {
          user: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      expect(postReactions.length).toBeGreaterThan(0);
      postReactions.forEach((reaction) => {
        expect(reaction.postId).toBe(testPostForReactions.id);
        expect(['LIKE', 'AMEN', 'PRAYER']).toContain(reaction.type);
      });
    });

    it('should find reactions by user', async () => {
      const userReactions = await prisma.reaction.findMany({
        where: { userId: testUsers[1].id },
        include: {
          post: true,
        },
      });

      expect(userReactions.length).toBeGreaterThan(0);
      userReactions.forEach((reaction) => {
        expect(reaction.userId).toBe(testUsers[1].id);
      });
    });

    it('should find reactions by type', async () => {
      const likeReactions = await prisma.reaction.findMany({
        where: { type: 'LIKE' },
      });
      const amenReactions = await prisma.reaction.findMany({
        where: { type: 'AMEN' },
      });
      const prayerReactions = await prisma.reaction.findMany({
        where: { type: 'PRAYER' },
      });

      expect(likeReactions.length).toBeGreaterThan(0);
      expect(amenReactions.length).toBeGreaterThan(0);
      expect(prayerReactions.length).toBeGreaterThan(0);

      likeReactions.forEach((reaction) => {
        expect(reaction.type).toBe('LIKE');
      });
      amenReactions.forEach((reaction) => {
        expect(reaction.type).toBe('AMEN');
      });
      prayerReactions.forEach((reaction) => {
        expect(reaction.type).toBe('PRAYER');
      });
    });

    it('should count reactions by type for a post', async () => {
      const reactionCounts = await prisma.reaction.groupBy({
        by: ['type'],
        where: { postId: testPostForReactions.id },
        _count: {
          type: true,
        },
      });

      expect(reactionCounts).toBeInstanceOf(Array);
      expect(reactionCounts.length).toBeGreaterThan(0);

      reactionCounts.forEach((count) => {
        expect(['LIKE', 'AMEN', 'PRAYER']).toContain(count.type);
        expect(count._count.type).toBeGreaterThan(0);
      });
    });

    it('should handle cascade delete when post is deleted', async () => {
      // Create a temporary post and reaction for deletion test
      const tempPost = await prisma.post.create({
        data: {
          userId: testUsers[0].id,
          content: 'Temp post for reaction deletion test',
        },
      });

      const tempReaction = await prisma.reaction.create({
        data: {
          postId: tempPost.id,
          userId: testUsers[1].id,
          type: 'LIKE',
        },
      });

      // Verify reaction exists
      expect(
        await prisma.reaction.findUnique({ where: { id: tempReaction.id } })
      ).toBeTruthy();

      // Delete the post
      await prisma.post.delete({ where: { id: tempPost.id } });

      // Verify reaction is also deleted (cascade)
      expect(
        await prisma.reaction.findUnique({ where: { id: tempReaction.id } })
      ).toBeNull();
    });

    it('should remove a specific reaction', async () => {
      const reactionToRemove = testReactions[0];

      await prisma.reaction.delete({
        where: { id: reactionToRemove.id },
      });

      // Verify reaction is removed
      expect(
        await prisma.reaction.findUnique({ where: { id: reactionToRemove.id } })
      ).toBeNull();

      // Remove from our tracking array
      testReactions.splice(0, 1);
    });
  });

  describe('Content Model Relationships', () => {
    it('should include full post details with counts', async () => {
      const postWithDetails = await prisma.post.findFirst({
        where: { deletedAt: null },
        include: {
          user: true,
          group: true,
          comments: {
            where: { deletedAt: null },
            include: {
              user: true,
            },
            orderBy: { createdAt: 'asc' },
          },
          reactions: {
            include: {
              user: true,
            },
          },
          _count: {
            select: {
              comments: true,
              reactions: true,
            },
          },
        },
      });

      expect(postWithDetails).toBeTruthy();
      expect(postWithDetails.user).toBeTruthy();
      expect(postWithDetails.comments).toBeInstanceOf(Array);
      expect(postWithDetails.reactions).toBeInstanceOf(Array);
      expect(postWithDetails._count).toHaveProperty('comments');
      expect(postWithDetails._count).toHaveProperty('reactions');
    });

    it('should query user with their content', async () => {
      const userWithContent = await prisma.user.findUnique({
        where: { id: testUsers[0].id },
        include: {
          posts: {
            where: { deletedAt: null },
            include: {
              group: true,
            },
          },
          comments: {
            where: { deletedAt: null },
            include: {
              post: true,
            },
          },
          reactions: {
            include: {
              post: true,
            },
          },
        },
      });

      expect(userWithContent.posts).toBeInstanceOf(Array);
      expect(userWithContent.comments).toBeInstanceOf(Array);
      expect(userWithContent.reactions).toBeInstanceOf(Array);

      userWithContent.posts.forEach((post) => {
        expect(post.userId).toBe(testUsers[0].id);
        expect(post.deletedAt).toBeNull();
      });
    });

    it('should query group with posts and engagement', async () => {
      const groupWithContent = await prisma.group.findFirst({
        where: { id: testGroups[0].id },
        include: {
          posts: {
            where: { deletedAt: null },
            include: {
              user: true,
              _count: {
                select: {
                  comments: true,
                  reactions: true,
                },
              },
            },
          },
          _count: {
            select: {
              members: true,
              posts: true,
            },
          },
        },
      });

      expect(groupWithContent).toBeTruthy();
      expect(groupWithContent.posts).toBeInstanceOf(Array);
      expect(groupWithContent._count.posts).toBeGreaterThanOrEqual(0);
      expect(groupWithContent._count.members).toBeGreaterThanOrEqual(0);
    });
  });
});
