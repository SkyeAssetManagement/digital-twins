/**
 * Prompt Loader Utility
 * Loads .md prompt templates and provides parameter substitution
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PromptLoader {
    constructor() {
        this.promptCache = new Map();
        this.promptsDirectory = __dirname;
    }

    /**
     * Load a prompt template from .md file
     * @param {string} promptFileName - Name of the .md file (without extension)
     * @returns {string} Raw prompt template with placeholders
     */
    loadPromptTemplate(promptFileName) {
        const cacheKey = promptFileName;
        
        if (this.promptCache.has(cacheKey)) {
            return this.promptCache.get(cacheKey);
        }

        try {
            const filePath = path.join(this.promptsDirectory, `${promptFileName}.md`);
            console.log(`[DEBUG] Trying to load prompt from: ${filePath}`);
            console.log(`[DEBUG] Directory exists: ${fs.existsSync(this.promptsDirectory)}`);
            console.log(`[DEBUG] File exists: ${fs.existsSync(filePath)}`);
            
            const promptContent = fs.readFileSync(filePath, 'utf8');
            
            this.promptCache.set(cacheKey, promptContent);
            return promptContent;
            
        } catch (error) {
            console.error(`Error loading prompt template ${promptFileName}:`, error);
            throw new Error(`Failed to load prompt template: ${promptFileName}`);
        }
    }

    /**
     * Load and substitute parameters in a prompt template
     * @param {string} promptFileName - Name of the .md file
     * @param {Object} parameters - Parameters to substitute in template
     * @returns {string} Prompt with parameters substituted
     */
    buildPrompt(promptFileName, parameters = {}) {
        const template = this.loadPromptTemplate(promptFileName);
        return this.substituteParameters(template, parameters);
    }

    /**
     * Substitute parameters in template using {{PARAMETER_NAME}} syntax
     * @param {string} template - Template string with placeholders
     * @param {Object} parameters - Parameters to substitute
     * @returns {string} Template with parameters substituted
     */
    substituteParameters(template, parameters) {
        let result = template;
        
        Object.entries(parameters).forEach(([key, value]) => {
            const placeholder = `{{${key.toUpperCase()}}}`;
            const stringValue = this.formatParameterValue(value);
            result = result.replace(new RegExp(placeholder, 'g'), stringValue);
        });
        
        // Check for unsubstituted placeholders and provide default values
        result = this.handleUnsubstitutedPlaceholders(result);
        
        return result;
    }

    /**
     * Format parameter values for insertion into templates
     * @param {any} value - Parameter value to format
     * @returns {string} Formatted string value
     */
    formatParameterValue(value) {
        if (value === null || value === undefined) {
            return 'Not specified';
        }
        
        if (typeof value === 'object') {
            if (Array.isArray(value)) {
                return value.map(item => this.formatArrayItem(item)).join('\n');
            } else {
                return JSON.stringify(value, null, 2);
            }
        }
        
        return String(value);
    }

    /**
     * Format array items for better readability
     * @param {any} item - Array item to format
     * @returns {string} Formatted item
     */
    formatArrayItem(item) {
        if (typeof item === 'object') {
            return `- ${JSON.stringify(item)}`;
        }
        return `- ${item}`;
    }

    /**
     * Handle unsubstituted placeholders by providing default values or warnings
     * @param {string} template - Template that may contain unsubstituted placeholders
     * @returns {string} Template with defaults applied
     */
    handleUnsubstitutedPlaceholders(template) {
        const placeholderRegex = /\{\{([^}]+)\}\}/g;
        const matches = template.match(placeholderRegex);
        
        if (matches) {
            console.warn('Unsubstituted placeholders found:', matches);
            
            // Replace common unsubstituted placeholders with default values
            const defaults = {
                '{{TARGET_DEMOGRAPHIC}}': 'General consumer population',
                '{{SURVEY_CONTEXT}}': 'Consumer behavior and preferences survey',
                '{{QUESTIONS_LIST}}': 'Questions will be analyzed when provided',
                '{{STATISTICAL_SUMMARY}}': 'Statistical analysis will be provided',
                '{{DEMOGRAPHIC_CONTEXT}}': 'Demographic context will be determined from data',
                '{{CORRELATION_INSIGHTS}}': 'Correlation analysis will be provided',
                '{{SPENDING_PATTERNS}}': 'Spending pattern analysis will be provided',
                '{{BEHAVIORAL_CLUSTERS}}': 'Behavioral cluster analysis will be provided',
                '{{STATISTICAL_OVERVIEW}}': 'Statistical overview will be provided',
                '{{STAGE1_STATISTICAL_FOUNDATION}}': 'Statistical foundation from Stage 1 analysis',
                '{{PAIN_PLEASURE_POINTS}}': 'Pain and pleasure points from Stage 2 analysis',
                '{{BEHAVIORAL_INSIGHTS}}': 'Behavioral insights from previous analysis',
                '{{EVIDENCE_MATRIX}}': 'Evidence matrix from behavioral analysis',
                '{{CONFIDENCE_METRICS}}': 'Confidence metrics from previous stages',
                '{{MARKETING_CONTENT}}': '[Marketing content will be provided for analysis]'
            };
            
            Object.entries(defaults).forEach(([placeholder, defaultValue]) => {
                template = template.replace(new RegExp(placeholder, 'g'), defaultValue);
            });
        }
        
        return template;
    }

    /**
     * Clear the prompt cache (useful for development/testing)
     */
    clearCache() {
        this.promptCache.clear();
    }

    /**
     * Get list of available prompt templates
     * @returns {string[]} Array of available prompt file names
     */
    getAvailablePrompts() {
        try {
            const files = fs.readdirSync(this.promptsDirectory);
            return files
                .filter(file => file.endsWith('.md') && file.startsWith('prompt_'))
                .map(file => file.replace('.md', ''));
        } catch (error) {
            console.error('Error reading prompts directory:', error);
            return [];
        }
    }

    /**
     * Validate that all required parameters are provided for a template
     * @param {string} promptFileName - Prompt template file name
     * @param {Object} parameters - Parameters being provided
     * @returns {Object} Validation result with missing parameters
     */
    validateParameters(promptFileName, parameters = {}) {
        const template = this.loadPromptTemplate(promptFileName);
        const placeholderRegex = /\{\{([^}]+)\}\}/g;
        const requiredParameters = new Set();
        
        let match;
        while ((match = placeholderRegex.exec(template)) !== null) {
            requiredParameters.add(match[1]);
        }
        
        const providedParameters = new Set(Object.keys(parameters).map(key => key.toUpperCase()));
        const missingParameters = [...requiredParameters].filter(param => !providedParameters.has(param));
        
        return {
            isValid: missingParameters.length === 0,
            missingParameters,
            requiredParameters: [...requiredParameters],
            providedParameters: [...providedParameters]
        };
    }
}

// Create singleton instance
const promptLoader = new PromptLoader();

export default promptLoader;
export { PromptLoader };