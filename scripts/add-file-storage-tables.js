#!/usr/bin/env node

import pkg from 'pg';
const { Client } = pkg;
import yaml from 'yaml';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function addFileStorageTables() {
    console.log('Adding file storage tables for survey documents and data...');

    try {
        // Load database config
        const configPath = path.join(process.cwd(), 'dbConfig.yaml');
        const configFile = await fs.readFile(configPath, 'utf8');
        const dbConfig = yaml.parse(configFile);

        // Create database connection
        const client = new Client({
            host: dbConfig.host,
            port: dbConfig.port,
            database: dbConfig.database,
            user: dbConfig.user,
            password: dbConfig.password,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });

        await client.connect();
        console.log('Connected to Supabase PostgreSQL database');

        // Table 1: Source Documents - stores original files as base64
        const createSourceDocumentsTable = `
            CREATE TABLE IF NOT EXISTS source_documents (
                id SERIAL PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                original_filename VARCHAR(255) NOT NULL,
                file_type VARCHAR(10) NOT NULL,
                file_size INTEGER,
                file_content_base64 TEXT NOT NULL,
                upload_timestamp TIMESTAMP DEFAULT NOW(),
                processing_status VARCHAR(50) DEFAULT 'pending',
                target_demographic VARCHAR(200),
                description TEXT,
                wrangling_report JSONB,
                error_message TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `;

        // Table 2: Survey Data - stores processed survey data in generic format
        const createSurveyDataTable = `
            CREATE TABLE IF NOT EXISTS survey_data (
                id SERIAL PRIMARY KEY,
                source_document_id INTEGER REFERENCES source_documents(id) ON DELETE CASCADE,
                question_id VARCHAR(100) NOT NULL,
                question_text TEXT NOT NULL,
                question_category VARCHAR(100),
                question_type VARCHAR(50) DEFAULT 'text',
                question_order INTEGER,
                respondent_id VARCHAR(100) NOT NULL,
                response_value TEXT,
                response_normalized FLOAT,
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT NOW(),
                
                -- Composite primary key to handle multiple responses per question per respondent
                CONSTRAINT unique_response UNIQUE (source_document_id, question_id, respondent_id)
            );
        `;

        // Execute table creation
        console.log('Creating source_documents table...');
        await client.query(createSourceDocumentsTable);

        console.log('Creating survey_data table...');
        await client.query(createSurveyDataTable);

        // Create indexes for performance
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_source_documents_status ON source_documents(processing_status);',
            'CREATE INDEX IF NOT EXISTS idx_source_documents_created ON source_documents(created_at);',
            'CREATE INDEX IF NOT EXISTS idx_survey_data_source_doc ON survey_data(source_document_id);',
            'CREATE INDEX IF NOT EXISTS idx_survey_data_question ON survey_data(question_id);',
            'CREATE INDEX IF NOT EXISTS idx_survey_data_respondent ON survey_data(respondent_id);',
            'CREATE INDEX IF NOT EXISTS idx_survey_data_category ON survey_data(question_category);'
        ];

        console.log('Creating performance indexes...');
        for (const indexQuery of indexes) {
            await client.query(indexQuery);
        }

        // Create trigger for updated_at timestamp
        const createUpdateTrigger = `
            DROP TRIGGER IF EXISTS update_source_documents_updated_at ON source_documents;
            CREATE TRIGGER update_source_documents_updated_at
                BEFORE UPDATE ON source_documents
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column();
        `;

        console.log('Creating update triggers...');
        await client.query(createUpdateTrigger);

        // Verify tables were created
        const tableCheck = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('source_documents', 'survey_data')
            ORDER BY table_name;
        `);

        console.log('\nCreated file storage tables:');
        tableCheck.rows.forEach(row => {
            console.log(`✓ ${row.table_name}`);
        });

        await client.end();
        console.log('\n✅ File storage tables setup completed successfully!');
        console.log('Ready to store source documents and processed survey data');

    } catch (error) {
        console.error('❌ File storage tables setup failed:', error);
        console.error('Error details:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    addFileStorageTables();
}

export default addFileStorageTables;