/**
 * Base Service Class
 * Provides common functionality for all service classes
 */

import { createLogger } from '../utils/logger.js';
import { AppError, withRetry } from '../utils/error-handler.js';
import { appConfig } from '../config/app-config.js';

export class BaseService {
  constructor(name = 'Service') {
    this.name = name;
    this.logger = createLogger(name);
    this.config = appConfig;
    this.cache = new Map();
    this.cacheTimeout = this.config.persona.cacheTimeout || 3600000; // 1 hour default
  }

  /**
   * Get item from cache with expiry check
   */
  getCached(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.cacheTimeout) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  /**
   * Set item in cache with timestamp
   */
  setCached(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    
    // Limit cache size
    if (this.cache.size > 1000) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    this.logger.info('Cache cleared');
  }

  /**
   * Execute operation with retry logic
   */
  async executeWithRetry(operation, retries = 3, delay = 1000) {
    return await withRetry(operation, retries, delay);
  }

  /**
   * Log operation metrics
   */
  logMetrics(operation, startTime, success = true, metadata = {}) {
    const duration = Date.now() - startTime;
    this.logger.info(`${operation} ${success ? 'completed' : 'failed'}`, {
      duration: `${duration}ms`,
      success,
      ...metadata
    });
  }

  /**
   * Validate required fields
   */
  validateRequired(data, fields) {
    const missing = [];
    
    for (const field of fields) {
      if (field.includes('.')) {
        // Handle nested fields
        const parts = field.split('.');
        let value = data;
        for (const part of parts) {
          value = value?.[part];
        }
        if (value === undefined || value === null || value === '') {
          missing.push(field);
        }
      } else {
        if (!data[field] && data[field] !== 0 && data[field] !== false) {
          missing.push(field);
        }
      }
    }
    
    if (missing.length > 0) {
      throw new AppError(
        `Missing required fields: ${missing.join(', ')}`,
        400,
        'VALIDATION_ERROR'
      );
    }
  }

  /**
   * Sanitize user input
   */
  sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    
    // Remove potential script tags
    let sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    
    // Remove potential SQL injection patterns
    sanitized = sanitized.replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE)\b)/gi, '');
    
    // Trim whitespace
    sanitized = sanitized.trim();
    
    return sanitized;
  }

  /**
   * Format standard response
   */
  formatResponse(data, metadata = {}) {
    return {
      success: true,
      data,
      metadata: {
        timestamp: new Date().toISOString(),
        service: this.name,
        ...metadata
      }
    };
  }

  /**
   * Format error response
   */
  formatErrorResponse(error, includeStack = false) {
    const response = {
      success: false,
      error: {
        message: error.message || 'An error occurred',
        code: error.code || 'UNKNOWN_ERROR',
        statusCode: error.statusCode || 500
      },
      metadata: {
        timestamp: new Date().toISOString(),
        service: this.name
      }
    };

    if (includeStack && this.config.isDevelopment) {
      response.error.stack = error.stack;
    }

    return response;
  }

  /**
   * Batch process items with concurrency control
   */
  async batchProcess(items, processor, batchSize = 10) {
    const results = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(item => processor(item).catch(error => ({
          error: true,
          message: error.message,
          item
        })))
      );
      results.push(...batchResults);
    }
    
    return results;
  }
}

export default BaseService;