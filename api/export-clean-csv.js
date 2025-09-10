/**
 * API endpoint for exporting clean CSV files after intelligent data preprocessing
 */

import { createLogger } from '../src/utils/logger.js';
import { AppError } from '../src/utils/error-handler.js';
import { getIntelligentDataPreprocessor } from '../src/data_processing/intelligent_data_preprocessor.js';
import { uploadedDatasets, initializationPromise, isInitialized } from './survey-datasets.js';
import path from 'path';
import fs from 'fs';

const logger = createLogger('ExportCleanCSVAPI');

export default async function handler(req, res) {
    try {
        // Ensure initialization is complete before processing requests
        if (!isInitialized && initializationPromise) {
            logger.info('Waiting for dataset initialization to complete for CSV export...');
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

        // Check if dataset has been processed
        if (dataset.processing_status !== 'completed') {
            return res.status(400).json({ 
                error: `Dataset is not ready for export. Status: ${dataset.processing_status}` 
            });
        }

        // Prepare clean data for export
        const cleanData = {
            headers: dataset.survey_data.questions.map(q => q.text),
            responses: dataset.survey_data.responses
        };

        // Get preprocessor to export CSV
        const preprocessor = await getIntelligentDataPreprocessor();
        
        // Create temporary export file
        const exportDir = './exports';
        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `${dataset.name.replace(/[^a-zA-Z0-9]/g, '_')}_clean_${timestamp}.csv`;
        const exportPath = path.join(exportDir, fileName);

        // Export to CSV
        const exportResult = await preprocessor.exportAsCSV(cleanData, exportPath);

        if (exportResult.success) {
            // Read the file and send as download
            const fileContent = fs.readFileSync(exportPath, 'utf8');
            
            // Clean up temporary file
            fs.unlinkSync(exportPath);

            // Set headers for file download
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            res.setHeader('Content-Length', Buffer.byteLength(fileContent, 'utf8'));

            logger.info(`Exported clean CSV for dataset ${datasetId}: ${exportResult.rows} rows`);

            return res.status(200).send(fileContent);
        } else {
            throw new AppError('Failed to export CSV file');
        }

    } catch (error) {
        logger.error('CSV export failed', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}