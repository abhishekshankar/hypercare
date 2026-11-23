SELECT
  (COUNT(*) FILTER (WHERE
    m.rating = 'up'
    AND m.rated_at IS NOT NULL
    AND m.rated_at <= m.created_at + interval '48 hours'
  ))::double precision AS rated_helpful,
  (COUNT(*) FILTER (WHERE
    m.rating IS NOT NULL
    AND m.rated_at IS NOT NULL
    AND m.rated_at <= m.created_at + interval '48 hours'
  ))::double precision AS rated_total,
  (COUNT(*) FILTER (WHERE
    m.rating_invited IS TRUE
    AND m.response_kind = 'answer'
  ))::double precision AS shown_rating_ui_total
FROM messages m
WHERE m.role = 'assistant'
  AND m.created_at >= $1::timestamptz
  AND m.created_at < $2::timestamptz;
