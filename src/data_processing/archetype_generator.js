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

    buildArchetypePrompt(demographicAnalysis, questionTypes, responsePatterns, statistics) {
        const questionTypesText = questionTypes.map(type => 
            `${type.type}: ${type.description}\n  Themes: ${type.specific_themes.join(', ')}\n  Examples: ${type.example_questions.slice(0, 2).join('; ')}`
        ).join('\n\n');

        const patternsText = responsePatterns ? 
            Object.entries(responsePatterns).map(([pattern, data]) => 
                `${pattern}: ${JSON.stringify(data)}`
            ).join('\n') : 'Response patterns analysis not available';

        return `You are a data-driven consumer psychology expert. Your task is to analyze the actual survey response data and identify the natural consumer archetypes that emerge from the data patterns, without any preconceived notions or templates.

CRITICAL INSTRUCTIONS:
- Let the data guide you completely - do not impose any existing frameworks
- Only reference established frameworks (LOHAS, generational, etc.) if and when they naturally align with what you observe in the data
- Create archetypes that authentically represent the actual response patterns, not theoretical segments
- Base everything on the actual survey responses and behavioral clusters you identify
- The number of archetypes should be determined by natural data clustering (3-7 archetypes typical)

SURVEY DATA ANALYSIS:
Target Demographic: ${demographicAnalysis.target_demographic}
Survey Context: ${demographicAnalysis.survey_context}

Question Types and Themes Identified:
${questionTypesText}

Actual Response Patterns from Survey Data:
${patternsText}

Survey Statistics:
- Total Responses: ${statistics.totalResponses}
- Completion Rate: ${statistics.completionRate?.toFixed(1)}%
- Total Questions: ${Object.keys(statistics.fields || {}).length}

DATA-DRIVEN ARCHETYPE CREATION PROCESS:

1. **Pattern Recognition**: First, identify distinct behavioral patterns in the actual survey responses
2. **Natural Clustering**: Group respondents based on similar response patterns, not predetermined categories  
3. **Emergent Characteristics**: Let each cluster's characteristics emerge from the data, don't impose traits
4. **Authentic Naming**: Create names that reflect the actual behaviors observed, not marketing labels

For each naturally emerging archetype, define:
- **NAME**: Based on the dominant behavior pattern observed (not predetermined labels)
- **DESCRIPTION**: What this group actually does/thinks based on survey responses
- **SIZE**: Percentage based on actual data clustering
- **BEHAVIORAL_SIGNATURE**: The unique response pattern that defines this group
- **DECISION_LOGIC**: How this group actually makes decisions (from survey data)
- **VALUE_DRIVERS**: What actually matters to them (from their responses)
- **COMMUNICATION_STYLE**: How they naturally express preferences
- **CONSTRAINTS**: What limits their choices (observed from data)
- **MOTIVATIONAL_TRIGGERS**: What actually motivates them to act

VALIDATION CRITERIA:
- Each archetype must represent a statistically significant cluster in the data
- Archetypes must be clearly distinguishable in their response patterns
- The combined archetypes must account for the majority of survey responses
- Names and descriptions must reflect authentic behaviors, not aspirational marketing personas

Respond in JSON format with archetypes that emerge naturally from the data:
{
  "methodology": {
    "approach": "data-driven clustering based on actual response patterns",
    "primary_differentiators": ["the main factors that actually separate these groups in the data"],
    "data_validation": "how the archetypes were validated against actual survey responses"
  },
  "archetypes": [
    {
      "name": "Data-Derived Name",
      "description": "What this group actually does/thinks based on survey data",
      "population_percentage": "actual percentage from data clustering",
      "behavioral_signature": "the unique response pattern that defines this group",
      "decision_logic": "how they actually make decisions based on survey responses",
      "value_drivers": ["what genuinely matters to them from their responses"],
      "communication_style": "how they naturally express preferences",
      "constraints": ["what actually limits their choices"],
      "motivational_triggers": ["what actually motivates action"],
      "data_support": "statistical evidence supporting this archetype",
      "marketing_approach": {
        "messaging": "approach based on their actual values and constraints",
        "channels": "where they're likely to be based on behaviors",
        "timing": "when they make decisions based on patterns"
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