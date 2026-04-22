SELECT
  (SELECT COUNT(*)::bigint FROM user_suppression WHERE "until" > CURRENT_TIMESTAMP) AS suppression_active,
  (SELECT COUNT(*)::bigint
   FROM modules
   WHERE published = true
     AND next_review_due IS NOT NULL
     AND next_review_due <= (CURRENT_DATE + interval '30 days')::date) AS modules_nearing_review;
