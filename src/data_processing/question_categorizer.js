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
                
                // Store categories from first batch
                if (i === 0 && batchResult.categories) {
                    this.categories = batchResult.categories;
                    this.demographicAnalysis = batchResult.demographic_analysis;
                }

                // Rate limiting - wait 2 seconds between batches
                if (i < batches.length - 1) {
                    await this.delay(2000);
                }
            }

            return {
                demographic_analysis: this.demographicAnalysis,
                categories: this.categories,
                categorizations: allResults
            };

        } catch (error) {
            logger.error('Question categorization failed', error);
            throw new AppError(`Categorization failed: ${error.message}`);
        }
    }

    async categorizeBatch(questions, targetDemographic, surveyContext) {
        const questionsList = questions.map((q, index) => `${index + 1}. ${q.fullQuestion || q.text}`).join('\n');
        
        const prompt = `You are a data-driven survey analyst. Your task is to analyze the actual survey questions and let natural themes and categories emerge from the content itself, without imposing any predetermined frameworks.

CRITICAL INSTRUCTIONS:
- Analyze the questions themselves to understand what this survey is actually measuring
- Let categories emerge naturally from the question content - don't impose theoretical frameworks
- Only mention established frameworks (LOHAS, generational, etc.) if they naturally align with what the questions are actually asking
- Focus on what the questions reveal about the respondents' actual decision-making processes
- Create categories based on what the survey is genuinely trying to understand

TARGET DEMOGRAPHIC: ${targetDemographic || 'Will be determined from question content'}
SURVEY CONTEXT: ${surveyContext || 'Will be determined from question analysis'}

ANALYSIS PROCESS:

Step 1 - Question Content Analysis:
- Read through all questions to understand what they're actually measuring
- Identify the natural themes that emerge from the question topics
- Understand what aspects of behavior/attitudes the survey is exploring

Step 2 - Natural Category Formation:
- Group questions by their actual content themes, not predetermined categories
- Create categories that reflect what the survey is genuinely asking about
- Ensure categories represent distinct aspects of what's being measured
- Number of categories should reflect natural groupings (typically 3-8)

Step 3 - Data-Driven Classification:
For each question, determine:
- Which natural category it belongs to based on its actual content
- How confident you are in this classification
- What behavioral insight this question actually provides
- How predictive this might be for understanding respondent behavior

Questions to analyze:
${questionsList}

Respond in JSON format with categories that emerge from the actual question content:
{
  "demographic_analysis": {
    "target_demographic": "what demographic this survey appears to target based on question content",
    "survey_context": "what this survey is actually trying to understand based on the questions",
    "survey_focus": "the main behavioral areas this survey explores"
  },
  "categories": [
    {
      "name": "category name based on actual question themes",
      "description": "what this group of questions actually measures",
      "behavioral_significance": "what this tells us about respondent behavior",
      "question_examples": ["example questions that fit this category"]
    }
  ],
  "categorizations": [
    {
      "question": "question text",
      "category": "assigned category",
      "confidence": 0.95,
      "reasoning": "why this question belongs in this category based on its content",
      "predictive_power": 0.80,
      "behavioral_insight": "what this specific question reveals about the respondent"
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
        
        if (!result.categories || !Array.isArray(result.categories)) {
            throw new ValidationError('Missing or invalid categories in response');
        }

        if (!result.categorizations || !Array.isArray(result.categorizations)) {
            throw new ValidationError('Missing or invalid categorizations in response');
        }

        // Validate each categorization has required fields
        for (const cat of result.categorizations) {
            if (!cat.question || !cat.category || typeof cat.confidence !== 'number' || typeof cat.predictive_power !== 'number') {
                throw new ValidationError(`Invalid categorization structure: ${JSON.stringify(cat)}`);
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