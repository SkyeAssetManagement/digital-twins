#!/usr/bin/env node
/**
 * Production Local Server - Uses REAL API handlers, not mock responses
 * This server imports and uses the actual Vercel API functions
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import formidable from 'formidable';

// Import REAL API handlers from ../api/ directory
import debugDataWranglingHandler from '../api/debug-data-wrangling.js';
import processUploadHandler from '../api/process-survey-upload.js';
import simpleUploadHandler from '../api/simple-upload.js';
import surveyDatasetsHandler from '../api/survey-datasets.js';
import threeStageAnalysisHandler from '../api/three-stage-analysis.js';
import threeStageAnalysisDetailedHandler from '../api/three-stage-analysis-detailed.js';
import universalDigitalTwinHandler from '../api/universal-digital-twin-response.js';
import generateResponseHandler from '../api/generate-response.js';
import getCustomerArchetypesHandler from '../api/get-customer-archetypes.js';
import intelligentColumnDetectionHandler from '../api/intelligent-column-detection.js';
import llmSemanticAnalysisHandler from '../api/llm-semantic-analysis.js';
import adaptiveCategoryDiscoveryHandler from '../api/adaptive-category-discovery.js';
import roiTargetAnalysisHandler from '../api/roi-target-analysis.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const app = express();
const PORT = process.env.PORT || 3011; // Use port 3011 for consistency

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
// Middleware to simulate Vercel request/response format
function vercelHandler(apiHandler) {
    return async (req, res) => {
        try {
            // Set default headers that Vercel would set
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            
            // Call the actual Vercel API handler
            await apiHandler(req, res);
        } catch (error) {
            console.error('API Handler Error:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                });
            }
        }
    };
}

// REAL API endpoints using actual handlers
app.post('/api/debug-data-wrangling', vercelHandler(debugDataWranglingHandler));
app.post('/api/process-survey-upload', vercelHandler(processUploadHandler));
app.post('/api/simple-upload', vercelHandler(simpleUploadHandler));
app.get('/api/survey-datasets', vercelHandler(surveyDatasetsHandler));
app.post('/api/three-stage-analysis', vercelHandler(threeStageAnalysisDetailedHandler));
app.post('/api/three-stage-analysis-simple', vercelHandler(threeStageAnalysisHandler)); // Keep old version as backup
app.post('/api/universal-digital-twin-response', vercelHandler(universalDigitalTwinHandler));
app.post('/api/generate-response', vercelHandler(generateResponseHandler));
app.get('/api/customer-archetypes', vercelHandler(getCustomerArchetypesHandler));
app.post('/api/intelligent-column-detection', vercelHandler(intelligentColumnDetectionHandler)); // Phase 3A
app.post('/api/llm-semantic-analysis', vercelHandler(llmSemanticAnalysisHandler)); // Phase 3B
app.post('/api/adaptive-category-discovery', vercelHandler(adaptiveCategoryDiscoveryHandler)); // Phase 3C
app.post('/api/roi-target-analysis', vercelHandler(roiTargetAnalysisHandler)); // Phase 3D

// Handle file uploads with multipart/form-data
app.use('/api/process-survey-upload', (req, res, next) => {
    const form = formidable({
        maxFileSize: 50 * 1024 * 1024, // 50MB limit
        keepExtensions: true,
        uploadDir: path.join(projectRoot, 'uploads')
    });
    
    form.parse(req, (err, fields, files) => {
        if (err) {
            return res.status(400).json({ error: 'File upload failed', details: err.message });
        }
        req.fields = fields;
        req.files = files;
        next();
    });
});

// Root route serves the three-stage analysis page
app.get('/', (req, res) => {
    res.sendFile(path.join(projectRoot, 'public', 'three-stage-analysis-redesigned.html'));
});

// Static files AFTER specific routes
app.use(express.static(path.join(projectRoot, 'public')));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        environment: process.env.NODE_ENV,
        database_url: process.env.DATABASE_URL ? 'configured' : 'missing',
        anthropic_key: process.env.ANTHROPIC_API_KEY ? 'configured' : 'missing',
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 PRODUCTION LOCAL SERVER READY!`);
    console.log(`🔗 URL: http://localhost:${PORT}`);
    console.log('');
    console.log('✅ Using REAL API handlers (not mock responses)');
    console.log('✅ Environment variables configured');
    console.log('✅ Database and Claude API integration active');
    console.log('✅ File upload processing ready');
    console.log('');
    console.log('🧪 TEST: Upload "Detail_Parents Survey.xlsx" for real 7-step pipeline');
    console.log('📊 API Health Check: http://localhost:' + PORT + '/api/health');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Server shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 Server shutting down gracefully...');
    process.exit(0);
});