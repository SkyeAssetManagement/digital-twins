import { createUnifiedVectorStore } from '../src/vector_db/unified_vector_store.js';
import { DynamicTwinGenerator } from '../src/digital_twins/twin_generator.js';
import { DatasetAwareResponseEngine } from '../src/digital_twins/response_engine.js';
import { createLogger } from '../src/utils/logger.js';
import { asyncHandler, ValidationError } from '../src/utils/error-handler.js';
import { appConfig } from '../src/config/app-config.js';
import fs from 'fs/promises';
import path from 'path';

// Cache for twins to avoid regenerating
const twinCache = new Map();
const logger = createLogger('GenerateResponseAPI');

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    throw new ValidationError('Method not allowed. Use POST.');
  }

  const { 
    marketingContent, 
    imageData, 
    datasetId = 'surf-clothing',
    segments = ['Leader', 'Leaning', 'Learner', 'Laggard']
  } = req.body;

  if (!marketingContent) {
    throw new ValidationError('Marketing content is required');
  }

  logger.info('Generating responses', { datasetId, segments: segments.length });
  
  // Initialize unified vector store with proper configuration
  try {
    const vectorStore = await createUnifiedVectorStore(datasetId, {
      embeddingProvider: appConfig.openai.apiKey ? 'openai-small' : 'local-minilm'
    });

    // Load dataset config
    const configPath = path.join(process.cwd(), 'data', 'datasets', datasetId, 'config.json');
    let config;
    
    try {
      const configData = await fs.readFile(configPath, 'utf8');
      config = JSON.parse(configData);
    } catch (error) {
      logger.warn('Config not found, using defaults', { datasetId });
      config = {
        id: datasetId,
        name: datasetId,
        description: 'Custom dataset',
        predefinedSegments: segments
      };
    }

    // Load our survey-based digital twins if using surf-clothing dataset
    let digitalTwins = null;
    if (datasetId === 'surf-clothing') {
      try {
        const twinsPath = path.join(process.cwd(), 'data', 'digital-twins', 'surf-clothing-personas.json');
      const twinsData = await fs.readFile(twinsPath, 'utf8');
      digitalTwins = JSON.parse(twinsData);
      logger.info('Loaded survey-based digital twins');
      } catch (error) {
      logger.debug('Digital twins not found, using generated twins');
      }
    }

    // Generate responses for each segment
    const responses = [];
    
    for (const segment of segments) {
      try {
        let twin;
        
        // Use survey-based twins if available
        if (digitalTwins) {
          const segmentKey = `LOHAS ${segment}`;
          if (digitalTwins[segmentKey]) {
            const twinData = digitalTwins[segmentKey];
            twin = {
              segment: segment,
              persona: {
                name: `${segment} Consumer`,
                description: `${twinData.percentage} of market`
              },
              valueSystem: {
                sustainability: parseFloat(twinData.purchasing?.sustainabilityImportance?.averageScore || 3) / 5,
                priceConsciousness: (5 - parseFloat(twinData.purchasing?.priceImportance?.averageScore || 3)) / 5,
                quality: parseFloat(twinData.purchasing?.qualityImportance?.averageScore || 4) / 5,
                brandLoyalty: parseFloat(twinData.purchasing?.brandImportance?.averageScore || 3) / 5,
                innovation: 0.5 // Default middle value
              },
              characteristics: twinData.keyCharacteristics,
              exampleResponses: twinData.exampleResponses
            };
          logger.debug('Using survey-based twin', { segment, marketShare: twinData.percentage });
          }
        }
        
        // Fallback to generated twin if not available
        if (!twin) {
          const cacheKey = `${datasetId}_${segment}`;
          twin = twinCache.get(cacheKey);
          
          if (!twin) {
            const twinGenerator = new DynamicTwinGenerator(vectorStore, config);
            twin = await twinGenerator.generateTwin(segment, 0);
            twinCache.set(cacheKey, twin);
            setTimeout(() => twinCache.delete(cacheKey), 10 * 60 * 1000);
          }
        }

        // Generate response
        const responseEngine = new DatasetAwareResponseEngine(twin, vectorStore);
        const response = await responseEngine.generateResponse(marketingContent, imageData);

        responses.push({
          segment: segment,
          persona: twin.persona,
          response: response.text,
          sentiment: response.sentiment,
          purchaseIntent: response.purchaseIntent,
          keyFactors: response.keyFactors || [],
          valueSystem: twin.valueSystem
        });
      } catch (error) {
      logger.error('Error generating response for segment', error, { segment });
        
        // NO FALLBACK RESPONSES - Return NA as per requirements
        responses.push({
          segment: segment,
          persona: { name: `${segment} Consumer` },
          response: 'NA',
          sentiment: 'NA',
          purchaseIntent: 0,
          keyFactors: [],
          valueSystem: {}
        });
      }
    }

    // Calculate aggregate metrics
    const aggregateMetrics = calculateAggregateMetrics(responses);

    // Close database connection
    await vectorStore.close();

    res.json({
      success: true,
      datasetId,
      responses,
      aggregateMetrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // Note: Error handling is managed by asyncHandler wrapper
    throw error;
  }
};

// Export with error handling wrapper
export default asyncHandler(handler);

function calculateAggregateMetrics(responses) {
  const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
  let totalPurchaseIntent = 0;
  const allKeyFactors = {};

  responses.forEach(r => {
    sentimentCounts[r.sentiment]++;
    totalPurchaseIntent += r.purchaseIntent;
    
    r.keyFactors.forEach(factor => {
      allKeyFactors[factor] = (allKeyFactors[factor] || 0) + 1;
    });
  });

  return {
    avgPurchaseIntent: responses.length > 0 
      ? (totalPurchaseIntent / responses.length).toFixed(1) 
      : 0,
    sentimentDistribution: sentimentCounts,
    topKeyFactors: Object.entries(allKeyFactors)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([factor, count]) => ({ factor, count })),
    segmentCount: responses.length
  };
}