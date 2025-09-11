/**
 * 3-Stage Pipeline Analysis API Endpoint
 * Orchestrates the complete Universal Survey Digital Twins analysis through:
 * Stage 1: Statistical Data Analyst
 * Stage 2: Behavioral Statistician (Pain/Pleasure Points)
 * Stage 3: Marketing Expert (Evidence-Based Archetypes)
 */

import { createLogger } from '../src/utils/logger.js';
import StatisticalAnalyst from '../src/data_processing/statistical_analyst.js';
import PainPleasureAnalyst from '../src/data_processing/pain_pleasure_analyst.js';
import EvidenceBasedArchetypes from '../src/data_processing/evidence_based_archetypes.js';
import { uploadedDatasets, uploadedArchetypes } from './survey-datasets.js';
import Anthropic from '@anthropic-ai/sdk';

const logger = createLogger('ThreeStageAnalysis');

// Initialize Claude client
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * Main handler for 3-stage analysis
 */
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        console.log('[DEBUG] Three-stage analysis endpoint called');
        const { datasetId, targetDemographic, surveyContext, surveyData, datasetName, description, options = {} } = req.body;

        let dataset, datasetInfo;
        
        // Handle direct survey data or dataset ID
        if (surveyData && !datasetId) {
            // Direct survey data provided - create temporary dataset
            datasetInfo = {
                id: Date.now(),
                name: datasetName || 'Direct Upload',
                target_demographic: targetDemographic || 'Unknown',
                description: description || '',
                survey_data: surveyData,
                processing_status: 'ready',
                created_at: new Date().toISOString()
            };
            console.log('[DEBUG] Processing direct survey data');
        } else if (datasetId) {
            // Dataset ID provided - fetch from storage
            dataset = uploadedDatasets.get(parseInt(datasetId));
            if (!dataset) {
                return res.status(404).json({ 
                    error: 'Dataset not found' 
                });
            }
            
            if (!dataset.survey_data) {
                return res.status(400).json({ 
                    error: 'Dataset does not contain processed survey data' 
                });
            }
            
            datasetInfo = dataset;
            console.log('[DEBUG] Processing dataset ID:', datasetId);
        } else {
            return res.status(400).json({ 
                error: 'Either datasetId or surveyData is required' 
            });
        }

        logger.info(`Starting 3-stage analysis for dataset ${datasetInfo.id}: ${datasetInfo.name}`);

        // Initialize analysis stages
        const stage1Analyst = new StatisticalAnalyst(anthropic);
        const stage2Analyst = new PainPleasureAnalyst(anthropic);
        const stage3Analyst = new EvidenceBasedArchetypes(anthropic);

        // Update dataset status (if it's a stored dataset)
        if (dataset) {
            dataset.processing_status = 'analyzing_stage_1';
            dataset.updated_at = new Date().toISOString();
        }

        // STAGE 1: Statistical Data Analyst
        logger.info('Stage 1: Running Statistical Data Analyst...');
        let stage1Results;
        
        try {
            stage1Results = await stage1Analyst.analyzeStatisticalDiscrimination(
                datasetInfo.survey_data,
                targetDemographic || datasetInfo.target_demographic,
                surveyContext || `Analysis of ${datasetInfo.name}`
            );
            
            logger.info(`Stage 1 completed with ${stage1Results.discriminatory_questions?.length || 0} discriminatory questions identified`);
        } catch (stage1Error) {
            logger.error('Stage 1 failed', stage1Error);
            if (dataset) {
                dataset.processing_status = 'failed';
                dataset.error_details = `Stage 1 failed: ${stage1Error.message}`;
            }
            
            return res.status(500).json({
                error: 'Statistical analysis failed',
                details: stage1Error.message,
                stage: 'stage_1'
            });
        }

        // Update status for Stage 2
        if (dataset) {
            dataset.processing_status = 'analyzing_stage_2';
            dataset.updated_at = new Date().toISOString();
        }

        // STAGE 2: Behavioral Statistician (Pain/Pleasure Points)
        logger.info('Stage 2: Running Behavioral Statistician...');
        let stage2Results;
        
        try {
            stage2Results = await stage2Analyst.identifyPainPleasurePoints(
                stage1Results,
                datasetInfo.survey_data
            );
            
            const painPleasureCount = stage2Results.pain_pleasure_points?.length || 0;
            logger.info(`Stage 2 completed with ${painPleasureCount} pain/pleasure points identified`);
        } catch (stage2Error) {
            logger.error('Stage 2 failed', stage2Error);
            if (dataset) {
                dataset.processing_status = 'failed';
                dataset.error_details = `Stage 2 failed: ${stage2Error.message}`;
            }
            
            return res.status(500).json({
                error: 'Behavioral analysis failed',
                details: stage2Error.message,
                stage: 'stage_2',
                stage1_results: stage1Results // Include partial results
            });
        }

        // Update status for Stage 3
        if (dataset) {
            dataset.processing_status = 'analyzing_stage_3';
            dataset.updated_at = new Date().toISOString();
        }

        // STAGE 3: Marketing Expert (Evidence-Based Archetypes)
        logger.info('Stage 3: Running Marketing Expert...');
        let stage3Results;
        
        try {
            stage3Results = await stage3Analyst.generateEvidenceBasedArchetypes(
                stage1Results,
                stage2Results
            );
            
            const archetypeCount = stage3Results.archetypes?.length || 0;
            logger.info(`Stage 3 completed with ${archetypeCount} evidence-based archetypes generated`);
        } catch (stage3Error) {
            logger.error('Stage 3 failed', stage3Error);
            if (dataset) {
                dataset.processing_status = 'failed';
                dataset.error_details = `Stage 3 failed: ${stage3Error.message}`;
            }
            
            return res.status(500).json({
                error: 'Archetype generation failed',
                details: stage3Error.message,
                stage: 'stage_3',
                stage1_results: stage1Results,
                stage2_results: stage2Results
            });
        }

        // Compile complete analysis results
        const analysisResults = {
            dataset_id: datasetInfo.id,
            dataset_name: datasetInfo.name,
            target_demographic: targetDemographic || datasetInfo.target_demographic,
            survey_context: surveyContext || `Analysis of ${datasetInfo.name}`,
            stage1_results: stage1Results,
            stage2_results: stage2Results,
            stage3_results: stage3Results,
            analysis_summary: {
                total_questions: datasetInfo.survey_data.questions?.length || 0,
                total_responses: datasetInfo.survey_data.responses?.length || 0,
                discriminatory_questions: stage1Results.discriminatory_questions?.length || 0,
                pain_pleasure_points: stage2Results.pain_pleasure_points?.length || 0,
                generated_archetypes: stage3Results.archetypes?.length || 0,
                overall_confidence: calculateOverallConfidence(stage1Results, stage2Results, stage3Results),
                implementation_readiness: stage3Results.implementation_guide ? 'READY' : 'PENDING'
            },
            processing_metadata: {
                start_time: datasetInfo.created_at || new Date().toISOString(),
                end_time: new Date().toISOString(),
                processing_duration: calculateProcessingDuration(datasetInfo.created_at || new Date().toISOString()),
                stages_completed: 3,
                analysis_version: '3.0.0'
            }
        };

        // Store results
        uploadedArchetypes.set(parseInt(datasetInfo.id), {
            ...analysisResults,
            created_at: new Date().toISOString()
        });

        // Update dataset status (if it's a stored dataset)
        if (dataset) {
            dataset.processing_status = 'completed';
            dataset.analysis_completed_at = new Date().toISOString();
            dataset.updated_at = new Date().toISOString();
            dataset.archetypes_generated = stage3Results.archetypes?.length || 0;
        }
        
        logger.info(`3-stage analysis completed successfully for dataset ${datasetInfo.id}`);

        // Return comprehensive results
        res.json({
            success: true,
            message: '3-stage analysis completed successfully',
            dataset_id: datasetInfo.id,
            analysis_results: analysisResults,
            next_steps: {
                scoring_available: true,
                digital_twin_ready: true,
                implementation_guide: stage3Results.implementation_guide || null
            }
        });

    } catch (error) {
        logger.error('3-stage analysis failed', error);
        
        // Update dataset status on general failure
        if (req.body.datasetId) {
            const dataset = uploadedDatasets.get(parseInt(req.body.datasetId));
            if (dataset) {
                dataset.processing_status = 'failed';
                dataset.error_details = `General analysis failure: ${error.message}`;
                dataset.updated_at = new Date().toISOString();
            }
        }
        
        res.status(500).json({
            error: '3-stage analysis failed',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

/**
 * Calculate overall confidence across all three stages
 */
function calculateOverallConfidence(stage1Results, stage2Results, stage3Results) {
    const stage1Confidence = stage1Results.confidence_level || 0;
    const stage2Confidence = stage2Results.statistical_validation?.overall_confidence || 0;
    const stage3Confidence = stage3Results.validation_summary?.statistical_confidence || 0;
    
    // Weight Stage 1 highest as it's the foundation
    return (stage1Confidence * 0.4) + (stage2Confidence * 0.3) + (stage3Confidence * 0.3);
}

/**
 * Calculate processing duration in a human-readable format
 */
function calculateProcessingDuration(startTime) {
    const start = new Date(startTime);
    const end = new Date();
    const durationMs = end - start;
    
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    
    if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    } else {
        return `${seconds}s`;
    }
}

/**
 * Get analysis status for a dataset
 */
export async function getAnalysisStatus(req, res) {
    try {
        const { datasetId } = req.params;
        
        const dataset = uploadedDatasets.get(parseInt(datasetId));
        if (!dataset) {
            return res.status(404).json({ error: 'Dataset not found' });
        }
        
        const analysisResults = uploadedArchetypes.get(parseInt(datasetId));
        
        res.json({
            dataset_id: datasetId,
            dataset_name: dataset.name,
            processing_status: dataset.processing_status,
            analysis_completed_at: dataset.analysis_completed_at,
            error_details: dataset.error_details,
            analysis_available: !!analysisResults,
            results_summary: analysisResults ? {
                discriminatory_questions: analysisResults.stage1_results?.discriminatory_questions?.length || 0,
                pain_pleasure_points: analysisResults.stage2_results?.pain_pleasure_points?.length || 0,
                generated_archetypes: analysisResults.stage3_results?.archetypes?.length || 0,
                overall_confidence: analysisResults.analysis_summary?.overall_confidence || 0
            } : null
        });
        
    } catch (error) {
        logger.error('Failed to get analysis status', error);
        res.status(500).json({
            error: 'Failed to get analysis status',
            details: error.message
        });
    }
}

/**
 * Get detailed analysis results
 */
export async function getAnalysisResults(req, res) {
    try {
        const { datasetId } = req.params;
        const { stage } = req.query; // Optional: filter by specific stage
        
        const analysisResults = uploadedArchetypes.get(parseInt(datasetId));
        if (!analysisResults) {
            return res.status(404).json({ 
                error: 'Analysis results not found for this dataset' 
            });
        }
        
        // Return specific stage results if requested
        if (stage) {
            const stageKey = `stage${stage}_results`;
            if (!analysisResults[stageKey]) {
                return res.status(404).json({ 
                    error: `Stage ${stage} results not found` 
                });
            }
            
            return res.json({
                dataset_id: datasetId,
                stage: parseInt(stage),
                results: analysisResults[stageKey],
                metadata: analysisResults.processing_metadata
            });
        }
        
        // Return complete analysis results
        res.json(analysisResults);
        
    } catch (error) {
        logger.error('Failed to get analysis results', error);
        res.status(500).json({
            error: 'Failed to get analysis results',
            details: error.message
        });
    }
}

/**
 * Export analysis results in various formats
 */
export async function exportAnalysisResults(req, res) {
    try {
        const { datasetId } = req.params;
        const { format = 'json' } = req.query; // json, csv, xlsx
        
        const analysisResults = uploadedArchetypes.get(parseInt(datasetId));
        if (!analysisResults) {
            return res.status(404).json({ 
                error: 'Analysis results not found for this dataset' 
            });
        }
        
        if (format === 'json') {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="analysis_${datasetId}.json"`);
            return res.json(analysisResults);
        }
        
        // TODO: Implement CSV and Excel export formats
        res.status(501).json({ 
            error: `Export format '${format}' not yet implemented`,
            available_formats: ['json']
        });
        
    } catch (error) {
        logger.error('Failed to export analysis results', error);
        res.status(500).json({
            error: 'Failed to export analysis results',
            details: error.message
        });
    }
}