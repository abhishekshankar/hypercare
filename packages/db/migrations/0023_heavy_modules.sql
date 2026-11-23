-- HERMES-01: heavy module bundles (branches, tools, relations) + module_evidence grounding fields.
-- Idempotent: safe to re-run.

ALTER TABLE modules ADD COLUMN IF NOT EXISTS heavy boolean NOT NULL DEFAULT false;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS bundle_version integer NOT NULL DEFAULT 1;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS srs_suitable boolean DEFAULT true;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS srs_difficulty_bucket smallint;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS weeks_focus_eligible boolean DEFAULT true;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS soft_flag_companion_for jsonb DEFAULT '[]'::jsonb;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS secondary_topics jsonb DEFAULT '[]'::jsonb;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS primary_topics jsonb DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS module_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  stage_key text NOT NULL,
  relationship_key text NOT NULL,
  living_situation_key text NOT NULL,
  body_md text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT module_branches_stage_key_check CHECK (
    stage_key IN ('early','middle','late','any')
  ),
  CONSTRAINT module_branches_relationship_key_check CHECK (
    relationship_key IN ('parent','spouse','sibling','in_law','other','any')
  ),
  CONSTRAINT module_branches_living_situation_key_check CHECK (
    living_situation_key IN (
      'with_caregiver','alone','with_other_family','assisted_living','memory_care','nursing_home','any'
    )
  ),
  CONSTRAINT module_branches_module_axes_unique UNIQUE (module_id, stage_key, relationship_key, living_situation_key)
);

CREATE INDEX IF NOT EXISTS module_branches_module_lookup_idx
  ON module_branches (module_id, stage_key, relationship_key, living_situation_key);

CREATE TABLE IF NOT EXISTS module_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  tool_type text NOT NULL,
  slug text NOT NULL,
  title text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT module_tools_type_check CHECK (
    tool_type IN ('decision_tree','checklist','script','template','flowchart')
  ),
  CONSTRAINT module_tools_module_slug_unique UNIQUE (module_id, slug)
);

CREATE INDEX IF NOT EXISTS module_tools_module_id_idx ON module_tools (module_id);

CREATE TABLE IF NOT EXISTS module_relations (
  from_module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  to_module_id uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  relation_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT module_relations_type_check CHECK (
    relation_type IN ('prerequisite','follow_up','deeper','contradicts','soft_flag_companion')
  ),
  CONSTRAINT module_relations_pk PRIMARY KEY (from_module_id, to_module_id, relation_type)
);

CREATE INDEX IF NOT EXISTS module_relations_from_idx ON module_relations (from_module_id, relation_type);

ALTER TABLE module_evidence ADD COLUMN IF NOT EXISTS quoted_excerpt text;
ALTER TABLE module_evidence ADD COLUMN IF NOT EXISTS url_snapshot text;
ALTER TABLE module_evidence ADD COLUMN IF NOT EXISTS claim_anchor text;

CREATE INDEX IF NOT EXISTS module_evidence_module_claim_idx ON module_evidence (module_id, claim_anchor);

-- Hermes wave-1 topic slugs (closed vocabulary extension; FK targets for module_topics).
INSERT INTO topics (slug, category, display_name) VALUES
  ('new-diagnosis', 'medical', 'New diagnosis'),
  ('early-stage', 'medical', 'Early stage'),
  ('ambiguous-grief', 'caring_for_yourself', 'Ambiguous grief'),
  ('advance-planning', 'legal_financial', 'Advance planning'),
  ('blood-biomarkers', 'medical', 'Blood biomarkers'),
  ('guide-model', 'legal_financial', 'CMS GUIDE model'),
  ('delirium-basics', 'medical', 'Delirium basics')
ON CONFLICT (slug) DO NOTHING;
