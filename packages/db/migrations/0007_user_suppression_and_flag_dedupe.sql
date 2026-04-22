CREATE TABLE "user_suppression" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"until" timestamp with time zone NOT NULL,
	"reason" text NOT NULL,
	"set_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_suppression_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade,
	CONSTRAINT "user_suppression_reason_check" CHECK ("reason" IN (
		'caregiver_self_harm',
		'elder_abuse_or_caregiver_breaking_point'
	))
);
--> statement-breakpoint
ALTER TABLE "safety_flags" ADD COLUMN "repeat_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "safety_flags" ADD COLUMN "last_message_text" text;
--> statement-breakpoint
ALTER TABLE "safety_flags" ADD COLUMN "script_version" integer;
--> statement-breakpoint
CREATE INDEX "user_suppression_until_idx" ON "user_suppression" ("until");
