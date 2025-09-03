import { pipeline } from '@xenova/transformers';
import { getSurveyResponseLoader } from '../data_processing/survey_response_loader.js';

export class SemanticResponseEngine {
  constructor(twin, vectorStore) {
    this.twin = twin;
    this.vectorStore = vectorStore;
    this.embedder = null;
    this.segmentProfiles = this.initializeSegmentProfiles();
    this.embeddingCache = new Map();
    this.themeEmbeddings = {};
    this.valueEmbeddings = {};
    this.toneEmbeddings = {};
    this.surveyLoader = null;
    this.segmentSurveyData = null;
  }
  
  async initialize() {
    if (!this.embedder) {
      try {
        this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        console.log('Semantic engine initialized');
        
        // Load actual survey responses
        this.surveyLoader = await getSurveyResponseLoader();
        this.segmentSurveyData = await this.surveyLoader.loadResponses();
        
        // Pre-compute theme embeddings for faster response
        await this.precomputeEmbeddings();
        
        // Pre-compute survey response embeddings
        await this.embedSurveyResponses();
      } catch (error) {
        console.error('Failed to initialize embedder:', error);
      }
    }
  }
  
  async embedSurveyResponses() {
    console.log('Embedding survey responses for semantic search...');
    
    // Store embedded survey responses for each segment
    this.embeddedSurveyResponses = {};
    
    for (const [segment, responses] of Object.entries(this.segmentSurveyData)) {
      this.embeddedSurveyResponses[segment] = [];
      
      for (const response of responses) {
        // Create searchable text from survey responses
        const searchableText = this.createSearchableText(response);
        
        if (searchableText) {
          const embedding = await this.embedText(searchableText);
          
          this.embeddedSurveyResponses[segment].push({
            ...response,
            searchableText,
            embedding
          });
        }
      }
      
      console.log(`Embedded ${this.embeddedSurveyResponses[segment].length} responses for ${segment}`);
    }
  }
  
  createSearchableText(response) {
    const parts = [];
    
    // Add key survey responses to searchable text
    if (response.sustainability) {
      parts.push(`Sustainability importance: ${response.sustainability}/5`);
    }
    if (response.priceSensitivity) {
      parts.push(`Price sensitivity: ${response.priceSensitivity}/5`);
    }
    if (response.brandValues) {
      parts.push(`Brand values alignment: ${response.brandValues}/5`);
    }
    if (response.willingnessToPay) {
      parts.push(`Willing to pay premium: ${response.willingnessToPay}/5`);
    }
    
    // Add example responses
    if (response.exampleResponses && response.exampleResponses.length > 0) {
      response.exampleResponses.forEach(ex => {
        parts.push(ex.response);
      });
    }
    
    return parts.join('. ');
  }
  
  async findSimilarSurveyResponses(marketingContent, segment, limit = 3) {
    const contentEmbedding = await this.embedText(marketingContent);
    if (!contentEmbedding) return [];
    
    const segmentResponses = this.embeddedSurveyResponses[segment] || [];
    if (segmentResponses.length === 0) return [];
    
    // Calculate similarity scores
    const scored = segmentResponses.map(response => ({
      ...response,
      similarity: this.cosineSimilarity(contentEmbedding, response.embedding)
    }));
    
    // Sort by similarity and return top matches
    return scored
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }
  
  async precomputeEmbeddings() {
    console.log('Pre-computing theme and value embeddings...');
    
    // Pre-compute theme embeddings
    const themeDefinitions = {
      sustainability: "environmental sustainability eco-friendly sustainable green recycled renewable ocean conservation carbon neutral ethical responsible",
      lifestyle: "beach lifestyle surf culture adventure outdoor fun social cool trendy fashion style",
      performance: "high performance quality durable professional advanced features powerful reliable tested proven",
      value: "affordable price discount sale value deal offer savings budget cost-effective cheap",
      brand: "brand reputation heritage trusted established premium luxury exclusive authentic original",
      social: "friends community together group crew team social gathering party brotherhood sisterhood",
      innovation: "innovative revolutionary breakthrough cutting-edge latest technology advanced new modern future"
    };
    
    for (const [theme, description] of Object.entries(themeDefinitions)) {
      this.themeEmbeddings[theme] = await this.embedText(description);
    }
    
    // Pre-compute tone embeddings
    const toneDefinitions = {
      aggressive: "aggressive intense extreme hardcore bold edgy raw powerful fierce",
      aspirational: "dream aspire achieve success lifestyle luxury premium elite exclusive",
      inclusive: "everyone together community inclusive welcoming friendly accessible open",
      exclusive: "exclusive elite premium select limited special vip members only",
      playful: "fun playful exciting adventure party good times joy happy carefree",
      serious: "professional serious performance technical quality precision excellence",
      authentic: "real genuine authentic honest transparent true original sincere",
      commercial: "buy now purchase sale discount offer limited time deal promotion"
    };
    
    for (const [tone, description] of Object.entries(toneDefinitions)) {
      this.toneEmbeddings[tone] = await this.embedText(description);
    }
    
    // Pre-compute segment value embeddings
    for (const [segment, profile] of Object.entries(this.segmentProfiles)) {
      this.valueEmbeddings[segment] = {};
      for (const value of profile.values) {
        this.valueEmbeddings[segment][value] = await this.embedText(value);
      }
    }
    
    console.log('Pre-computation complete. Cached embeddings:', {
      themes: Object.keys(this.themeEmbeddings).length,
      tones: Object.keys(this.toneEmbeddings).length,
      segments: Object.keys(this.valueEmbeddings).length
    });
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
    // Check cache first
    if (this.embeddingCache.has(text)) {
      return this.embeddingCache.get(text);
    }
    
    if (!this.embedder) await this.initialize();
    if (!this.embedder) return null;
    
    try {
      const output = await this.embedder(text, { pooling: 'mean', normalize: true });
      const embedding = Array.from(output.data);
      
      // Cache the embedding (limit cache size to prevent memory issues)
      if (this.embeddingCache.size < 1000) {
        this.embeddingCache.set(text, embedding);
      }
      
      return embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      return null;
    }
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
    const themes = {};
    
    // Use pre-computed theme embeddings for fast similarity calculation
    for (const [theme, themeEmbedding] of Object.entries(this.themeEmbeddings)) {
      if (themeEmbedding && embedding) {
        themes[theme] = this.cosineSimilarity(embedding, themeEmbedding);
      } else {
        themes[theme] = 0;
      }
    }
    
    // Normalize scores to 0-1 range and enhance based on explicit mentions
    const contentLower = content.toLowerCase();
    
    // Boost scores for explicit keyword mentions
    if (contentLower.includes('sustain') || contentLower.includes('eco') || contentLower.includes('green')) {
      themes.sustainability = Math.min(1, themes.sustainability * 1.5);
    }
    if (contentLower.includes('price') || contentLower.includes('sale') || contentLower.includes('discount')) {
      themes.value = Math.min(1, themes.value * 1.5);
    }
    if (contentLower.includes('surf') || contentLower.includes('beach') || contentLower.includes('wave')) {
      themes.lifestyle = Math.min(1, themes.lifestyle * 1.3);
    }
    
    return themes;
  }
  
  async analyzeTone(content, embedding) {
    const toneAspects = {};
    
    // Use pre-computed tone embeddings for fast similarity calculation
    for (const [tone, toneEmbedding] of Object.entries(this.toneEmbeddings)) {
      if (toneEmbedding && embedding) {
        toneAspects[tone] = this.cosineSimilarity(embedding, toneEmbedding);
      } else {
        toneAspects[tone] = 0;
      }
    }
    
    return toneAspects;
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
    
    // Find similar survey responses from real data
    const similarSurveyResponses = await this.findSimilarSurveyResponses(
      marketingContent,
      this.twin.segment,
      5 // Get top 5 similar responses
    );
    
    // Calculate relevance scores for segment values
    const valueScores = await this.calculateValueAlignment(analysis, profile);
    
    // Determine sentiment based on alignment and actual survey data
    const sentiment = this.determineSentimentWithSurveyData(
      valueScores, 
      analysis, 
      similarSurveyResponses
    );
    
    // Generate contextual response using real survey data
    const response = await this.constructResponseWithSurveyData(
      analysis,
      valueScores,
      sentiment,
      profile,
      similarSurveyResponses
    );
    
    return {
      text: response.text,
      sentiment: sentiment.label,
      purchaseIntent: sentiment.purchaseIntent,
      themes: analysis.themes,
      valueAlignment: valueScores,
      basedOnSurveyData: similarSurveyResponses.length > 0,
      surveyRespondents: similarSurveyResponses.map(r => r.respondentId),
      timestamp: new Date().toISOString(),
      generatedBy: 'semantic-engine-with-survey-data'
    };
  }
  
  async calculateValueAlignment(analysis, profile) {
    const scores = {};
    const segment = this.twin.segment;
    
    // Use pre-computed value embeddings for this segment
    if (this.valueEmbeddings[segment]) {
      for (const [value, valueEmbedding] of Object.entries(this.valueEmbeddings[segment])) {
        if (valueEmbedding && analysis.embedding) {
          scores[value] = this.cosineSimilarity(analysis.embedding, valueEmbedding);
        } else {
          scores[value] = 0;
        }
      }
    } else {
      // Fallback to computing on-the-fly if pre-computed not available
      for (const value of profile.values) {
        const valueEmbedding = await this.embedText(value);
        scores[value] = this.cosineSimilarity(analysis.embedding, valueEmbedding) || 0;
      }
    }
    
    return scores;
  }
  
  determineSentimentWithSurveyData(valueScores, analysis, surveyResponses) {
    // If we have survey data, use it to inform sentiment
    if (surveyResponses && surveyResponses.length > 0) {
      // Average the actual survey scores
      const avgWillingnessToPay = surveyResponses
        .filter(r => r.willingnessToPay)
        .reduce((sum, r) => sum + r.willingnessToPay, 0) / surveyResponses.length || 0;
      
      const avgSustainability = surveyResponses
        .filter(r => r.sustainability)
        .reduce((sum, r) => sum + r.sustainability, 0) / surveyResponses.length || 0;
      
      const avgPriceSensitivity = surveyResponses
        .filter(r => r.priceSensitivity)
        .reduce((sum, r) => sum + r.priceSensitivity, 0) / surveyResponses.length || 0;
      
      // Use survey data to determine sentiment
      const { segment } = this.twin;
      
      // Map survey scores to purchase intent
      let purchaseIntent = 5;
      
      if (segment === 'Leader') {
        // Leaders care most about sustainability
        if (analysis.themes.sustainability > 0.5 && avgSustainability > 3.5) {
          purchaseIntent = Math.round(7 + (avgWillingnessToPay / 5) * 2);
          return { label: 'positive', purchaseIntent };
        } else if (analysis.themes.sustainability > 0.3) {
          purchaseIntent = Math.round(5 + (avgSustainability / 5) * 2);
          return { label: 'neutral', purchaseIntent };
        } else {
          purchaseIntent = Math.round(2 + (avgSustainability / 5) * 2);
          return { label: 'negative', purchaseIntent };
        }
      } else if (segment === 'Leaning') {
        // Balance multiple factors
        const balanceScore = (analysis.themes.sustainability * avgSustainability/5 * 0.4 + 
                             analysis.themes.performance * 0.3 + 
                             analysis.themes.value * (5 - avgPriceSensitivity)/5 * 0.3);
        purchaseIntent = Math.round(4 + balanceScore * 4);
        return {
          label: balanceScore > 0.5 ? 'positive' : balanceScore > 0.3 ? 'neutral' : 'negative',
          purchaseIntent
        };
      } else if (segment === 'Learner') {
        // Price is key
        if (analysis.themes.value > 0.5 && avgPriceSensitivity > 3) {
          purchaseIntent = Math.round(6 + (avgPriceSensitivity / 5) * 2);
          return { label: 'positive', purchaseIntent };
        } else {
          purchaseIntent = Math.round(3 + (5 - avgPriceSensitivity) / 5 * 2);
          return { label: 'neutral', purchaseIntent };
        }
      } else if (segment === 'Laggard') {
        // Only care about price
        if (analysis.themes.value > 0.6 && avgPriceSensitivity > 4) {
          purchaseIntent = Math.round(4 + (avgPriceSensitivity / 5) * 2);
          return { label: 'positive', purchaseIntent };
        } else {
          purchaseIntent = 2;
          return { label: 'negative', purchaseIntent };
        }
      }
    }
    
    // Fallback to original method if no survey data
    return this.determineSentiment(valueScores, analysis);
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
  
  async constructResponseWithSurveyData(analysis, valueScores, sentiment, profile, surveyResponses) {
    const { segment } = this.twin;
    const { themes, tone, content } = analysis;
    
    // Use actual survey responses to inform the response
    if (surveyResponses && surveyResponses.length > 0) {
      // Pick a random survey respondent to base personality on
      const primaryRespondent = surveyResponses[0];
      const secondaryRespondent = surveyResponses[1] || primaryRespondent;
      
      // Build response based on actual survey data patterns
      let response = '';
      
      // Get example responses from similar respondents
      const exampleResponses = [];
      surveyResponses.forEach(r => {
        if (r.exampleResponses) {
          exampleResponses.push(...r.exampleResponses);
        }
      });
      
      // Segment-specific response using survey data
      switch(segment) {
        case 'Leader':
          // Use actual Leader responses
          if (themes.sustainability > 0.5 && primaryRespondent.sustainability >= 4) {
            response = this.selectVariation([
              `Like ${Math.round(primaryRespondent.sustainability * 20)}% of us Leaders, I need to see genuine environmental commitment. ${primaryRespondent.willingnessToPay >= 4 ? "I'm willing to pay the premium for real sustainability." : "But it needs to be authentic, not greenwashing."}`,
              `This ${themes.sustainability > 0.7 ? "actually shows" : "claims"} environmental focus. As someone who ${primaryRespondent.activism >= 4 ? "actively campaigns for ocean protection" : "prioritizes sustainable brands"}, ${themes.sustainability > 0.7 ? "this resonates with my values" : "I need more proof"}.`,
              exampleResponses.find(r => r.topic === 'sustainability')?.response || "Environmental impact drives my purchasing decisions."
            ]);
          } else {
            response = this.selectVariation([
              `${primaryRespondent.envEvangelist >= 4 ? "As an environmental advocate" : "As someone who values sustainability"}, I don't see the commitment here. ${secondaryRespondent.brandValues >= 4 ? "Brand values matter more than marketing claims." : "Actions speak louder than ads."}`,
              `This doesn't align with what ${Math.round(125 * primaryRespondent.compositeScore / 5)} of us Leaders look for. We need ${primaryRespondent.willingnessToPay >= 4 ? "substance worth paying premium for" : "real environmental action"}.`,
              exampleResponses.find(r => r.topic === 'brand')?.response || "I support brands that protect our oceans."
            ]);
          }
          break;
          
        case 'Leaning':
          // Use actual Leaning responses
          const balanceScore = (themes.sustainability * primaryRespondent.sustainability/5 + 
                               themes.value * (5 - primaryRespondent.priceSensitivity)/5) / 2;
          
          if (balanceScore > 0.5) {
            response = this.selectVariation([
              `This balances ${primaryRespondent.sustainability >= 3 ? "eco-consciousness" : "quality"} with ${primaryRespondent.priceSensitivity <= 3 ? "reasonable value" : "affordability"}. ${primaryRespondent.brandValues >= 3 ? "That's what I look for." : "Worth considering."}`,
              `Like ${Math.round(226 * primaryRespondent.compositeScore / 4)} respondents in my segment, I appreciate ${themes.sustainability > 0.3 ? "some sustainability effort" : "quality products"} ${primaryRespondent.priceSensitivity >= 3 ? "at fair prices" : "that last"}.`,
              exampleResponses.find(r => r.score >= 3)?.response || "I balance my values with practical needs."
            ]);
          } else {
            response = this.selectVariation([
              `${primaryRespondent.priceSensitivity >= 3 ? "The value proposition isn't clear" : "Not sure about the quality"}. I need ${primaryRespondent.sustainability >= 3 ? "both performance and some eco-features" : "proven durability"}.`,
              exampleResponses.find(r => r.topic === 'price')?.response || "I need good value for my money."
            ]);
          }
          break;
          
        case 'Learner':
          // Use actual Learner responses
          if (themes.value > 0.5 && primaryRespondent.priceSensitivity >= 3) {
            response = this.selectVariation([
              `${primaryRespondent.priceSensitivity >= 4 ? "Price is key for me!" : "Good value here!"} ${secondaryRespondent.sustainability >= 2 ? "The eco stuff is a nice bonus but" : "As long as it works,"} ${primaryRespondent.priceSensitivity >= 4 ? "I'm all about the deals" : "I'll consider it"}.`,
              `Like ${Math.round(377 * primaryRespondent.priceSensitivity / 5)} Learners, I focus on ${themes.value > 0.6 ? "getting the best price" : "affordable options"}. ${themes.lifestyle > 0.5 ? "The cool factor helps too!" : ""}`,
              exampleResponses.find(r => r.topic === 'price')?.response || "Price is my main factor."
            ]);
          } else {
            response = this.selectVariation([
              `${themes.lifestyle > 0.5 ? "Looks cool but" : "Interesting, but"} what's the price? ${primaryRespondent.priceSensitivity >= 4 ? "I need to compare with cheaper options" : "Need to know if it's worth it"}.`,
              exampleResponses[Math.floor(Math.random() * exampleResponses.length)]?.response || "I'm curious but budget-conscious."
            ]);
          }
          break;
          
        case 'Laggard':
          // Use actual Laggard responses
          if (themes.value > 0.6 && primaryRespondent.priceSensitivity >= 4) {
            response = this.selectVariation([
              `${primaryRespondent.priceSensitivity === 5 ? "Finally, someone talks price!" : "If it's actually cheap, maybe."} ${primaryRespondent.sustainability <= 2 ? "Skip the eco nonsense" : "Don't care about the green stuff"}.`,
              `Like the ${Math.round(277 * primaryRespondent.priceSensitivity / 5)} most price-focused buyers, I only care if it's ${themes.value > 0.7 ? "the cheapest option" : "affordable and works"}.`
            ]);
          } else {
            response = this.selectVariation([
              `${themes.sustainability > 0.3 ? "All this eco talk means higher prices." : "Probably overpriced."} ${primaryRespondent.priceSensitivity === 5 ? "I'll stick to discount stores" : "Not interested"}.`,
              exampleResponses.find(r => r.topic === 'price' && r.score >= 4)?.response || "Just need something cheap that works."
            ]);
          }
          break;
      }
      
      return { text: response };
    }
    
    // Fallback to original method if no survey data
    return this.constructResponse(analysis, valueScores, sentiment, profile);
  }
  
  selectVariation(options) {
    // Filter out undefined/null options
    const valid = options.filter(o => o);
    if (valid.length === 0) return "I need more information to form an opinion.";
    return valid[Math.floor(Math.random() * valid.length)];
  }
  
  async constructResponse(analysis, valueScores, sentiment, profile) {
    const { segment } = this.twin;
    const { themes, tone, content } = analysis;
    
    // Find top themes
    const sortedThemes = Object.entries(themes).sort((a, b) => b[1] - a[1]);
    const [dominantTheme, themeScore] = sortedThemes[0];
    const [secondaryTheme, secondaryScore] = sortedThemes[1] || ['', 0];
    
    // Find top tone aspects
    const sortedTones = Object.entries(tone).sort((a, b) => b[1] - a[1]);
    const [dominantTone, toneScore] = sortedTones[0];
    
    // Build response based on semantic understanding with more variation
    let response = '';
    const rand = Math.random();
    
    // Segment-specific response construction with multiple variations
    switch(segment) {
      case 'Leader':
        // Opening based on sustainability alignment
        if (themes.sustainability > 0.6) {
          const openings = [
            `This actually shows real environmental commitment, which resonates with me.`,
            `Finally, a brand that seems to genuinely care about sustainability.`,
            `The eco-credentials here align perfectly with my values.`,
            `I appreciate the authentic focus on environmental responsibility.`
          ];
          response = openings[Math.floor(Math.random() * openings.length)] + ' ';
        } else if (themes.sustainability > 0.3) {
          const openings = [
            `There's some sustainability messaging, but it feels surface-level.`,
            `I see hints of eco-consciousness, but need more substance.`,
            `The environmental claims need stronger backing.`
          ];
          response = openings[Math.floor(Math.random() * openings.length)] + ' ';
        } else {
          const openings = [
            `No clear sustainability focus - that's a dealbreaker for me.`,
            `Without environmental commitment, this doesn't align with my values.`,
            `I don't see any real effort toward ocean conservation or sustainability.`,
            `This ignores the environmental impact completely.`
          ];
          response = openings[Math.floor(Math.random() * openings.length)] + ' ';
        }
        
        // Add tone reaction
        if (tone.authentic > 0.5 && themes.sustainability > 0.4) {
          response += `The authentic approach is refreshing. `;
        } else if (tone.commercial > 0.6) {
          response += `The overly commercial tone undermines any environmental claims. `;
        } else if (tone.exclusive > 0.5) {
          response += `Sustainability shouldn't be exclusive - it should be accessible to all. `;
        }
        
        // Closing thought
        if (sentiment.purchaseIntent >= 7) {
          response += `I'd seriously consider supporting this brand if they maintain these standards.`;
        } else if (sentiment.purchaseIntent >= 5) {
          response += `Show me concrete actions, not just marketing promises.`;
        } else {
          response += `I'll stick with brands that truly protect what we surf in.`;
        }
        break;
        
      case 'Leaning':
        // Opening based on balance of factors
        const balanceScore = (themes.sustainability * 0.3 + themes.performance * 0.35 + themes.value * 0.35);
        
        if (balanceScore > 0.5) {
          const openings = [
            `Nice balance of quality and consciousness here.`,
            `This hits the sweet spot between performance and responsibility.`,
            `Good to see quality that doesn't ignore the environment.`
          ];
          response = openings[Math.floor(Math.random() * openings.length)] + ' ';
        } else if (themes.brand > 0.5) {
          const openings = [
            `Rip Curl has a solid reputation, which counts for something.`,
            `Known brand with decent quality, that's reassuring.`,
            `At least it's from an established surf brand.`
          ];
          response = openings[Math.floor(Math.random() * openings.length)] + ' ';
        } else {
          const openings = [
            `This could work, but I need more details.`,
            `Depends on the actual quality and price point.`,
            `Not sure this offers enough value for me.`
          ];
          response = openings[Math.floor(Math.random() * openings.length)] + ' ';
        }
        
        // Price consideration
        if (themes.value > 0.4) {
          response += `The pricing seems reasonable for what's offered. `;
        } else if (tone.exclusive > 0.5 || tone.aspirational > 0.5) {
          response += `Looks premium-priced - hope the quality justifies it. `;
        }
        
        // Closing
        if (sentiment.purchaseIntent >= 6) {
          response += `I'd consider this if it delivers on the promises.`;
        } else {
          response += `Need to compare with other options first.`;
        }
        break;
        
      case 'Learner':
        // Opening based on value and appeal
        if (themes.value > 0.5) {
          const openings = [
            `Great! Looks like a good deal here!`,
            `The price point catches my attention!`,
            `This might actually fit my budget!`,
            `Finally something that looks affordable!`
          ];
          response = openings[Math.floor(Math.random() * openings.length)] + ' ';
        } else if (themes.lifestyle > 0.5 && tone.playful > 0.4) {
          const openings = [
            `Love the vibe! Looks fun and cool!`,
            `The style is sick, really digging it!`,
            `This has that surf culture feel I want!`
          ];
          response = openings[Math.floor(Math.random() * openings.length)] + ' ';
        } else {
          const openings = [
            `Looks cool but what's the damage to my wallet?`,
            `Interesting, but is it worth the money?`,
            `Need to know if this fits my budget first.`
          ];
          response = openings[Math.floor(Math.random() * openings.length)] + ' ';
        }
        
        // Additional interest points
        if (themes.social > 0.4) {
          response += `Would be cool to rock this with the crew. `;
        } else if (themes.innovation > 0.5) {
          response += `The new features are pretty interesting. `;
        }
        
        // Closing based on intent
        if (sentiment.purchaseIntent >= 6) {
          response += `Might grab this if I can find a discount code!`;
        } else {
          response += `I'll wait for a sale or check out cheaper alternatives.`;
        }
        break;
        
      case 'Laggard':
        // Opening - always skeptical
        if (themes.value > 0.6) {
          const openings = [
            `At least they're talking about price.`,
            `If it's actually cheap, I might look at it.`,
            `Better be as affordable as they claim.`
          ];
          response = openings[Math.floor(Math.random() * openings.length)] + ' ';
        } else {
          const openings = [
            `All marketing fluff, no substance.`,
            `More overpriced surf gear, typical.`,
            `They're hiding the price - never a good sign.`,
            `Fancy words mean expensive products.`
          ];
          response = openings[Math.floor(Math.random() * openings.length)] + ' ';
        }
        
        // React to marketing style
        if (dominantTone === 'aspirational' || dominantTone === 'exclusive') {
          response += `All this ${dominantTone} nonsense just inflates the price. `;
        } else if (themes.sustainability > 0.4) {
          response += `The eco stuff is just an excuse to charge more. `;
        }
        
        // Closing - always practical
        if (sentiment.purchaseIntent >= 5) {
          response += `Show me the price tag and durability specs, skip the rest.`;
        } else {
          response += `I'll get my gear at the discount store, thanks.`;
        }
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