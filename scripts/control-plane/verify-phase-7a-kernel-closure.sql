begin;
set local transaction read only;
set local statement_timeout = '120s';
set local lock_timeout = '5s';

do $phase_7a_kernel_closure_verify$
declare
  v_definition text;
  v_count bigint;
begin
  if to_regclass('editorial.resource_versions') is null
     or to_regclass('editorial.resource_lifecycle_events') is null
     or to_regclass('editorial.resource_review_events') is null
  then
    raise exception 'PHASE_7A_KERNEL_CLOSURE_FAIL: shared Resource kernel authority is incomplete';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema='editorial'
      and table_name in ('playlist_resources','audio_publication_resources','video_publication_resources')
      and column_name in (
        'current_working_version_id',
        'current_submitted_version_id',
        'current_approved_version_id',
        'current_published_version_id'
      )
  ) then
    raise exception 'PHASE_7A_KERNEL_CLOSURE_FAIL: typed lifecycle pointer compatibility exists';
  end if;

  if exists (
    select 1
    from pg_trigger
    where not tgisinternal
      and tgname in (
        'playlist_resources_sync_shared_lifecycle',
        'audio_publication_resources_sync_shared_lifecycle',
        'resources_sync_typed_lifecycle_compatibility'
      )
  ) then
    raise exception 'PHASE_7A_KERNEL_CLOSURE_FAIL: lifecycle pointer compatibility trigger exists';
  end if;

  if to_regprocedure('editorial.sync_resource_lifecycle_from_typed_binding()') is not null
     or to_regprocedure('editorial.sync_typed_lifecycle_from_resource()') is not null
  then
    raise exception 'PHASE_7A_KERNEL_CLOSURE_FAIL: lifecycle pointer compatibility helper exists';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where p.prokind in ('f','p')
      and n.nspname not in ('pg_catalog','information_schema')
      and (
        p.prosrc ilike '%editorial.playlist_review_events%'
        or p.prosrc ilike '%editorial.playlist_lifecycle_events%'
        or p.prosrc ilike '%audio.publication_review_events%'
        or p.prosrc ilike '%audio.publication_lifecycle_events%'
        or p.prosrc ilike '%editorial.article_lifecycle_events%'
      )
  ) then
    raise exception 'PHASE_7A_KERNEL_CLOSURE_FAIL: live typed event-table dependency exists';
  end if;

  if to_regclass('video.review_events') is not null
     or to_regclass('video.lifecycle_events') is not null
     or to_regclass('video.publication_review_events') is not null
     or to_regclass('video.publication_lifecycle_events') is not null
  then
    raise exception 'PHASE_7A_KERNEL_CLOSURE_FAIL: typed Video event authority exists';
  end if;

  v_definition := pg_get_functiondef(
    'public.snapshot_audio_publication_working_version(uuid,bigint,text,uuid)'::regprocedure
  );
  if position('v_current.source_authority_revision' in v_definition)=0
     or position('v_publication.authority_revision' in v_definition)=0
  then
    raise exception 'PHASE_7A_KERNEL_CLOSURE_FAIL: Audio working-snapshot reuse is not revision-safe';
  end if;

  v_definition := pg_get_functiondef(
    'public.submit_article_for_review(uuid,bigint,text)'::regprocedure
  );
  if position('v_working_version.version_kind = ''correction''' in v_definition)=0
     or position('editorial.copy_article_lifecycle_version' in v_definition)=0
  then
    raise exception 'PHASE_7A_KERNEL_CLOSURE_FAIL: correction submit does not preserve correction fingerprint';
  end if;

  if to_regclass('editorial.article_lifecycle_events') is null
     or to_regclass('editorial.playlist_lifecycle_events') is null
     or to_regclass('editorial.playlist_review_events') is null
     or to_regclass('audio.publication_lifecycle_events') is null
     or to_regclass('audio.publication_review_events') is null
  then
    raise exception 'PHASE_7A_KERNEL_CLOSURE_FAIL: retained historical evidence table is missing';
  end if;

  if exists (
    select 1
    from pg_policies
    where (schemaname,tablename) in (
      ('editorial','article_lifecycle_events'),
      ('editorial','playlist_lifecycle_events'),
      ('editorial','playlist_review_events'),
      ('audio','publication_lifecycle_events'),
      ('audio','publication_review_events')
    )
  ) then
    raise exception 'PHASE_7A_KERNEL_CLOSURE_FAIL: retained historical event table has a live policy';
  end if;

  select count(*) into v_count
  from pg_trigger
  where not tgisinternal
    and tgname in (
      'article_lifecycle_events_historical_freeze',
      'playlist_lifecycle_events_historical_freeze',
      'playlist_review_events_historical_freeze',
      'audio_publication_lifecycle_events_historical_freeze',
      'audio_publication_review_events_historical_freeze'
    );
  if v_count <> 5 then
    raise exception 'PHASE_7A_KERNEL_CLOSURE_FAIL: historical event freeze trigger count is %',v_count;
  end if;

  if has_function_privilege(
       'anon',
       'platform_private.reject_frozen_historical_event_mutation()',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.reject_frozen_historical_event_mutation()',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.reject_frozen_historical_event_mutation()',
       'EXECUTE'
     )
  then
    raise exception 'PHASE_7A_KERNEL_CLOSURE_FAIL: historical freeze helper leaked EXECUTE';
  end if;

  if has_table_privilege('anon','editorial.article_lifecycle_events','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','editorial.article_lifecycle_events','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('service_role','editorial.article_lifecycle_events','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('anon','editorial.playlist_lifecycle_events','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','editorial.playlist_lifecycle_events','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('service_role','editorial.playlist_lifecycle_events','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('anon','editorial.playlist_review_events','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','editorial.playlist_review_events','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('service_role','editorial.playlist_review_events','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('anon','audio.publication_lifecycle_events','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','audio.publication_lifecycle_events','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('service_role','audio.publication_lifecycle_events','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('anon','audio.publication_review_events','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated','audio.publication_review_events','SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('service_role','audio.publication_review_events','SELECT,INSERT,UPDATE,DELETE')
  then
    raise exception 'PHASE_7A_KERNEL_CLOSURE_FAIL: historical typed event ACL is open';
  end if;

  if exists (
    select 1
    from editorial.article_lifecycle_events source
    left join editorial.resource_lifecycle_events shared
      on shared.legacy_source_authority='article_lifecycle'
     and shared.legacy_source_event_id=source.id
    where shared.id is null
  ) or exists (
    select 1
    from editorial.playlist_lifecycle_events source
    left join editorial.resource_lifecycle_events shared
      on shared.legacy_source_authority='playlist_lifecycle'
     and shared.legacy_source_event_id=source.id
    where shared.id is null
  ) or exists (
    select 1
    from editorial.playlist_review_events source
    left join editorial.resource_review_events shared
      on shared.legacy_source_authority='playlist_review'
     and shared.legacy_source_event_id=source.id
    where shared.id is null
  ) or exists (
    select 1
    from audio.publication_review_events source
    left join editorial.resource_review_events shared
      on shared.legacy_source_authority='audio_publication_review'
     and shared.legacy_source_event_id=source.id
    where shared.id is null
  ) then
    raise exception 'PHASE_7A_KERNEL_CLOSURE_FAIL: retained typed event row lacks shared canonical mapping';
  end if;
end;
$phase_7a_kernel_closure_verify$;

select
  'PHASE_7A_KERNEL_CLOSURE_PASS' as verification_result,
  (select count(*) from editorial.resource_versions) as resource_version_count,
  (select count(*) from editorial.resource_lifecycle_events) as shared_lifecycle_event_count,
  (select count(*) from editorial.resource_review_events) as shared_review_event_count,
  (
    select coalesce(sum(pg_total_relation_size(c.oid)),0)
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where c.relkind='r'
      and (n.nspname,c.relname) in (
        ('editorial','article_lifecycle_events'),
        ('editorial','playlist_lifecycle_events'),
        ('editorial','playlist_review_events'),
        ('audio','publication_lifecycle_events'),
        ('audio','publication_review_events')
      )
  ) as retained_historical_bytes;

rollback;
