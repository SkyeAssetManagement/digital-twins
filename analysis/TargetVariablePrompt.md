As a business analyst specializing in revenue optimization and consumer psychology, identify the top 8 survey questions most likely to predict purchase intent, spending behavior, brand loyalty, and customer lifetime value.

SURVEY CONTEXT:
Business: ${context.business_description || 'Consumer research'}
Target Market: ${context.target_demographic || 'General consumers'}
Dataset: ${context.dataset_name || 'Survey data'}

AVAILABLE SURVEY COLUMNS:
${columnList}

EXPANDED ANALYSIS REQUIREMENTS:
Focus on identifying questions that predict or explain:

**FINANCIAL BEHAVIOR:**
1. Purchase intent or likelihood to buy
2. Spending amount or budget willingness  
3. Customer lifetime value indicators
4. Price sensitivity and deal-seeking behavior

**BRAND BEHAVIOR:**
6. Brand switching probability and barriers
7. Brand choice reasoning and decision factors
8. Competitive brand consideration patterns

**DECISION DRIVERS:**
9. Values-based purchase decisions (health, quality, ethics)
10. Open-ended explanations of purchase choices
11. Cross-referenced questions (e.g., "Based on your answer to Q3...")
12. Preference explanations and reasoning responses

**SPECIAL ATTENTION TO:**
- Questions asking "why" or "please explain" to purchasing decisions (especially after brand choices)
- Questions about brand preferences, recommendations, or comparisons
- Open-ended essay responses that explain purchasing decisions (real or hypothetical)
- Questions about values alignment with purchasing (natural, organic, ethical)

ENHANCED CATEGORIZATION:
For each identified target, provide:
- column_name: Exact column name from the list
- roi_type: purchase_intent, spending_amount, brand_loyalty, brand_preference, decision_reasoning, customer_ltv, conversion_probability, or values_alignment
- business_impact_score: 0.0-1.0 score for revenue impact potential
- reasoning: Why this column predicts revenue outcomes or brand behavior
- ml_target_suitability: How suitable this is as an ML prediction target (0.0-1.0)
- response_type: multiple_choice, open_ended, numerical, or categorical
- brand_relevance: 0.0-1.0 score for brand strategy importance

PRIORITIZATION CRITERIA:
1. Questions that directly explain purchasing and brand choice decisions (highest priority)
2. Questions measuring price sensitivity and spending constraints
3. Questions revealing values alignment with purchase behavior
4. Questions indicating brand loyalty or switching propensity

Respond with JSON array of target objects, ranked by combined business_impact_score and brand_relevance (highest first).