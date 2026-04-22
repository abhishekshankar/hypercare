ALTER TABLE "messages" ADD COLUMN "citations" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "refusal" jsonb;