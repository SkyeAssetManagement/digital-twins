/**
 * Improved Data Wrangling Pipeline - Node.js Implementation
 * Handles up to 4 header rows with forward-fill and LLM abbreviation
 */

import Anthropic from '@anthropic-ai/sdk';
import * as XLSX from 'xlsx';
import fs from 'fs/promises';

export class ImprovedDataWrangler {
    constructor(apiKey) {
        this.anthropic = new Anthropic({ apiKey });
        this.originalData = null;
        this.headerRows = [];
        this.dataStartRow = null;
        this.columnMapping = {}; // {col_num: {longName: str, shortName: str}}
        this.filledHeaders = [];
        this.concatenatedHeaders = [];
        this.abbreviatedHeaders = [];
    }

    /**
     * Load Excel data from buffer
     */
    loadExcelData(buffer) {
        try {
            console.log('Loading Excel data from buffer...');
            
            const workbook = XLSX.read(buffer);
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // Convert to array of arrays
            const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
            
            // Convert all cells to strings and handle empty cells
            this.originalData = data.map(row => 
                row.map(cell => cell === null || cell === undefined ? '' : String(cell).trim())
            );

            console.log(`Loaded Excel data: ${this.originalData.length} rows x ${this.originalData[0]?.length || 0} columns`);
            
            return { 
                success: true, 
                rows: this.originalData.length, 
                columns: this.originalData[0]?.length || 0 
            };
            
        } catch (error) {
            console.error('Failed to load Excel data:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Step 1: Determine number of header rows by analyzing data patterns
     */
    determineHeaderRows() {
        if (!this.originalData || this.originalData.length === 0) {
            return { success: false, error: 'No data loaded' };
        }

        console.log('Determining header rows...');
        
        const dataStartCandidates = [];
        
        // Analyze first 10 rows to find data pattern
        for (let rowIdx = 0; rowIdx < Math.min(10, this.originalData.length); rowIdx++) {
            const row = this.originalData[rowIdx];
            
            // Count empty and numeric cells
            const emptyCells = row.filter(cell => !cell || cell === '').length;
            const numericCells = row.filter(cell => 
                cell && /^-?\d+\.?\d*$/.test(String(cell).replace(/,/g, ''))
            ).length;
            
            const totalCells = row.length;
            const emptyRatio = emptyCells / totalCells;
            const numericRatio = numericCells / totalCells;
            
            console.log(`Row ${rowIdx}: empty_ratio=${emptyRatio.toFixed(2)}, numeric_ratio=${numericRatio.toFixed(2)}`);
            
            // Data rows typically have lower empty ratio and higher numeric ratio
            if (emptyRatio < 0.7 && numericRatio > 0.1) {
                dataStartCandidates.push(rowIdx);
            }
        }
        
        // Use the earliest candidate as data start
        this.dataStartRow = dataStartCandidates.length > 0 ? Math.min(...dataStartCandidates) : 2;
        
        // Header rows are everything before data start (max 4)
        this.headerRows = Array.from({ length: Math.min(4, this.dataStartRow) }, (_, i) => i);
        
        console.log(`Determined header rows: [${this.headerRows.join(', ')}]`);
        console.log(`Data starts at row: ${this.dataStartRow}`);
        
        return {
            success: true,
            headerRows: this.headerRows,
            dataStartRow: this.dataStartRow
        };
    }

    /**
     * Step 2: Fill forward to the right for blank columns in header rows
     */
    forwardFillHeaders() {
        if (!this.headerRows || this.headerRows.length === 0) {
            return { success: false, error: 'Header rows not determined' };
        }

        console.log('Forward filling header rows...');
        
        this.filledHeaders = [];
        
        for (const rowIdx of this.headerRows) {
            if (rowIdx >= this.originalData.length) continue;
            
            const row = [...this.originalData[rowIdx]]; // Copy
            const filledRow = [];
            let lastValue = '';
            
            for (const cell of row) {
                if (cell && cell.trim()) {
                    lastValue = cell.trim();
                    filledRow.push(lastValue);
                } else {
                    filledRow.push(lastValue);
                }
            }
            
            this.filledHeaders.push(filledRow);
            console.log(`Row ${rowIdx} filled: first 5 = [${filledRow.slice(0, 5).join(', ')}]`);
        }
        
        return { success: true, filledHeaders: this.filledHeaders.length };
    }

    /**
     * Step 3: Bottom row concatenates itself and rows above, separated by |
     */
    concatenateHeaders() {
        if (!this.filledHeaders || this.filledHeaders.length === 0) {
            return { success: false, error: 'Headers not forward filled' };
        }

        console.log('Concatenating headers with | separator...');
        
        const numColumns = this.filledHeaders[0]?.length || 0;
        this.concatenatedHeaders = [];
        
        for (let colIdx = 0; colIdx < numColumns; colIdx++) {
            // Collect all header values for this column
            const columnParts = [];
            
            for (const rowData of this.filledHeaders) {
                if (colIdx < rowData.length && rowData[colIdx]) {
                    columnParts.push(rowData[colIdx]);
                }
            }
            
            // Remove duplicates while preserving order
            const uniqueParts = [];
            for (const part of columnParts) {
                if (!uniqueParts.includes(part)) {
                    uniqueParts.push(part);
                }
            }
            
            // Join with | separator
            const longName = uniqueParts.length > 0 ? uniqueParts.join(' | ') : `Column_${colIdx}`;
            this.concatenatedHeaders.push(longName);
        }
        
        console.log(`Created ${this.concatenatedHeaders.length} concatenated headers`);
        if (this.concatenatedHeaders.length > 15) {
            console.log(`Example: Column 15 = '${this.concatenatedHeaders[15]}'`);
        }
        
        return { success: true, concatenatedCount: this.concatenatedHeaders.length };
    }

    /**
     * Step 4: LLM cycles through concatenated text and makes each section more concise
     */
    async llmAbbreviateHeaders(batchSize = 25) {
        if (!this.concatenatedHeaders || this.concatenatedHeaders.length === 0) {
            return { success: false, error: 'Headers not concatenated' };
        }

        console.log(`LLM abbreviating ${this.concatenatedHeaders.length} headers in batches of ${batchSize}...`);
        
        this.abbreviatedHeaders = [];
        
        // Process in batches to avoid overwhelming the LLM
        for (let batchStart = 0; batchStart < this.concatenatedHeaders.length; batchStart += batchSize) {
            const batchEnd = Math.min(batchStart + batchSize, this.concatenatedHeaders.length);
            const batchHeaders = this.concatenatedHeaders.slice(batchStart, batchEnd);
            
            console.log(`Processing batch ${batchStart}-${batchEnd - 1}`);
            
            // Build prompt for this batch
            const headerList = batchHeaders.map((header, i) => 
                `${i + batchStart}: ${header}`
            ).join('\n');
            
            const prompt = `You are abbreviating survey column headers to make them concise and readable.

For each header below, create a short, clear column name that captures the essential meaning.
Rules:
- Use snake_case format (lowercase with underscores)
- Maximum 30 characters
- Preserve key information but remove redundancy
- For matrix questions, focus on the specific aspect being measured
- Make names unique and descriptive

Headers to abbreviate:
${headerList}

Return ONLY a JSON object with the format:
{
  "0": "abbreviated_name_1",
  "1": "abbreviated_name_2",
  ...
}

Use the original column numbers (not 0-indexed for this batch).`;

            try {
                const response = await this.anthropic.messages.create({
                    model: "claude-opus-4-1-20250805",
                    max_tokens: 3000,
                    temperature: 0.2,
                    messages: [{
                        role: "user",
                        content: prompt
                    }]
                });
                
                let responseText = response.content[0].text.trim();
                
                // Parse JSON response
                if (responseText.startsWith('```json')) {
                    responseText = responseText.replace(/```json|```/g, '').trim();
                } else if (responseText.startsWith('```')) {
                    responseText = responseText.replace(/```/g, '').trim();
                }
                
                const batchResult = JSON.parse(responseText);
                
                // Convert back to list format
                for (let i = 0; i < batchHeaders.length; i++) {
                    const colIdx = batchStart + i;
                    if (batchResult[String(colIdx)]) {
                        this.abbreviatedHeaders.push(batchResult[String(colIdx)]);
                    } else {
                        // Fallback if LLM didn't provide abbreviation
                        const fallbackName = `col_${colIdx}`;
                        this.abbreviatedHeaders.push(fallbackName);
                        console.warn(`No abbreviation for column ${colIdx}, using fallback: ${fallbackName}`);
                    }
                }
                
                console.log(`Batch ${batchStart}-${batchEnd - 1} completed successfully`);
                
            } catch (error) {
                console.error(`LLM abbreviation failed for batch ${batchStart}-${batchEnd - 1}:`, error);
                // Fallback for this batch
                for (let i = 0; i < batchHeaders.length; i++) {
                    const colIdx = batchStart + i;
                    const fallbackName = `col_${colIdx}`;
                    this.abbreviatedHeaders.push(fallbackName);
                }
            }
        }
        
        console.log(`LLM abbreviation completed: ${this.abbreviatedHeaders.length} headers`);
        
        return { success: true, abbreviatedCount: this.abbreviatedHeaders.length };
    }

    /**
     * Step 5: Save column mapping with number, longName, shortName
     */
    async createColumnMapping() {
        if (!this.concatenatedHeaders || !this.abbreviatedHeaders) {
            return { success: false, error: 'Headers not processed' };
        }

        console.log('Creating column mapping dictionary...');
        
        this.columnMapping = {};
        
        for (let colIdx = 0; colIdx < this.concatenatedHeaders.length; colIdx++) {
            const longName = this.concatenatedHeaders[colIdx];
            const shortName = colIdx < this.abbreviatedHeaders.length 
                ? this.abbreviatedHeaders[colIdx] 
                : `col_${colIdx}`;
            
            this.columnMapping[colIdx] = {
                longName,
                shortName
            };
        }
        
        // Save to JSON file
        const mappingJson = JSON.stringify(this.columnMapping, null, 2);
        await fs.writeFile('column_mapping.json', mappingJson, 'utf-8');
        
        console.log(`Column mapping created for ${Object.keys(this.columnMapping).length} columns`);
        console.log('Saved to column_mapping.json');
        
        return { success: true, mappingCount: Object.keys(this.columnMapping).length };
    }

    /**
     * Generate improved comparison table with up to 4 header rows
     */
    async generateComparisonTable() {
        if (!this.columnMapping || Object.keys(this.columnMapping).length === 0) {
            return { success: false, error: 'Column mapping not created' };
        }

        console.log('Generating improved comparison table with separate header columns...');
        
        // Create comparison data
        const comparisonData = [];
        
        for (const [colIdx, mapping] of Object.entries(this.columnMapping)) {
            const colIndex = parseInt(colIdx);
            
            // Get original row data - separate columns for up to 4 header rows
            const headerValues = ['', '', '', ''];
            
            for (let i = 0; i < Math.min(4, this.headerRows.length); i++) {
                const rowIdx = this.headerRows[i];
                if (rowIdx < this.originalData.length && colIndex < this.originalData[rowIdx].length) {
                    headerValues[i] = this.originalData[rowIdx][colIndex];
                }
            }
            
            comparisonData.push({
                Column: colIndex,
                Row_0_Header: headerValues[0],
                Row_1_Header: headerValues[1],
                Row_2_Header: headerValues[2],
                Row_3_Header: headerValues[3],
                Forward_Filled_Concatenated: mapping.longName,
                LLM_Abbreviated: mapping.shortName
            });
        }
        
        // Create CSV content
        const csvHeader = 'Column,Row_0_Header,Row_1_Header,Row_2_Header,Row_3_Header,Forward_Filled_Concatenated,LLM_Abbreviated\n';
        const csvRows = comparisonData.map(row => 
            `${row.Column},"${row.Row_0_Header}","${row.Row_1_Header}","${row.Row_2_Header}","${row.Row_3_Header}","${row.Forward_Filled_Concatenated}","${row.LLM_Abbreviated}"`
        ).join('\n');
        
        await fs.writeFile('improved_column_comparison.csv', csvHeader + csvRows, 'utf-8');
        
        // Create markdown format
        let markdownContent = `# Improved Column Comparison - All ${comparisonData.length} Columns\n\n`;
        markdownContent += "| Column | Row 0 Header | Row 1 Header | Row 2 Header | Row 3 Header | Forward Filled Concatenated | LLM Abbreviated |\n";
        markdownContent += "|--------|-------------|-------------|-------------|-------------|-----------------------------|-----------------|\n";
        
        for (const row of comparisonData) {
            const col = row.Column;
            const row0 = String(row.Row_0_Header).replace(/\|/g, '\\|');
            const row1 = String(row.Row_1_Header).replace(/\|/g, '\\|');
            const row2 = String(row.Row_2_Header).replace(/\|/g, '\\|');
            const row3 = String(row.Row_3_Header).replace(/\|/g, '\\|');
            const concat = String(row.Forward_Filled_Concatenated).replace(/\|/g, '\\|');
            const abbrev = String(row.LLM_Abbreviated).replace(/\|/g, '\\|');
            
            markdownContent += `| ${col} | \`${row0}\` | \`${row1}\` | \`${row2}\` | \`${row3}\` | \`${concat}\` | \`${abbrev}\` |\n`;
        }
        
        await fs.writeFile('improved_column_comparison.md', markdownContent, 'utf-8');
        
        console.log('Comparison table generated:');
        console.log('- improved_column_comparison.csv');
        console.log('- improved_column_comparison.md');
        
        return { success: true, rows: comparisonData.length };
    }

    /**
     * Run the complete improved pipeline
     */
    async runPipeline(excelBuffer) {
        try {
            console.log('Starting Improved Data Wrangling Pipeline...');
            
            // Step 1: Load data
            const loadResult = this.loadExcelData(excelBuffer);
            if (!loadResult.success) {
                throw new Error(`Load failed: ${loadResult.error}`);
            }
            
            // Step 2: Determine header rows
            const headerResult = this.determineHeaderRows();
            if (!headerResult.success) {
                throw new Error(`Header detection failed: ${headerResult.error}`);
            }
            
            // Step 3: Forward fill headers
            const fillResult = this.forwardFillHeaders();
            if (!fillResult.success) {
                throw new Error(`Forward fill failed: ${fillResult.error}`);
            }
            
            // Step 4: Concatenate headers
            const concatResult = this.concatenateHeaders();
            if (!concatResult.success) {
                throw new Error(`Concatenation failed: ${concatResult.error}`);
            }
            
            // Step 5: LLM abbreviation
            const abbrevResult = await this.llmAbbreviateHeaders();
            if (!abbrevResult.success) {
                throw new Error(`LLM abbreviation failed: ${abbrevResult.error}`);
            }
            
            // Step 6: Create column mapping
            const mappingResult = await this.createColumnMapping();
            if (!mappingResult.success) {
                throw new Error(`Column mapping failed: ${mappingResult.error}`);
            }
            
            // Step 7: Generate comparison table
            const tableResult = await this.generateComparisonTable();
            if (!tableResult.success) {
                throw new Error(`Comparison table failed: ${tableResult.error}`);
            }
            
            console.log('Pipeline completed successfully!');
            
            return {
                success: true,
                results: {
                    totalColumns: Object.keys(this.columnMapping).length,
                    headerRows: this.headerRows,
                    dataStartRow: this.dataStartRow,
                    columnMapping: this.columnMapping,
                    comparisonRows: tableResult.rows
                }
            };
            
        } catch (error) {
            console.error('Pipeline failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

export default ImprovedDataWrangler;