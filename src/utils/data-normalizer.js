/**
 * Data Normalization Utility
 * Provides consistent data parsing and normalization across the application
 */

import { createLogger } from './logger.js';

const logger = createLogger('DataNormalizer');

/**
 * Parse a score value from various input formats
 */
export function parseScore(value, defaultValue = null) {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }

  // Handle already numeric values
  if (typeof value === 'number') {
    return value;
  }

  // Convert string to number
  const parsed = Number(value);
  if (isNaN(parsed)) {
    logger.debug(`Failed to parse score: ${value}`);
    return defaultValue;
  }

  return parsed;
}

/**
 * Normalize a response value to a target scale
 */
export function normalizeResponse(value, sourceScale = [1, 7], targetScale = [0, 1]) {
  const score = parseScore(value);
  if (score === null) return null;

  // Clamp to source scale bounds
  const clampedScore = Math.max(sourceScale[0], Math.min(sourceScale[1], score));
  
  // Normalize to 0-1
  const normalized = (clampedScore - sourceScale[0]) / (sourceScale[1] - sourceScale[0]);
  
  // Scale to target range
  const scaled = normalized * (targetScale[1] - targetScale[0]) + targetScale[0];
  
  return Math.round(scaled * 100) / 100; // Round to 2 decimal places
}

/**
 * Convert categorical responses to numeric values
 */
export function convertCategoricalToNumeric(question, answer) {
  if (answer === null || answer === undefined || answer === '') {
    return null;
  }

  const answerLower = answer.toString().toLowerCase();
  
  // Binary responses
  if (/^(yes|true|agree|1)$/.test(answerLower)) return 1;
  if (/^(no|false|disagree|0)$/.test(answerLower)) return 0;
  
  // Likert scale text responses
  const likertMap = {
    'strongly disagree': 1,
    'disagree': 2,
    'somewhat disagree': 3,
    'neutral': 4,
    'somewhat agree': 5,
    'agree': 6,
    'strongly agree': 7
  };
  
  if (likertMap[answerLower]) {
    return likertMap[answerLower];
  }
  
  // Frequency responses
  const frequencyMap = {
    'never': 1,
    'rarely': 2,
    'sometimes': 3,
    'often': 4,
    'always': 5,
    'daily': 5,
    'weekly': 4,
    'monthly': 3,
    'yearly': 2
  };
  
  if (frequencyMap[answerLower]) {
    return frequencyMap[answerLower];
  }
  
  // Try to parse as number
  return parseScore(answer);
}

/**
 * Handle missing data with various strategies
 */
export function handleMissingData(data, strategy = 'default', defaultValue = null) {
  switch (strategy) {
    case 'default':
      return data ?? defaultValue;
      
    case 'mean':
      if (Array.isArray(data)) {
        const validValues = data.filter(v => v !== null && v !== undefined);
        if (validValues.length === 0) return defaultValue;
        return validValues.reduce((sum, v) => sum + v, 0) / validValues.length;
      }
      return data ?? defaultValue;
      
    case 'median':
      if (Array.isArray(data)) {
        const validValues = data.filter(v => v !== null && v !== undefined).sort((a, b) => a - b);
        if (validValues.length === 0) return defaultValue;
        const mid = Math.floor(validValues.length / 2);
        return validValues.length % 2 ? validValues[mid] : (validValues[mid - 1] + validValues[mid]) / 2;
      }
      return data ?? defaultValue;
      
    case 'forward':
      // For time series data, use last known value
      if (Array.isArray(data)) {
        let lastValid = defaultValue;
        return data.map(v => {
          if (v !== null && v !== undefined) {
            lastValid = v;
            return v;
          }
          return lastValid;
        });
      }
      return data ?? defaultValue;
      
    case 'interpolate':
      // Linear interpolation for missing values
      if (Array.isArray(data)) {
        const result = [...data];
        for (let i = 0; i < result.length; i++) {
          if (result[i] === null || result[i] === undefined) {
            // Find previous and next valid values
            let prevIdx = i - 1;
            let nextIdx = i + 1;
            
            while (prevIdx >= 0 && (result[prevIdx] === null || result[prevIdx] === undefined)) prevIdx--;
            while (nextIdx < result.length && (result[nextIdx] === null || result[nextIdx] === undefined)) nextIdx++;
            
            if (prevIdx >= 0 && nextIdx < result.length) {
              // Interpolate
              const prevVal = result[prevIdx];
              const nextVal = result[nextIdx];
              const steps = nextIdx - prevIdx;
              const step = (nextVal - prevVal) / steps;
              result[i] = prevVal + step * (i - prevIdx);
            } else if (prevIdx >= 0) {
              result[i] = result[prevIdx];
            } else if (nextIdx < result.length) {
              result[i] = result[nextIdx];
            } else {
              result[i] = defaultValue;
            }
          }
        }
        return result;
      }
      return data ?? defaultValue;
      
    default:
      return data ?? defaultValue;
  }
}

/**
 * Normalize an entire dataset
 */
export function normalizeDataset(dataset, fields, options = {}) {
  const {
    sourceScale = [1, 7],
    targetScale = [0, 1],
    missingStrategy = 'default',
    defaultValue = null
  } = options;
  
  return dataset.map(record => {
    const normalized = { ...record };
    
    fields.forEach(field => {
      if (field in record) {
        let value = record[field];
        
        // Handle missing data
        value = handleMissingData(value, missingStrategy, defaultValue);
        
        // Normalize if numeric
        if (value !== null && typeof value === 'number') {
          normalized[field] = normalizeResponse(value, sourceScale, targetScale);
        } else {
          normalized[field] = value;
        }
      }
    });
    
    return normalized;
  });
}

/**
 * Extract numeric features from mixed data
 */
export function extractNumericFeatures(record, fields) {
  const features = [];
  
  fields.forEach(field => {
    let value = record[field];
    
    // Convert categorical to numeric if needed
    if (typeof value === 'string') {
      value = convertCategoricalToNumeric(field, value);
    }
    
    // Parse score
    value = parseScore(value, 0);
    
    features.push(value);
  });
  
  return features;
}

/**
 * Calculate statistics for a numeric field
 */
export function calculateFieldStatistics(data, field) {
  const values = data
    .map(record => parseScore(record[field]))
    .filter(v => v !== null);
  
  if (values.length === 0) {
    return {
      field,
      count: 0,
      mean: null,
      median: null,
      min: null,
      max: null,
      std: null
    };
  }
  
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / values.length;
  
  // Calculate standard deviation
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  const std = Math.sqrt(avgSquaredDiff);
  
  // Calculate median
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 
    ? sorted[mid] 
    : (sorted[mid - 1] + sorted[mid]) / 2;
  
  return {
    field,
    count: values.length,
    mean: Math.round(mean * 100) / 100,
    median: Math.round(median * 100) / 100,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    std: Math.round(std * 100) / 100
  };
}

export default {
  parseScore,
  normalizeResponse,
  convertCategoricalToNumeric,
  handleMissingData,
  normalizeDataset,
  extractNumericFeatures,
  calculateFieldStatistics
};