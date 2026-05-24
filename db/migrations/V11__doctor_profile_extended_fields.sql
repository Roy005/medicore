-- V11: Extended doctor profile fields for prescription generation
-- Adds personal & hospital contact details needed on prescriptions

ALTER TABLE doctor_profiles
  ADD COLUMN IF NOT EXISTS full_name          VARCHAR(200),
  ADD COLUMN IF NOT EXISTS qualifications     VARCHAR(300),
  ADD COLUMN IF NOT EXISTS phone              VARCHAR(30),
  ADD COLUMN IF NOT EXISTS hospital_address   TEXT,
  ADD COLUMN IF NOT EXISTS hospital_phone     VARCHAR(30),
  ADD COLUMN IF NOT EXISTS hospital_email     VARCHAR(320);
