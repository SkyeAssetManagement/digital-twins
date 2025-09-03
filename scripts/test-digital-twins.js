import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000/api/digital-twins';

async function testDigitalTwins() {
  console.log('=' + '='.repeat(99));
  console.log('DIGITAL TWIN API TESTING');
  console.log('=' + '='.repeat(99) + '\n');
  
  try {
    // Test 1: Get available personas
    console.log('TEST 1: Getting available personas...');
    console.log('-'.repeat(50));
    
    const personasResponse = await fetch(`${API_URL}/personas`);
    const personas = await personasResponse.json();
    
    if (personas.success) {
      console.log(`Found ${personas.personas.length} personas:`);
      personas.personas.forEach(p => {
        console.log(`  - ${p.name} (${p.marketSize}): ${p.description}`);
      });
    } else {
      throw new Error('Failed to get personas');
    }
    
    // Test 2: Get detailed persona information
    console.log('\n\nTEST 2: Getting detailed persona information...');
    console.log('-'.repeat(50));
    
    const leaderId = 'lohas-leader';
    const leaderResponse = await fetch(`${API_URL}/persona/${leaderId}`);
    const leader = await leaderResponse.json();
    
    if (leader.success) {
      console.log(`LOHAS Leader Details:`);
      console.log(`  Name: ${leader.persona.name}`);
      console.log(`  Key Characteristics:`);
      leader.persona.characteristics.slice(0, 3).forEach(c => {
        console.log(`    - ${c}`);
      });
      console.log(`  Willingness to Pay: ${leader.persona.responseConfig.willingnessToPay.premium}`);
      console.log(`  Conditions: ${leader.persona.responseConfig.willingnessToPay.conditions}`);
    }
    
    // Test 3: Generate persona responses
    console.log('\n\nTEST 3: Generating persona responses to a question...');
    console.log('-'.repeat(50));
    
    const testQuestion = "Would you pay extra for a surf shirt made from recycled ocean plastic?";
    console.log(`Question: "${testQuestion}"\n`);
    
    for (const persona of personas.personas) {
      const responsePayload = {
        personaId: persona.id,
        prompt: testQuestion,
        context: {
          question: testQuestion,
          productType: 'surf shirt',
          scenario: 'purchasing decision'
        }
      };
      
      const response = await fetch(`${API_URL}/generate-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(responsePayload)
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`${persona.name} Response Preview:`);
        const systemPrompt = result.response.systemPrompt;
        const exampleLine = systemPrompt.split('\n').find(l => l.includes('Price question:'));
        if (exampleLine) {
          console.log(`  ${exampleLine.split(':').slice(1).join(':').trim()}`);
        }
        console.log();
      }
    }
    
    // Test 4: Market analysis
    console.log('\n\nTEST 4: Market opportunity analysis...');
    console.log('-'.repeat(50));
    
    const productFeatures = {
      sustainabilityLevel: 'high',
      pricePoint: 'moderate',
      brandAlignment: 'strong'
    };
    
    console.log('Product Features:');
    console.log(`  Sustainability: ${productFeatures.sustainabilityLevel}`);
    console.log(`  Price Point: ${productFeatures.pricePoint}`);
    console.log(`  Brand Alignment: ${productFeatures.brandAlignment}`);
    console.log();
    
    const analysisResponse = await fetch(`${API_URL}/market-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productFeatures })
    });
    
    const analysis = await analysisResponse.json();
    
    if (analysis.success) {
      console.log('Market Analysis Results:');
      console.log(`  Total Market: ${analysis.analysis.totalMarket} respondents`);
      console.log(`  Market Penetration: ${analysis.analysis.marketPenetration}`);
      console.log(`  Total Potential Customers: ${analysis.analysis.totalPotentialCustomers}`);
      console.log(`  Estimated Annual Revenue: $${analysis.analysis.totalEstimatedRevenue.toLocaleString()}`);
      console.log('\n  Segment Breakdown:');
      
      analysis.analysis.segments.forEach(seg => {
        console.log(`    ${seg.segment}: ${seg.appealScore} appeal, ${seg.potentialCustomers} customers`);
      });
    }
    
    // Test 5: Compare responses across personas
    console.log('\n\nTEST 5: Comparing responses across all personas...');
    console.log('-'.repeat(50));
    
    const comparisonPrompt = "How important is sustainability when buying surf clothing?";
    console.log(`Comparison Question: "${comparisonPrompt}"\n`);
    
    const comparisonResponse = await fetch(`${API_URL}/compare-responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: comparisonPrompt,
        context: {
          question: comparisonPrompt,
          productType: 'surf clothing',
          scenario: 'values assessment'
        }
      })
    });
    
    const comparisons = await comparisonResponse.json();
    
    if (comparisons.success) {
      Object.entries(comparisons.comparisons).forEach(([personaId, data]) => {
        console.log(`${data.persona.name}:`);
        const sustainabilityWeight = data.systemPrompt.match(/Sustainability focus: (\d+)%/);
        if (sustainabilityWeight) {
          console.log(`  Sustainability Focus: ${sustainabilityWeight[1]}%`);
        }
      });
    }
    
    console.log('\n' + '='.repeat(100));
    console.log('DIGITAL TWIN TESTING COMPLETE');
    console.log('='.repeat(100));
    
  } catch (error) {
    console.error('Test failed:', error.message);
    console.error('\nMake sure the server is running on port 3000');
  }
}

// Run tests
console.log('Starting Digital Twin API tests...\n');
testDigitalTwins();