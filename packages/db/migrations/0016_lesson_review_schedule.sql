CREATE TABLE "lesson_review_schedule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"bucket" integer DEFAULT 0 NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"last_outcome" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lesson_review_schedule_user_id_module_id_unique" UNIQUE("user_id","module_id"),
	CONSTRAINT "lesson_review_schedule_last_outcome_check" CHECK ("lesson_review_schedule"."last_outcome" IN ('completed', 'started_not_completed', 'revisit_requested')),
	CONSTRAINT "lesson_review_schedule_bucket_check" CHECK ("lesson_review_schedule"."bucket" >= 0 AND "lesson_review_schedule"."bucket" <= 5)
);
--> statement-breakpoint
ALTER TABLE "lesson_review_schedule" ADD CONSTRAINT "lesson_review_schedule_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_review_schedule" ADD CONSTRAINT "lesson_review_schedule_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lesson_review_schedule_user_id_due_at_idx" ON "lesson_review_schedule" USING btree ("user_id","due_at");
