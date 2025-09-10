import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { storeSourceDocument } from '../src/utils/database.js';

// Load environment variables
dotenv.config();

async function insertTestData() {
    console.log('Inserting test Excel file into database...');
    
    try {
        // Read the Excel file and convert to base64
        const excelPath = path.join(process.cwd(), 'data', 'datasets', 'mums', 'Detail_Parents Survey.xlsx');
        
        // Check if file exists
        try {
            await fs.access(excelPath);
        } catch (error) {
            console.error(`Excel file not found at: ${excelPath}`);
            console.log('Available files in mums directory:');
            const mumsDir = path.join(process.cwd(), 'data', 'datasets', 'mums');
            try {
                const files = await fs.readdir(mumsDir);
                console.log(files);
            } catch (e) {
                console.log('Directory not found or empty');
            }
            return;
        }
        
        const fileBuffer = await fs.readFile(excelPath);
        const fileStats = await fs.stat(excelPath);
        const fileContentBase64 = fileBuffer.toString('base64');
        
        // Prepare document data
        const documentData = {
            name: 'Detail Parents Survey - Test Data',
            originalFilename: 'Detail_Parents Survey.xlsx',
            fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            fileSize: fileStats.size,
            fileContentBase64: fileContentBase64,
            targetDemographic: 'Mothers with young children',
            description: 'Survey data from mothers regarding purchasing behaviors and preferences'
        };
        
        // Store in database
        const result = await storeSourceDocument(documentData);
        
        if (result.success) {
            console.log('Test data inserted successfully!');
            console.log(`Document ID: ${result.documentId}`);
            console.log(`Created at: ${result.createdAt}`);
        } else {
            console.error('Failed to insert test data:', result.error);
        }
        
    } catch (error) {
        console.error('Failed to insert test data:', error);
        throw error;
    }
}

insertTestData()
    .then(() => {
        console.log('Test data insertion completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Test data insertion failed:', error);
        process.exit(1);
    });