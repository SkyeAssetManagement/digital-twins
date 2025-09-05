import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createLogger } from '../utils/logger.js';
import { 
  readJSONConfig, 
  parseExcelSheet, 
  writeJSONData 
} from '../utils/file-operations.js';
import { 
  normalizeResponse, 
  convertCategoricalToNumeric,
  extractNumericFeatures,
  calculateFieldStatistics
} from '../utils/data-normalizer.js';
import {
  getSegmentDefinition,
  mapSegmentCharacteristics,
  generateValueSystemScores
} from '../utils/segment-analyzer.js';
import { DataPipeline } from '../utils/data-pipeline.js';
import { AppError, ValidationError } from '../utils/error-handler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const logger = createLogger('UniversalProcessor');

export class UniversalProcessor {
  constructor(datasetId) {
    this.datasetId = datasetId;
    this.basePath = path.join(process.cwd(), 'data', 'datasets', datasetId);
    this.pipeline = null;
    this.cache = new Map();
  }
  
  async loadConfig() {
    const configPath = path.join(this.basePath, 'config.json');
    logger.info(`Loading config from ${configPath}`);
    
    try {
      const config = await readJSONConfig(configPath);
      logger.info('Config loaded successfully');
      return config;
    } catch (error) {
      logger.error('Failed to load config', error);
      throw error;
    }
  }
  
  async processDataset() {
    logger.info(`Starting dataset processing for ${this.datasetId}`);
    
    // Create processing pipeline
    this.pipeline = new DataPipeline(`dataset-${this.datasetId}`, {
      stopOnError: false,
      cacheResults: true
    });
    
    // Setup pipeline stages
    this.pipeline
      .stage('load-config', async () => {
        return await this.loadConfig();
      })
      .stage('process-survey', async (config) => {
        const surveyPath = path.join(this.basePath, 'raw', config.dataFiles.survey);
        return await this.processSurveyFile(surveyPath, config);
      })
      .stage('extract-insights', async (data) => {
        const config = this.pipeline.context.config || data;
        const pdfPaths = config.dataFiles.research?.map(f => 
          path.join(this.basePath, 'raw', f)
        ) || [];
        const insights = await this.extractPDFInsights(pdfPaths);
        return { ...data, pdfInsights: insights };
      })
      .stage('discover-segments', async (data) => {
        const config = this.pipeline.context.config || data;
        const segments = config.segmentationMethod === 'auto' 
          ? await this.discoverSegments(data, data.pdfInsights)
          : this.mapPredefinedSegments(config.predefinedSegments, data);
        return { ...data, segments };
      })
      .stage('save-results', async (data) => {
        const config = this.pipeline.context.config || data;
        await this.saveProcessedData({
          config,
          surveyData: data,
          pdfInsights: data.pdfInsights,
          segments: data.segments,
          timestamp: new Date().toISOString()
        });
        return data;
      });
    
    // Track progress
    this.pipeline.on('progress', (progress) => {
      logger.info(`Pipeline progress: ${progress.stage} (${progress.percentage}%)`);
    });
    
    this.pipeline.on('error', (error) => {
      logger.error(`Pipeline error in stage ${error.stage}`, error.error);
    });
    
    try {
      const config = await this.loadConfig();
      this.pipeline.context.config = config;
      const result = await this.pipeline.execute(config);
      
      logger.info('Dataset processing completed successfully');
      return {
        surveyData: result,
        pdfInsights: result.pdfInsights,
        segments: result.segments
      };
    } catch (error) {
      logger.error('Dataset processing failed', error);
      throw error;
    }
  }
  
  async processSurveyFile(filePath, config) {
    logger.info(`Processing survey file: ${filePath}`);
    
    try {
      // Use parseExcelSheet from file-operations
      const rawData = await parseExcelSheet(filePath, null, {
        raw: false,
        header: 1  // Get as array of arrays
      });
      
      if (!rawData || rawData.length === 0) {
        throw new ValidationError('Survey file is empty or invalid');
      }
      
      // Extract questions and responses
      const questions = this.extractQuestionsFromArray(rawData, config);
      const responses = this.extractResponsesFromArray(rawData, config, questions);
      
      // Calculate statistics
      const stats = this.calculateSurveyStatistics(responses);
      
      logger.info(`Processed ${responses.length} responses with ${questions.length} questions`);
      
      return { questions, responses, statistics: stats };
    } catch (error) {
      logger.error('Failed to process survey file', error);
      throw new AppError(`Survey processing failed: ${error.message}`);
    }
  }
  
  extractQuestionsFromArray(data, config) {
    const questions = [];
    const { questionRowIndex, subQuestionRowIndex, startColumn } = config.responseColumns;
    
    if (questionRowIndex >= data.length) {
      throw new ValidationError(`Question row ${questionRowIndex} exceeds data length ${data.length}`);
    }
    
    const mainRow = data[questionRowIndex] || [];
    const subRow = data[subQuestionRowIndex] || [];
    let currentMainQuestion = null;
    
    for (let col = startColumn; col < mainRow.length; col++) {
      const mainCell = mainRow[col];
      const subCell = subRow[col];
      
      if (mainCell) {
        currentMainQuestion = {
          text: mainCell,
          column: col,
          type: this.detectQuestionType(mainCell),
          subQuestions: []
        };
        questions.push(currentMainQuestion);
      }
      
      if (subCell && currentMainQuestion) {
        const subQuestion = {
          text: subCell,
          column: col,
          fullQuestion: `${currentMainQuestion.text} - ${subCell}`,
          parentType: currentMainQuestion.type
        };
        currentMainQuestion.subQuestions.push(subQuestion);
      }
    }
    
    logger.debug(`Extracted ${questions.length} main questions`);
    return questions;
  }
  
  extractResponsesFromArray(data, config, questions) {
    const responses = [];
    const { identifierColumn, startColumn } = config.responseColumns;
    
    // Start from row 2 (assuming 0 and 1 are headers)
    for (let rowIndex = 2; rowIndex < data.length; rowIndex++) {
      const row = data[rowIndex];
      if (!row || !row[identifierColumn]) continue;
      
      const respondent = {
        respondentId: row[identifierColumn].toString(),
        row: rowIndex,
        responses: {},
        numericFeatures: []
      };
      
      // Extract responses for each question
      for (const question of questions) {
        if (question.subQuestions.length > 0) {
          // Handle sub-questions
          for (const subQ of question.subQuestions) {
            const value = row[subQ.column];
            if (value !== undefined && value !== null && value !== '') {
              // Use data-normalizer functions
              const normalized = normalizeResponse(value);
              respondent.responses[subQ.fullQuestion] = normalized;
              
              // Convert categorical if needed
              const numeric = convertCategoricalToNumeric(subQ.fullQuestion, value);
              if (numeric !== null) {
                respondent.numericFeatures.push(numeric);
              }
            }
          }
        } else {
          // Handle main question without sub-questions
          const value = row[question.column];
          if (value !== undefined && value !== null && value !== '') {
            const normalized = normalizeResponse(value);
            respondent.responses[question.text] = normalized;
            
            const numeric = convertCategoricalToNumeric(question.text, value);
            if (numeric !== null) {
              respondent.numericFeatures.push(numeric);
            }
          }
        }
      }
      
      responses.push(respondent);
    }
    
    logger.debug(`Extracted ${responses.length} responses`);
    return responses;
  }
  
  calculateSurveyStatistics(responses) {
    const stats = {
      totalResponses: responses.length,
      fields: {},
      completionRate: 0
    };
    
    if (responses.length === 0) return stats;
    
    // Get all unique fields
    const allFields = new Set();
    responses.forEach(r => {
      Object.keys(r.responses).forEach(field => allFields.add(field));
    });
    
    // Calculate stats for each field
    allFields.forEach(field => {
      stats.fields[field] = calculateFieldStatistics(responses.map(r => ({ 
        [field]: r.responses[field] 
      })), field);
    });
    
    // Calculate completion rate
    const totalFields = allFields.size;
    let totalCompleted = 0;
    responses.forEach(r => {
      const completed = Object.keys(r.responses).length;
      totalCompleted += completed / totalFields;
    });
    stats.completionRate = (totalCompleted / responses.length) * 100;
    
    return stats;
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
    if (!predefinedSegments || predefinedSegments.length === 0) {
      logger.warn('No predefined segments provided');
      return [];
    }
    
    return predefinedSegments.map((segmentName, index) => {
      const segment = getSegmentDefinition(segmentName);
      const characteristics = mapSegmentCharacteristics(segmentName);
      const valueSystem = generateValueSystemScores(segmentName);
      
      return {
        id: `segment_${segmentName.toLowerCase()}`,
        name: segment?.name || segmentName.charAt(0).toUpperCase() + segmentName.slice(1),
        characteristics,
        valueSystem,
        size: Math.floor((surveyData.responses || surveyData).length / predefinedSegments.length),
        percentage: segment?.percentage || (100 / predefinedSegments.length),
        definition: segment
      };
    });
  }
  
  // Segment characteristics and value systems now handled by segment-analyzer.js
  
  async saveProcessedData(data) {
    const processedPath = path.join(this.basePath, 'processed', 'processed_data.json');
    
    try {
      await writeJSONData(processedPath, data, true);
      logger.info(`Processed data saved to ${processedPath}`);
      return processedPath;
    } catch (error) {
      logger.error('Failed to save processed data', error);
      throw new AppError(`Failed to save data: ${error.message}`);
    }
  }
}