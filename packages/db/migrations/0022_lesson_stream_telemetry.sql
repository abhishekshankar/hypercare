-- TASK-040: per-stream first-card and full-stream latency (internal /metrics, no PII in payload).
CREATE TABLE IF NOT EXISTS lesson_stream_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES modules (id) ON DELETE CASCADE,
  first_card_ms integer NOT NULL,
  done_ms integer NOT NULL,
  card_count smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lesson_stream_telemetry_created_at_idx
  ON lesson_stream_telemetry (created_at);
