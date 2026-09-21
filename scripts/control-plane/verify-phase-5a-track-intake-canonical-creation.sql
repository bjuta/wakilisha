do $verify_phase_5a_m217$
declare
  v_finalizer text;
begin
  if to_regprocedure(
       'public.admin_create_registry_track_from_intake_enriched(uuid,text,text)'
     ) is not null
     or to_regprocedure(
       'public.admin_resolve_registry_track_intake_enriched(uuid,uuid,text,boolean)'
     ) is not null
     or to_regprocedure(
       'public.admin_resolve_registry_track_intake(uuid,uuid,text)'
     ) is not null
     or to_regprocedure(
       'public.sync_registry_track_intake_artist_credits(uuid,uuid)'
     ) is not null
  then
    raise exception
      'FAIL: M217 legacy Track Intake canonical writer road remains installed';
  end if;

  if to_regprocedure(
       'public.admin_create_registry_track_intake_identity_v1(uuid,text)'
     ) is null
     or to_regprocedure(
       'public.admin_reconcile_registry_track_intake_credit_v1(uuid,uuid,uuid)'
     ) is null
     or to_regprocedure(
       'public.admin_admit_registry_track_intake_track_profile_v1(uuid,uuid,boolean)'
     ) is null
     or to_regprocedure(
       'public.admin_admit_registry_track_intake_release_profile_v1(uuid,uuid,boolean)'
     ) is null
     or to_regprocedure(
       'public.admin_activate_registry_track_intake_v1(uuid)'
     ) is null
     or to_regprocedure(
       'public.admin_finalize_registry_track_intake_v1(uuid,uuid,text)'
     ) is null
  then
    raise exception
      'FAIL: M217 governed Track Intake replacement authority is incomplete';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.admin_create_registry_track_intake_identity_v1(uuid,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_reconcile_registry_track_intake_credit_v1(uuid,uuid,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_admit_registry_track_intake_track_profile_v1(uuid,uuid,boolean)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_admit_registry_track_intake_release_profile_v1(uuid,uuid,boolean)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_activate_registry_track_intake_v1(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_finalize_registry_track_intake_v1(uuid,uuid,text)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: M217 authenticated Registry reviewer lost governed Track Intake authority';
  end if;

  if has_function_privilege(
       'anon',
       'public.admin_create_registry_track_intake_identity_v1(uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.admin_reconcile_registry_track_intake_credit_v1(uuid,uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.admin_admit_registry_track_intake_track_profile_v1(uuid,uuid,boolean)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.admin_admit_registry_track_intake_release_profile_v1(uuid,uuid,boolean)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.admin_activate_registry_track_intake_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.admin_finalize_registry_track_intake_v1(uuid,uuid,text)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: M217 anonymous caller gained governed Track Intake authority';
  end if;

  select lower(
    pg_get_functiondef(
      'public.admin_finalize_registry_track_intake_v1(uuid,uuid,text)'::regprocedure
    )
  )
  into v_finalizer;

  if position('registry_track_intake_finalization_state_v1' in v_finalizer)=0
     or position('insert into public.registry_tracks' in v_finalizer)>0
     or position('update public.registry_tracks' in v_finalizer)>0
     or position('insert into public.registry_track_artists' in v_finalizer)>0
     or position('update public.registry_track_artists' in v_finalizer)>0
     or position('update public.registry_releases' in v_finalizer)>0
  then
    raise exception
      'FAIL: M217 workflow finalization regained canonical Registry mutation authority';
  end if;

  raise notice
    'PHASE_5A_TRACK_INTAKE_CANONICAL_CREATION_GOVERNED_PASS';
end;
$verify_phase_5a_m217$;
