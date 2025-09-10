// Root API handler - this should work as /api/index
export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({
    success: true,
    message: 'API root is working!',
    available_endpoints: [
      '/api/hello',
      '/api/test-debug', 
      '/api/minimal-debug',
      '/api/debug-data-wrangling-clean'
    ],
    timestamp: new Date().toISOString(),
    method: req.method
  });
}