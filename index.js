// This project uses Vercel serverless functions
// API routes are handled by files in /api/ directory
// Static files are served from /public/ directory

console.log('This project is configured for Vercel serverless deployment');
console.log('API routes: /api/*.js');
console.log('Static files: /public/*');

export default function handler(req, res) {
  res.json({
    message: 'This is a Vercel serverless project',
    apis: '/api/*',
    static: '/public/*',
    timestamp: new Date().toISOString()
  });
}