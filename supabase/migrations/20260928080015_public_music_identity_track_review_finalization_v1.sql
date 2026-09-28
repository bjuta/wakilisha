-- Public Music Identity #1094 — verified Track review finalization V1.
--
-- Human decision capture remains separate from canonical mutation.
-- This migration does not add or rewrite any canonical Track mutation engine.
-- It verifies already-durable canonical receipts, converges only the one
-- currently-live duplicate-derived pointer surface (Community Threads), and
-- then closes the exact slug review lifecycle.

begin;
set local statement_timeout='180s';
set local lock_timeout='5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'public-music-identity-track-review-finalization-v1',
    0
  )
);

do $preflight$
begin
  if to_regprocedure(
       'public.admin_record_public_music_identity_track_review_decision_v1(uuid,text,jsonb,text,text)'
     ) is null
     or to_regprocedure(
       'platform_private.guard_public_music_identity_track_review_resolution_v1()'
     ) is null
     or to_regprocedure(
       'public.admin_archive_registry_music_entity_v1(text,uuid,timestamp with time zone)'
     ) is null
     or to_regclass('public.registry_review_items') is null
     or to_regclass('public.registry_canonicalization_decisions') is null
     or to_regclass('public.registry_canonical_write_events') is null
     or to_regclass('public.community_threads') is null
     or to_regclass('public.community_saves') is null
     or to_regclass('public.community_activity') is null
     or to_regclass('public.community_contributions') is null
     or to_regclass('public.audience_interests') is null
     or to_regclass('public.signal_os_content_opportunities') is null
     or to_regclass('platform_private.registry_mutation_operations') is null
     or to_regclass('platform_private.registry_execution_grants') is null
  then
    raise exception
      'STOP: Public Music Identity Track review finalization dependency is missing';
  end if;

  if to_regprocedure(
       'platform_private.public_music_identity_track_review_terminal_evidence_v1(uuid,uuid,uuid,uuid)'
     ) is not null
     or to_regprocedure(
       'public.admin_finalize_public_music_identity_track_review_v1(uuid,uuid,uuid,uuid,text)'
     ) is not null
  then
    raise exception
      'STOP: Public Music Identity Track review finalization V1 already exists; audit before reapplying';
  end if;
end
$preflight$;

create function
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
       'public_music_identity_distinct_recording',
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
    v_route_track_id:=v_track_id;

    if v_expected_slug is null
       or nullif(
            btrim(coalesce(v_decision.after_payload->>'semanticDistinction','')),
            ''
          ) is null
       or v_operation.actor_key<>'mizizi'
       or v_operation.operation_key<>'registry.track_slug.canonicalize'
       or v_operation.operation_version<>1
       or v_grant.plan_payload->>'track_id'<>v_track_id::text
       or v_grant.plan_payload->>'proposed_slug'<>v_expected_slug
    then
      raise exception using errcode='23514',
        message='Distinct-recording decision is not proven by the exact verified semantic Track slug operation.';
    end if;

    select track.*
    into v_track
    from public.registry_tracks track
    where track.id=v_track_id
      and track.status='active'
      and track.slug=v_expected_slug;

    if not found then
      raise exception using errcode='23514',
        message='Distinct-recording finalization postcondition is not current.';
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

create or replace function
platform_private.guard_public_music_identity_track_review_resolution_v1()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private
as $guard$
declare
  v_decision_id uuid;
  v_operation_id uuid;
  v_archive_event_id uuid;
  v_evidence jsonb;
  v_source_track_id uuid;
  v_route_track_id uuid;
  v_expected_slug text;
  v_primary_artist_slug text;
  v_canonical_url text;
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

  if new.resolution_payload->>'finalizerAuthority'<>
       'admin_finalize_public_music_identity_track_review_v1'
  then
    raise exception using errcode='42501',
      message='Public Music Identity Track reviews may resolve only through the governed finalizer.';
  end if;

  begin
    v_decision_id:=
      nullif(btrim(coalesce(new.resolution_payload->>'decisionId','')),'')::uuid;
    v_operation_id:=
      nullif(
        btrim(coalesce(new.resolution_payload->>'verifiedOperationId','')),
        ''
      )::uuid;
    v_archive_event_id:=
      nullif(
        btrim(coalesce(new.resolution_payload->>'archiveEventId','')),
        ''
      )::uuid;
  exception when others then
    raise exception using errcode='23514',
      message='Finalization resolution receipt contains malformed UUID authority.';
  end;

  v_evidence:=
    platform_private.public_music_identity_track_review_terminal_evidence_v1(
      new.id,
      v_decision_id,
      v_operation_id,
      v_archive_event_id
    );

  v_source_track_id:=(v_evidence->>'sourceTrackId')::uuid;
  v_expected_slug:=nullif(v_evidence->>'expectedSlug','');
  v_primary_artist_slug:=nullif(v_evidence->>'primaryArtistSlug','');

  if nullif(v_evidence->>'routeTrackId','') is not null then
    v_route_track_id:=(v_evidence->>'routeTrackId')::uuid;
    v_canonical_url:=
      'https://wakilisha.africa/tracks/'||
      v_primary_artist_slug||'/'||v_expected_slug;
  end if;

  if v_evidence->>'decisionType' in (
       'public_music_identity_safe_slug_repair',
       'public_music_identity_distinct_recording'
     )
  then
    if exists (
      select 1
      from public.community_threads thread
      where thread.entity_type='track'
        and thread.entity_id=v_source_track_id::text
        and (
          thread.entity_slug is distinct from v_expected_slug
          or thread.entity_url is null
          or rtrim(thread.entity_url,'/')<>v_canonical_url
        )
    ) then
      raise exception using errcode='23514',
        message='Track slug finalization has stale Community thread pointers.';
    end if;

    if exists (
      select 1
      from public.community_saves save
      where save.entity_type='track'
        and save.entity_id=v_source_track_id::text
        and (
          save.entity_slug is distinct from v_expected_slug
          or (
            save.entity_url is not null
            and rtrim(save.entity_url,'/')<>v_canonical_url
          )
        )
    ) then
      raise exception using errcode='23514',
        message='Track slug finalization has stale Community save pointers.';
    end if;

  elsif v_evidence->>'decisionType'='public_music_identity_true_duplicate' then
    if exists (
      select 1
      from public.community_threads thread
      where thread.entity_type='track'
        and thread.entity_id=v_source_track_id::text
    ) then
      raise exception using errcode='23514',
        message='Duplicate finalization left a Community thread on the archived Track.';
    end if;

    if exists (
      select 1
      from public.community_threads thread
      where thread.entity_type='track'
        and thread.entity_id=v_route_track_id::text
        and (
          thread.entity_slug is distinct from v_expected_slug
          or thread.entity_url is null
          or rtrim(thread.entity_url,'/')<>v_canonical_url
        )
    ) then
      raise exception using errcode='23514',
        message='Duplicate finalization canonical Community thread is stale.';
    end if;
  end if;

  if v_evidence->>'decisionType' in (
       'public_music_identity_true_duplicate',
       'public_music_identity_retire_unresolvable'
     )
  then
    if exists (
      select 1
      from public.community_saves save
      where save.entity_type='track'
        and save.entity_id=v_source_track_id::text
    )
    or exists (
      select 1
      from public.community_activity activity
      where activity.entity_type='track'
        and activity.entity_id=v_source_track_id::text
    )
    or exists (
      select 1
      from public.community_contributions contribution
      where contribution.entity_type='track'
        and contribution.entity_id=v_source_track_id::text
    )
    or exists (
      select 1
      from public.audience_interests interest
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
        message='Finalization detected an unhandled current-pointer surface on the source Track.';
    end if;

    if v_evidence->>'decisionType'='public_music_identity_retire_unresolvable'
       and exists (
         select 1
         from public.community_threads thread
         where thread.entity_type='track'
           and thread.entity_id=v_source_track_id::text
       )
    then
      raise exception using errcode='23514',
        message='Retired Track still owns a Community thread and cannot be finalized.';
    end if;
  end if;

  return new;
end
$guard$;

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
    'resolvedAt',v_now
  );
end
$finalize$;

revoke all on function
  public.admin_finalize_public_music_identity_track_review_v1(
    uuid,uuid,uuid,uuid,text
  )
from public;

grant execute on function
  public.admin_finalize_public_music_identity_track_review_v1(
    uuid,uuid,uuid,uuid,text
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
    )
  )
);

commit;
