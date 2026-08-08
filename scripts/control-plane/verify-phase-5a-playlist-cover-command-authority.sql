do $phase_5a_m212_verify$
declare
  v_count bigint;
begin
  if not exists (
    select 1
    from platform_private.command_types
    where command_type = 'playlist.cover.set'
      and enabled
  ) then
    raise exception
      'FAIL: playlist.cover.set command type is missing or disabled';
  end if;

  if to_regprocedure(
       'public.set_playlist_cover(uuid,bigint,uuid,text,jsonb,text,text,text,uuid)'
     ) is null
  then
    raise exception
      'FAIL: set_playlist_cover RPC is missing';
  end if;

  if to_regprocedure(
       'public.get_playlist_current_cover(uuid)'
     ) is null
  then
    raise exception
      'FAIL: get_playlist_current_cover RPC is missing';
  end if;

  if not exists (
    select 1
    from pg_proc procedure_row
    join pg_namespace namespace
      on namespace.oid = procedure_row.pronamespace
    where namespace.nspname = 'public'
      and procedure_row.proname = 'set_playlist_cover'
      and procedure_row.prosecdef
  ) then
    raise exception
      'FAIL: set_playlist_cover is not SECURITY DEFINER';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid =
            'media.usage_links'::regclass
      and trigger_row.tgname =
            'playlist_cover_usage_governed_mutation'
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'FAIL: governed Playlist cover Media trigger is missing';
  end if;

  if has_function_privilege(
       'anon',
       'public.set_playlist_cover(uuid,bigint,uuid,text,jsonb,text,text,text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.get_playlist_current_cover(uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: anonymous Playlist cover RPC access exists';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.set_playlist_cover(uuid,bigint,uuid,text,jsonb,text,text,text,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.get_playlist_current_cover(uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: authenticated Playlist cover RPC access is missing';
  end if;

  if has_table_privilege(
       'authenticated',
       'platform_private.playlist_cover_mutation_authorizations',
       'SELECT'
     )
     or has_table_privilege(
       'service_role',
       'platform_private.playlist_cover_mutation_authorizations',
       'SELECT'
     )
  then
    raise exception
      'FAIL: private Playlist cover mutation authorization leaked';
  end if;

  select count(*)
  into v_count
  from platform_private.playlist_cover_mutation_authorizations;

  if v_count <> 0 then
    raise exception
      'FAIL: Playlist cover mutation authorization residue exists';
  end if;

  if exists (
    select 1
    from public.role_capabilities
    where role_key in ('writer', 'author')
      and capability_key = 'manage_media_usage'
  ) then
    raise exception
      'FAIL: Playlist cover authority broadened global Media usage capability';
  end if;

  raise notice
    'PASS: Phase 5A Playlist cover command authority is structurally complete.';
end;
$phase_5a_m212_verify$;
