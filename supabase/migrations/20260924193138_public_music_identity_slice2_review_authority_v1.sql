-- Public Music Identity Slice 2: bounded MIZIZI review authority.
-- Generated migration identity:
-- 20260924193138_public_music_identity_slice2_review_authority_v1.sql
--
-- This migration adds review creation authority only. It does not add Track,
-- Release, redirect, or canonical-write mutation authority.

do $preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version='20260920095334'
      and name='mizizi_stage_c_narrow_executor_transport_v1'
  ) then
    raise exception
      'STOP: MIZIZI Stage C narrow executor transport is required';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings
    where actor_key='mizizi'
      and executor_kind='database_role'
      and executor_key='mizizi_executor'
      and status='active'
  ) then
    raise exception
      'STOP: Slice 2 requires the active mizizi_executor binding';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings
    where actor_key='mizizi'
      and executor_kind='database_role'
      and executor_key='postgres'
      and status='disabled'
  ) then
    raise exception
      'STOP: Slice 2 requires the legacy postgres binding disabled';
  end if;

  if to_regprocedure(
       'mizizi_private.finding_fingerprint_v1(text,text,text,text,text,text,text)'
     ) is null
     or to_regprocedure(
       'mizizi_private.assert_executor_v1()'
     ) is null
  then
    raise exception
      'STOP: accepted MIZIZI fingerprint/executor authority is missing';
  end if;
end
$preflight$;

create function mizizi_private.public_music_identity_clean_title_slug_v1(
  p_title text
)
returns text
language sql
immutable
set search_path = pg_catalog, mizizi_private
as $
  select mizizi_private.slugify_identity_v1(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            mizizi_private.normalize_identity_text_v1(p_title),
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
      '[[:space:]]+(-|:)?[[:space:]]*\\y(feat(uring)?|ft)\\.?[[:space:]]+.*
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
    and track.status='active';

  if not found then
    raise exception using
      errcode='40001',
      message='Public Music Identity review target is not an active Track.';
  end if;

  if p_rule_id='track_slug_credit_evidence_gap' then
    if v_track.slug is distinct from p_current_value
       or v_track.slug !~* '(^|-)(feat|featuring|ft)(-|$)'
       or p_proposed_value is distinct from
          mizizi_private.public_music_identity_clean_title_slug_v1(
            v_track.title
          )
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

revoke all on function
  mizizi_private.queue_public_music_identity_review_v1(
    text,text,text,text,text,text,text,text,numeric,text,text,jsonb
  )
from public, anon, authenticated, service_role;

grant execute on function
  mizizi_private.queue_public_music_identity_review_v1(
    text,text,text,text,text,text,text,text,numeric,text,text,jsonb
  )
to mizizi_executor;

do $postflight$
begin
  if not has_function_privilege(
       'mizizi_executor',
       'mizizi_private.queue_public_music_identity_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: Slice 2 bounded review broker EXECUTE authority is missing';
  end if;

  if has_function_privilege(
       'anon',
       'mizizi_private.queue_public_music_identity_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'mizizi_private.queue_public_music_identity_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'mizizi_private.queue_public_music_identity_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: Slice 2 review broker leaked to browser/service roles';
  end if;

  if has_table_privilege(
       'mizizi_executor',
       'public.registry_review_items',
       'INSERT'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.registry_tracks',
       'UPDATE'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.registry_track_artists',
       'UPDATE'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.wk_slug_redirects',
       'INSERT'
     )
  then
    raise exception
      'STOP: Slice 2 granted direct mutation authority';
  end if;
end
$postflight$;
,
      '',
      'i'
    )
  )
$;

revoke all on function
  mizizi_private.public_music_identity_clean_title_slug_v1(text)
from public, anon, authenticated, service_role;

create function mizizi_private.queue_public_music_identity_review_v1(
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
    and track.status='active';

  if not found then
    raise exception using
      errcode='40001',
      message='Public Music Identity review target is not an active Track.';
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
        and mizizi_private.public_music_identity_clean_title_slug_v1(
              peer.title
            ) =
            mizizi_private.public_music_identity_clean_title_slug_v1(
              v_track.title
            )
    ) then
      raise exception using
        errcode='40001',
        message='Recording-identity conflict is no longer live.';
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

revoke all on function
  mizizi_private.queue_public_music_identity_review_v1(
    text,text,text,text,text,text,text,text,numeric,text,text,jsonb
  )
from public, anon, authenticated, service_role;

grant execute on function
  mizizi_private.queue_public_music_identity_review_v1(
    text,text,text,text,text,text,text,text,numeric,text,text,jsonb
  )
to mizizi_executor;

do $postflight$
begin
  if not has_function_privilege(
       'mizizi_executor',
       'mizizi_private.queue_public_music_identity_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: Slice 2 bounded review broker EXECUTE authority is missing';
  end if;

  if has_function_privilege(
       'anon',
       'mizizi_private.queue_public_music_identity_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'mizizi_private.queue_public_music_identity_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'mizizi_private.queue_public_music_identity_review_v1(text,text,text,text,text,text,text,text,numeric,text,text,jsonb)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: Slice 2 review broker leaked to browser/service roles';
  end if;

  if has_table_privilege(
       'mizizi_executor',
       'public.registry_review_items',
       'INSERT'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.registry_tracks',
       'UPDATE'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.registry_track_artists',
       'UPDATE'
     )
     or has_table_privilege(
       'mizizi_executor',
       'public.wk_slug_redirects',
       'INSERT'
     )
  then
    raise exception
      'STOP: Slice 2 granted direct mutation authority';
  end if;
end
$postflight$;
