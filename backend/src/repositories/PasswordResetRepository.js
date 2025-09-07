/**
 * Password Reset Repository
 *
 * Handles all database operations for PasswordReset model.
 * Used for managing password reset tokens with proper expiration and usage tracking.
 */

import prismaService from '../services/prisma.js';
import logger from '../utils/logger.js';

class PasswordResetRepository {
  constructor() {
    this.prisma = prismaService.getClient();
  }

  /**
   * Create a new password reset token
   * @param {Object} resetData - Reset token data
   * @param {string} resetData.userId - User ID
   * @param {string} resetData.tokenHash - Hashed token
   * @param {Date} resetData.expiresAt - Expiration date
   * @returns {Promise<Object>} Created password reset token
   */
  async create(resetData) {
    try {
      const resetToken = await this.prisma.passwordReset.create({
        data: resetData,
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

      logger.info(`Password reset token created for user: ${resetData.userId}`);
      return resetToken;
    } catch (error) {
      logger.error('Error creating password reset token:', error);
      throw error;
    }
  }

  /**
   * Find password reset token by ID
   * @param {string} id - Token ID
   * @returns {Promise<Object|null>} Token or null
   */
  async findById(id) {
    try {
      return await this.prisma.passwordReset.findUnique({
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
      logger.error('Error finding password reset token by ID:', error);
      throw error;
    }
  }

  /**
   * Find password reset token by token hash
   * @param {string} tokenHash - Hashed token
   * @returns {Promise<Object|null>} Token or null
   */
  async findByTokenHash(tokenHash) {
    try {
      return await this.prisma.passwordReset.findFirst({
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
      logger.error('Error finding password reset token by hash:', error);
      throw error;
    }
  }

  /**
   * Find valid (unused, non-expired) password reset token
   * @param {string} tokenHash - Hashed token
   * @returns {Promise<Object|null>} Valid token or null
   */
  async findValidToken(tokenHash) {
    try {
      return await this.prisma.passwordReset.findFirst({
        where: {
          tokenHash,
          usedAt: null,
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
      logger.error('Error finding valid password reset token:', error);
      throw error;
    }
  }

  /**
   * Find all password reset tokens for a user
   * @param {string} userId - User ID
   * @param {boolean} onlyValid - Return only valid (unused, non-expired) tokens
   * @returns {Promise<Array>} Array of password reset tokens
   */
  async findByUserId(userId, onlyValid = false) {
    try {
      const where = { userId };

      if (onlyValid) {
        where.usedAt = null;
        where.expiresAt = { gt: new Date() };
      }

      return await this.prisma.passwordReset.findMany({
        where,
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
      logger.error('Error finding password reset tokens by user ID:', error);
      throw error;
    }
  }

  /**
   * Mark a password reset token as used
   * @param {string} id - Token ID
   * @returns {Promise<Object>} Updated token
   */
  async markAsUsed(id) {
    try {
      const token = await this.prisma.passwordReset.update({
        where: { id },
        data: { usedAt: new Date() },
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

      logger.info(`Password reset token marked as used: ${id}`);
      return token;
    } catch (error) {
      logger.error('Error marking password reset token as used:', error);
      throw error;
    }
  }

  /**
   * Mark a password reset token as used by token hash
   * @param {string} tokenHash - Hashed token
   * @returns {Promise<Object>} Updated token
   */
  async markAsUsedByHash(tokenHash) {
    try {
      const token = await this.prisma.passwordReset.updateMany({
        where: {
          tokenHash,
          usedAt: null,
        },
        data: { usedAt: new Date() },
      });

      logger.info(`Password reset token marked as used by hash, count: ${token.count}`);
      return token;
    } catch (error) {
      logger.error('Error marking password reset token as used by hash:', error);
      throw error;
    }
  }

  /**
   * Invalidate all password reset tokens for a user (mark as used)
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Update result with count
   */
  async invalidateAllForUser(userId) {
    try {
      const result = await this.prisma.passwordReset.updateMany({
        where: {
          userId,
          usedAt: null,
        },
        data: { usedAt: new Date() },
      });

      logger.info(`All password reset tokens invalidated for user: ${userId}, count: ${result.count}`);
      return result;
    } catch (error) {
      logger.error('Error invalidating all password reset tokens for user:', error);
      throw error;
    }
  }

  /**
   * Delete expired password reset tokens (cleanup)
   * @returns {Promise<Object>} Delete result with count
   */
  async deleteExpired() {
    try {
      const result = await this.prisma.passwordReset.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });

      logger.info(`Expired password reset tokens deleted, count: ${result.count}`);
      return result;
    } catch (error) {
      logger.error('Error deleting expired password reset tokens:', error);
      throw error;
    }
  }

  /**
   * Delete used password reset tokens (cleanup)
   * @returns {Promise<Object>} Delete result with count
   */
  async deleteUsed() {
    try {
      const result = await this.prisma.passwordReset.deleteMany({
        where: {
          usedAt: { not: null },
        },
      });

      logger.info(`Used password reset tokens deleted, count: ${result.count}`);
      return result;
    } catch (error) {
      logger.error('Error deleting used password reset tokens:', error);
      throw error;
    }
  }

  /**
   * Delete password reset token by ID
   * @param {string} id - Token ID
   * @returns {Promise<Object>} Deleted token
   */
  async delete(id) {
    try {
      const token = await this.prisma.passwordReset.delete({
        where: { id },
      });

      logger.info(`Password reset token deleted: ${id}`);
      return token;
    } catch (error) {
      logger.error('Error deleting password reset token:', error);
      throw error;
    }
  }

  /**
   * Count password reset tokens for a user
   * @param {string} userId - User ID
   * @param {boolean} onlyValid - Count only valid tokens
   * @returns {Promise<number>} Token count
   */
  async countForUser(userId, onlyValid = false) {
    try {
      const where = { userId };

      if (onlyValid) {
        where.usedAt = null;
        where.expiresAt = { gt: new Date() };
      }

      return await this.prisma.passwordReset.count({ where });
    } catch (error) {
      logger.error('Error counting password reset tokens for user:', error);
      throw error;
    }
  }

  /**
   * Get recent password reset attempts for a user (within last hour)
   * @param {string} userId - User ID
   * @param {number} hoursBack - How many hours back to check (default: 1)
   * @returns {Promise<number>} Number of recent attempts
   */
  async getRecentAttemptsCount(userId, hoursBack = 1) {
    try {
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - hoursBack);

      return await this.prisma.passwordReset.count({
        where: {
          userId,
          createdAt: { gte: cutoffTime },
        },
      });
    } catch (error) {
      logger.error('Error counting recent password reset attempts:', error);
      throw error;
    }
  }
}

export default PasswordResetRepository;
