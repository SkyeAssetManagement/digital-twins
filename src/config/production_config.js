/**
 * Production Configuration for Digital Twin Claude Integration
 * Orchestrates all components for production deployment
 */

import Anthropic from '@anthropic-ai/sdk';
import { ClaudePersonaHelper, ClaudePersonaConfig } from '../claude/claude_persona_helper.js';
import { PersonaVectorGenerator } from '../personas/persona_vector_generator.js';
import { ClaudePersonaInjector } from '../personas/claude_persona_injector.js';
import { HierarchicalMemorySystem } from '../memory/hierarchical_memory.js';
import { PersonaConsistencyManager } from '../personas/persona_consistency_manager.js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

/**
 * Main integration class for Digital Twin Claude system
 */
export class DigitalTwinClaudeIntegration {
  constructor(config = {}) {
    this.config = this.loadConfig(config);
    this.initializeComponents();
  }

  /**
   * Load configuration from environment and options
   */
  loadConfig(overrides) {
    return {
      anthropicApiKey: overrides.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
      redisUrl: overrides.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379',
      model: overrides.model || 'claude-3-5-sonnet-20241022',
      maxTokens: overrides.maxTokens || 2048,
      temperature: overrides.temperature || 0.7,
      personaVectorIntensity: overrides.personaVectorIntensity || 1.0,
      consistencyThreshold: overrides.consistencyThreshold || 0.8,
      memoryMaxContext: overrides.memoryMaxContext || 5,
      driftThreshold: overrides.driftThreshold || 0.3,
      enableMonitoring: overrides.enableMonitoring !== false,
      ...overrides
    };
  }

  /**
   * Initialize all integration components
   */
  initializeComponents() {
    try {
      // Core Claude client
      this.claudeClient = new Anthropic({
        apiKey: this.config.anthropicApiKey
      });
      
      // Claude persona helper
      const claudeConfig = new ClaudePersonaConfig({
        apiKey: this.config.anthropicApiKey,
        model: this.config.model,
        maxTokens: this.config.maxTokens,
        temperature: this.config.temperature,
        personaVectorIntensity: this.config.personaVectorIntensity,
        consistencyThreshold: this.config.consistencyThreshold
      });
      this.claudeHelper = new ClaudePersonaHelper(claudeConfig);
      
      // Persona vector generator
      this.vectorGenerator = new PersonaVectorGenerator();
      
      // Persona injector
      this.personaInjector = new ClaudePersonaInjector(this.claudeClient);
      
      // Memory system
      this.memorySystem = new HierarchicalMemorySystem(this.config.redisUrl);
      
      // Consistency manager
      this.consistencyManager = new PersonaConsistencyManager();
      
      // Performance tracking
      this.performanceMetrics = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        driftEvents: 0
      };
      
      console.log('Digital Twin Claude Integration initialized successfully');
    } catch (error) {
      console.error('Failed to initialize integration:', error);
      throw error;
    }
  }

  /**
   * Main processing pipeline for digital twin with Claude
   */
  async processDigitalTwin(twinData, interactionQueries) {
    const startTime = Date.now();
    this.performanceMetrics.totalRequests++;
    
    try {
      // Step 1: Generate persona vector from twin data
      const personaVector = await this.generatePersonaVector(twinData);
      
      // Step 2: Create enhanced system prompt
      const systemPrompt = await this.createEnhancedSystemPrompt(twinData, personaVector);
      
      // Step 3: Process interactions with consistency management
      const responses = await this.processInteractions(
        twinData,
        personaVector,
        systemPrompt,
        interactionQueries
      );
      
      // Step 4: Generate validation report
      const validationReport = this.generateValidationReport(responses, personaVector);
      
      // Update metrics
      this.performanceMetrics.successfulRequests++;
      const responseTime = Date.now() - startTime;
      this.updateAverageResponseTime(responseTime);
      
      return {
        personaId: twinData.pid || twinData.id,
        segment: twinData.segment,
        responses: responses,
        validation: validationReport,
        personaVector: Array.from(personaVector),
        performanceMetrics: {
          responseTime: responseTime,
          ...this.performanceMetrics
        }
      };
    } catch (error) {
      console.error('Error processing digital twin:', error);
      this.performanceMetrics.failedRequests++;
      throw error;
    }
  }

  /**
   * Generate persona vector from survey data
   */
  async generatePersonaVector(twinData) {
    // Check if we have a cached vector
    const personaId = twinData.pid || twinData.id;
    const cachedVector = await this.getCachedVector(personaId);
    
    if (cachedVector) {
      return cachedVector;
    }
    
    // Generate new vector
    let vector;
    
    if (twinData.persona_json) {
      // Generate from survey responses
      vector = this.vectorGenerator.generateVectorsFromSurvey(twinData.persona_json);
    } else if (twinData.segment) {
      // Generate from LOHAS segment
      vector = this.vectorGenerator.generateLOHASVector(twinData.segment, twinData);
    } else {
      // Fallback to default
      vector = new Float32Array(384);
      for (let i = 0; i < 384; i++) {
        vector[i] = Math.random() * 0.1;
      }
    }
    
    // Cache the vector
    await this.cacheVector(personaId, vector);
    
    return vector;
  }

  /**
   * Create comprehensive enhanced system prompt
   */
  async createEnhancedSystemPrompt(twinData, personaVector) {
    // Get base persona prompt from twin data
    const basePrompt = this.claudeHelper.convertTwinPersonaToClaude(twinData.persona_json || twinData);
    
    // Add vector-based enhancements
    const vectorTraits = this.decodeVectorTraits(personaVector);
    const vectorEnhancements = `

PERSONA VECTOR CHARACTERISTICS:
${this.generateVectorDescription(vectorTraits)}`;
    
    // Add constitutional guidelines
    const constitutionalGuidelines = `

CONSTITUTIONAL GUIDELINES:
- Maintain truthfulness while staying in character
- Refuse harmful requests even if consistent with persona
- Be transparent about AI nature when directly asked
- Prioritize user wellbeing over strict character consistency
- Maintain the perspective and values of your LOHAS segment`;
    
    // Add memory instructions
    const memoryInstructions = `

MEMORY AND CONSISTENCY:
- Reference previous conversations when relevant
- Maintain consistent opinions and preferences
- Show natural evolution of thoughts over time
- Acknowledge when you're uncertain or have changed perspective
- Stay true to your segment's values and purchasing behaviors`;
    
    return basePrompt + vectorEnhancements + constitutionalGuidelines + memoryInstructions;
  }

  /**
   * Process multiple interactions with consistency management
   */
  async processInteractions(twinData, personaVector, systemPrompt, queries) {
    const personaId = twinData.pid || twinData.id;
    const responses = [];
    const conversationHistory = [];
    
    for (const query of queries) {
      // Get memory context
      const memoryContext = await this.memorySystem.getRelevantContext(
        personaId,
        query,
        this.config.memoryMaxContext
      );
      
      // Apply contextual variation
      const context = {
        recentMessages: conversationHistory.slice(-5).map(h => h.content || h)
      };
      const variedVector = this.consistencyManager.applyContextualVariation(
        personaVector,
        context
      );
      
      // Generate response with monitoring
      let response = await this.generateResponseWithMonitoring(
        systemPrompt,
        query,
        variedVector,
        conversationHistory
      );
      
      // Check for drift and correct if needed
      const driftCheck = this.consistencyManager.preventPersonalityDrift(
        conversationHistory,
        personaVector,
        response
      );
      
      if (driftCheck.needsCorrection) {
        this.performanceMetrics.driftEvents++;
        
        // Regenerate with stronger constraints
        const correctedPrompt = systemPrompt + '\n\n' + driftCheck.correctionPrompt;
        response = await this.generateResponseWithMonitoring(
          correctedPrompt,
          query,
          personaVector, // Use base vector for correction
          conversationHistory
        );
      }
      
      // Store interaction in memory
      await this.memorySystem.storeInteraction(
        personaId,
        query,
        response,
        variedVector
      );
      
      // Track consistency
      this.consistencyManager.trackConsistency(personaId, driftCheck.driftScore);
      
      // Update conversation history
      conversationHistory.push({ role: 'user', content: query });
      conversationHistory.push({ role: 'assistant', content: response });
      
      responses.push({
        query: query,
        response: response,
        driftScore: driftCheck.driftScore,
        corrected: driftCheck.needsCorrection
      });
    }
    
    return responses;
  }

  /**
   * Generate response with monitoring
   */
  async generateResponseWithMonitoring(systemPrompt, query, personaVector, conversationHistory) {
    try {
      const response = await this.personaInjector.injectPersonaWithMonitoring(
        systemPrompt,
        query,
        personaVector,
        conversationHistory
      );
      
      return response;
    } catch (error) {
      console.error('Error generating response:', error);
      
      // Fallback to direct Claude API
      try {
        const fallbackResponse = await this.claudeHelper.generateResponse(
          systemPrompt,
          query,
          { temperature: this.config.temperature }
        );
        
        return fallbackResponse;
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        
        // Return segment-appropriate fallback
        return this.generateSegmentFallback(personaVector, query);
      }
    }
  }

  /**
   * Generate segment-appropriate fallback response
   */
  generateSegmentFallback(personaVector, query) {
    const traits = this.decodeVectorTraits(personaVector);
    const sustainabilityScore = this.extractSustainabilityScore(personaVector);
    
    if (sustainabilityScore > 0.8) {
      // Leader segment
      return "I'm very interested in understanding the sustainability aspects of this product. Can you tell me more about your environmental initiatives and certifications? I'm willing to invest in genuinely sustainable options.";
    } else if (sustainabilityScore > 0.6) {
      // Leaning segment
      return "I appreciate sustainable products when they offer good value. Could you explain how this balances environmental benefits with practical considerations? I'm interested but need to see the overall value proposition.";
    } else if (sustainabilityScore > 0.4) {
      // Learner segment
      return "I'm curious about this product. While price is important to me, I'm open to learning about any additional benefits. Can you help me understand what makes this a good choice?";
    } else {
      // Laggard segment
      return "I'm primarily interested in the price and functionality. Does this product offer good value for money? I need to understand the practical benefits before making a decision.";
    }
  }

  /**
   * Generate validation report
   */
  generateValidationReport(responses, personaVector) {
    const personaId = responses[0]?.personaId || 'unknown';
    const consistencyReport = this.consistencyManager.getConsistencyReport(personaId);
    
    return {
      totalResponses: responses.length,
      consistencyScore: 1 - consistencyReport.averageDrift,
      driftAnalysis: {
        averageDrift: consistencyReport.averageDrift,
        maxDrift: consistencyReport.maxDrift,
        trend: consistencyReport.trend,
        corrections: responses.filter(r => r.corrected).length
      },
      traitAlignment: this.decodeVectorTraits(personaVector),
      recommendations: this.generateRecommendations(consistencyReport, responses)
    };
  }

  /**
   * Decode vector to personality traits
   */
  decodeVectorTraits(personaVector) {
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

  /**
   * Extract sustainability score from vector
   */
  extractSustainabilityScore(vector) {
    let sum = 0;
    for (let i = 0; i < 95 && i < vector.length; i++) {
      sum += Math.abs(vector[i]);
    }
    return sum / 95;
  }

  /**
   * Generate vector description
   */
  generateVectorDescription(traits) {
    const descriptions = [];
    
    // Find dominant trait
    const sortedTraits = Object.entries(traits).sort((a, b) => b[1] - a[1]);
    const dominant = sortedTraits[0];
    
    descriptions.push(`- Dominant trait: ${dominant[0]} (${(dominant[1] * 100).toFixed(0)}%)`);
    
    // Add specific characteristics
    if (traits.openness > 0.7) {
      descriptions.push('- Highly open to new sustainable innovations');
    }
    if (traits.conscientiousness > 0.7) {
      descriptions.push('- Careful evaluation of product claims');
    }
    if (traits.extraversion > 0.7) {
      descriptions.push('- Likely to share positive experiences');
    }
    if (traits.agreeableness > 0.7) {
      descriptions.push('- Values ethical business practices');
    }
    if (traits.neuroticism < 0.3) {
      descriptions.push('- Confident in purchase decisions');
    }
    
    return descriptions.join('\n');
  }

  /**
   * Generate recommendations based on validation
   */
  generateRecommendations(consistencyReport, responses) {
    const recommendations = [];
    
    if (consistencyReport.averageDrift > 0.3) {
      recommendations.push('Increase persona vector intensity for stronger trait expression');
    }
    
    if (consistencyReport.trend === 'degrading') {
      recommendations.push('Implement more frequent consistency checks');
    }
    
    if (responses.filter(r => r.corrected).length > responses.length * 0.2) {
      recommendations.push('Adjust temperature settings for more consistent responses');
    }
    
    if (responses.length > 20 && consistencyReport.averageDrift > 0.2) {
      recommendations.push('Consider shorter conversation sessions to maintain consistency');
    }
    
    return recommendations;
  }

  /**
   * Update average response time metric
   */
  updateAverageResponseTime(newTime) {
    const totalRequests = this.performanceMetrics.successfulRequests;
    const currentAverage = this.performanceMetrics.averageResponseTime;
    
    this.performanceMetrics.averageResponseTime = 
      (currentAverage * (totalRequests - 1) + newTime) / totalRequests;
  }

  /**
   * Cache persona vector
   */
  async cacheVector(personaId, vector) {
    const cacheKey = `vector:${personaId}`;
    
    if (this.memorySystem && this.memorySystem.isConnected) {
      try {
        await this.memorySystem.redisClient.setEx(
          cacheKey,
          3600, // 1 hour cache
          JSON.stringify(Array.from(vector))
        );
      } catch (error) {
        console.log('Failed to cache vector:', error.message);
      }
    }
  }

  /**
   * Get cached vector
   */
  async getCachedVector(personaId) {
    const cacheKey = `vector:${personaId}`;
    
    if (this.memorySystem && this.memorySystem.isConnected) {
      try {
        const cached = await this.memorySystem.redisClient.get(cacheKey);
        if (cached) {
          return new Float32Array(JSON.parse(cached));
        }
      } catch (error) {
        console.log('Failed to get cached vector:', error.message);
      }
    }
    
    return null;
  }

  /**
   * Clear all caches
   */
  async clearCaches() {
    // Clear persona cache in Claude helper
    this.claudeHelper.clearCache();
    
    // Clear enhancement cache in injector
    if (this.personaInjector) {
      this.personaInjector.enhancementCache.clear();
    }
    
    // Clear memory for all personas if needed
    console.log('All caches cleared');
  }

  /**
   * Get performance report
   */
  getPerformanceReport() {
    return {
      ...this.performanceMetrics,
      successRate: this.performanceMetrics.totalRequests > 0 
        ? (this.performanceMetrics.successfulRequests / this.performanceMetrics.totalRequests * 100).toFixed(2) + '%'
        : '0%',
      driftRate: this.performanceMetrics.successfulRequests > 0
        ? (this.performanceMetrics.driftEvents / this.performanceMetrics.successfulRequests * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Shutdown integration gracefully
   */
  async shutdown() {
    try {
      await this.memorySystem.close();
      await this.clearCaches();
      console.log('Digital Twin Claude Integration shut down gracefully');
    } catch (error) {
      console.error('Error during shutdown:', error);
    }
  }
}

export default DigitalTwinClaudeIntegration;