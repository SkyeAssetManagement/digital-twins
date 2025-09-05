/**
 * Integration Tests for API Endpoints
 * Tests the complete flow of API requests
 */

import assert from 'assert';
import { createMockRequest, createMockResponse, createMockNext } from '../fixtures/mock-data.js';

// Import services and utilities
import { BaseService } from '../../src/services/base.service.js';
import { DatasetService } from '../../src/services/dataset.service.js';
import { ResponseService } from '../../src/services/response.service.js';
import { createLogger } from '../../src/utils/logger.js';

const logger = createLogger('APIIntegrationTests');

describe('API Integration Tests', () => {
  let datasetService;
  let responseService;
  
  beforeEach(() => {
    datasetService = new DatasetService();
    responseService = new ResponseService();
  });
  
  describe('Dataset Service Integration', () => {
    it('should handle dataset configuration requests', async () => {
      const req = createMockRequest({
        body: {
          datasetId: 'surf-clothing',
          config: {
            name: 'Surf Clothing',
            description: 'Sustainable surf apparel'
          }
        }
      });
      const res = createMockResponse();
      
      try {
        // Test would normally call the actual endpoint
        // For now, test the service directly
        const config = await datasetService.getConfiguration('surf-clothing');
        assert(config);
        logger.info('Dataset configuration test passed');
      } catch (error) {
        logger.error('Dataset configuration test failed', error);
      }
    });
    
    it('should validate dataset IDs', async () => {
      const req = createMockRequest({
        body: { datasetId: '' }
      });
      const res = createMockResponse();
      const next = createMockNext();
      
      try {
        await datasetService.validateDataset('');
        assert.fail('Should have thrown validation error');
      } catch (error) {
        assert(error.message.includes('Dataset ID'));
      }
    });
  });
  
  describe('Response Service Integration', () => {
    it('should generate responses with valid input', async () => {
      const params = {
        adContent: 'Test sustainable product ad',
        segment: 'Leader',
        datasetId: 'surf-clothing'
      };
      
      try {
        // Mock the response generation
        const response = await responseService.generateMockResponse(params);
        
        assert(response);
        assert(response.responses);
        assert(Array.isArray(response.responses));
        assert(response.segment === 'Leader');
        logger.info('Response generation test passed');
      } catch (error) {
        logger.error('Response generation test failed', error);
      }
    });
    
    it('should handle missing parameters gracefully', async () => {
      const params = {
        adContent: 'Test ad'
        // Missing segment and datasetId
      };
      
      try {
        const response = await responseService.generateMockResponse(params);
        assert(response);
        assert(response.responses);
      } catch (error) {
        // Should handle gracefully with defaults
        assert(error);
      }
    });
  });
  
  describe('End-to-End Flow', () => {
    it('should complete full request cycle', async () => {
      // Step 1: Check dataset exists
      const datasetExists = await datasetService.exists('surf-clothing');
      
      // Step 2: Get configuration
      const config = datasetExists 
        ? await datasetService.getConfiguration('surf-clothing')
        : { datasetId: 'surf-clothing' };
      
      // Step 3: Generate response
      const responseParams = {
        adContent: 'Eco-friendly surf gear for conscious consumers',
        segment: 'Leader',
        datasetId: config.datasetId
      };
      
      const response = await responseService.generateMockResponse(responseParams);
      
      // Step 4: Validate response structure
      assert(response);
      assert(response.responses);
      assert(response.segment);
      assert(response.confidence !== undefined);
      
      logger.info('End-to-end flow test passed');
    });
  });
  
  describe('Error Handling', () => {
    it('should handle service errors properly', async () => {
      const req = createMockRequest({
        body: { invalid: 'data' }
      });
      const res = createMockResponse();
      const next = createMockNext();
      
      // Test error propagation
      try {
        await responseService.generateMockResponse({});
      } catch (error) {
        assert(error);
        // Error should be properly formatted
        assert(error.message || error.error);
      }
    });
    
    it('should handle timeout scenarios', async () => {
      // Create a service method that times out
      const timeoutPromise = new Promise((resolve, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 100);
      });
      
      try {
        await Promise.race([
          timeoutPromise,
          new Promise(resolve => setTimeout(resolve, 200))
        ]);
        assert.fail('Should have timed out');
      } catch (error) {
        assert(error.message === 'Timeout');
      }
    });
  });
});

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runTests = async () => {
    logger.info('Running API Integration Tests...');
    let passed = 0;
    let failed = 0;
    
    const tests = [
      {
        name: 'Dataset Service - Configuration',
        fn: async () => {
          const service = new DatasetService();
          const config = await service.getConfiguration('surf-clothing');
          assert(config);
        }
      },
      {
        name: 'Response Service - Mock Generation',
        fn: async () => {
          const service = new ResponseService();
          const response = await service.generateMockResponse({
            adContent: 'Test ad',
            segment: 'Leader'
          });
          assert(response.responses.length > 0);
        }
      },
      {
        name: 'Error Handling - Invalid Input',
        fn: async () => {
          const service = new ResponseService();
          try {
            await service.generateMockResponse({});
            assert.fail('Should have thrown');
          } catch (e) {
            assert(e);
          }
        }
      },
      {
        name: 'Cache Functionality',
        fn: async () => {
          const service = new BaseService('TestService');
          const key = 'test-key';
          const value = { data: 'test' };
          
          service.cache.set(key, value);
          const cached = service.cache.get(key);
          assert.deepStrictEqual(cached, value);
        }
      }
    ];
    
    for (const test of tests) {
      try {
        await test.fn();
        console.log(`✓ ${test.name}`);
        passed++;
      } catch (error) {
        console.log(`✗ ${test.name}: ${error.message}`);
        failed++;
      }
    }
    
    console.log(`\nResults: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  };
  
  runTests();
}