-- SQL DESIGN ONLY. NOT AN EXECUTABLE MIGRATION IN THIS LOCATION.
-- Supabase CLI must mint the canonical migration filename. Apply only after
-- clean Preview replay, exact grants, verification and accepted owner gates.
begin;
set local statement_timeout='180s';
set local lock_timeout='5s';
select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  'wk-charts2-track-intake-origin-v1',0
));

do $preflight$
begin
  if to_regclass('platform_private.charts2_capture_receipts_v1') is null
    or to_regclass('public.registry_provider_track_suggestions') is null
    or to_regprocedure('public.admin_finalize_registry_track_intake_v1(uuid,uuid,text)') is null
  then raise exception 'STOP: Chart source evidence and governed Intake authority required';
  end if;
  if to_regprocedure('public.admin_stage_charts2_track_intake_v1(text,uuid,text,integer)') is not null
  then raise exception 'STOP: Chart Intake authority already installed'; end if;
end
$preflight$;

alter table public.registry_provider_track_suggestions
  drop constraint registry_provider_track_suggestions_intake_origin_check;
alter table public.registry_provider_track_suggestions
  add constraint registry_provider_track_suggestions_intake_origin_check
  check (intake_origin=any(array[
    'playlist_editor','public_contribution','artist_submission','chart_studio'
  ]::text[]));

alter table public.registry_provider_track_suggestions
  drop constraint registry_provider_track_suggestions_pending_slot_check;
alter table public.registry_provider_track_suggestions
  add constraint registry_provider_track_suggestions_pending_slot_check
  check (
    not(status='needs_review' and source_playlist_item_id is null and canonical_track_id is null)
    or intake_origin=any(array[
      'public_contribution','artist_submission','chart_studio'
    ]::text[])
    or reserved_position is not null
  );

alter table public.registry_provider_track_suggestions
  drop constraint registry_provider_track_suggestions_provider_evidence_check;
alter table public.registry_provider_track_suggestions
  add constraint registry_provider_track_suggestions_provider_evidence_check
  check (
    (intake_origin='playlist_editor' and provider_key is not null and
      provider_object_id is not null and provider_url is not null and playback_kind is not null)
    or (intake_origin='public_contribution' and
      ((provider_key is null and provider_object_id is null and provider_url is null and playback_kind is null)
      or (provider_key is not null and provider_object_id is not null and provider_url is not null and playback_kind is not null)))
    or (intake_origin='artist_submission' and provider_key is not null and
      provider_object_id is not null and provider_url is not null and playback_kind is not null)
    or (intake_origin='chart_studio' and provider_key=any(array[
        'youtube','mdundo','apple_music','audiomack','shazam'
      ]::text[]) and provider_url is null and playback_kind is null)
  );

alter table public.registry_provider_track_suggestions
  add constraint registry_provider_track_suggestions_chart_origin_evidence_check
  check (intake_origin<>'chart_studio' or (
    source_playlist_id is null and source_playlist_item_id is null and
    source_contribution_id is null and reserved_position is null and
    requested_by is not null and submitted_track_title is not null and
    provider_title is not null and
    (validation_snapshot->>'chart_source_key')=any(array[
      'youtube_ke','mdundo_ke','apple_ke','audiomack_ke','shazam_ke'
    ]::text[]) and
    validation_snapshot->>'chart_receipt_id' is not null and
    validation_snapshot->>'chart_original_sha256' ~ '^[a-f0-9]{64}$' and
    validation_snapshot->>'chart_rank' ~ '^[1-9][0-9]{0,2}$'
  ));

create unique index registry_provider_track_suggestions_chart_origin_once_v1
  on public.registry_provider_track_suggestions (
    (validation_snapshot->>'chart_receipt_id'),
    (validation_snapshot->>'chart_rank')
  )
  where intake_origin='chart_studio';

-- Validates the same original that created the case, against current
-- accepted five-source receipts. Not authority to alter a Registry Track.
create function platform_private.assert_charts2_intake_receipt_v1(
  p_suggestion_id uuid
) returns void
language plpgsql security definer
set search_path=pg_catalog,public,platform_private,auth
as $assert$
declare
  v public.registry_provider_track_suggestions%rowtype;
  r platform_private.charts2_capture_receipts_v1%rowtype;
  o jsonb;
begin
  select * into v from public.registry_provider_track_suggestions
    where id=p_suggestion_id;
  if not found or v.intake_origin<>'chart_studio' then
    raise exception using errcode='42501',
      message='Exact Chart-origin Track Intake item is required.';
  end if;
  select * into r from platform_private.charts2_capture_receipts_v1
    where id=(v.validation_snapshot->>'chart_receipt_id')::uuid
      and source_key=v.validation_snapshot->>'chart_source_key'
      and original_sha256=v.validation_snapshot->>'chart_original_sha256'
      and observed_status='succeeded'
      and original_verified_at is not null;
  if not found or r.id is distinct from (
    select newest.id from platform_private.charts2_capture_receipts_v1 newest
    where newest.source_key=r.source_key and newest.observed_status='succeeded'
    order by newest.created_at desc,newest.id desc limit 1
  ) then
    raise exception using errcode='40001',
      message='Original Chart receipt no longer matches the accepted source.';
  end if;
  select observed.value into o from jsonb_array_elements(r.observations) observed(value)
    where observed.value->>'rank'=v.validation_snapshot->>'chart_rank';
  if o is null
    or o->>'title' is distinct from v.provider_title
    or nullif(o->>'artist','') is distinct from
       nullif(v.validation_snapshot->>'chart_artist_original','')
    or nullif(o->>'provider_track_id','') is distinct from v.provider_object_id
  then raise exception using errcode='40001',
    message='Original Chart observation disagrees with the Intake evidence.';
  end if;
end
$assert$;
revoke all on function platform_private.assert_charts2_intake_receipt_v1(uuid)
  from public,anon,authenticated,service_role;

-- Only a source-specific, human-capability-bound Intake request is created.
-- This creates NO Registry Track, Artist, credit, provider link or chart score.
create function public.admin_stage_charts2_track_intake_v1(
  p_source_key text,p_receipt_id uuid,p_original_sha256 text,p_rank integer
) returns jsonb
language plpgsql security definer
set search_path=pg_catalog,public,platform_private,auth
as $stage$
declare
  v_user uuid:=auth.uid();
  r platform_private.charts2_capture_receipts_v1%rowtype;
  o jsonb;
  v_item public.registry_provider_track_suggestions%rowtype;
  v_provider text;
  v_artist text;
begin
  if v_user is null
     or not coalesce(public.current_user_has_capability('manage_registry'),false)
     or not coalesce(public.current_user_has_capability('manage_charts'),false)
  then raise exception using errcode='42501',
    message='Charts and Registry review permissions are both required.';
  end if;
  if p_source_key not in (
    'youtube_ke','mdundo_ke','apple_ke','audiomack_ke','shazam_ke'
  ) or p_receipt_id is null
    or p_original_sha256 !~ '^[a-f0-9]{64}$'
    or p_rank is null or p_rank<1 or
      p_rank>case when p_source_key='shazam_ke' then 200 else 100 end
  then raise exception using errcode='22023',
    message='Exact Chart source, receipt, SHA and rank required.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'chart-intake:'||p_receipt_id::text||':'||p_rank::text,0
  ));
  select * into r from platform_private.charts2_capture_receipts_v1
    where id=p_receipt_id and source_key=p_source_key
      and original_sha256=p_original_sha256 and observed_status='succeeded'
      and original_verified_at is not null;
  if not found or r.id is distinct from (
    select newest.id from platform_private.charts2_capture_receipts_v1 newest
    where newest.source_key=p_source_key and newest.observed_status='succeeded'
    order by newest.created_at desc,newest.id desc limit 1
  ) then raise exception using errcode='40001',
    message='Original Chart receipt no longer current or verified.';
  end if;
  select observation.value into o
    from jsonb_array_elements(r.observations) observation(value)
    where observation.value->>'rank'=p_rank::text;
  if o is null or nullif(btrim(o->>'title'),'') is null
  then raise exception using errcode='22023',
    message='Original chart position has no reviewable recording title.';
  end if;
  select * into v_item from public.registry_provider_track_suggestions s
    where s.intake_origin='chart_studio'
      and s.validation_snapshot->>'chart_receipt_id'=p_receipt_id::text
      and s.validation_snapshot->>'chart_rank'=p_rank::text;
  if found then
    if v_item.validation_snapshot->>'chart_original_sha256'
        is distinct from p_original_sha256
    then raise exception using errcode='40001',
      message='Prior Track Intake case conflicts with original receipt.';
    end if;
    return jsonb_build_object('suggestion_id',v_item.id,
      'status',v_item.status,'idempotent_replay',true,'can_publish',false);
  end if;

  v_provider:=case p_source_key
    when 'youtube_ke' then 'youtube'
    when 'mdundo_ke' then 'mdundo'
    when 'apple_ke' then 'apple_music'
    when 'audiomack_ke' then 'audiomack'
    when 'shazam_ke' then 'shazam'
  end;
  v_artist:=nullif(btrim(o->>'artist'),'');
  insert into public.registry_provider_track_suggestions(
    requested_by,intake_origin,source_playlist_id,source_playlist_item_id,
    source_contribution_id,reserved_position,
    provider_key,provider_object_id,provider_url,provider_title,
    provider_artist_names,playback_kind,submitted_track_title,
    validation_snapshot,artist_resolution_mode,status
  ) values (
    v_user,'chart_studio',null,null,null,null,
    v_provider,nullif(o->>'provider_track_id',''),null,o->>'title',
    case when v_artist is null then array[]::text[]
      else array[v_artist] end,
    null,o->>'title',jsonb_build_object(
      'charts2_chart_origin_v1',true,
      'chart_source_key',p_source_key,'chart_receipt_id',r.id,
      'chart_original_sha256',r.original_sha256,'chart_rank',p_rank,
      'chart_artist_original',v_artist,
      'chart_provider_id_original',nullif(o->>'provider_track_id',''),
      'chart_observed_at',r.observed_at,
      'chart_source_endpoint',r.source_endpoint,
      'chart_method_revision',r.method_revision
    ),'unresolved','needs_review'
  ) returning * into v_item;
  return jsonb_build_object('suggestion_id',v_item.id,
    'status','needs_review','idempotent_replay',false,'can_publish',false);
end
$stage$;
revoke all on function public.admin_stage_charts2_track_intake_v1(
  text,uuid,text,integer) from public,anon,authenticated,service_role;
grant execute on function public.admin_stage_charts2_track_intake_v1(
  text,uuid,text,integer) to authenticated;

-- The existing finalizer will be copied by exact Production definition and
-- modified ONLY for the chart_studio no-Playlist guard and the additional
-- assert_charts2_intake_receipt_v1 call. It remains the sole finalizer.

-- START EXACT PRODUCTION FINALIZER REPLACEMENT

CREATE OR REPLACE FUNCTION public.admin_finalize_registry_track_intake_v1(p_suggestion_id uuid, p_registry_track_id uuid, p_review_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'platform_private', 'auth'
AS $function$
declare
  v_user_id uuid;
  v_suggestion public.registry_provider_track_suggestions%rowtype;
  v_track public.registry_tracks%rowtype;
  v_state jsonb;
  v_evidence_links_inserted integer:=0;
begin
  v_user_id:=platform_private.registry_track_intake_current_admin_v1();

  select suggestion.*
  into v_suggestion
  from public.registry_provider_track_suggestions suggestion
  where suggestion.id=p_suggestion_id
  for update;

  if not found then
    raise exception using errcode='P0002',
      message='Track Intake item does not exist.';
  end if;

  if v_suggestion.status='canonicalized' then
    if v_suggestion.canonicalized_track_id=p_registry_track_id
       and v_suggestion.canonical_track_id=p_registry_track_id
    then
      select track.*
      into v_track
      from public.registry_tracks track
      where track.id=p_registry_track_id;

      return jsonb_build_object(
        'suggestion_id',p_suggestion_id,
        'playlist_id',v_suggestion.source_playlist_id,
        'playlist_item_id',v_suggestion.source_playlist_item_id,
        'intake_origin',v_suggestion.intake_origin,
        'source_contribution_id',v_suggestion.source_contribution_id,
        'status','canonicalized',
        'registry_track_id',p_registry_track_id,
        'registry_track_title',v_track.title,
        'idempotent_replay',true
      );
    end if;

    raise exception using errcode='23514',
      message='Track Intake item was already finalized to a different Registry Track.';
  end if;

  if v_suggestion.status<>'needs_review' then
    raise exception using errcode='42501',
      message='Only Track Intake items awaiting review can be finalized.';
  end if;

  if v_suggestion.source_playlist_item_id is null
     and v_suggestion.intake_origin not in (
       'public_contribution','artist_submission','chart_studio'
     )
  then
    raise exception using errcode='23514',
      message='Track Intake item has not been materialized into its Playlist.';
  end if;

  if v_suggestion.intake_origin='chart_studio' then
    perform platform_private.assert_charts2_intake_receipt_v1(p_suggestion_id);
  end if;

  select track.*
  into v_track
  from public.registry_tracks track
  where track.id=p_registry_track_id
    and track.status='active';

  if not found then
    raise exception using errcode='23514',
      message='Selected Music Registry Track is unavailable.';
  end if;

  v_state:=
    platform_private.registry_track_intake_finalization_state_v1(
      p_suggestion_id,
      p_registry_track_id
    );

  if coalesce((v_state->>'ready')::boolean,false) is not true then
    raise exception using
      errcode='23514',
      message='Track Intake canonical child authority is incomplete.',
      detail=v_state::text;
  end if;

  -- Preserve the legacy review/evidence navigation surface. These rows are
  -- not canonical Registry provider-link authority.
  insert into public.provider_entity_links (
    registry_entity_type,
    registry_entity_id,
    provider,
    provider_entity_id,
    provider_url,
    match_status,
    confidence_score,
    created_at,
    updated_at
  )
  select
    'track',
    p_registry_track_id::text,
    evidence_link.provider,
    evidence_link.provider_entity_id,
    evidence_link.provider_url,
    'confirmed',
    evidence_link.confidence_score,
    now(),
    now()
  from public.provider_entity_links evidence_link
  where evidence_link.registry_entity_type='track'
    and evidence_link.registry_entity_id=p_suggestion_id::text
    and evidence_link.match_status='confirmed'
    and exists (
      select 1
      from public.registry_track_provider_links canonical_link
      where canonical_link.track_id=p_registry_track_id
        and canonical_link.provider_key=lower(evidence_link.provider)
        and canonical_link.provider_track_id=evidence_link.provider_entity_id
        and canonical_link.match_status='matched'
    )
    and not exists (
      select 1
      from public.provider_entity_links canonical_evidence
      where canonical_evidence.registry_entity_type='track'
        and canonical_evidence.registry_entity_id=p_registry_track_id::text
        and canonical_evidence.provider=evidence_link.provider
        and canonical_evidence.provider_entity_id=
            evidence_link.provider_entity_id
    );

  get diagnostics v_evidence_links_inserted=row_count;

  update public.registry_provider_track_suggestions suggestion
  set
    status='canonicalized',
    canonical_track_id=p_registry_track_id,
    canonicalized_track_id=p_registry_track_id,
    reviewed_by=v_user_id,
    reviewed_at=now(),
    review_note=nullif(btrim(p_review_note),'')
  where suggestion.id=p_suggestion_id
    and suggestion.status='needs_review';

  if not found then
    raise exception using errcode='23514',
      message='Track Intake workflow state changed before finalization.';
  end if;

  return jsonb_build_object(
    'suggestion_id',p_suggestion_id,
    'playlist_id',v_suggestion.source_playlist_id,
    'playlist_item_id',v_suggestion.source_playlist_item_id,
    'intake_origin',v_suggestion.intake_origin,
    'source_contribution_id',v_suggestion.source_contribution_id,
    'status','canonicalized',
    'registry_track_id',p_registry_track_id,
    'registry_track_title',v_track.title,
    'finalization_state',v_state,
    'evidence_links_inserted',v_evidence_links_inserted,
    'idempotent_replay',false
  );
end
$function$

-- END EXACT PRODUCTION FINALIZER REPLACEMENT
commit;
