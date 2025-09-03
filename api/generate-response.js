import { VectorStore } from '../src/vector_db/vector_store.js';
import { DynamicTwinGenerator } from '../src/digital_twins/twin_generator.js';
import { DatasetAwareResponseEngine } from '../src/digital_twins/response_engine.js';
import fs from 'fs/promises';
import path from 'path';

// Cache for twins to avoid regenerating
const twinCache = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      marketingContent, 
      imageData, 
      datasetId = 'surf-clothing',
      segments = ['Leader', 'Leaning', 'Learner', 'Laggard']
    } = req.body;

    if (!marketingContent) {
      return res.status(400).json({ error: 'Marketing content is required' });
    }

    console.log(`Generating responses for dataset: ${datasetId}`);
    
    // Initialize vector store
    const vectorStore = new VectorStore(datasetId);
    await vectorStore.initialize();

    // Load dataset config
    const configPath = path.join(process.cwd(), 'data', 'datasets', datasetId, 'config.json');
    let config;
    
    try {
      const configData = await fs.readFile(configPath, 'utf8');
      config = JSON.parse(configData);
    } catch (error) {
      console.warn(`Config not found for ${datasetId}, using defaults`);
      config = {
        id: datasetId,
        name: datasetId,
        description: 'Custom dataset',
        predefinedSegments: segments
      };
    }

    // Generate responses for each segment
    const responses = [];
    
    for (const segment of segments) {
      try {
        // Check cache first
        const cacheKey = `${datasetId}_${segment}`;
        let twin = twinCache.get(cacheKey);
        
        if (!twin) {
          // Generate new twin
          const twinGenerator = new DynamicTwinGenerator(vectorStore, config);
          twin = await twinGenerator.generateTwin(segment, 0);
          
          // Cache for 10 minutes
          twinCache.set(cacheKey, twin);
          setTimeout(() => twinCache.delete(cacheKey), 10 * 60 * 1000);
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
        console.error(`Error generating response for segment ${segment}:`, error);
        
        // Add fallback response
        responses.push({
          segment: segment,
          persona: { name: `${segment} Consumer` },
          response: `As a ${segment.toLowerCase()} consumer, I would need more information to evaluate this product.`,
          sentiment: 'neutral',
          purchaseIntent: 5,
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
    console.error('API error:', error);
    res.status(500).json({ 
      error: 'Failed to generate responses',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

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