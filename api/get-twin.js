import { createUnifiedVectorStore } from '../src/vector_db/unified_vector_store.js';
import { DynamicTwinGenerator } from '../src/digital_twins/twin_generator.js';
import fs from 'fs/promises';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { datasetId, segment, variant } = req.params || {};
    
    if (!datasetId || !segment || variant === undefined) {
      return res.status(400).json({ 
        error: 'Dataset ID, segment, and variant are required' 
      });
    }

    // Load dataset config
    const configPath = path.join(process.cwd(), 'data', 'datasets', datasetId, 'config.json');
    let config;
    
    try {
      const configData = await fs.readFile(configPath, 'utf8');
      config = JSON.parse(configData);
    } catch (error) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    // Initialize unified vector store
    const vectorStore = await createUnifiedVectorStore(datasetId, {
      embeddingProvider: config.embeddingProvider || 'openai'
    });

    // Generate twin
    const twinGenerator = new DynamicTwinGenerator(vectorStore, config);
    const twin = await twinGenerator.generateTwin(segment, parseInt(variant));

    // Close database connection
    await vectorStore.close();

    res.json(twin);
  } catch (error) {
    console.error('Error generating twin:', error);
    res.status(500).json({ 
      error: 'Failed to generate twin',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}