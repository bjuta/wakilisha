-- #1094: allow exact needs_review principal-credit evidence for a
-- needs_review synthetic collision review candidate only.
-- Keeps the existing MIZIZI executor assertion, synthetic-peer uniqueness,
-- same-Artist/title evidence, and canonical mutation authority unchanged.
-- This migration performs no Track, review, chart, credit or redirect DML.
begin;
set local statement_timeout='180s';
set local lock_timeout='5s';

do $preflight$
begin
  if to_regprocedure('mizizi_private.queue_public_music_identity_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)') is null
  then raise exception 'WK_1094_REVIEW_BROKER_MISSING'; end if;
end
$preflight$;

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
        and (
          target_credit.status='active'
          or (
            v_track.status='needs_review'
            and target_credit.status='needs_review'
          )
        )
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

do $postflight$
declare v_def text;
begin
  select pg_get_functiondef(
    'mizizi_private.queue_public_music_identity_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)'::regprocedure
  ) into v_def;
  if position('assert_executor_v1()' in v_def)=0
     or position('v_synthetic_peer_count<>1' in v_def)=0
     or position('target_credit.status=''needs_review''' in v_def)=0
     or position('v_track.status=''needs_review''' in v_def)=0
     or position('peer_credit.status=''active''' in v_def)=0
  then raise exception 'WK_1094_REVIEW_BROKER_POSTCONDITION_DRIFT'; end if;
  raise notice 'WK_1094_SYNTHETIC_REVIEW_CREDIT_ADMISSION_V1_PASS';
end
$postflight$;
commit;
