# Universal Survey Digital Twins Pipeline Plan

## Executive Summary
This plan outlines the development of a comprehensive, generic pipeline to ingest any consumer survey data, categorize questions using Claude Opus 4.1, dynamically create population-specific archetypes, and build digital twin personas for targeted marketing responses. The system uses proven frameworks like LOHAS as reference points while allowing Claude Opus to generate contextually appropriate archetypes for any target demographic (mothers, retirees, teens, professionals, etc.).

## 1. System Architecture Overview

### 1.1 High-Level Flow
```
Survey Data (Any Format) → Data Ingestion → Question Categorization (Claude Opus) → 
Dynamic Archetype Creation → Response Scoring → Digital Twin Persona Engine → Adaptive UI
```

```mermaid
flowchart TD
    A[Survey Data<br/>Any Format] --> B[Data Ingestion]
    B --> C[Question Categorization<br/>Claude Opus]
    C --> D[Dynamic Archetype<br/>Creation]
    D --> E[Response Scoring]
    E --> F[Digital Twin<br/>Persona Engine]
    F --> G[Adaptive UI]
```

### 1.2 Core Components
1. **Universal Data Ingestion Module**: Multi-format processing with intelligent question concatenation
2. **Adaptive Question Categorization Engine**: Claude Opus 4.1 for context-aware classification
3. **Dynamic Archetype Generation System**: LLM-driven persona creation for any demographic
4. **Universal Scoring & Classification Engine**: Response evaluation and archetype assignment
5. **Adaptive Digital Twin Persona Engine**: Claude Opus 4.1 only (no semantic engine)
6. **Flexible UI**: Configurable interface supporting any survey population

## 2. Data Ingestion & Processing

### 2.1 Universal Data Structure Analysis
- **Supported Formats**: Excel (.xlsx, .xls), CSV, JSON, TSV
- **Adaptive Processing**: Detect and handle various header structures
- **Common Patterns**: 
  - Single header row with questions
  - Multi-row headers requiring concatenation
  - Metadata rows requiring identification and processing
- **Solution**: Intelligent header detection and concatenation based on data structure

### 2.2 Universal Data Processing Steps
1. **Format Detection**: Auto-detect file format and structure
2. **Header Analysis**: Use Claude Opus to identify header patterns and question structure
3. **Intelligent Concatenation**: Concatenate multi-row headers when detected
4. **Data Cleaning**: Remove empty cells, standardize formatting, handle missing values
5. **Question Extraction**: Extract meaningful questions regardless of source format
6. **Demographic Detection**: Identify target population from survey content
7. **Database Preparation**: Transform to suitable format for Supabase storage

### 2.3 Universal Database Schema Design
```sql
-- Survey datasets table
CREATE TABLE survey_datasets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200),
    target_demographic VARCHAR(100), -- mothers, retirees, teens, etc.
    description TEXT,
    file_path TEXT,
    total_questions INTEGER,
    total_responses INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Questions table
CREATE TABLE survey_questions (
    id SERIAL PRIMARY KEY,
    dataset_id INTEGER REFERENCES survey_datasets(id),
    original_headers TEXT[], -- array of original header components
    concatenated_question TEXT,
    category VARCHAR(100), -- dynamic categories based on survey type
    importance_score FLOAT,
    predictive_power FLOAT,
    question_order INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Dynamic archetypes table  
CREATE TABLE survey_archetypes (
    id SERIAL PRIMARY KEY,
    dataset_id INTEGER REFERENCES survey_datasets(id),
    name VARCHAR(100),
    description TEXT,
    characteristics JSONB, -- flexible structure for any archetype properties
    spending_propensity FLOAT,
    behavioral_patterns JSONB,
    motivators JSONB,
    population_percentage FLOAT,
    reference_frameworks JSONB, -- LOHAS, generational, etc.
    created_at TIMESTAMP DEFAULT NOW()
);

-- Survey responses table
CREATE TABLE survey_responses (
    id SERIAL PRIMARY KEY,
    dataset_id INTEGER REFERENCES survey_datasets(id),
    respondent_id VARCHAR(50),
    question_id INTEGER REFERENCES survey_questions(id),
    response_value TEXT,
    normalized_score FLOAT,
    archetype_id INTEGER REFERENCES survey_archetypes(id),
    confidence_score FLOAT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Digital twin personas
CREATE TABLE digital_twin_personas (
    id SERIAL PRIMARY KEY,
    archetype_id INTEGER REFERENCES survey_archetypes(id),
    persona_profile JSONB,
    claude_prompt TEXT,
    response_style JSONB,
    demographic_context TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## 3. Adaptive Question Categorization Using Claude Opus 4.1

### 3.1 Dynamic Categorization Framework
The system uses Claude Opus 4.1 to analyze survey content and dynamically determine appropriate categories based on the target demographic and survey context. Examples:

**For Mothers**: Values, Quality, Price, Health/Welfare
**For Retirees**: Financial Security, Health, Lifestyle, Family/Legacy  
**For Professionals**: Career, Work-Life Balance, Status, Efficiency
**For Students**: Cost, Social, Academic, Future Planning

### 3.2 Universal Claude Opus Categorization Prompt
```
You are an expert consumer behavior analyst. Analyze the provided survey data to understand the target demographic and survey context, then create appropriate question categories and classify each question.

SURVEY CONTEXT ANALYSIS:
1. First, identify the target demographic from the survey questions and content
2. Determine 4-6 meaningful categories that would be most relevant for this demographic's consumer behavior
3. Consider proven frameworks (LOHAS, generational theory, psychographics) as reference points
4. Focus on categories that would be predictive of purchasing behavior and decision-making

TARGET DEMOGRAPHIC: [AUTO-DETECTED OR PROVIDED]
SURVEY CONTEXT: [SURVEY DESCRIPTION/SAMPLE QUESTIONS]

TASK: Create categories and classify each question

Step 1 - Category Creation:
Create 4-6 categories that are:
- Relevant to this demographic's decision-making
- Predictive of consumer behavior  
- Distinct and non-overlapping
- Based on psychological/behavioral drivers

Step 2 - Question Classification:
For each survey question, provide:
- Category (from your created categories)
- Confidence score (0-1)
- Reasoning (2-3 sentences explaining the classification)
- Predictive power estimate (0-1) for consumer behavior correlation
- Behavioral insight (what this question reveals about the respondent)

Questions to analyze:
[CONCATENATED_QUESTIONS_LIST]

Respond in JSON format:
{
  "demographic_analysis": {
    "target_demographic": "identified demographic",
    "survey_context": "survey purpose and scope",
    "reference_frameworks": ["LOHAS", "generational", "etc."]
  },
  "categories": [
    {
      "name": "category name",
      "description": "what this category measures",
      "behavioral_significance": "why this matters for consumer behavior"
    }
  ],
  "categorizations": [
    {
      "question": "question text",
      "category": "assigned category",
      "confidence": 0.95,
      "reasoning": "explanation",
      "predictive_power": 0.80,
      "behavioral_insight": "what this reveals about respondent"
    }
  ]
}
```

### 3.3 Processing Logic
1. **Demographic Detection**: Auto-detect target demographic from survey content
2. **Dynamic Category Creation**: Let Claude Opus create contextually appropriate categories
3. **Batch Processing**: Process questions in groups of 20-30 to avoid token limits
4. **Validation**: Ensure each question gets exactly one category
5. **Quality Control**: Flag low-confidence categorizations for manual review
6. **Storage**: Save categorizations to survey_questions table with dataset reference

## 4. Dynamic Archetype Creation Methodology

### 4.1 LLM-Driven Archetype Generation
The system uses Claude Opus 4.1 to analyze survey response patterns and create contextually appropriate archetypes for any demographic. Reference frameworks like LOHAS provide guidance but don't prescriptively define the output.

### 4.2 Reference Framework Integration
**LOHAS Model** (for consumer values): Leaders (16%), Leaning (40%), Learners (36%), Laggards (8%)
**Generational Theory**: Silent, Boomer, Gen X, Millennial, Gen Z behavioral patterns
**Psychographic Models**: Values, Attitudes, Interests, Lifestyle (VALS)
**Life Stage Models**: Career phase, family stage, retirement planning
**Economic Models**: Income level, spending priorities, financial security

### 4.3 Dynamic Archetype Generation Process
1. **Analyze Response Patterns**: Identify clusters in survey responses
2. **Reference Framework Consultation**: Use LOHAS and other models as guidance
3. **Create Demographic-Appropriate Archetypes**: Generate 4-6 archetypes specific to the target population
4. **Validate Against Behavioral Patterns**: Ensure archetypes reflect real consumer behavior differences

### 4.4 Universal Archetype Generation Prompt
```
You are a consumer psychology expert specializing in market segmentation. Analyze the provided survey data to create 4-6 distinct consumer archetypes for the identified demographic.

REFERENCE FRAMEWORKS TO CONSIDER:
- LOHAS Model: Leaders (16%), Leaning (40%), Learners (36%), Laggards (8%) - values-based segmentation
- Generational Theory: Age-based behavioral patterns and preferences  
- Psychographic Models: Values, attitudes, interests, lifestyle factors
- Life Stage Models: Career, family, retirement phases
- Economic Models: Income, spending priorities, financial security levels

SURVEY ANALYSIS RESULTS:
Target Demographic: [DETECTED_DEMOGRAPHIC]
Key Predictive Categories: [HIGH_SCORING_CATEGORIES]
Response Patterns: [BEHAVIORAL_CLUSTERS]
Spending Correlation Data: [PREDICTIVE_INSIGHTS]

ARCHETYPE CREATION REQUIREMENTS:
1. Create 4-6 archetypes that are:
   - Distinct and non-overlapping
   - Representative of different behavioral patterns
   - Predictive of consumer decision-making
   - Contextually appropriate for this demographic

2. For each archetype, define:
   - NAME: Memorable, demographic-appropriate name
   - SIZE: Estimated percentage of population  
   - CORE CHARACTERISTICS: Primary traits and behaviors
   - DECISION DRIVERS: What motivates their choices
   - SPENDING PATTERNS: How they approach purchases
   - COMMUNICATION PREFERENCES: How to reach them effectively
   - PAIN POINTS: Key challenges and concerns
   - MOTIVATORS: What drives positive responses
   - REFERENCE FRAMEWORK ALIGNMENT: How they relate to LOHAS/generational/other models

3. Base archetypes on:
   - Highest-scoring predictive questions
   - Clear behavioral pattern differences  
   - Spending propensity variations
   - Values vs practical constraint trade-offs

Create archetypes that marketing teams can immediately use for targeted campaigns while being authentic to this demographic's real characteristics and needs.

Respond in JSON format with comprehensive archetype profiles.
```

## 5. Response Scoring & Classification System

### 5.1 Scoring Methodology
1. **Question weighting**: Higher weights for predictive questions
2. **Response normalization**: Scale all responses to 0-1 range
3. **Archetype matching**: Calculate similarity scores for each archetype
4. **Confidence scoring**: Measure certainty of archetype assignment

### 5.2 Scoring Algorithm
```javascript
function calculateArchetypeScore(response, archetype) {
    let totalScore = 0;
    let weightSum = 0;
    
    for (let question of archetype.keyQuestions) {
        const responseValue = response[question.id];
        const weight = question.predictivePower;
        const similarity = calculateSimilarity(responseValue, archetype.expectedResponse[question.id]);
        
        totalScore += similarity * weight;
        weightSum += weight;
    }
    
    return totalScore / weightSum;
}
```

### 5.3 Classification Process
1. **Score calculation**: Calculate archetype scores for each response
2. **Assignment**: Assign to highest-scoring archetype (minimum threshold 0.6)
3. **Confidence measurement**: Calculate confidence based on score distribution
4. **Validation**: Flag uncertain classifications for review

## 6. Universal Digital Twin Persona Engine (Claude Opus 4.1 Only)

### 6.1 Integration with Existing System
- **Reuse infrastructure**: Leverage existing `src/claude/integrated_persona_engine_v2.js`
- **Model specification**: Use only Claude Opus 4.1 (claude-opus-4-1-20250805)
- **No semantic engine**: Disable semantic response generation entirely
- **Dynamic adaptation**: Configure persona prompts based on detected demographic

### 6.2 Universal Persona Prompt Template
```
You are a marketing response generator embodying the [ARCHETYPE_NAME] archetype from the [TARGET_DEMOGRAPHIC] population. 

DEMOGRAPHIC CONTEXT:
Target Population: [TARGET_DEMOGRAPHIC] (e.g., mothers, retirees, professionals)
Survey Context: [SURVEY_CONTEXT]
Reference Frameworks: [REFERENCE_FRAMEWORKS_USED]

ARCHETYPE PROFILE:
- Core Characteristics: [CHARACTERISTICS_LIST]
- Decision Drivers: [DECISION_DRIVERS]
- Spending Patterns: [SPENDING_BEHAVIOR]
- Pain Points: [PAIN_POINTS]
- Motivators: [PLEASURE_MOTIVATORS]
- Communication Preferences: [COMM_STYLE]

RESPONSE GUIDELINES:
- Speak as someone in this archetype from this demographic would speak
- Reference demographic-specific concerns and priorities
- Use tone and language appropriate for this population
- Include specific reasoning that resonates with this archetype
- Address relevant pain points and motivators naturally
- Avoid generic marketing speak
- Reflect authentic characteristics of this demographic

MARKETING CONTENT TO RESPOND TO:
[MARKETING_CONTENT]

Generate a response that this archetype would find compelling and authentic within their demographic context.
Length: 50-100 words
Tone: [ARCHETYPE_TONE]
Focus: Address both rational and emotional motivators relevant to [TARGET_DEMOGRAPHIC]
```

### 6.3 Response Generation Parameters
- **Temperature**: Randomized 0.8-1.5 (no prefill randomization)
- **Max tokens**: 1000 (optimized to avoid timeouts)
- **Model**: claude-opus-4-1-20250805 exclusively
- **Retry logic**: 3 attempts with exponential backoff
- **Rate limiting**: 2s between requests, 3s between segments

## 7. Universal Survey UI Interface

### 7.1 UI Specifications  
Based on existing `public/dual-engine-app.html` but modified for universal survey support:
- **Single column layout**: Only Claude responses (no semantic engine)
- **Dynamic archetype filtering**: Dropdown populated with detected demographic archetypes
- **Survey selection**: Choose which survey dataset to work with
- **Response count**: 10 responses per archetype as default
- **Temperature display**: Show randomized temperature for each response
- **Demographic context**: Display current survey population and context

### 7.2 Interface Components
1. **Survey Selection Section**:
   - Dropdown to select active survey dataset
   - Display target demographic and survey description
   - Summary of available archetypes

2. **Content Input Section**:
   - Text area for marketing content
   - Image/PDF upload with Claude Opus analysis
   - Thumbnail preview with editable extracted content

3. **Archetype Selection**:
   - Multi-select dropdown for current survey's archetypes
   - "All Archetypes" option for comprehensive analysis
   - Archetype descriptions on hover with demographic context
   - Population percentage display for each archetype

4. **Response Display**:
   - Single column showing Claude responses only
   - Archetype labels with demographic context
   - Temperature and timing information
   - Purchase intent and sentiment scores
   - Reference framework indicators (LOHAS, generational, etc.)

5. **Settings Panel**:
   - Response count selector (1-10)
   - Temperature range (0.8-1.5, no prefill)
   - Export options for responses
   - Survey dataset management tools

### 7.3 Universal API Integration
- **Endpoint**: `/api/universal-digital-twin-response`
- **Request format**:
```json
{
  "datasetId": 123,
  "content": "marketing text or base64 image",
  "contentType": "text|image",
  "archetypeIds": [1, 3, 5],
  "responseCount": 10,
  "temperatureRange": [0.8, 1.5]
}
```

### 7.4 Dataset Management API
- **Endpoint**: `/api/survey-datasets`
- **Functions**: List datasets, get archetype info, dataset statistics

## 8. Implementation Phases

### Phase 1: Data Foundation (Week 1)
- [ ] Excel data ingestion and processing
- [ ] Database schema creation and setup
- [ ] Question concatenation and cleaning
- [ ] Basic data validation and quality checks

### Phase 2: Question Categorization (Week 2)
- [ ] Claude Opus categorization prompt development
- [ ] Batch processing system for questions
- [ ] Quality control and validation workflows
- [ ] Database storage of categorized questions

### Phase 3: Archetype Development (Week 3)
- [ ] Archetype creation methodology implementation
- [ ] Response analysis and clustering
- [ ] Persona profile generation
- [ ] Archetype validation and refinement

### Phase 4: Scoring System (Week 4)
- [ ] Response scoring algorithm development
- [ ] Classification system implementation
- [ ] Confidence measurement integration
- [ ] Performance testing and optimization

### Phase 5: Digital Twin Engine (Week 5)
- [ ] Claude Opus persona engine adaptation
- [ ] Mother-specific prompt development
- [ ] Response generation testing
- [ ] Integration with existing infrastructure

### Phase 6: UI Development (Week 6)
- [ ] Single-column interface creation
- [ ] Archetype selection implementation
- [ ] Response display optimization
- [ ] API endpoint development

### Phase 7: Testing & Deployment (Week 7)
- [ ] End-to-end system testing
- [ ] Performance optimization
- [ ] Documentation completion
- [ ] Production deployment

## 9. Technical Considerations

### 9.1 Performance Optimization
- **Batch processing**: Handle large survey datasets efficiently
- **Caching**: Cache archetype profiles and common responses
- **Rate limiting**: Respect Claude API limits with proper spacing
- **Error handling**: Comprehensive error recovery and logging

### 9.2 Data Quality Assurance
- **Validation rules**: Ensure data integrity at each processing step
- **Quality metrics**: Track categorization accuracy and confidence
- **Manual review**: Flag uncertain classifications for human verification
- **Continuous improvement**: Update models based on feedback

### 9.3 Security & Privacy
- **Data encryption**: Encrypt survey responses in database
- **Access control**: Implement proper authentication and authorization
- **Audit logging**: Track all data access and modifications
- **GDPR compliance**: Ensure data handling meets privacy requirements

### 9.4 Scalability Planning
- **Modular architecture**: Design for easy component replacement
- **API versioning**: Plan for future enhancements and changes
- **Database optimization**: Index critical query paths
- **Load balancing**: Prepare for increased usage and traffic

## 10. Success Metrics

### 10.1 Technical Metrics
- **Processing speed**: <2 minutes for full survey categorization
- **Classification accuracy**: >85% confidence on archetype assignments
- **Response quality**: >90% relevant responses based on user feedback
- **System uptime**: 99.5% availability target

### 10.2 Business Metrics
- **Archetype distinctiveness**: Clear differentiation in response patterns
- **Marketing effectiveness**: Improved campaign performance metrics
- **User engagement**: Higher interaction rates with generated content
- **Cost efficiency**: Reduced manual analysis time by >70%

## 11. Risk Mitigation

### 11.1 Technical Risks
- **API rate limits**: Implement robust retry and queuing mechanisms
- **Data quality issues**: Multiple validation layers and manual review processes
- **Model accuracy**: Continuous monitoring and improvement cycles
- **System integration**: Comprehensive testing of all component interactions

### 11.2 Business Risks
- **Archetype validity**: Validate against real customer data and feedback
- **Regulatory compliance**: Regular audits of data handling practices
- **Competitive advantage**: Continuous innovation and feature development
- **User adoption**: User-friendly interfaces and comprehensive training

## Conclusion

This comprehensive plan outlines a sophisticated pipeline for transforming mother survey data into actionable digital twin personas using Claude Opus 4.1. The system will provide marketers with nuanced, archetype-specific responses that reflect genuine mother consumer behavior patterns.

The phased approach ensures systematic development with proper testing and validation at each stage. The focus on Claude Opus 4.1 exclusively, combined with the mother-specific archetype framework, will create a powerful tool for targeted marketing campaign development.

Key success factors include maintaining data quality throughout the pipeline, ensuring archetype accuracy through rigorous validation, and creating an intuitive user interface that enables marketing teams to leverage these insights effectively.

## Appendices

### Appendix A: Question Categorization Prompt

```
You are an expert consumer behavior analyst. Analyze the provided survey data to understand the target demographic and survey context, then create appropriate question categories and classify each question.

SURVEY CONTEXT ANALYSIS:
1. First, identify the target demographic from the survey questions and content
2. Determine 4-6 meaningful categories that would be most relevant for this demographic's consumer behavior
3. Consider proven frameworks (LOHAS, generational theory, psychographics) as reference points
4. Focus on categories that would be predictive of purchasing behavior and decision-making

TARGET DEMOGRAPHIC: [AUTO-DETECTED OR PROVIDED]
SURVEY CONTEXT: [SURVEY DESCRIPTION/SAMPLE QUESTIONS]

TASK: Create categories and classify each question

Step 1 - Category Creation:
Create 4-6 categories that are:
- Relevant to this demographic's decision-making
- Predictive of consumer behavior  
- Distinct and non-overlapping
- Based on psychological/behavioral drivers

Step 2 - Question Classification:
For each survey question, provide:
- Category (from your created categories)
- Confidence score (0-1)
- Reasoning (2-3 sentences explaining the classification)
- Predictive power estimate (0-1) for consumer behavior correlation
- Behavioral insight (what this question reveals about the respondent)

Questions to analyze:
[CONCATENATED_QUESTIONS_LIST]

Respond in JSON format:
{
  "demographic_analysis": {
    "target_demographic": "identified demographic",
    "survey_context": "survey purpose and scope",
    "reference_frameworks": ["LOHAS", "generational", "etc."]
  },
  "categories": [
    {
      "name": "category name",
      "description": "what this category measures",
      "behavioral_significance": "why this matters for consumer behavior"
    }
  ],
  "categorizations": [
    {
      "question": "question text",
      "category": "assigned category",
      "confidence": 0.95,
      "reasoning": "explanation",
      "predictive_power": 0.80,
      "behavioral_insight": "what this reveals about respondent"
    }
  ]
}
```

### Appendix B: Archetype Creation Prompt

```
You are a consumer psychology expert specializing in market segmentation. Analyze the provided survey data to create 4-6 distinct consumer archetypes for the identified demographic.

REFERENCE FRAMEWORKS TO CONSIDER:
- LOHAS Model: Leaders (16%), Leaning (40%), Learners (36%), Laggards (8%) - values-based segmentation
- Generational Theory: Age-based behavioral patterns and preferences  
- Psychographic Models: Values, attitudes, interests, lifestyle factors
- Life Stage Models: Career, family, retirement phases
- Economic Models: Income, spending priorities, financial security levels

SURVEY ANALYSIS RESULTS:
Target Demographic: [DETECTED_DEMOGRAPHIC]
Key Predictive Categories: [HIGH_SCORING_CATEGORIES]
Response Patterns: [BEHAVIORAL_CLUSTERS]
Spending Correlation Data: [PREDICTIVE_INSIGHTS]

ARCHETYPE CREATION REQUIREMENTS:
1. Create 4-6 archetypes that are:
   - Distinct and non-overlapping
   - Representative of different behavioral patterns
   - Predictive of consumer decision-making
   - Contextually appropriate for this demographic

2. For each archetype, define:
   - NAME: Memorable, demographic-appropriate name
   - SIZE: Estimated percentage of population  
   - CORE CHARACTERISTICS: Primary traits and behaviors
   - DECISION DRIVERS: What motivates their choices
   - SPENDING PATTERNS: How they approach purchases
   - COMMUNICATION PREFERENCES: How to reach them effectively
   - PAIN POINTS: Key challenges and concerns
   - MOTIVATORS: What drives positive responses
   - REFERENCE FRAMEWORK ALIGNMENT: How they relate to LOHAS/generational/other models

3. Base archetypes on:
   - Highest-scoring predictive questions
   - Clear behavioral pattern differences  
   - Spending propensity variations
   - Values vs practical constraint trade-offs

Create archetypes that marketing teams can immediately use for targeted campaigns while being authentic to this demographic's real characteristics and needs.

Respond in JSON format:
{
  "demographic_context": {
    "target_demographic": "detected demographic",
    "survey_scope": "survey context and purpose",
    "reference_frameworks_used": ["LOHAS", "generational", "etc."],
    "key_predictive_categories": ["category1", "category2", "etc."]
  },
  "archetypes": [
    {
      "name": "Archetype Name",
      "size_percentage": 25,
      "core_characteristics": [
        "Primary trait 1",
        "Primary trait 2",
        "Primary trait 3"
      ],
      "decision_drivers": [
        "Key motivator 1",
        "Key motivator 2",
        "Key motivator 3"
      ],
      "spending_patterns": {
        "approach": "How they approach purchases",
        "priorities": ["Priority 1", "Priority 2"],
        "budget_consciousness": "High/Medium/Low",
        "research_behavior": "Extensive/Moderate/Minimal"
      },
      "communication_preferences": {
        "tone": "Preferred communication tone",
        "channels": ["Channel 1", "Channel 2"],
        "messaging_focus": "What resonates most"
      },
      "pain_points": [
        "Challenge 1",
        "Challenge 2",
        "Challenge 3"
      ],
      "motivators": [
        "Positive driver 1",
        "Positive driver 2",
        "Positive driver 3"
      ],
      "reference_framework_alignment": {
        "lohas_segment": "Leaders/Leaning/Learners/Laggards",
        "generational_traits": "Relevant generational characteristics",
        "psychographic_profile": "VALS or similar classification"
      },
      "predictive_question_responses": {
        "question_id_1": "expected_response_pattern",
        "question_id_2": "expected_response_pattern"
      }
    }
  ],
  "validation_metrics": {
    "distinctiveness_score": 0.85,
    "behavioral_coverage": 0.92,
    "predictive_validity": 0.78
  }
}
```

### Appendix C: Response Scoring Algorithm Prompt

```
You are a data scientist specializing in consumer behavior analysis. Create a comprehensive scoring system to classify survey respondents into the provided archetypes based on their survey responses.

ARCHETYPE PROFILES:
[ARCHETYPE_DATA_FROM_PREVIOUS_STEP]

SURVEY QUESTIONS WITH CATEGORIZATION:
[CATEGORIZED_QUESTIONS_WITH_PREDICTIVE_POWER_SCORES]

SCORING SYSTEM REQUIREMENTS:
1. Create a weighted scoring algorithm that:
   - Uses predictive power scores as question weights
   - Normalizes all response values to 0-1 scale
   - Calculates similarity between respondent answers and archetype expected responses
   - Generates confidence scores for archetype assignments

2. For each respondent, calculate:
   - Archetype similarity scores (0-1) for each archetype
   - Primary archetype assignment (highest score above 0.6 threshold)
   - Confidence level (0-1) based on score distribution
   - Secondary archetype (if primary confidence < 0.8)

3. Similarity calculation methods:
   - Likert scales: Absolute difference normalized
   - Multiple choice: Exact match (1.0) or no match (0.0)
   - Numerical values: Normalized distance calculation
   - Text responses: Semantic similarity or keyword matching

4. Quality control measures:
   - Flag low-confidence assignments (confidence < 0.6)
   - Identify respondents with unclear archetype fit
   - Calculate archetype population distributions
   - Validate against expected archetype percentages

IMPLEMENTATION SPECIFICATIONS:
Provide the complete scoring algorithm in pseudocode format, including:
- Data preprocessing steps
- Normalization functions
- Similarity calculation methods
- Weighted scoring formulas
- Confidence measurement calculations
- Quality control validations

Expected output format:
{
  "scoring_methodology": {
    "weighting_approach": "description of how predictive power is used",
    "normalization_method": "how responses are scaled to 0-1",
    "similarity_functions": {
      "likert_scales": "calculation method",
      "multiple_choice": "matching approach",
      "numerical_values": "distance calculation",
      "text_responses": "semantic analysis method"
    }
  },
  "algorithm_pseudocode": [
    "Step 1: Data preprocessing and validation",
    "Step 2: Response normalization",
    "Step 3: Similarity score calculation",
    "Step 4: Weighted archetype scoring",
    "Step 5: Confidence measurement",
    "Step 6: Assignment and validation"
  ],
  "quality_control": {
    "confidence_thresholds": {
      "high_confidence": 0.8,
      "medium_confidence": 0.6,
      "low_confidence": "< 0.6 - flag for review"
    },
    "validation_checks": [
      "Population distribution alignment",
      "Score distribution analysis",
      "Outlier detection and handling"
    ]
  },
  "implementation_code": {
    "main_scoring_function": "complete function implementation",
    "helper_functions": ["normalization", "similarity", "confidence"],
    "data_structures": "required input/output formats"
  }
}
```

### Appendix D: Digital Twin Response Generation Prompt

```
You are a marketing response generator embodying the [ARCHETYPE_NAME] archetype from the [TARGET_DEMOGRAPHIC] population. 

DEMOGRAPHIC CONTEXT:
Target Population: [TARGET_DEMOGRAPHIC] (e.g., mothers, retirees, professionals)
Survey Context: [SURVEY_CONTEXT]
Reference Frameworks: [REFERENCE_FRAMEWORKS_USED]

ARCHETYPE PROFILE:
- Core Characteristics: [CHARACTERISTICS_LIST]
- Decision Drivers: [DECISION_DRIVERS]
- Spending Patterns: [SPENDING_BEHAVIOR]
- Pain Points: [PAIN_POINTS]
- Motivators: [PLEASURE_MOTIVATORS]
- Communication Preferences: [COMM_STYLE]

RESPONSE GUIDELINES:
- Speak as someone in this archetype from this demographic would speak
- Reference demographic-specific concerns and priorities
- Use tone and language appropriate for this population
- Include specific reasoning that resonates with this archetype
- Address relevant pain points and motivators naturally
- Avoid generic marketing speak
- Reflect authentic characteristics of this demographic

MARKETING CONTENT TO RESPOND TO:
[MARKETING_CONTENT]

Generate a response that this archetype would find compelling and authentic within their demographic context.
Length: 50-100 words
Tone: [ARCHETYPE_TONE]
Focus: Address both rational and emotional motivators relevant to [TARGET_DEMOGRAPHIC]
```