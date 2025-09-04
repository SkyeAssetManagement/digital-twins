/**
 * Image Analysis API using Claude Opus 4.1
 * Analyzes marketing images and extracts themes, content, and messaging
 */

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageData } = req.body;

  if (!imageData) {
    return res.status(400).json({ error: 'Image data is required' });
  }

  try {
    console.log('=== ANALYZING IMAGE WITH CLAUDE OPUS 4.1 ===');
    console.log('Image data received, length:', imageData.length);
    
    // Extract base64 data from data URL if needed
    const base64Data = imageData.startsWith('data:image') 
      ? imageData.split(',')[1] 
      : imageData;

    // Use Claude Opus 4.1 to analyze the image
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-1-20250805',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: base64Data
            }
          },
          {
            type: 'text',
            text: `Analyze this marketing image and provide a detailed summary of:
1. Product/Service being advertised (be specific - brand, model, features)
2. Key marketing messages and claims
3. Environmental/sustainability messaging (if any)
4. Price points or value propositions mentioned
5. Target audience indicators
6. Emotional appeal (lifestyle, performance, environmental, etc.)

Format your response as a concise marketing brief that captures all the essential information a consumer would extract from this ad. Be specific about product names, features, and any claims made.`
          }
        ]
      }]
    });

    const analysis = response.content[0].text;
    console.log('Claude Analysis:', analysis);

    // Extract structured themes from the analysis
    const themes = extractThemes(analysis);
    
    // Create a marketing summary for response generation
    const marketingSummary = createMarketingSummary(analysis, themes);

    return res.status(200).json({
      success: true,
      analysis: analysis,
      themes: themes,
      marketingSummary: marketingSummary,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Image analysis error:', error);
    return res.status(500).json({
      error: 'Failed to analyze image',
      details: error.message
    });
  }
}

function extractThemes(analysis) {
  const analysisLower = analysis.toLowerCase();
  
  const themes = {
    sustainability: 0,
    performance: 0,
    lifestyle: 0,
    price: 0,
    quality: 0,
    innovation: 0,
    brand: 0
  };

  // Score themes based on content
  if (/sustain|eco|recycl|environment|green|carbon/i.test(analysis)) {
    themes.sustainability = 0.8;
  }
  if (/performance|technical|advanced|pro|professional/i.test(analysis)) {
    themes.performance = 0.7;
  }
  if (/lifestyle|adventure|fun|social|community/i.test(analysis)) {
    themes.lifestyle = 0.6;
  }
  if (/price|\$|afford|value|cost|budget/i.test(analysis)) {
    themes.price = 0.5;
  }
  if (/quality|premium|durable|craftsmanship/i.test(analysis)) {
    themes.quality = 0.6;
  }
  if (/innovat|new|technology|cutting-edge|revolutionary/i.test(analysis)) {
    themes.innovation = 0.5;
  }
  if (/brand|heritage|trust|authentic|established/i.test(analysis)) {
    themes.brand = 0.4;
  }

  // Normalize scores
  const total = Object.values(themes).reduce((a, b) => a + b, 0);
  if (total > 0) {
    Object.keys(themes).forEach(key => {
      themes[key] = themes[key] / total;
    });
  }

  return themes;
}

function createMarketingSummary(analysis, themes) {
  // Extract the most important information for response generation
  const lines = analysis.split('\n').filter(line => line.trim());
  
  // Look for product information
  const productLine = lines.find(line => /product|brand|model/i.test(line)) || lines[0];
  
  // Look for key features
  const featuresLine = lines.find(line => /feature|technology|material/i.test(line)) || '';
  
  // Look for sustainability claims
  const sustainabilityLine = lines.find(line => /sustain|eco|recycl|environment/i.test(line)) || '';
  
  // Combine into a concise summary
  let summary = productLine;
  if (featuresLine && !productLine.includes(featuresLine)) {
    summary += ' ' + featuresLine;
  }
  if (sustainabilityLine && !summary.includes(sustainabilityLine)) {
    summary += ' ' + sustainabilityLine;
  }
  
  // Ensure it's not too long
  if (summary.length > 500) {
    summary = summary.substring(0, 497) + '...';
  }
  
  return summary;
}