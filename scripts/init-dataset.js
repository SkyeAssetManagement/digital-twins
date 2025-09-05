import { UniversalProcessor } from '../src/data_processing/universal_processor.js';
import { createUnifiedVectorStore } from '../src/vector_db/unified_vector_store.js';
import { PDFInsightExtractor } from '../src/data_processing/pdf_extractor.js';
import { SegmentDiscovery } from '../src/data_processing/segment_discovery.js';
import { DynamicTwinGenerator } from '../src/digital_twins/twin_generator.js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

export async function initializeDataset(datasetId) {
  console.log(`Initializing dataset: ${datasetId}`);
  console.log('Database URL:', process.env.DATABASE_URL ? 'Configured' : 'Not configured');
  console.log('Anthropic API:', process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'your_api_key_here' ? 'Configured' : 'Not configured');
  
  try {
    // Step 1: Process raw data
    console.log('\nStep 1: Processing raw data...');
    const processor = new UniversalProcessor(datasetId);
    const config = await processor.loadConfig();
    console.log(`Loaded config for: ${config.name}`);
    
    // Process survey file
    const surveyPath = path.join(processor.basePath, 'raw', config.dataFiles.survey);
    console.log(`Processing survey file: ${surveyPath}`);
    const surveyData = await processor.processSurveyFile(surveyPath, config);
    console.log(`Found ${surveyData.questions.length} questions`);
    console.log(`Found ${surveyData.responses.length} responses`);
    
    // Extract PDF insights
    console.log('\nExtracting insights from PDFs...');
    const pdfExtractor = new PDFInsightExtractor();
    const pdfInsights = await pdfExtractor.extractInsights(
      config.dataFiles.research.map(f => path.join(processor.basePath, 'raw', f))
    );
    console.log(`Extracted ${Object.keys(pdfInsights.segmentDescriptions || {}).length} segment descriptions`);
    console.log(`Found ${pdfInsights.keyFindings?.length || 0} key findings`);
    
    // Discover or map segments
    console.log('\nDiscovering segments...');
    let segments;
    
    if (config.segmentationMethod === 'auto') {
      const segmentDiscovery = new SegmentDiscovery();
      segments = await segmentDiscovery.findSegments(surveyData, pdfInsights, config);
      console.log(`Discovered ${segments.length} segments through clustering`);
    } else {
      segments = processor.mapPredefinedSegments(config.predefinedSegments, surveyData);
      console.log(`Mapped ${segments.length} predefined segments`);
    }
    
    segments.forEach(s => {
      console.log(`  - ${s.name}: ${s.size} respondents (${s.percentage.toFixed(1)}%)`);
    });
    
    // Save processed data
    await processor.saveProcessedData({
      config,
      surveyData,
      pdfInsights,
      segments,
      timestamp: new Date().toISOString()
    });
    
    // Step 2: Initialize unified vector store
    console.log('\nStep 2: Initializing unified vector store...');
    const vectorStore = await createUnifiedVectorStore(datasetId, {
      embeddingProvider: config.embeddingProvider || 'openai'
    });
    
    // Step 3: Store segment profiles
    console.log('\nStep 3: Storing segment profiles...');
    for (const segment of segments) {
      await vectorStore.storeSegmentProfile(
        segment.name,
        segment.characteristics,
        segment.valueSystem
      );
      console.log(`  Stored profile for ${segment.name}`);
    }
    
    // Step 4: Store sample responses (for similarity search)
    console.log('\nStep 4: Storing sample responses...');
    const responsesPerSegment = Math.floor(surveyData.responses.length / segments.length);
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const startIdx = i * responsesPerSegment;
      const endIdx = Math.min(startIdx + responsesPerSegment, surveyData.responses.length);
      
      // Store a sample of responses for this segment
      for (let j = startIdx; j < Math.min(startIdx + 10, endIdx); j++) {
        const respondent = surveyData.responses[j];
        
        // Store key responses
        const keyQuestions = Object.entries(respondent.responses).slice(0, 5);
        for (const [question, answer] of keyQuestions) {
          if (answer !== null && answer !== undefined) {
            await vectorStore.storeResponse(
              respondent.respondentId,
              segment.name,
              question,
              answer.toString(),
              { originalDataset: datasetId }
            );
          }
        }
      }
      
      console.log(`  Stored sample responses for ${segment.name}`);
    }
    
    // Step 5: Generate initial digital twins
    console.log('\nStep 5: Generating digital twins...');
    const twinGenerator = new DynamicTwinGenerator(vectorStore, config);
    
    for (const segment of segments) {
      // Generate 3 variants per segment
      for (let variant = 0; variant < 3; variant++) {
        try {
          const twin = await twinGenerator.generateTwin(segment.name, variant);
          console.log(`  Created twin: ${twin.persona.name || `Variant ${variant + 1}`} (${segment.name})`);
        } catch (error) {
          console.error(`  Failed to generate twin for ${segment.name} variant ${variant}:`, error.message);
        }
      }
    }
    
    // Step 6: Update dataset status
    console.log('\nStep 6: Updating dataset status...');
    await vectorStore.updateDatasetStatus(datasetId, 'completed');
    
    // Close database connection
    await vectorStore.close();
    
    console.log(`\nDataset ${datasetId} initialized successfully!`);
    console.log('You can now start the server with: npm run dev');
    
    return { 
      success: true, 
      segments: segments.length,
      responses: surveyData.responses.length
    };
    
  } catch (error) {
    console.error(`\nFailed to initialize dataset ${datasetId}:`, error);
    
    // Try to update status to failed
    try {
      const vectorStore = await createUnifiedVectorStore(datasetId);
      await vectorStore.updateDatasetStatus(datasetId, 'failed', error.message);
      await vectorStore.close();
    } catch (e) {
      console.error('Could not update dataset status:', e);
    }
    
    throw error;
  }
}

// Run if called directly
if (process.argv[2]) {
  const datasetId = process.argv[2];
  console.log('\n========================================');
  console.log('Digital Twin Dataset Initialization');
  console.log('========================================\n');
  
  initializeDataset(datasetId)
    .then((result) => {
      console.log('\n========================================');
      console.log('Initialization Complete!');
      console.log(`Segments: ${result.segments}`);
      console.log(`Responses: ${result.responses}`);
      console.log('========================================\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n========================================');
      console.error('Initialization Failed!');
      console.error('Error:', error.message);
      console.error('========================================\n');
      process.exit(1);
    });
} else {
  console.log('Usage: npm run init-dataset <dataset-id>');
  console.log('Example: npm run init-dataset surf-clothing');
}