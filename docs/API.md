# Digital Twin Consumer Response System - API Documentation

## Overview
The Digital Twin API provides endpoints for generating authentic consumer responses to marketing content based on real survey data and LOHAS segmentation.

## Base URL
```
Development: http://localhost:3000
Production: https://your-domain.com
```

## Authentication
Currently, the API does not require authentication for development. Production deployment should implement API key authentication.

## Response Format
All API responses follow a consistent JSON structure:

```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "timestamp": "2025-09-05T12:00:00Z"
}
```

Error responses:
```json
{
  "success": false,
  "data": null,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "details": { ... }
  },
  "timestamp": "2025-09-05T12:00:00Z"
}
```

## Endpoints

### 1. Generate Response (Advanced Semantic)
Generate consumer responses using OpenAI's semantic embeddings.

**Endpoint:** `POST /api/generate-response`

**Request Body:**
```json
{
  "adContent": "Your marketing message here",
  "personaId": "leader-001",
  "segment": "Leader|Leaning|Learner|Laggard",
  "datasetId": "surf-clothing",
  "count": 3,
  "temperature": 0.7
}
```

**Parameters:**
- `adContent` (required): The marketing content to respond to
- `personaId` (optional): Specific persona ID
- `segment` (optional): LOHAS segment name
- `datasetId` (optional): Dataset to use (default: "surf-clothing")
- `count` (optional): Number of responses to generate (default: 3)
- `temperature` (optional): Response variability 0-1 (default: 0.7)

**Response:**
```json
{
  "success": true,
  "data": {
    "responses": [
      "As someone who values sustainability, I appreciate...",
      "This aligns with my environmental values...",
      "I would consider this product because..."
    ],
    "segment": "Leader",
    "confidence": 0.92,
    "personaId": "leader-001",
    "metadata": {
      "engine": "semantic",
      "embeddingModel": "text-embedding-3-large",
      "responseTime": 1.2
    }
  }
}
```

### 2. Generate Claude Response
Generate responses using Claude Opus 4.1 with persona vectors.

**Endpoint:** `POST /api/generate-claude-response`

**Request Body:**
```json
{
  "adContent": "Your marketing message here",
  "segment": "Leader",
  "datasetId": "surf-clothing",
  "responseVariations": 3
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "responses": [
      {
        "text": "Detailed response from Claude...",
        "consistency": 0.95
      }
    ],
    "segment": "Leader",
    "personaVector": [...],
    "metadata": {
      "engine": "claude",
      "model": "claude-opus-4-1-20250805",
      "responseTime": 3.5
    }
  }
}
```

### 3. Get Digital Twin Personas
Retrieve available personas for a dataset.

**Endpoint:** `GET /api/digital-twins/personas`

**Query Parameters:**
- `datasetId` (optional): Filter by dataset
- `segment` (optional): Filter by LOHAS segment

**Response:**
```json
{
  "success": true,
  "data": {
    "personas": [
      {
        "id": "leader-001",
        "segment": "Leader",
        "characteristics": {
          "sustainability": 0.95,
          "priceConsciousness": 0.2,
          "quality": 0.85
        },
        "demographics": {
          "age": "25-55",
          "income": "Above average"
        }
      }
    ],
    "total": 50
  }
}
```

### 4. Analyze Image
Analyze marketing images using Claude Vision.

**Endpoint:** `POST /api/analyze-image`

**Request Body:**
```json
{
  "imageUrl": "https://example.com/image.jpg",
  "analysisType": "marketing|product|brand",
  "segment": "Leader"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "analysis": {
      "description": "Image analysis results...",
      "targetAppeal": {
        "Leader": 0.85,
        "Leaning": 0.70,
        "Learner": 0.45,
        "Laggard": 0.30
      },
      "recommendations": [
        "Consider adding sustainability badges...",
        "Highlight eco-friendly materials..."
      ]
    }
  }
}
```

### 5. Dataset Configuration
Manage dataset configurations.

**Endpoint:** `GET /api/dataset-config`

**Query Parameters:**
- `datasetId` (required): Dataset identifier

**Response:**
```json
{
  "success": true,
  "data": {
    "datasetId": "surf-clothing",
    "name": "Sustainable Surf Clothing",
    "description": "Survey data from 1,006 respondents",
    "segments": {
      "Leader": { "count": 124, "percentage": 12.4 },
      "Leaning": { "count": 227, "percentage": 22.6 },
      "Learner": { "count": 377, "percentage": 37.5 },
      "Laggard": { "count": 278, "percentage": 27.5 }
    },
    "responseColumns": {
      "identifierColumn": 0,
      "questionRowIndex": 0,
      "subQuestionRowIndex": 1,
      "startColumn": 5
    }
  }
}
```

### 6. Market Analysis
Perform market analysis for content.

**Endpoint:** `POST /api/digital-twins/market-analysis`

**Request Body:**
```json
{
  "content": "Marketing content to analyze",
  "targetSegments": ["Leader", "Leaning"],
  "metrics": ["appeal", "purchase_intent", "value_alignment"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "analysis": {
      "Leader": {
        "appeal": 0.88,
        "purchase_intent": 0.76,
        "value_alignment": 0.92
      },
      "Leaning": {
        "appeal": 0.72,
        "purchase_intent": 0.65,
        "value_alignment": 0.70
      }
    },
    "recommendations": {
      "Leader": "Emphasize environmental certifications",
      "Leaning": "Balance sustainability with value proposition"
    },
    "overallScore": 0.75
  }
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Invalid request parameters |
| `NOT_FOUND` | Resource not found |
| `SERVICE_ERROR` | External service failure |
| `RATE_LIMIT` | Rate limit exceeded |
| `INTERNAL_ERROR` | Server error |

## Rate Limiting
- Development: No rate limiting
- Production: 100 requests per minute per IP

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request - Invalid parameters |
| 404 | Not Found - Resource doesn't exist |
| 429 | Too Many Requests - Rate limited |
| 500 | Internal Server Error |
| 503 | Service Unavailable - External service down |

## Examples

### cURL Example
```bash
curl -X POST http://localhost:3000/api/generate-response \
  -H "Content-Type: application/json" \
  -d '{
    "adContent": "Discover our eco-friendly surf gear",
    "segment": "Leader",
    "count": 3
  }'
```

### JavaScript Example
```javascript
const response = await fetch('http://localhost:3000/api/generate-response', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    adContent: 'Discover our eco-friendly surf gear',
    segment: 'Leader',
    count: 3
  })
});

const data = await response.json();
console.log(data.data.responses);
```

### Python Example
```python
import requests

response = requests.post(
    'http://localhost:3000/api/generate-response',
    json={
        'adContent': 'Discover our eco-friendly surf gear',
        'segment': 'Leader',
        'count': 3
    }
)

data = response.json()
print(data['data']['responses'])
```

## Webhooks (Future)
Webhook support for async processing is planned for future releases.

## Versioning
The API uses URL versioning. Current version: v1 (implicit)
Future versions will use: `/api/v2/...`

## Support
For API support, please contact: support@your-domain.com