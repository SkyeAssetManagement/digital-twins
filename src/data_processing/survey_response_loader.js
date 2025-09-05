import path from 'path';
import { createLogger } from '../utils/logger.js';
import { parseCSVFile } from '../utils/file-operations.js';
import { parseScore, calculateFieldStatistics } from '../utils/data-normalizer.js';
import { LOHAS_SEGMENTS, generateSegmentProfile } from '../utils/segment-analyzer.js';
import { DataPipeline } from '../utils/data-pipeline.js';
import { AppError } from '../utils/error-handler.js';

const logger = createLogger('SurveyResponseLoader');

export class SurveyResponseLoader {
  constructor() {
    // Initialize with LOHAS segments
    this.segmentResponses = {};
    Object.keys(LOHAS_SEGMENTS).forEach(segment => {
      this.segmentResponses[segment] = [];
    });
    this.loaded = false;
    this.cache = new Map();
    this.pipeline = null;
  }

  async loadResponses() {
    if (this.loaded) {
      logger.debug('Using cached responses');
      return this.segmentResponses;
    }
    
    logger.info('Loading survey responses');
    
    try {
      // Create pipeline for loading responses
      this.pipeline = new DataPipeline('survey-loader', {
        stopOnError: false,
        cacheResults: true
      });
      
      this.pipeline
        .stage('load-csv', async () => {
          const csvPath = path.join(process.cwd(), 'data', 'datasets', 'surf-clothing', 'refined-lohas-classification.csv');
          logger.info(`Loading CSV from ${csvPath}`);
          
          const data = await parseCSVFile(csvPath, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true
          });
          
          if (!data || data.length === 0) {
            throw new AppError('No data found in CSV file');
          }
          
          logger.info(`Loaded ${data.length} responses`);
          return data;
        })
        .stage('process-responses', async (data) => {
          return this.processResponses(data);
        })
        .stage('calculate-statistics', async (responses) => {
          return this.calculateStatistics(responses);
        });
      
      // Track progress
      this.pipeline.on('progress', (progress) => {
        logger.debug(`Loading progress: ${progress.stage} (${progress.percentage}%)`);
      });
      
      const data = await this.pipeline.execute();
      
      if (!data || data.length === 0) {
        logger.warn('No data loaded from CSV');
        return this.segmentResponses;
      }
      
      // Process was handled in pipeline
      this.segmentResponses = data;
      
      this.loaded = true;
      
      // Log statistics
      logger.info('Survey response statistics:');
      Object.entries(this.segmentResponses).forEach(([segment, responses]) => {
        logger.info(`  ${segment}: ${responses.length} respondents`);
      });
      
      return this.segmentResponses;
      
    } catch (error) {
      logger.error('Failed to load survey responses', error);
      throw new AppError(`Failed to load responses: ${error.message}`);
    }
  }
  
  processResponses(data) {
    const processed = {};
    
    // Initialize segments
    Object.keys(LOHAS_SEGMENTS).forEach(segment => {
      processed[segment] = [];
    });
    
    data.forEach(row => {
      const segment = row['LOHAS Segment'];
      if (!segment) return;
      
      // Extract key survey responses using data-normalizer
      const response = {
        respondentId: row['Respondent ID'],
        segment: segment,
        
        // Purchase behavior responses
        actualPurchase: parseScore(row['Actual Purchase (1-5)']),
        willingnessToPay: parseScore(row['Willingness to Pay 25% (1-5)']),
        
        // Value responses
        brandValues: parseScore(row['Brand Values (1-5)']),
        sustainability: parseScore(row['Sustainability (1-5)']),
        envEvangelist: parseScore(row['Env Evangelist (1-5)']),
        activism: parseScore(row['Activism (1-5)']),
        priceSensitivity: parseScore(row['Price Sensitivity (1-5)']),
        
        // Detailed scores
        compositeScore: parseScore(row['Composite Score'], 0),
        propensityScore: parseScore(row['Propensity Score'], 0),
        
        // Example responses based on scores
        exampleResponses: this.generateExampleResponses(row)
      };
      
      // Add to appropriate segment
      const segmentKey = segment.replace('LOHAS ', '');
      if (processed[segmentKey]) {
        processed[segmentKey].push(response);
      }
    });
    
    return processed;
  }
  
  calculateStatistics(responses) {
    // Calculate field statistics for each segment
    Object.entries(responses).forEach(([segment, segmentResponses]) => {
      if (segmentResponses.length > 0) {
        const stats = {
          actualPurchase: calculateFieldStatistics(segmentResponses, 'actualPurchase'),
          willingnessToPay: calculateFieldStatistics(segmentResponses, 'willingnessToPay'),
          sustainability: calculateFieldStatistics(segmentResponses, 'sustainability'),
          priceSensitivity: calculateFieldStatistics(segmentResponses, 'priceSensitivity')
        };
        
        // Cache statistics
        this.cache.set(`stats:${segment}`, stats);
      }
    });
    
    return responses;
  }
  
  generateExampleResponses(row) {
    const responses = [];
    
    // Generate responses based on actual survey scores using data-normalizer
    const sustainability = parseScore(row['Sustainability (1-5)']);
    const priceSensitivity = parseScore(row['Price Sensitivity (1-5)']);
    const brandValues = parseScore(row['Brand Values (1-5)']);
    const willingnessToPay = parseScore(row['Willingness to Pay 25% (1-5)']);
    
    // Sustainability response
    if (sustainability !== null) {
      if (sustainability >= 4) {
        responses.push({
          topic: 'sustainability',
          response: "Environmental impact is crucial to my purchasing decisions. I research brands' sustainability practices.",
          score: sustainability
        });
      } else if (sustainability >= 3) {
        responses.push({
          topic: 'sustainability',
          response: "I prefer sustainable options when the quality and price are reasonable.",
          score: sustainability
        });
      } else {
        responses.push({
          topic: 'sustainability',
          response: "Sustainability is nice to have but not my main concern when shopping.",
          score: sustainability
        });
      }
    }
    
    // Price response
    if (priceSensitivity !== null) {
      if (priceSensitivity >= 4) {
        responses.push({
          topic: 'price',
          response: "Price is my primary factor. I always compare and look for the best deals.",
          score: priceSensitivity
        });
      } else if (priceSensitivity >= 3) {
        responses.push({
          topic: 'price',
          response: "I balance price with quality. Good value is important to me.",
          score: priceSensitivity
        });
      } else {
        responses.push({
          topic: 'price',
          response: "I'm willing to pay more for products that align with my values.",
          score: priceSensitivity
        });
      }
    }
    
    // Brand values response
    if (brandValues !== null && brandValues >= 3) {
      responses.push({
        topic: 'brand',
        response: willingnessToPay >= 4 
          ? "I actively support brands that share my environmental values, even at premium prices."
          : "Brand values matter to me, but they need to be authentic, not just marketing.",
        score: brandValues
      });
    }
    
    return responses;
  }
  
  getRandomResponses(segment, count = 5, seedOffset = 0) {
    const segmentKey = segment.replace('LOHAS ', '');
    const responses = this.segmentResponses[segmentKey] || [];
    
    if (responses.length === 0) return [];
    
    // Use seedOffset to select different subsets for variety
    const startIdx = seedOffset % responses.length;
    const rotatedResponses = [
      ...responses.slice(startIdx),
      ...responses.slice(0, startIdx)
    ];
    
    // Select responses with deterministic variation
    const selected = [];
    const step = Math.max(1, Math.floor(responses.length / count));
    
    for (let i = 0; i < count && i * step < rotatedResponses.length; i++) {
      selected.push(rotatedResponses[i * step]);
    }
    
    // Fill remaining if needed
    while (selected.length < count && selected.length < responses.length) {
      const idx = selected.length;
      if (idx < rotatedResponses.length) {
        selected.push(rotatedResponses[idx]);
      } else {
        break;
      }
    }
    
    return selected;
  }
  
  getResponsesByScore(segment, scoreType, minScore) {
    const segmentKey = segment.replace('LOHAS ', '');
    const responses = this.segmentResponses[segmentKey] || [];
    
    return responses.filter(r => {
      const score = r[scoreType];
      return score !== null && score >= minScore;
    });
  }
  
  getAverageScores(segment) {
    const segmentKey = segment.replace('LOHAS ', '');
    
    // Check cache first
    const cachedStats = this.cache.get(`stats:${segmentKey}`);
    if (cachedStats) {
      const averages = {};
      Object.entries(cachedStats).forEach(([field, stats]) => {
        if (stats.mean !== null) {
          averages[field] = stats.mean.toFixed(2);
        }
      });
      return averages;
    }
    
    // Fallback to manual calculation
    const responses = this.segmentResponses[segmentKey] || [];
    if (responses.length === 0) return {};
    
    const fields = ['actualPurchase', 'willingnessToPay', 'brandValues', 
                   'sustainability', 'envEvangelist', 'activism', 'priceSensitivity'];
    
    const averages = {};
    fields.forEach(field => {
      const stats = calculateFieldStatistics(responses, field);
      if (stats.mean !== null) {
        averages[field] = stats.mean.toFixed(2);
      }
    });
    
    return averages;
  }
  
  clearCache() {
    this.cache.clear();
    logger.info('Cleared response loader cache');
  }
}

// Singleton instance
let loader = null;

export async function getSurveyResponseLoader() {
  if (!loader) {
    loader = new SurveyResponseLoader();
    await loader.loadResponses();
  }
  return loader;
}