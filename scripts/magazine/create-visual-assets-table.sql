-- WAKILISHA Magazine visual asset persistence
-- Run against the production/staging Postgres database used by the WAKILISHA V2 API.

CREATE TABLE IF NOT EXISTS wk_magazine_visual_assets (
  id text PRIMARY KEY,
  issue_id text NOT NULL,
  issue_slug text,
  spread_id text NOT NULL,
  article_id text,
  visual_family text NOT NULL,
  visual_type text NOT NULL,
  editorial_intent text NOT NULL,
  treatment text NOT NULL,
  palette text NOT NULL,
  contrast_mode text NOT NULL,
  visual_brief_json jsonb NOT NULL,
  status text NOT NULL DEFAULT 'generated' CHECK (status IN ('draft', 'generated', 'approved', 'rejected', 'locked')),
  notes text,
  created_by text NOT NULL DEFAULT 'Muiruri Beautah',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by text,
  locked_at timestamptz,
  locked_by text,
  rejected_at timestamptz,
  rejected_by text
);

CREATE INDEX IF NOT EXISTS idx_wk_magazine_visual_assets_issue_id ON wk_magazine_visual_assets(issue_id);
CREATE INDEX IF NOT EXISTS idx_wk_magazine_visual_assets_issue_slug ON wk_magazine_visual_assets(issue_slug);
CREATE INDEX IF NOT EXISTS idx_wk_magazine_visual_assets_spread_id ON wk_magazine_visual_assets(spread_id);
CREATE INDEX IF NOT EXISTS idx_wk_magazine_visual_assets_status ON wk_magazine_visual_assets(status);
CREATE INDEX IF NOT EXISTS idx_wk_magazine_visual_assets_updated_at ON wk_magazine_visual_assets(updated_at DESC);

CREATE OR REPLACE FUNCTION wk_magazine_visual_assets_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_wk_magazine_visual_assets_touch_updated_at ON wk_magazine_visual_assets;
CREATE TRIGGER trg_wk_magazine_visual_assets_touch_updated_at
BEFORE UPDATE ON wk_magazine_visual_assets
FOR EACH ROW
EXECUTE FUNCTION wk_magazine_visual_assets_touch_updated_at();
