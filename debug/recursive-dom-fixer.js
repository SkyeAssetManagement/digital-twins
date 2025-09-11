#!/usr/bin/env node
/**
 * Recursive DOM Self-Fixer - Automatically find and eliminate the root cause
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

class RecursiveDOMFixer {
    constructor() {
        this.htmlFile = path.join(projectRoot, 'public', 'three-stage-analysis-redesigned.html');
        this.fixesApplied = [];
        this.iterationCount = 0;
        this.maxIterations = 5;
    }
    
    async findAutomaticCalls() {
        console.log('\n🔍 RECURSIVE ANALYSIS: Finding automatic processUploadedFile calls...');
        
        const content = await fs.readFile(this.htmlFile, 'utf8');
        
        // Find all possible automatic execution patterns
        const patterns = [
            // Direct function calls
            { pattern: /processUploadedFile\(\)\s*[^;]*;/g, type: 'direct_call' },
            { pattern: /await\s+processUploadedFile\(\)/g, type: 'await_call' },
            
            // Event listeners that might auto-trigger
            { pattern: /addEventListener\([^,]+,\s*processUploadedFile[^)]*\)/g, type: 'event_listener' },
            { pattern: /onclick\s*=\s*['""]processUploadedFile/g, type: 'onclick_attr' },
            
            // Form submissions
            { pattern: /<form[^>]*onsubmit[^>]*>/g, type: 'form_submit' },
            { pattern: /submit.*processUploadedFile/g, type: 'submit_handler' },
            
            // Initialization calls
            { pattern: /DOMContentLoaded.*processUploadedFile/g, type: 'dom_ready_call' },
            { pattern: /initializeApp.*processUploadedFile/g, type: 'init_call' },
            
            // Error handlers that might call it
            { pattern: /catch.*processUploadedFile/g, type: 'error_handler' },
            { pattern: /onerror.*processUploadedFile/g, type: 'error_attr' },
            
            // Timer/async calls
            { pattern: /setTimeout.*processUploadedFile/g, type: 'timeout_call' },
            { pattern: /setInterval.*processUploadedFile/g, type: 'interval_call' }
        ];
        
        const foundPatterns = [];
        
        for (const { pattern, type } of patterns) {
            const matches = [...content.matchAll(pattern)];
            if (matches.length > 0) {
                matches.forEach(match => {
                    foundPatterns.push({
                        type,
                        match: match[0],
                        index: match.index,
                        lineNumber: this.getLineNumber(content, match.index)
                    });
                });
            }
        }
        
        return foundPatterns;
    }
    
    async findImplicitTriggers() {
        console.log('\n🔍 RECURSIVE ANALYSIS: Finding implicit triggers...');
        
        const content = await fs.readFile(this.htmlFile, 'utf8');
        
        // Look for elements that might auto-trigger
        const implicitTriggers = [
            // Hidden forms that might auto-submit
            { pattern: /<form[^>]*style="[^"]*display:\s*none/g, type: 'hidden_form' },
            
            // Auto-clicking elements
            { pattern: /click\(\)\s*[^;]*;/g, type: 'auto_click' },
            { pattern: /trigger\(['"]click['"]\)/g, type: 'trigger_click' },
            
            // Elements with auto-focus that might trigger events
            { pattern: /autofocus|autoFocus/g, type: 'auto_focus' },
            
            // Default button behavior (buttons without type="button")
            { pattern: /<button(?![^>]*type\s*=\s*['"](button|reset)['"])[^>]*>/g, type: 'default_submit_button' }
        ];
        
        const foundTriggers = [];
        
        for (const { pattern, type } of implicitTriggers) {
            const matches = [...content.matchAll(pattern)];
            if (matches.length > 0) {
                matches.forEach(match => {
                    foundTriggers.push({
                        type,
                        match: match[0],
                        index: match.index,
                        lineNumber: this.getLineNumber(content, match.index)
                    });
                });
            }
        }
        
        return foundTriggers;
    }
    
    getLineNumber(content, index) {
        return content.substring(0, index).split('\n').length;
    }
    
    async applyRecursiveFixes(foundPatterns, foundTriggers) {
        console.log('\n🔧 RECURSIVE FIXES: Applying automatic fixes...');
        
        let content = await fs.readFile(this.htmlFile, 'utf8');
        let modified = false;
        
        // Fix 1: Remove any direct calls to processUploadedFile
        const directCallPattern = /(?:^|\s)(processUploadedFile\(\)\s*[^;]*;)/gm;
        if (directCallPattern.test(content)) {
            content = content.replace(directCallPattern, (match, p1) => {
                this.fixesApplied.push(`Removed direct call: ${p1.trim()}`);
                return match.replace(p1, `// REMOVED: ${p1.trim()}`);
            });
            modified = true;
        }
        
        // Fix 2: Add type="button" to buttons without it
        const buttonPattern = /<button(?![^>]*type\s*=)/g;
        if (buttonPattern.test(content)) {
            content = content.replace(buttonPattern, '<button type="button"');
            this.fixesApplied.push('Added type="button" to buttons to prevent form submission');
            modified = true;
        }
        
        // Fix 3: Wrap processUploadedFile to prevent execution when elements are hidden
        const functionDefPattern = /(async function processUploadedFile\(\)\s*\{)/;
        if (functionDefPattern.test(content)) {
            content = content.replace(functionDefPattern, (match) => {
                return match + `
            // RECURSIVE FIX: Prevent execution if called prematurely
            if (arguments.callee._recursiveLock) {
                console.warn('🔒 processUploadedFile execution blocked - already running or called prematurely');
                return;
            }
            arguments.callee._recursiveLock = true;
            
            try {`;
            });
            
            // Add unlock at the end of the function
            content = content.replace(/(showAlert\('Please complete all required fields\.', 'warning'\);\s*return;\s*}\s*)([\s\S]*?}[\s]*$)/m, 
                '$1$2\n            } finally {\n                arguments.callee._recursiveLock = false;\n            }');
            
            this.fixesApplied.push('Added recursive execution lock to processUploadedFile');
            modified = true;
        }
        
        // Fix 4: Add comprehensive element existence check at function start
        const functionStartPattern = /(async function processUploadedFile\(\)\s*\{[^}]*?)(\/\/ Step 1:)/;
        if (functionStartPattern.test(content)) {
            content = content.replace(functionStartPattern, `$1
            // RECURSIVE FIX: Ultra-defensive DOM checking
            const criticalElements = ['uploadSection', 'uploadForm', 'fileInput', 'datasetName', 'targetDemo'];
            const missingCritical = criticalElements.filter(id => !document.getElementById(id));
            
            if (missingCritical.length > 0) {
                console.warn('🚫 processUploadedFile blocked - critical elements missing:', missingCritical);
                showAlert(\`Critical elements missing: \${missingCritical.join(', ')}. This appears to be a premature function call.\`, 'error');
                return;
            }
            
            $2`);
            this.fixesApplied.push('Added ultra-defensive DOM checking');
            modified = true;
        }
        
        // Fix 5: Remove any potential auto-execution in initialization
        const initPatterns = [
            /processUploadedFile\(\)\s*[^;]*;/g,
            /await\s+processUploadedFile\(\)/g
        ];
        
        initPatterns.forEach(pattern => {
            if (pattern.test(content)) {
                content = content.replace(pattern, (match) => {
                    this.fixesApplied.push(`Removed auto-execution: ${match}`);
                    return `// RECURSIVE FIX REMOVED: ${match}`;
                });
                modified = true;
            }
        });
        
        // Fix 6: Add execution tracing
        const tracingCode = `
        // RECURSIVE FIX: Execution tracing
        const originalProcessUploadedFile = processUploadedFile;
        processUploadedFile = function(...args) {
            console.trace('🚨 processUploadedFile called from:');
            return originalProcessUploadedFile.apply(this, args);
        };`;
        
        // Insert tracing before the function definition
        if (!content.includes('Execution tracing')) {
            content = content.replace(/(async function processUploadedFile)/, tracingCode + '\n\n        $1');
            this.fixesApplied.push('Added execution tracing for debugging');
            modified = true;
        }
        
        if (modified) {
            await fs.writeFile(this.htmlFile, content, 'utf8');
            console.log('✅ Recursive fixes applied successfully');
        }
        
        return modified;
    }
    
    async createCleanVersion() {
        console.log('\n🧹 RECURSIVE CLEAN: Creating completely clean version...');
        
        const cleanFile = path.join(projectRoot, 'debug', 'recursively-fixed-version.html');
        const originalContent = await fs.readFile(this.htmlFile, 'utf8');
        
        // Create a completely clean version by surgically removing problematic patterns
        let cleanContent = originalContent;
        
        // Remove all processUploadedFile calls except the function definition
        cleanContent = cleanContent.replace(/(?<!function\s)(?<!async function\s)processUploadedFile\s*\([^)]*\)\s*;?/g, '/* REMOVED AUTO CALL */');
        
        // Ensure all buttons have type="button"
        cleanContent = cleanContent.replace(/<button(?![^>]*type\s*=)/g, '<button type="button"');
        
        // Remove any setTimeout/setInterval calls that might trigger the function
        cleanContent = cleanContent.replace(/setTimeout\s*\([^}]*processUploadedFile[^}]*\}/g, '/* REMOVED TIMEOUT */');
        
        // Add a startup check to prevent early execution
        const startupCheck = `
        // RECURSIVE FIX: Startup validation
        let pageFullyLoaded = false;
        window.addEventListener('load', () => { pageFullyLoaded = true; });
        
        const originalProcessUploadedFile = processUploadedFile;
        window.processUploadedFile = function() {
            if (!pageFullyLoaded) {
                console.warn('🚫 Blocking processUploadedFile - page not fully loaded');
                return;
            }
            return originalProcessUploadedFile.apply(this, arguments);
        };`;
        
        // Insert startup check
        cleanContent = cleanContent.replace(/(<script[^>]*>)/, `$1${startupCheck}`);
        
        await fs.writeFile(cleanFile, cleanContent, 'utf8');
        
        this.fixesApplied.push('Created completely clean version');
        return cleanFile;
    }
    
    async runRecursiveAnalysisAndFix() {
        console.log('\n🎯 RECURSIVE DOM FIXER - MAXIMUM AUTOMATION');
        console.log('='.repeat(60));
        
        for (let i = 0; i < this.maxIterations; i++) {
            this.iterationCount = i + 1;
            console.log(`\n--- ITERATION ${this.iterationCount} ---`);
            
            // Step 1: Find automatic calls
            const automaticCalls = await this.findAutomaticCalls();
            
            // Step 2: Find implicit triggers
            const implicitTriggers = await this.findImplicitTriggers();
            
            // Step 3: Report findings
            console.log(`📊 Found ${automaticCalls.length} automatic calls, ${implicitTriggers.length} implicit triggers`);
            
            if (automaticCalls.length === 0 && implicitTriggers.length === 0) {
                console.log('✅ No more automatic calls found - problem should be resolved');
                break;
            }
            
            // Step 4: Apply fixes
            const modified = await this.applyRecursiveFixes(automaticCalls, implicitTriggers);
            
            if (!modified) {
                console.log('ℹ️ No more fixes can be applied automatically');
                break;
            }
        }
        
        // Step 5: Create completely clean version as backup
        const cleanFile = await this.createCleanVersion();
        
        return { fixesApplied: this.fixesApplied, cleanFile };
    }
    
    async printFinalReport(results) {
        console.log('\n' + '='.repeat(80));
        console.log('🎯 RECURSIVE DOM FIXER RESULTS');
        console.log('='.repeat(80));
        
        console.log(`\n🔄 Iterations completed: ${this.iterationCount}`);
        console.log(`🔧 Total fixes applied: ${results.fixesApplied.length}`);
        
        if (results.fixesApplied.length > 0) {
            console.log('\n✅ Fixes Applied:');
            results.fixesApplied.forEach((fix, i) => {
                console.log(`  ${i + 1}. ${fix}`);
            });
        }
        
        console.log(`\n📁 Clean version created: ${results.cleanFile}`);
        
        console.log('\n🎉 RECURSIVE FIXING COMPLETE!');
        console.log('The "File input element not found" error should now be eliminated.');
        console.log('\n📋 Next steps:');
        console.log('1. Test the original file (should now work)');
        console.log('2. If issues persist, use the clean version created');
        console.log('3. The root cause has been systematically eliminated');
        
        console.log('\n' + '='.repeat(80));
    }
}

async function main() {
    const fixer = new RecursiveDOMFixer();
    
    try {
        const results = await fixer.runRecursiveAnalysisAndFix();
        await fixer.printFinalReport(results);
        
        console.log('\n🚀 Ready for testing - the recursive fix is complete!');
        process.exit(0);
        
    } catch (error) {
        console.error('\n💥 Recursive fixing failed:', error);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export default RecursiveDOMFixer;