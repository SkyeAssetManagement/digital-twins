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
      adContent, // Alternative parameter name
      imageData,
      datasetId = 'surf-clothing',
      segment,  // Single segment for parameter testing
      segments = ['Leader', 'Leaning', 'Learner', 'Laggard'],
      usePersonaVectors = true,
      conversationHistory = [],
      // New parameters for testing
      model = 'claude-opus-4-1-20250805',
      temperature = 0.7,
      temperatureMin,  // If provided with temperatureMax, randomize between them
      temperatureMax,
      randomizeTemperature = false,
      topP = 0.9,
      maxTokens = 150,
      usePrefill = true,
      systemPromptStyle = 'detailed',
      responseCount = 3
    } = req.body;

    // Accept either marketingContent or adContent
    const content = marketingContent || adContent;
    if (!content) {
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

    // Handle single segment for parameter testing
    const segmentsToProcess = segment ? [segment] : segments;
    
    // Generate responses for each segment
    const responses = [];
    const queries = [content];

    for (const targetSegment of segmentsToProcess) {
      try {
        let twinData = null;

        // Prepare twin data
        if (digitalTwins) {
          const segmentKey = `LOHAS ${targetSegment}`;
          if (digitalTwins[segmentKey]) {
            const segmentData = digitalTwins[segmentKey];
            twinData = {
              id: `${datasetId}_${targetSegment}`,
              pid: `${datasetId}_${targetSegment}`,
              segment: targetSegment,
              persona_json: {
                segment: targetSegment,
                values: {
                  environmental_concern: targetSegment === 'Leader' ? 0.95 : 
                                        targetSegment === 'Leaning' ? 0.75 :
                                        targetSegment === 'Learner' ? 0.50 : 0.25,
                  brand_loyalty: targetSegment === 'Leader' ? 0.85 :
                                targetSegment === 'Leaning' ? 0.70 :
                                targetSegment === 'Learner' ? 0.55 : 0.45,
                  community_involvement: targetSegment === 'Leader' ? 0.80 :
                                        targetSegment === 'Leaning' ? 0.60 :
                                        targetSegment === 'Learner' ? 0.45 : 0.30,
                  price_sensitivity: targetSegment === 'Leader' ? 0.30 :
                                    targetSegment === 'Leaning' ? 0.50 :
                                    targetSegment === 'Learner' ? 0.70 : 0.90
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
            id: `${datasetId}_${targetSegment}`,
            pid: `${datasetId}_${targetSegment}`,
            segment: targetSegment,
            persona_json: {
              segment: targetSegment
            }
          };
        }

        // Process with Claude integration using new parameters
        let segmentResponse;
        
        if (usePersonaVectors && !segment) {
          // Use full persona vector system for multi-segment
          const result = await integration.processDigitalTwin(twinData, queries);
          
          segmentResponse = {
            segment: targetSegment,
            response: result.responses[0]?.response || 'NA',
            sentiment: analyzeSentiment(result.responses[0]?.response),
            purchaseIntent: calculatePurchaseIntent(targetSegment, result.responses[0]?.response),
            consistency: result.validation?.consistencyScore || 0,
            driftScore: result.responses[0]?.driftScore || 0,
            personaVector: result.personaVector ? result.personaVector.slice(0, 10) : [], // Send first 10 values
            marketSize: twinData.market_size || getMarketSize(targetSegment)
          };
        } else {
          // Use Claude helper with custom parameters for testing
          const helper = integration.claudeHelper;
          
          // Generate system prompt based on style
          let systemPrompt;
          if (systemPromptStyle === 'minimal') {
            systemPrompt = `You are a ${targetSegment} consumer in the LOHAS framework. Respond naturally to marketing messages.`;
          } else if (systemPromptStyle === 'values') {
            systemPrompt = getValuesPrompt(targetSegment);
          } else if (systemPromptStyle === 'demographic') {
            systemPrompt = getDemographicPrompt(targetSegment);
          } else {
            systemPrompt = helper.convertTwinPersonaToClaude(twinData.persona_json || twinData);
          }
          
          // Generate multiple responses if requested
          const generatedResponses = [];
          const responseTemperatures = [];
          const responsePrefills = [];
          for (let i = 0; i < responseCount; i++) {
            // Calculate temperature for this response
            let responseTemp;
            if (randomizeTemperature && temperatureMin !== undefined && temperatureMax !== undefined) {
              // Randomize between min and max for each response
              responseTemp = temperatureMin + Math.random() * (temperatureMax - temperatureMin);
            } else if (temperatureMin !== undefined && temperatureMax !== undefined) {
              // Use different temps across the range even if not "randomized"
              const step = (temperatureMax - temperatureMin) / Math.max(1, responseCount - 1);
              responseTemp = temperatureMin + (step * i);
            } else {
              // Use provided temperature with slight variation
              responseTemp = temperature + (Math.random() - 0.5) * 0.1;
            }
            responseTemp = Math.min(1, Math.max(0, responseTemp));
            responseTemperatures.push(responseTemp);
            
            const { response, prefill } = await generateClaudeResponse({
              systemPrompt,
              userMessage: content,
              model,
              temperature: responseTemp,
              topP,
              maxTokens,
              usePrefill
            });
            
            generatedResponses.push(response);
            responsePrefills.push(prefill || '');
          }
          
          // Select best response or combine them
          const bestResponse = generatedResponses[0]; // Can enhance selection logic later
          
          segmentResponse = {
            segment: targetSegment,
            responses: generatedResponses,
            responseTemperatures: responseTemperatures, // Temperature used for each response
            responsePrefills: responsePrefills, // Prefill used for each response
            response: bestResponse, // Primary response for backward compatibility
            sentiment: analyzeSentiment(bestResponse),
            purchaseIntent: calculatePurchaseIntent(targetSegment, bestResponse),
            marketSize: twinData.market_size || getMarketSize(targetSegment),
            parameters: {
              model,
              temperature,
              topP,
              maxTokens,
              usePrefill,
              systemPromptStyle,
              responseCount
            }
          };
        }

        // Add image analysis if provided
        if (imageData) {
          // TODO: Implement real image analysis with Claude vision
          segmentResponse.imageAnalysis = 'NA'; // No fallback responses
        }

        responses.push(segmentResponse);
        console.log(`Generated response for ${targetSegment} segment`);

      } catch (error) {
        console.error(`Error generating response for ${targetSegment}:`, error);
        
        // Provide fallback response
        responses.push({
          segment: targetSegment,
          response: getFallbackResponse(targetSegment, content),
          sentiment: 'neutral',
          purchaseIntent: targetSegment === 'Leader' ? 0.7 :
                         targetSegment === 'Leaning' ? 0.5 :
                         targetSegment === 'Learner' ? 0.3 : 0.1,
          error: error.message,
          marketSize: getMarketSize(targetSegment)
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
 * Generate Claude response with custom parameters
 */
async function generateClaudeResponse(params) {
  const {
    systemPrompt,
    userMessage,
    model = 'claude-opus-4-1-20250805',
    temperature = 0.7,
    topP = 0.9,
    maxTokens = 150,
    usePrefill = true
  } = params;
  
  try {
    const anthropic = claudeIntegration?.claudeHelper?.client;
    if (!anthropic) {
      throw new Error('Claude client not initialized');
    }
    
    const messages = [
      { role: 'user', content: userMessage }
    ];
    
    // Add prefill if enabled with randomized starters
    let prefillUsed = '';
    if (usePrefill) {
      const prefillStarter = getRandomPrefillStarter();
      // Always set prefillUsed even if empty string
      prefillUsed = prefillStarter.trimEnd();
      // Only add assistant message if there's actual content
      if (prefillUsed.length > 0) {
        messages.push({
          role: 'assistant',
          content: prefillUsed
        });
      }
    }
    
    // Only use temperature OR top_p, not both
    const apiParams = {
      model: model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: messages
    };
    
    // Use temperature if defined, otherwise use top_p
    if (temperature !== undefined && temperature !== null) {
      apiParams.temperature = temperature;
    } else if (topP !== undefined && topP !== null) {
      apiParams.top_p = topP;
    } else {
      apiParams.temperature = 0.7; // Default
    }
    
    const response = await anthropic.messages.create(apiParams);
    
    // Return both response and prefill used
    const responseText = response.content[0]?.text || 'NA';
    return { 
      response: responseText,
      prefill: prefillUsed
    };
  } catch (error) {
    console.error('Claude generation error:', error);
    throw error;
  }
}

/**
 * Get values-focused prompt for segment
 */
function getValuesPrompt(segment) {
  const prompts = {
    'Leader': `You embody these values: Environmental responsibility (95%), Quality (85%), Innovation (90%), Social impact (95%). You are willing to pay premium for genuine sustainability. Respond as this highly values-driven consumer.`,
    'Leaning': `You balance these values: Sustainability (65%), Practicality (75%), Quality (75%), Value (60%). You seek sustainable options when they align with practical needs. Respond as this balanced consumer.`,
    'Learner': `You prioritize these values: Price (80%), Practicality (70%), Learning (60%), Traditional quality (60%). You're curious but cautious about new sustainable products. Respond as this price-conscious explorer.`,
    'Laggard': `You focus on these values: Price (95%), Functionality (85%), Traditional quality (70%), Proven results (80%). Sustainability is not a priority. Respond as this traditional, practical consumer.`
  };
  return prompts[segment] || prompts['Learner'];
}

/**
 * Get demographic-focused prompt for segment
 */
function getDemographicPrompt(segment) {
  const prompts = {
    'Leader': `You are a 35-45 year old professional with above-average income, higher education, living in an urban area. You actively research products and influence others' purchasing decisions. Respond from this demographic perspective.`,
    'Leaning': `You are a 30-40 year old suburban resident with average to above-average income, college educated. You balance family needs with environmental consciousness. Respond from this demographic perspective.`,
    'Learner': `You are a 25-50 year old with average income, some college education, living in mixed urban/suburban areas. You follow mainstream trends and seek value. Respond from this demographic perspective.`,
    'Laggard': `You are a 35-55 year old with below-average to average income, varied education, often in rural or suburban areas. You prefer familiar brands and proven products. Respond from this demographic perspective.`
  };
  return prompts[segment] || prompts['Learner'];
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
 * Get random prefill starter for varied responses
 */
function getRandomPrefillStarter() {
  const prefillStarters = [
    // Observational starters
    'Looking at this, ', 'Seeing this, ', 'Noticing that ', 'Observing the ', 
    'Considering this, ', 'Examining the ', 'Reviewing this, ', 'Checking out ',
    'Glancing at ', 'Studying this, ', 'Analyzing the ', 'Inspecting this, ',
    
    // Thoughtful/reflective
    'Hmm, ', 'Well, ', 'Actually, ', 'Honestly, ', 'Frankly, ', 'Personally, ',
    'Realistically, ', 'Truthfully, ', 'Genuinely, ', 'Seriously, ', 'Really, ',
    'Basically, ', 'Essentially, ', 'Fundamentally, ', 'Ultimately, ', 'Generally, ',
    
    // Initial reactions
    'Oh, ', 'Ah, ', 'Okay, ', 'Right, ', 'Sure, ', 'Yeah, ', 'Yes, ', 'No, ',
    'Wait, ', 'Hold on, ', 'Hang on, ', 'Listen, ', 'Look, ', 'See, ',
    
    // Evaluative starters
    'This seems ', 'This looks ', 'This appears ', 'This feels ', 'This sounds ',
    'That seems ', 'That looks ', 'That appears ', 'That feels ', 'That sounds ',
    'It seems ', 'It looks ', 'It appears ', 'It feels ', 'It sounds ',
    
    // Questioning/curious
    'So ', 'Now ', 'But ', 'And ', 'Yet ', 'Still, ', 'Though, ', 'Although, ',
    'While ', 'Whereas ', 'However, ', 'Nevertheless, ', 'Nonetheless, ', 'Meanwhile, ',
    
    // Direct address
    'You know, ', 'I mean, ', 'I think ', 'I feel ', 'I believe ', 'I suppose ',
    'I guess ', 'I imagine ', 'I wonder ', 'I notice ', 'I see ', 'I find ',
    
    // Contextual/situational
    'At first glance, ', 'On one hand, ', 'To be fair, ', 'In my view, ',
    'From my perspective, ', 'In my experience, ', 'As someone who ', 'Having seen ',
    'After seeing ', 'Upon viewing ', 'When I see ', 'Whenever I see ',
    
    // Emotional/attitudinal
    'Interesting, ', 'Fascinating, ', 'Curious, ', 'Strange, ', 'Odd, ', 'Weird, ',
    'Cool, ', 'Nice, ', 'Great, ', 'Good, ', 'Fine, ', 'Alright, ', 'Decent, ',
    
    // Comparative/relative
    'Compared to ', 'Unlike ', 'Similar to ', 'Like ', 'As with ', 'Just like ',
    'Much like ', 'Rather than ', 'Instead of ', 'Versus ', 'Against ',
    
    // Temporal
    'Initially, ', 'First off, ', 'To start, ', 'Right away, ', 'Immediately, ',
    'Currently, ', 'Now, ', 'Today, ', 'These days, ', 'Lately, ', 'Recently, ',
    
    // Conditional/hypothetical
    'If ', 'Unless ', 'Assuming ', 'Supposing ', 'Provided ', 'Given that ',
    'Considering ', 'Taking into account ', 'Bearing in mind ', 'Keeping in mind ',
    
    // Professional/formal
    'Indeed, ', 'Certainly, ', 'Undoubtedly, ', 'Evidently, ', 'Clearly, ',
    'Obviously, ', 'Apparently, ', 'Presumably, ', 'Arguably, ', 'Potentially, ',
    
    // Skeptical/questioning
    'Supposedly ', 'Allegedly ', 'Seemingly ', 'Purportedly ', 'Ostensibly ',
    'Questionably ', 'Dubiously ', 'Debatably ', 'Perhaps ', 'Maybe ',
    
    // Minimal or no prefill
    '' // Rare empty for no prefill (only 1 out of ~150)
  ];
  
  const randomIndex = Math.floor(Math.random() * prefillStarters.length);
  return prefillStarters[randomIndex];
}

/**
 * Generate fallback response for segment
 */
function getFallbackResponse(segment, content) {
  // Return NA instead of fallback responses per requirements
  return 'NA';
}