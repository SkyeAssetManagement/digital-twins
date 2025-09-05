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
    
    // Use only Opus 4.1 for now
    const selectedModel = 'claude-opus-4-1-20250805';
    
    console.log(`[Claude] Using Opus 4.1 for ${segment}`);
    
    const systemPrompt = await this.enhancedPersona.createDataDrivenPersona(segment, numRespondents, seedOffset);
    
    // Step 2: Get similar real respondents for context (with seed variation)
    const respondents = this.surveyLoader.getRandomResponses(segment, 5, seedOffset);
    
    // Step 3: Build user prompt with proper structure
    const userPrompt = this.buildStructuredPrompt(marketingContent, respondents, segment);
    
    // Step 4: Use randomized prefill from large pool - not category specific
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
      
      // Emphasis/intensity
      'Definitely ', 'Certainly ', 'Absolutely ', 'Totally ', 'Completely ', 'Entirely ',
      'Quite ', 'Rather ', 'Pretty ', 'Fairly ', 'Somewhat ', 'Slightly ', 'Barely ',
      
      // Narrative/sequential
      'First, ', 'Second, ', 'Next, ', 'Then, ', 'Finally, ', 'Lastly, ',
      'Additionally, ', 'Furthermore, ', 'Moreover, ', 'Also, ', 'Plus, ',
      
      // Casual/conversational
      'Man, ', 'Dude, ', 'Folks, ', 'Hey, ', 'Yo, ', 'Gosh, ', 'Wow, ', 'Whoa, ',
      'Yikes, ', 'Sheesh, ', 'Geez, ', 'Boy, ', 'Girl, ',
      
      // Professional/formal
      'Indeed, ', 'Certainly, ', 'Undoubtedly, ', 'Evidently, ', 'Clearly, ',
      'Obviously, ', 'Apparently, ', 'Presumably, ', 'Arguably, ', 'Potentially, ',
      
      // Skeptical/questioning
      'Supposedly ', 'Allegedly ', 'Seemingly ', 'Purportedly ', 'Ostensibly ',
      'Questionably ', 'Dubiously ', 'Debatably ', 'Perhaps ', 'Maybe ',
      
      // Agreement/disagreement
      'Agreed, ', 'Disagree, ', 'True, ', 'False, ', 'Correct, ', 'Wrong, ',
      'Right, ', 'Exactly, ', 'Precisely, ', 'Indeed, ', 'Absolutely, ',
      
      // Minimal starters (1-2 chars)
      '', '', '', '', '', // Some empty for no prefill occasionally
    ];
    
    // Randomly select a prefill starter
    const randomIndex = Math.floor(Math.random() * prefillStarters.length);
    const prefill = prefillStarters[randomIndex];
    
    // Log which prefill was selected for debugging
    if (prefill) {
      console.log(`[Prefill] Using: "${prefill}" for ${segment}`);
    } else {
      console.log(`[Prefill] No prefill for ${segment}`);
    }
    
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
      console.error('Claude API error:', error.message || error);
      console.error('Full error details:', JSON.stringify(error, null, 2));
      
      // Check for rate limit error
      if (error.status === 429) {
        console.error('RATE LIMIT HIT - Too many requests to Claude API');
      }
      
      // NO FALLBACKS - Return NA with detailed error
      return {
        text: `NA - Claude API failed: ${error.message || 'Unknown error'}`,
        sentiment: 'NA',
        purchaseIntent: 0,
        error: true,
        errorCode: error.status || error.code,
        errorMessage: error.message,
        timestamp: new Date().toISOString()
      };
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
  
  // REMOVED: generateAuthenticFallback - NO FALLBACKS ALLOWED
  // When API fails, we return NA, not fallback data
  
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