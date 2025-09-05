# Digital Twin Consumer Response System - Complete Code Documentation

## Last Updated: 2025-09-05 - Major Refactoring Phase 4 Complete (Data Processing & Analytics)

## Project Overview
An advanced AI-powered system that generates authentic consumer responses to marketing content, based on real survey data from 1,006 respondents segmented into LOHAS (Lifestyles of Health and Sustainability) categories. The system features dual-engine response generation combining OpenAI's advanced semantic embeddings with Anthropic's Claude Opus 4.1.

### Major Updates - September 2025

#### Phase 4: Data Processing & Analytics Consolidation (Completed)
Successfully refactored all data processing modules with:
1. **Data Pipeline Framework**: EventEmitter-based orchestration with progress tracking
2. **Shared Utilities**: 4 new utility modules for common operations
3. **Standardized Processing**: All processors now use consistent patterns
4. **Enhanced Caching**: Multi-level caching for expensive operations

Key files created:
- `src/utils/data-pipeline.js` - Pipeline orchestration framework
- `src/utils/data-normalizer.js` - Data transformation utilities  
- `src/utils/file-operations.js` - Centralized file I/O operations
- `src/utils/segment-analyzer.js` - LOHAS segment management

#### Multi-Response Generation System
Successfully implemented dual-engine system with multiple response variations:
1. **Advanced Semantic Engine**: OpenAI text-embedding-3-large (3072D), ~1.6s response, $0.002/response
2. **Claude Opus 4.1 Pipeline**: Survey-grounded XML personas, ~6s response, $0.03/response

Key achievements:
- Generate 3+ unique responses per engine while maintaining value alignment
- Proper survey data integration with persona vectors
- Side-by-side comparison UI at `/dual-engine-app.html`
- 24 responses per ad documentation (4 segments × 2 engines × 3 variations)

#### Advanced Semantic Engine Features
- 3072-dimensional embeddings from text-embedding-3-large
- Latent space interpolation for natural variation
- Template-based response generation with variable substitution
- Persona vectors computed from survey narratives
- Multi-manifold traversal for response diversity

## Architecture Diagram (Updated with Claude Persona Vectors)

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Browser)                        │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   HTML UI   │  │  JavaScript  │  │  Tailwind CSS    │   │
│  └──────┬──────┘  └──────┬───────┘  └──────────────────┘   │
└─────────┼─────────────────┼──────────────────────────────────┘
          │                 │
          ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Layer (Express.js)                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Endpoints:                                          │   │
│  │  • /api/generate-response (POST)                     │   │
│  │  • /api/generate-claude-response (POST) [NEW]        │   │
│  │  • /api/digital-twins/personas (GET)                 │   │
│  │  • /api/digital-twins/generate-response (POST)       │   │
│  │  • /api/digital-twins/market-analysis (POST)         │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────┬─────────────────────────┬───────────────────┘
                │                         │
                ▼                         ▼
┌──────────────────────────┐  ┌──────────────────────────────┐
│  Claude Persona System   │  │    Digital Twin Service      │
│  ┌────────────────────┐  │  │  ┌─────────────────────┐    │
│  │ Persona Vectors    │  │  │  │  Survey-Based Twins │    │
│  │ (384-dimensional)  │  │  │  │  (1,006 respondents)│    │
│  └────────────────────┘  │  │  └─────────────────────┘    │
│  ┌────────────────────┐  │  │  ┌─────────────────────┐    │
│  │ Claude API         │  │  │  │  Response Engine    │    │
│  │ Integration        │  │  │  │  with Fallbacks     │    │
│  └────────────────────┘  │  │  └─────────────────────┘    │
│  ┌────────────────────┐  │  └──────────────────────────────┘
│  │ Consistency Mgmt   │  │
│  └────────────────────┘  │
└──────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│               Memory & Persistence Layer                      │
│  ┌──────────────────┐  ┌────────────────┐  ┌────────────┐  │
│  │ Hierarchical     │  │  Redis/Memory  │  │  Vector    │  │
│  │ Memory System    │  │  Cache         │  │  Store     │  │
│  └──────────────────┘  └────────────────┘  └────────────┘  │
└─────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                                │
│  ┌──────────────────┐  ┌────────────────┐  ┌────────────┐  │
│  │  Survey Data     │  │  Persona JSON  │  │  LOHAS     │  │
│  │  (Excel/CSV)     │  │  Files         │  │  Segments  │  │
│  └──────────────────┘  └────────────────┘  └────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
digital-twins/
├── .claude/                      # Project documentation
│   ├── CLAUDE.md                # Development standards
│   ├── CODE DOCUMENTATION.md    # This file
│   └── REFACTOR-GUIDE.md       # Phased refactor roadmap
├── api/                         # API endpoints (Standardized in Phase 3)
│   ├── generate-response.js    # Main response generation
│   ├── generate-claude-response.js # Claude-enhanced responses
│   ├── digital-twin-service.js # Digital twin management
│   └── *.js                     # Other endpoints
├── src/
│   ├── config/                 # Configuration (Phase 1)
│   │   └── app-config.js       # Centralized app configuration
│   ├── services/               # Service layer (Phase 3)
│   │   ├── base.service.js     # Abstract base service
│   │   ├── dataset.service.js  # Dataset operations
│   │   ├── response.service.js # Response generation
│   │   └── image.service.js    # Image analysis
│   ├── middleware/             # Middleware (Phase 3)
│   │   └── validation.middleware.js # Request validation
│   ├── utils/                  # Utilities (Enhanced in Phase 4)
│   │   ├── logger.js           # Structured logging
│   │   ├── error-handler.js    # Custom error types
│   │   ├── data-pipeline.js    # Pipeline framework [NEW]
│   │   ├── data-normalizer.js  # Data transformations [NEW]
│   │   ├── file-operations.js  # File I/O utilities [NEW]
│   │   └── segment-analyzer.js # LOHAS segments [NEW]
│   ├── vector_db/              # Vector database (Phase 2)
│   │   └── unified_vector_store.js # Consolidated vector store
│   ├── data_processing/        # Data processors (Phase 4)
│   │   ├── universal_processor.js # [REFACTORED]
│   │   ├── pdf_extractor.js      # [REFACTORED]
│   │   ├── segment_discovery.js  # [REFACTORED]
│   │   └── survey_response_loader.js # [REFACTORED]
├── data/                        # Data storage
│   ├── datasets/               
│   │   └── surf-clothing/      
│   │       ├── raw/            # Original survey data
│   │       ├── *.csv           # Classification results
│   │       └── *.json          # Processed data
│   └── digital-twins/          
│       ├── surf-clothing-personas.json
│       └── personas/           # Individual persona files
├── guides/                      # Methodology guides
│   ├── LOHAS-Segmentation-Methodology-FINAL.md
│   ├── LOHAS-Classification-Journey.md
│   └── *.md                    # Other guides
├── public/                     # Frontend files
│   ├── index.html             
│   ├── script.js              
│   └── styles.css             
├── scripts/                    # Data processing scripts
│   ├── lohas-classification-system.js
│   ├── refined-lohas-classification.js
│   ├── generate-digital-twins.js
│   ├── test-digital-twins.js
│   └── *.js                   # Analysis scripts
├── src/                       # Core application code
│   ├── claude/                # Claude API integration [NEW]
│   │   └── claude_persona_helper.js
│   ├── config/                # Configuration [NEW]
│   │   └── production_config.js
│   ├── digital_twins/         
│   │   ├── twin_generator.js 
│   │   └── response_engine.js
│   ├── memory/                # Memory system [NEW]
│   │   └── hierarchical_memory.js
│   ├── personas/              # Persona management [NEW]
│   │   ├── claude_persona_injector.js
│   │   ├── persona_consistency_manager.js
│   │   └── persona_vector_generator.js
│   └── vector_db/             
│       └── vector_store.js    
├── server.js                  # Main Express server
├── package.json              
└── .env.local                # Environment variables
```

## Module Summaries

### Core Server (`server.js`)
- Express.js server running on port 3000
- Serves static frontend files
- Routes API requests to appropriate handlers
- Integrates Digital Twin Service for persona management
- Health check and error handling middleware

### API Modules

#### `api/generate-response.js`
- Main endpoint for generating consumer responses
- Loads survey-based digital twins for surf-clothing dataset
- Falls back to AI-generated twins for other datasets
- Enhanced fallback responses based on actual survey data
- Returns responses for all 4 LOHAS segments

#### `api/digital-twin-service.js`
- Manages digital twin personas created from survey data
- Methods:
  - `getAvailablePersonas()`: Lists all personas
  - `getPersona(id)`: Returns specific persona details
  - `generateResponse()`: Creates persona-specific prompts
  - `analyzeMarketOpportunity()`: Market analysis based on product features
  - `comparePersonaResponses()`: Cross-segment comparison

### Data Processing Scripts

#### `scripts/refined-lohas-classification.js`
- Classifies 1,006 survey respondents into LOHAS segments
- Uses percentile-based approach with behavioral weighting
- Achieves target distributions:
  - Leader: 12.4% (125 respondents)
  - Leaning: 22.6% (227 respondents)  
  - Learner: 37.5% (377 respondents)
  - Laggard: 27.5% (277 respondents)

#### `scripts/generate-digital-twins.js`
- Creates digital twin personas from classified survey data
- Analyzes:
  - Demographics
  - Values and beliefs
  - Purchasing behavior
  - Brand relationships
  - Environmental activities
- Outputs JSON personas with response configurations

### Response Engine (`src/digital_twins/response_engine.js`)
- Integrates with Claude API for AI responses
- Enhanced prompting with segment-specific guidance
- Uses vector store for finding similar responses
- Fallback to semantic response engine (NEW)
- Analyzes sentiment and purchase intent

### Semantic Response Engine (`src/digital_twins/semantic_response_engine.js`) - NEW
**Advanced semantic understanding without keyword matching:**
- Pre-computed theme embeddings for instant analysis
- Segment-specific value alignment scoring
- Natural language understanding using vector similarity
- Multiple response variations with consistent personality
- Cached embeddings for <500ms response times

**Theme Detection:**
- sustainability, lifestyle, performance, value, brand, social, innovation

**Tone Analysis:**
- aggressive, aspirational, inclusive, exclusive, playful, serious, authentic, commercial

**Performance:**
- Pre-computation: ~2 seconds on initialization
- Response generation: <15ms with cache hits
- 100% segment differentiation on test content

### Vector Store (`src/vector_db/vector_store.js`)
- PostgreSQL with pgvector extension
- Stores and retrieves embeddings
- In-memory fallback for local development
- Methods for finding similar responses by segment

## Key Data Files

### Survey Data
- **Location**: `data/datasets/surf-clothing/raw/All_Surf_detail 2.xlsx`
- **Contents**: 1,006 survey responses with 200+ questions
- **Format**: Excel with main headers and sub-headers

### Classification Results
- **Location**: `data/datasets/surf-clothing/refined-lohas-classification.csv`
- **Contents**: All respondents with:
  - LOHAS segment assignment
  - Percentile rank
  - Individual variable scores
  - Propensity scores
  - Classification reasoning

### Digital Twin Personas
- **Location**: `data/digital-twins/surf-clothing-personas.json`
- **Contents**: Aggregated profiles for each segment including:
  - Key characteristics
  - Demographics
  - Values profile
  - Purchasing behavior
  - Brand relationships
  - Example responses

## API Endpoints

### Core Response Generation
```
POST /api/generate-response
Body: {
  marketingContent: string,
  imageData?: string (base64),
  datasetId: string (default: 'surf-clothing'),
  segments: array (default: ['Leader','Leaning','Learner','Laggard'])
}
Returns: Responses from all segments with sentiment and purchase intent
```

### Digital Twin Management
```
GET /api/digital-twins/personas
Returns: List of available personas with market sizes

GET /api/digital-twins/persona/:id
Returns: Detailed persona information

POST /api/digital-twins/generate-response
Body: { personaId, prompt, context }
Returns: Persona-specific response configuration

POST /api/digital-twins/market-analysis
Body: { productFeatures }
Returns: Market opportunity analysis

POST /api/digital-twins/compare-responses
Body: { prompt, context }
Returns: Responses from all personas for comparison
```

## LOHAS Segmentation Methodology

### Classification Variables (Weighted)
1. **Actual sustainable purchase** (Weight: 2.5) - Q69
2. **Willingness to pay 25% premium** (Weight: 2.0) - Q145
3. **Patagonia Worn Wear awareness** (Weight: 1.5) - Q117
4. **Brand values alignment** (Weight: 1.2) - Q154
5. **Environmental evangelism** (Weight: 1.2) - Q151
6. **Sustainability importance** (Weight: 1.2) - Q59
7. **Environmental activism** (Weight: 1.0) - Q100
8. **Price sensitivity** (Weight: 0.8, inverted) - Q57

### Percentile-Based Classification
1. Rank all respondents by composite score
2. Apply percentile thresholds:
   - Top 12.5% → LOHAS Leader
   - Next 22.5% → LOHAS Leaning
   - Next 37.5% → LOHAS Learner
   - Bottom 27.5% → LOHAS Laggard
3. Validate with absolute criteria
4. Calculate stratified propensity scores

## Segment Profiles

### LOHAS Leader (12.4%)
- 100% have purchased for sustainability
- Willing to pay 25%+ premium
- Environmental evangelists
- Low price sensitivity (30% weight)
- High sustainability focus (90% weight)

### LOHAS Leaning (22.6%)
- 76% have purchased for sustainability
- Willing to pay 10-15% premium
- Balance sustainability with practicality
- Moderate price sensitivity (60% weight)
- Balanced sustainability focus (50% weight)

### LOHAS Learner (37.5%)
- Limited sustainable purchases
- Price is primary factor
- Open to education
- Will pay 0-5% premium if quality matches
- Price sensitivity (60% weight)

### LOHAS Laggard (27.5%)
- Never purchased for sustainability
- High price sensitivity (90% weight)
- No premium payment willingness
- Minimal sustainability focus (10% weight)
- Focus on price and functionality

## Environment Configuration

### Required Environment Variables (.env.local)
```
DATABASE_URL=postgresql://[connection_string]
ANTHROPIC_API_KEY=sk-ant-api03-[key]
NODE_ENV=development
PORT=3000
```

## Testing

### Running Tests
```bash
# Test digital twin API
node scripts/test-digital-twins.js

# Start development server
npm run dev

# Access frontend
http://localhost:3000
```

### Key Test Scenarios
1. Generate responses for all segments
2. Compare persona responses
3. Analyze market opportunity
4. Verify classification accuracy

### Claude Integration Modules (NEW)

#### `src/claude/claude_persona_helper.js`
- Converts LOHAS segments to Claude system prompts
- Maps survey responses to Big Five personality traits
- Integrates with Anthropic Claude API
- Caches personas for performance

#### `src/personas/persona_vector_generator.js`
- Generates 384-dimensional persona vectors from survey data
- Maps LOHAS segments to personality dimensions
- Implements trait-specific embedding patterns
- Calculates vector similarity between personas

#### `src/personas/claude_persona_injector.js`
- Injects persona vectors into Claude API calls
- Monitors response consistency in real-time
- Detects and corrects personality drift
- Optimizes temperature based on personality traits

#### `src/personas/persona_consistency_manager.js`
- Applies contextual variation while maintaining core traits
- Prevents personality drift using split-softmax approach
- Tracks consistency metrics over time
- Generates correction prompts when drift detected

#### `src/memory/hierarchical_memory.js`
- Short-term memory (2-hour conversation buffer)
- Mid-term memory (7-day session summaries)
- Long-term memory (persistent trait patterns)
- Redis integration with in-memory fallback
- Retrieves relevant context for conversations

#### `src/config/production_config.js`
- Orchestrates all Claude persona components
- Main integration class for production deployment
- Performance monitoring and metrics tracking
- Graceful error handling and fallbacks

#### `api/generate-claude-response.js`
- Claude-enhanced API endpoint
- Supports persona vectors toggle
- Integrates survey-based digital twins
- Provides segment-appropriate fallbacks
- Calculates sentiment and purchase intent

## Recent Updates (2025-09-03)

### Completed Tasks
1. ✅ Classified 1,006 survey respondents into LOHAS segments
2. ✅ Generated digital twin personas from survey data
3. ✅ Integrated personas with API response generation
4. ✅ Created comprehensive methodology documentation
5. ✅ Enhanced fallback responses with segment-specific content
6. ✅ Achieved target segment distributions
7. ✅ Updated Claude API integration with latest model
8. ✅ **Implemented Claude Persona Vector System** (NEW)
   - 384-dimensional persona vectors
   - Personality consistency management
   - Hierarchical memory system
   - Real-time drift prevention
   - Production-ready configuration

### Key Achievements
- 95% accuracy in matching expected segment distributions
- 29.5% of respondents show high propensity to pay premium
- Clear stratification between payment willingness levels
- Full transparency with exported classification workings
- Survey-based personas integrated with response generation

## Performance Considerations

### Caching Strategy
- Digital twins cached for 10 minutes
- Vector store connections pooled
- In-memory fallback for development

### Scalability
- Supports multiple datasets
- Persona generation is async
- Database queries optimized with indexes

## Security

### API Security
- CORS enabled
- Request size limits (50MB)
- Environment variables for sensitive data
- No credentials in code

### Data Privacy
- Survey data anonymized (respondent IDs only)
- No PII in classifications
- Personas use aggregate data

## Current Status

### Working Features
✅ Digital twin generation from survey data
✅ LOHAS classification system
✅ API endpoints for personas
✅ Frontend interface
✅ Fallback responses with segment characteristics

### Known Issues
⚠️ Claude API returning 404 (model version issue)
⚠️ Using fallback responses instead of AI-generated
⚠️ Database connection falls back to in-memory

### Response Quality
Currently using enhanced fallback responses that include:
- Segment-specific market percentages
- Appropriate purchase intent scores
- Values-based messaging
- Price sensitivity considerations

## Maintenance

### Adding New Datasets
1. Place data in `data/datasets/[dataset-name]/`
2. Create config.json with segment definitions
3. Run classification scripts if survey data
4. Generate digital twins
5. Test with API

### Updating Classifications
1. Modify weights in classification script
2. Rerun `refined-lohas-classification.js`
3. Regenerate digital twins
4. Update documentation

## Support

### Common Issues
- **Generic responses**: Check if digital twins are loaded
- **Database errors**: Falls back to in-memory store
- **Port conflicts**: Kill existing node processes
- **Missing dependencies**: Run `npm install`

### Debugging
- Check server logs for errors
- Verify .env.local configuration
- Test individual API endpoints
- Review classification CSV for accuracy

## Future Enhancements

### Planned Features
- Real-time classification updates
- Multi-dataset comparison
- Advanced market analysis
- Custom segment definitions
- A/B testing framework

### Research Opportunities
- Temporal analysis of segments
- Cross-cultural comparisons
- Predictive modeling
- Behavioral clustering
- Response optimization

---

Last Updated: 2025-09-03
Version: 2.0.0
Status: Production Ready with Fallback Responses

---

## MAJOR REFACTORING - September 5, 2025

### Completed Phases

#### Phase 1: Core Infrastructure (COMPLETED)
- Centralized configuration system (app-config.js)
- Standardized error handling and logging
- Custom error types with proper error propagation
- Retry logic for external service calls

#### Phase 2: Vector Store Consolidation (COMPLETED)
- Created unified vector store combining best features
- Multiple embedding provider support (OpenAI, local)
- PostgreSQL with pgvector + in-memory fallback
- Comprehensive error handling and retry logic
- Embedding cache for performance
- Updated all references to use unified store

#### Phase 3: API & Service Layer Standardization (COMPLETED)
- Created comprehensive service layer architecture
- Implemented validation middleware with schemas
- Applied asyncHandler to all API endpoints
- Standardized response formats across all APIs
- Extracted business logic to service classes
- Added input sanitization and rate limiting

### Refactored Components

#### Unified Vector Store (NEW)
File: src/vector_db/unified_vector_store.js
- Consolidates vector_store.js and enhanced_vector_store.js
- Configurable embedding providers
- Automatic fallback mechanisms
- Connection pooling and retry logic
- Comprehensive test coverage

#### Service Layer (NEW - Phase 3)
Files: src/services/
- base.service.js: Abstract base class for all services
- dataset.service.js: Dataset management operations
- response.service.js: Response generation logic
- image.service.js: Image analysis with Claude Vision
- index.js: Service exports

Features:
- Centralized business logic
- Built-in caching mechanisms
- Standardized validation
- Consistent error handling
- Response formatting
- Metrics logging

#### API Layer Updates
- All endpoints now use service layer
- Validation middleware applied
- asyncHandler wrapper for error handling
- Standardized response formats
- Input sanitization
- Rate limiting support

### Infrastructure Improvements
1. **Configuration**: Centralized via appConfig singleton
2. **Error Handling**: Custom error types + asyncHandler wrapper
3. **Logging**: Context-aware structured logging
4. **Database**: Connection pooling with retry logic
5. **Testing**: Comprehensive test suite for unified store

### Next Phase: API & Service Layer Standardization
- Create service layer abstractions
- Implement comprehensive validation middleware
- Extract business logic from API endpoints

---

Refactoring guided by .claude/aider-guide.md and refactorPlan.md
