/**
 * Social Models Tests
 *
 * Comprehensive tests for Group and GroupMember models including relationships,
 * enum constraints, and business logic validation.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prismaService from '../../services/prisma.js';
import { UserRepository } from '../../repositories/index.js';

describe('Social Models', () => {
  let prisma;
  let userRepo;
  let testUsers = [];
  let testGroups = [];
  let testMemberships = [];

  beforeAll(async () => {
    // Connect to database
    await prismaService.connect();
    prisma = prismaService.client;
    userRepo = new UserRepository();

    // Create test users
    const userData1 = {
      email: 'group-creator@example.com',
      passwordHash: 'hashedPassword123',
      displayName: 'Group Creator',
      tz: 'America/New_York',
    };
    const userData2 = {
      email: 'group-member@example.com',
      passwordHash: 'hashedPassword456',
      displayName: 'Group Member',
      tz: 'America/Los_Angeles',
    };
    const userData3 = {
      email: 'group-admin@example.com',
      passwordHash: 'hashedPassword789',
      displayName: 'Group Admin',
      tz: 'America/Chicago',
    };

    testUsers.push(
      await userRepo.create(userData1),
      await userRepo.create(userData2),
      await userRepo.create(userData3)
    );
  });

  afterAll(async () => {
    // Clean up test data
    for (const membership of testMemberships) {
      try {
        await prisma.groupMember.delete({
          where: {
            groupId_userId: {
              groupId: membership.groupId,
              userId: membership.userId,
            },
          },
        });
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

  describe('Group Model', () => {
    it('should create a public group with required fields', async () => {
      const groupData = {
        name: 'Test Public Group',
        description: 'A test group for unit testing',
        privacy: 'PUBLIC',
        createdBy: testUsers[0].id,
      };

      const group = await prisma.group.create({
        data: groupData,
        include: {
          creator: true,
          members: true,
          _count: {
            select: {
              members: true,
              posts: true,
            },
          },
        },
      });

      testGroups.push(group);

      expect(group).toHaveProperty('id');
      expect(group.name).toBe(groupData.name);
      expect(group.description).toBe(groupData.description);
      expect(group.privacy).toBe('PUBLIC');
      expect(group.createdBy).toBe(testUsers[0].id);
      expect(group.creator.email).toBe(testUsers[0].email);
      expect(group.createdAt).toBeInstanceOf(Date);
      expect(group.updatedAt).toBeInstanceOf(Date);
      expect(group.deletedAt).toBeNull();
      expect(group.members).toEqual([]);
      expect(group._count.members).toBe(0);
      expect(group._count.posts).toBe(0);
    });

    it('should create a private group with minimal data', async () => {
      const groupData = {
        name: 'Test Private Group',
        privacy: 'PRIVATE',
        createdBy: testUsers[1].id,
      };

      const group = await prisma.group.create({
        data: groupData,
        include: {
          creator: true,
        },
      });

      testGroups.push(group);

      expect(group.name).toBe(groupData.name);
      expect(group.description).toBeNull();
      expect(group.privacy).toBe('PRIVATE');
      expect(group.createdBy).toBe(testUsers[1].id);
      expect(group.creator.email).toBe(testUsers[1].email);
    });

    it('should default to PUBLIC privacy when not specified', async () => {
      const groupData = {
        name: 'Default Privacy Group',
        createdBy: testUsers[0].id,
      };

      const group = await prisma.group.create({
        data: groupData,
      });

      testGroups.push(group);

      expect(group.privacy).toBe('PUBLIC');
    });

    it('should reject invalid privacy enum values', async () => {
      const groupData = {
        name: 'Invalid Privacy Group',
        privacy: 'INVALID_PRIVACY',
        createdBy: testUsers[0].id,
      };

      await expect(
        prisma.group.create({ data: groupData })
      ).rejects.toThrow();
    });

    it('should update group information', async () => {
      const originalGroup = testGroups[0];
      const updateData = {
        name: 'Updated Group Name',
        description: 'Updated description',
        privacy: 'PRIVATE',
      };

      const updatedGroup = await prisma.group.update({
        where: { id: originalGroup.id },
        data: updateData,
      });

      expect(updatedGroup.name).toBe(updateData.name);
      expect(updatedGroup.description).toBe(updateData.description);
      expect(updatedGroup.privacy).toBe('PRIVATE');
      expect(updatedGroup.updatedAt.getTime()).toBeGreaterThan(
        originalGroup.updatedAt.getTime()
      );
    });

    it('should soft delete a group', async () => {
      const groupToDelete = testGroups[1];
      const deletedAt = new Date();

      const softDeletedGroup = await prisma.group.update({
        where: { id: groupToDelete.id },
        data: { deletedAt },
      });

      expect(softDeletedGroup.deletedAt).toEqual(deletedAt);

      // Verify group is still in database but marked as deleted
      const foundGroup = await prisma.group.findUnique({
        where: { id: groupToDelete.id },
      });
      expect(foundGroup.deletedAt).toBeTruthy();
    });

    it('should find groups by creator', async () => {
      const creatorGroups = await prisma.group.findMany({
        where: {
          createdBy: testUsers[0].id,
          deletedAt: null,
        },
        include: {
          creator: true,
        },
      });

      expect(creatorGroups.length).toBeGreaterThan(0);
      creatorGroups.forEach((group) => {
        expect(group.createdBy).toBe(testUsers[0].id);
        expect(group.creator.email).toBe(testUsers[0].email);
        expect(group.deletedAt).toBeNull();
      });
    });

    it('should find groups by privacy setting', async () => {
      const publicGroups = await prisma.group.findMany({
        where: {
          privacy: 'PUBLIC',
          deletedAt: null,
        },
      });

      const privateGroups = await prisma.group.findMany({
        where: {
          privacy: 'PRIVATE',
          deletedAt: null,
        },
      });

      expect(publicGroups.length).toBeGreaterThan(0);
      expect(privateGroups.length).toBeGreaterThan(0);

      publicGroups.forEach((group) => {
        expect(group.privacy).toBe('PUBLIC');
      });
      privateGroups.forEach((group) => {
        expect(group.privacy).toBe('PRIVATE');
      });
    });
  });

  describe('GroupMember Model', () => {
    let testGroup;

    beforeAll(async () => {
      // Create a test group for membership tests
      testGroup = await prisma.group.create({
        data: {
          name: 'Membership Test Group',
          description: 'Group for testing memberships',
          privacy: 'PUBLIC',
          createdBy: testUsers[0].id,
        },
      });
      testGroups.push(testGroup);
    });

    it('should add a member with default MEMBER role', async () => {
      const membershipData = {
        groupId: testGroup.id,
        userId: testUsers[1].id,
      };

      const membership = await prisma.groupMember.create({
        data: membershipData,
        include: {
          group: true,
          user: true,
        },
      });

      testMemberships.push(membership);

      expect(membership.groupId).toBe(testGroup.id);
      expect(membership.userId).toBe(testUsers[1].id);
      expect(membership.role).toBe('MEMBER');
      expect(membership.joinedAt).toBeInstanceOf(Date);
      expect(membership.group.name).toBe(testGroup.name);
      expect(membership.user.email).toBe(testUsers[1].email);
    });

    it('should add a member with ADMIN role', async () => {
      const membershipData = {
        groupId: testGroup.id,
        userId: testUsers[2].id,
        role: 'ADMIN',
      };

      const membership = await prisma.groupMember.create({
        data: membershipData,
        include: {
          group: true,
          user: true,
        },
      });

      testMemberships.push(membership);

      expect(membership.role).toBe('ADMIN');
      expect(membership.userId).toBe(testUsers[2].id);
    });

    it('should enforce composite primary key (groupId, userId)', async () => {
      const duplicateMembershipData = {
        groupId: testGroup.id,
        userId: testUsers[1].id, // Already exists
        role: 'MODERATOR',
      };

      await expect(
        prisma.groupMember.create({ data: duplicateMembershipData })
      ).rejects.toThrow();
    });

    it('should reject invalid role enum values', async () => {
      const invalidMembershipData = {
        groupId: testGroup.id,
        userId: testUsers[0].id,
        role: 'INVALID_ROLE',
      };

      await expect(
        prisma.groupMember.create({ data: invalidMembershipData })
      ).rejects.toThrow();
    });

    it('should update member role', async () => {
      const originalMembership = testMemberships[0];

      const updatedMembership = await prisma.groupMember.update({
        where: {
          groupId_userId: {
            groupId: originalMembership.groupId,
            userId: originalMembership.userId,
          },
        },
        data: { role: 'MODERATOR' },
      });

      expect(updatedMembership.role).toBe('MODERATOR');
      expect(updatedMembership.userId).toBe(originalMembership.userId);
      expect(updatedMembership.groupId).toBe(originalMembership.groupId);
    });

    it('should find members by group', async () => {
      const groupMembers = await prisma.groupMember.findMany({
        where: { groupId: testGroup.id },
        include: {
          user: true,
        },
        orderBy: { joinedAt: 'asc' },
      });

      expect(groupMembers.length).toBe(2);
      expect(groupMembers[0].user.email).toBe(testUsers[1].email);
      expect(groupMembers[1].user.email).toBe(testUsers[2].email);
    });

    it('should find members by role', async () => {
      const admins = await prisma.groupMember.findMany({
        where: {
          groupId: testGroup.id,
          role: 'ADMIN',
        },
        include: {
          user: true,
        },
      });

      const moderators = await prisma.groupMember.findMany({
        where: {
          groupId: testGroup.id,
          role: 'MODERATOR',
        },
        include: {
          user: true,
        },
      });

      expect(admins).toHaveLength(1);
      expect(admins[0].user.email).toBe(testUsers[2].email);

      expect(moderators).toHaveLength(1);
      expect(moderators[0].user.email).toBe(testUsers[1].email);
    });

    it('should find groups for a user', async () => {
      const userGroups = await prisma.groupMember.findMany({
        where: { userId: testUsers[1].id },
        include: {
          group: {
            include: {
              creator: true,
            },
          },
        },
      });

      expect(userGroups.length).toBeGreaterThan(0);
      userGroups.forEach((membership) => {
        expect(membership.userId).toBe(testUsers[1].id);
        expect(membership.group).toBeTruthy();
      });
    });

    it('should count members in a group', async () => {
      const memberCount = await prisma.groupMember.count({
        where: { groupId: testGroup.id },
      });

      expect(memberCount).toBe(2);
    });

    it('should remove a member', async () => {
      const membershipToRemove = testMemberships[0];

      await prisma.groupMember.delete({
        where: {
          groupId_userId: {
            groupId: membershipToRemove.groupId,
            userId: membershipToRemove.userId,
          },
        },
      });

      // Verify member is removed
      const removedMembership = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: membershipToRemove.groupId,
            userId: membershipToRemove.userId,
          },
        },
      });

      expect(removedMembership).toBeNull();

      // Remove from our tracking array
      testMemberships.splice(0, 1);
    });

    it('should handle cascade delete when group is deleted', async () => {
      // Create a temporary group and member for deletion test
      const tempGroup = await prisma.group.create({
        data: {
          name: 'Temp Group for Deletion',
          createdBy: testUsers[0].id,
        },
      });

      const tempMembership = await prisma.groupMember.create({
        data: {
          groupId: tempGroup.id,
          userId: testUsers[1].id,
          role: 'MEMBER',
        },
      });

      // Verify membership exists
      expect(
        await prisma.groupMember.findUnique({
          where: {
            groupId_userId: {
              groupId: tempGroup.id,
              userId: testUsers[1].id,
            },
          },
        })
      ).toBeTruthy();

      // Delete the group
      await prisma.group.delete({
        where: { id: tempGroup.id },
      });

      // Verify membership is also deleted (cascade)
      expect(
        await prisma.groupMember.findUnique({
          where: {
            groupId_userId: {
              groupId: tempGroup.id,
              userId: testUsers[1].id,
            },
          },
        })
      ).toBeNull();
    });
  });

  describe('Social Model Relationships', () => {
    it('should include member count and creator in group queries', async () => {
      // Use the first test group from our array
      const groupWithCounts = await prisma.group.findUnique({
        where: { id: testGroups[0].id },
        include: {
          creator: true,
          members: {
            include: {
              user: true,
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

      expect(groupWithCounts.creator).toBeTruthy();
      expect(groupWithCounts.creator.email).toBe(testUsers[0].email);
      expect(groupWithCounts.members).toBeInstanceOf(Array);
      expect(groupWithCounts._count.members).toBeGreaterThanOrEqual(0);
      expect(groupWithCounts._count.posts).toBe(0); // No posts created yet
    });

    it('should query user with their created groups and memberships', async () => {
      const userWithGroups = await prisma.user.findUnique({
        where: { id: testUsers[0].id },
        include: {
          createdGroups: {
            where: { deletedAt: null },
          },
          groupMemberships: {
            include: {
              group: true,
            },
          },
        },
      });

      expect(userWithGroups.createdGroups).toBeInstanceOf(Array);
      expect(userWithGroups.createdGroups.length).toBeGreaterThan(0);
      expect(userWithGroups.groupMemberships).toBeInstanceOf(Array);

      userWithGroups.createdGroups.forEach((group) => {
        expect(group.createdBy).toBe(testUsers[0].id);
        expect(group.deletedAt).toBeNull();
      });
    });
  });
});
