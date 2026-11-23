-- TASK-036: feedback loop health (window $1..$2)
SELECT
  (SELECT COUNT(*)::double precision
   FROM user_feedback
   WHERE submitted_at >= $1::timestamptz AND submitted_at < $2::timestamptz) AS new_this_week,
  (SELECT COUNT(*)::double precision
   FROM user_feedback
   WHERE triage_state = 'new' AND submitted_at < now() - interval '72 hours') AS stale_new_over_72h,
  (SELECT
     COUNT(*) FILTER (WHERE triaged_at IS NOT NULL AND triaged_at <= submitted_at + interval '72 hours')::double precision
     / NULLIF(COUNT(*) FILTER (WHERE triaged_at IS NOT NULL), 0)::double precision
   FROM user_feedback
   WHERE submitted_at >= $1::timestamptz AND submitted_at < $2::timestamptz) AS pct_triaged_within_72h,
  (SELECT
     COUNT(*) FILTER (WHERE kind = 'thumbs_down' AND triage_state = 'needs_content_fix')::double precision
     / NULLIF(COUNT(*) FILTER (WHERE kind = 'thumbs_down'), 0)::double precision
   FROM user_feedback
   WHERE submitted_at >= $1::timestamptz AND submitted_at < $2::timestamptz) AS pct_thumbs_down_to_content_fix,
  (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (triaged_at - submitted_at)) / 3600.0)
   FROM user_feedback
   WHERE triaged_at IS NOT NULL
     AND submitted_at >= $1::timestamptz AND submitted_at < $2::timestamptz) AS median_triage_hours;
