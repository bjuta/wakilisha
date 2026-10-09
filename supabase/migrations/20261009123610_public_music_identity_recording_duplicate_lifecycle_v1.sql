-- #1094: lifecycle finalizer convergence, non-mutating canonical Registry.
-- Exact CLI-minted filename: 20261009123610.
-- This migration is deliberately limited to linked distinct-recording
-- finalization. Synthetic duplicate admission remains gated until reviewed
-- authority is implemented and proved; do not deploy this alone as #1094 exit.
begin;
set local statement_timeout='180s';
set local lock_timeout='5s';
select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('public-music-identity-recording-duplicate-lifecycle-v1',0)
);
do $preflight$
declare v_old text;
begin
  if to_regprocedure('public.admin_finalize_public_music_identity_track_review_v1(uuid,uuid,uuid,uuid,text)') is null
     or to_regprocedure('platform_private.public_music_identity_track_review_terminal_evidence_v1(uuid,uuid,uuid,uuid)') is null
  then raise exception 'WK_1094_FINALIZER_DEPENDENCY_MISSING'; end if;
  select pg_get_functiondef('public.admin_finalize_public_music_identity_track_review_v1(uuid,uuid,uuid,uuid,text)'::regprocedure) into v_old;
  if position('public_music_identity_track_review_terminal_evidence_v1' in v_old)=0
    or position('reviewResolved' in v_old)=0
  then raise exception 'WK_1094_FINALIZER_AUTHORITY_DRIFT'; end if;
end $preflight$;
create or replace function
public.admin_finalize_public_music_identity_track_review_v1(
  p_review_id uuid,
  p_decision_id uuid,
  p_verified_operation_id uuid default null,
  p_archive_event_id uuid default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,auth
as $finalize$
declare
  v_user_id uuid:=auth.uid();
  v_review public.registry_review_items%rowtype;
  v_decision public.registry_canonicalization_decisions%rowtype;
  v_evidence jsonb;
  v_source_track_id uuid;
  v_canonical_track_id uuid;
  v_expected_slug text;
  v_primary_artist_slug text;
  v_canonical_url text;
  v_source_thread_count integer;
  v_canonical_thread_count integer;
  v_linked_review_id uuid;
  v_linked_review public.registry_review_items%rowtype;
  v_now timestamptz:=now();
  v_note text:=nullif(btrim(coalesce(p_note,'')),'');
begin
  if v_user_id is null
     or not (
       coalesce(public.current_user_has_capability('manage_registry'),false)
       or coalesce(public.current_user_is_administrator(),false)
     )
  then
    raise exception using errcode='42501',
      message='manage_registry is required.';
  end if;

  if octet_length(coalesce(v_note,''))>4000 then
    raise exception using errcode='22023',
      message='Finalization note exceeds 4000 bytes.';
  end if;

  select review.*
  into v_review
  from public.registry_review_items review
  where review.id=p_review_id
    and review.status='open'
  for update;

  if not found then
    raise exception using errcode='42501',
      message='Review is not open for finalization.';
  end if;

  select decision.*
  into v_decision
  from public.registry_canonicalization_decisions decision
  where decision.id=p_decision_id
    and decision.review_item_id=v_review.id
    and decision.status='recorded'
  for update;

  if not found then
    raise exception using errcode='23514',
      message='Exact recorded human decision is missing.';
  end if;

  v_evidence:=
    platform_private.public_music_identity_track_review_terminal_evidence_v1(
      p_review_id,
      p_decision_id,
      p_verified_operation_id,
      p_archive_event_id
    );

  v_source_track_id:=(v_evidence->>'sourceTrackId')::uuid;
  v_expected_slug:=nullif(v_evidence->>'expectedSlug','');
  v_primary_artist_slug:=nullif(v_evidence->>'primaryArtistSlug','');

  if v_evidence->>'decisionType'='public_music_identity_true_duplicate' then
    v_canonical_track_id:=(v_evidence->>'canonicalTrackId')::uuid;
    v_canonical_url:=
      'https://wakilisha.africa/tracks/'||
      v_primary_artist_slug||'/'||v_expected_slug;

    select count(*)::integer
    into v_source_thread_count
    from public.community_threads thread
    where thread.entity_type='track'
      and thread.entity_id=v_source_track_id::text;

    select count(*)::integer
    into v_canonical_thread_count
    from public.community_threads thread
    where thread.entity_type='track'
      and thread.entity_id=v_canonical_track_id::text;

    if v_source_thread_count>1
       or (v_source_thread_count>0 and v_canonical_thread_count>0)
    then
      raise exception using errcode='23514',
        message='Duplicate finalization has ambiguous Community thread ownership.';
    end if;

    if exists (
      select 1 from public.community_saves save
      where save.entity_type='track'
        and save.entity_id=v_source_track_id::text
    )
    or exists (
      select 1 from public.community_activity activity
      where activity.entity_type='track'
        and activity.entity_id=v_source_track_id::text
    )
    or exists (
      select 1 from public.community_contributions contribution
      where contribution.entity_type='track'
        and contribution.entity_id=v_source_track_id::text
    )
    or exists (
      select 1 from public.audience_interests interest
      where interest.entity_type='track'
        and interest.entity_id=v_source_track_id
    )
    or exists (
      select 1
      from public.signal_os_content_opportunities opportunity
      join public.registry_tracks source_track
        on source_track.id=v_source_track_id
      where opportunity.entity_type='track'
        and opportunity.entity_slug=source_track.slug
    )
    then
      raise exception using errcode='23514',
        message='Duplicate finalization found a current-pointer surface outside the reviewed Community-thread boundary.';
    end if;

    if v_source_thread_count=1 then
      update public.community_threads
      set
        entity_id=v_canonical_track_id::text,
        entity_slug=v_expected_slug,
        entity_url=v_canonical_url,
        updated_at=v_now
      where entity_type='track'
        and entity_id=v_source_track_id::text;
    end if;
  end if;

  update public.registry_review_items
  set
    status='resolved',
    resolution_payload=jsonb_build_object(
      'decisionId',p_decision_id,
      'verifiedOperationId',p_verified_operation_id,
      'archiveEventId',p_archive_event_id,
      'finalizerAuthority',
        'admin_finalize_public_music_identity_track_review_v1',
      'finalizedByUserId',v_user_id,
      'finalizerNote',v_note,
      'sourceTrackId',v_source_track_id,
      'canonicalTrackId',
        nullif(v_evidence->>'canonicalTrackId',''),
      'decisionType',v_evidence->>'decisionType',
      'resolvedAt',v_now
    ),
    resolved_at=v_now,
    updated_at=v_now
  where id=v_review.id
    and status='open';

  if not found then
    raise exception using errcode='40001',
      message='Review finalization lost its one-row compare-and-set boundary.';
  end if;

  -- A distinct-recording decision preserves the canonical Track unchanged.
  -- The same verified terminal-evidence contract must close its exact linked
  -- recording-identity review; otherwise #1094 can never reach actual-zero.
  if v_evidence->>'decisionType'='public_music_identity_distinct_recording' then
    begin
      v_linked_review_id:=
        nullif(v_decision.after_payload->>'evidenceRecordingIdentityReviewId','')::uuid;
    exception when others then
      raise exception using errcode='23514',
        message='WK_1094_LINKED_RECORDING_REVIEW_ID_INVALID';
    end;

    if v_linked_review_id is null or v_linked_review_id=v_review.id then
      raise exception using errcode='23514',
        message='WK_1094_LINKED_RECORDING_REVIEW_ID_MISSING';
    end if;

    select recording.*
    into v_linked_review
    from public.registry_review_items recording
    where recording.id=v_linked_review_id
      and recording.status='open'
      and recording.review_type='mizizi_data_hygiene'
      and recording.entity_type='track'
      and recording.entity_id=v_source_track_id
      and recording.source_id=v_source_track_id::text
      and recording.source_payload->>'ruleId'='track_recording_identity_conflict'
      and recording.source_payload->>'ruleVersion'='1.3.0'
    for update;

    if not found then
      raise exception using errcode='23514',
        message='WK_1094_LINKED_RECORDING_REVIEW_DRIFT';
    end if;

    update public.registry_review_items
    set status='resolved',
        resolution_payload=jsonb_build_object(
          'decisionId',p_decision_id,
          'sourceSlugReviewId',v_review.id,
          'finalizerAuthority','admin_finalize_public_music_identity_track_review_v1',
          'decisionType','public_music_identity_distinct_recording',
          'sourceTrackId',v_source_track_id,
          'finalizedByUserId',v_user_id,
          'finalizerNote',v_note,
          'resolvedAt',v_now
        ),
        resolved_at=v_now,
        updated_at=v_now
    where id=v_linked_review_id
      and status='open';

    if not found then
      raise exception using errcode='40001',
        message='WK_1094_LINKED_RECORDING_REVIEW_CAS_FAILED';
    end if;
  end if;

  update public.registry_canonicalization_decisions
  set
    metadata=
      coalesce(metadata,'{}'::jsonb)||
      jsonb_build_object(
        'finalizedAt',v_now,
        'finalizedByUserId',v_user_id,
        'reviewResolved',true,
        'finalizerAuthority',
          'admin_finalize_public_music_identity_track_review_v1',
        'verifiedOperationId',p_verified_operation_id,
        'archiveEventId',p_archive_event_id
      )
  where id=v_decision.id
    and status='recorded';

  return jsonb_build_object(
    'reviewId',v_review.id,
    'decisionId',v_decision.id,
    'decisionType',v_evidence->>'decisionType',
    'sourceTrackId',v_source_track_id,
    'canonicalTrackId',nullif(v_evidence->>'canonicalTrackId',''),
    'verifiedOperationId',p_verified_operation_id,
    'archiveEventId',p_archive_event_id,
    'reviewStatus','resolved',
    'linkedRecordingReviewId',v_linked_review_id,
    'resolvedAt',v_now
  );
end
$finalize$;
do $postflight$
declare v_new text;
begin
  select pg_get_functiondef('public.admin_finalize_public_music_identity_track_review_v1(uuid,uuid,uuid,uuid,text)'::regprocedure) into v_new;
  if position('WK_1094_LINKED_RECORDING_REVIEW_CAS_FAILED' in v_new)=0
     or position('evidenceRecordingIdentityReviewId' in v_new)=0
     or position('track_recording_identity_conflict' in v_new)=0
  then raise exception 'WK_1094_LINKED_FINALIZATION_BODY_DRIFT'; end if;
  if has_function_privilege('anon','public.admin_finalize_public_music_identity_track_review_v1(uuid,uuid,uuid,uuid,text)','EXECUTE')
  then raise exception 'WK_1094_FINALIZER_ANON_GRANT_DRIFT'; end if;
end $postflight$;
commit;
