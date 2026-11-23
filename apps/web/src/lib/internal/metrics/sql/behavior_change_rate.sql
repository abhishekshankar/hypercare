WITH active AS (
  SELECT DISTINCT v.user_id
  FROM (
    SELECT us.user_id
    FROM user_sessions us
    WHERE us.visited_at >= $1::timestamptz
      AND us.visited_at < $2::timestamptz
    UNION
    SELECT c.user_id
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE m.created_at >= $1::timestamptz
      AND m.created_at < $2::timestamptz
  ) v
)
SELECT
  (COUNT(*) FILTER (WHERE wc.tried_something = TRUE))::double precision AS tried_something_true,
  (COUNT(*))::double precision AS weekly_checkin_answered_total
FROM weekly_checkins wc
INNER JOIN active a ON a.user_id = wc.user_id
WHERE wc.answered_at IS NOT NULL
  AND wc.answered_at >= $1::timestamptz
  AND wc.answered_at < $2::timestamptz;
