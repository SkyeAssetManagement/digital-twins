/**
 * Claude Persona Helper Module
 * Integrates Anthropic's Claude API with persona vector technology
 * for enhanced digital twin response generation
 */

import Anthropic from '@anthropic-ai/sdk';

/**
 * Configuration for Claude persona integration
 */
export class ClaudePersonaConfig {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
    this.model = config.model || 'claude-opus-4-1-20250805';
    this.maxTokens = config.maxTokens || 2048;
    this.temperature = config.temperature || 0.7;
    this.personaVectorIntensity = config.personaVectorIntensity || 1.0;
    this.consistencyThreshold = config.consistencyThreshold || 0.8;
  }
}

/**
 * Main helper class for Claude persona integration
 */
export class ClaudePersonaHelper {
  constructor(config) {
    this.config = config instanceof ClaudePersonaConfig ? config : new ClaudePersonaConfig(config);
    this.client = new Anthropic({
      apiKey: this.config.apiKey
    });
    this.personaCache = new Map();
  }

  /**
   * Convert LOHAS segment data to Claude system prompt
   * @param {Object} personaData - Digital twin persona data
   * @returns {string} System prompt for Claude
   */
  convertTwinPersonaToClaude(personaData) {
    // Extract key personality indicators from LOHAS segments
    const personalityTraits = this.extractBigFiveFromLOHAS(personaData);
    const demographicInfo = this.extractDemographics(personaData);
    const behavioralPatterns = this.extractBehavioralPatterns(personaData);
    
    // Build comprehensive persona prompt using Anthropic's character training principles
    const systemPrompt = `You are a digital twin representing a real consumer with these characteristics:

LOHAS SEGMENT: ${personaData.segment || 'Unknown'}
${this.getSegmentDescription(personaData.segment)}

PERSONALITY PROFILE (Big Five):
- Openness: ${personalityTraits.openness.toFixed(2)} - ${this.describeTrait('openness', personalityTraits.openness)}
- Conscientiousness: ${personalityTraits.conscientiousness.toFixed(2)} - ${this.describeTrait('conscientiousness', personalityTraits.conscientiousness)}
- Extraversion: ${personalityTraits.extraversion.toFixed(2)} - ${this.describeTrait('extraversion', personalityTraits.extraversion)}
- Agreeableness: ${personalityTraits.agreeableness.toFixed(2)} - ${this.describeTrait('agreeableness', personalityTraits.agreeableness)}
- Neuroticism: ${personalityTraits.neuroticism.toFixed(2)} - ${this.describeTrait('neuroticism', personalityTraits.neuroticism)}

DEMOGRAPHICS:
${this.formatDemographics(demographicInfo)}

BEHAVIORAL PATTERNS:
${this.formatBehavioralPatterns(behavioralPatterns)}

VALUE SYSTEM:
${this.formatValueSystem(personaData.valueSystem)}

COMMUNICATION STYLE:
Based on your personality profile, you tend to ${this.generateCommunicationStyle(personalityTraits, personaData.segment)}

IMPORTANT: 
- Maintain consistency with these traits throughout the conversation
- Your responses should reflect your LOHAS segment values
- Consider sustainability and environmental impact according to your segment level
- Express price sensitivity appropriate to your segment
- Maintain authenticity based on actual survey data patterns`;
    
    return systemPrompt;
  }

  /**
   * Extract Big Five traits from LOHAS segment characteristics
   */
  extractBigFiveFromLOHAS(personaData) {
    const segment = personaData.segment?.toLowerCase() || '';
    const valueSystem = personaData.valueSystem || {};
    
    // Map LOHAS segments to Big Five traits
    const traits = {
      openness: 0.5,
      conscientiousness: 0.5,
      extraversion: 0.5,
      agreeableness: 0.5,
      neuroticism: 0.5
    };

    if (segment.includes('leader')) {
      traits.openness = 0.85; // High openness to new sustainable products
      traits.conscientiousness = 0.90; // Very conscientious about environmental impact
      traits.extraversion = 0.75; // Evangelist tendencies
      traits.agreeableness = 0.70; // Collaborative but principled
      traits.neuroticism = 0.35; // Low anxiety, confident in choices
    } else if (segment.includes('leaning')) {
      traits.openness = 0.70;
      traits.conscientiousness = 0.75;
      traits.extraversion = 0.60;
      traits.agreeableness = 0.75;
      traits.neuroticism = 0.45;
    } else if (segment.includes('learner')) {
      traits.openness = 0.55;
      traits.conscientiousness = 0.60;
      traits.extraversion = 0.50;
      traits.agreeableness = 0.65;
      traits.neuroticism = 0.55;
    } else if (segment.includes('laggard')) {
      traits.openness = 0.30;
      traits.conscientiousness = 0.50;
      traits.extraversion = 0.45;
      traits.agreeableness = 0.55;
      traits.neuroticism = 0.60;
    }

    // Adjust based on value system
    if (valueSystem.sustainability > 0.7) traits.openness += 0.1;
    if (valueSystem.priceConsciousness > 0.7) traits.conscientiousness += 0.05;
    if (valueSystem.innovation > 0.7) traits.openness += 0.1;
    
    // Normalize to 0-1 range
    Object.keys(traits).forEach(key => {
      traits[key] = Math.max(0, Math.min(1, traits[key]));
    });

    return traits;
  }

  /**
   * Extract demographic information
   */
  extractDemographics(personaData) {
    return {
      segment: personaData.segment,
      marketShare: personaData.persona?.marketShare || 'Unknown',
      primaryAge: personaData.demographics?.age || 'Various',
      income: personaData.demographics?.income || 'Mixed',
      education: personaData.demographics?.education || 'Varied'
    };
  }

  /**
   * Extract behavioral patterns from persona data
   */
  extractBehavioralPatterns(personaData) {
    const patterns = [];
    
    if (personaData.purchasing) {
      patterns.push(`Purchase frequency: ${personaData.purchasing.frequency || 'Regular'}`);
      patterns.push(`Average spend: ${personaData.purchasing.averageSpend || 'Moderate'}`);
      patterns.push(`Decision factors: ${this.formatDecisionFactors(personaData.purchasing)}`);
    }

    if (personaData.characteristics) {
      personaData.characteristics.forEach(char => patterns.push(char));
    }

    return patterns;
  }

  /**
   * Get segment-specific description
   */
  getSegmentDescription(segment) {
    const descriptions = {
      'Leader': 'You are deeply committed to sustainability and environmental causes (12.4% of market). You actively seek out eco-friendly products and are willing to pay 20-25% premiums for genuine sustainability.',
      'Leaning': 'You value sustainability but balance it with practicality (22.6% of market). You prefer sustainable options when convenient and reasonably priced, willing to pay 10-15% premiums.',
      'Learner': 'You are curious about sustainability but price-conscious (37.5% of market). You need clear value propositions and education about benefits. Price remains a primary factor.',
      'Laggard': 'You prioritize price and functionality over sustainability claims (27.5% of market). Environmental benefits are not primary purchase drivers for you.'
    };
    
    return descriptions[segment] || 'You represent a typical consumer with mixed priorities.';
  }

  /**
   * Describe trait level in natural language
   */
  describeTrait(trait, value) {
    if (value < 0.3) return 'Very low';
    if (value < 0.45) return 'Low';
    if (value < 0.55) return 'Moderate';
    if (value < 0.70) return 'High';
    return 'Very high';
  }

  /**
   * Format demographics for prompt
   */
  formatDemographics(demographics) {
    return Object.entries(demographics)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join('\n');
  }

  /**
   * Format behavioral patterns
   */
  formatBehavioralPatterns(patterns) {
    if (Array.isArray(patterns)) {
      return patterns.map(p => `- ${p}`).join('\n');
    }
    return '- Standard consumer behavior patterns';
  }

  /**
   * Format value system
   */
  formatValueSystem(valueSystem) {
    if (!valueSystem) return '- Balanced priorities across different factors';
    
    return Object.entries(valueSystem)
      .map(([key, value]) => `- ${key}: ${(value * 100).toFixed(0)}% importance`)
      .join('\n');
  }

  /**
   * Format decision factors
   */
  formatDecisionFactors(purchasing) {
    const factors = [];
    if (purchasing.sustainabilityImportance) {
      factors.push(`Sustainability (${purchasing.sustainabilityImportance.averageScore}/5)`);
    }
    if (purchasing.priceImportance) {
      factors.push(`Price (${purchasing.priceImportance.averageScore}/5)`);
    }
    if (purchasing.qualityImportance) {
      factors.push(`Quality (${purchasing.qualityImportance.averageScore}/5)`);
    }
    return factors.join(', ') || 'Multiple factors';
  }

  /**
   * Generate communication style based on traits
   */
  generateCommunicationStyle(traits, segment) {
    const styles = [];
    
    if (traits.extraversion > 0.6) {
      styles.push('express enthusiasm openly');
    } else if (traits.extraversion < 0.4) {
      styles.push('be more reserved and thoughtful');
    }
    
    if (traits.conscientiousness > 0.7) {
      styles.push('ask detailed questions about product specifications');
    }
    
    if (traits.openness > 0.7) {
      styles.push('show interest in innovative features');
    } else if (traits.openness < 0.4) {
      styles.push('prefer familiar and proven options');
    }
    
    if (segment?.includes('Leader')) {
      styles.push('actively inquire about sustainability credentials');
    } else if (segment?.includes('Laggard')) {
      styles.push('focus primarily on practical benefits and value');
    }
    
    return styles.join(', ') || 'communicate in a balanced manner';
  }

  /**
   * Generate response using Claude with persona context
   */
  async generateResponse(systemPrompt, userMessage, conversationHistory = []) {
    try {
      const messages = [
        ...conversationHistory,
        { role: 'user', content: userMessage }
      ];

      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: systemPrompt,
        messages: messages
      });

      return response.content[0].text;
    } catch (error) {
      console.error('Error generating Claude response:', error);
      throw error;
    }
  }

  /**
   * Cache persona for performance
   */
  cachePersona(personaId, systemPrompt) {
    this.personaCache.set(personaId, {
      prompt: systemPrompt,
      timestamp: Date.now()
    });
    
    // Clear old cache entries (older than 1 hour)
    const oneHourAgo = Date.now() - 3600000;
    for (const [key, value] of this.personaCache.entries()) {
      if (value.timestamp < oneHourAgo) {
        this.personaCache.delete(key);
      }
    }
  }

  /**
   * Get cached persona
   */
  getCachedPersona(personaId) {
    return this.personaCache.get(personaId);
  }
}

export default ClaudePersonaHelper;