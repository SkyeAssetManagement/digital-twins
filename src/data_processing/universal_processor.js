import * as XLSX from 'xlsx';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class UniversalProcessor {
  constructor(datasetId) {
    this.datasetId = datasetId;
    this.basePath = path.join(process.cwd(), 'data', 'datasets', datasetId);
  }
  
  async loadConfig() {
    const configPath = path.join(this.basePath, 'config.json');
    const config = await fs.readFile(configPath, 'utf8');
    return JSON.parse(config);
  }
  
  async processDataset() {
    const config = await this.loadConfig();
    
    // Process survey data
    const surveyData = await this.processSurveyFile(
      path.join(this.basePath, 'raw', config.dataFiles.survey),
      config
    );
    
    // Extract insights from PDFs
    const pdfInsights = await this.extractPDFInsights(
      config.dataFiles.research.map(f => path.join(this.basePath, 'raw', f))
    );
    
    // Auto-discover segments if needed
    const segments = config.segmentationMethod === 'auto' 
      ? await this.discoverSegments(surveyData, pdfInsights)
      : this.mapPredefinedSegments(config.predefinedSegments, surveyData);
    
    // Save processed data
    await this.saveProcessedData({
      config,
      surveyData,
      pdfInsights,
      segments,
      timestamp: new Date().toISOString()
    });
    
    return { surveyData, pdfInsights, segments };
  }
  
  async processSurveyFile(filePath, config) {
    const fileContent = await fs.readFile(filePath);
    const workbook = XLSX.read(fileContent, {
      cellStyles: true,
      cellDates: true,
      cellNF: true
    });
    
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const range = XLSX.utils.decode_range(sheet['!ref']);
    
    // Dynamic question extraction based on config
    const questions = this.extractQuestionsUniversal(sheet, range, config);
    const responses = this.extractResponsesUniversal(sheet, range, config, questions);
    
    return { questions, responses };
  }
  
  extractQuestionsUniversal(sheet, range, config) {
    const questions = [];
    const { questionRowIndex, subQuestionRowIndex, startColumn } = config.responseColumns;
    
    let currentMainQuestion = null;
    
    for (let col = startColumn; col <= range.e.c; col++) {
      const mainCell = sheet[XLSX.utils.encode_cell({ r: questionRowIndex, c: col })];
      const subCell = sheet[XLSX.utils.encode_cell({ r: subQuestionRowIndex, c: col })];
      
      if (mainCell?.v) {
        currentMainQuestion = {
          text: mainCell.v,
          column: col,
          type: this.detectQuestionType(mainCell.v),
          subQuestions: []
        };
        questions.push(currentMainQuestion);
      }
      
      if (subCell?.v && currentMainQuestion) {
        const subQuestion = {
          text: subCell.v,
          column: col,
          fullQuestion: `${currentMainQuestion.text} - ${subCell.v}`,
          parentType: currentMainQuestion.type
        };
        currentMainQuestion.subQuestions.push(subQuestion);
      }
    }
    
    return questions;
  }
  
  extractResponsesUniversal(sheet, range, config, questions) {
    const responses = [];
    const { identifierColumn, startColumn } = config.responseColumns;
    
    // Start from row 2 (assuming 0 and 1 are headers)
    for (let row = 2; row <= range.e.r; row++) {
      const idCell = sheet[XLSX.utils.encode_cell({ r: row, c: identifierColumn })];
      
      if (idCell?.v) {
        const respondent = {
          respondentId: idCell.v.toString(),
          row: row,
          responses: {}
        };
        
        // Extract responses for each question
        for (const question of questions) {
          if (question.subQuestions.length > 0) {
            // Handle sub-questions
            for (const subQ of question.subQuestions) {
              const cell = sheet[XLSX.utils.encode_cell({ r: row, c: subQ.column })];
              if (cell?.v !== undefined) {
                respondent.responses[subQ.fullQuestion] = this.normalizeResponse(cell.v);
              }
            }
          } else {
            // Handle main question without sub-questions
            const cell = sheet[XLSX.utils.encode_cell({ r: row, c: question.column })];
            if (cell?.v !== undefined) {
              respondent.responses[question.text] = this.normalizeResponse(cell.v);
            }
          }
        }
        
        responses.push(respondent);
      }
    }
    
    return responses;
  }
  
  normalizeResponse(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return value ? 1 : 0;
    
    const strValue = value.toString().trim();
    
    // Try to parse as number
    const numValue = parseFloat(strValue);
    if (!isNaN(numValue)) return numValue;
    
    // Return as string
    return strValue;
  }
  
  detectQuestionType(questionText) {
    const text = questionText.toLowerCase();
    if (text.includes('how important') || text.includes('agree') || text.includes('rate')) return 'scale';
    if (text.includes('select all') || text.includes('which of')) return 'multiple';
    if (text.includes('yes/no') || text.includes('true/false')) return 'binary';
    if (text.includes('how often') || text.includes('frequency')) return 'frequency';
    return 'open';
  }
  
  async extractPDFInsights(pdfPaths) {
    // This will be implemented by pdf_extractor.js
    // For now, return placeholder structure
    return {
      segmentDescriptions: {},
      keyFindings: [],
      valueFrameworks: {},
      behavioralIndicators: []
    };
  }
  
  async discoverSegments(surveyData, pdfInsights) {
    // This will be implemented by segment_discovery.js
    // For now, return basic segments based on response patterns
    const segmentCount = 4;
    const segments = [];
    
    for (let i = 0; i < segmentCount; i++) {
      segments.push({
        id: `segment_${i}`,
        name: `Segment ${i + 1}`,
        characteristics: {},
        valueSystem: {},
        size: Math.floor(surveyData.responses.length / segmentCount),
        percentage: 25
      });
    }
    
    return segments;
  }
  
  mapPredefinedSegments(predefinedSegments, surveyData) {
    return predefinedSegments.map((segmentName, index) => ({
      id: `segment_${segmentName.toLowerCase()}`,
      name: segmentName.charAt(0).toUpperCase() + segmentName.slice(1),
      characteristics: this.getSegmentCharacteristics(segmentName),
      valueSystem: this.getSegmentValueSystem(segmentName),
      size: Math.floor(surveyData.responses.length / predefinedSegments.length),
      percentage: 100 / predefinedSegments.length
    }));
  }
  
  getSegmentCharacteristics(segmentName) {
    const characteristics = {
      leader: {
        sustainability: "Highly committed to sustainable practices",
        innovation: "Early adopter of eco-friendly products",
        influence: "Influences others' purchasing decisions",
        price: "Willing to pay premium for sustainability"
      },
      leaning: {
        sustainability: "Interested in sustainable options",
        innovation: "Open to trying eco-friendly alternatives",
        influence: "Moderately influences peer choices",
        price: "Balances price with sustainability"
      },
      learner: {
        sustainability: "Learning about sustainability",
        innovation: "Cautiously exploring eco options",
        influence: "Follows trends set by others",
        price: "Price-conscious but curious"
      },
      laggard: {
        sustainability: "Minimal interest in sustainability",
        innovation: "Prefers traditional products",
        influence: "Not influenced by eco trends",
        price: "Primarily price-driven decisions"
      }
    };
    
    return characteristics[segmentName.toLowerCase()] || {};
  }
  
  getSegmentValueSystem(segmentName) {
    const valueSystems = {
      leader: {
        sustainability: 0.95,
        priceConsciousness: 0.3,
        brandLoyalty: 0.7,
        environmentalConcern: 0.9,
        socialInfluence: 0.8
      },
      leaning: {
        sustainability: 0.7,
        priceConsciousness: 0.5,
        brandLoyalty: 0.6,
        environmentalConcern: 0.7,
        socialInfluence: 0.6
      },
      learner: {
        sustainability: 0.4,
        priceConsciousness: 0.7,
        brandLoyalty: 0.5,
        environmentalConcern: 0.4,
        socialInfluence: 0.5
      },
      laggard: {
        sustainability: 0.1,
        priceConsciousness: 0.9,
        brandLoyalty: 0.3,
        environmentalConcern: 0.1,
        socialInfluence: 0.2
      }
    };
    
    return valueSystems[segmentName.toLowerCase()] || {};
  }
  
  async saveProcessedData(data) {
    const processedPath = path.join(this.basePath, 'processed', 'processed_data.json');
    await fs.mkdir(path.dirname(processedPath), { recursive: true });
    await fs.writeFile(processedPath, JSON.stringify(data, null, 2));
    
    console.log(`Processed data saved to ${processedPath}`);
    return processedPath;
  }
}