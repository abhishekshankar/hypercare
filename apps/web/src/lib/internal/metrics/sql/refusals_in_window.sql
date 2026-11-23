SELECT COUNT(*)::bigint AS refusals
FROM messages
WHERE role = 'assistant'
  AND response_kind = 'refusal'
  AND COALESCE(refusal_reason_code, '') IN ('no_content', 'low_confidence', 'off_topic')
  AND created_at >= $1::timestamptz
  AND created_at < $2::timestamptz;
