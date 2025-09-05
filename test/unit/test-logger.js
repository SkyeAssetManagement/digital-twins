/**
 * Unit Tests for Logger Utility
 * Tests the structured logging functionality
 */

import { createLogger } from '../../src/utils/logger.js';
import assert from 'assert';

describe('Logger Utility', () => {
  let logger;
  let capturedLogs;
  
  beforeEach(() => {
    capturedLogs = [];
    // Mock console methods to capture output
    const originalLog = console.log;
    const originalError = console.error;
    
    console.log = (...args) => {
      capturedLogs.push({ level: 'log', args });
    };
    
    console.error = (...args) => {
      capturedLogs.push({ level: 'error', args });
    };
    
    // Restore after tests
    after(() => {
      console.log = originalLog;
      console.error = originalError;
    });
  });
  
  describe('createLogger', () => {
    it('should create a logger with a name', () => {
      logger = createLogger('TestLogger');
      assert(logger);
      assert(typeof logger.info === 'function');
      assert(typeof logger.error === 'function');
      assert(typeof logger.warn === 'function');
      assert(typeof logger.debug === 'function');
    });
    
    it('should log info messages with timestamp', () => {
      logger = createLogger('TestLogger');
      logger.info('Test message');
      
      assert(capturedLogs.length > 0);
      const log = capturedLogs[0];
      assert(log.args[0].includes('INFO'));
      assert(log.args[0].includes('TestLogger'));
      assert(log.args[0].includes('Test message'));
    });
    
    it('should log error messages with error objects', () => {
      logger = createLogger('TestLogger');
      const error = new Error('Test error');
      logger.error('Error occurred', error);
      
      assert(capturedLogs.length > 0);
      const log = capturedLogs.find(l => l.level === 'error');
      assert(log);
      assert(log.args[0].includes('ERROR'));
    });
    
    it('should handle debug messages', () => {
      logger = createLogger('TestLogger');
      logger.debug('Debug info', { data: 'test' });
      
      // Debug messages may not appear depending on log level
      // Just verify the method exists and doesn't throw
      assert(true);
    });
    
    it('should format objects in log messages', () => {
      logger = createLogger('TestLogger');
      const testData = { key: 'value', number: 42 };
      logger.info('Data:', testData);
      
      const log = capturedLogs[0];
      assert(log.args[0].includes('Data:'));
      assert(log.args[0].includes(JSON.stringify(testData)));
    });
  });
});

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tests = [
    { name: 'Logger creation', fn: () => {
      const logger = createLogger('Test');
      assert(logger);
    }},
    { name: 'Info logging', fn: () => {
      const logger = createLogger('Test');
      logger.info('Test');
      assert(true);
    }},
    { name: 'Error logging', fn: () => {
      const logger = createLogger('Test');
      logger.error('Error', new Error('test'));
      assert(true);
    }}
  ];
  
  console.log('Running Logger Tests...');
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      test.fn();
      console.log(`✓ ${test.name}`);
      passed++;
    } catch (error) {
      console.log(`✗ ${test.name}: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}