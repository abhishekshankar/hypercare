-- Top 5 thin-source refusals by similar user question (first 80 chars) — v0 grouping
WITH refuse AS (
  SELECT m.id,
    m.created_at,
    m.refusal_reason_code,
    (
      SELECT um.content
      FROM messages um
      WHERE um.conversation_id = m.conversation_id
        AND um.role = 'user'
        AND um.created_at < m.created_at
      ORDER BY um.created_at DESC
      LIMIT 1
    ) AS query_text
  FROM messages m
  WHERE m.role = 'assistant'
    AND m.response_kind = 'refusal'
    AND COALESCE(m.refusal_reason_code, '') IN ('no_content', 'low_confidence', 'off_topic')
    AND m.created_at >= $1::timestamptz
    AND m.created_at < $2::timestamptz
),
norm AS (
  SELECT left(trim(COALESCE(query_text, '')), 80) AS key, 1::bigint AS n
  FROM refuse
  WHERE length(trim(COALESCE(query_text, ''))) > 0
)
SELECT key AS cluster_key, COUNT(*)::bigint AS count
FROM norm
GROUP BY key
ORDER BY count DESC, key
LIMIT 5;
