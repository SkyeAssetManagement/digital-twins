import { DatasetAwareResponseEngine } from './src/digital_twins/response_engine.js';
import { VectorStore } from './src/vector_db/vector_store.js';

// Test with the actual Rip Curl ad script
async function testRipCurlAd() {
  const ripCurlAd = `Title: "The Search"

Scene: A sun-drenched beach with perfect, glassy waves.

(0-5 seconds)
Music: Upbeat, slightly distorted surf rock with a driving beat.
Visuals: A beautiful, bikini-clad woman is lying on the beach, tanning. She lifts her sunglasses as a group of four male surfers walk past her, boards under their arms. She smiles, and they give her a confident nod without breaking their stride.

(5-15 seconds)
Visuals: Quick cuts of the surfers waxing their boards, laughing and joking with each other. The camera focuses on their new Rip Curl boardshorts and wetsuits.

(15-25 seconds)
Visuals: The surfers are in the water, paddling out. Slow-motion shots of them duck-diving under waves, their movements powerful and effortless.

(25-45 seconds)
Visuals: Epic surfing action. Huge aerials, deep barrel rides, and massive turns. The camera captures the spray flying off the waves and the intensity in the surfers' eyes.

(45-55 seconds)
Visuals: The surfers are back on the beach, exhausted but exhilarated. They're sitting on their boards, watching the sunset. The woman from the beginning of the ad approaches them and offers them a beer. They all cheer and take a drink.

(55-60 seconds)
Visuals: A final, epic shot of a surfer riding a massive wave.
Text on screen: Rip Curl. The Ultimate Surfing Company.
Voiceover (deep, masculine voice): Live the search.`;
  
  console.log("Testing Rip Curl Ad Responses");
  console.log("=".repeat(80));
  console.log("Ad Content:");
  console.log(ripCurlAd.substring(0, 200) + "...");
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
  
  console.log("\nSEGMENT RESPONSES TO RIP CURL AD:");
  console.log("=".repeat(80));
  
  for (const twin of segments) {
    const engine = new DatasetAwareResponseEngine(twin, vectorStore);
    const response = await engine.generateResponse(ripCurlAd);
    
    console.log(`\n${twin.segment.toUpperCase()} (${twin.persona.description}):`);
    console.log("-".repeat(40));
    console.log(`Response: "${response.text}"`);
    console.log(`Sentiment: ${response.sentiment} | Purchase Intent: ${response.purchaseIntent}/10`);
  }
  
  console.log("\n" + "=".repeat(80));
  console.log("Analysis Complete!");
}

testRipCurlAd().catch(console.error);