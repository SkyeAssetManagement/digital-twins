/**
 * Test Claude API prefill whitespace handling
 */

import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

async function testPrefills() {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });
  
  const testPrefills = [
    'Looking at this, ',  // Has trailing space
    'Looking at this,',   // No trailing space
    'Actually, ',         // Has trailing space
    'Actually,',          // No trailing space
    'I think ',           // Has trailing space
    'I think',            // No trailing space
    '',                   // Empty
    'Hmm',               // No punctuation
  ];
  
  console.log('Testing Claude API with various prefills...\n');
  
  for (const prefill of testPrefills) {
    console.log(`Testing prefill: "${prefill}" (length: ${prefill.length})`);
    
    try {
      // Try the raw prefill first
      const response1 = await client.messages.create({
        model: 'claude-opus-4-1-20250805',
        max_tokens: 50,
        temperature: 0.7,
        system: 'You are a consumer evaluating a product.',
        messages: [
          {
            role: 'user',
            content: 'What do you think about this eco-friendly water bottle?'
          },
          {
            role: 'assistant',
            content: prefill  // Test with raw prefill
          }
        ]
      });
      console.log(`  RAW: SUCCESS - Response starts with: "${response1.content[0].text.substring(0, 30)}..."`);
    } catch (error) {
      console.log(`  RAW: FAILED - ${error.message}`);
      
      // Now try with trimEnd()
      try {
        const trimmedPrefill = prefill.trimEnd();
        console.log(`  Trying trimmed: "${trimmedPrefill}" (length: ${trimmedPrefill.length})`);
        
        const response2 = await client.messages.create({
          model: 'claude-opus-4-1-20250805',
          max_tokens: 50,
          temperature: 0.7,
          system: 'You are a consumer evaluating a product.',
          messages: [
            {
              role: 'user',
              content: 'What do you think about this eco-friendly water bottle?'
            },
            {
              role: 'assistant',
              content: trimmedPrefill  // Test with trimmed prefill
            }
          ]
        });
        console.log(`  TRIMMED: SUCCESS - Response starts with: "${response2.content[0].text.substring(0, 30)}..."`);
      } catch (error2) {
        console.log(`  TRIMMED: ALSO FAILED - ${error2.message}`);
      }
    }
    
    console.log('');
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\nConclusion: Prefills with trailing whitespace must be trimmed before sending to Claude API.');
}

testPrefills().catch(console.error);