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
        model: "claude-3-5-sonnet-20241022",
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
    const { persona, valueSystem, segment, characteristics, exampleResponses } = this.twin;
    
    // Build context from actual survey responses
    const responseContext = similarResponses.map(r => 
      `When asked "${r.question}", someone like you said: "${r.answer}"`
    ).join('\n');
    
    // Format persona details with market percentage if available
    const marketSize = persona?.description || '';
    const personaDetails = `${persona?.name || segment + ' Consumer'} ${marketSize}`;
    
    // Format value system
    const valueDetails = Object.entries(valueSystem || {})
      .map(([key, value]) => `- ${key}: ${typeof value === 'number' ? (value * 10).toFixed(1) + '/10' : value}`)
      .join('\n');
    
    // Add characteristics if available
    const characteristicsText = characteristics && characteristics.length > 0
      ? `\nYour key characteristics:\n${characteristics.slice(0, 4).map(c => `- ${c}`).join('\n')}`
      : '';
    
    // Add example responses if available
    const examplesText = exampleResponses 
      ? `\nExample of how you typically respond:\n${exampleResponses.priceQuestion || exampleResponses.brandQuestion || 'I evaluate products based on my values.'}`
      : '';
    
    // Segment-specific prompting
    let segmentGuidance = '';
    if (segment === 'Leader') {
      segmentGuidance = '\nAs a Leader, you prioritize sustainability and are willing to pay 25%+ premium for genuinely sustainable products. Environmental impact is crucial to your decisions.';
    } else if (segment === 'Leaning') {
      segmentGuidance = '\nAs someone Leaning toward sustainability, you balance environmental concerns with practicality. You pay 10-15% more for products that align with your values.';
    } else if (segment === 'Learner') {
      segmentGuidance = '\nAs a Learner, you are interested in sustainability but price remains your primary factor. You need education and clear value propositions.';
    } else if (segment === 'Laggard') {
      segmentGuidance = '\nAs a Laggard, you focus primarily on price and functionality. Sustainability claims do not significantly influence your purchasing decisions.';
    }
    
    return `You are ${personaDetails} who falls into the LOHAS "${segment}" category of surf clothing consumers.

Your value system:
${valueDetails || '- Balanced across all factors'}
${characteristicsText}
${segmentGuidance}
${examplesText}

${responseContext ? `\nHere are some responses from people similar to you:\n${responseContext}\n` : ''}

Now, react authentically to this Rip Curl marketing material as this persona would:
"${marketingContent}"

Respond in 2-3 sentences with your genuine, specific reaction. Consider:
1. Whether this aligns with your values (especially sustainability for Leaders)
2. Your price sensitivity and willingness to pay
3. How the brand messaging resonates with you
4. Whether you'd actually purchase Rip Curl products

Be specific to YOUR segment's perspective. Include your sentiment (positive/neutral/negative) and purchase intent (1-10 scale) at the end in this format:
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
    const hasSustainability = contentLower.includes('sustain') || contentLower.includes('eco') || contentLower.includes('green') || contentLower.includes('recycl');
    const hasDiscount = contentLower.includes('sale') || contentLower.includes('discount') || contentLower.includes('% off');
    const hasPremium = contentLower.includes('premium') || contentLower.includes('luxury') || contentLower.includes('exclusive');
    const hasInnovation = contentLower.includes('new') || contentLower.includes('innovative') || contentLower.includes('revolutionary');
    const hasSurfAction = contentLower.includes('surf') || contentLower.includes('wave') || contentLower.includes('board') || contentLower.includes('barrel');
    const hasBrand = contentLower.includes('rip curl') || contentLower.includes('billabong') || contentLower.includes('quiksilver');
    
    // Generate response based on SEGMENT FIRST, then content
    let response = '';
    let sentiment = 'neutral';
    let purchaseIntent = 5;
    
    // SEGMENT-SPECIFIC RESPONSES
    if (segment && segment.toLowerCase().includes('leader')) {
      // Leaders care about sustainability and brand values
      if (hasSustainability) {
        response = "This aligns perfectly with my values. I'm willing to pay premium for genuine sustainability. Tell me more about your supply chain and environmental impact.";
        sentiment = 'positive';
        purchaseIntent = 9;
      } else if (hasSurfAction) {
        response = "The performance looks impressive, but I need to know about the brand's environmental practices. Does Rip Curl use sustainable materials? What's their ocean conservation stance?";
        sentiment = 'neutral';
        purchaseIntent = 6;
      } else {
        response = "I prioritize brands that demonstrate real commitment to sustainability. Without clear eco-credentials, I'll probably look for alternatives that better align with my values.";
        sentiment = 'negative';
        purchaseIntent = 4;
      }
    } else if (segment && segment.toLowerCase().includes('leaning')) {
      // Leaning balance sustainability with practicality
      if (hasSustainability) {
        response = "The sustainability aspect is appealing. If the quality is good and the price premium isn't excessive (10-15% max), I'd definitely consider this.";
        sentiment = 'positive';
        purchaseIntent = 7;
      } else if (hasSurfAction) {
        response = "Looks like quality surf gear. I'd be more interested if they highlighted any sustainable practices, but performance and value are my main concerns.";
        sentiment = 'neutral';
        purchaseIntent = 6;
      } else {
        response = "I need a good balance of quality, price, and ideally some sustainability features. This might work if the value proposition is strong.";
        sentiment = 'neutral';
        purchaseIntent = 5;
      }
    } else if (segment && segment.toLowerCase().includes('learner')) {
      // Learners are price-focused but curious
      if (hasDiscount) {
        response = "Great price! That's what catches my attention. If the quality is decent for the price, I'd definitely consider it.";
        sentiment = 'positive';
        purchaseIntent = 7;
      } else if (hasSurfAction) {
        response = "Looks cool, but what's the price point? I need good value for money. The surfing action is impressive but I make decisions based on price and quality.";
        sentiment = 'neutral';
        purchaseIntent = 5;
      } else if (hasSustainability) {
        response = "Sustainability is nice to have, but only if it doesn't add too much to the price. I'd need to see clear value before paying extra for eco-features.";
        sentiment = 'neutral';
        purchaseIntent = 4;
      } else {
        response = "I'd need to know more about the price and compare it with other options. Quality matters but price is my main factor.";
        sentiment = 'neutral';
        purchaseIntent = 4;
      }
    } else if (segment && segment.toLowerCase().includes('laggard')) {
      // Laggards only care about price and function
      if (hasDiscount) {
        response = "Now you're talking! A good discount is what I'm looking for. As long as it works and the price is right, I'm interested.";
        sentiment = 'positive';
        purchaseIntent = 6;
      } else if (hasSurfAction) {
        response = "The action shots don't really influence me. What's the price? Is it durable? Those are my only concerns.";
        sentiment = 'neutral';
        purchaseIntent = 3;
      } else if (hasSustainability) {
        response = "All this eco-talk usually means higher prices. I just want functional gear at a reasonable price. The green stuff doesn't matter to me.";
        sentiment = 'negative';
        purchaseIntent = 2;
      } else {
        response = "I need to know the price first. If it's not competitively priced, I'm not interested. Functionality and cost are all that matter.";
        sentiment = 'neutral';
        purchaseIntent = 3;
      }
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