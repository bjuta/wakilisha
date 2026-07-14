BEGIN;

CREATE TABLE IF NOT EXISTS entity_resolution_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingest_run_id uuid REFERENCES chart_ingest_runs(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'completed',
  total_rows integer NOT NULL DEFAULT 0,
  resolved_count integer NOT NULL DEFAULT 0,
  review_count integer NOT NULL DEFAULT 0,
  shell_count integer NOT NULL DEFAULT 0,
  duplicate_candidate_count integer NOT NULL DEFAULT 0,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS entity_resolution_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resolution_run_id uuid REFERENCES entity_resolution_runs(id) ON DELETE CASCADE,
  ingest_run_id uuid REFERENCES chart_ingest_runs(id) ON DELETE CASCADE,
  ingest_row_id uuid REFERENCES chart_ingest_rows(id) ON DELETE SET NULL,
  entity_kind text NOT NULL,
  source_id text NOT NULL,
  source_label text NOT NULL,
  status text NOT NULL,
  canonical_entity_id uuid,
  shell_entity_id text,
  confidence numeric(5,4) NOT NULL DEFAULT 0,
  review_required boolean NOT NULL DEFAULT false,
  candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  decided_by text,
  decided_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS entity_resolution_separation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  left_entity_kind text NOT NULL,
  left_entity_id text NOT NULL,
  right_entity_kind text NOT NULL,
  right_entity_id text NOT NULL,
  reason text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (left_entity_kind, left_entity_id, right_entity_kind, right_entity_id)
);

CREATE TABLE IF NOT EXISTS entity_resolution_manual_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_kind text NOT NULL,
  source_fingerprint text NOT NULL,
  canonical_entity_id uuid,
  action text NOT NULL,
  confidence numeric(5,4),
  note text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_kind, source_fingerprint, action)
);

CREATE INDEX IF NOT EXISTS idx_entity_resolution_decisions_run ON entity_resolution_decisions(ingest_run_id, entity_kind, status);
CREATE INDEX IF NOT EXISTS idx_entity_resolution_decisions_review ON entity_resolution_decisions(review_required, status);
CREATE INDEX IF NOT EXISTS idx_entity_resolution_separation_left ON entity_resolution_separation_rules(left_entity_kind, left_entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_resolution_manual_overrides_source ON entity_resolution_manual_overrides(source_kind, source_fingerprint);

COMMIT;
