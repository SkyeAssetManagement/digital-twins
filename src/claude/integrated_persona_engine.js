/**
 * Integrated Persona Engine
 * Combines actual survey data with Claude's persona capabilities
 * for authentic, consistent consumer responses
 */

import { ClaudePersonaHelper } from './claude_persona_helper.js';
import { getSurveyPersonaInjector } from './survey_persona_injector.js';
import { getSurveyResponseLoader } from '../data_processing/survey_response_loader.js';
import { createEnhancedVectorStore } from '../vector_db/enhanced_vector_store.js';

export class IntegratedPersonaEngine {
  constructor() {
    this.claudeHelper = null;
    this.surveyInjector = null;
    this.surveyLoader = null;
    this.vectorStore = null;
    this.initialized = false;
  }
  
  async initialize() {
    if (this.initialized) return;
    
    console.log('Initializing Integrated Persona Engine...');
    
    // Initialize all components
    this.claudeHelper = new ClaudePersonaHelper({
      model: 'claude-opus-4-1-20250805',  // Using Opus 4.1
      temperature: 0.7,  // Consistent personality
      personaVectorIntensity: 1.0
    });
    
    this.surveyInjector = await getSurveyPersonaInjector();
    this.surveyLoader = await getSurveyResponseLoader();
    
    // Initialize vector store with OpenAI embeddings for better values understanding
    this.vectorStore = await createEnhancedVectorStore('surf-clothing', 'openai');
    
    // Pre-load and embed all survey responses
    await this.embedAllSurveyResponses();
    
    this.initialized = true;
    console.log('Integrated Persona Engine ready');
  }
  
  async embedAllSurveyResponses() {
    console.log('Embedding survey responses into vector store...');
    
    const segments = ['Leader', 'Leaning', 'Learner', 'Laggard'];
    
    for (const segment of segments) {
      const responses = this.surveyLoader.segmentResponses[segment];
      console.log(`Embedding ${responses.length} responses for ${segment}`);
      
      for (const response of responses) {
        await this.vectorStore.storeSurveyResponse(response);
      }
      
      // Compute segment centroids for faster search
      await this.vectorStore.computeSegmentCentroids(segment, responses);
    }
  }
  
  /**
   * Generate a response using BOTH survey data AND Claude personas
   */
  async generateIntegratedResponse(marketingContent, segment, options = {}) {
    await this.initialize();
    
    // Step 1: Find semantically similar survey respondents
    const similarRespondents = await this.vectorStore.findSimilarSurveyResponses(
      marketingContent,
      segment,
      5  // Get top 5 similar real respondents
    );
    
    // Step 2: Create persona from actual survey data
    const surveyPersona = await this.surveyInjector.createPersonaFromSurvey(
      segment,
      5  // Use 5 random respondents for variety
    );
    
    // Step 3: Enhance with Claude persona capabilities
    const enhancedPersona = this.mergePersonas(surveyPersona, segment, similarRespondents);
    
    // Step 4: Generate response with Claude
    const response = await this.generateWithClaude(
      enhancedPersona,
      marketingContent,
      similarRespondents,
      options
    );
    
    return response;
  }
  
  /**
   * Merge survey-based persona with Claude's personality modeling
   */
  mergePersonas(surveyPersona, segment, similarRespondents) {
    // Start with survey-based persona
    let mergedPrompt = surveyPersona;
    
    // Add Claude's psychological depth
    mergedPrompt += '\n\nPSYCHOLOGICAL PROFILE:\n';
    mergedPrompt += this.generatePsychologicalProfile(segment, similarRespondents);
    
    // Add personality vectors for consistency
    const personalityVector = this.createPersonalityVector(similarRespondents);
    mergedPrompt += '\n\nPERSONALITY DIMENSIONS:\n';
    mergedPrompt += this.formatPersonalityVector(personalityVector);
    
    // Add response consistency rules
    mergedPrompt += '\n\nRESPONSE CONSISTENCY REQUIREMENTS:\n';
    mergedPrompt += this.getConsistencyRules(segment, similarRespondents);
    
    return mergedPrompt;
  }
  
  generatePsychologicalProfile(segment, respondents) {
    // Calculate Big Five traits from survey data
    const traits = this.calculateBigFive(respondents);
    
    let profile = '';
    
    // Openness to Experience
    if (traits.openness > 0.7) {
      profile += '- High openness: Curious about new sustainable innovations, early adopter\n';
    } else if (traits.openness < 0.3) {
      profile += '- Low openness: Skeptical of new claims, prefers proven products\n';
    }
    
    // Conscientiousness
    if (traits.conscientiousness > 0.7) {
      profile += '- High conscientiousness: Thoroughly researches before purchasing\n';
    }
    
    // Extraversion (based on evangelism scores)
    if (traits.extraversion > 0.6) {
      profile += '- Extraverted: Influences others, shares opinions actively\n';
    } else {
      profile += '- Introverted: Makes independent decisions, less influenced by others\n';
    }
    
    // Agreeableness
    if (traits.agreeableness > 0.7) {
      profile += '- Agreeable: Values community and collective benefit\n';
    } else if (traits.agreeableness < 0.3) {
      profile += '- Low agreeableness: Focuses on personal benefit over collective good\n';
    }
    
    // Neuroticism (anxiety about purchases)
    if (traits.neuroticism > 0.6) {
      profile += '- Decision anxiety: Worries about making wrong choice\n';
    }
    
    return profile;
  }
  
  calculateBigFive(respondents) {
    const traits = {
      openness: 0,
      conscientiousness: 0,
      extraversion: 0,
      agreeableness: 0,
      neuroticism: 0
    };
    
    respondents.forEach(r => {
      // Map survey responses to Big Five
      traits.openness += (r.willingnessToPay || 0) / 5 * 0.3;
      traits.conscientiousness += (r.activism || 0) / 5 * 0.3;
      traits.extraversion += (r.envEvangelist || 0) / 5 * 0.4;
      traits.agreeableness += (r.sustainability || 0) / 5 * 0.3;
      traits.neuroticism += (r.priceSensitivity || 0) / 5 * 0.2;
    });
    
    // Normalize
    const count = respondents.length || 1;
    Object.keys(traits).forEach(key => {
      traits[key] = Math.min(1, traits[key] / count);
    });
    
    return traits;
  }
  
  createPersonalityVector(respondents) {
    // Multi-dimensional personality representation
    return {
      // Values dimension (what they care about)
      values: {
        environmental: this.avg(respondents, 'sustainability'),
        economic: 5 - this.avg(respondents, 'priceSensitivity'),
        social: this.avg(respondents, 'envEvangelist'),
        ethical: this.avg(respondents, 'brandValues')
      },
      
      // Behavior dimension (what they do)
      behavior: {
        researches: this.avg(respondents, 'activism') > 3,
        paysMore: this.avg(respondents, 'willingnessToPay') > 3,
        influences: this.avg(respondents, 'envEvangelist') > 3,
        compares: this.avg(respondents, 'priceSensitivity') > 3
      },
      
      // Communication style
      style: {
        assertiveness: this.avg(respondents, 'envEvangelist') / 5,
        skepticism: this.avg(respondents, 'priceSensitivity') / 5,
        enthusiasm: this.avg(respondents, 'willingnessToPay') / 5,
        analytical: this.avg(respondents, 'activism') / 5
      }
    };
  }
  
  avg(respondents, field) {
    const values = respondents.map(r => r[field]).filter(v => v !== null);
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }
  
  formatPersonalityVector(vector) {
    let formatted = '';
    
    // Values
    formatted += 'Core Values:\n';
    Object.entries(vector.values).forEach(([key, value]) => {
      const strength = value > 3.5 ? 'Strong' : value > 2.5 ? 'Moderate' : 'Weak';
      formatted += `  - ${key}: ${strength} (${value.toFixed(1)}/5)\n`;
    });
    
    // Behaviors
    formatted += '\nBehavioral Patterns:\n';
    Object.entries(vector.behavior).forEach(([key, value]) => {
      if (value) {
        formatted += `  - ${key}: YES\n`;
      }
    });
    
    // Communication
    formatted += '\nCommunication Style:\n';
    Object.entries(vector.style).forEach(([key, value]) => {
      const level = value > 0.7 ? 'High' : value > 0.4 ? 'Medium' : 'Low';
      formatted += `  - ${key}: ${level} (${(value * 100).toFixed(0)}%)\n`;
    });
    
    return formatted;
  }
  
  getConsistencyRules(segment, respondents) {
    const avgScores = this.surveyLoader.getAverageScores(segment);
    
    return `
1. Maintain ${segment} segment characteristics throughout
2. Sustainability mentions must align with ${avgScores.sustainability}/5 importance
3. Price concerns must reflect ${avgScores.priceSensitivity}/5 sensitivity
4. Premium willingness must match ${avgScores.willingnessToPay}/5 level
5. Never contradict the survey data patterns
6. Use vocabulary and tone consistent with education level
7. Reference specific experiences when score > 3 for that area
8. Show consistency with the ${respondents.length} similar respondents found`;
  }
  
  /**
   * Generate response using Claude with full persona integration
   */
  async generateWithClaude(systemPrompt, marketingContent, similarRespondents, options = {}) {
    // Build user prompt with context
    let userPrompt = `As the person described above, provide your authentic reaction to this marketing content:\n\n`;
    userPrompt += `"${marketingContent}"\n\n`;
    
    // Add context from similar respondents
    if (similarRespondents.length > 0) {
      userPrompt += 'Others with similar values have said:\n';
      similarRespondents.slice(0, 3).forEach(r => {
        if (r.searchableText) {
          userPrompt += `- ${r.searchableText}\n`;
        }
      });
      userPrompt += '\n';
    }
    
    userPrompt += `Respond in 2-3 sentences that authentically reflect your values and typical behavior. `;
    userPrompt += `Include [Sentiment: positive/neutral/negative, Purchase Intent: 1-10] at the end.`;
    
    try {
      const response = await this.claudeHelper.client.messages.create({
        model: this.claudeHelper.config.model,
        max_tokens: 200,
        temperature: 0.7,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt
          }
        ]
      });
      
      return this.parseClaudeResponse(response, similarRespondents);
      
    } catch (error) {
      console.error('Claude API error:', error);
      // Fallback to survey-based response
      return this.generateFallbackResponse(similarRespondents, marketingContent);
    }
  }
  
  parseClaudeResponse(response, similarRespondents) {
    const text = response.content[0].text;
    
    // Extract sentiment and intent
    const sentimentMatch = text.match(/\[Sentiment:\s*(\w+)/i);
    const intentMatch = text.match(/Purchase Intent:\s*(\d+)/i);
    
    return {
      text: text.replace(/\[Sentiment:.*?\]/i, '').trim(),
      sentiment: sentimentMatch ? sentimentMatch[1].toLowerCase() : 'neutral',
      purchaseIntent: intentMatch ? parseInt(intentMatch[1]) : 5,
      basedOn: {
        surveyRespondents: similarRespondents.map(r => r.respondentId),
        method: 'claude-with-survey-data',
        similarity: similarRespondents[0]?.similarity || 0
      },
      timestamp: new Date().toISOString()
    };
  }
  
  generateFallbackResponse(similarRespondents, marketingContent) {
    // Use actual survey responses as fallback
    if (similarRespondents.length > 0) {
      const primary = similarRespondents[0];
      
      let response = '';
      if (primary.sustainability >= 4) {
        response = `This ${marketingContent.includes('sustain') ? 'aligns with' : 'ignores'} my environmental values. `;
      } else if (primary.priceSensitivity >= 4) {
        response = `What's the price? That's what matters most to me. `;
      } else {
        response = `I need to see how this balances quality and value. `;
      }
      
      response += `${primary.willingnessToPay >= 4 ? "I'd pay more for the right product." : "Not sure it's worth premium pricing."}`;
      
      return {
        text: response,
        sentiment: primary.sustainability >= 3 ? 'neutral' : 'negative',
        purchaseIntent: Math.round(primary.willingnessToPay * 2),
        basedOn: {
          surveyRespondents: [primary.respondentId],
          method: 'survey-fallback'
        }
      };
    }
    
    return {
      text: "I need more information to form an opinion.",
      sentiment: 'neutral',
      purchaseIntent: 5,
      basedOn: { method: 'generic-fallback' }
    };
  }
}

// Export singleton
let engine = null;
export async function getIntegratedPersonaEngine() {
  if (!engine) {
    engine = new IntegratedPersonaEngine();
    await engine.initialize();
  }
  return engine;
}