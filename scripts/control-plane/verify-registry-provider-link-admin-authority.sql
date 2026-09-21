-- MIZIZI Slice 3 Registry Provider Link Admin Authority verifier.
-- Read-only. Fails closed on authority, privilege, stale-state or causality drift.

do $verify$
declare
  v_wrapper regprocedure :=
    to_regprocedure('public.admin_admit_registry_track_provider_link_v1(uuid,text,text,text,text[],text,text,text,text,integer,text,text,numeric,text,jsonb)');
  v_legacy regprocedure :=
    to_regprocedure('public.registry_upsert_track_provider_link(uuid,text,text,text,text[],text,text,text,text,integer,text,text,numeric,text,jsonb)');
begin
  if v_wrapper is null
     or v_legacy is null
     or to_regprocedure('platform_private.registry_provider_link_admin_current_user_v1()') is null
     or to_regprocedure('platform_private.registry_provider_link_admin_claim_v1(uuid,text,text,text,text[],text,text,text,text,integer,text,text,numeric,text,jsonb)') is null
     or to_regprocedure('platform_private.registry_provider_link_state_fingerprint_v1(uuid,text,text)') is null
     or to_regprocedure('platform_private.registry_provider_link_matches_claim_v1(uuid,jsonb)') is null
     or to_regprocedure('platform_private.record_registry_provider_link_admin_evidence_v1(uuid,jsonb)') is null
     or to_regprocedure('platform_private.issue_registry_provider_link_admin_grant_v1(uuid)') is null
     or to_regprocedure('platform_private.execute_registry_provider_link_admin_v1(uuid)') is null
     or to_regprocedure('platform_private.verify_registry_provider_link_admin_v1(uuid)') is null
  then
    raise exception 'STOP: Registry Provider Link Admin V1 function set is incomplete';
  end if;

  if not exists (
    select 1
    from platform_private.system_actors actor
    where actor.actor_key='registry_provider_link_admin'
      and actor.status='active'
      and actor.capability_profile->>'required_user_capability'='manage_registry'
      and actor.capability_profile->'operation_family'
          @> '["registry.track.provider_link.admit/v1"]'::jsonb
  ) then
    raise exception 'STOP: Registry provider-link admin actor drifted';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings binding
    where binding.actor_key='registry_provider_link_admin'
      and binding.executor_kind='database_role'
      and binding.executor_key='authenticator'
      and binding.status='active'
  ) then
    raise exception 'STOP: Registry provider-link admin executor binding drifted';
  end if;

  if has_function_privilege('anon',v_wrapper,'EXECUTE')
     or has_function_privilege('service_role',v_wrapper,'EXECUTE')
     or not has_function_privilege('authenticated',v_wrapper,'EXECUTE')
  then
    raise exception 'STOP: Registry provider-link admin wrapper grants drifted';
  end if;

  if has_function_privilege('anon',v_legacy,'EXECUTE')
     or has_function_privilege('authenticated',v_legacy,'EXECUTE')
     or has_function_privilege('service_role',v_legacy,'EXECUTE')
  then
    raise exception 'STOP: legacy Registry provider-link upsert still has external EXECUTE';
  end if;

  if has_function_privilege(
       'authenticated',
       'platform_private.execute_registry_provider_link_admin_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.execute_registry_provider_link_admin_v1(uuid)',
       'EXECUTE'
     )
  then
    raise exception 'STOP: Registry provider-link private executor leaked role authority';
  end if;

  if position(
       'current_user_has_capability(''manage_registry'')'
       in pg_get_functiondef(
         'platform_private.registry_provider_link_admin_current_user_v1()'::regprocedure
       )
     )=0
     or position(
       'INTERNAL_FACT'
       in pg_get_functiondef(
         'platform_private.record_registry_provider_link_admin_evidence_v1(uuid,jsonb)'::regprocedure
       )
     )=0
     or position(
       '''trust_class'',v_evidence.trust_class'
       in replace(
         pg_get_functiondef(
           'platform_private.issue_registry_provider_link_admin_grant_v1(uuid)'::regprocedure
         ),
         ' ',
         ''
       )
     )=0
     or position(
       'required_user_capability_key'
       in pg_get_functiondef(
         'platform_private.issue_registry_provider_link_admin_grant_v1(uuid)'::regprocedure
       )
     )=0
     or position(
       'WK_STALE_PROVIDER_LINK'
       in pg_get_functiondef(
         'platform_private.execute_registry_provider_link_admin_v1(uuid)'::regprocedure
       )
     )=0
     or position(
       'registry_operation_write_events'
       in pg_get_functiondef(
         'platform_private.execute_registry_provider_link_admin_v1(uuid)'::regprocedure
       )
     )=0
     or position(
       'registry_provider_link_matches_claim_v1'
       in pg_get_functiondef(
         'platform_private.verify_registry_provider_link_admin_v1(uuid)'::regprocedure
       )
     )=0
  then
    raise exception 'STOP: Registry provider-link exact-operation authority drifted';
  end if;

  if not exists (
    select 1
    from platform_private.registry_operation_types operation_type
    where operation_type.operation_key='registry.track.provider_link.admit'
      and operation_type.operation_version=1
      and operation_type.capability_key='admit_registry_track_provider_link'
      and operation_type.enabled
      and operation_type.requires_existing_target
      and operation_type.max_targets=1
      and operation_type.max_rows_ceiling=1
      and operation_type.requires_human_approval
      and operation_type.requires_verifier
  ) then
    raise exception 'STOP: typed Registry provider-link operation drifted';
  end if;

  raise notice 'REGISTRY_PROVIDER_LINK_ADMIN_AUTHORITY_PASS';
end
$verify$;
