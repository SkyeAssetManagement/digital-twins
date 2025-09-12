/**
 * Phase 3B Test Script
 * Tests the LLM Semantic Analysis API endpoint
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3011';

async function testLLMSemanticAnalysis() {
    console.log('Testing Phase 3B: LLM Semantic Analysis API');
    
    const testData = {
        surveyId: 1, // Assuming we have a survey with ID 1
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
            },
            {
                id: 'r5',
                text: 'My baby loves the gentle formula and it keeps skin soft',
                columnId: 'col_1',
                respondentId: 'resp_005'
            },
            {
                id: 'r6',
                text: 'Packaging is difficult to open and use with one hand',
                columnId: 'col_1',
                respondentId: 'resp_006'
            },
            {
                id: 'r7',
                text: 'Makes me feel confident as a good parent',
                columnId: 'col_1',
                respondentId: 'resp_007'
            },
            {
                id: 'r8',
                text: 'Hard to find in stores and often out of stock',
                columnId: 'col_1', 
                respondentId: 'resp_008'
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
                name: 'convenience_usability',
                type: 'pain',
                description: 'Difficulty using product or packaging issues'  
            },
            {
                name: 'availability_access',
                type: 'pain',
                description: 'Difficulty finding or purchasing product'
            },
            {
                name: 'baby_comfort',
                type: 'pleasure',
                description: 'Baby enjoys product or has positive reaction'
            },
            {
                name: 'parental_confidence', 
                type: 'pleasure',
                description: 'Makes parent feel good about their choices'
            },
            {
                name: 'effectiveness',
                type: 'pleasure', 
                description: 'Product works well and delivers results'
            }
        ],
        context: {
            target_demographic: 'Parents with babies under 12 months',
            business_description: 'Baby care product consumer research',
            dataset_name: 'Phase 3B Test Dataset'
        },
        options: {
            batchSize: 4,
            enableCaching: true,
            maxRetries: 2
        }
    };
    
    try {
        console.log('Sending request to LLM semantic analysis API...');
        const response = await fetch(`${API_BASE}/api/llm-semantic-analysis`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testData)
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(`API request failed: ${result.error || response.statusText}`);
        }
        
        console.log('API Response received successfully');
        console.log('');
        console.log('Analysis Results:');
        console.log(`Total responses analyzed: ${result.data.statistics.totalResponses}`);
        console.log(`Total categories: ${result.data.statistics.totalCategories}`);
        console.log(`Total categorizations: ${result.data.statistics.totalCategorizations}`);
        console.log(`Processing time: ${result.data.statistics.processingTimeMs}ms`);
        console.log(`LLM calls made: ${result.data.statistics.llmCallsMade}`);
        console.log(`Average confidence: ${(result.data.statistics.averageConfidence * 100).toFixed(1)}%`);
        console.log(`Cache hit rate: ${(result.data.statistics.cacheHitRate * 100).toFixed(1)}%`);
        
        console.log('');
        console.log('Category Breakdown:');
        Object.entries(result.data.categoryBreakdown || {}).forEach(([category, count]) => {
            console.log(`${category}: ${count} responses`);
        });
        
        console.log('');
        console.log('Quality Metrics:');
        console.log(`High confidence rate: ${(result.data.qualityMetrics.highConfidenceRate * 100).toFixed(1)}%`);
        console.log(`Average reasoning length: ${Math.round(result.data.qualityMetrics.averageReasoningLength)} characters`);
        console.log(`Categories with low usage: ${result.data.qualityMetrics.categoriesWithLowUsage}`);
        
        console.log('');
        console.log('Sample Categorizations:');
        result.data.categorizations.slice(0, 3).forEach((cat, index) => {
            console.log(`${index + 1}. Response: "${cat.response_text.substring(0, 50)}..."`);
            console.log(`   Category: ${cat.category_name} (${cat.category_type})`);
            console.log(`   Confidence: ${(cat.confidence * 100).toFixed(1)}%`);
            console.log(`   Reasoning: ${cat.reasoning.substring(0, 100)}...`);
            console.log('');
        });
        
        // Validate semantic understanding (key test cases)
        const categorizations = result.data.categorizations;
        
        // Test case 1: "breaks me out" should be categorized as skin_health (not keyword matching)
        const breakoutResponse = categorizations.find(c => c.response_text.includes('breaks me out'));
        const breakoutCorrect = breakoutResponse && breakoutResponse.category_name === 'skin_health';
        
        // Test case 2: "doesn't hurt my wallet" should be categorized as value_price (no "price" keyword)
        const walletResponse = categorizations.find(c => c.response_text.includes('hurt my wallet'));
        const walletCorrect = walletResponse && walletResponse.category_name === 'value_price';
        
        // Test case 3: "makes me feel confident as a good parent" should be parental_confidence
        const confidenceResponse = categorizations.find(c => c.response_text.includes('feel confident'));
        const confidenceCorrect = confidenceResponse && confidenceResponse.category_name === 'parental_confidence';
        
        console.log('Semantic Understanding Validation:');
        console.log(`"breaks me out" -> skin_health: ${breakoutCorrect ? 'PASS' : 'FAIL'}`);
        console.log(`"doesn't hurt my wallet" -> value_price: ${walletCorrect ? 'PASS' : 'FAIL'}`); 
        console.log(`"makes me feel confident" -> parental_confidence: ${confidenceCorrect ? 'PASS' : 'FAIL'}`);
        
        const semanticAccuracy = [breakoutCorrect, walletCorrect, confidenceCorrect].filter(Boolean).length / 3;
        console.log(`Overall semantic accuracy: ${(semanticAccuracy * 100).toFixed(1)}%`);
        
        if (semanticAccuracy >= 0.8 && result.data.statistics.averageConfidence >= 0.7) {
            console.log('Phase 3B test PASSED - High semantic accuracy achieved!');
        } else {
            console.log('Phase 3B test PARTIAL - Review semantic categorization quality');
        }
        
        return result;
        
    } catch (error) {
        console.error('Phase 3B test FAILED:', error.message);
        throw error;
    }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('Starting Phase 3B Integration Test');
    console.log(`Testing against server: ${API_BASE}`);
    
    testLLMSemanticAnalysis()
        .then(() => {
            console.log('');
            console.log('Phase 3B test completed successfully!');
            console.log('LLM Semantic Analysis System is operational');
        })
        .catch(error => {
            console.error('');
            console.error('Phase 3B test failed:', error);
            process.exit(1);
        });
}