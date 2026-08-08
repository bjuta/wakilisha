-- Verify Phase 5A Migration 208: Playlist authority foundation.
-- Read-only verification. Run only after the migration is applied.

do $verify_phase_5a_m208$
declare
  playlist_count bigint;
  item_count bigint;
  playlist_resource_count bigint;
  playlist_item_resource_count bigint;
  playlist_version_count bigint;
  playlist_version_item_count bigint;
  capability_count bigint;
  expected_role_grant_count bigint;
  actual_role_grant_count bigint;
  playlist_trigger_function text;
  playlist_item_trigger_function text;
  citation_constraint text;
  credit_constraint text;
  media_target_constraint text;
begin
  if to_regclass('editorial.playlist_item_resources') is null then
    raise exception 'FAIL: editorial.playlist_item_resources is missing';
  end if;

  if to_regclass('editorial.playlist_versions') is null then
    raise exception 'FAIL: editorial.playlist_versions is missing';
  end if;

  if to_regclass('editorial.playlist_version_items') is null then
    raise exception 'FAIL: editorial.playlist_version_items is missing';
  end if;

  select count(*) into playlist_count
  from public.wk_playlists;

  select count(*) into item_count
  from public.wk_playlist_items;

  select count(*) into playlist_resource_count
  from editorial.playlist_resources;

  select count(*) into playlist_item_resource_count
  from editorial.playlist_item_resources;

  select count(*) into playlist_version_count
  from editorial.playlist_versions;

  select count(*) into playlist_version_item_count
  from editorial.playlist_version_items;

  if playlist_count <> 0
     or item_count <> 0
     or playlist_resource_count <> 0
     or playlist_item_resource_count <> 0
     or playlist_version_count <> 0
     or playlist_version_item_count <> 0 then
    raise exception
      'FAIL: Expected empty canonical Playlist foundation, found playlists %, items %, playlist_resources %, item_resources %, versions %, version_items %',
      playlist_count,
      item_count,
      playlist_resource_count,
      playlist_item_resource_count,
      playlist_version_count,
      playlist_version_item_count;
  end if;

  if exists (
    select 1
    from editorial.resources
    where id = 'a0ba2456-07bb-4d20-8031-87dc8a998179'::uuid
  ) then
    raise exception 'FAIL: Fake Playlist Resource identity remains';
  end if;

  if not exists (
    select 1
    from editorial.resource_kinds
    where kind = 'playlist_item'
      and enabled
  ) then
    raise exception 'FAIL: playlist_item Resource kind is absent or disabled';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'wk_playlists'
      and column_name = 'authority_revision'
      and is_nullable = 'NO'
  ) then
    raise exception 'FAIL: Playlist authority_revision contract is missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'wk_playlist_items'
      and column_name = 'lifecycle_state'
      and is_nullable = 'NO'
  ) then
    raise exception 'FAIL: Playlist item lifecycle_state contract is missing';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'wk_playlist_items'
      and indexname = 'wk_playlist_items_active_position_key'
      and indexdef like '%lifecycle_state%'
      and indexdef like '%active%'
  ) then
    raise exception 'FAIL: Active Playlist item position uniqueness is missing';
  end if;

  select n.nspname || '.' || p.proname
  into playlist_trigger_function
  from pg_trigger t
  join pg_proc p on p.oid = t.tgfoid
  join pg_namespace n on n.oid = p.pronamespace
  where t.tgrelid = 'public.wk_playlists'::regclass
    and t.tgname = 'wk_playlists_set_updated_at'
    and not t.tgisinternal;

  if playlist_trigger_function is distinct from 'platform_private.touch_updated_at' then
    raise exception
      'FAIL: Playlist updated_at trigger still points to %',
      playlist_trigger_function;
  end if;

  select n.nspname || '.' || p.proname
  into playlist_item_trigger_function
  from pg_trigger t
  join pg_proc p on p.oid = t.tgfoid
  join pg_namespace n on n.oid = p.pronamespace
  where t.tgrelid = 'public.wk_playlist_items'::regclass
    and t.tgname = 'wk_playlist_items_set_updated_at'
    and not t.tgisinternal;

  if playlist_item_trigger_function is distinct from 'platform_private.touch_updated_at' then
    raise exception
      'FAIL: Playlist-item updated_at trigger still points to %',
      playlist_item_trigger_function;
  end if;

  if not exists (
    select 1
    from media.asset_purposes
    where asset_purpose = 'playlist_cover'
      and enabled
  ) then
    raise exception 'FAIL: Playlist cover Media purpose is missing';
  end if;

  if not exists (
    select 1
    from media.usage_roles
    where usage_role = 'playlist_cover'
      and enabled
  ) then
    raise exception 'FAIL: Playlist cover Media usage role is missing';
  end if;

  select pg_get_constraintdef(oid)
  into media_target_constraint
  from pg_constraint
  where conrelid = 'media.usage_links'::regclass
    and conname = 'usage_links_target_kind_check';

  if media_target_constraint not like '%playlist%' then
    raise exception 'FAIL: Media usage target-kind contract does not include Playlist';
  end if;

  if not media.usage_role_matches_target(
    'playlist_cover',
    'editorial',
    'playlist'
  ) then
    raise exception 'FAIL: Playlist cover Media usage role does not match Playlist target authority';
  end if;

  if media.usage_role_matches_target(
    'playlist_cover',
    'editorial',
    'article'
  ) then
    raise exception 'FAIL: Playlist cover Media usage role incorrectly matches Article target authority';
  end if;

  if position(
    'edit_own_playlists'
    in pg_get_functiondef(
      'media.validate_usage_target(uuid,text,text,uuid,text,uuid,boolean,boolean)'::regprocedure
    )
  ) = 0 then
    raise exception 'FAIL: Media target validator is not Playlist-aware';
  end if;

  select pg_get_constraintdef(oid)
  into citation_constraint
  from pg_constraint
  where conrelid = 'editorial.resource_citations'::regclass
    and conname = 'resource_citations_target_type_check';

  if citation_constraint not like '%playlist_version%'
     or citation_constraint not like '%playlist_item%' then
    raise exception 'FAIL: Citation attachment contract is not Playlist-aware';
  end if;

  select pg_get_constraintdef(oid)
  into credit_constraint
  from pg_constraint
  where conrelid = 'editorial.resource_credits'::regclass
    and conname = 'resource_credits_target_type_check';

  if credit_constraint not like '%playlist_version%'
     or credit_constraint not like '%playlist_item%' then
    raise exception 'FAIL: Credit attachment contract is not Playlist-aware';
  end if;

  select count(*)
  into capability_count
  from public.capability_definitions
  where capability_key in (
    'view_playlists',
    'edit_own_playlists',
    'edit_others_playlists',
    'publish_playlists',
    'delete_playlists'
  )
    and domain = 'content';

  if capability_count <> 5 then
    raise exception
      'FAIL: Expected 5 Playlist capabilities, found %',
      capability_count;
  end if;

  expected_role_grant_count := 13;

  select count(*)
  into actual_role_grant_count
  from public.role_capabilities
  where (role_key, capability_key) in (
    ('administrator', 'view_playlists'),
    ('administrator', 'edit_own_playlists'),
    ('administrator', 'edit_others_playlists'),
    ('administrator', 'publish_playlists'),
    ('administrator', 'delete_playlists'),
    ('editor', 'view_playlists'),
    ('editor', 'edit_own_playlists'),
    ('editor', 'edit_others_playlists'),
    ('editor', 'publish_playlists'),
    ('editor', 'delete_playlists'),
    ('reviewer', 'view_playlists'),
    ('writer', 'edit_own_playlists'),
    ('author', 'edit_own_playlists')
  );

  if actual_role_grant_count <> expected_role_grant_count then
    raise exception
      'FAIL: Expected % Playlist role grants, found %',
      expected_role_grant_count,
      actual_role_grant_count;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'editorial.playlist_resources'::regclass
      and conname = 'playlist_resources_working_version_fkey'
  ) or not exists (
    select 1
    from pg_constraint
    where conrelid = 'editorial.playlist_resources'::regclass
      and conname = 'playlist_resources_submitted_version_fkey'
  ) or not exists (
    select 1
    from pg_constraint
    where conrelid = 'editorial.playlist_resources'::regclass
      and conname = 'playlist_resources_approved_version_fkey'
  ) or not exists (
    select 1
    from pg_constraint
    where conrelid = 'editorial.playlist_resources'::regclass
      and conname = 'playlist_resources_published_version_fkey'
  ) then
    raise exception 'FAIL: One or more typed Playlist version pointers are missing';
  end if;

  raise notice
    'PASS: Phase 5A Migration 208 foundation verified. playlists=%, items=%, versions=%, capabilities=%, role_grants=%',
    playlist_count,
    item_count,
    playlist_version_count,
    capability_count,
    actual_role_grant_count;
end;
$verify_phase_5a_m208$;
