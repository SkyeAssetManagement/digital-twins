// Test Complete Pipeline: 7-Step → Three-Stage Analysis with Real Data
// This script runs the full pipeline to ensure real data flows through

const baseUrl = 'http://localhost:3011';

async function testCompletePipelineWithRealData() {
    console.log('🧪 TESTING COMPLETE PIPELINE WITH REAL DATA FLOW');
    console.log('=' .repeat(70));
    
    try {
        // Step 1: Run 7-Step Pipeline to generate processed data
        console.log('\n🔧 PHASE 1: Running 7-Step Data Wrangling Pipeline');
        console.log('-'.repeat(50));
        
        const steps = [
            'debug_environment',
            'load_file', 
            'analyze_structure',
            'get_llm_analysis',
            'apply_wrangling_plan',
            'run_improved_pipeline',
            'validate_output'
        ];
        
        let pipelineResults = {};
        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            console.log(`   🔄 Step ${i+1}/7: ${step}`);
            
            const response = await fetch(`${baseUrl}/api/debug-data-wrangling`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    documentId: '1', 
                    step: step,
                    previousResult: pipelineResults[steps[i-1]] || null
                })
            });
            
            const result = await response.json();
            pipelineResults[step] = result.result;
            
            if (result.success) {
                console.log(`   ✅ ${step} completed`);
                if (step === 'get_llm_analysis' && result.result?.fromCache) {
                    console.log(`   ⚡ Used cached results (fast!)`);
                }
                if (result.result?.totalColumnsProcessed) {
                    console.log(`   📊 Processed ${result.result.totalColumnsProcessed} columns`);
                }
            } else {
                console.log(`   ❌ ${step} failed: ${result.error}`);
                break;
            }
        }
        
        console.log(`\n✅ 7-Step Pipeline Complete`);
        const finalStep = pipelineResults['validate_output'];
        if (finalStep?.validationPassed) {
            console.log(`📈 Pipeline Results: ${finalStep.finalColumns} columns, ${finalStep.finalRows} rows processed`);
        }
        
        // Step 2: Wait a moment for data to be fully written
        console.log('\n⏱️  Waiting for database write completion...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Step 3: Run Detailed Three-Stage Analysis 
        console.log('\n🧠 PHASE 2: Running Detailed Three-Stage Analysis');
        console.log('-'.repeat(50));
        
        const analysisResponse = await fetch(`${baseUrl}/api/three-stage-analysis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                datasetId: '1',
                targetDemographic: 'Parents with children aged 0-18', 
                surveyContext: 'Baby Care Products Survey',
                datasetName: 'Detail Parents Survey'
            })
        });
        
        const analysisResult = await analysisResponse.json();
        
        if (analysisResult.success) {
            console.log('✅ Three-Stage Analysis Completed');
            
            const results = analysisResult.analysis_results;
            const debug = results.debug_info;
            
            // Display detailed results
            console.log('\n📊 ANALYSIS RESULTS:');
            console.log(`   Data Quality: ${debug.data_quality.mapping_quality} (${debug.data_quality.columns_processed} columns)`);
            console.log(`   Real Data: ${debug.data_quality.has_real_data ? 'YES' : 'NO'}`);
            console.log(`   Data Source: ${results.processing_metadata.data_source}`);
            
            console.log('\n📈 Stage 1 - Statistical Analysis:');
            debug.stage1_progress.substeps.forEach(step => console.log(`   • ${step}`));
            console.log(`   Results: ${results.stage1_results.discriminatory_questions.length} discriminatory questions, ${results.stage1_results.significant_correlations.length} correlations`);
            
            console.log('\n🧠 Stage 2 - Behavioral Insights:');
            debug.stage2_progress.substeps.forEach(step => console.log(`   • ${step}`));
            console.log(`   Results: ${results.stage2_results.pain_points.length} pain points, ${results.stage2_results.pleasure_points.length} pleasure points`);
            
            console.log('\n🎯 Stage 3 - Marketing Archetypes:');
            debug.stage3_progress.substeps.forEach(step => console.log(`   • ${step}`));
            console.log(`   Results: ${results.stage3_results.archetypes.length} archetypes, ${(results.stage3_results.market_coverage * 100).toFixed(1)}% market coverage`);
            
            // Display archetypes
            console.log('\n👥 GENERATED ARCHETYPES:');
            results.stage3_results.archetypes.forEach((archetype, index) => {
                console.log(`   ${index + 1}. ${archetype.name}`);
                console.log(`      Motivation: ${archetype.core_motivation}`);
                console.log(`      Market Fit: ${(archetype.demographic_fit * 100).toFixed(1)}%`);
                console.log(`      Sample: ${archetype.sample_representation} responses`);
            });
            
            // Step 4: Test Digital Twin Generation
            console.log('\n🤖 PHASE 3: Testing Digital Twin Generation');
            console.log('-'.repeat(50));
            
            const twinResponse = await fetch(`${baseUrl}/api/universal-digital-twin-response`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    datasetId: 1001,
                    content: "What are your thoughts on natural baby care products?",
                    archetypeIds: [1, 2],
                    responseCount: 2
                })
            });
            
            const twinResult = await twinResponse.json();
            if (twinResult.success) {
                console.log(`✅ Digital twin generation: ${twinResult.stats.totalResponses} responses from ${twinResult.stats.archetypesUsed} archetypes`);
                console.log(`   Context: ${twinResult.stats.demographicContext}`);
            }
            
            // Final Summary
            console.log('\n' + '='.repeat(70));
            console.log('🏆 COMPLETE PIPELINE TEST RESULTS:');
            console.log(`✅ 7-Step Pipeline: ${Object.keys(pipelineResults).length}/7 steps completed`);
            console.log(`✅ Data Processing: ${debug.data_quality.has_real_data ? 'REAL DATA' : 'SYNTHETIC DATA'} (${debug.data_quality.columns_processed} columns)`);
            console.log(`✅ Three-Stage Analysis: ${results.analysis_summary.generated_archetypes} archetypes, ${results.analysis_summary.market_coverage_percent}% coverage`);
            console.log(`✅ Digital Twin Generation: ${twinResult.success ? 'FUNCTIONAL' : 'FAILED'}`);
            
            const overallSuccess = 
                Object.keys(pipelineResults).length === 7 && 
                analysisResult.success && 
                results.analysis_summary.generated_archetypes >= 3 &&
                twinResult.success;
                
            console.log(`\n🎯 OVERALL STATUS: ${overallSuccess ? '✅ FULLY FUNCTIONAL' : '⚠️ NEEDS ATTENTION'}`);
            
            if (!debug.data_quality.has_real_data) {
                console.log('\n⚠️  Note: Analysis used synthetic data. To use real 253-column data:');
                console.log('   1. Ensure document ID 1 exists in database with wrangling_report');
                console.log('   2. Check database connectivity and document status');
            }
            
        } else {
            console.log(`❌ Three-stage analysis failed: ${analysisResult.error}`);
        }
        
    } catch (error) {
        console.error('❌ Pipeline test failed:', error.message);
        return { error: error.message, success: false };
    }
}

// Run the complete pipeline test
testCompletePipelineWithRealData()
    .then(() => {
        console.log('\n📊 Complete pipeline test finished');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Pipeline test execution failed:', error);
        process.exit(1);
    });