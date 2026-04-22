-- TASK-034: v1 stage-assessment ordinals (Care Specialist copy + inference migration)

ALTER TABLE "care_profile"
  ADD COLUMN IF NOT EXISTS "stage_questions_version" integer NOT NULL DEFAULT 0;
ALTER TABLE "care_profile"
  ADD COLUMN IF NOT EXISTS "med_management_v1" text;
ALTER TABLE "care_profile"
  ADD COLUMN IF NOT EXISTS "driving_v1" text;
ALTER TABLE "care_profile"
  ADD COLUMN IF NOT EXISTS "alone_safety_v1" text[];
ALTER TABLE "care_profile"
  ADD COLUMN IF NOT EXISTS "recognition_v1" text;
ALTER TABLE "care_profile"
  ADD COLUMN IF NOT EXISTS "bathing_dressing_v1" text;
ALTER TABLE "care_profile"
  ADD COLUMN IF NOT EXISTS "wandering_v1" text;
ALTER TABLE "care_profile"
  ADD COLUMN IF NOT EXISTS "conversation_v1" text;
ALTER TABLE "care_profile"
  ADD COLUMN IF NOT EXISTS "sleep_v1" text;

ALTER TABLE "care_profile" DROP CONSTRAINT IF EXISTS "care_profile_stage_questions_version_check";
ALTER TABLE "care_profile" ADD CONSTRAINT "care_profile_stage_questions_version_check"
  CHECK ("stage_questions_version" IS NOT NULL AND "stage_questions_version" >= 0 AND "stage_questions_version" <= 1);

ALTER TABLE "care_profile" DROP CONSTRAINT IF EXISTS "care_profile_med_management_v1_check";
ALTER TABLE "care_profile" ADD CONSTRAINT "care_profile_med_management_v1_check"
  CHECK ("med_management_v1" IS NULL OR "med_management_v1" IN ('self', 'reminders', 'hands_on_help'));

ALTER TABLE "care_profile" DROP CONSTRAINT IF EXISTS "care_profile_driving_v1_check";
ALTER TABLE "care_profile" ADD CONSTRAINT "care_profile_driving_v1_check"
  CHECK ("driving_v1" IS NULL OR "driving_v1" IN ('safe', 'worried', 'stopped_recent', 'stopped_long_ago', 'never_drove'));

ALTER TABLE "care_profile" DROP CONSTRAINT IF EXISTS "care_profile_recognition_v1_check";
ALTER TABLE "care_profile" ADD CONSTRAINT "care_profile_recognition_v1_check"
  CHECK ("recognition_v1" IS NULL OR "recognition_v1" IN ('yes_always', 'yes_usually', 'sometimes', 'rarely'));

ALTER TABLE "care_profile" DROP CONSTRAINT IF EXISTS "care_profile_bathing_dressing_v1_check";
ALTER TABLE "care_profile" ADD CONSTRAINT "care_profile_bathing_dressing_v1_check"
  CHECK ("bathing_dressing_v1" IS NULL OR "bathing_dressing_v1" IN ('on_own', 'with_reminders', 'hands_on_help'));

ALTER TABLE "care_profile" DROP CONSTRAINT IF EXISTS "care_profile_wandering_v1_check";
ALTER TABLE "care_profile" ADD CONSTRAINT "care_profile_wandering_v1_check"
  CHECK ("wandering_v1" IS NULL OR "wandering_v1" IN ('no', 'once', 'few_times', 'often'));

ALTER TABLE "care_profile" DROP CONSTRAINT IF EXISTS "care_profile_conversation_v1_check";
ALTER TABLE "care_profile" ADD CONSTRAINT "care_profile_conversation_v1_check"
  CHECK ("conversation_v1" IS NULL OR "conversation_v1" IN ('yes', 'yes_repeats', 'only_short', 'rarely_makes_sense'));

ALTER TABLE "care_profile" DROP CONSTRAINT IF EXISTS "care_profile_sleep_v1_check";
ALTER TABLE "care_profile" ADD CONSTRAINT "care_profile_sleep_v1_check"
  CHECK ("sleep_v1" IS NULL OR "sleep_v1" IN ('sleep_through', 'some_nights_hard', 'most_nights_hard'));

ALTER TABLE "care_profile" DROP CONSTRAINT IF EXISTS "care_profile_alone_safety_v1_check";
ALTER TABLE "care_profile" ADD CONSTRAINT "care_profile_alone_safety_v1_check"
  CHECK (
    "alone_safety_v1" IS NULL
    OR "alone_safety_v1" <@ ARRAY[
      'nothing', 'wandering', 'falls', 'cooking', 'medication_mistakes', 'other'
    ]::text[]
  );
