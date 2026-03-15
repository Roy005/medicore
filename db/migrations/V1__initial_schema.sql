-- ============================================================
-- MediCore — V1 Initial Database Schema
-- Flyway-style migration: V1__initial_schema.sql
-- ============================================================
-- Run against: PostgreSQL 16+
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 0. Extensions
-- ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ────────────────────────────────────────────────────────────
-- 1. ENUM Types
-- ────────────────────────────────────────────────────────────
CREATE TYPE user_role          AS ENUM ('patient', 'doctor', 'nurse', 'hospital_admin');
CREATE TYPE allergy_severity   AS ENUM ('mild', 'moderate', 'severe', 'life_threatening');
CREATE TYPE vital_metric_type  AS ENUM (
    'heart_rate', 'blood_pressure_systolic', 'blood_pressure_diastolic',
    'temperature', 'spo2', 'respiratory_rate', 'blood_glucose', 'weight', 'height'
);
CREATE TYPE access_type        AS ENUM ('emergency', 'read_only', 'full');

-- ────────────────────────────────────────────────────────────
-- 2. Tables (in FK-dependency order)
-- ────────────────────────────────────────────────────────────

-- 2.1 tenants ------------------------------------------------
CREATE TABLE tenants (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 2.2 users --------------------------------------------------
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role            user_role    NOT NULL,
    email           VARCHAR(320) NOT NULL,
    password_hash   TEXT         NOT NULL,
    is_mfa_enabled  BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 2.3 patient_profiles ---------------------------------------
CREATE TABLE patient_profiles (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                     UUID         NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    date_of_birth               DATE,
    blood_group                 VARCHAR(5),
    demographics                JSONB        NOT NULL DEFAULT '{}',
    insurance                   JSONB        NOT NULL DEFAULT '{}',
    emergency_contacts          JSONB        NOT NULL DEFAULT '[]',
    emergency_qr_token          VARCHAR(128),
    profile_completeness_score  INT          NOT NULL DEFAULT 0,
    created_at                  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 2.4 medications --------------------------------------------
CREATE TABLE medications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID         NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
    drug_name       VARCHAR(255) NOT NULL,
    rxnorm_code     VARCHAR(20),
    dosage          VARCHAR(100),
    frequency       VARCHAR(100),
    prescribed_by   UUID         REFERENCES users(id) ON DELETE SET NULL,
    start_date      DATE,
    end_date        DATE,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    source          VARCHAR(100),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 2.5 allergies ----------------------------------------------
CREATE TABLE allergies (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id             UUID              NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
    allergen               VARCHAR(255)      NOT NULL,
    allergen_type          VARCHAR(100),
    severity               allergy_severity  NOT NULL DEFAULT 'moderate',
    reaction_description   TEXT,
    created_at             TIMESTAMPTZ       NOT NULL DEFAULT now()
);

-- 2.6 vitals -------------------------------------------------
CREATE TABLE vitals (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id          UUID              NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
    recorded_at         TIMESTAMPTZ       NOT NULL DEFAULT now(),
    metric_type         vital_metric_type NOT NULL,
    value               DECIMAL(10,2)     NOT NULL,
    unit                VARCHAR(20)       NOT NULL,
    source_device       VARCHAR(100),
    context_notes       TEXT,
    is_anomaly_flagged  BOOLEAN           NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ       NOT NULL DEFAULT now()
);

-- 2.7 access_tokens ------------------------------------------
CREATE TABLE access_tokens (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id          UUID         NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
    granted_to_user_id  UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash          VARCHAR(256) NOT NULL,
    access_type         access_type  NOT NULL DEFAULT 'read_only',
    granted_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    expires_at          TIMESTAMPTZ,
    revoked_at          TIMESTAMPTZ
);

-- 2.8 audit_log (INSERT-only) --------------------------------
CREATE TABLE audit_log (
    id            BIGSERIAL PRIMARY KEY,
    event_type    VARCHAR(100)  NOT NULL,
    actor_user_id UUID          REFERENCES users(id) ON DELETE SET NULL,
    patient_id    UUID          REFERENCES patient_profiles(id) ON DELETE SET NULL,
    ip_address    INET,
    resource_type VARCHAR(100),
    event_hash    VARCHAR(256),
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 3. Audit Log — Immutability Trigger
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit log entries cannot be modified or deleted. Operation: %', TG_OP;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_audit_modification
    BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW
    EXECUTE FUNCTION fn_prevent_audit_modification();

-- ────────────────────────────────────────────────────────────
-- 4. Row-Level Security (RLS)
-- ────────────────────────────────────────────────────────────
-- Policies use the session variable `app.current_user_id`
-- which must be SET by the application before each query:
--   SET LOCAL app.current_user_id = '<user-uuid>';

-- 4.1 patient_profiles RLS -----------------------------------
ALTER TABLE patient_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY patient_profiles_owner_policy
    ON patient_profiles
    FOR ALL
    USING (
        user_id = current_setting('app.current_user_id', true)::UUID
    )
    WITH CHECK (
        user_id = current_setting('app.current_user_id', true)::UUID
    );

-- 4.2 vitals RLS ---------------------------------------------
ALTER TABLE vitals ENABLE ROW LEVEL SECURITY;

CREATE POLICY vitals_owner_policy
    ON vitals
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

-- ────────────────────────────────────────────────────────────
-- 5. Indexes
-- ────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX idx_users_email
    ON users (email);

CREATE INDEX idx_vitals_patient_recorded
    ON vitals (patient_id, recorded_at DESC);

CREATE INDEX idx_access_tokens_hash
    ON access_tokens (token_hash);

-- Additional useful indexes
CREATE INDEX idx_medications_patient
    ON medications (patient_id);

CREATE INDEX idx_allergies_patient
    ON allergies (patient_id);

CREATE INDEX idx_audit_log_actor
    ON audit_log (actor_user_id);

CREATE INDEX idx_audit_log_patient
    ON audit_log (patient_id);

CREATE INDEX idx_audit_log_created
    ON audit_log (created_at DESC);

COMMIT;
