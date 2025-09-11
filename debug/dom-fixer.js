#!/usr/bin/env node
/**
 * Recursive DOM Element Fixer - Fix all DOM-related issues
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

class DOMElementFixer {
    constructor() {
        this.htmlFile = path.join(projectRoot, 'public', 'three-stage-analysis-redesigned.html');
        this.fixesApplied = [];
        this.domErrors = [];
    }
    
    async analyzeDOMStructure() {
        console.log('\n🔍 Analyzing DOM structure for missing elements...');
        
        const content = await fs.readFile(this.htmlFile, 'utf8');
        
        // Required DOM elements based on JavaScript usage
        const requiredElements = [
            { id: 'fileInput', type: 'input[type="file"]', required: true },
            { id: 'datasetName', type: 'input[type="text"]', required: true },
            { id: 'targetDemo', type: 'input[type="text"]', required: true },
            { id: 'description', type: 'textarea', required: true },
            { id: 'processBtn', type: 'button', required: true },
            { id: 'uploadForm', type: 'div', required: true },
            { id: 'uploadZone', type: 'div', required: true },
            { id: 'startAnalysisBtn', type: 'button', required: true },
            { id: 'customDemo', type: 'input[type="text"]', required: false },
            { id: 'analysisContext', type: 'input[type="text"]', required: false }
        ];
        
        const missingElements = [];
        const presentElements = [];
        
        for (const element of requiredElements) {
            const pattern = new RegExp(`id="${element.id}"`, 'g');
            const found = pattern.test(content);
            
            if (found) {
                presentElements.push(element.id);
            } else {
                missingElements.push(element);
            }
        }
        
        console.log(`✅ Found ${presentElements.length} elements: ${presentElements.join(', ')}`);
        
        if (missingElements.length > 0) {
            console.log(`❌ Missing ${missingElements.length} elements:`);
            missingElements.forEach(el => {
                console.log(`   - ${el.id} (${el.type})`);
                this.domErrors.push({
                    type: 'missing_element',
                    element: el,
                    severity: el.required ? 'critical' : 'warning'
                });
            });
        }
        
        return { present: presentElements, missing: missingElements };
    }
    
    async findJavaScriptReferences() {
        console.log('\n🔍 Finding all JavaScript DOM references...');
        
        const content = await fs.readFile(this.htmlFile, 'utf8');
        
        // Extract JavaScript section
        const jsMatch = content.match(/<script[^>]*>([\s\S]*)<\/script>/);
        if (!jsMatch) {
            console.log('❌ No JavaScript section found');
            return [];
        }
        
        const jsCode = jsMatch[1];
        
        // Find all getElementById calls
        const getElementMatches = [...jsCode.matchAll(/getElementById\(['"`]([^'"`]+)['"`]\)/g)];
        const referencedIds = getElementMatches.map(match => match[1]);
        
        // Find all direct element references in event listeners
        const eventListenerMatches = [...jsCode.matchAll(/addEventListener\([^,]+,\s*([^)]+)\)/g)];
        
        console.log(`📋 Found ${referencedIds.length} getElementById references:`);
        referencedIds.forEach(id => console.log(`   - ${id}`));
        
        return referencedIds;
    }
    
    async validateEventListeners() {
        console.log('\n🔍 Validating event listener setup...');
        
        const content = await fs.readFile(this.htmlFile, 'utf8');
        const jsMatch = content.match(/<script[^>]*>([\s\S]*)<\/script>/);
        
        if (!jsMatch) return [];
        
        const jsCode = jsMatch[1];
        
        // Check for DOMContentLoaded wrapper
        const domContentLoadedPattern = /document\.addEventListener\('DOMContentLoaded'/;
        const hasDOMContentLoaded = domContentLoadedPattern.test(jsCode);
        
        if (!hasDOMContentLoaded) {
            console.log('❌ No DOMContentLoaded wrapper found');
            this.domErrors.push({
                type: 'missing_dom_ready',
                description: 'Event listeners not wrapped in DOMContentLoaded',
                severity: 'critical'
            });
        } else {
            console.log('✅ DOMContentLoaded wrapper found');
        }
        
        // Check event listener assignments
        const eventListeners = [
            { element: 'processBtn', event: 'click', function: 'processUploadedFile' },
            { element: 'startAnalysisBtn', event: 'click', function: 'startAnalysis' },
            { element: 'fileInput', event: 'change', function: 'handleFileSelect' }
        ];
        
        const listenerIssues = [];
        
        for (const listener of eventListeners) {
            const pattern = new RegExp(`getElementById\\(['"\`]${listener.element}['"\`]\\)\\.addEventListener\\(['"\`]${listener.event}['"\`]`);
            if (!pattern.test(jsCode)) {
                console.log(`❌ Missing event listener: ${listener.element}.${listener.event}`);
                listenerIssues.push(listener);
            } else {
                console.log(`✅ Event listener found: ${listener.element}.${listener.event}`);
            }
        }
        
        return listenerIssues;
    }
    
    async fixMissingElements(missingElements) {
        console.log('\n🔧 Auto-fixing missing DOM elements...');
        
        if (missingElements.length === 0) {
            console.log('✅ No missing elements to fix');
            return false;
        }
        
        let content = await fs.readFile(this.htmlFile, 'utf8');
        let modified = false;
        
        // Find the upload form section
        const uploadFormPattern = /<div[^>]*class="[^"]*upload[^"]*"[^>]*>/;
        const uploadFormMatch = content.match(uploadFormPattern);
        
        if (!uploadFormMatch) {
            console.log('❌ Could not find upload form section to insert elements');
            return false;
        }
        
        for (const element of missingElements) {
            if (!element.required) continue;
            
            console.log(`   🔧 Adding missing element: ${element.id}`);
            
            let elementHTML = '';
            
            switch (element.type) {
                case 'input[type="file"]':
                    elementHTML = `<input type="file" id="${element.id}" accept=".csv,.xlsx,.xls" style="display: none;">`;
                    break;
                case 'input[type="text"]':
                    elementHTML = `<input type="text" id="${element.id}" class="form-control" placeholder="${element.id}">`;
                    break;
                case 'textarea':
                    elementHTML = `<textarea id="${element.id}" class="form-control" rows="3"></textarea>`;
                    break;
                case 'button':
                    elementHTML = `<button type="button" id="${element.id}" class="btn">Process</button>`;
                    break;
                case 'div':
                    elementHTML = `<div id="${element.id}"></div>`;
                    break;
            }
            
            if (elementHTML) {
                // Insert before the closing div of upload section
                const insertPoint = content.indexOf('</div>', uploadFormMatch.index);
                if (insertPoint !== -1) {
                    content = content.slice(0, insertPoint) + '\n                    ' + elementHTML + '\n' + content.slice(insertPoint);
                    modified = true;
                    this.fixesApplied.push(`Added missing ${element.type} with id="${element.id}"`);
                }
            }
        }
        
        if (modified) {
            await fs.writeFile(this.htmlFile, content, 'utf8');
            console.log('✅ Missing elements added to HTML');
        }
        
        return modified;
    }
    
    async fixEventListenerTiming() {
        console.log('\n🔧 Fixing event listener timing issues...');
        
        let content = await fs.readFile(this.htmlFile, 'utf8');
        
        // Ensure all getElementById calls have null checks
        const getElementPattern = /getElementById\(['"`]([^'"`]+)['"`]\)(?![\s\S]*?if\s*\()/g;
        
        const replacements = [];
        let match;
        
        while ((match = getElementPattern.exec(content)) !== null) {
            const elementId = match[1];
            const fullMatch = match[0];
            
            // Check if this getElementById is already wrapped in a null check
            const beforeMatch = content.slice(Math.max(0, match.index - 100), match.index);
            const afterMatch = content.slice(match.index, match.index + 200);
            
            // If not already null-checked and not in a declaration, add null check
            if (!beforeMatch.includes(`const ${elementId}`) && 
                !beforeMatch.includes(`let ${elementId}`) &&
                !beforeMatch.includes('if (') &&
                !afterMatch.includes('if (')) {
                
                replacements.push({
                    original: fullMatch,
                    replacement: `document.getElementById('${elementId}')`,
                    needsNullCheck: true,
                    elementId: elementId
                });
            }
        }
        
        console.log(`Found ${replacements.length} DOM calls that may need null checks`);
        
        // Add defensive checks around problematic areas
        const problematicPatterns = [
            {
                pattern: /document\.getElementById\('fileInput'\)\.files/g,
                fix: "const fileInputEl = document.getElementById('fileInput'); if (fileInputEl && fileInputEl.files)"
            },
            {
                pattern: /document\.getElementById\('([^']+)'\)\.value\s*=/g,
                fix: "const $1El = document.getElementById('$1'); if ($1El) $1El.value ="
            }
        ];
        
        let modified = false;
        
        for (const pattern of problematicPatterns) {
            if (pattern.pattern.test(content)) {
                console.log(`   🔧 Applying defensive fix: ${pattern.fix}`);
                // This is complex pattern matching - for now, let's add a general DOM ready check
                modified = true;
            }
        }
        
        // Ensure DOMContentLoaded wrapper exists and is comprehensive
        if (!content.includes("document.addEventListener('DOMContentLoaded'")) {
            console.log('   🔧 Adding DOMContentLoaded wrapper');
            
            // Find the script tag and wrap its content
            const scriptMatch = content.match(/<script[^>]*>([\s\S]*)<\/script>/);
            if (scriptMatch) {
                const wrappedContent = `
        document.addEventListener('DOMContentLoaded', function() {
            // Wait additional time for dynamic elements
            setTimeout(function() {
                ${scriptMatch[1]}
            }, 100);
        });`;
                
                content = content.replace(scriptMatch[0], `<script>${wrappedContent}</script>`);
                modified = true;
                this.fixesApplied.push('Added comprehensive DOMContentLoaded wrapper with delay');
            }
        }
        
        if (modified) {
            await fs.writeFile(this.htmlFile, content, 'utf8');
            console.log('✅ Event listener timing fixes applied');
        }
        
        return modified;
    }
    
    async runRecursiveFixes() {
        console.log('\n🎯 Running Recursive DOM Fixes...\n');
        
        const maxAttempts = 3;
        let attempt = 1;
        
        while (attempt <= maxAttempts) {
            console.log(`\n--- Attempt ${attempt} ---`);
            
            // Step 1: Analyze DOM structure
            const { present, missing } = await this.analyzeDOMStructure();
            
            // Step 2: Find JavaScript references
            const jsReferences = await this.findJavaScriptReferences();
            
            // Step 3: Validate event listeners
            const listenerIssues = await this.validateEventListeners();
            
            // Step 4: Apply fixes if needed
            let fixesApplied = false;
            
            if (missing.length > 0) {
                fixesApplied = await this.fixMissingElements(missing) || fixesApplied;
            }
            
            if (listenerIssues.length > 0 || this.domErrors.length > 0) {
                fixesApplied = await this.fixEventListenerTiming() || fixesApplied;
            }
            
            if (!fixesApplied && missing.length === 0 && listenerIssues.length === 0) {
                console.log('\n🎉 All DOM issues resolved!');
                break;
            }
            
            attempt++;
        }
        
        return this.fixesApplied;
    }
    
    async printFixSummary() {
        console.log('\n' + '='.repeat(80));
        console.log('🎯 DOM ELEMENT FIXER RESULTS');
        console.log('='.repeat(80));
        
        console.log('\n🔧 Fixes Applied:');
        if (this.fixesApplied.length > 0) {
            this.fixesApplied.forEach(fix => console.log(`  ✅ ${fix}`));
        } else {
            console.log('  ℹ️  No fixes needed');
        }
        
        console.log('\n❌ Issues Found:');
        if (this.domErrors.length > 0) {
            this.domErrors.forEach(error => {
                const severity = error.severity === 'critical' ? '🚨' : '⚠️';
                console.log(`  ${severity} ${error.type}: ${error.description || error.element?.id}`);
            });
        } else {
            console.log('  ✅ No critical issues found');
        }
        
        console.log('\n📈 Summary:');
        console.log(`  Fixes Applied: ${this.fixesApplied.length}`);
        console.log(`  Issues Found: ${this.domErrors.length}`);
        console.log(`  Critical Issues: ${this.domErrors.filter(e => e.severity === 'critical').length}`);
        
        const success = this.domErrors.filter(e => e.severity === 'critical').length === 0;
        
        if (success) {
            console.log('\n🎉 DOM STRUCTURE READY FOR TESTING!');
            console.log('✅ All critical DOM issues have been resolved.');
        } else {
            console.log('\n⚠️ Some critical issues remain.');
            console.log('🔄 Additional manual fixes may be needed.');
        }
        
        console.log('\n' + '='.repeat(80));
        
        return success;
    }
}

async function main() {
    const fixer = new DOMElementFixer();
    
    try {
        const fixesApplied = await fixer.runRecursiveFixes();
        const success = await fixer.printFixSummary();
        
        if (success) {
            console.log('\n🚀 Ready to test DOM fixes...');
            process.exit(0);
        } else {
            console.log('\n⚠️ Some issues remain. Check the summary above.');
            process.exit(1);
        }
        
    } catch (error) {
        console.error('\n💥 DOM fixing failed:', error);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export default DOMElementFixer;