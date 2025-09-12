/**
 * Simple Database Connection Test
 * Tests basic connectivity with detailed logging
 */

import dotenv from 'dotenv';
dotenv.config();

import pkg from 'pg';
const { Pool } = pkg;

console.log('🧪 SIMPLE DATABASE CONNECTION TEST');
console.log('='.repeat(50));

// Test environment variables first
console.log('\n📋 Environment Variables:');
console.log(`DATABASE_URL exists: ${!!process.env.DATABASE_URL}`);
if (process.env.DATABASE_URL) {
    console.log(`DATABASE_URL preview: ${process.env.DATABASE_URL.substring(0, 25)}...`);
}

// Test database connection with extended timeouts
console.log('\n🔌 Testing Database Connection...');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000, // 30 seconds
    acquireTimeoutMillis: 60000,    // 60 seconds
    createTimeoutMillis: 30000,     // 30 seconds
});

// Add event listeners for debugging
pool.on('connect', () => {
    console.log('✅ Pool connected to database');
});

pool.on('error', (err) => {
    console.log(`❌ Pool error: ${err.message}`);
});

pool.on('acquire', () => {
    console.log('📥 Client acquired from pool');
});

pool.on('release', () => {
    console.log('📤 Client released back to pool');
});

async function testConnection() {
    let client = null;
    
    try {
        console.log('⏳ Attempting to acquire client from pool...');
        const startTime = Date.now();
        
        client = await pool.connect();
        const connectTime = Date.now() - startTime;
        
        console.log(`✅ Connected successfully in ${connectTime}ms`);
        
        // Test a simple query
        console.log('⏳ Executing test query...');
        const queryStart = Date.now();
        
        const result = await client.query('SELECT NOW() as current_time, version() as db_version');
        const queryTime = Date.now() - queryStart;
        
        console.log(`✅ Query executed in ${queryTime}ms`);
        console.log(`📅 Database time: ${result.rows[0].current_time}`);
        console.log(`🗄️ Database version: ${result.rows[0].db_version.substring(0, 50)}...`);
        
        return true;
        
    } catch (error) {
        console.log(`❌ Connection failed: ${error.message}`);
        console.log(`📋 Error code: ${error.code || 'N/A'}`);
        console.log(`📋 Error name: ${error.name}`);
        
        if (error.stack) {
            console.log(`📋 Stack trace: ${error.stack.split('\n')[0]}`);
        }
        
        return false;
        
    } finally {
        if (client) {
            console.log('🔄 Releasing client...');
            client.release();
        }
    }
}

// Run test with timeout
const TEST_TIMEOUT = 90000; // 90 seconds

console.log(`⏱️ Test timeout set to ${TEST_TIMEOUT/1000} seconds`);

const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Test timeout reached')), TEST_TIMEOUT);
});

Promise.race([testConnection(), timeoutPromise])
    .then(success => {
        if (success) {
            console.log('\n🎉 DATABASE CONNECTION TEST PASSED!');
        } else {
            console.log('\n💥 DATABASE CONNECTION TEST FAILED!');
        }
    })
    .catch(error => {
        console.log(`\n⏰ TEST ERROR: ${error.message}`);
    })
    .finally(async () => {
        console.log('\n🧹 Cleaning up...');
        try {
            await pool.end();
            console.log('✅ Pool closed');
        } catch (error) {
            console.log(`❌ Pool cleanup error: ${error.message}`);
        }
        console.log('🏁 Test completed');
        process.exit(0);
    });