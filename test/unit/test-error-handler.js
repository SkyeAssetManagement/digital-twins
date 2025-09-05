/**
 * Unit Tests for Error Handler Utility
 * Tests custom error types and error handling functions
 */

import { 
  AppError, 
  ValidationError, 
  ExternalServiceError,
  asyncHandler,
  withRetry
} from '../../src/utils/error-handler.js';
import assert from 'assert';

describe('Error Handler Utility', () => {
  
  describe('Custom Error Types', () => {
    it('should create AppError with correct properties', () => {
      const error = new AppError('Test error', 500, { detail: 'test' });
      
      assert(error instanceof Error);
      assert(error instanceof AppError);
      assert.strictEqual(error.message, 'Test error');
      assert.strictEqual(error.statusCode, 500);
      assert.deepStrictEqual(error.details, { detail: 'test' });
    });
    
    it('should create ValidationError with 400 status', () => {
      const error = new ValidationError('Invalid input');
      
      assert(error instanceof ValidationError);
      assert(error instanceof AppError);
      assert.strictEqual(error.statusCode, 400);
      assert.strictEqual(error.message, 'Invalid input');
    });
    
    it('should create ExternalServiceError with service name', () => {
      const error = new ExternalServiceError('Claude', 'API failed');
      
      assert(error instanceof ExternalServiceError);
      assert(error instanceof AppError);
      assert.strictEqual(error.statusCode, 503);
      assert(error.message.includes('Claude'));
      assert(error.message.includes('API failed'));
    });
    
    it('should preserve error stack traces', () => {
      const error = new AppError('Test error');
      assert(error.stack);
      assert(error.stack.includes('AppError'));
    });
  });
  
  describe('asyncHandler', () => {
    it('should handle successful async functions', async () => {
      const handler = asyncHandler(async (req, res) => {
        res.json({ success: true });
      });
      
      const req = {};
      const res = {
        json: (data) => {
          assert.deepStrictEqual(data, { success: true });
        }
      };
      
      await handler(req, res);
    });
    
    it('should catch and forward errors', async () => {
      const error = new Error('Test error');
      const handler = asyncHandler(async () => {
        throw error;
      });
      
      const req = {};
      const res = {};
      let nextError = null;
      const next = (err) => {
        nextError = err;
      };
      
      await handler(req, res, next);
      assert.strictEqual(nextError, error);
    });
  });
  
  describe('withRetry', () => {
    it('should succeed on first try', async () => {
      let attempts = 0;
      const result = await withRetry(
        async () => {
          attempts++;
          return 'success';
        },
        3,
        10
      );
      
      assert.strictEqual(result, 'success');
      assert.strictEqual(attempts, 1);
    });
    
    it('should retry on failure', async () => {
      let attempts = 0;
      const result = await withRetry(
        async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Failed');
          }
          return 'success';
        },
        3,
        10
      );
      
      assert.strictEqual(result, 'success');
      assert.strictEqual(attempts, 3);
    });
    
    it('should throw after max retries', async () => {
      let attempts = 0;
      
      try {
        await withRetry(
          async () => {
            attempts++;
            throw new Error('Always fails');
          },
          2,
          10
        );
        assert.fail('Should have thrown');
      } catch (error) {
        assert(error.message.includes('Always fails'));
        assert.strictEqual(attempts, 3); // Initial + 2 retries
      }
    });
    
    it('should respect delay between retries', async () => {
      const startTime = Date.now();
      
      try {
        await withRetry(
          async () => {
            throw new Error('Fail');
          },
          2,
          50 // 50ms delay
        );
      } catch (error) {
        const duration = Date.now() - startTime;
        // Should have at least 100ms delay (2 retries * 50ms)
        assert(duration >= 100);
      }
    });
  });
});

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runTests = async () => {
    console.log('Running Error Handler Tests...');
    let passed = 0;
    let failed = 0;
    
    const tests = [
      { 
        name: 'AppError creation', 
        fn: () => {
          const error = new AppError('Test', 500);
          assert(error instanceof AppError);
          assert.strictEqual(error.statusCode, 500);
        }
      },
      { 
        name: 'ValidationError creation', 
        fn: () => {
          const error = new ValidationError('Invalid');
          assert.strictEqual(error.statusCode, 400);
        }
      },
      { 
        name: 'ExternalServiceError creation', 
        fn: () => {
          const error = new ExternalServiceError('Service', 'Failed');
          assert.strictEqual(error.statusCode, 503);
        }
      },
      { 
        name: 'withRetry success', 
        fn: async () => {
          const result = await withRetry(async () => 'ok', 3, 10);
          assert.strictEqual(result, 'ok');
        }
      },
      { 
        name: 'withRetry failure', 
        fn: async () => {
          let attempts = 0;
          try {
            await withRetry(async () => {
              attempts++;
              throw new Error('Fail');
            }, 1, 10);
          } catch (e) {
            assert.strictEqual(attempts, 2);
          }
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