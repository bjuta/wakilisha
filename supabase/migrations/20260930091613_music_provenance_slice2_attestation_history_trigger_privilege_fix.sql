-- WAKILISHA Music Provenance — Slice 2 / #1116
-- Deferred attestation-history integrity privilege repair.
--
-- The creator command surface is SECURITY DEFINER and writes only through
-- governed public RPCs. Its deferred private history constraint trigger must
-- therefore retain the same private authority when it fires at commit time.
--
-- This migration does not grant browser roles access to platform_private.

begin;

set local statement_timeout='60s';
set local lock_timeout='5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'music-provenance-slice2-attestation-history-trigger-privilege-fix',
    0
  )
);

do $preflight$
declare
  v_oid oid;
begin
  v_oid :=
    pg_catalog.to_regprocedure(
      'platform_private.assert_registry_contribution_attestation_history_v1()'
    );

  if v_oid is null then
    raise exception
      'STOP: Slice 2 attestation-history integrity helper is missing';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_proc function_row
    where function_row.oid=v_oid
      and pg_catalog.pg_get_userbyid(function_row.proowner)='postgres'
      and not function_row.prosecdef
  ) then
    raise exception
      'STOP: attestation-history integrity helper authority drifted before repair';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_trigger trigger_row
    where trigger_row.tgrelid=
          'platform_private.registry_contribution_attestations'::regclass
      and trigger_row.tgname=
          'registry_contribution_attestation_history_integrity'
      and trigger_row.tgdeferrable
      and trigger_row.tginitdeferred
      and not trigger_row.tgisinternal
  )
  or not exists (
    select 1
    from pg_catalog.pg_trigger trigger_row
    where trigger_row.tgrelid=
          'platform_private.registry_contribution_attestation_state_events'::regclass
      and trigger_row.tgname=
          'registry_contribution_attestation_state_history_integrity'
      and trigger_row.tgdeferrable
      and trigger_row.tginitdeferred
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'STOP: expected deferred attestation-history integrity triggers are incomplete';
  end if;
end
$preflight$;

alter function
  platform_private.assert_registry_contribution_attestation_history_v1()
security definer;

revoke all privileges on function
  platform_private.assert_registry_contribution_attestation_history_v1()
from public;

revoke all privileges on function
  platform_private.assert_registry_contribution_attestation_history_v1()
from anon, authenticated, service_role;

comment on function
  platform_private.assert_registry_contribution_attestation_history_v1()
is
  'Private deferred integrity guard for contribution attestation history. SECURITY DEFINER is required because governed public creator RPCs defer this constraint until commit; client roles retain no direct execution or platform_private table authority.';

do $postflight$
declare
  v_oid oid;
begin
  v_oid :=
    pg_catalog.to_regprocedure(
      'platform_private.assert_registry_contribution_attestation_history_v1()'
    );

  if not exists (
    select 1
    from pg_catalog.pg_proc function_row
    where function_row.oid=v_oid
      and function_row.prosecdef
      and pg_catalog.pg_get_userbyid(function_row.proowner)='postgres'
  ) then
    raise exception
      'STOP: attestation-history integrity helper did not become SECURITY DEFINER';
  end if;

  if pg_catalog.has_function_privilege(
       'anon',
       v_oid,
       'EXECUTE'
     )
     or pg_catalog.has_function_privilege(
       'authenticated',
       v_oid,
       'EXECUTE'
     )
     or pg_catalog.has_function_privilege(
       'service_role',
       v_oid,
       'EXECUTE'
     )
  then
    raise exception
      'STOP: attestation-history integrity helper leaked direct execution authority';
  end if;
end
$postflight$;

commit;
