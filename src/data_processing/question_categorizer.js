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
        
        const prompt = `You are an expert consumer behavior analyst. Analyze the provided survey data to understand the target demographic and survey context, then create appropriate question categories and classify each question.

SURVEY CONTEXT ANALYSIS:
1. First, identify the target demographic from the survey questions and content
2. Determine 4-6 meaningful categories that would be most relevant for this demographic's consumer behavior
3. Consider proven frameworks (LOHAS, generational theory, psychographics) as reference points
4. Focus on categories that would be predictive of purchasing behavior and decision-making

TARGET DEMOGRAPHIC: ${targetDemographic || 'AUTO-DETECT'}
SURVEY CONTEXT: ${surveyContext || 'Consumer behavior survey'}

TASK: Create categories and classify each question

Step 1 - Category Creation:
Create 4-6 categories that are:
- Relevant to this demographic's decision-making
- Predictive of consumer behavior  
- Distinct and non-overlapping
- Based on psychological/behavioral drivers

Step 2 - Question Classification:
For each survey question, provide:
- Category (from your created categories)
- Confidence score (0-1)
- Reasoning (2-3 sentences explaining the classification)
- Predictive power estimate (0-1) for consumer behavior correlation
- Behavioral insight (what this question reveals about the respondent)

Questions to analyze:
${questionsList}

Respond in JSON format:
{
  "demographic_analysis": {
    "target_demographic": "identified demographic",
    "survey_context": "survey purpose and scope",
    "reference_frameworks": ["LOHAS", "generational", "etc."]
  },
  "categories": [
    {
      "name": "category name",
      "description": "what this category measures",
      "behavioral_significance": "why this matters for consumer behavior"
    }
  ],
  "categorizations": [
    {
      "question": "question text",
      "category": "assigned category",
      "confidence": 0.95,
      "reasoning": "explanation",
      "predictive_power": 0.80,
      "behavioral_insight": "what this reveals about respondent"
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