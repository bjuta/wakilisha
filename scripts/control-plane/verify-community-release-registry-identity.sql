with defs as (
  select
    pg_get_functiondef(
      'public.community_get_thread_by_entity(text,text,text)'::regprocedure
    ) as read_def,
    pg_get_functiondef(
      'public.community_get_or_create_thread(text,text,text,text,text)'::regprocedure
    ) as write_def
), release_threads as (
  select
    thread.id,
    thread.entity_id,
    thread.entity_slug,
    thread.entity_url,
    release.id as release_id
  from public.community_threads thread
  left join public.registry_releases release
    on release.id::text = thread.entity_id
   and release.status = 'active'
  where thread.entity_type = 'release'
)
select jsonb_build_object(
  'release_threads',
    (select count(*) from release_threads),
  'uuid_bound_release_threads',
    (select count(*) from release_threads where release_id is not null),
  'unresolved_release_threads',
    (select count(*) from release_threads where release_id is null),
  'duplicate_release_thread_owners',
    (
      select count(*)
      from (
        select entity_id
        from release_threads
        group by entity_id
        having count(*) > 1
      ) duplicate_owner
    ),
  'release_slug_global_unique_index_present',
    exists (
      select 1
      from pg_indexes
      where schemaname = 'public'
        and tablename = 'community_threads'
        and indexname = 'community_threads_non_track_entity_slug_key'
    ),
  'scoped_slug_index_present',
    exists (
      select 1
      from pg_indexes
      where schemaname = 'public'
        and tablename = 'community_threads'
        and indexname = 'community_threads_non_track_release_entity_slug_key'
        and indexdef like '%entity_type%track%release%'
    ),
  'read_rpc_release_uuid_authority',
    position('v_release_id' in (select read_def from defs)) > 0
    and position("thread.entity_id = v_release_id::text" in (select read_def from defs)) > 0,
  'write_rpc_release_uuid_authority',
    position('v_canonical_release_id' in (select write_def from defs)) > 0
    and position("'release:'" in (select write_def from defs)) > 0
) as state;
