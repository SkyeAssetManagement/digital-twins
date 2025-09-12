/**
 * Test script to verify three-stage analysis can access real wrangling_report data
 */

const { getSourceDocumentById } = await import('../src/utils/database.js');

async function testDataConnection() {
    console.log('🧪 Testing Three-Stage Analysis Data Connection');
    console.log('================================================');
    
    try {
        // Test document ID 1 (should have wrangling_report from 7-step pipeline)
        const documentId = 1;
        
        console.log(`\n📋 Testing document ID: ${documentId}`);
        
        const docResult = await getSourceDocumentById(documentId, false);
        
        if (!docResult.success) {
            console.log(`❌ Failed to retrieve document: ${docResult.error}`);
            return;
        }
        
        const document = docResult.document;
        
        console.log(`📄 Document Name: ${document.name}`);
        console.log(`📊 Processing Status: ${document.processing_status}`);
        console.log(`⏰ Updated At: ${document.updated_at}`);
        
        // Check wrangling_report
        console.log(`\n🔍 Wrangling Report Status:`);
        console.log(`   Report exists: ${!!document.wrangling_report}`);
        
        if (document.wrangling_report) {
            try {
                const report = typeof document.wrangling_report === 'string' 
                    ? JSON.parse(document.wrangling_report) 
                    : document.wrangling_report;
                
                console.log(`   ✅ Report parsed successfully`);
                console.log(`   📊 Total Columns: ${report.totalColumns || 'N/A'}`);
                console.log(`   🏗️ Pipeline Completed: ${report.pipelineCompleted || 'N/A'}`);
                console.log(`   📝 Column Mappings: ${Object.keys(report.columnMapping || {}).length} mappings`);
                console.log(`   🕒 Processed At: ${report.processedAt || 'N/A'}`);
                
                // Show first few column mappings as sample
                if (report.columnMapping && Object.keys(report.columnMapping).length > 0) {
                    console.log(`\n📋 Sample Column Mappings (first 5):`);
                    const mappingKeys = Object.keys(report.columnMapping).slice(0, 5);
                    mappingKeys.forEach(key => {
                        console.log(`   "${key}" -> "${report.columnMapping[key]}"`);
                    });
                }
                
                return {
                    success: true,
                    hasValidData: true,
                    totalColumns: report.totalColumns,
                    columnMappings: Object.keys(report.columnMapping || {}).length
                };
                
            } catch (parseError) {
                console.log(`❌ Failed to parse wrangling_report: ${parseError.message}`);
                console.log(`   Raw report type: ${typeof document.wrangling_report}`);
                console.log(`   Raw report preview: ${JSON.stringify(document.wrangling_report).substring(0, 200)}...`);
                
                return {
                    success: false,
                    error: `JSON parse error: ${parseError.message}`
                };
            }
        } else {
            console.log(`   ❌ No wrangling_report found`);
            console.log(`   📝 This means the 7-step pipeline hasn't saved results properly`);
            
            return {
                success: false,
                error: 'No wrangling_report found in database'
            };
        }
        
    } catch (error) {
        console.log(`❌ Database connection error: ${error.message}`);
        return {
            success: false,
            error: `Database error: ${error.message}`
        };
    }
}

// Run the test
const result = await testDataConnection();

console.log(`\n🏁 Test Result: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
if (result.error) {
    console.log(`Error: ${result.error}`);
}
if (result.hasValidData) {
    console.log(`✅ Three-stage analysis can access real ${result.totalColumns}-column data`);
    console.log(`✅ Found ${result.columnMappings} column mappings from wrangling pipeline`);
}