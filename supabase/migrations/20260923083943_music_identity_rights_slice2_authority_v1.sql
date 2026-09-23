begin;

-- Music Identity & Rights Foundation — Slice 2 schema authority.
-- Schema-only foundation: no historical backfill, no public mutation RPCs,
-- no executable Slice 2 Registry operation is enabled by this migration.

do $preflight$
begin
  if to_regclass('public.registry_tracks') is null
     or to_regclass('public.registry_releases') is null
     or to_regclass('public.registry_artists') is null
     or to_regclass('editorial.people') is null
     or to_regclass('editorial.organizations') is null
     or to_regclass('platform_private.registry_evidence_assertions') is null
     or to_regclass('platform_private.registry_execution_grant_targets') is null
     or to_regclass('platform_private.registry_review_cases') is null
     or to_regclass('platform_private.registry_operation_types') is null
     or to_regclass('public.capability_definitions') is null
  then
    raise exception 'Music ontology Slice 2 prerequisite authority is incomplete';
  end if;

  if to_regprocedure('public.wk_touch_updated_at()') is null then
    raise exception 'Music ontology Slice 2 requires public.wk_touch_updated_at()';
  end if;
end
$preflight$;

create table public.registry_works (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  normalized_title text not null,
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint registry_works_title_check
    check (
      btrim(title) <> ''
      and octet_length(title) <= 1000
    ),
  constraint registry_works_normalized_title_check
    check (
      btrim(normalized_title) <> ''
      and octet_length(normalized_title) <= 1000
    ),
  constraint registry_works_status_check
    check (
      status = any (
        array[
          'draft'::text,
          'active'::text,
          'needs_review'::text,
          'archived'::text
        ]
      )
    ),
  constraint registry_works_metadata_check
    check (
      jsonb_typeof(metadata) = 'object'
      and octet_length(metadata::text) <= 16384
    )
);

comment on table public.registry_works is
  'Canonical Musical Work identity. WAKILISHA UUID is authoritative; external identifiers remain assertions.';

create trigger touch_registry_works_updated_at
before update on public.registry_works
for each row
execute function public.wk_touch_updated_at();

create table public.registry_track_work_links (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null
    references public.registry_tracks(id)
    on update restrict
    on delete restrict,
  work_id uuid not null
    references public.registry_works(id)
    on update restrict
    on delete restrict,
  relationship_kind text not null,
  status text not null default 'asserted',
  evidence_assertion_id uuid
    references platform_private.registry_evidence_assertions(id)
    on update restrict
    on delete restrict,
  valid_from timestamptz,
  valid_to timestamptz,
  superseded_by_link_id uuid
    references public.registry_track_work_links(id)
    on update restrict
    on delete restrict,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint registry_track_work_links_relationship_kind_check
    check (
      relationship_kind = any (
        array[
          'embodies'::text,
          'adaptation_of'::text,
          'medley_component'::text,
          'sampled_work'::text,
          'other_reviewed'::text
        ]
      )
    ),
  constraint registry_track_work_links_status_check
    check (
      status = any (
        array[
          'asserted'::text,
          'supported'::text,
          'verified'::text,
          'disputed'::text,
          'superseded'::text,
          'rejected'::text
        ]
      )
    ),
  constraint registry_track_work_links_validity_check
    check (
      valid_from is null
      or valid_to is null
      or valid_to >= valid_from
    ),
  constraint registry_track_work_links_no_self_supersession_check
    check (
      superseded_by_link_id is null
      or superseded_by_link_id <> id
    )
);

comment on table public.registry_track_work_links is
  'Typed canonical Recording-to-Work authority. Multiple Works per Recording are permitted.';

create index registry_track_work_links_track_idx
  on public.registry_track_work_links(track_id);

create index registry_track_work_links_work_idx
  on public.registry_track_work_links(work_id);

create index registry_track_work_links_evidence_idx
  on public.registry_track_work_links(evidence_assertion_id)
  where evidence_assertion_id is not null;

create index registry_track_work_links_superseded_idx
  on public.registry_track_work_links(superseded_by_link_id)
  where superseded_by_link_id is not null;

create trigger touch_registry_track_work_links_updated_at
before update on public.registry_track_work_links
for each row
execute function public.wk_touch_updated_at();

create table public.registry_track_contributions (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null
    references public.registry_tracks(id)
    on update restrict
    on delete restrict,
  person_resource_id uuid
    references editorial.people(resource_id)
    on update restrict
    on delete restrict,
  organization_resource_id uuid
    references editorial.organizations(resource_id)
    on update restrict
    on delete restrict,
  artist_id uuid
    references public.registry_artists(id)
    on update restrict
    on delete restrict,
  credited_as text,
  role_key text not null,
  instrument_key text,
  detail_text text,
  credit_order integer,
  status text not null default 'asserted',
  evidence_assertion_id uuid
    references platform_private.registry_evidence_assertions(id)
    on update restrict
    on delete restrict,
  valid_from timestamptz,
  valid_to timestamptz,
  superseded_by_contribution_id uuid
    references public.registry_track_contributions(id)
    on update restrict
    on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint registry_track_contributions_underlying_identity_check
    check (
      num_nonnulls(person_resource_id, organization_resource_id) <= 1
    ),
  constraint registry_track_contributions_contributor_presence_check
    check (
      num_nonnulls(person_resource_id, organization_resource_id, artist_id) >= 1
      or (
        credited_as is not null
        and btrim(credited_as) <> ''
      )
    ),
  constraint registry_track_contributions_credited_as_check
    check (
      credited_as is null
      or (
        btrim(credited_as) <> ''
        and octet_length(credited_as) <= 1000
      )
    ),
  constraint registry_track_contributions_role_check
    check (
      role_key = any (
        array[
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
        ]
      )
    ),
  constraint registry_track_contributions_instrument_key_check
    check (
      instrument_key is null
      or (
        instrument_key = lower(instrument_key)
        and instrument_key ~ '^[a-z0-9][a-z0-9_.:-]{1,79}$'
      )
    ),
  constraint registry_track_contributions_detail_check
    check (
      detail_text is null
      or (
        btrim(detail_text) <> ''
        and octet_length(detail_text) <= 2000
      )
    ),
  constraint registry_track_contributions_credit_order_check
    check (
      credit_order is null
      or credit_order > 0
    ),
  constraint registry_track_contributions_status_check
    check (
      status = any (
        array[
          'asserted'::text,
          'supported'::text,
          'verified'::text,
          'disputed'::text,
          'superseded'::text,
          'rejected'::text
        ]
      )
    ),
  constraint registry_track_contributions_validity_check
    check (
      valid_from is null
      or valid_to is null
      or valid_to >= valid_from
    ),
  constraint registry_track_contributions_no_self_supersession_check
    check (
      superseded_by_contribution_id is null
      or superseded_by_contribution_id <> id
    )
);

comment on table public.registry_track_contributions is
  'Recording-side contribution authority, separate from public Artist billing credits.';

create index registry_track_contributions_track_idx
  on public.registry_track_contributions(track_id);

create index registry_track_contributions_person_idx
  on public.registry_track_contributions(person_resource_id)
  where person_resource_id is not null;

create index registry_track_contributions_organization_idx
  on public.registry_track_contributions(organization_resource_id)
  where organization_resource_id is not null;

create index registry_track_contributions_artist_idx
  on public.registry_track_contributions(artist_id)
  where artist_id is not null;

create index registry_track_contributions_evidence_idx
  on public.registry_track_contributions(evidence_assertion_id)
  where evidence_assertion_id is not null;

create index registry_track_contributions_superseded_idx
  on public.registry_track_contributions(superseded_by_contribution_id)
  where superseded_by_contribution_id is not null;

create trigger touch_registry_track_contributions_updated_at
before update on public.registry_track_contributions
for each row
execute function public.wk_touch_updated_at();

create table public.registry_work_contributions (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null
    references public.registry_works(id)
    on update restrict
    on delete restrict,
  person_resource_id uuid
    references editorial.people(resource_id)
    on update restrict
    on delete restrict,
  organization_resource_id uuid
    references editorial.organizations(resource_id)
    on update restrict
    on delete restrict,
  artist_id uuid
    references public.registry_artists(id)
    on update restrict
    on delete restrict,
  credited_as text,
  role_key text not null,
  credit_order integer,
  status text not null default 'asserted',
  evidence_assertion_id uuid
    references platform_private.registry_evidence_assertions(id)
    on update restrict
    on delete restrict,
  valid_from timestamptz,
  valid_to timestamptz,
  superseded_by_contribution_id uuid
    references public.registry_work_contributions(id)
    on update restrict
    on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint registry_work_contributions_underlying_identity_check
    check (
      num_nonnulls(person_resource_id, organization_resource_id) <= 1
    ),
  constraint registry_work_contributions_contributor_presence_check
    check (
      num_nonnulls(person_resource_id, organization_resource_id, artist_id) >= 1
      or (
        credited_as is not null
        and btrim(credited_as) <> ''
      )
    ),
  constraint registry_work_contributions_credited_as_check
    check (
      credited_as is null
      or (
        btrim(credited_as) <> ''
        and octet_length(credited_as) <= 1000
      )
    ),
  constraint registry_work_contributions_role_check
    check (
      role_key = any (
        array[
          'composer'::text,
          'lyricist'::text,
          'songwriter'::text,
          'arranger'::text,
          'adaptor'::text,
          'translator'::text,
          'publisher_representative'::text,
          'other_reviewed'::text
        ]
      )
    ),
  constraint registry_work_contributions_credit_order_check
    check (
      credit_order is null
      or credit_order > 0
    ),
  constraint registry_work_contributions_status_check
    check (
      status = any (
        array[
          'asserted'::text,
          'supported'::text,
          'verified'::text,
          'disputed'::text,
          'superseded'::text,
          'rejected'::text
        ]
      )
    ),
  constraint registry_work_contributions_validity_check
    check (
      valid_from is null
      or valid_to is null
      or valid_to >= valid_from
    ),
  constraint registry_work_contributions_no_self_supersession_check
    check (
      superseded_by_contribution_id is null
      or superseded_by_contribution_id <> id
    )
);

comment on table public.registry_work_contributions is
  'Musical Work contribution authority for authorship and related reviewed roles.';

create index registry_work_contributions_work_idx
  on public.registry_work_contributions(work_id);

create index registry_work_contributions_person_idx
  on public.registry_work_contributions(person_resource_id)
  where person_resource_id is not null;

create index registry_work_contributions_organization_idx
  on public.registry_work_contributions(organization_resource_id)
  where organization_resource_id is not null;

create index registry_work_contributions_artist_idx
  on public.registry_work_contributions(artist_id)
  where artist_id is not null;

create index registry_work_contributions_evidence_idx
  on public.registry_work_contributions(evidence_assertion_id)
  where evidence_assertion_id is not null;

create index registry_work_contributions_superseded_idx
  on public.registry_work_contributions(superseded_by_contribution_id)
  where superseded_by_contribution_id is not null;

create trigger touch_registry_work_contributions_updated_at
before update on public.registry_work_contributions
for each row
execute function public.wk_touch_updated_at();

create table public.registry_rights_claims (
  id uuid primary key default gen_random_uuid(),
  track_id uuid
    references public.registry_tracks(id)
    on update restrict
    on delete restrict,
  work_id uuid
    references public.registry_works(id)
    on update restrict
    on delete restrict,
  claimant_person_resource_id uuid
    references editorial.people(resource_id)
    on update restrict
    on delete restrict,
  claimant_organization_resource_id uuid
    references editorial.organizations(resource_id)
    on update restrict
    on delete restrict,
  rights_domain text not null,
  right_type text not null,
  control_type text not null,
  territory_scope text not null default 'unknown',
  territory_iso2 text[] not null default '{}'::text[],
  usage_scope text[] not null default '{}'::text[],
  valid_from date,
  valid_to date,
  share_state text not null default 'unknown',
  share_percentage numeric(9,6),
  claim_status text not null default 'asserted',
  evidence_assertion_id uuid
    references platform_private.registry_evidence_assertions(id)
    on update restrict
    on delete restrict,
  superseded_by_claim_id uuid
    references public.registry_rights_claims(id)
    on update restrict
    on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint registry_rights_claims_subject_exactly_one_check
    check (
      num_nonnulls(track_id, work_id) = 1
    ),
  constraint registry_rights_claims_domain_subject_check
    check (
      (rights_domain = 'recording' and track_id is not null and work_id is null)
      or
      (rights_domain = 'work' and work_id is not null and track_id is null)
    ),
  constraint registry_rights_claims_claimant_exactly_one_check
    check (
      num_nonnulls(
        claimant_person_resource_id,
        claimant_organization_resource_id
      ) = 1
    ),
  constraint registry_rights_claims_right_type_check
    check (
      right_type = any (
        array[
          'ownership'::text,
          'control'::text,
          'administration'::text,
          'collection'::text,
          'licensing'::text,
          'other_reviewed'::text
        ]
      )
    ),
  constraint registry_rights_claims_control_type_check
    check (
      control_type = any (
        array[
          'owner'::text,
          'controller'::text,
          'administrator'::text,
          'publisher'::text,
          'collecting_society'::text,
          'other_reviewed'::text
        ]
      )
    ),
  constraint registry_rights_claims_territory_scope_check
    check (
      territory_scope = any (
        array[
          'worldwide'::text,
          'explicit'::text,
          'unknown'::text
        ]
      )
    ),
  constraint registry_rights_claims_territory_values_check
    check (
      (
        territory_scope in ('worldwide', 'unknown')
        and cardinality(territory_iso2) = 0
      )
      or
      (
        territory_scope = 'explicit'
        and cardinality(territory_iso2) between 1 and 249
        and territory_iso2::text ~ '^\{[A-Z]{2}(,[A-Z]{2})*\}$'
      )
    ),
  constraint registry_rights_claims_usage_scope_check
    check (
      cardinality(usage_scope) <= 16
      and usage_scope <@ array[
        'mechanical'::text,
        'performance'::text,
        'synchronization'::text,
        'communication_to_public'::text,
        'reproduction'::text,
        'distribution'::text,
        'other_reviewed'::text
      ]
    ),
  constraint registry_rights_claims_validity_check
    check (
      valid_from is null
      or valid_to is null
      or valid_to >= valid_from
    ),
  constraint registry_rights_claims_share_state_check
    check (
      share_state = any (
        array[
          'known'::text,
          'unknown'::text,
          'disputed'::text,
          'not_applicable'::text
        ]
      )
    ),
  constraint registry_rights_claims_share_value_check
    check (
      (
        share_state = 'known'
        and share_percentage is not null
        and share_percentage >= 0
        and share_percentage <= 100
      )
      or
      (
        share_state <> 'known'
        and share_percentage is null
      )
    ),
  constraint registry_rights_claims_status_check
    check (
      claim_status = any (
        array[
          'asserted'::text,
          'supported'::text,
          'verified'::text,
          'disputed'::text,
          'superseded'::text,
          'rejected'::text
        ]
      )
    ),
  constraint registry_rights_claims_no_self_supersession_check
    check (
      superseded_by_claim_id is null
      or superseded_by_claim_id <> id
    )
);

comment on table public.registry_rights_claims is
  'Evidence-backed Recording or Work rights assertions. Conflicting claims may coexist and are not normalized to 100 percent.';

create index registry_rights_claims_track_idx
  on public.registry_rights_claims(track_id)
  where track_id is not null;

create index registry_rights_claims_work_idx
  on public.registry_rights_claims(work_id)
  where work_id is not null;

create index registry_rights_claims_claimant_person_idx
  on public.registry_rights_claims(claimant_person_resource_id)
  where claimant_person_resource_id is not null;

create index registry_rights_claims_claimant_organization_idx
  on public.registry_rights_claims(claimant_organization_resource_id)
  where claimant_organization_resource_id is not null;

create index registry_rights_claims_evidence_idx
  on public.registry_rights_claims(evidence_assertion_id)
  where evidence_assertion_id is not null;

create index registry_rights_claims_superseded_idx
  on public.registry_rights_claims(superseded_by_claim_id)
  where superseded_by_claim_id is not null;

create trigger touch_registry_rights_claims_updated_at
before update on public.registry_rights_claims
for each row
execute function public.wk_touch_updated_at();

create table public.registry_external_identifier_assertions (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid
    references public.registry_artists(id)
    on update restrict
    on delete restrict,
  track_id uuid
    references public.registry_tracks(id)
    on update restrict
    on delete restrict,
  release_id uuid
    references public.registry_releases(id)
    on update restrict
    on delete restrict,
  work_id uuid
    references public.registry_works(id)
    on update restrict
    on delete restrict,
  person_resource_id uuid
    references editorial.people(resource_id)
    on update restrict
    on delete restrict,
  organization_resource_id uuid
    references editorial.organizations(resource_id)
    on update restrict
    on delete restrict,
  scheme_key text not null,
  source_value text not null,
  comparison_value text not null,
  issuer_namespace text,
  assertion_status text not null default 'candidate',
  verification_method text,
  verified_by uuid,
  verified_at timestamptz,
  valid_from timestamptz,
  valid_to timestamptz,
  evidence_assertion_id uuid
    references platform_private.registry_evidence_assertions(id)
    on update restrict
    on delete restrict,
  superseded_by_assertion_id uuid
    references public.registry_external_identifier_assertions(id)
    on update restrict
    on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint registry_external_identifier_assertions_subject_exactly_one_check
    check (
      num_nonnulls(
        artist_id,
        track_id,
        release_id,
        work_id,
        person_resource_id,
        organization_resource_id
      ) = 1
    ),
  constraint registry_external_identifier_assertions_scheme_check
    check (
      scheme_key = any (
        array[
          'isrc'::text,
          'iswc'::text,
          'isni'::text,
          'ipi'::text,
          'ipn'::text,
          'gtin'::text,
          'upc'::text,
          'ean'::text,
          'apple_music'::text,
          'spotify'::text,
          'youtube'::text,
          'soundcloud'::text,
          'ddex_party_id'::text,
          'other_reviewed'::text
        ]
      )
    ),
  constraint registry_external_identifier_assertions_source_value_check
    check (
      btrim(source_value) <> ''
      and octet_length(source_value) <= 2000
    ),
  constraint registry_external_identifier_assertions_comparison_value_check
    check (
      btrim(comparison_value) <> ''
      and octet_length(comparison_value) <= 2000
    ),
  constraint registry_external_identifier_assertions_issuer_namespace_check
    check (
      issuer_namespace is null
      or (
        btrim(issuer_namespace) <> ''
        and octet_length(issuer_namespace) <= 500
      )
    ),
  constraint registry_external_identifier_assertions_status_check
    check (
      assertion_status = any (
        array[
          'candidate'::text,
          'accepted'::text,
          'disputed'::text,
          'rejected'::text,
          'superseded'::text
        ]
      )
    ),
  constraint registry_external_identifier_assertions_verification_method_check
    check (
      verification_method is null
      or (
        btrim(verification_method) <> ''
        and octet_length(verification_method) <= 500
      )
    ),
  constraint registry_external_identifier_assertions_acceptance_check
    check (
      assertion_status <> 'accepted'
      or (
        verification_method is not null
        and verified_at is not null
      )
    ),
  constraint registry_external_identifier_assertions_validity_check
    check (
      valid_from is null
      or valid_to is null
      or valid_to >= valid_from
    ),
  constraint registry_external_identifier_assertions_no_self_supersession_check
    check (
      superseded_by_assertion_id is null
      or superseded_by_assertion_id <> id
    )
);

comment on table public.registry_external_identifier_assertions is
  'Historical and current external identifier assertions. No external identifier replaces WAKILISHA UUID identity.';

create index registry_external_identifier_assertions_scheme_value_idx
  on public.registry_external_identifier_assertions(
    scheme_key,
    comparison_value
  );

create index registry_external_identifier_assertions_evidence_idx
  on public.registry_external_identifier_assertions(evidence_assertion_id)
  where evidence_assertion_id is not null;

create index registry_external_identifier_assertions_superseded_idx
  on public.registry_external_identifier_assertions(superseded_by_assertion_id)
  where superseded_by_assertion_id is not null;

create unique index registry_external_identifier_assertions_artist_accepted_key
  on public.registry_external_identifier_assertions(
    artist_id,
    scheme_key,
    comparison_value,
    coalesce(issuer_namespace, '')
  )
  where artist_id is not null
    and assertion_status = 'accepted'
    and valid_to is null;

create unique index registry_external_identifier_assertions_track_accepted_key
  on public.registry_external_identifier_assertions(
    track_id,
    scheme_key,
    comparison_value,
    coalesce(issuer_namespace, '')
  )
  where track_id is not null
    and assertion_status = 'accepted'
    and valid_to is null;

create unique index registry_external_identifier_assertions_release_accepted_key
  on public.registry_external_identifier_assertions(
    release_id,
    scheme_key,
    comparison_value,
    coalesce(issuer_namespace, '')
  )
  where release_id is not null
    and assertion_status = 'accepted'
    and valid_to is null;

create unique index registry_external_identifier_assertions_work_accepted_key
  on public.registry_external_identifier_assertions(
    work_id,
    scheme_key,
    comparison_value,
    coalesce(issuer_namespace, '')
  )
  where work_id is not null
    and assertion_status = 'accepted'
    and valid_to is null;

create unique index registry_external_identifier_assertions_person_accepted_key
  on public.registry_external_identifier_assertions(
    person_resource_id,
    scheme_key,
    comparison_value,
    coalesce(issuer_namespace, '')
  )
  where person_resource_id is not null
    and assertion_status = 'accepted'
    and valid_to is null;

create unique index registry_external_identifier_assertions_organization_accepted_key
  on public.registry_external_identifier_assertions(
    organization_resource_id,
    scheme_key,
    comparison_value,
    coalesce(issuer_namespace, '')
  )
  where organization_resource_id is not null
    and assertion_status = 'accepted'
    and valid_to is null;

create trigger touch_registry_external_identifier_assertions_updated_at
before update on public.registry_external_identifier_assertions
for each row
execute function public.wk_touch_updated_at();

-- Exposed-schema tables fail closed. No browser role receives any direct access
-- in this schema foundation. service_role is read-only; future mutation uses
-- exact private Registry brokers only.
alter table public.registry_works enable row level security;
alter table public.registry_track_work_links enable row level security;
alter table public.registry_track_contributions enable row level security;
alter table public.registry_work_contributions enable row level security;
alter table public.registry_rights_claims enable row level security;
alter table public.registry_external_identifier_assertions enable row level security;

revoke all on table
  public.registry_works,
  public.registry_track_work_links,
  public.registry_track_contributions,
  public.registry_work_contributions,
  public.registry_rights_claims,
  public.registry_external_identifier_assertions
from public, anon, authenticated, service_role;

grant select on table
  public.registry_works,
  public.registry_track_work_links,
  public.registry_track_contributions,
  public.registry_work_contributions,
  public.registry_rights_claims,
  public.registry_external_identifier_assertions
to service_role;

-- Extend the exact Registry subject vocabulary atomically.
alter table platform_private.registry_evidence_assertions
  drop constraint registry_evidence_assertions_subject_type_check;

alter table platform_private.registry_evidence_assertions
  add constraint registry_evidence_assertions_subject_type_check
  check (
    subject_type = any (
      array[
        'artist'::text,
        'track'::text,
        'release'::text,
        'registry_relationship'::text,
        'track_artist_credit'::text,
        'release_track_membership'::text,
        'release_artist_credit'::text,
        'work'::text,
        'track_work_link'::text,
        'track_contribution'::text,
        'work_contribution'::text,
        'rights_claim'::text,
        'external_identifier_assertion'::text
      ]
    )
  );

alter table platform_private.registry_execution_grant_targets
  drop constraint registry_execution_grant_targets_subject_type_check;

alter table platform_private.registry_execution_grant_targets
  add constraint registry_execution_grant_targets_subject_type_check
  check (
    subject_type = any (
      array[
        'artist'::text,
        'track'::text,
        'release'::text,
        'registry_relationship'::text,
        'track_artist_credit'::text,
        'release_track_membership'::text,
        'release_artist_credit'::text,
        'work'::text,
        'track_work_link'::text,
        'track_contribution'::text,
        'work_contribution'::text,
        'rights_claim'::text,
        'external_identifier_assertion'::text
      ]
    )
  );

alter table platform_private.registry_review_cases
  drop constraint registry_review_cases_subject_type_check;

alter table platform_private.registry_review_cases
  add constraint registry_review_cases_subject_type_check
  check (
    subject_type = any (
      array[
        'artist'::text,
        'track'::text,
        'release'::text,
        'registry_relationship'::text,
        'track_artist_credit'::text,
        'release_track_membership'::text,
        'release_artist_credit'::text,
        'work'::text,
        'track_work_link'::text,
        'track_contribution'::text,
        'work_contribution'::text,
        'rights_claim'::text,
        'external_identifier_assertion'::text
      ]
    )
  );

alter table platform_private.registry_operation_types
  drop constraint registry_operation_types_subjects_check;

alter table platform_private.registry_operation_types
  add constraint registry_operation_types_subjects_check
  check (
    cardinality(allowed_subject_types) >= 1
    and cardinality(allowed_subject_types) <= 8
    and array_position(allowed_subject_types, null::text) is null
    and allowed_subject_types <@ array[
      'artist'::text,
      'track'::text,
      'release'::text,
      'registry_relationship'::text,
      'track_artist_credit'::text,
      'release_track_membership'::text,
      'release_artist_credit'::text,
      'work'::text,
      'track_work_link'::text,
      'track_contribution'::text,
      'work_contribution'::text,
      'rights_claim'::text,
      'external_identifier_assertion'::text
    ]
  );

-- Dedicated capabilities follow the existing exact Registry capability model.
insert into public.capability_definitions (
  capability_key,
  label,
  description,
  domain
)
values
  (
    'create_registry_work',
    'Create Registry Work',
    'Create one evidence-bound canonical Musical Work identity through a future typed Registry operation.',
    'registry'
  ),
  (
    'admit_registry_track_work_link',
    'Admit Registry Track Work Link',
    'Admit one evidence-bound typed Recording-to-Work assertion through a future Registry operation.',
    'registry'
  ),
  (
    'admit_registry_track_contribution',
    'Admit Registry Track Contribution',
    'Admit one evidence-bound Recording contribution through a future Registry operation.',
    'registry'
  ),
  (
    'admit_registry_work_contribution',
    'Admit Registry Work Contribution',
    'Admit one evidence-bound Musical Work contribution through a future Registry operation.',
    'registry'
  ),
  (
    'admit_registry_rights_claim',
    'Admit Registry Rights Claim',
    'Admit one evidence-bound Recording or Work rights assertion through a future Registry operation.',
    'registry'
  ),
  (
    'reconcile_registry_rights_claim',
    'Reconcile Registry Rights Claim',
    'Apply one reviewed non-destructive rights-claim reconciliation through a future Registry operation.',
    'registry'
  ),
  (
    'admit_registry_external_identifier_assertion',
    'Admit Registry External Identifier Assertion',
    'Admit one evidence-bound external identifier assertion without replacing WAKILISHA UUID identity.',
    'registry'
  ),
  (
    'reconcile_registry_external_identifier_assertion',
    'Reconcile Registry External Identifier Assertion',
    'Apply one reviewed non-destructive external identifier reconciliation through a future Registry operation.',
    'registry'
  );

-- Declarations are intentionally disabled until a separately reviewed broker
-- exists. Schema existence alone must not create executable mutation authority.
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
values
  (
    'registry.work.create',
    1,
    'create_registry_work',
    'medium',
    array['work']::text[],
    false,
    1,
    1,
    300,
    true,
    true,
    false,
    'Create one exact evidence-bound Musical Work identity. Disabled until a dedicated broker is accepted.'
  ),
  (
    'registry.track_work_link.admit',
    1,
    'admit_registry_track_work_link',
    'medium',
    array['track_work_link']::text[],
    false,
    1,
    1,
    300,
    true,
    true,
    false,
    'Admit one exact Recording-to-Work assertion. Disabled until a dedicated broker is accepted.'
  ),
  (
    'registry.track_contribution.admit',
    1,
    'admit_registry_track_contribution',
    'medium',
    array['track_contribution']::text[],
    false,
    1,
    1,
    300,
    true,
    true,
    false,
    'Admit one exact Recording contribution. Disabled until a dedicated broker is accepted.'
  ),
  (
    'registry.work_contribution.admit',
    1,
    'admit_registry_work_contribution',
    'medium',
    array['work_contribution']::text[],
    false,
    1,
    1,
    300,
    true,
    true,
    false,
    'Admit one exact Musical Work contribution. Disabled until a dedicated broker is accepted.'
  ),
  (
    'registry.rights_claim.admit',
    1,
    'admit_registry_rights_claim',
    'high',
    array['rights_claim']::text[],
    false,
    1,
    1,
    300,
    true,
    true,
    false,
    'Admit one exact Recording or Work rights assertion. Disabled until a dedicated broker is accepted.'
  ),
  (
    'registry.rights_claim.reviewed_reconcile',
    1,
    'reconcile_registry_rights_claim',
    'high',
    array['rights_claim']::text[],
    true,
    1,
    1,
    300,
    true,
    true,
    false,
    'Reconcile one exact reviewed rights assertion without destructive normalization. Disabled until a dedicated broker is accepted.'
  ),
  (
    'registry.external_identifier_assertion.admit',
    1,
    'admit_registry_external_identifier_assertion',
    'medium',
    array['external_identifier_assertion']::text[],
    false,
    1,
    1,
    300,
    true,
    true,
    false,
    'Admit one exact external identifier assertion. Disabled until a dedicated broker is accepted.'
  ),
  (
    'registry.external_identifier_assertion.reviewed_reconcile',
    1,
    'reconcile_registry_external_identifier_assertion',
    'high',
    array['external_identifier_assertion']::text[],
    true,
    1,
    1,
    300,
    true,
    true,
    false,
    'Reconcile one exact reviewed external identifier assertion non-destructively. Disabled until a dedicated broker is accepted.'
  );

commit;
