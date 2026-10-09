do $verify$
declare
  v_evidence text;
  v_guard text;
  v_finalizer text;
  v_policy text;
begin
  if to_regprocedure(
       'platform_private.public_music_identity_track_review_terminal_evidence_v1(uuid,uuid,uuid,uuid)'
     ) is null
     or to_regprocedure(
       'public.admin_finalize_public_music_identity_track_review_v1(uuid,uuid,uuid,uuid,text)'
     ) is null
     or to_regprocedure(
       'platform_private.guard_public_music_identity_track_review_resolution_v1()'
     ) is null
  then
    raise exception
      'Public Music Identity Track review finalization authority is missing';
  end if;

  select pg_get_functiondef(
    'platform_private.public_music_identity_track_review_terminal_evidence_v1(uuid,uuid,uuid,uuid)'::regprocedure
  )
  into v_evidence;

  select pg_get_functiondef(
    'platform_private.guard_public_music_identity_track_review_resolution_v1()'::regprocedure
  )
  into v_guard;

  select pg_get_functiondef(
    'public.admin_finalize_public_music_identity_track_review_v1(uuid,uuid,uuid,uuid,text)'::regprocedure
  )
  into v_finalizer;

  select policy.with_check
  into v_policy
  from pg_policies policy
  where policy.schemaname='public'
    and policy.tablename='registry_review_items'
    and policy.policyname='registry_review_items_admin_update'
    and policy.cmd='UPDATE';

  if v_policy is null
     or v_policy not like '%status = ''resolved''%'
     or v_policy not like '%track_slug_identity_noise%'
     or v_policy not like '%track_slug_credit_evidence_gap%'
  then
    raise exception
      'Authenticated Admin review policy does not block direct #1094 resolution';
  end if;

  if v_evidence not like '%registry.track_slug.canonicalize%'
     or v_evidence not like '%registry.track.duplicate_repair%'
     or v_evidence not like '%public.admin_archive_registry_music_entity_v1%'
     or v_evidence not like '%operation.completed_at>=v_decision.created_at%'
     or v_evidence not like '%verifier_status=''passed''%'
     or v_evidence not like '%public_music_identity_credit_correction_required%'
     or v_evidence not like '%public_music_identity_needs_more_research%'
     or v_evidence not like '%public_music_identity_distinct_recording%'
     or v_evidence not like '%Distinct-recording finalization preserves canonical identity and accepts no mutation receipt.%'
     or v_evidence not like '%registry_subject_state_fingerprint%'
     or v_evidence not like '%evidencePrimaryArtistSlug%'
     or v_evidence not like '%evidenceFeaturedArtistSlugs%'
     or v_evidence not like '%evidenceRecordingPeerIds%'
     or v_evidence not like '%evidenceRecordingIdentityReviewId%'
     or v_evidence not like '%track_recording_identity_conflict%'
     or v_evidence not like '%wk_chart_entries_v2%'
     or v_evidence not like '%chart_entry.track_slug is distinct from v_expected_slug%'
  then
    raise exception
      'Terminal evidence binding drifted';
  end if;

  if v_evidence !~
       $gate$if[[:space:]]+v_decision_type[[:space:]]+in[[:space:]]*\([[:space:]]*'public_music_identity_safe_slug_repair'[[:space:]]*,[[:space:]]*'public_music_identity_true_duplicate'[[:space:]]*\)[[:space:]]*then[[:space:]]*if[[:space:]]+p_verified_operation_id[[:space:]]+is[[:space:]]+null[[:space:]]+or[[:space:]]+p_archive_event_id[[:space:]]+is[[:space:]]+not[[:space:]]+null$gate$
  then
    raise exception
      'Distinct-recording finalization regained a fake canonical operation requirement';
  end if;

  if v_guard not like
       '%admin_finalize_public_music_identity_track_review_v1%'
     or v_guard not like '%stale Community thread pointers%'
     or v_guard not like
       '%unhandled current-pointer surface on the source Track%'
  then
    raise exception
      'Review resolution guard drifted from finalizer/current-pointer authority';
  end if;

  if v_finalizer not like
       '%update public.community_threads%'
     or v_finalizer not like
       '%update public.registry_review_items%'
     or v_finalizer not like
       '%update public.registry_canonicalization_decisions%'
     or v_finalizer not like
       '%Duplicate finalization has ambiguous Community thread ownership%'
  then
    raise exception
      'Finalizer write boundary is incomplete';
  end if;

  if v_finalizer ~*
       'update[[:space:]]+public\.registry_tracks'
     or v_finalizer ~*
       'update[[:space:]]+public\.registry_track_artists'
     or v_finalizer ~*
       'update[[:space:]]+public\.registry_release_tracks'
     or v_finalizer ~*
       'update[[:space:]]+public\.wk_chart_entries_v2'
     or v_finalizer like '%wk_slug_redirects%'
  then
    raise exception
      'Finalizer gained canonical Registry/Chart/redirect mutation authority';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.admin_finalize_public_music_identity_track_review_v1(uuid,uuid,uuid,uuid,text)',
       'EXECUTE'
     )
  then
    raise exception
      'Authenticated finalizer execution privilege is missing';
  end if;

  raise notice
    'PUBLIC_MUSIC_IDENTITY_TRACK_REVIEW_FINALIZATION_V1_PASS';
end
$verify$;

-- #1094: the existing MIZIZI broker, not a new public RPC, owns admission.
do $wk1094$
declare v_sql text;
begin
  select pg_get_functiondef(
    'mizizi_private.queue_registry_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)'::regprocedure
  ) into v_sql;
  if position('WK_1094_HISTORICAL_SCOPED_REVIEW_ALREADY_OWNS_TRACK' in v_sql)=0
    or position('WK_1094_SEMANTIC_CANDIDATE_DRIFT' in v_sql)=0
    or position('WK_1094_PROJECTED_TRACK_REQUIRES_HIGHER_EVIDENCE_LANE' in v_sql)=0
    or v_sql ~* '(update|delete[[:space:]]+from)[[:space:]]+public[.](registry_tracks|registry_track_artists|wk_chart_entries_v2|community_threads)'
  then
    raise exception 'WK_1094_REVIEW_BROKER_CONTRACT_DRIFT';
  end if;
end
$wk1094$;
