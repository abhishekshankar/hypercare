-- TASK-033: "Forget this" taps in the metrics window (user_actions.transparency_forget)
SELECT count(*)::int AS forget_taps
FROM user_actions
WHERE action = 'transparency_forget'
  AND at >= $1
  AND at < $2;
