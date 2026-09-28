do $preflight$
begin
  if to_regprocedure(
       'platform_private.registry_subject_state_fingerprint(text,uuid)'
     ) is null
  then
    raise exception
      'STOP: shared Registry state-fingerprint authority is missing';
  end if;

  if to_regprocedure(
       'public.admin_get_public_music_identity_track_review_context_v1(uuid)'
     ) is not null
     or to_regprocedure(
       'public.admin_record_public_music_identity_track_review_decision_v1(uuid,text,jsonb,text,text)'
     ) is not null
  then
    raise exception
      'STOP: Public Music Identity Track review decision authority already exists; audit before reapplying';
  end if;
end
$preflight$;

create function
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
    and track.status='active';

  if not found then
    raise exception using errcode='23514',
      message='Review Track is not active.';
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

create function
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
    and track.status='active'
  for update;

  if not found then
    raise exception using errcode='23514',
      message='Review Track is not active.';
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

  if v_track.slug is distinct from
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



create function
platform_private.guard_public_music_identity_track_review_resolution_v1()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private
as $guard$
declare
  v_decision_id uuid;
  v_operation_id uuid;
  v_track_id uuid;
begin
  if old.status='resolved'
     or new.status is distinct from 'resolved'
     or new.review_type<>'mizizi_data_hygiene'
     or new.entity_type<>'track'
     or not (
       (
         new.source_payload->>'ruleId'='track_slug_identity_noise'
         and new.source_payload->>'ruleVersion'='1.1.0'
       )
       or
       (
         new.source_payload->>'ruleId'='track_slug_credit_evidence_gap'
         and new.source_payload->>'ruleVersion'='1.3.0'
       )
     )
  then
    return new;
  end if;

  if session_user<>'mizizi_executor' then
    raise exception using errcode='42501',
      message='Public Music Identity Track reviews may resolve only through the verified MIZIZI finalizer.';
  end if;

  begin
    v_decision_id:=
      nullif(btrim(coalesce(new.resolution_payload->>'decisionId','')),'')::uuid;
    v_operation_id:=
      nullif(btrim(coalesce(new.resolution_payload->>'verifiedOperationId','')),'')::uuid;
    v_track_id:=nullif(btrim(coalesce(new.source_id,'')),'')::uuid;
  exception
    when others then
      raise exception using errcode='23514',
        message='Resolution requires valid decisionId, verifiedOperationId, and Track UUID authority.';
  end;

  if v_decision_id is null
     or v_operation_id is null
     or v_track_id is null
  then
    raise exception using errcode='23514',
      message='Resolution requires decisionId and verifiedOperationId.';
  end if;

  if not exists (
       select 1
       from public.registry_canonicalization_decisions decision
       where decision.id=v_decision_id
         and decision.review_item_id=new.id
         and decision.entity_type='track'
         and decision.entity_id=v_track_id
         and decision.status='recorded'
         and decision.metadata->>'programmeKey'=
           'public_music_identity_track_actual_zero_v1'
         and decision.metadata->>'decisionStage'=
           'human_review_recorded'
     )
  then
    raise exception using errcode='23514',
      message='Resolution is not bound to the exact recorded #1094 human decision.';
  end if;

  if not exists (
       select 1
       from platform_private.registry_mutation_operations operation
       join platform_private.registry_execution_grants execution_grant
         on execution_grant.id=operation.execution_grant_id
       join platform_private.registry_execution_grant_targets target
         on target.execution_grant_id=execution_grant.id
       where operation.id=v_operation_id
         and operation.actor_key='mizizi'
         and operation.status='succeeded'
         and operation.verifier_status='passed'
         and target.subject_type='track'
         and target.subject_id=v_track_id
         and execution_grant.plan_payload->>'reviewId'=new.id::text
         and execution_grant.plan_payload->>'decisionId'=v_decision_id::text
     )
  then
    raise exception using errcode='23514',
      message='Resolution is not bound to one verified MIZIZI operation for this Track, review, and human decision.';
  end if;

  return new;
end
$guard$;

revoke all on function
  platform_private.guard_public_music_identity_track_review_resolution_v1()
from public;

create trigger
  registry_review_items_public_music_identity_track_resolution_guard_v1
before update of status
on public.registry_review_items
for each row
execute function
  platform_private.guard_public_music_identity_track_review_resolution_v1();

revoke all on function
  public.admin_get_public_music_identity_track_review_context_v1(uuid)
from public;

revoke all on function
  public.admin_record_public_music_identity_track_review_decision_v1(
    uuid,text,jsonb,text,text
  )
from public;

grant execute on function
  public.admin_get_public_music_identity_track_review_context_v1(uuid)
to authenticated;

grant execute on function
  public.admin_record_public_music_identity_track_review_decision_v1(
    uuid,text,jsonb,text,text
  )
to authenticated;
