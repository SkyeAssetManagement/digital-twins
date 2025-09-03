/**
 * Persona Consistency Manager
 * Maintains personality consistency while allowing natural variation
 */

/**
 * Main consistency manager class
 */
export class PersonaConsistencyManager {
  constructor() {
    this.driftThreshold = 0.3;
    this.variationRange = 0.1;
    this.consistencyHistory = new Map();
  }

  /**
   * Apply contextual variation while maintaining core traits
   */
  applyContextualVariation(basePersonaVector, context) {
    // Calculate context-appropriate modifications
    const moodModifier = this.calculateMoodModifier(context);
    const energyModifier = this.calculateEnergyModifier(context);
    const formalityModifier = this.calculateFormalityModifier(context);
    
    // Create a copy of the base vector
    const variedVector = new Float32Array(basePersonaVector);
    
    // Apply bounded variation to prevent drift
    
    // Modify extraversion dimensions (152-228) based on energy
    for (let i = 152; i < 228 && i < variedVector.length; i++) {
      const variation = energyModifier * this.variationRange;
      variedVector[i] *= (1 + variation);
      variedVector[i] = this.clampValue(
        variedVector[i],
        basePersonaVector[i] - this.variationRange,
        basePersonaVector[i] + this.variationRange
      );
    }
    
    // Modify neuroticism dimensions (304-380) based on mood
    for (let i = 304; i < 380 && i < variedVector.length; i++) {
      const variation = moodModifier * this.variationRange;
      variedVector[i] *= (1 + variation);
      variedVector[i] = this.clampValue(
        variedVector[i],
        basePersonaVector[i] - this.variationRange,
        basePersonaVector[i] + this.variationRange
      );
    }
    
    // Modify conscientiousness dimensions (76-152) based on formality
    for (let i = 76; i < 152 && i < variedVector.length; i++) {
      const variation = formalityModifier * this.variationRange * 0.5;
      variedVector[i] *= (1 + variation);
      variedVector[i] = this.clampValue(
        variedVector[i],
        basePersonaVector[i] - this.variationRange * 0.5,
        basePersonaVector[i] + this.variationRange * 0.5
      );
    }
    
    return this.normalizeWithPreservation(variedVector, basePersonaVector);
  }

  /**
   * Prevent personality drift using split-softmax approach
   */
  preventPersonalityDrift(conversationHistory, basePersonaVector, currentResponse) {
    // Calculate drift score
    const responseVector = this.responseToVector(currentResponse);
    const driftScore = this.calculateDriftScore(responseVector, basePersonaVector);
    
    if (driftScore > this.driftThreshold) {
      // Identify violated traits
      const violatedTraits = this.identifyViolatedTraits(responseVector, basePersonaVector);
      
      // Generate corrective prompt
      const correctionPrompt = this.generateCorrectionPrompt(violatedTraits, basePersonaVector);
      
      return {
        needsCorrection: true,
        correctionPrompt: correctionPrompt,
        driftScore: driftScore,
        violatedTraits: violatedTraits
      };
    }
    
    return {
      needsCorrection: false,
      driftScore: driftScore
    };
  }

  /**
   * Calculate mood modifier from context
   */
  calculateMoodModifier(context) {
    if (!context || !context.recentMessages) {
      return 0.0;
    }
    
    const recentMessages = context.recentMessages;
    
    // Analyze sentiment
    const positiveIndicators = [
      'happy', 'excited', 'great', 'wonderful', 'excellent',
      'amazing', 'fantastic', 'love', 'perfect', 'awesome'
    ];
    
    const negativeIndicators = [
      'sad', 'frustrated', 'angry', 'disappointed', 'upset',
      'terrible', 'awful', 'hate', 'horrible', 'bad'
    ];
    
    let positiveScore = 0;
    let negativeScore = 0;
    
    for (const msg of recentMessages) {
      const text = (msg.content || msg).toLowerCase();
      
      for (const indicator of positiveIndicators) {
        if (text.includes(indicator)) {
          positiveScore++;
        }
      }
      
      for (const indicator of negativeIndicators) {
        if (text.includes(indicator)) {
          negativeScore++;
        }
      }
    }
    
    const totalMessages = Math.max(recentMessages.length, 1);
    return (positiveScore - negativeScore) / totalMessages;
  }

  /**
   * Calculate energy modifier from context
   */
  calculateEnergyModifier(context) {
    if (!context) return 0.0;
    
    // Time of day effects
    const hour = new Date().getHours();
    let timeEffect = 0;
    
    if (hour >= 9 && hour <= 11) {
      timeEffect = 0.2; // Morning energy
    } else if (hour >= 14 && hour <= 16) {
      timeEffect = -0.1; // Afternoon dip
    } else if (hour >= 20 || hour <= 6) {
      timeEffect = -0.2; // Evening/night fatigue
    }
    
    // Conversation length effects
    const conversationLength = context.recentMessages ? context.recentMessages.length : 0;
    const lengthEffect = conversationLength > 20 ? -0.1 : 0;
    
    return timeEffect + lengthEffect;
  }

  /**
   * Calculate formality modifier from context
   */
  calculateFormalityModifier(context) {
    if (!context || !context.recentMessages) {
      return 0.0;
    }
    
    const formalIndicators = [
      'mr.', 'mrs.', 'ms.', 'dr.', 'sir', 'madam',
      'please', 'thank you', 'would', 'could', 'may'
    ];
    
    const informalIndicators = [
      'hey', 'hi', 'yeah', 'yep', 'nope', 'gonna',
      'wanna', 'lol', 'omg', 'btw', 'thx'
    ];
    
    let formalScore = 0;
    let informalScore = 0;
    
    for (const msg of context.recentMessages) {
      const text = (msg.content || msg).toLowerCase();
      
      for (const indicator of formalIndicators) {
        if (text.includes(indicator)) {
          formalScore++;
        }
      }
      
      for (const indicator of informalIndicators) {
        if (text.includes(indicator)) {
          informalScore++;
        }
      }
    }
    
    const totalMessages = Math.max(context.recentMessages.length, 1);
    return (formalScore - informalScore) / totalMessages;
  }

  /**
   * Convert response text to vector representation
   */
  responseToVector(responseText) {
    const vector = new Float32Array(384);
    
    // Extract linguistic features
    const features = this.extractLinguisticFeatures(responseText);
    
    // Map features to vector dimensions
    // Openness (0-76)
    const opennessScore = features.creativityScore;
    for (let i = 0; i < 76; i++) {
      vector[i] = opennessScore * (0.5 + Math.random() * 0.1);
    }
    
    // Conscientiousness (76-152)
    const conscientiousnessScore = features.structureScore;
    for (let i = 76; i < 152; i++) {
      vector[i] = conscientiousnessScore * (0.5 + Math.random() * 0.1);
    }
    
    // Extraversion (152-228)
    const extraversionScore = features.socialScore;
    for (let i = 152; i < 228; i++) {
      vector[i] = extraversionScore * (0.5 + Math.random() * 0.1);
    }
    
    // Agreeableness (228-304)
    const agreeablenessScore = features.positivityScore;
    for (let i = 228; i < 304; i++) {
      vector[i] = agreeablenessScore * (0.5 + Math.random() * 0.1);
    }
    
    // Neuroticism (304-380)
    const neuroticismScore = features.emotionalityScore;
    for (let i = 304; i < 380; i++) {
      vector[i] = neuroticismScore * (0.5 + Math.random() * 0.1);
    }
    
    return this.normalizeVector(vector);
  }

  /**
   * Extract linguistic features from text
   */
  extractLinguisticFeatures(text) {
    const features = {
      creativityScore: 0.5,
      structureScore: 0.5,
      socialScore: 0.5,
      positivityScore: 0.5,
      emotionalityScore: 0.5
    };
    
    const words = text.toLowerCase().split(/\s+/);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim());
    
    // Creativity indicators
    const creativityWords = ['imagine', 'create', 'innovative', 'unique', 'explore', 'discover'];
    features.creativityScore = this.calculateFeatureScore(words, creativityWords, 0.5);
    
    // Structure indicators (longer sentences, formal language)
    features.structureScore = Math.min(sentences.map(s => s.split(/\s+/).length).reduce((a, b) => a + b, 0) / sentences.length / 20, 1);
    
    // Social indicators
    const socialWords = ['we', 'us', 'our', 'together', 'share', 'community', 'team'];
    features.socialScore = this.calculateFeatureScore(words, socialWords, 0.5);
    
    // Positivity indicators
    const positiveWords = ['good', 'great', 'excellent', 'happy', 'love', 'enjoy', 'appreciate'];
    features.positivityScore = this.calculateFeatureScore(words, positiveWords, 0.5);
    
    // Emotionality indicators
    const emotionalWords = ['feel', 'emotion', 'worry', 'concern', 'hope', 'fear', 'anxious'];
    features.emotionalityScore = this.calculateFeatureScore(words, emotionalWords, 0.5);
    
    return features;
  }

  /**
   * Calculate feature score based on word presence
   */
  calculateFeatureScore(words, indicators, baseScore) {
    let count = 0;
    for (const word of words) {
      if (indicators.includes(word)) {
        count++;
      }
    }
    
    const adjustment = Math.min(count / words.length * 10, 0.5);
    return Math.max(0, Math.min(1, baseScore + adjustment));
  }

  /**
   * Calculate drift score between vectors
   */
  calculateDriftScore(vector1, vector2) {
    if (vector1.length !== vector2.length) {
      return 1.0; // Maximum drift for incompatible vectors
    }
    
    // Calculate cosine similarity
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;
    
    for (let i = 0; i < vector1.length; i++) {
      dotProduct += vector1[i] * vector2[i];
      magnitude1 += vector1[i] * vector1[i];
      magnitude2 += vector2[i] * vector2[i];
    }
    
    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);
    
    if (magnitude1 === 0 || magnitude2 === 0) {
      return 1.0;
    }
    
    const similarity = dotProduct / (magnitude1 * magnitude2);
    return 1 - similarity; // Convert similarity to drift
  }

  /**
   * Identify which traits are being violated
   */
  identifyViolatedTraits(responseVector, baseVector) {
    const traits = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'];
    const traitRanges = [
      { start: 0, end: 76 },
      { start: 76, end: 152 },
      { start: 152, end: 228 },
      { start: 228, end: 304 },
      { start: 304, end: 380 }
    ];
    
    const violations = [];
    
    for (let i = 0; i < traits.length; i++) {
      const range = traitRanges[i];
      const baseScore = this.extractTraitScore(baseVector, range.start, range.end);
      const responseScore = this.extractTraitScore(responseVector, range.start, range.end);
      
      const difference = Math.abs(baseScore - responseScore);
      
      if (difference > 0.3) {
        violations.push({
          trait: traits[i],
          expectedScore: baseScore,
          actualScore: responseScore,
          difference: difference
        });
      }
    }
    
    return violations;
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

  /**
   * Generate correction prompt for drift
   */
  generateCorrectionPrompt(violatedTraits, baseVector) {
    const traits = this.vectorToTraits(baseVector);
    
    let prompt = `The response shows personality drift (${violatedTraits.length} traits violated).

Core traits being violated:`;

    for (const violation of violatedTraits) {
      const direction = violation.actualScore < violation.expectedScore ? 'lower' : 'higher';
      prompt += `
- ${violation.trait}: showing ${direction} than expected (${violation.actualScore.toFixed(2)} vs ${violation.expectedScore.toFixed(2)})`;
    }
    
    prompt += `

Please regenerate the response while maintaining these core characteristics:
${this.vectorToTraitDescription(baseVector)}

Remember to express:`;
    
    if (traits.openness > 0.7) {
      prompt += '\n- High creativity and openness to new ideas';
    } else if (traits.openness < 0.3) {
      prompt += '\n- Preference for traditional and proven approaches';
    }
    
    if (traits.conscientiousness > 0.7) {
      prompt += '\n- Attention to detail and organized thinking';
    }
    
    if (traits.extraversion > 0.7) {
      prompt += '\n- Enthusiastic and socially engaged communication';
    } else if (traits.extraversion < 0.3) {
      prompt += '\n- Reserved and thoughtful expression';
    }
    
    if (traits.agreeableness > 0.7) {
      prompt += '\n- Cooperative and trusting attitude';
    }
    
    if (traits.neuroticism < 0.3) {
      prompt += '\n- Emotional stability and confidence';
    } else if (traits.neuroticism > 0.7) {
      prompt += '\n- Sensitivity to emotional nuances';
    }
    
    return prompt;
  }

  /**
   * Convert vector to trait scores
   */
  vectorToTraits(vector) {
    return {
      openness: this.extractTraitScore(vector, 0, 76),
      conscientiousness: this.extractTraitScore(vector, 76, 152),
      extraversion: this.extractTraitScore(vector, 152, 228),
      agreeableness: this.extractTraitScore(vector, 228, 304),
      neuroticism: this.extractTraitScore(vector, 304, 380)
    };
  }

  /**
   * Convert vector to trait description
   */
  vectorToTraitDescription(vector) {
    const traits = this.vectorToTraits(vector);
    const descriptions = [];
    
    // Openness
    if (traits.openness > 0.66) {
      descriptions.push('Creative and open to new experiences');
    } else if (traits.openness < 0.33) {
      descriptions.push('Practical and conventional');
    } else {
      descriptions.push('Balanced between creativity and practicality');
    }
    
    // Conscientiousness
    if (traits.conscientiousness > 0.66) {
      descriptions.push('Highly organized and detail-oriented');
    } else if (traits.conscientiousness < 0.33) {
      descriptions.push('Flexible and spontaneous');
    } else {
      descriptions.push('Moderately organized');
    }
    
    // Extraversion
    if (traits.extraversion > 0.66) {
      descriptions.push('Outgoing and energetic');
    } else if (traits.extraversion < 0.33) {
      descriptions.push('Reserved and introspective');
    } else {
      descriptions.push('Ambiverted');
    }
    
    // Agreeableness
    if (traits.agreeableness > 0.66) {
      descriptions.push('Cooperative and trusting');
    } else if (traits.agreeableness < 0.33) {
      descriptions.push('Direct and competitive');
    } else {
      descriptions.push('Balanced in cooperation');
    }
    
    // Neuroticism
    if (traits.neuroticism > 0.66) {
      descriptions.push('Emotionally sensitive');
    } else if (traits.neuroticism < 0.33) {
      descriptions.push('Emotionally stable');
    } else {
      descriptions.push('Average emotional reactivity');
    }
    
    return descriptions.join('\n');
  }

  /**
   * Clamp value between bounds
   */
  clampValue(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Normalize vector while preserving core characteristics
   */
  normalizeWithPreservation(variedVector, baseVector) {
    const magnitude = Math.sqrt(variedVector.reduce((sum, val) => sum + val * val, 0));
    
    if (magnitude === 0) return variedVector;
    
    const normalized = new Float32Array(variedVector.length);
    
    for (let i = 0; i < variedVector.length; i++) {
      normalized[i] = variedVector[i] / magnitude;
      
      // Ensure we don't drift too far from base
      const maxDrift = this.variationRange * 2;
      const baseMagnitude = Math.sqrt(baseVector.reduce((sum, val) => sum + val * val, 0));
      const baseNormalized = baseVector[i] / (baseMagnitude || 1);
      
      if (Math.abs(normalized[i] - baseNormalized) > maxDrift) {
        const sign = normalized[i] > baseNormalized ? 1 : -1;
        normalized[i] = baseNormalized + sign * maxDrift;
      }
    }
    
    return normalized;
  }

  /**
   * Normalize vector to unit length
   */
  normalizeVector(vector) {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    
    if (magnitude === 0) return vector;
    
    const normalized = new Float32Array(vector.length);
    for (let i = 0; i < vector.length; i++) {
      normalized[i] = vector[i] / magnitude;
    }
    
    return normalized;
  }

  /**
   * Track consistency over time
   */
  trackConsistency(personaId, driftScore) {
    if (!this.consistencyHistory.has(personaId)) {
      this.consistencyHistory.set(personaId, []);
    }
    
    const history = this.consistencyHistory.get(personaId);
    history.push({
      timestamp: Date.now(),
      driftScore: driftScore
    });
    
    // Keep only last 100 entries
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * Get consistency report for persona
   */
  getConsistencyReport(personaId) {
    const history = this.consistencyHistory.get(personaId);
    
    if (!history || history.length === 0) {
      return {
        averageDrift: 0,
        maxDrift: 0,
        minDrift: 0,
        trend: 'stable',
        samples: 0
      };
    }
    
    const drifts = history.map(h => h.driftScore);
    const averageDrift = drifts.reduce((a, b) => a + b, 0) / drifts.length;
    const maxDrift = Math.max(...drifts);
    const minDrift = Math.min(...drifts);
    
    // Calculate trend
    const recentDrifts = drifts.slice(-10);
    const olderDrifts = drifts.slice(0, -10);
    
    let trend = 'stable';
    if (olderDrifts.length > 0) {
      const recentAvg = recentDrifts.reduce((a, b) => a + b, 0) / recentDrifts.length;
      const olderAvg = olderDrifts.reduce((a, b) => a + b, 0) / olderDrifts.length;
      
      if (recentAvg > olderAvg * 1.2) {
        trend = 'degrading';
      } else if (recentAvg < olderAvg * 0.8) {
        trend = 'improving';
      }
    }
    
    return {
      averageDrift: averageDrift,
      maxDrift: maxDrift,
      minDrift: minDrift,
      trend: trend,
      samples: history.length
    };
  }
}

export default PersonaConsistencyManager;