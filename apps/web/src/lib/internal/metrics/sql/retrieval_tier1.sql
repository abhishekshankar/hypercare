SELECT
  (COUNT(*) FILTER (WHERE
    response_kind = 'answer' AND COALESCE(retrieval_top_tier, 0) = 1
  ))::double precision AS tier1_answers,
  (COUNT(*) FILTER (WHERE
    response_kind = 'answer'
  ))::double precision AS total_answered
FROM messages
WHERE role = 'assistant'
  AND created_at >= $1::timestamptz
  AND created_at < $2::timestamptz;
