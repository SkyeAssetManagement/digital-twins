import { pipeline } from '@xenova/transformers';

export class SemanticResponseEngine {
  constructor(twin, vectorStore) {
    this.twin = twin;
    this.vectorStore = vectorStore;
    this.embedder = null;
    this.segmentProfiles = this.initializeSegmentProfiles();
  }
  
  async initialize() {
    if (!this.embedder) {
      try {
        this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        console.log('Semantic engine initialized');
      } catch (error) {
        console.error('Failed to initialize embedder:', error);
      }
    }
  }
  
  initializeSegmentProfiles() {
    // Define semantic concepts that each segment cares about
    // These will be embedded and used for similarity matching
    return {
      Leader: {
        values: [
          "environmental sustainability and ecological protection",
          "ethical business practices and social responsibility",
          "authentic brand values and mission-driven companies",
          "ocean conservation and marine ecosystem protection",
          "reducing carbon footprint and climate action",
          "fair trade and supply chain transparency",
          "community impact and social justice"
        ],
        triggers: {
          positive: ["sustainable materials", "eco-certified", "carbon neutral", "gives back to community"],
          negative: ["greenwashing", "exploitation", "objectification", "purely profit-driven"]
        },
        responsePatterns: [
          "I need to know about the environmental impact before I consider this",
          "Does this brand align with protecting what we love?",
          "Sustainability isn't just marketing - show me real commitment"
        ]
      },
      
      Leaning: {
        values: [
          "balance between quality and environmental consciousness",
          "good value with some sustainability features",
          "reputable brands with decent ethics",
          "practical eco-friendly options",
          "performance that doesn't sacrifice the planet"
        ],
        triggers: {
          positive: ["quality materials", "some eco features", "good reputation", "reasonable price"],
          negative: ["overpriced green premium", "poor quality", "no sustainability effort"]
        },
        responsePatterns: [
          "I like the sustainability aspect if the quality justifies it",
          "Good to see some eco-consciousness, but value matters too",
          "I'd consider this if the price premium isn't excessive"
        ]
      },
      
      Learner: {
        values: [
          "affordable pricing and good deals",
          "functional products that work well",
          "value for money comparisons",
          "basic quality at reasonable cost",
          "trendy or cool factor as a bonus"
        ],
        triggers: {
          positive: ["great price", "on sale", "good value", "looks cool", "popular"],
          negative: ["too expensive", "overpriced", "premium pricing", "not worth it"]
        },
        responsePatterns: [
          "What's the price? That's what matters most",
          "Looks cool but is it affordable?",
          "I need to compare prices with other options first"
        ]
      },
      
      Laggard: {
        values: [
          "lowest price possible",
          "basic functionality only",
          "durability and longevity",
          "no frills or extras",
          "practical use only"
        ],
        triggers: {
          positive: ["cheap", "discount", "basic", "lasts long", "simple"],
          negative: ["expensive", "fancy features", "marketing hype", "premium", "trendy"]
        },
        responsePatterns: [
          "Just tell me the price and if it works",
          "Don't care about the fancy stuff, is it cheap?",
          "All this marketing doesn't matter, just need something functional"
        ]
      }
    };
  }
  
  async embedText(text) {
    if (!this.embedder) await this.initialize();
    if (!this.embedder) return null;
    
    const output = await this.embedder(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }
  
  cosineSimilarity(vec1, vec2) {
    if (!vec1 || !vec2 || vec1.length !== vec2.length) return 0;
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }
  
  async analyzeContent(marketingContent) {
    // Embed the marketing content
    const contentEmbedding = await this.embedText(marketingContent);
    
    // Extract key themes through semantic analysis
    const themes = await this.extractThemes(marketingContent, contentEmbedding);
    
    // Analyze sentiment and tone
    const tone = await this.analyzeTone(marketingContent, contentEmbedding);
    
    return {
      embedding: contentEmbedding,
      themes,
      tone,
      content: marketingContent
    };
  }
  
  async extractThemes(content, embedding) {
    const themes = {
      sustainability: 0,
      lifestyle: 0,
      performance: 0,
      value: 0,
      brand: 0,
      social: 0,
      innovation: 0
    };
    
    // Define theme concepts
    const themeDefinitions = {
      sustainability: "environmental eco-friendly sustainable green recycled ocean-safe renewable ethical",
      lifestyle: "lifestyle beach surf adventure outdoor fun party social cool trendy",
      performance: "performance quality durable professional high-tech advanced features powerful",
      value: "price discount sale affordable cheap value deal offer savings cost",
      brand: "brand reputation trusted established premium luxury exclusive ultimate",
      social: "friends community together group crew team social gathering party",
      innovation: "new innovative revolutionary breakthrough cutting-edge latest technology advanced"
    };
    
    // Calculate semantic similarity to each theme
    for (const [theme, description] of Object.entries(themeDefinitions)) {
      const themeEmbedding = await this.embedText(description);
      if (themeEmbedding && embedding) {
        themes[theme] = this.cosineSimilarity(embedding, themeEmbedding);
      }
    }
    
    return themes;
  }
  
  async analyzeTone(content, embedding) {
    // Analyze marketing tone/style
    const toneAspects = {
      aggressive: await this.getSemanticScore(embedding, "aggressive intense extreme hardcore bold edgy"),
      aspirational: await this.getSemanticScore(embedding, "dream aspire achieve success lifestyle luxury premium"),
      inclusive: await this.getSemanticScore(embedding, "everyone together community inclusive welcoming friendly"),
      exclusive: await this.getSemanticScore(embedding, "exclusive elite premium select limited special vip"),
      playful: await this.getSemanticScore(embedding, "fun playful exciting adventure party good times"),
      serious: await this.getSemanticScore(embedding, "professional serious performance technical quality")
    };
    
    return toneAspects;
  }
  
  async getSemanticScore(contentEmbedding, conceptText) {
    const conceptEmbedding = await this.embedText(conceptText);
    return this.cosineSimilarity(contentEmbedding, conceptEmbedding);
  }
  
  async generateSemanticResponse(marketingContent) {
    await this.initialize();
    
    // Analyze the marketing content semantically
    const analysis = await this.analyzeContent(marketingContent);
    
    // Get segment-specific profile
    const profile = this.segmentProfiles[this.twin.segment];
    if (!profile) {
      return this.getFallbackResponse();
    }
    
    // Calculate relevance scores for segment values
    const valueScores = await this.calculateValueAlignment(analysis, profile);
    
    // Determine sentiment based on alignment
    const sentiment = this.determineSentiment(valueScores, analysis);
    
    // Generate contextual response
    const response = await this.constructResponse(
      analysis,
      valueScores,
      sentiment,
      profile
    );
    
    return {
      text: response.text,
      sentiment: sentiment.label,
      purchaseIntent: sentiment.purchaseIntent,
      themes: analysis.themes,
      valueAlignment: valueScores,
      timestamp: new Date().toISOString(),
      generatedBy: 'semantic-engine'
    };
  }
  
  async calculateValueAlignment(analysis, profile) {
    const scores = {};
    
    // Embed profile values and calculate alignment
    for (const value of profile.values) {
      const valueEmbedding = await this.embedText(value);
      scores[value] = this.cosineSimilarity(analysis.embedding, valueEmbedding);
    }
    
    return scores;
  }
  
  determineSentiment(valueScores, analysis) {
    const { segment } = this.twin;
    const avgAlignment = Object.values(valueScores).reduce((a, b) => a + b, 0) / Object.values(valueScores).length;
    
    // Segment-specific sentiment logic
    switch(segment) {
      case 'Leader':
        // Leaders care most about sustainability
        if (analysis.themes.sustainability > 0.6) {
          return { label: 'positive', purchaseIntent: 9 };
        } else if (analysis.themes.sustainability > 0.3) {
          return { label: 'neutral', purchaseIntent: 6 };
        } else {
          return { label: 'negative', purchaseIntent: 3 };
        }
        
      case 'Leaning':
        // Balance of factors
        const balanceScore = (analysis.themes.sustainability * 0.4 + 
                             analysis.themes.performance * 0.3 + 
                             analysis.themes.value * 0.3);
        if (balanceScore > 0.5) {
          return { label: 'positive', purchaseIntent: 7 };
        } else if (balanceScore > 0.3) {
          return { label: 'neutral', purchaseIntent: 5 };
        } else {
          return { label: 'negative', purchaseIntent: 4 };
        }
        
      case 'Learner':
        // Price is king
        if (analysis.themes.value > 0.5) {
          return { label: 'positive', purchaseIntent: 7 };
        } else if (analysis.themes.lifestyle > 0.5) {
          return { label: 'neutral', purchaseIntent: 5 };
        } else {
          return { label: 'neutral', purchaseIntent: 4 };
        }
        
      case 'Laggard':
        // Only price matters
        if (analysis.themes.value > 0.6) {
          return { label: 'positive', purchaseIntent: 6 };
        } else {
          return { label: 'negative', purchaseIntent: 2 };
        }
        
      default:
        return { label: 'neutral', purchaseIntent: 5 };
    }
  }
  
  async constructResponse(analysis, valueScores, sentiment, profile) {
    const { segment } = this.twin;
    const { themes, tone } = analysis;
    
    // Find the most relevant theme
    const topTheme = Object.entries(themes).sort((a, b) => b[1] - a[1])[0];
    const [dominantTheme, themeScore] = topTheme;
    
    // Build response based on semantic understanding
    let response = '';
    
    // Segment-specific response construction
    switch(segment) {
      case 'Leader':
        if (themes.sustainability > 0.5) {
          response = `This seems to have genuine environmental focus, which aligns with my values. `;
        } else if (themes.lifestyle > 0.5 && tone.exclusive > 0.4) {
          response = `The lifestyle marketing feels superficial. I care more about substance than image. `;
        } else {
          response = `I don't see clear environmental commitment here. `;
        }
        
        if (tone.aggressive > 0.5 || tone.exclusive > 0.5) {
          response += `The ${tone.aggressive > 0.5 ? 'aggressive' : 'exclusive'} tone is off-putting. Sustainability should be inclusive. `;
        }
        
        response += profile.responsePatterns[Math.floor(Math.random() * profile.responsePatterns.length)];
        break;
        
      case 'Leaning':
        if (themes.performance > 0.4 && themes.sustainability > 0.3) {
          response = `Good balance of performance and eco-consciousness. `;
        } else if (themes.brand > 0.5) {
          response = `Seems like a reputable brand. `;
        } else {
          response = `This could work depending on the specifics. `;
        }
        
        if (themes.value < 0.3 && themes.brand > 0.5) {
          response += `Might be pricey given the brand positioning. `;
        }
        
        response += profile.responsePatterns[Math.floor(Math.random() * profile.responsePatterns.length)];
        break;
        
      case 'Learner':
        if (themes.value > 0.5) {
          response = `Nice! Looks like there might be good value here. `;
        } else if (themes.lifestyle > 0.5 && tone.playful > 0.4) {
          response = `The vibe is cool and fun, I like that! `;
        } else {
          response = `Interesting, but I'm not sure about the cost. `;
        }
        
        if (themes.performance > 0.5) {
          response += `The performance features look impressive. `;
        }
        
        response += profile.responsePatterns[Math.floor(Math.random() * profile.responsePatterns.length)];
        break;
        
      case 'Laggard':
        if (themes.value > 0.6) {
          response = `Finally, something that might be affordable. `;
        } else if (dominantTheme === 'lifestyle' || dominantTheme === 'brand') {
          response = `All this ${dominantTheme} fluff means higher prices. `;
        } else {
          response = `Probably overpriced like everything else. `;
        }
        
        if (tone.exclusive > 0.4 || tone.aspirational > 0.4) {
          response += `The fancy marketing just adds to the cost. `;
        }
        
        response += profile.responsePatterns[Math.floor(Math.random() * profile.responsePatterns.length)];
        break;
    }
    
    return { text: response };
  }
  
  getFallbackResponse() {
    const responses = {
      Leader: "I need more information about the environmental and social impact before forming an opinion.",
      Leaning: "This might be worth considering if it offers good value and some sustainability features.",
      Learner: "I'd need to know more about the price and compare it with alternatives.",
      Laggard: "Tell me the price and whether it works. That's all that matters."
    };
    
    return {
      text: responses[this.twin.segment] || "I need more information to form an opinion.",
      sentiment: 'neutral',
      purchaseIntent: 5,
      timestamp: new Date().toISOString(),
      generatedBy: 'fallback'
    };
  }
}