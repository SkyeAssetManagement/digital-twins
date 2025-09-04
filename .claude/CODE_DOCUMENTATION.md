# Digital Twins Codebase Documentation

## Project Overview
Digital Twin Response System - A dual-engine AI system that generates persona-based marketing responses using both semantic analysis and Claude AI persona modeling.

## Architecture Diagram
```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (UI)                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           public/dual-engine-app.html                │   │
│  │  - Dual-column response comparison                   │   │
│  │  - Image/PDF upload with Claude Opus 4.1 analysis   │   │
│  │  - Thumbnail + textarea UI for uploaded content      │   │
│  │  - LOHAS segment filtering                          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────┬────────────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────────────┐
│                     API Layer (Express)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │            server.js (Main Express Server)           │   │
│  │  - Serves static files                              │   │
│  │  - Routes API requests                              │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         api/dual-engine-response.js                 │   │
│  │  - Image analysis with Claude Opus 4.1              │   │
│  │  - Dual engine response generation                  │   │
│  │  - Multiple responses per segment                   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────┬────────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
┌───────▼──────────┐      ┌─────────▼───────────┐
│ Semantic Engine  │      │   Claude Engine     │
│                  │      │                     │
│ src/semantic/    │      │ src/claude/         │
│ advanced_        │      │ integrated_persona_ │
│ semantic_engine. │      │ engine_v2.js        │
│ js               │      │                     │
│                  │      │                     │
│ - OpenAI         │      │ - Claude Opus 4.1   │
│   embeddings     │      │ - Persona modeling  │
│ - Survey data    │      │ - Context-aware     │
│   integration    │      │   responses         │
└──────────────────┘      └─────────────────────┘
```

## Directory Structure
```
digital-twins/
├── .claude/                    # Claude-specific configuration
│   ├── CLAUDE.md              # Development standards
│   ├── CODE_DOCUMENTATION.md  # This file
│   └── projectStatus.md       # Project status tracking
├── api/                       # API endpoints
│   ├── dual-engine-response.js    # Main dual-engine API (uses Claude Opus 4.1)
│   ├── dual-engine-response.old.js # Archived version (used GPT-4 Vision)
│   ├── analyze-image.js          # Standalone image analysis endpoint
│   ├── generate-response.js      # Legacy response generation
│   └── digital-twin-service.js   # Digital twin management
├── src/
│   ├── semantic/              # Semantic analysis engine
│   │   └── advanced_semantic_engine.js
│   └── claude/                # Claude persona engine
│       └── integrated_persona_engine_v2.js
├── public/                    # Frontend files
│   ├── dual-engine-app.html  # Main application UI
│   └── index.html            # Legacy UI
├── data/                      # Data files
│   └── LOHAS_Survey_Data.csv # Consumer survey data
├── server.js                  # Express server
├── package.json              # Dependencies
└── .env.local                # Environment variables (not in repo)
```

## Key Features

### 1. Image/PDF Analysis
- **Technology**: Claude Opus 4.1 (claude-opus-4-1-20250805)
- **Process**: 
  - Upload image/PDF via drag-drop or click
  - Claude extracts marketing content
  - Content displayed in editable textarea
  - Multiple file support

### 2. Dual Response Engines

#### Semantic Engine (src/semantic/advanced_semantic_engine.js)
- Uses OpenAI text-embedding-3-large (3072 dimensions)
- Integrates LOHAS survey data
- Generates context-aware responses
- Fast response time (~1.6s)

#### Claude Persona Engine (src/claude/integrated_persona_engine_v2.js)
- Uses Claude Opus 4.1 for persona modeling
- Deep psychological profiling
- Nuanced, personality-driven responses
- Slower but more sophisticated (~6s)

### 3. LOHAS Segmentation
Four consumer segments:
- **Leader**: Environmental pioneers, sustainability advocates
- **Leaning**: Quality-conscious, becoming sustainability-aware
- **Learner**: Curious but needs education on premium value
- **Laggard**: Price-focused, skeptical of premium claims

### 4. UI Features
- **Thumbnail + Textarea Layout**: Uploaded content shows as thumbnail with editable text
- **Multiple Upload Support**: Handle multiple images/PDFs simultaneously
- **Real-time Analysis Status**: Shows analyzing/complete/error states
- **Response Comparison**: Side-by-side semantic vs Claude responses
- **Segment Filtering**: View responses by specific LOHAS segment

## API Endpoints

### POST /api/dual-engine-response
Main endpoint for generating responses.

**Request:**
```json
{
  "content": "marketing text or base64 image",
  "contentType": "text" | "image",
  "segments": ["Leader", "Leaning", "Learner", "Laggard"],
  "responseCount": 10,
  "analyzeOnly": false,  // Optional: only analyze image, don't generate responses
  "originalImage": "base64..."  // Optional: include original image for context
}
```

**Response:**
```json
{
  "semantic": [
    {
      "segment": "Leader",
      "text": "response text",
      "sentiment": "positive/neutral/negative",
      "purchaseIntent": 1-10,
      "responseTime": 1600,
      "index": 1
    }
  ],
  "claude": [...],
  "stats": {
    "totalResponses": 80,
    "avgSemanticTime": 1600,
    "avgClaudeTime": 6000
  },
  "contentAnalyzed": "extracted marketing content",
  "wasImageAnalyzed": true
}
```

## Environment Variables (.env.local)
```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-api...
PORT=3000
```

## Key Technical Decisions

### 1. Claude Opus 4.1 for Vision
- Replaced deprecated GPT-4 Vision
- Better marketing content extraction
- More nuanced understanding of visual elements

### 2. No Fallback Policy
- If API fails, return "NA" instead of placeholder
- Ensures data integrity
- Clear error states for debugging

### 3. Multiple Response Generation
- Varies temperature and parameters
- Creates diverse but segment-appropriate responses
- Cost optimization for Claude (max 3 unique, then reuse)

### 4. UI Simplification
- Removed non-functional modal system
- Direct textarea editing for extracted content
- Thumbnail preview for visual reference

## Recent Updates (Sept 2025)

1. **Claude Opus 4.1 Integration**: Upgraded from deprecated models
2. **New UI**: Thumbnail + textarea layout replacing modal system
3. **Multiple File Support**: Handle batch uploads
4. **PDF Support**: Added PDF analysis capability
5. **Drag & Drop**: Enhanced file upload experience
6. **No Fallback Policy**: Return NA on errors instead of placeholders
7. **Max Token Optimization**: Reduced from 10,000 to 1,000 to avoid timeouts

## Performance Considerations

- **Semantic Engine**: ~1.6s per response, lower cost
- **Claude Engine**: ~6s per response, higher quality
- **Image Analysis**: ~2-3s with Claude Opus 4.1
- **Batch Processing**: Support for multiple file uploads

## Deployment

### Vercel Deployment
- Auto-detects API routes in /api folder
- Environment variables set in Vercel dashboard
- Automatic deployments from GitHub main branch

### Local Development
```bash
npm install
npm run dev
# Server runs on http://localhost:3000
```

## Testing
Access the application at:
- Local: http://localhost:3000/dual-engine-app.html
- Production: [Vercel deployment URL]/dual-engine-app.html

## Cost Management
- Semantic responses: ~$0.002 per response
- Claude responses: ~$0.03 per response (limited to 3 unique)
- Image analysis: ~$0.02 per image with Claude Opus 4.1

## Future Enhancements
- Batch response export functionality
- Response quality scoring
- A/B testing interface
- Historical response tracking
- Custom persona creation