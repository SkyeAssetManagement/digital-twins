/**
 * API endpoint for debugging data wrangling pipeline step by step
 * Allows examination of each stage of the data processing
 */

// Simple logging for debugging
const logger = {
    info: (...args) => console.log('[INFO]', ...args),
    error: (...args) => console.error('[ERROR]', ...args),
    warn: (...args) => console.warn('[WARN]', ...args)
};

export default async function handler(req, res) {
    try {
        // Set JSON header immediately
        res.setHeader('Content-Type', 'application/json');
        logger.info('Debug data wrangling API called');
        
        if (req.method !== 'POST') {
            logger.error('Invalid method:', req.method);
            return res.status(405).json({ error: 'Method not allowed' });
        }

        logger.info('Request body:', req.body);
        const { step, filePath, fileId, analysisParams, previousResult } = req.body;
        
        // Default analysis parameters
        const params = {
            rowsToExamine: 5,
            topRowsToIgnore: 0,
            maxColumns: 50, // Limit columns shown in preview
            ...analysisParams
        };

        if (!step) {
            logger.error('No step provided in request');
            return res.status(400).json({ error: 'Step is required' });
        }

        logger.info(`Debug data wrangling step: ${step}`);

        const debuggerInstance = new DataWranglingDebugger();
        let result;

        switch (step) {
            case 'load_file':
                logger.info('Executing load_file step');
                try {
                    if (fileId) {
                        logger.info(`Loading file by ID: ${fileId}`);
                        result = await debuggerInstance.loadFileById(fileId, params);
                    } else {
                        logger.info(`Loading fallback file: ${filePath}`);
                        result = await debuggerInstance.loadFile(filePath);
                    }
                } catch (error) {
                    logger.error('Load file step failed:', error);
                    throw new Error(`File loading failed: ${error.message}`);
                }
                break;
            case 'analyze_structure':
                logger.info('Executing analyze_structure step');
                if (!previousResult?.rawData) {
                    throw new Error('Previous step result with rawData is required');
                }
                result = await debuggerInstance.analyzeStructure(previousResult.rawData, params);
                break;
            case 'get_llm_analysis':
                logger.info('Executing get_llm_analysis step');
                if (!previousResult?.rawData) {
                    throw new Error('Previous step result with rawData is required');
                }
                result = await debuggerInstance.getLLMAnalysis(previousResult.rawData, params);
                break;
            case 'apply_wrangling_plan':
                logger.info('Executing apply_wrangling_plan step');
                if (!previousResult?.rawData || !previousResult?.llmAnalysis) {
                    throw new Error('Previous step results with rawData and llmAnalysis are required');
                }
                result = await debuggerInstance.applyWranglingPlan(previousResult.rawData, previousResult.llmAnalysis);
                break;
            case 'validate_output':
                logger.info('Executing validate_output step');
                if (!previousResult?.processedData) {
                    throw new Error('Previous step result with processedData is required');
                }
                result = await debuggerInstance.validateOutput(previousResult.processedData);
                break;
            default:
                logger.error('Unknown step:', step);
                return res.status(400).json({ error: `Unknown step: ${step}` });
        }

        logger.info('Step completed successfully');
        return res.json({
            success: true,
            step: step,
            result: result,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Debug data wrangling failed:', error);
        logger.error('Error stack:', error.stack);
        
        // Ensure we always return JSON, never HTML
        const errorResponse = { 
            success: false, 
            error: error.message || 'Unknown error occurred',
            step: req.body?.step || 'unknown',
            errorType: error.constructor.name,
            timestamp: new Date().toISOString()
        };
        
        // Add stack trace only in development
        if (process.env.NODE_ENV === 'development') {
            errorResponse.stack = error.stack;
        }
        
        res.status(500).json(errorResponse);
    }
}

class DataWranglingDebugger {
    
    /**
     * Step 1a: Load file by ID from temporary storage
     */
    async loadFileById(fileId, params = {}) {
        logger.info(`Loading file by ID: ${fileId}`);
        
        try {
            // Get file from temporary storage
            if (!global.tempFileStorage || !global.tempFileStorage.has(fileId)) {
                throw new Error(`File not found: ${fileId}`);
            }
            
            const fileRecord = global.tempFileStorage.get(fileId);
            logger.info(`File found: ${fileRecord.filename}, Size: ${fileRecord.original_size} bytes`);
            
            // Decode base64 data and parse
            const buffer = Buffer.from(fileRecord.file_data_base64, 'base64');
            const rawData = await this.parseFileBuffer(buffer, fileRecord.filename, fileRecord.mime_type);
            
            // Apply analysis parameters
            const rowsToShow = Math.min(params.rowsToExamine || 5, rawData.length);
            const skipRows = params.topRowsToIgnore || 0;
            const analysisData = rawData.slice(skipRows);
            
            return {
                fileId: fileId,
                filePath: fileRecord.filename,
                fileSize: fileRecord.original_size,
                totalRows: rawData.length,
                totalColumns: rawData[0]?.length || 0,
                analysisParams: params,
                firstFewRows: analysisData.slice(0, rowsToShow),
                rawDataSample: {
                    row0: analysisData[0]?.slice(0, params.maxColumns || 20),
                    row1: analysisData[1]?.slice(0, params.maxColumns || 20),
                    row2: analysisData[2]?.slice(0, params.maxColumns || 20),
                    row3: analysisData[3]?.slice(0, params.maxColumns || 20)
                },
                rawData: rawData, // Full data for next step
                note: `Real file loaded: ${fileRecord.filename} (${rawData.length} rows × ${rawData[0]?.length || 0} cols). Analysis: examining ${rowsToShow} rows, skipping ${skipRows} top rows.`
            };
        } catch (error) {
            logger.error('Failed to load file by ID:', error);
            
            // If file loading fails, provide helpful error message
            if (!global.tempFileStorage) {
                throw new Error('No files have been uploaded yet. Please upload a file first.');
            } else if (!global.tempFileStorage.has(fileId)) {
                throw new Error(`File ${fileId} not found. It may have expired or been deleted.`);
            } else {
                throw new Error(`File parsing failed: ${error.message}`);
            }
        }
    }
    
    /**
     * Parse file buffer based on file type
     */
    async parseFileBuffer(buffer, filename, mimeType) {
        try {
            if (mimeType.includes('spreadsheet') || filename.match(/\.(xlsx|xls)$/i)) {
                // Parse Excel file - use dynamic import for serverless compatibility
                const XLSX = await import('xlsx');
                const workbook = XLSX.read ? XLSX.read(buffer, { type: 'buffer' }) : XLSX.default.read(buffer, { type: 'buffer' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const utils = XLSX.utils || XLSX.default.utils;
                const jsonData = utils.sheet_to_json(worksheet, {
                    header: 1, // Return array of arrays
                    defval: '', // Use empty string for null cells
                    raw: false // Convert everything to strings
                });
                return jsonData;
            } else if (mimeType.includes('csv') || filename.match(/\.csv$/i)) {
                // Parse CSV file
                const csvText = buffer.toString('utf8');
                const rows = csvText.split('\n').map(row => {
                    // Simple CSV parsing - could be enhanced for quoted fields
                    return row.split(',').map(cell => cell.trim());
                });
                return rows.filter(row => row.some(cell => cell)); // Remove empty rows
            } else {
                throw new Error(`Unsupported file type: ${mimeType}`);
            }
        } catch (error) {
            logger.error('File parsing failed:', error);
            throw new Error(`File parsing failed: ${error.message}`);
        }
    }
    
    /**
     * Step 1b: Load file from path (fallback)
     */
    async loadFile(filePath) {
        logger.info(`Loading fallback file data: ${filePath}`);
        
        try {
            // Since we can't access actual files on Vercel, load sample data that represents the structure
            // This provides a working demo when no file is uploaded
            const actualSurveyData = await this.loadActualSurveyData();
            
            return {
                filePath: filePath || './data/datasets/mums/Detail_Parents Survey.xlsx',
                fileSize: 624907,
                totalRows: actualSurveyData.length,
                totalColumns: actualSurveyData[0]?.length || 0,
                firstFewRows: actualSurveyData.slice(0, 5),
                sheetName: 'Sheet1',
                rawDataSample: {
                    row0: actualSurveyData[0]?.slice(0, 15),
                    row1: actualSurveyData[1]?.slice(0, 15), 
                    row2: actualSurveyData[2]?.slice(0, 15),
                    row3: actualSurveyData[3]?.slice(0, 15)
                },
                rawData: actualSurveyData,
                note: "Demo data - represents typical survey structure. Upload your own file for analysis of your actual data."
            };
        } catch (error) {
            logger.error('Failed to load demo data:', error);
            
            // Final fallback - minimal working data
            const fallbackData = [
                ['Question 1', 'Question 2', 'Question 3'],
                ['Response', 'Response', 'Response'],
                ['Answer A1', 'Answer B1', 'Answer C1'],
                ['Answer A2', 'Answer B2', 'Answer C2']
            ];
            
            return {
                filePath: 'fallback_data.csv',
                fileSize: 1024,
                totalRows: fallbackData.length,
                totalColumns: fallbackData[0]?.length || 0,
                firstFewRows: fallbackData,
                rawData: fallbackData,
                note: "Minimal fallback data - please upload a file for proper analysis"
            };
        }
    }

    /**
     * Load the actual survey data structure that we know works
     */
    async loadActualSurveyData() {
        // This represents the actual structure we discovered in the Python pipeline
        // Row 0: Main question headers with empty cells for matrix sub-questions
        // Row 1: Sub-questions or "Response" labels that should be combined/ignored
        // Rows 2+: Actual response data
        
        const row0 = [
            'Respondent ID', 'Collector ID', 'Start Date', 'End Date', 'IP Address', 'Email Address', 'First Name', 'Last Name', 'Custom Data 1',
            'Are you?', 'How old are you?', 'In which State or Territory do you currently live?', 'Are you currently pregnant?', 'How many children do you have?',
            'Do you have a child aged under 12 months old?', 'Within your household who typically purchases these types of baby care products?',
            'Have you purchased baby care products (such as wipes, bath wash, powder or creams) from the following outlets:?', '',
            'How often do you usually use the following types of baby care products on your little ones: (select one per product type)', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
            'When considering these types of products, how important are the following aspects to you in deciding which one to purchase: (select one per aspect)', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
        ];
        
        const row1 = [
            '', '', '', '', '', '', '', '', '',
            'Response', 'Response', 'Response', 'Response', 'Response', 'Response', 'Response',
            'Coles or Woolworths supermarket in the past month', 'Chemist Warehouse, Priceline or Big W in the past 3 months',
            'Baby bath (eg. liquid cleanser/wash)', '2 in 1 Baby wash & shampoo', 'Baby shampoo', 'Baby conditioner', 'Hair detangling spray', 'Baby wipes', 'Baby powder', 'Baby soap (eg. bar)', 'Nappy rash cream (eg. soothing cream)', 'Baby massage oil', 'Baby skin moisturiser', 'Cradle cap products', 'Eczema cream', 'Bath oil', 'Room spray (in baby/children's room)',
            'Available where I usually shop', 'Brand I know and trust', 'Another mum/family member recommended it', 'Affordable price/value for money', 'Product effectiveness/quality', 'Organic/natural ingredients', 'Suitable for sensitive skin', 'Dermatologically tested', 'Paediatrician recommended/approved', 'Response', 'Response', 'Response', 'Response', 'Response', 'Response', 'Response'
        ];
        
        // Pad both rows to 253 columns
        while (row0.length < 253) row0.push('');
        while (row1.length < 253) row1.push('');
        
        // Generate sample response data
        const responseRows = Array.from({length: 1104}, (_, i) => {
            const row = Array.from({length: 253}, (_, colIdx) => {
                if (colIdx === 0) return 114900330000 + i; // Respondent ID
                if (colIdx === 1) return 436228068; // Collector ID
                if (colIdx === 2) return new Date().toISOString(); // Start Date
                if (colIdx === 3) return new Date().toISOString(); // End Date
                if (colIdx === 4) return '203.30.15.186'; // IP
                if (colIdx >= 5 && colIdx <= 8) return ''; // Email, names, custom data
                
                // Generate realistic survey responses
                if (colIdx === 9) return Math.random() > 0.5 ? 'Female' : 'Male'; // Are you?
                if (colIdx === 10) return ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'][Math.floor(Math.random() * 6)];
                if (colIdx === 11) return ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'][Math.floor(Math.random() * 8)];
                if (colIdx === 12) return Math.random() > 0.85 ? 'Yes' : 'No';
                if (colIdx === 13) return Math.floor(Math.random() * 5).toString();
                
                // For matrix questions, generate Likert scale responses
                const likertResponses = ['Strongly Agree', 'Agree', 'Neutral', 'Disagree', 'Strongly Disagree', 'Very Important', 'Important', 'Not Important', 'Always', 'Often', 'Sometimes', 'Rarely', 'Never'];
                
                // Return appropriate response type based on column
                if (Math.random() > 0.3) { // 70% chance of having data
                    return likertResponses[Math.floor(Math.random() * likertResponses.length)];
                } else {
                    return ''; // Empty cell
                }
            });
            return row;
        });
        
        return [row0, row1, ...responseRows];
    }
    
    /**
     * Generate sample data that represents the problematic Excel structure (fallback)
     */
    generateSampleExcelData() {
        // Fallback simple data if main loading fails
        return [
            ['Question 1', 'Question 2', 'Question 3'],
            ['Response', 'Response', 'Response'],
            ['Answer A', 'Answer B', 'Answer C'],
            ['Answer D', 'Answer E', 'Answer F']
        ];
    }

    /**
     * Step 2: Basic structure analysis with configurable parameters
     * Only provide raw statistics - no assumptions about survey structure
     */
    async analyzeStructure(rawData, params = {}) {
        logger.info('Analyzing raw data structure - basic stats only');
        
        const analysis = {
            totalRows: rawData.length,
            totalColumns: rawData[0]?.length || 0,
            emptyRows: [],
            rowAnalysis: []
        };

        const rowsToAnalyze = Math.min(params.rowsToExamine || 5, rawData.length);
        const skipRows = params.topRowsToIgnore || 0;
        const analysisData = rawData.slice(skipRows);
        
        // Analyze configurable number of rows with purely descriptive statistics
        for (let i = 0; i < Math.min(rowsToAnalyze + 5, analysisData.length); i++) {
            const row = analysisData[i];
            const rowAnalysis = {
                rowIndex: i,
                cellCount: row.length,
                emptyCells: row.filter(cell => !cell || cell === '').length,
                nonEmptyCells: row.filter(cell => cell && cell !== '').length,
                cells: row.slice(0, 10), // First 10 cells for debugging
                avgCellLength: row.reduce((sum, cell) => sum + (cell ? cell.toString().length : 0), 0) / row.length,
                maxCellLength: Math.max(...row.map(cell => cell ? cell.toString().length : 0)),
                uniqueValues: new Set(row.filter(cell => cell && cell !== '')).size
            };
            
            analysis.rowAnalysis.push(rowAnalysis);
            
            if (rowAnalysis.emptyCells > rowAnalysis.nonEmptyCells) {
                analysis.emptyRows.push(i);
            }
        }

        // Provide only raw data samples for LLM analysis
        analysis.rawDataSample = analysisData.slice(0, rowsToAnalyze).map(row => row.slice(0, params.maxColumns || 20));
        analysis.analysisParams = params;
        analysis.note = `Raw statistics only - examining ${rowsToAnalyze} rows (skipping ${skipRows} top rows). All pattern detection handled by LLM.`;
        
        return analysis;
    }

    /**
     * Step 3: Get LLM analysis with configurable parameters
     */
    async getLLMAnalysis(rawData, params = {}) {
        logger.info('Getting LLM analysis of data structure');
        
        // Simplified LLM call for testing
        const anthropic = await import('@anthropic-ai/sdk');
        const client = new anthropic.default({ 
            apiKey: process.env.ANTHROPIC_API_KEY 
        });
        
        const rowsToExamine = params.rowsToExamine || 5;
        const skipRows = params.topRowsToIgnore || 0;
        const maxColumns = params.maxColumns || 20;
        
        // Prepare data sample for LLM based on parameters
        const analysisData = rawData.slice(skipRows);
        const dataSample = analysisData.slice(0, rowsToExamine).map(row => row.slice(0, maxColumns));
        
        // Get the actual prompt that will be sent
        const prompt = this.buildAnalysisPrompt(dataSample, params);
        
        logger.info('Sending prompt to LLM:', { promptLength: prompt.length });
        
        // Direct LLM call
        const response = await client.messages.create({
            model: 'claude-opus-4-1-20250805',
            max_tokens: 4000,
            temperature: 0.2,
            messages: [{
                role: 'user',
                content: prompt
            }]
        });
        
        const responseText = response.content[0].text;
        
        // Try to parse JSON from response
        let llmResponse;
        try {
            const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                llmResponse = JSON.parse(jsonMatch[1] || jsonMatch[0]);
            } else {
                throw new Error('No JSON found in LLM response');
            }
        } catch (parseError) {
            logger.error('Failed to parse LLM response:', parseError);
            llmResponse = {
                success: false,
                error: 'Failed to parse LLM response',
                rawResponse: responseText
            };
        }
        
        return {
            inputData: dataSample,
            promptSent: prompt,
            llmRawResponse: responseText,
            llmParsedResponse: llmResponse,
            analysisSuccess: llmResponse.success !== false,
            errorIfAny: llmResponse.error,
            processingTime: 'Not measured'
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

    // REMOVED: detectHeaderPatterns method - all pattern detection now handled by LLM

    buildAnalysisPrompt(dataSample, params = {}) {
        const rowCount = dataSample.length;
        const colCount = dataSample[0]?.length || 0;
        const skipRows = params.topRowsToIgnore || 0;
        
        // Build the generic data analysis prompt that works for any survey structure
        const DATA_WRANGLING_PROMPT = `# Generic Data Structure Analysis

You are an expert data analyst. Analyze this tabular data and determine how to clean it into a proper format.

## Analysis Parameters:
- Examining: ${rowCount} rows, ${colCount} columns
- Top rows ignored: ${skipRows}
- This represents the ${skipRows > 0 ? `data starting from row ${skipRows}` : 'beginning of the file'}

## Data Sample:
${dataSample.map((row, i) => `Row ${skipRows + i}: [${row.map(cell => `"${cell || ''}"`).join(', ')}]`).join('\n')}

## Your Task:
1. Identify which rows contain headers vs actual data
2. Determine if headers span multiple rows and need combining  
3. Detect any matrix/grid questions that should be handled specially
4. Create a plan to extract clean, meaningful column headers
5. Ensure all data is preserved during cleaning
6. Account for the ${skipRows} rows that were skipped at the beginning

## Required JSON Response Format:
{
  "success": true,
  "analysis": {
    "structure_type": "<describe what you see - survey, data table, report, etc>",
    "question_rows": [<array of row indices containing headers, relative to original file>],
    "data_start_row": <first row with actual data, relative to original file>,
    "header_issues": ["<list of problems found>"],
    "recommended_approach": "<your strategy>",
    "column_analysis": {
      "total_columns": ${colCount},
      "empty_columns": "<count of consistently empty columns>",
      "pattern_detected": "<single_row_headers|multi_row_headers|matrix_questions|mixed>"
    }
  },
  "wrangling_plan": {
    "step_1": {
      "action": "<action_name>",
      "description": "<what this step does>",
      "target_rows": [<affected rows, relative to original file>]
    },
    "step_2": {
      "action": "<action_name>",
      "description": "<what this step does>"
    }
  }
}

Analyze the structure and provide a generic cleaning approach that would work for similar datasets.`;

        return DATA_WRANGLING_PROMPT;
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