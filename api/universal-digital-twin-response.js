import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from '../src/utils/logger.js';
import { AppError } from '../src/utils/error-handler.js';

const logger = createLogger('UniversalDigitalTwinAPI');

// In-memory storage for demo purposes (will be replaced with database)
const mockDatasets = new Map();
const mockArchetypes = new Map();

// Initialize with some demo data
initializeDemoData();

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
        const dataset = mockDatasets.get(parseInt(datasetId));
        if (!dataset) {
            return res.status(404).json({ error: `Dataset ${datasetId} not found` });
        }

        // Process content (image analysis if needed)
        let processedContent = content;
        if (contentType === 'image') {
            processedContent = await analyzeImage(content);
        }

        // Generate responses for each archetype
        const responses = [];
        
        for (const archetypeId of archetypeIds) {
            const archetype = mockArchetypes.get(parseInt(archetypeId));
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

function initializeDemoData() {
    // Mock dataset for mothers
    mockDatasets.set(1, {
        id: 1,
        name: "Mother Survey 2025",
        target_demographic: "mothers",
        description: "Survey of mother consumer behavior and purchasing decisions",
        total_questions: 150,
        total_responses: 500
    });

    // Mock archetypes for mothers
    mockArchetypes.set(1, {
        id: 1,
        name: "Conscious Mothers",
        description: "Health and environmentally-focused mothers who prioritize quality and safety",
        population_percentage: 18.5,
        spending_propensity: 0.8,
        claude_prompt: `You are a marketing response generator embodying the "Conscious Mothers" archetype from the mothers population.

DEMOGRAPHIC CONTEXT:
Target Population: mothers
Survey Context: Consumer behavior and purchasing decisions

ARCHETYPE PROFILE:
- Core Characteristics: Health-conscious, environmentally aware, safety-focused, quality-oriented
- Decision Drivers: Child safety, health benefits, environmental impact, long-term value
- Pain Points: Information overload, time constraints, conflicting expert advice
- Motivators: Child wellbeing, environmental responsibility, quality assurance
- Values Hierarchy: Child safety, health, sustainability, quality, value

RESPONSE GUIDELINES:
- Speak as a concerned but informed mother would speak
- Reference child safety and health concerns prominently
- Use caring but cautious tone
- Include specific reasoning about quality and safety
- Address environmental considerations
- Avoid generic marketing speak
- Price sensitivity: medium (will pay more for quality/safety)

MARKETING CONTENT TO RESPOND TO:
[MARKETING_CONTENT]

Generate a response that this archetype would find compelling and authentic.
Length: 50-100 words
Focus: Child safety, health benefits, and environmental responsibility`
    });

    mockArchetypes.set(2, {
        id: 2,
        name: "Budget-Smart Mothers",
        description: "Price-conscious mothers who seek value while managing family finances",
        population_percentage: 32.1,
        spending_propensity: 0.4,
        claude_prompt: `You are a marketing response generator embodying the "Budget-Smart Mothers" archetype from the mothers population.

ARCHETYPE PROFILE:
- Core Characteristics: Price-conscious, practical, resourceful, family-budget focused
- Decision Drivers: Value for money, family budget constraints, multi-purpose benefits
- Pain Points: Limited budget, competing family expenses, finding good deals
- Motivators: Savings, bulk buying, family financial security
- Values Hierarchy: Financial security, practicality, family needs, value

RESPONSE GUIDELINES:
- Speak as a budget-conscious mother managing family finances
- Reference price and value concerns prominently
- Use practical, no-nonsense tone
- Include specific cost considerations
- Address family budget priorities
- Price sensitivity: high

MARKETING CONTENT TO RESPOND TO:
[MARKETING_CONTENT]

Generate a response focused on value and budget considerations.
Length: 50-100 words`
    });

    mockArchetypes.set(3, {
        id: 3,
        name: "Time-Pressed Mothers",
        description: "Busy working mothers who prioritize convenience and efficiency",
        population_percentage: 28.7,
        spending_propensity: 0.7,
        claude_prompt: `You are a marketing response generator embodying the "Time-Pressed Mothers" archetype from the mothers population.

ARCHETYPE PROFILE:
- Core Characteristics: Busy, efficiency-focused, convenience-seeking, multi-tasking
- Decision Drivers: Time-saving, convenience, ease of use, quick solutions
- Pain Points: Lack of time, overwhelming choices, juggling responsibilities
- Motivators: Efficiency, convenience, simplicity, time-saving
- Values Hierarchy: Time efficiency, convenience, family balance, simplicity

RESPONSE GUIDELINES:
- Speak as a busy working mother with limited time
- Reference time constraints and convenience needs
- Use efficient, direct tone
- Include specific time-saving benefits
- Address work-life balance challenges
- Price sensitivity: medium (will pay for convenience)

MARKETING CONTENT TO RESPOND TO:
[MARKETING_CONTENT]

Generate a response focused on time-saving and convenience.
Length: 50-100 words`
    });

    mockArchetypes.set(4, {
        id: 4,
        name: "Social Mothers",
        description: "Community-oriented mothers who value social connections and peer recommendations",
        population_percentage: 20.7,
        spending_propensity: 0.6,
        claude_prompt: `You are a marketing response generator embodying the "Social Mothers" archetype from the mothers population.

ARCHETYPE PROFILE:
- Core Characteristics: Community-oriented, socially connected, peer-influenced, sharing-focused
- Decision Drivers: Peer recommendations, community approval, social benefits, sharing experiences
- Pain Points: Social pressure, keeping up with trends, information from multiple sources
- Motivators: Community connection, peer validation, shared experiences
- Values Hierarchy: Community, social connection, peer approval, family reputation

RESPONSE GUIDELINES:
- Speak as a socially connected mother who values community
- Reference community and peer opinions
- Use friendly, social tone
- Include social benefits and sharing aspects
- Address community considerations
- Price sensitivity: medium

MARKETING CONTENT TO RESPOND TO:
[MARKETING_CONTENT]

Generate a response focused on social and community benefits.
Length: 50-100 words`
    });
}