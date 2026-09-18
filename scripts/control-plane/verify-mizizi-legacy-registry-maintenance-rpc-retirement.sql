-- MIZIZI Slice 3 replay verifier: obsolete Registry maintenance RPC retirement.
-- Read-only. Validates exact head authority on a disposable Preview or target database.

do $verify$
begin
  if to_regprocedure('public.link_orphan_release_artists()') is not null then
    raise exception 'STOP: public.link_orphan_release_artists() still exists';
  end if;

  if to_regprocedure('public.rebuild_discography_from_metadata()') is not null then
    raise exception 'STOP: public.rebuild_discography_from_metadata() still exists';
  end if;

  if to_regprocedure('public.split_multi_release_tracks()') is not null then
    raise exception 'STOP: public.split_multi_release_tracks() still exists';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'link_orphan_release_artists',
        'rebuild_discography_from_metadata',
        'split_multi_release_tracks'
      )
  ) then
    raise exception 'STOP: a retired maintenance RPC overload still exists';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260918064000'
      and name = 'legacy_registry_maintenance_rpc_retirement'
  ) then
    raise exception 'STOP: exact retirement migration identity is not recorded';
  end if;
end
$verify$;

select
  'PASS'::text as status,
  (select count(*) from supabase_migrations.schema_migrations) as migration_count,
  (select max(version) from supabase_migrations.schema_migrations) as migration_head;
