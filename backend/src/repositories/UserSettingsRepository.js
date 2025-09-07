/**
 * User Settings Repository
 *
 * Handles all database operations for UserSettings model.
 */

import prismaService from '../services/prisma.js';
import logger from '../utils/logger.js';

class UserSettingsRepository {
  constructor() {
    this.prisma = prismaService.getClient();
  }

  /**
   * Create user settings
   * @param {Object} settingsData - Settings data
   * @returns {Promise<Object>} Created settings
   */
  async create(settingsData) {
    try {
      const settings = await this.prisma.userSettings.create({
        data: settingsData,
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

      logger.info(`User settings created for user: ${settingsData.userId}`);
      return settings;
    } catch (error) {
      logger.error('Error creating user settings:', error);
      throw error;
    }
  }

  /**
   * Find settings by user ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Settings or null
   */
  async findByUserId(userId) {
    try {
      return await this.prisma.userSettings.findUnique({
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
      });
    } catch (error) {
      logger.error('Error finding user settings:', error);
      throw error;
    }
  }

  /**
   * Update user settings
   * @param {string} userId - User ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated settings
   */
  async update(userId, updateData) {
    try {
      const settings = await this.prisma.userSettings.update({
        where: { userId },
        data: updateData,
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

      logger.info(`User settings updated for user: ${userId}`);
      return settings;
    } catch (error) {
      logger.error('Error updating user settings:', error);
      throw error;
    }
  }

  /**
   * Upsert user settings (create or update)
   * @param {string} userId - User ID
   * @param {Object} settingsData - Settings data
   * @returns {Promise<Object>} Created or updated settings
   */
  async upsert(userId, settingsData) {
    try {
      const settings = await this.prisma.userSettings.upsert({
        where: { userId },
        create: {
          userId,
          ...settingsData,
        },
        update: settingsData,
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

      logger.info(`User settings upserted for user: ${userId}`);
      return settings;
    } catch (error) {
      logger.error('Error upserting user settings:', error);
      throw error;
    }
  }

  /**
   * Delete user settings
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Deleted settings
   */
  async delete(userId) {
    try {
      const settings = await this.prisma.userSettings.delete({
        where: { userId },
      });

      logger.info(`User settings deleted for user: ${userId}`);
      return settings;
    } catch (error) {
      logger.error('Error deleting user settings:', error);
      throw error;
    }
  }

  /**
   * Get settings by bible translation
   * @param {string} translation - Bible translation
   * @returns {Promise<Array>} List of settings
   */
  async findByBibleTranslation(translation) {
    try {
      return await this.prisma.userSettings.findMany({
        where: { bibleTranslation: translation },
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
      logger.error('Error finding settings by bible translation:', error);
      throw error;
    }
  }

  /**
   * Get settings by denomination
   * @param {string} denomination - Denomination
   * @returns {Promise<Array>} List of settings
   */
  async findByDenomination(denomination) {
    try {
      return await this.prisma.userSettings.findMany({
        where: { denomination },
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
      logger.error('Error finding settings by denomination:', error);
      throw error;
    }
  }

  /**
   * Get users with push notifications enabled
   * @returns {Promise<Array>} List of settings with push enabled
   */
  async findWithPushEnabled() {
    try {
      return await this.prisma.userSettings.findMany({
        where: { pushOptIn: true },
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
      logger.error('Error finding users with push enabled:', error);
      throw error;
    }
  }

  /**
   * Get users within quiet time range
   * @param {string} currentTime - Current time in HH:MM format
   * @returns {Promise<Array>} List of users in quiet time
   */
  async findUsersInQuietTime(currentTime) {
    try {
      return await this.prisma.userSettings.findMany({
        where: {
          AND: [
            { quietTimeStart: { not: null } },
            { quietTimeEnd: { not: null } },
            { quietTimeStart: { lte: currentTime } },
            { quietTimeEnd: { gte: currentTime } },
          ],
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              displayName: true,
              tz: true,
            },
          },
        },
      });
    } catch (error) {
      logger.error('Error finding users in quiet time:', error);
      throw error;
    }
  }
}

export default UserSettingsRepository;

