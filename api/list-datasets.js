import { VectorStore } from '../src/vector_db/vector_store.js';
import fs from 'fs/promises';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get datasets from file system
    const datasetsPath = path.join(process.cwd(), 'data', 'datasets');
    const datasets = [];
    
    try {
      const dirs = await fs.readdir(datasetsPath);
      
      for (const dir of dirs) {
        const configPath = path.join(datasetsPath, dir, 'config.json');
        
        try {
          const configData = await fs.readFile(configPath, 'utf8');
          const config = JSON.parse(configData);
          
          // Check if processed data exists
          const processedPath = path.join(datasetsPath, dir, 'processed', 'processed_data.json');
          let isProcessed = false;
          
          try {
            await fs.access(processedPath);
            isProcessed = true;
          } catch {
            // Processed file doesn't exist
          }
          
          datasets.push({
            id: config.id || dir,
            name: config.name || dir,
            description: config.description || '',
            status: isProcessed ? 'completed' : 'pending',
            isProcessing: false,
            segments: config.predefinedSegments || [],
            created_at: config.uploadDate || new Date().toISOString()
          });
        } catch (error) {
          console.error(`Error reading config for ${dir}:`, error);
          // Include directory even if config is missing
          datasets.push({
            id: dir,
            name: dir,
            description: 'Dataset configuration not found',
            status: 'error',
            isProcessing: false,
            segments: [],
            created_at: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      console.error('Error reading datasets directory:', error);
    }
    
    // Try to get additional info from database
    try {
      const vectorStore = new VectorStore('system');
      await vectorStore.initialize();
      const dbDatasets = await vectorStore.listDatasets();
      await vectorStore.close();
      
      // Merge database info with filesystem info
      dbDatasets.forEach(dbDataset => {
        const existing = datasets.find(d => d.id === dbDataset.id);
        if (existing) {
          existing.segment_count = dbDataset.segment_count;
          existing.response_count = dbDataset.response_count;
          existing.status = dbDataset.status || existing.status;
        } else {
          datasets.push(dbDataset);
        }
      });
    } catch (error) {
      console.warn('Could not fetch database datasets:', error);
    }
    
    res.json(datasets);
  } catch (error) {
    console.error('Error listing datasets:', error);
    res.status(500).json({ 
      error: 'Failed to list datasets',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}