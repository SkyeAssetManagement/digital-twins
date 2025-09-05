import fs from 'fs/promises';
import path from 'path';
import { appConfig } from '../src/config/app-config.js';
import { createLogger } from '../src/utils/logger.js';
import { 
  ValidationError, 
  NotFoundError, 
  handleApiError, 
  asyncHandler 
} from '../src/utils/error-handler.js';

const logger = createLogger('DatasetStatus');

/**
 * Get dataset processing status
 * GET /api/dataset-status/:datasetId
 */
async function getDatasetStatus(req, res) {
  // Validate HTTP method
  if (req.method !== 'GET') {
    throw new ValidationError('Method not allowed', { allowedMethods: ['GET'] });
  }

  // Extract and validate datasetId
  const { datasetId } = req.params || {};
  if (!datasetId || typeof datasetId !== 'string' || datasetId.trim() === '') {
    throw new ValidationError('Dataset ID is required and must be a non-empty string');
  }

  logger.info('Checking dataset status', { datasetId });

  // Build file paths using centralized config
  const datasetPath = path.join(process.cwd(), appConfig.paths.datasets, datasetId);
  const processedPath = path.join(
    datasetPath, 
    appConfig.paths.processed, 
    appConfig.paths.processedDataFile
  );
  const errorPath = path.join(
    datasetPath, 
    appConfig.paths.processed, 
    appConfig.paths.errorFile
  );

  // Check if dataset directory exists
  try {
    await fs.access(datasetPath);
    logger.debug('Dataset directory found', { datasetPath });
  } catch {
    logger.warn('Dataset not found', { datasetId, datasetPath });
    throw new NotFoundError('Dataset', datasetId);
  }

  // Initialize response data
  const statusResponse = {
    datasetId,
    isComplete: false,
    error: null,
    segments: 0,
    responses: 0,
    timestamp: null,
    processingStarted: null
  };

  // Check for processed data
  try {
    const data = await fs.readFile(processedPath, 'utf8');
    const processedData = JSON.parse(data);
    
    statusResponse.isComplete = true;
    statusResponse.segments = processedData?.segments?.length || 0;
    statusResponse.responses = processedData?.surveyData?.responses?.length || 0;
    statusResponse.timestamp = processedData?.timestamp || null;
    
    logger.info('Dataset processing complete', {
      datasetId,
      segments: statusResponse.segments,
      responses: statusResponse.responses
    });
    
  } catch (processedError) {
    logger.debug('No processed data found, checking for errors', { datasetId });
    
    // Check for error file
    try {
      const errorData = await fs.readFile(errorPath, 'utf8');
      const errorInfo = JSON.parse(errorData);
      statusResponse.error = errorInfo.message || 'Processing failed';
      statusResponse.timestamp = errorInfo.timestamp || null;
      
      logger.warn('Dataset processing failed', {
        datasetId,
        error: statusResponse.error
      });
      
    } catch (errorFileError) {
      // No error file found - still processing
      logger.debug('No error file found, dataset still processing', { datasetId });
      
      // Try to determine when processing started
      try {
        const stats = await fs.stat(datasetPath);
        statusResponse.processingStarted = stats.mtime.toISOString();
      } catch {
        // Ignore stat errors
      }
    }
  }

  logger.info('Dataset status retrieved successfully', statusResponse);
  res.json(statusResponse);
}

export default asyncHandler(getDatasetStatus);
