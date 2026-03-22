-- ============================================================
-- MediCore — V4 Emergency QR Token Index
-- ============================================================

BEGIN;

-- Fast lookup by emergency_qr_token for emergency page access logging
CREATE INDEX idx_patient_profiles_emergency_qr_token
    ON patient_profiles (emergency_qr_token)
    WHERE emergency_qr_token IS NOT NULL;

COMMIT;
