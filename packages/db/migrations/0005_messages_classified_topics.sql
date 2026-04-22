ALTER TABLE "messages" ADD COLUMN "classified_topics" jsonb NOT NULL DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "topic_confidence" real;--> statement-breakpoint
