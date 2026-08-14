-- Phase 3A Migration 1: Sources, Citations, and Credits trust identity foundation.
--
-- This migration establishes:
-- 1. trust capabilities and initial role assignments
-- 2. controlled Source, Citation locator, and Credit vocabularies
-- 3. mutable Source identity and immutable Source versions
-- 4. Source-version pointer integrity
-- 5. append-only Source review events
-- 6. external-contributor identity
-- 7. immutable Credit identity
-- 8. canonical RLS and grant boundaries
--
-- Citation identity and resource attachments are introduced in Migration 2.

begin;

do $phase_3a_trust_identity_preflight$
begin
  if to_regclass('public.capability_definitions') is null then
    raise exception
      'STOP: public.capability_definitions does not exist';
  end if;

  if to_regclass('public.role_definitions') is null then
    raise exception
      'STOP: public.role_definitions does not exist';
  end if;

  if to_regclass('public.role_capabilities') is null then
    raise exception
      'STOP: public.role_capabilities does not exist';
  end if;

  if to_regclass('public.registry_authors') is null then
    raise exception
      'STOP: public.registry_authors does not exist';
  end if;

  if to_regclass('public.registry_media_assets') is null then
    raise exception
      'STOP: public.registry_media_assets does not exist';
  end if;

  if to_regprocedure(
    'public.current_user_has_capability(text)'
  ) is null then
    raise exception
      'STOP: current_user_has_capability does not exist';
  end if;

  if to_regprocedure(
    'public.current_user_is_administrator()'
  ) is null then
    raise exception
      'STOP: current_user_is_administrator does not exist';
  end if;

  if exists (
    select 1
    from (
      values
        ('administrator'),
        ('editor'),
        ('reviewer'),
        ('registry_editor'),
        ('author')
    ) required(role_key)
    where not exists (
      select 1
      from public.role_definitions definition
      where definition.role_key = required.role_key
    )
  ) then
    raise exception
      'STOP: One or more required trust role definitions do not exist';
  end if;

  if num_nonnulls(null, 1, null) <> 1 then
    raise exception
      'STOP: num_nonnulls is unavailable or returned an unexpected result';
  end if;
end;
$phase_3a_trust_identity_preflight$;

insert into public.capability_definitions (
  capability_key,
  label,
  domain,
  description
)
values
  (
    'view_trust_records',
    'View trust records',
    'content',
    'View internal Sources, Citations, Credits, and their governed trust history.'
  ),
  (
    'manage_sources',
    'Manage sources',
    'content',
    'Create and manage reusable Sources and immutable Source versions.'
  ),
  (
    'review_sources',
    'Review sources',
    'content',
    'Review submitted Source versions and govern Source public exposure.'
  ),
  (
    'withdraw_sources',
    'Withdraw sources',
    'content',
    'Withdraw and restore governed Sources while preserving history.'
  ),
  (
    'manage_citations',
    'Manage citations',
    'content',
    'Create and manage typed Citations and version-bound Citation attachments.'
  ),
  (
    'manage_credits',
    'Manage credits',
    'content',
    'Create and manage typed Credits and version-bound Credit attachments.'
  )
on conflict (capability_key)
do update set
  label = excluded.label,
  domain = excluded.domain,
  description = excluded.description,
  updated_at = now();

insert into public.role_capabilities (
  role_key,
  capability_key
)
values
  ('administrator', 'view_trust_records'),
  ('administrator', 'manage_sources'),
  ('administrator', 'review_sources'),
  ('administrator', 'withdraw_sources'),
  ('administrator', 'manage_citations'),
  ('administrator', 'manage_credits'),

  ('editor', 'view_trust_records'),
  ('editor', 'manage_sources'),
  ('editor', 'manage_citations'),
  ('editor', 'manage_credits'),

  ('reviewer', 'view_trust_records'),
  ('reviewer', 'review_sources'),

  ('registry_editor', 'view_trust_records'),
  ('registry_editor', 'manage_sources'),
  ('registry_editor', 'manage_citations')
on conflict (role_key, capability_key)
do nothing;

create table editorial.source_types (
  source_type text primary key,
  label text not null,
  description text not null,
  enabled boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),

  constraint source_types_key_check
    check (source_type ~ '^[a-z][a-z0-9_]*$'),

  constraint source_types_label_check
    check (nullif(btrim(label), '') is not null),

  constraint source_types_description_check
    check (nullif(btrim(description), '') is not null)
);

create table editorial.citation_locator_types (
  locator_type text primary key,
  label text not null,
  description text not null,
  enabled boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),

  constraint citation_locator_types_key_check
    check (locator_type ~ '^[a-z][a-z0-9_]*$'),

  constraint citation_locator_types_label_check
    check (nullif(btrim(label), '') is not null),

  constraint citation_locator_types_description_check
    check (nullif(btrim(description), '') is not null)
);

create table editorial.credit_roles (
  credit_role text primary key,
  label text not null,
  description text not null,
  enabled boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),

  constraint credit_roles_key_check
    check (credit_role ~ '^[a-z][a-z0-9_]*$'),

  constraint credit_roles_label_check
    check (nullif(btrim(label), '') is not null),

  constraint credit_roles_description_check
    check (nullif(btrim(description), '') is not null)
);

insert into editorial.source_types (
  source_type,
  label,
  description,
  sort_order
)
values
  ('interview', 'Interview', 'Recorded or documented interview material.', 10),
  ('book', 'Book', 'Published book or monograph.', 20),
  ('article', 'Article', 'Published editorial or journalistic article.', 30),
  ('archive_document', 'Archive document', 'Document held by an archive or collection.', 40),
  ('photograph', 'Photograph', 'Still photographic source material.', 50),
  ('audio_recording', 'Audio recording', 'Recorded audio source material.', 60),
  ('video_recording', 'Video recording', 'Recorded video source material.', 70),
  ('registry_record', 'Registry record', 'Reviewed canonical Registry record.', 80),
  ('community_memory', 'Community memory', 'Documented community or oral-memory source.', 90),
  ('institutional_document', 'Institutional document', 'Document issued or held by an institution.', 100),
  ('social_post', 'Social post', 'Public or reviewed social-media material.', 110),
  ('dataset', 'Dataset', 'Structured dataset or data extract.', 120),
  ('website', 'Website', 'Website page or web-native publication.', 130),
  ('physical_artefact', 'Physical artefact', 'Physical object used as evidence or context.', 140),
  ('other', 'Other', 'Other reviewed Source type.', 1000);

insert into editorial.citation_locator_types (
  locator_type,
  label,
  description,
  sort_order
)
values
  ('page', 'Page', 'One page in a paginated Source.', 10),
  ('page_range', 'Page range', 'A contiguous range of pages.', 20),
  ('paragraph', 'Paragraph', 'One identified paragraph.', 30),
  ('quotation', 'Quotation', 'An exact quoted portion of a Source.', 40),
  ('timestamp', 'Timestamp', 'One time position in recorded media.', 50),
  ('timestamp_range', 'Timestamp range', 'A time range in recorded media.', 60),
  ('chapter', 'Chapter', 'A named or numbered chapter.', 70),
  ('image_frame', 'Image frame', 'One frame or bounded image area.', 80),
  ('spreadsheet_row', 'Spreadsheet row', 'One row in a spreadsheet or table.', 90),
  ('spreadsheet_cell', 'Spreadsheet cell', 'One spreadsheet cell or bounded cell range.', 100),
  ('archive_identifier', 'Archive identifier', 'An archive-specific locator or reference.', 110),
  ('transcript_range', 'Transcript range', 'A bounded range in a transcript.', 120),
  ('section_heading', 'Section heading', 'A section identified by heading.', 130),
  ('whole_source', 'Whole source', 'The complete Source when no narrower locator applies.', 140),
  ('other', 'Other', 'Another reviewed typed locator.', 1000);

insert into editorial.credit_roles (
  credit_role,
  label,
  description,
  sort_order
)
values
  ('author', 'Author', 'Primary or contributing author.', 10),
  ('editor', 'Editor', 'Editorial contributor or editor.', 20),
  ('curator', 'Curator', 'Curator of a collection or programme.', 30),
  ('researcher', 'Researcher', 'Research contributor.', 40),
  ('interviewer', 'Interviewer', 'Person who conducted an interview.', 50),
  ('producer', 'Producer', 'Production contributor.', 60),
  ('host', 'Host', 'Programme, audio, or video host.', 70),
  ('guest', 'Guest', 'Guest contributor or participant.', 80),
  ('camera', 'Camera', 'Camera or cinematography contributor.', 90),
  ('audio', 'Audio', 'Audio recording or engineering contributor.', 100),
  ('translator', 'Translator', 'Translation contributor.', 110),
  ('photographer', 'Photographer', 'Photographic contributor.', 120),
  ('contributor', 'Contributor', 'General named contributor.', 130),
  ('reviewer', 'Reviewer', 'Editorial or subject reviewer.', 140),
  ('fact_checker', 'Fact checker', 'Fact-checking contributor.', 150),
  ('other', 'Other', 'Other reviewed contribution role.', 1000);

create table editorial.sources (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  title text not null,
  creator_display text,
  publisher_display text,
  source_url text,
  media_asset_id uuid,
  archive_identifier text,
  publication_date date,
  capture_date date,
  retrieval_date date,
  language_code text,
  country_code text,
  place_text text,
  rights_status text not null default 'unknown',
  consent_status text not null default 'unknown',
  sensitivity text not null default 'none',
  reliability_note text,
  credit_line text,
  internal_notes text,
  review_status text not null default 'draft',
  exposure_class text not null default 'internal',
  source_state text not null default 'active',
  current_working_version_id uuid,
  current_submitted_version_id uuid,
  current_approved_version_id uuid,
  working_revision bigint not null default 1,
  created_by uuid,
  updated_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  withdrawn_by uuid,
  withdrawn_at timestamptz,
  withdrawal_reason text,
  withdrawal_public_mode text not null default 'hide_public_reference',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint sources_source_type_fkey
    foreign key (source_type)
    references editorial.source_types(source_type)
    on update cascade
    on delete restrict,

  constraint sources_media_asset_id_fkey
    foreign key (media_asset_id)
    references public.registry_media_assets(id)
    on delete set null,

  constraint sources_created_by_fkey
    foreign key (created_by)
    references auth.users(id)
    on delete set null,

  constraint sources_updated_by_fkey
    foreign key (updated_by)
    references auth.users(id)
    on delete set null,

  constraint sources_title_check
    check (nullif(btrim(title), '') is not null),

  constraint sources_working_revision_check
    check (working_revision >= 1),

  constraint sources_review_status_check
    check (
      review_status in (
        'draft',
        'ready_for_review',
        'in_review',
        'changes_requested',
        'approved',
        'rejected'
      )
    ),

  constraint sources_exposure_class_check
    check (
      exposure_class in (
        'public',
        'public_redacted',
        'internal',
        'restricted',
        'confidential'
      )
    ),

  constraint sources_source_state_check
    check (
      source_state in (
        'active',
        'withdrawn',
        'archived'
      )
    ),

  constraint sources_sensitivity_check
    check (
      sensitivity in (
        'none',
        'low',
        'moderate',
        'high',
        'extreme'
      )
    ),

  constraint sources_rights_status_check
    check (
      rights_status in (
        'unknown',
        'owned',
        'licensed',
        'public_domain',
        'fair_use',
        'needs_clearance',
        'restricted'
      )
    ),

  constraint sources_consent_status_check
    check (
      consent_status in (
        'unknown',
        'not_required',
        'requested',
        'granted',
        'limited',
        'declined',
        'withdrawn'
      )
    ),

  constraint sources_withdrawal_public_mode_check
    check (
      withdrawal_public_mode in (
        'retain_public_reference',
        'redact_public_reference',
        'hide_public_reference'
      )
    ),

  constraint sources_review_exposure_check
    check (
      review_status = 'approved'
      or exposure_class not in ('public', 'public_redacted')
    ),

  constraint sources_withdrawal_state_check
    check (
      (
        source_state = 'withdrawn'
        and withdrawn_by is not null
        and withdrawn_at is not null
        and nullif(btrim(withdrawal_reason), '') is not null
      )
      or
      (
        source_state <> 'withdrawn'
        and withdrawn_by is null
        and withdrawn_at is null
        and withdrawal_reason is null
      )
    )
);

create table editorial.source_versions (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null,
  version_number bigint not null,
  source_type text not null,
  title text not null,
  creator_display text,
  publisher_display text,
  source_url text,
  media_asset_id uuid,
  archive_identifier text,
  publication_date date,
  capture_date date,
  retrieval_date date,
  language_code text,
  country_code text,
  place_text text,
  rights_status text not null,
  consent_status text not null,
  sensitivity text not null,
  reliability_note text,
  credit_line text,
  internal_notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  content_fingerprint text not null,

  constraint source_versions_source_id_fkey
    foreign key (source_id)
    references editorial.sources(id)
    on delete restrict,

  constraint source_versions_source_type_fkey
    foreign key (source_type)
    references editorial.source_types(source_type)
    on update cascade
    on delete restrict,

  constraint source_versions_media_asset_id_fkey
    foreign key (media_asset_id)
    references public.registry_media_assets(id)
    on delete restrict,

  constraint source_versions_number_check
    check (version_number >= 1),

  constraint source_versions_title_check
    check (nullif(btrim(title), '') is not null),

  constraint source_versions_fingerprint_check
    check (nullif(btrim(content_fingerprint), '') is not null),

  constraint source_versions_sensitivity_check
    check (
      sensitivity in (
        'none',
        'low',
        'moderate',
        'high',
        'extreme'
      )
    ),

  constraint source_versions_rights_status_check
    check (
      rights_status in (
        'unknown',
        'owned',
        'licensed',
        'public_domain',
        'fair_use',
        'needs_clearance',
        'restricted'
      )
    ),

  constraint source_versions_consent_status_check
    check (
      consent_status in (
        'unknown',
        'not_required',
        'requested',
        'granted',
        'limited',
        'declined',
        'withdrawn'
      )
    ),

  constraint source_versions_source_number_unique
    unique (source_id, version_number),

  constraint source_versions_source_fingerprint_unique
    unique (source_id, content_fingerprint)
);

alter table editorial.sources
  add constraint sources_current_working_version_fkey
  foreign key (current_working_version_id)
  references editorial.source_versions(id)
  on delete restrict
  deferrable initially deferred;

alter table editorial.sources
  add constraint sources_current_submitted_version_fkey
  foreign key (current_submitted_version_id)
  references editorial.source_versions(id)
  on delete restrict
  deferrable initially deferred;

alter table editorial.sources
  add constraint sources_current_approved_version_fkey
  foreign key (current_approved_version_id)
  references editorial.source_versions(id)
  on delete restrict
  deferrable initially deferred;

create index sources_type_state_updated_idx
on editorial.sources (
  source_type,
  source_state,
  updated_at desc
);

create index sources_review_exposure_updated_idx
on editorial.sources (
  review_status,
  exposure_class,
  updated_at desc
);

create index sources_current_working_version_idx
on editorial.sources (current_working_version_id)
where current_working_version_id is not null;

create index sources_current_submitted_version_idx
on editorial.sources (current_submitted_version_id)
where current_submitted_version_id is not null;

create index sources_current_approved_version_idx
on editorial.sources (current_approved_version_id)
where current_approved_version_id is not null;

create index sources_media_asset_idx
on editorial.sources (media_asset_id)
where media_asset_id is not null;

create index sources_source_url_idx
on editorial.sources (source_url)
where source_url is not null;

create index sources_archive_identifier_idx
on editorial.sources (archive_identifier)
where archive_identifier is not null;

create index source_versions_source_created_idx
on editorial.source_versions (
  source_id,
  created_at desc
);

create or replace function editorial.source_snapshot_fingerprint(
  p_source_type text,
  p_title text,
  p_creator_display text,
  p_publisher_display text,
  p_source_url text,
  p_media_asset_id uuid,
  p_archive_identifier text,
  p_publication_date date,
  p_capture_date date,
  p_retrieval_date date,
  p_language_code text,
  p_country_code text,
  p_place_text text,
  p_rights_status text,
  p_consent_status text,
  p_sensitivity text,
  p_reliability_note text,
  p_credit_line text,
  p_internal_notes text
)
returns text
language sql
immutable
security invoker
set search_path = pg_catalog
as $function$
  select md5(
    jsonb_build_object(
      'source_type', p_source_type,
      'title', p_title,
      'creator_display', p_creator_display,
      'publisher_display', p_publisher_display,
      'source_url', p_source_url,
      'media_asset_id', p_media_asset_id,
      'archive_identifier', p_archive_identifier,
      'publication_date', p_publication_date,
      'capture_date', p_capture_date,
      'retrieval_date', p_retrieval_date,
      'language_code', p_language_code,
      'country_code', p_country_code,
      'place_text', p_place_text,
      'rights_status', p_rights_status,
      'consent_status', p_consent_status,
      'sensitivity', p_sensitivity,
      'reliability_note', p_reliability_note,
      'credit_line', p_credit_line,
      'internal_notes', p_internal_notes
    )::text
  );
$function$;

revoke all on function
  editorial.source_snapshot_fingerprint(
    text,
    text,
    text,
    text,
    text,
    uuid,
    text,
    date,
    date,
    date,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text
  )
from public, anon, authenticated;

grant execute on function
  editorial.source_snapshot_fingerprint(
    text,
    text,
    text,
    text,
    text,
    uuid,
    text,
    date,
    date,
    date,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text
  )
to service_role;

create or replace function
  editorial.assert_source_version_pointer_integrity()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, editorial
as $function$
begin
  if new.current_working_version_id is not null
     and not exists (
       select 1
       from editorial.source_versions version
       where version.id = new.current_working_version_id
         and version.source_id = new.id
     )
  then
    raise exception
      'Current working Source version must belong to the same Source';
  end if;

  if new.current_submitted_version_id is not null
     and not exists (
       select 1
       from editorial.source_versions version
       where version.id = new.current_submitted_version_id
         and version.source_id = new.id
     )
  then
    raise exception
      'Current submitted Source version must belong to the same Source';
  end if;

  if new.current_approved_version_id is not null
     and not exists (
       select 1
       from editorial.source_versions version
       where version.id = new.current_approved_version_id
         and version.source_id = new.id
     )
  then
    raise exception
      'Current approved Source version must belong to the same Source';
  end if;

  if new.review_status in ('ready_for_review', 'in_review')
     and new.current_submitted_version_id is null
  then
    raise exception
      'Ready-for-review and in-review Sources require a submitted Source version';
  end if;

  if new.review_status = 'approved'
     and (
       new.current_approved_version_id is null
       or new.reviewed_by is null
       or new.reviewed_at is null
     )
  then
    raise exception
      'Approved Sources require an approved version, reviewer, and review time';
  end if;

  return new;
end;
$function$;

revoke all on function
  editorial.assert_source_version_pointer_integrity()
from public, anon, authenticated;

grant execute on function
  editorial.assert_source_version_pointer_integrity()
to service_role;

create constraint trigger sources_version_pointer_integrity
after insert or update of
  current_working_version_id,
  current_submitted_version_id,
  current_approved_version_id,
  review_status,
  reviewed_by,
  reviewed_at
on editorial.sources
deferrable initially deferred
for each row
execute function editorial.assert_source_version_pointer_integrity();

create or replace function editorial.protect_source_version()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
begin
  raise exception 'Source versions are immutable';
end;
$function$;

revoke all on function
  editorial.protect_source_version()
from public, anon, authenticated;

grant execute on function
  editorial.protect_source_version()
to service_role;

create trigger source_versions_immutable
before update or delete
on editorial.source_versions
for each row
execute function editorial.protect_source_version();

create table editorial.source_review_events (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null,
  source_version_id uuid,
  actor_id uuid,
  action text not null,
  reason text,
  prior_review_status text,
  resulting_review_status text,
  prior_exposure_class text,
  resulting_exposure_class text,
  prior_source_state text,
  resulting_source_state text,
  correlation_id uuid,
  created_at timestamptz not null default now(),

  constraint source_review_events_source_id_fkey
    foreign key (source_id)
    references editorial.sources(id)
    on delete restrict,

  constraint source_review_events_source_version_id_fkey
    foreign key (source_version_id)
    references editorial.source_versions(id)
    on delete restrict,

  constraint source_review_events_action_check
    check (
      action in (
        'created',
        'version_saved',
        'review_started',
        'changes_requested',
        'approved',
        'rejected',
        'withdrawn',
        'archived',
        'restored'
      )
    ),

  constraint source_review_events_reason_check
    check (
      action not in (
        'changes_requested',
        'rejected',
        'withdrawn',
        'archived',
        'restored'
      )
      or nullif(btrim(reason), '') is not null
    )
);

create index source_review_events_source_created_idx
on editorial.source_review_events (
  source_id,
  created_at desc,
  id desc
);

create index source_review_events_version_idx
on editorial.source_review_events (source_version_id)
where source_version_id is not null;

create or replace function editorial.protect_source_review_event()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
begin
  raise exception 'Source review events are append-only';
end;
$function$;

revoke all on function
  editorial.protect_source_review_event()
from public, anon, authenticated;

grant execute on function
  editorial.protect_source_review_event()
to service_role;

create trigger source_review_events_append_only
before update or delete
on editorial.source_review_events
for each row
execute function editorial.protect_source_review_event();

create table editorial.external_contributors (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  public_role text,
  public_url text,
  location_text text,
  contact_email text,
  contact_phone text,
  consent_status text not null default 'unknown',
  public_safe boolean not null default false,
  contributor_state text not null default 'active',
  internal_notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint external_contributors_created_by_fkey
    foreign key (created_by)
    references auth.users(id)
    on delete set null,

  constraint external_contributors_updated_by_fkey
    foreign key (updated_by)
    references auth.users(id)
    on delete set null,

  constraint external_contributors_display_name_check
    check (nullif(btrim(display_name), '') is not null),

  constraint external_contributors_state_check
    check (
      contributor_state in (
        'active',
        'withdrawn',
        'archived'
      )
    ),

  constraint external_contributors_consent_status_check
    check (
      consent_status in (
        'unknown',
        'not_required',
        'requested',
        'granted',
        'limited',
        'declined',
        'withdrawn'
      )
    ),

  constraint external_contributors_public_safe_check
    check (
      not public_safe
      or (
        contributor_state = 'active'
        and consent_status in ('granted', 'not_required')
      )
    )
);

create index external_contributors_state_name_idx
on editorial.external_contributors (
  contributor_state,
  display_name
);

create table editorial.credits (
  id uuid primary key default gen_random_uuid(),
  credit_role text not null,
  user_id uuid,
  registry_author_id uuid,
  external_contributor_id uuid,
  display_name_snapshot text not null,
  role_label_snapshot text,
  credit_note text,
  created_by uuid,
  created_at timestamptz not null default now(),

  constraint credits_credit_role_fkey
    foreign key (credit_role)
    references editorial.credit_roles(credit_role)
    on update cascade
    on delete restrict,

  constraint credits_user_id_fkey
    foreign key (user_id)
    references auth.users(id)
    on delete restrict,

  constraint credits_registry_author_id_fkey
    foreign key (registry_author_id)
    references public.registry_authors(id)
    on delete restrict,

  constraint credits_external_contributor_id_fkey
    foreign key (external_contributor_id)
    references editorial.external_contributors(id)
    on delete restrict,

  constraint credits_exactly_one_party_check
    check (
      num_nonnulls(
        user_id,
        registry_author_id,
        external_contributor_id
      ) = 1
    ),

  constraint credits_display_name_snapshot_check
    check (
      nullif(btrim(display_name_snapshot), '') is not null
    )
);

create index credits_role_created_idx
on editorial.credits (
  credit_role,
  created_at desc
);

create index credits_user_id_idx
on editorial.credits (user_id)
where user_id is not null;

create index credits_registry_author_id_idx
on editorial.credits (registry_author_id)
where registry_author_id is not null;

create index credits_external_contributor_id_idx
on editorial.credits (external_contributor_id)
where external_contributor_id is not null;


create table editorial.credit_governance (
  credit_id uuid primary key,
  public_safe boolean not null default false,
  credit_state text not null default 'active',
  governance_revision bigint not null default 1,
  reason text,
  updated_by uuid,
  updated_at timestamptz not null default now(),

  constraint credit_governance_credit_id_fkey
    foreign key (credit_id)
    references editorial.credits(id)
    on delete restrict,

  constraint credit_governance_updated_by_fkey
    foreign key (updated_by)
    references auth.users(id)
    on delete set null,

  constraint credit_governance_state_check
    check (
      credit_state in (
        'active',
        'withdrawn',
        'archived'
      )
    ),

  constraint credit_governance_revision_check
    check (governance_revision >= 1),

  constraint credit_governance_public_safe_check
    check (
      not public_safe
      or credit_state = 'active'
    ),

  constraint credit_governance_reason_check
    check (
      credit_state = 'active'
      or nullif(btrim(reason), '') is not null
    )
);

create index credit_governance_state_public_idx
on editorial.credit_governance (
  credit_state,
  public_safe,
  updated_at desc
);

create or replace function editorial.assert_credit_governance_integrity()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, editorial
as $function$
declare
  v_external_contributor_id uuid;
begin
  select credit.external_contributor_id
  into v_external_contributor_id
  from editorial.credits credit
  where credit.id = new.credit_id;

  if not found then
    raise exception 'Credit not found';
  end if;

  if new.public_safe
     and v_external_contributor_id is not null
     and not exists (
       select 1
       from editorial.external_contributors contributor
       where contributor.id = v_external_contributor_id
         and contributor.contributor_state = 'active'
         and contributor.public_safe
         and contributor.consent_status in (
           'granted',
           'not_required'
         )
     )
  then
    raise exception
      'Public-safe external-contributor Credits require active public-safe consent';
  end if;

  return new;
end;
$function$;

revoke all on function
  editorial.assert_credit_governance_integrity()
from public, anon, authenticated;

grant execute on function
  editorial.assert_credit_governance_integrity()
to service_role;

create trigger credit_governance_integrity
before insert or update
on editorial.credit_governance
for each row
execute function editorial.assert_credit_governance_integrity();

create or replace function editorial.protect_credit()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
begin
  raise exception 'Credits are immutable';
end;
$function$;

revoke all on function
  editorial.protect_credit()
from public, anon, authenticated;

grant execute on function
  editorial.protect_credit()
to service_role;

create trigger credits_immutable
before update or delete
on editorial.credits
for each row
execute function editorial.protect_credit();

alter table editorial.source_types
  enable row level security;

alter table editorial.citation_locator_types
  enable row level security;

alter table editorial.credit_roles
  enable row level security;

alter table editorial.sources
  enable row level security;

alter table editorial.source_versions
  enable row level security;

alter table editorial.source_review_events
  enable row level security;

alter table editorial.external_contributors
  enable row level security;

alter table editorial.credits
  enable row level security;

alter table editorial.credit_governance
  enable row level security;

create policy source_types_authenticated_read
on editorial.source_types
for select
to authenticated
using (auth.uid() is not null);

create policy citation_locator_types_authenticated_read
on editorial.citation_locator_types
for select
to authenticated
using (auth.uid() is not null);

create policy credit_roles_authenticated_read
on editorial.credit_roles
for select
to authenticated
using (auth.uid() is not null);

create policy sources_authorized_read
on editorial.sources
for select
to authenticated
using (
  public.current_user_is_administrator()
  or public.current_user_has_capability('view_trust_records')
  or public.current_user_has_capability('manage_sources')
  or public.current_user_has_capability('review_sources')
  or public.current_user_has_capability('withdraw_sources')
);

create policy source_versions_authorized_read
on editorial.source_versions
for select
to authenticated
using (
  public.current_user_is_administrator()
  or public.current_user_has_capability('view_trust_records')
  or public.current_user_has_capability('manage_sources')
  or public.current_user_has_capability('review_sources')
  or public.current_user_has_capability('withdraw_sources')
);

create policy source_review_events_authorized_read
on editorial.source_review_events
for select
to authenticated
using (
  public.current_user_is_administrator()
  or public.current_user_has_capability('view_trust_records')
  or public.current_user_has_capability('manage_sources')
  or public.current_user_has_capability('review_sources')
  or public.current_user_has_capability('withdraw_sources')
);

create policy external_contributors_authorized_read
on editorial.external_contributors
for select
to authenticated
using (
  public.current_user_is_administrator()
  or public.current_user_has_capability('view_trust_records')
  or public.current_user_has_capability('manage_credits')
);

create policy credits_authorized_read
on editorial.credits
for select
to authenticated
using (
  public.current_user_is_administrator()
  or public.current_user_has_capability('view_trust_records')
  or public.current_user_has_capability('manage_credits')
);

create policy credit_governance_authorized_read
on editorial.credit_governance
for select
to authenticated
using (
  public.current_user_is_administrator()
  or public.current_user_has_capability('view_trust_records')
  or public.current_user_has_capability('manage_credits')
);

revoke all
on editorial.source_types,
   editorial.citation_locator_types,
   editorial.credit_roles,
   editorial.sources,
   editorial.source_versions,
   editorial.source_review_events,
   editorial.external_contributors,
   editorial.credits,
   editorial.credit_governance
from public, anon, authenticated;

grant select
on editorial.source_types,
   editorial.citation_locator_types,
   editorial.credit_roles,
   editorial.sources,
   editorial.source_versions,
   editorial.source_review_events,
   editorial.external_contributors,
   editorial.credits,
   editorial.credit_governance
to authenticated;

grant all
on editorial.source_types,
   editorial.citation_locator_types,
   editorial.credit_roles,
   editorial.sources,
   editorial.source_versions,
   editorial.source_review_events,
   editorial.external_contributors,
   editorial.credits,
   editorial.credit_governance
to service_role;

comment on table editorial.sources is
  'Reusable Source identity and mutable Source trust workflow authority.';

comment on table editorial.source_versions is
  'Immutable Source metadata snapshots used by Citations and historical trust records.';

comment on table editorial.source_review_events is
  'Append-only Source review, withdrawal, restoration, and archival history.';

comment on table editorial.external_contributors is
  'Named creditable people outside authenticated-user and Registry-author identity.';

comment on table editorial.credits is
  'Immutable typed contribution identity with one explicit credited-party authority.';

comment on table editorial.credit_governance is
  'Mutable lifecycle and public-safety authority for one immutable Credit.';

commit;
