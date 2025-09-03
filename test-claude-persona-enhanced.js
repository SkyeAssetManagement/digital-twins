/**
 * Test Enhanced Claude Persona Pipeline with Proper Survey Integration
 * Uses Anthropic's best practices for persona creation
 * Implements XML tags, prefilling, and data-driven personas
 */

import fs from 'fs/promises';
import path from 'path';
import { getIntegratedPersonaEngineV2 } from './src/claude/integrated_persona_engine_v2.js';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const testConfig = {
  approach: 'Enhanced Claude Persona Pipeline with Survey Data',
  model: 'claude-opus-4-1-20250805',
  embeddings: 'Survey-based personas with XML structure',
  method: 'Data-driven personas + Anthropic best practices',
  features: [
    'Real survey data from 1,006 respondents',
    'XML-structured system prompts',
    'Demographic and behavioral profiles',
    'Prefilling for character consistency',
    'Peer perspectives from similar respondents',
    'Natural, conversational responses'
  ],
  timestamp: new Date().toISOString()
};

// Load test ad
async function loadTestAd() {
  const adPath = path.join(__dirname, 'testMaterials', 'testAdScript.md');
  const adContent = await fs.readFile(adPath, 'utf8');
  return adContent;
}

// LOHAS segments to test
const segments = ['Leader', 'Leaning', 'Learner', 'Laggard'];

async function testEnhancedClaudePipeline() {
  console.log('============================================');
  console.log('TESTING ENHANCED CLAUDE PERSONA PIPELINE');
  console.log('============================================');
  console.log(`Approach: ${testConfig.approach}`);
  console.log(`Model: ${testConfig.model}`);
  console.log(`Method: ${testConfig.method}`);
  console.log('\nFeatures:');
  testConfig.features.forEach(f => console.log(`  - ${f}`));
  console.log(`\nTimestamp: ${testConfig.timestamp}`);
  console.log('============================================\n');
  
  // Check API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ERROR: ANTHROPIC_API_KEY not found in environment');
    console.log('Please set ANTHROPIC_API_KEY in your .env file');
    return;
  }
  
  // Load test ad
  const adContent = await loadTestAd();
  console.log('Test Ad: Rip Curl "The Search" Commercial');
  console.log('Content preview:', adContent.substring(0, 200) + '...\n');
  
  // Initialize enhanced persona engine
  console.log('Initializing Enhanced Claude Persona Pipeline...');
  let engine;
  
  try {
    engine = await getIntegratedPersonaEngineV2();
    console.log('Enhanced pipeline initialized successfully\n');
  } catch (error) {
    console.error('Failed to initialize pipeline:', error.message);
    return;
  }
  
  // Store results
  const results = {
    metadata: testConfig,
    adContent: adContent,
    responses: {}
  };
  
  // Test each segment
  for (const segment of segments) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing Segment: ${segment}`);
    console.log('='.repeat(60));
    
    try {
      // Generate response using enhanced pipeline
      console.log('Creating data-driven persona from survey respondents...');
      console.log('Building demographic and behavioral profile...');
      console.log('Applying Anthropic best practices...');
      console.log('Generating authentic response...\n');
      
      const startTime = Date.now();
      const response = await engine.generateEnhancedResponse(
        adContent,
        segment,
        {
          numRespondents: 10,  // Use 10 real respondents for persona
          verbose: true
        }
      );
      const responseTime = Date.now() - startTime;
      
      // Display results
      console.log('--- RESPONSE ---');
      console.log(`Text: "${response.text}"`);
      console.log(`\nSentiment: ${response.sentiment}`);
      console.log(`Purchase Intent: ${response.purchaseIntent}/10`);
      console.log(`Response Time: ${responseTime}ms`);
      
      if (response.basedOn) {
        console.log(`\n--- DATA SOURCES ---`);
        console.log(`Method: ${response.basedOn.method}`);
        console.log(`Model: ${response.basedOn.model || 'N/A'}`);
        if (response.basedOn.surveyRespondents && response.basedOn.surveyRespondents.length > 0) {
          console.log(`Survey Respondents: ${response.basedOn.surveyRespondents.slice(0, 5).join(', ')}`);
        }
        console.log(`Persona Type: ${response.basedOn.personaType || 'standard'}`);
      }
      
      // Store results
      results.responses[segment] = {
        text: response.text,
        sentiment: response.sentiment,
        purchaseIntent: response.purchaseIntent,
        responseTime: responseTime,
        basedOn: response.basedOn,
        timestamp: response.timestamp
      };
      
    } catch (error) {
      console.error(`Error testing ${segment}:`, error.message);
      
      // Store error
      results.responses[segment] = {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  // Save results
  const outputPath = path.join(__dirname, 'test-results', 'claude-enhanced-pipeline-results.json');
  await fs.mkdir(path.join(__dirname, 'test-results'), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
  
  console.log('\n============================================');
  console.log('ENHANCED CLAUDE PIPELINE TEST COMPLETE');
  console.log(`Results saved to: ${outputPath}`);
  console.log('============================================\n');
  
  // Display summary
  console.log('SUMMARY OF ENHANCED RESPONSES:');
  console.log('='.repeat(60));
  
  for (const [segment, response] of Object.entries(results.responses)) {
    if (!response.error) {
      console.log(`\n${segment}:`);
      console.log(`  Response: "${response.text?.substring(0, 100)}..."`);
      console.log(`  Sentiment: ${response.sentiment} | Intent: ${response.purchaseIntent}/10`);
      if (response.responseTime) {
        console.log(`  Time: ${response.responseTime}ms`);
      }
    } else {
      console.log(`\n${segment}: ERROR - ${response.error}`);
    }
  }
  
  // Compare with expected values
  console.log('\n\nEXPECTED VS ACTUAL ALIGNMENT:');
  console.log('='.repeat(60));
  console.log('Segment  | Expected Sentiment | Actual Sentiment | Match?');
  console.log('---------|--------------------|------------------|-------');
  
  const expectedSentiments = {
    'Leader': 'negative',  // No sustainability in ad
    'Leaning': 'neutral',  // Balanced view
    'Learner': 'neutral',  // Price-focused
    'Laggard': 'negative'  // Skeptical
  };
  
  for (const segment of segments) {
    const expected = expectedSentiments[segment];
    const actual = results.responses[segment]?.sentiment || 'error';
    const match = expected === actual ? 'YES' : 'NO';
    console.log(`${segment.padEnd(8)} | ${expected.padEnd(18)} | ${actual.padEnd(16)} | ${match}`);
  }
  
  return results;
}

// Run the test
console.log('Starting Enhanced Claude Persona Pipeline Test...\n');
testEnhancedClaudePipeline().catch(console.error);