/**
 * Response Service
 * Handles digital twin response generation business logic
 */

import { BaseService } from './base.service.js';
import { createUnifiedVectorStore } from '../vector_db/unified_vector_store.js';
import { IntegratedPersonaEngine } from '../claude/integrated_persona_engine.js';
import { ValidationError, NotFoundError, ExternalServiceError } from '../utils/error-handler.js';
import { DynamicTwinGenerator } from '../digital_twins/twin_generator.js';

export class ResponseService extends BaseService {
  constructor() {
    super('ResponseService');
    this.personaEngines = new Map();
  }

  /**
   * Generate response from digital twin
   */
  async generateResponse(params) {
    this.validateRequired(params, ['datasetId', 'segment', 'marketingContent']);
    
    const startTime = Date.now();
    const { datasetId, segment, marketingContent, variant = 0, options = {} } = params;
    
    // Sanitize inputs
    const sanitizedContent = this.sanitizeInput(marketingContent);
    
    try {
      // Get or create persona engine for this dataset
      const engine = await this.getPersonaEngine(datasetId);
      
      // Generate response based on mode
      let response;
      
      if (options.mode === 'claude') {
        response = await this.generateClaudeResponse(
          engine, 
          segment, 
          sanitizedContent, 
          variant,
          options
        );
      } else if (options.mode === 'semantic') {
        response = await this.generateSemanticResponse(
          engine,
          segment,
          sanitizedContent,
          variant,
          options
        );
      } else {
        // Default to hybrid approach
        response = await this.generateHybridResponse(
          engine,
          segment,
          sanitizedContent,
          variant,
          options
        );
      }
      
      this.logMetrics('generateResponse', startTime, true, {
        datasetId,
        segment,
        mode: options.mode || 'hybrid',
        variant
      });
      
      return this.formatResponse(response, {
        datasetId,
        segment,
        variant,
        mode: options.mode || 'hybrid',
        processingTime: Date.now() - startTime
      });
      
    } catch (error) {
      this.logMetrics('generateResponse', startTime, false);
      this.logger.error('Response generation failed', error);
      throw error;
    }
  }

  /**
   * Generate multiple responses for comparison
   */
  async generateMultipleResponses(params) {
    this.validateRequired(params, ['datasetId', 'segment', 'marketingContent']);
    
    const startTime = Date.now();
    const { datasetId, segment, marketingContent, count = 3, modes = ['semantic', 'claude'] } = params;
    
    try {
      const responses = [];
      
      for (const mode of modes) {
        for (let variant = 0; variant < count; variant++) {
          const response = await this.generateResponse({
            datasetId,
            segment,
            marketingContent,
            variant,
            options: { mode }
          });
          
          responses.push({
            ...response.data,
            metadata: {
              mode,
              variant,
              ...response.metadata
            }
          });
        }
      }
      
      this.logMetrics('generateMultipleResponses', startTime, true, {
        datasetId,
        segment,
        count: responses.length
      });
      
      return this.formatResponse(responses, {
        datasetId,
        segment,
        totalResponses: responses.length,
        modes,
        processingTime: Date.now() - startTime
      });
      
    } catch (error) {
      this.logMetrics('generateMultipleResponses', startTime, false);
      throw error;
    }
  }

  /**
   * Generate Claude-based response
   */
  async generateClaudeResponse(engine, segment, content, variant, options) {
    try {
      const response = await engine.generateResponse(
        content,
        segment,
        variant,
        options
      );
      
      return {
        response: response.response,
        reasoning: response.reasoning,
        confidence: response.confidence || 0.85,
        themes: response.themes || {},
        model: 'claude',
        variant
      };
    } catch (error) {
      throw new ExternalServiceError('Claude', error.message, error);
    }
  }

  /**
   * Generate semantic similarity-based response
   */
  async generateSemanticResponse(engine, segment, content, variant, options) {
    try {
      // Find similar responses from survey data
      const similarResponses = await engine.vectorStore.findSimilarSurveyResponses(
        content,
        segment,
        5
      );
      
      if (!similarResponses || similarResponses.length === 0) {
        throw new NotFoundError('Similar responses', segment);
      }
      
      // Generate response based on similar responses
      const response = await engine.synthesizeResponseFromSimilar(
        similarResponses,
        content,
        segment,
        variant
      );
      
      return {
        response: response.text,
        confidence: response.confidence || 0.75,
        themes: response.themes || {},
        model: 'semantic',
        variant,
        sources: similarResponses.length
      };
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new ExternalServiceError('Semantic Engine', error.message, error);
    }
  }

  /**
   * Generate hybrid response combining Claude and semantic approaches
   */
  async generateHybridResponse(engine, segment, content, variant, options) {
    try {
      // Get both responses in parallel
      const [claudeResponse, semanticResponse] = await Promise.allSettled([
        this.generateClaudeResponse(engine, segment, content, variant, options),
        this.generateSemanticResponse(engine, segment, content, variant, options)
      ]);
      
      // If both succeeded, blend them
      if (claudeResponse.status === 'fulfilled' && semanticResponse.status === 'fulfilled') {
        return this.blendResponses(
          claudeResponse.value,
          semanticResponse.value,
          options.blendWeight || 0.6 // Default 60% Claude, 40% semantic
        );
      }
      
      // Fallback to whichever succeeded
      if (claudeResponse.status === 'fulfilled') {
        return claudeResponse.value;
      }
      
      if (semanticResponse.status === 'fulfilled') {
        return semanticResponse.value;
      }
      
      // Both failed
      throw new Error('Both response generation methods failed');
      
    } catch (error) {
      throw new ExternalServiceError('Hybrid Engine', error.message, error);
    }
  }

  /**
   * Blend two responses
   */
  blendResponses(primary, secondary, weight = 0.6) {
    // For now, use the primary response with enriched metadata
    // Future enhancement: actual text blending
    return {
      response: primary.response,
      reasoning: primary.reasoning,
      confidence: (primary.confidence * weight + secondary.confidence * (1 - weight)),
      themes: { ...secondary.themes, ...primary.themes },
      model: 'hybrid',
      variant: primary.variant,
      sources: {
        claude: weight,
        semantic: 1 - weight
      }
    };
  }

  /**
   * Get or create persona engine for dataset
   */
  async getPersonaEngine(datasetId) {
    // Check cache
    if (this.personaEngines.has(datasetId)) {
      return this.personaEngines.get(datasetId);
    }
    
    // Create new engine
    const engine = new IntegratedPersonaEngine(datasetId);
    await engine.initialize();
    
    // Cache it
    this.personaEngines.set(datasetId, engine);
    
    // Limit cache size
    if (this.personaEngines.size > 10) {
      const firstKey = this.personaEngines.keys().next().value;
      const oldEngine = this.personaEngines.get(firstKey);
      await oldEngine.close();
      this.personaEngines.delete(firstKey);
    }
    
    return engine;
  }

  /**
   * Get digital twin details
   */
  async getTwin(datasetId, segment, variant = 0) {
    this.validateRequired({ datasetId, segment }, ['datasetId', 'segment']);
    
    const startTime = Date.now();
    
    try {
      // Initialize vector store
      const vectorStore = await createUnifiedVectorStore(datasetId, {
        embeddingProvider: 'openai'
      });
      
      // Get dataset config
      const datasetService = await import('./dataset.service.js');
      const config = await datasetService.default.getConfig(datasetId);
      
      // Generate twin
      const twinGenerator = new DynamicTwinGenerator(vectorStore, config);
      const twin = await twinGenerator.generateTwin(segment, variant);
      
      await vectorStore.close();
      
      this.logMetrics('getTwin', startTime, true, {
        datasetId,
        segment,
        variant
      });
      
      return this.formatResponse(twin, {
        datasetId,
        segment,
        variant,
        processingTime: Date.now() - startTime
      });
      
    } catch (error) {
      this.logMetrics('getTwin', startTime, false);
      throw error;
    }
  }

  /**
   * Analyze marketing content
   */
  async analyzeContent(content, options = {}) {
    this.validateRequired({ content }, ['content']);
    
    const startTime = Date.now();
    
    try {
      // Extract themes and characteristics
      const analysis = {
        themes: this.extractThemes(content),
        sentiment: this.analyzeSentiment(content),
        targetSegments: this.identifyTargetSegments(content),
        keyMessages: this.extractKeyMessages(content)
      };
      
      // If image data provided, analyze it
      if (options.imageData) {
        const imageAnalysis = await this.analyzeImage(options.imageData);
        analysis.visual = imageAnalysis;
      }
      
      this.logMetrics('analyzeContent', startTime, true);
      
      return this.formatResponse(analysis, {
        contentLength: content.length,
        hasImage: !!options.imageData,
        processingTime: Date.now() - startTime
      });
      
    } catch (error) {
      this.logMetrics('analyzeContent', startTime, false);
      throw error;
    }
  }

  /**
   * Extract themes from content
   */
  extractThemes(content) {
    const themes = {
      sustainability: 0,
      performance: 0,
      lifestyle: 0,
      price: 0,
      quality: 0,
      innovation: 0,
      brand: 0
    };

    const contentLower = content.toLowerCase();
    
    // Score themes based on keyword presence
    if (/sustain|eco|recycl|environment|green|carbon|renewable/i.test(content)) {
      themes.sustainability = 0.8;
    }
    if (/performance|technical|advanced|pro|professional|speed|power/i.test(content)) {
      themes.performance = 0.7;
    }
    if (/lifestyle|adventure|fun|social|community|experience/i.test(content)) {
      themes.lifestyle = 0.6;
    }
    if (/price|\$|affordable|value|cost|budget|save|discount/i.test(content)) {
      themes.price = 0.5;
    }
    if (/quality|premium|durable|craftsmanship|reliable|lasting/i.test(content)) {
      themes.quality = 0.6;
    }
    if (/innovat|new|technology|cutting-edge|revolutionary|latest/i.test(content)) {
      themes.innovation = 0.5;
    }
    if (/brand|heritage|trust|authentic|established|tradition/i.test(content)) {
      themes.brand = 0.4;
    }

    // Normalize scores
    const total = Object.values(themes).reduce((a, b) => a + b, 0);
    if (total > 0) {
      Object.keys(themes).forEach(key => {
        themes[key] = parseFloat((themes[key] / total).toFixed(3));
      });
    }

    return themes;
  }

  /**
   * Analyze sentiment
   */
  analyzeSentiment(content) {
    // Simple sentiment analysis
    const positive = /amazing|excellent|great|wonderful|fantastic|love|perfect|best/gi;
    const negative = /bad|poor|terrible|worst|hate|awful|disappointing/gi;
    
    const positiveMatches = (content.match(positive) || []).length;
    const negativeMatches = (content.match(negative) || []).length;
    
    const total = positiveMatches + negativeMatches;
    if (total === 0) return { score: 0.5, label: 'neutral' };
    
    const score = positiveMatches / total;
    
    return {
      score: parseFloat(score.toFixed(2)),
      label: score > 0.6 ? 'positive' : score < 0.4 ? 'negative' : 'neutral',
      confidence: parseFloat((Math.abs(score - 0.5) * 2).toFixed(2))
    };
  }

  /**
   * Identify target segments
   */
  identifyTargetSegments(content) {
    const segments = [];
    
    if (/sustain|eco|environment|conscious/i.test(content)) {
      segments.push('Leader');
    }
    if (/value|affordable|budget|practical/i.test(content)) {
      segments.push('Laggard');
    }
    if (/lifestyle|experience|adventure/i.test(content)) {
      segments.push('Leaning');
    }
    if (/learn|discover|explore|new/i.test(content)) {
      segments.push('Learner');
    }
    
    return segments.length > 0 ? segments : ['General'];
  }

  /**
   * Extract key messages
   */
  extractKeyMessages(content) {
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [];
    
    // Filter for sentences with key indicators
    const keyMessages = sentences
      .filter(s => {
        const lower = s.toLowerCase();
        return /product|feature|benefit|offer|new|exclusive|limited/i.test(s) ||
               /sustain|eco|performance|quality|value/i.test(s);
      })
      .slice(0, 3)
      .map(s => s.trim());
    
    return keyMessages;
  }

  /**
   * Analyze image (stub for now - would integrate with Claude Vision)
   */
  async analyzeImage(imageData) {
    // This would call Claude Vision API
    // For now, return placeholder
    return {
      detected: false,
      message: 'Image analysis not yet implemented in service layer'
    };
  }

  /**
   * Close all engines
   */
  async closeAll() {
    for (const [id, engine] of this.personaEngines) {
      try {
        await engine.close();
      } catch (error) {
        this.logger.warn(`Failed to close engine for ${id}`, error);
      }
    }
    this.personaEngines.clear();
    this.clearCache();
  }
}

// Export singleton instance
export const responseService = new ResponseService();
export default responseService;