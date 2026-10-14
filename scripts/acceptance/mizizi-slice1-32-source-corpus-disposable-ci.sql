-- WAKILISHA Slice 1: 32 distinct approved Track-source gateway scenarios.
-- Only fresh, unlinked local 230-migration GitHub CI PostgreSQL may run this.
-- Actual source broker and case admission; executor session is LOCAL SIM, not JIT.
-- No Production, Preview, Auth bootstrap, provider credentials or external ingress.
-- All fixture artists/tracks/reviews/cases and credentials are ROLLED BACK.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';

DO $wk_corpus_guard$
DECLARE v_count integer; v_head text;
BEGIN
 SELECT count(*),max(version) INTO v_count,v_head
 FROM supabase_migrations.schema_migrations;
 IF v_count<>230 OR v_head<>'20261014182214'
  OR session_user<>'supabase_admin' OR current_user<>'supabase_admin'
  OR NOT (SELECT rolsuper FROM pg_roles WHERE rolname='supabase_admin')
  OR (SELECT count(*) FROM mizizi_private.cases)<>0
  OR (SELECT count(*) FROM public.registry_tracks)<>0
  OR (SELECT count(*) FROM public.registry_releases)<>0
  OR (SELECT count(*) FROM public.registry_review_items)<>0
  OR (SELECT count(*) FROM platform_private.jobs)<>0
 THEN RAISE EXCEPTION 'STOP_CORPUS_NOT_EXACT_EMPTY_DISPOSABLE_230'; END IF;
END $wk_corpus_guard$;

DO $wk_corpus_setup$
DECLARE
 v_workspace uuid;
 v_main uuid; v_guest uuid;
 v_t uuid; v_peer uuid; v_title text; v_slug text;
 v_candidate text; v_guest_name text;
 v_rule text; v_version text; v_field text;
 v_current text; v_proposed text; v_fp text;
 v_entries jsonb:='[]'::jsonb;
 v_serial text;
 i integer; lane integer;
BEGIN
 SELECT w.id INTO STRICT v_workspace FROM mizizi_private.workspaces w
 WHERE w.workspace_key='wakilisha-internal'
   AND w.workspace_kind='internal' AND w.status='active';
 PERFORM set_config('wk.corpus.workspace',v_workspace::text,true);
 FOR i IN 1..8 LOOP
  v_serial:=to_char(i,'FM00');
  INSERT INTO public.registry_artists
   (slug,display_name,normalized_name,status,metadata)
  VALUES ('wk-corpus-primary-'||v_serial,'WK Corpus Primary '||v_serial,
    'wk corpus primary '||v_serial,'active',
    jsonb_build_object('ci_only',true,'scenario','source_corpus'))
  RETURNING id INTO STRICT v_main;
  v_guest_name:='WK Corpus Guest '||v_serial;
  INSERT INTO public.registry_artists
   (slug,display_name,normalized_name,status,metadata)
  VALUES ('wk-corpus-guest-'||v_serial,v_guest_name,
    lower(v_guest_name),'active',
    jsonb_build_object('ci_only',true,'scenario','source_corpus'))
  RETURNING id INTO STRICT v_guest;
  FOR lane IN 1..4 LOOP
   v_title:='WK Corpus Song '||v_serial||' Lane '||lane::text;
   v_rule:=CASE lane WHEN 1 THEN 'track_slug_identity_noise'
     WHEN 2 THEN 'track_slug_identity_noise'
     WHEN 3 THEN 'track_slug_credit_evidence_gap'
     ELSE 'track_recording_identity_conflict' END;
   v_version:=CASE lane WHEN 1 THEN '1.1.0'
     WHEN 2 THEN '1.2.0' ELSE '1.3.0' END;
   v_field:=CASE lane WHEN 4 THEN 'recording_identity'
     ELSE 'slug' END;
   v_slug:='wk-corpus-'||lane::text||'-'||v_serial||
     CASE lane WHEN 1 THEN '-feat-wk-corpus-guest'
     WHEN 3 THEN '-feat-unverified' ELSE '-rough' END;
   INSERT INTO public.registry_tracks
    (slug,title,normalized_title,status,metadata)
   VALUES (v_slug,v_title,lower(v_title),'active',
     jsonb_build_object('ci_only',true,'lane',lane,'serial',i))
   RETURNING id INTO STRICT v_t;
   IF lane=1 THEN
     INSERT INTO public.registry_track_artists
       (track_id,artist_id,artist_name_text,role,is_primary,is_featured,
        credit_order,source,confidence,status,metadata)
     VALUES
       (v_t,v_main,'WK Corpus Primary '||v_serial,'primary_artist',
        true,false,1,'ci_disposable',100,'active','{}'::jsonb),
       (v_t,v_guest,v_guest_name,'featured_artist',
        false,true,2,'ci_disposable',100,'active','{}'::jsonb);
     v_candidate:=public.wk_slugify_text(
        platform_private.registry_track_semantic_title_v1(
          v_title,ARRAY[v_guest_name]));
   ELSIF lane=2 THEN
     v_candidate:='wk-corpus-'||lane::text||'-'||v_serial||'-clean';
   ELSIF lane=3 THEN
     v_candidate:='wk-corpus-'||lane::text||'-'||v_serial||'-credit-check';
   ELSE
     INSERT INTO public.registry_track_artists
       (track_id,artist_id,artist_name_text,role,is_primary,is_featured,
        credit_order,source,confidence,status,metadata)
     VALUES(v_t,v_main,'WK Corpus Primary '||v_serial,
       'primary_artist',true,false,1,'ci_disposable',100,'active','{}'::jsonb);
     INSERT INTO public.registry_tracks
       (slug,title,normalized_title,status,metadata)
     VALUES ('wk-corpus-peer-'||v_serial,v_title,lower(v_title),'active',
       jsonb_build_object('ci_only',true,'recording_peer',i))
     RETURNING id INTO STRICT v_peer;
     INSERT INTO public.registry_track_artists
       (track_id,artist_id,artist_name_text,role,is_primary,is_featured,
        credit_order,source,confidence,status,metadata)
     VALUES(v_peer,v_main,'WK Corpus Primary '||v_serial,
       'primary_artist',true,false,1,'ci_disposable',100,'active','{}'::jsonb);
     v_candidate:='human_review_required';
   END IF;
   v_current:=CASE WHEN lane=4 THEN v_t::text ELSE v_slug END;
   IF v_current=v_candidate OR v_candidate IS NULL
   THEN RAISE EXCEPTION 'STOP_CORPUS_UNBOUNDED_SEMANTIC_CANDIDATE'; END IF;
   v_fp:=mizizi_private.finding_fingerprint_v1(
       v_rule,v_version,'track',v_t::text,v_field,v_current,v_candidate);
   v_entries:=v_entries||jsonb_build_array(jsonb_build_object(
     'lane',lane,'ordinal',i,'id',v_t,
     'ruleId',v_rule,'ruleVersion',v_version,'fieldName',v_field,
     'currentValue',v_current,'proposedValue',v_candidate,
     'fingerprint',v_fp,
     'evidence',jsonb_build_object(
       'source','local_accepted_registry_track',
       'fixture','disposable_only','ordinal',i,'lane',lane)));
  END LOOP;
 END LOOP;
 IF jsonb_array_length(v_entries)<>32
  OR (SELECT count(*) FROM public.registry_tracks)<>40
  OR (SELECT count(*) FROM public.registry_artists)<>16
  OR (SELECT count(*) FROM public.registry_track_artists)<>32
 THEN RAISE EXCEPTION 'STOP_CORPUS_TRACK_ARTIST_FIXTURE_COUNTS'; END IF;
 PERFORM set_config('wk.corpus.findings',v_entries::text,true);
 RAISE NOTICE 'CI_CORPUS_32_DISTINCT_TRACK_SOURCES_AND_STRUCTURED_CREDITS=PASS';
END $wk_corpus_setup$;

-- True gateway RPCs in an approved executor session (local simulation).
SET SESSION AUTHORIZATION mizizi_executor;
DO $wk_corpus_source_admission$
DECLARE
 v_entry jsonb; v_finding jsonb; v_reply record;
 v_counts integer[4]:=ARRAY[0,0,0,0];
 v_lane integer;
 v_archived jsonb; v_terminal jsonb;
 v_denied boolean;
BEGIN
 FOR v_entry IN SELECT value FROM jsonb_array_elements(
   current_setting('wk.corpus.findings')::jsonb
 ) LOOP
  v_lane:=(v_entry->>'lane')::integer;
  v_finding:=jsonb_build_object(
    'entityType','track','entityId',v_entry->>'id',
    'ruleId',v_entry->>'ruleId','ruleVersion',v_entry->>'ruleVersion',
    'fieldName',v_entry->>'fieldName',
    'currentValue',v_entry->>'currentValue',
    'proposedValue',v_entry->>'proposedValue',
    'fingerprint',v_entry->>'fingerprint','confidence',1,
    'severity','high','disposition','review',
    'reason','Distinct disposable source observation for canonical Track review.',
    'evidence',v_entry->'evidence');
  SELECT * INTO STRICT v_reply
  FROM mizizi_private.admit_review_case_gateway_v1(
    current_setting('wk.corpus.workspace')::uuid,
    'wk-ci-source-corpus-v1',v_finding);
  IF v_reply.outcome<>'created'
    OR v_reply.headquarters_case_revision<>1
    OR v_reply.review_item_id IS NULL
    OR v_reply.headquarters_case_id IS NULL
    OR v_reply.receipt_link_id IS NULL
  THEN RAISE EXCEPTION 'STOP_CORPUS_APPROVED_TRACK_GATEWAY_%_%',
      v_lane,v_entry->>'ordinal'; END IF;
  v_counts[v_lane]:=v_counts[v_lane]+1;
  IF v_lane=2 AND (v_entry->>'ordinal')::integer=1 THEN
    PERFORM set_config('wk.corpus.archived_entry',v_entry::text,true);
  END IF;
 END LOOP;
 IF v_counts IS DISTINCT FROM ARRAY[8,8,8,8]::integer[]
 THEN RAISE EXCEPTION 'STOP_CORPUS_APPROVED_FAMILY_CARDINALITY'; END IF;
 RAISE NOTICE 'CI_A01_APPROVED_TRACK_SLUG_1_1_EIGHT_SOURCE_GATEWAY_CASES=PASS';
 RAISE NOTICE 'CI_A02_APPROVED_TRACK_SLUG_1_2_EIGHT_SOURCE_GATEWAY_CASES=PASS';
 RAISE NOTICE 'CI_A03_APPROVED_CREDIT_GAP_1_3_EIGHT_SOURCE_GATEWAY_CASES=PASS';
 RAISE NOTICE 'CI_A04_APPROVED_RECORDING_CONFLICT_1_3_EIGHT_SOURCE_GATEWAY_CASES=PASS';

 -- C17: even a valid original source finding cannot escape the one authorized
 -- internal workspace by supplying a made-up workspace identifier.
 v_entry:=(current_setting('wk.corpus.findings')::jsonb)->0;
 v_finding:=jsonb_build_object(
    'entityType','track','entityId',v_entry->>'id',
    'ruleId',v_entry->>'ruleId','ruleVersion',v_entry->>'ruleVersion',
    'fieldName',v_entry->>'fieldName',
    'currentValue',v_entry->>'currentValue',
    'proposedValue',v_entry->>'proposedValue',
    'fingerprint',v_entry->>'fingerprint','confidence',1,
    'severity','high','disposition','review',
    'reason','Cross-workspace case replay attempt must be denied.',
    'evidence',v_entry->'evidence');
 v_denied:=false;
 BEGIN
  PERFORM * FROM mizizi_private.admit_review_case_gateway_v1(
    gen_random_uuid(),'wk-ci-source-corpus-v1',v_finding);
 EXCEPTION WHEN SQLSTATE '42501' THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'STOP_C17_FOREIGN_WORKSPACE_ADMITTED'; END IF;
 RAISE NOTICE 'CI_C17_UNAUTHORIZED_WORKSPACE_GATEWAY_REJECTED=PASS';
END $wk_corpus_source_admission$;
SET SESSION AUTHORIZATION DEFAULT;

-- Archive one accepted Track only AFTER it has a linked review and case.
-- This tests that even an exact replay cannot evade the canonical live state.
DO $wk_archive_setup$
DECLARE v_entry jsonb:=current_setting('wk.corpus.archived_entry')::jsonb;
BEGIN
 UPDATE public.registry_tracks SET status='archived'
 WHERE id=(v_entry->>'id')::uuid AND status='active';
 IF NOT FOUND THEN RAISE EXCEPTION 'STOP_A07_ARCHIVE_FIXTURE_NO_LIVE_TRACK'; END IF;
END $wk_archive_setup$;
SET SESSION AUTHORIZATION mizizi_executor;
DO $wk_archive_gateway_replay$
DECLARE v_entry jsonb:=current_setting('wk.corpus.archived_entry')::jsonb;
 v_denied boolean:=false;
BEGIN
 BEGIN
  PERFORM * FROM mizizi_private.admit_review_case_gateway_v1(
    current_setting('wk.corpus.workspace')::uuid,'wk-ci-source-corpus-v1',
    jsonb_build_object(
    'entityType','track','entityId',v_entry->>'id',
    'ruleId',v_entry->>'ruleId','ruleVersion',v_entry->>'ruleVersion',
    'fieldName',v_entry->>'fieldName',
    'currentValue',v_entry->>'currentValue',
    'proposedValue',v_entry->>'proposedValue',
    'fingerprint',v_entry->>'fingerprint',
    'confidence',1,'severity','high','disposition','review',
    'reason','Archived canonical source replay must be refused.',
    'evidence',v_entry->'evidence'));
 EXCEPTION WHEN SQLSTATE '40001' THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'STOP_A07_ARCHIVED_SOURCE_REPLAY_ACCEPTED'; END IF;
 RAISE NOTICE 'CI_A07_ARCHIVED_CANONICAL_TRACK_REPLAY_DENIED=PASS';
END $wk_archive_gateway_replay$;
SET SESSION AUTHORIZATION DEFAULT;

DO $wk_corpus_postcheck$
DECLARE v_workspace uuid:=current_setting('wk.corpus.workspace')::uuid;
BEGIN
 IF (SELECT count(*) FROM public.registry_review_items
   WHERE review_type='mizizi_data_hygiene' AND status='open'
   AND entity_type='track')<>32
  OR (SELECT count(*) FROM mizizi_private.cases
      WHERE workspace_id=v_workspace AND subject_type='track'
        AND revision=1)<>32
  OR (SELECT count(*) FROM mizizi_private.case_events
      WHERE workspace_id=v_workspace AND case_revision=1)<>32
  OR (SELECT count(*) FROM mizizi_private.case_receipt_links
      WHERE workspace_id=v_workspace AND relation_type='review_item')<>32
  OR (SELECT count(*) FROM public.registry_tracks WHERE status='archived')<>1
  OR (SELECT count(*) FROM public.registry_tracks WHERE status='active')<>39
  OR (SELECT count(*) FROM platform_private.jobs)<>0
  OR (SELECT count(*) FROM jsonb_array_elements(current_setting('wk.corpus.findings')::jsonb) f
       JOIN public.registry_tracks t ON t.id=(f->>'id')::uuid
       WHERE f->>'fieldName'='slug' AND t.slug=f->>'currentValue')<>24
 THEN RAISE EXCEPTION 'STOP_CORPUS_SOURCE_CASE_HISTORY_OR_WORKER_RESIDUAL_DRIFT'; END IF;
 IF EXISTS (
  SELECT 1 FROM public.registry_review_items r
  LEFT JOIN mizizi_private.cases c
    ON c.subject_id=r.entity_id AND c.subject_type='track'
  LEFT JOIN mizizi_private.case_receipt_links l
    ON l.case_id=c.id AND l.authority_id=r.id
      AND l.authority_object_type='registry_review_items'
  WHERE r.review_type='mizizi_data_hygiene' AND r.entity_type='track'
    AND (c.id IS NULL OR l.id IS NULL OR
         r.review_key <> 'mizizi:'||c.last_observation_fingerprint)
 ) THEN RAISE EXCEPTION 'STOP_CORPUS_REVIEW_CASE_RECEIPT_IDENTITY_DRIFT'; END IF;
 RAISE NOTICE 'CI_CORPUS_32_APPROVED_DISTINCT_REVIEW_CASE_RECEIPT_CHAINS=PASS';
 RAISE NOTICE 'CI_CORPUS_CANONICAL_TRACK_SLUGS_UNMUTATED=PASS';
END $wk_corpus_postcheck$;

ROLLBACK;
\echo WK_CI_CORPUS_32_SOURCE_ROLLBACK=PASS
