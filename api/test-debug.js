/**
 * Simple test API to debug the 500 error
 * Vercel serverless function format
 */

export default function handler(req, res) {
    try {
        console.log('Test debug API called');
        
        // Set proper headers for JSON
        res.setHeader('Content-Type', 'application/json');
        
        if (req.method !== 'POST') {
            return res.status(405).json({ 
                success: false,
                error: 'Method not allowed' 
            });
        }

        const { step } = req.body || {};
        
        console.log('Step requested:', step);

        // Simple test response
        return res.status(200).json({
            success: true,
            step: step || 'unknown',
            message: 'Test API working',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Test API error:', error);
        
        // Ensure we return JSON even on error
        res.setHeader('Content-Type', 'application/json');
        return res.status(500).json({
            success: false,
            error: error.message || 'Unknown error',
            timestamp: new Date().toISOString()
        });
    }
}
}