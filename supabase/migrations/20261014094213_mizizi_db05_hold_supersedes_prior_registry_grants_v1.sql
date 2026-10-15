-- 228 / Slice 1 DB05: a released governance Hold Writes never restores
-- previously issued Registry mutation authority. No grant is auto-issued.
-- Revocation here is logical and durable; existing grant history is preserved.
-- Does NOT change authenticated/anonymous/service execute grants or source writes.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='90s';
DO $preflight$
BEGIN
 IF (SELECT count(*) FROM supabase_migrations.schema_migrations)<>227
    OR (SELECT max(version) FROM supabase_migrations.schema_migrations)<>'20261013184040'
    OR (SELECT encode(extensions.digest(p.prosrc,'sha256'),'hex')
        FROM pg_proc p WHERE p.oid='platform_private.registry_execution_grant_has_current_authority(uuid)'::regprocedure)
       <>'a6db96f814ed613fed74f844a8c4fe0ef63506bb6916f41a2c49de2b4f6b2822'
    OR (SELECT p.proowner::regrole::text FROM pg_proc p
        WHERE p.oid='platform_private.registry_execution_grant_has_current_authority(uuid)'::regprocedure)<>'postgres'
    OR has_function_privilege('anon','platform_private.registry_execution_grant_has_current_authority(uuid)','EXECUTE')
    OR has_function_privilege('authenticated','platform_private.registry_execution_grant_has_current_authority(uuid)','EXECUTE')
    OR has_function_privilege('service_role','platform_private.registry_execution_grant_has_current_authority(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'STOP_228_PRIOR_LEDGER_FUNCTION_HASH_OR_PRIVILEGE_DRIFT'; END IF;
END $preflight$;
CREATE OR REPLACE FUNCTION platform_private.registry_execution_grant_has_current_authority(p_execution_grant_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'platform_private', 'auth'
AS $function$
declare
  v_grant platform_private.registry_execution_grants%rowtype;
begin
  select execution_grant.* into v_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.id = p_execution_grant_id;

  if not found then return false; end if;

  -- DB05 temporal fence: a matching hold, including a RELEASED hold, retires
  -- an earlier grant. Hold release never reauthorizes a stale writer.
  -- A newly reviewed grant issued AFTER the hold can still be considered.
  if exists (
    select 1
    from mizizi_private.write_holds h
    where h.held_at >= v_grant.issued_at
      and (
        h.scope_kind='global'
        or (
          h.workspace_id in (
            select w.id from mizizi_private.workspaces w
            where w.workspace_key='wakilisha-internal'
              and w.workspace_kind='internal' and w.status='active'
          )
          and (
            h.scope_kind='workspace'
            or (h.scope_kind='operation'
                and h.operation_key=v_grant.operation_key
                and h.operation_version=v_grant.operation_version)
          )
        )
      )
  ) then
    return false;
  end if;


  if not exists (
       select 1 from platform_private.system_actors actor
       where actor.actor_key = v_grant.actor_key
         and actor.status = 'active'
     )
     or not exists (
       select 1 from platform_private.system_actor_executor_bindings binding
       where binding.actor_key = v_grant.actor_key
         and binding.executor_kind = 'database_role'
         and binding.executor_key = session_user
         and binding.status = 'active'
     )
     or not exists (
       select 1 from platform_private.registry_operation_types operation_type
       where operation_type.operation_key = v_grant.operation_key
         and operation_type.operation_version = v_grant.operation_version
         and operation_type.capability_key = v_grant.capability_key
         and operation_type.enabled
     )
  then
    return false;
  end if;

  if v_grant.issued_by_user_id is not null then
    return
      v_grant.system_actor_capability_grant_id is null
      and v_grant.required_user_capability_key is not null
      and v_grant.issued_by_principal_key = 'user:' || v_grant.issued_by_user_id::text
      and auth.uid() = v_grant.issued_by_user_id
      and coalesce(
        public.current_user_has_capability(v_grant.required_user_capability_key),
        false
      );
  end if;

  return
    v_grant.required_user_capability_key is null
    and v_grant.system_actor_capability_grant_id is not null
    and v_grant.issued_by_principal_key like 'policy:%'
    and exists (
      select 1
      from platform_private.system_actor_capability_grants standing_grant
      where standing_grant.id = v_grant.system_actor_capability_grant_id
        and standing_grant.actor_key = v_grant.actor_key
        and standing_grant.capability_key = v_grant.capability_key
        and standing_grant.status = 'active'
        and standing_grant.valid_from <= now()
        and standing_grant.expires_at > now()
    );
end
$function$;

REVOKE ALL ON FUNCTION platform_private.registry_execution_grant_has_current_authority(uuid)
 FROM PUBLIC,anon,authenticated,service_role;
DO $postcheck$
DECLARE def text;
BEGIN
 SELECT pg_get_functiondef('platform_private.registry_execution_grant_has_current_authority(uuid)'::regprocedure)
 INTO STRICT def;
 IF position('h.held_at >= v_grant.issued_at' in def)=0
 OR position('h.scope_kind=''operation''' in def)=0
 OR position('h.scope_kind=''workspace''' in def)=0
 OR position('h.scope_kind=''global''' in def)=0
 OR position('public.current_user_has_capability' in def)=0
 OR has_function_privilege('anon','platform_private.registry_execution_grant_has_current_authority(uuid)','EXECUTE')
 OR has_function_privilege('authenticated','platform_private.registry_execution_grant_has_current_authority(uuid)','EXECUTE')
 OR has_function_privilege('service_role','platform_private.registry_execution_grant_has_current_authority(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'STOP_228_DB05_TEMPORAL_HOLD_GRANT_AUTHORITY_NOT_SEALED'; END IF;
 RAISE NOTICE 'WK_DB05_228_TEMPORAL_HOLD_GRANT_INVALIDATION=PASS';
END $postcheck$;
COMMIT;
