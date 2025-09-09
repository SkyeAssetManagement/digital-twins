import { createLogger } from '../src/utils/logger.js';
import { AppError, ValidationError } from '../src/utils/error-handler.js';
import path from 'path';
import fs from 'fs';

const logger = createLogger('SurveyDatasetsAPI');

// In-memory storage for uploaded datasets only
const uploadedDatasets = new Map();
const uploadedArchetypes = new Map();

// Initialize with pre-loaded datasets
initializePreloadedDatasets();

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
function initializePreloadedDatasets() {
    try {
        logger.info('Initializing pre-loaded datasets...');
        
        // Define pre-loaded datasets with their file paths
        const preloadedDatasets = [
            {
                id: 1001,
                name: 'Parents Survey - Detailed Analysis',
                target_demographic: 'Parents with children aged 0-18, primarily mothers',
                description: 'Comprehensive survey of parenting behaviors, concerns, spending patterns, and lifestyle choices',
                file_path: './data/datasets/mums/Detail_Parents Survey.xlsx',
                total_questions: 45, // Estimated - would be calculated from actual file
                total_responses: 285, // Estimated - would be calculated from actual file
                processing_status: 'completed',
                created_at: '2024-01-15T10:30:00.000Z',
                updated_at: new Date().toISOString(),
                file_info: {
                    original_name: 'Detail_Parents Survey.xlsx',
                    file_type: '.xlsx',
                    file_size: 156789 // Would be actual file size
                },
                is_preloaded: true
            },
            {
                id: 1002,
                name: 'Surf Clothing Consumer Study',
                target_demographic: 'Active lifestyle consumers aged 18-45, surf culture enthusiasts',
                description: 'Analysis of surf clothing preferences, brand loyalty, and purchasing behaviors',
                file_path: './data/datasets/surf-clothing/raw/All_Surf_detail 2.xlsx',
                total_questions: 38,
                total_responses: 427,
                processing_status: 'completed',
                created_at: '2024-02-01T14:15:00.000Z',
                updated_at: new Date().toISOString(),
                file_info: {
                    original_name: 'All_Surf_detail 2.xlsx',
                    file_type: '.xlsx',
                    file_size: 203456
                },
                is_preloaded: true
            }
        ];

        // Add mock survey data structure for each preloaded dataset
        preloadedDatasets.forEach(dataset => {
            // Add mock survey data structure (in real implementation, would parse Excel file)
            dataset.survey_data = {
                questions: generateMockQuestions(dataset.total_questions),
                responses: [], // Would be populated from actual Excel parsing
                fields: generateMockFields(dataset.total_questions)
            };

            // Check if file actually exists (optional - for development)
            try {
                if (fs.existsSync(dataset.file_path)) {
                    logger.info(`Pre-loaded dataset file found: ${dataset.file_path}`);
                } else {
                    logger.warn(`Pre-loaded dataset file not found: ${dataset.file_path} - using mock data`);
                }
            } catch (error) {
                logger.warn(`Cannot check file existence: ${dataset.file_path} - using mock data`);
            }

            uploadedDatasets.set(dataset.id, dataset);
            logger.info(`Pre-loaded dataset: ${dataset.name} (ID: ${dataset.id})`);
        });

        logger.info(`Successfully initialized ${preloadedDatasets.length} pre-loaded datasets`);

    } catch (error) {
        logger.error('Failed to initialize pre-loaded datasets:', error);
        // Don't throw - app should still work without pre-loaded data
    }
}

function generateMockQuestions(count) {
    const questionTypes = [
        'How important is [factor] to you when [context]?',
        'How often do you [behavior]?',
        'What is your preferred [choice] for [scenario]?',
        'How much would you spend on [product/service]?',
        'Which statement best describes your [attitude/belief]?'
    ];

    const questions = [];
    for (let i = 1; i <= count; i++) {
        questions.push({
            id: `q${i}`,
            text: questionTypes[i % questionTypes.length].replace('[factor]', 'quality').replace('[context]', 'making purchases'),
            type: i % 4 === 0 ? 'spending' : i % 3 === 0 ? 'behavior' : 'values',
            required: Math.random() > 0.3
        });
    }
    return questions;
}

function generateMockFields(count) {
    const fields = {};
    for (let i = 1; i <= count; i++) {
        fields[`q${i}`] = {
            title: `Question ${i}`,
            type: i % 4 === 0 ? 'number' : 'text',
            required: Math.random() > 0.3
        };
    }
    return fields;
}

export { uploadedDatasets, uploadedArchetypes };