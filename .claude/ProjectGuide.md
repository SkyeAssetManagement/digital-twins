# Surf Consumer Digital Twin MVP - Claude Code Implementation Guide

## Quick Start: Complete Vercel Setup Commands

Execute these commands in order to set up the entire project:

```bash
# 1. Create project directory and initialize
mkdir digital-twins
cd digital-twins
git init

# 2. Create directory structure
mkdir -p data/datasets/surf-clothing/{raw,processed}
mkdir -p src/{data_processing,digital_twins,vector_db,api,config}
mkdir -p public api scripts

# 3. Initialize npm and install all dependencies
npm init -y
npm install express cors dotenv xlsx node-fetch pg @xenova/transformers ml-kmeans formidable pdf-parse
npm install --save-dev vercel

# 4. Create .gitignore
cat > .gitignore << 'EOF'
node_modules/
.env.local
.vercel
data/processed/
data/vectors/
.DS_Store
*.log
EOF

# 5. Create .env.local (you'll need to add your actual values)
cat > .env.local << 'EOF'
DATABASE_URL=postgresql://user:password@localhost:5432/digital_twins
ANTHROPIC_API_KEY=your_api_key_here
NODE_ENV=development
EOF

# 6. Create vercel.json
cat > vercel.json << 'EOF'
{
  "buildCommand": "echo 'No build needed'",
  "outputDirectory": "public",
  "functions": {
    "api/*.js": {
      "maxDuration": 30,
      "memory": 1024
    }
  },
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/public/$1" }
  ]
}
EOF

# 7. Create package.json scripts
npm pkg set scripts.dev="node server.js"
npm pkg set scripts.migrate="node scripts/migrate-db.js"
npm pkg set scripts.init-dataset="node scripts/init-dataset.js"
npm pkg set scripts.start="npm run dev"
npm pkg set scripts.deploy="vercel"
npm pkg set scripts.deploy-prod="vercel --prod"
npm pkg set type="module"

# 8. Initialize Vercel (interactive - follow prompts)
vercel

# 9. Add environment variables to Vercel
vercel env add DATABASE_URL production # Paste your production PostgreSQL URL
vercel env add ANTHROPIC_API_KEY production # Paste your Anthropic API key

# 10. Create a test deployment
vercel

# 11. After testing, deploy to production
vercel --prod
```

### PostgreSQL Database Setup (run these before step 8 above)

```bash
# For local PostgreSQL
createdb digital_twins

# For production (example with Supabase)
# 1. Create account at supabase.com
# 2. Create new project
# 3. Go to Settings > Database
# 4. Copy the connection string
# 5. Use it as DATABASE_URL in Vercel

# Test database connection
psql $DATABASE_URL -c "SELECT version();"
```

### After Initial Setup

```bash
# Run database migrations (after creating migration script)
npm run migrate

# Initialize the surf dataset (after implementing processors)
npm run init-dataset surf-clothing

# Start local development
npm run dev

# Deploy updates
git add .
git commit -m "Update"
vercel --prod
```

### Vercel CLI Cheatsheet

```bash
# View all environment variables
vercel env ls

# Pull env vars to local .env file
vercel env pull

# View deployment logs
vercel logs

# List all deployments
vercel ls

# Promote a deployment to production
vercel promote [deployment-url]

# Remove a deployment
vercel rm [deployment-name]

# Get project info
vercel inspect
```

## Project Overview

Build an MVP that:
1. Processes ANY market survey data (CSV format) with accompanying research PDFs
2. Automatically extracts consumer segments from the data
3. Creates digital twins for each segment with authentic behavioral patterns
4. Provides a simple interface to test marketing materials against synthetic consumer responses
5. Supports multiple datasets/industries through a parameterized architecture

## Directory Structure

```
digital-twins/
├── data/
│   ├── datasets/                         # Multiple dataset support
│   │   ├── surf-clothing/               # Original surf dataset
│   │   │   ├── raw/
│   │   │   │   ├── All_Surf_detail 2.xlsx
│   │   │   │   ├── Surf_Shopper_Research_2018_final.pdf
│   │   │   │   └── LivingLOHAS_6_V11.pdf
│   │   │   ├── config.json             # Dataset configuration
│   │   │   └── processed/
│   │   └── [other-dataset]/            # Future datasets
│   │       ├── raw/
│   │       ├── config.json
│   │       └── processed/
│   └── vectors/                        # Vector database storage
│       ├── embeddings.db               # SQLite with vector extension
│       └── indexes/                    # FAISS or similar indexes
├── src/
│   ├── data_processing/
│   │   ├── universal_processor.js      # Handles any CSV structure
│   │   ├── pdf_extractor.js          # Extract insights from PDFs
│   │   ├── segment_discovery.js       # Auto-discover segments
│   │   └── vectorizer.js              # Create embeddings
│   ├── digital_twins/
│   │   ├── twin_generator.js          # Generate personas from data
│   │   ├── response_engine.js         # Generate synthetic responses
│   │   └── value_mapper.js            # Map discovered values
│   ├── vector_db/
│   │   ├── vector_store.js            # Vector database interface
│   │   ├── embedding_generator.js     # Generate embeddings
│   │   └── similarity_search.js       # Find similar responses
│   ├── api/
│   │   ├── dataset_manager.js         # Manage multiple datasets
│   │   └── claude_integration.js      # Claude API
│   └── config/
│       └── dataset_schema.js          # Schema for dataset configs
├── api/                               # Vercel serverless functions
│   ├── generate-response.js
│   ├── upload-dataset.js              # New dataset upload endpoint
│   └── list-datasets.js               # Available datasets
├── public/
│   ├── index.html
│   ├── app.js
│   ├── dataset-manager.js            # UI for dataset management
│   └── styles.css
├── scripts/
│   ├── init-dataset.js                # Initialize new dataset
│   └── process-dataset.js             # Process uploaded data
├── server.js                          # Local Express server
├── package.json
├── vercel.json
├── .env.local
├── .gitignore
└── README.md
```

## Phase 1: Universal Data Processing Architecture (3-4 hours)

### Step 1.1: Dataset Configuration Schema

Each dataset needs a configuration file that describes its structure:

```javascript
// data/datasets/surf-clothing/config.json
{
  "id": "surf-clothing",
  "name": "Surf Clothing Consumer Research 2018",
  "description": "LOHAS segmentation of surf clothing buyers",
  "dataFiles": {
    "survey": "All_Surf_detail 2.xlsx",
    "research": ["Surf_Shopper_Research_2018_final.pdf", "LivingLOHAS_6_V11.pdf"]
  },
  "segmentationMethod": "auto", // "auto" | "manual" | "predefined"
  "predefinedSegments": ["leader", "leaning", "learner", "laggard"], // optional
  "keyDimensions": [
    "sustainability",
    "priceConsciousness", 
    "brandLoyalty",
    "environmentalConcern",
    "socialInfluence"
  ],
  "responseColumns": {
    "identifierColumn": 0, // Respondent ID
    "startColumn": 9, // Where actual responses start
    "questionRowIndex": 0, // Main questions row
    "subQuestionRowIndex": 1 // Sub-questions row
  }
}
```

### Step 1.2: Universal CSV/Excel Processor

```javascript
// src/data_processing/universal_processor.js
import * as XLSX from 'xlsx';
import fs from 'fs/promises';
import path from 'path';

export class UniversalProcessor {
  constructor(datasetId) {
    this.datasetId = datasetId;
    this.basePath = `data/datasets/${datasetId}`;
  }
  
  async loadConfig() {
    const configPath = path.join(this.basePath, 'config.json');
    const config = await fs.readFile(configPath, 'utf8');
    return JSON.parse(config);
  }
  
  async processDataset() {
    const config = await this.loadConfig();
    
    // Process survey data
    const surveyData = await this.processSurveyFile(
      path.join(this.basePath, 'raw', config.dataFiles.survey),
      config
    );
    
    // Extract insights from PDFs
    const pdfInsights = await this.extractPDFInsights(
      config.dataFiles.research.map(f => path.join(this.basePath, 'raw', f))
    );
    
    // Auto-discover segments if needed
    const segments = config.segmentationMethod === 'auto' 
      ? await this.discoverSegments(surveyData, pdfInsights)
      : config.predefinedSegments;
    
    // Save processed data
    await this.saveProcessedData({
      config,
      surveyData,
      pdfInsights,
      segments,
      timestamp: new Date().toISOString()
    });
    
    return { surveyData, pdfInsights, segments };
  }
  
  async processSurveyFile(filePath, config) {
    const fileContent = await fs.readFile(filePath);
    const workbook = XLSX.read(fileContent, {
      cellStyles: true,
      cellDates: true,
      cellNF: true
    });
    
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const range = XLSX.utils.decode_range(sheet['!ref']);
    
    // Dynamic question extraction based on config
    const questions = this.extractQuestionsUniversal(sheet, range, config);
    const responses = this.extractResponsesUniversal(sheet, range, config, questions);
    
    return { questions, responses };
  }
  
  extractQuestionsUniversal(sheet, range, config) {
    const questions = [];
    const { questionRowIndex, subQuestionRowIndex, startColumn } = config.responseColumns;
    
    let currentMainQuestion = null;
    
    for (let col = startColumn; col <= range.e.c; col++) {
      const mainCell = sheet[XLSX.utils.encode_cell({ r: questionRowIndex, c: col })];
      const subCell = sheet[XLSX.utils.encode_cell({ r: subQuestionRowIndex, c: col })];
      
      if (mainCell?.v) {
        currentMainQuestion = {
          text: mainCell.v,
          column: col,
          type: this.detectQuestionType(mainCell.v),
          subQuestions: []
        };
        questions.push(currentMainQuestion);
      }
      
      if (subCell?.v && currentMainQuestion) {
        const subQuestion = {
          text: subCell.v,
          column: col,
          fullQuestion: `${currentMainQuestion.text} - ${subCell.v}`,
          parentType: currentMainQuestion.type
        };
        currentMainQuestion.subQuestions.push(subQuestion);
      }
    }
    
    return questions;
  }
  
  detectQuestionType(questionText) {
    const text = questionText.toLowerCase();
    if (text.includes('how important') || text.includes('agree')) return 'scale';
    if (text.includes('select all') || text.includes('which of')) return 'multiple';
    if (text.includes('yes/no') || text.includes('true/false')) return 'binary';
    return 'open';
  }
  
  async discoverSegments(surveyData, pdfInsights) {
    // Use clustering to discover natural segments in the data
    const segmentDiscovery = new SegmentDiscovery();
    return await segmentDiscovery.findSegments(surveyData, pdfInsights);
  }
}
```

### Step 1.3: PDF Insight Extractor

```javascript
// src/data_processing/pdf_extractor.js

export class PDFInsightExtractor {
  async extractInsights(pdfPaths) {
    const insights = {
      segmentDescriptions: {},
      keyFindings: [],
      valueFrameworks: {},
      behavioralIndicators: []
    };
    
    for (const pdfPath of pdfPaths) {
      const content = await this.extractPDFContent(pdfPath);
      const analysis = await this.analyzeWithClaude(content);
      
      // Merge insights
      Object.assign(insights.segmentDescriptions, analysis.segments);
      insights.keyFindings.push(...analysis.findings);
      insights.behavioralIndicators.push(...analysis.behaviors);
    }
    
    return insights;
  }
  
  async analyzeWithClaude(pdfContent) {
    const prompt = `Analyze this market research document and extract:
1. Consumer segments and their characteristics
2. Key behavioral indicators for each segment
3. Value systems and decision factors
4. Purchase propensity patterns

Format as JSON with segments, findings, and behaviors arrays.

Document content:
${pdfContent.substring(0, 10000)}...`; // Truncate for context limits
    
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }]
      })
    });
    
    const data = await response.json();
    return JSON.parse(data.content[0].text);
  }
}
```

## Phase 2: Vector Database & Segment Discovery (3-4 hours)

### Step 2.1: Vector Store Implementation with PostgreSQL

```javascript
// src/vector_db/vector_store.js
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
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    // Create tables with pgvector extension
    await this.pool.query('CREATE EXTENSION IF NOT EXISTS vector');
    
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS responses (
        id SERIAL PRIMARY KEY,
        dataset_id TEXT NOT NULL,
        respondent_id TEXT NOT NULL,
        segment TEXT,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        embedding vector(384),  -- dimension for all-MiniLM-L6-v2
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS segments (
        id SERIAL PRIMARY KEY,
        dataset_id TEXT NOT NULL,
        segment_name TEXT NOT NULL,
        centroid vector(384),
        characteristics JSONB,
        value_system JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(dataset_id, segment_name)
      );
      
      CREATE TABLE IF NOT EXISTS personas (
        id SERIAL PRIMARY KEY,
        dataset_id TEXT NOT NULL,
        segment TEXT NOT NULL,
        persona_data JSONB,
        embedding vector(384),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS datasets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        config JSONB,
        status TEXT DEFAULT 'processing',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      );
      
      -- Create indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_responses_dataset_segment 
        ON responses(dataset_id, segment);
      CREATE INDEX IF NOT EXISTS idx_responses_embedding 
        ON responses USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
      CREATE INDEX IF NOT EXISTS idx_segments_dataset 
        ON segments(dataset_id);
      CREATE INDEX IF NOT EXISTS idx_personas_dataset_segment 
        ON personas(dataset_id, segment);
    `);
    
    // Initialize embedder (using Transformers.js for local embeddings)
    this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  
  async embedText(text) {
    const output = await this.embedder(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }
  
  async storeResponse(respondentId, segment, question, answer, metadata = {}) {
    const embedding = await this.embedText(`${question} ${answer}`);
    
    const query = `
      INSERT INTO responses 
        (dataset_id, respondent_id, segment, question, answer, embedding, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;
    
    const result = await this.pool.query(query, [
      this.datasetId,
      respondentId,
      segment,
      question,
      answer,
      `[${embedding.join(',')}]`,
      metadata
    ]);
    
    return result.rows[0].id;
  }
  
  async findSimilarResponses(query, segment = null, limit = 10) {
    const queryEmbedding = await this.embedText(query);
    
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
    
    const result = await this.pool.query(sql, params);
    return result.rows;
  }
  
  async storeSegmentProfile(segmentName, characteristics, valueSystem) {
    // Create centroid embedding from characteristics
    const characteristicText = Object.entries(characteristics)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    
    const centroid = await this.embedText(characteristicText);
    
    const query = `
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
    
    const result = await this.pool.query(query, [
      this.datasetId,
      segmentName,
      `[${centroid.join(',')}]`,
      characteristics,
      valueSystem
    ]);
    
    return result.rows[0].id;
  }
  
  async storePersona(twin) {
    const embedding = await this.embedText(
      JSON.stringify(twin.persona) + ' ' + JSON.stringify(twin.valueSystem)
    );
    
    const query = `
      INSERT INTO personas (dataset_id, segment, persona_data, embedding)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `;
    
    const result = await this.pool.query(query, [
      twin.datasetId,
      twin.segment,
      twin,
      `[${embedding.join(',')}]`
    ]);
    
    return result.rows[0].id;
  }
  
  async getSegmentProfile(segmentName) {
    const query = `
      SELECT characteristics, value_system 
      FROM segments 
      WHERE dataset_id = $1 AND segment_name = $2
    `;
    
    const result = await this.pool.query(query, [this.datasetId, segmentName]);
    return result.rows[0] || null;
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
    
    await this.pool.query(query, [
      datasetId,
      status,
      error ? JSON.stringify(error) : null
    ]);
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
    
    const result = await this.pool.query(query);
    return result.rows;
  }
  
  async close() {
    if (this.pool) {
      await this.pool.end();
    }
  }
}
```

### Step 2.2: Automatic Segment Discovery

```javascript
// src/data_processing/segment_discovery.js
import { KMeans } from 'ml-kmeans';

export class SegmentDiscovery {
  async findSegments(surveyData, pdfInsights, config) {
    // Extract features from responses
    const features = await this.extractFeatures(surveyData.responses);
    
    // Determine optimal number of clusters
    const optimalK = await this.findOptimalClusters(features);
    
    // Perform clustering
    const clusters = KMeans(features, optimalK, {
      initialization: 'kmeans++',
      seed: 42
    });
    
    // Map clusters to meaningful segments using PDF insights
    const segments = await this.interpretClusters(
      clusters,
      surveyData.responses,
      pdfInsights
    );
    
    return segments;
  }
  
  async extractFeatures(responses) {
    const features = [];
    
    for (const respondent of responses) {
      const featureVector = await this.createFeatureVector(respondent.responses);
      features.push(featureVector);
    }
    
    return features;
  }
  
  async createFeatureVector(responses) {
    const vector = [];
    
    // Extract numeric features from responses
    for (const [question, answer] of Object.entries(responses)) {
      if (typeof answer === 'number') {
        vector.push(answer);
      } else if (typeof answer === 'string') {
        // Convert categorical to numeric
        vector.push(this.encodeCategory(question, answer));
      }
    }
    
    return vector;
  }
  
  async interpretClusters(clusters, responses, pdfInsights) {
    const segments = [];
    
    for (let i = 0; i < clusters.clusters; i++) {
      const clusterResponses = responses.filter((_, idx) => clusters.labels[idx] === i);
      
      // Analyze cluster characteristics
      const characteristics = await this.analyzeClusterCharacteristics(
        clusterResponses,
        pdfInsights
      );
      
      // Generate segment name and profile
      const segment = await this.generateSegmentProfile(characteristics, pdfInsights);
      
      segments.push({
        id: `segment_${i}`,
        name: segment.name,
        characteristics: segment.characteristics,
        valueSystem: segment.valueSystem,
        size: clusterResponses.length,
        percentage: (clusterResponses.length / responses.length) * 100
      });
    }
    
    return segments;
  }
  
  async generateSegmentProfile(characteristics, pdfInsights) {
    // Use Claude to interpret the cluster characteristics
    const prompt = `Given these consumer characteristics:
${JSON.stringify(characteristics, null, 2)}

And these market research insights:
${JSON.stringify(pdfInsights.keyFindings.slice(0, 5), null, 2)}

Generate a consumer segment profile with:
1. A descriptive name (e.g., "Eco-Conscious Enthusiast", "Price-Sensitive Pragmatist")
2. Key characteristics (3-5 bullet points)
3. Value system (sustainability, price, quality, brand, social influence) rated 0-1
4. Purchase decision factors

Respond in JSON format.`;

    const response = await this.callClaude(prompt);
    return JSON.parse(response);
  }
}
```

### Step 2.3: Dynamic Twin Generator

```javascript
// src/digital_twins/twin_generator.js

export class DynamicTwinGenerator {
  constructor(vectorStore, datasetConfig) {
    this.vectorStore = vectorStore;
    this.config = datasetConfig;
  }
  
  async generateTwin(segment, variant = 0) {
    // Get segment profile from vector store
    const segmentProfile = await this.vectorStore.getSegmentProfile(segment);
    
    // Find representative responses for this segment
    const representativeResponses = await this.vectorStore.findRepresentativeResponses(
      segment,
      20
    );
    
    // Generate persona using segment data
    const persona = await this.generatePersona(
      segmentProfile,
      representativeResponses,
      variant
    );
    
    // Create response patterns from actual data
    const responsePatterns = await this.extractResponsePatterns(
      representativeResponses
    );
    
    const twin = {
      id: `${this.config.id}_${segment}_${Date.now()}_${variant}`,
      datasetId: this.config.id,
      segment: segment,
      persona: persona,
      valueSystem: segmentProfile.value_system,
      responsePatterns: responsePatterns,
      decisionModel: this.createDecisionModel(segmentProfile),
      responseEngine: this.createResponseEngine(segmentProfile, responsePatterns)
    };
    
    // Store in vector database for retrieval
    await this.vectorStore.storePersona(twin);
    
    return twin;
  }
  
  async generatePersona(segmentProfile, responses, variant) {
    // Extract demographic patterns from responses
    const demographics = this.extractDemographics(responses);
    
    // Use Claude to generate realistic persona
    const prompt = `Create a realistic persona for a consumer segment with these characteristics:
${JSON.stringify(segmentProfile.characteristics, null, 2)}

Based on these demographic patterns:
${JSON.stringify(demographics, null, 2)}

Create persona variant ${variant + 1} with:
- Name (culturally appropriate)
- Age (within segment range)
- Occupation (matching segment profile)
- Location (if relevant)
- Lifestyle details
- Shopping habits
- Media consumption

Make it feel like a real person, not a stereotype.`;

    const response = await this.callClaude(prompt);
    return JSON.parse(response);
  }
  
  extractResponsePatterns(responses) {
    const patterns = {
      vocabulary: {},
      sentimentRange: {},
      decisionFactors: [],
      priceThresholds: {},
      brandAffinities: {}
    };
    
    // Analyze language patterns
    responses.forEach(r => {
      // Extract vocabulary frequency
      const words = r.answer.toLowerCase().split(/\s+/);
      words.forEach(word => {
        patterns.vocabulary[word] = (patterns.vocabulary[word] || 0) + 1;
      });
    });
    
    // Sort by frequency
    patterns.vocabulary = Object.entries(patterns.vocabulary)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100)
      .reduce((obj, [word, count]) => ({ ...obj, [word]: count }), {});
    
    return patterns;
  }
}
```

## Phase 3: Dataset Management & Upload Interface (2-3 hours)

### Step 3.1: Dataset Upload API

```javascript
// api/upload-dataset.js - Vercel serverless function
import formidable from 'formidable';
import fs from 'fs/promises';
import path from 'path';
import { UniversalProcessor } from '../src/data_processing/universal_processor.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const form = formidable({
    maxFileSize: 50 * 1024 * 1024, // 50MB
    keepExtensions: true,
  });
  
  try {
    const [fields, files] = await form.parse(req);
    
    // Validate required files
    const surveyFile = files.survey?.[0];
    const pdfFiles = files.pdfs || [];
    const configData = JSON.parse(fields.config[0]);
    
    if (!surveyFile) {
      return res.status(400).json({ error: 'Survey file required' });
    }
    
    // Create dataset directory
    const datasetId = `dataset_${Date.now()}`;
    const datasetPath = path.join(process.cwd(), 'data', 'datasets', datasetId);
    
    await fs.mkdir(path.join(datasetPath, 'raw'), { recursive: true });
    await fs.mkdir(path.join(datasetPath, 'processed'), { recursive: true });
    
    // Move uploaded files
    await fs.copyFile(surveyFile.filepath, path.join(datasetPath, 'raw', surveyFile.originalFilename));
    
    for (const pdf of pdfFiles) {
      await fs.copyFile(pdf.filepath, path.join(datasetPath, 'raw', pdf.originalFilename));
    }
    
    // Save configuration
    const fullConfig = {
      ...configData,
      id: datasetId,
      dataFiles: {
        survey: surveyFile.originalFilename,
        research: pdfFiles.map(f => f.originalFilename)
      },
      uploadDate: new Date().toISOString()
    };
    
    await fs.writeFile(
      path.join(datasetPath, 'config.json'),
      JSON.stringify(fullConfig, null, 2)
    );
    
    // Start processing in background
    processDatasetAsync(datasetId);
    
    res.status(200).json({
      success: true,
      datasetId,
      message: 'Dataset uploaded successfully. Processing started.',
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload dataset' });
  }
}

async function processDatasetAsync(datasetId) {
  try {
    const processor = new UniversalProcessor(datasetId);
    await processor.processDataset();
    
    // Notify completion (could use webhooks, pusher, etc.)
    console.log(`Dataset ${datasetId} processed successfully`);
  } catch (error) {
    console.error(`Failed to process dataset ${datasetId}:`, error);
  }
}
```

### Step 3.2: Dataset Manager UI

```javascript
// public/dataset-manager.js

class DatasetManager {
  constructor() {
    this.currentDatasetId = localStorage.getItem('currentDatasetId') || 'surf-clothing';
    this.initializeUI();
    this.loadDatasets();
  }
  
  initializeUI() {
    // Add dataset selector to main UI
    const datasetSelector = `
      <div class="dataset-selector">
        <label>Current Dataset:</label>
        <select id="datasetSelect">
          <option value="surf-clothing">Surf Clothing (Default)</option>
        </select>
        <button id="uploadNewDataset" class="secondary-button">Upload New Dataset</button>
      </div>
    `;
    
    document.querySelector('.container').insertAdjacentHTML('afterbegin', datasetSelector);
    
    // Add upload modal
    const uploadModal = `
      <div id="uploadModal" class="modal" style="display: none;">
        <div class="modal-content">
          <h2>Upload New Dataset</h2>
          <form id="datasetUploadForm">
            <div class="form-group">
              <label>Dataset Name</label>
              <input type="text" id="datasetName" required>
            </div>
            
            <div class="form-group">
              <label>Survey Data (CSV/Excel)</label>
              <input type="file" id="surveyFile" accept=".csv,.xlsx,.xls" required>
            </div>
            
            <div class="form-group">
              <label>Research PDFs (Optional)</label>
              <input type="file" id="pdfFiles" accept=".pdf" multiple>
            </div>
            
            <div class="form-group">
              <label>Segmentation Method</label>
              <select id="segmentMethod">
                <option value="auto">Automatic (Discover from data)</option>
                <option value="manual">Manual (I'll define segments)</option>
              </select>
            </div>
            
            <div class="form-group" id="manualSegments" style="display: none;">
              <label>Define Segments (comma separated)</label>
              <input type="text" id="segmentNames" placeholder="e.g., Leader, Follower, Skeptic">
            </div>
            
            <div class="form-group">
              <label>Key Dimensions to Analyze</label>
              <div id="dimensionCheckboxes">
                <label><input type="checkbox" value="price" checked> Price Sensitivity</label>
                <label><input type="checkbox" value="quality" checked> Quality Focus</label>
                <label><input type="checkbox" value="brand" checked> Brand Loyalty</label>
                <label><input type="checkbox" value="innovation"> Innovation Adoption</label>
                <label><input type="checkbox" value="social"> Social Influence</label>
                <label><input type="checkbox" value="sustainability"> Sustainability</label>
              </div>
            </div>
            
            <div class="button-group">
              <button type="submit" class="primary-button">Upload & Process</button>
              <button type="button" class="secondary-button" onclick="closeModal()">Cancel</button>
            </div>
          </form>
          
          <div id="uploadProgress" style="display: none;">
            <div class="progress-bar">
              <div class="progress-fill"></div>
            </div>
            <p class="progress-text">Uploading dataset...</p>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', uploadModal);
    
    // Event listeners
    document.getElementById('uploadNewDataset').addEventListener('click', () => {
      this.showUploadModal();
    });
    
    document.getElementById('datasetSelect').addEventListener('change', (e) => {
      this.switchDataset(e.target.value);
    });
    
    document.getElementById('segmentMethod').addEventListener('change', (e) => {
      document.getElementById('manualSegments').style.display = 
        e.target.value === 'manual' ? 'block' : 'none';
    });
    
    document.getElementById('datasetUploadForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.uploadDataset();
    });
  }
  
  async loadDatasets() {
    try {
      const response = await fetch('/api/list-datasets');
      const datasets = await response.json();
      
      const select = document.getElementById('datasetSelect');
      select.innerHTML = datasets.map(d => `
        <option value="${d.id}" ${d.id === this.currentDatasetId ? 'selected' : ''}>
          ${d.name} ${d.isProcessing ? '(Processing...)' : ''}
        </option>
      `).join('');
      
    } catch (error) {
      console.error('Failed to load datasets:', error);
    }
  }
  
  async uploadDataset() {
    const formData = new FormData();
    
    // Get form values
    const surveyFile = document.getElementById('surveyFile').files[0];
    const pdfFiles = document.getElementById('pdfFiles').files;
    
    formData.append('survey', surveyFile);
    for (let pdf of pdfFiles) {
      formData.append('pdfs', pdf);
    }
    
    // Build configuration
    const config = {
      name: document.getElementById('datasetName').value,
      segmentationMethod: document.getElementById('segmentMethod').value,
      keyDimensions: Array.from(document.querySelectorAll('#dimensionCheckboxes input:checked'))
        .map(cb => cb.value)
    };
    
    if (config.segmentationMethod === 'manual') {
      config.predefinedSegments = document.getElementById('segmentNames').value
        .split(',')
        .map(s => s.trim());
    }
    
    formData.append('config', JSON.stringify(config));
    
    // Show progress
    document.getElementById('datasetUploadForm').style.display = 'none';
    document.getElementById('uploadProgress').style.display = 'block';
    
    try {
      const response = await fetch('/api/upload-dataset', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Update progress text
        document.querySelector('.progress-text').textContent = 'Processing dataset...';
        
        // Poll for completion
        this.pollForCompletion(result.datasetId);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      alert('Upload failed: ' + error.message);
      this.closeModal();
    }
  }
  
  async pollForCompletion(datasetId) {
    const checkStatus = async () => {
      const response = await fetch(`/api/dataset-status/${datasetId}`);
      const status = await response.json();
      
      if (status.isComplete) {
        this.closeModal();
        await this.loadDatasets();
        this.switchDataset(datasetId);
        alert('Dataset processed successfully!');
      } else if (status.error) {
        alert('Processing failed: ' + status.error);
        this.closeModal();
      } else {
        // Continue polling
        setTimeout(checkStatus, 3000);
      }
    };
    
    setTimeout(checkStatus, 3000);
  }
  
  switchDataset(datasetId) {
    this.currentDatasetId = datasetId;
    localStorage.setItem('currentDatasetId', datasetId);
    
    // Reload twins for new dataset
    window.digitalTwinTester?.loadDigitalTwins();
  }
  
  showUploadModal() {
    document.getElementById('uploadModal').style.display = 'flex';
  }
  
  closeModal() {
    document.getElementById('uploadModal').style.display = 'none';
    document.getElementById('datasetUploadForm').reset();
    document.getElementById('datasetUploadForm').style.display = 'block';
    document.getElementById('uploadProgress').style.display = 'none';
  }
}

// Initialize dataset manager when page loads
document.addEventListener('DOMContentLoaded', () => {
  window.datasetManager = new DatasetManager();
});
```

### Step 3.3: Updated Main App Integration

```javascript
// public/app.js - Updated to support multiple datasets

class DigitalTwinTester {
  constructor() {
    this.twins = [];
    this.apiEndpoint = this.getApiEndpoint();
    this.isLocalDev = window.location.hostname === 'localhost';
    this.currentDatasetId = localStorage.getItem('currentDatasetId') || 'surf-clothing';
    
    this.initializeEventListeners();
    this.loadDigitalTwins();
    this.showDevModeIndicator();
  }
  
  async loadDigitalTwins() {
    // Clear existing twins
    this.twins = [];
    
    try {
      // Load dataset configuration
      const configResponse = await fetch(`/api/dataset-config/${this.currentDatasetId}`);
      const config = await configResponse.json();
      
      // Load segments for this dataset
      const segments = config.segments || ['segment_0', 'segment_1', 'segment_2', 'segment_3'];
      
      for (const segment of segments) {
        // Generate 2-3 variants per segment
        for (let i = 0; i < 3; i++) {
          const twin = await this.loadTwin(this.currentDatasetId, segment, i);
          this.twins.push(twin);
        }
      }
      
      // Update UI to show dataset info
      this.updateDatasetInfo(config);
    } catch (error) {
      console.error('Failed to load twins:', error);
      // Fall back to default twins if dataset not found
      this.loadDefaultTwins();
    }
  }
  
  async loadTwin(datasetId, segment, variant) {
    try {
      // Try to load from vector database
      const response = await fetch(`/api/get-twin/${datasetId}/${segment}/${variant}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.log('Failed to load twin from database, using generated twin');
    }
    
    // Generate twin if not in database
    return this.generateDefaultTwin(datasetId, segment, variant);
  }
  
  updateDatasetInfo(config) {
    const infoDiv = document.getElementById('datasetInfo') || this.createDatasetInfoDiv();
    
    infoDiv.innerHTML = `
      <div class="dataset-info">
        <h3>${config.name}</h3>
        <p>${config.description || 'Custom dataset'}</p>
        <div class="dataset-stats">
          <span>Segments: ${config.segments.length}</span>
          <span>Responses: ${config.responseCount || 'N/A'}</span>
          <span>Dimensions: ${config.keyDimensions.join(', ')}</span>
        </div>
      </div>
    `;
  }
  
  // ... rest of the existing DigitalTwinTester code remains the same ...
}
```

### Step 3.4: Updated CSS for Dataset Management

```css
/* public/styles.css - Additional styles for dataset management */

/* Dataset Selector */
.dataset-selector {
  background: var(--bg-white);
  padding: 15px 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: var(--shadow);
  display: flex;
  align-items: center;
  gap: 15px;
}

.dataset-selector label {
  font-weight: 500;
  color: var(--text-secondary);
}

#datasetSelect {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-white);
  font-size: 14px;
}

.secondary-button {
  background: var(--bg-light);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  padding: 8px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
}

.secondary-button:hover {
  background: var(--border-color);
}

/* Modal Styles */
.modal {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg-white);
  padding: 30px;
  border-radius: 8px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.modal-content h2 {
  margin-top: 0;
  margin-bottom: 20px;
  color: var(--text-primary);
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--text-primary);
}

.form-group input[type="text"],
.form-group input[type="file"],
.form-group select {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 14px;
}

.form-group input[type="file"] {
  padding: 8px;
  background: var(--bg-light);
}

#dimensionCheckboxes {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

#dimensionCheckboxes label {
  display: flex;
  align-items: center;
  font-weight: normal;
  cursor: pointer;
}

#dimensionCheckboxes input[type="checkbox"] {
  margin-right: 8px;
}

.button-group {
  display: flex;
  gap: 10px;
  margin-top: 25px;
}

/* Progress Bar */
.progress-bar {
  width: 100%;
  height: 20px;
  background: var(--bg-light);
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 15px;
}

.progress-fill {
  height: 100%;
  background: var(--leaning-color);
  width: 30%;
  animation: progress 2s ease-in-out infinite;
}

@keyframes progress {
  0% { width: 30%; }
  50% { width: 70%; }
  100% { width: 30%; }
}

.progress-text {
  text-align: center;
  color: var(--text-secondary);
  font-size: 14px;
}

/* Dataset Info */
.dataset-info {
  background: #f0f7ff;
  border-left: 4px solid var(--leaning-color);
  padding: 15px 20px;
  margin-bottom: 20px;
  border-radius: 0 4px 4px 0;
}

.dataset-info h3 {
  margin: 0 0 5px 0;
  color: var(--text-primary);
}

.dataset-info p {
  margin: 0 0 10px 0;
  color: var(--text-secondary);
  font-size: 14px;
}

.dataset-stats {
  display: flex;
  gap: 20px;
  font-size: 13px;
  color: var(--text-secondary);
}

.dataset-stats span {
  background: var(--bg-white);
  padding: 4px 10px;
  border-radius: 12px;
}
```

## Phase 4: Response Engine with Dataset Context (2-3 hours)

### Step 4.1: Dataset-Aware Response Engine

```javascript
// src/digital_twins/response_engine.js - Updated for multiple datasets

export class DatasetAwareResponseEngine {
  constructor(twin, vectorStore) {
    this.twin = twin;
    this.vectorStore = vectorStore;
    this.claudeApiUrl = "https://api.anthropic.com/v1/messages";
  }
  
  async generateResponse(marketingContent, imageData = null) {
    // Find similar historical responses from the dataset
    const similarResponses = await this.vectorStore.findSimilarResponses(
      marketingContent,
      this.twin.segment,
      5
    );
    
    const prompt = this.buildContextualPrompt(marketingContent, similarResponses);
    
    try {
      const messages = [{
        role: "user",
        content: imageData 
          ? [
              { type: "text", text: prompt },
              { 
                type: "image", 
                source: {
                  type: "base64",
                  media_type: "image/jpeg",
                  data: imageData
                }
              }
            ]
          : prompt
      }];
      
      const response = await fetch(this.claudeApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 500,
          messages
        })
      });
      
      const data = await response.json();
      const parsedResponse = this.parseResponse(data.content[0].text);
      
      // Store this response for future learning
      await this.vectorStore.storeResponse(
        `twin_${this.twin.id}`,
        this.twin.segment,
        marketingContent,
        parsedResponse.text,
        { 
          sentiment: parsedResponse.sentiment,
          purchaseIntent: parsedResponse.purchaseIntent,
          generatedBy: 'claude'
        }
      );
      
      return parsedResponse;
    } catch (error) {
      console.error("Claude API error:", error);
      return this.generateDataDrivenFallback(marketingContent, similarResponses);
    }
  }
  
  buildContextualPrompt(marketingContent, similarResponses) {
    const { persona, valueSystem, segment, responsePatterns } = this.twin;
    
    // Build context from actual survey responses
    const responseContext = similarResponses.map(r => 
      `When asked "${r.question}", someone like you said: "${r.answer}"`
    ).join('\n');
    
    // Extract vocabulary patterns
    const vocabularyHints = Object.keys(responsePatterns.vocabulary)
      .slice(0, 20)
      .join(', ');
    
    return `You are ${persona.name}, a ${persona.age}-year-old ${persona.occupation} who falls into the "${segment}" category of consumers.

Your value system:
${Object.entries(valueSystem).map(([key, value]) => 
  `- ${key}: ${typeof value === 'number' ? (value * 10).toFixed(1) + '/10' : value}`
).join('\n')}

Here are some responses from people similar to you:
${responseContext}

Common words/phrases you and similar people use: ${vocabularyHints}

React authentically to this marketing material as this persona would:
"${marketingContent}"

Respond in 2-3 sentences with your genuine reaction. Consider:
1. Whether this aligns with your values
2. Your typical vocabulary and communication style
3. Your specific concerns and priorities
4. Whether you'd actually purchase this

Be specific and authentic to your persona, not generic.`;
  }
  
  async generateDataDrivenFallback(marketingContent, similarResponses) {
    // Generate response based on actual dataset patterns
    if (similarResponses.length > 0) {
      // Analyze sentiment patterns in similar responses
      const sentiments = this.analyzeSentimentPatterns(similarResponses);
      const vocabulary = this.extractVocabulary(similarResponses);
      
      // Construct response using real patterns
      const template = this.selectResponseTemplate(sentiments, this.twin.segment);
      const response = this.fillTemplate(template, vocabulary, marketingContent);
      
      return {
        text: response,
        sentiment: sentiments.primary,
        purchaseIntent: sentiments.avgIntent,
        keyFactors: this.extractKeyFactors(similarResponses),
        timestamp: new Date().toISOString(),
        isFallback: true,
        basedOnData: true
      };
    }
    
    // Ultimate fallback if no data available
    return this.generateGenericFallback(marketingContent);
  }
  
  analyzeSentimentPatterns(responses) {
    const sentiments = responses.map(r => r.metadata?.sentiment || 'neutral');
    const intents = responses.map(r => r.metadata?.purchaseIntent || 5);
    
    return {
      primary: this.mostCommon(sentiments),
      avgIntent: intents.reduce((a, b) => a + b, 0) / intents.length,
      distribution: this.countOccurrences(sentiments)
    };
  }
  
  selectResponseTemplate(sentiments, segment) {
    const templates = {
      positive: [
        "This really speaks to what I value - {positive_aspect}. {consideration}",
        "I appreciate {positive_aspect}. {action_statement}",
        "{positive_aspect} catches my attention. {qualifier}"
      ],
      neutral: [
        "This seems {neutral_observation}. {question_or_concern}",
        "I'd need to know more about {specific_aspect}. {consideration}",
        "{neutral_observation}, but {concern_or_condition}"
      ],
      negative: [
        "This doesn't align with {negative_aspect}. {dismissal}",
        "I'm skeptical about {concern}. {reason}",
        "{negative_observation}. {alternative_preference}"
      ]
    };
    
    const sentiment = sentiments.primary || 'neutral';
    const templateList = templates[sentiment] || templates.neutral;
    return templateList[Math.floor(Math.random() * templateList.length)];
  }
}
```

### Step 4.2: Initialize Dataset Script

```javascript
// scripts/init-dataset.js - Script to initialize a new dataset

import { UniversalProcessor } from '../src/data_processing/universal_processor.js';
import { VectorStore } from '../src/vector_db/vector_store.js';
import { PDFInsightExtractor } from '../src/data_processing/pdf_extractor.js';
import { SegmentDiscovery } from '../src/data_processing/segment_discovery.js';
import { DynamicTwinGenerator } from '../src/digital_twins/twin_generator.js';

export async function initializeDataset(datasetId) {
  console.log(`Initializing dataset: ${datasetId}`);
  
  try {
    // Step 1: Process raw data
    const processor = new UniversalProcessor(datasetId);
    const { surveyData, pdfInsights, segments } = await processor.processDataset();
    console.log(`Found ${segments.length} segments`);
    
    // Step 2: Initialize vector store
    const vectorStore = new VectorStore(datasetId);
    await vectorStore.initialize();
    
    // Step 3: Store all responses with embeddings
    console.log('Generating embeddings for responses...');
    for (const respondent of surveyData.responses) {
      const segment = await assignRespondentToSegment(respondent, segments);
      
      for (const [question, answer] of Object.entries(respondent.responses)) {
        if (answer) {
          await vectorStore.storeResponse(
            respondent.respondentId,
            segment,
            question,
            answer,
            { originalDataset: datasetId }
          );
        }
      }
    }
    
    // Step 4: Store segment profiles
    console.log('Storing segment profiles...');
    for (const segment of segments) {
      await vectorStore.storeSegmentProfile(
        segment.name,
        segment.characteristics,
        segment.valueSystem
      );
    }
    
    // Step 5: Generate initial digital twins
    console.log('Generating digital twins...');
    const twinGenerator = new DynamicTwinGenerator(vectorStore, processor.config);
    
    for (const segment of segments) {
      // Generate 3 variants per segment
      for (let variant = 0; variant < 3; variant++) {
        const twin = await twinGenerator.generateTwin(segment.name, variant);
        console.log(`Created twin: ${twin.persona.name} (${segment.name})`);
      }
    }
    
    // Step 6: Update dataset status
    await markDatasetAsComplete(datasetId);
    
    console.log(`Dataset ${datasetId} initialized successfully!`);
    return { success: true, segments: segments.length };
    
  } catch (error) {
    console.error(`Failed to initialize dataset ${datasetId}:`, error);
    await markDatasetAsFailed(datasetId, error.message);
    throw error;
  }
}

async function assignRespondentToSegment(respondent, segments) {
  // Simple assignment based on response patterns
  // In production, use more sophisticated clustering/classification
  
  let bestSegment = segments[0].name;
  let bestScore = -1;
  
  for (const segment of segments) {
    const score = calculateSegmentAlignment(respondent.responses, segment);
    if (score > bestScore) {
      bestScore = score;
      bestSegment = segment.name;
    }
  }
  
  return bestSegment;
}

function calculateSegmentAlignment(responses, segment) {
  // Calculate how well responses align with segment characteristics
  let score = 0;
  
  // Match responses against segment behavioral indicators
  for (const [question, answer] of Object.entries(responses)) {
    for (const indicator of segment.characteristics.behavioralIndicators || []) {
      if (answer?.toString().toLowerCase().includes(indicator.toLowerCase())) {
        score += 1;
      }
    }
  }
  
  return score;
}

// Run if called directly
if (process.argv[2]) {
  initializeDataset(process.argv[2])
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
```

## Phase 5: Enhanced Frontend with Dataset Support (2 hours)

### Step 5.1: Updated HTML Interface

```html
<!-- public/index.html - Updated for dataset management -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Digital Twin Consumer Response Tester</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="container">
        <h1>Digital Twin Consumer Response Tester</h1>
        
        <!-- Dataset selector will be inserted here by dataset-manager.js -->
        
        <!-- Development Mode Indicator -->
        <div id="devMode" class="dev-indicator" style="display: none;">
            🚧 Local Development Mode - Using Fallback Responses
        </div>
        
        <!-- Dataset info will be inserted here -->
        <div id="datasetInfo"></div>
        
        <div class="input-section">
            <h2>Marketing Material Input</h2>
            <textarea id="marketingInput" placeholder="Paste your marketing copy, ad text, or product description here..." rows="6"></textarea>
            
            <div class="file-upload">
                <label for="imageUpload">Upload Marketing Image (optional)</label>
                <input type="file" id="imageUpload" accept="image/*">
                <small>Image analysis requires API connection</small>
            </div>
            
            <button id="testButton" class="primary-button">Test Responses</button>
        </div>
        
        <div id="loadingIndicator" class="loading" style="display: none;">
            <div class="spinner"></div>
            <p>Generating authentic responses from <span id="datasetName">consumer</span> data...</p>
        </div>
        
        <div class="results-section">
            <h2>Digital Twin Responses</h2>
            <div id="responses" class="responses-grid"></div>
        </div>
        
        <div class="analysis-section">
            <h2>Segment Analysis</h2>
            <div id="analysis"></div>
        </div>
    </div>
    
    <script src="dataset-manager.js"></script>
    <script src="app.js"></script>
</body>
</html>
```

### Step 5.2: Package.json with PostgreSQL Dependencies

```json
{
  "name": "digital-twin-consumer-tester",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "node server.js",
    "init-dataset": "node scripts/init-dataset.js",
    "migrate": "node scripts/migrate-db.js",
    "process-all": "node scripts/process-all-datasets.js",
    "build-twins": "node src/digital_twins/build-twins.js",
    "start": "npm run dev",
    "deploy": "vercel",
    "deploy-prod": "vercel --prod"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "xlsx": "^0.18.5",
    "node-fetch": "^3.3.2",
    "pg": "^8.11.3",
    "@xenova/transformers": "^2.6.0",
    "ml-kmeans": "^6.0.0",
    "formidable": "^3.5.1",
    "pdf-parse": "^1.1.1"
  },
  "devDependencies": {
    "vercel": "^32.0.0"
  }
}
```

### Step 5.3: Database Migration Script

```javascript
// scripts/migrate-db.js
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;

async function migrateDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production