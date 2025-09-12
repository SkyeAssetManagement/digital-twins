/**
 * Intelligent Column Detection System - Phase 3A
 * 
 * Replaces basic column detection with sophisticated two-tier approach:
 * 1. Fast header-based detection for explicitly labeled columns
 * 2. LLM content analysis fallback for unlabeled open-ended columns
 * 
 * Key Features:
 * - Zero false positives: Prefers precision over recall
 * - Efficient LLM usage: Only calls LLM when headers are insufficient
 * - Context-aware: Uses target demographic and business description
 * - Comprehensive reporting: Detailed detection methodology and confidence
 */

import Anthropic from '@anthropic-ai/sdk';

export class IntelligentColumnDetector {
    constructor(options = {}) {
        this.options = {
            maxSampleSize: 20,
            minConfidenceThreshold: 0.7,
            maxLLMCalls: 5, // Prevent excessive API usage
            enableFallbackDetection: true,
            ...options
        };
        
        this.anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY
        });
        
        // Comprehensive indicators for header-based detection
        this.openEndedIndicators = [
            // Direct indicators
            'open-ended', 'open ended', 'open response', 'open_response', 
            'openended', 'open_ended_response', 'open_ended', 'open text',
            
            // Question types
            'comment', 'comments', 'explain', 'describe', 'elaborate',
            'why', 'how', 'what', 'tell us', 'tell me', 'share',
            'please state', 'please say', 'please explain', 'please describe',
            
            // Response types
            'reason', 'reasons', 'other', 'specify', 'additional',
            'feedback', 'thoughts', 'opinion', 'opinions', 'view', 'views',
            'experience', 'experiences', 'story', 'stories',
            
            // Qualitative indicators
            'qualitative', 'narrative', 'text', 'written', 'verbal',
            'free text', 'freetext', 'free form', 'freeform'
        ];
        
        // First row metadata indicators
        this.metadataIndicators = [
            'open-ended response', 'open ended response', 'open response',
            'text response', 'qualitative response', 'comment response',
            'free text response', 'narrative response'
        ];
        
        this.detectionReport = {
            totalColumns: 0,
            headerDetected: [],
            llmDetected: [],
            excluded: [],
            confidence: {},
            processingTime: {},
            methodology: 'intelligent_two_tier'
        };
    }
    
    /**
     * Main detection entry point
     * @param {Object} data - Survey data with columns and rows
     * @param {Object} context - Business context for LLM analysis
     * @returns {Promise<Object>} Detection results with comprehensive reporting
     */
    async detectOpenEndedColumns(data, context = {}) {
        const startTime = performance.now();
        
        console.log('🔍 Starting Intelligent Column Detection...');
        console.log(`📊 Analyzing ${Object.keys(data.columns || data).length} columns`);
        
        this.detectionReport.totalColumns = Object.keys(data.columns || data).length;
        this.detectionReport.context = context;
        
        try {
            // Phase 1: Fast header-based detection
            const headerResults = await this.detectFromHeaders(data);
            console.log(`✅ Header detection: ${headerResults.detected.length} columns found`);
            
            // Phase 2: LLM fallback if needed
            let llmResults = { detected: [], excluded: [] };
            if (this.shouldUseLLMFallback(headerResults, data)) {
                llmResults = await this.detectWithLLMFallback(data, headerResults.excluded, context);
                console.log(`🤖 LLM detection: ${llmResults.detected.length} additional columns found`);
            } else {
                console.log('⚡ LLM fallback not needed - header detection sufficient');
            }
            
            // Combine results
            const allDetected = [...headerResults.detected, ...llmResults.detected];
            
            // Generate comprehensive report
            this.detectionReport.headerDetected = headerResults.detected;
            this.detectionReport.llmDetected = llmResults.detected;
            this.detectionReport.excluded = this.getUndetectedColumns(data, allDetected);
            this.detectionReport.processingTime.total = performance.now() - startTime;
            this.detectionReport.summary = this.generateDetectionSummary();
            
            console.log(`🎯 Detection complete: ${allDetected.length} open-ended columns identified`);
            console.log(`⏱️  Processing time: ${Math.round(this.detectionReport.processingTime.total)}ms`);
            
            return {
                openEndedColumns: allDetected,
                detectionReport: this.detectionReport,
                success: true
            };
            
        } catch (error) {
            console.error('❌ Column detection failed:', error);
            return {
                openEndedColumns: [],
                detectionReport: {
                    ...this.detectionReport,
                    error: error.message,
                    processingTime: { total: performance.now() - startTime }
                },
                success: false
            };
        }
    }
    
    /**
     * Phase 1: Header-based detection (fast path)
     */
    async detectFromHeaders(data) {
        const startTime = performance.now();
        const detected = [];
        const excluded = [];
        
        const columns = Object.keys(data.columns || data);
        
        for (const columnName of columns) {
            const detectionResult = this.analyzeColumnHeader(columnName, data);
            
            if (detectionResult.isOpenEnded) {
                detected.push({
                    column: columnName,
                    method: 'header_analysis',
                    indicator: detectionResult.indicator,
                    confidence: detectionResult.confidence,
                    reasoning: detectionResult.reasoning
                });
                
                this.detectionReport.confidence[columnName] = detectionResult.confidence;
            } else {
                excluded.push(columnName);
            }
        }
        
        this.detectionReport.processingTime.headerDetection = performance.now() - startTime;
        
        return { detected, excluded };
    }
    
    /**
     * Analyze individual column header for open-ended indicators
     */
    analyzeColumnHeader(columnName, data) {
        const columnLower = columnName.toLowerCase();
        
        // Check for direct indicators in column name
        for (const indicator of this.openEndedIndicators) {
            if (columnLower.includes(indicator)) {
                return {
                    isOpenEnded: true,
                    indicator: indicator,
                    confidence: 0.95,
                    reasoning: `Column name contains explicit indicator: "${indicator}"`
                };
            }
        }
        
        // Check first row for metadata indicators
        const firstRowValue = this.getFirstRowValue(columnName, data);
        if (firstRowValue) {
            const firstRowLower = firstRowValue.toLowerCase();
            for (const indicator of this.metadataIndicators) {
                if (firstRowLower.includes(indicator)) {
                    return {
                        isOpenEnded: true,
                        indicator: indicator,
                        confidence: 0.90,
                        reasoning: `First row contains metadata indicator: "${indicator}"`
                    };
                }
            }
        }
        
        // Check for question-like patterns
        if (this.isQuestionPattern(columnName)) {
            return {
                isOpenEnded: true,
                indicator: 'question_pattern',
                confidence: 0.75,
                reasoning: 'Column name follows question pattern suggesting open-ended response'
            };
        }
        
        return {
            isOpenEnded: false,
            reasoning: 'No explicit indicators found in header or metadata'
        };
    }
    
    /**
     * Check if column name follows question patterns
     */
    isQuestionPattern(columnName) {
        const questionPatterns = [
            /why\s+/i, /how\s+/i, /what\s+/i, /when\s+/i, /where\s+/i,
            /tell\s+us/i, /tell\s+me/i, /describe/i, /explain/i,
            /\?\s*$/,  // Ends with question mark
            /please\s+(say|state|explain|describe)/i
        ];
        
        return questionPatterns.some(pattern => pattern.test(columnName));
    }
    
    /**
     * Get first row value for metadata analysis
     */
    getFirstRowValue(columnName, data) {
        try {
            if (data.columns && data.columns[columnName]) {
                return data.columns[columnName][0];
            } else if (data[columnName]) {
                return Array.isArray(data[columnName]) ? data[columnName][0] : data[columnName];
            }
            return null;
        } catch (error) {
            return null;
        }
    }
    
    /**
     * Determine if LLM fallback is needed
     */
    shouldUseLLMFallback(headerResults, data) {
        const totalColumns = Object.keys(data.columns || data).length;
        const detectedColumns = headerResults.detected.length;
        
        // Use LLM fallback if:
        // 1. Very few columns detected (likely missed some)
        // 2. Large dataset with suspiciously low detection rate
        // 3. Fallback is enabled
        
        const detectionRate = detectedColumns / totalColumns;
        const hasLowDetectionRate = detectionRate < 0.05; // Less than 5%
        const hasLargeDataset = totalColumns > 50;
        const suspiciouslyLow = hasLargeDataset && detectedColumns < 3;
        
        return this.options.enableFallbackDetection && 
               (hasLowDetectionRate || suspiciouslyLow);
    }
    
    /**
     * Phase 2: LLM-based content analysis (fallback)
     */
    async detectWithLLMFallback(data, excludedColumns, context) {
        const startTime = performance.now();
        const detected = [];
        
        if (excludedColumns.length === 0) {
            return { detected, excluded: [] };
        }
        
        console.log(`🤖 Analyzing ${excludedColumns.length} columns with LLM...`);
        
        // Sample columns for analysis (limit LLM calls)
        const columnsToAnalyze = excludedColumns.slice(0, this.options.maxLLMCalls);
        
        for (const columnName of columnsToAnalyze) {
            try {
                const analysisResult = await this.analyzeLLMColumnContent(columnName, data, context);
                
                if (analysisResult.isOpenEnded && 
                    analysisResult.confidence >= this.options.minConfidenceThreshold) {
                    
                    detected.push({
                        column: columnName,
                        method: 'llm_content_analysis',
                        confidence: analysisResult.confidence,
                        reasoning: analysisResult.reasoning,
                        sampleAnalysis: analysisResult.sampleAnalysis
                    });
                    
                    this.detectionReport.confidence[columnName] = analysisResult.confidence;
                }
                
                // Small delay to prevent rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.warn(`⚠️  LLM analysis failed for column "${columnName}":`, error.message);
            }
        }
        
        this.detectionReport.processingTime.llmDetection = performance.now() - startTime;
        
        return { detected, excluded: [] };
    }
    
    /**
     * Analyze column content using LLM
     */
    async analyzeLLMColumnContent(columnName, data, context) {
        // Extract sample responses
        const samples = this.extractColumnSamples(columnName, data, this.options.maxSampleSize);
        
        if (samples.length === 0) {
            return {
                isOpenEnded: false,
                confidence: 0,
                reasoning: 'No sample data available for analysis'
            };
        }
        
        const prompt = this.buildLLMAnalysisPrompt(columnName, samples, context);
        
        const response = await this.anthropic.messages.create({
            model: 'claude-opus-4-1-20250805',
            max_tokens: 1500,
            messages: [{
                role: 'user',
                content: prompt
            }]
        });
        
        return this.parseLLMResponse(response.content[0].text, samples);
    }
    
    /**
     * Extract diverse sample responses from column
     */
    extractColumnSamples(columnName, data, maxSamples) {
        try {
            let columnData;
            if (data.columns && data.columns[columnName]) {
                columnData = data.columns[columnName];
            } else if (data[columnName]) {
                columnData = Array.isArray(data[columnName]) ? data[columnName] : [data[columnName]];
            } else {
                return [];
            }
            
            // Filter out empty/null values
            const validResponses = columnData.filter(response => {
                if (response === null || response === undefined) return false;
                const str = String(response).trim();
                return str.length > 0 && str !== 'N/A' && str !== 'NA' && str !== '-';
            });
            
            if (validResponses.length === 0) return [];
            
            // Sample diverse responses (avoid duplicates)
            const uniqueResponses = [...new Set(validResponses.map(r => String(r)))];
            
            // Take diverse sample
            const samples = [];
            const step = Math.max(1, Math.floor(uniqueResponses.length / maxSamples));
            
            for (let i = 0; i < uniqueResponses.length && samples.length < maxSamples; i += step) {
                samples.push(uniqueResponses[i]);
            }
            
            return samples;
            
        } catch (error) {
            console.warn(`Sample extraction failed for column "${columnName}":`, error.message);
            return [];
        }
    }
    
    /**
     * Build LLM analysis prompt
     */
    buildLLMAnalysisPrompt(columnName, samples, context) {
        const contextStr = context.target_demographic ? 
            `Target demographic: ${context.target_demographic}\nBusiness context: ${context.business_description || 'Consumer survey'}\n` : 
            '';
        
        return `You are analyzing survey data to identify open-ended response columns.

${contextStr}

Column Name: "${columnName}"

Sample Responses:
${samples.map((sample, i) => `${i + 1}. "${sample}"`).join('\n')}

Task: Determine if this column contains open-ended (qualitative) responses or categorical/numerical responses.

Open-ended columns contain:
- Varied, unique text responses
- Explanations, opinions, stories
- Descriptive language
- Personal experiences
- Reasons or justifications

NOT open-ended:
- Single words or short phrases that repeat
- Numbers, dates, ratings
- Yes/No or similar categorical responses
- Dropdown selections

Analyze the samples and respond in this exact JSON format:
{
  "is_open_ended": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "Clear explanation of your analysis",
  "sample_characteristics": "What patterns you observed in the samples"
}

Be conservative - only classify as open-ended if you're confident the responses show varied, qualitative content.`;
    }
    
    /**
     * Parse LLM response
     */
    parseLLMResponse(responseText, samples) {
        try {
            // Extract JSON from response
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }
            
            const analysis = JSON.parse(jsonMatch[0]);
            
            return {
                isOpenEnded: analysis.is_open_ended || false,
                confidence: Math.min(Math.max(analysis.confidence || 0, 0), 1),
                reasoning: analysis.reasoning || 'No reasoning provided',
                sampleAnalysis: analysis.sample_characteristics || 'No sample analysis provided',
                sampleCount: samples.length
            };
            
        } catch (error) {
            console.warn('Failed to parse LLM response:', error.message);
            return {
                isOpenEnded: false,
                confidence: 0,
                reasoning: `LLM response parsing failed: ${error.message}`
            };
        }
    }
    
    /**
     * Get columns that weren't detected as open-ended
     */
    getUndetectedColumns(data, detectedColumns) {
        const allColumns = Object.keys(data.columns || data);
        const detectedColumnNames = new Set(detectedColumns.map(d => d.column));
        
        return allColumns.filter(col => !detectedColumnNames.has(col));
    }
    
    /**
     * Generate detection summary
     */
    generateDetectionSummary() {
        const totalDetected = this.detectionReport.headerDetected.length + this.detectionReport.llmDetected.length;
        const detectionRate = (totalDetected / this.detectionReport.totalColumns) * 100;
        
        return {
            totalColumns: this.detectionReport.totalColumns,
            openEndedDetected: totalDetected,
            detectionRate: Math.round(detectionRate * 10) / 10,
            methodBreakdown: {
                headerBased: this.detectionReport.headerDetected.length,
                llmBased: this.detectionReport.llmDetected.length
            },
            efficiency: {
                headerDetectionFirst: this.detectionReport.headerDetected.length > 0,
                llmCallsUsed: this.detectionReport.llmDetected.length,
                llmCallsAvoidedByHeaders: Math.max(0, this.detectionReport.headerDetected.length)
            }
        };
    }
    
    /**
     * Get detection report for debugging and validation
     */
    getDetectionReport() {
        return {
            ...this.detectionReport,
            timestamp: new Date().toISOString(),
            version: '3A.1.0'
        };
    }
}

// Export for use in other modules
export default IntelligentColumnDetector;

/**
 * Usage Example:
 * 
 * const detector = new IntelligentColumnDetector({
 *     maxSampleSize: 15,
 *     minConfidenceThreshold: 0.75,
 *     enableFallbackDetection: true
 * });
 * 
 * const result = await detector.detectOpenEndedColumns(surveyData, {
 *     target_demographic: "Parents with babies under 12 months",
 *     business_description: "Baby care product consumer research"
 * });
 * 
 * console.log('Open-ended columns:', result.openEndedColumns);
 * console.log('Detection report:', result.detectionReport);
 */