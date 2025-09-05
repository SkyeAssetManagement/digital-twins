# Persona Parameter Testing Interface

## Overview
The Persona Parameter Testing Interface allows you to test how different Claude model parameters affect persona-based responses for LOHAS consumer segments.

## Access
- **URL**: http://localhost:3001/persona-parameter-tester.html
- **Server Port**: 3001 (configurable via PORT environment variable)

## Features

### 1. Layout Options
- **Single Column**: Test one configuration at a time
- **Two Columns**: Compare two different configurations side-by-side
- **Three Columns**: Compare three configurations simultaneously

### 2. Per-Column Controls

#### Model Selection
- **Claude Sonnet 4.0**: Fast, efficient responses (model ID: claude-sonnet-4-20250514)
- **Claude Opus 4.1**: More sophisticated responses (model ID: claude-opus-4-1-20250805)

#### Segment Selection
- **Leader** (12.4%): Environmental champions, early adopters
- **Leaning** (22.6%): Sustainability-interested, practical
- **Learner** (37.5%): Open but cautious, price-conscious
- **Laggard** (27.5%): Traditional, price-focused

#### Prefill Toggle
- **On**: Uses Claude's prefill technique for more controlled responses
- **Off**: Standard prompt without prefill

#### Temperature Settings
- **Fixed Temperature**: Uses the lower bound value
- **Randomized Temperature**: Randomly selects between min and max for each response
- **Range**: 0.0 (deterministic) to 1.0 (creative)

#### Advanced Parameters
- **Top P**: Controls nucleus sampling (0.0 to 1.0)
- **Max Tokens**: Response length limit (50-500)
- **System Prompt Style**: 
  - Detailed: Comprehensive persona description
  - Minimal: Basic persona traits
  - Values-focused: Emphasizes values and beliefs
  - Demographic-focused: Emphasizes demographics

### 3. Response Generation
- Enter marketing content in the main text area
- Click "Generate Responses" to test all columns
- Each column generates multiple responses (default: 3)
- Results show:
  - Generated responses
  - Sentiment analysis
  - Purchase intent score
  - Market size percentage

## API Endpoint

### URL
`POST /api/generate-claude-response`

### Request Body
```json
{
  "adContent": "Marketing message to test",
  "segment": "Leader|Leaning|Learner|Laggard",
  "model": "claude-sonnet-4-20250514|claude-opus-4-1-20250805",
  "temperature": 0.0-1.0,
  "topP": 0.0-1.0,
  "maxTokens": 50-500,
  "usePrefill": true|false,
  "systemPromptStyle": "detailed|minimal|values-focused|demographic-focused",
  "responseCount": 1-10,
  "datasetId": "surf-clothing"
}
```

### Response Format
```json
{
  "success": true,
  "datasetId": "surf-clothing",
  "segments": [{
    "segment": "Leader",
    "responses": ["response1", "response2", "response3"],
    "response": "primary response",
    "sentiment": "positive|neutral|negative",
    "purchaseIntent": 0.0-1.0,
    "marketSize": "12.4%",
    "parameters": {
      "model": "claude-sonnet-4-20250514",
      "temperature": 0.7,
      "topP": 0.9,
      "maxTokens": 150,
      "usePrefill": true,
      "systemPromptStyle": "detailed",
      "responseCount": 3
    }
  }],
  "metadata": {
    "responseCount": 3,
    "timestamp": "2025-09-05T22:48:17.072Z",
    "usingPersonaVectors": true,
    "performance": {
      "totalRequests": 0,
      "successfulRequests": 0,
      "failedRequests": 0,
      "averageResponseTime": 0,
      "driftEvents": 0,
      "successRate": "0%",
      "driftRate": "0%"
    }
  }
}
```

## Use Cases

### 1. A/B Testing Prompts
- Set up two columns with identical parameters
- Test different marketing messages
- Compare response quality and purchase intent

### 2. Model Comparison
- Set up columns with same segment and content
- Use different models (Sonnet vs Opus)
- Evaluate response sophistication vs speed

### 3. Temperature Exploration
- Test same content with different temperature settings
- Observe creativity vs consistency trade-offs
- Find optimal temperature for your use case

### 4. Segment Analysis
- Test same content across all four segments
- Understand how different personas react
- Optimize messaging for target audiences

### 5. Prefill Effectiveness
- Compare responses with and without prefill
- Evaluate control vs natural flow
- Determine when prefill adds value

## Tips for Effective Testing

1. **Start with baseline**: Use default settings first
2. **Change one variable**: Isolate parameter effects
3. **Test multiple times**: Account for randomness
4. **Document findings**: Record optimal settings
5. **Consider context**: Different content may need different parameters

## Troubleshooting

### Server not responding
- Check server is running: `npm run dev`
- Verify port: Default is 3001, check `PORT` env variable
- Check console for errors

### No responses generated
- Verify API keys in `.env` file
- Check Claude API quotas
- Review server logs for API errors

### Inconsistent results
- Temperature affects randomness
- Use lower temperature for consistency
- Set responseCount > 1 to see variation

## Integration Notes

### Embedding in Applications
The testing interface can be embedded or adapted:
- Extract JavaScript functions for custom UIs
- Use API endpoint directly from applications
- Customize parameter ranges for specific needs

### Performance Considerations
- Opus model is slower but more sophisticated
- Multiple responses increase latency
- Cache results for repeated tests
- Monitor API usage and costs