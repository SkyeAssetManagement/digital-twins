/**
 * Segment Analysis Utility
 * Centralized segment management and analysis functions
 */

import { createLogger } from './logger.js';
import { parseScore, calculateFieldStatistics } from './data-normalizer.js';

const logger = createLogger('SegmentAnalyzer');

/**
 * LOHAS Segment Definitions
 */
export const LOHAS_SEGMENTS = {
  Leader: {
    name: 'Leader',
    percentage: 12.4,
    characteristics: {
      primaryMotivation: 'Environmental and social responsibility',
      purchasingBehavior: 'Willing to pay premium for sustainable products',
      brandLoyalty: 'High loyalty to values-aligned brands',
      priceElasticity: 'Low - values over price',
      innovationAdoption: 'Early adopters of sustainable innovations'
    },
    valueSystem: {
      sustainability: 0.95,
      priceConsciousness: 0.2,
      quality: 0.85,
      brandLoyalty: 0.8,
      innovation: 0.9,
      socialResponsibility: 0.95
    },
    personality: {
      openness: 0.9,
      conscientiousness: 0.85,
      extraversion: 0.7,
      agreeableness: 0.8,
      neuroticism: 0.3
    },
    demographicProfile: {
      education: 'Higher education',
      income: 'Above average',
      age: '25-55',
      urbanization: 'Urban/Suburban'
    }
  },
  
  Leaning: {
    name: 'Leaning',
    percentage: 22.6,
    characteristics: {
      primaryMotivation: 'Balance of sustainability and practicality',
      purchasingBehavior: 'Considers sustainable options when convenient',
      brandLoyalty: 'Moderate - switches for better value',
      priceElasticity: 'Moderate - seeks value',
      innovationAdoption: 'Early majority'
    },
    valueSystem: {
      sustainability: 0.65,
      priceConsciousness: 0.5,
      quality: 0.75,
      brandLoyalty: 0.6,
      innovation: 0.6,
      socialResponsibility: 0.65
    },
    personality: {
      openness: 0.7,
      conscientiousness: 0.7,
      extraversion: 0.6,
      agreeableness: 0.7,
      neuroticism: 0.4
    },
    demographicProfile: {
      education: 'College educated',
      income: 'Average to above average',
      age: '30-50',
      urbanization: 'Suburban'
    }
  },
  
  Learner: {
    name: 'Learner',
    percentage: 37.5,
    characteristics: {
      primaryMotivation: 'Value and practicality',
      purchasingBehavior: 'Price-conscious but curious about sustainability',
      brandLoyalty: 'Low - price driven',
      priceElasticity: 'High - very price sensitive',
      innovationAdoption: 'Late majority'
    },
    valueSystem: {
      sustainability: 0.35,
      priceConsciousness: 0.8,
      quality: 0.6,
      brandLoyalty: 0.4,
      innovation: 0.4,
      socialResponsibility: 0.35
    },
    personality: {
      openness: 0.5,
      conscientiousness: 0.6,
      extraversion: 0.5,
      agreeableness: 0.6,
      neuroticism: 0.5
    },
    demographicProfile: {
      education: 'High school to some college',
      income: 'Average',
      age: '25-60',
      urbanization: 'Mixed'
    }
  },
  
  Laggard: {
    name: 'Laggard',
    percentage: 27.5,
    characteristics: {
      primaryMotivation: 'Price and functionality',
      purchasingBehavior: 'Focus on immediate needs and cost',
      brandLoyalty: 'Low - purely transactional',
      priceElasticity: 'Very high - price is primary factor',
      innovationAdoption: 'Laggards'
    },
    valueSystem: {
      sustainability: 0.15,
      priceConsciousness: 0.95,
      quality: 0.5,
      brandLoyalty: 0.3,
      innovation: 0.2,
      socialResponsibility: 0.15
    },
    personality: {
      openness: 0.3,
      conscientiousness: 0.5,
      extraversion: 0.4,
      agreeableness: 0.5,
      neuroticism: 0.6
    },
    demographicProfile: {
      education: 'Varied',
      income: 'Below average to average',
      age: '30-65',
      urbanization: 'Rural/Suburban'
    }
  }
};

/**
 * Get LOHAS segment definitions
 */
export function getLOHASSegmentDefinitions() {
  return LOHAS_SEGMENTS;
}

/**
 * Get segment by name
 */
export function getSegmentDefinition(segmentName) {
  // Check exact match
  if (LOHAS_SEGMENTS[segmentName]) {
    return LOHAS_SEGMENTS[segmentName];
  }
  
  // Check case-insensitive match
  const normalizedName = segmentName.toLowerCase();
  const segment = Object.values(LOHAS_SEGMENTS).find(
    s => s.name.toLowerCase() === normalizedName
  );
  
  return segment || null;
}

/**
 * Map segment characteristics
 */
export function mapSegmentCharacteristics(segmentName) {
  const segment = getSegmentDefinition(segmentName);
  if (!segment) {
    logger.warn(`Unknown segment: ${segmentName}, using default characteristics`);
    return {
      primaryMotivation: 'General consumer',
      purchasingBehavior: 'Standard purchasing patterns',
      brandLoyalty: 'Average',
      priceElasticity: 'Moderate',
      innovationAdoption: 'Majority'
    };
  }
  return segment.characteristics;
}

/**
 * Generate value system scores for segment
 */
export function generateValueSystemScores(segmentName) {
  const segment = getSegmentDefinition(segmentName);
  if (!segment) {
    logger.warn(`Unknown segment: ${segmentName}, using balanced scores`);
    return {
      sustainability: 0.5,
      priceConsciousness: 0.5,
      quality: 0.5,
      brandLoyalty: 0.5,
      innovation: 0.5,
      socialResponsibility: 0.5
    };
  }
  return { ...segment.valueSystem };
}

/**
 * Calculate segment statistics from responses
 */
export function calculateSegmentStatistics(responses, segmentField = 'segment') {
  const segments = {};
  
  responses.forEach(response => {
    const segment = response[segmentField];
    if (!segment) return;
    
    if (!segments[segment]) {
      segments[segment] = {
        name: segment,
        count: 0,
        responses: []
      };
    }
    
    segments[segment].count++;
    segments[segment].responses.push(response);
  });
  
  // Calculate statistics for each segment
  const statistics = {};
  
  Object.entries(segments).forEach(([segmentName, segmentData]) => {
    const definition = getSegmentDefinition(segmentName);
    
    statistics[segmentName] = {
      name: segmentName,
      count: segmentData.count,
      percentage: (segmentData.count / responses.length) * 100,
      expectedPercentage: definition?.percentage || null,
      deviation: definition 
        ? ((segmentData.count / responses.length) * 100) - definition.percentage
        : null,
      characteristics: mapSegmentCharacteristics(segmentName),
      valueSystem: generateValueSystemScores(segmentName)
    };
    
    // Add field statistics if responses have numeric fields
    if (segmentData.responses.length > 0) {
      const firstResponse = segmentData.responses[0];
      const numericFields = Object.keys(firstResponse).filter(key => 
        typeof firstResponse[key] === 'number'
      );
      
      statistics[segmentName].fieldStats = {};
      numericFields.forEach(field => {
        statistics[segmentName].fieldStats[field] = calculateFieldStatistics(
          segmentData.responses, 
          field
        );
      });
    }
  });
  
  return statistics;
}

/**
 * Classify response into segment based on scores
 */
export function classifyIntoSegment(scores) {
  const {
    sustainability = 0,
    priceConsciousness = 0,
    quality = 0,
    brandLoyalty = 0,
    innovation = 0
  } = scores;
  
  // Calculate distance to each segment's value system
  const distances = {};
  
  Object.entries(LOHAS_SEGMENTS).forEach(([name, segment]) => {
    const vs = segment.valueSystem;
    const distance = Math.sqrt(
      Math.pow(sustainability - vs.sustainability, 2) +
      Math.pow(priceConsciousness - vs.priceConsciousness, 2) +
      Math.pow(quality - vs.quality, 2) +
      Math.pow(brandLoyalty - vs.brandLoyalty, 2) +
      Math.pow(innovation - vs.innovation, 2)
    );
    distances[name] = distance;
  });
  
  // Find segment with minimum distance
  const classified = Object.entries(distances).reduce((min, [name, distance]) => 
    distance < min.distance ? { name, distance } : min,
    { name: null, distance: Infinity }
  );
  
  return {
    segment: classified.name,
    confidence: Math.max(0, 1 - (classified.distance / 2)), // Normalize to 0-1
    distances
  };
}

/**
 * Generate segment profile from responses
 */
export function generateSegmentProfile(responses, segmentName) {
  const segmentResponses = responses.filter(r => r.segment === segmentName);
  
  if (segmentResponses.length === 0) {
    return null;
  }
  
  const profile = {
    segment: segmentName,
    sampleSize: segmentResponses.length,
    percentage: (segmentResponses.length / responses.length) * 100
  };
  
  // Calculate average scores
  const scoreFields = [
    'sustainability',
    'priceSensitivity',
    'qualityImportance',
    'brandImportance',
    'innovationInterest'
  ];
  
  profile.averageScores = {};
  scoreFields.forEach(field => {
    const values = segmentResponses
      .map(r => parseScore(r[field]))
      .filter(v => v !== null);
    
    if (values.length > 0) {
      profile.averageScores[field] = 
        values.reduce((sum, v) => sum + v, 0) / values.length;
    }
  });
  
  // Extract common themes from text responses
  if (segmentResponses[0].comments) {
    const allComments = segmentResponses
      .map(r => r.comments)
      .filter(c => c)
      .join(' ');
    
    profile.commonThemes = extractThemes(allComments);
  }
  
  // Compare with expected profile
  const expected = getSegmentDefinition(segmentName);
  if (expected) {
    profile.expected = {
      percentage: expected.percentage,
      characteristics: expected.characteristics,
      valueSystem: expected.valueSystem
    };
    
    profile.alignment = calculateProfileAlignment(
      profile.averageScores,
      expected.valueSystem
    );
  }
  
  return profile;
}

/**
 * Calculate alignment between actual and expected profiles
 */
function calculateProfileAlignment(actual, expected) {
  const mappings = {
    sustainability: 'sustainability',
    priceSensitivity: 'priceConsciousness',
    qualityImportance: 'quality',
    brandImportance: 'brandLoyalty',
    innovationInterest: 'innovation'
  };
  
  let totalDiff = 0;
  let count = 0;
  
  Object.entries(mappings).forEach(([actualKey, expectedKey]) => {
    if (actual[actualKey] !== undefined && expected[expectedKey] !== undefined) {
      // Normalize actual score to 0-1 if needed
      const normalizedActual = actual[actualKey] > 1 
        ? actual[actualKey] / 7 
        : actual[actualKey];
      
      totalDiff += Math.abs(normalizedActual - expected[expectedKey]);
      count++;
    }
  });
  
  if (count === 0) return 0;
  
  // Return alignment score (1 = perfect alignment, 0 = no alignment)
  const avgDiff = totalDiff / count;
  return Math.max(0, 1 - avgDiff);
}

/**
 * Extract themes from text
 */
function extractThemes(text) {
  const themes = {
    environmental: /sustain|eco|green|environment|carbon|renewable/gi,
    price: /price|cost|afford|cheap|expensive|value|budget/gi,
    quality: /quality|durable|last|reliable|premium|superior/gi,
    brand: /brand|trust|reputation|authentic|heritage/gi,
    innovation: /innovat|new|technology|advanced|cutting-edge/gi,
    social: /social|community|ethical|responsible|fair/gi
  };
  
  const results = {};
  Object.entries(themes).forEach(([theme, pattern]) => {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      results[theme] = matches.length;
    }
  });
  
  return results;
}

/**
 * Map segment to persona attributes
 */
export function mapSegmentToPersona(segmentName) {
  const segment = getSegmentDefinition(segmentName);
  
  if (!segment) {
    return {
      segment: segmentName,
      description: 'Generic consumer profile',
      attributes: {
        sustainability: 0.5,
        priceConsciousness: 0.5,
        quality: 0.5,
        brandLoyalty: 0.5,
        innovation: 0.5
      }
    };
  }
  
  return {
    segment: segment.name,
    description: segment.characteristics.primaryMotivation,
    attributes: segment.valueSystem,
    personality: segment.personality,
    demographics: segment.demographicProfile,
    purchasingBehavior: segment.characteristics.purchasingBehavior,
    marketShare: segment.percentage
  };
}

export default {
  LOHAS_SEGMENTS,
  getLOHASSegmentDefinitions,
  getSegmentDefinition,
  mapSegmentCharacteristics,
  generateValueSystemScores,
  calculateSegmentStatistics,
  classifyIntoSegment,
  generateSegmentProfile,
  mapSegmentToPersona
};