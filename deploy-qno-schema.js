#!/usr/bin/env node
/**
 * Deploy qNo metadata schema update
 * Adds question numbering and cross-reference capabilities
 */

import fs from 'fs';
import path from 'path';
import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
import { ColumnQuestionMapper } from './src/utils/column-question-mapper.js';

dotenv.config();

console.log('🚀 Deploying qNo metadata schema...');

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        await client.connect();
        console.log('✅ Connected to database');
        
        // Deploy schema updates
        console.log('📝 Deploying qNo schema updates...');
        const schemaSQL = fs.readFileSync('database/add-qno-metadata.sql', 'utf8');
        await client.query(schemaSQL);
        console.log('✅ Schema updates deployed');
        
        // Test with sample column mapping
        console.log('🧪 Testing column question mapper...');
        const mapper = new ColumnQuestionMapper();
        
        const sampleColumns = [
            { column_name: 'ip_address', data_type: 'text' },
            { column_name: 'respondent_id', data_type: 'text' },
            { column_name: 'submission_timestamp', data_type: 'timestamp' },
            { column_name: 'Gender', data_type: 'categorical' },
            { column_name: 'Age Group', data_type: 'categorical' },
            { column_name: 'What factors are most important when purchasing baby products? | Open-Ended Response', data_type: 'text' },
            { column_name: 'Based on your answer to Q3, please explain why | Open-Ended Response', data_type: 'text', question_text: 'Based on your answer to Q3, please explain why these factors are important to you.' },
            { column_name: 'If you selected "Other" in Q1, please specify | Open-Ended Response', data_type: 'text', question_text: 'If you selected "Other" in Q1, please specify what other factors are important.' },
            { column_name: 'Monthly spending on baby products', data_type: 'numeric' },
            { column_name: 'Referring back to Q4, how has this changed over time?', data_type: 'text', question_text: 'Referring back to Q4 (Age Group), how has your purchasing behavior changed over time?' }
        ];
        
        const mapping = mapper.exportMappingForDatabase(sampleColumns);
        
        console.log('\n📊 Generated Column Mapping:');
        console.log('='.repeat(50));
        Object.entries(mapping.column_mappings).forEach(([col, info]) => {
            console.log(`${info.qNo.padEnd(8)} | ${col}`);
            if (info.metadata.cross_reference_enabled && mapping.cross_references[info.qNo]) {
                console.log(`         └─ References: ${mapping.cross_references[info.qNo].references.join(', ')}`);
            }
        });
        
        console.log('\n🔗 Cross-References Detected:');
        console.log('='.repeat(50));
        Object.entries(mapping.cross_references).forEach(([qNo, refData]) => {
            console.log(`${qNo} → References: [${refData.references.join(', ')}]`);
            console.log(`    Column: ${refData.column_name}`);
            console.log(`    Text: "${refData.question_text.substring(0, 80)}..."`);
            console.log('');
        });
        
        console.log('\n📈 Summary Statistics:');
        console.log(`Total Columns: ${mapping.metadata.total_columns}`);
        console.log(`Survey Questions: ${mapping.metadata.survey_questions}`);
        console.log(`PreData Columns: ${mapping.metadata.predata_columns}`);
        console.log(`Cross-References: ${mapping.metadata.cross_reference_count}`);
        
        // Test database functions
        console.log('\n🔍 Testing database functions...');
        
        // Test the mapping function (will return empty for non-existent survey)
        const testResult = await client.query('SELECT * FROM get_survey_question_mapping(999) LIMIT 5');
        console.log(`✅ get_survey_question_mapping function works (${testResult.rows.length} rows for test)`);
        
        // Test cross-reference detection function
        const crossRefResult = await client.query('SELECT * FROM detect_question_cross_references(999) LIMIT 5');
        console.log(`✅ detect_question_cross_references function works (${crossRefResult.rows.length} references for test)`);
        
        console.log('\n🎉 qNo metadata schema deployment complete!');
        console.log('\nNext steps:');
        console.log('1. Use ColumnQuestionMapper in Phase 3A to assign qNo values');
        console.log('2. Store cross-reference data during column analysis');
        console.log('3. Query cross-references for advanced survey logic');
        
        return mapping;
        
    } catch (error) {
        console.error('❌ Deployment failed:', error.message);
        throw error;
    } finally {
        await client.end();
    }
}

main().catch(console.error);