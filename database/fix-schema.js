import dotenv from 'dotenv';
import pkg from 'pg';
import fs from 'fs/promises';
import path from 'path';

// Load environment variables
dotenv.config();

const { Pool } = pkg;

async function fixSchema() {
    console.log('Fixing database schema...');
    
    let pool;
    try {
        // Create database pool
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        });

        const client = await pool.connect();
        console.log('Connected to database successfully');
        
        // Read SQL file
        const sqlPath = path.join(process.cwd(), 'database', 'fix-schema.sql');
        const sql = await fs.readFile(sqlPath, 'utf8');
        
        // Execute SQL
        console.log('Executing schema fix...');
        await client.query(sql);
        
        console.log('Schema fixed successfully!');
        
        client.release();
        
    } catch (error) {
        console.error('Schema fix failed:', error);
        throw error;
    } finally {
        if (pool) {
            await pool.end();
        }
    }
}

fixSchema()
    .then(() => {
        console.log('Schema fix completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Schema fix failed:', error);
        process.exit(1);
    });