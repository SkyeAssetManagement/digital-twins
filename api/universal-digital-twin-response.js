import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from '../src/utils/logger.js';
import { AppError } from '../src/utils/error-handler.js';

const logger = createLogger('UniversalDigitalTwinAPI');

// Import uploaded datasets from survey-datasets.js
import { uploadedDatasets, uploadedArchetypes } from './survey-datasets.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { 
            datasetId, 
            content, 
            contentType = 'text',
            archetypeIds,
            responseCount = 5,
            temperatureRange = [0.8, 1.0]
        } = req.body;

        // Validation
        if (!datasetId) {
            return res.status(400).json({ error: 'datasetId is required' });
        }

        if (!content) {
            return res.status(400).json({ error: 'content is required' });
        }

        if (!archetypeIds || !Array.isArray(archetypeIds) || archetypeIds.length === 0) {
            return res.status(400).json({ error: 'archetypeIds array is required' });
        }

        logger.info(`Processing universal digital twin request for dataset ${datasetId}`);

        // Get dataset information
        const dataset = uploadedDatasets.get(parseInt(datasetId));
        if (!dataset) {
            return res.status(404).json({ 
                error: `Dataset ${datasetId} not found. Please upload a CSV or XLSX file first.`,
                suggestion: "Upload your survey data using the file upload feature to create datasets."
            });
        }

        // Process content (image analysis if needed)
        let processedContent = content;
        if (contentType === 'image') {
            processedContent = await analyzeImage(content);
        }

        // Generate responses for each archetype
        const responses = [];
        
        for (const archetypeId of archetypeIds) {
            const archetype = uploadedArchetypes.get(parseInt(archetypeId));
            if (!archetype) {
                logger.warn(`Archetype ${archetypeId} not found, skipping`);
                continue;
            }

            logger.info(`Generating ${responseCount} responses for ${archetype.name}`);
            
            for (let i = 0; i < responseCount; i++) {
                try {
                    const temperature = randomInRange(temperatureRange[0], temperatureRange[1]);
                    const startTime = Date.now();
                    
                    const response = await generateArchetypeResponse(
                        archetype, 
                        dataset,
                        processedContent, 
                        temperature
                    );
                    
                    const endTime = Date.now();
                    
                    responses.push({
                        archetypeName: archetype.name,
                        archetypeId: archetypeId,
                        demographic: dataset.target_demographic,
                        text: response,
                        sentiment: analyzeSentiment(response),
                        purchaseIntent: calculatePurchaseIntent(response, archetype),
                        temperature: temperature,
                        responseTime: endTime - startTime,
                        timestamp: new Date().toISOString()
                    });
                    
                    // Rate limiting between requests
                    if (i < responseCount - 1) {
                        await delay(1500);
                    }
                    
                } catch (error) {
                    logger.error(`Failed to generate response ${i + 1} for archetype ${archetype.name}`, error);
                    responses.push({
                        archetypeName: archetype.name,
                        archetypeId: archetypeId,
                        demographic: dataset.target_demographic,
                        text: "NA", // Per CLAUDE.md - no fallbacks
                        error: error.message,
                        timestamp: new Date().toISOString()
                    });
                }
            }
            
            // Delay between archetypes
            await delay(2000);
        }

        // Calculate statistics
        const validResponses = responses.filter(r => r.text !== "NA");
        const stats = {
            totalResponses: responses.length,
            successfulResponses: validResponses.length,
            avgResponseTime: validResponses.length > 0 
                ? validResponses.reduce((sum, r) => sum + (r.responseTime || 0), 0) / validResponses.length 
                : 0,
            demographicContext: `${dataset.name} - ${dataset.target_demographic}`,
            archetypesUsed: archetypeIds.length,
            temperatureRange: temperatureRange
        };

        logger.info(`Universal twin response completed: ${validResponses.length}/${responses.length} successful`);

        res.json({
            success: true,
            responses: responses,
            stats: stats,
            dataset: {
                id: dataset.id,
                name: dataset.name,
                demographic: dataset.target_demographic
            },
            contentAnalyzed: processedContent !== content ? processedContent : null,
            wasImageAnalyzed: contentType === 'image'
        });

    } catch (error) {
        logger.error('Universal digital twin API error', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

async function generateArchetypeResponse(archetype, dataset, content, temperature) {
    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_api_key_here') {
        return "NA"; // Per CLAUDE.md - no fallbacks
    }

    const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
    });

    const prompt = archetype.claude_prompt.replace('[MARKETING_CONTENT]', content);

    try {
        const response = await anthropic.messages.create({
            model: 'claude-opus-4-1-20250805',
            max_tokens: 1000,
            temperature: temperature,
            messages: [{ role: 'user', content: prompt }]
        });

        const responseText = response.content[0].text.trim();
        
        // Clean up response and validate length
        if (responseText.length < 10) {
            throw new Error('Response too short');
        }
        
        if (responseText.length > 500) {
            return responseText.substring(0, 500) + '...';
        }
        
        return responseText;
        
    } catch (error) {
        if (error.type === 'rate_limit_error') {
            logger.warn('Rate limited, waiting before retry');
            await delay(5000);
            return generateArchetypeResponse(archetype, dataset, content, temperature);
        }
        
        logger.error('Claude API error', error);
        throw new AppError(`Claude API failed: ${error.message}`);
    }
}

async function analyzeImage(base64Image) {
    if (!process.env.ANTHROPIC_API_KEY) {
        return "NA";
    }

    const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
    });

    try {
        const response = await anthropic.messages.create({
            model: 'claude-opus-4-1-20250805',
            max_tokens: 1000,
            temperature: 0.3,
            messages: [{
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: 'Extract and summarize the marketing content from this image. Focus on key messages, claims, and calls to action that would influence consumer purchasing decisions.'
                    },
                    {
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: 'image/jpeg',
                            data: base64Image.replace(/^data:image\/[a-z]+;base64,/, '')
                        }
                    }
                ]
            }]
        });

        return response.content[0].text.trim();
        
    } catch (error) {
        logger.error('Image analysis failed', error);
        return "NA";
    }
}

function analyzeSentiment(text) {
    // Simple sentiment analysis
    const positiveWords = ['love', 'great', 'excellent', 'amazing', 'perfect', 'wonderful', 'fantastic'];
    const negativeWords = ['hate', 'terrible', 'awful', 'horrible', 'bad', 'disappointing', 'waste'];
    
    const words = text.toLowerCase().split(/\W+/);
    const positiveCount = words.filter(word => positiveWords.includes(word)).length;
    const negativeCount = words.filter(word => negativeWords.includes(word)).length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
}

function calculatePurchaseIntent(text, archetype) {
    // Calculate purchase intent based on response content and archetype characteristics
    let score = 5; // Base score out of 10
    
    const intentKeywords = {
        high: ['buy', 'purchase', 'order', 'get', 'need', 'want', 'must have'],
        medium: ['consider', 'think about', 'maybe', 'might', 'could'],
        low: ['not interested', 'pass', 'skip', 'avoid', 'no thanks']
    };
    
    const words = text.toLowerCase();
    
    if (intentKeywords.high.some(keyword => words.includes(keyword))) score += 3;
    if (intentKeywords.medium.some(keyword => words.includes(keyword))) score += 1;
    if (intentKeywords.low.some(keyword => words.includes(keyword))) score -= 3;
    
    // Adjust based on archetype spending propensity
    score += (archetype.spending_propensity * 3);
    
    return Math.min(10, Math.max(1, Math.round(score)));
}

function randomInRange(min, max) {
    return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// No demo data - all data comes from uploaded surveys