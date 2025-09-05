# Digital Twin System Architecture

## System Overview
The Digital Twin Consumer Response System is a sophisticated AI-powered platform that generates authentic consumer responses based on real survey data from 1,006 respondents segmented into LOHAS (Lifestyles of Health and Sustainability) categories.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Applications                       │
│  (Web UI, Mobile Apps, Third-party Integrations)             │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway Layer                          │
│  • Rate Limiting  • Authentication  • Request Routing         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  Application Server (Node.js)                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   API Endpoints                       │   │
│  │  • /api/generate-response                            │   │
│  │  • /api/generate-claude-response                     │   │
│  │  • /api/digital-twins/*                             │   │
│  │  • /api/analyze-image                               │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                         │                                    │
│  ┌──────────────────────┴───────────────────────────────┐   │
│  │                 Service Layer                         │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │   │
│  │  │   Dataset   │  │   Response   │  │   Image    │ │   │
│  │  │   Service   │  │   Service    │  │  Service   │ │   │
│  │  └─────────────┘  └──────────────┘  └────────────┘ │   │
│  └───────────────────────────────────────────────────────┘   │
│                         │                                    │
│  ┌──────────────────────┴───────────────────────────────┐   │
│  │              Business Logic Layer                     │   │
│  │  • Persona Generation  • Segment Classification       │   │
│  │  • Response Synthesis  • Market Analysis             │   │
│  └───────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────────┐
│                    Data Access Layer                          │
│  ┌────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │  Vector Store  │  │  PostgreSQL     │  │   Redis     │  │
│  │  (pgvector)    │  │  (Survey Data)  │  │   Cache     │  │
│  └────────────────┘  └─────────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────────┐
│                 External Services                             │
│  ┌────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │   OpenAI API   │  │  Anthropic API  │  │  Analytics  │  │
│  │  (Embeddings)  │  │  (Claude Opus)  │  │   Services  │  │
│  └────────────────┘  └─────────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. API Layer
**Location:** `/api/`
**Purpose:** HTTP endpoint handlers
**Key Files:**
- `generate-response.js` - Semantic response generation
- `generate-claude-response.js` - Claude-based responses
- `digital-twin-service.js` - Twin management
- `analyze-image.js` - Image analysis

### 2. Service Layer
**Location:** `/src/services/`
**Purpose:** Business logic abstraction
**Components:**
- **BaseService** - Abstract service with caching and validation
- **DatasetService** - Dataset management and configuration
- **ResponseService** - Response generation orchestration
- **ImageService** - Image analysis with Claude Vision

### 3. Data Processing Pipeline
**Location:** `/src/data_processing/`
**Purpose:** ETL and data transformation
**Components:**
- **UniversalProcessor** - Generic data processing
- **PDFExtractor** - Research document analysis
- **SegmentDiscovery** - Automatic segment identification
- **SurveyResponseLoader** - Survey data ingestion

### 4. Utility Layer
**Location:** `/src/utils/`
**Purpose:** Shared functionality
**Components:**
- **data-pipeline.js** - Pipeline orchestration framework
- **data-normalizer.js** - Data transformation utilities
- **file-operations.js** - File I/O operations
- **segment-analyzer.js** - LOHAS segment analysis
- **logger.js** - Structured logging
- **error-handler.js** - Error management

### 5. Vector Database
**Location:** `/src/vector_db/`
**Purpose:** Semantic search and storage
**Implementation:**
- PostgreSQL with pgvector extension
- Support for OpenAI and local embeddings
- Fallback to in-memory store

## Data Flow

### Response Generation Flow
```
1. Client Request → API Endpoint
2. Request Validation (Middleware)
3. Service Layer Processing
   a. Load persona data
   b. Generate embeddings
   c. Search similar responses
   d. Synthesize new response
4. Response Formatting
5. Client Response
```

### Data Processing Flow
```
1. Raw Data Input (Excel/CSV/PDF)
2. Data Pipeline Initialization
3. Pipeline Stages:
   a. Data extraction
   b. Normalization
   c. Segment classification
   d. Feature extraction
   e. Persistence
4. Processed Data Output
```

## Technology Stack

### Core Technologies
- **Runtime:** Node.js v22+
- **Framework:** Express.js
- **Database:** PostgreSQL 15+ with pgvector
- **Cache:** Redis (optional) / In-memory
- **Language:** JavaScript (ES6+)

### AI/ML Services
- **OpenAI:** GPT-4, text-embedding-3-large
- **Anthropic:** Claude Opus 4.1
- **Local Models:** Sentence-transformers (fallback)

### Supporting Libraries
- **ml-kmeans:** Clustering for segment discovery
- **papaparse:** CSV processing
- **xlsx:** Excel file handling
- **pdf-parse:** PDF extraction
- **node-fetch:** HTTP client

## Design Patterns

### 1. Service Layer Pattern
Separates business logic from HTTP concerns:
```javascript
class DatasetService extends BaseService {
  async getConfiguration(datasetId) {
    // Business logic here
  }
}
```

### 2. Pipeline Pattern
Orchestrates complex data processing:
```javascript
const pipeline = new DataPipeline('process')
  .stage('extract', extractData)
  .stage('transform', transformData)
  .stage('load', loadData);
```

### 3. Factory Pattern
Creates appropriate implementations:
```javascript
async function createUnifiedVectorStore(datasetId, options) {
  // Returns appropriate store implementation
}
```

### 4. Singleton Pattern
Ensures single instances:
```javascript
let loader = null;
export async function getSurveyResponseLoader() {
  if (!loader) {
    loader = new SurveyResponseLoader();
  }
  return loader;
}
```

## Security Considerations

### Data Protection
- No PII storage in vectors
- Anonymized survey responses
- Secure API key management

### API Security
- Rate limiting (production)
- Input validation and sanitization
- Error message sanitization

### External Service Security
- API key rotation
- Timeout configurations
- Retry with backoff

## Performance Optimizations

### Caching Strategy
1. **Response Cache:** Recently generated responses
2. **Embedding Cache:** Computed embeddings
3. **Service Cache:** Expensive computations

### Database Optimization
- Connection pooling
- Indexed vector searches
- Query optimization

### Processing Optimization
- Batch processing for bulk operations
- Parallel processing where applicable
- Progressive loading for large datasets

## Scalability Considerations

### Horizontal Scaling
- Stateless API design
- External session storage
- Database replication

### Vertical Scaling
- Optimized algorithms
- Efficient memory usage
- Resource pooling

## Monitoring and Observability

### Logging
- Structured JSON logging
- Log levels (debug, info, warn, error)
- Request tracking

### Metrics
- Response times
- Error rates
- Cache hit rates
- External service latency

### Health Checks
- Database connectivity
- External service availability
- Memory usage

## Deployment Architecture

### Development
```
Local Machine
├── Node.js Server (port 3000)
├── PostgreSQL (local/Docker)
└── File System Storage
```

### Production
```
Load Balancer
├── App Server 1
├── App Server 2
└── App Server N
    │
    ├── PostgreSQL (RDS/Cloud SQL)
    ├── Redis Cache (ElastiCache/Cloud Memorystore)
    └── Object Storage (S3/Cloud Storage)
```

## Future Enhancements

### Planned Features
1. WebSocket support for real-time responses
2. GraphQL API layer
3. Multi-language support
4. Advanced analytics dashboard
5. A/B testing framework

### Architectural Improvements
1. Microservices migration
2. Event-driven architecture
3. Container orchestration (Kubernetes)
4. Service mesh implementation
5. Serverless functions for specific tasks