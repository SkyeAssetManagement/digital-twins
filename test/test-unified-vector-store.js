/**
 * Test script for the Unified Vector Store
 * Verifies all functionality works correctly
 */

import { createUnifiedVectorStore } from '../src/vector_db/unified_vector_store.js';
import { createLogger } from '../src/utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

const logger = createLogger('VectorStoreTest');

async function testUnifiedVectorStore() {
  logger.info('Starting Unified Vector Store tests');
  
  let store;
  const testDatasetId = 'test-dataset-' + Date.now();
  
  try {
    // Test 1: Initialize the store
    logger.info('Test 1: Initializing vector store');
    store = await createUnifiedVectorStore(testDatasetId, {
      embeddingProvider: process.env.OPENAI_API_KEY ? 'openai-small' : 'local-minilm'
    });
    logger.info('✓ Vector store initialized successfully');
    
    // Test 2: Store a response
    logger.info('Test 2: Storing a response');
    const responseId = await store.storeResponse(
      'test-respondent-1',
      'eco-conscious',
      'What matters most when buying clothing?',
      'Sustainability and environmental impact are my top priorities',
      { source: 'test' }
    );
    logger.info('✓ Response stored', { id: responseId });
    
    // Test 3: Store survey response
    logger.info('Test 3: Storing survey response');
    await store.storeSurveyResponse({
      respondentId: 'test-respondent-2',
      segment: 'eco-conscious',
      sustainability: 5,
      priceSensitivity: 2,
      brandValues: 4,
      willingnessToPay: 4,
      activism: 3,
      envEvangelist: 4,
      exampleResponses: [
        { response: 'I always check for eco-friendly materials' },
        { response: 'Brand ethics matter more than price to me' }
      ],
      metadata: { test: true }
    });
    logger.info('✓ Survey response stored');
    
    // Test 4: Store segment profile
    logger.info('Test 4: Storing segment profile');
    const segmentId = await store.storeSegmentProfile(
      'eco-conscious',
      {
        primaryConcern: 'environmental impact',
        pricePoint: 'premium',
        brandLoyalty: 'high'
      },
      {
        sustainability: 5,
        quality: 4,
        price: 2
      }
    );
    logger.info('✓ Segment profile stored', { id: segmentId });
    
    // Test 5: Find similar responses
    logger.info('Test 5: Finding similar responses');
    const similarResponses = await store.findSimilarResponses(
      'environmental sustainability',
      'eco-conscious',
      3
    );
    logger.info('✓ Found similar responses', { count: similarResponses.length });
    
    // Test 6: Get segment profile
    logger.info('Test 6: Getting segment profile');
    const profile = await store.getSegmentProfile('eco-conscious');
    logger.info('✓ Retrieved segment profile', { 
      hasCharacteristics: !!profile?.characteristics,
      hasValueSystem: !!profile?.value_system 
    });
    
    // Test 7: Store persona
    logger.info('Test 7: Storing persona');
    const personaId = await store.storePersona({
      datasetId: testDatasetId,
      segment: 'eco-conscious',
      persona: {
        name: 'Emma Green',
        age: 28,
        occupation: 'Environmental consultant'
      },
      valueSystem: {
        sustainability: 5,
        quality: 4
      }
    });
    logger.info('✓ Persona stored', { id: personaId });
    
    // Test 8: Find similar survey responses
    logger.info('Test 8: Finding similar survey responses');
    const surveyResponses = await store.findSimilarSurveyResponses(
      'Our new eco-friendly clothing line uses 100% organic materials',
      'eco-conscious',
      2
    );
    logger.info('✓ Found similar survey responses', { count: surveyResponses.length });
    
    // Test 9: Update dataset status
    logger.info('Test 9: Updating dataset status');
    await store.updateDatasetStatus(testDatasetId, 'processing', { step: 'test' });
    await store.updateDatasetStatus(testDatasetId, 'completed');
    logger.info('✓ Dataset status updated');
    
    // Test 10: Get statistics
    logger.info('Test 10: Getting statistics');
    const stats = await store.getStatistics();
    logger.info('✓ Retrieved statistics', stats);
    
    // Test 11: List datasets
    logger.info('Test 11: Listing datasets');
    const datasets = await store.listDatasets();
    logger.info('✓ Listed datasets', { count: datasets.length });
    
    // Test 12: Find representative responses
    logger.info('Test 12: Finding representative responses');
    const representativeResponses = await store.findRepresentativeResponses(
      'eco-conscious',
      5
    );
    logger.info('✓ Found representative responses', { count: representativeResponses.length });
    
    // Test 13: Compute segment centroids
    logger.info('Test 13: Computing segment centroids');
    await store.computeSegmentCentroids('eco-conscious', [
      { sustainability: 5, priceSensitivity: 2, brandValues: 4, willingnessToPay: 4 },
      { sustainability: 4, priceSensitivity: 3, brandValues: 5, willingnessToPay: 3 }
    ]);
    logger.info('✓ Segment centroids computed');
    
    // Test 14: Cache cleanup
    logger.info('Test 14: Testing cache cleanup');
    await store.cleanupCache(30);
    logger.info('✓ Cache cleanup completed');
    
    logger.info('');
    logger.info('===================================');
    logger.info('ALL TESTS PASSED SUCCESSFULLY! ✓');
    logger.info('===================================');
    
  } catch (error) {
    logger.error('Test failed', error);
    process.exit(1);
  } finally {
    if (store) {
      await store.close();
      logger.info('Vector store closed');
    }
  }
}

// Run the tests
testUnifiedVectorStore().catch(error => {
  logger.error('Fatal error', error);
  process.exit(1);
});