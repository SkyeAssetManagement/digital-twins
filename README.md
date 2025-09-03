# Digital Twin Consumer Response System

An advanced AI-powered system for generating authentic consumer responses to marketing content, based on real survey data from 1,006 respondents segmented into LOHAS (Lifestyles of Health and Sustainability) categories.

## Features

### 🎯 Dual Engine Response Generation
- **Advanced Semantic Engine**: OpenAI text-embedding-3-large (3072D) with latent space interpolation
- **Claude Opus 4.1 Pipeline**: Survey-grounded personas with XML-structured prompts
- **Multiple Response Variations**: Generate 3+ unique responses per segment while maintaining value alignment

### 📊 LOHAS Market Segmentation
Based on real survey data from 1,006 respondents:
- **Leaders** (12.4%): Highly committed to sustainability, willing to pay premium
- **Leaning** (22.6%): Value-conscious but increasingly sustainability-aware  
- **Learners** (37.5%): Price-sensitive, need education on value propositions
- **Laggards** (27.5%): Skeptical of premium pricing and sustainability claims

### 🔬 Technical Capabilities
- **Persona Vectors**: 3072-dimensional embeddings from survey narratives
- **Latent Space Interpolation**: Natural response variation through multi-manifold traversal
- **Real Survey Integration**: Responses grounded in actual consumer data
- **Value Alignment**: Consistent persona behaviors across multiple responses

## Live Demo

Access the dual-engine comparison app at: `/dual-engine-app.html`

Features:
- Side-by-side comparison (Semantic left, Claude right)
- Text input or image upload
- Segment filtering
- Response count selection (3, 5, or 10)
- Real-time generation with sentiment and purchase intent scores

## API Endpoints

### Generate Dual Engine Responses
```
POST /api/dual-engine-response
{
  "content": "marketing text or image",
  "contentType": "text" | "image",
  "segments": ["Leader", "Leaning", "Learner", "Laggard"],
  "responseCount": 10
}
```

### Digital Twin Endpoints
- `GET /api/digital-twins/personas` - List available personas
- `GET /api/digital-twins/persona/:id` - Get specific persona details
- `POST /api/digital-twins/generate-response` - Generate single response
- `POST /api/digital-twins/compare-responses` - Compare responses across segments

## Installation

1. Clone the repository
```bash
git clone https://github.com/SkyeAssetManagement/digital-twins.git
cd digital-twins
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```env
DATABASE_URL=your_postgres_url
ANTHROPIC_API_KEY=your_anthropic_key
OPENAI_API_KEY=your_openai_key
NODE_ENV=development
PORT=3000
```

4. Run the development server
```bash
npm run dev
```

## Response Quality Comparison

### Advanced Semantic Engine
- **Speed**: ~1.6 seconds per response
- **Cost**: $0.002 per response
- **Strengths**: Fast, cost-effective, good value alignment
- **Use Case**: High-volume testing, rapid prototyping

### Claude Opus 4.1 Pipeline
- **Speed**: ~6 seconds per response
- **Cost**: $0.03 per response
- **Strengths**: Rich personalities, natural language, deep context
- **Use Case**: High-stakes decisions, detailed analysis

## Documentation

### Response Examples
- `COMPLETE-RESPONSE-DOCUMENTATION-MULTI-ENGINE.md` - 24 responses per ad showing variation
- `FINAL-COMPARISON-ALL-APPROACHES.md` - Detailed methodology comparison

### Technical Architecture
- **Semantic Engine**: `src/semantic/advanced_semantic_engine.js`
- **Claude Pipeline**: `src/claude/integrated_persona_engine_v2.js`
- **Survey Integration**: `src/data_processing/survey_response_loader.js`
- **API Handlers**: `api/dual-engine-simple.js`

## Performance Metrics

Based on testing with Rip Curl and Patagonia ads:

| Segment | Rip Curl Intent | Patagonia Intent | Swing |
|---------|----------------|------------------|-------|
| Leader  | 2.3/10         | 9.8/10          | +7.5  |
| Leaning | 4.7/10         | 7.7/10          | +3.0  |
| Learner | 4.3/10         | 4.7/10          | +0.4  |
| Laggard | 2.0/10         | 1.0/10          | -1.0  |

## Deployment

### Vercel Deployment
1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy with automatic builds on push

### Environment Variables for Vercel
```
DATABASE_URL=postgresql://...
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-proj-...
NODE_ENV=production
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests: `npm test`
4. Submit a pull request

## License

Proprietary - Skye Asset Management

## Support

For issues or questions, please contact the development team or open an issue on GitHub.

---

Built with Claude Code assistance - Combining real consumer insights with advanced AI for authentic market research.