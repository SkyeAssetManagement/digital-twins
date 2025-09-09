import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from '../utils/logger.js';
import { AppError, ValidationError } from '../utils/error-handler.js';
import promptLoader from '../prompts/vercel-prompt-loader.js';

const logger = createLogger('ArchetypeGenerator');

export class ArchetypeGenerator {
    constructor() {
        this.anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY
        });
        this.model = 'claude-opus-4-1-20250805';
    }

    async generateArchetypes(surveyData, categorizations, responsePatterns) {
        logger.info(`Generating archetypes for ${categorizations.demographic_analysis.target_demographic}`);

        try {
            const archetypePrompt = this.buildArchetypePrompt(
                categorizations.demographic_analysis,
                categorizations.question_types,
                responsePatterns,
                surveyData.statistics,
                categorizations
            );

            const response = await this.anthropic.messages.create({
                model: this.model,
                max_tokens: 4000,
                temperature: 0.4, // Balanced creativity and consistency
                messages: [{ role: 'user', content: archetypePrompt }]
            });

            const content = response.content[0].text;
            logger.debug('Claude archetype generation response received');

            // Parse JSON response
            let result;
            try {
                const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                result = JSON.parse(cleanContent);
            } catch (parseError) {
                logger.error('Failed to parse Claude response as JSON', { content, parseError });
                throw new AppError(`Invalid JSON response from Claude: ${parseError.message}`);
            }

            // Validate and enhance archetypes
            this.validateArchetypesResponse(result);
            const enhancedArchetypes = await this.enhanceArchetypes(result.archetypes, categorizations.demographic_analysis);

            logger.info(`Successfully generated ${enhancedArchetypes.length} archetypes`);
            return {
                demographic_analysis: categorizations.demographic_analysis,
                archetype_framework: result.archetype_framework,
                archetypes: enhancedArchetypes
            };

        } catch (error) {
            if (error.type === 'rate_limit_error') {
                logger.warn('Rate limited by Claude API, waiting before retry');
                await this.delay(5000);
                return this.generateArchetypes(surveyData, categorizations, responsePatterns);
            }
            
            logger.error('Archetype generation failed', error);
            throw new AppError(`Archetype generation failed: ${error.message}`);
        }
    }

    buildArchetypePrompt(demographicAnalysis, questionTypes, responsePatterns, statistics, categorizations) {
        // Filter and prioritize questions based on statistical analysis
        const highRelevanceQuestions = categorizations?.categorizations.filter(cat => 
            cat.archetype_relevance === 'HIGH' || 
            (cat.statistical_metrics?.archetype_discriminatory_power === 'HIGH')
        ) || [];

        const spendingAnchorQuestions = categorizations?.categorizations.filter(cat => 
            cat.primary_type === 'SPENDING_BASED'
        ) || [];

        const questionTypesText = questionTypes.map(type => 
            `${type.type}: ${type.description}\n  Themes: ${type.specific_themes.join(', ')}\n  Differentiation Potential: ${type.archetype_differentiation_potential || 'Unknown'}\n  Examples: ${type.example_questions.slice(0, 2).join('; ')}`
        ).join('\n\n');

        const statisticalInsights = `
High Discriminatory Questions (${highRelevanceQuestions.length}): Focus archetype creation on these key differentiators
Spending Anchor Questions (${spendingAnchorQuestions.length}): Use these to validate archetype spending propensity
Expected Variance: ${categorizations?.statistical_overview?.expected_variance_distribution || 'Unknown'}

Key Statistical Differentiators:
${highRelevanceQuestions.map(q => 
    `- ${q.question} (${q.primary_type}): ${q.statistical_metrics?.archetype_discriminatory_power || 'Unknown'} discriminatory power`
).slice(0, 5).join('\n')}

Spending Behavior Anchors:
${spendingAnchorQuestions.map(q => 
    `- ${q.question}: ${q.statistical_metrics?.spending_correlation_potential || 'Unknown'} correlation potential`
).slice(0, 3).join('\n')}`;

        const patternsText = responsePatterns ? 
            Object.entries(responsePatterns).map(([pattern, data]) => 
                `${pattern}: ${JSON.stringify(data)}`
            ).join('\n') : 'Response patterns analysis not available';

        return ARCHETYPE_GENERATION_PROMPT(demographicAnalysis, questionTypesText, statisticalInsights + '\n\n' + patternsText, statistics);
    }

    async enhanceArchetypes(archetypes, demographicAnalysis) {
        // Generate Claude prompts for each archetype
        const enhancedArchetypes = [];

        for (const archetype of archetypes) {
            const claudePrompt = DIGITAL_TWIN_RESPONSE_PROMPT(archetype, null, demographicAnalysis);
            
            enhancedArchetypes.push({
                ...archetype,
                claude_prompt: claudePrompt,
                spending_propensity: this.calculateSpendingPropensity(archetype),
                behavioral_patterns: this.extractBehavioralPatterns(archetype),
                id: this.generateArchetypeId(archetype.name)
            });
        }

        return enhancedArchetypes;
    }

    // Prompt generation now handled by modular prompt system

    calculateSpendingPropensity(archetype) {
        // Simple scoring based on price sensitivity and motivators
        let score = 0.5; // Base score

        if (archetype.spending_patterns.price_sensitivity === 'low') score += 0.3;
        else if (archetype.spending_patterns.price_sensitivity === 'medium') score += 0.1;
        else score -= 0.1;

        if (archetype.spending_patterns.brand_loyalty === 'high') score += 0.2;
        
        // Adjust based on motivators
        const premiumMotivators = ['quality', 'status', 'luxury', 'premium', 'exclusive'];
        const hasPremuimMotivators = archetype.motivators.some(m => 
            premiumMotivators.some(pm => m.toLowerCase().includes(pm))
        );
        if (hasPremuimMotivators) score += 0.1;

        return Math.min(1.0, Math.max(0.0, score));
    }

    extractBehavioralPatterns(archetype) {
        return {
            decision_style: archetype.decision_drivers[0] || 'Unknown',
            risk_tolerance: archetype.spending_patterns.price_sensitivity === 'low' ? 'high' : 'medium',
            social_influence: archetype.communication_preferences.channels.includes('social media') ? 'high' : 'medium',
            research_behavior: archetype.pain_points.some(p => p.toLowerCase().includes('information')) ? 'high' : 'medium'
        };
    }

    generateArchetypeId(name) {
        return name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    }

    validateArchetypesResponse(result) {
        if (!result.archetype_framework) {
            throw new ValidationError('Missing archetype_framework in response');
        }

        if (!result.archetypes || !Array.isArray(result.archetypes)) {
            throw new ValidationError('Missing or invalid archetypes in response');
        }

        if (result.archetypes.length < 4 || result.archetypes.length > 6) {
            throw new ValidationError(`Invalid number of archetypes: ${result.archetypes.length}. Expected 4-6.`);
        }

        // Validate each archetype has required fields
        for (const archetype of result.archetypes) {
            const required = ['name', 'description', 'population_percentage', 'core_characteristics', 'decision_drivers'];
            for (const field of required) {
                if (!archetype[field]) {
                    throw new ValidationError(`Archetype missing required field: ${field}`);
                }
            }
        }

        // Validate percentages sum to approximately 100%
        const totalPercentage = result.archetypes.reduce((sum, a) => sum + a.population_percentage, 0);
        if (Math.abs(totalPercentage - 100) > 5) {
            logger.warn(`Archetype percentages sum to ${totalPercentage}%, not 100%`);
        }

        logger.debug('Archetype response validation passed');
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Method to save archetypes to database
    async saveArchetypes(datasetId, archetypeResult) {
        return {
            datasetId,
            framework: archetypeResult.archetype_framework,
            archetypes: archetypeResult.archetypes,
            demographicAnalysis: archetypeResult.demographic_analysis,
            timestamp: new Date().toISOString()
        };
    }
}