/**
 * Stage 2: Behavioral Statistician - Pain/Pleasure Points Analyst
 * Identifies 3-5 core pain/pleasure points based on statistical correlations and spending behavior
 * Provides evidence-based insights with statistical backing
 */

import { BEHAVIORAL_STATISTICIAN_PROMPT } from '../prompts/universal-survey-prompts.js';

class PainPleasureAnalyst {
    constructor(claudeClient) {
        this.claudeClient = claudeClient;
        this.analysisResults = null;
        this.stage1Results = null;
    }

    /**
     * Main analysis function for Stage 2
     * @param {Object} stage1Results - Results from Statistical Analyst (Stage 1)
     * @param {Object} surveyData - Raw survey data for detailed analysis
     * @returns {Object} Pain/pleasure points with statistical evidence
     */
    async identifyPainPleasurePoints(stage1Results, surveyData) {
        try {
            console.log('Stage 2: Starting pain/pleasure points analysis...');
            
            this.stage1Results = stage1Results;
            
            // Extract high-correlation questions and patterns
            const correlationInsights = this.extractCorrelationInsights(stage1Results);
            const spendingPatterns = this.analyzeSpendingPatterns(stage1Results, surveyData);
            const behavioralClusters = this.identifyBehavioralClusters(stage1Results, surveyData);
            
            // Build the behavioral statistician prompt
            const prompt = BEHAVIORAL_STATISTICIAN_PROMPT(
                stage1Results.demographic_context,
                correlationInsights,
                spendingPatterns,
                behavioralClusters,
                stage1Results.statistical_overview
            );

            // Call Claude API for behavioral analysis
            const response = await this.claudeClient.messages.create({
                model: 'claude-opus-4-1-20250805',
                max_tokens: 8000,
                temperature: 0.4, // Slightly higher for behavioral insights
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            });

            // Parse and validate the response
            const analysisResult = this.parseAnalysisResponse(response.content[0].text);
            
            // Enhance with statistical validation
            const validatedResults = await this.validatePainPleasurePoints(analysisResult, surveyData);
            const evidenceMatrix = this.buildEvidenceMatrix(validatedResults, stage1Results);
            
            // Combine all results
            this.analysisResults = {
                ...validatedResults,
                evidence_matrix: evidenceMatrix,
                correlation_insights: correlationInsights,
                spending_patterns: spendingPatterns,
                statistical_validation: this.calculateValidationMetrics(validatedResults, surveyData),
                stage1_reference: {
                    timestamp: stage1Results.timestamp,
                    confidence_level: stage1Results.confidence_level
                },
                timestamp: new Date().toISOString()
            };

            console.log('Stage 2: Pain/pleasure points analysis completed successfully');
            return this.analysisResults;

        } catch (error) {
            console.error('Stage 2 Pain/Pleasure Analysis Error:', error);
            throw new Error(`Behavioral analysis failed: ${error.message}`);
        }
    }

    /**
     * Extract correlation insights from Stage 1 results
     */
    extractCorrelationInsights(stage1Results) {
        const insights = {
            high_spending_correlations: [],
            value_behavior_correlations: [],
            demographic_patterns: [],
            statistical_significance: {}
        };

        // Extract high spending correlation questions
        const highSpendingQuestions = stage1Results.discriminatory_questions
            ?.filter(q => q.spending_correlation === 'HIGH') || [];

        insights.high_spending_correlations = highSpendingQuestions.map(q => ({
            question_id: q.question_id,
            question_text: q.question_text,
            correlation_strength: q.statistical_metrics?.spending_correlation_potential,
            evidence_type: q.evidence_type,
            behavioral_indicator: q.behavioral_insight
        }));

        // Analyze correlation matrix for patterns - get top 3-4 correlations
        const correlationMatrix = stage1Results.correlation_matrix || {};
        const allCorrelations = [];
        
        Object.entries(correlationMatrix).forEach(([questionA, correlations]) => {
            Object.entries(correlations).forEach(([questionB, correlation]) => {
                allCorrelations.push({
                    question_pair: [questionA, questionB],
                    correlation_strength: correlation,
                    correlation_magnitude: Math.abs(correlation),
                    relationship_type: correlation > 0 ? 'positive' : 'negative',
                    significance: this.categorizeCorrelationSignificance(Math.abs(correlation))
                });
            });
        });
        
        // Sort by absolute correlation strength and take top 3-4
        allCorrelations.sort((a, b) => b.correlation_magnitude - a.correlation_magnitude);
        insights.value_behavior_correlations = allCorrelations.slice(0, 4).map(corr => ({
            ...corr,
            correlation_report: `r = ${corr.correlation_strength.toFixed(2)}`
        }));

        return insights;
    }

    /**
     * Analyze spending patterns and behaviors
     */
    analyzeSpendingPatterns(stage1Results, surveyData) {
        const patterns = {
            direct_spending_indicators: [],
            indirect_spending_signals: [],
            behavioral_triggers: [],
            constraint_factors: []
        };

        // Find direct spending questions
        const spendingQuestions = stage1Results.discriminatory_questions
            ?.filter(q => q.primary_type === 'SPENDING_BASED') || [];

        spendingQuestions.forEach(q => {
            const responses = this.extractQuestionResponses(surveyData, q.question_id);
            const spendingPattern = this.analyzeSpendingDistribution(responses, q);
            
            patterns.direct_spending_indicators.push({
                question_id: q.question_id,
                spending_levels: spendingPattern.levels,
                distribution: spendingPattern.distribution,
                outliers: spendingPattern.outliers,
                behavioral_context: q.behavioral_insight
            });
        });

        // Find indirect spending signals (values and behaviors that correlate with spending)
        const indirectIndicators = stage1Results.discriminatory_questions
            ?.filter(q => q.primary_type !== 'SPENDING_BASED' && 
                         q.spending_correlation === 'HIGH') || [];

        indirectIndicators.forEach(q => {
            patterns.indirect_spending_signals.push({
                question_id: q.question_id,
                signal_type: q.primary_type,
                correlation_mechanism: q.behavioral_insight,
                predictive_power: q.statistical_metrics?.archetype_discriminatory_power
            });
        });

        return patterns;
    }

    /**
     * Identify behavioral clusters in the data
     */
    identifyBehavioralClusters(stage1Results, surveyData) {
        const clusters = {
            value_driven_clusters: [],
            behavior_driven_clusters: [],
            hybrid_clusters: [],
            cluster_statistics: {}
        };

        // Group questions by behavioral themes
        const behaviorQuestions = stage1Results.discriminatory_questions
            ?.filter(q => q.primary_type === 'BEHAVIOR_BASED') || [];
        
        const valueQuestions = stage1Results.discriminatory_questions
            ?.filter(q => q.primary_type === 'VALUES_BASED') || [];

        // Analyze behavioral clusters
        const behaviorThemes = this.groupQuestionsByTheme(behaviorQuestions);
        Object.entries(behaviorThemes).forEach(([theme, questions]) => {
            const clusterAnalysis = this.analyzeThemeCluster(questions, surveyData, 'behavior');
            clusters.behavior_driven_clusters.push({
                theme: theme,
                questions: questions.map(q => q.question_id),
                cluster_size: clusterAnalysis.size,
                internal_consistency: clusterAnalysis.consistency,
                spending_correlation: clusterAnalysis.spendingCorrelation,
                key_differentiators: clusterAnalysis.differentiators
            });
        });

        // Analyze value clusters
        const valueThemes = this.groupQuestionsByTheme(valueQuestions);
        Object.entries(valueThemes).forEach(([theme, questions]) => {
            const clusterAnalysis = this.analyzeThemeCluster(questions, surveyData, 'values');
            clusters.value_driven_clusters.push({
                theme: theme,
                questions: questions.map(q => q.question_id),
                cluster_size: clusterAnalysis.size,
                internal_consistency: clusterAnalysis.consistency,
                spending_correlation: clusterAnalysis.spendingCorrelation,
                psychological_drivers: clusterAnalysis.psychologyDrivers
            });
        });

        return clusters;
    }

    /**
     * Group questions by their specific themes
     */
    groupQuestionsByTheme(questions) {
        const themes = {};
        
        questions.forEach(q => {
            const theme = q.specific_theme || 'general';
            if (!themes[theme]) {
                themes[theme] = [];
            }
            themes[theme].push(q);
        });
        
        return themes;
    }

    /**
     * Analyze a cluster of questions around a theme
     */
    analyzeThemeCluster(questions, surveyData, clusterType) {
        const questionIds = questions.map(q => q.question_id);
        const responses = this.extractMultipleQuestionResponses(surveyData, questionIds);
        
        return {
            size: questions.length,
            consistency: this.calculateInternalConsistency(responses),
            spendingCorrelation: this.calculateClusterSpendingCorrelation(questions),
            differentiators: this.identifyKeyDifferentiators(questions, responses),
            psychologyDrivers: clusterType === 'values' ? 
                this.identifyPsychologyDrivers(questions) : null
        };
    }

    /**
     * Calculate internal consistency of question cluster
     */
    calculateInternalConsistency(responses) {
        if (responses.length < 2) return 1.0;
        
        const questionIds = Object.keys(responses[0] || {});
        if (questionIds.length < 2) return 1.0;
        
        let totalCorrelations = 0;
        let correlationCount = 0;
        
        for (let i = 0; i < questionIds.length; i++) {
            for (let j = i + 1; j < questionIds.length; j++) {
                const correlation = this.calculateQuestionCorrelation(
                    responses, questionIds[i], questionIds[j]
                );
                
                if (!isNaN(correlation)) {
                    totalCorrelations += Math.abs(correlation);
                    correlationCount++;
                }
            }
        }
        
        return correlationCount > 0 ? totalCorrelations / correlationCount : 0;
    }

    /**
     * Calculate correlation between two questions in response set
     */
    calculateQuestionCorrelation(responses, questionA, questionB) {
        const xValues = responses.map(r => r[questionA]).filter(v => v != null);
        const yValues = responses.map(r => r[questionB]).filter(v => v != null);
        
        if (xValues.length < 2 || yValues.length < 2) return NaN;
        
        // Convert to numeric if possible
        const xNumeric = xValues.map(v => typeof v === 'number' ? v : parseFloat(v)).filter(v => !isNaN(v));
        const yNumeric = yValues.map(v => typeof v === 'number' ? v : parseFloat(v)).filter(v => !isNaN(v));
        
        if (xNumeric.length === xValues.length && yNumeric.length === yValues.length) {
            return this.pearsonCorrelation(xNumeric, yNumeric);
        }
        
        // For categorical data, use contingency-based correlation
        return this.categoricalCorrelation(xValues, yValues);
    }

    /**
     * Pearson correlation for numeric data
     */
    pearsonCorrelation(x, y) {
        const n = Math.min(x.length, y.length);
        if (n < 2) return NaN;
        
        const xSlice = x.slice(0, n);
        const ySlice = y.slice(0, n);
        
        const sumX = xSlice.reduce((a, b) => a + b, 0);
        const sumY = ySlice.reduce((a, b) => a + b, 0);
        const sumXY = xSlice.reduce((sum, xi, i) => sum + xi * ySlice[i], 0);
        const sumXX = xSlice.reduce((sum, x) => sum + x * x, 0);
        const sumYY = ySlice.reduce((sum, y) => sum + y * y, 0);
        
        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
        
        return denominator === 0 ? 0 : numerator / denominator;
    }

    /**
     * Categorical correlation (Cramér's V approximation)
     */
    categoricalCorrelation(x, y) {
        // Simple implementation - could be enhanced with proper Cramér's V
        const xUnique = [...new Set(x)];
        const yUnique = [...new Set(y)];
        
        if (xUnique.length === 1 || yUnique.length === 1) return 0;
        
        // Calculate contingency table
        const contingency = {};
        x.forEach((xi, i) => {
            const yi = y[i];
            if (!contingency[xi]) contingency[xi] = {};
            contingency[xi][yi] = (contingency[xi][yi] || 0) + 1;
        });
        
        // Simplified correlation measure
        let maxAssociation = 0;
        xUnique.forEach(xi => {
            yUnique.forEach(yi => {
                const observed = contingency[xi]?.[yi] || 0;
                const expected = x.filter(v => v === xi).length * y.filter(v => v === yi).length / x.length;
                const association = expected > 0 ? Math.abs(observed - expected) / expected : 0;
                maxAssociation = Math.max(maxAssociation, association);
            });
        });
        
        return Math.min(1, maxAssociation);
    }

    /**
     * Extract responses for a single question
     */
    extractQuestionResponses(surveyData, questionId) {
        if (!surveyData.responses) return [];
        
        return surveyData.responses
            .map(response => response[questionId])
            .filter(value => value != null);
    }

    /**
     * Extract responses for multiple questions
     */
    extractMultipleQuestionResponses(surveyData, questionIds) {
        if (!surveyData.responses) return [];
        
        return surveyData.responses.map(response => {
            const filtered = {};
            questionIds.forEach(id => {
                if (response[id] != null) {
                    filtered[id] = response[id];
                }
            });
            return Object.keys(filtered).length > 0 ? filtered : null;
        }).filter(response => response != null);
    }

    /**
     * Analyze spending distribution patterns
     */
    analyzeSpendingDistribution(responses, questionInfo) {
        if (responses.length === 0) {
            return { levels: [], distribution: {}, outliers: [] };
        }

        // Convert to numeric values
        const numericResponses = responses
            .map(r => typeof r === 'number' ? r : parseFloat(r))
            .filter(r => !isNaN(r))
            .sort((a, b) => a - b);

        if (numericResponses.length === 0) {
            // Handle categorical spending data
            const distribution = {};
            responses.forEach(r => {
                distribution[r] = (distribution[r] || 0) + 1;
            });
            
            return {
                levels: Object.keys(distribution).sort(),
                distribution: distribution,
                outliers: []
            };
        }

        // Numeric spending analysis
        const q1Index = Math.floor(numericResponses.length * 0.25);
        const q3Index = Math.floor(numericResponses.length * 0.75);
        const q1 = numericResponses[q1Index];
        const q3 = numericResponses[q3Index];
        const iqr = q3 - q1;
        
        const outliers = numericResponses.filter(r => 
            r < q1 - 1.5 * iqr || r > q3 + 1.5 * iqr
        );

        return {
            levels: ['low', 'medium', 'high'],
            distribution: {
                low: numericResponses.filter(r => r <= q1).length,
                medium: numericResponses.filter(r => r > q1 && r <= q3).length,
                high: numericResponses.filter(r => r > q3).length
            },
            outliers: outliers,
            statistics: {
                median: numericResponses[Math.floor(numericResponses.length / 2)],
                q1: q1,
                q3: q3,
                iqr: iqr
            }
        };
    }

    /**
     * Calculate cluster's correlation with spending behavior
     */
    calculateClusterSpendingCorrelation(questions) {
        const spendingCorrelations = questions
            .map(q => q.spending_correlation)
            .filter(corr => corr !== undefined);
        
        if (spendingCorrelations.length === 0) return 'UNKNOWN';
        
        const highCount = spendingCorrelations.filter(c => c === 'HIGH').length;
        const mediumCount = spendingCorrelations.filter(c => c === 'MEDIUM').length;
        
        if (highCount / spendingCorrelations.length > 0.6) return 'HIGH';
        if ((highCount + mediumCount) / spendingCorrelations.length > 0.5) return 'MEDIUM';
        return 'LOW';
    }

    /**
     * Identify key differentiators in question cluster
     */
    identifyKeyDifferentiators(questions, responses) {
        return questions
            .filter(q => q.statistical_metrics?.archetype_discriminatory_power === 'HIGH')
            .map(q => ({
                question_id: q.question_id,
                differentiating_factor: q.behavioral_insight,
                statistical_power: q.statistical_metrics?.expected_response_spread
            }))
            .slice(0, 3); // Top 3 differentiators
    }

    /**
     * Identify psychological drivers for value-based clusters
     */
    identifyPsychologyDrivers(questions) {
        const drivers = questions
            .filter(q => q.primary_type === 'VALUES_BASED')
            .map(q => q.specific_theme)
            .filter(theme => theme && theme !== 'general');
        
        return [...new Set(drivers)]; // Remove duplicates
    }

    /**
     * Categorize correlation significance
     */
    categorizeCorrelationSignificance(absoluteCorrelation) {
        if (absoluteCorrelation >= 0.7) return 'very_strong';
        if (absoluteCorrelation >= 0.5) return 'strong';
        if (absoluteCorrelation >= 0.3) return 'moderate';
        return 'weak';
    }

    /**
     * Validate pain/pleasure points against statistical evidence
     */
    async validatePainPleasurePoints(analysisResult, surveyData) {
        const validatedPoints = [];
        
        for (const point of analysisResult.pain_pleasure_points || []) {
            const validation = await this.validateSinglePoint(point, surveyData);
            validatedPoints.push({
                ...point,
                statistical_validation: validation,
                confidence_score: this.calculatePointConfidence(point, validation)
            });
        }
        
        return {
            ...analysisResult,
            pain_pleasure_points: validatedPoints
        };
    }

    /**
     * Validate a single pain/pleasure point
     */
    async validateSinglePoint(point, surveyData) {
        const validation = {
            sample_size_adequacy: 'UNKNOWN',
            effect_size: 'UNKNOWN',
            statistical_significance: 'UNKNOWN',
            practical_significance: 'UNKNOWN'
        };

        // Check if we have supporting questions in survey data
        const supportingQuestions = point.supporting_questions || [];
        const availableData = supportingQuestions.filter(qId => 
            surveyData.responses?.some(r => r[qId] != null)
        );
        
        if (availableData.length === 0) {
            validation.sample_size_adequacy = 'INSUFFICIENT_DATA';
            return validation;
        }
        
        // Calculate sample size adequacy
        const totalResponses = surveyData.responses?.length || 0;
        validation.sample_size_adequacy = totalResponses >= 30 ? 'ADEQUATE' : 'LIMITED';
        
        // Estimate effect size based on correlation strength
        if (point.correlation_strength) {
            const strength = point.correlation_strength.toLowerCase();
            if (strength.includes('strong') || strength.includes('high')) {
                validation.effect_size = 'LARGE';
            } else if (strength.includes('medium') || strength.includes('moderate')) {
                validation.effect_size = 'MEDIUM';
            } else {
                validation.effect_size = 'SMALL';
            }
        }
        
        // Assess practical significance
        if (point.behavioral_impact && point.behavioral_impact.includes('spending')) {
            validation.practical_significance = 'HIGH';
        } else if (point.behavioral_impact) {
            validation.practical_significance = 'MEDIUM';
        }
        
        return validation;
    }

    /**
     * Calculate confidence score for a pain/pleasure point
     */
    calculatePointConfidence(point, validation) {
        let confidence = 0.5; // Base confidence
        
        // Adjust for statistical validation
        if (validation.sample_size_adequacy === 'ADEQUATE') confidence += 0.2;
        if (validation.effect_size === 'LARGE') confidence += 0.15;
        else if (validation.effect_size === 'MEDIUM') confidence += 0.1;
        
        if (validation.practical_significance === 'HIGH') confidence += 0.15;
        else if (validation.practical_significance === 'MEDIUM') confidence += 0.1;
        
        // Adjust for evidence strength
        if (point.evidence_strength === 'STRONG') confidence += 0.1;
        else if (point.evidence_strength === 'MEDIUM') confidence += 0.05;
        
        return Math.min(1.0, Math.max(0.0, confidence));
    }

    /**
     * Build evidence matrix linking points to statistical data
     */
    buildEvidenceMatrix(analysisResult, stage1Results) {
        const matrix = {};
        
        (analysisResult.pain_pleasure_points || []).forEach(point => {
            matrix[point.point_id] = {
                statistical_backing: this.findStatisticalBacking(point, stage1Results),
                correlation_evidence: this.findCorrelationEvidence(point, stage1Results),
                survey_coverage: this.calculateSurveyCoverage(point, stage1Results),
                validation_metrics: point.statistical_validation
            };
        });
        
        return matrix;
    }

    /**
     * Find statistical backing for a pain/pleasure point
     */
    findStatisticalBacking(point, stage1Results) {
        const supportingQuestions = point.supporting_questions || [];
        const backing = [];
        
        supportingQuestions.forEach(questionId => {
            const question = stage1Results.discriminatory_questions
                ?.find(q => q.question_id === questionId);
            
            if (question) {
                backing.push({
                    question_id: questionId,
                    discriminatory_power: question.statistical_metrics?.archetype_discriminatory_power,
                    spending_correlation: question.spending_correlation,
                    variance_metrics: stage1Results.variance_analysis?.[questionId]
                });
            }
        });
        
        return backing;
    }

    /**
     * Find correlation evidence for a pain/pleasure point
     */
    findCorrelationEvidence(point, stage1Results) {
        const supportingQuestions = point.supporting_questions || [];
        const correlations = [];
        
        const correlationMatrix = stage1Results.correlation_matrix || {};
        
        supportingQuestions.forEach(questionA => {
            if (correlationMatrix[questionA]) {
                Object.entries(correlationMatrix[questionA]).forEach(([questionB, correlation]) => {
                    correlations.push({
                        question_pair: [questionA, questionB],
                        correlation_strength: correlation,
                        correlation_magnitude: Math.abs(correlation),
                        correlation_report: `r = ${correlation.toFixed(2)}`,
                        significance: this.categorizeCorrelationSignificance(Math.abs(correlation))
                    });
                });
            }
        });
        
        // Sort by correlation magnitude and return top 3-4
        return correlations
            .sort((a, b) => b.correlation_magnitude - a.correlation_magnitude)
            .slice(0, 4);
    }

    /**
     * Calculate survey coverage for a pain/pleasure point
     */
    calculateSurveyCoverage(point, stage1Results) {
        const supportingQuestions = point.supporting_questions || [];
        const totalQuestions = stage1Results.discriminatory_questions?.length || 0;
        
        if (totalQuestions === 0) return 0;
        
        return supportingQuestions.length / totalQuestions;
    }

    /**
     * Calculate validation metrics for the entire analysis
     */
    calculateValidationMetrics(analysisResult, surveyData) {
        const points = analysisResult.pain_pleasure_points || [];
        
        if (points.length === 0) {
            return { overall_confidence: 0, validation_issues: ['No pain/pleasure points identified'] };
        }
        
        const confidenceScores = points.map(p => p.confidence_score).filter(s => s != null);
        const overallConfidence = confidenceScores.length > 0 ? 
            confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length : 0;
        
        const validationIssues = [];
        const totalResponses = surveyData.responses?.length || 0;
        
        if (totalResponses < 30) {
            validationIssues.push('Limited sample size may affect reliability');
        }
        
        const lowConfidencePoints = points.filter(p => p.confidence_score < 0.6).length;
        if (lowConfidencePoints > points.length * 0.5) {
            validationIssues.push('High proportion of low-confidence insights');
        }
        
        return {
            overall_confidence: overallConfidence,
            validation_issues: validationIssues,
            points_analyzed: points.length,
            high_confidence_points: points.filter(p => p.confidence_score >= 0.8).length,
            medium_confidence_points: points.filter(p => p.confidence_score >= 0.6 && p.confidence_score < 0.8).length,
            low_confidence_points: lowConfidencePoints
        };
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
            console.error('Failed to parse pain/pleasure analysis response:', error);
            console.error('Raw response:', responseText);
            throw new Error(`Failed to parse behavioral analysis: ${error.message}`);
        }
    }

    /**
     * Validate the analysis response structure
     */
    validateAnalysisResponse(parsed) {
        const required = ['behavioral_analysis', 'pain_pleasure_points', 'statistical_insights'];
        
        required.forEach(field => {
            if (!parsed[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        });
        
        if (!Array.isArray(parsed.pain_pleasure_points)) {
            throw new Error('pain_pleasure_points must be an array');
        }
        
        // Validate each pain/pleasure point
        parsed.pain_pleasure_points.forEach((point, index) => {
            if (!point.point_id || !point.type || !point.description) {
                throw new Error(`Invalid pain/pleasure point structure at index ${index}`);
            }
        });
    }

    /**
     * Get the current analysis results
     */
    getAnalysisResults() {
        return this.analysisResults;
    }

    /**
     * Export results for use in Stage 3
     */
    exportForStage3() {
        if (!this.analysisResults) {
            throw new Error('No analysis results available. Run identifyPainPleasurePoints first.');
        }

        return {
            pain_pleasure_points: this.analysisResults.pain_pleasure_points,
            behavioral_insights: this.analysisResults.behavioral_analysis,
            evidence_matrix: this.analysisResults.evidence_matrix,
            statistical_validation: this.analysisResults.statistical_validation,
            correlation_patterns: this.analysisResults.correlation_insights,
            confidence_metrics: {
                overall_confidence: this.analysisResults.statistical_validation?.overall_confidence,
                high_confidence_points: this.analysisResults.pain_pleasure_points
                    ?.filter(p => p.confidence_score >= 0.8).length || 0,
                total_points: this.analysisResults.pain_pleasure_points?.length || 0
            },
            stage1_reference: this.analysisResults.stage1_reference,
            timestamp: this.analysisResults.timestamp
        };
    }
}

export default PainPleasureAnalyst;