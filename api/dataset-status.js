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

    const datasetPath = path.join(process.cwd(), 'data', 'datasets', datasetId);
    const processedPath = path.join(datasetPath, 'processed', 'processed_data.json');
    
    // Check if dataset exists
    try {
      await fs.access(datasetPath);
    } catch {
      return res.status(404).json({ error: 'Dataset not found' });
    }
    
    // Check if processing is complete
    let isComplete = false;
    let processedData = null;
    let error = null;
    
    try {
      const data = await fs.readFile(processedPath, 'utf8');
      processedData = JSON.parse(data);
      isComplete = true;
    } catch (err) {
      // Check for error file
      const errorPath = path.join(datasetPath, 'processed', 'error.json');
      try {
        const errorData = await fs.readFile(errorPath, 'utf8');
        const errorInfo = JSON.parse(errorData);
        error = errorInfo.message || 'Processing failed';
      } catch {
        // No error file, still processing
      }
    }
    
    res.json({
      datasetId,
      isComplete,
      error,
      segments: processedData?.segments?.length || 0,
      responses: processedData?.surveyData?.responses?.length || 0,
      timestamp: processedData?.timestamp || null
    });
  } catch (error) {
    console.error('Error checking dataset status:', error);
    res.status(500).json({ 
      error: 'Failed to check dataset status',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}