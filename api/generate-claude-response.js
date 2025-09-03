/**
 * Claude-Enhanced Response Generation API
 * Uses persona vectors for consistent personality expression
 */

import { DigitalTwinClaudeIntegration } from '../src/config/production_config.js';
import fs from 'fs/promises';
import path from 'path';

// Initialize Claude integration
let claudeIntegration = null;

async function initializeClaudeIntegration() {
  if (!claudeIntegration) {
    claudeIntegration = new DigitalTwinClaudeIntegration();
    console.log('Claude integration initialized');
  }
  return claudeIntegration;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      marketingContent,
      imageData,
      datasetId = 'surf-clothing',
      segments = ['Leader', 'Leaning', 'Learner', 'Laggard'],
      usePersonaVectors = true,
      conversationHistory = []
    } = req.body;

    if (!marketingContent) {
      return res.status(400).json({ error: 'Marketing content is required' });
    }

    console.log(`Generating Claude-enhanced responses for dataset: ${datasetId}`);
    console.log(`Using persona vectors: ${usePersonaVectors}`);

    // Initialize Claude integration
    const integration = await initializeClaudeIntegration();

    // Load survey-based digital twins if using surf-clothing dataset
    let digitalTwins = null;
    if (datasetId === 'surf-clothing') {
      try {
        const twinsPath = path.join(process.cwd(), 'data', 'digital-twins', 'surf-clothing-personas.json');
        const twinsData = await fs.readFile(twinsPath, 'utf8');
        digitalTwins = JSON.parse(twinsData);
        console.log('Loaded survey-based digital twins');
      } catch (error) {
        console.log('Digital twins not found, will generate from segment data');
      }
    }

    // Generate responses for each segment
    const responses = [];
    const queries = [marketingContent];

    for (const segment of segments) {
      try {
        let twinData = null;

        // Prepare twin data
        if (digitalTwins) {
          const segmentKey = `LOHAS ${segment}`;
          if (digitalTwins[segmentKey]) {
            const segmentData = digitalTwins[segmentKey];
            twinData = {
              id: `${datasetId}_${segment}`,
              pid: `${datasetId}_${segment}`,
              segment: segment,
              persona_json: {
                segment: segment,
                values: {
                  environmental_concern: segment === 'Leader' ? 0.95 : 
                                        segment === 'Leaning' ? 0.75 :
                                        segment === 'Learner' ? 0.50 : 0.25,
                  brand_loyalty: segment === 'Leader' ? 0.85 :
                                segment === 'Leaning' ? 0.70 :
                                segment === 'Learner' ? 0.55 : 0.45,
                  community_involvement: segment === 'Leader' ? 0.80 :
                                        segment === 'Leaning' ? 0.60 :
                                        segment === 'Learner' ? 0.45 : 0.30,
                  price_sensitivity: segment === 'Leader' ? 0.30 :
                                    segment === 'Leaning' ? 0.50 :
                                    segment === 'Learner' ? 0.70 : 0.90
                },
                demographics: segmentData.demographics || {},
                purchasing_behavior: segmentData.purchasing || {},
                characteristics: segmentData.keyCharacteristics || [],
                example_responses: segmentData.exampleResponses || []
              },
              market_size: segmentData.percentage || 'Unknown'
            };
          }
        }

        // Fallback to basic segment data
        if (!twinData) {
          twinData = {
            id: `${datasetId}_${segment}`,
            pid: `${datasetId}_${segment}`,
            segment: segment,
            persona_json: {
              segment: segment
            }
          };
        }

        // Process with Claude integration
        let segmentResponse;
        
        if (usePersonaVectors) {
          // Use full persona vector system
          const result = await integration.processDigitalTwin(twinData, queries);
          
          segmentResponse = {
            segment: segment,
            response: result.responses[0]?.response || 'Unable to generate response',
            sentiment: analyzeSentiment(result.responses[0]?.response),
            purchaseIntent: calculatePurchaseIntent(segment, result.responses[0]?.response),
            consistency: result.validation?.consistencyScore || 0,
            driftScore: result.responses[0]?.driftScore || 0,
            personaVector: result.personaVector ? result.personaVector.slice(0, 10) : [], // Send first 10 values
            marketSize: twinData.market_size || getMarketSize(segment)
          };
        } else {
          // Use simpler Claude helper without vectors
          const helper = integration.claudeHelper;
          const systemPrompt = helper.convertTwinPersonaToClaude(twinData.persona_json || twinData);
          const response = await helper.generateResponse(systemPrompt, marketingContent);
          
          segmentResponse = {
            segment: segment,
            response: response,
            sentiment: analyzeSentiment(response),
            purchaseIntent: calculatePurchaseIntent(segment, response),
            marketSize: twinData.market_size || getMarketSize(segment)
          };
        }

        // Add image analysis if provided
        if (imageData) {
          segmentResponse.imageAnalysis = `As a ${segment} consumer, I would evaluate the visual appeal based on my values.`;
        }

        responses.push(segmentResponse);
        console.log(`Generated response for ${segment} segment`);

      } catch (error) {
        console.error(`Error generating response for ${segment}:`, error);
        
        // Provide fallback response
        responses.push({
          segment: segment,
          response: getFallbackResponse(segment, marketingContent),
          sentiment: 'neutral',
          purchaseIntent: segment === 'Leader' ? 0.7 :
                         segment === 'Leaning' ? 0.5 :
                         segment === 'Learner' ? 0.3 : 0.1,
          error: error.message,
          marketSize: getMarketSize(segment)
        });
      }
    }

    // Get performance metrics
    const performanceReport = integration.getPerformanceReport();

    return res.status(200).json({
      success: true,
      datasetId: datasetId,
      segments: responses,
      metadata: {
        responseCount: responses.length,
        timestamp: new Date().toISOString(),
        usingPersonaVectors: usePersonaVectors,
        performance: performanceReport
      }
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      error: 'Failed to generate responses',
      message: error.message
    });
  }
}

/**
 * Analyze sentiment of response
 */
function analyzeSentiment(response) {
  if (!response) return 'neutral';
  
  const positive = ['great', 'excellent', 'love', 'amazing', 'wonderful', 'fantastic', 'impressed'];
  const negative = ['disappointing', 'poor', 'bad', 'terrible', 'awful', 'hate', 'worst'];
  
  const text = response.toLowerCase();
  
  let positiveCount = 0;
  let negativeCount = 0;
  
  for (const word of positive) {
    if (text.includes(word)) positiveCount++;
  }
  
  for (const word of negative) {
    if (text.includes(word)) negativeCount++;
  }
  
  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

/**
 * Calculate purchase intent based on segment and response
 */
function calculatePurchaseIntent(segment, response) {
  const baseIntent = {
    'Leader': 0.75,
    'Leaning': 0.55,
    'Learner': 0.35,
    'Laggard': 0.15
  };
  
  let intent = baseIntent[segment] || 0.3;
  
  if (!response) return intent;
  
  const text = response.toLowerCase();
  
  // Positive indicators
  if (text.includes('definitely') || text.includes('certainly') || text.includes('absolutely')) {
    intent += 0.15;
  }
  if (text.includes('interested') || text.includes('impressed') || text.includes('excited')) {
    intent += 0.1;
  }
  
  // Negative indicators
  if (text.includes('not interested') || text.includes('no thanks') || text.includes('pass')) {
    intent -= 0.2;
  }
  if (text.includes('expensive') || text.includes('overpriced') || text.includes('too much')) {
    intent -= 0.15;
  }
  
  // Clamp between 0 and 1
  return Math.max(0, Math.min(1, intent));
}

/**
 * Get market size for segment
 */
function getMarketSize(segment) {
  const sizes = {
    'Leader': '12.4%',
    'Leaning': '22.6%',
    'Learner': '37.5%',
    'Laggard': '27.5%'
  };
  
  return sizes[segment] || 'Unknown';
}

/**
 * Generate fallback response for segment
 */
function getFallbackResponse(segment, content) {
  const fallbacks = {
    'Leader': `As a sustainability-focused consumer (12.4% of market), I'm very interested in products that demonstrate genuine environmental commitment. I need to see certifications and transparent sustainability practices. I'm willing to pay 20-25% more for truly sustainable options. ${content ? 'Looking at this offering, I would want to know more about its environmental impact and ethical sourcing.' : ''}`,
    
    'Leaning': `As a conscientious consumer (22.6% of market), I balance sustainability with practicality. I appreciate eco-friendly products when they offer good overall value. I'm willing to pay 10-15% more for sustainable options if the quality justifies it. ${content ? 'This product would need to demonstrate both environmental benefits and practical value.' : ''}`,
    
    'Learner': `As a curious but price-conscious consumer (37.5% of market), I'm open to learning about sustainable products but need clear value propositions. Price is still my primary consideration, though I might pay 0-5% more if convinced of the benefits. ${content ? 'I would need more information about how this product balances cost with benefits.' : ''}`,
    
    'Laggard': `As a traditional consumer (27.5% of market), I focus primarily on price and functionality. Environmental claims don't significantly influence my purchasing decisions. I need products that offer practical value at competitive prices. ${content ? 'I would evaluate this based on its price-to-value ratio rather than sustainability claims.' : ''}`
  };
  
  return fallbacks[segment] || 'Unable to generate specific response for this segment.';
}