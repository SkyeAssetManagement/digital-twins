/**
 * Test Full Question Text Format in Column List
 * 
 * Verifies that including full question text in the column list 
 * improves detection of Q120 and Q19a patterns
 */

import { ROITargetAnalyzer } from '../src/analysis/roi-target-analyzer.js';

// Test data with full question text included
const columnsWithQuestionText = [
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
        column_name: 'Q32',
        data_type: 'categorical', 
        sample_values: ['Very likely', 'Somewhat likely', 'Unlikely'],
        question_text: 'How likely are you to purchase this product in the next 3 months?'
    },
    {
        column_name: 'Q1_gender',
        data_type: 'categorical',
        sample_values: ['Male', 'Female', 'Other'],
        question_text: 'What is your gender?'
    }
];

// Same data without question text (old format)
const columnsWithoutQuestionText = [
    {
        column_name: 'Q120',
        data_type: 'text',
        sample_values: ['I trust the brand and it works well', 'Natural ingredients are important', 'Good value for money']
    },
    {
        column_name: 'Q19a',
        data_type: 'text', 
        sample_values: ['I prefer Brand Y because it is organic', 'Brand Z works better for sensitive skin']
    },
    {
        column_name: 'Q32',
        data_type: 'categorical',
        sample_values: ['Very likely', 'Somewhat likely', 'Unlikely']
    },
    {
        column_name: 'Q1_gender',
        data_type: 'categorical',
        sample_values: ['Male', 'Female', 'Other']
    }
];

const testContext = {
    business_description: 'Personal care products research',
    target_demographic: 'Parents with children under 12',
    dataset_name: 'Column Format Test'
};

function analyzeBrandDetectionPhrases(prompt) {
    const brandDetectionPhrases = [
        'please say why you chose that brand',
        'indicate which brands you prefer and the reasons why',
        'You chose to spend your \\$100',
        'preferred other brands'
    ];
    
    const detectedPhrases = [];
    const missedPhrases = [];
    
    brandDetectionPhrases.forEach(phrase => {
        const regex = new RegExp(phrase, 'i');
        if (regex.test(prompt)) {
            detectedPhrases.push(phrase);
        } else {
            missedPhrases.push(phrase);
        }
    });
    
    return { detectedPhrases, missedPhrases };
}

async function testColumnFormats() {
    console.log('TESTING COLUMN FORMAT IMPACT ON BRAND DETECTION');
    console.log('='.repeat(70));
    
    const analyzer = new ROITargetAnalyzer({ enableCaching: false });
    
    // Test with full question text
    console.log('\\nTEST 1: WITH FULL QUESTION TEXT');
    console.log('-'.repeat(40));
    const promptWithQuestions = analyzer.buildROITargetPrompt(columnsWithQuestionText, testContext);
    const analysisWithQuestions = analyzeBrandDetectionPhrases(promptWithQuestions);
    
    console.log('Column List Format (with question text):');
    columnsWithQuestionText.forEach(col => {
        const questionText = col.question_text || '';
        const sampleValues = col.sample_values?.slice(0, 3).join(', ') || 'no samples';
        
        if (questionText) {
            console.log(`${col.column_name}: "${questionText}" | Type: ${col.data_type} | Samples: (${sampleValues})`);
        } else {
            console.log(`${col.column_name}: ${col.data_type} (${sampleValues})`);
        }
    });
    
    console.log(`\\nBrand Detection Results:`);
    console.log(`✓ Detected Phrases: ${analysisWithQuestions.detectedPhrases.length}/4`);
    analysisWithQuestions.detectedPhrases.forEach(phrase => {
        console.log(`  - "${phrase}"`);
    });
    
    if (analysisWithQuestions.missedPhrases.length > 0) {
        console.log(`✗ Missed Phrases: ${analysisWithQuestions.missedPhrases.length}/4`);
        analysisWithQuestions.missedPhrases.forEach(phrase => {
            console.log(`  - "${phrase}"`);
        });
    }
    
    // Test without full question text (old format)
    console.log('\\n\\nTEST 2: WITHOUT FULL QUESTION TEXT (OLD FORMAT)');
    console.log('-'.repeat(40));
    const promptWithoutQuestions = analyzer.buildROITargetPrompt(columnsWithoutQuestionText, testContext);
    const analysisWithoutQuestions = analyzeBrandDetectionPhrases(promptWithoutQuestions);
    
    console.log('Column List Format (without question text):');
    columnsWithoutQuestionText.forEach(col => {
        const sampleValues = col.sample_values?.slice(0, 3).join(', ') || 'no samples';
        console.log(`${col.column_name}: ${col.data_type} (${sampleValues})`);
    });
    
    console.log(`\\nBrand Detection Results:`);
    console.log(`✓ Detected Phrases: ${analysisWithoutQuestions.detectedPhrases.length}/4`);
    analysisWithoutQuestions.detectedPhrases.forEach(phrase => {
        console.log(`  - "${phrase}"`);
    });
    
    if (analysisWithoutQuestions.missedPhrases.length > 0) {
        console.log(`✗ Missed Phrases: ${analysisWithoutQuestions.missedPhrases.length}/4`);
        analysisWithoutQuestions.missedPhrases.forEach(phrase => {
            console.log(`  - "${phrase}"`);
        });
    }
    
    // Compare results
    console.log('\\n\\nCOMPARISON RESULTS');
    console.log('='.repeat(70));
    
    const improvementCount = analysisWithQuestions.detectedPhrases.length - analysisWithoutQuestions.detectedPhrases.length;
    
    console.log(`With Question Text:    ${analysisWithQuestions.detectedPhrases.length}/4 phrases detected`);
    console.log(`Without Question Text: ${analysisWithoutQuestions.detectedPhrases.length}/4 phrases detected`);
    console.log(`Improvement:           ${improvementCount > 0 ? '+' : ''}${improvementCount} phrases`);
    
    if (improvementCount > 0) {
        console.log('\\n✅ CONCLUSION: Including full question text IMPROVES brand detection');
        console.log('   The LLM can now see the exact phrases like "please say why you chose that brand"');
        console.log('   This enables better detection of Q120, Q19a, and similar brand preference questions');
    } else {
        console.log('\\n⚠️  CONCLUSION: No improvement detected - may need further analysis');
    }
    
    // Token usage analysis
    console.log('\\nTOKEN USAGE ANALYSIS');
    console.log('-'.repeat(30));
    console.log(`Prompt with questions:    ~${promptWithQuestions.length} characters`);
    console.log(`Prompt without questions: ~${promptWithoutQuestions.length} characters`);
    console.log(`Additional tokens:        ~${promptWithQuestions.length - promptWithoutQuestions.length} characters`);
    
    const tokenIncrease = ((promptWithQuestions.length / promptWithoutQuestions.length - 1) * 100).toFixed(1);
    console.log(`Token increase:           ~${tokenIncrease}%`);
    
    if (parseFloat(tokenIncrease) < 50) {
        console.log('✅ Token increase is reasonable for improved detection accuracy');
    } else {
        console.log('⚠️  Significant token increase - consider if benefits justify cost');
    }
    
    return {
        withQuestions: analysisWithQuestions.detectedPhrases.length,
        withoutQuestions: analysisWithoutQuestions.detectedPhrases.length,
        improvement: improvementCount,
        tokenIncrease: parseFloat(tokenIncrease)
    };
}

// Execute test
testColumnFormats()
    .then(results => {
        console.log('\\n' + '='.repeat(70));
        if (results.improvement > 0) {
            console.log('🎉 FULL QUESTION TEXT FORMAT RECOMMENDED');
            console.log(`   Improves brand phrase detection by ${results.improvement} phrases`);
            console.log(`   Token cost increase: ${results.tokenIncrease}%`);
        } else {
            console.log('📊 NO IMPROVEMENT DETECTED - Further analysis needed');
        }
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    });