-- TASK-042 — one-off or cron helper: delete routing decisions older than 90 days.
-- Prefer `pnpm --filter @alongside/db exec tsx src/scripts/retention-cron.ts` which
-- applies the schedule in `src/retention/schedule.ts`.

DELETE FROM model_routing_decisions
WHERE created_at < now() - interval '90 days';
