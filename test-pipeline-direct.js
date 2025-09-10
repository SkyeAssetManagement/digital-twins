import dotenv from 'dotenv';
import { createLogger } from './src/utils/logger.js';
import { getSourceDocumentById } from './src/utils/database.js';
import { ImprovedDataWrangler } from './src/utils/improvedDataWrangler.js';
import XLSX from 'xlsx';

// Load environment variables
dotenv.config();

const logger = createLogger('PipelineDirectTest');

async function testPipelineDirect() {
    console.log('Testing data wrangling pipeline directly...');
    
    try {
        // Step 1: Get document from database
        logger.info('Step 1: Retrieving document from database');
        const documentId = 1;
        const docResult = await getSourceDocumentById(documentId, true);
        
        if (!docResult.success) {
            throw new Error(`Failed to retrieve document: ${docResult.error}`);
        }
        
        logger.info(`Retrieved document: ${docResult.document.name}`);
        logger.info(`File size: ${docResult.document.file_size} bytes`);
        
        // Step 2: Decode base64 and load Excel
        logger.info('Step 2: Decoding and loading Excel data');
        const fileBuffer = Buffer.from(docResult.document.file_content_base64, 'base64');
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        
        logger.info(`Excel sheets: ${workbook.SheetNames.join(', ')}`);
        
        // Get the first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1, 
            raw: false, 
            defval: '' 
        });
        
        logger.info(`Loaded ${rawData.length} rows of data`);
        logger.info(`First row length: ${rawData[0]?.length || 0} columns`);
        
        // Step 3: Initialize data wrangler
        logger.info('Step 3: Initializing data wrangler');
        const wrangler = new ImprovedDataWrangler(process.env.ANTHROPIC_API_KEY);
        
        // Step 4: Load data into wrangler
        logger.info('Step 4: Loading data into wrangler');
        const loadResult = wrangler.loadExcelData(fileBuffer);
        if (!loadResult.success) {
            throw new Error(`Failed to load data: ${loadResult.error}`);
        }
        logger.info(`Loaded: ${loadResult.rows} rows x ${loadResult.columns} columns`);
        
        // Step 5: Run pipeline steps
        logger.info('Step 5: Running pipeline steps');
        
        // Determine header rows
        logger.info('Step 5a: Determining header rows');
        const headerResult = wrangler.determineHeaderRows();
        logger.info(`Found ${headerResult.headerRowCount} header rows, data starts at row ${headerResult.dataStartRow}`);
        
        // Forward fill headers
        logger.info('Step 5b: Forward filling headers');
        const fillResult = wrangler.forwardFillHeaders();
        logger.info(`Forward filled headers: ${fillResult.filledRows} rows`);
        
        // Show sample of filled headers
        if (wrangler.filledHeaders && wrangler.filledHeaders.length > 0) {
            for (let i = 0; i < Math.min(3, wrangler.filledHeaders.length); i++) {
                const sampleCols = wrangler.filledHeaders[i].slice(0, 5);
                logger.info(`Filled header row ${i}: [${sampleCols.join(', ')}...]`);
            }
        }
        
        // Concatenate headers
        logger.info('Step 5c: Concatenating headers');
        const concatResult = wrangler.concatenateHeaders();
        logger.info(`Concatenated ${concatResult.concatenatedCount} headers`);
        
        // Show sample concatenated headers
        if (wrangler.concatenatedHeaders && wrangler.concatenatedHeaders.length > 0) {
            const sampleHeaders = wrangler.concatenatedHeaders.slice(0, 5);
            for (let i = 0; i < sampleHeaders.length; i++) {
                logger.info(`Concatenated header ${i}: "${sampleHeaders[i].substring(0, 60)}${sampleHeaders[i].length > 60 ? '...' : ''}"`);
            }
        }
        
        logger.info('Pipeline test completed successfully!');
        
        // Return results for verification
        return {
            success: true,
            documentId: documentId,
            headerRowCount: headerResult.headerRowCount,
            columnCount: loadResult.columns,
            dataStartRow: headerResult.dataStartRow,
            filledRowsCount: fillResult.filledRows,
            concatenatedCount: concatResult.concatenatedCount,
            sampleConcatenatedHeaders: wrangler.concatenatedHeaders ? wrangler.concatenatedHeaders.slice(0, 5) : []
        };
        
    } catch (error) {
        logger.error('Pipeline direct test failed:', error);
        throw error;
    }
}

testPipelineDirect()
    .then((results) => {
        console.log('\n=== PIPELINE TEST RESULTS ===');
        console.log(`Success: ${results.success}`);
        console.log(`Document ID: ${results.documentId}`);
        console.log(`Header rows detected: ${results.headerRowCount}`);
        console.log(`Total columns: ${results.columnCount}`);
        console.log(`Data starts at row: ${results.dataStartRow}`);
        console.log(`Filled rows count: ${results.filledRowsCount}`);
        console.log(`Concatenated headers count: ${results.concatenatedCount}`);
        console.log('\nSample concatenated headers:');
        for (let i = 0; i < results.sampleConcatenatedHeaders.length; i++) {
            const header = results.sampleConcatenatedHeaders[i];
            console.log(`  ${i}: "${header.substring(0, 60)}${header.length > 60 ? '...' : ''}"`);
        }
        console.log('\nPipeline test completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Pipeline test failed:', error);
        process.exit(1);
    });