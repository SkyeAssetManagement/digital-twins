/**
 * P1.2: Archetype Review Frontend Component
 * 
 * Purpose: Display customer archetypes in readable format with selection capability
 * Features: Card-based layout, visual percentage breakdown, expandable details, export functionality
 */

class ArchetypeReviewer {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.archetypes = [];
        this.selectedArchetypes = new Set();
        this.datasetId = null;
        this.options = {
            showExportOptions: true,
            allowMultipleSelection: true,
            showAdvancedMetrics: true,
            ...options
        };
        
        this.callbacks = {
            onArchetypeSelected: options.onArchetypeSelected || (() => {}),
            onProceedToDigitalTwin: options.onProceedToDigitalTwin || (() => {}),
            onExportData: options.onExportData || (() => {})
        };

        this.init();
    }

    init() {
        if (!this.container) {
            console.error('ArchetypeReviewer: Container not found');
            return;
        }

        this.container.className = 'archetype-reviewer';
        this.render();
    }

    async loadArchetypes(datasetId) {
        this.datasetId = datasetId;
        
        try {
            this.showLoading('Loading customer archetypes...');
            
            const response = await fetch(`/api/customer-archetypes?datasetId=${datasetId}`);
            const data = await response.json();
            
            if (!response.ok || !data.success) {
                throw new Error(data.error || `Failed to load archetypes: ${response.status}`);
            }

            this.archetypes = data.archetypes || [];
            this.datasetMetadata = {
                dataset_name: data.dataset_name,
                target_demographic: data.target_demographic,
                coverage: data.coverage,
                total_responses: data.total_responses,
                analysis_confidence: data.analysis_confidence,
                metadata: data.metadata
            };

            this.hideLoading();
            this.render();
            
            return data;
            
        } catch (error) {
            console.error('Failed to load archetypes:', error);
            this.showError(`Failed to load archetypes: ${error.message}`);
            return null;
        }
    }

    render() {
        this.container.innerHTML = `
            <div class="archetype-reviewer-header">
                <div class="header-content">
                    <h2>Customer Archetype Review</h2>
                    <p class="subtitle">Review and validate generated customer archetypes before proceeding to digital twin generation</p>
                </div>
                ${this.datasetMetadata ? this.renderDatasetInfo() : ''}
            </div>
            
            <div class="archetype-content">
                ${this.archetypes.length > 0 ? this.renderArchetypeGrid() : this.renderEmptyState()}
            </div>
            
            ${this.archetypes.length > 0 ? this.renderActionButtons() : ''}
            ${this.options.showExportOptions ? this.renderExportOptions() : ''}
        `;

        this.attachEventListeners();
    }

    renderDatasetInfo() {
        const metadata = this.datasetMetadata;
        return `
            <div class="dataset-info-card">
                <div class="dataset-info-grid">
                    <div class="info-item">
                        <span class="info-label">Dataset</span>
                        <span class="info-value">${metadata.dataset_name}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Target Demographic</span>
                        <span class="info-value">${metadata.target_demographic}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Market Coverage</span>
                        <span class="info-value">${metadata.coverage}% of ${metadata.total_responses} responses</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Analysis Confidence</span>
                        <span class="info-value confidence-${this.getConfidenceLevel(metadata.analysis_confidence)}">${metadata.analysis_confidence}%</span>
                    </div>
                </div>
            </div>
        `;
    }

    renderArchetypeGrid() {
        return `
            <div class="archetype-grid">
                ${this.archetypes.map((archetype, index) => this.renderArchetypeCard(archetype, index)).join('')}
            </div>
            <div class="coverage-visualization">
                ${this.renderCoverageChart()}
            </div>
        `;
    }

    renderArchetypeCard(archetype, index) {
        const isSelected = this.selectedArchetypes.has(archetype.id);
        const cardClass = isSelected ? 'archetype-card selected' : 'archetype-card';
        
        return `
            <div class="${cardClass}" data-archetype-id="${archetype.id}">
                <div class="card-header">
                    <div class="archetype-title">
                        <h3>${archetype.name}</h3>
                        <span class="percentage-badge">${archetype.percentage}%</span>
                    </div>
                    <div class="selection-checkbox">
                        <input type="checkbox" 
                               id="archetype-${archetype.id}" 
                               ${isSelected ? 'checked' : ''}
                               ${this.options.allowMultipleSelection ? '' : 'name="archetype-selection"'}>
                        <label for="archetype-${archetype.id}"></label>
                    </div>
                </div>
                
                <div class="card-content">
                    <div class="core-motivation">
                        <strong>Core Motivation:</strong>
                        <p>${archetype.demographics.core_motivation}</p>
                    </div>
                    
                    <div class="key-characteristics">
                        <strong>Key Characteristics:</strong>
                        <ul>
                            ${archetype.demographics.characteristics.slice(0, 3).map(char => `<li>${char}</li>`).join('')}
                        </ul>
                    </div>
                    
                    <div class="sample-info">
                        <span class="sample-size">${archetype.sample_size} respondents</span>
                        <span class="confidence-score">Confidence: ${archetype.demographics.statistical_confidence}%</span>
                    </div>
                </div>
                
                <div class="card-expandable" data-expanded="false">
                    <button class="expand-toggle" data-archetype-id="${archetype.id}">
                        <span class="expand-text">Show Details</span>
                        <span class="expand-icon">▼</span>
                    </button>
                    
                    <div class="expanded-content">
                        ${this.renderExpandedDetails(archetype)}
                    </div>
                </div>
            </div>
        `;
    }

    renderExpandedDetails(archetype) {
        return `
            <div class="expanded-details">
                <div class="detail-section">
                    <h4>Pain Points Addressed</h4>
                    <div class="pain-points-list">
                        ${archetype.pain_points.map(pain => `
                            <div class="pain-point-item category-${pain.category}">
                                <span class="category-tag">${pain.category}</span>
                                <span class="description">${pain.description}</span>
                                <span class="severity severity-${pain.severity}">${pain.severity}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>Preferences & Pleasure Points</h4>
                    <div class="preferences-list">
                        ${archetype.preferences.map(pref => `
                            <div class="preference-item category-${pref.category}">
                                <span class="category-tag">${pref.category}</span>
                                <span class="description">${pref.description}</span>
                                <span class="importance importance-${pref.importance}">${pref.importance}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>Marketing Approach</h4>
                    <div class="marketing-approach">
                        <p>${archetype.marketing_approach}</p>
                    </div>
                </div>
                
                ${this.options.showAdvancedMetrics ? this.renderAdvancedMetrics(archetype) : ''}
                
                <div class="detail-section">
                    <h4>Discriminatory Questions</h4>
                    <div class="discriminatory-questions">
                        ${archetype.discriminatory_questions.map(q => `
                            <div class="question-item">
                                <span class="question-text">${q.text}</span>
                                <span class="discrimination-power">${q.discrimination_power}% discrimination</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    renderAdvancedMetrics(archetype) {
        return `
            <div class="detail-section">
                <h4>Validation Metrics</h4>
                <div class="validation-metrics">
                    <div class="metric-item">
                        <span class="metric-label">Internal Consistency</span>
                        <div class="metric-bar">
                            <div class="metric-fill" style="width: ${archetype.validation.internal_consistency}%"></div>
                            <span class="metric-value">${archetype.validation.internal_consistency}%</span>
                        </div>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">External Validity</span>
                        <div class="metric-bar">
                            <div class="metric-fill" style="width: ${archetype.validation.external_validity}%"></div>
                            <span class="metric-value">${archetype.validation.external_validity}%</span>
                        </div>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">Predictive Accuracy</span>
                        <div class="metric-bar">
                            <div class="metric-fill" style="width: ${archetype.validation.predictive_accuracy}%"></div>
                            <span class="metric-value">${archetype.validation.predictive_accuracy}%</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderCoverageChart() {
        const totalCoverage = this.datasetMetadata.coverage;
        const uncovered = Math.max(0, 100 - totalCoverage);
        
        return `
            <div class="coverage-chart">
                <h4>Market Coverage Visualization</h4>
                <div class="coverage-breakdown">
                    <div class="coverage-bar">
                        ${this.archetypes.map(archetype => `
                            <div class="coverage-segment" 
                                 style="width: ${archetype.percentage}%" 
                                 data-archetype-id="${archetype.id}"
                                 title="${archetype.name}: ${archetype.percentage}%">
                            </div>
                        `).join('')}
                        ${uncovered > 0 ? `<div class="coverage-uncovered" style="width: ${uncovered}%" title="Uncovered: ${uncovered}%"></div>` : ''}
                    </div>
                    <div class="coverage-legend">
                        ${this.archetypes.map((archetype, index) => `
                            <div class="legend-item">
                                <div class="legend-color" data-archetype-index="${index}"></div>
                                <span>${archetype.name} (${archetype.percentage}%)</span>
                            </div>
                        `).join('')}
                        ${uncovered > 0 ? `
                            <div class="legend-item">
                                <div class="legend-color uncovered"></div>
                                <span>Uncovered (${uncovered}%)</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    renderActionButtons() {
        const selectedCount = this.selectedArchetypes.size;
        const canProceed = selectedCount > 0;
        
        return `
            <div class="action-buttons">
                <div class="selection-summary">
                    <span class="selected-count">${selectedCount} archetype${selectedCount !== 1 ? 's' : ''} selected</span>
                    ${selectedCount > 0 ? `
                        <button class="btn btn-secondary" onclick="archetypeReviewer.clearSelection()">Clear Selection</button>
                    ` : ''}
                </div>
                
                <div class="primary-actions">
                    <button class="btn btn-primary ${canProceed ? '' : 'disabled'}" 
                            id="proceed-to-digital-twin"
                            ${canProceed ? '' : 'disabled'}>
                        Proceed to Digital Twin Generation
                        ${canProceed ? `<span class="btn-count">(${selectedCount})</span>` : ''}
                    </button>
                </div>
            </div>
        `;
    }

    renderExportOptions() {
        return `
            <div class="export-options">
                <h4>Export Archetype Data</h4>
                <div class="export-buttons">
                    <button class="btn btn-outline" onclick="archetypeReviewer.exportData('json')">Export JSON</button>
                    <button class="btn btn-outline" onclick="archetypeReviewer.exportData('csv')">Export CSV</button>
                    <button class="btn btn-outline" onclick="archetypeReviewer.exportSelectedData('json')">Export Selected (JSON)</button>
                </div>
            </div>
        `;
    }

    renderEmptyState() {
        return `
            <div class="empty-state">
                <div class="empty-icon">🎯</div>
                <h3>No Archetypes Available</h3>
                <p>Customer archetypes need to be generated first.</p>
                <button class="btn btn-primary" onclick="location.reload()">Run Three-Stage Analysis</button>
            </div>
        `;
    }

    attachEventListeners() {
        // Archetype selection
        this.container.querySelectorAll('.archetype-card input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const archetypeId = e.target.id.replace('archetype-', '');
                this.toggleArchetypeSelection(archetypeId, e.target.checked);
            });
        });

        // Card selection (click anywhere on card)
        this.container.querySelectorAll('.archetype-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.type === 'checkbox' || e.target.tagName === 'BUTTON') return;
                
                const archetypeId = card.dataset.archetypeId;
                const checkbox = card.querySelector('input[type="checkbox"]');
                checkbox.checked = !checkbox.checked;
                this.toggleArchetypeSelection(archetypeId, checkbox.checked);
            });
        });

        // Expand/collapse details
        this.container.querySelectorAll('.expand-toggle').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const archetypeId = button.dataset.archetypeId;
                this.toggleExpandedDetails(archetypeId);
            });
        });

        // Proceed to digital twin
        const proceedButton = this.container.querySelector('#proceed-to-digital-twin');
        if (proceedButton) {
            proceedButton.addEventListener('click', () => {
                if (this.selectedArchetypes.size > 0) {
                    this.proceedToDigitalTwin();
                }
            });
        }

        // Coverage chart interaction
        this.container.querySelectorAll('.coverage-segment').forEach(segment => {
            segment.addEventListener('click', () => {
                const archetypeId = segment.dataset.archetypeId;
                this.highlightArchetype(archetypeId);
            });
        });
    }

    toggleArchetypeSelection(archetypeId, selected) {
        if (selected) {
            if (!this.options.allowMultipleSelection) {
                this.selectedArchetypes.clear();
                // Uncheck other checkboxes
                this.container.querySelectorAll('.archetype-card input[type="checkbox"]').forEach(cb => {
                    if (cb.id !== `archetype-${archetypeId}`) {
                        cb.checked = false;
                    }
                });
                // Remove selected class from other cards
                this.container.querySelectorAll('.archetype-card').forEach(card => {
                    card.classList.remove('selected');
                });
            }
            this.selectedArchetypes.add(archetypeId);
        } else {
            this.selectedArchetypes.delete(archetypeId);
        }

        // Update UI
        this.updateCardSelection(archetypeId, selected);
        this.updateActionButtons();
        
        // Trigger callback
        this.callbacks.onArchetypeSelected(Array.from(this.selectedArchetypes), archetypeId, selected);
    }

    updateCardSelection(archetypeId, selected) {
        const card = this.container.querySelector(`[data-archetype-id="${archetypeId}"]`);
        if (card) {
            card.classList.toggle('selected', selected);
        }
    }

    updateActionButtons() {
        const actionButtonsContainer = this.container.querySelector('.action-buttons');
        if (actionButtonsContainer) {
            const selectedCount = this.selectedArchetypes.size;
            const canProceed = selectedCount > 0;
            
            const selectedCountSpan = actionButtonsContainer.querySelector('.selected-count');
            if (selectedCountSpan) {
                selectedCountSpan.textContent = `${selectedCount} archetype${selectedCount !== 1 ? 's' : ''} selected`;
            }
            
            const proceedButton = actionButtonsContainer.querySelector('#proceed-to-digital-twin');
            if (proceedButton) {
                proceedButton.classList.toggle('disabled', !canProceed);
                proceedButton.disabled = !canProceed;
                
                const countSpan = proceedButton.querySelector('.btn-count');
                if (countSpan) {
                    countSpan.textContent = canProceed ? `(${selectedCount})` : '';
                }
            }
        }
    }

    toggleExpandedDetails(archetypeId) {
        const card = this.container.querySelector(`[data-archetype-id="${archetypeId}"]`);
        const expandable = card.querySelector('.card-expandable');
        const expandIcon = card.querySelector('.expand-icon');
        const expandText = card.querySelector('.expand-text');
        
        const isExpanded = expandable.dataset.expanded === 'true';
        
        expandable.dataset.expanded = !isExpanded;
        expandIcon.textContent = !isExpanded ? '▲' : '▼';
        expandText.textContent = !isExpanded ? 'Hide Details' : 'Show Details';
    }

    highlightArchetype(archetypeId) {
        // Remove existing highlights
        this.container.querySelectorAll('.archetype-card').forEach(card => {
            card.classList.remove('highlighted');
        });
        
        // Add highlight to selected archetype
        const targetCard = this.container.querySelector(`[data-archetype-id="${archetypeId}"]`);
        if (targetCard) {
            targetCard.classList.add('highlighted');
            targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Remove highlight after 2 seconds
            setTimeout(() => {
                targetCard.classList.remove('highlighted');
            }, 2000);
        }
    }

    clearSelection() {
        this.selectedArchetypes.clear();
        this.container.querySelectorAll('.archetype-card input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });
        this.container.querySelectorAll('.archetype-card').forEach(card => {
            card.classList.remove('selected');
        });
        this.updateActionButtons();
    }

    proceedToDigitalTwin() {
        const selectedArchetypes = Array.from(this.selectedArchetypes).map(id => 
            this.archetypes.find(arch => arch.id === id)
        );
        
        this.callbacks.onProceedToDigitalTwin({
            datasetId: this.datasetId,
            selectedArchetypes: selectedArchetypes,
            datasetMetadata: this.datasetMetadata
        });
    }

    async exportData(format = 'json') {
        try {
            let exportData;
            
            if (format === 'json') {
                exportData = {
                    dataset_info: this.datasetMetadata,
                    archetypes: this.archetypes,
                    export_metadata: {
                        exported_at: new Date().toISOString(),
                        total_archetypes: this.archetypes.length,
                        format: 'json'
                    }
                };
                
                this.downloadFile(
                    JSON.stringify(exportData, null, 2),
                    `customer-archetypes-${this.datasetId}.json`,
                    'application/json'
                );
                
            } else if (format === 'csv') {
                const csvData = this.convertToCSV(this.archetypes);
                this.downloadFile(
                    csvData,
                    `customer-archetypes-${this.datasetId}.csv`,
                    'text/csv'
                );
            }
            
            this.callbacks.onExportData(format, exportData || this.archetypes);
            
        } catch (error) {
            console.error('Export failed:', error);
            this.showError(`Export failed: ${error.message}`);
        }
    }

    async exportSelectedData(format = 'json') {
        if (this.selectedArchetypes.size === 0) {
            this.showError('Please select at least one archetype to export');
            return;
        }
        
        const selectedData = Array.from(this.selectedArchetypes).map(id => 
            this.archetypes.find(arch => arch.id === id)
        );
        
        if (format === 'json') {
            const exportData = {
                dataset_info: this.datasetMetadata,
                selected_archetypes: selectedData,
                export_metadata: {
                    exported_at: new Date().toISOString(),
                    selected_count: selectedData.length,
                    total_available: this.archetypes.length,
                    format: 'json'
                }
            };
            
            this.downloadFile(
                JSON.stringify(exportData, null, 2),
                `selected-archetypes-${this.datasetId}.json`,
                'application/json'
            );
        }
        
        this.callbacks.onExportData(format, selectedData);
    }

    convertToCSV(archetypes) {
        const headers = [
            'Name', 'Percentage', 'Sample Size', 'Core Motivation',
            'Key Characteristics', 'Marketing Approach', 'Statistical Confidence',
            'Pain Points', 'Preferences', 'Validation Score'
        ];
        
        const rows = archetypes.map(arch => [
            arch.name,
            arch.percentage,
            arch.sample_size,
            arch.demographics.core_motivation,
            arch.demographics.characteristics.join('; '),
            arch.marketing_approach,
            arch.demographics.statistical_confidence,
            arch.pain_points.map(p => p.description).join('; '),
            arch.preferences.map(p => p.description).join('; '),
            Math.round((arch.validation.internal_consistency + 
                       arch.validation.external_validity + 
                       arch.validation.predictive_accuracy) / 3)
        ]);
        
        return [headers, ...rows].map(row => 
            row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        ).join('\n');
    }

    downloadFile(content, filename, contentType) {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
    }

    showLoading(message = 'Loading...') {
        this.container.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p>${message}</p>
            </div>
        `;
    }

    hideLoading() {
        const loadingState = this.container.querySelector('.loading-state');
        if (loadingState) {
            loadingState.remove();
        }
    }

    showError(message) {
        this.container.innerHTML = `
            <div class="error-state">
                <div class="error-icon">⚠️</div>
                <h3>Error Loading Archetypes</h3>
                <p>${message}</p>
                <button class="btn btn-primary" onclick="location.reload()">Reload Page</button>
            </div>
        `;
    }

    getConfidenceLevel(confidence) {
        if (confidence >= 85) return 'high';
        if (confidence >= 70) return 'medium';
        return 'low';
    }

    // Public API methods
    getSelectedArchetypes() {
        return Array.from(this.selectedArchetypes).map(id => 
            this.archetypes.find(arch => arch.id === id)
        );
    }

    selectArchetype(archetypeId) {
        const checkbox = this.container.querySelector(`#archetype-${archetypeId}`);
        if (checkbox) {
            checkbox.checked = true;
            this.toggleArchetypeSelection(archetypeId, true);
        }
    }

    deselectArchetype(archetypeId) {
        const checkbox = this.container.querySelector(`#archetype-${archetypeId}`);
        if (checkbox) {
            checkbox.checked = false;
            this.toggleArchetypeSelection(archetypeId, false);
        }
    }

    refresh() {
        if (this.datasetId) {
            this.loadArchetypes(this.datasetId);
        }
    }
}

// Global instance for easy access
let archetypeReviewer = null;