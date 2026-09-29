-- Public Music Identity #1094 — distinct-recording terminal evidence V2.
--
-- A human-reviewed distinct recording can be terminal without a canonical
-- mutation when the approved outcome is to preserve the current Track UUID,
-- current canonical slug, and exact reviewed recording-identity evidence.
-- Safe-slug, true-duplicate, retire, and non-terminal paths remain unchanged.

begin;
set local statement_timeout='180s';
set local lock_timeout='5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'public-music-identity-distinct-recording-finalization-v2',
    0
  )
);

do $preflight$
begin
  if to_regprocedure(
       'platform_private.public_music_identity_track_review_terminal_evidence_v1(uuid,uuid,uuid,uuid)'
     ) is null
     or to_regprocedure(
       'public.admin_finalize_public_music_identity_track_review_v1(uuid,uuid,uuid,uuid,text)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_subject_state_fingerprint(text,uuid)'
     ) is null
     or to_regclass('public.registry_review_items') is null
     or to_regclass('public.registry_canonicalization_decisions') is null
     or to_regclass('public.registry_tracks') is null
     or to_regclass('public.registry_track_artists') is null
     or to_regclass('public.wk_chart_entries_v2') is null
  then
    raise exception
      'STOP: distinct-recording finalization V2 dependency is missing';
  end if;
end
$preflight$;

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
     )
  then
    raise exception using errcode='42501',
      message='Review is not one open #1094 Track slug review.';
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
              v_decision.after_payload->
                >'evidenceRecordingIdentityReviewId',
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


revoke all on function
  platform_private.public_music_identity_track_review_terminal_evidence_v1(
    uuid,uuid,uuid,uuid
  )
from public, anon, authenticated, service_role;

comment on function
  platform_private.public_music_identity_track_review_terminal_evidence_v1(
    uuid,uuid,uuid,uuid
  )
is
  'Verifies #1094 terminal review evidence. Distinct-recording decisions may resolve without a mutation receipt only when the recorded canonical Track identity and exact reviewed recording/credit evidence remain unchanged.';

commit;
