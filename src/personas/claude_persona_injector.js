/**
 * Claude Persona Injector Module
 * Injects persona vectors into Claude API calls for consistent personality expression
 */

import { ClaudePersonaHelper } from '../claude/claude_persona_helper.js';

/**
 * Main class for injecting persona vectors into Claude interactions
 */
export class ClaudePersonaInjector {
  constructor(anthropicClient) {
    this.client = anthropicClient;
    this.vectorMonitor = new PersonaVectorMonitor();
    this.enhancementCache = new Map();
  }

  /**
   * Inject persona with monitoring and consistency checks
   */
  async injectPersonaWithMonitoring(systemPrompt, userMessage, personaVector, conversationHistory = []) {
    // Enhance system prompt with vector-derived characteristics
    const enhancedPrompt = this.enhancePromptWithVectors(systemPrompt, personaVector);
    
    // Add consistency reinforcement if needed
    const consistencyPrompt = this.generateConsistencyReinforcement(conversationHistory, personaVector);
    const fullPrompt = consistencyPrompt ? enhancedPrompt + '\n\n' + consistencyPrompt : enhancedPrompt;
    
    // Prepare messages with persona context
    const messages = this.prepareMessagesWithContext(conversationHistory, userMessage, personaVector);
    
    // Calculate optimal temperature based on persona
    const temperature = this.calculateOptimalTemperature(personaVector);
    
    try {
      // Generate response with Claude
      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2048,
        temperature: temperature,
        system: fullPrompt,
        messages: messages
      });
      
      const responseText = response.content[0].text;
      
      // Monitor response for persona drift
      const driftScore = this.vectorMonitor.detectDrift(responseText, personaVector);
      
      if (driftScore > 0.3) {
        console.log(`Persona drift detected: ${driftScore.toFixed(2)}`);
        this.logDriftEvent(personaVector, responseText, driftScore);
      }
      
      return responseText;
    } catch (error) {
      console.error('Error injecting persona:', error);
      throw error;
    }
  }

  /**
   * Enhance prompt with vector-derived characteristics
   */
  enhancePromptWithVectors(basePrompt, personaVector) {
    const cacheKey = this.getVectorCacheKey(personaVector);
    
    if (this.enhancementCache.has(cacheKey)) {
      const cached = this.enhancementCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 300000) { // 5 minute cache
        return basePrompt + cached.enhancement;
      }
    }
    
    const traits = this.decodeVectorToTraits(personaVector);
    
    const enhancement = `

PERSONA VECTOR GUIDANCE:
Your responses should strongly reflect these characteristics:
- Primary trait expression: ${traits.primary} (intensity: ${traits.primaryIntensity.toFixed(2)})
- Secondary traits: ${traits.secondary.join(', ')}
- Communication patterns: ${this.vectorToCommunicationStyle(personaVector)}
- Emotional baseline: ${this.vectorToEmotionalState(personaVector)}
- Decision-making style: ${this.vectorToDecisionStyle(personaVector)}

BEHAVIORAL CONSISTENCY:
- Maintain ${this.getConsistencyLevel(personaVector)} consistency in responses
- Express ${this.getSustainabilityFocus(personaVector)} sustainability consciousness
- Show ${this.getPriceSensitivity(personaVector)} price sensitivity
- Demonstrate ${this.getBrandLoyalty(personaVector)} brand loyalty`;
    
    this.enhancementCache.set(cacheKey, {
      enhancement: enhancement,
      timestamp: Date.now()
    });
    
    return basePrompt + enhancement;
  }

  /**
   * Generate consistency reinforcement based on drift
   */
  generateConsistencyReinforcement(conversationHistory, personaVector) {
    if (!conversationHistory || conversationHistory.length === 0) {
      return null;
    }
    
    const consistencyScore = this.vectorMonitor.calculateConsistency(conversationHistory, personaVector);
    
    if (consistencyScore < 0.8) {
      const traits = this.decodeVectorToTraits(personaVector);
      
      return `CONSISTENCY REMINDER: Your recent responses have drifted from your core personality.
Remember to maintain your established traits:
${this.generateTraitReminder(traits)}`;
    }
    
    return null;
  }

  /**
   * Prepare messages with persona context
   */
  prepareMessagesWithContext(conversationHistory, userMessage, personaVector) {
    const messages = [];
    
    if (conversationHistory && conversationHistory.length > 0) {
      // Filter history for consistency
      const filteredHistory = this.filterHistoryForConsistency(conversationHistory, personaVector);
      messages.push(...filteredHistory);
    }
    
    messages.push({
      role: 'user',
      content: userMessage
    });
    
    return messages;
  }

  /**
   * Calculate optimal temperature based on persona vector
   */
  calculateOptimalTemperature(personaVector) {
    const traits = this.decodeVectorToTraits(personaVector);
    
    // Higher openness = more creative responses (higher temperature)
    const opennessEffect = traits.openness * 0.3;
    
    // Higher conscientiousness = more consistent responses (lower temperature)
    const conscientiousnessEffect = traits.conscientiousness * -0.2;
    
    // Higher neuroticism = more variable responses
    const neuroticismEffect = traits.neuroticism * 0.2;
    
    // Base temperature of 0.7
    let temperature = 0.7 + opennessEffect + conscientiousnessEffect + neuroticismEffect;
    
    // Clamp between 0.3 and 1.0
    return Math.max(0.3, Math.min(1.0, temperature));
  }

  /**
   * Decode vector to personality traits
   */
  decodeVectorToTraits(personaVector) {
    const traits = {
      openness: this.extractTraitFromVector(personaVector, 0, 76),
      conscientiousness: this.extractTraitFromVector(personaVector, 76, 152),
      extraversion: this.extractTraitFromVector(personaVector, 152, 228),
      agreeableness: this.extractTraitFromVector(personaVector, 228, 304),
      neuroticism: this.extractTraitFromVector(personaVector, 304, 380)
    };
    
    // Identify primary trait
    const sortedTraits = Object.entries(traits).sort((a, b) => b[1] - a[1]);
    
    return {
      ...traits,
      primary: sortedTraits[0][0],
      primaryIntensity: sortedTraits[0][1],
      secondary: sortedTraits.slice(1, 3).map(t => t[0])
    };
  }

  /**
   * Extract trait score from vector segment
   */
  extractTraitFromVector(vector, start, end) {
    let sum = 0;
    let count = 0;
    
    for (let i = start; i < end && i < vector.length; i++) {
      sum += Math.abs(vector[i]);
      count++;
    }
    
    return count > 0 ? sum / count : 0.5;
  }

  /**
   * Convert vector to communication style description
   */
  vectorToCommunicationStyle(personaVector) {
    const traits = this.decodeVectorToTraits(personaVector);
    const styles = [];
    
    if (traits.extraversion > 0.6) {
      styles.push('enthusiastic and expressive');
    } else if (traits.extraversion < 0.4) {
      styles.push('reserved and thoughtful');
    }
    
    if (traits.agreeableness > 0.6) {
      styles.push('warm and supportive');
    }
    
    if (traits.conscientiousness > 0.7) {
      styles.push('detailed and organized');
    }
    
    if (traits.openness > 0.7) {
      styles.push('creative and exploratory');
    }
    
    return styles.length > 0 ? styles.join(', ') : 'balanced and moderate';
  }

  /**
   * Convert vector to emotional state description
   */
  vectorToEmotionalState(personaVector) {
    const traits = this.decodeVectorToTraits(personaVector);
    
    if (traits.neuroticism < 0.3) {
      return 'Emotionally stable and confident';
    } else if (traits.neuroticism < 0.5) {
      return 'Generally calm with occasional concerns';
    } else if (traits.neuroticism < 0.7) {
      return 'Moderately sensitive to stress';
    } else {
      return 'Emotionally expressive and reactive';
    }
  }

  /**
   * Convert vector to decision-making style
   */
  vectorToDecisionStyle(personaVector) {
    const traits = this.decodeVectorToTraits(personaVector);
    
    if (traits.conscientiousness > 0.7 && traits.openness < 0.4) {
      return 'Methodical and risk-averse';
    } else if (traits.openness > 0.7 && traits.conscientiousness < 0.4) {
      return 'Intuitive and experimental';
    } else if (traits.conscientiousness > 0.6 && traits.openness > 0.6) {
      return 'Balanced analytical approach';
    } else {
      return 'Pragmatic and situation-dependent';
    }
  }

  /**
   * Get consistency level description
   */
  getConsistencyLevel(personaVector) {
    const traits = this.decodeVectorToTraits(personaVector);
    
    if (traits.conscientiousness > 0.8) {
      return 'very high';
    } else if (traits.conscientiousness > 0.6) {
      return 'high';
    } else if (traits.conscientiousness > 0.4) {
      return 'moderate';
    } else {
      return 'flexible';
    }
  }

  /**
   * Get sustainability focus from vector
   */
  getSustainabilityFocus(personaVector) {
    // Check sustainability dimensions (0-95)
    let sustainabilityScore = 0;
    for (let i = 0; i < 95 && i < personaVector.length; i++) {
      sustainabilityScore += Math.abs(personaVector[i]);
    }
    sustainabilityScore = sustainabilityScore / 95;
    
    if (sustainabilityScore > 0.8) {
      return 'very high';
    } else if (sustainabilityScore > 0.6) {
      return 'high';
    } else if (sustainabilityScore > 0.4) {
      return 'moderate';
    } else {
      return 'low';
    }
  }

  /**
   * Get price sensitivity from vector
   */
  getPriceSensitivity(personaVector) {
    // Check price dimensions (96-191)
    let priceScore = 0;
    for (let i = 96; i < 191 && i < personaVector.length; i++) {
      priceScore += Math.abs(personaVector[i]);
    }
    priceScore = priceScore / 95;
    
    if (priceScore > 0.8) {
      return 'very high';
    } else if (priceScore > 0.6) {
      return 'high';
    } else if (priceScore > 0.4) {
      return 'moderate';
    } else {
      return 'low';
    }
  }

  /**
   * Get brand loyalty from vector
   */
  getBrandLoyalty(personaVector) {
    const traits = this.decodeVectorToTraits(personaVector);
    const loyalty = (traits.conscientiousness * 0.5 + traits.agreeableness * 0.3 + (1 - traits.openness) * 0.2);
    
    if (loyalty > 0.7) {
      return 'very high';
    } else if (loyalty > 0.5) {
      return 'moderate';
    } else {
      return 'low';
    }
  }

  /**
   * Generate trait reminder for consistency
   */
  generateTraitReminder(traits) {
    const reminders = [];
    
    if (traits.openness > 0.7) {
      reminders.push('- Stay curious and open to innovative solutions');
    } else if (traits.openness < 0.4) {
      reminders.push('- Prefer proven and traditional approaches');
    }
    
    if (traits.conscientiousness > 0.7) {
      reminders.push('- Focus on details and quality');
    }
    
    if (traits.extraversion > 0.7) {
      reminders.push('- Express enthusiasm and social engagement');
    } else if (traits.extraversion < 0.4) {
      reminders.push('- Maintain reserved and thoughtful demeanor');
    }
    
    if (traits.agreeableness > 0.7) {
      reminders.push('- Show cooperation and trust');
    }
    
    return reminders.join('\n');
  }

  /**
   * Filter conversation history for consistency
   */
  filterHistoryForConsistency(history, personaVector) {
    // Keep only recent and relevant messages
    const maxHistory = 10;
    const recentHistory = history.slice(-maxHistory);
    
    // Check each message for consistency
    return recentHistory.filter(msg => {
      if (msg.role === 'assistant') {
        const drift = this.vectorMonitor.detectDrift(msg.content, personaVector);
        return drift < 0.5; // Filter out highly inconsistent messages
      }
      return true; // Keep all user messages
    });
  }

  /**
   * Log drift event for analysis
   */
  logDriftEvent(personaVector, response, driftScore) {
    const event = {
      timestamp: new Date().toISOString(),
      driftScore: driftScore,
      vectorSummary: this.decodeVectorToTraits(personaVector),
      responseLength: response.length,
      responseSnippet: response.substring(0, 100)
    };
    
    // In production, send to monitoring service
    console.log('Drift event:', event);
  }

  /**
   * Get cache key for vector
   */
  getVectorCacheKey(personaVector) {
    // Use first 10 values as cache key
    const keyValues = Array.from(personaVector.slice(0, 10));
    return keyValues.map(v => v.toFixed(3)).join(',');
  }
}

/**
 * Monitor persona consistency
 */
class PersonaVectorMonitor {
  /**
   * Calculate consistency score for conversation history
   */
  calculateConsistency(conversationHistory, personaVector) {
    if (!conversationHistory || conversationHistory.length === 0) {
      return 1.0;
    }
    
    const assistantMessages = conversationHistory.filter(m => m.role === 'assistant');
    if (assistantMessages.length === 0) {
      return 1.0;
    }
    
    let totalConsistency = 0;
    for (const message of assistantMessages) {
      const drift = this.detectDrift(message.content, personaVector);
      totalConsistency += (1 - drift);
    }
    
    return totalConsistency / assistantMessages.length;
  }

  /**
   * Detect personality drift in response
   */
  detectDrift(responseText, personaVector) {
    // Simple heuristic-based drift detection
    // In production, use embeddings and vector similarity
    
    const traits = this.extractTraitsFromText(responseText);
    const vectorTraits = this.extractVectorTraits(personaVector);
    
    let driftScore = 0;
    let traitCount = 0;
    
    for (const trait in traits) {
      if (vectorTraits[trait] !== undefined) {
        const difference = Math.abs(traits[trait] - vectorTraits[trait]);
        driftScore += difference;
        traitCount++;
      }
    }
    
    return traitCount > 0 ? driftScore / traitCount : 0;
  }

  /**
   * Extract traits from text (simplified heuristic)
   */
  extractTraitsFromText(text) {
    const traits = {
      openness: 0.5,
      conscientiousness: 0.5,
      extraversion: 0.5,
      agreeableness: 0.5,
      neuroticism: 0.5
    };
    
    // Openness indicators
    if (text.match(/innovative|creative|explore|new|interesting/gi)) {
      traits.openness += 0.2;
    }
    if (text.match(/traditional|proven|standard|usual/gi)) {
      traits.openness -= 0.2;
    }
    
    // Conscientiousness indicators
    if (text.match(/careful|detailed|quality|precise|thorough/gi)) {
      traits.conscientiousness += 0.2;
    }
    
    // Extraversion indicators
    if (text.match(/excited|enthusiastic|social|share|community/gi)) {
      traits.extraversion += 0.2;
    }
    if (text.match(/prefer|quiet|alone|individual/gi)) {
      traits.extraversion -= 0.2;
    }
    
    // Agreeableness indicators
    if (text.match(/help|support|trust|cooperate|together/gi)) {
      traits.agreeableness += 0.2;
    }
    
    // Neuroticism indicators
    if (text.match(/worry|concern|stress|anxious|uncertain/gi)) {
      traits.neuroticism += 0.2;
    }
    if (text.match(/confident|calm|stable|certain|sure/gi)) {
      traits.neuroticism -= 0.2;
    }
    
    // Normalize traits
    for (const trait in traits) {
      traits[trait] = Math.max(0, Math.min(1, traits[trait]));
    }
    
    return traits;
  }

  /**
   * Extract traits from persona vector
   */
  extractVectorTraits(personaVector) {
    return {
      openness: this.extractTraitScore(personaVector, 0, 76),
      conscientiousness: this.extractTraitScore(personaVector, 76, 152),
      extraversion: this.extractTraitScore(personaVector, 152, 228),
      agreeableness: this.extractTraitScore(personaVector, 228, 304),
      neuroticism: this.extractTraitScore(personaVector, 304, 380)
    };
  }

  /**
   * Extract trait score from vector segment
   */
  extractTraitScore(vector, start, end) {
    let sum = 0;
    let count = 0;
    
    for (let i = start; i < end && i < vector.length; i++) {
      sum += Math.abs(vector[i]);
      count++;
    }
    
    return count > 0 ? sum / count : 0.5;
  }
}

export default ClaudePersonaInjector;