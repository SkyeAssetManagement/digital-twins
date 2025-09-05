/**
 * Centralized Application Configuration
 * Manages all environment variables and configuration settings
 */

export class AppConfig {
  constructor() {
    this.env = process.env.NODE_ENV || 'development';
    this.isDevelopment = this.env === 'development';
    this.isProduction = this.env === 'production';
  }

  // API Configuration
  get anthropic() {
    return {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
      maxTokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS) || 2048,
      temperature: parseFloat(process.env.ANTHROPIC_TEMPERATURE) || 0.7
    };
  }

  get openai() {
    return {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4',
      embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-large'
    };
  }

  // Database Configuration
  get database() {
    return {
      url: process.env.DATABASE_URL || 'postgresql://localhost/digital_twins',
      ssl: this.isProduction ? { rejectUnauthorized: false } : false,
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS) || 10
    };
  }

  // File System Paths
  get paths() {
    return {
      datasets: process.env.DATASETS_PATH || 'data/datasets',
      processed: 'processed',
      raw: 'raw',
      errorFile: 'error.json',
      processedDataFile: 'processed_data.json'
    };
  }

  // Persona Configuration
  get persona() {
    return {
      vectorIntensity: parseFloat(process.env.PERSONA_VECTOR_INTENSITY) || 1.0,
      consistencyThreshold: parseFloat(process.env.PERSONA_CONSISTENCY_THRESHOLD) || 0.8,
      cacheTimeout: parseInt(process.env.PERSONA_CACHE_TIMEOUT) || 3600000 // 1 hour
    };
  }

  // Validation
  validateRequired() {
    const required = [];
    
    if (!this.anthropic.apiKey) required.push('ANTHROPIC_API_KEY');
    if (!this.openai.apiKey) required.push('OPENAI_API_KEY');
    
    if (required.length > 0) {
      throw new Error(`Missing required environment variables: ${required.join(', ')}`);
    }
  }

  // Get configuration for specific service
  getServiceConfig(service) {
    const configs = {
      anthropic: this.anthropic,
      openai: this.openai,
      database: this.database,
      persona: this.persona
    };
    
    return configs[service] || {};
  }
}

// Singleton instance
export const appConfig = new AppConfig();
export default appConfig;
