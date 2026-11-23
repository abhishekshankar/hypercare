CREATE TABLE "care_profile_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"section" text NOT NULL,
	"field" text NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"trigger" text NOT NULL,
	CONSTRAINT "care_profile_changes_section_check" CHECK ("care_profile_changes"."section" IN (
        'about_cr', 'stage', 'living', 'about_you', 'what_matters'
      )),
	CONSTRAINT "care_profile_changes_trigger_check" CHECK ("care_profile_changes"."trigger" IN ('user_edit', 'evolved_state_flow', 'system_inferred'))
);
--> statement-breakpoint
CREATE TABLE "lesson_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"revisit" boolean DEFAULT false NOT NULL,
	"source" text NOT NULL,
	CONSTRAINT "lesson_progress_user_id_module_id_started_at_unique" UNIQUE("user_id","module_id","started_at"),
	CONSTRAINT "lesson_progress_source_check" CHECK ("lesson_progress"."source" IN (
        'weekly_focus', 'library_browse', 'search', 'conversation_link'
      ))
);
--> statement-breakpoint
CREATE TABLE "module_topics" (
	"module_id" uuid NOT NULL,
	"topic_slug" text NOT NULL,
	CONSTRAINT "module_topics_module_id_topic_slug_pk" PRIMARY KEY("module_id","topic_slug")
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"slug" text PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "topics_category_check" CHECK ("topics"."category" IN (
        'behaviors', 'daily_care', 'communication', 'medical', 'legal_financial',
        'transitions', 'caring_for_yourself'
      ))
);
--> statement-breakpoint
CREATE TABLE "weekly_checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"prompted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"answered_at" timestamp with time zone,
	"tried_something" boolean,
	"what_helped" text,
	CONSTRAINT "weekly_checkins_user_id_prompted_at_unique" UNIQUE("user_id","prompted_at")
);
--> statement-breakpoint
ALTER TABLE "care_profile_changes" ADD CONSTRAINT "care_profile_changes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_topics" ADD CONSTRAINT "module_topics_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_topics" ADD CONSTRAINT "module_topics_topic_slug_topics_slug_fk" FOREIGN KEY ("topic_slug") REFERENCES "public"."topics"("slug") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_checkins" ADD CONSTRAINT "weekly_checkins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "care_profile_changes_user_id_changed_at_idx" ON "care_profile_changes" USING btree ("user_id","changed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "care_profile_changes_user_id_section_changed_at_idx" ON "care_profile_changes" USING btree ("user_id","section","changed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "lesson_progress_user_id_completed_at_idx" ON "lesson_progress" USING btree ("user_id","completed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "lesson_progress_user_id_module_id_idx" ON "lesson_progress" USING btree ("user_id","module_id");--> statement-breakpoint
CREATE INDEX "module_topics_topic_slug_idx" ON "module_topics" USING btree ("topic_slug");--> statement-breakpoint
CREATE INDEX "weekly_checkins_user_id_answered_at_idx" ON "weekly_checkins" USING btree ("user_id","answered_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "weekly_checkins_user_id_prompted_at_idx" ON "weekly_checkins" USING btree ("user_id","prompted_at" DESC NULLS LAST);--> statement-breakpoint
INSERT INTO "topics" ("slug", "category", "display_name") VALUES
  ('sundowning', 'behaviors', 'Sundowning'),
  ('repetitive-questions', 'behaviors', 'Repetitive questions'),
  ('accusations-paranoia', 'behaviors', 'Accusations and paranoia'),
  ('agitation-aggression', 'behaviors', 'Agitation and aggression'),
  ('wandering', 'behaviors', 'Wandering'),
  ('refusal-of-care', 'behaviors', 'Refusal of care'),
  ('bathing-resistance', 'daily_care', 'Bathing resistance'),
  ('eating-swallowing', 'daily_care', 'Eating and swallowing'),
  ('sleep-problems', 'daily_care', 'Sleep problems'),
  ('medication-management', 'daily_care', 'Medication management'),
  ('how-to-talk', 'communication', 'How to talk'),
  ('non-recognition', 'communication', 'Non-recognition'),
  ('validation-basics', 'communication', 'Validation basics'),
  ('understanding-diagnosis', 'medical', 'Understanding diagnosis'),
  ('hospital-visits', 'medical', 'Hospital visits'),
  ('power-of-attorney', 'legal_financial', 'Power of attorney'),
  ('paying-for-care', 'legal_financial', 'Paying for care'),
  ('caregiver-burnout', 'caring_for_yourself', 'Caregiver burnout'),
  ('guilt-and-grief', 'caring_for_yourself', 'Guilt and grief'),
  ('asking-for-help', 'caring_for_yourself', 'Asking for help')
ON CONFLICT ("slug") DO NOTHING;
