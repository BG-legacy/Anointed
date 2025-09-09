/**
 * Social Content Flow Integration Tests
 *
 * End-to-end integration tests for the complete social and content workflow:
 * User creation → Group creation → Group membership → Post creation → Comments → Reactions
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prismaService from '../../services/prisma.js';
import { UserRepository } from '../../repositories/index.js';

describe('Social Content Flow Integration', () => {
  let prisma;
  let userRepo;
  let testData = {
    users: [],
    groups: [],
    posts: [],
    comments: [],
    reactions: [],
    memberships: [],
  };

  beforeAll(async () => {
    // Connect to database
    await prismaService.connect();
    prisma = prismaService.client;
    userRepo = new UserRepository();
  });

  afterAll(async () => {
    // Clean up test data in reverse dependency order
    const cleanup = async (collection, deleteMethod) => {
      for (const item of collection) {
        try {
          await deleteMethod(item);
        } catch {
          // Ignore cleanup errors
        }
      }
    };

    await cleanup(testData.reactions, (r) => prisma.reaction.delete({ where: { id: r.id } }));
    await cleanup(testData.comments, (c) => prisma.comment.delete({ where: { id: c.id } }));
    await cleanup(testData.posts, (p) => prisma.post.delete({ where: { id: p.id } }));
    await cleanup(testData.memberships, (m) => 
      prisma.groupMember.delete({ 
        where: { 
          groupId_userId: { 
            groupId: m.groupId, 
            userId: m.userId 
          } 
        } 
      })
    );
    await cleanup(testData.groups, (g) => prisma.group.delete({ where: { id: g.id } }));
    await cleanup(testData.users, (u) => userRepo.hardDelete(u.id));

    // Disconnect from database
    await prismaService.disconnect();
  });

  describe('Complete Social Content Workflow', () => {
    it('should support the full user journey', async () => {
      // Step 1: Create users
      const userDatasets = [
        {
          email: 'community-leader@anointed.com',
          passwordHash: 'hashedPassword123',
          displayName: 'Community Leader',
          tz: 'America/New_York',
        },
        {
          email: 'active-member@anointed.com',
          passwordHash: 'hashedPassword456',
          displayName: 'Active Member',
          tz: 'America/Los_Angeles',
        },
        {
          email: 'testimony-giver@anointed.com',
          passwordHash: 'hashedPassword789',
          displayName: 'Testimony Giver',
          tz: 'America/Chicago',
        },
        {
          email: 'prayer-warrior@anointed.com',
          passwordHash: 'hashedPassword000',
          displayName: 'Prayer Warrior',
          tz: 'America/Denver',
        },
      ];

      for (const userData of userDatasets) {
        const user = await userRepo.create(userData);
        testData.users.push(user);
      }

      expect(testData.users).toHaveLength(4);
      console.log('✓ Created 4 users');

      // Step 2: Community leader creates a prayer group
      const prayerGroupData = {
        name: 'Daily Prayer Circle',
        description: 'A community for daily prayer and spiritual encouragement',
        privacy: 'PUBLIC',
        createdBy: testData.users[0].id,
      };

      const prayerGroup = await prisma.group.create({
        data: prayerGroupData,
        include: {
          creator: true,
          _count: {
            select: { members: true },
          },
        },
      });

      testData.groups.push(prayerGroup);
      expect(prayerGroup.name).toBe(prayerGroupData.name);
      expect(prayerGroup.creator.email).toBe(testData.users[0].email);
      expect(prayerGroup._count.members).toBe(0);
      console.log('✓ Created prayer group');

      // Step 3: Create a testimony group (private)
      const testimonyGroupData = {
        name: 'Testimony Sharing',
        description: 'Share your testimonies of God\'s goodness',
        privacy: 'PRIVATE',
        createdBy: testData.users[1].id,
      };

      const testimonyGroup = await prisma.group.create({
        data: testimonyGroupData,
      });

      testData.groups.push(testimonyGroup);
      expect(testimonyGroup.privacy).toBe('PRIVATE');
      console.log('✓ Created testimony group');

      // Step 4: Users join the prayer group
      const membershipData = [
        {
          groupId: prayerGroup.id,
          userId: testData.users[1].id,
          role: 'MODERATOR',
        },
        {
          groupId: prayerGroup.id,
          userId: testData.users[2].id,
          role: 'MEMBER',
        },
        {
          groupId: prayerGroup.id,
          userId: testData.users[3].id,
          role: 'MEMBER',
        },
      ];

      for (const memberData of membershipData) {
        const membership = await prisma.groupMember.create({
          data: memberData,
          include: {
            user: true,
            group: true,
          },
        });
        testData.memberships.push(membership);
      }

      expect(testData.memberships).toHaveLength(3);
      console.log('✓ Added 3 members to prayer group');

      // Step 5: Verify group membership counts
      const groupWithMembers = await prisma.group.findUnique({
        where: { id: prayerGroup.id },
        include: {
          members: {
            include: {
              user: true,
            },
          },
          _count: {
            select: { members: true },
          },
        },
      });

      expect(groupWithMembers._count.members).toBe(3);
      expect(groupWithMembers.members).toHaveLength(3);
      console.log('✓ Verified group membership');

      // Step 6: Community leader posts a prayer request
      const prayerRequestData = {
        userId: testData.users[0].id,
        groupId: prayerGroup.id,
        type: 'POST',
        content: 'Please pray for our community outreach event this weekend. We want to show God\'s love to our neighbors.',
        status: 'ACTIVE',
      };

      const prayerRequest = await prisma.post.create({
        data: prayerRequestData,
        include: {
          user: true,
          group: true,
        },
      });

      testData.posts.push(prayerRequest);
      expect(prayerRequest.type).toBe('POST');
      expect(prayerRequest.group.name).toBe(prayerGroup.name);
      console.log('✓ Created prayer request post');

      // Step 7: Member shares a testimony
      const testimonyData = {
        userId: testData.users[2].id,
        groupId: prayerGroup.id,
        type: 'TESTIMONY',
        content: 'God answered my prayers in such an amazing way! I found a new job after months of searching. His timing is perfect!',
        status: 'ACTIVE',
        mediaUrls: ['https://example.com/testimony-video.mp4'],
      };

      const testimony = await prisma.post.create({
        data: testimonyData,
      });

      testData.posts.push(testimony);
      expect(testimony.type).toBe('TESTIMONY');
      expect(testimony.mediaUrls).toEqual(['https://example.com/testimony-video.mp4']);
      console.log('✓ Created testimony post with media');

      // Step 8: Member posts a general encouragement (no group)
      const encouragementData = {
        userId: testData.users[1].id,
        type: 'POST',
        content: 'Remember that God has great plans for each of you! Trust in His timing.',
        status: 'ACTIVE',
      };

      const encouragement = await prisma.post.create({
        data: encouragementData,
      });

      testData.posts.push(encouragement);
      expect(encouragement.groupId).toBeNull();
      console.log('✓ Created standalone encouragement post');

      // Step 9: Users comment on the prayer request
      const commentData = [
        {
          postId: prayerRequest.id,
          userId: testData.users[1].id,
          content: 'Praying for a successful outreach! God will use you mightily.',
        },
        {
          postId: prayerRequest.id,
          userId: testData.users[2].id,
          content: 'Count me in for prayers! Also happy to help with setup if needed.',
        },
        {
          postId: prayerRequest.id,
          userId: testData.users[3].id,
          content: 'Lifting this up in prayer. May God\'s love shine through your outreach!',
        },
      ];

      for (const commentInfo of commentData) {
        const comment = await prisma.comment.create({
          data: commentInfo,
          include: {
            user: true,
            post: true,
          },
        });
        testData.comments.push(comment);
      }

      expect(testData.comments).toHaveLength(3);
      console.log('✓ Added 3 comments to prayer request');

      // Step 10: Comment on testimony
      const testimonyComment = await prisma.comment.create({
        data: {
          postId: testimony.id,
          userId: testData.users[3].id,
          content: 'Praise God! This is such an encouraging testimony. Thank you for sharing!',
        },
      });

      testData.comments.push(testimonyComment);
      console.log('✓ Added comment to testimony');

      // Step 11: Users react to posts
      const reactionData = [
        // Reactions to prayer request
        { postId: prayerRequest.id, userId: testData.users[1].id, type: 'PRAYER' },
        { postId: prayerRequest.id, userId: testData.users[2].id, type: 'PRAYER' },
        { postId: prayerRequest.id, userId: testData.users[3].id, type: 'PRAYER' },
        { postId: prayerRequest.id, userId: testData.users[1].id, type: 'LIKE' }, // Same user, different type
        
        // Reactions to testimony
        { postId: testimony.id, userId: testData.users[0].id, type: 'AMEN' },
        { postId: testimony.id, userId: testData.users[1].id, type: 'AMEN' },
        { postId: testimony.id, userId: testData.users[3].id, type: 'LIKE' },
        
        // Reactions to encouragement
        { postId: encouragement.id, userId: testData.users[0].id, type: 'LIKE' },
        { postId: encouragement.id, userId: testData.users[2].id, type: 'AMEN' },
        { postId: encouragement.id, userId: testData.users[3].id, type: 'LIKE' },
      ];

      for (const reactionInfo of reactionData) {
        const reaction = await prisma.reaction.create({
          data: reactionInfo,
          include: {
            user: true,
            post: true,
          },
        });
        testData.reactions.push(reaction);
      }

      expect(testData.reactions).toHaveLength(10);
      console.log('✓ Added 10 reactions across posts');

      // Step 12: Update post counters based on actual engagement
      await prisma.post.update({
        where: { id: prayerRequest.id },
        data: {
          commentCount: 3,
          reactionCount: 4,
        },
      });

      await prisma.post.update({
        where: { id: testimony.id },
        data: {
          commentCount: 1,
          reactionCount: 3,
        },
      });

      await prisma.post.update({
        where: { id: encouragement.id },
        data: {
          commentCount: 0,
          reactionCount: 3,
        },
      });

      console.log('✓ Updated post engagement counters');

      // Step 13: Comprehensive verification queries
      
      // Verify group activity
      const groupActivity = await prisma.group.findUnique({
        where: { id: prayerGroup.id },
        include: {
          creator: true,
          members: {
            include: {
              user: true,
            },
          },
          posts: {
            include: {
              user: true,
              comments: {
                include: {
                  user: true,
                },
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
          },
          _count: {
            select: {
              members: true,
              posts: true,
            },
          },
        },
      });

      expect(groupActivity.creator.displayName).toBe('Community Leader');
      expect(groupActivity._count.members).toBe(3);
      expect(groupActivity._count.posts).toBe(2); // Prayer request + testimony
      expect(groupActivity.posts).toHaveLength(2);
      
      const prayerRequestPost = groupActivity.posts.find(p => p.type === 'POST');
      const testimonyPost = groupActivity.posts.find(p => p.type === 'TESTIMONY');
      
      expect(prayerRequestPost._count.comments).toBe(3);
      expect(prayerRequestPost._count.reactions).toBe(4);
      expect(testimonyPost._count.comments).toBe(1);
      expect(testimonyPost._count.reactions).toBe(3);
      
      console.log('✓ Verified complete group activity');

      // Verify user activity
      const userActivity = await prisma.user.findUnique({
        where: { id: testData.users[1].id },
        include: {
          createdGroups: true,
          groupMemberships: {
            include: {
              group: true,
            },
          },
          posts: {
            include: {
              group: true,
            },
          },
          comments: {
            include: {
              post: {
                include: {
                  user: true,
                },
              },
            },
          },
          reactions: {
            include: {
              post: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
      });

      expect(userActivity.displayName).toBe('Active Member');
      expect(userActivity.createdGroups).toHaveLength(1); // Testimony group
      expect(userActivity.groupMemberships).toHaveLength(1); // Prayer group
      expect(userActivity.posts).toHaveLength(1); // Encouragement post
      expect(userActivity.comments).toHaveLength(1); // Comment on prayer request
      expect(userActivity.reactions.length).toBeGreaterThan(0);
      
      console.log('✓ Verified user activity across all features');

      // Verify reaction distribution
      const reactionStats = await prisma.reaction.groupBy({
        by: ['type'],
        _count: {
          type: true,
        },
      });

      const likeCount = reactionStats.find(r => r.type === 'LIKE')?._count.type || 0;
      const amenCount = reactionStats.find(r => r.type === 'AMEN')?._count.type || 0;
      const prayerCount = reactionStats.find(r => r.type === 'PRAYER')?._count.type || 0;

      expect(likeCount).toBeGreaterThan(0);
      expect(amenCount).toBeGreaterThan(0);
      expect(prayerCount).toBeGreaterThan(0);
      expect(likeCount + amenCount + prayerCount).toBe(10);
      
      console.log(`✓ Verified reaction distribution: ${likeCount} likes, ${amenCount} amens, ${prayerCount} prayers`);

      // Verify content moderation capabilities
      const pendingPost = await prisma.post.create({
        data: {
          userId: testData.users[3].id,
          content: 'This post needs review before publishing',
          status: 'PENDING_MOD',
        },
      });

      testData.posts.push(pendingPost);

      const activePostsCount = await prisma.post.count({
        where: { status: 'ACTIVE' },
      });
      const pendingPostsCount = await prisma.post.count({
        where: { status: 'PENDING_MOD' },
      });

      // Verify we have our posts plus any from other tests
      expect(activePostsCount).toBeGreaterThanOrEqual(3);
      expect(pendingPostsCount).toBeGreaterThanOrEqual(1);
      
      // Verify our specific posts exist
      const ourActivePosts = await prisma.post.count({
        where: { 
          status: 'ACTIVE',
          id: { in: testData.posts.filter(p => p.status === 'ACTIVE').map(p => p.id) }
        },
      });
      expect(ourActivePosts).toBe(3);
      
      console.log('✓ Verified content moderation system');

      // Final summary
      console.log('\n=== Integration Test Summary ===');
      console.log(`Users created: ${testData.users.length}`);
      console.log(`Groups created: ${testData.groups.length}`);
      console.log(`Memberships created: ${testData.memberships.length}`);
      console.log(`Posts created: ${testData.posts.length}`);
      console.log(`Comments created: ${testData.comments.length}`);
      console.log(`Reactions created: ${testData.reactions.length}`);
      console.log('================================\n');

      expect(testData.users.length).toBe(4);
      expect(testData.groups.length).toBe(2);
      expect(testData.memberships.length).toBe(3);
      expect(testData.posts.length).toBe(4);
      expect(testData.comments.length).toBe(4);
      expect(testData.reactions.length).toBe(10);
    });

    it('should handle complex queries and edge cases', async () => {
      // Find most active users (by posts + comments + reactions)
      const activeUsers = await prisma.user.findMany({
        include: {
          _count: {
            select: {
              posts: true,
              comments: true,
              reactions: true,
            },
          },
        },
        orderBy: [
          { posts: { _count: 'desc' } },
          { comments: { _count: 'desc' } },
          { reactions: { _count: 'desc' } },
        ],
        take: 3,
      });

      expect(activeUsers).toHaveLength(3);
      activeUsers.forEach(user => {
        expect(user._count).toHaveProperty('posts');
        expect(user._count).toHaveProperty('comments');
        expect(user._count).toHaveProperty('reactions');
      });

      // Find posts with most engagement
      const engagedPosts = await prisma.post.findMany({
        where: { status: 'ACTIVE' },
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
        orderBy: [
          { reactions: { _count: 'desc' } },
          { comments: { _count: 'desc' } },
        ],
        take: 2,
      });

      expect(engagedPosts).toHaveLength(2);
      expect(engagedPosts[0]._count.reactions).toBeGreaterThanOrEqual(
        engagedPosts[1]._count.reactions
      );

      // Find groups by activity level
      const activeGroups = await prisma.group.findMany({
        where: { deletedAt: null },
        include: {
          _count: {
            select: {
              members: true,
              posts: true,
            },
          },
        },
        orderBy: [
          { posts: { _count: 'desc' } },
          { members: { _count: 'desc' } },
        ],
      });

      expect(activeGroups.length).toBeGreaterThan(0);
      activeGroups.forEach(group => {
        expect(group._count).toHaveProperty('members');
        expect(group._count).toHaveProperty('posts');
      });

      // Test soft delete behavior
      const postToSoftDelete = testData.posts[0];
      await prisma.post.update({
        where: { id: postToSoftDelete.id },
        data: { deletedAt: new Date() },
      });

      const activePostsAfterDelete = await prisma.post.findMany({
        where: { deletedAt: null },
      });
      const allPosts = await prisma.post.findMany({});

      expect(allPosts.length).toBeGreaterThan(activePostsAfterDelete.length);

      // Restore the post for cleanup
      await prisma.post.update({
        where: { id: postToSoftDelete.id },
        data: { deletedAt: null },
      });

      console.log('✓ Complex queries and edge cases verified');
    });

    it('should maintain data integrity with concurrent operations', async () => {
      const testPost = testData.posts[0];

      // Simulate concurrent reactions from different users
      const concurrentReactions = [
        { postId: testPost.id, userId: testData.users[0].id, type: 'LIKE' },
        { postId: testPost.id, userId: testData.users[1].id, type: 'AMEN' },
        { postId: testPost.id, userId: testData.users[2].id, type: 'PRAYER' },
      ];

      const reactionPromises = concurrentReactions.map(reactionData =>
        prisma.reaction.create({ data: reactionData })
      );

      const createdReactions = await Promise.allSettled(reactionPromises);
      
      // Some may succeed, some may fail due to unique constraints
      const successfulReactions = createdReactions
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value);

      testData.reactions.push(...successfulReactions);

      expect(successfulReactions.length).toBeGreaterThan(0);
      expect(successfulReactions.length).toBeLessThanOrEqual(3);

      console.log(`✓ Concurrent operations: ${successfulReactions.length}/3 reactions created`);
    });
  });
});
