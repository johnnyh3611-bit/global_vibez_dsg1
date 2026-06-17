/**
 * Error Logger - Centralized Error Tracking
 * 
 * Provides consistent error logging across the application.
 * Can be extended to integrate with external services (Sentry, LogRocket, etc.)
 * 
 * Usage:
 * import { errorLogger } from '@/utils/errorLogger';
 * 
 * errorLogger.logError(error, { context: 'user_action', userId: '123' });
 * errorLogger.logWarning('Unusual state detected', { gameId: 'abc' });
 */

/**
 * Log levels
 */
export const LogLevel = {
  ERROR: 'ERROR',
  WARNING: 'WARNING',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

/**
 * Error Logger Class
 */
class ErrorLogger {
  constructor() {
    this.logs = [];
    this.maxLogs = 100; // Keep last 100 logs in memory
    this.enableConsole = process.env.NODE_ENV === 'development';
  }

  /**
   * Format error for logging
   */
  formatError(error, context = {}) {
    return {
      timestamp: new Date().toISOString(),
      message: error?.message || String(error),
      stack: error?.stack,
      context,
      userAgent: navigator.userAgent,
      url: window.location.href
    };
  }

  /**
   * Store log in memory
   */
  storeLog(level, data) {
    this.logs.push({
      level,
      ...data
    });

    // Keep only last N logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  /**
   * Log error
   */
  logError(error, context = {}) {
    const formattedError = this.formatError(error, context);
    
    this.storeLog(LogLevel.ERROR, formattedError);

    if (this.enableConsole) {
      console.error('🔴 ERROR:', formattedError.message, formattedError);
    }

    // TODO: Send to external logging service (Sentry, LogRocket, etc.)
    // this.sendToExternalService(LogLevel.ERROR, formattedError);
  }

  /**
   * Log warning
   */
  logWarning(message, context = {}) {
    const data = {
      timestamp: new Date().toISOString(),
      message,
      context,
      url: window.location.href
    };

    this.storeLog(LogLevel.WARNING, data);

    if (this.enableConsole) {
      console.warn('🟡 WARNING:', message, data);
    }
  }

  /**
   * Log info
   */
  logInfo(message, context = {}) {
    const data = {
      timestamp: new Date().toISOString(),
      message,
      context
    };

    this.storeLog(LogLevel.INFO, data);

    if (this.enableConsole) {
      console.info('🔵 INFO:', message, data);
    }
  }

  /**
   * Log debug (development only)
   */
  logDebug(message, context = {}) {
    if (!this.enableConsole) return;

    console.log('⚪ DEBUG:', message, context);
  }

  /**
   * Get all logs
   */
  getLogs(level = null) {
    if (level) {
      return this.logs.filter(log => log.level === level);
    }
    return this.logs;
  }

  /**
   * Clear logs
   */
  clearLogs() {
    this.logs = [];
  }

  /**
   * Export logs as JSON
   */
  exportLogs() {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Send to external logging service (placeholder)
   */
  sendToExternalService(level, data) {
    // TODO: Implement Sentry, LogRocket, or custom logging service
    // Example:
    // if (window.Sentry) {
    //   window.Sentry.captureException(new Error(data.message), {
    //     level: level.toLowerCase(),
    //     extra: data
    //   });
    // }
  }
}

// Create singleton instance
export const errorLogger = new ErrorLogger();

// Expose globally for debugging in dev mode
if (process.env.NODE_ENV === 'development') {
  window.errorLogger = errorLogger;
}

export default errorLogger;
