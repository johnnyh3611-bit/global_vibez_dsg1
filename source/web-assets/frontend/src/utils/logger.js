/**
 * Development Logger Utility
 * Conditionally logs based on environment
 * Production builds will have minimal console output
 */

const isDev = process.env.NODE_ENV === 'development';

export const logger = {
  /**
   * Debug logs - only in development
   */
  log: (...args) => {
    if (isDev) {
    }
  },

  /**
   * Warning logs - only in development
   */
  warn: (...args) => {
    if (isDev) {
    }
  },

  /**
   * Error logs - always shown (critical for production debugging)
   */
  error: (...args) => {
    // console.error(...args);
  },

  /**
   * Info logs - only in development
   */
  info: (...args) => {
    if (isDev) {

    }
  },

  /**
   * Table logs - only in development (useful for structured data)
   */
  table: (...args) => {
    if (isDev) {
      console.table(...args);
    }
  },
};

export default logger;
