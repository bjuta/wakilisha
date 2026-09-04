-- Phase 8A.2A: Field Submission identity foundation.
--
-- Establishes only the private Field Submission aggregate, capability boundary,
-- append-only Field events, safe reads, and non-Media synchronous commands.
--
-- This migration intentionally does not create Field Media intake authority,
-- field_original Media vocabulary, an Edge Function, a public route, Resource
-- Versions, or frontend authority.

begin;

set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'phase-8a-field-submission-identity-foundation',
    0
  )
);

do $phase_8a_field_preflight$
declare
  v_binding_definition text;
begin
  if to_regclass('editorial.resources') is null
     or to_regclass('editorial.resource_kinds') is null
     or to_regclass('public.role_definitions') is null
     or to_regclass('public.capability_definitions') is null
     or to_regclass('public.role_capabilities') is null
     or to_regclass('platform_private.command_types') is null
     or to_regclass('platform_private.command_receipts') is null
     or to_regclass('platform_private.outbox_events') is null
  then
    raise exception
      'STOP: required Resource, authorization, or command authority is incomplete';
  end if;

  if to_regprocedure('public.current_user_is_administrator()') is null
     or to_regprocedure('public.current_user_has_capability(text)') is null
     or to_regprocedure('platform_private.command_actor_context()') is null
     or to_regprocedure(
       'platform_private.command_request_fingerprint(text,uuid,jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.begin_authenticated_resource_command(text,uuid,text,jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.read_authenticated_resource_command_result(uuid,boolean)'
     ) is null
     or to_regprocedure(
       'platform_private.complete_resource_command(uuid,jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.reject_resource_command(uuid,text,text,jsonb)'
     ) is null
     or to_regprocedure(
       'editorial.assert_resource_binding_integrity()'
     ) is null
  then
    raise exception
      'STOP: required authentication, command, or Resource helpers are missing';
  end if;

  if exists (
    select 1
    from editorial.resource_kinds
    where kind = 'field_submission'
  ) then
    raise exception
      'STOP: field_submission Resource kind already exists';
  end if;

  if exists (
    select 1
    from public.role_definitions
    where role_key = 'field_contributor'
  ) then
    raise exception
      'STOP: field_contributor role already exists';
  end if;

  if exists (
    select 1
    from public.capability_definitions
    where capability_key in (
      'submit_field_capture',
      'read_own_field_capture',
      'view_field_intake',
      'view_restricted_field_sources'
    )
  ) then
    raise exception
      'STOP: one or more Field capabilities already exist';
  end if;

  if exists (
    select 1
    from platform_private.command_types
    where command_type in (
      'field.submission.create',
      'field.submission.declarations.update',
      'field.submission.cancel'
    )
  ) then
    raise exception
      'STOP: one or more Phase 8A.2A Field command types already exist';
  end if;

  if to_regclass('editorial.field_submissions') is not null
     or to_regclass('editorial.field_submission_event_types') is not null
     or to_regclass('editorial.field_submission_events') is not null
  then
    raise exception
      'STOP: one or more Phase 8A.2A Field tables already exist';
  end if;

  if exists (
    select 1
    from (
      values
        ('administrator'),
        ('editor'),
        ('reviewer')
    ) required(role_key)
    where not exists (
      select 1
      from public.role_definitions role_row
      where role_row.role_key = required.role_key
    )
  ) then
    raise exception
      'STOP: expected internal editorial role vocabulary is incomplete';
  end if;

  v_binding_definition := pg_get_functiondef(
    'editorial.assert_resource_binding_integrity()'::regprocedure
  );

  if position('when ''article''' in v_binding_definition) = 0
     or position('when ''playlist''' in v_binding_definition) = 0
     or position('when ''registry_artist''' in v_binding_definition) = 0
     or position('when ''correction_case''' in v_binding_definition) = 0
     or position('when ''media_asset''' in v_binding_definition) = 0
     or position('when ''person''' in v_binding_definition) = 0
     or position('when ''organization''' in v_binding_definition) = 0
     or position('when ''audio_show''' in v_binding_definition) = 0
     or position('when ''audio_season''' in v_binding_definition) = 0
     or position('when ''audio_episode''' in v_binding_definition) = 0
     or position('when ''standalone_audio''' in v_binding_definition) = 0
     or position('when ''show''' in v_binding_definition) = 0
     or position('when ''show_episode''' in v_binding_definition) = 0
     or position('when ''video_episode''' in v_binding_definition) = 0
     or position('when ''standalone_video''' in v_binding_definition) = 0
     or position('when ''field_submission''' in v_binding_definition) > 0
  then
    raise exception
      'STOP: Resource binding integrity authority drifted before Field extension';
  end if;
end;
$phase_8a_field_preflight$;

-- ---------------------------------------------------------------------------
-- Role and capability boundary.
-- ---------------------------------------------------------------------------

insert into public.role_definitions (
  role_key,
  label,
  description,
  priority,
  is_system
)
values (
  'field_contributor',
  'Field Contributor',
  'Authenticated contributor permitted to create and resume only their own Field Submissions.',
  115,
  true
);

insert into public.capability_definitions (
  capability_key,
  label,
  description,
  domain
)
values
  (
    'submit_field_capture',
    'Submit field capture',
    'Create and mutate only the caller owned Field Submission intake.',
    'field'
  ),
  (
    'read_own_field_capture',
    'Read own field capture',
    'Read only the caller owned safe Field Submission projection.',
    'field'
  ),
  (
    'view_field_intake',
    'View field intake',
    'Read internal Field Submission intake facts needed for newsroom awareness.',
    'field'
  ),
  (
    'view_restricted_field_sources',
    'View restricted field sources',
    'Resolve contributor identity for restricted Field Submissions.',
    'field'
  );

insert into public.role_capabilities (
  role_key,
  capability_key
)
values
  ('field_contributor', 'submit_field_capture'),
  ('field_contributor', 'read_own_field_capture'),

  ('administrator', 'submit_field_capture'),
  ('administrator', 'read_own_field_capture'),
  ('administrator', 'view_field_intake'),
  ('administrator', 'view_restricted_field_sources'),

  ('editor', 'view_field_intake'),
  ('editor', 'view_restricted_field_sources'),

  ('reviewer', 'view_field_intake');

-- ---------------------------------------------------------------------------
-- Stable private Resource identity and Field tables.
-- ---------------------------------------------------------------------------

insert into editorial.resource_kinds (
  kind,
  label,
  description,
  enabled
)
values (
  'field_submission',
  'Field Submission',
  'Private governed contributor intake identity for one Field Submission.',
  true
);

create table editorial.field_submission_event_types (
  event_type text primary key,
  label text not null,
  description text not null,
  enabled boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),

  constraint field_submission_event_types_key_check
    check (event_type ~ '^[a-z][a-z0-9_]*$'),

  constraint field_submission_event_types_label_check
    check (nullif(btrim(label), '') is not null),

  constraint field_submission_event_types_description_check
    check (nullif(btrim(description), '') is not null)
);

insert into editorial.field_submission_event_types (
  event_type,
  label,
  description,
  sort_order
)
values
  ('submission_created', 'Submission created', 'A Field Submission was created.', 10),
  ('declaration_updated', 'Declaration updated', 'Contributor intake declarations changed.', 20),
  ('upload_session_attached', 'Upload session attached', 'A governed Media upload session was attached.', 30),
  ('upload_resumed', 'Upload resumed', 'A governed Field Media upload resumed.', 40),
  ('media_verified', 'Media verified', 'Field Media completed exact verification.', 50),
  ('media_attached', 'Media attached', 'Verified Media was attached to the Field Submission.', 60),
  ('submission_received', 'Submission received', 'Required Field Media was received.', 70),
  ('submission_finalized', 'Submission finalized', 'The contributor finalized the Field Submission.', 80),
  ('receipt_issued', 'Receipt issued', 'A safe contributor receipt was issued.', 90),
  ('submission_cancelled', 'Submission cancelled', 'The Field Submission was cancelled before final acceptance.', 100),
  ('media_intake_expired', 'Media intake expired', 'One Field Media intake attempt expired.', 110),
  ('submission_expired', 'Submission expired', 'The Field Submission expired under governed inactivity rules.', 120);

create table editorial.field_submissions (
  resource_id uuid primary key,
  resource_kind text not null default 'field_submission',
  submission_reference text not null unique,
  owner_user_id uuid not null,
  submitter_mode text not null default 'authenticated',
  current_revision bigint not null default 1,
  submission_state text not null default 'receiving',

  newsroom_identity_mode text not null default 'standard',
  public_attribution_preference text not null default 'do_not_name',
  contact_preference text not null default 'account_contact',

  rights_declaration text not null,
  rights_declaration_detail text,
  consent_declaration text not null,
  consent_declaration_detail text,

  declared_sensitivity text not null default 'none',
  source_protection_request text not null default 'internal',
  embargo_request_mode text not null default 'none',
  requested_embargo_until timestamptz,
  location_mode text not null default 'not_collected',
  location_description text,
  content_captured_at timestamptz,
  intake_notes text,

  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  received_at timestamptz,
  submitted_at timestamptz,
  cancelled_at timestamptz,
  expired_at timestamptz,
  receipt_issued_at timestamptz,
  correlation_id uuid not null,

  constraint field_submissions_resource_kind_check
    check (resource_kind = 'field_submission'),

  constraint field_submissions_resource_fkey
    foreign key (resource_id, resource_kind)
    references editorial.resources(id, resource_kind)
    on update cascade
    on delete restrict,

  constraint field_submissions_reference_check
    check (
      submission_reference ~ '^FS-[0-9]{8}-[0-9A-F]{10}$'
    ),

  constraint field_submissions_owner_check
    check (owner_user_id = created_by),

  constraint field_submissions_submitter_mode_check
    check (submitter_mode = 'authenticated'),

  constraint field_submissions_revision_check
    check (current_revision >= 1),

  constraint field_submissions_state_check
    check (
      submission_state in (
        'receiving',
        'received',
        'submitted',
        'cancelled',
        'expired'
      )
    ),

  constraint field_submissions_identity_mode_check
    check (newsroom_identity_mode in ('standard', 'restricted')),

  constraint field_submissions_attribution_check
    check (
      public_attribution_preference in ('may_name', 'do_not_name')
    ),

  constraint field_submissions_contact_preference_check
    check (contact_preference in ('account_contact', 'no_follow_up')),

  constraint field_submissions_rights_declaration_check
    check (
      rights_declaration in (
        'owns_or_controls',
        'authorized_by_rights_holder',
        'uncertain',
        'other'
      )
    ),

  constraint field_submissions_consent_declaration_check
    check (
      consent_declaration in (
        'granted',
        'not_required',
        'uncertain',
        'not_obtained'
      )
    ),

  constraint field_submissions_sensitivity_check
    check (
      declared_sensitivity in (
        'none',
        'low',
        'moderate',
        'high',
        'extreme'
      )
    ),

  constraint field_submissions_source_protection_check
    check (
      source_protection_request in (
        'internal',
        'restricted',
        'confidential'
      )
    ),

  constraint field_submissions_embargo_mode_check
    check (
      embargo_request_mode in (
        'none',
        'until_review',
        'until_time'
      )
    ),

  constraint field_submissions_embargo_shape_check
    check (
      (
        embargo_request_mode = 'until_time'
        and requested_embargo_until is not null
      )
      or (
        embargo_request_mode <> 'until_time'
        and requested_embargo_until is null
      )
    ),

  constraint field_submissions_location_mode_check
    check (location_mode in ('not_collected', 'coarse_text')),

  constraint field_submissions_location_shape_check
    check (
      (
        location_mode = 'not_collected'
        and location_description is null
      )
      or (
        location_mode = 'coarse_text'
        and nullif(btrim(location_description), '') is not null
      )
    ),

  constraint field_submissions_text_limits_check
    check (
      length(coalesce(rights_declaration_detail, '')) <= 4000
      and length(coalesce(consent_declaration_detail, '')) <= 4000
      and length(coalesce(location_description, '')) <= 1000
      and length(coalesce(intake_notes, '')) <= 10000
    ),

  constraint field_submissions_lifecycle_timestamps_check
    check (
      (
        submission_state = 'receiving'
        and received_at is null
        and submitted_at is null
        and cancelled_at is null
        and expired_at is null
        and receipt_issued_at is null
      )
      or (
        submission_state = 'received'
        and received_at is not null
        and submitted_at is null
        and cancelled_at is null
        and expired_at is null
        and receipt_issued_at is null
      )
      or (
        submission_state = 'submitted'
        and received_at is not null
        and submitted_at is not null
        and cancelled_at is null
        and expired_at is null
        and receipt_issued_at is not null
      )
      or (
        submission_state = 'cancelled'
        and submitted_at is null
        and cancelled_at is not null
        and expired_at is null
        and receipt_issued_at is null
      )
      or (
        submission_state = 'expired'
        and submitted_at is null
        and cancelled_at is null
        and expired_at is not null
        and receipt_issued_at is null
      )
    )
);

create index field_submissions_owner_created_idx
  on editorial.field_submissions(owner_user_id, created_at desc);

create index field_submissions_state_updated_idx
  on editorial.field_submissions(submission_state, updated_at desc);

create index field_submissions_identity_mode_state_idx
  on editorial.field_submissions(newsroom_identity_mode, submission_state);

create table editorial.field_submission_events (
  id uuid primary key default extensions.gen_random_uuid(),
  submission_resource_id uuid not null,
  event_type text not null,
  actor_user_id uuid,
  command_receipt_id uuid,
  media_intake_id uuid,
  reason text,
  prior_state jsonb,
  resulting_state jsonb,
  correlation_id uuid not null,
  created_at timestamptz not null default now(),

  constraint field_submission_events_submission_fkey
    foreign key (submission_resource_id)
    references editorial.field_submissions(resource_id)
    on update restrict
    on delete restrict,

  constraint field_submission_events_type_fkey
    foreign key (event_type)
    references editorial.field_submission_event_types(event_type)
    on update restrict
    on delete restrict,

  constraint field_submission_events_receipt_fkey
    foreign key (command_receipt_id)
    references platform_private.command_receipts(id)
    on update restrict
    on delete restrict,

  constraint field_submission_events_reason_check
    check (length(coalesce(reason, '')) <= 4000),

  constraint field_submission_events_prior_state_check
    check (
      prior_state is null
      or (
        jsonb_typeof(prior_state) = 'object'
        and octet_length(prior_state::text) <= 65536
      )
    ),

  constraint field_submission_events_resulting_state_check
    check (
      resulting_state is null
      or (
        jsonb_typeof(resulting_state) = 'object'
        and octet_length(resulting_state::text) <= 65536
      )
    ),

  constraint field_submission_events_creation_check
    check (
      event_type <> 'submission_created'
      or (
        actor_user_id is not null
        and command_receipt_id is not null
        and prior_state is null
        and resulting_state is not null
      )
    )
);

create index field_submission_events_submission_created_idx
  on editorial.field_submission_events(
    submission_resource_id,
    created_at,
    id
  );

create index field_submission_events_receipt_idx
  on editorial.field_submission_events(command_receipt_id)
  where command_receipt_id is not null;

-- ---------------------------------------------------------------------------
-- Field aggregate mutation and append-only history invariants.
-- ---------------------------------------------------------------------------

create or replace function editorial.protect_field_submission_mutation()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'editorial'
as $function$
declare
  v_state_changed boolean;
  v_declarations_changed boolean;
begin
  if new.resource_id is distinct from old.resource_id
     or new.resource_kind is distinct from old.resource_kind
     or new.submission_reference is distinct from old.submission_reference
     or new.owner_user_id is distinct from old.owner_user_id
     or new.submitter_mode is distinct from old.submitter_mode
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at
     or new.correlation_id is distinct from old.correlation_id
  then
    raise exception
      'Field Submission identity and creation provenance are immutable.';
  end if;

  if old.submission_state in ('submitted', 'cancelled', 'expired') then
    raise exception
      'Terminal Field Submission state is immutable in Phase 8A.';
  end if;

  if new.current_revision <> old.current_revision + 1 then
    raise exception
      'Field Submission revision must advance exactly once per mutation.';
  end if;

  if new.updated_by is null
     or new.updated_at < old.updated_at
  then
    raise exception
      'Field Submission update provenance is invalid.';
  end if;

  v_state_changed :=
    new.submission_state is distinct from old.submission_state;

  v_declarations_changed :=
       new.newsroom_identity_mode is distinct from old.newsroom_identity_mode
    or new.public_attribution_preference is distinct from old.public_attribution_preference
    or new.contact_preference is distinct from old.contact_preference
    or new.rights_declaration is distinct from old.rights_declaration
    or new.rights_declaration_detail is distinct from old.rights_declaration_detail
    or new.consent_declaration is distinct from old.consent_declaration
    or new.consent_declaration_detail is distinct from old.consent_declaration_detail
    or new.declared_sensitivity is distinct from old.declared_sensitivity
    or new.source_protection_request is distinct from old.source_protection_request
    or new.embargo_request_mode is distinct from old.embargo_request_mode
    or new.requested_embargo_until is distinct from old.requested_embargo_until
    or new.location_mode is distinct from old.location_mode
    or new.location_description is distinct from old.location_description
    or new.content_captured_at is distinct from old.content_captured_at
    or new.intake_notes is distinct from old.intake_notes;

  if v_state_changed then
    if not (
      (old.submission_state = 'receiving'
       and new.submission_state in ('received', 'cancelled', 'expired'))
      or
      (old.submission_state = 'received'
       and new.submission_state in ('submitted', 'cancelled', 'expired'))
    ) then
      raise exception
        'Unsupported Field Submission lifecycle transition from % to %.',
        old.submission_state,
        new.submission_state;
    end if;

    if v_declarations_changed then
      raise exception
        'Field lifecycle transitions cannot rewrite contributor declarations.';
    end if;
  else
    if new.received_at is distinct from old.received_at
       or new.submitted_at is distinct from old.submitted_at
       or new.cancelled_at is distinct from old.cancelled_at
       or new.expired_at is distinct from old.expired_at
       or new.receipt_issued_at is distinct from old.receipt_issued_at
    then
      raise exception
        'Field lifecycle timestamps change only with a lifecycle transition.';
    end if;

    if not v_declarations_changed then
      raise exception
        'Field Submission update must change declarations or lifecycle state.';
    end if;
  end if;

  return new;
end;
$function$;

revoke all
  on function editorial.protect_field_submission_mutation()
  from public, anon, authenticated, service_role;

create trigger field_submissions_protect_mutation
before update
on editorial.field_submissions
for each row
execute function editorial.protect_field_submission_mutation();

create or replace function editorial.protect_field_submission_event()
returns trigger
language plpgsql
set search_path to 'pg_catalog'
as $function$
begin
  raise exception
    'Field Submission events are append-only.';
end;
$function$;

revoke all
  on function editorial.protect_field_submission_event()
  from public, anon, authenticated, service_role;

create trigger field_submission_events_append_only
before update or delete
on editorial.field_submission_events
for each row
execute function editorial.protect_field_submission_event();

-- ---------------------------------------------------------------------------
-- Extend the shared Resource binding invariant with one exact Field branch.
-- Preserve every predecessor branch and the accepted SECURITY DEFINER context.
-- ---------------------------------------------------------------------------

create or replace function editorial.assert_resource_binding_integrity()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'editorial', 'audio'
as $function$
declare
  target_resource_id uuid;
  target_kind text;
  binding_count integer;
begin
  if tg_table_name = 'resources' then
    if tg_op = 'DELETE' then
      return null;
    end if;
    target_resource_id := new.id;
  else
    if tg_op = 'DELETE' then
      target_resource_id := old.resource_id;
    else
      target_resource_id := new.resource_id;
    end if;
  end if;

  select resource_kind
    into target_kind
  from editorial.resources
  where id = target_resource_id;

  if not found then
    return null;
  end if;

  case target_kind
    when 'article' then
      select count(*) into binding_count
      from editorial.article_resources
      where resource_id = target_resource_id;
    when 'playlist' then
      select count(*) into binding_count
      from editorial.playlist_resources
      where resource_id = target_resource_id;
    when 'registry_artist' then
      select count(*) into binding_count
      from editorial.registry_artist_resources
      where resource_id = target_resource_id;
    when 'correction_case' then
      select count(*) into binding_count
      from editorial.correction_cases
      where resource_id = target_resource_id;
    when 'media_asset' then
      select count(*) into binding_count
      from editorial.media_asset_resources
      where resource_id = target_resource_id;
    when 'person' then
      select count(*) into binding_count
      from editorial.people
      where resource_id = target_resource_id;
    when 'organization' then
      select count(*) into binding_count
      from editorial.organizations
      where resource_id = target_resource_id;
    when 'audio_show' then
      select count(*) into binding_count
      from editorial.audio_show_resources
      where resource_id = target_resource_id;
    when 'audio_season' then
      select count(*) into binding_count
      from editorial.audio_season_resources
      where resource_id = target_resource_id;
    when 'audio_episode' then
      select count(*) into binding_count
      from editorial.audio_publication_resources
      where resource_id = target_resource_id
        and resource_kind = 'audio_episode';
    when 'standalone_audio' then
      select count(*) into binding_count
      from editorial.audio_publication_resources
      where resource_id = target_resource_id
        and resource_kind = 'standalone_audio';
    when 'show' then
      select count(*) into binding_count
      from editorial.shows
      where resource_id = target_resource_id;
    when 'show_episode' then
      select count(*) into binding_count
      from editorial.show_episodes
      where resource_id = target_resource_id;
    when 'video_episode' then
      select count(*) into binding_count
      from editorial.video_publication_resources
      where resource_id = target_resource_id
        and resource_kind = 'video_episode';
    when 'standalone_video' then
      select count(*) into binding_count
      from editorial.video_publication_resources
      where resource_id = target_resource_id
        and resource_kind = 'standalone_video';
    when 'field_submission' then
      select count(*) into binding_count
      from editorial.field_submissions
      where resource_id = target_resource_id
        and resource_kind = 'field_submission';
    else
      raise exception
        'Unsupported resource kind: %',
        target_kind;
  end case;

  if binding_count <> 1 then
    raise exception
      'Resource % with kind % must have exactly one typed binding.',
      target_resource_id,
      target_kind;
  end if;

  return null;
end;
$function$;

revoke all
  on function editorial.assert_resource_binding_integrity()
  from public, anon, authenticated, service_role;

create constraint trigger field_submissions_resource_binding_integrity
after insert or update or delete
on editorial.field_submissions
deferrable initially deferred
for each row
execute function editorial.assert_resource_binding_integrity();

-- ---------------------------------------------------------------------------
-- Synchronous command vocabulary for the non-Media foundation.
-- Finalization is intentionally deferred until Media adoption exists.
-- ---------------------------------------------------------------------------

insert into platform_private.command_types (
  command_type,
  job_type,
  accepted_event_type,
  success_event_type,
  failure_event_type,
  retry_event_type,
  enabled
)
values
  (
    'field.submission.create',
    'field.submission.create.sync',
    'field.submission.create.accepted',
    'field.submission.create.succeeded',
    'field.submission.create.failed',
    'field.submission.create.retry_scheduled',
    true
  ),
  (
    'field.submission.declarations.update',
    'field.submission.declarations.update.sync',
    'field.submission.declarations.update.accepted',
    'field.submission.declarations.update.succeeded',
    'field.submission.declarations.update.failed',
    'field.submission.declarations.update.retry_scheduled',
    true
  ),
  (
    'field.submission.cancel',
    'field.submission.cancel.sync',
    'field.submission.cancel.accepted',
    'field.submission.cancel.succeeded',
    'field.submission.cancel.failed',
    'field.submission.cancel.retry_scheduled',
    true
  );

-- ---------------------------------------------------------------------------
-- Private helpers for validation and safe state snapshots.
-- ---------------------------------------------------------------------------

create or replace function editorial.validate_field_declarations_v1(
  p_declarations jsonb,
  p_require_core boolean default true
)
returns jsonb
language plpgsql
immutable
set search_path to 'pg_catalog'
as $function$
declare
  v_input jsonb := coalesce(p_declarations, '{}'::jsonb);
  v_rights text;
  v_consent text;
  v_identity text;
  v_attribution text;
  v_contact text;
  v_sensitivity text;
  v_source text;
  v_embargo text;
  v_embargo_until timestamptz;
  v_location_mode text;
  v_location text;
  v_captured_at timestamptz;
  v_rights_detail text;
  v_consent_detail text;
  v_notes text;
begin
  if jsonb_typeof(v_input) <> 'object'
     or octet_length(v_input::text) > 32768
     or v_input - array[
       'newsroom_identity_mode',
       'public_attribution_preference',
       'contact_preference',
       'rights_declaration',
       'rights_declaration_detail',
       'consent_declaration',
       'consent_declaration_detail',
       'declared_sensitivity',
       'source_protection_request',
       'embargo_request_mode',
       'requested_embargo_until',
       'location_mode',
       'location_description',
       'content_captured_at',
       'intake_notes'
     ] <> '{}'::jsonb
  then
    raise exception
      using errcode = '22023', message = 'Field declaration payload is invalid.';
  end if;

  v_identity := coalesce(nullif(v_input ->> 'newsroom_identity_mode', ''), 'standard');
  v_attribution := coalesce(nullif(v_input ->> 'public_attribution_preference', ''), 'do_not_name');
  v_contact := coalesce(nullif(v_input ->> 'contact_preference', ''), 'account_contact');
  v_rights := nullif(v_input ->> 'rights_declaration', '');
  v_rights_detail := nullif(btrim(v_input ->> 'rights_declaration_detail'), '');
  v_consent := nullif(v_input ->> 'consent_declaration', '');
  v_consent_detail := nullif(btrim(v_input ->> 'consent_declaration_detail'), '');
  v_sensitivity := coalesce(nullif(v_input ->> 'declared_sensitivity', ''), 'none');
  v_source := coalesce(nullif(v_input ->> 'source_protection_request', ''), 'internal');
  v_embargo := coalesce(nullif(v_input ->> 'embargo_request_mode', ''), 'none');
  v_location_mode := coalesce(nullif(v_input ->> 'location_mode', ''), 'not_collected');
  v_location := nullif(btrim(v_input ->> 'location_description'), '');
  v_notes := nullif(btrim(v_input ->> 'intake_notes'), '');

  if v_input ? 'requested_embargo_until'
     and nullif(v_input ->> 'requested_embargo_until', '') is not null
  then
    v_embargo_until := (v_input ->> 'requested_embargo_until')::timestamptz;
  end if;

  if v_input ? 'content_captured_at'
     and nullif(v_input ->> 'content_captured_at', '') is not null
  then
    v_captured_at := (v_input ->> 'content_captured_at')::timestamptz;
  end if;

  if p_require_core and (v_rights is null or v_consent is null) then
    raise exception
      using errcode = '22023', message = 'Rights and consent declarations are required.';
  end if;

  if v_identity not in ('standard', 'restricted')
     or v_attribution not in ('may_name', 'do_not_name')
     or v_contact not in ('account_contact', 'no_follow_up')
     or (v_rights is not null and v_rights not in (
       'owns_or_controls',
       'authorized_by_rights_holder',
       'uncertain',
       'other'
     ))
     or (v_consent is not null and v_consent not in (
       'granted',
       'not_required',
       'uncertain',
       'not_obtained'
     ))
     or v_sensitivity not in ('none', 'low', 'moderate', 'high', 'extreme')
     or v_source not in ('internal', 'restricted', 'confidential')
     or v_embargo not in ('none', 'until_review', 'until_time')
     or v_location_mode not in ('not_collected', 'coarse_text')
  then
    raise exception
      using errcode = '22023', message = 'One or more Field declaration values are invalid.';
  end if;

  if (v_embargo = 'until_time' and v_embargo_until is null)
     or (v_embargo <> 'until_time' and v_embargo_until is not null)
  then
    raise exception
      using errcode = '22023', message = 'Field embargo request shape is invalid.';
  end if;

  if (v_location_mode = 'not_collected' and v_location is not null)
     or (v_location_mode = 'coarse_text' and v_location is null)
  then
    raise exception
      using errcode = '22023', message = 'Field coarse location shape is invalid.';
  end if;

  if length(coalesce(v_rights_detail, '')) > 4000
     or length(coalesce(v_consent_detail, '')) > 4000
     or length(coalesce(v_location, '')) > 1000
     or length(coalesce(v_notes, '')) > 10000
  then
    raise exception
      using errcode = '22023', message = 'One or more Field declaration details are too long.';
  end if;

  return jsonb_build_object(
    'newsroom_identity_mode', v_identity,
    'public_attribution_preference', v_attribution,
    'contact_preference', v_contact,
    'rights_declaration', v_rights,
    'rights_declaration_detail', v_rights_detail,
    'consent_declaration', v_consent,
    'consent_declaration_detail', v_consent_detail,
    'declared_sensitivity', v_sensitivity,
    'source_protection_request', v_source,
    'embargo_request_mode', v_embargo,
    'requested_embargo_until', v_embargo_until,
    'location_mode', v_location_mode,
    'location_description', v_location,
    'content_captured_at', v_captured_at,
    'intake_notes', v_notes
  );
end;
$function$;

revoke all
  on function editorial.validate_field_declarations_v1(jsonb, boolean)
  from public, anon, authenticated, service_role;

create or replace function editorial.field_submission_state_snapshot_v1(
  p_submission_resource_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog', 'editorial'
as $function$
  select jsonb_build_object(
    'submission_resource_id', field.resource_id,
    'submission_reference', field.submission_reference,
    'current_revision', field.current_revision,
    'submission_state', field.submission_state,
    'newsroom_identity_mode', field.newsroom_identity_mode,
    'public_attribution_preference', field.public_attribution_preference,
    'contact_preference', field.contact_preference,
    'rights_declaration', field.rights_declaration,
    'rights_declaration_detail', field.rights_declaration_detail,
    'consent_declaration', field.consent_declaration,
    'consent_declaration_detail', field.consent_declaration_detail,
    'declared_sensitivity', field.declared_sensitivity,
    'source_protection_request', field.source_protection_request,
    'embargo_request_mode', field.embargo_request_mode,
    'requested_embargo_until', field.requested_embargo_until,
    'location_mode', field.location_mode,
    'location_description', field.location_description,
    'content_captured_at', field.content_captured_at,
    'intake_notes', field.intake_notes,
    'created_at', field.created_at,
    'updated_at', field.updated_at,
    'received_at', field.received_at,
    'submitted_at', field.submitted_at,
    'cancelled_at', field.cancelled_at,
    'expired_at', field.expired_at,
    'receipt_issued_at', field.receipt_issued_at
  )
  from editorial.field_submissions field
  where field.resource_id = p_submission_resource_id;
$function$;

revoke all
  on function editorial.field_submission_state_snapshot_v1(uuid)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Public create command.
-- ---------------------------------------------------------------------------

create or replace function public.create_field_submission_v1(
  p_declarations jsonb,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  submission_resource_id uuid,
  submission_reference text,
  current_revision bigint,
  submission_state text,
  created_at timestamptz,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'editorial', 'platform_private', 'extensions'
as $function$
declare
  v_actor uuid;
  v_principal_key text;
  v_correlation_id uuid := coalesce(p_correlation_id, extensions.gen_random_uuid());
  v_declarations jsonb;
  v_request jsonb;
  v_existing platform_private.command_receipts%rowtype;
  v_expected_fingerprint text;
  v_resource_id uuid;
  v_reference text;
  v_begin record;
  v_read record;
  v_result jsonb;
  v_created_at timestamptz;
begin
  select context.actor_user_id, context.principal_key
  into v_actor, v_principal_key
  from platform_private.command_actor_context() context;

  if not public.current_user_has_capability('submit_field_capture') then
    raise exception
      using errcode = '42501', message = 'Field Submission permission is required.';
  end if;

  if p_idempotency_key is null
     or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
  then
    raise exception
      using errcode = '22023', message = 'idempotency_key is invalid.';
  end if;

  v_declarations := editorial.validate_field_declarations_v1(
    p_declarations,
    true
  );

  v_request := jsonb_build_object(
    'declarations', v_declarations,
    'correlation_id', v_correlation_id
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_principal_key || ':field.submission.create:' || p_idempotency_key,
      0
    )
  );

  select receipt.*
  into v_existing
  from platform_private.command_receipts receipt
  where receipt.principal_key = v_principal_key
    and receipt.command_type = 'field.submission.create'
    and receipt.idempotency_key = p_idempotency_key
  for update;

  if found then
    v_expected_fingerprint :=
      platform_private.command_request_fingerprint(
        'field.submission.create',
        v_existing.resource_id,
        v_request
      );

    if v_existing.request_fingerprint <> v_expected_fingerprint then
      raise exception
        using
          errcode = '23505',
          message = 'The idempotency key was already used for a different Field Submission create request.';
    end if;

    select *
    into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_existing.id,
      true
    );

    command_receipt_id := v_read.command_receipt_id;
    receipt_status := v_read.receipt_status;
    submission_resource_id := v_read.resource_id;
    submission_reference := v_read.result_payload ->> 'submission_reference';
    current_revision := nullif(v_read.result_payload ->> 'current_revision', '')::bigint;
    submission_state := v_read.result_payload ->> 'submission_state';
    created_at := nullif(v_read.result_payload ->> 'created_at', '')::timestamptz;
    idempotent_replay := true;
    return next;
    return;
  end if;

  v_resource_id := extensions.gen_random_uuid();
  v_reference :=
    'FS-' ||
    to_char(now(), 'YYYYMMDD') ||
    '-' ||
    upper(encode(extensions.gen_random_bytes(5), 'hex'));

  insert into editorial.resources (
    id,
    resource_kind,
    owner_id,
    visibility,
    lifecycle_state,
    created_by
  )
  values (
    v_resource_id,
    'field_submission',
    v_actor,
    'private',
    'active',
    v_actor
  );

  insert into editorial.field_submissions (
    resource_id,
    resource_kind,
    submission_reference,
    owner_user_id,
    submitter_mode,
    current_revision,
    submission_state,
    newsroom_identity_mode,
    public_attribution_preference,
    contact_preference,
    rights_declaration,
    rights_declaration_detail,
    consent_declaration,
    consent_declaration_detail,
    declared_sensitivity,
    source_protection_request,
    embargo_request_mode,
    requested_embargo_until,
    location_mode,
    location_description,
    content_captured_at,
    intake_notes,
    created_by,
    updated_by,
    correlation_id
  )
  values (
    v_resource_id,
    'field_submission',
    v_reference,
    v_actor,
    'authenticated',
    1,
    'receiving',
    v_declarations ->> 'newsroom_identity_mode',
    v_declarations ->> 'public_attribution_preference',
    v_declarations ->> 'contact_preference',
    v_declarations ->> 'rights_declaration',
    v_declarations ->> 'rights_declaration_detail',
    v_declarations ->> 'consent_declaration',
    v_declarations ->> 'consent_declaration_detail',
    v_declarations ->> 'declared_sensitivity',
    v_declarations ->> 'source_protection_request',
    v_declarations ->> 'embargo_request_mode',
    nullif(v_declarations ->> 'requested_embargo_until', '')::timestamptz,
    v_declarations ->> 'location_mode',
    v_declarations ->> 'location_description',
    nullif(v_declarations ->> 'content_captured_at', '')::timestamptz,
    v_declarations ->> 'intake_notes',
    v_actor,
    v_actor,
    v_correlation_id
  )
  returning editorial.field_submissions.created_at
  into v_created_at;

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'field.submission.create',
    v_resource_id,
    p_idempotency_key,
    v_request
  );

  if v_begin.idempotent_replay then
    raise exception
      'Unexpected Field create replay after serialized preflight.';
  end if;

  insert into editorial.field_submission_events (
    submission_resource_id,
    event_type,
    actor_user_id,
    command_receipt_id,
    prior_state,
    resulting_state,
    correlation_id
  )
  values (
    v_resource_id,
    'submission_created',
    v_actor,
    v_begin.command_receipt_id,
    null,
    editorial.field_submission_state_snapshot_v1(v_resource_id),
    v_correlation_id
  );

  v_result := jsonb_build_object(
    'submission_resource_id', v_resource_id,
    'submission_reference', v_reference,
    'current_revision', 1,
    'submission_state', 'receiving',
    'created_at', v_created_at,
    'correlation_id', v_correlation_id
  );

  perform platform_private.complete_resource_command(
    v_begin.command_receipt_id,
    v_result
  );

  command_receipt_id := v_begin.command_receipt_id;
  receipt_status := 'succeeded';
  submission_resource_id := v_resource_id;
  submission_reference := v_reference;
  current_revision := 1;
  submission_state := 'receiving';
  created_at := v_created_at;
  idempotent_replay := false;
  return next;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Declaration update command with optimistic concurrency.
-- ---------------------------------------------------------------------------

create or replace function public.update_field_submission_declarations_v1(
  p_submission_resource_id uuid,
  p_expected_current_revision bigint,
  p_declarations jsonb,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  submission_resource_id uuid,
  current_revision bigint,
  submission_state text,
  declaration_changed boolean,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'editorial', 'platform_private', 'extensions'
as $function$
declare
  v_actor uuid;
  v_field editorial.field_submissions%rowtype;
  v_correlation_id uuid := coalesce(p_correlation_id, extensions.gen_random_uuid());
  v_patch jsonb;
  v_merged jsonb;
  v_request jsonb;
  v_begin record;
  v_read record;
  v_prior jsonb;
  v_result jsonb;
  v_next jsonb;
  v_changed boolean := false;
begin
  select context.actor_user_id
  into v_actor
  from platform_private.command_actor_context() context;

  if p_submission_resource_id is null
     or p_expected_current_revision is null
     or p_expected_current_revision < 1
  then
    raise exception
      using errcode = '22023', message = 'Field Submission and expected revision are required.';
  end if;

  if p_declarations is null
     or jsonb_typeof(p_declarations) <> 'object'
     or p_declarations = '{}'::jsonb
     or octet_length(p_declarations::text) > 32768
     or p_declarations - array[
       'newsroom_identity_mode',
       'public_attribution_preference',
       'contact_preference',
       'rights_declaration',
       'rights_declaration_detail',
       'consent_declaration',
       'consent_declaration_detail',
       'declared_sensitivity',
       'source_protection_request',
       'embargo_request_mode',
       'requested_embargo_until',
       'location_mode',
       'location_description',
       'content_captured_at',
       'intake_notes'
     ] <> '{}'::jsonb
  then
    raise exception
      using errcode = '22023', message = 'Field declaration update payload is required.';
  end if;

  if not public.current_user_has_capability('submit_field_capture') then
    raise exception
      using errcode = '42501', message = 'Field Submission permission is required.';
  end if;

  select field.*
  into v_field
  from editorial.field_submissions field
  join editorial.resources resource_row
    on resource_row.id = field.resource_id
   and resource_row.resource_kind = field.resource_kind
  where field.resource_id = p_submission_resource_id
    and field.owner_user_id = v_actor
    and resource_row.owner_id = v_actor
    and resource_row.visibility = 'private'
  for update of field;

  if not found then
    raise exception
      using errcode = 'P0002', message = 'The Field Submission does not exist for this contributor.';
  end if;

  v_request := jsonb_build_object(
    'submission_resource_id', p_submission_resource_id,
    'expected_current_revision', p_expected_current_revision,
    'declarations', p_declarations,
    'correlation_id', v_correlation_id
  );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'field.submission.declarations.update',
    p_submission_resource_id,
    p_idempotency_key,
    v_request
  );

  if v_begin.idempotent_replay then
    select *
    into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_begin.command_receipt_id,
      true
    );

    command_receipt_id := v_read.command_receipt_id;
    receipt_status := v_read.receipt_status;
    submission_resource_id := p_submission_resource_id;
    current_revision := nullif(v_read.result_payload ->> 'current_revision', '')::bigint;
    submission_state := v_read.result_payload ->> 'submission_state';
    declaration_changed := coalesce((v_read.result_payload ->> 'declaration_changed')::boolean, false);
    idempotent_replay := true;
    return next;
    return;
  end if;

  if v_field.submission_state not in ('receiving', 'received') then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'field_declaration_mutation_not_allowed',
      'This Field Submission no longer accepts declaration changes.',
      jsonb_build_object(
        'submission_resource_id', p_submission_resource_id,
        'submission_state', v_field.submission_state,
        'current_revision', v_field.current_revision
      )
    );

    command_receipt_id := v_begin.command_receipt_id;
    receipt_status := 'rejected';
    submission_resource_id := p_submission_resource_id;
    current_revision := v_field.current_revision;
    submission_state := v_field.submission_state;
    declaration_changed := false;
    idempotent_replay := false;
    return next;
    return;
  end if;

  if v_field.current_revision <> p_expected_current_revision then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'field_revision_changed',
      'The Field Submission changed before this declaration update could be applied.',
      jsonb_build_object(
        'submission_resource_id', p_submission_resource_id,
        'current_revision', v_field.current_revision
      )
    );

    command_receipt_id := v_begin.command_receipt_id;
    receipt_status := 'rejected';
    submission_resource_id := p_submission_resource_id;
    current_revision := v_field.current_revision;
    submission_state := v_field.submission_state;
    declaration_changed := false;
    idempotent_replay := false;
    return next;
    return;
  end if;

  v_merged := jsonb_build_object(
    'newsroom_identity_mode', v_field.newsroom_identity_mode,
    'public_attribution_preference', v_field.public_attribution_preference,
    'contact_preference', v_field.contact_preference,
    'rights_declaration', v_field.rights_declaration,
    'rights_declaration_detail', v_field.rights_declaration_detail,
    'consent_declaration', v_field.consent_declaration,
    'consent_declaration_detail', v_field.consent_declaration_detail,
    'declared_sensitivity', v_field.declared_sensitivity,
    'source_protection_request', v_field.source_protection_request,
    'embargo_request_mode', v_field.embargo_request_mode,
    'requested_embargo_until', v_field.requested_embargo_until,
    'location_mode', v_field.location_mode,
    'location_description', v_field.location_description,
    'content_captured_at', v_field.content_captured_at,
    'intake_notes', v_field.intake_notes
  ) || p_declarations;

  v_patch := editorial.validate_field_declarations_v1(
    v_merged,
    true
  );

  v_prior := editorial.field_submission_state_snapshot_v1(p_submission_resource_id);

  v_next := v_patch;

  v_changed :=
       (v_next ->> 'newsroom_identity_mode') is distinct from v_field.newsroom_identity_mode
    or (v_next ->> 'public_attribution_preference') is distinct from v_field.public_attribution_preference
    or (v_next ->> 'contact_preference') is distinct from v_field.contact_preference
    or (v_next ->> 'rights_declaration') is distinct from v_field.rights_declaration
    or (v_next ->> 'rights_declaration_detail') is distinct from v_field.rights_declaration_detail
    or (v_next ->> 'consent_declaration') is distinct from v_field.consent_declaration
    or (v_next ->> 'consent_declaration_detail') is distinct from v_field.consent_declaration_detail
    or (v_next ->> 'declared_sensitivity') is distinct from v_field.declared_sensitivity
    or (v_next ->> 'source_protection_request') is distinct from v_field.source_protection_request
    or (v_next ->> 'embargo_request_mode') is distinct from v_field.embargo_request_mode
    or nullif(v_next ->> 'requested_embargo_until', '')::timestamptz is distinct from v_field.requested_embargo_until
    or (v_next ->> 'location_mode') is distinct from v_field.location_mode
    or (v_next ->> 'location_description') is distinct from v_field.location_description
    or nullif(v_next ->> 'content_captured_at', '')::timestamptz is distinct from v_field.content_captured_at
    or (v_next ->> 'intake_notes') is distinct from v_field.intake_notes;

  if v_changed then
    update editorial.field_submissions as field
    set
      newsroom_identity_mode = v_next ->> 'newsroom_identity_mode',
      public_attribution_preference = v_next ->> 'public_attribution_preference',
      contact_preference = v_next ->> 'contact_preference',
      rights_declaration = v_next ->> 'rights_declaration',
      rights_declaration_detail = v_next ->> 'rights_declaration_detail',
      consent_declaration = v_next ->> 'consent_declaration',
      consent_declaration_detail = v_next ->> 'consent_declaration_detail',
      declared_sensitivity = v_next ->> 'declared_sensitivity',
      source_protection_request = v_next ->> 'source_protection_request',
      embargo_request_mode = v_next ->> 'embargo_request_mode',
      requested_embargo_until = nullif(v_next ->> 'requested_embargo_until', '')::timestamptz,
      location_mode = v_next ->> 'location_mode',
      location_description = v_next ->> 'location_description',
      content_captured_at = nullif(v_next ->> 'content_captured_at', '')::timestamptz,
      intake_notes = v_next ->> 'intake_notes',
      current_revision = field.current_revision + 1,
      updated_by = v_actor,
      updated_at = now()
    where field.resource_id = p_submission_resource_id;

    insert into editorial.field_submission_events (
      submission_resource_id,
      event_type,
      actor_user_id,
      command_receipt_id,
      prior_state,
      resulting_state,
      correlation_id
    )
    values (
      p_submission_resource_id,
      'declaration_updated',
      v_actor,
      v_begin.command_receipt_id,
      v_prior,
      editorial.field_submission_state_snapshot_v1(p_submission_resource_id),
      v_correlation_id
    );
  end if;

  select field.*
  into v_field
  from editorial.field_submissions field
  where field.resource_id = p_submission_resource_id;

  v_result := jsonb_build_object(
    'submission_resource_id', p_submission_resource_id,
    'current_revision', v_field.current_revision,
    'submission_state', v_field.submission_state,
    'declaration_changed', v_changed,
    'correlation_id', v_correlation_id
  );

  perform platform_private.complete_resource_command(
    v_begin.command_receipt_id,
    v_result
  );

  command_receipt_id := v_begin.command_receipt_id;
  receipt_status := 'succeeded';
  submission_resource_id := p_submission_resource_id;
  current_revision := v_field.current_revision;
  submission_state := v_field.submission_state;
  declaration_changed := v_changed;
  idempotent_replay := false;
  return next;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Foundation cancellation command. The received state cannot be reached until
-- Phase 8A.2B Media adoption exists, so this command only cancels receiving.
-- ---------------------------------------------------------------------------

create or replace function public.cancel_field_submission_v1(
  p_submission_resource_id uuid,
  p_expected_current_revision bigint,
  p_idempotency_key text,
  p_reason text default null,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  submission_resource_id uuid,
  current_revision bigint,
  submission_state text,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'editorial', 'platform_private', 'extensions'
as $function$
declare
  v_actor uuid;
  v_field editorial.field_submissions%rowtype;
  v_reason text := nullif(btrim(p_reason), '');
  v_correlation_id uuid := coalesce(p_correlation_id, extensions.gen_random_uuid());
  v_request jsonb;
  v_begin record;
  v_read record;
  v_prior jsonb;
  v_result jsonb;
begin
  select context.actor_user_id
  into v_actor
  from platform_private.command_actor_context() context;

  if not public.current_user_has_capability('submit_field_capture') then
    raise exception
      using errcode = '42501', message = 'Field Submission permission is required.';
  end if;

  if p_submission_resource_id is null
     or p_expected_current_revision is null
     or p_expected_current_revision < 1
  then
    raise exception
      using errcode = '22023', message = 'Field Submission and expected revision are required.';
  end if;

  if length(coalesce(v_reason, '')) > 4000 then
    raise exception
      using errcode = '22023', message = 'Field cancellation reason is too long.';
  end if;

  select field.*
  into v_field
  from editorial.field_submissions field
  join editorial.resources resource_row
    on resource_row.id = field.resource_id
   and resource_row.resource_kind = field.resource_kind
  where field.resource_id = p_submission_resource_id
    and field.owner_user_id = v_actor
    and resource_row.owner_id = v_actor
    and resource_row.visibility = 'private'
  for update of field;

  if not found then
    raise exception
      using errcode = 'P0002', message = 'The Field Submission does not exist for this contributor.';
  end if;

  v_request := jsonb_build_object(
    'submission_resource_id', p_submission_resource_id,
    'expected_current_revision', p_expected_current_revision,
    'reason', v_reason,
    'correlation_id', v_correlation_id
  );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'field.submission.cancel',
    p_submission_resource_id,
    p_idempotency_key,
    v_request
  );

  if v_begin.idempotent_replay then
    select *
    into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_begin.command_receipt_id,
      true
    );

    command_receipt_id := v_read.command_receipt_id;
    receipt_status := v_read.receipt_status;
    submission_resource_id := p_submission_resource_id;
    current_revision := nullif(v_read.result_payload ->> 'current_revision', '')::bigint;
    submission_state := v_read.result_payload ->> 'submission_state';
    idempotent_replay := true;
    return next;
    return;
  end if;

  if v_field.current_revision <> p_expected_current_revision then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'field_revision_changed',
      'The Field Submission changed before cancellation could be applied.',
      jsonb_build_object(
        'submission_resource_id', p_submission_resource_id,
        'current_revision', v_field.current_revision
      )
    );

    command_receipt_id := v_begin.command_receipt_id;
    receipt_status := 'rejected';
    submission_resource_id := p_submission_resource_id;
    current_revision := v_field.current_revision;
    submission_state := v_field.submission_state;
    idempotent_replay := false;
    return next;
    return;
  end if;

  if v_field.submission_state <> 'receiving' then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'field_cancellation_not_allowed',
      'Cancellation is not available for this Field Submission state.',
      jsonb_build_object(
        'submission_resource_id', p_submission_resource_id,
        'submission_state', v_field.submission_state,
        'current_revision', v_field.current_revision
      )
    );

    command_receipt_id := v_begin.command_receipt_id;
    receipt_status := 'rejected';
    submission_resource_id := p_submission_resource_id;
    current_revision := v_field.current_revision;
    submission_state := v_field.submission_state;
    idempotent_replay := false;
    return next;
    return;
  end if;

  v_prior := editorial.field_submission_state_snapshot_v1(p_submission_resource_id);

  update editorial.field_submissions as field
  set
    submission_state = 'cancelled',
    current_revision = field.current_revision + 1,
    updated_by = v_actor,
    updated_at = now(),
    cancelled_at = now()
  where field.resource_id = p_submission_resource_id;

  insert into editorial.field_submission_events (
    submission_resource_id,
    event_type,
    actor_user_id,
    command_receipt_id,
    reason,
    prior_state,
    resulting_state,
    correlation_id
  )
  values (
    p_submission_resource_id,
    'submission_cancelled',
    v_actor,
    v_begin.command_receipt_id,
    v_reason,
    v_prior,
    editorial.field_submission_state_snapshot_v1(p_submission_resource_id),
    v_correlation_id
  );

  select field.*
  into v_field
  from editorial.field_submissions field
  where field.resource_id = p_submission_resource_id;

  v_result := jsonb_build_object(
    'submission_resource_id', p_submission_resource_id,
    'current_revision', v_field.current_revision,
    'submission_state', v_field.submission_state,
    'cancelled_at', v_field.cancelled_at,
    'correlation_id', v_correlation_id
  );

  perform platform_private.complete_resource_command(
    v_begin.command_receipt_id,
    v_result
  );

  command_receipt_id := v_begin.command_receipt_id;
  receipt_status := 'succeeded';
  submission_resource_id := p_submission_resource_id;
  current_revision := v_field.current_revision;
  submission_state := v_field.submission_state;
  idempotent_replay := false;
  return next;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Safe contributor and minimum internal reads.
-- ---------------------------------------------------------------------------

create or replace function public.get_my_field_submission_v1(
  p_submission_resource_id uuid
)
returns table(
  submission_resource_id uuid,
  submission_reference text,
  submission_state text,
  current_revision bigint,
  newsroom_identity_mode text,
  public_attribution_preference text,
  contact_preference text,
  rights_declaration text,
  rights_declaration_detail text,
  consent_declaration text,
  consent_declaration_detail text,
  declared_sensitivity text,
  source_protection_request text,
  embargo_request_mode text,
  requested_embargo_until timestamptz,
  location_mode text,
  location_description text,
  content_captured_at timestamptz,
  intake_notes text,
  created_at timestamptz,
  updated_at timestamptz,
  received_at timestamptz,
  submitted_at timestamptz,
  cancelled_at timestamptz,
  expired_at timestamptz,
  receipt_issued_at timestamptz
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'editorial'
as $function$
declare
  v_actor uuid := auth.uid();
begin
  if coalesce(auth.role(), '') <> 'authenticated'
     or v_actor is null
     or not public.current_user_has_capability('read_own_field_capture')
  then
    raise exception
      using errcode = '42501', message = 'Own Field Submission read permission is required.';
  end if;

  return query
  select
    field.resource_id,
    field.submission_reference,
    field.submission_state,
    field.current_revision,
    field.newsroom_identity_mode,
    field.public_attribution_preference,
    field.contact_preference,
    field.rights_declaration,
    field.rights_declaration_detail,
    field.consent_declaration,
    field.consent_declaration_detail,
    field.declared_sensitivity,
    field.source_protection_request,
    field.embargo_request_mode,
    field.requested_embargo_until,
    field.location_mode,
    field.location_description,
    field.content_captured_at,
    field.intake_notes,
    field.created_at,
    field.updated_at,
    field.received_at,
    field.submitted_at,
    field.cancelled_at,
    field.expired_at,
    field.receipt_issued_at
  from editorial.field_submissions field
  join editorial.resources resource_row
    on resource_row.id = field.resource_id
   and resource_row.resource_kind = field.resource_kind
  where field.resource_id = p_submission_resource_id
    and field.owner_user_id = v_actor
    and resource_row.owner_id = v_actor
    and resource_row.visibility = 'private';
end;
$function$;

create or replace function public.get_field_submission_intake_v1(
  p_submission_resource_id uuid
)
returns table(
  submission_resource_id uuid,
  submission_reference text,
  submission_state text,
  current_revision bigint,
  newsroom_identity_mode text,
  contributor_user_id uuid,
  contributor_identity_redacted boolean,
  public_attribution_preference text,
  contact_preference text,
  rights_declaration text,
  rights_declaration_detail text,
  consent_declaration text,
  consent_declaration_detail text,
  declared_sensitivity text,
  source_protection_request text,
  embargo_request_mode text,
  requested_embargo_until timestamptz,
  location_mode text,
  location_description text,
  content_captured_at timestamptz,
  intake_notes text,
  created_at timestamptz,
  updated_at timestamptz,
  received_at timestamptz,
  submitted_at timestamptz,
  cancelled_at timestamptz,
  expired_at timestamptz
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'editorial'
as $function$
declare
  v_can_resolve_restricted boolean;
begin
  if coalesce(auth.role(), '') <> 'authenticated'
     or auth.uid() is null
     or not public.current_user_has_capability('view_field_intake')
  then
    raise exception
      using errcode = '42501', message = 'Internal Field intake permission is required.';
  end if;

  v_can_resolve_restricted :=
    public.current_user_has_capability('view_restricted_field_sources');

  return query
  select
    field.resource_id,
    field.submission_reference,
    field.submission_state,
    field.current_revision,
    field.newsroom_identity_mode,
    case
      when field.newsroom_identity_mode = 'restricted'
       and not v_can_resolve_restricted
      then null::uuid
      else field.owner_user_id
    end,
    (
      field.newsroom_identity_mode = 'restricted'
      and not v_can_resolve_restricted
    ),
    field.public_attribution_preference,
    field.contact_preference,
    field.rights_declaration,
    field.rights_declaration_detail,
    field.consent_declaration,
    field.consent_declaration_detail,
    field.declared_sensitivity,
    field.source_protection_request,
    field.embargo_request_mode,
    field.requested_embargo_until,
    field.location_mode,
    field.location_description,
    field.content_captured_at,
    field.intake_notes,
    field.created_at,
    field.updated_at,
    field.received_at,
    field.submitted_at,
    field.cancelled_at,
    field.expired_at
  from editorial.field_submissions field
  where field.resource_id = p_submission_resource_id;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Browser table boundary and public RPC grants.
-- ---------------------------------------------------------------------------

alter table editorial.field_submission_event_types enable row level security;
alter table editorial.field_submissions enable row level security;
alter table editorial.field_submission_events enable row level security;

revoke all
  on editorial.field_submission_event_types,
     editorial.field_submissions,
     editorial.field_submission_events
  from public, anon, authenticated, service_role;

revoke execute
  on function public.create_field_submission_v1(jsonb, text, uuid),
     public.update_field_submission_declarations_v1(uuid, bigint, jsonb, text, uuid),
     public.cancel_field_submission_v1(uuid, bigint, text, text, uuid),
     public.get_my_field_submission_v1(uuid),
     public.get_field_submission_intake_v1(uuid)
  from public, anon;

grant execute
  on function public.create_field_submission_v1(jsonb, text, uuid),
     public.update_field_submission_declarations_v1(uuid, bigint, jsonb, text, uuid),
     public.cancel_field_submission_v1(uuid, bigint, text, text, uuid),
     public.get_my_field_submission_v1(uuid),
     public.get_field_submission_intake_v1(uuid)
  to authenticated;

revoke execute
  on function public.create_field_submission_v1(jsonb, text, uuid),
     public.update_field_submission_declarations_v1(uuid, bigint, jsonb, text, uuid),
     public.cancel_field_submission_v1(uuid, bigint, text, text, uuid),
     public.get_my_field_submission_v1(uuid),
     public.get_field_submission_intake_v1(uuid)
  from service_role;

-- No public route or Resource Version registration is created for Field Submission.

commit;
