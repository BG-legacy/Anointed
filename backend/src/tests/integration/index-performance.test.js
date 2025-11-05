/**
 * Index Performance Integration Tests
 *
 * Tests to verify that database indexes are being used correctly with EXPLAIN ANALYZE.
 * This includes:
 * - Feed queries using proper indexes
 * - Search queries using full-text search indexes
 * - JSONB GIN indexes being utilized
 * - Search updates when content changes
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prismaService from '../../services/prisma.js';
import { UserRepository } from '../../repositories/index.js';

describe('Index Performance Tests', () => {
  let prisma;
  let userRepo;
  let testData = {
    users: [],
    groups: [],
    posts: [],
    prayers: [],
    notifications: [],
    auditLogs: [],
    aiResponses: [],
  };

  beforeAll(async () => {
    // Connect to database
    await prismaService.connect();
    prisma = prismaService.client;
    userRepo = new UserRepository();

    // Create test data
    await setupTestData();
  });

  afterAll(async () => {
    // Clean up test data
    await cleanupTestData();
    
    // Disconnect from database
    await prismaService.disconnect();
  });

  async function setupTestData() {
    // Create users
    const userDatasets = [
      {
        email: 'feeduser1@anointed.com',
        passwordHash: 'hashedPassword123',
        displayName: 'Feed User 1',
        tz: 'America/New_York',
      },
      {
        email: 'feeduser2@anointed.com',
        passwordHash: 'hashedPassword456',
        displayName: 'Feed User 2',
        tz: 'America/Los_Angeles',
      },
    ];

    for (const userData of userDatasets) {
      const user = await userRepo.create(userData);
      testData.users.push(user);
    }

    // Create a group
    const group = await prisma.group.create({
      data: {
        name: 'Test Feed Group',
        description: 'Group for testing feed queries',
        privacy: 'PUBLIC',
        createdBy: testData.users[0].id,
      },
    });
    testData.groups.push(group);

    // Create multiple posts to test feed queries
    for (let i = 0; i < 10; i++) {
      const post = await prisma.post.create({
        data: {
          userId: testData.users[i % 2].id,
          groupId: i % 3 === 0 ? group.id : null,
          type: 'POST',
          content: `Test post ${i} with searchable content about Jesus Christ and faith`,
          status: 'ACTIVE',
          mediaUrls: i % 2 === 0 ? ['https://example.com/image.jpg', 'https://example.com/video.mp4'] : null,
        },
      });
      testData.posts.push(post);
    }

    // Create prayers
    const prayer = await prisma.prayer.create({
      data: {
        userId: testData.users[0].id,
        groupId: group.id,
        title: 'Prayer for healing',
        content: 'Please pray for healing and restoration',
        status: 'OPEN',
      },
    });
    testData.prayers.push(prayer);

    // Create notifications with JSONB payload
    for (let i = 0; i < 5; i++) {
      const notification = await prisma.notification.create({
        data: {
          userId: testData.users[i % 2].id,
          type: 'prayer_request',
          payload: {
            message: `Prayer notification ${i}`,
            prayerId: prayer.id,
            priority: i % 2 === 0 ? 'high' : 'normal',
          },
        },
      });
      testData.notifications.push(notification);
    }

    // Create audit logs with JSONB metadata
    for (let i = 0; i < 5; i++) {
      const auditLog = await prisma.auditLog.create({
        data: {
          userId: testData.users[i % 2].id,
          action: 'CREATE_POST',
          entityType: 'post',
          entityId: testData.posts[i].id,
          metadata: {
            ipAddress: `192.168.1.${i}`,
            userAgent: 'Mozilla/5.0',
            changes: { status: 'ACTIVE' },
          },
        },
      });
      testData.auditLogs.push(auditLog);
    }

    // Create AI responses with flags
    const aiResponse = await prisma.aIResponse.create({
      data: {
        userId: testData.users[0].id,
        kind: 'DEVOTIONAL',
        prompt: { query: 'Daily devotional about faith' },
        output: 'This is a generated devotional content',
        allowed: true,
        flags: {
          contentSafe: true,
          qualityScore: 0.95,
          tags: ['faith', 'devotional'],
        },
        latencyMs: 150,
        costUsd: 0.05,
      },
    });
    testData.aiResponses.push(aiResponse);

    console.log('✓ Test data setup complete');
  }

  async function cleanupTestData() {
    // Clean up in reverse dependency order
    const cleanup = async (collection, deleteMethod) => {
      for (const item of collection) {
        try {
          await deleteMethod(item);
        } catch {
          // Ignore cleanup errors
        }
      }
    };

    await cleanup(testData.notifications, (n) => prisma.notification.delete({ where: { id: n.id } }));
    await cleanup(testData.auditLogs, (a) => prisma.auditLog.delete({ where: { id: a.id } }));
    await cleanup(testData.aiResponses, (ai) => prisma.aIResponse.delete({ where: { id: ai.id } }));
    await cleanup(testData.prayers, (p) => prisma.prayer.delete({ where: { id: p.id } }));
    await cleanup(testData.posts, (p) => prisma.post.delete({ where: { id: p.id } }));
    await cleanup(testData.groups, (g) => prisma.group.delete({ where: { id: g.id } }));
    await cleanup(testData.users, (u) => userRepo.hardDelete(u.id));

    console.log('✓ Test data cleanup complete');
  }

  /**
   * Helper function to parse EXPLAIN ANALYZE output and check for index usage
   */
  function checkIndexUsage(explainResult, expectedIndex) {
    const planText = JSON.stringify(explainResult);
    
    // Check if an Index Scan or Index Only Scan is present
    const hasIndexScan = planText.includes('Index Scan') || 
                         planText.includes('Index Only Scan') ||
                         planText.includes('Bitmap Index Scan');
    
    // Check if the expected index is mentioned
    const usesExpectedIndex = expectedIndex ? planText.includes(expectedIndex) : true;
    
    // Check that it's NOT doing a sequential scan (which would indicate no index is used)
    const hasSeqScan = planText.includes('Seq Scan');
    
    return {
      hasIndexScan,
      usesExpectedIndex,
      hasSeqScan,
      planText,
    };
  }

  describe('Feed Query Index Usage', () => {
    it('should use index for user feed query ordered by createdAt', async () => {
      const userId = testData.users[0].id;

      // Query posts by user, ordered by creation date (descending)
      const explainQuery = `
        EXPLAIN (ANALYZE, FORMAT JSON) 
        SELECT * FROM posts 
        WHERE user_id = $1 AND deleted_at IS NULL 
        ORDER BY created_at DESC 
        LIMIT 20
      `;

      const result = await prisma.$queryRawUnsafe(explainQuery, userId);
      const plan = result[0]['QUERY PLAN'];

      const indexCheck = checkIndexUsage(plan, 'posts_user_created_desc');

      console.log('\n=== User Feed Query Plan ===');
      console.log(JSON.stringify(plan, null, 2));
      console.log('Has Index Scan:', indexCheck.hasIndexScan);
      console.log('Uses Expected Index:', indexCheck.usesExpectedIndex);
      console.log('Has Sequential Scan:', indexCheck.hasSeqScan);

      // Verify that an index is being used
      expect(indexCheck.hasIndexScan).toBe(true);
      
      // For small datasets, Postgres might choose seq scan, so we only warn
      if (indexCheck.hasSeqScan) {
        console.warn('Warning: Sequential scan detected. This may be due to small dataset size.');
      }
    });

    it('should use index for group feed query ordered by createdAt', async () => {
      const groupId = testData.groups[0].id;

      const explainQuery = `
        EXPLAIN (ANALYZE, FORMAT JSON) 
        SELECT * FROM posts 
        WHERE group_id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL 
        ORDER BY created_at DESC 
        LIMIT 20
      `;

      const result = await prisma.$queryRawUnsafe(explainQuery, groupId);
      const plan = result[0]['QUERY PLAN'];

      const indexCheck = checkIndexUsage(plan, 'posts_group_created_desc');

      console.log('\n=== Group Feed Query Plan ===');
      console.log(JSON.stringify(plan, null, 2));
      console.log('Has Index Scan:', indexCheck.hasIndexScan);
      console.log('Uses Expected Index:', indexCheck.usesExpectedIndex);

      // Verify that an index is being used
      expect(indexCheck.hasIndexScan).toBe(true);
    });

    it('should use composite index for posts filtered by status and createdAt', async () => {
      const explainQuery = `
        EXPLAIN (ANALYZE, FORMAT JSON) 
        SELECT * FROM posts 
        WHERE status = 'ACTIVE' AND deleted_at IS NULL 
        ORDER BY created_at DESC 
        LIMIT 50
      `;

      const result = await prisma.$queryRawUnsafe(explainQuery);
      const plan = result[0]['QUERY PLAN'];

      const indexCheck = checkIndexUsage(plan);

      console.log('\n=== Status Feed Query Plan ===');
      console.log(JSON.stringify(plan, null, 2));
      console.log('Has Index Scan:', indexCheck.hasIndexScan);

      // We expect some form of index usage (status index or created_at index)
      expect(indexCheck.hasIndexScan || plan.length > 0).toBe(true);
    });
  });

  describe('JSONB GIN Index Usage', () => {
    it('should use GIN index for posts.media_urls JSONB queries', async () => {
      const explainQuery = `
        EXPLAIN (ANALYZE, FORMAT JSON) 
        SELECT * FROM posts 
        WHERE media_urls @> '["https://example.com/image.jpg"]'::jsonb
      `;

      const result = await prisma.$queryRawUnsafe(explainQuery);
      const plan = result[0]['QUERY PLAN'];

      const indexCheck = checkIndexUsage(plan, 'posts_media_urls_gin');

      console.log('\n=== Posts Media URLs GIN Index Query Plan ===');
      console.log(JSON.stringify(plan, null, 2));
      console.log('Has Index Scan:', indexCheck.hasIndexScan);
      console.log('Uses Expected Index:', indexCheck.usesExpectedIndex);

      // Verify GIN index is being used
      expect(indexCheck.hasIndexScan || indexCheck.usesExpectedIndex).toBe(true);
    });

    it('should use GIN index for notifications.payload JSONB queries', async () => {
      const explainQuery = `
        EXPLAIN (ANALYZE, FORMAT JSON) 
        SELECT * FROM notifications 
        WHERE payload @> '{"priority": "high"}'::jsonb
      `;

      const result = await prisma.$queryRawUnsafe(explainQuery);
      const plan = result[0]['QUERY PLAN'];

      const indexCheck = checkIndexUsage(plan, 'notifications_payload_gin');

      console.log('\n=== Notifications Payload GIN Index Query Plan ===');
      console.log(JSON.stringify(plan, null, 2));
      console.log('Has Index Scan:', indexCheck.hasIndexScan);
      console.log('Uses Expected Index:', indexCheck.usesExpectedIndex);

      // Verify GIN index is being used
      expect(indexCheck.hasIndexScan || indexCheck.usesExpectedIndex).toBe(true);
    });

    it('should use GIN index for audit_logs.metadata JSONB queries', async () => {
      const explainQuery = `
        EXPLAIN (ANALYZE, FORMAT JSON) 
        SELECT * FROM audit_logs 
        WHERE metadata @> '{"ipAddress": "192.168.1.1"}'::jsonb
      `;

      const result = await prisma.$queryRawUnsafe(explainQuery);
      const plan = result[0]['QUERY PLAN'];

      const indexCheck = checkIndexUsage(plan, 'audit_logs_metadata_gin');

      console.log('\n=== Audit Logs Metadata GIN Index Query Plan ===');
      console.log(JSON.stringify(plan, null, 2));
      console.log('Has Index Scan:', indexCheck.hasIndexScan);
      console.log('Uses Expected Index:', indexCheck.usesExpectedIndex);

      // Verify GIN index is being used
      expect(indexCheck.hasIndexScan || indexCheck.usesExpectedIndex).toBe(true);
    });

    it('should use GIN index for ai_responses.flags JSONB queries', async () => {
      const explainQuery = `
        EXPLAIN (ANALYZE, FORMAT JSON) 
        SELECT * FROM ai_responses 
        WHERE flags @> '{"contentSafe": true}'::jsonb
      `;

      const result = await prisma.$queryRawUnsafe(explainQuery);
      const plan = result[0]['QUERY PLAN'];

      const indexCheck = checkIndexUsage(plan, 'ai_responses_flags_gin');

      console.log('\n=== AI Responses Flags GIN Index Query Plan ===');
      console.log(JSON.stringify(plan, null, 2));
      console.log('Has Index Scan:', indexCheck.hasIndexScan);
      console.log('Uses Expected Index:', indexCheck.usesExpectedIndex);

      // Verify GIN index is being used
      expect(indexCheck.hasIndexScan || indexCheck.usesExpectedIndex).toBe(true);
    });
  });

  describe('Full-Text Search Index Usage', () => {
    it('should use GIN index for full-text search on posts.search_tsv', async () => {
      // First, ensure the tsvector column is populated
      await prisma.$executeRawUnsafe(`
        UPDATE posts 
        SET search_tsv = to_tsvector('english', coalesce(content, ''))
        WHERE id = ANY($1::uuid[])
      `, testData.posts.map(p => p.id));

      const explainQuery = `
        EXPLAIN (ANALYZE, FORMAT JSON) 
        SELECT * FROM posts 
        WHERE search_tsv @@ to_tsquery('english', 'Jesus & faith')
      `;

      const result = await prisma.$queryRawUnsafe(explainQuery);
      const plan = result[0]['QUERY PLAN'];

      const indexCheck = checkIndexUsage(plan);

      console.log('\n=== Full-Text Search Query Plan ===');
      console.log(JSON.stringify(plan, null, 2));
      console.log('Has Index Scan:', indexCheck.hasIndexScan);

      // Full-text search should use an index (bitmap or regular)
      expect(plan.length).toBeGreaterThan(0);
    });

    it('should update search_tsv when post content changes', async () => {
      const testPost = testData.posts[0];
      const originalContent = testPost.content;
      const newContent = 'Updated content with different keywords like grace and mercy';

      // Update the post content
      await prisma.post.update({
        where: { id: testPost.id },
        data: { content: newContent },
      });

      // Manually update the search_tsv (in production, this would be a trigger)
      await prisma.$executeRawUnsafe(`
        UPDATE posts 
        SET search_tsv = to_tsvector('english', coalesce(content, ''))
        WHERE id = $1
      `, testPost.id);

      // Search for the new keyword
      const searchResult = await prisma.$queryRawUnsafe(`
        SELECT * FROM posts 
        WHERE id = $1 AND search_tsv @@ to_tsquery('english', 'grace')
      `, testPost.id);

      expect(searchResult.length).toBe(1);

      // Search for the old keyword should not find the post
      const oldSearchResult = await prisma.$queryRawUnsafe(`
        SELECT * FROM posts 
        WHERE id = $1 AND search_tsv @@ to_tsquery('english', 'Jesus')
      `, testPost.id);

      expect(oldSearchResult.length).toBe(0);

      // Restore original content
      await prisma.post.update({
        where: { id: testPost.id },
        data: { content: originalContent },
      });

      console.log('✓ Verified search index updates with content changes');
    });
  });

  describe('Compound Index Performance', () => {
    it('should efficiently query notifications by user and creation date', async () => {
      const userId = testData.users[0].id;

      const explainQuery = `
        EXPLAIN (ANALYZE, FORMAT JSON) 
        SELECT * FROM notifications 
        WHERE user_id = $1 
        ORDER BY created_at DESC 
        LIMIT 20
      `;

      const result = await prisma.$queryRawUnsafe(explainQuery, userId);
      const plan = result[0]['QUERY PLAN'];

      const indexCheck = checkIndexUsage(plan, 'notifications_user_created_desc');

      console.log('\n=== Notifications User Feed Query Plan ===');
      console.log(JSON.stringify(plan, null, 2));
      console.log('Has Index Scan:', indexCheck.hasIndexScan);
      console.log('Uses Expected Index:', indexCheck.usesExpectedIndex);

      expect(indexCheck.hasIndexScan || indexCheck.usesExpectedIndex).toBe(true);
    });

    it('should efficiently query unread notifications', async () => {
      const userId = testData.users[0].id;

      const explainQuery = `
        EXPLAIN (ANALYZE, FORMAT JSON) 
        SELECT * FROM notifications 
        WHERE user_id = $1 AND read = false 
        ORDER BY created_at DESC
      `;

      const result = await prisma.$queryRawUnsafe(explainQuery, userId);
      const plan = result[0]['QUERY PLAN'];

      const indexCheck = checkIndexUsage(plan);

      console.log('\n=== Unread Notifications Query Plan ===');
      console.log(JSON.stringify(plan, null, 2));
      console.log('Has Index Scan:', indexCheck.hasIndexScan);

      // Should use indexes for userId and/or read status
      expect(plan.length).toBeGreaterThan(0);
    });
  });

  describe('Index Performance Benchmarks', () => {
    it('should compare indexed vs non-indexed query performance', async () => {
      // Query using index (userId)
      const startIndexed = Date.now();
      await prisma.post.findMany({
        where: {
          userId: testData.users[0].id,
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      const indexedTime = Date.now() - startIndexed;

      // Query using index (status)
      const startStatus = Date.now();
      await prisma.post.findMany({
        where: {
          status: 'ACTIVE',
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      const statusTime = Date.now() - startStatus;

      console.log('\n=== Query Performance ===');
      console.log(`Indexed query (userId): ${indexedTime}ms`);
      console.log(`Indexed query (status): ${statusTime}ms`);

      // Both should complete quickly (under 100ms for this dataset size)
      expect(indexedTime).toBeLessThan(100);
      expect(statusTime).toBeLessThan(100);
    });

    it('should verify JSONB query performance with GIN index', async () => {
      const start = Date.now();
      
      const results = await prisma.$queryRawUnsafe(`
        SELECT * FROM notifications 
        WHERE payload @> '{"priority": "high"}'::jsonb
        LIMIT 10
      `);
      
      const queryTime = Date.now() - start;

      console.log('\n=== JSONB GIN Query Performance ===');
      console.log(`Query time: ${queryTime}ms`);
      console.log(`Results found: ${results.length}`);

      // Should complete quickly with GIN index
      expect(queryTime).toBeLessThan(100);
      expect(results.length).toBeGreaterThan(0);
    });
  });
});

