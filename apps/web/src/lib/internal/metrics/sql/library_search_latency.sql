-- TASK-041: library search SSE — first `result` vs `done` (ms), from `library_search_streams`.
SELECT
  COALESCE(
    (
      SELECT percentile_cont(0.5) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM (s.first_result_at - s.started_at)) * 1000
        )
      FROM library_search_streams s
      WHERE s.started_at >= $1::timestamptz
        AND s.started_at < $2::timestamptz
        AND s.done_at IS NOT NULL
        AND s.first_result_at IS NOT NULL
    ),
    0
  )::double precision AS p50_first_result_ms,
  COALESCE(
    (
      SELECT percentile_cont(0.95) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM (s.first_result_at - s.started_at)) * 1000
        )
      FROM library_search_streams s
      WHERE s.started_at >= $1::timestamptz
        AND s.started_at < $2::timestamptz
        AND s.done_at IS NOT NULL
        AND s.first_result_at IS NOT NULL
    ),
    0
  )::double precision AS p95_first_result_ms,
  COALESCE(
    (
      SELECT percentile_cont(0.5) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM (s.done_at - s.started_at)) * 1000
        )
      FROM library_search_streams s
      WHERE s.started_at >= $1::timestamptz
        AND s.started_at < $2::timestamptz
        AND s.done_at IS NOT NULL
    ),
    0
  )::double precision AS p50_done_ms,
  COALESCE(
    (
      SELECT percentile_cont(0.95) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM (s.done_at - s.started_at)) * 1000
        )
      FROM library_search_streams s
      WHERE s.started_at >= $1::timestamptz
        AND s.started_at < $2::timestamptz
        AND s.done_at IS NOT NULL
    ),
    0
  )::double precision AS p95_done_ms,
  (
    SELECT COUNT(*)::bigint
    FROM library_search_streams s
    WHERE s.started_at >= $1::timestamptz
      AND s.started_at < $2::timestamptz
      AND s.done_at IS NOT NULL
      AND s.first_result_at IS NOT NULL
  ) AS streams_with_first_result,
  (
    SELECT COUNT(*)::bigint
    FROM library_search_streams s
    WHERE s.started_at >= $1::timestamptz
      AND s.started_at < $2::timestamptz
      AND s.done_at IS NOT NULL
  ) AS stream_count;
