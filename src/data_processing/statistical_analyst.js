/**
 * Stage 1: Statistical Data Analyst
 * Identifies discriminatory questions with statistical spread and spending correlation
 * Generates correlation matrices and statistical visualizations
 */

import promptLoader from '../prompts/vercel-prompt-loader.js';

class StatisticalAnalyst {
    constructor(claudeClient) {
        this.claudeClient = claudeClient;
        this.analysisResults = null;
    }

    /**
     * Main analysis function for Stage 1
     * @param {Object} surveyData - Raw survey data with questions and responses
     * @param {string} targetDemographic - Target demographic context
     * @param {string} surveyContext - Survey context/purpose
     * @returns {Object} Statistical analysis results with discriminatory questions and correlations
     */
    async analyzeStatisticalDiscrimination(surveyData, targetDemographic = null, surveyContext = null) {
        try {
            console.log('Stage 1: Starting statistical discrimination analysis...');
            
            // Prepare survey questions for analysis
            const questionsList = this.extractQuestionsList(surveyData);
            const responseData = this.extractResponseData(surveyData);
            const statisticalSummary = this.calculateBasicStatistics(responseData);
            
            // Build the statistical analyst prompt
            const prompt = promptLoader.buildPrompt('prompt_1_StatsAnalyst', {
                targetDemographic,
                surveyContext,
                questions: questionsList,
                statisticalSummary
            });

            // Call Claude API for statistical analysis
            const response = await this.claudeClient.messages.create({
                model: 'claude-opus-4-1-20250805',
                max_tokens: 8000,
                temperature: 0.3, // Lower temperature for analytical precision
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            });

            // Parse and validate the response
            const analysisResult = this.parseAnalysisResponse(response.content[0].text);
            
            // Generate additional statistical insights
            const correlationMatrix = this.calculateCorrelationMatrix(responseData, analysisResult);
            const varianceAnalysis = this.calculateVarianceMetrics(responseData, analysisResult);
            
            // Combine all results
            this.analysisResults = {
                ...analysisResult,
                correlation_matrix: correlationMatrix,
                variance_analysis: varianceAnalysis,
                statistical_summary: statisticalSummary,
                timestamp: new Date().toISOString()
            };

            console.log('Stage 1: Statistical analysis completed successfully');
            return this.analysisResults;

        } catch (error) {
            console.error('Stage 1 Statistical Analysis Error:', error);
            throw new Error(`Statistical analysis failed: ${error.message}`);
        }
    }

    /**
     * Extract questions list from survey data
     */
    extractQuestionsList(surveyData) {
        if (!surveyData || !surveyData.fields) {
            throw new Error('Invalid survey data structure');
        }

        return Object.entries(surveyData.fields).map(([key, field]) => {
            return {
                id: key,
                question: field.title || field.label || key,
                type: field.type || 'unknown',
                options: field.choices || field.options || null,
                required: field.required || false
            };
        });
    }

    /**
     * Extract response data for statistical calculations
     */
    extractResponseData(surveyData) {
        if (!surveyData || !surveyData.responses) {
            return [];
        }

        return surveyData.responses.map(response => {
            const processedResponse = {};
            Object.entries(response).forEach(([key, value]) => {
                if (key !== 'id' && key !== 'timestamp') {
                    processedResponse[key] = this.normalizeResponseValue(value);
                }
            });
            return processedResponse;
        });
    }

    /**
     * Normalize response values for statistical analysis
     */
    normalizeResponseValue(value) {
        if (value === null || value === undefined || value === '') {
            return null;
        }
        
        // Convert numeric strings to numbers
        if (typeof value === 'string' && !isNaN(value) && !isNaN(parseFloat(value))) {
            return parseFloat(value);
        }
        
        return value;
    }

    /**
     * Calculate basic statistical summary
     */
    calculateBasicStatistics(responseData) {
        const stats = {
            total_responses: responseData.length,
            questions_analyzed: 0,
            response_completeness: {},
            value_distributions: {}
        };

        if (responseData.length === 0) {
            return stats;
        }

        const questions = Object.keys(responseData[0]);
        stats.questions_analyzed = questions.length;

        questions.forEach(questionId => {
            const responses = responseData.map(r => r[questionId]).filter(v => v !== null);
            const completeness = responses.length / responseData.length;
            
            stats.response_completeness[questionId] = completeness;
            
            // Calculate distribution for different data types
            if (responses.length > 0) {
                const isNumeric = responses.every(r => typeof r === 'number');
                
                if (isNumeric) {
                    const numbers = responses.sort((a, b) => a - b);
                    stats.value_distributions[questionId] = {
                        type: 'numeric',
                        min: Math.min(...numbers),
                        max: Math.max(...numbers),
                        mean: numbers.reduce((a, b) => a + b, 0) / numbers.length,
                        median: numbers[Math.floor(numbers.length / 2)],
                        std_dev: this.calculateStandardDeviation(numbers)
                    };
                } else {
                    const valueCounts = {};
                    responses.forEach(r => {
                        valueCounts[r] = (valueCounts[r] || 0) + 1;
                    });
                    
                    stats.value_distributions[questionId] = {
                        type: 'categorical',
                        unique_values: Object.keys(valueCounts).length,
                        most_common: Object.entries(valueCounts)
                            .sort(([,a], [,b]) => b - a)
                            .slice(0, 3),
                        distribution_evenness: this.calculateDistributionEvenness(valueCounts)
                    };
                }
            }
        });

        return stats;
    }

    /**
     * Calculate standard deviation
     */
    calculateStandardDeviation(numbers) {
        const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
        const squaredDiffs = numbers.map(x => Math.pow(x - mean, 2));
        const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length;
        return Math.sqrt(avgSquaredDiff);
    }

    /**
     * Calculate distribution evenness (entropy-like measure)
     */
    calculateDistributionEvenness(valueCounts) {
        const total = Object.values(valueCounts).reduce((a, b) => a + b, 0);
        const proportions = Object.values(valueCounts).map(count => count / total);
        
        // Calculate entropy-like measure
        const entropy = proportions.reduce((sum, p) => {
            return p > 0 ? sum - p * Math.log2(p) : sum;
        }, 0);
        
        const maxEntropy = Math.log2(Object.keys(valueCounts).length);
        return maxEntropy > 0 ? entropy / maxEntropy : 0;
    }

    /**
     * Calculate correlation matrix between questions
     */
    calculateCorrelationMatrix(responseData, analysisResult) {
        if (!responseData || responseData.length === 0) {
            return {};
        }

        const highRelevanceQuestions = analysisResult.discriminatory_questions
            ?.filter(q => q.statistical_power === 'HIGH' || q.spending_correlation === 'HIGH')
            ?.map(q => q.question_id) || [];

        const correlations = {};
        
        highRelevanceQuestions.forEach(questionA => {
            correlations[questionA] = {};
            
            highRelevanceQuestions.forEach(questionB => {
                if (questionA !== questionB) {
                    const correlation = this.calculatePearsonCorrelation(
                        responseData.map(r => r[questionA]),
                        responseData.map(r => r[questionB])
                    );
                    
                    if (!isNaN(correlation)) {
                        correlations[questionA][questionB] = Math.round(correlation * 1000) / 1000;
                    }
                }
            });
        });

        return correlations;
    }

    /**
     * Calculate Pearson correlation coefficient
     */
    calculatePearsonCorrelation(x, y) {
        // Filter out null/undefined pairs
        const validPairs = x.map((xVal, i) => [xVal, y[i]])
            .filter(([xVal, yVal]) => xVal !== null && yVal !== null && 
                     !isNaN(xVal) && !isNaN(yVal));

        if (validPairs.length < 2) {
            return NaN;
        }

        const xValues = validPairs.map(pair => Number(pair[0]));
        const yValues = validPairs.map(pair => Number(pair[1]));

        const n = xValues.length;
        const sumX = xValues.reduce((a, b) => a + b, 0);
        const sumY = yValues.reduce((a, b) => a + b, 0);
        const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
        const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);
        const sumYY = yValues.reduce((sum, y) => sum + y * y, 0);

        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));

        return denominator === 0 ? 0 : numerator / denominator;
    }

    /**
     * Calculate variance metrics for discriminatory analysis
     */
    calculateVarianceMetrics(responseData, analysisResult) {
        const metrics = {};
        
        analysisResult.discriminatory_questions?.forEach(question => {
            const questionId = question.question_id;
            const responses = responseData.map(r => r[questionId]).filter(v => v !== null);
            
            if (responses.length > 0) {
                const isNumeric = responses.every(r => typeof r === 'number' || !isNaN(Number(r)));
                
                if (isNumeric) {
                    const numbers = responses.map(Number);
                    const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
                    const variance = numbers.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / numbers.length;
                    
                    metrics[questionId] = {
                        type: 'numeric',
                        variance: variance,
                        coefficient_of_variation: mean !== 0 ? Math.sqrt(variance) / mean : 0,
                        range_utilization: this.calculateRangeUtilization(numbers, question)
                    };
                } else {
                    const distribution = {};
                    responses.forEach(r => {
                        distribution[r] = (distribution[r] || 0) + 1;
                    });
                    
                    metrics[questionId] = {
                        type: 'categorical',
                        gini_coefficient: this.calculateGiniCoefficient(Object.values(distribution)),
                        entropy: this.calculateDistributionEvenness(distribution),
                        modal_dominance: Math.max(...Object.values(distribution)) / responses.length
                    };
                }
            }
        });
        
        return metrics;
    }

    /**
     * Calculate how well the responses utilize the available range
     */
    calculateRangeUtilization(numbers, questionInfo) {
        if (numbers.length === 0) return 0;
        
        const min = Math.min(...numbers);
        const max = Math.max(...numbers);
        const actualRange = max - min;
        
        // If we know the theoretical range from question options, use it
        if (questionInfo.theoretical_range) {
            return actualRange / questionInfo.theoretical_range;
        }
        
        // Otherwise, assume good utilization if we see decent spread
        const uniqueValues = new Set(numbers).size;
        return Math.min(1, uniqueValues / 5); // Normalize by expected minimum spread
    }

    /**
     * Calculate Gini coefficient for categorical distributions
     */
    calculateGiniCoefficient(values) {
        const n = values.length;
        const sortedValues = values.slice().sort((a, b) => a - b);
        
        let sum = 0;
        for (let i = 0; i < n; i++) {
            sum += (2 * (i + 1) - n - 1) * sortedValues[i];
        }
        
        const total = sortedValues.reduce((a, b) => a + b, 0);
        return sum / (n * total);
    }

    /**
     * Parse the Claude API response
     */
    parseAnalysisResponse(responseText) {
        try {
            // Extract JSON from the response
            const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || 
                             responseText.match(/\{[\s\S]*\}/);
            
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }
            
            const jsonContent = jsonMatch[1] || jsonMatch[0];
            const parsed = JSON.parse(jsonContent);
            
            // Validate required fields
            this.validateAnalysisResponse(parsed);
            
            return parsed;
            
        } catch (error) {
            console.error('Failed to parse analysis response:', error);
            console.error('Raw response:', responseText);
            throw new Error(`Failed to parse statistical analysis: ${error.message}`);
        }
    }

    /**
     * Validate the analysis response structure
     */
    validateAnalysisResponse(parsed) {
        const required = ['demographic_context', 'statistical_overview', 'discriminatory_questions'];
        
        required.forEach(field => {
            if (!parsed[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        });
        
        if (!Array.isArray(parsed.discriminatory_questions)) {
            throw new Error('discriminatory_questions must be an array');
        }
    }

    /**
     * Get the current analysis results
     */
    getAnalysisResults() {
        return this.analysisResults;
    }

    /**
     * Export results for use in Stage 2
     */
    exportForStage2() {
        if (!this.analysisResults) {
            throw new Error('No analysis results available. Run analyzeStatisticalDiscrimination first.');
        }

        return {
            high_correlation_questions: this.analysisResults.discriminatory_questions
                ?.filter(q => q.spending_correlation === 'HIGH') || [],
            statistical_insights: this.analysisResults.statistical_overview,
            correlation_matrix: this.analysisResults.correlation_matrix,
            demographic_context: this.analysisResults.demographic_context,
            evidence_base: {
                total_responses: this.analysisResults.statistical_summary?.total_responses,
                analysis_confidence: this.analysisResults.confidence_level,
                timestamp: this.analysisResults.timestamp
            }
        };
    }
}

export default StatisticalAnalyst;