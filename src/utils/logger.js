/**
 * Centralized Logging Utility
 * Provides consistent logging across the application
 */

export class Logger {
  constructor(context = 'App') {
    this.context = context;
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level.toUpperCase()} [${this.context}]: ${message}${metaStr}`;
  }

  info(message, meta = {}) {
    console.log(this.formatMessage('info', message, meta));
  }

  warn(message, meta = {}) {
    console.warn(this.formatMessage('warn', message, meta));
  }

  error(message, error = null, meta = {}) {
    const errorMeta = error ? { 
      ...meta, 
      error: error.message, 
      stack: this.isDevelopment ? error.stack : undefined 
    } : meta;
    console.error(this.formatMessage('error', message, errorMeta));
  }

  debug(message, meta = {}) {
    if (this.isDevelopment) {
      console.debug(this.formatMessage('debug', message, meta));
    }
  }
}

export const createLogger = (context) => new Logger(context);
export default Logger;
