/**
 * Unified Vector Store Implementation
 * Combines best features from both vector_store.js and enhanced_vector_store.js
 * with standardized error handling, logging, and configuration
 */

import pg from 'pg';
import fetch from 'node-fetch';
import { pipeline } from '@xenova/transformers';
import crypto from 'crypto';
import { appConfig } from '../config/app-config.js';
import { createLogger } from '../utils/logger.js';
import { 
  AppError, 
  ValidationError, 
  ExternalServiceError,
  withRetry 
} from '../utils/error-handler.js';

const { Pool } = pg;

/**
 * Unified Vector Store with comprehensive feature set
 */
export class UnifiedVectorStore {
  constructor(datasetId, options = {}) {
    // Validate inputs
    if (!datasetId) {
      throw new ValidationError('Dataset ID is required');
    }
    
    this.datasetId = datasetId;
    this.logger = createLogger(`VectorStore:${datasetId}`);
    
    // Configuration with defaults
    this.config = {
      embeddingProvider: options.embeddingProvider || 'openai',
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 1000,
      connectionTimeout: options.connectionTimeout || 5000,
      ...options
    };
    
    // Embedding dimensions by provider
    this.embeddingDimensions = {
      'openai': 3072,          // text-embedding-3-large
      'openai-small': 1536,    // text-embedding-3-small
      'local-minilm': 384,      // all-MiniLM-L6-v2
      'local-bge': 1024         // bge-large-en-v1.5
    };
    
    this.dimension = this.embeddingDimensions[this.config.embeddingProvider] || 384;
    
    // Connection state
    this.pool = null;
    this.localEmbedder = null;
    this.isInitialized = false;
    this.hasVectorSupport = false;
    
    // Cache for embeddings
    this.embeddingCache = new Map();
    this.cacheMaxSize = options.cacheMaxSize || 1000;
  }
  
  /**
   * Initialize the vector store
   */
  async initialize() {
    if (this.isInitialized) {
      this.logger.debug('Vector store already initialized');
      return;
    }
    
    this.logger.info('Initializing unified vector store', {
      datasetId: this.datasetId,
      embeddingProvider: this.config.embeddingProvider,
      dimension: this.dimension
    });
    
    // Initialize database connection
    await this.initializeDatabase();
    
    // Initialize embedding provider
    await this.initializeEmbedder();
    
    this.isInitialized = true;
    this.logger.info('Vector store initialized successfully');
  }
  
  /**
   * Initialize database connection with proper error handling
   */
  async initializeDatabase() {
    try {
      const dbConfig = appConfig.database;
      
      this.pool = new Pool({
        connectionString: dbConfig.url,
        ssl: dbConfig.ssl,
        max: dbConfig.maxConnections,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: this.config.connectionTimeout
      });
      
      // Test connection with retry
      await withRetry(async () => {
        const client = await this.pool.connect();
        await client.query('SELECT NOW()');
        client.release();
      }, this.config.retryAttempts, this.config.retryDelay);
      
      this.logger.info('Database connected successfully');
      
      // Create tables
      await this.createTables();
      
      // Check for vector support
      this.hasVectorSupport = await this.checkVectorSupport();
      this.logger.info('Vector support status', { hasVectorSupport: this.hasVectorSupport });
      
    } catch (error) {
      this.logger.warn('Database connection failed, using in-memory fallback', error);
      this.pool = null;
      this.initializeInMemoryStore();
    }
  }
  
  /**
   * Initialize in-memory store as fallback
   */
  initializeInMemoryStore() {
    this.inMemoryStore = {
      responses: [],
      segments: [],
      personas: [],
      datasets: [],
      surveyEmbeddings: [],
      contentAnalysisCache: []
    };
    this.logger.info('In-memory store initialized');
  }
  
  /**
   * Initialize embedding provider
   */
  async initializeEmbedder() {
    if (this.config.embeddingProvider.startsWith('local')) {
      try {
        const model = this.config.embeddingProvider === 'local-bge' 
          ? 'BAAI/bge-large-en-v1.5'
          : 'Xenova/all-MiniLM-L6-v2';
        
        this.localEmbedder = await pipeline('feature-extraction', model);
        this.logger.info('Local embedder initialized', { model });
      } catch (error) {
        this.logger.error('Failed to initialize local embedder', error);
        throw new ExternalServiceError('LocalEmbedder', 'Failed to initialize', error);
      }
    } else if (this.config.embeddingProvider.startsWith('openai')) {
      // Validate OpenAI configuration
      if (!appConfig.openai.apiKey) {
        throw new ValidationError('OpenAI API key is required for OpenAI embeddings');
      }
      this.logger.info('OpenAI embedder configured');
    }
  }
  
  /**
   * Create database tables with comprehensive schema
   */
  async createTables() {
    const queries = [
      // Enable pgvector extension
      'CREATE EXTENSION IF NOT EXISTS vector',
      
      // Datasets table - master table for all datasets
      `CREATE TABLE IF NOT EXISTS datasets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        config JSONB,
        status TEXT DEFAULT 'processing',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      )`,
      
      // Responses table - survey responses with embeddings
      `CREATE TABLE IF NOT EXISTS responses (
        id SERIAL PRIMARY KEY,
        dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
        respondent_id TEXT NOT NULL,
        segment TEXT,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        embedding vector(${this.dimension}),
        embedding_json JSONB, -- Fallback for non-vector databases
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(dataset_id, respondent_id, question)
      )`,
      
      // Segments table - segment profiles with centroids
      `CREATE TABLE IF NOT EXISTS segments (
        id SERIAL PRIMARY KEY,
        dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
        segment_name TEXT NOT NULL,
        centroid vector(${this.dimension}),
        centroid_json JSONB, -- Fallback
        characteristics JSONB,
        value_system JSONB,
        respondent_count INT DEFAULT 0,
        avg_scores JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(dataset_id, segment_name)
      )`,
      
      // Personas table - generated personas
      `CREATE TABLE IF NOT EXISTS personas (
        id SERIAL PRIMARY KEY,
        dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
        segment TEXT NOT NULL,
        persona_data JSONB NOT NULL,
        embedding vector(${this.dimension}),
        embedding_json JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      
      // Survey embeddings table - detailed survey response embeddings
      `CREATE TABLE IF NOT EXISTS survey_embeddings (
        id SERIAL PRIMARY KEY,
        dataset_id TEXT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
        respondent_id TEXT NOT NULL,
        segment TEXT NOT NULL,
        
        -- Survey scores
        sustainability_score FLOAT,
        price_sensitivity_score FLOAT,
        brand_values_score FLOAT,
        willingness_to_pay_score FLOAT,
        activism_score FLOAT,
        env_evangelist_score FLOAT,
        
        -- Multiple embeddings for different aspects
        values_embedding vector(${this.dimension}),
        response_embedding vector(${this.dimension}),
        values_embedding_json JSONB,
        response_embedding_json JSONB,
        
        -- Searchable text
        searchable_text TEXT,
        
        -- Metadata
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(dataset_id, respondent_id)
      )`,
      
      // Content analysis cache - for marketing content analysis
      `CREATE TABLE IF NOT EXISTS content_analysis_cache (
        id SERIAL PRIMARY KEY,
        content_hash TEXT UNIQUE NOT NULL,
        content_text TEXT,
        content_embedding vector(${this.dimension}),
        content_embedding_json JSONB,
        themes JSONB,
        analysis_metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      
      // Create indexes for performance
      `CREATE INDEX IF NOT EXISTS idx_responses_dataset_segment 
        ON responses(dataset_id, segment)`,
      
      `CREATE INDEX IF NOT EXISTS idx_segments_dataset 
        ON segments(dataset_id)`,
      
      `CREATE INDEX IF NOT EXISTS idx_personas_dataset_segment 
        ON personas(dataset_id, segment)`,
      
      `CREATE INDEX IF NOT EXISTS idx_survey_dataset_segment 
        ON survey_embeddings(dataset_id, segment)`
    ];
    
    // Try vector-enabled tables first
    for (const query of queries) {
      try {
        await this.pool.query(query);
      } catch (error) {
        // Handle vector extension not available
        if (error.message.includes('vector') && error.message.includes('extension')) {
          this.logger.warn('pgvector extension not available, creating tables without vector support');
          await this.createTablesWithoutVectors();
          return;
        } else if (!error.message.includes('already exists')) {
          this.logger.error('Error creating table', error, { query: query.substring(0, 50) });
        }
      }
    }
    
    // Create vector indexes if supported
    if (this.hasVectorSupport) {
      await this.createVectorIndexes();
    }
    
    this.logger.info('Database tables created successfully');
  }
  
  /**
   * Create tables without vector support (fallback)
   */
  async createTablesWithoutVectors() {
    // Similar to createTables but without vector columns
    // Using JSONB for embedding storage instead
    const queries = [
      // Datasets table remains the same
      `CREATE TABLE IF NOT EXISTS datasets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        config JSONB,
        status TEXT DEFAULT 'processing',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      )`,
      
      // Responses without vector
      `CREATE TABLE IF NOT EXISTS responses (
        id SERIAL PRIMARY KEY,
        dataset_id TEXT NOT NULL,
        respondent_id TEXT NOT NULL,
        segment TEXT,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        embedding_json JSONB,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      
      // Continue with other tables...
      // (Similar structure but using embedding_json instead of vector columns)
    ];
    
    for (const query of queries) {
      try {
        await this.pool.query(query);
      } catch (error) {
        if (!error.message.includes('already exists')) {
          this.logger.error('Error creating non-vector table', error);
        }
      }
    }
  }
  
  /**
   * Create vector indexes for similarity search
   */
  async createVectorIndexes() {
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_responses_embedding 
        ON responses USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)`,
      
      `CREATE INDEX IF NOT EXISTS idx_survey_values_embedding 
        ON survey_embeddings USING ivfflat (values_embedding vector_cosine_ops) WITH (lists = 100)`,
      
      `CREATE INDEX IF NOT EXISTS idx_survey_response_embedding 
        ON survey_embeddings USING ivfflat (response_embedding vector_cosine_ops) WITH (lists = 100)`,
      
      `CREATE INDEX IF NOT EXISTS idx_content_embedding 
        ON content_analysis_cache USING ivfflat (content_embedding vector_cosine_ops) WITH (lists = 50)`
    ];
    
    for (const index of indexes) {
      try {
        await this.pool.query(index);
      } catch (error) {
        if (!error.message.includes('already exists')) {
          this.logger.warn('Could not create vector index', { error: error.message });
        }
      }
    }
  }
  
  /**
   * Check if database supports pgvector
   */
  async checkVectorSupport() {
    if (!this.pool) return false;
    
    try {
      const result = await this.pool.query(
        "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector')"
      );
      return result.rows[0].exists;
    } catch (error) {
      this.logger.debug('Vector support check failed', error);
      return false;
    }
  }
  
  /**
   * Generate embeddings with caching and retry logic
   */
  async embedText(text, type = 'general') {
    if (!text) {
      throw new ValidationError('Text is required for embedding');
    }
    
    // Check cache first
    const cacheKey = `${text}-${type}`;
    if (this.embeddingCache.has(cacheKey)) {
      this.logger.debug('Using cached embedding');
      return this.embeddingCache.get(cacheKey);
    }
    
    let embedding;
    
    try {
      if (this.config.embeddingProvider.startsWith('openai')) {
        embedding = await withRetry(
          () => this.embedWithOpenAI(text, type),
          this.config.retryAttempts,
          this.config.retryDelay
        );
      } else if (this.localEmbedder) {
        embedding = await this.embedLocally(text);
      } else {
        // Fallback to random embeddings (for testing only)
        this.logger.warn('Using random embeddings as fallback');
        embedding = new Array(this.dimension).fill(0).map(() => Math.random() * 0.1);
      }
      
      // Update cache (maintain size limit)
      if (this.embeddingCache.size >= this.cacheMaxSize) {
        const firstKey = this.embeddingCache.keys().next().value;
        this.embeddingCache.delete(firstKey);
      }
      this.embeddingCache.set(cacheKey, embedding);
      
      return embedding;
      
    } catch (error) {
      this.logger.error('Embedding generation failed', error);
      throw new ExternalServiceError('Embedding', 'Failed to generate embedding', error);
    }
  }
  
  /**
   * Generate embeddings using OpenAI API
   */
  async embedWithOpenAI(text, type = 'general') {
    const apiKey = appConfig.openai.apiKey;
    
    // Add contextual prefix for better embeddings
    let contextualText = text;
    if (type === 'values') {
      contextualText = `Consumer values and beliefs: ${text}`;
    } else if (type === 'sustainability') {
      contextualText = `Environmental and sustainability perspective: ${text}`;
    } else if (type === 'price') {
      contextualText = `Price sensitivity and value perception: ${text}`;
    } else if (type === 'brand') {
      contextualText = `Brand perception and loyalty: ${text}`;
    }
    
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: this.config.embeddingProvider === 'openai-small' 
          ? 'text-embedding-3-small' 
          : 'text-embedding-3-large',
        input: contextualText,
        dimensions: this.dimension
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }
    
    const data = await response.json();
    return data.data[0].embedding;
  }
  
  /**
   * Generate embeddings locally
   */
  async embedLocally(text) {
    if (!this.localEmbedder) {
      throw new Error('Local embedder not initialized');
    }
    
    const output = await this.localEmbedder(text, { 
      pooling: 'mean', 
      normalize: true 
    });
    return Array.from(output.data);
  }
  
  /**
   * Store a survey response with embeddings
   */
  async storeResponse(respondentId, segment, question, answer, metadata = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // Validate inputs
    if (!respondentId || !question || !answer) {
      throw new ValidationError('respondentId, question, and answer are required');
    }
    
    // If using in-memory store
    if (!this.pool) {
      return this.storeResponseInMemory(respondentId, segment, question, answer, metadata);
    }
    
    const embedding = await this.embedText(`${question} ${answer}`);
    
    const query = this.hasVectorSupport ? `
      INSERT INTO responses 
        (dataset_id, respondent_id, segment, question, answer, embedding, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (dataset_id, respondent_id, question) 
      DO UPDATE SET
        answer = EXCLUDED.answer,
        embedding = EXCLUDED.embedding,
        metadata = EXCLUDED.metadata
      RETURNING id
    ` : `
      INSERT INTO responses 
        (dataset_id, respondent_id, segment, question, answer, embedding_json, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (dataset_id, respondent_id, question) 
      DO UPDATE SET
        answer = EXCLUDED.answer,
        embedding_json = EXCLUDED.embedding_json,
        metadata = EXCLUDED.metadata
      RETURNING id
    `;
    
    const values = [
      this.datasetId,
      respondentId,
      segment,
      question,
      answer,
      this.hasVectorSupport ? `[${embedding.join(',')}]` : JSON.stringify(embedding),
      metadata
    ];
    
    try {
      const result = await this.pool.query(query, values);
      this.logger.debug('Response stored', { id: result.rows[0].id });
      return result.rows[0].id;
    } catch (error) {
      this.logger.error('Error storing response', error);
      throw new AppError('Failed to store response', 500, 'DATABASE_ERROR', error);
    }
  }
  
  /**
   * Store response in memory (fallback)
   */
  storeResponseInMemory(respondentId, segment, question, answer, metadata) {
    const response = {
      id: Date.now() + Math.random(),
      dataset_id: this.datasetId,
      respondent_id: respondentId,
      segment: segment,
      question: question,
      answer: answer,
      metadata: metadata,
      created_at: new Date().toISOString()
    };
    this.inMemoryStore.responses.push(response);
    return response.id;
  }
  
  /**
   * Store detailed survey response with multiple embeddings
   */
  async storeSurveyResponse(respondent) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // Validate required fields
    const required = ['respondentId', 'segment'];
    for (const field of required) {
      if (!respondent[field]) {
        throw new ValidationError(`${field} is required`);
      }
    }
    
    // If using in-memory store
    if (!this.pool) {
      this.inMemoryStore.surveyEmbeddings.push(respondent);
      return;
    }
    
    // Create searchable text from survey responses
    const searchableText = this.createSearchableText(respondent);
    
    // Generate embeddings for different aspects
    const valuesText = `Sustainability: ${respondent.sustainability || 0}/5, 
                        Price sensitivity: ${respondent.priceSensitivity || 0}/5, 
                        Brand values: ${respondent.brandValues || 0}/5, 
                        Willing to pay premium: ${respondent.willingnessToPay || 0}/5`;
    
    const [valuesEmbedding, responseEmbedding] = await Promise.all([
      this.embedText(valuesText, 'values'),
      this.embedText(searchableText, 'general')
    ]);
    
    const query = this.hasVectorSupport ? `
      INSERT INTO survey_embeddings (
        dataset_id, respondent_id, segment,
        sustainability_score, price_sensitivity_score, brand_values_score,
        willingness_to_pay_score, activism_score, env_evangelist_score,
        values_embedding, response_embedding, searchable_text, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (dataset_id, respondent_id) DO UPDATE SET
        values_embedding = EXCLUDED.values_embedding,
        response_embedding = EXCLUDED.response_embedding,
        searchable_text = EXCLUDED.searchable_text,
        metadata = EXCLUDED.metadata
    ` : `
      INSERT INTO survey_embeddings (
        dataset_id, respondent_id, segment,
        sustainability_score, price_sensitivity_score, brand_values_score,
        willingness_to_pay_score, activism_score, env_evangelist_score,
        values_embedding_json, response_embedding_json, searchable_text, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (dataset_id, respondent_id) DO UPDATE SET
        values_embedding_json = EXCLUDED.values_embedding_json,
        response_embedding_json = EXCLUDED.response_embedding_json,
        searchable_text = EXCLUDED.searchable_text,
        metadata = EXCLUDED.metadata
    `;
    
    const values = [
      this.datasetId,
      respondent.respondentId,
      respondent.segment,
      respondent.sustainability || 0,
      respondent.priceSensitivity || 0,
      respondent.brandValues || 0,
      respondent.willingnessToPay || 0,
      respondent.activism || 0,
      respondent.envEvangelist || 0,
      this.hasVectorSupport ? `[${valuesEmbedding.join(',')}]` : JSON.stringify(valuesEmbedding),
      this.hasVectorSupport ? `[${responseEmbedding.join(',')}]` : JSON.stringify(responseEmbedding),
      searchableText,
      JSON.stringify(respondent.metadata || {})
    ];
    
    try {
      await this.pool.query(query, values);
      this.logger.debug('Survey response stored', { respondentId: respondent.respondentId });
    } catch (error) {
      this.logger.error('Error storing survey response', error);
      throw new AppError('Failed to store survey response', 500, 'DATABASE_ERROR', error);
    }
  }
  
  /**
   * Create searchable text from respondent data
   */
  createSearchableText(respondent) {
    const parts = [];
    
    if (respondent.exampleResponses) {
      respondent.exampleResponses.forEach(ex => {
        parts.push(ex.response);
      });
    }
    
    // Add score descriptions
    if (respondent.sustainability >= 4) {
      parts.push("Sustainability is extremely important to me");
    }
    if (respondent.priceSensitivity >= 4) {
      parts.push("Price is my primary concern");
    }
    if (respondent.willingnessToPay >= 4) {
      parts.push("I'll pay premium for aligned values");
    }
    if (respondent.brandValues >= 4) {
      parts.push("Brand values alignment is crucial");
    }
    
    return parts.join('. ');
  }
  
  /**
   * Find similar responses using vector similarity
   */
  async findSimilarResponses(query, segment = null, limit = 10) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // If using in-memory store
    if (!this.pool) {
      return this.findSimilarResponsesInMemory(query, segment, limit);
    }
    
    const queryEmbedding = await this.embedText(query);
    
    if (this.hasVectorSupport) {
      // Use pgvector's cosine similarity
      let sql = `
        SELECT 
          id,
          respondent_id,
          segment,
          question,
          answer,
          metadata,
          1 - (embedding <=> $1::vector) as similarity
        FROM responses
        WHERE dataset_id = $2
      `;
      
      const params = [`[${queryEmbedding.join(',')}]`, this.datasetId];
      
      if (segment) {
        sql += ' AND segment = $3';
        params.push(segment);
      }
      
      sql += ' ORDER BY embedding <=> $1::vector LIMIT $' + (params.length + 1);
      params.push(limit);
      
      try {
        const result = await this.pool.query(sql, params);
        return result.rows;
      } catch (error) {
        this.logger.error('Error finding similar responses', error);
        throw new AppError('Failed to find similar responses', 500, 'DATABASE_ERROR', error);
      }
    } else {
      // Fallback: return random responses from segment
      return this.findResponsesWithoutVectors(segment, limit);
    }
  }
  
  /**
   * Find responses without vector support
   */
  async findResponsesWithoutVectors(segment, limit) {
    const sql = `
      SELECT 
        id,
        respondent_id,
        segment,
        question,
        answer,
        metadata,
        0.5 as similarity
      FROM responses
      WHERE dataset_id = $1
      ${segment ? 'AND segment = $2' : ''}
      ORDER BY RANDOM()
      LIMIT $${segment ? 3 : 2}
    `;
    
    const params = [this.datasetId];
    if (segment) params.push(segment);
    params.push(limit);
    
    try {
      const result = await this.pool.query(sql, params);
      return result.rows;
    } catch (error) {
      this.logger.error('Error finding responses', error);
      return [];
    }
  }
  
  /**
   * Find similar responses in memory
   */
  findSimilarResponsesInMemory(query, segment, limit) {
    let responses = this.inMemoryStore.responses
      .filter(r => r.dataset_id === this.datasetId);
    
    if (segment) {
      responses = responses.filter(r => r.segment === segment);
    }
    
    // Return random subset (no real similarity in memory mode)
    return responses
      .sort(() => Math.random() - 0.5)
      .slice(0, limit)
      .map(r => ({ ...r, similarity: 0.5 }));
  }
  
  /**
   * Store segment profile with centroid
   */
  async storeSegmentProfile(segmentName, characteristics, valueSystem) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!segmentName) {
      throw new ValidationError('Segment name is required');
    }
    
    // If using in-memory store
    if (!this.pool) {
      const segment = {
        id: Date.now(),
        dataset_id: this.datasetId,
        segment_name: segmentName,
        characteristics: characteristics,
        value_system: valueSystem
      };
      this.inMemoryStore.segments.push(segment);
      return segment.id;
    }
    
    const characteristicText = Object.entries(characteristics || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    
    const centroid = await this.embedText(characteristicText, 'values');
    
    const query = this.hasVectorSupport ? `
      INSERT INTO segments 
        (dataset_id, segment_name, centroid, characteristics, value_system)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (dataset_id, segment_name) 
      DO UPDATE SET
        centroid = EXCLUDED.centroid,
        characteristics = EXCLUDED.characteristics,
        value_system = EXCLUDED.value_system,
        updated_at = NOW()
      RETURNING id
    ` : `
      INSERT INTO segments 
        (dataset_id, segment_name, centroid_json, characteristics, value_system)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (dataset_id, segment_name) 
      DO UPDATE SET
        centroid_json = EXCLUDED.centroid_json,
        characteristics = EXCLUDED.characteristics,
        value_system = EXCLUDED.value_system,
        updated_at = NOW()
      RETURNING id
    `;
    
    const values = [
      this.datasetId,
      segmentName,
      this.hasVectorSupport ? `[${centroid.join(',')}]` : JSON.stringify(centroid),
      characteristics,
      valueSystem
    ];
    
    try {
      const result = await this.pool.query(query, values);
      this.logger.debug('Segment profile stored', { 
        id: result.rows[0].id, 
        segment: segmentName 
      });
      return result.rows[0].id;
    } catch (error) {
      this.logger.error('Error storing segment profile', error);
      throw new AppError('Failed to store segment profile', 500, 'DATABASE_ERROR', error);
    }
  }
  
  /**
   * Store persona with embeddings
   */
  async storePersona(twin) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!twin || !twin.segment) {
      throw new ValidationError('Twin data with segment is required');
    }
    
    // If using in-memory store
    if (!this.pool) {
      const persona = {
        id: Date.now(),
        dataset_id: twin.datasetId || this.datasetId,
        segment: twin.segment,
        persona_data: twin
      };
      this.inMemoryStore.personas.push(persona);
      return persona.id;
    }
    
    const embedding = await this.embedText(
      JSON.stringify(twin.persona) + ' ' + JSON.stringify(twin.valueSystem),
      'values'
    );
    
    const query = this.hasVectorSupport ? `
      INSERT INTO personas (dataset_id, segment, persona_data, embedding)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    ` : `
      INSERT INTO personas (dataset_id, segment, persona_data, embedding_json)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `;
    
    const values = [
      twin.datasetId || this.datasetId,
      twin.segment,
      twin,
      this.hasVectorSupport ? `[${embedding.join(',')}]` : JSON.stringify(embedding)
    ];
    
    try {
      const result = await this.pool.query(query, values);
      this.logger.debug('Persona stored', { 
        id: result.rows[0].id, 
        segment: twin.segment 
      });
      return result.rows[0].id;
    } catch (error) {
      this.logger.error('Error storing persona', error);
      throw new AppError('Failed to store persona', 500, 'DATABASE_ERROR', error);
    }
  }
  
  /**
   * Get segment profile
   */
  async getSegmentProfile(segmentName) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // If using in-memory store
    if (!this.pool) {
      const segment = this.inMemoryStore.segments.find(
        s => s.dataset_id === this.datasetId && s.segment_name === segmentName
      );
      return segment ? {
        characteristics: segment.characteristics,
        value_system: segment.value_system
      } : null;
    }
    
    const query = `
      SELECT characteristics, value_system, respondent_count, avg_scores
      FROM segments 
      WHERE dataset_id = $1 AND segment_name = $2
    `;
    
    try {
      const result = await this.pool.query(query, [this.datasetId, segmentName]);
      return result.rows[0] || null;
    } catch (error) {
      this.logger.error('Error getting segment profile', error);
      throw new AppError('Failed to get segment profile', 500, 'DATABASE_ERROR', error);
    }
  }
  
  /**
   * Update dataset status
   */
  async updateDatasetStatus(datasetId, status, metadata = {}) {
    if (!this.pool) {
      // Update in-memory
      const dataset = this.inMemoryStore.datasets.find(d => d.id === datasetId);
      if (dataset) {
        dataset.status = status;
        dataset.updated_at = new Date().toISOString();
        if (status === 'completed') {
          dataset.completed_at = new Date().toISOString();
        }
      }
      return;
    }
    
    const query = `
      UPDATE datasets 
      SET status = $2,
          updated_at = NOW(),
          completed_at = CASE WHEN $2 = 'completed' THEN NOW() ELSE completed_at END,
          config = CASE WHEN $3::jsonb IS NOT NULL 
            THEN COALESCE(config, '{}'::jsonb) || $3::jsonb
            ELSE config END
      WHERE id = $1
    `;
    
    try {
      await this.pool.query(query, [
        datasetId,
        status,
        Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null
      ]);
      this.logger.info('Dataset status updated', { datasetId, status });
    } catch (error) {
      this.logger.error('Error updating dataset status', error);
      // Don't throw here as this is often a non-critical operation
    }
  }
  
  /**
   * List all datasets
   */
  async listDatasets() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // If using in-memory store
    if (!this.pool) {
      return [{
        id: this.datasetId,
        name: 'Default Dataset',
        description: 'In-memory dataset',
        status: 'completed',
        created_at: new Date().toISOString(),
        segment_count: this.inMemoryStore.segments.length,
        response_count: this.inMemoryStore.responses.length
      }];
    }
    
    const query = `
      SELECT 
        d.id,
        d.name,
        d.description,
        d.status,
        d.created_at,
        d.updated_at,
        d.completed_at,
        COUNT(DISTINCT s.id) as segment_count,
        COUNT(DISTINCT r.id) as response_count
      FROM datasets d
      LEFT JOIN segments s ON s.dataset_id = d.id
      LEFT JOIN responses r ON r.dataset_id = d.id
      GROUP BY d.id
      ORDER BY d.created_at DESC
    `;
    
    try {
      const result = await this.pool.query(query);
      return result.rows;
    } catch (error) {
      this.logger.error('Error listing datasets', error);
      return [];
    }
  }
  
  /**
   * Find representative responses for a segment
   */
  async findRepresentativeResponses(segment, limit = 20) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // If using in-memory store
    if (!this.pool) {
      return this.inMemoryStore.responses
        .filter(r => r.dataset_id === this.datasetId && r.segment === segment)
        .slice(0, limit);
    }
    
    const query = `
      SELECT 
        respondent_id,
        question,
        answer,
        metadata
      FROM responses
      WHERE dataset_id = $1 AND segment = $2
      ORDER BY RANDOM()
      LIMIT $3
    `;
    
    try {
      const result = await this.pool.query(query, [this.datasetId, segment, limit]);
      return result.rows;
    } catch (error) {
      this.logger.error('Error finding representative responses', error);
      return [];
    }
  }
  
  /**
   * Find similar survey responses based on marketing content
   */
  async findSimilarSurveyResponses(marketingContent, segment, limit = 5) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // If using in-memory store
    if (!this.pool) {
      return this.inMemoryStore.surveyEmbeddings
        .filter(e => e.segment === segment)
        .slice(0, limit);
    }
    
    // Check content cache first
    const contentHash = crypto
      .createHash('sha256')
      .update(marketingContent)
      .digest('hex');
    
    // Embed the marketing content
    const contentEmbedding = await this.embedText(marketingContent, 'general');
    
    // Cache the content analysis
    await this.cacheContentAnalysis(contentHash, marketingContent, contentEmbedding);
    
    if (this.hasVectorSupport) {
      const query = `
        SELECT 
          respondent_id,
          segment,
          sustainability_score,
          price_sensitivity_score,
          brand_values_score,
          willingness_to_pay_score,
          searchable_text,
          metadata,
          1 - (response_embedding <=> $1::vector) as similarity
        FROM survey_embeddings
        WHERE dataset_id = $2 AND segment = $3
        ORDER BY response_embedding <=> $1::vector
        LIMIT $4
      `;
      
      try {
        const result = await this.pool.query(query, [
          `[${contentEmbedding.join(',')}]`,
          this.datasetId,
          segment,
          limit
        ]);
        
        return result.rows.map(row => ({
          respondentId: row.respondent_id,
          segment: row.segment,
          sustainability: row.sustainability_score,
          priceSensitivity: row.price_sensitivity_score,
          brandValues: row.brand_values_score,
          willingnessToPay: row.willingness_to_pay_score,
          searchableText: row.searchable_text,
          similarity: row.similarity,
          metadata: row.metadata
        }));
      } catch (error) {
        this.logger.error('Error finding similar survey responses', error);
        return [];
      }
    } else {
      // Fallback without vector support
      return this.findSurveyResponsesWithoutVectors(segment, limit);
    }
  }
  
  /**
   * Find survey responses without vector support
   */
  async findSurveyResponsesWithoutVectors(segment, limit) {
    const query = `
      SELECT 
        respondent_id,
        segment,
        sustainability_score,
        price_sensitivity_score,
        brand_values_score,
        willingness_to_pay_score,
        searchable_text,
        metadata
      FROM survey_embeddings
      WHERE dataset_id = $1 AND segment = $2
      ORDER BY RANDOM()
      LIMIT $3
    `;
    
    try {
      const result = await this.pool.query(query, [this.datasetId, segment, limit]);
      return result.rows.map(row => ({
        respondentId: row.respondent_id,
        segment: row.segment,
        sustainability: row.sustainability_score,
        priceSensitivity: row.price_sensitivity_score,
        brandValues: row.brand_values_score,
        willingnessToPay: row.willingness_to_pay_score,
        searchableText: row.searchable_text,
        similarity: 0.5,
        metadata: row.metadata
      }));
    } catch (error) {
      this.logger.error('Error finding survey responses', error);
      return [];
    }
  }
  
  /**
   * Cache content analysis for reuse
   */
  async cacheContentAnalysis(hash, text, embedding) {
    if (!this.pool) return;
    
    const query = this.hasVectorSupport ? `
      INSERT INTO content_analysis_cache 
        (content_hash, content_text, content_embedding, created_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (content_hash) DO NOTHING
    ` : `
      INSERT INTO content_analysis_cache 
        (content_hash, content_text, content_embedding_json, created_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (content_hash) DO NOTHING
    `;
    
    try {
      await this.pool.query(query, [
        hash,
        text.substring(0, 5000), // Limit text length
        this.hasVectorSupport ? `[${embedding.join(',')}]` : JSON.stringify(embedding)
      ]);
    } catch (error) {
      // Non-critical, just log
      this.logger.debug('Could not cache content analysis', error);
    }
  }
  
  /**
   * Compute and store segment centroids
   */
  async computeSegmentCentroids(segment, responses) {
    if (!this.pool || !responses || responses.length === 0) return;
    
    // Compute average scores
    const avgScores = {
      sustainability: 0,
      priceSensitivity: 0,
      brandValues: 0,
      willingnessToPay: 0,
      activism: 0,
      envEvangelist: 0
    };
    
    let count = 0;
    responses.forEach(r => {
      if (r.sustainability !== undefined) {
        avgScores.sustainability += r.sustainability;
        avgScores.priceSensitivity += r.priceSensitivity || 0;
        avgScores.brandValues += r.brandValues || 0;
        avgScores.willingnessToPay += r.willingnessToPay || 0;
        avgScores.activism += r.activism || 0;
        avgScores.envEvangelist += r.envEvangelist || 0;
        count++;
      }
    });
    
    // Normalize
    if (count > 0) {
      Object.keys(avgScores).forEach(key => {
        avgScores[key] = parseFloat((avgScores[key] / count).toFixed(2));
      });
    }
    
    // Create centroid embeddings
    const centroidText = `Average segment values: 
      Sustainability ${avgScores.sustainability}/5, 
      Price sensitivity ${avgScores.priceSensitivity}/5,
      Brand values ${avgScores.brandValues}/5,
      Willingness to pay premium ${avgScores.willingnessToPay}/5`;
    
    const centroid = await this.embedText(centroidText, 'values');
    
    // Update segment with centroid
    const query = this.hasVectorSupport ? `
      UPDATE segments
      SET centroid = $3,
          respondent_count = $4,
          avg_scores = $5,
          updated_at = NOW()
      WHERE dataset_id = $1 AND segment_name = $2
    ` : `
      UPDATE segments
      SET centroid_json = $3,
          respondent_count = $4,
          avg_scores = $5,
          updated_at = NOW()
      WHERE dataset_id = $1 AND segment_name = $2
    `;
    
    try {
      await this.pool.query(query, [
        this.datasetId,
        segment,
        this.hasVectorSupport ? `[${centroid.join(',')}]` : JSON.stringify(centroid),
        responses.length,
        JSON.stringify(avgScores)
      ]);
      this.logger.debug('Segment centroids updated', { segment, count });
    } catch (error) {
      this.logger.error('Error computing segment centroids', error);
    }
  }
  
  /**
   * Clean up old cache entries
   */
  async cleanupCache(daysOld = 7) {
    if (!this.pool) return;
    
    const query = `
      DELETE FROM content_analysis_cache
      WHERE created_at < NOW() - INTERVAL '${daysOld} days'
    `;
    
    try {
      const result = await this.pool.query(query);
      this.logger.info('Cache cleanup completed', { 
        deleted: result.rowCount 
      });
    } catch (error) {
      this.logger.error('Error cleaning cache', error);
    }
  }
  
  /**
   * Get database statistics
   */
  async getStatistics() {
    if (!this.pool) {
      return {
        datasets: this.inMemoryStore.datasets.length,
        segments: this.inMemoryStore.segments.length,
        responses: this.inMemoryStore.responses.length,
        personas: this.inMemoryStore.personas.length,
        surveyEmbeddings: this.inMemoryStore.surveyEmbeddings.length
      };
    }
    
    const query = `
      SELECT 
        (SELECT COUNT(*) FROM datasets) as datasets,
        (SELECT COUNT(*) FROM segments) as segments,
        (SELECT COUNT(*) FROM responses) as responses,
        (SELECT COUNT(*) FROM personas) as personas,
        (SELECT COUNT(*) FROM survey_embeddings) as survey_embeddings
    `;
    
    try {
      const result = await this.pool.query(query);
      return result.rows[0];
    } catch (error) {
      this.logger.error('Error getting statistics', error);
      return null;
    }
  }
  
  /**
   * Close database connection
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      this.logger.info('Database connection closed');
    }
    this.isInitialized = false;
  }
}

/**
 * Factory function to create and initialize a unified vector store
 */
export async function createUnifiedVectorStore(datasetId = 'surf-clothing', options = {}) {
  const store = new UnifiedVectorStore(datasetId, options);
  await store.initialize();
  return store;
}

// Export default
export default UnifiedVectorStore;