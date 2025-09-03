import { getSurveyResponseLoader } from '../data_processing/survey_response_loader.js';

export class SurveyPersonaInjector {
  constructor() {
    this.surveyLoader = null;
  }
  
  async initialize() {
    this.surveyLoader = await getSurveyResponseLoader();
  }
  
  /**
   * Creates a Claude system prompt from actual survey respondents
   */
  async createPersonaFromSurvey(segment, numRespondents = 5) {
    // Get random actual respondents from this segment
    const respondents = this.surveyLoader.getRandomResponses(segment, numRespondents);
    
    if (respondents.length === 0) {
      throw new Error(`No survey data for segment: ${segment}`);
    }
    
    // Calculate aggregate statistics
    const avgScores = this.calculateAverageScores(respondents);
    
    // Build persona from real responses
    const persona = this.buildPersonaPrompt(segment, respondents, avgScores);
    
    return persona;
  }
  
  calculateAverageScores(respondents) {
    const scores = {
      sustainability: 0,
      priceSensitivity: 0,
      willingnessToPay: 0,
      brandValues: 0,
      activism: 0,
      envEvangelist: 0,
      count: 0
    };
    
    respondents.forEach(r => {
      if (r.sustainability !== null) {
        scores.sustainability += r.sustainability;
        scores.count++;
      }
      if (r.priceSensitivity !== null) scores.priceSensitivity += r.priceSensitivity;
      if (r.willingnessToPay !== null) scores.willingnessToPay += r.willingnessToPay;
      if (r.brandValues !== null) scores.brandValues += r.brandValues;
      if (r.activism !== null) scores.activism += r.activism;
      if (r.envEvangelist !== null) scores.envEvangelist += r.envEvangelist;
    });
    
    // Normalize
    Object.keys(scores).forEach(key => {
      if (key !== 'count') {
        scores[key] = scores.count > 0 ? (scores[key] / scores.count).toFixed(2) : 0;
      }
    });
    
    return scores;
  }
  
  buildPersonaPrompt(segment, respondents, avgScores) {
    // Start with demographic grounding
    let prompt = `You are a surf clothing consumer from the ${segment} segment of the LOHAS framework.\n\n`;
    
    // Add statistical grounding
    prompt += `FACTUAL SURVEY DATA FROM YOUR SEGMENT:\n`;
    prompt += `- Average sustainability importance: ${avgScores.sustainability}/5\n`;
    prompt += `- Average price sensitivity: ${avgScores.priceSensitivity}/5\n`;
    prompt += `- Average willingness to pay premium: ${avgScores.willingnessToPay}/5\n`;
    prompt += `- Average brand values alignment: ${avgScores.brandValues}/5\n`;
    prompt += `- Environmental activism level: ${avgScores.activism}/5\n\n`;
    
    // Add actual response examples
    prompt += `ACTUAL RESPONSES FROM PEOPLE LIKE YOU:\n`;
    respondents.forEach((r, i) => {
      if (r.exampleResponses && r.exampleResponses.length > 0) {
        r.exampleResponses.forEach(ex => {
          if (ex.response) {
            prompt += `- "${ex.response}"\n`;
          }
        });
      }
    });
    prompt += '\n';
    
    // Add behavioral patterns
    prompt += this.getSegmentBehaviors(segment, avgScores);
    
    // Add response instructions
    prompt += `\nRESPONSE STYLE:\n`;
    prompt += this.getResponseStyle(segment, avgScores);
    
    // Add consistency rules
    prompt += `\nCONSISTENCY RULES:\n`;
    prompt += `- Your responses must align with the ${avgScores.sustainability}/5 sustainability score\n`;
    prompt += `- Your price sensitivity is ${avgScores.priceSensitivity}/5 - respond accordingly\n`;
    prompt += `- You ${avgScores.willingnessToPay >= 4 ? 'WILL' : avgScores.willingnessToPay >= 3 ? 'MIGHT' : 'WON\'T'} pay premium for aligned values\n`;
    prompt += `- Stay consistent with the actual survey responses above\n`;
    
    return prompt;
  }
  
  getSegmentBehaviors(segment, scores) {
    let behaviors = `BEHAVIORAL PATTERNS:\n`;
    
    switch(segment) {
      case 'Leader':
        behaviors += `- You actively research environmental impact before purchasing\n`;
        behaviors += `- You have switched brands due to sustainability concerns\n`;
        behaviors += `- You influence others about sustainable consumption\n`;
        behaviors += `- You participate in ocean conservation activities\n`;
        if (scores.willingnessToPay >= 4) {
          behaviors += `- You regularly pay 25%+ premium for certified sustainable products\n`;
        }
        break;
        
      case 'Leaning':
        behaviors += `- You consider sustainability when quality and price are comparable\n`;
        behaviors += `- You prefer eco-friendly but won't sacrifice performance\n`;
        behaviors += `- You research products but aren't obsessive about sustainability\n`;
        if (scores.priceSensitivity >= 3) {
          behaviors += `- You look for sales even on sustainable products\n`;
        }
        break;
        
      case 'Learner':
        behaviors += `- You compare prices across multiple sites before buying\n`;
        behaviors += `- You're curious about sustainability but skeptical of claims\n`;
        behaviors += `- You prioritize function and value over brand values\n`;
        if (scores.priceSensitivity >= 4) {
          behaviors += `- You wait for sales and use discount codes religiously\n`;
        }
        break;
        
      case 'Laggard':
        behaviors += `- You buy the cheapest option that meets basic needs\n`;
        behaviors += `- You dismiss sustainability as marketing hype\n`;
        behaviors += `- You shop at discount stores and outlets primarily\n`;
        behaviors += `- You keep products until they completely wear out\n`;
        break;
    }
    
    behaviors += '\n';
    return behaviors;
  }
  
  getResponseStyle(segment, scores) {
    switch(segment) {
      case 'Leader':
        return `- Ask about supply chain transparency and certifications
- Express willingness to pay premium (${scores.willingnessToPay}/5 level)
- Mention specific environmental concerns (ocean plastic, carbon footprint)
- Reference past sustainable purchases or brand switches
- Be knowledgeable about greenwashing tactics`;
        
      case 'Leaning':
        return `- Balance environmental interest with practical concerns
- Ask about durability and quality alongside sustainability
- Show price awareness but flexibility for value
- Express moderate skepticism about unverified claims
- Mention comparing options before deciding`;
        
      case 'Learner':
        return `- Lead with price and value questions
- Show curiosity but not commitment to sustainability
- Express budget constraints clearly
- Ask "what's in it for me?" regarding eco-features
- Compare to cheaper alternatives frequently`;
        
      case 'Laggard':
        return `- Focus exclusively on price and basic functionality
- Dismiss or ignore sustainability messaging
- Express skepticism about all marketing claims
- Mention discount stores as preferred options
- Show no willingness to pay premiums`;
        
      default:
        return '- Respond based on the survey data patterns above';
    }
  }
  
  /**
   * Creates a full Claude API request with survey-based persona
   */
  async createClaudeRequest(segment, marketingContent, similarResponses = []) {
    const systemPrompt = await this.createPersonaFromSurvey(segment);
    
    // Add context from similar responses if available
    let context = '';
    if (similarResponses.length > 0) {
      context = '\n\nRECENT SIMILAR RESPONSES FROM YOUR SEGMENT:\n';
      similarResponses.forEach(r => {
        context += `- Someone with ${r.sustainability}/5 sustainability score said: "${r.searchableText}"\n`;
      });
    }
    
    const userPrompt = `React to this marketing content as your authentic self based on the survey data:

"${marketingContent}"

${context}

Provide a genuine 2-3 sentence response that reflects your segment's actual values and behaviors. Include [Sentiment: positive/neutral/negative, Purchase Intent: 1-10] at the end.`;
    
    return {
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 200,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt
        }
      ],
      temperature: 0.7,  // Some variation but consistent personality
      metadata: {
        segment: segment,
        basedOnSurveyData: true,
        respondentCount: 5
      }
    };
  }
  
  /**
   * Inject survey-based personality vectors into Claude request
   */
  async injectPersonalityVector(request, segment) {
    // Get actual survey respondents
    const respondents = this.surveyLoader.getRandomResponses(segment, 3);
    
    // Create personality vector from real data
    const personalityVector = this.createPersonalityVector(respondents);
    
    // Enhance the system prompt with vector-based constraints
    request.system = this.enhanceWithPersonalityVector(request.system, personalityVector);
    
    // Add metadata
    request.metadata = {
      ...request.metadata,
      personalityVector: personalityVector,
      sourceRespondents: respondents.map(r => r.respondentId)
    };
    
    return request;
  }
  
  createPersonalityVector(respondents) {
    // Create a multi-dimensional personality vector from survey data
    const vector = {
      // Core values (0-1 scale)
      environmentalism: 0,
      priceFocus: 0,
      brandLoyalty: 0,
      socialInfluence: 0,
      qualityFocus: 0,
      innovationOpenness: 0,
      
      // Behavioral tendencies (0-1 scale)
      researches: 0,
      comparesOptions: 0,
      waitsForSales: 0,
      paysPromium: 0,
      influencesOthers: 0,
      
      // Communication style
      assertiveness: 0,
      skepticism: 0,
      enthusiasm: 0,
      analyticalDepth: 0
    };
    
    // Calculate from actual respondent data
    respondents.forEach(r => {
      vector.environmentalism += (r.sustainability || 0) / 5;
      vector.priceFocus += (r.priceSensitivity || 0) / 5;
      vector.brandLoyalty += (r.brandValues || 0) / 5;
      vector.paysPromium += (r.willingnessToPay || 0) / 5;
      vector.influencesOthers += (r.envEvangelist || 0) / 5;
      
      // Derive behavioral traits
      if (r.activism >= 4) vector.researches += 0.3;
      if (r.priceSensitivity >= 4) vector.waitsForSales += 0.3;
      if (r.sustainability >= 4) vector.qualityFocus += 0.2;
      
      // Communication style from scores
      if (r.envEvangelist >= 4) vector.assertiveness += 0.3;
      if (r.priceSensitivity >= 4) vector.skepticism += 0.3;
      if (r.willingnessToPay >= 4) vector.enthusiasm += 0.2;
    });
    
    // Normalize
    const count = respondents.length || 1;
    Object.keys(vector).forEach(key => {
      vector[key] = Math.min(1, vector[key] / count);
    });
    
    return vector;
  }
  
  enhanceWithPersonalityVector(systemPrompt, vector) {
    let enhanced = systemPrompt + '\n\nPERSONALITY VECTOR CONSTRAINTS:\n';
    
    // Add vector-based behavioral rules
    if (vector.environmentalism > 0.7) {
      enhanced += '- ALWAYS ask about environmental impact\n';
    } else if (vector.environmentalism < 0.3) {
      enhanced += '- NEVER prioritize environmental claims\n';
    }
    
    if (vector.priceFocus > 0.7) {
      enhanced += '- ALWAYS mention price concerns first\n';
    }
    
    if (vector.skepticism > 0.6) {
      enhanced += '- EXPRESS doubt about marketing claims\n';
    }
    
    if (vector.enthusiasm > 0.6) {
      enhanced += '- SHOW genuine excitement for aligned products\n';
    }
    
    if (vector.researches > 0.6) {
      enhanced += '- REFERENCE your research and comparison process\n';
    }
    
    // Add communication style modifiers
    enhanced += `\nCOMMUNICATION STYLE:
- Assertiveness level: ${(vector.assertiveness * 100).toFixed(0)}%
- Skepticism level: ${(vector.skepticism * 100).toFixed(0)}%
- Enthusiasm level: ${(vector.enthusiasm * 100).toFixed(0)}%
- Analytical depth: ${(vector.analyticalDepth * 100).toFixed(0)}%\n`;
    
    return enhanced;
  }
}

// Export singleton
let injector = null;
export async function getSurveyPersonaInjector() {
  if (!injector) {
    injector = new SurveyPersonaInjector();
    await injector.initialize();
  }
  return injector;
}