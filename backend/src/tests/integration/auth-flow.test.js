/**
 * Authentication Flow Integration Tests
 * 
 * Tests realistic authentication flows using all auth auxiliary models together.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prismaService from '../../services/prisma.js';
import { 
  UserRepository, 
  RefreshTokenRepository, 
  PasswordResetRepository, 
  MagicLinkRepository 
} from '../../repositories/index.js';

describe('Authentication Flow Integration', () => {
  let userRepo, refreshTokenRepo, passwordResetRepo, magicLinkRepo;
  let testUser;
  let createdItems = [];

  beforeAll(async () => {
    // Initialize repositories
    userRepo = new UserRepository();
    refreshTokenRepo = new RefreshTokenRepository();
    passwordResetRepo = new PasswordResetRepository();
    magicLinkRepo = new MagicLinkRepository();

    // Connect to database
    await prismaService.connect();

    // Create a test user
    const userData = {
      email: 'flow-test@example.com',
      passwordHash: 'hashedPassword123',
      displayName: 'Flow Test User',
      tz: 'America/New_York',
    };

    testUser = await userRepo.create(userData);
  });

  afterAll(async () => {
    // Clean up all created items
    for (const item of createdItems) {
      try {
        if (item.type === 'refreshToken') {
          await refreshTokenRepo.delete(item.id);
        } else if (item.type === 'passwordReset') {
          await passwordResetRepo.delete(item.id);
        } else if (item.type === 'magicLink') {
          await magicLinkRepo.delete(item.id);
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    if (testUser) {
      try {
        await userRepo.hardDelete(testUser.id);
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    // Disconnect from database
    await prismaService.disconnect();
  });

  describe('Complete User Authentication Flow', () => {
    it('should handle complete signup flow with email verification', async () => {
      // Step 1: User signs up, get email verification magic link
      const verificationLinkData = {
        userId: testUser.id,
        tokenHash: 'email-verification-hash',
        purpose: 'email_verification',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      };

      const verificationLink = await magicLinkRepo.create(verificationLinkData);
      createdItems.push({ type: 'magicLink', id: verificationLink.id });

      expect(verificationLink.purpose).toBe('email_verification');
      expect(verificationLink.usedAt).toBeNull();

      // Step 2: User clicks verification link
      const validLink = await magicLinkRepo.findValidTokenByPurpose(
        verificationLink.tokenHash, 
        'email_verification'
      );
      expect(validLink).toBeTruthy();

      // Mark link as used (email verified)
      await magicLinkRepo.markAsUsed(verificationLink.id);

      // Step 3: User logs in and gets refresh token
      const refreshTokenData = {
        userId: testUser.id,
        tokenHash: 'login-refresh-token',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      };

      const refreshToken = await refreshTokenRepo.create(refreshTokenData);
      createdItems.push({ type: 'refreshToken', id: refreshToken.id });

      expect(refreshToken.revokedAt).toBeNull();
      expect(refreshToken.userId).toBe(testUser.id);
    });

    it('should handle password reset flow', async () => {
      // Step 1: User requests password reset
      const resetTokenData = {
        userId: testUser.id,
        tokenHash: 'password-reset-hash',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      };

      const resetToken = await passwordResetRepo.create(resetTokenData);
      createdItems.push({ type: 'passwordReset', id: resetToken.id });

      expect(resetToken.usedAt).toBeNull();

      // Step 2: User clicks reset link - validate token
      const validReset = await passwordResetRepo.findValidToken(resetToken.tokenHash);
      expect(validReset).toBeTruthy();
      expect(validReset.userId).toBe(testUser.id);

      // Step 3: User submits new password - mark token as used
      await passwordResetRepo.markAsUsed(resetToken.id);

      // Step 4: Invalidate all existing refresh tokens (force re-login)
      const revokeResult = await refreshTokenRepo.revokeAllForUser(testUser.id);
      expect(revokeResult.count).toBeGreaterThan(0);

      // Verify no valid refresh tokens remain
      const validTokens = await refreshTokenRepo.findValidTokensByUserId(testUser.id);
      expect(validTokens).toHaveLength(0);

      // Step 5: User logs in with new password, gets new refresh token
      const newRefreshTokenData = {
        userId: testUser.id,
        tokenHash: 'new-refresh-token-after-reset',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      const newRefreshToken = await refreshTokenRepo.create(newRefreshTokenData);
      createdItems.push({ type: 'refreshToken', id: newRefreshToken.id });

      expect(newRefreshToken.revokedAt).toBeNull();
    });

    it('should handle magic link login flow', async () => {
      // Step 1: User requests magic link login
      const magicLinkData = {
        userId: testUser.id,
        tokenHash: 'magic-login-hash',
        purpose: 'login',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      };

      const magicLink = await magicLinkRepo.create(magicLinkData);
      createdItems.push({ type: 'magicLink', id: magicLink.id });

      // Step 2: User clicks magic link - validate and use
      const validMagicLink = await magicLinkRepo.findValidTokenByPurpose(
        magicLink.tokenHash, 
        'login'
      );
      expect(validMagicLink).toBeTruthy();

      // Mark as used
      await magicLinkRepo.markAsUsed(magicLink.id);

      // Step 3: Create refresh token for the session
      const refreshTokenData = {
        userId: testUser.id,
        tokenHash: 'magic-login-refresh-token',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      const refreshToken = await refreshTokenRepo.create(refreshTokenData);
      createdItems.push({ type: 'refreshToken', id: refreshToken.id });

      expect(refreshToken.userId).toBe(testUser.id);
    });

    it('should handle logout flow', async () => {
      // Get current valid refresh tokens
      const validTokensBefore = await refreshTokenRepo.findValidTokensByUserId(testUser.id);
      expect(validTokensBefore.length).toBeGreaterThan(0);

      // Step 1: User logs out from specific device (revoke specific token)
      const tokenToRevoke = validTokensBefore[0];
      await refreshTokenRepo.revoke(tokenToRevoke.id);

      // Verify that specific token is revoked
      const revokedToken = await refreshTokenRepo.findById(tokenToRevoke.id);
      expect(revokedToken.revokedAt).toBeTruthy();

      // Step 2: User logs out from all devices
      await refreshTokenRepo.revokeAllForUser(testUser.id);

      // Verify no valid tokens remain
      const validTokensAfter = await refreshTokenRepo.findValidTokensByUserId(testUser.id);
      expect(validTokensAfter).toHaveLength(0);
    });

    it('should handle security scenarios', async () => {
      // Scenario: User has suspicious activity, invalidate all auth methods

      // Create various auth tokens
      const refreshTokenData = {
        userId: testUser.id,
        tokenHash: 'security-refresh-token',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      const passwordResetData = {
        userId: testUser.id,
        tokenHash: 'security-password-reset',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      };

      const magicLinkData = {
        userId: testUser.id,
        tokenHash: 'security-magic-link',
        purpose: 'login',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      };

      const refreshToken = await refreshTokenRepo.create(refreshTokenData);
      const passwordReset = await passwordResetRepo.create(passwordResetData);
      const magicLink = await magicLinkRepo.create(magicLinkData);

      createdItems.push(
        { type: 'refreshToken', id: refreshToken.id },
        { type: 'passwordReset', id: passwordReset.id },
        { type: 'magicLink', id: magicLink.id }
      );

      // Verify tokens are valid
      expect(await refreshTokenRepo.findValidToken(refreshToken.tokenHash)).toBeTruthy();
      expect(await passwordResetRepo.findValidToken(passwordReset.tokenHash)).toBeTruthy();
      expect(await magicLinkRepo.findValidToken(magicLink.tokenHash)).toBeTruthy();

      // Security response: Invalidate everything
      await Promise.all([
        refreshTokenRepo.revokeAllForUser(testUser.id),
        passwordResetRepo.invalidateAllForUser(testUser.id),
        magicLinkRepo.invalidateAllForUser(testUser.id),
      ]);

      // Verify all tokens are invalid
      expect(await refreshTokenRepo.findValidToken(refreshToken.tokenHash)).toBeNull();
      expect(await passwordResetRepo.findValidToken(passwordReset.tokenHash)).toBeNull();
      expect(await magicLinkRepo.findValidToken(magicLink.tokenHash)).toBeNull();
    });

    it('should handle rate limiting scenarios', async () => {
      // Scenario: Rapid password reset requests
      const resetPromises = [];
      for (let i = 0; i < 3; i++) {
        const resetData = {
          userId: testUser.id,
          tokenHash: `rapid-reset-${i}`,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        };
        resetPromises.push(passwordResetRepo.create(resetData));
      }

      const resets = await Promise.all(resetPromises);
      createdItems.push(...resets.map(reset => ({ type: 'passwordReset', id: reset.id })));

      // Check recent attempts
      const recentAttempts = await passwordResetRepo.getRecentAttemptsCount(testUser.id, 1);
      expect(recentAttempts).toBe(3);

      // Scenario: Rapid magic link requests
      const linkPromises = [];
      for (let i = 0; i < 2; i++) {
        const linkData = {
          userId: testUser.id,
          tokenHash: `rapid-link-${i}`,
          purpose: 'login',
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        };
        linkPromises.push(magicLinkRepo.create(linkData));
      }

      const links = await Promise.all(linkPromises);
      createdItems.push(...links.map(link => ({ type: 'magicLink', id: link.id })));

      // Check recent magic link attempts
      const recentLinkAttempts = await magicLinkRepo.getRecentAttemptsCount(testUser.id, 'login', 1);
      expect(recentLinkAttempts).toBe(2);
    });

    it('should handle token cleanup operations', async () => {
      // Create expired tokens
      const expiredRefreshData = {
        userId: testUser.id,
        tokenHash: 'expired-refresh-cleanup',
        expiresAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      };

      const expiredResetData = {
        userId: testUser.id,
        tokenHash: 'expired-reset-cleanup',
        expiresAt: new Date(Date.now() - 60 * 60 * 1000),
      };

      const expiredLinkData = {
        userId: testUser.id,
        tokenHash: 'expired-link-cleanup',
        purpose: 'login',
        expiresAt: new Date(Date.now() - 60 * 60 * 1000),
      };

      const expiredRefresh = await refreshTokenRepo.create(expiredRefreshData);
      const expiredReset = await passwordResetRepo.create(expiredResetData);
      const expiredLink = await magicLinkRepo.create(expiredLinkData);

      // Don't add to cleanup list since we'll delete them via cleanup operations

      // Verify they exist but are not valid
      expect(await refreshTokenRepo.findById(expiredRefresh.id)).toBeTruthy();
      expect(await refreshTokenRepo.findValidToken(expiredRefresh.tokenHash)).toBeNull();

      // Run cleanup operations
      const refreshCleanup = await refreshTokenRepo.deleteExpired();
      const resetCleanup = await passwordResetRepo.deleteExpired();
      const linkCleanup = await magicLinkRepo.deleteExpired();

      expect(refreshCleanup.count).toBeGreaterThan(0);
      expect(resetCleanup.count).toBeGreaterThan(0);
      expect(linkCleanup.count).toBeGreaterThan(0);

      // Verify expired tokens are gone
      expect(await refreshTokenRepo.findById(expiredRefresh.id)).toBeNull();
      expect(await passwordResetRepo.findById(expiredReset.id)).toBeNull();
      expect(await magicLinkRepo.findById(expiredLink.id)).toBeNull();
    });

    it('should handle concurrent operations safely', async () => {
      // Scenario: Multiple operations on same user simultaneously
      const concurrentOperations = [
        // Create refresh tokens
        refreshTokenRepo.create({
          userId: testUser.id,
          tokenHash: 'concurrent-refresh-1',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        }),
        refreshTokenRepo.create({
          userId: testUser.id,
          tokenHash: 'concurrent-refresh-2',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        }),
        // Create password reset
        passwordResetRepo.create({
          userId: testUser.id,
          tokenHash: 'concurrent-reset',
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        }),
        // Create magic link
        magicLinkRepo.create({
          userId: testUser.id,
          tokenHash: 'concurrent-magic',
          purpose: 'login',
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        }),
      ];

      const results = await Promise.all(concurrentOperations);
      
      // Add to cleanup
      createdItems.push(
        { type: 'refreshToken', id: results[0].id },
        { type: 'refreshToken', id: results[1].id },
        { type: 'passwordReset', id: results[2].id },
        { type: 'magicLink', id: results[3].id }
      );

      // Verify all operations succeeded
      expect(results).toHaveLength(4);
      results.forEach(result => {
        expect(result).toHaveProperty('id');
        expect(result.userId).toBe(testUser.id);
      });

      // Perform concurrent queries
      const concurrentQueries = await Promise.all([
        refreshTokenRepo.findValidTokensByUserId(testUser.id),
        passwordResetRepo.findByUserId(testUser.id, true),
        magicLinkRepo.findByUserId(testUser.id, true),
        refreshTokenRepo.countForUser(testUser.id, true),
        passwordResetRepo.countForUser(testUser.id, true),
        magicLinkRepo.countForUser(testUser.id, true),
      ]);

      // Verify query results
      expect(concurrentQueries[0].length).toBeGreaterThan(0); // refresh tokens
      expect(concurrentQueries[1].length).toBeGreaterThan(0); // password resets
      expect(concurrentQueries[2].length).toBeGreaterThan(0); // magic links
      expect(concurrentQueries[3]).toBeGreaterThan(0); // refresh count
      expect(concurrentQueries[4]).toBeGreaterThan(0); // reset count
      expect(concurrentQueries[5]).toBeGreaterThan(0); // link count
    });
  });
});
