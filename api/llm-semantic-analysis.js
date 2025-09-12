/**
 * Phase 3B API Endpoint: LLM Semantic Analysis
 * 
 * Pure semantic categorization using Claude Opus without keyword matching.
 * Context-aware analysis that understands implications, subtext, sarcasm, and colloquialisms.
 * 
 * Endpoint: POST /api/llm-semantic-analysis
 * 
 * Features:
 * - Batched processing for efficiency
 * - Response caching to avoid duplicate LLM calls
 * - Confidence scoring and reasoning transparency
 * - Binary matrix conversion for ML compatibility
 * - Database storage of categorization results
 */

import { LLMSemanticCategorizer } from '../src/analysis/llm-semantic-categorizer.js';
import { SurveyDataManager } from './survey-data-manager.js';

/**
 * Handles LLM semantic analysis requests
 * 
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            error: 'Method not allowed. Use POST.'
        });
    }

    const startTime = Date.now();

    try {
        const {
            surveyId,
            responses,
            categories,
            context = {},
            options = {}
        } = req.body;

        // Validate required parameters
        if (!surveyId) {
            return res.status(400).json({
                success: false,
                error: 'surveyId is required'
            });
        }

        if (!responses || !Array.isArray(responses) || responses.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'responses array is required and must contain at least one response'
            });
        }

        if (!categories || !Array.isArray(categories) || categories.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'categories array is required and must contain at least one category'
            });
        }

        // Initialize components
        const categorizer = new LLMSemanticCategorizer({
            batchSize: options.batchSize || 20,
            maxRetries: options.maxRetries || 3,
            enableCaching: options.enableCaching !== false,
            apiKey: process.env.ANTHROPIC_API_KEY,
            model: 'claude-opus-4-1-20250805'
        });

        const dataManager = new SurveyDataManager();

        // Validate survey exists
        const survey = await dataManager.getSurveyById(surveyId);
        if (!survey) {
            return res.status(404).json({
                success: false,
                error: `Survey with ID ${surveyId} not found`
            });
        }

        // Start analysis session tracking
        const sessionId = await dataManager.startAnalysisSession(surveyId, 'semantic_analysis', '3B');

        console.log(`Starting Phase 3B semantic analysis for survey ${surveyId}`);
        console.log(`Processing ${responses.length} responses across ${categories.length} categories`);

        // Perform semantic categorization
        const categorizationResults = await categorizer.categorizeResponses(
            surveyId,
            responses,
            categories,
            {
                target_demographic: survey.target_demographic,
                business_description: survey.business_description,
                dataset_name: survey.display_name,
                ...context
            }
        );

        // Store results in database
        console.log('Storing categorization results in database...');
        await dataManager.storeCategorizationResults(surveyId, categorizationResults);

        // Generate binary matrix for ML compatibility
        console.log('Converting to binary matrix for ML processing...');
        const binaryMatrix = await categorizer.generateBinaryMatrix(categorizationResults, categories);

        // Complete analysis session
        const processingTime = Date.now() - startTime;
        await dataManager.completeAnalysisSession(sessionId, {
            records_processed: responses.length,
            llm_calls_made: categorizationResults.statistics.totalLLMCalls,
            llm_tokens_used: categorizationResults.statistics.totalTokensUsed,
            estimated_cost: categorizationResults.statistics.estimatedCost,
            processing_time_seconds: Math.round(processingTime / 1000),
            results_summary: {
                total_categorizations: categorizationResults.categorizations.length,
                average_confidence: categorizationResults.statistics.averageConfidence,
                cache_hit_rate: categorizationResults.statistics.cacheHitRate,
                unique_categories_used: categorizationResults.statistics.uniqueCategoriesUsed
            }
        });

        // Prepare response
        const response = {
            success: true,
            data: {
                surveyId: surveyId,
                sessionId: sessionId,
                categorizations: categorizationResults.categorizations,
                binaryMatrix: binaryMatrix,
                statistics: {
                    totalResponses: responses.length,
                    totalCategories: categories.length,
                    totalCategorizations: categorizationResults.categorizations.length,
                    processingTimeMs: processingTime,
                    llmCallsMade: categorizationResults.statistics.totalLLMCalls,
                    tokensUsed: categorizationResults.statistics.totalTokensUsed,
                    estimatedCost: categorizationResults.statistics.estimatedCost,
                    averageConfidence: categorizationResults.statistics.averageConfidence,
                    cacheHitRate: categorizationResults.statistics.cacheHitRate,
                    uniqueCategoriesUsed: categorizationResults.statistics.uniqueCategoriesUsed
                },
                categoryBreakdown: categorizationResults.categoryBreakdown,
                qualityMetrics: {
                    highConfidenceRate: categorizationResults.categorizations.filter(c => c.confidence >= 0.8).length / categorizationResults.categorizations.length,
                    averageReasoningLength: categorizationResults.categorizations.reduce((sum, c) => sum + c.reasoning.length, 0) / categorizationResults.categorizations.length,
                    categoriesWithLowUsage: categories.filter(cat => 
                        (categorizationResults.categoryBreakdown[cat.name] || 0) < responses.length * 0.05
                    ).length
                }
            },
            metadata: {
                phase: '3B',
                analysisType: 'llm_semantic_categorization',
                timestamp: new Date().toISOString(),
                modelUsed: 'claude-opus-4-1-20250805',
                apiVersion: '2025-01-15'
            }
        };

        console.log(`Phase 3B semantic analysis completed successfully`);
        console.log(`Total processing time: ${processingTime}ms`);
        console.log(`LLM calls made: ${categorizationResults.statistics.totalLLMCalls}`);
        console.log(`Cache hit rate: ${(categorizationResults.statistics.cacheHitRate * 100).toFixed(1)}%`);

        res.status(200).json(response);

    } catch (error) {
        console.error('Phase 3B LLM Semantic Analysis Error:', error);

        // Try to complete analysis session with error
        const processingTime = Date.now() - startTime;
        try {
            if (req.body.surveyId) {
                const dataManager = new SurveyDataManager();
                const sessionId = await dataManager.findActiveSession(req.body.surveyId, 'semantic_analysis');
                if (sessionId) {
                    await dataManager.failAnalysisSession(sessionId, error.message, {
                        processing_time_seconds: Math.round(processingTime / 1000)
                    });
                }
            }
        } catch (sessionError) {
            console.error('Failed to update analysis session:', sessionError);
        }

        // Determine error type and return appropriate response
        if (error.message.includes('API key')) {
            return res.status(500).json({
                success: false,
                error: 'Anthropic API configuration error',
                details: 'API key missing or invalid',
                phase: '3B'
            });
        }

        if (error.message.includes('rate limit')) {
            return res.status(429).json({
                success: false,
                error: 'Rate limit exceeded',
                details: 'Too many API requests. Please try again later.',
                phase: '3B'
            });
        }

        if (error.message.includes('database')) {
            return res.status(500).json({
                success: false,
                error: 'Database operation failed',
                details: error.message,
                phase: '3B'
            });
        }

        // Generic error response
        res.status(500).json({
            success: false,
            error: 'LLM semantic analysis failed',
            details: error.message,
            phase: '3B',
            processingTimeMs: processingTime
        });
    }
}

/**
 * Helper function to validate category structure
 * 
 * @param {Array} categories - Categories to validate
 * @returns {Object} Validation result
 */
function validateCategories(categories) {
    const errors = [];
    
    categories.forEach((category, index) => {
        if (!category.name || typeof category.name !== 'string') {
            errors.push(`Category ${index}: name is required and must be a string`);
        }
        
        if (!category.type || !['pain', 'pleasure', 'demographic', 'behavioral', 'other'].includes(category.type)) {
            errors.push(`Category ${index}: type must be one of: pain, pleasure, demographic, behavioral, other`);
        }
        
        if (category.description && typeof category.description !== 'string') {
            errors.push(`Category ${index}: description must be a string if provided`);
        }
    });
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Helper function to validate response structure
 * 
 * @param {Array} responses - Responses to validate
 * @returns {Object} Validation result
 */
function validateResponses(responses) {
    const errors = [];
    
    responses.forEach((response, index) => {
        if (!response.id) {
            errors.push(`Response ${index}: id is required`);
        }
        
        if (!response.text || typeof response.text !== 'string') {
            errors.push(`Response ${index}: text is required and must be a string`);
        }
        
        if (response.columnId === undefined) {
            errors.push(`Response ${index}: columnId is required`);
        }
        
        if (response.respondentId === undefined) {
            errors.push(`Response ${index}: respondentId is required`);
        }
    });
    
    return {
        isValid: errors.length === 0,
        errors
    };
}