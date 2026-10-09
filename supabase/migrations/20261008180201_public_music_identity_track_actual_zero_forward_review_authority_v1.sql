-- #1094 governed feature-review admission through the *existing* MIZIZI broker.
-- Canonical filename minted by Supabase CLI 2.107.0 on 8 October 2026.
-- No new public RPC, capability, canonical mutation engine or backfill.
begin;
set local statement_timeout='180s';
set local lock_timeout='5s';
select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('public-music-identity-track-actual-zero-forward-review-authority-v1',0)
);

do $preflight$
begin
  if to_regprocedure(
    'mizizi_private.queue_registry_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)'
  ) is null
     or to_regprocedure('platform_private.registry_track_semantic_title_v1(text,text[])') is null
     or to_regprocedure('public.wk_slugify_text(text)') is null
     or to_regclass('public.wk_chart_entries_v2') is null
     or to_regclass('public.community_threads') is null
  then
    raise exception 'WK_1094_GOVERNED_REVIEW_DEPENDENCY_MISSING';
  end if;
end
$preflight$;

create or replace function mizizi_private.queue_registry_review_v1(
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
  v_source_table text;
  v_title text;
  v_live_current text;
  v_expected_fingerprint text;
  v_track public.registry_tracks%rowtype;
  v_featured_names text[];
  v_semantic_slug text;
begin
  perform mizizi_private.assert_executor_v1();

  if p_entity_id !~
       '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
     or p_fingerprint !~ '^[0-9a-f]{64}$'
     or not (
       p_rule_version='1.2.0'
       or (
         p_rule_version='1.1.0'
         and p_entity_type='track'
         and p_rule_id='track_slug_identity_noise'
       )
     )
     or not (
       (
         p_entity_type='track'
         and p_rule_id='track_slug_identity_noise'
         and p_field_name='slug'
       )
       or
       (
         p_entity_type='release'
         and p_rule_id='release_slug_provider_packaging'
         and p_field_name='slug'
       )
     )
     or nullif(btrim(p_current_value),'') is null
     or nullif(btrim(p_proposed_value),'') is null
     or p_current_value=p_proposed_value
     or p_proposed_value !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     or octet_length(p_proposed_value) > 240
     or p_confidence < 0 or p_confidence > 1
     or p_severity <> 'high'
     or nullif(btrim(p_reason),'') is null
     or octet_length(p_reason) > 2000
     or jsonb_typeof(coalesce(p_evidence,'{}'::jsonb)) <> 'object'
     or octet_length(coalesce(p_evidence,'{}'::jsonb)::text) > 16384
  then
    raise exception using errcode='22023',
      message='Invalid bounded MIZIZI slug review payload.';
  end if;

  if p_entity_type='track' then
    select track.slug
    into v_live_current
    from public.registry_tracks track
    where track.id=p_entity_id::uuid
      and track.status='active';

    v_source_table := 'registry_tracks';
    v_title := 'MIZIZI found Track data that needs review';
  else
    select release.slug
    into v_live_current
    from public.registry_releases release
    where release.id=p_entity_id::uuid
      and release.status='active';

    v_source_table := 'registry_releases';
    v_title := 'MIZIZI found Release data that needs review';
  end if;

  if not found or v_live_current is distinct from p_current_value then
    raise exception using errcode='40001',
      message='MIZIZI review target changed since analysis.';
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
    raise exception using errcode='42501',
      message='MIZIZI review fingerprint does not match deterministic finding identity.';
  end if;


  -- #1094: only evidence-backed feature packaging is admitted under the
  -- established 1.1.0 human decision/finalization contract. This is a
  -- review operation, never authority to mutate the canonical Track.
  if p_rule_version='1.1.0' then
    select track.* into v_track
    from public.registry_tracks track
    where track.id=p_entity_id::uuid and track.status='active'
    for update;

    if not found
       or v_track.slug is distinct from p_current_value
       or v_track.slug !~ '(^|-)(feat|ft|featuring)(-|$)'
       or p_confidence < 0.95
    then
      raise exception using errcode='23514',
        message='WK_1094_FEATURE_REVIEW_EVIDENCE_DRIFT';
    end if;

    -- Replays of the same open fingerprint are idempotent.
    select previous.id into v_review_id
    from public.registry_review_items previous
    where previous.entity_type='track'
      and previous.review_type='mizizi_data_hygiene'
      and previous.source_id=p_entity_id
      and previous.status='open'
      and previous.review_key='mizizi:'||p_fingerprint
      and previous.source_payload->>'ruleId'='track_slug_identity_noise'
      and previous.source_payload->>'ruleVersion'='1.1.0'
    order by previous.created_at,previous.id
    limit 1
    for update;

    if found then
      return v_review_id;
    end if;

    if exists (
      select 1 from public.registry_review_items previous
      where previous.entity_type='track'
        and previous.review_type='mizizi_data_hygiene'
        and previous.source_id=p_entity_id
        and previous.source_payload->>'ruleId' in (
          'track_slug_identity_noise',
          'track_slug_credit_evidence_gap'
        )
        and previous.source_payload->>'ruleVersion' in ('1.1.0','1.2.0','1.3.0')
    ) then
      -- Do not reopen an earlier resolved human decision under a new hash.
      raise exception using errcode='23514',
        message='WK_1094_HISTORICAL_SCOPED_REVIEW_ALREADY_OWNS_TRACK';
    end if;

    if exists (
      select 1 from public.registry_review_items recording
      where recording.entity_type='track'
        and recording.review_type='mizizi_data_hygiene'
        and recording.source_id=p_entity_id
        and recording.status='open'
        and recording.source_payload->>'ruleId'='track_recording_identity_conflict'
    ) then
      raise exception using errcode='23514',
        message='WK_1094_RECORDING_REVIEW_ALREADY_OWNS_TRACK';
    end if;

    select coalesce(array_agg(c.artist_name_text order by c.credit_order nulls last,c.id),
                    '{}'::text[])
    into v_featured_names
    from public.registry_track_artists c
    where c.track_id=v_track.id
      and coalesce(c.status,'active')<>'archived'
      and c.is_featured is true
      and nullif(btrim(c.artist_name_text),'') is not null;

    if cardinality(v_featured_names)=0
       or not exists (
         select 1 from public.registry_track_artists primary_credit
         where primary_credit.track_id=v_track.id
           and coalesce(primary_credit.status,'active')<>'archived'
           and primary_credit.is_primary is true
           and primary_credit.artist_id is not null
       )
    then
      raise exception using errcode='23514',
        message='WK_1094_STRUCTURED_FEATURE_EVIDENCE_MISSING';
    end if;

    v_semantic_slug:=public.wk_slugify_text(
      platform_private.registry_track_semantic_title_v1(
        v_track.title,v_featured_names
      )
    );

    if nullif(v_semantic_slug,'') is null
       or v_semantic_slug is distinct from p_proposed_value
       or v_semantic_slug=v_track.slug
    then
      raise exception using errcode='23514',
        message='WK_1094_SEMANTIC_CANDIDATE_DRIFT';
    end if;

    if exists (
      select 1 from public.registry_tracks peer
      where peer.id<>v_track.id
        and peer.status<>'archived'
        and peer.slug=v_semantic_slug
        and exists (
          select 1
          from public.registry_track_artists mine
          join public.registry_track_artists theirs
            on theirs.track_id=peer.id
           and theirs.artist_id=mine.artist_id
           and theirs.is_primary is true
           and coalesce(theirs.status,'active')<>'archived'
          where mine.track_id=v_track.id
            and mine.artist_id is not null
            and mine.is_primary is true
            and coalesce(mine.status,'active')<>'archived'
        )
    ) then
      raise exception using errcode='23514',
        message='WK_1094_ARTIST_ROUTE_COLLISION_REQUIRES_RECORDING_REVIEW';
    end if;

    if exists (
      select 1 from public.wk_chart_entries_v2 c
      where c.canonical_track_id=v_track.id::text
    ) or exists (
      select 1 from public.community_threads c
      where c.entity_type='track' and c.entity_id=v_track.id::text
    ) then
      raise exception using errcode='23514',
        message='WK_1094_PROJECTED_TRACK_REQUIRES_HIGHER_EVIDENCE_LANE';
    end if;
  end if;

  select review.id
  into v_review_id
  from public.registry_review_items review
  where review.review_type='mizizi_data_hygiene'
    and review.status <> 'resolved'
    and review.entity_type=p_entity_type
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
    p_entity_type,
    p_entity_id::uuid,
    'mizizi_data_hygiene',
    'high',
    'open',
    v_title,
    btrim(p_reason),
    v_source_table,
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
    select id into v_review_id
    from public.registry_review_items
    where review_key='mizizi:' || p_fingerprint;
  end if;

  return v_review_id;
end
$$;

do $postflight$
declare v_definition text;
begin
  select pg_get_functiondef(
    'mizizi_private.queue_registry_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)'::regprocedure
  ) into v_definition;

  if position('WK_1094_HISTORICAL_SCOPED_REVIEW_ALREADY_OWNS_TRACK' in v_definition)=0
     or position('WK_1094_SEMANTIC_CANDIDATE_DRIFT' in v_definition)=0
     or not has_function_privilege(
       'mizizi_executor',
       'mizizi_private.queue_registry_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'mizizi_private.queue_registry_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'mizizi_private.queue_registry_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'mizizi_private.queue_registry_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)',
       'EXECUTE'
     )
  then
    raise exception 'WK_1094_GOVERNED_REVIEW_BROKER_AUTHORITY_DRIFT';
  end if;
end
$postflight$;
commit;
