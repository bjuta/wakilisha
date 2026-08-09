do $verify_phase_5b_m218$
declare
  v_definition text;
begin
  if not exists (
    select 1
    from platform_private.command_types
    where command_type = 'playlist.publish'
      and enabled
  ) then
    raise exception
      'FAIL: playlist.publish command type is missing or disabled';
  end if;

  if to_regclass(
       'editorial.playlist_publication_snapshots'
     ) is null
  then
    raise exception
      'FAIL: Playlist publication snapshot authority is missing';
  end if;

  if to_regprocedure(
       'public.publish_playlist_version(uuid,bigint,uuid,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.get_public_playlist(text)'
     ) is null
     or to_regprocedure(
       'public.list_public_playlists(integer,timestamp with time zone,uuid)'
     ) is null
  then
    raise exception
      'FAIL: One or more M218 public functions are missing';
  end if;

  if has_table_privilege(
       'anon',
       'editorial.playlist_publication_snapshots',
       'SELECT'
     )
     or has_table_privilege(
       'authenticated',
       'editorial.playlist_publication_snapshots',
       'SELECT'
     )
  then
    raise exception
      'FAIL: Browser roles can read Playlist publication snapshots directly';
  end if;

  if has_function_privilege(
       'anon',
       'public.publish_playlist_version(uuid,bigint,uuid,text,text,uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: Anonymous Playlist publication is exposed';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.publish_playlist_version(uuid,bigint,uuid,text,text,uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: Authenticated Playlist publishers cannot execute publication';
  end if;

  if not has_function_privilege(
       'anon',
       'public.get_public_playlist(text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'anon',
       'public.list_public_playlists(integer,timestamp with time zone,uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: Public Playlist reads are not available anonymously';
  end if;

  select pg_get_functiondef(
    'platform_private.begin_playlist_trust_copy_authorization(uuid,uuid)'::regprocedure
  )
  into v_definition;

  if position(
       'approved'
       in v_definition
     ) = 0
     or position(
       'published'
       in v_definition
     ) = 0
  then
    raise exception
      'FAIL: Playlist Trust copy does not support approved-to-published transition';
  end if;

  select pg_get_functiondef(
    'editorial.current_user_can_publish_playlist(uuid)'::regprocedure
  )
  into v_definition;

  if position(
       'publish_playlists'
       in v_definition
     ) = 0
  then
    raise exception
      'FAIL: Playlist publication capability guard is missing publish_playlists';
  end if;

  select pg_get_functiondef(
    'public.publish_playlist_version(uuid,bigint,uuid,text,text,uuid)'::regprocedure
  )
  into v_definition;

  if position(
       'current_user_can_publish_playlist'
       in v_definition
     ) = 0
     or position(
       'current_approved_version_id'
       in v_definition
     ) = 0
     or position(
       'current_published_version_id'
       in v_definition
     ) = 0
     or position(
       'playlist.publish'
       in v_definition
     ) = 0
  then
    raise exception
      'FAIL: Playlist publish command is missing required authority controls';
  end if;

  select pg_get_functiondef(
    'editorial.materialize_playlist_publication_snapshot(uuid,timestamp with time zone,uuid,uuid)'::regprocedure
  )
  into v_definition;

  if position(
       'resolve_media_asset_delivery'
       in v_definition
     ) = 0
     or position(
       '''youtube'''
       in v_definition
     ) = 0
     or position(
       '''soundcloud'''
       in v_definition
     ) = 0
     or position(
       '''apple_music'''
       in v_definition
     ) = 0
  then
    raise exception
      'FAIL: Public Playlist snapshot is missing governed cover or normalized playback authority';
  end if;

  select pg_get_functiondef(
    'public.get_public_playlist(text)'::regprocedure
  )
  into v_definition;

  if position(
       'source.withdrawn_at'
       in v_definition
     ) = 0
     or position(
       'source.exposure_class'
       in v_definition
     ) = 0
     or position(
       'public_redacted'
       in v_definition
     ) = 0
     or position(
       'source.current_approved_version_id'
       in v_definition
     ) = 0
     or position(
       'citation.source_version_id'
       in v_definition
     ) = 0
     or position(
       'external_contributors'
       in v_definition
     ) = 0
     or position(
       'contributor.public_safe'
       in v_definition
     ) = 0
     or position(
       'contributor.consent_status'
       in v_definition
     ) = 0
  then
    raise exception
      'FAIL: Public Playlist Trust projection is weaker than shared public Trust governance';
  end if;

  raise notice
    'PASS: Phase 5B M218 Playlist publication and public read model are structurally complete.';
end;
$verify_phase_5b_m218$;
