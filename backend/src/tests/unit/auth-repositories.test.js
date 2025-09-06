/**
 * Authentication Repositories Tests
 * 
 * Comprehensive tests for RefreshToken, PasswordReset, and MagicLink repositories.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import prismaService from '../../services/prisma.js';
import { 
  UserRepository, 
  RefreshTokenRepository, 
  PasswordResetRepository, 
  MagicLinkRepository 
} from '../../repositories/index.js';

describe('Authentication Repositories', () => {
  let userRepo, refreshTokenRepo, passwordResetRepo, magicLinkRepo;
  let testUser;
  let createdTokens = [];
  let createdResets = [];
  let createdLinks = [];

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
      email: 'auth-test@example.com',
      passwordHash: 'hashedPassword123',
      displayName: 'Auth Test User',
      tz: 'America/New_York',
    };

    testUser = await userRepo.create(userData);
  });

  afterAll(async () => {
    // Clean up test data
    for (const token of createdTokens) {
      try {
        await refreshTokenRepo.delete(token.id);
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    for (const reset of createdResets) {
      try {
        await passwordResetRepo.delete(reset.id);
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    for (const link of createdLinks) {
      try {
        await magicLinkRepo.delete(link.id);
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

  describe('RefreshToken Repository', () => {
    it('should create, find, and manage a refresh token', async () => {
      const tokenData = {
        userId: testUser.id,
        tokenHash: 'hashed-refresh-token-123',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      };

      // Create token
      const testToken = await refreshTokenRepo.create(tokenData);
      createdTokens.push(testToken);

      expect(testToken).toHaveProperty('id');
      expect(testToken.userId).toBe(testUser.id);
      expect(testToken.tokenHash).toBe(tokenData.tokenHash);
      expect(testToken.revokedAt).toBeNull();
      expect(testToken.user).toHaveProperty('email', testUser.email);

      // Find by ID
      const foundToken = await refreshTokenRepo.findById(testToken.id);
      expect(foundToken).toBeTruthy();
      expect(foundToken.id).toBe(testToken.id);
      expect(foundToken.tokenHash).toBe(testToken.tokenHash);

      // Find by token hash
      const foundByHash = await refreshTokenRepo.findByTokenHash(testToken.tokenHash);
      expect(foundByHash).toBeTruthy();
      expect(foundByHash.id).toBe(testToken.id);
      expect(foundByHash.userId).toBe(testUser.id);

      // Find valid tokens by user ID
      const validTokens = await refreshTokenRepo.findValidTokensByUserId(testUser.id);
      expect(validTokens.length).toBeGreaterThanOrEqual(1);
      const ourToken = validTokens.find(token => token.id === testToken.id);
      expect(ourToken).toBeTruthy();
      expect(ourToken.revokedAt).toBeNull();

      // Validate token
      const validToken = await refreshTokenRepo.findValidToken(testToken.tokenHash);
      expect(validToken).toBeTruthy();
      expect(validToken.id).toBe(testToken.id);
      expect(validToken.revokedAt).toBeNull();

      // Revoke token
      const revokedToken = await refreshTokenRepo.revoke(testToken.id);
      expect(revokedToken.revokedAt).toBeTruthy();
      expect(revokedToken.revokedAt).toBeInstanceOf(Date);

      // Should not find as valid anymore
      const invalidToken = await refreshTokenRepo.findValidToken(testToken.tokenHash);
      expect(invalidToken).toBeNull();

      // Count tokens
      const totalCount = await refreshTokenRepo.countForUser(testUser.id);
      const validCount = await refreshTokenRepo.countForUser(testUser.id, true);
      expect(totalCount).toBeGreaterThanOrEqual(1);
      expect(validCount).toBeLessThan(totalCount); // Should have fewer valid than total after revocation
    });

    it('should create and revoke all tokens for user', async () => {
      // Create multiple tokens
      const tokenData1 = {
        userId: testUser.id,
        tokenHash: 'hashed-token-1',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };
      const tokenData2 = {
        userId: testUser.id,
        tokenHash: 'hashed-token-2',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      const token1 = await refreshTokenRepo.create(tokenData1);
      const token2 = await refreshTokenRepo.create(tokenData2);
      createdTokens.push(token1, token2);

      // Verify they're valid
      let validTokens = await refreshTokenRepo.findValidTokensByUserId(testUser.id);
      expect(validTokens.length).toBeGreaterThanOrEqual(2);

      // Revoke all
      const result = await refreshTokenRepo.revokeAllForUser(testUser.id);
      expect(result.count).toBeGreaterThanOrEqual(2);

      // Verify none are valid
      validTokens = await refreshTokenRepo.findValidTokensByUserId(testUser.id);
      expect(validTokens).toHaveLength(0);
    });

    it('should handle expired tokens', async () => {
      // Create an expired token
      const expiredTokenData = {
        userId: testUser.id,
        tokenHash: 'expired-token-hash',
        expiresAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      };

      const expiredToken = await refreshTokenRepo.create(expiredTokenData);
      createdTokens.push(expiredToken);

      // Should not find as valid
      const validToken = await refreshTokenRepo.findValidToken(expiredToken.tokenHash);
      expect(validToken).toBeNull();

      // But should find in general search
      const foundToken = await refreshTokenRepo.findByTokenHash(expiredToken.tokenHash);
      expect(foundToken).toBeTruthy();
    });
  });

  describe('PasswordReset Repository', () => {
    it('should create, find, and manage a password reset token', async () => {
      const resetData = {
        userId: testUser.id,
        tokenHash: 'hashed-reset-token-123',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      };

      // Create reset
      const testReset = await passwordResetRepo.create(resetData);
      createdResets.push(testReset);

      expect(testReset).toHaveProperty('id');
      expect(testReset.userId).toBe(testUser.id);
      expect(testReset.tokenHash).toBe(resetData.tokenHash);
      expect(testReset.usedAt).toBeNull();
      expect(testReset.user).toHaveProperty('email', testUser.email);

      // Find by token hash
      const foundReset = await passwordResetRepo.findByTokenHash(testReset.tokenHash);
      expect(foundReset).toBeTruthy();
      expect(foundReset.id).toBe(testReset.id);
      expect(foundReset.userId).toBe(testUser.id);

      // Find valid token
      const validReset = await passwordResetRepo.findValidToken(testReset.tokenHash);
      expect(validReset).toBeTruthy();
      expect(validReset.id).toBe(testReset.id);
      expect(validReset.usedAt).toBeNull();

      // Find by user ID
      const userResets = await passwordResetRepo.findByUserId(testUser.id);
      const validUserResets = await passwordResetRepo.findByUserId(testUser.id, true);
      expect(userResets.length).toBeGreaterThanOrEqual(1);
      expect(validUserResets.length).toBeGreaterThanOrEqual(1);
      const ourReset = userResets.find(reset => reset.id === testReset.id);
      expect(ourReset).toBeTruthy();

      // Mark as used
      const usedReset = await passwordResetRepo.markAsUsed(testReset.id);
      expect(usedReset.usedAt).toBeTruthy();
      expect(usedReset.usedAt).toBeInstanceOf(Date);

      // Should not find as valid anymore
      const invalidReset = await passwordResetRepo.findValidToken(testReset.tokenHash);
      expect(invalidReset).toBeNull();

      // Count resets
      const totalCount = await passwordResetRepo.countForUser(testUser.id);
      const validCount = await passwordResetRepo.countForUser(testUser.id, true);
      expect(totalCount).toBeGreaterThanOrEqual(1);
      expect(validCount).toBeLessThan(totalCount); // Should have fewer valid than total after use
    });

    it('should track recent attempts', async () => {
      // Create multiple resets
      const resetData1 = {
        userId: testUser.id,
        tokenHash: 'recent-reset-1',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      };
      const resetData2 = {
        userId: testUser.id,
        tokenHash: 'recent-reset-2',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      };

      const reset1 = await passwordResetRepo.create(resetData1);
      const reset2 = await passwordResetRepo.create(resetData2);
      createdResets.push(reset1, reset2);

      const recentCount = await passwordResetRepo.getRecentAttemptsCount(testUser.id, 1);
      expect(recentCount).toBeGreaterThanOrEqual(2);
    });

    it('should invalidate all password resets for user', async () => {
      // Create a new valid reset
      const newResetData = {
        userId: testUser.id,
        tokenHash: 'new-reset-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      };

      const newReset = await passwordResetRepo.create(newResetData);
      createdResets.push(newReset);

      // Verify it's valid
      let validResets = await passwordResetRepo.findByUserId(testUser.id, true);
      expect(validResets.length).toBeGreaterThan(0);

      // Invalidate all
      const result = await passwordResetRepo.invalidateAllForUser(testUser.id);
      expect(result.count).toBeGreaterThan(0);

      // Verify none are valid
      validResets = await passwordResetRepo.findByUserId(testUser.id, true);
      expect(validResets).toHaveLength(0);
    });

    it('should handle expired password reset tokens', async () => {
      // Create an expired reset
      const expiredResetData = {
        userId: testUser.id,
        tokenHash: 'expired-reset-hash',
        expiresAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      };

      const expiredReset = await passwordResetRepo.create(expiredResetData);
      createdResets.push(expiredReset);

      // Should not find as valid
      const validReset = await passwordResetRepo.findValidToken(expiredReset.tokenHash);
      expect(validReset).toBeNull();

      // But should find in general search
      const foundReset = await passwordResetRepo.findByTokenHash(expiredReset.tokenHash);
      expect(foundReset).toBeTruthy();
    });
  });

  describe('MagicLink Repository', () => {
    it('should create, find, and manage a magic link', async () => {
      const linkData = {
        userId: testUser.id,
        tokenHash: 'hashed-magic-link-123',
        purpose: 'login',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
      };

      // Create link
      const testLink = await magicLinkRepo.create(linkData);
      createdLinks.push(testLink);

      expect(testLink).toHaveProperty('id');
      expect(testLink.userId).toBe(testUser.id);
      expect(testLink.tokenHash).toBe(linkData.tokenHash);
      expect(testLink.purpose).toBe('login');
      expect(testLink.usedAt).toBeNull();
      expect(testLink.user).toHaveProperty('email', testUser.email);

      // Find by token hash
      const foundLink = await magicLinkRepo.findByTokenHash(testLink.tokenHash);
      expect(foundLink).toBeTruthy();
      expect(foundLink.id).toBe(testLink.id);
      expect(foundLink.purpose).toBe('login');

      // Find valid link
      const validLink = await magicLinkRepo.findValidToken(testLink.tokenHash);
      expect(validLink).toBeTruthy();
      expect(validLink.id).toBe(testLink.id);
      expect(validLink.usedAt).toBeNull();

      // Find valid link by purpose
      const validByPurpose = await magicLinkRepo.findValidTokenByPurpose(testLink.tokenHash, 'login');
      expect(validByPurpose).toBeTruthy();
      expect(validByPurpose.id).toBe(testLink.id);
      expect(validByPurpose.purpose).toBe('login');

      // Should not find with wrong purpose
      const wrongPurpose = await magicLinkRepo.findValidTokenByPurpose(testLink.tokenHash, 'signup');
      expect(wrongPurpose).toBeNull();

      // Find by user ID
      const userLinks = await magicLinkRepo.findByUserId(testUser.id);
      const validUserLinks = await magicLinkRepo.findByUserId(testUser.id, true);
      const loginLinks = await magicLinkRepo.findByUserId(testUser.id, true, 'login');

      expect(userLinks.length).toBeGreaterThanOrEqual(1);
      expect(validUserLinks.length).toBeGreaterThanOrEqual(1);
      expect(loginLinks.length).toBeGreaterThanOrEqual(1);
      const ourLink = userLinks.find(link => link.id === testLink.id);
      expect(ourLink).toBeTruthy();

      // Find by purpose
      const allLoginLinks = await magicLinkRepo.findByPurpose('login');
      const validLoginLinks = await magicLinkRepo.findByPurpose('login', true);
      expect(allLoginLinks.length).toBeGreaterThan(0);
      expect(validLoginLinks.length).toBeGreaterThan(0);
      
      const ourLinkByPurpose = allLoginLinks.find(link => link.id === testLink.id);
      expect(ourLinkByPurpose).toBeTruthy();

      // Mark as used
      const usedLink = await magicLinkRepo.markAsUsed(testLink.id);
      expect(usedLink.usedAt).toBeTruthy();
      expect(usedLink.usedAt).toBeInstanceOf(Date);

      // Should not find as valid anymore
      const invalidLink = await magicLinkRepo.findValidToken(testLink.tokenHash);
      expect(invalidLink).toBeNull();

      // Count links
      const totalCount = await magicLinkRepo.countForUser(testUser.id);
      const validCount = await magicLinkRepo.countForUser(testUser.id, true);
      const loginCount = await magicLinkRepo.countForUser(testUser.id, false, 'login');

      expect(totalCount).toBeGreaterThanOrEqual(1);
      expect(validCount).toBeLessThan(totalCount); // Should have fewer valid than total after use
      expect(loginCount).toBeGreaterThanOrEqual(1);
    });

    it('should handle multiple purposes', async () => {
      // Create links for different purposes
      const signupLinkData = {
        userId: testUser.id,
        tokenHash: 'signup-magic-link',
        purpose: 'signup',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      };
      const verifyLinkData = {
        userId: testUser.id,
        tokenHash: 'verify-magic-link',
        purpose: 'email_verification',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      };

      const signupLink = await magicLinkRepo.create(signupLinkData);
      const verifyLink = await magicLinkRepo.create(verifyLinkData);
      createdLinks.push(signupLink, verifyLink);

      // Test purpose-specific queries
      const signupLinks = await magicLinkRepo.findByPurpose('signup', true);
      const verifyLinks = await magicLinkRepo.findByPurpose('email_verification', true);

      expect(signupLinks).toHaveLength(1);
      expect(verifyLinks).toHaveLength(1);
      expect(signupLinks[0].purpose).toBe('signup');
      expect(verifyLinks[0].purpose).toBe('email_verification');
    });

    it('should invalidate magic links by user and purpose', async () => {
      // Create multiple signup links
      const link1Data = {
        userId: testUser.id,
        tokenHash: 'signup-link-1',
        purpose: 'signup',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      };
      const link2Data = {
        userId: testUser.id,
        tokenHash: 'signup-link-2',
        purpose: 'signup',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      };

      const link1 = await magicLinkRepo.create(link1Data);
      const link2 = await magicLinkRepo.create(link2Data);
      createdLinks.push(link1, link2);

      // Verify they're valid
      let validSignupLinks = await magicLinkRepo.findByUserId(testUser.id, true, 'signup');
      expect(validSignupLinks.length).toBeGreaterThan(0);

      // Invalidate only signup links
      const result = await magicLinkRepo.invalidateByUserAndPurpose(testUser.id, 'signup');
      expect(result.count).toBeGreaterThan(0);

      // Verify signup links are invalid but others remain
      validSignupLinks = await magicLinkRepo.findByUserId(testUser.id, true, 'signup');
      expect(validSignupLinks).toHaveLength(0);

      const validVerifyLinks = await magicLinkRepo.findByUserId(testUser.id, true, 'email_verification');
      expect(validVerifyLinks.length).toBeGreaterThan(0);
    });

    it('should track recent attempts', async () => {
      const recentCount = await magicLinkRepo.getRecentAttemptsCount(testUser.id, 'login', 1);
      expect(recentCount).toBeGreaterThan(0);
    });

    it('should handle expired magic links', async () => {
      // Create an expired link
      const expiredLinkData = {
        userId: testUser.id,
        tokenHash: 'expired-magic-link',
        purpose: 'login',
        expiresAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      };

      const expiredLink = await magicLinkRepo.create(expiredLinkData);
      createdLinks.push(expiredLink);

      // Should not find as valid
      const validLink = await magicLinkRepo.findValidToken(expiredLink.tokenHash);
      expect(validLink).toBeNull();

      // But should find in general search
      const foundLink = await magicLinkRepo.findByTokenHash(expiredLink.tokenHash);
      expect(foundLink).toBeTruthy();
    });
  });

  describe('Cross-Repository Integration', () => {
    it('should handle user deletion cascades', async () => {
      // Create a separate test user for deletion
      const tempUserData = {
        email: 'temp-user@example.com',
        passwordHash: 'tempPassword123',
        displayName: 'Temp User',
      };

      const tempUser = await userRepo.create(tempUserData);

      // Create auth tokens for temp user
      const refreshTokenData = {
        userId: tempUser.id,
        tokenHash: 'temp-refresh-token',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };
      const resetData = {
        userId: tempUser.id,
        tokenHash: 'temp-reset-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      };
      const linkData = {
        userId: tempUser.id,
        tokenHash: 'temp-magic-link',
        purpose: 'login',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      };

      const tempRefreshToken = await refreshTokenRepo.create(refreshTokenData);
      const tempReset = await passwordResetRepo.create(resetData);
      const tempLink = await magicLinkRepo.create(linkData);

      // Verify tokens exist
      expect(await refreshTokenRepo.findById(tempRefreshToken.id)).toBeTruthy();
      expect(await passwordResetRepo.findById(tempReset.id)).toBeTruthy();
      expect(await magicLinkRepo.findById(tempLink.id)).toBeTruthy();

      // Delete the user (should cascade)
      await userRepo.hardDelete(tempUser.id);

      // Verify tokens are gone (due to cascade delete)
      expect(await refreshTokenRepo.findById(tempRefreshToken.id)).toBeNull();
      expect(await passwordResetRepo.findById(tempReset.id)).toBeNull();
      expect(await magicLinkRepo.findById(tempLink.id)).toBeNull();
    });

    it('should handle concurrent token operations', async () => {
      // Create multiple tokens concurrently
      const tokenPromises = [];
      for (let i = 0; i < 5; i++) {
        const refreshTokenData = {
          userId: testUser.id,
          tokenHash: `concurrent-token-${i}`,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        };
        tokenPromises.push(refreshTokenRepo.create(refreshTokenData));
      }

      const tokens = await Promise.all(tokenPromises);
      createdTokens.push(...tokens);

      expect(tokens).toHaveLength(5);
      tokens.forEach((token, index) => {
        expect(token.tokenHash).toBe(`concurrent-token-${index}`);
        expect(token.userId).toBe(testUser.id);
      });

      // Verify all tokens can be found
      const userTokens = await refreshTokenRepo.findValidTokensByUserId(testUser.id);
      expect(userTokens.length).toBeGreaterThanOrEqual(5);
    });
  });
});
