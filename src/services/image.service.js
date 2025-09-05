/**
 * Image Analysis Service
 * Handles image analysis using Claude Vision API
 */

import Anthropic from '@anthropic-ai/sdk';
import { BaseService } from './base.service.js';
import { ValidationError, ExternalServiceError } from '../utils/error-handler.js';
import { appConfig } from '../config/app-config.js';

export class ImageService extends BaseService {
  constructor() {
    super('ImageService');
    
    // Initialize Anthropic client
    this.anthropic = new Anthropic({
      apiKey: appConfig.anthropic.apiKey
    });
  }

  /**
   * Analyze marketing image
   */
  async analyzeImage(imageData, options = {}) {
    this.validateRequired({ imageData }, ['imageData']);
    
    const startTime = Date.now();
    
    try {
      // Extract base64 data from data URL if needed
      const base64Data = this.extractBase64(imageData);
      
      // Determine media type
      const mediaType = this.detectMediaType(imageData);
      
      // Analyze with Claude Vision
      const analysis = await this.analyzeWithClaude(base64Data, mediaType, options);
      
      // Extract structured data
      const structured = this.extractStructuredData(analysis);
      
      // Cache the analysis
      const cacheKey = `image:${this.hashImage(base64Data)}`;
      this.setCached(cacheKey, structured);
      
      this.logMetrics('analyzeImage', startTime, true, {
        mediaType,
        cacheKey
      });
      
      return this.formatResponse(structured, {
        mediaType,
        processingTime: Date.now() - startTime
      });
      
    } catch (error) {
      this.logMetrics('analyzeImage', startTime, false);
      throw error;
    }
  }

  /**
   * Extract base64 data from data URL
   */
  extractBase64(imageData) {
    if (imageData.startsWith('data:image')) {
      const parts = imageData.split(',');
      if (parts.length !== 2) {
        throw new ValidationError('Invalid image data format');
      }
      return parts[1];
    }
    return imageData;
  }

  /**
   * Detect media type from data URL or default
   */
  detectMediaType(imageData) {
    if (imageData.startsWith('data:image')) {
      const match = imageData.match(/data:image\/(.*?);/);
      if (match) {
        return `image/${match[1]}`;
      }
    }
    return 'image/jpeg'; // Default
  }

  /**
   * Analyze image with Claude Vision
   */
  async analyzeWithClaude(base64Data, mediaType, options = {}) {
    const prompt = options.prompt || this.getDefaultPrompt();
    
    try {
      const response = await this.executeWithRetry(async () => {
        return await this.anthropic.messages.create({
          model: 'claude-opus-4-1-20250805',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Data
                }
              },
              {
                type: 'text',
                text: prompt
              }
            ]
          }]
        });
      });

      if (!response.content || response.content.length === 0) {
        throw new Error('Empty response from Claude');
      }

      return response.content[0].text;
      
    } catch (error) {
      throw new ExternalServiceError('Claude Vision', error.message, error);
    }
  }

  /**
   * Get default analysis prompt
   */
  getDefaultPrompt() {
    return `Analyze this marketing image and provide a detailed summary of:
1. Product/Service being advertised (be specific - brand, model, features)
2. Key marketing messages and claims
3. Environmental/sustainability messaging (if any)
4. Price points or value propositions mentioned
5. Target audience indicators
6. Emotional appeal (lifestyle, performance, environmental, etc.)
7. Visual elements and design style
8. Call to action (if present)

Format your response as a concise marketing brief that captures all the essential information a consumer would extract from this ad. Be specific about product names, features, and any claims made.`;
  }

  /**
   * Extract structured data from analysis text
   */
  extractStructuredData(analysisText) {
    return {
      analysis: analysisText,
      themes: this.extractThemes(analysisText),
      marketingSummary: this.createMarketingSummary(analysisText),
      targetSegments: this.identifyTargetSegments(analysisText),
      sentiment: this.analyzeSentiment(analysisText),
      keyFeatures: this.extractKeyFeatures(analysisText),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Extract themes from analysis
   */
  extractThemes(analysis) {
    const themes = {
      sustainability: 0,
      performance: 0,
      lifestyle: 0,
      price: 0,
      quality: 0,
      innovation: 0,
      brand: 0,
      luxury: 0
    };

    const analysisLower = analysis.toLowerCase();
    
    // Score themes based on content
    if (/sustain|eco|recycl|environment|green|carbon|renewable|organic/i.test(analysis)) {
      themes.sustainability = 0.8;
    }
    if (/performance|technical|advanced|pro|professional|speed|power|efficient/i.test(analysis)) {
      themes.performance = 0.7;
    }
    if (/lifestyle|adventure|fun|social|community|experience|outdoor/i.test(analysis)) {
      themes.lifestyle = 0.6;
    }
    if (/price|\$|affordable|value|cost|budget|save|discount|deal/i.test(analysis)) {
      themes.price = 0.5;
    }
    if (/quality|premium|durable|craftsmanship|reliable|lasting|superior/i.test(analysis)) {
      themes.quality = 0.6;
    }
    if (/innovat|new|technology|cutting-edge|revolutionary|latest|advanced/i.test(analysis)) {
      themes.innovation = 0.5;
    }
    if (/brand|heritage|trust|authentic|established|tradition|legacy/i.test(analysis)) {
      themes.brand = 0.4;
    }
    if (/luxury|exclusive|prestige|elite|sophisticated|refined/i.test(analysis)) {
      themes.luxury = 0.4;
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
   * Create marketing summary
   */
  createMarketingSummary(analysis) {
    const lines = analysis.split('\n').filter(line => line.trim());
    
    // Look for key information
    const productLine = lines.find(line => /product|brand|model|service/i.test(line)) || lines[0];
    const featuresLine = lines.find(line => /feature|technology|material|specification/i.test(line)) || '';
    const sustainabilityLine = lines.find(line => /sustain|eco|recycl|environment/i.test(line)) || '';
    const priceLine = lines.find(line => /price|\$|cost|value/i.test(line)) || '';
    
    // Combine into a concise summary
    let summary = productLine;
    
    if (featuresLine && !productLine.includes(featuresLine)) {
      summary += ' ' + featuresLine;
    }
    if (sustainabilityLine && !summary.includes(sustainabilityLine)) {
      summary += ' ' + sustainabilityLine;
    }
    if (priceLine && !summary.includes(priceLine)) {
      summary += ' ' + priceLine;
    }
    
    // Ensure reasonable length
    if (summary.length > 500) {
      summary = summary.substring(0, 497) + '...';
    }
    
    return summary.trim();
  }

  /**
   * Identify target segments
   */
  identifyTargetSegments(analysis) {
    const segments = [];
    
    if (/sustain|eco|environment|conscious|responsible/i.test(analysis)) {
      segments.push('Leader');
    }
    if (/lifestyle|experience|adventure|social/i.test(analysis)) {
      segments.push('Leaning');
    }
    if (/learn|discover|explore|curious|new/i.test(analysis)) {
      segments.push('Learner');
    }
    if (/value|affordable|budget|practical|basic/i.test(analysis)) {
      segments.push('Laggard');
    }
    
    // If no clear segments, determine based on overall tone
    if (segments.length === 0) {
      const themes = this.extractThemes(analysis);
      if (themes.sustainability > 0.2) segments.push('Leader');
      if (themes.lifestyle > 0.2) segments.push('Leaning');
      if (themes.innovation > 0.2) segments.push('Learner');
      if (themes.price > 0.2) segments.push('Laggard');
    }
    
    return segments.length > 0 ? segments : ['General'];
  }

  /**
   * Analyze sentiment
   */
  analyzeSentiment(text) {
    const positive = /amazing|excellent|great|wonderful|fantastic|love|perfect|best|superior|outstanding/gi;
    const negative = /bad|poor|terrible|worst|hate|awful|disappointing|inferior|cheap/gi;
    
    const positiveMatches = (text.match(positive) || []).length;
    const negativeMatches = (text.match(negative) || []).length;
    
    const total = positiveMatches + negativeMatches || 1;
    const score = positiveMatches / total;
    
    return {
      score: parseFloat(score.toFixed(2)),
      label: score > 0.6 ? 'positive' : score < 0.4 ? 'negative' : 'neutral',
      confidence: parseFloat((Math.abs(score - 0.5) * 2).toFixed(2))
    };
  }

  /**
   * Extract key features
   */
  extractKeyFeatures(analysis) {
    const features = [];
    
    // Look for feature indicators
    const featurePatterns = [
      /features?:?\s*([^.!?\n]+)/gi,
      /includes?:?\s*([^.!?\n]+)/gi,
      /offers?:?\s*([^.!?\n]+)/gi,
      /with\s+([^.!?\n]+)/gi
    ];
    
    for (const pattern of featurePatterns) {
      const matches = analysis.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          features.push(match[1].trim());
        }
      }
    }
    
    // Limit and clean features
    return features
      .slice(0, 5)
      .map(f => f.replace(/^\W+|\W+$/g, '').trim())
      .filter(f => f.length > 5 && f.length < 100);
  }

  /**
   * Hash image data for caching
   */
  hashImage(base64Data) {
    // Simple hash for caching - in production use crypto
    let hash = 0;
    const str = base64Data.substring(0, 1000); // Use first 1000 chars
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }
}

// Export singleton instance
export const imageService = new ImageService();
export default imageService;