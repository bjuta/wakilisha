-- Phase 5A Migration 210: repair authenticated Playlist read policy.
--
-- Migration 209 correctly established owner/capability authority, but its RLS
-- policy directly queried editorial.playlist_resources. That binding table has
-- public-only authenticated RLS, so internal/draft Playlist bindings were
-- invisible inside the policy even when current_user_can_view_playlist(...)
-- returned true.
--
-- This forward repair keeps the binding table private and resolves Playlist
-- identity through a narrow SECURITY DEFINER predicate instead.

begin;

do $phase_5a_m210_preflight$
begin
  if to_regprocedure(
       'editorial.current_user_can_view_playlist(uuid)'
     ) is null
  then
    raise exception
      'STOP: Migration 209 Playlist view authority helper is missing';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'wk_playlists'
      and policyname = 'wk_playlists_authenticated_read'
  ) then
    raise exception
      'STOP: Migration 209 Playlist authenticated read policy is missing';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'wk_playlist_items'
      and policyname = 'wk_playlist_items_authenticated_read'
  ) then
    raise exception
      'STOP: Migration 209 Playlist-item authenticated read policy is missing';
  end if;

  if exists (
    select 1
    from public.wk_playlists
  ) or exists (
    select 1
    from public.wk_playlist_items
  ) then
    raise exception
      'STOP: Migration 210 expects no persisted Playlist acceptance data';
  end if;
end;
$phase_5a_m210_preflight$;

create or replace function editorial.current_user_can_view_playlist_id(
  p_playlist_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'editorial'
as $function$
  select coalesce(
    (
      select editorial.current_user_can_view_playlist(
        binding.resource_id
      )
      from editorial.playlist_resources binding
      where binding.playlist_id = p_playlist_id
    ),
    false
  );
$function$;

comment on function editorial.current_user_can_view_playlist_id(uuid) is
  'RLS-safe Playlist identity predicate. Resolves the private Playlist Resource binding under definer authority, then applies canonical owner/capability view rules.';

revoke execute
  on function editorial.current_user_can_view_playlist_id(uuid)
  from public, anon;

grant execute
  on function editorial.current_user_can_view_playlist_id(uuid)
  to authenticated, service_role;

drop policy if exists wk_playlists_authenticated_read
  on public.wk_playlists;

create policy wk_playlists_authenticated_read
on public.wk_playlists
for select
to authenticated
using (
  editorial.current_user_can_view_playlist_id(
    wk_playlists.id
  )
);

drop policy if exists wk_playlist_items_authenticated_read
  on public.wk_playlist_items;

create policy wk_playlist_items_authenticated_read
on public.wk_playlist_items
for select
to authenticated
using (
  editorial.current_user_can_view_playlist_id(
    wk_playlist_items.playlist_id
  )
);

do $phase_5a_m210_postconditions$
declare
  v_policy_count bigint;
  v_direct_binding_policy_count bigint;
begin
  if to_regprocedure(
       'editorial.current_user_can_view_playlist_id(uuid)'
     ) is null
  then
    raise exception
      'STOP: RLS-safe Playlist identity predicate was not created';
  end if;

  select count(*)
  into v_policy_count
  from pg_policies
  where schemaname = 'public'
    and (
      (
        tablename = 'wk_playlists'
        and policyname = 'wk_playlists_authenticated_read'
        and qual like '%current_user_can_view_playlist_id%'
      )
      or (
        tablename = 'wk_playlist_items'
        and policyname = 'wk_playlist_items_authenticated_read'
        and qual like '%current_user_can_view_playlist_id%'
      )
    );

  if v_policy_count <> 2 then
    raise exception
      'STOP: Expected 2 repaired authenticated Playlist read policies, found %',
      v_policy_count;
  end if;

  select count(*)
  into v_direct_binding_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename in (
      'wk_playlists',
      'wk_playlist_items'
    )
    and policyname in (
      'wk_playlists_authenticated_read',
      'wk_playlist_items_authenticated_read'
    )
    and qual like '%playlist_resources%';

  if v_direct_binding_policy_count <> 0 then
    raise exception
      'STOP: Authenticated Playlist policy still crosses Playlist Resource RLS directly';
  end if;
end;
$phase_5a_m210_postconditions$;

commit;
