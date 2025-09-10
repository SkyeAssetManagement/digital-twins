// CSV export endpoint for cleaned data
const logger = {
    info: (...args) => console.log('[INFO]', ...args),
    error: (...args) => console.error('[ERROR]', ...args)
};

// Store for cleaned data (in production, use database)
let cleanedDataStore = new Map();

export default async function handler(req, res) {
    try {
        logger.info('CSV export API called');
        
        if (req.method === 'POST') {
            // Store cleaned data for export
            const { sessionId, cleanedData, fileName } = req.body;
            
            if (!sessionId || !cleanedData) {
                return res.status(400).json({ error: 'Missing sessionId or cleanedData' });
            }
            
            cleanedDataStore.set(sessionId, {
                data: cleanedData,
                fileName: fileName || 'cleaned_data.csv',
                timestamp: new Date().toISOString()
            });
            
            return res.status(200).json({
                success: true,
                sessionId: sessionId,
                exportUrl: `/api/export-cleaned-data?sessionId=${sessionId}`,
                note: 'Data stored for CSV export'
            });
            
        } else if (req.method === 'GET') {
            // Download CSV
            const { sessionId } = req.query;
            
            if (!sessionId) {
                return res.status(400).json({ error: 'Missing sessionId parameter' });
            }
            
            const storedData = cleanedDataStore.get(sessionId);
            if (!storedData) {
                return res.status(404).json({ error: 'Data not found - may have expired' });
            }
            
            // Convert data to CSV
            const csvContent = convertToCSV(storedData.data);
            
            // Set headers for CSV download
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${storedData.fileName}"`);
            res.setHeader('Cache-Control', 'no-cache');
            
            // Clean up stored data after download
            cleanedDataStore.delete(sessionId);
            
            return res.status(200).send(csvContent);
            
        } else {
            return res.status(405).json({ error: 'Method not allowed' });
        }
        
    } catch (error) {
        logger.error('CSV export error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

function convertToCSV(data) {
    if (!Array.isArray(data) || data.length === 0) {
        return '';
    }
    
    // Convert each row to CSV format
    const csvRows = data.map(row => {
        if (Array.isArray(row)) {
            return row.map(cell => {
                // Escape quotes and wrap in quotes if needed
                const cellStr = String(cell || '');
                if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                    return `"${cellStr.replace(/"/g, '""')}"`;
                }
                return cellStr;
            }).join(',');
        }
        return String(row);
    });
    
    return csvRows.join('\n');
}