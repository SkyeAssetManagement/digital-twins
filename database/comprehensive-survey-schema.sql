-- =====================================================
-- COMPREHENSIVE SURVEY ANALYSIS DATABASE SCHEMA
-- =====================================================
-- 
-- This schema supports:
-- - Multiple survey datasets with different structures
-- - Intelligent column detection results (Phase 3A)
-- - Semantic analysis and categorization (Phase 3B-3C) 
-- - Customer archetype storage and mapping
-- - Feature importance and ML results
-- - Complete audit trail and versioning
-- - Efficient querying across all survey data
--
-- Design Principles:
-- - Normalized structure to eliminate duplication
-- - Flexible schema for varying survey structures
-- - Performance optimized with proper indexing
-- - Audit trail for all processing steps
-- - Version control for analysis iterations
-- =====================================================

-- =====================================================
-- CORE SURVEY METADATA TABLES
-- =====================================================

-- Master table for survey datasets
CREATE TABLE surveys (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    target_demographic TEXT,
    business_description TEXT,
    original_filename VARCHAR(255),
    file_size_bytes BIGINT,
    total_columns INTEGER,
    total_responses INTEGER,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_analyzed TIMESTAMP,
    status VARCHAR(50) DEFAULT 'uploaded', -- uploaded, processing, analyzed, error
    metadata JSONB, -- Flexible storage for additional survey-specific metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Column definitions for each survey
CREATE TABLE survey_columns (
    id SERIAL PRIMARY KEY,
    survey_id INTEGER REFERENCES surveys(id) ON DELETE CASCADE,
    column_index INTEGER NOT NULL, -- Original column position
    column_name TEXT NOT NULL, -- Full original column name
    short_name VARCHAR(100), -- Abbreviated name for processing
    data_type VARCHAR(50), -- text, numeric, categorical, boolean, date
    is_open_ended BOOLEAN DEFAULT FALSE,
    is_demographic BOOLEAN DEFAULT FALSE,
    is_behavioral BOOLEAN DEFAULT FALSE,
    sample_values TEXT[], -- Array of sample values for reference
    unique_value_count INTEGER,
    null_count INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(survey_id, column_index),
    UNIQUE(survey_id, column_name)
);

-- =====================================================
-- PHASE 3A: INTELLIGENT COLUMN DETECTION RESULTS
-- =====================================================

-- Results from intelligent column detection system
CREATE TABLE column_detection_results (
    id SERIAL PRIMARY KEY,
    survey_id INTEGER REFERENCES surveys(id) ON DELETE CASCADE,
    column_id INTEGER REFERENCES survey_columns(id) ON DELETE CASCADE,
    detection_method VARCHAR(50) NOT NULL, -- header_analysis, llm_content_analysis, manual_override
    is_open_ended BOOLEAN NOT NULL,
    confidence_score DECIMAL(3,2), -- 0.00 to 1.00
    reasoning TEXT, -- Explanation of why this column was/wasn't detected
    indicator_matched VARCHAR(100), -- Which specific indicator was matched
    sample_analysis TEXT, -- LLM analysis of sample content
    processing_time_ms INTEGER,
    llm_model_used VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- SURVEY RESPONSE DATA STORAGE
-- =====================================================

-- Individual survey responses (normalized)
CREATE TABLE survey_responses (
    id SERIAL PRIMARY KEY,
    survey_id INTEGER REFERENCES surveys(id) ON DELETE CASCADE,
    respondent_id VARCHAR(100), -- Original respondent identifier
    response_index INTEGER, -- Row number in original dataset
    submission_date TIMESTAMP,
    completion_status VARCHAR(50) DEFAULT 'complete', -- complete, partial, invalid
    metadata JSONB, -- IP address, browser info, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(survey_id, respondent_id)
);

-- Actual response values (key-value pairs for flexibility)
CREATE TABLE response_values (
    id SERIAL PRIMARY KEY,
    response_id INTEGER REFERENCES survey_responses(id) ON DELETE CASCADE,
    column_id INTEGER REFERENCES survey_columns(id) ON DELETE CASCADE,
    value_text TEXT, -- Text representation of the answer
    value_numeric DECIMAL, -- Numeric value if applicable
    value_boolean BOOLEAN, -- Boolean value if applicable
    value_date DATE, -- Date value if applicable
    is_null BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(response_id, column_id)
);

-- =====================================================
-- PHASE 3B-3C: SEMANTIC ANALYSIS RESULTS
-- =====================================================

-- Semantic categories discovered through LLM analysis
CREATE TABLE semantic_categories (
    id SERIAL PRIMARY KEY,
    survey_id INTEGER REFERENCES surveys(id) ON DELETE CASCADE,
    category_name VARCHAR(100) NOT NULL,
    category_type VARCHAR(50) NOT NULL, -- pain, pleasure, demographic, behavioral, other
    description TEXT,
    business_relevance TEXT, -- How this category relates to business objectives
    discovery_method VARCHAR(50) DEFAULT 'llm_adaptive', -- llm_adaptive, manual, hybrid
    confidence_score DECIMAL(3,2),
    usage_count INTEGER DEFAULT 0, -- How many responses fall into this category
    coverage_percentage DECIMAL(5,2), -- Percentage of responses covered
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(survey_id, category_name)
);

-- Mapping individual responses to semantic categories
CREATE TABLE response_categorizations (
    id SERIAL PRIMARY KEY,
    response_id INTEGER REFERENCES survey_responses(id) ON DELETE CASCADE,
    column_id INTEGER REFERENCES survey_columns(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES semantic_categories(id) ON DELETE CASCADE,
    confidence_score DECIMAL(3,2),
    reasoning TEXT, -- LLM explanation for this categorization
    llm_model_used VARCHAR(100),
    processing_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(response_id, column_id, category_id)
);

-- =====================================================
-- CUSTOMER ARCHETYPE STORAGE
-- =====================================================

-- Customer archetype definitions
CREATE TABLE customer_archetypes (
    id SERIAL PRIMARY KEY,
    survey_id INTEGER REFERENCES surveys(id) ON DELETE CASCADE,
    archetype_name VARCHAR(100) NOT NULL,
    archetype_slug VARCHAR(100) NOT NULL, -- URL-friendly identifier
    description TEXT,
    demographics JSONB, -- Demographic characteristics
    behaviors JSONB, -- Behavioral patterns
    pain_points TEXT[], -- Array of pain points
    preferences TEXT[], -- Array of preferences
    discriminatory_questions TEXT[], -- Questions that identify this archetype
    population_percentage DECIMAL(5,2), -- What % of survey respondents fit this archetype
    confidence_score DECIMAL(3,2),
    business_value_score DECIMAL(3,2), -- How valuable is this archetype
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(survey_id, archetype_slug)
);

-- Mapping survey responses to customer archetypes
CREATE TABLE archetype_mappings (
    id SERIAL PRIMARY KEY,
    response_id INTEGER REFERENCES survey_responses(id) ON DELETE CASCADE,
    archetype_id INTEGER REFERENCES customer_archetypes(id) ON DELETE CASCADE,
    assignment_confidence DECIMAL(3,2),
    primary_archetype BOOLEAN DEFAULT FALSE, -- Is this the primary archetype for this response?
    assignment_reasoning TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- PHASE 3E: MACHINE LEARNING RESULTS
-- =====================================================

-- Feature importance analysis results
CREATE TABLE feature_importance (
    id SERIAL PRIMARY KEY,
    survey_id INTEGER REFERENCES surveys(id) ON DELETE CASCADE,
    column_id INTEGER REFERENCES survey_columns(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES semantic_categories(id), -- Which category this feature predicts
    importance_score DECIMAL(8,6), -- MDA importance score
    importance_rank INTEGER, -- Rank within this analysis
    analysis_type VARCHAR(50), -- mda_permutation, random_forest, etc.
    target_variable VARCHAR(100), -- What was being predicted
    statistical_significance DECIMAL(8,6), -- P-value or confidence interval
    business_impact_score DECIMAL(3,2), -- ROI/business relevance score
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ML model performance metrics
CREATE TABLE ml_model_results (
    id SERIAL PRIMARY KEY,
    survey_id INTEGER REFERENCES surveys(id) ON DELETE CASCADE,
    model_type VARCHAR(50) NOT NULL, -- random_forest, logistic_regression, etc.
    target_variable VARCHAR(100) NOT NULL,
    accuracy DECIMAL(5,4),
    precision_score DECIMAL(5,4),
    recall_score DECIMAL(5,4),
    f1_score DECIMAL(5,4),
    train_size INTEGER,
    test_size INTEGER,
    cross_validation_score DECIMAL(5,4),
    hyperparameters JSONB,
    feature_count INTEGER,
    training_time_seconds DECIMAL(8,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- ANALYSIS AUDIT TRAIL
-- =====================================================

-- Complete audit trail of all analysis sessions
CREATE TABLE analysis_sessions (
    id SERIAL PRIMARY KEY,
    survey_id INTEGER REFERENCES surveys(id) ON DELETE CASCADE,
    session_type VARCHAR(50) NOT NULL, -- column_detection, semantic_analysis, archetype_generation, etc.
    phase VARCHAR(10), -- 3A, 3B, 3C, etc.
    status VARCHAR(50) NOT NULL, -- running, completed, failed
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    processing_time_seconds INTEGER,
    records_processed INTEGER,
    llm_calls_made INTEGER,
    llm_tokens_used INTEGER,
    estimated_cost DECIMAL(10,4), -- Cost in USD
    error_message TEXT,
    configuration JSONB, -- Parameters and settings used
    results_summary JSONB, -- High-level results summary
    created_by VARCHAR(100) DEFAULT 'system'
);

-- =====================================================
-- PERFORMANCE OPTIMIZATION INDEXES
-- =====================================================

-- Survey-based queries
CREATE INDEX idx_surveys_status ON surveys(status);
CREATE INDEX idx_surveys_target_demographic ON surveys(target_demographic);
CREATE INDEX idx_surveys_upload_date ON surveys(upload_date);

-- Column-based queries
CREATE INDEX idx_survey_columns_survey_id ON survey_columns(survey_id);
CREATE INDEX idx_survey_columns_is_open_ended ON survey_columns(is_open_ended);
CREATE INDEX idx_survey_columns_data_type ON survey_columns(data_type);

-- Response-based queries (most frequent)
CREATE INDEX idx_survey_responses_survey_id ON survey_responses(survey_id);
CREATE INDEX idx_survey_responses_respondent_id ON survey_responses(respondent_id);
CREATE INDEX idx_response_values_response_id ON response_values(response_id);
CREATE INDEX idx_response_values_column_id ON response_values(column_id);
CREATE INDEX idx_response_values_text_gin ON response_values USING gin(to_tsvector('english', value_text));

-- Analysis result queries
CREATE INDEX idx_semantic_categories_survey_id ON semantic_categories(survey_id);
CREATE INDEX idx_semantic_categories_type ON semantic_categories(category_type);
CREATE INDEX idx_response_categorizations_response_id ON response_categorizations(response_id);
CREATE INDEX idx_response_categorizations_category_id ON response_categorizations(category_id);

-- Archetype queries
CREATE INDEX idx_customer_archetypes_survey_id ON customer_archetypes(survey_id);
CREATE INDEX idx_archetype_mappings_response_id ON archetype_mappings(response_id);
CREATE INDEX idx_archetype_mappings_archetype_id ON archetype_mappings(archetype_id);

-- Feature importance queries
CREATE INDEX idx_feature_importance_survey_id ON feature_importance(survey_id);
CREATE INDEX idx_feature_importance_importance_score ON feature_importance(importance_score DESC);
CREATE INDEX idx_feature_importance_target_variable ON feature_importance(target_variable);

-- Audit trail queries
CREATE INDEX idx_analysis_sessions_survey_id ON analysis_sessions(survey_id);
CREATE INDEX idx_analysis_sessions_session_type ON analysis_sessions(session_type);
CREATE INDEX idx_analysis_sessions_started_at ON analysis_sessions(started_at);

-- =====================================================
-- USEFUL QUERY VIEWS
-- =====================================================

-- Complete survey overview with statistics
CREATE VIEW survey_overview AS
SELECT 
    s.id,
    s.name,
    s.display_name,
    s.target_demographic,
    s.total_columns,
    s.total_responses,
    s.status,
    COUNT(DISTINCT sc.id) as columns_mapped,
    COUNT(DISTINCT sc.id) FILTER (WHERE sc.is_open_ended = true) as open_ended_columns,
    COUNT(DISTINCT sr.id) as responses_stored,
    COUNT(DISTINCT ca.id) as archetypes_generated,
    COUNT(DISTINCT scat.id) as semantic_categories,
    s.upload_date,
    s.last_analyzed
FROM surveys s
LEFT JOIN survey_columns sc ON s.id = sc.survey_id
LEFT JOIN survey_responses sr ON s.id = sr.survey_id  
LEFT JOIN customer_archetypes ca ON s.id = ca.survey_id
LEFT JOIN semantic_categories scat ON s.id = scat.survey_id
GROUP BY s.id, s.name, s.display_name, s.target_demographic, s.total_columns, 
         s.total_responses, s.status, s.upload_date, s.last_analyzed;

-- Response data with column names for easy querying
CREATE VIEW response_data_view AS
SELECT 
    sr.id as response_id,
    s.name as survey_name,
    sr.respondent_id,
    sc.column_name,
    sc.short_name,
    sc.is_open_ended,
    rv.value_text,
    rv.value_numeric,
    rv.value_boolean,
    rv.value_date
FROM survey_responses sr
JOIN surveys s ON sr.survey_id = s.id
JOIN response_values rv ON sr.id = rv.response_id
JOIN survey_columns sc ON rv.column_id = sc.id;

-- Archetype analysis summary
CREATE VIEW archetype_analysis_view AS
SELECT 
    s.name as survey_name,
    ca.archetype_name,
    ca.population_percentage,
    ca.confidence_score,
    COUNT(am.response_id) as assigned_responses,
    ca.demographics,
    ca.behaviors,
    ca.pain_points,
    ca.preferences
FROM customer_archetypes ca
JOIN surveys s ON ca.survey_id = s.id
LEFT JOIN archetype_mappings am ON ca.id = am.archetype_id AND am.primary_archetype = true
GROUP BY s.name, ca.archetype_name, ca.population_percentage, ca.confidence_score,
         ca.demographics, ca.behaviors, ca.pain_points, ca.preferences;

-- =====================================================
-- TRIGGERS FOR AUTOMATED UPDATES
-- =====================================================

-- Update survey statistics when responses are added/removed
CREATE OR REPLACE FUNCTION update_survey_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE surveys 
        SET total_responses = (
            SELECT COUNT(*) FROM survey_responses 
            WHERE survey_id = NEW.survey_id
        )
        WHERE id = NEW.survey_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE surveys 
        SET total_responses = (
            SELECT COUNT(*) FROM survey_responses 
            WHERE survey_id = OLD.survey_id
        )
        WHERE id = OLD.survey_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_survey_stats
    AFTER INSERT OR DELETE ON survey_responses
    FOR EACH ROW EXECUTE FUNCTION update_survey_stats();

-- Update category usage counts
CREATE OR REPLACE FUNCTION update_category_usage()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE semantic_categories 
        SET usage_count = (
            SELECT COUNT(*) FROM response_categorizations 
            WHERE category_id = NEW.category_id
        )
        WHERE id = NEW.category_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE semantic_categories 
        SET usage_count = (
            SELECT COUNT(*) FROM response_categorizations 
            WHERE category_id = OLD.category_id
        )
        WHERE id = OLD.category_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_category_usage
    AFTER INSERT OR DELETE ON response_categorizations
    FOR EACH ROW EXECUTE FUNCTION update_category_usage();

-- =====================================================
-- SAMPLE QUERIES FOR COMMON USE CASES
-- =====================================================

/*
-- Get all open-ended responses for a specific survey
SELECT rdv.survey_name, rdv.column_name, rdv.respondent_id, rdv.value_text
FROM response_data_view rdv
WHERE rdv.survey_name = 'Detail_Parents Survey'
AND rdv.is_open_ended = true;

-- Find top pain points across all surveys
SELECT sc.category_name, sc.description, COUNT(rc.response_id) as mention_count
FROM semantic_categories sc
JOIN response_categorizations rc ON sc.id = rc.category_id
WHERE sc.category_type = 'pain'
GROUP BY sc.category_name, sc.description
ORDER BY mention_count DESC;

-- Get archetype distribution for a survey
SELECT archetype_name, population_percentage, assigned_responses
FROM archetype_analysis_view
WHERE survey_name = 'Detail_Parents Survey'
ORDER BY population_percentage DESC;

-- Find most important features for purchase prediction
SELECT sc.column_name, fi.importance_score, fi.importance_rank, fi.statistical_significance
FROM feature_importance fi
JOIN survey_columns sc ON fi.column_id = sc.id
WHERE fi.target_variable = 'purchase_intent'
ORDER BY fi.importance_score DESC
LIMIT 10;

-- Get complete analysis history for a survey
SELECT session_type, phase, status, processing_time_seconds, 
       llm_calls_made, estimated_cost, started_at
FROM analysis_sessions
WHERE survey_id = 1
ORDER BY started_at DESC;
*/