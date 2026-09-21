-- Permanent negative verifier for retired Track Intake canonical writers.

do $verify$
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
      'Retired Track Intake canonical writer road was reintroduced';
  end if;

  if to_regprocedure(
       'public.admin_admit_registry_track_intake_credit_v1(uuid,uuid)'
     ) is not null
     or to_regprocedure(
       'platform_private.execute_registry_track_intake_credit_v1(uuid)'
     ) is not null
     or to_regprocedure(
       'platform_private.issue_registry_track_intake_credit_grant_v1(uuid,uuid,uuid,jsonb)'
     ) is not null
     or to_regprocedure(
       'platform_private.record_registry_track_intake_credit_evidence_v1(uuid,uuid,uuid,uuid,text,integer,text)'
     ) is not null
     or to_regprocedure(
       'platform_private.registry_track_intake_deterministic_credit_uuid_v1(uuid)'
     ) is not null
     or to_regprocedure(
       'platform_private.registry_track_intake_existing_credit_candidate_state_v1(uuid,uuid,text)'
     ) is not null
  then
    raise exception
      'Superseded Track Intake credit-admit diagnostic authority was reintroduced';
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
      'Governed Track Intake replacement authority is incomplete';
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
      'Authenticated Registry reviewer lost governed Track Intake authority';
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
     or has_function_privilege(
       'service_role',
       'public.admin_create_registry_track_intake_identity_v1(uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_reconcile_registry_track_intake_credit_v1(uuid,uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_admit_registry_track_intake_track_profile_v1(uuid,uuid,boolean)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_admit_registry_track_intake_release_profile_v1(uuid,uuid,boolean)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_activate_registry_track_intake_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_finalize_registry_track_intake_v1(uuid,uuid,text)',
       'EXECUTE'
     )
  then
    raise exception
      'Track Intake governed authority leaked anon/service_role EXECUTE';
  end if;

  select lower(
    pg_get_functiondef(
      'public.admin_finalize_registry_track_intake_v1(uuid,uuid,text)'::regprocedure
    )
  )
  into v_finalizer;

  if position('insert into public.registry_tracks' in v_finalizer)>0
     or position('update public.registry_tracks' in v_finalizer)>0
     or position('delete from public.registry_tracks' in v_finalizer)>0
     or position('insert into public.registry_track_artists' in v_finalizer)>0
     or position('update public.registry_track_artists' in v_finalizer)>0
     or position('delete from public.registry_track_artists' in v_finalizer)>0
     or position('insert into public.registry_releases' in v_finalizer)>0
     or position('update public.registry_releases' in v_finalizer)>0
     or position('delete from public.registry_releases' in v_finalizer)>0
     or position('insert into public.registry_track_provider_links' in v_finalizer)>0
     or position('update public.registry_track_provider_links' in v_finalizer)>0
     or position('delete from public.registry_track_provider_links' in v_finalizer)>0
  then
    raise exception
      'Track Intake workflow finalizer regained canonical Registry DML';
  end if;

  raise notice 'REGISTRY_TRACK_INTAKE_LEGACY_WRITER_RETIREMENT_PASS';
end
$verify$;
