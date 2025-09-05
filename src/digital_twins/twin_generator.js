import fetch from 'node-fetch';

export class DynamicTwinGenerator {
  constructor(vectorStore, datasetConfig) {
    this.vectorStore = vectorStore;
    this.config = datasetConfig;
    this.claudeApiUrl = "https://api.anthropic.com/v1/messages";
  }
  
  async generateTwin(segment, variant = 0) {
    // Get segment profile from vector store
    let segmentProfile = await this.vectorStore.getSegmentProfile(segment);
    
    if (!segmentProfile) {
      console.warn(`No segment profile found for ${segment}, using defaults`);
      segmentProfile = this.getDefaultSegmentProfile(segment);
    }
    
    // Find representative responses for this segment
    const representativeResponses = await this.vectorStore.findRepresentativeResponses(
      segment,
      20
    );
    
    // Generate persona using segment data
    const persona = await this.generatePersona(
      segmentProfile,
      representativeResponses,
      variant
    );
    
    // Create response patterns from actual data
    const responsePatterns = await this.extractResponsePatterns(
      representativeResponses
    );
    
    const twin = {
      id: `${this.config.id}_${segment}_${Date.now()}_${variant}`,
      datasetId: this.config.id,
      segment: segment,
      persona: persona,
      valueSystem: segmentProfile.value_system || segmentProfile.valueSystem || {},
      responsePatterns: responsePatterns,
      decisionModel: this.createDecisionModel(segmentProfile),
      characteristics: segmentProfile.characteristics || {}
    };
    
    // Store in vector database for retrieval
    await this.vectorStore.storePersona(twin);
    
    return twin;
  }
  
  getDefaultSegmentProfile(segment) {
    const defaults = {
      characteristics: {
        main: "Default consumer segment",
        behavior: "Standard purchasing behavior",
        shopping: "Regular shopping patterns",
        influence: "Average social influence"
      },
      value_system: {
        sustainability: 0.5,
        priceConsciousness: 0.5,
        brandLoyalty: 0.5,
        environmentalConcern: 0.5,
        socialInfluence: 0.5,
        quality: 0.5,
        innovation: 0.5
      }
    };
    
    return defaults;
  }
  
  async generatePersona(segmentProfile, responses, variant) {
    // Extract demographic patterns from responses
    const demographics = this.extractDemographics(responses);
    
    // Check if we have Claude API access
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (apiKey && apiKey !== 'your_api_key_here') {
      try {
        return await this.generatePersonaWithClaude(
          segmentProfile, 
          demographics, 
          variant
        );
      } catch (error) {
        console.error('Error generating persona with Claude:', error);
      }
    }
    
    // Fallback persona generation
    return this.generateFallbackPersona(segmentProfile, demographics, variant);
  }
  
  async generatePersonaWithClaude(segmentProfile, demographics, variant) {
    const prompt = `Create a realistic persona for a consumer segment with these characteristics:
${JSON.stringify(segmentProfile.characteristics, null, 2)}

Based on these demographic patterns:
${JSON.stringify(demographics, null, 2)}

Create persona variant ${variant + 1} with:
- Name (culturally appropriate)
- Age (within segment range)
- Occupation (matching segment profile)
- Location (if relevant)
- Lifestyle details
- Shopping habits
- Media consumption
- Personal values
- Hobbies and interests

Make it feel like a real person, not a stereotype. Format as JSON.`;

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
        messages: [{ role: "user", content: prompt }]
      })
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const data = await response.json();
    return JSON.parse(data.content[0].text);
  }
  
  generateFallbackPersona(segmentProfile, demographics, variant) {
    const personas = [
      {
        name: "Sarah Chen",
        age: 32,
        occupation: "Marketing Manager",
        location: "San Francisco, CA",
        lifestyle: "Active urban professional who values work-life balance",
        shoppingHabits: "Researches products online, shops both online and in-store",
        mediaConsumption: "Instagram, LinkedIn, podcasts during commute",
        personalValues: "Authenticity, sustainability, personal growth",
        hobbies: "Yoga, hiking, trying new restaurants, reading"
      },
      {
        name: "Michael Rodriguez",
        age: 28,
        occupation: "Software Developer",
        location: "Austin, TX",
        lifestyle: "Tech-savvy early adopter with environmental consciousness",
        shoppingHabits: "Primarily online, uses price comparison tools",
        mediaConsumption: "Reddit, YouTube, tech blogs, Twitter",
        personalValues: "Innovation, efficiency, environmental responsibility",
        hobbies: "Gaming, coding side projects, cycling, music festivals"
      },
      {
        name: "Jennifer Williams",
        age: 45,
        occupation: "Small Business Owner",
        location: "Denver, CO",
        lifestyle: "Family-oriented entrepreneur balancing work and home life",
        shoppingHabits: "Values quality over quantity, loyal to trusted brands",
        mediaConsumption: "Facebook, local news, business podcasts",
        personalValues: "Family, community, quality, reliability",
        hobbies: "Family activities, cooking, local community events"
      },
      {
        name: "David Thompson",
        age: 38,
        occupation: "Teacher",
        location: "Portland, OR",
        lifestyle: "Community-focused educator with strong social values",
        shoppingHabits: "Supports local businesses, considers ethical implications",
        mediaConsumption: "NPR, educational content, Instagram",
        personalValues: "Education, community impact, social justice",
        hobbies: "Volunteering, reading, gardening, local arts"
      },
      {
        name: "Lisa Park",
        age: 26,
        occupation: "Graphic Designer",
        location: "Los Angeles, CA",
        lifestyle: "Creative professional in the gig economy",
        shoppingHabits: "Trend-conscious, influenced by social media",
        mediaConsumption: "TikTok, Instagram, Pinterest, design blogs",
        personalValues: "Creativity, self-expression, flexibility",
        hobbies: "Photography, fashion, art galleries, travel"
      },
      {
        name: "Robert Anderson",
        age: 52,
        occupation: "Financial Advisor",
        location: "Chicago, IL",
        lifestyle: "Established professional focused on stability",
        shoppingHabits: "Brand loyal, values service and reputation",
        mediaConsumption: "LinkedIn, financial news, traditional media",
        personalValues: "Stability, tradition, professional success",
        hobbies: "Golf, wine tasting, classical music, investing"
      }
    ];
    
    // Select persona based on variant and modify based on segment
    const basePersona = personas[variant % personas.length];
    
    // Adjust persona based on segment characteristics
    const valueSystem = segmentProfile.value_system || segmentProfile.valueSystem || {};
    
    if (valueSystem.sustainability > 0.7) {
      basePersona.personalValues = basePersona.personalValues.replace(
        basePersona.personalValues.split(',')[0],
        "Environmental sustainability"
      );
      basePersona.shoppingHabits += ", prioritizes eco-friendly products";
    }
    
    if (valueSystem.priceConsciousness > 0.7) {
      basePersona.shoppingHabits += ", actively seeks deals and discounts";
      basePersona.personalValues += ", financial prudence";
    }
    
    if (valueSystem.innovation > 0.7) {
      basePersona.lifestyle += ", early technology adopter";
      basePersona.mediaConsumption += ", tech news sites";
    }
    
    return basePersona;
  }
  
  extractDemographics(responses) {
    const demographics = {
      ageRange: [25, 55],
      commonOccupations: [],
      locations: [],
      interests: []
    };
    
    // Extract patterns from responses (simplified)
    if (responses && responses.length > 0) {
      // Look for age-related responses
      const ageQuestions = responses.filter(r => 
        r.question && r.question.toLowerCase().includes('age')
      );
      
      if (ageQuestions.length > 0) {
        const ages = ageQuestions
          .map(r => parseInt(r.answer))
          .filter(age => !isNaN(age));
        
        if (ages.length > 0) {
          demographics.ageRange = [
            Math.min(...ages),
            Math.max(...ages)
          ];
        }
      }
      
      // Look for occupation-related responses
      const occupationQuestions = responses.filter(r =>
        r.question && (
          r.question.toLowerCase().includes('occupation') ||
          r.question.toLowerCase().includes('profession') ||
          r.question.toLowerCase().includes('work')
        )
      );
      
      demographics.commonOccupations = occupationQuestions
        .map(r => r.answer)
        .filter(a => a && typeof a === 'string')
        .slice(0, 5);
    }
    
    return demographics;
  }
  
  extractResponsePatterns(responses) {
    const patterns = {
      vocabulary: {},
      sentimentRange: {
        positive: 0,
        neutral: 0,
        negative: 0
      },
      decisionFactors: [],
      priceThresholds: {},
      brandAffinities: {},
      responseLength: {
        min: 0,
        max: 0,
        avg: 0
      }
    };
    
    if (!responses || responses.length === 0) {
      return patterns;
    }
    
    let totalLength = 0;
    let minLength = Infinity;
    let maxLength = 0;
    
    // Analyze language patterns
    responses.forEach(r => {
      if (r.answer && typeof r.answer === 'string') {
        // Extract vocabulary frequency
        const words = r.answer.toLowerCase().split(/\s+/);
        words.forEach(word => {
          // Clean word (remove punctuation)
          word = word.replace(/[^\w]/g, '');
          if (word.length > 3) { // Only count words longer than 3 chars
            patterns.vocabulary[word] = (patterns.vocabulary[word] || 0) + 1;
          }
        });
        
        // Track response length
        const length = r.answer.length;
        totalLength += length;
        minLength = Math.min(minLength, length);
        maxLength = Math.max(maxLength, length);
        
        // Simple sentiment analysis
        const posWords = ['good', 'great', 'excellent', 'love', 'best', 'amazing', 'wonderful'];
        const negWords = ['bad', 'poor', 'terrible', 'hate', 'worst', 'awful', 'horrible'];
        
        const answerLower = r.answer.toLowerCase();
        
        if (posWords.some(word => answerLower.includes(word))) {
          patterns.sentimentRange.positive++;
        } else if (negWords.some(word => answerLower.includes(word))) {
          patterns.sentimentRange.negative++;
        } else {
          patterns.sentimentRange.neutral++;
        }
        
        // Extract decision factors from importance questions
        if (r.question && r.question.toLowerCase().includes('important')) {
          if (typeof r.answer === 'number' && r.answer > 5) {
            patterns.decisionFactors.push(r.question);
          }
        }
      }
    });
    
    // Sort vocabulary by frequency
    patterns.vocabulary = Object.entries(patterns.vocabulary)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50) // Top 50 words
      .reduce((obj, [word, count]) => ({ ...obj, [word]: count }), {});
    
    // Calculate response length statistics
    if (responses.length > 0) {
      patterns.responseLength = {
        min: minLength === Infinity ? 0 : minLength,
        max: maxLength,
        avg: Math.round(totalLength / responses.length)
      };
    }
    
    // Limit decision factors to top 5
    patterns.decisionFactors = patterns.decisionFactors.slice(0, 5);
    
    return patterns;
  }
  
  createDecisionModel(segmentProfile) {
    const valueSystem = segmentProfile.value_system || segmentProfile.valueSystem || {};
    
    return {
      primaryFactors: this.extractPrimaryFactors(valueSystem),
      thresholds: this.calculateThresholds(valueSystem),
      tradeoffs: this.defineTradeoffs(valueSystem)
    };
  }
  
  extractPrimaryFactors(valueSystem) {
    // Sort value system by importance
    const factors = Object.entries(valueSystem)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([factor, weight]) => ({
        factor,
        weight,
        importance: this.getImportanceLevel(weight)
      }));
    
    return factors;
  }
  
  getImportanceLevel(weight) {
    if (weight > 0.8) return 'critical';
    if (weight > 0.6) return 'high';
    if (weight > 0.4) return 'medium';
    if (weight > 0.2) return 'low';
    return 'minimal';
  }
  
  calculateThresholds(valueSystem) {
    return {
      priceAcceptance: 1 - (valueSystem.priceConsciousness || 0.5),
      qualityMinimum: valueSystem.quality || 0.5,
      sustainabilityRequirement: valueSystem.sustainability || 0.3,
      brandImportance: valueSystem.brandLoyalty || 0.5
    };
  }
  
  defineTradeoffs(valueSystem) {
    const tradeoffs = [];
    
    // Price vs Quality
    if (valueSystem.priceConsciousness > 0.6 && valueSystem.quality > 0.6) {
      tradeoffs.push({
        type: 'price_quality',
        description: 'Willing to pay more for significantly better quality',
        threshold: 0.7
      });
    }
    
    // Sustainability vs Price
    if (valueSystem.sustainability > 0.6) {
      tradeoffs.push({
        type: 'sustainability_price',
        description: 'Will pay premium for sustainable options',
        threshold: valueSystem.sustainability
      });
    }
    
    // Brand vs Innovation
    if (valueSystem.brandLoyalty < 0.4 && valueSystem.innovation > 0.6) {
      tradeoffs.push({
        type: 'brand_innovation',
        description: 'Will try new brands for innovative features',
        threshold: 0.6
      });
    }
    
    return tradeoffs;
  }
}