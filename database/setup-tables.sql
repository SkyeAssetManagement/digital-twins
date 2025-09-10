-- Digital Twins Database Schema Setup
-- Creates tables for data wrangling pipeline

-- Create source_documents table
CREATE TABLE IF NOT EXISTS source_documents (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size INTEGER NOT NULL,
    file_content_base64 TEXT NOT NULL,
    target_demographic TEXT,
    description TEXT,
    processing_status VARCHAR(50) DEFAULT 'pending',
    wrangling_report JSONB,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create survey_data table
CREATE TABLE IF NOT EXISTS survey_data (
    id SERIAL PRIMARY KEY,
    source_document_id INTEGER REFERENCES source_documents(id) ON DELETE CASCADE,
    question_id VARCHAR(255) NOT NULL,
    question_text TEXT NOT NULL,
    question_category VARCHAR(100),
    question_type VARCHAR(50),
    question_order INTEGER,
    respondent_id VARCHAR(255) NOT NULL,
    response_value TEXT,
    response_normalized NUMERIC,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_source_documents_status ON source_documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_source_documents_created ON source_documents(created_at);
CREATE INDEX IF NOT EXISTS idx_survey_data_source_doc ON survey_data(source_document_id);
CREATE INDEX IF NOT EXISTS idx_survey_data_question ON survey_data(question_id);
CREATE INDEX IF NOT EXISTS idx_survey_data_respondent ON survey_data(respondent_id);

-- Create a function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at on source_documents
DROP TRIGGER IF EXISTS update_source_documents_updated_at ON source_documents;
CREATE TRIGGER update_source_documents_updated_at 
    BEFORE UPDATE ON source_documents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Display table info
SELECT 'Tables created successfully' as status;