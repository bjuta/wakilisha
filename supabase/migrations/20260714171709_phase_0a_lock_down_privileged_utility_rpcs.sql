-- Phase 0A: restrict privileged utility RPC execution.
--
-- This migration intentionally changes FUNCTION EXECUTE grants only.
-- It does not modify table SELECT grants, views, RLS, policies, storage,
-- or any public content-reading RPC.

begin;

-- Permission-changing helpers.
-- These may alter database grants and must never be callable by browser roles.

revoke all
  on function public.grant_select_to_anon(text)
  from PUBLIC;

revoke all
  on function public.grant_select_to_anon(text)
  from anon, authenticated;

grant execute
  on function public.grant_select_to_anon(text)
  to service_role;


revoke all
  on function public.grant_select_all_tables()
  from PUBLIC;

revoke all
  on function public.grant_select_all_tables()
  from anon, authenticated;

grant execute
  on function public.grant_select_all_tables()
  to service_role;


-- Destructive staging helpers.
-- Existing callers invoke delete_batch_from_staging using service_role.

revoke all
  on function public.delete_batch_from_staging(integer)
  from PUBLIC;

revoke all
  on function public.delete_batch_from_staging(integer)
  from anon, authenticated;

grant execute
  on function public.delete_batch_from_staging(integer)
  to service_role;


revoke all
  on function public.purge_staging_records(integer, integer)
  from PUBLIC;

revoke all
  on function public.purge_staging_records(integer, integer)
  from anon, authenticated;

grant execute
  on function public.purge_staging_records(integer, integer)
  to service_role;


-- Import administration RPCs.
-- The authenticated admin frontend currently creates import runs directly.
-- Preserve authenticated execution while removing anonymous/public execution.

revoke all
  on function public.create_import_run(
    text,
    text,
    jsonb,
    text,
    jsonb,
    text[],
    text[]
  )
  from PUBLIC;

revoke all
  on function public.create_import_run(
    text,
    text,
    jsonb,
    text,
    jsonb,
    text[],
    text[]
  )
  from anon;

grant execute
  on function public.create_import_run(
    text,
    text,
    jsonb,
    text,
    jsonb,
    text[],
    text[]
  )
  to authenticated, service_role;


revoke all
  on function public.update_import_run(
    uuid,
    text,
    text[],
    timestamptz,
    jsonb,
    text[]
  )
  from PUBLIC;

revoke all
  on function public.update_import_run(
    uuid,
    text,
    text[],
    timestamptz,
    jsonb,
    text[]
  )
  from anon;

grant execute
  on function public.update_import_run(
    uuid,
    text,
    text[],
    timestamptz,
    jsonb,
    text[]
  )
  to authenticated, service_role;

commit;
