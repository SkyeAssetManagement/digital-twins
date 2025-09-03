import * as XLSX from 'xlsx';
import fs from 'fs/promises';
import path from 'path';

async function analyzeValuesVsPayment() {
  const filePath = 'data/datasets/surf-clothing/raw/All_Surf_detail 2.xlsx';
  
  // Read the Excel file
  const fileContent = await fs.readFile(filePath);
  const workbook = XLSX.read(fileContent, { cellStyles: true, cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  // Process headers - concatenate row 1 and row 2
  const mainHeaders = data[0] || [];
  const subHeaders = data[1] || [];
  const fullQuestions = [];
  
  // Fill forward main headers and concatenate with sub-headers
  let currentMainHeader = '';
  for (let i = 0; i < Math.max(mainHeaders.length, subHeaders.length); i++) {
    if (mainHeaders[i]) {
      currentMainHeader = mainHeaders[i];
    }
    const subHeader = subHeaders[i] || '';
    const fullQuestion = subHeader ? `${currentMainHeader} - ${subHeader}` : currentMainHeader;
    fullQuestions.push(fullQuestion);
  }
  
  // Identify payment propensity questions (willingness to pay premium)
  const paymentPropensityIndices = [];
  const priceImportanceIndices = [];
  
  for (let i = 0; i < fullQuestions.length; i++) {
    const q = fullQuestions[i].toLowerCase();
    
    // Find questions about willingness to pay more for sustainability
    if ((q.includes('pay') && (q.includes('more') || q.includes('extra') || q.includes('premium'))) ||
        (q.includes('price') && q.includes('willing')) ||
        (q.includes('cost') && q.includes('sustainability'))) {
      paymentPropensityIndices.push(i);
    }
    
    // Find questions about price importance (inverse predictor)
    if (q.includes('price') && (q.includes('important') || q.includes('value'))) {
      priceImportanceIndices.push(i);
    }
  }
  
  // Identify values/behavior questions (NOT purchase-related)
  const valuesBehaviorQuestions = [];
  
  for (let i = 0; i < fullQuestions.length; i++) {
    const q = fullQuestions[i].toLowerCase();
    
    // Skip purchase-related questions
    if (q.includes('purchase') || q.includes('bought') || q.includes('buy') || 
        q.includes('shopping') || q.includes('retail') || q.includes('store')) {
      continue;
    }
    
    // Include values, lifestyle, and belief questions
    if (q.includes('agree') || q.includes('statement') || q.includes('belief') ||
        q.includes('think') || q.includes('feel') || q.includes('lifestyle') ||
        q.includes('environment') || q.includes('social') || q.includes('community') ||
        q.includes('future') || q.includes('generation') || q.includes('responsibility') ||
        q.includes('awareness') || q.includes('concern') || q.includes('support') ||
        q.includes('trust') || q.includes('authentic') || q.includes('transparent')) {
      valuesBehaviorQuestions.push({
        index: i,
        question: fullQuestions[i]
      });
    }
  }
  
  console.log(`Found ${valuesBehaviorQuestions.length} values/behavior questions`);
  console.log(`Found ${paymentPropensityIndices.length} payment propensity questions`);
  console.log(`Found ${priceImportanceIndices.length} price importance questions`);
  
  // Calculate correlation between each values question and payment propensity
  const correlations = [];
  
  for (const vq of valuesBehaviorQuestions) {
    const valueResponses = [];
    const paymentScores = [];
    
    // For each respondent (skip header rows)
    for (let row = 2; row < Math.min(data.length, 1000); row++) {
      const responses = data[row];
      if (!responses || responses.length < 10) continue;
      
      // Get value/behavior response
      const valueResponse = responses[vq.index];
      if (!valueResponse) continue;
      
      // Calculate payment propensity score for this respondent
      let paymentScore = 0;
      let paymentCount = 0;
      
      // Use sustainability importance questions as proxy for payment willingness
      const sustainabilityQuestions = fullQuestions.map((q, idx) => {
        const ql = q.toLowerCase();
        if ((ql.includes('organic') || ql.includes('fairtrade') || ql.includes('recycled')) &&
            ql.includes('important')) {
          return idx;
        }
        return -1;
      }).filter(idx => idx >= 0);
      
      for (const idx of sustainabilityQuestions) {
        const response = responses[idx];
        if (response) {
          paymentScore += scoreResponse(response);
          paymentCount++;
        }
      }
      
      // Also check price sensitivity (inverse)
      for (const idx of priceImportanceIndices) {
        const response = responses[idx];
        if (response) {
          // Invert price importance (high price importance = low payment willingness)
          paymentScore += (6 - scoreResponse(response));
          paymentCount++;
        }
      }
      
      if (paymentCount > 0) {
        valueResponses.push(scoreResponse(valueResponse));
        paymentScores.push(paymentScore / paymentCount);
      }
    }
    
    // Calculate correlation if we have enough data
    if (valueResponses.length >= 20) {
      const correlation = calculateCorrelation(valueResponses, paymentScores);
      correlations.push({
        question: vq.question,
        index: vq.index,
        correlation: correlation,
        sampleSize: valueResponses.length,
        avgValueScore: average(valueResponses),
        avgPaymentScore: average(paymentScores)
      });
    }
  }
  
  // Sort by absolute correlation strength
  correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  
  // Get top correlations
  const topPositive = correlations.filter(c => c.correlation > 0).slice(0, 10);
  const topNegative = correlations.filter(c => c.correlation < 0).slice(0, 5);
  
  return {
    topPredictors: correlations.slice(0, 20),
    topPositive,
    topNegative,
    totalQuestionsAnalyzed: valuesBehaviorQuestions.length
  };
}

function scoreResponse(response) {
  if (!response) return 3; // neutral default
  
  const responseStr = response.toString().toLowerCase();
  
  // Try to parse as number first (1-5 scale)
  const num = parseFloat(responseStr);
  if (!isNaN(num) && num >= 1 && num <= 5) return num;
  
  // Text-based responses
  if (responseStr.includes('strongly agree') || responseStr.includes('very important') || 
      responseStr.includes('extremely')) return 5;
  if (responseStr.includes('agree') || responseStr.includes('important')) return 4;
  if (responseStr.includes('neutral') || responseStr.includes('neither') || 
      responseStr.includes('somewhat')) return 3;
  if (responseStr.includes('disagree') || responseStr.includes('not important') ||
      responseStr.includes('not very')) return 2;
  if (responseStr.includes('strongly disagree') || responseStr.includes('not at all')) return 1;
  
  // Yes/No responses
  if (responseStr === 'yes' || responseStr === 'y') return 5;
  if (responseStr === 'no' || responseStr === 'n') return 1;
  
  return 3; // default neutral
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

function average(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// Run analysis
analyzeValuesVsPayment().then(results => {
  console.log('\n=== VALUES/BEHAVIOR PREDICTORS OF PAYMENT PROPENSITY ===\n');
  console.log(`Analyzed ${results.totalQuestionsAnalyzed} values/behavior questions\n`);
  
  console.log('TOP 3 VALUES/BEHAVIOR PREDICTORS OF WILLINGNESS TO PAY PREMIUM:\n');
  console.log('=' .repeat(80));
  
  results.topPredictors.slice(0, 3).forEach((item, i) => {
    console.log(`\n${i + 1}. ${item.question}`);
    console.log(`   Correlation: ${item.correlation.toFixed(3)}`);
    console.log(`   Predictive Power: ${Math.abs(item.correlation * 100).toFixed(1)}%`);
    console.log(`   Average Score: ${item.avgValueScore.toFixed(2)}/5`);
    console.log(`   Sample Size: ${item.sampleSize} respondents`);
    
    if (item.correlation > 0) {
      console.log(`   Interpretation: Higher agreement → Higher willingness to pay premium`);
    } else {
      console.log(`   Interpretation: Higher agreement → Lower willingness to pay premium`);
    }
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('\nADDITIONAL HIGH-CORRELATION QUESTIONS:\n');
  
  results.topPredictors.slice(3, 10).forEach((item, i) => {
    console.log(`${i + 4}. ${item.question.substring(0, 80)}...`);
    console.log(`   Correlation: ${item.correlation.toFixed(3)}`);
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('\nKEY INSIGHTS:\n');
  
  if (results.topPredictors.length > 0) {
    const strongestPredictor = results.topPredictors[0];
    console.log(`• Strongest predictor: Questions about ${
      strongestPredictor.question.includes('environment') ? 'environmental values' :
      strongestPredictor.question.includes('future') ? 'future orientation' :
      strongestPredictor.question.includes('social') ? 'social responsibility' :
      strongestPredictor.question.includes('trust') ? 'brand trust' :
      'personal values'
    }`);
    
    const avgCorrelation = average(results.topPredictors.slice(0, 3).map(p => Math.abs(p.correlation)));
    console.log(`• Average correlation strength of top 3: ${(avgCorrelation * 100).toFixed(1)}%`);
    
    const positiveCount = results.topPredictors.filter(p => p.correlation > 0).length;
    const negativeCount = results.topPredictors.filter(p => p.correlation < 0).length;
    console.log(`• ${positiveCount} positive predictors, ${negativeCount} negative predictors`);
  }
  
  // Save results to file
  return fs.writeFile(
    'data/datasets/surf-clothing/values-payment-analysis.json',
    JSON.stringify(results, null, 2)
  );
}).catch(console.error);