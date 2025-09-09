/**
 * API endpoint for retrieving data wrangling reports
 * Shows what preprocessing was done with examples
 */

import { createLogger } from '../src/utils/logger.js';
import { AppError } from '../src/utils/error-handler.js';
import { getIntelligentDataPreprocessor } from '../src/data_processing/intelligent_data_preprocessor.js';
import { uploadedDatasets } from './survey-datasets.js';

const logger = createLogger('DataWranglingReportAPI');

export default async function handler(req, res) {
    try {
        if (req.method !== 'GET') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        const { datasetId, reportId } = req.query;

        if (!datasetId) {
            return res.status(400).json({ error: 'Dataset ID is required' });
        }

        // Get dataset
        const dataset = uploadedDatasets.get(parseInt(datasetId));
        if (!dataset) {
            return res.status(404).json({ error: `Dataset ${datasetId} not found` });
        }

        // Check if dataset has wrangling report
        if (!dataset.wrangling_report) {
            return res.status(404).json({ 
                error: 'No data wrangling report available for this dataset' 
            });
        }

        // Enhance report with additional examples
        const enhancedReport = {
            ...dataset.wrangling_report,
            datasetInfo: {
                name: dataset.name,
                originalFile: dataset.file_info.original_name,
                totalQuestions: dataset.total_questions,
                totalResponses: dataset.total_responses,
                processingStatus: dataset.processing_status
            },
            headerExamples: generateHeaderExamples(dataset),
            dataExamples: generateDataExamples(dataset)
        };

        logger.info(`Retrieved wrangling report for dataset ${datasetId}`);

        return res.json({
            success: true,
            report: enhancedReport,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Failed to retrieve wrangling report', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

/**
 * Generate examples showing header transformation
 */
function generateHeaderExamples(dataset) {
    const questions = dataset.survey_data?.questions || [];
    
    return questions.slice(0, 5).map((question, index) => ({
        questionNumber: index + 1,
        before: `Question ${index + 1}`, // What the mock system would have shown
        after: question.text,
        transformation: question.text.includes('?') ? 'Extracted actual question text' : 'Cleaned header text'
    }));
}

/**
 * Generate examples showing data extraction
 */
function generateDataExamples(dataset) {
    const responses = dataset.survey_data?.responses || [];
    const questions = dataset.survey_data?.questions || [];
    
    if (responses.length === 0 || questions.length === 0) {
        return [];
    }

    // Show first response as example
    const firstResponse = responses[0];
    const exampleFields = questions.slice(0, 3); // First 3 questions
    
    return exampleFields.map(question => ({
        question: question.text,
        sampleValue: firstResponse[question.text] || 'No response',
        fieldType: question.type || 'text'
    }));
}