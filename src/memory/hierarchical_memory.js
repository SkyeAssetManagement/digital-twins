/**
 * Hierarchical Memory System
 * Maintains personality consistency across conversations with short-term, mid-term, and long-term memory
 */

import { createClient } from 'redis';

/**
 * Main hierarchical memory system class
 */
export class HierarchicalMemorySystem {
  constructor(redisUrl = process.env.REDIS_URL || 'redis://localhost:6379') {
    this.redisUrl = redisUrl;
    this.redisClient = null;
    this.isConnected = false;
    this.inMemoryFallback = new Map();
    this.initializeRedis();
  }

  /**
   * Initialize Redis connection
   */
  async initializeRedis() {
    try {
      this.redisClient = createClient({
        url: this.redisUrl
      });
      
      this.redisClient.on('error', (err) => {
        console.log('Redis Client Error:', err);
        this.isConnected = false;
      });
      
      this.redisClient.on('connect', () => {
        console.log('Redis connected successfully');
        this.isConnected = true;
      });
      
      await this.redisClient.connect();
    } catch (error) {
      console.log('Failed to connect to Redis, using in-memory fallback:', error.message);
      this.isConnected = false;
    }
  }

  /**
   * Store interaction in hierarchical memory
   */
  async storeInteraction(personaId, query, response, personaVector) {
    const timestamp = new Date();
    const interactionData = {
      query: query,
      response: response,
      vectorSnapshot: Array.from(personaVector),
      timestamp: timestamp.toISOString()
    };
    
    // Store in short-term memory (2-hour expiry)
    await this.storeShortTermMemory(personaId, interactionData, timestamp);
    
    // Update mid-term memory (7-day expiry)
    await this.updateMidTermMemory(personaId, query, response, timestamp);
    
    // Update long-term memory (persistent)
    await this.updateLongTermMemory(personaId, personaVector, timestamp);
  }

  /**
   * Store in short-term memory
   */
  async storeShortTermMemory(personaId, interactionData, timestamp) {
    const stmKey = `stm:${personaId}:${timestamp.getTime()}`;
    
    if (this.isConnected && this.redisClient) {
      try {
        await this.redisClient.setEx(
          stmKey,
          7200, // 2 hours in seconds
          JSON.stringify(interactionData)
        );
      } catch (error) {
        console.error('Error storing STM in Redis:', error);
        this.fallbackStore(stmKey, interactionData, 7200000); // 2 hours in ms
      }
    } else {
      this.fallbackStore(stmKey, interactionData, 7200000);
    }
  }

  /**
   * Update mid-term memory with dialogue chains
   */
  async updateMidTermMemory(personaId, query, response, timestamp) {
    const mtmKey = `mtm:${personaId}:${timestamp.toISOString().split('T')[0]}`;
    
    // Get existing dialogue chain
    let dialogueChain = await this.getMemoryData(mtmKey);
    if (!dialogueChain) {
      dialogueChain = [];
    }
    
    // Check if this continues an existing chain
    const newEntry = {
      query: query,
      response: response,
      timestamp: timestamp.toISOString()
    };
    
    if (dialogueChain.length > 0) {
      const lastEntry = dialogueChain[dialogueChain.length - 1];
      if (this.isRelatedTopic(query, lastEntry.query)) {
        dialogueChain.push(newEntry);
      } else {
        // Start new chain if topic changed significantly
        dialogueChain = [newEntry];
      }
    } else {
      dialogueChain = [newEntry];
    }
    
    // Store updated chain
    if (this.isConnected && this.redisClient) {
      try {
        await this.redisClient.setEx(
          mtmKey,
          604800, // 7 days in seconds
          JSON.stringify(dialogueChain)
        );
      } catch (error) {
        console.error('Error storing MTM in Redis:', error);
        this.fallbackStore(mtmKey, dialogueChain, 604800000); // 7 days in ms
      }
    } else {
      this.fallbackStore(mtmKey, dialogueChain, 604800000);
    }
  }

  /**
   * Update long-term memory with personality patterns
   */
  async updateLongTermMemory(personaId, personaVector, timestamp) {
    const ltmKey = `ltm:${personaId}`;
    
    // Get existing long-term memory
    let ltmData = await this.getMemoryData(ltmKey);
    
    if (!ltmData) {
      ltmData = {
        personaId: personaId,
        vectorHistory: [],
        createdAt: timestamp.toISOString()
      };
    }
    
    // Add new vector to history
    ltmData.vectorHistory.push({
      vector: Array.from(personaVector),
      timestamp: timestamp.toISOString()
    });
    
    // Maintain rolling window of 100 interactions
    if (ltmData.vectorHistory.length > 100) {
      ltmData.vectorHistory = ltmData.vectorHistory.slice(-100);
    }
    
    // Calculate personality drift metrics
    ltmData.driftMetrics = this.calculateDriftMetrics(ltmData.vectorHistory);
    
    // Store updated long-term memory
    if (this.isConnected && this.redisClient) {
      try {
        await this.redisClient.set(ltmKey, JSON.stringify(ltmData));
      } catch (error) {
        console.error('Error storing LTM in Redis:', error);
        this.fallbackStore(ltmKey, ltmData, null); // No expiry for LTM
      }
    } else {
      this.fallbackStore(ltmKey, ltmData, null);
    }
  }

  /**
   * Get relevant context from hierarchical memory
   */
  async getRelevantContext(personaId, currentQuery, maxContext = 5) {
    // Retrieve from different memory layers
    const stmContext = await this.retrieveFromSTM(personaId, currentQuery);
    const mtmContext = await this.retrieveFromMTM(personaId, currentQuery);
    const ltmContext = await this.retrieveFromLTM(personaId);
    
    // Combine and rank by relevance
    const combinedContext = this.mergeMemoryContexts(
      stmContext,
      mtmContext,
      ltmContext,
      currentQuery
    );
    
    // Return top contexts
    return combinedContext.slice(0, maxContext);
  }

  /**
   * Retrieve from short-term memory
   */
  async retrieveFromSTM(personaId, query) {
    const pattern = `stm:${personaId}:*`;
    const contexts = [];
    
    if (this.isConnected && this.redisClient) {
      try {
        const keys = await this.redisClient.keys(pattern);
        
        for (const key of keys.slice(-10)) { // Get last 10 STM entries
          const data = await this.redisClient.get(key);
          if (data) {
            const parsed = JSON.parse(data);
            contexts.push({
              type: 'stm',
              content: parsed,
              relevance: this.calculateRelevance(query, parsed.query)
            });
          }
        }
      } catch (error) {
        console.error('Error retrieving STM:', error);
        return this.fallbackRetrieve(pattern, 'stm', query);
      }
    } else {
      return this.fallbackRetrieve(pattern, 'stm', query);
    }
    
    return contexts;
  }

  /**
   * Retrieve from mid-term memory
   */
  async retrieveFromMTM(personaId, query) {
    const today = new Date().toISOString().split('T')[0];
    const contexts = [];
    
    // Check last 7 days
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const mtmKey = `mtm:${personaId}:${dateStr}`;
      
      const data = await this.getMemoryData(mtmKey);
      if (data && Array.isArray(data)) {
        for (const entry of data) {
          contexts.push({
            type: 'mtm',
            content: entry,
            relevance: this.calculateRelevance(query, entry.query)
          });
        }
      }
    }
    
    return contexts;
  }

  /**
   * Retrieve from long-term memory
   */
  async retrieveFromLTM(personaId) {
    const ltmKey = `ltm:${personaId}`;
    const data = await this.getMemoryData(ltmKey);
    
    if (!data) {
      return [];
    }
    
    // Return personality drift metrics and stable patterns
    return [{
      type: 'ltm',
      content: {
        driftMetrics: data.driftMetrics,
        stableTraits: this.extractStableTraits(data.vectorHistory),
        personalityProfile: this.buildPersonalityProfile(data.vectorHistory)
      },
      relevance: 0.5 // Base relevance for LTM
    }];
  }

  /**
   * Get memory data from Redis or fallback
   */
  async getMemoryData(key) {
    if (this.isConnected && this.redisClient) {
      try {
        const data = await this.redisClient.get(key);
        return data ? JSON.parse(data) : null;
      } catch (error) {
        console.error(`Error getting ${key}:`, error);
        return this.inMemoryFallback.get(key);
      }
    } else {
      const stored = this.inMemoryFallback.get(key);
      if (stored && stored.expiry) {
        if (Date.now() > stored.expiry) {
          this.inMemoryFallback.delete(key);
          return null;
        }
      }
      return stored ? stored.data : null;
    }
  }

  /**
   * Fallback storage for when Redis is unavailable
   */
  fallbackStore(key, data, expiryMs) {
    const entry = {
      data: data,
      timestamp: Date.now()
    };
    
    if (expiryMs) {
      entry.expiry = Date.now() + expiryMs;
    }
    
    this.inMemoryFallback.set(key, entry);
    
    // Limit in-memory storage size
    if (this.inMemoryFallback.size > 1000) {
      const firstKey = this.inMemoryFallback.keys().next().value;
      this.inMemoryFallback.delete(firstKey);
    }
  }

  /**
   * Fallback retrieve for when Redis is unavailable
   */
  fallbackRetrieve(pattern, type, query) {
    const contexts = [];
    const regex = new RegExp(pattern.replace('*', '.*'));
    
    for (const [key, value] of this.inMemoryFallback.entries()) {
      if (regex.test(key)) {
        if (value.expiry && Date.now() > value.expiry) {
          this.inMemoryFallback.delete(key);
          continue;
        }
        
        contexts.push({
          type: type,
          content: value.data,
          relevance: query ? this.calculateRelevance(query, value.data.query || '') : 0.5
        });
      }
    }
    
    return contexts;
  }

  /**
   * Check if topics are related
   */
  isRelatedTopic(query1, query2) {
    if (!query1 || !query2) return false;
    
    // Simple keyword overlap check
    const words1 = new Set(query1.toLowerCase().split(/\s+/));
    const words2 = new Set(query2.toLowerCase().split(/\s+/));
    
    let overlap = 0;
    for (const word of words1) {
      if (words2.has(word) && word.length > 3) {
        overlap++;
      }
    }
    
    return overlap >= 2 || (overlap / Math.min(words1.size, words2.size)) > 0.3;
  }

  /**
   * Calculate relevance between queries
   */
  calculateRelevance(query1, query2) {
    if (!query1 || !query2) return 0;
    
    const words1 = new Set(query1.toLowerCase().split(/\s+/));
    const words2 = new Set(query2.toLowerCase().split(/\s+/));
    
    let overlap = 0;
    for (const word of words1) {
      if (words2.has(word)) {
        overlap++;
      }
    }
    
    const union = new Set([...words1, ...words2]);
    return union.size > 0 ? overlap / union.size : 0;
  }

  /**
   * Merge memory contexts from different layers
   */
  mergeMemoryContexts(stmContext, mtmContext, ltmContext, currentQuery) {
    const allContexts = [...stmContext, ...mtmContext, ...ltmContext];
    
    // Sort by relevance and recency
    allContexts.sort((a, b) => {
      // Prioritize relevance
      if (Math.abs(a.relevance - b.relevance) > 0.1) {
        return b.relevance - a.relevance;
      }
      
      // Then prioritize recency (STM > MTM > LTM)
      const typeOrder = { stm: 3, mtm: 2, ltm: 1 };
      return (typeOrder[b.type] || 0) - (typeOrder[a.type] || 0);
    });
    
    // Remove duplicates
    const seen = new Set();
    const unique = [];
    
    for (const context of allContexts) {
      const key = JSON.stringify(context.content.query || context.content);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(context);
      }
    }
    
    return unique;
  }

  /**
   * Calculate drift metrics from vector history
   */
  calculateDriftMetrics(vectorHistory) {
    if (!vectorHistory || vectorHistory.length < 2) {
      return { averageDrift: 0, maxDrift: 0, trend: 'stable' };
    }
    
    const drifts = [];
    for (let i = 1; i < vectorHistory.length; i++) {
      const prev = new Float32Array(vectorHistory[i - 1].vector);
      const curr = new Float32Array(vectorHistory[i].vector);
      const drift = this.calculateVectorDistance(prev, curr);
      drifts.push(drift);
    }
    
    const averageDrift = drifts.reduce((a, b) => a + b, 0) / drifts.length;
    const maxDrift = Math.max(...drifts);
    
    // Determine trend
    const recentDrifts = drifts.slice(-5);
    const olderDrifts = drifts.slice(0, -5);
    const recentAvg = recentDrifts.length > 0 ? recentDrifts.reduce((a, b) => a + b, 0) / recentDrifts.length : 0;
    const olderAvg = olderDrifts.length > 0 ? olderDrifts.reduce((a, b) => a + b, 0) / olderDrifts.length : 0;
    
    let trend = 'stable';
    if (recentAvg > olderAvg * 1.2) {
      trend = 'increasing_drift';
    } else if (recentAvg < olderAvg * 0.8) {
      trend = 'stabilizing';
    }
    
    return { averageDrift, maxDrift, trend };
  }

  /**
   * Calculate distance between two vectors
   */
  calculateVectorDistance(vector1, vector2) {
    if (vector1.length !== vector2.length) {
      return 1; // Maximum distance for incompatible vectors
    }
    
    let sum = 0;
    for (let i = 0; i < vector1.length; i++) {
      sum += Math.pow(vector1[i] - vector2[i], 2);
    }
    
    return Math.sqrt(sum) / vector1.length;
  }

  /**
   * Extract stable personality traits from history
   */
  extractStableTraits(vectorHistory) {
    if (!vectorHistory || vectorHistory.length < 5) {
      return null;
    }
    
    // Calculate average vector
    const avgVector = new Float32Array(384);
    for (const entry of vectorHistory) {
      const vector = new Float32Array(entry.vector);
      for (let i = 0; i < vector.length && i < avgVector.length; i++) {
        avgVector[i] += vector[i];
      }
    }
    
    for (let i = 0; i < avgVector.length; i++) {
      avgVector[i] /= vectorHistory.length;
    }
    
    // Extract traits from average vector
    return {
      openness: this.extractTrait(avgVector, 0, 76),
      conscientiousness: this.extractTrait(avgVector, 76, 152),
      extraversion: this.extractTrait(avgVector, 152, 228),
      agreeableness: this.extractTrait(avgVector, 228, 304),
      neuroticism: this.extractTrait(avgVector, 304, 380)
    };
  }

  /**
   * Extract trait score from vector segment
   */
  extractTrait(vector, start, end) {
    let sum = 0;
    let count = 0;
    
    for (let i = start; i < end && i < vector.length; i++) {
      sum += Math.abs(vector[i]);
      count++;
    }
    
    return count > 0 ? sum / count : 0.5;
  }

  /**
   * Build personality profile from history
   */
  buildPersonalityProfile(vectorHistory) {
    const stableTraits = this.extractStableTraits(vectorHistory);
    if (!stableTraits) {
      return null;
    }
    
    return {
      dominantTrait: this.getDominantTrait(stableTraits),
      consistency: this.calculateTraitConsistency(vectorHistory),
      profile: this.generateProfileDescription(stableTraits)
    };
  }

  /**
   * Get dominant personality trait
   */
  getDominantTrait(traits) {
    let maxTrait = null;
    let maxValue = 0;
    
    for (const [trait, value] of Object.entries(traits)) {
      if (value > maxValue) {
        maxValue = value;
        maxTrait = trait;
      }
    }
    
    return maxTrait;
  }

  /**
   * Calculate trait consistency across history
   */
  calculateTraitConsistency(vectorHistory) {
    if (!vectorHistory || vectorHistory.length < 2) {
      return 1.0;
    }
    
    const variances = [];
    
    // Calculate variance for each dimension
    for (let dim = 0; dim < 384; dim++) {
      const values = [];
      for (const entry of vectorHistory) {
        if (entry.vector[dim] !== undefined) {
          values.push(entry.vector[dim]);
        }
      }
      
      if (values.length > 1) {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        variances.push(variance);
      }
    }
    
    const avgVariance = variances.reduce((a, b) => a + b, 0) / variances.length;
    
    // Convert variance to consistency score (lower variance = higher consistency)
    return Math.max(0, 1 - avgVariance * 10);
  }

  /**
   * Generate profile description from traits
   */
  generateProfileDescription(traits) {
    const descriptions = [];
    
    if (traits.openness > 0.7) {
      descriptions.push('highly creative and open to new experiences');
    } else if (traits.openness < 0.3) {
      descriptions.push('practical and conventional');
    }
    
    if (traits.conscientiousness > 0.7) {
      descriptions.push('very organized and detail-oriented');
    }
    
    if (traits.extraversion > 0.7) {
      descriptions.push('outgoing and energetic');
    } else if (traits.extraversion < 0.3) {
      descriptions.push('reserved and introspective');
    }
    
    if (traits.agreeableness > 0.7) {
      descriptions.push('cooperative and trusting');
    }
    
    if (traits.neuroticism > 0.7) {
      descriptions.push('emotionally sensitive');
    } else if (traits.neuroticism < 0.3) {
      descriptions.push('emotionally stable');
    }
    
    return descriptions.join(', ');
  }

  /**
   * Clear all memory for a persona
   */
  async clearPersonaMemory(personaId) {
    const patterns = [
      `stm:${personaId}:*`,
      `mtm:${personaId}:*`,
      `ltm:${personaId}`
    ];
    
    if (this.isConnected && this.redisClient) {
      try {
        for (const pattern of patterns) {
          const keys = await this.redisClient.keys(pattern);
          if (keys.length > 0) {
            await this.redisClient.del(keys);
          }
        }
      } catch (error) {
        console.error('Error clearing memory:', error);
      }
    }
    
    // Clear from fallback
    for (const key of this.inMemoryFallback.keys()) {
      if (key.includes(personaId)) {
        this.inMemoryFallback.delete(key);
      }
    }
  }

  /**
   * Close Redis connection
   */
  async close() {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }
}

export default HierarchicalMemorySystem;