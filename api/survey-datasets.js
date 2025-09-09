import { createLogger } from '../src/utils/logger.js';
import { AppError, ValidationError } from '../src/utils/error-handler.js';
import { getIntelligentDataPreprocessor } from '../src/data_processing/intelligent_data_preprocessor.js';
import path from 'path';
import fs from 'fs';

const logger = createLogger('SurveyDatasetsAPI');

// In-memory storage for uploaded datasets only
const uploadedDatasets = new Map();
const uploadedArchetypes = new Map();

// Initialize with pre-loaded datasets - async but don't block startup
initializePreloadedDatasets().catch(error => {
    logger.error('Failed to initialize preloaded datasets during startup:', error);
});

export default async function handler(req, res) {
    try {
        if (req.method === 'GET') {
            return handleGetDatasets(req, res);
        } else if (req.method === 'POST') {
            return handleCreateDataset(req, res);
        } else {
            return res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error) {
        logger.error('Survey datasets API error', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

async function handleGetDatasets(req, res) {
    const { datasetId } = req.query;

    if (datasetId) {
        // Get specific dataset with archetypes
        const dataset = uploadedDatasets.get(parseInt(datasetId));
        if (!dataset) {
            return res.status(404).json({ error: `Dataset ${datasetId} not found` });
        }

        // Get archetypes for this dataset
        const archetypes = Array.from(uploadedArchetypes.values())
            .filter(archetype => archetype.dataset_id === parseInt(datasetId));

        logger.info(`Retrieved dataset ${datasetId} with ${archetypes.length} archetypes`);

        return res.json({
            success: true,
            dataset: {
                ...dataset,
                archetypes: archetypes
            }
        });
    } else {
        // Get all uploaded datasets with summary info
        const datasets = Array.from(uploadedDatasets.values()).map(dataset => {
            const archetypes = Array.from(uploadedArchetypes.values())
                .filter(archetype => archetype.dataset_id === dataset.id);

            return {
                ...dataset,
                archetypes: archetypes.map(archetype => ({
                    id: archetype.id,
                    name: archetype.name,
                    percentage: archetype.population_percentage,
                    description: archetype.description
                }))
            };
        });

        logger.info(`Retrieved ${datasets.length} uploaded datasets`);

        return res.json({
            success: true,
            datasets: datasets,
            message: datasets.length === 0 ? "No datasets uploaded yet. Please upload a CSV or XLSX file to get started." : null
        });
    }
}

async function handleCreateDataset(req, res) {
    const { name, targetDemographic, description, surveyData } = req.body;

    // Validation
    if (!name) {
        return res.status(400).json({ error: 'Dataset name is required' });
    }

    if (!targetDemographic) {
        return res.status(400).json({ error: 'Target demographic is required' });
    }

    // Create new dataset
    const newDatasetId = Array.from(uploadedDatasets.keys()).length > 0 
        ? Math.max(...Array.from(uploadedDatasets.keys())) + 1 
        : 1;
    const newDataset = {
        id: newDatasetId,
        name: name,
        target_demographic: targetDemographic,
        description: description || '',
        total_questions: surveyData?.questions?.length || 0,
        total_responses: surveyData?.responses?.length || 0,
        processing_status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    uploadedDatasets.set(newDatasetId, newDataset);

    logger.info(`Created new dataset: ${name} for ${targetDemographic}`);

    return res.json({
        success: true,
        dataset: newDataset,
        message: `Dataset '${name}' created successfully`
    });
}

// Named export for direct use in other modules
async function initializePreloadedDatasets() {
    try {
        logger.info('Initializing pre-loaded datasets with intelligent preprocessing...');
        
        // Define pre-loaded datasets with their file paths
        const preloadedDatasets = [
            {
                id: 1001,
                name: 'Parents Survey - Detailed Analysis',
                target_demographic: 'Parents with children aged 0-18, primarily mothers',
                description: 'Comprehensive survey of parenting behaviors, concerns, spending patterns, and lifestyle choices',
                file_path: './data/datasets/mums/Detail_Parents Survey.xlsx',
                processing_status: 'processing',
                created_at: '2024-01-15T10:30:00.000Z',
                updated_at: new Date().toISOString(),
                file_info: {
                    original_name: 'Detail_Parents Survey.xlsx',
                    file_type: '.xlsx'
                },
                is_preloaded: true
            },
            {
                id: 1002,
                name: 'Surf Clothing Consumer Study',
                target_demographic: 'Active lifestyle consumers aged 18-45, surf culture enthusiasts',
                description: 'Analysis of surf clothing preferences, brand loyalty, and purchasing behaviors',
                file_path: './data/datasets/surf-clothing/raw/All_Surf_detail 2.xlsx',
                processing_status: 'processing',
                created_at: '2024-02-01T14:15:00.000Z',
                updated_at: new Date().toISOString(),
                file_info: {
                    original_name: 'All_Surf_detail 2.xlsx',
                    file_type: '.xlsx'
                },
                is_preloaded: true
            }
        ];

        // Process each dataset with intelligent data preprocessing
        const preprocessor = await getIntelligentDataPreprocessor();
        
        for (const dataset of preloadedDatasets) {
            try {
                const filePath = path.resolve(dataset.file_path);
                
                // Check if file exists
                if (fs.existsSync(filePath)) {
                    logger.info(`Processing dataset file: ${dataset.file_path}`);
                    
                    // Use intelligent preprocessing to extract real data
                    const processingResult = await preprocessor.processFile(filePath);
                    
                    if (processingResult.success) {
                        // Update dataset with real data from Excel file
                        dataset.survey_data = {
                            questions: processingResult.data.headers.map((header, index) => ({
                                id: `q${index + 1}`,
                                text: header,
                                type: inferQuestionType(header),
                                required: false
                            })),
                            responses: processingResult.data.responses,
                            fields: processingResult.data.fields
                        };
                        
                        // Update metadata with real counts
                        dataset.total_questions = processingResult.data.headers.length;
                        dataset.total_responses = processingResult.data.responses.length;
                        dataset.processing_status = 'completed';
                        dataset.wrangling_report = processingResult.wranglingReport;
                        dataset.file_info.file_size = fs.statSync(filePath).size;
                        
                        logger.info(`Successfully processed ${dataset.name}: ${dataset.total_questions} questions, ${dataset.total_responses} responses`);
                    } else {
                        throw new Error('Processing failed');
                    }
                } else {
                    logger.warn(`File not found: ${dataset.file_path} - creating placeholder`);
                    dataset.survey_data = {
                        questions: [],
                        responses: [],
                        fields: {}
                    };
                    dataset.total_questions = 0;
                    dataset.total_responses = 0;
                    dataset.processing_status = 'file_not_found';
                }
            } catch (error) {
                logger.error(`Failed to process dataset ${dataset.name}:`, error);
                dataset.processing_status = 'failed';
                dataset.error_message = error.message;
                dataset.survey_data = {
                    questions: [],
                    responses: [],
                    fields: {}
                };
                dataset.total_questions = 0;
                dataset.total_responses = 0;
            }

            uploadedDatasets.set(dataset.id, dataset);
            logger.info(`Loaded dataset: ${dataset.name} (ID: ${dataset.id}) - Status: ${dataset.processing_status}`);
        }

        logger.info(`Successfully initialized ${preloadedDatasets.length} pre-loaded datasets with intelligent preprocessing`);

    } catch (error) {
        logger.error('Failed to initialize pre-loaded datasets:', error);
        // Don't throw - app should still work without pre-loaded data
    }
}

// Helper function to infer question type from header text
function inferQuestionType(header) {
    const lowerHeader = header.toLowerCase();
    if (lowerHeader.includes('age') || lowerHeader.includes('how many') || lowerHeader.includes('number')) {
        return 'spending';
    } else if (lowerHeader.includes('often') || lowerHeader.includes('frequency')) {
        return 'behavior';
    } else {
        return 'values';
    }
}

// Mock data generation functions removed - now using intelligent data preprocessing

export { uploadedDatasets, uploadedArchetypes };