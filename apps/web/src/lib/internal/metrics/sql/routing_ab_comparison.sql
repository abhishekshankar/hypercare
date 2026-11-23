-- TASK-042: per-cohort rollup for model routing experiment ($1, $2 = window bounds).
SELECT
  d.cohort,
  count(*)::bigint AS routing_decisions_n,
  count(*) filter (where m.rating = 'up')::bigint AS helpful_n,
  count(*) filter (where m.rating in ('up', 'down'))::bigint AS rated_n,
  round(
    100.0 * count(*) filter (where m.rating = 'up')::numeric
    / nullif(count(*) filter (where m.rating in ('up', 'down')), 0),
    1
  ) AS helpful_pct,
  avg(d.latency_ms)::float AS avg_latency_ms,
  sum(coalesce(d.cost_estimate_usd, 0))::float AS sum_cost_estimate_usd
FROM model_routing_decisions d
JOIN messages m ON m.id = d.message_id
WHERE d.created_at >= $1
  AND d.created_at < $2
GROUP BY d.cohort
ORDER BY d.cohort;
