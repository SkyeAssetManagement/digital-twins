import kmeans from 'ml-kmeans';
import fetch from 'node-fetch';
import { createLogger } from '../utils/logger.js';
import { 
  convertCategoricalToNumeric,
  extractNumericFeatures,
  normalizeResponse,
  calculateFieldStatistics
} from '../utils/data-normalizer.js';
import {
  classifyIntoSegment,
  generateSegmentProfile,
  LOHAS_SEGMENTS
} from '../utils/segment-analyzer.js';
import { DataPipeline } from '../utils/data-pipeline.js';
import { appConfig } from '../config/app-config.js';
import { withRetry, ExternalServiceError } from '../utils/error-handler.js';

const logger = createLogger('SegmentDiscovery');

export class SegmentDiscovery {
  constructor() {
    this.claudeApiUrl = "https://api.anthropic.com/v1/messages";
    this.cache = new Map();
    this.pipeline = null;
  }
  
  async findSegments(surveyData, pdfInsights, config) {
    logger.info('Starting segment discovery');
    
    // Create pipeline for segment discovery
    this.pipeline = new DataPipeline('segment-discovery', {
      stopOnError: false,
      cacheResults: true
    });
    
    this.pipeline
      .stage('extract-features', async () => {
        logger.info('Extracting features from responses');
        return await this.extractFeatures(surveyData.responses || surveyData);
      })
      .stage('determine-clusters', async (features) => {
        logger.info('Determining optimal number of clusters');
        const optimalK = await this.findOptimalClusters(features, config);
        return { features, optimalK };
      })
      .stage('perform-clustering', async ({ features, optimalK }) => {
        logger.info(`Performing clustering with k=${optimalK}`);
        const clusters = kmeans(features, optimalK, {
          initialization: 'kmeans++',
          seed: 42,
          maxIterations: 100
        });
        return { features, clusters, optimalK };
      })
      .stage('interpret-segments', async ({ clusters }) => {
        logger.info('Interpreting clusters as segments');
        const responses = surveyData.responses || surveyData;
        return await this.interpretClusters(clusters, responses, pdfInsights);
      });
    
    // Track progress
    this.pipeline.on('progress', (progress) => {
      logger.info(`Discovery progress: ${progress.stage} (${progress.percentage}%)`);
    });
    
    try {
      const segments = await this.pipeline.execute();
      logger.info(`Discovered ${segments.length} segments`);
      return segments;
    } catch (error) {
      logger.error('Segment discovery failed', error);
      throw error;
    }
  }
  
  async extractFeatures(responses) {
    const features = [];
    
    for (const respondent of responses) {
      const featureVector = await this.createFeatureVector(respondent.responses);
      features.push(featureVector);
    }
    
    return features;
  }
  
  async createFeatureVector(responses) {
    const vector = [];
    
    // Extract numeric features from responses using data-normalizer
    for (const [question, answer] of Object.entries(responses)) {
      if (answer === null || answer === undefined) {
        vector.push(0); // Default for missing values
      } else {
        // Use data-normalizer functions
        const numeric = convertCategoricalToNumeric(question, answer);
        if (numeric !== null) {
          // Normalize to 0-1 range (assuming 1-7 scale)
          const normalized = normalizeResponse(numeric, [1, 7], [0, 1]);
          vector.push(normalized);
        } else {
          // Handle non-convertible values
          vector.push(this.hashValue(answer));
        }
      }
    }
    
    // Ensure consistent vector length
    while (vector.length < 100) {
      vector.push(0);
    }
    
    return vector.slice(0, 100); // Limit to 100 features
  }
  
  hashValue(value) {
    // Simple hash function for non-numeric values
    const str = String(value);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash % 100) / 100;
  }
  
  // encodeCategory method removed - now using convertCategoricalToNumeric from data-normalizer
  
  async findOptimalClusters(features, config) {
    // If predefined segments exist, use that count
    if (config?.predefinedSegments?.length) {
      logger.info(`Using predefined segment count: ${config.predefinedSegments.length}`);
      return config.predefinedSegments.length;
    }
    
    // Default to LOHAS segment count if available
    const lohasCount = Object.keys(LOHAS_SEGMENTS).length;
    if (config?.useLohasSegments) {
      logger.info(`Using LOHAS segment count: ${lohasCount}`);
      return lohasCount;
    }
    
    // Use elbow method to find optimal K
    const maxK = Math.min(10, Math.floor(features.length / 10));
    const minK = 3;
    const inertias = [];
    
    logger.debug(`Testing cluster counts from ${minK} to ${maxK}`);
    
    for (let k = minK; k <= maxK; k++) {
      try {
        const result = kmeans(features, k, {
          initialization: 'kmeans++',
          seed: 42,
          maxIterations: 50
        });
        inertias.push(result.inertia || result.centroids.length);
      } catch (error) {
        logger.error(`Error with k=${k}`, error);
        inertias.push(Infinity);
      }
    }
    
    // Find elbow point (simplified)
    let optimalK = 4; // Default
    
    if (inertias.length > 2) {
      // Calculate rate of change
      const changes = [];
      for (let i = 1; i < inertias.length; i++) {
        changes.push(inertias[i - 1] - inertias[i]);
      }
      
      // Find where rate of change stabilizes
      for (let i = 1; i < changes.length; i++) {
        if (changes[i] / changes[i - 1] > 0.8) {
          optimalK = minK + i;
          break;
        }
      }
    }
    
    return Math.min(Math.max(optimalK, 3), 6); // Between 3 and 6 segments
  }
  
  async interpretClusters(clusters, responses, pdfInsights) {
    const segments = [];
    const numClusters = clusters.clusters || clusters.centroids.length;
    
    for (let i = 0; i < numClusters; i++) {
      const clusterResponses = responses.filter((_, idx) => 
        (clusters.labels || clusters.clusters)[idx] === i
      );
      
      // Analyze cluster characteristics
      const characteristics = await this.analyzeClusterCharacteristics(
        clusterResponses,
        pdfInsights
      );
      
      // Generate segment name and profile
      const segment = await this.generateSegmentProfile(
        characteristics, 
        pdfInsights,
        i
      );
      
      segments.push({
        id: `segment_${i}`,
        name: segment.name,
        characteristics: segment.characteristics,
        valueSystem: segment.valueSystem,
        size: clusterResponses.length,
        percentage: (clusterResponses.length / responses.length) * 100
      });
    }
    
    return segments;
  }
  
  async analyzeClusterCharacteristics(clusterResponses, pdfInsights) {
    const characteristics = {
      avgResponses: {},
      dominantValues: [],
      behavioralPatterns: [],
      statistics: {}
    };
    
    if (clusterResponses.length === 0) {
      return characteristics;
    }
    
    // Get all unique fields
    const allFields = new Set();
    clusterResponses.forEach(r => {
      Object.keys(r.responses).forEach(field => allFields.add(field));
    });
    
    // Calculate statistics for each field using data-normalizer
    allFields.forEach(field => {
      const stats = calculateFieldStatistics(clusterResponses.map(r => ({
        [field]: r.responses[field]
      })), field);
      
      if (stats.count > 0) {
        characteristics.avgResponses[field] = stats.mean;
        characteristics.statistics[field] = stats;
      }
    });
    
    // Identify dominant values
    const importanceQuestions = Object.keys(characteristics.avgResponses)
      .filter(q => q.toLowerCase().includes('important') || 
                   q.toLowerCase().includes('value'));
    
    for (const question of importanceQuestions) {
      const avg = characteristics.avgResponses[question];
      if (avg > 5) { // Assuming 7-point scale
        characteristics.dominantValues.push({
          question,
          strength: avg / 7
        });
      }
    }
    
    return characteristics;
  }
  
  async generateSegmentProfile(characteristics, pdfInsights, clusterIndex) {
    const apiKey = appConfig.anthropic.apiKey;
    
    // Check cache first
    const cacheKey = `profile:${clusterIndex}:${JSON.stringify(characteristics).substring(0, 100)}`;
    if (this.cache.has(cacheKey)) {
      logger.debug(`Using cached profile for cluster ${clusterIndex}`);
      return this.cache.get(cacheKey);
    }
    
    // If no API key or it's placeholder, use fallback
    if (!apiKey || apiKey === 'your_api_key_here') {
      logger.warn('No API key, using fallback profile');
      return this.generateFallbackProfile(characteristics, clusterIndex);
    }
    
    // Use Claude to interpret the cluster characteristics
    const prompt = `Given these consumer characteristics:
${JSON.stringify(characteristics, null, 2)}

And these market research insights:
${JSON.stringify(pdfInsights.keyFindings?.slice(0, 5) || [], null, 2)}

Generate a consumer segment profile with:
1. A descriptive name (e.g., "Eco-Conscious Enthusiast", "Price-Sensitive Pragmatist")
2. Key characteristics (3-5 bullet points)
3. Value system (sustainability, price, quality, brand, social influence) rated 0-1
4. Purchase decision factors

Respond in JSON format with keys: name, characteristics, valueSystem, decisionFactors`;

    try {
      // Use retry logic for API calls
      const response = await withRetry(async () => {
        const res = await fetch(this.claudeApiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: appConfig.anthropic.model,
            max_tokens: 500,
            messages: [{ role: "user", content: prompt }]
          })
        });
        
        if (!res.ok) {
          throw new ExternalServiceError('Claude', `API request failed: ${res.status}`);
        }
        
        return res;
      }, 3, 1000);
      
      const data = await response.json();
      const profile = JSON.parse(data.content[0].text);
      
      // Cache the result
      this.cache.set(cacheKey, profile);
      logger.info(`Generated profile for cluster ${clusterIndex}`);
      
      return profile;
    } catch (error) {
      logger.error('Claude API error', error);
      return this.generateFallbackProfile(characteristics, clusterIndex);
    }
  }
  
  generateFallbackProfile(characteristics, clusterIndex) {
    logger.debug(`Generating fallback profile for cluster ${clusterIndex}`);
    
    // Try to classify into LOHAS segments based on characteristics
    const scores = this.extractScoresFromCharacteristics(characteristics);
    const classification = classifyIntoSegment(scores);
    
    if (classification.confidence > 0.5) {
      // Use LOHAS segment if classification is confident
      const segment = LOHAS_SEGMENTS[classification.segment];
      if (segment) {
        logger.debug(`Classified as ${classification.segment} with confidence ${classification.confidence}`);
        return {
          name: segment.name,
          characteristics: segment.characteristics,
          valueSystem: segment.valueSystem,
          decisionFactors: Object.keys(segment.characteristics)
        };
      }
    }
    
    // Generate profile based on characteristics
    const avgValues = Object.values(characteristics.avgResponses || {});
    const avgScore = avgValues.length > 0 
      ? avgValues.reduce((a, b) => a + b, 0) / avgValues.length 
      : 0.5;
    
    const profiles = [
      {
        name: "Progressive Innovators",
        characteristics: {
          main: "Early adopters who prioritize innovation and sustainability",
          behavior: "Actively seek new sustainable products",
          shopping: "Research extensively before purchasing",
          influence: "Strong social media presence and influence"
        },
        valueSystem: {
          sustainability: 0.9,
          priceConsciousness: 0.3,
          brandLoyalty: 0.7,
          environmentalConcern: 0.85,
          socialInfluence: 0.8,
          quality: 0.8,
          innovation: 0.9
        },
        decisionFactors: ["Environmental impact", "Product innovation", "Brand values", "Peer recommendations"]
      },
      {
        name: "Practical Optimizers",
        characteristics: {
          main: "Value-conscious consumers who balance quality with price",
          behavior: "Compare options thoroughly before buying",
          shopping: "Look for best value propositions",
          influence: "Influenced by reviews and ratings"
        },
        valueSystem: {
          sustainability: 0.6,
          priceConsciousness: 0.7,
          brandLoyalty: 0.5,
          environmentalConcern: 0.5,
          socialInfluence: 0.6,
          quality: 0.8,
          innovation: 0.5
        },
        decisionFactors: ["Price-quality ratio", "Product reviews", "Durability", "Practical benefits"]
      },
      {
        name: "Traditional Loyalists",
        characteristics: {
          main: "Brand-loyal consumers who prefer established products",
          behavior: "Stick with familiar brands and products",
          shopping: "Shop at regular stores and websites",
          influence: "Trust traditional advertising and recommendations"
        },
        valueSystem: {
          sustainability: 0.3,
          priceConsciousness: 0.6,
          brandLoyalty: 0.9,
          environmentalConcern: 0.3,
          socialInfluence: 0.4,
          quality: 0.7,
          innovation: 0.3
        },
        decisionFactors: ["Brand reputation", "Past experience", "Convenience", "Traditional values"]
      },
      {
        name: "Budget Conscious",
        characteristics: {
          main: "Price-focused consumers seeking maximum value",
          behavior: "Hunt for deals and discounts",
          shopping: "Compare prices across multiple sources",
          influence: "Motivated by sales and promotions"
        },
        valueSystem: {
          sustainability: 0.2,
          priceConsciousness: 0.95,
          brandLoyalty: 0.2,
          environmentalConcern: 0.2,
          socialInfluence: 0.3,
          quality: 0.5,
          innovation: 0.2
        },
        decisionFactors: ["Lowest price", "Discounts available", "Basic functionality", "Value for money"]
      }
    ];
    
    // Select profile based on cluster index
    const profile = profiles[clusterIndex % profiles.length];
    
    // Adjust based on actual characteristics if available
    if (avgScore > 0.7) {
      // High engagement cluster
      profile.valueSystem.sustainability += 0.1;
      profile.valueSystem.quality += 0.1;
    } else if (avgScore < 0.3) {
      // Low engagement cluster
      profile.valueSystem.priceConsciousness += 0.1;
      profile.valueSystem.brandLoyalty -= 0.1;
    }
    
    // Normalize value system (ensure all values are between 0 and 1)
    for (const key of Object.keys(profile.valueSystem)) {
      profile.valueSystem[key] = Math.min(1, Math.max(0, profile.valueSystem[key]));
    }
    
    return profile;
  }
  
  extractScoresFromCharacteristics(characteristics) {
    const scores = {
      sustainability: 0,
      priceConsciousness: 0,
      quality: 0,
      brandLoyalty: 0,
      innovation: 0
    };
    
    // Extract scores from average responses
    Object.entries(characteristics.avgResponses || {}).forEach(([question, value]) => {
      const q = question.toLowerCase();
      
      if (q.includes('sustain') || q.includes('environment')) {
        scores.sustainability = Math.max(scores.sustainability, value / 7);
      }
      if (q.includes('price') || q.includes('cost')) {
        scores.priceConsciousness = Math.max(scores.priceConsciousness, value / 7);
      }
      if (q.includes('quality') || q.includes('durable')) {
        scores.quality = Math.max(scores.quality, value / 7);
      }
      if (q.includes('brand') || q.includes('loyalty')) {
        scores.brandLoyalty = Math.max(scores.brandLoyalty, value / 7);
      }
      if (q.includes('innovat') || q.includes('new')) {
        scores.innovation = Math.max(scores.innovation, value / 7);
      }
    });
    
    return scores;
  }
  
  clearCache() {
    const cacheSize = this.cache.size;
    this.cache.clear();
    logger.info(`Cleared segment cache (${cacheSize} entries)`);
  }
}