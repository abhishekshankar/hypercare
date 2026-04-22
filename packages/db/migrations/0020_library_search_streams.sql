-- TASK-041: library search SSE telemetry (no query text; latency percentiles in /internal/metrics).

CREATE TABLE library_search_streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  first_result_at timestamptz,
  done_at timestamptz,
  query_length integer NOT NULL,
  candidate_count integer NOT NULL,
  result_count integer NOT NULL DEFAULT 0
);

CREATE INDEX library_search_streams_started_at_idx ON library_search_streams (started_at DESC);

COMMENT ON TABLE library_search_streams IS 'TASK-041 library search stream timing; privacy: no raw query stored.';
