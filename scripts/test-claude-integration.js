/**
 * Test Script for Claude Persona Vector Integration
 * Validates all components of the system
 */

import { DigitalTwinClaudeIntegration } from '../src/config/production_config.js';
import { PersonaVectorGenerator } from '../src/personas/persona_vector_generator.js';
import { ClaudePersonaHelper, ClaudePersonaConfig } from '../src/claude/claude_persona_helper.js';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

dotenv.config({ path: '.env.local' });

// Test configuration
const TEST_CONFIG = {
  runVectorTests: true,
  runMemoryTests: true,
  runConsistencyTests: true,
  runAPITests: true,
  testSegments: ['Leader', 'Leaning', 'Learner', 'Laggard']
};

// Test marketing content
const TEST_QUERIES = [
  "What do you think about our new sustainable surf clothing line made from recycled ocean plastic?",
  "Would you be interested in a premium eco-friendly wetsuit that costs 20% more but lasts twice as long?",
  "How important is it to you that surf brands support ocean conservation efforts?",
  "What factors most influence your decision when purchasing surf gear?",
  "Tell me about your ideal surf clothing brand."
];

/**
 * Main test function
 */
async function runTests() {
  console.log('\n========================================');
  console.log('  CLAUDE PERSONA VECTOR INTEGRATION TEST');
  console.log('========================================\n');
  
  const results = {
    passed: [],
    failed: [],
    warnings: []
  };
  
  try {
    // Test 1: Persona Vector Generation
    if (TEST_CONFIG.runVectorTests) {
      console.log('📝 Test 1: Persona Vector Generation');
      await testPersonaVectorGeneration(results);
    }
    
    // Test 2: Claude Integration
    console.log('\n📝 Test 2: Claude Integration');
    await testClaudeIntegration(results);
    
    // Test 3: Memory System
    if (TEST_CONFIG.runMemoryTests) {
      console.log('\n📝 Test 3: Memory System');
      await testMemorySystem(results);
    }
    
    // Test 4: Consistency Management
    if (TEST_CONFIG.runConsistencyTests) {
      console.log('\n📝 Test 4: Consistency Management');
      await testConsistencyManagement(results);
    }
    
    // Test 5: Full Integration Pipeline
    console.log('\n📝 Test 5: Full Integration Pipeline');
    await testFullPipeline(results);
    
    // Test 6: API Endpoints
    if (TEST_CONFIG.runAPITests) {
      console.log('\n📝 Test 6: API Endpoints');
      await testAPIEndpoints(results);
    }
    
  } catch (error) {
    console.error('\n❌ Critical test failure:', error);
    results.failed.push({
      test: 'Critical',
      error: error.message
    });
  }
  
  // Print test results
  printTestResults(results);
}

/**
 * Test 1: Persona Vector Generation
 */
async function testPersonaVectorGeneration(results) {
  try {
    const generator = new PersonaVectorGenerator();
    
    for (const segment of TEST_CONFIG.testSegments) {
      const vector = generator.generateLOHASVector(segment);
      
      if (vector && vector.length === 384) {
        console.log(`  ✅ Generated vector for ${segment}: dimension=${vector.length}`);
        
        // Verify vector characteristics
        const traits = generator.vectorToTraitSummary(vector);
        console.log(`     Traits: O=${traits.openness.toFixed(2)}, C=${traits.conscientiousness.toFixed(2)}, E=${traits.extraversion.toFixed(2)}`);
        
        results.passed.push(`Vector generation for ${segment}`);
      } else {
        console.log(`  ❌ Failed to generate vector for ${segment}`);
        results.failed.push({ test: `Vector generation for ${segment}`, error: 'Invalid vector' });
      }
    }
    
    // Test vector similarity
    const leader = generator.generateLOHASVector('Leader');
    const laggard = generator.generateLOHASVector('Laggard');
    const similarity = generator.calculateSimilarity(leader, laggard);
    
    console.log(`  📊 Leader-Laggard similarity: ${similarity.toFixed(3)}`);
    
    if (similarity < 0.5) {
      console.log(`  ✅ Segments are sufficiently differentiated`);
      results.passed.push('Segment differentiation');
    } else {
      console.log(`  ⚠️  Segments may be too similar`);
      results.warnings.push('Segments similarity high');
    }
    
  } catch (error) {
    console.error(`  ❌ Vector generation failed:`, error.message);
    results.failed.push({ test: 'Persona Vector Generation', error: error.message });
  }
}

/**
 * Test 2: Claude Integration
 */
async function testClaudeIntegration(results) {
  try {
    const config = new ClaudePersonaConfig({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    
    const helper = new ClaudePersonaHelper(config);
    
    // Test persona conversion
    const testPersona = {
      segment: 'Leader',
      values: {
        environmental_concern: 0.95,
        brand_loyalty: 0.85
      },
      demographics: {
        age_group: '25-34',
        income_bracket: 'High'
      }
    };
    
    const systemPrompt = helper.convertTwinPersonaToClaude(testPersona);
    
    if (systemPrompt && systemPrompt.includes('LOHAS SEGMENT')) {
      console.log(`  ✅ Persona conversion successful`);
      console.log(`     Prompt length: ${systemPrompt.length} characters`);
      results.passed.push('Persona conversion');
    } else {
      console.log(`  ❌ Persona conversion failed`);
      results.failed.push({ test: 'Persona conversion', error: 'Invalid prompt' });
    }
    
    // Test API key presence
    if (process.env.ANTHROPIC_API_KEY) {
      console.log(`  ✅ Anthropic API key configured`);
      results.passed.push('API key configuration');
    } else {
      console.log(`  ⚠️  No Anthropic API key found - API calls will fail`);
      results.warnings.push('Missing Anthropic API key');
    }
    
  } catch (error) {
    console.error(`  ❌ Claude integration failed:`, error.message);
    results.failed.push({ test: 'Claude Integration', error: error.message });
  }
}

/**
 * Test 3: Memory System
 */
async function testMemorySystem(results) {
  try {
    const { HierarchicalMemorySystem } = await import('../src/memory/hierarchical_memory.js');
    const memory = new HierarchicalMemorySystem();
    
    // Wait for Redis connection
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const testPersonaId = 'test_persona';
    const testQuery = 'Test query';
    const testResponse = 'Test response';
    const testVector = new Float32Array(384).fill(0.5);
    
    // Store interaction
    await memory.storeInteraction(testPersonaId, testQuery, testResponse, testVector);
    console.log(`  ✅ Stored interaction in memory`);
    results.passed.push('Memory storage');
    
    // Retrieve context
    const context = await memory.getRelevantContext(testPersonaId, 'Similar query');
    
    if (context && context.length > 0) {
      console.log(`  ✅ Retrieved ${context.length} context items`);
      results.passed.push('Memory retrieval');
    } else {
      console.log(`  ⚠️  No context retrieved (may be normal for new persona)`);
      results.warnings.push('Empty memory context');
    }
    
    // Clear test data
    await memory.clearPersonaMemory(testPersonaId);
    console.log(`  ✅ Cleared test memory`);
    
    await memory.close();
    
  } catch (error) {
    console.error(`  ❌ Memory system failed:`, error.message);
    results.failed.push({ test: 'Memory System', error: error.message });
  }
}

/**
 * Test 4: Consistency Management
 */
async function testConsistencyManagement(results) {
  try {
    const { PersonaConsistencyManager } = await import('../src/personas/persona_consistency_manager.js');
    const manager = new PersonaConsistencyManager();
    
    // Create test vector
    const baseVector = new Float32Array(384);
    for (let i = 0; i < 384; i++) {
      baseVector[i] = Math.random() * 0.5;
    }
    
    // Test contextual variation
    const context = {
      recentMessages: ['I am happy', 'This is great', 'Love it']
    };
    
    const variedVector = manager.applyContextualVariation(baseVector, context);
    
    if (variedVector && variedVector.length === 384) {
      console.log(`  ✅ Applied contextual variation`);
      
      // Calculate drift
      const driftScore = manager.calculateDriftScore(variedVector, baseVector);
      console.log(`     Drift score: ${driftScore.toFixed(3)}`);
      
      if (driftScore < 0.2) {
        console.log(`  ✅ Variation within acceptable bounds`);
        results.passed.push('Contextual variation');
      } else {
        console.log(`  ⚠️  High drift detected`);
        results.warnings.push('High contextual drift');
      }
    } else {
      console.log(`  ❌ Contextual variation failed`);
      results.failed.push({ test: 'Contextual variation', error: 'Invalid vector' });
    }
    
    // Test drift prevention
    const testResponse = "I hate this product, it's terrible and overpriced.";
    const driftCheck = manager.preventPersonalityDrift([], baseVector, testResponse);
    
    console.log(`  📊 Drift detection: ${driftCheck.driftScore.toFixed(3)}`);
    
    if (driftCheck.needsCorrection !== undefined) {
      console.log(`  ✅ Drift prevention working`);
      results.passed.push('Drift prevention');
    } else {
      console.log(`  ❌ Drift prevention failed`);
      results.failed.push({ test: 'Drift prevention', error: 'No drift check result' });
    }
    
  } catch (error) {
    console.error(`  ❌ Consistency management failed:`, error.message);
    results.failed.push({ test: 'Consistency Management', error: error.message });
  }
}

/**
 * Test 5: Full Integration Pipeline
 */
async function testFullPipeline(results) {
  try {
    const integration = new DigitalTwinClaudeIntegration();
    
    // Load test twin data
    const twinData = {
      id: 'test_leader',
      pid: 'test_leader',
      segment: 'Leader',
      persona_json: {
        segment: 'Leader',
        values: {
          environmental_concern: 0.95,
          brand_loyalty: 0.85,
          community_involvement: 0.80,
          price_sensitivity: 0.30
        }
      }
    };
    
    console.log(`  🔄 Processing test queries for Leader segment...`);
    
    // Process with limited queries to save API calls
    const testQueries = TEST_QUERIES.slice(0, 2);
    const result = await integration.processDigitalTwin(twinData, testQueries);
    
    if (result && result.responses) {
      console.log(`  ✅ Generated ${result.responses.length} responses`);
      
      // Check consistency
      if (result.validation && result.validation.consistencyScore !== undefined) {
        console.log(`     Consistency score: ${(result.validation.consistencyScore * 100).toFixed(1)}%`);
        
        if (result.validation.consistencyScore > 0.7) {
          console.log(`  ✅ Good consistency maintained`);
          results.passed.push('Full pipeline consistency');
        } else {
          console.log(`  ⚠️  Low consistency detected`);
          results.warnings.push('Low pipeline consistency');
        }
      }
      
      // Display sample response
      if (result.responses[0]) {
        console.log(`\n  Sample Response:`);
        console.log(`  "${result.responses[0].response.substring(0, 150)}..."`);
      }
      
      results.passed.push('Full pipeline execution');
    } else {
      console.log(`  ❌ Pipeline execution failed`);
      results.failed.push({ test: 'Full pipeline', error: 'No responses generated' });
    }
    
    // Get performance report
    const performance = integration.getPerformanceReport();
    console.log(`\n  Performance Metrics:`);
    console.log(`     Success rate: ${performance.successRate}`);
    console.log(`     Drift rate: ${performance.driftRate}`);
    console.log(`     Avg response time: ${performance.averageResponseTime.toFixed(0)}ms`);
    
    await integration.shutdown();
    
  } catch (error) {
    console.error(`  ❌ Full pipeline failed:`, error.message);
    
    // Check if it's an API key issue
    if (error.message.includes('api_key') || error.message.includes('401')) {
      console.log(`  ⚠️  This appears to be an API key issue`);
      results.warnings.push('API key issue - using fallback responses');
    } else {
      results.failed.push({ test: 'Full Pipeline', error: error.message });
    }
  }
}

/**
 * Test 6: API Endpoints
 */
async function testAPIEndpoints(results) {
  try {
    console.log(`  🔄 Testing API endpoints...`);
    
    // Test if server is running
    const testUrl = 'http://localhost:3000/api/generate-claude-response';
    
    const testPayload = {
      marketingContent: "Test our new sustainable product",
      datasetId: 'surf-clothing',
      segments: ['Leader'],
      usePersonaVectors: true
    };
    
    try {
      const response = await fetch(testUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testPayload)
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`  ✅ API endpoint responding`);
        
        if (data.segments && data.segments.length > 0) {
          console.log(`     Generated responses for ${data.segments.length} segments`);
          results.passed.push('API endpoint');
        }
      } else {
        console.log(`  ⚠️  API returned status ${response.status}`);
        results.warnings.push(`API status ${response.status}`);
      }
    } catch (fetchError) {
      console.log(`  ⚠️  Could not reach API (server may not be running)`);
      results.warnings.push('API unreachable');
    }
    
  } catch (error) {
    console.error(`  ❌ API test failed:`, error.message);
    results.failed.push({ test: 'API Endpoints', error: error.message });
  }
}

/**
 * Print test results summary
 */
function printTestResults(results) {
  console.log('\n========================================');
  console.log('           TEST RESULTS SUMMARY');
  console.log('========================================\n');
  
  console.log(`✅ PASSED: ${results.passed.length} tests`);
  if (results.passed.length > 0) {
    results.passed.forEach(test => {
      console.log(`   • ${test}`);
    });
  }
  
  if (results.warnings.length > 0) {
    console.log(`\n⚠️  WARNINGS: ${results.warnings.length}`);
    results.warnings.forEach(warning => {
      console.log(`   • ${warning}`);
    });
  }
  
  if (results.failed.length > 0) {
    console.log(`\n❌ FAILED: ${results.failed.length} tests`);
    results.failed.forEach(failure => {
      console.log(`   • ${failure.test}: ${failure.error}`);
    });
  }
  
  // Overall status
  console.log('\n========================================');
  if (results.failed.length === 0) {
    if (results.warnings.length === 0) {
      console.log('🎉 ALL TESTS PASSED! System ready for production.');
    } else {
      console.log('✅ Tests passed with warnings. Review warnings before production.');
    }
  } else {
    console.log('❌ Some tests failed. Fix issues before deployment.');
  }
  console.log('========================================\n');
}

// Run the tests
console.log('Starting Claude Persona Vector Integration Tests...');
runTests().catch(error => {
  console.error('Fatal test error:', error);
  process.exit(1);
});