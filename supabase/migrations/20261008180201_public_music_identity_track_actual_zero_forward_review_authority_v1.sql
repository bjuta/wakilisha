-- #1094 actual-zero forward review authority.
-- CLI-minted filename: 20261008180201_public_music_identity_track_actual_zero_forward_review_authority_v1.sql
-- Gate A: prospective review materialization only. No canonical Registry mutation.
begin;
set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'public-music-identity-track-actual-zero-forward-review-authority-v1',0
  )
);

do $preflight$
begin
  if to_regprocedure('platform_private.registry_subject_state_fingerprint(text,uuid)') is null
     or to_regprocedure('platform_private.registry_track_semantic_title_v1(text,text[])') is null
     or to_regprocedure('public.wk_slugify_text(text)') is null
     or to_regclass('public.registry_review_items') is null
     or to_regclass('public.registry_tracks') is null
     or to_regclass('public.registry_track_artists') is null
     or to_regclass('public.wk_chart_entries_v2') is null
     or to_regclass('public.community_threads') is null
  then
    raise exception 'STOP: exact public music identity review dependencies are missing';
  end if;

  if to_regprocedure(
       'public.admin_materialize_public_music_identity_feature_review_v1(uuid,text)'
     ) is not null
  then
    raise exception 'STOP: feature review materializer already exists; audit before replay';
  end if;
end
$preflight$;

create function public.admin_materialize_public_music_identity_feature_review_v1(
  p_track_id uuid,
  p_expected_track_state_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,auth,extensions
as $materialize$
declare
  v_user uuid:=auth.uid();
  v_track public.registry_tracks%rowtype;
  v_current_fingerprint text;
  v_target_slug text;
  v_featured_names text[];
  v_primary_ids uuid[];
  v_review_id uuid;
  v_review_key text;
begin
  if v_user is null
     or not coalesce(public.current_user_has_capability('manage_registry'),false)
  then
    raise exception using errcode='42501',
      message='manage_registry is required to materialize a Track identity review.';
  end if;

  if p_track_id is null
     or nullif(btrim(coalesce(p_expected_track_state_fingerprint,'')),'') is null
  then
    raise exception using errcode='22023',
      message='Exact Track ID and expected state fingerprint are required.';
  end if;

  select * into v_track
  from public.registry_tracks
  where id=p_track_id
  for update;

  if not found or v_track.status<>'active' then
    raise exception using errcode='23514',
      message='Only an active exact Registry Track can enter forward review.';
  end if;

  v_current_fingerprint:=
    platform_private.registry_subject_state_fingerprint('track',p_track_id);

  if v_current_fingerprint is distinct from p_expected_track_state_fingerprint then
    raise exception using errcode='40001',
      message='WK_STALE_TRACK_IDENTITY: Track state changed before review materialization.';
  end if;

  if v_track.slug is null
     or v_track.slug !~ '(^|-)(feat|ft|featuring)(-|$)' then
    raise exception using errcode='23514',
      message='Track is outside feature-bearing semantic-debt review materialization.';
  end if;

  if exists (
    select 1 from public.registry_review_items r
    where r.review_type='mizizi_data_hygiene'
      and r.entity_type='track'
      and r.source_id=p_track_id::text
      and r.source_payload->>'ruleId' in (
        'track_slug_identity_noise','track_slug_credit_evidence_gap'
      )
  ) then
    raise exception using errcode='23514',
      message='Existing or historical scoped review must be governed through its own authority.';
  end if;

  if exists (
    select 1 from public.registry_review_items r
    where r.review_type='mizizi_data_hygiene'
      and r.entity_type='track'
      and r.source_id=p_track_id::text
      and r.status='open'
      and r.source_payload->>'ruleId'='track_recording_identity_conflict'
      and r.source_payload->>'ruleVersion'='1.3.0'
  ) then
    raise exception using errcode='23514',
      message='Recording-identity conflict review already owns this Track.';
  end if;

  select
    coalesce(array_agg(credit.artist_name_text order by credit.credit_order nulls last,credit.id)
      filter (
        where credit.is_featured is true
          and nullif(btrim(credit.artist_name_text),'') is not null
      ),'{}'::text[]),
    coalesce(array_agg(distinct credit.artist_id)
      filter (
        where credit.is_primary is true
          and credit.artist_id is not null
      ),'{}'::uuid[])
  into v_featured_names,v_primary_ids
  from public.registry_track_artists credit
  where credit.track_id=p_track_id
    and coalesce(credit.status,'active')<>'archived';

  if cardinality(v_featured_names)=0
     or cardinality(v_primary_ids)=0
  then
    raise exception using errcode='23514',
      message='Feature review requires structured collaborator and principal Artist evidence.';
  end if;

  v_target_slug:=public.wk_slugify_text(
    platform_private.registry_track_semantic_title_v1(
      v_track.title,v_featured_names
    )
  );

  if nullif(v_target_slug,'') is null
     or v_target_slug=v_track.slug
     or v_target_slug ~ '(^|-)(feat|ft|featuring)(-|$)'
  then
    raise exception using errcode='23514',
      message='Semantic slug candidate is absent, unchanged, or still contains collaborator packaging.';
  end if;

  if exists (
    select 1 from public.registry_tracks peer
    where peer.id<>p_track_id
      and peer.status<>'archived'
      and peer.slug=v_target_slug
      and exists (
        select 1
        from public.registry_track_artists mine
        join public.registry_track_artists theirs
          on theirs.track_id=peer.id
         and theirs.artist_id=mine.artist_id
         and theirs.is_primary is true
         and coalesce(theirs.status,'active')<>'archived'
        where mine.track_id=p_track_id
          and mine.is_primary is true
          and mine.artist_id is not null
          and coalesce(mine.status,'active')<>'archived'
      )
  ) then
    raise exception using errcode='23514',
      message='A current Artist-scoped semantic route peer exists; recording conflict review required.';
  end if;

  -- Keep this first materialization lane bounded to Tracks without live projections.
  if exists (
    select 1 from public.wk_chart_entries_v2 c
    where c.canonical_track_id=p_track_id::text
  ) or exists (
    select 1 from public.community_threads c
    where c.entity_type='track' and c.entity_id=p_track_id::text
  ) then
    raise exception using errcode='23514',
      message='Projected Track requires the higher-evidence review lane.';
  end if;

  v_review_key:='mizizi:public-music-identity-forward-feature:'||p_track_id::text;

  insert into public.registry_review_items (
    review_key,entity_type,entity_id,review_type,priority,status,
    title,summary,source_table,source_id,source_payload,candidate_payload
  ) values (
    v_review_key,'track',p_track_id,'mizizi_data_hygiene','high','open',
    'Public Music Identity: feature-bearing semantic Track slug',
    'Human semantic identity review required. This review does not authorize a Track mutation.',
    'registry_tracks',p_track_id::text,
    jsonb_build_object(
      'agent','mizizi',
      'ruleId','track_slug_identity_noise',
      'ruleVersion','1.1.0',
      'fieldName','slug',
      'currentValue',v_track.slug,
      'confidence',0,
      'evidence',jsonb_build_object(
        'programmeIssue',1094,
        'programmeKey','public_music_identity_track_actual_zero_v1',
        'forwardReviewLane','new_feature_semantic_debt',
        'trackStateFingerprint',v_current_fingerprint,
        'featuredNames',to_jsonb(v_featured_names),
        'primaryArtistIds',to_jsonb(v_primary_ids),
        'materializedBy',v_user::text
      )
    ),
    jsonb_build_object(
      'proposedValue',v_target_slug,
      'disposition','review'
    )
  )
  returning id into v_review_id;

  return jsonb_build_object(
    'reviewId',v_review_id,
    'trackId',p_track_id,
    'currentSlug',v_track.slug,
    'proposedSlug',v_target_slug,
    'trackStateFingerprint',v_current_fingerprint,
    'canonicalEntitiesChanged',false,
    'humanDecisionRequired',true
  );
end
$materialize$;

revoke all on function
  public.admin_materialize_public_music_identity_feature_review_v1(uuid,text)
from public,anon,service_role;

grant execute on function
  public.admin_materialize_public_music_identity_feature_review_v1(uuid,text)
to authenticated;

do $postflight$
begin
  if has_function_privilege(
       'anon',
       'public.admin_materialize_public_music_identity_feature_review_v1(uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_materialize_public_music_identity_feature_review_v1(uuid,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_materialize_public_music_identity_feature_review_v1(uuid,text)',
       'EXECUTE'
     )
  then
    raise exception 'STOP: public identity review materializer privilege drift';
  end if;
end
$postflight$;

commit;
