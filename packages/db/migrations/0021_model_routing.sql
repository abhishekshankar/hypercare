-- TASK-042: per-user model routing cohort + decision log (ADR 0030).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS routing_cohort text;

COMMENT ON COLUMN users.routing_cohort IS 'A/B cohort for MODEL_ROUTING (routing_v1_control | routing_v1_treatment); null until assigned.';

CREATE TABLE IF NOT EXISTS model_routing_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  cohort text NOT NULL,
  classifier_verdict jsonb NOT NULL,
  policy_version int NOT NULL,
  matched_rule int,
  model_id text NOT NULL,
  reason text NOT NULL,
  latency_ms int,
  tokens_in int,
  tokens_out int,
  cost_estimate_usd numeric(10, 6),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS model_routing_decisions_user_created_idx
  ON model_routing_decisions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS model_routing_decisions_created_idx
  ON model_routing_decisions (created_at);

COMMENT ON TABLE model_routing_decisions IS 'Append-only Layer-5 routing audit (TASK-042); 90d retention via retention cron.';

-- Deterministic 50/50 split: SHA-256 first byte of user id (UTF-8) mod 2.
-- Re-runnable: only fills NULL cohorts.
UPDATE users
SET routing_cohort = CASE
  WHEN get_byte(sha256(convert_to(id::text, 'UTF8')), 0) % 2 = 0 THEN 'routing_v1_control'
  ELSE 'routing_v1_treatment'
END
WHERE routing_cohort IS NULL;
