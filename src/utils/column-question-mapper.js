/**
 * Column Question Number Mapper
 * Maps survey columns to question numbers (qNo) for cross-referencing
 * Handles preData (IP, name, etc.) and numbered questions (Q1, Q2, Q3...)
 */

export class ColumnQuestionMapper {
    constructor() {
        this.preDataColumns = [
            'ip_address',
            'user_agent', 
            'respondent_id',
            'start_time',
            'end_time',
            'submission_date',
            'completion_status',
            'referrer_url',
            'device_type',
            'browser_info'
        ];
    }

    /**
     * Generate question number mapping for survey columns
     * @param {Array} columns - Array of column objects with column_name
     * @returns {Object} Column mapping with qNo metadata
     */
    generateColumnMapping(columns) {
        const columnMapping = {};
        let questionCounter = 1;

        for (let i = 0; i < columns.length; i++) {
            const column = columns[i];
            const columnName = column.column_name || column.name || column;
            
            // Check if this is preData or a survey question
            const isPreData = this.isPreDataColumn(columnName);
            
            columnMapping[columnName] = {
                column_index: i,
                column_name: columnName,
                qNo: isPreData ? 'preData' : `Q${questionCounter}`,
                is_predata: isPreData,
                data_type: column.data_type || this.inferDataType(columnName),
                is_open_ended: column.is_open_ended || this.isOpenEnded(columnName),
                cross_reference_enabled: !isPreData,
                metadata: {
                    original_index: i,
                    question_sequence: isPreData ? null : questionCounter,
                    can_reference_other_questions: !isPreData,
                    referenced_by_pattern: isPreData ? null : `Q\\d+.*[Rr]efer.*${questionCounter}`
                }
            };
            
            // Only increment question counter for actual survey questions
            if (!isPreData) {
                questionCounter++;
            }
        }

        return columnMapping;
    }

    /**
     * Check if column is preData (metadata) or survey question
     * @param {string} columnName 
     * @returns {boolean}
     */
    isPreDataColumn(columnName) {
        const lowerName = columnName.toLowerCase();
        
        // Check against known preData patterns
        for (const preDataPattern of this.preDataColumns) {
            if (lowerName.includes(preDataPattern.toLowerCase())) {
                return true;
            }
        }
        
        // Common preData patterns
        const preDataPatterns = [
            'ip', 'address', 'user_agent', 'browser',
            'device', 'timestamp', 'time', 'date',
            'respondent', 'id', 'uuid', 'session',
            'referrer', 'source', 'utm_', 'status',
            'completion', 'duration', 'start_', 'end_'
        ];
        
        return preDataPatterns.some(pattern => 
            lowerName.includes(pattern)
        );
    }

    /**
     * Infer data type from column name
     * @param {string} columnName 
     * @returns {string}
     */
    inferDataType(columnName) {
        const lowerName = columnName.toLowerCase();
        
        if (lowerName.includes('date') || lowerName.includes('time')) {
            return 'datetime';
        }
        if (lowerName.includes('id') || lowerName.includes('number')) {
            return 'numeric';
        }
        if (lowerName.includes('email') || lowerName.includes('url')) {
            return 'text';
        }
        if (lowerName.includes('rating') || lowerName.includes('scale')) {
            return 'numeric';
        }
        
        return 'text';
    }

    /**
     * Check if question is open-ended
     * @param {string} columnName 
     * @returns {boolean}
     */
    isOpenEnded(columnName) {
        const openEndedIndicators = [
            'open-ended', 'open ended', 'text response', 
            'explain', 'describe', 'why', 'how', 'what',
            'comment', 'feedback', 'other', 'please specify',
            'elaborate', 'detail', 'opinion'
        ];
        
        const lowerName = columnName.toLowerCase();
        return openEndedIndicators.some(indicator => 
            lowerName.includes(indicator)
        );
    }

    /**
     * Find potential cross-references in question text
     * @param {string} questionText 
     * @param {Object} columnMapping 
     * @returns {Array} Array of referenced question numbers
     */
    findCrossReferences(questionText, columnMapping) {
        const references = [];
        const lowerText = questionText.toLowerCase();
        
        // Look for patterns like "refer to Q31", "based on question 15", etc.
        const referencePatterns = [
            /q(\d+)/gi,
            /question (\d+)/gi,
            /refer.*(?:to|back to).*q?(\d+)/gi,
            /based on.*q?(\d+)/gi,
            /from.*q?(\d+)/gi,
            /see.*q?(\d+)/gi
        ];
        
        for (const pattern of referencePatterns) {
            let match;
            while ((match = pattern.exec(questionText)) !== null) {
                const questionNumber = parseInt(match[1]);
                const referencedQNo = `Q${questionNumber}`;
                
                // Check if this question number exists in our mapping
                const referencedColumn = Object.values(columnMapping)
                    .find(col => col.qNo === referencedQNo);
                
                if (referencedColumn && !references.includes(referencedQNo)) {
                    references.push(referencedQNo);
                }
            }
        }
        
        return references;
    }

    /**
     * Generate cross-reference dictionary for the entire survey
     * @param {Array} columns - Column definitions with question text
     * @returns {Object} Cross-reference mapping
     */
    generateCrossReferenceMap(columns) {
        const columnMapping = this.generateColumnMapping(columns);
        const crossRefMap = {};
        
        for (const [columnName, mapping] of Object.entries(columnMapping)) {
            if (mapping.cross_reference_enabled && columns.find(col => col.column_name === columnName)?.question_text) {
                const questionText = columns.find(col => col.column_name === columnName).question_text;
                const references = this.findCrossReferences(questionText, columnMapping);
                
                if (references.length > 0) {
                    crossRefMap[mapping.qNo] = {
                        column_name: columnName,
                        references: references,
                        question_text: questionText,
                        can_be_referenced_by: []
                    };
                }
            }
        }
        
        // Build reverse mapping (which questions can reference this one)
        for (const [qNo, refData] of Object.entries(crossRefMap)) {
            for (const referencedQNo of refData.references) {
                if (crossRefMap[referencedQNo]) {
                    crossRefMap[referencedQNo].can_be_referenced_by.push(qNo);
                }
            }
        }
        
        return crossRefMap;
    }

    /**
     * Export column mapping for database storage
     * @param {Array} columns 
     * @returns {Object}
     */
    exportMappingForDatabase(columns) {
        const mapping = this.generateColumnMapping(columns);
        const crossRefMap = this.generateCrossReferenceMap(columns);
        
        return {
            column_mappings: mapping,
            cross_references: crossRefMap,
            metadata: {
                total_columns: columns.length,
                survey_questions: Object.values(mapping).filter(m => !m.is_predata).length,
                predata_columns: Object.values(mapping).filter(m => m.is_predata).length,
                cross_reference_count: Object.keys(crossRefMap).length,
                generated_at: new Date().toISOString()
            }
        };
    }
}

// Usage example:
/*
const mapper = new ColumnQuestionMapper();

const sampleColumns = [
    { column_name: 'ip_address', data_type: 'text' },
    { column_name: 'respondent_id', data_type: 'text' },
    { column_name: 'Gender', data_type: 'categorical' },
    { column_name: 'Age Group', data_type: 'categorical' },
    { column_name: 'What factors are most important when purchasing? | Open-Ended', data_type: 'text', is_open_ended: true },
    { column_name: 'Based on your answer to Q3, please explain why | Open-Ended', data_type: 'text', is_open_ended: true, question_text: 'Based on your answer to Q3, please explain why these factors are important to you.' }
];

const result = mapper.exportMappingForDatabase(sampleColumns);
console.log(JSON.stringify(result, null, 2));

// Output will show:
// - ip_address: { qNo: 'preData', is_predata: true }
// - respondent_id: { qNo: 'preData', is_predata: true } 
// - Gender: { qNo: 'Q1', is_predata: false }
// - Age Group: { qNo: 'Q2', is_predata: false }
// - What factors...: { qNo: 'Q3', is_predata: false }
// - Based on Q3...: { qNo: 'Q4', cross_references: ['Q3'] }
*/