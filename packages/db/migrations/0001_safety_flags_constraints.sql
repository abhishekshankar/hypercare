ALTER TABLE "safety_flags" DROP CONSTRAINT "safety_flags_category_check";--> statement-breakpoint
ALTER TABLE "safety_flags" DROP CONSTRAINT "safety_flags_severity_check";--> statement-breakpoint
ALTER TABLE "safety_flags" DROP CONSTRAINT "safety_flags_confidence_check";--> statement-breakpoint
ALTER TABLE "safety_flags" ALTER COLUMN "message_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "safety_flags" ALTER COLUMN "conversation_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "safety_flags" ALTER COLUMN "confidence" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "safety_flags" ALTER COLUMN "classifier_output" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "safety_flags" ADD COLUMN "message_text" text NOT NULL;--> statement-breakpoint
ALTER TABLE "safety_flags" ADD COLUMN "source" text NOT NULL;--> statement-breakpoint
ALTER TABLE "safety_flags" ADD COLUMN "matched_signals" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "safety_flags" ADD CONSTRAINT "safety_flags_source_check" CHECK ("safety_flags"."source" IN ('rule', 'llm'));--> statement-breakpoint
ALTER TABLE "safety_flags" ADD CONSTRAINT "safety_flags_category_check" CHECK ("safety_flags"."category" IN (
        'self_harm_user', 'self_harm_cr', 'acute_medical',
        'abuse_cr_to_caregiver', 'abuse_caregiver_to_cr', 'neglect'
      ));--> statement-breakpoint
ALTER TABLE "safety_flags" ADD CONSTRAINT "safety_flags_severity_check" CHECK ("safety_flags"."severity" IN ('high', 'medium'));--> statement-breakpoint
ALTER TABLE "safety_flags" ADD CONSTRAINT "safety_flags_confidence_check" CHECK ("safety_flags"."confidence" IS NULL OR ("safety_flags"."confidence" >= 0 AND "safety_flags"."confidence" <= 1));