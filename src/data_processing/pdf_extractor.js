import { createLogger } from '../utils/logger.js';
import { readPDFContent } from '../utils/file-operations.js';
import { LOHAS_SEGMENTS } from '../utils/segment-analyzer.js';
import { DataPipeline } from '../utils/data-pipeline.js';
import { appConfig } from '../config/app-config.js';
import { withRetry, ExternalServiceError } from '../utils/error-handler.js';
import fetch from 'node-fetch';

const logger = createLogger('PDFInsightExtractor');

export class PDFInsightExtractor {
  constructor() {
    this.claudeApiUrl = "https://api.anthropic.com/v1/messages";
    this.cache = new Map();
    this.pipeline = null;
  }

  async extractInsights(pdfPaths) {
    logger.info(`Extracting insights from ${pdfPaths.length} PDFs`);
    
    // Create pipeline for PDF processing
    this.pipeline = new DataPipeline('pdf-extraction', {
      stopOnError: false,
      cacheResults: true
    });
    
    const insights = {
      segmentDescriptions: {},
      keyFindings: [],
      valueFrameworks: {},
      behavioralIndicators: []
    };
    
    // Process PDFs in batches for efficiency
    this.pipeline.batch('process-pdfs', async (batch) => {
      const results = [];
      
      for (const pdfPath of batch) {
        try {
          // Check cache first
          const cacheKey = `pdf:${pdfPath}`;
          if (this.cache.has(cacheKey)) {
            logger.debug(`Using cached analysis for ${pdfPath}`);
            results.push(this.cache.get(cacheKey));
            continue;
          }
          
          const content = await this.extractPDFContent(pdfPath);
          const analysis = await this.analyzeWithClaude(content, pdfPath);
          
          // Cache the result
          this.cache.set(cacheKey, analysis);
          results.push(analysis);
          
        } catch (error) {
          logger.error(`Error processing PDF ${pdfPath}`, error);
          results.push(this.getFallbackAnalysis({ text: '' }));
        }
      }
      
      return results;
    }, 3);
    
    // Track progress
    this.pipeline.on('batch-progress', (progress) => {
      logger.info(`PDF processing progress: ${progress.processed}/${progress.total}`);
    });
    
    try {
      const batchResults = await this.pipeline.execute(pdfPaths);
      
      // Merge all insights
      for (const analysis of batchResults) {
        Object.assign(insights.segmentDescriptions, analysis.segments || {});
        insights.keyFindings.push(...(analysis.findings || []));
        insights.behavioralIndicators.push(...(analysis.behaviors || []));
        
        if (analysis.valueFramework) {
          Object.assign(insights.valueFrameworks, analysis.valueFramework);
        }
      }
      
      logger.info('PDF insight extraction completed', {
        segments: Object.keys(insights.segmentDescriptions).length,
        findings: insights.keyFindings.length,
        behaviors: insights.behavioralIndicators.length
      });
      
      return insights;
    } catch (error) {
      logger.error('PDF extraction pipeline failed', error);
      throw error;
    }
  }
  
  async extractPDFContent(pdfPath) {
    logger.debug(`Extracting content from ${pdfPath}`);
    
    try {
      // Use file-operations utility
      const pdfContent = await readPDFContent(pdfPath);
      
      logger.debug(`Extracted ${pdfContent.numpages} pages from PDF`);
      return pdfContent;
    } catch (error) {
      logger.error(`Failed to extract PDF content from ${pdfPath}`, error);
      return { text: '', numpages: 0, info: {}, metadata: {} };
    }
  }
  
  async analyzeWithClaude(pdfContent, pdfPath) {
    // If no API key or content is empty, return structured fallback
    const apiKey = appConfig.anthropic.apiKey;
    
    if (!apiKey || apiKey === 'your_api_key_here' || !pdfContent.text) {
      logger.warn('No API key or empty content, using fallback analysis');
      return this.getFallbackAnalysis(pdfContent);
    }
    
    const prompt = `Analyze this market research document and extract:
1. Consumer segments and their characteristics
2. Key behavioral indicators for each segment
3. Value systems and decision factors
4. Purchase propensity patterns

Focus on LOHAS (Lifestyles of Health and Sustainability) segments if mentioned:
- Leader (highly committed to sustainability)
- Leaning (balancing sustainability with practicality)
- Learner (price-conscious but curious)
- Laggard (price and functionality focused)

Format as JSON with segments, findings, behaviors, and valueFramework keys.

Document: ${pdfPath}
Content (first 10000 characters):
${pdfContent.text.substring(0, 10000)}`;
    
    try {
      // Use retry logic for API calls
      const response = await withRetry(async () => {
        const res = await fetch(this.claudeApiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: appConfig.anthropic.model,
            max_tokens: 2000,
            messages: [{ role: "user", content: prompt }]
          })
        });
        
        if (!res.ok) {
          throw new ExternalServiceError('Claude', `API request failed: ${res.status}`);
        }
        
        return res;
      }, 3, 1000);
      
      const data = await response.json();
      const analysis = JSON.parse(data.content[0].text);
      
      logger.info(`Successfully analyzed PDF: ${pdfPath}`);
      return analysis;
    } catch (error) {
      logger.error(`Claude API error for ${pdfPath}`, error);
      return this.getFallbackAnalysis(pdfContent);
    }
  }
  
  getFallbackAnalysis(pdfContent) {
    logger.debug('Using fallback analysis');
    
    // Extract key patterns from PDF text
    const text = pdfContent.text?.toLowerCase() || '';
    
    // Look for LOHAS segments
    const hasLOHAS = text.includes('lohas') || text.includes('leader') || text.includes('leaning');
    const hasSustainability = text.includes('sustain') || text.includes('eco') || text.includes('environment');
    const hasPrice = text.includes('price') || text.includes('cost') || text.includes('value');
    
    // Use LOHAS_SEGMENTS from segment-analyzer if LOHAS patterns found
    const segments = hasLOHAS ? 
      Object.entries(LOHAS_SEGMENTS).reduce((acc, [key, segment]) => {
        acc[key] = {
          characteristics: Object.values(segment.characteristics),
          percentage: segment.percentage,
          valueSystem: segment.valueSystem
        };
        return acc;
      }, {}) : {
        "Segment_1": {
          characteristics: ["Primary segment"],
          percentage: 25
        },
        "Segment_2": {
          characteristics: ["Secondary segment"],
          percentage: 25
        },
        "Segment_3": {
          characteristics: ["Tertiary segment"],
          percentage: 25
        },
        "Segment_4": {
          characteristics: ["Quaternary segment"],
          percentage: 25
        }
      };
    
    const findings = [];
    if (hasSustainability) {
      findings.push("Sustainability is a key differentiator among consumer segments");
      findings.push("Environmental concerns influence purchasing decisions");
    }
    if (hasPrice) {
      findings.push("Price sensitivity varies across consumer segments");
      findings.push("Value perception affects brand loyalty");
    }
    
    const behaviors = [];
    if (hasLOHAS) {
      behaviors.push("Leaders actively seek sustainable products");
      behaviors.push("Leanings balance sustainability with practical concerns");
      behaviors.push("Learners are influenced by peer recommendations");
      behaviors.push("Laggards prioritize traditional product attributes");
    }
    
    const valueFramework = {
      dimensions: [],
      weights: {}
    };
    
    if (hasSustainability) {
      valueFramework.dimensions.push("sustainability");
      valueFramework.weights.sustainability = 0.3;
    }
    if (hasPrice) {
      valueFramework.dimensions.push("price");
      valueFramework.weights.price = 0.25;
    }
    
    valueFramework.dimensions.push("quality", "brand", "convenience");
    valueFramework.weights.quality = 0.2;
    valueFramework.weights.brand = 0.15;
    valueFramework.weights.convenience = 0.1;
    
    return {
      segments,
      findings,
      behaviors,
      valueFramework
    };
  }
  
  clearCache() {
    const cacheSize = this.cache.size;
    this.cache.clear();
    logger.info(`Cleared PDF analysis cache (${cacheSize} entries)`);
  }
}