import { createLogger } from '../src/utils/logger.js';
import { AppError, ValidationError } from '../src/utils/error-handler.js';

const logger = createLogger('SurveyDatasetsAPI');

// In-memory storage for demo purposes (will be replaced with database)
const mockDatasets = new Map();
const mockArchetypes = new Map();

// Initialize with demo data
initializeDemoData();

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
        const dataset = mockDatasets.get(parseInt(datasetId));
        if (!dataset) {
            return res.status(404).json({ error: `Dataset ${datasetId} not found` });
        }

        // Get archetypes for this dataset
        const archetypes = Array.from(mockArchetypes.values())
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
        // Get all datasets with summary info
        const datasets = Array.from(mockDatasets.values()).map(dataset => {
            const archetypes = Array.from(mockArchetypes.values())
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

        logger.info(`Retrieved ${datasets.length} datasets`);

        return res.json({
            success: true,
            datasets: datasets
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
    const newDatasetId = Math.max(...Array.from(mockDatasets.keys())) + 1;
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

    mockDatasets.set(newDatasetId, newDataset);

    logger.info(`Created new dataset: ${name} for ${targetDemographic}`);

    return res.json({
        success: true,
        dataset: newDataset,
        message: `Dataset '${name}' created successfully`
    });
}

function initializeDemoData() {
    // Mother survey dataset
    mockDatasets.set(1, {
        id: 1,
        name: "Mother Consumer Survey 2025",
        target_demographic: "mothers",
        description: "Comprehensive survey of mother consumer behavior, purchasing decisions, and brand preferences across categories including baby products, household goods, and family services.",
        total_questions: 148,
        total_responses: 523,
        processing_status: 'completed',
        created_at: "2025-09-01T10:00:00Z",
        updated_at: "2025-09-09T15:30:00Z"
    });

    // Retirees survey dataset
    mockDatasets.set(2, {
        id: 2,
        name: "Retiree Lifestyle Survey 2025",
        target_demographic: "retirees",
        description: "Study of retiree spending patterns, lifestyle choices, healthcare decisions, and financial planning preferences.",
        total_questions: 112,
        total_responses: 387,
        processing_status: 'completed',
        created_at: "2025-08-15T09:00:00Z",
        updated_at: "2025-09-05T11:20:00Z"
    });

    // Professionals survey dataset
    mockDatasets.set(3, {
        id: 3,
        name: "Professional Development Survey 2025",
        target_demographic: "professionals",
        description: "Survey of working professionals covering career development, work-life balance, technology adoption, and professional services preferences.",
        total_questions: 95,
        total_responses: 612,
        processing_status: 'processing',
        created_at: "2025-09-08T14:00:00Z",
        updated_at: "2025-09-09T16:45:00Z"
    });

    // Mother archetypes
    mockArchetypes.set(1, {
        id: 1,
        dataset_id: 1,
        name: "Conscious Mothers",
        description: "Health and environmentally-focused mothers who prioritize quality and safety over price",
        population_percentage: 18.5,
        spending_propensity: 0.8,
        characteristics: {
            core_traits: ["health-conscious", "environmentally aware", "safety-focused", "quality-oriented"],
            decision_drivers: ["child safety", "health benefits", "environmental impact", "long-term value"],
            pain_points: ["information overload", "time constraints", "conflicting expert advice"]
        },
        reference_frameworks: {
            lohas_alignment: "Leader",
            generational_fit: "Millennial mothers",
            psychographic_profile: "values-driven, research-oriented"
        }
    });

    mockArchetypes.set(2, {
        id: 2,
        dataset_id: 1,
        name: "Budget-Smart Mothers",
        description: "Price-conscious mothers who seek maximum value while managing tight family budgets",
        population_percentage: 32.1,
        spending_propensity: 0.4,
        characteristics: {
            core_traits: ["price-conscious", "practical", "resourceful", "family-budget focused"],
            decision_drivers: ["value for money", "family budget constraints", "multi-purpose benefits"],
            pain_points: ["limited budget", "competing family expenses", "finding good deals"]
        },
        reference_frameworks: {
            lohas_alignment: "Laggard",
            generational_fit: "Gen X mothers",
            psychographic_profile: "pragmatic, cost-focused"
        }
    });

    mockArchetypes.set(3, {
        id: 3,
        dataset_id: 1,
        name: "Time-Pressed Mothers",
        description: "Busy working mothers who prioritize convenience and efficiency in all purchasing decisions",
        population_percentage: 28.7,
        spending_propensity: 0.7,
        characteristics: {
            core_traits: ["busy", "efficiency-focused", "convenience-seeking", "multi-tasking"],
            decision_drivers: ["time-saving", "convenience", "ease of use", "quick solutions"],
            pain_points: ["lack of time", "overwhelming choices", "juggling responsibilities"]
        },
        reference_frameworks: {
            lohas_alignment: "Learner",
            generational_fit: "Millennial working mothers",
            psychographic_profile: "efficiency-driven, convenience-oriented"
        }
    });

    mockArchetypes.set(4, {
        id: 4,
        dataset_id: 1,
        name: "Social Mothers",
        description: "Community-oriented mothers who value peer recommendations and social validation in purchasing",
        population_percentage: 20.7,
        spending_propensity: 0.6,
        characteristics: {
            core_traits: ["community-oriented", "socially connected", "peer-influenced", "sharing-focused"],
            decision_drivers: ["peer recommendations", "community approval", "social benefits"],
            pain_points: ["social pressure", "keeping up with trends", "information from multiple sources"]
        },
        reference_frameworks: {
            lohas_alignment: "Leaning",
            generational_fit: "Millennial social mothers",
            psychographic_profile: "socially-driven, community-focused"
        }
    });

    // Retiree archetypes
    mockArchetypes.set(5, {
        id: 5,
        dataset_id: 2,
        name: "Active Retirees",
        description: "Health-conscious retirees focused on maintaining active lifestyles and trying new experiences",
        population_percentage: 24.3,
        spending_propensity: 0.7,
        characteristics: {
            core_traits: ["active", "health-conscious", "experience-seeking", "socially engaged"],
            decision_drivers: ["health benefits", "active lifestyle", "social engagement", "new experiences"],
            pain_points: ["health concerns", "fixed income", "staying relevant"]
        },
        reference_frameworks: {
            lohas_alignment: "Leader",
            generational_fit: "Baby Boomer",
            psychographic_profile: "active-aging, experience-focused"
        }
    });

    mockArchetypes.set(6, {
        id: 6,
        dataset_id: 2,
        name: "Security-Focused Retirees",
        description: "Conservative retirees prioritizing financial security and familiar, trusted brands",
        population_percentage: 41.2,
        spending_propensity: 0.3,
        characteristics: {
            core_traits: ["conservative", "security-focused", "brand-loyal", "risk-averse"],
            decision_drivers: ["financial security", "proven track record", "minimal risk", "trusted brands"],
            pain_points: ["financial anxiety", "technology complexity", "changing world"]
        },
        reference_frameworks: {
            lohas_alignment: "Laggard",
            generational_fit: "Silent Generation",
            psychographic_profile: "security-oriented, traditional"
        }
    });

    mockArchetypes.set(7, {
        id: 7,
        dataset_id: 2,
        name: "Value-Seeking Retirees",
        description: "Practical retirees who carefully research purchases to maximize value on fixed incomes",
        population_percentage: 34.5,
        spending_propensity: 0.5,
        characteristics: {
            core_traits: ["practical", "research-oriented", "value-conscious", "patient"],
            decision_drivers: ["value for money", "thorough research", "long-term utility", "quality"],
            pain_points: ["fixed income", "overwhelming choices", "product complexity"]
        },
        reference_frameworks: {
            lohas_alignment: "Learner",
            generational_fit: "Baby Boomer",
            psychographic_profile: "value-driven, methodical"
        }
    });
}

// Named export for direct use in other modules
export { mockDatasets, mockArchetypes };