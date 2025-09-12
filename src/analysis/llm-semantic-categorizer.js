/**
 * Pure LLM Semantic Analysis Engine - Phase 3B
 * 
 * Replaces keyword-based categorization with true semantic understanding
 * Uses Claude Opus 4.1 to understand context, implications, and subtext
 * 
 * Key Features:
 * - Context-aware semantic understanding (no keyword matching)
 * - Handles sarcasm, idioms, colloquialisms, and implied meanings
 * - Batched processing for API efficiency
 * - Confidence scoring and reasoning transparency
 * - Caching system to avoid duplicate LLM calls
 * - Integration with Phase 3X database schema
 * 
 * Examples of semantic understanding:
 * - "Breaks me out" → health_safety (no keyword "safety")
 * - "Doesn't hurt my wallet" → value_price (no keyword "price") 
 * - "My kids love it" → family_satisfaction (implied positive sentiment)
 */

import Anthropic from '@anthropic-ai/sdk';
import crypto from 'crypto';
import surveyDataManager from '../../api/survey-data-manager.js';

export class LLMSemanticCategorizer {
    constructor(options = {}) {
        this.options = {
            batchSize: 20,
            maxRetries: 3,
            confidenceThreshold: 0.7,
            cacheEnabled: true,
            maxCacheSize: 10000,
            enableReasoningValidation: true,
            ...options
        };
        
        this.anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY
        });
        
        // Response cache to avoid duplicate LLM calls
        this.responseCache = new Map();
        this.processingStats = {
            totalRequests: 0,
            cacheHits: 0,
            apiCalls: 0,
            totalTokens: 0,
            totalCost: 0
        };
    }
    
    /**
     * Main semantic categorization entry point
     * @param {string} surveyId - Survey identifier
     * @param {Array} responses - Array of open-ended responses to categorize
     * @param {Array} categories - Predefined or discovered categories 
     * @param {Object} context - Survey and business context
     * @returns {Promise<Object>} Categorization results with confidence scores
     */
    async categorizeResponses(surveyId, responses, categories, context = {}) {
        console.log('🧠 Starting Pure LLM Semantic Categorization...');
        console.log(`📊 Processing ${responses.length} responses across ${categories.length} categories`);
        
        const sessionId = await surveyDataManager.startAnalysisSession(
            surveyId, 'semantic_categorization', '3B', {
                batchSize: this.options.batchSize,
                confidenceThreshold: this.options.confidenceThreshold,
                categories: categories.map(c => c.name)
            }
        );
        
        try {
            // Prepare categorization context
            const categorizationContext = this.buildCategorizationContext(categories, context);
            
            // Process responses in batches for efficiency
            const allResults = [];
            const batches = this.createBatches(responses, this.options.batchSize);
            
            console.log(`🔄 Processing ${batches.length} batches of responses...`);
            
            for (let i = 0; i < batches.length; i++) {
                const batch = batches[i];
                console.log(`📦 Processing batch ${i + 1}/${batches.length} (${batch.length} responses)`);
                
                const batchResults = await this.processBatch(batch, categorizationContext, context);
                allResults.push(...batchResults);
                
                // Small delay to respect API rate limits
                if (i < batches.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }
            
            // Convert to binary matrix format for ML compatibility
            const binaryMatrix = this.convertToBinaryMatrix(allResults, categories);
            
            // Store results in database
            await this.storeCategorizationResults(surveyId, allResults, categories);
            
            const results = {
                totalResponses: responses.length,
                totalCategories: categories.length,
                categorizations: allResults,
                binaryMatrix: binaryMatrix,
                processingStats: this.processingStats,
                confidenceDistribution: this.calculateConfidenceDistribution(allResults)
            };
            
            await surveyDataManager.completeAnalysisSession(sessionId, results);
            
            console.log('✅ Semantic categorization completed successfully');
            console.log(`📈 Cache hit rate: ${Math.round((this.processingStats.cacheHits / this.processingStats.totalRequests) * 100)}%`);
            console.log(`💰 API calls made: ${this.processingStats.apiCalls}`);
            
            return results;
            
        } catch (error) {
            console.error('❌ Semantic categorization failed:', error);
            await surveyDataManager.pool.query(
                'UPDATE analysis_sessions SET status = $1, error_message = $2 WHERE id = $3',
                ['failed', error.message, sessionId]
            );
            throw error;
        }
    }
    
    /**
     * Build comprehensive categorization context for LLM
     */
    buildCategorizationContext(categories, context) {
        const categoryDescriptions = categories.map(cat => {
            return {
                name: cat.name,
                type: cat.type || 'other',
                description: cat.description || `Responses related to ${cat.name.toLowerCase()}`,
                keywords: cat.keywords || [],
                examples: cat.examples || []
            };
        }).sort((a, b) => a.name.localeCompare(b.name)); // Consistent ordering
        
        return {
            categories: categoryDescriptions,
            businessContext: context.business_description || 'Consumer survey analysis',
            targetDemographic: context.target_demographic || 'General population',
            analysisGoal: context.analysis_goal || 'Understand customer sentiment and preferences',
            categoryCount: categoryDescriptions.length
        };
    }
    
    /**
     * Create batches for efficient processing
     */
    createBatches(responses, batchSize) {
        const batches = [];
        for (let i = 0; i < responses.length; i += batchSize) {
            batches.push(responses.slice(i, i + batchSize));
        }
        return batches;
    }
    
    /**
     * Process a batch of responses with semantic understanding
     */
    async processBatch(responseBatch, categorizationContext, context) {
        const batchResults = [];
        
        // Check cache first
        const cacheResults = this.checkCacheForBatch(responseBatch, categorizationContext);
        const uncachedResponses = responseBatch.filter((_, i) => !cacheResults[i]);
        
        if (uncachedResponses.length === 0) {
            console.log('💾 All responses found in cache');
            this.processingStats.cacheHits += responseBatch.length;
            return cacheResults.filter(r => r !== null);
        }
        
        // Process uncached responses with LLM
        const llmResults = await this.callSemanticAnalysisLLM(uncachedResponses, categorizationContext, context);
        
        // Merge cached and LLM results
        let llmIndex = 0;
        for (let i = 0; i < responseBatch.length; i++) {
            if (cacheResults[i]) {
                batchResults.push(cacheResults[i]);
                this.processingStats.cacheHits++;
            } else {
                const result = llmResults[llmIndex++];
                batchResults.push(result);
                
                // Cache the result
                if (this.options.cacheEnabled) {
                    this.cacheResponse(responseBatch[i], categorizationContext, result);
                }
            }
            this.processingStats.totalRequests++;
        }
        
        return batchResults;
    }
    
    /**
     * Call Claude Opus 4.1 for semantic analysis
     */
    async callSemanticAnalysisLLM(responses, categorizationContext, context) {
        const prompt = this.buildSemanticAnalysisPrompt(responses, categorizationContext, context);
        
        let attempts = 0;
        while (attempts < this.options.maxRetries) {
            try {
                console.log(`🤖 Calling Claude Opus for semantic analysis (attempt ${attempts + 1})`);
                
                const response = await this.anthropic.messages.create({
                    model: 'claude-3-opus-20240229',
                    max_tokens: 4000,
                    temperature: 0.1, // Low temperature for consistency
                    messages: [{
                        role: 'user',
                        content: prompt
                    }]
                });
                
                this.processingStats.apiCalls++;
                this.processingStats.totalTokens += response.usage?.total_tokens || 0;
                this.processingStats.totalCost += this.estimateCost(response.usage?.total_tokens || 0);
                
                const analysisResults = this.parseSemanticAnalysisResponse(response.content[0].text, responses);
                
                // Validate results
                if (this.options.enableReasoningValidation) {
                    this.validateAnalysisResults(analysisResults, responses, categorizationContext);
                }
                
                return analysisResults;
                
            } catch (error) {
                attempts++;
                console.warn(`⚠️  LLM call attempt ${attempts} failed:`, error.message);
                
                if (attempts >= this.options.maxRetries) {
                    throw new Error(`LLM semantic analysis failed after ${this.options.maxRetries} attempts: ${error.message}`);
                }
                
                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
            }
        }
    }
    
    /**
     * Build comprehensive semantic analysis prompt
     */
    buildSemanticAnalysisPrompt(responses, categorizationContext, context) {
        const categoriesText = categorizationContext.categories.map(cat => {
            const examples = cat.examples.length > 0 ? `\n  Examples: ${cat.examples.join(', ')}` : '';
            return `- **${cat.name}** (${cat.type}): ${cat.description}${examples}`;
        }).join('\n');
        
        const responsesText = responses.map((response, i) => {
            const text = typeof response === 'object' ? response.text || response.value_text : response;
            return `${i + 1}. "${text}"`;
        }).join('\n');
        
        return `You are an expert at semantic analysis for consumer research. Your task is to categorize survey responses based on their TRUE MEANING, not just keywords.

CONTEXT:
- Business: ${categorizationContext.businessContext}
- Target Demographic: ${categorizationContext.targetDemographic}  
- Analysis Goal: ${categorizationContext.analysisGoal}

CATEGORIES TO USE:
${categoriesText}

SEMANTIC ANALYSIS INSTRUCTIONS:
1. **Look beyond keywords** - Understand implications, subtext, and implied meanings
2. **Consider context** - Same words can mean different things in different contexts
3. **Handle colloquialisms** - "Breaks me out" = skin problems, "Doesn't hurt my wallet" = affordable
4. **Detect sentiment** - Positive/negative tone affects categorization
5. **Multiple categories OK** - Responses can fit multiple categories with different confidence levels
6. **Cultural nuances** - Consider demographic-specific language patterns

RESPONSES TO ANALYZE:
${responsesText}

For each response, analyze its TRUE SEMANTIC MEANING and assign it to the most appropriate categories.

Respond with JSON in this exact format:
{
  "analyses": [
    {
      "response_index": 1,
      "categories": [
        {
          "category": "category_name",
          "confidence": 0.85,
          "reasoning": "Clear explanation of why this category applies"
        }
      ],
      "primary_sentiment": "positive/negative/neutral",
      "semantic_themes": ["theme1", "theme2"]
    }
  ]
}

IMPORTANT:
- Only use the predefined categories above
- Confidence scores: 0.8-1.0 = very confident, 0.6-0.79 = confident, 0.4-0.59 = somewhat confident, below 0.4 = not confident enough
- Reasoning must explain the SEMANTIC understanding, not just keyword matching
- If a response doesn't clearly fit any category, use confidence < 0.4 and explain why
- Be thorough but concise in reasoning`;
    }
    
    /**
     * Parse LLM response into structured results
     */
    parseSemanticAnalysisResponse(responseText, originalResponses) {
        try {
            // Extract JSON from response
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in LLM response');
            }
            
            const parsed = JSON.parse(jsonMatch[0]);
            
            if (!parsed.analyses || !Array.isArray(parsed.analyses)) {
                throw new Error('Invalid response format: missing analyses array');
            }
            
            // Convert to our internal format
            const results = [];
            
            for (let i = 0; i < parsed.analyses.length; i++) {
                const analysis = parsed.analyses[i];
                const responseIndex = analysis.response_index - 1; // Convert to 0-based
                
                if (responseIndex < 0 || responseIndex >= originalResponses.length) {
                    console.warn(`⚠️  Invalid response index: ${analysis.response_index}`);
                    continue;
                }
                
                const originalResponse = originalResponses[responseIndex];
                const responseText = typeof originalResponse === 'object' ? 
                    originalResponse.text || originalResponse.value_text : originalResponse;
                
                results.push({
                    response_id: originalResponse.response_id || null,
                    column_id: originalResponse.column_id || null,
                    response_text: responseText,
                    categories: (analysis.categories || []).map(cat => ({
                        category: cat.category,
                        confidence: Math.min(Math.max(cat.confidence || 0, 0), 1),
                        reasoning: cat.reasoning || 'No reasoning provided'
                    })),
                    primary_sentiment: analysis.primary_sentiment || 'neutral',
                    semantic_themes: analysis.semantic_themes || [],
                    llm_model: 'claude-3-opus-20240229',
                    analysis_timestamp: new Date().toISOString()
                });
            }
            
            return results;
            
        } catch (error) {
            console.error('❌ Failed to parse LLM semantic analysis response:', error);
            console.error('Raw response:', responseText);
            throw new Error(`Response parsing failed: ${error.message}`);
        }
    }
    
    /**
     * Validate analysis results for quality assurance
     */
    validateAnalysisResults(results, originalResponses, categorizationContext) {
        const validCategories = new Set(categorizationContext.categories.map(c => c.name));
        
        for (const result of results) {
            // Check category validity
            for (const cat of result.categories) {
                if (!validCategories.has(cat.category)) {
                    console.warn(`⚠️  Invalid category detected: ${cat.category}`);
                }
                
                if (cat.confidence < 0 || cat.confidence > 1) {
                    console.warn(`⚠️  Invalid confidence score: ${cat.confidence}`);
                }
            }
            
            // Check for reasonable number of categories per response
            if (result.categories.length > 5) {
                console.warn(`⚠️  Too many categories assigned to one response: ${result.categories.length}`);
            }
        }
    }
    
    /**
     * Convert results to binary matrix for ML compatibility
     */
    convertToBinaryMatrix(results, categories) {
        const categoryNames = categories.map(c => c.name).sort();
        const binaryMatrix = [];
        
        for (const result of results) {
            const row = {};
            
            // Initialize all categories to 0
            categoryNames.forEach(cat => {
                row[cat] = 0;
                row[`${cat}_confidence`] = 0;
            });
            
            // Set values for assigned categories
            result.categories.forEach(cat => {
                if (categoryNames.includes(cat.category)) {
                    row[cat.category] = cat.confidence >= this.options.confidenceThreshold ? 1 : 0;
                    row[`${cat.category}_confidence`] = cat.confidence;
                }
            });
            
            // Add metadata
            row._response_id = result.response_id;
            row._column_id = result.column_id;
            row._primary_sentiment = result.primary_sentiment;
            
            binaryMatrix.push(row);
        }
        
        return binaryMatrix;
    }
    
    /**
     * Store categorization results in database
     */
    async storeCategorizationResults(surveyId, results, categories) {
        console.log('💾 Storing semantic categorization results in database...');
        
        try {
            // First, ensure semantic categories exist in database
            await this.ensureSemanticCategories(surveyId, categories);
            
            const categoryMap = await this.getCategoryIdMap(surveyId);
            
            // Store categorization results
            for (const result of results) {
                if (!result.response_id || !result.column_id) {
                    continue; // Skip if missing required IDs
                }
                
                for (const category of result.categories) {
                    const categoryId = categoryMap.get(category.category);
                    if (!categoryId) {
                        console.warn(`⚠️  Category not found in database: ${category.category}`);
                        continue;
                    }
                    
                    await surveyDataManager.pool.query(`
                        INSERT INTO response_categorizations (
                            response_id, column_id, category_id, confidence_score,
                            reasoning, llm_model_used
                        ) VALUES ($1, $2, $3, $4, $5, $6)
                        ON CONFLICT (response_id, column_id, category_id)
                        DO UPDATE SET
                            confidence_score = EXCLUDED.confidence_score,
                            reasoning = EXCLUDED.reasoning,
                            processing_date = CURRENT_TIMESTAMP
                    `, [
                        result.response_id, result.column_id, categoryId,
                        category.confidence, category.reasoning, result.llm_model
                    ]);
                }
            }
            
            console.log(`✅ Stored ${results.length} semantic categorization results`);
            
        } catch (error) {
            console.error('❌ Failed to store categorization results:', error);
            throw error;
        }
    }
    
    /**
     * Ensure semantic categories exist in database
     */
    async ensureSemanticCategories(surveyId, categories) {
        for (const category of categories) {
            await surveyDataManager.pool.query(`
                INSERT INTO semantic_categories (
                    survey_id, category_name, category_type, description,
                    discovery_method, confidence_score
                ) VALUES ($1, $2, $3, $4, 'predefined', 1.0)
                ON CONFLICT (survey_id, category_name) DO NOTHING
            `, [
                surveyId,
                category.name,
                category.type || 'other',
                category.description || `Category for ${category.name.toLowerCase()} related responses`
            ]);
        }
    }
    
    /**
     * Get category ID mapping from database
     */
    async getCategoryIdMap(surveyId) {
        const result = await surveyDataManager.pool.query(
            'SELECT id, category_name FROM semantic_categories WHERE survey_id = $1',
            [surveyId]
        );
        
        const map = new Map();
        result.rows.forEach(row => {
            map.set(row.category_name, row.id);
        });
        
        return map;
    }
    
    /**
     * Cache management methods
     */
    checkCacheForBatch(responses, categorizationContext) {
        return responses.map(response => {
            const cacheKey = this.generateCacheKey(response, categorizationContext);
            return this.responseCache.get(cacheKey) || null;
        });
    }
    
    cacheResponse(response, categorizationContext, result) {
        if (!this.options.cacheEnabled) return;
        
        // Manage cache size
        if (this.responseCache.size >= this.options.maxCacheSize) {
            const oldestKey = this.responseCache.keys().next().value;
            this.responseCache.delete(oldestKey);
        }
        
        const cacheKey = this.generateCacheKey(response, categorizationContext);
        this.responseCache.set(cacheKey, result);
    }
    
    generateCacheKey(response, categorizationContext) {
        const responseText = typeof response === 'object' ? 
            response.text || response.value_text : response;
        const contextHash = crypto.createHash('md5')
            .update(JSON.stringify(categorizationContext.categories))
            .digest('hex');
        return crypto.createHash('md5')
            .update(`${responseText}:${contextHash}`)
            .digest('hex');
    }
    
    /**
     * Calculate confidence distribution for reporting
     */
    calculateConfidenceDistribution(results) {
        const confidences = [];
        results.forEach(result => {
            result.categories.forEach(cat => {
                confidences.push(cat.confidence);
            });
        });
        
        if (confidences.length === 0) return {};
        
        confidences.sort((a, b) => a - b);
        
        return {
            min: confidences[0],
            max: confidences[confidences.length - 1],
            mean: confidences.reduce((sum, c) => sum + c, 0) / confidences.length,
            median: confidences[Math.floor(confidences.length / 2)],
            high_confidence: confidences.filter(c => c >= 0.8).length,
            low_confidence: confidences.filter(c => c < 0.5).length,
            total_categorizations: confidences.length
        };
    }
    
    /**
     * Estimate API cost based on token usage
     */
    estimateCost(tokens) {
        // Claude Opus pricing: ~$15 per 1M input tokens, ~$75 per 1M output tokens
        // Rough estimate assuming 70% input, 30% output
        const inputTokens = tokens * 0.7;
        const outputTokens = tokens * 0.3;
        return (inputTokens * 15 + outputTokens * 75) / 1000000;
    }
    
    /**
     * Get processing statistics
     */
    getProcessingStats() {
        return {
            ...this.processingStats,
            cacheHitRate: this.processingStats.totalRequests > 0 ? 
                (this.processingStats.cacheHits / this.processingStats.totalRequests) * 100 : 0,
            cacheSize: this.responseCache.size
        };
    }
}

// Export for use in other modules
export default LLMSemanticCategorizer;