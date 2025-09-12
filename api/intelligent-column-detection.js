/**
 * Intelligent Column Detection API Endpoint - Phase 3A
 * 
 * Production-ready API endpoint for the IntelligentColumnDetector
 * Replaces basic column detection with sophisticated two-tier approach
 * 
 * Endpoint: POST /api/intelligent-column-detection
 */

import { IntelligentColumnDetector } from '../src/analysis/intelligent-column-detector.js';

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            error: 'Method not allowed. Use POST.'
        });
    }
    
    try {
        console.log('🔍 Starting intelligent column detection...');
        const startTime = performance.now();
        
        // Validate request body
        const { surveyData, context, options } = req.body;
        
        if (!surveyData) {
            return res.status(400).json({
                success: false,
                error: 'Survey data is required'
            });
        }
        
        // Initialize detector with options
        const detectorOptions = {
            maxSampleSize: 20,
            minConfidenceThreshold: 0.7,
            maxLLMCalls: 5,
            enableFallbackDetection: true,
            ...options
        };
        
        const detector = new IntelligentColumnDetector(detectorOptions);
        
        // Prepare context for analysis
        const analysisContext = {
            target_demographic: context?.target_demographic || 'General population',
            business_description: context?.business_description || 'Consumer survey',
            dataset_name: context?.dataset_name || 'Unknown dataset',
            ...context
        };
        
        console.log(`📊 Analyzing ${Object.keys(surveyData.columns || surveyData).length} columns`);
        console.log(`🎯 Target demographic: ${analysisContext.target_demographic}`);
        
        // Run detection
        const detectionResult = await detector.detectOpenEndedColumns(surveyData, analysisContext);
        
        if (!detectionResult.success) {
            throw new Error(detectionResult.detectionReport?.error || 'Detection failed');
        }
        
        const processingTime = performance.now() - startTime;
        
        // Prepare response with comprehensive results
        const response = {
            success: true,
            data: {
                openEndedColumns: detectionResult.openEndedColumns,
                summary: {
                    totalColumns: detectionResult.detectionReport.totalColumns,
                    openEndedDetected: detectionResult.openEndedColumns.length,
                    detectionRate: Math.round((detectionResult.openEndedColumns.length / detectionResult.detectionReport.totalColumns) * 100),
                    processingTime: Math.round(processingTime),
                    methodology: 'intelligent_two_tier'
                },
                methodBreakdown: {
                    headerBased: detectionResult.detectionReport.headerDetected.length,
                    llmBased: detectionResult.detectionReport.llmDetected.length,
                    totalLLMCallsUsed: detectionResult.detectionReport.llmDetected.length
                },
                detectionDetails: detectionResult.openEndedColumns.map(col => ({
                    column: col.column,
                    method: col.method,
                    confidence: col.confidence,
                    reasoning: col.reasoning
                }))
            },
            metadata: {
                version: '3A.1.0',
                timestamp: new Date().toISOString(),
                context: analysisContext,
                options: detectorOptions
            }
        };
        
        // Include debug information if requested
        if (options?.includeDebugInfo) {
            response.debug = {
                detectionReport: detectionResult.detectionReport,
                excludedColumns: detectionResult.detectionReport.excluded
            };
        }
        
        console.log(`✅ Detection completed: ${detectionResult.openEndedColumns.length} open-ended columns found`);
        console.log(`⚡ Processing time: ${Math.round(processingTime)}ms`);
        
        return res.status(200).json(response);
        
    } catch (error) {
        console.error('❌ Intelligent column detection failed:', error);
        
        return res.status(500).json({
            success: false,
            error: 'Column detection failed',
            details: error.message,
            metadata: {
                version: '3A.1.0',
                timestamp: new Date().toISOString(),
                errorType: 'intelligent_column_detection_error'
            }
        });
    }
}

/**
 * Example API call:
 * 
 * POST /api/intelligent-column-detection
 * {
 *   "surveyData": {
 *     "columns": {
 *       "Please explain why: | Open-Ended Response": ["Because...", "I think..."],
 *       "Age": ["25-34", "35-44"],
 *       "What improvements would you suggest?": ["Better pricing", "More features"]
 *     }
 *   },
 *   "context": {
 *     "target_demographic": "Parents with babies under 12 months",
 *     "business_description": "Baby care product consumer research",
 *     "dataset_name": "Parents Survey 2024"
 *   },
 *   "options": {
 *     "maxLLMCalls": 3,
 *     "minConfidenceThreshold": 0.75,
 *     "includeDebugInfo": true
 *   }
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "openEndedColumns": [...],
 *     "summary": {
 *       "totalColumns": 3,
 *       "openEndedDetected": 2,
 *       "detectionRate": 67,
 *       "processingTime": 1250
 *     },
 *     "methodBreakdown": {
 *       "headerBased": 1,
 *       "llmBased": 1
 *     }
 *   }
 * }
 */