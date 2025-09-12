#!/usr/bin/env node
/**
 * Generate Field Mapping CSV - Follows Exact Data Wrangling Process
 * This script follows the exact same process as ImprovedDataWrangler 
 * and then applies the ColumnQuestionMapper Q numbering protocol
 */

import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Read the existing complete column comparison CSV and apply Q numbering
 */
function generateFieldMappingCSV() {
    console.log('🚀 Generating Field Mapping CSV following exact data wrangling process...');
    
    try {
        // Read the actual output from the data wrangling pipeline
        const csvPath = path.join(__dirname, '..', 'complete_column_comparison_253.csv');
        console.log(`📂 Reading existing pipeline output: ${csvPath}`);
        
        const csvContent = readFileSync(csvPath, 'utf8');
        const lines = csvContent.split('\n');
        const header = lines[0];
        const dataLines = lines.slice(1).filter(line => line.trim());
        
        console.log(`📊 Processing ${dataLines.length} columns from pipeline output`);
        
        // Parse the CSV data
        const columns = [];
        for (let i = 0; i < dataLines.length; i++) {
            const line = dataLines[i];
            if (!line.trim()) continue;
            
            // Parse CSV line (handle quoted fields)
            const fields = parseCSVLine(line);
            
            if (fields.length >= 6) {
                columns.push({
                    column_index: parseInt(fields[0]) || i,
                    llm_result: fields[1] || '',
                    original_row_0: fields[2] || '',
                    original_row_1: fields[3] || '',
                    ffill_row_0: fields[4] || '',
                    concatenated_full: fields[5] || ''
                });
            }
        }
        
        console.log(`✅ Parsed ${columns.length} column records`);
        
        // Apply Q numbering protocol (same as ColumnQuestionMapper)
        const fieldMapping = applyQNumbering(columns);
        
        // Generate CSV output
        const outputPath = path.join(__dirname, '..', 'field_mapping_with_q_numbers.csv');
        writeCSVFile(fieldMapping, outputPath);
        
        console.log('🎉 Field mapping CSV generated successfully!');
        console.log(`📁 Output file: ${outputPath}`);
        
        // Show key brand questions
        const brandQuestions = fieldMapping.filter(field => 
            field.notes && field.notes.includes('BRAND')
        );
        
        console.log('\n🎯 Key Brand Questions Found:');
        brandQuestions.forEach(field => {
            console.log(`   ${field.q_number}: ${field.question_text} (${field.notes})`);
        });
        
        return { success: true, totalColumns: fieldMapping.length, brandQuestions: brandQuestions.length };
        
    } catch (error) {
        console.error('❌ Failed to generate field mapping CSV:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Parse a CSV line handling quoted fields
 */
function parseCSVLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"' && (i === 0 || line[i-1] === ',')) {
            inQuotes = true;
        } else if (char === '"' && inQuotes && (i === line.length - 1 || line[i+1] === ',')) {
            inQuotes = false;
        } else if (char === ',' && !inQuotes) {
            fields.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    fields.push(current.trim());
    return fields;
}

/**
 * Apply Q numbering protocol following ColumnQuestionMapper logic
 */
function applyQNumbering(columns) {
    console.log('🔢 Applying Q numbering protocol...');
    
    const fieldMapping = [];
    let questionCounter = 1;
    
    // PreData column patterns (same as ColumnQuestionMapper)
    const preDataPatterns = [
        'ip', 'address', 'user_agent', 'browser',
        'device', 'timestamp', 'time', 'date',
        'respondent', 'id', 'uuid', 'session',
        'referrer', 'source', 'utm_', 'status',
        'completion', 'duration', 'start_', 'end_'
    ];
    
    for (const column of columns) {
        const columnName = column.llm_result || `column_${column.column_index}`;
        const questionText = column.concatenated_full || column.ffill_row_0 || '';
        
        // Check if this is preData
        const isPreData = isPreDataColumn(columnName, preDataPatterns);
        
        // Assign Q number
        const qNumber = isPreData ? 'preData' : `Q${questionCounter}`;
        
        // Identify brand-related questions
        let notes = '';
        if (!isPreData) {
            if (questionText.toLowerCase().includes('brand') && 
                (questionText.toLowerCase().includes('why') || 
                 questionText.toLowerCase().includes('chose') ||
                 questionText.toLowerCase().includes('reason'))) {
                notes = 'BRAND PREFERENCE EXPLANATION';
            } else if (questionText.toLowerCase().includes('brand') && 
                      questionText.toLowerCase().includes('trust')) {
                notes = 'BRAND TRUST QUESTION';
            } else if (questionText.toLowerCase().includes('brand') && 
                      (questionText.toLowerCase().includes('used') || 
                       questionText.toLowerCase().includes('works'))) {
                notes = 'BRAND EXPERIENCE QUESTION';
            }
        }
        
        fieldMapping.push({
            q_number: qNumber,
            column_index: column.column_index,
            column_id: columnName,
            question_text: questionText,
            original_row_0: column.original_row_0,
            original_row_1: column.original_row_1,
            response_type: inferResponseType(questionText),
            notes: notes || (isPreData ? 'Survey metadata' : '')
        });
        
        // Only increment for actual survey questions
        if (!isPreData) {
            questionCounter++;
        }
    }
    
    console.log(`✅ Applied Q numbering: ${fieldMapping.filter(f => f.q_number.startsWith('Q')).length} survey questions, ${fieldMapping.filter(f => f.q_number === 'preData').length} preData columns`);
    
    return fieldMapping;
}

/**
 * Check if column is preData following same logic as ColumnQuestionMapper
 */
function isPreDataColumn(columnName, preDataPatterns) {
    const lowerName = columnName.toLowerCase();
    
    return preDataPatterns.some(pattern => 
        lowerName.includes(pattern.toLowerCase())
    );
}

/**
 * Infer response type from question text
 */
function inferResponseType(questionText) {
    const lowerText = questionText.toLowerCase();
    
    if (lowerText.includes('date') || lowerText.includes('time')) {
        return 'datetime';
    }
    if (lowerText.includes('how many') || lowerText.includes('number')) {
        return 'numeric';
    }
    if (lowerText.includes('rate') || lowerText.includes('scale')) {
        return 'rating';
    }
    if (lowerText.includes('important') || lowerText.includes('agree')) {
        return 'likert';
    }
    if (lowerText.includes('often') || lowerText.includes('frequency')) {
        return 'frequency';
    }
    if (lowerText.includes('open-ended') || lowerText.includes('explain') || lowerText.includes('why')) {
        return 'open_ended';
    }
    if (lowerText.includes('yes') || lowerText.includes('no')) {
        return 'binary';
    }
    
    return 'categorical';
}

/**
 * Write field mapping to CSV file
 */
function writeCSVFile(fieldMapping, outputPath) {
    console.log('📝 Writing CSV file...');
    
    const csvLines = [
        'Q_Number,Column_Index,Column_ID,Question_Text,Original_Row_0,Original_Row_1,Response_Type,Notes'
    ];
    
    for (const field of fieldMapping) {
        const line = [
            field.q_number,
            field.column_index,
            `"${field.column_id}"`,
            `"${field.question_text.replace(/"/g, '""')}"`,
            `"${field.original_row_0.replace(/"/g, '""')}"`,
            `"${field.original_row_1.replace(/"/g, '""')}"`,
            field.response_type,
            `"${field.notes}"`
        ].join(',');
        
        csvLines.push(line);
    }
    
    writeFileSync(outputPath, csvLines.join('\n'), 'utf8');
    console.log(`✅ CSV written with ${fieldMapping.length} records`);
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
    generateFieldMappingCSV();
}

export { generateFieldMappingCSV };