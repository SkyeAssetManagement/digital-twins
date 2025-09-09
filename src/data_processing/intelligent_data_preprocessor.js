/**
 * Intelligent Data Preprocessor using Claude Opus 4.1
 * Automatically detects and fixes Excel/CSV structure issues
 */

import Anthropic from '@anthropic-ai/sdk';
import { DATA_WRANGLING_PROMPT } from '../prompts/data-wrangling-prompt.js';
import { createLogger } from '../utils/logger.js';
import { AppError } from '../utils/error-handler.js';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const logger = createLogger('IntelligentDataPreprocessor');

export class IntelligentDataPreprocessor {
    constructor() {
        this.claudeClient = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY
        });
        this.wranglingHistory = new Map(); // Store wrangling plans for UI display
    }

    /**
     * Process Excel/CSV file with intelligent structure detection and correction
     * @param {string} filePath - Path to the Excel/CSV file
     * @param {Object} options - Processing options
     * @returns {Object} - Clean data with wrangling report
     */
    async processFile(filePath, options = {}) {
        try {
            logger.info(`Starting intelligent preprocessing of: ${filePath}`);

            // Step 1: Extract raw data structure from file
            const rawStructure = await this.extractRawStructure(filePath);
            logger.info(`Extracted ${rawStructure.totalRows} rows, ${rawStructure.totalColumns} columns`);

            // Step 2: Analyze structure with Claude Opus 4.1
            const analysisResult = await this.analyzeDataStructure(rawStructure);
            logger.info('Claude Opus 4.1 structure analysis completed');

            // Step 3: Apply data wrangling based on analysis
            const cleanData = await this.applyDataWrangling(rawStructure, analysisResult);
            logger.info(`Data wrangling completed. Clean headers: ${cleanData.headers.length}`);

            // Step 4: Create wrangling report for UI
            const wranglingReport = this.createWranglingReport(analysisResult, cleanData);

            // Store for later retrieval
            const reportId = `${path.basename(filePath)}_${Date.now()}`;
            this.wranglingHistory.set(reportId, wranglingReport);

            return {
                success: true,
                data: cleanData,
                wranglingReport: wranglingReport,
                reportId: reportId,
                metadata: {
                    originalFile: path.basename(filePath),
                    totalRows: rawStructure.totalRows,
                    totalColumns: rawStructure.totalColumns,
                    cleanHeaders: cleanData.headers.length,
                    dataRows: cleanData.responses.length,
                    processingTime: new Date().toISOString()
                }
            };

        } catch (error) {
            logger.error('Intelligent preprocessing failed', error);
            throw new AppError(`Data preprocessing failed: ${error.message}`);
        }
    }

    /**
     * Extract raw data structure from Excel/CSV file
     */
    async extractRawStructure(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                throw new AppError(`File not found: ${filePath}`);
            }

            const fileExtension = path.extname(filePath).toLowerCase();
            let rawData;

            if (fileExtension === '.xlsx' || fileExtension === '.xls') {
                // Read Excel file
                const workbook = XLSX.readFile(filePath);
                const sheetName = workbook.SheetNames[0]; // Use first sheet
                const worksheet = workbook.Sheets[sheetName];
                rawData = XLSX.utils.sheet_to_json(worksheet, { 
                    header: 1, // Return array of arrays
                    defval: null // Use null for empty cells
                });
            } else if (fileExtension === '.csv') {
                // Handle CSV files
                const csvContent = fs.readFileSync(filePath, 'utf8');
                rawData = csvContent.split('\n').map(row => 
                    row.split(',').map(cell => cell.trim() || null)
                );
            } else {
                throw new AppError(`Unsupported file format: ${fileExtension}`);
            }

            // Analyze first 5 rows for structure detection
            const firstFiveRows = rawData.slice(0, 5);
            const totalRows = rawData.length;
            const totalColumns = Math.max(...rawData.map(row => row.length));

            return {
                firstFiveRows,
                fullData: rawData,
                totalRows,
                totalColumns,
                fileName: path.basename(filePath)
            };

        } catch (error) {
            logger.error('Failed to extract raw structure', error);
            throw new AppError(`File extraction failed: ${error.message}`);
        }
    }

    /**
     * Analyze data structure using Claude Opus 4.1
     */
    async analyzeDataStructure(rawStructure) {
        try {
            // Format structure for Claude analysis
            const structureDescription = this.formatStructureForAnalysis(rawStructure);

            const response = await this.claudeClient.messages.create({
                model: 'claude-opus-4-1-20250805', // Use Claude Opus 4.1 as required
                max_tokens: 4000,
                temperature: 0.2, // Lower temperature for analytical precision
                messages: [{
                    role: 'user',
                    content: `${DATA_WRANGLING_PROMPT}\n\n## Data Structure to Analyze\n\n${structureDescription}\n\nPlease analyze this survey data structure and provide a complete data wrangling plan in JSON format.`
                }]
            });

            // Extract JSON from response
            const responseText = response.content[0].text;
            const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
            
            if (!jsonMatch) {
                logger.warn('No JSON found in Claude response, attempting fallback parsing');
                // Try to find JSON without code blocks
                const directJsonMatch = responseText.match(/\{[\s\S]*\}/);
                if (directJsonMatch) {
                    return JSON.parse(directJsonMatch[0]);
                }
                throw new AppError('Could not extract JSON analysis from Claude response');
            }

            const analysis = JSON.parse(jsonMatch[1]);
            logger.info('Successfully parsed Claude analysis');
            return analysis;

        } catch (error) {
            logger.error('Claude analysis failed', error);
            throw new AppError(`Structure analysis failed: ${error.message}`);
        }
    }

    /**
     * Format raw structure for Claude analysis
     */
    formatStructureForAnalysis(rawStructure) {
        const { firstFiveRows, totalRows, totalColumns, fileName } = rawStructure;
        
        let formatted = '';
        firstFiveRows.forEach((row, index) => {
            formatted += `Row ${index + 1}: [${row.map(cell => 
                cell === null ? 'null' : `"${cell}"`
            ).join(', ')}]\n\n`;
        });

        formatted += `Additional Context:\n`;
        formatted += `- File: ${fileName}\n`;
        formatted += `- Total columns: ${totalColumns}\n`;
        formatted += `- Total rows: ${totalRows}\n`;
        formatted += `- This appears to be survey data that may have header structure issues\n`;

        return formatted;
    }

    /**
     * Apply data wrangling based on Claude's analysis
     */
    async applyDataWrangling(rawStructure, analysis) {
        try {
            const { fullData } = rawStructure;
            const wranglingPlan = analysis.wrangling_plan;
            
            let processedData = [...fullData];
            let headers = [];
            let dataStartRow = analysis.analysis.data_start_row - 1; // Convert to 0-based index

            // Apply wrangling steps in order
            for (const [stepKey, step] of Object.entries(wranglingPlan)) {
                logger.info(`Applying wrangling step: ${step.action}`);
                
                switch (step.action) {
                    case 'extract_questions_from_row':
                        headers = this.extractQuestions(processedData, step.target_row - 1);
                        break;
                        
                    case 'forward_fill_empty_cells':
                        headers = this.forwardFillHeaders(headers);
                        break;
                        
                    case 'remove_metadata_row':
                        // Skip metadata rows - already handled by data_start_row
                        break;
                        
                    case 'concatenate_headers':
                        if (step.source_rows && step.source_rows.length > 1) {
                            headers = this.concatenateMultiRowHeaders(
                                processedData, 
                                step.source_rows.map(r => r - 1), 
                                step.separator || ' - '
                            );
                        }
                        break;
                }
            }

            // Extract clean data rows
            const dataRows = processedData.slice(dataStartRow);
            const cleanResponses = this.processDataRows(dataRows, headers);

            return {
                headers: headers.filter(h => h && h.trim()), // Remove empty headers
                responses: cleanResponses,
                fields: this.generateFieldsFromHeaders(headers),
                wranglingSteps: Object.keys(wranglingPlan)
            };

        } catch (error) {
            logger.error('Data wrangling failed', error);
            throw new AppError(`Data wrangling failed: ${error.message}`);
        }
    }

    /**
     * Extract questions from specified row
     */
    extractQuestions(data, rowIndex) {
        if (rowIndex >= data.length) return [];
        return data[rowIndex].map(cell => cell ? String(cell).trim() : '');
    }

    /**
     * Forward fill empty cells in headers
     */
    forwardFillHeaders(headers) {
        let lastNonEmpty = '';
        return headers.map(header => {
            if (header && header.trim()) {
                lastNonEmpty = header.trim();
                return lastNonEmpty;
            } else {
                return lastNonEmpty;
            }
        });
    }

    /**
     * Concatenate headers from multiple rows
     */
    concatenateMultiRowHeaders(data, rowIndices, separator) {
        const concatenated = [];
        const maxColumns = Math.max(...rowIndices.map(idx => data[idx]?.length || 0));
        
        for (let col = 0; col < maxColumns; col++) {
            const parts = rowIndices
                .map(rowIdx => data[rowIdx]?.[col])
                .filter(part => part && String(part).trim())
                .map(part => String(part).trim());
            
            concatenated.push(parts.join(separator));
        }
        
        return concatenated;
    }

    /**
     * Process data rows into clean format
     */
    processDataRows(dataRows, headers) {
        return dataRows
            .filter(row => row && row.some(cell => cell !== null && cell !== '')) // Remove empty rows
            .map(row => {
                const response = {};
                headers.forEach((header, index) => {
                    if (header && header.trim()) {
                        response[header] = row[index] || null;
                    }
                });
                return response;
            });
    }

    /**
     * Generate field metadata from clean headers
     */
    generateFieldsFromHeaders(headers) {
        const fields = {};
        headers.forEach((header, index) => {
            if (header && header.trim()) {
                const fieldKey = `q${index + 1}`;
                fields[fieldKey] = {
                    title: header.trim(),
                    type: this.inferFieldType(header),
                    required: false,
                    originalIndex: index
                };
            }
        });
        return fields;
    }

    /**
     * Infer field type from header text
     */
    inferFieldType(header) {
        const lowerHeader = header.toLowerCase();
        if (lowerHeader.includes('age') || lowerHeader.includes('how many') || lowerHeader.includes('number')) {
            return 'number';
        } else if (lowerHeader.includes('email')) {
            return 'email';
        } else {
            return 'text';
        }
    }

    /**
     * Create wrangling report for UI display
     */
    createWranglingReport(analysis, cleanData) {
        const examples = this.generateWranglingExamples(cleanData);
        
        return {
            summary: "Automatically detected and fixed Excel structure issues",
            issuesDetected: analysis.analysis.issues_detected || [],
            stepsApplied: analysis.processing_notes || [],
            headerPattern: analysis.analysis.header_pattern,
            questionsExtracted: cleanData.headers.length,
            dataRowsProcessed: cleanData.responses.length,
            examples: examples,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Generate examples showing before/after wrangling
     */
    generateWranglingExamples(cleanData) {
        const examples = [];
        
        // Show first few clean headers as examples
        const headerExamples = cleanData.headers.slice(0, 5).map(header => ({
            before: "Question X (placeholder)",
            after: header,
            action: "Extracted actual question text"
        }));

        // Add header examples to the main examples array
        examples.push(...headerExamples);

        // Show first data record example
        if (cleanData.responses.length > 0) {
            const firstResponse = cleanData.responses[0];
            const responseExample = {
                before: "No structured data",
                after: Object.fromEntries(
                    Object.entries(firstResponse).slice(0, 3) // First 3 fields
                ),
                action: "Extracted clean survey responses"
            };
            examples.push(responseExample);
        }

        return examples;
    }

    /**
     * Get wrangling history for UI display
     */
    getWranglingHistory(reportId) {
        return this.wranglingHistory.get(reportId);
    }

    /**
     * Export clean data as CSV
     */
    async exportAsCSV(cleanData, outputPath) {
        try {
            const { headers, responses } = cleanData;
            
            // Create CSV content
            const csvRows = [headers.join(',')];
            responses.forEach(response => {
                const row = headers.map(header => {
                    const value = response[header] || '';
                    // Escape commas and quotes
                    return `"${String(value).replace(/"/g, '""')}"`;
                });
                csvRows.push(row.join(','));
            });

            const csvContent = csvRows.join('\n');
            fs.writeFileSync(outputPath, csvContent, 'utf8');
            
            logger.info(`Exported clean CSV to: ${outputPath}`);
            return { success: true, path: outputPath, rows: responses.length };

        } catch (error) {
            logger.error('CSV export failed', error);
            throw new AppError(`CSV export failed: ${error.message}`);
        }
    }
}

// Singleton instance
let preprocessor = null;

export async function getIntelligentDataPreprocessor() {
    if (!preprocessor) {
        preprocessor = new IntelligentDataPreprocessor();
    }
    return preprocessor;
}