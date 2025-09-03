import pg from 'pg';
import { pipeline } from '@xenova/transformers';

const { Pool } = pg;

export class VectorStore {
  constructor(datasetId) {
    this.datasetId = datasetId;
    this.pool = null;
    this.embedder = null;
  }
  
  async initialize() {
    // Initialize PostgreSQL connection pool
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    
    // Test connection
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      console.log('Database connected successfully');
    } catch (error) {
      console.error('Database connection failed:', error);
      throw error;
    }
    
    // Create tables with pgvector extension
    await this.createTables();
    
    // Initialize embedder (using Transformers.js for local embeddings)
    try {
      this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      console.log('Embedder initialized successfully');
    } catch (error) {
      console.warn('Failed to initialize embedder:', error);
      // Continue without embeddings for now
    }
  }
  
  async createTables() {
    const queries = [
      // Enable pgvector extension
      'CREATE EXTENSION IF NOT EXISTS vector',
      
      // Responses table
      `CREATE TABLE IF NOT EXISTS responses (
        id SERIAL PRIMARY KEY,
        dataset_id TEXT NOT NULL,
        respondent_id TEXT NOT NULL,
        segment TEXT,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        embedding vector(384),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      
      // Segments table
      `CREATE TABLE IF NOT EXISTS segments (
        id SERIAL PRIMARY KEY,
        dataset_id TEXT NOT NULL,
        segment_name TEXT NOT NULL,
        centroid vector(384),
        characteristics JSONB,
        value_system JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(dataset_id, segment_name)
      )`,
      
      // Personas table
      `CREATE TABLE IF NOT EXISTS personas (
        id SERIAL PRIMARY KEY,
        dataset_id TEXT NOT NULL,
        segment TEXT NOT NULL,
        persona_data JSONB,
        embedding vector(384),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      
      // Datasets table
      `CREATE TABLE IF NOT EXISTS datasets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        config JSONB,
        status TEXT DEFAULT 'processing',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      )`,
      
      // Create indexes
      `CREATE INDEX IF NOT EXISTS idx_responses_dataset_segment 
        ON responses(dataset_id, segment)`,
      
      `CREATE INDEX IF NOT EXISTS idx_segments_dataset 
        ON segments(dataset_id)`,
      
      `CREATE INDEX IF NOT EXISTS idx_personas_dataset_segment 
        ON personas(dataset_id, segment)`
    ];
    
    for (const query of queries) {
      try {
        await this.pool.query(query);
      } catch (error) {
        // Check if error is about vector extension not available
        if (error.message.includes('vector') && error.message.includes('extension')) {
          console.warn('pgvector extension not available, continuing without vector support');
          // Create tables without vector columns
          await this.createTablesWithoutVectors();
          break;
        } else if (!error.message.includes('already exists')) {
          console.error('Error creating table:', error.message);
        }
      }
    }
    
    console.log('Database tables created successfully');
  }
  
  async createTablesWithoutVectors() {
    const queries = [
      // Responses table without vector
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
      
      // Segments table without vector
      `CREATE TABLE IF NOT EXISTS segments (
        id SERIAL PRIMARY KEY,
        dataset_id TEXT NOT NULL,
        segment_name TEXT NOT NULL,
        centroid_json JSONB,
        characteristics JSONB,
        value_system JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(dataset_id, segment_name)
      )`,
      
      // Personas table without vector
      `CREATE TABLE IF NOT EXISTS personas (
        id SERIAL PRIMARY KEY,
        dataset_id TEXT NOT NULL,
        segment TEXT NOT NULL,
        persona_data JSONB,
        embedding_json JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
      
      // Datasets table
      `CREATE TABLE IF NOT EXISTS datasets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        config JSONB,
        status TEXT DEFAULT 'processing',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      )`,
      
      // Create indexes
      `CREATE INDEX IF NOT EXISTS idx_responses_dataset_segment 
        ON responses(dataset_id, segment)`,
      
      `CREATE INDEX IF NOT EXISTS idx_segments_dataset 
        ON segments(dataset_id)`,
      
      `CREATE INDEX IF NOT EXISTS idx_personas_dataset_segment 
        ON personas(dataset_id, segment)`
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
  }
  
  async embedText(text) {
    if (!this.embedder) {
      // Return placeholder embedding if embedder not available
      return new Array(384).fill(0).map(() => Math.random() * 0.1);
    }
    
    try {
      const output = await this.embedder(text, { pooling: 'mean', normalize: true });
      return Array.from(output.data);
    } catch (error) {
      console.error('Embedding error:', error);
      return new Array(384).fill(0).map(() => Math.random() * 0.1);
    }
  }
  
  async storeResponse(respondentId, segment, question, answer, metadata = {}) {
    const embedding = await this.embedText(`${question} ${answer}`);
    
    // Check if we have vector support
    const hasVectorSupport = await this.checkVectorSupport();
    
    let query, values;
    
    if (hasVectorSupport) {
      query = `
        INSERT INTO responses 
          (dataset_id, respondent_id, segment, question, answer, embedding, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `;
      values = [
        this.datasetId,
        respondentId,
        segment,
        question,
        answer,
        `[${embedding.join(',')}]`,
        metadata
      ];
    } else {
      query = `
        INSERT INTO responses 
          (dataset_id, respondent_id, segment, question, answer, embedding_json, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `;
      values = [
        this.datasetId,
        respondentId,
        segment,
        question,
        answer,
        JSON.stringify(embedding),
        metadata
      ];
    }
    
    try {
      const result = await this.pool.query(query, values);
      return result.rows[0].id;
    } catch (error) {
      console.error('Error storing response:', error);
      return null;
    }
  }
  
  async checkVectorSupport() {
    try {
      const result = await this.pool.query(
        "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector')"
      );
      return result.rows[0].exists;
    } catch {
      return false;
    }
  }
  
  async findSimilarResponses(query, segment = null, limit = 10) {
    const queryEmbedding = await this.embedText(query);
    const hasVectorSupport = await this.checkVectorSupport();
    
    if (hasVectorSupport) {
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
        console.error('Error finding similar responses:', error);
        return [];
      }
    } else {
      // Fallback: return random responses from segment
      let sql = `
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
      `;
      
      const params = [this.datasetId];
      
      if (segment) {
        sql += ' AND segment = $2';
        params.push(segment);
      }
      
      sql += ' ORDER BY RANDOM() LIMIT $' + (params.length + 1);
      params.push(limit);
      
      try {
        const result = await this.pool.query(sql, params);
        return result.rows;
      } catch (error) {
        console.error('Error finding responses:', error);
        return [];
      }
    }
  }
  
  async storeSegmentProfile(segmentName, characteristics, valueSystem) {
    const characteristicText = Object.entries(characteristics)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    
    const centroid = await this.embedText(characteristicText);
    const hasVectorSupport = await this.checkVectorSupport();
    
    let query, values;
    
    if (hasVectorSupport) {
      query = `
        INSERT INTO segments 
          (dataset_id, segment_name, centroid, characteristics, value_system)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (dataset_id, segment_name) 
        DO UPDATE SET
          centroid = EXCLUDED.centroid,
          characteristics = EXCLUDED.characteristics,
          value_system = EXCLUDED.value_system
        RETURNING id
      `;
      values = [
        this.datasetId,
        segmentName,
        `[${centroid.join(',')}]`,
        characteristics,
        valueSystem
      ];
    } else {
      query = `
        INSERT INTO segments 
          (dataset_id, segment_name, centroid_json, characteristics, value_system)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (dataset_id, segment_name) 
        DO UPDATE SET
          centroid_json = EXCLUDED.centroid_json,
          characteristics = EXCLUDED.characteristics,
          value_system = EXCLUDED.value_system
        RETURNING id
      `;
      values = [
        this.datasetId,
        segmentName,
        JSON.stringify(centroid),
        characteristics,
        valueSystem
      ];
    }
    
    try {
      const result = await this.pool.query(query, values);
      return result.rows[0].id;
    } catch (error) {
      console.error('Error storing segment profile:', error);
      return null;
    }
  }
  
  async storePersona(twin) {
    const embedding = await this.embedText(
      JSON.stringify(twin.persona) + ' ' + JSON.stringify(twin.valueSystem)
    );
    const hasVectorSupport = await this.checkVectorSupport();
    
    let query, values;
    
    if (hasVectorSupport) {
      query = `
        INSERT INTO personas (dataset_id, segment, persona_data, embedding)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `;
      values = [
        twin.datasetId || this.datasetId,
        twin.segment,
        twin,
        `[${embedding.join(',')}]`
      ];
    } else {
      query = `
        INSERT INTO personas (dataset_id, segment, persona_data, embedding_json)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `;
      values = [
        twin.datasetId || this.datasetId,
        twin.segment,
        twin,
        JSON.stringify(embedding)
      ];
    }
    
    try {
      const result = await this.pool.query(query, values);
      return result.rows[0].id;
    } catch (error) {
      console.error('Error storing persona:', error);
      return null;
    }
  }
  
  async getSegmentProfile(segmentName) {
    const query = `
      SELECT characteristics, value_system 
      FROM segments 
      WHERE dataset_id = $1 AND segment_name = $2
    `;
    
    try {
      const result = await this.pool.query(query, [this.datasetId, segmentName]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting segment profile:', error);
      return null;
    }
  }
  
  async updateDatasetStatus(datasetId, status, error = null) {
    const query = `
      UPDATE datasets 
      SET status = $2, 
          completed_at = CASE WHEN $2 = 'completed' THEN NOW() ELSE NULL END,
          config = CASE WHEN $3 IS NOT NULL 
            THEN jsonb_set(COALESCE(config, '{}'), '{error}', $3::jsonb) 
            ELSE config END
      WHERE id = $1
    `;
    
    try {
      await this.pool.query(query, [
        datasetId,
        status,
        error ? JSON.stringify(error) : null
      ]);
    } catch (error) {
      console.error('Error updating dataset status:', error);
    }
  }
  
  async listDatasets() {
    const query = `
      SELECT 
        d.id,
        d.name,
        d.description,
        d.status,
        d.created_at,
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
      console.error('Error listing datasets:', error);
      return [];
    }
  }
  
  async findRepresentativeResponses(segment, limit = 20) {
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
      console.error('Error finding representative responses:', error);
      return [];
    }
  }
  
  async close() {
    if (this.pool) {
      await this.pool.end();
    }
  }
}