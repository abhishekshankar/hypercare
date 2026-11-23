SELECT
  date_trunc('week', m.created_at) AS week,
  (COUNT(*) FILTER (WHERE
    m.rating = 'up'
    AND m.rated_at IS NOT NULL
    AND m.rated_at <= m.created_at + interval '48 hours'
  ))::double precision AS up_n,
  (COUNT(*) FILTER (WHERE
    m.rating IS NOT NULL
    AND m.rated_at IS NOT NULL
    AND m.rated_at <= m.created_at + interval '48 hours'
  ))::double precision AS denom
FROM messages m
WHERE m.role = 'assistant'
  AND m.created_at >= (CURRENT_TIMESTAMP - interval '8 weeks')
GROUP BY 1
ORDER BY 1;
