-- MIZIZI Slice 2 Discography Reviewed Evidence Authority V1
--
-- Persists immutable provider observations outside the bounded generic
-- evidence assertion payload, freezes reviewed selections before mutation,
-- and installs the paired reviewed-evidence authority for Discography V1.

begin;
set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'mizizi-registry-discography-reviewed-evidence-v1',
    0
  )
);

do $preflight$
begin
  if to_regprocedure('platform_private.registry_discography_set_fingerprint_v1(jsonb)') is null
     or to_regprocedure('platform_private.issue_registry_discography_user_execution_grant_v1(uuid,text,text,uuid,jsonb,text,integer)') is null
     or to_regprocedure('platform_private.execute_registry_materialization_v1(text,uuid)') is null
     or to_regprocedure('platform_private.verify_registry_materialization_v1(uuid)') is null
     or to_regclass('platform_private.registry_evidence_assertions') is null
  then
    raise exception 'STOP: Discography Exact-Set Authority V1 foundation is missing';
  end if;

  if to_regclass('platform_private.registry_discography_provider_snapshots') is not null
     or to_regclass('platform_private.registry_discography_review_plans') is not null
     or to_regprocedure('public.admin_prepare_registry_discography_evidence_v1(uuid,jsonb,text)') is not null
  then
    raise exception 'STOP: Discography Reviewed Evidence Authority V1 already exists';
  end if;
end
$preflight$;

create table platform_private.registry_discography_provider_snapshots (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.registry_artists(id),
  provider text not null check (provider = 'apple_music'),
  storefront text not null check (storefront ~ '^[a-z]{2}$'),
  acquired_at timestamptz not null,
  source_payload_fingerprint text not null
    check (source_payload_fingerprint ~ '^[0-9a-f]{64}$'),
  observation_fingerprint text not null
    check (observation_fingerprint ~ '^[0-9a-f]{64}$'),
  observation jsonb not null
    check (
      jsonb_typeof(observation) = 'object'
      and octet_length(observation::text) <= 2097152
    ),
  recorded_by_user_id uuid not null,
  recorded_by_principal_key text not null,
  created_at timestamptz not null default now(),
  constraint registry_discography_provider_snapshots_principal_check
    check (recorded_by_principal_key = 'user:' || recorded_by_user_id::text),
  constraint registry_discography_provider_snapshots_unique_observation
    unique (
      recorded_by_user_id,
      artist_id,
      source_payload_fingerprint,
      observation_fingerprint
    )
);

create index registry_discography_provider_snapshots_artist_created_idx
  on platform_private.registry_discography_provider_snapshots (
    artist_id,
    created_at desc
  );

create table platform_private.registry_discography_review_plans (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.registry_artists(id),
  evidence_assertion_id uuid not null
    references platform_private.registry_evidence_assertions(id),
  snapshot_id uuid not null
    references platform_private.registry_discography_provider_snapshots(id),
  reviewed_by_user_id uuid not null,
  reviewed_selections jsonb not null
    check (
      jsonb_typeof(reviewed_selections) = 'array'
      and octet_length(reviewed_selections::text) <= 131072
    ),
  selection_fingerprint text not null
    check (selection_fingerprint ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  constraint registry_discography_review_plans_unique_selection
    unique (
      reviewed_by_user_id,
      evidence_assertion_id,
      selection_fingerprint
    )
);

create function platform_private.reject_registry_discography_immutable_mutation_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  raise exception using errcode='55000',
    message='Discography provider snapshots and reviewed plans are immutable.';
end
$$;

create trigger registry_discography_provider_snapshots_immutable
before update or delete
on platform_private.registry_discography_provider_snapshots
for each row execute function
  platform_private.reject_registry_discography_immutable_mutation_v1();

create trigger registry_discography_review_plans_immutable
before update or delete
on platform_private.registry_discography_review_plans
for each row execute function
  platform_private.reject_registry_discography_immutable_mutation_v1();

create function platform_private.registry_discography_deterministic_uuid_v1(
  p_namespace text,
  p_semantic_key text
)
returns uuid
language plpgsql
immutable
security definer
set search_path = pg_catalog, extensions
as $$
declare
  v_hex text;
begin
  if nullif(btrim(p_namespace),'') is null
     or nullif(btrim(p_semantic_key),'') is null
  then
    raise exception using errcode='22023',
      message='Discography deterministic UUID namespace and semantic key are required.';
  end if;

  v_hex := encode(
    extensions.digest(
      btrim(p_namespace) || ':' || btrim(p_semantic_key),
      'sha256'
    ),
    'hex'
  );

  return (
    substr(v_hex,1,8) || '-' ||
    substr(v_hex,9,4) || '-' ||
    '5' || substr(v_hex,14,3) || '-' ||
    '8' || substr(v_hex,18,3) || '-' ||
    substr(v_hex,21,12)
  )::uuid;
end
$$;

create function platform_private.registry_discography_current_admin_v1()
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
    raise exception using errcode='42501', message='manage_registry is required.';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings binding
    where binding.actor_key='registry_discography_admin'
      and binding.executor_kind='database_role'
      and binding.executor_key=session_user
      and binding.status='active'
  ) then
    raise exception using errcode='42501',
      message='Current transport is not the Registry discography admin broker.';
  end if;

  return v_user_id;
end
$$;

revoke all on table
  platform_private.registry_discography_provider_snapshots,
  platform_private.registry_discography_review_plans
from public, anon, authenticated, service_role;

revoke all on function
  platform_private.reject_registry_discography_immutable_mutation_v1(),
  platform_private.registry_discography_deterministic_uuid_v1(text,text),
  platform_private.registry_discography_current_admin_v1()
from public, anon, authenticated, service_role;

commit;