begin;

do $preflight$
begin
  if to_regclass('public.wk_chart_playback_enrichment_runs') is null
     or to_regclass('public.wk_chart_playback_enrichment_items') is null
     or to_regclass('public.registry_track_provider_links') is null
     or to_regclass('public.registry_tracks') is null
     or to_regclass('platform_private.registry_evidence_assertions') is null
     or to_regclass('platform_private.registry_operation_types') is null
     or to_regclass('platform_private.registry_execution_grants') is null
     or to_regclass('platform_private.registry_execution_grant_targets') is null
     or to_regclass('platform_private.registry_mutation_operations') is null
     or to_regclass('platform_private.registry_operation_write_events') is null
     or to_regprocedure('platform_private.begin_registry_mutation_operation(text,uuid)') is null
     or to_regprocedure('platform_private.registry_subject_state_fingerprint(text,uuid)') is null
     or to_regprocedure('platform_private.registry_plan_fingerprint(jsonb)') is null
     or to_regprocedure('public.current_user_has_capability(text)') is null
  then
    raise exception 'STOP: accepted Registry governance foundation is missing';
  end if;

  if exists (
       select 1
       from platform_private.registry_operation_types
       where operation_key='registry.track.provider_link.admit'
     )
     or exists (
       select 1
       from public.capability_definitions
       where capability_key='admit_registry_track_provider_link'
     )
     or to_regprocedure('platform_private.record_registry_chart_playback_provider_evidence_v1(uuid)') is not null
     or to_regprocedure('platform_private.issue_registry_chart_playback_provider_grant_v1(uuid,uuid)') is not null
     or to_regprocedure('platform_private.execute_registry_chart_playback_provider_v1(uuid)') is not null
     or to_regprocedure('platform_private.verify_registry_chart_playback_provider_v1(uuid)') is not null
     or to_regprocedure('public.chart_admit_track_provider_link_v1(uuid)') is not null
  then
    raise exception 'STOP: Chart Playback Provider V1 authority already exists';
  end if;
end
$preflight$;

insert into public.capability_definitions (
  capability_key,
  label,
  description,
  domain
)
values (
  'admit_registry_track_provider_link',
  'Admit Registry Track provider link',
  'Admit one evidence-backed Track provider identity/link through the typed Registry broker.',
  'registry'
);

insert into platform_private.registry_operation_types (
  operation_key,
  operation_version,
  capability_key,
  risk_class,
  allowed_subject_types,
  requires_existing_target,
  max_targets,
  max_rows_ceiling,
  max_grant_ttl_seconds,
  requires_human_approval,
  requires_verifier,
  enabled,
  description
)
values (
  'registry.track.provider_link.admit',
  1,
  'admit_registry_track_provider_link',
  'medium',
  array['track']::text[],
  true,
  1,
  1,
  300,
  true,
  true,
  false,
  'Admit one exact evidence-backed provider link and flat provider identity keys for one existing Registry Track.'
);

update platform_private.system_actors
set capability_profile =
  jsonb_set(
    coalesce(capability_profile,'{}'::jsonb),
    '{provider_metadata_family}',
    '["registry.track.provider_link.admit/v1"]'::jsonb,
    true
  )
where actor_key='registry_chart_admission'
  and status='active';

create function platform_private.record_registry_chart_playback_provider_evidence_v1(
  p_item_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_item public.wk_chart_playback_enrichment_items%rowtype;
  v_run public.wk_chart_playback_enrichment_runs%rowtype;
  v_claim jsonb;
  v_source_payload jsonb;
  v_source_payload_fingerprint text;
  v_assertion_fingerprint text;
  v_assertion_id uuid;
  v_provider_artist_ids jsonb;
begin
  if v_user_id is null or p_item_id is null then
    raise exception using errcode='22023',
      message='Authenticated user and enrichment item are required.';
  end if;

  if not coalesce(public.current_user_has_capability('manage_charts'),false) then
    raise exception using errcode='42501',
      message='manage_charts is required.';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings binding
    where binding.actor_key='registry_chart_admission'
      and binding.executor_kind='database_role'
      and binding.executor_key=session_user
      and binding.status='active'
  ) then
    raise exception using errcode='42501',
      message='Current transport is not the Registry chart admission broker.';
  end if;

  select item.*
  into v_item
  from public.wk_chart_playback_enrichment_items item
  where item.id=p_item_id
  for update;

  if not found then
    raise exception using errcode='P0002',
      message='Chart playback enrichment item not found.';
  end if;

  select run.*
  into v_run
  from public.wk_chart_playback_enrichment_runs run
  where run.id=v_item.run_id
  for update;

  if not found
     or v_run.requested_by is distinct from v_user_id
     or not v_run.write_mode
     or v_run.provider <> 'apple_music'
     or v_item.provider <> 'apple_music'
     or v_item.status <> 'accepted'
     or v_item.registry_track_id is null
     or nullif(btrim(v_item.provider_track_id),'') is null
     or v_item.confidence is null
     or v_item.confidence < v_run.min_auto_accept
  then
    raise exception using errcode='42501',
      message='Enrichment item is not an accepted caller-bound Apple Music write candidate.';
  end if;

  if not exists (
    select 1
    from public.registry_tracks track
    where track.id=v_item.registry_track_id
  ) then
    raise exception using errcode='P0002',
      message='Registry Track target does not exist.';
  end if;

  select coalesce(jsonb_agg(element->>'id' order by ordinality),'[]'::jsonb)
  into v_provider_artist_ids
  from jsonb_array_elements(
    coalesce(
      v_item.raw_match_payload #> '{relationships,artists,data}',
      '[]'::jsonb
    )
  ) with ordinality as artist(element,ordinality)
  where nullif(btrim(element->>'id'),'') is not null;

  v_claim := jsonb_build_object(
    'provider_key','apple_music',
    'provider_track_id',btrim(v_item.provider_track_id),
    'provider_release_id',
      nullif(btrim(v_item.raw_match_payload #>> '{relationships,albums,data,0,id}'),''),
    'provider_artist_ids',v_provider_artist_ids,
    'isrc',nullif(upper(btrim(v_item.raw_match_payload #>> '{attributes,isrc}')),''),
    'preview_url',nullif(btrim(v_item.preview_url),''),
    'artwork_url',nullif(btrim(v_item.artwork_url),''),
    'duration_ms',
      case
        when (v_item.raw_match_payload #>> '{attributes,durationInMillis}') ~ '^[0-9]+$'
          then (v_item.raw_match_payload #>> '{attributes,durationInMillis}')::integer
        else null
      end,
    'storefront',lower(btrim(v_item.storefront)),
    'match_method',coalesce(nullif(btrim(v_item.match_method),''),'unknown'),
    'match_confidence',v_item.confidence,
    'match_status','matched',
    'raw_payload_fingerprint',
      encode(
        extensions.digest(
          coalesce(v_item.raw_match_payload,'{}'::jsonb)::text,
          'sha256'
        ),
        'hex'
      )
  );

  v_source_payload := jsonb_build_object(
    'run_id',v_run.id,
    'item_id',v_item.id,
    'chart_entry_id',v_item.chart_entry_id,
    'registry_track_id',v_item.registry_track_id,
    'provider',v_item.provider,
    'storefront',v_item.storefront,
    'status',v_item.status,
    'match_method',v_item.match_method,
    'confidence',v_item.confidence,
    'provider_track_id',v_item.provider_track_id,
    'provider_url',v_item.provider_url,
    'preview_url',v_item.preview_url,
    'artwork_url',v_item.artwork_url,
    'raw_match_payload',v_item.raw_match_payload
  );

  v_source_payload_fingerprint := encode(
    extensions.digest(v_source_payload::text,'sha256'),
    'hex'
  );

  v_assertion_fingerprint := encode(
    extensions.digest(
      jsonb_build_object(
        'subject_type','track',
        'subject_id',v_item.registry_track_id::text,
        'claim_key','registry.track.provider_link',
        'claim_payload',v_claim,
        'trust_class','EXTERNAL_EVIDENCE',
        'source_kind','chart_playback_enrichment',
        'source_ref','chart-playback:item:'||v_item.id::text,
        'source_payload_fingerprint',v_source_payload_fingerprint,
        'recorded_by_principal_key','user:'||v_user_id::text
      )::text,
      'sha256'
    ),
    'hex'
  );

  insert into platform_private.registry_evidence_assertions (
    subject_type,
    subject_id,
    claim_key,
    claim_payload,
    trust_class,
    source_kind,
    source_ref,
    source_payload_fingerprint,
    observed_at,
    recorded_by_principal_key,
    assertion_fingerprint
  )
  values (
    'track',
    v_item.registry_track_id,
    'registry.track.provider_link',
    v_claim,
    'EXTERNAL_EVIDENCE',
    'chart_playback_enrichment',
    'chart-playback:item:'||v_item.id::text,
    v_source_payload_fingerprint,
    now(),
    'user:'||v_user_id::text,
    v_assertion_fingerprint
  )
  on conflict (assertion_fingerprint)
  do nothing
  returning id into v_assertion_id;

  if v_assertion_id is null then
    select assertion.id
    into v_assertion_id
    from platform_private.registry_evidence_assertions assertion
    where assertion.assertion_fingerprint=v_assertion_fingerprint;
  end if;

  return v_assertion_id;
end;
$$;

create function platform_private.issue_registry_chart_playback_provider_grant_v1(
  p_evidence_assertion_id uuid,
  p_item_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_item public.wk_chart_playback_enrichment_items%rowtype;
  v_run public.wk_chart_playback_enrichment_runs%rowtype;
  v_existing platform_private.registry_execution_grants%rowtype;
  v_state_fingerprint text;
  v_plan jsonb;
  v_plan_fingerprint text;
  v_target_fingerprint text;
  v_idempotency_key text;
  v_grant_id uuid;
begin
  if v_user_id is null
     or p_evidence_assertion_id is null
     or p_item_id is null
     or not coalesce(public.current_user_has_capability('manage_charts'),false)
  then
    raise exception using errcode='42501',
      message='manage_charts caller authority is required.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=p_evidence_assertion_id;

  if not found
     or v_evidence.subject_type<>'track'
     or v_evidence.claim_key<>'registry.track.provider_link'
     or v_evidence.trust_class<>'EXTERNAL_EVIDENCE'
     or v_evidence.recorded_by_principal_key<>'user:'||v_user_id::text
     or v_evidence.source_ref<>'chart-playback:item:'||p_item_id::text
  then
    raise exception using errcode='42501',
      message='Evidence is not caller-bound Chart playback provider authority.';
  end if;

  select item.*
  into v_item
  from public.wk_chart_playback_enrichment_items item
  where item.id=p_item_id
  for update;

  select run.*
  into v_run
  from public.wk_chart_playback_enrichment_runs run
  where run.id=v_item.run_id
  for update;

  if not found
     or v_run.requested_by is distinct from v_user_id
     or not v_run.write_mode
     or v_item.status<>'accepted'
     or v_item.registry_track_id is distinct from v_evidence.subject_id
     or btrim(v_item.provider_track_id) is distinct from
        v_evidence.claim_payload->>'provider_track_id'
  then
    raise exception using errcode='42501',
      message='Chart playback evidence no longer matches the locked accepted item.';
  end if;

  v_state_fingerprint :=
    platform_private.registry_subject_state_fingerprint(
      'track',
      v_evidence.subject_id
    );

  if v_state_fingerprint is null then
    raise exception using errcode='P0002',
      message='Registry Track state fingerprint is unavailable.';
  end if;

  v_plan := jsonb_build_object(
    'operation_key','registry.track.provider_link.admit',
    'operation_version',1,
    'item_id',p_item_id::text,
    'track_id',v_evidence.subject_id::text,
    'evidence_assertion_id',v_evidence.id::text,
    'evidence_assertion_fingerprint',v_evidence.assertion_fingerprint,
    'claim_payload',v_evidence.claim_payload,
    'expected_state_fingerprint',v_state_fingerprint,
    'trust_class',v_evidence.trust_class,
    'policy_ruleset_version','registry-chart-playback-provider-v1'
  );

  v_plan_fingerprint :=
    platform_private.registry_plan_fingerprint(v_plan);

  v_target_fingerprint := encode(
    extensions.digest(
      jsonb_build_array(
        jsonb_build_object(
          'subject_type','track',
          'subject_id',v_evidence.subject_id::text,
          'expected_state_fingerprint',v_state_fingerprint
        )
      )::text,
      'sha256'
    ),
    'hex'
  );

  v_idempotency_key := 'chart-playback-provider:'||p_item_id::text;

  select execution_grant.*
  into v_existing
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.actor_key='registry_chart_admission'
    and execution_grant.operation_key='registry.track.provider_link.admit'
    and execution_grant.operation_version=1
    and execution_grant.idempotency_key=v_idempotency_key;

  if found then
    if v_existing.issued_by_user_id<>v_user_id
       or v_existing.plan_fingerprint<>v_plan_fingerprint
       or v_existing.target_set_fingerprint<>v_target_fingerprint
    then
      raise exception using errcode='23505',
        message='Chart playback provider idempotency key is bound to different authority.';
    end if;
    return v_existing.id;
  end if;

  insert into platform_private.registry_execution_grants (
    actor_key,
    capability_key,
    system_actor_capability_grant_id,
    operation_key,
    operation_version,
    plan_payload,
    plan_fingerprint,
    target_set_fingerprint,
    max_rows,
    idempotency_key,
    status,
    issued_by_user_id,
    issued_by_principal_key,
    policy_ruleset_version,
    required_user_capability_key,
    issued_at,
    expires_at
  )
  values (
    'registry_chart_admission',
    'admit_registry_track_provider_link',
    null,
    'registry.track.provider_link.admit',
    1,
    v_plan,
    v_plan_fingerprint,
    v_target_fingerprint,
    1,
    v_idempotency_key,
    'active',
    v_user_id,
    'user:'||v_user_id::text,
    'registry-chart-playback-provider-v1',
    'manage_charts',
    now(),
    now()+interval '5 minutes'
  )
  returning id into v_grant_id;

  insert into platform_private.registry_execution_grant_targets (
    execution_grant_id,
    subject_type,
    subject_id,
    expected_state_fingerprint
  )
  values (
    v_grant_id,
    'track',
    v_evidence.subject_id,
    v_state_fingerprint
  );

  return v_grant_id;
end;
$$;

create function platform_private.execute_registry_chart_playback_provider_v1(
  p_execution_grant_id uuid
)
returns table (
  operation_id uuid,
  operation_status text,
  verifier_status text,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, extensions
as $$
declare
  v_begin record;
  v_operation platform_private.registry_mutation_operations%rowtype;
  v_grant platform_private.registry_execution_grants%rowtype;
  v_target platform_private.registry_execution_grant_targets%rowtype;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_item public.wk_chart_playback_enrichment_items%rowtype;
  v_track public.registry_tracks%rowtype;
  v_plan jsonb;
  v_claim jsonb;
  v_provider_link public.registry_track_provider_links%rowtype;
  v_provider_link_id uuid;
  v_raw_fingerprint text;
  v_provider_artist_ids text[];
  v_link_event_id uuid;
  v_track_event_id uuid;
  v_rows integer;
begin
  select *
  into v_begin
  from platform_private.begin_registry_mutation_operation(
    'registry_chart_admission',
    p_execution_grant_id
  );

  select operation.*
  into v_operation
  from platform_private.registry_mutation_operations operation
  where operation.id=v_begin.operation_id
  for update;

  if v_begin.idempotent_replay
     and v_operation.status='succeeded'
  then
    operation_id:=v_operation.id;
    operation_status:=v_operation.status;
    verifier_status:=v_operation.verifier_status;
    idempotent_replay:=true;
    return next;
    return;
  end if;

  select execution_grant.*
  into v_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.id=p_execution_grant_id;

  if not found
     or v_operation.status<>'authorized'
     or v_grant.actor_key<>'registry_chart_admission'
     or v_grant.capability_key<>'admit_registry_track_provider_link'
     or v_grant.operation_key<>'registry.track.provider_link.admit'
     or v_grant.operation_version<>1
     or v_grant.max_rows<>1
     or v_grant.policy_ruleset_version<>'registry-chart-playback-provider-v1'
  then
    raise exception using errcode='42501',
      message='Execution grant is not Chart Playback Provider V1 authority.';
  end if;

  select target.*
  into v_target
  from platform_private.registry_execution_grant_targets target
  where target.execution_grant_id=v_grant.id;

  if not found
     or v_target.subject_type<>'track'
     or v_target.expected_state_fingerprint is null
     or (
       select count(*)
       from platform_private.registry_execution_grant_targets t
       where t.execution_grant_id=v_grant.id
     )<>1
  then
    raise exception using errcode='42501',
      message='Chart Playback Provider V1 requires one exact existing Track target.';
  end if;

  v_plan:=v_grant.plan_payload;
  v_claim:=v_plan->'claim_payload';

  if v_plan->>'operation_key'<>'registry.track.provider_link.admit'
     or (v_plan->>'operation_version')::integer<>1
     or v_plan->>'track_id'<>v_target.subject_id::text
     or v_plan->>'expected_state_fingerprint'<>v_target.expected_state_fingerprint
     or v_plan->>'policy_ruleset_version'<>'registry-chart-playback-provider-v1'
     or v_claim->>'provider_key'<>'apple_music'
     or nullif(btrim(v_claim->>'provider_track_id'),'') is null
  then
    raise exception using errcode='42501',
      message='Chart Playback Provider V1 plan is malformed.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=(v_plan->>'evidence_assertion_id')::uuid;

  if not found
     or v_evidence.subject_type<>'track'
     or v_evidence.subject_id<>v_target.subject_id
     or v_evidence.claim_key<>'registry.track.provider_link'
     or v_evidence.assertion_fingerprint<>v_plan->>'evidence_assertion_fingerprint'
     or v_evidence.claim_payload<>v_claim
  then
    raise exception using errcode='42501',
      message='Bound provider-link evidence no longer satisfies the exact plan.';
  end if;

  select item.*
  into v_item
  from public.wk_chart_playback_enrichment_items item
  where item.id=(v_plan->>'item_id')::uuid
  for update;

  if not found
     or v_item.registry_track_id<>v_target.subject_id
     or v_item.status<>'accepted'
     or btrim(v_item.provider_track_id)<>v_claim->>'provider_track_id'
  then
    raise exception using errcode='42501',
      message='Accepted enrichment item no longer satisfies the exact provider-link plan.';
  end if;

  v_raw_fingerprint := encode(
    extensions.digest(
      coalesce(v_item.raw_match_payload,'{}'::jsonb)::text,
      'sha256'
    ),
    'hex'
  );

  if v_raw_fingerprint<>v_claim->>'raw_payload_fingerprint' then
    raise exception using errcode='42501',
      message='Provider payload changed after evidence was frozen.';
  end if;

  select track.*
  into v_track
  from public.registry_tracks track
  where track.id=v_target.subject_id
  for update;

  if not found
     or platform_private.registry_subject_state_fingerprint(
          'track',
          v_track.id
        )<>v_target.expected_state_fingerprint
  then
    raise exception using errcode='40001',
      message='Registry Track changed after the exact provider-link grant was issued.';
  end if;

  select coalesce(array_agg(value order by ordinality),'{}'::text[])
  into v_provider_artist_ids
  from jsonb_array_elements_text(
    coalesce(v_claim->'provider_artist_ids','[]'::jsonb)
  ) with ordinality as artist(value,ordinality);

  select link.*
  into v_provider_link
  from public.registry_track_provider_links link
  where link.provider_key='apple_music'
    and link.provider_track_id=v_claim->>'provider_track_id'
  for update;

  if found and v_provider_link.track_id<>v_target.subject_id then
    raise exception using errcode='23505',
      message='Apple Music provider identity is already bound to another Registry Track.';
  end if;

  update platform_private.registry_mutation_operations
  set status='executing',
      started_at=coalesce(started_at,now()),
      updated_at=now()
  where id=v_operation.id;

  insert into public.registry_track_provider_links (
    track_id,
    provider_key,
    provider_track_id,
    provider_release_id,
    provider_artist_ids,
    isrc,
    preview_url,
    artwork_url,
    duration_ms,
    storefront,
    match_method,
    match_confidence,
    match_status,
    raw_payload,
    last_checked_at,
    updated_at
  )
  values (
    v_target.subject_id,
    'apple_music',
    v_claim->>'provider_track_id',
    nullif(v_claim->>'provider_release_id',''),
    v_provider_artist_ids,
    nullif(v_claim->>'isrc',''),
    nullif(v_claim->>'preview_url',''),
    nullif(v_claim->>'artwork_url',''),
    case
      when v_claim->>'duration_ms' is null then null
      else (v_claim->>'duration_ms')::integer
    end,
    nullif(v_claim->>'storefront',''),
    coalesce(nullif(v_claim->>'match_method',''),'unknown'),
    (v_claim->>'match_confidence')::numeric,
    'matched',
    coalesce(v_item.raw_match_payload,'{}'::jsonb),
    now(),
    now()
  )
  on conflict (track_id,provider_key,provider_track_id)
  do update set
    provider_release_id=excluded.provider_release_id,
    provider_artist_ids=excluded.provider_artist_ids,
    isrc=excluded.isrc,
    preview_url=excluded.preview_url,
    artwork_url=excluded.artwork_url,
    duration_ms=excluded.duration_ms,
    storefront=excluded.storefront,
    match_method=excluded.match_method,
    match_confidence=excluded.match_confidence,
    match_status='matched',
    raw_payload=excluded.raw_payload,
    last_checked_at=now(),
    updated_at=now()
  returning id into v_provider_link_id;

  update public.registry_tracks
  set metadata=
        coalesce(metadata,'{}'::jsonb)
        || jsonb_build_object(
          'apple_music_track_id',v_claim->>'provider_track_id',
          'apple_music_catalog_id',v_claim->>'provider_track_id'
        ),
      updated_at=now()
  where id=v_target.subject_id;

  get diagnostics v_rows=row_count;

  if v_rows<>1 then
    raise exception using errcode='40001',
      message='Track provider-link admission lost its one-row canonical target.';
  end if;

  insert into public.registry_canonical_write_events (
    registry_entity_type,
    registry_entity_id,
    source_suggestion_id,
    source_table,
    field_name,
    target_path,
    before_value,
    after_value,
    action,
    status,
    actor
  )
  values (
    'track',
    v_target.subject_id::text,
    v_evidence.id::text,
    'platform_private.registry_evidence_assertions',
    'provider_link.apple_music',
    'public.registry_track_provider_links',
    case
      when v_provider_link.id is null then jsonb_build_object('value',null)
      else to_jsonb(v_provider_link)
    end,
    jsonb_build_object(
      'provider_link_id',v_provider_link_id,
      'provider_track_id',v_claim->>'provider_track_id',
      'evidence_assertion_id',v_evidence.id,
      'policy_ruleset_version','registry-chart-playback-provider-v1'
    ),
    'admit_provider_link',
    'succeeded',
    'system:registry_chart_admission'
  )
  returning id into v_link_event_id;

  insert into public.registry_canonical_write_events (
    registry_entity_type,
    registry_entity_id,
    source_suggestion_id,
    source_table,
    field_name,
    target_path,
    before_value,
    after_value,
    action,
    status,
    actor
  )
  values (
    'track',
    v_target.subject_id::text,
    v_evidence.id::text,
    'platform_private.registry_evidence_assertions',
    'metadata.apple_music_identity',
    'public.registry_tracks.metadata',
    jsonb_build_object(
      'apple_music_track_id',v_track.metadata->>'apple_music_track_id',
      'apple_music_catalog_id',v_track.metadata->>'apple_music_catalog_id'
    ),
    jsonb_build_object(
      'apple_music_track_id',v_claim->>'provider_track_id',
      'apple_music_catalog_id',v_claim->>'provider_track_id',
      'evidence_assertion_id',v_evidence.id,
      'policy_ruleset_version','registry-chart-playback-provider-v1'
    ),
    'admit_provider_link',
    'succeeded',
    'system:registry_chart_admission'
  )
  returning id into v_track_event_id;

  insert into platform_private.registry_operation_write_events (
    operation_id,
    canonical_write_event_id
  )
  values
    (v_operation.id,v_link_event_id),
    (v_operation.id,v_track_event_id);

  update platform_private.registry_mutation_operations
  set affected_rows=1,
      status='succeeded',
      verifier_status='pending',
      result_payload=jsonb_build_object(
        'track_id',v_target.subject_id,
        'provider_link_id',v_provider_link_id,
        'provider_track_id',v_claim->>'provider_track_id',
        'evidence_assertion_id',v_evidence.id,
        'canonical_write_event_ids',
          jsonb_build_array(v_link_event_id,v_track_event_id)
      ),
      completed_at=now(),
      updated_at=now()
  where id=v_operation.id;

  operation_id:=v_operation.id;
  operation_status:='succeeded';
  verifier_status:='pending';
  idempotent_replay:=v_begin.idempotent_replay;
  return next;
end;
$$;

create function platform_private.verify_registry_chart_playback_provider_v1(
  p_operation_id uuid
)
returns table (
  operation_id uuid,
  verifier_status text
)
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, extensions
as $$
declare
  v_operation platform_private.registry_mutation_operations%rowtype;
  v_grant platform_private.registry_execution_grants%rowtype;
  v_target platform_private.registry_execution_grant_targets%rowtype;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_plan jsonb;
  v_claim jsonb;
  v_link public.registry_track_provider_links%rowtype;
  v_link_count integer;
  v_valid_event_count integer;
  v_raw_fingerprint text;
  v_failure text;
begin
  select operation.*
  into v_operation
  from platform_private.registry_mutation_operations operation
  where operation.id=p_operation_id
  for update;

  if not found
     or v_operation.operation_key<>'registry.track.provider_link.admit'
     or v_operation.operation_version<>1
     or v_operation.capability_key<>'admit_registry_track_provider_link'
  then
    raise exception using errcode='P0002',
      message='Chart Playback Provider V1 operation not found.';
  end if;

  if v_operation.verifier_status='passed' then
    operation_id:=v_operation.id;
    verifier_status:='passed';
    return next;
    return;
  end if;

  if v_operation.status<>'succeeded'
     or v_operation.affected_rows<>1
  then
    v_failure:='operation_not_succeeded_exactly_once';
  end if;

  select execution_grant.*
  into v_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.id=v_operation.execution_grant_id;

  if v_failure is null and not found then
    v_failure:='execution_grant_missing';
  end if;

  if v_failure is null then
    v_plan:=v_grant.plan_payload;
    v_claim:=v_plan->'claim_payload';

    select target.*
    into v_target
    from platform_private.registry_execution_grant_targets target
    where target.execution_grant_id=v_grant.id
      and target.subject_type='track';

    if not found then
      v_failure:='exact_track_target_missing';
    end if;
  end if;

  if v_failure is null then
    select assertion.*
    into v_evidence
    from platform_private.registry_evidence_assertions assertion
    where assertion.id=(v_plan->>'evidence_assertion_id')::uuid
      and assertion.subject_type='track'
      and assertion.subject_id=v_target.subject_id
      and assertion.claim_key='registry.track.provider_link'
      and assertion.assertion_fingerprint=
          v_plan->>'evidence_assertion_fingerprint';

    if not found or v_evidence.claim_payload<>v_claim then
      v_failure:='bound_evidence_missing';
    end if;
  end if;

  if v_failure is null then
    select link.*
    into v_link
    from public.registry_track_provider_links link
    where link.track_id=v_target.subject_id
      and link.provider_key='apple_music'
      and link.provider_track_id=v_claim->>'provider_track_id';

    if not found
       or v_link.provider_release_id is distinct from
          nullif(v_claim->>'provider_release_id','')
       or to_jsonb(v_link.provider_artist_ids) is distinct from
          coalesce(v_claim->'provider_artist_ids','[]'::jsonb)
       or v_link.isrc is distinct from nullif(v_claim->>'isrc','')
       or v_link.preview_url is distinct from nullif(v_claim->>'preview_url','')
       or v_link.artwork_url is distinct from nullif(v_claim->>'artwork_url','')
       or v_link.duration_ms is distinct from
          (
            case
              when v_claim->>'duration_ms' is null then null
              else (v_claim->>'duration_ms')::integer
            end
          )
       or v_link.storefront is distinct from nullif(v_claim->>'storefront','')
       or v_link.match_method is distinct from
          coalesce(nullif(v_claim->>'match_method',''),'unknown')
       or v_link.match_confidence is distinct from
          (v_claim->>'match_confidence')::numeric
       or v_link.match_status<>'matched'
    then
      v_failure:='provider_link_state_mismatch';
    end if;
  end if;

  if v_failure is null then
    v_raw_fingerprint:=encode(
      extensions.digest(
        coalesce(v_link.raw_payload,'{}'::jsonb)::text,
        'sha256'
      ),
      'hex'
    );

    if v_raw_fingerprint<>v_claim->>'raw_payload_fingerprint' then
      v_failure:='provider_payload_fingerprint_mismatch';
    end if;
  end if;

  if v_failure is null
     and not exists (
       select 1
       from public.registry_tracks track
       where track.id=v_target.subject_id
         and track.metadata->>'apple_music_track_id'=
             v_claim->>'provider_track_id'
         and track.metadata->>'apple_music_catalog_id'=
             v_claim->>'provider_track_id'
     )
  then
    v_failure:='canonical_track_provider_identity_mismatch';
  end if;

  if v_failure is null then
    select count(*)::integer
    into v_link_count
    from platform_private.registry_operation_write_events link
    where link.operation_id=v_operation.id;

    select count(*)::integer
    into v_valid_event_count
    from platform_private.registry_operation_write_events link
    join public.registry_canonical_write_events event
      on event.id=link.canonical_write_event_id
    where link.operation_id=v_operation.id
      and event.registry_entity_type='track'
      and event.registry_entity_id=v_target.subject_id::text
      and event.source_suggestion_id=v_evidence.id::text
      and event.source_table='platform_private.registry_evidence_assertions'
      and event.action='admit_provider_link'
      and event.status='succeeded'
      and event.actor='system:registry_chart_admission'
      and event.field_name in (
        'provider_link.apple_music',
        'metadata.apple_music_identity'
      );

    if v_link_count<>2 or v_valid_event_count<>2 then
      v_failure:='canonical_write_event_causality_mismatch';
    end if;
  end if;

  if v_failure is null then
    update platform_private.registry_mutation_operations
    set verifier_status='passed',
        result_payload=
          result_payload ||
          jsonb_build_object(
            'verification',
            jsonb_build_object(
              'status','passed',
              'verified_at',now()
            )
          ),
        updated_at=now()
    where id=v_operation.id;

    operation_id:=v_operation.id;
    verifier_status:='passed';
    return next;
    return;
  end if;

  update platform_private.registry_mutation_operations
  set verifier_status='failed',
      error_code='chart_playback_provider_verification_failed',
      error_message=v_failure,
      result_payload=
        result_payload ||
        jsonb_build_object(
          'verification',
          jsonb_build_object(
            'status','failed',
            'reason',v_failure,
            'verified_at',now()
          )
        ),
      updated_at=now()
  where id=v_operation.id;

  operation_id:=v_operation.id;
  verifier_status:='failed';
  return next;
end;
$$;

create function public.chart_admit_track_provider_link_v1(
  p_enrichment_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_evidence_id uuid;
  v_grant_id uuid;
  v_exec record;
  v_verify record;
begin
  if auth.uid() is null
     or not coalesce(public.current_user_has_capability('manage_charts'),false)
  then
    raise exception using errcode='42501',
      message='manage_charts is required.';
  end if;

  v_evidence_id :=
    platform_private.record_registry_chart_playback_provider_evidence_v1(
      p_enrichment_item_id
    );

  v_grant_id :=
    platform_private.issue_registry_chart_playback_provider_grant_v1(
      v_evidence_id,
      p_enrichment_item_id
    );

  select *
  into v_exec
  from platform_private.execute_registry_chart_playback_provider_v1(
    v_grant_id
  );

  select *
  into v_verify
  from platform_private.verify_registry_chart_playback_provider_v1(
    v_exec.operation_id
  );

  if v_verify.verifier_status<>'passed' then
    raise exception using errcode='40001',
      message='Chart playback provider verifier failed.';
  end if;

  return jsonb_build_object(
    'operation_id',v_exec.operation_id,
    'operation_status',v_exec.operation_status,
    'verifier_status',v_verify.verifier_status,
    'idempotent_replay',v_exec.idempotent_replay,
    'evidence_assertion_id',v_evidence_id,
    'execution_grant_id',v_grant_id
  );
end;
$$;

revoke all on function
  platform_private.record_registry_chart_playback_provider_evidence_v1(uuid),
  platform_private.issue_registry_chart_playback_provider_grant_v1(uuid,uuid),
  platform_private.execute_registry_chart_playback_provider_v1(uuid),
  platform_private.verify_registry_chart_playback_provider_v1(uuid)
from public, anon, authenticated, service_role;

revoke all on function
  public.chart_admit_track_provider_link_v1(uuid)
from public, anon, service_role;

grant execute on function
  public.chart_admit_track_provider_link_v1(uuid)
to authenticated;

update platform_private.registry_operation_types
set enabled=true,
    updated_at=now()
where operation_key='registry.track.provider_link.admit'
  and operation_version=1
  and capability_key='admit_registry_track_provider_link';

do $proof$
begin
  if not exists (
    select 1
    from platform_private.registry_operation_types operation_type
    where operation_type.operation_key='registry.track.provider_link.admit'
      and operation_type.operation_version=1
      and operation_type.capability_key='admit_registry_track_provider_link'
      and operation_type.enabled
      and operation_type.requires_existing_target
      and operation_type.allowed_subject_types=array['track']::text[]
      and operation_type.max_targets=1
      and operation_type.max_rows_ceiling=1
      and operation_type.max_grant_ttl_seconds=300
      and operation_type.requires_human_approval
      and operation_type.requires_verifier
  ) then
    raise exception 'Chart Playback Provider V1 operation definition drifted';
  end if;

  if not exists (
    select 1
    from platform_private.system_actors actor
    where actor.actor_key='registry_chart_admission'
      and actor.status='active'
      and actor.capability_profile->'provider_metadata_family'
          @> '["registry.track.provider_link.admit/v1"]'::jsonb
  ) then
    raise exception 'Chart admission actor provider metadata profile drifted';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings binding
    where binding.actor_key='registry_chart_admission'
      and binding.executor_kind='database_role'
      and binding.executor_key='authenticator'
      and binding.status='active'
  ) then
    raise exception 'Chart admission authenticator binding drifted';
  end if;

  if has_function_privilege(
       'anon',
       'public.chart_admit_track_provider_link_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.chart_admit_track_provider_link_v1(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.chart_admit_track_provider_link_v1(uuid)',
       'EXECUTE'
     )
  then
    raise exception 'Chart Playback Provider V1 public wrapper grants drifted';
  end if;

  if has_function_privilege(
       'authenticated',
       'platform_private.execute_registry_chart_playback_provider_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.execute_registry_chart_playback_provider_v1(uuid)',
       'EXECUTE'
     )
  then
    raise exception 'Chart Playback Provider V1 private executor leaked role authority';
  end if;

  if exists (
    select 1
    from platform_private.registry_execution_grants grant_row
    where grant_row.operation_key='registry.track.provider_link.admit'
  )
     or exists (
       select 1
       from platform_private.registry_mutation_operations operation
       where operation.operation_key='registry.track.provider_link.admit'
     )
  then
    raise exception 'Chart Playback Provider V1 migration activated durable execution residue';
  end if;
end
$proof$;

commit;
