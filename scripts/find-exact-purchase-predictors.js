import * as XLSX from 'xlsx';
import fs from 'fs/promises';
import path from 'path';

async function findExactPurchasePredictors() {
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
  
  // Find LOHAS purchase behavior questions (these are our target variables)
  const lohasPurchaseIndices = [];
  
  for (let i = 0; i < fullQuestions.length; i++) {
    const q = fullQuestions[i].toLowerCase();
    
    // Questions about actual LOHAS purchasing behavior
    if ((q.includes('chosen') && q.includes('sustainability')) ||
        (q.includes('purchased') && (q.includes('organic') || q.includes('fairtrade') || q.includes('recycled'))) ||
        (q.includes('buy') && q.includes('sustainable')) ||
        (q.includes('willing to pay') && (q.includes('more') || q.includes('25%')))) {
      lohasPurchaseIndices.push({
        index: i,
        question: fullQuestions[i],
        type: 'purchase_behavior'
      });
    }
  }
  
  console.log(`\nFound ${lohasPurchaseIndices.length} LOHAS purchase behavior questions:\n`);
  lohasPurchaseIndices.forEach((q, idx) => {
    console.log(`${idx + 1}. [Column ${q.index}] ${q.question}`);
  });
  
  // Now find ALL questions that could predict these behaviors
  const allPredictorQuestions = [];
  
  for (let i = 0; i < fullQuestions.length; i++) {
    const q = fullQuestions[i];
    
    // Skip if it's one of our target variables
    if (lohasPurchaseIndices.find(lp => lp.index === i)) continue;
    
    // Skip administrative questions
    if (i < 9) continue; // Skip respondent ID, timestamps, etc.
    
    // Include all substantive questions
    if (q && q.length > 10) {
      allPredictorQuestions.push({
        index: i,
        question: q
      });
    }
  }
  
  // Calculate correlations between each question and LOHAS purchase behaviors
  const correlations = [];
  
  // Use the main LOHAS purchase question as our target
  const targetIndex = lohasPurchaseIndices.find(q => 
    q.question.toLowerCase().includes('chosen') && 
    q.question.toLowerCase().includes('sustainability')
  )?.index || lohasPurchaseIndices[0]?.index;
  
  if (!targetIndex) {
    console.log('\nNo clear LOHAS purchase question found. Using sustainability importance as proxy.');
    return;
  }
  
  console.log(`\n\nUsing as target variable: ${fullQuestions[targetIndex]}\n`);
  
  for (const pq of allPredictorQuestions) {
    const predictorResponses = [];
    const targetResponses = [];
    
    // For each respondent
    for (let row = 2; row < Math.min(data.length, 1000); row++) {
      const responses = data[row];
      if (!responses || responses.length < 10) continue;
      
      const predictorValue = responses[pq.index];
      const targetValue = responses[targetIndex];
      
      if (predictorValue && targetValue) {
        predictorResponses.push(scoreResponse(predictorValue));
        targetResponses.push(scoreResponse(targetValue));
      }
    }
    
    // Calculate correlation if we have enough data
    if (predictorResponses.length >= 50) {
      const correlation = calculateCorrelation(predictorResponses, targetResponses);
      correlations.push({
        question: pq.question,
        index: pq.index,
        correlation: correlation,
        sampleSize: predictorResponses.length
      });
    }
  }
  
  // Sort by absolute correlation strength
  correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  
  // Group by question type
  const groupedQuestions = {
    values: [],
    importance: [],
    behavior: [],
    demographics: [],
    other: []
  };
  
  correlations.forEach(c => {
    const q = c.question.toLowerCase();
    
    if (q.includes('agree') || q.includes('statement') || q.includes('belief')) {
      groupedQuestions.values.push(c);
    } else if (q.includes('important') || q.includes('consideration')) {
      groupedQuestions.importance.push(c);
    } else if (q.includes('have you') || q.includes('do you') || q.includes('participated')) {
      groupedQuestions.behavior.push(c);
    } else if (q.includes('age') || q.includes('gender') || q.includes('income') || q.includes('education')) {
      groupedQuestions.demographics.push(c);
    } else {
      groupedQuestions.other.push(c);
    }
  });
  
  return {
    targetQuestion: fullQuestions[targetIndex],
    topOverall: correlations.slice(0, 10),
    grouped: groupedQuestions
  };
}

function scoreResponse(response) {
  if (!response) return 0;
  
  const responseStr = response.toString().toLowerCase().trim();
  
  // Handle Yes/No
  if (responseStr === 'yes' || responseStr === 'y' || responseStr === '1') return 5;
  if (responseStr === 'no' || responseStr === 'n' || responseStr === '0') return 1;
  
  // Try to parse as number
  const num = parseFloat(responseStr);
  if (!isNaN(num)) {
    if (num >= 1 && num <= 5) return num;
    if (num === 0) return 1;
    if (num > 5) return 5;
  }
  
  // Text-based responses for agreement/importance
  if (responseStr.includes('strongly agree') || responseStr.includes('very important') || 
      responseStr.includes('extremely') || responseStr.includes('always')) return 5;
  if (responseStr.includes('agree') || responseStr.includes('important') || 
      responseStr.includes('often') || responseStr.includes('usually')) return 4;
  if (responseStr.includes('neutral') || responseStr.includes('neither') || 
      responseStr.includes('somewhat') || responseStr.includes('sometimes')) return 3;
  if (responseStr.includes('disagree') || responseStr.includes('not important') ||
      responseStr.includes('rarely') || responseStr.includes('not very')) return 2;
  if (responseStr.includes('strongly disagree') || responseStr.includes('not at all') ||
      responseStr.includes('never')) return 1;
  
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

// Run analysis
findExactPurchasePredictors().then(results => {
  if (!results) return;
  
  console.log('=' .repeat(100));
  console.log('\nEXACT QUESTIONS THAT PREDICT LOHAS PURCHASING DECISIONS\n');
  console.log('=' .repeat(100));
  
  console.log(`\nTarget Variable: ${results.targetQuestion}\n`);
  
  console.log('\nTOP 10 OVERALL PREDICTORS:\n');
  results.topOverall.forEach((item, i) => {
    console.log(`${i + 1}. [Correlation: ${item.correlation.toFixed(3)}]`);
    console.log(`   ${item.question}`);
    console.log(`   Column: ${item.index} | Sample: ${item.sampleSize}`);
    console.log();
  });
  
  console.log('\n' + '=' .repeat(100));
  console.log('\nTOP PREDICTORS BY CATEGORY:\n');
  
  console.log('\nVALUES/BELIEFS (Top 5):');
  results.grouped.values.slice(0, 5).forEach((item, i) => {
    console.log(`${i + 1}. [${item.correlation.toFixed(3)}] ${item.question.substring(0, 120)}...`);
  });
  
  console.log('\nIMPORTANCE RATINGS (Top 5):');
  results.grouped.importance.slice(0, 5).forEach((item, i) => {
    console.log(`${i + 1}. [${item.correlation.toFixed(3)}] ${item.question.substring(0, 120)}...`);
  });
  
  console.log('\nBEHAVIORS (Top 5):');
  results.grouped.behavior.slice(0, 5).forEach((item, i) => {
    console.log(`${i + 1}. [${item.correlation.toFixed(3)}] ${item.question.substring(0, 120)}...`);
  });
  
  // Save detailed results
  return fs.writeFile(
    'data/datasets/surf-clothing/exact-purchase-predictors.json',
    JSON.stringify(results, null, 2)
  );
}).catch(console.error);