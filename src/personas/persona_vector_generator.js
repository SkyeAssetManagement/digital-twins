/**
 * Persona Vector Generator Module
 * Converts survey responses and LOHAS segments into high-dimensional persona vectors
 * for precise personality control in digital twin responses
 */

/**
 * Main class for generating persona vectors from survey data
 */
export class PersonaVectorGenerator {
  constructor() {
    this.vectorDimension = 384; // Standard embedding dimension
    this.traitMappings = this.loadTraitMappings();
    this.scaler = new StandardScaler();
  }

  /**
   * Generate persona vectors from survey responses
   * @param {Object} surveyResponses - Survey data from LOHAS classification
   * @returns {Float32Array} 384-dimensional persona vector
   */
  generateVectorsFromSurvey(surveyResponses) {
    // Map survey questions to Big Five dimensions
    const traitScores = this.extractTraitScores(surveyResponses);
    
    // Create base persona vector
    const personaVector = new Float32Array(this.vectorDimension);
    
    // Assign trait embeddings to vector dimensions
    this.assignTraitEmbeddings(personaVector, traitScores);
    
    // Add demographic and behavioral modifiers
    const demographicVector = this.encodeDemographics(surveyResponses);
    const behavioralVector = this.encodeBehavioralPatterns(surveyResponses);
    
    // Combine all vectors
    const combinedVector = this.combineVectors(personaVector, demographicVector, behavioralVector);
    
    // Normalize the final vector
    return this.normalizeVector(combinedVector);
  }

  /**
   * Generate vectors specifically for LOHAS segments
   * @param {string} segment - LOHAS segment (Leader/Leaning/Learner/Laggard)
   * @param {Object} segmentData - Segment-specific data from classification
   * @returns {Float32Array} Persona vector
   */
  generateLOHASVector(segment, segmentData) {
    const vector = new Float32Array(this.vectorDimension);
    
    // Base patterns for each LOHAS segment
    const segmentPatterns = {
      'Leader': {
        sustainabilityWeight: 0.95,
        priceWeight: 0.30,
        innovationWeight: 0.85,
        socialInfluenceWeight: 0.80,
        qualityWeight: 0.90
      },
      'Leaning': {
        sustainabilityWeight: 0.75,
        priceWeight: 0.50,
        innovationWeight: 0.65,
        socialInfluenceWeight: 0.60,
        qualityWeight: 0.80
      },
      'Learner': {
        sustainabilityWeight: 0.45,
        priceWeight: 0.75,
        innovationWeight: 0.50,
        socialInfluenceWeight: 0.50,
        qualityWeight: 0.70
      },
      'Laggard': {
        sustainabilityWeight: 0.20,
        priceWeight: 0.90,
        innovationWeight: 0.30,
        socialInfluenceWeight: 0.40,
        qualityWeight: 0.60
      }
    };

    const pattern = segmentPatterns[segment] || segmentPatterns['Learner'];
    
    // Apply segment patterns to vector dimensions
    this.applySegmentPattern(vector, pattern, segmentData);
    
    return this.normalizeVector(vector);
  }

  /**
   * Load question-to-trait mappings
   */
  loadTraitMappings() {
    // Mapping of survey questions to personality traits
    return {
      // Openness indicators
      openness: [
        'Q1_01', // Try new products first
        'Q1_03', // Research before buying
        'Q2_10', // Interest in innovation
        'Q3_01'  // Environmental awareness
      ],
      // Conscientiousness indicators
      conscientiousness: [
        'Q1_02', // Plan purchases carefully
        'Q2_08', // Quality over price
        'Q3_02', // Long-term thinking
        'Q3_07'  // Responsible consumption
      ],
      // Extraversion indicators
      extraversion: [
        'Q1_04', // Share recommendations
        'Q2_05', // Social shopping
        'Q2_11', // Brand advocacy
        'Q3_09'  // Community involvement
      ],
      // Agreeableness indicators
      agreeableness: [
        'Q2_03', // Consider others' opinions
        'Q3_05', // Support ethical brands
        'Q3_08', // Fair trade importance
        'Q3_11'  // Social responsibility
      ],
      // Neuroticism indicators (reversed)
      neuroticism: [
        'Q1_06', // Impulse purchases
        'Q2_07', // Decision anxiety
        'Q2_09', // Brand switching
        'Q3_10'  // Price sensitivity
      ]
    };
  }

  /**
   * Extract trait scores from survey responses
   */
  extractTraitScores(surveyResponses) {
    const traitScores = {};
    
    for (const [trait, questions] of Object.entries(this.traitMappings)) {
      const scores = [];
      
      for (const questionId of questions) {
        const response = this.getQuestionResponse(surveyResponses, questionId);
        if (response !== null) {
          scores.push(this.normalizeResponse(response));
        }
      }
      
      if (scores.length > 0) {
        traitScores[trait] = scores.reduce((a, b) => a + b, 0) / scores.length;
      } else {
        traitScores[trait] = 0.5; // Default to neutral
      }
    }
    
    return traitScores;
  }

  /**
   * Get response value for a specific question
   */
  getQuestionResponse(surveyResponses, questionId) {
    // Handle different survey data formats
    if (surveyResponses[questionId] !== undefined) {
      return surveyResponses[questionId];
    }
    
    // Check nested structures
    if (surveyResponses.questions && surveyResponses.questions[questionId]) {
      return surveyResponses.questions[questionId];
    }
    
    // Check for transformed question names
    const transformedId = questionId.replace('_', '');
    if (surveyResponses[transformedId] !== undefined) {
      return surveyResponses[transformedId];
    }
    
    return null;
  }

  /**
   * Normalize response value to 0-1 range
   */
  normalizeResponse(response) {
    // Handle different response scales
    if (typeof response === 'number') {
      // Assuming 1-5 Likert scale
      return (response - 1) / 4;
    }
    
    // Handle categorical responses
    const responseMap = {
      'Strongly Disagree': 0,
      'Disagree': 0.25,
      'Neutral': 0.5,
      'Agree': 0.75,
      'Strongly Agree': 1
    };
    
    return responseMap[response] || 0.5;
  }

  /**
   * Calculate trait-specific embedding
   */
  calculateTraitEmbedding(trait, score) {
    const embeddingSize = 76; // Size per trait in 384D vector
    const embedding = new Float32Array(embeddingSize);
    
    // Create trait-specific patterns
    switch (trait) {
      case 'openness':
        // High openness = receptive to new sustainable products
        for (let i = 0; i < 20; i++) {
          embedding[i] = score * 0.8 + Math.random() * 0.1;
        }
        for (let i = 20; i < 40; i++) {
          embedding[i] = score * 0.6;
        }
        break;
        
      case 'conscientiousness':
        // High conscientiousness = careful evaluation, quality focus
        for (let i = 10; i < 30; i++) {
          embedding[i] = score * 0.7;
        }
        for (let i = 40; i < 60; i++) {
          embedding[i] = score * 0.5;
        }
        break;
        
      case 'extraversion':
        // High extraversion = social influence, brand advocacy
        for (let i = 0; i < 20; i++) {
          embedding[i] = score * 0.75;
        }
        for (let i = 30; i < 50; i++) {
          embedding[i] = (1 - score) * -0.3;
        }
        break;
        
      case 'agreeableness':
        // High agreeableness = ethical considerations
        for (let i = 15; i < 35; i++) {
          embedding[i] = score * 0.65;
        }
        break;
        
      case 'neuroticism':
        // Low neuroticism = confident decisions
        for (let i = 25; i < 45; i++) {
          embedding[i] = (1 - score) * 0.6;
        }
        break;
    }
    
    return embedding;
  }

  /**
   * Assign trait embeddings to persona vector
   */
  assignTraitEmbeddings(personaVector, traitScores) {
    const traits = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'];
    
    for (let i = 0; i < traits.length; i++) {
      const trait = traits[i];
      const score = traitScores[trait] || 0.5;
      const embedding = this.calculateTraitEmbedding(trait, score);
      
      // Assign to appropriate vector dimensions
      const startIdx = i * 76;
      const endIdx = Math.min(startIdx + 76, this.vectorDimension);
      
      for (let j = 0; j < embedding.length && startIdx + j < endIdx; j++) {
        personaVector[startIdx + j] = embedding[j];
      }
    }
  }

  /**
   * Encode demographic information into vector
   */
  encodeDemographics(surveyResponses) {
    const demographicVector = new Float32Array(100);
    
    // Extract demographic features
    const age = surveyResponses.age || surveyResponses.Age || 35;
    const income = surveyResponses.income || surveyResponses.Income || 50000;
    const education = surveyResponses.education || surveyResponses.Education || 3;
    
    // Encode age (normalize to 0-1)
    demographicVector[0] = Math.min(age / 80, 1);
    
    // Encode income (log scale normalization)
    demographicVector[1] = Math.min(Math.log(income) / Math.log(500000), 1);
    
    // Encode education level
    demographicVector[2] = education / 5;
    
    // Add LOHAS-specific demographics
    if (surveyResponses.segment) {
      const segmentEncoding = {
        'Leader': [0.9, 0.9, 0.8],
        'Leaning': [0.7, 0.7, 0.6],
        'Learner': [0.5, 0.5, 0.5],
        'Laggard': [0.3, 0.3, 0.4]
      };
      
      const encoding = segmentEncoding[surveyResponses.segment] || [0.5, 0.5, 0.5];
      demographicVector[3] = encoding[0];
      demographicVector[4] = encoding[1];
      demographicVector[5] = encoding[2];
    }
    
    return demographicVector;
  }

  /**
   * Encode behavioral patterns
   */
  encodeBehavioralPatterns(surveyResponses) {
    const behavioralVector = new Float32Array(100);
    
    // Purchase frequency
    const frequency = surveyResponses.purchaseFrequency || 3;
    behavioralVector[0] = frequency / 5;
    
    // Average spend
    const avgSpend = surveyResponses.averageSpend || 100;
    behavioralVector[1] = Math.min(avgSpend / 1000, 1);
    
    // Sustainability importance
    const sustainability = surveyResponses.sustainabilityImportance || 3;
    behavioralVector[2] = sustainability / 5;
    
    // Price sensitivity
    const priceSensitivity = surveyResponses.priceSensitivity || 3;
    behavioralVector[3] = priceSensitivity / 5;
    
    // Brand loyalty
    const brandLoyalty = surveyResponses.brandLoyalty || 3;
    behavioralVector[4] = brandLoyalty / 5;
    
    return behavioralVector;
  }

  /**
   * Apply LOHAS segment pattern to vector
   */
  applySegmentPattern(vector, pattern, segmentData) {
    // Sustainability dimensions (0-95)
    const sustainabilityStart = 0;
    const sustainabilityEnd = 95;
    for (let i = sustainabilityStart; i < sustainabilityEnd; i++) {
      vector[i] = pattern.sustainabilityWeight * (0.5 + Math.random() * 0.5);
    }
    
    // Price sensitivity dimensions (96-191)
    const priceStart = 96;
    const priceEnd = 191;
    for (let i = priceStart; i < priceEnd; i++) {
      vector[i] = pattern.priceWeight * (0.5 + Math.random() * 0.5);
    }
    
    // Innovation dimensions (192-287)
    const innovationStart = 192;
    const innovationEnd = 287;
    for (let i = innovationStart; i < innovationEnd; i++) {
      vector[i] = pattern.innovationWeight * (0.5 + Math.random() * 0.5);
    }
    
    // Social influence dimensions (288-383)
    const socialStart = 288;
    const socialEnd = 384;
    for (let i = socialStart; i < socialEnd; i++) {
      vector[i] = pattern.socialInfluenceWeight * (0.5 + Math.random() * 0.5);
    }
    
    // Apply segment-specific data if available
    if (segmentData) {
      this.applySegmentSpecificData(vector, segmentData);
    }
  }

  /**
   * Apply segment-specific survey data to vector
   */
  applySegmentSpecificData(vector, segmentData) {
    if (segmentData.averageScores) {
      // Adjust vector based on actual survey averages
      const scores = segmentData.averageScores;
      
      if (scores.sustainability) {
        const weight = scores.sustainability / 5;
        for (let i = 0; i < 95; i++) {
          vector[i] *= weight;
        }
      }
      
      if (scores.price) {
        const weight = scores.price / 5;
        for (let i = 96; i < 191; i++) {
          vector[i] *= weight;
        }
      }
    }
  }

  /**
   * Combine multiple vectors
   */
  combineVectors(...vectors) {
    const totalLength = vectors.reduce((sum, v) => sum + v.length, 0);
    const combined = new Float32Array(Math.min(totalLength, this.vectorDimension));
    
    let offset = 0;
    for (const vector of vectors) {
      for (let i = 0; i < vector.length && offset + i < combined.length; i++) {
        combined[offset + i] = vector[i];
      }
      offset += vector.length;
    }
    
    // If combined is shorter than target dimension, pad with small random values
    if (combined.length < this.vectorDimension) {
      const padded = new Float32Array(this.vectorDimension);
      padded.set(combined);
      for (let i = combined.length; i < this.vectorDimension; i++) {
        padded[i] = Math.random() * 0.1;
      }
      return padded;
    }
    
    return combined;
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
   * Calculate similarity between two vectors
   */
  calculateSimilarity(vector1, vector2) {
    if (vector1.length !== vector2.length) {
      throw new Error('Vectors must have same dimension');
    }
    
    let dotProduct = 0;
    for (let i = 0; i < vector1.length; i++) {
      dotProduct += vector1[i] * vector2[i];
    }
    
    return dotProduct; // Assuming normalized vectors
  }

  /**
   * Export vector to JSON format
   */
  exportVector(vector, metadata = {}) {
    return {
      dimension: vector.length,
      values: Array.from(vector),
      metadata: {
        ...metadata,
        generatedAt: new Date().toISOString(),
        version: '1.0.0'
      }
    };
  }

  /**
   * Import vector from JSON format
   */
  importVector(jsonData) {
    if (!jsonData.values || !Array.isArray(jsonData.values)) {
      throw new Error('Invalid vector format');
    }
    
    return new Float32Array(jsonData.values);
  }
}

// Utility class for feature scaling
class StandardScaler {
  constructor() {
    this.mean = null;
    this.std = null;
  }

  fit(data) {
    // Calculate mean
    this.mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    
    // Calculate standard deviation
    const variance = data.reduce((sum, val) => sum + Math.pow(val - this.mean, 2), 0) / data.length;
    this.std = Math.sqrt(variance);
  }

  transform(value) {
    if (this.mean === null || this.std === null) {
      return value;
    }
    
    if (this.std === 0) return 0;
    
    return (value - this.mean) / this.std;
  }
}

export default PersonaVectorGenerator;