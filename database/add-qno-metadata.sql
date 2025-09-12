-- Add qNo metadata support to survey columns
-- This enables question cross-referencing like Q432 referring to Q31

-- Add qNo and cross-reference fields to survey_columns table
ALTER TABLE survey_columns 
ADD COLUMN IF NOT EXISTS q_no VARCHAR(20), -- 'preData', 'Q1', 'Q2', etc.
ADD COLUMN IF NOT EXISTS is_predata BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS question_sequence INTEGER, -- 1, 2, 3... (null for preData)
ADD COLUMN IF NOT EXISTS cross_references JSONB, -- Array of referenced qNo values
ADD COLUMN IF NOT EXISTS can_be_referenced_by JSONB, -- Array of qNo values that reference this
ADD COLUMN IF NOT EXISTS question_text TEXT, -- Full question text for cross-reference analysis
ADD COLUMN IF NOT EXISTS column_metadata JSONB DEFAULT '{}'; -- Additional metadata

-- Create index for efficient qNo lookups
CREATE INDEX IF NOT EXISTS idx_survey_columns_q_no ON survey_columns(survey_id, q_no);
CREATE INDEX IF NOT EXISTS idx_survey_columns_question_sequence ON survey_columns(survey_id, question_sequence);
CREATE INDEX IF NOT EXISTS idx_survey_columns_predata ON survey_columns(survey_id, is_predata);

-- Create cross-reference tracking table
CREATE TABLE IF NOT EXISTS question_cross_references (
    id SERIAL PRIMARY KEY,
    survey_id INTEGER NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    source_q_no VARCHAR(20) NOT NULL, -- The question that references another
    target_q_no VARCHAR(20) NOT NULL, -- The question being referenced
    reference_type VARCHAR(50) DEFAULT 'direct', -- 'direct', 'conditional', 'skip_logic', etc.
    reference_context TEXT, -- Context where the reference occurs
    confidence_score REAL DEFAULT 1.0, -- How confident we are about this reference
    detected_by VARCHAR(50) DEFAULT 'manual', -- 'manual', 'llm_analysis', 'pattern_matching'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(survey_id, source_q_no, target_q_no)
);

-- Create index for cross-reference queries
CREATE INDEX IF NOT EXISTS idx_question_cross_references_source ON question_cross_references(survey_id, source_q_no);
CREATE INDEX IF NOT EXISTS idx_question_cross_references_target ON question_cross_references(survey_id, target_q_no);

-- Create view for easy cross-reference analysis
CREATE OR REPLACE VIEW question_reference_analysis AS
SELECT 
    s.name as survey_name,
    sc1.q_no as source_question,
    sc1.column_name as source_column,
    sc1.question_text as source_text,
    qcr.target_q_no as target_question,
    sc2.column_name as target_column, 
    sc2.question_text as target_text,
    qcr.reference_type,
    qcr.reference_context,
    qcr.confidence_score,
    qcr.detected_by
FROM question_cross_references qcr
JOIN surveys s ON qcr.survey_id = s.id
JOIN survey_columns sc1 ON s.id = sc1.survey_id AND sc1.q_no = qcr.source_q_no
LEFT JOIN survey_columns sc2 ON s.id = sc2.survey_id AND sc2.q_no = qcr.target_q_no
ORDER BY s.name, sc1.question_sequence, sc2.question_sequence;

-- Update existing survey_columns with qNo mapping
-- This is a sample update - real implementation would use the ColumnQuestionMapper class

-- Example update for existing data:
/*
UPDATE survey_columns 
SET 
    q_no = CASE 
        WHEN column_name ILIKE '%ip%' OR column_name ILIKE '%address%' OR 
             column_name ILIKE '%user_agent%' OR column_name ILIKE '%respondent_id%' OR
             column_name ILIKE '%timestamp%' OR column_name ILIKE '%date%' OR
             column_name ILIKE '%time%' OR column_name ILIKE '%status%' THEN 'preData'
        ELSE 'Q' || ROW_NUMBER() OVER (
            PARTITION BY survey_id 
            ORDER BY id
        )::text
    END,
    is_predata = CASE 
        WHEN column_name ILIKE '%ip%' OR column_name ILIKE '%address%' OR 
             column_name ILIKE '%user_agent%' OR column_name ILIKE '%respondent_id%' OR
             column_name ILIKE '%timestamp%' OR column_name ILIKE '%date%' OR
             column_name ILIKE '%time%' OR column_name ILIKE '%status%' THEN TRUE
        ELSE FALSE
    END,
    question_sequence = CASE 
        WHEN column_name ILIKE '%ip%' OR column_name ILIKE '%address%' OR 
             column_name ILIKE '%user_agent%' OR column_name ILIKE '%respondent_id%' OR
             column_name ILIKE '%timestamp%' OR column_name ILIKE '%date%' OR
             column_name ILIKE '%time%' OR column_name ILIKE '%status%' THEN NULL
        ELSE ROW_NUMBER() OVER (
            PARTITION BY survey_id 
            ORDER BY id
        )
    END
WHERE q_no IS NULL;
*/

-- Create function to automatically detect cross-references
CREATE OR REPLACE FUNCTION detect_question_cross_references(survey_id_param INTEGER)
RETURNS TABLE (
    source_q_no VARCHAR(20),
    target_q_no VARCHAR(20),
    reference_context TEXT,
    confidence_score REAL
) AS $$
BEGIN
    RETURN QUERY
    WITH question_text_analysis AS (
        SELECT 
            sc1.q_no as source_q,
            sc1.question_text,
            sc2.q_no as potential_target_q
        FROM survey_columns sc1
        CROSS JOIN survey_columns sc2  
        WHERE sc1.survey_id = survey_id_param 
        AND sc2.survey_id = survey_id_param
        AND sc1.q_no != sc2.q_no
        AND sc1.is_predata = FALSE
        AND sc2.is_predata = FALSE
        AND sc1.question_text IS NOT NULL
    )
    SELECT DISTINCT
        qta.source_q::VARCHAR(20),
        qta.potential_target_q::VARCHAR(20),
        ('Found in question text: ' || substring(qta.question_text, 1, 100))::TEXT,
        CASE 
            WHEN qta.question_text ~* ('\\b' || qta.potential_target_q || '\\b') THEN 0.9
            WHEN qta.question_text ~* ('question.*' || substring(qta.potential_target_q, 2) || '\\b') THEN 0.8
            WHEN qta.question_text ~* ('refer.*' || substring(qta.potential_target_q, 2) || '\\b') THEN 0.8
            ELSE 0.6
        END::REAL as confidence
    FROM question_text_analysis qta
    WHERE qta.question_text ~* ('\\b' || qta.potential_target_q || '\\b|question.*' || substring(qta.potential_target_q, 2) || '\\b|refer.*' || substring(qta.potential_target_q, 2) || '\\b');
END;
$$ LANGUAGE plpgsql;

-- Create function to get question mapping for a survey
CREATE OR REPLACE FUNCTION get_survey_question_mapping(survey_id_param INTEGER)
RETURNS TABLE (
    column_name TEXT,
    q_no VARCHAR(20),
    is_predata BOOLEAN,
    question_sequence INTEGER,
    data_type TEXT,
    is_open_ended BOOLEAN,
    cross_references JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sc.column_name::TEXT,
        sc.q_no,
        sc.is_predata,
        sc.question_sequence,
        sc.data_type::TEXT,
        sc.is_open_ended,
        sc.cross_references
    FROM survey_columns sc
    WHERE sc.survey_id = survey_id_param
    ORDER BY 
        CASE WHEN sc.is_predata THEN 0 ELSE 1 END,
        sc.question_sequence NULLS FIRST,
        sc.id;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON COLUMN survey_columns.q_no IS 'Question number: preData for metadata columns, Q1/Q2/Q3 for survey questions';
COMMENT ON COLUMN survey_columns.is_predata IS 'TRUE for metadata columns (IP, timestamps, etc), FALSE for actual survey questions';
COMMENT ON COLUMN survey_columns.question_sequence IS 'Sequential number for survey questions (1,2,3...), NULL for preData';
COMMENT ON COLUMN survey_columns.cross_references IS 'JSON array of qNo values that this question references';
COMMENT ON COLUMN survey_columns.can_be_referenced_by IS 'JSON array of qNo values that reference this question';
COMMENT ON TABLE question_cross_references IS 'Tracks cross-references between survey questions (e.g., Q432 refers to Q31)';