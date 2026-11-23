CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"visited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"path" text NOT NULL,
	CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX "user_sessions_user_id_visited_at_idx" ON "user_sessions" ("user_id", "visited_at" DESC);
--> statement-breakpoint
CREATE TABLE "admin_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"path" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_audit_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX "admin_audit_user_id_at_idx" ON "admin_audit" ("user_id", "at" DESC);
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "rated_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "rating" text;
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_rating_check" CHECK ("rating" IS NULL OR "rating" IN ('up', 'down'));
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "rating_invited" boolean;
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "retrieval_top_tier" smallint;
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_retrieval_top_tier_check" CHECK ("retrieval_top_tier" IS NULL OR ("retrieval_top_tier" IN (1, 2, 3)));
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "refusal_reason_code" text;
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "bedrock_input_tokens" integer;
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "bedrock_output_tokens" integer;
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "generation_latency_ms" integer;
--> statement-breakpoint
CREATE INDEX "messages_assistant_response_created_idx" ON "messages" ("response_kind", "created_at" DESC)
	WHERE "role" = 'assistant';
