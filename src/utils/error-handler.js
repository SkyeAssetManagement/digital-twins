/**
 * Standardized Error Handling Utilities
 */

import { createLogger } from './logger.js';

const logger = createLogger('ErrorHandler');

export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }
}

export class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource, identifier = null) {
    const message = identifier 
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ExternalServiceError extends AppError {
  constructor(service, message, originalError = null) {
    super(`${service} service error: ${message}`, 502, 'EXTERNAL_SERVICE_ERROR');
    this.name = 'ExternalServiceError';
    this.service = service;
    this.originalError = originalError;
  }
}

/**
 * Standardized error response handler for API endpoints
 */
export function handleApiError(error, req, res) {
  logger.error('API Error occurred', error, {
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent']
  });

  // Handle known application errors
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
      details: error.details,
      timestamp: new Date().toISOString()
    });
  }

  // Handle unexpected errors
  const isDevelopment = process.env.NODE_ENV === 'development';
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    details: isDevelopment ? error.message : undefined,
    stack: isDevelopment ? error.stack : undefined,
    timestamp: new Date().toISOString()
  });
}

/**
 * Async error wrapper for API handlers
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(error => {
      handleApiError(error, req, res);
    });
  };
}

/**
 * Retry utility for external service calls
 */
export async function withRetry(fn, maxRetries = 3, delay = 1000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      logger.warn(`Attempt ${attempt} failed, retrying...`, error, { attempt, maxRetries });
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  }
  
  throw lastError;
}

export default {
  AppError,
  ValidationError,
  NotFoundError,
  ExternalServiceError,
  handleApiError,
  asyncHandler,
  withRetry
};
