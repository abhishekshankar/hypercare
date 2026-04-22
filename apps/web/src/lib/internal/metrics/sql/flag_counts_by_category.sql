SELECT
  category,
  COUNT(*)::bigint AS count,
  COALESCE(SUM(repeat_count), 0)::bigint AS repeat_count_sum
FROM safety_flags
WHERE created_at >= CURRENT_TIMESTAMP - interval '14 days'
GROUP BY category
ORDER BY count DESC;
