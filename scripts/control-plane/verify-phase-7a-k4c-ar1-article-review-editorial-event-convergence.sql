begin;
set local transaction read only;
set local statement_timeout = '120s';
set local lock_timeout = '5s';

do $phase_7a_k4c_ar1_verify$
declare
  v_count bigint;
  v_names text[];
  v_definition text;
begin
  if to_regclass('editorial.article_lifecycle_events') is null
     or to_regclass('editorial.resource_lifecycle_events') is null
     or to_regclass('editorial.resource_review_events') is null
     or to_regprocedure(
       'platform_private.begin_legacy_authenticated_article_command(text,uuid,jsonb)'
     ) is null
     or to_regprocedure(
       'public.submit_article_for_review(uuid,bigint,text)'
     ) is null
     or to_regprocedure(
       'public.request_article_changes(uuid,uuid,text)'
     ) is null
     or to_regprocedure(
       'public.approve_article_version(uuid,uuid,text)'
     ) is null
     or to_regprocedure(
       'public.accept_article_suggestion(uuid,bigint,text)'
     ) is null
     or to_regprocedure(
       'public.list_article_lifecycle_events(uuid,integer)'
     ) is null
  then
    raise exception
      'PHASE_7A_K4C_AR1_FAIL: Article convergence function/relation set is incomplete';
  end if;

  -- Every historical typed Article lifecycle row remains represented exactly
  -- in the canonical shared lifecycle ledger.
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
      'PHASE_7A_K4C_AR1_FAIL: typed Article lifecycle history is not fully mapped';
  end if;

  -- AR1 retires only its four review-side typed writers. AR2's six
  -- publication/scheduling writers remain intentionally unchanged.
  select
    count(*),
    array_agg(
      procedure_row.proname
      order by procedure_row.proname
    )
  into
    v_count,
    v_names
  from pg_proc procedure_row
  join pg_namespace namespace_row
    on namespace_row.oid = procedure_row.pronamespace
  where procedure_row.prokind in ('f','p')
    and pg_get_functiondef(procedure_row.oid)
      ~* 'insert[[:space:]]+into[[:space:]]+editorial[.]article_lifecycle_events';

  if v_count <> 6
     or v_names is distinct from array[
       'archive_article',
       'publish_article_version',
       'publish_due_article_publications',
       'restore_article_from_archive',
       'schedule_article_publication',
       'unpublish_article'
     ]::text[]
  then
    raise exception
      'PHASE_7A_K4C_AR1_FAIL: typed Article writer boundary is invalid: % / %',
      v_count,
      v_names;
  end if;

  -- Submit: preserve old signature/result while writing canonical lifecycle
  -- and review history through one internal receipt.
  select pg_get_functiondef(
    'public.submit_article_for_review(uuid,bigint,text)'::regprocedure
  )
  into v_definition;

  if position('platform_private.begin_legacy_authenticated_article_command' in v_definition) = 0
     or position('article.review.submit' in v_definition) = 0
     or position('editorial.append_resource_lifecycle_event' in v_definition) = 0
     or position('editorial.append_resource_review_event' in v_definition) = 0
     or position('current_submitted_version_id = v_version_id' in v_definition) = 0
     or position('insert_article_lifecycle_version_from_article' in v_definition) = 0
     or position('insert into editorial.article_lifecycle_events' in v_definition) <> 0
  then
    raise exception
      'PHASE_7A_K4C_AR1_FAIL: Article submit shared-event contract drifted';
  end if;

  -- Changes requested: target exact reviewed version, preserve required note,
  -- and return Article to draft.
  select pg_get_functiondef(
    'public.request_article_changes(uuid,uuid,text)'::regprocedure
  )
  into v_definition;

  if position('Requested changes note is required' in v_definition) = 0
     or position('article.review.request_changes' in v_definition) = 0
     or position('v_resource.current_submitted_version_id' in v_definition) = 0
     or position('editorial.append_resource_lifecycle_event' in v_definition) = 0
     or position('editorial.append_resource_review_event' in v_definition) = 0
     or position('insert into editorial.article_lifecycle_events' in v_definition) <> 0
  then
    raise exception
      'PHASE_7A_K4C_AR1_FAIL: Article changes-requested shared-event contract drifted';
  end if;

  -- Approval keeps the copied immutable approved version as lifecycle result
  -- and binds the exact reviewed source as review target.
  select pg_get_functiondef(
    'public.approve_article_version(uuid,uuid,text)'::regprocedure
  )
  into v_definition;

  if position('article.review.approve' in v_definition) = 0
     or position('editorial.copy_article_lifecycle_version' in v_definition) = 0
     or position('current_approved_version_id = v_version_id' in v_definition) = 0
     or position('v_source_version_id' in v_definition) = 0
     or position('editorial.append_resource_review_event' in v_definition) = 0
     or position('insert into editorial.article_lifecycle_events' in v_definition) <> 0
  then
    raise exception
      'PHASE_7A_K4C_AR1_FAIL: Article approval shared-event contract drifted';
  end if;

  -- Accepted suggestions preserve detailed suggestion/thread authority and
  -- add one shared review decision plus one shared lifecycle transition.
  select pg_get_functiondef(
    'public.accept_article_suggestion(uuid,bigint,text)'::regprocedure
  )
  into v_definition;

  if position('article.review.suggestion.accept' in v_definition) = 0
     or position('editorial.apply_article_review_snapshot' in v_definition) = 0
     or position('editorial.article_suggestion_events' in v_definition) = 0
     or position('remaining_open_suggestions_marked_stale' in v_definition) = 0
     or position('editorial.append_resource_lifecycle_event' in v_definition) = 0
     or position('editorial.append_resource_review_event' in v_definition) = 0
     or position('v_new_version_id' in v_definition) = 0
     or position('insert into editorial.article_lifecycle_events' in v_definition) <> 0
  then
    raise exception
      'PHASE_7A_K4C_AR1_FAIL: Article accepted-suggestion shared-event contract drifted';
  end if;

  -- Historical/new lifecycle listing keeps its public shape but reads the
  -- canonical shared ledger.
  select pg_get_functiondef(
    'public.list_article_lifecycle_events(uuid,integer)'::regprocedure
  )
  into v_definition;

  if position('editorial.resource_lifecycle_events' in v_definition) = 0
     or position('editorial.article_resources' in v_definition) = 0
     or position('editorial.article_versions' in v_definition) = 0
     or position('auth.users' in v_definition) = 0
     or position('editorial.article_lifecycle_events' in v_definition) <> 0
  then
    raise exception
      'PHASE_7A_K4C_AR1_FAIL: Article lifecycle reader is not shared-history authority';
  end if;

  -- The bridge is internal-only and cannot become a new PostgREST surface.
  if not exists (
    select 1
    from pg_proc procedure_row
    where procedure_row.oid =
      'platform_private.begin_legacy_authenticated_article_command(text,uuid,jsonb)'::regprocedure
      and procedure_row.prosecdef
      and coalesce(procedure_row.proconfig, '{}'::text[]) @>
        array[
          'search_path=pg_catalog, auth, platform_private, extensions'
        ]::text[]
  ) then
    raise exception
      'PHASE_7A_K4C_AR1_FAIL: legacy Article command bridge security metadata drifted';
  end if;

  if has_function_privilege(
       'anon',
       'platform_private.begin_legacy_authenticated_article_command(text,uuid,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.begin_legacy_authenticated_article_command(text,uuid,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.begin_legacy_authenticated_article_command(text,uuid,jsonb)',
       'EXECUTE'
     )
  then
    raise exception
      'PHASE_7A_K4C_AR1_FAIL: legacy Article command bridge execution perimeter is too broad';
  end if;

  -- The existing public RPC execution perimeter is preserved.
  if has_function_privilege(
       'anon',
       'public.submit_article_for_review(uuid,bigint,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.request_article_changes(uuid,uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.approve_article_version(uuid,uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.accept_article_suggestion(uuid,bigint,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.list_article_lifecycle_events(uuid,integer)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.submit_article_for_review(uuid,bigint,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.request_article_changes(uuid,uuid,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.approve_article_version(uuid,uuid,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.accept_article_suggestion(uuid,bigint,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.list_article_lifecycle_events(uuid,integer)',
       'EXECUTE'
     )
  then
    raise exception
      'PHASE_7A_K4C_AR1_FAIL: Article public RPC execution perimeter drifted';
  end if;

  -- AR1 command vocabulary is narrow and explicit.
  select count(*)
  into v_count
  from platform_private.command_types command_type
  where command_type.command_type in (
    'article.review.submit',
    'article.review.request_changes',
    'article.review.approve',
    'article.review.suggestion.accept'
  )
    and command_type.enabled;

  if v_count <> 4 then
    raise exception
      'PHASE_7A_K4C_AR1_FAIL: expected four enabled AR1 Article command types, found %',
      v_count;
  end if;

  -- Shared event primitives remain byte-identical to the accepted 61/A3
  -- authority.
  if md5(
       pg_get_functiondef(
         'editorial.append_resource_lifecycle_event(uuid,uuid,text,text,text,text,jsonb,uuid,uuid,uuid)'::regprocedure
       )
     ) <> 'd84d503da70733c010a93025bca7cda7'
     or md5(
       pg_get_functiondef(
         'editorial.append_resource_review_event(uuid,uuid,uuid,text,text,text,text,uuid,uuid,uuid)'::regprocedure
       )
     ) <> '54b3f889a5b91bf399bb64b52b830134'
  then
    raise exception
      'PHASE_7A_K4C_AR1_FAIL: shared Resource event helpers changed';
  end if;

  -- Deferred AR2 authority remains byte-identical in AR1.
  if md5(
       pg_get_functiondef(
         'public.publish_article_version(uuid,uuid,timestamp with time zone,text)'::regprocedure
       )
     ) <> 'd3c2a715d0596e4033e7e319c0b3d4f4'
     or md5(
       pg_get_functiondef(
         'public.publish_due_article_publications(integer)'::regprocedure
       )
     ) <> '09b9ecbbec742481f6146fdaa250b435'
     or md5(
       pg_get_functiondef(
         'public.schedule_article_publication(uuid,uuid,timestamp with time zone,text)'::regprocedure
       )
     ) <> '105d47e009ec279e3a7e5a362662a31d'
     or md5(
       pg_get_functiondef(
         'public.unpublish_article(uuid,text)'::regprocedure
       )
     ) <> '8f52aca8823b4d23ec995526745176dc'
     or md5(
       pg_get_functiondef(
         'public.archive_article(uuid,text)'::regprocedure
       )
     ) <> 'bc19cc8ba0945d118d743eb709b80d2d'
     or md5(
       pg_get_functiondef(
         'public.restore_article_from_archive(uuid,text)'::regprocedure
       )
     ) <> 'd4239c78dd5cbb2f7da7823b7cf60873'
  then
    raise exception
      'PHASE_7A_K4C_AR1_FAIL: deferred AR2 publication authority changed';
  end if;

  -- Shared event numbers remain contiguous for every Resource.
  if exists (
    select 1
    from (
      select
        resource_id,
        event_number,
        row_number() over (
          partition by resource_id
          order by event_number
        ) as expected_number
      from editorial.resource_lifecycle_events
    ) sequence_row
    where sequence_row.event_number <> sequence_row.expected_number
  ) or exists (
    select 1
    from (
      select
        resource_id,
        event_number,
        row_number() over (
          partition by resource_id
          order by event_number
        ) as expected_number
      from editorial.resource_review_events
    ) sequence_row
    where sequence_row.event_number <> sequence_row.expected_number
  ) then
    raise exception
      'PHASE_7A_K4C_AR1_FAIL: shared Resource event sequence is not contiguous';
  end if;

  -- Playlist/Audio pointer retirement and Video no-typed-ledger ratchets stay
  -- closed.
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
      'PHASE_7A_K4C_AR1_FAIL: Playlist/Audio pointer compatibility debt regressed';
  end if;

  if to_regclass('video.review_events') is not null
     or to_regclass('video.lifecycle_events') is not null
     or to_regclass('video.publication_review_events') is not null
     or to_regclass('video.publication_lifecycle_events') is not null
  then
    raise exception
      'PHASE_7A_K4C_AR1_FAIL: typed Video event authority exists';
  end if;
end;
$phase_7a_k4c_ar1_verify$;

select
  'PHASE_7A_K4C_AR1_ARTICLE_REVIEW_EDITORIAL_EVENT_CONVERGENCE_PASS'
    as verification_result,
  (select count(*) from editorial.article_lifecycle_events)
    as article_typed_lifecycle_event_count,
  (
    select count(*)
    from editorial.resource_lifecycle_events event_row
    where event_row.resource_id in (
      select binding.resource_id
      from editorial.article_resources binding
    )
  ) as article_shared_lifecycle_event_count,
  (
    select count(*)
    from editorial.resource_review_events event_row
    where event_row.resource_id in (
      select binding.resource_id
      from editorial.article_resources binding
    )
  ) as article_shared_review_event_count,
  (
    select count(*)
    from pg_proc procedure_row
    where procedure_row.prokind in ('f','p')
      and pg_get_functiondef(procedure_row.oid)
        ~* 'insert[[:space:]]+into[[:space:]]+editorial[.]article_lifecycle_events'
  ) as remaining_typed_article_writer_count;

rollback;
