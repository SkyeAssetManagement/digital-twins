/**
 * Phase 3D: ROI-Focused Target Identification + Pain/Pleasure Categorization
 * 
 * Dual-layer analysis system that identifies top 5 revenue-impacting targets 
 * and categorizes all features psychologically as Pain/Pleasure/Other.
 * 
 * Key Features:
 * - ROI target identification focusing on purchase intent, spending, conversion probability
 * - Psychological categorization of all survey features as Pain/Pleasure/Other
 * - Strategic insight generation for market psychology understanding
 * - Business-focused recommendations for marketing strategy optimization
 * - Integration with ML pipeline for feature importance analysis
 * 
 * Business Value:
 * - Identifies highest-impact business targets for focused analysis
 * - Determines if market is pain-driven vs aspiration-driven
 * - Provides actionable marketing insights based on psychological drivers
 * - Optimizes feature selection for ML models on business-relevant targets
 */

export class ROITargetAnalyzer {
    constructor(options = {}) {
        this.options = {
            // API configuration
            apiKey: options.apiKey || process.env.ANTHROPIC_API_KEY,
            model: options.model || 'claude-opus-4-1-20250805',
            
            // Target identification parameters
            maxROITargets: options.maxROITargets || 5,
            minBusinessImpactScore: options.minBusinessImpactScore || 0.7,
            
            // Pain/Pleasure categorization
            painPleasureThreshold: options.painPleasureThreshold || 0.8,
            includeNeutralCategory: options.includeNeutralCategory !== false,
            
            // Strategic analysis
            enableMarketPsychologyAnalysis: options.enableMarketPsychologyAnalysis !== false,
            enableInsightGeneration: options.enableInsightGeneration !== false,
            
            // Processing options
            enableCaching: options.enableCaching !== false,
            maxRetries: options.maxRetries || 3,
            timeoutMs: options.timeoutMs || 45000
        };
        
        this.cache = new Map();
        this.analysisHistory = [];
    }
    
    /**
     * Main entry point - performs dual-layer ROI target and Pain/Pleasure analysis
     * 
     * @param {string} surveyId - Survey identifier
     * @param {Array} surveyColumns - All survey columns with metadata
     * @param {Array} sampleResponses - Sample responses for analysis
     * @param {Object} context - Survey context and business information
     * @returns {Object} Complete analysis results with targets and categorization
     */
    async performDualLayerAnalysis(surveyId, surveyColumns, sampleResponses, context = {}) {
        const startTime = Date.now();
        
        console.log(`Starting Phase 3D dual-layer analysis for survey: ${surveyId}`);
        console.log(`Analyzing ${surveyColumns.length} columns with ${sampleResponses.length} sample responses`);
        console.log(`Business focus: ${context.business_description || 'Not specified'}`);
        
        try {
            // Layer 1: ROI-Focused Target Identification
            console.log('Layer 1: Identifying top ROI targets...');
            const roiTargets = await this.identifyROITargets(surveyColumns, context);
            
            // Layer 2: Pain/Pleasure/Other Categorization of ALL features
            console.log('Layer 2: Categorizing all features as Pain/Pleasure/Other...');
            const painPleasureCategorization = await this.categorizePainPleasureOther(
                surveyColumns, 
                sampleResponses, 
                context
            );
            
            // Strategic Insight Generation
            console.log('Generating strategic insights...');
            const strategicInsights = await this.generateStrategicInsights(
                roiTargets,
                painPleasureCategorization,
                sampleResponses,
                context
            );
            
            // Market Psychology Analysis
            const marketPsychology = await this.analyzeMarketPsychology(
                painPleasureCategorization,
                strategicInsights,
                context
            );
            
            const processingTime = Date.now() - startTime;
            
            const results = {
                surveyId,
                analysis: {
                    roiTargets: roiTargets,
                    painPleasureCategories: painPleasureCategorization,
                    strategicInsights: strategicInsights,
                    marketPsychology: marketPsychology
                },
                summary: {
                    topROITargets: roiTargets.slice(0, this.options.maxROITargets),
                    totalColumnsAnalyzed: surveyColumns.length,
                    painFeatures: painPleasureCategorization.pain.length,
                    pleasureFeatures: painPleasureCategorization.pleasure.length,
                    otherFeatures: painPleasureCategorization.other.length,
                    marketDominantPsychology: marketPsychology.dominantPsychology,
                    keyBusinessInsights: strategicInsights.slice(0, 3)
                },
                statistics: {
                    processingTimeMs: processingTime,
                    llmCallsMade: this.getTotalLLMCalls(),
                    estimatedCost: this.estimateCost(),
                    cacheHitRate: this.getCacheHitRate()
                },
                recommendations: this.generateBusinessRecommendations(roiTargets, marketPsychology, strategicInsights)
            };
            
            console.log(`Phase 3D dual-layer analysis completed in ${processingTime}ms`);
            console.log(`Identified ${roiTargets.length} ROI targets, ${painPleasureCategorization.pain.length} pain features, ${painPleasureCategorization.pleasure.length} pleasure features`);
            console.log(`Market psychology: ${marketPsychology.dominantPsychology} (${(marketPsychology.dominantPercentage * 100).toFixed(1)}%)`);
            
            return results;
            
        } catch (error) {
            console.error('ROI Target Analysis failed:', error);
            throw new Error(`Dual-layer analysis failed: ${error.message}`);
        }
    }
    
    /**
     * Layer 1: Identify top 5 ROI/purchase propensity targets
     */
    async identifyROITargets(surveyColumns, context) {
        const cacheKey = `roi_targets_${this.hashContext(context, surveyColumns)}`;
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;
        
        const prompt = this.buildROITargetPrompt(surveyColumns, context);
        
        try {
            const response = await this.callLLM(prompt, {
                temperature: 0.1,
                max_tokens: 3000
            });
            
            const targets = this.parseROITargetsResponse(response);
            
            // Validate and score targets
            const validatedTargets = this.validateAndScoreTargets(targets, context);
            
            this.setCache(cacheKey, validatedTargets);
            return validatedTargets;
            
        } catch (error) {
            throw new Error(`ROI target identification failed: ${error.message}`);
        }
    }
    
    /**
     * Layer 2: Categorize ALL features as Pain/Pleasure/Other
     */
    async categorizePainPleasureOther(surveyColumns, sampleResponses, context) {
        const cacheKey = `pain_pleasure_${this.hashContext(context, surveyColumns)}`;
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;
        
        // Process columns in batches for efficiency
        const batchSize = 15;
        const batches = [];
        
        for (let i = 0; i < surveyColumns.length; i += batchSize) {
            batches.push(surveyColumns.slice(i, i + batchSize));
        }
        
        const allCategorizations = {
            pain: [],
            pleasure: [],
            other: []
        };
        
        for (const [batchIndex, batch] of batches.entries()) {
            console.log(`Processing Pain/Pleasure batch ${batchIndex + 1}/${batches.length} (${batch.length} columns)`);
            
            const prompt = this.buildPainPleasurePrompt(batch, sampleResponses, context);
            
            try {
                const response = await this.callLLM(prompt, {
                    temperature: 0.0,
                    max_tokens: 2500
                });
                
                const batchResults = this.parsePainPleasureResponse(response, batch);
                
                // Merge results
                allCategorizations.pain.push(...batchResults.pain);
                allCategorizations.pleasure.push(...batchResults.pleasure);
                allCategorizations.other.push(...batchResults.other);
                
            } catch (error) {
                console.error(`Pain/Pleasure batch ${batchIndex + 1} failed:`, error);
                // Continue with next batch
            }
        }
        
        this.setCache(cacheKey, allCategorizations);
        return allCategorizations;
    }
    
    /**
     * Generate strategic insights from analysis results
     */
    async generateStrategicInsights(roiTargets, painPleasureCategories, sampleResponses, context) {
        const prompt = this.buildStrategicInsightsPrompt(roiTargets, painPleasureCategories, context);
        
        try {
            const response = await this.callLLM(prompt, {
                temperature: 0.2,
                max_tokens: 2000
            });
            
            const insights = this.parseStrategicInsights(response);
            return this.validateInsights(insights, context);
            
        } catch (error) {
            console.error('Strategic insight generation failed:', error);
            return this.generateFallbackInsights(roiTargets, painPleasureCategories);
        }
    }
    
    /**
     * Analyze market psychology to determine pain vs pleasure orientation
     */
    async analyzeMarketPsychology(painPleasureCategories, strategicInsights, context) {
        const totalPainFeatures = painPleasureCategories.pain.length;
        const totalPleasureFeatures = painPleasureCategories.pleasure.length;
        const totalFeatures = totalPainFeatures + totalPleasureFeatures + painPleasureCategories.other.length;
        
        const painPercentage = totalPainFeatures / (totalPainFeatures + totalPleasureFeatures);
        const pleasurePercentage = totalPleasureFeatures / (totalPainFeatures + totalPleasureFeatures);
        
        let dominantPsychology;
        let dominantPercentage;
        let marketingStrategy;
        
        if (painPercentage > 0.6) {
            dominantPsychology = 'pain-driven';
            dominantPercentage = painPercentage;
            marketingStrategy = 'Lead with problem-solving, then benefits. Focus on reducing friction and addressing concerns.';
        } else if (pleasurePercentage > 0.6) {
            dominantPsychology = 'aspiration-driven';
            dominantPercentage = pleasurePercentage;
            marketingStrategy = 'Lead with benefits and positive outcomes. Focus on enhancement and achievement.';
        } else {
            dominantPsychology = 'balanced';
            dominantPercentage = Math.max(painPercentage, pleasurePercentage);
            marketingStrategy = 'Balanced approach addressing both pain points and positive outcomes equally.';
        }
        
        return {
            dominantPsychology,
            dominantPercentage,
            painPercentage,
            pleasurePercentage,
            marketingStrategy,
            psychologyBreakdown: {
                pain_features: totalPainFeatures,
                pleasure_features: totalPleasureFeatures,
                neutral_features: painPleasureCategories.other.length,
                total_features: totalFeatures
            },
            businessImplications: this.generatePsychologyImplications(
                dominantPsychology, 
                painPercentage, 
                pleasurePercentage, 
                context
            )
        };
    }
    
    /**
     * Build prompts for different analysis stages
     */
    
    buildROITargetPrompt(surveyColumns, context) {
        const columnList = surveyColumns
            .map(col => `${col.column_name}: ${col.data_type || 'text'} (${col.sample_values?.slice(0, 3).join(', ') || 'no samples'})`)
            .join('\n');
        
        return `As a business analyst specializing in revenue optimization, identify the top 5 survey questions most likely to predict purchase intent, customer lifetime value, or revenue impact.

SURVEY CONTEXT:
Business: ${context.business_description || 'Consumer research'}
Target Market: ${context.target_demographic || 'General consumers'}
Dataset: ${context.dataset_name || 'Survey data'}

AVAILABLE SURVEY COLUMNS:
${columnList}

ANALYSIS REQUIREMENTS:
Focus on identifying questions that predict:
1. Purchase intent or likelihood to buy
2. Spending amount or budget willingness
3. Customer lifetime value indicators
4. Conversion probability factors
5. Revenue-driving behaviors

For each identified ROI target, provide:
- column_name: Exact column name from the list
- roi_type: purchase_intent, spending_amount, customer_ltv, conversion_probability, or revenue_behavior
- business_impact_score: 0.0-1.0 score for revenue impact potential
- reasoning: Why this column predicts revenue outcomes
- ml_target_suitability: How suitable this is as an ML prediction target (0.0-1.0)

Respond with JSON array of target objects, ranked by business_impact_score (highest first).`;
    }
    
    buildPainPleasurePrompt(columnBatch, sampleResponses, context) {
        const columnList = columnBatch
            .map(col => `${col.column_name}: ${col.data_type || 'text'}`)
            .join('\n');
        
        const sampleText = sampleResponses.slice(0, 10)
            .map(r => `"${r.text.substring(0, 100)}..."`)
            .join('\n');
        
        return `As a consumer psychology expert, categorize these survey questions as Pain, Pleasure, or Other based on what psychological drivers they measure.

CONTEXT:
Business: ${context.business_description || 'Consumer research'}
Target Market: ${context.target_demographic || 'General consumers'}

SAMPLE RESPONSES (for context):
${sampleText}

SURVEY COLUMNS TO CATEGORIZE:
${columnList}

CATEGORIZATION DEFINITIONS:
- PAIN: Problems, frustrations, fears, barriers, concerns, dissatisfactions, difficulties, complaints
- PLEASURE: Benefits, desires, aspirations, positive outcomes, enjoyment, satisfaction, achievements
- OTHER: Demographics, neutral behaviors, preferences without emotional charge, factual information

For each column, determine:
1. The primary psychological driver it measures
2. Whether responses typically express pain points or pleasure points
3. The emotional charge of typical responses

Respond in JSON format:
{
    "pain": [
        {
            "column_name": "...",
            "reasoning": "Why this measures pain points",
            "confidence": 0.9
        }
    ],
    "pleasure": [...],
    "other": [...]
}`;
    }
    
    buildStrategicInsightsPrompt(roiTargets, painPleasureCategories, context) {
        const topTargets = roiTargets.slice(0, 5)
            .map(t => `${t.column_name} (${t.roi_type})`)
            .join(', ');
        
        return `Based on this ROI target analysis and psychological categorization, generate strategic business insights.

BUSINESS CONTEXT:
${context.business_description || 'Consumer research'}
Target Market: ${context.target_demographic || 'General consumers'}

TOP ROI TARGETS: ${topTargets}

PSYCHOLOGICAL BREAKDOWN:
- Pain features: ${painPleasureCategories.pain.length}
- Pleasure features: ${painPleasureCategories.pleasure.length}
- Other features: ${painPleasureCategories.other.length}

Generate 5-7 strategic insights that connect the psychological drivers to business outcomes. Focus on:
1. How pain vs pleasure orientation affects marketing strategy
2. Which ROI targets align with the dominant psychology
3. Specific tactical recommendations for messaging and positioning
4. Customer journey optimization based on psychological drivers
5. Product/service improvement opportunities

Each insight should be:
- Specific and actionable
- Connected to revenue impact
- Based on the psychological analysis
- Relevant to the target demographic

Respond with JSON array of insight objects:
[
    {
        "insight": "Specific strategic insight",
        "category": "marketing|product|customer_experience|pricing|positioning",
        "business_impact": "high|medium|low",
        "implementation_complexity": "low|medium|high",
        "expected_outcome": "What business result to expect"
    }
]`;
    }
    
    /**
     * Parsing and validation methods
     */
    
    parseROITargetsResponse(response) {
        try {
            const parsed = JSON.parse(response);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error('Failed to parse ROI targets response:', error);
            return [];
        }
    }
    
    parsePainPleasureResponse(response, batch) {
        try {
            const parsed = JSON.parse(response);
            return {
                pain: parsed.pain || [],
                pleasure: parsed.pleasure || [],
                other: parsed.other || []
            };
        } catch (error) {
            console.error('Failed to parse Pain/Pleasure response:', error);
            return { pain: [], pleasure: [], other: [] };
        }
    }
    
    parseStrategicInsights(response) {
        try {
            const parsed = JSON.parse(response);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.error('Failed to parse strategic insights:', error);
            return [];
        }
    }
    
    validateAndScoreTargets(targets, context) {
        return targets
            .filter(target => target.column_name && target.roi_type && target.business_impact_score)
            .map(target => ({
                ...target,
                business_impact_score: Math.min(1.0, Math.max(0.0, target.business_impact_score)),
                ml_target_suitability: Math.min(1.0, Math.max(0.0, target.ml_target_suitability || 0.8))
            }))
            .sort((a, b) => b.business_impact_score - a.business_impact_score);
    }
    
    validateInsights(insights, context) {
        return insights.filter(insight => 
            insight.insight && 
            insight.category && 
            insight.business_impact &&
            ['marketing', 'product', 'customer_experience', 'pricing', 'positioning'].includes(insight.category) &&
            ['high', 'medium', 'low'].includes(insight.business_impact)
        );
    }
    
    generateFallbackInsights(roiTargets, painPleasureCategories) {
        const insights = [];
        
        if (painPleasureCategories.pain.length > painPleasureCategories.pleasure.length) {
            insights.push({
                insight: "Market is primarily pain-driven - lead marketing with problem-solving messaging",
                category: "marketing",
                business_impact: "high",
                implementation_complexity: "low",
                expected_outcome: "Improved message resonance and conversion rates"
            });
        } else {
            insights.push({
                insight: "Market is aspiration-driven - emphasize benefits and positive outcomes in messaging",
                category: "marketing", 
                business_impact: "high",
                implementation_complexity: "low",
                expected_outcome: "Enhanced customer engagement and desire"
            });
        }
        
        return insights;
    }
    
    generatePsychologyImplications(psychology, painPercentage, pleasurePercentage, context) {
        const implications = [];
        
        if (psychology === 'pain-driven') {
            implications.push('Focus on problem-solving features and friction reduction');
            implications.push('Use testimonials that emphasize problem resolution');
            implications.push('Lead with "before/after" messaging showing problem elimination');
        } else if (psychology === 'aspiration-driven') {
            implications.push('Emphasize positive outcomes and enhancement benefits');
            implications.push('Use success stories and achievement-focused messaging');
            implications.push('Lead with vision and aspiration in value propositions');
        } else {
            implications.push('Use balanced messaging addressing both problems and benefits');
            implications.push('Segment audiences by pain vs pleasure orientation');
            implications.push('Test both problem-focused and benefit-focused campaigns');
        }
        
        return implications;
    }
    
    generateBusinessRecommendations(roiTargets, marketPsychology, strategicInsights) {
        const recommendations = [];
        
        // ROI target recommendations
        if (roiTargets.length > 0) {
            recommendations.push({
                type: 'roi_focus',
                priority: 'high',
                title: 'Focus ML Analysis on Top ROI Targets',
                description: `Prioritize feature importance analysis on ${roiTargets[0].column_name} and other top ROI targets for maximum business impact.`,
                action: 'Use these targets as primary ML prediction variables'
            });
        }
        
        // Psychology-based recommendations
        if (marketPsychology.dominantPsychology === 'pain-driven') {
            recommendations.push({
                type: 'messaging_strategy',
                priority: 'high',
                title: 'Lead with Problem-Solving Messaging',
                description: `Market is ${(marketPsychology.painPercentage * 100).toFixed(1)}% pain-driven. Prioritize addressing customer problems and reducing friction.`,
                action: 'Restructure messaging to lead with problem identification and solution'
            });
        } else if (marketPsychology.dominantPsychology === 'aspiration-driven') {
            recommendations.push({
                type: 'messaging_strategy', 
                priority: 'high',
                title: 'Emphasize Benefits and Positive Outcomes',
                description: `Market is ${(marketPsychology.pleasurePercentage * 100).toFixed(1)}% aspiration-driven. Focus on benefits, achievements, and positive transformation.`,
                action: 'Lead marketing with benefit-focused and aspirational messaging'
            });
        }
        
        return recommendations;
    }
    
    /**
     * Utility methods
     */
    
    hashContext(context, data) {
        const contextStr = JSON.stringify({
            business: context.business_description,
            demographic: context.target_demographic,
            dataLength: data?.length || 0
        });
        return Buffer.from(contextStr).toString('base64').slice(0, 16);
    }
    
    // Cache management
    getFromCache(key) {
        if (!this.options.enableCaching) return null;
        const item = this.cache.get(key);
        if (item && Date.now() - item.timestamp < 1800000) { // 30 minutes TTL
            return item.data;
        }
        return null;
    }
    
    setCache(key, data) {
        if (this.options.enableCaching) {
            this.cache.set(key, {
                data,
                timestamp: Date.now()
            });
        }
    }
    
    // LLM integration
    async callLLM(prompt, options = {}) {
        // Implementation would call Claude Opus API
        // For now, return placeholder
        throw new Error('LLM integration not implemented in test environment');
    }
    
    // Statistics helpers
    getTotalLLMCalls() { return 0; }
    estimateCost() { return 0; }
    getCacheHitRate() { return 0; }
}