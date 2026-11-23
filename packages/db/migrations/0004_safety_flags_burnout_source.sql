-- TASK-021: soft-flag from caregiver burnout self-assessment — extend CHECK constraints.
-- Idempotent: safe to re-run in dev.
ALTER TABLE "safety_flags" DROP CONSTRAINT IF EXISTS "safety_flags_category_check";--> statement-breakpoint
ALTER TABLE "safety_flags" ADD CONSTRAINT "safety_flags_category_check" CHECK ("safety_flags"."category" IN (
  'self_harm_user', 'self_harm_cr', 'acute_medical',
  'abuse_cr_to_caregiver', 'abuse_caregiver_to_cr', 'neglect',
  'self_care_burnout'
));--> statement-breakpoint
ALTER TABLE "safety_flags" DROP CONSTRAINT IF EXISTS "safety_flags_severity_check";--> statement-breakpoint
ALTER TABLE "safety_flags" ADD CONSTRAINT "safety_flags_severity_check" CHECK ("safety_flags"."severity" IN ('low', 'high', 'medium'));--> statement-breakpoint
ALTER TABLE "safety_flags" DROP CONSTRAINT IF EXISTS "safety_flags_source_check";--> statement-breakpoint
ALTER TABLE "safety_flags" ADD CONSTRAINT "safety_flags_source_check" CHECK ("safety_flags"."source" IN ('rule', 'llm', 'burnout_self_assessment'));
