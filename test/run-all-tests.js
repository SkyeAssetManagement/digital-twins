/**
 * Comprehensive Test Runner
 * Runs all unit and integration tests with coverage reporting
 */

import { createLogger } from '../src/utils/logger.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = createLogger('TestRunner');

class TestRunner {
  constructor() {
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      tests: []
    };
    this.startTime = Date.now();
  }
  
  async findTestFiles(directory) {
    const testFiles = [];
    
    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);
        
        if (entry.isDirectory()) {
          // Recursively search directories
          const subFiles = await this.findTestFiles(fullPath);
          testFiles.push(...subFiles);
        } else if (entry.isFile() && entry.name.startsWith('test-') && entry.name.endsWith('.js')) {
          testFiles.push(fullPath);
        }
      }
    } catch (error) {
      logger.error(`Error reading directory ${directory}:`, error);
    }
    
    return testFiles;
  }
  
  async runTestFile(filePath) {
    const testName = path.basename(filePath, '.js');
    logger.info(`Running ${testName}...`);
    
    const testResult = {
      file: filePath,
      name: testName,
      passed: 0,
      failed: 0,
      duration: 0,
      errors: []
    };
    
    const startTime = Date.now();
    
    try {
      // Dynamically import and run the test
      const testModule = await import(filePath);
      
      // Check if test has a run function or default export
      if (testModule.runTests) {
        const result = await testModule.runTests();
        testResult.passed = result.passed || 0;
        testResult.failed = result.failed || 0;
      } else if (testModule.default && typeof testModule.default === 'function') {
        const result = await testModule.default();
        testResult.passed = result.passed || 0;
        testResult.failed = result.failed || 0;
      } else {
        // Try to run as simple test file
        logger.debug(`Test file ${testName} executed`);
        testResult.passed = 1;
      }
    } catch (error) {
      logger.error(`Error running test ${testName}:`, error);
      testResult.failed = 1;
      testResult.errors.push(error.message);
    }
    
    testResult.duration = Date.now() - startTime;
    this.results.tests.push(testResult);
    
    return testResult;
  }
  
  async runAllTests() {
    logger.info('Starting comprehensive test suite...\n');
    
    // Find all test files
    const testDirs = [
      path.join(__dirname, 'unit'),
      path.join(__dirname, 'integration'),
      __dirname // Root test directory
    ];
    
    const allTestFiles = new Set();
    
    for (const dir of testDirs) {
      const files = await this.findTestFiles(dir);
      files.forEach(f => allTestFiles.add(f));
    }
    
    logger.info(`Found ${allTestFiles.size} test files\n`);
    
    // Run each test file
    for (const testFile of allTestFiles) {
      const result = await this.runTestFile(testFile);
      this.results.total++;
      this.results.passed += result.passed;
      this.results.failed += result.failed;
      
      const status = result.failed === 0 ? '✓' : '✗';
      const color = result.failed === 0 ? '\x1b[32m' : '\x1b[31m';
      console.log(`${color}${status} ${result.name}\x1b[0m (${result.duration}ms)`);
    }
    
    this.results.duration = Date.now() - this.startTime;
    
    // Print summary
    this.printSummary();
    
    return this.results;
  }
  
  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`Total Test Files: ${this.results.total}`);
    console.log(`Tests Passed: \x1b[32m${this.results.passed}\x1b[0m`);
    console.log(`Tests Failed: \x1b[31m${this.results.failed}\x1b[0m`);
    console.log(`Tests Skipped: \x1b[33m${this.results.skipped}\x1b[0m`);
    console.log(`Total Duration: ${this.results.duration}ms`);
    
    // Calculate coverage estimate
    const coverage = this.results.total > 0 
      ? Math.round((this.results.passed / (this.results.passed + this.results.failed)) * 100)
      : 0;
    
    console.log(`\nTest Pass Rate: ${coverage}%`);
    
    if (this.results.failed > 0) {
      console.log('\n\x1b[31mFailed Tests:\x1b[0m');
      this.results.tests
        .filter(t => t.failed > 0)
        .forEach(t => {
          console.log(`  - ${t.name}`);
          t.errors.forEach(e => console.log(`    Error: ${e}`));
        });
    }
    
    console.log('\n' + '='.repeat(60));
    
    // Generate coverage report
    this.generateCoverageReport();
  }
  
  async generateCoverageReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.results.total,
        passed: this.results.passed,
        failed: this.results.failed,
        skipped: this.results.skipped,
        duration: this.results.duration,
        passRate: this.results.total > 0 
          ? Math.round((this.results.passed / (this.results.passed + this.results.failed)) * 100)
          : 0
      },
      tests: this.results.tests,
      coverage: {
        // Estimate coverage based on test files
        utilities: this.countTestsForPattern('test-.*util'),
        services: this.countTestsForPattern('test-.*service'),
        api: this.countTestsForPattern('test-api'),
        data: this.countTestsForPattern('test-data'),
        pipeline: this.countTestsForPattern('test-pipeline')
      }
    };
    
    // Save report to file
    const reportPath = path.join(__dirname, 'coverage', 'test-report.json');
    
    try {
      await fs.mkdir(path.dirname(reportPath), { recursive: true });
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      logger.info(`Coverage report saved to ${reportPath}`);
    } catch (error) {
      logger.error('Failed to save coverage report:', error);
    }
    
    return report;
  }
  
  countTestsForPattern(pattern) {
    const regex = new RegExp(pattern);
    const matching = this.results.tests.filter(t => regex.test(t.name));
    
    return {
      total: matching.length,
      passed: matching.reduce((sum, t) => sum + t.passed, 0),
      failed: matching.reduce((sum, t) => sum + t.failed, 0)
    };
  }
}

// Main execution
async function main() {
  const runner = new TestRunner();
  const results = await runner.runAllTests();
  
  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Export for use as module
export { TestRunner };
export default main;

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    logger.error('Test runner failed:', error);
    process.exit(1);
  });
}