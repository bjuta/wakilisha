begin;
set local transaction read only;
set local statement_timeout = '60s';

do $phase_7a_k4b_verify$
declare
  v_definition text;
  v_count bigint;
begin
  if to_regprocedure(
    'public.snapshot_video_publication_working_version(uuid,bigint,text,uuid)'
  ) is null
     or to_regprocedure(
       'public.submit_video_publication_for_review(uuid,bigint,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.review_video_publication(uuid,bigint,uuid,text,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.publish_video_publication_version(uuid,bigint,uuid,text,text,uuid)'
     ) is null
  then
    raise exception
      'PHASE_7A_K4B_FAIL: governed Video lifecycle RPCs are incomplete';
  end if;

  if to_regclass('video.publication_review_events') is not null
     or to_regclass('video.publication_lifecycle_events') is not null
  then
    raise exception
      'PHASE_7A_K4B_FAIL: typed Video event authority exists';
  end if;

  if exists (
    select 1
    from information_schema.columns column_row
    where column_row.table_schema = 'video'
      and column_row.table_name = 'publications'
      and column_row.column_name in (
        'status',
        'lifecycle_status',
        'current_working_version_id',
        'current_submitted_version_id',
        'current_approved_version_id',
        'current_published_version_id'
      )
  ) then
    raise exception
      'PHASE_7A_K4B_FAIL: mutable Video lifecycle duplication exists';
  end if;

  select count(*)
  into v_count
  from platform_private.command_types command_type
  where command_type.command_type in (
    'video.publication.version.snapshot_working',
    'video.publication.review.submit',
    'video.publication.review.decide',
    'video.publication.publish'
  )
    and command_type.enabled;

  if v_count <> 4 then
    raise exception
      'PHASE_7A_K4B_FAIL: Video lifecycle command vocabulary is incomplete';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'editorial'
      and p.proname = 'current_user_can_participate_video_review'
      and p.prosecdef
      and p.proconfig @> array[
        'search_path=pg_catalog, public, editorial'
      ]
  ) then
    raise exception
      'PHASE_7A_K4B_FAIL: Video review participation helper is not hardened';
  end if;

  if has_function_privilege(
       'anon',
       'public.snapshot_video_publication_working_version(uuid,bigint,text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.submit_video_publication_for_review(uuid,bigint,text,text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.review_video_publication(uuid,bigint,uuid,text,text,text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.publish_video_publication_version(uuid,bigint,uuid,text,text,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.snapshot_video_publication_working_version(uuid,bigint,text,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.submit_video_publication_for_review(uuid,bigint,text,text,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.review_video_publication(uuid,bigint,uuid,text,text,text,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.publish_video_publication_version(uuid,bigint,uuid,text,text,uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'PHASE_7A_K4B_FAIL: Video lifecycle RPC ACL boundary is invalid';
  end if;

  select pg_get_functiondef(
    'video.insert_current_publication_snapshot(uuid,bigint,text,uuid)'::regprocedure
  )
  into v_definition;

  if position('video.publication_version_caption_tracks' in v_definition) = 0
     or position('video.publication_version_chapters' in v_definition) = 0
     or position('copy_current_media_usage_to_version' in v_definition) = 0
  then
    raise exception
      'PHASE_7A_K4B_FAIL: working snapshot does not freeze full typed/Media identity';
  end if;

  select pg_get_functiondef(
    'public.submit_video_publication_for_review(uuid,bigint,text,text,uuid)'::regprocedure
  )
  into v_definition;

  if position('current_working_version_id' in v_definition) = 0
     or position('current_submitted_version_id' in v_definition) = 0
     or position('editorial.resource_lifecycle_events' in v_definition) = 0
     or position('editorial.resource_review_events' in v_definition) = 0
     or position('video_working_version_stale' in v_definition) = 0
  then
    raise exception
      'PHASE_7A_K4B_FAIL: submit is not exact-working/shared-history authority';
  end if;

  select pg_get_functiondef(
    'public.review_video_publication(uuid,bigint,uuid,text,text,text,uuid)'::regprocedure
  )
  into v_definition;

  if position('current_submitted_version_id' in v_definition) = 0
     or position('current_approved_version_id' in v_definition) = 0
     or position('video_submitted_version_stale' in v_definition) = 0
     or position('editorial.resource_review_events' in v_definition) = 0
  then
    raise exception
      'PHASE_7A_K4B_FAIL: review is not exact-submitted/shared-history authority';
  end if;

  select pg_get_functiondef(
    'public.publish_video_publication_version(uuid,bigint,uuid,text,text,uuid)'::regprocedure
  )
  into v_definition;

  if position('current_approved_version_id' in v_definition) = 0
     or position('current_published_version_id' in v_definition) = 0
     or position('assert_publishable_publication_version' in v_definition) = 0
     or position('editorial.resource_lifecycle_events' in v_definition) = 0
  then
    raise exception
      'PHASE_7A_K4B_FAIL: publish is not exact-approved/shared-history authority';
  end if;

  if exists (
    select 1
    from editorial.resource_versions global_version
    join video.publication_versions video_version
      on video_version.id = global_version.id
    where global_version.resource_id <> video_version.resource_id
      or global_version.version_type <> 'video_publication_version'
      or global_version.version_kind <> video_version.version_kind
      or global_version.version_number <> video_version.version_number
      or global_version.content_fingerprint <> video_version.content_fingerprint
  ) then
    raise exception
      'PHASE_7A_K4B_FAIL: Video Resource Version envelope drift exists';
  end if;

  if exists (
    select 1
    from editorial.resource_lifecycle_events event_row
    join editorial.resources resource_row
      on resource_row.id = event_row.resource_id
    where resource_row.resource_kind in (
      'standalone_video',
      'video_episode'
    )
      and event_row.legacy_source_authority is not null
  ) or exists (
    select 1
    from editorial.resource_review_events event_row
    join editorial.resources resource_row
      on resource_row.id = event_row.resource_id
    where resource_row.resource_kind in (
      'standalone_video',
      'video_episode'
    )
      and event_row.legacy_source_authority is not null
  ) then
    raise exception
      'PHASE_7A_K4B_FAIL: Video shared events claim legacy typed authority';
  end if;
end;
$phase_7a_k4b_verify$;

select
  'PHASE_7A_K4B_VIDEO_GOVERNED_LIFECYCLE_COMMANDS_PASS'
    as verification_result,
  (
    select count(*)
    from video.publication_versions
  ) as video_version_count,
  (
    select count(*)
    from editorial.resource_lifecycle_events event_row
    join editorial.resources resource_row
      on resource_row.id = event_row.resource_id
    where resource_row.resource_kind in (
      'standalone_video',
      'video_episode'
    )
  ) as video_shared_lifecycle_event_count,
  (
    select count(*)
    from editorial.resource_review_events event_row
    join editorial.resources resource_row
      on resource_row.id = event_row.resource_id
    where resource_row.resource_kind in (
      'standalone_video',
      'video_episode'
    )
  ) as video_shared_review_event_count;

rollback;
