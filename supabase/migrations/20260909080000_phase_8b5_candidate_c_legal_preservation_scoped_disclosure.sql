-- Phase 8B.5 Candidate C: Legal preservation and scoped disclosure.
--
-- This migration adds a narrow Legal peer authority inside Messages. It reuses
-- canonical Message, Media, Resource Version, command/job/outbox, and Super
-- Admin authority. It does not create a generic export path or another queue.

begin;

-- ---------------------------------------------------------------------------
-- Preconditions.
-- ---------------------------------------------------------------------------

do $wk$
begin
  if to_regclass('messaging.messages') is null
     or to_regclass('messaging.message_resource_references') is null
     or to_regclass('messaging.conversations') is null
     or to_regclass('media.file_objects') is null
     or to_regclass('media.assets') is null
     or to_regclass('media.asset_revisions') is null
     or to_regclass('media.asset_governance_versions') is null
     or to_regclass('media.variants') is null
     or to_regclass('media.usage_links') is null
     or to_regclass('editorial.resource_versions') is null
     or to_regclass('platform_private.command_receipts') is null
     or to_regclass('platform_private.jobs') is null
     or to_regclass('platform_private.outbox_events') is null
     or to_regprocedure('messaging.current_messages_super_admin()') is null
     or to_regprocedure('messaging.command_correlation(uuid,text,text,uuid)') is null
     or to_regprocedure('platform_private.begin_authenticated_resource_command(text,uuid,text,jsonb)') is null
     or to_regprocedure('platform_private.complete_resource_command(uuid,jsonb)') is null
     or to_regprocedure('platform_private.complete_job(uuid,text,jsonb)') is null
     or to_regprocedure('platform_private.fail_job(uuid,text,text,boolean,integer)') is null
     or to_regprocedure('public.create_media_asset(text,text,text,uuid,uuid)') is null
     or to_regprocedure('public.create_media_asset_revision(uuid,bigint,uuid,text,uuid)') is null
     or to_regprocedure('public.create_media_governance_version(uuid,bigint,jsonb,text,uuid)') is null
     or to_regprocedure('public.current_user_has_capability(text)') is null
  then
    raise exception 'STOP: Candidate C requires accepted Messages, Media, Resource Version, command/job/outbox, and Super Admin authority.';
  end if;
end
$wk$;

-- ---------------------------------------------------------------------------
-- Controlled Media purpose for generated disclosure artifacts.
-- ---------------------------------------------------------------------------

insert into media.asset_purposes(
  asset_purpose,
  label,
  description,
  enabled,
  sort_order
)
values (
  'legal_disclosure',
  'Legal disclosure',
  'Restricted generated Legal disclosure package. Legal owns production authority; Media owns immutable bytes.',
  true,
  980
)
on conflict (asset_purpose) do update
set label=excluded.label,
    description=excluded.description,
    enabled=true;

-- ---------------------------------------------------------------------------
-- Narrow Legal capabilities. Initial assignment remains Super Admin only.
-- ---------------------------------------------------------------------------

insert into public.capability_definitions(
  capability_key,
  label,
  description,
  domain
)
values
  (
    'view_messages_legal_cases',
    'View Messages Legal cases',
    'View safe Legal Request Case metadata in the Super Admin Messages control center.',
    'messages'
  ),
  (
    'inspect_messages_legal_evidence',
    'Inspect Messages Legal evidence',
    'Deliberately inspect exact case-bound private evidence and released Legal package delivery.',
    'messages'
  ),
  (
    'manage_messages_legal_cases',
    'Manage Messages Legal cases',
    'Manage Legal Request Cases, preservation scopes, exact holds, and response classifications.',
    'messages'
  ),
  (
    'approve_messages_legal_disclosure',
    'Approve Messages Legal disclosure',
    'Approve, generate, release, or void exact scoped Legal disclosure packages.',
    'messages'
  )
on conflict (capability_key) do update
set label=excluded.label,
    description=excluded.description,
    domain=excluded.domain,
    updated_at=now();

insert into public.role_capabilities(role_key,capability_key)
values
  ('super_admin','view_messages_legal_cases'),
  ('super_admin','inspect_messages_legal_evidence'),
  ('super_admin','manage_messages_legal_cases'),
  ('super_admin','approve_messages_legal_disclosure')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Command registrations.
-- ---------------------------------------------------------------------------

insert into platform_private.command_types(
  command_type,
  job_type,
  accepted_event_type,
  success_event_type,
  failure_event_type,
  retry_event_type,
  enabled
)
values
  ('messages.legal.case.open','messages.legal.case.open.sync','messages.legal.case.open.accepted','messages.legal.case.open.succeeded','messages.legal.case.open.failed','messages.legal.case.open.retry_scheduled',true),
  ('messages.legal.review.start','messages.legal.review.start.sync','messages.legal.review.start.accepted','messages.legal.review.start.succeeded','messages.legal.review.start.failed','messages.legal.review.start.retry_scheduled',true),
  ('messages.legal.scope.update','messages.legal.scope.update.sync','messages.legal.scope.update.accepted','messages.legal.scope.update.succeeded','messages.legal.scope.update.failed','messages.legal.scope.update.retry_scheduled',true),
  ('messages.legal.preservation.materialize','messages.legal.preservation.materialize.sync','messages.legal.preservation.materialize.accepted','messages.legal.preservation.materialize.succeeded','messages.legal.preservation.materialize.failed','messages.legal.preservation.materialize.retry_scheduled',true),
  ('messages.legal.preservation.release','messages.legal.preservation.release.sync','messages.legal.preservation.release.accepted','messages.legal.preservation.release.succeeded','messages.legal.preservation.release.failed','messages.legal.preservation.release.retry_scheduled',true),
  ('messages.legal.classification.update','messages.legal.classification.update.sync','messages.legal.classification.update.accepted','messages.legal.classification.update.succeeded','messages.legal.classification.update.failed','messages.legal.classification.update.retry_scheduled',true),
  ('messages.legal.evidence.inspect','messages.legal.evidence.inspect.sync','messages.legal.evidence.inspect.accepted','messages.legal.evidence.inspect.succeeded','messages.legal.evidence.inspect.failed','messages.legal.evidence.inspect.retry_scheduled',true),
  ('messages.legal.disclosure.prepare','messages.legal.disclosure.prepare.sync','messages.legal.disclosure.prepare.accepted','messages.legal.disclosure.prepare.succeeded','messages.legal.disclosure.prepare.failed','messages.legal.disclosure.prepare.retry_scheduled',true),
  ('messages.legal.disclosure.approval.update','messages.legal.disclosure.approval.update.sync','messages.legal.disclosure.approval.update.accepted','messages.legal.disclosure.approval.update.succeeded','messages.legal.disclosure.approval.update.failed','messages.legal.disclosure.approval.update.retry_scheduled',true),
  ('messages.legal.disclosure.generate','messages.legal.disclosure.generate','messages.legal.disclosure.generate.accepted','messages.legal.disclosure.generate.succeeded','messages.legal.disclosure.generate.failed','messages.legal.disclosure.generate.retry_scheduled',true),
  ('messages.legal.disclosure.release','messages.legal.disclosure.release.sync','messages.legal.disclosure.release.accepted','messages.legal.disclosure.release.succeeded','messages.legal.disclosure.release.failed','messages.legal.disclosure.release.retry_scheduled',true),
  ('messages.legal.disclosure.void','messages.legal.disclosure.void.sync','messages.legal.disclosure.void.accepted','messages.legal.disclosure.void.succeeded','messages.legal.disclosure.void.failed','messages.legal.disclosure.void.retry_scheduled',true),
  ('messages.legal.case.close','messages.legal.case.close.sync','messages.legal.case.close.accepted','messages.legal.case.close.succeeded','messages.legal.case.close.failed','messages.legal.case.close.retry_scheduled',true)
on conflict (command_type) do update
set job_type=excluded.job_type,
    accepted_event_type=excluded.accepted_event_type,
    success_event_type=excluded.success_event_type,
    failure_event_type=excluded.failure_event_type,
    retry_event_type=excluded.retry_event_type,
    enabled=true;

-- ---------------------------------------------------------------------------
-- Legal Request Case.
-- ---------------------------------------------------------------------------

create table messaging.legal_request_cases (
  id uuid primary key default gen_random_uuid(),
  request_reference text not null,
  request_kind text not null,
  status text not null default 'open',
  requesting_authority text not null,
  jurisdiction_or_process text not null,
  received_at timestamptz not null,
  scope_statement text not null,
  notice_restriction_state text not null default 'unknown',
  assigned_user_id uuid references auth.users(id) on update restrict on delete set null,
  opened_by_user_id uuid references auth.users(id) on update restrict on delete set null,
  opened_at timestamptz not null default now(),
  closed_by_user_id uuid references auth.users(id) on update restrict on delete set null,
  closed_at timestamptz,
  closure_note text,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legal_request_cases_request_kind_check
    check (request_kind in ('preservation','disclosure','emergency','other')),
  constraint legal_request_cases_status_check
    check (status in ('open','under_review','closed')),
  constraint legal_request_cases_notice_check
    check (notice_restriction_state in ('none','restricted','unknown')),
  constraint legal_request_cases_text_check
    check (
      nullif(btrim(request_reference),'') is not null
      and octet_length(request_reference)<=240
      and nullif(btrim(requesting_authority),'') is not null
      and octet_length(requesting_authority)<=500
      and nullif(btrim(jurisdiction_or_process),'') is not null
      and octet_length(jurisdiction_or_process)<=500
      and nullif(btrim(scope_statement),'') is not null
      and octet_length(scope_statement)<=8192
      and (closure_note is null or octet_length(closure_note)<=8192)
    ),
  constraint legal_request_cases_revision_check check (revision>=1),
  constraint legal_request_cases_close_shape_check
    check (
      (status<>'closed' and closed_at is null and closed_by_user_id is null and closure_note is null)
      or
      (status='closed' and closed_at is not null and nullif(btrim(closure_note),'') is not null)
    )
);

create index legal_request_cases_status_received_idx
  on messaging.legal_request_cases(status,received_at desc);
create index legal_request_cases_assigned_status_idx
  on messaging.legal_request_cases(assigned_user_id,status,received_at desc)
  where assigned_user_id is not null;
create index legal_request_cases_reference_idx
  on messaging.legal_request_cases(lower(requesting_authority),lower(request_reference));

-- ---------------------------------------------------------------------------
-- Preservation scope.
-- ---------------------------------------------------------------------------

create table messaging.legal_preservation_scopes (
  id uuid primary key default gen_random_uuid(),
  legal_request_case_id uuid not null
    references messaging.legal_request_cases(id) on update restrict on delete restrict,
  scope_kind text not null,
  status text not null default 'active',
  message_id uuid references messaging.messages(id) on update restrict on delete restrict,
  conversation_id uuid references messaging.conversations(id) on update restrict on delete restrict,
  accepted_from timestamptz,
  accepted_until timestamptz,
  media_file_object_id uuid references media.file_objects(id) on update restrict on delete restrict,
  resource_version_id uuid references editorial.resource_versions(id) on update restrict on delete restrict,
  scope_note text,
  created_by_user_id uuid references auth.users(id) on update restrict on delete set null,
  created_at timestamptz not null default now(),
  released_by_user_id uuid references auth.users(id) on update restrict on delete set null,
  released_at timestamptz,
  release_reason text,
  revision bigint not null default 1,
  constraint legal_preservation_scopes_kind_check
    check (scope_kind in ('exact_message','conversation_window','exact_media_file','exact_resource_version')),
  constraint legal_preservation_scopes_status_check
    check (status in ('active','released')),
  constraint legal_preservation_scopes_shape_check
    check (
      (
        scope_kind='exact_message'
        and message_id is not null
        and conversation_id is null
        and accepted_from is null
        and accepted_until is null
        and media_file_object_id is null
        and resource_version_id is null
      )
      or (
        scope_kind='conversation_window'
        and message_id is null
        and conversation_id is not null
        and accepted_from is not null
        and accepted_until is not null
        and accepted_from<accepted_until
        and media_file_object_id is null
        and resource_version_id is null
      )
      or (
        scope_kind='exact_media_file'
        and message_id is null
        and conversation_id is null
        and accepted_from is null
        and accepted_until is null
        and media_file_object_id is not null
        and resource_version_id is null
      )
      or (
        scope_kind='exact_resource_version'
        and message_id is null
        and conversation_id is null
        and accepted_from is null
        and accepted_until is null
        and media_file_object_id is null
        and resource_version_id is not null
      )
    ),
  constraint legal_preservation_scopes_note_check
    check (scope_note is null or octet_length(scope_note)<=4096),
  constraint legal_preservation_scopes_release_check
    check (
      (status='active' and released_at is null and released_by_user_id is null and release_reason is null)
      or
      (status='released' and released_at is not null and nullif(btrim(release_reason),'') is not null and octet_length(release_reason)<=8192)
    ),
  constraint legal_preservation_scopes_revision_check check (revision>=1)
);

create index legal_preservation_scopes_case_status_idx
  on messaging.legal_preservation_scopes(legal_request_case_id,status,created_at);
create index legal_preservation_scopes_conversation_window_idx
  on messaging.legal_preservation_scopes(conversation_id,accepted_from,accepted_until)
  where scope_kind='conversation_window' and status='active';

-- ---------------------------------------------------------------------------
-- Exact held objects.
-- ---------------------------------------------------------------------------

create table messaging.legal_preserved_objects (
  id uuid primary key default gen_random_uuid(),
  legal_request_case_id uuid not null
    references messaging.legal_request_cases(id) on update restrict on delete restrict,
  materialized_from_scope_id uuid not null
    references messaging.legal_preservation_scopes(id) on update restrict on delete restrict,
  object_kind text not null,
  message_id uuid references messaging.messages(id) on update restrict on delete restrict,
  media_file_object_id uuid references media.file_objects(id) on update restrict on delete restrict,
  resource_version_id uuid references editorial.resource_versions(id) on update restrict on delete restrict,
  preservation_status text not null default 'held',
  response_classification text not null default 'unclassified',
  classification_reason text,
  preserved_by_user_id uuid references auth.users(id) on update restrict on delete set null,
  preserved_at timestamptz not null default now(),
  classified_by_user_id uuid references auth.users(id) on update restrict on delete set null,
  classified_at timestamptz,
  released_by_user_id uuid references auth.users(id) on update restrict on delete set null,
  released_at timestamptz,
  release_reason text,
  revision bigint not null default 1,
  constraint legal_preserved_objects_kind_check
    check (object_kind in ('message','media_file','resource_version')),
  constraint legal_preserved_objects_shape_check
    check (
      (object_kind='message' and message_id is not null and media_file_object_id is null and resource_version_id is null)
      or
      (object_kind='media_file' and message_id is null and media_file_object_id is not null and resource_version_id is null)
      or
      (object_kind='resource_version' and message_id is null and media_file_object_id is null and resource_version_id is not null)
    ),
  constraint legal_preserved_objects_status_check check (preservation_status in ('held','released')),
  constraint legal_preserved_objects_classification_check
    check (response_classification in ('unclassified','responsive','elevated_review','excluded')),
  constraint legal_preserved_objects_classification_shape_check
    check (
      (response_classification='unclassified' and classification_reason is null and classified_at is null and classified_by_user_id is null)
      or
      (response_classification<>'unclassified' and nullif(btrim(classification_reason),'') is not null and octet_length(classification_reason)<=8192 and classified_at is not null)
    ),
  constraint legal_preserved_objects_release_check
    check (
      (preservation_status='held' and released_at is null and released_by_user_id is null and release_reason is null)
      or
      (preservation_status='released' and released_at is not null and nullif(btrim(release_reason),'') is not null and octet_length(release_reason)<=8192)
    ),
  constraint legal_preserved_objects_revision_check check (revision>=1)
);

create unique index legal_preserved_objects_case_message_key
  on messaging.legal_preserved_objects(legal_request_case_id,message_id)
  where message_id is not null;
create unique index legal_preserved_objects_case_media_key
  on messaging.legal_preserved_objects(legal_request_case_id,media_file_object_id)
  where media_file_object_id is not null;
create unique index legal_preserved_objects_case_resource_version_key
  on messaging.legal_preserved_objects(legal_request_case_id,resource_version_id)
  where resource_version_id is not null;
create index legal_preserved_objects_case_status_idx
  on messaging.legal_preserved_objects(legal_request_case_id,preservation_status,response_classification,preserved_at);

-- ---------------------------------------------------------------------------
-- Disclosure package.
-- ---------------------------------------------------------------------------

create table messaging.legal_disclosure_packages (
  id uuid primary key default gen_random_uuid(),
  legal_request_case_id uuid not null
    references messaging.legal_request_cases(id) on update restrict on delete restrict,
  production_reference text not null,
  status text not null default 'draft',
  scope_statement text not null,
  documented_omissions text[] not null default '{}'::text[],
  selection_fingerprint text not null,
  manifest_version text not null default 'wk-legal-disclosure-manifest-v1',
  archive_version text not null default 'wk-legal-disclosure-zip-v1',
  requested_by_user_id uuid references auth.users(id) on update restrict on delete set null,
  requested_at timestamptz not null default now(),
  generation_job_id uuid references platform_private.jobs(id) on update restrict on delete restrict,
  generated_at timestamptz,
  manifest_text text,
  manifest_sha256 text,
  package_asset_id uuid references media.assets(id) on update restrict on delete restrict,
  package_asset_revision_id uuid references media.asset_revisions(id) on update restrict on delete restrict,
  package_file_object_id uuid references media.file_objects(id) on update restrict on delete restrict,
  package_sha256 text,
  package_byte_size bigint,
  released_by_user_id uuid references auth.users(id) on update restrict on delete set null,
  released_at timestamptz,
  voided_by_user_id uuid references auth.users(id) on update restrict on delete set null,
  voided_at timestamptz,
  void_reason text,
  failure_summary text,
  revision bigint not null default 1,
  constraint legal_disclosure_packages_reference_unique
    unique (legal_request_case_id,production_reference),
  constraint legal_disclosure_packages_status_check
    check (status in ('draft','approved','queued','generating','generated','released','failed','voided')),
  constraint legal_disclosure_packages_text_check
    check (
      nullif(btrim(production_reference),'') is not null
      and octet_length(production_reference)<=240
      and nullif(btrim(scope_statement),'') is not null
      and octet_length(scope_statement)<=8192
      and selection_fingerprint ~ '^[0-9a-f]{64}$'
      and manifest_version='wk-legal-disclosure-manifest-v1'
      and archive_version='wk-legal-disclosure-zip-v1'
      and (failure_summary is null or octet_length(failure_summary)<=8192)
      and (void_reason is null or octet_length(void_reason)<=8192)
    ),
  constraint legal_disclosure_packages_hash_check
    check (
      (manifest_sha256 is null or manifest_sha256 ~ '^[0-9a-f]{64}$')
      and (package_sha256 is null or package_sha256 ~ '^[0-9a-f]{64}$')
      and (package_byte_size is null or package_byte_size>=0)
    ),
  constraint legal_disclosure_packages_generated_shape_check
    check (
      status not in ('generated','released')
      or (
        generated_at is not null
        and manifest_text is not null
        and manifest_sha256 is not null
        and package_asset_id is not null
        and package_asset_revision_id is not null
        and package_file_object_id is not null
        and package_sha256 is not null
        and package_byte_size is not null
      )
    ),
  constraint legal_disclosure_packages_release_shape_check
    check ((status<>'released' and released_at is null) or (status='released' and released_at is not null)),
  constraint legal_disclosure_packages_void_shape_check
    check ((status<>'voided' and voided_at is null) or (status='voided' and voided_at is not null and nullif(btrim(void_reason),'') is not null)),
  constraint legal_disclosure_packages_revision_check check (revision>=1)
);

create index legal_disclosure_packages_case_status_idx
  on messaging.legal_disclosure_packages(legal_request_case_id,status,requested_at desc);
create unique index legal_disclosure_packages_job_key
  on messaging.legal_disclosure_packages(generation_job_id)
  where generation_job_id is not null;
create unique index legal_disclosure_packages_file_key
  on messaging.legal_disclosure_packages(package_file_object_id)
  where package_file_object_id is not null;

-- ---------------------------------------------------------------------------
-- Explicit disclosure approvals.
-- ---------------------------------------------------------------------------

create table messaging.legal_disclosure_approvals (
  id uuid primary key default gen_random_uuid(),
  legal_disclosure_package_id uuid not null
    references messaging.legal_disclosure_packages(id) on update restrict on delete restrict,
  legal_preserved_object_id uuid
    references messaging.legal_preserved_objects(id) on update restrict on delete restrict,
  approval_scope text not null,
  status text not null default 'active',
  selection_fingerprint text not null,
  approval_reason text not null,
  approved_by_user_id uuid references auth.users(id) on update restrict on delete set null,
  approved_at timestamptz not null default now(),
  revoked_by_user_id uuid references auth.users(id) on update restrict on delete set null,
  revoked_at timestamptz,
  revocation_reason text,
  revision bigint not null default 1,
  constraint legal_disclosure_approvals_scope_check
    check (approval_scope in ('package','elevated_object')),
  constraint legal_disclosure_approvals_status_check
    check (status in ('active','revoked')),
  constraint legal_disclosure_approvals_shape_check
    check (
      (approval_scope='package' and legal_preserved_object_id is null)
      or
      (approval_scope='elevated_object' and legal_preserved_object_id is not null)
    ),
  constraint legal_disclosure_approvals_fingerprint_check
    check (selection_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint legal_disclosure_approvals_reason_check
    check (nullif(btrim(approval_reason),'') is not null and octet_length(approval_reason)<=8192),
  constraint legal_disclosure_approvals_revoke_check
    check (
      (status='active' and revoked_at is null and revoked_by_user_id is null and revocation_reason is null)
      or
      (status='revoked' and revoked_at is not null and nullif(btrim(revocation_reason),'') is not null and octet_length(revocation_reason)<=8192)
    ),
  constraint legal_disclosure_approvals_revision_check check (revision>=1)
);

create unique index legal_disclosure_approvals_active_package_key
  on messaging.legal_disclosure_approvals(legal_disclosure_package_id)
  where approval_scope='package' and status='active';
create unique index legal_disclosure_approvals_active_elevated_key
  on messaging.legal_disclosure_approvals(legal_disclosure_package_id,legal_preserved_object_id)
  where approval_scope='elevated_object' and status='active';

-- ---------------------------------------------------------------------------
-- Exact package selection and immutable finalized manifest entries.
-- ---------------------------------------------------------------------------

create table messaging.legal_disclosure_objects (
  id uuid primary key default gen_random_uuid(),
  legal_disclosure_package_id uuid not null
    references messaging.legal_disclosure_packages(id) on update restrict on delete restrict,
  legal_preserved_object_id uuid not null
    references messaging.legal_preserved_objects(id) on update restrict on delete restrict,
  manifest_order integer not null,
  object_kind text not null,
  response_classification text not null,
  source_object_id uuid not null,
  source_fingerprint text,
  output_path text,
  output_mime_type text,
  object_sha256 text,
  object_byte_size bigint,
  created_at timestamptz not null default now(),
  finalized_at timestamptz,
  constraint legal_disclosure_objects_package_order_unique
    unique (legal_disclosure_package_id,manifest_order),
  constraint legal_disclosure_objects_package_object_unique
    unique (legal_disclosure_package_id,legal_preserved_object_id),
  constraint legal_disclosure_objects_order_check check (manifest_order>=1),
  constraint legal_disclosure_objects_kind_check check (object_kind in ('message','media_file','resource_version')),
  constraint legal_disclosure_objects_classification_check check (response_classification in ('responsive','elevated_review')),
  constraint legal_disclosure_objects_source_fingerprint_check
    check (source_fingerprint is null or source_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint legal_disclosure_objects_final_shape_check
    check (
      (
        finalized_at is null
        and output_path is null
        and output_mime_type is null
        and object_sha256 is null
        and object_byte_size is null
      )
      or (
        finalized_at is not null
        and nullif(btrim(output_path),'') is not null
        and octet_length(output_path)<=500
        and nullif(btrim(output_mime_type),'') is not null
        and octet_length(output_mime_type)<=200
        and object_sha256 ~ '^[0-9a-f]{64}$'
        and object_byte_size>=0
      )
    )
);

create index legal_disclosure_objects_package_order_idx
  on messaging.legal_disclosure_objects(legal_disclosure_package_id,manifest_order);

-- ---------------------------------------------------------------------------
-- Append-only Legal event history.
-- ---------------------------------------------------------------------------

create table messaging.legal_case_events (
  id uuid primary key default gen_random_uuid(),
  legal_request_case_id uuid not null
    references messaging.legal_request_cases(id) on update restrict on delete restrict,
  legal_disclosure_package_id uuid
    references messaging.legal_disclosure_packages(id) on update restrict on delete restrict,
  legal_preserved_object_id uuid
    references messaging.legal_preserved_objects(id) on update restrict on delete restrict,
  event_kind text not null,
  actor_kind text not null,
  actor_user_id uuid references auth.users(id) on update restrict on delete set null,
  actor_person_resource_id uuid,
  actor_key text,
  command_receipt_id uuid
    references platform_private.command_receipts(id) on update restrict on delete restrict,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint legal_case_events_kind_check
    check (event_kind in (
      'request_opened','review_started','scope_added','scope_released',
      'preservation_applied','preservation_released','classification_changed',
      'evidence_viewed','disclosure_prepared','approval_recorded','approval_revoked',
      'disclosure_queued','disclosure_generation_started','disclosure_generated',
      'disclosure_failed','disclosure_released','disclosure_voided','case_closed'
    )),
  constraint legal_case_events_actor_kind_check
    check (actor_kind in ('human','system','automation')),
  constraint legal_case_events_metadata_check
    check (jsonb_typeof(metadata)='object' and octet_length(metadata::text)<=16384)
);

create index legal_case_events_case_time_idx
  on messaging.legal_case_events(legal_request_case_id,occurred_at,id);
create index legal_case_events_package_time_idx
  on messaging.legal_case_events(legal_disclosure_package_id,occurred_at,id)
  where legal_disclosure_package_id is not null;

-- ---------------------------------------------------------------------------
-- RLS and direct-grant boundary.
-- ---------------------------------------------------------------------------

alter table messaging.legal_request_cases enable row level security;
alter table messaging.legal_preservation_scopes enable row level security;
alter table messaging.legal_preserved_objects enable row level security;
alter table messaging.legal_disclosure_packages enable row level security;
alter table messaging.legal_disclosure_approvals enable row level security;
alter table messaging.legal_disclosure_objects enable row level security;
alter table messaging.legal_case_events enable row level security;

revoke all on messaging.legal_request_cases from public,anon,authenticated,service_role;
revoke all on messaging.legal_preservation_scopes from public,anon,authenticated,service_role;
revoke all on messaging.legal_preserved_objects from public,anon,authenticated,service_role;
revoke all on messaging.legal_disclosure_packages from public,anon,authenticated,service_role;
revoke all on messaging.legal_disclosure_approvals from public,anon,authenticated,service_role;
revoke all on messaging.legal_disclosure_objects from public,anon,authenticated,service_role;
revoke all on messaging.legal_case_events from public,anon,authenticated,service_role;

-- ---------------------------------------------------------------------------
-- Immutability and no-delete guards.
-- ---------------------------------------------------------------------------

create or replace function messaging.reject_legal_history_delete()
returns trigger
language plpgsql
set search_path=pg_catalog
as $fn$
begin
  raise exception 'Candidate C Legal history cannot be deleted.';
end
$fn$;

create or replace function messaging.reject_legal_event_mutation()
returns trigger
language plpgsql
set search_path=pg_catalog
as $fn$
begin
  raise exception 'Candidate C Legal events are append-only.';
end
$fn$;

create trigger legal_request_cases_no_delete
before delete on messaging.legal_request_cases
for each row execute function messaging.reject_legal_history_delete();
create trigger legal_preservation_scopes_no_delete
before delete on messaging.legal_preservation_scopes
for each row execute function messaging.reject_legal_history_delete();
create trigger legal_preserved_objects_no_delete
before delete on messaging.legal_preserved_objects
for each row execute function messaging.reject_legal_history_delete();
create trigger legal_disclosure_packages_no_delete
before delete on messaging.legal_disclosure_packages
for each row execute function messaging.reject_legal_history_delete();
create trigger legal_disclosure_approvals_no_delete
before delete on messaging.legal_disclosure_approvals
for each row execute function messaging.reject_legal_history_delete();
create trigger legal_disclosure_objects_no_delete
before delete on messaging.legal_disclosure_objects
for each row execute function messaging.reject_legal_history_delete();
create trigger legal_case_events_immutable
before update or delete on messaging.legal_case_events
for each row execute function messaging.reject_legal_event_mutation();

create or replace function messaging.guard_legal_scope_identity()
returns trigger
language plpgsql
set search_path=pg_catalog
as $fn$
begin
  if new.legal_request_case_id is distinct from old.legal_request_case_id
     or new.scope_kind is distinct from old.scope_kind
     or new.message_id is distinct from old.message_id
     or new.conversation_id is distinct from old.conversation_id
     or new.accepted_from is distinct from old.accepted_from
     or new.accepted_until is distinct from old.accepted_until
     or new.media_file_object_id is distinct from old.media_file_object_id
     or new.resource_version_id is distinct from old.resource_version_id
     or new.created_by_user_id is distinct from old.created_by_user_id
     or new.created_at is distinct from old.created_at
  then
    raise exception 'Legal preservation scope identity is immutable.';
  end if;
  return new;
end
$fn$;

create trigger legal_preservation_scopes_identity_guard
before update on messaging.legal_preservation_scopes
for each row execute function messaging.guard_legal_scope_identity();

create or replace function messaging.guard_legal_preserved_object_identity()
returns trigger
language plpgsql
set search_path=pg_catalog
as $fn$
begin
  if new.legal_request_case_id is distinct from old.legal_request_case_id
     or new.materialized_from_scope_id is distinct from old.materialized_from_scope_id
     or new.object_kind is distinct from old.object_kind
     or new.message_id is distinct from old.message_id
     or new.media_file_object_id is distinct from old.media_file_object_id
     or new.resource_version_id is distinct from old.resource_version_id
     or new.preserved_by_user_id is distinct from old.preserved_by_user_id
     or new.preserved_at is distinct from old.preserved_at
  then
    raise exception 'Legal preserved object identity is immutable.';
  end if;
  return new;
end
$fn$;

create trigger legal_preserved_objects_identity_guard
before update on messaging.legal_preserved_objects
for each row execute function messaging.guard_legal_preserved_object_identity();

create or replace function messaging.guard_legal_disclosure_object_mutation()
returns trigger
language plpgsql
set search_path=pg_catalog
as $fn$
begin
  if old.finalized_at is not null then
    raise exception 'Finalized Legal disclosure objects are immutable.';
  end if;
  if new.legal_disclosure_package_id is distinct from old.legal_disclosure_package_id
     or new.legal_preserved_object_id is distinct from old.legal_preserved_object_id
     or new.manifest_order is distinct from old.manifest_order
     or new.object_kind is distinct from old.object_kind
     or new.response_classification is distinct from old.response_classification
     or new.source_object_id is distinct from old.source_object_id
     or new.source_fingerprint is distinct from old.source_fingerprint
     or new.created_at is distinct from old.created_at
  then
    raise exception 'Legal disclosure selection identity is immutable.';
  end if;
  return new;
end
$fn$;

create trigger legal_disclosure_objects_mutation_guard
before update on messaging.legal_disclosure_objects
for each row execute function messaging.guard_legal_disclosure_object_mutation();

create or replace function messaging.guard_generated_legal_package()
returns trigger
language plpgsql
set search_path=pg_catalog
as $fn$
begin
  if old.generated_at is not null then
    if new.legal_request_case_id is distinct from old.legal_request_case_id
       or new.production_reference is distinct from old.production_reference
       or new.scope_statement is distinct from old.scope_statement
       or new.documented_omissions is distinct from old.documented_omissions
       or new.selection_fingerprint is distinct from old.selection_fingerprint
       or new.manifest_version is distinct from old.manifest_version
       or new.archive_version is distinct from old.archive_version
       or new.requested_by_user_id is distinct from old.requested_by_user_id
       or new.requested_at is distinct from old.requested_at
       or new.generation_job_id is distinct from old.generation_job_id
       or new.generated_at is distinct from old.generated_at
       or new.manifest_text is distinct from old.manifest_text
       or new.manifest_sha256 is distinct from old.manifest_sha256
       or new.package_asset_id is distinct from old.package_asset_id
       or new.package_asset_revision_id is distinct from old.package_asset_revision_id
       or new.package_file_object_id is distinct from old.package_file_object_id
       or new.package_sha256 is distinct from old.package_sha256
       or new.package_byte_size is distinct from old.package_byte_size
    then
      raise exception 'Generated Legal package identity and bytes are immutable.';
    end if;
  end if;
  return new;
end
$fn$;

create trigger legal_disclosure_packages_generated_guard
before update on messaging.legal_disclosure_packages
for each row execute function messaging.guard_generated_legal_package();

-- ---------------------------------------------------------------------------
-- Deterministic Candidate C JSON helper.
-- ---------------------------------------------------------------------------

create or replace function messaging.legal_canonical_json_v1(p_value jsonb)
returns text
language plpgsql
immutable
set search_path=pg_catalog
as $fn$
declare
  v_type text;
  v_result text;
begin
  v_type:=jsonb_typeof(p_value);
  if v_type='object' then
    select '{' || coalesce(string_agg(to_jsonb(k)::text || ':' || messaging.legal_canonical_json_v1(p_value->k),',' order by k collate "C"),'') || '}'
      into v_result
    from jsonb_object_keys(p_value) k;
    return v_result;
  elsif v_type='array' then
    select '[' || coalesce(string_agg(messaging.legal_canonical_json_v1(e.value),',' order by e.ordinality),'') || ']'
      into v_result
    from jsonb_array_elements(p_value) with ordinality e(value,ordinality);
    return v_result;
  else
    return p_value::text;
  end if;
end
$fn$;

create or replace function messaging.legal_sha256_text_v1(p_text text)
returns text
language sql
immutable
set search_path=pg_catalog,extensions
as $fn$
  select encode(extensions.digest(convert_to(p_text,'UTF8'),'sha256'),'hex')
$fn$;

-- ---------------------------------------------------------------------------
-- Authorization and event helpers.
-- ---------------------------------------------------------------------------

create or replace function messaging.require_messages_legal_capability(p_capability text)
returns table(user_id uuid,person_resource_id uuid)
language plpgsql
stable
security definer
set search_path=pg_catalog,auth,public,editorial,messaging
as $fn$
declare
  v_admin record;
begin
  select * into v_admin from messaging.current_messages_super_admin();
  if p_capability not in (
    'view_messages_legal_cases',
    'inspect_messages_legal_evidence',
    'manage_messages_legal_cases',
    'approve_messages_legal_disclosure'
  ) or not public.current_user_has_capability(p_capability) then
    raise exception using errcode='42501',message='Messages Legal capability is required.';
  end if;
  return query select v_admin.user_id,v_admin.person_resource_id;
end
$fn$;

create or replace function messaging.append_legal_case_event_v1(
  p_case_id uuid,
  p_package_id uuid,
  p_preserved_object_id uuid,
  p_event_kind text,
  p_actor_user_id uuid,
  p_actor_person_resource_id uuid,
  p_actor_kind text,
  p_actor_key text,
  p_command_receipt_id uuid,
  p_metadata jsonb
)
returns uuid
language plpgsql
security definer
set search_path=pg_catalog,messaging
as $fn$
declare
  v_id uuid;
begin
  if p_metadata is null or jsonb_typeof(p_metadata)<>'object' or octet_length(p_metadata::text)>16384 then
    raise exception using errcode='22023',message='Legal event metadata is invalid.';
  end if;
  insert into messaging.legal_case_events(
    legal_request_case_id,legal_disclosure_package_id,legal_preserved_object_id,
    event_kind,actor_kind,actor_user_id,actor_person_resource_id,actor_key,
    command_receipt_id,metadata
  ) values (
    p_case_id,p_package_id,p_preserved_object_id,
    p_event_kind,p_actor_kind,p_actor_user_id,p_actor_person_resource_id,p_actor_key,
    p_command_receipt_id,p_metadata
  ) returning id into v_id;
  return v_id;
end
$fn$;

-- ---------------------------------------------------------------------------
-- Selection/output helpers.
-- ---------------------------------------------------------------------------

create or replace function messaging.legal_disclosure_output_path_v1(
  p_order integer,
  p_object_kind text,
  p_preserved_object_id uuid
)
returns text
language plpgsql
immutable
set search_path=pg_catalog
as $fn$
begin
  if p_order<1 or p_preserved_object_id is null or p_object_kind not in ('message','media_file','resource_version') then
    raise exception using errcode='22023',message='Invalid Legal disclosure output identity.';
  end if;
  return 'objects/' || lpad(p_order::text,6,'0') || '-' ||
    case p_object_kind
      when 'message' then 'message-'
      when 'media_file' then 'media-file-'
      else 'resource-version-'
    end || p_preserved_object_id::text ||
    case when p_object_kind='media_file' then '.bin' else '.json' end;
end
$fn$;

create or replace function messaging.legal_package_storage_path_v1(p_case_id uuid,p_package_id uuid)
returns text
language sql
immutable
set search_path=pg_catalog
as $fn$
  select 'private-files/legal-disclosures/' || p_case_id::text || '/' || p_package_id::text || '/production.zip'
$fn$;

-- ---------------------------------------------------------------------------
-- Candidate C generated Media boundary.
--
-- Legal owns package production identity and disclosure authority. Media owns
-- immutable bytes, but generic Media administration must not mint, mutate,
-- rebind, derive, or attach a Legal disclosure artifact.
-- ---------------------------------------------------------------------------

create or replace function messaging.guard_legal_disclosure_media_file_v1()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,auth,messaging,media
as $fn$
begin
  if new.storage_path is null
     or new.storage_path !~ '^private-files/legal-disclosures/'
  then
    return new;
  end if;

  if coalesce(auth.role(),'')<>'service_role'
     or new.storage_provider is distinct from 'lightsail_media'
     or new.storage_namespace is distinct from 'lightsail-media'
     or new.mime_type is distinct from 'application/zip'
     or new.verification_state is distinct from 'verified'
     or not exists(
       select 1
       from messaging.legal_disclosure_packages package
       where package.status='generating'
         and new.storage_path=messaging.legal_package_storage_path_v1(
           package.legal_request_case_id,
           package.id
         )
     )
  then
    raise exception using
      errcode='42501',
      message='Legal disclosure Media files may be registered only by active Candidate C generation authority.';
  end if;

  return new;
end
$fn$;

create trigger file_objects_legal_disclosure_guard
before insert on media.file_objects
for each row execute function messaging.guard_legal_disclosure_media_file_v1();

create or replace function messaging.guard_legal_disclosure_media_asset_v1()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,auth,messaging,media
as $fn$
declare
  v_package_status text;
begin
  if tg_op='INSERT' then
    if new.asset_purpose='legal_disclosure' then
      select package.status
      into v_package_status
      from messaging.legal_disclosure_packages package
      where package.id=new.id;

      if coalesce(auth.role(),'')<>'service_role'
         or v_package_status is distinct from 'generating'
         or new.asset_kind is distinct from 'document'
         or new.lifecycle_state is distinct from 'active'
         or new.current_revision_id is not null
         or new.current_governance_version_id is not null
         or new.authority_revision is distinct from 1
      then
        raise exception using
          errcode='42501',
          message='Legal disclosure Media assets may be created only by active Candidate C generation authority.';
      end if;
    end if;
    return new;
  end if;

  if tg_op='DELETE' then
    if old.asset_purpose='legal_disclosure' then
      raise exception using
        errcode='42501',
        message='Generated Legal disclosure Media assets are immutable.';
    end if;
    return old;
  end if;

  if old.asset_purpose='legal_disclosure'
     or new.asset_purpose='legal_disclosure'
  then
    if old.id is distinct from new.id
       or old.asset_purpose is distinct from 'legal_disclosure'
       or new.asset_purpose is distinct from 'legal_disclosure'
    then
      raise exception using
        errcode='42501',
        message='Legal disclosure Media identity cannot be reassigned.';
    end if;

    select package.status
    into v_package_status
    from messaging.legal_disclosure_packages package
    where package.id=old.id;

    if coalesce(auth.role(),'')<>'service_role'
       or v_package_status is distinct from 'generating'
    then
      raise exception using
        errcode='42501',
        message='Generated Legal disclosure Media assets are immutable outside active Candidate C generation.';
    end if;
  end if;

  return new;
end
$fn$;

create trigger assets_legal_disclosure_guard
before insert or update or delete on media.assets
for each row execute function messaging.guard_legal_disclosure_media_asset_v1();

create or replace function messaging.guard_legal_disclosure_media_governance_v1()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,auth,messaging,media
as $fn$
begin
  if not exists(
    select 1
    from media.assets asset
    where asset.id=new.asset_id
      and asset.asset_purpose='legal_disclosure'
  ) then
    return new;
  end if;

  if coalesce(auth.role(),'')<>'service_role'
     or new.version_number<>1
     or new.source_protection_class not in ('restricted','confidential')
     or new.preservation_state<>'preserved'
     or new.retention_state<>'retain'
     or new.public_safety_state<>'internal'
     or exists(
       select 1
       from media.asset_governance_versions governance
       where governance.asset_id=new.asset_id
     )
     or not exists(
       select 1
       from messaging.legal_disclosure_packages package
       where package.id=new.asset_id
         and package.status='generating'
     )
  then
    raise exception using
      errcode='42501',
      message='Legal disclosure Media governance is fixed by Candidate C generation authority.';
  end if;

  return new;
end
$fn$;

create trigger governance_legal_disclosure_guard
before insert on media.asset_governance_versions
for each row execute function messaging.guard_legal_disclosure_media_governance_v1();

create or replace function messaging.guard_legal_disclosure_media_revision_v1()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,auth,messaging,media
as $fn$
declare
  v_asset_purpose text;
  v_storage_path text;
begin
  select asset.asset_purpose
  into v_asset_purpose
  from media.assets asset
  where asset.id=new.asset_id;

  select file_object.storage_path
  into v_storage_path
  from media.file_objects file_object
  where file_object.id=new.original_file_object_id;

  if v_asset_purpose is distinct from 'legal_disclosure'
     and coalesce(v_storage_path,'') !~ '^private-files/legal-disclosures/'
  then
    return new;
  end if;

  if coalesce(auth.role(),'')<>'service_role'
     or new.revision_number<>1
     or new.previous_revision_id is not null
     or exists(
       select 1
       from media.asset_revisions revision
       where revision.asset_id=new.asset_id
     )
     or not exists(
       select 1
       from messaging.legal_disclosure_packages package
       where package.id=new.asset_id
         and package.status='generating'
         and v_storage_path=messaging.legal_package_storage_path_v1(
           package.legal_request_case_id,
           package.id
         )
     )
  then
    raise exception using
      errcode='42501',
      message='Legal disclosure Media revisions may be created only by active Candidate C generation authority.';
  end if;

  return new;
end
$fn$;

create trigger asset_revisions_legal_disclosure_guard
before insert on media.asset_revisions
for each row execute function messaging.guard_legal_disclosure_media_revision_v1();

create or replace function messaging.guard_legal_disclosure_media_variant_v1()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,messaging,media
as $fn$
begin
  if exists(
       select 1
       from media.assets asset
       where asset.id=new.asset_id
         and asset.asset_purpose='legal_disclosure'
     )
     or exists(
       select 1
       from media.file_objects file_object
       where file_object.id in (
         new.source_file_object_id,
         new.derived_file_object_id
       )
         and file_object.storage_path ~ '^private-files/legal-disclosures/'
     )
  then
    raise exception using
      errcode='42501',
      message='Legal disclosure Media bytes cannot participate in generic Media variants.';
  end if;

  return new;
end
$fn$;

create trigger variants_legal_disclosure_guard
before insert on media.variants
for each row execute function messaging.guard_legal_disclosure_media_variant_v1();

create or replace function messaging.guard_legal_disclosure_media_usage_v1()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,messaging,media
as $fn$
begin
  if exists(
    select 1
    from media.assets asset
    where asset.id=new.asset_id
      and asset.asset_purpose='legal_disclosure'
  ) then
    raise exception using
      errcode='42501',
      message='Legal disclosure Media assets cannot be attached through generic Media usage.';
  end if;

  if tg_op='UPDATE' and exists(
    select 1
    from media.assets asset
    where asset.id=old.asset_id
      and asset.asset_purpose='legal_disclosure'
  ) then
    raise exception using
      errcode='42501',
      message='Legal disclosure Media usage cannot be reassigned.';
  end if;

  return new;
end
$fn$;

create trigger usage_links_legal_disclosure_guard
before insert or update on media.usage_links
for each row execute function messaging.guard_legal_disclosure_media_usage_v1();

create or replace function messaging.legal_selection_fingerprint_v1(p_package_id uuid)
returns text
language plpgsql
stable
security definer
set search_path=pg_catalog,messaging
as $fn$
declare
  v_package messaging.legal_disclosure_packages%rowtype;
  v_payload jsonb;
  v_text text;
begin
  select * into v_package from messaging.legal_disclosure_packages where id=p_package_id;
  if not found then
    raise exception using errcode='P0002',message='Legal disclosure package does not exist.';
  end if;
  select jsonb_build_object(
    'schema','wk-legal-disclosure-selection-v1',
    'legal_request_case_id',v_package.legal_request_case_id::text,
    'legal_disclosure_package_id',v_package.id::text,
    'scope_statement',v_package.scope_statement,
    'documented_omissions',to_jsonb(v_package.documented_omissions),
    'objects',coalesce(jsonb_agg(jsonb_build_object(
      'manifest_order',o.manifest_order,
      'legal_preserved_object_id',o.legal_preserved_object_id::text,
      'object_kind',o.object_kind,
      'response_classification',o.response_classification
    ) order by o.manifest_order),'[]'::jsonb)
  ) into v_payload
  from messaging.legal_disclosure_objects o
  where o.legal_disclosure_package_id=v_package.id;
  v_text:=messaging.legal_canonical_json_v1(v_payload);
  return messaging.legal_sha256_text_v1(v_text);
end
$fn$;

create or replace function messaging.legal_object_required_by_active_scope_v1(p_preserved_object_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path=pg_catalog,messaging
as $fn$
declare
  v_object messaging.legal_preserved_objects%rowtype;
begin
  select * into v_object from messaging.legal_preserved_objects where id=p_preserved_object_id;
  if not found then return false; end if;
  if v_object.object_kind='message' then
    return exists (
      select 1
      from messaging.legal_preservation_scopes s
      join messaging.messages m on m.id=v_object.message_id
      where s.legal_request_case_id=v_object.legal_request_case_id
        and s.status='active'
        and (
          (s.scope_kind='exact_message' and s.message_id=v_object.message_id)
          or
          (s.scope_kind='conversation_window' and s.conversation_id=m.conversation_id and m.accepted_at>=s.accepted_from and m.accepted_at<s.accepted_until)
        )
    );
  elsif v_object.object_kind='media_file' then
    return exists (
      select 1 from messaging.legal_preservation_scopes s
      where s.legal_request_case_id=v_object.legal_request_case_id
        and s.status='active' and s.scope_kind='exact_media_file'
        and s.media_file_object_id=v_object.media_file_object_id
    );
  else
    return exists (
      select 1 from messaging.legal_preservation_scopes s
      where s.legal_request_case_id=v_object.legal_request_case_id
        and s.status='active' and s.scope_kind='exact_resource_version'
        and s.resource_version_id=v_object.resource_version_id
    );
  end if;
end
$fn$;

-- ---------------------------------------------------------------------------
-- Safe metadata reads.
-- ---------------------------------------------------------------------------

create or replace function public.list_messages_legal_cases_v1(
  p_status text default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,messaging
as $fn$
declare
  v_admin record;
  v_result jsonb;
begin
  select * into v_admin from messaging.require_messages_legal_capability('view_messages_legal_cases');
  if p_status is not null and p_status not in ('open','under_review','closed') then
    raise exception using errcode='22023',message='Invalid Legal case status.';
  end if;
  if p_limit not between 1 and 200 then
    raise exception using errcode='22023',message='Legal case limit must be between 1 and 200.';
  end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.received_at desc,x.id),'[]'::jsonb)
  into v_result
  from (
    select c.id,c.request_reference,c.request_kind,c.status,c.requesting_authority,
           c.jurisdiction_or_process,c.received_at,c.scope_statement,
           c.notice_restriction_state,c.assigned_user_id,c.opened_at,c.closed_at,c.revision,
           (select count(*)::int from messaging.legal_preserved_objects o where o.legal_request_case_id=c.id and o.preservation_status='held') held_object_count,
           (select count(*)::int from messaging.legal_disclosure_packages p where p.legal_request_case_id=c.id) package_count
    from messaging.legal_request_cases c
    where p_status is null or c.status=p_status
    order by c.received_at desc,c.id
    limit p_limit
  ) x;
  return v_result;
end
$fn$;

create or replace function public.get_messages_legal_case_v1(p_case_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,messaging
as $fn$
declare
  v_admin record;
  v_case messaging.legal_request_cases%rowtype;
begin
  select * into v_admin from messaging.require_messages_legal_capability('view_messages_legal_cases');
  select * into v_case from messaging.legal_request_cases where id=p_case_id;
  if not found then raise exception using errcode='P0002',message='Legal Request Case does not exist.'; end if;
  return jsonb_build_object(
    'case',to_jsonb(v_case),
    'scopes',coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at,s.id) from messaging.legal_preservation_scopes s where s.legal_request_case_id=v_case.id),'[]'::jsonb),
    'preserved_objects',coalesce((select jsonb_agg(jsonb_build_object(
      'id',o.id,'object_kind',o.object_kind,'message_id',o.message_id,
      'media_file_object_id',o.media_file_object_id,'resource_version_id',o.resource_version_id,
      'preservation_status',o.preservation_status,'response_classification',o.response_classification,
      'classification_reason',o.classification_reason,'preserved_at',o.preserved_at,
      'classified_at',o.classified_at,'released_at',o.released_at,'revision',o.revision
    ) order by o.preserved_at,o.id) from messaging.legal_preserved_objects o where o.legal_request_case_id=v_case.id),'[]'::jsonb),
    'packages',coalesce((select jsonb_agg(jsonb_build_object(
      'id',p.id,'production_reference',p.production_reference,'status',p.status,
      'scope_statement',p.scope_statement,'documented_omissions',p.documented_omissions,
      'selection_fingerprint',p.selection_fingerprint,'requested_at',p.requested_at,
      'generated_at',p.generated_at,'manifest_sha256',p.manifest_sha256,
      'package_file_object_id',p.package_file_object_id,'package_sha256',p.package_sha256,
      'package_byte_size',p.package_byte_size,'released_at',p.released_at,
      'failure_summary',p.failure_summary,'revision',p.revision
    ) order by p.requested_at,p.id) from messaging.legal_disclosure_packages p where p.legal_request_case_id=v_case.id),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(jsonb_build_object(
      'id',e.id,'legal_disclosure_package_id',e.legal_disclosure_package_id,
      'legal_preserved_object_id',e.legal_preserved_object_id,'event_kind',e.event_kind,
      'actor_kind',e.actor_kind,'actor_user_id',e.actor_user_id,'actor_key',e.actor_key,
      'occurred_at',e.occurred_at,'metadata',e.metadata
    ) order by e.occurred_at,e.id) from messaging.legal_case_events e where e.legal_request_case_id=v_case.id),'[]'::jsonb)
  );
end
$fn$;

create or replace function public.list_messages_legal_preserved_objects_v1(
  p_case_id uuid,
  p_preservation_status text default null,
  p_response_classification text default null,
  p_limit integer default 200
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,messaging
as $fn$
declare
  v_admin record;
  v_result jsonb;
begin
  select * into v_admin from messaging.require_messages_legal_capability('view_messages_legal_cases');
  if not exists(select 1 from messaging.legal_request_cases where id=p_case_id) then
    raise exception using errcode='P0002',message='Legal Request Case does not exist.';
  end if;
  if p_preservation_status is not null and p_preservation_status not in ('held','released') then
    raise exception using errcode='22023',message='Invalid Legal preservation status.';
  end if;
  if p_response_classification is not null and p_response_classification not in ('unclassified','responsive','elevated_review','excluded') then
    raise exception using errcode='22023',message='Invalid Legal response classification.';
  end if;
  if p_limit not between 1 and 500 then
    raise exception using errcode='22023',message='Legal preserved-object limit must be between 1 and 500.';
  end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.preserved_at,x.id),'[]'::jsonb)
  into v_result
  from (
    select
      o.id,o.object_kind,o.message_id,o.media_file_object_id,o.resource_version_id,
      o.preservation_status,o.response_classification,o.preserved_at,o.classified_at,
      o.released_at,o.revision
    from messaging.legal_preserved_objects o
    where o.legal_request_case_id=p_case_id
      and (p_preservation_status is null or o.preservation_status=p_preservation_status)
      and (p_response_classification is null or o.response_classification=p_response_classification)
    order by o.preserved_at,o.id
    limit p_limit
  ) x;
  return v_result;
end
$fn$;

create or replace function public.get_messages_legal_disclosure_package_v1(p_package_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,messaging
as $fn$
declare
  v_admin record;
  v_package messaging.legal_disclosure_packages%rowtype;
begin
  select * into v_admin from messaging.require_messages_legal_capability('view_messages_legal_cases');
  select * into v_package from messaging.legal_disclosure_packages where id=p_package_id;
  if not found then raise exception using errcode='P0002',message='Legal disclosure package does not exist.'; end if;
  return jsonb_build_object(
    'package',to_jsonb(v_package),
    'objects',coalesce((select jsonb_agg(to_jsonb(o) order by o.manifest_order) from messaging.legal_disclosure_objects o where o.legal_disclosure_package_id=v_package.id),'[]'::jsonb),
    'approvals',coalesce((select jsonb_agg(to_jsonb(a) order by a.approved_at,a.id) from messaging.legal_disclosure_approvals a where a.legal_disclosure_package_id=v_package.id),'[]'::jsonb)
  );
end
$fn$;

-- ---------------------------------------------------------------------------
-- Open case.
-- ---------------------------------------------------------------------------

create or replace function public.open_messages_legal_request_case_v1(
  p_request_reference text,
  p_request_kind text,
  p_requesting_authority text,
  p_jurisdiction_or_process text,
  p_received_at timestamptz,
  p_scope_statement text,
  p_notice_restriction_state text,
  p_assigned_user_id uuid,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,auth,public,editorial,messaging,platform_private
as $fn$
declare
  v_admin record;
  v_correlation uuid;
  v_begin record;
  v_case_id uuid;
  v_result jsonb;
begin
  select * into v_admin from messaging.require_messages_legal_capability('manage_messages_legal_cases');
  if nullif(btrim(p_request_reference),'') is null or octet_length(p_request_reference)>240
     or p_request_kind not in ('preservation','disclosure','emergency','other')
     or nullif(btrim(p_requesting_authority),'') is null or octet_length(p_requesting_authority)>500
     or nullif(btrim(p_jurisdiction_or_process),'') is null or octet_length(p_jurisdiction_or_process)>500
     or p_received_at is null
     or nullif(btrim(p_scope_statement),'') is null or octet_length(p_scope_statement)>8192
     or p_notice_restriction_state not in ('none','restricted','unknown')
  then raise exception using errcode='22023',message='Legal Request Case input is invalid.'; end if;
  v_correlation:=messaging.command_correlation(v_admin.user_id,'messages.legal.case.open',p_idempotency_key,p_correlation_id);
  select * into v_begin from platform_private.begin_authenticated_resource_command(
    'messages.legal.case.open',v_admin.person_resource_id,p_idempotency_key,
    jsonb_build_object('request_reference',btrim(p_request_reference),'request_kind',p_request_kind,'requesting_authority',btrim(p_requesting_authority),'jurisdiction_or_process',btrim(p_jurisdiction_or_process),'received_at',p_received_at,'scope_statement',btrim(p_scope_statement),'notice_restriction_state',p_notice_restriction_state,'assigned_user_id',p_assigned_user_id,'correlation_id',v_correlation)
  );
  if v_begin.idempotent_replay then return v_begin.result_payload; end if;
  insert into messaging.legal_request_cases(
    request_reference,request_kind,status,requesting_authority,jurisdiction_or_process,
    received_at,scope_statement,notice_restriction_state,assigned_user_id,opened_by_user_id
  ) values (
    btrim(p_request_reference),p_request_kind,'open',btrim(p_requesting_authority),btrim(p_jurisdiction_or_process),
    p_received_at,btrim(p_scope_statement),p_notice_restriction_state,p_assigned_user_id,v_admin.user_id
  ) returning id into v_case_id;
  perform messaging.append_legal_case_event_v1(v_case_id,null,null,'request_opened',v_admin.user_id,v_admin.person_resource_id,'human',null,v_begin.command_receipt_id,jsonb_build_object('request_kind',p_request_kind,'correlation_id',v_correlation));
  v_result:=jsonb_build_object('legal_request_case_id',v_case_id,'status','open','revision',1,'command_receipt_id',v_begin.command_receipt_id,'correlation_id',v_correlation);
  perform platform_private.complete_resource_command(v_begin.command_receipt_id,v_result);
  return v_result;
end
$fn$;

-- ---------------------------------------------------------------------------
-- Start review.
-- ---------------------------------------------------------------------------

create or replace function public.start_messages_legal_review_v1(
  p_case_id uuid,
  p_expected_revision bigint,
  p_assigned_user_id uuid,
  p_reason text,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,auth,public,editorial,messaging,platform_private
as $fn$
declare
  v_admin record; v_case messaging.legal_request_cases%rowtype; v_correlation uuid; v_begin record; v_result jsonb;
begin
  select * into v_admin from messaging.require_messages_legal_capability('manage_messages_legal_cases');
  if nullif(btrim(p_reason),'') is null or octet_length(p_reason)>8192 then raise exception using errcode='22023',message='Legal review reason is required.'; end if;
  v_correlation:=messaging.command_correlation(v_admin.user_id,'messages.legal.review.start',p_idempotency_key,p_correlation_id);
  select * into v_begin from platform_private.begin_authenticated_resource_command('messages.legal.review.start',v_admin.person_resource_id,p_idempotency_key,jsonb_build_object('case_id',p_case_id,'expected_revision',p_expected_revision,'assigned_user_id',p_assigned_user_id,'reason',btrim(p_reason),'correlation_id',v_correlation));
  if v_begin.idempotent_replay then return v_begin.result_payload; end if;
  select * into v_case from messaging.legal_request_cases where id=p_case_id for update;
  if not found then raise exception using errcode='P0002',message='Legal Request Case does not exist.'; end if;
  if v_case.revision<>p_expected_revision then raise exception using errcode='40001',message='Legal Request Case revision is stale.'; end if;
  if v_case.status<>'open' then raise exception using errcode='55000',message='Only open Legal Request Cases may start review.'; end if;
  update messaging.legal_request_cases set status='under_review',assigned_user_id=coalesce(p_assigned_user_id,v_admin.user_id),revision=revision+1,updated_at=now() where id=p_case_id;
  perform messaging.append_legal_case_event_v1(p_case_id,null,null,'review_started',v_admin.user_id,v_admin.person_resource_id,'human',null,v_begin.command_receipt_id,jsonb_build_object('reason',btrim(p_reason),'correlation_id',v_correlation));
  v_result:=jsonb_build_object('legal_request_case_id',p_case_id,'status','under_review','revision',p_expected_revision+1,'command_receipt_id',v_begin.command_receipt_id,'correlation_id',v_correlation);
  perform platform_private.complete_resource_command(v_begin.command_receipt_id,v_result); return v_result;
end
$fn$;

-- ---------------------------------------------------------------------------
-- Add or release preservation scope.
-- ---------------------------------------------------------------------------

create or replace function public.update_messages_legal_scope_v1(
  p_case_id uuid,
  p_action text,
  p_scope_id uuid,
  p_scope_kind text,
  p_message_id uuid,
  p_conversation_id uuid,
  p_accepted_from timestamptz,
  p_accepted_until timestamptz,
  p_media_file_object_id uuid,
  p_resource_version_id uuid,
  p_scope_note text,
  p_expected_revision bigint,
  p_reason text,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,auth,public,editorial,messaging,media,platform_private
as $fn$
declare
  v_admin record; v_case messaging.legal_request_cases%rowtype; v_scope messaging.legal_preservation_scopes%rowtype; v_scope_id uuid; v_correlation uuid; v_begin record; v_result jsonb;
begin
  select * into v_admin from messaging.require_messages_legal_capability('manage_messages_legal_cases');
  if p_action not in ('add','release') then raise exception using errcode='22023',message='Legal scope action is invalid.'; end if;
  if nullif(btrim(p_reason),'') is null or octet_length(p_reason)>8192 then raise exception using errcode='22023',message='Legal scope reason is required.'; end if;
  v_correlation:=messaging.command_correlation(v_admin.user_id,'messages.legal.scope.update',p_idempotency_key,p_correlation_id);
  select * into v_begin from platform_private.begin_authenticated_resource_command('messages.legal.scope.update',v_admin.person_resource_id,p_idempotency_key,jsonb_build_object('case_id',p_case_id,'action',p_action,'scope_id',p_scope_id,'scope_kind',p_scope_kind,'message_id',p_message_id,'conversation_id',p_conversation_id,'accepted_from',p_accepted_from,'accepted_until',p_accepted_until,'media_file_object_id',p_media_file_object_id,'resource_version_id',p_resource_version_id,'scope_note',p_scope_note,'expected_revision',p_expected_revision,'reason',btrim(p_reason),'correlation_id',v_correlation));
  if v_begin.idempotent_replay then return v_begin.result_payload; end if;
  select * into v_case from messaging.legal_request_cases where id=p_case_id for update;
  if not found then raise exception using errcode='P0002',message='Legal Request Case does not exist.'; end if;
  if v_case.status<>'under_review' then raise exception using errcode='55000',message='Legal preservation scope requires a case under review.'; end if;
  if v_case.revision<>p_expected_revision then raise exception using errcode='40001',message='Legal Request Case revision is stale.'; end if;
  if p_action='add' then
    if p_scope_id is not null or p_scope_kind not in ('exact_message','conversation_window','exact_media_file','exact_resource_version') then raise exception using errcode='22023',message='Legal scope add input is invalid.'; end if;
    if p_scope_kind='exact_message' and not exists(select 1 from messaging.messages where id=p_message_id) then raise exception using errcode='P0002',message='Scoped Message does not exist.'; end if;
    if p_scope_kind='conversation_window' and (not exists(select 1 from messaging.conversations where id=p_conversation_id) or p_accepted_from is null or p_accepted_until is null or p_accepted_from>=p_accepted_until) then raise exception using errcode='22023',message='Conversation window scope is invalid.'; end if;
    if p_scope_kind='exact_media_file' and not exists(select 1 from media.file_objects where id=p_media_file_object_id) then raise exception using errcode='P0002',message='Scoped Media file does not exist.'; end if;
    if p_scope_kind='exact_resource_version' and not exists(select 1 from editorial.resource_versions where id=p_resource_version_id) then raise exception using errcode='P0002',message='Scoped Resource Version does not exist.'; end if;
    insert into messaging.legal_preservation_scopes(
      legal_request_case_id,scope_kind,message_id,conversation_id,accepted_from,accepted_until,
      media_file_object_id,resource_version_id,scope_note,created_by_user_id
    ) values (
      p_case_id,p_scope_kind,p_message_id,p_conversation_id,p_accepted_from,p_accepted_until,
      p_media_file_object_id,p_resource_version_id,nullif(btrim(p_scope_note),''),v_admin.user_id
    ) returning id into v_scope_id;
    perform messaging.append_legal_case_event_v1(p_case_id,null,null,'scope_added',v_admin.user_id,v_admin.person_resource_id,'human',null,v_begin.command_receipt_id,jsonb_build_object('scope_id',v_scope_id,'scope_kind',p_scope_kind,'reason',btrim(p_reason),'correlation_id',v_correlation));
  else
    if p_scope_id is null then raise exception using errcode='22023',message='Legal scope id is required for release.'; end if;
    select * into v_scope from messaging.legal_preservation_scopes where id=p_scope_id and legal_request_case_id=p_case_id for update;
    if not found then raise exception using errcode='P0002',message='Legal preservation scope does not exist.'; end if;
    if v_scope.status<>'active' then raise exception using errcode='55000',message='Only active Legal scopes may be released.'; end if;
    update messaging.legal_preservation_scopes set status='released',released_by_user_id=v_admin.user_id,released_at=now(),release_reason=btrim(p_reason),revision=revision+1 where id=p_scope_id;
    v_scope_id:=p_scope_id;
    perform messaging.append_legal_case_event_v1(p_case_id,null,null,'scope_released',v_admin.user_id,v_admin.person_resource_id,'human',null,v_begin.command_receipt_id,jsonb_build_object('scope_id',v_scope_id,'reason',btrim(p_reason),'correlation_id',v_correlation));
  end if;
  update messaging.legal_request_cases set revision=revision+1,updated_at=now() where id=p_case_id;
  v_result:=jsonb_build_object('legal_request_case_id',p_case_id,'scope_id',v_scope_id,'action',p_action,'case_revision',p_expected_revision+1,'command_receipt_id',v_begin.command_receipt_id,'correlation_id',v_correlation);
  perform platform_private.complete_resource_command(v_begin.command_receipt_id,v_result); return v_result;
end
$fn$;

-- ---------------------------------------------------------------------------
-- Materialize finite scope to exact canonical held objects.
-- ---------------------------------------------------------------------------

create or replace function public.materialize_messages_legal_preservation_v1(
  p_case_id uuid,
  p_scope_id uuid,
  p_expected_case_revision bigint,
  p_reason text,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,auth,public,editorial,messaging,media,platform_private
as $fn$
declare
  v_admin record; v_case messaging.legal_request_cases%rowtype; v_scope messaging.legal_preservation_scopes%rowtype; v_correlation uuid; v_begin record; v_inserted integer:=0; v_result jsonb;
begin
  select * into v_admin from messaging.require_messages_legal_capability('manage_messages_legal_cases');
  if nullif(btrim(p_reason),'') is null or octet_length(p_reason)>8192 then raise exception using errcode='22023',message='Preservation reason is required.'; end if;
  v_correlation:=messaging.command_correlation(v_admin.user_id,'messages.legal.preservation.materialize',p_idempotency_key,p_correlation_id);
  select * into v_begin from platform_private.begin_authenticated_resource_command('messages.legal.preservation.materialize',v_admin.person_resource_id,p_idempotency_key,jsonb_build_object('case_id',p_case_id,'scope_id',p_scope_id,'expected_case_revision',p_expected_case_revision,'reason',btrim(p_reason),'correlation_id',v_correlation));
  if v_begin.idempotent_replay then return v_begin.result_payload; end if;
  select * into v_case from messaging.legal_request_cases where id=p_case_id for update;
  if not found or v_case.status<>'under_review' then raise exception using errcode='55000',message='Legal preservation materialization requires a case under review.'; end if;
  if v_case.revision<>p_expected_case_revision then raise exception using errcode='40001',message='Legal Request Case revision is stale.'; end if;
  select * into v_scope from messaging.legal_preservation_scopes where id=p_scope_id and legal_request_case_id=p_case_id for share;
  if not found or v_scope.status<>'active' then raise exception using errcode='55000',message='Legal preservation scope is not active.'; end if;
  if v_scope.scope_kind='exact_message' then
    insert into messaging.legal_preserved_objects(legal_request_case_id,materialized_from_scope_id,object_kind,message_id,preserved_by_user_id)
    values(p_case_id,p_scope_id,'message',v_scope.message_id,v_admin.user_id) on conflict do nothing;
    get diagnostics v_inserted=row_count;
  elsif v_scope.scope_kind='conversation_window' then
    insert into messaging.legal_preserved_objects(legal_request_case_id,materialized_from_scope_id,object_kind,message_id,preserved_by_user_id)
    select p_case_id,p_scope_id,'message',m.id,v_admin.user_id
    from messaging.messages m
    where m.conversation_id=v_scope.conversation_id and m.accepted_at>=v_scope.accepted_from and m.accepted_at<v_scope.accepted_until
    order by m.accepted_at,m.id
    on conflict do nothing;
    get diagnostics v_inserted=row_count;
  elsif v_scope.scope_kind='exact_media_file' then
    insert into messaging.legal_preserved_objects(legal_request_case_id,materialized_from_scope_id,object_kind,media_file_object_id,preserved_by_user_id)
    values(p_case_id,p_scope_id,'media_file',v_scope.media_file_object_id,v_admin.user_id) on conflict do nothing;
    get diagnostics v_inserted=row_count;
  else
    insert into messaging.legal_preserved_objects(legal_request_case_id,materialized_from_scope_id,object_kind,resource_version_id,preserved_by_user_id)
    values(p_case_id,p_scope_id,'resource_version',v_scope.resource_version_id,v_admin.user_id) on conflict do nothing;
    get diagnostics v_inserted=row_count;
  end if;
  update messaging.legal_request_cases set revision=revision+1,updated_at=now() where id=p_case_id;
  perform messaging.append_legal_case_event_v1(p_case_id,null,null,'preservation_applied',v_admin.user_id,v_admin.person_resource_id,'human',null,v_begin.command_receipt_id,jsonb_build_object('scope_id',p_scope_id,'scope_kind',v_scope.scope_kind,'new_objects',v_inserted,'reason',btrim(p_reason),'correlation_id',v_correlation));
  v_result:=jsonb_build_object('legal_request_case_id',p_case_id,'scope_id',p_scope_id,'new_objects',v_inserted,'case_revision',p_expected_case_revision+1,'command_receipt_id',v_begin.command_receipt_id,'correlation_id',v_correlation);
  perform platform_private.complete_resource_command(v_begin.command_receipt_id,v_result); return v_result;
end
$fn$;

-- ---------------------------------------------------------------------------
-- Release one exact Legal hold.
-- ---------------------------------------------------------------------------

create or replace function public.release_messages_legal_preservation_v1(
  p_case_id uuid,
  p_preserved_object_id uuid,
  p_expected_revision bigint,
  p_reason text,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,auth,public,editorial,messaging,platform_private
as $fn$
declare
  v_admin record; v_object messaging.legal_preserved_objects%rowtype; v_correlation uuid; v_begin record; v_result jsonb;
begin
  select * into v_admin from messaging.require_messages_legal_capability('manage_messages_legal_cases');
  if nullif(btrim(p_reason),'') is null or octet_length(p_reason)>8192 then raise exception using errcode='22023',message='Preservation release reason is required.'; end if;
  v_correlation:=messaging.command_correlation(v_admin.user_id,'messages.legal.preservation.release',p_idempotency_key,p_correlation_id);
  select * into v_begin from platform_private.begin_authenticated_resource_command('messages.legal.preservation.release',v_admin.person_resource_id,p_idempotency_key,jsonb_build_object('case_id',p_case_id,'preserved_object_id',p_preserved_object_id,'expected_revision',p_expected_revision,'reason',btrim(p_reason),'correlation_id',v_correlation));
  if v_begin.idempotent_replay then return v_begin.result_payload; end if;
  select * into v_object from messaging.legal_preserved_objects where id=p_preserved_object_id and legal_request_case_id=p_case_id for update;
  if not found then raise exception using errcode='P0002',message='Legal preserved object does not exist.'; end if;
  if v_object.revision<>p_expected_revision then raise exception using errcode='40001',message='Legal preserved object revision is stale.'; end if;
  if v_object.preservation_status<>'held' then raise exception using errcode='55000',message='Only held Legal objects may be released.'; end if;
  if messaging.legal_object_required_by_active_scope_v1(p_preserved_object_id) then raise exception using errcode='55000',message='An active Legal scope still requires this object.'; end if;
  if exists(
    select 1 from messaging.legal_disclosure_objects o
    join messaging.legal_disclosure_packages p on p.id=o.legal_disclosure_package_id
    where o.legal_preserved_object_id=p_preserved_object_id and p.status in ('draft','approved','queued','generating')
  ) then raise exception using errcode='55000',message='An active Legal disclosure selection still requires this object.'; end if;
  update messaging.legal_preserved_objects set preservation_status='released',released_by_user_id=v_admin.user_id,released_at=now(),release_reason=btrim(p_reason),revision=revision+1 where id=p_preserved_object_id;
  perform messaging.append_legal_case_event_v1(p_case_id,null,p_preserved_object_id,'preservation_released',v_admin.user_id,v_admin.person_resource_id,'human',null,v_begin.command_receipt_id,jsonb_build_object('reason',btrim(p_reason),'correlation_id',v_correlation));
  v_result:=jsonb_build_object('legal_request_case_id',p_case_id,'legal_preserved_object_id',p_preserved_object_id,'preservation_status','released','revision',p_expected_revision+1,'command_receipt_id',v_begin.command_receipt_id,'correlation_id',v_correlation);
  perform platform_private.complete_resource_command(v_begin.command_receipt_id,v_result); return v_result;
end
$fn$;

-- ---------------------------------------------------------------------------
-- Classify one exact held object.
-- ---------------------------------------------------------------------------

create or replace function public.classify_messages_legal_object_v1(
  p_case_id uuid,
  p_preserved_object_id uuid,
  p_expected_revision bigint,
  p_classification text,
  p_reason text,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,auth,public,editorial,messaging,platform_private
as $fn$
declare
  v_admin record; v_object messaging.legal_preserved_objects%rowtype; v_correlation uuid; v_begin record; v_result jsonb;
begin
  select * into v_admin from messaging.require_messages_legal_capability('manage_messages_legal_cases');
  if p_classification not in ('responsive','elevated_review','excluded') or nullif(btrim(p_reason),'') is null or octet_length(p_reason)>8192 then raise exception using errcode='22023',message='Legal classification input is invalid.'; end if;
  v_correlation:=messaging.command_correlation(v_admin.user_id,'messages.legal.classification.update',p_idempotency_key,p_correlation_id);
  select * into v_begin from platform_private.begin_authenticated_resource_command('messages.legal.classification.update',v_admin.person_resource_id,p_idempotency_key,jsonb_build_object('case_id',p_case_id,'preserved_object_id',p_preserved_object_id,'expected_revision',p_expected_revision,'classification',p_classification,'reason',btrim(p_reason),'correlation_id',v_correlation));
  if v_begin.idempotent_replay then return v_begin.result_payload; end if;
  select * into v_object from messaging.legal_preserved_objects where id=p_preserved_object_id and legal_request_case_id=p_case_id for update;
  if not found then raise exception using errcode='P0002',message='Legal preserved object does not exist.'; end if;
  if v_object.revision<>p_expected_revision then raise exception using errcode='40001',message='Legal preserved object revision is stale.'; end if;
  if v_object.preservation_status<>'held' then raise exception using errcode='55000',message='Released Legal objects cannot be reclassified.'; end if;
  if exists(
    select 1 from messaging.legal_disclosure_objects o join messaging.legal_disclosure_packages p on p.id=o.legal_disclosure_package_id
    where o.legal_preserved_object_id=p_preserved_object_id and p.status in ('queued','generating','generated','released')
  ) then raise exception using errcode='55000',message='Object classification is frozen by an active/generated Legal package.'; end if;
  update messaging.legal_preserved_objects set response_classification=p_classification,classification_reason=btrim(p_reason),classified_by_user_id=v_admin.user_id,classified_at=now(),revision=revision+1 where id=p_preserved_object_id;
  perform messaging.append_legal_case_event_v1(p_case_id,null,p_preserved_object_id,'classification_changed',v_admin.user_id,v_admin.person_resource_id,'human',null,v_begin.command_receipt_id,jsonb_build_object('from',v_object.response_classification,'to',p_classification,'reason',btrim(p_reason),'correlation_id',v_correlation));
  v_result:=jsonb_build_object('legal_request_case_id',p_case_id,'legal_preserved_object_id',p_preserved_object_id,'response_classification',p_classification,'revision',p_expected_revision+1,'command_receipt_id',v_begin.command_receipt_id,'correlation_id',v_correlation);
  perform platform_private.complete_resource_command(v_begin.command_receipt_id,v_result); return v_result;
end
$fn$;

-- ---------------------------------------------------------------------------
-- Deliberate exact evidence inspection. No adjacent Conversation expansion.
-- ---------------------------------------------------------------------------

create or replace function public.inspect_message_legal_evidence_v1(
  p_case_id uuid,
  p_preserved_object_id uuid,
  p_purpose text,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,auth,public,editorial,messaging,media,platform_private
as $fn$
declare
  v_admin record; v_object messaging.legal_preserved_objects%rowtype; v_correlation uuid; v_begin record; v_evidence jsonb; v_result jsonb;
begin
  select * into v_admin from messaging.require_messages_legal_capability('inspect_messages_legal_evidence');
  if nullif(btrim(p_purpose),'') is null or octet_length(p_purpose)>4096 then raise exception using errcode='22023',message='Legal evidence inspection purpose is required.'; end if;
  v_correlation:=messaging.command_correlation(v_admin.user_id,'messages.legal.evidence.inspect',p_idempotency_key,p_correlation_id);
  select * into v_begin from platform_private.begin_authenticated_resource_command('messages.legal.evidence.inspect',v_admin.person_resource_id,p_idempotency_key,jsonb_build_object('case_id',p_case_id,'preserved_object_id',p_preserved_object_id,'purpose',btrim(p_purpose),'correlation_id',v_correlation));
  if v_begin.idempotent_replay then return v_begin.result_payload; end if;
  select * into v_object from messaging.legal_preserved_objects where id=p_preserved_object_id and legal_request_case_id=p_case_id;
  if not found or v_object.preservation_status<>'held' then raise exception using errcode='42501',message='The requested Legal evidence is not held by this case.'; end if;
  if v_object.object_kind='message' then
    select jsonb_build_object(
      'object_kind','message','message_id',m.id,'conversation_id',m.conversation_id,
      'sender_participant_id',m.sender_participant_id,'message_kind',m.message_kind,
      'body',m.body,'accepted_at',m.accepted_at,'client_created_at',m.client_created_at,
      'correlation_id',m.correlation_id,'command_receipt_id',m.command_receipt_id
    ) into v_evidence from messaging.messages m where m.id=v_object.message_id;
  elsif v_object.object_kind='media_file' then
    select jsonb_build_object(
      'object_kind','media_file','media_file_object_id',f.id,'sha256',f.sha256,
      'byte_size',f.byte_size,'mime_type',f.mime_type,'original_filename',f.original_filename,
      'verification_state',f.verification_state,'storage_provider',f.storage_provider
    ) into v_evidence from media.file_objects f where f.id=v_object.media_file_object_id;
  else
    select jsonb_build_object(
      'object_kind','resource_version','resource_version_id',r.id,'resource_id',r.resource_id,
      'resource_kind',r.resource_kind,'version_type',r.version_type,'version_kind',r.version_kind,
      'version_number',r.version_number,'content_fingerprint',r.content_fingerprint,
      'registered_at',r.registered_at
    ) into v_evidence from editorial.resource_versions r where r.id=v_object.resource_version_id;
  end if;
  if v_evidence is null then raise exception using errcode='P0002',message='Canonical Legal evidence no longer exists.'; end if;
  perform messaging.append_legal_case_event_v1(p_case_id,null,p_preserved_object_id,'evidence_viewed',v_admin.user_id,v_admin.person_resource_id,'human',null,v_begin.command_receipt_id,jsonb_build_object('purpose',btrim(p_purpose),'object_kind',v_object.object_kind,'correlation_id',v_correlation));
  v_result:=jsonb_build_object('legal_request_case_id',p_case_id,'legal_preserved_object_id',p_preserved_object_id,'evidence',v_evidence,'command_receipt_id',v_begin.command_receipt_id,'correlation_id',v_correlation);
  perform platform_private.complete_resource_command(v_begin.command_receipt_id,v_result); return v_result;
end
$fn$;

-- ---------------------------------------------------------------------------
-- Prepare exact ordered package selection.
-- ---------------------------------------------------------------------------

create or replace function public.prepare_messages_legal_disclosure_v1(
  p_case_id uuid,
  p_production_reference text,
  p_scope_statement text,
  p_documented_omissions text[],
  p_preserved_object_ids uuid[],
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,auth,public,editorial,messaging,platform_private
as $fn$
declare
  v_admin record; v_case messaging.legal_request_cases%rowtype; v_package_id uuid:=gen_random_uuid(); v_correlation uuid; v_begin record; v_fingerprint text; v_result jsonb; v_count integer; v_distinct integer;
begin
  select * into v_admin from messaging.require_messages_legal_capability('approve_messages_legal_disclosure');
  if nullif(btrim(p_production_reference),'') is null or octet_length(p_production_reference)>240
     or nullif(btrim(p_scope_statement),'') is null or octet_length(p_scope_statement)>8192
     or p_preserved_object_ids is null or coalesce(array_length(p_preserved_object_ids,1),0) not between 1 and 500
     or coalesce(array_length(p_documented_omissions,1),0)>100
  then raise exception using errcode='22023',message='Legal disclosure preparation input is invalid.'; end if;
  if exists(select 1 from unnest(coalesce(p_documented_omissions,'{}'::text[])) x where nullif(btrim(x),'') is null or octet_length(x)>4096) then raise exception using errcode='22023',message='Legal disclosure omission text is invalid.'; end if;
  select count(*),count(distinct x) into v_count,v_distinct from unnest(p_preserved_object_ids) x;
  if v_count<>v_distinct then raise exception using errcode='22023',message='Legal disclosure selection contains duplicate objects.'; end if;
  select * into v_case from messaging.legal_request_cases where id=p_case_id;
  if not found or v_case.status<>'under_review' then raise exception using errcode='55000',message='Legal disclosure preparation requires a case under review.'; end if;
  if exists(
    select 1 from unnest(p_preserved_object_ids) x
    left join messaging.legal_preserved_objects o on o.id=x and o.legal_request_case_id=p_case_id
    where o.id is null or o.preservation_status<>'held' or o.response_classification in ('unclassified','excluded')
  ) then raise exception using errcode='55000',message='Every selected Legal object must be held and classified responsive or elevated review.'; end if;
  v_correlation:=messaging.command_correlation(v_admin.user_id,'messages.legal.disclosure.prepare',p_idempotency_key,p_correlation_id);
  select * into v_begin from platform_private.begin_authenticated_resource_command('messages.legal.disclosure.prepare',v_admin.person_resource_id,p_idempotency_key,jsonb_build_object('case_id',p_case_id,'production_reference',btrim(p_production_reference),'scope_statement',btrim(p_scope_statement),'documented_omissions',to_jsonb(coalesce(p_documented_omissions,'{}'::text[])),'preserved_object_ids',to_jsonb(p_preserved_object_ids),'correlation_id',v_correlation));
  if v_begin.idempotent_replay then return v_begin.result_payload; end if;
  insert into messaging.legal_disclosure_packages(
    id,legal_request_case_id,production_reference,status,scope_statement,documented_omissions,
    selection_fingerprint,requested_by_user_id
  ) values (
    v_package_id,p_case_id,btrim(p_production_reference),'draft',btrim(p_scope_statement),coalesce(p_documented_omissions,'{}'::text[]),repeat('0',64),v_admin.user_id
  );
  insert into messaging.legal_disclosure_objects(
    legal_disclosure_package_id,legal_preserved_object_id,manifest_order,object_kind,response_classification,source_object_id,source_fingerprint
  )
  select v_package_id,o.id,u.ord::int,o.object_kind,o.response_classification,
         coalesce(o.message_id,o.media_file_object_id,o.resource_version_id),
         case when o.object_kind='media_file' then f.sha256 when o.object_kind='resource_version' then r.content_fingerprint else null end
  from unnest(p_preserved_object_ids) with ordinality u(id,ord)
  join messaging.legal_preserved_objects o on o.id=u.id and o.legal_request_case_id=p_case_id
  left join media.file_objects f on f.id=o.media_file_object_id
  left join editorial.resource_versions r on r.id=o.resource_version_id
  order by u.ord;
  v_fingerprint:=messaging.legal_selection_fingerprint_v1(v_package_id);
  update messaging.legal_disclosure_packages set selection_fingerprint=v_fingerprint where id=v_package_id;
  perform messaging.append_legal_case_event_v1(p_case_id,v_package_id,null,'disclosure_prepared',v_admin.user_id,v_admin.person_resource_id,'human',null,v_begin.command_receipt_id,jsonb_build_object('selection_fingerprint',v_fingerprint,'object_count',v_count,'correlation_id',v_correlation));
  v_result:=jsonb_build_object('legal_request_case_id',p_case_id,'legal_disclosure_package_id',v_package_id,'status','draft','selection_fingerprint',v_fingerprint,'object_count',v_count,'command_receipt_id',v_begin.command_receipt_id,'correlation_id',v_correlation);
  perform platform_private.complete_resource_command(v_begin.command_receipt_id,v_result); return v_result;
end
$fn$;

-- ---------------------------------------------------------------------------
-- Record/revoke package or elevated-object approval.
-- ---------------------------------------------------------------------------

create or replace function public.update_messages_legal_disclosure_approval_v1(
  p_package_id uuid,
  p_action text,
  p_preserved_object_id uuid,
  p_expected_package_revision bigint,
  p_selection_fingerprint text,
  p_reason text,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,auth,public,editorial,messaging,platform_private
as $fn$
declare
  v_admin record; v_package messaging.legal_disclosure_packages%rowtype; v_approval messaging.legal_disclosure_approvals%rowtype; v_approval_id uuid; v_scope text; v_correlation uuid; v_begin record; v_result jsonb;
begin
  select * into v_admin from messaging.require_messages_legal_capability('approve_messages_legal_disclosure');
  if p_action not in ('record_package','record_elevated','revoke_package','revoke_elevated')
     or p_selection_fingerprint !~ '^[0-9a-f]{64}$'
     or nullif(btrim(p_reason),'') is null or octet_length(p_reason)>8192
  then raise exception using errcode='22023',message='Legal disclosure approval input is invalid.'; end if;
  v_scope:=case when p_action like '%package' then 'package' else 'elevated_object' end;
  if v_scope='package' and p_preserved_object_id is not null then raise exception using errcode='22023',message='Package approval must not target one object.'; end if;
  if v_scope='elevated_object' and p_preserved_object_id is null then raise exception using errcode='22023',message='Elevated approval requires an exact object.'; end if;
  v_correlation:=messaging.command_correlation(v_admin.user_id,'messages.legal.disclosure.approval.update',p_idempotency_key,p_correlation_id);
  select * into v_begin from platform_private.begin_authenticated_resource_command('messages.legal.disclosure.approval.update',v_admin.person_resource_id,p_idempotency_key,jsonb_build_object('package_id',p_package_id,'action',p_action,'preserved_object_id',p_preserved_object_id,'expected_package_revision',p_expected_package_revision,'selection_fingerprint',p_selection_fingerprint,'reason',btrim(p_reason),'correlation_id',v_correlation));
  if v_begin.idempotent_replay then return v_begin.result_payload; end if;
  select * into v_package from messaging.legal_disclosure_packages where id=p_package_id for update;
  if not found then raise exception using errcode='P0002',message='Legal disclosure package does not exist.'; end if;
  if v_package.revision<>p_expected_package_revision then raise exception using errcode='40001',message='Legal disclosure package revision is stale.'; end if;
  if v_package.status not in ('draft','approved') then raise exception using errcode='55000',message='Legal approval can change only before generation is queued.'; end if;
  if v_package.selection_fingerprint<>p_selection_fingerprint or messaging.legal_selection_fingerprint_v1(p_package_id)<>p_selection_fingerprint then raise exception using errcode='55000',message='Legal disclosure selection fingerprint is stale.'; end if;
  if v_scope='elevated_object' and not exists(
    select 1 from messaging.legal_disclosure_objects o
    join messaging.legal_preserved_objects p on p.id=o.legal_preserved_object_id
    where o.legal_disclosure_package_id=p_package_id and o.legal_preserved_object_id=p_preserved_object_id
      and o.response_classification='elevated_review' and p.response_classification='elevated_review' and p.preservation_status='held'
  ) then raise exception using errcode='55000',message='Elevated approval requires one selected held elevated-review object.'; end if;
  if p_action='record_package' and exists(
    select 1
    from messaging.legal_disclosure_objects o
    where o.legal_disclosure_package_id=p_package_id
      and o.response_classification='elevated_review'
      and not exists(
        select 1
        from messaging.legal_disclosure_approvals a
        where a.legal_disclosure_package_id=p_package_id
          and a.legal_preserved_object_id=o.legal_preserved_object_id
          and a.approval_scope='elevated_object'
          and a.status='active'
          and a.selection_fingerprint=p_selection_fingerprint
      )
  ) then
    raise exception using errcode='55000',message='Elevated-review approvals must be recorded before package approval.';
  end if;
  if p_action in ('record_package','record_elevated') then
    insert into messaging.legal_disclosure_approvals(
      legal_disclosure_package_id,legal_preserved_object_id,approval_scope,status,selection_fingerprint,
      approval_reason,approved_by_user_id
    ) values (p_package_id,p_preserved_object_id,v_scope,'active',p_selection_fingerprint,btrim(p_reason),v_admin.user_id)
    returning id into v_approval_id;
    if v_scope='package' then update messaging.legal_disclosure_packages set status='approved',revision=revision+1 where id=p_package_id; else update messaging.legal_disclosure_packages set revision=revision+1 where id=p_package_id; end if;
    perform messaging.append_legal_case_event_v1(v_package.legal_request_case_id,p_package_id,p_preserved_object_id,'approval_recorded',v_admin.user_id,v_admin.person_resource_id,'human',null,v_begin.command_receipt_id,jsonb_build_object('approval_id',v_approval_id,'approval_scope',v_scope,'selection_fingerprint',p_selection_fingerprint,'reason',btrim(p_reason),'correlation_id',v_correlation));
  else
    select * into v_approval from messaging.legal_disclosure_approvals a
    where a.legal_disclosure_package_id=p_package_id and a.approval_scope=v_scope and a.status='active'
      and (v_scope='package' or a.legal_preserved_object_id=p_preserved_object_id)
    for update;
    if not found then raise exception using errcode='P0002',message='Active Legal disclosure approval does not exist.'; end if;
    update messaging.legal_disclosure_approvals set status='revoked',revoked_by_user_id=v_admin.user_id,revoked_at=now(),revocation_reason=btrim(p_reason),revision=revision+1 where id=v_approval.id;
    v_approval_id:=v_approval.id;
    if v_scope='package' then update messaging.legal_disclosure_packages set status='draft',revision=revision+1 where id=p_package_id; else update messaging.legal_disclosure_packages set revision=revision+1 where id=p_package_id; end if;
    perform messaging.append_legal_case_event_v1(v_package.legal_request_case_id,p_package_id,p_preserved_object_id,'approval_revoked',v_admin.user_id,v_admin.person_resource_id,'human',null,v_begin.command_receipt_id,jsonb_build_object('approval_id',v_approval_id,'approval_scope',v_scope,'reason',btrim(p_reason),'correlation_id',v_correlation));
  end if;
  v_result:=jsonb_build_object('legal_disclosure_package_id',p_package_id,'approval_id',v_approval_id,'action',p_action,'package_revision',p_expected_package_revision+1,'command_receipt_id',v_begin.command_receipt_id,'correlation_id',v_correlation);
  perform platform_private.complete_resource_command(v_begin.command_receipt_id,v_result); return v_result;
end
$fn$;

-- ---------------------------------------------------------------------------
-- Queue deterministic disclosure generation on shared durable jobs.
-- ---------------------------------------------------------------------------

create or replace function public.submit_messages_legal_disclosure_generation_v1(
  p_package_id uuid,
  p_expected_package_revision bigint,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,auth,public,editorial,messaging,platform_private
as $fn$
declare
  v_admin record; v_package messaging.legal_disclosure_packages%rowtype; v_correlation uuid; v_begin record; v_job_id uuid; v_result jsonb;
begin
  select * into v_admin from messaging.require_messages_legal_capability('approve_messages_legal_disclosure');
  v_correlation:=messaging.command_correlation(v_admin.user_id,'messages.legal.disclosure.generate',p_idempotency_key,p_correlation_id);
  select * into v_begin from platform_private.begin_authenticated_resource_command('messages.legal.disclosure.generate',v_admin.person_resource_id,p_idempotency_key,jsonb_build_object('package_id',p_package_id,'expected_package_revision',p_expected_package_revision,'correlation_id',v_correlation));
  if v_begin.idempotent_replay then return v_begin.result_payload; end if;
  select * into v_package from messaging.legal_disclosure_packages where id=p_package_id for update;
  if not found then raise exception using errcode='P0002',message='Legal disclosure package does not exist.'; end if;
  if v_package.revision<>p_expected_package_revision then raise exception using errcode='40001',message='Legal disclosure package revision is stale.'; end if;
  if v_package.status<>'approved' then raise exception using errcode='55000',message='Legal disclosure generation requires approved package state.'; end if;
  if messaging.legal_selection_fingerprint_v1(p_package_id)<>v_package.selection_fingerprint then raise exception using errcode='55000',message='Legal disclosure selection fingerprint is stale.'; end if;
  if not exists(select 1 from messaging.legal_disclosure_approvals a where a.legal_disclosure_package_id=p_package_id and a.approval_scope='package' and a.status='active' and a.selection_fingerprint=v_package.selection_fingerprint) then raise exception using errcode='55000',message='Active exact-fingerprint package approval is required.'; end if;
  if exists(
    select 1
    from messaging.legal_disclosure_objects o
    join messaging.legal_preserved_objects p on p.id=o.legal_preserved_object_id
    where o.legal_disclosure_package_id=p_package_id
      and (p.preservation_status<>'held' or p.response_classification<>o.response_classification or p.response_classification in ('unclassified','excluded'))
  ) then raise exception using errcode='55000',message='Legal disclosure selection no longer matches held classifications.'; end if;
  if exists(
    select 1 from messaging.legal_disclosure_objects o
    where o.legal_disclosure_package_id=p_package_id and o.response_classification='elevated_review'
      and not exists(select 1 from messaging.legal_disclosure_approvals a where a.legal_disclosure_package_id=p_package_id and a.legal_preserved_object_id=o.legal_preserved_object_id and a.approval_scope='elevated_object' and a.status='active' and a.selection_fingerprint=v_package.selection_fingerprint)
  ) then raise exception using errcode='55000',message='Every elevated-review Legal object requires exact-fingerprint elevated approval.'; end if;
  insert into platform_private.jobs(
    command_receipt_id,resource_id,command_type,job_key,job_type,max_attempts,input_payload
  ) values (
    v_begin.command_receipt_id,v_admin.person_resource_id,'messages.legal.disclosure.generate','primary','messages.legal.disclosure.generate',4,
    jsonb_build_object('legal_request_case_id',v_package.legal_request_case_id,'legal_disclosure_package_id',p_package_id,'selection_fingerprint',v_package.selection_fingerprint,'correlation_id',v_correlation)
  ) returning id into v_job_id;
  update messaging.legal_disclosure_packages set status='queued',generation_job_id=v_job_id,revision=revision+1,failure_summary=null where id=p_package_id;
  perform messaging.append_legal_case_event_v1(v_package.legal_request_case_id,p_package_id,null,'disclosure_queued',v_admin.user_id,v_admin.person_resource_id,'human',null,v_begin.command_receipt_id,jsonb_build_object('job_id',v_job_id,'selection_fingerprint',v_package.selection_fingerprint,'correlation_id',v_correlation));
  v_result:=jsonb_build_object('legal_request_case_id',v_package.legal_request_case_id,'legal_disclosure_package_id',p_package_id,'job_id',v_job_id,'status','queued','selection_fingerprint',v_package.selection_fingerprint,'package_revision',p_expected_package_revision+1,'command_receipt_id',v_begin.command_receipt_id,'correlation_id',v_correlation);
  update platform_private.command_receipts set result_payload=v_result where id=v_begin.command_receipt_id and status='accepted';
  return v_result;
end
$fn$;

-- ---------------------------------------------------------------------------
-- Filtered service-role Legal job claim/lease authority.
-- ---------------------------------------------------------------------------

create or replace function public.claim_messages_legal_disclosure_jobs_v1(
  p_worker_id text,
  p_limit integer default 1,
  p_lease_seconds integer default 900
)
returns table(
  job_id uuid,
  command_receipt_id uuid,
  legal_request_case_id uuid,
  legal_disclosure_package_id uuid,
  selection_fingerprint text,
  attempt_count integer,
  max_attempts integer,
  lease_expires_at timestamptz
)
language plpgsql
security definer
set search_path=pg_catalog,auth,messaging,platform_private
as $fn$
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception using errcode='42501',message='Service-role access is required.'; end if;
  if p_worker_id is null or p_worker_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$' or p_limit not between 1 and 4 or p_lease_seconds not between 60 and 3600 then raise exception using errcode='22023',message='Legal disclosure claim input is invalid.'; end if;
  return query
  with candidates as (
    select j.id
    from platform_private.jobs j
    join messaging.legal_disclosure_packages p on p.generation_job_id=j.id
    where j.command_type='messages.legal.disclosure.generate'
      and j.job_type='messages.legal.disclosure.generate'
      and j.status in ('queued','retry_wait')
      and j.available_at<=now()
      and j.attempt_count<j.max_attempts
      and j.locked_by is null
      and p.status in ('queued','failed')
    order by j.priority,j.available_at,j.created_at
    for update of j skip locked
    limit p_limit
  ), claimed as (
    update platform_private.jobs j
    set status='running',attempt_count=j.attempt_count+1,locked_by=p_worker_id,locked_at=now(),lease_expires_at=now()+make_interval(secs=>p_lease_seconds),started_at=coalesce(j.started_at,now())
    from candidates c where j.id=c.id returning j.*
  ), moved as (
    update messaging.legal_disclosure_packages p
    set status='generating',revision=p.revision+1
    from claimed c where p.generation_job_id=c.id
    returning p.*,c.command_receipt_id,c.attempt_count,c.max_attempts,c.lease_expires_at
  )
  select m.generation_job_id,m.command_receipt_id,m.legal_request_case_id,m.id,m.selection_fingerprint,m.attempt_count,m.max_attempts,m.lease_expires_at
  from moved m;
end
$fn$;

create or replace function public.renew_messages_legal_disclosure_lease_v1(
  p_job_id uuid,
  p_worker_id text,
  p_lease_seconds integer default 900
)
returns timestamptz
language plpgsql
security definer
set search_path=pg_catalog,auth,platform_private
as $fn$
declare v_expiry timestamptz;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception using errcode='42501',message='Service-role access is required.'; end if;
  if p_lease_seconds not between 60 and 3600 then raise exception using errcode='22023',message='Legal disclosure lease duration is invalid.'; end if;
  update platform_private.jobs set lease_expires_at=now()+make_interval(secs=>p_lease_seconds)
  where id=p_job_id and command_type='messages.legal.disclosure.generate' and job_type='messages.legal.disclosure.generate'
    and status='running' and locked_by=p_worker_id and lease_expires_at>now()
  returning lease_expires_at into v_expiry;
  if v_expiry is null then raise exception using errcode='55000',message='Legal disclosure job is not actively leased to this worker.'; end if;
  return v_expiry;
end
$fn$;

-- ---------------------------------------------------------------------------
-- Leased plan and exact source descriptors. No arbitrary object reads.
-- ---------------------------------------------------------------------------

create or replace function public.get_messages_legal_disclosure_plan_v1(
  p_job_id uuid,
  p_worker_id text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,auth,messaging,platform_private
as $fn$
declare
  v_job platform_private.jobs%rowtype; v_package messaging.legal_disclosure_packages%rowtype; v_generation_at timestamptz;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception using errcode='42501',message='Service-role access is required.'; end if;
  select * into v_job from platform_private.jobs where id=p_job_id;
  if not found or v_job.command_type<>'messages.legal.disclosure.generate' or v_job.job_type<>'messages.legal.disclosure.generate' or v_job.status<>'running' or v_job.locked_by is distinct from p_worker_id or v_job.lease_expires_at is null or v_job.lease_expires_at<=now() then raise exception using errcode='55000',message='Legal disclosure job is not actively leased to this worker.'; end if;
  select * into v_package from messaging.legal_disclosure_packages where generation_job_id=p_job_id;
  if not found or v_package.status<>'generating' or v_package.selection_fingerprint is distinct from v_job.input_payload->>'selection_fingerprint' then raise exception using errcode='55000',message='Legal disclosure package no longer matches its leased job.'; end if;
  v_generation_at:=v_job.created_at;
  return jsonb_build_object(
    'job_id',v_job.id,'legal_request_case_id',v_package.legal_request_case_id,'legal_disclosure_package_id',v_package.id,
    'production_reference',v_package.production_reference,'scope_statement',v_package.scope_statement,
    'documented_omissions',to_jsonb(v_package.documented_omissions),'selection_fingerprint',v_package.selection_fingerprint,
    'manifest_version',v_package.manifest_version,'archive_version',v_package.archive_version,
    'generated_at',v_generation_at,
    'storage_path',messaging.legal_package_storage_path_v1(v_package.legal_request_case_id,v_package.id),
    'objects',coalesce((select jsonb_agg(jsonb_build_object('legal_disclosure_object_id',o.id,'manifest_order',o.manifest_order,'object_kind',o.object_kind,'legal_preserved_object_id',o.legal_preserved_object_id,'response_classification',o.response_classification,'source_object_id',o.source_object_id,'source_fingerprint',o.source_fingerprint,'output_path',messaging.legal_disclosure_output_path_v1(o.manifest_order,o.object_kind,o.legal_preserved_object_id)) order by o.manifest_order) from messaging.legal_disclosure_objects o where o.legal_disclosure_package_id=v_package.id),'[]'::jsonb),
    'approvals',coalesce((select jsonb_agg(jsonb_build_object('approval_id',a.id,'approval_scope',a.approval_scope,'legal_preserved_object_id',a.legal_preserved_object_id,'approved_by_user_id',a.approved_by_user_id,'approved_at',a.approved_at,'selection_fingerprint',a.selection_fingerprint) order by case when a.approval_scope='package' then 0 else 1 end,coalesce(o.manifest_order,0),a.id) from messaging.legal_disclosure_approvals a left join messaging.legal_disclosure_objects o on o.legal_disclosure_package_id=a.legal_disclosure_package_id and o.legal_preserved_object_id=a.legal_preserved_object_id where a.legal_disclosure_package_id=v_package.id and a.status='active' and a.selection_fingerprint=v_package.selection_fingerprint),'[]'::jsonb)
  );
end
$fn$;

create or replace function public.get_messages_legal_disclosure_source_v1(
  p_job_id uuid,
  p_worker_id text,
  p_legal_disclosure_object_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,auth,editorial,messaging,media,platform_private
as $fn$
declare
  v_job platform_private.jobs%rowtype; v_package messaging.legal_disclosure_packages%rowtype; v_entry messaging.legal_disclosure_objects%rowtype; v_preserved messaging.legal_preserved_objects%rowtype; v_rep jsonb;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception using errcode='42501',message='Service-role access is required.'; end if;
  select * into v_job from platform_private.jobs where id=p_job_id;
  if not found or v_job.command_type<>'messages.legal.disclosure.generate' or v_job.status<>'running' or v_job.locked_by is distinct from p_worker_id or v_job.lease_expires_at is null or v_job.lease_expires_at<=now() then raise exception using errcode='55000',message='Legal disclosure job is not actively leased to this worker.'; end if;
  select * into v_package from messaging.legal_disclosure_packages where generation_job_id=p_job_id;
  select * into v_entry from messaging.legal_disclosure_objects where id=p_legal_disclosure_object_id and legal_disclosure_package_id=v_package.id;
  if not found then raise exception using errcode='42501',message='Legal disclosure object is not bound to this leased package.'; end if;
  select * into v_preserved from messaging.legal_preserved_objects where id=v_entry.legal_preserved_object_id and legal_request_case_id=v_package.legal_request_case_id;
  if not found or v_preserved.preservation_status<>'held' or v_preserved.response_classification<>v_entry.response_classification then raise exception using errcode='55000',message='Legal disclosure source is no longer held under its approved classification.'; end if;
  if v_entry.object_kind='message' then
    select jsonb_build_object(
      'schema','wk-legal-message-v1','message_id',m.id::text,'conversation_id',m.conversation_id::text,
      'sender_participant_id',m.sender_participant_id::text,'message_kind',m.message_kind,'body',m.body,
      'accepted_at',to_char(m.accepted_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'client_created_at',case when m.client_created_at is null then null else to_char(m.client_created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end,
      'correlation_id',case when m.correlation_id is null then null else m.correlation_id::text end,
      'command_receipt_id',case when m.command_receipt_id is null then null else m.command_receipt_id::text end,
      'resource_references',coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'resource_id',reference.resource_id,
            'resource_version_id',reference.resource_version_id,
            'presentation_kind',reference.presentation_kind
          )
          order by reference.created_at,reference.id
        )
        from messaging.message_resource_references reference
        join messaging.legal_preserved_objects held_reference
          on held_reference.legal_request_case_id=v_package.legal_request_case_id
         and held_reference.object_kind='resource_version'
         and held_reference.resource_version_id=reference.resource_version_id
         and held_reference.preservation_status='held'
         and held_reference.response_classification in ('responsive','elevated_review')
        join messaging.legal_disclosure_objects selected_reference
          on selected_reference.legal_disclosure_package_id=v_package.id
         and selected_reference.legal_preserved_object_id=held_reference.id
         and selected_reference.object_kind='resource_version'
         and selected_reference.response_classification=held_reference.response_classification
        where reference.message_id=m.id
          and reference.presentation_kind='version'
          and reference.resource_version_id is not null
      ),'[]'::jsonb)
    ) into v_rep from messaging.messages m where m.id=v_preserved.message_id;
    if v_rep is null then raise exception using errcode='P0002',message='Canonical Message source no longer exists.'; end if;
    return jsonb_build_object('legal_disclosure_object_id',v_entry.id,'object_kind','message','output_path',messaging.legal_disclosure_output_path_v1(v_entry.manifest_order,v_entry.object_kind,v_entry.legal_preserved_object_id),'output_mime_type','application/json','representation',v_rep);
  elsif v_entry.object_kind='media_file' then
    select jsonb_build_object(
      'legal_disclosure_object_id',v_entry.id,'object_kind','media_file',
      'output_path',messaging.legal_disclosure_output_path_v1(v_entry.manifest_order,v_entry.object_kind,v_entry.legal_preserved_object_id),
      'output_mime_type',f.mime_type,'media_file_object_id',f.id,'storage_provider',f.storage_provider,
      'storage_path',f.storage_path,'sha256',f.sha256,'byte_size',f.byte_size,'verification_state',f.verification_state,
      'original_filename',f.original_filename
    ) into v_rep from media.file_objects f where f.id=v_preserved.media_file_object_id;
    if v_rep is null then raise exception using errcode='P0002',message='Canonical Media source no longer exists.'; end if;
    return v_rep;
  else
    select jsonb_build_object(
      'schema','wk-legal-resource-version-v1','id',r.id::text,'resource_id',r.resource_id::text,
      'resource_kind',r.resource_kind,'version_type',r.version_type,'version_kind',r.version_kind,
      'version_number',r.version_number,'content_fingerprint',r.content_fingerprint,
      'registered_at',to_char(r.registered_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
    ) into v_rep from editorial.resource_versions r where r.id=v_preserved.resource_version_id;
    if v_rep is null then raise exception using errcode='P0002',message='Canonical Resource Version source no longer exists.'; end if;
    return jsonb_build_object('legal_disclosure_object_id',v_entry.id,'object_kind','resource_version','output_path',messaging.legal_disclosure_output_path_v1(v_entry.manifest_order,v_entry.object_kind,v_entry.legal_preserved_object_id),'output_mime_type','application/json','representation',v_rep);
  end if;
end
$fn$;

-- ---------------------------------------------------------------------------
-- Complete generated archive, register restricted canonical Media, complete job.
-- ---------------------------------------------------------------------------

create or replace function public.complete_messages_legal_disclosure_job_v1(
  p_job_id uuid,
  p_worker_id text,
  p_result jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,auth,messaging,media,platform_private,extensions
as $fn$
declare
  v_job platform_private.jobs%rowtype; v_package messaging.legal_disclosure_packages%rowtype; v_expected_path text; v_manifest_text text; v_manifest_sha text; v_package_sha text; v_package_size bigint; v_storage_path text; v_objects jsonb; v_object_count integer; v_result_count integer; v_file_id uuid; v_asset_id uuid; v_revision_id uuid; v_governance_id uuid; v_actor uuid; v_completed record; v_event_id uuid; v_existing media.file_objects%rowtype; v_item jsonb; v_entry messaging.legal_disclosure_objects%rowtype; v_output_path text; v_output_mime text; v_hash text; v_size bigint; v_final_result jsonb;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception using errcode='42501',message='Service-role access is required.'; end if;
  if p_result is null or jsonb_typeof(p_result)<>'object' or octet_length(p_result::text)>1048576 then raise exception using errcode='22023',message='Legal disclosure completion result is invalid.'; end if;
  select * into v_job from platform_private.jobs where id=p_job_id for update;
  if not found or v_job.command_type<>'messages.legal.disclosure.generate' or v_job.job_type<>'messages.legal.disclosure.generate' or v_job.status<>'running' or v_job.locked_by is distinct from p_worker_id or v_job.lease_expires_at is null or v_job.lease_expires_at<=now() then raise exception using errcode='55000',message='Legal disclosure job is not actively leased to this worker.'; end if;
  select * into v_package from messaging.legal_disclosure_packages where generation_job_id=p_job_id for update;
  if not found or v_package.status<>'generating' or v_package.selection_fingerprint is distinct from v_job.input_payload->>'selection_fingerprint' then raise exception using errcode='55000',message='Legal disclosure package no longer matches its leased job.'; end if;
  if v_package.generated_at is not null then return jsonb_build_object('legal_disclosure_package_id',v_package.id,'status',v_package.status,'manifest_sha256',v_package.manifest_sha256,'package_sha256',v_package.package_sha256,'package_file_object_id',v_package.package_file_object_id); end if;
  v_manifest_text:=p_result->>'manifest_text'; v_manifest_sha:=lower(p_result->>'manifest_sha256'); v_package_sha:=lower(p_result->>'package_sha256'); v_storage_path:=p_result->>'storage_path'; v_objects:=p_result->'objects';
  begin v_package_size:=(p_result->>'package_byte_size')::bigint; exception when others then raise exception using errcode='22023',message='Legal disclosure package byte size is invalid.'; end;
  v_expected_path:=messaging.legal_package_storage_path_v1(v_package.legal_request_case_id,v_package.id);
  if nullif(v_manifest_text,'') is null or octet_length(v_manifest_text)>1048576 or v_manifest_sha !~ '^[0-9a-f]{64}$' or messaging.legal_sha256_text_v1(v_manifest_text)<>v_manifest_sha or v_package_sha !~ '^[0-9a-f]{64}$' or v_package_size<0 or v_storage_path is distinct from v_expected_path or jsonb_typeof(v_objects)<>'array' then raise exception using errcode='22023',message='Legal disclosure generated integrity result is invalid.'; end if;
  select count(*) into v_object_count from messaging.legal_disclosure_objects where legal_disclosure_package_id=v_package.id;
  select count(*) into v_result_count from jsonb_array_elements(v_objects);
  if v_result_count<>v_object_count then raise exception using errcode='22023',message='Legal disclosure object result count is incomplete.'; end if;
  for v_item in select value from jsonb_array_elements(v_objects)
  loop
    select * into v_entry from messaging.legal_disclosure_objects where id=nullif(v_item->>'legal_disclosure_object_id','')::uuid and legal_disclosure_package_id=v_package.id for update;
    if not found or v_entry.finalized_at is not null then raise exception using errcode='55000',message='Legal disclosure object result is not a pending selected object.'; end if;
    v_output_path:=v_item->>'output_path'; v_output_mime:=v_item->>'output_mime_type'; v_hash:=lower(v_item->>'object_sha256');
    begin v_size:=(v_item->>'object_byte_size')::bigint; exception when others then raise exception using errcode='22023',message='Legal disclosure object byte size is invalid.'; end;
    if v_output_path is distinct from messaging.legal_disclosure_output_path_v1(v_entry.manifest_order,v_entry.object_kind,v_entry.legal_preserved_object_id)
       or nullif(btrim(v_output_mime),'') is null or octet_length(v_output_mime)>200
       or v_hash !~ '^[0-9a-f]{64}$' or v_size<0
    then raise exception using errcode='22023',message='Legal disclosure object integrity result is invalid.'; end if;
    if v_entry.object_kind='media_file' and not exists(
      select 1 from messaging.legal_preserved_objects o join media.file_objects f on f.id=o.media_file_object_id
      where o.id=v_entry.legal_preserved_object_id and f.sha256=v_hash and f.byte_size=v_size and f.verification_state='verified' and f.storage_provider='lightsail_media'
    ) then raise exception using errcode='55000',message='Legal Media object bytes do not match verified canonical Media authority.'; end if;
    update messaging.legal_disclosure_objects set output_path=v_output_path,output_mime_type=v_output_mime,object_sha256=v_hash,object_byte_size=v_size,finalized_at=v_job.created_at where id=v_entry.id;
  end loop;
  select * into v_existing from media.file_objects where storage_provider='lightsail_media' and coalesce(storage_namespace,'')='lightsail-media' and storage_path=v_expected_path;
  if found then
    if v_existing.verification_state<>'verified' or v_existing.sha256 is distinct from v_package_sha or v_existing.byte_size is distinct from v_package_size or v_existing.mime_type<>'application/zip' then raise exception using errcode='55000',message='Immutable Legal disclosure storage path collides with different canonical bytes.'; end if;
    v_file_id:=v_existing.id;
  else
    v_file_id:=gen_random_uuid();
    insert into media.file_objects(
      id,sha256,byte_size,mime_type,original_filename,file_extension,storage_provider,storage_namespace,storage_path,delivery_url,technical_metadata,verification_state,verified_by,verified_at,verification_error,ingested_by
    ) values (
      v_file_id,v_package_sha,v_package_size,'application/zip','wakilisha-legal-disclosure-'||v_package.id::text||'.zip','zip','lightsail_media','lightsail-media',v_expected_path,
      'https://media.wakilisha.africa/__private/media-file/'||v_expected_path,
      jsonb_build_object('legal_disclosure_package_id',v_package.id,'manifest_sha256',v_manifest_sha,'archive_version',v_package.archive_version),
      'verified',v_package.requested_by_user_id,v_job.created_at,null,v_package.requested_by_user_id
    );
    insert into media.events(file_object_id,event_type,actor_id,reason,resulting_state,correlation_id)
    values
      (v_file_id,'file_object_registered',v_package.requested_by_user_id,'Restricted Legal disclosure package registered by Candidate C completion authority',jsonb_build_object('storage_provider','lightsail_media','storage_namespace','lightsail-media','storage_path',v_expected_path,'verification_state','verified'),nullif(v_job.input_payload->>'correlation_id','')::uuid),
      (v_file_id,'file_object_verified',v_package.requested_by_user_id,'Legal disclosure archive checksum verified by Candidate C worker',jsonb_build_object('sha256',v_package_sha,'byte_size',v_package_size,'mime_type','application/zip','verification_state','verified'),nullif(v_job.input_payload->>'correlation_id','')::uuid);
  end if;
  v_asset_id:=v_package.id;
  if not exists(select 1 from media.assets where id=v_asset_id) then
    v_governance_id:=gen_random_uuid(); v_revision_id:=gen_random_uuid(); v_actor:=v_package.requested_by_user_id;
    insert into media.assets(id,asset_kind,asset_purpose,title,lifecycle_state,current_governance_version_id,authority_revision,created_by,updated_by)
    values(v_asset_id,'document','legal_disclosure','Legal disclosure '||v_package.production_reference,'active',null,1,v_actor,v_actor);
    insert into media.asset_governance_versions(
      id,asset_id,version_number,rights_status,consent_status,sensitivity,embargo_state,source_protection_class,preservation_state,retention_state,public_safety_state,internal_reason,created_by
    ) values(v_governance_id,v_asset_id,1,'unknown','unknown','high','none','restricted','preserved','retain','internal','Generated Legal disclosure package. Restricted and not public.',v_actor);
    update media.assets set current_governance_version_id=v_governance_id where id=v_asset_id;
    insert into media.asset_revisions(id,asset_id,revision_number,original_file_object_id,previous_revision_id,replacement_reason,created_by)
    values(v_revision_id,v_asset_id,1,v_file_id,null,'Initial immutable Legal disclosure package',v_actor);
    update media.assets set current_revision_id=v_revision_id,authority_revision=2,updated_by=v_actor,updated_at=now() where id=v_asset_id;
    insert into media.events(asset_id,event_type,actor_id,reason,resulting_state,correlation_id)
    values(v_asset_id,'asset_created',v_actor,'Restricted Legal disclosure Media asset created',jsonb_build_object('asset_kind','document','asset_purpose','legal_disclosure','authority_revision',1),nullif(v_job.input_payload->>'correlation_id','')::uuid);
    insert into media.events(asset_id,governance_version_id,event_type,actor_id,reason,resulting_state,correlation_id)
    values(v_asset_id,v_governance_id,'governance_version_created',v_actor,'Initial restricted Legal disclosure Media governance created',jsonb_build_object('version_number',1,'public_safety_state','internal','source_protection_class','restricted'),nullif(v_job.input_payload->>'correlation_id','')::uuid);
    insert into media.events(asset_id,asset_revision_id,file_object_id,event_type,actor_id,reason,resulting_state,correlation_id)
    values(v_asset_id,v_revision_id,v_file_id,'asset_revision_created',v_actor,'Initial immutable Legal disclosure package',jsonb_build_object('revision_number',1,'previous_revision_id',null,'file_object_id',v_file_id),nullif(v_job.input_payload->>'correlation_id','')::uuid);
    insert into media.events(asset_id,asset_revision_id,file_object_id,event_type,actor_id,reason,prior_state,resulting_state,correlation_id)
    values(v_asset_id,v_revision_id,v_file_id,'asset_revision_activated',v_actor,'Initial immutable Legal disclosure package',jsonb_build_object('current_revision_id',null,'authority_revision',1),jsonb_build_object('current_revision_id',v_revision_id,'authority_revision',2),nullif(v_job.input_payload->>'correlation_id','')::uuid);
  else
    select current_revision_id into v_revision_id from media.assets where id=v_asset_id;
    if not exists(select 1 from media.asset_revisions where id=v_revision_id and original_file_object_id=v_file_id) then raise exception using errcode='55000',message='Existing Legal disclosure Media asset does not bind the exact generated file.'; end if;
  end if;
  update messaging.legal_disclosure_packages
  set status='generated',generated_at=v_job.created_at,manifest_text=v_manifest_text,manifest_sha256=v_manifest_sha,
      package_asset_id=v_asset_id,package_asset_revision_id=v_revision_id,package_file_object_id=v_file_id,
      package_sha256=v_package_sha,package_byte_size=v_package_size,failure_summary=null,revision=revision+1
  where id=v_package.id;
  perform messaging.append_legal_case_event_v1(v_package.legal_request_case_id,v_package.id,null,'disclosure_generated',v_package.requested_by_user_id,null,'automation','messages.legal.disclosure.generate',v_job.command_receipt_id,jsonb_build_object('job_id',v_job.id,'manifest_sha256',v_manifest_sha,'package_sha256',v_package_sha,'package_byte_size',v_package_size,'package_file_object_id',v_file_id));
  v_final_result:=jsonb_build_object('legal_disclosure_package_id',v_package.id,'legal_request_case_id',v_package.legal_request_case_id,'manifest_sha256',v_manifest_sha,'package_sha256',v_package_sha,'package_byte_size',v_package_size,'package_file_object_id',v_file_id,'status','generated');
  select * into v_completed from platform_private.complete_job(p_job_id,p_worker_id,v_final_result);
  return v_final_result || jsonb_build_object('success_event_id',v_completed.success_event_id);
end
$fn$;

-- ---------------------------------------------------------------------------
-- Worker failure and scoped expired-lease recovery.
-- ---------------------------------------------------------------------------

create or replace function public.fail_messages_legal_disclosure_job_v1(
  p_job_id uuid,
  p_worker_id text,
  p_error text,
  p_retryable boolean default true,
  p_retry_delay_seconds integer default 60
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,auth,messaging,platform_private
as $fn$
declare
  v_job platform_private.jobs%rowtype; v_package messaging.legal_disclosure_packages%rowtype; v_failed record;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception using errcode='42501',message='Service-role access is required.'; end if;
  select * into v_job from platform_private.jobs where id=p_job_id;
  if not found or v_job.command_type<>'messages.legal.disclosure.generate' or v_job.job_type<>'messages.legal.disclosure.generate' then raise exception using errcode='42501',message='Requested job is not a Legal disclosure generation job.'; end if;
  select * into v_package from messaging.legal_disclosure_packages where generation_job_id=p_job_id;
  select * into v_failed from platform_private.fail_job(p_job_id,p_worker_id,p_error,p_retryable,p_retry_delay_seconds);
  update messaging.legal_disclosure_packages set status=case when v_failed.job_status='dead_letter' then 'failed' else 'queued' end,failure_summary=left(p_error,8192),revision=revision+1 where id=v_package.id;
  perform messaging.append_legal_case_event_v1(v_package.legal_request_case_id,v_package.id,null,'disclosure_failed',null,null,'automation','messages.legal.disclosure.generate',v_job.command_receipt_id,jsonb_build_object('job_id',p_job_id,'job_status',v_failed.job_status,'retryable',p_retryable,'error',left(p_error,4000)));
  return jsonb_build_object('job_id',p_job_id,'job_status',v_failed.job_status,'command_receipt_status',v_failed.command_receipt_status,'outbox_event_id',v_failed.outbox_event_id,'legal_disclosure_package_id',v_package.id);
end
$fn$;

create or replace function public.recover_expired_messages_legal_disclosure_jobs_v1(
  p_limit integer default 10,
  p_retry_delay_seconds integer default 60
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,auth,messaging,platform_private
as $fn$
declare
  v_job platform_private.jobs%rowtype; v_count integer:=0; v_terminal boolean; v_event_type text; v_event_id uuid; v_package messaging.legal_disclosure_packages%rowtype;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception using errcode='42501',message='Service-role access is required.'; end if;
  if p_limit not between 1 and 50 or p_retry_delay_seconds not between 1 and 86400 then raise exception using errcode='22023',message='Legal disclosure recovery input is invalid.'; end if;
  for v_job in
    select j.* from platform_private.jobs j
    where j.command_type='messages.legal.disclosure.generate' and j.job_type='messages.legal.disclosure.generate'
      and j.status='running' and j.lease_expires_at is not null and j.lease_expires_at<=now()
    order by j.lease_expires_at,j.created_at
    for update skip locked limit p_limit
  loop
    v_terminal:=v_job.attempt_count>=v_job.max_attempts;
    if v_terminal then
      update platform_private.jobs set status='dead_letter',locked_by=null,locked_at=null,lease_expires_at=null,finished_at=now(),last_error='Legal disclosure worker lease expired and attempts were exhausted.' where id=v_job.id;
      update platform_private.command_receipts set status='failed',error_code='job_failed',error_message='Legal disclosure worker lease expired and attempts were exhausted.',completed_at=now() where id=v_job.command_receipt_id;
      select failure_event_type into v_event_type from platform_private.command_types where command_type=v_job.command_type;
      insert into platform_private.outbox_events(event_key,command_receipt_id,job_id,command_type,aggregate_id,event_type,payload)
      values('command:'||v_job.command_receipt_id::text||':failed',v_job.command_receipt_id,v_job.id,v_job.command_type,v_job.resource_id,v_event_type,jsonb_build_object('command_receipt_id',v_job.command_receipt_id,'job_id',v_job.id,'resource_id',v_job.resource_id,'error','Legal disclosure worker lease expired and attempts were exhausted.','failed_at',now())) returning id into v_event_id;
    else
      update platform_private.jobs set status='retry_wait',available_at=now()+make_interval(secs=>p_retry_delay_seconds),locked_by=null,locked_at=null,lease_expires_at=null,last_error='Legal disclosure worker lease expired.' where id=v_job.id;
      select retry_event_type into v_event_type from platform_private.command_types where command_type=v_job.command_type;
      insert into platform_private.outbox_events(event_key,command_receipt_id,job_id,command_type,aggregate_id,event_type,payload)
      values('job:'||v_job.id::text||':retry:'||v_job.attempt_count::text,v_job.command_receipt_id,v_job.id,v_job.command_type,v_job.resource_id,v_event_type,jsonb_build_object('command_receipt_id',v_job.command_receipt_id,'job_id',v_job.id,'resource_id',v_job.resource_id,'attempt_count',v_job.attempt_count,'error','Legal disclosure worker lease expired.','available_at',now()+make_interval(secs=>p_retry_delay_seconds))) returning id into v_event_id;
    end if;
    select * into v_package from messaging.legal_disclosure_packages where generation_job_id=v_job.id;
    if found then
      update messaging.legal_disclosure_packages set status=case when v_terminal then 'failed' else 'queued' end,failure_summary=case when v_terminal then 'Legal disclosure worker lease expired and attempts were exhausted.' else 'Legal disclosure worker lease expired.' end,revision=revision+1 where id=v_package.id;
      perform messaging.append_legal_case_event_v1(v_package.legal_request_case_id,v_package.id,null,'disclosure_failed',null,null,'automation','messages.legal.disclosure.generate',v_job.command_receipt_id,jsonb_build_object('job_id',v_job.id,'expired_lease',true,'terminal',v_terminal,'outbox_event_id',v_event_id));
    end if;
    v_count:=v_count+1;
  end loop;
  return jsonb_build_object('recovered_jobs',v_count);
end
$fn$;

-- ---------------------------------------------------------------------------
-- Explicit release and void.
-- ---------------------------------------------------------------------------

create or replace function public.release_messages_legal_disclosure_v1(
  p_package_id uuid,
  p_expected_revision bigint,
  p_reason text,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,auth,public,editorial,messaging,platform_private
as $fn$
declare
  v_admin record; v_package messaging.legal_disclosure_packages%rowtype; v_correlation uuid; v_begin record; v_result jsonb;
begin
  select * into v_admin from messaging.require_messages_legal_capability('approve_messages_legal_disclosure');
  if nullif(btrim(p_reason),'') is null or octet_length(p_reason)>8192 then raise exception using errcode='22023',message='Legal disclosure release reason is required.'; end if;
  v_correlation:=messaging.command_correlation(v_admin.user_id,'messages.legal.disclosure.release',p_idempotency_key,p_correlation_id);
  select * into v_begin from platform_private.begin_authenticated_resource_command('messages.legal.disclosure.release',v_admin.person_resource_id,p_idempotency_key,jsonb_build_object('package_id',p_package_id,'expected_revision',p_expected_revision,'reason',btrim(p_reason),'correlation_id',v_correlation));
  if v_begin.idempotent_replay then return v_begin.result_payload; end if;
  select * into v_package from messaging.legal_disclosure_packages where id=p_package_id for update;
  if not found then raise exception using errcode='P0002',message='Legal disclosure package does not exist.'; end if;
  if v_package.revision<>p_expected_revision then raise exception using errcode='40001',message='Legal disclosure package revision is stale.'; end if;
  if v_package.status<>'generated' then raise exception using errcode='55000',message='Only generated Legal disclosure packages may be released.'; end if;
  if not exists(select 1 from messaging.legal_disclosure_approvals a where a.legal_disclosure_package_id=p_package_id and a.approval_scope='package' and a.status='active' and a.selection_fingerprint=v_package.selection_fingerprint) then raise exception using errcode='55000',message='Active exact-fingerprint package approval is required for release.'; end if;
  update messaging.legal_disclosure_packages set status='released',released_by_user_id=v_admin.user_id,released_at=now(),revision=revision+1 where id=p_package_id;
  perform messaging.append_legal_case_event_v1(v_package.legal_request_case_id,p_package_id,null,'disclosure_released',v_admin.user_id,v_admin.person_resource_id,'human',null,v_begin.command_receipt_id,jsonb_build_object('reason',btrim(p_reason),'manifest_sha256',v_package.manifest_sha256,'package_sha256',v_package.package_sha256,'correlation_id',v_correlation));
  v_result:=jsonb_build_object('legal_disclosure_package_id',p_package_id,'status','released','revision',p_expected_revision+1,'package_file_object_id',v_package.package_file_object_id,'command_receipt_id',v_begin.command_receipt_id,'correlation_id',v_correlation);
  perform platform_private.complete_resource_command(v_begin.command_receipt_id,v_result); return v_result;
end
$fn$;

create or replace function public.void_messages_legal_disclosure_v1(
  p_package_id uuid,
  p_expected_revision bigint,
  p_reason text,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,auth,public,editorial,messaging,platform_private
as $fn$
declare
  v_admin record; v_package messaging.legal_disclosure_packages%rowtype; v_correlation uuid; v_begin record; v_result jsonb;
begin
  select * into v_admin from messaging.require_messages_legal_capability('approve_messages_legal_disclosure');
  if nullif(btrim(p_reason),'') is null or octet_length(p_reason)>8192 then raise exception using errcode='22023',message='Legal disclosure void reason is required.'; end if;
  v_correlation:=messaging.command_correlation(v_admin.user_id,'messages.legal.disclosure.void',p_idempotency_key,p_correlation_id);
  select * into v_begin from platform_private.begin_authenticated_resource_command('messages.legal.disclosure.void',v_admin.person_resource_id,p_idempotency_key,jsonb_build_object('package_id',p_package_id,'expected_revision',p_expected_revision,'reason',btrim(p_reason),'correlation_id',v_correlation));
  if v_begin.idempotent_replay then return v_begin.result_payload; end if;
  select * into v_package from messaging.legal_disclosure_packages where id=p_package_id for update;
  if not found then raise exception using errcode='P0002',message='Legal disclosure package does not exist.'; end if;
  if v_package.revision<>p_expected_revision then raise exception using errcode='40001',message='Legal disclosure package revision is stale.'; end if;
  if v_package.status not in ('draft','approved','failed','generated') then raise exception using errcode='55000',message='Legal disclosure package cannot be voided in its current state.'; end if;
  update messaging.legal_disclosure_packages set status='voided',voided_by_user_id=v_admin.user_id,voided_at=now(),void_reason=btrim(p_reason),revision=revision+1 where id=p_package_id;
  perform messaging.append_legal_case_event_v1(v_package.legal_request_case_id,p_package_id,null,'disclosure_voided',v_admin.user_id,v_admin.person_resource_id,'human',null,v_begin.command_receipt_id,jsonb_build_object('reason',btrim(p_reason),'prior_status',v_package.status,'correlation_id',v_correlation));
  v_result:=jsonb_build_object('legal_disclosure_package_id',p_package_id,'status','voided','revision',p_expected_revision+1,'command_receipt_id',v_begin.command_receipt_id,'correlation_id',v_correlation);
  perform platform_private.complete_resource_command(v_begin.command_receipt_id,v_result); return v_result;
end
$fn$;

-- ---------------------------------------------------------------------------
-- Close case only after all holds are resolved and no active generation exists.
-- ---------------------------------------------------------------------------

create or replace function public.close_messages_legal_request_case_v1(
  p_case_id uuid,
  p_expected_revision bigint,
  p_closure_note text,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,auth,public,editorial,messaging,platform_private
as $fn$
declare
  v_admin record; v_case messaging.legal_request_cases%rowtype; v_correlation uuid; v_begin record; v_result jsonb;
begin
  select * into v_admin from messaging.require_messages_legal_capability('manage_messages_legal_cases');
  if nullif(btrim(p_closure_note),'') is null or octet_length(p_closure_note)>8192 then raise exception using errcode='22023',message='Legal case closure note is required.'; end if;
  v_correlation:=messaging.command_correlation(v_admin.user_id,'messages.legal.case.close',p_idempotency_key,p_correlation_id);
  select * into v_begin from platform_private.begin_authenticated_resource_command('messages.legal.case.close',v_admin.person_resource_id,p_idempotency_key,jsonb_build_object('case_id',p_case_id,'expected_revision',p_expected_revision,'closure_note',btrim(p_closure_note),'correlation_id',v_correlation));
  if v_begin.idempotent_replay then return v_begin.result_payload; end if;
  select * into v_case from messaging.legal_request_cases where id=p_case_id for update;
  if not found then raise exception using errcode='P0002',message='Legal Request Case does not exist.'; end if;
  if v_case.revision<>p_expected_revision then raise exception using errcode='40001',message='Legal Request Case revision is stale.'; end if;
  if v_case.status<>'under_review' then raise exception using errcode='55000',message='Only a Legal Request Case under review may close.'; end if;
  if exists(select 1 from messaging.legal_preserved_objects where legal_request_case_id=p_case_id and preservation_status='held') then raise exception using errcode='55000',message='Legal Request Case cannot close while preservation holds remain active.'; end if;
  if exists(select 1 from messaging.legal_disclosure_packages where legal_request_case_id=p_case_id and status in ('queued','generating')) then raise exception using errcode='55000',message='Legal Request Case cannot close while disclosure generation is active.'; end if;
  update messaging.legal_request_cases set status='closed',closed_by_user_id=v_admin.user_id,closed_at=now(),closure_note=btrim(p_closure_note),revision=revision+1,updated_at=now() where id=p_case_id;
  perform messaging.append_legal_case_event_v1(p_case_id,null,null,'case_closed',v_admin.user_id,v_admin.person_resource_id,'human',null,v_begin.command_receipt_id,jsonb_build_object('closure_note',btrim(p_closure_note),'correlation_id',v_correlation));
  v_result:=jsonb_build_object('legal_request_case_id',p_case_id,'status','closed','revision',p_expected_revision+1,'command_receipt_id',v_begin.command_receipt_id,'correlation_id',v_correlation);
  perform platform_private.complete_resource_command(v_begin.command_receipt_id,v_result); return v_result;
end
$fn$;

-- ---------------------------------------------------------------------------
-- Released Legal package delivery is case-bound and purpose-audited.
-- Generic Media private delivery remains unchanged from accepted Media authority.
-- ---------------------------------------------------------------------------

create or replace function public.get_messages_legal_disclosure_delivery_target_v1(
  p_package_id uuid,
  p_purpose text,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,auth,public,editorial,messaging,media,platform_private
as $fn$
declare
  v_admin record;
  v_package messaging.legal_disclosure_packages%rowtype;
  v_file media.file_objects%rowtype;
  v_correlation uuid;
  v_begin record;
  v_expected_path text;
  v_result jsonb;
begin
  select * into v_admin
  from messaging.require_messages_legal_capability('inspect_messages_legal_evidence');

  if p_package_id is null
     or nullif(btrim(p_purpose),'') is null
     or octet_length(p_purpose)>4096
  then
    raise exception using errcode='22023',message='Legal disclosure delivery input is invalid.';
  end if;

  v_correlation:=messaging.command_correlation(
    v_admin.user_id,
    'messages.legal.evidence.inspect',
    p_idempotency_key,
    p_correlation_id
  );

  select * into v_begin
  from platform_private.begin_authenticated_resource_command(
    'messages.legal.evidence.inspect',
    v_admin.person_resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'operation','released_legal_package_delivery',
      'package_id',p_package_id,
      'purpose',btrim(p_purpose),
      'correlation_id',v_correlation
    )
  );

  if v_begin.idempotent_replay then
    return v_begin.result_payload;
  end if;

  select * into v_package
  from messaging.legal_disclosure_packages
  where id=p_package_id;

  if not found then
    raise exception using errcode='P0002',message='Legal disclosure package does not exist.';
  end if;

  if v_package.status<>'released'
     or v_package.package_file_object_id is null
     or v_package.package_asset_id is null
     or v_package.package_asset_revision_id is null
  then
    raise exception using errcode='42501',message='Legal disclosure package is not released for delivery.';
  end if;

  select * into v_file
  from media.file_objects
  where id=v_package.package_file_object_id;

  if not found then
    raise exception using errcode='P0002',message='Canonical Legal disclosure Media file does not exist.';
  end if;

  v_expected_path:=messaging.legal_package_storage_path_v1(
    v_package.legal_request_case_id,
    v_package.id
  );

  if v_file.verification_state<>'verified'
     or v_file.storage_provider<>'lightsail_media'
     or v_file.storage_path is distinct from v_expected_path
     or v_file.storage_path !~ '^private-files/legal-disclosures/[0-9a-f-]{36}/[0-9a-f-]{36}/production[.]zip$'
     or v_file.sha256 is distinct from v_package.package_sha256
     or v_file.byte_size is distinct from v_package.package_byte_size
  then
    raise exception using errcode='55000',message='Released Legal disclosure Media identity is invalid.';
  end if;

  if not exists(
    select 1
    from media.asset_revisions revision
    where revision.id=v_package.package_asset_revision_id
      and revision.asset_id=v_package.package_asset_id
      and revision.original_file_object_id=v_file.id
  ) then
    raise exception using errcode='55000',message='Released Legal disclosure Media revision binding is invalid.';
  end if;

  if not exists(
    select 1
    from media.assets asset
    join media.asset_governance_versions governance
      on governance.id=asset.current_governance_version_id
     and governance.asset_id=asset.id
    where asset.id=v_package.package_asset_id
      and asset.asset_kind='document'
      and asset.asset_purpose='legal_disclosure'
      and asset.lifecycle_state='active'
      and asset.current_revision_id=v_package.package_asset_revision_id
      and governance.source_protection_class in ('restricted','confidential')
      and governance.preservation_state='preserved'
      and governance.retention_state='retain'
      and governance.public_safety_state='internal'
  ) then
    raise exception using errcode='55000',message='Released Legal disclosure Media governance is not restricted.';
  end if;

  perform messaging.assert_media_file_not_safety_contained_v1(v_file.id);

  perform messaging.append_legal_case_event_v1(
    v_package.legal_request_case_id,
    v_package.id,
    null,
    'evidence_viewed',
    v_admin.user_id,
    v_admin.person_resource_id,
    'human',
    null,
    v_begin.command_receipt_id,
    jsonb_build_object(
      'purpose',btrim(p_purpose),
      'operation','released_legal_package_delivery',
      'media_file_object_id',v_file.id,
      'package_sha256',v_package.package_sha256,
      'correlation_id',v_correlation
    )
  );

  v_result:=jsonb_build_object(
    'legal_request_case_id',v_package.legal_request_case_id,
    'legal_disclosure_package_id',v_package.id,
    'file_object_id',v_file.id,
    'storage_path',v_file.storage_path,
    'original_filename',v_file.original_filename,
    'mime_type',v_file.mime_type,
    'byte_size',v_file.byte_size,
    'sha256',v_file.sha256,
    'verification_state',v_file.verification_state,
    'command_receipt_id',v_begin.command_receipt_id,
    'correlation_id',v_correlation
  );

  perform platform_private.complete_resource_command(
    v_begin.command_receipt_id,
    v_result
  );

  return v_result;
end
$fn$;

-- ---------------------------------------------------------------------------
-- Function grants. Human RPCs are authenticated only. Worker RPCs service only.
-- ---------------------------------------------------------------------------

revoke all on function messaging.guard_legal_disclosure_media_file_v1() from public,anon,authenticated,service_role;
revoke all on function messaging.guard_legal_disclosure_media_asset_v1() from public,anon,authenticated,service_role;
revoke all on function messaging.guard_legal_disclosure_media_governance_v1() from public,anon,authenticated,service_role;
revoke all on function messaging.guard_legal_disclosure_media_revision_v1() from public,anon,authenticated,service_role;
revoke all on function messaging.guard_legal_disclosure_media_variant_v1() from public,anon,authenticated,service_role;
revoke all on function messaging.guard_legal_disclosure_media_usage_v1() from public,anon,authenticated,service_role;

revoke all on function messaging.require_messages_legal_capability(text) from public,anon,authenticated,service_role;
revoke all on function messaging.append_legal_case_event_v1(uuid,uuid,uuid,text,uuid,uuid,text,text,uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function messaging.legal_selection_fingerprint_v1(uuid) from public,anon,authenticated,service_role;
revoke all on function messaging.legal_object_required_by_active_scope_v1(uuid) from public,anon,authenticated,service_role;

revoke all on function public.list_messages_legal_cases_v1(text,integer) from public,anon,service_role;
grant execute on function public.list_messages_legal_cases_v1(text,integer) to authenticated;
revoke all on function public.get_messages_legal_case_v1(uuid) from public,anon,service_role;
grant execute on function public.get_messages_legal_case_v1(uuid) to authenticated;
revoke all on function public.list_messages_legal_preserved_objects_v1(uuid,text,text,integer) from public,anon,service_role;
grant execute on function public.list_messages_legal_preserved_objects_v1(uuid,text,text,integer) to authenticated;
revoke all on function public.get_messages_legal_disclosure_package_v1(uuid) from public,anon,service_role;
grant execute on function public.get_messages_legal_disclosure_package_v1(uuid) to authenticated;
revoke all on function public.open_messages_legal_request_case_v1(text,text,text,text,timestamptz,text,text,uuid,text,uuid) from public,anon,service_role;
grant execute on function public.open_messages_legal_request_case_v1(text,text,text,text,timestamptz,text,text,uuid,text,uuid) to authenticated;
revoke all on function public.start_messages_legal_review_v1(uuid,bigint,uuid,text,text,uuid) from public,anon,service_role;
grant execute on function public.start_messages_legal_review_v1(uuid,bigint,uuid,text,text,uuid) to authenticated;
revoke all on function public.update_messages_legal_scope_v1(uuid,text,uuid,text,uuid,uuid,timestamptz,timestamptz,uuid,uuid,text,bigint,text,text,uuid) from public,anon,service_role;
grant execute on function public.update_messages_legal_scope_v1(uuid,text,uuid,text,uuid,uuid,timestamptz,timestamptz,uuid,uuid,text,bigint,text,text,uuid) to authenticated;
revoke all on function public.materialize_messages_legal_preservation_v1(uuid,uuid,bigint,text,text,uuid) from public,anon,service_role;
grant execute on function public.materialize_messages_legal_preservation_v1(uuid,uuid,bigint,text,text,uuid) to authenticated;
revoke all on function public.release_messages_legal_preservation_v1(uuid,uuid,bigint,text,text,uuid) from public,anon,service_role;
grant execute on function public.release_messages_legal_preservation_v1(uuid,uuid,bigint,text,text,uuid) to authenticated;
revoke all on function public.classify_messages_legal_object_v1(uuid,uuid,bigint,text,text,text,uuid) from public,anon,service_role;
grant execute on function public.classify_messages_legal_object_v1(uuid,uuid,bigint,text,text,text,uuid) to authenticated;
revoke all on function public.inspect_message_legal_evidence_v1(uuid,uuid,text,text,uuid) from public,anon,service_role;
grant execute on function public.inspect_message_legal_evidence_v1(uuid,uuid,text,text,uuid) to authenticated;
revoke all on function public.prepare_messages_legal_disclosure_v1(uuid,text,text,text[],uuid[],text,uuid) from public,anon,service_role;
grant execute on function public.prepare_messages_legal_disclosure_v1(uuid,text,text,text[],uuid[],text,uuid) to authenticated;
revoke all on function public.update_messages_legal_disclosure_approval_v1(uuid,text,uuid,bigint,text,text,text,uuid) from public,anon,service_role;
grant execute on function public.update_messages_legal_disclosure_approval_v1(uuid,text,uuid,bigint,text,text,text,uuid) to authenticated;
revoke all on function public.submit_messages_legal_disclosure_generation_v1(uuid,bigint,text,uuid) from public,anon,service_role;
grant execute on function public.submit_messages_legal_disclosure_generation_v1(uuid,bigint,text,uuid) to authenticated;
revoke all on function public.release_messages_legal_disclosure_v1(uuid,bigint,text,text,uuid) from public,anon,service_role;
grant execute on function public.release_messages_legal_disclosure_v1(uuid,bigint,text,text,uuid) to authenticated;
revoke all on function public.void_messages_legal_disclosure_v1(uuid,bigint,text,text,uuid) from public,anon,service_role;
grant execute on function public.void_messages_legal_disclosure_v1(uuid,bigint,text,text,uuid) to authenticated;
revoke all on function public.close_messages_legal_request_case_v1(uuid,bigint,text,text,uuid) from public,anon,service_role;
grant execute on function public.close_messages_legal_request_case_v1(uuid,bigint,text,text,uuid) to authenticated;

revoke all on function public.claim_messages_legal_disclosure_jobs_v1(text,integer,integer) from public,anon,authenticated;
grant execute on function public.claim_messages_legal_disclosure_jobs_v1(text,integer,integer) to service_role;
revoke all on function public.renew_messages_legal_disclosure_lease_v1(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.renew_messages_legal_disclosure_lease_v1(uuid,text,integer) to service_role;
revoke all on function public.get_messages_legal_disclosure_plan_v1(uuid,text) from public,anon,authenticated;
grant execute on function public.get_messages_legal_disclosure_plan_v1(uuid,text) to service_role;
revoke all on function public.get_messages_legal_disclosure_source_v1(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.get_messages_legal_disclosure_source_v1(uuid,text,uuid) to service_role;
revoke all on function public.complete_messages_legal_disclosure_job_v1(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.complete_messages_legal_disclosure_job_v1(uuid,text,jsonb) to service_role;
revoke all on function public.fail_messages_legal_disclosure_job_v1(uuid,text,text,boolean,integer) from public,anon,authenticated;
grant execute on function public.fail_messages_legal_disclosure_job_v1(uuid,text,text,boolean,integer) to service_role;
revoke all on function public.recover_expired_messages_legal_disclosure_jobs_v1(integer,integer) from public,anon,authenticated;
grant execute on function public.recover_expired_messages_legal_disclosure_jobs_v1(integer,integer) to service_role;

revoke all on function public.get_messages_legal_disclosure_delivery_target_v1(uuid,text,text,uuid) from public,anon,service_role;
grant execute on function public.get_messages_legal_disclosure_delivery_target_v1(uuid,text,text,uuid) to authenticated;

comment on table messaging.legal_request_cases is 'Candidate C Legal Request Case peer authority. Separate from Safety Case.';
comment on table messaging.legal_preservation_scopes is 'Finite case-bound Legal preservation scopes. No arbitrary selectors.';
comment on table messaging.legal_preserved_objects is 'Exact canonical objects held and human-classified for one Legal Request Case.';
comment on table messaging.legal_disclosure_packages is 'Exact scoped Legal production identity, frozen manifest hashes, canonical restricted Media artifact, and release state.';
comment on table messaging.legal_disclosure_approvals is 'Explicit exact-selection package and elevated-object Legal approvals.';
comment on table messaging.legal_disclosure_objects is 'Ordered exact Legal package selection and finalized immutable object hash entries.';
comment on table messaging.legal_case_events is 'Append-only canonical Legal Request Case and disclosure history.';

commit;
