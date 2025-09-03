import * as XLSX from 'xlsx';
import fs from 'fs/promises';
import path from 'path';

async function refineClassifyLOHASSegments() {
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
  
  // REFINED classification variables with adjusted weights
  const CLASSIFICATION_VARIABLES = {
    // PRIMARY INDICATORS (Highest weight)
    actualSustainablePurchase: {
      index: 69,
      weight: 2.5,  // Reduced from 3.0
      name: "Actual sustainable purchase"
    },
    
    willingnessToPay25: {
      index: 145,
      weight: 2.0,
      name: "Willingness to pay 25% premium"
    },
    
    // BRAND ENGAGEMENT
    patagoniaWornWear: {
      index: 117,
      weight: 1.5,  // Reduced from 2.0
      name: "Patagonia Worn Wear awareness"
    },
    
    // VALUES AND BELIEFS
    brandCommitment: {
      index: 154,
      weight: 1.2,
      name: "Brand values alignment"
    },
    
    environmentalEvangelism: {
      index: 151,
      weight: 1.2,
      name: "Environmental evangelism"
    },
    
    transparencyDesire: {
      index: 155,
      weight: 1.0,
      name: "Industry transparency desire"
    },
    
    // BEHAVIOR INDICATORS
    environmentalActivism: {
      index: 100,
      weight: 1.0,  // Reduced from 1.5
      name: "Environmental activism"
    },
    
    recyclingBehavior: {
      index: 148,
      weight: 0.8,
      name: "Recycling behavior"
    },
    
    // IMPORTANCE RATINGS
    sustainabilityImportance: {
      index: 59,
      weight: 1.2,
      name: "Sustainability importance"
    },
    
    organicImportance: {
      index: 62,
      weight: 0.8,
      name: "Organic materials importance"
    },
    
    // PRICE SENSITIVITY (inverted)
    priceImportance: {
      index: 57,
      weight: 0.8,  // Reduced from 1.0
      name: "Price sensitivity",
      invert: true
    }
  };
  
  // First pass: Calculate all scores
  const allScores = [];
  
  for (let row = 2; row < Math.min(data.length, 1008); row++) {
    const responses = data[row];
    if (!responses || responses.length < 150) continue;
    
    const respondentId = responses[0];
    
    // Calculate individual scores
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
    
    // Calculate normalized composite score
    const compositeScore = totalWeight > 0 ? weightedSum / totalWeight : 3;
    
    allScores.push({
      respondentId,
      row: row + 1,
      scores,
      compositeScore
    });
  }
  
  // Calculate percentiles for relative classification
  allScores.sort((a, b) => b.compositeScore - a.compositeScore);
  
  // Calculate thresholds based on expected distributions
  const total = allScores.length;
  const leaderThreshold = Math.floor(total * 0.125); // 12.5% (middle of 10-15%)
  const leaningThreshold = Math.floor(total * 0.35);  // 22.5% more = 35% total
  const learnerThreshold = Math.floor(total * 0.725); // 37.5% more = 72.5% total
  // Remaining 27.5% are Laggards
  
  // Second pass: Classify based on relative position AND absolute criteria
  const respondentClassifications = [];
  
  for (let i = 0; i < allScores.length; i++) {
    const record = allScores[i];
    
    // Calculate stratified propensity score
    const propensityScore = calculateRefinedPropensity(record.scores, record.compositeScore, i, total);
    
    // Determine segment based on position and criteria
    let segment = 'LOHAS Laggard'; // Default
    
    if (i < leaderThreshold) {
      // Top 12.5% - but must meet minimum criteria
      if (record.compositeScore >= 3.8 && 
          (record.scores.actualSustainablePurchase >= 4 || record.scores.willingnessToPay25 >= 4)) {
        segment = 'LOHAS Leader';
      } else {
        segment = 'LOHAS Leaning'; // Downgrade if criteria not met
      }
    } else if (i < leaningThreshold) {
      // Next 22.5%
      if (record.compositeScore >= 3.2 &&
          (record.scores.sustainabilityImportance >= 3 || record.scores.brandCommitment >= 3)) {
        segment = 'LOHAS Leaning';
      } else {
        segment = 'LOHAS Learner'; // Downgrade if criteria not met
      }
    } else if (i < learnerThreshold) {
      // Next 37.5%
      if (record.compositeScore >= 2.5) {
        segment = 'LOHAS Learner';
      } else {
        segment = 'LOHAS Laggard'; // Downgrade if very low score
      }
    }
    
    // Store classification with detailed workings
    respondentClassifications.push({
      respondentId: record.respondentId,
      row: record.row,
      percentileRank: ((1 - i/total) * 100).toFixed(1),
      
      // Individual scores
      actualPurchase: record.scores.actualSustainablePurchase || 'N/A',
      willingnessToPay: record.scores.willingnessToPay25 || 'N/A',
      patagoniaEngagement: record.scores.patagoniaWornWear || 'N/A',
      brandCommitment: record.scores.brandCommitment || 'N/A',
      environmentalEvangelism: record.scores.environmentalEvangelism || 'N/A',
      transparencyDesire: record.scores.transparencyDesire || 'N/A',
      environmentalActivism: record.scores.environmentalActivism || 'N/A',
      recyclingBehavior: record.scores.recyclingBehavior || 'N/A',
      sustainabilityImportance: record.scores.sustainabilityImportance || 'N/A',
      organicImportance: record.scores.organicImportance || 'N/A',
      priceInsensitivity: record.scores.priceImportance || 'N/A',
      
      // Composite scores
      compositeScore: record.compositeScore.toFixed(3),
      propensityScore: propensityScore.toFixed(3),
      propensityCategory: categorizePropensity(propensityScore),
      
      // Final classification
      lohasSegment: segment,
      
      // Classification reasoning
      classificationReasoning: getClassificationReasoning(
        record.scores, 
        record.compositeScore, 
        propensityScore, 
        segment,
        ((1 - i/total) * 100)
      )
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

function calculateRefinedPropensity(scores, compositeScore, rank, total) {
  // Start with percentile-based score
  const percentile = (1 - rank/total) * 100;
  let propensity = 1 + (percentile / 100) * 4; // Maps 0-100% to 1-5 scale
  
  // Apply behavior-based adjustments
  if (scores.actualSustainablePurchase === 5) {
    propensity = Math.min(5, propensity * 1.3); // 30% boost
  } else if (scores.actualSustainablePurchase === 1) {
    propensity = propensity * 0.75; // 25% penalty
  }
  
  // Willingness to pay adjustments
  if (scores.willingnessToPay25 >= 4) {
    propensity = Math.min(5, propensity * 1.15); // 15% boost
  } else if (scores.willingnessToPay25 <= 2) {
    propensity = propensity * 0.85; // 15% penalty
  }
  
  // Create clear stratification
  if (propensity >= 4.3) return 5.0;      // Very High
  if (propensity >= 3.6) return 4.0;      // High  
  if (propensity >= 2.8) return 3.0;      // Medium
  if (propensity >= 2.0) return 2.0;      // Low
  return 1.0;                             // Very Low
}

function categorizePropensity(propensityScore) {
  if (propensityScore >= 4.5) return 'Very High (Premium Payer - Proven)';
  if (propensityScore >= 3.5) return 'High (Premium Payer - Potential)';
  if (propensityScore >= 2.5) return 'Medium (Selective Payer)';
  if (propensityScore >= 1.5) return 'Low (Price Conscious)';
  return 'Very Low (Price Sensitive)';
}

function getClassificationReasoning(scores, compositeScore, propensityScore, segment, percentileRank) {
  const reasons = [];
  
  // Add percentile rank
  reasons.push(`Top ${percentileRank.toFixed(0)}% of respondents`);
  
  // Add propensity level
  const propCat = categorizePropensity(propensityScore);
  reasons.push(propCat.split(' (')[0] + ' propensity');
  
  // Add key behaviors
  if (scores.actualSustainablePurchase === 5) {
    reasons.push('Has purchased for sustainability');
  } else if (scores.actualSustainablePurchase === 1) {
    reasons.push('Never purchased for sustainability');
  }
  
  // Add key values
  if (scores.willingnessToPay25 >= 4) {
    reasons.push('Willing to pay 25% premium');
  }
  if (scores.environmentalEvangelism >= 4) {
    reasons.push('Environmental evangelist');
  }
  if (scores.brandCommitment >= 4) {
    reasons.push('Strong brand alignment');
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
  console.log('REFINED LOHAS SEGMENT CLASSIFICATION RESULTS');
  console.log('(Using Percentile-Based Approach with Stratified Propensity Scores)');
  console.log('='.repeat(100) + '\n');
  
  console.log('SEGMENT DISTRIBUTION COMPARISON:');
  console.log('-'.repeat(80));
  console.log('Segment         | My Classification | Report Expected | Difference');
  console.log('-'.repeat(80));
  
  const expectedRanges = {
    'LOHAS Leader': { min: 10, max: 15, mid: 12.5 },
    'LOHAS Leaning': { min: 20, max: 25, mid: 22.5 },
    'LOHAS Learner': { min: 35, max: 40, mid: 37.5 },
    'LOHAS Laggard': { min: 30, max: 35, mid: 32.5 }
  };
  
  for (const segment of ['LOHAS Leader', 'LOHAS Leaning', 'LOHAS Learner', 'LOHAS Laggard']) {
    const count = segmentCounts[segment] || 0;
    const percentage = (count / total) * 100;
    const expected = expectedRanges[segment];
    const diff = percentage - expected.mid;
    const diffStr = diff > 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`;
    
    console.log(`${segment.padEnd(15)} | ${count} (${percentage.toFixed(1)}%)`.padEnd(20) + 
                ` | ${expected.min}-${expected.max}%`.padEnd(16) + 
                ` | ${diffStr}`);
  }
  
  console.log('\n' + '='.repeat(100));
  console.log('PROPENSITY TO PAY DISTRIBUTION (Stratified):');
  console.log('='.repeat(100) + '\n');
  
  const propensityOrder = [
    'Very High (Premium Payer - Proven)',
    'High (Premium Payer - Potential)',
    'Medium (Selective Payer)',
    'Low (Price Conscious)',
    'Very Low (Price Sensitive)'
  ];
  
  for (const category of propensityOrder) {
    const count = propensityCounts[category] || 0;
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
      'Percentile Rank',
      'Propensity Score',
      'Propensity Category',
      'Composite Score',
      'Actual Purchase (1-5)',
      'Willingness to Pay 25% (1-5)',
      'Patagonia Engagement (1-5)',
      'Brand Commitment (1-5)',
      'Environmental Evangelism (1-5)',
      'Transparency Desire (1-5)',
      'Environmental Activism (1-5)',
      'Recycling Behavior (1-5)',
      'Sustainability Importance (1-5)',
      'Organic Importance (1-5)',
      'Price Insensitivity (1-5)',
      'Classification Reasoning'
    ].join(',')
  ];
  
  // Add data rows
  for (const record of classifications) {
    csvRows.push([
      record.respondentId,
      record.row,
      record.lohasSegment,
      record.percentileRank + '%',
      record.propensityScore,
      `"${record.propensityCategory}"`,
      record.compositeScore,
      record.actualPurchase,
      record.willingnessToPay,
      record.patagoniaEngagement,
      record.brandCommitment,
      record.environmentalEvangelism,
      record.transparencyDesire,
      record.environmentalActivism,
      record.recyclingBehavior,
      record.sustainabilityImportance,
      record.organicImportance,
      record.priceInsensitivity,
      `"${record.classificationReasoning}"`
    ].join(','));
  }
  
  // Write CSV file
  await fs.writeFile(
    'data/datasets/surf-clothing/refined-lohas-classification.csv',
    csvRows.join('\n')
  );
  
  // Write JSON for further analysis
  await fs.writeFile(
    'data/datasets/surf-clothing/refined-lohas-classification.json',
    JSON.stringify({
      summary: {
        totalRespondents: total,
        segmentDistribution: segmentCounts,
        segmentPercentages: Object.fromEntries(
          Object.entries(segmentCounts).map(([k, v]) => [k, ((v / total) * 100).toFixed(1) + '%'])
        ),
        propensityDistribution: propensityCounts,
        expectedDistribution: expectedRanges,
        comparisonWithReport: Object.fromEntries(
          Object.entries(segmentCounts).map(([segment, count]) => {
            const pct = (count / total) * 100;
            const expected = expectedRanges[segment];
            return [segment, {
              actual: `${pct.toFixed(1)}%`,
              expected: `${expected.min}-${expected.max}%`,
              difference: `${(pct - expected.mid).toFixed(1)}%`
            }];
          })
        )
      },
      classifications: classifications.slice(0, 100) // Sample for review
    }, null, 2)
  );
  
  console.log('\n' + '='.repeat(100));
  console.log('FILES EXPORTED:');
  console.log('='.repeat(100));
  console.log('CSV: data/datasets/surf-clothing/refined-lohas-classification.csv');
  console.log('JSON: data/datasets/surf-clothing/refined-lohas-classification.json');
  
  // Show sample of top scorers
  console.log('\n' + '='.repeat(100));
  console.log('SAMPLE OF TOP 5 LOHAS LEADERS:');
  console.log('='.repeat(100) + '\n');
  
  const leaders = classifications.filter(c => c.lohasSegment === 'LOHAS Leader').slice(0, 5);
  leaders.forEach((leader, i) => {
    console.log(`${i + 1}. Respondent ${leader.respondentId} (Row ${leader.row})`);
    console.log(`   Percentile: Top ${leader.percentileRank}%`);
    console.log(`   Propensity: ${leader.propensityCategory}`);
    console.log(`   Key scores: Purchase=${leader.actualPurchase}, WTP=${leader.willingnessToPay}, Patagonia=${leader.patagoniaEngagement}`);
    console.log();
  });
  
  return {
    segmentCounts,
    propensityCounts,
    total
  };
}

// Run the refined classification
refineClassifyLOHASSegments()
  .then(classifications => analyzeAndExport(classifications))
  .then(() => {
    console.log('\n' + '='.repeat(100));
    console.log('REFINED CLASSIFICATION COMPLETE');
    console.log('='.repeat(100));
  })
  .catch(console.error);