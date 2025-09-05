/**
 * Test Script for Standardized API Endpoints
 * Tests the Phase 3 refactoring changes
 */

import { createLogger } from '../src/utils/logger.js';
import { datasetService } from '../src/services/dataset.service.js';
import { responseService } from '../src/services/response.service.js';
import { imageService } from '../src/services/image.service.js';

const logger = createLogger('APIEndpointTest');

async function testAPIEndpoints() {
  logger.info('Starting API endpoint tests');
  logger.info('================================');
  
  let testsPassed = 0;
  let testsFailed = 0;
  
  // Test 1: Dataset Service - List Datasets
  try {
    logger.info('Test 1: List datasets');
    const datasets = await datasetService.listDatasets();
    logger.info(`✓ Listed ${datasets.length} datasets`);
    testsPassed++;
  } catch (error) {
    logger.error('✗ Failed to list datasets', error);
    testsFailed++;
  }
  
  // Test 2: Dataset Service - Get Config
  try {
    logger.info('Test 2: Get dataset config');
    const config = await datasetService.getConfig('surf-clothing');
    logger.info(`✓ Retrieved config for ${config.name}`);
    testsPassed++;
  } catch (error) {
    logger.error('✗ Failed to get config', error);
    testsFailed++;
  }
  
  // Test 3: Dataset Service - Get Status
  try {
    logger.info('Test 3: Get dataset status');
    const status = await datasetService.getStatus('surf-clothing');
    logger.info(`✓ Dataset status: ${status.status}`);
    testsPassed++;
  } catch (error) {
    logger.error('✗ Failed to get status', error);
    testsFailed++;
  }
  
  // Test 4: Response Service - Generate Response
  try {
    logger.info('Test 4: Generate response');
    const response = await responseService.generateResponse({
      datasetId: 'surf-clothing',
      segment: 'Leader',
      marketingContent: 'New eco-friendly surfboard made from recycled ocean plastic',
      variant: 0,
      options: { mode: 'semantic' }
    });
    logger.info(`✓ Generated response: ${response.data.response.substring(0, 50)}...`);
    testsPassed++;
  } catch (error) {
    logger.error('✗ Failed to generate response', error);
    testsFailed++;
  }
  
  // Test 5: Response Service - Get Twin
  try {
    logger.info('Test 5: Get digital twin');
    const twin = await responseService.getTwin('surf-clothing', 'Leader', 0);
    logger.info(`✓ Retrieved twin for segment: ${twin.data.segment}`);
    testsPassed++;
  } catch (error) {
    logger.error('✗ Failed to get twin', error);
    testsFailed++;
  }
  
  // Test 6: Response Service - Analyze Content
  try {
    logger.info('Test 6: Analyze marketing content');
    const analysis = await responseService.analyzeContent(
      'Premium sustainable surfboard with innovative design and eco-friendly materials'
    );
    logger.info(`✓ Content analyzed, themes:`, analysis.data.themes);
    testsPassed++;
  } catch (error) {
    logger.error('✗ Failed to analyze content', error);
    testsFailed++;
  }
  
  // Test 7: Base Service - Validation
  try {
    logger.info('Test 7: Test validation');
    datasetService.validateRequired({ test: 'value' }, ['test', 'missing']);
    logger.error('✗ Validation should have thrown an error');
    testsFailed++;
  } catch (error) {
    if (error.message.includes('Missing required fields')) {
      logger.info('✓ Validation correctly caught missing fields');
      testsPassed++;
    } else {
      logger.error('✗ Unexpected validation error', error);
      testsFailed++;
    }
  }
  
  // Test 8: Base Service - Sanitization
  try {
    logger.info('Test 8: Test input sanitization');
    const dirty = '<script>alert("xss")</script>SELECT * FROM users';
    const clean = datasetService.sanitizeInput(dirty);
    if (!clean.includes('<script>') && !clean.includes('SELECT')) {
      logger.info('✓ Input properly sanitized');
      testsPassed++;
    } else {
      logger.error('✗ Sanitization failed');
      testsFailed++;
    }
  } catch (error) {
    logger.error('✗ Sanitization error', error);
    testsFailed++;
  }
  
  // Test 9: Response Formatting
  try {
    logger.info('Test 9: Test response formatting');
    const formatted = datasetService.formatResponse(
      { test: 'data' },
      { custom: 'metadata' }
    );
    if (formatted.success && formatted.data && formatted.metadata) {
      logger.info('✓ Response properly formatted');
      testsPassed++;
    } else {
      logger.error('✗ Response format incorrect');
      testsFailed++;
    }
  } catch (error) {
    logger.error('✗ Format error', error);
    testsFailed++;
  }
  
  // Test 10: Error Response Formatting
  try {
    logger.info('Test 10: Test error response formatting');
    const errorResponse = datasetService.formatErrorResponse(
      new Error('Test error'),
      false
    );
    if (!errorResponse.success && errorResponse.error) {
      logger.info('✓ Error response properly formatted');
      testsPassed++;
    } else {
      logger.error('✗ Error response format incorrect');
      testsFailed++;
    }
  } catch (error) {
    logger.error('✗ Error format error', error);
    testsFailed++;
  }
  
  // Summary
  logger.info('');
  logger.info('================================');
  logger.info(`Tests Passed: ${testsPassed}`);
  logger.info(`Tests Failed: ${testsFailed}`);
  logger.info(`Total Tests: ${testsPassed + testsFailed}`);
  logger.info('================================');
  
  if (testsFailed === 0) {
    logger.info('✓ ALL TESTS PASSED!');
  } else {
    logger.warn(`✗ ${testsFailed} tests failed`);
  }
  
  // Cleanup
  await responseService.closeAll();
  
  return testsFailed === 0;
}

// Run tests
testAPIEndpoints()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    logger.error('Test suite failed', error);
    process.exit(1);
  });