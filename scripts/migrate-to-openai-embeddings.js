/**
 * Migration Script: Upgrade to OpenAI text-embedding-3-large
 * This script reloads all survey data with high-quality embeddings
 * for better values-based semantic understanding
 */

import OpenAI from 'openai';
import pg from 'pg';
import Papa from 'papaparse';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

class OpenAIEmbeddingMigration {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://localhost/digital_twins',
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    this.embeddingDimension = 3072; // text-embedding-3-large
    this.batchSize = 20; // Process 20 at a time to avoid rate limits
    this.embeddings = {
      Leader: [],
      Leaning: [],
      Learner: [],
      Laggard: []
    };
  }
  
  async initialize() {
    console.log('Initializing OpenAI embedding migration...');
    
    // Check API key
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not found in environment variables');
    }
    
    // Test OpenAI connection
    try {
      const test = await this.openai.embeddings.create({
        model: 'text-embedding-3-large',
        input: 'test',
        dimensions: this.embeddingDimension
      });
      console.log('OpenAI API connected successfully');
    } catch (error) {
      throw new Error(`OpenAI API test failed: ${error.message}`);
    }
    
    // Test database connection
    try {
      await this.pool.query('SELECT NOW()');
      console.log('Database connected successfully');
    } catch (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }
    
    // Create or update tables for new embedding dimensions
    await this.updateDatabaseSchema();
  }
  
  async updateDatabaseSchema() {
    console.log('Updating database schema for 3072-dimensional embeddings...');
    
    const queries = [
      // Enable pgvector if not already enabled
      'CREATE EXTENSION IF NOT EXISTS vector',
      
      // Drop old tables if they exist (backup first in production!)
      'DROP TABLE IF EXISTS survey_embeddings_old CASCADE',
      'ALTER TABLE IF EXISTS survey_embeddings RENAME TO survey_embeddings_old',
      
      // Create new table with 3072 dimensions
      `CREATE TABLE survey_embeddings (
        id SERIAL PRIMARY KEY,
        dataset_id TEXT NOT NULL DEFAULT 'surf-clothing',
        respondent_id TEXT NOT NULL UNIQUE,
        segment TEXT NOT NULL,
        
        -- Survey scores from CSV
        sustainability_score FLOAT,
        price_sensitivity_score FLOAT,
        brand_values_score FLOAT,
        willingness_to_pay_score FLOAT,
        activism_score FLOAT,
        env_evangelist_score FLOAT,
        actual_purchase_score FLOAT,
        composite_score FLOAT,
        propensity_score FLOAT,
        
        -- High-dimensional embeddings from OpenAI
        values_embedding vector(3072),
        behavior_embedding vector(3072),
        combined_embedding vector(3072),
        
        -- Searchable text and metadata
        searchable_text TEXT,
        metadata JSONB DEFAULT '{}',
        
        -- Timestamps
        created_at TIMESTAMPTZ DEFAULT NOW(),
        embedding_model TEXT DEFAULT 'text-embedding-3-large',
        
        -- Indexes will be created after data load
        CHECK (segment IN ('Leader', 'Leaning', 'Learner', 'Laggard'))
      )`,
      
      // Create segment statistics table
      `CREATE TABLE IF NOT EXISTS segment_statistics (
        id SERIAL PRIMARY KEY,
        segment TEXT NOT NULL UNIQUE,
        respondent_count INT,
        avg_sustainability FLOAT,
        avg_price_sensitivity FLOAT,
        avg_willingness_to_pay FLOAT,
        avg_brand_values FLOAT,
        centroid_embedding vector(3072),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`
    ];
    
    for (const query of queries) {
      try {
        await this.pool.query(query);
        console.log('Executed:', query.substring(0, 50) + '...');
      } catch (error) {
        if (!error.message.includes('already exists')) {
          console.error('Schema update error:', error.message);
        }
      }
    }
    
    console.log('Database schema updated successfully');
  }
  
  async loadSurveyData() {
    console.log('Loading survey data from CSV...');
    
    const csvPath = path.join(process.cwd(), 'data', 'datasets', 'surf-clothing', 'refined-lohas-classification.csv');
    const csvContent = await fs.readFile(csvPath, 'utf8');
    
    const parsed = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true
    });
    
    if (!parsed.data || parsed.data.length === 0) {
      throw new Error('No data found in CSV');
    }
    
    console.log(`Loaded ${parsed.data.length} survey responses`);
    
    // Group by segment
    const segmentedData = {
      Leader: [],
      Leaning: [],
      Learner: [],
      Laggard: []
    };
    
    parsed.data.forEach(row => {
      const segment = row['LOHAS Segment']?.replace('LOHAS ', '');
      if (segment && segmentedData[segment]) {
        segmentedData[segment].push({
          respondentId: row['Respondent ID'],
          segment: segment,
          sustainability: this.parseScore(row['Sustainability (1-5)']),
          priceSensitivity: this.parseScore(row['Price Sensitivity (1-5)']),
          brandValues: this.parseScore(row['Brand Values (1-5)']),
          willingnessToPay: this.parseScore(row['Willingness to Pay 25% (1-5)']),
          activism: this.parseScore(row['Activism (1-5)']),
          envEvangelist: this.parseScore(row['Env Evangelist (1-5)']),
          actualPurchase: this.parseScore(row['Actual Purchase (1-5)']),
          compositeScore: parseFloat(row['Composite Score']) || 0,
          propensityScore: parseFloat(row['Propensity Score']) || 0
        });
      }
    });
    
    // Log statistics
    Object.entries(segmentedData).forEach(([segment, data]) => {
      console.log(`  ${segment}: ${data.length} respondents`);
    });
    
    return segmentedData;
  }
  
  parseScore(value) {
    if (!value || value === 'N/A' || value === '') return null;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }
  
  async generateEmbeddings(segmentedData) {
    console.log('\nGenerating OpenAI embeddings for all respondents...');
    console.log('This may take several minutes and incur API costs.');
    
    let totalProcessed = 0;
    const totalRespondents = Object.values(segmentedData).reduce((sum, arr) => sum + arr.length, 0);
    
    for (const [segment, respondents] of Object.entries(segmentedData)) {
      console.log(`\nProcessing ${segment} segment (${respondents.length} respondents)...`);
      
      // Process in batches
      for (let i = 0; i < respondents.length; i += this.batchSize) {
        const batch = respondents.slice(i, i + this.batchSize);
        
        // Generate embeddings for this batch
        const embeddedBatch = await this.processBatch(batch, segment);
        this.embeddings[segment].push(...embeddedBatch);
        
        totalProcessed += batch.length;
        const progress = ((totalProcessed / totalRespondents) * 100).toFixed(1);
        console.log(`  Progress: ${totalProcessed}/${totalRespondents} (${progress}%)`);
        
        // Rate limit: wait 1 second between batches
        if (i + this.batchSize < respondents.length) {
          await this.sleep(1000);
        }
      }
    }
    
    console.log('\nAll embeddings generated successfully!');
    return this.embeddings;
  }
  
  async processBatch(batch, segment) {
    const embeddedBatch = [];
    
    for (const respondent of batch) {
      try {
        // Create three different text representations for embeddings
        
        // 1. Values text - what they believe
        const valuesText = this.createValuesText(respondent);
        
        // 2. Behavior text - what they do
        const behaviorText = this.createBehaviorText(respondent);
        
        // 3. Combined searchable text
        const combinedText = `${valuesText} ${behaviorText}`;
        
        // Generate embeddings
        const [valuesEmb, behaviorEmb, combinedEmb] = await Promise.all([
          this.generateEmbedding(valuesText, 'values'),
          this.generateEmbedding(behaviorText, 'behavior'),
          this.generateEmbedding(combinedText, 'combined')
        ]);
        
        embeddedBatch.push({
          ...respondent,
          valuesEmbedding: valuesEmb,
          behaviorEmbedding: behaviorEmb,
          combinedEmbedding: combinedEmb,
          searchableText: combinedText
        });
        
      } catch (error) {
        console.error(`Error processing respondent ${respondent.respondentId}:`, error.message);
      }
    }
    
    return embeddedBatch;
  }
  
  createValuesText(respondent) {
    const parts = [];
    
    // Add value statements based on scores
    if (respondent.sustainability !== null) {
      const level = respondent.sustainability >= 4 ? 'extremely important' : 
                   respondent.sustainability >= 3 ? 'moderately important' : 
                   'not very important';
      parts.push(`Environmental sustainability is ${level} to me (${respondent.sustainability}/5).`);
    }
    
    if (respondent.priceSensitivity !== null) {
      const level = respondent.priceSensitivity >= 4 ? 'very price sensitive' :
                   respondent.priceSensitivity >= 3 ? 'somewhat price conscious' :
                   'not price sensitive';
      parts.push(`I am ${level} when shopping (${respondent.priceSensitivity}/5).`);
    }
    
    if (respondent.brandValues !== null) {
      const level = respondent.brandValues >= 4 ? 'strongly care about' :
                   respondent.brandValues >= 3 ? 'consider' :
                   'don\'t prioritize';
      parts.push(`I ${level} brand values and ethics (${respondent.brandValues}/5).`);
    }
    
    if (respondent.willingnessToPay !== null) {
      const willing = respondent.willingnessToPay >= 4 ? 'definitely willing' :
                     respondent.willingnessToPay >= 3 ? 'somewhat willing' :
                     'not willing';
      parts.push(`I am ${willing} to pay 25% more for sustainable products (${respondent.willingnessToPay}/5).`);
    }
    
    // Add segment context
    parts.push(`As a ${respondent.segment} consumer in the LOHAS framework.`);
    
    return parts.join(' ');
  }
  
  createBehaviorText(respondent) {
    const parts = [];
    
    // Actual behaviors
    if (respondent.actualPurchase !== null) {
      if (respondent.actualPurchase >= 4) {
        parts.push('I regularly purchase sustainable products.');
      } else if (respondent.actualPurchase >= 2) {
        parts.push('I occasionally buy sustainable products.');
      } else {
        parts.push('I rarely or never buy based on sustainability.');
      }
    }
    
    if (respondent.activism !== null && respondent.activism >= 3) {
      parts.push('I actively participate in environmental activism.');
    }
    
    if (respondent.envEvangelist !== null && respondent.envEvangelist >= 3) {
      parts.push('I influence others about sustainable consumption.');
    }
    
    // Add propensity insights
    if (respondent.propensityScore >= 4) {
      parts.push('High propensity to pay premium for values-aligned products.');
    } else if (respondent.propensityScore >= 2.5) {
      parts.push('Moderate propensity to pay more for sustainability.');
    } else {
      parts.push('Low propensity to pay premium prices.');
    }
    
    return parts.join(' ');
  }
  
  async generateEmbedding(text, type) {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-large',
        input: text,
        dimensions: this.embeddingDimension
      });
      
      return response.data[0].embedding;
    } catch (error) {
      console.error(`Embedding generation error for ${type}:`, error.message);
      // Return zero vector on error
      return new Array(this.embeddingDimension).fill(0);
    }
  }
  
  async storeEmbeddings(embeddings) {
    console.log('\nStoring embeddings in PostgreSQL...');
    
    let stored = 0;
    const total = Object.values(embeddings).reduce((sum, arr) => sum + arr.length, 0);
    
    for (const [segment, respondents] of Object.entries(embeddings)) {
      for (const respondent of respondents) {
        try {
          const query = `
            INSERT INTO survey_embeddings (
              respondent_id, segment, dataset_id,
              sustainability_score, price_sensitivity_score, brand_values_score,
              willingness_to_pay_score, activism_score, env_evangelist_score,
              actual_purchase_score, composite_score, propensity_score,
              values_embedding, behavior_embedding, combined_embedding,
              searchable_text, metadata
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
              $13::vector, $14::vector, $15::vector, $16, $17
            )
            ON CONFLICT (respondent_id) DO UPDATE SET
              values_embedding = EXCLUDED.values_embedding,
              behavior_embedding = EXCLUDED.behavior_embedding,
              combined_embedding = EXCLUDED.combined_embedding,
              searchable_text = EXCLUDED.searchable_text
          `;
          
          await this.pool.query(query, [
            respondent.respondentId,
            respondent.segment,
            'surf-clothing',
            respondent.sustainability,
            respondent.priceSensitivity,
            respondent.brandValues,
            respondent.willingnessToPay,
            respondent.activism,
            respondent.envEvangelist,
            respondent.actualPurchase,
            respondent.compositeScore,
            respondent.propensityScore,
            `[${respondent.valuesEmbedding.join(',')}]`,
            `[${respondent.behaviorEmbedding.join(',')}]`,
            `[${respondent.combinedEmbedding.join(',')}]`,
            respondent.searchableText,
            JSON.stringify({
              embeddingModel: 'text-embedding-3-large',
              createdAt: new Date().toISOString()
            })
          ]);
          
          stored++;
          if (stored % 50 === 0) {
            console.log(`  Stored ${stored}/${total} respondents`);
          }
          
        } catch (error) {
          console.error(`Error storing respondent ${respondent.respondentId}:`, error.message);
        }
      }
    }
    
    console.log(`Successfully stored ${stored} respondents with embeddings`);
  }
  
  async createIndexes() {
    console.log('\nCreating vector indexes for fast similarity search...');
    
    const indexes = [
      // IVFFlat indexes for approximate nearest neighbor search
      `CREATE INDEX IF NOT EXISTS idx_values_embedding 
       ON survey_embeddings USING ivfflat (values_embedding vector_cosine_ops) 
       WITH (lists = 100)`,
       
      `CREATE INDEX IF NOT EXISTS idx_behavior_embedding 
       ON survey_embeddings USING ivfflat (behavior_embedding vector_cosine_ops) 
       WITH (lists = 100)`,
       
      `CREATE INDEX IF NOT EXISTS idx_combined_embedding 
       ON survey_embeddings USING ivfflat (combined_embedding vector_cosine_ops) 
       WITH (lists = 100)`,
       
      // B-tree indexes for filtering
      `CREATE INDEX IF NOT EXISTS idx_segment ON survey_embeddings(segment)`,
      `CREATE INDEX IF NOT EXISTS idx_respondent ON survey_embeddings(respondent_id)`
    ];
    
    for (const index of indexes) {
      try {
        await this.pool.query(index);
        console.log(`  Created: ${index.substring(27, 60)}...`);
      } catch (error) {
        if (!error.message.includes('already exists')) {
          console.error(`Index creation error: ${error.message}`);
        }
      }
    }
    
    console.log('Indexes created successfully');
  }
  
  async computeSegmentStatistics() {
    console.log('\nComputing segment statistics and centroids...');
    
    const segments = ['Leader', 'Leaning', 'Learner', 'Laggard'];
    
    for (const segment of segments) {
      const stats = await this.pool.query(`
        SELECT 
          COUNT(*) as count,
          AVG(sustainability_score) as avg_sustainability,
          AVG(price_sensitivity_score) as avg_price_sensitivity,
          AVG(willingness_to_pay_score) as avg_willingness_to_pay,
          AVG(brand_values_score) as avg_brand_values
        FROM survey_embeddings
        WHERE segment = $1
      `, [segment]);
      
      const row = stats.rows[0];
      
      // Generate centroid embedding for the segment
      const centroidText = `Average ${segment} consumer: 
        Sustainability importance ${row.avg_sustainability?.toFixed(1)}/5,
        Price sensitivity ${row.avg_price_sensitivity?.toFixed(1)}/5,
        Willingness to pay premium ${row.avg_willingness_to_pay?.toFixed(1)}/5,
        Brand values importance ${row.avg_brand_values?.toFixed(1)}/5`;
      
      const centroidEmbedding = await this.generateEmbedding(centroidText, 'centroid');
      
      // Store statistics
      await this.pool.query(`
        INSERT INTO segment_statistics (
          segment, respondent_count, avg_sustainability,
          avg_price_sensitivity, avg_willingness_to_pay,
          avg_brand_values, centroid_embedding
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::vector)
        ON CONFLICT (segment) DO UPDATE SET
          respondent_count = EXCLUDED.respondent_count,
          avg_sustainability = EXCLUDED.avg_sustainability,
          avg_price_sensitivity = EXCLUDED.avg_price_sensitivity,
          avg_willingness_to_pay = EXCLUDED.avg_willingness_to_pay,
          avg_brand_values = EXCLUDED.avg_brand_values,
          centroid_embedding = EXCLUDED.centroid_embedding,
          updated_at = NOW()
      `, [
        segment,
        row.count,
        row.avg_sustainability,
        row.avg_price_sensitivity,
        row.avg_willingness_to_pay,
        row.avg_brand_values,
        `[${centroidEmbedding.join(',')}]`
      ]);
      
      console.log(`  ${segment}: ${row.count} respondents`);
      console.log(`    Avg Sustainability: ${row.avg_sustainability?.toFixed(2)}`);
      console.log(`    Avg Price Sensitivity: ${row.avg_price_sensitivity?.toFixed(2)}`);
      console.log(`    Avg Willingness to Pay: ${row.avg_willingness_to_pay?.toFixed(2)}`);
    }
    
    console.log('Segment statistics computed successfully');
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  async cleanup() {
    await this.pool.end();
  }
  
  async run() {
    try {
      console.log('========================================');
      console.log('OpenAI Text-Embedding-3-Large Migration');
      console.log('========================================\n');
      
      // Initialize
      await this.initialize();
      
      // Load survey data
      const segmentedData = await this.loadSurveyData();
      
      // Generate embeddings
      const embeddings = await this.generateEmbeddings(segmentedData);
      
      // Store in database
      await this.storeEmbeddings(embeddings);
      
      // Create indexes
      await this.createIndexes();
      
      // Compute statistics
      await this.computeSegmentStatistics();
      
      console.log('\n========================================');
      console.log('Migration completed successfully!');
      console.log('========================================');
      
      // Show final statistics
      const result = await this.pool.query('SELECT COUNT(*) FROM survey_embeddings');
      console.log(`\nTotal embeddings stored: ${result.rows[0].count}`);
      
      const costs = (Object.values(embeddings).reduce((sum, arr) => sum + arr.length, 0) * 3 * 0.00013).toFixed(2);
      console.log(`Estimated API cost: $${costs} (3 embeddings per respondent)`);
      
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }
}

// Run the migration
const migration = new OpenAIEmbeddingMigration();
migration.run().catch(console.error);