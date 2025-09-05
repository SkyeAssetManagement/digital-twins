/**
 * Dataset Service
 * Handles all dataset-related operations and business logic
 */

import fs from 'fs/promises';
import path from 'path';
import { BaseService } from './base.service.js';
import { createUnifiedVectorStore } from '../vector_db/unified_vector_store.js';
import { NotFoundError, ValidationError, AppError } from '../utils/error-handler.js';
import { UniversalProcessor } from '../data_processing/universal_processor.js';

export class DatasetService extends BaseService {
  constructor() {
    super('DatasetService');
    this.datasetsPath = path.join(process.cwd(), 'data', 'datasets');
  }

  /**
   * Get dataset configuration
   */
  async getConfig(datasetId) {
    this.validateRequired({ datasetId }, ['datasetId']);
    
    // Check cache
    const cacheKey = `config:${datasetId}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;
    
    const configPath = path.join(this.datasetsPath, datasetId, 'config.json');
    
    try {
      const configData = await fs.readFile(configPath, 'utf8');
      const config = JSON.parse(configData);
      
      // Enrich with processed data if available
      const enriched = await this.enrichConfigWithProcessedData(datasetId, config);
      
      this.setCached(cacheKey, enriched);
      return enriched;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new NotFoundError('Dataset', datasetId);
      }
      throw new AppError(`Failed to load dataset config: ${error.message}`);
    }
  }

  /**
   * Enrich config with processed data information
   */
  async enrichConfigWithProcessedData(datasetId, config) {
    const processedPath = path.join(
      this.datasetsPath, 
      datasetId, 
      'processed', 
      'processed_data.json'
    );
    
    let processedData = null;
    
    try {
      const processed = await fs.readFile(processedPath, 'utf8');
      processedData = JSON.parse(processed);
    } catch {
      // No processed data yet
    }
    
    // Extract segments from processed data or config
    let segments = config.predefinedSegments || [];
    
    if (processedData && processedData.segments) {
      segments = processedData.segments.map(s => ({
        id: s.id || s.name,
        name: s.name || s.id,
        size: s.size || 0,
        percentage: s.percentage || 0,
        characteristics: s.characteristics || {}
      }));
    }
    
    return {
      ...config,
      segments,
      isProcessed: !!processedData,
      responseCount: processedData?.surveyData?.responses?.length || 0,
      processedAt: processedData?.timestamp || null,
      statistics: processedData ? {
        totalRespondents: processedData.surveyData?.responses?.length || 0,
        totalQuestions: processedData.surveyData?.questions?.length || 0,
        totalSegments: segments.length
      } : null
    };
  }

  /**
   * List all available datasets
   */
  async listDatasets() {
    const startTime = Date.now();
    
    try {
      // Try vector store first for database-backed datasets
      const vectorStore = await createUnifiedVectorStore('system', {
        embeddingProvider: 'openai'
      });
      
      const dbDatasets = await vectorStore.listDatasets();
      await vectorStore.close();
      
      // Also check file system for local datasets
      const fsDatasets = await this.listFileSystemDatasets();
      
      // Merge and deduplicate
      const datasetMap = new Map();
      
      for (const dataset of [...dbDatasets, ...fsDatasets]) {
        if (!datasetMap.has(dataset.id)) {
          datasetMap.set(dataset.id, dataset);
        }
      }
      
      const datasets = Array.from(datasetMap.values())
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      this.logMetrics('listDatasets', startTime, true, { count: datasets.length });
      return datasets;
      
    } catch (error) {
      this.logMetrics('listDatasets', startTime, false);
      throw new AppError(`Failed to list datasets: ${error.message}`);
    }
  }

  /**
   * List datasets from file system
   */
  async listFileSystemDatasets() {
    try {
      const entries = await fs.readdir(this.datasetsPath, { withFileTypes: true });
      
      const datasets = [];
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        
        try {
          const config = await this.getConfig(entry.name);
          const stats = await fs.stat(path.join(this.datasetsPath, entry.name));
          
          datasets.push({
            id: entry.name,
            name: config.name || entry.name,
            description: config.description || '',
            status: config.isProcessed ? 'completed' : 'pending',
            created_at: stats.birthtime.toISOString(),
            segment_count: config.segments?.length || 0,
            response_count: config.responseCount || 0
          });
        } catch {
          // Skip invalid datasets
        }
      }
      
      return datasets;
    } catch (error) {
      this.logger.warn('Failed to list file system datasets', error);
      return [];
    }
  }

  /**
   * Get dataset status
   */
  async getStatus(datasetId) {
    this.validateRequired({ datasetId }, ['datasetId']);
    
    const startTime = Date.now();
    
    try {
      const config = await this.getConfig(datasetId);
      
      const status = {
        datasetId,
        name: config.name,
        status: config.isProcessed ? 'completed' : 'pending',
        progress: config.isProcessed ? 100 : 0,
        message: config.isProcessed 
          ? `Dataset processed successfully with ${config.responseCount} responses`
          : 'Dataset pending processing',
        statistics: config.statistics,
        segments: config.segments,
        processedAt: config.processedAt,
        error: null
      };
      
      // Check for error file
      const errorPath = path.join(this.datasetsPath, datasetId, 'processed', 'error.json');
      try {
        const errorData = await fs.readFile(errorPath, 'utf8');
        const error = JSON.parse(errorData);
        status.status = 'failed';
        status.error = error;
        status.message = `Processing failed: ${error.message}`;
      } catch {
        // No error file
      }
      
      this.logMetrics('getStatus', startTime, true);
      return status;
      
    } catch (error) {
      this.logMetrics('getStatus', startTime, false);
      throw error;
    }
  }

  /**
   * Initialize a new dataset
   */
  async initializeDataset(datasetId, options = {}) {
    this.validateRequired({ datasetId }, ['datasetId']);
    
    const startTime = Date.now();
    
    try {
      // Check if dataset exists
      const config = await this.getConfig(datasetId);
      
      if (config.isProcessed && !options.force) {
        throw new ValidationError('Dataset already processed. Use force option to reprocess.');
      }
      
      // Process the dataset
      const processor = new UniversalProcessor(datasetId);
      const result = await processor.processDataset(options);
      
      // Initialize vector store
      const vectorStore = await createUnifiedVectorStore(datasetId, {
        embeddingProvider: config.embeddingProvider || 'openai'
      });
      
      // Store segment profiles
      for (const segment of result.segments) {
        await vectorStore.storeSegmentProfile(
          segment.name,
          segment.characteristics,
          segment.valueSystem,
          segment.avgScores
        );
      }
      
      // Update dataset status
      await vectorStore.updateDatasetStatus(datasetId, 'completed');
      await vectorStore.close();
      
      // Clear cache for this dataset
      this.cache.delete(`config:${datasetId}`);
      
      this.logMetrics('initializeDataset', startTime, true, { 
        datasetId,
        segments: result.segments.length 
      });
      
      return {
        success: true,
        datasetId,
        segments: result.segments.length,
        responses: result.surveyData.responses.length,
        message: 'Dataset initialized successfully'
      };
      
    } catch (error) {
      this.logMetrics('initializeDataset', startTime, false);
      
      // Update status to failed
      try {
        const vectorStore = await createUnifiedVectorStore(datasetId);
        await vectorStore.updateDatasetStatus(datasetId, 'failed', error.message);
        await vectorStore.close();
      } catch (e) {
        this.logger.error('Failed to update dataset status', e);
      }
      
      throw new AppError(`Failed to initialize dataset: ${error.message}`);
    }
  }

  /**
   * Upload a new dataset
   */
  async uploadDataset(datasetId, files, config) {
    this.validateRequired({ datasetId, files, config }, ['datasetId', 'files', 'config']);
    
    const startTime = Date.now();
    
    try {
      // Create dataset directory
      const datasetPath = path.join(this.datasetsPath, datasetId);
      await fs.mkdir(datasetPath, { recursive: true });
      await fs.mkdir(path.join(datasetPath, 'raw'), { recursive: true });
      await fs.mkdir(path.join(datasetPath, 'processed'), { recursive: true });
      
      // Save config
      await fs.writeFile(
        path.join(datasetPath, 'config.json'),
        JSON.stringify(config, null, 2)
      );
      
      // Save uploaded files
      for (const [filename, content] of Object.entries(files)) {
        await fs.writeFile(
          path.join(datasetPath, 'raw', filename),
          content
        );
      }
      
      this.logMetrics('uploadDataset', startTime, true, { datasetId });
      
      return {
        success: true,
        datasetId,
        message: 'Dataset uploaded successfully',
        files: Object.keys(files)
      };
      
    } catch (error) {
      this.logMetrics('uploadDataset', startTime, false);
      throw new AppError(`Failed to upload dataset: ${error.message}`);
    }
  }

  /**
   * Delete a dataset
   */
  async deleteDataset(datasetId) {
    this.validateRequired({ datasetId }, ['datasetId']);
    
    const startTime = Date.now();
    
    try {
      // Check if dataset exists
      await this.getConfig(datasetId);
      
      // Delete from file system
      const datasetPath = path.join(this.datasetsPath, datasetId);
      await fs.rm(datasetPath, { recursive: true, force: true });
      
      // Delete from database
      try {
        const vectorStore = await createUnifiedVectorStore(datasetId);
        await vectorStore.updateDatasetStatus(datasetId, 'deleted');
        await vectorStore.close();
      } catch {
        // Database deletion is optional
      }
      
      // Clear cache
      this.cache.delete(`config:${datasetId}`);
      
      this.logMetrics('deleteDataset', startTime, true, { datasetId });
      
      return {
        success: true,
        datasetId,
        message: 'Dataset deleted successfully'
      };
      
    } catch (error) {
      this.logMetrics('deleteDataset', startTime, false);
      throw new AppError(`Failed to delete dataset: ${error.message}`);
    }
  }
}

// Export singleton instance
export const datasetService = new DatasetService();
export default datasetService;