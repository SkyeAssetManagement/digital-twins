import formidable from 'formidable';
import fs from 'fs/promises';
import path from 'path';
import { UniversalProcessor } from '../src/data_processing/universal_processor.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const form = formidable({
    maxFileSize: 50 * 1024 * 1024, // 50MB
    keepExtensions: true,
  });
  
  try {
    const [fields, files] = await form.parse(req);
    
    // Validate required files
    const surveyFile = files.survey?.[0];
    const pdfFiles = files.pdfs || [];
    const configData = JSON.parse(fields.config[0]);
    
    if (!surveyFile) {
      return res.status(400).json({ error: 'Survey file required' });
    }
    
    // Create dataset directory
    const datasetId = `dataset_${Date.now()}`;
    const datasetPath = path.join(process.cwd(), 'data', 'datasets', datasetId);
    
    await fs.mkdir(path.join(datasetPath, 'raw'), { recursive: true });
    await fs.mkdir(path.join(datasetPath, 'processed'), { recursive: true });
    
    // Move uploaded files
    await fs.copyFile(
      surveyFile.filepath, 
      path.join(datasetPath, 'raw', surveyFile.originalFilename || surveyFile.name)
    );
    
    for (const pdf of pdfFiles) {
      await fs.copyFile(
        pdf.filepath, 
        path.join(datasetPath, 'raw', pdf.originalFilename || pdf.name)
      );
    }
    
    // Save configuration
    const fullConfig = {
      ...configData,
      id: datasetId,
      dataFiles: {
        survey: surveyFile.originalFilename || surveyFile.name,
        research: pdfFiles.map(f => f.originalFilename || f.name)
      },
      uploadDate: new Date().toISOString()
    };
    
    await fs.writeFile(
      path.join(datasetPath, 'config.json'),
      JSON.stringify(fullConfig, null, 2)
    );
    
    // Start processing in background
    processDatasetAsync(datasetId).catch(error => {
      console.error(`Failed to process dataset ${datasetId}:`, error);
      // Save error to file
      fs.writeFile(
        path.join(datasetPath, 'processed', 'error.json'),
        JSON.stringify({ 
          message: error.message, 
          timestamp: new Date().toISOString() 
        })
      );
    });
    
    res.status(200).json({
      success: true,
      datasetId,
      message: 'Dataset uploaded successfully. Processing started.',
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: 'Failed to upload dataset',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

async function processDatasetAsync(datasetId) {
  console.log(`Starting to process dataset ${datasetId}`);
  
  try {
    const processor = new UniversalProcessor(datasetId);
    const result = await processor.processDataset();
    
    console.log(`Dataset ${datasetId} processed successfully`);
    console.log(`Found ${result.segments.length} segments`);
    console.log(`Processed ${result.surveyData.responses.length} responses`);
    
    return result;
  } catch (error) {
    console.error(`Failed to process dataset ${datasetId}:`, error);
    throw error;
  }
}