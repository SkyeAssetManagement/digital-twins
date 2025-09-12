/**
 * Phase 3E API Endpoint: Single-Layer ML with MDA Feature Importance
 * 
 * Sophisticated Random Forest + Permutation Importance analysis using Mean Decrease in Accuracy (MDA).
 * Provides unbiased feature importance with significance-based reporting for business insights.
 * 
 * Endpoint: POST /api/mda-feature-analysis
 * 
 * Features:
 * - Optimized 2/3 train, 1/3 test split for stable MDA calculation
 * - Permutation importance on TEST SET ONLY (unbiased estimates)
 * - 10 repetitions with confidence intervals for statistical reliability
 * - Significance-based reporting to prevent overinterpretation
 * - Pain/Pleasure/Other category-aware importance analysis
 * - Cross-target insights for universal predictors
 */

import { MDAFeatureAnalyzer } from '../src/ml/mda-feature-analyzer.js';
import { SurveyDataManager } from './survey-data-manager.js';

/**
 * Handles MDA feature importance analysis requests
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
            featureMatrix,
            targetVariables,
            metadata = {},
            options = {}
        } = req.body;

        // Validate required parameters
        if (!surveyId) {
            return res.status(400).json({
                success: false,
                error: 'surveyId is required'
            });
        }

        if (!featureMatrix || !Array.isArray(featureMatrix) || featureMatrix.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'featureMatrix is required and must be a non-empty array'
            });
        }

        if (!targetVariables || typeof targetVariables !== 'object' || Object.keys(targetVariables).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'targetVariables object is required and must contain at least one target'
            });
        }

        // Validate feature matrix structure
        const matrixValidation = validateFeatureMatrix(featureMatrix);
        if (!matrixValidation.isValid) {
            return res.status(400).json({
                success: false,
                error: 'Invalid feature matrix structure',
                details: matrixValidation.errors
            });
        }

        // Validate target variables
        const targetValidation = validateTargetVariables(targetVariables, featureMatrix.length);
        if (!targetValidation.isValid) {
            return res.status(400).json({
                success: false,
                error: 'Invalid target variables',
                details: targetValidation.errors
            });
        }

        // Initialize components
        const analyzer = new MDAFeatureAnalyzer({
            trainRatio: options.trainRatio || (2/3),
            nEstimators: options.nEstimators || 100,
            maxDepth: options.maxDepth || 10,
            mdaRepetitions: options.mdaRepetitions || 10,
            significanceThreshold: options.significanceThreshold || 0.01,
            maxFeaturesSignificant: options.maxFeaturesSignificant || 5,
            maxFeaturesNonSignificant: options.maxFeaturesNonSignificant || 2,
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
            'mda_feature_analysis', 
            '3E',
            {
                sampleCount: featureMatrix.length,
                featureCount: featureMatrix[0]?.length || 0,
                targetCount: Object.keys(targetVariables).length,
                mdaRepetitions: options.mdaRepetitions || 10,
                analysisType: 'random_forest_mda'
            }
        );

        console.log(`Starting Phase 3E MDA feature analysis for survey ${surveyId}`);
        console.log(`Feature matrix: ${featureMatrix.length} samples x ${featureMatrix[0]?.length || 0} features`);
        console.log(`Target variables: ${Object.keys(targetVariables).join(', ')}`);

        // Merge survey context with provided metadata
        const fullMetadata = {
            featureNames: metadata.featureNames || 
                Array.from({length: featureMatrix[0]?.length || 0}, (_, i) => `feature_${i}`),
            painPleasureCategories: metadata.painPleasureCategories,
            roiTargets: metadata.roiTargets,
            ...metadata
        };

        const analysisContext = {
            surveyId: surveyId,
            target_demographic: survey.target_demographic,
            business_description: survey.business_description,
            dataset_name: survey.display_name
        };

        // Perform MDA feature importance analysis
        const analysisResults = await analyzer.performMDAAnalysis(
            featureMatrix,
            targetVariables,
            fullMetadata,
            analysisContext
        );

        // Store analysis results in database
        console.log('Storing MDA feature analysis results in database...');
        await dataManager.storeMDAResults(surveyId, analysisResults);

        // Complete analysis session
        const processingTime = Date.now() - startTime;
        await dataManager.completeAnalysisSession(sessionId, {
            records_processed: featureMatrix.length,
            llm_calls_made: 0, // ML analysis doesn't use LLM
            llm_tokens_used: 0,
            estimated_cost: 0.0,
            processing_time_seconds: Math.round(processingTime / 1000),
            results_summary: {
                targets_analyzed: Object.keys(targetVariables).length,
                total_features: analysisResults.summary.totalFeatures,
                significant_features: this.countSignificantFeatures(analysisResults.targetAnalysis),
                cross_target_features: analysisResults.crossTargetInsights.crossTargetFeatures.length,
                pain_pleasure_insights: analysisResults.painPleasureAnalysis ? 
                    analysisResults.painPleasureAnalysis.insights.length : 0
            }
        });

        // Prepare response
        const response = {
            success: true,
            data: {
                surveyId: surveyId,
                sessionId: sessionId,
                analysis: analysisResults,
                statistics: {
                    processingTimeMs: processingTime,
                    totalSamples: featureMatrix.length,
                    totalFeatures: fullMetadata.featureNames.length,
                    totalTargets: Object.keys(targetVariables).length,
                    trainSamples: analysisResults.summary.trainSamples,
                    testSamples: analysisResults.summary.testSamples
                },
                businessInsights: {
                    topUniversalPredictors: analysisResults.crossTargetInsights.universalPredictors.slice(0, 5),
                    painPleasureAnalysis: analysisResults.painPleasureAnalysis,
                    featureSelectionRecommendations: this.generateFeatureSelectionRecommendations(analysisResults),
                    modelPerformanceInsights: this.generateModelPerformanceInsights(analysisResults)
                },
                technicalSummary: {
                    ...analysisResults.technicalDetails,
                    processingTimeMs: processingTime,
                    analysisDate: new Date().toISOString()
                }
            },
            metadata: {
                phase: '3E',
                analysisType: 'mda_feature_importance',
                timestamp: new Date().toISOString(),
                mlFramework: 'RandomForest_MDA',
                apiVersion: '2025-01-15'
            }
        };

        console.log(`Phase 3E MDA analysis completed successfully`);
        console.log(`Analyzed ${Object.keys(targetVariables).length} targets with ${analysisResults.summary.totalFeatures} features`);
        console.log(`Identified ${this.countSignificantFeatures(analysisResults.targetAnalysis)} significant features`);
        console.log(`Total processing time: ${processingTime}ms`);

        res.status(200).json(response);

    } catch (error) {
        console.error('Phase 3E MDA Feature Analysis Error:', error);

        // Try to complete analysis session with error
        const processingTime = Date.now() - startTime;
        try {
            if (req.body.surveyId) {
                const dataManager = new SurveyDataManager();
                const sessionId = await dataManager.findActiveSession(req.body.surveyId, 'mda_feature_analysis');
                if (sessionId) {
                    await dataManager.failAnalysisSession(sessionId, error.message, {
                        processing_time_seconds: Math.round(processingTime / 1000),
                        sample_count: req.body.featureMatrix?.length || 0,
                        feature_count: req.body.featureMatrix?.[0]?.length || 0,
                        target_count: Object.keys(req.body.targetVariables || {}).length
                    });
                }
            }
        } catch (sessionError) {
            console.error('Failed to update analysis session:', sessionError);
        }

        // Determine error type and return appropriate response
        if (error.message.includes('insufficient')) {
            return res.status(422).json({
                success: false,
                error: 'Insufficient data for ML analysis',
                details: 'Need more samples or features for reliable feature importance calculation',
                phase: '3E'
            });
        }

        if (error.message.includes('validation')) {
            return res.status(400).json({
                success: false,
                error: 'Data validation failed',
                details: error.message,
                phase: '3E'
            });
        }

        if (error.message.includes('memory') || error.message.includes('timeout')) {
            return res.status(413).json({
                success: false,
                error: 'Analysis too complex',
                details: 'Dataset too large or complex for current processing limits',
                phase: '3E'
            });
        }

        if (error.message.includes('database')) {
            return res.status(500).json({
                success: false,
                error: 'Database operation failed',
                details: error.message,
                phase: '3E'
            });
        }

        // Generic error response
        res.status(500).json({
            success: false,
            error: 'MDA feature analysis failed',
            details: error.message,
            phase: '3E',
            processingTimeMs: processingTime
        });
    }
}

/**
 * Validate feature matrix structure
 */
function validateFeatureMatrix(featureMatrix) {
    const errors = [];
    
    if (!Array.isArray(featureMatrix)) {
        errors.push('Feature matrix must be an array');
        return { isValid: false, errors };
    }
    
    if (featureMatrix.length < 10) {
        errors.push('Feature matrix must contain at least 10 samples for reliable ML analysis');
    }
    
    const firstRowLength = featureMatrix[0]?.length;
    if (!firstRowLength || firstRowLength < 2) {
        errors.push('Each sample must contain at least 2 features');
    }
    
    // Check for consistent row lengths
    featureMatrix.forEach((sample, index) => {
        if (!Array.isArray(sample)) {
            errors.push(`Sample ${index}: must be an array`);
        } else if (sample.length !== firstRowLength) {
            errors.push(`Sample ${index}: inconsistent feature count (expected ${firstRowLength}, got ${sample.length})`);
        }
    });
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Validate target variables
 */
function validateTargetVariables(targetVariables, sampleCount) {
    const errors = [];
    
    if (typeof targetVariables !== 'object' || targetVariables === null) {
        errors.push('Target variables must be an object');
        return { isValid: false, errors };
    }
    
    const targetNames = Object.keys(targetVariables);
    if (targetNames.length === 0) {
        errors.push('At least one target variable is required');
    }
    
    targetNames.forEach(targetName => {
        const targetValues = targetVariables[targetName];
        
        if (!Array.isArray(targetValues)) {
            errors.push(`Target ${targetName}: must be an array`);
        } else {
            if (targetValues.length !== sampleCount) {
                errors.push(`Target ${targetName}: must have same length as feature matrix (${sampleCount})`);
            }
            
            // Check for sufficient variety in target values
            const uniqueValues = new Set(targetValues);
            if (uniqueValues.size < 2) {
                errors.push(`Target ${targetName}: must have at least 2 different values`);
            }
        }
    });
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Count significant features across all targets
 */
function countSignificantFeatures(targetAnalysis) {
    const significantFeatures = new Set();
    
    for (const targetResult of Object.values(targetAnalysis)) {
        targetResult.featureImportance.reported.significant.forEach(feature => {
            significantFeatures.add(feature.feature);
        });
    }
    
    return significantFeatures.size;
}

/**
 * Generate feature selection recommendations
 */
function generateFeatureSelectionRecommendations(analysisResults) {
    const recommendations = [];
    
    // Universal predictors recommendation
    const universalPredictors = analysisResults.crossTargetInsights.universalPredictors;
    if (universalPredictors.length > 0) {
        recommendations.push({
            type: 'universal_features',
            priority: 'high',
            title: 'Use Universal Predictors',
            description: `${universalPredictors.length} features predict multiple business outcomes`,
            features: universalPredictors.slice(0, 3).map(f => f.feature),
            action: 'Prioritize these features in production models for maximum impact'
        });
    }
    
    // Significance-based recommendation
    const significantCount = countSignificantFeatures(analysisResults.targetAnalysis);
    if (significantCount < analysisResults.summary.totalFeatures * 0.5) {
        recommendations.push({
            type: 'dimensionality_reduction',
            priority: 'medium',
            title: 'Reduce Feature Dimensionality',
            description: `Only ${significantCount} of ${analysisResults.summary.totalFeatures} features show statistical significance`,
            action: 'Focus on significant features to improve model performance and interpretability'
        });
    }
    
    return recommendations;
}

/**
 * Generate model performance insights
 */
function generateModelPerformanceInsights(analysisResults) {
    const insights = [];
    
    // Analyze model performance across targets
    const performances = Object.values(analysisResults.targetAnalysis)
        .map(result => result.modelPerformance.baselineAccuracy);
    
    const avgAccuracy = performances.reduce((sum, acc) => sum + acc, 0) / performances.length;
    const minAccuracy = Math.min(...performances);
    const maxAccuracy = Math.max(...performances);
    
    insights.push({
        type: 'model_performance',
        averageAccuracy: avgAccuracy,
        performanceRange: { min: minAccuracy, max: maxAccuracy },
        recommendation: avgAccuracy > 0.8 ? 
            'Strong predictive performance - models are production-ready' :
            'Moderate performance - consider feature engineering or additional data'
    });
    
    // Feature count vs performance insight
    const featureCount = analysisResults.summary.totalFeatures;
    const sampleCount = analysisResults.summary.totalSamples;
    const ratio = sampleCount / featureCount;
    
    if (ratio < 10) {
        insights.push({
            type: 'sample_feature_ratio',
            message: 'High feature-to-sample ratio may cause overfitting',
            recommendation: 'Consider feature selection or collect more data',
            priority: 'medium'
        });
    }
    
    return insights;
}