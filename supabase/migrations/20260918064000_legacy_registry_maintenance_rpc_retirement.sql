-- MIZIZI Slice 3: retire obsolete PUBLIC Registry maintenance RPCs.
--
-- Dependency and seven-day PostgREST traffic proof established no current
-- application, database, cron, or external RPC consumer for these functions.
-- Historical migrations remain immutable; this head migration retires only
-- current callable authority.
--
-- No canonical Registry data is mutated by this migration.

do $mizizi_legacy_registry_maintenance_rpc_preflight$
begin
  if to_regprocedure('public.link_orphan_release_artists()') is null then
    raise exception
      'STOP: expected public.link_orphan_release_artists() before retirement';
  end if;

  if to_regprocedure('public.rebuild_discography_from_metadata()') is null then
    raise exception
      'STOP: expected public.rebuild_discography_from_metadata() before retirement';
  end if;

  if to_regprocedure('public.split_multi_release_tracks()') is null then
    raise exception
      'STOP: expected public.split_multi_release_tracks() before retirement';
  end if;
end;
$mizizi_legacy_registry_maintenance_rpc_preflight$;

-- Intentionally no CASCADE. Any undiscovered dependency must block retirement.
drop function public.link_orphan_release_artists();
drop function public.rebuild_discography_from_metadata();
drop function public.split_multi_release_tracks();

do $mizizi_legacy_registry_maintenance_rpc_postflight$
begin
  if to_regprocedure('public.link_orphan_release_artists()') is not null
     or to_regprocedure('public.rebuild_discography_from_metadata()') is not null
     or to_regprocedure('public.split_multi_release_tracks()') is not null
  then
    raise exception
      'STOP: legacy Registry maintenance RPC retirement incomplete';
  end if;
end;
$mizizi_legacy_registry_maintenance_rpc_postflight$;
