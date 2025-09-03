import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DigitalTwinService {
  constructor() {
    this.twins = null;
    this.personas = {};
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      // Load the main twins data
      const twinsPath = path.join(__dirname, '../data/digital-twins/surf-clothing-personas.json');
      const twinsData = await fs.readFile(twinsPath, 'utf-8');
      this.twins = JSON.parse(twinsData);
      
      // Load individual persona configurations
      const personasDir = path.join(__dirname, '../data/digital-twins/personas');
      const personaFiles = await fs.readdir(personasDir);
      
      for (const file of personaFiles) {
        if (file.endsWith('.json')) {
          const personaPath = path.join(personasDir, file);
          const personaData = await fs.readFile(personaPath, 'utf-8');
          const persona = JSON.parse(personaData);
          this.personas[persona.id] = persona;
        }
      }
      
      this.initialized = true;
      console.log(`Digital Twin Service initialized with ${Object.keys(this.personas).length} personas`);
    } catch (error) {
      console.error('Error initializing Digital Twin Service:', error);
      throw error;
    }
  }

  async getAvailablePersonas() {
    await this.initialize();
    
    return Object.keys(this.personas).map(id => ({
      id: id,
      name: this.personas[id].name,
      description: this.personas[id].description,
      marketSize: this.personas[id].description.match(/\d+\.?\d*%/)?.[0] || 'N/A'
    }));
  }

  async getPersona(personaId) {
    await this.initialize();
    
    if (!this.personas[personaId]) {
      throw new Error(`Persona ${personaId} not found`);
    }
    
    return this.personas[personaId];
  }

  async generateResponse(personaId, prompt, context = {}) {
    await this.initialize();
    
    const persona = this.personas[personaId];
    if (!persona) {
      throw new Error(`Persona ${personaId} not found`);
    }
    
    // Build the response based on persona characteristics
    const responseContext = {
      role: `You are a ${persona.name} consumer in the surf clothing market. ${persona.description}`,
      characteristics: persona.characteristics,
      values: persona.values,
      purchasing: persona.purchasing,
      responseConfig: persona.responseConfig,
      exampleResponses: persona.exampleResponses
    };
    
    // Format the system prompt for Claude
    const systemPrompt = this.buildSystemPrompt(persona, context);
    
    return {
      systemPrompt,
      responseContext,
      persona: {
        id: personaId,
        name: persona.name,
        segment: persona.name
      }
    };
  }

  buildSystemPrompt(persona, context) {
    const { question = '', productType = 'surf clothing', scenario = 'general' } = context;
    
    let prompt = `You are responding as a ${persona.name} consumer persona with these characteristics:\n\n`;
    
    // Add characteristics
    prompt += `KEY CHARACTERISTICS:\n`;
    persona.characteristics.forEach(char => {
      prompt += `- ${char}\n`;
    });
    
    // Add values context
    prompt += `\nVALUES AND BELIEFS:\n`;
    if (persona.values.brandAlignment) {
      prompt += `- Brand values alignment: ${persona.values.brandAlignment.interpretation} (${persona.values.brandAlignment.averageScore}/5)\n`;
    }
    if (persona.values.environmentalEvangelism) {
      prompt += `- Environmental evangelism: ${persona.values.environmentalEvangelism.interpretation} (${persona.values.environmentalEvangelism.averageScore}/5)\n`;
    }
    
    // Add purchasing behavior
    prompt += `\nPURCHASING BEHAVIOR:\n`;
    if (persona.purchasing.actualSustainablePurchase) {
      prompt += `- Has purchased for sustainability: ${persona.purchasing.actualSustainablePurchase.percentage}\n`;
    }
    if (persona.purchasing.willingnessToPay25) {
      prompt += `- Willingness to pay 25% premium: ${persona.purchasing.willingnessToPay25.interpretation}\n`;
    }
    if (persona.purchasing.priceImportance) {
      prompt += `- Price importance: ${persona.purchasing.priceImportance.interpretation}\n`;
    }
    
    // Add response configuration
    prompt += `\nRESPONSE STYLE:\n`;
    prompt += `- Price sensitivity: ${(persona.responseConfig.priceWeight * 100).toFixed(0)}%\n`;
    prompt += `- Sustainability focus: ${(persona.responseConfig.sustainabilityWeight * 100).toFixed(0)}%\n`;
    prompt += `- Premium payment willingness: ${persona.responseConfig.willingnessToPay.premium}\n`;
    prompt += `- Premium conditions: ${persona.responseConfig.willingnessToPay.conditions}\n`;
    
    // Add example responses for consistency
    prompt += `\nEXAMPLE RESPONSES FROM THIS PERSONA:\n`;
    if (persona.exampleResponses.priceQuestion) {
      prompt += `Price question: "${persona.exampleResponses.priceQuestion}"\n`;
    }
    if (persona.exampleResponses.brandQuestion) {
      prompt += `Brand question: "${persona.exampleResponses.brandQuestion}"\n`;
    }
    
    // Add the specific context
    if (question) {
      prompt += `\nNow, please respond to this ${scenario} question about ${productType} as this persona would:\n`;
      prompt += `"${question}"\n`;
      prompt += `\nRespond authentically as this consumer segment would, reflecting their values, price sensitivity, and purchasing behavior.`;
    }
    
    return prompt;
  }

  async analyzeMarketOpportunity(productFeatures = {}) {
    await this.initialize();
    
    const analysis = {
      totalMarket: 1006,
      segments: []
    };
    
    const {
      sustainabilityLevel = 'medium',
      pricePoint = 'standard',
      brandAlignment = 'moderate'
    } = productFeatures;
    
    for (const [segmentName, twinData] of Object.entries(this.twins)) {
      const persona = this.personas[segmentName.toLowerCase().replace(/\s+/g, '-')];
      if (!persona) continue;
      
      let appealScore = 0;
      let willingToBuy = false;
      
      // Calculate appeal based on segment characteristics
      switch (segmentName) {
        case 'LOHAS Leader':
          if (sustainabilityLevel === 'high') appealScore = 0.95;
          else if (sustainabilityLevel === 'medium') appealScore = 0.60;
          else appealScore = 0.20;
          
          willingToBuy = (sustainabilityLevel !== 'low' && pricePoint !== 'budget');
          break;
          
        case 'LOHAS Leaning':
          if (sustainabilityLevel === 'high' && pricePoint !== 'premium') appealScore = 0.80;
          else if (sustainabilityLevel === 'medium') appealScore = 0.65;
          else appealScore = 0.30;
          
          willingToBuy = (sustainabilityLevel !== 'low' && pricePoint !== 'premium');
          break;
          
        case 'LOHAS Learner':
          if (pricePoint === 'budget' || pricePoint === 'standard') {
            if (sustainabilityLevel !== 'low') appealScore = 0.45;
            else appealScore = 0.35;
          } else {
            appealScore = 0.15;
          }
          
          willingToBuy = (pricePoint !== 'premium');
          break;
          
        case 'LOHAS Laggard':
          if (pricePoint === 'budget') appealScore = 0.60;
          else if (pricePoint === 'standard') appealScore = 0.40;
          else appealScore = 0.10;
          
          willingToBuy = (pricePoint === 'budget' || pricePoint === 'standard');
          break;
      }
      
      const segmentSize = twinData.size;
      const potentialCustomers = Math.floor(segmentSize * appealScore);
      
      analysis.segments.push({
        segment: segmentName,
        size: segmentSize,
        percentage: twinData.percentage,
        appealScore: (appealScore * 100).toFixed(0) + '%',
        potentialCustomers,
        willingToBuy,
        estimatedRevenue: this.calculateRevenue(potentialCustomers, pricePoint, segmentName)
      });
    }
    
    // Calculate totals
    analysis.totalPotentialCustomers = analysis.segments.reduce((sum, s) => sum + s.potentialCustomers, 0);
    analysis.totalEstimatedRevenue = analysis.segments.reduce((sum, s) => sum + s.estimatedRevenue, 0);
    analysis.marketPenetration = ((analysis.totalPotentialCustomers / analysis.totalMarket) * 100).toFixed(1) + '%';
    
    return analysis;
  }

  calculateRevenue(customers, pricePoint, segment) {
    const basePrices = {
      budget: 25,
      standard: 45,
      moderate: 65,
      premium: 85
    };
    
    const basePrice = basePrices[pricePoint] || 45;
    
    // Apply segment-specific willingness to pay
    let adjustedPrice = basePrice;
    if (segment === 'LOHAS Leader' && pricePoint !== 'budget') {
      adjustedPrice = basePrice * 1.25; // 25% premium
    } else if (segment === 'LOHAS Leaning' && pricePoint !== 'budget') {
      adjustedPrice = basePrice * 1.10; // 10% premium
    }
    
    // Assume average 2 purchases per year
    return customers * adjustedPrice * 2;
  }

  async comparePersonaResponses(prompt, context = {}) {
    await this.initialize();
    
    const responses = {};
    
    for (const personaId of Object.keys(this.personas)) {
      const response = await this.generateResponse(personaId, prompt, context);
      responses[personaId] = {
        persona: response.persona,
        systemPrompt: response.systemPrompt
      };
    }
    
    return responses;
  }
}

export default DigitalTwinService;