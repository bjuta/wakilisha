-- Permanent verifier for #1094 reviewed Artist + Track-credit correction authority.

do $verify$
declare
  v_artist_kernel text;
  v_artist_rpc text;
  v_credit_rpc text;
  v_executor text;
  v_credit_verifier text;
  v_signature text;
  v_count integer;
begin
  if to_regprocedure(
       'public.admin_materialize_public_music_identity_reviewed_artist_v1(uuid,uuid,text,text,text)'
     ) is null
     or to_regprocedure(
       'public.admin_reconcile_public_music_identity_track_credit_v1(uuid,uuid,uuid,uuid,text,integer,text)'
     ) is null
     or to_regprocedure(
       'platform_private.execute_registry_public_music_identity_credit_reconcile_v2(uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.verify_registry_public_music_identity_credit_reconcile_v2(uuid)'
     ) is null
  then
    raise exception
      'PUBLIC_MUSIC_IDENTITY_REVIEWED_CREDIT_FAIL: required functions are missing';
  end if;

  select count(*)::integer
  into v_count
  from platform_private.registry_operation_types operation_type
  where operation_type.operation_key=
        'registry.track_artist_credit.reviewed_reconcile'
    and operation_type.operation_version=2
    and operation_type.capability_key=
        'reconcile_registry_track_reviewed_artist_credit'
    and operation_type.risk_class='high'
    and operation_type.allowed_subject_types=array['track']::text[]
    and operation_type.requires_existing_target is true
    and operation_type.max_targets=1
    and operation_type.max_rows_ceiling=1
    and operation_type.max_grant_ttl_seconds=300
    and operation_type.requires_human_approval is true
    and operation_type.requires_verifier is true
    and operation_type.enabled is true;

  if v_count<>1 then
    raise exception
      'PUBLIC_MUSIC_IDENTITY_REVIEWED_CREDIT_FAIL: V2 operation contract drifted';
  end if;

  if not exists (
       select 1
       from platform_private.system_actors actor
       join platform_private.system_actor_executor_bindings binding
         on binding.actor_key=actor.actor_key
       where actor.actor_key='registry_public_music_identity_credit_admin'
         and actor.status='active'
         and actor.capability_profile->>'authority_mode'='human_exact_grant'
         and actor.capability_profile->>'required_user_capability'='manage_registry'
         and actor.capability_profile->>'review_source'='public_music_identity_review'
         and binding.executor_kind='database_role'
         and binding.executor_key='authenticator'
         and binding.status='active'
     )
  then
    raise exception
      'PUBLIC_MUSIC_IDENTITY_REVIEWED_CREDIT_FAIL: broker binding drifted';
  end if;

  select pg_get_functiondef(
    'platform_private.execute_registry_reviewed_artist_identity_materialization_v1(text,text,text,text,text,text,jsonb,text)'::regprocedure
  )
  into v_artist_kernel;

  if position('public_music_identity_review' in v_artist_kernel)=0
     or position('public-music-identity-review:%' in v_artist_kernel)=0
     or position('manage_registry' in v_artist_kernel)=0
  then
    raise exception
      'PUBLIC_MUSIC_IDENTITY_REVIEWED_CREDIT_FAIL: reviewed Artist kernel lacks exact source/capability binding';
  end if;

  select pg_get_functiondef(
    'public.admin_materialize_public_music_identity_reviewed_artist_v1(uuid,uuid,text,text,text)'::regprocedure
  )
  into v_artist_rpc;

  if position('public_music_identity_track_actual_zero_v1' in v_artist_rpc)=0
     or position('public_music_identity_review' in v_artist_rpc)=0
     or position('registry.artist.identity.create' in v_artist_kernel)=0
     or position('set status=''active''' in lower(v_artist_rpc))=0
     or position('activate_public_music_identity_reviewed_artist' in v_artist_rpc)=0
     or position('current_user_has_capability(''manage_registry'')' in v_artist_rpc)=0
  then
    raise exception
      'PUBLIC_MUSIC_IDENTITY_REVIEWED_CREDIT_FAIL: reviewed Artist RPC drifted';
  end if;

  select pg_get_functiondef(
    'public.admin_reconcile_public_music_identity_track_credit_v1(uuid,uuid,uuid,uuid,text,integer,text)'::regprocedure
  )
  into v_credit_rpc;

  if position('operation_version'',2' in v_credit_rpc)=0
     or position('idempotent_replay'',true' in v_credit_rpc)=0
     or position('registry.track_artist_credit.reviewed_reconcile' in v_credit_rpc)=0
     or position('public-music-identity-reviewed-credit-reconcile-v1' in v_credit_rpc)=0
  then
    raise exception
      'PUBLIC_MUSIC_IDENTITY_REVIEWED_CREDIT_FAIL: reviewed credit Admin RPC drifted';
  end if;

  select pg_get_functiondef(
    'platform_private.execute_registry_public_music_identity_credit_reconcile_v2(uuid)'::regprocedure
  )
  into v_executor;

  if position('update public.registry_track_artists' in lower(v_executor))=0
     or position('insert into public.registry_track_artists' in lower(v_executor))=0
     or position('delete from public.registry_track_artists' in lower(v_executor))<>0
     or position('public_music_identity_review' in v_executor)=0
     or position('multiple active primary Track credits' in v_executor)=0
     or position('occupied active credit order' in v_executor)=0
     or position('reconcile_public_music_identity_reviewed_credit' in v_executor)=0
  then
    raise exception
      'PUBLIC_MUSIC_IDENTITY_REVIEWED_CREDIT_FAIL: V2 executor semantics drifted';
  end if;

  select pg_get_functiondef(
    'platform_private.verify_registry_public_music_identity_credit_reconcile_v2(uuid)'::regprocedure
  )
  into v_credit_verifier;

  if position('canonical_reviewed_credit_semantics_mismatch' in v_credit_verifier)=0
     or position('track_primary_credit_cardinality_mismatch' in v_credit_verifier)=0
     or position('canonical_write_event_causality_mismatch' in v_credit_verifier)=0
     or position('review_or_decision_authority_no_longer_current' in v_credit_verifier)=0
     or position('public_music_identity_review' in v_credit_verifier)=0
  then
    raise exception
      'PUBLIC_MUSIC_IDENTITY_REVIEWED_CREDIT_FAIL: V2 verifier semantics drifted';
  end if;

  foreach v_signature in array array[
    'public.admin_materialize_public_music_identity_reviewed_artist_v1(uuid,uuid,text,text,text)',
    'public.admin_reconcile_public_music_identity_track_credit_v1(uuid,uuid,uuid,uuid,text,integer,text)'
  ]
  loop
    if has_function_privilege('public',v_signature,'EXECUTE')
       or has_function_privilege('anon',v_signature,'EXECUTE')
       or has_function_privilege('service_role',v_signature,'EXECUTE')
       or not has_function_privilege('authenticated',v_signature,'EXECUTE')
    then
      raise exception
        'PUBLIC_MUSIC_IDENTITY_REVIEWED_CREDIT_FAIL: Admin RPC privilege drifted: %',
        v_signature;
    end if;
  end loop;

  foreach v_signature in array array[
    'platform_private.registry_public_music_identity_current_admin_v1()',
    'platform_private.registry_public_music_identity_credit_relation_uuid_v1(uuid,uuid,uuid,uuid)',
    'platform_private.registry_public_music_identity_credit_candidate_state_v1(uuid,uuid,uuid,text)',
    'platform_private.registry_public_music_identity_credit_review_snapshot_v1(uuid,uuid,uuid,uuid,text,integer,text)',
    'platform_private.record_registry_public_music_identity_credit_evidence_v1(uuid,uuid,uuid,jsonb,text)',
    'platform_private.issue_registry_public_music_identity_credit_grant_v1(uuid,uuid,jsonb,text)',
    'platform_private.execute_registry_public_music_identity_credit_reconcile_v2(uuid)',
    'platform_private.verify_registry_public_music_identity_credit_reconcile_v2(uuid)'
  ]
  loop
    if has_function_privilege('public',v_signature,'EXECUTE')
       or has_function_privilege('anon',v_signature,'EXECUTE')
       or has_function_privilege('authenticated',v_signature,'EXECUTE')
       or has_function_privilege('service_role',v_signature,'EXECUTE')
    then
      raise exception
        'PUBLIC_MUSIC_IDENTITY_REVIEWED_CREDIT_FAIL: private function privilege leaked: %',
        v_signature;
    end if;
  end loop;

  if has_table_privilege(
       'authenticated','public.registry_track_artists','INSERT'
     )
     or has_table_privilege(
       'authenticated','public.registry_track_artists','UPDATE'
     )
     or has_table_privilege(
       'authenticated','public.registry_track_artists','DELETE'
     )
  then
    raise exception
      'PUBLIC_MUSIC_IDENTITY_REVIEWED_CREDIT_FAIL: direct browser Track-credit mutation authority leaked';
  end if;

  if exists (
       select 1
       from platform_private.system_actor_capability_grants grant_row
       where grant_row.actor_key=
             'registry_public_music_identity_credit_admin'
     )
     or exists (
       select 1
       from platform_private.registry_execution_grants grant_row
       where grant_row.actor_key=
             'registry_public_music_identity_credit_admin'
     )
  then
    raise exception
      'PUBLIC_MUSIC_IDENTITY_REVIEWED_CREDIT_FAIL: correction authority is not zero at rest';
  end if;

  raise notice
    'PUBLIC_MUSIC_IDENTITY_REVIEWED_ARTIST_TRACK_CREDIT_V1_PASS';
end
$verify$;
