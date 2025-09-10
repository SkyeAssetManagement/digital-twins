import dotenv from 'dotenv';
import pkg from 'pg';
import fs from 'fs/promises';
import path from 'path';

// Load environment variables
dotenv.config();

const { Pool } = pkg;

async function setupDatabase() {
    console.log('Setting up database tables...');
    
    let pool;
    try {
        // Create database pool
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        });

        // Test connection
        const client = await pool.connect();
        console.log('Connected to database successfully');
        
        // Read SQL file
        const sqlPath = path.join(process.cwd(), 'database', 'setup-tables.sql');
        const sql = await fs.readFile(sqlPath, 'utf8');
        
        // Execute SQL
        console.log('Executing SQL script...');
        const result = await client.query(sql);
        
        console.log('Tables created successfully!');
        console.log('Result:', result);
        
        // Verify tables exist
        const tableCheck = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('source_documents', 'survey_data')
            ORDER BY table_name;
        `);
        
        console.log('Existing tables:', tableCheck.rows);
        
        client.release();
        
    } catch (error) {
        console.error('Database setup failed:', error);
        throw error;
    } finally {
        if (pool) {
            await pool.end();
        }
    }
}

setupDatabase()
    .then(() => {
        console.log('Database setup completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Database setup failed:', error);
        process.exit(1);
    });