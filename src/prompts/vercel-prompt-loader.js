/**
 * Vercel-Compatible Prompt Loader
 * Uses embedded templates instead of file system access for serverless environments
 */

import { PROMPT_TEMPLATES, substituteParameters } from './embedded-prompts.js';

class VercelPromptLoader {
    constructor() {
        this.promptCache = new Map();
    }

    /**
     * Load a prompt template from embedded templates
     * @param {string} promptFileName - Name of the prompt (without extension)
     * @returns {string} Raw prompt template with placeholders
     */
    loadPromptTemplate(promptFileName) {
        const cacheKey = promptFileName;
        
        if (this.promptCache.has(cacheKey)) {
            return this.promptCache.get(cacheKey);
        }

        const template = PROMPT_TEMPLATES[promptFileName];
        if (!template) {
            throw new Error(`Prompt template not found: ${promptFileName}`);
        }

        this.promptCache.set(cacheKey, template);
        return template;
    }

    /**
     * Load and substitute parameters in a prompt template
     * @param {string} promptFileName - Name of the prompt
     * @param {Object} parameters - Parameters to substitute in template
     * @returns {string} Prompt with parameters substituted
     */
    buildPrompt(promptFileName, parameters = {}) {
        const template = this.loadPromptTemplate(promptFileName);
        return substituteParameters(template, parameters);
    }

    /**
     * Clear the prompt cache
     */
    clearCache() {
        this.promptCache.clear();
    }

    /**
     * Get list of available prompt templates
     * @returns {string[]} Array of available prompt names
     */
    getAvailablePrompts() {
        return Object.keys(PROMPT_TEMPLATES);
    }

    /**
     * Validate that all required parameters are provided for a template
     * @param {string} promptFileName - Prompt template name
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
const vercelPromptLoader = new VercelPromptLoader();

export default vercelPromptLoader;
export { VercelPromptLoader };