-- TASK-040: successful lesson SSE GET → first / full card (telemetry table).
SELECT
  COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY first_card_ms), 0)::double precision
    AS p50_first_card_ms,
  COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY first_card_ms), 0)::double precision
    AS p95_first_card_ms,
  COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY done_ms), 0)::double precision AS p50_done_ms,
  COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY done_ms), 0)::double precision AS p95_done_ms,
  COUNT(*)::bigint AS n
FROM lesson_stream_telemetry
WHERE created_at >= $1::timestamptz
  AND created_at < $2::timestamptz;
