/**
 * Basic Pipeline Test
 * Tests the data pipeline framework without external dependencies
 */

import { DataPipeline } from '../src/utils/data-pipeline.js';
import { createLogger } from '../src/utils/logger.js';
import { 
  parseScore, 
  normalizeResponse, 
  convertCategoricalToNumeric,
  calculateFieldStatistics
} from '../src/utils/data-normalizer.js';
import {
  LOHAS_SEGMENTS,
  getSegmentDefinition,
  mapSegmentCharacteristics,
  classifyIntoSegment
} from '../src/utils/segment-analyzer.js';

const logger = createLogger('BasicPipelineTest');

async function testDataPipeline() {
  logger.info('Testing Data Pipeline Framework...');
  
  const pipeline = new DataPipeline('test-pipeline');
  
  let progressEvents = 0;
  let stageCompleteEvents = 0;
  
  pipeline.on('progress', (progress) => {
    progressEvents++;
    logger.debug(`Progress: ${progress.stage} (${progress.percentage}%)`);
  });
  
  pipeline.on('stage-complete', (data) => {
    stageCompleteEvents++;
    logger.debug(`Stage complete: ${data.stage}`);
  });
  
  pipeline
    .stage('increment', async (data) => {
      logger.debug(`Stage 1: incrementing ${data}`);
      return data + 1;
    })
    .stage('double', async (data) => {
      logger.debug(`Stage 2: doubling ${data}`);
      return data * 2;
    })
    .stage('subtract', async (data) => {
      logger.debug(`Stage 3: subtracting 3 from ${data}`);
      return data - 3;
    });
  
  const result = await pipeline.execute(5);
  
  const expected = 9; // (5 + 1) * 2 - 3 = 9
  const passed = result === expected;
  
  logger.info('DataPipeline test result:', {
    passed,
    expectedResult: expected,
    actualResult: result,
    progressEvents,
    stageCompleteEvents,
    state: pipeline.getState()
  });
  
  return passed;
}

async function testDataNormalizer() {
  logger.info('Testing Data Normalizer utilities...');
  
  const tests = [];
  
  // Test parseScore
  tests.push({
    name: 'parseScore',
    result: parseScore('5.5') === 5.5 && parseScore(null) === null
  });
  
  // Test normalizeResponse
  const normalized = normalizeResponse(5, [1, 7], [0, 1]);
  tests.push({
    name: 'normalizeResponse',
    result: Math.abs(normalized - 0.67) < 0.01
  });
  
  // Test convertCategoricalToNumeric
  tests.push({
    name: 'convertCategoricalToNumeric',
    result: convertCategoricalToNumeric('q1', 'strongly agree') === 7
  });
  
  // Test calculateFieldStatistics
  const testData = [
    { score: 5 },
    { score: 3 },
    { score: 4 },
    { score: 2 },
    { score: 6 }
  ];
  const stats = calculateFieldStatistics(testData, 'score');
  tests.push({
    name: 'calculateFieldStatistics',
    result: stats.mean === 4 && stats.count === 5
  });
  
  const passed = tests.every(t => t.result);
  
  logger.info('Data Normalizer test results:', {
    passed,
    tests: tests.map(t => `${t.name}: ${t.result ? 'PASS' : 'FAIL'}`)
  });
  
  return passed;
}

async function testSegmentAnalyzer() {
  logger.info('Testing Segment Analyzer utilities...');
  
  const tests = [];
  
  // Test getSegmentDefinition
  const leaderSegment = getSegmentDefinition('Leader');
  tests.push({
    name: 'getSegmentDefinition',
    result: leaderSegment && leaderSegment.name === 'Leader' && leaderSegment.percentage === 12.4
  });
  
  // Test mapSegmentCharacteristics
  const characteristics = mapSegmentCharacteristics('Leader');
  tests.push({
    name: 'mapSegmentCharacteristics',
    result: characteristics && characteristics.primaryMotivation.includes('Environmental')
  });
  
  // Test classifyIntoSegment
  const scores = {
    sustainability: 0.9,
    priceConsciousness: 0.2,
    quality: 0.8,
    brandLoyalty: 0.7,
    innovation: 0.85
  };
  const classification = classifyIntoSegment(scores);
  tests.push({
    name: 'classifyIntoSegment',
    result: classification.segment === 'Leader' && classification.confidence > 0.5
  });
  
  // Test LOHAS_SEGMENTS structure
  tests.push({
    name: 'LOHAS_SEGMENTS',
    result: Object.keys(LOHAS_SEGMENTS).length === 4 &&
            LOHAS_SEGMENTS.Leader &&
            LOHAS_SEGMENTS.Leaning &&
            LOHAS_SEGMENTS.Learner &&
            LOHAS_SEGMENTS.Laggard
  });
  
  const passed = tests.every(t => t.result);
  
  logger.info('Segment Analyzer test results:', {
    passed,
    tests: tests.map(t => `${t.name}: ${t.result ? 'PASS' : 'FAIL'}`)
  });
  
  return passed;
}

async function testBatchProcessing() {
  logger.info('Testing Pipeline Batch Processing...');
  
  const pipeline = new DataPipeline('batch-test');
  
  let batchProgressEvents = 0;
  pipeline.on('batch-progress', (progress) => {
    batchProgressEvents++;
    logger.debug(`Batch progress: ${progress.processed}/${progress.total}`);
  });
  
  pipeline.batch('process-batch', async (batch) => {
    return batch.map(item => item * 2);
  }, 3); // Batch size of 3
  
  const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const result = await pipeline.execute(input);
  const expected = input.map(i => i * 2);
  
  const passed = JSON.stringify(result) === JSON.stringify(expected);
  
  logger.info('Batch processing test result:', {
    passed,
    inputLength: input.length,
    resultLength: result.length,
    batchProgressEvents,
    sample: `[${result.slice(0, 3).join(', ')}...]`
  });
  
  return passed;
}

async function testPipelineCache() {
  logger.info('Testing Pipeline Caching...');
  
  const pipeline = new DataPipeline('cache-test', { cacheResults: true });
  
  let executionCount = 0;
  pipeline.stage('expensive-operation', async (data) => {
    executionCount++;
    await new Promise(resolve => setTimeout(resolve, 100));
    return data * 2;
  }, { cache: true });
  
  // First execution
  const result1 = await pipeline.execute(5);
  const count1 = executionCount;
  
  // Reset pipeline but cache should remain
  pipeline.reset();
  
  // Second execution with same input (should use cache)
  const result2 = await pipeline.execute(5);
  const count2 = executionCount;
  
  const passed = result1 === result2 && result1 === 10 && count1 === 1;
  
  logger.info('Pipeline cache test result:', {
    passed,
    result1,
    result2,
    executionCount: count2,
    cacheHit: count1 === count2
  });
  
  return passed;
}

async function runAllTests() {
  logger.info('Starting basic pipeline tests...\n');
  
  const tests = [
    { name: 'Data Pipeline Framework', fn: testDataPipeline },
    { name: 'Data Normalizer Utilities', fn: testDataNormalizer },
    { name: 'Segment Analyzer Utilities', fn: testSegmentAnalyzer },
    { name: 'Batch Processing', fn: testBatchProcessing },
    { name: 'Pipeline Caching', fn: testPipelineCache }
  ];
  
  const results = [];
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    logger.info(`\nRunning: ${test.name}`);
    logger.info('=' .repeat(40));
    
    try {
      const success = await test.fn();
      results.push({ name: test.name, success });
      
      if (success) {
        passed++;
        logger.info(`✓ ${test.name} PASSED\n`);
      } else {
        failed++;
        logger.error(`✗ ${test.name} FAILED\n`);
      }
    } catch (error) {
      failed++;
      logger.error(`✗ ${test.name} FAILED with error:`, error.message);
      results.push({ name: test.name, success: false, error: error.message });
    }
  }
  
  logger.info('\n' + '='.repeat(50));
  logger.info('TEST SUMMARY:');
  logger.info('='.repeat(50));
  logger.info(`Total Tests: ${tests.length}`);
  logger.info(`Passed: ${passed}`);
  logger.info(`Failed: ${failed}`);
  logger.info('='.repeat(50) + '\n');
  
  return failed === 0;
}

// Run tests
runAllTests()
  .then(success => {
    if (success) {
      logger.info('✓ All basic pipeline tests passed!');
      process.exit(0);
    } else {
      logger.error('✗ Some tests failed');
      process.exit(1);
    }
  })
  .catch(error => {
    logger.error('Test execution failed:', error);
    process.exit(1);
  });