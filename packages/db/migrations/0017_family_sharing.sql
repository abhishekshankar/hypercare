-- TASK-038: family sharing — care_profile_members, invite_tokens, audit changed_by

CREATE TABLE "care_profile_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"care_profile_id" uuid NOT NULL,
	"user_id" uuid,
	"invitee_email" text,
	"role" text NOT NULL,
	"invited_by" uuid NOT NULL,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"removed_at" timestamp with time zone,
	"share_conversations_with_other_members" boolean DEFAULT false NOT NULL,
	"share_saved_answers_with_other_members" boolean DEFAULT false NOT NULL,
	CONSTRAINT "care_profile_members_role_check" CHECK ("role" IN ('owner', 'co_caregiver')),
	CONSTRAINT "care_profile_members_state_check" CHECK (
		("role" = 'owner' AND "user_id" IS NOT NULL AND "accepted_at" IS NOT NULL AND "invitee_email" IS NULL)
		OR ("role" = 'co_caregiver' AND "accepted_at" IS NOT NULL AND "user_id" IS NOT NULL AND "invitee_email" IS NULL)
		OR ("role" = 'co_caregiver' AND "accepted_at" IS NULL AND "user_id" IS NULL AND "invitee_email" IS NOT NULL)
	)
);
--> statement-breakpoint
ALTER TABLE "care_profile_members" ADD CONSTRAINT "care_profile_members_care_profile_id_care_profile_id_fk" FOREIGN KEY ("care_profile_id") REFERENCES "public"."care_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_profile_members" ADD CONSTRAINT "care_profile_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_profile_members" ADD CONSTRAINT "care_profile_members_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "care_profile_members_user_id_idx" ON "care_profile_members" USING btree ("user_id") WHERE "removed_at" IS NULL AND "accepted_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "care_profile_members_care_profile_id_idx" ON "care_profile_members" USING btree ("care_profile_id") WHERE "removed_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "care_profile_members_one_owner_uk" ON "care_profile_members" ("care_profile_id") WHERE "removed_at" IS NULL AND "role" = 'owner';--> statement-breakpoint
CREATE UNIQUE INDEX "care_profile_members_active_user_uk" ON "care_profile_members" ("care_profile_id", "user_id") WHERE "removed_at" IS NULL AND "user_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "care_profile_members_pending_email_uk" ON "care_profile_members" ("care_profile_id", "invitee_email") WHERE "removed_at" IS NULL AND "accepted_at" IS NULL AND "invitee_email" IS NOT NULL;--> statement-breakpoint

CREATE TABLE "invite_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"care_profile_member_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"personal_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "invite_tokens" ADD CONSTRAINT "invite_tokens_care_profile_member_id_care_profile_members_id_fk" FOREIGN KEY ("care_profile_member_id") REFERENCES "public"."care_profile_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invite_tokens_member_created_idx" ON "invite_tokens" USING btree ("care_profile_member_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX "invite_tokens_token_hash_active_idx" ON "invite_tokens" USING btree ("token_hash") WHERE "consumed_at" IS NULL;

--> statement-breakpoint
ALTER TABLE "care_profile_changes" ADD COLUMN "changed_by" uuid;
--> statement-breakpoint
UPDATE "care_profile_changes" SET "changed_by" = "user_id" WHERE "changed_by" IS NULL;
--> statement-breakpoint
ALTER TABLE "care_profile_changes" ALTER COLUMN "changed_by" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "care_profile_changes" ADD CONSTRAINT "care_profile_changes_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
INSERT INTO "care_profile_members" (
	"care_profile_id",
	"user_id",
	"invitee_email",
	"role",
	"invited_by",
	"invited_at",
	"accepted_at",
	"share_conversations_with_other_members",
	"share_saved_answers_with_other_members"
)
SELECT
	cp."id",
	cp."user_id",
	NULL,
	'owner',
	cp."user_id",
	cp."created_at",
	cp."created_at",
	false,
	false
FROM "care_profile" cp
WHERE NOT EXISTS (
	SELECT 1
	FROM "care_profile_members" m
	WHERE m."care_profile_id" = cp."id"
		AND m."role" = 'owner'
		AND m."removed_at" IS NULL
);
