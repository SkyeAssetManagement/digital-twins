import fs from 'fs/promises';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { datasetId } = req.params || {};
    
    if (!datasetId) {
      return res.status(400).json({ error: 'Dataset ID is required' });
    }

    const configPath = path.join(process.cwd(), 'data', 'datasets', datasetId, 'config.json');
    
    try {
      const configData = await fs.readFile(configPath, 'utf8');
      const config = JSON.parse(configData);
      
      // Check for processed data
      const processedPath = path.join(process.cwd(), 'data', 'datasets', datasetId, 'processed', 'processed_data.json');
      let processedData = null;
      
      try {
        const processed = await fs.readFile(processedPath, 'utf8');
        processedData = JSON.parse(processed);
      } catch {
        // No processed data yet
      }
      
      // Extract segments from processed data or config
      let segments = config.predefinedSegments || [];
      
      if (processedData && processedData.segments) {
        segments = processedData.segments.map(s => s.name || s.id);
      }
      
      res.json({
        ...config,
        segments,
        isProcessed: !!processedData,
        responseCount: processedData?.surveyData?.responses?.length || 0
      });
    } catch (error) {
      console.error(`Config not found for ${datasetId}:`, error);
      
      // Return default config
      res.json({
        id: datasetId,
        name: datasetId,
        description: 'Dataset configuration not found',
        segments: ['Segment_1', 'Segment_2', 'Segment_3', 'Segment_4'],
        keyDimensions: ['quality', 'price', 'brand', 'sustainability'],
        isProcessed: false,
        responseCount: 0
      });
    }
  } catch (error) {
    console.error('Error getting dataset config:', error);
    res.status(500).json({ 
      error: 'Failed to get dataset configuration',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}