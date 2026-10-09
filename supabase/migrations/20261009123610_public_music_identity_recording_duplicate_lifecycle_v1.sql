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
     or to_regprocedure('public.admin_get_public_music_identity_track_review_context_v1(uuid)') is null
     or to_regprocedure('public.admin_record_public_music_identity_track_review_decision_v1(uuid,text,jsonb,text,text)') is null
     or to_regprocedure('public.admin_preview_registry_track_duplicate_repair(uuid,uuid[])') is null
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
as $function$
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
                      $regex$\([^)]*\y(feat(uring)?|ft)\.?[[:space:]]+[^)]*\)$regex$,
                      ' ',
                      'gi'
                    ),
                    $regex$\[[^]]*\y(feat(uring)?|ft)\.?[[:space:]]+[^]]*\]$regex$,
                    ' ',
                    'gi'
                  ),
                  $regex$\{[^}]*\y(feat(uring)?|ft)\.?[[:space:]]+[^}]*\}$regex$,
                  ' ',
                  'gi'
                ),
                $regex$[[:space:]]+(-|:)?[[:space:]]*\y(feat(uring)?|ft)\.?[[:space:]]+.*$$regex$,
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
                      $regex$\([^)]*\y(feat(uring)?|ft)\.?[[:space:]]+[^)]*\)$regex$,
                      ' ',
                      'gi'
                    ),
                    $regex$\[[^]]*\y(feat(uring)?|ft)\.?[[:space:]]+[^]]*\]$regex$,
                    ' ',
                    'gi'
                  ),
                  $regex$\{[^}]*\y(feat(uring)?|ft)\.?[[:space:]]+[^}]*\}$regex$,
                  ' ',
                  'gi'
                ),
                $regex$[[:space:]]+(-|:)?[[:space:]]*\y(feat(uring)?|ft)\.?[[:space:]]+.*$$regex$,
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
        and left(peer.slug,length(v_track.slug)+1)=v_track.slug||'-'
        and substring(peer.slug from length(v_track.slug)+2)
              ~ '^[0-9a-f]{6}$'
        and regexp_replace(
              peer.slug,
              '-[0-9a-f]{6}$',
              ''
            )=v_track.slug
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
$function$;


create or replace function
public.admin_get_public_music_identity_track_review_context_v1(
  p_review_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,platform_private,auth
as $$
declare
  v_user_id uuid:=auth.uid();
  v_review public.registry_review_items%rowtype;
  v_track public.registry_tracks%rowtype;
  v_track_id uuid;
  v_rule_id text;
  v_rule_version text;
  v_state_fingerprint text;
begin
  if v_user_id is null
     or not (
       coalesce(
         public.current_user_has_capability('manage_registry'),
         false
       )
       or coalesce(
         public.current_user_is_administrator(),
         false
       )
     )
  then
    raise exception using errcode='42501',
      message='manage_registry is required.';
  end if;

  if p_review_id is null then
    raise exception using errcode='22023',
      message='Review ID is required.';
  end if;

  select review.*
  into v_review
  from public.registry_review_items review
  where review.id=p_review_id
    and review.review_type='mizizi_data_hygiene'
    and review.entity_type='track'
    and review.status='open';

  if not found then
    raise exception using errcode='42501',
      message='Review is not an open Track MIZIZI review.';
  end if;

  v_rule_id:=v_review.source_payload->>'ruleId';
  v_rule_version:=v_review.source_payload->>'ruleVersion';

  if not (
       (
         v_rule_id='track_slug_identity_noise'
         and v_rule_version='1.1.0'
       )
       or
       (
         v_rule_id='track_slug_credit_evidence_gap'
         and v_rule_version='1.3.0'
       )
       or
       (
         v_rule_id='track_recording_identity_conflict'
         and v_rule_version='1.3.0'
       )
     )
  then
    raise exception using errcode='42501',
      message='Review is outside the #1094 public-music-identity Track decision boundary.';
  end if;

  begin
    v_track_id:=nullif(btrim(v_review.source_id),'')::uuid;
  exception
    when others then
      raise exception using errcode='23514',
        message='Review source_id is not a Track UUID.';
  end;

  select track.*
  into v_track
  from public.registry_tracks track
  where track.id=v_track_id
    and (
      track.status='active'
      or (
        v_rule_id='track_recording_identity_conflict'
        and v_rule_version='1.3.0'
        and track.status='needs_review'
      )
    );

  if not found then
    raise exception using errcode='23514',
      message='Review Track is not eligible for this bounded Public Music Identity context.';
  end if;

  v_state_fingerprint:=
    platform_private.registry_subject_state_fingerprint(
      'track',
      v_track.id
    );

  return jsonb_build_object(
    'reviewId',v_review.id,
    'trackId',v_track.id,
    'ruleId',v_rule_id,
    'ruleVersion',v_rule_version,
    'reviewStatus',v_review.status,
    'reviewUpdatedAt',v_review.updated_at,
    'trackStateFingerprint',v_state_fingerprint,
    'currentSlug',v_track.slug,
    'title',v_track.title,
    'isrc',v_track.isrc,
    'proposedSlug',v_review.candidate_payload->>'proposedValue',
    'reviewEvidence',
      coalesce(v_review.source_payload->'evidence','{}'::jsonb),
    'activeCredits',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'artistId',credit.artist_id,
            'artistSlug',credit.artist_slug,
            'artistName',credit.artist_name_text,
            'role',credit.role,
            'isPrimary',credit.is_primary,
            'isFeatured',credit.is_featured,
            'source',credit.source,
            'confidence',credit.confidence
          )
          order by
            credit.credit_order nulls last,
            credit.artist_slug,
            credit.id
        )
        from public.registry_track_artists credit
        where credit.track_id=v_track.id
          and coalesce(credit.status,'active')<>'archived'
      ),'[]'::jsonb),
    'openRecordingIdentityReviewId',
      (
        select identity_review.id
        from public.registry_review_items identity_review
        where identity_review.review_type='mizizi_data_hygiene'
          and identity_review.entity_type='track'
          and identity_review.status='open'
          and identity_review.source_id=v_track.id::text
          and identity_review.source_payload->>'ruleId'=
            'track_recording_identity_conflict'
          and identity_review.source_payload->>'ruleVersion'='1.3.0'
        order by identity_review.created_at,identity_review.id
        limit 1
      ),
    'recordingIdentityPeers',
      coalesce((
        select identity_review.source_payload#>'{evidence,peers}'
        from public.registry_review_items identity_review
        where identity_review.review_type='mizizi_data_hygiene'
          and identity_review.entity_type='track'
          and identity_review.status='open'
          and identity_review.source_id=v_track.id::text
          and identity_review.source_payload->>'ruleId'=
            'track_recording_identity_conflict'
          and identity_review.source_payload->>'ruleVersion'='1.3.0'
        order by identity_review.created_at,identity_review.id
        limit 1
      ),'[]'::jsonb),
    'existingDecision',
      (
        select jsonb_build_object(
          'id',decision.id,
          'decisionType',decision.decision_type,
          'afterPayload',decision.after_payload,
          'notes',decision.decision_notes,
          'status',decision.status,
          'createdAt',decision.created_at
        )
        from public.registry_canonicalization_decisions decision
        where decision.review_item_id=v_review.id
          and decision.metadata->>'programmeKey'=
            'public_music_identity_track_actual_zero_v1'
          and decision.status='recorded'
        order by decision.created_at desc,decision.id desc
        limit 1
      )
  );
end
$$;

create or replace function
public.admin_record_public_music_identity_track_review_decision_v1(
  p_review_id uuid,
  p_decision_type text,
  p_decision_payload jsonb,
  p_expected_track_state_fingerprint text,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,auth
as $$
declare
  v_user_id uuid:=auth.uid();
  v_review public.registry_review_items%rowtype;
  v_track public.registry_tracks%rowtype;
  v_track_id uuid;
  v_rule_id text;
  v_rule_version text;
  v_state_fingerprint text;
  v_decision_type text:=nullif(btrim(coalesce(p_decision_type,'')),'');
  v_payload jsonb:=coalesce(p_decision_payload,'{}'::jsonb);
  v_notes text:=nullif(btrim(coalesce(p_notes,'')),'');
  v_existing public.registry_canonicalization_decisions%rowtype;
  v_decision_id uuid;
  v_related_identity_review_id uuid;
  v_related_identity_review public.registry_review_items%rowtype;
  v_target_track_id uuid;
begin
  if v_user_id is null
     or not (
       coalesce(
         public.current_user_has_capability('manage_registry'),
         false
       )
       or coalesce(
         public.current_user_is_administrator(),
         false
       )
     )
  then
    raise exception using errcode='42501',
      message='manage_registry is required.';
  end if;

  if p_review_id is null
     or v_decision_type is null
     or v_notes is null
     or nullif(
          btrim(coalesce(p_expected_track_state_fingerprint,'')),
          ''
        ) is null
  then
    raise exception using errcode='22023',
      message='Review ID, decision type, expected Track state fingerprint, and notes are required.';
  end if;

  if jsonb_typeof(v_payload)<>'object' then
    raise exception using errcode='22023',
      message='Decision payload must be a JSON object.';
  end if;

  if v_decision_type not in (
       'public_music_identity_safe_slug_repair',
       'public_music_identity_distinct_recording',
       'public_music_identity_true_duplicate',
       'public_music_identity_retire_unresolvable',
       'public_music_identity_credit_correction_required',
       'public_music_identity_needs_more_research'
     )
  then
    raise exception using errcode='22023',
      message='Unsupported Public Music Identity decision type.';
  end if;

  select review.*
  into v_review
  from public.registry_review_items review
  where review.id=p_review_id
    and review.review_type='mizizi_data_hygiene'
    and review.entity_type='track'
    and review.status='open'
  for update;

  if not found then
    raise exception using errcode='42501',
      message='Review is not an open Track MIZIZI review.';
  end if;

  v_rule_id:=v_review.source_payload->>'ruleId';
  v_rule_version:=v_review.source_payload->>'ruleVersion';

  if not (
       (
         v_rule_id='track_slug_identity_noise'
         and v_rule_version='1.1.0'
       )
       or
       (
         v_rule_id='track_slug_credit_evidence_gap'
         and v_rule_version='1.3.0'
       )
       or
       (
         v_rule_id='track_recording_identity_conflict'
         and v_rule_version='1.3.0'
         and v_decision_type='public_music_identity_true_duplicate'
       )
     )
  then
    raise exception using errcode='42501',
      message='Review is outside the #1094 public-music-identity Track decision boundary.';
  end if;

  begin
    v_track_id:=nullif(btrim(v_review.source_id),'')::uuid;
  exception
    when others then
      raise exception using errcode='23514',
        message='Review source_id is not a Track UUID.';
  end;

  select track.*
  into v_track
  from public.registry_tracks track
  where track.id=v_track_id
    and (
      track.status='active'
      or (
        v_rule_id='track_recording_identity_conflict'
        and v_rule_version='1.3.0'
        and v_decision_type='public_music_identity_true_duplicate'
        and track.status='needs_review'
      )
    )
  for update;

  if not found then
    raise exception using errcode='23514',
      message='Review Track is not eligible for this bounded Public Music Identity decision.';
  end if;

  v_state_fingerprint:=
    platform_private.registry_subject_state_fingerprint(
      'track',
      v_track.id
    );

  if v_state_fingerprint is distinct from
     p_expected_track_state_fingerprint
  then
    raise exception using errcode='40001',
      message='Track state changed after review context was loaded. Reload before deciding.';
  end if;

  if v_rule_id='track_recording_identity_conflict' then
    if v_review.source_payload->>'currentValue' is distinct from
       v_track.id::text
    then
      raise exception using errcode='40001',
        message='Recording-identity review target changed after review creation.';
    end if;
  elsif v_track.slug is distinct from
        v_review.source_payload->>'currentValue'
  then
    raise exception using errcode='40001',
      message='Track slug changed after the review was created. Re-audit before deciding.';
  end if;

  select identity_review.*
  into v_related_identity_review
  from public.registry_review_items identity_review
  where identity_review.review_type='mizizi_data_hygiene'
    and identity_review.entity_type='track'
    and identity_review.status='open'
    and identity_review.source_id=v_track.id::text
    and identity_review.source_payload->>'ruleId'=
      'track_recording_identity_conflict'
    and identity_review.source_payload->>'ruleVersion'='1.3.0'
  order by identity_review.created_at,identity_review.id
  limit 1;

  v_related_identity_review_id:=v_related_identity_review.id;

  if v_decision_type='public_music_identity_safe_slug_repair' then
    if nullif(btrim(coalesce(v_payload->>'proposedSlug','')),'') is null
       or v_payload->>'proposedSlug' is distinct from
          v_review.candidate_payload->>'proposedValue'
    then
      raise exception using errcode='23514',
        message='Safe slug repair must bind the exact reviewed proposed slug.';
    end if;
  elsif v_decision_type='public_music_identity_distinct_recording' then
    if v_related_identity_review_id is null then
      raise exception using errcode='23514',
        message='Distinct-recording decision requires an open recording-identity review.';
    end if;

    if nullif(
         btrim(coalesce(v_payload->>'semanticDistinction','')),
         ''
       ) is null
       or nullif(
            btrim(coalesce(v_payload->>'canonicalSlug','')),
            ''
          ) is null
    then
      raise exception using errcode='23514',
        message='Distinct-recording decision requires semanticDistinction and canonicalSlug.';
    end if;
  elsif v_decision_type='public_music_identity_true_duplicate' then
    if v_rule_id='track_recording_identity_conflict'
       and v_related_identity_review_id is distinct from v_review.id
    then
      raise exception using errcode='23514',
        message='WK_1094_SYNTHETIC_DUPLICATE_DECISION_REVIEW_BINDING_DRIFT';
    end if;

    if v_related_identity_review_id is null then
      raise exception using errcode='23514',
        message='Duplicate decision requires an open recording-identity review.';
    end if;

    begin
      v_target_track_id:=
        nullif(btrim(coalesce(v_payload->>'canonicalTrackId','')),'')::uuid;
    exception
      when others then
        raise exception using errcode='23514',
          message='Duplicate decision requires a canonicalTrackId UUID.';
    end;

    if v_target_track_id is null
       or v_target_track_id=v_track.id
       or not exists (
         select 1
         from public.registry_tracks target
         where target.id=v_target_track_id
           and target.status='active'
       )
    then
      raise exception using errcode='23514',
        message='Duplicate decision requires a different active canonical Track.';
    end if;

    if not exists (
         select 1
         from jsonb_array_elements(
           coalesce(
             v_related_identity_review.source_payload#>'{evidence,peers}',
             '[]'::jsonb
           )
         ) peer
         where peer->>'id'=v_target_track_id::text
       )
    then
      raise exception using errcode='23514',
        message='canonicalTrackId must be one of the reviewed recording-identity peers.';
    end if;
  elsif v_decision_type='public_music_identity_credit_correction_required' then
    if v_rule_id<>'track_slug_credit_evidence_gap' then
      raise exception using errcode='23514',
        message='Credit-correction decision is only valid for credit-evidence-gap reviews.';
    end if;

    if nullif(
         btrim(coalesce(v_payload->>'creditEvidence','')),
         ''
       ) is null
    then
      raise exception using errcode='23514',
        message='Credit-correction decision requires creditEvidence.';
    end if;
  end if;

  select decision.*
  into v_existing
  from public.registry_canonicalization_decisions decision
  where decision.review_item_id=v_review.id
    and decision.metadata->>'programmeKey'=
      'public_music_identity_track_actual_zero_v1'
    and decision.status='recorded'
  order by decision.created_at desc,decision.id desc
  limit 1
  for update;

  if found then
    update public.registry_canonicalization_decisions
    set
      status='superseded',
      metadata=
        coalesce(metadata,'{}'::jsonb)||
        jsonb_build_object(
          'supersededAt',now(),
          'supersededByUserId',v_user_id
        )
    where id=v_existing.id;
  end if;

  insert into public.registry_canonicalization_decisions (
    review_item_id,
    decision_type,
    entity_type,
    entity_id,
    before_payload,
    after_payload,
    decision_notes,
    decided_by,
    status,
    metadata
  )
  values (
    v_review.id,
    v_decision_type,
    'track',
    v_track.id,
    jsonb_build_object(
      'reviewStatus',v_review.status,
      'ruleId',v_rule_id,
      'ruleVersion',v_rule_version,
      'currentSlug',v_track.slug,
      'title',v_track.title,
      'isrc',v_track.isrc,
      'trackStateFingerprint',v_state_fingerprint,
      'reviewUpdatedAt',v_review.updated_at,
      'relatedRecordingIdentityReviewId',
        v_related_identity_review_id
    ),
    v_payload,
    v_notes,
    v_user_id,
    'recorded',
    jsonb_build_object(
      'programmeKey',
        'public_music_identity_track_actual_zero_v1',
      'programmeIssue',1094,
      'decisionStage','human_review_recorded',
      'canonicalEntitiesChanged',false,
      'reviewResolved',false,
      'redirectMutation',false
    )
  )
  returning id into v_decision_id;

  return jsonb_build_object(
    'decisionId',v_decision_id,
    'reviewId',v_review.id,
    'trackId',v_track.id,
    'decisionType',v_decision_type,
    'trackStateFingerprint',v_state_fingerprint,
    'reviewStatus','open',
    'canonicalEntitiesChanged',false,
    'reviewResolved',false
  );
end
$$;




create or replace function public.admin_preview_registry_track_duplicate_repair(
  p_canonical_track_id uuid,
  p_duplicate_track_ids uuid[]
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,platform_private
as $$
declare
  v_duplicate_ids uuid[];
  v_preview jsonb;
  v_reviewed_match_count integer:=0;
  v_duplicate_count integer:=0;
  v_other_blockers jsonb:='[]'::jsonb;
begin
  if not coalesce(public.current_user_has_capability('manage_registry'),false) then
    raise exception 'insufficient_privilege';
  end if;

  v_duplicate_ids:=array(
    select distinct item
    from unnest(coalesce(p_duplicate_track_ids,'{}'::uuid[])) item
    where item is not null
      and item<>p_canonical_track_id
    order by item
  );

  v_duplicate_count:=coalesce(cardinality(v_duplicate_ids),0);

  v_preview:=
    platform_private.admin_preview_registry_track_duplicate_repair_base_v1(
      p_canonical_track_id,
      v_duplicate_ids
    );

  if v_duplicate_count=0 then
    return v_preview;
  end if;

  select count(*)::integer
  into v_reviewed_match_count
  from unnest(v_duplicate_ids) duplicate_id
  where exists (
    select 1
    from public.registry_canonicalization_decisions decision
    join public.registry_review_items slug_review
      on slug_review.id=decision.review_item_id
    join public.registry_review_items identity_review
      on identity_review.id::text=
           decision.before_payload->>'relatedRecordingIdentityReviewId'
    where decision.entity_type='track'
      and decision.entity_id=duplicate_id
      and decision.decision_type='public_music_identity_true_duplicate'
      and decision.status='recorded'
      and decision.decided_by is not null
      and decision.metadata->>'programmeKey'=
          'public_music_identity_track_actual_zero_v1'
      and decision.metadata->>'programmeIssue'='1094'
      and decision.metadata->>'decisionStage'='human_review_recorded'
      and coalesce(decision.metadata->>'reviewResolved','false')='false'
      and decision.after_payload->>'canonicalTrackId'=
          p_canonical_track_id::text
      and decision.before_payload->>'trackStateFingerprint'=
          platform_private.registry_subject_state_fingerprint(
            'track',
            duplicate_id
          )
      and slug_review.review_type='mizizi_data_hygiene'
      and slug_review.entity_type='track'
      and slug_review.status='open'
      and slug_review.source_id=duplicate_id::text
      and (
        (
          slug_review.source_payload->>'ruleId'='track_slug_identity_noise'
          and slug_review.source_payload->>'ruleVersion'='1.1.0'
        )
        or
        (
          slug_review.source_payload->>'ruleId'='track_slug_credit_evidence_gap'
          and slug_review.source_payload->>'ruleVersion'='1.3.0'
        )
        or
        (
          slug_review.source_payload->>'ruleId'='track_recording_identity_conflict'
          and slug_review.source_payload->>'ruleVersion'='1.3.0'
          and slug_review.id=identity_review.id
        )
      )
      and identity_review.review_type='mizizi_data_hygiene'
      and identity_review.entity_type='track'
      and identity_review.status='open'
      and identity_review.source_id=duplicate_id::text
      and identity_review.source_payload->>'ruleId'=
          'track_recording_identity_conflict'
      and identity_review.source_payload->>'ruleVersion'='1.3.0'
      and exists (
        select 1
        from jsonb_array_elements(
          coalesce(
            identity_review.source_payload#>'{evidence,peers}',
            '[]'::jsonb
          )
        ) peer
        where peer->>'id'=p_canonical_track_id::text
      )
  );

  v_preview:=jsonb_set(
    v_preview,
    '{counts,reviewedHumanDecisionMatches}',
    to_jsonb(v_reviewed_match_count),
    true
  );

  if v_reviewed_match_count<>v_duplicate_count then
    return v_preview;
  end if;

  select coalesce(jsonb_agg(value),'[]'::jsonb)
  into v_other_blockers
  from jsonb_array_elements(
    coalesce(v_preview->'blockers','[]'::jsonb)
  ) blocker(value)
  where blocker.value<>to_jsonb('not_enough_identity_evidence'::text);

  if jsonb_array_length(v_other_blockers)>0 then
    return v_preview;
  end if;

  v_preview:=jsonb_set(
    v_preview,
    '{confidenceBucket}',
    to_jsonb('high'::text),
    false
  );

  v_preview:=jsonb_set(
    v_preview,
    '{blockers}',
    '[]'::jsonb,
    false
  );

  v_preview:=jsonb_set(
    v_preview,
    '{reviewedAuthority}',
    jsonb_build_object(
      'programmeKey','public_music_identity_track_actual_zero_v1',
      'programmeIssue',1094,
      'decisionType','public_music_identity_true_duplicate',
      'coverage','all_duplicate_targets'
    ),
    true
  );

  return v_preview;
end
$$;


create or replace function
platform_private.public_music_identity_track_review_terminal_evidence_v1(
  p_review_id uuid,
  p_decision_id uuid,
  p_verified_operation_id uuid,
  p_archive_event_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,platform_private
as $evidence$
declare
  v_review public.registry_review_items%rowtype;
  v_decision public.registry_canonicalization_decisions%rowtype;
  v_track public.registry_tracks%rowtype;
  v_operation platform_private.registry_mutation_operations%rowtype;
  v_grant platform_private.registry_execution_grants%rowtype;
  v_archive public.registry_canonical_write_events%rowtype;
  v_track_id uuid;
  v_canonical_track_id uuid;
  v_route_track_id uuid;
  v_expected_slug text;
  v_primary_artist_slug text;
  v_primary_artist_count integer;
  v_decision_type text;
  v_decision_track_state_fingerprint text;
  v_current_track_state_fingerprint text;
  v_expected_primary_artist_slug text;
  v_recording_identity_review_id uuid;
  v_recording_identity_review public.registry_review_items%rowtype;
  v_expected_featured_artist_slugs jsonb;
  v_current_featured_artist_slugs jsonb;
  v_expected_recording_peer_ids jsonb;
  v_current_recording_peer_ids jsonb;
begin
  if p_review_id is null or p_decision_id is null then
    raise exception using errcode='22023',
      message='Review ID and decision ID are required for finalization evidence.';
  end if;

  select review.*
  into v_review
  from public.registry_review_items review
  where review.id=p_review_id
    and review.review_type='mizizi_data_hygiene'
    and review.entity_type='track'
    and review.status='open';

  if not found
     or not (
       (
         v_review.source_payload->>'ruleId'='track_slug_identity_noise'
         and v_review.source_payload->>'ruleVersion'='1.1.0'
       )
       or
       (
         v_review.source_payload->>'ruleId'='track_slug_credit_evidence_gap'
         and v_review.source_payload->>'ruleVersion'='1.3.0'
       )
       or
       (
         v_review.source_payload->>'ruleId'='track_recording_identity_conflict'
         and v_review.source_payload->>'ruleVersion'='1.3.0'
       )
     )
  then
    raise exception using errcode='42501',
      message='Review is not one open #1094 Track identity review.';
  end if;

  begin
    v_track_id:=nullif(btrim(coalesce(v_review.source_id,'')),'')::uuid;
  exception when others then
    raise exception using errcode='23514',
      message='Review source Track UUID is malformed.';
  end;

  select decision.*
  into v_decision
  from public.registry_canonicalization_decisions decision
  where decision.id=p_decision_id
    and decision.review_item_id=v_review.id
    and decision.entity_type='track'
    and decision.entity_id=v_track_id
    and decision.status='recorded'
    and decision.metadata->>'programmeKey'=
      'public_music_identity_track_actual_zero_v1'
    and decision.metadata->>'decisionStage'=
      'human_review_recorded';

  if not found then
    raise exception using errcode='23514',
      message='Finalization is not bound to the exact recorded #1094 human decision.';
  end if;

  v_decision_type:=v_decision.decision_type;

  if v_review.source_payload->>'ruleId'='track_recording_identity_conflict'
     and v_decision_type<>'public_music_identity_true_duplicate'
  then
    raise exception using errcode='42501',
      message='WK_1094_RECORDING_REVIEW_ONLY_FINALIZES_TRUE_DUPLICATE';
  end if;

  if v_decision_type in (
       'public_music_identity_credit_correction_required',
       'public_music_identity_needs_more_research'
     )
  then
    raise exception using errcode='42501',
      message='This human decision is intentionally non-terminal and cannot resolve the review.';
  end if;

  if v_decision_type not in (
       'public_music_identity_safe_slug_repair',
       'public_music_identity_distinct_recording',
       'public_music_identity_true_duplicate',
       'public_music_identity_retire_unresolvable'
     )
  then
    raise exception using errcode='42501',
      message='Unsupported terminal Public Music Identity decision.';
  end if;

  if v_decision_type in (
       'public_music_identity_safe_slug_repair',
       'public_music_identity_true_duplicate'
     )
  then
    if p_verified_operation_id is null or p_archive_event_id is not null then
      raise exception using errcode='22023',
        message='This decision requires exactly one verified canonical operation receipt.';
    end if;

    select operation.*
    into v_operation
    from platform_private.registry_mutation_operations operation
    where operation.id=p_verified_operation_id
      and operation.status='succeeded'
      and operation.verifier_status='passed'
      and operation.completed_at is not null
      and operation.completed_at>=v_decision.created_at;

    if not found then
      raise exception using errcode='23514',
        message='Verified canonical operation receipt is missing, stale, or predates the human decision.';
    end if;

    select execution_grant.*
    into v_grant
    from platform_private.registry_execution_grants execution_grant
    where execution_grant.id=v_operation.execution_grant_id;

    if not found then
      raise exception using errcode='23514',
        message='Verified canonical operation has no execution grant.';
    end if;
  end if;

  if v_decision_type='public_music_identity_safe_slug_repair' then
    v_expected_slug:=
      nullif(btrim(coalesce(v_decision.after_payload->>'proposedSlug','')),'');
    v_route_track_id:=v_track_id;

    if v_expected_slug is null
       or v_operation.actor_key<>'mizizi'
       or v_operation.operation_key<>'registry.track_slug.canonicalize'
       or v_operation.operation_version<>1
       or v_grant.plan_payload->>'track_id'<>v_track_id::text
       or v_grant.plan_payload->>'proposed_slug'<>v_expected_slug
    then
      raise exception using errcode='23514',
        message='Safe-slug decision is not proven by the exact verified Track slug operation.';
    end if;

    select track.*
    into v_track
    from public.registry_tracks track
    where track.id=v_track_id
      and track.status='active'
      and track.slug=v_expected_slug;

    if not found then
      raise exception using errcode='23514',
        message='Safe-slug finalization postcondition is not current.';
    end if;

  elsif v_decision_type='public_music_identity_distinct_recording' then
    v_expected_slug:=
      nullif(btrim(coalesce(v_decision.after_payload->>'canonicalSlug','')),'');
    v_expected_primary_artist_slug:=
      nullif(
        btrim(
          coalesce(
            v_decision.after_payload->>'evidencePrimaryArtistSlug',
            ''
          )
        ),
        ''
      );
    v_decision_track_state_fingerprint:=
      nullif(
        btrim(
          coalesce(
            v_decision.before_payload->>'trackStateFingerprint',
            ''
          )
        ),
        ''
      );
    v_route_track_id:=v_track_id;

    begin
      v_recording_identity_review_id:=
        nullif(
          btrim(
            coalesce(
              v_decision.after_payload->>'evidenceRecordingIdentityReviewId',
              ''
            )
          ),
          ''
        )::uuid;
    exception when others then
      raise exception using errcode='23514',
        message='Distinct-recording evidence review UUID is malformed.';
    end;

    if p_verified_operation_id is not null
       or p_archive_event_id is not null
    then
      raise exception using errcode='22023',
        message='Distinct-recording finalization preserves canonical identity and accepts no mutation receipt.';
    end if;

    if v_expected_slug is null
       or nullif(
            btrim(coalesce(v_decision.after_payload->>'semanticDistinction','')),
            ''
          ) is null
       or v_expected_primary_artist_slug is null
       or v_recording_identity_review_id is null
       or v_decision_track_state_fingerprint is null
       or jsonb_typeof(
            v_decision.after_payload->'evidenceFeaturedArtistSlugs'
          ) is distinct from 'array'
       or jsonb_typeof(
            v_decision.after_payload->'evidenceRecordingPeerIds'
          ) is distinct from 'array'
       or jsonb_array_length(
            v_decision.after_payload->'evidenceRecordingPeerIds'
          )=0
       or coalesce(v_decision.after_payload->>'canonicalEntitiesChanged','')<>
          'false'
       or coalesce(v_decision.after_payload->>'reviewResolved','')<>'false'
       or coalesce(v_decision.after_payload->>'redirectMutation','')<>'false'
    then
      raise exception using errcode='23514',
        message='Distinct-recording decision lacks exact preserved-identity evidence.';
    end if;

    select track.*
    into v_track
    from public.registry_tracks track
    where track.id=v_track_id
      and track.status='active'
      and track.slug=v_expected_slug;

    if not found then
      raise exception using errcode='23514',
        message='Distinct-recording preserved Track identity is not current.';
    end if;

    v_current_track_state_fingerprint:=
      platform_private.registry_subject_state_fingerprint(
        'track',
        v_track_id
      );

    if v_current_track_state_fingerprint is distinct from
         v_decision_track_state_fingerprint
    then
      raise exception using errcode='23514',
        message='Distinct-recording Track state drifted after the human decision.';
    end if;

    select review.*
    into v_recording_identity_review
    from public.registry_review_items review
    where review.id=v_recording_identity_review_id
      and review.review_type='mizizi_data_hygiene'
      and review.entity_type='track'
      and review.status='open'
      and review.source_id=v_track_id::text
      and review.source_payload->>'ruleId'=
        'track_recording_identity_conflict'
      and review.source_payload->>'ruleVersion'='1.3.0';

    if not found then
      raise exception using errcode='23514',
        message='Distinct-recording evidence is not bound to the exact open recording-identity review.';
    end if;

    select
      count(*)::integer,
      min(credit.artist_slug)
    into
      v_primary_artist_count,
      v_primary_artist_slug
    from public.registry_track_artists credit
    where credit.track_id=v_track_id
      and coalesce(credit.status,'active')<>'archived'
      and credit.is_primary is true
      and nullif(btrim(credit.artist_slug),'') is not null;

    if v_primary_artist_count<>1
       or v_primary_artist_slug is distinct from
          v_expected_primary_artist_slug
    then
      raise exception using errcode='23514',
        message='Distinct-recording primary-Artist evidence drifted after the human decision.';
    end if;

    select
      coalesce(
        jsonb_agg(featured.artist_slug order by featured.artist_slug),
        '[]'::jsonb
      )
    into v_current_featured_artist_slugs
    from (
      select distinct credit.artist_slug
      from public.registry_track_artists credit
      where credit.track_id=v_track_id
        and coalesce(credit.status,'active')<>'archived'
        and credit.is_featured is true
        and nullif(btrim(credit.artist_slug),'') is not null
    ) featured;

    select
      coalesce(
        jsonb_agg(expected.artist_slug order by expected.artist_slug),
        '[]'::jsonb
      )
    into v_expected_featured_artist_slugs
    from (
      select distinct featured_slug.value as artist_slug
      from jsonb_array_elements_text(
        v_decision.after_payload->'evidenceFeaturedArtistSlugs'
      ) featured_slug(value)
      where nullif(btrim(featured_slug.value),'') is not null
    ) expected;

    if v_current_featured_artist_slugs is distinct from
         v_expected_featured_artist_slugs
    then
      raise exception using errcode='23514',
        message='Distinct-recording featured-Artist evidence drifted after the human decision.';
    end if;

    select
      coalesce(
        jsonb_agg(peer.peer_id order by peer.peer_id),
        '[]'::jsonb
      )
    into v_current_recording_peer_ids
    from (
      select distinct evidence_peer.value->>'id' as peer_id
      from jsonb_array_elements(
        coalesce(
          v_recording_identity_review.source_payload#>'{evidence,peers}',
          '[]'::jsonb
        )
      ) evidence_peer(value)
      where nullif(btrim(evidence_peer.value->>'id'),'') is not null
    ) peer;

    select
      coalesce(
        jsonb_agg(expected.peer_id order by expected.peer_id),
        '[]'::jsonb
      )
    into v_expected_recording_peer_ids
    from (
      select distinct peer_id.value as peer_id
      from jsonb_array_elements_text(
        v_decision.after_payload->'evidenceRecordingPeerIds'
      ) peer_id(value)
      where nullif(btrim(peer_id.value),'') is not null
    ) expected;

    if v_current_recording_peer_ids is distinct from
         v_expected_recording_peer_ids
    then
      raise exception using errcode='23514',
        message='Distinct-recording reviewed peer evidence drifted after the human decision.';
    end if;

    if exists (
      select 1
      from public.wk_chart_entries_v2 chart_entry
      where chart_entry.canonical_track_id=v_track_id::text
        and chart_entry.track_slug is distinct from v_expected_slug
    ) then
      raise exception using errcode='23514',
        message='Distinct-recording Chart projection is stale for the preserved canonical slug.';
    end if;

  elsif v_decision_type='public_music_identity_true_duplicate' then
    begin
      v_canonical_track_id:=
        nullif(
          btrim(coalesce(v_decision.after_payload->>'canonicalTrackId','')),
          ''
        )::uuid;
    exception when others then
      raise exception using errcode='23514',
        message='Duplicate decision canonical Track UUID is malformed.';
    end;

    v_route_track_id:=v_canonical_track_id;

    if v_canonical_track_id is null
       or v_canonical_track_id=v_track_id
       or v_operation.actor_key<>'registry_track_duplicate_admin'
       or v_operation.operation_key<>'registry.track.duplicate_repair'
       or v_operation.operation_version<>1
       or v_grant.plan_payload->>'canonical_track_id'<>
          v_canonical_track_id::text
       or not exists (
         select 1
         from jsonb_array_elements_text(
           coalesce(v_grant.plan_payload->'duplicate_track_ids','[]'::jsonb)
         ) duplicate_id(value)
         where duplicate_id.value=v_track_id::text
       )
    then
      raise exception using errcode='23514',
        message='Duplicate decision is not proven by the exact verified duplicate-repair operation.';
    end if;

    if not exists (
         select 1
         from public.registry_tracks source_track
         where source_track.id=v_track_id
           and source_track.status='archived'
       )
       or not exists (
         select 1
         from public.registry_tracks canonical_track
         where canonical_track.id=v_canonical_track_id
           and canonical_track.status='active'
       )
    then
      raise exception using errcode='23514',
        message='Duplicate-repair Track lifecycle postcondition is not current.';
    end if;

    select canonical_track.slug
    into v_expected_slug
    from public.registry_tracks canonical_track
    where canonical_track.id=v_canonical_track_id;

  else
    if p_archive_event_id is null or p_verified_operation_id is not null then
      raise exception using errcode='22023',
        message='Retire-unresolvable finalization requires exactly one archive receipt.';
    end if;

    select event.*
    into v_archive
    from public.registry_canonical_write_events event
    where event.id=p_archive_event_id
      and event.registry_entity_type='track'
      and event.registry_entity_id=v_track_id::text
      and event.source_table='public.admin_archive_registry_music_entity_v1'
      and event.field_name='status'
      and event.target_path='public.registry_tracks.status'
      and event.action='archive'
      and event.status='succeeded'
      and event.after_value->>'value'='archived'
      and event.actor='user:'||v_decision.decided_by::text
      and event.created_at>=v_decision.created_at;

    if not found
       or not exists (
         select 1
         from public.registry_tracks source_track
         where source_track.id=v_track_id
           and source_track.status='archived'
       )
    then
      raise exception using errcode='23514',
        message='Retire-unresolvable decision is not proven by the exact reviewed archive receipt.';
    end if;

    v_route_track_id:=null;
    v_expected_slug:=null;
  end if;

  if v_route_track_id is not null then
    select
      count(*)::integer,
      min(credit.artist_slug)
    into
      v_primary_artist_count,
      v_primary_artist_slug
    from public.registry_track_artists credit
    where credit.track_id=v_route_track_id
      and coalesce(credit.status,'active')<>'archived'
      and credit.is_primary is true
      and nullif(btrim(credit.artist_slug),'') is not null;

    if v_primary_artist_count<>1
       or nullif(v_primary_artist_slug,'') is null
    then
      raise exception using errcode='23514',
        message='Finalization target lacks exact one-primary-Artist public route authority.';
    end if;
  end if;

  return jsonb_build_object(
    'reviewId',v_review.id,
    'decisionId',v_decision.id,
    'decisionType',v_decision_type,
    'sourceTrackId',v_track_id,
    'canonicalTrackId',v_canonical_track_id,
    'routeTrackId',v_route_track_id,
    'expectedSlug',v_expected_slug,
    'primaryArtistSlug',v_primary_artist_slug,
    'verifiedOperationId',p_verified_operation_id,
    'archiveEventId',p_archive_event_id,
    'decisionCreatedAt',v_decision.created_at
  );
end
$evidence$;
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

create or replace function
public.admin_reconcile_public_music_identity_linked_recording_review_v1(
  p_decision_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,auth
as $reconcile$
declare
  v_user_id uuid:=auth.uid();
  v_decision public.registry_canonicalization_decisions%rowtype;
  v_source public.registry_review_items%rowtype;
  v_linked public.registry_review_items%rowtype;
  v_track public.registry_tracks%rowtype;
  v_linked_id uuid;
  v_expected_peer_ids jsonb;
  v_current_peer_ids jsonb;
  v_now timestamptz:=now();
begin
  if v_user_id is null
     or not (
       coalesce(public.current_user_has_capability('manage_registry'),false)
       or coalesce(public.current_user_is_administrator(),false)
     )
  then
    raise exception using errcode='42501',
      message='WK_1094_RECONCILE_REQUIRES_ADMIN';
  end if;

  if p_decision_id is null
     or octet_length(coalesce(p_note,''))>4000
  then
    raise exception using errcode='22023',
      message='WK_1094_RECONCILE_INVALID_ARGUMENTS';
  end if;

  select decision.*
  into v_decision
  from public.registry_canonicalization_decisions decision
  where decision.id=p_decision_id
    and decision.entity_type='track'
    and decision.decision_type='public_music_identity_distinct_recording'
    and decision.status='recorded'
    and decision.decided_by is not null
    and decision.metadata->>'programmeKey'=
      'public_music_identity_track_actual_zero_v1'
    and decision.metadata->>'programmeIssue'='1094'
    and decision.metadata->>'reviewResolved'='true'
    and decision.metadata->>'finalizerAuthority'=
      'admin_finalize_public_music_identity_track_review_v1'
  for update;

  if not found then
    raise exception using errcode='23514',
      message='WK_1094_RECONCILE_EXACT_FINALIZED_DECISION_MISSING';
  end if;

  select review.*
  into v_source
  from public.registry_review_items review
  where review.id=v_decision.review_item_id
    and review.status='resolved'
    and review.review_type='mizizi_data_hygiene'
    and review.entity_type='track'
    and review.entity_id=v_decision.entity_id
    and review.source_id=v_decision.entity_id::text
    and review.resolution_payload->>'decisionId'=v_decision.id::text
    and review.resolution_payload->>'decisionType'=
      'public_music_identity_distinct_recording'
    and review.resolution_payload->>'finalizerAuthority'=
      'admin_finalize_public_music_identity_track_review_v1'
  for update;

  if not found then
    raise exception using errcode='23514',
      message='WK_1094_RECONCILE_ORIGINAL_FINALIZER_RECEIPT_MISMATCH';
  end if;

  select track.*
  into v_track
  from public.registry_tracks track
  where track.id=v_decision.entity_id
    and track.status='active';

  if not found
     or v_track.slug is distinct from
        v_decision.after_payload->>'canonicalSlug'
     or platform_private.registry_subject_state_fingerprint(
          'track',
          v_decision.entity_id
        ) is distinct from
        v_decision.before_payload->>'trackStateFingerprint'
  then
    raise exception using errcode='40001',
      message='WK_1094_RECONCILE_TRACK_EVIDENCE_DRIFT';
  end if;

  begin
    v_linked_id:=
      nullif(
        v_decision.after_payload->>'evidenceRecordingIdentityReviewId',
        ''
      )::uuid;
  exception when others then
    raise exception using errcode='23514',
      message='WK_1094_RECONCILE_LINKED_ID_MALFORMED';
  end;

  if v_linked_id is null
     or v_linked_id=v_source.id
     or jsonb_typeof(
          v_decision.after_payload->'evidenceRecordingPeerIds'
        ) is distinct from 'array'
  then
    raise exception using errcode='23514',
      message='WK_1094_RECONCILE_LINKED_EVIDENCE_MISSING';
  end if;

  select review.*
  into v_linked
  from public.registry_review_items review
  where review.id=v_linked_id
    and review.review_type='mizizi_data_hygiene'
    and review.entity_type='track'
    and review.entity_id=v_track.id
    and review.source_id=v_track.id::text
    and review.source_payload->>'ruleId'='track_recording_identity_conflict'
    and review.source_payload->>'ruleVersion'='1.3.0'
  for update;

  if not found then
    raise exception using errcode='23514',
      message='WK_1094_RECONCILE_LINKED_REVIEW_DRIFT';
  end if;

  select coalesce(
           jsonb_agg(value order by value),
           '[]'::jsonb
         )
  into v_expected_peer_ids
  from jsonb_array_elements_text(
    v_decision.after_payload->'evidenceRecordingPeerIds'
  ) item(value);

  select coalesce(
           jsonb_agg(to_jsonb(peer->>'id') order by peer->>'id'),
           '[]'::jsonb
         )
  into v_current_peer_ids
  from jsonb_array_elements(
    coalesce(
      v_linked.source_payload#>'{evidence,peers}',
      '[]'::jsonb
    )
  ) peer;

  if v_expected_peer_ids is distinct from v_current_peer_ids then
    raise exception using errcode='40001',
      message='WK_1094_RECONCILE_RECORDING_PEER_EVIDENCE_DRIFT';
  end if;

  if v_linked.status='resolved' then
    if v_linked.resolution_payload->>'decisionId'=v_decision.id::text
       and v_linked.resolution_payload->>'sourceSlugReviewId'=v_source.id::text
    then
      return jsonb_build_object(
        'decisionId',v_decision.id,
        'sourceSlugReviewId',v_source.id,
        'linkedRecordingReviewId',v_linked.id,
        'linkedReviewStatus','resolved',
        'idempotentReplay',true
      );
    end if;

    raise exception using errcode='23514',
      message='WK_1094_RECONCILE_LINKED_REVIEW_ALREADY_RESOLVED_BY_OTHER_AUTHORITY';
  end if;

  if v_linked.status<>'open' then
    raise exception using errcode='23514',
      message='WK_1094_RECONCILE_LINKED_REVIEW_NOT_OPEN';
  end if;

  update public.registry_review_items
  set status='resolved',
      resolution_payload=jsonb_build_object(
        'decisionId',v_decision.id,
        'sourceSlugReviewId',v_source.id,
        'decisionType','public_music_identity_distinct_recording',
        'finalizerAuthority',
          'admin_reconcile_public_music_identity_linked_recording_review_v1',
        'originalFinalizerAuthority',
          'admin_finalize_public_music_identity_track_review_v1',
        'finalizedByUserId',v_user_id,
        'finalizerNote',nullif(btrim(coalesce(p_note,'')),''),
        'resolvedAt',v_now
      ),
      resolved_at=v_now,
      updated_at=v_now
  where id=v_linked.id
    and status='open';

  if not found then
    raise exception using errcode='40001',
      message='WK_1094_RECONCILE_LINKED_REVIEW_CAS_FAILED';
  end if;

  return jsonb_build_object(
    'decisionId',v_decision.id,
    'sourceSlugReviewId',v_source.id,
    'linkedRecordingReviewId',v_linked.id,
    'linkedReviewStatus','resolved',
    'idempotentReplay',false
  );
end
$reconcile$;

revoke all on function
  public.admin_reconcile_public_music_identity_linked_recording_review_v1(
    uuid,text
  )
from public,anon,service_role;

grant execute on function
  public.admin_reconcile_public_music_identity_linked_recording_review_v1(
    uuid,text
  )
to authenticated;


drop policy if exists
  registry_review_items_admin_update
on public.registry_review_items;

create policy registry_review_items_admin_update
on public.registry_review_items
for update
to authenticated
using (
  public.current_user_has_capability('manage_review_queue')
  or public.current_user_is_administrator()
)
with check (
  (
    public.current_user_has_capability('manage_review_queue')
    or public.current_user_is_administrator()
  )
  and not (
    status='resolved'
    and review_type='mizizi_data_hygiene'
    and entity_type='track'
    and (
      (
        source_payload->>'ruleId'='track_slug_identity_noise'
        and source_payload->>'ruleVersion'='1.1.0'
      )
      or
      (
        source_payload->>'ruleId'='track_slug_credit_evidence_gap'
        and source_payload->>'ruleVersion'='1.3.0'
      )
      or
      (
        source_payload->>'ruleId'='track_recording_identity_conflict'
        and source_payload->>'ruleVersion'='1.3.0'
      )
    )
  )
);

do $postflight$
declare v_new text;
begin
  select pg_get_functiondef('public.admin_finalize_public_music_identity_track_review_v1(uuid,uuid,uuid,uuid,text)'::regprocedure) into v_new;
  if to_regprocedure('public.admin_reconcile_public_music_identity_linked_recording_review_v1(uuid,text)') is null then raise exception 'WK_1094_RECONCILER_MISSING'; end if;
  if position('WK_1094_LINKED_RECORDING_REVIEW_CAS_FAILED' in v_new)=0
     or position('evidenceRecordingIdentityReviewId' in v_new)=0
     or position('track_recording_identity_conflict' in v_new)=0
  then raise exception 'WK_1094_LINKED_FINALIZATION_BODY_DRIFT'; end if;
  if has_function_privilege('anon','public.admin_finalize_public_music_identity_track_review_v1(uuid,uuid,uuid,uuid,text)','EXECUTE')
  then raise exception 'WK_1094_FINALIZER_ANON_GRANT_DRIFT'; end if;
end $postflight$;
commit;
