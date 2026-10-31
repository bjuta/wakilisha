-- IMPLEMENTATION DRAFT ONLY. Not a migration: generate the canonical migration
-- path with `supabase migration new chart_full_filter_decision_execution_v1`
-- in the repository's accepted Supabase CLI before adding this SQL to a PR.
-- Unapplied: no connected database changes have been made.
-- Security: invoker executes under existing caller JWT / RLS with manage_ingest.
-- This atomic procedure persists NON-AUTHORIZING eligibility decisions ONLY;
-- it cannot produce an eligible/scoreable run or publish a chart edition.
BEGIN;

CREATE OR REPLACE FUNCTION public.chart_apply_full_filter_decisions_v1(
  p_run_id text,
  p_expected_run_updated_at timestamptz,
  p_policy jsonb,
  p_decisions jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth
AS $function$
DECLARE
  v_run public.chart_ingest_runs%ROWTYPE;
  v_candidate public.chart_ingest_candidates%ROWTYPE;
  v_row jsonb;
  v_candidate_id text;
  v_status text;
  v_decision jsonb;
  v_index integer;
  v_expected_count integer;
  v_total integer;
  v_score_count integer;
  v_now timestamptz := statement_timestamp();
  v_seen text[] := ARRAY[]::text[];
BEGIN
  -- Under SECURITY INVOKER these are mandatory existing RLS authorities:
  -- manage_charts for candidate/run/stage UPDATE and score/exclusion DELETE;
  -- view_charts_admin for complete reads; view_registry for the full
  -- non-public canonical metadata read in the caller-scoped stage.
  -- Do NOT broaden table RLS policies or substitute service_role.
  IF auth.uid() IS NULL OR
     coalesce(public.current_user_has_capability('manage_ingest'),false) IS NOT TRUE OR
     coalesce(public.current_user_has_capability('manage_charts'),false) IS NOT TRUE OR
     coalesce(public.current_user_has_capability('view_charts_admin'),false) IS NOT TRUE OR
     coalesce(public.current_user_has_capability('view_registry'),false) IS NOT TRUE THEN
    RAISE EXCEPTION 'full-filter requires ingest, chart write/read and Registry read capabilities' USING ERRCODE='42501';
  END IF;
  IF p_run_id IS NULL OR p_expected_run_updated_at IS NULL OR
     p_policy IS NULL OR jsonb_typeof(p_policy) <> 'object' OR
     p_decisions IS NULL OR jsonb_typeof(p_decisions) <> 'array' THEN
    RAISE EXCEPTION 'invalid full-filter transaction input' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_run FROM public.chart_ingest_runs
   WHERE id=p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ingest run unavailable' USING ERRCODE='22023'; END IF;
  IF v_run.updated_at IS DISTINCT FROM p_expected_run_updated_at THEN
    RAISE EXCEPTION 'ingest run changed during eligibility read' USING ERRCODE='40001';
  END IF;
  IF v_run.status IS NULL OR v_run.status NOT IN (
       'draft','queued','running','preflight_passed','fetching','normalizing',
       'scoring','reviewing','dry_run_complete','needs_review','failed',
       'source_fetch_failed') THEN
    RAISE EXCEPTION 'terminal ingest run cannot re-evaluate' USING ERRCODE='22023';
  END IF;
  IF (v_run.rule_snapshot_json->'ingestPolicy') IS DISTINCT FROM p_policy OR
     p_policy->>'contractVersion' IS DISTINCT FROM 'chart-ingest-full-filter-snapshot/v1' OR
     p_policy->>'evaluatorState' IS DISTINCT FROM 'PENDING_FULL_FILTER_EVALUATOR' OR
     coalesce(length(p_policy->>'sha256'),0) <> 64 THEN
    RAISE EXCEPTION 'frozen rule snapshot mismatch' USING ERRCODE='22023';
  END IF;
  v_expected_count := jsonb_array_length(p_decisions);
  SELECT count(*) INTO v_total FROM public.chart_ingest_candidates WHERE run_id=p_run_id;
  IF v_expected_count = 0 OR v_expected_count > 500 OR v_expected_count <> v_total THEN
    RAISE EXCEPTION 'candidate-set cardinality mismatch' USING ERRCODE='22023';
  END IF;
  -- Lock ALL candidates before any changes; reject stale revisions and duplicates.
  FOR v_index IN 0..v_expected_count-1 LOOP
    v_row := p_decisions->v_index;
    v_candidate_id := v_row->>'candidateId';
    v_status := v_row->>'status';
    v_decision := v_row->'decision';
    IF v_candidate_id IS NULL OR v_candidate_id = ANY(v_seen) OR
       (v_status IS NULL OR v_status NOT IN ('excluded','needs_review','ignored')) OR
       jsonb_typeof(v_decision) IS DISTINCT FROM 'object' OR
       v_decision->>'contract' <> 'chart-ingest-full-filter-decision/v1' OR
       v_decision->>'status' IS DISTINCT FROM v_status OR
       v_decision->>'policyDigest' IS DISTINCT FROM p_policy->>'sha256' OR
       v_decision->'canScore' IS DISTINCT FROM 'false'::jsonb OR
       v_decision->'canPublish' IS DISTINCT FROM 'false'::jsonb THEN
      RAISE EXCEPTION 'unsafe or duplicate candidate decision' USING ERRCODE='22023';
    END IF;
    v_seen := array_append(v_seen,v_candidate_id);
    SELECT * INTO v_candidate FROM public.chart_ingest_candidates
      WHERE id=v_candidate_id AND run_id=p_run_id FOR UPDATE;
    IF NOT FOUND OR v_candidate.updated_at IS DISTINCT FROM (v_row->>'expectedUpdatedAt')::timestamptz THEN
      RAISE EXCEPTION 'candidate row changed or unavailable' USING ERRCODE='40001';
    END IF;
    IF v_candidate.status='committed' THEN
      RAISE EXCEPTION 'committed candidate cannot be re-evaluated' USING ERRCODE='22023';
    END IF;
    IF v_candidate.status<>'ignored' AND v_status='ignored' THEN
      RAISE EXCEPTION 'ignored state cannot be fabricated' USING ERRCODE='22023';
    END IF;
    IF v_candidate.status='excluded' AND v_status='needs_review' THEN
      RAISE EXCEPTION 'excluded candidate requires explicit reset' USING ERRCODE='22023';
    END IF;
    IF v_candidate.status='ignored' AND v_status<>'ignored' THEN
      RAISE EXCEPTION 'ignored candidate may not be revived' USING ERRCODE='22023';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.chart_ingest_exclusions e
      WHERE e.run_id=p_run_id AND e.candidate_id=v_candidate_id
        AND (e.reason_code='manual_exclude' OR
             coalesce(e.source_stage,'') NOT IN ('eligibility','eligibility_execution','shortlist'))
    ) AND v_status<>'excluded' THEN
      RAISE EXCEPTION 'protected exclusion may not be revived' USING ERRCODE='22023';
    END IF;
  END LOOP;
  -- Every candidate is covered and locked; no JSON decisions from another run.
  UPDATE public.chart_ingest_candidates c SET
    status = r.item->>'status',
    eligibility_decision_json = r.item->'decision',
    updated_at = v_now
  FROM jsonb_array_elements(p_decisions) AS r(item)
  WHERE c.run_id=p_run_id AND c.id=r.item->>'candidateId';
  GET DIAGNOSTICS v_total = ROW_COUNT;
  IF v_total <> v_expected_count THEN
    RAISE EXCEPTION 'candidate disposition update incomplete' USING ERRCODE='42501';
  END IF;
  -- Retire *only* stale eligibility/shortlist exclusions, never normalization,
  -- manual editorial exclusions or independent security decisions.
  DELETE FROM public.chart_ingest_exclusions
    WHERE run_id=p_run_id AND source_stage IN
      ('eligibility','eligibility_execution','shortlist')
      AND reason_code<>'manual_exclude';
  -- A rerun must invalidate EVERY downstream derived score and stage in the
  -- same DB transaction. Existing chart publication remains independently gated.
  DELETE FROM public.chart_ingest_candidate_scores WHERE run_id=p_run_id;
  SELECT count(*) INTO v_score_count FROM public.chart_ingest_candidate_scores WHERE run_id=p_run_id;
  IF v_score_count <> 0 THEN
    RAISE EXCEPTION 'stale candidate score remains' USING ERRCODE='42501';
  END IF;
  UPDATE public.chart_ingest_stage_events SET
    status='idle', started_at=NULL,finished_at=NULL,duration_ms=NULL,
    message='Reset after full-filter eligibility decisions',
    error_code=NULL,error_message=NULL,metrics_json='{}'::jsonb
  WHERE run_id=p_run_id AND stage IN
    ('methodology_scoring','anti_gaming','shortlist','review_gate',
     'commit_validate','commit_write','public_verify');
  UPDATE public.chart_ingest_stage_events SET
    status='warning',finished_at=v_now,
    message='Full filter decisions persisted; review and source-period acceptance required',
    metrics_json=jsonb_build_object('contract','chart-ingest-full-filter-decision/v1',
      'candidateCount',v_expected_count,'canScore',false,'canCommit',false)
  WHERE run_id=p_run_id AND stage='eligibility_execution';
  UPDATE public.chart_ingest_runs SET status='needs_review',updated_at=v_now
    WHERE id=p_run_id;
  RETURN jsonb_build_object('ok',true,'decisionCount',v_expected_count,
    'canScore',false,'canCommit',false,'canPublish',false);
END;
$function$;

REVOKE ALL ON FUNCTION public.chart_apply_full_filter_decisions_v1(text,timestamptz,jsonb,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.chart_apply_full_filter_decisions_v1(text,timestamptz,jsonb,jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.chart_apply_full_filter_decisions_v1(text,timestamptz,jsonb,jsonb) TO authenticated;

-- The installed reset wrapper historically delegates to a helper that marks
-- every candidate ELIGIBLE. That is forbidden for frozen full-filter runs.
-- This replacement retains the wrapper's security/capability boundary and the
-- legacy path only for runs that predate ingestPolicy snapshot v1.
CREATE OR REPLACE FUNCTION public.chart_reset_run_after_origin_resolution_v1(
  p_run_id text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $reset$
DECLARE
  v_run public.chart_ingest_runs%ROWTYPE;
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT (
       coalesce(public.current_user_has_capability('manage_ingest'),false)
       OR public.current_user_is_administrator()
     ) THEN
    RAISE EXCEPTION 'manage_ingest is required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_run FROM public.chart_ingest_runs WHERE id=p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ingest run not found' USING ERRCODE='22023'; END IF;
  IF v_run.status IS NULL OR v_run.status NOT IN (
       'draft','queued','running','preflight_passed','fetching','normalizing',
       'scoring','reviewing','dry_run_complete','needs_review','failed',
       'source_fetch_failed') THEN
    RAISE EXCEPTION 'terminal run cannot reset full filter decisions' USING ERRCODE='22023';
  END IF;
  -- Retired/unfrozen runs are NEVER delegated to the legacy reset helper.
  IF EXISTS (SELECT 1 FROM public.chart_ingest_candidates
             WHERE run_id=p_run_id AND status='committed') THEN
    RAISE EXCEPTION 'committed candidate cannot be reset' USING ERRCODE='22023';
  END IF;
  -- Frozen eligibility rewrites need the SAME four effective capabilities as
  -- chart_apply_full_filter_decisions_v1. This SECURITY DEFINER wrapper would
  -- otherwise bypass chart write/read and Registry RLS for an ingest-only actor.
  -- Preserve the exact historical manage_ingest reset contract for unfrozen runs.
  IF v_run.rule_snapshot_json ? 'ingestPolicy' AND NOT (
       coalesce(public.current_user_has_capability('manage_charts'),false) IS TRUE
       AND coalesce(public.current_user_has_capability('view_charts_admin'),false) IS TRUE
       AND coalesce(public.current_user_has_capability('view_registry'),false) IS TRUE
     ) THEN
    RAISE EXCEPTION 'frozen origin reset requires chart write/read and Registry read capabilities' USING ERRCODE='42501';
  END IF;
  IF NOT (v_run.rule_snapshot_json ? 'ingestPolicy') THEN
    RETURN public.chart_reset_run_after_origin_resolution(p_run_id);
  END IF;
  -- Full policy was frozen: metadata repair is NOT evidence of eligibility.
  UPDATE public.chart_ingest_candidates c SET
    status=CASE
      WHEN c.status='ignored' THEN 'ignored'
      WHEN EXISTS (
        SELECT 1 FROM public.chart_ingest_exclusions e
        WHERE e.run_id=p_run_id AND e.candidate_id=c.id
          AND (e.reason_code='manual_exclude' OR
               coalesce(e.source_stage,'') NOT IN ('eligibility','eligibility_execution','shortlist'))
      ) THEN 'excluded'
      ELSE 'needs_review'
    END,
    eligibility_decision_json='{}'::jsonb,
    updated_at=statement_timestamp()
  WHERE c.run_id=p_run_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  DELETE FROM public.chart_ingest_candidate_scores WHERE run_id=p_run_id;
  DELETE FROM public.chart_ingest_exclusions WHERE run_id=p_run_id
    AND source_stage IN ('eligibility','eligibility_execution','shortlist')
    AND reason_code<>'manual_exclude';
  UPDATE public.chart_ingest_stage_events SET
    status='idle',message=NULL,error_code=NULL,error_message=NULL,
    metrics_json='{}'::jsonb,started_at=NULL,finished_at=NULL,duration_ms=NULL
  WHERE run_id=p_run_id AND stage IN
    ('eligibility_execution','methodology_scoring','anti_gaming',
     'shortlist','review_gate','commit_validate','commit_write','public_verify');
  UPDATE public.chart_ingest_runs SET status='needs_review',updated_at=statement_timestamp()
    WHERE id=p_run_id;
  RETURN jsonb_build_object('runId',p_run_id,'candidateRowsReset',v_count,
    'fullFilterDecisionsInvalidated',true,'canScore',false,'canCommit',false);
END;
$reset$;

REVOKE ALL ON FUNCTION public.chart_reset_run_after_origin_resolution_v1(text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.chart_reset_run_after_origin_resolution_v1(text) TO authenticated;

-- Complete caller-scoped Registry read for authorised Registry stewards only.
-- Existing public SELECT continues to expose *matched* links; this additional
-- RLS branch permits holders of existing view_registry authority to see
-- needs_review/rejected/unavailable/stale records for evidence review.
-- No table GRANT, role assignment or broad authenticated access is introduced.
-- Review this access change in nonproduction before repository promotion.
CREATE POLICY wk100_registry_track_provider_links_admin_review_read_v1
ON public.registry_track_provider_links
FOR SELECT TO authenticated
USING (
  public.current_user_has_capability('view_registry')
  OR public.current_user_is_administrator()
);


-- WAKILISHA 100: durable, per-EAT-week Admin configuration.
-- Not a publisher or score authority. This store is private and versioned.
-- The existing CLI-generated migration path is retained. All preceding
-- Phase 2 decisions and RLS statements are unchanged.
CREATE TABLE platform_private.wk100_admin_weekly_drafts_v1 (
  week_start_eat date PRIMARY KEY CHECK (extract(isodow from week_start_eat)=1),
  revision bigint NOT NULL CHECK (revision >= 1),
  config_json jsonb NOT NULL CHECK (jsonb_typeof(config_json)='object'),
  config_sha256 text NOT NULL CHECK (config_sha256 ~ '^[a-f0-9]{64}),
  updated_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE platform_private.wk100_admin_weekly_drafts_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON platform_private.wk100_admin_weekly_drafts_v1 FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE platform_private.wk100_admin_draft_revisions_v1 (
  week_start_eat date NOT NULL,
  revision bigint NOT NULL CHECK (revision >= 1),
  config_sha256 text NOT NULL CHECK (config_sha256 ~ '^[a-f0-9]{64}),
  config_json jsonb NOT NULL CHECK (jsonb_typeof(config_json)='object'),
  saved_by uuid NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (week_start_eat,revision),
  FOREIGN KEY (week_start_eat) REFERENCES platform_private.wk100_admin_weekly_drafts_v1(week_start_eat)
);
ALTER TABLE platform_private.wk100_admin_draft_revisions_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON platform_private.wk100_admin_draft_revisions_v1 FROM PUBLIC, anon, authenticated, service_role;

-- Authenticated-only server read: neither draft nor history is public.
CREATE FUNCTION public.wk100_get_admin_draft_v1(p_week date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $wk100_read$
DECLARE v_draft platform_private.wk100_admin_weekly_drafts_v1%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    coalesce(public.current_user_has_capability('manage_ingest'),false)
    OR public.current_user_is_administrator()
  ) THEN
    RAISE EXCEPTION 'WK100 Admin draft read denied' USING ERRCODE='42501';
  END IF;
  IF p_week IS NULL OR extract(isodow from p_week)<>1 THEN
    RAISE EXCEPTION 'WK100 draft requires an EAT Monday' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_draft
    FROM platform_private.wk100_admin_weekly_drafts_v1 WHERE week_start_eat=p_week;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'weekStartEat',v_draft.week_start_eat,
    'revision',v_draft.revision,
    'config',v_draft.config_json,
    'configSha256',v_draft.config_sha256,
    'updatedAt',v_draft.updated_at
  );
END;
$wk100_read$;
REVOKE ALL ON FUNCTION public.wk100_get_admin_draft_v1(date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.wk100_get_admin_draft_v1(date) TO authenticated;

-- A conflict is a 40001 hold, NEVER an implicit last-write-wins overwrite.
-- The caller first validates the complete policy and seal server-side.
CREATE FUNCTION public.wk100_save_admin_draft_v1(
  p_week date,p_expected_revision bigint,p_config jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog
AS $wk100_save$
DECLARE
  v_actor uuid:=auth.uid();
  v_version bigint;
  v_existing platform_private.wk100_admin_weekly_drafts_v1%ROWTYPE;
  v_hash text;
  v_now timestamptz:=clock_timestamp();
BEGIN
  IF v_actor IS NULL OR NOT (
    coalesce(public.current_user_has_capability('manage_ingest'),false)
    OR public.current_user_is_administrator()
  ) THEN
    RAISE EXCEPTION 'WK100 Admin draft save denied' USING ERRCODE='42501';
  END IF;
  IF p_week IS NULL OR extract(isodow from p_week)<>1
    OR p_expected_revision IS NULL OR p_expected_revision < 0
    OR p_config IS NULL OR jsonb_typeof(p_config)<>'object'
    OR p_config->>'schemaVersion'<>'wk100-admin-edition-config/v1'
    OR p_config->>'programId'<>'top100'
    OR p_config->>'weekStartEat' IS DISTINCT FROM p_week::text
    OR coalesce(p_config->>'ingestPolicySha256','') !~ '^[a-f0-9]{64}$'
    OR length(p_config::text)>131072
  THEN
    RAISE EXCEPTION 'WK100 Admin draft invalid or unsealed' USING ERRCODE='22023';
  END IF;
  v_hash:=encode(extensions.digest(p_config::text,'sha256'),'hex');
  -- Frozen and published proposals must never be edited through draft saves.
  IF EXISTS (
    SELECT 1 FROM platform_private.wk100_governed_editorial_approvals_v1
    WHERE week_start_eat=p_week
  ) OR EXISTS (
    SELECT 1 FROM platform_private.wk100_governed_staged_editions_v1
    WHERE week_start_eat=p_week
  ) THEN
    RAISE EXCEPTION 'WK100 week already approved or staged; open a new week' USING ERRCODE='42501';
  END IF;
  IF p_expected_revision=0 THEN
    INSERT INTO platform_private.wk100_admin_weekly_drafts_v1
      (week_start_eat,revision,config_json,config_sha256,updated_by,updated_at)
    VALUES(p_week,1,p_config,v_hash,v_actor,v_now)
    ON CONFLICT DO NOTHING RETURNING revision INTO v_version;
  ELSE
    UPDATE platform_private.wk100_admin_weekly_drafts_v1
       SET revision=revision+1,config_json=p_config,
           config_sha256=v_hash,updated_by=v_actor,updated_at=v_now
     WHERE week_start_eat=p_week AND revision=p_expected_revision
     RETURNING revision INTO v_version;
  END IF;
  IF v_version IS NULL THEN
    -- Retry with an identical payload after a lost HTTP acknowledgement is
    -- idempotent; never append a duplicate revision or overwrite newer data.
    SELECT * INTO v_existing
      FROM platform_private.wk100_admin_weekly_drafts_v1
      WHERE week_start_eat=p_week;
    IF FOUND AND v_existing.revision=p_expected_revision+1
      AND v_existing.config_json=p_config THEN
      RETURN jsonb_build_object(
        'weekStartEat',p_week,'revision',v_existing.revision,
        'configSha256',v_existing.config_sha256,
        'updatedAt',v_existing.updated_at,'persisted',true);
    END IF;
    RAISE EXCEPTION 'WK100 stale edit: reload or resolve conflicting revision'
      USING ERRCODE='40001';
  END IF;
  INSERT INTO platform_private.wk100_admin_draft_revisions_v1
    (week_start_eat,revision,config_json,config_sha256,saved_by,saved_at)
  VALUES(p_week,v_version,p_config,v_hash,v_actor,v_now);
  RETURN jsonb_build_object(
    'weekStartEat',p_week,
    'revision',v_version,
    'configSha256',v_hash,
    'updatedAt',v_now,
    'persisted',true
  );
END;
$wk100_save$;
REVOKE ALL ON FUNCTION public.wk100_save_admin_draft_v1(date,bigint,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.wk100_save_admin_draft_v1(date,bigint,jsonb)
  TO authenticated;

COMMIT;
