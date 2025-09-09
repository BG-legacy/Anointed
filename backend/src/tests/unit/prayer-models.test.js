/**
 * Prayer Models Tests
 *
 * Comprehensive tests for Prayer and PrayerCommit models including
 * relationships, enum constraints, status management, and counter tracking.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prismaService from '../../services/prisma.js';
import { UserRepository } from '../../repositories/index.js';

describe('Prayer Models', () => {
  let prisma;
  let userRepo;
  let testUsers = [];
  let testGroups = [];
  let testPosts = [];
  let testPrayers = [];
  let testPrayerCommits = [];

  beforeAll(async () => {
    // Connect to database
    await prismaService.connect();
    prisma = prismaService.client;
    userRepo = new UserRepository();

    // Create test users
    const userData1 = {
      email: 'prayer-creator@example.com',
      passwordHash: 'hashedPassword123',
      displayName: 'Prayer Creator',
      tz: 'America/New_York',
    };
    const userData2 = {
      email: 'prayer-supporter@example.com',
      passwordHash: 'hashedPassword456',
      displayName: 'Prayer Supporter',
      tz: 'America/Los_Angeles',
    };
    const userData3 = {
      email: 'group-member@example.com',
      passwordHash: 'hashedPassword789',
      displayName: 'Group Member',
      tz: 'America/Chicago',
    };

    testUsers.push(
      await userRepo.create(userData1),
      await userRepo.create(userData2),
      await userRepo.create(userData3)
    );

    // Create test group
    const groupData = {
      name: 'Prayer Circle',
      description: 'A group for sharing prayer requests',
      privacy: 'PUBLIC',
      createdBy: testUsers[0].id,
    };
    
    const testGroup = await prisma.group.create({
      data: groupData,
    });
    testGroups.push(testGroup);

    // Create test post to link prayers to
    const postData = {
      userId: testUsers[0].id,
      groupId: testGroups[0].id,
      type: 'POST',
      content: 'Please pray for our community',
      status: 'ACTIVE',
    };
    
    const testPost = await prisma.post.create({
      data: postData,
    });
    testPosts.push(testPost);
  });

  afterAll(async () => {
    // Clean up test data in reverse order of dependencies
    if (testPrayerCommits.length > 0) {
      await prisma.prayerCommit.deleteMany({
        where: {
          id: { in: testPrayerCommits.map(commit => commit.id) },
        },
      });
    }

    if (testPrayers.length > 0) {
      await prisma.prayer.deleteMany({
        where: {
          id: { in: testPrayers.map(prayer => prayer.id) },
        },
      });
    }

    if (testPosts.length > 0) {
      await prisma.post.deleteMany({
        where: {
          id: { in: testPosts.map(post => post.id) },
        },
      });
    }

    if (testGroups.length > 0) {
      await prisma.group.deleteMany({
        where: {
          id: { in: testGroups.map(group => group.id) },
        },
      });
    }

    if (testUsers.length > 0) {
      await prisma.user.deleteMany({
        where: {
          id: { in: testUsers.map(user => user.id) },
        },
      });
    }

    await prismaService.disconnect();
  });

  describe('Prayer Model', () => {
    it('should create a basic prayer request', async () => {
      const prayerData = {
        userId: testUsers[0].id,
        title: 'Healing Prayer',
        content: 'Please pray for my grandmother\'s recovery',
        status: 'OPEN',
      };

      const prayer = await prisma.prayer.create({
        data: prayerData,
        include: {
          user: true,
        },
      });

      expect(prayer).toBeDefined();
      expect(prayer.id).toBeDefined();
      expect(prayer.title).toBe(prayerData.title);
      expect(prayer.content).toBe(prayerData.content);
      expect(prayer.status).toBe('OPEN');
      expect(prayer.commitCount).toBe(0);
      expect(prayer.user.displayName).toBe('Prayer Creator');
      expect(prayer.createdAt).toBeDefined();
      expect(prayer.updatedAt).toBeDefined();
      expect(prayer.deletedAt).toBeNull();

      testPrayers.push(prayer);
    });

    it('should create a prayer with group association', async () => {
      const prayerData = {
        userId: testUsers[1].id,
        groupId: testGroups[0].id,
        title: 'Group Prayer Request',
        content: 'Praying for our church community',
        status: 'OPEN',
      };

      const prayer = await prisma.prayer.create({
        data: prayerData,
        include: {
          user: true,
          group: true,
        },
      });

      expect(prayer).toBeDefined();
      expect(prayer.groupId).toBe(testGroups[0].id);
      expect(prayer.group.name).toBe('Prayer Circle');
      expect(prayer.user.displayName).toBe('Prayer Supporter');

      testPrayers.push(prayer);
    });

    it('should create a prayer linked to a post', async () => {
      const prayerData = {
        userId: testUsers[2].id,
        linkedPostId: testPosts[0].id,
        title: 'Response Prayer',
        content: 'Praying for the request shared in this post',
        status: 'OPEN',
      };

      const prayer = await prisma.prayer.create({
        data: prayerData,
        include: {
          user: true,
          linkedPost: true,
        },
      });

      expect(prayer).toBeDefined();
      expect(prayer.linkedPostId).toBe(testPosts[0].id);
      expect(prayer.linkedPost.content).toBe('Please pray for our community');

      testPrayers.push(prayer);
    });

    it('should validate prayer status enum values', async () => {
      const validStatuses = ['OPEN', 'ANSWERED', 'ARCHIVED'];
      
      for (const status of validStatuses) {
        const prayerData = {
          userId: testUsers[0].id,
          title: `Test Prayer - ${status}`,
          content: `Testing ${status} status`,
          status,
        };

        const prayer = await prisma.prayer.create({
          data: prayerData,
        });

        expect(prayer.status).toBe(status);
        testPrayers.push(prayer);
      }
    });

    it('should reject invalid prayer status', async () => {
      const prayerData = {
        userId: testUsers[0].id,
        title: 'Invalid Status Prayer',
        content: 'This should fail',
        status: 'INVALID_STATUS',
      };

      await expect(
        prisma.prayer.create({
          data: prayerData,
        })
      ).rejects.toThrow();
    });

    it('should update prayer status', async () => {
      const prayer = testPrayers[0];
      
      const updatedPrayer = await prisma.prayer.update({
        where: { id: prayer.id },
        data: { status: 'ANSWERED' },
      });

      expect(updatedPrayer.status).toBe('ANSWERED');
      expect(updatedPrayer.updatedAt.getTime()).toBeGreaterThan(
        prayer.updatedAt.getTime()
      );
    });

    it('should soft delete a prayer', async () => {
      const prayer = testPrayers[1];
      
      const deletedPrayer = await prisma.prayer.update({
        where: { id: prayer.id },
        data: { deletedAt: new Date() },
      });

      expect(deletedPrayer.deletedAt).toBeDefined();
      
      // Verify soft delete - record still exists but marked as deleted
      const foundPrayer = await prisma.prayer.findUnique({
        where: { id: prayer.id },
      });
      
      expect(foundPrayer).toBeDefined();
      expect(foundPrayer.deletedAt).toBeDefined();
    });

    it('should cascade delete when user is deleted', async () => {
      // Create a user and prayer for testing cascade
      const tempUser = await userRepo.create({
        email: `temp-prayer-user-${Date.now()}@example.com`,
        passwordHash: 'hashedPassword',
        displayName: 'Temp User',
      });

      const prayer = await prisma.prayer.create({
        data: {
          userId: tempUser.id,
          title: 'Temp Prayer',
          content: 'This will be deleted with user',
        },
      });

      // Delete the user
      await prisma.user.delete({
        where: { id: tempUser.id },
      });

      // Verify prayer is also deleted
      const foundPrayer = await prisma.prayer.findUnique({
        where: { id: prayer.id },
      });

      expect(foundPrayer).toBeNull();
    });

    it('should set group to null when group is deleted', async () => {
      // Create a temporary group and prayer
      const tempGroup = await prisma.group.create({
        data: {
          name: 'Temp Group',
          description: 'Temporary group for testing',
          privacy: 'PUBLIC',
          createdBy: testUsers[0].id,
        },
      });

      const prayer = await prisma.prayer.create({
        data: {
          userId: testUsers[0].id,
          groupId: tempGroup.id,
          title: 'Group Prayer',
          content: 'Prayer in temporary group',
        },
      });

      // Delete the group
      await prisma.group.delete({
        where: { id: tempGroup.id },
      });

      // Verify prayer still exists but groupId is null
      const foundPrayer = await prisma.prayer.findUnique({
        where: { id: prayer.id },
      });

      expect(foundPrayer).toBeDefined();
      expect(foundPrayer.groupId).toBeNull();

      // Clean up
      await prisma.prayer.delete({
        where: { id: prayer.id },
      });
    });
  });

  describe('PrayerCommit Model', () => {
    it('should create a prayer commit', async () => {
      const prayer = testPrayers[2]; // Use existing prayer
      
      const commitData = {
        prayerId: prayer.id,
        userId: testUsers[1].id,
        message: 'I am committed to praying for this request',
      };

      const prayerCommit = await prisma.prayerCommit.create({
        data: commitData,
        include: {
          prayer: true,
          user: true,
        },
      });

      expect(prayerCommit).toBeDefined();
      expect(prayerCommit.prayerId).toBe(prayer.id);
      expect(prayerCommit.userId).toBe(testUsers[1].id);
      expect(prayerCommit.message).toBe(commitData.message);
      expect(prayerCommit.user.displayName).toBe('Prayer Supporter');
      expect(prayerCommit.prayer.title).toBe('Response Prayer');
      expect(prayerCommit.createdAt).toBeDefined();

      testPrayerCommits.push(prayerCommit);
    });

    it('should create a prayer commit without message', async () => {
      const prayer = testPrayers[3]; // Use existing prayer
      
      const commitData = {
        prayerId: prayer.id,
        userId: testUsers[2].id,
      };

      const prayerCommit = await prisma.prayerCommit.create({
        data: commitData,
        include: {
          prayer: true,
          user: true,
        },
      });

      expect(prayerCommit).toBeDefined();
      expect(prayerCommit.message).toBeNull();
      expect(prayerCommit.user.displayName).toBe('Group Member');

      testPrayerCommits.push(prayerCommit);
    });

    it('should allow multiple commits from different users', async () => {
      const prayer = testPrayers[4]; // Use existing prayer
      
      const commit1 = await prisma.prayerCommit.create({
        data: {
          prayerId: prayer.id,
          userId: testUsers[0].id,
          message: 'First commit',
        },
      });

      const commit2 = await prisma.prayerCommit.create({
        data: {
          prayerId: prayer.id,
          userId: testUsers[1].id,
          message: 'Second commit',
        },
      });

      expect(commit1.prayerId).toBe(prayer.id);
      expect(commit2.prayerId).toBe(prayer.id);
      expect(commit1.userId).not.toBe(commit2.userId);

      testPrayerCommits.push(commit1, commit2);
    });

    it('should allow multiple commits from same user', async () => {
      const prayer = testPrayers[5]; // Use existing prayer
      
      const commit1 = await prisma.prayerCommit.create({
        data: {
          prayerId: prayer.id,
          userId: testUsers[0].id,
          message: 'First commitment',
        },
      });

      const commit2 = await prisma.prayerCommit.create({
        data: {
          prayerId: prayer.id,
          userId: testUsers[0].id,
          message: 'Updated commitment',
        },
      });

      expect(commit1.prayerId).toBe(prayer.id);
      expect(commit2.prayerId).toBe(prayer.id);
      expect(commit1.userId).toBe(commit2.userId);
      expect(commit1.id).not.toBe(commit2.id);

      testPrayerCommits.push(commit1, commit2);
    });

    it('should cascade delete when prayer is deleted', async () => {
      // Create a temporary prayer and commit
      const tempPrayer = await prisma.prayer.create({
        data: {
          userId: testUsers[0].id,
          title: 'Temp Prayer for Cascade Test',
          content: 'This will be deleted',
        },
      });

      const commit = await prisma.prayerCommit.create({
        data: {
          prayerId: tempPrayer.id,
          userId: testUsers[1].id,
          message: 'This commit will be deleted too',
        },
      });

      // Delete the prayer
      await prisma.prayer.delete({
        where: { id: tempPrayer.id },
      });

      // Verify commit is also deleted
      const foundCommit = await prisma.prayerCommit.findUnique({
        where: { id: commit.id },
      });

      expect(foundCommit).toBeNull();
    });

    it('should cascade delete when user is deleted', async () => {
      // Create a user and commit for testing cascade
      const tempUser = await userRepo.create({
        email: `temp-commit-user-${Date.now()}@example.com`,
        passwordHash: 'hashedPassword',
        displayName: 'Temp Commit User',
      });

      const prayer = testPrayers[0]; // Use existing prayer
      const commit = await prisma.prayerCommit.create({
        data: {
          prayerId: prayer.id,
          userId: tempUser.id,
          message: 'This commit will be deleted with user',
        },
      });

      // Delete the user
      await prisma.user.delete({
        where: { id: tempUser.id },
      });

      // Verify commit is also deleted
      const foundCommit = await prisma.prayerCommit.findUnique({
        where: { id: commit.id },
      });

      expect(foundCommit).toBeNull();
    });
  });

  describe('Prayer Relationships and Queries', () => {
    it('should query prayers with all relations', async () => {
      const prayers = await prisma.prayer.findMany({
        where: {
          userId: testUsers[0].id,
          deletedAt: null,
        },
        include: {
          user: true,
          group: true,
          linkedPost: true,
          commits: {
            include: {
              user: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      expect(prayers.length).toBeGreaterThan(0);
      
      prayers.forEach(prayer => {
        expect(prayer.user).toBeDefined();
        expect(prayer.user.displayName).toBe('Prayer Creator');
        
        if (prayer.commits && prayer.commits.length > 0) {
          prayer.commits.forEach(commit => {
            expect(commit.user).toBeDefined();
            expect(commit.user.displayName).toBeDefined();
          });
        }
      });
    });

    it('should query prayers by status', async () => {
      const openPrayers = await prisma.prayer.findMany({
        where: {
          status: 'OPEN',
          deletedAt: null,
        },
      });

      const answeredPrayers = await prisma.prayer.findMany({
        where: {
          status: 'ANSWERED',
        },
      });

      expect(openPrayers.length).toBeGreaterThan(0);
      expect(answeredPrayers.length).toBeGreaterThan(0);

      openPrayers.forEach(prayer => {
        expect(prayer.status).toBe('OPEN');
      });

      answeredPrayers.forEach(prayer => {
        expect(prayer.status).toBe('ANSWERED');
      });
    });

    it('should query prayers by group', async () => {
      // Create a specific prayer for this test to avoid interference from soft deletes
      const groupPrayerData = {
        userId: testUsers[2].id,
        groupId: testGroups[0].id,
        title: 'Community Prayer Request',
        content: 'Praying for our group members',
        status: 'OPEN',
      };

      const testGroupPrayer = await prisma.prayer.create({
        data: groupPrayerData,
      });

      const groupPrayers = await prisma.prayer.findMany({
        where: {
          groupId: testGroups[0].id,
          deletedAt: null,
        },
        include: {
          group: true,
        },
      });

      // Should find at least our test prayer
      expect(groupPrayers.length).toBeGreaterThanOrEqual(1);
      
      // Find our test prayer in the results
      const ourPrayer = groupPrayers.find(p => p.id === testGroupPrayer.id);
      expect(ourPrayer).toBeDefined();
      expect(ourPrayer.groupId).toBe(testGroups[0].id);
      expect(ourPrayer.group.name).toBe('Prayer Circle');

      // Clean up
      await prisma.prayer.delete({
        where: { id: testGroupPrayer.id },
      });
    });

    it('should count prayer commits correctly', async () => {
      const prayer = testPrayers[4]; // This should have commits
      
      const commitsCount = await prisma.prayerCommit.count({
        where: {
          prayerId: prayer.id,
        },
      });

      expect(commitsCount).toBeGreaterThan(0);
      
      // Update prayer with actual commit count
      const updatedPrayer = await prisma.prayer.update({
        where: { id: prayer.id },
        data: { commitCount: commitsCount },
      });

      expect(updatedPrayer.commitCount).toBe(commitsCount);
    });

    it('should find prayers linked to posts', async () => {
      const linkedPrayers = await prisma.prayer.findMany({
        where: {
          linkedPostId: { not: null },
          deletedAt: null,
        },
        include: {
          linkedPost: true,
        },
      });

      expect(linkedPrayers.length).toBeGreaterThan(0);
      
      linkedPrayers.forEach(prayer => {
        expect(prayer.linkedPostId).toBeDefined();
        expect(prayer.linkedPost).toBeDefined();
      });
    });

    it('should query user prayers with pagination', async () => {
      const userPrayers = await prisma.prayer.findMany({
        where: {
          userId: testUsers[0].id,
          deletedAt: null,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
        skip: 0,
      });

      expect(Array.isArray(userPrayers)).toBe(true);
      expect(userPrayers.length).toBeLessThanOrEqual(5);
    });
  });
});
