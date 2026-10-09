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
  if to_regprocedure('mizizi_private.queue_public_music_identity_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)') is null
     or to_regprocedure('public.admin_finalize_public_music_identity_track_review_v1(uuid,uuid,uuid,uuid,text)') is null
     or to_regprocedure('platform_private.public_music_identity_track_review_terminal_evidence_v1(uuid,uuid,uuid,uuid)') is null
  then raise exception 'WK_1094_FINALIZER_DEPENDENCY_MISSING'; end if;
  select pg_get_functiondef('public.admin_finalize_public_music_identity_track_review_v1(uuid,uuid,uuid,uuid,text)'::regprocedure) into v_old;
  if position('public_music_identity_track_review_terminal_evidence_v1' in v_old)=0
    or position('reviewResolved' in v_old)=0
  then raise exception 'WK_1094_FINALIZER_AUTHORITY_DRIFT'; end if;
end $preflight$;
create or replace function mizizi_private.queue_public_music_identity_review_v1(
  p_entity_type text,
  p_entity_id text,
  p_fingerprint text,
  p_rule_id text,
  p_rule_version text,
  p_field_name text,
  p_current_value text,
  p_proposed_value text,
  p_confidence numeric,
  p_severity text,
  p_reason text,
  p_evidence jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, mizizi_private
as $$
declare
  v_review_id uuid;
  v_track public.registry_tracks%rowtype;
  v_expected_fingerprint text;
  v_title text;
  v_synthetic_peer_count integer:=0;
begin
  perform mizizi_private.assert_executor_v1();

  if p_entity_type <> 'track'
     or p_entity_id !~
       '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
     or p_fingerprint !~ '^[0-9a-f]{64}$'
     or p_rule_version <> '1.3.0'
     or p_confidence <> 1
     or p_severity <> 'high'
     or nullif(btrim(p_reason),'') is null
     or octet_length(p_reason) > 2000
     or jsonb_typeof(coalesce(p_evidence,'{}'::jsonb)) <> 'object'
     or octet_length(coalesce(p_evidence,'{}'::jsonb)::text) > 16384
     or not (
       (
         p_rule_id='track_slug_credit_evidence_gap'
         and p_field_name='slug'
         and p_proposed_value ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
         and octet_length(p_proposed_value) <= 240
         and p_current_value <> p_proposed_value
       )
       or
       (
         p_rule_id='track_recording_identity_conflict'
         and p_field_name='recording_identity'
         and p_current_value=p_entity_id
         and p_proposed_value='human_review_required'
       )
     )
  then
    raise exception using
      errcode='22023',
      message='Invalid bounded Public Music Identity review payload.';
  end if;

  select track.*
  into v_track
  from public.registry_tracks track
  where track.id=p_entity_id::uuid
    and (
      track.status='active'
      or (
        p_rule_id='track_recording_identity_conflict'
        and track.status='needs_review'
      )
    );

  if not found then
    raise exception using
      errcode='40001',
      message='Public Music Identity review target is not eligible for this bounded review lane.';
  end if;

  if p_rule_id='track_slug_credit_evidence_gap' then
    if v_track.slug is distinct from p_current_value
       or v_track.slug !~* '(^|-)(feat|featuring|ft)(-|$)'
    then
      raise exception using
        errcode='40001',
        message='Feature-credit evidence-gap target changed since analysis.';
    end if;

    v_title :=
      'MIZIZI needs collaborator-credit evidence review';
  else
    if not exists (
      select 1
      from public.registry_track_artists target_credit
      join public.registry_track_artists peer_credit
        on peer_credit.artist_id=target_credit.artist_id
       and peer_credit.status='active'
       and peer_credit.is_primary is true
       and peer_credit.track_id<>v_track.id
      join public.registry_tracks peer
        on peer.id=peer_credit.track_id
       and peer.status='active'
      where target_credit.track_id=v_track.id
        and target_credit.status='active'
        and target_credit.is_primary is true
        and target_credit.artist_id is not null
        and mizizi_private.slugify_identity_v1(
              regexp_replace(
                regexp_replace(
                  regexp_replace(
                    regexp_replace(
                      mizizi_private.normalize_identity_text_v1(peer.title),
                      '\\([^)]*\\y(feat(uring)?|ft)\\.?[[:space:]]+[^)]*\\)',
                      ' ',
                      'gi'
                    ),
                    '\\[[^]]*\\y(feat(uring)?|ft)\\.?[[:space:]]+[^]]*\\]',
                    ' ',
                    'gi'
                  ),
                  '\\{[^}]*\\y(feat(uring)?|ft)\\.?[[:space:]]+[^}]*\\}',
                  ' ',
                  'gi'
                ),
                '[[:space:]]+(-|:)?[[:space:]]*\\y(feat(uring)?|ft)\\.?[[:space:]]+.*$',
                '',
                'i'
              )
            ) =
            mizizi_private.slugify_identity_v1(
              regexp_replace(
                regexp_replace(
                  regexp_replace(
                    regexp_replace(
                      mizizi_private.normalize_identity_text_v1(v_track.title),
                      '\\([^)]*\\y(feat(uring)?|ft)\\.?[[:space:]]+[^)]*\\)',
                      ' ',
                      'gi'
                    ),
                    '\\[[^]]*\\y(feat(uring)?|ft)\\.?[[:space:]]+[^]]*\\]',
                    ' ',
                    'gi'
                  ),
                  '\\{[^}]*\\y(feat(uring)?|ft)\\.?[[:space:]]+[^}]*\\}',
                  ' ',
                  'gi'
                ),
                '[[:space:]]+(-|:)?[[:space:]]*\\y(feat(uring)?|ft)\\.?[[:space:]]+.*$',
                '',
                'i'
              )
            )
    ) then
      raise exception using
        errcode='40001',
        message='Recording-identity conflict is no longer live.';
    end if;

    if v_track.status='needs_review' then
      select count(*)::integer
      into v_synthetic_peer_count
      from public.registry_tracks peer
      where peer.status='active'
        and peer.id<>v_track.id
        and regexp_replace(
              peer.slug,
              '-[0-9a-f]{6}

  v_expected_fingerprint :=
    mizizi_private.finding_fingerprint_v1(
      p_rule_id,
      p_rule_version,
      p_entity_type,
      p_entity_id,
      p_field_name,
      p_current_value,
      p_proposed_value
    );

  if v_expected_fingerprint <> p_fingerprint then
    raise exception using
      errcode='42501',
      message='Public Music Identity review fingerprint is not deterministic.';
  end if;

  select review.id
  into v_review_id
  from public.registry_review_items review
  where review.review_type='mizizi_data_hygiene'
    and review.status <> 'resolved'
    and review.entity_type='track'
    and review.source_id=p_entity_id
    and review.source_payload->>'ruleId'=p_rule_id
  order by review.created_at,review.id
  limit 1
  for update;

  if found then
    return v_review_id;
  end if;

  insert into public.registry_review_items (
    review_key,
    entity_type,
    entity_id,
    review_type,
    priority,
    status,
    title,
    summary,
    source_table,
    source_id,
    source_payload,
    candidate_payload,
    created_at,
    updated_at
  )
  values (
    'mizizi:' || p_fingerprint,
    'track',
    p_entity_id::uuid,
    'mizizi_data_hygiene',
    'high',
    'open',
    v_title,
    btrim(p_reason),
    'registry_tracks',
    p_entity_id,
    jsonb_build_object(
      'agent','mizizi',
      'ruleId',p_rule_id,
      'ruleVersion',p_rule_version,
      'fieldName',p_field_name,
      'currentValue',p_current_value,
      'confidence',p_confidence,
      'evidence',coalesce(p_evidence,'{}'::jsonb)
    ),
    jsonb_build_object(
      'proposedValue',p_proposed_value,
      'disposition','review'
    ),
    now(),
    now()
  )
  on conflict (review_key)
  do nothing
  returning id into v_review_id;

  if v_review_id is null then
    select review.id
    into v_review_id
    from public.registry_review_items review
    where review.review_key='mizizi:' || p_fingerprint;
  end if;

  return v_review_id;
end
$$;

,
              ''
            )=v_track.slug
        and peer.slug ~ ('^'||v_track.slug||'-[0-9a-f]{6}

  v_expected_fingerprint :=
    mizizi_private.finding_fingerprint_v1(
      p_rule_id,
      p_rule_version,
      p_entity_type,
      p_entity_id,
      p_field_name,
      p_current_value,
      p_proposed_value
    );

  if v_expected_fingerprint <> p_fingerprint then
    raise exception using
      errcode='42501',
      message='Public Music Identity review fingerprint is not deterministic.';
  end if;

  select review.id
  into v_review_id
  from public.registry_review_items review
  where review.review_type='mizizi_data_hygiene'
    and review.status <> 'resolved'
    and review.entity_type='track'
    and review.source_id=p_entity_id
    and review.source_payload->>'ruleId'=p_rule_id
  order by review.created_at,review.id
  limit 1
  for update;

  if found then
    return v_review_id;
  end if;

  insert into public.registry_review_items (
    review_key,
    entity_type,
    entity_id,
    review_type,
    priority,
    status,
    title,
    summary,
    source_table,
    source_id,
    source_payload,
    candidate_payload,
    created_at,
    updated_at
  )
  values (
    'mizizi:' || p_fingerprint,
    'track',
    p_entity_id::uuid,
    'mizizi_data_hygiene',
    'high',
    'open',
    v_title,
    btrim(p_reason),
    'registry_tracks',
    p_entity_id,
    jsonb_build_object(
      'agent','mizizi',
      'ruleId',p_rule_id,
      'ruleVersion',p_rule_version,
      'fieldName',p_field_name,
      'currentValue',p_current_value,
      'confidence',p_confidence,
      'evidence',coalesce(p_evidence,'{}'::jsonb)
    ),
    jsonb_build_object(
      'proposedValue',p_proposed_value,
      'disposition','review'
    ),
    now(),
    now()
  )
  on conflict (review_key)
  do nothing
  returning id into v_review_id;

  if v_review_id is null then
    select review.id
    into v_review_id
    from public.registry_review_items review
    where review.review_key='mizizi:' || p_fingerprint;
  end if;

  return v_review_id;
end
$$;

)
        and mizizi_private.slugify_identity_v1(
              mizizi_private.normalize_identity_text_v1(peer.title)
            )=
            mizizi_private.slugify_identity_v1(
              mizizi_private.normalize_identity_text_v1(v_track.title)
            )
        and exists (
          select 1
          from public.registry_track_artists source_credit
          join public.registry_track_artists peer_credit
            on peer_credit.artist_id=source_credit.artist_id
           and peer_credit.track_id=peer.id
           and coalesce(peer_credit.status,'active')<>'archived'
           and peer_credit.is_primary is true
          where source_credit.track_id=v_track.id
            and coalesce(source_credit.status,'active')<>'archived'
            and source_credit.is_primary is true
            and source_credit.artist_id is not null
        )
        and exists (
          select 1
          from jsonb_array_elements(
            coalesce(p_evidence->'peers','[]'::jsonb)
          ) evidence_peer
          where evidence_peer->>'id'=peer.id::text
        );

      if v_synthetic_peer_count<>1
         or v_track.slug is distinct from
            mizizi_private.slugify_identity_v1(
              mizizi_private.normalize_identity_text_v1(v_track.title)
            )
      then
        raise exception using errcode='23514',
          message='WK_1094_SYNTHETIC_COLLISION_REVIEW_EVIDENCE_DRIFT';
      end if;
    end if;

    v_title :=
      'MIZIZI needs recording identity review';
  end if;

  v_expected_fingerprint :=
    mizizi_private.finding_fingerprint_v1(
      p_rule_id,
      p_rule_version,
      p_entity_type,
      p_entity_id,
      p_field_name,
      p_current_value,
      p_proposed_value
    );

  if v_expected_fingerprint <> p_fingerprint then
    raise exception using
      errcode='42501',
      message='Public Music Identity review fingerprint is not deterministic.';
  end if;

  select review.id
  into v_review_id
  from public.registry_review_items review
  where review.review_type='mizizi_data_hygiene'
    and review.status <> 'resolved'
    and review.entity_type='track'
    and review.source_id=p_entity_id
    and review.source_payload->>'ruleId'=p_rule_id
  order by review.created_at,review.id
  limit 1
  for update;

  if found then
    return v_review_id;
  end if;

  insert into public.registry_review_items (
    review_key,
    entity_type,
    entity_id,
    review_type,
    priority,
    status,
    title,
    summary,
    source_table,
    source_id,
    source_payload,
    candidate_payload,
    created_at,
    updated_at
  )
  values (
    'mizizi:' || p_fingerprint,
    'track',
    p_entity_id::uuid,
    'mizizi_data_hygiene',
    'high',
    'open',
    v_title,
    btrim(p_reason),
    'registry_tracks',
    p_entity_id,
    jsonb_build_object(
      'agent','mizizi',
      'ruleId',p_rule_id,
      'ruleVersion',p_rule_version,
      'fieldName',p_field_name,
      'currentValue',p_current_value,
      'confidence',p_confidence,
      'evidence',coalesce(p_evidence,'{}'::jsonb)
    ),
    jsonb_build_object(
      'proposedValue',p_proposed_value,
      'disposition','review'
    ),
    now(),
    now()
  )
  on conflict (review_key)
  do nothing
  returning id into v_review_id;

  if v_review_id is null then
    select review.id
    into v_review_id
    from public.registry_review_items review
    where review.review_key='mizizi:' || p_fingerprint;
  end if;

  return v_review_id;
end
$$;


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
