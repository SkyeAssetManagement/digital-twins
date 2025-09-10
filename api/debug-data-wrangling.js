/**
 * API endpoint for debugging data wrangling pipeline step by step
 * Allows examination of each stage of the data processing
 */

import { createLogger } from '../src/utils/logger.js';
import { getIntelligentDataPreprocessor } from '../src/data_processing/intelligent_data_preprocessor.js';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const logger = createLogger('DebugDataWranglingAPI');

export default async function handler(req, res) {
    try {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        const { step, filePath, previousResult } = req.body;

        logger.info(`Debug data wrangling step: ${step}`);

        const debugger = new DataWranglingDebugger();
        let result;

        switch (step) {
            case 'load_file':
                result = await debugger.loadFile(filePath);
                break;
            case 'analyze_structure':
                result = await debugger.analyzeStructure(previousResult.rawData);
                break;
            case 'get_llm_analysis':
                result = await debugger.getLLMAnalysis(previousResult.rawData);
                break;
            case 'apply_wrangling_plan':
                result = await debugger.applyWranglingPlan(previousResult.rawData, previousResult.llmAnalysis);
                break;
            case 'validate_output':
                result = await debugger.validateOutput(previousResult.processedData);
                break;
            default:
                return res.status(400).json({ error: `Unknown step: ${step}` });
        }

        return res.json({
            success: true,
            step: step,
            result: result,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Debug data wrangling failed', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
    }
}

class DataWranglingDebugger {
    
    /**
     * Step 1: Load and examine raw file data
     */
    async loadFile(filePath) {
        logger.info(`Loading file for debug: ${filePath}`);
        
        // Use the test file path
        const actualPath = path.resolve('./data/datasets/mums/Detail_Parents Survey.xlsx');
        
        if (!fs.existsSync(actualPath)) {
            throw new Error(`File not found: ${actualPath}`);
        }

        // Read the Excel file
        const workbook = XLSX.readFile(actualPath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON with options to preserve structure
        const rawData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1, // Use array of arrays format
            raw: false, // Keep formatted values
            defval: '' // Default value for empty cells
        });

        // Get file info
        const stats = fs.statSync(actualPath);
        
        return {
            filePath: actualPath,
            fileSize: stats.size,
            totalRows: rawData.length,
            totalColumns: rawData[0]?.length || 0,
            firstFewRows: rawData.slice(0, 5),
            sheetName: sheetName,
            rawDataSample: {
                row0: rawData[0],
                row1: rawData[1], 
                row2: rawData[2],
                row3: rawData[3]
            },
            rawData: rawData // Full data for next step
        };
    }

    /**
     * Step 2: Analyze raw structure without LLM
     */
    async analyzeStructure(rawData) {
        logger.info('Analyzing raw data structure');
        
        const analysis = {
            totalRows: rawData.length,
            totalColumns: rawData[0]?.length || 0,
            emptyRows: [],
            rowAnalysis: []
        };

        // Analyze first 10 rows in detail
        for (let i = 0; i < Math.min(10, rawData.length); i++) {
            const row = rawData[i];
            const rowAnalysis = {
                rowIndex: i,
                cellCount: row.length,
                emptyCells: row.filter(cell => !cell || cell === '').length,
                nonEmptyCells: row.filter(cell => cell && cell !== '').length,
                cells: row.slice(0, 10), // First 10 cells only
                avgCellLength: row.reduce((sum, cell) => sum + (cell ? cell.toString().length : 0), 0) / row.length,
                hasLongText: row.some(cell => cell && cell.toString().length > 50),
                duplicatedValues: this.findDuplicates(row)
            };
            
            analysis.rowAnalysis.push(rowAnalysis);
            
            if (rowAnalysis.emptyCells > rowAnalysis.nonEmptyCells) {
                analysis.emptyRows.push(i);
            }
        }

        // Look for header patterns
        analysis.headerPatterns = this.detectHeaderPatterns(rawData.slice(0, 5));
        
        return analysis;
    }

    /**
     * Step 3: Get LLM analysis with full prompt and response
     */
    async getLLMAnalysis(rawData) {
        logger.info('Getting LLM analysis of data structure');
        
        const preprocessor = await getIntelligentDataPreprocessor();
        
        // Prepare data sample for LLM (first 5 rows, first 20 columns)
        const dataSample = rawData.slice(0, 5).map(row => row.slice(0, 20));
        
        // Get the actual prompt that will be sent
        const prompt = this.buildAnalysisPrompt(dataSample);
        
        logger.info('Sending prompt to LLM:', { promptLength: prompt.length });
        
        // Call LLM and capture full response
        const llmResponse = await preprocessor.analyzeDataStructure(dataSample);
        
        return {
            inputData: dataSample,
            promptSent: prompt,
            llmRawResponse: llmResponse.rawResponse || 'Not captured',
            llmParsedResponse: llmResponse,
            analysisSuccess: llmResponse.success,
            errorIfAny: llmResponse.error,
            processingTime: llmResponse.processingTime || 'Not measured'
        };
    }

    /**
     * Step 4: Apply the wrangling plan step by step
     */
    async applyWranglingPlan(rawData, llmAnalysis) {
        logger.info('Applying wrangling plan step by step');
        
        if (!llmAnalysis.llmParsedResponse.success) {
            throw new Error('Cannot apply wrangling plan - LLM analysis failed');
        }

        const plan = llmAnalysis.llmParsedResponse.wranglingPlan;
        const stepResults = [];
        let workingData = [...rawData]; // Copy of raw data
        
        // Apply each step of the plan
        for (const [stepKey, stepData] of Object.entries(plan)) {
            logger.info(`Applying wrangling step: ${stepKey}`);
            
            const stepResult = {
                stepName: stepKey,
                stepAction: stepData.action,
                stepDescription: stepData.description,
                dataBefore: {
                    rowCount: workingData.length,
                    columnCount: workingData[0]?.length || 0,
                    sampleRows: workingData.slice(0, 3)
                }
            };

            try {
                // Apply the step (this is a simplified version - you'll need to implement each action)
                workingData = await this.applyWranglingStep(workingData, stepData);
                
                stepResult.dataAfter = {
                    rowCount: workingData.length,
                    columnCount: workingData[0]?.length || 0,
                    sampleRows: workingData.slice(0, 3)
                };
                stepResult.success = true;
                
            } catch (error) {
                stepResult.error = error.message;
                stepResult.success = false;
                logger.error(`Step ${stepKey} failed:`, error);
            }
            
            stepResults.push(stepResult);
        }

        return {
            originalPlan: plan,
            stepResults: stepResults,
            finalData: workingData,
            processingComplete: stepResults.every(step => step.success)
        };
    }

    /**
     * Step 5: Validate final output
     */
    async validateOutput(processedData) {
        logger.info('Validating final processed data');
        
        const validation = {
            dataIntegrity: {},
            headerQuality: {},
            dataQuality: {},
            recommendations: []
        };

        // Check data integrity
        validation.dataIntegrity = {
            totalRows: processedData.length,
            totalColumns: processedData[0]?.length || 0,
            emptyRows: processedData.filter(row => !row || row.every(cell => !cell)).length,
            duplicateRows: this.findDuplicateRows(processedData),
            missingData: this.analyzeMissingData(processedData)
        };

        // Check header quality
        if (processedData.length > 0) {
            const headers = processedData[0];
            validation.headerQuality = {
                totalHeaders: headers.length,
                emptyHeaders: headers.filter(h => !h || h === '').length,
                duplicateHeaders: this.findDuplicates(headers),
                longHeaders: headers.filter(h => h && h.length > 50),
                headersSample: headers.slice(0, 10)
            };
        }

        // Generate recommendations
        if (validation.dataIntegrity.emptyRows > 0) {
            validation.recommendations.push(`Found ${validation.dataIntegrity.emptyRows} empty rows - consider removing`);
        }
        
        if (validation.headerQuality.emptyHeaders > 0) {
            validation.recommendations.push(`Found ${validation.headerQuality.emptyHeaders} empty headers - needs fixing`);
        }

        return validation;
    }

    // Helper methods
    findDuplicates(array) {
        const duplicates = [];
        const seen = new Set();
        const dupes = new Set();
        
        array.forEach(item => {
            if (seen.has(item)) {
                dupes.add(item);
            }
            seen.add(item);
        });
        
        return Array.from(dupes);
    }

    detectHeaderPatterns(rows) {
        const patterns = {
            multiRowHeaders: false,
            emptyHeaderCells: false,
            metadataInHeaders: false,
            matrixQuestions: false
        };

        // Check for multi-row headers
        if (rows.length >= 2) {
            const row1Empty = rows[0].filter(cell => !cell || cell === '').length;
            const row2Empty = rows[1].filter(cell => !cell || cell === '').length;
            
            if (row1Empty > 0 && row2Empty > 0) {
                patterns.multiRowHeaders = true;
            }
        }

        // Check for metadata patterns
        rows.forEach(row => {
            row.forEach(cell => {
                if (cell && typeof cell === 'string') {
                    if (cell.toLowerCase().includes('response') || 
                        cell.toLowerCase().includes('answer')) {
                        patterns.metadataInHeaders = true;
                    }
                }
            });
        });

        return patterns;
    }

    buildAnalysisPrompt(dataSample) {
        // This should match the actual prompt used in the preprocessor
        return `# Survey Data Structure Analysis

Analyze this Excel/CSV data structure and provide a wrangling plan:

${dataSample.map((row, i) => `Row ${i}: ${JSON.stringify(row.slice(0, 10))}`).join('\n')}

Return JSON with analysis and wrangling plan.`;
    }

    async applyWranglingStep(data, stepData) {
        // Simplified step application - implement based on your actual logic
        switch (stepData.action) {
            case 'extract_questions_from_row':
                // Extract header row
                return data.slice(stepData.target_row || 1);
            
            case 'forward_fill_empty_cells':
                // Forward fill logic
                return this.forwardFillRow(data, stepData.target_row || 0);
                
            default:
                logger.warn(`Unknown wrangling action: ${stepData.action}`);
                return data;
        }
    }

    forwardFillRow(data, rowIndex) {
        if (rowIndex >= data.length) return data;
        
        const newData = [...data];
        const targetRow = [...newData[rowIndex]];
        
        let lastValue = '';
        for (let i = 0; i < targetRow.length; i++) {
            if (targetRow[i] && targetRow[i] !== '') {
                lastValue = targetRow[i];
            } else if (lastValue) {
                targetRow[i] = lastValue;
            }
        }
        
        newData[rowIndex] = targetRow;
        return newData;
    }

    findDuplicateRows(data) {
        const seen = new Map();
        let duplicates = 0;
        
        data.forEach((row, index) => {
            const rowKey = JSON.stringify(row);
            if (seen.has(rowKey)) {
                duplicates++;
            } else {
                seen.set(rowKey, index);
            }
        });
        
        return duplicates;
    }

    analyzeMissingData(data) {
        if (data.length === 0) return { percentage: 100 };
        
        let totalCells = 0;
        let emptyCells = 0;
        
        data.forEach(row => {
            row.forEach(cell => {
                totalCells++;
                if (!cell || cell === '') {
                    emptyCells++;
                }
            });
        });
        
        return {
            totalCells,
            emptyCells,
            percentage: totalCells > 0 ? (emptyCells / totalCells) * 100 : 0
        };
    }
}