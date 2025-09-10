/**
 * Database utilities for file storage and survey data management
 */

// Ensure environment variables are loaded
import dotenv from 'dotenv';
dotenv.config();

import pkg from 'pg';
const { Client, Pool } = pkg;
import yaml from 'yaml';
import fs from 'fs/promises';
import path from 'path';
import { createLogger } from './logger.js';

const logger = createLogger('Database');

let dbPool = null;

/**
 * Initialize database connection pool
 */
async function initializeDatabase() {
    if (dbPool) return dbPool;

    try {
        let dbConfig;

        // Try environment variable first (serverless-friendly)
        if (process.env.DATABASE_URL) {
            logger.info('Using DATABASE_URL from environment');
            dbPool = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
                max: 10,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000,
            });
        } else {
            // Fallback to dbConfig.yaml for local development
            logger.info('Using dbConfig.yaml file');
            const configPath = path.join(process.cwd(), 'dbConfig.yaml');
            const configFile = await fs.readFile(configPath, 'utf8');
            dbConfig = yaml.parse(configFile);

            dbPool = new Pool({
                host: dbConfig.host,
                port: dbConfig.port,
                database: dbConfig.database,
                user: dbConfig.user,
                password: dbConfig.password,
                ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
                max: 10,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000,
            });
        }

        logger.info('Database connection pool initialized');
        return dbPool;
    } catch (error) {
        logger.error('Failed to initialize database:', error);
        throw error;
    }
}

/**
 * Store source document (original file) as base64 in database
 */
async function storeSourceDocument(documentData) {
    const pool = await initializeDatabase();
    const client = await pool.connect();

    try {
        const query = `
            INSERT INTO source_documents (
                name, original_filename, file_type, file_size, file_content_base64,
                target_demographic, description, processing_status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, created_at;
        `;

        const values = [
            documentData.name,
            documentData.originalFilename,
            documentData.fileType,
            documentData.fileSize,
            documentData.fileContentBase64,
            documentData.targetDemographic,
            documentData.description,
            'pending'
        ];

        const result = await client.query(query, values);
        logger.info(`Stored source document: ${documentData.name} (ID: ${result.rows[0].id})`);
        
        return {
            success: true,
            documentId: result.rows[0].id,
            createdAt: result.rows[0].created_at
        };
    } catch (error) {
        logger.error('Failed to store source document:', error);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Store processed survey data in generic format
 */
async function storeSurveyData(sourceDocumentId, surveyData) {
    const pool = await initializeDatabase();
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Clear existing data for this document
        await client.query(
            'DELETE FROM survey_data WHERE source_document_id = $1',
            [sourceDocumentId]
        );

        // Insert survey responses
        const insertQuery = `
            INSERT INTO survey_data (
                source_document_id, question_id, question_text, question_category,
                question_type, question_order, respondent_id, response_value,
                response_normalized, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `;

        let insertCount = 0;
        
        // Process each question and response
        for (let qIndex = 0; qIndex < surveyData.questions.length; qIndex++) {
            const question = surveyData.questions[qIndex];
            
            for (let rIndex = 0; rIndex < surveyData.responses.length; rIndex++) {
                const response = surveyData.responses[rIndex];
                const responseValue = response[question.text] || response[qIndex] || '';
                
                if (responseValue !== '') {  // Only store non-empty responses
                    const values = [
                        sourceDocumentId,
                        question.id || `q${qIndex + 1}`,
                        question.text,
                        question.category || inferQuestionCategory(question.text),
                        question.type || 'text',
                        qIndex + 1,
                        `r${rIndex + 1}`,
                        responseValue,
                        normalizeResponse(responseValue, question.type),
                        JSON.stringify(question.metadata || {})
                    ];
                    
                    await client.query(insertQuery, values);
                    insertCount++;
                }
            }
        }

        await client.query('COMMIT');
        logger.info(`Stored ${insertCount} survey data records for document ${sourceDocumentId}`);
        
        return {
            success: true,
            recordsStored: insertCount
        };
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Failed to store survey data:', error);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Update source document processing status and wrangling report
 */
async function updateSourceDocumentStatus(documentId, status, wranglingReport = null, errorMessage = null) {
    const pool = await initializeDatabase();
    const client = await pool.connect();

    try {
        let query, values;
        
        if (wranglingReport) {
            query = `
                UPDATE source_documents 
                SET processing_status = $1, wrangling_report = $2, updated_at = NOW()
                WHERE id = $3
            `;
            values = [status, JSON.stringify(wranglingReport), documentId];
        } else if (errorMessage) {
            query = `
                UPDATE source_documents 
                SET processing_status = $1, error_message = $2, updated_at = NOW()
                WHERE id = $3
            `;
            values = [status, errorMessage, documentId];
        } else {
            query = `
                UPDATE source_documents 
                SET processing_status = $1, updated_at = NOW()
                WHERE id = $2
            `;
            values = [status, documentId];
        }

        await client.query(query, values);
        logger.info(`Updated document ${documentId} status to: ${status}`);
        
        return { success: true };
    } catch (error) {
        logger.error('Failed to update document status:', error);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Get all source documents with metadata
 */
async function getSourceDocuments() {
    const pool = await initializeDatabase();
    const client = await pool.connect();

    try {
        const query = `
            SELECT 
                sd.id,
                sd.name,
                sd.original_filename,
                sd.file_type,
                sd.file_size,
                sd.processing_status,
                sd.target_demographic,
                sd.description,
                sd.created_at,
                sd.updated_at,
                COUNT(DISTINCT survd.question_id) as total_questions,
                COUNT(DISTINCT survd.respondent_id) as total_responses
            FROM source_documents sd
            LEFT JOIN survey_data survd ON sd.id = survd.source_document_id
            GROUP BY sd.id, sd.name, sd.original_filename, sd.file_type, sd.file_size, 
                     sd.processing_status, sd.target_demographic, sd.description, 
                     sd.created_at, sd.updated_at
            ORDER BY sd.created_at DESC
        `;

        const result = await client.query(query);
        logger.info(`Retrieved ${result.rows.length} source documents`);
        
        return {
            success: true,
            documents: result.rows
        };
    } catch (error) {
        logger.error('Failed to get source documents:', error);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Get source document by ID with full data
 */
async function getSourceDocumentById(documentId, includeFileContent = false) {
    const pool = await initializeDatabase();
    const client = await pool.connect();

    try {
        // Get document metadata
        let query = `
            SELECT id, name, original_filename, file_type, file_size, processing_status,
                   target_demographic, description, wrangling_report, error_message,
                   created_at, updated_at
                   ${includeFileContent ? ', file_content_base64' : ''}
            FROM source_documents 
            WHERE id = $1
        `;

        const docResult = await client.query(query, [documentId]);
        
        if (docResult.rows.length === 0) {
            return { success: false, error: 'Document not found' };
        }

        const document = docResult.rows[0];

        // Get survey data
        const dataQuery = `
            SELECT question_id, question_text, question_category, question_type, question_order,
                   respondent_id, response_value, response_normalized, metadata
            FROM survey_data 
            WHERE source_document_id = $1
            ORDER BY question_order, respondent_id
        `;

        const dataResult = await client.query(dataQuery, [documentId]);
        
        // Transform data into survey format
        const questions = [];
        const responses = [];
        const questionMap = new Map();
        const respondentMap = new Map();

        // Build questions array
        dataResult.rows.forEach(row => {
            if (!questionMap.has(row.question_id)) {
                questionMap.set(row.question_id, {
                    id: row.question_id,
                    text: row.question_text,
                    type: row.question_type,
                    category: row.question_category,
                    order: row.question_order,
                    metadata: JSON.parse(row.metadata || '{}')
                });
            }
        });

        questions.push(...Array.from(questionMap.values()).sort((a, b) => a.order - b.order));

        // Build responses array
        dataResult.rows.forEach(row => {
            if (!respondentMap.has(row.respondent_id)) {
                respondentMap.set(row.respondent_id, {});
            }
            respondentMap.get(row.respondent_id)[row.question_text] = row.response_value;
        });

        responses.push(...Array.from(respondentMap.values()));

        logger.info(`Retrieved document ${documentId} with ${questions.length} questions and ${responses.length} responses`);
        
        return {
            success: true,
            document: {
                ...document,
                survey_data: {
                    questions,
                    responses
                },
                total_questions: questions.length,
                total_responses: responses.length
            }
        };
    } catch (error) {
        logger.error('Failed to get source document by ID:', error);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Helper function to infer question category from text
 */
function inferQuestionCategory(questionText) {
    const lowerText = questionText.toLowerCase();
    
    if (lowerText.includes('age') || lowerText.includes('demographic') || lowerText.includes('gender')) {
        return 'demographics';
    } else if (lowerText.includes('spend') || lowerText.includes('buy') || lowerText.includes('purchase')) {
        return 'spending';
    } else if (lowerText.includes('often') || lowerText.includes('frequency') || lowerText.includes('how many')) {
        return 'behavior';
    } else if (lowerText.includes('prefer') || lowerText.includes('like') || lowerText.includes('opinion')) {
        return 'preferences';
    } else {
        return 'general';
    }
}

/**
 * Helper function to normalize response values
 */
function normalizeResponse(responseValue, questionType) {
    if (!responseValue || responseValue === '') return null;
    
    // Try to convert to number for numeric responses
    if (questionType === 'numeric' || questionType === 'spending') {
        const num = parseFloat(responseValue.replace(/[^0-9.-]/g, ''));
        return isNaN(num) ? null : num;
    }
    
    // Convert frequency responses to numeric scale
    const freqMap = {
        'never': 0,
        'rarely': 1,
        'sometimes': 2,
        'often': 3,
        'always': 4,
        'daily': 5,
        'weekly': 3,
        'monthly': 2,
        'yearly': 1
    };
    
    const lowerResponse = responseValue.toLowerCase();
    for (const [key, value] of Object.entries(freqMap)) {
        if (lowerResponse.includes(key)) {
            return value;
        }
    }
    
    return null;
}

/**
 * Close database connection pool
 */
async function closeDatabase() {
    if (dbPool) {
        await dbPool.end();
        dbPool = null;
        logger.info('Database connection pool closed');
    }
}

export {
    initializeDatabase,
    storeSourceDocument,
    storeSurveyData,
    updateSourceDocumentStatus,
    getSourceDocuments,
    getSourceDocumentById,
    closeDatabase
};