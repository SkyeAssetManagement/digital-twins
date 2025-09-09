import formidable from 'formidable';
import path from 'path';
import fs from 'fs/promises';
import { uploadedDatasets } from './survey-datasets.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        console.log('Processing simple survey file upload');

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
                error: 'Dataset name and target demographic are required',
                success: false
            });
        }

        // Get uploaded file
        const surveyFile = files.surveyFile;
        const file = Array.isArray(surveyFile) ? surveyFile[0] : surveyFile;
        
        if (!file) {
            return res.status(400).json({ 
                error: 'Survey file is required',
                success: false
            });
        }

        // Validate file type
        const allowedExtensions = ['.csv', '.xlsx', '.xls'];
        const fileExtension = path.extname(file.originalFilename || file.newFilename).toLowerCase();
        if (!allowedExtensions.includes(fileExtension)) {
            return res.status(400).json({ 
                error: `Invalid file type. Please upload CSV or Excel files only. Got: ${fileExtension}`,
                success: false
            });
        }

        console.log(`Processing ${fileExtension} file: ${file.originalFilename}`);

        // For now, just create a placeholder dataset
        // In a real implementation, you'd parse the CSV/Excel here
        const mockQuestionCount = Math.floor(Math.random() * 20) + 10; // 10-30 questions
        const mockResponseCount = Math.floor(Math.random() * 500) + 100; // 100-600 responses

        // Create new dataset
        const newDatasetId = Array.from(uploadedDatasets.keys()).length > 0 
            ? Math.max(...Array.from(uploadedDatasets.keys())) + 1 
            : 1;

        const dataset = {
            id: newDatasetId,
            name: datasetName,
            target_demographic: targetDemographic,
            description: description || '',
            total_questions: mockQuestionCount,
            total_responses: mockResponseCount,
            processing_status: 'completed',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            file_info: {
                original_name: file.originalFilename,
                file_type: fileExtension,
                file_size: file.size
            },
            survey_data: {
                questions: [], // Would be populated from actual file parsing
                responses: [], // Would be populated from actual file parsing
                fields: {} // Would be populated from actual file parsing
            }
        };

        // Store the dataset
        uploadedDatasets.set(newDatasetId, dataset);

        console.log(`Created dataset ${newDatasetId}: ${datasetName}`);

        // Return success response
        res.json({
            success: true,
            message: 'Dataset uploaded and processed successfully',
            dataset: {
                id: dataset.id,
                name: dataset.name,
                target_demographic: dataset.target_demographic,
                description: dataset.description,
                total_questions: dataset.total_questions,
                total_responses: dataset.total_responses,
                processing_status: dataset.processing_status
            }
        });

    } catch (error) {
        console.error('Upload processing error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process upload',
            details: error.message
        });
    }
}