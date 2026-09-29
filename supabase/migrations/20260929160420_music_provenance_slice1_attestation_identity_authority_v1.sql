-- WAKILISHA Music Provenance — Slice 1 / #1113
-- Attestation, lineage, Person↔Artist identity, and typed Group membership.
--
-- This migration creates durable authority only. It performs no corpus backfill,
-- creates no public contribution projection, and grants no direct canonical DML
-- to browser or service roles.

begin;

set local statement_timeout='180s';
set local lock_timeout='5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'music-provenance-slice1-attestation-identity-authority-v1',
    0
  )
);

do $preflight$
begin
  if to_regclass('public.registry_tracks') is null
     or to_regclass('public.registry_works') is null
     or to_regclass('public.registry_artists') is null
     or to_regclass('editorial.people') is null
     or to_regclass('editorial.person_identity_links') is null
     or to_regclass('platform_private.registry_evidence_assertions') is null
     or to_regclass('public.registry_canonical_write_events') is null
     or to_regprocedure('public.current_user_has_capability(text)') is null
     or to_regprocedure('editorial.protect_person_identity_link_target()') is null
  then
    raise exception
      'STOP: accepted Person / Registry / evidence authority required by provenance Slice 1 is incomplete';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema='editorial'
      and table_name='person_identity_links'
      and column_name='registry_artist_id'
  )
     or to_regclass('platform_private.registry_contribution_attestations') is not null
     or to_regclass('platform_private.registry_contribution_attestation_state_events') is not null
     or to_regclass('platform_private.registry_contribution_attestation_permission_versions') is not null
     or to_regclass('public.registry_artist_person_memberships') is not null
  then
    raise exception
      'STOP: provenance Slice 1 attestation/identity authority already exists; audit before reapplying';
  end if;
end
$preflight$;

alter table platform_private.registry_evidence_assertions
  add column parent_assertion_id uuid,
  add column originator_ref text,
  add column upstream_source_ref text,
  add column lineage_key text,
  add column independence_group_hint text,
  add column verification_method text,
  add column source_use_basis text,
  add column source_use_detail text;

alter table platform_private.registry_evidence_assertions
  add constraint registry_evidence_assertions_parent_fkey
    foreign key (parent_assertion_id)
    references platform_private.registry_evidence_assertions(id)
    on update restrict
    on delete restrict,
  add constraint registry_evidence_assertions_parent_self_check
    check (parent_assertion_id is null or parent_assertion_id <> id),
  add constraint registry_evidence_assertions_originator_ref_check
    check (
      originator_ref is null
      or (
        btrim(originator_ref) <> ''
        and octet_length(originator_ref) <= 1000
      )
    ),
  add constraint registry_evidence_assertions_upstream_source_ref_check
    check (
      upstream_source_ref is null
      or (
        btrim(upstream_source_ref) <> ''
        and octet_length(upstream_source_ref) <= 2000
      )
    ),
  add constraint registry_evidence_assertions_lineage_key_check
    check (
      lineage_key is null
      or (
        btrim(lineage_key) <> ''
        and octet_length(lineage_key) <= 500
      )
    ),
  add constraint registry_evidence_assertions_independence_group_hint_check
    check (
      independence_group_hint is null
      or (
        btrim(independence_group_hint) <> ''
        and octet_length(independence_group_hint) <= 500
      )
    ),
  add constraint registry_evidence_assertions_verification_method_check
    check (
      verification_method is null
      or verification_method ~ '^[a-z][a-z0-9_.:-]{1,119}$'
    ),
  add constraint registry_evidence_assertions_source_use_basis_check
    check (
      source_use_basis is null
      or source_use_basis ~ '^[a-z][a-z0-9_.:-]{1,119}$'
    ),
  add constraint registry_evidence_assertions_source_use_detail_check
    check (
      source_use_detail is null
      or (
        btrim(source_use_detail) <> ''
        and octet_length(source_use_detail) <= 4000
      )
    );

create index registry_evidence_assertions_parent_idx
  on platform_private.registry_evidence_assertions(parent_assertion_id)
  where parent_assertion_id is not null;

create index registry_evidence_assertions_lineage_idx
  on platform_private.registry_evidence_assertions(lineage_key)
  where lineage_key is not null;

create table platform_private.registry_contribution_attestations (
  id uuid primary key default gen_random_uuid(),
  evidence_assertion_id uuid not null unique
    references platform_private.registry_evidence_assertions(id)
    on update restrict
    on delete restrict,

  track_id uuid
    references public.registry_tracks(id)
    on update restrict
    on delete restrict,
  work_id uuid
    references public.registry_works(id)
    on update restrict
    on delete restrict,

  proposed_person_resource_id uuid
    references editorial.people(resource_id)
    on update restrict
    on delete restrict,
  proposed_organization_resource_id uuid
    references editorial.organizations(resource_id)
    on update restrict
    on delete restrict,
  proposed_artist_id uuid
    references public.registry_artists(id)
    on update restrict
    on delete restrict,
  credited_as text,

  role_key text not null,
  instrument_key text,
  detail_text text,

  asserting_user_id uuid
    references auth.users(id)
    on update restrict
    on delete restrict,
  asserting_person_resource_id uuid
    references editorial.people(resource_id)
    on update restrict
    on delete restrict,
  asserting_artist_id uuid
    references public.registry_artists(id)
    on update restrict
    on delete restrict,
  stated_relationship text,
  inviter_user_id uuid
    references auth.users(id)
    on update restrict
    on delete restrict,
  parent_attestation_id uuid
    references platform_private.registry_contribution_attestations(id)
    on update restrict
    on delete restrict,
  representation_context jsonb not null default '{}'::jsonb,

  elicitation_method text not null,
  prompt_key text,
  prompt_version text,
  candidate_shown boolean not null default false,
  candidate_shown_payload jsonb,

  created_at timestamptz not null default now(),

  constraint registry_contribution_attestations_subject_check
    check (num_nonnulls(track_id,work_id)=1),

  constraint registry_contribution_attestations_underlying_identity_check
    check (
      num_nonnulls(
        proposed_person_resource_id,
        proposed_organization_resource_id
      ) <= 1
    ),

  constraint registry_contribution_attestations_contributor_presence_check
    check (
      num_nonnulls(
        proposed_person_resource_id,
        proposed_organization_resource_id,
        proposed_artist_id
      ) >= 1
      or (
        credited_as is not null
        and btrim(credited_as) <> ''
      )
    ),

  constraint registry_contribution_attestations_credit_check
    check (
      credited_as is null
      or (
        btrim(credited_as) <> ''
        and octet_length(credited_as) <= 1000
      )
    ),

  constraint registry_contribution_attestations_role_check
    check (
      (
        track_id is not null
        and work_id is null
        and role_key = any(array[
          'primary_performer'::text,
          'featured_performer'::text,
          'performer'::text,
          'producer'::text,
          'recording_engineer'::text,
          'mixing_engineer'::text,
          'mastering_engineer'::text,
          'session_musician'::text,
          'conductor'::text,
          'vocalist'::text,
          'instrumentalist'::text,
          'other_reviewed'::text
        ])
      )
      or
      (
        work_id is not null
        and track_id is null
        and instrument_key is null
        and role_key = any(array[
          'composer'::text,
          'lyricist'::text,
          'songwriter'::text,
          'arranger'::text,
          'adaptor'::text,
          'translator'::text,
          'publisher_representative'::text,
          'other_reviewed'::text
        ])
      )
    ),

  constraint registry_contribution_attestations_instrument_check
    check (
      instrument_key is null
      or (
        track_id is not null
        and instrument_key=lower(instrument_key)
        and instrument_key ~ '^[a-z0-9][a-z0-9_.:-]{1,79}$'
      )
    ),

  constraint registry_contribution_attestations_detail_check
    check (
      detail_text is null
      or (
        btrim(detail_text) <> ''
        and octet_length(detail_text) <= 2000
      )
    ),

  constraint registry_contribution_attestations_relationship_check
    check (
      stated_relationship is null
      or (
        btrim(stated_relationship) <> ''
        and octet_length(stated_relationship) <= 500
      )
    ),

  constraint registry_contribution_attestations_parent_check
    check (parent_attestation_id is null or parent_attestation_id <> id),

  constraint registry_contribution_attestations_representation_check
    check (
      jsonb_typeof(representation_context)='object'
      and octet_length(representation_context::text) <= 8192
    ),

  constraint registry_contribution_attestations_elicitation_check
    check (
      elicitation_method = any(array[
        'open_response'::text,
        'self_claim'::text,
        'suggested_confirmation'::text,
        'counterparty_confirmation'::text,
        'imported_source'::text
      ])
    ),

  constraint registry_contribution_attestations_actor_check
    check (
      elicitation_method='imported_source'
      or asserting_user_id is not null
    ),

  constraint registry_contribution_attestations_prompt_check
    check (
      (
        elicitation_method='imported_source'
        and prompt_key is null
        and prompt_version is null
      )
      or
      (
        elicitation_method<>'imported_source'
        and prompt_key is not null
        and btrim(prompt_key)<>''
        and octet_length(prompt_key)<=200
        and prompt_version is not null
        and btrim(prompt_version)<>''
        and octet_length(prompt_version)<=100
      )
    ),

  constraint registry_contribution_attestations_candidate_check
    check (
      (
        not candidate_shown
        and candidate_shown_payload is null
        and elicitation_method not in (
          'suggested_confirmation',
          'counterparty_confirmation'
        )
      )
      or
      (
        candidate_shown
        and candidate_shown_payload is not null
        and jsonb_typeof(candidate_shown_payload)='object'
        and octet_length(candidate_shown_payload::text)<=8192
        and elicitation_method in (
          'suggested_confirmation',
          'counterparty_confirmation'
        )
      )
    )
);

comment on table platform_private.registry_contribution_attestations is
  'Immutable first-party/reviewed Recording or Work contribution attestation. Canonical contribution admission is a separate governed act.';

create index registry_contribution_attestations_track_idx
  on platform_private.registry_contribution_attestations(track_id)
  where track_id is not null;

create index registry_contribution_attestations_work_idx
  on platform_private.registry_contribution_attestations(work_id)
  where work_id is not null;

create index registry_contribution_attestations_person_idx
  on platform_private.registry_contribution_attestations(proposed_person_resource_id)
  where proposed_person_resource_id is not null;

create index registry_contribution_attestations_artist_idx
  on platform_private.registry_contribution_attestations(proposed_artist_id)
  where proposed_artist_id is not null;

create index registry_contribution_attestations_asserting_user_idx
  on platform_private.registry_contribution_attestations(asserting_user_id)
  where asserting_user_id is not null;

create table platform_private.registry_contribution_attestation_state_events (
  id uuid primary key default gen_random_uuid(),
  attestation_id uuid not null
    references platform_private.registry_contribution_attestations(id)
    on update restrict
    on delete restrict,
  state text not null,
  supporting_evidence_assertion_id uuid
    references platform_private.registry_evidence_assertions(id)
    on update restrict
    on delete restrict,
  actor_principal_key text not null,
  actor_user_id uuid
    references auth.users(id)
    on update restrict
    on delete restrict,
  reason text,
  created_at timestamptz not null default now(),

  constraint registry_contribution_attestation_state_events_state_check
    check (
      state = any(array[
        'asserted'::text,
        'corroborated'::text,
        'confirmed'::text,
        'disputed'::text,
        'withdrawn'::text,
        'superseded'::text
      ])
    ),

  constraint registry_contribution_attestation_state_events_actor_check
    check (
      actor_principal_key ~
      '^((system|policy):[a-z][a-z0-9_.:-]{1,119}|user:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$'
    ),

  constraint registry_contribution_attestation_state_events_reason_check
    check (
      reason is null
      or (
        btrim(reason) <> ''
        and octet_length(reason) <= 4000
      )
    )
);

create index registry_contribution_attestation_state_events_attestation_idx
  on platform_private.registry_contribution_attestation_state_events(
    attestation_id,
    created_at desc,
    id desc
  );

create table platform_private.registry_contribution_attestation_permission_versions (
  id uuid primary key default gen_random_uuid(),
  attestation_id uuid not null
    references platform_private.registry_contribution_attestations(id)
    on update restrict
    on delete restrict,
  supersedes_permission_id uuid
    references platform_private.registry_contribution_attestation_permission_versions(id)
    on update restrict
    on delete restrict,
  change_kind text not null,
  policy_key text not null,
  policy_version text not null,
  public_display boolean not null default false,
  cmo_rights_contexts text[] not null default '{}'::text[],
  approved_partner_keys text[] not null default '{}'::text[],
  third_party_commercial_reuse boolean not null default false,
  actor_user_id uuid not null
    references auth.users(id)
    on update restrict
    on delete restrict,
  actor_person_resource_id uuid
    references editorial.people(resource_id)
    on update restrict
    on delete restrict,
  reason text,
  created_at timestamptz not null default now(),

  constraint registry_contribution_attestation_permissions_supersession_check
    check (
      supersedes_permission_id is null
      or supersedes_permission_id <> id
    ),

  constraint registry_contribution_attestation_permissions_change_check
    check (change_kind in ('grant','replace','withdraw')),

  constraint registry_contribution_attestation_permissions_policy_check
    check (
      btrim(policy_key) <> ''
      and octet_length(policy_key) <= 200
      and btrim(policy_version) <> ''
      and octet_length(policy_version) <= 100
    ),

  constraint registry_contribution_attestation_permissions_scope_check
    check (
      cardinality(cmo_rights_contexts) <= 32
      and array_position(cmo_rights_contexts,null::text) is null
      and cardinality(approved_partner_keys) <= 64
      and array_position(approved_partner_keys,null::text) is null
    ),

  constraint registry_contribution_attestation_permissions_withdraw_check
    check (
      change_kind <> 'withdraw'
      or (
        not public_display
        and cardinality(cmo_rights_contexts)=0
        and cardinality(approved_partner_keys)=0
        and not third_party_commercial_reuse
      )
    ),

  constraint registry_contribution_attestation_permissions_reason_check
    check (
      reason is null
      or (
        btrim(reason) <> ''
        and octet_length(reason) <= 4000
      )
    )
);

create index registry_contribution_attestation_permissions_attestation_idx
  on platform_private.registry_contribution_attestation_permission_versions(
    attestation_id,
    created_at desc,
    id desc
  );

create function platform_private.registry_contribution_attestation_current_state_v1(
  p_attestation_id uuid
)
returns text
language sql
stable
security definer
set search_path=pg_catalog,platform_private
as $$
  select event.state
  from platform_private.registry_contribution_attestation_state_events event
  where event.attestation_id=p_attestation_id
  order by event.created_at desc,event.id desc
  limit 1
$$;

create function platform_private.reject_registry_provenance_history_mutation_v1()
returns trigger
language plpgsql
set search_path=pg_catalog
as $$
begin
  raise exception using errcode='55000',
    message='Registry provenance attestation history is append-only.';
end
$$;

create trigger registry_contribution_attestations_append_only
before update or delete
on platform_private.registry_contribution_attestations
for each row
execute function platform_private.reject_registry_provenance_history_mutation_v1();

create trigger registry_contribution_attestation_state_events_append_only
before update or delete
on platform_private.registry_contribution_attestation_state_events
for each row
execute function platform_private.reject_registry_provenance_history_mutation_v1();

create trigger registry_contribution_attestation_permissions_append_only
before update or delete
on platform_private.registry_contribution_attestation_permission_versions
for each row
execute function platform_private.reject_registry_provenance_history_mutation_v1();

create function platform_private.assert_registry_contribution_attestation_history_v1()
returns trigger
language plpgsql
set search_path=pg_catalog,platform_private
as $$
declare
  v_attestation_id uuid;
  v_first_state text;
begin
  if tg_table_name='registry_contribution_attestations' then
    v_attestation_id:=coalesce(new.id,old.id);
  else
    v_attestation_id:=coalesce(new.attestation_id,old.attestation_id);
  end if;

  if not exists (
    select 1
    from platform_private.registry_contribution_attestations attestation
    where attestation.id=v_attestation_id
  ) then
    return null;
  end if;

  select event.state
  into v_first_state
  from platform_private.registry_contribution_attestation_state_events event
  where event.attestation_id=v_attestation_id
  order by event.created_at,event.id
  limit 1;

  if v_first_state is distinct from 'asserted' then
    raise exception
      'A contribution attestation must retain an initial asserted state event.';
  end if;

  return null;
end
$$;

create constraint trigger registry_contribution_attestation_history_integrity
after insert or update or delete
on platform_private.registry_contribution_attestations
deferrable initially deferred
for each row
execute function platform_private.assert_registry_contribution_attestation_history_v1();

create constraint trigger registry_contribution_attestation_state_history_integrity
after insert or update or delete
on platform_private.registry_contribution_attestation_state_events
deferrable initially deferred
for each row
execute function platform_private.assert_registry_contribution_attestation_history_v1();

revoke all on table
  platform_private.registry_contribution_attestations,
  platform_private.registry_contribution_attestation_state_events,
  platform_private.registry_contribution_attestation_permission_versions
from public,anon,authenticated,service_role;

revoke all on function
  platform_private.registry_contribution_attestation_current_state_v1(uuid),
  platform_private.reject_registry_provenance_history_mutation_v1(),
  platform_private.assert_registry_contribution_attestation_history_v1()
from public,anon,authenticated,service_role;

alter table editorial.person_identity_links
  add column registry_artist_id uuid
    references public.registry_artists(id)
    on update restrict
    on delete restrict;

alter table editorial.person_identity_links
  drop constraint person_identity_links_exactly_one_source_check;

alter table editorial.person_identity_links
  add constraint person_identity_links_exactly_one_source_check
  check (
    num_nonnulls(
      user_id,
      retired_user_id_snapshot,
      registry_author_id,
      external_contributor_id,
      registry_artist_id
    )=1
  );

alter table editorial.person_identity_links
  drop constraint person_identity_links_retired_user_snapshot_state_check;

alter table editorial.person_identity_links
  add constraint person_identity_links_retired_user_snapshot_state_check
  check (
    retired_user_id_snapshot is null
    or (
      user_id is null
      and registry_author_id is null
      and external_contributor_id is null
      and registry_artist_id is null
      and link_state in ('retired','superseded')
    )
  );

create unique index person_identity_links_active_registry_artist_unique
  on editorial.person_identity_links(registry_artist_id)
  where link_state='active'
    and registry_artist_id is not null;

create index person_identity_links_person_registry_artist_idx
  on editorial.person_identity_links(person_resource_id,registry_artist_id,created_at)
  where registry_artist_id is not null;

create or replace function editorial.protect_person_identity_link_target()
returns trigger
language plpgsql
set search_path=pg_catalog
as $$
begin
  if new.person_resource_id is distinct from old.person_resource_id
     or new.person_resource_kind is distinct from old.person_resource_kind
     or new.user_id is distinct from old.user_id
     or new.retired_user_id_snapshot is distinct from old.retired_user_id_snapshot
     or new.registry_author_id is distinct from old.registry_author_id
     or new.external_contributor_id is distinct from old.external_contributor_id
     or new.registry_artist_id is distinct from old.registry_artist_id
  then
    if old.user_id is not null
       and new.user_id is null
       and old.retired_user_id_snapshot is null
       and new.retired_user_id_snapshot=old.user_id
       and new.person_resource_id=old.person_resource_id
       and new.person_resource_kind=old.person_resource_kind
       and new.registry_author_id is not distinct from old.registry_author_id
       and new.external_contributor_id is not distinct from old.external_contributor_id
       and new.registry_artist_id is not distinct from old.registry_artist_id
       and old.link_state in ('retired','superseded')
       and new.link_state=old.link_state
    then
      return new;
    end if;

    raise exception 'Person identity links cannot be retargeted.';
  end if;

  return new;
end
$$;

drop trigger person_identity_links_protect_target
on editorial.person_identity_links;

create trigger person_identity_links_protect_target
before update of
  person_resource_id,
  person_resource_kind,
  user_id,
  retired_user_id_snapshot,
  registry_author_id,
  external_contributor_id,
  registry_artist_id
on editorial.person_identity_links
for each row
execute function editorial.protect_person_identity_link_target();

create function public.admin_link_person_registry_artist_v1(
  p_person_resource_id uuid,
  p_expected_identity_revision bigint,
  p_registry_artist_id uuid,
  p_evidence_assertion_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,editorial,platform_private,auth
as $$
declare
  v_actor uuid:=auth.uid();
  v_person editorial.people%rowtype;
  v_artist public.registry_artists%rowtype;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_existing editorial.person_identity_links%rowtype;
  v_link_id uuid;
  v_event_id uuid;
  v_prior_revision bigint;
begin
  if v_actor is null
     or not coalesce(public.current_user_has_capability('manage_registry'),false)
     or not coalesce(public.current_user_has_capability('manage_people_identity'),false)
  then
    raise exception using errcode='42501',
      message='manage_registry and manage_people_identity are required.';
  end if;

  if p_person_resource_id is null
     or p_expected_identity_revision is null
     or p_expected_identity_revision<1
     or p_registry_artist_id is null
     or p_evidence_assertion_id is null
     or nullif(btrim(coalesce(p_reason,'')),'') is null
     or octet_length(p_reason)>4000
  then
    raise exception using errcode='22023',
      message='Person, expected revision, Registry Artist, evidence, and reason are required.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'person-registry-artist:'||p_registry_artist_id::text,
      0
    )
  );

  select person.*
  into v_person
  from editorial.people person
  where person.resource_id=p_person_resource_id
  for update;

  if not found
     or v_person.person_state<>'active'
     or v_person.identity_revision<>p_expected_identity_revision
  then
    raise exception using errcode='40001',
      message='Person is missing, inactive, or changed after review.';
  end if;

  select artist.*
  into v_artist
  from public.registry_artists artist
  where artist.id=p_registry_artist_id
  for update;

  if not found or v_artist.status='archived' then
    raise exception using errcode='P0002',
      message='Registry Artist is missing or archived.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=p_evidence_assertion_id;

  if not found
     or v_evidence.subject_type<>'artist'
     or v_evidence.subject_id<>p_registry_artist_id
     or v_evidence.claim_key<>'registry.person_artist.link'
     or v_evidence.trust_class not in (
       'INTERNAL_FACT',
       'EXTERNAL_EVIDENCE',
       'USER_CONTENT'
     )
  then
    raise exception using errcode='42501',
      message='Evidence is not valid Person-to-Registry-Artist link authority.';
  end if;

  select link.*
  into v_existing
  from editorial.person_identity_links link
  where link.registry_artist_id=p_registry_artist_id
    and link.link_state='active';

  if found then
    if v_existing.person_resource_id<>p_person_resource_id then
      raise exception using errcode='23505',
        message='Registry Artist is already linked to another Person.';
    end if;

    return jsonb_build_object(
      'person_resource_id',p_person_resource_id,
      'registry_artist_id',p_registry_artist_id,
      'identity_link_id',v_existing.id,
      'identity_revision',v_person.identity_revision,
      'changed',false
    );
  end if;

  v_link_id:=gen_random_uuid();
  v_prior_revision:=v_person.identity_revision;

  insert into editorial.person_identity_links (
    id,
    person_resource_id,
    person_resource_kind,
    registry_artist_id,
    link_state,
    link_method,
    link_reason,
    created_by
  )
  values (
    v_link_id,
    p_person_resource_id,
    'person',
    p_registry_artist_id,
    'active',
    'admin_reconciliation',
    btrim(p_reason),
    v_actor
  );

  update editorial.people person
  set
    identity_revision=person.identity_revision+1,
    updated_by=v_actor,
    updated_at=now()
  where person.resource_id=p_person_resource_id
  returning person.* into v_person;

  insert into editorial.person_identity_events (
    person_resource_id,
    actor_id,
    event_type,
    identity_link_id,
    prior_identity_revision,
    resulting_identity_revision,
    reason
  )
  values (
    p_person_resource_id,
    v_actor,
    'identity_linked',
    v_link_id,
    v_prior_revision,
    v_person.identity_revision,
    btrim(p_reason)
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
    'artist',
    p_registry_artist_id::text,
    p_evidence_assertion_id::text,
    'platform_private.registry_evidence_assertions',
    'person_identity',
    'editorial.person_identity_links',
    null,
    jsonb_build_object(
      'identity_link_id',v_link_id,
      'person_resource_id',p_person_resource_id
    ),
    'link_person_registry_artist',
    'succeeded',
    'user:'||v_actor::text
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'person_resource_id',p_person_resource_id,
    'registry_artist_id',p_registry_artist_id,
    'identity_link_id',v_link_id,
    'identity_revision',v_person.identity_revision,
    'evidence_assertion_id',p_evidence_assertion_id,
    'canonical_write_event_id',v_event_id,
    'changed',true
  );
end
$$;

revoke all on function
  public.admin_link_person_registry_artist_v1(uuid,bigint,uuid,uuid,text)
from public,anon,service_role;

grant execute on function
  public.admin_link_person_registry_artist_v1(uuid,bigint,uuid,uuid,text)
to authenticated;

create table public.registry_artist_person_memberships (
  id uuid primary key default gen_random_uuid(),
  group_artist_id uuid not null
    references public.registry_artists(id)
    on update restrict
    on delete restrict,
  person_resource_id uuid not null
    references editorial.people(resource_id)
    on update restrict
    on delete restrict,
  role_key text not null default 'member',
  role_detail text,
  valid_from date,
  valid_to date,
  evidence_assertion_id uuid not null
    references platform_private.registry_evidence_assertions(id)
    on update restrict
    on delete restrict,
  review_state text not null,
  superseded_by_membership_id uuid
    references public.registry_artist_person_memberships(id)
    on update restrict
    on delete restrict,
  created_by uuid
    references auth.users(id)
    on update restrict
    on delete restrict,
  reviewed_by uuid
    references auth.users(id)
    on update restrict
    on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint registry_artist_person_memberships_role_check
    check (
      role_key = any(array[
        'member'::text,
        'founder'::text,
        'lead'::text,
        'vocalist'::text,
        'instrumentalist'::text,
        'producer'::text,
        'director'::text,
        'other_reviewed'::text
      ])
    ),

  constraint registry_artist_person_memberships_role_detail_check
    check (
      role_detail is null
      or (
        btrim(role_detail) <> ''
        and octet_length(role_detail) <= 1000
      )
    ),

  constraint registry_artist_person_memberships_validity_check
    check (
      valid_from is null
      or valid_to is null
      or valid_to>=valid_from
    ),

  constraint registry_artist_person_memberships_review_state_check
    check (
      review_state = any(array[
        'asserted'::text,
        'supported'::text,
        'verified'::text,
        'disputed'::text,
        'superseded'::text,
        'rejected'::text
      ])
    ),

  constraint registry_artist_person_memberships_supersession_check
    check (
      superseded_by_membership_id is null
      or superseded_by_membership_id<>id
    )
);

comment on table public.registry_artist_person_memberships is
  'Typed Group Artist to Person membership authority. Membership never implies participation on a Recording.';

create index registry_artist_person_memberships_group_idx
  on public.registry_artist_person_memberships(
    group_artist_id,
    review_state,
    valid_from,
    valid_to
  );

create index registry_artist_person_memberships_person_idx
  on public.registry_artist_person_memberships(
    person_resource_id,
    review_state,
    valid_from,
    valid_to
  );

create index registry_artist_person_memberships_evidence_idx
  on public.registry_artist_person_memberships(evidence_assertion_id);

create trigger touch_registry_artist_person_memberships_updated_at
before update on public.registry_artist_person_memberships
for each row
execute function public.wk_touch_updated_at();

alter table public.registry_artist_person_memberships
  enable row level security;

revoke all on table public.registry_artist_person_memberships
from public,anon,authenticated,service_role;

grant select on table public.registry_artist_person_memberships
to service_role;

create function public.admin_admit_registry_artist_person_membership_v1(
  p_group_artist_id uuid,
  p_person_resource_id uuid,
  p_role_key text,
  p_role_detail text,
  p_valid_from date,
  p_valid_to date,
  p_evidence_assertion_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,editorial,platform_private,auth
as $$
declare
  v_actor uuid:=auth.uid();
  v_artist public.registry_artists%rowtype;
  v_person editorial.people%rowtype;
  v_evidence platform_private.registry_evidence_assertions%rowtype;
  v_existing_id uuid;
  v_membership public.registry_artist_person_memberships%rowtype;
  v_event_id uuid;
begin
  if v_actor is null
     or not coalesce(public.current_user_has_capability('manage_registry'),false)
  then
    raise exception using errcode='42501',
      message='manage_registry is required.';
  end if;

  if p_group_artist_id is null
     or p_person_resource_id is null
     or p_evidence_assertion_id is null
     or p_role_key is null
     or p_role_key not in (
       'member','founder','lead','vocalist',
       'instrumentalist','producer','director','other_reviewed'
     )
     or (
       p_valid_from is not null
       and p_valid_to is not null
       and p_valid_to<p_valid_from
     )
  then
    raise exception using errcode='22023',
      message='Valid Group Artist, Person, role, dates, and evidence are required.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'artist-person-membership:'||
      p_group_artist_id::text||':'||
      p_person_resource_id::text,
      0
    )
  );

  select artist.*
  into v_artist
  from public.registry_artists artist
  where artist.id=p_group_artist_id
  for update;

  if not found
     or v_artist.status='archived'
     or v_artist.artist_type not in ('band','group','collective','duo')
  then
    raise exception using errcode='23514',
      message='Typed Artist membership requires a non-archived Group/Band/Collective/Duo Artist.';
  end if;

  select person.*
  into v_person
  from editorial.people person
  where person.resource_id=p_person_resource_id
  for update;

  if not found or v_person.person_state<>'active' then
    raise exception using errcode='P0002',
      message='Membership Person is missing or inactive.';
  end if;

  select assertion.*
  into v_evidence
  from platform_private.registry_evidence_assertions assertion
  where assertion.id=p_evidence_assertion_id;

  if not found
     or v_evidence.subject_type<>'artist'
     or v_evidence.subject_id<>p_group_artist_id
     or v_evidence.claim_key<>'registry.artist.person_membership'
     or v_evidence.trust_class not in (
       'INTERNAL_FACT',
       'EXTERNAL_EVIDENCE',
       'USER_CONTENT'
     )
  then
    raise exception using errcode='42501',
      message='Evidence is not valid typed Group membership authority.';
  end if;

  select membership.id
  into v_existing_id
  from public.registry_artist_person_memberships membership
  where membership.group_artist_id=p_group_artist_id
    and membership.person_resource_id=p_person_resource_id
    and membership.review_state in (
      'asserted','supported','verified','disputed'
    )
    and coalesce(membership.valid_to,'infinity'::date)
        >= coalesce(p_valid_from,'-infinity'::date)
    and coalesce(p_valid_to,'infinity'::date)
        >= coalesce(membership.valid_from,'-infinity'::date)
  limit 1;

  if v_existing_id is not null then
    raise exception using errcode='23505',
      message='An overlapping current Group membership already exists.';
  end if;

  insert into public.registry_artist_person_memberships (
    group_artist_id,
    person_resource_id,
    role_key,
    role_detail,
    valid_from,
    valid_to,
    evidence_assertion_id,
    review_state,
    created_by,
    reviewed_by
  )
  values (
    p_group_artist_id,
    p_person_resource_id,
    p_role_key,
    nullif(btrim(coalesce(p_role_detail,'')),''),
    p_valid_from,
    p_valid_to,
    p_evidence_assertion_id,
    'verified',
    v_actor,
    v_actor
  )
  returning * into v_membership;

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
    p_group_artist_id::text,
    p_evidence_assertion_id::text,
    'platform_private.registry_evidence_assertions',
    'person_membership',
    'public.registry_artist_person_memberships',
    null,
    to_jsonb(v_membership),
    'admit_artist_person_membership',
    'succeeded',
    'user:'||v_actor::text
  )
  returning id into v_event_id;

  return to_jsonb(v_membership)||
    jsonb_build_object(
      '_authority',
      jsonb_build_object(
        'verified',true,
        'canonical_write_event_id',v_event_id,
        'evidence_assertion_id',p_evidence_assertion_id
      )
    );
end
$$;

revoke all on function
  public.admin_admit_registry_artist_person_membership_v1(
    uuid,uuid,text,text,date,date,uuid
  )
from public,anon,service_role;

grant execute on function
  public.admin_admit_registry_artist_person_membership_v1(
    uuid,uuid,text,text,date,date,uuid
  )
to authenticated;

do $authority_proof$
begin
  if has_table_privilege(
       'anon',
       'public.registry_artist_person_memberships',
       'INSERT'
     )
     or has_table_privilege(
       'authenticated',
       'public.registry_artist_person_memberships',
       'INSERT'
     )
     or has_table_privilege(
       'service_role',
       'public.registry_artist_person_memberships',
       'INSERT'
     )
     or has_table_privilege(
       'anon',
       'platform_private.registry_contribution_attestations',
       'SELECT'
     )
     or has_table_privilege(
       'authenticated',
       'platform_private.registry_contribution_attestations',
       'SELECT'
     )
     or has_table_privilege(
       'service_role',
       'platform_private.registry_contribution_attestations',
       'SELECT'
     )
  then
    raise exception
      'Provenance Slice 1 leaked direct table authority.';
  end if;

  if has_function_privilege(
       'anon',
       'public.admin_link_person_registry_artist_v1(uuid,bigint,uuid,uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_link_person_registry_artist_v1(uuid,bigint,uuid,uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.admin_admit_registry_artist_person_membership_v1(uuid,uuid,text,text,date,date,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_admit_registry_artist_person_membership_v1(uuid,uuid,text,text,date,date,uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'Provenance Slice 1 reviewed identity RPC leaked execution authority.';
  end if;

  if position(
       'registry_artist_id'
       in pg_get_functiondef(
         'editorial.resolve_person_presentation(uuid)'::regprocedure
       )
     )<>0
  then
    raise exception
      'Registry Artist identity was incorrectly turned into automatic Person presentation authority.';
  end if;

  if exists (
    select 1
    from public.registry_artist_person_memberships
  ) then
    raise exception
      'Provenance Slice 1 migration must not seed Group memberships.';
  end if;

  if exists (
    select 1
    from platform_private.registry_contribution_attestations
  ) then
    raise exception
      'Provenance Slice 1 migration must not seed contribution attestations.';
  end if;
end
$authority_proof$;

commit;
