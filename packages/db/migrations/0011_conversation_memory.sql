CREATE TABLE "conversation_memory" (
	"conversation_id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"summary_md" text NOT NULL,
	"summary_tokens" integer NOT NULL,
	"last_refreshed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"refresh_count" integer DEFAULT 0 NOT NULL,
	"invalidated" boolean DEFAULT false NOT NULL,
	"source_message_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversation_memory" ADD CONSTRAINT "conversation_memory_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_memory" ADD CONSTRAINT "conversation_memory_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversation_memory_user_id_idx" ON "conversation_memory" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "conversation_memory_user_id_invalidated_idx" ON "conversation_memory" USING btree ("user_id","invalidated");
