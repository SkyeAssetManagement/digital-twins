import * as XLSX from 'xlsx';
import fs from 'fs/promises';
import path from 'path';

async function analyzeWeightedPropensity() {
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
  
  // Define target variables with weights (actual behavior weighted highest)
  const TARGET_VARIABLES = {
    actualPurchase: {
      index: 69,  // "Have you ever chosen a surf clothing product specifically because of its sustainability"
      weight: 0.5,  // 50% weight - HIGHEST because it's actual behavior
      name: "Actual sustainable purchase behavior",
      type: "revealed_preference"
    },
    willingnessToPay: {
      index: 145, // "I am willing to pay 25% more for environmentally friendly products"
      weight: 0.3,  // 30% weight - stated preference
      name: "Stated willingness to pay 25% premium",
      type: "stated_preference"
    },
    priceImportance: {
      index: 57,  // "How important is Price/Value"
      weight: 0.2,  // 20% weight - inverse indicator
      name: "Price sensitivity (inverted)",
      type: "price_sensitivity",
      invert: true
    }
  };
  
  // Calculate composite propensity score for each respondent
  const respondentScores = [];
  
  for (let row = 2; row < Math.min(data.length, 1008); row++) {
    const responses = data[row];
    if (!responses || responses.length < 150) continue;
    
    const respondentId = responses[0];
    
    // Get individual scores
    const scores = {};
    let compositeScore = 0;
    let validScores = 0;
    
    // Actual purchase (Yes/No -> 5/1)
    const actualPurchase = responses[TARGET_VARIABLES.actualPurchase.index];
    if (actualPurchase) {
      const purchaseStr = actualPurchase.toString().toLowerCase();
      scores.actualPurchase = (purchaseStr === 'yes' || purchaseStr === 'y' || purchaseStr === '1') ? 5 : 1;
      compositeScore += scores.actualPurchase * TARGET_VARIABLES.actualPurchase.weight;
      validScores += TARGET_VARIABLES.actualPurchase.weight;
    }
    
    // Willingness to pay (1-5 scale)
    const willingnessToPay = responses[TARGET_VARIABLES.willingnessToPay.index];
    if (willingnessToPay) {
      scores.willingnessToPay = scoreResponse(willingnessToPay);
      compositeScore += scores.willingnessToPay * TARGET_VARIABLES.willingnessToPay.weight;
      validScores += TARGET_VARIABLES.willingnessToPay.weight;
    }
    
    // Price importance (inverted: low importance = high propensity)
    const priceImportance = responses[TARGET_VARIABLES.priceImportance.index];
    if (priceImportance) {
      scores.priceImportance = 6 - scoreResponse(priceImportance); // Invert the scale
      compositeScore += scores.priceImportance * TARGET_VARIABLES.priceImportance.weight;
      validScores += TARGET_VARIABLES.priceImportance.weight;
    }
    
    // Normalize composite score
    if (validScores > 0) {
      compositeScore = compositeScore / validScores;
    }
    
    respondentScores.push({
      id: respondentId,
      row: row,
      scores: scores,
      compositeScore: compositeScore,
      propensityCategory: categorizePropensity(compositeScore, scores)
    });
  }
  
  // Now analyze which questions best predict this weighted propensity score
  const predictorQuestions = [];
  
  // Test all substantive questions as predictors
  for (let col = 9; col < fullQuestions.length; col++) {
    // Skip the target variables themselves
    if (col === 69 || col === 145 || col === 57) continue;
    
    const question = fullQuestions[col];
    if (!question || question.length < 10) continue;
    
    const predictorValues = [];
    const propensityScores = [];
    
    for (const respondent of respondentScores) {
      const response = data[respondent.row][col];
      if (response && respondent.compositeScore > 0) {
        predictorValues.push(scoreResponse(response));
        propensityScores.push(respondent.compositeScore);
      }
    }
    
    // Calculate correlation if we have enough data
    if (predictorValues.length >= 50) {
      const correlation = calculateCorrelation(predictorValues, propensityScores);
      predictorQuestions.push({
        index: col,
        question: question,
        correlation: correlation,
        sampleSize: predictorValues.length,
        category: categorizeQuestion(question)
      });
    }
  }
  
  // Sort by correlation strength
  predictorQuestions.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  
  // Analyze propensity distribution
  const distribution = analyzePropensityDistribution(respondentScores);
  
  return {
    targetWeights: TARGET_VARIABLES,
    topPredictors: predictorQuestions.slice(0, 20),
    distribution: distribution,
    respondentCount: respondentScores.length
  };
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
      responseStr.includes('extremely')) return 5;
  if (responseStr.includes('agree') || responseStr.includes('important')) return 4;
  if (responseStr.includes('neutral') || responseStr.includes('neither') || 
      responseStr.includes('somewhat')) return 3;
  if (responseStr.includes('disagree') || responseStr.includes('not important')) return 2;
  if (responseStr.includes('strongly disagree') || responseStr.includes('not at all')) return 1;
  
  // Yes/No
  if (responseStr === 'yes' || responseStr === 'y') return 5;
  if (responseStr === 'no' || responseStr === 'n') return 1;
  
  return 3;
}

function categorizePropensity(score, individualScores) {
  // Categorize based on composite score AND actual behavior
  if (individualScores.actualPurchase === 5) {
    // Has actually purchased for sustainability
    if (score >= 4) return 'Premium Payer (Proven)';
    if (score >= 3) return 'Selective Payer (Proven)';
    return 'Opportunistic Payer';
  } else {
    // Has not actually purchased for sustainability
    if (score >= 4) return 'Premium Payer (Potential)';
    if (score >= 3) return 'Interested Non-Payer';
    if (score >= 2) return 'Price Conscious';
    return 'Price Sensitive';
  }
}

function categorizeQuestion(question) {
  const q = question.toLowerCase();
  
  if (q.includes('agree') || q.includes('statement') || q.includes('belief')) return 'values';
  if (q.includes('important') || q.includes('consideration')) return 'importance';
  if (q.includes('have you') || q.includes('do you') || q.includes('participated')) return 'behavior';
  if (q.includes('age') || q.includes('gender') || q.includes('income')) return 'demographics';
  if (q.includes('brand') || q.includes('patagonia') || q.includes('rip curl')) return 'brand';
  if (q.includes('environment') || q.includes('sustain') || q.includes('organic')) return 'sustainability';
  return 'other';
}

function calculateCorrelation(x, y) {
  const n = x.length;
  if (n === 0) return 0;
  
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
  const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
  const sumY2 = y.reduce((total, yi) => total + yi * yi, 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  if (denominator === 0) return 0;
  return numerator / denominator;
}

function analyzePropensityDistribution(respondentScores) {
  const categories = {};
  const scoreRanges = {
    'Very High (4.5-5.0)': 0,
    'High (3.5-4.5)': 0,
    'Medium (2.5-3.5)': 0,
    'Low (1.5-2.5)': 0,
    'Very Low (1.0-1.5)': 0
  };
  
  for (const respondent of respondentScores) {
    // Count by category
    categories[respondent.propensityCategory] = (categories[respondent.propensityCategory] || 0) + 1;
    
    // Count by score range
    const score = respondent.compositeScore;
    if (score >= 4.5) scoreRanges['Very High (4.5-5.0)']++;
    else if (score >= 3.5) scoreRanges['High (3.5-4.5)']++;
    else if (score >= 2.5) scoreRanges['Medium (2.5-3.5)']++;
    else if (score >= 1.5) scoreRanges['Low (1.5-2.5)']++;
    else scoreRanges['Very Low (1.0-1.5)']++;
  }
  
  return {
    categories: categories,
    scoreRanges: scoreRanges,
    averageScore: respondentScores.reduce((sum, r) => sum + r.compositeScore, 0) / respondentScores.length
  };
}

// Run analysis
analyzeWeightedPropensity().then(results => {
  console.log('\n' + '='.repeat(100));
  console.log('WEIGHTED PROPENSITY TO PAY ANALYSIS');
  console.log('(Actual Behavior Weighted Highest)');
  console.log('='.repeat(100) + '\n');
  
  console.log('TARGET VARIABLE WEIGHTS:');
  console.log('-'.repeat(50));
  for (const [key, variable] of Object.entries(results.targetWeights)) {
    console.log(`${variable.name}:`);
    console.log(`  Weight: ${(variable.weight * 100).toFixed(0)}%`);
    console.log(`  Type: ${variable.type}`);
    console.log();
  }
  
  console.log('\nPROPENSITY SCORE DISTRIBUTION:');
  console.log('-'.repeat(50));
  console.log(`Total Respondents Analyzed: ${results.respondentCount}`);
  console.log(`Average Propensity Score: ${results.distribution.averageScore.toFixed(2)}/5.0`);
  
  console.log('\nScore Ranges:');
  for (const [range, count] of Object.entries(results.distribution.scoreRanges)) {
    const pct = ((count / results.respondentCount) * 100).toFixed(1);
    console.log(`  ${range}: ${count} respondents (${pct}%)`);
  }
  
  console.log('\nCustomer Categories:');
  for (const [category, count] of Object.entries(results.distribution.categories)) {
    const pct = ((count / results.respondentCount) * 100).toFixed(1);
    console.log(`  ${category}: ${count} (${pct}%)`);
  }
  
  console.log('\n' + '='.repeat(100));
  console.log('TOP 20 PREDICTORS OF WEIGHTED PROPENSITY TO PAY');
  console.log('='.repeat(100) + '\n');
  
  // Group predictors by category
  const byCategory = {};
  results.topPredictors.forEach(p => {
    if (!byCategory[p.category]) byCategory[p.category] = [];
    byCategory[p.category].push(p);
  });
  
  // Show top 3 from each category
  for (const [category, predictors] of Object.entries(byCategory)) {
    console.log(`\n${category.toUpperCase()} QUESTIONS:`);
    console.log('-'.repeat(50));
    
    predictors.slice(0, 3).forEach((item, i) => {
      console.log(`\n${i + 1}. [Correlation: ${item.correlation.toFixed(3)}] [Column ${item.index}]`);
      console.log(`   "${item.question}"`);
      
      if (item.correlation > 0) {
        console.log(`   → Higher agreement = Higher propensity to pay`);
      } else {
        console.log(`   → Higher agreement = Lower propensity to pay`);
      }
    });
  }
  
  console.log('\n' + '='.repeat(100));
  console.log('KEY INSIGHTS');
  console.log('='.repeat(100) + '\n');
  
  // Find strongest predictor overall
  const strongest = results.topPredictors[0];
  console.log(`1. STRONGEST PREDICTOR: ${strongest.question.substring(0, 80)}...`);
  console.log(`   Correlation: ${strongest.correlation.toFixed(3)}`);
  
  // Count positive vs negative predictors
  const positive = results.topPredictors.filter(p => p.correlation > 0).length;
  const negative = results.topPredictors.filter(p => p.correlation < 0).length;
  console.log(`\n2. DIRECTIONALITY: ${positive} positive predictors, ${negative} negative predictors`);
  
  // Average correlation strength
  const avgCorr = results.topPredictors.slice(0, 10)
    .reduce((sum, p) => sum + Math.abs(p.correlation), 0) / 10;
  console.log(`\n3. AVERAGE CORRELATION STRENGTH (Top 10): ${(avgCorr * 100).toFixed(1)}%`);
  
  // Save results
  return fs.writeFile(
    'data/datasets/surf-clothing/weighted-propensity-analysis.json',
    JSON.stringify(results, null, 2)
  );
}).catch(console.error);