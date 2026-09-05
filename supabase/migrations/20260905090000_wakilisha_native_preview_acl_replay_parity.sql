-- WAKILISHA native preview ACL replay parity repair.
--
-- Problem repaired here:
-- Supabase native preview branches replay the Production migration-history
-- statement payload. The August 27 default-privilege repair intentionally
-- changed repository replay source only, so the older stored baseline payload
-- can still recreate fresh public-schema browser defaults that Production no
-- longer has.
--
-- This migration is forward-only authority. It does not rewrite historical
-- migration rows. It converges the exact accepted 89 / 20260904190000 public
-- privilege perimeter and makes future postgres-created public objects inherit
-- the accepted Production defaults.

begin;

DO $wk_native_preview_acl_preflight$
BEGIN
  IF (SELECT count(*) FROM supabase_migrations.schema_migrations) <> 89
     OR (SELECT max(version) FROM supabase_migrations.schema_migrations) <> '20260904190000'
  THEN
    RAISE EXCEPTION
      'STOP: native preview ACL parity repair requires exact 89 / 20260904190000 predecessor authority';
  END IF;

  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public') <> 764
     OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f')) <> 235
     OR (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='S') <> 4
  THEN
    RAISE EXCEPTION
      'STOP: public authority object inventory drifted before native preview ACL parity repair';
  END IF;
END;
$wk_native_preview_acl_preflight$;

-- Match the accepted Production postgres defaults for future public objects.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM anon, authenticated;

-- Remove the fresh-project browser defaults from existing public application
-- objects. Extension-owned routines are excluded because they are platform /
-- extension authority rather than WAKILISHA application ACL authority.
DO $wk_native_preview_acl_clear_stale_defaults$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS identity
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public'
      AND NOT EXISTS (
        SELECT 1
        FROM pg_depend d
        WHERE d.classid='pg_proc'::regclass
          AND d.objid=p.oid
          AND d.deptype='e'
      )
  LOOP
    EXECUTE format(
      'revoke execute on function %s from public, anon, authenticated',
      r.identity
    );
  END LOOP;

  FOR r IN
    SELECT c.oid::regclass AS identity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public'
      AND c.relkind IN ('r','p','v','m','f')
  LOOP
    EXECUTE format(
      'revoke select, insert, update, delete on table %s from anon, authenticated',
      r.identity
    );
  END LOOP;

  FOR r IN
    SELECT c.oid::regclass AS identity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public'
      AND c.relkind='S'
  LOOP
    EXECUTE format(
      'revoke all on sequence %s from anon, authenticated',
      r.identity
    );
  END LOOP;
END;
$wk_native_preview_acl_clear_stale_defaults$;

-- Restore the captured baseline ACL tail from the historical statement payload.
DO $wk_native_preview_acl_restore_baseline$
DECLARE
  r record;
  v_skipped integer := 0;
BEGIN
  FOR r IN
    SELECT ordinality, statement
    FROM supabase_migrations.schema_migrations m,
         unnest(m.statements) WITH ORDINALITY AS u(statement, ordinality)
    WHERE m.version='20260814202000'
      AND ordinality >= 4853
    ORDER BY ordinality
  LOOP
    BEGIN
      EXECUTE r.statement;
    EXCEPTION
      WHEN undefined_function OR undefined_table OR undefined_object OR invalid_schema_name THEN
        v_skipped := v_skipped + 1;
    END;
  END LOOP;

  IF v_skipped <> 0 THEN
    RAISE EXCEPTION
      'STOP: baseline ACL replay skipped % statements; expected 0',
      v_skipped;
  END IF;
END;
$wk_native_preview_acl_restore_baseline$;

-- Restore explicit ACL changes from every post-baseline migration. Some CLI
-- history rows contain a complete migration file as one statement, so split on
-- statement terminators and execute only GRANT / REVOKE / DEFAULT PRIVILEGE
-- fragments. Ten historical ACL fragments target functions intentionally
-- retired later in the chain and are expected to be absent at head 89.
DO $wk_native_preview_acl_restore_forward_history$
DECLARE
  r record;
  v_fragments integer := 0;
  v_skipped integer := 0;
BEGIN
  FOR r IN
    WITH raw AS (
      SELECT
        m.version,
        ordinality AS statement_ordinality,
        frag_ordinality,
        regexp_replace(
          fragment,
          '^([[:space:]]|--[^\n]*(\n|$))*',
          '',
          'n'
        ) AS fragment
      FROM supabase_migrations.schema_migrations m,
           unnest(m.statements) WITH ORDINALITY AS u(statement, ordinality),
           regexp_split_to_table(statement, ';') WITH ORDINALITY AS f(fragment, frag_ordinality)
      WHERE m.version > '20260814202000'
    )
    SELECT
      version,
      statement_ordinality,
      frag_ordinality,
      btrim(fragment) AS fragment
    FROM raw
    WHERE upper(btrim(fragment)) LIKE 'GRANT %'
       OR upper(btrim(fragment)) LIKE 'REVOKE %'
       OR upper(btrim(fragment)) LIKE 'ALTER DEFAULT PRIVILEGES%'
    ORDER BY version, statement_ordinality, frag_ordinality
  LOOP
    v_fragments := v_fragments + 1;
    BEGIN
      EXECUTE r.fragment;
    EXCEPTION
      WHEN undefined_function OR undefined_table OR undefined_object OR invalid_schema_name THEN
        v_skipped := v_skipped + 1;
    END;
  END LOOP;

  IF v_fragments <> 641 OR v_skipped <> 10 THEN
    RAISE EXCEPTION
      'STOP: forward ACL history shape drifted: fragments %, skipped %; expected 641 / 10',
      v_fragments,
      v_skipped;
  END IF;
END;
$wk_native_preview_acl_restore_forward_history$;

-- WAKILISHA CANONICAL PUBLIC EXECUTE SET BEGIN
DO $wk_native_preview_acl_restore_public_execute$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT to_regprocedure(sig) AS identity
    FROM (VALUES
      ('briefing_cron_generate()'),
      ('chart_artist_resolution_touch_updated_at()'),
      ('chart_entry_artist_token_slugs(text,text)'),
      ('chart_rule_explicit_allowed(jsonb)'),
      ('chart_rule_snapshot_text(jsonb,text)'),
      ('community_get_artist_public_presentation(uuid)'),
      ('community_get_comment_replies(uuid,integer)'),
      ('community_get_digest(integer)'),
      ('community_get_entity_contributions(text,text,text)'),
      ('community_get_most_discussed(integer)'),
      ('community_get_profile_by_username(text)'),
      ('community_get_profiles_batch(uuid[])'),
      ('community_get_track_moment_comments(uuid,integer,integer,integer)'),
      ('community_get_track_moment_summary(uuid,integer)'),
      ('community_get_user_comments(uuid,integer)'),
      ('community_get_user_replies(uuid,integer)'),
      ('community_get_user_stats(uuid)'),
      ('community_normalize_username(text)'),
      ('community_username_available(text)'),
      ('community_username_is_reserved(text)'),
      ('community_username_is_valid(text)'),
      ('community_username_seed(text)'),
      ('discover_unknown_artist_slugs()'),
      ('finalize_step_cf_chunk(uuid,integer,uuid)'),
      ('finalize_step_complete(uuid,integer,integer,integer,integer,integer,integer,jsonb)'),
      ('finalize_step_content(uuid)'),
      ('finalize_step_custom_fields(uuid)'),
      ('finalize_step_entities_chunk(uuid,integer,text)'),
      ('finalize_step_entities(uuid)'),
      ('finalize_step_entity_relationships(uuid)'),
      ('finalize_step_ers_all(uuid)'),
      ('finalize_step_ers_chunk_v2(uuid,integer,bigint)'),
      ('finalize_step_ers_chunk_v2(uuid,integer,text)'),
      ('finalize_step_ers_chunk_v2(uuid,integer,uuid)'),
      ('finalize_step_ers_chunk_v3(uuid,integer,text)'),
      ('finalize_step_ers_chunk_v3(uuid,integer,uuid)'),
      ('finalize_step_ers_chunk_v4(uuid,integer,uuid)'),
      ('finalize_step_ers_chunk_v5(uuid,integer,uuid)'),
      ('finalize_step_ers_chunk_v6(uuid,integer,uuid)'),
      ('finalize_step_ers_chunk_v7(uuid,integer,uuid)'),
      ('finalize_step_ers_chunk_v8(uuid,integer,uuid)'),
      ('finalize_step_ers_chunk(uuid,integer,integer)'),
      ('finalize_step_media(uuid)'),
      ('finalize_step_review(uuid)'),
      ('get_chart_programs()'),
      ('get_release_artists_for_anon_v2(text)'),
      ('get_release_artists_for_anon(text)'),
      ('get_release_tracks_by_ids(uuid[])'),
      ('get_releases_by_ids_v2(uuid[])'),
      ('get_releases_by_ids(uuid[])'),
      ('get_taxonomy_article_counts(text)'),
      ('get_taxonomy_terms(text,text,integer,integer)'),
      ('get_taxonomy_terms(text)'),
      ('get_tracks_by_ids(uuid[])'),
      ('increment_share_count(text,text,text,text)'),
      ('increment_share_count(text,text)'),
      ('institute_set_updated_at()'),
      ('link_orphan_release_artists()'),
      ('public_get_articles_by_term(text,text,integer,integer)'),
      ('public_get_taxonomy_index(text,integer,integer)'),
      ('public_get_taxonomy_index(text)'),
      ('public_get_taxonomy_term(text,text)'),
      ('rebuild_discography_from_metadata()'),
      ('registry_resolve_artist_slug_for_public(text)'),
      ('rpc_get_chart_programs()'),
      ('set_registry_release_shells_updated_at()'),
      ('set_updated_at()'),
      ('signal_os_label_for_score(integer)'),
      ('signal_os_path_from_url(text)'),
      ('signal_os_slug_from_path(text)'),
      ('split_multi_release_tracks()'),
      ('track_analytics_event(text,text,text,text,text,jsonb,text,uuid,text)'),
      ('validate_slug_encoding()'),
      ('wk_first_jsonb_text(jsonb,jsonb,text[])'),
      ('wk_jsonb_text(jsonb,text[])'),
      ('wk_legacy_uuid(text,text)'),
      ('wk_magazine_issue_entities_touch_updated_at()'),
      ('wk_magazine_issue_sections_touch_updated_at()'),
      ('wk_magazine_issues_touch_updated_at()'),
      ('wk_norm(text)'),
      ('wk_safe_bigint(text)'),
      ('wk_safe_bool(text)'),
      ('wk_safe_date(text)'),
      ('wk_safe_int(text)'),
      ('wk_safe_timestamptz(text)'),
      ('wk_slug_fallback(text,text)'),
      ('wk_slugify_text(text)'),
      ('wk_slugify(text)'),
      ('wk_stable_uuid(text)'),
      ('wk_touch_chart_playback_enrichment_updated_at()'),
      ('wk_touch_updated_at()')
    ) x(sig)
  LOOP
    IF r.identity IS NULL THEN
      RAISE EXCEPTION
        'STOP: canonical PUBLIC-execute target is missing';
    END IF;
    EXECUTE format(
      'grant execute on function %s to public',
      r.identity
    );
  END LOOP;
END;
$wk_native_preview_acl_restore_public_execute$;
-- WAKILISHA CANONICAL PUBLIC EXECUTE SET END

-- WAKILISHA CANONICAL SERVICE_ROLE REVOKE SET BEGIN
DO $wk_native_preview_acl_service_role_normalization$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT to_regprocedure(sig) AS identity
    FROM (VALUES
      ('public.add_playlist_registry_track_with_intake_slots(uuid,bigint,uuid,text,uuid)'),
      ('public.add_playlist_validated_provider_track(uuid,bigint,uuid,uuid,text,uuid)'),
      ('public.add_playlist_validated_provider_track_with_intake_slots(uuid,bigint,uuid,uuid,text,uuid)'),
      ('public.admin_get_registry_track_intake_enrichment(uuid)'),
      ('public.admin_get_registry_track_intake_queue(text,integer,integer,uuid,uuid)'),
      ('public.admin_record_registry_track_intake_provider_evidence(uuid,text,text,text,jsonb,jsonb,numeric)'),
      ('public.admin_reject_registry_track_intake(uuid,text)'),
      ('public.admin_resolve_registry_track_intake(uuid,uuid,text)'),
      ('public.admin_resolve_registry_track_intake_enriched(uuid,uuid,text,boolean)'),
      ('public.admin_save_registry_track_intake_enrichment(uuid,jsonb,text)'),
      ('public.admin_select_registry_track_intake_provider_evidence(uuid,text,text,text)'),
      ('public.admin_update_registry_track_intake_artist_credit(uuid,integer,text,text,uuid,text)'),
      ('public.adopt_verified_media_upload_session_v1(uuid,text,text,uuid,uuid)'),
      ('public.cancel_media_upload_session_v1(uuid,text)'),
      ('public.create_institute_playlist_draft(uuid,text,text,text,jsonb)'),
      ('public.create_media_upload_session_v1(text,text,text,bigint,text,integer,uuid)'),
      ('public.create_media_upload_session_v2(text,text,text,bigint,text,integer,uuid)'),
      ('public.create_registry_track_intake_suggestion(uuid,uuid,text,uuid)'),
      ('public.current_user_can_edit_playlist_id(uuid)'),
      ('public.get_media_private_delivery_target_v1(uuid)'),
      ('public.get_media_upload_session_v1(uuid)'),
      ('public.get_playlist_cover_source(uuid,uuid)'),
      ('public.get_playlist_pending_registry_intake(uuid)'),
      ('public.get_playlist_pending_registry_intake_editorial(uuid)'),
      ('public.guard_registry_track_intake_provider_selection()'),
      ('public.move_playlist_pending_registry_intake(uuid,uuid,bigint,text,text,uuid)'),
      ('public.read_media_assets_admin_v2(jsonb)'),
      ('public.remove_playlist_item_with_intake_slots(uuid,uuid,bigint,text,uuid)'),
      ('public.reorder_playlist_items_with_intake_slots(uuid,bigint,uuid[],text,uuid)'),
      ('public.save_playlist_pending_registry_note(uuid,uuid,bigint,text,text,uuid)'),
      ('public.set_playlist_cover(uuid,bigint,uuid,text,jsonb,text,text,text,uuid)'),
      ('public.submit_media_processing_command_v1(uuid,uuid,text,text,uuid)'),
      ('public.submit_playlist_registry_intake(uuid,bigint,uuid,jsonb,text,uuid)'),
      ('public.sync_registry_track_intake_artist_credits(uuid,uuid)')
    ) x(sig)
  LOOP
    IF r.identity IS NULL THEN
      RAISE EXCEPTION
        'STOP: canonical service_role revoke target is missing';
    END IF;
    EXECUTE format(
      'revoke execute on function %s from service_role',
      r.identity
    );
  END LOOP;
END;
$wk_native_preview_acl_service_role_normalization$;
-- WAKILISHA CANONICAL SERVICE_ROLE REVOKE SET END

DO $wk_native_preview_acl_postcheck$
DECLARE
  v_func_fp text;
  v_rel_fp text;
  v_seq_fp text;
BEGIN
  WITH funcs AS (
    SELECT
      p.oid::regprocedure::text AS identity,
      p.prosecdef,
      EXISTS(
        SELECT 1
        FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x
        WHERE x.grantee=0
          AND x.privilege_type='EXECUTE'
      ) AS public_execute,
      has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
      has_function_privilege('authenticated',p.oid,'EXECUTE') AS auth_execute,
      has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public'
  )
  SELECT md5(string_agg(
    identity||'|'||prosecdef::text||'|'||public_execute::text||'|'||
    anon_execute::text||'|'||auth_execute::text||'|'||service_execute::text,
    E'\n' ORDER BY identity
  ))
  INTO v_func_fp
  FROM funcs;

  WITH rels AS (
    SELECT
      quote_ident(n.nspname)||'.'||quote_ident(c.relname) AS identity,
      c.relkind,
      EXISTS(
        SELECT 1
        FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) x
        WHERE x.grantee=0
          AND x.privilege_type='SELECT'
      ) AS public_select,
      has_table_privilege('anon',c.oid,'SELECT') AS a_s,
      has_table_privilege('anon',c.oid,'INSERT') AS a_i,
      has_table_privilege('anon',c.oid,'UPDATE') AS a_u,
      has_table_privilege('anon',c.oid,'DELETE') AS a_d,
      has_table_privilege('authenticated',c.oid,'SELECT') AS u_s,
      has_table_privilege('authenticated',c.oid,'INSERT') AS u_i,
      has_table_privilege('authenticated',c.oid,'UPDATE') AS u_u,
      has_table_privilege('authenticated',c.oid,'DELETE') AS u_d,
      has_table_privilege('service_role',c.oid,'SELECT') AS s_s,
      has_table_privilege('service_role',c.oid,'INSERT') AS s_i,
      has_table_privilege('service_role',c.oid,'UPDATE') AS s_u,
      has_table_privilege('service_role',c.oid,'DELETE') AS s_d
    FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public'
      AND c.relkind IN ('r','p','v','m','f')
  )
  SELECT md5(string_agg(
    identity||'|'||relkind::text||'|'||public_select::text||'|'||
    a_s::text||a_i::text||a_u::text||a_d::text||'|'||
    u_s::text||u_i::text||u_u::text||u_d::text||'|'||
    s_s::text||s_i::text||s_u::text||s_d::text,
    E'\n' ORDER BY identity
  ))
  INTO v_rel_fp
  FROM rels;

  WITH seqs AS (
    SELECT
      quote_ident(n.nspname)||'.'||quote_ident(c.relname) AS identity,
      EXISTS(
        SELECT 1
        FROM aclexplode(coalesce(c.relacl,acldefault('S',c.relowner))) x
        WHERE x.grantee=0
          AND x.privilege_type='USAGE'
      ) AS public_usage,
      has_sequence_privilege('anon',c.oid,'USAGE') AS a_u,
      has_sequence_privilege('anon',c.oid,'SELECT') AS a_s,
      has_sequence_privilege('anon',c.oid,'UPDATE') AS a_up,
      has_sequence_privilege('authenticated',c.oid,'USAGE') AS u_u,
      has_sequence_privilege('authenticated',c.oid,'SELECT') AS u_s,
      has_sequence_privilege('authenticated',c.oid,'UPDATE') AS u_up,
      has_sequence_privilege('service_role',c.oid,'USAGE') AS s_u,
      has_sequence_privilege('service_role',c.oid,'SELECT') AS s_s,
      has_sequence_privilege('service_role',c.oid,'UPDATE') AS s_up
    FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public'
      AND c.relkind='S'
  )
  SELECT md5(string_agg(
    identity||'|'||public_usage::text||'|'||
    a_u::text||a_s::text||a_up::text||'|'||
    u_u::text||u_s::text||u_up::text||'|'||
    s_u::text||s_s::text||s_up::text,
    E'\n' ORDER BY identity
  ))
  INTO v_seq_fp
  FROM seqs;

  IF v_func_fp <> '7ed97824e39cde87cef32beb1f685f82'
     OR v_rel_fp <> '64e520bb235dff2d8d72e8fd9440b018'
     OR v_seq_fp <> 'e8a372dbcc677549a11232bbae999507'
  THEN
    RAISE EXCEPTION
      'STOP: native preview ACL parity did not converge: funcs %, rels %, seqs %',
      v_func_fp,
      v_rel_fp,
      v_seq_fp;
  END IF;
END;
$wk_native_preview_acl_postcheck$;

commit;
