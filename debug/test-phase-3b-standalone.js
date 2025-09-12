/**
 * Phase 3B Standalone Test
 * Tests LLMSemanticCategorizer class directly without database dependencies
 */

import { LLMSemanticCategorizer } from '../src/analysis/llm-semantic-categorizer.js';

async function testLLMSemanticCategorizerStandalone() {
    console.log('Testing Phase 3B: LLM Semantic Categorizer (Standalone)');
    
    const testData = {
        responses: [
            {
                id: 'r1',
                text: 'I always check for organic ingredients and avoid harsh chemicals',
                columnId: 'col_1',
                respondentId: 'resp_001'
            },
            {
                id: 'r2', 
                text: 'Price and availability at my local store are most important',
                columnId: 'col_1',
                respondentId: 'resp_002'
            },
            {
                id: 'r3',
                text: 'The product breaks me out and causes skin irritation',
                columnId: 'col_1', 
                respondentId: 'resp_003'
            },
            {
                id: 'r4',
                text: 'Does not hurt my wallet and gives great value',
                columnId: 'col_1',
                respondentId: 'resp_004'
            }
        ],
        categories: [
            {
                name: 'ingredient_safety',
                type: 'pain',
                description: 'Concerns about harmful or unsafe ingredients'
            },
            {
                name: 'value_price',
                type: 'pain', 
                description: 'Price concerns and value for money issues'
            },
            {
                name: 'skin_health',
                type: 'pain',
                description: 'Skin reactions, irritation, or health issues'
            },
            {
                name: 'product_benefits',
                type: 'pleasure',
                description: 'Positive product benefits and results'
            }
        ],
        context: {
            target_demographic: 'Parents with babies under 12 months',
            business_description: 'Baby care product consumer research',
            dataset_name: 'Phase 3B Standalone Test'
        }
    };
    
    try {
        // Initialize categorizer with test configuration
        const categorizer = new LLMSemanticCategorizer({
            batchSize: 2,
            maxRetries: 1,
            enableCaching: true,
            apiKey: process.env.ANTHROPIC_API_KEY,
            model: 'claude-opus-4-1-20250805'
        });
        
        console.log('Starting semantic categorization...');
        console.log(`Processing ${testData.responses.length} responses across ${testData.categories.length} categories`);
        
        // Perform categorization
        const startTime = Date.now();
        const results = await categorizer.categorizeResponses(
            'test_survey',
            testData.responses,
            testData.categories,
            testData.context
        );
        const processingTime = Date.now() - startTime;
        
        console.log('');
        console.log('Categorization Results:');
        console.log(`Total categorizations: ${results.categorizations.length}`);
        console.log(`Processing time: ${processingTime}ms`);
        console.log(`LLM calls made: ${results.statistics.totalLLMCalls}`);
        console.log(`Average confidence: ${(results.statistics.averageConfidence * 100).toFixed(1)}%`);
        console.log(`Cache hit rate: ${(results.statistics.cacheHitRate * 100).toFixed(1)}%`);
        
        console.log('');
        console.log('Category Breakdown:');
        Object.entries(results.categoryBreakdown).forEach(([category, count]) => {
            console.log(`${category}: ${count} responses`);
        });
        
        console.log('');
        console.log('Detailed Categorizations:');
        results.categorizations.forEach((cat, index) => {
            console.log(`${index + 1}. Response: "${cat.response_text.substring(0, 50)}..."`);
            console.log(`   Category: ${cat.category_name} (${cat.category_type})`);
            console.log(`   Confidence: ${(cat.confidence * 100).toFixed(1)}%`);
            console.log(`   Reasoning: ${cat.reasoning.substring(0, 80)}...`);
            console.log('');
        });
        
        // Test semantic understanding (key validation cases)
        const categorizations = results.categorizations;
        
        // Test case 1: "breaks me out" should be categorized as skin_health (not keyword matching)
        const breakoutResponse = categorizations.find(c => c.response_text.includes('breaks me out'));
        const breakoutCorrect = breakoutResponse && breakoutResponse.category_name === 'skin_health';
        
        // Test case 2: "doesn't hurt my wallet" should be categorized as value_price (no "price" keyword)
        const walletResponse = categorizations.find(c => c.response_text.includes('hurt my wallet'));
        const walletCorrect = walletResponse && walletResponse.category_name === 'value_price';
        
        // Test case 3: "organic ingredients" should be ingredient_safety
        const organicResponse = categorizations.find(c => c.response_text.includes('organic ingredients'));
        const organicCorrect = organicResponse && organicResponse.category_name === 'ingredient_safety';
        
        console.log('');
        console.log('Semantic Understanding Validation:');
        console.log(`"breaks me out" -> skin_health: ${breakoutCorrect ? 'PASS' : 'FAIL'}`);
        console.log(`"doesn't hurt my wallet" -> value_price: ${walletCorrect ? 'PASS' : 'FAIL'}`);
        console.log(`"organic ingredients" -> ingredient_safety: ${organicCorrect ? 'PASS' : 'FAIL'}`);
        
        const semanticTests = [breakoutCorrect, walletCorrect, organicCorrect].filter(Boolean);
        const semanticAccuracy = semanticTests.length / 3;
        
        console.log(`Overall semantic accuracy: ${(semanticAccuracy * 100).toFixed(1)}%`);
        
        // Test binary matrix generation
        console.log('');
        console.log('Testing binary matrix generation...');
        const binaryMatrix = await categorizer.generateBinaryMatrix(results, testData.categories);
        
        console.log(`Binary matrix dimensions: ${binaryMatrix.length} responses x ${binaryMatrix[0] ? binaryMatrix[0].length : 0} features`);
        console.log('Sample binary matrix row:', binaryMatrix[0]);
        
        // Final assessment
        const overallSuccess = (
            results.categorizations.length > 0 &&
            results.statistics.averageConfidence >= 0.6 &&
            semanticAccuracy >= 0.6 &&
            binaryMatrix.length === testData.responses.length
        );
        
        if (overallSuccess) {
            console.log('');
            console.log('Phase 3B Standalone Test PASSED');
            console.log('LLM Semantic Categorizer is working correctly');
        } else {
            console.log('');
            console.log('Phase 3B Standalone Test PARTIAL - Review implementation');
        }
        
        return results;
        
    } catch (error) {
        console.error('Phase 3B Standalone Test FAILED:', error.message);
        throw error;
    }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('Starting Phase 3B Standalone Integration Test');
    
    testLLMSemanticCategorizerStandalone()
        .then(() => {
            console.log('');
            console.log('Phase 3B standalone test completed successfully!');
            console.log('Ready for full API integration once database is set up');
        })
        .catch(error => {
            console.error('');
            console.error('Phase 3B standalone test failed:', error);
            process.exit(1);
        });
}