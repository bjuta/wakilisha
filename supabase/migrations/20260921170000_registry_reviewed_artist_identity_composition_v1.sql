-- WAKILISHA MIZIZI Slice 3 Tranche A
-- Reviewed Artist identity composition + alias authority convergence.
--
-- Reuses registry.artist.create/v1 without changing the shared execution,
-- grant, evidence, fingerprint, journal, or verifier kernel.

begin;
set local statement_timeout='180s';
set local lock_timeout='5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'mizizi-slice3-reviewed-artist-identity-composition-v1',
    0
  )
);

do $preflight$
begin
  if to_regprocedure(
       'platform_private.execute_registry_materialization_v1(text,uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.verify_registry_materialization_v1(uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_artist_creation_collision_state_v1(uuid,text)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_identity_creation_collision_fingerprint_v1(jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_plan_fingerprint(jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_identity_normalize_text_v1(text)'
     ) is null
     or to_regprocedure(
       'public.resolve_registry_relationship_endpoint(uuid,text,text,uuid,text)'
     ) is null
  then
    raise exception
      'STOP: accepted Registry Artist materialization or relationship authority is missing';
  end if;

  if exists (
       select 1
       from platform_private.system_actors
       where actor_key='registry_artist_identity_review'
     )
     or to_regprocedure(
       'platform_private.execute_registry_reviewed_artist_identity_materialization_v1(text,text,text,text,text,text,jsonb,text)'
     ) is not null
     or to_regprocedure(
       'platform_private.execute_registry_artist_alias_state_v1(text,uuid,text,text,text,text,uuid,text)'
     ) is not null
     or to_regprocedure(
       'public.admin_set_registry_artist_alias_v1(text,uuid,text,text,text,text)'
     ) is not null
  then
    raise exception
      'STOP: reviewed Artist identity/alias convergence authority already exists';
  end if;
end
$preflight$;

insert into platform_private.system_actors (
  actor_key,label,actor_kind,status,capability_profile
)
values (
  'registry_artist_identity_review',
  'Registry Reviewed Artist Identity Broker',
  'automation',
  'active',
  jsonb_build_object(
    'domain','registry',
    'operation_family',jsonb_build_array('registry.artist.create/v1'),
    'authority_mode','human_exact_grant',
    'review_sources',jsonb_build_array(
      'artist_claim_review',
      'missing_artist_intake_review',
      'artist_decouple_review'
    )
  )
);

insert into platform_private.system_actor_executor_bindings (
  actor_key,executor_kind,executor_key,status
)
values (
  'registry_artist_identity_review',
  'database_role',
  'authenticator',
  'active'
);

create function platform_private.execute_registry_reviewed_artist_identity_materialization_v1(
  p_source_kind text,
  p_source_ref text,
  p_display_name text,
  p_normalized_name text,
  p_slug text,
  p_source_payload_fingerprint text,
  p_claim_payload jsonb,
  p_required_user_capability_key text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,auth,extensions
as $$
declare
  v_user_id uuid:=auth.uid();
  v_operation_type platform_private.registry_operation_types%rowtype;
  v_future_id uuid;
  v_future_hex text;
  v_collision jsonb;
  v_evidence_id uuid;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_assertion_fingerprint text;
  v_plan jsonb;
  v_plan_fingerprint text;
  v_target_fingerprint text;
  v_idempotency_key text;
  v_existing platform_private.registry_execution_grants%rowtype;
  v_grant_id uuid;
  v_execution record;
  v_verification record;
  v_artist public.registry_artists%rowtype;
begin
  if v_user_id is null
     or nullif(btrim(p_source_kind),'') is null
     or nullif(btrim(p_source_ref),'') is null
     or nullif(btrim(p_display_name),'') is null
     or nullif(btrim(p_normalized_name),'') is null
     or nullif(btrim(p_slug),'') is null
     or p_source_payload_fingerprint is null
     or p_source_payload_fingerprint !~ '^[0-9a-f]{64}$'
     or nullif(btrim(p_required_user_capability_key),'') is null
     or p_claim_payload is null
     or jsonb_typeof(p_claim_payload)<>'object'
     or octet_length(p_claim_payload::text)>16000
  then
    raise exception using errcode='22023',
      message='Reviewed Artist identity materialization input is malformed.';
  end if;

  if not (
    (
      p_source_kind='artist_claim_review'
      and p_source_ref like 'artist-claim:%'
      and p_required_user_capability_key in ('manage_users','manage_registry')
    )
    or (
      p_source_kind='missing_artist_intake_review'
      and p_source_ref like 'missing-artist-intake:%'
      and p_required_user_capability_key in (
        'manage_registry','manage_review_queue'
      )
    )
    or (
      p_source_kind='artist_decouple_review'
      and p_source_ref like 'artist-decouple:%'
      and p_required_user_capability_key='manage_registry'
    )
  ) then
    raise exception using errcode='42501',
      message='Reviewed Artist identity source/capability pair is outside the accepted contract.';
  end if;

  if not coalesce(
       public.current_user_has_capability(p_required_user_capability_key),
       false
     )
  then
    raise exception using errcode='42501',
      message='Current user does not hold the exact reviewed Artist identity capability.';
  end if;

  if not exists (
       select 1
       from platform_private.system_actor_executor_bindings binding
       where binding.actor_key='registry_artist_identity_review'
         and binding.executor_kind='database_role'
         and binding.executor_key=session_user
         and binding.status='active'
     )
  then
    raise exception using errcode='42501',
      message='Current transport is not the reviewed Artist identity broker.';
  end if;

  select operation_type.*
  into v_operation_type
  from platform_private.registry_operation_types operation_type
  where operation_type.operation_key='registry.artist.create'
    and operation_type.operation_version=1
    and operation_type.enabled;

  if not found
     or v_operation_type.capability_key<>'create_registry_artist'
     or not ('artist'=any(v_operation_type.allowed_subject_types))
     or v_operation_type.max_rows_ceiling<1
     or not v_operation_type.requires_human_approval
     or not v_operation_type.requires_verifier
  then
    raise exception using errcode='42501',
      message='Registry Artist creation operation is disabled or malformed.';
  end if;

  v_future_hex:=encode(
    extensions.digest(
      p_source_kind||':'||btrim(p_source_ref)||':'||
      p_source_payload_fingerprint,
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

  v_idempotency_key:=
    'reviewed-artist-create:'||
    encode(
      extensions.digest(
        p_source_kind||':'||btrim(p_source_ref)||':'||
        p_source_payload_fingerprint,
        'sha256'
      ),
      'hex'
    );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_idempotency_key,0)
  );

  select execution_grant.*
  into v_existing
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.actor_key='registry_artist_identity_review'
    and execution_grant.operation_key='registry.artist.create'
    and execution_grant.operation_version=1
    and execution_grant.idempotency_key=v_idempotency_key;

  if found then
    if v_existing.issued_by_user_id<>v_user_id
       or v_existing.max_rows<>1
       or v_existing.plan_payload->>'artist_id'
            is distinct from v_future_id::text
       or v_existing.plan_payload->>'display_name'
            is distinct from btrim(p_display_name)
       or v_existing.plan_payload->>'normalized_name'
            is distinct from btrim(p_normalized_name)
       or v_existing.plan_payload->>'slug'
            is distinct from btrim(p_slug)
    then
      raise exception using errcode='23505',
        message='Reviewed Artist identity idempotency key is bound to different authority.';
    end if;

    select assertion.*
    into v_evidence
    from platform_private.registry_evidence_assertions assertion
    where assertion.id=
      (v_existing.plan_payload->>'evidence_assertion_id')::uuid;

    if not found
       or v_evidence.subject_type<>'artist'
       or v_evidence.subject_id<>v_future_id
       or v_evidence.claim_key<>'registry.artist.identity.create'
       or v_evidence.claim_payload<>p_claim_payload
       or v_evidence.trust_class<>'INTERNAL_FACT'
       or v_evidence.source_kind<>p_source_kind
       or v_evidence.source_ref<>btrim(p_source_ref)
       or v_evidence.source_payload_fingerprint<>p_source_payload_fingerprint
       or v_evidence.recorded_by_principal_key<>'user:'||v_user_id::text
       or v_existing.plan_payload->>'evidence_assertion_fingerprint'
            is distinct from v_evidence.assertion_fingerprint
    then
      raise exception using errcode='23505',
        message='Reviewed Artist identity retry does not match prior exact evidence.';
    end if;

    select *
    into v_execution
    from platform_private.execute_registry_materialization_v1(
      'registry_artist_identity_review',
      v_existing.id
    );

    select *
    into v_verification
    from platform_private.verify_registry_materialization_v1(
      v_execution.operation_id
    );

    if v_verification.verifier_status<>'passed' then
      raise exception using errcode='23514',
        message='Reviewed Artist identity replay verification failed.';
    end if;

    select artist.*
    into v_artist
    from public.registry_artists artist
    where artist.id=v_future_id;

    if not found
       or v_artist.slug is distinct from btrim(p_slug)
       or v_artist.display_name is distinct from btrim(p_display_name)
    then
      raise exception using errcode='40001',
        message='Reviewed Artist identity replay no longer resolves to the exact Artist.';
    end if;

    return jsonb_build_object(
      'artist_id',v_artist.id,
      'artist_slug',v_artist.slug,
      'display_name',v_artist.display_name,
      'status',v_artist.status,
      'operation_id',v_execution.operation_id,
      'verifier_status',v_verification.verifier_status,
      'idempotent_replay',true
    );
  end if;

  v_collision:=
    platform_private.registry_artist_creation_collision_state_v1(
      v_future_id,
      p_display_name
    );

  if v_collision<>'[]'::jsonb then
    raise exception using errcode='40001',
      message='Reviewed Artist identity collides with current Registry authority.';
  end if;

  v_assertion_fingerprint:=encode(
    extensions.digest(
      jsonb_build_object(
        'subject_type','artist',
        'subject_id',v_future_id::text,
        'claim_key','registry.artist.identity.create',
        'claim_payload',p_claim_payload,
        'trust_class','INTERNAL_FACT',
        'source_kind',p_source_kind,
        'source_ref',btrim(p_source_ref),
        'source_payload_fingerprint',p_source_payload_fingerprint,
        'recorded_by_principal_key','user:'||v_user_id::text
      )::text,
      'sha256'
    ),
    'hex'
  );

  insert into platform_private.registry_evidence_assertions (
    subject_type,subject_id,claim_key,claim_payload,trust_class,
    source_kind,source_ref,source_payload_fingerprint,observed_at,
    recorded_by_principal_key,assertion_fingerprint
  )
  values (
    'artist',
    v_future_id,
    'registry.artist.identity.create',
    p_claim_payload,
    'INTERNAL_FACT',
    p_source_kind,
    btrim(p_source_ref),
    p_source_payload_fingerprint,
    now(),
    'user:'||v_user_id::text,
    v_assertion_fingerprint
  )
  on conflict (assertion_fingerprint) do nothing
  returning id into v_evidence_id;

  if v_evidence_id is null then
    select assertion.id
    into v_evidence_id
    from platform_private.registry_evidence_assertions assertion
    where assertion.assertion_fingerprint=v_assertion_fingerprint;
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=v_evidence_id;

  if not found
     or v_evidence.subject_type<>'artist'
     or v_evidence.subject_id<>v_future_id
     or v_evidence.claim_key<>'registry.artist.identity.create'
     or v_evidence.claim_payload<>p_claim_payload
     or v_evidence.trust_class<>'INTERNAL_FACT'
     or v_evidence.source_kind<>p_source_kind
     or v_evidence.source_ref<>btrim(p_source_ref)
     or v_evidence.source_payload_fingerprint<>p_source_payload_fingerprint
     or v_evidence.recorded_by_principal_key<>'user:'||v_user_id::text
  then
    raise exception using errcode='42501',
      message='Reviewed Artist identity evidence is not bound to the exact reviewed source.';
  end if;

  v_plan:=jsonb_build_object(
    'operation_key','registry.artist.create',
    'operation_version',1,
    'artist_id',v_future_id,
    'display_name',btrim(p_display_name),
    'normalized_name',btrim(p_normalized_name),
    'slug',btrim(p_slug),
    'collision_state_fingerprint',
      platform_private.registry_identity_creation_collision_fingerprint_v1(
        v_collision
      ),
    'evidence_assertion_id',v_evidence.id,
    'evidence_assertion_fingerprint',v_evidence.assertion_fingerprint,
    'trust_class',v_evidence.trust_class,
    'policy_ruleset_version','registry-materialization-v1'
  );

  v_plan_fingerprint:=platform_private.registry_plan_fingerprint(v_plan);
  v_target_fingerprint:=encode(
    extensions.digest(
      jsonb_build_array(
        jsonb_build_object(
          'subject_type','artist',
          'subject_id',v_future_id::text,
          'expected_state_fingerprint',null
        )
      )::text,
      'sha256'
    ),
    'hex'
  );
  insert into platform_private.registry_execution_grants (
    actor_key,capability_key,system_actor_capability_grant_id,
    operation_key,operation_version,plan_payload,plan_fingerprint,
    target_set_fingerprint,max_rows,idempotency_key,status,
    issued_by_user_id,issued_by_principal_key,policy_ruleset_version,
    required_user_capability_key,issued_at,expires_at
  )
  values (
    'registry_artist_identity_review',
    v_operation_type.capability_key,
    null,
    'registry.artist.create',
    1,
    v_plan,
    v_plan_fingerprint,
    v_target_fingerprint,
    1,
    v_idempotency_key,
    'active',
    v_user_id,
    'user:'||v_user_id::text,
    'registry-materialization-v1',
    p_required_user_capability_key,
    now(),
    now()+interval '5 minutes'
  )
  returning id into v_grant_id;

  insert into platform_private.registry_execution_grant_targets (
    execution_grant_id,subject_type,subject_id,expected_state_fingerprint
  )
  values (
    v_grant_id,'artist',v_future_id,null
  );

  select *
  into v_execution
  from platform_private.execute_registry_materialization_v1(
    'registry_artist_identity_review',
    v_grant_id
  );

  select *
  into v_verification
  from platform_private.verify_registry_materialization_v1(
    v_execution.operation_id
  );

  if v_verification.verifier_status<>'passed' then
    raise exception using errcode='23514',
      message='Reviewed Artist identity materialization independent verification failed.';
  end if;

  select artist.*
  into v_artist
  from public.registry_artists artist
  where artist.id=v_future_id;

  if not found or v_artist.status<>'draft' then
    raise exception using errcode='40001',
      message='Reviewed Artist identity did not materialize as an exact draft.';
  end if;

  return jsonb_build_object(
    'artist_id',v_artist.id,
    'artist_slug',v_artist.slug,
    'display_name',v_artist.display_name,
    'status',v_artist.status,
    'operation_id',v_execution.operation_id,
    'verifier_status',v_verification.verifier_status,
    'idempotent_replay',v_execution.idempotent_replay
  );
end
$$;

create function platform_private.execute_registry_artist_alias_state_v1(
  p_alias_slug text,
  p_canonical_artist_id uuid,
  p_alias_display_name text,
  p_source text,
  p_status text,
  p_note text,
  p_actor_user_id uuid,
  p_authority text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public
as $$
declare
  v_alias_slug text:=public.wk_slugify_text(p_alias_slug);
  v_existing public.registry_artist_aliases%rowtype;
  v_after public.registry_artist_aliases%rowtype;
  v_before jsonb;
begin
  if p_actor_user_id is null
     or nullif(v_alias_slug,'') is null
     or p_canonical_artist_id is null
     or p_source is null
     or p_source not in ('manual','similarity_match','ingest_review')
     or p_status is null
     or p_status not in ('active','blocked')
     or nullif(btrim(coalesce(p_authority,'')),'') is null
  then
    raise exception using errcode='22023',
      message='Artist alias state input is outside the accepted contract.';
  end if;

  if not exists (
       select 1
       from public.registry_artists artist
       where artist.id=p_canonical_artist_id
         and artist.status<>'archived'
     )
  then
    raise exception using errcode='P0002',
      message='Canonical Artist for alias state does not exist.';
  end if;

  if p_status='active'
     and exists (
       select 1
       from public.registry_artist_aliases alias
       where lower(alias.alias_slug)=lower(v_alias_slug)
         and alias.canonical_artist_id<>p_canonical_artist_id
         and coalesce(alias.status,'active')='active'
     )
  then
    raise exception using errcode='23505',
      message='Active Artist alias is already bound to another canonical Artist.';
  end if;

  select alias.*
  into v_existing
  from public.registry_artist_aliases alias
  where alias.alias_slug=v_alias_slug
    and alias.canonical_artist_id=p_canonical_artist_id
  for update;

  if found then
    v_before:=to_jsonb(v_existing);
    update public.registry_artist_aliases alias
    set
      alias_display_name=
        coalesce(nullif(btrim(p_alias_display_name),''),alias.alias_display_name,v_alias_slug),
      confidence=case when p_status='active' then 100 else alias.confidence end,
      source=p_source,
      created_by=coalesce(alias.created_by,'user:'||p_actor_user_id::text),
      notes=coalesce(nullif(btrim(p_note),''),alias.notes),
      status=p_status
    where alias.id=v_existing.id
    returning alias.* into v_after;
  else
    if p_status<>'active' then
      raise exception using errcode='P0002',
        message='Only an existing Artist alias may be blocked.';
    end if;

    v_before:=null;
    insert into public.registry_artist_aliases (
      alias_slug,canonical_artist_id,alias_display_name,
      confidence,source,created_by,notes,status
    )
    values (
      v_alias_slug,
      p_canonical_artist_id,
      coalesce(nullif(btrim(p_alias_display_name),''),v_alias_slug),
      100,
      p_source,
      'user:'||p_actor_user_id::text,
      nullif(btrim(p_note),''),
      'active'
    )
    returning * into v_after;
  end if;

  insert into public.registry_audit_log (
    actor_id,actor_label,action,entity_type,entity_id,
    before_value,after_value,metadata
  )
  values (
    p_actor_user_id,
    'registry_admin',
    case when p_status='active' then 'artist_alias_set' else 'artist_alias_blocked' end,
    'artist',
    p_canonical_artist_id,
    v_before,
    to_jsonb(v_after),
    jsonb_build_object(
      'authority',p_authority,
      'alias_id',v_after.id,
      'alias_slug',v_after.alias_slug,
      'alias_status',v_after.status
    )
  );

  return to_jsonb(v_after);
end
$$;

create or replace view public.registry_relationship_endpoint_work_queue
with (security_invoker=true)
as
select
  unresolved.relationship_id,
  unresolved.missing_side,
  unresolved.missing_entity_type,
  unresolved.legacy_slug,
  unresolved.relationship_type,
  unresolved.relationship_role,
  unresolved.source_entity_id,
  unresolved.target_entity_id,
  count(alias.canonical_artist_id)::integer as alias_match_count,
  min(alias.canonical_artist_id::text)::uuid as alias_candidate_id,
  case
    when count(alias.canonical_artist_id)=1 then 'ready_to_resolve'
    when count(alias.canonical_artist_id)>1 then 'ambiguous_alias'
    else 'missing_entity'
  end as endpoint_work_state
from public.registry_unresolved_relationship_endpoints unresolved
left join public.registry_artist_aliases alias
  on unresolved.missing_entity_type='artist'
 and alias.alias_slug=unresolved.legacy_slug
 and coalesce(alias.status,'active')='active'
group by
  unresolved.relationship_id,
  unresolved.missing_side,
  unresolved.missing_entity_type,
  unresolved.legacy_slug,
  unresolved.relationship_type,
  unresolved.relationship_role,
  unresolved.source_entity_id,
  unresolved.target_entity_id;

create or replace function public.resolve_registry_relationship_endpoint_from_alias(
  p_relationship_id uuid,
  p_endpoint_side text,
  p_reason text
)
returns public.registry_entity_relationships
language plpgsql
security definer
set search_path=pg_catalog,public,auth
as $resolver$
declare
  v_relationship public.registry_entity_relationships%rowtype;
  v_slug text;
  v_candidate_id uuid;
  v_match_count integer;
  v_result public.registry_entity_relationships%rowtype;
begin
  if not (
       auth.role()='service_role'
       or coalesce(public.current_user_has_capability('manage_registry'),false)
       or coalesce(public.current_user_has_capability('manage_review_queue'),false)
       or coalesce(public.current_user_is_administrator(),false)
     )
  then
    raise exception using errcode='42501',
      message='You do not have permission to resolve Registry relationship endpoints.';
  end if;

  if p_endpoint_side not in ('source','target') then
    raise exception using errcode='22023',
      message='Endpoint side must be source or target.';
  end if;

  if nullif(btrim(p_reason),'') is null then
    raise exception using errcode='22023',
      message='A resolution reason is required.';
  end if;

  select relationship.*
  into v_relationship
  from public.registry_entity_relationships relationship
  where relationship.id=p_relationship_id
  for update;

  if not found then
    raise exception using errcode='P0002',
      message='Registry relationship not found.';
  end if;

  v_slug:=case
    when p_endpoint_side='source' then v_relationship.source_slug
    else v_relationship.target_slug
  end;

  select
    count(*)::integer,
    min(alias.canonical_artist_id::text)::uuid
  into v_match_count,v_candidate_id
  from public.registry_artist_aliases alias
  where alias.alias_slug=v_slug
    and coalesce(alias.status,'active')='active';

  if v_match_count=0 then
    raise exception using errcode='P0002',
      message='No active canonical artist alias match was found.';
  end if;

  if v_match_count>1 then
    raise exception using errcode='23514',
      message='The artist alias is ambiguous and requires manual review.';
  end if;

  select public.resolve_registry_relationship_endpoint(
    p_relationship_id,
    p_endpoint_side,
    'artist',
    v_candidate_id,
    p_reason
  )
  into v_result;

  return v_result;
end
$resolver$;

create function public.admin_set_registry_artist_alias_v1(
  p_alias_slug text,
  p_canonical_artist_id uuid,
  p_alias_display_name text default null,
  p_source text default 'manual',
  p_status text default 'active',
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,auth
as $$
declare
  v_user_id uuid:=auth.uid();
  v_alias jsonb;
  v_alias_slug text:=public.wk_slugify_text(p_alias_slug);
  v_canonical public.registry_artists%rowtype;
  v_chart_rows integer:=0;
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

  v_alias:=platform_private.execute_registry_artist_alias_state_v1(
    v_alias_slug,
    p_canonical_artist_id,
    p_alias_display_name,
    p_source,
    p_status,
    p_note,
    v_user_id,
    'admin_set_registry_artist_alias_v1'
  );

  if p_status='active' then
    update public.wk_chart_entries_v2 entry
    set
      artist_slug=v_canonical.slug,
      canonical_artist_id=v_canonical.id::text,
      updated_at=now()
    from public.registry_tracks track
    where track.id::text=entry.canonical_track_id::text
      and public.wk_slugify_text(entry.artist_slug)=v_alias_slug
      and v_canonical.id=(
        select credit.artist_id
        from public.registry_track_artists credit
        where credit.track_id=track.id
          and credit.is_primary is true
        order by
          credit.credit_order asc nulls last,
          credit.created_at asc,
          credit.id asc
        limit 1
      );

    get diagnostics v_chart_rows=row_count;
  end if;

  return jsonb_build_object(
    'alias',v_alias,
    'chartEntriesUpdated',v_chart_rows
  );
end
$$;

revoke all on function
  platform_private.execute_registry_reviewed_artist_identity_materialization_v1(
    text,text,text,text,text,text,jsonb,text
  ),
  platform_private.execute_registry_artist_alias_state_v1(
    text,uuid,text,text,text,text,uuid,text
  )
from public,anon,authenticated,service_role;

revoke all on function
  public.admin_set_registry_artist_alias_v1(
    text,uuid,text,text,text,text
  )
from public,anon,service_role;
grant execute on function
  public.admin_set_registry_artist_alias_v1(
    text,uuid,text,text,text,text
  )
to authenticated;

create or replace function public.community_admin_decide_artist_claim(
  p_claim_id uuid,
  p_decision text,
  p_reason text,
  p_can_manage_profile boolean default null,
  p_can_submit_releases boolean default null,
  p_can_post_updates boolean default null,
  p_can_manage_team boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public, editorial, platform_private
as $function$
declare
  v_actor uuid := auth.uid();
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_reason text := trim(coalesce(p_reason, ''));
  v_claim public.artist_claim_requests%rowtype;
  v_proposal public.artist_claim_proposed_identities%rowtype;
  v_defaults record;
  v_representation_id uuid;
  v_profile boolean;
  v_releases boolean;
  v_updates boolean;
  v_team boolean;
  v_artist_id uuid;
  v_artist_slug text;
  v_match_count integer := 0;
  v_alt text;
  v_materialized jsonb;
  v_required_capability text;
  v_before_artist jsonb;
  v_after_artist jsonb;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;

  if not editorial.current_user_can_review_artist_claims() then
    raise exception 'insufficient_privilege';
  end if;

  if v_decision not in ('verified', 'rejected') then
    raise exception 'invalid_claim_decision';
  end if;

  if char_length(v_reason) < 3
     or char_length(v_reason) > 4000
  then
    raise exception 'invalid_claim_decision_reason';
  end if;

  select *
  into v_claim
  from public.artist_claim_requests
  where id = p_claim_id
  for update;

  if not found then
    raise exception 'claim_not_found';
  end if;

  if v_claim.status <> 'pending' then
    raise exception 'claim_not_pending';
  end if;

  if v_claim.claimant_user_id is null then
    raise exception 'claimant_account_missing';
  end if;

  if v_decision = 'rejected' then
    update public.artist_claim_requests
    set
      status = 'rejected',
      decided_at = now(),
      decided_by = v_actor,
      decision_reason = v_reason,
      updated_at = now()
    where id = v_claim.id;

    if v_claim.artist_id is not null then
      perform editorial.record_artist_representation_event(
        v_claim.artist_id,
        'claim_rejected',
        v_claim.id,
        null,
        v_claim.claimant_user_id,
        jsonb_build_object('reason', v_reason)
      );
    end if;

    insert into public.admin_audit_events (
      actor_user_id,
      target_user_id,
      event_type,
      target_table,
      target_record_id,
      message,
      metadata
    )
    values (
      v_actor,
      v_claim.claimant_user_id,
      'artist_claim_rejected',
      'artist_claim_requests',
      v_claim.id::text,
      v_reason,
      jsonb_build_object(
        'artist_id', v_claim.artist_id,
        'claim_kind', v_claim.claim_kind
      )
    );

    perform editorial.sync_artist_portal_roles(v_claim.claimant_user_id);

    return jsonb_build_object(
      'claim_id', v_claim.id,
      'status', 'rejected',
      'claim_kind', v_claim.claim_kind
    );
  end if;

  if v_claim.claim_kind = 'proposed_artist'
     and v_claim.artist_id is null
  then
    select *
    into v_proposal
    from public.artist_claim_proposed_identities proposal
    where proposal.claim_id = v_claim.id
    for update;

    if not found then
      raise exception 'proposed_artist_identity_missing';
    end if;

    select count(*)::integer
    into v_match_count
    from platform_private.mizizi_resolve_artist_identity_candidates(
      v_proposal.display_name,
      v_proposal.artist_type,
      v_proposal.origin_iso2,
      8
    ) candidate
    where candidate.match_tier in ('exact', 'strong');

    if v_match_count > 0 then
      raise exception 'artist_identity_resolution_required';
    end if;

    v_artist_slug := public.wk_slugify_text(v_proposal.display_name);

    if char_length(v_artist_slug) < 2 then
      raise exception 'artist_slug_invalid';
    end if;

    if exists (
      select 1
      from public.registry_artists artist
      where artist.slug = v_artist_slug
    )
       or exists (
         select 1
         from public.registry_artist_aliases alias
         where alias.alias_slug = v_artist_slug
           and coalesce(alias.status, 'active') = 'active'
       )
    then
      raise exception 'artist_slug_conflict';
    end if;

    v_required_capability := case
      when coalesce(public.current_user_has_capability('manage_users'), false)
        then 'manage_users'
      when coalesce(public.current_user_has_capability('manage_registry'), false)
        then 'manage_registry'
      else null
    end;

    if v_required_capability is null then
      raise exception 'artist_claim_exact_grant_capability_missing';
    end if;

    v_materialized :=
      platform_private.execute_registry_reviewed_artist_identity_materialization_v1(
        'artist_claim_review',
        'artist-claim:' || v_claim.id::text,
        v_proposal.display_name,
        v_proposal.normalized_name,
        v_artist_slug,
        v_proposal.mizizi_fingerprint,
        jsonb_build_object(
          'claim_id', v_claim.id,
          'claim_kind', v_claim.claim_kind,
          'artist_type', v_proposal.artist_type,
          'origin_iso2', v_proposal.origin_iso2,
          'alternate_names', to_jsonb(v_proposal.alternate_names),
          'decision_reason', v_reason
        ),
        v_required_capability
      );

    v_artist_id := (v_materialized ->> 'artist_id')::uuid;

    select to_jsonb(artist)
    into v_before_artist
    from public.registry_artists artist
    where artist.id = v_artist_id;

    update public.registry_artists artist
    set
      artist_type = v_proposal.artist_type,
      origin_iso2 = v_proposal.origin_iso2,
      origin_confidence =
        case when v_proposal.origin_iso2 is null then null else 1.0 end,
      status = 'active',
      metadata = coalesce(artist.metadata, '{}'::jsonb) || jsonb_build_object(
        'source', 'artist_claim',
        'claim_id', v_claim.id,
        'approved_by', v_actor,
        'identity_operation_id', v_materialized ->> 'operation_id'
      ),
      updated_at = now()
    where artist.id = v_artist_id
      and artist.status = 'draft'
    returning to_jsonb(artist)
    into v_after_artist;

    if v_after_artist is null then
      raise exception 'artist_claim_materialized_identity_not_draft';
    end if;

    foreach v_alt in array v_proposal.alternate_names
    loop
      if char_length(public.wk_slugify_text(v_alt)) >= 2 then
        perform platform_private.execute_registry_artist_alias_state_v1(
          public.wk_slugify_text(v_alt),
          v_artist_id,
          v_alt,
          'manual',
          'active',
          'Accepted from reviewed Artist claim ' || v_claim.id::text,
          v_actor,
          'artist_claim_review'
        );
      end if;
    end loop;

    update public.artist_claim_proposed_identities
    set
      accepted_artist_id = v_artist_id,
      updated_at = now()
    where claim_id = v_claim.id;

    update public.artist_claim_requests
    set
      artist_id = v_artist_id,
      updated_at = now()
    where id = v_claim.id;

    v_claim.artist_id := v_artist_id;

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
      'artist',
      v_artist_id::text,
      v_claim.id::text,
      'artist_claim_proposed_identities',
      'claim_profile_lifecycle',
      'registry_artists',
      jsonb_build_object('value', v_before_artist),
      jsonb_build_object('value', v_after_artist),
      'apply_reviewed_artist_claim_profile',
      'succeeded',
      'user:' || v_actor::text
    );

  end if;

  if v_claim.artist_id is null then
    raise exception 'artist_identity_resolution_required';
  end if;

  select *
  into v_defaults
  from editorial.artist_representation_defaults(v_claim.claimant_role);

  v_profile := coalesce(p_can_manage_profile, v_defaults.can_manage_profile);
  v_releases := coalesce(p_can_submit_releases, v_defaults.can_submit_releases);
  v_updates := coalesce(p_can_post_updates, v_defaults.can_post_updates);
  v_team := coalesce(p_can_manage_team, v_defaults.can_manage_team);

  select representation.id
  into v_representation_id
  from public.artist_representations representation
  where representation.artist_id = v_claim.artist_id
    and representation.user_id = v_claim.claimant_user_id
    and representation.status in ('pending', 'active')
  order by representation.created_at desc
  limit 1
  for update;

  if v_representation_id is null then
    insert into public.artist_representations (
      artist_id,
      user_id,
      representation_role,
      status,
      source_claim_id,
      can_manage_profile,
      can_submit_releases,
      can_post_updates,
      can_manage_team,
      accepted_at,
      verified_by,
      verified_at
    )
    values (
      v_claim.artist_id,
      v_claim.claimant_user_id,
      v_claim.claimant_role,
      'active',
      v_claim.id,
      v_profile,
      v_releases,
      v_updates,
      v_team,
      now(),
      v_actor,
      now()
    )
    returning id into v_representation_id;
  else
    update public.artist_representations
    set
      representation_role = v_claim.claimant_role,
      status = 'active',
      source_claim_id = v_claim.id,
      can_manage_profile = v_profile,
      can_submit_releases = v_releases,
      can_post_updates = v_updates,
      can_manage_team = v_team,
      accepted_at = coalesce(accepted_at, now()),
      verified_by = v_actor,
      verified_at = now(),
      revoked_by = null,
      revoked_at = null,
      revocation_reason = null,
      updated_at = now()
    where id = v_representation_id;
  end if;

  update public.artist_claim_requests
  set
    status = 'verified',
    decided_at = now(),
    decided_by = v_actor,
    decision_reason = v_reason,
    updated_at = now()
  where id = v_claim.id;

  perform editorial.record_artist_representation_event(
    v_claim.artist_id,
    'claim_verified',
    v_claim.id,
    v_representation_id,
    v_claim.claimant_user_id,
    jsonb_build_object(
      'reason', v_reason,
      'role', v_claim.claimant_role,
      'permissions', jsonb_build_object(
        'profile', v_profile,
        'releases', v_releases,
        'updates', v_updates,
        'team', v_team
      )
    )
  );

  insert into public.admin_audit_events (
    actor_user_id,
    target_user_id,
    event_type,
    target_table,
    target_record_id,
    message,
    metadata
  )
  values (
    v_actor,
    v_claim.claimant_user_id,
    'artist_claim_verified',
    'artist_claim_requests',
    v_claim.id::text,
    v_reason,
    jsonb_build_object(
      'artist_id', v_claim.artist_id,
      'claim_kind', v_claim.claim_kind,
      'representation_id', v_representation_id,
      'role', v_claim.claimant_role,
      'permissions', jsonb_build_object(
        'profile', v_profile,
        'releases', v_releases,
        'updates', v_updates,
        'team', v_team
      )
    )
  );

  perform editorial.sync_artist_portal_roles(v_claim.claimant_user_id);

  return jsonb_build_object(
    'claim_id', v_claim.id,
    'status', 'verified',
    'claim_kind', v_claim.claim_kind,
    'artist_id', v_claim.artist_id,
    'artist_status', (
      select artist.status
      from public.registry_artists artist
      where artist.id = v_claim.artist_id
    ),
    'representation_id', v_representation_id,
    'permissions', jsonb_build_object(
      'profile', v_profile,
      'releases', v_releases,
      'updates', v_updates,
      'team', v_team
    )
  );
end;
$function$;

create or replace function public.accept_registry_missing_artist_intake(
  p_submission_id uuid,
  p_review_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,auth,extensions
as $$
declare
  v_user_id uuid:=auth.uid();
  s public.contributor_submissions%rowtype;
  v_slug text;
  v_display_name text;
  v_normalized_name text;
  v_source_fingerprint text;
  v_required_capability text;
  v_materialized jsonb;
  v_artist_id uuid;
  v_before_artist jsonb;
  v_after_artist jsonb;
  v_source_count integer:=0;
  v_target_count integer:=0;
  r record;
begin
  if v_user_id is null then
    raise exception using errcode='42501', message='authentication_required';
  end if;

  v_required_capability:=case
    when coalesce(public.current_user_has_capability('manage_registry'),false)
      then 'manage_registry'
    when coalesce(public.current_user_has_capability('manage_review_queue'),false)
      then 'manage_review_queue'
    else null
  end;

  if v_required_capability is null
     and not coalesce(public.current_user_is_administrator(),false)
  then
    raise exception using errcode='42501',
      message='You do not have permission to accept Registry artist intake submissions.';
  end if;

  if v_required_capability is null then
    v_required_capability:='manage_registry';
  end if;

  if nullif(btrim(p_review_reason),'') is null then
    raise exception 'A review reason is required.';
  end if;

  select *
  into s
  from public.contributor_submissions
  where id=p_submission_id
  for update;

  if not found then raise exception 'Contributor submission not found.'; end if;
  if s.submission_type<>'context_note' then
    raise exception 'This submission is not a missing-artist intake record.';
  end if;

  v_slug:=substring(s.source_note from '^missing_artist_slug:([^[:space:]]+)');

  if nullif(v_slug,'') is null then
    raise exception 'The submission does not contain a missing artist slug.';
  end if;
  if s.review_status not in (
       'submitted','triaged','needs_source','needs_clarification'
     )
  then
    raise exception 'This intake submission is not in an acceptable review state.';
  end if;
  if not exists (
       select 1
       from public.registry_relationship_endpoint_work_queue q
       where q.endpoint_work_state='missing_entity'
         and q.missing_entity_type='artist'
         and q.legacy_slug=v_slug
     )
  then
    raise exception 'This artist is no longer required by the missing endpoint queue.';
  end if;
  if exists (
       select 1
       from public.registry_artists artist
       where lower(artist.slug)=lower(v_slug)
     )
  then
    raise exception 'A Registry artist already exists for this slug.';
  end if;

  v_display_name:=btrim(s.title);
  v_normalized_name:=
    platform_private.registry_identity_normalize_text_v1(v_display_name);
  v_source_fingerprint:=encode(
    extensions.digest(
      jsonb_build_object(
        'submission_id',s.id,
        'title',s.title,
        'source_note',s.source_note,
        'source_url',s.source_url,
        'body',s.body
      )::text,
      'sha256'
    ),
    'hex'
  );

  v_materialized:=
    platform_private.execute_registry_reviewed_artist_identity_materialization_v1(
      'missing_artist_intake_review',
      'missing-artist-intake:'||s.id::text,
      v_display_name,
      v_normalized_name,
      v_slug,
      v_source_fingerprint,
      jsonb_build_object(
        'submission_id',s.id,
        'legacy_slug',v_slug,
        'source_url',s.source_url,
        'intake_reason',s.body,
        'review_reason',btrim(p_review_reason)
      ),
      v_required_capability
    );

  v_artist_id:=(v_materialized->>'artist_id')::uuid;

  select to_jsonb(artist)
  into v_before_artist
  from public.registry_artists artist
  where artist.id=v_artist_id;

  update public.registry_artists artist
  set
    artist_type='unknown',
    status='needs_review',
    metadata=coalesce(artist.metadata,'{}'::jsonb)||jsonb_build_object(
      'created_from','missing_artist_intake',
      'source_submission_id',s.id::text,
      'source_url',s.source_url,
      'intake_reason',s.body,
      'acceptance_reason',btrim(p_review_reason),
      'identity_operation_id',v_materialized->>'operation_id',
      'created_at',now()
    ),
    updated_at=now()
  where artist.id=v_artist_id
    and artist.status='draft'
  returning to_jsonb(artist)
  into v_after_artist;

  if v_after_artist is null then
    raise exception 'Missing Artist Intake identity did not remain an exact draft before review-state transition.';
  end if;

  perform platform_private.execute_registry_artist_alias_state_v1(
    v_slug,
    v_artist_id,
    v_display_name,
    'manual',
    'active',
    btrim(p_review_reason),
    v_user_id,
    'missing_artist_intake_review'
  );

  for r in
    select id
    from public.registry_entity_relationships
    where relationship_status<>'archived'
      and source_entity_id is null
      and source_entity_type='artist'
      and source_slug=v_slug
  loop
    perform public.resolve_registry_relationship_endpoint(
      r.id,'source','artist',v_artist_id,btrim(p_review_reason)
    );
    v_source_count:=v_source_count+1;
  end loop;

  for r in
    select id
    from public.registry_entity_relationships
    where relationship_status<>'archived'
      and target_entity_id is null
      and target_entity_type='artist'
      and target_slug=v_slug
  loop
    perform public.resolve_registry_relationship_endpoint(
      r.id,'target','artist',v_artist_id,btrim(p_review_reason)
    );
    v_target_count:=v_target_count+1;
  end loop;

  update public.contributor_submissions
  set entity_id=v_artist_id,
      review_status='merged',
      reviewed_by=v_user_id,
      reviewed_at=now(),
      review_note=btrim(p_review_reason),
      updated_at=now()
  where id=p_submission_id;

  insert into public.review_decisions(
    subject_type,subject_id,decision,reason,reviewer_id
  )
  values (
    'contributor_submission',
    p_submission_id,
    'approved',
    btrim(p_review_reason),
    v_user_id
  );

  insert into public.registry_canonical_write_events (
    registry_entity_type,registry_entity_id,source_suggestion_id,source_table,
    field_name,target_path,before_value,after_value,action,status,actor
  )
  values (
    'artist',
    v_artist_id::text,
    p_submission_id::text,
    'contributor_submissions',
    'missing_artist_review_state',
    'public.registry_artists',
    jsonb_build_object('value',v_before_artist),
    jsonb_build_object('value',v_after_artist),
    'apply_missing_artist_intake_review',
    'succeeded',
    'user:'||v_user_id::text
  );

  return jsonb_build_object(
    'submissionId',p_submission_id,
    'artistId',v_artist_id,
    'artistSlug',v_slug,
    'artistStatus','needs_review',
    'sourceEndpointsResolved',v_source_count,
    'targetEndpointsResolved',v_target_count,
    'relationshipsResolved',v_source_count+v_target_count,
    'publicSafe',false,
    'operationId',v_materialized->>'operation_id',
    'verifierStatus',v_materialized->>'verifier_status'
  );
end
$$;

revoke all on function public.accept_registry_missing_artist_intake(uuid,text)
from public,anon,service_role;
grant execute on function public.accept_registry_missing_artist_intake(uuid,text)
to authenticated;

create or replace function public.admin_create_registry_artist_for_decouple(
  p_display_name text,
  p_slug text default null,
  p_status text default 'needs_review',
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,auth,extensions
as $$
declare
  v_user_id uuid:=auth.uid();
  v_display_name text;
  v_slug text;
  v_artist public.registry_artists%rowtype;
  v_created boolean:=false;
  v_source_fingerprint text;
  v_materialized jsonb;
  v_before_artist jsonb;
  v_after_artist jsonb;
begin
  if v_user_id is null
     or not coalesce(public.current_user_has_capability('manage_registry'),false)
  then
    raise exception 'insufficient_privilege';
  end if;

  v_display_name:=nullif(btrim(coalesce(p_display_name,'')),'');
  if v_display_name is null then raise exception 'display_name_required'; end if;

  v_slug:=public.wk_slugify_text(
    coalesce(nullif(btrim(p_slug),''),v_display_name)
  );
  if v_slug='' then raise exception 'artist_slug_required'; end if;

  if coalesce(nullif(btrim(p_status),''),'needs_review')<>'needs_review' then
    raise exception 'decouple_artist_status_must_be_needs_review';
  end if;

  select artist.*
  into v_artist
  from public.registry_artists artist
  where lower(artist.slug)=lower(v_slug)
  limit 1;

  if not found then
    v_source_fingerprint:=encode(
      extensions.digest(
        jsonb_build_object(
          'display_name',v_display_name,
          'slug',v_slug,
          'note',nullif(btrim(p_note),'')
        )::text,
        'sha256'
      ),
      'hex'
    );

    v_materialized:=
      platform_private.execute_registry_reviewed_artist_identity_materialization_v1(
        'artist_decouple_review',
        'artist-decouple:'||v_slug,
        v_display_name,
        platform_private.registry_identity_normalize_text_v1(v_display_name),
        v_slug,
        v_source_fingerprint,
        jsonb_build_object(
          'display_name',v_display_name,
          'slug',v_slug,
          'note',nullif(btrim(p_note),'')
        ),
        'manage_registry'
      );

    select to_jsonb(artist)
    into v_before_artist
    from public.registry_artists artist
    where artist.id=(v_materialized->>'artist_id')::uuid;

    update public.registry_artists artist
    set
      status='needs_review',
      metadata=coalesce(artist.metadata,'{}'::jsonb)||jsonb_build_object(
        'created_for','artist_decouple',
        'created_from_admin_decouple',true,
        'decouple_note',p_note,
        'identity_operation_id',v_materialized->>'operation_id',
        'created_at',now()
      ),
      updated_at=now()
    where artist.id=(v_materialized->>'artist_id')::uuid
      and artist.status='draft'
    returning artist.*
    into v_artist;

    if not found then
      raise exception 'Decouple Artist identity did not remain an exact draft before review-state transition.';
    end if;

    v_after_artist:=to_jsonb(v_artist);

    insert into public.registry_canonical_write_events (
      registry_entity_type,registry_entity_id,source_suggestion_id,source_table,
      field_name,target_path,before_value,after_value,action,status,actor
    )
    values (
      'artist',
      v_artist.id::text,
      null,
      'public.admin_create_registry_artist_for_decouple',
      'decouple_review_state',
      'public.registry_artists',
      jsonb_build_object('value',v_before_artist),
      jsonb_build_object('value',v_after_artist),
      'apply_decouple_artist_review_state',
      'succeeded',
      'user:'||v_user_id::text
    );

    v_created:=true;
  end if;

  return jsonb_build_object(
    'created',v_created,
    'artist',jsonb_build_object(
      'artist_id',v_artist.id,
      'artist_slug',v_artist.slug,
      'display_name',v_artist.display_name,
      'status',v_artist.status,
      'origin_iso2',v_artist.origin_iso2,
      'public_image_url',v_artist.public_image_url,
      'track_credit_count',0,
      'release_credit_count',0
    ),
    'operation_id',case when v_materialized is null then null else v_materialized->>'operation_id' end,
    'verifier_status',case when v_materialized is null then null else v_materialized->>'verifier_status' end
  );
end
$$;

revoke all on function
  public.admin_create_registry_artist_for_decouple(text,text,text,text)
from public,anon,service_role;
grant execute on function
  public.admin_create_registry_artist_for_decouple(text,text,text,text)
to authenticated;

drop policy if exists "Admins can delete artist aliases"
  on public.registry_artist_aliases;
drop policy if exists "Admins can insert artist aliases"
  on public.registry_artist_aliases;
drop policy if exists "Admins can update artist aliases"
  on public.registry_artist_aliases;

revoke insert,update,delete,truncate,references,trigger
on public.registry_artist_aliases
from PUBLIC,anon,authenticated,service_role;

commit;
