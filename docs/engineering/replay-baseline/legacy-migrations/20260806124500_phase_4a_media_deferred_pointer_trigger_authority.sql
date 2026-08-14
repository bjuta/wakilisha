-- Phase 4A deferred Media pointer-trigger authority correction.
--
-- assets_pointer_integrity is intentionally deferred until transaction commit.
-- Its trigger function must retain canonical Media authority when PostgREST
-- commits an authenticated write command.
--
-- This migration does not grant authenticated direct access to media tables,
-- change RLS, alter trigger timing, or change application runtimes.

begin;

set local statement_timeout = '180s';
set local lock_timeout = '5s';

do $phase_4a_deferred_trigger_preflight$
declare
  v_trigger_function oid;
begin
  v_trigger_function :=
    to_regprocedure(
      'media.enforce_asset_pointer_integrity()'
    );

  if v_trigger_function is null then
    raise exception
      'STOP: Media pointer-integrity trigger function is missing';
  end if;

  if not exists (
    select 1
    from pg_proc procedure_row
    where procedure_row.oid = v_trigger_function
      and pg_get_userbyid(procedure_row.proowner) = 'postgres'
      and not procedure_row.prosecdef
      and exists (
        select 1
        from unnest(procedure_row.proconfig) setting_row
        where setting_row = 'search_path=pg_catalog, media'
      )
  ) then
    raise exception
      'STOP: Media pointer-integrity function preflight changed';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    join pg_class table_row
      on table_row.oid = trigger_row.tgrelid
    join pg_namespace namespace_row
      on namespace_row.oid = table_row.relnamespace
    where namespace_row.nspname = 'media'
      and table_row.relname = 'assets'
      and trigger_row.tgname = 'assets_pointer_integrity'
      and trigger_row.tgfoid = v_trigger_function
      and trigger_row.tgconstraint <> 0
      and trigger_row.tgdeferrable
      and trigger_row.tginitdeferred
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'STOP: Deferred Media pointer-integrity trigger changed';
  end if;

  if has_table_privilege(
    'authenticated',
    'media.asset_governance_versions',
    'SELECT'
  ) then
    raise exception
      'STOP: Authenticated unexpectedly has direct governance-table SELECT';
  end if;

  if (select count(*) from media.assets) <> 1079
     or (
       select count(*)
       from media.asset_governance_versions
     ) <> 1079
     or (
       select count(*)
       from public.registry_media_assets
     ) <> 1079
     or (select count(*) from media.file_objects) <> 0
     or (select count(*) from media.asset_revisions) <> 0
     or (select count(*) from media.variants) <> 0
     or (
       select count(*)
       from media.variant_selections
     ) <> 0
     or (select count(*) from media.usage_links) <> 987
  then
    raise exception
      'STOP: Live Media baseline changed before deferred-trigger correction';
  end if;
end;
$phase_4a_deferred_trigger_preflight$;

alter function media.enforce_asset_pointer_integrity()
security definer;

alter function media.enforce_asset_pointer_integrity()
set search_path = pg_catalog, media;

revoke all
on function media.enforce_asset_pointer_integrity()
from public, anon, authenticated;

grant execute
on function media.enforce_asset_pointer_integrity()
to service_role;

comment on function media.enforce_asset_pointer_integrity()
is
  'Deferred Media pointer-integrity constraint trigger. Runs with postgres owner authority at transaction commit so authenticated command callers do not receive direct canonical table access.';

commit;
