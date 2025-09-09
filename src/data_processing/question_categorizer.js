import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from '../utils/logger.js';
import { AppError, ValidationError } from '../utils/error-handler.js';

const logger = createLogger('QuestionCategorizer');

export class QuestionCategorizer {
    constructor() {
        this.anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY
        });
        this.model = 'claude-opus-4-1-20250805';
        this.batchSize = 25; // Process questions in batches to avoid token limits
    }

    async categorizeQuestions(questions, targetDemographic, surveyContext) {
        logger.info(`Categorizing ${questions.length} questions for ${targetDemographic}`);

        try {
            const batches = this.createBatches(questions, this.batchSize);
            const allResults = [];

            for (let i = 0; i < batches.length; i++) {
                const batch = batches[i];
                logger.info(`Processing batch ${i + 1}/${batches.length} (${batch.length} questions)`);
                
                const batchResult = await this.categorizeBatch(batch, targetDemographic, surveyContext);
                allResults.push(...batchResult.categorizations);
                
                // Store question types from first batch
                if (i === 0 && batchResult.question_types) {
                    this.questionTypes = batchResult.question_types;
                    this.demographicAnalysis = batchResult.demographic_analysis;
                }

                // Rate limiting - wait 2 seconds between batches
                if (i < batches.length - 1) {
                    await this.delay(2000);
                }
            }

            return {
                demographic_analysis: this.demographicAnalysis,
                question_types: this.questionTypes,
                categorizations: allResults
            };

        } catch (error) {
            logger.error('Question categorization failed', error);
            throw new AppError(`Categorization failed: ${error.message}`);
        }
    }

    async categorizeBatch(questions, targetDemographic, surveyContext) {
        const questionsList = questions.map((q, index) => `${index + 1}. ${q.fullQuestion || q.text}`).join('\n');
        
        const prompt = `You are a data-driven survey analyst. Analyze each survey question using a systematic two-step approach to understand what type of question it is and what it's specifically measuring.

CRITICAL INSTRUCTIONS:
- First classify each question by its fundamental type
- Then identify specific themes and values within each type
- Base everything on the actual question content, not theoretical frameworks
- Let natural patterns emerge from the data

TARGET DEMOGRAPHIC: ${targetDemographic || 'Will be determined from question content'}
SURVEY CONTEXT: ${surveyContext || 'Will be determined from question analysis'}

ANALYSIS PROCESS:

Step 1 - Question Type Classification:
For each question, first determine which fundamental type it represents:

A) VALUES-BASED QUESTIONS:
   - Questions about what respondents believe, prioritize, or value
   - Examples: "How important is X to you?", "What do you value most?", "How much do you care about Y?"
   - Identify specific value being measured (health, environment, quality, family, security, etc.)

B) BEHAVIOR-BASED QUESTIONS:
   - Questions about what respondents actually do or would do
   - Examples: "Do you recommend?", "How often do you?", "What do you typically do when?"
   - Focus on actual actions and behavioral patterns

C) SPENDING/PURCHASE BEHAVIOR QUESTIONS:
   - Questions about financial decisions and purchase behavior
   - Examples: "Will you spend based on X?", "How much would you pay for Y?", "What influences your purchasing?"
   - Focus on money-related decision making

Step 2 - Specific Theme Identification:
Within each type, identify the specific themes and values being measured based on the actual question content.

Questions to analyze:
${questionsList}

Respond in JSON format:
{
  "demographic_analysis": {
    "target_demographic": "what demographic this survey appears to target",
    "survey_context": "what this survey is actually trying to understand",
    "question_type_breakdown": {
      "values_based_count": "number of values questions",
      "behavior_based_count": "number of behavior questions", 
      "spending_based_count": "number of spending questions"
    }
  },
  "question_types": [
    {
      "type": "VALUES_BASED | BEHAVIOR_BASED | SPENDING_BASED",
      "specific_themes": ["theme1", "theme2", "theme3"],
      "description": "what this type measures in this survey",
      "example_questions": ["question examples of this type"]
    }
  ],
  "categorizations": [
    {
      "question": "question text",
      "primary_type": "VALUES_BASED | BEHAVIOR_BASED | SPENDING_BASED", 
      "specific_theme": "specific value/behavior/spending area being measured",
      "category": "descriptive category name combining type + theme",
      "confidence": 0.95,
      "reasoning": "why this question fits this type and theme",
      "predictive_power": 0.80,
      "behavioral_insight": "what this reveals about respondent psychology"
    }
  ]
}`;

        try {
            const response = await this.anthropic.messages.create({
                model: this.model,
                max_tokens: 4000,
                temperature: 0.3, // Lower temperature for more consistent categorization
                messages: [{ role: 'user', content: prompt }]
            });

            const content = response.content[0].text;
            logger.debug('Claude categorization response received');
            
            // Parse JSON response
            let result;
            try {
                // Clean the response in case there are markdown code blocks
                const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                result = JSON.parse(cleanContent);
            } catch (parseError) {
                logger.error('Failed to parse Claude response as JSON', { content, parseError });
                throw new AppError(`Invalid JSON response from Claude: ${parseError.message}`);
            }

            // Validate response structure
            this.validateCategorizationResponse(result);
            
            logger.info(`Successfully categorized ${result.categorizations.length} questions into ${result.categories.length} categories`);
            return result;

        } catch (error) {
            if (error.type === 'rate_limit_error') {
                logger.warn('Rate limited by Claude API, waiting before retry');
                await this.delay(5000);
                return this.categorizeBatch(questions, targetDemographic, surveyContext);
            }
            
            logger.error('Claude API categorization failed', error);
            throw new AppError(`Claude categorization failed: ${error.message}`);
        }
    }

    validateCategorizationResponse(result) {
        if (!result.demographic_analysis) {
            throw new ValidationError('Missing demographic_analysis in response');
        }
        
        if (!result.question_types || !Array.isArray(result.question_types)) {
            throw new ValidationError('Missing or invalid question_types in response');
        }

        if (!result.categorizations || !Array.isArray(result.categorizations)) {
            throw new ValidationError('Missing or invalid categorizations in response');
        }

        // Validate each categorization has required fields including primary_type
        for (const cat of result.categorizations) {
            if (!cat.question || !cat.primary_type || !cat.category || typeof cat.confidence !== 'number' || typeof cat.predictive_power !== 'number') {
                throw new ValidationError(`Invalid categorization structure: ${JSON.stringify(cat)}`);
            }
            
            // Validate primary_type is one of the expected values
            const validTypes = ['VALUES_BASED', 'BEHAVIOR_BASED', 'SPENDING_BASED'];
            if (!validTypes.includes(cat.primary_type)) {
                throw new ValidationError(`Invalid primary_type: ${cat.primary_type}. Must be one of: ${validTypes.join(', ')}`);
            }
        }

        logger.debug('Categorization response validation passed');
    }

    createBatches(questions, batchSize) {
        const batches = [];
        for (let i = 0; i < questions.length; i += batchSize) {
            batches.push(questions.slice(i, i + batchSize));
        }
        logger.debug(`Created ${batches.length} batches of max ${batchSize} questions each`);
        return batches;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Method to save categorization results to database
    async saveCategorizations(datasetId, categorizationResult) {
        // This will be implemented when database service is created
        // For now, return the result for manual storage
        return {
            datasetId,
            categories: categorizationResult.categories,
            categorizations: categorizationResult.categorizations,
            demographicAnalysis: categorizationResult.demographic_analysis,
            timestamp: new Date().toISOString()
        };
    }

    // Method to load existing categorizations from database
    async loadCategorizations(datasetId) {
        // Placeholder for database loading
        // Will be implemented with database service
        return null;
    }
}