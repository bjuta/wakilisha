-- Phase 3B Migration 1: Correction identity foundation.
--
-- Establishes:
-- 1. correction capabilities and initial role assignments
-- 2. correction_case stable resource kind
-- 3. controlled correction vocabularies
-- 4. correction case identity and lifecycle state
-- 5. exact Article correction targets
-- 6. append-only correction events
-- 7. correction read-authority helpers
-- 8. canonical RLS and grant boundaries
--
-- This migration intentionally does not create:
-- - correction evidence links
-- - correction decisions
-- - correction applications
-- - public correction notes
-- - related-resource reviews
-- - correction commands
-- - correction jobs or outbox events
-- - correction frontend authority
--
-- It creates no correction case rows.

begin;

do $phase_3b_correction_identity_preflight$
declare
  v_object text;
begin
  if to_regclass('editorial.resource_kinds') is null
     or to_regclass('editorial.resources') is null
     or to_regclass('editorial.article_resources') is null
     or to_regclass('editorial.article_versions') is null
     or to_regclass('platform_private.command_receipts') is null
     or to_regclass('public.community_contributions') is null
     or to_regclass('public.capability_definitions') is null
     or to_regclass('public.role_definitions') is null
     or to_regclass('public.role_capabilities') is null
  then
    raise exception
      'STOP: Phase 3B correction identity dependencies are incomplete';
  end if;

  if to_regprocedure(
       'public.current_user_is_administrator()'
     ) is null
     or to_regprocedure(
       'public.current_user_has_capability(text)'
     ) is null
  then
    raise exception
      'STOP: Required authentication capability helpers are missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'editorial'
      and table_name = 'resources'
      and column_name = 'current_published_version_id'
      and udt_name = 'uuid'
  ) then
    raise exception
      'STOP: editorial.resources.current_published_version_id is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    join pg_class relation
      on relation.oid = trigger_row.tgrelid
    join pg_namespace namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'editorial'
      and relation.relname = 'article_versions'
      and trigger_row.tgname = 'article_versions_immutable'
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'STOP: Article-version immutability authority is missing';
  end if;

  if exists (
    select 1
    from (
      values
        ('administrator'),
        ('editor'),
        ('reviewer'),
        ('registry_editor')
    ) required(role_key)
    where not exists (
      select 1
      from public.role_definitions definition
      where definition.role_key = required.role_key
    )
  ) then
    raise exception
      'STOP: One or more required correction role definitions are missing';
  end if;

  if exists (
    select 1
    from editorial.resource_kinds
    where kind = 'correction_case'
  ) then
    raise exception
      'STOP: correction_case resource kind already exists';
  end if;

  if exists (
    select 1
    from public.capability_definitions
    where capability_key in (
      'view_corrections',
      'triage_corrections',
      'investigate_corrections',
      'decide_corrections',
      'apply_corrections',
      'publish_correction_notes'
    )
  ) then
    raise exception
      'STOP: One or more correction capabilities already exist';
  end if;

  foreach v_object in array array[
    'editorial.correction_kinds',
    'editorial.correction_evidence_roles',
    'editorial.correction_event_types',
    'editorial.correction_cases',
    'editorial.correction_targets',
    'editorial.correction_events'
  ]
  loop
    if to_regclass(v_object) is not null then
      raise exception
        'STOP: Phase 3B object already exists: %',
        v_object;
    end if;
  end loop;
end;
$phase_3b_correction_identity_preflight$;

insert into public.capability_definitions (
  capability_key,
  label,
  domain,
  description
)
values
  (
    'view_corrections',
    'View corrections',
    'content',
    'View internal correction cases and their governed history.'
  ),
  (
    'triage_corrections',
    'Triage corrections',
    'content',
    'Create and triage governed correction cases and assign investigators.'
  ),
  (
    'investigate_corrections',
    'Investigate corrections',
    'content',
    'Investigate correction cases and prepare them for institutional decision.'
  ),
  (
    'decide_corrections',
    'Decide corrections',
    'content',
    'Record institutional correction decisions and govern closure or reopening.'
  ),
  (
    'apply_corrections',
    'Apply corrections',
    'content',
    'Apply an accepted correction through an authorized target-domain adapter.'
  ),
  (
    'publish_correction_notes',
    'Publish correction notes',
    'content',
    'Publish reviewed public-safe correction notes through target-domain authority.'
  );

insert into public.role_capabilities (
  role_key,
  capability_key
)
values
  ('administrator', 'view_corrections'),
  ('administrator', 'triage_corrections'),
  ('administrator', 'investigate_corrections'),
  ('administrator', 'decide_corrections'),
  ('administrator', 'apply_corrections'),
  ('administrator', 'publish_correction_notes'),

  ('editor', 'view_corrections'),
  ('editor', 'triage_corrections'),
  ('editor', 'investigate_corrections'),
  ('editor', 'decide_corrections'),
  ('editor', 'apply_corrections'),
  ('editor', 'publish_correction_notes'),

  ('reviewer', 'view_corrections'),
  ('reviewer', 'triage_corrections'),
  ('reviewer', 'investigate_corrections'),
  ('reviewer', 'decide_corrections'),

  ('registry_editor', 'view_corrections');

insert into editorial.resource_kinds (
  kind,
  label,
  description
)
values (
  'correction_case',
  'Correction case',
  'Stable institutional identity for one governed correction case.'
);

create table editorial.correction_kinds (
  correction_kind text primary key,
  label text not null,
  description text not null,
  enabled boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),

  constraint correction_kinds_key_check
    check (
      correction_kind ~ '^[a-z][a-z0-9_]*$'
    ),

  constraint correction_kinds_label_check
    check (
      nullif(btrim(label), '') is not null
    ),

  constraint correction_kinds_description_check
    check (
      nullif(btrim(description), '') is not null
    )
);

create table editorial.correction_evidence_roles (
  evidence_role text primary key,
  label text not null,
  description text not null,
  enabled boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),

  constraint correction_evidence_roles_key_check
    check (
      evidence_role ~ '^[a-z][a-z0-9_]*$'
    ),

  constraint correction_evidence_roles_label_check
    check (
      nullif(btrim(label), '') is not null
    ),

  constraint correction_evidence_roles_description_check
    check (
      nullif(btrim(description), '') is not null
    )
);

create table editorial.correction_event_types (
  event_type text primary key,
  label text not null,
  description text not null,
  public_eligible boolean not null default false,
  enabled boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),

  constraint correction_event_types_key_check
    check (
      event_type ~ '^[a-z][a-z0-9_]*$'
    ),

  constraint correction_event_types_label_check
    check (
      nullif(btrim(label), '') is not null
    ),

  constraint correction_event_types_description_check
    check (
      nullif(btrim(description), '') is not null
    )
);

insert into editorial.correction_kinds (
  correction_kind,
  label,
  description,
  sort_order
)
values
  (
    'factual_error',
    'Factual error',
    'A material factual statement may be incorrect.',
    10
  ),
  (
    'attribution_error',
    'Attribution error',
    'Authorship, quotation, ownership, or contribution attribution may be incorrect.',
    20
  ),
  (
    'missing_credit',
    'Missing credit',
    'A required governed Credit may be absent.',
    30
  ),
  (
    'classification_error',
    'Classification error',
    'A governed category, taxonomy, or classification may be incorrect.',
    40
  ),
  (
    'outdated_information',
    'Outdated information',
    'Published information may require a material update.',
    50
  ),
  (
    'transcription_error',
    'Transcription error',
    'A transcription or textual rendering may be inaccurate.',
    60
  ),
  (
    'broken_reference',
    'Broken reference',
    'A Citation, Source reference, or public reference may be broken.',
    70
  ),
  (
    'rights_or_consent',
    'Rights or consent',
    'Rights, permission, consent, or public-safety treatment may require review.',
    80
  ),
  (
    'other',
    'Other',
    'Another governed correction kind.',
    1000
  );

insert into editorial.correction_evidence_roles (
  evidence_role,
  label,
  description,
  sort_order
)
values
  (
    'supports_correction',
    'Supports correction',
    'Evidence supporting the alleged correction.',
    10
  ),
  (
    'challenges_correction',
    'Challenges correction',
    'Evidence challenging the alleged correction.',
    20
  ),
  (
    'context',
    'Context',
    'Evidence providing relevant context.',
    30
  ),
  (
    'identity',
    'Identity',
    'Evidence supporting identity or attribution analysis.',
    40
  ),
  (
    'rights_or_consent',
    'Rights or consent',
    'Evidence relevant to rights, permission, consent, or public safety.',
    50
  ),
  (
    'methodology',
    'Methodology',
    'Evidence relevant to method, calculation, or editorial process.',
    60
  ),
  (
    'other',
    'Other',
    'Another governed evidence role.',
    1000
  );

insert into editorial.correction_event_types (
  event_type,
  label,
  description,
  public_eligible,
  sort_order
)
values
  ('case_created', 'Case created', 'A correction case was created.', false, 10),
  ('case_triaged', 'Case triaged', 'A correction case completed triage.', false, 20),
  ('target_attached', 'Target attached', 'A correction target was attached.', false, 30),
  ('target_replaced', 'Target replaced', 'A correction target was replaced.', false, 40),
  ('investigator_assigned', 'Investigator assigned', 'An investigator was assigned.', false, 50),
  ('investigator_reassigned', 'Investigator reassigned', 'The investigator was reassigned.', false, 60),
  ('evidence_linked', 'Evidence linked', 'Evidence was linked to the case.', false, 70),
  ('evidence_unlinked', 'Evidence unlinked', 'Evidence was unlinked from the case.', false, 80),
  ('investigation_updated', 'Investigation updated', 'The investigation record was updated.', false, 90),
  ('submitted_for_decision', 'Submitted for decision', 'The case was submitted for institutional decision.', false, 100),
  ('returned_to_investigation', 'Returned to investigation', 'The case was returned for additional investigation.', false, 110),
  ('decision_recorded', 'Decision recorded', 'An institutional decision was recorded.', false, 120),
  ('decision_superseded', 'Decision superseded', 'A later institutional decision superseded the prior decision.', false, 130),
  ('application_accepted', 'Application accepted', 'A correction application command was accepted.', false, 140),
  ('application_rejected_stale', 'Application rejected as stale', 'A correction application was durably rejected because expected state changed.', false, 150),
  ('application_failed', 'Application failed', 'A correction application failed.', false, 160),
  ('application_succeeded', 'Application succeeded', 'A correction application succeeded.', false, 170),
  ('public_note_published', 'Public note published', 'A public-safe correction note was published.', false, 180),
  ('public_note_superseded', 'Public note superseded', 'A later public-safe note superseded the prior note.', false, 190),
  ('related_resource_added', 'Related resource added', 'A related resource was added for review.', false, 200),
  ('related_resource_dispositioned', 'Related resource dispositioned', 'A related-resource review received a disposition.', false, 210),
  ('contributor_notification_requested', 'Contributor notification requested', 'Contributor follow-up was requested through the shared outbox.', false, 220),
  ('case_closed', 'Case closed', 'A correction case was closed.', false, 230),
  ('case_reopened', 'Case reopened', 'A closed correction case was reopened.', false, 240);

create table editorial.correction_cases (
  resource_id uuid primary key,
  resource_kind text not null default 'correction_case',
  case_number bigint generated always as identity,
  origin_type text not null,
  origin_contribution_id uuid,
  origin_submitter_user_id uuid,
  origin_submitted_at timestamptz,
  origin_type_snapshot text,
  origin_summary_snapshot text not null,
  correction_kind text not null,
  priority text not null default 'normal',
  case_state text not null default 'submitted',
  current_revision bigint not null default 1,
  assigned_investigator_id uuid,
  assignment_reason text,
  assigned_at timestamptz,
  triage_reason text,
  triaged_by uuid,
  triaged_at timestamptz,
  investigation_summary text,
  investigator_recommendation text,
  evidence_ready boolean not null default false,
  submitted_for_decision_by uuid,
  submitted_for_decision_at timestamptz,
  public_note_disposition text,
  public_note_no_note_reason text,
  closed_reason text,
  closed_by uuid,
  closed_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint correction_cases_resource_kind_check
    check (
      resource_kind = 'correction_case'
    ),

  constraint correction_cases_resource_fkey
    foreign key (
      resource_id,
      resource_kind
    )
    references editorial.resources(
      id,
      resource_kind
    )
    on update cascade
    on delete restrict,

  constraint correction_cases_origin_contribution_fkey
    foreign key (origin_contribution_id)
    references public.community_contributions(id)
    on delete restrict,

  constraint correction_cases_correction_kind_fkey
    foreign key (correction_kind)
    references editorial.correction_kinds(correction_kind)
    on update cascade
    on delete restrict,

  constraint correction_cases_assigned_investigator_fkey
    foreign key (assigned_investigator_id)
    references auth.users(id)
    on delete set null,

  constraint correction_cases_created_by_fkey
    foreign key (created_by)
    references auth.users(id)
    on delete set null,

  constraint correction_cases_updated_by_fkey
    foreign key (updated_by)
    references auth.users(id)
    on delete set null,

  constraint correction_cases_number_unique
    unique (case_number),

  constraint correction_cases_origin_type_check
    check (
      origin_type in (
        'community_contribution',
        'internal_editorial'
      )
    ),

  constraint correction_cases_origin_summary_check
    check (
      nullif(
        btrim(origin_summary_snapshot),
        ''
      ) is not null
    ),

  constraint correction_cases_origin_type_snapshot_check
    check (
      origin_type_snapshot is null
      or nullif(
        btrim(origin_type_snapshot),
        ''
      ) is not null
    ),

  constraint correction_cases_origin_contract_check
    check (
      (
        origin_type = 'community_contribution'
        and origin_contribution_id is not null
        and origin_submitter_user_id is not null
        and origin_submitted_at is not null
        and nullif(
          btrim(origin_type_snapshot),
          ''
        ) is not null
      )
      or (
        origin_type = 'internal_editorial'
        and origin_contribution_id is null
        and origin_submitter_user_id is null
        and origin_submitted_at is null
        and created_by is not null
      )
    ),

  constraint correction_cases_priority_check
    check (
      priority in (
        'low',
        'normal',
        'high',
        'urgent'
      )
    ),

  constraint correction_cases_state_check
    check (
      case_state in (
        'submitted',
        'triaged',
        'investigating',
        'awaiting_decision',
        'decided',
        'applied',
        'closed'
      )
    ),

  constraint correction_cases_revision_check
    check (
      current_revision >= 1
    ),

  constraint correction_cases_assignment_reason_check
    check (
      assignment_reason is null
      or nullif(
        btrim(assignment_reason),
        ''
      ) is not null
    ),

  constraint correction_cases_triage_reason_check
    check (
      triage_reason is null
      or nullif(
        btrim(triage_reason),
        ''
      ) is not null
    ),

  constraint correction_cases_investigation_summary_check
    check (
      investigation_summary is null
      or nullif(
        btrim(investigation_summary),
        ''
      ) is not null
    ),

  constraint correction_cases_recommendation_check
    check (
      investigator_recommendation is null
      or nullif(
        btrim(investigator_recommendation),
        ''
      ) is not null
    ),

  constraint correction_cases_public_note_disposition_check
    check (
      public_note_disposition is null
      or nullif(
        btrim(public_note_disposition),
        ''
      ) is not null
    ),

  constraint correction_cases_public_note_reason_check
    check (
      public_note_no_note_reason is null
      or nullif(
        btrim(public_note_no_note_reason),
        ''
      ) is not null
    ),

  constraint correction_cases_closed_reason_check
    check (
      closed_reason is null
      or nullif(
        btrim(closed_reason),
        ''
      ) is not null
    )
);

create unique index correction_cases_origin_contribution_unique
on editorial.correction_cases (origin_contribution_id)
where origin_contribution_id is not null;

create index correction_cases_state_priority_updated_idx
on editorial.correction_cases (
  case_state,
  priority,
  updated_at desc
);

create index correction_cases_investigator_state_updated_idx
on editorial.correction_cases (
  assigned_investigator_id,
  case_state,
  updated_at desc
)
where assigned_investigator_id is not null;

create index correction_cases_kind_state_updated_idx
on editorial.correction_cases (
  correction_kind,
  case_state,
  updated_at desc
);

create index correction_cases_created_idx
on editorial.correction_cases (
  created_at desc,
  resource_id
);

create or replace function
  editorial.assert_resource_binding_integrity()
returns trigger
language plpgsql
set search_path = pg_catalog, editorial
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
      select count(*)
      into binding_count
      from editorial.article_resources
      where resource_id = target_resource_id;

    when 'playlist' then
      select count(*)
      into binding_count
      from editorial.playlist_resources
      where resource_id = target_resource_id;

    when 'registry_artist' then
      select count(*)
      into binding_count
      from editorial.registry_artist_resources
      where resource_id = target_resource_id;

    when 'correction_case' then
      select count(*)
      into binding_count
      from editorial.correction_cases
      where resource_id = target_resource_id;

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

revoke all on function
  editorial.assert_resource_binding_integrity()
from public, anon, authenticated;

grant execute on function
  editorial.assert_resource_binding_integrity()
to service_role;

create or replace function
  editorial.prevent_correction_case_identity_retarget()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
begin
  if new.resource_id is distinct from old.resource_id
     or new.resource_kind is distinct from old.resource_kind
  then
    raise exception
      'Correction case resource identity cannot be changed';
  end if;

  return new;
end;
$function$;

revoke all on function
  editorial.prevent_correction_case_identity_retarget()
from public, anon, authenticated;

grant execute on function
  editorial.prevent_correction_case_identity_retarget()
to service_role;

create trigger correction_cases_resource_identity_immutable
before update of resource_id, resource_kind
on editorial.correction_cases
for each row
execute function
  editorial.prevent_correction_case_identity_retarget();

create constraint trigger
  correction_cases_resource_binding_integrity
after insert or update or delete
on editorial.correction_cases
deferrable initially deferred
for each row
execute function
  editorial.assert_resource_binding_integrity();

create table editorial.correction_targets (
  id uuid primary key default gen_random_uuid(),
  case_resource_id uuid not null,
  target_resource_id uuid not null,
  target_resource_kind text not null,
  target_version_type text not null,
  target_version_id uuid not null,
  target_role text not null default 'primary',
  target_summary text,
  observed_resource_revision bigint,
  observed_content_fingerprint text,
  created_by uuid,
  created_at timestamptz not null default now(),

  constraint correction_targets_case_fkey
    foreign key (case_resource_id)
    references editorial.correction_cases(resource_id)
    on delete restrict,

  constraint correction_targets_resource_fkey
    foreign key (
      target_resource_id,
      target_resource_kind
    )
    references editorial.resources(
      id,
      resource_kind
    )
    on update cascade
    on delete restrict,

  constraint correction_targets_version_fkey
    foreign key (target_version_id)
    references editorial.article_versions(id)
    on delete restrict,

  constraint correction_targets_created_by_fkey
    foreign key (created_by)
    references auth.users(id)
    on delete set null,

  constraint correction_targets_resource_kind_check
    check (
      target_resource_kind = 'article'
    ),

  constraint correction_targets_version_type_check
    check (
      target_version_type = 'article_version'
    ),

  constraint correction_targets_role_check
    check (
      target_role in (
        'primary',
        'secondary'
      )
    ),

  constraint correction_targets_summary_check
    check (
      target_summary is null
      or nullif(
        btrim(target_summary),
        ''
      ) is not null
    ),

  constraint correction_targets_observed_revision_check
    check (
      observed_resource_revision is null
      or observed_resource_revision >= 1
    ),

  constraint correction_targets_fingerprint_check
    check (
      observed_content_fingerprint is null
      or nullif(
        btrim(observed_content_fingerprint),
        ''
      ) is not null
    ),

  constraint correction_targets_identity_unique
    unique (
      case_resource_id,
      target_resource_id,
      target_version_type,
      target_version_id,
      target_role
    )
);

create unique index correction_targets_one_primary_per_case
on editorial.correction_targets (case_resource_id)
where target_role = 'primary';

create index correction_targets_case_created_idx
on editorial.correction_targets (
  case_resource_id,
  created_at,
  id
);

create index correction_targets_resource_version_idx
on editorial.correction_targets (
  target_resource_id,
  target_version_id
);

create index correction_targets_resource_idx
on editorial.correction_targets (
  target_resource_kind,
  target_resource_id
);

create table editorial.correction_events (
  id uuid primary key default gen_random_uuid(),
  case_resource_id uuid not null,
  event_number bigint not null,
  event_type text not null,
  case_revision_before bigint not null,
  case_revision_after bigint not null,
  prior_state text,
  resulting_state text,
  actor_id uuid,
  reason text,
  decision_id uuid,
  application_id uuid,
  target_id uuid,
  evidence_link_id uuid,
  public_note_id uuid,
  related_resource_review_id uuid,
  command_receipt_id uuid,
  correlation_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint correction_events_case_fkey
    foreign key (case_resource_id)
    references editorial.correction_cases(resource_id)
    on delete restrict,

  constraint correction_events_event_type_fkey
    foreign key (event_type)
    references editorial.correction_event_types(event_type)
    on update restrict
    on delete restrict,

  constraint correction_events_target_fkey
    foreign key (target_id)
    references editorial.correction_targets(id)
    on delete restrict,

  constraint correction_events_command_receipt_fkey
    foreign key (command_receipt_id)
    references platform_private.command_receipts(id)
    on delete restrict,

  constraint correction_events_number_check
    check (
      event_number >= 1
    ),

  constraint correction_events_number_unique
    unique (
      case_resource_id,
      event_number
    ),

  constraint correction_events_revision_check
    check (
      case_revision_before >= 1
      and case_revision_after in (
        case_revision_before,
        case_revision_before + 1
      )
    ),

  constraint correction_events_creation_contract_check
    check (
      (
        event_type = 'case_created'
        and event_number = 1
        and case_revision_before = 1
        and case_revision_after = 1
        and prior_state is null
        and resulting_state = 'submitted'
        and actor_id is not null
      )
      or (
        event_type <> 'case_created'
        and event_number > 1
      )
    ),

  constraint correction_events_prior_state_check
    check (
      prior_state is null
      or prior_state in (
        'submitted',
        'triaged',
        'investigating',
        'awaiting_decision',
        'decided',
        'applied',
        'closed'
      )
    ),

  constraint correction_events_resulting_state_check
    check (
      resulting_state is null
      or resulting_state in (
        'submitted',
        'triaged',
        'investigating',
        'awaiting_decision',
        'decided',
        'applied',
        'closed'
      )
    ),

  constraint correction_events_reason_check
    check (
      reason is null
      or nullif(
        btrim(reason),
        ''
      ) is not null
    ),

  constraint correction_events_metadata_check
    check (
      jsonb_typeof(metadata) = 'object'
      and octet_length(metadata::text) <= 32768
    )
);

create index correction_events_case_created_idx
on editorial.correction_events (
  case_resource_id,
  created_at desc,
  event_number desc
);

create index correction_events_correlation_idx
on editorial.correction_events (correlation_id)
where correlation_id is not null;

create index correction_events_receipt_idx
on editorial.correction_events (command_receipt_id)
where command_receipt_id is not null;

create or replace function
  editorial.assert_correction_target_integrity()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, editorial
as $function$
declare
  v_case_state text;
  v_version_resource_id uuid;
  v_current_published_version_id uuid;
begin
  select correction_case.case_state
  into v_case_state
  from editorial.correction_cases correction_case
  where correction_case.resource_id =
    new.case_resource_id;

  if not found then
    raise exception
      'Correction target case not found';
  end if;

  if v_case_state = 'submitted' then
    raise exception
      'Submitted correction cases cannot have governed targets';
  end if;

  select version.resource_id
  into v_version_resource_id
  from editorial.article_versions version
  where version.id = new.target_version_id;

  if not found then
    raise exception
      'Correction target Article version not found';
  end if;

  if v_version_resource_id is distinct from
     new.target_resource_id
  then
    raise exception
      'Correction target Article version must belong to the target resource';
  end if;

  if not exists (
    select 1
    from editorial.article_resources binding
    where binding.resource_id =
      new.target_resource_id
      and binding.resource_kind = 'article'
  ) then
    raise exception
      'Correction target requires a valid Article resource binding';
  end if;

  select resource.current_published_version_id
  into v_current_published_version_id
  from editorial.resources resource
  where resource.id =
    new.target_resource_id
    and resource.resource_kind = 'article';

  if not found then
    raise exception
      'Correction target Article resource not found';
  end if;

  if new.target_role = 'primary'
     and v_current_published_version_id
       is distinct from new.target_version_id
  then
    raise exception
      'Primary correction target must identify the current published Article version';
  end if;

  return new;
end;
$function$;

revoke all on function
  editorial.assert_correction_target_integrity()
from public, anon, authenticated;

grant execute on function
  editorial.assert_correction_target_integrity()
to service_role;

create constraint trigger correction_targets_integrity
after insert or update
on editorial.correction_targets
deferrable initially deferred
for each row
execute function
  editorial.assert_correction_target_integrity();

create or replace function
  editorial.validate_correction_case_history(
    p_case_resource_id uuid
  )
returns void
language plpgsql
security invoker
set search_path = pg_catalog, editorial
as $function$
declare
  v_case editorial.correction_cases%rowtype;
  v_resource_kind text;
  v_resource_visibility text;
  v_event_count bigint;
  v_min_event_number bigint;
  v_max_event_number bigint;
  v_first_event editorial.correction_events%rowtype;
  v_latest_event editorial.correction_events%rowtype;
begin
  select correction_case.*
  into v_case
  from editorial.correction_cases correction_case
  where correction_case.resource_id =
    p_case_resource_id;

  if not found then
    raise exception
      'Correction case not found';
  end if;

  select
    resource.resource_kind,
    resource.visibility
  into
    v_resource_kind,
    v_resource_visibility
  from editorial.resources resource
  where resource.id =
    p_case_resource_id;

  if not found
     or v_resource_kind <> 'correction_case'
  then
    raise exception
      'Correction case must use correction_case resource identity';
  end if;

  if v_resource_visibility <> 'internal' then
    raise exception
      'Correction case resources must remain internal';
  end if;

  if v_case.case_state in (
    'decided',
    'applied',
    'closed'
  ) then
    raise exception
      'Phase 3B decision authority is not installed';
  end if;

  if v_case.case_state = 'submitted' then
    if v_case.triage_reason is not null
       or v_case.triaged_by is not null
       or v_case.triaged_at is not null
       or v_case.assigned_investigator_id
         is not null
       or v_case.assignment_reason is not null
       or v_case.assigned_at is not null
       or v_case.investigation_summary is not null
       or v_case.investigator_recommendation
         is not null
       or v_case.evidence_ready
       or v_case.submitted_for_decision_by
         is not null
       or v_case.submitted_for_decision_at
         is not null
    then
      raise exception
        'Submitted correction case contains later-state metadata';
    end if;
  else
    if nullif(
         btrim(v_case.triage_reason),
         ''
       ) is null
       or v_case.triaged_by is null
       or v_case.triaged_at is null
    then
      raise exception
        'Triaged correction case requires complete triage metadata';
    end if;

    if not exists (
      select 1
      from editorial.correction_targets target
      where target.case_resource_id =
        p_case_resource_id
        and target.target_role = 'primary'
    ) then
      raise exception
        'Triaged correction case requires one primary target';
    end if;
  end if;

  if v_case.case_state in (
    'investigating',
    'awaiting_decision'
  ) then
    if v_case.assigned_investigator_id
         is null
       or nullif(
         btrim(v_case.assignment_reason),
         ''
       ) is null
       or v_case.assigned_at is null
    then
      raise exception
        'Investigating correction case requires complete assignment metadata';
    end if;
  end if;

  if v_case.case_state = 'awaiting_decision' then
    if nullif(
         btrim(v_case.investigation_summary),
         ''
       ) is null
       or nullif(
         btrim(
           v_case.investigator_recommendation
         ),
         ''
       ) is null
       or not v_case.evidence_ready
       or v_case.submitted_for_decision_by
         is null
       or v_case.submitted_for_decision_at
         is null
    then
      raise exception
        'Awaiting-decision correction case requires complete investigation submission metadata';
    end if;
  end if;

  if v_case.case_state <>
     'awaiting_decision'
     and (
       v_case.submitted_for_decision_by
         is not null
       or v_case.submitted_for_decision_at
         is not null
     )
  then
    raise exception
      'Decision-submission metadata requires awaiting_decision state';
  end if;

  if v_case.public_note_disposition is not null
     or v_case.public_note_no_note_reason
       is not null
     or v_case.closed_reason is not null
     or v_case.closed_by is not null
     or v_case.closed_at is not null
  then
    raise exception
      'Later correction-note or closure authority is not installed';
  end if;

  select
    count(*),
    min(event.event_number),
    max(event.event_number)
  into
    v_event_count,
    v_min_event_number,
    v_max_event_number
  from editorial.correction_events event
  where event.case_resource_id =
    p_case_resource_id;

  if v_event_count < 1 then
    raise exception
      'Correction case requires an append-only case-created event';
  end if;

  if v_min_event_number <> 1
     or v_max_event_number <> v_event_count
  then
    raise exception
      'Correction event numbers must be contiguous from 1';
  end if;

  select event.*
  into v_first_event
  from editorial.correction_events event
  where event.case_resource_id =
    p_case_resource_id
  order by event.event_number
  limit 1;

  if v_first_event.event_type <>
       'case_created'
     or v_first_event.case_revision_before <> 1
     or v_first_event.case_revision_after <> 1
     or v_first_event.prior_state is not null
     or v_first_event.resulting_state <>
       'submitted'
  then
    raise exception
      'Correction history must begin with case_created at revision 1';
  end if;

  if exists (
    select 1
    from (
      select
        event.event_number,
        event.case_revision_before,
        event.case_revision_after,
        lag(
          event.case_revision_before
        ) over (
          order by event.event_number
        ) as prior_revision_before,
        lag(
          event.case_revision_after
        ) over (
          order by event.event_number
        ) as prior_revision_after
      from editorial.correction_events event
      where event.case_resource_id =
        p_case_resource_id
    ) ordered_event
    where ordered_event.event_number > 1
      and not (
        ordered_event.case_revision_before =
          ordered_event.prior_revision_after
        or (
          ordered_event.case_revision_before =
            ordered_event.prior_revision_before
          and ordered_event.case_revision_after =
            ordered_event.prior_revision_after
        )
      )
  ) then
    raise exception
      'Correction event revision chain is discontinuous';
  end if;

  select event.*
  into v_latest_event
  from editorial.correction_events event
  where event.case_resource_id =
    p_case_resource_id
  order by event.event_number desc
  limit 1;

  if v_latest_event.case_revision_after <>
       v_case.current_revision
     or v_latest_event.resulting_state <>
       v_case.case_state
  then
    raise exception
      'Correction case state and revision must match the latest event';
  end if;
end;
$function$;

revoke all on function
  editorial.validate_correction_case_history(uuid)
from public, anon, authenticated;

grant execute on function
  editorial.validate_correction_case_history(uuid)
to service_role;

create or replace function
  editorial.assert_correction_target_case_integrity()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, editorial
as $function$
begin
  if tg_op = 'DELETE' then
    perform editorial.validate_correction_case_history(
      old.case_resource_id
    );

    return old;
  end if;

  if tg_op = 'UPDATE'
     and old.case_resource_id is distinct from
       new.case_resource_id
  then
    perform editorial.validate_correction_case_history(
      old.case_resource_id
    );
  end if;

  perform editorial.validate_correction_case_history(
    new.case_resource_id
  );

  return new;
end;
$function$;

revoke all on function
  editorial.assert_correction_target_case_integrity()
from public, anon, authenticated;

grant execute on function
  editorial.assert_correction_target_case_integrity()
to service_role;

create constraint trigger correction_targets_case_integrity
after insert or update or delete
on editorial.correction_targets
deferrable initially deferred
for each row
execute function
  editorial.assert_correction_target_case_integrity();

create or replace function
  editorial.assert_correction_case_integrity()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, editorial
as $function$
begin
  perform editorial.validate_correction_case_history(
    new.resource_id
  );

  return new;
end;
$function$;

revoke all on function
  editorial.assert_correction_case_integrity()
from public, anon, authenticated;

grant execute on function
  editorial.assert_correction_case_integrity()
to service_role;

create constraint trigger correction_cases_integrity
after insert or update
on editorial.correction_cases
deferrable initially deferred
for each row
execute function
  editorial.assert_correction_case_integrity();

create or replace function
  editorial.assert_correction_event_integrity()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, editorial
as $function$
begin
  perform editorial.validate_correction_case_history(
    new.case_resource_id
  );

  return new;
end;
$function$;

revoke all on function
  editorial.assert_correction_event_integrity()
from public, anon, authenticated;

grant execute on function
  editorial.assert_correction_event_integrity()
to service_role;

create constraint trigger correction_events_integrity
after insert
on editorial.correction_events
deferrable initially deferred
for each row
execute function
  editorial.assert_correction_event_integrity();

create or replace function
  editorial.protect_correction_event()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
begin
  raise exception
    'Correction events are append-only';
end;
$function$;

revoke all on function
  editorial.protect_correction_event()
from public, anon, authenticated;

grant execute on function
  editorial.protect_correction_event()
to service_role;

create trigger correction_events_append_only
before update or delete
on editorial.correction_events
for each row
execute function
  editorial.protect_correction_event();

create or replace function
  editorial.current_user_can_view_correction(
    p_case_resource_id uuid
  )
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, editorial
as $function$
  select
    exists (
      select 1
      from editorial.correction_cases correction_case
      where correction_case.resource_id =
        p_case_resource_id
    )
    and (
      auth.role() = 'service_role'
      or coalesce(
        public.current_user_is_administrator(),
        false
      )
      or coalesce(
        public.current_user_has_capability(
          'view_corrections'
        ),
        false
      )
    );
$function$;

create or replace function
  editorial.current_user_can_triage_correction(
    p_case_resource_id uuid
  )
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, editorial
as $function$
  select
    exists (
      select 1
      from editorial.correction_cases correction_case
      where correction_case.resource_id =
        p_case_resource_id
    )
    and (
      auth.role() = 'service_role'
      or coalesce(
        public.current_user_is_administrator(),
        false
      )
      or coalesce(
        public.current_user_has_capability(
          'triage_corrections'
        ),
        false
      )
    );
$function$;

create or replace function
  editorial.current_user_can_investigate_correction(
    p_case_resource_id uuid
  )
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, editorial
as $function$
  select
    exists (
      select 1
      from editorial.correction_cases correction_case
      where correction_case.resource_id =
        p_case_resource_id
    )
    and (
      auth.role() = 'service_role'
      or coalesce(
        public.current_user_is_administrator(),
        false
      )
      or coalesce(
        public.current_user_has_capability(
          'investigate_corrections'
        ),
        false
      )
    );
$function$;

create or replace function
  editorial.current_user_can_decide_correction(
    p_case_resource_id uuid
  )
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, editorial
as $function$
  select
    exists (
      select 1
      from editorial.correction_cases correction_case
      where correction_case.resource_id =
        p_case_resource_id
    )
    and (
      auth.role() = 'service_role'
      or coalesce(
        public.current_user_is_administrator(),
        false
      )
      or coalesce(
        public.current_user_has_capability(
          'decide_corrections'
        ),
        false
      )
    );
$function$;

create or replace function
  editorial.current_user_can_apply_correction(
    p_case_resource_id uuid
  )
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, editorial
as $function$
  select
    exists (
      select 1
      from editorial.correction_cases correction_case
      where correction_case.resource_id =
        p_case_resource_id
    )
    and (
      auth.role() = 'service_role'
      or coalesce(
        public.current_user_is_administrator(),
        false
      )
      or coalesce(
        public.current_user_has_capability(
          'apply_corrections'
        ),
        false
      )
    );
$function$;

create or replace function
  editorial.current_user_can_publish_correction_note(
    p_case_resource_id uuid
  )
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, editorial
as $function$
  select
    exists (
      select 1
      from editorial.correction_cases correction_case
      where correction_case.resource_id =
        p_case_resource_id
    )
    and (
      auth.role() = 'service_role'
      or coalesce(
        public.current_user_is_administrator(),
        false
      )
      or coalesce(
        public.current_user_has_capability(
          'publish_correction_notes'
        ),
        false
      )
    );
$function$;

revoke all on function
  editorial.current_user_can_view_correction(uuid),
  editorial.current_user_can_triage_correction(uuid),
  editorial.current_user_can_investigate_correction(uuid),
  editorial.current_user_can_decide_correction(uuid),
  editorial.current_user_can_apply_correction(uuid),
  editorial.current_user_can_publish_correction_note(uuid)
from public, anon, authenticated;

grant execute on function
  editorial.current_user_can_view_correction(uuid),
  editorial.current_user_can_triage_correction(uuid),
  editorial.current_user_can_investigate_correction(uuid),
  editorial.current_user_can_decide_correction(uuid),
  editorial.current_user_can_apply_correction(uuid),
  editorial.current_user_can_publish_correction_note(uuid)
to authenticated, service_role;

alter table editorial.correction_kinds
  enable row level security;

alter table editorial.correction_evidence_roles
  enable row level security;

alter table editorial.correction_event_types
  enable row level security;

alter table editorial.correction_cases
  enable row level security;

alter table editorial.correction_targets
  enable row level security;

alter table editorial.correction_events
  enable row level security;

create policy correction_kinds_authenticated_read
on editorial.correction_kinds
for select
to authenticated
using (
  auth.uid() is not null
);

create policy correction_evidence_roles_authenticated_read
on editorial.correction_evidence_roles
for select
to authenticated
using (
  auth.uid() is not null
);

create policy correction_event_types_authenticated_read
on editorial.correction_event_types
for select
to authenticated
using (
  auth.uid() is not null
);

revoke all
on editorial.correction_kinds,
   editorial.correction_evidence_roles,
   editorial.correction_event_types,
   editorial.correction_cases,
   editorial.correction_targets,
   editorial.correction_events
from public, anon, authenticated;

grant select
on editorial.correction_kinds,
   editorial.correction_evidence_roles,
   editorial.correction_event_types
to authenticated;

grant all
on editorial.correction_kinds,
   editorial.correction_evidence_roles,
   editorial.correction_event_types,
   editorial.correction_cases,
   editorial.correction_targets,
   editorial.correction_events
to service_role;

revoke all
on sequence editorial.correction_cases_case_number_seq
from public, anon, authenticated;

grant all
on sequence editorial.correction_cases_case_number_seq
to service_role;

comment on table editorial.correction_kinds is
  'Controlled correction-kind vocabulary.';

comment on table editorial.correction_evidence_roles is
  'Controlled evidence-role vocabulary for correction investigations.';

comment on table editorial.correction_event_types is
  'Controlled append-only correction event vocabulary.';

comment on table editorial.correction_cases is
  'Stable institutional correction case identity and lifecycle state.';

comment on table editorial.correction_targets is
  'Exact resource and immutable version targets challenged by correction cases.';

comment on table editorial.correction_events is
  'Append-only reconstructable correction case history.';

commit;
