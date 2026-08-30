-- HISTORICAL CHECKPOINT VERIFIER ONLY.
-- This script proves the named migration checkpoint, not the current post-kernel end state.
-- For current authority use scripts/control-plane/verify-phase-7a-kernel-closure.sql.
begin;
set local transaction read only;
set local statement_timeout = '120s';
set local lock_timeout = '5s';

do $phase_7a_k4c_ar3_verify$
declare
  v_count bigint;
  v_names text[];
  v_definition text;
begin
  if to_regclass('editorial.article_lifecycle_events') is null
     or to_regclass('editorial.resource_lifecycle_events') is null
     or to_regprocedure(
       'editorial.correction_article_publication_proof(uuid)'
     ) is null
     or to_regprocedure(
       'editorial.derive_publishing_editorial_state(uuid)'
     ) is null
  then
    raise exception
      'PHASE_7A_K4C_AR3_FAIL: Article historical/shared reader surface is incomplete';
  end if;

  if (
    select count(*)
    from editorial.article_lifecycle_events
  ) = 0 then
    if (
      select md5(
        coalesce(
          string_agg(to_jsonb(e)::text, E'\n' order by e.id::text),
          ''
        )
      )
      from editorial.article_lifecycle_events e
    ) <> 'd41d8cd98f00b204e9800998ecf8427e'
    then
      raise exception
        'PHASE_7A_K4C_AR3_FAIL: no-data preview typed Article fingerprint drifted';
    end if;
  elsif (
    select count(*)
    from editorial.article_lifecycle_events
  ) = 35 then
    if (
      select md5(
        coalesce(
          string_agg(to_jsonb(e)::text, E'\n' order by e.id::text),
          ''
        )
      )
      from editorial.article_lifecycle_events e
    ) <> 'dd7ac00209d19f3f369fb0d9b3e1e6a1'
    then
      raise exception
        'PHASE_7A_K4C_AR3_FAIL: production typed Article fingerprint drifted';
    end if;
  else
    raise exception
      'PHASE_7A_K4C_AR3_FAIL: unexpected typed Article historical row count %',
      (
        select count(*)
        from editorial.article_lifecycle_events
      );
  end if;

  if exists (
    select 1
    from editorial.article_lifecycle_events source
    left join editorial.resource_lifecycle_events shared
      on shared.legacy_source_authority = 'article_lifecycle'
     and shared.legacy_source_event_id = source.id
     and shared.id = source.id
     and shared.resource_id = source.resource_id
     and shared.version_id is not distinct from source.version_id
     and shared.action = source.action
     and shared.prior_status is not distinct from source.prior_status
     and shared.resulting_status is not distinct from source.resulting_status
     and shared.note is not distinct from source.note
     and shared.metadata = coalesce(source.metadata, '{}'::jsonb)
     and shared.actor_id is not distinct from source.actor_id
     and shared.created_at = source.created_at
    where shared.id is null
  ) then
    raise exception
      'PHASE_7A_K4C_AR3_FAIL: historical typed Article rows are not fully represented in shared history';
  end if;

  select
    count(*),
    array_agg(
      namespace_row.nspname || '.' || procedure_row.proname
      order by namespace_row.nspname, procedure_row.proname
    )
  into
    v_count,
    v_names
  from pg_proc procedure_row
  join pg_namespace namespace_row
    on namespace_row.oid = procedure_row.pronamespace
  where procedure_row.prokind in ('f','p')
    and pg_get_functiondef(procedure_row.oid)
      ~ 'editorial[.]article_lifecycle_events';

  if v_count <> 0 then
    raise exception
      'PHASE_7A_K4C_AR3_FAIL: live typed Article function dependencies remain: % / %',
      v_count,
      v_names;
  end if;

  if exists (
    select 1
    from information_schema.views view_row
    where view_row.view_definition ilike
      '%editorial.article_lifecycle_events%'
  ) or exists (
    select 1
    from pg_matviews matview_row
    where matview_row.definition ilike
      '%editorial.article_lifecycle_events%'
  ) or exists (
    select 1
    from pg_policies policy_row
    where coalesce(policy_row.qual, '') ilike
        '%article_lifecycle_events%'
       or coalesce(policy_row.with_check, '') ilike
        '%article_lifecycle_events%'
  ) then
    raise exception
      'PHASE_7A_K4C_AR3_FAIL: non-function typed Article dependency remains';
  end if;

  select pg_get_functiondef(
    'editorial.correction_article_publication_proof(uuid)'::regprocedure
  )
  into v_definition;

  if position('editorial.resource_lifecycle_events' in v_definition) = 0
     or position('editorial.article_lifecycle_events' in v_definition) <> 0
     or position('published_version.id' in v_definition) = 0
     or position('snapshot.is_active' in v_definition) = 0
     or position('editorial.article_snapshot_fingerprint' in v_definition) = 0
  then
    raise exception
      'PHASE_7A_K4C_AR3_FAIL: Corrections publication proof did not converge onto shared history';
  end if;

  if pg_get_function_result(
       'editorial.correction_article_publication_proof(uuid)'::regprocedure
     ) <>
     'TABLE(case_resource_id uuid, application_id uuid, affected_resource_id uuid, article_id uuid, challenged_version_id uuid, application_resulting_version_id uuid, corrected_version_id uuid, content_fingerprint text, article_slug text)'
  then
    raise exception
      'PHASE_7A_K4C_AR3_FAIL: Corrections publication proof result shape changed';
  end if;

  select pg_get_functiondef(
    'editorial.derive_publishing_editorial_state(uuid)'::regprocedure
  )
  into v_definition;

  if position('editorial.resource_lifecycle_events' in v_definition) = 0
     or position('editorial.article_lifecycle_events' in v_definition) <> 0
     or position('changes_requested' in v_definition) = 0
     or position('current_published_version_id' in v_definition) = 0
     or position('current_approved_version_id' in v_definition) = 0
     or position('current_submitted_version_id' in v_definition) = 0
     or position('return ''draft''' in v_definition) = 0
  then
    raise exception
      'PHASE_7A_K4C_AR3_FAIL: Publishing editorial-state derivation semantics drifted';
  end if;

  if pg_get_function_result(
       'editorial.derive_publishing_editorial_state(uuid)'::regprocedure
     ) <> 'text'
  then
    raise exception
      'PHASE_7A_K4C_AR3_FAIL: Publishing editorial-state result type changed';
  end if;

  if not exists (
    select 1
    from pg_proc procedure_row
    where procedure_row.oid =
      'editorial.derive_publishing_editorial_state(uuid)'::regprocedure
      and procedure_row.prosecdef
      and coalesce(procedure_row.proconfig, '{}'::text[]) @>
        array['search_path=pg_catalog, editorial']::text[]
  ) then
    raise exception
      'PHASE_7A_K4C_AR3_FAIL: Publishing reader security metadata drifted';
  end if;

  if has_function_privilege(
       'anon',
       'editorial.correction_article_publication_proof(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'editorial.correction_article_publication_proof(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'editorial.correction_article_publication_proof(uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'PHASE_7A_K4C_AR3_FAIL: Corrections proof execution perimeter drifted';
  end if;

  if has_function_privilege(
       'anon',
       'editorial.derive_publishing_editorial_state(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'editorial.derive_publishing_editorial_state(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'editorial.derive_publishing_editorial_state(uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'PHASE_7A_K4C_AR3_FAIL: Publishing reader execution perimeter drifted';
  end if;

  if md5(
       pg_get_functiondef(
         'editorial.assert_correction_public_note_integrity()'::regprocedure
       )
     ) <> '9fcaaee0694f103fc7b64e9f3b01549f'
     or md5(
       pg_get_functiondef(
         'editorial.validate_correction_case_history(uuid)'::regprocedure
       )
     ) <> 'ffa4fbba0c8cb7a19f015a39d3864adf'
     or md5(
       pg_get_functiondef(
         'public.close_correction_case(uuid,bigint,text,text,uuid,text,text,text,text)'::regprocedure
       )
     ) <> '933345920e74c08a217d4c02d00271ec'
     or md5(
       pg_get_functiondef(
         'public.public_get_article_correction_notes(text)'::regprocedure
       )
     ) <> 'f4495500ba9e1ecd6a7b95c8769d3e8d'
     or md5(
       pg_get_functiondef(
         'public.publish_correction_note(uuid,bigint,uuid,uuid,text,uuid,text,text,text,uuid)'::regprocedure
       )
     ) <> '9bd8f5d6b14da2c98bb95b46f8e482c6'
  then
    raise exception
      'PHASE_7A_K4C_AR3_FAIL: Corrections caller authority changed';
  end if;

  if md5(
       pg_get_functiondef(
         'editorial.append_resource_lifecycle_event(uuid,uuid,text,text,text,text,jsonb,uuid,uuid,uuid)'::regprocedure
       )
     ) <> 'd84d503da70733c010a93025bca7cda7'
  then
    raise exception
      'PHASE_7A_K4C_AR3_FAIL: shared Resource lifecycle helper changed';
  end if;

  if md5(
       pg_get_functiondef(
         'public.submit_article_for_review(uuid,bigint,text)'::regprocedure
       )
     ) <> '539bf98f189212294b8e1ce65d97e00e'
     or md5(
       pg_get_functiondef(
         'public.request_article_changes(uuid,uuid,text)'::regprocedure
       )
     ) <> '0421228df4bf205da2f663cc14c41e80'
     or md5(
       pg_get_functiondef(
         'public.approve_article_version(uuid,uuid,text)'::regprocedure
       )
     ) <> '707058aadc9c53746bfcaaa62d893f7f'
     or md5(
       pg_get_functiondef(
         'public.accept_article_suggestion(uuid,bigint,text)'::regprocedure
       )
     ) <> 'd92af169eeb9e48e65e4c749cf9e6403'
     or md5(
       pg_get_functiondef(
         'public.list_article_lifecycle_events(uuid,integer)'::regprocedure
       )
     ) <> 'f5c977c58e87556e18f0fd07573dabe3'
  then
    raise exception
      'PHASE_7A_K4C_AR3_FAIL: AR1 Article review/list authority changed';
  end if;

  if md5(
       pg_get_functiondef(
         'public.publish_article_version(uuid,uuid,timestamp with time zone,text)'::regprocedure
       )
     ) <> 'b2d6c14458a6a1b9824565c715237ef9'
     or md5(
       pg_get_functiondef(
         'public.schedule_article_publication(uuid,uuid,timestamp with time zone,text)'::regprocedure
       )
     ) <> 'c7a5df4d7de4d740fb680f4dc52dfc46'
     or md5(
       pg_get_functiondef(
         'public.publish_due_article_publications(integer)'::regprocedure
       )
     ) <> '12311085f7d61e044468e6c6cabbfd9e'
     or md5(
       pg_get_functiondef(
         'public.unpublish_article(uuid,text)'::regprocedure
       )
     ) <> 'e4904cf58a152dffe23345c9c077ece3'
     or md5(
       pg_get_functiondef(
         'public.archive_article(uuid,text)'::regprocedure
       )
     ) <> 'e5575e7ac122b98128e341898a0052c7'
     or md5(
       pg_get_functiondef(
         'public.restore_article_from_archive(uuid,text)'::regprocedure
       )
     ) <> '82d29071e92b4e09825c76f1b2b6a883'
     or md5(
       pg_get_functiondef(
         'platform_private.begin_legacy_authenticated_article_command(text,uuid,jsonb)'::regprocedure
       )
     ) <> '26320c4bf9c707e36912a0cea7bda82c'
     or md5(
       pg_get_functiondef(
         'platform_private.begin_legacy_service_article_command(text,uuid,uuid,jsonb)'::regprocedure
       )
     ) <> '4a1a1912f298d05ad96c70969efd54d8'
  then
    raise exception
      'PHASE_7A_K4C_AR3_FAIL: AR2 Article publication/command authority changed';
  end if;

  if not (
    select class_row.relrowsecurity
    from pg_class class_row
    join pg_namespace namespace_row
      on namespace_row.oid = class_row.relnamespace
    where namespace_row.nspname = 'editorial'
      and class_row.relname = 'article_lifecycle_events'
  ) then
    raise exception
      'PHASE_7A_K4C_AR3_FAIL: historical typed Article table lost RLS';
  end if;

  if has_table_privilege(
       'anon',
       'editorial.article_lifecycle_events',
       'SELECT'
     )
     or has_table_privilege(
       'authenticated',
       'editorial.article_lifecycle_events',
       'SELECT'
     )
     or has_table_privilege(
       'service_role',
       'editorial.article_lifecycle_events',
       'SELECT'
     )
     or has_table_privilege(
       'anon',
       'editorial.article_lifecycle_events',
       'INSERT,UPDATE,DELETE'
     )
     or has_table_privilege(
       'authenticated',
       'editorial.article_lifecycle_events',
       'INSERT,UPDATE,DELETE'
     )
     or has_table_privilege(
       'service_role',
       'editorial.article_lifecycle_events',
       'INSERT,UPDATE,DELETE'
     )
  then
    raise exception
      'PHASE_7A_K4C_AR3_FAIL: historical typed Article table app-role perimeter changed';
  end if;

  if exists (
    select 1
    from information_schema.columns column_row
    where column_row.table_schema = 'editorial'
      and column_row.table_name in (
        'playlist_resources',
        'audio_publication_resources'
      )
      and column_row.column_name in (
        'current_working_version_id',
        'current_submitted_version_id',
        'current_approved_version_id',
        'current_published_version_id'
      )
  ) then
    raise exception
      'PHASE_7A_K4C_AR3_FAIL: Playlist/Audio pointer compatibility debt regressed';
  end if;

  if to_regclass('video.review_events') is not null
     or to_regclass('video.lifecycle_events') is not null
     or to_regclass('video.publication_review_events') is not null
     or to_regclass('video.publication_lifecycle_events') is not null
  then
    raise exception
      'PHASE_7A_K4C_AR3_FAIL: typed Video event authority exists';
  end if;
end;
$phase_7a_k4c_ar3_verify$;

select
  'PHASE_7A_K4C_AR3_ARTICLE_CROSS_SYSTEM_READER_CONVERGENCE_TYPED_EVENT_RETIREMENT_PASS'
    as verification_result,
  (select count(*) from editorial.article_lifecycle_events)
    as article_typed_lifecycle_event_count,
  (
    select count(*)
    from editorial.resource_lifecycle_events event_row
    join editorial.resources resource_row
      on resource_row.id = event_row.resource_id
    where resource_row.resource_kind = 'article'
  ) as article_shared_lifecycle_event_count,
  (
    select count(*)
    from pg_proc procedure_row
    where procedure_row.prokind in ('f','p')
      and pg_get_functiondef(procedure_row.oid)
        ~ 'editorial[.]article_lifecycle_events'
  ) as remaining_live_typed_article_dependency_count;

rollback;
