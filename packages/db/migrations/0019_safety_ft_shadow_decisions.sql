-- TASK-039: shadow comparison rows (no raw text; ADR 0021) + feedback safety re-labels.

CREATE TABLE safety_ft_shadow_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  text_hash text NOT NULL,
  zero_shot_verdict jsonb NOT NULL,
  fine_tuned_verdict jsonb NOT NULL,
  zero_shot_latency_ms integer NOT NULL,
  fine_tuned_latency_ms integer NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX safety_ft_shadow_observed_at_idx ON safety_ft_shadow_decisions (observed_at DESC);

COMMENT ON TABLE safety_ft_shadow_decisions IS 'Layer-B zero-shot vs fine-tuned shadow comparisons (TASK-039); 30-day retention.';

ALTER TABLE user_feedback
  ADD COLUMN safety_relabel text;

ALTER TABLE user_feedback
  ADD CONSTRAINT user_feedback_safety_relabel_check CHECK (
    safety_relabel IS NULL
    OR safety_relabel IN (
      'crisis_self_harm',
      'crisis_recipient_safety',
      'crisis_external',
      'gray_zone',
      'safe_self_care',
      'safe_factual'
    )
  );
