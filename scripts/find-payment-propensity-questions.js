import * as XLSX from 'xlsx';
import fs from 'fs/promises';
import path from 'path';

async function findPaymentPropensityQuestions() {
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
    fullQuestions.push({
      index: i,
      question: fullQuestion,
      mainHeader: currentMainHeader,
      subHeader: subHeader
    });
  }
  
  // Find all payment propensity questions
  const paymentQuestions = {
    direct: [],      // Directly asks about willingness to pay more
    price: [],       // Price sensitivity/importance questions
    value: [],       // Value for money questions
    purchase: [],    // Actual purchase behavior with price implications
    tradeoff: []     // Questions about trading off price for sustainability
  };
  
  for (let i = 0; i < fullQuestions.length; i++) {
    const q = fullQuestions[i].question.toLowerCase();
    const fullQ = fullQuestions[i];
    
    // Skip admin columns
    if (i < 9) continue;
    
    // Direct willingness to pay questions
    if ((q.includes('willing') && q.includes('pay')) ||
        (q.includes('pay') && (q.includes('more') || q.includes('extra') || q.includes('premium'))) ||
        (q.includes('pay') && q.includes('%')) ||
        (q.includes('price') && q.includes('willing'))) {
      paymentQuestions.direct.push(fullQ);
    }
    
    // Price sensitivity/importance questions
    else if ((q.includes('price') || q.includes('cost') || q.includes('expensive') || q.includes('afford')) &&
             (q.includes('important') || q.includes('factor') || q.includes('consider') || q.includes('influence'))) {
      paymentQuestions.price.push(fullQ);
    }
    
    // Value for money questions
    else if (q.includes('value') && (q.includes('money') || q.includes('price') || q.includes('worth'))) {
      paymentQuestions.value.push(fullQ);
    }
    
    // Purchase behavior questions that imply price decisions
    else if ((q.includes('chosen') || q.includes('bought') || q.includes('purchased')) &&
             (q.includes('sustainability') || q.includes('organic') || q.includes('fairtrade') || 
              q.includes('recycled') || q.includes('environmental'))) {
      paymentQuestions.purchase.push(fullQ);
    }
    
    // Trade-off questions (choosing sustainability over other factors)
    else if ((q.includes('rather') || q.includes('instead') || q.includes('over') || q.includes('versus')) &&
             (q.includes('sustain') || q.includes('environment') || q.includes('organic'))) {
      paymentQuestions.tradeoff.push(fullQ);
    }
  }
  
  // Also look for questions about:
  // - Budget allocation
  // - Spending patterns
  // - Premium brand purchases
  // - Quality vs price trade-offs
  
  for (let i = 0; i < fullQuestions.length; i++) {
    const q = fullQuestions[i].question.toLowerCase();
    const fullQ = fullQuestions[i];
    
    if (i < 9) continue;
    
    // Budget/spending questions
    if ((q.includes('budget') || q.includes('spend') || q.includes('allocate')) &&
        !paymentQuestions.direct.includes(fullQ) && !paymentQuestions.price.includes(fullQ)) {
      paymentQuestions.tradeoff.push(fullQ);
    }
    
    // Quality over price preferences
    if ((q.includes('quality') && q.includes('price')) ||
        (q.includes('cheap') && q.includes('quality'))) {
      if (!paymentQuestions.tradeoff.includes(fullQ)) {
        paymentQuestions.tradeoff.push(fullQ);
      }
    }
  }
  
  return paymentQuestions;
}

// Run analysis
findPaymentPropensityQuestions().then(results => {
  console.log('\n' + '='.repeat(100));
  console.log('POTENTIAL TARGET VARIABLE QUESTIONS FOR MEASURING PROPENSITY TO PAY');
  console.log('='.repeat(100) + '\n');
  
  console.log('CATEGORY 1: DIRECT WILLINGNESS TO PAY QUESTIONS');
  console.log('-'.repeat(50));
  if (results.direct.length > 0) {
    results.direct.forEach((q, i) => {
      console.log(`\n${i + 1}. [Column ${q.index}]`);
      console.log(`   "${q.question}"`);
      console.log(`   Type: Direct payment willingness`);
    });
  } else {
    console.log('No direct willingness to pay questions found.');
  }
  
  console.log('\n\nCATEGORY 2: PRICE SENSITIVITY/IMPORTANCE QUESTIONS');
  console.log('-'.repeat(50));
  if (results.price.length > 0) {
    results.price.forEach((q, i) => {
      console.log(`\n${i + 1}. [Column ${q.index}]`);
      console.log(`   "${q.question}"`);
      console.log(`   Type: Price sensitivity (inverse predictor)`);
    });
  } else {
    console.log('No price sensitivity questions found.');
  }
  
  console.log('\n\nCATEGORY 3: VALUE FOR MONEY QUESTIONS');
  console.log('-'.repeat(50));
  if (results.value.length > 0) {
    results.value.forEach((q, i) => {
      console.log(`\n${i + 1}. [Column ${q.index}]`);
      console.log(`   "${q.question}"`);
      console.log(`   Type: Value perception`);
    });
  } else {
    console.log('No value for money questions found.');
  }
  
  console.log('\n\nCATEGORY 4: ACTUAL PURCHASE BEHAVIOR (REVEALED PREFERENCE)');
  console.log('-'.repeat(50));
  if (results.purchase.length > 0) {
    results.purchase.forEach((q, i) => {
      console.log(`\n${i + 1}. [Column ${q.index}]`);
      console.log(`   "${q.question}"`);
      console.log(`   Type: Actual behavior (strongest indicator)`);
    });
  } else {
    console.log('No purchase behavior questions found.');
  }
  
  console.log('\n\nCATEGORY 5: TRADE-OFF QUESTIONS');
  console.log('-'.repeat(50));
  if (results.tradeoff.length > 0) {
    results.tradeoff.forEach((q, i) => {
      console.log(`\n${i + 1}. [Column ${q.index}]`);
      console.log(`   "${q.question}"`);
      console.log(`   Type: Trade-off preference`);
    });
  } else {
    console.log('No trade-off questions found.');
  }
  
  console.log('\n\n' + '='.repeat(100));
  console.log('RECOMMENDED COMPOSITE PROPENSITY TO PAY SCORE');
  console.log('='.repeat(100));
  
  console.log('\nTo create a robust propensity to pay measure, combine:');
  console.log('\n1. PRIMARY INDICATORS (highest weight):');
  console.log('   - Direct willingness to pay questions');
  console.log('   - Actual purchase behavior questions');
  
  console.log('\n2. SECONDARY INDICATORS (medium weight):');
  console.log('   - Price sensitivity questions (inverted)');
  console.log('   - Trade-off questions');
  
  console.log('\n3. SUPPORTING INDICATORS (lower weight):');
  console.log('   - Value for money perceptions');
  console.log('   - Quality vs price preferences');
  
  // Count totals
  const totalQuestions = 
    results.direct.length + 
    results.price.length + 
    results.value.length + 
    results.purchase.length + 
    results.tradeoff.length;
  
  console.log('\n\nSUMMARY STATISTICS:');
  console.log(`Total payment propensity questions found: ${totalQuestions}`);
  console.log(`- Direct willingness to pay: ${results.direct.length}`);
  console.log(`- Price sensitivity: ${results.price.length}`);
  console.log(`- Value for money: ${results.value.length}`);
  console.log(`- Purchase behavior: ${results.purchase.length}`);
  console.log(`- Trade-offs: ${results.tradeoff.length}`);
  
  // Save results to file
  return fs.writeFile(
    'data/datasets/surf-clothing/payment-propensity-questions.json',
    JSON.stringify(results, null, 2)
  );
}).catch(console.error);