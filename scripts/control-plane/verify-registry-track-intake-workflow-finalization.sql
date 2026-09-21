-- Permanent verifier for Track Intake workflow-only finalization.

do $verify$
declare
  v_queue_definition text;
  v_finalizer_definition text;
  v_state_definition text;
begin
  if to_regprocedure(
       'platform_private.registry_track_intake_finalization_state_v1(uuid,uuid)'
     ) is null
     or to_regprocedure(
       'public.admin_finalize_registry_track_intake_v1(uuid,uuid,text)'
     ) is null
  then
    raise exception
      'Track Intake workflow-finalization function set is incomplete';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.admin_finalize_registry_track_intake_v1(uuid,uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.admin_finalize_registry_track_intake_v1(uuid,uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_finalize_registry_track_intake_v1(uuid,uuid,text)',
       'EXECUTE'
     )
  then
    raise exception
      'Track Intake workflow-finalization public ACL is not exact';
  end if;

  if has_function_privilege(
       'authenticated',
       'platform_private.registry_track_intake_finalization_state_v1(uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.registry_track_intake_finalization_state_v1(uuid,uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'Track Intake finalization proof leaks private EXECUTE';
  end if;

  select lower(
    pg_get_functiondef(
      'public.admin_get_registry_track_intake_queue(text,integer,integer,uuid,uuid)'::regprocedure
    )
  )
  into v_queue_definition;

  if position($needle$'credit_id'$needle$ in v_queue_definition)=0
     or position('credit.id' in v_queue_definition)=0
  then
    raise exception
      'Track Intake queue does not expose immutable source credit identity';
  end if;

  select lower(
    pg_get_functiondef(
      'public.admin_finalize_registry_track_intake_v1(uuid,uuid,text)'::regprocedure
    )
  )
  into v_finalizer_definition;

  if position('registry_track_intake_finalization_state_v1' in v_finalizer_definition)=0
     or position('update public.registry_provider_track_suggestions' in v_finalizer_definition)=0
     or position('insert into public.provider_entity_links' in v_finalizer_definition)=0
     or position('registry_track_provider_links' in v_finalizer_definition)=0
     or position('idempotent_replay' in v_finalizer_definition)=0
  then
    raise exception
      'Track Intake finalizer does not preserve the exact workflow-only contract';
  end if;

  if position('insert into public.registry_tracks' in v_finalizer_definition)>0
     or position('update public.registry_tracks' in v_finalizer_definition)>0
     or position('delete from public.registry_tracks' in v_finalizer_definition)>0
     or position('insert into public.registry_track_artists' in v_finalizer_definition)>0
     or position('update public.registry_track_artists' in v_finalizer_definition)>0
     or position('delete from public.registry_track_artists' in v_finalizer_definition)>0
     or position('insert into public.registry_releases' in v_finalizer_definition)>0
     or position('update public.registry_releases' in v_finalizer_definition)>0
     or position('delete from public.registry_releases' in v_finalizer_definition)>0
     or position('insert into public.registry_track_provider_links' in v_finalizer_definition)>0
     or position('update public.registry_track_provider_links' in v_finalizer_definition)>0
     or position('delete from public.registry_track_provider_links' in v_finalizer_definition)>0
  then
    raise exception
      'Track Intake workflow finalizer contains forbidden canonical Registry DML';
  end if;

  select lower(
    pg_get_functiondef(
      'platform_private.registry_track_intake_finalization_state_v1(uuid,uuid)'::regprocedure
    )
  )
  into v_state_definition;

  if position('registry.track_artist_credit.reviewed_reconcile' in v_state_definition)=0
     or position('registry.track.create' in v_state_definition)=0
     or position('registry.track.activate' in v_state_definition)=0
     or position('registry_track_intake_credit_review_snapshot_v1' in v_state_definition)=0
     or position('registry_track_intake_credit_set_review_snapshot_v1' in v_state_definition)=0
     or position('registry_track_intake_track_profile_snapshot_v1' in v_state_definition)=0
     or position('registry_track_intake_release_profile_snapshot_v1' in v_state_definition)=0
     or position('registry_track_provider_links' in v_state_definition)=0
  then
    raise exception
      'Track Intake finalization proof does not cover all current child authority';
  end if;

  if to_regprocedure(
       'public.admin_create_registry_track_from_intake_enriched(uuid,text,text)'
     ) is null
     or to_regprocedure(
       'public.admin_resolve_registry_track_intake_enriched(uuid,uuid,text,boolean)'
     ) is null
     or to_regprocedure(
       'public.admin_resolve_registry_track_intake(uuid,uuid,text)'
     ) is null
     or to_regprocedure(
       'public.sync_registry_track_intake_artist_credits(uuid,uuid)'
     ) is null
  then
    raise exception
      'Legacy Track Intake compatibility roads were retired before caller cutover acceptance';
  end if;

  raise notice 'REGISTRY_TRACK_INTAKE_WORKFLOW_FINALIZATION_PASS';
end
$verify$;
