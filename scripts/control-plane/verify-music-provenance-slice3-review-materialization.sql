\set ON_ERROR_STOP on

do $verify$
declare
  v_definition text;
begin
  if to_regprocedure(
       'mizizi_private.music_provenance_scan_v1(timestamptz,timestamptz,text,integer,integer,integer)'
     ) is null
  then
    raise exception
      'Music Provenance Slice 3 scan broker is missing.';
  end if;

  select lower(
    pg_get_functiondef(
      'mizizi_private.music_provenance_scan_v1(timestamptz,timestamptz,text,integer,integer,integer)'::regprocedure
    )
  )
  into v_definition;

  if position('perform mizizi_private.assert_executor_v1()' in v_definition)=0
     or position('registry_contribution_attestations' in v_definition)=0
     or position('registry_contribution_attestation_state_events' in v_definition)=0
     or position('registry_evidence_assertions' in v_definition)=0
     or position('registry_track_contributions' in v_definition)=0
     or position('registry_work_contributions' in v_definition)=0
  then
    raise exception
      'Music Provenance Slice 3 scan broker semantics drifted.';
  end if;

  if not has_function_privilege(
       'mizizi_executor',
       'mizizi_private.music_provenance_scan_v1(timestamptz,timestamptz,text,integer,integer,integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'mizizi_private.music_provenance_scan_v1(timestamptz,timestamptz,text,integer,integer,integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'mizizi_private.music_provenance_scan_v1(timestamptz,timestamptz,text,integer,integer,integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'mizizi_private.music_provenance_scan_v1(timestamptz,timestamptz,text,integer,integer,integer)',
       'EXECUTE'
     )
  then
    raise exception
      'Music Provenance scan broker EXECUTE authority drifted.';
  end if;

  if has_schema_privilege(
       'mizizi_executor',
       'platform_private',
       'USAGE'
     )
     or has_table_privilege(
       'mizizi_executor',
       'platform_private.registry_contribution_attestations',
       'SELECT'
     )
     or has_table_privilege(
       'mizizi_executor',
       'platform_private.registry_contribution_attestation_state_events',
       'SELECT'
     )
     or has_table_privilege(
       'mizizi_executor',
       'platform_private.registry_evidence_assertions',
       'SELECT'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.registry_track_contributions',
       'SELECT'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.registry_work_contributions',
       'SELECT'
     )
  then
    raise exception
      'mizizi_executor gained forbidden direct provenance read authority.';
  end if;

  if to_regprocedure(
       'mizizi_private.queue_music_provenance_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)'
     ) is null
  then
    raise exception
      'Music Provenance Slice 3 review broker is missing.';
  end if;

  select lower(
    pg_get_functiondef(
      'mizizi_private.queue_music_provenance_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)'::regprocedure
    )
  )
  into v_definition;

  if position('perform mizizi_private.assert_executor_v1()' in v_definition)=0
     or position('provenance_attestation_evidence_binding_drift' in v_definition)=0
     or position('provenance_attestation_multiple_canonical_rows' in v_definition)=0
     or position('provenance_admissible_attestation_pending_review' in v_definition)=0
     or position('provenance_attestation_noncurrent_canonical_history' in v_definition)=0
     or position('insert into public.registry_review_items' in v_definition)=0
     or position('registry_contribution_attestation_current_state_v1' in v_definition)=0
  then
    raise exception
      'Music Provenance Slice 3 review broker semantics drifted.';
  end if;

  if position('insert into public.registry_track_contributions' in v_definition)<>0
     or position('update public.registry_track_contributions' in v_definition)<>0
     or position('delete from public.registry_track_contributions' in v_definition)<>0
     or position('insert into public.registry_work_contributions' in v_definition)<>0
     or position('update public.registry_work_contributions' in v_definition)<>0
     or position('delete from public.registry_work_contributions' in v_definition)<>0
     or position('insert into public.registry_canonical_write_events' in v_definition)<>0
  then
    raise exception
      'Music Provenance review materialization contains a forbidden canonical write path.';
  end if;

  if not has_function_privilege(
       'mizizi_executor',
       'mizizi_private.queue_music_provenance_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'mizizi_private.queue_music_provenance_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'mizizi_private.queue_music_provenance_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'mizizi_private.queue_music_provenance_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)',
       'EXECUTE'
     )
  then
    raise exception
      'Music Provenance review broker EXECUTE authority drifted.';
  end if;

  if to_regprocedure(
       'platform_private.music_provenance_contribution_review_context_v1(uuid)'
     ) is null
     or to_regprocedure(
       'public.admin_get_music_provenance_contribution_review_context_v1(uuid)'
     ) is null
     or to_regprocedure(
       'public.admin_record_music_provenance_contribution_review_decision_v1(uuid,text,jsonb,text,text)'
     ) is null
  then
    raise exception
      'Typed Music Provenance Admin contribution review authority is missing.';
  end if;

  select lower(
    pg_get_functiondef(
      'public.admin_record_music_provenance_contribution_review_decision_v1(uuid,text,jsonb,text,text)'::regprocedure
    )
  )
  into v_definition;

  if position('admin_admit_registry_track_contribution_v1' in v_definition)=0
     or position('admin_admit_registry_work_contribution_v1' in v_definition)=0
     or position('music_provenance_contribution_review_v1' in v_definition)=0
     or position('rightsclaiminferred' in v_definition)=0
     or position('provenance_admissible_attestation_pending_review' in v_definition)=0
     or position('provenance_attestation_noncurrent_canonical_history' in v_definition)=0
     or position('provenance_attestation_evidence_binding_drift' in v_definition)=0
     or position('provenance_attestation_multiple_canonical_rows' in v_definition)=0
  then
    raise exception
      'Typed Music Provenance Admin decision semantics drifted.';
  end if;

  if position('insert into public.registry_track_contributions' in v_definition)<>0
     or position('update public.registry_track_contributions' in v_definition)<>0
     or position('delete from public.registry_track_contributions' in v_definition)<>0
     or position('insert into public.registry_work_contributions' in v_definition)<>0
     or position('update public.registry_work_contributions' in v_definition)<>0
     or position('delete from public.registry_work_contributions' in v_definition)<>0
     or position('insert into platform_private.registry_execution_grants' in v_definition)<>0
  then
    raise exception
      'Typed Music Provenance Admin decision bypasses accepted human admission authority.';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.admin_get_music_provenance_contribution_review_context_v1(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_record_music_provenance_contribution_review_decision_v1(uuid,text,jsonb,text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.admin_record_music_provenance_contribution_review_decision_v1(uuid,text,jsonb,text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_record_music_provenance_contribution_review_decision_v1(uuid,text,jsonb,text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'mizizi_executor',
       'public.admin_record_music_provenance_contribution_review_decision_v1(uuid,text,jsonb,text,text)',
       'EXECUTE'
     )
  then
    raise exception
      'Typed Music Provenance Admin RPC EXECUTE authority drifted.';
  end if;

  if has_table_privilege(
       'mizizi_executor',
       'public.registry_review_items',
       'INSERT'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.registry_track_contributions',
       'INSERT'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.registry_work_contributions',
       'INSERT'
     )
  then
    raise exception
      'mizizi_executor gained forbidden direct table authority.';
  end if;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants
    where actor_key='mizizi'
      and status='active'
      and valid_from<=now()
      and expires_at>now()
  ) then
    raise exception
      'Standing MIZIZI authority is not zero.';
  end if;

  if exists (
    select 1
    from platform_private.registry_execution_grants
    where status='active'
      and expires_at>now()
  ) then
    raise exception
      'Active exact Registry authority is not zero.';
  end if;

  raise notice
    'MUSIC_PROVENANCE_SLICE3_REVIEW_MATERIALIZATION_PASS';
end
$verify$;
