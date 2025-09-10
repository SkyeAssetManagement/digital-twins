// Clean minimal version of debug API
export default function handler(req, res) {
  try {
    console.log('Clean debug API called');
    
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { step } = req.body || {};
    
    if (!step) {
      return res.status(400).json({ error: 'Step is required' });
    }

    let result;

    switch (step) {
      case 'load_file':
        result = {
          filePath: 'test_data.csv',
          fileSize: 1024,
          totalRows: 100,
          totalColumns: 10,
          note: 'Simple test data - API is working!'
        };
        break;
        
      case 'analyze_structure':
        result = {
          totalRows: 3,
          totalColumns: 3,
          note: 'Basic structure analysis'
        };
        break;
        
      case 'get_llm_analysis':
        result = {
          analysisSuccess: true,
          note: 'LLM analysis placeholder'
        };
        break;
        
      case 'apply_wrangling_plan':
        result = {
          success: true,
          note: 'Wrangling plan placeholder'
        };
        break;
        
      case 'validate_output':
        result = {
          success: true,
          note: 'Output validation placeholder'
        };
        break;
        
      default:
        return res.status(400).json({ error: `Unknown step: ${step}` });
    }

    return res.status(200).json({
      success: true,
      step: step,
      result: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Clean debug API error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}