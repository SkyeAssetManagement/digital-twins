/**
 * Dual Engine API Endpoint
 * Generates responses using both Advanced Semantic and Claude Persona engines
 * Handles both text and image inputs
 */

import { getAdvancedSemanticEngine } from '../src/semantic/advanced_semantic_engine.js';
import { getIntegratedPersonaEngineV2 } from '../src/claude/integrated_persona_engine_v2.js';
import OpenAI from 'openai';

// Initialize OpenAI for image analysis
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Extract text from image using GPT-4 Vision
 */
async function extractTextFromImage(imageData) {
  try {
    // Remove data URL prefix if present
    const base64Image = imageData.replace(/^data:image\/\w+;base64,/, '');
    
    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all text from this image. Include headlines, body text, and any marketing copy. Format it clearly."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: 1000
    });
    
    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error extracting text from image:', error);
    // Fallback for demo
    return "Marketing content extracted from image. [Image analysis would occur here in production]";
  }
}

/**
 * Generate multiple responses for a segment
 */
async function generateMultipleResponses(engine, content, segment, count, engineType) {
  const responses = [];
  
  for (let i = 0; i < count; i++) {
    try {
      let response;
      
      if (engineType === 'semantic') {
        // Advanced Semantic Engine
        response = await engine.generateAdvancedResponse(content, segment);
        
        // Add variation by slightly modifying the template selection
        if (i > 0) {
          // Add some randomization to avoid identical responses
          const variations = [
            'Tell me more about',
            'I need to know',
            'What about',
            'Show me',
            'Explain'
          ];
          const prefix = variations[i % variations.length];
          response.text = response.text.replace(/^(\w+)/, prefix);
        }
      } else {
        // Claude Pipeline
        response = await engine.generateEnhancedResponse(content, segment, {
          numRespondents: 10 + i, // Vary respondent selection
          temperature: 0.7 + (i * 0.02) // Slight temperature variation
        });
      }
      
      responses.push({
        segment: segment,
        text: response.text,
        sentiment: response.sentiment,
        purchaseIntent: response.purchaseIntent,
        responseTime: response.responseTime || 0,
        index: i + 1
      });
      
    } catch (error) {
      console.error(`Error generating ${engineType} response ${i+1} for ${segment}:`, error);
      // Add fallback response
      responses.push({
        segment: segment,
        text: `[Error generating response ${i+1}]`,
        sentiment: 'neutral',
        purchaseIntent: 5,
        responseTime: 0,
        index: i + 1
      });
    }
  }
  
  return responses;
}

/**
 * Main API handler
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { 
    content, 
    contentType = 'text', 
    segments = ['Leader', 'Leaning', 'Learner', 'Laggard'],
    responseCount = 10 
  } = req.body;
  
  if (!content) {
    return res.status(400).json({ error: 'Content is required' });
  }
  
  try {
    // Extract text if image
    let marketingContent = content;
    if (contentType === 'image') {
      console.log('Extracting text from image...');
      marketingContent = await extractTextFromImage(content);
    }
    
    // Initialize engines
    console.log('Initializing engines...');
    const semanticEngine = await getAdvancedSemanticEngine();
    const claudeEngine = await getIntegratedPersonaEngineV2();
    
    // Generate responses for each segment
    const semanticResponses = [];
    const claudeResponses = [];
    
    for (const segment of segments) {
      console.log(`Generating ${responseCount} responses for ${segment}...`);
      
      // Generate semantic responses
      const semanticBatch = await generateMultipleResponses(
        semanticEngine,
        marketingContent,
        segment,
        responseCount,
        'semantic'
      );
      semanticResponses.push(...semanticBatch);
      
      // Generate Claude responses (limit to 3 for cost)
      const claudeCount = Math.min(responseCount, 3);
      const claudeBatch = await generateMultipleResponses(
        claudeEngine,
        marketingContent,
        segment,
        claudeCount,
        'claude'
      );
      
      // If more than 3 requested, duplicate with variations
      if (responseCount > 3) {
        for (let i = claudeCount; i < responseCount; i++) {
          const baseResponse = claudeBatch[i % claudeCount];
          claudeResponses.push({
            ...baseResponse,
            text: baseResponse.text + ` [Variation ${Math.floor(i/3) + 1}]`,
            index: i + 1
          });
        }
      } else {
        claudeResponses.push(...claudeBatch);
      }
    }
    
    // Calculate statistics
    const stats = {
      totalResponses: semanticResponses.length + claudeResponses.length,
      avgSemanticTime: semanticResponses.reduce((sum, r) => sum + (r.responseTime || 0), 0) / semanticResponses.length,
      avgClaudeTime: claudeResponses.reduce((sum, r) => sum + (r.responseTime || 0), 0) / claudeResponses.length,
      estimatedCost: {
        semantic: semanticResponses.length * 0.002,
        claude: Math.min(responseCount * segments.length, segments.length * 3) * 0.03
      }
    };
    
    res.status(200).json({
      semantic: semanticResponses,
      claude: claudeResponses,
      stats: stats,
      contentAnalyzed: marketingContent.substring(0, 200) + '...'
    });
    
  } catch (error) {
    console.error('Error in dual engine response:', error);
    res.status(500).json({ 
      error: 'Failed to generate responses',
      details: error.message 
    });
  }
}

// Export for Express integration
export function dualEngineHandler(app) {
  app.post('/api/dual-engine-response', handler);
}