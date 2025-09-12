#!/usr/bin/env node
/**
 * Recursive Syntax Fixer - Find and fix JavaScript syntax errors
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

class RecursiveSyntaxFixer {
    constructor() {
        this.htmlFile = path.join(projectRoot, 'public', 'three-stage-analysis-redesigned.html');
        this.fixesApplied = [];
    }
    
    async extractJavaScript() {
        console.log('🔍 Extracting JavaScript from HTML...');
        
        const content = await fs.readFile(this.htmlFile, 'utf8');
        
        // Extract all JavaScript code between <script> tags
        const scriptMatches = [...content.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
        
        if (scriptMatches.length === 0) {
            throw new Error('No JavaScript found in HTML file');
        }
        
        // Combine all JavaScript code
        const jsCode = scriptMatches.map(match => match[1]).join('\n\n');
        
        return { jsCode, fullContent: content };
    }
    
    async findSyntaxErrors(jsCode) {
        console.log('🔍 Analyzing JavaScript for syntax errors...');
        
        // Write JS to temp file for syntax checking
        const tempJsFile = path.join(projectRoot, 'debug', 'temp-syntax-check.js');
        await fs.writeFile(tempJsFile, jsCode, 'utf8');
        
        const { spawn } = await import('child_process');
        
        return new Promise((resolve) => {
            const nodeProcess = spawn('node', ['-c', tempJsFile], {
                stdio: ['pipe', 'pipe', 'pipe']
            });
            
            let stderr = '';
            
            nodeProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            nodeProcess.on('close', (code) => {
                resolve({
                    hasErrors: code !== 0,
                    errorOutput: stderr,
                    tempFile: tempJsFile
                });
            });
        });
    }
    
    async findTryCatchBlocks(content) {
        console.log('🔍 Finding try/catch/finally block issues...');
        
        // Find all try blocks and check their structure
        const tryMatches = [...content.matchAll(/try\s*\{/g)];
        const issues = [];
        
        for (const match of tryMatches) {
            const startIndex = match.index;
            const lineNumber = this.getLineNumber(content, startIndex);
            
            // Extract the try block and surrounding code
            const surrounding = content.substring(startIndex, startIndex + 1000);
            
            // Check if it has proper catch or finally
            const hasCatch = /catch\s*\([^)]*\)\s*\{/.test(surrounding);
            const hasFinally = /finally\s*\{/.test(surrounding);
            
            if (!hasCatch && !hasFinally) {
                issues.push({
                    type: 'missing_catch_or_finally',
                    lineNumber,
                    startIndex,
                    context: surrounding.substring(0, 200)
                });
            }
        }
        
        return issues;
    }
    
    getLineNumber(content, index) {
        return content.substring(0, index).split('\n').length;
    }
    
    async fixTryCatchBlocks(content, issues) {
        console.log('🔧 Fixing try/catch/finally block issues...');
        
        let fixedContent = content;
        let modified = false;
        
        // Sort issues by index in reverse order to avoid offset problems
        const sortedIssues = issues.sort((a, b) => b.startIndex - a.startIndex);
        
        for (const issue of sortedIssues) {
            if (issue.type === 'missing_catch_or_finally') {
                console.log(`Fixing missing catch/finally at line ${issue.lineNumber}`);
                
                // Find the end of the try block
                const tryStart = issue.startIndex;
                const tryBlockStart = fixedContent.indexOf('{', tryStart) + 1;
                
                // Find matching closing brace for try block
                let braceCount = 1;
                let tryBlockEnd = tryBlockStart;
                
                while (braceCount > 0 && tryBlockEnd < fixedContent.length) {
                    if (fixedContent[tryBlockEnd] === '{') braceCount++;
                    if (fixedContent[tryBlockEnd] === '}') braceCount--;
                    tryBlockEnd++;
                }
                
                // Check what comes after the try block
                const afterTry = fixedContent.substring(tryBlockEnd, tryBlockEnd + 50).trim();
                
                if (!afterTry.startsWith('catch') && !afterTry.startsWith('finally')) {
                    // Add a catch block
                    const catchBlock = ` catch (error) {
                console.error('Error:', error);
                showAlert('An error occurred. Please try again.', 'error');
            }`;
                    
                    fixedContent = fixedContent.substring(0, tryBlockEnd) + 
                                 catchBlock + 
                                 fixedContent.substring(tryBlockEnd);
                    
                    this.fixesApplied.push(`Added catch block at line ${issue.lineNumber}`);
                    modified = true;
                }
            }
        }
        
        return { fixedContent, modified };
    }
    
    async runRecursiveSyntaxFix() {
        console.log('\n🎯 RECURSIVE SYNTAX FIXER');
        console.log('='.repeat(50));
        
        try {
            // Step 1: Extract JavaScript
            const { jsCode, fullContent } = await this.extractJavaScript();
            
            // Step 2: Check for syntax errors
            const syntaxCheck = await this.findSyntaxErrors(jsCode);
            
            console.log(`Syntax errors found: ${syntaxCheck.hasErrors}`);
            if (syntaxCheck.hasErrors) {
                console.log('Error details:', syntaxCheck.errorOutput);
            }
            
            // Step 3: Find try/catch issues specifically
            const tryCatchIssues = await this.findTryCatchBlocks(fullContent);
            console.log(`Try/catch issues found: ${tryCatchIssues.length}`);
            
            // Step 4: Fix the issues
            if (tryCatchIssues.length > 0) {
                const { fixedContent, modified } = await this.fixTryCatchBlocks(fullContent, tryCatchIssues);
                
                if (modified) {
                    await fs.writeFile(this.htmlFile, fixedContent, 'utf8');
                    console.log('✅ Syntax errors fixed and saved');
                }
            }
            
            // Step 5: Clean up temp file
            try {
                await fs.unlink(syntaxCheck.tempFile);
            } catch (e) {
                // Ignore cleanup errors
            }
            
            return {
                hadErrors: syntaxCheck.hasErrors || tryCatchIssues.length > 0,
                fixesApplied: this.fixesApplied
            };
            
        } catch (error) {
            console.error('Syntax fixing failed:', error);
            return { hadErrors: true, error: error.message };
        }
    }
    
    async printReport(results) {
        console.log('\n' + '='.repeat(60));
        console.log('🎯 RECURSIVE SYNTAX FIXER RESULTS');
        console.log('='.repeat(60));
        
        if (results.error) {
            console.log(`❌ Fixing failed: ${results.error}`);
        } else if (results.fixesApplied.length > 0) {
            console.log('✅ Fixes Applied:');
            results.fixesApplied.forEach((fix, i) => {
                console.log(`  ${i + 1}. ${fix}`);
            });
        } else {
            console.log('✅ No syntax errors found');
        }
        
        console.log('\n🚀 Syntax fixing complete!');
        console.log('='.repeat(60));
    }
}

async function main() {
    const fixer = new RecursiveSyntaxFixer();
    
    try {
        const results = await fixer.runRecursiveSyntaxFix();
        await fixer.printReport(results);
        
        process.exit(results.hadErrors ? 1 : 0);
        
    } catch (error) {
        console.error('💥 Recursive syntax fixing failed:', error);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export default RecursiveSyntaxFixer;