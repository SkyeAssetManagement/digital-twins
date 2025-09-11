#!/usr/bin/env node
/**
 * Local Test Server - Simple working version to demonstrate the fix
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const app = express();
const PORT = 3006;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(projectRoot, 'public')));

// API Routes
app.post('/api/three-stage-analysis', (req, res) => {
    console.log('Three-stage analysis called:', req.body);
    
    // Return basic success response
    res.json({
        success: true,
        message: 'Analysis completed successfully',
        dataset_id: Date.now(),
        analysis_results: {
            stage1_results: { discriminatory_questions: ['Sample question'] },
            stage2_results: { pain_pleasure_points: ['Sample pain point'] },
            stage3_results: { archetypes: [{ name: 'Sample Archetype' }] }
        }
    });
});

app.post('/api/debug-data-wrangling', async (req, res) => {
    console.log('Data wrangling called:', req.body.step);
    
    // Basic success response for all steps
    res.json({
        success: true,
        step: req.body.step,
        message: `Step ${req.body.step} completed successfully`,
        totalColumnsProcessed: 253,
        processedRows: 1104
    });
});

// Serve the main page at root
app.get('/', (req, res) => {
    res.sendFile(path.join(projectRoot, 'public', 'three-stage-analysis-redesigned.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Local test server running at:`);
    console.log(`   http://localhost:${PORT}`);
    console.log(`   http://localhost:${PORT}/three-stage-analysis-redesigned.html`);
    console.log('');
    console.log('🧪 To test the DOM fixes:');
    console.log('1. Open the URL in your browser');
    console.log('2. Select "Upload New Dataset" radio button');
    console.log('3. Try to click "Process & Analyze" - should show helpful message');
    console.log('4. Select a file - should show the upload form');
    console.log('5. Fill the form and click "Process & Analyze" - should work');
    console.log('');
    console.log('Press Ctrl+C to stop');
});