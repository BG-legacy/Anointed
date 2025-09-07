/**
 * Prisma Service
 * this service is used to connect to the database and get the prisma client
 * it also includes health check and get database info functions
 */
import { PrismaClient } from '../generated/prisma/index.js';
import logger from '../utils/logger.js';

class PrismaService {
  // this is a singleton class
  constructor() {
    // constructor to initialize the client
    this.client = null; // initialize the client
    this.isConnected = false; // initialize the connected status
  }

  /**
   * Get the prisma client
   * @returns {PrismaClient} // return the prisma client
   */
  getClient() {
    // get the prisma client
    if (!this.client) {
      // if the client is not initialized, initialize it
      this.client = new PrismaClient({
        // initialize the client
        log:
          process.env.NODE_ENV === 'development' // if the environment is development, log the queries, info, warnings, and errors
            ? ['query', 'info', 'warn', 'error'] // log the queries, info, warnings, and errors
            : ['error'], // if the environment is not development, log only the errors
      });
    }
    return this.client;
  }

  /**
   * connect to the database
   */
  async connect() {
    // connect to the database
    if (this.isConnected) {
      // if the database is already connected, return
      return; // return the clien so we can use it
    }
    try {
      // try to connect to the database
      const client = await this.getClient(); // well how this works is it creates a new client if one doesn't exist
      await client.$connect(); // connect to the database
      this.isConnected = true;
      logger.info('Successfully connected to the database');
    } catch (error) {
      // if the database connection fails, log the error
      this.isConnected = false; //what this does is it sets the connected status to false
      logger.error('Failed to connect to the database:', error); // log the error
      throw error; // throw the error
    }
  }
  /**
   * disconnect from the databse and reset the cliet
   *
   */
  async disconnect() {
    if (!this.isConnected || !this.client) {
      return;
    }
    try {
      await this.client.$disconnect();
      this.isConnected = false;
      logger.info('the database has been disconnected');
    } catch (error) {
      logger.error('Failed to disconnect from the database:', error);
      throw error;
    }
  }
  /**
   * check the database health
   */
  async healthCheck() {
    try {
      const client = await this.getClient();
      await client.$queryRaw`SELECT 1 `;
      return true;
    } catch (error) {
      logger.error('Failed to check the database health:', error);
      return false;
    }
  }
  /**
   * get the database information such as version and database name and other stuff like server ip and port and user name
   */
  async getDatabaseInfo() {
    // get the database information such as version and database name and other stuff like server ip and port and user name
    try {
      // try to get the database information
      const client = await this.getClient(); // well how this works is it creates a new client if one doesn't exist
      const result = await client.$queryRaw` 
                SELECT
                current_database() as database_name,    
                current_user as user_name,
                version() as postgres_version,
                inet_server_addr() as server_ip,
                inet_server_port() as server_port
            `;
      return result[0]; // return the the result of the query at index 0
    } catch (error) {
      logger.error('Failed to get the database info:', error);
      throw error;
    }
  }
}

const prismaService = new PrismaService(); // export the prisma service
process.on('beforeExit', async () => {
  await prismaService.disconnect();
});

process.on('SIGINT', async () => {
  await prismaService.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prismaService.disconnect();
  process.exit(0);
});

export default prismaService; // export the prisma service instance
export { prismaService };
