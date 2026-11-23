-- $1 = n (2, 4, or 8) — "week n" = activity in [created + (n-1)*7d, created + n*7d) per PRD W2 / W4 / W8
-- Cohort: users with created_at <= now() - n*7d (they are old enough to have completed that week)
SELECT
  (COUNT(*))::double precision AS cohort_size,
  (COUNT(*) FILTER (WHERE
    EXISTS (
      SELECT 1
      FROM user_sessions s
      WHERE s.user_id = u.id
        AND s.visited_at >= u.created_at + (($1::int - 1) * 7) * interval '1 day'
        AND s.visited_at < u.created_at + ($1::int * 7) * interval '1 day'
    )
    OR EXISTS (
      SELECT 1
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE c.user_id = u.id
        AND m.created_at >= u.created_at + (($1::int - 1) * 7) * interval '1 day'
        AND m.created_at < u.created_at + ($1::int * 7) * interval '1 day'
    )
  ))::double precision AS returned
FROM users u
WHERE u.created_at <= (CURRENT_TIMESTAMP - ($1::int * 7) * interval '1 day');
