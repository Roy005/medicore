-- V10: Add text extraction columns for AI document analysis
-- Stores extracted text from uploaded documents (PDFs, images) so the AI
-- service can include document content in patient context for analysis.

ALTER TABLE documents ADD COLUMN IF NOT EXISTS extracted_text TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS extraction_status VARCHAR(20) DEFAULT 'pending';
