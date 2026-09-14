-- MIZIZI Slice 2 Artist Origin Admission V1
--
-- Installs the first real typed Registry operation on top of the inert
-- governance foundation. Schema installation remains non-activating:
-- the operation is seeded disabled and no MIZIZI standing capability grant
-- or exact execution grant is created by this migration.

begin;
set local statement_timeout = '180s';
set local lock_timeout = '5s';
select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'mizizi-registry-artist-origin-admission-v1',
    0
  )
);

do $preflight$
begin
  if to_regclass('public.capability_definitions') is null
     or to_regclass('public.registry_artists') is null
     or to_regclass('public.registry_canonical_write_events') is null
     or to_regclass('public.registry_audit_log') is null
     or to_regclass('platform_private.system_actors') is null
     or to_regclass('platform_private.system_actor_executor_bindings') is null
     or to_regclass('platform_private.system_actor_capability_grants') is null
     or to_regclass('platform_private.registry_operation_types') is null
     or to_regclass('platform_private.registry_execution_grants') is null
     or to_regclass('platform_private.registry_execution_grant_targets') is null
     or to_regclass('platform_private.registry_mutation_operations') is null
     or to_regclass('platform_private.registry_operation_write_events') is null
     or to_regprocedure('public.current_user_has_capability(text)') is null
     or to_regprocedure('platform_private.begin_registry_mutation_operation(text,uuid)') is null
     or to_regprocedure('platform_private.registry_subject_state_fingerprint(text,uuid)') is null
  then
    raise exception
      'STOP: accepted Registry governance foundation is missing';
  end if;

  if to_regclass('platform_private.registry_evidence_assertions') is not null
     or to_regprocedure(
       'platform_private.record_registry_artist_origin_evidence(text,uuid,text,numeric,text,text,text,timestamp with time zone)'
     ) is not null
     or to_regprocedure(
       'platform_private.issue_registry_artist_origin_execution_grant(text,uuid,text)'
     ) is not null
     or to_regprocedure(
       'platform_private.execute_registry_artist_origin_admission(text,uuid)'
     ) is not null
     or to_regprocedure(
       'platform_private.verify_registry_artist_origin_admission(uuid)'
     ) is not null
  then
    raise exception
      'STOP: Artist Origin Admission V1 authority already exists';
  end if;

  if exists (
    select 1
    from platform_private.registry_operation_types
    where operation_key = 'registry.artist_origin.admit'
  )
     or exists (
       select 1
       from public.capability_definitions
       where capability_key = 'admit_registry_artist_origin'
     )
  then
    raise exception
      'STOP: Artist Origin V1 capability/operation authority already exists';
  end if;
end
$preflight$;

-- ---------------------------------------------------------------------------
-- Narrow canonical capability. This compounds the existing capability
-- vocabulary instead of creating a parallel System Actor capability registry.
-- ---------------------------------------------------------------------------

insert into public.capability_definitions (
  capability_key,
  label,
  description,
  domain
)
values (
  'admit_registry_artist_origin',
  'Admit Registry Artist origin',
  'Admit one evidence-backed missing Artist origin through the typed Registry broker.',
  'registry'
);

-- ---------------------------------------------------------------------------
-- Exact grants need a policy issuer principal. Standing grants remain human
-- issued; one-shot exact grants may be deterministically policy-issued.
-- ---------------------------------------------------------------------------

alter table platform_private.registry_execution_grants
  add column issued_by_principal_key text,
  add column policy_ruleset_version text;

update platform_private.registry_execution_grants
set
  issued_by_principal_key =
    case
      when issued_by_user_id is not null
        then 'user:' || issued_by_user_id::text
      else 'policy:legacy-unknown'
    end,
  policy_ruleset_version = 'legacy-exact-grant-v1'
where issued_by_principal_key is null
   or policy_ruleset_version is null;

alter table platform_private.registry_execution_grants
  alter column issued_by_user_id drop not null,
  alter column issued_by_principal_key set not null,
  alter column policy_ruleset_version set not null;

alter table platform_private.registry_execution_grants
  add constraint registry_execution_grants_issuer_principal_check
    check (
      issued_by_principal_key ~
        '^(user:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|policy:[a-z][a-z0-9_.:-]{2,119})$'
    ),
  add constraint registry_execution_grants_issuer_consistency_check
    check (
      (
        issued_by_user_id is not null
        and issued_by_principal_key =
          'user:' || issued_by_user_id::text
      )
      or (
        issued_by_user_id is null
        and issued_by_principal_key like 'policy:%'
      )
    ),
  add constraint registry_execution_grants_policy_ruleset_check
    check (
      policy_ruleset_version ~
        '^[a-z][a-z0-9_.:-]{2,119}$'
    );

create or replace function platform_private.guard_registry_execution_grant_immutability()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if row(
       old.id,
       old.actor_key,
       old.capability_key,
       old.system_actor_capability_grant_id,
       old.operation_key,
       old.operation_version,
       old.plan_payload,
       old.plan_fingerprint,
       old.target_set_fingerprint,
       old.max_rows,
       old.idempotency_key,
       old.issued_by_user_id,
       old.issued_by_principal_key,
       old.policy_ruleset_version,
       old.issued_at,
       old.expires_at,
       old.created_at
     ) is distinct from row(
       new.id,
       new.actor_key,
       new.capability_key,
       new.system_actor_capability_grant_id,
       new.operation_key,
       new.operation_version,
       new.plan_payload,
       new.plan_fingerprint,
       new.target_set_fingerprint,
       new.max_rows,
       new.idempotency_key,
       new.issued_by_user_id,
       new.issued_by_principal_key,
       new.policy_ruleset_version,
       new.issued_at,
       new.expires_at,
       new.created_at
     )
  then
    raise exception
      using
        errcode = '23514',
        message = 'Issued Registry execution authority is immutable; revoke it and issue a new exact grant instead.';
  end if;

  return new;
end
$$;

-- ---------------------------------------------------------------------------
-- ISO-3166-1 alpha-2 validation for canonical admission. V1 is deliberately
-- stricter than legacy length-only writers.
-- ---------------------------------------------------------------------------

create function platform_private.registry_is_valid_iso2(
  p_iso2 text
)
returns boolean
language sql
immutable
security definer
set search_path = pg_catalog
as $$
  select
    p_iso2 is not null
    and p_iso2 = btrim(p_iso2)
    and p_iso2 = upper(p_iso2)
    and p_iso2 = any(array[
      'AD','AE','AF','AG','AI','AL','AM','AO','AQ','AR','AS','AT','AU','AW','AX','AZ',
      'BA','BB','BD','BE','BF','BG','BH','BI','BJ','BL','BM','BN','BO','BQ','BR','BS','BT','BV','BW','BY','BZ',
      'CA','CC','CD','CF','CG','CH','CI','CK','CL','CM','CN','CO','CR','CU','CV','CW','CX','CY','CZ',
      'DE','DJ','DK','DM','DO','DZ',
      'EC','EE','EG','EH','ER','ES','ET',
      'FI','FJ','FK','FM','FO','FR',
      'GA','GB','GD','GE','GF','GG','GH','GI','GL','GM','GN','GP','GQ','GR','GS','GT','GU','GW','GY',
      'HK','HM','HN','HR','HT','HU',
      'ID','IE','IL','IM','IN','IO','IQ','IR','IS','IT',
      'JE','JM','JO','JP',
      'KE','KG','KH','KI','KM','KN','KP','KR','KW','KY','KZ',
      'LA','LB','LC','LI','LK','LR','LS','LT','LU','LV','LY',
      'MA','MC','MD','ME','MF','MG','MH','MK','ML','MM','MN','MO','MP','MQ','MR','MS','MT','MU','MV','MW','MX','MY','MZ',
      'NA','NC','NE','NF','NG','NI','NL','NO','NP','NR','NU','NZ',
      'OM',
      'PA','PE','PF','PG','PH','PK','PL','PM','PN','PR','PS','PT','PW','PY',
      'QA',
      'RE','RO','RS','RU','RW',
      'SA','SB','SC','SD','SE','SG','SH','SI','SJ','SK','SL','SM','SN','SO','SR','SS','ST','SV','SX','SY','SZ',
      'TC','TD','TF','TG','TH','TJ','TK','TL','TM','TN','TO','TR','TT','TV','TW','TZ',
      'UA','UG','UM','US','UY','UZ',
      'VA','VC','VE','VG','VI','VN','VU',
      'WF','WS',
      'YE','YT',
      'ZA','ZM','ZW'
    ]::text[])
$$;

comment on function platform_private.registry_is_valid_iso2(text) is
  'Strict canonical ISO-3166-1 alpha-2 validator used by typed Registry admission.';

-- ---------------------------------------------------------------------------
-- Registry evidence assertion primitive. Evidence is append-only observation,
-- never control authority.
-- ---------------------------------------------------------------------------

create table platform_private.registry_evidence_assertions (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null,
  subject_id uuid not null,
  claim_key text not null,
  claim_payload jsonb not null,
  trust_class text not null,
  source_kind text not null,
  source_ref text not null,
  source_payload_fingerprint text not null,
  observed_at timestamptz not null,
  recorded_by_principal_key text not null,
  assertion_fingerprint text not null,
  created_at timestamptz not null default now(),
  constraint registry_evidence_assertions_subject_type_check
    check (
      subject_type in (
        'artist',
        'track',
        'release',
        'registry_relationship'
      )
    ),
  constraint registry_evidence_assertions_claim_key_check
    check (
      claim_key ~ '^registry[.][a-z][a-z0-9_.:-]{2,119}$'
    ),
  constraint registry_evidence_assertions_claim_payload_check
    check (
      jsonb_typeof(claim_payload) = 'object'
      and octet_length(claim_payload::text) <= 16384
    ),
  constraint registry_evidence_assertions_trust_class_check
    check (
      trust_class in (
        'TRUSTED_CONTROL',
        'INTERNAL_FACT',
        'EXTERNAL_EVIDENCE',
        'USER_CONTENT',
        'WEB_UNTRUSTED'
      )
    ),
  constraint registry_evidence_assertions_source_kind_check
    check (
      source_kind ~ '^[a-z][a-z0-9_.:-]{2,119}$'
    ),
  constraint registry_evidence_assertions_source_ref_check
    check (
      btrim(source_ref) <> ''
      and octet_length(source_ref) <= 2000
    ),
  constraint registry_evidence_assertions_source_payload_fingerprint_check
    check (
      source_payload_fingerprint ~ '^[0-9a-f]{64}$'
    ),
  constraint registry_evidence_assertions_recorder_check
    check (
      recorded_by_principal_key ~
        '^(system|policy):[a-z][a-z0-9_.:-]{1,119}$'
    ),
  constraint registry_evidence_assertions_assertion_fingerprint_check
    check (
      assertion_fingerprint ~ '^[0-9a-f]{64}$'
    ),
  constraint registry_evidence_assertions_assertion_fingerprint_key
    unique (assertion_fingerprint)
);

create index registry_evidence_assertions_subject_claim_idx
  on platform_private.registry_evidence_assertions (
    subject_type,
    subject_id,
    claim_key,
    observed_at desc
  );

comment on table platform_private.registry_evidence_assertions is
  'Append-only provenance-preserving Registry evidence. Assertions are observations and never grant mutation authority.';

create function platform_private.guard_registry_evidence_assertion_immutability()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  raise exception
    using
      errcode = '23514',
      message = 'Registry evidence assertions are immutable; record a new assertion instead.';
end
$$;

create trigger registry_evidence_assertions_immutability_guard
  before update or delete
  on platform_private.registry_evidence_assertions
  for each row
  execute function platform_private.guard_registry_evidence_assertion_immutability();

revoke all on table
  platform_private.registry_evidence_assertions
from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Operation definition. It is installed disabled; migration deployment does
-- not activate MIZIZI mutation authority.
-- ---------------------------------------------------------------------------

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
  'registry.artist_origin.admit',
  1,
  'admit_registry_artist_origin',
  'low',
  array['artist']::text[],
  true,
  1,
  1,
  300,
  false,
  true,
  false,
  'Admit one evidence-backed missing Artist origin; V1 never overwrites an established origin.'
);

-- ---------------------------------------------------------------------------
-- Human standing-grant controls. A human manage_registry principal delegates
-- only the narrow operation; exact grants remain policy-issued and short lived.
-- ---------------------------------------------------------------------------

create function public.admin_issue_mizizi_artist_origin_capability_grant(
  p_expires_at timestamptz,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_grant_id uuid;
begin
  if v_actor_user_id is null
     or not public.current_user_has_capability('manage_registry')
  then
    raise exception
      using errcode = '42501',
            message = 'manage_registry is required.';
  end if;

  if p_expires_at is null
     or p_expires_at < now() + interval '5 minutes'
     or p_expires_at > now() + interval '30 days'
  then
    raise exception
      using errcode = '22023',
            message = 'Standing grant expiry must be between five minutes and thirty days.';
  end if;

  if nullif(btrim(p_reason), '') is null
     or octet_length(p_reason) > 1000
  then
    raise exception
      using errcode = '22023',
            message = 'A bounded grant reason is required.';
  end if;

  update platform_private.system_actor_capability_grants
  set
    status = 'expired',
    updated_at = now()
  where actor_key = 'mizizi'
    and capability_key = 'admit_registry_artist_origin'
    and status = 'active'
    and expires_at <= now();

  if exists (
    select 1
    from platform_private.system_actor_capability_grants
    where actor_key = 'mizizi'
      and capability_key = 'admit_registry_artist_origin'
      and status = 'active'
      and valid_from <= now()
      and expires_at > now()
  ) then
    raise exception
      using errcode = '23505',
            message = 'An active MIZIZI Artist-origin capability grant already exists.';
  end if;

  insert into platform_private.system_actor_capability_grants (
    actor_key,
    capability_key,
    scope,
    status,
    valid_from,
    expires_at,
    granted_by_user_id,
    grant_reason
  )
  values (
    'mizizi',
    'admit_registry_artist_origin',
    jsonb_build_object(
      'operation_key', 'registry.artist_origin.admit',
      'operation_version', 1,
      'subject_type', 'artist',
      'max_rows', 1
    ),
    'active',
    now(),
    p_expires_at,
    v_actor_user_id,
    btrim(p_reason)
  )
  returning id into v_grant_id;

  insert into public.registry_audit_log (
    actor_id,
    actor_label,
    action,
    entity_type,
    entity_id,
    before_value,
    after_value,
    metadata
  )
  values (
    v_actor_user_id,
    'registry_admin',
    'issue_mizizi_artist_origin_capability_grant',
    'system_actor_capability_grant',
    v_grant_id,
    null,
    jsonb_build_object(
      'actor_key', 'mizizi',
      'capability_key', 'admit_registry_artist_origin',
      'expires_at', p_expires_at
    ),
    jsonb_build_object(
      'operation_key', 'registry.artist_origin.admit',
      'operation_version', 1,
      'reason', btrim(p_reason)
    )
  );

  return v_grant_id;
end
$$;

create function public.admin_revoke_mizizi_artist_origin_capability_grant(
  p_grant_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_rows integer;
begin
  if v_actor_user_id is null
     or not public.current_user_has_capability('manage_registry')
  then
    raise exception
      using errcode = '42501',
            message = 'manage_registry is required.';
  end if;

  if p_grant_id is null
     or nullif(btrim(p_reason), '') is null
     or octet_length(p_reason) > 1000
  then
    raise exception
      using errcode = '22023',
            message = 'A grant id and bounded revoke reason are required.';
  end if;

  update platform_private.system_actor_capability_grants
  set
    status = 'revoked',
    revoked_at = now(),
    revoked_by_user_id = v_actor_user_id,
    revoke_reason = btrim(p_reason),
    updated_at = now()
  where id = p_grant_id
    and actor_key = 'mizizi'
    and capability_key = 'admit_registry_artist_origin'
    and status = 'active';

  get diagnostics v_rows = row_count;

  if v_rows <> 1 then
    raise exception
      using errcode = 'P0002',
            message = 'Active MIZIZI Artist-origin capability grant not found.';
  end if;

  insert into public.registry_audit_log (
    actor_id,
    actor_label,
    action,
    entity_type,
    entity_id,
    after_value,
    metadata
  )
  values (
    v_actor_user_id,
    'registry_admin',
    'revoke_mizizi_artist_origin_capability_grant',
    'system_actor_capability_grant',
    p_grant_id,
    jsonb_build_object('status', 'revoked'),
    jsonb_build_object('reason', btrim(p_reason))
  );

  return true;
end
$$;

create function public.admin_set_mizizi_artist_origin_operation_enabled(
  p_enabled boolean,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, auth
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_before boolean;
begin
  if v_actor_user_id is null
     or not public.current_user_has_capability('manage_registry')
  then
    raise exception
      using errcode = '42501',
            message = 'manage_registry is required.';
  end if;

  if p_enabled is null
     or nullif(btrim(p_reason), '') is null
     or octet_length(p_reason) > 1000
  then
    raise exception
      using errcode = '22023',
            message = 'An enabled state and bounded reason are required.';
  end if;

  select enabled
  into v_before
  from platform_private.registry_operation_types
  where operation_key = 'registry.artist_origin.admit'
    and operation_version = 1
  for update;

  if not found then
    raise exception
      using errcode = 'P0002',
            message = 'Artist-origin operation type is missing.';
  end if;

  update platform_private.registry_operation_types
  set
    enabled = p_enabled,
    updated_at = now()
  where operation_key = 'registry.artist_origin.admit'
    and operation_version = 1;

  insert into public.registry_audit_log (
    actor_id,
    actor_label,
    action,
    entity_type,
    before_value,
    after_value,
    metadata
  )
  values (
    v_actor_user_id,
    'registry_admin',
    'set_mizizi_artist_origin_operation_enabled',
    'registry_operation_type',
    jsonb_build_object('enabled', v_before),
    jsonb_build_object('enabled', p_enabled),
    jsonb_build_object(
      'operation_key', 'registry.artist_origin.admit',
      'operation_version', 1,
      'reason', btrim(p_reason)
    )
  );

  return true;
end
$$;

revoke all on function
  public.admin_issue_mizizi_artist_origin_capability_grant(timestamptz, text),
  public.admin_revoke_mizizi_artist_origin_capability_grant(uuid, text),
  public.admin_set_mizizi_artist_origin_operation_enabled(boolean, text)
from public, anon, service_role;

grant execute on function
  public.admin_issue_mizizi_artist_origin_capability_grant(timestamptz, text),
  public.admin_revoke_mizizi_artist_origin_capability_grant(uuid, text),
  public.admin_set_mizizi_artist_origin_operation_enabled(boolean, text)
to authenticated;

-- ---------------------------------------------------------------------------
-- Private evidence recorder. Source/trust classification is deployment-owned;
-- the caller cannot promote arbitrary evidence into trusted control.
-- ---------------------------------------------------------------------------

create function platform_private.record_registry_artist_origin_evidence(
  p_actor_key text,
  p_artist_id uuid,
  p_origin_iso2 text,
  p_confidence numeric,
  p_source_kind text,
  p_source_ref text,
  p_source_payload_fingerprint text,
  p_observed_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, extensions
as $$
declare
  v_assertion_id uuid;
  v_assertion_fingerprint text;
  v_claim_payload jsonb;
  v_recorded_by text;
begin
  if p_actor_key is null
     or p_artist_id is null
     or p_observed_at is null
  then
    raise exception
      using errcode = '22023',
            message = 'Actor, Artist, and observation time are required.';
  end if;

  if not exists (
    select 1
    from platform_private.system_actors actor
    where actor.actor_key = p_actor_key
      and actor.status = 'active'
  )
     or not exists (
       select 1
       from platform_private.system_actor_executor_bindings binding
       where binding.actor_key = p_actor_key
         and binding.executor_kind = 'database_role'
         and binding.executor_key = session_user
         and binding.status = 'active'
     )
  then
    raise exception
      using errcode = '42501',
            message = 'Current executor is not bound to the active System Actor.';
  end if;

  if not exists (
    select 1
    from public.registry_artists artist
    where artist.id = p_artist_id
  ) then
    raise exception
      using errcode = 'P0002',
            message = 'Artist not found.';
  end if;

  if not platform_private.registry_is_valid_iso2(p_origin_iso2) then
    raise exception
      using errcode = '22023',
            message = 'Evidence origin must be a canonical ISO-3166-1 alpha-2 code.';
  end if;

  if p_confidence is null
     or p_confidence < 0
     or p_confidence > 1
  then
    raise exception
      using errcode = '22023',
            message = 'Evidence confidence must be between zero and one.';
  end if;

  if p_source_kind not in (
       'metadata_country_normalization',
       'musicbrainz'
     )
  then
    raise exception
      using errcode = '22023',
            message = 'Artist Origin V1 does not accept this evidence source kind.';
  end if;

  if nullif(btrim(p_source_ref), '') is null
     or octet_length(p_source_ref) > 2000
     or p_source_payload_fingerprint !~ '^[0-9a-f]{64}$'
  then
    raise exception
      using errcode = '22023',
            message = 'Evidence source reference/fingerprint is invalid.';
  end if;

  if p_observed_at > now() + interval '5 minutes'
     or p_observed_at < now() - interval '30 days'
  then
    raise exception
      using errcode = '22023',
            message = 'Evidence observation time is outside the V1 freshness window.';
  end if;

  v_claim_payload := jsonb_build_object(
    'origin_iso2', p_origin_iso2,
    'origin_confidence', p_confidence
  );
  v_recorded_by := 'system:' || p_actor_key;

  v_assertion_fingerprint := encode(
    extensions.digest(
      jsonb_build_object(
        'subject_type', 'artist',
        'subject_id', p_artist_id::text,
        'claim_key', 'registry.artist.origin',
        'claim_payload', v_claim_payload,
        'trust_class', 'EXTERNAL_EVIDENCE',
        'source_kind', p_source_kind,
        'source_ref', btrim(p_source_ref),
        'source_payload_fingerprint', p_source_payload_fingerprint,
        'observed_at', p_observed_at,
        'recorded_by_principal_key', v_recorded_by
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
    'artist',
    p_artist_id,
    'registry.artist.origin',
    v_claim_payload,
    'EXTERNAL_EVIDENCE',
    p_source_kind,
    btrim(p_source_ref),
    p_source_payload_fingerprint,
    p_observed_at,
    v_recorded_by,
    v_assertion_fingerprint
  )
  on conflict (assertion_fingerprint)
  do nothing
  returning id into v_assertion_id;

  if v_assertion_id is null then
    select assertion.id
    into v_assertion_id
    from platform_private.registry_evidence_assertions assertion
    where assertion.assertion_fingerprint = v_assertion_fingerprint;
  end if;

  return v_assertion_id;
end
$$;

-- ---------------------------------------------------------------------------
-- Deterministic policy gateway. The plan is derived from evidence and current
-- canonical state; no arbitrary mutation shape is accepted from the Mind.
-- ---------------------------------------------------------------------------

create function platform_private.issue_registry_artist_origin_execution_grant(
  p_actor_key text,
  p_evidence_assertion_id uuid,
  p_idempotency_key text
)
returns table (
  execution_grant_id uuid,
  plan_fingerprint text,
  target_set_fingerprint text,
  expected_state_fingerprint text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private, extensions
as $$
declare
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_artist public.registry_artists%rowtype;
  v_standing_grant platform_private.system_actor_capability_grants%rowtype;
  v_standing_count integer;
  v_existing platform_private.registry_execution_grants%rowtype;
  v_plan jsonb;
  v_plan_fingerprint text;
  v_state_fingerprint text;
  v_target_fingerprint text;
  v_execution_grant_id uuid;
  v_expires_at timestamptz;
  v_origin_iso2 text;
  v_confidence numeric;
begin
  if p_actor_key is null
     or p_evidence_assertion_id is null
     or p_idempotency_key is null
     or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
  then
    raise exception
      using errcode = '22023',
            message = 'Valid actor, evidence assertion, and idempotency key are required.';
  end if;

  if not exists (
    select 1
    from platform_private.system_actors actor
    where actor.actor_key = p_actor_key
      and actor.status = 'active'
  )
     or not exists (
       select 1
       from platform_private.system_actor_executor_bindings binding
       where binding.actor_key = p_actor_key
         and binding.executor_kind = 'database_role'
         and binding.executor_key = session_user
         and binding.status = 'active'
     )
  then
    raise exception
      using errcode = '42501',
            message = 'Current executor is not bound to the active System Actor.';
  end if;

  select execution_grant.*
  into v_existing
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.actor_key = p_actor_key
    and execution_grant.operation_key = 'registry.artist_origin.admit'
    and execution_grant.operation_version = 1
    and execution_grant.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.plan_payload ->> 'evidence_assertion_id'
       is distinct from p_evidence_assertion_id::text
    then
      raise exception
        using errcode = '23505',
              message = 'Idempotency key is already bound to different Artist-origin evidence.';
    end if;

    execution_grant_id := v_existing.id;
    plan_fingerprint := v_existing.plan_fingerprint;
    target_set_fingerprint := v_existing.target_set_fingerprint;
    select target.expected_state_fingerprint
    into expected_state_fingerprint
    from platform_private.registry_execution_grant_targets target
    where target.execution_grant_id = v_existing.id
      and target.subject_type = 'artist'
    limit 1;
    expires_at := v_existing.expires_at;
    return next;
    return;
  end if;

  if not exists (
    select 1
    from platform_private.registry_operation_types operation_type
    where operation_type.operation_key = 'registry.artist_origin.admit'
      and operation_type.operation_version = 1
      and operation_type.capability_key = 'admit_registry_artist_origin'
      and operation_type.enabled
  ) then
    raise exception
      using errcode = '42501',
            message = 'Artist-origin admission is disabled.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id = p_evidence_assertion_id;

  if not found
     or v_evidence.subject_type <> 'artist'
     or v_evidence.claim_key <> 'registry.artist.origin'
     or v_evidence.trust_class not in (
       'EXTERNAL_EVIDENCE',
       'INTERNAL_FACT'
     )
  then
    raise exception
      using errcode = '42501',
            message = 'Evidence assertion is not admissible for Artist Origin V1.';
  end if;

  if v_evidence.observed_at < now() - interval '30 days'
     or v_evidence.observed_at > now() + interval '5 minutes'
  then
    raise exception
      using errcode = '42501',
            message = 'Evidence assertion is outside the V1 freshness window.';
  end if;

  v_origin_iso2 := v_evidence.claim_payload ->> 'origin_iso2';
  begin
    v_confidence :=
      (v_evidence.claim_payload ->> 'origin_confidence')::numeric;
  exception
    when others then
      raise exception
        using errcode = '22023',
              message = 'Evidence confidence is malformed.';
  end;

  if not platform_private.registry_is_valid_iso2(v_origin_iso2)
     or v_confidence < 0.90
     or v_confidence > 1
  then
    raise exception
      using errcode = '42501',
            message = 'Evidence does not meet Artist Origin V1 admission policy.';
  end if;

  select artist.*
  into v_artist
  from public.registry_artists artist
  where artist.id = v_evidence.subject_id;

  if not found
     or v_artist.status not in ('active', 'draft')
     or nullif(btrim(v_artist.origin_iso2), '') is not null
     or v_artist.origin_confidence is not null
  then
    raise exception
      using errcode = '42501',
            message = 'Artist is not eligible for missing-origin admission.';
  end if;

  select count(*)::integer
  into v_standing_count
  from platform_private.system_actor_capability_grants standing_grant
  where standing_grant.actor_key = p_actor_key
    and standing_grant.capability_key = 'admit_registry_artist_origin'
    and standing_grant.status = 'active'
    and standing_grant.valid_from <= now()
    and standing_grant.expires_at > now();

  if v_standing_count <> 1 then
    raise exception
      using errcode = '42501',
            message = 'Exactly one active Artist-origin standing capability grant is required.';
  end if;

  select standing_grant.*
  into v_standing_grant
  from platform_private.system_actor_capability_grants standing_grant
  where standing_grant.actor_key = p_actor_key
    and standing_grant.capability_key = 'admit_registry_artist_origin'
    and standing_grant.status = 'active'
    and standing_grant.valid_from <= now()
    and standing_grant.expires_at > now()
  limit 1;

  if not (
    v_standing_grant.scope @>
      jsonb_build_object(
        'operation_key', 'registry.artist_origin.admit',
        'operation_version', 1,
        'subject_type', 'artist',
        'max_rows', 1
      )
  ) then
    raise exception
      using errcode = '42501',
            message = 'Standing capability scope does not authorize Artist Origin V1.';
  end if;

  v_state_fingerprint :=
    platform_private.registry_subject_state_fingerprint(
      'artist',
      v_artist.id
    );

  v_plan := jsonb_build_object(
    'operation_key', 'registry.artist_origin.admit',
    'operation_version', 1,
    'artist_id', v_artist.id::text,
    'evidence_assertion_id', v_evidence.id::text,
    'evidence_assertion_fingerprint', v_evidence.assertion_fingerprint,
    'proposed_origin_iso2', v_origin_iso2,
    'proposed_origin_confidence', v_confidence,
    'expected_state_fingerprint', v_state_fingerprint,
    'trust_class', v_evidence.trust_class,
    'policy_ruleset_version', 'registry-artist-origin-admission-v1'
  );

  v_plan_fingerprint :=
    platform_private.registry_plan_fingerprint(v_plan);

  v_target_fingerprint := encode(
    extensions.digest(
      jsonb_build_array(
        jsonb_build_object(
          'subject_type', 'artist',
          'subject_id', v_artist.id::text,
          'expected_state_fingerprint', v_state_fingerprint
        )
      )::text,
      'sha256'
    ),
    'hex'
  );

  v_expires_at := least(
    now() + interval '5 minutes',
    v_standing_grant.expires_at
  );

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
    issued_at,
    expires_at
  )
  values (
    p_actor_key,
    'admit_registry_artist_origin',
    v_standing_grant.id,
    'registry.artist_origin.admit',
    1,
    v_plan,
    v_plan_fingerprint,
    v_target_fingerprint,
    1,
    p_idempotency_key,
    'active',
    null,
    'policy:registry-artist-origin-admission-v1',
    'registry-artist-origin-admission-v1',
    now(),
    v_expires_at
  )
  returning id into v_execution_grant_id;

  insert into platform_private.registry_execution_grant_targets (
    execution_grant_id,
    subject_type,
    subject_id,
    expected_state_fingerprint
  )
  values (
    v_execution_grant_id,
    'artist',
    v_artist.id,
    v_state_fingerprint
  );

  execution_grant_id := v_execution_grant_id;
  plan_fingerprint := v_plan_fingerprint;
  target_set_fingerprint := v_target_fingerprint;
  expected_state_fingerprint := v_state_fingerprint;
  expires_at := v_expires_at;
  return next;
end
$$;

-- ---------------------------------------------------------------------------
-- Dedicated typed executor. One exact Artist, two exact fields, one row.
-- ---------------------------------------------------------------------------

create function platform_private.execute_registry_artist_origin_admission(
  p_actor_key text,
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
set search_path = pg_catalog, public, platform_private
as $$
declare
  v_begin record;
  v_operation platform_private.registry_mutation_operations%rowtype;
  v_grant platform_private.registry_execution_grants%rowtype;
  v_target platform_private.registry_execution_grant_targets%rowtype;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_artist public.registry_artists%rowtype;
  v_plan jsonb;
  v_artist_id uuid;
  v_evidence_id uuid;
  v_origin_iso2 text;
  v_confidence numeric;
  v_current_fingerprint text;
  v_origin_event_id uuid;
  v_confidence_event_id uuid;
  v_rows integer;
begin
  select *
  into v_begin
  from platform_private.begin_registry_mutation_operation(
    p_actor_key,
    p_execution_grant_id
  );

  select operation.*
  into v_operation
  from platform_private.registry_mutation_operations operation
  where operation.id = v_begin.operation_id
  for update;

  if v_begin.idempotent_replay
     and v_operation.status = 'succeeded'
  then
    operation_id := v_operation.id;
    operation_status := v_operation.status;
    verifier_status := v_operation.verifier_status;
    idempotent_replay := true;
    return next;
    return;
  end if;

  if v_operation.status <> 'authorized' then
    raise exception
      using errcode = '42501',
            message = 'Artist-origin operation is not in an executable state.';
  end if;

  select execution_grant.*
  into v_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.id = p_execution_grant_id;

  if not found
     or v_grant.actor_key <> p_actor_key
     or v_grant.capability_key <> 'admit_registry_artist_origin'
     or v_grant.operation_key <> 'registry.artist_origin.admit'
     or v_grant.operation_version <> 1
     or v_grant.max_rows <> 1
     or v_grant.policy_ruleset_version <>
       'registry-artist-origin-admission-v1'
  then
    raise exception
      using errcode = '42501',
            message = 'Execution grant is not an Artist Origin V1 grant.';
  end if;

  v_plan := v_grant.plan_payload;

  if (
    v_plan - array[
      'operation_key',
      'operation_version',
      'artist_id',
      'evidence_assertion_id',
      'evidence_assertion_fingerprint',
      'proposed_origin_iso2',
      'proposed_origin_confidence',
      'expected_state_fingerprint',
      'trust_class',
      'policy_ruleset_version'
    ]::text[]
  ) <> '{}'::jsonb
  then
    raise exception
      using errcode = '42501',
            message = 'Execution plan contains fields outside Artist Origin V1.';
  end if;

  begin
    v_artist_id := (v_plan ->> 'artist_id')::uuid;
    v_evidence_id := (v_plan ->> 'evidence_assertion_id')::uuid;
    v_confidence := (v_plan ->> 'proposed_origin_confidence')::numeric;
  exception
    when others then
      raise exception
        using errcode = '22023',
              message = 'Execution plan contains malformed typed values.';
  end;

  v_origin_iso2 := v_plan ->> 'proposed_origin_iso2';

  if v_plan ->> 'operation_key' <> 'registry.artist_origin.admit'
     or (v_plan ->> 'operation_version')::integer <> 1
     or v_plan ->> 'policy_ruleset_version' <>
       'registry-artist-origin-admission-v1'
     or not platform_private.registry_is_valid_iso2(v_origin_iso2)
     or v_confidence < 0.90
     or v_confidence > 1
  then
    raise exception
      using errcode = '42501',
            message = 'Execution plan violates Artist Origin V1 policy.';
  end if;

  select target.*
  into v_target
  from platform_private.registry_execution_grant_targets target
  where target.execution_grant_id = v_grant.id;

  if not found
     or v_target.subject_type <> 'artist'
     or v_target.subject_id <> v_artist_id
     or v_target.expected_state_fingerprint is null
     or (
       select count(*)
       from platform_private.registry_execution_grant_targets target_count
       where target_count.execution_grant_id = v_grant.id
     ) <> 1
  then
    raise exception
      using errcode = '42501',
            message = 'Execution target is not the exact one-Artist V1 target.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id = v_evidence_id;

  if not found
     or v_evidence.subject_type <> 'artist'
     or v_evidence.subject_id <> v_artist_id
     or v_evidence.claim_key <> 'registry.artist.origin'
     or v_evidence.assertion_fingerprint <>
       v_plan ->> 'evidence_assertion_fingerprint'
     or v_evidence.trust_class <> v_plan ->> 'trust_class'
     or v_evidence.trust_class not in (
       'EXTERNAL_EVIDENCE',
       'INTERNAL_FACT'
     )
     or v_evidence.claim_payload ->> 'origin_iso2' <> v_origin_iso2
     or (v_evidence.claim_payload ->> 'origin_confidence')::numeric <>
       v_confidence
  then
    raise exception
      using errcode = '42501',
            message = 'Bound evidence no longer satisfies the execution plan.';
  end if;

  select artist.*
  into v_artist
  from public.registry_artists artist
  where artist.id = v_artist_id
  for update;

  if not found
     or v_artist.status not in ('active', 'draft')
     or nullif(btrim(v_artist.origin_iso2), '') is not null
     or v_artist.origin_confidence is not null
  then
    raise exception
      using errcode = '42501',
            message = 'Artist is no longer eligible for missing-origin admission.';
  end if;

  v_current_fingerprint :=
    platform_private.registry_subject_state_fingerprint(
      'artist',
      v_artist.id
    );

  if v_current_fingerprint <> v_target.expected_state_fingerprint
     or v_current_fingerprint <>
       v_plan ->> 'expected_state_fingerprint'
  then
    raise exception
      using errcode = '42501',
            message = 'Artist changed after the exact grant was issued.';
  end if;

  update platform_private.registry_mutation_operations
  set
    status = 'executing',
    started_at = coalesce(started_at, now()),
    updated_at = now()
  where id = v_operation.id;

  update public.registry_artists
  set
    origin_iso2 = v_origin_iso2,
    origin_confidence = v_confidence
  where id = v_artist.id
    and nullif(btrim(origin_iso2), '') is null
    and origin_confidence is null;

  get diagnostics v_rows = row_count;

  if v_rows <> 1 then
    raise exception
      using errcode = '40001',
            message = 'Artist-origin admission lost its one-row compare-and-set boundary.';
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
    'artist',
    v_artist.id::text,
    v_evidence.id::text,
    'platform_private.registry_evidence_assertions',
    'origin_iso2',
    'public.registry_artists.origin_iso2',
    jsonb_build_object('value', v_artist.origin_iso2),
    jsonb_build_object(
      'value', v_origin_iso2,
      'evidence_assertion_id', v_evidence.id,
      'policy_ruleset_version', 'registry-artist-origin-admission-v1'
    ),
    'admit_origin',
    'succeeded',
    'system:' || p_actor_key
  )
  returning id into v_origin_event_id;

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
    v_artist.id::text,
    v_evidence.id::text,
    'platform_private.registry_evidence_assertions',
    'origin_confidence',
    'public.registry_artists.origin_confidence',
    jsonb_build_object('value', v_artist.origin_confidence),
    jsonb_build_object(
      'value', v_confidence,
      'evidence_assertion_id', v_evidence.id,
      'policy_ruleset_version', 'registry-artist-origin-admission-v1'
    ),
    'admit_origin',
    'succeeded',
    'system:' || p_actor_key
  )
  returning id into v_confidence_event_id;

  insert into platform_private.registry_operation_write_events (
    operation_id,
    canonical_write_event_id
  )
  values
    (v_operation.id, v_origin_event_id),
    (v_operation.id, v_confidence_event_id);

  update platform_private.registry_mutation_operations
  set
    affected_rows = 1,
    status = 'succeeded',
    verifier_status = 'pending',
    result_payload = jsonb_build_object(
      'artist_id', v_artist.id,
      'origin_iso2', v_origin_iso2,
      'origin_confidence', v_confidence,
      'evidence_assertion_id', v_evidence.id,
      'canonical_write_event_ids',
        jsonb_build_array(
          v_origin_event_id,
          v_confidence_event_id
        )
    ),
    completed_at = now(),
    updated_at = now()
  where id = v_operation.id;

  operation_id := v_operation.id;
  operation_status := 'succeeded';
  verifier_status := 'pending';
  idempotent_replay := v_begin.idempotent_replay;
  return next;
end
$$;

-- ---------------------------------------------------------------------------
-- Independent post-write verifier. It runs separately from execution.
-- ---------------------------------------------------------------------------

create function platform_private.verify_registry_artist_origin_admission(
  p_operation_id uuid
)
returns table (
  operation_id uuid,
  verifier_status text
)
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private
as $$
declare
  v_operation platform_private.registry_mutation_operations%rowtype;
  v_grant platform_private.registry_execution_grants%rowtype;
  v_target platform_private.registry_execution_grant_targets%rowtype;
  v_plan jsonb;
  v_artist_id uuid;
  v_evidence_id uuid;
  v_origin_iso2 text;
  v_confidence numeric;
  v_link_count integer;
  v_valid_link_count integer;
  v_failure text;
begin
  if p_operation_id is null then
    raise exception
      using errcode = '22023',
            message = 'Operation id is required.';
  end if;

  select operation.*
  into v_operation
  from platform_private.registry_mutation_operations operation
  where operation.id = p_operation_id
  for update;

  if not found
     or v_operation.operation_key <> 'registry.artist_origin.admit'
     or v_operation.operation_version <> 1
     or v_operation.capability_key <> 'admit_registry_artist_origin'
  then
    raise exception
      using errcode = 'P0002',
            message = 'Artist Origin V1 operation not found.';
  end if;

  if v_operation.verifier_status = 'passed' then
    operation_id := v_operation.id;
    verifier_status := 'passed';
    return next;
    return;
  end if;

  if v_operation.status <> 'succeeded'
     or v_operation.affected_rows <> 1
  then
    v_failure := 'operation_not_succeeded_exactly_once';
  end if;

  select execution_grant.*
  into v_grant
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.id = v_operation.execution_grant_id;

  if v_failure is null and not found then
    v_failure := 'execution_grant_missing';
  end if;

  if v_failure is null then
    v_plan := v_grant.plan_payload;
    begin
      v_artist_id := (v_plan ->> 'artist_id')::uuid;
      v_evidence_id := (v_plan ->> 'evidence_assertion_id')::uuid;
      v_confidence := (v_plan ->> 'proposed_origin_confidence')::numeric;
    exception
      when others then
        v_failure := 'plan_typed_values_malformed';
    end;
    v_origin_iso2 := v_plan ->> 'proposed_origin_iso2';
  end if;

  if v_failure is null then
    select target.*
    into v_target
    from platform_private.registry_execution_grant_targets target
    where target.execution_grant_id = v_grant.id
      and target.subject_type = 'artist';

    if not found
       or v_target.subject_id <> v_artist_id
    then
      v_failure := 'exact_artist_target_missing';
    end if;
  end if;

  if v_failure is null
     and not exists (
       select 1
       from platform_private.registry_evidence_assertions assertion
       where assertion.id = v_evidence_id
         and assertion.subject_type = 'artist'
         and assertion.subject_id = v_artist_id
         and assertion.claim_key = 'registry.artist.origin'
         and assertion.assertion_fingerprint =
           v_plan ->> 'evidence_assertion_fingerprint'
     )
  then
    v_failure := 'bound_evidence_missing';
  end if;

  if v_failure is null
     and not exists (
       select 1
       from public.registry_artists artist
       where artist.id = v_artist_id
         and artist.origin_iso2 = v_origin_iso2
         and artist.origin_confidence = v_confidence
     )
  then
    v_failure := 'canonical_artist_state_mismatch';
  end if;

  if v_failure is null then
    select count(*)::integer
    into v_link_count
    from platform_private.registry_operation_write_events link
    where link.operation_id = v_operation.id;

    select count(*)::integer
    into v_valid_link_count
    from platform_private.registry_operation_write_events link
    join public.registry_canonical_write_events event
      on event.id = link.canonical_write_event_id
    where link.operation_id = v_operation.id
      and event.registry_entity_type = 'artist'
      and event.registry_entity_id = v_artist_id::text
      and event.source_suggestion_id = v_evidence_id::text
      and event.source_table =
        'platform_private.registry_evidence_assertions'
      and event.action = 'admit_origin'
      and event.status = 'succeeded'
      and event.actor = 'system:' || v_operation.actor_key
      and (
        (
          event.field_name = 'origin_iso2'
          and event.target_path =
            'public.registry_artists.origin_iso2'
          and event.after_value ->> 'value' =
            v_origin_iso2
        )
        or (
          event.field_name = 'origin_confidence'
          and event.target_path =
            'public.registry_artists.origin_confidence'
          and (event.after_value ->> 'value')::numeric =
            v_confidence
        )
      );

    if v_link_count <> 2
       or v_valid_link_count <> 2
    then
      v_failure := 'canonical_write_event_causality_mismatch';
    end if;
  end if;

  if v_failure is null then
    update platform_private.registry_mutation_operations
    set
      verifier_status = 'passed',
      result_payload =
        result_payload ||
        jsonb_build_object(
          'verification',
          jsonb_build_object(
            'status', 'passed',
            'verified_at', now()
          )
        ),
      updated_at = now()
    where id = v_operation.id;

    operation_id := v_operation.id;
    verifier_status := 'passed';
    return next;
    return;
  end if;

  update platform_private.registry_mutation_operations
  set
    verifier_status = 'failed',
    error_code = 'artist_origin_verification_failed',
    error_message = v_failure,
    result_payload =
      result_payload ||
      jsonb_build_object(
        'verification',
        jsonb_build_object(
          'status', 'failed',
          'reason', v_failure,
          'verified_at', now()
        )
      ),
    updated_at = now()
  where id = v_operation.id;

  operation_id := v_operation.id;
  verifier_status := 'failed';
  return next;
end
$$;

revoke all on function
  platform_private.registry_is_valid_iso2(text),
  platform_private.guard_registry_evidence_assertion_immutability(),
  platform_private.record_registry_artist_origin_evidence(text,uuid,text,numeric,text,text,text,timestamptz),
  platform_private.issue_registry_artist_origin_execution_grant(text,uuid,text),
  platform_private.execute_registry_artist_origin_admission(text,uuid),
  platform_private.verify_registry_artist_origin_admission(uuid)
from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Installation safety proof: schema installs capability and disabled operation,
-- but activates no System Actor grant or exact execution authority.
-- ---------------------------------------------------------------------------

do $proof$
declare
  v_capability_count integer;
  v_operation_count integer;
begin
  select count(*)::integer
  into v_capability_count
  from public.capability_definitions
  where capability_key = 'admit_registry_artist_origin'
    and domain = 'registry';

  if v_capability_count <> 1 then
    raise exception
      'Artist-origin capability installation drifted';
  end if;

  select count(*)::integer
  into v_operation_count
  from platform_private.registry_operation_types
  where operation_key = 'registry.artist_origin.admit'
    and operation_version = 1
    and capability_key = 'admit_registry_artist_origin'
    and enabled is false
    and max_targets = 1
    and max_rows_ceiling = 1
    and max_grant_ttl_seconds = 300
    and requires_verifier;

  if v_operation_count <> 1 then
    raise exception
      'Artist-origin operation definition drifted or activated during installation';
  end if;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants
    where actor_key = 'mizizi'
      and capability_key = 'admit_registry_artist_origin'
  )
     or exists (
       select 1
       from platform_private.registry_execution_grants
       where operation_key = 'registry.artist_origin.admit'
     )
     or exists (
       select 1
       from platform_private.registry_mutation_operations
       where operation_key = 'registry.artist_origin.admit'
     )
  then
    raise exception
      'Artist Origin V1 migration must not activate execution authority';
  end if;

  if has_table_privilege(
       'anon',
       'platform_private.registry_evidence_assertions',
       'SELECT'
     )
     or has_table_privilege(
       'authenticated',
       'platform_private.registry_evidence_assertions',
       'SELECT'
     )
     or has_table_privilege(
       'service_role',
       'platform_private.registry_evidence_assertions',
       'SELECT'
     )
  then
    raise exception
      'Registry evidence assertions leaked direct role access';
  end if;

  if has_function_privilege(
       'anon',
       'platform_private.execute_registry_artist_origin_admission(text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.execute_registry_artist_origin_admission(text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.execute_registry_artist_origin_admission(text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'platform_private.issue_registry_artist_origin_execution_grant(text,uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.issue_registry_artist_origin_execution_grant(text,uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.issue_registry_artist_origin_execution_grant(text,uuid,text)',
       'EXECUTE'
     )
  then
    raise exception
      'Artist Origin V1 private broker leaked direct role execution authority';
  end if;

  if has_function_privilege(
       'anon',
       'public.admin_issue_mizizi_artist_origin_capability_grant(timestamptz,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_issue_mizizi_artist_origin_capability_grant(timestamptz,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_issue_mizizi_artist_origin_capability_grant(timestamptz,text)',
       'EXECUTE'
     )
  then
    raise exception
      'Artist Origin V1 human standing-grant boundary is mis-granted';
  end if;
end
$proof$;

commit;
