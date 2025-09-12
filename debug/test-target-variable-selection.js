/**
 * Test Target Variable Selection with Updated Prompt
 * 
 * Simulates the LLM's target variable selection using realistic survey data
 * and shows which 3-5 variables would be chosen and their full questions
 */

import { ROITargetAnalyzer } from '../src/analysis/roi-target-analyzer.js';

// Realistic survey data simulating Detail Parents survey structure
const realisticSurveyColumns = [
    // Demographics (should not be top targets)
    {
        column_name: 'Q1_gender',
        data_type: 'categorical',
        sample_values: ['Male', 'Female', 'Other'],
        question_text: 'What is your gender?'
    },
    {
        column_name: 'Q2_age_range',
        data_type: 'categorical',
        sample_values: ['25-34', '35-44', '45-54'],
        question_text: 'What is your age range?'
    },
    
    // High-Impact Brand Preference Questions (should be top targets)
    {
        column_name: 'Q120',
        data_type: 'text',
        sample_values: ['I trust the brand and it works well for my family', 'Natural ingredients are important for my children', 'Good value for money and effective results'],
        question_text: 'You chose to spend your $100 on Brand X. Please say why you chose that brand:'
    },
    {
        column_name: 'Q19a',
        data_type: 'text',
        sample_values: ['I prefer Brand Y because it is more natural and gentle', 'Brand Z has better ingredients for sensitive skin', 'Other brands offer better value and same quality'],
        question_text: 'You indicated that you preferred other brands. Please indicate which brands you prefer and the reasons why.'
    },
    
    // Purchase Intent (should be high target)
    {
        column_name: 'Q32_purchase_likelihood',
        data_type: 'categorical',
        sample_values: ['Very likely', 'Somewhat likely', 'Unlikely'],
        question_text: 'How likely are you to purchase this product in the next 3 months?'
    },
    
    // Spending Behavior (should be high target)
    {
        column_name: 'Q35_monthly_spending',
        data_type: 'numerical',
        sample_values: ['$50-100', '$100-150', '$150-200'],
        question_text: 'What is your typical monthly spending on personal care products for your family?'
    },
    
    // Values-Based Purchasing (should be medium-high target)
    {
        column_name: 'Q51_organic_importance',
        data_type: 'categorical',
        sample_values: ['Very important', 'Somewhat important', 'Not important'],
        question_text: 'How important is it that your personal care products are organic or natural?'
    },
    
    // Brand Loyalty (should be medium target)
    {
        column_name: 'Q43_brand_loyalty',
        data_type: 'categorical',
        sample_values: ['Always same brand', 'Usually same brand', 'Try different brands'],
        question_text: 'Do you typically stick with the same brand or try different brands?'
    },
    
    // Open-ended recommendation (should be medium target)
    {
        column_name: 'Q67_recommendation_reason',
        data_type: 'text',
        sample_values: ['I would recommend it because it works well for sensitive skin', 'Good for families with young children', 'Effective and reasonably priced'],
        question_text: 'Would you recommend this brand to other parents? Please explain why or why not.'
    },
    
    // Price sensitivity (should be medium-high target)
    {
        column_name: 'Q28_price_sensitivity',
        data_type: 'categorical',
        sample_values: ['Price is most important', 'Balance price and quality', 'Quality over price'],
        question_text: 'When choosing personal care products, what matters most to you?'
    },
    
    // Cross-referenced question (should be medium target)
    {
        column_name: 'Q29_followup_concern',
        data_type: 'text',
        sample_values: ['Based on my skin sensitivity, I need something gentle', 'For my children\'s eczema, I need hypoallergenic'],
        question_text: 'Based on your answer to Q28, what specific concerns drive your product choices?'
    },
    
    // General satisfaction (lower priority)
    {
        column_name: 'Q15_satisfaction',
        data_type: 'categorical',
        sample_values: ['Very satisfied', 'Satisfied', 'Neutral'],
        question_text: 'How satisfied are you with your current personal care products?'
    },
    
    // Usage frequency (lower priority)
    {
        column_name: 'Q8_usage_frequency',
        data_type: 'categorical',
        sample_values: ['Daily', '2-3 times per week', 'Weekly'],
        question_text: 'How often do you use personal care products?'
    }
];

const detailParentsContext = {
    business_description: 'Personal care products for families with young children',
    target_demographic: 'Parents with children under 12',
    dataset_name: 'Detail Parents Survey - Target Variable Selection Test'
};

// Mock LLM response simulation based on the enhanced prompt
function simulateLLMTargetSelection(columns, context) {
    console.log('SIMULATING LLM TARGET VARIABLE SELECTION');
    console.log('='.repeat(60));
    
    // Score each column based on the prompt criteria
    const scoredColumns = columns.map(col => {
        let businessImpactScore = 0.3; // Base score
        let brandRelevanceScore = 0.1; // Base score
        let roiType = 'other';
        let responseType = col.data_type === 'text' ? 'open_ended' : 
                          col.data_type === 'numerical' ? 'numerical' : 'categorical';
        let mlSuitability = 0.6; // Base ML suitability
        
        const questionText = col.question_text.toLowerCase();
        
        // High-priority brand choice explanations
        if (questionText.includes('please say why you chose that brand') || 
            questionText.includes('why you chose') ||
            col.column_name === 'Q120') {
            businessImpactScore = 0.95;
            brandRelevanceScore = 0.98;
            roiType = 'decision_reasoning';
            mlSuitability = 0.85;
        }
        
        // Brand preference with reasoning
        else if (questionText.includes('which brands you prefer and the reasons why') ||
                questionText.includes('brands you prefer') ||
                col.column_name === 'Q19a') {
            businessImpactScore = 0.90;
            brandRelevanceScore = 0.95;
            roiType = 'brand_preference';
            mlSuitability = 0.80;
        }
        
        // Purchase intent
        else if (questionText.includes('likely to purchase') ||
                questionText.includes('purchase likelihood')) {
            businessImpactScore = 0.85;
            brandRelevanceScore = 0.20;
            roiType = 'purchase_intent';
            mlSuitability = 0.90;
        }
        
        // Spending behavior
        else if (questionText.includes('monthly spending') ||
                questionText.includes('spending') ||
                questionText.includes('budget')) {
            businessImpactScore = 0.80;
            brandRelevanceScore = 0.15;
            roiType = 'spending_amount';
            mlSuitability = 0.85;
        }
        
        // Values-based purchasing
        else if (questionText.includes('organic') ||
                questionText.includes('natural') ||
                questionText.includes('important')) {
            businessImpactScore = 0.70;
            brandRelevanceScore = 0.40;
            roiType = 'values_alignment';
            mlSuitability = 0.75;
        }
        
        // Price sensitivity
        else if (questionText.includes('price') ||
                questionText.includes('matters most')) {
            businessImpactScore = 0.75;
            brandRelevanceScore = 0.25;
            roiType = 'spending_amount';
            mlSuitability = 0.80;
        }
        
        // Brand loyalty
        else if (questionText.includes('same brand') ||
                questionText.includes('brand loyalty')) {
            businessImpactScore = 0.65;
            brandRelevanceScore = 0.80;
            roiType = 'brand_loyalty';
            mlSuitability = 0.70;
        }
        
        // Open-ended recommendations
        else if (questionText.includes('recommend') &&
                questionText.includes('explain why')) {
            businessImpactScore = 0.60;
            brandRelevanceScore = 0.70;
            roiType = 'decision_reasoning';
            mlSuitability = 0.65;
        }
        
        // Cross-referenced questions
        else if (questionText.includes('based on your answer to')) {
            businessImpactScore = 0.55;
            brandRelevanceScore = 0.30;
            roiType = 'decision_reasoning';
            mlSuitability = 0.60;
        }
        
        // Demographics get low scores
        else if (questionText.includes('gender') ||
                questionText.includes('age') ||
                questionText.includes('demographic')) {
            businessImpactScore = 0.20;
            brandRelevanceScore = 0.05;
            roiType = 'other';
            mlSuitability = 0.40;
        }
        
        const combinedScore = (businessImpactScore + brandRelevanceScore) / 2;
        
        return {
            column_name: col.column_name,
            question_text: col.question_text,
            roi_type: roiType,
            business_impact_score: businessImpactScore,
            brand_relevance: brandRelevanceScore,
            combined_score: combinedScore,
            ml_target_suitability: mlSuitability,
            response_type: responseType,
            reasoning: `Analysis: ${questionText.includes('why') || questionText.includes('explain') ? 'Open-ended explanation' : 'Categorical/numerical predictor'} - ${roiType} type`
        };
    });
    
    // Sort by combined score
    const rankedColumns = scoredColumns.sort((a, b) => b.combined_score - a.combined_score);
    
    // Apply 3-5 target selection logic
    const highImpactTargets = rankedColumns.filter(col => col.business_impact_score >= 0.8);
    let selectedTargets;
    
    if (highImpactTargets.length >= 5) {
        selectedTargets = highImpactTargets.slice(0, 5);
        console.log('Selected 5 targets (all have high revenue impact >= 0.8)');
    } else if (highImpactTargets.length >= 3) {
        selectedTargets = rankedColumns.slice(0, Math.min(5, highImpactTargets.length));
        console.log(`Selected ${selectedTargets.length} targets (${highImpactTargets.length} high-impact targets available)`);
    } else {
        selectedTargets = rankedColumns.slice(0, 3);
        console.log('Selected 3 targets (minimum required)');
    }
    
    return {
        allScored: rankedColumns,
        selectedTargets: selectedTargets,
        highImpactCount: highImpactTargets.length
    };
}

async function testTargetVariableSelection() {
    console.log('TARGET VARIABLE SELECTION TEST');
    console.log('='.repeat(70));
    console.log(`Testing with ${realisticSurveyColumns.length} survey columns`);
    console.log('Context: Detail Parents Survey - Personal care products');
    console.log('');
    
    // Get the actual prompt that would be sent to the LLM
    const analyzer = new ROITargetAnalyzer({ enableCaching: false });
    const prompt = analyzer.buildROITargetPrompt(realisticSurveyColumns, detailParentsContext);
    
    console.log('GENERATED PROMPT PREVIEW:');
    console.log('-'.repeat(40));
    console.log('Length:', prompt.length, 'characters');
    console.log('');
    console.log('Column List Sample:');
    const lines = prompt.split('\\n');
    const columnLines = lines.filter(line => line.includes('COLUMN_ID:'));
    columnLines.slice(0, 3).forEach(line => console.log('  ' + line.trim()));
    console.log('  ... (' + (columnLines.length - 3) + ' more columns)');
    console.log('');
    
    // Simulate LLM response
    const selectionResults = simulateLLMTargetSelection(realisticSurveyColumns, detailParentsContext);
    
    console.log('\\nSELECTED TARGET VARIABLES');
    console.log('='.repeat(70));
    console.log(`Selected ${selectionResults.selectedTargets.length} target variables:`);
    console.log('');
    
    selectionResults.selectedTargets.forEach((target, index) => {
        console.log(`${index + 1}. ${target.column_name} (Combined Score: ${(target.combined_score * 100).toFixed(1)}%)`);
        console.log(`   QUESTION: "${target.question_text}"`);
        console.log(`   ROI Type: ${target.roi_type}`);
        console.log(`   Business Impact: ${(target.business_impact_score * 100).toFixed(1)}%`);
        console.log(`   Brand Relevance: ${(target.brand_relevance * 100).toFixed(1)}%`);
        console.log(`   ML Suitability: ${(target.ml_target_suitability * 100).toFixed(1)}%`);
        console.log(`   Response Type: ${target.response_type}`);
        console.log('');
    });
    
    console.log('FULL RANKING OF ALL QUESTIONS');
    console.log('='.repeat(70));
    console.log('All questions ranked by combined score:');
    console.log('');
    
    selectionResults.allScored.forEach((target, index) => {
        const isSelected = index < selectionResults.selectedTargets.length;
        const marker = isSelected ? '🎯' : '  ';
        console.log(`${marker} ${index + 1}. ${target.column_name} (${(target.combined_score * 100).toFixed(1)}%) - ${target.roi_type}`);
        console.log(`     "${target.question_text}"`);
        console.log('');
    });
    
    console.log('ANALYSIS SUMMARY');
    console.log('='.repeat(70));
    console.log(`Total Questions: ${selectionResults.allScored.length}`);
    console.log(`Selected Targets: ${selectionResults.selectedTargets.length}`);
    console.log(`High Impact Targets (≥80%): ${selectionResults.highImpactCount}`);
    console.log('');
    
    // Breakdown by ROI type
    const roiTypeBreakdown = {};
    selectionResults.selectedTargets.forEach(target => {
        roiTypeBreakdown[target.roi_type] = (roiTypeBreakdown[target.roi_type] || 0) + 1;
    });
    
    console.log('Selected Targets by ROI Type:');
    Object.entries(roiTypeBreakdown).forEach(([type, count]) => {
        console.log(`  - ${type}: ${count} target${count > 1 ? 's' : ''}`);
    });
    
    console.log('');
    
    // Expected JSON format that would be returned
    const expectedJSON = selectionResults.selectedTargets.map(target => ({
        column_name: target.column_name,
        roi_type: target.roi_type,
        business_impact_score: target.business_impact_score,
        reasoning: target.reasoning,
        ml_target_suitability: target.ml_target_suitability,
        response_type: target.response_type,
        brand_relevance: target.brand_relevance
    }));
    
    console.log('EXPECTED JSON RESPONSE:');
    console.log('='.repeat(40));
    console.log(JSON.stringify(expectedJSON, null, 2));
    
    return {
        selectedCount: selectionResults.selectedTargets.length,
        selectedTargets: selectionResults.selectedTargets,
        highImpactCount: selectionResults.highImpactCount
    };
}

// Execute test
testTargetVariableSelection()
    .then(results => {
        console.log('\\n' + '='.repeat(70));
        console.log('🎯 TARGET VARIABLE SELECTION TEST COMPLETED');
        console.log(`Selected ${results.selectedCount} target variables`);
        console.log(`${results.highImpactCount} variables have high revenue impact`);
        console.log('='.repeat(70));
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    });