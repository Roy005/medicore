-- V6: Consent system updates to access_tokens
-- Make granted_to_user_id nullable (allows any-doctor redemption)
ALTER TABLE access_tokens ALTER COLUMN granted_to_user_id DROP NOT NULL;

-- Add new access type enum values for consent
ALTER TYPE access_type ADD VALUE IF NOT EXISTS 'clinical_read';
ALTER TYPE access_type ADD VALUE IF NOT EXISTS 'clinical_write';
