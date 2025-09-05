/**
 * Validation Middleware
 * Provides request validation and sanitization
 */

import { ValidationError } from '../utils/error-handler.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ValidationMiddleware');

/**
 * Validation schemas for common request patterns
 */
export const schemas = {
  datasetId: {
    type: 'string',
    pattern: /^[a-zA-Z0-9-_]+$/,
    minLength: 1,
    maxLength: 100,
    required: true,
    description: 'Dataset identifier'
  },
  
  segment: {
    type: 'string',
    enum: ['Leader', 'Leaning', 'Learner', 'Laggard', 'Segment_1', 'Segment_2', 'Segment_3', 'Segment_4'],
    required: true,
    description: 'Segment name'
  },
  
  variant: {
    type: 'number',
    min: 0,
    max: 10,
    default: 0,
    description: 'Response variant'
  },
  
  marketingContent: {
    type: 'string',
    minLength: 10,
    maxLength: 10000,
    required: true,
    description: 'Marketing content to analyze'
  },
  
  imageData: {
    type: 'string',
    pattern: /^data:image\/(jpeg|jpg|png|gif|webp);base64,/,
    maxLength: 10000000, // ~10MB
    description: 'Base64 encoded image data'
  },
  
  email: {
    type: 'string',
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    description: 'Email address'
  },
  
  url: {
    type: 'string',
    pattern: /^https?:\/\/.+/,
    description: 'URL'
  },
  
  count: {
    type: 'number',
    min: 1,
    max: 100,
    default: 3,
    description: 'Number of items'
  },
  
  mode: {
    type: 'string',
    enum: ['claude', 'semantic', 'hybrid'],
    default: 'hybrid',
    description: 'Response generation mode'
  }
};

/**
 * Validate value against schema
 */
function validateValue(value, schema, fieldName) {
  // Check required
  if (schema.required && (value === undefined || value === null || value === '')) {
    throw new ValidationError(`${fieldName} is required`);
  }
  
  // If not required and no value, use default or return
  if (value === undefined || value === null) {
    return schema.default !== undefined ? schema.default : value;
  }
  
  // Type validation
  if (schema.type) {
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== schema.type) {
      // Try type coercion for numbers
      if (schema.type === 'number' && actualType === 'string') {
        const num = Number(value);
        if (isNaN(num)) {
          throw new ValidationError(`${fieldName} must be a number`);
        }
        value = num;
      } else {
        throw new ValidationError(`${fieldName} must be of type ${schema.type}`);
      }
    }
  }
  
  // String validation
  if (schema.type === 'string') {
    if (schema.minLength && value.length < schema.minLength) {
      throw new ValidationError(`${fieldName} must be at least ${schema.minLength} characters`);
    }
    if (schema.maxLength && value.length > schema.maxLength) {
      throw new ValidationError(`${fieldName} must not exceed ${schema.maxLength} characters`);
    }
    if (schema.pattern && !schema.pattern.test(value)) {
      throw new ValidationError(`${fieldName} has invalid format`);
    }
    if (schema.enum && !schema.enum.includes(value)) {
      throw new ValidationError(`${fieldName} must be one of: ${schema.enum.join(', ')}`);
    }
  }
  
  // Number validation
  if (schema.type === 'number') {
    if (schema.min !== undefined && value < schema.min) {
      throw new ValidationError(`${fieldName} must be at least ${schema.min}`);
    }
    if (schema.max !== undefined && value > schema.max) {
      throw new ValidationError(`${fieldName} must not exceed ${schema.max}`);
    }
  }
  
  // Array validation
  if (schema.type === 'array') {
    if (schema.minItems && value.length < schema.minItems) {
      throw new ValidationError(`${fieldName} must contain at least ${schema.minItems} items`);
    }
    if (schema.maxItems && value.length > schema.maxItems) {
      throw new ValidationError(`${fieldName} must not exceed ${schema.maxItems} items`);
    }
    if (schema.items) {
      value.forEach((item, index) => {
        validateValue(item, schema.items, `${fieldName}[${index}]`);
      });
    }
  }
  
  return value;
}

/**
 * Create validation middleware for specific schemas
 */
export function validate(schemaMap) {
  return (req, res, next) => {
    try {
      const validated = {};
      const errors = [];
      
      // Validate each field
      for (const [field, schemaName] of Object.entries(schemaMap)) {
        const schema = typeof schemaName === 'string' 
          ? schemas[schemaName] 
          : schemaName;
        
        if (!schema) {
          throw new Error(`Unknown schema: ${schemaName}`);
        }
        
        // Get value from request (check body, params, query)
        let value = req.body?.[field] ?? req.params?.[field] ?? req.query?.[field];
        
        try {
          validated[field] = validateValue(value, schema, field);
        } catch (error) {
          errors.push(error.message);
        }
      }
      
      if (errors.length > 0) {
        throw new ValidationError(`Validation failed: ${errors.join('; ')}`);
      }
      
      // Attach validated data to request
      req.validated = validated;
      next();
      
    } catch (error) {
      logger.warn('Validation failed', error, { 
        path: req.path,
        method: req.method 
      });
      
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          error: error.message,
          code: 'VALIDATION_ERROR'
        });
      }
      
      return res.status(500).json({
        success: false,
        error: 'Validation error',
        code: 'INTERNAL_ERROR'
      });
    }
  };
}

/**
 * Sanitize user input
 */
export function sanitize(fields) {
  return (req, res, next) => {
    try {
      for (const field of fields) {
        // Check all possible locations
        if (req.body?.[field]) {
          req.body[field] = sanitizeValue(req.body[field]);
        }
        if (req.params?.[field]) {
          req.params[field] = sanitizeValue(req.params[field]);
        }
        if (req.query?.[field]) {
          req.query[field] = sanitizeValue(req.query[field]);
        }
      }
      next();
    } catch (error) {
      logger.error('Sanitization error', error);
      next();
    }
  };
}

/**
 * Sanitize a value
 */
function sanitizeValue(value) {
  if (typeof value !== 'string') return value;
  
  // Remove script tags
  let sanitized = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove SQL injection patterns
  sanitized = sanitized.replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE)\b)/gi, '');
  
  // Remove common XSS patterns
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');
  
  // Encode HTML entities
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
  
  return sanitized.trim();
}

/**
 * Rate limiting middleware
 */
const requestCounts = new Map();

export function rateLimit(options = {}) {
  const {
    windowMs = 60000, // 1 minute
    maxRequests = 60,
    message = 'Too many requests, please try again later'
  } = options;
  
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    
    // Get or create request record
    let record = requestCounts.get(key);
    if (!record) {
      record = { count: 0, resetTime: now + windowMs };
      requestCounts.set(key, record);
    }
    
    // Reset if window expired
    if (now > record.resetTime) {
      record.count = 0;
      record.resetTime = now + windowMs;
    }
    
    // Increment count
    record.count++;
    
    // Check limit
    if (record.count > maxRequests) {
      logger.warn('Rate limit exceeded', { ip: req.ip, path: req.path });
      return res.status(429).json({
        success: false,
        error: message,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((record.resetTime - now) / 1000)
      });
    }
    
    // Add headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', maxRequests - record.count);
    res.setHeader('X-RateLimit-Reset', new Date(record.resetTime).toISOString());
    
    next();
  };
}

/**
 * Clean up old rate limit records periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of requestCounts.entries()) {
    if (now > record.resetTime + 60000) {
      requestCounts.delete(key);
    }
  }
}, 60000);

/**
 * Common validation patterns
 */
export const validationPatterns = {
  // Validate generate-response endpoint
  generateResponse: {
    datasetId: 'datasetId',
    segment: 'segment',
    marketingContent: 'marketingContent',
    variant: 'variant',
    mode: 'mode'
  },
  
  // Validate get-twin endpoint
  getTwin: {
    datasetId: 'datasetId',
    segment: 'segment',
    variant: 'variant'
  },
  
  // Validate analyze-image endpoint
  analyzeImage: {
    imageData: 'imageData'
  },
  
  // Validate dataset operations
  datasetOperation: {
    datasetId: 'datasetId'
  }
};

export default {
  validate,
  sanitize,
  rateLimit,
  schemas,
  validationPatterns
};