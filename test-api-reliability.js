/**
 * Test script to verify Claude API reliability improvements
 */

import fetch from 'node-fetch';

async function testApiReliability() {
  console.log('=== Testing Claude API Reliability ===');
  console.log('This will test the improved retry logic and rate limiting');
  console.log('');
  
  const marketingContent = 'New eco-friendly water bottle made from 100% recycled materials. Keeps drinks cold for 24 hours. Available in 5 colors. Price: $29.99';
  
  try {
    console.log('Sending request to API...');
    console.log('Request will generate 5 responses per segment (20 total)');
    console.log('');
    
    const response = await fetch('http://localhost:3000/api/dual-engine-response', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: marketingContent,
        contentType: 'text',
        segments: ['Leader', 'Leaning', 'Learner', 'Laggard'],
        responseCount: 5
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Analyze results
    console.log('=== RESULTS ===');
    console.log('');
    
    // Check if we got responses
    if (!data || !data.claude) {
      console.error('No Claude responses received!');
      console.log('Response data:', JSON.stringify(data, null, 2));
      return;
    }
    
    let totalResponses = 0;
    let failedResponses = 0;
    let successfulResponses = 0;
    
    // Group responses by segment
    const responsesBySegment = {};
    for (const response of data.claude) {
      if (!responsesBySegment[response.segment]) {
        responsesBySegment[response.segment] = [];
      }
      responsesBySegment[response.segment].push(response);
    }
    
    for (const segment of Object.keys(responsesBySegment)) {
      const responses = responsesBySegment[segment];
      console.log(`\n${segment} segment (${responses.length} responses):`);
      
      responses.forEach((response, index) => {
        totalResponses++;
        if (response.text && response.text.startsWith('NA - Claude API failed')) {
          failedResponses++;
          console.log(`  Response ${index + 1}: FAILED - ${response.text}`);
        } else {
          successfulResponses++;
          console.log(`  Response ${index + 1}: SUCCESS - ${response.text.substring(0, 50)}...`);
        }
      });
    }
    
    // Summary statistics
    console.log('\n=== SUMMARY ===');
    console.log(`Total responses: ${totalResponses}`);
    console.log(`Successful: ${successfulResponses} (${((successfulResponses/totalResponses) * 100).toFixed(1)}%)`);
    console.log(`Failed: ${failedResponses} (${((failedResponses/totalResponses) * 100).toFixed(1)}%)`);
    
    if (failedResponses === 0) {
      console.log('\nEXCELLENT! All API calls succeeded with retry logic.');
    } else if (failedResponses < totalResponses * 0.2) {
      console.log('\nGOOD! Less than 20% failure rate with retry logic.');
    } else {
      console.log('\nNEEDS IMPROVEMENT: High failure rate despite retry logic.');
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testApiReliability();