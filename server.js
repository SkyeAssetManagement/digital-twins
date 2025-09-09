import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Import API routes
import generateResponseRoute from './api/generate-response.js';
import generateClaudeResponseRoute from './api/generate-claude-response.js';
import listDatasetsRoute from './api/list-datasets.js';
import uploadDatasetRoute from './api/upload-dataset.js';
import getDatasetConfigRoute from './api/dataset-config.js';
import getTwinRoute from './api/get-twin.js';
import datasetStatusRoute from './api/dataset-status.js';

// Import Digital Twin Service
import DigitalTwinService from './api/digital-twin-service.js';
const digitalTwinService = new DigitalTwinService();

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.post('/api/generate-response', generateResponseRoute);
app.post('/api/generate-claude-response', generateClaudeResponseRoute);
app.get('/api/list-datasets', listDatasetsRoute);
app.post('/api/upload-dataset', uploadDatasetRoute);
app.get('/api/dataset-config/:datasetId', getDatasetConfigRoute);
app.get('/api/get-twin/:datasetId/:segment/:variant', getTwinRoute);
app.get('/api/dataset-status/:datasetId', datasetStatusRoute);

// Dual Engine Response API - Simplified version
import dualEngineHandler from './api/dual-engine-response.js';
app.post('/api/dual-engine-response', async (req, res) => {
  await dualEngineHandler(req, res);
});

// Claude Comparison API - Sonnet 4.0 vs Opus 4.1
import claudeComparisonHandler from './api/claude-comparison-response.js';
app.post('/api/claude-comparison-response', async (req, res) => {
  await claudeComparisonHandler(req, res);
});

// Universal Survey Digital Twin API
import universalDigitalTwinHandler from './api/universal-digital-twin-response.js';
app.post('/api/universal-digital-twin-response', async (req, res) => {
  await universalDigitalTwinHandler(req, res);
});

// Survey Datasets API
import surveyDatasetsHandler from './api/survey-datasets.js';
app.get('/api/survey-datasets', async (req, res) => {
  await surveyDatasetsHandler(req, res);
});
app.post('/api/survey-datasets', async (req, res) => {
  await surveyDatasetsHandler(req, res);
});

// 3-Stage Pipeline Analysis API
import threeStageAnalysisHandler, { 
  getAnalysisStatus, 
  getAnalysisResults, 
  exportAnalysisResults 
} from './api/three-stage-analysis.js';
app.post('/api/three-stage-analysis', async (req, res) => {
  await threeStageAnalysisHandler(req, res);
});
app.get('/api/three-stage-analysis/status/:datasetId', async (req, res) => {
  await getAnalysisStatus(req, res);
});
app.get('/api/three-stage-analysis/results/:datasetId', async (req, res) => {
  await getAnalysisResults(req, res);
});
app.get('/api/three-stage-analysis/export/:datasetId', async (req, res) => {
  await exportAnalysisResults(req, res);
});

// Process Survey Upload API
import processSurveyUploadHandler from './api/process-survey-upload.js';
app.post('/api/process-survey-upload', async (req, res) => {
  await processSurveyUploadHandler(req, res);
});

// Simple Upload API (fallback)
import simpleUploadHandler from './api/simple-upload.js';
app.post('/api/simple-upload', async (req, res) => {
  await simpleUploadHandler(req, res);
});

// Digital Twin Routes
app.get('/api/digital-twins/personas', async (req, res) => {
  try {
    const personas = await digitalTwinService.getAvailablePersonas();
    res.json({ success: true, personas });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/digital-twins/persona/:id', async (req, res) => {
  try {
    const persona = await digitalTwinService.getPersona(req.params.id);
    res.json({ success: true, persona });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

app.post('/api/digital-twins/generate-response', async (req, res) => {
  try {
    const { personaId, prompt, context } = req.body;
    const response = await digitalTwinService.generateResponse(personaId, prompt, context);
    res.json({ success: true, response });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/digital-twins/market-analysis', async (req, res) => {
  try {
    const { productFeatures } = req.body;
    const analysis = await digitalTwinService.analyzeMarketOpportunity(productFeatures);
    res.json({ success: true, analysis });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/digital-twins/compare-responses', async (req, res) => {
  try {
    const { prompt, context } = req.body;
    const comparisons = await digitalTwinService.comparePersonaResponses(prompt, context);
    res.json({ success: true, comparisons });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: process.env.DATABASE_URL ? 'configured' : 'not configured'
  });
});

// Catch-all route - serve index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Digital Twin Consumer Response Tester`);
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
  
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_api_key_here') {
    console.warn('Warning: Anthropic API key not configured - will use fallback responses');
  }
});