import pg from 'pg';
import fetch from 'node-fetch';
import { pipeline } from '@xenova/transformers';

const { Pool } = pg;

export class EnhancedVectorStore {
  constructor(datasetId, embeddingProvider = 'openai') {
    this.datasetId = datasetId;
    this.pool = null;
    this.embeddingProvider = embeddingProvider;
    this.localEmbedder = null;
    
    // Embedding dimensions by provider
    this.embeddingDimensions = {
      'openai': 3072,          // text-embedding-3-large
      'openai-small': 1536,    // text-embedding-3-small
      'local-minilm': 384,      // all-MiniLM-L6-v2
      'local-bge': 1024         // bge-large-en-v1.5
    };
    
    this.dimension = this.embeddingDimensions[embeddingProvider] || 384;
  }
  
  async initialize() {
    // Initialize PostgreSQL with pgvector
    try {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://localhost/digital_twins',
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
      
      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      console.log('Database connected successfully');
      
      // Create tables with pgvector
      await this.createTables();
    } catch (error) {
      console.warn('Database connection failed, using in-memory fallback:', error.message);
      this.pool = null;
      this.inMemoryStore = {
        responses: [],
        segments: [],
        personas: [],
        surveyEmbeddings: []
      };
    }
    
    // Initialize embedder based on provider
    if (this.embeddingProvider.startsWith('local')) {
      try {
        const model = this.embeddingProvider === 'local-bge' 
          ? 'BAAI/bge-large-en-v1.5'
          : 'Xenova/all-MiniLM-L6-v2';
        
        this.localEmbedder = await pipeline('feature-extraction', model);
        console.log(`Local embedder initialized: ${model}`);
      } catch (error) {
        console.warn('Failed to initialize local embedder:', error.message);
      }
    }
  }
  
  async createTables() {
    const queries = [
      // Enable pgvector extension
      'CREATE EXTENSION IF NOT EXISTS vector',
      
      // Survey embeddings table - stores actual survey responses with embeddings
      `CREATE TABLE IF NOT EXISTS survey_embeddings (
        id SERIAL PRIMARY KEY,
        dataset_id TEXT NOT NULL,
        respondent_id TEXT NOT NULL,
        segment TEXT NOT NULL,
        
        -- Survey scores
        sustainability_score FLOAT,
        price_sensitivity_score FLOAT,
        brand_values_score FLOAT,
        willingness_to_pay_score FLOAT,
        activism_score FLOAT,
        env_evangelist_score FLOAT,
        
        -- Embeddings for semantic search
        values_embedding vector(${this.dimension}),  -- Overall values profile
        response_embedding vector(${this.dimension}), -- Specific responses
        
        -- Searchable text
        searchable_text TEXT,
        
        -- Metadata
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      
      // Segment centroids - average embeddings per segment
      `CREATE TABLE IF NOT EXISTS segment_centroids (
        id SERIAL PRIMARY KEY,
        dataset_id TEXT NOT NULL,
        segment_name TEXT NOT NULL,
        
        -- Centroid embeddings
        values_centroid vector(${this.dimension}),
        sustainability_centroid vector(${this.dimension}),
        price_centroid vector(${this.dimension}),
        brand_centroid vector(${this.dimension}),
        
        -- Statistics
        respondent_count INT,
        avg_scores JSONB,
        
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(dataset_id, segment_name)
      )`,
      
      // Marketing content analysis cache
      `CREATE TABLE IF NOT EXISTS content_analysis_cache (
        id SERIAL PRIMARY KEY,
        content_hash TEXT UNIQUE,
        content_text TEXT,
        content_embedding vector(${this.dimension}),
        themes JSONB,
        analysis_metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      
      // Create indexes for similarity search
      `CREATE INDEX IF NOT EXISTS idx_survey_values_embedding 
        ON survey_embeddings USING ivfflat (values_embedding vector_cosine_ops) WITH (lists = 100)`,
      
      `CREATE INDEX IF NOT EXISTS idx_survey_response_embedding 
        ON survey_embeddings USING ivfflat (response_embedding vector_cosine_ops) WITH (lists = 100)`,
      
      `CREATE INDEX IF NOT EXISTS idx_content_embedding 
        ON content_analysis_cache USING ivfflat (content_embedding vector_cosine_ops) WITH (lists = 50)`
    ];
    
    for (const query of queries) {
      try {
        await this.pool.query(query);
      } catch (error) {
        if (!error.message.includes('already exists')) {
          console.error('Error creating table:', error.message);
        }
      }
    }
    
    console.log('Enhanced vector store tables created successfully');
  }
  
  async embedText(text, type = 'general') {
    if (this.embeddingProvider.startsWith('openai')) {
      return await this.embedWithOpenAI(text, type);
    } else if (this.localEmbedder) {
      return await this.embedLocally(text);
    } else {
      // Fallback to random embeddings
      return new Array(this.dimension).fill(0).map(() => Math.random() * 0.1);
    }
  }
  
  async embedWithOpenAI(text, type = 'general') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('OpenAI API key not found, using fallback');
      return new Array(this.dimension).fill(0).map(() => Math.random() * 0.1);
    }
    
    try {
      // Add context prefix for better values-based embeddings
      let contextualText = text;
      if (type === 'values') {
        contextualText = `Consumer values and beliefs: ${text}`;
      } else if (type === 'sustainability') {
        contextualText = `Environmental and sustainability perspective: ${text}`;
      } else if (type === 'price') {
        contextualText = `Price sensitivity and value perception: ${text}`;
      }
      
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: this.embeddingProvider === 'openai-small' 
            ? 'text-embedding-3-small' 
            : 'text-embedding-3-large',
          input: contextualText,
          dimensions: this.dimension // OpenAI allows dimension reduction
        })
      });
      
      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }
      
      const data = await response.json();
      return data.data[0].embedding;
      
    } catch (error) {
      console.error('Error getting OpenAI embedding:', error);
      return new Array(this.dimension).fill(0).map(() => Math.random() * 0.1);
    }
  }
  
  async embedLocally(text) {
    if (!this.localEmbedder) return null;
    
    try {
      const output = await this.localEmbedder(text, { pooling: 'mean', normalize: true });
      return Array.from(output.data);
    } catch (error) {
      console.error('Local embedding error:', error);
      return new Array(this.dimension).fill(0).map(() => Math.random() * 0.1);
    }
  }
  
  async storeSurveyResponse(respondent) {
    if (!this.pool) {
      // In-memory storage
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
    
    const valuesEmbedding = await this.embedText(valuesText, 'values');
    const responseEmbedding = await this.embedText(searchableText, 'general');
    
    const query = `
      INSERT INTO survey_embeddings (
        dataset_id, respondent_id, segment,
        sustainability_score, price_sensitivity_score, brand_values_score,
        willingness_to_pay_score, activism_score, env_evangelist_score,
        values_embedding, response_embedding, searchable_text, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (respondent_id) DO UPDATE SET
        values_embedding = EXCLUDED.values_embedding,
        response_embedding = EXCLUDED.response_embedding
    `;
    
    const values = [
      this.datasetId,
      respondent.respondentId,
      respondent.segment,
      respondent.sustainability,
      respondent.priceSensitivity,
      respondent.brandValues,
      respondent.willingnessToPay,
      respondent.activism,
      respondent.envEvangelist,
      `[${valuesEmbedding.join(',')}]`,
      `[${responseEmbedding.join(',')}]`,
      searchableText,
      JSON.stringify(respondent.metadata || {})
    ];
    
    try {
      await this.pool.query(query, values);
    } catch (error) {
      console.error('Error storing survey response:', error);
    }
  }
  
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
    
    return parts.join('. ');
  }
  
  async findSimilarSurveyResponses(marketingContent, segment, limit = 5) {
    if (!this.pool) {
      // In-memory search
      return this.inMemoryStore.surveyEmbeddings
        .filter(e => e.segment === segment)
        .slice(0, limit);
    }
    
    // Embed the marketing content
    const contentEmbedding = await this.embedText(marketingContent, 'general');
    
    // Search using pgvector's similarity operators
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
      console.error('Error finding similar responses:', error);
      return [];
    }
  }
  
  async computeSegmentCentroids(segment, responses) {
    if (!this.pool || responses.length === 0) return;
    
    // Compute average embeddings for the segment
    const avgScores = {
      sustainability: 0,
      priceSensitivity: 0,
      brandValues: 0,
      willingnessToPay: 0
    };
    
    let count = 0;
    responses.forEach(r => {
      if (r.sustainability) {
        avgScores.sustainability += r.sustainability;
        count++;
      }
      if (r.priceSensitivity) avgScores.priceSensitivity += r.priceSensitivity;
      if (r.brandValues) avgScores.brandValues += r.brandValues;
      if (r.willingnessToPay) avgScores.willingnessToPay += r.willingnessToPay;
    });
    
    // Normalize
    Object.keys(avgScores).forEach(key => {
      avgScores[key] = count > 0 ? (avgScores[key] / count).toFixed(2) : 0;
    });
    
    // Create centroid embeddings
    const valuesCentroid = await this.embedText(
      `Average values: Sustainability ${avgScores.sustainability}/5, Price sensitivity ${avgScores.priceSensitivity}/5`,
      'values'
    );
    
    const query = `
      INSERT INTO segment_centroids (
        dataset_id, segment_name, values_centroid, 
        respondent_count, avg_scores
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (dataset_id, segment_name) DO UPDATE SET
        values_centroid = EXCLUDED.values_centroid,
        respondent_count = EXCLUDED.respondent_count,
        avg_scores = EXCLUDED.avg_scores
    `;
    
    try {
      await this.pool.query(query, [
        this.datasetId,
        segment,
        `[${valuesCentroid.join(',')}]`,
        responses.length,
        JSON.stringify(avgScores)
      ]);
    } catch (error) {
      console.error('Error computing segment centroids:', error);
    }
  }
  
  async close() {
    if (this.pool) {
      await this.pool.end();
    }
  }
}

// Export a factory function
export async function createEnhancedVectorStore(datasetId = 'surf-clothing', provider = 'openai') {
  const store = new EnhancedVectorStore(datasetId, provider);
  await store.initialize();
  return store;
}