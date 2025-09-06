/**
 * User Repository
 * 
 * Handles all database operations for User model including soft deletes.
 */

import prismaService from '../services/prisma.js';
import logger from '../utils/logger.js';

class UserRepository {
  constructor() {
    this.prisma = prismaService.getClient();
  }

  /**
   * Create a new user
   * @param {Object} userData - User data
   * @returns {Promise<Object>} Created user
   */
  async create(userData) {
    try {
      const user = await this.prisma.user.create({
        data: userData,
        include: {
          userSettings: true,
          devices: true,
        },
      });
      
      logger.info(`User created: ${user.email}`);
      return user;
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  /**
   * Find user by ID (excluding soft deleted)
   * @param {string} id - User ID
   * @returns {Promise<Object|null>} User or null
   */
  async findById(id) {
    try {
      return await this.prisma.user.findFirst({
        where: {
          id,
          deletedAt: null, // Exclude soft deleted users
        },
        include: {
          userSettings: true,
          devices: true,
        },
      });
    } catch (error) {
      logger.error('Error finding user by ID:', error);
      throw error;
    }
  }

  /**
   * Find user by email (excluding soft deleted)
   * @param {string} email - User email
   * @returns {Promise<Object|null>} User or null
   */
  async findByEmail(email) {
    try {
      return await this.prisma.user.findFirst({
        where: {
          email,
          deletedAt: null,
        },
        include: {
          userSettings: true,
          devices: true,
        },
      });
    } catch (error) {
      logger.error('Error finding user by email:', error);
      throw error;
    }
  }

  /**
   * Update user
   * @param {string} id - User ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated user
   */
  async update(id, updateData) {
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: updateData,
        include: {
          userSettings: true,
          devices: true,
        },
      });
      
      logger.info(`User updated: ${user.email}`);
      return user;
    } catch (error) {
      logger.error('Error updating user:', error);
      throw error;
    }
  }

  /**
   * Soft delete user
   * @param {string} id - User ID
   * @returns {Promise<Object>} Soft deleted user
   */
  async softDelete(id) {
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      
      logger.info(`User soft deleted: ${user.email}`);
      return user;
    } catch (error) {
      logger.error('Error soft deleting user:', error);
      throw error;
    }
  }

  /**
   * Restore soft deleted user
   * @param {string} id - User ID
   * @returns {Promise<Object>} Restored user
   */
  async restore(id) {
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: { deletedAt: null },
        include: {
          userSettings: true,
          devices: true,
        },
      });
      
      logger.info(`User restored: ${user.email}`);
      return user;
    } catch (error) {
      logger.error('Error restoring user:', error);
      throw error;
    }
  }

  /**
   * Permanently delete user (hard delete)
   * @param {string} id - User ID
   * @returns {Promise<Object>} Deleted user
   */
  async hardDelete(id) {
    try {
      const user = await this.prisma.user.delete({
        where: { id },
      });
      
      logger.info(`User permanently deleted: ${user.email}`);
      return user;
    } catch (error) {
      logger.error('Error permanently deleting user:', error);
      throw error;
    }
  }

  /**
   * Get all users (excluding soft deleted)
   * @param {Object} options - Query options
   * @returns {Promise<Array>} List of users
   */
  async findAll(options = {}) {
    try {
      const { skip = 0, take = 50, where = {} } = options;
      
      return await this.prisma.user.findMany({
        where: {
          ...where,
          deletedAt: null,
        },
        include: {
          userSettings: true,
          devices: true,
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      logger.error('Error finding all users:', error);
      throw error;
    }
  }

  /**
   * Count users (excluding soft deleted)
   * @param {Object} where - Filter conditions
   * @returns {Promise<number>} User count
   */
  async count(where = {}) {
    try {
      return await this.prisma.user.count({
        where: {
          ...where,
          deletedAt: null,
        },
      });
    } catch (error) {
      logger.error('Error counting users:', error);
      throw error;
    }
  }

  /**
   * Check if email exists (excluding soft deleted)
   * @param {string} email - Email to check
   * @returns {Promise<boolean>} True if exists
   */
  async emailExists(email) {
    try {
      const user = await this.prisma.user.findFirst({
        where: {
          email,
          deletedAt: null,
        },
        select: { id: true },
      });
      
      return !!user;
    } catch (error) {
      logger.error('Error checking email existence:', error);
      throw error;
    }
  }
}

export default UserRepository;