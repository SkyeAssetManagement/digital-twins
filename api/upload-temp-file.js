/**
 * API endpoint for uploading files to temporary database storage
 * Supports Excel/CSV files for data wrangling analysis
 */

import { createLogger } from '../src/utils/logger.js';
import multer from 'multer';

const logger = createLogger('UploadTempFileAPI');

// Configure multer for file uploads (memory storage since we're converting to base64)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB max file size
    },
    fileFilter: (req, file, cb) => {
        // Accept Excel and CSV files
        const allowedTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel', // .xls
            'text/csv', // .csv
            'application/csv'
        ];
        
        if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel (.xlsx, .xls) and CSV files are allowed'), false);
        }
    }
});

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        logger.info('File upload request received');

        // Handle file upload with multer
        const uploadMiddleware = upload.single('file');
        
        await new Promise((resolve, reject) => {
            uploadMiddleware(req, res, (err) => {
                if (err) {
                    logger.error('Multer upload error:', err);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { originalname, size, mimetype, buffer } = req.file;
        logger.info(`File received: ${originalname}, Size: ${size} bytes, Type: ${mimetype}`);

        // Convert file buffer to base64
        const base64Data = buffer.toString('base64');
        logger.info(`File converted to base64: ${base64Data.length} characters`);

        // Store in database (for now, we'll use a simple in-memory solution)
        // TODO: Replace with actual database storage
        const fileId = generateFileId();
        const uploadRecord = {
            id: fileId,
            filename: originalname,
            original_size: size,
            mime_type: mimetype,
            file_data_base64: base64Data,
            upload_timestamp: new Date().toISOString(),
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
            processing_status: 'uploaded',
            metadata: {}
        };

        // Store in global variable for now (replace with database)
        if (!global.tempFileStorage) {
            global.tempFileStorage = new Map();
        }
        global.tempFileStorage.set(fileId, uploadRecord);

        logger.info(`File stored with ID: ${fileId}`);

        res.json({
            success: true,
            file_id: fileId,
            filename: originalname,
            size: size,
            mime_type: mimetype,
            upload_timestamp: uploadRecord.upload_timestamp,
            expires_at: uploadRecord.expires_at,
            message: 'File uploaded successfully and ready for analysis'
        });

    } catch (error) {
        logger.error('File upload failed:', error);
        
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ 
                error: 'File too large. Maximum size is 50MB.' 
            });
        }
        
        return res.status(500).json({ 
            error: error.message || 'File upload failed',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}

function generateFileId() {
    return 'temp_' + Math.random().toString(36).substring(2) + '_' + Date.now();
}

export { upload };