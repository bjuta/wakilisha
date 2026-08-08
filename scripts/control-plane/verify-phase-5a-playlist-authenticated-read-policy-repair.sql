-- Verify Phase 5A Migration 210: authenticated Playlist read policy repair.

do $verify_phase_5a_m210$
declare
  v_policy_count bigint;
  v_public_policy_count bigint;
  v_definition text;
begin
  if to_regprocedure(
       'editorial.current_user_can_view_playlist_id(uuid)'
     ) is null
  then
    raise exception
      'FAIL: RLS-safe Playlist identity predicate is missing';
  end if;

  select pg_get_functiondef(
    'editorial.current_user_can_view_playlist_id(uuid)'::regprocedure
  )
  into v_definition;

  if position('SECURITY DEFINER' in upper(v_definition)) = 0
     or position(
       'editorial.playlist_resources'
       in v_definition
     ) = 0
     or position(
       'current_user_can_view_playlist'
       in v_definition
     ) = 0
  then
    raise exception
      'FAIL: RLS-safe Playlist identity predicate is incomplete';
  end if;

  if has_function_privilege(
       'anon',
       'editorial.current_user_can_view_playlist_id(uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: Anonymous users can execute internal Playlist view predicate';
  end if;

  if not has_function_privilege(
       'authenticated',
       'editorial.current_user_can_view_playlist_id(uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: Authenticated users cannot execute Playlist view predicate';
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
        and qual not like '%playlist_resources%'
      )
      or (
        tablename = 'wk_playlist_items'
        and policyname = 'wk_playlist_items_authenticated_read'
        and qual like '%current_user_can_view_playlist_id%'
        and qual not like '%playlist_resources%'
      )
    );

  if v_policy_count <> 2 then
    raise exception
      'FAIL: Expected 2 repaired authenticated Playlist read policies, found %',
      v_policy_count;
  end if;

  select count(*)
  into v_public_policy_count
  from pg_policies
  where schemaname = 'public'
    and (
      (
        tablename = 'wk_playlists'
        and policyname = 'wk_playlists_public_published_read'
      )
      or (
        tablename = 'wk_playlist_items'
        and policyname = 'wk_playlist_items_public_published_read'
      )
    );

  if v_public_policy_count <> 2 then
    raise exception
      'FAIL: Public published Playlist read policies regressed';
  end if;

  if to_regprocedure(
       'public.create_playlist(text,text,text,text,text,jsonb,uuid)'
     ) is null
     or to_regprocedure(
       'public.reorder_playlist_items(uuid,bigint,uuid[],text,uuid)'
     ) is null
  then
    raise exception
      'FAIL: Migration 209 command authority regressed';
  end if;

  raise notice
    'PASS: Phase 5A Migration 210 authenticated Playlist read repair verified.';
end;
$verify_phase_5a_m210$;
