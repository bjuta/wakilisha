do $verify$
declare
  v_context_definition text;
  v_record_definition text;
  v_resolution_guard_definition text;
begin
  if to_regprocedure(
       'public.admin_get_public_music_identity_track_review_context_v1(uuid)'
     ) is null
     or to_regprocedure(
       'public.admin_record_public_music_identity_track_review_decision_v1(uuid,text,jsonb,text,text)'
     ) is null
  then
    raise exception
      'Public Music Identity Track review decision authority is missing';
  end if;

  select pg_get_functiondef(
    'public.admin_get_public_music_identity_track_review_context_v1(uuid)'::regprocedure
  )
  into v_context_definition;

  select pg_get_functiondef(
    'public.admin_record_public_music_identity_track_review_decision_v1(uuid,text,jsonb,text,text)'::regprocedure
  )
  into v_record_definition;

  if to_regprocedure(
       'platform_private.guard_public_music_identity_track_review_resolution_v1()'
     ) is null
     or not exists (
       select 1
       from pg_trigger trigger_row
       where trigger_row.tgrelid='public.registry_review_items'::regclass
         and trigger_row.tgname=
           'registry_review_items_public_music_identity_track_resolution_guard_v1'
         and not trigger_row.tgisinternal
     )
  then
    raise exception
      'Public Music Identity review-resolution guard is missing';
  end if;

  select pg_get_functiondef(
    'platform_private.guard_public_music_identity_track_review_resolution_v1()'::regprocedure
  )
  into v_resolution_guard_definition;

  if v_context_definition not like
       '%registry_subject_state_fingerprint%'
     or v_record_definition not like
       '%registry_subject_state_fingerprint%'
     or v_record_definition not like
       '%Track state changed after review context was loaded%'
  then
    raise exception
      'Track-state compare-and-set boundary is missing';
  end if;

  if v_record_definition not like
       '%track_slug_identity_noise%'
     or v_record_definition not like
       '%track_slug_credit_evidence_gap%'
     or v_record_definition not like
       '%track_recording_identity_conflict%'
  then
    raise exception
      'Public Music Identity review rule boundary drifted';
  end if;

  if v_context_definition not like
       '%recordingIdentityPeers%'
     or v_record_definition not like
       '%{evidence,peers}%'
     or v_record_definition not like
       '%canonicalTrackId must be one of the reviewed recording-identity peers.%'
  then
    raise exception
      'Duplicate decision is not bound to the reviewed recording-identity peer set';
  end if;

  if v_record_definition not like
       '%public_music_identity_safe_slug_repair%'
     or v_record_definition not like
       '%public_music_identity_distinct_recording%'
     or v_record_definition not like
       '%public_music_identity_true_duplicate%'
     or v_record_definition not like
       '%public_music_identity_retire_unresolvable%'
     or v_record_definition not like
       '%public_music_identity_credit_correction_required%'
     or v_record_definition not like
       '%public_music_identity_needs_more_research%'
  then
    raise exception
      'Human decision vocabulary drifted';
  end if;

  if v_resolution_guard_definition not like
       '%session_user<>''mizizi_executor''%'
     or v_resolution_guard_definition not like
       '%verifiedOperationId%'
     or v_resolution_guard_definition not like
       '%decisionId%'
     or v_resolution_guard_definition not like
       '%operation.verifier_status=''passed''%'
     or v_resolution_guard_definition not like
       '%execution_grant.plan_payload->>''reviewId''%'
     or v_resolution_guard_definition not like
       '%execution_grant.plan_payload->>''decisionId''%'
  then
    raise exception
      'Review resolution is not bound to verified MIZIZI execution and the exact human decision';
  end if;

  if v_record_definition ~*
       'update[[:space:]]+public\.registry_review_items'
     or v_record_definition ~*
       'registry_review_items[^;]*status[[:space:]]*=[[:space:]]*''resolved'''
  then
    raise exception
      'Human decision capture must not resolve the review';
  end if;

  if v_record_definition ~*
       '(insert[[:space:]]+into|update|delete[[:space:]]+from)[^;]*public\.registry_tracks'
     or v_record_definition like '%wk_slug_redirects%'
  then
    raise exception
      'Human decision capture gained canonical Track or redirect mutation authority';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.admin_get_public_music_identity_track_review_context_v1(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_record_public_music_identity_track_review_decision_v1(uuid,text,jsonb,text,text)',
       'EXECUTE'
     )
  then
    raise exception
      'Authenticated Admin RPC execution privilege is missing';
  end if;

  raise notice
    'PUBLIC_MUSIC_IDENTITY_TRACK_REVIEW_DECISION_AUTHORITY_V1_PASS';
end
$verify$;
