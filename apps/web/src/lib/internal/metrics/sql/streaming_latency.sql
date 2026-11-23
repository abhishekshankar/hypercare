-- TASK-031: first committed chunk latency (streaming assistant rows only).
SELECT
  COALESCE(
    percentile_cont(0.5) WITHIN GROUP (ORDER BY stream_first_chunk_ms),
    0
  )::double precision AS p50_first_chunk_ms,
  COALESCE(
    percentile_cont(0.95) WITHIN GROUP (ORDER BY stream_first_chunk_ms),
    0
  )::double precision AS p95_first_chunk_ms,
  COUNT(*) FILTER (WHERE stream_first_chunk_ms IS NOT NULL)::bigint AS stream_answer_count,
  COUNT(*) FILTER (
    WHERE stream_first_chunk_ms IS NOT NULL
      AND refusal_reason_code IS NOT NULL
      AND refusal_reason_code <> 'user_cancelled'
  )::bigint AS refusal_after_stream_started
FROM messages
WHERE role = 'assistant'
  AND created_at >= $1::timestamptz
  AND created_at < $2::timestamptz;
