# Scoring Algorithm Generation Prompt

You are a data scientist specializing in consumer behavior analysis. Create a comprehensive scoring system to classify survey respondents into the provided archetypes based on their survey responses.

## ARCHETYPE PROFILES
{{ARCHETYPE_PROFILES}}

## SURVEY QUESTIONS WITH CATEGORIZATION  
{{CATEGORIZED_QUESTIONS}}

## STATISTICAL FOUNDATION DATA
{{STATISTICAL_FOUNDATION}}

## SCORING SYSTEM REQUIREMENTS

### 1. Weighted Scoring Algorithm
Create a system that:
- **Uses predictive power scores as question weights** - questions with higher discriminatory power get higher weights
- **Normalizes all response values to 0-1 scale** - handle different question types uniformly
- **Calculates similarity between respondent answers and archetype expected responses** - measure how closely a respondent matches each archetype
- **Generates confidence scores for archetype assignments** - measure certainty of classification

### 2. Respondent Classification Output
For each respondent, calculate:
- **Archetype similarity scores** (0-1) for each archetype
- **Primary archetype assignment** (highest score above 0.6 threshold)
- **Confidence level** (0-1) based on score distribution and separation between top scores
- **Secondary archetype** (if primary confidence < 0.8, identify next best fit)

### 3. Similarity Calculation Methods
Handle different question types appropriately:
- **Likert scales** (1-5, 1-7, etc.): Absolute difference normalized by scale range
- **Multiple choice**: Exact match (1.0) or no match (0.0), with partial credit for semantically similar options
- **Numerical values**: Normalized distance calculation with outlier handling
- **Text responses**: Semantic similarity or keyword matching based on archetype characteristics

### 4. Quality Control Measures
Implement validation systems:
- **Flag low-confidence assignments** (confidence < 0.6) for manual review
- **Identify respondents with unclear archetype fit** (similar scores across multiple archetypes)
- **Calculate archetype population distributions** and compare to expected percentages
- **Validate against expected archetype percentages** from Stage 3 analysis

## IMPLEMENTATION SPECIFICATIONS

Provide the complete scoring algorithm including:

### Data Preprocessing Steps
- Response validation and cleaning procedures
- Missing data handling strategies  
- Outlier detection and treatment
- Data type standardization methods

### Normalization Functions  
- Scale conversion formulas for different question types
- Handling edge cases (all same responses, extreme outliers)
- Maintaining statistical properties during normalization

### Similarity Calculation Methods
- Mathematical formulas for each question type
- Weighting application procedures
- Aggregation methods for combining question scores

### Weighted Scoring Formulas
- How to apply discriminatory power weights
- Confidence calculation methodology
- Primary/secondary archetype assignment logic

### Quality Control Validations
- Statistical tests for distribution validation
- Confidence threshold determination
- Error handling and edge case management

## RESPONSE FORMAT

```json
{
  "scoring_methodology": {
    "weighting_approach": "description of how predictive power and discriminatory scores are used as weights",
    "normalization_method": "how responses are scaled to 0-1 for each question type",
    "similarity_functions": {
      "likert_scales": "mathematical formula for likert scale similarity",
      "multiple_choice": "exact/partial matching approach with semantic considerations",
      "numerical_values": "distance calculation with normalization method",
      "text_responses": "semantic analysis or keyword matching methodology"
    },
    "aggregation_formula": "how individual question similarities are combined into archetype scores"
  },
  "algorithm_pseudocode": [
    "Step 1: Data preprocessing and validation",
    "Step 2: Response normalization for each question type", 
    "Step 3: Individual question similarity calculation",
    "Step 4: Weighted archetype scoring using discriminatory power weights",
    "Step 5: Confidence measurement based on score distribution",
    "Step 6: Primary/secondary archetype assignment and validation"
  ],
  "implementation_details": {
    "preprocessing": {
      "missing_data_handling": "strategy for incomplete responses",
      "outlier_detection": "method for identifying and handling outliers",
      "data_validation": "quality checks before scoring"
    },
    "normalization_formulas": {
      "likert_scale": "mathematical formula",
      "numerical": "mathematical formula", 
      "categorical": "encoding approach"
    },
    "similarity_calculations": {
      "formula_likert": "specific mathematical implementation",
      "formula_numerical": "specific mathematical implementation",
      "formula_categorical": "specific matching logic"
    },
    "weighting_system": {
      "weight_calculation": "how discriminatory power translates to weights",
      "score_aggregation": "formula for combining weighted similarities",
      "confidence_calculation": "formula for measuring assignment confidence"
    }
  },
  "quality_control": {
    "confidence_thresholds": {
      "high_confidence": 0.8,
      "medium_confidence": 0.6,
      "low_confidence": "< 0.6 - flag for review"
    },
    "validation_checks": [
      "Population distribution alignment with expected percentages",
      "Score distribution analysis for statistical validity", 
      "Outlier detection and handling procedures",
      "Cross-validation against known archetype characteristics"
    ],
    "error_handling": {
      "edge_cases": "handling of problematic responses",
      "fallback_strategies": "what to do when scoring fails",
      "manual_review_triggers": "conditions that require human review"
    }
  },
  "performance_metrics": {
    "expected_accuracy": "estimated classification accuracy percentage",
    "processing_speed": "expected responses processed per second",
    "scalability": "how algorithm performs with larger datasets",
    "resource_requirements": "computational and memory requirements"
  }
}
```