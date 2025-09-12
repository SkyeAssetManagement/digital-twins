/**
 * Micro-step Database Connection Debugger
 * Comprehensive debugging for database connectivity issues
 */

import { createLogger } from '../src/utils/logger.js';
import { initializeDatabase, getSourceDocumentById, closeDatabase } from '../src/utils/database.js';

const logger = createLogger('DatabaseDebugger');

class DatabaseConnectionDebugger {
    constructor() {
        this.testResults = [];
        this.connectionMetrics = {
            attempts: 0,
            successes: 0,
            failures: 0,
            avgConnectionTime: 0,
            maxConnectionTime: 0,
            minConnectionTime: Infinity
        };
    }

    async runComprehensiveDebugging() {
        console.log('🔍 DATABASE CONNECTION DEBUGGER - COMPREHENSIVE ANALYSIS');
        console.log('='.repeat(70));

        await this.testStep1_EnvironmentVariables();
        await this.testStep2_DatabaseInitialization();
        await this.testStep3_ConnectionPoolHealth();
        await this.testStep4_QueryExecution();
        await this.testStep5_DocumentRetrieval();
        await this.testStep6_LoadTesting();
        
        this.generateDiagnosticReport();
    }

    async testStep1_EnvironmentVariables() {
        console.log('\n📋 STEP 1: Environment Variables Analysis');
        console.log('-'.repeat(50));
        
        const env = process.env;
        const dbVars = ['DATABASE_URL', 'DB_HOST', 'DB_USER', 'DB_PASS', 'DB_NAME', 'DB_PORT'];
        
        dbVars.forEach(varName => {
            if (env[varName]) {
                const value = varName.includes('PASS') ? '***HIDDEN***' : env[varName];
                console.log(`✅ ${varName}: ${value.substring(0, 30)}...`);
            } else {
                console.log(`❌ ${varName}: NOT SET`);
            }
        });
    }

    async testStep2_DatabaseInitialization() {
        console.log('\n🏗️ STEP 2: Database Pool Initialization');
        console.log('-'.repeat(50));
        
        try {
            const startTime = Date.now();
            console.log('⏳ Attempting database initialization...');
            
            const pool = await initializeDatabase();
            const initTime = Date.now() - startTime;
            
            console.log(`✅ Database pool initialized successfully in ${initTime}ms`);
            console.log(`📊 Pool status: ${pool ? 'Active' : 'Null'}`);
            
            this.testResults.push({
                step: 'initialization',
                success: true,
                time: initTime,
                details: 'Pool created successfully'
            });
            
        } catch (error) {
            console.log(`❌ Database initialization failed: ${error.message}`);
            this.testResults.push({
                step: 'initialization',
                success: false,
                error: error.message,
                details: 'Pool creation failed'
            });
        }
    }

    async testStep3_ConnectionPoolHealth() {
        console.log('\n🏊 STEP 3: Connection Pool Health Check');
        console.log('-'.repeat(50));
        
        try {
            const pool = await initializeDatabase();
            
            if (!pool) {
                throw new Error('Pool is null');
            }
            
            console.log(`📊 Pool Configuration:`);
            console.log(`   Max Connections: ${pool.options?.max || 'unknown'}`);
            console.log(`   Connection Timeout: ${pool.options?.connectionTimeoutMillis || 'unknown'}ms`);
            console.log(`   Acquire Timeout: ${pool.options?.acquireTimeoutMillis || 'unknown'}ms`);
            console.log(`   Idle Timeout: ${pool.options?.idleTimeoutMillis || 'unknown'}ms`);
            
            // Test basic pool connectivity
            const startTime = Date.now();
            const client = await pool.connect();
            const connectTime = Date.now() - startTime;
            
            console.log(`✅ Successfully acquired connection from pool in ${connectTime}ms`);
            
            client.release();
            console.log(`✅ Connection released back to pool`);
            
            this.connectionMetrics.attempts++;
            this.connectionMetrics.successes++;
            this.updateConnectionTiming(connectTime);
            
        } catch (error) {
            console.log(`❌ Pool health check failed: ${error.message}`);
            console.log(`📋 Error type: ${error.constructor.name}`);
            console.log(`📋 Error code: ${error.code || 'N/A'}`);
            
            this.connectionMetrics.attempts++;
            this.connectionMetrics.failures++;
        }
    }

    async testStep4_QueryExecution() {
        console.log('\n🗃️ STEP 4: Query Execution Test');
        console.log('-'.repeat(50));
        
        try {
            const pool = await initializeDatabase();
            const client = await pool.connect();
            
            console.log('⏳ Testing basic query execution...');
            const startTime = Date.now();
            
            const result = await client.query('SELECT NOW() as current_time');
            const queryTime = Date.now() - startTime;
            
            console.log(`✅ Query executed successfully in ${queryTime}ms`);
            console.log(`📅 Database time: ${result.rows[0]?.current_time}`);
            
            client.release();
            
            this.testResults.push({
                step: 'query_execution',
                success: true,
                time: queryTime,
                details: 'Basic SELECT query successful'
            });
            
        } catch (error) {
            console.log(`❌ Query execution failed: ${error.message}`);
            this.testResults.push({
                step: 'query_execution',
                success: false,
                error: error.message
            });
        }
    }

    async testStep5_DocumentRetrieval() {
        console.log('\n📄 STEP 5: Document Retrieval Test (Real Use Case)');
        console.log('-'.repeat(50));
        
        const testDocumentIds = [1, 1001, 1002];
        
        for (const docId of testDocumentIds) {
            console.log(`\n🔍 Testing document ID: ${docId}`);
            
            try {
                const startTime = Date.now();
                const result = await getSourceDocumentById(docId);
                const retrievalTime = Date.now() - startTime;
                
                console.log(`⏱️ Retrieval time: ${retrievalTime}ms`);
                console.log(`📊 Result success: ${result?.success}`);
                
                if (result?.success && result?.document) {
                    const doc = result.document;
                    console.log(`✅ Document found:`);
                    console.log(`   ID: ${doc.id}`);
                    console.log(`   Name: ${doc.name || 'N/A'}`);
                    console.log(`   Status: ${doc.processing_status || 'N/A'}`);
                    console.log(`   Has wrangling_report: ${!!doc.wrangling_report}`);
                    
                    if (doc.wrangling_report) {
                        try {
                            const report = typeof doc.wrangling_report === 'string' 
                                ? JSON.parse(doc.wrangling_report) 
                                : doc.wrangling_report;
                            console.log(`   Report columns: ${report.totalColumns || 'N/A'}`);
                            console.log(`   Pipeline completed: ${report.pipelineCompleted || false}`);
                        } catch (parseError) {
                            console.log(`   Report parse error: ${parseError.message}`);
                        }
                    }
                } else {
                    console.log(`❌ Document not found or retrieval failed`);
                    if (result?.error) {
                        console.log(`   Error: ${result.error}`);
                    }
                }
                
                this.testResults.push({
                    step: `document_retrieval_${docId}`,
                    success: result?.success || false,
                    time: retrievalTime,
                    details: result?.success ? 'Document retrieved' : (result?.error || 'Unknown error')
                });
                
            } catch (error) {
                console.log(`❌ Document ${docId} retrieval failed: ${error.message}`);
                console.log(`   Error type: ${error.constructor.name}`);
                
                this.testResults.push({
                    step: `document_retrieval_${docId}`,
                    success: false,
                    error: error.message
                });
            }
        }
    }

    async testStep6_LoadTesting() {
        console.log('\n⚡ STEP 6: Connection Load Testing');
        console.log('-'.repeat(50));
        
        const concurrent = 3;
        const iterations = 2;
        
        console.log(`🧪 Running ${concurrent} concurrent connections × ${iterations} iterations`);
        
        for (let i = 0; i < iterations; i++) {
            console.log(`\n🔄 Iteration ${i + 1}:`);
            
            const promises = Array(concurrent).fill().map(async (_, index) => {
                const startTime = Date.now();
                try {
                    const pool = await initializeDatabase();
                    const client = await pool.connect();
                    
                    // Simulate actual usage with a query
                    await client.query('SELECT 1 as test');
                    client.release();
                    
                    const duration = Date.now() - startTime;
                    console.log(`   ✅ Connection ${index + 1}: ${duration}ms`);
                    
                    this.connectionMetrics.attempts++;
                    this.connectionMetrics.successes++;
                    this.updateConnectionTiming(duration);
                    
                    return { success: true, duration };
                } catch (error) {
                    const duration = Date.now() - startTime;
                    console.log(`   ❌ Connection ${index + 1}: Failed after ${duration}ms - ${error.message}`);
                    
                    this.connectionMetrics.attempts++;
                    this.connectionMetrics.failures++;
                    
                    return { success: false, duration, error: error.message };
                }
            });
            
            await Promise.all(promises);
            
            // Brief pause between iterations
            if (i < iterations - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    updateConnectionTiming(duration) {
        if (duration > this.connectionMetrics.maxConnectionTime) {
            this.connectionMetrics.maxConnectionTime = duration;
        }
        if (duration < this.connectionMetrics.minConnectionTime) {
            this.connectionMetrics.minConnectionTime = duration;
        }
        
        const totalTime = this.connectionMetrics.avgConnectionTime * this.connectionMetrics.successes + duration;
        this.connectionMetrics.avgConnectionTime = totalTime / (this.connectionMetrics.successes + 1);
    }

    generateDiagnosticReport() {
        console.log('\n📊 COMPREHENSIVE DIAGNOSTIC REPORT');
        console.log('='.repeat(70));
        
        console.log('\n🎯 CONNECTION METRICS:');
        console.log(`   Total Attempts: ${this.connectionMetrics.attempts}`);
        console.log(`   Successes: ${this.connectionMetrics.successes}`);
        console.log(`   Failures: ${this.connectionMetrics.failures}`);
        console.log(`   Success Rate: ${((this.connectionMetrics.successes / this.connectionMetrics.attempts) * 100).toFixed(1)}%`);
        
        if (this.connectionMetrics.successes > 0) {
            console.log(`   Avg Connection Time: ${this.connectionMetrics.avgConnectionTime.toFixed(0)}ms`);
            console.log(`   Min Connection Time: ${this.connectionMetrics.minConnectionTime}ms`);
            console.log(`   Max Connection Time: ${this.connectionMetrics.maxConnectionTime}ms`);
        }
        
        console.log('\n📋 DETAILED TEST RESULTS:');
        this.testResults.forEach(test => {
            const status = test.success ? '✅' : '❌';
            const time = test.time ? ` (${test.time}ms)` : '';
            const details = test.details || test.error || '';
            console.log(`   ${status} ${test.step}${time}: ${details}`);
        });
        
        console.log('\n🔧 RECOMMENDATIONS:');
        if (this.connectionMetrics.failures > 0) {
            console.log('   ⚠️  Connection failures detected - check network connectivity');
            console.log('   ⚠️  Consider increasing timeout values further if still experiencing issues');
        }
        if (this.connectionMetrics.maxConnectionTime > 10000) {
            console.log('   ⚠️  High connection latency detected - check database server performance');
        }
        if (this.connectionMetrics.successes === 0) {
            console.log('   🚨 No successful connections - verify database credentials and availability');
        }
        if (this.connectionMetrics.successes > 0) {
            console.log('   ✅ Database connectivity is functional');
        }
    }
}

// Run the comprehensive debugging
async function main() {
    const dbDebugger = new DatabaseConnectionDebugger();
    
    try {
        await dbDebugger.runComprehensiveDebugging();
    } catch (error) {
        console.log(`\n💥 DEBUGGER ERROR: ${error.message}`);
        console.log(error.stack);
    } finally {
        // Clean up
        await closeDatabase();
        console.log('\n🏁 Database debugging completed');
    }
}

// Auto-run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export { DatabaseConnectionDebugger };