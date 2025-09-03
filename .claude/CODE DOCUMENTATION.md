# Digital Twin Consumer Response Tester - Code Documentation

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Browser)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   HTML UI    │  │  JavaScript  │  │     CSS      │         │
│  │ (index.html) │  │   (app.js)   │  │ (styles.css) │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────┬────────────────────────────────────────┘
                      │ HTTP Requests
┌─────────────────────▼────────────────────────────────────────┐
│                    Backend (Node.js/Express)                  │
│  ┌──────────────────────────────────────────────────┐       │
│  │                  server.js                        │       │
│  │         (Express Server & Route Handler)          │       │
│  └────────────────┬─────────────────────────────────┘       │
│                   │                                          │
│  ┌────────────────▼──────────────────────────────────┐      │
│  │                 API Endpoints                      │      │
│  │  ┌─────────────────┐  ┌──────────────────┐       │      │
│  │  │generate-response│  │  list-datasets   │       │      │
│  │  └─────────────────┘  └──────────────────┘       │      │
│  │  ┌─────────────────┐  ┌──────────────────┐       │      │
│  │  │ upload-dataset  │  │ dataset-config   │       │      │
│  │  └─────────────────┘  └──────────────────┘       │      │
│  └────────────────────────────────────────────────────┘     │
└────────────────────┬─────────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────────┐
│                    Core Processing Layer                  │
│  ┌──────────────────────────────────────────────────┐   │
│  │             Data Processing Module                │   │
│  │  ┌─────────────────┐  ┌──────────────────┐      │   │
│  │  │UniversalProcessor│  │  PDFExtractor    │      │   │
│  │  └─────────────────┘  └──────────────────┘      │   │
│  │  ┌─────────────────────────────────────────┐    │   │
│  │  │        SegmentDiscovery                  │    │   │
│  │  └─────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │           Digital Twin Module                    │   │
│  │  ┌─────────────────┐  ┌──────────────────┐     │   │
│  │  │  TwinGenerator  │  │ ResponseEngine   │     │   │
│  │  └─────────────────┘  └──────────────────┘     │   │
│  └──────────────────────────────────────────────────┘   │
└────────────────────┬─────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────┐
│                    Data Layer                         │
│  ┌──────────────────────────────────────────────────┐│
│  │              Vector Store                         ││
│  │     (PostgreSQL with pgvector extension)          ││
│  └──────────────────────────────────────────────────┘│
│  ┌──────────────────────────────────────────────────┐│
│  │              File System                          ││
│  │         (Raw data, configs, processed)            ││
│  └──────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────┐
│              External Services                        │
│  ┌──────────────────────────────────────────────────┐│
│  │         Claude API (Response Generation)          ││
│  └──────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────┘
```

## Directory Structure

```
digital-twins/
├── .claude/                      # Claude-specific documentation
│   ├── ProjectGuide.md
│   ├── CLAUDE.md
│   ├── projectStatus.md
│   └── CODE DOCUMENTATION.md    # This file
├── api/                          # API endpoint handlers
│   ├── generate-response.js     # Main response generation endpoint
│   ├── list-datasets.js         # List available datasets
│   ├── upload-dataset.js        # Dataset upload handler
│   ├── dataset-config.js        # Get dataset configuration
│   ├── get-twin.js              # Get specific twin
│   └── dataset-status.js        # Check dataset processing status
├── data/                         # Data storage
│   ├── datasets/                # Multiple dataset support
│   │   └── surf-clothing/       # Example dataset
│   │       ├── raw/             # Original files
│   │       ├── processed/       # Processed data
│   │       └── config.json      # Dataset configuration
│   └── vectors/                 # Vector embeddings (if not using DB)
├── public/                       # Frontend files
│   ├── index.html               # Main UI
│   ├── app.js                   # Frontend JavaScript
│   └── styles.css               # Styling
├── scripts/                      # Utility scripts
│   └── init-dataset.js          # Initialize dataset
├── src/                          # Core application logic
│   ├── data_processing/          # Data processing modules
│   │   ├── universal_processor.js
│   │   ├── pdf_extractor.js
│   │   └── segment_discovery.js
│   ├── digital_twins/            # Digital twin modules
│   │   ├── twin_generator.js
│   │   └── response_engine.js
│   └── vector_db/               # Database interface
│       └── vector_store.js
├── server.js                     # Express server
├── package.json                  # Dependencies
├── .env.local                    # Environment variables
├── .gitignore                   # Git ignore rules
└── dbConfig.yaml                # Database configuration
```

## Module Descriptions

### 1. Server Layer (server.js)
**Purpose**: Main Express server that handles HTTP requests and routes them to appropriate handlers.

**Key Responsibilities**:
- Serve static files from public directory
- Route API requests to endpoint handlers
- Handle CORS and JSON parsing
- Error handling middleware

### 2. API Endpoints (api/*.js)

#### generate-response.js
**Purpose**: Generate consumer responses for marketing content
- Accepts marketing text and optional image
- Generates responses for each segment
- Returns responses with sentiment and purchase intent

#### list-datasets.js
**Purpose**: List all available datasets
- Reads from filesystem and database
- Returns dataset metadata

#### upload-dataset.js
**Purpose**: Handle new dataset uploads
- Accepts CSV/Excel and PDF files
- Triggers background processing
- Returns dataset ID for tracking

### 3. Data Processing Layer

#### UniversalProcessor (universal_processor.js)
**Purpose**: Process survey data from any CSV/Excel format
- Dynamic question extraction
- Response normalization
- Segment mapping
- Data persistence

**Key Methods**:
- `processDataset()`: Main processing pipeline
- `extractQuestionsUniversal()`: Dynamic question detection
- `extractResponsesUniversal()`: Response extraction

#### PDFExtractor (pdf_extractor.js)
**Purpose**: Extract insights from research PDFs
- Text extraction from PDFs
- Claude API integration for analysis
- Fallback pattern-based extraction

**Key Methods**:
- `extractInsights()`: Process multiple PDFs
- `analyzeWithClaude()`: AI-powered analysis
- `getFallbackAnalysis()`: Pattern-based fallback

#### SegmentDiscovery (segment_discovery.js)
**Purpose**: Discover consumer segments from data
- K-means clustering
- Feature extraction
- Segment interpretation

**Key Methods**:
- `findSegments()`: Main segmentation pipeline
- `findOptimalClusters()`: Elbow method for K selection
- `interpretClusters()`: Map clusters to meaningful segments

### 4. Digital Twin Layer

#### TwinGenerator (twin_generator.js)
**Purpose**: Create digital twin personas
- Persona generation based on segment
- Response pattern extraction
- Decision model creation

**Key Methods**:
- `generateTwin()`: Create complete twin
- `generatePersona()`: Create persona details
- `extractResponsePatterns()`: Analyze language patterns

#### ResponseEngine (response_engine.js)
**Purpose**: Generate authentic responses
- Context-aware response generation
- Claude API integration
- Pattern-based fallbacks

**Key Methods**:
- `generateResponse()`: Main response generation
- `buildContextualPrompt()`: Create prompts
- `generateDataDrivenFallback()`: Fallback responses

### 5. Data Layer

#### VectorStore (vector_store.js)
**Purpose**: PostgreSQL database interface with vector support
- Embedding generation and storage
- Similarity search
- Segment profile management

**Key Methods**:
- `initialize()`: Setup database and tables
- `storeResponse()`: Store with embeddings
- `findSimilarResponses()`: Vector similarity search
- `storeSegmentProfile()`: Store segment data

### 6. Frontend Layer

#### app.js
**Purpose**: Frontend application logic
- Dataset management
- Marketing content submission
- Response display
- Analysis visualization

**Key Classes**:
- `DigitalTwinTester`: Main application class

## Data Flow

### 1. Dataset Processing Flow
```
Raw Data (CSV + PDFs)
    ↓
UniversalProcessor
    ↓
PDFExtractor → Insights
    ↓
SegmentDiscovery → Segments
    ↓
VectorStore → Database
    ↓
TwinGenerator → Digital Twins
```

### 2. Response Generation Flow
```
Marketing Content
    ↓
API Endpoint
    ↓
Load/Generate Twins
    ↓
ResponseEngine
    ↓
Claude API / Fallback
    ↓
Response with Metrics
```

## Database Schema

### Tables

#### responses
- id (SERIAL PRIMARY KEY)
- dataset_id (TEXT)
- respondent_id (TEXT)
- segment (TEXT)
- question (TEXT)
- answer (TEXT)
- embedding (vector(384) or JSONB)
- metadata (JSONB)

#### segments
- id (SERIAL PRIMARY KEY)
- dataset_id (TEXT)
- segment_name (TEXT)
- centroid (vector(384) or JSONB)
- characteristics (JSONB)
- value_system (JSONB)

#### personas
- id (SERIAL PRIMARY KEY)
- dataset_id (TEXT)
- segment (TEXT)
- persona_data (JSONB)
- embedding (vector(384) or JSONB)

#### datasets
- id (TEXT PRIMARY KEY)
- name (TEXT)
- description (TEXT)
- config (JSONB)
- status (TEXT)
- created_at (TIMESTAMPTZ)

## Key Features

### 1. Multi-Dataset Support
- Upload and process multiple datasets
- Switch between datasets in UI
- Dataset-specific configurations

### 2. Automatic Segmentation
- K-means clustering
- Elbow method for optimal K
- Claude-powered interpretation

### 3. Fallback Mechanisms
- Works without Claude API
- Works without pgvector extension
- Pattern-based response generation

### 4. Real-time Processing
- Background dataset processing
- Status polling
- Progress indicators

## Environment Variables

```bash
DATABASE_URL=postgresql://[user]:[password]@[host]:[port]/[database]
ANTHROPIC_API_KEY=your_api_key_here
NODE_ENV=development|production
PORT=3000
```

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   - Copy `.env.local.example` to `.env.local`
   - Add database URL and API keys

3. **Initialize database**:
   ```bash
   npm run migrate
   ```

4. **Process dataset**:
   ```bash
   npm run init-dataset surf-clothing
   ```

5. **Start server**:
   ```bash
   npm run dev
   ```

6. **Access UI**:
   Open http://localhost:3000

## API Usage Examples

### Generate Responses
```javascript
POST /api/generate-response
{
  "marketingContent": "New sustainable surf wear...",
  "datasetId": "surf-clothing",
  "segments": ["Leader", "Leaning", "Learner", "Laggard"]
}
```

### Upload Dataset
```javascript
POST /api/upload-dataset
FormData:
  - survey: file.xlsx
  - pdfs: research.pdf
  - config: JSON configuration
```

## Production Deployment

1. **Vercel Deployment**:
   ```bash
   vercel --prod
   ```

2. **Database Setup**:
   - Use Supabase or similar PostgreSQL service
   - Enable pgvector extension if available

3. **Environment Variables**:
   - Set in Vercel dashboard
   - Include DATABASE_URL and ANTHROPIC_API_KEY

## Performance Considerations

- **Caching**: Twins cached for 10 minutes
- **Batch Processing**: Process responses in batches
- **Vector Indexing**: Use IVFFlat index for large datasets
- **Connection Pooling**: Max 10 database connections

## Error Handling

- Graceful fallbacks for API failures
- Database connection retry logic
- User-friendly error messages
- Detailed logging in development mode