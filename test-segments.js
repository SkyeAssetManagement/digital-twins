import fetch from 'node-fetch';

async function testSegmentResponses() {
  const testContent = "Check out our new eco-friendly surf gear made from recycled ocean plastics. 20% off this week!";
  
  console.log("Testing segment responses with content:");
  console.log(testContent);
  console.log("\nSending request to server...\n");
  
  try {
    const response = await fetch('http://localhost:3000/api/generate-response', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        marketingContent: testContent,
        datasetId: 'surf-clothing',
        segments: ['Leader', 'Leaning', 'Learner', 'Laggard']
      })
    });
    
    const data = await response.json();
    
    if (!data.success) {
      console.error("Error from API:", data);
      return;
    }
    
    console.log("=".repeat(80));
    console.log("SEGMENT RESPONSES TEST RESULTS");
    console.log("=".repeat(80));
    
    // Check if responses are different
    const responses = data.responses.map(r => r.response);
    const uniqueResponses = new Set(responses);
    
    if (uniqueResponses.size === 1) {
      console.log("\n[FAILED] All segments returned IDENTICAL responses!");
      console.log("Response:", responses[0]);
    } else {
      console.log("\n[SUCCESS] Segments returned DIFFERENT responses!");
    }
    
    console.log("\nDetailed Results:");
    console.log("-".repeat(80));
    
    data.responses.forEach(r => {
      console.log(`\nSegment: ${r.segment} (${r.persona?.description || 'N/A'})`);
      console.log(`Sentiment: ${r.sentiment}, Purchase Intent: ${r.purchaseIntent}/10`);
      console.log(`Response: "${r.response}"`);
      console.log("-".repeat(80));
    });
    
    // Show aggregate metrics
    console.log("\nAggregate Metrics:");
    console.log(`Average Purchase Intent: ${data.aggregateMetrics.avgPurchaseIntent}`);
    console.log(`Sentiment Distribution:`, data.aggregateMetrics.sentimentDistribution);
    
  } catch (error) {
    console.error("Failed to test:", error);
  }
}

testSegmentResponses();