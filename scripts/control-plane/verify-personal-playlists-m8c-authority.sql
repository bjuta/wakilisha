-- Read-only verification for WAKILISHA M8C-M1 Personal Playlist authority.

do $verify_m8c_m1$
declare
  v_missing_rpc_count bigint;
  v_missing_classification_count bigint;
  v_bad_existing_kind_count bigint;
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'wk_playlists'
      and column_name = 'playlist_kind'
      and is_nullable = 'NO'
  ) then
    raise exception 'M8C-M1 playlist_kind is missing';
  end if;

  select count(*)
  into v_missing_rpc_count
  from (
    values
      ('create_personal_playlist(text,text,text,text,text,uuid)'),
      ('update_personal_playlist(uuid,bigint,jsonb,text,uuid)'),
      ('add_personal_playlist_track(uuid,bigint,uuid,text,uuid,boolean)'),
      ('remove_personal_playlist_item(uuid,uuid,bigint,text,uuid)'),
      ('reorder_personal_playlist_items(uuid,bigint,uuid[],text,uuid)'),
      ('archive_personal_playlist(uuid,bigint,text,text,uuid)'),
      ('list_my_personal_playlists(boolean,integer)'),
      ('get_my_personal_playlist(uuid)'),
      ('get_my_personal_playlist_by_route(text,text)'),
      ('get_public_personal_playlist(text,text)'),
      ('list_public_personal_playlists_for_username(text,integer)')
  ) required(signature)
  where to_regprocedure('public.' || required.signature) is null;

  if v_missing_rpc_count <> 0 then
    raise exception 'M8C-M1 is missing % public RPC(s)', v_missing_rpc_count;
  end if;

  select count(*)
  into v_missing_classification_count
  from (
    values
      ('create_personal_playlist(text,text,text,text,text,uuid)'),
      ('update_personal_playlist(uuid,bigint,jsonb,text,uuid)'),
      ('add_personal_playlist_track(uuid,bigint,uuid,text,uuid,boolean)'),
      ('remove_personal_playlist_item(uuid,uuid,bigint,text,uuid)'),
      ('reorder_personal_playlist_items(uuid,bigint,uuid[],text,uuid)'),
      ('archive_personal_playlist(uuid,bigint,text,text,uuid)'),
      ('list_my_personal_playlists(boolean,integer)'),
      ('get_my_personal_playlist(uuid)'),
      ('get_my_personal_playlist_by_route(text,text)'),
      ('get_public_personal_playlist(text,text)'),
      ('list_public_personal_playlists_for_username(text,integer)')
  ) required(signature)
  where not exists (
    select 1
    from private.phase_0a_rpc_classification classification
    where classification.function_signature = required.signature
  );

  if v_missing_classification_count <> 0 then
    raise exception 'M8C-M1 is missing % RPC classification(s)', v_missing_classification_count;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'wk_playlists'
      and policyname = 'wk_playlists_personal_owner_read'
      and roles @> array['authenticated'::name]
  ) then
    raise exception 'Personal Playlist owner read policy is missing';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'wk_playlist_items'
      and policyname = 'wk_playlist_items_personal_owner_read'
      and roles @> array['authenticated'::name]
  ) then
    raise exception 'Personal Playlist item owner read policy is missing';
  end if;

  select count(*)
  into v_bad_existing_kind_count
  from public.wk_playlists
  where playlist_kind not in ('editorial', 'personal');

  if v_bad_existing_kind_count <> 0 then
    raise exception 'Unexpected Playlist kind exists';
  end if;
end;
$verify_m8c_m1$;

select jsonb_build_object(
  'playlist_count', (select count(*) from public.wk_playlists),
  'editorial_playlists', (
    select count(*) from public.wk_playlists where playlist_kind = 'editorial'
  ),
  'personal_playlists', (
    select count(*) from public.wk_playlists where playlist_kind = 'personal'
  ),
  'personal_playlist_items', (
    select count(*)
    from public.wk_playlist_items item
    join public.wk_playlists playlist on playlist.id = item.playlist_id
    where playlist.playlist_kind = 'personal'
      and item.lifecycle_state = 'active'
  ),
  'classified_rpcs', (
    select count(*)
    from private.phase_0a_rpc_classification
    where function_signature in (
      'create_personal_playlist(text,text,text,text,text,uuid)',
      'update_personal_playlist(uuid,bigint,jsonb,text,uuid)',
      'add_personal_playlist_track(uuid,bigint,uuid,text,uuid,boolean)',
      'remove_personal_playlist_item(uuid,uuid,bigint,text,uuid)',
      'reorder_personal_playlist_items(uuid,bigint,uuid[],text,uuid)',
      'archive_personal_playlist(uuid,bigint,text,text,uuid)',
      'list_my_personal_playlists(boolean,integer)',
      'get_my_personal_playlist(uuid)',
      'get_my_personal_playlist_by_route(text,text)',
      'get_public_personal_playlist(text,text)',
      'list_public_personal_playlists_for_username(text,integer)'
    )
  ),
  'owner_read_policies', (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and policyname in (
        'wk_playlists_personal_owner_read',
        'wk_playlist_items_personal_owner_read'
      )
  )
) as wakilisha_m8c_m1_personal_playlist_verification;
