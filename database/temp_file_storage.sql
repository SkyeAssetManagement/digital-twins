-- Temporary File Storage for Data Wrangling Pipeline
-- Stores uploaded files as base64 for serverless processing

CREATE TABLE IF NOT EXISTS temp_file_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(255) NOT NULL,
    original_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_data_base64 TEXT NOT NULL, -- Store file as base64
    upload_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours', -- Auto-expire after 24h
    processing_status VARCHAR(50) DEFAULT 'uploaded', -- uploaded, processing, completed, error
    metadata JSONB DEFAULT '{}', -- Store file analysis results
    created_by VARCHAR(100) DEFAULT 'anonymous'
);

-- Index for efficient cleanup and queries
CREATE INDEX IF NOT EXISTS idx_temp_files_expires ON temp_file_uploads(expires_at);
CREATE INDEX IF NOT EXISTS idx_temp_files_status ON temp_file_uploads(processing_status);
CREATE INDEX IF NOT EXISTS idx_temp_files_created ON temp_file_uploads(upload_timestamp);

-- Auto-cleanup function (optional - can be called via cron or manually)
CREATE OR REPLACE FUNCTION cleanup_expired_temp_files()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM temp_file_uploads 
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Example usage:
-- SELECT cleanup_expired_temp_files(); -- Clean up expired files