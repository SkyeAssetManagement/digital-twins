/**
 * API endpoint for retrieving data wrangling reports
 * Shows what preprocessing was done with examples
 */

import { createLogger } from '../src/utils/logger.js';
import { AppError } from '../src/utils/error-handler.js';
import { getIntelligentDataPreprocessor } from '../src/data_processing/intelligent_data_preprocessor.js';
import { uploadedDatasets, initializationPromise, isInitialized } from './survey-datasets.js';

const logger = createLogger('DataWranglingReportAPI');

export default async function handler(req, res) {
    try {
        // Ensure initialization is complete before processing requests
        if (!isInitialized && initializationPromise) {
            logger.info('Waiting for dataset initialization to complete for wrangling report...');
            await initializationPromise;
        }
        
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

        // Debug log the dataset structure
        logger.info(`Dataset structure for ${datasetId}:`, {
            hasWranglingReport: !!dataset.wrangling_report,
            hasSurveyData: !!dataset.survey_data,
            questionsCount: dataset.survey_data?.questions?.length || 0,
            responsesCount: dataset.survey_data?.responses?.length || 0,
            questionsType: Array.isArray(dataset.survey_data?.questions) ? 'array' : typeof dataset.survey_data?.questions,
            responsesType: Array.isArray(dataset.survey_data?.responses) ? 'array' : typeof dataset.survey_data?.responses,
            firstQuestion: dataset.survey_data?.questions?.[0],
            firstResponse: dataset.survey_data?.responses?.[0]
        });

        // Check if dataset has wrangling report
        if (!dataset.wrangling_report) {
            return res.status(404).json({ 
                error: 'No data wrangling report available for this dataset' 
            });
        }

        // Enhance report with additional examples
        let enhancedReport;
        try {
            logger.info('Generating header examples...');
            const headerExamples = generateHeaderExamples(dataset);
            logger.info(`Generated ${headerExamples.length} header examples`);
            
            logger.info('Generating data examples...');
            const dataExamples = generateDataExamples(dataset);
            logger.info(`Generated ${dataExamples.length} data examples`);
            
            enhancedReport = {
                ...dataset.wrangling_report,
                datasetInfo: {
                    name: dataset.name,
                    originalFile: dataset.file_info?.original_name || 'Unknown',
                    totalQuestions: dataset.total_questions || 0,
                    totalResponses: dataset.total_responses || 0,
                    processingStatus: dataset.processing_status || 'unknown'
                },
                headerExamples: headerExamples,
                dataExamples: dataExamples
            };
            logger.info('Enhanced report created successfully');
        } catch (error) {
            logger.error('Error creating enhanced report:', error);
            logger.error('Error stack:', error.stack);
            throw new AppError(`Failed to generate report examples: ${error.message}`);
        }

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
    try {
        const questions = dataset.survey_data?.questions || [];
        
        if (questions.length === 0) {
            logger.warn('No questions found for header examples');
            return [];
        }
        
        return questions.slice(0, 5).map((question, index) => {
            if (!question || !question.text) {
                logger.warn('Invalid question for header example:', question);
                return {
                    questionNumber: index + 1,
                    before: `Question ${index + 1}`,
                    after: 'Invalid question',
                    transformation: 'Error in question data'
                };
            }
            
            return {
                questionNumber: index + 1,
                before: `Question ${index + 1}`, // What the mock system would have shown
                after: question.text,
                transformation: question.text.includes('?') ? 'Extracted actual question text' : 'Cleaned header text'
            };
        });
    } catch (error) {
        logger.error('Error generating header examples:', error);
        return [];
    }
}

/**
 * Generate examples showing data extraction
 */
function generateDataExamples(dataset) {
    try {
        const responses = dataset.survey_data?.responses || [];
        const questions = dataset.survey_data?.questions || [];
        
        if (responses.length === 0 || questions.length === 0) {
            logger.warn('No responses or questions found for data examples');
            return [];
        }

        // Show first response as example
        const firstResponse = responses[0];
        if (!firstResponse || typeof firstResponse !== 'object') {
            logger.warn('First response is invalid or missing');
            return [];
        }
        
        const exampleFields = questions.slice(0, 3); // First 3 questions
        
        return exampleFields.map(question => {
            if (!question || !question.text) {
                logger.warn('Invalid question object:', question);
                return {
                    question: 'Invalid question',
                    sampleValue: 'No response',
                    fieldType: 'text'
                };
            }
            
            return {
                question: question.text,
                sampleValue: firstResponse[question.text] || 'No response',
                fieldType: question.type || 'text'
            };
        });
    } catch (error) {
        logger.error('Error generating data examples:', error);
        return [];
    }
}