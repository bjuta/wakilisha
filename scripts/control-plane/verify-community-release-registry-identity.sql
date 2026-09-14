do $verify$
declare
  v_read_def text;
  v_write_def text;
  v_release_threads bigint;
  v_uuid_bound_release_threads bigint;
  v_unresolved_release_threads bigint;
  v_duplicate_release_thread_owners bigint;
begin
  select
    pg_get_functiondef(
      'public.community_get_thread_by_entity(text,text,text)'::regprocedure
    ),
    pg_get_functiondef(
      'public.community_get_or_create_thread(text,text,text,text,text)'::regprocedure
    )
  into
    v_read_def,
    v_write_def;

  select
    count(*),
    count(*) filter (
      where release.id is not null
    ),
    count(*) filter (
      where release.id is null
    )
  into
    v_release_threads,
    v_uuid_bound_release_threads,
    v_unresolved_release_threads
  from public.community_threads thread
  left join public.registry_releases release
    on release.id::text = thread.entity_id
   and release.status = 'active'
  where thread.entity_type = 'release';

  select count(*)
  into v_duplicate_release_thread_owners
  from (
    select thread.entity_id
    from public.community_threads thread
    where thread.entity_type = 'release'
    group by thread.entity_id
    having count(*) > 1
  ) duplicate_owner;

  if v_unresolved_release_threads <> 0 then
    raise exception
      'STOP: % Release thread(s) are not bound to an active Registry Release UUID',
      v_unresolved_release_threads;
  end if;

  if v_release_threads <> v_uuid_bound_release_threads then
    raise exception
      'STOP: Release thread UUID binding mismatch % total / % UUID-bound',
      v_release_threads,
      v_uuid_bound_release_threads;
  end if;

  if v_duplicate_release_thread_owners <> 0 then
    raise exception
      'STOP: % duplicate Release thread owner(s) remain',
      v_duplicate_release_thread_owners;
  end if;

  if exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'community_threads'
      and indexname = 'community_threads_non_track_entity_slug_key'
  ) then
    raise exception
      'STOP: global non-Track slug uniqueness index still exists';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'community_threads'
      and indexname = 'community_threads_non_track_release_entity_slug_key'
      and indexdef like '%entity_type%track%release%'
  ) then
    raise exception
      'STOP: scoped non-Track/non-Release slug index is missing';
  end if;

  if position(
    'v_release_id'
    in v_read_def
  ) = 0
  or position(
    'thread.entity_id = v_release_id::text'
    in v_read_def
  ) = 0 then
    raise exception
      'STOP: Release read RPC is not Registry UUID authoritative';
  end if;

  if position(
    'v_canonical_release_id'
    in v_write_def
  ) = 0
  or position(
    '''release:'''
    in v_write_def
  ) = 0 then
    raise exception
      'STOP: Release write RPC is not Registry UUID authoritative';
  end if;

  raise notice
    'PASS: Release thread Registry identity verifier; % total / % UUID-bound / 0 unresolved / 0 duplicate owners',
    v_release_threads,
    v_uuid_bound_release_threads;
end;
$verify$;
