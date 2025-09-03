import kmeans from 'ml-kmeans';
import fetch from 'node-fetch';

export class SegmentDiscovery {
  constructor() {
    this.claudeApiUrl = "https://api.anthropic.com/v1/messages";
  }
  
  async findSegments(surveyData, pdfInsights, config) {
    // Extract features from responses
    const features = await this.extractFeatures(surveyData.responses);
    
    // Determine optimal number of clusters
    const optimalK = await this.findOptimalClusters(features, config);
    
    // Perform clustering
    const clusters = kmeans(features, optimalK, {
      initialization: 'kmeans++',
      seed: 42,
      maxIterations: 100
    });
    
    // Map clusters to meaningful segments using PDF insights
    const segments = await this.interpretClusters(
      clusters,
      surveyData.responses,
      pdfInsights
    );
    
    return segments;
  }
  
  async extractFeatures(responses) {
    const features = [];
    
    for (const respondent of responses) {
      const featureVector = await this.createFeatureVector(respondent.responses);
      features.push(featureVector);
    }
    
    return features;
  }
  
  async createFeatureVector(responses) {
    const vector = [];
    const questionTypes = {};
    
    // Extract numeric features from responses
    for (const [question, answer] of Object.entries(responses)) {
      if (answer === null || answer === undefined) {
        vector.push(0); // Default for missing values
      } else if (typeof answer === 'number') {
        // Normalize numeric responses (assuming scale 1-7)
        vector.push(answer / 7);
      } else if (typeof answer === 'string') {
        // Convert categorical to numeric
        const encoded = this.encodeCategory(question, answer);
        vector.push(encoded);
      } else {
        vector.push(0);
      }
    }
    
    // Ensure consistent vector length
    while (vector.length < 100) {
      vector.push(0);
    }
    
    return vector.slice(0, 100); // Limit to 100 features
  }
  
  encodeCategory(question, answer) {
    // Simple encoding for categorical variables
    const answerLower = answer.toLowerCase();
    
    // Binary encoding for yes/no, agree/disagree
    if (answerLower === 'yes' || answerLower === 'agree' || answerLower === 'true') {
      return 1;
    }
    if (answerLower === 'no' || answerLower === 'disagree' || answerLower === 'false') {
      return 0;
    }
    
    // Frequency encoding
    const frequencyMap = {
      'always': 1.0,
      'often': 0.75,
      'sometimes': 0.5,
      'rarely': 0.25,
      'never': 0
    };
    
    for (const [key, value] of Object.entries(frequencyMap)) {
      if (answerLower.includes(key)) {
        return value;
      }
    }
    
    // Default: hash the string to a value between 0 and 1
    let hash = 0;
    for (let i = 0; i < answer.length; i++) {
      hash = ((hash << 5) - hash) + answer.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash % 100) / 100;
  }
  
  async findOptimalClusters(features, config) {
    // If predefined segments exist, use that count
    if (config?.predefinedSegments?.length) {
      return config.predefinedSegments.length;
    }
    
    // Use elbow method to find optimal K
    const maxK = Math.min(10, Math.floor(features.length / 10));
    const minK = 3;
    const inertias = [];
    
    for (let k = minK; k <= maxK; k++) {
      try {
        const result = kmeans(features, k, {
          initialization: 'kmeans++',
          seed: 42,
          maxIterations: 50
        });
        inertias.push(result.inertia || result.centroids.length);
      } catch (error) {
        console.error(`Error with k=${k}:`, error);
        inertias.push(Infinity);
      }
    }
    
    // Find elbow point (simplified)
    let optimalK = 4; // Default
    
    if (inertias.length > 2) {
      // Calculate rate of change
      const changes = [];
      for (let i = 1; i < inertias.length; i++) {
        changes.push(inertias[i - 1] - inertias[i]);
      }
      
      // Find where rate of change stabilizes
      for (let i = 1; i < changes.length; i++) {
        if (changes[i] / changes[i - 1] > 0.8) {
          optimalK = minK + i;
          break;
        }
      }
    }
    
    return Math.min(Math.max(optimalK, 3), 6); // Between 3 and 6 segments
  }
  
  async interpretClusters(clusters, responses, pdfInsights) {
    const segments = [];
    const numClusters = clusters.clusters || clusters.centroids.length;
    
    for (let i = 0; i < numClusters; i++) {
      const clusterResponses = responses.filter((_, idx) => 
        (clusters.labels || clusters.clusters)[idx] === i
      );
      
      // Analyze cluster characteristics
      const characteristics = await this.analyzeClusterCharacteristics(
        clusterResponses,
        pdfInsights
      );
      
      // Generate segment name and profile
      const segment = await this.generateSegmentProfile(
        characteristics, 
        pdfInsights,
        i
      );
      
      segments.push({
        id: `segment_${i}`,
        name: segment.name,
        characteristics: segment.characteristics,
        valueSystem: segment.valueSystem,
        size: clusterResponses.length,
        percentage: (clusterResponses.length / responses.length) * 100
      });
    }
    
    return segments;
  }
  
  async analyzeClusterCharacteristics(clusterResponses, pdfInsights) {
    const characteristics = {
      avgResponses: {},
      dominantValues: [],
      behavioralPatterns: []
    };
    
    if (clusterResponses.length === 0) {
      return characteristics;
    }
    
    // Calculate average responses for numeric questions
    const numericSums = {};
    const numericCounts = {};
    
    for (const respondent of clusterResponses) {
      for (const [question, answer] of Object.entries(respondent.responses)) {
        if (typeof answer === 'number') {
          if (!numericSums[question]) {
            numericSums[question] = 0;
            numericCounts[question] = 0;
          }
          numericSums[question] += answer;
          numericCounts[question]++;
        }
      }
    }
    
    // Calculate averages
    for (const question of Object.keys(numericSums)) {
      characteristics.avgResponses[question] = 
        numericSums[question] / numericCounts[question];
    }
    
    // Identify dominant values
    const importanceQuestions = Object.keys(characteristics.avgResponses)
      .filter(q => q.toLowerCase().includes('important') || 
                   q.toLowerCase().includes('value'));
    
    for (const question of importanceQuestions) {
      const avg = characteristics.avgResponses[question];
      if (avg > 5) { // Assuming 7-point scale
        characteristics.dominantValues.push({
          question,
          strength: avg / 7
        });
      }
    }
    
    return characteristics;
  }
  
  async generateSegmentProfile(characteristics, pdfInsights, clusterIndex) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    // If no API key or it's placeholder, use fallback
    if (!apiKey || apiKey === 'your_api_key_here') {
      return this.generateFallbackProfile(characteristics, clusterIndex);
    }
    
    // Use Claude to interpret the cluster characteristics
    const prompt = `Given these consumer characteristics:
${JSON.stringify(characteristics, null, 2)}

And these market research insights:
${JSON.stringify(pdfInsights.keyFindings?.slice(0, 5) || [], null, 2)}

Generate a consumer segment profile with:
1. A descriptive name (e.g., "Eco-Conscious Enthusiast", "Price-Sensitive Pragmatist")
2. Key characteristics (3-5 bullet points)
3. Value system (sustainability, price, quality, brand, social influence) rated 0-1
4. Purchase decision factors

Respond in JSON format with keys: name, characteristics, valueSystem, decisionFactors`;

    try {
      const response = await fetch(this.claudeApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
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
    } catch (error) {
      console.error('Claude API error:', error);
      return this.generateFallbackProfile(characteristics, clusterIndex);
    }
  }
  
  generateFallbackProfile(characteristics, clusterIndex) {
    // Generate profile based on characteristics
    const avgValues = Object.values(characteristics.avgResponses || {});
    const avgScore = avgValues.length > 0 
      ? avgValues.reduce((a, b) => a + b, 0) / avgValues.length 
      : 0.5;
    
    const profiles = [
      {
        name: "Progressive Innovators",
        characteristics: {
          main: "Early adopters who prioritize innovation and sustainability",
          behavior: "Actively seek new sustainable products",
          shopping: "Research extensively before purchasing",
          influence: "Strong social media presence and influence"
        },
        valueSystem: {
          sustainability: 0.9,
          priceConsciousness: 0.3,
          brandLoyalty: 0.7,
          environmentalConcern: 0.85,
          socialInfluence: 0.8,
          quality: 0.8,
          innovation: 0.9
        },
        decisionFactors: ["Environmental impact", "Product innovation", "Brand values", "Peer recommendations"]
      },
      {
        name: "Practical Optimizers",
        characteristics: {
          main: "Value-conscious consumers who balance quality with price",
          behavior: "Compare options thoroughly before buying",
          shopping: "Look for best value propositions",
          influence: "Influenced by reviews and ratings"
        },
        valueSystem: {
          sustainability: 0.6,
          priceConsciousness: 0.7,
          brandLoyalty: 0.5,
          environmentalConcern: 0.5,
          socialInfluence: 0.6,
          quality: 0.8,
          innovation: 0.5
        },
        decisionFactors: ["Price-quality ratio", "Product reviews", "Durability", "Practical benefits"]
      },
      {
        name: "Traditional Loyalists",
        characteristics: {
          main: "Brand-loyal consumers who prefer established products",
          behavior: "Stick with familiar brands and products",
          shopping: "Shop at regular stores and websites",
          influence: "Trust traditional advertising and recommendations"
        },
        valueSystem: {
          sustainability: 0.3,
          priceConsciousness: 0.6,
          brandLoyalty: 0.9,
          environmentalConcern: 0.3,
          socialInfluence: 0.4,
          quality: 0.7,
          innovation: 0.3
        },
        decisionFactors: ["Brand reputation", "Past experience", "Convenience", "Traditional values"]
      },
      {
        name: "Budget Conscious",
        characteristics: {
          main: "Price-focused consumers seeking maximum value",
          behavior: "Hunt for deals and discounts",
          shopping: "Compare prices across multiple sources",
          influence: "Motivated by sales and promotions"
        },
        valueSystem: {
          sustainability: 0.2,
          priceConsciousness: 0.95,
          brandLoyalty: 0.2,
          environmentalConcern: 0.2,
          socialInfluence: 0.3,
          quality: 0.5,
          innovation: 0.2
        },
        decisionFactors: ["Lowest price", "Discounts available", "Basic functionality", "Value for money"]
      }
    ];
    
    // Select profile based on cluster index
    const profile = profiles[clusterIndex % profiles.length];
    
    // Adjust based on actual characteristics if available
    if (avgScore > 0.7) {
      // High engagement cluster
      profile.valueSystem.sustainability += 0.1;
      profile.valueSystem.quality += 0.1;
    } else if (avgScore < 0.3) {
      // Low engagement cluster
      profile.valueSystem.priceConsciousness += 0.1;
      profile.valueSystem.brandLoyalty -= 0.1;
    }
    
    // Normalize value system (ensure all values are between 0 and 1)
    for (const key of Object.keys(profile.valueSystem)) {
      profile.valueSystem[key] = Math.min(1, Math.max(0, profile.valueSystem[key]));
    }
    
    return profile;
  }
  
  async callClaude(prompt) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey || apiKey === 'your_api_key_here') {
      throw new Error('Claude API key not configured');
    }
    
    try {
      const response = await fetch(this.claudeApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-3-sonnet-20240229",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }]
        })
      });
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      
      const data = await response.json();
      return data.content[0].text;
    } catch (error) {
      console.error('Claude API error:', error);
      throw error;
    }
  }
}