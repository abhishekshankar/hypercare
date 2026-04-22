-- TASK-028: content authoring workflow, briefs, evidence, reviews, versions, transitions, user roles

-- ---------------------------------------------------------------------------
-- User roles (internal tool + default caregiver)
-- ---------------------------------------------------------------------------
ALTER TABLE "users" ADD COLUMN "role" text NOT NULL DEFAULT 'caregiver'
  CONSTRAINT "users_role_check" CHECK ("role" IN (
    'caregiver', 'content_writer', 'content_lead', 'medical_director',
    'care_specialist', 'caregiver_support_clinician', 'lived_experience_reviewer', 'admin'
  ));

-- ---------------------------------------------------------------------------
-- module_briefs (queue — content plan + refusal path)
-- ---------------------------------------------------------------------------
CREATE TABLE "module_briefs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "topic" text NOT NULL,
  "audience" text NOT NULL,
  "stage_relevance" text[] NOT NULL DEFAULT '{}',
  "desired_outcome" text NOT NULL,
  "proposed_title" text,
  "queue_reason" text NOT NULL DEFAULT 'content_plan',
  "created_by" uuid REFERENCES "public"."users"("id") ON DELETE set null,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "status" text NOT NULL DEFAULT 'open',
  "claimed_by" uuid REFERENCES "public"."users"("id") ON DELETE set null,
  CONSTRAINT "module_briefs_queue_reason_check" CHECK ("queue_reason" IN ('content_plan', 'refusal_path', 'user_request')),
  CONSTRAINT "module_briefs_status_check" CHECK ("status" IN ('open', 'claimed', 'drafted', 'rejected'))
);

CREATE INDEX "module_briefs_status_created_at_idx" ON "module_briefs" ("status", "created_at" DESC);

-- ---------------------------------------------------------------------------
-- modules: workflow + assignments (brief_id after module_briefs exists)
-- ---------------------------------------------------------------------------
ALTER TABLE "modules" ADD COLUMN "draft_status" text NOT NULL DEFAULT 'draft'
  CONSTRAINT "modules_draft_status_check" CHECK ("draft_status" IN (
    'draft', 'content_lead_review', 'expert_review', 'lived_experience_review',
    'approved', 'published', 'retired'
  ));
ALTER TABLE "modules" ADD COLUMN "assigned_expert_reviewer_id" uuid REFERENCES "public"."users"("id") ON DELETE set null;
ALTER TABLE "modules" ADD COLUMN "assigned_lived_reviewer_id" uuid REFERENCES "public"."users"("id") ON DELETE set null;
ALTER TABLE "modules" ADD COLUMN "brief_id" uuid REFERENCES "public"."module_briefs"("id") ON DELETE set null;
ALTER TABLE "modules" ADD COLUMN "last_published_at" timestamptz;

UPDATE "modules" SET "draft_status" = 'published' WHERE "published" = true;
UPDATE "modules" SET "draft_status" = 'draft' WHERE "published" = false;

CREATE INDEX "modules_draft_status_idx" ON "modules" ("draft_status");
CREATE INDEX "modules_brief_id_idx" ON "modules" ("brief_id") WHERE "brief_id" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- module_state_transitions (append-only audit)
-- ---------------------------------------------------------------------------
CREATE TABLE "module_state_transitions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "module_id" uuid NOT NULL REFERENCES "public"."modules"("id") ON DELETE cascade,
  "from_status" text NOT NULL,
  "to_status" text NOT NULL,
  "by_user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade,
  "reason" text,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX "module_state_transitions_module_id_idx" ON "module_state_transitions" ("module_id", "created_at" DESC);

-- ---------------------------------------------------------------------------
-- module_evidence
-- ---------------------------------------------------------------------------
CREATE TABLE "module_evidence" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "module_id" uuid NOT NULL REFERENCES "public"."modules"("id") ON DELETE cascade,
  "source_tier" int NOT NULL,
  "source_type" text NOT NULL,
  "citation" text NOT NULL,
  "url" text,
  "quoted_support" text,
  "added_by" uuid REFERENCES "public"."users"("id") ON DELETE set null,
  "added_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "module_evidence_source_tier_check" CHECK ("source_tier" IN (1, 2, 3)),
  CONSTRAINT "module_evidence_source_type_check" CHECK ("source_type" IN ('url', 'book', 'paper', 'intervention', 'pac'))
);

CREATE INDEX "module_evidence_module_id_idx" ON "module_evidence" ("module_id");

-- ---------------------------------------------------------------------------
-- module_reviews
-- ---------------------------------------------------------------------------
CREATE TABLE "module_reviews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "module_id" uuid NOT NULL REFERENCES "public"."modules"("id") ON DELETE cascade,
  "reviewer_user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade,
  "review_role" text NOT NULL,
  "verdict" text NOT NULL,
  "comments_md" text,
  "reviewed_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "module_reviews_role_check" CHECK ("review_role" IN (
    'content_lead', 'medical_director', 'care_specialist',
    'caregiver_support_clinician', 'lived_experience', 'domain_sme'
  )),
  CONSTRAINT "module_reviews_verdict_check" CHECK ("verdict" IN ('approve', 'reject', 'request_changes'))
);

CREATE INDEX "module_reviews_module_id_idx" ON "module_reviews" ("module_id", "reviewed_at" DESC);

-- ---------------------------------------------------------------------------
-- module_versions (publish snapshots)
-- ---------------------------------------------------------------------------
CREATE TABLE "module_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "module_id" uuid NOT NULL REFERENCES "public"."modules"("id") ON DELETE cascade,
  "version" int NOT NULL,
  "body_md" text NOT NULL,
  "try_this_today" text,
  "summary" text,
  "published_at" timestamptz DEFAULT now() NOT NULL,
  "published_by" uuid REFERENCES "public"."users"("id") ON DELETE set null,
  CONSTRAINT "module_versions_module_id_version_unique" UNIQUE ("module_id", "version")
);

CREATE INDEX "module_versions_module_id_idx" ON "module_versions" ("module_id", "version" DESC);
