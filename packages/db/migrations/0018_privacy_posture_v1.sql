CREATE TABLE "session_revocations" (
	"session_id" text PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"revoked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reason" text NOT NULL,
	CONSTRAINT "session_revocations_reason_check" CHECK ("reason" IN ('logout', 'user_delete', 'admin_revoke', 'ttl'))
);
--> statement-breakpoint
CREATE TABLE "user_auth_sessions" (
	"session_id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"country_code" text,
	CONSTRAINT "user_auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX "user_auth_sessions_user_id_last_seen_idx" ON "user_auth_sessions" ("user_id", "last_seen_at" DESC);
--> statement-breakpoint
CREATE TABLE "privacy_export_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"s3_key" text,
	"error" text,
	CONSTRAINT "privacy_export_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade,
	CONSTRAINT "privacy_export_requests_status_check" CHECK ("status" IN ('pending', 'complete', 'error'))
);
--> statement-breakpoint
CREATE INDEX "privacy_export_requests_user_id_created_at_idx" ON "privacy_export_requests" ("user_id", "created_at" DESC);
--> statement-breakpoint
ALTER TABLE "admin_audit" ADD COLUMN "meta" jsonb;
--> statement-breakpoint
ALTER TABLE "admin_audit" ADD COLUMN "reason" text;
--> statement-breakpoint
ALTER TABLE "admin_audit" DROP CONSTRAINT "admin_audit_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "admin_audit" ALTER COLUMN "user_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "admin_audit" ADD CONSTRAINT "admin_audit_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "safety_flags" ADD COLUMN "deidentified_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "safety_flags" DROP CONSTRAINT "safety_flags_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "safety_flags" ALTER COLUMN "user_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "safety_flags" ADD CONSTRAINT "safety_flags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "session_revocations" ADD CONSTRAINT "session_revocations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null;
