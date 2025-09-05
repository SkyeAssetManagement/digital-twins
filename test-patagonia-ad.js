/**
 * Test all three approaches with Patagonia "Don't Buy This Jacket" ad
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Import all three engines
import { SemanticResponseEngine } from './src/digital_twins/semantic_response_engine.js';
import { createUnifiedVectorStore } from './src/vector_db/unified_vector_store.js';
import { getAdvancedSemanticEngine } from './src/semantic/advanced_semantic_engine.js';
import { getIntegratedPersonaEngineV2 } from './src/claude/integrated_persona_engine_v2.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Patagonia ad content
const patagoniaAd = `
Patagonia "Don't Buy This Jacket" Advertisement

Headline: DON'T BUY THIS JACKET

Body text: The R2 Jacket shown here, one of our best sellers. 
To make it required 135 liters of water, enough to meet the daily needs (three glasses a day) of 45 people. 
Its journey from its origin as 60% recycled polyester to our Reno warehouse generated nearly 20 pounds of carbon dioxide, 24 times the weight of the finished product. 
This jacket left behind, on its way to Reno, two-thirds its weight in waste.

And this is a 60% recycled polyester jacket, knit and sewn to a high standard. But, as is true of all the things we can make and you can buy, this jacket comes with an environmental cost higher than its price.

There is much to be done and plenty for us all to do. Don't buy what you don't need. Think twice before you buy anything. Go to patagonia.com/CommonThreads, take the Common Threads Initiative pledge and join us in the fifth "R," to reimagine a world where we take only what nature can replace.

- Patagonia
`;

const segments = ['Leader', 'Leaning', 'Learner', 'Laggard'];

async function testAllApproaches() {
  console.log('============================================');
  console.log('TESTING ALL APPROACHES WITH PATAGONIA AD');
  console.log('============================================\n');
  
  const results = {
    ad: 'Patagonia - Don\'t Buy This Jacket',
    timestamp: new Date().toISOString(),
    responses: {}
  };
  
  // Test 1: Basic Semantic Engine
  console.log('1. BASIC SEMANTIC ENGINE');
  console.log('------------------------');
  const vectorStore = await createUnifiedVectorStore('patagonia-test', { embeddingProvider: 'local-minilm' });
  
  for (const segment of segments) {
    const twin = {
      id: `test-${segment.toLowerCase()}`,
      segment: segment,
      persona: { name: `${segment} Consumer` },
      valueSystem: {},
      characteristics: []
    };
    
    const engine = new SemanticResponseEngine(twin, vectorStore);
    await engine.initialize();
    
    const start = Date.now();
    const response = await engine.generateSemanticResponse(patagoniaAd);
    const time = Date.now() - start;
    
    console.log(`${segment}: "${response.text}"`);
    console.log(`  Sentiment: ${response.sentiment}, Intent: ${response.purchaseIntent}/10, Time: ${time}ms\n`);
    
    if (!results.responses[segment]) results.responses[segment] = {};
    results.responses[segment].basic = {
      text: response.text,
      sentiment: response.sentiment,
      purchaseIntent: response.purchaseIntent,
      responseTime: time
    };
  }
  
  // Test 2: Advanced Semantic Engine
  if (process.env.OPENAI_API_KEY) {
    console.log('\n2. ADVANCED SEMANTIC ENGINE');
    console.log('---------------------------');
    
    try {
      const advancedEngine = await getAdvancedSemanticEngine();
      
      for (const segment of segments) {
        const start = Date.now();
        const response = await advancedEngine.generateAdvancedResponse(patagoniaAd, segment);
        const time = Date.now() - start;
        
        console.log(`${segment}: "${response.text}"`);
        console.log(`  Sentiment: ${response.sentiment}, Intent: ${response.purchaseIntent}/10, Time: ${time}ms\n`);
        
        results.responses[segment].advanced = {
          text: response.text,
          sentiment: response.sentiment,
          purchaseIntent: response.purchaseIntent,
          responseTime: time
        };
      }
    } catch (error) {
      console.error('Advanced Semantic Engine error:', error.message);
    }
  }
  
  // Test 3: Claude Pipeline (optional due to cost)
  if (process.env.ANTHROPIC_API_KEY && process.env.TEST_CLAUDE === 'true') {
    console.log('\n3. CLAUDE OPUS 4.1 PIPELINE');
    console.log('----------------------------');
    
    try {
      const claudeEngine = await getIntegratedPersonaEngineV2();
      
      for (const segment of segments) {
        const start = Date.now();
        const response = await claudeEngine.generateEnhancedResponse(patagoniaAd, segment);
        const time = Date.now() - start;
        
        console.log(`${segment}: "${response.text}"`);
        console.log(`  Sentiment: ${response.sentiment}, Intent: ${response.purchaseIntent}/10, Time: ${time}ms\n`);
        
        results.responses[segment].claude = {
          text: response.text,
          sentiment: response.sentiment,
          purchaseIntent: response.purchaseIntent,
          responseTime: time
        };
      }
    } catch (error) {
      console.error('Claude Pipeline error:', error.message);
    }
  } else {
    console.log('\n(Claude Pipeline skipped - set TEST_CLAUDE=true to enable)\n');
  }
  
  // Save results
  const outputPath = path.join(__dirname, 'test-results', 'patagonia-ad-results.json');
  await fs.mkdir(path.join(__dirname, 'test-results'), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
  
  console.log('============================================');
  console.log('RESULTS SAVED TO:', outputPath);
  console.log('============================================');
  
  // Close vector store
  await vectorStore.close();
}

// Run tests
testAllApproaches().catch(console.error);