import { DatasetAwareResponseEngine } from './src/digital_twins/response_engine.js';
import { VectorStore } from './src/vector_db/vector_store.js';

// Test the response engine directly without the server
async function testDirectResponses() {
  const testContent = "Check out our new eco-friendly surf gear made from recycled ocean plastics. 20% off this week!";
  
  console.log("Testing segment responses DIRECTLY (bypassing server)");
  console.log("Test content:", testContent);
  console.log("\n" + "=".repeat(80));
  
  // Create test twins for each segment
  const segments = [
    { 
      id: 'leader_1',
      segment: 'Leader',
      persona: { name: 'LOHAS Leader', description: '12.4% of market' },
      valueSystem: { sustainability: 0.95, price: 0.3, brandLoyalty: 0.8, quality: 0.9 }
    },
    { 
      id: 'leaning_1',
      segment: 'Leaning',
      persona: { name: 'LOHAS Leaning', description: '22.6% of market' },
      valueSystem: { sustainability: 0.7, price: 0.6, brandLoyalty: 0.6, quality: 0.8 }
    },
    { 
      id: 'learner_1',
      segment: 'Learner',
      persona: { name: 'LOHAS Learner', description: '37.5% of market' },
      valueSystem: { sustainability: 0.4, price: 0.85, brandLoyalty: 0.4, quality: 0.6 }
    },
    { 
      id: 'laggard_1',
      segment: 'Laggard',
      persona: { name: 'LOHAS Laggard', description: '27.5% of market' },
      valueSystem: { sustainability: 0.1, price: 0.95, brandLoyalty: 0.3, quality: 0.5 }
    }
  ];
  
  const vectorStore = new VectorStore('test');
  await vectorStore.initialize();
  
  const responses = [];
  
  for (const twin of segments) {
    const engine = new DatasetAwareResponseEngine(twin, vectorStore);
    const response = await engine.generateResponse(testContent);
    responses.push({
      segment: twin.segment,
      response: response.text,
      sentiment: response.sentiment,
      purchaseIntent: response.purchaseIntent
    });
  }
  
  // Check uniqueness
  const uniqueTexts = new Set(responses.map(r => r.response));
  
  console.log("\nRESULTS:");
  console.log("=".repeat(80));
  
  if (uniqueTexts.size === 1) {
    console.log("\n[FAILED] All segments returned IDENTICAL responses!");
    console.log("The single response was:", responses[0].response);
  } else if (uniqueTexts.size === segments.length) {
    console.log("\n[SUCCESS] All segments returned UNIQUE responses!");
  } else {
    console.log(`\n[PARTIAL] ${uniqueTexts.size} unique responses out of ${segments.length} segments`);
  }
  
  console.log("\nDetailed segment responses:");
  console.log("-".repeat(80));
  
  responses.forEach(r => {
    console.log(`\n${r.segment}:`);
    console.log(`  Sentiment: ${r.sentiment}, Purchase Intent: ${r.purchaseIntent}`);
    console.log(`  Response: "${r.response}"`);
  });
  
  // Show which segments have identical responses
  if (uniqueTexts.size < segments.length) {
    console.log("\n" + "-".repeat(80));
    console.log("Duplicate analysis:");
    const responseGroups = {};
    responses.forEach(r => {
      if (!responseGroups[r.response]) {
        responseGroups[r.response] = [];
      }
      responseGroups[r.response].push(r.segment);
    });
    
    Object.entries(responseGroups).forEach(([response, segments]) => {
      if (segments.length > 1) {
        console.log(`\nSegments with identical response: ${segments.join(', ')}`);
        console.log(`Response: "${response.substring(0, 100)}..."`);
      }
    });
  }
}

testDirectResponses().catch(console.error);