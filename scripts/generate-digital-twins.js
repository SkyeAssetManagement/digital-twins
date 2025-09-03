import * as XLSX from 'xlsx';
import fs from 'fs/promises';
import path from 'path';

async function generateDigitalTwins() {
  console.log('Loading classification results and survey data...');
  
  // Load the classification results from CSV (has all records)
  const csvContent = await fs.readFile('data/datasets/surf-clothing/refined-lohas-classification.csv', 'utf-8');
  const csvLines = csvContent.split('\n');
  const headers = csvLines[0].split(',');
  
  // Parse CSV into classification data
  const classifications = [];
  for (let i = 1; i < csvLines.length; i++) {
    if (csvLines[i].trim()) {
      const values = csvLines[i].match(/(".*?"|[^,]+)/g);
      if (values && values.length > 3) {
        classifications.push({
          respondentId: values[0],
          row: parseInt(values[1]),
          lohasSegment: values[2],
          percentileRank: values[3],
          propensityScore: values[4],
          propensityCategory: values[5]?.replace(/"/g, ''),
          compositeScore: values[6],
          actualPurchase: values[7],
          willingnessToPay: values[8],
          patagoniaEngagement: values[9],
          brandCommitment: values[10],
          environmentalEvangelism: values[11],
          transparencyDesire: values[12],
          environmentalActivism: values[13],
          recyclingBehavior: values[14],
          sustainabilityImportance: values[15],
          organicImportance: values[16],
          priceInsensitivity: values[17],
          classificationReasoning: values[18]?.replace(/"/g, '')
        });
      }
    }
  }
  
  console.log(`Loaded ${classifications.length} classifications from CSV`);
  
  // Load the full survey data
  const filePath = 'data/datasets/surf-clothing/raw/All_Surf_detail 2.xlsx';
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
  
  // Define key questions for persona building
  const PERSONA_QUESTIONS = {
    demographics: {
      age: 3,
      gender: 4,
      income: 6,
      education: 5,
      location: 7
    },
    values: {
      brandAlignment: 154, // "I actively support brands that align with my values"
      environmentalEvangelism: 151, // "I encourage others to buy from environmentally responsible companies"
      transparency: 155, // "I want to see more transparency"
      recycling: 148, // "I always recycle"
      localSupport: 149, // "I try to buy from local businesses"
    },
    purchasing: {
      priceImportance: 57,
      qualityImportance: 56,
      sustainabilityImportance: 59,
      brandImportance: 58,
      styleImportance: 54,
      actualSustainablePurchase: 69,
      willingnessToPay10: 144,
      willingnessToPay25: 145,
    },
    brands: {
      patagonia: [115, 116, 117, 118], // Awareness, purchase, programs
      ripcurl: [119, 120, 121, 122],
      billabong: [123, 124, 125, 126],
      quiksilver: [127, 128, 129, 130],
      hurley: [131, 132, 133, 134],
    },
    activities: {
      beachCleanup: 100,
      environmentalDonation: 101,
      sustainableTransport: 102,
    },
    attitudes: {
      futureImportance: 143, // "Five years from now importance"
      industryPerception: 142, // "Brands have strong focus on sustainability"
      purchaseInfluence: 146, // "Sustainability influences my purchasing"
    }
  };
  
  // Group respondents by segment
  const segmentGroups = {
    'LOHAS Leader': [],
    'LOHAS Leaning': [],
    'LOHAS Learner': [],
    'LOHAS Laggard': []
  };
  
  // Process each classification
  for (const classification of classifications) {
    const row = classification.row - 1; // Convert to 0-indexed
    if (row >= 2 && row < data.length) {
      const responses = data[row];
      const segment = classification.lohasSegment;
      if (segmentGroups[segment]) {
        segmentGroups[segment].push({
          respondentId: classification.respondentId,
          classification: classification,
          responses: responses
        });
      }
    }
  }
  
  // Generate aggregate profiles for each segment
  const digitalTwins = {};
  
  for (const [segment, respondents] of Object.entries(segmentGroups)) {
    console.log(`\nAnalyzing ${segment} segment (${respondents.length} respondents)...`);
    
    const profile = {
      segment: segment,
      size: respondents.length,
      percentage: ((respondents.length / classifications.length) * 100).toFixed(1) + '%',
      
      // Demographics
      demographics: analyzedemographics(respondents, PERSONA_QUESTIONS.demographics),
      
      // Values profile
      values: analyzeValues(respondents, PERSONA_QUESTIONS.values, fullQuestions),
      
      // Purchasing behavior
      purchasing: analyzePurchasing(respondents, PERSONA_QUESTIONS.purchasing, fullQuestions),
      
      // Brand relationships
      brands: analyzeBrands(respondents, PERSONA_QUESTIONS.brands, fullQuestions),
      
      // Activities
      activities: analyzeActivities(respondents, PERSONA_QUESTIONS.activities, fullQuestions),
      
      // Attitudes
      attitudes: analyzeAttitudes(respondents, PERSONA_QUESTIONS.attitudes, fullQuestions),
      
      // Language patterns (from open-ended responses)
      language: analyzeLanguage(respondents, fullQuestions),
      
      // Key characteristics for persona
      keyCharacteristics: generateKeyCharacteristics(segment, respondents),
      
      // Response examples
      exampleResponses: generateExampleResponses(segment, respondents)
    };
    
    digitalTwins[segment] = profile;
  }
  
  return digitalTwins;
}

function analyzedemographics(respondents, demoIndices) {
  const demographics = {
    averageAge: 0,
    genderDistribution: {},
    incomeDistribution: {},
    educationLevels: {},
    locations: {}
  };
  
  const ages = [];
  
  for (const respondent of respondents) {
    // Age
    const age = respondent.responses[demoIndices.age];
    if (age && !isNaN(age)) {
      ages.push(Number(age));
    }
    
    // Gender
    const gender = respondent.responses[demoIndices.gender];
    if (gender) {
      demographics.genderDistribution[gender] = (demographics.genderDistribution[gender] || 0) + 1;
    }
    
    // Income
    const income = respondent.responses[demoIndices.income];
    if (income) {
      demographics.incomeDistribution[income] = (demographics.incomeDistribution[income] || 0) + 1;
    }
    
    // Education
    const education = respondent.responses[demoIndices.education];
    if (education) {
      demographics.educationLevels[education] = (demographics.educationLevels[education] || 0) + 1;
    }
  }
  
  if (ages.length > 0) {
    demographics.averageAge = (ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1);
    demographics.ageRange = `${Math.min(...ages)}-${Math.max(...ages)}`;
  }
  
  // Convert counts to percentages
  const total = respondents.length;
  for (const key of Object.keys(demographics.genderDistribution)) {
    const count = demographics.genderDistribution[key];
    demographics.genderDistribution[key] = `${((count / total) * 100).toFixed(0)}%`;
  }
  
  return demographics;
}

function analyzeValues(respondents, valueIndices, questions) {
  const values = {};
  
  for (const [key, index] of Object.entries(valueIndices)) {
    const scores = [];
    for (const respondent of respondents) {
      const score = scoreResponse(respondent.responses[index]);
      if (score) scores.push(score);
    }
    
    if (scores.length > 0) {
      const average = scores.reduce((a, b) => a + b, 0) / scores.length;
      values[key] = {
        averageScore: average.toFixed(2),
        interpretation: interpretScore(average),
        question: questions[index]
      };
    }
  }
  
  return values;
}

function analyzePurchasing(respondents, purchaseIndices, questions) {
  const purchasing = {};
  
  for (const [key, index] of Object.entries(purchaseIndices)) {
    const scores = [];
    let yesCount = 0;
    
    for (const respondent of respondents) {
      const response = respondent.responses[index];
      
      // Handle yes/no questions
      if (key === 'actualSustainablePurchase') {
        if (response && response.toString().toLowerCase().includes('yes')) {
          yesCount++;
        }
      } else {
        const score = scoreResponse(response);
        if (score) scores.push(score);
      }
    }
    
    if (key === 'actualSustainablePurchase') {
      purchasing[key] = {
        percentage: `${((yesCount / respondents.length) * 100).toFixed(0)}%`,
        question: questions[index]
      };
    } else if (scores.length > 0) {
      const average = scores.reduce((a, b) => a + b, 0) / scores.length;
      purchasing[key] = {
        averageScore: average.toFixed(2),
        interpretation: interpretScore(average),
        question: questions[index]
      };
    }
  }
  
  return purchasing;
}

function analyzeBrands(respondents, brandIndices, questions) {
  const brands = {};
  
  for (const [brand, indices] of Object.entries(brandIndices)) {
    brands[brand] = {
      awareness: 0,
      purchase: 0,
      programEngagement: 0
    };
    
    for (const respondent of respondents) {
      // Awareness (first index)
      if (indices[0] && respondent.responses[indices[0]]) {
        const awareness = scoreResponse(respondent.responses[indices[0]]);
        if (awareness >= 3) brands[brand].awareness++;
      }
      
      // Purchase (second index)
      if (indices[1] && respondent.responses[indices[1]]) {
        const purchase = respondent.responses[indices[1]];
        if (purchase && purchase.toString().toLowerCase().includes('yes')) {
          brands[brand].purchase++;
        }
      }
      
      // Program engagement (third index)
      if (indices[2] && respondent.responses[indices[2]]) {
        const engagement = scoreResponse(respondent.responses[indices[2]]);
        if (engagement >= 3) brands[brand].programEngagement++;
      }
    }
    
    // Convert to percentages
    const total = respondents.length;
    brands[brand].awareness = `${((brands[brand].awareness / total) * 100).toFixed(0)}%`;
    brands[brand].purchase = `${((brands[brand].purchase / total) * 100).toFixed(0)}%`;
    brands[brand].programEngagement = `${((brands[brand].programEngagement / total) * 100).toFixed(0)}%`;
  }
  
  return brands;
}

function analyzeActivities(respondents, activityIndices, questions) {
  const activities = {};
  
  for (const [key, index] of Object.entries(activityIndices)) {
    let participationCount = 0;
    
    for (const respondent of respondents) {
      const response = respondent.responses[index];
      if (response && 
          (response.toString().toLowerCase().includes('yes') || 
           scoreResponse(response) >= 4)) {
        participationCount++;
      }
    }
    
    activities[key] = {
      participationRate: `${((participationCount / respondents.length) * 100).toFixed(0)}%`,
      question: questions[index]
    };
  }
  
  return activities;
}

function analyzeAttitudes(respondents, attitudeIndices, questions) {
  const attitudes = {};
  
  for (const [key, index] of Object.entries(attitudeIndices)) {
    const scores = [];
    
    for (const respondent of respondents) {
      const score = scoreResponse(respondent.responses[index]);
      if (score) scores.push(score);
    }
    
    if (scores.length > 0) {
      const average = scores.reduce((a, b) => a + b, 0) / scores.length;
      attitudes[key] = {
        averageScore: average.toFixed(2),
        interpretation: interpretScore(average),
        question: questions[index]
      };
    }
  }
  
  return attitudes;
}

function analyzeLanguage(respondents, questions) {
  // Analyze open-ended responses for language patterns
  const commonPhrases = {};
  const vocabulary = {};
  
  // Look for open-ended questions (usually longer responses)
  for (let i = 0; i < questions.length; i++) {
    for (const respondent of respondents) {
      const response = respondent.responses[i];
      if (response && response.toString().length > 50) {
        // This is likely an open-ended response
        const text = response.toString().toLowerCase();
        
        // Extract key phrases
        const sustainabilityTerms = text.match(/\b(sustainable|eco|green|organic|recycle|environment|ethical|fair)\b/g);
        const priceTerms = text.match(/\b(price|cost|expensive|cheap|affordable|value|money)\b/g);
        const qualityTerms = text.match(/\b(quality|durable|last|performance|comfort|style)\b/g);
        
        if (sustainabilityTerms) {
          sustainabilityTerms.forEach(term => {
            vocabulary[term] = (vocabulary[term] || 0) + 1;
          });
        }
      }
    }
  }
  
  return {
    vocabulary: Object.entries(vocabulary)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({ word, frequency: count }))
  };
}

function generateKeyCharacteristics(segment, respondents) {
  const characteristics = [];
  
  switch (segment) {
    case 'LOHAS Leader':
      characteristics.push(
        'Actively seeks sustainable products',
        'Willing to pay 25%+ premium for sustainability',
        'Environmental evangelist - influences others',
        'Strong brand loyalty to sustainable companies',
        'Low price sensitivity when values align',
        'Participates in environmental activities',
        'Early adopter of sustainable innovations'
      );
      break;
      
    case 'LOHAS Leaning':
      characteristics.push(
        'Values sustainability but balances with practicality',
        'Selective premium payer (10-15% for right products)',
        'Moderate brand loyalty based on values',
        'Increasingly aware of environmental impact',
        'Quality and sustainability both important',
        'Occasional participation in environmental activities',
        'Influenced by peer recommendations'
      );
      break;
      
    case 'LOHAS Learner':
      characteristics.push(
        'Interested but needs education on sustainability',
        'Price remains primary purchase factor',
        'Will choose sustainable if price is comparable',
        'Developing environmental consciousness',
        'Influenced by mainstream trends',
        'Limited knowledge of sustainable brands',
        'Open to trying sustainable options'
      );
      break;
      
    case 'LOHAS Laggard':
      characteristics.push(
        'Price and convenience are only factors',
        'Skeptical of sustainability claims',
        'No premium payment willingness',
        'Traditional purchase decision process',
        'Limited environmental concern',
        'Focus on immediate personal benefit',
        'Resistant to change in buying habits'
      );
      break;
  }
  
  return characteristics;
}

function generateExampleResponses(segment, respondents) {
  // Generate typical responses for each segment
  const examples = {};
  
  switch (segment) {
    case 'LOHAS Leader':
      examples.priceQuestion = "Price is secondary to environmental impact. I'd rather buy less but buy better.";
      examples.brandQuestion = "I only support brands that demonstrate genuine commitment to sustainability.";
      examples.futureQuestion = "Sustainability will be non-negotiable in all my purchasing decisions.";
      break;
      
    case 'LOHAS Leaning':
      examples.priceQuestion = "I'm willing to pay more for sustainable products, but there's a limit.";
      examples.brandQuestion = "I prefer sustainable brands when the quality matches my needs.";
      examples.futureQuestion = "Sustainability will become increasingly important in my decisions.";
      break;
      
    case 'LOHAS Learner':
      examples.priceQuestion = "Price is important, but I'm starting to consider sustainability too.";
      examples.brandQuestion = "I don't know much about which brands are truly sustainable.";
      examples.futureQuestion = "I think sustainability might become more important if it's more accessible.";
      break;
      
    case 'LOHAS Laggard':
      examples.priceQuestion = "I always look for the best deal, that's what matters most.";
      examples.brandQuestion = "I buy what works and what I can afford.";
      examples.futureQuestion = "I don't see sustainability affecting my purchases much.";
      break;
  }
  
  return examples;
}

function scoreResponse(response) {
  if (!response) return null;
  
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
      responseStr.includes('often')) return 4;
  if (responseStr.includes('neutral') || responseStr.includes('neither') || 
      responseStr.includes('somewhat')) return 3;
  if (responseStr.includes('disagree') || responseStr.includes('not important') || 
      responseStr.includes('rarely')) return 2;
  if (responseStr.includes('strongly disagree') || responseStr.includes('not at all') || 
      responseStr.includes('never')) return 1;
  
  // Yes/No
  if (responseStr === 'yes' || responseStr === 'y') return 5;
  if (responseStr === 'no' || responseStr === 'n') return 1;
  
  return 3;
}

function interpretScore(score) {
  if (score >= 4.5) return 'Very High';
  if (score >= 3.8) return 'High';
  if (score >= 3.0) return 'Moderate';
  if (score >= 2.2) return 'Low';
  return 'Very Low';
}

async function saveDigitalTwins(twins) {
  // Save the complete twin profiles
  await fs.writeFile(
    'data/digital-twins/surf-clothing-personas.json',
    JSON.stringify(twins, null, 2)
  );
  
  // Create individual persona files for each segment
  for (const [segment, profile] of Object.entries(twins)) {
    const fileName = segment.toLowerCase().replace(/\s+/g, '-');
    
    // Create persona configuration
    const personaConfig = {
      id: fileName,
      name: segment,
      description: `${segment} - ${profile.percentage} of market`,
      characteristics: profile.keyCharacteristics,
      demographics: profile.demographics,
      values: profile.values,
      purchasing: profile.purchasing,
      brandRelationships: profile.brands,
      exampleResponses: profile.exampleResponses,
      
      // Configuration for AI responses
      responseConfig: {
        priceWeight: segment === 'LOHAS Leader' ? 0.3 : segment === 'LOHAS Laggard' ? 0.9 : 0.6,
        sustainabilityWeight: segment === 'LOHAS Leader' ? 0.9 : segment === 'LOHAS Laggard' ? 0.1 : 0.5,
        qualityWeight: segment === 'LOHAS Leader' ? 0.8 : segment === 'LOHAS Laggard' ? 0.5 : 0.7,
        brandWeight: segment === 'LOHAS Leader' ? 0.7 : segment === 'LOHAS Laggard' ? 0.3 : 0.5,
        
        willingnessToPay: {
          premium: segment === 'LOHAS Leader' ? '25%+' : 
                   segment === 'LOHAS Leaning' ? '10-15%' :
                   segment === 'LOHAS Learner' ? '0-5%' : '0%',
          conditions: segment === 'LOHAS Leader' ? 'Always for genuine sustainability' :
                      segment === 'LOHAS Leaning' ? 'For products that align with values' :
                      segment === 'LOHAS Learner' ? 'Only if quality is equal or better' :
                      'Never'
        }
      }
    };
    
    await fs.writeFile(
      `data/digital-twins/personas/${fileName}.json`,
      JSON.stringify(personaConfig, null, 2)
    );
  }
  
  console.log('\nDigital twins saved to data/digital-twins/');
  console.log('Individual persona files saved to data/digital-twins/personas/');
}

// Run the generation
console.log('=' + '='.repeat(99));
console.log('GENERATING DIGITAL TWINS FROM SURVEY DATA');
console.log('=' + '='.repeat(99));

generateDigitalTwins()
  .then(async (twins) => {
    // Create directories if they don't exist
    await fs.mkdir('data/digital-twins', { recursive: true });
    await fs.mkdir('data/digital-twins/personas', { recursive: true });
    
    // Save the twins
    await saveDigitalTwins(twins);
    
    // Print summary
    console.log('\n' + '='.repeat(100));
    console.log('DIGITAL TWIN GENERATION COMPLETE');
    console.log('='.repeat(100) + '\n');
    
    for (const [segment, profile] of Object.entries(twins)) {
      console.log(`${segment}: ${profile.size} respondents (${profile.percentage})`);
      console.log(`  Key characteristics: ${profile.keyCharacteristics.slice(0, 3).join(', ')}`);
      console.log(`  Sustainability importance: ${profile.purchasing.sustainabilityImportance?.interpretation || 'N/A'}`);
      console.log(`  Actual sustainable purchases: ${profile.purchasing.actualSustainablePurchase?.percentage || 'N/A'}`);
      console.log();
    }
    
    return twins;
  })
  .catch(console.error);