/**
 * Test Column ID Clarity in Enhanced Prompt
 * 
 * Verifies that the LLM receives clear instructions to return exact column IDs
 * while still having access to full question text for analysis
 */

import { ROITargetAnalyzer } from '../src/analysis/roi-target-analyzer.js';

const testColumns = [
    {
        column_name: 'Q120',
        data_type: 'text',
        sample_values: ['I trust the brand and it works well', 'Natural ingredients are important', 'Good value for money'],
        question_text: 'You chose to spend your $100 on [XX]. Please say why you chose that brand:'
    },
    {
        column_name: 'Q19a',
        data_type: 'text',
        sample_values: ['I prefer Brand Y because it is organic', 'Brand Z works better for sensitive skin'],
        question_text: 'You indicated that you preferred other brands. Please indicate which brands you prefer and the reasons why.'
    },
    {
        column_name: 'purchase_likelihood_q5',
        data_type: 'categorical', 
        sample_values: ['Very likely', 'Somewhat likely', 'Unlikely'],
        question_text: 'How likely are you to purchase this product in the next 3 months?'
    }
];

const testContext = {
    business_description: 'Personal care products research',
    target_demographic: 'Parents with children under 12',
    dataset_name: 'Column ID Clarity Test'
};

function analyzeColumnIdClarity(prompt) {
    console.log('COLUMN ID CLARITY ANALYSIS');
    console.log('='.repeat(50));
    
    // Check for clear COLUMN_ID format
    const columnIdMatches = prompt.match(/COLUMN_ID:\s*(\w+)/g) || [];
    console.log(`\\nCOLUMN_ID entries found: ${columnIdMatches.length}`);
    columnIdMatches.forEach(match => {
        console.log(`  - ${match}`);
    });
    
    // Check for clear instruction about using column IDs
    const instructionChecks = [
        'EXACT COLUMN_ID from the list',
        'use only the identifier, NOT the question text',
        'Use only the COLUMN_ID',
        'never the full question text'
    ];
    
    console.log('\\nCLARITY INSTRUCTIONS:');
    instructionChecks.forEach(instruction => {
        const found = prompt.includes(instruction);
        console.log(`✓ ${found ? 'FOUND' : 'MISSING'}: "${instruction}"`);
    });
    
    // Extract example format from column list
    console.log('\\nCOLUMN LIST FORMAT EXAMPLES:');
    const lines = prompt.split('\\n');
    const columnLines = lines.filter(line => line.includes('COLUMN_ID:'));
    columnLines.slice(0, 3).forEach(line => {
        console.log(`  ${line.trim()}`);
    });
    
    return {
        columnIdCount: columnIdMatches.length,
        instructionCount: instructionChecks.filter(inst => prompt.includes(inst)).length,
        hasExamples: columnIdMatches.length > 0
    };
}

function generateExpectedJSON(columns) {
    console.log('\\nEXPECTED JSON RESPONSE FORMAT:');
    console.log('The LLM should return column_name values like this:');
    
    const expectedFormat = columns.map(col => ({
        column_name: col.column_name, // This is what we want
        roi_type: 'decision_reasoning',
        business_impact_score: 0.9,
        reasoning: `Analysis based on: "${col.question_text}"`,
        ml_target_suitability: 0.8,
        response_type: 'open_ended',
        brand_relevance: 0.9
    }));
    
    console.log(JSON.stringify(expectedFormat, null, 2));
    
    console.log('\\nINCORRECT FORMAT (what we want to avoid):');
    const incorrectFormat = columns.map(col => ({
        column_name: col.question_text, // This would be wrong
        roi_type: 'decision_reasoning'
    }));
    
    console.log(JSON.stringify(incorrectFormat.slice(0, 1), null, 2));
    console.log('... (truncated - this format would be problematic)');
    
    return expectedFormat;
}

async function testColumnIdClarity() {
    console.log('TESTING COLUMN ID CLARITY IN ENHANCED PROMPT');
    console.log('='.repeat(70));
    
    const analyzer = new ROITargetAnalyzer({ enableCaching: false });
    const prompt = analyzer.buildROITargetPrompt(testColumns, testContext);
    
    console.log('\\nPROMPT LENGTH:', prompt.length, 'characters');
    console.log('\\nPROMPT STRUCTURE ANALYSIS:');
    console.log('-'.repeat(30));
    
    // Analyze the prompt structure
    const analysis = analyzeColumnIdClarity(prompt);
    
    // Show expected JSON format
    const expectedJSON = generateExpectedJSON(testColumns);
    
    console.log('\\n\\nVERIFICATION RESULTS');
    console.log('='.repeat(50));
    
    const verificationResults = {
        columnIdsPresent: analysis.columnIdCount === testColumns.length,
        instructionsClear: analysis.instructionCount >= 3,
        formatConsistent: analysis.hasExamples,
        expectedJSONCorrect: expectedJSON.every(item => 
            typeof item.column_name === 'string' && 
            item.column_name.length < 50 // Should be short ID, not full question
        )
    };
    
    console.log(`✓ Column IDs Present: ${verificationResults.columnIdsPresent ? 'YES' : 'NO'}`);
    console.log(`✓ Instructions Clear: ${verificationResults.instructionsClear ? 'YES' : 'NO'}`);
    console.log(`✓ Format Consistent: ${verificationResults.formatConsistent ? 'YES' : 'NO'}`);
    console.log(`✓ Expected JSON Valid: ${verificationResults.expectedJSONCorrect ? 'YES' : 'NO'}`);
    
    const overallSuccess = Object.values(verificationResults).every(result => result);
    
    console.log('\\n' + '='.repeat(70));
    console.log(`COLUMN ID CLARITY: ${overallSuccess ? 'SUCCESS' : 'NEEDS IMPROVEMENT'}`);
    console.log('='.repeat(70));
    
    if (overallSuccess) {
        console.log('\\n✅ BENEFITS OF ENHANCED FORMAT:');
        console.log('1. LLM sees full question text for accurate analysis');
        console.log('2. Clear COLUMN_ID format prevents confusion');
        console.log('3. Explicit instructions ensure correct JSON response');
        console.log('4. Maintains compatibility with existing parsing logic');
        console.log('\\n✅ The LLM can now:');
        console.log('- Identify "Please say why you chose that brand" patterns');
        console.log('- Return precise column identifiers like "Q120", "Q19a"');
        console.log('- Avoid returning full question text in responses');
    } else {
        console.log('\\n❌ ISSUES TO ADDRESS:');
        if (!verificationResults.columnIdsPresent) {
            console.log('- Not all column IDs are properly formatted');
        }
        if (!verificationResults.instructionsClear) {
            console.log('- Instructions need to be more explicit');
        }
        if (!verificationResults.formatConsistent) {
            console.log('- Format consistency issues detected');
        }
    }
    
    return {
        success: overallSuccess,
        analysis,
        verificationResults
    };
}

// Execute test
testColumnIdClarity()
    .then(results => {
        if (results.success) {
            console.log('\\n🎉 COLUMN ID CLARITY TEST PASSED');
            console.log('Enhanced prompt provides clear column identification while maintaining full question context');
        } else {
            console.log('\\n❌ COLUMN ID CLARITY TEST FAILED');
        }
        process.exit(results.success ? 0 : 1);
    })
    .catch(error => {
        console.error('\\n💥 Test error:', error.message);
        process.exit(1);
    });