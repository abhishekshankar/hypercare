SELECT
  COALESCE(SUM(bedrock_input_tokens), 0)::bigint AS input_sum,
  COALESCE(SUM(bedrock_output_tokens), 0)::bigint AS output_sum
FROM messages
WHERE role = 'assistant'
  AND created_at >= CURRENT_TIMESTAMP - interval '1 day';
