-- V8: Alerts table for vital sign monitoring
CREATE TYPE alert_tier AS ENUM ('emergency', 'urgent', 'soft', 'nudge');
CREATE TYPE alert_status AS ENUM ('active', 'acknowledged', 'resolved');

CREATE TABLE alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id    UUID NOT NULL REFERENCES patient_profiles(id) ON DELETE CASCADE,
  metric_type   VARCHAR(50) NOT NULL,
  value         DECIMAL(10,2) NOT NULL,
  unit          VARCHAR(20) NOT NULL,
  tier          alert_tier NOT NULL,
  status        alert_status NOT NULL DEFAULT 'active',
  message       TEXT NOT NULL,
  rule_id       VARCHAR(100) NOT NULL,
  dedup_key     VARCHAR(255),
  resolved_by   UUID REFERENCES users(id),
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_alerts_patient ON alerts(patient_id);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_dedup ON alerts(dedup_key);
CREATE INDEX idx_alerts_tier ON alerts(tier);
