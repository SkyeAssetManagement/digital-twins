/**
 * 7-Step Data Wrangling Pipeline Executor
 * Modular, reusable pipeline execution with comprehensive debugging
 */

class PipelineExecutor {
    constructor(options = {}) {
        this.steps = [
            'debug_environment',
            'load_file',
            'analyze_structure', 
            'get_llm_analysis',
            'apply_wrangling_plan',
            'run_improved_pipeline',
            'validate_output'
        ];
        
        this.stepNames = {
            'debug_environment': 'Debug Environment',
            'load_file': 'Load File',
            'analyze_structure': 'Analyze Structure',
            'get_llm_analysis': 'LLM Analysis',
            'apply_wrangling_plan': 'Apply Wrangling Plan',
            'run_improved_pipeline': 'Improved Pipeline',
            'validate_output': 'Validate Output'
        };
        
        this.documentId = options.documentId || 1;
        this.onStepStart = options.onStepStart || (() => {});
        this.onStepComplete = options.onStepComplete || (() => {});
        this.onStepError = options.onStepError || (() => {});
        this.onPipelineComplete = options.onPipelineComplete || (() => {});
        this.onPipelineError = options.onPipelineError || (() => {});
        
        this.results = {};
        this.isRunning = false;
    }
    
    async execute() {
        if (this.isRunning) {
            console.warn('🔒 Pipeline already running');
            return false;
        }
        
        this.isRunning = true;
        this.results = {};
        
        console.log('🚀 7-Step Data Wrangling Pipeline Started');
        console.log('==========================================');
        console.log(`📁 Document ID: ${this.documentId}`);
        console.log(`⏱️ Started at: ${new Date().toISOString()}`);
        
        let previousResult = null;
        
        try {
            for (let i = 0; i < this.steps.length; i++) {
                const stepName = this.steps[i];
                const stepTitle = this.stepNames[stepName];
                
                console.group(`📍 [STEP ${i + 1}/7] ${stepTitle}`);
                this.onStepStart(stepName, i + 1, stepTitle);
                
                const startTime = Date.now();
                const result = await this.executeStep(stepName, previousResult);
                const duration = Date.now() - startTime;
                
                if (result.success) {
                    console.log(`✅ Step completed in ${duration}ms`);
                    console.log('📊 Result summary:', this.summarizeResult(result));
                    
                    this.results[stepName] = result;
                    this.onStepComplete(stepName, i + 1, result, duration);
                    
                    // Store important data for final display
                    if (stepName === 'get_llm_analysis' && result.result?.columnMapping) {
                        this.results.finalColumnMapping = result.result.columnMapping;
                        this.results.totalColumns = Object.keys(result.result.columnMapping).length;
                        console.log(`🎯 Generated ${this.results.totalColumns} column mappings`);
                    }
                    
                    previousResult = result.result || result;
                } else {
                    throw new Error(`Step failed: ${result.error || 'Unknown error'}`);
                }
                
                console.groupEnd();
            }
            
            console.log('🎉 PIPELINE COMPLETED SUCCESSFULLY!');
            console.log(`📈 Processed ${this.results.totalColumns || 'N/A'} columns`);
            console.log(`⏱️ Completed at: ${new Date().toISOString()}`);
            
            this.onPipelineComplete(this.results);
            return this.results;
            
        } catch (error) {
            console.error('❌ PIPELINE FAILED:', error.message);
            console.groupEnd();
            this.onPipelineError(error);
            throw error;
        } finally {
            this.isRunning = false;
        }
    }
    
    async executeStep(stepName, previousResult) {
        const requestBody = {
            step: stepName,
            documentId: this.documentId,
            previousResult: previousResult,
            analysisParams: {
                rowsToExamine: 5,
                topRowsToIgnore: 0,
                maxColumns: 50
            }
        };
        
        console.log('📤 Request payload:', requestBody);
        
        try {
            const response = await fetch('/api/debug-data-wrangling', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log('📥 Response received:', result);
            
            return result;
        } catch (error) {
            console.error('💥 Network error:', error.message);
            throw error;
        }
    }
    
    summarizeResult(result) {
        if (!result.result) return 'No result data';
        
        const summary = {};
        const data = result.result;
        
        // Key metrics based on step type
        if (data.totalColumnsProcessed) summary.columnsProcessed = data.totalColumnsProcessed;
        if (data.finalRows) summary.rows = data.finalRows;
        if (data.finalColumns) summary.columns = data.finalColumns;
        if (data.validationPassed !== undefined) summary.validation = data.validationPassed;
        if (data.analysisSuccess !== undefined) summary.analysisSuccess = data.analysisSuccess;
        if (data.documentName) summary.document = data.documentName;
        
        return Object.keys(summary).length > 0 ? summary : 'Step completed';
    }
    
    getColumnMappingPreview(count = 12) {
        if (!this.results.finalColumnMapping) return [];
        
        return Object.entries(this.results.finalColumnMapping)
            .slice(0, count)
            .map(([index, mapping]) => ({
                index: parseInt(index),
                longName: mapping.longName,
                shortName: mapping.shortName
            }));
    }
    
    downloadResults(format = 'json') {
        if (!this.results.finalColumnMapping) {
            console.warn('⚠️ No results to download');
            return false;
        }
        
        const mappings = this.results.finalColumnMapping;
        let content, filename, mimeType;
        
        if (format === 'csv') {
            const headers = ['Column Index', 'Long Name', 'Short Name'];
            const rows = Object.entries(mappings).map(([index, mapping]) => [
                index,
                `"${mapping.longName.replace(/"/g, '""')}"`, // Escape quotes
                mapping.shortName
            ]);
            
            content = [headers, ...rows].map(row => row.join(',')).join('\n');
            filename = `column_mappings_${Date.now()}.csv`;
            mimeType = 'text/csv';
        } else {
            content = JSON.stringify(mappings, null, 2);
            filename = `column_mappings_${Date.now()}.json`;
            mimeType = 'application/json';
        }
        
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log(`📁 Downloaded: ${filename}`);
        return true;
    }
    
    // Static method for simple one-click execution
    static async runPipeline(documentId = 1, callbacks = {}) {
        const executor = new PipelineExecutor({
            documentId,
            ...callbacks
        });
        
        return await executor.execute();
    }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PipelineExecutor;
}

// Global availability
window.PipelineExecutor = PipelineExecutor;