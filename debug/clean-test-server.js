#!/usr/bin/env node
/**
 * Clean Test Server - No automatic function calls
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const app = express();
const PORT = 3007;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(projectRoot, 'public')));
app.use('/debug', express.static(path.join(projectRoot, 'debug')));

// API Routes - all working
app.get('/api/survey-datasets', (req, res) => {
    console.log('GET /api/survey-datasets called');
    res.json({
        success: true,
        datasets: [], // Empty for testing
        message: 'No datasets available for testing'
    });
});

app.post('/api/three-stage-analysis', (req, res) => {
    console.log('POST /api/three-stage-analysis called');
    res.json({
        success: true,
        message: 'Analysis completed (test mode)',
        analysis_results: { test: true }
    });
});

app.post('/api/debug-data-wrangling', (req, res) => {
    console.log('POST /api/debug-data-wrangling called for step:', req.body.step);
    res.json({
        success: true,
        step: req.body.step,
        message: `Step ${req.body.step} completed (test mode)`
    });
});

// Serve test pages
app.get('/', (req, res) => {
    res.sendFile(path.join(projectRoot, 'debug', 'minimal-test.html'));
});

app.get('/original', (req, res) => {
    res.sendFile(path.join(projectRoot, 'public', 'three-stage-analysis-redesigned.html'));
});

app.get('/fixed', (req, res) => {
    res.sendFile(path.join(projectRoot, 'debug', 'fixed-three-stage-analysis.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Clean test server running at:`);
    console.log(`   http://localhost:${PORT} - Minimal test (no auto-calls)`);
    console.log(`   http://localhost:${PORT}/original - Original problematic version`);  
    console.log(`   http://localhost:${PORT}/fixed - Fixed version with debugging`);
    console.log('');
    console.log('🧪 All API endpoints working, no 404 errors');
    console.log('');
    console.log('Press Ctrl+C to stop');
});