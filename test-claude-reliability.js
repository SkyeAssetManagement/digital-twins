/**
 * Test script to determine optimal timeout and retry settings for Claude API
 */

import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 60000 // 60 second timeout per request
});

// Test configuration
const TEST_CONFIG = {
  numTests: 5,
  models: {
    sonnet: 'claude-sonnet-4-20250514',
    opus: 'claude-opus-4-1-20250805'
  },
  retryDelays: [1000, 2000, 4000, 8000, 16000], // Exponential backoff
  maxRetries: 5
};

/**
 * Sleep function for delays
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Test a single API call with retries
 */
async function testAPICall(model, modelName, testNum, retryConfig) {
  const startTime = Date.now();
  let lastError = null;
  
  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      console.log(`[${modelName}] Test ${testNum}, Attempt ${attempt + 1}...`);
      
      const response = await anthropic.messages.create({
        model: model,
        max_tokens: 150,
        temperature: 0.7,
        messages: [{
          role: 'user',
          content: `As a consumer, what's your reaction to this product: Premium wireless headphones with noise cancellation, 30-hour battery, $299. Keep response under 50 words. Test ${testNum}.`
        }]
      });
      
      const elapsed = Date.now() - startTime;
      console.log(`✅ [${modelName}] Test ${testNum} succeeded in ${elapsed}ms after ${attempt + 1} attempts`);
      
      return {
        success: true,
        model: modelName,
        testNum,
        attempts: attempt + 1,
        totalTime: elapsed,
        response: response.content[0].text
      };
      
    } catch (error) {
      lastError = error;
      const elapsed = Date.now() - startTime;
      
      console.log(`❌ [${modelName}] Test ${testNum}, Attempt ${attempt + 1} failed after ${elapsed}ms`);
      console.log(`   Error: ${error.message}`);
      
      // Check if it's a rate limit error
      if (error.status === 429 || error.message.includes('rate')) {
        const delay = retryConfig.retryDelays[Math.min(attempt, retryConfig.retryDelays.length - 1)];
        console.log(`   Rate limited. Waiting ${delay}ms before retry...`);
        await sleep(delay);
      } else if (error.status === 504 || error.message.includes('timeout')) {
        const delay = retryConfig.retryDelays[Math.min(attempt, retryConfig.retryDelays.length - 1)];
        console.log(`   Timeout. Waiting ${delay}ms before retry...`);
        await sleep(delay);
      } else if (attempt < retryConfig.maxRetries) {
        // For other errors, use shorter delay
        const delay = 1000;
        console.log(`   Other error. Waiting ${delay}ms before retry...`);
        await sleep(delay);
      }
    }
  }
  
  const totalElapsed = Date.now() - startTime;
  console.log(`❌❌ [${modelName}] Test ${testNum} FAILED after all retries. Total time: ${totalElapsed}ms`);
  
  return {
    success: false,
    model: modelName,
    testNum,
    attempts: retryConfig.maxRetries + 1,
    totalTime: totalElapsed,
    error: lastError?.message || 'Unknown error'
  };
}

/**
 * Run parallel tests for a model
 */
async function testModel(model, modelName) {
  console.log(`\n🔬 Testing ${modelName}...`);
  console.log('=' .repeat(50));
  
  const promises = [];
  
  for (let i = 1; i <= TEST_CONFIG.numTests; i++) {
    // Add staggered start to avoid immediate rate limiting
    await sleep(500 * i);
    
    promises.push(testAPICall(model, modelName, i, {
      maxRetries: TEST_CONFIG.maxRetries,
      retryDelays: TEST_CONFIG.retryDelays
    }));
  }
  
  const results = await Promise.all(promises);
  
  // Analyze results
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`\n📊 ${modelName} Results:`);
  console.log(`   Success rate: ${successful.length}/${TEST_CONFIG.numTests} (${(successful.length/TEST_CONFIG.numTests*100).toFixed(1)}%)`);
  
  if (successful.length > 0) {
    const avgTime = successful.reduce((sum, r) => sum + r.totalTime, 0) / successful.length;
    const avgAttempts = successful.reduce((sum, r) => sum + r.attempts, 0) / successful.length;
    console.log(`   Avg success time: ${avgTime.toFixed(0)}ms`);
    console.log(`   Avg attempts needed: ${avgAttempts.toFixed(1)}`);
  }
  
  if (failed.length > 0) {
    console.log(`   Failed tests: ${failed.map(f => f.testNum).join(', ')}`);
    console.log(`   Failure reasons:`);
    failed.forEach(f => {
      console.log(`     Test ${f.testNum}: ${f.error}`);
    });
  }
  
  return results;
}

/**
 * Test concurrent requests
 */
async function testConcurrency() {
  console.log('\n🚀 Testing Concurrent Requests...');
  console.log('=' .repeat(50));
  
  const startTime = Date.now();
  
  // Test both models in parallel
  const [sonnetResults, opusResults] = await Promise.all([
    testModel(TEST_CONFIG.models.sonnet, 'Sonnet 4.0'),
    testModel(TEST_CONFIG.models.opus, 'Opus 4.1')
  ]);
  
  const totalTime = Date.now() - startTime;
  
  console.log('\n' + '=' .repeat(50));
  console.log('📈 OVERALL RESULTS');
  console.log('=' .repeat(50));
  
  const allResults = [...sonnetResults, ...opusResults];
  const totalSuccess = allResults.filter(r => r.success).length;
  const totalTests = allResults.length;
  
  console.log(`Total success rate: ${totalSuccess}/${totalTests} (${(totalSuccess/totalTests*100).toFixed(1)}%)`);
  console.log(`Total test time: ${(totalTime/1000).toFixed(1)}s`);
  
  // Recommendations
  console.log('\n💡 RECOMMENDATIONS:');
  console.log('=' .repeat(50));
  
  const maxTime = Math.max(...allResults.filter(r => r.success).map(r => r.totalTime));
  const avgRetries = allResults.filter(r => r.success).reduce((sum, r) => sum + r.attempts, 0) / totalSuccess;
  
  console.log(`1. Set request timeout to: ${Math.ceil(maxTime * 1.5)}ms (1.5x max observed)`);
  console.log(`2. Set max retries to: ${Math.ceil(avgRetries + 2)}`);
  console.log(`3. Use exponential backoff with delays: [1000, 2000, 4000, 8000, 16000]ms`);
  console.log(`4. Add ${TEST_CONFIG.numTests * 500}ms stagger between parallel requests`);
  console.log(`5. Consider implementing request queuing with max concurrent: 3-5`);
  
  if (opusResults.filter(r => !r.success).length > sonnetResults.filter(r => !r.success).length) {
    console.log(`6. ⚠️ Opus 4.1 has higher failure rate - needs longer timeouts and more retries`);
  }
}

/**
 * Test rate limiting thresholds
 */
async function testRateLimits() {
  console.log('\n🔥 Testing Rate Limit Thresholds...');
  console.log('=' .repeat(50));
  
  let requestCount = 0;
  let rateLimitHit = false;
  const startTime = Date.now();
  
  // Fire requests rapidly until we hit rate limit
  while (!rateLimitHit && requestCount < 20) {
    try {
      requestCount++;
      console.log(`Request ${requestCount}...`);
      
      await anthropic.messages.create({
        model: TEST_CONFIG.models.sonnet,
        max_tokens: 10,
        messages: [{
          role: 'user',
          content: 'Say "test"'
        }]
      });
      
      // No delay - testing rate limit
    } catch (error) {
      if (error.status === 429 || error.message.includes('rate')) {
        rateLimitHit = true;
        const elapsed = Date.now() - startTime;
        console.log(`\n⚠️ Rate limit hit after ${requestCount} requests in ${elapsed}ms`);
        console.log(`   Avg rate: ${(requestCount / elapsed * 1000).toFixed(1)} requests/second`);
        console.log(`   Recommended: Keep below ${Math.floor(requestCount * 0.8)} requests per ${elapsed}ms`);
      }
    }
  }
  
  if (!rateLimitHit) {
    console.log(`✅ No rate limit hit after ${requestCount} rapid requests`);
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('🧪 Claude API Reliability Testing');
  console.log('=' .repeat(50));
  console.log(`API Key configured: ${!!process.env.ANTHROPIC_API_KEY}`);
  console.log(`Models to test: Sonnet 4.0, Opus 4.1`);
  console.log(`Tests per model: ${TEST_CONFIG.numTests}`);
  console.log(`Max retries: ${TEST_CONFIG.maxRetries}`);
  console.log(`Retry delays: ${TEST_CONFIG.retryDelays.join(', ')}ms`);
  
  try {
    // Test concurrent requests (main test)
    await testConcurrency();
    
    // Test rate limits
    await sleep(5000); // Wait to avoid rate limit from previous test
    await testRateLimits();
    
    console.log('\n✅ Testing complete!');
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
  }
}

// Run tests
runTests();