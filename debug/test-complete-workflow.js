// Test Complete End-to-End Digital Twins Pipeline Workflow
// This script tests the full integration: 7-step pipeline → three-stage analysis → digital twin generation

const baseUrl = 'http://localhost:3011';

async function testCompleteWorkflow() {
    console.log('🧪 TESTING COMPLETE END-TO-END DIGITAL TWINS PIPELINE');
    console.log('=' .repeat(60));
    
    try {
        // Test 1: Health Check
        console.log('\n📍 Step 1: Health Check');
        const healthResponse = await fetch(`${baseUrl}/api/health`);
        const healthData = await healthResponse.json();
        console.log('✅ Health check:', healthData.status);
        
        // Test 2: Get available datasets
        console.log('\n📍 Step 2: Available Datasets');
        const datasetsResponse = await fetch(`${baseUrl}/api/upload-datasets`);
        const datasets = await datasetsResponse.json();
        console.log('✅ Found datasets:', datasets.length);
        datasets.forEach(d => console.log(`   - ${d.name} (ID: ${d.id})`));
        
        // Test 3: Run 7-Step Data Wrangling Pipeline
        console.log('\n📍 Step 3: 7-Step Data Wrangling Pipeline');
        const steps = [
            'debug_environment',
            'load_file', 
            'analyze_structure',
            'get_llm_analysis',
            'apply_wrangling_plan',
            'run_improved_pipeline',
            'validate_output'
        ];
        
        const stepResults = {};
        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            console.log(`   🔄 Running step ${i+1}/7: ${step}`);
            
            const stepResponse = await fetch(`${baseUrl}/api/debug-data-wrangling`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    documentId: '1', 
                    step: step 
                })
            });
            
            const stepResult = await stepResponse.json();
            stepResults[step] = stepResult;
            
            if (stepResult.success) {
                console.log(`   ✅ Step ${i+1}/7 completed: ${step}`);
                if (stepResult.details) {
                    console.log(`      Details: ${stepResult.details}`);
                }
            } else {
                console.log(`   ❌ Step ${i+1}/7 failed: ${step}`);
                console.log(`      Error: ${stepResult.error}`);
                break;
            }
        }
        
        // Test 4: Three-Stage Analysis
        console.log('\n📍 Step 4: Three-Stage Analysis');
        const analysisResponse = await fetch(`${baseUrl}/api/three-stage-analysis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documentId: '1' })
        });
        
        const analysisResult = await analysisResponse.json();
        if (analysisResult.success) {
            console.log('✅ Three-stage analysis completed');
            console.log(`   Digital twin ready: ${analysisResult.digital_twin_ready}`);
        } else {
            console.log('❌ Three-stage analysis failed');
        }
        
        // Test 5: Digital Twin Generation
        console.log('\n📍 Step 5: Digital Twin Generation');
        const twinResponse = await fetch(`${baseUrl}/api/universal-digital-twin-response`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                datasetId: 1001,
                questionText: "What are your thoughts on baby care products?"
            })
        });
        
        const twinResult = await twinResponse.json();
        if (twinResult.success) {
            console.log('✅ Digital twin generation completed');
            console.log(`   Responses generated: ${twinResult.responses ? twinResult.responses.length : 0}`);
        } else {
            console.log('❌ Digital twin generation failed');
            console.log(`   Error: ${twinResult.error || 'Unknown error'}`);
        }
        
        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('🎯 WORKFLOW TEST SUMMARY:');
        console.log(`✅ 7-Step Pipeline: ${Object.keys(stepResults).length}/7 steps completed`);
        console.log(`✅ Three-Stage Analysis: ${analysisResult.success ? 'PASSED' : 'FAILED'}`);  
        console.log(`✅ Digital Twin Generation: ${twinResult.success ? 'PASSED' : 'FAILED'}`);
        
        const allPassed = Object.values(stepResults).every(r => r.success) && 
                         analysisResult.success && 
                         twinResult.success;
                         
        console.log(`\n🏆 COMPLETE PIPELINE STATUS: ${allPassed ? 'FULLY FUNCTIONAL' : 'NEEDS ATTENTION'}`);
        
        return {
            pipelineSteps: stepResults,
            threeStageAnalysis: analysisResult,
            digitalTwin: twinResult,
            overallSuccess: allPassed
        };
        
    } catch (error) {
        console.error('❌ Workflow test failed:', error.message);
        return { error: error.message, overallSuccess: false };
    }
}

// Run the test
testCompleteWorkflow()
    .then(results => {
        console.log('\n📊 TEST RESULTS STORED');
        process.exit(results.overallSuccess ? 0 : 1);
    })
    .catch(error => {
        console.error('❌ Test execution failed:', error);
        process.exit(1);
    });