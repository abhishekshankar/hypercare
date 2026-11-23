CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION hypercare_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TABLE "care_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"cr_first_name" text NOT NULL,
	"cr_age" integer,
	"cr_relationship" text NOT NULL,
	"cr_diagnosis" text,
	"cr_diagnosis_year" integer,
	"stage_answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"inferred_stage" text,
	"living_situation" text,
	"care_network" text,
	"care_hours_per_week" integer,
	"caregiver_proximity" text,
	"caregiver_age_bracket" text,
	"caregiver_work_status" text,
	"caregiver_state_1_5" integer,
	"hardest_thing" text,
	"cr_background" text,
	"cr_joy" text,
	"cr_personality_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "care_profile_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "care_profile_cr_relationship_check" CHECK ("care_profile"."cr_relationship" IN ('parent', 'spouse', 'sibling', 'in_law', 'other')),
	CONSTRAINT "care_profile_cr_diagnosis_check" CHECK (("care_profile"."cr_diagnosis" IS NULL OR "care_profile"."cr_diagnosis" IN (
        'alzheimers', 'vascular', 'lewy_body', 'frontotemporal', 'mixed',
        'unknown_type', 'suspected_undiagnosed'
      ))),
	CONSTRAINT "care_profile_inferred_stage_check" CHECK (("care_profile"."inferred_stage" IS NULL OR "care_profile"."inferred_stage" IN ('early', 'middle', 'late', 'unknown'))),
	CONSTRAINT "care_profile_living_situation_check" CHECK (("care_profile"."living_situation" IS NULL OR "care_profile"."living_situation" IN (
        'with_caregiver', 'alone', 'with_other_family', 'assisted_living',
        'memory_care', 'nursing_home'
      ))),
	CONSTRAINT "care_profile_care_network_check" CHECK (("care_profile"."care_network" IS NULL OR "care_profile"."care_network" IN (
        'solo', 'siblings_helping', 'paid_help', 'spouse_of_cr'
      ))),
	CONSTRAINT "care_profile_caregiver_proximity_check" CHECK (("care_profile"."caregiver_proximity" IS NULL OR "care_profile"."caregiver_proximity" IN (
        'same_home', 'same_city', 'remote'
      ))),
	CONSTRAINT "care_profile_caregiver_age_bracket_check" CHECK (("care_profile"."caregiver_age_bracket" IS NULL OR "care_profile"."caregiver_age_bracket" IN (
        'under_40', '40_54', '55_64', '65_74', '75_plus'
      ))),
	CONSTRAINT "care_profile_caregiver_work_status_check" CHECK (("care_profile"."caregiver_work_status" IS NULL OR "care_profile"."caregiver_work_status" IN ('working', 'retired', 'other'))),
	CONSTRAINT "care_profile_caregiver_state_1_5_check" CHECK (("care_profile"."caregiver_state_1_5" IS NULL OR ("care_profile"."caregiver_state_1_5" >= 1 AND "care_profile"."caregiver_state_1_5" <= 5)))
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"response_kind" text,
	"retrieval" jsonb,
	"classifier" jsonb,
	"verification" jsonb,
	"model_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_role_check" CHECK ("messages"."role" IN ('user', 'assistant', 'system')),
	CONSTRAINT "messages_response_kind_check" CHECK (("messages"."response_kind" IS NULL OR "messages"."response_kind" IN ('answer', 'refusal', 'safety_script')))
);
--> statement-breakpoint
CREATE TABLE "module_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"token_count" integer NOT NULL,
	"embedding" vector(1024) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "module_chunks_module_id_chunk_index_unique" UNIQUE("module_id","chunk_index")
);
--> statement-breakpoint
CREATE TABLE "modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"stage_relevance" text[] DEFAULT '{}'::text[] NOT NULL,
	"tier" integer NOT NULL,
	"summary" text NOT NULL,
	"body_md" text NOT NULL,
	"attribution_line" text NOT NULL,
	"expert_reviewer" text,
	"review_date" date,
	"next_review_due" date,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "modules_slug_unique" UNIQUE("slug"),
	CONSTRAINT "modules_category_check" CHECK ("modules"."category" IN (
        'behaviors', 'daily_care', 'communication', 'medical', 'legal_financial',
        'transitions', 'caring_for_yourself'
      )),
	CONSTRAINT "modules_tier_check" CHECK ("modules"."tier" IN (1, 2, 3))
);
--> statement-breakpoint
CREATE TABLE "safety_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"category" text NOT NULL,
	"severity" text NOT NULL,
	"confidence" numeric(3, 2) NOT NULL,
	"classifier_output" jsonb NOT NULL,
	"escalation_rendered" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "safety_flags_category_check" CHECK ("safety_flags"."category" IN (
        'caregiver_self_harm', 'cr_in_danger', 'elder_abuse', 'dangerous_request',
        'medical_emergency', 'financial_exploitation'
      )),
	CONSTRAINT "safety_flags_severity_check" CHECK ("safety_flags"."severity" IN ('low', 'medium', 'high', 'emergency')),
	CONSTRAINT "safety_flags_confidence_check" CHECK ("safety_flags"."confidence" >= 0 AND "safety_flags"."confidence" <= 1)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cognito_sub" text NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_cognito_sub_unique" UNIQUE("cognito_sub")
);
--> statement-breakpoint
ALTER TABLE "care_profile" ADD CONSTRAINT "care_profile_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "module_chunks" ADD CONSTRAINT "module_chunks_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_flags" ADD CONSTRAINT "safety_flags_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_flags" ADD CONSTRAINT "safety_flags_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_flags" ADD CONSTRAINT "safety_flags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversations_user_id_updated_at_idx" ON "conversations" USING btree ("user_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "module_chunks_module_id_idx" ON "module_chunks" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "module_chunks_metadata_gin" ON "module_chunks" USING gin ("metadata");--> statement-breakpoint
CREATE INDEX "module_chunks_embedding_hnsw" ON "module_chunks" USING hnsw ("embedding" vector_cosine_ops) WITH (m=16,ef_construction=64);--> statement-breakpoint
CREATE INDEX "modules_category_tier_published_idx" ON "modules" USING btree ("category","tier","published");--> statement-breakpoint
CREATE INDEX "safety_flags_user_id_created_at_idx" ON "safety_flags" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "safety_flags_category_created_at_idx" ON "safety_flags" USING btree ("category","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON "users"
  FOR EACH ROW
  EXECUTE FUNCTION hypercare_set_updated_at();
--> statement-breakpoint
CREATE TRIGGER care_profile_set_updated_at
  BEFORE UPDATE ON "care_profile"
  FOR EACH ROW
  EXECUTE FUNCTION hypercare_set_updated_at();
--> statement-breakpoint
CREATE TRIGGER conversations_set_updated_at
  BEFORE UPDATE ON "conversations"
  FOR EACH ROW
  EXECUTE FUNCTION hypercare_set_updated_at();
--> statement-breakpoint
CREATE TRIGGER modules_set_updated_at
  BEFORE UPDATE ON "modules"
  FOR EACH ROW
  EXECUTE FUNCTION hypercare_set_updated_at();