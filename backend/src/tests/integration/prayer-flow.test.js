/**
 * Prayer Flow Integration Tests
 *
 * End-to-end integration tests for the complete prayer workflow:
 * User creation → Group creation → Prayer creation → Prayer commits → Status updates
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prismaService from '../../services/prisma.js';
import { UserRepository } from '../../repositories/index.js';

describe('Prayer Flow Integration', () => {
  let prisma;
  let userRepo;
  let testData = {
    users: [],
    groups: [],
    posts: [],
    prayers: [],
    prayerCommits: [],
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

    await cleanup(testData.prayerCommits, (pc) => prisma.prayerCommit.delete({ where: { id: pc.id } }));
    await cleanup(testData.prayers, (p) => prisma.prayer.delete({ where: { id: p.id } }));
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
    await cleanup(testData.users, (u) => prisma.user.delete({ where: { id: u.id } }));

    await prismaService.disconnect();
  });

  it('should complete the full prayer workflow', async () => {
    // === STEP 1: Create Users ===
    console.log('Creating test users...');
    
    const userData = [
      {
        email: 'prayer-leader@example.com',
        passwordHash: 'hashedPassword123',
        displayName: 'Prayer Leader',
        tz: 'America/New_York',
      },
      {
        email: 'faithful-member@example.com',
        passwordHash: 'hashedPassword456',
        displayName: 'Faithful Member',
        tz: 'America/Los_Angeles',
      },
      {
        email: 'caring-supporter@example.com',
        passwordHash: 'hashedPassword789',
        displayName: 'Caring Supporter',
        tz: 'America/Chicago',
      },
      {
        email: 'youth-member@example.com',
        passwordHash: 'hashedPassword101',
        displayName: 'Youth Member',
        tz: 'America/Denver',
      },
    ];

    for (const data of userData) {
      const user = await userRepo.create(data);
      testData.users.push(user);
    }

    expect(testData.users).toHaveLength(4);
    console.log(`✓ Created ${testData.users.length} users`);

    // === STEP 2: Create Prayer Groups ===
    console.log('Creating prayer groups...');
    
    const groupsData = [
      {
        name: 'Sunday Prayer Circle',
        description: 'Weekly prayer requests and intercession',
        privacy: 'PUBLIC',
        createdBy: testData.users[0].id,
      },
      {
        name: 'Youth Prayer Team',
        description: 'Prayer requests from our youth ministry',
        privacy: 'PRIVATE',
        createdBy: testData.users[3].id,
      },
    ];

    for (const groupData of groupsData) {
      const group = await prisma.group.create({
        data: groupData,
      });
      testData.groups.push(group);
    }

    expect(testData.groups).toHaveLength(2);
    console.log(`✓ Created ${testData.groups.length} prayer groups`);

    // === STEP 3: Add Group Memberships ===
    console.log('Adding group memberships...');
    
    const membershipsData = [
      // Sunday Prayer Circle memberships
      { groupId: testData.groups[0].id, userId: testData.users[0].id, role: 'ADMIN' },
      { groupId: testData.groups[0].id, userId: testData.users[1].id, role: 'MEMBER' },
      { groupId: testData.groups[0].id, userId: testData.users[2].id, role: 'MEMBER' },
      
      // Youth Prayer Team memberships
      { groupId: testData.groups[1].id, userId: testData.users[3].id, role: 'ADMIN' },
      { groupId: testData.groups[1].id, userId: testData.users[1].id, role: 'MODERATOR' },
    ];

    for (const membershipData of membershipsData) {
      const membership = await prisma.groupMember.create({
        data: membershipData,
      });
      testData.memberships.push(membership);
    }

    expect(testData.memberships).toHaveLength(5);
    console.log(`✓ Added ${testData.memberships.length} group memberships`);

    // === STEP 4: Create Posts for Prayer Context ===
    console.log('Creating contextual posts...');
    
    const postsData = [
      {
        userId: testData.users[0].id,
        groupId: testData.groups[0].id,
        type: 'POST',
        content: 'Please remember to bring your prayer requests to our Sunday gathering. We believe in the power of collective prayer!',
        status: 'ACTIVE',
      },
      {
        userId: testData.users[3].id,
        groupId: testData.groups[1].id,
        type: 'TESTIMONY',
        content: 'Amazing testimony: God answered our prayer for Sarah\'s healing! She\'s back in school and doing great.',
        status: 'ACTIVE',
      },
    ];

    for (const postData of postsData) {
      const post = await prisma.post.create({
        data: postData,
      });
      testData.posts.push(post);
    }

    expect(testData.posts).toHaveLength(2);
    console.log(`✓ Created ${testData.posts.length} contextual posts`);

    // === STEP 5: Create Prayer Requests ===
    console.log('Creating prayer requests...');
    
    const prayersData = [
      {
        userId: testData.users[1].id,
        groupId: testData.groups[0].id,
        title: 'Healing for My Father',
        content: 'My father was diagnosed with cancer last week. Please pray for his complete healing and strength for our family during this difficult time.',
        status: 'OPEN',
      },
      {
        userId: testData.users[2].id,
        groupId: testData.groups[0].id,
        title: 'Job Search Breakthrough',
        content: 'I\'ve been unemployed for 3 months. Praying for God to open the right doors and provide for my family.',
        status: 'OPEN',
      },
      {
        userId: testData.users[3].id,
        groupId: testData.groups[1].id,
        linkedPostId: testData.posts[1].id,
        title: 'More Testimonies Like Sarah\'s',
        content: 'Inspired by Sarah\'s healing testimony! Praying that God continues to move powerfully in our youth group.',
        status: 'OPEN',
      },
      {
        userId: testData.users[0].id,
        title: 'Wisdom for Church Leadership',
        content: 'Seeking God\'s wisdom and guidance as we make important decisions for our church\'s future direction.',
        status: 'OPEN',
      },
    ];

    for (const prayerData of prayersData) {
      const prayer = await prisma.prayer.create({
        data: prayerData,
        include: {
          user: true,
          group: true,
          linkedPost: true,
        },
      });
      testData.prayers.push(prayer);
    }

    expect(testData.prayers).toHaveLength(4);
    console.log(`✓ Created ${testData.prayers.length} prayer requests`);

    // Verify prayer relationships
    const groupPrayers = testData.prayers.filter(p => p.groupId);
    const linkedPrayers = testData.prayers.filter(p => p.linkedPostId);
    const personalPrayers = testData.prayers.filter(p => !p.groupId);

    expect(groupPrayers).toHaveLength(3);
    expect(linkedPrayers).toHaveLength(1);
    expect(personalPrayers).toHaveLength(1);

    // === STEP 6: Create Prayer Commits ===
    console.log('Creating prayer commits...');
    
    const commitsData = [
      // Multiple people committing to the healing prayer
      {
        prayerId: testData.prayers[0].id,
        userId: testData.users[0].id,
        message: 'Absolutely! Our prayer team will be interceding for your father. God is our healer!',
      },
      {
        prayerId: testData.prayers[0].id,
        userId: testData.users[2].id,
        message: 'Added to my daily prayer list. Believing God for complete restoration.',
      },
      {
        prayerId: testData.prayers[0].id,
        userId: testData.users[3].id,
        message: 'Our youth group will be praying too. God is good!',
      },
      
      // Job search prayer commits
      {
        prayerId: testData.prayers[1].id,
        userId: testData.users[0].id,
        message: 'Praying for favor and divine connections in your job search.',
      },
      {
        prayerId: testData.prayers[1].id,
        userId: testData.users[1].id,
        message: 'I went through similar situation. God provided perfectly. Trusting He will for you too!',
      },
      
      // Youth testimony prayer commits
      {
        prayerId: testData.prayers[2].id,
        userId: testData.users[1].id,
        message: 'Amen! God is moving in our generation.',
      },
      
      // Leadership wisdom prayer commits
      {
        prayerId: testData.prayers[3].id,
        userId: testData.users[1].id,
        message: 'Praying for God\'s perfect will and timing in all decisions.',
      },
      {
        prayerId: testData.prayers[3].id,
        userId: testData.users[2].id,
        message: 'Thank you for your faithful leadership. Covering you in prayer.',
      },
      
      // Some commits without messages (just commitment)
      {
        prayerId: testData.prayers[0].id,
        userId: testData.users[1].id, // The person who requested the prayer commits too
      },
      {
        prayerId: testData.prayers[1].id,
        userId: testData.users[3].id,
      },
    ];

    for (const commitData of commitsData) {
      const commit = await prisma.prayerCommit.create({
        data: commitData,
        include: {
          prayer: true,
          user: true,
        },
      });
      testData.prayerCommits.push(commit);
    }

    expect(testData.prayerCommits).toHaveLength(10);
    console.log(`✓ Created ${testData.prayerCommits.length} prayer commits`);

    // === STEP 7: Update Prayer Commit Counts ===
    console.log('Updating prayer commit counts...');
    
    for (const prayer of testData.prayers) {
      const commitCount = await prisma.prayerCommit.count({
        where: { prayerId: prayer.id },
      });
      
      await prisma.prayer.update({
        where: { id: prayer.id },
        data: { commitCount },
      });
    }

    console.log('✓ Updated prayer commit counts');

    // === STEP 8: Answer Some Prayers ===
    console.log('Updating prayer statuses...');
    
    // Answer the job search prayer
    await prisma.prayer.update({
      where: { id: testData.prayers[1].id },
      data: { status: 'ANSWERED' },
    });

    // Archive the youth testimony prayer
    await prisma.prayer.update({
      where: { id: testData.prayers[2].id },
      data: { status: 'ARCHIVED' },
    });

    console.log('✓ Updated prayer statuses');
  });

  it('should query prayer analytics and insights', async () => {
    console.log('Testing prayer analytics and insights...');

    // === Prayer Statistics ===
    const totalPrayers = await prisma.prayer.count({
      where: { deletedAt: null },
    });

    const prayersByStatus = await prisma.prayer.groupBy({
      by: ['status'],
      where: { deletedAt: null },
      _count: { status: true },
    });

    const totalCommits = await prisma.prayerCommit.count();

    expect(totalPrayers).toBe(4);
    expect(totalCommits).toBe(10);
    expect(prayersByStatus).toHaveLength(3); // OPEN, ANSWERED, ARCHIVED

    console.log(`✓ Total prayers: ${totalPrayers}`);
    console.log(`✓ Total commits: ${totalCommits}`);
    console.log(`✓ Status distribution:`, prayersByStatus);

    // === Most Active Prayer Warriors ===
    const prayerWarriors = await prisma.prayerCommit.groupBy({
      by: ['userId'],
      _count: { userId: true },
      orderBy: { _count: { userId: 'desc' } },
    });

    expect(prayerWarriors).toHaveLength(4); // All users participated
    expect(prayerWarriors[0]._count.userId).toBeGreaterThan(1);

    console.log('✓ Most active prayer warriors:', prayerWarriors);

    // === Prayers with Most Support ===
    const prayersWithSupport = await prisma.prayer.findMany({
      where: { deletedAt: null },
      include: {
        _count: {
          select: { commits: true },
        },
        user: true,
        group: true,
      },
      orderBy: {
        commitCount: 'desc',
      },
    });

    expect(prayersWithSupport).toHaveLength(4);
    expect(prayersWithSupport[0].commitCount).toBeGreaterThan(0);

    console.log('✓ Prayers with most support:', prayersWithSupport.map(p => ({
      title: p.title,
      commitCount: p.commitCount,
      creator: p.user.displayName,
    })));

    // === Group Prayer Activity ===
    const groupPrayerActivity = await prisma.group.findMany({
      include: {
        _count: {
          select: { prayers: true },
        },
        prayers: {
          where: { deletedAt: null },
          include: {
            _count: {
              select: { commits: true },
            },
          },
        },
      },
    });

    expect(groupPrayerActivity).toHaveLength(2);
    
    groupPrayerActivity.forEach(group => {
      console.log(`✓ Group "${group.name}": ${group._count.prayers} prayers`);
    });

    // === Recent Prayer Activity ===
    const recentActivity = await prisma.prayerCommit.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        prayer: {
          select: { title: true },
        },
        user: {
          select: { displayName: true },
        },
      },
    });

    expect(recentActivity).toHaveLength(5);
    console.log('✓ Recent prayer activity:', recentActivity.map(activity => ({
      user: activity.user.displayName,
      prayer: activity.prayer.title,
      hasMessage: !!activity.message,
    })));
  });

  it('should handle prayer lifecycle management', async () => {
    console.log('Testing prayer lifecycle management...');

    const prayer = testData.prayers[0]; // Healing prayer

    // === Check Initial State ===
    let currentPrayer = await prisma.prayer.findUnique({
      where: { id: prayer.id },
      include: {
        commits: {
          include: { user: true },
        },
      },
    });

    expect(currentPrayer.status).toBe('OPEN');
    expect(currentPrayer.commits.length).toBeGreaterThan(0);

    console.log(`✓ Initial prayer status: ${currentPrayer.status}`);
    console.log(`✓ Initial commit count: ${currentPrayer.commits.length}`);

    // === Add More Commits ===
    const newCommit = await prisma.prayerCommit.create({
      data: {
        prayerId: prayer.id,
        userId: testData.users[2].id,
        message: 'Following up - still praying for your father daily!',
      },
    });

    testData.prayerCommits.push(newCommit);

    // Update commit count
    const updatedCommitCount = await prisma.prayerCommit.count({
      where: { prayerId: prayer.id },
    });

    await prisma.prayer.update({
      where: { id: prayer.id },
      data: { commitCount: updatedCommitCount },
    });

    console.log(`✓ Added follow-up commit, new count: ${updatedCommitCount}`);

    // === Mark Prayer as Answered ===
    const answeredPrayer = await prisma.prayer.update({
      where: { id: prayer.id },
      data: { status: 'ANSWERED' },
    });

    expect(answeredPrayer.status).toBe('ANSWERED');
    console.log('✓ Prayer marked as ANSWERED');

    // === Add Thanksgiving Commit ===
    const thanksgivingCommit = await prisma.prayerCommit.create({
      data: {
        prayerId: prayer.id,
        userId: testData.users[1].id, // Original requester
        message: 'PRAISE GOD! My father\'s latest scan came back clear! Thank you all for your faithful prayers!',
      },
    });

    testData.prayerCommits.push(thanksgivingCommit);

    console.log('✓ Added thanksgiving commit for answered prayer');

    // === Archive Prayer After Some Time ===
    const archivedPrayer = await prisma.prayer.update({
      where: { id: prayer.id },
      data: { status: 'ARCHIVED' },
    });

    expect(archivedPrayer.status).toBe('ARCHIVED');
    console.log('✓ Prayer archived after being answered');

    // === Verify Final State ===
    const finalPrayer = await prisma.prayer.findUnique({
      where: { id: prayer.id },
      include: {
        commits: {
          include: { user: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    expect(finalPrayer.status).toBe('ARCHIVED');
    expect(finalPrayer.commits.length).toBeGreaterThan(3);

    console.log(`✓ Final prayer state - Status: ${finalPrayer.status}, Commits: ${finalPrayer.commits.length}`);

    // Show the prayer journey
    console.log('✓ Prayer journey:');
    finalPrayer.commits.forEach((commit, index) => {
      console.log(`  ${index + 1}. ${commit.user.displayName}: ${commit.message || '(committed to pray)'}`);
    });
  });
});
