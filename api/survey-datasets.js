import { createLogger } from '../src/utils/logger.js';
import { AppError, ValidationError } from '../src/utils/error-handler.js';

const logger = createLogger('SurveyDatasetsAPI');

// In-memory storage for uploaded datasets only
const uploadedDatasets = new Map();
const uploadedArchetypes = new Map();

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
export { uploadedDatasets, uploadedArchetypes };