# LOHAS Consumer Segmentation Methodology Guide

## Overview
This guide explains how to classify surf clothing consumers into LOHAS (Lifestyles of Health and Sustainability) segments based on their survey responses. Since the raw data doesn't contain pre-labeled segments, we use a reverse-engineering approach based on response patterns.

## The Four LOHAS Segments

### 1. **Leaders (Estimated: 15-20%)**
- **Profile**: Highly committed to sustainability, early adopters of eco-friendly products
- **Characteristics**: 
  - Willing to pay premium for sustainable products
  - Actively seek organic, fair trade, and recycled materials
  - Strong future orientation for sustainability
  - Low price sensitivity when sustainability is involved

### 2. **Leaning (Estimated: 25-30%)**
- **Profile**: Interested in sustainability but balance it with practical considerations
- **Characteristics**:
  - Prefer sustainable options when available
  - Moderate price sensitivity
  - Consider sustainability important for future
  - Balance quality, price, and sustainability

### 3. **Learners (Estimated: 35-40%)**
- **Profile**: Open to sustainability but need education and convincing
- **Characteristics**:
  - Neutral on most sustainability aspects
  - Price and quality are primary drivers
  - Some interest in learning about sustainability
  - May purchase sustainable if price is comparable

### 4. **Laggards (Estimated: 15-25%)**
- **Profile**: Not interested in sustainability, focused on price and convenience
- **Characteristics**:
  - High price sensitivity
  - Sustainability not a purchase factor
  - Skeptical about sustainable claims
  - Traditional purchase decision factors only

## Key Classification Questions

Based on the analysis, these are the most important questions for segment classification, ranked by discrimination power:

### Tier 1: Primary Discriminators (Highest Importance)

1. **Organic Materials Importance**
   - Question: "When considering which surf clothing product to buy, how important are the following aspects - includes Organic materials?"
   - Scale: 1 (Not at all important) to 5 (Very important)
   - Classification Logic:
     - Leaders: Score 4-5
     - Leaning: Score 3-4
     - Learners: Score 2-3
     - Laggards: Score 1-2

2. **Fair Trade Materials Importance**
   - Question: "When considering which surf clothing product to buy, how important are the following aspects - includes Fairtrade materials?"
   - Scale: 1 (Not at all important) to 5 (Very important)
   - Classification Logic:
     - Leaders: Score 4-5
     - Leaning: Score 3-4
     - Learners: Score 2-3
     - Laggards: Score 1-2

3. **Recycled Materials Importance**
   - Question: "When considering which surf clothing product to buy, how important are the following aspects - includes Recycled materials?"
   - Scale: 1 (Not at all important) to 5 (Very important)
   - Classification Logic:
     - Leaders: Score 4-5
     - Leaning: Score 3-4
     - Learners: Score 2-3
     - Laggards: Score 1-2

### Tier 2: Secondary Discriminators (High Importance)

4. **Sustainability Purchase Behavior**
   - Question: "Have you ever chosen a surf clothing product specifically because of its sustainability attributes?"
   - Response: Yes/No
   - Classification Logic:
     - Leaders: Yes (strongly influences classification)
     - Leaning: May be Yes or No
     - Learners: Usually No
     - Laggards: Always No

5. **Future Sustainability Outlook**
   - Question: "Five years from now, how important do you think sustainability aspects will be in your decision making?"
   - Scale: 1 (Not at all important) to 5 (Very important)
   - Classification Logic:
     - Leaders: Score 4-5 (high future orientation)
     - Leaning: Score 3-4
     - Learners: Score 2-3
     - Laggards: Score 1-2

### Tier 3: Supporting Discriminators (Moderate Importance)

6. **Price vs. Quality Balance**
   - Questions: Price/Value importance vs. Quality/Durability importance
   - Classification Logic:
     - Leaders: Quality > Price
     - Leaning: Quality = Price
     - Learners: Price slightly > Quality
     - Laggards: Price >> Quality

7. **Brand Sustainability Perception**
   - Question: "I think that the brands in the surf industry currently have a strong focus on being sustainable"
   - Scale: Strongly Disagree to Strongly Agree
   - Classification Logic:
     - Leaders: Often critical (want more sustainability)
     - Leaning: Moderately agree
     - Learners: Neutral
     - Laggards: Disagree or don't care

## Classification Algorithm

### Step 1: Calculate Core Scores
For each respondent, calculate three core scores:

1. **Sustainability Score (S)**
   - Average of responses to organic, fair trade, and recycled importance questions
   - Range: 1-5

2. **Price Sensitivity Score (P)**
   - Response to price/value importance question
   - Range: 1-5 (inverted for classification)

3. **Future Orientation Score (F)**
   - Response to 5-year sustainability outlook question
   - Range: 1-5

### Step 2: Apply Classification Rules

```
IF S >= 4.0 AND P <= 3.0 AND F >= 4.0 THEN
    Segment = LEADER
ELSE IF S >= 3.0 AND S < 4.0 AND F >= 3.0 THEN
    Segment = LEANING
ELSE IF S < 2.5 AND P >= 4.0 THEN
    Segment = LAGGARD
ELSE
    Segment = LEARNER
```

### Step 3: Validation Checks
- If respondent answered "Yes" to sustainability purchase and S < 3.0, review classification
- If Quality score > 4.5 and S > 3.5, consider upgrading to higher segment
- If all sustainability questions scored 1-2, classify as Laggard regardless of other scores

## Expected Distribution

Based on typical LOHAS market research:
- **Leaders**: 15-20% of respondents
- **Leaning**: 25-30% of respondents
- **Learners**: 35-40% of respondents
- **Laggards**: 15-25% of respondents

Note: The surf clothing market may skew slightly more toward sustainability-conscious segments due to the outdoor/ocean lifestyle connection.

## Implementation Notes

1. **Missing Data**: If key questions are unanswered, use available responses and adjust thresholds proportionally

2. **Response Normalization**: Convert all text responses to numeric scale:
   - "Very Important" / "Strongly Agree" = 5
   - "Important" / "Agree" = 4
   - "Neutral" / "Neither" = 3
   - "Not Important" / "Disagree" = 2
   - "Not at all Important" / "Strongly Disagree" = 1

3. **Quality Assurance**: Randomly sample 10% of classifications for manual review to ensure accuracy

## Using Classifications for Digital Twins

Once respondents are classified into segments, use the aggregate characteristics of each segment to create digital twin personas:

- **Leaders**: Create sustainability-focused personas with strong environmental values
- **Leaning**: Create balanced personas who consider multiple factors
- **Learners**: Create price-conscious personas open to education
- **Laggards**: Create traditional consumer personas focused on basics

Each digital twin should reflect the language patterns, decision factors, and value systems observed in their segment's actual survey responses.