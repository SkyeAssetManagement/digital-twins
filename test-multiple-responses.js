/**
 * Test script for multiple response generation
 */

async function testMultipleResponses() {
  const testContent = `
    Rip Curl Premium Wetsuit Collection
    
    Experience ultimate performance with our latest E-Bomb series.
    Premium Japanese limestone neoprene provides superior warmth and flexibility.
    Designed for serious surfers who demand the best.
    
    Now featuring:
    - E7 Thermo Lining technology
    - Sealed seam construction
    - Strategic panel design for maximum mobility
    
    Available at select retailers.
    Price: $549
  `;
  
  try {
    console.log('Testing multiple response generation...\n');
    
    const response = await fetch('http://localhost:3000/api/dual-engine-response', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: testContent,
        contentType: 'text',
        segments: ['Leader'], // Test with one segment first
        responseCount: 3 // Request 3 responses
      })
    });
    
    const data = await response.json();
    
    console.log('=== SEMANTIC ENGINE RESPONSES ===');
    if (data.semantic && Array.isArray(data.semantic)) {
      console.log(`Generated ${data.semantic.length} semantic responses:\n`);
      data.semantic.forEach((resp, idx) => {
        console.log(`Response ${idx + 1}:`);
        console.log(`Text: ${resp.text.substring(0, 100)}...`);
        console.log(`Sentiment: ${resp.sentiment}`);
        console.log(`Purchase Intent: ${resp.purchaseIntent}/10`);
        console.log(`Time: ${resp.responseTime}ms\n`);
      });
    } else {
      console.log('No semantic responses generated');
    }
    
    console.log('=== CLAUDE ENGINE RESPONSES ===');
    if (data.claude && Array.isArray(data.claude)) {
      console.log(`Generated ${data.claude.length} Claude responses:\n`);
      data.claude.forEach((resp, idx) => {
        console.log(`Response ${idx + 1}:`);
        console.log(`Text: ${resp.text.substring(0, 100)}...`);
        console.log(`Sentiment: ${resp.sentiment}`);
        console.log(`Purchase Intent: ${resp.purchaseIntent}/10`);
        console.log(`Time: ${resp.responseTime}ms\n`);
      });
    } else {
      console.log('No Claude responses generated');
    }
    
    // Check for uniqueness
    if (data.semantic && data.semantic.length > 1) {
      const uniqueSemantic = new Set(data.semantic.map(r => r.text)).size;
      console.log(`Semantic response uniqueness: ${uniqueSemantic}/${data.semantic.length} unique responses`);
    }
    
    if (data.claude && data.claude.length > 1) {
      const uniqueClaude = new Set(data.claude.map(r => r.text)).size;
      console.log(`Claude response uniqueness: ${uniqueClaude}/${data.claude.length} unique responses`);
    }
    
    if (data.stats) {
      console.log('\n=== STATISTICS ===');
      console.log(`Total responses: ${data.stats.totalResponses}`);
      console.log(`Avg semantic time: ${data.stats.avgSemanticTime}ms`);
      console.log(`Avg Claude time: ${data.stats.avgClaudeTime}ms`);
      console.log(`Estimated cost: Semantic $${data.stats.estimatedCost.semantic}, Claude $${data.stats.estimatedCost.claude}`);
    }
    
  } catch (error) {
    console.error('Error testing responses:', error);
  }
}

// Run the test
testMultipleResponses();