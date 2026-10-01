-- WAKILISHA — Creator cohort Work provider resolution V1 verifier
-- Read-only. Fails closed on authority, grant, scheme, or residue drift.

begin transaction read only;

do $verify$
declare
  v_scheme_constraint text;
  v_observation text;
  v_admission text;
  v_work_identifier text;
begin
  if to_regprocedure(
       'platform_private.registry_provider_work_uuid_v1(text,text)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_provider_track_work_link_uuid_v1(uuid,uuid,text)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_work_external_identifier_candidate_state_v1(uuid,text,text)'
     ) is null
     or to_regprocedure(
       'platform_private.execute_registry_work_external_identifier_admin_v1(uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.verify_registry_work_external_identifier_admin_v1(uuid)'
     ) is null
     or to_regprocedure(
       'public.record_registry_work_provider_observation_v1(uuid,text,text,text,text,text,text,timestamp with time zone,jsonb)'
     ) is null
     or to_regprocedure(
       'public.admin_admit_registry_work_external_identifier_candidate_v1(uuid,text,text)'
     ) is null
     or to_regprocedure(
       'public.admin_admit_registry_work_provider_observation_v1(uuid,uuid)'
     ) is null
  then
    raise exception
      'Creator cohort Work provider resolution V1 function family is incomplete';
  end if;

  if not exists (
    select 1
    from platform_private.registry_operation_types operation_type
    where operation_type.operation_key='registry.work.create'
      and operation_type.operation_version=1
      and operation_type.capability_key='create_registry_work'
      and operation_type.enabled
      and operation_type.allowed_subject_types=array['work']::text[]
      and not operation_type.requires_existing_target
      and operation_type.max_targets=1
      and operation_type.max_rows_ceiling=1
      and operation_type.max_grant_ttl_seconds=300
      and operation_type.requires_human_approval
      and operation_type.requires_verifier
  ) then
    raise exception 'Registry Work creation authority drifted';
  end if;

  if not exists (
    select 1
    from platform_private.registry_operation_types operation_type
    where operation_type.operation_key='registry.track_work_link.admit'
      and operation_type.operation_version=1
      and operation_type.capability_key='admit_registry_track_work_link'
      and operation_type.enabled
      and operation_type.allowed_subject_types=array['track_work_link']::text[]
      and not operation_type.requires_existing_target
      and operation_type.max_targets=1
      and operation_type.max_rows_ceiling=1
      and operation_type.max_grant_ttl_seconds=300
      and operation_type.requires_human_approval
      and operation_type.requires_verifier
  ) then
    raise exception 'Registry Track-to-Work authority drifted';
  end if;

  if not exists (
    select 1
    from platform_private.registry_operation_types operation_type
    where operation_type.operation_key=
          'registry.external_identifier_assertion.admit'
      and operation_type.operation_version=1
      and operation_type.capability_key=
          'admit_registry_external_identifier_assertion'
      and operation_type.enabled
      and operation_type.allowed_subject_types=
          array['external_identifier_assertion']::text[]
      and not operation_type.requires_existing_target
      and operation_type.max_targets=1
      and operation_type.max_rows_ceiling=1
      and operation_type.max_grant_ttl_seconds=300
      and operation_type.requires_human_approval
      and operation_type.requires_verifier
  ) then
    raise exception 'Registry external identifier authority drifted';
  end if;

  select pg_get_constraintdef(oid)
  into v_scheme_constraint
  from pg_constraint
  where conrelid='public.registry_external_identifier_assertions'::regclass
    and conname='registry_external_identifier_assertions_scheme_check';

  if v_scheme_constraint is null
     or position('musicbrainz' in lower(v_scheme_constraint))=0
     or position('iswc' in lower(v_scheme_constraint))=0
  then
    raise exception
      'Work external identifier scheme contract lacks MusicBrainz/ISWC';
  end if;

  if has_function_privilege(
       'anon',
       'public.record_registry_work_provider_observation_v1(uuid,text,text,text,text,text,text,timestamp with time zone,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.record_registry_work_provider_observation_v1(uuid,text,text,text,text,text,text,timestamp with time zone,jsonb)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.record_registry_work_provider_observation_v1(uuid,text,text,text,text,text,text,timestamp with time zone,jsonb)',
       'EXECUTE'
     )
  then
    raise exception
      'Provider observation recorder grant boundary drifted';
  end if;

  if has_function_privilege(
       'anon',
       'public.admin_admit_registry_work_provider_observation_v1(uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_admit_registry_work_provider_observation_v1(uuid,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_admit_registry_work_provider_observation_v1(uuid,uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'Work provider admission wrapper grant boundary drifted';
  end if;

  if has_function_privilege(
       'anon',
       'public.admin_admit_registry_work_external_identifier_candidate_v1(uuid,text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_admit_registry_work_external_identifier_candidate_v1(uuid,text,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_admit_registry_work_external_identifier_candidate_v1(uuid,text,text)',
       'EXECUTE'
     )
  then
    raise exception
      'Work external identifier wrapper grant boundary drifted';
  end if;

  if has_function_privilege(
       'authenticated',
       'platform_private.execute_registry_work_external_identifier_admin_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.execute_registry_work_external_identifier_admin_v1(uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'Work external identifier private executor leaked role authority';
  end if;

  if has_table_privilege('anon','public.registry_works','INSERT')
     or has_table_privilege('authenticated','public.registry_works','INSERT')
     or has_table_privilege('service_role','public.registry_works','INSERT')
     or has_table_privilege('anon','public.registry_track_work_links','INSERT')
     or has_table_privilege('authenticated','public.registry_track_work_links','INSERT')
     or has_table_privilege('service_role','public.registry_track_work_links','INSERT')
     or has_table_privilege('anon','public.registry_external_identifier_assertions','INSERT')
     or has_table_privilege('authenticated','public.registry_external_identifier_assertions','INSERT')
     or has_table_privilege('service_role','public.registry_external_identifier_assertions','INSERT')
  then
    raise exception
      'Direct Work/Track-to-Work/external-identifier insert authority leaked';
  end if;

  select pg_get_functiondef(
    'public.record_registry_work_provider_observation_v1(uuid,text,text,text,text,text,text,timestamp with time zone,jsonb)'::regprocedure
  )
  into v_observation;

  if position('EXTERNAL_EVIDENCE' in v_observation)=0
     or position('system:music_work_provider_resolver' in v_observation)=0
     or position('registry_provider_work_uuid_v1' in v_observation)=0
     or position('registry_provider_track_work_link_uuid_v1' in v_observation)=0
     or position('service_role' in v_observation)=0
  then
    raise exception
      'Provider observation recorder lost trusted-source or deterministic identity contract';
  end if;

  select pg_get_functiondef(
    'public.admin_admit_registry_work_provider_observation_v1(uuid,uuid)'::regprocedure
  )
  into v_admission;

  if position('admin_create_registry_work_v1' in v_admission)=0
     or position('admin_admit_registry_work_external_identifier_candidate_v1' in v_admission)=0
     or position('admin_admit_registry_track_work_link_v1' in v_admission)=0
     or position('registry_provenance_admin_current_user_v1' in v_admission)=0
  then
    raise exception
      'Work provider admission stopped composing accepted typed authorities';
  end if;

  select pg_get_functiondef(
    'public.admin_admit_registry_work_external_identifier_candidate_v1(uuid,text,text)'::regprocedure
  )
  into v_work_identifier;

  if position('registry_external_identifier_admin_current_user_v1' in v_work_identifier)=0
     or position('issue_registry_external_identifier_admin_grant_v1' in v_work_identifier)=0
     or position('verify_registry_work_external_identifier_admin_v1' in v_work_identifier)=0
  then
    raise exception
      'Work external identifier adapter stopped using accepted external-ID authority';
  end if;

  if exists (
    select 1
    from platform_private.registry_execution_grants execution_grant
    where execution_grant.status='active'
      and execution_grant.expires_at>now()
      and execution_grant.actor_key in (
        'registry_provenance_admin',
        'registry_external_identifier_admin'
      )
  ) then
    raise exception
      'Active Work/external-identifier execution grant remains at rest';
  end if;
end
$verify$;

select
  'CREATOR_COHORT_WORK_PROVIDER_RESOLUTION_V1_PASS'::text as status;

rollback;
