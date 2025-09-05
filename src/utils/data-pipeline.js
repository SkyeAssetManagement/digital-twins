/**
 * Data Pipeline Framework
 * Orchestrates data processing with progress tracking and error handling
 */

import { createLogger } from './logger.js';
import { AppError, withRetry } from './error-handler.js';
import EventEmitter from 'events';

const logger = createLogger('DataPipeline');

/**
 * Pipeline Stage - represents a single processing step
 */
export class PipelineStage {
  constructor(name, processor, options = {}) {
    this.name = name;
    this.processor = processor;
    this.retries = options.retries || 0;
    this.retryDelay = options.retryDelay || 1000;
    this.timeout = options.timeout || null;
    this.cache = options.cache || false;
    this.parallel = options.parallel || false;
    this.batchSize = options.batchSize || 10;
    this.validator = options.validator || null;
    this.transformer = options.transformer || null;
    this.errorHandler = options.errorHandler || null;
  }

  /**
   * Execute the stage
   */
  async execute(data, context = {}) {
    const startTime = Date.now();
    logger.info(`Starting stage: ${this.name}`);

    try {
      // Validate input if validator provided
      if (this.validator) {
        const validation = await this.validator(data);
        if (!validation.valid) {
          throw new AppError(`Validation failed for stage ${this.name}: ${validation.message}`);
        }
      }

      // Transform input if transformer provided
      let input = data;
      if (this.transformer) {
        input = await this.transformer(data, context);
      }

      // Execute processor with retry logic
      let result;
      if (this.retries > 0) {
        result = await withRetry(
          () => this.executeProcessor(input, context),
          this.retries,
          this.retryDelay
        );
      } else {
        result = await this.executeProcessor(input, context);
      }

      const duration = Date.now() - startTime;
      logger.info(`Completed stage: ${this.name}`, { duration: `${duration}ms` });

      return result;
    } catch (error) {
      // Use custom error handler if provided
      if (this.errorHandler) {
        return await this.errorHandler(error, data, context);
      }
      throw error;
    }
  }

  /**
   * Execute the processor with timeout if specified
   */
  async executeProcessor(data, context) {
    if (this.timeout) {
      return await Promise.race([
        this.processor(data, context),
        new Promise((_, reject) =>
          setTimeout(() => reject(new AppError(`Stage ${this.name} timed out`)), this.timeout)
        )
      ]);
    }
    return await this.processor(data, context);
  }
}

/**
 * Data Pipeline - orchestrates multiple stages
 */
export class DataPipeline extends EventEmitter {
  constructor(name, options = {}) {
    super();
    this.name = name;
    this.stages = [];
    this.context = {};
    this.cache = new Map();
    this.options = {
      stopOnError: options.stopOnError !== false,
      progressInterval: options.progressInterval || 1000,
      cacheResults: options.cacheResults || false,
      ...options
    };
    this.state = 'idle';
    this.progress = {
      current: 0,
      total: 0,
      stage: null,
      percentage: 0
    };
  }

  /**
   * Add a stage to the pipeline
   */
  addStage(stage) {
    if (!(stage instanceof PipelineStage)) {
      throw new AppError('Stage must be an instance of PipelineStage');
    }
    this.stages.push(stage);
    return this;
  }

  /**
   * Create and add a stage
   */
  stage(name, processor, options = {}) {
    const stage = new PipelineStage(name, processor, options);
    this.addStage(stage);
    return this;
  }

  /**
   * Execute the pipeline
   */
  async execute(initialData, context = {}) {
    this.state = 'running';
    this.context = { ...this.context, ...context };
    this.progress.total = this.stages.length;
    this.progress.current = 0;

    const startTime = Date.now();
    logger.info(`Starting pipeline: ${this.name}`, { stages: this.stages.length });
    this.emit('start', { pipeline: this.name, stages: this.stages.length });

    let data = initialData;
    const results = [];

    try {
      for (let i = 0; i < this.stages.length; i++) {
        const stage = this.stages[i];
        this.progress.current = i + 1;
        this.progress.stage = stage.name;
        this.progress.percentage = Math.round((this.progress.current / this.progress.total) * 100);

        this.emit('progress', {
          stage: stage.name,
          current: this.progress.current,
          total: this.progress.total,
          percentage: this.progress.percentage
        });

        // Check cache
        const cacheKey = this.getCacheKey(stage.name, data);
        if (stage.cache && this.cache.has(cacheKey)) {
          logger.debug(`Using cached result for stage: ${stage.name}`);
          data = this.cache.get(cacheKey);
        } else {
          // Execute stage
          try {
            data = await stage.execute(data, this.context);

            // Cache result if enabled
            if (stage.cache) {
              this.cache.set(cacheKey, data);
            }
          } catch (error) {
            logger.error(`Stage ${stage.name} failed`, error);
            this.emit('error', { stage: stage.name, error });

            if (this.options.stopOnError) {
              this.state = 'failed';
              throw new AppError(`Pipeline failed at stage ${stage.name}: ${error.message}`);
            }
            // Continue with null data if not stopping
            data = null;
          }
        }

        // Store intermediate result if caching enabled
        if (this.options.cacheResults) {
          results.push({
            stage: stage.name,
            data: data
          });
        }

        this.emit('stage-complete', {
          stage: stage.name,
          index: i,
          data: data
        });
      }

      const duration = Date.now() - startTime;
      this.state = 'completed';
      
      logger.info(`Pipeline completed: ${this.name}`, { duration: `${duration}ms` });
      this.emit('complete', {
        pipeline: this.name,
        duration,
        results: this.options.cacheResults ? results : undefined
      });

      return data;
    } catch (error) {
      this.state = 'failed';
      this.emit('error', { pipeline: this.name, error });
      throw error;
    }
  }

  /**
   * Execute stages in parallel
   */
  async executeParallel(initialData, context = {}) {
    this.state = 'running';
    this.context = { ...this.context, ...context };

    const startTime = Date.now();
    logger.info(`Starting parallel pipeline: ${this.name}`);
    this.emit('start', { pipeline: this.name, mode: 'parallel' });

    try {
      const promises = this.stages.map(stage => 
        stage.execute(initialData, this.context)
      );

      const results = await Promise.all(promises);

      const duration = Date.now() - startTime;
      this.state = 'completed';
      
      logger.info(`Parallel pipeline completed: ${this.name}`, { duration: `${duration}ms` });
      this.emit('complete', { pipeline: this.name, duration, results });

      return results;
    } catch (error) {
      this.state = 'failed';
      this.emit('error', { pipeline: this.name, error });
      throw error;
    }
  }

  /**
   * Create a branching pipeline
   */
  branch(condition, truePipeline, falsePipeline) {
    return this.stage('branch', async (data, context) => {
      const result = await condition(data, context);
      if (result) {
        return await truePipeline.execute(data, context);
      } else if (falsePipeline) {
        return await falsePipeline.execute(data, context);
      }
      return data;
    });
  }

  /**
   * Add a transformation stage
   */
  transform(name, transformer) {
    return this.stage(name, async (data) => transformer(data));
  }

  /**
   * Add a filter stage
   */
  filter(name, predicate) {
    return this.stage(name, async (data) => {
      if (Array.isArray(data)) {
        return data.filter(predicate);
      }
      return predicate(data) ? data : null;
    });
  }

  /**
   * Add a map stage for arrays
   */
  map(name, mapper) {
    return this.stage(name, async (data) => {
      if (Array.isArray(data)) {
        return Promise.all(data.map(mapper));
      }
      return mapper(data);
    });
  }

  /**
   * Add a reduce stage
   */
  reduce(name, reducer, initialValue) {
    return this.stage(name, async (data) => {
      if (Array.isArray(data)) {
        return data.reduce(reducer, initialValue);
      }
      return data;
    });
  }

  /**
   * Add a batch processing stage
   */
  batch(name, processor, batchSize = 10) {
    return this.stage(name, async (data) => {
      if (!Array.isArray(data)) {
        return processor([data]);
      }

      const results = [];
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        const batchResults = await processor(batch);
        results.push(...batchResults);
        
        this.emit('batch-progress', {
          stage: name,
          processed: Math.min(i + batchSize, data.length),
          total: data.length
        });
      }
      return results;
    });
  }

  /**
   * Generate cache key
   */
  getCacheKey(stageName, data) {
    const dataHash = JSON.stringify(data).substring(0, 100);
    return `${stageName}:${dataHash}`;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    logger.info('Pipeline cache cleared');
  }

  /**
   * Get current state
   */
  getState() {
    return {
      state: this.state,
      progress: this.progress,
      cacheSize: this.cache.size
    };
  }

  /**
   * Reset pipeline
   */
  reset() {
    this.state = 'idle';
    this.progress = {
      current: 0,
      total: 0,
      stage: null,
      percentage: 0
    };
    this.context = {};
  }
}

/**
 * Create a simple pipeline
 */
export function createPipeline(name, stages = []) {
  const pipeline = new DataPipeline(name);
  stages.forEach(stage => {
    if (typeof stage === 'function') {
      pipeline.stage(stage.name || 'anonymous', stage);
    } else {
      pipeline.addStage(stage);
    }
  });
  return pipeline;
}

/**
 * Compose multiple pipelines
 */
export function composePipelines(...pipelines) {
  const composed = new DataPipeline('composed');
  pipelines.forEach((pipeline, index) => {
    composed.stage(`pipeline-${index}`, async (data, context) => {
      return await pipeline.execute(data, context);
    });
  });
  return composed;
}

export default {
  PipelineStage,
  DataPipeline,
  createPipeline,
  composePipelines
};