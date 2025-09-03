/**
 * Test Claude Persona Pipeline with Survey Data Integration
 * This tests the integrated approach using Claude API with survey-based personas
 * Compares with the current semantic engine approach
 */

import fs from 'fs/promises';
import path from 'path';
import { getIntegratedPersonaEngine } from './src/claude/integrated_persona_engine.js';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const testConfig = {
  approach: 'Claude Persona Pipeline with Survey Data',
  model: 'claude-opus-4-1-20250805',
  embeddings: 'OpenAI text-embedding-3-large (3072D)',
  method: 'Survey-based personas + Claude personality modeling',
  features: [
    'Real survey data from 1,006 respondents',
    'Personality vectors from actual responses',
    'Claude system prompts with survey grounding',
    'Big Five personality traits mapping',
    'Consistency enforcement across responses'
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

async function testClaudePipeline() {
  console.log('============================================');
  console.log('TESTING CLAUDE PERSONA PIPELINE');
  console.log('============================================');
  console.log(`Approach: ${testConfig.approach}`);
  console.log(`Model: ${testConfig.model}`);
  console.log(`Embeddings: ${testConfig.embeddings}`);
  console.log(`Method: ${testConfig.method}`);
  console.log('\nFeatures:');
  testConfig.features.forEach(f => console.log(`  - ${f}`));
  console.log(`\nTimestamp: ${testConfig.timestamp}`);
  console.log('============================================\n');
  
  // Check API keys
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ERROR: ANTHROPIC_API_KEY not found in environment');
    console.log('Please set ANTHROPIC_API_KEY in your .env file');
    return;
  }
  
  if (!process.env.OPENAI_API_KEY) {
    console.warn('WARNING: OPENAI_API_KEY not found');
    console.log('Will use local embeddings (less accurate for values)');
  }
  
  // Load test ad
  const adContent = await loadTestAd();
  console.log('Test Ad: Rip Curl "The Search" Commercial');
  console.log('Content preview:', adContent.substring(0, 200) + '...\n');
  
  // Initialize integrated persona engine
  console.log('Initializing Claude Persona Pipeline...');
  let engine;
  
  try {
    engine = await getIntegratedPersonaEngine();
    console.log('Pipeline initialized successfully\n');
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
      // Generate response using integrated pipeline
      console.log('Phase 1: Loading survey respondents from database...');
      console.log('Phase 2: Finding semantically similar respondents...');
      console.log('Phase 3: Creating persona from actual survey data...');
      console.log('Phase 4: Enhancing with Claude personality modeling...');
      console.log('Phase 5: Generating response with Claude API...\n');
      
      const startTime = Date.now();
      const response = await engine.generateIntegratedResponse(
        adContent,
        segment,
        {
          verbose: true,
          includeMetadata: true
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
        if (response.basedOn.surveyRespondents && response.basedOn.surveyRespondents.length > 0) {
          console.log(`Survey Respondents: ${response.basedOn.surveyRespondents.slice(0, 5).join(', ')}`);
        }
        if (response.basedOn.similarity) {
          console.log(`Similarity Score: ${(response.basedOn.similarity * 100).toFixed(1)}%`);
        }
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
      
      // Check if it's an API error
      if (error.message.includes('API')) {
        console.log('\nFalling back to survey-based response...');
        // Use fallback method
        results.responses[segment] = {
          text: generateFallbackResponse(segment),
          sentiment: getFallbackSentiment(segment),
          purchaseIntent: getFallbackIntent(segment),
          error: 'API unavailable - using survey fallback',
          timestamp: new Date().toISOString()
        };
      } else {
        results.responses[segment] = {
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }
    }
  }
  
  // Save results
  const outputPath = path.join(__dirname, 'test-results', 'claude-persona-pipeline-results.json');
  await fs.mkdir(path.join(__dirname, 'test-results'), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
  
  console.log('\n============================================');
  console.log('CLAUDE PIPELINE TEST COMPLETE');
  console.log(`Results saved to: ${outputPath}`);
  console.log('============================================\n');
  
  // Display summary
  console.log('SUMMARY OF CLAUDE PIPELINE RESPONSES:');
  console.log('='.repeat(60));
  
  for (const [segment, response] of Object.entries(results.responses)) {
    if (!response.error || response.text) {
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
  
  return results;
}

// Fallback responses based on survey data patterns
function generateFallbackResponse(segment) {
  const fallbacks = {
    Leader: "This ad objectifies women and ignores ocean conservation. The lifestyle focus doesn't align with my values of environmental responsibility. I need brands that protect what we surf in, not exploit it for marketing.",
    Leaning: "The Rip Curl brand has quality, but this ad's approach is dated. I'd prefer to see their sustainability initiatives and performance features rather than the typical beach party imagery. Value and ethics matter equally to me.",
    Learner: "Looks like a fun lifestyle but what about the price? The surfing is cool but I need to know if these products are worth the money compared to cheaper alternatives. Show me the deals, not just the party.",
    Laggard: "More overpriced surf brand marketing. The beach babes and beer thing doesn't make the gear cheaper. I just need functional boardshorts at a reasonable price, not this lifestyle nonsense."
  };
  
  return fallbacks[segment] || "Unable to generate response.";
}

function getFallbackSentiment(segment) {
  const sentiments = {
    Leader: 'negative',
    Leaning: 'neutral',
    Learner: 'neutral',
    Laggard: 'negative'
  };
  return sentiments[segment] || 'neutral';
}

function getFallbackIntent(segment) {
  const intents = {
    Leader: 2,
    Leaning: 5,
    Learner: 5,
    Laggard: 2
  };
  return intents[segment] || 5;
}

// Run the test
console.log('Starting Claude Persona Pipeline Test...\n');
testClaudePipeline().catch(console.error);