/** Logger utility
 * the reason why i created this file is because i want to use the logger in the other files and i don't want to create a new logger in the other files
 * i want to use the same logger in the other files
 * i am using pino for the logger
 * pino is a logger library that is used to log the messages to the console
 */

import pino from 'pino'; // pino is a logger library that is used to log the messages to the console
import {config} from '../config/index.js'; // config is a file that contains the config for the application

const logger  = pino({ // logger is a pino instance that is used to log the messages to the console
  level: config.logLevel || 'info', // the level of the logger
  transport: process.env.NODE_ENV !== 'production' ? { // if the environment is not production, use the pino-pretty transport
    target: 'pino-pretty', // the target of the transport also pino-pretty is a transport that is used to log the messages to the console
    options: { // the reason why i created this is because i want to use the pino-pretty transport to log the messages to the console
      colorize: true, // the colorize option is used to colorize the messages to the console
      translateTime: 'HH:MM:ss Z', // the translateTime option is used to translate the time to the console
      ignore: 'pid,hostname', // the ignore option is used to ignore the pid and hostname from the messages
    },
  } : undefined, // if the environment is production, use the undefined transport
  formatters: { // the formatters option is used to format the messages to the console
    level: (label) => { // the level option is used to format the messages to the console
      return {level: label.toUpperCase()}; // the level option is used to format the messages to the console
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export default logger;
