import { createUnifiedVectorStore } from '../src/vector_db/unified_vector_store.js';
import { createLogger } from '../src/utils/logger.js';
import { asyncHandler, ValidationError } from '../src/utils/error-handler.js';
import { appConfig } from '../src/config/app-config.js';
import fs from 'fs/promises';
import path from 'path';

const logger = createLogger('ListDatasetsAPI');

const handler = async (req, res) => {
  if (req.method !== 'GET') {
    throw new ValidationError('Method not allowed. Use GET.');
  }
    // Get datasets from file system
    const datasetsPath = path.join(process.cwd(), 'data', 'datasets');
    const datasets = [];
    
    try {
      const dirs = await fs.readdir(datasetsPath);
      
      for (const dir of dirs) {
        const configPath = path.join(datasetsPath, dir, 'config.json');
        
        try {
          const configData = await fs.readFile(configPath, 'utf8');
          const config = JSON.parse(configData);
          
          // Check if processed data exists
          const processedPath = path.join(datasetsPath, dir, 'processed', 'processed_data.json');
          let isProcessed = false;
          
          try {
            await fs.access(processedPath);
            isProcessed = true;
          } catch {
            // Processed file doesn't exist
          }
          
          datasets.push({
            id: config.id || dir,
            name: config.name || dir,
            description: config.description || '',
            status: isProcessed ? 'completed' : 'pending',
            isProcessing: false,
            segments: config.predefinedSegments || [],
            created_at: config.uploadDate || new Date().toISOString()
          });
        } catch (error) {
        logger.warn('Error reading config', { dir, error: error.message });
          // Include directory even if config is missing
          datasets.push({
            id: dir,
            name: dir,
            description: 'Dataset configuration not found',
            status: 'error',
            isProcessing: false,
            segments: [],
            created_at: new Date().toISOString()
          });
        }
      }
    } catch (error) {
    logger.error('Error reading datasets directory', error);
    }
    
    // Try to get additional info from database
    try {
    const vectorStore = await createUnifiedVectorStore('system', {
      embeddingProvider: appConfig.openai.apiKey ? 'openai-small' : 'local-minilm'
    });
      const dbDatasets = await vectorStore.listDatasets();
      await vectorStore.close();
      
      // Merge database info with filesystem info
      dbDatasets.forEach(dbDataset => {
        const existing = datasets.find(d => d.id === dbDataset.id);
        if (existing) {
          existing.segment_count = dbDataset.segment_count;
          existing.response_count = dbDataset.response_count;
          existing.status = dbDataset.status || existing.status;
        } else {
          datasets.push(dbDataset);
        }
      });
    } catch (error) {
    logger.warn('Could not fetch database datasets', error);
    }
    
  res.json(datasets);
};

// Export with error handling wrapper
export default asyncHandler(handler);