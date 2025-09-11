import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Import the debug API handler
import debugDataWrangling from './api/debug-data-wrangling.js';

// API Routes
app.post('/api/debug-data-wrangling', debugDataWrangling);

// Serve the debug HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'debug-data-wrangling.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Debug interface: http://localhost:${PORT}`);
    console.log(`🔌 API endpoint: http://localhost:${PORT}/api/debug-data-wrangling`);
});

export default app;