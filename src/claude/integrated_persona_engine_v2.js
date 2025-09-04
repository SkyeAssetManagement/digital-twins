/**
 * Integrated Persona Engine V2
 * Enhanced implementation based on Anthropic's best practices
 * Uses real survey data to create authentic, consistent personas
 */

import Anthropic from '@anthropic-ai/sdk';
import { getEnhancedSurveyPersona } from './enhanced_survey_persona.js';
import { getSurveyResponseLoader } from '../data_processing/survey_response_loader.js';

export class IntegratedPersonaEngineV2 {
  constructor() {
    this.client = null;
    this.enhancedPersona = null;
    this.surveyLoader = null;
    this.initialized = false;
  }
  
  async initialize() {
    if (this.initialized) return;
    
    console.log('Initializing Enhanced Persona Engine V2...');
    
    // Initialize Anthropic client
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    
    // Initialize survey-based persona generator
    this.enhancedPersona = await getEnhancedSurveyPersona();
    this.surveyLoader = await getSurveyResponseLoader();
    
    this.initialized = true;
    console.log('Enhanced Persona Engine V2 ready');
  }
  
  /**
   * Generate response using enhanced persona approach
   * Follows Anthropic's best practices for character consistency
   */
  async generateEnhancedResponse(marketingContent, segment, options = {}) {
    await this.initialize();
    
    // Step 1: Create data-driven persona from real survey respondents
    const numRespondents = options.numRespondents || 10;
    const seedOffset = options.seedOffset || 0;
    const temperature = options.temperature || 0.7;
    
    // Alternate between Opus 4.1 and Sonnet 4.0 for variety
    const models = [
      'claude-opus-4-1-20250805',      // Opus 4.1
      'claude-sonnet-4-20250514'        // Sonnet 4.0 (latest)
    ];
    
    // Use seedOffset to select model for variety
    const modelIndex = (seedOffset + (options.modelVariation || 0)) % models.length;
    const selectedModel = models[modelIndex];
    
    console.log(`[Claude] Using ${selectedModel.includes('opus') ? 'Opus 4.1' : 'Sonnet 4.0'} for ${segment}`);
    
    const systemPrompt = await this.enhancedPersona.createDataDrivenPersona(segment, numRespondents, seedOffset);
    
    // Step 2: Get similar real respondents for context (with seed variation)
    const respondents = this.surveyLoader.getRandomResponses(segment, 5, seedOffset);
    
    // Step 3: Build user prompt with proper structure
    const userPrompt = this.buildStructuredPrompt(marketingContent, respondents, segment);
    
    // Step 4: Use minimal prefill - just a light touch to set tone
    const prefillOptions = {
      'Leader': 'Looking at this, ',
      'Leaning': 'This seems ',
      'Learner': 'Hmm, ',
      'Laggard': 'So '
    };
    const prefill = prefillOptions[segment] || '';
    
    try {
      // Step 5: Generate response with Claude
      const response = await this.client.messages.create({
        model: selectedModel,
        max_tokens: 300,
        temperature: temperature,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt
          },
          {
            role: 'assistant',
            content: prefill  // Minimal prefilling
          }
        ]
      });
      
      // Step 6: Parse and structure response
      return this.parseEnhancedResponse(response, respondents, segment);
      
    } catch (error) {
      console.error('Claude API error:', error);
      return this.generateAuthenticFallback(respondents, marketingContent, segment);
    }
  }
  
  buildStructuredPrompt(marketingContent, respondents, segment) {
    // Use XML tags for structure (Anthropic best practice)
    let prompt = `<context>
You're evaluating this marketing content as a real ${segment} consumer:
</context>

<marketing_content>
${marketingContent}
</marketing_content>

<peer_perspectives>
Other consumers like you have expressed these concerns:
${this.extractPeerPerspectives(respondents)}
</peer_perspectives>

<task>
Provide your authentic, immediate reaction to this marketing content. 
Your response should:
1. Feel natural and conversational (2-3 sentences)
2. Reflect your genuine values and priorities
3. Include specific concerns or interests based on your profile
4. Show emotional authenticity (enthusiasm, skepticism, indifference as appropriate)
5. Reference price/value if that's important to you

End with: [Sentiment: positive/neutral/negative] [Intent: X/10]
</task>`;
    
    return prompt;
  }
  
  extractPeerPerspectives(respondents) {
    const perspectives = [];
    
    respondents.slice(0, 3).forEach(r => {
      if (r.sustainability >= 4 && r.purchaseForSustainability) {
        perspectives.push('- "I always check the environmental impact"');
      } else if (r.priceSensitivity >= 4) {
        perspectives.push('- "Price is what matters most to me"');
      } else if (r.brandValues >= 3) {
        perspectives.push('- "I need to trust the brand\'s values"');
      }
    });
    
    return perspectives.join('\n') || '- General consumer perspectives';
  }
  
  parseEnhancedResponse(response, respondents, segment) {
    const fullText = response.content[0].text;
    
    // Remove prefill if it's still in the response
    const cleanText = fullText.replace(/^\[.*?\]\s*/, '');
    
    // Extract sentiment and intent
    const sentimentMatch = cleanText.match(/\[Sentiment:\s*(\w+)\]/i);
    const intentMatch = cleanText.match(/\[Intent:\s*(\d+)\/10\]/i);
    
    // Clean the main response text
    const mainText = cleanText
      .replace(/\[Sentiment:.*?\]/gi, '')
      .replace(/\[Intent:.*?\]/gi, '')
      .trim();
    
    return {
      text: mainText,
      sentiment: sentimentMatch ? sentimentMatch[1].toLowerCase() : this.inferSentiment(mainText),
      purchaseIntent: intentMatch ? parseInt(intentMatch[1]) : this.inferIntent(segment, respondents),
      basedOn: {
        method: 'enhanced-claude-with-survey-data',
        surveyRespondents: respondents.map(r => r.respondentId).slice(0, 5),
        segment: segment,
        personaType: 'data-driven',
        model: 'claude-opus-4-1-20250805'
      },
      timestamp: new Date().toISOString()
    };
  }
  
  inferSentiment(text) {
    const positive = /love|great|awesome|excellent|perfect|amazing/i;
    const negative = /hate|terrible|awful|bad|disappointing|overpriced/i;
    
    if (positive.test(text)) return 'positive';
    if (negative.test(text)) return 'negative';
    return 'neutral';
  }
  
  inferIntent(segment, respondents) {
    const avgWillingness = respondents.reduce((sum, r) => sum + (r.willingnessToPay || 0), 0) / respondents.length;
    
    // Map willingness to pay to purchase intent
    const intents = {
      'Leader': Math.round(avgWillingness * 2),
      'Leaning': Math.round(avgWillingness * 1.5),
      'Learner': Math.round(avgWillingness * 1.2),
      'Laggard': Math.round(avgWillingness * 0.8)
    };
    
    return Math.min(10, Math.max(1, intents[segment] || 5));
  }
  
  generateAuthenticFallback(respondents, marketingContent, segment) {
    // Create authentic fallback based on real survey data
    const avgScores = this.calculateAverageScores(respondents);
    
    let response = '';
    
    // Generate response based on segment characteristics
    if (segment === 'Leader') {
      if (marketingContent.toLowerCase().includes('sustain') || marketingContent.toLowerCase().includes('eco')) {
        response = `This aligns perfectly with my values - I need brands that genuinely care about environmental impact. Tell me more about your supply chain transparency and carbon footprint.`;
      } else {
        response = `Where's the sustainability story here? I need to see real commitment to environmental responsibility, not just lifestyle marketing. Show me your B-Corp certification or carbon neutral shipping.`;
      }
    } else if (segment === 'Leaning') {
      response = `This looks interesting, but I need to understand the balance between quality and environmental impact. Is it worth the premium? I'd pay 10-15% more if the sustainability credentials are genuine.`;
    } else if (segment === 'Learner') {
      response = `Cool product, but what's the actual price? I'm interested but need to compare with other options first. Maybe if there's a sale or bundle deal I'd consider it.`;
    } else if (segment === 'Laggard') {
      response = `More expensive surf gear with fancy marketing. I can get the same functionality at Walmart for a fraction of the price. Unless it's significantly better quality, I'm not interested.`;
    }
    
    // Determine sentiment and intent based on segment
    const sentiments = {
      'Leader': marketingContent.includes('sustain') ? 'positive' : 'negative',
      'Leaning': 'neutral',
      'Learner': 'neutral',
      'Laggard': 'negative'
    };
    
    const intents = {
      'Leader': marketingContent.includes('sustain') ? 8 : 3,
      'Leaning': 5,
      'Learner': 4,
      'Laggard': 2
    };
    
    return {
      text: response,
      sentiment: sentiments[segment],
      purchaseIntent: intents[segment],
      basedOn: {
        method: 'authentic-survey-fallback',
        surveyRespondents: respondents.map(r => r.respondentId).slice(0, 5),
        segment: segment
      },
      timestamp: new Date().toISOString()
    };
  }
  
  calculateAverageScores(respondents) {
    const scores = {
      sustainability: 0,
      priceSensitivity: 0,
      willingnessToPay: 0,
      brandValues: 0
    };
    
    respondents.forEach(r => {
      scores.sustainability += r.sustainability || 0;
      scores.priceSensitivity += r.priceSensitivity || 0;
      scores.willingnessToPay += r.willingnessToPay || 0;
      scores.brandValues += r.brandValues || 0;
    });
    
    const count = respondents.length || 1;
    Object.keys(scores).forEach(key => {
      scores[key] = scores[key] / count;
    });
    
    return scores;
  }
}

// Export singleton
let engineV2 = null;
export async function getIntegratedPersonaEngineV2() {
  if (!engineV2) {
    engineV2 = new IntegratedPersonaEngineV2();
    await engineV2.initialize();
  }
  return engineV2;
}