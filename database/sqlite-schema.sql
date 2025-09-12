-- SQLite version of the comprehensive survey schema
-- Digital Twins Analysis Lab - SQLite Database Schema

BEGIN TRANSACTION;

-- Core survey metadata
CREATE TABLE surveys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    target_demographic TEXT,
    business_description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'processing'))
);

-- Column definitions detected by Phase 3A
CREATE TABLE survey_columns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    survey_id INTEGER NOT NULL,
    column_name TEXT NOT NULL,
    data_type TEXT NOT NULL CHECK (data_type IN ('text', 'numeric', 'categorical', 'boolean', 'date')),
    is_open_ended BOOLEAN DEFAULT FALSE,
    confidence_score REAL,
    detection_method TEXT CHECK (detection_method IN ('header_analysis', 'llm_analysis', 'manual')),
    sample_values TEXT, -- JSON array of sample values
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (survey_id) REFERENCES surveys (id),
    UNIQUE(survey_id, column_name)
);

-- Response data from survey participants
CREATE TABLE survey_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    survey_id INTEGER NOT NULL,
    respondent_id TEXT NOT NULL,
    column_id INTEGER NOT NULL,
    response_text TEXT,
    response_numeric REAL,
    response_categorical TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (survey_id) REFERENCES surveys (id),
    FOREIGN KEY (column_id) REFERENCES survey_columns (id)
);

-- Categories discovered by Phase 3C
CREATE TABLE discovered_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    survey_id INTEGER NOT NULL,
    category_name TEXT NOT NULL,
    category_type TEXT CHECK (category_type IN ('pain', 'pleasure', 'other', 'demographic')),
    description TEXT,
    confidence_score REAL,
    usage_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (survey_id) REFERENCES surveys (id),
    UNIQUE(survey_id, category_name)
);

-- Phase 3B semantic categorization results
CREATE TABLE semantic_categorizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    survey_id INTEGER NOT NULL,
    response_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    confidence_score REAL NOT NULL,
    reasoning TEXT,
    llm_model TEXT DEFAULT 'claude-opus-4-1-20250805',
    processing_cost REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (survey_id) REFERENCES surveys (id),
    FOREIGN KEY (response_id) REFERENCES survey_responses (id),
    FOREIGN KEY (category_id) REFERENCES discovered_categories (id)
);

-- ROI targets identified by Phase 3D
CREATE TABLE roi_targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    survey_id INTEGER NOT NULL,
    target_name TEXT NOT NULL,
    target_type TEXT CHECK (target_type IN ('revenue', 'retention', 'acquisition', 'satisfaction')),
    importance_score REAL NOT NULL,
    business_impact TEXT,
    recommended_actions TEXT, -- JSON array
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (survey_id) REFERENCES surveys (id)
);

-- Feature importance from Phase 3E MDA analysis
CREATE TABLE feature_importance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    survey_id INTEGER NOT NULL,
    target_id INTEGER NOT NULL,
    feature_name TEXT NOT NULL,
    importance_score REAL NOT NULL,
    ml_algorithm TEXT DEFAULT 'random_forest',
    statistical_significance REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (survey_id) REFERENCES surveys (id),
    FOREIGN KEY (target_id) REFERENCES roi_targets (id)
);

-- Analysis sessions for tracking processing workflows
CREATE TABLE analysis_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    survey_id INTEGER NOT NULL,
    session_type TEXT NOT NULL,
    phase TEXT CHECK (phase IN ('3A', '3B', '3C', '3D', '3E')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    parameters TEXT, -- JSON parameters
    results TEXT, -- JSON results
    error_message TEXT,
    processing_time_ms INTEGER,
    cost_estimate REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (survey_id) REFERENCES surveys (id)
);

-- Audit trail for all database operations
CREATE TABLE audit_trail (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    record_id INTEGER NOT NULL,
    operation TEXT CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values TEXT, -- JSON
    new_values TEXT, -- JSON
    user_context TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Pain/Pleasure categorization from Phase 3D
CREATE TABLE pain_pleasure_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    survey_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    classification TEXT CHECK (classification IN ('pain', 'pleasure', 'other')),
    intensity_score REAL, -- 0-1 scale
    frequency_score REAL, -- How often mentioned
    business_priority TEXT CHECK (business_priority IN ('high', 'medium', 'low')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (survey_id) REFERENCES surveys (id),
    FOREIGN KEY (category_id) REFERENCES discovered_categories (id)
);

-- Digital twin archetypes derived from analysis
CREATE TABLE customer_archetypes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    survey_id INTEGER NOT NULL,
    archetype_name TEXT NOT NULL,
    description TEXT,
    demographics TEXT, -- JSON
    behaviors TEXT, -- JSON  
    pain_points TEXT, -- JSON
    preferences TEXT, -- JSON
    percentage_of_population REAL,
    confidence_score REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (survey_id) REFERENCES surveys (id)
);

-- Performance optimization indexes
CREATE INDEX idx_survey_responses_survey_id ON survey_responses(survey_id);
CREATE INDEX idx_survey_responses_respondent_id ON survey_responses(respondent_id);
CREATE INDEX idx_survey_columns_survey_id ON survey_columns(survey_id);
CREATE INDEX idx_semantic_categorizations_survey_id ON semantic_categorizations(survey_id);
CREATE INDEX idx_discovered_categories_survey_id ON discovered_categories(survey_id);
CREATE INDEX idx_roi_targets_survey_id ON roi_targets(survey_id);
CREATE INDEX idx_feature_importance_survey_id ON feature_importance(survey_id);
CREATE INDEX idx_analysis_sessions_survey_id ON analysis_sessions(survey_id);

-- Performance views for common queries
CREATE VIEW survey_summary AS
SELECT 
    s.id,
    s.name,
    s.display_name,
    s.target_demographic,
    COUNT(DISTINCT sc.id) as column_count,
    COUNT(DISTINCT sr.respondent_id) as respondent_count,
    COUNT(DISTINCT dc.id) as category_count,
    COUNT(DISTINCT rt.id) as roi_target_count,
    s.created_at,
    s.status
FROM surveys s
LEFT JOIN survey_columns sc ON s.id = sc.survey_id
LEFT JOIN survey_responses sr ON s.id = sr.survey_id
LEFT JOIN discovered_categories dc ON s.id = dc.survey_id
LEFT JOIN roi_targets rt ON s.id = rt.survey_id
GROUP BY s.id;

CREATE VIEW categorization_summary AS
SELECT 
    s.name as survey_name,
    dc.category_name,
    dc.category_type,
    COUNT(sem.id) as response_count,
    AVG(sem.confidence_score) as avg_confidence,
    dc.description
FROM surveys s
JOIN discovered_categories dc ON s.id = dc.survey_id
LEFT JOIN semantic_categorizations sem ON dc.id = sem.category_id
GROUP BY s.id, dc.id;

CREATE VIEW feature_importance_summary AS
SELECT 
    s.name as survey_name,
    rt.target_name,
    rt.target_type,
    fi.feature_name,
    fi.importance_score,
    fi.statistical_significance,
    rt.business_impact
FROM surveys s
JOIN roi_targets rt ON s.id = rt.survey_id
JOIN feature_importance fi ON rt.id = fi.target_id
ORDER BY fi.importance_score DESC;

COMMIT;