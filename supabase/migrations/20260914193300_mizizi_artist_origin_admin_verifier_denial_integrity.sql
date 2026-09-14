-- MIZIZI Slice 2 Artist Origin Admin Backfill Convergence
-- Integrity repair: cross-user verifier denial is authorization, not not-found.

begin;
set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'mizizi-registry-artist-origin-admin-verifier-denial-integrity',
    0
  )
);

do $preflight$
begin
  if to_regprocedure(
       'public.admin_verify_registry_artist_origin_admission(uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.verify_registry_artist_origin_admission(uuid)'
     ) is null
  then
    raise exception
      'STOP: #937 Artist-origin verifier authority is missing';
  end if;
end
$preflight$;

create or replace function public.admin_verify_registry_artist_origin_admission(
  p_operation_id uuid
)
returns table (
  operation_id uuid,
  verifier_status text
)
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
begin
  if auth.uid() is null
     or not coalesce(
       public.current_user_has_capability('manage_registry'),
       false
     )
  then
    raise exception
      using errcode = '42501',
            message = 'manage_registry is required.';
  end if;

  if not exists (
    select 1
    from platform_private.registry_mutation_operations operation
    join platform_private.registry_execution_grants execution_grant
      on execution_grant.id = operation.execution_grant_id
    where operation.id = p_operation_id
      and operation.actor_key = 'registry_artist_origin_admin'
      and execution_grant.issued_by_user_id = auth.uid()
      and execution_grant.required_user_capability_key = 'manage_registry'
  ) then
    raise exception
      using errcode = '42501',
            message =
              'Current user is not authorized to verify this Artist-origin operation.';
  end if;

  return query
  select *
  from platform_private.verify_registry_artist_origin_admission(
    p_operation_id
  );
end
$$;

revoke all on function
  public.admin_verify_registry_artist_origin_admission(uuid)
from public, anon, service_role;

grant execute on function
  public.admin_verify_registry_artist_origin_admission(uuid)
to authenticated;

do $proof$
declare
  v_def text;
begin
  select pg_get_functiondef(
    'public.admin_verify_registry_artist_origin_admission(uuid)'::regprocedure
  )
  into v_def;

  if position(
       'Current user is not authorized to verify this Artist-origin operation.'
       in v_def
     ) = 0
     or position('42501' in v_def) = 0
     or position('P0002' in v_def) > 0
  then
    raise exception
      'STOP: wrong-user verifier denial did not converge to authorization semantics';
  end if;

  if has_function_privilege(
       'anon',
       'public.admin_verify_registry_artist_origin_admission(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_verify_registry_artist_origin_admission(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_verify_registry_artist_origin_admission(uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: verifier execution privilege boundary drifted';
  end if;
end
$proof$;

commit;
