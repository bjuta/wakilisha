-- Read-only Phase 0A verification.
-- Confirms privileged RPC grants while protecting the public read perimeter.

select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  has_function_privilege('anon', p.oid, 'execute')
    as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'execute')
    as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'execute')
    as service_role_can_execute
from pg_proc p
join pg_namespace n
  on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'grant_select_to_anon',
    'grant_select_all_tables',
    'delete_batch_from_staging',
    'purge_staging_records',
    'create_import_run',
    'update_import_run'
  )
order by p.proname, identity_arguments;

do $$
begin
  -- Service-role-only functions.
  if has_function_privilege(
    'anon',
    'public.grant_select_to_anon(text)',
    'execute'
  ) then
    raise exception 'anon still has grant_select_to_anon execution';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.grant_select_to_anon(text)',
    'execute'
  ) then
    raise exception 'authenticated still has grant_select_to_anon execution';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.grant_select_to_anon(text)',
    'execute'
  ) then
    raise exception 'service_role lost grant_select_to_anon execution';
  end if;

  if has_function_privilege(
    'anon',
    'public.grant_select_all_tables()',
    'execute'
  ) then
    raise exception 'anon still has grant_select_all_tables execution';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.grant_select_all_tables()',
    'execute'
  ) then
    raise exception 'authenticated still has grant_select_all_tables execution';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.grant_select_all_tables()',
    'execute'
  ) then
    raise exception 'service_role lost grant_select_all_tables execution';
  end if;

  if has_function_privilege(
    'anon',
    'public.delete_batch_from_staging(integer)',
    'execute'
  ) then
    raise exception 'anon still has delete_batch_from_staging execution';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.delete_batch_from_staging(integer)',
    'execute'
  ) then
    raise exception 'authenticated still has delete_batch_from_staging execution';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.delete_batch_from_staging(integer)',
    'execute'
  ) then
    raise exception 'service_role lost delete_batch_from_staging execution';
  end if;

  if has_function_privilege(
    'anon',
    'public.purge_staging_records(integer,integer)',
    'execute'
  ) then
    raise exception 'anon still has purge_staging_records execution';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.purge_staging_records(integer,integer)',
    'execute'
  ) then
    raise exception 'authenticated still has purge_staging_records execution';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.purge_staging_records(integer,integer)',
    'execute'
  ) then
    raise exception 'service_role lost purge_staging_records execution';
  end if;

  -- Authenticated admin import workflow must remain functional.
  if has_function_privilege(
    'anon',
    'public.create_import_run(text,text,jsonb,text,jsonb,text[],text[])',
    'execute'
  ) then
    raise exception 'anon still has create_import_run execution';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.create_import_run(text,text,jsonb,text,jsonb,text[],text[])',
    'execute'
  ) then
    raise exception 'authenticated lost create_import_run execution';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.create_import_run(text,text,jsonb,text,jsonb,text[],text[])',
    'execute'
  ) then
    raise exception 'service_role lost create_import_run execution';
  end if;

  if has_function_privilege(
    'anon',
    'public.update_import_run(uuid,text,text[],timestamptz,jsonb,text[])',
    'execute'
  ) then
    raise exception 'anon still has update_import_run execution';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.update_import_run(uuid,text,text[],timestamptz,jsonb,text[])',
    'execute'
  ) then
    raise exception 'authenticated lost update_import_run execution';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.update_import_run(uuid,text,text[],timestamptz,jsonb,text[])',
    'execute'
  ) then
    raise exception 'service_role lost update_import_run execution';
  end if;

  -- Critical public tables must remain readable.
  if not has_table_privilege('anon', 'public.wk_articles', 'select')
     or not has_table_privilege('anon', 'public.wk_chart_entries_v2', 'select')
     or not has_table_privilege('anon', 'public.wk_chart_editions_v2', 'select')
     or not has_table_privilege('anon', 'public.registry_releases', 'select')
     or not has_table_privilege('anon', 'public.registry_tracks', 'select')
     or not has_table_privilege('anon', 'public.registry_release_tracks', 'select')
     or not has_table_privilege('anon', 'public.registry_track_artists', 'select')
     or not has_table_privilege('anon', 'public.registry_media_assets', 'select')
     or not has_table_privilege('anon', 'public.registry_taxonomy_terms', 'select')
     or not has_table_privilege('anon', 'public.wk_playlists', 'select')
     or not has_table_privilege('anon', 'public.wk_playlist_items', 'select')
  then
    raise exception 'Phase 0A changed the critical public table read perimeter';
  end if;

  -- Public content RPCs must remain callable.
  if not has_function_privilege(
    'anon',
    'public.get_public_artist_relationships(uuid)',
    'execute'
  ) or not has_function_privilege(
    'anon',
    'public.get_public_living_memory(text,text,text)',
    'execute'
  ) or not has_function_privilege(
    'anon',
    'public.registry_get_public_track_playback_providers(uuid[],text)',
    'execute'
  ) then
    raise exception 'Phase 0A changed the public read RPC perimeter';
  end if;
end
$$;
