class DigitalTwinTester {
  constructor() {
    this.apiEndpoint = this.getApiEndpoint();
    this.currentDatasetId = localStorage.getItem('currentDatasetId') || 'surf-clothing';
    this.datasets = [];
    this.currentImageData = null;
    
    this.initializeEventListeners();
    this.loadDatasets();
    this.showDevModeIndicator();
  }
  
  getApiEndpoint() {
    return window.location.hostname === 'localhost' 
      ? 'http://localhost:3000/api' 
      : '/api';
  }
  
  showDevModeIndicator() {
    const devMode = document.getElementById('devMode');
    if (window.location.hostname === 'localhost') {
      devMode.style.display = 'block';
    }
  }
  
  initializeEventListeners() {
    // Test button
    document.getElementById('testButton').addEventListener('click', () => {
      this.generateResponses();
    });
    
    // Clear button
    document.getElementById('clearButton').addEventListener('click', () => {
      this.clearForm();
    });
    
    // Image upload
    const imageUpload = document.getElementById('imageUpload');
    imageUpload.addEventListener('change', (e) => {
      this.handleImageUpload(e);
    });
    
    // Remove image
    document.getElementById('removeImage').addEventListener('click', () => {
      this.removeImage();
    });
    
    // Enter key in textarea
    document.getElementById('marketingInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        this.generateResponses();
      }
    });
    
    // Modal controls
    document.querySelector('.close-modal').addEventListener('click', () => {
      this.closeModal();
    });
    
    document.getElementById('cancelUpload').addEventListener('click', () => {
      this.closeModal();
    });
    
    document.getElementById('segmentMethod').addEventListener('change', (e) => {
      document.getElementById('manualSegments').style.display = 
        e.target.value === 'manual' ? 'block' : 'none';
    });
    
    document.getElementById('datasetUploadForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.uploadDataset();
    });
  }
  
  async loadDatasets() {
    try {
      const response = await fetch(`${this.apiEndpoint}/list-datasets`);
      const datasets = await response.json();
      
      this.datasets = datasets;
      this.updateDatasetSelector(datasets);
      this.updateDatasetInfo();
    } catch (error) {
      console.error('Failed to load datasets:', error);
      this.updateDatasetSelector([]);
    }
  }
  
  updateDatasetSelector(datasets) {
    const selector = document.getElementById('datasetSelector');
    
    // Create selector HTML
    const html = `
      <label>Current Dataset:</label>
      <select id="datasetSelect">
        ${datasets.map(d => `
          <option value="${d.id}" ${d.id === this.currentDatasetId ? 'selected' : ''}>
            ${d.name} ${d.status === 'processing' ? '(Processing...)' : ''}
          </option>
        `).join('')}
        ${datasets.length === 0 ? '<option value="surf-clothing">Surf Clothing (Default)</option>' : ''}
      </select>
      <button id="uploadNewDataset" class="secondary-button">Upload New Dataset</button>
    `;
    
    selector.innerHTML = html;
    
    // Add event listeners
    document.getElementById('datasetSelect').addEventListener('change', (e) => {
      this.switchDataset(e.target.value);
    });
    
    document.getElementById('uploadNewDataset').addEventListener('click', () => {
      this.showUploadModal();
    });
  }
  
  switchDataset(datasetId) {
    this.currentDatasetId = datasetId;
    localStorage.setItem('currentDatasetId', datasetId);
    this.updateDatasetInfo();
  }
  
  async updateDatasetInfo() {
    const infoDiv = document.getElementById('datasetInfo');
    
    try {
      const response = await fetch(`${this.apiEndpoint}/dataset-config/${this.currentDatasetId}`);
      const config = await response.json();
      
      infoDiv.innerHTML = `
        <div class="dataset-info">
          <h3>${config.name || this.currentDatasetId}</h3>
          <p>${config.description || 'Consumer research dataset'}</p>
          <div class="dataset-stats">
            <span>Segments: ${config.segments?.length || 4}</span>
            <span>Responses: ${config.responseCount || 'N/A'}</span>
            <span>Dimensions: ${config.keyDimensions?.join(', ') || 'Multiple'}</span>
          </div>
        </div>
      `;
    } catch (error) {
      console.error('Failed to load dataset info:', error);
      infoDiv.innerHTML = '';
    }
  }
  
  async handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      event.target.value = '';
      return;
    }
    
    // Read and display image
    const reader = new FileReader();
    reader.onload = (e) => {
      this.currentImageData = e.target.result.split(',')[1]; // Remove data:image/jpeg;base64, prefix
      this.showImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);
  }
  
  showImagePreview(src) {
    const preview = document.getElementById('imagePreview');
    const img = document.getElementById('previewImg');
    img.src = src;
    preview.style.display = 'block';
  }
  
  removeImage() {
    this.currentImageData = null;
    document.getElementById('imageUpload').value = '';
    document.getElementById('imagePreview').style.display = 'none';
  }
  
  async generateResponses() {
    const marketingInput = document.getElementById('marketingInput').value.trim();
    
    if (!marketingInput) {
      alert('Please enter marketing content to test');
      return;
    }
    
    // Show loading
    document.getElementById('loadingIndicator').style.display = 'block';
    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('analysisSection').style.display = 'none';
    document.getElementById('testButton').disabled = true;
    
    try {
      const response = await fetch(`${this.apiEndpoint}/generate-response`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          marketingContent: marketingInput,
          imageData: this.currentImageData,
          datasetId: this.currentDatasetId,
          segments: ['Leader', 'Leaning', 'Learner', 'Laggard']
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      this.displayResults(data);
    } catch (error) {
      console.error('Error generating responses:', error);
      alert('Failed to generate responses. Please try again.');
    } finally {
      document.getElementById('loadingIndicator').style.display = 'none';
      document.getElementById('testButton').disabled = false;
    }
  }
  
  displayResults(data) {
    // Show results sections
    document.getElementById('resultsSection').style.display = 'block';
    document.getElementById('analysisSection').style.display = 'block';
    
    // Display aggregate metrics
    this.displayAggregateMetrics(data.aggregateMetrics);
    
    // Display individual responses
    this.displayResponses(data.responses);
    
    // Display analysis
    this.displayAnalysis(data);
  }
  
  displayAggregateMetrics(metrics) {
    const metricsDiv = document.getElementById('aggregateMetrics');
    
    if (!metrics) {
      metricsDiv.innerHTML = '';
      return;
    }
    
    const sentimentTotal = Object.values(metrics.sentimentDistribution || {}).reduce((a, b) => a + b, 0);
    
    metricsDiv.innerHTML = `
      <div class="metric-card">
        <div class="metric-label">Average Purchase Intent</div>
        <div class="metric-value">${metrics.avgPurchaseIntent || 0}/10</div>
        <div class="purchase-scale">
          <div class="purchase-bar">
            <div class="purchase-fill" style="width: ${(metrics.avgPurchaseIntent || 0) * 10}%"></div>
          </div>
        </div>
      </div>
      
      <div class="metric-card">
        <div class="metric-label">Sentiment Distribution</div>
        <div class="sentiment-bar">
          <div class="sentiment-positive" style="width: ${(metrics.sentimentDistribution.positive / sentimentTotal) * 100}%"></div>
          <div class="sentiment-neutral" style="width: ${(metrics.sentimentDistribution.neutral / sentimentTotal) * 100}%"></div>
          <div class="sentiment-negative" style="width: ${(metrics.sentimentDistribution.negative / sentimentTotal) * 100}%"></div>
        </div>
        <div style="margin-top: 8px; font-size: 12px;">
          Positive: ${metrics.sentimentDistribution.positive || 0} | 
          Neutral: ${metrics.sentimentDistribution.neutral || 0} | 
          Negative: ${metrics.sentimentDistribution.negative || 0}
        </div>
      </div>
      
      <div class="metric-card">
        <div class="metric-label">Top Decision Factors</div>
        <div class="key-factors" style="margin-top: 10px;">
          ${(metrics.topKeyFactors || []).map(f => `
            <span class="factor-tag">${f.factor} (${f.count})</span>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  displayResponses(responses) {
    const responsesDiv = document.getElementById('responses');
    
    responsesDiv.innerHTML = responses.map(r => {
      const segmentClass = r.segment.toLowerCase();
      const badgeColor = this.getSegmentColor(segmentClass);
      
      return `
        <div class="response-card ${segmentClass}">
          <div class="segment-header">
            <span class="segment-name">${r.segment}</span>
            <span class="segment-badge" style="background: ${badgeColor}; color: white;">
              ${r.segment}
            </span>
          </div>
          
          <div class="persona-info">
            <div class="persona-name">${r.persona.name || `${r.segment} Consumer`}</div>
            <div class="persona-details">
              ${r.persona.age ? `${r.persona.age} years old` : ''}
              ${r.persona.occupation ? ` | ${r.persona.occupation}` : ''}
              ${r.persona.location ? ` | ${r.persona.location}` : ''}
            </div>
          </div>
          
          <div class="response-text">
            "${r.response}"
          </div>
          
          <div class="response-metrics">
            <div class="metric">
              <span class="metric-label">Sentiment</span>
              <span class="metric-value sentiment-${r.sentiment}">${r.sentiment}</span>
            </div>
            
            <div class="metric">
              <span class="metric-label">Purchase Intent</span>
              <span class="metric-value">${r.purchaseIntent}/10</span>
              <div class="purchase-scale">
                <div class="purchase-bar">
                  <div class="purchase-fill" style="width: ${r.purchaseIntent * 10}%"></div>
                </div>
              </div>
            </div>
          </div>
          
          ${r.keyFactors && r.keyFactors.length > 0 ? `
            <div class="key-factors">
              ${r.keyFactors.map(f => `<span class="factor-tag">${f}</span>`).join('')}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }
  
  displayAnalysis(data) {
    const analysisDiv = document.getElementById('analysis');
    
    const insights = this.generateInsights(data);
    
    analysisDiv.innerHTML = `
      <div class="analysis-grid">
        <div class="analysis-card">
          <h3>Market Readiness</h3>
          <p>${insights.marketReadiness}</p>
        </div>
        
        <div class="analysis-card">
          <h3>Key Opportunities</h3>
          <ul>
            ${insights.opportunities.map(o => `<li>${o}</li>`).join('')}
          </ul>
        </div>
        
        <div class="analysis-card">
          <h3>Potential Concerns</h3>
          <ul>
            ${insights.concerns.map(c => `<li>${c}</li>`).join('')}
          </ul>
        </div>
        
        <div class="analysis-card">
          <h3>Recommendations</h3>
          <ul>
            ${insights.recommendations.map(r => `<li>${r}</li>`).join('')}
          </ul>
        </div>
      </div>
    `;
  }
  
  generateInsights(data) {
    const metrics = data.aggregateMetrics;
    const responses = data.responses;
    
    const avgIntent = parseFloat(metrics.avgPurchaseIntent);
    const positivePercent = (metrics.sentimentDistribution.positive / responses.length) * 100;
    
    const insights = {
      marketReadiness: '',
      opportunities: [],
      concerns: [],
      recommendations: []
    };
    
    // Market readiness assessment
    if (avgIntent >= 7) {
      insights.marketReadiness = 'Strong market acceptance indicated. Consumers show high purchase intent across segments.';
    } else if (avgIntent >= 5) {
      insights.marketReadiness = 'Moderate market acceptance. Some segments show interest but refinement needed.';
    } else {
      insights.marketReadiness = 'Limited market acceptance. Significant improvements needed to appeal to target segments.';
    }
    
    // Opportunities
    if (positivePercent > 50) {
      insights.opportunities.push('Positive sentiment dominates - strong foundation for launch');
    }
    
    responses.forEach(r => {
      if (r.purchaseIntent >= 8 && r.segment) {
        insights.opportunities.push(`Strong appeal to ${r.segment} segment`);
      }
    });
    
    // Concerns
    if (avgIntent < 5) {
      insights.concerns.push('Low overall purchase intent requires attention');
    }
    
    responses.forEach(r => {
      if (r.sentiment === 'negative') {
        insights.concerns.push(`${r.segment} segment shows resistance`);
      }
    });
    
    // Recommendations
    if (avgIntent < 7) {
      insights.recommendations.push('Consider refining value proposition to increase appeal');
    }
    
    if (metrics.topKeyFactors && metrics.topKeyFactors.length > 0) {
      insights.recommendations.push(`Focus messaging on: ${metrics.topKeyFactors.map(f => f.factor).join(', ')}`);
    }
    
    // Remove duplicates
    insights.opportunities = [...new Set(insights.opportunities)].slice(0, 3);
    insights.concerns = [...new Set(insights.concerns)].slice(0, 3);
    insights.recommendations = [...new Set(insights.recommendations)].slice(0, 3);
    
    // Add default if empty
    if (insights.opportunities.length === 0) {
      insights.opportunities.push('Further analysis needed to identify specific opportunities');
    }
    if (insights.concerns.length === 0) {
      insights.concerns.push('No major concerns identified');
    }
    if (insights.recommendations.length === 0) {
      insights.recommendations.push('Continue testing with varied marketing messages');
    }
    
    return insights;
  }
  
  getSegmentColor(segment) {
    const colors = {
      leader: '#059669',
      leaning: '#3b82f6',
      learner: '#f59e0b',
      laggard: '#ef4444',
      default: '#64748b'
    };
    
    return colors[segment] || colors.default;
  }
  
  clearForm() {
    document.getElementById('marketingInput').value = '';
    this.removeImage();
    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('analysisSection').style.display = 'none';
  }
  
  showUploadModal() {
    document.getElementById('uploadModal').style.display = 'flex';
  }
  
  closeModal() {
    document.getElementById('uploadModal').style.display = 'none';
    document.getElementById('datasetUploadForm').reset();
    document.getElementById('uploadProgress').style.display = 'none';
  }
  
  async uploadDataset() {
    const formData = new FormData();
    
    // Get form values
    const surveyFile = document.getElementById('surveyFile').files[0];
    const pdfFiles = document.getElementById('pdfFiles').files;
    
    if (!surveyFile) {
      alert('Please select a survey data file');
      return;
    }
    
    formData.append('survey', surveyFile);
    for (let pdf of pdfFiles) {
      formData.append('pdfs', pdf);
    }
    
    // Build configuration
    const config = {
      name: document.getElementById('datasetName').value,
      segmentationMethod: document.getElementById('segmentMethod').value,
      keyDimensions: Array.from(document.querySelectorAll('#dimensionCheckboxes input:checked'))
        .map(cb => cb.value)
    };
    
    if (config.segmentationMethod === 'manual') {
      config.predefinedSegments = document.getElementById('segmentNames').value
        .split(',')
        .map(s => s.trim());
    }
    
    formData.append('config', JSON.stringify(config));
    
    // Show progress
    document.getElementById('datasetUploadForm').style.display = 'none';
    document.getElementById('uploadProgress').style.display = 'block';
    
    try {
      const response = await fetch(`${this.apiEndpoint}/upload-dataset`, {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Update progress text
        document.querySelector('.progress-text').textContent = 'Processing dataset...';
        
        // Poll for completion
        this.pollForCompletion(result.datasetId);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      alert('Upload failed: ' + error.message);
      this.closeModal();
    }
  }
  
  async pollForCompletion(datasetId) {
    const checkStatus = async () => {
      try {
        const response = await fetch(`${this.apiEndpoint}/dataset-status/${datasetId}`);
        const status = await response.json();
        
        if (status.isComplete) {
          this.closeModal();
          await this.loadDatasets();
          this.switchDataset(datasetId);
          alert('Dataset processed successfully!');
        } else if (status.error) {
          alert('Processing failed: ' + status.error);
          this.closeModal();
        } else {
          // Continue polling
          setTimeout(checkStatus, 3000);
        }
      } catch (error) {
        console.error('Error checking status:', error);
        setTimeout(checkStatus, 5000);
      }
    };
    
    setTimeout(checkStatus, 3000);
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.digitalTwinTester = new DigitalTwinTester();
});