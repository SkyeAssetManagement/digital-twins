/**
 * Test Claude API with the new retry logic
 */

import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';

// Load environment variables
dotenv.config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 30000 // 30 second timeout
});

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 5,
  retryDelays: [1000, 2000, 4000, 8000, 16000],
  requestStagger: 500,
  maxConcurrent: 3
};

async function testWithRetry() {
  const testContent = "Introducing our new eco-friendly running shoes made from recycled ocean plastic.";
  
  console.log('Testing Claude API with retry logic...\n');
  
  // Test both models
  const models = [
    { name: 'Sonnet 4.0', id: 'claude-sonnet-4-20250514' },
    { name: 'Opus 4.1', id: 'claude-opus-4-1-20250805' }
  ];
  
  for (const model of models) {
    console.log(`Testing ${model.name}...`);
    
    let lastError = null;
    for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = RETRY_CONFIG.retryDelays[Math.min(attempt - 1, RETRY_CONFIG.retryDelays.length - 1)];
          console.log(`  Retry attempt ${attempt} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        const startTime = Date.now();
        const response = await anthropic.messages.create({
          model: model.id,
          max_tokens: 150,
          temperature: 0.7,
          messages: [
            {
              role: 'user',
              content: `React to this marketing message: "${testContent}"`
            }
          ],
          system: 'You are a consumer evaluating a product.'
        });
        
        const responseTime = Date.now() - startTime;
        console.log(`  Success! Response time: ${responseTime}ms`);
        console.log(`  Response: ${response.content[0].text.substring(0, 100)}...`);
        console.log(`  Attempts needed: ${attempt + 1}\n`);
        break;
        
      } catch (error) {
        lastError = error;
        console.log(`  Attempt ${attempt + 1} failed: ${error.message}`);
        
        if (error.message && error.message.includes('invalid_api_key')) {
          console.log('  API key error - stopping retries');
          break;
        }
      }
    }
    
    if (lastError) {
      console.log(`  All retries failed for ${model.name}\n`);
    }
  }
}

// Run the test
testWithRetry().catch(console.error);