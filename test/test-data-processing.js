/**
 * Test Data Processing Pipeline
 * Verifies that the refactored data processing modules work correctly
 */

import { UniversalProcessor } from '../src/data_processing/universal_processor.js';
import { PDFInsightExtractor } from '../src/data_processing/pdf_extractor.js';
import { SegmentDiscovery } from '../src/data_processing/segment_discovery.js';
import { getSurveyResponseLoader } from '../src/data_processing/survey_response_loader.js';
import { createLogger } from '../src/utils/logger.js';

const logger = createLogger('TestDataProcessing');

async function testUniversalProcessor() {
  logger.info('Testing UniversalProcessor...');
  
  try {
    const processor = new UniversalProcessor('surf-clothing');
    const result = await processor.processDataset();
    
    logger.info('UniversalProcessor test passed', {
      questionsFound: result.surveyData?.questions?.length || 0,
      responsesFound: result.surveyData?.responses?.length || 0,
      segmentsFound: result.segments?.length || 0
    });
    
    return true;
  } catch (error) {
    logger.error('UniversalProcessor test failed', error);
    return false;
  }
}

async function testPDFExtractor() {
  logger.info('Testing PDFInsightExtractor...');
  
  try {
    const extractor = new PDFInsightExtractor();
    const pdfPaths = [
      'data/datasets/surf-clothing/raw/LOHAS_Report.pdf'
    ];
    
    const insights = await extractor.extractInsights(pdfPaths);
    
    logger.info('PDFInsightExtractor test passed', {
      segmentsFound: Object.keys(insights.segmentDescriptions).length,
      findingsCount: insights.keyFindings.length,
      behaviorsCount: insights.behavioralIndicators.length
    });
    
    return true;
  } catch (error) {
    logger.error('PDFInsightExtractor test failed', error);
    return false;
  }
}

async function testSegmentDiscovery() {
  logger.info('Testing SegmentDiscovery...');
  
  try {
    const discovery = new SegmentDiscovery();
    
    // Create sample survey data
    const surveyData = {
      responses: [
        { respondentId: '1', responses: { q1: 5, q2: 3, q3: 4 } },
        { respondentId: '2', responses: { q1: 2, q2: 5, q3: 1 } },
        { respondentId: '3', responses: { q1: 4, q2: 4, q3: 3 } },
        { respondentId: '4', responses: { q1: 1, q2: 2, q3: 5 } },
        { respondentId: '5', responses: { q1: 3, q2: 3, q3: 3 } }
      ]
    };
    
    const pdfInsights = {
      segmentDescriptions: {},
      keyFindings: [],
      valueFrameworks: {},
      behavioralIndicators: []
    };
    
    const segments = await discovery.findSegments(surveyData, pdfInsights, {
      predefinedSegments: ['Leader', 'Leaning', 'Learner', 'Laggard']
    });
    
    logger.info('SegmentDiscovery test passed', {
      segmentsDiscovered: segments.length,
      totalResponses: surveyData.responses.length
    });
    
    return true;
  } catch (error) {
    logger.error('SegmentDiscovery test failed', error);
    return false;
  }
}

async function testSurveyLoader() {
  logger.info('Testing SurveyResponseLoader...');
  
  try {
    const loader = await getSurveyResponseLoader();
    
    // Test loading
    const responses = await loader.loadResponses();
    
    let totalResponses = 0;
    Object.entries(responses).forEach(([segment, segmentResponses]) => {
      totalResponses += segmentResponses.length;
      logger.debug(`${segment}: ${segmentResponses.length} responses`);
    });
    
    // Test getting random responses
    const randomResponses = loader.getRandomResponses('Leader', 3);
    
    // Test getting average scores
    const averages = loader.getAverageScores('Leader');
    
    logger.info('SurveyResponseLoader test passed', {
      totalResponses,
      segmentsLoaded: Object.keys(responses).length,
      randomResponsesRetrieved: randomResponses.length,
      averageFieldsCalculated: Object.keys(averages).length
    });
    
    return true;
  } catch (error) {
    logger.error('SurveyResponseLoader test failed', error);
    return false;
  }
}

async function testDataPipeline() {
  logger.info('Testing Data Pipeline Framework...');
  
  try {
    const { DataPipeline } = await import('../src/utils/data-pipeline.js');
    
    const pipeline = new DataPipeline('test-pipeline');
    
    let progressEvents = 0;
    pipeline.on('progress', () => progressEvents++);
    
    pipeline
      .stage('stage1', async (data) => data + 1)
      .stage('stage2', async (data) => data * 2)
      .stage('stage3', async (data) => data - 3);
    
    const result = await pipeline.execute(5);
    
    logger.info('DataPipeline test passed', {
      expectedResult: 9,  // (5 + 1) * 2 - 3 = 9
      actualResult: result,
      progressEvents,
      pipelineState: pipeline.getState()
    });
    
    return result === 9;
  } catch (error) {
    logger.error('DataPipeline test failed', error);
    return false;
  }
}

async function runAllTests() {
  logger.info('Starting data processing tests...');
  
  const tests = [
    { name: 'DataPipeline Framework', fn: testDataPipeline },
    { name: 'PDFInsightExtractor', fn: testPDFExtractor },
    { name: 'SegmentDiscovery', fn: testSegmentDiscovery },
    { name: 'SurveyResponseLoader', fn: testSurveyLoader },
    { name: 'UniversalProcessor', fn: testUniversalProcessor }
  ];
  
  const results = [];
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    logger.info(`\nRunning test: ${test.name}`);
    const success = await test.fn();
    results.push({ name: test.name, success });
    
    if (success) {
      passed++;
      logger.info(`✓ ${test.name} passed`);
    } else {
      failed++;
      logger.error(`✗ ${test.name} failed`);
    }
  }
  
  logger.info('\n========================================');
  logger.info('Test Summary:');
  logger.info(`Total Tests: ${tests.length}`);
  logger.info(`Passed: ${passed}`);
  logger.info(`Failed: ${failed}`);
  logger.info('========================================\n');
  
  return failed === 0;
}

// Run tests
runAllTests()
  .then(success => {
    if (success) {
      logger.info('All data processing tests passed!');
      process.exit(0);
    } else {
      logger.error('Some tests failed');
      process.exit(1);
    }
  })
  .catch(error => {
    logger.error('Test execution failed', error);
    process.exit(1);
  });