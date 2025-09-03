import fetch from 'node-fetch';

export class DatasetAwareResponseEngine {
  constructor(twin, vectorStore) {
    this.twin = twin;
    this.vectorStore = vectorStore;
    this.claudeApiUrl = "https://api.anthropic.com/v1/messages";
  }
  
  async generateResponse(marketingContent, imageData = null) {
    // Find similar historical responses from the dataset
    const similarResponses = await this.vectorStore.findSimilarResponses(
      marketingContent,
      this.twin.segment,
      5
    );
    
    const prompt = this.buildContextualPrompt(marketingContent, similarResponses);
    
    // Check if we have Claude API access
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (apiKey && apiKey !== 'your_api_key_here') {
      try {
        return await this.generateWithClaude(prompt, imageData, similarResponses);
      } catch (error) {
        console.error("Claude API error:", error);
      }
    }
    
    // Use data-driven fallback
    return this.generateDataDrivenFallback(marketingContent, similarResponses);
  }
  
  async generateWithClaude(prompt, imageData, similarResponses) {
    const messages = [{
      role: "user",
      content: imageData 
        ? [
            { type: "text", text: prompt },
            { 
              type: "image", 
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: imageData
              }
            }
          ]
        : prompt
    }];
    
    const response = await fetch(this.claudeApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-sonnet-20240229",
        max_tokens: 500,
        messages
      })
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const data = await response.json();
    const parsedResponse = this.parseResponse(data.content[0].text);
    
    // Store this response for future learning
    await this.vectorStore.storeResponse(
      `twin_${this.twin.id}`,
      this.twin.segment,
      marketingContent,
      parsedResponse.text,
      { 
        sentiment: parsedResponse.sentiment,
        purchaseIntent: parsedResponse.purchaseIntent,
        generatedBy: 'claude'
      }
    );
    
    return parsedResponse;
  }
  
  buildContextualPrompt(marketingContent, similarResponses) {
    const { persona, valueSystem, segment, responsePatterns } = this.twin;
    
    // Build context from actual survey responses
    const responseContext = similarResponses.map(r => 
      `When asked "${r.question}", someone like you said: "${r.answer}"`
    ).join('\n');
    
    // Extract vocabulary patterns
    const vocabularyHints = responsePatterns?.vocabulary 
      ? Object.keys(responsePatterns.vocabulary).slice(0, 20).join(', ')
      : '';
    
    // Format persona details
    const personaDetails = typeof persona === 'object' 
      ? `${persona.name || 'Consumer'}, a ${persona.age || 35}-year-old ${persona.occupation || 'professional'}`
      : 'A consumer';
    
    // Format value system
    const valueDetails = Object.entries(valueSystem || {})
      .map(([key, value]) => `- ${key}: ${typeof value === 'number' ? (value * 10).toFixed(1) + '/10' : value}`)
      .join('\n');
    
    return `You are ${personaDetails} who falls into the "${segment}" category of consumers.

Your value system:
${valueDetails || '- Balanced across all factors'}

${responseContext ? `Here are some responses from people similar to you:\n${responseContext}\n` : ''}

${vocabularyHints ? `Common words/phrases you and similar people use: ${vocabularyHints}\n` : ''}

React authentically to this marketing material as this persona would:
"${marketingContent}"

Respond in 2-3 sentences with your genuine reaction. Consider:
1. Whether this aligns with your values
2. Your typical vocabulary and communication style
3. Your specific concerns and priorities
4. Whether you'd actually purchase this

Be specific and authentic to your persona, not generic. Include your sentiment (positive/neutral/negative) and purchase intent (1-10 scale) at the end in this format:
[Sentiment: X, Purchase Intent: Y]`;
  }
  
  parseResponse(responseText) {
    // Extract sentiment and purchase intent from response
    const sentimentMatch = responseText.match(/\[Sentiment:\s*(\w+)/i);
    const intentMatch = responseText.match(/Purchase Intent:\s*(\d+)/i);
    
    // Remove the metadata from the main text
    const cleanText = responseText.replace(/\[Sentiment:.*?\]/i, '').trim();
    
    return {
      text: cleanText || responseText,
      sentiment: sentimentMatch ? sentimentMatch[1].toLowerCase() : 'neutral',
      purchaseIntent: intentMatch ? parseInt(intentMatch[1]) : 5,
      keyFactors: this.extractKeyFactors(responseText),
      timestamp: new Date().toISOString(),
      generatedBy: 'claude'
    };
  }
  
  async generateDataDrivenFallback(marketingContent, similarResponses) {
    // Generate response based on actual dataset patterns
    if (similarResponses.length > 0) {
      // Analyze sentiment patterns in similar responses
      const sentiments = this.analyzeSentimentPatterns(similarResponses);
      const vocabulary = this.extractVocabulary(similarResponses);
      
      // Construct response using real patterns
      const template = this.selectResponseTemplate(sentiments, this.twin.segment);
      const response = this.fillTemplate(template, vocabulary, marketingContent);
      
      return {
        text: response,
        sentiment: sentiments.primary,
        purchaseIntent: sentiments.avgIntent,
        keyFactors: this.extractKeyFactorsFromResponses(similarResponses),
        timestamp: new Date().toISOString(),
        isFallback: true,
        basedOnData: true,
        generatedBy: 'pattern-based'
      };
    }
    
    // Ultimate fallback if no data available
    return this.generateGenericFallback(marketingContent);
  }
  
  generateGenericFallback(marketingContent) {
    const { valueSystem, persona, segment } = this.twin;
    
    // Analyze marketing content
    const contentLower = marketingContent.toLowerCase();
    const hasSustainability = contentLower.includes('sustain') || contentLower.includes('eco') || contentLower.includes('green');
    const hasDiscount = contentLower.includes('sale') || contentLower.includes('discount') || contentLower.includes('% off');
    const hasPremium = contentLower.includes('premium') || contentLower.includes('luxury') || contentLower.includes('exclusive');
    const hasInnovation = contentLower.includes('new') || contentLower.includes('innovative') || contentLower.includes('revolutionary');
    
    // Generate response based on value system
    let response = '';
    let sentiment = 'neutral';
    let purchaseIntent = 5;
    
    if (valueSystem?.sustainability > 0.7 && hasSustainability) {
      response = "This really aligns with my environmental values. I appreciate brands that prioritize sustainability. I'd definitely consider this if the quality matches the eco-friendly promise.";
      sentiment = 'positive';
      purchaseIntent = 8;
    } else if (valueSystem?.priceConsciousness > 0.7 && hasDiscount) {
      response = "The discount definitely catches my attention. I always look for good deals, but I'd want to make sure the quality isn't compromised. Might be worth trying at this price point.";
      sentiment = 'positive';
      purchaseIntent = 7;
    } else if (valueSystem?.brandLoyalty > 0.7) {
      response = "I tend to stick with brands I trust. If this is from a reputable company, I might give it a try. Otherwise, I'd need more convincing or recommendations from friends.";
      sentiment = 'neutral';
      purchaseIntent = 5;
    } else if (valueSystem?.innovation > 0.7 && hasInnovation) {
      response = "The innovative features are intriguing. I like trying new products that offer something different. Would want to read reviews first, but I'm interested.";
      sentiment = 'positive';
      purchaseIntent = 7;
    } else if (valueSystem?.quality > 0.7 && hasPremium) {
      response = "Quality is my main concern. If this truly offers premium value, I don't mind paying more. I'd need to see proof of the quality claims though.";
      sentiment = 'neutral';
      purchaseIntent = 6;
    } else {
      // Generic balanced response
      response = "This seems interesting, but I'd need more information before making a decision. I usually compare options and read reviews before purchasing. It depends on how it compares to alternatives.";
      sentiment = 'neutral';
      purchaseIntent = 5;
    }
    
    // Adjust based on segment if available
    if (segment && segment.toLowerCase().includes('leader')) {
      purchaseIntent = Math.min(10, purchaseIntent + 2);
      if (hasSustainability) sentiment = 'positive';
    } else if (segment && segment.toLowerCase().includes('laggard')) {
      purchaseIntent = Math.max(1, purchaseIntent - 2);
      if (!hasDiscount) sentiment = 'negative';
    }
    
    return {
      text: response,
      sentiment: sentiment,
      purchaseIntent: purchaseIntent,
      keyFactors: this.identifyKeyFactors(marketingContent, valueSystem),
      timestamp: new Date().toISOString(),
      isFallback: true,
      basedOnData: false,
      generatedBy: 'rule-based'
    };
  }
  
  analyzeSentimentPatterns(responses) {
    const sentiments = responses
      .map(r => r.metadata?.sentiment || 'neutral')
      .filter(s => s);
    
    const intents = responses
      .map(r => r.metadata?.purchaseIntent || 5)
      .filter(i => i);
    
    const sentimentCounts = {
      positive: 0,
      neutral: 0,
      negative: 0
    };
    
    sentiments.forEach(s => {
      if (sentimentCounts.hasOwnProperty(s)) {
        sentimentCounts[s]++;
      }
    });
    
    const primary = Object.entries(sentimentCounts)
      .sort((a, b) => b[1] - a[1])[0][0];
    
    return {
      primary: primary,
      avgIntent: intents.length > 0 
        ? Math.round(intents.reduce((a, b) => a + b, 0) / intents.length)
        : 5,
      distribution: sentimentCounts
    };
  }
  
  extractVocabulary(responses) {
    const words = new Set();
    
    responses.forEach(r => {
      if (r.answer && typeof r.answer === 'string') {
        r.answer.toLowerCase().split(/\s+/).forEach(word => {
          if (word.length > 3) {
            words.add(word.replace(/[^\w]/g, ''));
          }
        });
      }
    });
    
    return Array.from(words);
  }
  
  selectResponseTemplate(sentiments, segment) {
    const templates = {
      positive: [
        "This really speaks to what I value - {positive_aspect}. {consideration}",
        "I appreciate {positive_aspect}. {action_statement}",
        "{positive_aspect} catches my attention. {qualifier}"
      ],
      neutral: [
        "This seems {neutral_observation}. {question_or_concern}",
        "I'd need to know more about {specific_aspect}. {consideration}",
        "{neutral_observation}, but {concern_or_condition}"
      ],
      negative: [
        "This doesn't align with {negative_aspect}. {dismissal}",
        "I'm skeptical about {concern}. {reason}",
        "{negative_observation}. {alternative_preference}"
      ]
    };
    
    const sentiment = sentiments.primary || 'neutral';
    const templateList = templates[sentiment] || templates.neutral;
    return templateList[Math.floor(Math.random() * templateList.length)];
  }
  
  fillTemplate(template, vocabulary, marketingContent) {
    const fillers = {
      positive_aspect: this.selectFromList([
        "the sustainability focus",
        "the value proposition",
        "the quality claims",
        "the innovative approach"
      ]),
      consideration: this.selectFromList([
        "I'd likely give this a try",
        "This could work for my needs",
        "Worth investigating further"
      ]),
      action_statement: this.selectFromList([
        "I might purchase this",
        "This fits my criteria",
        "I'd recommend to friends"
      ]),
      qualifier: this.selectFromList([
        "If the price is right",
        "Assuming quality matches claims",
        "Depending on reviews"
      ]),
      neutral_observation: this.selectFromList([
        "interesting",
        "worth considering",
        "potentially useful"
      ]),
      question_or_concern: this.selectFromList([
        "How does it compare to alternatives?",
        "What's the actual value here?",
        "Is this really different?"
      ]),
      specific_aspect: this.selectFromList([
        "the pricing",
        "the quality",
        "the sustainability claims",
        "the brand reputation"
      ]),
      concern_or_condition: this.selectFromList([
        "I need more information",
        "price might be an issue",
        "quality is uncertain"
      ]),
      negative_aspect: this.selectFromList([
        "my values",
        "my needs",
        "what I'm looking for"
      ]),
      dismissal: this.selectFromList([
        "Not for me",
        "I'll pass",
        "Doesn't work for me"
      ]),
      concern: this.selectFromList([
        "the claims",
        "the pricing",
        "the approach"
      ]),
      reason: this.selectFromList([
        "Seems like marketing hype",
        "Not enough substance",
        "Better options available"
      ]),
      negative_observation: this.selectFromList([
        "Not impressed",
        "Doesn't stand out",
        "Too generic"
      ]),
      alternative_preference: this.selectFromList([
        "I prefer established brands",
        "I'll stick with what I know",
        "Looking for something different"
      ])
    };
    
    // Replace placeholders in template
    let response = template;
    for (const [key, value] of Object.entries(fillers)) {
      response = response.replace(`{${key}}`, value);
    }
    
    return response;
  }
  
  selectFromList(list) {
    return list[Math.floor(Math.random() * list.length)];
  }
  
  extractKeyFactors(responseText) {
    const factors = [];
    const text = responseText.toLowerCase();
    
    const factorKeywords = {
      price: ['price', 'cost', 'expensive', 'cheap', 'affordable', 'value'],
      quality: ['quality', 'durable', 'reliable', 'well-made', 'craftsmanship'],
      sustainability: ['sustainable', 'eco', 'green', 'environmental', 'ethical'],
      brand: ['brand', 'reputation', 'trust', 'known', 'established'],
      innovation: ['new', 'innovative', 'unique', 'different', 'revolutionary'],
      convenience: ['convenient', 'easy', 'simple', 'hassle-free', 'quick']
    };
    
    for (const [factor, keywords] of Object.entries(factorKeywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        factors.push(factor);
      }
    }
    
    return factors.slice(0, 3); // Return top 3 factors
  }
  
  extractKeyFactorsFromResponses(responses) {
    const factorCounts = {};
    
    responses.forEach(r => {
      if (r.question && r.question.toLowerCase().includes('important')) {
        const factor = this.identifyFactorFromQuestion(r.question);
        if (factor) {
          factorCounts[factor] = (factorCounts[factor] || 0) + 1;
        }
      }
    });
    
    return Object.entries(factorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([factor]) => factor);
  }
  
  identifyFactorFromQuestion(question) {
    const q = question.toLowerCase();
    
    if (q.includes('price') || q.includes('cost')) return 'price';
    if (q.includes('quality') || q.includes('durable')) return 'quality';
    if (q.includes('sustain') || q.includes('eco')) return 'sustainability';
    if (q.includes('brand') || q.includes('reputation')) return 'brand';
    if (q.includes('innovat') || q.includes('new')) return 'innovation';
    if (q.includes('conveni') || q.includes('easy')) return 'convenience';
    
    return null;
  }
  
  identifyKeyFactors(marketingContent, valueSystem) {
    const factors = [];
    const content = marketingContent.toLowerCase();
    
    // Check content for factor mentions
    if (content.includes('price') || content.includes('sale') || content.includes('discount')) {
      factors.push('price');
    }
    if (content.includes('quality') || content.includes('premium') || content.includes('durable')) {
      factors.push('quality');
    }
    if (content.includes('sustain') || content.includes('eco') || content.includes('green')) {
      factors.push('sustainability');
    }
    
    // Add top value system factors
    if (valueSystem) {
      const topValues = Object.entries(valueSystem)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([key]) => key);
      
      topValues.forEach(value => {
        if (!factors.includes(value)) {
          factors.push(value);
        }
      });
    }
    
    return factors.slice(0, 3);
  }
}