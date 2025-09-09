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

async function setupUniversalDatabase() {
    console.log('Setting up Universal Survey Database Schema...');

    try {
        // Load database config from dbconfig.yaml
        const configPath = path.join(process.cwd(), 'dbconfig.yaml');
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

        // Create universal survey schema
        const createSurveyDatasetsTable = `
            CREATE TABLE IF NOT EXISTS survey_datasets (
                id SERIAL PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                target_demographic VARCHAR(100) NOT NULL,
                description TEXT,
                file_path TEXT,
                total_questions INTEGER DEFAULT 0,
                total_responses INTEGER DEFAULT 0,
                processing_status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `;

        const createSurveyQuestionsTable = `
            CREATE TABLE IF NOT EXISTS survey_questions (
                id SERIAL PRIMARY KEY,
                dataset_id INTEGER REFERENCES survey_datasets(id) ON DELETE CASCADE,
                original_headers TEXT[],
                concatenated_question TEXT NOT NULL,
                category VARCHAR(100),
                importance_score FLOAT DEFAULT 0,
                predictive_power FLOAT DEFAULT 0,
                question_order INTEGER,
                behavioral_insight TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `;

        const createSurveyArchetypesTable = `
            CREATE TABLE IF NOT EXISTS survey_archetypes (
                id SERIAL PRIMARY KEY,
                dataset_id INTEGER REFERENCES survey_datasets(id) ON DELETE CASCADE,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                characteristics JSONB DEFAULT '{}',
                spending_propensity FLOAT DEFAULT 0,
                behavioral_patterns JSONB DEFAULT '{}',
                motivators JSONB DEFAULT '{}',
                pain_points JSONB DEFAULT '{}',
                communication_preferences JSONB DEFAULT '{}',
                population_percentage FLOAT DEFAULT 0,
                reference_frameworks JSONB DEFAULT '{}',
                claude_prompt TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `;

        const createSurveyResponsesTable = `
            CREATE TABLE IF NOT EXISTS survey_responses (
                id SERIAL PRIMARY KEY,
                dataset_id INTEGER REFERENCES survey_datasets(id) ON DELETE CASCADE,
                respondent_id VARCHAR(50) NOT NULL,
                question_id INTEGER REFERENCES survey_questions(id) ON DELETE CASCADE,
                response_value TEXT,
                normalized_score FLOAT,
                archetype_id INTEGER REFERENCES survey_archetypes(id) ON DELETE SET NULL,
                confidence_score FLOAT DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `;

        const createDigitalTwinPersonasTable = `
            CREATE TABLE IF NOT EXISTS digital_twin_personas (
                id SERIAL PRIMARY KEY,
                archetype_id INTEGER REFERENCES survey_archetypes(id) ON DELETE CASCADE,
                persona_profile JSONB DEFAULT '{}',
                claude_prompt TEXT NOT NULL,
                response_style JSONB DEFAULT '{}',
                demographic_context TEXT,
                model_version VARCHAR(50) DEFAULT 'claude-opus-4-1-20250805',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `;

        const createQuestionCategoriesTable = `
            CREATE TABLE IF NOT EXISTS question_categories (
                id SERIAL PRIMARY KEY,
                dataset_id INTEGER REFERENCES survey_datasets(id) ON DELETE CASCADE,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                behavioral_significance TEXT,
                category_order INTEGER,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `;

        // Execute table creation
        console.log('Creating survey_datasets table...');
        await client.query(createSurveyDatasetsTable);

        console.log('Creating survey_questions table...');
        await client.query(createSurveyQuestionsTable);

        console.log('Creating survey_archetypes table...');
        await client.query(createSurveyArchetypesTable);

        console.log('Creating survey_responses table...');
        await client.query(createSurveyResponsesTable);

        console.log('Creating digital_twin_personas table...');
        await client.query(createDigitalTwinPersonasTable);

        console.log('Creating question_categories table...');
        await client.query(createQuestionCategoriesTable);

        // Create indexes for performance
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_survey_questions_dataset ON survey_questions(dataset_id);',
            'CREATE INDEX IF NOT EXISTS idx_survey_archetypes_dataset ON survey_archetypes(dataset_id);',
            'CREATE INDEX IF NOT EXISTS idx_survey_responses_dataset ON survey_responses(dataset_id);',
            'CREATE INDEX IF NOT EXISTS idx_survey_responses_respondent ON survey_responses(respondent_id);',
            'CREATE INDEX IF NOT EXISTS idx_survey_responses_archetype ON survey_responses(archetype_id);',
            'CREATE INDEX IF NOT EXISTS idx_digital_twin_personas_archetype ON digital_twin_personas(archetype_id);'
        ];

        console.log('Creating performance indexes...');
        for (const indexQuery of indexes) {
            await client.query(indexQuery);
        }

        // Create trigger for updated_at timestamp
        const createUpdateTrigger = `
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = NOW();
                RETURN NEW;
            END;
            $$ language 'plpgsql';

            DROP TRIGGER IF EXISTS update_survey_datasets_updated_at ON survey_datasets;
            CREATE TRIGGER update_survey_datasets_updated_at
                BEFORE UPDATE ON survey_datasets
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column();

            DROP TRIGGER IF EXISTS update_digital_twin_personas_updated_at ON digital_twin_personas;
            CREATE TRIGGER update_digital_twin_personas_updated_at
                BEFORE UPDATE ON digital_twin_personas
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
            AND table_name IN ('survey_datasets', 'survey_questions', 'survey_archetypes', 'survey_responses', 'digital_twin_personas', 'question_categories')
            ORDER BY table_name;
        `);

        console.log('\nCreated tables:');
        tableCheck.rows.forEach(row => {
            console.log(`✓ ${row.table_name}`);
        });

        await client.end();
        console.log('\n✅ Universal Survey Database setup completed successfully!');
        console.log('Ready for Phase 1: Data Foundation implementation');

    } catch (error) {
        console.error('❌ Database setup failed:', error);
        console.error('Error details:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    setupUniversalDatabase();
}

export default setupUniversalDatabase;