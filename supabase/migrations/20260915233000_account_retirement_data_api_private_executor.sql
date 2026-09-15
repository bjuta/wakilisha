-- Root-cause repair for governed account retirement through the Supabase Data API.
--
-- Failure mode:
--   Person/Resource integrity is enforced by DEFERRABLE INITIALLY DEFERRED
--   constraint triggers. Account retirement mutates Person and identity-link
--   state inside a postgres-owned SECURITY DEFINER function, but previously
--   returned before those constraints were flushed. Under PostgREST the
--   deferred triggers therefore fired later at transaction commit as the
--   authenticated caller. Two Person integrity trigger functions are
--   intentionally SECURITY INVOKER and read editorial.people, so the commit
--   failed with SQLSTATE 42501.
--
-- Accepted pattern:
--   WAKILISHA already uses an explicit privileged constraint flush in
--   editorial.provision_person_for_user_profile_insert() for the same class of
--   deferred Person-integrity boundary. This migration applies that pattern to
--   account retirement without making the integrity triggers SECURITY DEFINER
--   globally and without granting authenticated direct editorial/auth access.
--
-- Architecture:
--   public SECURITY INVOKER facade
--     -> private postgres-owned SECURITY DEFINER orchestrator
--       -> existing privileged retirement core, moved intact
--       -> flush six reviewed Person/Resource constraints IMMEDIATE
--       -> restore them DEFERRED
--     -> return to PostgREST only after deferred integrity has passed

begin;

do $account_retirement_api_preflight$
declare
  v_public_oid oid;
begin
  if to_regnamespace('account_identity_private') is not null then
    raise exception
      'STOP: account_identity_private schema already exists';
  end if;

  v_public_oid := to_regprocedure(
    'public.retire_account_identity(uuid,uuid,bigint,uuid,text,text,uuid)'
  );

  if v_public_oid is null then
    raise exception
      'STOP: public account retirement RPC is missing';
  end if;

  if not exists (
       select 1
       from pg_proc
       where oid = v_public_oid
         and prosecdef
         and pg_get_userbyid(proowner) = 'postgres'
     )
  then
    raise exception
      'STOP: reviewed account retirement executor ownership/security mode moved';
  end if;

  if not has_function_privilege(
       'authenticated',
       v_public_oid,
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       v_public_oid,
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       v_public_oid,
       'EXECUTE'
     )
  then
    raise exception
      'STOP: reviewed account retirement RPC ACL moved';
  end if;

  if to_regprocedure(
       'public.current_user_has_capability(text)'
     ) is null
     or not exists (
       select 1
       from public.capability_definitions
       where capability_key = 'manage_people_identity'
     )
     or not exists (
       select 1
       from public.capability_definitions
       where capability_key = 'manage_users'
     )
  then
    raise exception
      'STOP: reviewed account retirement capability authority is incomplete';
  end if;

  if exists (
    select 1
    from (
      values
        ('editorial.resources_resource_version_pointer_integrity'),
        ('editorial.resources_binding_integrity'),
        ('editorial.people_binding_integrity'),
        ('editorial.people_identity_integrity'),
        ('editorial.people_merge_cycle_integrity'),
        ('editorial.person_identity_links_preferred_integrity')
    ) required(constraint_name)
    where to_regclass(
            split_part(required.constraint_name, '.', 1) ||
            '.' ||
            case
              when required.constraint_name like 'editorial.resources_%'
                then 'resources'
              when required.constraint_name like 'editorial.people_%'
                then 'people'
              else 'person_identity_links'
            end
          ) is null
  ) then
    raise exception
      'STOP: reviewed Person/Resource integrity tables moved';
  end if;

  if not exists (
       select 1
       from pg_trigger trigger_row
       where trigger_row.tgname = 'people_identity_integrity'
         and trigger_row.tgrelid = 'editorial.people'::regclass
         and trigger_row.tgdeferrable
         and trigger_row.tginitdeferred
     )
     or not exists (
       select 1
       from pg_trigger trigger_row
       where trigger_row.tgname = 'people_merge_cycle_integrity'
         and trigger_row.tgrelid = 'editorial.people'::regclass
         and trigger_row.tgdeferrable
         and trigger_row.tginitdeferred
     )
     or not exists (
       select 1
       from pg_trigger trigger_row
       where trigger_row.tgname = 'person_identity_links_preferred_integrity'
         and trigger_row.tgrelid =
             'editorial.person_identity_links'::regclass
         and trigger_row.tgdeferrable
         and trigger_row.tginitdeferred
     )
  then
    raise exception
      'STOP: reviewed deferred Person identity integrity authority moved';
  end if;

  if exists (
       select 1
       from pg_proc
       where oid =
         'editorial.assert_person_identity_integrity()'::regprocedure
         and prosecdef
     )
     or exists (
       select 1
       from pg_proc
       where oid =
         'editorial.assert_person_merge_cycle_integrity()'::regprocedure
         and prosecdef
     )
  then
    raise exception
      'STOP: Person integrity trigger functions unexpectedly became SECURITY DEFINER';
  end if;
end;
$account_retirement_api_preflight$;

create schema account_identity_private authorization postgres;

revoke all on schema account_identity_private
from public, anon, authenticated, service_role;

grant usage on schema account_identity_private
to authenticated, service_role;

alter function public.retire_account_identity(
  uuid,
  uuid,
  bigint,
  uuid,
  text,
  text,
  uuid
)
set schema account_identity_private;

alter function account_identity_private.retire_account_identity(
  uuid,
  uuid,
  bigint,
  uuid,
  text,
  text,
  uuid
)
rename to retire_account_identity_core;

revoke all on function account_identity_private.retire_account_identity_core(
  uuid,
  uuid,
  bigint,
  uuid,
  text,
  text,
  uuid
)
from public, anon, authenticated, service_role;

comment on function account_identity_private.retire_account_identity_core(
  uuid,
  uuid,
  bigint,
  uuid,
  text,
  text,
  uuid
) is
  'Original governed account-retirement implementation, moved intact behind the private transaction orchestrator. Owner postgres retains implicit execution authority.';

create function account_identity_private.retire_account_identity(
  p_user_id uuid,
  p_person_resource_id uuid,
  p_expected_identity_revision bigint,
  p_identity_link_id uuid,
  p_reason text,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  user_id uuid,
  person_resource_id uuid,
  identity_revision bigint,
  identity_link_id uuid,
  account_deleted boolean,
  person_archived boolean,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial',
  'account_identity_private'
as $function$
begin
  -- Establish a deterministic deferred baseline for the reviewed Person/Resource
  -- integrity constraints before the core mutates account identity state.
  set constraints
    editorial.resources_resource_version_pointer_integrity,
    editorial.resources_binding_integrity,
    editorial.people_binding_integrity,
    editorial.people_identity_integrity,
    editorial.people_merge_cycle_integrity,
    editorial.person_identity_links_preferred_integrity
  deferred;

  return query
  select *
  from account_identity_private.retire_account_identity_core(
    p_user_id,
    p_person_resource_id,
    p_expected_identity_revision,
    p_identity_link_id,
    p_reason,
    p_idempotency_key,
    p_correlation_id
  );

  -- Critical transaction boundary:
  -- force all Person/Resource integrity raised by retirement to execute while
  -- CURRENT_USER is still the postgres-owned SECURITY DEFINER orchestrator.
  set constraints
    editorial.resources_resource_version_pointer_integrity,
    editorial.resources_binding_integrity,
    editorial.people_binding_integrity,
    editorial.people_identity_integrity,
    editorial.people_merge_cycle_integrity,
    editorial.person_identity_links_preferred_integrity
  immediate;

  -- Restore the repository's normal deferred semantics for any later work in
  -- the surrounding transaction. No retirement-generated events remain pending.
  set constraints
    editorial.resources_resource_version_pointer_integrity,
    editorial.resources_binding_integrity,
    editorial.people_binding_integrity,
    editorial.people_identity_integrity,
    editorial.people_merge_cycle_integrity,
    editorial.person_identity_links_preferred_integrity
  deferred;

  return;
end;
$function$;

revoke all on function account_identity_private.retire_account_identity(
  uuid,
  uuid,
  bigint,
  uuid,
  text,
  text,
  uuid
)
from public;

revoke execute on function account_identity_private.retire_account_identity(
  uuid,
  uuid,
  bigint,
  uuid,
  text,
  text,
  uuid
)
from anon;

grant execute on function account_identity_private.retire_account_identity(
  uuid,
  uuid,
  bigint,
  uuid,
  text,
  text,
  uuid
)
to authenticated, service_role;

comment on function account_identity_private.retire_account_identity(
  uuid,
  uuid,
  bigint,
  uuid,
  text,
  text,
  uuid
) is
  'Postgres-owned account-retirement transaction orchestrator. Runs the unchanged governed core, flushes reviewed deferred Person/Resource integrity before returning to the Data API, then restores deferred timing.';

create function public.retire_account_identity(
  p_user_id uuid,
  p_person_resource_id uuid,
  p_expected_identity_revision bigint,
  p_identity_link_id uuid,
  p_reason text,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  user_id uuid,
  person_resource_id uuid,
  identity_revision bigint,
  identity_link_id uuid,
  account_deleted boolean,
  person_archived boolean,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security invoker
set search_path to
  'pg_catalog',
  'public',
  'account_identity_private'
as $function$
begin
  if coalesce(
       auth.role(),
       ''
     ) <> 'authenticated'
     or auth.uid() is null
     or not public.current_user_has_capability(
       'manage_people_identity'
     )
     or not public.current_user_has_capability(
       'manage_users'
     )
  then
    raise exception
      using
        errcode = '42501',
        message =
          'People identity and user management permissions are required.';
  end if;

  return query
  select *
  from account_identity_private.retire_account_identity(
    p_user_id,
    p_person_resource_id,
    p_expected_identity_revision,
    p_identity_link_id,
    p_reason,
    p_idempotency_key,
    p_correlation_id
  );
end;
$function$;

revoke all on function public.retire_account_identity(
  uuid,
  uuid,
  bigint,
  uuid,
  text,
  text,
  uuid
)
from public;

revoke execute on function public.retire_account_identity(
  uuid,
  uuid,
  bigint,
  uuid,
  text,
  text,
  uuid
)
from anon;

grant execute on function public.retire_account_identity(
  uuid,
  uuid,
  bigint,
  uuid,
  text,
  text,
  uuid
)
to authenticated, service_role;

comment on function public.retire_account_identity(
  uuid,
  uuid,
  bigint,
  uuid,
  text,
  text,
  uuid
) is
  'Stable Data API facade for governed account retirement. Runs as the authenticated caller, revalidates required capabilities, and delegates to the private privileged transaction orchestrator.';

do $account_retirement_api_postflight$
declare
  v_public_oid oid;
  v_orchestrator_oid oid;
  v_core_oid oid;
  v_public_definition text;
  v_orchestrator_definition text;
  v_core_definition text;
  v_private_function_count bigint;
begin
  v_public_oid := to_regprocedure(
    'public.retire_account_identity(uuid,uuid,bigint,uuid,text,text,uuid)'
  );
  v_orchestrator_oid := to_regprocedure(
    'account_identity_private.retire_account_identity(uuid,uuid,bigint,uuid,text,text,uuid)'
  );
  v_core_oid := to_regprocedure(
    'account_identity_private.retire_account_identity_core(uuid,uuid,bigint,uuid,text,text,uuid)'
  );

  if v_public_oid is null
     or v_orchestrator_oid is null
     or v_core_oid is null
  then
    raise exception
      'STOP: account retirement facade/orchestrator/core boundary is incomplete';
  end if;

  if exists (
       select 1
       from pg_proc
       where oid = v_public_oid
         and prosecdef
     )
     or (
       select count(*)
       from pg_proc
       where oid in (v_orchestrator_oid, v_core_oid)
         and prosecdef
         and pg_get_userbyid(proowner) = 'postgres'
     ) <> 2
  then
    raise exception
      'STOP: account retirement security modes are invalid';
  end if;

  if not has_schema_privilege(
       'authenticated',
       'account_identity_private',
       'USAGE'
     )
     or not has_schema_privilege(
       'service_role',
       'account_identity_private',
       'USAGE'
     )
     or has_schema_privilege(
       'anon',
       'account_identity_private',
       'USAGE'
     )
  then
    raise exception
      'STOP: account retirement private-schema ACL is invalid';
  end if;

  if not has_function_privilege(
       'authenticated',
       v_public_oid,
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       v_orchestrator_oid,
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       v_core_oid,
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       v_public_oid,
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       v_orchestrator_oid,
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       v_core_oid,
       'EXECUTE'
     )
  then
    raise exception
      'STOP: account retirement facade/orchestrator/core EXECUTE ACL is invalid';
  end if;

  if has_table_privilege(
       'authenticated',
       'editorial.people',
       'SELECT'
     )
     or has_table_privilege(
       'authenticated',
       'auth.users',
       'SELECT'
     )
  then
    raise exception
      'STOP: authenticated unexpectedly gained direct retirement table access';
  end if;

  if exists (
       select 1
       from pg_proc
       where oid =
         'editorial.assert_person_identity_integrity()'::regprocedure
         and prosecdef
     )
     or exists (
       select 1
       from pg_proc
       where oid =
         'editorial.assert_person_merge_cycle_integrity()'::regprocedure
         and prosecdef
     )
  then
    raise exception
      'STOP: Person integrity trigger privilege model broadened';
  end if;

  select pg_get_functiondef(v_public_oid)
  into v_public_definition;

  select pg_get_functiondef(v_orchestrator_oid)
  into v_orchestrator_definition;

  select pg_get_functiondef(v_core_oid)
  into v_core_definition;

  if position(
       'account_identity_private.retire_account_identity'
       in lower(v_public_definition)
     ) = 0
     or position(
       '''manage_people_identity'''
       in lower(v_public_definition)
     ) = 0
     or position(
       '''manage_users'''
       in lower(v_public_definition)
     ) = 0
     or position(
       'editorial.people'
       in lower(v_public_definition)
     ) <> 0
     or position(
       'auth.users'
       in lower(v_public_definition)
     ) <> 0
  then
    raise exception
      'STOP: public retirement facade contract moved';
  end if;

  if position(
       'set constraints'
       in lower(v_orchestrator_definition)
     ) = 0
     or position(
       'editorial.people_identity_integrity'
       in lower(v_orchestrator_definition)
     ) = 0
     or position(
       'editorial.people_merge_cycle_integrity'
       in lower(v_orchestrator_definition)
     ) = 0
     or position(
       'editorial.person_identity_links_preferred_integrity'
       in lower(v_orchestrator_definition)
     ) = 0
     or position(
       'immediate'
       in lower(v_orchestrator_definition)
     ) = 0
     or position(
       'deferred'
       in lower(v_orchestrator_definition)
     ) = 0
     or position(
       'retire_account_identity_core'
       in lower(v_orchestrator_definition)
     ) = 0
  then
    raise exception
      'STOP: private retirement transaction orchestrator contract moved';
  end if;

  if position(
       'public.unlink_person_identity('
       in lower(v_core_definition)
     ) = 0
     or position(
       'editorial.people'
       in lower(v_core_definition)
     ) = 0
     or position(
       'editorial.retired_account_identities'
       in lower(v_core_definition)
     ) = 0
     or position(
       'from pg_constraint'
       in lower(v_core_definition)
     ) = 0
     or position(
       'delete from auth.users'
       in lower(v_core_definition)
     ) = 0
  then
    raise exception
      'STOP: original governed retirement core contract moved';
  end if;

  select count(*)
  into v_private_function_count
  from pg_proc function_row
  join pg_namespace namespace_row
    on namespace_row.oid = function_row.pronamespace
  where namespace_row.nspname = 'account_identity_private';

  if v_private_function_count <> 2 then
    raise exception
      'STOP: account_identity_private must contain exactly orchestrator + core, found %',
      v_private_function_count;
  end if;
end;
$account_retirement_api_postflight$;

notify pgrst, 'reload schema';

commit;
