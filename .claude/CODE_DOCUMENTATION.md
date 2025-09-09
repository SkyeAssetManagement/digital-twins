# Digital Twins Codebase Documentation - Complete System Overview

## Last Updated: 2025-09-09 - Universal Survey Pipeline Integration

## Project Overview
Evolved Digital Twin Response System featuring:
1. **Existing LOHAS System**: Production dual-engine AI system for surf-clothing consumer responses
2. **Universal Survey Pipeline**: New generic system for any demographic (mothers, retirees, professionals, etc.)
3. **Claude Opus 4.1 Integration**: Advanced persona modeling with survey-grounded authenticity

## Dual Architecture Overview

### Current Production System (LOHAS-Based)
```
┌─────────────────────────────────────────────────────────────┐
│                   Current Frontend (UI)                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           public/dual-engine-app.html                │   │
│  │  - Dual-column response comparison                   │   │
│  │  - Image/PDF upload with Claude Opus 4.1 analysis   │   │
│  │  - LOHAS segment filtering (Leader/Leaning/etc.)     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────┬────────────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────────────┐
│                 Current API Layer (Express)                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         api/dual-engine-response.js                 │   │
│  │  - Image analysis with Claude Opus 4.1              │   │
│  │  - Dual engine response generation                  │   │
│  │  - LOHAS segment responses                          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────┬────────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
┌───────▼──────────┐      ┌─────────▼───────────┐
│ Semantic Engine  │      │   Claude Engine     │
│ (OpenAI)         │      │ (Claude Opus 4.1)   │
│ ~1.6s, $0.002    │      │ ~6s, $0.03          │
└──────────────────┘      └─────────────────────┘
```

### New Universal Survey Pipeline (Planned)
```
┌─────────────────────────────────────────────────────────────┐
│              Universal Survey Frontend                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  - Survey dataset selector                           │   │
│  │  - Dynamic archetype filtering                       │   │
│  │  - Single-column Claude responses only               │   │
│  │  - Demographic context display                       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────┬────────────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────────────┐
│              Universal Survey API Layer                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │    /api/universal-digital-twin-response             │   │
│  │    /api/survey-datasets                             │   │
│  │    Multi-format data ingestion                      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────┬────────────────────────────────────────┘
                      │
┌─────────────────────▼────────────────────────────────────────┐
│              Processing Pipeline                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐  │
│  │ Data         │ │ Question     │ │ Dynamic Archetype    │  │
│  │ Ingestion    │ │ Categoriz.   │ │ Generation           │  │
│  │ (Multi-      │ │ (Claude      │ │ (Claude + LOHAS      │  │
│  │ format)      │ │ Opus)        │ │ Reference)           │  │
│  └──────────────┘ └──────────────┘ └──────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────────────┐
│         Claude Opus 4.1 Persona Engine (Only)                │
│  - Survey-grounded digital twins for any demographic         │
│  - Reference framework guidance (LOHAS, generational, etc.)  │
│  - Temperature randomization (0.8-1.5, no prefill)          │
└───────────────────────────────────────────────────────────────┘
```

## Directory Structure (Updated with Universal Pipeline)
```
digital-twins/
├── .claude/                          # Project documentation & standards
│   ├── CLAUDE.md                    # Development standards
│   ├── CODE_DOCUMENTATION.md        # This comprehensive documentation
│   └── projectStatus.md             # Current project status & universal plan
├── guides/                           # Implementation guides
│   └── Universal-Survey-Digital-Twins-Pipeline-Plan.md # Complete pipeline plan
├── api/                             # API endpoints
│   ├── dual-engine-response.js      # Current LOHAS dual-engine API
│   ├── universal-digital-twin-response.js # [PLANNED] Universal survey API
│   ├── survey-datasets.js           # [PLANNED] Dataset management API
│   ├── analyze-image.js             # Standalone image analysis
│   ├── generate-response.js         # Legacy response generation
│   └── digital-twin-service.js      # Digital twin management
├── src/                             # Core application code
│   ├── config/                      # Configuration (Phase 1)
│   │   └── app-config.js           # Centralized app configuration
│   ├── services/                    # Service layer (Phase 3)
│   │   ├── base.service.js         # Abstract base service
│   │   ├── dataset.service.js      # Dataset operations
│   │   ├── response.service.js     # Response generation
│   │   └── image.service.js        # Image analysis
│   ├── utils/                       # Utilities (Enhanced Phase 4)
│   │   ├── logger.js               # Structured logging
│   │   ├── error-handler.js        # Custom error types
│   │   ├── data-pipeline.js        # Pipeline framework
│   │   ├── data-normalizer.js      # Data transformations
│   │   ├── file-operations.js      # File I/O utilities
│   │   └── segment-analyzer.js     # Universal segment analysis
│   ├── semantic/                    # Current semantic engine
│   │   └── advanced_semantic_engine.js # OpenAI embeddings + LOHAS
│   ├── claude/                      # Claude persona engines
│   │   ├── integrated_persona_engine_v2.js # Current LOHAS engine
│   │   └── universal_persona_engine.js    # [PLANNED] Universal engine
│   ├── data_processing/             # Data processors (Universal)
│   │   ├── universal_processor.js   # [ENHANCED] Multi-format ingestion
│   │   ├── question_categorizer.js  # [NEW] Claude-powered categorization
│   │   ├── archetype_generator.js   # [NEW] Dynamic archetype creation
│   │   └── response_scorer.js       # [NEW] Universal scoring system
│   └── vector_db/                   # Vector database
│       └── unified_vector_store.js  # Consolidated vector operations
├── public/                          # Frontend files
│   ├── dual-engine-app.html        # Current LOHAS dual-engine UI
│   ├── universal-survey-app.html   # [PLANNED] Universal survey UI
│   └── index.html                  # Legacy UI
├── data/                           # Data storage
│   ├── datasets/                   # Survey datasets
│   │   ├── surf-clothing/          # Current LOHAS dataset
│   │   │   ├── raw/               # Original survey data
│   │   │   └── processed/         # Classification results
│   │   ├── mums/                  # [PLANNED] Mother survey data
│   │   └── [other-demographics]/  # Future survey datasets
│   └── digital-twins/             # Generated personas
│       └── [dataset-name]-personas.json
├── scripts/                        # Processing & analysis scripts
│   ├── lohas-classification-system.js # Current LOHAS processing
│   ├── universal-survey-processor.js  # [PLANNED] Universal processing
│   └── test-*.js                      # Testing scripts
├── dbconfig.yaml                   # Database configuration (Supabase)
├── server.js                       # Express server
├── package.json                    # Dependencies
└── .env.local                     # Environment variables
```

## System Capabilities Overview

### Current Production Features (LOHAS System)

#### 1. Image/PDF Analysis
- **Technology**: Claude Opus 4.1 (claude-opus-4-1-20250805)
- **Process**: 
  - Upload image/PDF via drag-drop or click
  - Claude extracts marketing content
  - Content displayed in editable textarea
  - Multiple file support

#### 2. Dual Response Engines

**Semantic Engine** (src/semantic/advanced_semantic_engine.js)
- OpenAI text-embedding-3-large (3072 dimensions)
- LOHAS survey data integration
- Fast response time (~1.6s), low cost ($0.002/response)

**Claude Persona Engine** (src/claude/integrated_persona_engine_v2.js)
- Claude Opus 4.1 for persona modeling
- Survey-grounded psychological profiling
- Higher quality but slower (~6s), higher cost ($0.03/response)

#### 3. LOHAS Segmentation (Production)
Four surf-clothing consumer segments based on 1,006 survey responses:
- **Leader** (12.4%): Environmental pioneers, premium willingness
- **Leaning** (22.6%): Quality-conscious, sustainability-aware
- **Learner** (37.5%): Curious, needs education on value
- **Laggard** (27.5%): Price-focused, skeptical of premium claims

#### 4. Production UI Features
- **Dual-column comparison**: Side-by-side semantic vs Claude responses
- **Image analysis integration**: Thumbnail + textarea layout
- **LOHAS segment filtering**: View responses by specific segments
- **Real-time status**: Analysis progress and completion states
- **Multiple file support**: Batch image/PDF processing

### Planned Universal Survey System

#### 1. Multi-Demographic Support
- **Target Populations**: Mothers, retirees, professionals, students, etc.
- **Reference Frameworks**: LOHAS, generational theory, psychographics as guidance
- **Dynamic Categorization**: Claude Opus creates contextually appropriate question categories

#### 2. LLM-Driven Archetype Generation  
- **Adaptive Personas**: 4-6 archetypes per demographic
- **Survey-Grounded**: Based on actual response patterns
- **Framework Integration**: Uses proven models as intelligent guidance
- **Spending Correlation**: Archetype-spending behavior alignment

#### 3. Universal Data Processing
- **Multi-Format Ingestion**: Excel, CSV, JSON, TSV support
- **Intelligent Concatenation**: Auto-detect and merge multi-row headers
- **Question Categorization**: Values, quality, price, health/welfare (adaptive)
- **Predictive Analysis**: Identify questions most correlated with spending

#### 4. Claude-Only Response Engine
- **Single Engine Focus**: Claude Opus 4.1 exclusively (no semantic engine)
- **Temperature Randomization**: 0.8-1.5 range, no prefill randomization
- **Demographic Context**: Responses appropriate to target population
- **Survey Integration**: Grounded in actual consumer behavior data

## API Endpoints

### Current Production APIs (LOHAS System)

#### POST /api/dual-engine-response
Main endpoint for LOHAS-based dual-engine responses.

**Request:**
```json
{
  "content": "marketing text or base64 image",
  "contentType": "text" | "image",
  "segments": ["Leader", "Leaning", "Learner", "Laggard"],
  "responseCount": 10,
  "analyzeOnly": false,
  "originalImage": "base64..."
}
```

**Response:**
```json
{
  "semantic": [/* semantic engine responses */],
  "claude": [/* Claude engine responses */],
  "stats": {
    "totalResponses": 80,
    "avgSemanticTime": 1600,
    "avgClaudeTime": 6000
  },
  "contentAnalyzed": "extracted marketing content",
  "wasImageAnalyzed": true
}
```

### Planned Universal Survey APIs

#### POST /api/universal-digital-twin-response
Main endpoint for any survey demographic responses.

**Request:**
```json
{
  "datasetId": 123,
  "content": "marketing text or base64 image",
  "contentType": "text" | "image",
  "archetypeIds": [1, 3, 5],
  "responseCount": 10,
  "temperatureRange": [0.8, 1.5]
}
```

**Response:**
```json
{
  "responses": [
    {
      "archetypeName": "Conscious Mothers",
      "demographic": "mothers",
      "text": "response text",
      "sentiment": "positive/neutral/negative",
      "purchaseIntent": 1-10,
      "temperature": 1.2,
      "responseTime": 6000
    }
  ],
  "stats": {
    "totalResponses": 30,
    "avgResponseTime": 6000,
    "demographicContext": "mothers survey dataset"
  }
}
```

#### GET /api/survey-datasets
Dataset management and information.

**Response:**
```json
{
  "datasets": [
    {
      "id": 1,
      "name": "Mother Survey 2025",
      "demographic": "mothers",
      "totalQuestions": 150,
      "totalResponses": 500,
      "archetypes": [
        {
          "id": 1,
          "name": "Conscious Mothers",
          "percentage": 18.5,
          "description": "Environmental focus, premium willingness"
        }
      ]
    }
  ]
}
```

## Configuration

### Environment Variables (.env.local)
```
# AI Services
OPENAI_API_KEY=sk-...                    # For semantic embeddings
ANTHROPIC_API_KEY=sk-ant-api...          # For Claude Opus 4.1

# Database (Universal System)
DATABASE_URL=postgresql://...            # Supabase connection
SUPABASE_URL=https://...                 # From dbconfig.yaml
SUPABASE_KEY=...                         # Service role key

# Server
PORT=3000
NODE_ENV=development
```

### Database Configuration (dbconfig.yaml)
```yaml
# Supabase PostgreSQL configuration for universal system
host: aws-0-us-east-2.pooler.supabase.com
port: 5432
database: postgres
user: postgres.qbgffhgtwcvrjmqbdabe
pool_mode: session
password: [configured separately]
```

## Key Technical Decisions & Principles

### Production System (LOHAS)

1. **Claude Opus 4.1 for Vision**
   - Replaced deprecated GPT-4 Vision
   - Better marketing content extraction
   - More nuanced understanding of visual elements

2. **No Fallback Policy** (per CLAUDE.md)
   - API failures return "NA" instead of placeholder data
   - Ensures data integrity and clear error states
   - No demo or sample data contamination

3. **Multiple Response Generation**
   - Temperature and parameter variation
   - Diverse but segment-appropriate responses
   - Cost optimization (max 3 unique Claude responses, then reuse)

4. **Survey-Grounded Authenticity**
   - All personas based on real 1,006 survey responses
   - No artificial or demo personas
   - Statistical validation of segment distributions

### Universal Pipeline Principles

1. **LLM-Driven Intelligence**
   - Claude Opus creates categories and archetypes dynamically
   - Reference frameworks (LOHAS, etc.) provide guidance, not rigid templates
   - Context-aware adaptation to any demographic

2. **Production-First Development**
   - Real survey data integration from day one
   - Comprehensive error handling at every layer
   - No placeholder or demo responses

3. **Generic Architecture**
   - Multi-format data ingestion (Excel, CSV, JSON, TSV)
   - Adaptive UI supporting any demographic
   - Universal database schema with flexible JSONB fields

4. **Claude Opus 4.1 Exclusive** (Universal System)
   - Single engine focus for consistency
   - No semantic engine in universal pipeline
   - Temperature randomization without prefill variation

## Development Timeline & Major Updates

### September 2025 - Current Production System (LOHAS)

**Phase 4: Data Processing & Analytics Consolidation (Completed)**
1. **Claude Opus 4.1 Integration**: Upgraded from deprecated models
2. **Advanced UI**: Thumbnail + textarea layout, multiple file support
3. **PDF Analysis**: Full document processing capability
4. **No Fallback Policy**: Strict "NA" returns per CLAUDE.md standards
5. **Performance Optimization**: 
   - Max token limit (1,000 to avoid timeouts)
   - Retry logic (3 attempts with exponential backoff)
   - Rate limiting (2s between requests, 3s between segments)
6. **Error Handling**: 
   - Whitespace trimming for API compliance
   - Comprehensive error logging and debugging
   - Graceful degradation without placeholder data

**Refactoring Achievements:**
- EventEmitter-based data pipeline orchestration
- Shared utility modules (4 new utility files)
- Multi-level caching for expensive operations
- Standardized processing patterns across all modules

### September 2025 - Universal Pipeline Planning

**Current Status**: Comprehensive plan completed
1. **Universal Pipeline Design**: Complete methodology for any demographic
2. **LLM-Driven Architecture**: Claude Opus creates categories and archetypes
3. **Reference Framework Integration**: LOHAS, generational, psychographic guidance
4. **Database Schema**: Universal schema supporting any survey type
5. **Implementation Roadmap**: 7-week phased approach with clear deliverables

## Performance Characteristics

### Current Production System (LOHAS)
- **Semantic Engine**: ~1.6s per response, ~$0.002 cost
- **Claude Engine**: ~6s per response, ~$0.03 cost, higher quality
- **Image Analysis**: 2-3s with Claude Opus 4.1, ~$0.02 per image
- **Batch Processing**: Multiple file uploads with progress tracking
- **Survey Data**: 1,006 respondents classified into 4 segments
- **Response Accuracy**: 95% segment distribution matching

### Universal Pipeline (Planned)
- **Question Categorization**: Batch processing 20-30 questions per API call
- **Archetype Generation**: 4-6 dynamic archetypes per demographic
- **Response Generation**: Claude Opus 4.1 only, ~6s per response
- **Data Processing**: Multi-format ingestion with intelligent header detection
- **Scalability**: Supports unlimited demographics and survey types
- **Cost Optimization**: Strategic caching and batch processing

## Deployment & Development

### Current Production Deployment (Vercel)
- **Auto-deployment**: GitHub main branch integration
- **API Routes**: Auto-detected in /api folder
- **Environment Variables**: Configured in Vercel dashboard
- **Static Assets**: Served from /public folder

### Local Development Setup
```bash
# Install dependencies
npm install

# Start development server
npm run dev
# Server runs on http://localhost:3000

# Access applications
# Current LOHAS system: /dual-engine-app.html
# Legacy system: /index.html
```

### Universal Pipeline Deployment (Planned)
```bash
# Database setup (Supabase)
# Configure dbconfig.yaml connection
# Run schema migrations for universal tables

# Environment configuration
# Add database credentials to .env.local
# Configure Claude Opus 4.1 API access

# Development workflow
npm run dev:universal  # Planned universal development mode
# Access: /universal-survey-app.html
```

## Testing & Quality Assurance

### Current System Testing
```bash
# API Testing
node scripts/test-digital-twins.js          # Digital twin API validation
node scripts/test-claude-integration.js     # Claude persona system
node scripts/test-api-reliability.js        # API failure rate testing

# Access Points
# Local: http://localhost:3000/dual-engine-app.html
# Production: [Vercel URL]/dual-engine-app.html
```

### Universal Pipeline Testing (Planned)
```bash
# Survey Processing Tests
node scripts/test-universal-processor.js    # Multi-format data ingestion
node scripts/test-question-categorizer.js   # Claude-powered categorization
node scripts/test-archetype-generator.js    # Dynamic persona creation

# Integration Testing
node scripts/test-database-integration.js   # Supabase operations
node scripts/test-multi-demographic.js      # Cross-demographic validation
```

## Cost Analysis

### Current Production Costs (LOHAS)
- **Semantic Engine**: ~$0.002 per response (OpenAI embeddings)
- **Claude Engine**: ~$0.03 per response (limited to 3 unique per segment)
- **Image Analysis**: ~$0.02 per image (Claude Opus 4.1 vision)
- **Monthly Estimate**: $50-200 depending on usage

### Universal Pipeline Costs (Projected)
- **Question Categorization**: ~$0.05 per survey dataset (one-time)
- **Archetype Generation**: ~$0.10 per demographic (one-time)
- **Response Generation**: ~$0.03 per response (Claude Opus 4.1 only)
- **Data Processing**: Minimal (local computation)
- **Scalability**: Cost per response remains constant across demographics

## Roadmap & Future Development

### Immediate (Q4 2025)
1. **Universal Pipeline Implementation**: Complete 7-week development plan
2. **Mother Survey Integration**: First non-LOHAS demographic
3. **Database Migration**: Transition to Supabase universal schema

### Medium-term (Q1 2026)
1. **Multi-demographic Support**: Retirees, professionals, students
2. **Advanced Analytics**: Cross-demographic comparison tools
3. **Batch Processing**: Large-scale survey analysis capabilities
4. **A/B Testing Framework**: Response quality optimization

### Long-term (Q2-Q4 2026)
1. **Real-time Classification**: Live survey response processing
2. **Custom Framework Integration**: Beyond LOHAS reference models
3. **Predictive Modeling**: Spending behavior forecasting
4. **API Platform**: Public API for external integrations
5. **Enterprise Features**: White-label deployments, custom branding

---

*Last Updated: 2025-09-09*  
*Status: Production LOHAS system operational, Universal pipeline planned*  
*Next Milestone: Universal pipeline Phase 1 implementation*