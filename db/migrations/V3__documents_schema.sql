-- ============================================================
-- MediCore — V3 Documents Schema
-- ============================================================

BEGIN;

-- 1. ENUM Types
CREATE TYPE document_type AS ENUM ('lab_report', 'prescription', 'scan', 'other');

-- 2. Table
CREATE TABLE documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID           NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
    filename        VARCHAR(255)   NOT NULL,
    original_name   VARCHAR(255)   NOT NULL,
    mimetype        VARCHAR(100)   NOT NULL,
    size_bytes      BIGINT         NOT NULL,
    uploaded_by     UUID           REFERENCES users(id) ON DELETE SET NULL,
    upload_date     TIMESTAMPTZ    NOT NULL DEFAULT now(),
    document_type   document_type  NOT NULL DEFAULT 'other',
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT now()
);

-- 3. Row-Level Security
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY documents_owner_policy
    ON documents
    FOR ALL
    USING (
        patient_id IN (
            SELECT id FROM patient_profiles
            WHERE user_id = current_setting('app.current_user_id', true)::UUID
        )
    )
    WITH CHECK (
        patient_id IN (
            SELECT id FROM patient_profiles
            WHERE user_id = current_setting('app.current_user_id', true)::UUID
        )
    );

-- 4. Indexes
CREATE INDEX idx_documents_patient
    ON documents (patient_id);

CREATE INDEX idx_documents_uploaded_by
    ON documents (uploaded_by);

COMMIT;
