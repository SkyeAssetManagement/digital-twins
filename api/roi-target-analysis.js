/**
 * Phase 3D API Endpoint: ROI-Focused Target Identification + Pain/Pleasure Categorization
 * 
 * Dual-layer analysis that identifies top 5 revenue-impacting targets and categorizes
 * all survey features psychologically as Pain/Pleasure/Other for strategic insights.
 * 
 * Endpoint: POST /api/roi-target-analysis
 * 
 * Features:
 * - ROI target identification for purchase intent, spending, conversion probability
 * - Pain/Pleasure/Other psychological categorization of all features
 * - Market psychology analysis (pain-driven vs aspiration-driven)
 * - Strategic insight generation for marketing optimization
 * - Business recommendations based on psychological drivers
 */

import { ROITargetAnalyzer } from '../src/analysis/roi-target-analyzer.js';
import { SurveyDataManager } from './survey-data-manager.js';

/**
 * Handles ROI target analysis and Pain/Pleasure categorization requests
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
            surveyColumns,
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

        if (!surveyColumns || !Array.isArray(surveyColumns) || surveyColumns.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'surveyColumns array is required and must contain at least one column'
            });
        }

        if (!sampleResponses || !Array.isArray(sampleResponses)) {
            return res.status(400).json({
                success: false,
                error: 'sampleResponses array is required'
            });
        }

        // Validate survey columns structure
        const columnValidation = validateSurveyColumns(surveyColumns);
        if (!columnValidation.isValid) {
            return res.status(400).json({
                success: false,
                error: 'Invalid survey columns structure',
                details: columnValidation.errors
            });
        }

        // Initialize components
        const analyzer = new ROITargetAnalyzer({
            apiKey: process.env.ANTHROPIC_API_KEY,
            model: 'claude-opus-4-1-20250805',
            maxROITargets: options.maxROITargets || 5,
            minBusinessImpactScore: options.minBusinessImpactScore || 0.7,
            painPleasureThreshold: options.painPleasureThreshold || 0.8,
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
            'roi_target_analysis', 
            '3D',
            {
                columnCount: surveyColumns.length,
                sampleSize: sampleResponses.length,
                maxROITargets: options.maxROITargets || 5,
                analysisMode: 'dual_layer'
            }
        );

        console.log(`Starting Phase 3D ROI target analysis for survey ${surveyId}`);
        console.log(`Analyzing ${surveyColumns.length} columns with ${sampleResponses.length} sample responses`);
        console.log(`Business focus: ${context.business_description || survey.business_description || 'Not specified'}`);

        // Merge survey context with provided context
        const fullContext = {
            target_demographic: survey.target_demographic,
            business_description: survey.business_description,
            dataset_name: survey.display_name,
            ...context
        };

        // Perform dual-layer ROI target analysis
        const analysisResults = await analyzer.performDualLayerAnalysis(
            surveyId,
            surveyColumns,
            sampleResponses,
            fullContext
        );

        // Store analysis results in database
        console.log('Storing ROI target analysis results in database...');
        await dataManager.storeROITargetResults(surveyId, analysisResults);

        // Complete analysis session
        const processingTime = Date.now() - startTime;
        await dataManager.completeAnalysisSession(sessionId, {
            records_processed: surveyColumns.length,
            llm_calls_made: analysisResults.statistics.llmCallsMade,
            llm_tokens_used: analysisResults.statistics.totalTokensUsed || 0,
            estimated_cost: analysisResults.statistics.estimatedCost,
            processing_time_seconds: Math.round(processingTime / 1000),
            results_summary: {
                roi_targets_identified: analysisResults.analysis.roiTargets.length,
                top_roi_targets: analysisResults.summary.topROITargets.map(t => t.column_name),
                pain_features: analysisResults.summary.painFeatures,
                pleasure_features: analysisResults.summary.pleasureFeatures,
                dominant_psychology: analysisResults.summary.marketDominantPsychology,
                business_insights: analysisResults.summary.keyBusinessInsights.length
            }
        });

        // Prepare response
        const response = {
            success: true,
            data: {
                surveyId: surveyId,
                sessionId: sessionId,
                analysis: analysisResults.analysis,
                summary: analysisResults.summary,
                statistics: {
                    ...analysisResults.statistics,
                    processingTimeMs: processingTime,
                    totalColumnsAnalyzed: surveyColumns.length,
                    sampleResponsesUsed: sampleResponses.length
                },
                businessInsights: {
                    marketPsychology: analysisResults.analysis.marketPsychology,
                    strategicRecommendations: analysisResults.recommendations,
                    roiTargetBreakdown: getROITargetBreakdown(analysisResults.analysis.roiTargets),
                    painPleasureDistribution: getPainPleasureDistribution(analysisResults.analysis.painPleasureCategories)
                },
                actionableInsights: generateActionableInsights(analysisResults)
            },
            metadata: {
                phase: '3D',
                analysisType: 'roi_target_pain_pleasure_analysis',
                timestamp: new Date().toISOString(),
                modelUsed: 'claude-opus-4-1-20250805',
                apiVersion: '2025-01-15'
            }
        };

        console.log(`Phase 3D ROI target analysis completed successfully`);
        console.log(`Identified ${analysisResults.analysis.roiTargets.length} ROI targets`);
        console.log(`Pain/Pleasure breakdown: ${analysisResults.summary.painFeatures} pain, ${analysisResults.summary.pleasureFeatures} pleasure, ${analysisResults.summary.otherFeatures} other`);
        console.log(`Market psychology: ${analysisResults.summary.marketDominantPsychology}`);
        console.log(`Total processing time: ${processingTime}ms`);

        res.status(200).json(response);

    } catch (error) {
        console.error('Phase 3D ROI Target Analysis Error:', error);

        // Try to complete analysis session with error
        const processingTime = Date.now() - startTime;
        try {
            if (req.body.surveyId) {
                const dataManager = new SurveyDataManager();
                const sessionId = await dataManager.findActiveSession(req.body.surveyId, 'roi_target_analysis');
                if (sessionId) {
                    await dataManager.failAnalysisSession(sessionId, error.message, {
                        processing_time_seconds: Math.round(processingTime / 1000),
                        column_count: req.body.surveyColumns?.length || 0,
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
                phase: '3D'
            });
        }

        if (error.message.includes('rate limit')) {
            return res.status(429).json({
                success: false,
                error: 'Rate limit exceeded',
                details: 'Too many API requests. Please try again later.',
                phase: '3D'
            });
        }

        if (error.message.includes('database')) {
            return res.status(500).json({
                success: false,
                error: 'Database operation failed',
                details: error.message,
                phase: '3D'
            });
        }

        if (error.message.includes('insufficient')) {
            return res.status(422).json({
                success: false,
                error: 'Insufficient data for analysis',
                details: 'Need more survey columns or sample responses for accurate ROI target identification',
                phase: '3D'
            });
        }

        // Generic error response
        res.status(500).json({
            success: false,
            error: 'ROI target analysis failed',
            details: error.message,
            phase: '3D',
            processingTimeMs: processingTime
        });
    }
}

/**
 * Validate survey columns structure
 */
function validateSurveyColumns(columns) {
    const errors = [];
    
    columns.forEach((column, index) => {
        if (!column.column_name) {
            errors.push(`Column ${index}: column_name is required`);
        }
        
        if (column.column_name && typeof column.column_name !== 'string') {
            errors.push(`Column ${index}: column_name must be a string`);
        }
        
        if (column.data_type && !['text', 'numeric', 'categorical', 'boolean', 'date'].includes(column.data_type)) {
            errors.push(`Column ${index}: invalid data_type (must be text, numeric, categorical, boolean, or date)`);
        }
    });
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Get ROI target breakdown by type
 */
function getROITargetBreakdown(roiTargets) {
    const breakdown = {
        purchase_intent: 0,
        spending_amount: 0,
        customer_ltv: 0,
        conversion_probability: 0,
        revenue_behavior: 0,
        other: 0
    };
    
    roiTargets.forEach(target => {
        const type = target.roi_type || 'other';
        breakdown[type] = (breakdown[type] || 0) + 1;
    });
    
    return {
        counts: breakdown,
        topTargets: roiTargets.slice(0, 5).map(target => ({
            name: target.column_name,
            type: target.roi_type,
            impact: target.business_impact_score,
            suitability: target.ml_target_suitability
        }))
    };
}

/**
 * Get pain/pleasure distribution with insights
 */
function getPainPleasureDistribution(painPleasureCategories) {
    const total = painPleasureCategories.pain.length + 
                 painPleasureCategories.pleasure.length + 
                 painPleasureCategories.other.length;
    
    const painPercentage = painPleasureCategories.pain.length / total;
    const pleasurePercentage = painPleasureCategories.pleasure.length / total;
    const otherPercentage = painPleasureCategories.other.length / total;
    
    return {
        counts: {
            pain: painPleasureCategories.pain.length,
            pleasure: painPleasureCategories.pleasure.length,
            other: painPleasureCategories.other.length,
            total: total
        },
        percentages: {
            pain: painPercentage,
            pleasure: pleasurePercentage,
            other: otherPercentage
        },
        topPainFeatures: painPleasureCategories.pain.slice(0, 5).map(p => ({
            name: p.column_name,
            confidence: p.confidence || 0.8,
            reasoning: p.reasoning
        })),
        topPleasureFeatures: painPleasureCategories.pleasure.slice(0, 5).map(p => ({
            name: p.column_name,
            confidence: p.confidence || 0.8,
            reasoning: p.reasoning
        }))
    };
}

/**
 * Generate actionable insights based on analysis results
 */
function generateActionableInsights(analysisResults) {
    const insights = [];
    
    // ROI-focused insights
    const topTarget = analysisResults.analysis.roiTargets[0];
    if (topTarget) {
        insights.push({
            type: 'roi_priority',
            priority: 'high',
            title: `Focus ML Analysis on ${topTarget.column_name}`,
            description: `This ${topTarget.roi_type} predictor has the highest business impact score (${(topTarget.business_impact_score * 100).toFixed(1)}%).`,
            action: 'Prioritize this variable in feature importance analysis and predictive modeling',
            expected_impact: 'Improved prediction accuracy for revenue-driving behaviors'
        });
    }
    
    // Psychology-based insights
    const psychology = analysisResults.analysis.marketPsychology;
    if (psychology.dominantPsychology === 'pain-driven') {
        insights.push({
            type: 'messaging_strategy',
            priority: 'high',
            title: 'Lead with Problem-Solving Messaging',
            description: `Market is ${(psychology.painPercentage * 100).toFixed(1)}% pain-driven. Customers are primarily motivated by problem resolution.`,
            action: 'Structure messaging to lead with problem identification, then present your solution',
            expected_impact: 'Higher message resonance and conversion rates'
        });
    } else if (psychology.dominantPsychology === 'aspiration-driven') {
        insights.push({
            type: 'messaging_strategy',
            priority: 'high',
            title: 'Emphasize Benefits and Aspirations',
            description: `Market is ${(psychology.pleasurePercentage * 100).toFixed(1)}% aspiration-driven. Customers are motivated by positive outcomes.`,
            action: 'Lead with benefits, success stories, and positive transformation messaging',
            expected_impact: 'Enhanced customer engagement and desire'
        });
    }
    
    // Strategic recommendations
    analysisResults.analysis.strategicInsights.slice(0, 3).forEach((insight, index) => {
        insights.push({
            type: 'strategic_action',
            priority: insight.business_impact === 'high' ? 'high' : 'medium',
            title: `Strategic Insight ${index + 1}`,
            description: insight.insight,
            action: insight.expected_outcome,
            expected_impact: `${insight.business_impact} business impact`
        });
    });
    
    return insights;
}