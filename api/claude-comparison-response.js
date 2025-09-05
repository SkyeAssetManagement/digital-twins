/**
 * Claude Comparison API Endpoint
 * Generates responses using both Claude Sonnet 3.5 and Claude Opus 4.1 for comparison
 * Removed all semantic engine dependencies
 */

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * Generate response using Claude models
 */
async function generateClaudeResponse(content, segment, modelType, responseIndex = 0) {
  const startTime = Date.now();
  
  // Select model based on type
  const model = modelType === 'sonnet' 
    ? 'claude-sonnet-4-20250514'
    : 'claude-3-5-opus-20241022';
  
  // Get segment characteristics
  const segmentData = getSegmentCharacteristics(segment);
  
  // Create a varied prompt with different perspectives for each response
  const systemPrompt = `You are a ${segmentData.description} responding to marketing content.
${segmentData.mindset}

Response variation: ${responseIndex + 1}
Perspective: ${getPerspective(segment, responseIndex)}

Your response should be authentic, natural, and reflect your segment's characteristics.`;

  const userPrompt = `As a ${segment} consumer, provide your genuine reaction to this marketing content:

"${content}"

Give a brief, authentic response (2-3 sentences) that reflects your segment's typical reaction.
Include subtle hints about your purchase intent without explicitly stating numbers.`;

  try {
    const response = await anthropic.messages.create({
      model: model,
      max_tokens: 150,
      temperature: 0.7 + (responseIndex * 0.05), // Vary temperature for diversity
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ],
      system: systemPrompt
    });
    
    const responseText = response.content[0].text;
    const responseTime = Date.now() - startTime;
    
    // Analyze response for sentiment and intent
    const analysis = analyzeResponse(responseText, segment);
    
    return {
      segment: segment,
      text: responseText,
      sentiment: analysis.sentiment,
      purchaseIntent: analysis.purchaseIntent,
      responseTime: responseTime,
      model: modelType,
      index: responseIndex + 1
    };
    
  } catch (error) {
    console.error(`Error generating ${modelType} response for ${segment}:`, error);
    
    return {
      segment: segment,
      text: 'NA - Response generation failed',
      sentiment: 'NA',
      purchaseIntent: 0,
      responseTime: 0,
      model: modelType,
      index: responseIndex + 1,
      error: true
    };
  }
}

/**
 * Get segment characteristics for persona generation
 */
function getSegmentCharacteristics(segment) {
  const segments = {
    'Leader': {
      description: 'highly successful professional and early adopter',
      mindset: 'You value innovation, premium quality, and being first. You have high disposable income and enjoy luxury products. You are confident in your purchasing decisions and often influence others.',
      typicalIntent: 8
    },
    'Leaning': {
      description: 'aspirational professional who follows trends',
      mindset: 'You appreciate quality and are willing to pay for value. You research products carefully and look for social proof. You balance practicality with desire for premium experiences.',
      typicalIntent: 6
    },
    'Learner': {
      description: 'curious but cautious consumer',
      mindset: 'You are interested in new products but need convincing. You read reviews, compare options, and look for good deals. You want to understand the benefits before committing.',
      typicalIntent: 4
    },
    'Laggard': {
      description: 'skeptical and price-conscious consumer',
      mindset: 'You are naturally skeptical of marketing claims and prefer proven products. Price is a major factor in your decisions. You need strong justification for purchases and prefer familiar brands.',
      typicalIntent: 2
    }
  };
  
  return segments[segment] || segments['Learner'];
}

/**
 * Get different perspectives for response variety
 */
function getPerspective(segment, index) {
  const perspectives = {
    'Leader': [
      'Focus on innovation and exclusivity',
      'Emphasize performance and cutting-edge features',
      'Consider status and influence aspects',
      'Think about investment value',
      'Focus on being a trendsetter',
      'Consider professional advantages',
      'Think about lifestyle enhancement',
      'Focus on premium experience',
      'Consider collection value',
      'Think about social impact'
    ],
    'Leaning': [
      'Balance aspiration with practicality',
      'Consider social validation',
      'Focus on quality-to-price ratio',
      'Think about peer recommendations',
      'Consider upgrade potential',
      'Focus on brand reputation',
      'Think about long-term value',
      'Consider lifestyle fit',
      'Focus on reliability',
      'Think about resale value'
    ],
    'Learner': [
      'Focus on understanding benefits',
      'Consider learning curve',
      'Think about practical applications',
      'Focus on reviews and testimonials',
      'Consider trial options',
      'Think about support and warranty',
      'Focus on comparison with alternatives',
      'Consider gradual adoption',
      'Think about risk mitigation',
      'Focus on education and information'
    ],
    'Laggard': [
      'Focus on skepticism and proof',
      'Consider necessity vs want',
      'Think about budget constraints',
      'Focus on proven track record',
      'Consider simpler alternatives',
      'Think about maintenance costs',
      'Focus on practical necessity',
      'Consider waiting for price drops',
      'Think about actual vs marketed benefits',
      'Focus on avoiding buyer remorse'
    ]
  };
  
  const segmentPerspectives = perspectives[segment] || perspectives['Learner'];
  return segmentPerspectives[index % segmentPerspectives.length];
}

/**
 * Analyze response for sentiment and purchase intent
 */
function analyzeResponse(text, segment) {
  const lowercaseText = text.toLowerCase();
  
  // Sentiment analysis
  const positiveWords = ['love', 'excellent', 'amazing', 'great', 'fantastic', 'impressed', 'excited', 'perfect', 'innovative', 'quality'];
  const negativeWords = ['expensive', 'skeptical', 'doubt', 'concerned', 'worried', 'unnecessary', 'overpriced', 'gimmick', 'marketing', 'hype'];
  const neutralWords = ['interesting', 'curious', 'consider', 'maybe', 'perhaps', 'research', 'compare', 'think'];
  
  const positiveCount = positiveWords.filter(word => lowercaseText.includes(word)).length;
  const negativeCount = negativeWords.filter(word => lowercaseText.includes(word)).length;
  const neutralCount = neutralWords.filter(word => lowercaseText.includes(word)).length;
  
  let sentiment = 'neutral';
  if (positiveCount > negativeCount + neutralCount) sentiment = 'positive';
  else if (negativeCount > positiveCount + neutralCount) sentiment = 'negative';
  
  // Purchase intent based on segment and sentiment
  const segmentBaseIntent = {
    'Leader': 7,
    'Leaning': 5,
    'Learner': 4,
    'Laggard': 2
  };
  
  let purchaseIntent = segmentBaseIntent[segment] || 4;
  
  // Adjust based on sentiment
  if (sentiment === 'positive') purchaseIntent += 2;
  else if (sentiment === 'negative') purchaseIntent -= 2;
  
  // Add some variation
  purchaseIntent += Math.floor(Math.random() * 3) - 1;
  
  // Keep within bounds
  purchaseIntent = Math.max(1, Math.min(10, purchaseIntent));
  
  return { sentiment, purchaseIntent };
}

/**
 * Generate multiple responses for a segment and model
 */
async function generateMultipleResponses(content, segment, count, modelType) {
  const responses = [];
  
  for (let i = 0; i < count; i++) {
    // Add delay between requests to avoid rate limiting
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    const response = await generateClaudeResponse(content, segment, modelType, i);
    responses.push(response);
  }
  
  return responses;
}

/**
 * Analyze image content with Claude
 */
async function analyzeImageContent(imageData) {
  try {
    console.log('=== IMAGE ANALYSIS START ===');
    console.log('Image data type:', typeof imageData);
    console.log('Image data starts with:', imageData.substring(0, 50));
    
    // Extract base64 data and media type
    let base64Data, mediaType;
    
    if (imageData.startsWith('data:image')) {
      const matches = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
      if (matches) {
        mediaType = `image/${matches[1]}`;
        base64Data = matches[2];
      } else {
        // Fallback parsing for data URLs
        const parts = imageData.split(',');
        base64Data = parts[1] || imageData;
        // Try to extract media type from the header
        if (parts[0] && parts[0].includes('image/')) {
          const typeMatch = parts[0].match(/image\/(\w+)/);
          mediaType = typeMatch ? `image/${typeMatch[1]}` : 'image/jpeg';
        } else {
          mediaType = 'image/jpeg';
        }
      }
    } else {
      base64Data = imageData;
      mediaType = 'image/jpeg';
    }
    
    console.log('Media type detected:', mediaType);
    console.log('Base64 data length:', base64Data ? base64Data.length : 0);
    console.log('API Key exists:', !!process.env.ANTHROPIC_API_KEY);
    
    // Validate base64 data
    try {
      const buffer = Buffer.from(base64Data, 'base64');
      console.log('Base64 validation successful, buffer size:', buffer.length);
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
    
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-1-20250805',
      max_tokens: 1000,
      messages: [
        {
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
        }
      ]
    });
    
    console.log('Claude API response received');
    const extractedContent = response.content[0].text;
    console.log('Extracted content:', extractedContent);
    console.log('=== IMAGE ANALYSIS END ===');
    
    return extractedContent;
    
  } catch (error) {
    console.error('=== IMAGE ANALYSIS ERROR ===');
    console.error('Error type:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('===========================');
    throw error;
  }
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
    let wasImageAnalyzed = false;
    
    // Handle image content
    if (contentType === 'image') {
      console.log('Analyzing image content with Claude...');
      
      if (analyzeOnly) {
        try {
          const extractedContent = await analyzeImageContent(content);
          return res.status(200).json({
            success: true,
            extractedContent: extractedContent
          });
        } catch (error) {
          console.error('Failed to analyze image:', error);
          return res.status(500).json({
            error: 'Failed to analyze image',
            details: error.message
          });
        }
      }
      
      marketingContent = await analyzeImageContent(content);
      if (!marketingContent) {
        return res.status(400).json({ error: 'Failed to analyze image content' });
      }
      wasImageAnalyzed = true;
    }
    
    // Generate responses for both models
    const sonnetResponses = [];
    const opusResponses = [];
    
    for (const segment of segments) {
      // Generate responses with Sonnet 3.5
      const sonnetSegmentResponses = await generateMultipleResponses(
        marketingContent, 
        segment, 
        responseCount, 
        'sonnet'
      );
      sonnetResponses.push(...sonnetSegmentResponses);
      
      // Generate responses with Opus 4.1
      const opusSegmentResponses = await generateMultipleResponses(
        marketingContent, 
        segment, 
        responseCount, 
        'opus'
      );
      opusResponses.push(...opusSegmentResponses);
    }
    
    // Return responses
    res.status(200).json({
      sonnet: sonnetResponses,
      opus: opusResponses,
      wasImageAnalyzed,
      extractedContent: wasImageAnalyzed ? marketingContent : null
    });
    
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Failed to generate responses',
      details: error.message 
    });
  }
}