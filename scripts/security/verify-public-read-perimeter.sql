-- Phase 0A guardrail.
-- This query verifies the public table and view read perimeter.
-- The RPC lockdown migration must not reduce these grants or change RLS.

select
  n.nspname as schema_name,
  c.relname as relation_name,
  case c.relkind
    when 'r' then 'table'
    when 'p' then 'partitioned_table'
    when 'v' then 'view'
    when 'm' then 'materialized_view'
    else c.relkind::text
  end as relation_kind,
  c.relrowsecurity as rls_enabled,
  has_table_privilege('anon', c.oid, 'select') as anon_can_select,
  has_table_privilege('authenticated', c.oid, 'select') as authenticated_can_select
from pg_class c
join pg_namespace n
  on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p', 'v', 'm')
  and (
    has_table_privilege('anon', c.oid, 'select')
    or has_table_privilege('authenticated', c.oid, 'select')
  )
order by relation_kind, relation_name;

-- These public content surfaces must remain readable.
select
  has_table_privilege('anon', 'public.wk_articles', 'select')
    as wk_articles_public_read,
  has_table_privilege('anon', 'public.wk_chart_entries_v2', 'select')
    as chart_entries_public_read,
  has_table_privilege('anon', 'public.wk_chart_editions_v2', 'select')
    as chart_editions_public_read,
  has_table_privilege('anon', 'public.registry_releases', 'select')
    as releases_public_read,
  has_table_privilege('anon', 'public.registry_tracks', 'select')
    as tracks_public_read,
  has_table_privilege('anon', 'public.registry_release_tracks', 'select')
    as release_tracks_public_read,
  has_table_privilege('anon', 'public.registry_track_artists', 'select')
    as track_artists_public_read,
  has_table_privilege('anon', 'public.registry_media_assets', 'select')
    as media_assets_public_read,
  has_table_privilege('anon', 'public.registry_taxonomy_terms', 'select')
    as taxonomy_public_read,
  has_table_privilege('anon', 'public.wk_playlists', 'select')
    as playlists_public_read,
  has_table_privilege('anon', 'public.wk_playlist_items', 'select')
    as playlist_items_public_read;

-- Public read RPCs must remain executable.
select
  has_function_privilege(
    'anon',
    'public.get_public_artist_relationships(uuid)',
    'execute'
  ) as artist_relationships_rpc_public,
  has_function_privilege(
    'anon',
    'public.get_public_living_memory(text,text,text)',
    'execute'
  ) as living_memory_rpc_public,
  has_function_privilege(
    'anon',
    'public.registry_get_public_track_playback_providers(uuid[],text)',
    'execute'
  ) as provider_links_rpc_public;
