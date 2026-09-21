-- Permanent verifier for Track Intake reviewed Artist-credit reconciliation authority.

do $verify$
declare
  v_definition text;
begin
  if not exists (
       select 1
       from public.capability_definitions
       where capability_key=
             'reconcile_registry_track_reviewed_artist_credit'
         and domain='registry'
     )
     or not exists (
       select 1
       from platform_private.registry_operation_types operation_type
       where operation_type.operation_key=
             'registry.track_artist_credit.reviewed_reconcile'
         and operation_type.operation_version=1
         and operation_type.capability_key=
             'reconcile_registry_track_reviewed_artist_credit'
         and operation_type.risk_class='high'
         and operation_type.allowed_subject_types=array['track']::text[]
         and operation_type.requires_existing_target
         and operation_type.max_targets=1
         and operation_type.max_rows_ceiling=1
         and operation_type.max_grant_ttl_seconds=300
         and operation_type.requires_human_approval
         and operation_type.requires_verifier
         and operation_type.enabled
     )
  then
    raise exception 'Track reviewed-credit reconciliation typed operation contract is missing or malformed';
  end if;

  if not exists (
       select 1
       from platform_private.system_actors actor
       where actor.actor_key='registry_track_intake_admin'
         and actor.status='active'
         and actor.capability_profile->'operation_family'
             ? 'registry.track_artist_credit.reviewed_reconcile/v1'
     )
  then
    raise exception 'Track Intake admin actor does not advertise reviewed-credit reconciliation V1';
  end if;

  if to_regprocedure('platform_private.registry_track_intake_existing_credit_candidate_state_v1(uuid,uuid,uuid,text)') is null
     or to_regprocedure('platform_private.registry_track_intake_existing_credit_candidate_fingerprint_v1(jsonb)') is null
     or to_regprocedure('platform_private.registry_track_intake_reconciled_credit_uuid_v1(uuid,uuid)') is null
     or to_regprocedure('platform_private.record_registry_track_intake_existing_credit_evidence_v1(uuid,uuid,uuid,jsonb,text)') is null
     or to_regprocedure('platform_private.issue_registry_track_intake_existing_credit_grant_v1(uuid,uuid,jsonb,text)') is null
     or to_regprocedure('platform_private.execute_registry_track_intake_existing_credit_reconcile_v1(uuid)') is null
     or to_regprocedure('platform_private.verify_registry_track_intake_existing_credit_reconcile_v1(uuid)') is null
     or to_regprocedure('public.admin_reconcile_registry_track_intake_credit_v1(uuid,uuid,uuid)') is null
  then
    raise exception 'Track Intake reviewed-credit reconciliation function set is incomplete';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.admin_reconcile_registry_track_intake_credit_v1(uuid,uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.admin_reconcile_registry_track_intake_credit_v1(uuid,uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_reconcile_registry_track_intake_credit_v1(uuid,uuid,uuid)',
       'EXECUTE'
     )
  then
    raise exception 'Track Intake reviewed-credit reconciliation public ACL is not exact';
  end if;

  if has_function_privilege(
       'authenticated',
       'platform_private.execute_registry_track_intake_existing_credit_reconcile_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.execute_registry_track_intake_existing_credit_reconcile_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.verify_registry_track_intake_existing_credit_reconcile_v1(uuid)',
       'EXECUTE'
     )
  then
    raise exception 'Track Intake reviewed-credit reconciliation private authority leaks external EXECUTE';
  end if;

  select lower(
    pg_get_functiondef(
      'public.admin_reconcile_registry_track_intake_credit_v1(uuid,uuid,uuid)'::regprocedure
    )
  )
  into v_definition;

  if position('registry.track_artist_credit.reviewed_reconcile' in lower(
       pg_get_functiondef(
         'platform_private.issue_registry_track_intake_existing_credit_grant_v1(uuid,uuid,jsonb,text)'::regprocedure
       )
     ))=0
     or position('manage_registry' in lower(
       pg_get_functiondef(
         'platform_private.issue_registry_track_intake_existing_credit_grant_v1(uuid,uuid,jsonb,text)'::regprocedure
       )
     ))=0
     or position('track_intake_review' in lower(
       pg_get_functiondef(
         'platform_private.execute_registry_track_intake_existing_credit_reconcile_v1(uuid)'::regprocedure
       )
     ))=0
     or position('verify_registry_track_intake_existing_credit_reconcile_v1' in v_definition)=0
     or position('insert into public.registry_track_artists' in v_definition)>0
     or position('update public.registry_track_artists' in v_definition)>0
     or position('delete from public.registry_track_artists' in lower(
       pg_get_functiondef(
         'platform_private.execute_registry_track_intake_existing_credit_reconcile_v1(uuid)'::regprocedure
       )
     ))>0
     or position('apple_music_ingest' in lower(
       pg_get_functiondef(
         'platform_private.execute_registry_track_intake_existing_credit_reconcile_v1(uuid)'::regprocedure
       )
     ))>0
  then
    raise exception 'Track Intake reviewed-credit reconciliation bypasses exact authority or falsifies provenance';
  end if;

  raise notice 'REGISTRY_TRACK_INTAKE_EXISTING_TRACK_CREDIT_RECONCILE_AUTHORITY_PASS';
end
$verify$;
