-- V9: Store file data in database for cloud deployment
-- Render (and similar platforms) have ephemeral filesystems,
-- so we need to store file content in PostgreSQL.

ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_data BYTEA;
