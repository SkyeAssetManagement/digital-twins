/**
 * Create Q Number Mapping CSV - Simple Version
 * Reads the existing complete_column_comparison_253.csv and adds Q numbers
 */

const fs = require('fs');
const path = require('path');

function createQMappingCSV() {
    console.log('🚀 Creating Q number mapping CSV...');
    
    try {
        // Read the existing CSV
        const csvPath = path.join(__dirname, '..', 'complete_column_comparison_253.csv');
        console.log(`📂 Reading: ${csvPath}`);
        
        const csvContent = fs.readFileSync(csvPath, 'utf8');
        const lines = csvContent.split('\n');
        const dataLines = lines.slice(1).filter(line => line.trim());
        
        console.log(`📊 Processing ${dataLines.length} columns`);
        
        // Parse CSV and apply Q numbering
        const fieldMapping = [];
        let questionCounter = 1;
        
        // PreData patterns (same as ColumnQuestionMapper)
        const preDataPatterns = [
            'ip', 'address', 'user_agent', 'browser', 'device', 
            'timestamp', 'time', 'date', 'respondent', 'id', 'uuid', 
            'session', 'referrer', 'source', 'utm_', 'status',
            'completion', 'duration', 'start_', 'end_'
        ];
        
        for (let i = 0; i < dataLines.length; i++) {
            const line = dataLines[i];
            if (!line.trim()) continue;
            
            // Simple CSV parsing (assuming no complex quotes in first few fields)
            const fields = line.split(',');
            if (fields.length < 6) continue;
            
            const columnIndex = i;
            const llmResult = fields[1] || `column_${i}`;
            const originalRow0 = fields[2] || '';
            const originalRow1 = fields[3] || '';
            const concatenatedFull = fields[5] || '';
            
            // Check if preData
            const lowerName = llmResult.toLowerCase();
            const isPreData = preDataPatterns.some(pattern => 
                lowerName.includes(pattern.toLowerCase())
            );
            
            // Assign Q number
            const qNumber = isPreData ? 'preData' : `Q${questionCounter}`;
            
            // Identify brand questions
            let notes = '';
            if (!isPreData) {
                const lowerText = concatenatedFull.toLowerCase();
                if (lowerText.includes('brand')) {
                    if ((lowerText.includes('why') || lowerText.includes('chose') || lowerText.includes('reason')) && 
                        (lowerText.includes('$100') || lowerText.includes('spend'))) {
                        notes = 'BRAND PREFERENCE EXPLANATION - Q120 TARGET';
                    } else if (lowerText.includes('trust')) {
                        notes = 'BRAND TRUST QUESTION';
                    } else if (lowerText.includes('used') || lowerText.includes('works')) {
                        notes = 'BRAND EXPERIENCE QUESTION';
                    } else {
                        notes = 'BRAND RELATED';
                    }
                }
            }
            
            fieldMapping.push({
                qNumber: qNumber,
                columnIndex: columnIndex,
                columnId: llmResult,
                questionText: concatenatedFull,
                originalRow0: originalRow0,
                originalRow1: originalRow1,
                responseType: inferResponseType(concatenatedFull),
                notes: notes || (isPreData ? 'Survey metadata' : '')
            });
            
            // Increment question counter for survey questions only
            if (!isPreData) {
                questionCounter++;
            }
        }
        
        // Write output CSV
        const outputPath = path.join(__dirname, '..', 'field_mapping_with_q_numbers.csv');
        const csvLines = [
            'Q_Number,Column_Index,Column_ID,Question_Text,Original_Row_0,Original_Row_1,Response_Type,Notes'
        ];
        
        for (const field of fieldMapping) {
            const line = [
                field.qNumber,
                field.columnIndex,
                `"${field.columnId.replace(/"/g, '""')}"`,
                `"${field.questionText.replace(/"/g, '""')}"`,
                `"${field.originalRow0.replace(/"/g, '""')}"`,
                `"${field.originalRow1.replace(/"/g, '""')}"`,
                field.responseType,
                `"${field.notes}"`
            ].join(',');
            
            csvLines.push(line);
        }
        
        fs.writeFileSync(outputPath, csvLines.join('\n'), 'utf8');
        
        console.log(`✅ Generated CSV with ${fieldMapping.length} records`);
        console.log(`📁 Output: ${outputPath}`);
        
        // Show brand questions
        const brandQuestions = fieldMapping.filter(f => f.notes.includes('BRAND'));
        console.log(`\n🎯 Found ${brandQuestions.length} brand-related questions:`);
        
        brandQuestions.forEach(field => {
            console.log(`   ${field.qNumber}: ${field.notes}`);
        });
        
        // Find Q120 specifically
        const q120 = fieldMapping.find(f => f.notes.includes('Q120 TARGET'));
        if (q120) {
            console.log(`\n🎯 Q120 TARGET FOUND: ${q120.qNumber} - "${q120.questionText}"`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

function inferResponseType(questionText) {
    const lowerText = questionText.toLowerCase();
    
    if (lowerText.includes('open-ended') || lowerText.includes('explain') || lowerText.includes('why')) {
        return 'open_ended';
    }
    if (lowerText.includes('important')) {
        return 'importance';
    }
    if (lowerText.includes('often') || lowerText.includes('frequency')) {
        return 'frequency';
    }
    if (lowerText.includes('agree')) {
        return 'agreement';
    }
    if (lowerText.includes('likely')) {
        return 'likelihood';
    }
    
    return 'categorical';
}

// Run the script
createQMappingCSV();