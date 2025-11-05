/**
 * XP Totals Trigger Integration Tests
 * Tests for database triggers that maintain XP totals from XP events
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import prismaService from '../../services/prisma.js';

describe('XP Totals Trigger Integration Tests', () => {
  let prisma;
  let testUser1, testUser2, testUser3;

  beforeAll(async () => {
    // Connect to database
    await prismaService.connect();
    prisma = prismaService.client;

    // Create test users
    testUser1 = await prisma.user.create({
      data: {
        email: 'xp-trigger-user1@test.com',
        passwordHash: 'hashedpassword123',
        displayName: 'XP Test User 1',
      },
    });

    testUser2 = await prisma.user.create({
      data: {
        email: 'xp-trigger-user2@test.com',
        passwordHash: 'hashedpassword456',
        displayName: 'XP Test User 2',
      },
    });

    testUser3 = await prisma.user.create({
      data: {
        email: 'xp-trigger-user3@test.com',
        passwordHash: 'hashedpassword789',
        displayName: 'XP Test User 3',
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.xpEvent.deleteMany({
      where: { userId: { in: [testUser1.id, testUser2.id, testUser3.id] } },
    });
    await prisma.xpTotals.deleteMany({
      where: { userId: { in: [testUser1.id, testUser2.id, testUser3.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [testUser1.id, testUser2.id, testUser3.id] } },
    });

    await prismaService.disconnect();
  });

  beforeEach(async () => {
    // Clean up XP data before each test
    await prisma.xpEvent.deleteMany({
      where: { userId: { in: [testUser1.id, testUser2.id, testUser3.id] } },
    });
    await prisma.xpTotals.deleteMany({
      where: { userId: { in: [testUser1.id, testUser2.id, testUser3.id] } },
    });
  });

  describe('Basic XP Totals Updates', () => {
    test('should create xp_totals record on first XP event for a user', async () => {
      // Verify no totals exist initially
      let totals = await prisma.xpTotals.findUnique({
        where: { userId: testUser1.id },
      });
      expect(totals).toBeNull();

      // Insert an XP event
      await prisma.xpEvent.create({
        data: {
          userId: testUser1.id,
          fruit: 'LOVE',
          amount: 10,
          reason: 'Helped a fellow believer',
        },
      });

      // Verify totals were created
      totals = await prisma.xpTotals.findUnique({
        where: { userId: testUser1.id },
      });
      expect(totals).not.toBeNull();
      expect(totals.love).toBe(10);
      expect(totals.joy).toBe(0);
      expect(totals.peace).toBe(0);
      expect(totals.patience).toBe(0);
      expect(totals.kindness).toBe(0);
      expect(totals.goodness).toBe(0);
      expect(totals.faithfulness).toBe(0);
      expect(totals.gentleness).toBe(0);
      expect(totals.selfControl).toBe(0);
    });

    test('should increment existing xp_totals when adding more XP events', async () => {
      // Create initial XP event
      await prisma.xpEvent.create({
        data: {
          userId: testUser1.id,
          fruit: 'LOVE',
          amount: 10,
          reason: 'First event',
        },
      });

      // Add another XP event for the same fruit
      await prisma.xpEvent.create({
        data: {
          userId: testUser1.id,
          fruit: 'LOVE',
          amount: 15,
          reason: 'Second event',
        },
      });

      // Verify totals incremented
      const totals = await prisma.xpTotals.findUnique({
        where: { userId: testUser1.id },
      });
      expect(totals.love).toBe(25); // 10 + 15
    });

    test('should update different fruit columns independently', async () => {
      // Add XP events for different fruits
      await prisma.xpEvent.create({
        data: {
          userId: testUser1.id,
          fruit: 'LOVE',
          amount: 10,
          reason: 'Love event',
        },
      });

      await prisma.xpEvent.create({
        data: {
          userId: testUser1.id,
          fruit: 'JOY',
          amount: 20,
          reason: 'Joy event',
        },
      });

      await prisma.xpEvent.create({
        data: {
          userId: testUser1.id,
          fruit: 'PEACE',
          amount: 30,
          reason: 'Peace event',
        },
      });

      // Verify each fruit was updated correctly
      const totals = await prisma.xpTotals.findUnique({
        where: { userId: testUser1.id },
      });
      expect(totals.love).toBe(10);
      expect(totals.joy).toBe(20);
      expect(totals.peace).toBe(30);
      expect(totals.patience).toBe(0);
      expect(totals.kindness).toBe(0);
      expect(totals.goodness).toBe(0);
      expect(totals.faithfulness).toBe(0);
      expect(totals.gentleness).toBe(0);
      expect(totals.selfControl).toBe(0);
    });
  });

  describe('All Fruit Types', () => {
    test('should handle all nine fruits of the spirit', async () => {
      const fruits = [
        { fruit: 'LOVE', amount: 10 },
        { fruit: 'JOY', amount: 20 },
        { fruit: 'PEACE', amount: 30 },
        { fruit: 'PATIENCE', amount: 40 },
        { fruit: 'KINDNESS', amount: 50 },
        { fruit: 'GOODNESS', amount: 60 },
        { fruit: 'FAITHFULNESS', amount: 70 },
        { fruit: 'GENTLENESS', amount: 80 },
        { fruit: 'SELF_CONTROL', amount: 90 },
      ];

      // Create XP events for each fruit
      for (const { fruit, amount } of fruits) {
        await prisma.xpEvent.create({
          data: {
            userId: testUser1.id,
            fruit: fruit,
            amount: amount,
            reason: `Testing ${fruit}`,
          },
        });
      }

      // Verify all totals
      const totals = await prisma.xpTotals.findUnique({
        where: { userId: testUser1.id },
      });
      expect(totals.love).toBe(10);
      expect(totals.joy).toBe(20);
      expect(totals.peace).toBe(30);
      expect(totals.patience).toBe(40);
      expect(totals.kindness).toBe(50);
      expect(totals.goodness).toBe(60);
      expect(totals.faithfulness).toBe(70);
      expect(totals.gentleness).toBe(80);
      expect(totals.selfControl).toBe(90);
    });

    test('should accumulate multiple events for each fruit type', async () => {
      // Create multiple events for each fruit
      const events = [
        { fruit: 'LOVE', amount: 5 },
        { fruit: 'LOVE', amount: 10 },
        { fruit: 'LOVE', amount: 15 },
        { fruit: 'JOY', amount: 7 },
        { fruit: 'JOY', amount: 8 },
        { fruit: 'PEACE', amount: 12 },
        { fruit: 'PEACE', amount: 13 },
        { fruit: 'PEACE', amount: 14 },
        { fruit: 'PATIENCE', amount: 20 },
      ];

      for (const event of events) {
        await prisma.xpEvent.create({
          data: {
            userId: testUser1.id,
            fruit: event.fruit,
            amount: event.amount,
            reason: 'Accumulation test',
          },
        });
      }

      // Verify accumulated totals
      const totals = await prisma.xpTotals.findUnique({
        where: { userId: testUser1.id },
      });
      expect(totals.love).toBe(30); // 5 + 10 + 15
      expect(totals.joy).toBe(15); // 7 + 8
      expect(totals.peace).toBe(39); // 12 + 13 + 14
      expect(totals.patience).toBe(20);
    });
  });

  describe('Totals Match Event Sums', () => {
    test('should maintain accurate totals that match sum of all events', async () => {
      // Create various XP events
      const events = [
        { fruit: 'LOVE', amount: 10 },
        { fruit: 'LOVE', amount: 20 },
        { fruit: 'JOY', amount: 15 },
        { fruit: 'LOVE', amount: 5 },
        { fruit: 'JOY', amount: 25 },
        { fruit: 'PEACE', amount: 30 },
      ];

      for (const event of events) {
        await prisma.xpEvent.create({
          data: {
            userId: testUser1.id,
            fruit: event.fruit,
            amount: event.amount,
            reason: 'Sum verification test',
          },
        });
      }

      // Get totals from trigger
      const totals = await prisma.xpTotals.findUnique({
        where: { userId: testUser1.id },
      });

      // Calculate expected sums from events
      const loveEvents = await prisma.xpEvent.findMany({
        where: { userId: testUser1.id, fruit: 'LOVE' },
      });
      const joyEvents = await prisma.xpEvent.findMany({
        where: { userId: testUser1.id, fruit: 'JOY' },
      });
      const peaceEvents = await prisma.xpEvent.findMany({
        where: { userId: testUser1.id, fruit: 'PEACE' },
      });

      const expectedLove = loveEvents.reduce((sum, e) => sum + e.amount, 0);
      const expectedJoy = joyEvents.reduce((sum, e) => sum + e.amount, 0);
      const expectedPeace = peaceEvents.reduce((sum, e) => sum + e.amount, 0);

      // Verify totals match sums
      expect(totals.love).toBe(expectedLove);
      expect(totals.joy).toBe(expectedJoy);
      expect(totals.peace).toBe(expectedPeace);
    });

    test('should verify totals match with aggregation query', async () => {
      // Create random XP events
      const events = Array.from({ length: 20 }, (_, i) => ({
        fruit: ['LOVE', 'JOY', 'PEACE', 'PATIENCE'][i % 4],
        amount: (i + 1) * 5,
      }));

      for (const event of events) {
        await prisma.xpEvent.create({
          data: {
            userId: testUser1.id,
            fruit: event.fruit,
            amount: event.amount,
            reason: 'Aggregation test',
          },
        });
      }

      // Get totals from trigger
      const totals = await prisma.xpTotals.findUnique({
        where: { userId: testUser1.id },
      });

      // Calculate totals using aggregation
      const aggregatedTotals = await prisma.xpEvent.groupBy({
        by: ['fruit'],
        where: { userId: testUser1.id },
        _sum: { amount: true },
      });

      // Build expected values map
      const expected = {
        LOVE: 0,
        JOY: 0,
        PEACE: 0,
        PATIENCE: 0,
      };

      aggregatedTotals.forEach((group) => {
        expected[group.fruit] = group._sum.amount;
      });

      // Verify each fruit total matches
      expect(totals.love).toBe(expected.LOVE);
      expect(totals.joy).toBe(expected.JOY);
      expect(totals.peace).toBe(expected.PEACE);
      expect(totals.patience).toBe(expected.PATIENCE);
    });
  });

  describe('Multiple Users', () => {
    test('should maintain separate totals for different users', async () => {
      // User 1 earns LOVE
      await prisma.xpEvent.create({
        data: {
          userId: testUser1.id,
          fruit: 'LOVE',
          amount: 100,
          reason: 'User 1 love',
        },
      });

      // User 2 earns JOY
      await prisma.xpEvent.create({
        data: {
          userId: testUser2.id,
          fruit: 'JOY',
          amount: 200,
          reason: 'User 2 joy',
        },
      });

      // User 3 earns PEACE
      await prisma.xpEvent.create({
        data: {
          userId: testUser3.id,
          fruit: 'PEACE',
          amount: 300,
          reason: 'User 3 peace',
        },
      });

      // Verify each user has their own totals
      const totals1 = await prisma.xpTotals.findUnique({
        where: { userId: testUser1.id },
      });
      const totals2 = await prisma.xpTotals.findUnique({
        where: { userId: testUser2.id },
      });
      const totals3 = await prisma.xpTotals.findUnique({
        where: { userId: testUser3.id },
      });

      expect(totals1.love).toBe(100);
      expect(totals1.joy).toBe(0);
      expect(totals1.peace).toBe(0);

      expect(totals2.love).toBe(0);
      expect(totals2.joy).toBe(200);
      expect(totals2.peace).toBe(0);

      expect(totals3.love).toBe(0);
      expect(totals3.joy).toBe(0);
      expect(totals3.peace).toBe(300);
    });

    test('should handle multiple users earning the same fruit type', async () => {
      // All three users earn LOVE
      await prisma.xpEvent.create({
        data: {
          userId: testUser1.id,
          fruit: 'LOVE',
          amount: 10,
          reason: 'User 1',
        },
      });

      await prisma.xpEvent.create({
        data: {
          userId: testUser2.id,
          fruit: 'LOVE',
          amount: 20,
          reason: 'User 2',
        },
      });

      await prisma.xpEvent.create({
        data: {
          userId: testUser3.id,
          fruit: 'LOVE',
          amount: 30,
          reason: 'User 3',
        },
      });

      // Verify each user has correct totals
      const totals1 = await prisma.xpTotals.findUnique({
        where: { userId: testUser1.id },
      });
      const totals2 = await prisma.xpTotals.findUnique({
        where: { userId: testUser2.id },
      });
      const totals3 = await prisma.xpTotals.findUnique({
        where: { userId: testUser3.id },
      });

      expect(totals1.love).toBe(10);
      expect(totals2.love).toBe(20);
      expect(totals3.love).toBe(30);
    });
  });

  describe('Updated At Timestamp', () => {
    test('should set updated_at on first XP event', async () => {
      const beforeTime = new Date();

      await prisma.xpEvent.create({
        data: {
          userId: testUser1.id,
          fruit: 'LOVE',
          amount: 10,
          reason: 'Timestamp test',
        },
      });

      const afterTime = new Date();

      const totals = await prisma.xpTotals.findUnique({
        where: { userId: testUser1.id },
      });

      expect(totals.updatedAt).toBeDefined();
      expect(totals.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(totals.updatedAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    test('should update updated_at on subsequent XP events', async () => {
      // First event
      await prisma.xpEvent.create({
        data: {
          userId: testUser1.id,
          fruit: 'LOVE',
          amount: 10,
          reason: 'First event',
        },
      });

      const firstTotals = await prisma.xpTotals.findUnique({
        where: { userId: testUser1.id },
      });
      const firstUpdatedAt = firstTotals.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Second event
      await prisma.xpEvent.create({
        data: {
          userId: testUser1.id,
          fruit: 'LOVE',
          amount: 20,
          reason: 'Second event',
        },
      });

      const secondTotals = await prisma.xpTotals.findUnique({
        where: { userId: testUser1.id },
      });
      const secondUpdatedAt = secondTotals.updatedAt;

      // Verify timestamp was updated
      expect(secondUpdatedAt.getTime()).toBeGreaterThan(firstUpdatedAt.getTime());
    });
  });

  describe('Concurrent Operations', () => {
    test('should handle concurrent XP events for same user correctly', async () => {
      // Create multiple concurrent XP events
      const eventPromises = Array.from({ length: 10 }, (_, i) =>
        prisma.xpEvent.create({
          data: {
            userId: testUser1.id,
            fruit: 'LOVE',
            amount: 10,
            reason: `Concurrent event ${i}`,
          },
        })
      );

      await Promise.all(eventPromises);

      // Verify total is correct
      const totals = await prisma.xpTotals.findUnique({
        where: { userId: testUser1.id },
      });
      expect(totals.love).toBe(100); // 10 * 10
    });

    test('should handle concurrent events for different fruits', async () => {
      const fruits = ['LOVE', 'JOY', 'PEACE', 'PATIENCE', 'KINDNESS'];
      
      // Create concurrent events for different fruits
      const eventPromises = fruits.flatMap((fruit) =>
        Array.from({ length: 5 }, () =>
          prisma.xpEvent.create({
            data: {
              userId: testUser1.id,
              fruit: fruit,
              amount: 10,
              reason: `Concurrent ${fruit}`,
            },
          })
        )
      );

      await Promise.all(eventPromises);

      // Verify all totals are correct
      const totals = await prisma.xpTotals.findUnique({
        where: { userId: testUser1.id },
      });
      expect(totals.love).toBe(50); // 5 * 10
      expect(totals.joy).toBe(50);
      expect(totals.peace).toBe(50);
      expect(totals.patience).toBe(50);
      expect(totals.kindness).toBe(50);
    });

    test('should handle concurrent events from multiple users', async () => {
      const users = [testUser1, testUser2, testUser3];
      
      // Each user gets 10 events
      const eventPromises = users.flatMap((user) =>
        Array.from({ length: 10 }, () =>
          prisma.xpEvent.create({
            data: {
              userId: user.id,
              fruit: 'LOVE',
              amount: 5,
              reason: 'Multi-user concurrent',
            },
          })
        )
      );

      await Promise.all(eventPromises);

      // Verify each user has correct totals
      const totals1 = await prisma.xpTotals.findUnique({
        where: { userId: testUser1.id },
      });
      const totals2 = await prisma.xpTotals.findUnique({
        where: { userId: testUser2.id },
      });
      const totals3 = await prisma.xpTotals.findUnique({
        where: { userId: testUser3.id },
      });

      expect(totals1.love).toBe(50); // 10 * 5
      expect(totals2.love).toBe(50);
      expect(totals3.love).toBe(50);
    });
  });

  describe('Edge Cases', () => {
    test('should handle zero amount XP events', async () => {
      await prisma.xpEvent.create({
        data: {
          userId: testUser1.id,
          fruit: 'LOVE',
          amount: 0,
          reason: 'Zero amount test',
        },
      });

      const totals = await prisma.xpTotals.findUnique({
        where: { userId: testUser1.id },
      });
      expect(totals.love).toBe(0);
    });

    test('should handle large XP amounts', async () => {
      const largeAmount = 999999;

      await prisma.xpEvent.create({
        data: {
          userId: testUser1.id,
          fruit: 'LOVE',
          amount: largeAmount,
          reason: 'Large amount test',
        },
      });

      const totals = await prisma.xpTotals.findUnique({
        where: { userId: testUser1.id },
      });
      expect(totals.love).toBe(largeAmount);
    });

    test('should handle rapid successive events', async () => {
      // Insert events as fast as possible
      for (let i = 0; i < 100; i++) {
        await prisma.xpEvent.create({
          data: {
            userId: testUser1.id,
            fruit: 'LOVE',
            amount: 1,
            reason: `Rapid event ${i}`,
          },
        });
      }

      const totals = await prisma.xpTotals.findUnique({
        where: { userId: testUser1.id },
      });
      expect(totals.love).toBe(100);
    });

    test('should handle events with metadata field', async () => {
      await prisma.xpEvent.create({
        data: {
          userId: testUser1.id,
          fruit: 'LOVE',
          amount: 10,
          reason: 'Event with metadata',
          metadata: { source: 'test', category: 'manual' },
        },
      });

      const totals = await prisma.xpTotals.findUnique({
        where: { userId: testUser1.id },
      });
      expect(totals.love).toBe(10);
    });
  });

  describe('Idempotency & Consistency', () => {
    test('should produce same totals regardless of event insertion order', async () => {
      // Scenario 1: Insert events in one order
      await prisma.xpEvent.create({
        data: {
          userId: testUser1.id,
          fruit: 'LOVE',
          amount: 10,
          reason: 'First',
        },
      });
      await prisma.xpEvent.create({
        data: {
          userId: testUser1.id,
          fruit: 'JOY',
          amount: 20,
          reason: 'Second',
        },
      });
      await prisma.xpEvent.create({
        data: {
          userId: testUser1.id,
          fruit: 'LOVE',
          amount: 15,
          reason: 'Third',
        },
      });

      const totals1 = await prisma.xpTotals.findUnique({
        where: { userId: testUser1.id },
      });

      // Clean up and start fresh
      await prisma.xpEvent.deleteMany({
        where: { userId: testUser1.id },
      });
      await prisma.xpTotals.delete({
        where: { userId: testUser1.id },
      });

      // Scenario 2: Insert same events in different order
      await prisma.xpEvent.create({
        data: {
          userId: testUser1.id,
          fruit: 'JOY',
          amount: 20,
          reason: 'Second',
        },
      });
      await prisma.xpEvent.create({
        data: {
          userId: testUser1.id,
          fruit: 'LOVE',
          amount: 15,
          reason: 'Third',
        },
      });
      await prisma.xpEvent.create({
        data: {
          userId: testUser1.id,
          fruit: 'LOVE',
          amount: 10,
          reason: 'First',
        },
      });

      const totals2 = await prisma.xpTotals.findUnique({
        where: { userId: testUser1.id },
      });

      // Verify totals are the same
      expect(totals1.love).toBe(totals2.love);
      expect(totals1.joy).toBe(totals2.joy);
      expect(totals1.peace).toBe(totals2.peace);
    });

    test('should maintain consistency after many operations', async () => {
      // Perform a mix of operations
      const operations = [];
      
      for (let i = 0; i < 50; i++) {
        const fruit = ['LOVE', 'JOY', 'PEACE'][i % 3];
        const amount = (i % 10) + 1;
        
        operations.push(
          prisma.xpEvent.create({
            data: {
              userId: testUser1.id,
              fruit: fruit,
              amount: amount,
              reason: `Operation ${i}`,
            },
          })
        );
      }

      await Promise.all(operations);

      // Calculate expected totals
      const events = await prisma.xpEvent.findMany({
        where: { userId: testUser1.id },
      });

      const expectedTotals = {
        LOVE: 0,
        JOY: 0,
        PEACE: 0,
      };

      events.forEach((event) => {
        expectedTotals[event.fruit] += event.amount;
      });

      // Get actual totals
      const totals = await prisma.xpTotals.findUnique({
        where: { userId: testUser1.id },
      });

      // Verify consistency
      expect(totals.love).toBe(expectedTotals.LOVE);
      expect(totals.joy).toBe(expectedTotals.JOY);
      expect(totals.peace).toBe(expectedTotals.PEACE);
    });

    test('should be idempotent when recalculating from events', async () => {
      // Create some events
      await prisma.xpEvent.create({
        data: {
          userId: testUser1.id,
          fruit: 'LOVE',
          amount: 100,
          reason: 'Test',
        },
      });

      await prisma.xpEvent.create({
        data: {
          userId: testUser1.id,
          fruit: 'JOY',
          amount: 200,
          reason: 'Test',
        },
      });

      const totalsBeforeRecalc = await prisma.xpTotals.findUnique({
        where: { userId: testUser1.id },
      });

      // Manually recalculate (simulating the backfill logic)
      await prisma.$executeRaw`
        INSERT INTO xp_totals (
          user_id, love, joy, peace, patience, kindness, goodness, 
          faithfulness, gentleness, self_control, updated_at
        )
        SELECT 
          user_id,
          COALESCE(SUM(CASE WHEN fruit = 'LOVE' THEN amount ELSE 0 END), 0),
          COALESCE(SUM(CASE WHEN fruit = 'JOY' THEN amount ELSE 0 END), 0),
          COALESCE(SUM(CASE WHEN fruit = 'PEACE' THEN amount ELSE 0 END), 0),
          COALESCE(SUM(CASE WHEN fruit = 'PATIENCE' THEN amount ELSE 0 END), 0),
          COALESCE(SUM(CASE WHEN fruit = 'KINDNESS' THEN amount ELSE 0 END), 0),
          COALESCE(SUM(CASE WHEN fruit = 'GOODNESS' THEN amount ELSE 0 END), 0),
          COALESCE(SUM(CASE WHEN fruit = 'FAITHFULNESS' THEN amount ELSE 0 END), 0),
          COALESCE(SUM(CASE WHEN fruit = 'GENTLENESS' THEN amount ELSE 0 END), 0),
          COALESCE(SUM(CASE WHEN fruit = 'SELF_CONTROL' THEN amount ELSE 0 END), 0),
          NOW()
        FROM xp_events
        WHERE user_id = ${testUser1.id}::uuid
        GROUP BY user_id
        ON CONFLICT (user_id) DO UPDATE SET
          love = EXCLUDED.love,
          joy = EXCLUDED.joy,
          peace = EXCLUDED.peace,
          patience = EXCLUDED.patience,
          kindness = EXCLUDED.kindness,
          goodness = EXCLUDED.goodness,
          faithfulness = EXCLUDED.faithfulness,
          gentleness = EXCLUDED.gentleness,
          self_control = EXCLUDED.self_control,
          updated_at = EXCLUDED.updated_at
      `;

      const totalsAfterRecalc = await prisma.xpTotals.findUnique({
        where: { userId: testUser1.id },
      });

      // Verify totals are the same (ignoring updated_at)
      expect(totalsAfterRecalc.love).toBe(totalsBeforeRecalc.love);
      expect(totalsAfterRecalc.joy).toBe(totalsBeforeRecalc.joy);
      expect(totalsAfterRecalc.peace).toBe(totalsBeforeRecalc.peace);
      expect(totalsAfterRecalc.patience).toBe(totalsBeforeRecalc.patience);
      expect(totalsAfterRecalc.kindness).toBe(totalsBeforeRecalc.kindness);
      expect(totalsAfterRecalc.goodness).toBe(totalsBeforeRecalc.goodness);
      expect(totalsAfterRecalc.faithfulness).toBe(totalsBeforeRecalc.faithfulness);
      expect(totalsAfterRecalc.gentleness).toBe(totalsBeforeRecalc.gentleness);
      expect(totalsAfterRecalc.selfControl).toBe(totalsBeforeRecalc.selfControl);
    });
  });
});

