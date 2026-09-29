-- Permanent structural verifier for Music Provenance Slice 1 authority.

do $verify$
declare
  v_definition text;
  v_constraint text;
  v_operation_count integer;
begin
  if to_regclass('platform_private.registry_contribution_attestations') is null
     or to_regclass('platform_private.registry_contribution_attestation_state_events') is null
     or to_regclass('platform_private.registry_contribution_attestation_permission_versions') is null
     or to_regclass('public.registry_artist_person_memberships') is null
  then
    raise exception 'Music provenance Slice 1 typed attestation/membership authority is incomplete';
  end if;

  if to_regclass('editorial.person_registry_artist_links') is null then
    raise exception 'Person-to-Registry-Artist bridge is missing';
  end if;

  if to_regclass(
       'editorial.person_registry_artist_links_current_artist_unique'
     ) is null
  then
    raise exception 'Active Registry Artist to Person uniqueness is missing';
  end if;

  if has_table_privilege(
       'anon',
       'editorial.person_registry_artist_links',
       'SELECT,INSERT,UPDATE,DELETE'
     )
     or has_table_privilege(
       'authenticated',
       'editorial.person_registry_artist_links',
       'SELECT,INSERT,UPDATE,DELETE'
     )
     or has_table_privilege(
       'service_role',
       'editorial.person_registry_artist_links',
       'SELECT,INSERT,UPDATE,DELETE'
     )
  then
    raise exception 'Person-to-Registry-Artist bridge leaked ambient table authority';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid='editorial.people'::regclass
      and tgname='person_registry_artist_links_person_merge_transfer'
      and not tgisinternal
  )
     or to_regprocedure(
          'editorial.transfer_person_registry_artist_links_on_merge_v1()'
        ) is null
  then
    raise exception 'Person merge does not preserve Registry Artist bridge history';
  end if;

  select pg_get_functiondef(
    'public.merge_people(uuid,uuid,bigint,bigint,text,text,uuid)'::regprocedure
  )
  into v_definition;

  if position('person_registry_artist_links' in v_definition)<>0 then
    raise exception 'Existing Person merge primitive was rewritten instead of composed';
  end if;

  select pg_get_functiondef(
    'editorial.resolve_person_presentation(uuid)'::regprocedure
  )
  into v_definition;

  if position('person_registry_artist_links' in v_definition)<>0 then
    raise exception 'Registry Artist bridge became automatic Person presentation authority';
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relname='registry_artist_person_memberships'
      and c.relrowsecurity
  ) then
    raise exception 'Typed Group membership RLS is missing';
  end if;

  if has_table_privilege(
       'anon',
       'public.registry_artist_person_memberships',
       'SELECT,INSERT,UPDATE,DELETE'
     )
     or has_table_privilege(
       'authenticated',
       'public.registry_artist_person_memberships',
       'SELECT,INSERT,UPDATE,DELETE'
     )
     or has_table_privilege(
       'service_role',
       'public.registry_artist_person_memberships',
       'INSERT,UPDATE,DELETE'
     )
  then
    raise exception 'Typed Group membership table leaked direct write/browser authority';
  end if;

  if not has_table_privilege(
       'service_role',
       'public.registry_artist_person_memberships',
       'SELECT'
     )
  then
    raise exception 'Typed Group membership service-role read authority is missing';
  end if;

  if has_table_privilege(
       'anon',
       'platform_private.registry_contribution_attestations',
       'SELECT,INSERT,UPDATE,DELETE'
     )
     or has_table_privilege(
       'authenticated',
       'platform_private.registry_contribution_attestations',
       'SELECT,INSERT,UPDATE,DELETE'
     )
     or has_table_privilege(
       'service_role',
       'platform_private.registry_contribution_attestations',
       'SELECT,INSERT,UPDATE,DELETE'
     )
  then
    raise exception 'Contribution attestation authority leaked outside platform_private';
  end if;

  if to_regclass(
       'platform_private.registry_contribution_attestation_permissions_one_root'
     ) is null
     or to_regclass(
       'platform_private.registry_contribution_attestation_permissions_one_successor'
     ) is null
  then
    raise exception 'Attestation permission-version chain can fork or have multiple roots';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid=
          'platform_private.registry_contribution_attestations'::regclass
      and tgname='registry_contribution_attestations_append_only'
      and not tgisinternal
  )
  or not exists (
    select 1
    from pg_trigger
    where tgrelid=
          'platform_private.registry_contribution_attestation_state_events'::regclass
      and tgname='registry_contribution_attestation_state_events_append_only'
      and not tgisinternal
  )
  or not exists (
    select 1
    from pg_trigger
    where tgrelid=
          'platform_private.registry_contribution_attestation_permission_versions'::regclass
      and tgname='registry_contribution_attestation_permissions_append_only'
      and not tgisinternal
  ) then
    raise exception 'Contribution attestation history is not append-only';
  end if;

  select pg_get_constraintdef(oid)
  into v_constraint
  from pg_constraint
  where conrelid=
        'platform_private.registry_contribution_attestations'::regclass
    and conname='registry_contribution_attestations_elicitation_check';

  if v_constraint is null
     or position('open_response' in v_constraint)=0
     or position('self_claim' in v_constraint)=0
     or position('suggested_confirmation' in v_constraint)=0
     or position('counterparty_confirmation' in v_constraint)=0
     or position('imported_source' in v_constraint)=0
  then
    raise exception 'Attestation elicitation provenance vocabulary drifted';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema='platform_private'
      and table_name='registry_contribution_attestation_state_events'
      and column_name='event_sequence'
      and is_identity='YES'
  )
  or not exists (
    select 1
    from information_schema.columns
    where table_schema='platform_private'
      and table_name='registry_contribution_attestation_permission_versions'
      and column_name='event_sequence'
      and is_identity='YES'
  ) then
    raise exception 'Attestation history lacks deterministic append order';
  end if;

  select pg_get_constraintdef(oid)
  into v_constraint
  from pg_constraint
  where conrelid=
        'platform_private.registry_contribution_attestation_state_events'::regclass
    and conname='registry_contribution_attestation_state_events_state_check';

  if v_constraint is null
     or position('asserted' in v_constraint)=0
     or position('corroborated' in v_constraint)=0
     or position('confirmed' in v_constraint)=0
     or position('disputed' in v_constraint)=0
     or position('withdrawn' in v_constraint)=0
     or position('superseded' in v_constraint)=0
  then
    raise exception 'Attestation state history vocabulary drifted';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema='platform_private'
      and table_name='registry_evidence_assertions'
      and column_name='parent_assertion_id'
  )
  or not exists (
    select 1
    from information_schema.columns
    where table_schema='platform_private'
      and table_name='registry_evidence_assertions'
      and column_name='source_use_basis'
  )
  or not exists (
    select 1
    from information_schema.columns
    where table_schema='platform_private'
      and table_name='registry_evidence_assertions'
      and column_name='independence_group_hint'
  ) then
    raise exception 'Shared evidence lineage/reuse semantics are incomplete';
  end if;

  if to_regprocedure(
       'public.admin_link_person_registry_artist_v1(uuid,bigint,uuid,uuid,text)'
     ) is null
     or to_regprocedure(
       'public.admin_admit_registry_artist_person_membership_v1(uuid,uuid,text,text,date,date,uuid)'
     ) is null
  then
    raise exception 'Reviewed Person/Artist or Group membership RPC is missing';
  end if;

  if has_function_privilege(
       'anon',
       'public.admin_link_person_registry_artist_v1(uuid,bigint,uuid,uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_link_person_registry_artist_v1(uuid,bigint,uuid,uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.admin_admit_registry_artist_person_membership_v1(uuid,uuid,text,text,date,date,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_admit_registry_artist_person_membership_v1(uuid,uuid,text,text,date,date,uuid)',
       'EXECUTE'
     )
  then
    raise exception 'Reviewed identity/membership RPC leaked execution authority';
  end if;

  select pg_get_functiondef(
    'public.admin_admit_registry_artist_person_membership_v1(uuid,uuid,text,text,date,date,uuid)'::regprocedure
  )
  into v_definition;

  if position('registry_track_contributions' in v_definition)<>0
     or position('registry_work_contributions' in v_definition)<>0
  then
    raise exception 'Group membership incorrectly mutates contribution authority';
  end if;

  if to_regprocedure(
       'platform_private.execute_registry_provenance_admin_v1(uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.verify_registry_provenance_admin_v1(uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.issue_registry_provenance_admin_grant_v1(text,text,uuid,jsonb)'
     ) is null
  then
    raise exception 'Governed Work/Contribution broker-executor-verifier path is incomplete';
  end if;

  select count(*)
  into v_operation_count
  from (
    values
      ('registry.work.create',1,'create_registry_work','work'),
      ('registry.track_work_link.admit',1,'admit_registry_track_work_link','track_work_link'),
      ('registry.track_contribution.admit',1,'admit_registry_track_contribution','track_contribution'),
      ('registry.work_contribution.admit',1,'admit_registry_work_contribution','work_contribution')
  ) expected(
    operation_key,
    operation_version,
    capability_key,
    subject_type
  )
  join platform_private.registry_operation_types actual
    on actual.operation_key=expected.operation_key
   and actual.operation_version=expected.operation_version
   and actual.capability_key=expected.capability_key
   and actual.allowed_subject_types=array[expected.subject_type]::text[]
   and not actual.requires_existing_target
   and actual.max_targets=1
   and actual.max_rows_ceiling=1
   and actual.max_grant_ttl_seconds=300
   and actual.requires_human_approval
   and actual.requires_verifier
   and actual.enabled;

  if v_operation_count<>4 then
    raise exception 'The four provenance v1 operation families are not exactly enabled';
  end if;

  if exists (
    select 1
    from platform_private.registry_operation_types
    where operation_key in (
      'registry.rights_claim.admit',
      'registry.rights_claim.reviewed_reconcile'
    )
      and enabled
  ) then
    raise exception 'Contribution authority incorrectly enabled Rights Claim mutation';
  end if;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants
    where actor_key='registry_provenance_admin'
  ) then
    raise exception 'Registry provenance broker has standing mutation authority';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings
    where actor_key='registry_provenance_admin'
      and executor_kind='database_role'
      and executor_key='authenticator'
      and status='active'
  ) then
    raise exception 'Registry provenance admin authenticator binding is missing';
  end if;

  if has_function_privilege(
       'anon',
       'platform_private.execute_registry_provenance_admin_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.execute_registry_provenance_admin_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.execute_registry_provenance_admin_v1(uuid)',
       'EXECUTE'
     )
  then
    raise exception 'Registry provenance private executor leaked execution authority';
  end if;

  foreach v_definition in array array[
    'public.admin_create_registry_work_v1(uuid)',
    'public.admin_admit_registry_track_work_link_v1(uuid)',
    'public.admin_admit_registry_track_contribution_v1(uuid)',
    'public.admin_admit_registry_work_contribution_v1(uuid)'
  ]
  loop
    if not has_function_privilege(
         'authenticated',
         v_definition,
         'EXECUTE'
       )
       or has_function_privilege('anon',v_definition,'EXECUTE')
       or has_function_privilege('service_role',v_definition,'EXECUTE')
    then
      raise exception 'Provenance reviewed wrapper ACL drifted: %',v_definition;
    end if;
  end loop;

  if has_table_privilege('anon','public.registry_works','INSERT')
     or has_table_privilege('authenticated','public.registry_works','INSERT')
     or has_table_privilege('service_role','public.registry_works','INSERT')
     or has_table_privilege('anon','public.registry_track_work_links','INSERT')
     or has_table_privilege('authenticated','public.registry_track_work_links','INSERT')
     or has_table_privilege('service_role','public.registry_track_work_links','INSERT')
     or has_table_privilege('anon','public.registry_track_contributions','INSERT')
     or has_table_privilege('authenticated','public.registry_track_contributions','INSERT')
     or has_table_privilege('service_role','public.registry_track_contributions','INSERT')
     or has_table_privilege('anon','public.registry_work_contributions','INSERT')
     or has_table_privilege('authenticated','public.registry_work_contributions','INSERT')
     or has_table_privilege('service_role','public.registry_work_contributions','INSERT')
  then
    raise exception 'Canonical Work/Contribution tables leaked direct insert authority';
  end if;

  select pg_get_functiondef(
    'platform_private.execute_registry_provenance_admin_v1(uuid)'::regprocedure
  )
  into v_definition;

  if position('insert into public.registry_rights_claims' in lower(v_definition))<>0
     or position('update public.registry_rights_claims' in lower(v_definition))<>0
     or position('delete from public.registry_rights_claims' in lower(v_definition))<>0
  then
    raise exception 'Contribution executor contains prohibited Rights Claim mutation';
  end if;

  select pg_get_functiondef(
    'public.admin_admit_registry_track_contribution_v1(uuid)'::regprocedure
  )
  into v_definition;

  if position('self_claim' in v_definition)=0
     or position('confirmed' in v_definition)=0
     or position('WK_PROVENANCE_ATTESTATION_REVIEW_REQUIRED' in v_definition)=0
  then
    raise exception 'Self-claim promotion guard is missing from Recording contribution admission';
  end if;

  raise notice 'MUSIC_PROVENANCE_SLICE1_AUTHORITY_V1_PASS';
end
$verify$;
