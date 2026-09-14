-- Read-only verifier for #937 Artist-origin admin backfill convergence.
do $verify$
declare
  v_actor_count integer;
  v_binding_count integer;
begin
  if to_regprocedure('public.admin_execute_registry_artist_origin_admission(uuid,text,numeric,text,text,text,timestamp with time zone)') is null
     or to_regprocedure('public.admin_verify_registry_artist_origin_admission(uuid)') is null
     or to_regprocedure('public.admin_set_registry_artist_origin_operation_enabled(boolean,text)') is null
     or to_regprocedure('platform_private.record_registry_artist_origin_user_evidence(uuid,text,numeric,text,text,text,timestamp with time zone)') is null
     or to_regprocedure('platform_private.issue_registry_artist_origin_user_execution_grant(uuid)') is null
     or to_regprocedure('platform_private.registry_execution_grant_has_current_authority(uuid)') is null
  then raise exception 'Artist-origin admin convergence function authority is incomplete'; end if;

  select count(*)::integer into v_actor_count
  from platform_private.system_actors
  where actor_key='registry_artist_origin_admin' and actor_kind='automation' and status='active';
  select count(*)::integer into v_binding_count
  from platform_private.system_actor_executor_bindings
  where actor_key='registry_artist_origin_admin' and executor_kind='database_role'
    and executor_key='authenticator' and status='active';
  if v_actor_count<>1 or v_binding_count<>1 then
    raise exception 'Artist-origin admin actor/executor authority drifted';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='platform_private' and table_name='registry_execution_grants'
      and column_name='system_actor_capability_grant_id' and is_nullable='YES'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema='platform_private' and table_name='registry_execution_grants'
      and column_name='required_user_capability_key' and is_nullable='YES'
  ) then raise exception 'Human exact-grant schema did not converge'; end if;

  if (select enabled from platform_private.registry_operation_types
      where operation_key='registry.artist_origin.admit' and operation_version=1) is distinct from true
  then raise exception 'Artist-origin operation is not enabled for the human admin path'; end if;

  if exists (
    select 1 from platform_private.system_actor_capability_grants
    where actor_key='mizizi' and capability_key='admit_registry_artist_origin'
      and status='active' and valid_from<=now() and expires_at>now()
  ) then raise exception 'MIZIZI Artist-origin standing authority unexpectedly activated'; end if;

  if has_function_privilege('anon','public.admin_execute_registry_artist_origin_admission(uuid,text,numeric,text,text,text,timestamptz)','EXECUTE')
     or has_function_privilege('service_role','public.admin_execute_registry_artist_origin_admission(uuid,text,numeric,text,text,text,timestamptz)','EXECUTE')
     or not has_function_privilege('authenticated','public.admin_execute_registry_artist_origin_admission(uuid,text,numeric,text,text,text,timestamptz)','EXECUTE')
     or has_function_privilege('anon','public.admin_verify_registry_artist_origin_admission(uuid)','EXECUTE')
     or has_function_privilege('service_role','public.admin_verify_registry_artist_origin_admission(uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.admin_verify_registry_artist_origin_admission(uuid)','EXECUTE')
  then raise exception 'Artist-origin admin public RPC privilege boundary drifted'; end if;

  if has_function_privilege('anon','platform_private.record_registry_artist_origin_user_evidence(uuid,text,numeric,text,text,text,timestamptz)','EXECUTE')
     or has_function_privilege('authenticated','platform_private.record_registry_artist_origin_user_evidence(uuid,text,numeric,text,text,text,timestamptz)','EXECUTE')
     or has_function_privilege('service_role','platform_private.record_registry_artist_origin_user_evidence(uuid,text,numeric,text,text,text,timestamptz)','EXECUTE')
     or has_function_privilege('authenticated','platform_private.issue_registry_artist_origin_user_execution_grant(uuid)','EXECUTE')
     or has_function_privilege('service_role','platform_private.issue_registry_artist_origin_user_execution_grant(uuid)','EXECUTE')
  then raise exception 'Artist-origin admin private authority leaked direct execution'; end if;

  if exists (
    select 1 from platform_private.registry_execution_grants grant_row
    where grant_row.actor_key='registry_artist_origin_admin'
      and (
        grant_row.operation_key<>'registry.artist_origin.admit'
        or grant_row.operation_version<>1
        or grant_row.capability_key<>'admit_registry_artist_origin'
        or grant_row.max_rows<>1
        or grant_row.system_actor_capability_grant_id is not null
        or grant_row.issued_by_user_id is null
        or grant_row.required_user_capability_key<>'manage_registry'
        or grant_row.issued_by_principal_key<>'user:'||grant_row.issued_by_user_id::text
      )
  ) then raise exception 'Artist-origin admin exact grant escaped human one-row authority'; end if;
end
$verify$;

select
  'MIZIZI_ARTIST_ORIGIN_BACKFILL_CONVERGENCE_PASS' as result,
  (select enabled from platform_private.registry_operation_types
   where operation_key='registry.artist_origin.admit' and operation_version=1) as operation_enabled,
  (select count(*) from platform_private.system_actor_capability_grants
   where actor_key='mizizi' and capability_key='admit_registry_artist_origin'
     and status='active' and valid_from<=now() and expires_at>now()) as active_mizizi_standing_grants,
  (select count(*) from platform_private.registry_execution_grants
   where actor_key='registry_artist_origin_admin') as admin_exact_grants,
  (select count(*) from platform_private.registry_mutation_operations
   where actor_key='registry_artist_origin_admin') as admin_operations;
