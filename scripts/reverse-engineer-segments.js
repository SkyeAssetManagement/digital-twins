import * as XLSX from 'xlsx';
import fs from 'fs/promises';
import path from 'path';

// LOHAS Segment Characteristics from PDF research
const SEGMENT_PROFILES = {
  leader: {
    name: 'Leader',
    characteristics: {
      sustainability_importance: 'very_high',
      organic_preference: 'strongly_prefer',
      fairtrade_support: 'very_important',
      recycled_materials: 'very_important',
      price_sensitivity: 'low',
      brand_loyalty: 'high_to_sustainable',
      future_focus: 'very_high'
    },
    description: 'Highly committed to sustainability, willing to pay premium for eco-friendly products'
  },
  leaning: {
    name: 'Leaning',
    characteristics: {
      sustainability_importance: 'high',
      organic_preference: 'prefer',
      fairtrade_support: 'important',
      recycled_materials: 'important',
      price_sensitivity: 'moderate',
      brand_loyalty: 'moderate',
      future_focus: 'high'
    },
    description: 'Interested in sustainability but balances with other factors like price'
  },
  learner: {
    name: 'Learner',
    characteristics: {
      sustainability_importance: 'moderate',
      organic_preference: 'neutral',
      fairtrade_support: 'somewhat_important',
      recycled_materials: 'somewhat_important',
      price_sensitivity: 'high',
      brand_loyalty: 'price_driven',
      future_focus: 'moderate'
    },
    description: 'Open to sustainability but needs education and convincing'
  },
  laggard: {
    name: 'Laggard',
    characteristics: {
      sustainability_importance: 'low',
      organic_preference: 'not_important',
      fairtrade_support: 'not_important',
      recycled_materials: 'not_important',
      price_sensitivity: 'very_high',
      brand_loyalty: 'price_only',
      future_focus: 'low'
    },
    description: 'Not interested in sustainability, focused on price and convenience'
  }
};

async function analyzeAndClassify() {
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
  
  // Key questions for classification (based on LOHAS criteria)
  const KEY_QUESTIONS = {
    // Sustainability purchase behavior
    sustainability_purchase: findQuestionIndex(fullQuestions, 
      ['chosen a surf clothing product specifically because of its sustainability']),
    
    // Importance of sustainability attributes
    organic_importance: findQuestionIndex(fullQuestions, 
      ['Organic materials', 'organic cotton', 'pesticides']),
    
    fairtrade_importance: findQuestionIndex(fullQuestions, 
      ['Fairtrade materials', 'fair trade', 'developing countries']),
    
    recycled_importance: findQuestionIndex(fullQuestions, 
      ['Recycled materials', 'recycled polyester', 're-used plastic']),
    
    // Future sustainability outlook
    future_sustainability: findQuestionIndex(fullQuestions, 
      ['Five years from now', 'sustainability aspects', 'future']),
    
    // Brand sustainability perception
    brand_sustainability: findQuestionIndex(fullQuestions, 
      ['brands in the surf industry', 'focus on being sustainable']),
    
    // Price sensitivity
    price_importance: findQuestionIndex(fullQuestions, 
      ['Price', 'cost', 'value for money']),
    
    // Quality importance
    quality_importance: findQuestionIndex(fullQuestions, 
      ['Quality', 'durability', 'long lasting']),
    
    // Brand importance
    brand_importance: findQuestionIndex(fullQuestions, 
      ['Brand', 'brand name', 'brand reputation'])
  };
  
  // Process each respondent and classify them
  const respondents = [];
  const segmentCounts = { leader: 0, leaning: 0, learner: 0, laggard: 0 };
  
  for (let row = 2; row < data.length; row++) {
    const responses = data[row];
    if (!responses || responses.length < 10) continue;
    
    const respondentId = responses[0];
    const scores = calculateSegmentScores(responses, KEY_QUESTIONS);
    const segment = classifyRespondent(scores);
    
    respondents.push({
      id: respondentId,
      segment: segment,
      scores: scores,
      responses: extractKeyResponses(responses, KEY_QUESTIONS)
    });
    
    segmentCounts[segment]++;
  }
  
  // Calculate percentages
  const totalRespondents = respondents.length;
  const distribution = {};
  for (const [segment, count] of Object.entries(segmentCounts)) {
    distribution[segment] = {
      count: count,
      percentage: ((count / totalRespondents) * 100).toFixed(1)
    };
  }
  
  // Identify most discriminating questions
  const questionImportance = analyzeQuestionImportance(respondents, KEY_QUESTIONS, fullQuestions);
  
  return {
    totalRespondents,
    distribution,
    keyQuestions: questionImportance,
    fullQuestions: KEY_QUESTIONS
  };
}

function findQuestionIndex(questions, keywords) {
  const indices = [];
  for (let i = 0; i < questions.length; i++) {
    const question = (questions[i] || '').toLowerCase();
    for (const keyword of keywords) {
      if (question.includes(keyword.toLowerCase())) {
        indices.push(i);
        break;
      }
    }
  }
  return indices;
}

function calculateSegmentScores(responses, keyQuestions) {
  const scores = {
    sustainability: 0,
    price_focus: 0,
    brand_focus: 0,
    future_oriented: 0
  };
  
  // Score sustainability questions (higher score = more sustainable)
  const sustainabilityQuestions = [
    ...keyQuestions.sustainability_purchase,
    ...keyQuestions.organic_importance,
    ...keyQuestions.fairtrade_importance,
    ...keyQuestions.recycled_importance,
    ...keyQuestions.brand_sustainability
  ];
  
  for (const idx of sustainabilityQuestions) {
    const response = responses[idx];
    scores.sustainability += scoreResponse(response, 'sustainability');
  }
  
  // Score price sensitivity (higher score = more price sensitive)
  for (const idx of keyQuestions.price_importance) {
    const response = responses[idx];
    scores.price_focus += scoreResponse(response, 'importance');
  }
  
  // Score future orientation
  for (const idx of keyQuestions.future_sustainability) {
    const response = responses[idx];
    scores.future_oriented += scoreResponse(response, 'future');
  }
  
  // Normalize scores
  scores.sustainability = scores.sustainability / Math.max(1, sustainabilityQuestions.length);
  scores.price_focus = scores.price_focus / Math.max(1, keyQuestions.price_importance.length);
  scores.future_oriented = scores.future_oriented / Math.max(1, keyQuestions.future_sustainability.length);
  
  return scores;
}

function scoreResponse(response, type) {
  if (!response) return 0;
  
  const responseStr = response.toString().toLowerCase();
  
  // Scoring for different response types
  if (type === 'sustainability') {
    if (responseStr.includes('yes') || responseStr.includes('very important') || 
        responseStr.includes('strongly agree') || responseStr === '5') return 5;
    if (responseStr.includes('important') || responseStr.includes('agree') || 
        responseStr === '4') return 4;
    if (responseStr.includes('neutral') || responseStr === '3') return 3;
    if (responseStr.includes('not important') || responseStr.includes('disagree') || 
        responseStr === '2') return 2;
    if (responseStr.includes('not at all') || responseStr.includes('strongly disagree') || 
        responseStr === '1') return 1;
    return 2.5; // default neutral
  }
  
  if (type === 'importance' || type === 'future') {
    // Try to parse as number (1-5 scale)
    const num = parseFloat(responseStr);
    if (!isNaN(num) && num >= 1 && num <= 5) return num;
    
    // Text-based responses
    if (responseStr.includes('very') || responseStr.includes('extremely')) return 5;
    if (responseStr.includes('important') || responseStr.includes('high')) return 4;
    if (responseStr.includes('somewhat') || responseStr.includes('moderate')) return 3;
    if (responseStr.includes('not very') || responseStr.includes('low')) return 2;
    if (responseStr.includes('not at all') || responseStr.includes('none')) return 1;
    return 3; // default neutral
  }
  
  return 0;
}

function classifyRespondent(scores) {
  // Classification logic based on score thresholds
  const { sustainability, price_focus, future_oriented } = scores;
  
  // Leader: High sustainability, low price sensitivity, high future focus
  if (sustainability >= 4 && price_focus <= 3 && future_oriented >= 4) {
    return 'leader';
  }
  
  // Leaning: Moderate-high sustainability, moderate price sensitivity
  if (sustainability >= 3.5 && sustainability < 4 && future_oriented >= 3.5) {
    return 'leaning';
  }
  
  // Laggard: Low sustainability, high price sensitivity
  if (sustainability < 2.5 && price_focus >= 3.5) {
    return 'laggard';
  }
  
  // Learner: Everyone else (moderate on all dimensions)
  return 'learner';
}

function extractKeyResponses(responses, keyQuestions) {
  const extracted = {};
  for (const [key, indices] of Object.entries(keyQuestions)) {
    extracted[key] = indices.map(idx => responses[idx]).filter(r => r);
  }
  return extracted;
}

function analyzeQuestionImportance(respondents, keyQuestions, fullQuestions) {
  // Analyze which questions best discriminate between segments
  const questionScores = [];
  
  for (const [questionKey, indices] of Object.entries(keyQuestions)) {
    if (indices.length === 0) continue;
    
    // Calculate variance in responses across segments for each question
    const segmentAverages = {};
    for (const segment of ['leader', 'leaning', 'learner', 'laggard']) {
      const segmentRespondents = respondents.filter(r => r.segment === segment);
      const values = [];
      for (const r of segmentRespondents) {
        const responses = r.responses[questionKey];
        if (responses && responses.length > 0) {
          values.push(...responses.map(v => scoreResponse(v, 'importance')));
        }
      }
      segmentAverages[segment] = values.length > 0 ? 
        values.reduce((a, b) => a + b, 0) / values.length : 0;
    }
    
    // Calculate variance between segments
    const avgValues = Object.values(segmentAverages);
    const mean = avgValues.reduce((a, b) => a + b, 0) / avgValues.length;
    const variance = avgValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / avgValues.length;
    
    questionScores.push({
      key: questionKey,
      question: indices.length > 0 ? fullQuestions[indices[0]] : questionKey,
      variance: variance,
      segmentAverages: segmentAverages
    });
  }
  
  // Sort by variance (higher variance = better discriminator)
  questionScores.sort((a, b) => b.variance - a.variance);
  
  return questionScores.slice(0, 10); // Return top 10
}

// Run analysis
analyzeAndClassify().then(results => {
  console.log('=== LOHAS SEGMENT CLASSIFICATION ANALYSIS ===\n');
  console.log(`Total Respondents Analyzed: ${results.totalRespondents}\n`);
  
  console.log('Segment Distribution (Reverse-Engineered):');
  console.log('------------------------------------------');
  for (const [segment, data] of Object.entries(results.distribution)) {
    console.log(`${segment.toUpperCase()}: ${data.count} respondents (${data.percentage}%)`);
  }
  
  console.log('\nMost Important Questions for Classification:');
  console.log('--------------------------------------------');
  results.keyQuestions.forEach((q, i) => {
    console.log(`\n${i + 1}. ${q.question}`);
    console.log(`   Discrimination Power: ${q.variance.toFixed(3)}`);
    console.log(`   Average Scores by Segment:`);
    for (const [seg, avg] of Object.entries(q.segmentAverages)) {
      console.log(`     ${seg}: ${avg.toFixed(2)}`);
    }
  });
  
  // Save results
  return fs.writeFile(
    'data/datasets/surf-clothing/segment-classification.json',
    JSON.stringify(results, null, 2)
  );
}).catch(console.error);