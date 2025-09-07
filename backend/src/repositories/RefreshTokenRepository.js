/**
 * Refresh Token Repository
 *
 * Handles all database operations for RefreshToken model.
 * Used for managing JWT refresh tokens with proper expiration and revocation.
 */

import prismaService from '../services/prisma.js';
import logger from '../utils/logger.js';

class RefreshTokenRepository {
  constructor() {
    this.prisma = prismaService.getClient();
  }

  /**
   * Create a new refresh token
   * @param {Object} tokenData - Token data
   * @param {string} tokenData.userId - User ID
   * @param {string} tokenData.tokenHash - Hashed token
   * @param {Date} tokenData.expiresAt - Expiration date
   * @returns {Promise<Object>} Created refresh token
   */
  async create(tokenData) {
    try {
      const token = await this.prisma.refreshToken.create({
        data: tokenData,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              displayName: true,
            },
          },
        },
      });

      logger.info(`Refresh token created for user: ${tokenData.userId}`);
      return token;
    } catch (error) {
      logger.error('Error creating refresh token:', error);
      throw error;
    }
  }

  /**
   * Find refresh token by ID
   * @param {string} id - Token ID
   * @returns {Promise<Object|null>} Token or null
   */
  async findById(id) {
    try {
      return await this.prisma.refreshToken.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              displayName: true,
            },
          },
        },
      });
    } catch (error) {
      logger.error('Error finding refresh token by ID:', error);
      throw error;
    }
  }

  /**
   * Find refresh token by token hash
   * @param {string} tokenHash - Hashed token
   * @returns {Promise<Object|null>} Token or null
   */
  async findByTokenHash(tokenHash) {
    try {
      return await this.prisma.refreshToken.findFirst({
        where: { tokenHash },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              displayName: true,
            },
          },
        },
      });
    } catch (error) {
      logger.error('Error finding refresh token by hash:', error);
      throw error;
    }
  }

  /**
   * Find all valid (non-revoked, non-expired) tokens for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of valid tokens
   */
  async findValidTokensByUserId(userId) {
    try {
      return await this.prisma.refreshToken.findMany({
        where: {
          userId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              displayName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      logger.error('Error finding valid tokens by user ID:', error);
      throw error;
    }
  }

  /**
   * Find all tokens for a user (including revoked/expired)
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of all tokens
   */
  async findAllTokensByUserId(userId) {
    try {
      return await this.prisma.refreshToken.findMany({
        where: { userId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              displayName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      logger.error('Error finding all tokens by user ID:', error);
      throw error;
    }
  }

  /**
   * Revoke a refresh token
   * @param {string} id - Token ID
   * @returns {Promise<Object>} Revoked token
   */
  async revoke(id) {
    try {
      const token = await this.prisma.refreshToken.update({
        where: { id },
        data: { revokedAt: new Date() },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              displayName: true,
            },
          },
        },
      });

      logger.info(`Refresh token revoked: ${id}`);
      return token;
    } catch (error) {
      logger.error('Error revoking refresh token:', error);
      throw error;
    }
  }

  /**
   * Revoke all tokens for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Update result with count
   */
  async revokeAllForUser(userId) {
    try {
      const result = await this.prisma.refreshToken.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });

      logger.info(
        `All refresh tokens revoked for user: ${userId}, count: ${result.count}`
      );
      return result;
    } catch (error) {
      logger.error('Error revoking all tokens for user:', error);
      throw error;
    }
  }

  /**
   * Check if a token is valid (not revoked and not expired)
   * @param {string} tokenHash - Hashed token
   * @returns {Promise<Object|null>} Valid token or null
   */
  async findValidToken(tokenHash) {
    try {
      return await this.prisma.refreshToken.findFirst({
        where: {
          tokenHash,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              displayName: true,
            },
          },
        },
      });
    } catch (error) {
      logger.error('Error checking token validity:', error);
      throw error;
    }
  }

  /**
   * Delete expired tokens (cleanup)
   * @returns {Promise<Object>} Delete result with count
   */
  async deleteExpired() {
    try {
      const result = await this.prisma.refreshToken.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });

      logger.info(`Expired refresh tokens deleted, count: ${result.count}`);
      return result;
    } catch (error) {
      logger.error('Error deleting expired tokens:', error);
      throw error;
    }
  }

  /**
   * Delete token by ID
   * @param {string} id - Token ID
   * @returns {Promise<Object>} Deleted token
   */
  async delete(id) {
    try {
      const token = await this.prisma.refreshToken.delete({
        where: { id },
      });

      logger.info(`Refresh token deleted: ${id}`);
      return token;
    } catch (error) {
      logger.error('Error deleting refresh token:', error);
      throw error;
    }
  }

  /**
   * Count tokens for a user
   * @param {string} userId - User ID
   * @param {boolean} onlyValid - Count only valid tokens
   * @returns {Promise<number>} Token count
   */
  async countForUser(userId, onlyValid = false) {
    try {
      const where = { userId };

      if (onlyValid) {
        where.revokedAt = null;
        where.expiresAt = { gt: new Date() };
      }

      return await this.prisma.refreshToken.count({ where });
    } catch (error) {
      logger.error('Error counting tokens for user:', error);
      throw error;
    }
  }
}

export default RefreshTokenRepository;
