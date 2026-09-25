-- Permanent verifier: Public Music Identity Slice 3 Release Single alignment.
--
-- Structural authority only. This verifier remains valid before and after the
-- reviewed Production data apply; exact 80/35 programme freezes belong to the
-- protected control plane rather than permanent schema truth.

do $verify$
declare
  v_analysis text;
  v_candidate text;
  v_review text;
  v_executor text;
  v_verifier text;
  v_open text;
  v_close text;
  v_verified integer;
  v_events integer;
begin
  if not exists (
    select 1
    from public.capability_definitions capability
    where capability.capability_key=
      'align_registry_release_single_identity'
      and capability.domain='registry'
  ) then
    raise exception
      'Release Single identity capability definition is missing';
  end if;

  if not exists (
    select 1
    from platform_private.registry_operation_types operation
    where operation.operation_key=
      'registry.release_single_identity.align'
      and operation.operation_version=1
      and operation.capability_key=
        'align_registry_release_single_identity'
      and operation.risk_class='medium'
      and operation.allowed_subject_types=
        array['release']::text[]
      and operation.requires_existing_target
      and operation.max_targets=1
      and operation.max_rows_ceiling=2
      and operation.max_grant_ttl_seconds=300
      and not operation.requires_human_approval
      and operation.requires_verifier
  ) then
    raise exception
      'Release Single identity typed operation shape drifted';
  end if;

  if to_regprocedure(
       'mizizi_private.release_single_identity_state_fingerprint_v1(uuid)'
     ) is null
     or to_regprocedure(
       'mizizi_private.release_single_identity_analysis_v1(uuid)'
     ) is null
     or to_regprocedure(
       'mizizi_private.release_single_identity_candidate_v1(uuid)'
     ) is null
     or to_regprocedure(
       'mizizi_private.release_single_identity_plan_v1(uuid)'
     ) is null
     or to_regprocedure(
       'mizizi_private.release_single_identity_review_candidate_v1(uuid)'
     ) is null
     or to_regprocedure(
       'mizizi_private.queue_release_single_identity_review_v1(uuid)'
     ) is null
     or to_regprocedure(
       'mizizi_private.issue_release_single_identity_execution_grant_v1(uuid,text)'
     ) is null
     or to_regprocedure(
       'mizizi_private.execute_release_single_identity_alignment_v1(uuid)'
     ) is null
     or to_regprocedure(
       'mizizi_private.verify_release_single_identity_alignment_v1(uuid)'
     ) is null
     or to_regprocedure(
       'mizizi_private.close_release_single_identity_authority_window_v1(uuid,text)'
     ) is null
     or to_regprocedure(
       'public.admin_open_mizizi_release_single_identity_authority_v1(timestamptz,text)'
     ) is null
     or to_regprocedure(
       'public.admin_revoke_mizizi_release_single_identity_authority_v1(uuid,text)'
     ) is null
  then
    raise exception
      'Release Single identity function surface is incomplete';
  end if;

  if has_table_privilege(
       'mizizi_executor',
       'public.registry_releases',
       'UPDATE'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.registry_tracks',
       'UPDATE'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.registry_release_tracks',
       'UPDATE'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.registry_release_artists',
       'UPDATE'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.registry_track_artists',
       'UPDATE'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.community_threads',
       'UPDATE'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.registry_review_items',
       'INSERT'
     )
  then
    raise exception
      'direct mizizi_executor mutation authority exists';
  end if;

  if not has_function_privilege(
       'mizizi_executor',
       'mizizi_private.release_single_identity_analysis_v1(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'mizizi_executor',
       'mizizi_private.queue_release_single_identity_review_v1(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'mizizi_executor',
       'mizizi_private.issue_release_single_identity_execution_grant_v1(uuid,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'mizizi_executor',
       'mizizi_private.execute_release_single_identity_alignment_v1(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'mizizi_executor',
       'mizizi_private.verify_release_single_identity_alignment_v1(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'mizizi_executor',
       'mizizi_private.close_release_single_identity_authority_window_v1(uuid,text)',
       'EXECUTE'
     )
  then
    raise exception
      'mizizi_executor Release Single identity function authority is incomplete';
  end if;

  if has_function_privilege(
       'authenticated',
       'mizizi_private.execute_release_single_identity_alignment_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'mizizi_private.execute_release_single_identity_alignment_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'mizizi_private.queue_release_single_identity_review_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'mizizi_private.queue_release_single_identity_review_v1(uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'private Release Single identity mutation authority leaked to product roles';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.admin_open_mizizi_release_single_identity_authority_v1(timestamptz,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_revoke_mizizi_release_single_identity_authority_v1(uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.admin_open_mizizi_release_single_identity_authority_v1(timestamptz,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_open_mizizi_release_single_identity_authority_v1(timestamptz,text)',
       'EXECUTE'
     )
  then
    raise exception
      'Release Single identity human authority RPC grants drifted';
  end if;

  select pg_get_functiondef(
    'mizizi_private.release_single_identity_analysis_v1(uuid)'::regprocedure
  )
  into v_analysis;

  select pg_get_functiondef(
    'mizizi_private.release_single_identity_candidate_v1(uuid)'::regprocedure
  )
  into v_candidate;

  select pg_get_functiondef(
    'mizizi_private.queue_release_single_identity_review_v1(uuid)'::regprocedure
  )
  into v_review;

  select pg_get_functiondef(
    'mizizi_private.execute_release_single_identity_alignment_v1(uuid)'::regprocedure
  )
  into v_executor;

  select pg_get_functiondef(
    'mizizi_private.verify_release_single_identity_alignment_v1(uuid)'::regprocedure
  )
  into v_verifier;

  select pg_get_functiondef(
    'public.admin_open_mizizi_release_single_identity_authority_v1(timestamptz,text)'::regprocedure
  )
  into v_open;

  select pg_get_functiondef(
    'mizizi_private.close_release_single_identity_authority_window_v1(uuid,text)'::regprocedure
  )
  into v_close;

  if position('track_identity_review' in v_analysis)=0
     or position('duplicate_single_identity' in v_analysis)=0
     or position('primary_artist_mismatch' in v_analysis)=0
     or position('community_thread_collision' in v_analysis)=0
     or position('unsupported_release_pointer' in v_analysis)=0
     or position('release_thread_state_mismatch' in v_analysis)=0
     or position('track_thread_state_mismatch' in v_analysis)=0
     or position('count(distinct credit.artist_slug)' in lower(v_analysis))=0
     or position('disposition' in lower(v_candidate))=0
  then
    raise exception
      'Release Single identity eligibility/review gates drifted';
  end if;

  if position('release_single_identity_conflict' in v_review)=0
     or position('''1.4.0''' in v_review)=0
     or position('programmecandidate' in lower(v_review))=0
  then
    raise exception
      'Release Single identity review broker drifted';
  end if;

  if position(
       'mizizi:release-slug:'
       in v_executor
     )=0
     or position(
       'update public.registry_releases'
       in lower(v_executor)
     )=0
     or position(
       'update public.community_threads'
       in lower(v_executor)
     )=0
     or position(
       'align_release_single_identity'
       in v_executor
     )=0
     or position(
       'redirects_created'
       in v_executor
     )=0
     or position(
       'programme_candidate'
       in v_executor
     )=0
     or position(
       'update public.registry_tracks'
       in lower(v_executor)
     )>0
     or position(
       'update public.registry_release_tracks'
       in lower(v_executor)
     )>0
     or position(
       'insert into public.wk_slug_redirects'
       in lower(v_executor)
     )>0
     or position(
       'update public.wk_slug_redirects'
       in lower(v_executor)
     )>0
     or position(
       'date_fallback'
       in lower(v_executor)
     )>0
  then
    raise exception
      'Release Single identity executor contains forbidden redirect/date-suffix logic or lost required bounded writes';
  end if;

  if position(
       'release_thread_remained_after_track_convergence'
       in v_verifier
     )=0
     or position(
       'canonical_write_event_causality_mismatch'
       in v_verifier
     )=0
     or position(
       'redirects_created'
       in v_verifier
     )=0
  then
    raise exception
      'Release Single identity independent verifier drifted';
  end if;

  if position('current_user_has_capability' in v_open)=0
     or position('manage_registry' in v_open)=0
     or position('max_rows'', 2' in replace(v_open,E'\n',' '))=0
     or position('enabled = true' in lower(replace(v_open,E'\n',' ')))=0
  then
    raise exception
      'Release Single identity human-open authority drifted';
  end if;

  if position('assert_executor_v1' in v_close)=0
     or position('status = ''expired''' in lower(replace(v_close,E'\n',' ')))=0
     or position('enabled = false' in lower(replace(v_close,E'\n',' ')))=0
     or position('enabled = true' in lower(replace(v_close,E'\n',' ')))>0
  then
    raise exception
      'Release Single identity authority closer is not reduction-only';
  end if;

  select count(*)::integer
  into v_verified
  from platform_private.registry_mutation_operations operation
  where operation.actor_key='mizizi'
    and operation.operation_key=
      'registry.release_single_identity.align'
    and operation.operation_version=1
    and operation.status='succeeded'
    and operation.verifier_status='passed';

  select count(*)::integer
  into v_events
  from public.registry_canonical_write_events event
  where event.actor='system:mizizi'
    and event.action='align_release_single_identity'
    and event.status='succeeded';

  if v_verified<>v_events then
    raise exception
      'Release Single identity canonical-event / verified-operation parity drifted: % / %',
      v_events,
      v_verified;
  end if;

  if exists (
    select 1
    from public.registry_canonical_write_events event
    where event.actor='system:mizizi'
      and event.action='align_release_single_identity'
      and (
        event.registry_entity_type<>'release'
        or event.source_table<>
           'mizizi_private.release_single_identity_plan_v1'
        or event.field_name<>'slug'
        or event.target_path<>
           'public.registry_releases.slug'
        or event.after_value->>'canonical_track_path' is null
        or coalesce(
             (event.after_value->>'redirects_created')::integer,
             -1
           )<>0
        or jsonb_typeof(
             event.after_value->'programme_candidate'
           )<>'object'
      )
  ) then
    raise exception
      'Release Single identity canonical event evidence drifted';
  end if;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants standing
    where standing.actor_key='mizizi'
      and standing.capability_key=
        'align_registry_release_single_identity'
      and standing.status='active'
      and (
        standing.valid_from>now()
        or standing.expires_at<=now()
        or standing.revoked_at is not null
      )
  ) then
    raise exception
      'Release Single identity standing authority has an invalid active shape';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings binding
    where binding.actor_key='mizizi'
      and binding.executor_kind='database_role'
      and binding.executor_key='mizizi_executor'
      and binding.status='active'
  )
  or exists (
    select 1
    from platform_private.system_actor_executor_bindings binding
    where binding.actor_key='mizizi'
      and binding.executor_kind='database_role'
      and binding.executor_key='postgres'
      and binding.status='active'
  ) then
    raise exception
      'Release Single identity Stage C executor binding drifted';
  end if;
end
$verify$;

select 'PUBLIC_MUSIC_IDENTITY_SLICE3_RELEASE_SINGLE_ALIGNMENT_PASS' as result;
