do $mizizi_track_identity_write_boundary_verify$
declare
  v_definition text;
begin
  if to_regprocedure(
       'public.admin_create_registry_track_from_intake_enriched(uuid,text,text)'
     ) is not null
     or to_regprocedure(
       'public.admin_resolve_registry_track_intake_enriched(uuid,uuid,text,boolean)'
     ) is not null
  then
    raise exception
      'FAIL: retired MIZIZI Track Intake canonical creation road was reintroduced.';
  end if;

  if to_regprocedure(
       'public.admin_create_registry_track_intake_identity_v1(uuid,text)'
     ) is null
     or to_regprocedure(
       'platform_private.execute_registry_track_create_v2(uuid)'
     ) is null
  then
    raise exception
      'FAIL: governed MIZIZI Track Intake identity authority is missing.';
  end if;

  if has_function_privilege(
       'anon',
       'public.admin_create_registry_track_intake_identity_v1(uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_create_registry_track_intake_identity_v1(uuid,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_create_registry_track_intake_identity_v1(uuid,text)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: governed MIZIZI Track Intake identity privilege boundary is wrong.';
  end if;

  select lower(
    pg_get_functiondef(
      'public.admin_create_registry_track_intake_identity_v1(uuid,text)'::regprocedure
    )
  )
  into v_definition;

  if position(
       'platform_private.execute_registry_track_create_v2'
       in v_definition
     )=0
     or position(
       'platform_private.verify_registry_track_create_v2'
       in v_definition
     )=0
     or position(
       'insert into public.registry_tracks'
       in v_definition
     )>0
     or position(
       'insert into public.registry_track_artists'
       in v_definition
     )>0
  then
    raise exception
      'FAIL: governed MIZIZI Track Intake identity bridge bypasses typed exact operation authority.';
  end if;

  if not exists (
       select 1
       from platform_private.registry_operation_types operation_type
       where operation_type.operation_key='registry.track.create'
         and operation_type.operation_version=2
         and operation_type.enabled
         and operation_type.requires_human_approval
         and operation_type.requires_verifier
     )
  then
    raise exception
      'FAIL: Registry Track Create V2 operation contract is missing or disabled.';
  end if;

  raise notice
    'PASS: MIZIZI Track Intake write boundary is structurally sealed.';
end;
$mizizi_track_identity_write_boundary_verify$;
