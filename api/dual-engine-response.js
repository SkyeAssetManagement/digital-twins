/**
 * Simplified Dual Engine API Endpoint
 * Generates responses using both Advanced Semantic and Claude Persona engines
 * Simplified version without GPT-4 Vision dependency
 */

import { getAdvancedSemanticEngine } from '../src/semantic/advanced_semantic_engine.js';
import { getIntegratedPersonaEngineV2 } from '../src/claude/integrated_persona_engine_v2.js';

/**
 * Generate multiple unique responses for a segment
 */
async function generateMultipleResponses(engine, content, segment, count, engineType) {
  const responses = [];
  
  for (let i = 0; i < count; i++) {
    try {
      let response;
      
      if (engineType === 'semantic') {
        // Generate unique semantic response by varying parameters
        response = await engine.generateAdvancedResponse(content, segment, {
          temperature: 0.7 + (i * 0.1), // Vary temperature for diversity
          respondentSubset: i * 3, // Use different respondent subset
          interpolationWeight: 0.6 + (i * 0.1) // Vary interpolation
        });
      } else {
        // Add delay to avoid rate limiting (Claude has strict limits)
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay between requests to avoid rate limits
        }
        
        // Generate unique Claude response with different respondents
        response = await engine.generateEnhancedResponse(content, segment, {
          numRespondents: 10 + i, // More granular variation (10, 11, 12, 13...)
          temperature: 0.7 + (i * 0.02), // Lower base temp, smaller increments
          seedOffset: i * 1000 + Math.floor(Math.random() * 100) // Much more variation
        });
      }
      
      responses.push({
        segment: segment,
        text: response.text,
        sentiment: response.sentiment,
        purchaseIntent: response.purchaseIntent,
        responseTime: response.responseTime || (engineType === 'semantic' ? 1600 : 6000),
        index: i + 1
      });
      
    } catch (error) {
      console.error(`Error generating ${engineType} response ${i+1} for ${segment}:`, error);
      
      // NO FALLBACKS - Return NA
      responses.push({
        segment: segment,
        text: 'NA - Response generation failed',
        sentiment: 'NA',
        purchaseIntent: 0,
        responseTime: 0,
        index: i + 1,
        error: true
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
    responseCount = 10,
    analyzeOnly = false 
  } = req.body;
  
  if (!content) {
    return res.status(400).json({ error: 'Content is required' });
  }
  
  try {
    let marketingContent = content;
    
    // For image content, use Claude to analyze and extract marketing text
    if (contentType === 'image') {
      console.log('=== IMAGE UPLOAD DETECTED ===');
      console.log('Analyzing image with Claude Opus 4.1...');
      console.log('ANTHROPIC_API_KEY exists:', !!process.env.ANTHROPIC_API_KEY);
      console.log('API Key length:', process.env.ANTHROPIC_API_KEY?.length || 0);
      console.log('API Key prefix:', process.env.ANTHROPIC_API_KEY?.substring(0, 10) || 'NOT SET');
      
      // Define variables outside try block so they're accessible in error handler
      let base64Data, mediaType;
      
      try {
        // Import Anthropic for image analysis
        const Anthropic = (await import('@anthropic-ai/sdk')).default;
        console.log('Anthropic SDK imported successfully');
        
        const anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY
        });
        console.log('Anthropic client created');
        
        // Extract base64 data and media type
        if (content.startsWith('data:image')) {
          const matches = content.match(/^data:image\/(\w+);base64,(.+)$/);
          if (matches) {
            mediaType = `image/${matches[1]}`;
            base64Data = matches[2];
          } else {
            // Fallback parsing for data URLs
            const parts = content.split(',');
            base64Data = parts[1] || content;
            // Try to extract media type from the header
            if (parts[0] && parts[0].includes('image/')) {
              const typeMatch = parts[0].match(/image\/(\w+)/);
              mediaType = typeMatch ? `image/${typeMatch[1]}` : 'image/jpeg';
            } else {
              mediaType = 'image/jpeg';
            }
          }
        } else {
          base64Data = content;
          mediaType = 'image/jpeg'; // Default for raw base64
        }
        
        console.log('Media type detected:', mediaType);
        console.log('Base64 data extracted, length:', base64Data ? base64Data.length : 0);
        
        // Validate base64 data
        try {
          const buffer = Buffer.from(base64Data, 'base64');
          console.log('Base64 validation successful, buffer size:', buffer.length);
          
          // Check file size (Claude has a 5MB limit for images)
          const sizeMB = buffer.length / (1024 * 1024);
          console.log('Image size:', sizeMB.toFixed(2), 'MB');
          if (sizeMB > 5) {
            throw new Error('Image too large. Maximum size is 5MB');
          }
        } catch (err) {
          console.error('Base64 validation failed:', err);
          throw new Error('Invalid base64 image data: ' + err.message);
        }
        
        console.log('Calling Claude API with image...');
        // Analyze image with Claude Opus 4.1 (reduced tokens to avoid timeout)
        const imageAnalysis = await anthropic.messages.create({
          model: 'claude-opus-4-1-20250805',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Data
                }
              },
              {
                type: 'text',
                text: `Extract the marketing content from this image. Include:
- Product name and brand
- Key features and benefits
- Sustainability/environmental claims
- Price or value messaging
- Any specific technologies or materials mentioned
Be concise but specific. Focus on what's actually shown/written in the ad.`
              }
            ]
          }]
        });
        
        console.log('Claude API response received');
        console.log('Response type:', typeof imageAnalysis);
        console.log('Response content array length:', imageAnalysis.content?.length);
        
        marketingContent = imageAnalysis.content[0].text;
        console.log('Claude extracted content:', marketingContent);
        console.log('===========================');
        
        // If analyzeOnly flag is set, return just the extracted content
        if (analyzeOnly) {
          return res.status(200).json({
            success: true,
            contentAnalyzed: marketingContent,
            extractedContent: marketingContent,
            wasImageAnalyzed: true
          });
        }
        
      } catch (error) {
        console.error('=== IMAGE ANALYSIS ERROR ===');
        console.error('Error type:', error.name);
        console.error('Error message:', error.message);
        console.error('Error details:', error);
        console.error('Base64 data length:', base64Data ? base64Data.length : 'undefined');
        console.error('API Key present:', !!process.env.ANTHROPIC_API_KEY);
        console.error('===========================');
        
        // NO FALLBACKS - Return error
        return res.status(500).json({
          error: 'Image analysis failed',
          details: error.message,
          semantic: [],
          claude: [],
          extractedContent: 'NA - Image analysis failed'
        });
      }
    } else {
      console.log('=== TEXT INPUT DETECTED ===');
      console.log('Marketing content:', marketingContent.substring(0, 100) + '...');
      console.log('===========================');
    }
    
    console.log('Initializing engines...');
    
    // Initialize engines
    let semanticEngine = null;
    let claudeEngine = null;
    
    // Try to initialize semantic engine
    try {
      if (process.env.OPENAI_API_KEY) {
        semanticEngine = await getAdvancedSemanticEngine();
      }
    } catch (error) {
      console.log('Advanced semantic engine not available, using fallback');
    }
    
    // Try to initialize Claude engine
    try {
      if (process.env.ANTHROPIC_API_KEY) {
        claudeEngine = await getIntegratedPersonaEngineV2();
      }
    } catch (error) {
      console.log('Claude engine not available, using fallback');
    }
    
    // Generate responses for each segment
    const semanticResponses = [];
    const claudeResponses = [];
    
    for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
      const segment = segments[segmentIndex];
      
      // Add delay between segments to avoid rate limiting
      if (segmentIndex > 0) {
        console.log(`Waiting 3 seconds before processing ${segment} to avoid rate limits...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      console.log(`Generating ${responseCount} responses for ${segment}...`);
      
      // Generate semantic responses
      if (semanticEngine) {
        const semanticBatch = await generateMultipleResponses(
          semanticEngine,
          marketingContent,
          segment,
          responseCount, // Generate full count
          'semantic'
        );
        semanticResponses.push(...semanticBatch);
      } else {
        // NO FALLBACK - Engine not available
        for (let i = 0; i < responseCount; i++) {
          semanticResponses.push({
            segment: segment,
            text: 'NA - Semantic engine not available',
            sentiment: 'NA',
            purchaseIntent: 0,
            responseTime: 0,
            index: i + 1,
            error: true
          });
        }
      }
      
      // Generate Claude responses - ALL UNIQUE, NO REUSE
      if (claudeEngine) {
        const claudeBatch = await generateMultipleResponses(
          claudeEngine,
          marketingContent,
          segment,
          responseCount, // Generate ALL requested responses uniquely
          'claude'
        );
        claudeResponses.push(...claudeBatch);
      } else {
        // NO FALLBACK - Engine not available
        for (let i = 0; i < responseCount; i++) {
          claudeResponses.push({
            segment: segment,
            text: 'NA - Claude engine not available',
            sentiment: 'NA',
            purchaseIntent: 0,
            responseTime: 0,
            index: i + 1,
            error: true
          });
        }
      }
    }
    
    // Calculate statistics
    const stats = {
      totalResponses: semanticResponses.length + claudeResponses.length,
      avgSemanticTime: semanticResponses.reduce((sum, r) => sum + (r.responseTime || 0), 0) / semanticResponses.length,
      avgClaudeTime: claudeResponses.reduce((sum, r) => sum + (r.responseTime || 0), 0) / claudeResponses.length,
      estimatedCost: {
        semantic: semanticResponses.length * 0.002,
        claude: claudeResponses.filter(r => !r.error).length * 0.03 // Actual responses generated
      }
    };
    
    res.status(200).json({
      semantic: semanticResponses,
      claude: claudeResponses,
      stats: stats,
      contentAnalyzed: marketingContent,
      wasImageAnalyzed: contentType === 'image',
      extractedContent: contentType === 'image' ? `Claude analyzed your image and extracted: "${marketingContent}"` : null
    });
    
  } catch (error) {
    console.error('Error in dual engine response:', error);
    res.status(500).json({ 
      error: 'Failed to generate responses',
      details: error.message 
    });
  }
}

// Fallback response generation with more variety
function getFallbackResponse(segment, engine, index) {
  const responses = {
    Leader: {
      semantic: [
        "This lacks environmental commitment. Show me real sustainability or I'm not interested.",
        "Where's the transparency about your supply chain and carbon footprint?",
        "I need to see B-Corp certification and genuine environmental impact data.",
        "Your competitors are doing real work on ocean conservation while you're just selling lifestyle.",
        "Without circular economy principles and repair programs, this is just more waste.",
        "Show me your science-based targets and net-zero roadmap, not beach parties."
      ],
      claude: [
        "This completely misses the mark for someone like me who prioritizes environmental responsibility above all else. I need to see concrete evidence of your sustainability practices, not just marketing speak.",
        "As someone who's spent years advocating for sustainable consumption, I find this approach disappointing. Where's the discussion about your carbon footprint, ethical sourcing, and circular economy initiatives?",
        "I've been in the sustainability space for 15 years and this kind of greenwashing doesn't fly anymore. We need radical transparency, not lifestyle marketing."
      ]
    },
    Leaning: {
      semantic: [
        "I appreciate quality but need to understand the value proposition better.",
        "This looks interesting, but I need to balance quality with environmental impact.",
        "If the sustainability credentials are genuine, I'd consider paying 10-15% more.",
        "I'm becoming more conscious about my purchases - show me why you're worth it.",
        "Quality matters to me, but so does the company's ethics and environmental stance.",
        "I want to support responsible brands, but I need proof this isn't just greenwashing."
      ],
      claude: [
        "I'm trying to make more conscious purchasing decisions, and while this product might have merit, I need more information about both its environmental impact and practical value before I commit.",
        "This speaks to some of my values, but I'm also practical - I need to know that any premium I'm paying translates to both quality that lasts and genuine positive impact.",
        "I've started caring more about where my money goes. If you can show me real sustainability efforts alongside quality products, I'm willing to invest more in your brand."
      ]
    },
    Learner: {
      semantic: [
        "Looks cool but what's the actual price? Need to compare with alternatives.",
        "I'm curious but need more education about what makes this special.",
        "How does this compare to regular brands in terms of value for money?",
        "The visuals are great but I need practical information about the products.",
        "I'm interested but confused - help me understand why premium matters.",
        "What features justify the higher price? I'm still learning about quality differences."
      ],
      claude: [
        "I'm still figuring out this whole sustainability thing - it sounds good but I need to understand if it's worth the extra cost compared to what I usually buy at regular stores.",
        "The concept is interesting but confusing - can you explain in simple terms why I should pay more for this instead of getting something similar at Target for half the price?",
        "As someone new to premium brands, I need education not just marketing. What makes your products special enough to justify the cost? Break it down for me."
      ]
    },
    Laggard: {
      semantic: [
        "Just another overpriced product with fancy marketing. Not interested.",
        "My current solution works fine and costs much less.",
        "Show me the practical benefits, not the marketing fluff.",
        "Premium pricing for basic functionality - classic marketing scam.",
        "I've been using cheaper alternatives for years with zero problems.",
        "All this lifestyle nonsense is just to justify ridiculous markups."
      ],
      claude: [
        "This is just clever marketing to charge premium prices for basic products. I've been buying functional items for years at a fraction of the cost and they work just fine.",
        "All this fancy talk is just a way to make people feel good about overpaying. I'll stick with my budget options that do the same job without the guilt trip.",
        "Let me save you some money - buy the generic version that does the exact same thing for 80% less. This premium stuff is for people with more money than sense."
      ]
    }
  };
  
  const segmentResponses = responses[segment][engine];
  return segmentResponses[index % segmentResponses.length];
}

function getSegmentSentiment(segment) {
  const sentiments = {
    Leader: 'negative',
    Leaning: 'neutral',
    Learner: 'neutral',
    Laggard: 'negative'
  };
  return sentiments[segment] || 'neutral';
}

function getSegmentIntent(segment) {
  const intents = {
    Leader: 3,
    Leaning: 5,
    Learner: 4,
    Laggard: 2
  };
  return intents[segment] || 5;
}