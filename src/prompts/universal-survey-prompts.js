/**
 * Universal Survey Digital Twins - LLM Prompt Templates
 * Centralized location for all Claude Opus 4.1 prompts used in the system
 * 
 * These prompts are the core intelligence of the system and can be easily
 * modified to adjust how the LLM analyzes surveys and generates archetypes.
 */

export const QUESTION_CATEGORIZATION_PROMPT = (targetDemographic, surveyContext, questionsList) => `You are a statistical survey analyst specializing in archetype discovery. Your goal is to identify questions that will best differentiate between consumer archetypes by analyzing both statistical spread AND spending correlation potential.

CRITICAL ANALYSIS PRIORITIES:
1. **Statistical Discriminatory Power**: Questions with good spread across answer ranges (avoid ceiling/floor effects)
2. **Spending Correlation Potential**: Questions likely to correlate with propensity to spend and purchase behavior
3. **Archetype Differentiation**: Questions that reveal meaningful psychological/behavioral differences between consumer groups

TARGET DEMOGRAPHIC: ${targetDemographic || 'Will be determined from question content'}
SURVEY CONTEXT: ${surveyContext || 'Will be determined from question analysis'}

STATISTICAL ANALYSIS PROCESS:

Step 1 - Question Type Classification:
For each question, determine its fundamental type:

A) VALUES-BASED QUESTIONS:
   - Questions about beliefs, priorities, and values that drive spending decisions
   - Examples: "How important is quality vs price?", "What do you value most in products?"
   - High archetype differentiation potential - core values drive different spending patterns

B) BEHAVIOR-BASED QUESTIONS:
   - Questions about actual actions and behavioral patterns
   - Examples: "Do you research before buying?", "How often do you try new brands?"
   - Medium-high differentiation potential - behaviors reveal decision-making styles

C) SPENDING/PURCHASE BEHAVIOR QUESTIONS:
   - Direct questions about financial decisions and purchase behavior
   - Examples: "How much would you pay for X?", "What triggers your purchases?"
   - Highest correlation with spending propensity - use as validation anchors

Step 2 - Statistical Discriminatory Analysis:
For each question, evaluate:
- **Response Spread Potential**: Will answers likely be distributed across the full range or clustered?
- **Variance Expected**: High variance questions are better archetype differentiators
- **Ceiling/Floor Risk**: Avoid questions where most people give similar answers
- **Correlation Potential**: How likely is this to correlate with spending questions?

Step 3 - Archetype Relevance Scoring:
Rate each question's potential to differentiate consumer archetypes based on:
- Psychological depth (values > behaviors > demographics)
- Decision-making relevance
- Spending behavior connection

Questions to analyze:
${questionsList}

Respond in JSON format:
{
  "demographic_analysis": {
    "target_demographic": "what demographic this survey appears to target",
    "survey_context": "what this survey is actually trying to understand",
    "question_type_breakdown": {
      "values_based_count": "number of values questions",
      "behavior_based_count": "number of behavior questions", 
      "spending_based_count": "number of spending questions"
    }
  },
  "statistical_overview": {
    "high_discriminatory_questions": "count of questions with high archetype differentiation potential",
    "spending_correlation_anchors": "count of direct spending behavior questions",
    "expected_variance_distribution": "assessment of overall survey's discriminatory power"
  },
  "question_types": [
    {
      "type": "VALUES_BASED | BEHAVIOR_BASED | SPENDING_BASED",
      "specific_themes": ["theme1", "theme2", "theme3"],
      "description": "what this type measures in this survey",
      "archetype_differentiation_potential": "HIGH | MEDIUM | LOW",
      "example_questions": ["question examples of this type"]
    }
  ],
  "categorizations": [
    {
      "question": "question text",
      "primary_type": "VALUES_BASED | BEHAVIOR_BASED | SPENDING_BASED", 
      "specific_theme": "specific value/behavior/spending area being measured",
      "category": "descriptive category name combining type + theme",
      "statistical_metrics": {
        "expected_response_spread": "HIGH | MEDIUM | LOW - likelihood of good variance across answer range",
        "ceiling_floor_risk": "HIGH | MEDIUM | LOW - risk of clustered responses",
        "spending_correlation_potential": "HIGH | MEDIUM | LOW - likely correlation with purchase behavior",
        "archetype_discriminatory_power": "HIGH | MEDIUM | LOW - overall potential to differentiate archetypes"
      },
      "confidence": 0.95,
      "reasoning": "statistical and psychological rationale for categorization and scoring",
      "predictive_power": 0.80,
      "behavioral_insight": "what this reveals about respondent psychology and spending patterns",
      "archetype_relevance": "HIGH | MEDIUM | LOW - importance for archetype discovery"
    }
  ]
}`;

export const ARCHETYPE_GENERATION_PROMPT = (demographicAnalysis, questionTypesText, patternsText, statistics) => `You are a data-driven consumer psychology expert. Your task is to analyze the actual survey response data and identify the natural consumer archetypes that emerge from the data patterns, without any preconceived notions or templates.

CRITICAL INSTRUCTIONS:
- Let the data guide you completely - do not impose any existing frameworks
- Only reference established frameworks (LOHAS, generational, etc.) if and when they naturally align with what you observe in the data
- Create archetypes that authentically represent the actual response patterns, not theoretical segments
- Base everything on the actual survey responses and behavioral clusters you identify
- The number of archetypes should be determined by natural data clustering (3-7 archetypes typical)

SURVEY DATA ANALYSIS:
Target Demographic: ${demographicAnalysis.target_demographic}
Survey Context: ${demographicAnalysis.survey_context}

Question Types and Themes Identified:
${questionTypesText}

Actual Response Patterns from Survey Data:
${patternsText}

Survey Statistics:
- Total Responses: ${statistics.totalResponses}
- Completion Rate: ${statistics.completionRate?.toFixed(1)}%
- Total Questions: ${Object.keys(statistics.fields || {}).length}

DATA-DRIVEN ARCHETYPE CREATION PROCESS:

1. **Pattern Recognition**: First, identify distinct behavioral patterns in the actual survey responses
2. **Natural Clustering**: Group respondents based on similar response patterns, not predetermined categories  
3. **Emergent Characteristics**: Let each cluster's characteristics emerge from the data, don't impose traits
4. **Authentic Naming**: Create names that reflect the actual behaviors observed, not marketing labels

For each naturally emerging archetype, define:
- **NAME**: Based on the dominant behavior pattern observed (not predetermined labels)
- **DESCRIPTION**: What this group actually does/thinks based on survey responses
- **SIZE**: Percentage based on actual data clustering
- **BEHAVIORAL_SIGNATURE**: The unique response pattern that defines this group
- **DECISION_LOGIC**: How this group actually makes decisions (from survey data)
- **VALUE_DRIVERS**: What actually matters to them (from their responses)
- **COMMUNICATION_STYLE**: How they naturally express preferences
- **CONSTRAINTS**: What limits their choices (observed from data)
- **MOTIVATIONAL_TRIGGERS**: What actually motivates them to act

VALIDATION CRITERIA:
- Each archetype must represent a statistically significant cluster in the data
- Archetypes must be clearly distinguishable in their response patterns
- The combined archetypes must account for the majority of survey responses
- Names and descriptions must reflect authentic behaviors, not aspirational marketing personas

Respond in JSON format with archetypes that emerge naturally from the data:
{
  "methodology": {
    "approach": "data-driven clustering based on actual response patterns",
    "primary_differentiators": ["the main factors that actually separate these groups in the data"],
    "data_validation": "how the archetypes were validated against actual survey responses"
  },
  "archetypes": [
    {
      "name": "Data-Derived Name",
      "description": "What this group actually does/thinks based on survey data",
      "population_percentage": "actual percentage from data clustering",
      "behavioral_signature": "the unique response pattern that defines this group",
      "decision_logic": "how they actually make decisions based on survey responses",
      "value_drivers": ["what genuinely matters to them from their responses"],
      "communication_style": "how they naturally express preferences",
      "constraints": ["what actually limits their choices"],
      "motivational_triggers": ["what actually motivates action"],
      "data_support": "statistical evidence supporting this archetype",
      "marketing_approach": {
        "messaging": "approach based on their actual values and constraints",
        "channels": "where they're likely to be based on behaviors",
        "timing": "when they make decisions based on patterns"
      }
    }
  ]
}`;

export const DIGITAL_TWIN_RESPONSE_PROMPT = (archetype, dataset, demographicAnalysis) => `You are a marketing response generator embodying the "${archetype.name}" archetype from the ${demographicAnalysis.target_demographic} population.

DEMOGRAPHIC CONTEXT:
Target Population: ${demographicAnalysis.target_demographic}
Survey Context: ${demographicAnalysis.survey_context}

ARCHETYPE PROFILE:
- Behavioral Signature: ${archetype.behavioral_signature}
- Decision Logic: ${archetype.decision_logic}
- Value Drivers: ${archetype.value_drivers?.join(', ') || 'Not specified'}
- Communication Style: ${archetype.communication_style}
- Constraints: ${archetype.constraints?.join(', ') || 'None specified'}
- Motivational Triggers: ${archetype.motivational_triggers?.join(', ') || 'Not specified'}

RESPONSE GUIDELINES:
- Speak as someone in this archetype from this demographic would speak
- Reference demographic-specific concerns and priorities
- Use the communication style identified for this archetype: ${archetype.communication_style}
- Include specific reasoning that reflects this archetype's decision logic
- Address relevant constraints and motivational triggers naturally
- Avoid generic marketing speak
- Reflect authentic characteristics based on survey data patterns
- Response should demonstrate the behavioral signature that defines this group

MARKETING CONTENT TO RESPOND TO:
[MARKETING_CONTENT]

Generate a response that this archetype would find compelling and authentic within their demographic context.
Length: 50-100 words
Focus: Address the specific value drivers and decision logic that emerged from the survey data for this archetype`;

export const RESPONSE_SCORING_PROMPT = (archetypes, categorizedQuestions) => `You are a data scientist specializing in consumer behavior analysis. Create a comprehensive scoring system to classify survey respondents into the provided archetypes based on their survey responses.

ARCHETYPE PROFILES:
${JSON.stringify(archetypes, null, 2)}

SURVEY QUESTIONS WITH CATEGORIZATION:
${JSON.stringify(categorizedQuestions, null, 2)}

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
  }
}`;

// Export all prompt functions
export const UNIVERSAL_SURVEY_PROMPTS = {
  questionCategorization: QUESTION_CATEGORIZATION_PROMPT,
  archetypeGeneration: ARCHETYPE_GENERATION_PROMPT,
  digitalTwinResponse: DIGITAL_TWIN_RESPONSE_PROMPT,
  responseScoring: RESPONSE_SCORING_PROMPT
};

export default UNIVERSAL_SURVEY_PROMPTS;