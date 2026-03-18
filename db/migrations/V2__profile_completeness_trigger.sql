-- ============================================================
-- MediCore — V2 Profile Completeness Score Trigger
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION fn_update_profile_completeness()
RETURNS TRIGGER AS $$
DECLARE
    score INT := 0;
BEGIN
    -- Base score (user exists in profile table)
    score := score + 20;

    IF NEW.date_of_birth IS NOT NULL THEN
        score := score + 20;
    END IF;

    IF NEW.blood_group IS NOT NULL THEN
        score := score + 10;
    END IF;

    IF NEW.demographics IS NOT NULL AND NEW.demographics::text <> '{}' THEN
        score := score + 20;
    END IF;

    IF NEW.insurance IS NOT NULL AND NEW.insurance::text <> '{}' THEN
        score := score + 15;
    END IF;

    IF NEW.emergency_contacts IS NOT NULL AND NEW.emergency_contacts::text <> '[]' THEN
        score := score + 15;
    END IF;

    NEW.profile_completeness_score := score;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_profile_completeness
    BEFORE INSERT OR UPDATE ON patient_profiles
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_profile_completeness();

COMMIT;
