/**
 * API endpoint for exporting clean CSV files after intelligent data preprocessing
 */

import { createLogger } from '../src/utils/logger.js';
import { AppError } from '../src/utils/error-handler.js';
import { uploadedDatasets, initializationPromise, isInitialized } from './survey-datasets.js';

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

        // Check if survey data exists
        if (!dataset.survey_data || !dataset.survey_data.questions || !dataset.survey_data.responses) {
            logger.error('Dataset missing survey data for export:', {
                hasSurveyData: !!dataset.survey_data,
                hasQuestions: !!(dataset.survey_data?.questions),
                hasResponses: !!(dataset.survey_data?.responses)
            });
            return res.status(400).json({ 
                error: 'Dataset does not have survey data available for export' 
            });
        }

        // Prepare clean data for export
        const cleanData = {
            headers: dataset.survey_data.questions.map(q => q.text || q.id || 'Unknown Question'),
            responses: dataset.survey_data.responses
        };
        
        logger.info(`Preparing CSV export for dataset ${datasetId}:`, {
            headerCount: cleanData.headers.length,
            responseCount: cleanData.responses.length,
            firstFewHeaders: cleanData.headers.slice(0, 3)
        });

        // Generate CSV content in memory (Vercel-compatible)
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `${dataset.name.replace(/[^a-zA-Z0-9]/g, '_')}_clean_${timestamp}.csv`;
        
        // Generate CSV content
        const csvContent = generateCSVContent(cleanData);

        // Set headers for file download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Length', Buffer.byteLength(csvContent, 'utf8'));

        logger.info(`Exported clean CSV for dataset ${datasetId}: ${cleanData.responses.length} rows, ${cleanData.headers.length} columns`);

        return res.status(200).send(csvContent);

    } catch (error) {
        logger.error('CSV export failed', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

/**
 * Generate CSV content from clean data
 */
function generateCSVContent(cleanData) {
    const { headers, responses } = cleanData;
    
    // Helper function to escape CSV fields
    function escapeCSVField(field) {
        if (field === null || field === undefined) return '';
        const str = String(field);
        // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    }
    
    // Create CSV content
    let csvContent = '';
    
    // Add header row
    csvContent += headers.map(escapeCSVField).join(',') + '\n';
    
    // Add data rows
    for (const response of responses) {
        const row = headers.map(header => {
            const value = response[header];
            return escapeCSVField(value);
        });
        csvContent += row.join(',') + '\n';
    }
    
    return csvContent;
}