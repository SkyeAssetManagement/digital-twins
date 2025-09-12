/**
 * Phase 3C API Endpoint: Adaptive Category Discovery
 * 
 * Discovers categories specific to survey data and target demographic using 
 * context-aware analysis with recursive refinement to achieve high coverage.
 * 
 * Endpoint: POST /api/adaptive-category-discovery
 * 
 * Features:
 * - Context-aware category generation specific to demographics and business focus
 * - Recursive refinement process with coverage optimization
 * - Quality assessment for distinctiveness and business relevance
 * - Database storage of discovered categories
 * - Comprehensive audit trail and performance metrics
 */

import { AdaptiveCategoryDiscovery } from '../src/analysis/adaptive-category-discovery.js';
import { SurveyDataManager } from './survey-data-manager.js';

/**
 * Handles adaptive category discovery requests
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
            sampleResponses,
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

        if (!sampleResponses || !Array.isArray(sampleResponses) || sampleResponses.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'sampleResponses array is required and must contain at least one response'
            });
        }

        // Validate sample responses structure
        const validationResult = validateSampleResponses(sampleResponses);
        if (!validationResult.isValid) {
            return res.status(400).json({
                success: false,
                error: 'Invalid sample response structure',
                details: validationResult.errors
            });
        }

        // Initialize components
        const discovery = new AdaptiveCategoryDiscovery({
            apiKey: process.env.ANTHROPIC_API_KEY,
            model: 'claude-opus-4-1-20250805',
            targetCategoryCount: options.targetCategoryCount || 12,
            targetCoverage: options.targetCoverage || 0.90,
            maxRefinementIterations: options.maxRefinementIterations || 3,
            ...options
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
        const sessionId = await dataManager.startAnalysisSession(
            surveyId, 
            'adaptive_category_discovery', 
            '3C',
            {
                sampleSize: sampleResponses.length,
                targetCoverage: options.targetCoverage || 0.90,
                targetCategoryCount: options.targetCategoryCount || 12
            }
        );

        console.log(`Starting Phase 3C adaptive category discovery for survey ${surveyId}`);
        console.log(`Processing ${sampleResponses.length} sample responses`);
        console.log(`Target demographic: ${context.target_demographic || survey.target_demographic || 'Not specified'}`);

        // Merge survey context with provided context
        const fullContext = {
            target_demographic: survey.target_demographic,
            business_description: survey.business_description,
            dataset_name: survey.display_name,
            ...context
        };

        // Perform adaptive category discovery
        const discoveryResults = await discovery.discoverCategories(
            surveyId,
            sampleResponses,
            fullContext
        );

        // Store discovered categories in database
        console.log('Storing discovered categories in database...');
        await dataManager.storeDiscoveredCategories(surveyId, discoveryResults.categories);

        // Store category discovery session results
        await dataManager.storeCategoryDiscoveryResults(surveyId, sessionId, discoveryResults);

        // Complete analysis session
        const processingTime = Date.now() - startTime;
        await dataManager.completeAnalysisSession(sessionId, {
            records_processed: sampleResponses.length,
            llm_calls_made: discoveryResults.statistics.totalLLMCalls,
            llm_tokens_used: discoveryResults.statistics.totalTokensUsed || 0,
            estimated_cost: discoveryResults.statistics.estimatedCost,
            processing_time_seconds: Math.round(processingTime / 1000),
            results_summary: {
                categories_discovered: discoveryResults.categories.length,
                coverage_achieved: discoveryResults.qualityMetrics.coverage,
                quality_score: discoveryResults.qualityMetrics.overallQualityScore,
                refinement_iterations: discoveryResults.discovery.refinementIterations,
                business_alignment: discoveryResults.qualityMetrics.businessAlignment
            }
        });

        // Prepare response
        const response = {
            success: true,
            data: {
                surveyId: surveyId,
                sessionId: sessionId,
                categories: discoveryResults.categories,
                discovery: discoveryResults.discovery,
                qualityMetrics: discoveryResults.qualityMetrics,
                statistics: {
                    sampleSize: sampleResponses.length,
                    processingTimeMs: processingTime,
                    llmCallsMade: discoveryResults.statistics.totalLLMCalls,
                    estimatedCost: discoveryResults.statistics.estimatedCost,
                    cacheHitRate: discoveryResults.statistics.cacheHitRate
                },
                categoryBreakdown: {
                    byType: getCategoryBreakdownByType(discoveryResults.categories),
                    coverageDistribution: getCoverageDistribution(discoveryResults.categories),
                    businessRelevanceScores: getBusinessRelevanceScores(discoveryResults.categories)
                },
                recommendations: generateDiscoveryRecommendations(discoveryResults)
            },
            metadata: {
                phase: '3C',
                analysisType: 'adaptive_category_discovery',
                timestamp: new Date().toISOString(),
                modelUsed: 'claude-opus-4-1-20250805',
                apiVersion: '2025-01-15'
            }
        };

        console.log(`Phase 3C category discovery completed successfully`);
        console.log(`Discovered ${discoveryResults.categories.length} categories with ${(discoveryResults.qualityMetrics.coverage * 100).toFixed(1)}% coverage`);
        console.log(`Quality score: ${(discoveryResults.qualityMetrics.overallQualityScore * 100).toFixed(1)}%`);
        console.log(`Total processing time: ${processingTime}ms`);

        res.status(200).json(response);

    } catch (error) {
        console.error('Phase 3C Adaptive Category Discovery Error:', error);

        // Try to complete analysis session with error
        const processingTime = Date.now() - startTime;
        try {
            if (req.body.surveyId) {
                const dataManager = new SurveyDataManager();
                const sessionId = await dataManager.findActiveSession(req.body.surveyId, 'adaptive_category_discovery');
                if (sessionId) {
                    await dataManager.failAnalysisSession(sessionId, error.message, {
                        processing_time_seconds: Math.round(processingTime / 1000),
                        sample_size: req.body.sampleResponses?.length || 0
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
                phase: '3C'
            });
        }

        if (error.message.includes('rate limit')) {
            return res.status(429).json({
                success: false,
                error: 'Rate limit exceeded',
                details: 'Too many API requests. Please try again later.',
                phase: '3C'
            });
        }

        if (error.message.includes('database')) {
            return res.status(500).json({
                success: false,
                error: 'Database operation failed',
                details: error.message,
                phase: '3C'
            });
        }

        if (error.message.includes('coverage')) {
            return res.status(422).json({
                success: false,
                error: 'Category discovery incomplete',
                details: 'Unable to achieve target coverage with current sample',
                phase: '3C'
            });
        }

        // Generic error response
        res.status(500).json({
            success: false,
            error: 'Adaptive category discovery failed',
            details: error.message,
            phase: '3C',
            processingTimeMs: processingTime
        });
    }
}

/**
 * Validate sample responses structure
 */
function validateSampleResponses(responses) {
    const errors = [];
    
    responses.forEach((response, index) => {
        if (!response.id) {
            errors.push(`Response ${index}: id is required`);
        }
        
        if (!response.text || typeof response.text !== 'string') {
            errors.push(`Response ${index}: text is required and must be a string`);
        }
        
        if (response.text && response.text.length < 5) {
            errors.push(`Response ${index}: text must be at least 5 characters long`);
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

/**
 * Get category breakdown by type
 */
function getCategoryBreakdownByType(categories) {
    const breakdown = {
        pain: 0,
        pleasure: 0,
        behavioral: 0,
        demographic: 0,
        other: 0
    };
    
    categories.forEach(category => {
        const type = category.type || 'other';
        breakdown[type] = (breakdown[type] || 0) + 1;
    });
    
    return breakdown;
}

/**
 * Get coverage distribution across categories
 */
function getCoverageDistribution(categories) {
    return categories.map(category => ({
        name: category.name,
        type: category.type,
        expectedCoverage: category.expected_coverage || 0,
        businessRelevance: category.business_relevance_score || 0
    }));
}

/**
 * Get business relevance scores
 */
function getBusinessRelevanceScores(categories) {
    return categories
        .map(cat => ({
            name: cat.name,
            score: cat.business_relevance_score || 0.8
        }))
        .sort((a, b) => b.score - a.score);
}

/**
 * Generate recommendations based on discovery results
 */
function generateDiscoveryRecommendations(results) {
    const recommendations = [];
    
    // Coverage recommendations
    if (results.qualityMetrics.coverage < 0.85) {
        recommendations.push({
            type: 'coverage_improvement',
            priority: 'high',
            message: `Coverage is ${(results.qualityMetrics.coverage * 100).toFixed(1)}%. Consider adding more specific categories or increasing sample size.`,
            action: 'Refine categories or expand sample data'
        });
    }
    
    // Quality recommendations
    if (results.qualityMetrics.overallQualityScore < 0.75) {
        recommendations.push({
            type: 'quality_improvement',
            priority: 'medium',
            message: 'Category quality could be improved. Review distinctiveness and business relevance.',
            action: 'Refine category definitions and ensure business alignment'
        });
    }
    
    // Category count recommendations
    if (results.categories.length < 8) {
        recommendations.push({
            type: 'category_expansion',
            priority: 'low',
            message: 'Consider adding more categories for better granularity.',
            action: 'Discover additional subcategories in high-usage areas'
        });
    } else if (results.categories.length > 18) {
        recommendations.push({
            type: 'category_consolidation',
            priority: 'medium',
            message: 'Large number of categories may reduce clarity. Consider consolidation.',
            action: 'Merge similar or underused categories'
        });
    }
    
    // Business alignment recommendations
    if (results.qualityMetrics.businessAlignment < 0.8) {
        recommendations.push({
            type: 'business_alignment',
            priority: 'high',
            message: 'Categories may not be optimally aligned with business objectives.',
            action: 'Review categories for actionable business insights'
        });
    }
    
    return recommendations;
}