import fs from 'fs/promises';
import path from 'path';
import Papa from 'papaparse';

export class SurveyResponseLoader {
  constructor() {
    this.segmentResponses = {
      'Leader': [],
      'Leaning': [],
      'Learner': [],
      'Laggard': []
    };
    this.loaded = false;
  }

  async loadResponses() {
    if (this.loaded) return this.segmentResponses;
    
    try {
      // Load the refined LOHAS classification with all survey data
      const csvPath = path.join(process.cwd(), 'data', 'datasets', 'surf-clothing', 'refined-lohas-classification.csv');
      const csvContent = await fs.readFile(csvPath, 'utf8');
      
      // Parse CSV
      const parsed = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true
      });
      
      if (!parsed.data || parsed.data.length === 0) {
        console.error('No data found in CSV');
        return this.segmentResponses;
      }
      
      // Group responses by segment
      parsed.data.forEach(row => {
        const segment = row['LOHAS Segment'];
        if (!segment) return;
        
        // Extract key survey responses that reveal personality
        const response = {
          respondentId: row['Respondent ID'],
          segment: segment,
          
          // Purchase behavior responses
          actualPurchase: this.parseScore(row['Actual Purchase (1-5)']),
          willingnessToPay: this.parseScore(row['Willingness to Pay 25% (1-5)']),
          
          // Value responses
          brandValues: this.parseScore(row['Brand Values (1-5)']),
          sustainability: this.parseScore(row['Sustainability (1-5)']),
          envEvangelist: this.parseScore(row['Env Evangelist (1-5)']),
          activism: this.parseScore(row['Activism (1-5)']),
          priceSensitivity: this.parseScore(row['Price Sensitivity (1-5)']),
          
          // Detailed scores
          compositeScore: parseFloat(row['Composite Score']) || 0,
          propensityScore: parseFloat(row['Propensity Score']) || 0,
          
          // Example responses based on scores
          exampleResponses: this.generateExampleResponses(row)
        };
        
        // Add to appropriate segment
        const segmentKey = segment.replace('LOHAS ', '');
        if (this.segmentResponses[segmentKey]) {
          this.segmentResponses[segmentKey].push(response);
        }
      });
      
      this.loaded = true;
      
      // Log statistics
      console.log('Loaded survey responses:');
      Object.entries(this.segmentResponses).forEach(([segment, responses]) => {
        console.log(`  ${segment}: ${responses.length} respondents`);
      });
      
      return this.segmentResponses;
      
    } catch (error) {
      console.error('Error loading survey responses:', error);
      return this.segmentResponses;
    }
  }
  
  parseScore(value) {
    if (!value || value === 'N/A') return null;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }
  
  generateExampleResponses(row) {
    const responses = [];
    
    // Generate responses based on actual survey scores
    const sustainability = this.parseScore(row['Sustainability (1-5)']);
    const priceSensitivity = this.parseScore(row['Price Sensitivity (1-5)']);
    const brandValues = this.parseScore(row['Brand Values (1-5)']);
    const willingnessToPay = this.parseScore(row['Willingness to Pay 25% (1-5)']);
    
    // Sustainability response
    if (sustainability !== null) {
      if (sustainability >= 4) {
        responses.push({
          topic: 'sustainability',
          response: "Environmental impact is crucial to my purchasing decisions. I research brands' sustainability practices.",
          score: sustainability
        });
      } else if (sustainability >= 3) {
        responses.push({
          topic: 'sustainability',
          response: "I prefer sustainable options when the quality and price are reasonable.",
          score: sustainability
        });
      } else {
        responses.push({
          topic: 'sustainability',
          response: "Sustainability is nice to have but not my main concern when shopping.",
          score: sustainability
        });
      }
    }
    
    // Price response
    if (priceSensitivity !== null) {
      if (priceSensitivity >= 4) {
        responses.push({
          topic: 'price',
          response: "Price is my primary factor. I always compare and look for the best deals.",
          score: priceSensitivity
        });
      } else if (priceSensitivity >= 3) {
        responses.push({
          topic: 'price',
          response: "I balance price with quality. Good value is important to me.",
          score: priceSensitivity
        });
      } else {
        responses.push({
          topic: 'price',
          response: "I'm willing to pay more for products that align with my values.",
          score: priceSensitivity
        });
      }
    }
    
    // Brand values response
    if (brandValues !== null && brandValues >= 3) {
      responses.push({
        topic: 'brand',
        response: willingnessToPay >= 4 
          ? "I actively support brands that share my environmental values, even at premium prices."
          : "Brand values matter to me, but they need to be authentic, not just marketing.",
        score: brandValues
      });
    }
    
    return responses;
  }
  
  getRandomResponses(segment, count = 5) {
    const segmentKey = segment.replace('LOHAS ', '');
    const responses = this.segmentResponses[segmentKey] || [];
    
    if (responses.length === 0) return [];
    
    // Randomly select responses
    const selected = [];
    const indices = new Set();
    
    while (selected.length < count && indices.size < responses.length) {
      const index = Math.floor(Math.random() * responses.length);
      if (!indices.has(index)) {
        indices.add(index);
        selected.push(responses[index]);
      }
    }
    
    return selected;
  }
  
  getResponsesByScore(segment, scoreType, minScore) {
    const segmentKey = segment.replace('LOHAS ', '');
    const responses = this.segmentResponses[segmentKey] || [];
    
    return responses.filter(r => {
      const score = r[scoreType];
      return score !== null && score >= minScore;
    });
  }
  
  getAverageScores(segment) {
    const segmentKey = segment.replace('LOHAS ', '');
    const responses = this.segmentResponses[segmentKey] || [];
    
    if (responses.length === 0) return {};
    
    const totals = {
      actualPurchase: 0,
      willingnessToPay: 0,
      brandValues: 0,
      sustainability: 0,
      envEvangelist: 0,
      activism: 0,
      priceSensitivity: 0,
      count: 0
    };
    
    responses.forEach(r => {
      if (r.actualPurchase !== null) {
        totals.actualPurchase += r.actualPurchase;
        totals.count++;
      }
      if (r.willingnessToPay !== null) totals.willingnessToPay += r.willingnessToPay;
      if (r.brandValues !== null) totals.brandValues += r.brandValues;
      if (r.sustainability !== null) totals.sustainability += r.sustainability;
      if (r.envEvangelist !== null) totals.envEvangelist += r.envEvangelist;
      if (r.activism !== null) totals.activism += r.activism;
      if (r.priceSensitivity !== null) totals.priceSensitivity += r.priceSensitivity;
    });
    
    const count = totals.count || 1;
    return {
      actualPurchase: (totals.actualPurchase / count).toFixed(2),
      willingnessToPay: (totals.willingnessToPay / count).toFixed(2),
      brandValues: (totals.brandValues / count).toFixed(2),
      sustainability: (totals.sustainability / count).toFixed(2),
      envEvangelist: (totals.envEvangelist / count).toFixed(2),
      activism: (totals.activism / count).toFixed(2),
      priceSensitivity: (totals.priceSensitivity / count).toFixed(2)
    };
  }
}

// Singleton instance
let loader = null;

export async function getSurveyResponseLoader() {
  if (!loader) {
    loader = new SurveyResponseLoader();
    await loader.loadResponses();
  }
  return loader;
}