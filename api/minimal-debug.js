// Absolutely minimal API with ZERO imports
export default function handler(req, res) {
  try {
    console.log('Minimal debug API called');
    
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { step } = req.body || {};
    
    return res.status(200).json({
      success: true,
      step: step || 'unknown',
      message: 'Minimal API working - no imports, no complexity',
      timestamp: new Date().toISOString(),
      method: req.method,
      hasBody: !!req.body
    });

  } catch (error) {
    console.error('Minimal API error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}