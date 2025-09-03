import * as XLSX from 'xlsx';
import fs from 'fs/promises';
import path from 'path';

async function analyzeSegments() {
  const filePath = 'data/datasets/surf-clothing/raw/All_Surf_detail 2.xlsx';
  
  // Read the Excel file
  const fileContent = await fs.readFile(filePath);
  const workbook = XLSX.read(fileContent, { cellStyles: true, cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  // Extract LOHAS segment data - check multiple possible columns
  // Try to find the column with segment names
  let segmentColumn = -1;
  
  // Check headers for LOHAS or segment column
  const headers = data[0] || [];
  for (let i = 0; i < Math.min(10, headers.length); i++) {
    const header = (headers[i] || '').toString().toLowerCase();
    if (header.includes('lohas') || header.includes('segment') || header.includes('classification')) {
      segmentColumn = i;
      break;
    }
  }
  
  // If not found in headers, try column 7 (H) which typically has LOHAS segments
  if (segmentColumn === -1) {
    segmentColumn = 7; // Column H (index 7)
  }
  const segments = {};
  let totalResponses = 0;
  
  // Skip header rows and count segments
  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    if (row && row[segmentColumn]) {
      const segment = row[segmentColumn].toString().toLowerCase().trim();
      
      // Map variations to standard names
      let standardSegment = segment;
      if (segment.includes('leader')) standardSegment = 'leader';
      else if (segment.includes('leaning')) standardSegment = 'leaning';
      else if (segment.includes('learner')) standardSegment = 'learner';
      else if (segment.includes('laggard')) standardSegment = 'laggard';
      
      if (standardSegment) {
        segments[standardSegment] = (segments[standardSegment] || 0) + 1;
        totalResponses++;
      }
    }
  }
  
  // Calculate percentages
  const distribution = {};
  for (const [segment, count] of Object.entries(segments)) {
    distribution[segment] = {
      count: count,
      percentage: ((count / totalResponses) * 100).toFixed(1)
    };
  }
  
  // Identify key questions for classification
  const keyQuestions = analyzeKeyQuestions(data);
  
  return {
    totalResponses,
    distribution,
    keyQuestions
  };
}

function analyzeKeyQuestions(data) {
  // Analyze which questions have highest correlation with segments
  const questions = [];
  const headers = data[0] || [];
  const subHeaders = data[1] || [];
  
  // Key sustainability and value-based questions typically include:
  const keyPatterns = [
    'sustain',
    'environment',
    'eco',
    'organic',
    'fair trade',
    'local',
    'recycle',
    'social',
    'ethic',
    'responsible',
    'natural',
    'green'
  ];
  
  const keyQuestions = [];
  
  for (let col = 9; col < headers.length; col++) {
    const question = headers[col];
    const subQuestion = subHeaders[col];
    
    if (question || subQuestion) {
      const fullQuestion = `${question || ''} ${subQuestion || ''}`.toLowerCase();
      
      for (const pattern of keyPatterns) {
        if (fullQuestion.includes(pattern)) {
          keyQuestions.push({
            column: col,
            question: question || '',
            subQuestion: subQuestion || '',
            pattern: pattern
          });
          break;
        }
      }
    }
  }
  
  return keyQuestions.slice(0, 10); // Return top 10 key questions
}

// Run analysis and display results
analyzeSegments().then(results => {
  console.log('=== SURF CLOTHING CONSUMER SEGMENT ANALYSIS ===\n');
  console.log(`Total Responses: ${results.totalResponses}\n`);
  console.log('Segment Distribution:');
  console.log('--------------------');
  
  for (const [segment, data] of Object.entries(results.distribution)) {
    console.log(`${segment.toUpperCase()}: ${data.count} respondents (${data.percentage}%)`);
  }
  
  console.log('\nKey Classification Questions:');
  console.log('----------------------------');
  results.keyQuestions.forEach((q, i) => {
    console.log(`${i + 1}. ${q.question} ${q.subQuestion ? '- ' + q.subQuestion : ''}`);
  });
  
  // Save results to JSON
  return fs.writeFile(
    'data/datasets/surf-clothing/segment-analysis.json',
    JSON.stringify(results, null, 2)
  );
}).catch(console.error);