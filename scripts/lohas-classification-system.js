import * as XLSX from 'xlsx';
import fs from 'fs/promises';
import path from 'path';

async function classifyLOHASSegments() {
  const filePath = 'data/datasets/surf-clothing/raw/All_Surf_detail 2.xlsx';
  
  // Read the Excel file
  const fileContent = await fs.readFile(filePath);
  const workbook = XLSX.read(fileContent, { cellStyles: true, cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  // Process headers
  const mainHeaders = data[0] || [];
  const subHeaders = data[1] || [];
  const fullQuestions = [];
  
  let currentMainHeader = '';
  for (let i = 0; i < Math.max(mainHeaders.length, subHeaders.length); i++) {
    if (mainHeaders[i]) {
      currentMainHeader = mainHeaders[i];
    }
    const subHeader = subHeaders[i] || '';
    const fullQuestion = subHeader ? `${currentMainHeader} - ${subHeader}` : currentMainHeader;
    fullQuestions.push(fullQuestion);
  }
  
  // Define key classification variables based on our analysis
  const CLASSIFICATION_VARIABLES = {
    // Actual behavior (most important)
    actualSustainablePurchase: {
      index: 69,  // "Have you ever chosen a surf clothing product specifically because of its sustainability"
      weight: 3.0,  // Triple weight for actual behavior
      name: "Actual sustainable purchase"
    },
    
    // Brand engagement - Patagonia (strongest predictor)
    patagoniaWornWear: {
      index: 117, // "Patagonia: Awareness of Worn Wear program"
      weight: 2.0,
      name: "Patagonia Worn Wear awareness"
    },
    
    // Environmental activism
    environmentalActivism: {
      index: 100, // "Participated in beach clean-up"
      weight: 1.5,
      name: "Environmental activism"
    },
    
    // Willingness to pay premium
    willingnessToPay25: {
      index: 145, // "I am willing to pay 25% more for environmentally friendly products"
      weight: 2.0,
      name: "Willingness to pay 25% premium"
    },
    
    // Values - Brand support commitment
    brandCommitment: {
      index: 154, // "I actively support brands that align with my values"
      weight: 1.5,
      name: "Brand values alignment"
    },
    
    // Environmental evangelism
    environmentalEvangelism: {
      index: 151, // "I encourage others to buy from environmentally responsible companies"
      weight: 1.5,
      name: "Environmental evangelism"
    },
    
    // Price sensitivity (inverted)
    priceImportance: {
      index: 57,  // "How important is Price/Value"
      weight: 1.0,
      name: "Price sensitivity",
      invert: true
    },
    
    // Sustainability importance
    sustainabilityImportance: {
      index: 59, // "How important is Sustainability"
      weight: 1.5,
      name: "Sustainability importance"
    },
    
    // Organic materials importance
    organicImportance: {
      index: 62, // "How important is Organic Materials"
      weight: 1.0,
      name: "Organic materials importance"
    },
    
    // Recycling behavior
    recyclingBehavior: {
      index: 148, // "I always recycle"
      weight: 1.0,
      name: "Recycling behavior"
    }
  };
  
  // Process each respondent
  const respondentClassifications = [];
  
  for (let row = 2; row < Math.min(data.length, 1008); row++) {
    const responses = data[row];
    if (!responses || responses.length < 150) continue;
    
    const respondentId = responses[0];
    
    // Calculate individual scores and weighted composite
    const scores = {};
    let weightedSum = 0;
    let totalWeight = 0;
    
    for (const [key, variable] of Object.entries(CLASSIFICATION_VARIABLES)) {
      const response = responses[variable.index];
      if (response) {
        let score = scoreResponse(response);
        
        // Invert if needed
        if (variable.invert) {
          score = 6 - score;
        }
        
        scores[key] = score;
        weightedSum += score * variable.weight;
        totalWeight += variable.weight;
      }
    }
    
    // Calculate normalized composite score (1-5 scale)
    const compositeScore = totalWeight > 0 ? weightedSum / totalWeight : 3;
    
    // Calculate propensity score with stratification
    const propensityScore = calculateStratifiedPropensity(scores, compositeScore);
    
    // Classify into LOHAS segment
    const segment = classifySegment(scores, compositeScore, propensityScore);
    
    // Store classification with detailed workings
    respondentClassifications.push({
      respondentId: respondentId,
      row: row + 1, // Excel row number (1-indexed)
      
      // Individual scores
      actualPurchase: scores.actualSustainablePurchase || 'N/A',
      patagoniaEngagement: scores.patagoniaWornWear || 'N/A',
      environmentalActivism: scores.environmentalActivism || 'N/A',
      willingnessToPay: scores.willingnessToPay25 || 'N/A',
      brandCommitment: scores.brandCommitment || 'N/A',
      environmentalEvangelism: scores.environmentalEvangelism || 'N/A',
      priceInsensitivity: scores.priceImportance || 'N/A',
      sustainabilityImportance: scores.sustainabilityImportance || 'N/A',
      organicImportance: scores.organicImportance || 'N/A',
      recyclingBehavior: scores.recyclingBehavior || 'N/A',
      
      // Composite scores
      compositeScore: compositeScore.toFixed(3),
      propensityScore: propensityScore.toFixed(3),
      propensityCategory: categorizePropensity(propensityScore),
      
      // Final classification
      lohasSegment: segment,
      
      // Classification reasoning
      classificationReasoning: getClassificationReasoning(scores, compositeScore, propensityScore, segment)
    });
  }
  
  return respondentClassifications;
}

function scoreResponse(response) {
  if (!response) return 3;
  
  const responseStr = response.toString().toLowerCase().trim();
  
  // Handle numeric responses
  const num = parseFloat(responseStr);
  if (!isNaN(num)) {
    if (num >= 1 && num <= 5) return num;
    if (num === 0) return 1;
    if (num > 5) return 5;
  }
  
  // Handle text responses
  if (responseStr.includes('strongly agree') || responseStr.includes('very important') || 
      responseStr.includes('extremely') || responseStr.includes('always')) return 5;
  if (responseStr.includes('agree') || responseStr.includes('important') || 
      responseStr.includes('often') || responseStr.includes('frequently')) return 4;
  if (responseStr.includes('neutral') || responseStr.includes('neither') || 
      responseStr.includes('somewhat') || responseStr.includes('sometimes')) return 3;
  if (responseStr.includes('disagree') || responseStr.includes('not important') || 
      responseStr.includes('rarely')) return 2;
  if (responseStr.includes('strongly disagree') || responseStr.includes('not at all') || 
      responseStr.includes('never')) return 1;
  
  // Yes/No
  if (responseStr === 'yes' || responseStr === 'y') return 5;
  if (responseStr === 'no' || responseStr === 'n') return 1;
  
  return 3;
}

function calculateStratifiedPropensity(scores, compositeScore) {
  // Create a highly stratified propensity score with clear distinctions
  
  // Start with composite score as base
  let propensity = compositeScore;
  
  // Heavy boost for actual purchase behavior (most important signal)
  if (scores.actualSustainablePurchase === 5) {
    propensity = Math.min(5, propensity + 1.5); // Major boost
  } else if (scores.actualSustainablePurchase === 1) {
    propensity = propensity * 0.7; // Significant penalty
  }
  
  // Boost for strong willingness to pay
  if (scores.willingnessToPay25 >= 4) {
    propensity = Math.min(5, propensity + 0.5);
  } else if (scores.willingnessToPay25 <= 2) {
    propensity = propensity * 0.85;
  }
  
  // Boost for Patagonia engagement (strongest brand predictor)
  if (scores.patagoniaWornWear >= 4) {
    propensity = Math.min(5, propensity + 0.3);
  }
  
  // Penalty for high price sensitivity
  if (scores.priceImportance && scores.priceImportance <= 2) {
    propensity = propensity * 0.9;
  }
  
  // Ensure strong stratification
  if (propensity >= 4.5) {
    return 5.0; // Very high propensity
  } else if (propensity >= 3.8) {
    return 4.2; // High propensity
  } else if (propensity >= 3.0) {
    return 3.5; // Medium propensity
  } else if (propensity >= 2.2) {
    return 2.5; // Low propensity
  } else {
    return 1.5; // Very low propensity
  }
}

function categorizePropensity(propensityScore) {
  if (propensityScore >= 4.5) return 'Very High (Premium Payer)';
  if (propensityScore >= 3.8) return 'High (Selective Premium)';
  if (propensityScore >= 3.0) return 'Medium (Conditional)';
  if (propensityScore >= 2.2) return 'Low (Price Conscious)';
  return 'Very Low (Price Sensitive)';
}

function classifySegment(scores, compositeScore, propensityScore) {
  // LOHAS Leader (10-15% expected)
  // Criteria: High propensity, actual behavior, strong values, environmental activism
  if (propensityScore >= 4.5 && 
      scores.actualSustainablePurchase === 5 &&
      compositeScore >= 4.2 &&
      (scores.environmentalActivism >= 4 || scores.environmentalEvangelism >= 4)) {
    return 'LOHAS Leader';
  }
  
  // LOHAS Leaning (20-25% expected)
  // Criteria: Good propensity, some sustainable behavior, moderate-strong values
  if (propensityScore >= 3.8 && 
      compositeScore >= 3.5 &&
      (scores.actualSustainablePurchase >= 3 || scores.willingnessToPay25 >= 4) &&
      (scores.brandCommitment >= 3 || scores.sustainabilityImportance >= 4)) {
    return 'LOHAS Leaning';
  }
  
  // LOHAS Learner (35-40% expected)
  // Criteria: Moderate propensity, interested but not fully committed
  if (propensityScore >= 2.5 && 
      compositeScore >= 2.8 &&
      (scores.sustainabilityImportance >= 3 || scores.recyclingBehavior >= 3)) {
    return 'LOHAS Learner';
  }
  
  // LOHAS Laggard (30-35% expected)
  // Everyone else with low propensity
  return 'LOHAS Laggard';
}

function getClassificationReasoning(scores, compositeScore, propensityScore, segment) {
  const reasons = [];
  
  // Add propensity level
  if (propensityScore >= 4.5) {
    reasons.push('Very high propensity to pay premium');
  } else if (propensityScore >= 3.8) {
    reasons.push('High propensity to pay premium');
  } else if (propensityScore >= 3.0) {
    reasons.push('Moderate propensity to pay');
  } else {
    reasons.push('Low propensity to pay premium');
  }
  
  // Add behavior indicators
  if (scores.actualSustainablePurchase === 5) {
    reasons.push('Has purchased for sustainability');
  } else if (scores.actualSustainablePurchase === 1) {
    reasons.push('Never purchased for sustainability');
  }
  
  // Add value indicators
  if (scores.environmentalEvangelism >= 4) {
    reasons.push('Environmental evangelist');
  }
  if (scores.brandCommitment >= 4) {
    reasons.push('Strong brand values alignment');
  }
  
  // Add price sensitivity
  if (scores.priceImportance && scores.priceImportance <= 2) {
    reasons.push('High price sensitivity');
  } else if (scores.priceImportance >= 4) {
    reasons.push('Low price sensitivity');
  }
  
  return reasons.join('; ');
}

async function analyzeAndExport(classifications) {
  // Calculate distribution
  const segmentCounts = {};
  const propensityCounts = {};
  
  for (const record of classifications) {
    segmentCounts[record.lohasSegment] = (segmentCounts[record.lohasSegment] || 0) + 1;
    propensityCounts[record.propensityCategory] = (propensityCounts[record.propensityCategory] || 0) + 1;
  }
  
  const total = classifications.length;
  
  console.log('\n' + '='.repeat(100));
  console.log('LOHAS SEGMENT CLASSIFICATION RESULTS');
  console.log('='.repeat(100) + '\n');
  
  console.log('SEGMENT DISTRIBUTION:');
  console.log('-'.repeat(50));
  
  const expectedRanges = {
    'LOHAS Leader': '10-15%',
    'LOHAS Leaning': '20-25%',
    'LOHAS Learner': '35-40%',
    'LOHAS Laggard': '30-35%'
  };
  
  for (const segment of ['LOHAS Leader', 'LOHAS Leaning', 'LOHAS Learner', 'LOHAS Laggard']) {
    const count = segmentCounts[segment] || 0;
    const percentage = ((count / total) * 100).toFixed(1);
    const expected = expectedRanges[segment];
    console.log(`${segment}: ${count} (${percentage}%) - Expected: ${expected}`);
  }
  
  console.log('\n' + '='.repeat(100));
  console.log('PROPENSITY TO PAY DISTRIBUTION:');
  console.log('='.repeat(100) + '\n');
  
  for (const [category, count] of Object.entries(propensityCounts)) {
    const percentage = ((count / total) * 100).toFixed(1);
    console.log(`${category}: ${count} (${percentage}%)`);
  }
  
  // Create CSV for export
  const csvRows = [
    // Headers
    [
      'Respondent ID',
      'Excel Row',
      'LOHAS Segment',
      'Propensity Score',
      'Propensity Category',
      'Composite Score',
      'Actual Purchase (1-5)',
      'Patagonia Engagement (1-5)',
      'Environmental Activism (1-5)',
      'Willingness to Pay 25% (1-5)',
      'Brand Commitment (1-5)',
      'Environmental Evangelism (1-5)',
      'Price Insensitivity (1-5)',
      'Sustainability Importance (1-5)',
      'Organic Importance (1-5)',
      'Recycling Behavior (1-5)',
      'Classification Reasoning'
    ].join(',')
  ];
  
  // Add data rows
  for (const record of classifications) {
    csvRows.push([
      record.respondentId,
      record.row,
      record.lohasSegment,
      record.propensityScore,
      record.propensityCategory,
      record.compositeScore,
      record.actualPurchase,
      record.patagoniaEngagement,
      record.environmentalActivism,
      record.willingnessToPay,
      record.brandCommitment,
      record.environmentalEvangelism,
      record.priceInsensitivity,
      record.sustainabilityImportance,
      record.organicImportance,
      record.recyclingBehavior,
      `"${record.classificationReasoning}"`
    ].join(','));
  }
  
  // Write CSV file
  await fs.writeFile(
    'data/datasets/surf-clothing/lohas-classification-results.csv',
    csvRows.join('\n')
  );
  
  // Write JSON for further analysis
  await fs.writeFile(
    'data/datasets/surf-clothing/lohas-classification-results.json',
    JSON.stringify({
      summary: {
        totalRespondents: total,
        segmentDistribution: segmentCounts,
        segmentPercentages: Object.fromEntries(
          Object.entries(segmentCounts).map(([k, v]) => [k, ((v / total) * 100).toFixed(1) + '%'])
        ),
        propensityDistribution: propensityCounts,
        expectedDistribution: expectedRanges
      },
      classifications: classifications
    }, null, 2)
  );
  
  console.log('\n' + '='.repeat(100));
  console.log('FILES EXPORTED:');
  console.log('='.repeat(100));
  console.log('CSV: data/datasets/surf-clothing/lohas-classification-results.csv');
  console.log('JSON: data/datasets/surf-clothing/lohas-classification-results.json');
  
  return {
    segmentCounts,
    propensityCounts,
    total
  };
}

// Run the classification
classifyLOHASSegments()
  .then(classifications => analyzeAndExport(classifications))
  .then(() => {
    console.log('\n' + '='.repeat(100));
    console.log('CLASSIFICATION COMPLETE');
    console.log('='.repeat(100));
  })
  .catch(console.error);