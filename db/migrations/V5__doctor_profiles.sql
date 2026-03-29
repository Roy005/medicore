-- V5: Doctor profiles table
CREATE TYPE verification_status AS ENUM ('pending', 'verified');

CREATE TABLE doctor_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  specialty     VARCHAR(100) NOT NULL,
  registration_number VARCHAR(100) NOT NULL UNIQUE,
  hospital_affiliation VARCHAR(255),
  verification_status verification_status NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS policy: doctors can only read/update their own profile
ALTER TABLE doctor_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY doctor_own_profile ON doctor_profiles
  USING (user_id = current_setting('app.current_user_id', true)::uuid);

-- Index for fast lookup by user_id
CREATE INDEX idx_doctor_profiles_user_id ON doctor_profiles(user_id);
