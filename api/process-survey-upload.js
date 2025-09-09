import formidable from 'formidable';
import path from 'path';
import fs from 'fs/promises';
import { createLogger } from '../src/utils/logger.js';
import { UniversalProcessor } from '../src/data_processing/universal_processor.js';
import { QuestionCategorizer } from '../src/data_processing/question_categorizer.js';
import { ArchetypeGenerator } from '../src/data_processing/archetype_generator.js';
import { uploadedDatasets, uploadedArchetypes } from './survey-datasets.js';
import { parseExcelSheet } from '../src/utils/file-operations.js';

const logger = createLogger('ProcessSurveyUpload');

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        logger.info('Processing survey file upload');

        // Parse form data with file
        const form = formidable({
            maxFileSize: 50 * 1024 * 1024, // 50MB limit
            keepExtensions: true,
            uploadDir: './uploads'
        });

        const [fields, files] = await form.parse(req);

        // Extract form fields
        const datasetName = Array.isArray(fields.datasetName) ? fields.datasetName[0] : fields.datasetName;
        const targetDemographic = Array.isArray(fields.targetDemographic) ? fields.targetDemographic[0] : fields.targetDemographic;
        const description = Array.isArray(fields.description) ? fields.description[0] : fields.description;

        // Validate required fields
        if (!datasetName || !targetDemographic) {
            return res.status(400).json({ 
                error: 'Dataset name and target demographic are required' 
            });
        }

        // Get uploaded file
        const surveyFile = files.surveyFile;
        const file = Array.isArray(surveyFile) ? surveyFile[0] : surveyFile;
        
        if (!file) {
            return res.status(400).json({ 
                error: 'Survey file is required' 
            });
        }

        // Validate file type
        const allowedExtensions = ['.csv', '.xlsx', '.xls'];
        const fileExtension = path.extname(file.originalFilename || file.newFilename).toLowerCase();
        if (!allowedExtensions.includes(fileExtension)) {
            return res.status(400).json({ 
                error: `Invalid file type. Please upload CSV or Excel files only. Got: ${fileExtension}` 
            });
        }

        logger.info(`Processing ${fileExtension} file: ${file.originalFilename}`);

        // Parse the survey data
        let surveyData;
        try {
            if (fileExtension === '.csv') {
                // Parse CSV file
                const csvContent = await fs.readFile(file.filepath, 'utf-8');
                surveyData = await parseCsvToSurveyFormat(csvContent);
            } else {
                // Parse Excel file
                surveyData = await parseExcelToSurveyFormat(file.filepath);
            }
        } catch (parseError) {
            logger.error('File parsing failed', parseError);
            return res.status(400).json({ 
                error: `Failed to parse survey file: ${parseError.message}` 
            });
        }

        logger.info(`Parsed survey with ${surveyData.questions.length} questions and ${surveyData.responses.length} responses`);

        // Create new dataset
        const newDatasetId = Array.from(uploadedDatasets.keys()).length > 0 
            ? Math.max(...Array.from(uploadedDatasets.keys())) + 1 
            : 1;

        const dataset = {
            id: newDatasetId,
            name: datasetName,
            target_demographic: targetDemographic,
            description: description || '',
            total_questions: surveyData.questions.length,
            total_responses: surveyData.responses.length,
            processing_status: 'processing',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            file_info: {
                original_name: file.originalFilename,
                file_type: fileExtension,
                file_size: file.size
            }
        };

        uploadedDatasets.set(newDatasetId, dataset);

        // Process survey data through the Universal Pipeline
        try {
            await processSurveyPipeline(newDatasetId, surveyData, targetDemographic);
            
            // Update dataset status
            dataset.processing_status = 'completed';
            dataset.updated_at = new Date().toISOString();
            uploadedDatasets.set(newDatasetId, dataset);

            logger.info(`Successfully processed dataset ${newDatasetId}: ${datasetName}`);

            return res.json({
                success: true,
                message: 'Survey uploaded and processed successfully',
                dataset: {
                    id: newDatasetId,
                    name: datasetName,
                    target_demographic: targetDemographic,
                    total_questions: surveyData.questions.length,
                    total_responses: surveyData.responses.length,
                    processing_status: 'completed'
                }
            });

        } catch (processingError) {
            logger.error('Survey processing failed', processingError);
            
            // Update dataset status to failed
            dataset.processing_status = 'failed';
            dataset.error_message = processingError.message;
            dataset.updated_at = new Date().toISOString();
            uploadedDatasets.set(newDatasetId, dataset);

            return res.status(500).json({
                success: false,
                error: 'Survey processing failed',
                details: processingError.message,
                dataset_id: newDatasetId
            });
        }

        // Clean up uploaded file
        try {
            await fs.unlink(file.filepath);
        } catch (cleanupError) {
            logger.warn('Failed to clean up uploaded file', cleanupError);
        }

    } catch (error) {
        logger.error('Survey upload handler error', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to process survey upload',
            details: error.message
        });
    }
}

async function parseCsvToSurveyFormat(csvContent) {
    const Papa = await import('papaparse');
    const parsed = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim()
    });

    if (parsed.errors.length > 0) {
        throw new Error(`CSV parsing error: ${parsed.errors[0].message}`);
    }

    const data = parsed.data;
    if (!data || data.length === 0) {
        throw new Error('CSV file appears to be empty');
    }

    // Extract questions from headers (skip ID columns)
    const headers = Object.keys(data[0]);
    const questionHeaders = headers.filter(h => 
        !h.toLowerCase().includes('id') && 
        !h.toLowerCase().includes('respondent') &&
        h.trim() !== ''
    );

    const questions = questionHeaders.map((header, index) => ({
        id: index + 1,
        text: header,
        fullQuestion: header,
        column: index,
        type: 'unknown'
    }));

    // Extract responses
    const responses = data.map((row, index) => ({
        respondentId: row[headers[0]] || `respondent_${index + 1}`,
        responses: questionHeaders.reduce((acc, header) => {
            if (row[header] !== undefined && row[header] !== null && row[header] !== '') {
                acc[header] = row[header];
            }
            return acc;
        }, {})
    }));

    return {
        questions,
        responses,
        statistics: {
            totalResponses: responses.length,
            completionRate: 100 // Simplified for now
        }
    };
}

async function parseExcelToSurveyFormat(filePath) {
    // Use the existing parseExcelSheet utility
    const rawData = await parseExcelSheet(filePath, null, {
        raw: false,
        header: 1
    });

    if (!rawData || rawData.length < 2) {
        throw new Error('Excel file must have at least a header row and one data row');
    }

    // First row is headers
    const headers = rawData[0].filter(h => h && h.toString().trim() !== '');
    
    // Skip ID columns
    const questionHeaders = headers.filter(h => 
        !h.toLowerCase().includes('id') && 
        !h.toLowerCase().includes('respondent')
    );

    const questions = questionHeaders.map((header, index) => ({
        id: index + 1,
        text: header.toString(),
        fullQuestion: header.toString(),
        column: headers.indexOf(header),
        type: 'unknown'
    }));

    // Extract responses from data rows
    const responses = rawData.slice(1).map((row, index) => {
        if (!row || row.length === 0) return null;

        return {
            respondentId: row[0] || `respondent_${index + 1}`,
            responses: questionHeaders.reduce((acc, header) => {
                const colIndex = headers.indexOf(header);
                const value = row[colIndex];
                if (value !== undefined && value !== null && value !== '') {
                    acc[header] = value;
                }
                return acc;
            }, {})
        };
    }).filter(r => r !== null);

    return {
        questions,
        responses,
        statistics: {
            totalResponses: responses.length,
            completionRate: 100 // Simplified for now
        }
    };
}

async function processSurveyPipeline(datasetId, surveyData, targetDemographic) {
    logger.info(`Starting pipeline processing for dataset ${datasetId}`);

    // Step 1: Question Categorization
    const categorizer = new QuestionCategorizer();
    const categorizations = await categorizer.categorizeQuestions(
        surveyData.questions, 
        targetDemographic, 
        'Uploaded survey data analysis'
    );

    logger.info(`Categorized ${categorizations.categorizations.length} questions into ${categorizations.categories.length} categories`);

    // Step 2: Archetype Generation
    const generator = new ArchetypeGenerator();
    const archetypeResult = await generator.generateArchetypes(
        surveyData,
        categorizations,
        null // Response patterns would be calculated from actual responses
    );

    logger.info(`Generated ${archetypeResult.archetypes.length} archetypes`);

    // Step 3: Store archetypes in memory (would be database in production)
    let nextArchetypeId = Array.from(uploadedArchetypes.keys()).length > 0 
        ? Math.max(...Array.from(uploadedArchetypes.keys())) + 1 
        : 1;

    for (const archetype of archetypeResult.archetypes) {
        const archetypeRecord = {
            id: nextArchetypeId++,
            dataset_id: datasetId,
            name: archetype.name,
            description: archetype.description,
            population_percentage: archetype.population_percentage,
            spending_propensity: archetype.spending_propensity || 0.5,
            characteristics: archetype,
            claude_prompt: archetype.claude_prompt
        };
        
        uploadedArchetypes.set(archetypeRecord.id, archetypeRecord);
    }

    logger.info(`Stored ${archetypeResult.archetypes.length} archetypes for dataset ${datasetId}`);
    return archetypeResult;
}