-- MIZIZI Slice 3 Registry Provider Link Admin Authority V1
--
-- Converges the generic authenticated Registry Track provider-link upsert onto
-- the accepted evidence -> exact grant -> mutation operation -> canonical write
-- event -> independent verifier authority. The legacy direct SECURITY DEFINER
-- upsert remains only as an owner-internal implementation primitive and loses
-- all anon/authenticated/service_role/PUBLIC execution authority.

begin;
set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'mizizi-slice3-registry-provider-link-admin-authority-v1',
    0
  )
);

do $preflight$
begin
  if to_regclass('public.registry_track_provider_links') is null
     or to_regclass('public.registry_tracks') is null
     or to_regclass('public.registry_canonical_write_events') is null
     or to_regclass('platform_private.registry_evidence_assertions') is null
     or to_regclass('platform_private.registry_operation_types') is null
     or to_regclass('platform_private.registry_execution_grants') is null
     or to_regclass('platform_private.registry_execution_grant_targets') is null
     or to_regclass('platform_private.registry_mutation_operations') is null
     or to_regclass('platform_private.registry_operation_write_events') is null
     or to_regprocedure('platform_private.begin_registry_mutation_operation(text,uuid)') is null
     or to_regprocedure('platform_private.registry_subject_state_fingerprint(text,uuid)') is null
     or to_regprocedure('platform_private.registry_plan_fingerprint(jsonb)') is null
     or to_regprocedure(
       'public.registry_upsert_track_provider_link(uuid,text,text,text,text[],text,text,text,text,integer,text,text,numeric,text,jsonb)'
     ) is null
     or to_regprocedure('public.current_user_has_capability(text)') is null
  then
    raise exception 'STOP: accepted Registry provider-link authority foundation is missing';
  end if;

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
      and operation_type.requires_human_approval
      and operation_type.requires_verifier
  ) then
    raise exception 'STOP: Registry Track provider-link typed operation is missing or malformed';
  end if;

  if exists (
       select 1
       from platform_private.system_actors actor
       where actor.actor_key='registry_provider_link_admin'
     )
     or to_regprocedure(
       'platform_private.registry_provider_link_admin_current_user_v1()'
     ) is not null
     or to_regprocedure(
       'platform_private.registry_provider_link_admin_claim_v1(uuid,text,text,text,text[],text,text,text,text,integer,text,text,numeric,text,jsonb)'
     ) is not null
     or to_regprocedure(
       'platform_private.registry_provider_link_state_fingerprint_v1(uuid,text,text)'
     ) is not null
     or to_regprocedure(
       'platform_private.registry_provider_link_matches_claim_v1(uuid,jsonb)'
     ) is not null
     or to_regprocedure(
       'platform_private.record_registry_provider_link_admin_evidence_v1(uuid,jsonb)'
     ) is not null
     or to_regprocedure(
       'platform_private.issue_registry_provider_link_admin_grant_v1(uuid)'
     ) is not null
     or to_regprocedure(
       'platform_private.execute_registry_provider_link_admin_v1(uuid)'
     ) is not null
     or to_regprocedure(
       'platform_private.verify_registry_provider_link_admin_v1(uuid)'
     ) is not null
     or to_regprocedure(
       'public.admin_admit_registry_track_provider_link_v1(uuid,text,text,text,text[],text,text,text,text,integer,text,text,numeric,text,jsonb)'
     ) is not null
  then
    raise exception 'STOP: Registry Provider Link Admin Authority V1 already exists';
  end if;
end
$preflight$;

insert into platform_private.system_actors (
  actor_key,
  label,
  actor_kind,
  status,
  capability_profile
)
values (
  'registry_provider_link_admin',
  'Registry Provider Link Admin Broker',
  'automation',
  'active',
  jsonb_build_object(
    'domain','registry',
    'authority_mode','human_exact_grant',
    'required_user_capability','manage_registry',
    'operation_family',
      jsonb_build_array('registry.track.provider_link.admit/v1')
  )
);

insert into platform_private.system_actor_executor_bindings (
  actor_key,
  executor_kind,
  executor_key,
  status
)
values (
  'registry_provider_link_admin',
  'database_role',
  'authenticator',
  'active'
);

create function platform_private.registry_provider_link_admin_current_user_v1()
returns uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null
     or not coalesce(public.current_user_has_capability('manage_registry'),false)
  then
    raise exception using errcode='42501',
      message='manage_registry is required.';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings binding
    where binding.actor_key='registry_provider_link_admin'
      and binding.executor_kind='database_role'
      and binding.executor_key=session_user
      and binding.status='active'
  ) then
    raise exception using errcode='42501',
      message='Current transport is not the Registry provider-link admin broker.';
  end if;

  return v_user_id;
end
$$;

create function platform_private.registry_provider_link_admin_claim_v1(
  p_track_id uuid,
  p_provider_key text,
  p_provider_track_id text,
  p_provider_release_id text default null,
  p_provider_artist_ids text[] default null,
  p_isrc text default null,
  p_upc text default null,
  p_preview_url text default null,
  p_artwork_url text default null,
  p_duration_ms integer default null,
  p_storefront text default null,
  p_match_method text default 'unknown',
  p_match_confidence numeric default 0,
  p_match_status text default 'matched',
  p_raw_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_provider_key text :=
    lower(nullif(btrim(coalesce(p_provider_key,'')),''));
  v_provider_track_id text :=
    nullif(btrim(coalesce(p_provider_track_id,'')),'');
  v_match_method text :=
    coalesce(nullif(btrim(coalesce(p_match_method,'')),''),'unknown');
  v_match_status text :=
    coalesce(nullif(btrim(coalesce(p_match_status,'')),''),'matched');
  v_match_confidence numeric :=
    least(greatest(coalesce(p_match_confidence,0),0),1);
begin
  if p_track_id is null then
    raise exception using errcode='22023',
      message='track_id is required.';
  end if;

  if v_provider_key is null
     or v_provider_key !~ '^[a-z0-9_]+$'
  then
    raise exception using errcode='22023',
      message='provider_key is required and must be lowercase provider identity.';
  end if;

  if v_provider_track_id is null then
    raise exception using errcode='22023',
      message='provider_track_id is required.';
  end if;

  if p_duration_ms is not null and p_duration_ms<=0 then
    raise exception using errcode='22023',
      message='duration_ms must be positive when present.';
  end if;

  if v_match_method not in (
    'isrc','isrc_duration','upc_track_number','exact_title_artist',
    'fuzzy_title_artist','manual','source_import','unknown'
  ) then
    raise exception using errcode='22023',
      message='Unsupported provider match method.';
  end if;

  if v_match_status not in (
    'matched','needs_review','rejected','unavailable','stale'
  ) then
    raise exception using errcode='22023',
      message='Unsupported provider match status.';
  end if;

  if not exists (
    select 1
    from public.registry_tracks track
    where track.id=p_track_id
  ) then
    raise exception using errcode='P0002',
      message='Registry Track not found.';
  end if;

  return jsonb_build_object(
    'track_id',p_track_id::text,
    'provider_key',v_provider_key,
    'provider_track_id',v_provider_track_id,
    'provider_release_id',
      nullif(btrim(coalesce(p_provider_release_id,'')),''),
    'provider_artist_ids',
      to_jsonb(coalesce(p_provider_artist_ids,'{}'::text[])),
    'isrc',nullif(upper(btrim(coalesce(p_isrc,''))),''),
    'upc',nullif(btrim(coalesce(p_upc,'')),''),
    'preview_url',nullif(btrim(coalesce(p_preview_url,'')),''),
    'artwork_url',nullif(btrim(coalesce(p_artwork_url,'')),''),
    'duration_ms',p_duration_ms,
    'storefront',lower(nullif(btrim(coalesce(p_storefront,'')),''),
    'match_method',v_match_method,
    'match_confidence',v_match_confidence,
    'match_status',v_match_status,
    'raw_payload',coalesce(p_raw_payload,'{}'::jsonb)
  );
end
$$;

create function platform_private.registry_provider_link_state_fingerprint_v1(
  p_track_id uuid,
  p_provider_key text,
  p_provider_track_id text
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_state jsonb;
begin
  select to_jsonb(link)
  into v_state
  from public.registry_track_provider_links link
  where link.track_id=p_track_id
    and link.provider_key=p_provider_key
    and link.provider_track_id=p_provider_track_id;

  if v_state is null then
    return null;
  end if;

  return encode(
    extensions.digest(v_state::text,'sha256'),
    'hex'
  );
end
$$;

create function platform_private.registry_provider_link_matches_claim_v1(
  p_track_id uuid,
  p_claim jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_link public.registry_track_provider_links%rowtype;
begin
  select link.*
  into v_link
  from public.registry_track_provider_links link
  where link.track_id=p_track_id
    and link.provider_key=p_claim->>'provider_key'
    and link.provider_track_id=p_claim->>'provider_track_id';

  if not found then
    return false;
  end if;

  return
    v_link.provider_release_id is not distinct from
      nullif(p_claim->>'provider_release_id','')
    and to_jsonb(v_link.provider_artist_ids) is not distinct from
      coalesce(p_claim->'provider_artist_ids','[]'::jsonb)
    and v_link.isrc is not distinct from nullif(p_claim->>'isrc','')
    and v_link.upc is not distinct from nullif(p_claim->>'upc','')
    and v_link.preview_url is not distinct from
      nullif(p_claim->>'preview_url','')
    and v_link.artwork_url is not distinct from
      nullif(p_claim->>'artwork_url','')
    and v_link.duration_ms is not distinct from
      case
        when p_claim->>'duration_ms' is null then null
        else (p_claim->>'duration_ms')::integer
      end
    and v_link.storefront is not distinct from
      nullif(p_claim->>'storefront','')
    and v_link.match_method is not distinct from
      p_claim->>'match_method'
    and v_link.match_confidence is not distinct from
      (p_claim->>'match_confidence')::numeric
    and v_link.match_status is not distinct from
      p_claim->>'match_status'
    and v_link.raw_payload is not distinct from
      coalesce(p_claim->'raw_payload','{}'::jsonb);
end
$$;

create function platform_private.record_registry_provider_link_admin_evidence_v1(
  p_track_id uuid,
  p_claim jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth, extensions
as $$
declare
  v_user_id uuid;
  v_source_payload_fingerprint text;
  v_assertion_fingerprint text;
  v_assertion_id uuid;
  v_source_ref text;
begin
  v_user_id :=
    platform_private.registry_provider_link_admin_current_user_v1();

  if p_track_id is null
     or p_claim->>'track_id' is distinct from p_track_id::text
     or nullif(p_claim->>'provider_key','') is null
     or nullif(p_claim->>'provider_track_id','') is null
  then
    raise exception using errcode='22023',
      message='Registry provider-link claim is malformed.';
  end if;

  v_source_ref :=
    'registry-provider-link-admin:'||
    p_track_id::text||':'||
    (p_claim->>'provider_key')||':'||
    (p_claim->>'provider_track_id');

  v_source_payload_fingerprint :=
    encode(
      extensions.digest(p_claim::text,'sha256'),
      'hex'
    );

  v_assertion_fingerprint :=
    encode(
      extensions.digest(
        jsonb_build_object(
          'subject_type','track',
          'subject_id',p_track_id::text,
          'claim_key','registry.track.provider_link',
          'claim_payload',p_claim,
          'trust_class','ADMIN_REVIEWED',
          'source_kind','registry_provider_link_admin',
          'source_ref',v_source_ref,
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
    p_track_id,
    'registry.track.provider_link',
    p_claim,
    'ADMIN_REVIEWED',
    'registry_provider_link_admin',
    v_source_ref,
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
end
$$;

create function platform_private.issue_registry_provider_link_admin_grant_v1(
  p_evidence_assertion_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth, extensions
as $$
declare
  v_user_id uuid;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_operation_type platform_private.registry_operation_types%rowtype;
  v_existing platform_private.registry_execution_grants%rowtype;
  v_track_state_fingerprint text;
  v_provider_link_fingerprint text;
  v_plan jsonb;
  v_plan_fingerprint text;
  v_target_fingerprint text;
  v_idempotency_key text;
  v_grant_id uuid;
begin
  v_user_id :=
    platform_private.registry_provider_link_admin_current_user_v1();

  select operation_type.*
  into v_operation_type
  from platform_private.registry_operation_types operation_type
  where operation_type.operation_key='registry.track.provider_link.admit'
    and operation_type.operation_version=1
    and operation_type.capability_key='admit_registry_track_provider_link'
    and operation_type.enabled;

  if not found
     or v_operation_type.max_targets<>1
     or v_operation_type.max_rows_ceiling<1
     or not v_operation_type.requires_existing_target
     or not v_operation_type.requires_human_approval
     or not v_operation_type.requires_verifier
  then
    raise exception using errcode='42501',
      message='Registry Track provider-link operation is disabled or malformed.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=p_evidence_assertion_id;

  if not found
     or v_evidence.subject_type<>'track'
     or v_evidence.claim_key<>'registry.track.provider_link'
     or v_evidence.trust_class<>'ADMIN_REVIEWED'
     or v_evidence.source_kind<>'registry_provider_link_admin'
     or v_evidence.recorded_by_principal_key<>
          'user:'||v_user_id::text
  then
    raise exception using errcode='42501',
      message='Evidence is not caller-bound Registry provider-link authority.';
  end if;

  if v_evidence.claim_payload->>'track_id'<>
       v_evidence.subject_id::text
  then
    raise exception using errcode='42501',
      message='Provider-link evidence Track target drifted.';
  end if;

  v_track_state_fingerprint :=
    platform_private.registry_subject_state_fingerprint(
      'track',
      v_evidence.subject_id
    );

  if v_track_state_fingerprint is null then
    raise exception using errcode='P0002',
      message='Registry Track state fingerprint is unavailable.';
  end if;

  v_provider_link_fingerprint :=
    platform_private.registry_provider_link_state_fingerprint_v1(
      v_evidence.subject_id,
      v_evidence.claim_payload->>'provider_key',
      v_evidence.claim_payload->>'provider_track_id'
    );

  v_plan := jsonb_build_object(
    'operation_key','registry.track.provider_link.admit',
    'operation_version',1,
    'track_id',v_evidence.subject_id::text,
    'evidence_assertion_id',v_evidence.id::text,
    'evidence_assertion_fingerprint',v_evidence.assertion_fingerprint,
    'claim_payload',v_evidence.claim_payload,
    'expected_track_state_fingerprint',v_track_state_fingerprint,
    'expected_provider_link_fingerprint',
      coalesce(v_provider_link_fingerprint,'absent'),
    'policy_ruleset_version','registry-provider-link-admin-v1'
  );

  v_plan_fingerprint :=
    platform_private.registry_plan_fingerprint(v_plan);

  v_target_fingerprint :=
    encode(
      extensions.digest(
        jsonb_build_array(
          jsonb_build_object(
            'subject_type','track',
            'subject_id',v_evidence.subject_id::text,
            'expected_state_fingerprint',v_track_state_fingerprint
          )
        )::text,
        'sha256'
      ),
      'hex'
    );

  v_idempotency_key :=
    'registry-provider-link-admin:'||
    encode(
      extensions.digest(
        (
          v_evidence.assertion_fingerprint||':'||
          coalesce(v_provider_link_fingerprint,'absent')
        ),
        'sha256'
      ),
      'hex'
    );

  select execution_grant.*
  into v_existing
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.actor_key='registry_provider_link_admin'
    and execution_grant.operation_key='registry.track.provider_link.admit'
    and execution_grant.operation_version=1
    and execution_grant.idempotency_key=v_idempotency_key;

  if found then
    if v_existing.issued_by_user_id<>v_user_id
       or v_existing.plan_fingerprint<>v_plan_fingerprint
       or v_existing.target_set_fingerprint<>v_target_fingerprint
    then
      raise exception using errcode='23505',
        message='Registry provider-link idempotency key is bound to different authority.';
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
    'registry_provider_link_admin',
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
    'registry-provider-link-admin-v1',
    'manage_registry',
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
    v_track_state_fingerprint
  );

  return v_grant_id;
end
$$;

create function platform_private.execute_registry_provider_link_admin_v1(
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
  v_plan jsonb;
  v_claim jsonb;
  v_before_link public.registry_track_provider_links%rowtype;
  v_before_exists boolean := false;
  v_before_fingerprint text;
  v_after jsonb;
  v_event_id uuid;
begin
  select *
  into v_begin
  from platform_private.begin_registry_mutation_operation(
    'registry_provider_link_admin',
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
     or v_grant.actor_key<>'registry_provider_link_admin'
     or v_grant.capability_key<>'admit_registry_track_provider_link'
     or v_grant.operation_key<>'registry.track.provider_link.admit'
     or v_grant.operation_version<>1
     or v_grant.max_rows<>1
     or v_grant.required_user_capability_key<>'manage_registry'
     or v_grant.policy_ruleset_version<>'registry-provider-link-admin-v1'
  then
    raise exception using errcode='42501',
      message='Execution grant is not Registry Provider Link Admin V1 authority.';
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
       from platform_private.registry_execution_grant_targets target_count
       where target_count.execution_grant_id=v_grant.id
     )<>1
  then
    raise exception using errcode='42501',
      message='Registry Provider Link Admin V1 requires one exact Track target.';
  end if;

  v_plan:=v_grant.plan_payload;
  v_claim:=v_plan->'claim_payload';

  if v_plan->>'operation_key'<>'registry.track.provider_link.admit'
     or (v_plan->>'operation_version')::integer<>1
     or v_plan->>'track_id'<>v_target.subject_id::text
     or v_plan->>'expected_track_state_fingerprint'<>
          v_target.expected_state_fingerprint
     or v_plan->>'policy_ruleset_version'<>
          'registry-provider-link-admin-v1'
     or v_claim->>'track_id'<>v_target.subject_id::text
     or nullif(v_claim->>'provider_key','') is null
     or nullif(v_claim->>'provider_track_id','') is null
  then
    raise exception using errcode='42501',
      message='Registry Provider Link Admin V1 plan is malformed.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=(v_plan->>'evidence_assertion_id')::uuid;

  if not found
     or v_evidence.subject_type<>'track'
     or v_evidence.subject_id<>v_target.subject_id
     or v_evidence.claim_key<>'registry.track.provider_link'
     or v_evidence.trust_class<>'ADMIN_REVIEWED'
     or v_evidence.source_kind<>'registry_provider_link_admin'
     or v_evidence.assertion_fingerprint<>
          v_plan->>'evidence_assertion_fingerprint'
     or v_evidence.claim_payload<>v_claim
  then
    raise exception using errcode='42501',
      message='Bound provider-link evidence no longer satisfies the exact plan.';
  end if;

  select link.*
  into v_before_link
  from public.registry_track_provider_links link
  where link.track_id=v_target.subject_id
    and link.provider_key=v_claim->>'provider_key'
    and link.provider_track_id=v_claim->>'provider_track_id'
  for update;

  v_before_exists:=found;

  v_before_fingerprint :=
    platform_private.registry_provider_link_state_fingerprint_v1(
      v_target.subject_id,
      v_claim->>'provider_key',
      v_claim->>'provider_track_id'
    );

  if coalesce(v_before_fingerprint,'absent')<>
       v_plan->>'expected_provider_link_fingerprint'
  then
    raise exception using errcode='P0001',
      message='WK_STALE_PROVIDER_LINK: provider link changed after execution grant issuance.';
  end if;

  v_after :=
    public.registry_upsert_track_provider_link(
      v_target.subject_id,
      v_claim->>'provider_key',
      v_claim->>'provider_track_id',
      nullif(v_claim->>'provider_release_id',''),
      array(
        select jsonb_array_elements_text(
          coalesce(v_claim->'provider_artist_ids','[]'::jsonb)
        )
      ),
      nullif(v_claim->>'isrc',''),
      nullif(v_claim->>'upc',''),
      nullif(v_claim->>'preview_url',''),
      nullif(v_claim->>'artwork_url',''),
      case
        when v_claim->>'duration_ms' is null then null
        else (v_claim->>'duration_ms')::integer
      end,
      nullif(v_claim->>'storefront',''),
      v_claim->>'match_method',
      (v_claim->>'match_confidence')::numeric,
      v_claim->>'match_status',
      coalesce(v_claim->'raw_payload','{}'::jsonb)
    );

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
    'provider_link.'||(v_claim->>'provider_key'),
    'public.registry_track_provider_links',
    case when v_before_exists then to_jsonb(v_before_link) else null end,
    v_after,
    'admit_provider_link',
    'succeeded',
    'system:registry_provider_link_admin'
  )
  returning id into v_event_id;

  insert into platform_private.registry_operation_write_events (
    operation_id,
    canonical_write_event_id
  )
  values (
    v_operation.id,
    v_event_id
  );

  update platform_private.registry_mutation_operations
  set affected_rows=1,
      status='succeeded',
      verifier_status='pending',
      result_payload=jsonb_build_object(
        'track_id',v_target.subject_id,
        'provider_key',v_claim->>'provider_key',
        'provider_track_id',v_claim->>'provider_track_id',
        'provider_link_id',v_after->>'id',
        'evidence_assertion_id',v_evidence.id,
        'canonical_write_event_id',v_event_id
      ),
      completed_at=now(),
      updated_at=now()
  where id=v_operation.id;

  operation_id:=v_operation.id;
  operation_status:='succeeded';
  verifier_status:='pending';
  idempotent_replay:=v_begin.idempotent_replay;
  return next;
end
$$;

create function platform_private.verify_registry_provider_link_admin_v1(
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
  v_event_count integer;
  v_valid_event_count integer;
  v_failure text;
begin
  select operation.*
  into v_operation
  from platform_private.registry_mutation_operations operation
  where operation.id=p_operation_id
  for update;

  if not found
     or v_operation.actor_key<>'registry_provider_link_admin'
     or v_operation.operation_key<>'registry.track.provider_link.admit'
     or v_operation.operation_version<>1
     or v_operation.capability_key<>'admit_registry_track_provider_link'
  then
    raise exception using errcode='P0002',
      message='Registry Provider Link Admin V1 operation not found.';
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

  if v_failure is null
     and (
       not found
       or v_grant.actor_key<>'registry_provider_link_admin'
       or v_grant.policy_ruleset_version<>
            'registry-provider-link-admin-v1'
     )
  then
    v_failure:='execution_grant_missing_or_wrong_actor';
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
      and assertion.trust_class='ADMIN_REVIEWED'
      and assertion.source_kind='registry_provider_link_admin'
      and assertion.assertion_fingerprint=
          v_plan->>'evidence_assertion_fingerprint';

    if not found or v_evidence.claim_payload<>v_claim then
      v_failure:='bound_evidence_missing';
    end if;
  end if;

  if v_failure is null
     and not platform_private.registry_provider_link_matches_claim_v1(
       v_target.subject_id,
       v_claim
     )
  then
    v_failure:='provider_link_state_mismatch';
  end if;

  if v_failure is null then
    select count(*)::integer
    into v_event_count
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
      and event.field_name=
          'provider_link.'||(v_claim->>'provider_key')
      and event.target_path='public.registry_track_provider_links'
      and event.action='admit_provider_link'
      and event.status='succeeded'
      and event.actor='system:registry_provider_link_admin';

    if v_event_count<>1 or v_valid_event_count<>1 then
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
      error_code='registry_provider_link_admin_verification_failed',
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
end
$$;

create function public.admin_admit_registry_track_provider_link_v1(
  p_track_id uuid,
  p_provider_key text,
  p_provider_track_id text,
  p_provider_release_id text default null,
  p_provider_artist_ids text[] default null,
  p_isrc text default null,
  p_upc text default null,
  p_preview_url text default null,
  p_artwork_url text default null,
  p_duration_ms integer default null,
  p_storefront text default null,
  p_match_method text default 'unknown',
  p_match_confidence numeric default 0,
  p_match_status text default 'matched',
  p_raw_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_user_id uuid;
  v_claim jsonb;
  v_evidence_id uuid;
  v_grant_id uuid;
  v_exec record;
  v_verify record;
  v_link public.registry_track_provider_links%rowtype;
begin
  v_user_id :=
    platform_private.registry_provider_link_admin_current_user_v1();

  v_claim :=
    platform_private.registry_provider_link_admin_claim_v1(
      p_track_id,
      p_provider_key,
      p_provider_track_id,
      p_provider_release_id,
      p_provider_artist_ids,
      p_isrc,
      p_upc,
      p_preview_url,
      p_artwork_url,
      p_duration_ms,
      p_storefront,
      p_match_method,
      p_match_confidence,
      p_match_status,
      p_raw_payload
    );

  if platform_private.registry_provider_link_matches_claim_v1(
       p_track_id,
       v_claim
     )
  then
    select link.*
    into v_link
    from public.registry_track_provider_links link
    where link.track_id=p_track_id
      and link.provider_key=v_claim->>'provider_key'
      and link.provider_track_id=v_claim->>'provider_track_id';

    return to_jsonb(v_link) ||
      jsonb_build_object(
        '_authority',
        jsonb_build_object(
          'mode','already_current',
          'verified',true,
          'operation_key','registry.track.provider_link.admit',
          'operation_version',1
        )
      );
  end if;

  v_evidence_id :=
    platform_private.record_registry_provider_link_admin_evidence_v1(
      p_track_id,
      v_claim
    );

  v_grant_id :=
    platform_private.issue_registry_provider_link_admin_grant_v1(
      v_evidence_id
    );

  select *
  into v_exec
  from platform_private.execute_registry_provider_link_admin_v1(
    v_grant_id
  );

  select *
  into v_verify
  from platform_private.verify_registry_provider_link_admin_v1(
    v_exec.operation_id
  );

  if v_verify.verifier_status<>'passed' then
    raise exception using errcode='P0001',
      message='WK_PROVIDER_LINK_VERIFIER_FAILED: Registry provider-link verification failed.';
  end if;

  select link.*
  into v_link
  from public.registry_track_provider_links link
  where link.track_id=p_track_id
    and link.provider_key=v_claim->>'provider_key'
    and link.provider_track_id=v_claim->>'provider_track_id';

  if not found then
    raise exception using errcode='P0002',
      message='Verified Registry provider link is missing.';
  end if;

  return to_jsonb(v_link) ||
    jsonb_build_object(
      '_authority',
      jsonb_build_object(
        'mode','exact_operation',
        'verified',true,
        'operation_id',v_exec.operation_id,
        'execution_grant_id',v_grant_id,
        'evidence_assertion_id',v_evidence_id,
        'idempotent_replay',v_exec.idempotent_replay,
        'operation_key','registry.track.provider_link.admit',
        'operation_version',1
      )
    );
end
$$;

revoke all on function
  platform_private.registry_provider_link_admin_current_user_v1(),
  platform_private.registry_provider_link_admin_claim_v1(
    uuid,text,text,text,text[],text,text,text,text,integer,text,text,numeric,text,jsonb
  ),
  platform_private.registry_provider_link_state_fingerprint_v1(uuid,text,text),
  platform_private.registry_provider_link_matches_claim_v1(uuid,jsonb),
  platform_private.record_registry_provider_link_admin_evidence_v1(uuid,jsonb),
  platform_private.issue_registry_provider_link_admin_grant_v1(uuid),
  platform_private.execute_registry_provider_link_admin_v1(uuid),
  platform_private.verify_registry_provider_link_admin_v1(uuid)
from public, anon, authenticated, service_role;

revoke all on function
  public.admin_admit_registry_track_provider_link_v1(
    uuid,text,text,text,text[],text,text,text,text,integer,text,text,numeric,text,jsonb
  )
from public, anon, service_role;

grant execute on function
  public.admin_admit_registry_track_provider_link_v1(
    uuid,text,text,text,text[],text,text,text,text,integer,text,text,numeric,text,jsonb
  )
to authenticated;

revoke all on function
  public.registry_upsert_track_provider_link(
    uuid,text,text,text,text[],text,text,text,text,integer,text,text,numeric,text,jsonb
  )
from public, anon, authenticated, service_role;

comment on function
  public.registry_upsert_track_provider_link(
    uuid,text,text,text,text[],text,text,text,text,integer,text,text,numeric,text,jsonb
  )
is
  'Owner-internal provider-link upsert primitive. External execution retired by MIZIZI Slice 3 Registry Provider Link Admin Authority V1.';

do $proof$
begin
  if not exists (
    select 1
    from platform_private.system_actors actor
    where actor.actor_key='registry_provider_link_admin'
      and actor.status='active'
      and actor.capability_profile->'operation_family'
          @> '["registry.track.provider_link.admit/v1"]'::jsonb
  ) then
    raise exception 'Registry provider-link admin actor drifted';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings binding
    where binding.actor_key='registry_provider_link_admin'
      and binding.executor_kind='database_role'
      and binding.executor_key='authenticator'
      and binding.status='active'
  ) then
    raise exception 'Registry provider-link admin authenticator binding drifted';
  end if;

  if has_function_privilege(
       'anon',
       'public.admin_admit_registry_track_provider_link_v1(uuid,text,text,text,text[],text,text,text,text,integer,text,text,numeric,text,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_admit_registry_track_provider_link_v1(uuid,text,text,text,text[],text,text,text,text,integer,text,text,numeric,text,jsonb)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_admit_registry_track_provider_link_v1(uuid,text,text,text,text[],text,text,text,text,integer,text,text,numeric,text,jsonb)',
       'EXECUTE'
     )
  then
    raise exception 'Registry provider-link admin public wrapper grants drifted';
  end if;

  if has_function_privilege(
       'authenticated',
       'platform_private.execute_registry_provider_link_admin_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.execute_registry_provider_link_admin_v1(uuid)',
       'EXECUTE'
     )
  then
    raise exception 'Registry provider-link admin private executor leaked role authority';
  end if;

  if has_function_privilege(
       'anon',
       'public.registry_upsert_track_provider_link(uuid,text,text,text,text[],text,text,text,text,integer,text,text,numeric,text,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.registry_upsert_track_provider_link(uuid,text,text,text,text[],text,text,text,text,integer,text,text,numeric,text,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.registry_upsert_track_provider_link(uuid,text,text,text,text[],text,text,text,text,integer,text,text,numeric,text,jsonb)',
       'EXECUTE'
     )
  then
    raise exception 'Legacy Registry provider-link upsert still has external execution authority';
  end if;

  if position(
       'WK_STALE_PROVIDER_LINK'
       in pg_get_functiondef(
         'platform_private.execute_registry_provider_link_admin_v1(uuid)'::regprocedure
       )
     )=0
     or position(
       'registry_provider_link_matches_claim_v1'
       in pg_get_functiondef(
         'platform_private.verify_registry_provider_link_admin_v1(uuid)'::regprocedure
       )
     )=0
     or position(
       'registry.track.provider_link.admit'
       in pg_get_functiondef(
         'public.admin_admit_registry_track_provider_link_v1(uuid,text,text,text,text[],text,text,text,text,integer,text,text,numeric,text,jsonb)'::regprocedure
       )
     )=0
  then
    raise exception 'Registry provider-link admin authority implementation drifted';
  end if;

  if exists (
       select 1
       from platform_private.registry_execution_grants grant_row
       where grant_row.actor_key='registry_provider_link_admin'
     )
     or exists (
       select 1
       from platform_private.registry_mutation_operations operation
       where operation.actor_key='registry_provider_link_admin'
     )
  then
    raise exception 'Registry provider-link admin migration activated durable execution residue';
  end if;
end
$proof$;

commit;
