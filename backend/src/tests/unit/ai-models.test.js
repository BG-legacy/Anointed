/**
 * AI Models Tests
 *
 * Comprehensive tests for AIResponse, ScriptureRef, and AIUsage models including
 * relationships, enum constraints, cost tracking, and performance metrics.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prismaService from '../../services/prisma.js';
import { UserRepository } from '../../repositories/index.js';

describe('AI Models', () => {
  let prisma;
  let userRepo;
  let testUsers = [];
  let testAIResponses = [];
  let testScriptureRefs = [];
  let testAIUsage = [];

  beforeAll(async () => {
    // Connect to database
    await prismaService.connect();
    prisma = prismaService.client;
    userRepo = new UserRepository();

    // Create test users
    const userData1 = {
      email: 'ai-user1@example.com',
      passwordHash: 'hashedPassword123',
      displayName: 'AI User One',
      tz: 'America/New_York',
    };
    const userData2 = {
      email: 'ai-user2@example.com',
      passwordHash: 'hashedPassword456',
      displayName: 'AI User Two',
      tz: 'America/Los_Angeles',
    };

    testUsers.push(
      await userRepo.create(userData1),
      await userRepo.create(userData2)
    );
  });

  afterAll(async () => {
    // Clean up test data in reverse order of dependencies
    if (testScriptureRefs.length > 0) {
      await prisma.scriptureRef.deleteMany({
        where: {
          id: { in: testScriptureRefs.map(ref => ref.id) },
        },
      });
    }

    if (testAIResponses.length > 0) {
      await prisma.aIResponse.deleteMany({
        where: {
          id: { in: testAIResponses.map(response => response.id) },
        },
      });
    }

    if (testAIUsage.length > 0) {
      await prisma.aIUsage.deleteMany({
        where: {
          id: { in: testAIUsage.map(usage => usage.id) },
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

  describe('AIResponse Model', () => {
    it('should create a devotional AI response with user', async () => {
      const responseData = {
        userId: testUsers[0].id,
        kind: 'DEVOTIONAL',
        prompt: {
          topic: 'faith',
          bibleVersion: 'NIV',
          personalNote: 'Help me grow in faith'
        },
        output: 'Faith is the substance of things hoped for, the evidence of things not seen. Let us remember that our faith grows through trials and challenges...',
        allowed: true,
        flags: {
          flaggedContent: false,
          reviewRequired: false,
          contentCategory: 'devotional'
        },
        templateVersion: 'v1.2.0',
        latencyMs: 1250,
        costUsd: 0.0045,
      };

      const aiResponse = await prisma.aIResponse.create({
        data: responseData,
        include: {
          user: true,
        },
      });

      expect(aiResponse).toBeDefined();
      expect(aiResponse.id).toBeDefined();
      expect(aiResponse.userId).toBe(testUsers[0].id);
      expect(aiResponse.kind).toBe('DEVOTIONAL');
      expect(aiResponse.prompt).toEqual(responseData.prompt);
      expect(aiResponse.output).toBe(responseData.output);
      expect(aiResponse.allowed).toBe(true);
      expect(aiResponse.flags).toEqual(responseData.flags);
      expect(aiResponse.templateVersion).toBe('v1.2.0');
      expect(aiResponse.latencyMs).toBe(1250);
      expect(aiResponse.costUsd.toNumber()).toBe(0.0045);
      expect(aiResponse.user.displayName).toBe('AI User One');
      expect(aiResponse.createdAt).toBeDefined();

      testAIResponses.push(aiResponse);
    });

    it('should create a prayer AI response without user (anonymous)', async () => {
      const responseData = {
        userId: null, // Anonymous usage
        kind: 'PRAYER',
        prompt: {
          prayerType: 'healing',
          situation: 'illness',
          personalDetails: 'requesting healing for a family member'
        },
        output: 'Heavenly Father, we come before You asking for Your healing touch. We pray for comfort and restoration...',
        allowed: true,
        flags: null,
        templateVersion: 'v1.1.5',
        latencyMs: 890,
        costUsd: 0.0032,
      };

      const aiResponse = await prisma.aIResponse.create({
        data: responseData,
        include: {
          user: true,
        },
      });

      expect(aiResponse).toBeDefined();
      expect(aiResponse.userId).toBeNull();
      expect(aiResponse.kind).toBe('PRAYER');
      expect(aiResponse.user).toBeNull();
      expect(aiResponse.flags).toBeNull();
      expect(aiResponse.costUsd.toNumber()).toBe(0.0032);

      testAIResponses.push(aiResponse);
    });

    it('should create flagged AI response', async () => {
      const responseData = {
        userId: testUsers[1].id,
        kind: 'DEVOTIONAL',
        prompt: {
          topic: 'controversial topic',
          note: 'testing content moderation'
        },
        output: 'This content has been flagged for review...',
        allowed: false, // Flagged content not allowed
        flags: {
          flaggedContent: true,
          reviewRequired: true,
          flagReason: 'potentially controversial content',
          moderatorReview: 'pending'
        },
        templateVersion: 'v1.2.0',
        latencyMs: 2100,
        costUsd: 0.0067,
      };

      const aiResponse = await prisma.aIResponse.create({
        data: responseData,
      });

      expect(aiResponse.allowed).toBe(false);
      expect(aiResponse.flags.flaggedContent).toBe(true);
      expect(aiResponse.flags.reviewRequired).toBe(true);

      testAIResponses.push(aiResponse);
    });

    it('should validate AIResponseKind enum values', async () => {
      const validKinds = ['DEVOTIONAL', 'PRAYER'];
      
      for (const kind of validKinds) {
        const responseData = {
          userId: testUsers[0].id,
          kind,
          prompt: { test: `${kind} test` },
          output: `Test output for ${kind}`,
          latencyMs: 1000,
          costUsd: 0.001,
        };

        const aiResponse = await prisma.aIResponse.create({
          data: responseData,
        });

        expect(aiResponse.kind).toBe(kind);
        testAIResponses.push(aiResponse);
      }
    });

    it('should reject invalid AIResponseKind', async () => {
      const responseData = {
        userId: testUsers[0].id,
        kind: 'INVALID_KIND',
        prompt: { test: 'invalid test' },
        output: 'This should fail',
        latencyMs: 1000,
        costUsd: 0.001,
      };

      await expect(
        prisma.aIResponse.create({
          data: responseData,
        })
      ).rejects.toThrow();
    });

    it('should handle decimal precision for cost tracking', async () => {
      const responseData = {
        userId: testUsers[0].id,
        kind: 'PRAYER',
        prompt: { test: 'cost precision test' },
        output: 'Testing cost precision',
        latencyMs: 1500,
        costUsd: 0.1234, // Test 4 decimal places
      };

      const aiResponse = await prisma.aIResponse.create({
        data: responseData,
      });

      expect(aiResponse.costUsd.toNumber()).toBe(0.1234);
      testAIResponses.push(aiResponse);
    });

    it('should set user to null when user is deleted', async () => {
      // Create a temporary user and AI response
      const tempUser = await userRepo.create({
        email: `temp-ai-user-${Date.now()}@example.com`,
        passwordHash: 'hashedPassword',
        displayName: 'Temp AI User',
      });

      const aiResponse = await prisma.aIResponse.create({
        data: {
          userId: tempUser.id,
          kind: 'DEVOTIONAL',
          prompt: { test: 'user deletion test' },
          output: 'Testing user deletion behavior',
          latencyMs: 1000,
          costUsd: 0.001,
        },
      });

      // Delete the user
      await prisma.user.delete({
        where: { id: tempUser.id },
      });

      // Verify AI response still exists but userId is null
      const foundResponse = await prisma.aIResponse.findUnique({
        where: { id: aiResponse.id },
      });

      expect(foundResponse).toBeDefined();
      expect(foundResponse.userId).toBeNull();

      // Clean up
      await prisma.aIResponse.delete({
        where: { id: aiResponse.id },
      });
    });
  });

  describe('ScriptureRef Model', () => {
    it('should create scripture references for AI response', async () => {
      const aiResponse = testAIResponses[0]; // Use existing devotional response
      
      const scriptureData = [
        {
          aiResponseId: aiResponse.id,
          book: 'Hebrews',
          chapter: 11,
          verseStart: 1,
          verseEnd: 1,
        },
        {
          aiResponseId: aiResponse.id,
          book: 'Romans',
          chapter: 10,
          verseStart: 17,
          verseEnd: 17,
        },
        {
          aiResponseId: aiResponse.id,
          book: 'Matthew',
          chapter: 17,
          verseStart: 20,
          verseEnd: 21, // Multi-verse reference
        }
      ];

      const scriptureRefs = await Promise.all(
        scriptureData.map(data => 
          prisma.scriptureRef.create({
            data,
            include: {
              aiResponse: true,
            },
          })
        )
      );

      expect(scriptureRefs).toHaveLength(3);
      
      scriptureRefs.forEach((ref, index) => {
        expect(ref.aiResponseId).toBe(aiResponse.id);
        expect(ref.book).toBe(scriptureData[index].book);
        expect(ref.chapter).toBe(scriptureData[index].chapter);
        expect(ref.verseStart).toBe(scriptureData[index].verseStart);
        expect(ref.verseEnd).toBe(scriptureData[index].verseEnd);
        expect(ref.aiResponse.kind).toBe('DEVOTIONAL');
      });

      testScriptureRefs.push(...scriptureRefs);
    });

    it('should handle single verse reference', async () => {
      const aiResponse = testAIResponses[1]; // Use prayer response
      
      const scriptureData = {
        aiResponseId: aiResponse.id,
        book: 'John',
        chapter: 3,
        verseStart: 16,
        verseEnd: 16, // Same verse for single reference
      };

      const scriptureRef = await prisma.scriptureRef.create({
        data: scriptureData,
      });

      expect(scriptureRef.verseStart).toBe(scriptureRef.verseEnd);
      testScriptureRefs.push(scriptureRef);
    });

    it('should handle multi-verse passage reference', async () => {
      const aiResponse = testAIResponses[2]; // Use flagged response
      
      const scriptureData = {
        aiResponseId: aiResponse.id,
        book: 'Psalm',
        chapter: 23,
        verseStart: 1,
        verseEnd: 6, // Full psalm
      };

      const scriptureRef = await prisma.scriptureRef.create({
        data: scriptureData,
      });

      expect(scriptureRef.verseStart).toBeLessThan(scriptureRef.verseEnd);
      expect(scriptureRef.verseEnd - scriptureRef.verseStart).toBe(5);
      testScriptureRefs.push(scriptureRef);
    });

    it('should cascade delete when AI response is deleted', async () => {
      // Create a temporary AI response and scripture reference
      const tempResponse = await prisma.aIResponse.create({
        data: {
          userId: testUsers[0].id,
          kind: 'DEVOTIONAL',
          prompt: { test: 'cascade delete test' },
          output: 'Testing cascade delete',
          latencyMs: 1000,
          costUsd: 0.001,
        },
      });

      const scriptureRef = await prisma.scriptureRef.create({
        data: {
          aiResponseId: tempResponse.id,
          book: 'Genesis',
          chapter: 1,
          verseStart: 1,
          verseEnd: 1,
        },
      });

      // Delete the AI response
      await prisma.aIResponse.delete({
        where: { id: tempResponse.id },
      });

      // Verify scripture reference is also deleted
      const foundRef = await prisma.scriptureRef.findUnique({
        where: { id: scriptureRef.id },
      });

      expect(foundRef).toBeNull();
    });
  });

  describe('AIUsage Model', () => {
    it('should create AI usage record with user', async () => {
      const usageData = {
        userId: testUsers[0].id,
        provider: 'openai',
        model: 'gpt-4o',
        tokensIn: 150,
        tokensOut: 320,
        costUsd: 0.0087,
        latencyMs: 1450,
      };

      const aiUsage = await prisma.aIUsage.create({
        data: usageData,
        include: {
          user: true,
        },
      });

      expect(aiUsage).toBeDefined();
      expect(aiUsage.userId).toBe(testUsers[0].id);
      expect(aiUsage.provider).toBe('openai');
      expect(aiUsage.model).toBe('gpt-4o');
      expect(aiUsage.tokensIn).toBe(150);
      expect(aiUsage.tokensOut).toBe(320);
      expect(aiUsage.costUsd.toNumber()).toBe(0.0087);
      expect(aiUsage.latencyMs).toBe(1450);
      expect(aiUsage.user.displayName).toBe('AI User One');
      expect(aiUsage.createdAt).toBeDefined();

      testAIUsage.push(aiUsage);
    });

    it('should create anonymous AI usage record', async () => {
      const usageData = {
        userId: null, // Anonymous usage
        provider: 'anthropic',
        model: 'claude-3-sonnet',
        tokensIn: 200,
        tokensOut: 180,
        costUsd: 0.0054,
        latencyMs: 980,
      };

      const aiUsage = await prisma.aIUsage.create({
        data: usageData,
      });

      expect(aiUsage.userId).toBeNull();
      expect(aiUsage.provider).toBe('anthropic');
      expect(aiUsage.model).toBe('claude-3-sonnet');

      testAIUsage.push(aiUsage);
    });

    it('should track different AI providers and models', async () => {
      const providers = [
        {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          tokensIn: 100,
          tokensOut: 150,
          costUsd: 0.0021,
          latencyMs: 800,
        },
        {
          provider: 'anthropic',
          model: 'claude-3-haiku',
          tokensIn: 120,
          tokensOut: 200,
          costUsd: 0.0035,
          latencyMs: 1200,
        },
        {
          provider: 'google',
          model: 'gemini-pro',
          tokensIn: 80,
          tokensOut: 170,
          costUsd: 0.0018,
          latencyMs: 750,
        }
      ];

      const usageRecords = await Promise.all(
        providers.map(data => 
          prisma.aIUsage.create({
            data: {
              userId: testUsers[1].id,
              ...data,
            },
          })
        )
      );

      expect(usageRecords).toHaveLength(3);
      
      usageRecords.forEach((usage, index) => {
        expect(usage.provider).toBe(providers[index].provider);
        expect(usage.model).toBe(providers[index].model);
      });

      testAIUsage.push(...usageRecords);
    });

    it('should handle high precision cost calculations', async () => {
      const usageData = {
        userId: testUsers[0].id,
        provider: 'openai',
        model: 'gpt-4o',
        tokensIn: 1000,
        tokensOut: 2000,
        costUsd: 0.9999, // Maximum precision test
        latencyMs: 3000,
      };

      const aiUsage = await prisma.aIUsage.create({
        data: usageData,
      });

      expect(aiUsage.costUsd.toNumber()).toBe(0.9999);
      testAIUsage.push(aiUsage);
    });

    it('should set user to null when user is deleted', async () => {
      // Create a temporary user and usage record
      const tempUser = await userRepo.create({
        email: `temp-usage-user-${Date.now()}@example.com`,
        passwordHash: 'hashedPassword',
        displayName: 'Temp Usage User',
      });

      const aiUsage = await prisma.aIUsage.create({
        data: {
          userId: tempUser.id,
          provider: 'openai',
          model: 'gpt-4o',
          tokensIn: 50,
          tokensOut: 75,
          costUsd: 0.002,
          latencyMs: 600,
        },
      });

      // Delete the user
      await prisma.user.delete({
        where: { id: tempUser.id },
      });

      // Verify usage record still exists but userId is null
      const foundUsage = await prisma.aIUsage.findUnique({
        where: { id: aiUsage.id },
      });

      expect(foundUsage).toBeDefined();
      expect(foundUsage.userId).toBeNull();

      // Clean up
      await prisma.aIUsage.delete({
        where: { id: aiUsage.id },
      });
    });
  });

  describe('AI Models Relationships and Queries', () => {
    it('should query AI responses with scripture references', async () => {
      const aiResponses = await prisma.aIResponse.findMany({
        where: {
          userId: testUsers[0].id,
          kind: 'DEVOTIONAL',
        },
        include: {
          user: true,
          scriptureRefs: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      expect(aiResponses.length).toBeGreaterThan(0);
      
      const responseWithRefs = aiResponses.find(r => r.scriptureRefs.length > 0);
      if (responseWithRefs) {
        expect(responseWithRefs.user).toBeDefined();
        expect(responseWithRefs.scriptureRefs.length).toBeGreaterThan(0);
        
        responseWithRefs.scriptureRefs.forEach(ref => {
          expect(ref.book).toBeDefined();
          expect(ref.chapter).toBeGreaterThan(0);
          expect(ref.verseStart).toBeGreaterThan(0);
          expect(ref.verseEnd).toBeGreaterThanOrEqual(ref.verseStart);
        });
      }
    });

    it('should query AI usage by provider', async () => {
      const openaiUsage = await prisma.aIUsage.findMany({
        where: {
          provider: 'openai',
        },
        include: {
          user: true,
        },
      });

      const anthropicUsage = await prisma.aIUsage.findMany({
        where: {
          provider: 'anthropic',
        },
      });

      expect(openaiUsage.length).toBeGreaterThan(0);
      expect(anthropicUsage.length).toBeGreaterThan(0);

      openaiUsage.forEach(usage => {
        expect(usage.provider).toBe('openai');
      });
    });

    it('should calculate cost aggregations', async () => {
      // Get total cost for a user
      const userCosts = await prisma.aIUsage.aggregate({
        where: {
          userId: testUsers[0].id,
        },
        _sum: {
          costUsd: true,
          tokensIn: true,
          tokensOut: true,
        },
        _avg: {
          latencyMs: true,
        },
        _count: {
          id: true,
        },
      });

      expect(userCosts._sum.costUsd).toBeDefined();
      expect(userCosts._sum.tokensIn).toBeGreaterThan(0);
      expect(userCosts._sum.tokensOut).toBeGreaterThan(0);
      expect(userCosts._avg.latencyMs).toBeGreaterThan(0);
      expect(userCosts._count.id).toBeGreaterThan(0);
    });

    it('should query AI responses by allowed status', async () => {
      const allowedResponses = await prisma.aIResponse.findMany({
        where: {
          allowed: true,
        },
      });

      const flaggedResponses = await prisma.aIResponse.findMany({
        where: {
          allowed: false,
        },
      });

      expect(allowedResponses.length).toBeGreaterThan(0);
      expect(flaggedResponses.length).toBeGreaterThan(0);

      allowedResponses.forEach(response => {
        expect(response.allowed).toBe(true);
      });

      flaggedResponses.forEach(response => {
        expect(response.allowed).toBe(false);
      });
    });

    it('should query AI responses by kind with pagination', async () => {
      const devotionals = await prisma.aIResponse.findMany({
        where: {
          kind: 'DEVOTIONAL',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
        skip: 0,
      });

      const prayers = await prisma.aIResponse.findMany({
        where: {
          kind: 'PRAYER',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
        skip: 0,
      });

      expect(Array.isArray(devotionals)).toBe(true);
      expect(Array.isArray(prayers)).toBe(true);
      expect(devotionals.length).toBeLessThanOrEqual(5);
      expect(prayers.length).toBeLessThanOrEqual(5);

      devotionals.forEach(response => {
        expect(response.kind).toBe('DEVOTIONAL');
      });

      prayers.forEach(response => {
        expect(response.kind).toBe('PRAYER');
      });
    });

    it('should query scripture references by book', async () => {
      const hebrewsRefs = await prisma.scriptureRef.findMany({
        where: {
          book: 'Hebrews',
        },
        include: {
          aiResponse: true,
        },
      });

      const psalmsRefs = await prisma.scriptureRef.findMany({
        where: {
          book: 'Psalm',
        },
        include: {
          aiResponse: true,
        },
      });

      expect(hebrewsRefs.length).toBeGreaterThan(0);
      expect(psalmsRefs.length).toBeGreaterThan(0);

      hebrewsRefs.forEach(ref => {
        expect(ref.book).toBe('Hebrews');
        expect(ref.aiResponse).toBeDefined();
      });
    });

    it('should find all user AI activity', async () => {
      const user = testUsers[0];
      
      const userAIResponses = await prisma.aIResponse.findMany({
        where: { userId: user.id },
      });

      const userAIUsage = await prisma.aIUsage.findMany({
        where: { userId: user.id },
      });

      expect(userAIResponses.length).toBeGreaterThan(0);
      expect(userAIUsage.length).toBeGreaterThan(0);

      // Verify all records belong to the user
      userAIResponses.forEach(response => {
        expect(response.userId).toBe(user.id);
      });

      userAIUsage.forEach(usage => {
        expect(usage.userId).toBe(user.id);
      });
    });

    it('should find AI responses with specific template versions', async () => {
      const v12Responses = await prisma.aIResponse.findMany({
        where: {
          templateVersion: 'v1.2.0',
        },
      });

      const v11Responses = await prisma.aIResponse.findMany({
        where: {
          templateVersion: 'v1.1.5',
        },
      });

      expect(v12Responses.length).toBeGreaterThan(0);
      expect(v11Responses.length).toBeGreaterThan(0);

      v12Responses.forEach(response => {
        expect(response.templateVersion).toBe('v1.2.0');
      });
    });

    it('should query high-cost AI operations', async () => {
      const expensiveOperations = await prisma.aIUsage.findMany({
        where: {
          costUsd: {
            gte: 0.005, // Operations costing more than half a cent
          },
        },
        orderBy: {
          costUsd: 'desc',
        },
      });

      expect(expensiveOperations.length).toBeGreaterThan(0);
      
      expensiveOperations.forEach(usage => {
        expect(usage.costUsd.toNumber()).toBeGreaterThanOrEqual(0.005);
      });
    });

    it('should query slow AI responses', async () => {
      const slowResponses = await prisma.aIResponse.findMany({
        where: {
          latencyMs: {
            gt: 2000, // Responses taking more than 2 seconds
          },
        },
        orderBy: {
          latencyMs: 'desc',
        },
      });

      if (slowResponses.length > 0) {
        slowResponses.forEach(response => {
          expect(response.latencyMs).toBeGreaterThan(2000);
        });
      }
    });
  });
});

