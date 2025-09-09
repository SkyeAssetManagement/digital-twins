/**
 * Universal Survey Digital Twins - LLM Prompt Templates
 * Now uses .md files for easy editing with parameter substitution
 * 
 * These functions load prompts from .md files and substitute parameters
 * making it easy to modify prompts without touching JavaScript code.
 */

import promptLoader from './prompt-loader.js';

// Stage 1: Statistical Data Analyst Prompt
export const STATISTICAL_ANALYST_PROMPT = (targetDemographic, surveyContext, questionsList, statisticalSummary) => {
    return promptLoader.buildPrompt('prompt_1_StatsAnalyst', {
        target_demographic: targetDemographic || 'Will be determined from question content',
        survey_context: surveyContext || 'Will be determined from question analysis', 
        questions_list: Array.isArray(questionsList) ? questionsList.map(q => 
            typeof q === 'object' ? `${q.id}: ${q.question || q.title || q.label}` : q
        ).join('\n') : String(questionsList || 'Questions will be provided'),
        statistical_summary: typeof statisticalSummary === 'object' ? 
            JSON.stringify(statisticalSummary, null, 2) : String(statisticalSummary || 'Statistical summary will be calculated')
    });
};

// Stage 2: Behavioral Statistician Prompt
export const BEHAVIORAL_STATISTICIAN_PROMPT = (demographicContext, correlationInsights, spendingPatterns, behavioralClusters, statisticalOverview) => {
    return promptLoader.buildPrompt('prompt_2_BehavioralStatistician', {
        demographic_context: typeof demographicContext === 'object' ? 
            JSON.stringify(demographicContext, null, 2) : String(demographicContext || 'Demographic context from Stage 1'),
        correlation_insights: typeof correlationInsights === 'object' ? 
            JSON.stringify(correlationInsights, null, 2) : String(correlationInsights || 'Correlation analysis from Stage 1'),
        spending_patterns: typeof spendingPatterns === 'object' ? 
            JSON.stringify(spendingPatterns, null, 2) : String(spendingPatterns || 'Spending pattern analysis from Stage 1'),
        behavioral_clusters: typeof behavioralClusters === 'object' ? 
            JSON.stringify(behavioralClusters, null, 2) : String(behavioralClusters || 'Behavioral cluster analysis from Stage 1'),
        statistical_overview: typeof statisticalOverview === 'object' ? 
            JSON.stringify(statisticalOverview, null, 2) : String(statisticalOverview || 'Statistical overview from Stage 1')
    });
};

// Stage 3: Marketing Expert Prompt  
export const MARKETING_EXPERT_PROMPT = (stage1Foundation, painPleasurePoints, behavioralInsights, evidenceMatrix, confidenceMetrics) => {
    return promptLoader.buildPrompt('prompt_3_MarketingExpert', {
        stage1_statistical_foundation: typeof stage1Foundation === 'object' ? 
            JSON.stringify(stage1Foundation, null, 2) : String(stage1Foundation || 'Statistical foundation from Stage 1'),
        pain_pleasure_points: Array.isArray(painPleasurePoints) ? 
            painPleasurePoints.map(p => `- ${p.name || p.point_id}: ${p.description}`).join('\n') : 
            String(painPleasurePoints || 'Pain/pleasure points from Stage 2'),
        behavioral_insights: typeof behavioralInsights === 'object' ? 
            JSON.stringify(behavioralInsights, null, 2) : String(behavioralInsights || 'Behavioral insights from Stage 2'),
        evidence_matrix: typeof evidenceMatrix === 'object' ? 
            JSON.stringify(evidenceMatrix, null, 2) : String(evidenceMatrix || 'Evidence matrix from Stage 2'),
        confidence_metrics: typeof confidenceMetrics === 'object' ? 
            JSON.stringify(confidenceMetrics, null, 2) : String(confidenceMetrics || 'Confidence metrics from previous stages')
    });
};

// Enhanced Digital Twin Response Prompt
export const DIGITAL_TWIN_RESPONSE_PROMPT = (archetype, marketingContent, demographicAnalysis) => {
    return promptLoader.buildPrompt('prompt_4_DigitalTwinResponse', {
        archetype_name: archetype.archetype_name || archetype.name || 'Unnamed Archetype',
        target_demographic: demographicAnalysis?.target_demographic || 'General consumer population',
        statistical_foundation: typeof archetype.statistical_foundation === 'object' ? 
            JSON.stringify(archetype.statistical_foundation, null, 2) : String(archetype.statistical_foundation || 'Statistical foundation not specified'),
        primary_pain_points: Array.isArray(archetype.pain_pleasure_profile?.primary_pain_points) ? 
            archetype.pain_pleasure_profile.primary_pain_points.map(p => `- ${p.pain_point}: ${p.manifestation}`).join('\n') : 
            'Pain points not specified',
        primary_pleasure_points: Array.isArray(archetype.pain_pleasure_profile?.primary_pleasure_points) ? 
            archetype.pain_pleasure_profile.primary_pleasure_points.map(p => `- ${p.pleasure_point}: ${p.activation_triggers}`).join('\n') : 
            'Pleasure points not specified',
        demographic_profile: archetype.marketing_persona?.demographic_profile || 'Demographic profile not specified',
        daily_life_context: archetype.marketing_persona?.daily_life_context || 'Daily life context not specified',
        purchase_decision_process: archetype.marketing_persona?.purchase_decision_process || 'Purchase decision process not specified',
        communication_style: archetype.marketing_persona?.communication_style || 'Communication style not specified',
        channel_preferences: archetype.marketing_persona?.channel_preferences || 'Channel preferences not specified',
        messaging_approach: archetype.campaign_strategy?.messaging_approach || 'Messaging approach not specified',
        creative_direction: archetype.campaign_strategy?.creative_direction || 'Creative direction not specified',
        timing_strategy: archetype.campaign_strategy?.timing_strategy || 'Timing strategy not specified',
        marketing_content: marketingContent || '[Marketing content will be provided for analysis]'
    });
};

// Scoring Algorithm Generation Prompt
export const RESPONSE_SCORING_PROMPT = (archetypes, categorizedQuestions, statisticalFoundation) => {
    return promptLoader.buildPrompt('prompt_5_ScoringAlgorithm', {
        archetype_profiles: Array.isArray(archetypes) ? 
            JSON.stringify(archetypes, null, 2) : String(archetypes || 'Archetype profiles will be provided'),
        categorized_questions: Array.isArray(categorizedQuestions) ? 
            JSON.stringify(categorizedQuestions, null, 2) : String(categorizedQuestions || 'Categorized questions will be provided'),
        statistical_foundation: typeof statisticalFoundation === 'object' ? 
            JSON.stringify(statisticalFoundation, null, 2) : String(statisticalFoundation || 'Statistical foundation from previous stages')
    });
};

// Export all prompt functions with new 3-stage structure
export const UNIVERSAL_SURVEY_PROMPTS = {
  // New 3-stage pipeline prompts
  statisticalAnalyst: STATISTICAL_ANALYST_PROMPT,
  behavioralStatistician: BEHAVIORAL_STATISTICIAN_PROMPT,
  marketingExpert: MARKETING_EXPERT_PROMPT,
  
  // Post-analysis prompts
  digitalTwinResponse: DIGITAL_TWIN_RESPONSE_PROMPT,
  responseScoring: RESPONSE_SCORING_PROMPT,
  
  // Legacy aliases (for backwards compatibility)
  questionCategorization: STATISTICAL_ANALYST_PROMPT, // Maps to Stage 1
  archetypeGeneration: MARKETING_EXPERT_PROMPT        // Maps to Stage 3
};

export default UNIVERSAL_SURVEY_PROMPTS;