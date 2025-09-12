/**
 * Phase 3A Test Script
 * Tests the Intelligent Column Detection API endpoint
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3011';

async function testIntelligentColumnDetection() {
    console.log('🧪 Testing Phase 3A: Intelligent Column Detection API');
    
    const testData = {
        surveyData: {
            columns: {
                // Clear open-ended columns
                'If there are any other important aspects that you consider when purchasing baby body products, please outline them: | Open-Ended Response': [
                    'I always check for organic ingredients and avoid harsh chemicals',
                    'Price and availability at my local store are most important',
                    'I prefer Australian made products with natural formulations'
                ],
                'Please explain why: | Open-Ended Response': [
                    'Because safety and gentleness are most important for my baby',
                    'I have had good experiences with this brand in the past',
                    'The price point fits my budget and the quality is good'
                ],
                'Additional comments:': [
                    'Very satisfied with the product overall',
                    'Would definitely recommend to other parents',
                    'Great customer service and support'
                ],
                
                // Question patterns
                'Why do you prefer this brand?': [
                    'Trust and reliability built over years',
                    'Good ingredients that work for my baby',
                    'Affordable price without compromising quality'
                ],
                'What improvements would you suggest?': [
                    'Better packaging that is easier to use',
                    'Lower price point for budget-conscious families',
                    'More variety in product sizes'
                ],
                
                // Categorical columns (should NOT be detected)
                'Age': ['25-34', '35-44', '25-34'],
                'Gender': ['Female', 'Male', 'Female'],
                'Are you currently pregnant?': ['No', 'Yes', 'No'],
                'How many children do you have?': [1, 2, 1],
                
                // Rating columns (should NOT be detected)
                'Overall satisfaction (1-5)': [5, 4, 5],
                'Likelihood to recommend (1-10)': [9, 8, 10]
            }
        },
        context: {
            target_demographic: 'Parents with babies under 12 months',
            business_description: 'Baby care product consumer research',
            dataset_name: 'Phase 3A Test Dataset'
        },
        options: {
            maxLLMCalls: 2,
            minConfidenceThreshold: 0.7,
            includeDebugInfo: true
        }
    };
    
    try {
        console.log('📤 Sending request to intelligent column detection API...');
        const response = await fetch(`${API_BASE}/api/intelligent-column-detection`, {
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
        
        console.log('✅ API Response received successfully');
        console.log('\n📊 Detection Results:');
        console.log(`📈 Total columns analyzed: ${result.data.summary.totalColumns}`);
        console.log(`🎯 Open-ended columns detected: ${result.data.summary.openEndedDetected}`);
        console.log(`📊 Detection rate: ${result.data.summary.detectionRate}%`);
        console.log(`⏱️  Processing time: ${result.data.summary.processingTime}ms`);
        
        console.log('\n🔧 Method Breakdown:');
        console.log(`📋 Header-based detection: ${result.data.methodBreakdown.headerBased} columns`);
        console.log(`🤖 LLM-based detection: ${result.data.methodBreakdown.llmBased} columns`);
        console.log(`💰 Total LLM calls used: ${result.data.methodBreakdown.totalLLMCallsUsed}`);
        
        console.log('\n📝 Detected Columns:');
        result.data.detectionDetails.forEach((col, index) => {
            console.log(`${index + 1}. "${col.column}"`);
            console.log(`   Method: ${col.method}`);
            console.log(`   Confidence: ${col.confidence}`);
            console.log(`   Reasoning: ${col.reasoning}`);
            console.log('');
        });
        
        // Validate expected results
        const expectedOpenEnded = [
            'If there are any other important aspects that you consider when purchasing baby body products, please outline them: | Open-Ended Response',
            'Please explain why: | Open-Ended Response',
            'Additional comments:',
            'Why do you prefer this brand?',
            'What improvements would you suggest?'
        ];
        
        const detectedNames = new Set(result.data.openEndedColumns.map(col => col.column));
        const correctDetections = expectedOpenEnded.filter(col => detectedNames.has(col));
        const accuracy = (correctDetections.length / expectedOpenEnded.length) * 100;
        
        console.log(`🎯 Validation Results:`);
        console.log(`📝 Expected open-ended: ${expectedOpenEnded.length} columns`);
        console.log(`✅ Correctly detected: ${correctDetections.length} columns`);
        console.log(`📊 Accuracy: ${Math.round(accuracy)}%`);
        
        if (accuracy >= 80) {
            console.log('🎉 Phase 3A test PASSED - High accuracy achieved!');
        } else {
            console.log('⚠️  Phase 3A test PARTIAL - Accuracy below 80%');
        }
        
        return result;
        
    } catch (error) {
        console.error('❌ Phase 3A test FAILED:', error.message);
        throw error;
    }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('🚀 Starting Phase 3A Integration Test');
    console.log(`🔗 Testing against server: ${API_BASE}`);
    
    testIntelligentColumnDetection()
        .then(() => {
            console.log('\n🎊 Phase 3A test completed successfully!');
            console.log('✅ Intelligent Column Detection System is operational');
        })
        .catch(error => {
            console.error('\n💥 Phase 3A test failed:', error);
            process.exit(1);
        });
}