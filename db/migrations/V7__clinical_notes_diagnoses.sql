-- V7: Clinical notes and diagnoses tables
CREATE TABLE clinical_notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
  doctor_id       UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  subjective      TEXT,
  objective       TEXT,
  assessment      TEXT,
  plan            TEXT,
  visit_date      DATE NOT NULL,
  amended_note_id UUID REFERENCES clinical_notes(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE diagnosis_status AS ENUM ('active', 'resolved', 'chronic');

CREATE TABLE diagnoses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id        UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
  doctor_id         UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  icd10_code        VARCHAR(20) NOT NULL,
  icd10_description VARCHAR(500) NOT NULL,
  diagnosis_date    DATE NOT NULL,
  status            diagnosis_status NOT NULL DEFAULT 'active',
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS policies
ALTER TABLE clinical_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnoses ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_clinical_notes_patient ON clinical_notes(patient_id);
CREATE INDEX idx_clinical_notes_doctor ON clinical_notes(doctor_id);
CREATE INDEX idx_diagnoses_patient ON diagnoses(patient_id);
CREATE INDEX idx_diagnoses_icd10 ON diagnoses(icd10_code);
