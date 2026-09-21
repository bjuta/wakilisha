-- WAKILISHA MIZIZI Slice 3 Tranche A
-- Chart Artist Resolution current-authority rebase + stale Registry grant contraction.

begin;
set local statement_timeout='180s';
set local lock_timeout='5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'mizizi-slice3-chart-artist-resolution-rebase-v1',
    0
  )
);

do $preflight$
begin
  if to_regprocedure(
       'platform_private.record_registry_chart_user_evidence_v1(text,uuid,text,jsonb,text,text,text,jsonb,text)'
     ) is null
     or to_regprocedure(
       'platform_private.issue_registry_chart_user_execution_grant_v1(uuid,text,text,uuid,jsonb,text,text,text)'
     ) is null
     or to_regprocedure(
       'platform_private.execute_registry_materialization_v1(text,uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.verify_registry_materialization_v1(uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_track_artist_credit_collision_state_v1(uuid,uuid,uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_relation_collision_fingerprint_v1(jsonb)'
     ) is null
     or to_regprocedure(
       'public.admin_set_registry_artist_alias_v1(text,uuid,text,text,text,text)'
     ) is null
  then
    raise exception
      'STOP: accepted Chart/Registry admission or alias authority is missing';
  end if;
end
$preflight$;

create or replace function
platform_private.record_registry_chart_user_evidence_v1(
  p_subject_type text,
  p_subject_id uuid,
  p_claim_key text,
  p_claim_payload jsonb,
  p_trust_class text,
  p_source_kind text,
  p_source_ref text,
  p_source_payload jsonb,
  p_required_user_capability_key text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_source_payload_fingerprint text;
  v_assertion_fingerprint text;
  v_assertion_id uuid;
begin
  if v_user_id is null
     or p_subject_id is null
     or p_claim_payload is null
     or jsonb_typeof(p_claim_payload) <> 'object'
     or nullif(btrim(p_claim_key), '') is null
     or nullif(btrim(p_source_ref), '') is null
  then
    raise exception using errcode='22023',
      message='Valid chart evidence subject, claim, and source are required.';
  end if;

  if p_required_user_capability_key not in (
       'publish_charts',
       'manage_registry'
     )
     or not coalesce(
       public.current_user_has_capability(
         p_required_user_capability_key
       ),
       false
     )
  then
    raise exception using errcode='42501',
      message='Current user does not hold the required chart/Registry capability.';
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

  if p_subject_type not in (
       'artist',
       'track',
       'track_artist_credit'
     )
     or p_claim_key not in (
       'registry.artist.identity.create',
       'registry.track.identity.create',
       'registry.track_artist_credit',
       'registry.artist.origin'
     )
     or p_trust_class not in (
       'EXTERNAL_EVIDENCE',
       'INTERNAL_FACT'
     )
     or p_source_kind not in (
       'chart_ingest_candidate',
       'chart_origin_review',
       'chart_artist_resolution_review'
     )
  then
    raise exception using errcode='22023',
      message='Evidence is outside the chart materialization V1 contract.';
  end if;

  if octet_length(p_claim_payload::text) > 16384
     or octet_length(p_source_ref) > 2000
  then
    raise exception using errcode='22023',
      message='Chart evidence exceeds the V1 payload boundary.';
  end if;

  v_source_payload_fingerprint := encode(
    extensions.digest(
      coalesce(p_source_payload, '{}'::jsonb)::text,
      'sha256'
    ),
    'hex'
  );

  v_assertion_fingerprint := encode(
    extensions.digest(
      jsonb_build_object(
        'subject_type', p_subject_type,
        'subject_id', p_subject_id::text,
        'claim_key', p_claim_key,
        'claim_payload', p_claim_payload,
        'trust_class', p_trust_class,
        'source_kind', p_source_kind,
        'source_ref', btrim(p_source_ref),
        'source_payload_fingerprint',
          v_source_payload_fingerprint,
        'recorded_by_principal_key',
          'user:' || v_user_id::text
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
    p_subject_type,
    p_subject_id,
    p_claim_key,
    p_claim_payload,
    p_trust_class,
    p_source_kind,
    btrim(p_source_ref),
    v_source_payload_fingerprint,
    now(),
    'user:' || v_user_id::text,
    v_assertion_fingerprint
  )
  on conflict (assertion_fingerprint)
  do nothing
  returning id into v_assertion_id;

  if v_assertion_id is null then
    select assertion.id
    into v_assertion_id
    from platform_private.registry_evidence_assertions assertion
    where assertion.assertion_fingerprint =
          v_assertion_fingerprint;
  end if;

  return v_assertion_id;
end
$$;

create or replace function
platform_private.issue_registry_chart_user_execution_grant_v1(
  p_evidence_assertion_id uuid,
  p_operation_key text,
  p_subject_type text,
  p_subject_id uuid,
  p_plan_payload jsonb,
  p_required_user_capability_key text,
  p_idempotency_key text,
  p_expected_state_fingerprint text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_operation_type platform_private.registry_operation_types%rowtype;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_existing platform_private.registry_execution_grants%rowtype;
  v_plan_fingerprint text;
  v_target_fingerprint text;
  v_grant_id uuid;
  v_policy_ruleset_version text;
begin
  if v_user_id is null
     or p_evidence_assertion_id is null
     or p_subject_id is null
     or p_plan_payload is null
     or jsonb_typeof(p_plan_payload) <> 'object'
     or p_idempotency_key is null
     or p_idempotency_key !~
        '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
  then
    raise exception using errcode='22023',
      message='Valid user, evidence, plan, subject, and idempotency key are required.';
  end if;

  if p_required_user_capability_key not in (
       'publish_charts',
       'manage_registry'
     )
     or not coalesce(
       public.current_user_has_capability(
         p_required_user_capability_key
       ),
       false
     )
  then
    raise exception using errcode='42501',
      message='Current user cannot issue this chart Registry grant.';
  end if;

  if not exists (
       select 1
       from platform_private.system_actors actor
       where actor.actor_key='registry_chart_admission'
         and actor.status='active'
     )
     or not exists (
       select 1
       from platform_private.system_actor_executor_bindings binding
       where binding.actor_key='registry_chart_admission'
         and binding.executor_kind='database_role'
         and binding.executor_key=session_user
         and binding.status='active'
     )
  then
    raise exception using errcode='42501',
      message='Registry chart admission broker is not active.';
  end if;

  select operation_type.*
  into v_operation_type
  from platform_private.registry_operation_types operation_type
  where operation_type.operation_key=p_operation_key
    and operation_type.operation_version=1
    and operation_type.enabled;

  if not found
     or not (
       p_subject_type =
         any(v_operation_type.allowed_subject_types)
     )
  then
    raise exception using errcode='42501',
      message='Typed Registry operation is disabled or subject is forbidden.';
  end if;

  if (
       p_operation_key='registry.artist.create'
       and (
         v_operation_type.capability_key <>
           'create_registry_artist'
         or p_subject_type <> 'artist'
         or p_required_user_capability_key not in (
           'publish_charts',
           'manage_registry'
         )
       )
     )
     or (
       p_operation_key='registry.track.create'
       and (
         v_operation_type.capability_key <>
           'create_registry_track'
         or p_subject_type <> 'track'
         or p_required_user_capability_key <>
           'publish_charts'
       )
     )
     or (
       p_operation_key='registry.track_artist_credit.admit'
       and (
         v_operation_type.capability_key <>
           'admit_registry_track_artist_credit'
         or p_subject_type <> 'track_artist_credit'
         or p_required_user_capability_key not in (
           'publish_charts',
           'manage_registry'
         )
       )
     )
     or (
       p_operation_key='registry.artist_origin.admit'
       and (
         v_operation_type.capability_key <>
           'admit_registry_artist_origin'
         or p_subject_type <> 'artist'
         or p_required_user_capability_key <>
           'manage_registry'
         or p_expected_state_fingerprint is null
       )
     )
     or p_operation_key not in (
       'registry.artist.create',
       'registry.track.create',
       'registry.track_artist_credit.admit',
       'registry.artist_origin.admit'
     )
  then
    raise exception using errcode='42501',
      message='Operation/capability pair is outside chart materialization V1.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=p_evidence_assertion_id;

  if not found
     or v_evidence.subject_type <> p_subject_type
     or v_evidence.subject_id <> p_subject_id
     or v_evidence.recorded_by_principal_key <>
        'user:' || v_user_id::text
     or v_evidence.trust_class not in (
       'EXTERNAL_EVIDENCE',
       'INTERNAL_FACT'
     )
  then
    raise exception using errcode='42501',
      message='Evidence is not bound to the current chart user and exact subject.';
  end if;

  v_policy_ruleset_version :=
    case
      when p_operation_key='registry.artist_origin.admit'
        then 'registry-artist-origin-admission-v1'
      else 'registry-materialization-v1'
    end;

  if p_plan_payload->>'operation_key'
       is distinct from p_operation_key
     or coalesce(
          (p_plan_payload->>'operation_version')::integer,
          0
        ) <> 1
     or p_plan_payload->>'evidence_assertion_id'
       is distinct from v_evidence.id::text
     or p_plan_payload->>'evidence_assertion_fingerprint'
       is distinct from v_evidence.assertion_fingerprint
     or p_plan_payload->>'trust_class'
       is distinct from v_evidence.trust_class
     or p_plan_payload->>'policy_ruleset_version'
       is distinct from v_policy_ruleset_version
  then
    raise exception using errcode='42501',
      message='Exact execution plan is not bound to its chart evidence.';
  end if;

  v_plan_fingerprint :=
    platform_private.registry_plan_fingerprint(
      p_plan_payload
    );

  v_target_fingerprint := encode(
    extensions.digest(
      jsonb_build_array(
        jsonb_build_object(
          'subject_type', p_subject_type,
          'subject_id', p_subject_id::text,
          'expected_state_fingerprint',
            p_expected_state_fingerprint
        )
      )::text,
      'sha256'
    ),
    'hex'
  );

  select execution_grant.*
  into v_existing
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.actor_key='registry_chart_admission'
    and execution_grant.operation_key=p_operation_key
    and execution_grant.operation_version=1
    and execution_grant.idempotency_key=p_idempotency_key;

  if found then
    if v_existing.issued_by_user_id <> v_user_id
       or v_existing.plan_fingerprint <>
          v_plan_fingerprint
       or v_existing.target_set_fingerprint <>
          v_target_fingerprint
    then
      raise exception using errcode='23505',
        message='Chart Registry idempotency key is bound to different authority.';
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
    v_operation_type.capability_key,
    null,
    p_operation_key,
    1,
    p_plan_payload,
    v_plan_fingerprint,
    v_target_fingerprint,
    1,
    p_idempotency_key,
    'active',
    v_user_id,
    'user:' || v_user_id::text,
    v_policy_ruleset_version,
    p_required_user_capability_key,
    now(),
    now() + interval '5 minutes'
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
    p_subject_type,
    p_subject_id,
    p_expected_state_fingerprint
  );

  return v_grant_id;
end
$$;

create or replace function public.chart_get_entry_registry_identity_v1(
  p_edition_id text default null
)
returns table(
  entry_id text,
  track_title text,
  artist_name text,
  current_artist_slug text,
  canonical_track_id text,
  canonical_track_slug text,
  canonical_primary_artist_slug text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if auth.uid() is null
     or not (
       coalesce(public.current_user_has_capability('publish_charts'),false)
       or public.current_user_is_administrator()
     )
  then
    raise exception using
      errcode='42501',
      message='publish_charts is required.';
  end if;

  return query
  select
    e.id::text,
    e.track_title::text,
    e.artist_name::text,
    e.artist_slug::text,
    e.canonical_track_id::text,
    t.slug::text,
    primary_credit.artist_slug::text
  from public.wk_chart_entries_v2 e
  left join public.registry_tracks t
    on t.id::text=e.canonical_track_id::text
  left join lateral (
    select min(ta.artist_slug)::text as artist_slug
    from public.registry_track_artists ta
    where ta.track_id=t.id
      and ta.is_primary is true
      and ta.artist_id is not null
      and ta.status <> 'archived'
    having count(*)=1
  ) primary_credit on true
  where p_edition_id is null
     or e.edition_id::text=p_edition_id;
end;
$$;

create or replace function public.admin_apply_chart_artist_resolution_decision(
  p_decision_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,auth,extensions
as $$
declare
  v_user_id uuid:=auth.uid();
  v_decision public.chart_artist_resolution_decisions%rowtype;
  v_entry public.wk_chart_entries_v2%rowtype;
  v_required_capability text;
  v_selected_count integer:=0;
  v_primary_selected_count integer:=0;
  v_existing_primary_count integer:=0;
  v_existing_primary_artist_id uuid;
  v_track_inserted integer:=0;
  v_track_existing integer:=0;
  v_selected record;
  v_artist public.registry_artists%rowtype;
  v_existing_credit public.registry_track_artists%rowtype;
  v_existing_pair_count integer;
  v_future_id uuid;
  v_future_hex text;
  v_collision jsonb;
  v_collision_fp text;
  v_evidence_id uuid;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_plan jsonb;
  v_grant_id uuid;
  v_execution record;
  v_verification record;
  v_operation_ids jsonb:='[]'::jsonb;
  v_primary_artist public.registry_artists%rowtype;
  v_result jsonb;
begin
  if v_user_id is null
     or not (
       coalesce(public.current_user_has_capability('manage_charts'),false)
       or coalesce(public.current_user_has_capability('manage_registry'),false)
       or coalesce(public.current_user_is_administrator(),false)
     )
  then
    raise exception using errcode='42501', message='insufficient_privilege';
  end if;

  v_required_capability:=case
    when coalesce(public.current_user_has_capability('manage_registry'),false)
      then 'manage_registry'
    when coalesce(public.current_user_has_capability('publish_charts'),false)
      then 'publish_charts'
    else null
  end;

  if v_required_capability is null then
    raise exception using errcode='42501',
      message='Current Chart resolver lacks an exact Registry grant capability.';
  end if;

  select decision.*
  into v_decision
  from public.chart_artist_resolution_decisions decision
  where decision.id=p_decision_id
  for update;

  if not found then raise exception 'decision_not_found'; end if;

  select entry.*
  into v_entry
  from public.wk_chart_entries_v2 entry
  where entry.id::text=v_decision.chart_entry_id
  for update;

  if not found then raise exception 'chart_entry_not_found'; end if;

  if v_decision.decision_status='resolved' then
    return coalesce(
      v_decision.apply_result_json,
      jsonb_build_object(
        'decisionId',v_decision.id,
        'alreadyResolved',true
      )
    );
  end if;

  if v_decision.decision_type='accepted_as_group' then
    v_result:=jsonb_build_object(
      'decisionId',v_decision.id,
      'chartEntryId',v_decision.chart_entry_id,
      'decisionType',v_decision.decision_type,
      'trackCreditsInserted',0,
      'trackCreditsExisting',0,
      'operationIds','[]'::jsonb,
      'message','Accepted as group/collab. No Registry credits were changed.'
    );

    update public.chart_artist_resolution_decisions
    set decision_status='resolved',
        applied_at=now(),
        apply_result_json=v_result,
        updated_at=now()
    where id=v_decision.id;

    return v_result;
  end if;

  if v_decision.decision_type not in ('split_plan','alias_plan') then
    raise exception 'decision_type_not_applyable';
  end if;

  if jsonb_typeof(coalesce(v_decision.selected_artists,'null'::jsonb))<>'array'
     or jsonb_array_length(v_decision.selected_artists)=0
  then
    raise exception 'selected_artists_required';
  end if;

  if v_entry.canonical_track_id is null
     or btrim(v_entry.canonical_track_id::text)=''
     or not exists (
       select 1
       from public.registry_tracks track
       where track.id=v_entry.canonical_track_id::uuid
         and track.status<>'archived'
     )
  then
    raise exception 'canonical_track_required';
  end if;

  create temporary table if not exists
    pg_temp.chart_artist_resolution_selected_artists_v2 (
      artist_id uuid primary key,
      role text not null,
      credit_order integer not null,
      display_credit text
    ) on commit drop;

  truncate table pg_temp.chart_artist_resolution_selected_artists_v2;

  insert into pg_temp.chart_artist_resolution_selected_artists_v2 (
    artist_id,role,credit_order,display_credit
  )
  select distinct on ((item.value->>'artist_id')::uuid)
    (item.value->>'artist_id')::uuid,
    coalesce(
      nullif(item.value->>'role',''),
      case when item.ordinality=1
        then 'primary_artist'
        else 'featured_artist'
      end
    ),
    coalesce(
      nullif(item.value->>'credit_order','')::integer,
      item.ordinality::integer
    ),
    nullif(item.value->>'display_name','')
  from jsonb_array_elements(v_decision.selected_artists)
       with ordinality as item(value,ordinality)
  where nullif(item.value->>'artist_id','') is not null
  order by (item.value->>'artist_id')::uuid,item.ordinality;

  select count(*) into v_selected_count
  from pg_temp.chart_artist_resolution_selected_artists_v2;

  select count(*) into v_primary_selected_count
  from pg_temp.chart_artist_resolution_selected_artists_v2
  where role='primary_artist';

  if v_selected_count=0 or v_primary_selected_count<>1 then
    raise exception 'exactly_one_primary_selected_artist_required';
  end if;

  if exists (
       select 1
       from pg_temp.chart_artist_resolution_selected_artists_v2 selected
       left join public.registry_artists artist
         on artist.id=selected.artist_id
        and artist.status<>'archived'
       where artist.id is null
          or selected.role not in ('primary_artist','featured_artist')
          or selected.credit_order<1
     )
  then
    raise exception 'selected_artist_or_credit_semantics_invalid';
  end if;

  select count(*)::integer
  into v_existing_primary_count
  from public.registry_track_artists credit
  where credit.track_id=v_entry.canonical_track_id::uuid
    and credit.status<>'archived'
    and credit.is_primary is true;

  if v_existing_primary_count=1 then
    select credit.artist_id
    into v_existing_primary_artist_id
    from public.registry_track_artists credit
    where credit.track_id=v_entry.canonical_track_id::uuid
      and credit.status<>'archived'
      and credit.is_primary is true
    limit 1;
  end if;

  if v_existing_primary_count>1 then
    raise exception using errcode='23514',
      message='Chart Track has multiple live primary credits and requires reviewed credit reconciliation.';
  end if;

  if v_existing_primary_count=1
     and v_existing_primary_artist_id is distinct from (
       select artist_id
       from pg_temp.chart_artist_resolution_selected_artists_v2
       where role='primary_artist'
     )
  then
    raise exception using errcode='23514',
      message='Chart Artist Resolution cannot replace a different live primary credit through admission authority.';
  end if;

  for v_selected in
    select *
    from pg_temp.chart_artist_resolution_selected_artists_v2
    order by credit_order,artist_id
  loop
    select artist.*
    into v_artist
    from public.registry_artists artist
    where artist.id=v_selected.artist_id
      and artist.status<>'archived';

    select count(*)::integer
    into v_existing_pair_count
    from public.registry_track_artists credit
    where credit.track_id=v_entry.canonical_track_id::uuid
      and credit.artist_id=v_selected.artist_id
      and credit.status<>'archived';

    if v_existing_pair_count>1 then
      raise exception using errcode='23514',
        message='Chart Track has ambiguous live Artist-credit rows.';
    end if;

    if v_existing_pair_count=1 then
      select credit.*
      into v_existing_credit
      from public.registry_track_artists credit
      where credit.track_id=v_entry.canonical_track_id::uuid
        and credit.artist_id=v_selected.artist_id
        and credit.status<>'archived'
      limit 1;

      if v_existing_credit.role is distinct from v_selected.role
         or v_existing_credit.is_primary is distinct from
            (v_selected.role='primary_artist')
         or v_existing_credit.is_featured is distinct from
            (v_selected.role='featured_artist')
         or v_existing_credit.credit_order is distinct from
            v_selected.credit_order
      then
        raise exception using errcode='23514',
          message='Existing Chart Track credit conflicts with the reviewed resolution and requires reconciliation.';
      end if;

      v_track_existing:=v_track_existing+1;
      continue;
    end if;

    v_future_hex:=encode(
      extensions.digest(
        v_decision.id::text||':'||
        v_entry.canonical_track_id::text||':'||
        v_selected.artist_id::text||':'||
        v_selected.role||':'||
        v_selected.credit_order::text,
        'sha256'
      ),
      'hex'
    );
    v_future_id:=(
      substr(v_future_hex,1,8)||'-'||
      substr(v_future_hex,9,4)||'-'||
      '5'||substr(v_future_hex,14,3)||'-'||
      '8'||substr(v_future_hex,18,3)||'-'||
      substr(v_future_hex,21,12)
    )::uuid;

    v_collision:=
      platform_private.registry_track_artist_credit_collision_state_v1(
        v_future_id,
        v_entry.canonical_track_id::uuid,
        v_selected.artist_id
      );

    if v_collision<>'[]'::jsonb then
      raise exception using errcode='23505',
        message='Reviewed Chart Artist credit collided before exact admission.';
    end if;

    v_collision_fp:=
      platform_private.registry_relation_collision_fingerprint_v1(v_collision);

    v_evidence_id:=
      platform_private.record_registry_chart_user_evidence_v1(
        'track_artist_credit',
        v_future_id,
        'registry.track_artist_credit',
        jsonb_build_object(
          'track_id',v_entry.canonical_track_id::uuid,
          'artist_id',v_selected.artist_id,
          'role',v_selected.role,
          'credit_order',v_selected.credit_order,
          'display_credit',
            coalesce(v_selected.display_credit,v_artist.display_name),
          'confidence',100
        ),
        'INTERNAL_FACT',
        'chart_artist_resolution_review',
        'chart-artist-resolution:'||
          v_decision.id::text||':'||v_selected.artist_id::text,
        jsonb_build_object(
          'decision_id',v_decision.id,
          'chart_entry_id',v_decision.chart_entry_id,
          'edition_id',v_decision.edition_id,
          'raw_artist_name',v_decision.raw_artist_name,
          'decision_type',v_decision.decision_type,
          'selected_artists',v_decision.selected_artists,
          'note',v_decision.note
        ),
        v_required_capability
      );

    select assertion.*
    into v_evidence
    from platform_private.registry_evidence_assertions assertion
    where assertion.id=v_evidence_id;

    v_plan:=jsonb_build_object(
      'operation_key','registry.track_artist_credit.admit',
      'operation_version',1,
      'credit_id',v_future_id::text,
      'track_id',v_entry.canonical_track_id::text,
      'artist_id',v_selected.artist_id::text,
      'role',v_selected.role,
      'credit_order',v_selected.credit_order,
      'display_credit',
        coalesce(v_selected.display_credit,v_artist.display_name),
      'confidence',100,
      'collision_state_fingerprint',v_collision_fp,
      'evidence_assertion_id',v_evidence.id::text,
      'evidence_assertion_fingerprint',v_evidence.assertion_fingerprint,
      'trust_class',v_evidence.trust_class,
      'policy_ruleset_version','registry-materialization-v1'
    );

    v_grant_id:=
      platform_private.issue_registry_chart_user_execution_grant_v1(
        v_evidence.id,
        'registry.track_artist_credit.admit',
        'track_artist_credit',
        v_future_id,
        v_plan,
        v_required_capability,
        'chart-resolution-credit:'||
          substr(v_evidence.assertion_fingerprint,1,40),
        null
      );

    select *
    into v_execution
    from platform_private.execute_registry_materialization_v1(
      'registry_chart_admission',
      v_grant_id
    );

    select *
    into v_verification
    from platform_private.verify_registry_materialization_v1(
      v_execution.operation_id
    );

    if v_verification.verifier_status<>'passed' then
      raise exception using errcode='23514',
        message='Reviewed Chart Artist credit independent verification failed.';
    end if;

    v_track_inserted:=v_track_inserted+1;
    v_operation_ids:=v_operation_ids||
      jsonb_build_array(v_execution.operation_id);
  end loop;

  select artist.*
  into v_primary_artist
  from pg_temp.chart_artist_resolution_selected_artists_v2 selected
  join public.registry_artists artist on artist.id=selected.artist_id
  where selected.role='primary_artist';

  if (
       select count(*)
       from public.registry_track_artists credit
       where credit.track_id=v_entry.canonical_track_id::uuid
         and credit.status<>'archived'
         and credit.is_primary is true
     )<>1
     or not exists (
       select 1
       from public.registry_track_artists credit
       where credit.track_id=v_entry.canonical_track_id::uuid
         and credit.status<>'archived'
         and credit.is_primary is true
         and credit.artist_id=v_primary_artist.id
     )
  then
    raise exception using errcode='23514',
      message='Reviewed Chart Artist Resolution did not produce one exact current primary credit.';
  end if;

  update public.wk_chart_entries_v2
  set canonical_artist_id=v_primary_artist.id::text,
      artist_slug=v_primary_artist.slug,
      updated_at=now()
  where id=v_entry.id;

  v_result:=jsonb_build_object(
    'decisionId',v_decision.id,
    'chartEntryId',v_decision.chart_entry_id,
    'trackId',v_entry.canonical_track_id,
    'primaryArtistId',v_primary_artist.id,
    'primaryArtistSlug',v_primary_artist.slug,
    'selectedArtistCount',v_selected_count,
    'trackCreditsInserted',v_track_inserted,
    'trackCreditsExisting',v_track_existing,
    'operationIds',v_operation_ids,
    'decisionType',v_decision.decision_type,
    'message','Resolution decision applied through governed Registry credit admission.'
  );

  update public.chart_artist_resolution_decisions
  set decision_status='resolved',
      applied_at=now(),
      apply_result_json=v_result,
      updated_at=now()
  where id=v_decision.id;

  return v_result;
end
$$;

create or replace function public.admin_resolve_chart_artist_alias(
  p_alias_slug text,
  p_canonical_artist_id uuid,
  p_alias_display_name text default null,
  p_apply_to_existing boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,auth
as $$
declare
  v_user_id uuid:=auth.uid();
  v_alias jsonb;
  v_result jsonb;
  v_canonical public.registry_artists%rowtype;
begin
  if v_user_id is null
     or not coalesce(public.current_user_has_capability('manage_registry'),false)
  then
    raise exception using errcode='42501', message='manage_registry is required.';
  end if;

  select artist.*
  into v_canonical
  from public.registry_artists artist
  where artist.id=p_canonical_artist_id
    and artist.status<>'archived';

  if not found then
    raise exception using errcode='P0002',
      message='Canonical Artist is not available for alias review.';
  end if;

  if coalesce(p_apply_to_existing,true) then
    v_result:=public.admin_set_registry_artist_alias_v1(
      p_alias_slug,
      p_canonical_artist_id,
      p_alias_display_name,
      'similarity_match',
      'active',
      'Chart Artist alias confirmed through current alias authority.'
    );

    return jsonb_build_object(
      'aliasSlug',public.wk_slugify_text(p_alias_slug),
      'canonicalArtistId',v_canonical.id,
      'canonicalSlug',v_canonical.slug,
      'canonicalDisplayName',v_canonical.display_name,
      'aliasRowsTouched',1,
      'chartEntriesUpdated',coalesce((v_result->>'chartEntriesUpdated')::integer,0),
      'trackArtistRowsUpdated',0,
      'duplicateArtistRowsMarked',0,
      'compatibilityAuthority','admin_set_registry_artist_alias_v1'
    );
  end if;

  v_alias:=platform_private.execute_registry_artist_alias_state_v1(
    p_alias_slug,
    p_canonical_artist_id,
    p_alias_display_name,
    'similarity_match',
    'active',
    'Chart Artist alias confirmed without projection repair.',
    v_user_id,
    'admin_resolve_chart_artist_alias_compatibility'
  );

  return jsonb_build_object(
    'aliasSlug',public.wk_slugify_text(p_alias_slug),
    'canonicalArtistId',v_canonical.id,
    'canonicalSlug',v_canonical.slug,
    'canonicalDisplayName',v_canonical.display_name,
    'aliasRowsTouched',1,
    'chartEntriesUpdated',0,
    'trackArtistRowsUpdated',0,
    'duplicateArtistRowsMarked',0,
    'compatibilityAuthority','admin_set_registry_artist_alias_v1'
  );
end
$$;

revoke all on function
  public.admin_apply_chart_artist_resolution_decision(uuid),
  public.admin_resolve_chart_artist_alias(text,uuid,text,boolean)
from public,anon,service_role;
grant execute on function
  public.admin_apply_chart_artist_resolution_decision(uuid),
  public.admin_resolve_chart_artist_alias(text,uuid,text,boolean)
to authenticated;

drop policy if exists registry_track_provider_links_admin_manage
  on public.registry_track_provider_links;
revoke insert,update,delete,truncate,references,trigger
on public.registry_track_provider_links
from PUBLIC,anon,authenticated,service_role;

drop policy if exists registry_relationship_evidence_insert
  on public.registry_relationship_evidence;
drop policy if exists registry_relationship_evidence_delete
  on public.registry_relationship_evidence;
revoke insert,update,delete,truncate,references,trigger
on public.registry_relationship_evidence
from PUBLIC,anon,authenticated,service_role;

commit;
