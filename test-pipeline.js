import dotenv from 'dotenv';
import { createLogger } from './src/utils/logger.js';
import { getSourceDocumentById } from './src/utils/database.js';

// Load environment variables
dotenv.config();

const logger = createLogger('PipelineTest');

async function testPipeline() {
    console.log('Testing complete data wrangling pipeline...');
    
    try {
        // Test 1: Get document from database
        logger.info('Step 1: Retrieving document from database');
        const documentId = 1;
        const docResult = await getSourceDocumentById(documentId, true);
        
        if (!docResult.success) {
            throw new Error(`Failed to retrieve document: ${docResult.error}`);
        }
        
        logger.info(`Retrieved document: ${docResult.document.name}`);
        logger.info(`File size: ${docResult.document.file_size} bytes`);
        logger.info(`File type: ${docResult.document.file_type}`);
        
        // Test 2: Import and run the data wrangling pipeline
        logger.info('Step 2: Running data wrangling pipeline');
        
        // Import the debug API function directly
        const dataWranglingAPI = await import('./api/debug-data-wrangling.js');
        
        // Create a mock request/response for testing
        const mockReq = {
            method: 'POST',
            body: {
                documentId: documentId,
                step: 'run_complete_pipeline'
            }
        };
        
        const mockRes = {
            status: (code) => {
                mockRes.statusCode = code;
                return mockRes;
            },
            json: (data) => {
                mockRes.responseData = data;
                return mockRes;
            }
        };
        
        // Run the pipeline
        await dataWranglingAPI.default(mockReq, mockRes);
        
        // Check results
        if (mockRes.statusCode === 200) {
            logger.info('Pipeline completed successfully!');
            logger.info('Response data:', JSON.stringify(mockRes.responseData, null, 2));
        } else {
            logger.error('Pipeline failed with status:', mockRes.statusCode);
            logger.error('Error response:', mockRes.responseData);
        }
        
    } catch (error) {
        logger.error('Pipeline test failed:', error);
        throw error;
    }
}

testPipeline()
    .then(() => {
        console.log('Pipeline test completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Pipeline test failed:', error);
        process.exit(1);
    });