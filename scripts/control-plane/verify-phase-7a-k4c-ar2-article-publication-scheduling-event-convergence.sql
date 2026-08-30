begin;
set local transaction read only;
set local statement_timeout = '120s';
set local lock_timeout = '5s';

do $phase_7a_k4c_ar2_verify$
declare
  v_count bigint;
  v_names text[];
  v_definition text;
begin
  if to_regclass('editorial.article_lifecycle_events') is null
     or to_regclass('editorial.resource_lifecycle_events') is null
     or to_regclass('editorial.article_scheduled_publications') is null
     or to_regclass('public.wk_article_publication_snapshots') is null
     or to_regprocedure(
       'platform_private.begin_legacy_service_article_command(text,uuid,uuid,jsonb)'
     ) is null
     or to_regprocedure(
       'public.publish_article_version(uuid,uuid,timestamp with time zone,text)'
     ) is null
     or to_regprocedure(
       'public.schedule_article_publication(uuid,uuid,timestamp with time zone,text)'
     ) is null
     or to_regprocedure(
       'public.publish_due_article_publications(integer)'
     ) is null
     or to_regprocedure(
       'public.unpublish_article(uuid,text)'
     ) is null
     or to_regprocedure(
       'public.archive_article(uuid,text)'
     ) is null
     or to_regprocedure(
       'public.restore_article_from_archive(uuid,text)'
     ) is null
  then
    raise exception
      'PHASE_7A_K4C_AR2_FAIL: Article publication convergence surface is incomplete';
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
      'PHASE_7A_K4C_AR2_FAIL: typed Article lifecycle history is not fully mapped';
  end if;

  select
    count(*),
    array_agg(procedure_row.proname order by procedure_row.proname)
  into
    v_count,
    v_names
  from pg_proc procedure_row
  where procedure_row.prokind in ('f','p')
    and pg_get_functiondef(procedure_row.oid)
      ~* 'insert[[:space:]]+into[[:space:]]+editorial[.]article_lifecycle_events';

  if v_count <> 0 then
    raise exception
      'PHASE_7A_K4C_AR2_FAIL: typed Article lifecycle writers remain: % / %',
      v_count,
      v_names;
  end if;

  foreach v_definition in array array[
    pg_get_functiondef(
      'public.publish_article_version(uuid,uuid,timestamp with time zone,text)'::regprocedure
    ),
    pg_get_functiondef(
      'public.schedule_article_publication(uuid,uuid,timestamp with time zone,text)'::regprocedure
    ),
    pg_get_functiondef(
      'public.publish_due_article_publications(integer)'::regprocedure
    ),
    pg_get_functiondef(
      'public.unpublish_article(uuid,text)'::regprocedure
    ),
    pg_get_functiondef(
      'public.archive_article(uuid,text)'::regprocedure
    ),
    pg_get_functiondef(
      'public.restore_article_from_archive(uuid,text)'::regprocedure
    )
  ]
  loop
    if position('editorial.append_resource_lifecycle_event' in v_definition) = 0
       or position('platform_private.complete_resource_command' in v_definition) = 0
       or position('insert into editorial.article_lifecycle_events' in v_definition) <> 0
    then
      raise exception
        'PHASE_7A_K4C_AR2_FAIL: publication writer did not converge onto shared lifecycle authority';
    end if;
  end loop;

  select pg_get_functiondef(
    'public.publish_article_version(uuid,uuid,timestamp with time zone,text)'::regprocedure
  )
  into v_definition;

  if position('editorial.copy_article_lifecycle_version' in v_definition) = 0
     or position('editorial.publish_article_snapshot' in v_definition) = 0
     or position('current_published_version_id = v_version_id' in v_definition) = 0
     or position('article.publication.publish' in v_definition) = 0
     or position('publication_mode' in v_definition) = 0
  then
    raise exception
      'PHASE_7A_K4C_AR2_FAIL: direct publication contract drifted';
  end if;

  select pg_get_functiondef(
    'public.schedule_article_publication(uuid,uuid,timestamp with time zone,text)'::regprocedure
  )
  into v_definition;

  if position('version.version_kind = ''approved''' in v_definition) = 0
     or position('version.kind = ''approved''' in v_definition) <> 0
     or position('editorial.article_scheduled_publications' in v_definition) = 0
     or position('returning id' in v_definition) = 0
     or position('scheduledPublicationId' in v_definition) = 0
     or position('article.publication.schedule' in v_definition) = 0
  then
    raise exception
      'PHASE_7A_K4C_AR2_FAIL: scheduling contract or bounded version_kind repair drifted';
  end if;

  select pg_get_functiondef(
    'public.publish_due_article_publications(integer)'::regprocedure
  )
  into v_definition;

  if position('for update skip locked' in v_definition) = 0
     or position('platform_private.begin_legacy_service_article_command' in v_definition) = 0
     or position('platform_private.begin_legacy_authenticated_article_command' in v_definition) = 0
     or position('article.publication.publish_scheduled' in v_definition) = 0
     or position('scheduledPublicationId' in v_definition) = 0
     or position('status = ''published''' in v_definition) = 0
  then
    raise exception
      'PHASE_7A_K4C_AR2_FAIL: due-schedule publication contract drifted';
  end if;

  select count(*)
  into v_count
  from platform_private.command_types command_type
  where command_type.command_type in (
    'article.publication.publish',
    'article.publication.schedule',
    'article.publication.publish_scheduled',
    'article.publication.unpublish',
    'article.publication.archive',
    'article.publication.restore'
  )
    and command_type.enabled;

  if v_count <> 6 then
    raise exception
      'PHASE_7A_K4C_AR2_FAIL: expected six enabled AR2 Article command types, found %',
      v_count;
  end if;

  select pg_get_functiondef(
    'platform_private.begin_legacy_authenticated_article_command(text,uuid,jsonb)'::regprocedure
  )
  into v_definition;

  if position('article.review.submit' in v_definition) = 0
     or position('article.review.request_changes' in v_definition) = 0
     or position('article.review.approve' in v_definition) = 0
     or position('article.review.suggestion.accept' in v_definition) = 0
     or position('article.publication.publish' in v_definition) = 0
     or position('article.publication.schedule' in v_definition) = 0
     or position('article.publication.publish_scheduled' in v_definition) = 0
     or position('article.publication.unpublish' in v_definition) = 0
     or position('article.publication.archive' in v_definition) = 0
     or position('article.publication.restore' in v_definition) = 0
  then
    raise exception
      'PHASE_7A_K4C_AR2_FAIL: authenticated Article command bridge lost AR1 or AR2 vocabulary';
  end if;

  if not exists (
    select 1
    from pg_proc procedure_row
    where procedure_row.oid =
      'platform_private.begin_legacy_service_article_command(text,uuid,uuid,jsonb)'::regprocedure
      and procedure_row.prosecdef
      and coalesce(procedure_row.proconfig, '{}'::text[]) @>
        array[
          'search_path=pg_catalog, auth, platform_private, extensions'
        ]::text[]
  ) then
    raise exception
      'PHASE_7A_K4C_AR2_FAIL: legacy service Article command bridge security metadata drifted';
  end if;

  select pg_get_functiondef(
    'platform_private.begin_legacy_service_article_command(text,uuid,uuid,jsonb)'::regprocedure
  )
  into v_definition;

  if position('service:service_role' in v_definition) = 0
     or position('actor_user_id' in v_definition) = 0
     or position('null' in v_definition) = 0
     or position('legacy-scheduled-article:' in v_definition) = 0
     or position('scheduled_publication_id' in v_definition) = 0
     or position('platform_private.command_request_fingerprint' in v_definition) = 0
  then
    raise exception
      'PHASE_7A_K4C_AR2_FAIL: scheduled service command receipt contract drifted';
  end if;

  if has_function_privilege(
       'anon',
       'platform_private.begin_legacy_service_article_command(text,uuid,uuid,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.begin_legacy_service_article_command(text,uuid,uuid,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.begin_legacy_service_article_command(text,uuid,uuid,jsonb)',
       'EXECUTE'
     )
  then
    raise exception
      'PHASE_7A_K4C_AR2_FAIL: legacy service Article command bridge is exposed';
  end if;

  if has_function_privilege(
       'anon',
       'public.publish_article_version(uuid,uuid,timestamp with time zone,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.schedule_article_publication(uuid,uuid,timestamp with time zone,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.publish_due_article_publications(integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.unpublish_article(uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.archive_article(uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.restore_article_from_archive(uuid,text)',
       'EXECUTE'
     )
  then
    raise exception
      'PHASE_7A_K4C_AR2_FAIL: Article publication RPC execution widened to anon';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.publish_article_version(uuid,uuid,timestamp with time zone,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.schedule_article_publication(uuid,uuid,timestamp with time zone,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.publish_due_article_publications(integer)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.unpublish_article(uuid,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.archive_article(uuid,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.restore_article_from_archive(uuid,text)',
       'EXECUTE'
     )
  then
    raise exception
      'PHASE_7A_K4C_AR2_FAIL: accepted authenticated Article publication RPC access changed';
  end if;

  if md5(
       pg_get_functiondef(
         'editorial.append_resource_lifecycle_event(uuid,uuid,text,text,text,text,jsonb,uuid,uuid,uuid)'::regprocedure
       )
     ) <> 'd84d503da70733c010a93025bca7cda7'
     or md5(
       pg_get_functiondef(
         'editorial.publish_article_snapshot(uuid,timestamp with time zone,boolean)'::regprocedure
       )
     ) <> '790c6a5667abd56406ed6fe8eb174997'
     or md5(
       pg_get_functiondef(
         'platform_private.command_request_fingerprint(text,uuid,jsonb)'::regprocedure
       )
     ) <> 'e1272546e08c930febbbd694e968b8ca'
  then
    raise exception
      'PHASE_7A_K4C_AR2_FAIL: accepted shared publication/command primitive changed';
  end if;

  -- AR1 review RPCs stay byte-identical through AR2.
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
      'PHASE_7A_K4C_AR2_FAIL: AR1 Article review/list authority changed';
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
    and pg_get_functiondef(procedure_row.oid) ~ 'editorial[.]article_lifecycle_events'
    and not (
      pg_get_functiondef(procedure_row.oid)
        ~* 'insert[[:space:]]+into[[:space:]]+editorial[.]article_lifecycle_events'
    );

  if v_count <> 2
     or v_names is distinct from array[
       'editorial.correction_article_publication_proof',
       'editorial.derive_publishing_editorial_state'
     ]::text[]
  then
    raise exception
      'PHASE_7A_K4C_AR2_FAIL: deferred AR3 reader boundary is invalid: % / %',
      v_count,
      v_names;
  end if;

  if md5(
       pg_get_functiondef(
         'editorial.correction_article_publication_proof(uuid)'::regprocedure
       )
     ) <> '3bdd9467a857da7a8f6373a50e237295'
     or md5(
       pg_get_functiondef(
         'editorial.derive_publishing_editorial_state(uuid)'::regprocedure
       )
     ) <> 'f89b6060e68ae2e1154f689a741dc831'
  then
    raise exception
      'PHASE_7A_K4C_AR2_FAIL: deferred AR3 readers changed';
  end if;

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
  ) then
    raise exception
      'PHASE_7A_K4C_AR2_FAIL: shared lifecycle event numbering is not contiguous';
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
      'PHASE_7A_K4C_AR2_FAIL: Playlist/Audio pointer compatibility debt regressed';
  end if;

  if to_regclass('video.review_events') is not null
     or to_regclass('video.lifecycle_events') is not null
     or to_regclass('video.publication_review_events') is not null
     or to_regclass('video.publication_lifecycle_events') is not null
  then
    raise exception
      'PHASE_7A_K4C_AR2_FAIL: typed Video event authority exists';
  end if;
end;
$phase_7a_k4c_ar2_verify$;

select
  'PHASE_7A_K4C_AR2_ARTICLE_PUBLICATION_SCHEDULING_EVENT_CONVERGENCE_PASS'
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
    from pg_proc procedure_row
    where procedure_row.prokind in ('f','p')
      and pg_get_functiondef(procedure_row.oid)
        ~* 'insert[[:space:]]+into[[:space:]]+editorial[.]article_lifecycle_events'
  ) as remaining_typed_article_writer_count,
  (
    select count(*)
    from pg_proc procedure_row
    where procedure_row.prokind in ('f','p')
      and pg_get_functiondef(procedure_row.oid) ~ 'editorial[.]article_lifecycle_events'
      and not (
        pg_get_functiondef(procedure_row.oid)
          ~* 'insert[[:space:]]+into[[:space:]]+editorial[.]article_lifecycle_events'
      )
  ) as remaining_typed_article_reader_count;

rollback;
