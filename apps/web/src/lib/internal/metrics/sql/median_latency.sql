SELECT
  COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY generation_latency_ms), 0)::double precision AS p50_ms
FROM messages
WHERE role = 'assistant'
  AND generation_latency_ms IS NOT NULL
  AND created_at >= $1::timestamptz
  AND created_at < $2::timestamptz;
