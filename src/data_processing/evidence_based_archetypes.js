/**
 * Stage 3: Marketing Expert - Evidence-Based Archetype Generator
 * Synthesizes statistical analysis and pain/pleasure points into actionable consumer archetypes
 * Maintains complete transparency from data to marketing strategy
 */

import promptLoader from '../prompts/vercel-prompt-loader.js';

class EvidenceBasedArchetypes {
    constructor(claudeClient) {
        this.claudeClient = claudeClient;
        this.analysisResults = null;
        this.stage1Results = null;
        this.stage2Results = null;
    }

    /**
     * Main analysis function for Stage 3
     * @param {Object} stage1Results - Results from Statistical Analyst
     * @param {Object} stage2Results - Results from Pain/Pleasure Analyst
     * @returns {Object} Evidence-based consumer archetypes with marketing strategies
     */
    async generateEvidenceBasedArchetypes(stage1Results, stage2Results) {
        try {
            console.log('Stage 3: Starting evidence-based archetype generation...');
            
            this.stage1Results = stage1Results;
            this.stage2Results = stage2Results;
            
            // Synthesize data from previous stages
            const dataMatrix = this.buildDataSynthesisMatrix(stage1Results, stage2Results);
            const archetypeSeeds = this.identifyArchetypeSeeds(stage1Results, stage2Results);
            const evidenceMapping = this.createEvidenceMapping(stage1Results, stage2Results);
            
            // Build the marketing expert prompt
            const prompt = promptLoader.buildPrompt('prompt_3_MarketingExpert', {
                stage1_statistical_foundation: this.extractStatisticalFoundation(stage1Results),
                pain_pleasure_points: stage2Results.pain_pleasure_points || [],
                behavioral_insights: stage2Results.behavioral_insights || {},
                evidence_matrix: stage2Results.evidence_matrix || {},
                confidence_metrics: stage2Results.confidence_metrics || {}
            });

            // Call Claude API for archetype generation
            const response = await this.claudeClient.messages.create({
                model: 'claude-opus-4-1-20250805',
                max_tokens: 10000,
                temperature: 0.5, // Balanced for creative marketing insights with accuracy
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            });

            // Parse and validate the response
            const analysisResult = this.parseAnalysisResponse(response.content[0].text);
            
            // Enhance with evidence validation and marketing optimization
            const enhancedArchetypes = await this.enhanceArchetypesWithEvidence(analysisResult, dataMatrix);
            const marketingValidation = this.validateMarketingUtility(enhancedArchetypes);
            const implementationGuide = this.buildImplementationGuide(enhancedArchetypes);
            
            // Combine all results
            this.analysisResults = {
                ...enhancedArchetypes,
                evidence_synthesis: dataMatrix,
                archetype_seeds: archetypeSeeds,
                evidence_mapping: evidenceMapping,
                marketing_validation: marketingValidation,
                implementation_guide: implementationGuide,
                data_lineage: {
                    stage1_timestamp: stage1Results.timestamp,
                    stage2_timestamp: stage2Results.timestamp,
                    stage1_confidence: stage1Results.confidence_level,
                    stage2_confidence: stage2Results.statistical_validation?.overall_confidence
                },
                timestamp: new Date().toISOString()
            };

            console.log('Stage 3: Evidence-based archetype generation completed successfully');
            return this.analysisResults;

        } catch (error) {
            console.error('Stage 3 Archetype Generation Error:', error);
            throw new Error(`Evidence-based archetype generation failed: ${error.message}`);
        }
    }

    /**
     * Build data synthesis matrix combining Stage 1 and Stage 2 findings
     */
    buildDataSynthesisMatrix(stage1Results, stage2Results) {
        const matrix = {
            statistical_foundation: {},
            behavioral_evidence: {},
            spending_correlations: {},
            pain_pleasure_mapping: {},
            confidence_alignment: {}
        };

        // Extract statistical foundation
        const discriminatoryQuestions = stage1Results.discriminatory_questions || [];
        discriminatoryQuestions.forEach(question => {
            matrix.statistical_foundation[question.question_id] = {
                discriminatory_power: question.statistical_metrics?.archetype_discriminatory_power,
                spending_correlation: question.spending_correlation,
                statistical_power: question.statistical_power,
                evidence_strength: question.confidence
            };
        });

        // Map pain/pleasure points to statistical evidence
        const painPleasurePoints = stage2Results.pain_pleasure_points || [];
        painPleasurePoints.forEach(point => {
            matrix.pain_pleasure_mapping[point.point_id] = {
                supporting_questions: point.statistical_evidence?.supporting_questions || [],
                correlation_strength: point.statistical_evidence?.correlation_strength,
                confidence_level: point.confidence_level,
                spending_connection: point.spending_connection
            };
        });

        // Analyze confidence alignment between stages
        matrix.confidence_alignment = this.analyzeConfidenceAlignment(stage1Results, stage2Results);

        return matrix;
    }

    /**
     * Identify potential archetype seeds from combined data
     */
    identifyArchetypeSeeds(stage1Results, stage2Results) {
        const seeds = [];
        
        // Identify clusters based on high-confidence discriminatory questions
        const highConfidenceQuestions = stage1Results.discriminatory_questions
            ?.filter(q => q.confidence >= 0.8 && q.statistical_metrics?.archetype_discriminatory_power === 'HIGH') || [];
        
        // Group by behavioral themes
        const behavioralThemes = {};
        highConfidenceQuestions.forEach(q => {
            const theme = q.specific_theme || 'general';
            if (!behavioralThemes[theme]) {
                behavioralThemes[theme] = [];
            }
            behavioralThemes[theme].push(q);
        });

        // Create archetype seeds from behavioral themes + pain/pleasure points
        Object.entries(behavioralThemes).forEach(([theme, questions]) => {
            const relatedPainPleasure = this.findRelatedPainPleasurePoints(questions, stage2Results);
            
            seeds.push({
                seed_id: `archetype_seed_${theme}`,
                behavioral_theme: theme,
                defining_questions: questions.map(q => q.question_id),
                statistical_strength: this.calculateThemeStrength(questions),
                related_pain_points: relatedPainPleasure.pain_points,
                related_pleasure_points: relatedPainPleasure.pleasure_points,
                estimated_population: this.estimatePopulationSize(questions, stage2Results),
                marketing_potential: this.assessMarketingPotential(questions, relatedPainPleasure)
            });
        });

        return seeds.sort((a, b) => b.statistical_strength - a.statistical_strength);
    }

    /**
     * Find pain/pleasure points related to a set of questions
     */
    findRelatedPainPleasurePoints(questions, stage2Results) {
        const questionIds = questions.map(q => q.question_id);
        const painPleasurePoints = stage2Results.pain_pleasure_points || [];
        
        const related = {
            pain_points: [],
            pleasure_points: []
        };
        
        painPleasurePoints.forEach(point => {
            const supportingQuestions = point.statistical_evidence?.supporting_questions || [];
            const overlap = supportingQuestions.filter(qId => questionIds.includes(qId)).length;
            
            if (overlap > 0) {
                const relevanceScore = overlap / supportingQuestions.length;
                
                if (point.type === 'PAIN_POINT') {
                    related.pain_points.push({
                        ...point,
                        relevance_score: relevanceScore
                    });
                } else if (point.type === 'PLEASURE_POINT') {
                    related.pleasure_points.push({
                        ...point,
                        relevance_score: relevanceScore
                    });
                }
            }
        });
        
        return related;
    }

    /**
     * Calculate statistical strength of a behavioral theme
     */
    calculateThemeStrength(questions) {
        if (questions.length === 0) return 0;
        
        const confidenceSum = questions.reduce((sum, q) => sum + (q.confidence || 0), 0);
        const avgConfidence = confidenceSum / questions.length;
        
        const highPowerCount = questions.filter(q => 
            q.statistical_metrics?.archetype_discriminatory_power === 'HIGH'
        ).length;
        
        const powerScore = highPowerCount / questions.length;
        
        return (avgConfidence * 0.6) + (powerScore * 0.4);
    }

    /**
     * Estimate population size for an archetype seed
     */
    estimatePopulationSize(questions, stage2Results) {
        // This is a simplified estimation - in practice, would use actual response distributions
        const avgDiscriminatoryPower = questions.reduce((sum, q) => {
            const power = q.statistical_metrics?.archetype_discriminatory_power;
            return sum + (power === 'HIGH' ? 0.8 : power === 'MEDIUM' ? 0.5 : 0.2);
        }, 0) / questions.length;
        
        // High discriminatory power suggests smaller, more specific segments
        if (avgDiscriminatoryPower > 0.7) return '15-25%';
        if (avgDiscriminatoryPower > 0.5) return '20-35%';
        return '25-45%';
    }

    /**
     * Assess marketing potential of an archetype seed
     */
    assessMarketingPotential(questions, relatedPainPleasure) {
        let potential = 0;
        
        // Higher potential for spending-correlated questions
        const spendingQuestions = questions.filter(q => q.spending_correlation === 'HIGH').length;
        potential += (spendingQuestions / questions.length) * 0.4;
        
        // Higher potential for clear pain/pleasure points
        const totalPainPleasure = relatedPainPleasure.pain_points.length + relatedPainPleasure.pleasure_points.length;
        potential += Math.min(totalPainPleasure / 3, 1) * 0.3;
        
        // Higher potential for high-confidence findings
        const highConfidence = questions.filter(q => q.confidence >= 0.8).length;
        potential += (highConfidence / questions.length) * 0.3;
        
        if (potential >= 0.8) return 'HIGH';
        if (potential >= 0.6) return 'MEDIUM';
        return 'LOW';
    }

    /**
     * Create evidence mapping showing data lineage
     */
    createEvidenceMapping(stage1Results, stage2Results) {
        const mapping = {
            question_to_archetype: {},
            pain_pleasure_to_archetype: {},
            statistical_to_behavioral: {},
            confidence_cascade: {}
        };

        // Map each discriminatory question to its potential archetype influence
        const discriminatoryQuestions = stage1Results.discriminatory_questions || [];
        discriminatoryQuestions.forEach(question => {
            mapping.question_to_archetype[question.question_id] = {
                archetype_influence: question.statistical_metrics?.archetype_discriminatory_power,
                theme_assignment: question.specific_theme,
                spending_relevance: question.spending_correlation,
                confidence_level: question.confidence
            };
        });

        // Map pain/pleasure points to archetype characteristics
        const painPleasurePoints = stage2Results.pain_pleasure_points || [];
        painPleasurePoints.forEach(point => {
            mapping.pain_pleasure_to_archetype[point.point_id] = {
                archetype_characteristic: point.type === 'PAIN_POINT' ? 'constraint_factor' : 'motivational_driver',
                behavioral_impact: point.behavioral_impact,
                marketing_implication: point.marketing_implications,
                supporting_statistics: point.statistical_evidence
            };
        });

        return mapping;
    }

    /**
     * Extract statistical foundation for prompt
     */
    extractStatisticalFoundation(stage1Results) {
        return {
            discriminatory_questions: stage1Results.discriminatory_questions || [],
            correlation_matrix: stage1Results.correlation_matrix || {},
            statistical_overview: stage1Results.statistical_overview || {},
            demographic_context: stage1Results.demographic_context || {}
        };
    }

    /**
     * Analyze confidence alignment between stages
     */
    analyzeConfidenceAlignment(stage1Results, stage2Results) {
        const alignment = {
            overall_alignment: 'UNKNOWN',
            confidence_gaps: [],
            reinforcing_evidence: [],
            conflicting_signals: []
        };

        const stage1Confidence = stage1Results.confidence_level || 0;
        const stage2Confidence = stage2Results.statistical_validation?.overall_confidence || 0;
        
        const confidenceDiff = Math.abs(stage1Confidence - stage2Confidence);
        
        if (confidenceDiff < 0.1) {
            alignment.overall_alignment = 'HIGH';
        } else if (confidenceDiff < 0.2) {
            alignment.overall_alignment = 'MEDIUM';
        } else {
            alignment.overall_alignment = 'LOW';
            alignment.confidence_gaps.push(`Stage 1: ${stage1Confidence.toFixed(2)}, Stage 2: ${stage2Confidence.toFixed(2)}`);
        }

        return alignment;
    }

    /**
     * Enhance archetypes with evidence validation
     */
    async enhanceArchetypesWithEvidence(analysisResult, dataMatrix) {
        const enhancedArchetypes = { ...analysisResult };
        
        if (enhancedArchetypes.archetypes) {
            enhancedArchetypes.archetypes = enhancedArchetypes.archetypes.map(archetype => {
                const evidenceValidation = this.validateArchetypeEvidence(archetype, dataMatrix);
                const marketingOptimization = this.optimizeMarketingStrategy(archetype, dataMatrix);
                
                return {
                    ...archetype,
                    evidence_validation: evidenceValidation,
                    marketing_optimization: marketingOptimization,
                    implementation_priority: this.calculateImplementationPriority(archetype, evidenceValidation)
                };
            });
        }
        
        return enhancedArchetypes;
    }

    /**
     * Validate archetype evidence against statistical foundation
     */
    validateArchetypeEvidence(archetype, dataMatrix) {
        const validation = {
            statistical_backing: 'UNKNOWN',
            evidence_completeness: 0,
            confidence_score: 0,
            validation_issues: []
        };

        // Check if defining questions have statistical backing
        const definingQuestions = archetype.statistical_foundation?.defining_questions || [];
        let backedQuestions = 0;
        
        definingQuestions.forEach(defQuestion => {
            const questionId = defQuestion.question || defQuestion.question_id;
            if (dataMatrix.statistical_foundation[questionId]) {
                backedQuestions++;
            } else {
                validation.validation_issues.push(`Question ${questionId} lacks statistical backing`);
            }
        });
        
        validation.evidence_completeness = definingQuestions.length > 0 ? 
            backedQuestions / definingQuestions.length : 0;
        
        // Assess pain/pleasure point backing
        const painPoints = archetype.pain_pleasure_profile?.primary_pain_points || [];
        const pleasurePoints = archetype.pain_pleasure_profile?.primary_pleasure_points || [];
        
        let backedPainPleasure = 0;
        const totalPainPleasure = painPoints.length + pleasurePoints.length;
        
        [...painPoints, ...pleasurePoints].forEach(point => {
            const pointId = point.pain_point || point.pleasure_point;
            if (dataMatrix.pain_pleasure_mapping[pointId]) {
                backedPainPleasure++;
            }
        });
        
        const painPleasureCompleteness = totalPainPleasure > 0 ? 
            backedPainPleasure / totalPainPleasure : 1;
        
        // Calculate overall confidence
        validation.confidence_score = (validation.evidence_completeness * 0.6) + (painPleasureCompleteness * 0.4);
        
        if (validation.confidence_score >= 0.8) {
            validation.statistical_backing = 'STRONG';
        } else if (validation.confidence_score >= 0.6) {
            validation.statistical_backing = 'MODERATE';
        } else {
            validation.statistical_backing = 'WEAK';
            validation.validation_issues.push('Insufficient statistical evidence for archetype characteristics');
        }
        
        return validation;
    }

    /**
     * Optimize marketing strategy based on evidence
     */
    optimizeMarketingStrategy(archetype, dataMatrix) {
        const optimization = {
            message_optimization: {},
            channel_optimization: {},
            timing_optimization: {},
            budget_allocation: 'UNKNOWN'
        };

        // Optimize messaging based on pain/pleasure evidence strength
        const painPoints = archetype.pain_pleasure_profile?.primary_pain_points || [];
        const pleasurePoints = archetype.pain_pleasure_profile?.primary_pleasure_points || [];
        
        const strongPainPoints = painPoints.filter(p => {
            const pointId = p.pain_point;
            const mapping = dataMatrix.pain_pleasure_mapping[pointId];
            return mapping && mapping.confidence_level >= 0.8;
        });
        
        const strongPleasurePoints = pleasurePoints.filter(p => {
            const pointId = p.pleasure_point;
            const mapping = dataMatrix.pain_pleasure_mapping[pointId];
            return mapping && mapping.confidence_level >= 0.8;
        });
        
        optimization.message_optimization = {
            primary_message_focus: strongPainPoints.length > strongPleasurePoints.length ? 'pain_relief' : 'pleasure_enhancement',
            message_confidence: Math.max(strongPainPoints.length, strongPleasurePoints.length) / 
                               Math.max(painPoints.length + pleasurePoints.length, 1),
            recommended_approach: strongPainPoints.length > 2 ? 'problem_solution' : 'benefit_focused'
        };
        
        return optimization;
    }

    /**
     * Calculate implementation priority for archetype
     */
    calculateImplementationPriority(archetype, evidenceValidation) {
        let priority = 0;
        
        // Higher priority for strong statistical backing
        if (evidenceValidation.statistical_backing === 'STRONG') priority += 0.4;
        else if (evidenceValidation.statistical_backing === 'MODERATE') priority += 0.2;
        
        // Higher priority for larger population
        const populationStr = archetype.population_percentage || '0%';
        const populationNum = parseFloat(populationStr.replace('%', ''));
        if (populationNum >= 25) priority += 0.3;
        else if (populationNum >= 15) priority += 0.2;
        else priority += 0.1;
        
        // Higher priority for clear marketing implications
        const marketingClarity = archetype.campaign_strategy ? 0.3 : 0;
        priority += marketingClarity;
        
        if (priority >= 0.8) return 'HIGH';
        if (priority >= 0.5) return 'MEDIUM';
        return 'LOW';
    }

    /**
     * Validate marketing utility of generated archetypes
     */
    validateMarketingUtility(enhancedArchetypes) {
        const validation = {
            overall_utility: 'UNKNOWN',
            actionability_score: 0,
            differentiation_score: 0,
            coverage_score: 0,
            utility_issues: []
        };

        const archetypes = enhancedArchetypes.archetypes || [];
        
        if (archetypes.length === 0) {
            validation.utility_issues.push('No archetypes generated');
            return validation;
        }

        // Assess actionability
        let actionableArchetypes = 0;
        archetypes.forEach(archetype => {
            if (archetype.campaign_strategy && 
                archetype.marketing_persona && 
                archetype.evidence_validation?.statistical_backing !== 'WEAK') {
                actionableArchetypes++;
            }
        });
        
        validation.actionability_score = actionableArchetypes / archetypes.length;
        
        // Assess differentiation
        const uniqueThemes = new Set();
        archetypes.forEach(archetype => {
            const themes = archetype.statistical_foundation?.defining_questions
                ?.map(q => q.question) || [];
            themes.forEach(theme => uniqueThemes.add(theme));
        });
        
        validation.differentiation_score = Math.min(uniqueThemes.size / (archetypes.length * 2), 1);
        
        // Assess market coverage
        const totalCoverage = archetypes.reduce((sum, archetype) => {
            const percentage = parseFloat((archetype.population_percentage || '0%').replace('%', ''));
            return sum + percentage;
        }, 0);
        
        validation.coverage_score = Math.min(totalCoverage / 100, 1);
        
        // Calculate overall utility
        const overallScore = (validation.actionability_score * 0.4) + 
                           (validation.differentiation_score * 0.3) + 
                           (validation.coverage_score * 0.3);
        
        if (overallScore >= 0.8) {
            validation.overall_utility = 'HIGH';
        } else if (overallScore >= 0.6) {
            validation.overall_utility = 'MEDIUM';
        } else {
            validation.overall_utility = 'LOW';
            validation.utility_issues.push('Archetypes may need refinement for better marketing utility');
        }
        
        return validation;
    }

    /**
     * Build implementation guide for marketing teams
     */
    buildImplementationGuide(enhancedArchetypes) {
        const guide = {
            priority_order: [],
            implementation_phases: [],
            resource_requirements: {},
            success_metrics: {},
            testing_recommendations: []
        };

        const archetypes = enhancedArchetypes.archetypes || [];
        
        // Sort by implementation priority
        const prioritizedArchetypes = archetypes
            .map(archetype => ({
                ...archetype,
                priority_score: this.calculatePriorityScore(archetype)
            }))
            .sort((a, b) => b.priority_score - a.priority_score);
        
        guide.priority_order = prioritizedArchetypes.map(archetype => ({
            archetype_name: archetype.archetype_name,
            implementation_priority: archetype.implementation_priority,
            rationale: this.buildPriorityRationale(archetype)
        }));
        
        // Create implementation phases
        guide.implementation_phases = [
            {
                phase: 'Phase 1 - Foundation',
                archetypes: prioritizedArchetypes.filter(a => a.implementation_priority === 'HIGH').map(a => a.archetype_name),
                timeline: '1-3 months',
                focus: 'Implement highest-confidence, highest-impact archetypes'
            },
            {
                phase: 'Phase 2 - Expansion', 
                archetypes: prioritizedArchetypes.filter(a => a.implementation_priority === 'MEDIUM').map(a => a.archetype_name),
                timeline: '3-6 months',
                focus: 'Add moderate-confidence archetypes with learning from Phase 1'
            },
            {
                phase: 'Phase 3 - Optimization',
                archetypes: prioritizedArchetypes.filter(a => a.implementation_priority === 'LOW').map(a => a.archetype_name),
                timeline: '6+ months',
                focus: 'Refine lower-priority archetypes based on performance data'
            }
        ];
        
        return guide;
    }

    /**
     * Calculate priority score for archetype ordering
     */
    calculatePriorityScore(archetype) {
        let score = 0;
        
        // Evidence strength
        const evidenceScore = archetype.evidence_validation?.confidence_score || 0;
        score += evidenceScore * 0.3;
        
        // Population size
        const populationStr = archetype.population_percentage || '0%';
        const populationNum = parseFloat(populationStr.replace('%', ''));
        score += (populationNum / 100) * 0.3;
        
        // Marketing actionability
        const hasStrategy = archetype.campaign_strategy ? 0.2 : 0;
        const hasPersona = archetype.marketing_persona ? 0.2 : 0;
        score += hasStrategy + hasPersona;
        
        return score;
    }

    /**
     * Build rationale for archetype priority
     */
    buildPriorityRationale(archetype) {
        const rationale = [];
        
        if (archetype.evidence_validation?.statistical_backing === 'STRONG') {
            rationale.push('Strong statistical evidence');
        }
        
        const populationNum = parseFloat((archetype.population_percentage || '0%').replace('%', ''));
        if (populationNum >= 25) {
            rationale.push('Large market segment');
        }
        
        if (archetype.campaign_strategy && archetype.marketing_persona) {
            rationale.push('Clear marketing strategy');
        }
        
        return rationale.join(', ') || 'Standard priority assessment';
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
            console.error('Failed to parse archetype analysis response:', error);
            console.error('Raw response:', responseText);
            throw new Error(`Failed to parse archetype analysis: ${error.message}`);
        }
    }

    /**
     * Validate the analysis response structure
     */
    validateAnalysisResponse(parsed) {
        const required = ['archetype_methodology', 'archetypes'];
        
        required.forEach(field => {
            if (!parsed[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        });
        
        if (!Array.isArray(parsed.archetypes)) {
            throw new Error('archetypes must be an array');
        }
        
        // Validate each archetype
        parsed.archetypes.forEach((archetype, index) => {
            if (!archetype.archetype_name || !archetype.statistical_foundation || !archetype.pain_pleasure_profile) {
                throw new Error(`Invalid archetype structure at index ${index}`);
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
     * Export final results for use in scoring and digital twin systems
     */
    exportForPostAnalysis() {
        if (!this.analysisResults) {
            throw new Error('No analysis results available. Run generateEvidenceBasedArchetypes first.');
        }

        return {
            archetypes: this.analysisResults.archetypes || [],
            implementation_guide: this.analysisResults.implementation_guide,
            marketing_validation: this.analysisResults.marketing_validation,
            evidence_lineage: {
                stage1_foundation: this.stage1Results,
                stage2_insights: this.stage2Results,
                synthesis_matrix: this.analysisResults.evidence_synthesis
            },
            confidence_summary: {
                overall_confidence: this.calculateOverallConfidence(),
                high_priority_archetypes: this.getHighPriorityArchetypes(),
                implementation_readiness: this.assessImplementationReadiness()
            },
            timestamp: this.analysisResults.timestamp
        };
    }

    /**
     * Calculate overall confidence in archetype system
     */
    calculateOverallConfidence() {
        const archetypes = this.analysisResults?.archetypes || [];
        
        if (archetypes.length === 0) return 0;
        
        const confidenceScores = archetypes.map(a => a.evidence_validation?.confidence_score || 0);
        return confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length;
    }

    /**
     * Get high-priority archetypes for immediate implementation
     */
    getHighPriorityArchetypes() {
        const archetypes = this.analysisResults?.archetypes || [];
        return archetypes.filter(a => a.implementation_priority === 'HIGH');
    }

    /**
     * Assess overall implementation readiness
     */
    assessImplementationReadiness() {
        const validation = this.analysisResults?.marketing_validation;
        
        if (!validation) return 'UNKNOWN';
        
        if (validation.overall_utility === 'HIGH' && validation.actionability_score >= 0.8) {
            return 'READY';
        } else if (validation.overall_utility !== 'LOW' && validation.actionability_score >= 0.6) {
            return 'NEARLY_READY';
        } else {
            return 'NEEDS_REFINEMENT';
        }
    }
}

export default EvidenceBasedArchetypes;