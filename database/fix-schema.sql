-- Fix varchar length constraints for source_documents table
ALTER TABLE source_documents ALTER COLUMN file_type TYPE VARCHAR(100);
ALTER TABLE source_documents ALTER COLUMN processing_status TYPE VARCHAR(100);