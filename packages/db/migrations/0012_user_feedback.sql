-- TASK-036: in-app feedback + thumbs-down queue
CREATE TABLE "user_feedback" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "body" text,
  "conversation_id" uuid,
  "message_id" uuid,
  "include_context" boolean DEFAULT false NOT NULL,
  "submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "triage_state" text DEFAULT 'new' NOT NULL,
  "triage_priority" text DEFAULT 'normal' NOT NULL,
  "triaged_by" uuid,
  "triaged_at" timestamp with time zone,
  "resolution_note" text,
  "linked_module_id" uuid,
  "linked_task_id" text
);
--> statement-breakpoint
ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_triaged_by_users_id_fk" FOREIGN KEY ("triaged_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_linked_module_id_modules_id_fk" FOREIGN KEY ("linked_module_id") REFERENCES "public"."modules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_kind_check" CHECK ("kind" IN ('off_reply','not_found','suggestion','other','thumbs_down'));--> statement-breakpoint
ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_triage_state_check" CHECK ("triage_state" IN ('new','reading','needs_content_fix','needs_classifier_fix','needs_product_fix','ack_and_close','spam_or_invalid'));--> statement-breakpoint
ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_triage_priority_check" CHECK ("triage_priority" IN ('normal','high'));--> statement-breakpoint
CREATE INDEX "user_feedback_triage_idx" ON "user_feedback" USING btree ("triage_state","submitted_at");--> statement-breakpoint
CREATE INDEX "user_feedback_submitted_at_idx" ON "user_feedback" USING btree ("submitted_at" DESC);--> statement-breakpoint
CREATE UNIQUE INDEX "user_feedback_thumbs_one_per_message" ON "user_feedback" ("message_id") WHERE "kind" = 'thumbs_down' AND "message_id" IS NOT NULL;
