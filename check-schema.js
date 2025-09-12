#!/usr/bin/env node
import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkSchema() {
    try {
        await client.connect();
        
        // Check survey_responses table structure
        const result = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'survey_responses'
            AND table_schema = 'public'
            ORDER BY ordinal_position;
        `);
        
        console.log('Survey responses table structure:');
        result.rows.forEach(row => {
            console.log(`- ${row.column_name}: ${row.data_type} (${row.is_nullable})`);
        });
        
        // Check if our schema tables exist
        const tables = await client.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('surveys', 'survey_columns', 'roi_targets', 'feature_importance')
            ORDER BY table_name;
        `);
        
        console.log('\nOur schema tables:');
        tables.rows.forEach(row => {
            console.log(`✓ ${row.table_name}`);
        });
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.end();
    }
}

checkSchema();