/**
 * Device Repository
 *
 * Handles all database operations for Device model.
 */

import prismaService from '../services/prisma.js';
import logger from '../utils/logger.js';

class DeviceRepository {
  constructor() {
    this.prisma = prismaService.getClient();
  }

  /**
   * Create a new device
   * @param {Object} deviceData - Device data
   * @returns {Promise<Object>} Created device
   */
  async create(deviceData) {
    try {
      const device = await this.prisma.device.create({
        data: deviceData,
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

      logger.info(
        `Device created for user: ${deviceData.userId}, platform: ${deviceData.platform}`
      );
      return device;
    } catch (error) {
      logger.error('Error creating device:', error);
      throw error;
    }
  }

  /**
   * Find device by ID
   * @param {string} id - Device ID
   * @returns {Promise<Object|null>} Device or null
   */
  async findById(id) {
    try {
      return await this.prisma.device.findUnique({
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
      logger.error('Error finding device by ID:', error);
      throw error;
    }
  }

  /**
   * Find devices by user ID
   * @param {string} userId - User ID
   * @returns {Promise<Array>} List of devices
   */
  async findByUserId(userId) {
    try {
      return await this.prisma.device.findMany({
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
        orderBy: { lastSeenAt: 'desc' },
      });
    } catch (error) {
      logger.error('Error finding devices by user ID:', error);
      throw error;
    }
  }

  /**
   * Find device by user ID and push token
   * @param {string} userId - User ID
   * @param {string} pushToken - Push token
   * @returns {Promise<Object|null>} Device or null
   */
  async findByUserIdAndPushToken(userId, pushToken) {
    try {
      return await this.prisma.device.findUnique({
        where: {
          unique_user_push_token: {
            userId,
            pushToken,
          },
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
      logger.error('Error finding device by user and push token:', error);
      throw error;
    }
  }

  /**
   * Update device
   * @param {string} id - Device ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated device
   */
  async update(id, updateData) {
    try {
      const device = await this.prisma.device.update({
        where: { id },
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

      logger.info(`Device updated: ${device.id}`);
      return device;
    } catch (error) {
      logger.error('Error updating device:', error);
      throw error;
    }
  }

  /**
   * Update last seen timestamp
   * @param {string} id - Device ID
   * @returns {Promise<Object>} Updated device
   */
  async updateLastSeen(id) {
    try {
      return await this.update(id, { lastSeenAt: new Date() });
    } catch (error) {
      logger.error('Error updating device last seen:', error);
      throw error;
    }
  }

  /**
   * Upsert device (create or update)
   * @param {string} userId - User ID
   * @param {string} pushToken - Push token
   * @param {Object} deviceData - Device data
   * @returns {Promise<Object>} Created or updated device
   */
  async upsert(userId, pushToken, deviceData) {
    try {
      const device = await this.prisma.device.upsert({
        where: {
          unique_user_push_token: {
            userId,
            pushToken,
          },
        },
        create: {
          userId,
          pushToken,
          ...deviceData,
        },
        update: {
          ...deviceData,
          lastSeenAt: new Date(),
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

      logger.info(
        `Device upserted for user: ${userId}, platform: ${deviceData.platform}`
      );
      return device;
    } catch (error) {
      logger.error('Error upserting device:', error);
      throw error;
    }
  }

  /**
   * Delete device
   * @param {string} id - Device ID
   * @returns {Promise<Object>} Deleted device
   */
  async delete(id) {
    try {
      const device = await this.prisma.device.delete({
        where: { id },
      });

      logger.info(`Device deleted: ${device.id}`);
      return device;
    } catch (error) {
      logger.error('Error deleting device:', error);
      throw error;
    }
  }

  /**
   * Delete devices by user ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Delete result
   */
  async deleteByUserId(userId) {
    try {
      const result = await this.prisma.device.deleteMany({
        where: { userId },
      });

      logger.info(`Deleted ${result.count} devices for user: ${userId}`);
      return result;
    } catch (error) {
      logger.error('Error deleting devices by user ID:', error);
      throw error;
    }
  }

  /**
   * Get devices by platform
   * @param {string} platform - Platform type
   * @returns {Promise<Array>} List of devices
   */
  async findByPlatform(platform) {
    try {
      return await this.prisma.device.findMany({
        where: { platform },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              displayName: true,
            },
          },
        },
        orderBy: { lastSeenAt: 'desc' },
      });
    } catch (error) {
      logger.error('Error finding devices by platform:', error);
      throw error;
    }
  }

  /**
   * Get active devices (seen within last N days)
   * @param {number} days - Days to look back
   * @returns {Promise<Array>} List of active devices
   */
  async findActiveDevices(days = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      return await this.prisma.device.findMany({
        where: {
          lastSeenAt: {
            gte: cutoffDate,
          },
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
        orderBy: { lastSeenAt: 'desc' },
      });
    } catch (error) {
      logger.error('Error finding active devices:', error);
      throw error;
    }
  }

  /**
   * Get push tokens for user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} List of push tokens
   */
  async getPushTokensForUser(userId) {
    try {
      const devices = await this.prisma.device.findMany({
        where: { userId },
        select: { pushToken: true, platform: true },
      });

      return devices.map((device) => ({
        token: device.pushToken,
        platform: device.platform,
      }));
    } catch (error) {
      logger.error('Error getting push tokens for user:', error);
      throw error;
    }
  }
}

export default DeviceRepository;
