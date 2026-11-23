SELECT
  (SELECT COUNT(*)::bigint FROM modules WHERE published = true) AS published_count,
  (SELECT MAX(updated_at) FROM modules WHERE published = true) AS last_publish;
