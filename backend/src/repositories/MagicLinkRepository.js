/**
 * Magic Link Repository
 *
 * Handles all database operations for MagicLink model.
 * Used for managing magic link tokens for various purposes like login, signup, email verification.
 */

import prismaService from '../services/prisma.js';
import logger from '../utils/logger.js';

class MagicLinkRepository {
  constructor() {
    this.prisma = prismaService.getClient();
  }

  /**
   * Create a new magic link token
   * @param {Object} linkData - Magic link data
   * @param {string} linkData.userId - User ID
   * @param {string} linkData.tokenHash - Hashed token
   * @param {string} linkData.purpose - Purpose of the magic link
   * @param {Date} linkData.expiresAt - Expiration date
   * @returns {Promise<Object>} Created magic link token
   */
  async create(linkData) {
    try {
      const magicLink = await this.prisma.magicLink.create({
        data: linkData,
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

      logger.info(`Magic link created for user: ${linkData.userId}, purpose: ${linkData.purpose}`);
      return magicLink;
    } catch (error) {
      logger.error('Error creating magic link:', error);
      throw error;
    }
  }

  /**
   * Find magic link by ID
   * @param {string} id - Link ID
   * @returns {Promise<Object|null>} Magic link or null
   */
  async findById(id) {
    try {
      return await this.prisma.magicLink.findUnique({
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
      logger.error('Error finding magic link by ID:', error);
      throw error;
    }
  }

  /**
   * Find magic link by token hash
   * @param {string} tokenHash - Hashed token
   * @returns {Promise<Object|null>} Magic link or null
   */
  async findByTokenHash(tokenHash) {
    try {
      return await this.prisma.magicLink.findFirst({
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
      logger.error('Error finding magic link by token hash:', error);
      throw error;
    }
  }

  /**
   * Find valid (unused, non-expired) magic link
   * @param {string} tokenHash - Hashed token
   * @returns {Promise<Object|null>} Valid magic link or null
   */
  async findValidToken(tokenHash) {
    try {
      return await this.prisma.magicLink.findFirst({
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
      logger.error('Error finding valid magic link:', error);
      throw error;
    }
  }

  /**
   * Find valid magic link by purpose
   * @param {string} tokenHash - Hashed token
   * @param {string} purpose - Purpose of the magic link
   * @returns {Promise<Object|null>} Valid magic link or null
   */
  async findValidTokenByPurpose(tokenHash, purpose) {
    try {
      return await this.prisma.magicLink.findFirst({
        where: {
          tokenHash,
          purpose,
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
      logger.error('Error finding valid magic link by purpose:', error);
      throw error;
    }
  }

  /**
   * Find all magic links for a user
   * @param {string} userId - User ID
   * @param {boolean} onlyValid - Return only valid (unused, non-expired) links
   * @param {string} purpose - Filter by purpose (optional)
   * @returns {Promise<Array>} Array of magic links
   */
  async findByUserId(userId, onlyValid = false, purpose = null) {
    try {
      const where = { userId };

      if (onlyValid) {
        where.usedAt = null;
        where.expiresAt = { gt: new Date() };
      }

      if (purpose) {
        where.purpose = purpose;
      }

      return await this.prisma.magicLink.findMany({
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
      logger.error('Error finding magic links by user ID:', error);
      throw error;
    }
  }

  /**
   * Find all magic links by purpose
   * @param {string} purpose - Purpose of the magic links
   * @param {boolean} onlyValid - Return only valid links
   * @returns {Promise<Array>} Array of magic links
   */
  async findByPurpose(purpose, onlyValid = false) {
    try {
      const where = { purpose };

      if (onlyValid) {
        where.usedAt = null;
        where.expiresAt = { gt: new Date() };
      }

      return await this.prisma.magicLink.findMany({
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
      logger.error('Error finding magic links by purpose:', error);
      throw error;
    }
  }

  /**
   * Mark a magic link as used
   * @param {string} id - Link ID
   * @returns {Promise<Object>} Updated magic link
   */
  async markAsUsed(id) {
    try {
      const link = await this.prisma.magicLink.update({
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

      logger.info(`Magic link marked as used: ${id}`);
      return link;
    } catch (error) {
      logger.error('Error marking magic link as used:', error);
      throw error;
    }
  }

  /**
   * Mark a magic link as used by token hash
   * @param {string} tokenHash - Hashed token
   * @returns {Promise<Object>} Update result with count
   */
  async markAsUsedByHash(tokenHash) {
    try {
      const result = await this.prisma.magicLink.updateMany({
        where: {
          tokenHash,
          usedAt: null,
        },
        data: { usedAt: new Date() },
      });

      logger.info(`Magic link marked as used by hash, count: ${result.count}`);
      return result;
    } catch (error) {
      logger.error('Error marking magic link as used by hash:', error);
      throw error;
    }
  }

  /**
   * Invalidate all magic links for a user by purpose
   * @param {string} userId - User ID
   * @param {string} purpose - Purpose to invalidate
   * @returns {Promise<Object>} Update result with count
   */
  async invalidateByUserAndPurpose(userId, purpose) {
    try {
      const result = await this.prisma.magicLink.updateMany({
        where: {
          userId,
          purpose,
          usedAt: null,
        },
        data: { usedAt: new Date() },
      });

      logger.info(`Magic links invalidated for user: ${userId}, purpose: ${purpose}, count: ${result.count}`);
      return result;
    } catch (error) {
      logger.error('Error invalidating magic links by user and purpose:', error);
      throw error;
    }
  }

  /**
   * Invalidate all magic links for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Update result with count
   */
  async invalidateAllForUser(userId) {
    try {
      const result = await this.prisma.magicLink.updateMany({
        where: {
          userId,
          usedAt: null,
        },
        data: { usedAt: new Date() },
      });

      logger.info(`All magic links invalidated for user: ${userId}, count: ${result.count}`);
      return result;
    } catch (error) {
      logger.error('Error invalidating all magic links for user:', error);
      throw error;
    }
  }

  /**
   * Delete expired magic links (cleanup)
   * @returns {Promise<Object>} Delete result with count
   */
  async deleteExpired() {
    try {
      const result = await this.prisma.magicLink.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });

      logger.info(`Expired magic links deleted, count: ${result.count}`);
      return result;
    } catch (error) {
      logger.error('Error deleting expired magic links:', error);
      throw error;
    }
  }

  /**
   * Delete used magic links (cleanup)
   * @returns {Promise<Object>} Delete result with count
   */
  async deleteUsed() {
    try {
      const result = await this.prisma.magicLink.deleteMany({
        where: {
          usedAt: { not: null },
        },
      });

      logger.info(`Used magic links deleted, count: ${result.count}`);
      return result;
    } catch (error) {
      logger.error('Error deleting used magic links:', error);
      throw error;
    }
  }

  /**
   * Delete magic link by ID
   * @param {string} id - Link ID
   * @returns {Promise<Object>} Deleted magic link
   */
  async delete(id) {
    try {
      const link = await this.prisma.magicLink.delete({
        where: { id },
      });

      logger.info(`Magic link deleted: ${id}`);
      return link;
    } catch (error) {
      logger.error('Error deleting magic link:', error);
      throw error;
    }
  }

  /**
   * Count magic links for a user
   * @param {string} userId - User ID
   * @param {boolean} onlyValid - Count only valid links
   * @param {string} purpose - Filter by purpose (optional)
   * @returns {Promise<number>} Link count
   */
  async countForUser(userId, onlyValid = false, purpose = null) {
    try {
      const where = { userId };

      if (onlyValid) {
        where.usedAt = null;
        where.expiresAt = { gt: new Date() };
      }

      if (purpose) {
        where.purpose = purpose;
      }

      return await this.prisma.magicLink.count({ where });
    } catch (error) {
      logger.error('Error counting magic links for user:', error);
      throw error;
    }
  }

  /**
   * Get recent magic link attempts for a user (within specified time)
   * @param {string} userId - User ID
   * @param {string} purpose - Purpose of the magic links
   * @param {number} hoursBack - How many hours back to check (default: 1)
   * @returns {Promise<number>} Number of recent attempts
   */
  async getRecentAttemptsCount(userId, purpose, hoursBack = 1) {
    try {
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - hoursBack);

      return await this.prisma.magicLink.count({
        where: {
          userId,
          purpose,
          createdAt: { gte: cutoffTime },
        },
      });
    } catch (error) {
      logger.error('Error counting recent magic link attempts:', error);
      throw error;
    }
  }
}

export default MagicLinkRepository;
