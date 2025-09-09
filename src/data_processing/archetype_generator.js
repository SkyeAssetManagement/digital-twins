import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from '../utils/logger.js';
import { AppError, ValidationError } from '../utils/error-handler.js';

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
                categorizations.categories,
                responsePatterns,
                surveyData.statistics
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

    buildArchetypePrompt(demographicAnalysis, categories, responsePatterns, statistics) {
        const categoriesText = categories.map(cat => 
            `${cat.name}: ${cat.description} (${cat.behavioral_significance})`
        ).join('\n');

        const patternsText = responsePatterns ? 
            Object.entries(responsePatterns).map(([pattern, data]) => 
                `${pattern}: ${JSON.stringify(data)}`
            ).join('\n') : 'Response patterns analysis not available';

        return `You are a consumer psychology expert specializing in market segmentation. Analyze the provided survey data to create 4-6 distinct consumer archetypes for the identified demographic.

REFERENCE FRAMEWORKS TO CONSIDER:
- LOHAS Model: Leaders (16%), Leaning (40%), Learners (36%), Laggards (8%) - values-based segmentation
- Generational Theory: Age-based behavioral patterns and preferences  
- Psychographic Models: Values, attitudes, interests, lifestyle factors
- Life Stage Models: Career, family, retirement phases
- Economic Models: Income, spending priorities, financial security levels

SURVEY ANALYSIS RESULTS:
Target Demographic: ${demographicAnalysis.target_demographic}
Survey Context: ${demographicAnalysis.survey_context}
Reference Frameworks Used: ${demographicAnalysis.reference_frameworks.join(', ')}

Key Categories Identified:
${categoriesText}

Response Patterns:
${patternsText}

Survey Statistics:
- Total Responses: ${statistics.totalResponses}
- Completion Rate: ${statistics.completionRate?.toFixed(1)}%
- Total Questions: ${Object.keys(statistics.fields || {}).length}

ARCHETYPE CREATION REQUIREMENTS:
1. Create 4-6 archetypes that are:
   - Distinct and non-overlapping
   - Representative of different behavioral patterns
   - Predictive of consumer decision-making
   - Contextually appropriate for this demographic

2. For each archetype, define:
   - NAME: Memorable, demographic-appropriate name
   - SIZE: Estimated percentage of population  
   - CORE_CHARACTERISTICS: Primary traits and behaviors
   - DECISION_DRIVERS: What motivates their choices
   - SPENDING_PATTERNS: How they approach purchases
   - COMMUNICATION_PREFERENCES: How to reach them effectively
   - PAIN_POINTS: Key challenges and concerns
   - MOTIVATORS: What drives positive responses
   - VALUES_HIERARCHY: Top 3-5 values in order of importance
   - REFERENCE_FRAMEWORK_ALIGNMENT: How they relate to LOHAS/generational/other models

3. Base archetypes on:
   - Highest-scoring predictive categories
   - Clear behavioral pattern differences  
   - Spending propensity variations
   - Values vs practical constraint trade-offs

4. Ensure archetypes are:
   - Actionable for marketing teams
   - Authentic to this demographic's real characteristics
   - Differentiating enough to warrant separate strategies
   - Grounded in survey data insights

Create archetypes that marketing teams can immediately use for targeted campaigns while being authentic to this demographic's real characteristics and needs.

Respond in JSON format:
{
  "archetype_framework": {
    "methodology": "explanation of approach used",
    "key_differentiators": ["primary factors that distinguish archetypes"],
    "reference_frameworks_applied": ["LOHAS", "generational", "etc."],
    "validation_approach": "how archetypes were validated against data"
  },
  "archetypes": [
    {
      "name": "Archetype Name",
      "description": "2-3 sentence overview",
      "population_percentage": 25.0,
      "core_characteristics": ["trait1", "trait2", "trait3"],
      "decision_drivers": ["driver1", "driver2", "driver3"],
      "spending_patterns": {
        "budget_allocation": "how they prioritize spending",
        "price_sensitivity": "high/medium/low",
        "purchase_triggers": ["trigger1", "trigger2"],
        "brand_loyalty": "high/medium/low"
      },
      "communication_preferences": {
        "tone": "preferred communication tone",
        "channels": ["channel1", "channel2"],
        "message_focus": "what to emphasize",
        "avoid": ["what not to emphasize"]
      },
      "pain_points": ["pain1", "pain2", "pain3"],
      "motivators": ["motivator1", "motivator2", "motivator3"],
      "values_hierarchy": ["top_value", "second_value", "third_value"],
      "reference_framework_alignment": {
        "lohas_alignment": "Leader/Leaning/Learner/Laggard or N/A",
        "generational_fit": "generation or life stage",
        "psychographic_profile": "primary psychographic characteristics"
      },
      "marketing_implications": {
        "ideal_products": ["product type1", "product type2"],
        "messaging_strategy": "how to position messages",
        "channel_strategy": "where to reach them",
        "pricing_strategy": "pricing approach"
      }
    }
  ]
}`;
    }

    async enhanceArchetypes(archetypes, demographicAnalysis) {
        // Generate Claude prompts for each archetype
        const enhancedArchetypes = [];

        for (const archetype of archetypes) {
            const claudePrompt = this.generateClaudePrompt(archetype, demographicAnalysis);
            
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

    generateClaudePrompt(archetype, demographicAnalysis) {
        return `You are a marketing response generator embodying the "${archetype.name}" archetype from the ${demographicAnalysis.target_demographic} population.

DEMOGRAPHIC CONTEXT:
Target Population: ${demographicAnalysis.target_demographic}
Survey Context: ${demographicAnalysis.survey_context}
Reference Frameworks: ${demographicAnalysis.reference_frameworks.join(', ')}

ARCHETYPE PROFILE:
- Core Characteristics: ${archetype.core_characteristics.join(', ')}
- Decision Drivers: ${archetype.decision_drivers.join(', ')}
- Spending Patterns: ${archetype.spending_patterns.budget_allocation}
- Pain Points: ${archetype.pain_points.join(', ')}
- Motivators: ${archetype.motivators.join(', ')}
- Values Hierarchy: ${archetype.values_hierarchy.join(', ')}
- Communication Preferences: ${archetype.communication_preferences.tone}

RESPONSE GUIDELINES:
- Speak as someone in this archetype from this demographic would speak
- Reference demographic-specific concerns and priorities
- Use tone and language appropriate for this population: ${archetype.communication_preferences.tone}
- Include specific reasoning that resonates with this archetype
- Address relevant pain points and motivators naturally
- Avoid generic marketing speak
- Reflect authentic characteristics of this demographic
- Price sensitivity: ${archetype.spending_patterns.price_sensitivity}
- Brand loyalty: ${archetype.spending_patterns.brand_loyalty}

MARKETING CONTENT TO RESPOND TO:
[MARKETING_CONTENT]

Generate a response that this archetype would find compelling and authentic within their demographic context.
Length: 50-100 words
Focus: Address both rational and emotional motivators relevant to ${demographicAnalysis.target_demographic}`;
    }

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