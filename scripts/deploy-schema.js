#!/usr/bin/env node
/**
 * Deploy Database Schema to Supabase PostgreSQL
 * This script deploys the comprehensive survey schema to our Supabase database
 */

import { readFileSync } from 'fs';
import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function deploySchema() {
    console.log('🚀 Deploying Digital Twins Database Schema to Supabase...');
    
    if (!process.env.DATABASE_URL) {
        console.error('❌ DATABASE_URL not found in environment variables');
        process.exit(1);
    }
    
    console.log('📝 Environment Check:');
    console.log(`   Database URL: ${process.env.DATABASE_URL.substring(0, 30)}...`);
    console.log(`   Anthropic API: ${process.env.ANTHROPIC_API_KEY ? 'configured' : 'missing'}`);
    
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false // Required for Supabase
        }
    });
    
    try {
        console.log('🔌 Connecting to Supabase PostgreSQL...');
        await client.connect();
        console.log('✅ Connected successfully!');
        
        // Read the schema file
        const schemaPath = path.join(__dirname, '..', 'database', 'comprehensive-survey-schema.sql');
        console.log(`📂 Reading schema from: ${schemaPath}`);
        
        const schemaSQL = readFileSync(schemaPath, 'utf8');
        console.log(`📊 Schema size: ${Math.round(schemaSQL.length / 1024)}KB`);
        
        // Execute the schema
        console.log('⚙️ Deploying schema...');
        await client.query(schemaSQL);
        console.log('✅ Schema deployed successfully!');
        
        // Verify deployment by checking tables
        console.log('🔍 Verifying deployment...');
        const result = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        `);
        
        console.log('📋 Tables created:');
        result.rows.forEach(row => {
            console.log(`   ✓ ${row.table_name}`);
        });
        
        // Check views
        const viewsResult = await client.query(`
            SELECT table_name 
            FROM information_schema.views 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        `);
        
        console.log('📊 Views created:');
        viewsResult.rows.forEach(row => {
            console.log(`   ✓ ${row.table_name}`);
        });
        
        // Insert a test survey to verify functionality
        console.log('🧪 Creating test survey record...');
        await client.query(`
            INSERT INTO surveys (name, display_name, target_demographic, business_description, status) 
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (name) DO UPDATE SET
                display_name = EXCLUDED.display_name,
                updated_at = CURRENT_TIMESTAMP;
        `, [
            'test_deployment',
            'Schema Deployment Test',
            'Test demographic',
            'Schema deployment verification',
            'active'
        ]);
        
        const testResult = await client.query('SELECT * FROM surveys WHERE name = $1', ['test_deployment']);
        console.log(`✅ Test survey created with ID: ${testResult.rows[0].id}`);
        
        console.log('');
        console.log('🎉 Database schema deployment completed successfully!');
        console.log('🔗 Database is ready for Digital Twins Analysis Pipeline');
        console.log('');
        console.log('Next steps:');
        console.log('  1. Restart the server to load environment variables');
        console.log('  2. Test Phase 3A-3E APIs with real data');
        console.log('  3. Generate comprehensive MDA analysis report');
        
    } catch (error) {
        console.error('❌ Schema deployment failed:', error.message);
        console.error('Full error:', error);
        process.exit(1);
    } finally {
        await client.end();
        console.log('🔌 Database connection closed');
    }
}

deploySchema().catch(console.error);