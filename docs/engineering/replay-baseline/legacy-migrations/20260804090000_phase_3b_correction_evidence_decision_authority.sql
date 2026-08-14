-- Phase 3B Migration 2: Correction evidence, decisions, and related-resource authority.
--
-- Creates:
-- 1. correction evidence links
-- 2. append-only correction decisions
-- 3. related-resource reviews
-- 4. current decision pointer and updated case integrity
-- 5. synchronous correction command registry and receipt helpers
-- 6. governed case, evidence, investigation, decision, closure, and reopen RPCs
-- 7. internal correction queue and workspace reads
--
-- This migration intentionally does not create:
-- - correction applications
-- - Article correction application authority
-- - public correction notes
-- - contributor notification jobs
-- - correction frontend authority
--
-- It creates no production correction case rows.

begin;

do $phase_3b_m2_preflight$
declare
  v_name text;
begin
  foreach v_name in array array[
    'editorial.correction_kinds',
    'editorial.correction_evidence_roles',
    'editorial.correction_event_types',
    'editorial.correction_cases',
    'editorial.correction_targets',
    'editorial.correction_events',
    'editorial.sources',
    'editorial.source_versions',
    'editorial.citations',
    'editorial.resources',
    'platform_private.command_types',
    'platform_private.command_receipts',
    'platform_private.outbox_events',
    'public.community_contributions'
  ]
  loop
    if to_regclass(v_name) is null then
      raise exception
        'STOP: Required Migration 2 dependency is missing: %',
        v_name;
    end if;
  end loop;

  foreach v_name in array array[
    'editorial.correction_evidence_links',
    'editorial.correction_decisions',
    'editorial.correction_related_resource_reviews'
  ]
  loop
    if to_regclass(v_name) is not null then
      raise exception
        'STOP: Migration 2 object already exists: %',
        v_name;
    end if;
  end loop;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'editorial'
      and table_name = 'correction_cases'
      and column_name = 'current_decision_id'
  ) then
    raise exception
      'STOP: editorial.correction_cases.current_decision_id already exists';
  end if;

  if exists (
    select 1
    from platform_private.command_types
    where command_type like 'correction.%'
  ) then
    raise exception
      'STOP: Correction command types already exist';
  end if;

  if exists (
    select 1
    from editorial.correction_cases
  ) or exists (
    select 1
    from editorial.correction_targets
  ) or exists (
    select 1
    from editorial.correction_events
  ) then
    raise exception
      'STOP: Migration 2 requires an empty correction identity foundation';
  end if;
end;
$phase_3b_m2_preflight$;

create table editorial.correction_evidence_links (
  id uuid primary key default gen_random_uuid(),
  case_resource_id uuid not null,
  source_id uuid not null,
  source_version_id uuid not null,
  citation_id uuid,
  evidence_role text not null,
  internal_note text,
  created_by uuid,
  created_at timestamptz not null default now(),

  constraint correction_evidence_links_case_fkey
    foreign key (case_resource_id)
    references editorial.correction_cases(resource_id)
    on delete restrict,

  constraint correction_evidence_links_source_fkey
    foreign key (source_id)
    references editorial.sources(id)
    on delete restrict,

  constraint correction_evidence_links_source_version_fkey
    foreign key (source_version_id)
    references editorial.source_versions(id)
    on delete restrict,

  constraint correction_evidence_links_citation_fkey
    foreign key (citation_id)
    references editorial.citations(id)
    on delete restrict,

  constraint correction_evidence_links_role_fkey
    foreign key (evidence_role)
    references editorial.correction_evidence_roles(evidence_role)
    on update restrict
    on delete restrict,

  constraint correction_evidence_links_created_by_fkey
    foreign key (created_by)
    references auth.users(id)
    on delete set null,

  constraint correction_evidence_links_note_check
    check (
      internal_note is null
      or (
        nullif(btrim(internal_note), '') is not null
        and length(internal_note) <= 4000
      )
    )
);

create unique index correction_evidence_links_identity_unique
on editorial.correction_evidence_links (
  case_resource_id,
  source_version_id,
  coalesce(
    citation_id,
    '00000000-0000-0000-0000-000000000000'::uuid
  ),
  evidence_role
);

create index correction_evidence_links_case_created_idx
on editorial.correction_evidence_links (
  case_resource_id,
  created_at,
  id
);

create index correction_evidence_links_source_version_case_idx
on editorial.correction_evidence_links (
  source_version_id,
  case_resource_id
);

create index correction_evidence_links_citation_case_idx
on editorial.correction_evidence_links (
  citation_id,
  case_resource_id
)
where citation_id is not null;

create table editorial.correction_decisions (
  id uuid primary key default gen_random_uuid(),
  case_resource_id uuid not null,
  decision_number bigint not null,
  outcome text not null,
  reason text not null,
  private_analysis text,
  public_safe_explanation text,
  case_revision_observed bigint not null,
  target_state_observed jsonb not null default '{}'::jsonb,
  duplicate_of_case_resource_id uuid,
  supersedes_decision_id uuid,
  decided_by uuid not null,
  correlation_id uuid,
  created_at timestamptz not null default now(),

  constraint correction_decisions_case_fkey
    foreign key (case_resource_id)
    references editorial.correction_cases(resource_id)
    on delete restrict,

  constraint correction_decisions_duplicate_case_fkey
    foreign key (duplicate_of_case_resource_id)
    references editorial.correction_cases(resource_id)
    on delete restrict,

  constraint correction_decisions_supersedes_fkey
    foreign key (supersedes_decision_id)
    references editorial.correction_decisions(id)
    on delete restrict,

  constraint correction_decisions_number_check
    check (decision_number >= 1),

  constraint correction_decisions_number_unique
    unique (case_resource_id, decision_number),

  constraint correction_decisions_outcome_check
    check (
      outcome in (
        'correction_required',
        'no_change_required',
        'insufficient_evidence',
        'duplicate',
        'out_of_scope'
      )
    ),

  constraint correction_decisions_reason_check
    check (
      nullif(btrim(reason), '') is not null
      and length(reason) <= 8000
    ),

  constraint correction_decisions_private_analysis_check
    check (
      private_analysis is null
      or length(private_analysis) <= 16000
    ),

  constraint correction_decisions_public_explanation_check
    check (
      public_safe_explanation is null
      or length(public_safe_explanation) <= 8000
    ),

  constraint correction_decisions_revision_check
    check (case_revision_observed >= 1),

  constraint correction_decisions_target_state_check
    check (
      jsonb_typeof(target_state_observed) = 'object'
      and octet_length(target_state_observed::text) <= 32768
    ),

  constraint correction_decisions_duplicate_contract_check
    check (
      (
        outcome = 'duplicate'
        and duplicate_of_case_resource_id is not null
        and duplicate_of_case_resource_id <> case_resource_id
      )
      or (
        outcome <> 'duplicate'
        and duplicate_of_case_resource_id is null
      )
    ),

  constraint correction_decisions_supersedes_self_check
    check (
      supersedes_decision_id is null
      or supersedes_decision_id <> id
    )
);

create index correction_decisions_case_created_idx
on editorial.correction_decisions (
  case_resource_id,
  created_at desc,
  decision_number desc
);

create index correction_decisions_outcome_created_idx
on editorial.correction_decisions (
  outcome,
  created_at desc
);

create table editorial.correction_related_resource_reviews (
  id uuid primary key default gen_random_uuid(),
  case_resource_id uuid not null,
  related_resource_id uuid not null,
  related_resource_kind text not null,
  review_state text not null default 'pending',
  disposition text,
  reason text,
  linked_correction_case_resource_id uuid,
  review_revision bigint not null default 1,
  created_by uuid,
  updated_by uuid,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint correction_related_reviews_case_fkey
    foreign key (case_resource_id)
    references editorial.correction_cases(resource_id)
    on delete restrict,

  constraint correction_related_reviews_resource_fkey
    foreign key (
      related_resource_id,
      related_resource_kind
    )
    references editorial.resources(
      id,
      resource_kind
    )
    on update cascade
    on delete restrict,

  constraint correction_related_reviews_linked_case_fkey
    foreign key (linked_correction_case_resource_id)
    references editorial.correction_cases(resource_id)
    on delete restrict,

  constraint correction_related_reviews_created_by_fkey
    foreign key (created_by)
    references auth.users(id)
    on delete set null,

  constraint correction_related_reviews_updated_by_fkey
    foreign key (updated_by)
    references auth.users(id)
    on delete set null,

  constraint correction_related_reviews_resolved_by_fkey
    foreign key (resolved_by)
    references auth.users(id)
    on delete set null,

  constraint correction_related_reviews_identity_unique
    unique (case_resource_id, related_resource_id),

  constraint correction_related_reviews_not_case_check
    check (related_resource_id <> case_resource_id),

  constraint correction_related_reviews_state_check
    check (review_state in ('pending', 'resolved')),

  constraint correction_related_reviews_disposition_check
    check (
      disposition is null
      or disposition in (
        'review_required',
        'correction_required',
        'no_action_required',
        'notification_only',
        'deferred'
      )
    ),

  constraint correction_related_reviews_revision_check
    check (review_revision >= 1),

  constraint correction_related_reviews_reason_check
    check (
      reason is null
      or (
        nullif(btrim(reason), '') is not null
        and length(reason) <= 8000
      )
    ),

  constraint correction_related_reviews_state_metadata_check
    check (
      (
        review_state = 'pending'
        and disposition is null
        and reason is null
        and linked_correction_case_resource_id is null
        and resolved_by is null
        and resolved_at is null
      )
      or (
        review_state = 'resolved'
        and disposition is not null
        and nullif(btrim(reason), '') is not null
        and resolved_by is not null
        and resolved_at is not null
        and (
          linked_correction_case_resource_id is null
          or disposition = 'correction_required'
        )
      )
    )
);

create index correction_related_reviews_case_state_updated_idx
on editorial.correction_related_resource_reviews (
  case_resource_id,
  review_state,
  updated_at desc
);

create index correction_related_reviews_resource_state_idx
on editorial.correction_related_resource_reviews (
  related_resource_id,
  review_state
);

alter table editorial.correction_cases
  add column current_decision_id uuid;

alter table editorial.correction_cases
  add constraint correction_cases_current_decision_fkey
  foreign key (current_decision_id)
  references editorial.correction_decisions(id)
  on delete restrict
  deferrable initially deferred;

create index correction_cases_current_decision_idx
on editorial.correction_cases (current_decision_id)
where current_decision_id is not null;

alter table editorial.correction_events
  add constraint correction_events_decision_fkey
  foreign key (decision_id)
  references editorial.correction_decisions(id)
  on delete restrict;

alter table editorial.correction_events
  add constraint correction_events_related_review_fkey
  foreign key (related_resource_review_id)
  references editorial.correction_related_resource_reviews(id)
  on delete restrict;

comment on column editorial.correction_events.evidence_link_id is
  'Historical evidence-link identity. It intentionally has no foreign key because governed unlink deletes the current link while preserving this UUID in append-only history.';

create or replace function
  editorial.assert_correction_evidence_integrity()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, editorial
as $function$
declare
  v_source editorial.sources%rowtype;
  v_version_source_id uuid;
  v_citation_source_id uuid;
  v_citation_source_version_id uuid;
  v_citation_state text;
begin
  select source.*
  into v_source
  from editorial.sources source
  where source.id = new.source_id;

  if not found then
    raise exception
      'Correction evidence Source does not exist';
  end if;

  if v_source.source_state <> 'active'
     or v_source.review_status <> 'approved'
     or v_source.current_approved_version_id
       is distinct from new.source_version_id
  then
    raise exception
      'Correction evidence requires the active approved Source version';
  end if;

  select version.source_id
  into v_version_source_id
  from editorial.source_versions version
  where version.id = new.source_version_id;

  if not found
     or v_version_source_id is distinct from new.source_id
  then
    raise exception
      'Correction evidence Source version must belong to the Source';
  end if;

  if new.citation_id is not null then
    select
      citation.source_id,
      citation.source_version_id,
      citation.citation_state
    into
      v_citation_source_id,
      v_citation_source_version_id,
      v_citation_state
    from editorial.citations citation
    where citation.id = new.citation_id;

    if not found
       or v_citation_source_id is distinct from new.source_id
       or v_citation_source_version_id
         is distinct from new.source_version_id
       or v_citation_state <> 'active'
    then
      raise exception
        'Correction evidence Citation must be active and match the Source and Source version';
    end if;
  end if;

  return new;
end;
$function$;

create constraint trigger correction_evidence_links_integrity
after insert or update
on editorial.correction_evidence_links
deferrable initially deferred
for each row
execute function
  editorial.assert_correction_evidence_integrity();

create or replace function
  editorial.prevent_correction_evidence_update()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
begin
  raise exception
    'Correction evidence links are replaced through governed link and unlink commands';
end;
$function$;

create trigger correction_evidence_links_no_update
before update
on editorial.correction_evidence_links
for each row
execute function
  editorial.prevent_correction_evidence_update();

create or replace function
  editorial.assert_correction_decision_integrity()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, editorial
as $function$
declare
  v_superseded_case_id uuid;
begin
  if new.supersedes_decision_id is not null then
    select decision.case_resource_id
    into v_superseded_case_id
    from editorial.correction_decisions decision
    where decision.id = new.supersedes_decision_id;

    if not found
       or v_superseded_case_id
         is distinct from new.case_resource_id
    then
      raise exception
        'Superseded decision must belong to the same correction case';
    end if;
  end if;

  return new;
end;
$function$;

create constraint trigger correction_decisions_integrity
after insert
on editorial.correction_decisions
deferrable initially deferred
for each row
execute function
  editorial.assert_correction_decision_integrity();

create or replace function
  editorial.protect_correction_decision()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
begin
  raise exception
    'Correction decisions are append-only';
end;
$function$;

create trigger correction_decisions_append_only
before update or delete
on editorial.correction_decisions
for each row
execute function
  editorial.protect_correction_decision();

create or replace function
  editorial.touch_correction_related_review_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

create trigger correction_related_reviews_touch_updated_at
before update
on editorial.correction_related_resource_reviews
for each row
execute function
  editorial.touch_correction_related_review_updated_at();

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
  v_decision_case_id uuid;
  v_decision_outcome text;
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
  where resource.id = p_case_resource_id;

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

  if v_case.case_state = 'applied' then
    raise exception
      'Phase 3B application authority is not installed';
  end if;

  if v_case.case_state = 'submitted' then
    if v_case.triage_reason is not null
       or v_case.triaged_by is not null
       or v_case.triaged_at is not null
       or v_case.assigned_investigator_id is not null
       or v_case.assignment_reason is not null
       or v_case.assigned_at is not null
       or v_case.investigation_summary is not null
       or v_case.investigator_recommendation is not null
       or v_case.evidence_ready
       or v_case.submitted_for_decision_by is not null
       or v_case.submitted_for_decision_at is not null
       or v_case.current_decision_id is not null
    then
      raise exception
        'Submitted correction case contains later-state metadata';
    end if;
  else
    if nullif(btrim(v_case.triage_reason), '') is null
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
    'awaiting_decision',
    'decided',
    'closed'
  ) then
    if v_case.assigned_investigator_id is null
       or nullif(btrim(v_case.assignment_reason), '') is null
       or v_case.assigned_at is null
    then
      raise exception
        'Active correction case requires complete assignment metadata';
    end if;
  end if;

  if v_case.case_state in (
    'awaiting_decision',
    'decided',
    'closed'
  ) then
    if nullif(btrim(v_case.investigation_summary), '') is null
       or nullif(
         btrim(v_case.investigator_recommendation),
         ''
       ) is null
       or not v_case.evidence_ready
       or v_case.submitted_for_decision_by is null
       or v_case.submitted_for_decision_at is null
    then
      raise exception
        'Decision-ready correction case requires complete investigation submission metadata';
    end if;
  elsif v_case.submitted_for_decision_by is not null
        or v_case.submitted_for_decision_at is not null
  then
    raise exception
      'Decision-submission metadata requires awaiting_decision, decided, or closed state';
  end if;

  if v_case.current_decision_id is not null then
    select
      decision.case_resource_id,
      decision.outcome
    into
      v_decision_case_id,
      v_decision_outcome
    from editorial.correction_decisions decision
    where decision.id = v_case.current_decision_id;

    if not found
       or v_decision_case_id is distinct from
         p_case_resource_id
    then
      raise exception
        'Current correction decision must belong to the same case';
    end if;
  end if;

  if v_case.case_state in ('decided', 'closed')
     and v_case.current_decision_id is null
  then
    raise exception
      'Decided or closed correction case requires a current decision';
  end if;

  if v_case.case_state = 'closed' then
    if nullif(btrim(v_case.closed_reason), '') is null
       or v_case.closed_by is null
       or v_case.closed_at is null
    then
      raise exception
        'Closed correction case requires complete closure metadata';
    end if;

    if v_decision_outcome = 'correction_required' then
      raise exception
        'Correction-required cases cannot close before application authority exists';
    end if;

    if exists (
      select 1
      from editorial.correction_related_resource_reviews review
      where review.case_resource_id = p_case_resource_id
        and review.review_state = 'pending'
    ) then
      raise exception
        'Closed correction case cannot retain pending related-resource reviews';
    end if;
  elsif v_case.closed_reason is not null
        or v_case.closed_by is not null
        or v_case.closed_at is not null
  then
    raise exception
      'Closure metadata requires closed state';
  end if;

  if v_case.public_note_disposition is not null
     or v_case.public_note_no_note_reason is not null
  then
    raise exception
      'Public correction-note authority is not installed';
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

  if v_first_event.event_type <> 'case_created'
     or v_first_event.case_revision_before <> 1
     or v_first_event.case_revision_after <> 1
     or v_first_event.prior_state is not null
     or v_first_event.resulting_state <> 'submitted'
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
        lag(event.case_revision_before) over (
          order by event.event_number
        ) as prior_revision_before,
        lag(event.case_revision_after) over (
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

create or replace function
  editorial.assert_correction_evidence_case_integrity()
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

  perform editorial.validate_correction_case_history(
    new.case_resource_id
  );
  return new;
end;
$function$;

create constraint trigger correction_evidence_links_case_integrity
after insert or delete
on editorial.correction_evidence_links
deferrable initially deferred
for each row
execute function
  editorial.assert_correction_evidence_case_integrity();

create or replace function
  editorial.assert_correction_decision_case_integrity()
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

create constraint trigger correction_decisions_case_integrity
after insert
on editorial.correction_decisions
deferrable initially deferred
for each row
execute function
  editorial.assert_correction_decision_case_integrity();

create or replace function
  editorial.assert_correction_related_review_case_integrity()
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

  perform editorial.validate_correction_case_history(
    new.case_resource_id
  );
  return new;
end;
$function$;

create constraint trigger correction_related_reviews_case_integrity
after insert or update or delete
on editorial.correction_related_resource_reviews
deferrable initially deferred
for each row
execute function
  editorial.assert_correction_related_review_case_integrity();

insert into platform_private.command_types (
  command_type,
  job_type,
  accepted_event_type,
  success_event_type,
  failure_event_type,
  retry_event_type
)
values
  (
    'correction.case.create_from_contribution',
    'correction.case.create_from_contribution.sync',
    'correction.case.create_from_contribution.accepted',
    'correction.case.create_from_contribution.succeeded',
    'correction.case.create_from_contribution.failed',
    'correction.case.create_from_contribution.retry_scheduled'
  ),
  (
    'correction.case.create_internal',
    'correction.case.create_internal.sync',
    'correction.case.create_internal.accepted',
    'correction.case.create_internal.succeeded',
    'correction.case.create_internal.failed',
    'correction.case.create_internal.retry_scheduled'
  ),
  (
    'correction.case.triage',
    'correction.case.triage.sync',
    'correction.case.triage.accepted',
    'correction.case.triage.succeeded',
    'correction.case.triage.failed',
    'correction.case.triage.retry_scheduled'
  ),
  (
    'correction.case.assign',
    'correction.case.assign.sync',
    'correction.case.assign.accepted',
    'correction.case.assign.succeeded',
    'correction.case.assign.failed',
    'correction.case.assign.retry_scheduled'
  ),
  (
    'correction.evidence.link',
    'correction.evidence.link.sync',
    'correction.evidence.link.accepted',
    'correction.evidence.link.succeeded',
    'correction.evidence.link.failed',
    'correction.evidence.link.retry_scheduled'
  ),
  (
    'correction.evidence.unlink',
    'correction.evidence.unlink.sync',
    'correction.evidence.unlink.accepted',
    'correction.evidence.unlink.succeeded',
    'correction.evidence.unlink.failed',
    'correction.evidence.unlink.retry_scheduled'
  ),
  (
    'correction.investigation.update',
    'correction.investigation.update.sync',
    'correction.investigation.update.accepted',
    'correction.investigation.update.succeeded',
    'correction.investigation.update.failed',
    'correction.investigation.update.retry_scheduled'
  ),
  (
    'correction.case.submit_for_decision',
    'correction.case.submit_for_decision.sync',
    'correction.case.submit_for_decision.accepted',
    'correction.case.submit_for_decision.succeeded',
    'correction.case.submit_for_decision.failed',
    'correction.case.submit_for_decision.retry_scheduled'
  ),
  (
    'correction.case.return_to_investigation',
    'correction.case.return_to_investigation.sync',
    'correction.case.return_to_investigation.accepted',
    'correction.case.return_to_investigation.succeeded',
    'correction.case.return_to_investigation.failed',
    'correction.case.return_to_investigation.retry_scheduled'
  ),
  (
    'correction.decision.record',
    'correction.decision.record.sync',
    'correction.decision.record.accepted',
    'correction.decision.record.succeeded',
    'correction.decision.record.failed',
    'correction.decision.record.retry_scheduled'
  ),
  (
    'correction.related_resource.add',
    'correction.related_resource.add.sync',
    'correction.related_resource.add.accepted',
    'correction.related_resource.add.succeeded',
    'correction.related_resource.add.failed',
    'correction.related_resource.add.retry_scheduled'
  ),
  (
    'correction.related_resource.disposition',
    'correction.related_resource.disposition.sync',
    'correction.related_resource.disposition.accepted',
    'correction.related_resource.disposition.succeeded',
    'correction.related_resource.disposition.failed',
    'correction.related_resource.disposition.retry_scheduled'
  ),
  (
    'correction.case.close',
    'correction.case.close.sync',
    'correction.case.close.accepted',
    'correction.case.close.succeeded',
    'correction.case.close.failed',
    'correction.case.close.retry_scheduled'
  ),
  (
    'correction.case.reopen',
    'correction.case.reopen.sync',
    'correction.case.reopen.accepted',
    'correction.case.reopen.succeeded',
    'correction.case.reopen.failed',
    'correction.case.reopen.retry_scheduled'
  );

create or replace function
  platform_private.correction_actor_context()
returns table (
  actor_user_id uuid,
  auth_role text,
  principal_key text
)
language plpgsql
security definer
set search_path = pg_catalog, auth
as $function$
declare
  v_role text;
  v_actor uuid;
begin
  v_role := coalesce(auth.role(), '');
  v_actor := auth.uid();

  if v_role not in ('authenticated', 'service_role') then
    raise exception
      using
        errcode = '42501',
        message = 'Authentication is required.';
  end if;

  if v_actor is null then
    raise exception
      using
        errcode = '42501',
        message = 'An authenticated actor identity is required.';
  end if;

  return query
  select
    v_actor,
    v_role,
    case
      when v_role = 'service_role'
        then 'service:service_role'
      else 'user:' || v_actor::text
    end;
end;
$function$;

create or replace function
  platform_private.assert_correction_capability(
    p_capability text
  )
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, platform_private
as $function$
declare
  v_context record;
begin
  select *
  into v_context
  from platform_private.correction_actor_context();

  if v_context.auth_role <> 'service_role'
     and not coalesce(
       public.current_user_is_administrator(),
       false
     )
     and not coalesce(
       public.current_user_has_capability(
         p_capability
       ),
       false
     )
  then
    raise exception
      using
        errcode = '42501',
        message = 'The caller does not hold the required correction capability.';
  end if;

  return v_context.actor_user_id;
end;
$function$;

create or replace function
  platform_private.correction_request_fingerprint(
    p_command_type text,
    p_resource_id uuid,
    p_request_payload jsonb
  )
returns text
language sql
immutable
security invoker
set search_path = pg_catalog, extensions
as $function$
  select encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'command_type', p_command_type,
          'resource_id', p_resource_id,
          'request_payload', p_request_payload
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$function$;

create or replace function
  platform_private.begin_resource_command(
    p_command_type text,
    p_resource_id uuid,
    p_idempotency_key text,
    p_request_payload jsonb
  )
returns table (
  command_receipt_id uuid,
  receipt_status text,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path =
  pg_catalog,
  auth,
  platform_private
as $function$
declare
  v_context record;
  v_fingerprint text;
  v_receipt platform_private.command_receipts%rowtype;
  v_created boolean;
begin
  if p_resource_id is null then
    raise exception
      using errcode = '22023',
      message = 'resource_id is required.';
  end if;

  if p_idempotency_key is null
     or p_idempotency_key !~
       '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
  then
    raise exception
      using errcode = '22023',
      message = 'idempotency_key must contain 8 to 128 permitted characters.';
  end if;

  if p_request_payload is null
     or jsonb_typeof(p_request_payload) <> 'object'
     or octet_length(p_request_payload::text) > 32768
  then
    raise exception
      using errcode = '22023',
      message = 'request_payload must be a JSON object no larger than 32 KB.';
  end if;

  if not exists (
    select 1
    from platform_private.command_types command_type
    where command_type.command_type = p_command_type
      and command_type.enabled
      and p_command_type like 'correction.%'
  ) then
    raise exception
      using errcode = '22023',
      message = 'The correction command type is missing or disabled.';
  end if;

  select *
  into v_context
  from platform_private.correction_actor_context();

  v_fingerprint :=
    platform_private.correction_request_fingerprint(
      p_command_type,
      p_resource_id,
      p_request_payload
    );

  insert into platform_private.command_receipts (
    command_type,
    resource_id,
    principal_key,
    actor_user_id,
    idempotency_key,
    request_fingerprint,
    request_payload
  )
  values (
    p_command_type,
    p_resource_id,
    v_context.principal_key,
    v_context.actor_user_id,
    p_idempotency_key,
    v_fingerprint,
    p_request_payload
  )
  on conflict (
    principal_key,
    command_type,
    idempotency_key
  )
  do nothing
  returning *
  into v_receipt;

  v_created := found;

  if not v_created then
    select receipt.*
    into v_receipt
    from platform_private.command_receipts receipt
    where receipt.principal_key =
        v_context.principal_key
      and receipt.command_type =
        p_command_type
      and receipt.idempotency_key =
        p_idempotency_key
    for update;

    if not found then
      raise exception
        'The idempotency receipt disappeared.';
    end if;

    if v_receipt.request_fingerprint <>
       v_fingerprint
    then
      raise exception
        using
          errcode = '23505',
          message = 'The idempotency key was already used for a different request.';
    end if;

    return query
    select
      v_receipt.id,
      v_receipt.status,
      v_receipt.result_payload,
      true;
    return;
  end if;

  insert into platform_private.outbox_events (
    event_key,
    command_receipt_id,
    command_type,
    aggregate_id,
    event_type,
    payload
  )
  select
    'command:' ||
      v_receipt.id::text ||
      ':accepted',
    v_receipt.id,
    command_type.command_type,
    p_resource_id,
    command_type.accepted_event_type,
    jsonb_build_object(
      'command_receipt_id', v_receipt.id,
      'command_type', p_command_type,
      'resource_id', p_resource_id,
      'principal_key', v_context.principal_key,
      'accepted_at', now()
    )
  from platform_private.command_types command_type
  where command_type.command_type =
    p_command_type;

  return query
  select
    v_receipt.id,
    v_receipt.status,
    v_receipt.result_payload,
    false;
end;
$function$;

create or replace function
  platform_private.begin_correction_create_command(
    p_command_type text,
    p_idempotency_key text,
    p_request_payload jsonb
  )
returns table (
  case_resource_id uuid,
  command_receipt_id uuid,
  receipt_status text,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path =
  pg_catalog,
  auth,
  editorial,
  platform_private
as $function$
declare
  v_context record;
  v_fingerprint text;
  v_receipt platform_private.command_receipts%rowtype;
  v_resource_id uuid := gen_random_uuid();
begin
  if p_idempotency_key is null
     or p_idempotency_key !~
       '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
  then
    raise exception
      using errcode = '22023',
      message = 'idempotency_key must contain 8 to 128 permitted characters.';
  end if;

  if p_request_payload is null
     or jsonb_typeof(p_request_payload) <> 'object'
     or octet_length(p_request_payload::text) > 32768
  then
    raise exception
      using errcode = '22023',
      message = 'request_payload must be a JSON object no larger than 32 KB.';
  end if;

  if p_command_type not in (
    'correction.case.create_from_contribution',
    'correction.case.create_internal'
  ) then
    raise exception
      using errcode = '22023',
      message = 'Unsupported correction case creation command.';
  end if;

  select *
  into v_context
  from platform_private.correction_actor_context();

  v_fingerprint :=
    platform_private.correction_request_fingerprint(
      p_command_type,
      null,
      p_request_payload
    );

  select receipt.*
  into v_receipt
  from platform_private.command_receipts receipt
  where receipt.principal_key =
      v_context.principal_key
    and receipt.command_type =
      p_command_type
    and receipt.idempotency_key =
      p_idempotency_key
  for update;

  if found then
    if v_receipt.request_fingerprint <>
       v_fingerprint
    then
      raise exception
        using
          errcode = '23505',
          message = 'The idempotency key was already used for a different request.';
    end if;

    return query
    select
      v_receipt.resource_id,
      v_receipt.id,
      v_receipt.status,
      v_receipt.result_payload,
      true;
    return;
  end if;

  insert into editorial.resources (
    id,
    resource_kind,
    visibility,
    lifecycle_state,
    created_by
  )
  values (
    v_resource_id,
    'correction_case',
    'internal',
    'active',
    v_context.actor_user_id
  );

  begin
    insert into platform_private.command_receipts (
      command_type,
      resource_id,
      principal_key,
      actor_user_id,
      idempotency_key,
      request_fingerprint,
      request_payload
    )
    values (
      p_command_type,
      v_resource_id,
      v_context.principal_key,
      v_context.actor_user_id,
      p_idempotency_key,
      v_fingerprint,
      p_request_payload
    )
    returning *
    into v_receipt;
  exception
    when unique_violation then
      delete from editorial.resources
      where id = v_resource_id;

      select receipt.*
      into v_receipt
      from platform_private.command_receipts receipt
      where receipt.principal_key =
          v_context.principal_key
        and receipt.command_type =
          p_command_type
        and receipt.idempotency_key =
          p_idempotency_key
      for update;

      if not found then
        raise;
      end if;

      if v_receipt.request_fingerprint <>
         v_fingerprint
      then
        raise exception
          using
            errcode = '23505',
            message = 'The idempotency key was already used for a different request.';
      end if;

      return query
      select
        v_receipt.resource_id,
        v_receipt.id,
        v_receipt.status,
        v_receipt.result_payload,
        true;
      return;
  end;

  insert into platform_private.outbox_events (
    event_key,
    command_receipt_id,
    command_type,
    aggregate_id,
    event_type,
    payload
  )
  select
    'command:' ||
      v_receipt.id::text ||
      ':accepted',
    v_receipt.id,
    command_type.command_type,
    v_resource_id,
    command_type.accepted_event_type,
    jsonb_build_object(
      'command_receipt_id', v_receipt.id,
      'command_type', p_command_type,
      'resource_id', v_resource_id,
      'principal_key', v_context.principal_key,
      'accepted_at', now()
    )
  from platform_private.command_types command_type
  where command_type.command_type =
    p_command_type;

  return query
  select
    v_resource_id,
    v_receipt.id,
    v_receipt.status,
    v_receipt.result_payload,
    false;
end;
$function$;

create or replace function
  platform_private.complete_resource_command(
    p_command_receipt_id uuid,
    p_result_payload jsonb
  )
returns void
language plpgsql
security definer
set search_path = pg_catalog, platform_private
as $function$
declare
  v_receipt platform_private.command_receipts%rowtype;
begin
  if p_result_payload is null
     or jsonb_typeof(p_result_payload) <> 'object'
     or octet_length(p_result_payload::text) > 32768
  then
    raise exception
      using errcode = '22023',
      message = 'result_payload must be a JSON object no larger than 32 KB.';
  end if;

  select receipt.*
  into v_receipt
  from platform_private.command_receipts receipt
  where receipt.id = p_command_receipt_id
  for update;

  if not found then
    raise exception
      'Command receipt does not exist.';
  end if;

  if v_receipt.status <> 'accepted' then
    raise exception
      'Only accepted command receipts may complete.';
  end if;

  update platform_private.command_receipts
  set
    status = 'succeeded',
    result_payload = p_result_payload,
    error_code = null,
    error_message = null,
    completed_at = now()
  where id = p_command_receipt_id;

  insert into platform_private.outbox_events (
    event_key,
    command_receipt_id,
    command_type,
    aggregate_id,
    event_type,
    payload
  )
  select
    'command:' ||
      v_receipt.id::text ||
      ':succeeded',
    v_receipt.id,
    command_type.command_type,
    v_receipt.resource_id,
    command_type.success_event_type,
    jsonb_build_object(
      'command_receipt_id', v_receipt.id,
      'command_type', v_receipt.command_type,
      'resource_id', v_receipt.resource_id,
      'result', p_result_payload,
      'completed_at', now()
    )
  from platform_private.command_types command_type
  where command_type.command_type =
    v_receipt.command_type;
end;
$function$;

create or replace function
  platform_private.reject_resource_command(
    p_command_receipt_id uuid,
    p_error_code text,
    p_error_message text,
    p_result_payload jsonb
  )
returns void
language plpgsql
security definer
set search_path = pg_catalog, platform_private
as $function$
declare
  v_receipt platform_private.command_receipts%rowtype;
begin
  if nullif(btrim(p_error_code), '') is null
     or nullif(btrim(p_error_message), '') is null
  then
    raise exception
      using errcode = '22023',
      message = 'error_code and error_message are required.';
  end if;

  if p_result_payload is null
     or jsonb_typeof(p_result_payload) <> 'object'
     or octet_length(p_result_payload::text) > 32768
  then
    raise exception
      using errcode = '22023',
      message = 'result_payload must be a JSON object no larger than 32 KB.';
  end if;

  select receipt.*
  into v_receipt
  from platform_private.command_receipts receipt
  where receipt.id = p_command_receipt_id
  for update;

  if not found then
    raise exception
      'Command receipt does not exist.';
  end if;

  if v_receipt.status <> 'accepted' then
    raise exception
      'Only accepted command receipts may be rejected.';
  end if;

  update platform_private.command_receipts
  set
    status = 'rejected',
    result_payload = p_result_payload,
    error_code = p_error_code,
    error_message = p_error_message,
    completed_at = now()
  where id = p_command_receipt_id;

  insert into platform_private.outbox_events (
    event_key,
    command_receipt_id,
    command_type,
    aggregate_id,
    event_type,
    payload
  )
  select
    'command:' ||
      v_receipt.id::text ||
      ':failed',
    v_receipt.id,
    command_type.command_type,
    v_receipt.resource_id,
    command_type.failure_event_type,
    jsonb_build_object(
      'command_receipt_id', v_receipt.id,
      'command_type', v_receipt.command_type,
      'resource_id', v_receipt.resource_id,
      'error_code', p_error_code,
      'error_message', p_error_message,
      'result', p_result_payload,
      'completed_at', now()
    )
  from platform_private.command_types command_type
  where command_type.command_type =
    v_receipt.command_type;
end;
$function$;

create or replace function
  platform_private.append_correction_event(
    p_case_resource_id uuid,
    p_event_type text,
    p_case_revision_before bigint,
    p_case_revision_after bigint,
    p_prior_state text,
    p_resulting_state text,
    p_actor_id uuid,
    p_reason text,
    p_decision_id uuid default null,
    p_target_id uuid default null,
    p_evidence_link_id uuid default null,
    p_related_resource_review_id uuid default null,
    p_command_receipt_id uuid default null,
    p_correlation_id uuid default null,
    p_metadata jsonb default '{}'::jsonb
  )
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, editorial
as $function$
declare
  v_event_number bigint;
  v_event_id uuid;
begin
  if p_metadata is null
     or jsonb_typeof(p_metadata) <> 'object'
     or octet_length(p_metadata::text) > 32768
  then
    raise exception
      using errcode = '22023',
      message = 'Correction event metadata must be a JSON object no larger than 32 KB.';
  end if;

  perform 1
  from editorial.correction_cases correction_case
  where correction_case.resource_id =
    p_case_resource_id
  for update;

  if not found then
    raise exception
      'Correction case does not exist.';
  end if;

  select coalesce(max(event.event_number), 0) + 1
  into v_event_number
  from editorial.correction_events event
  where event.case_resource_id =
    p_case_resource_id;

  insert into editorial.correction_events (
    case_resource_id,
    event_number,
    event_type,
    case_revision_before,
    case_revision_after,
    prior_state,
    resulting_state,
    actor_id,
    reason,
    decision_id,
    target_id,
    evidence_link_id,
    related_resource_review_id,
    command_receipt_id,
    correlation_id,
    metadata
  )
  values (
    p_case_resource_id,
    v_event_number,
    p_event_type,
    p_case_revision_before,
    p_case_revision_after,
    p_prior_state,
    p_resulting_state,
    p_actor_id,
    p_reason,
    p_decision_id,
    p_target_id,
    p_evidence_link_id,
    p_related_resource_review_id,
    p_command_receipt_id,
    p_correlation_id,
    p_metadata
  )
  returning id
  into v_event_id;

  return v_event_id;
end;
$function$;

create or replace function
  platform_private.read_correction_command_result(
    p_command_receipt_id uuid,
    p_idempotent_replay boolean
  )
returns table (
  command_receipt_id uuid,
  receipt_status text,
  case_resource_id uuid,
  case_revision bigint,
  result_payload jsonb,
  idempotent_replay boolean
)
language sql
stable
security definer
set search_path = pg_catalog, editorial, platform_private
as $function$
  select
    receipt.id,
    receipt.status,
    receipt.resource_id,
    coalesce(
      nullif(
        receipt.result_payload ->> 'case_revision',
        ''
      )::bigint,
      correction_case.current_revision
    ),
    receipt.result_payload,
    p_idempotent_replay
  from platform_private.command_receipts receipt
  left join editorial.correction_cases correction_case
    on correction_case.resource_id =
      receipt.resource_id
  where receipt.id =
    p_command_receipt_id;
$function$;


create or replace function
  public.create_correction_case_from_contribution(
    p_contribution_id uuid,
    p_origin_summary text,
    p_correction_kind text,
    p_idempotency_key text,
    p_correlation_id uuid
  )
returns table (
  command_receipt_id uuid,
  receipt_status text,
  case_resource_id uuid,
  case_revision bigint,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path =
  pg_catalog,
  public,
  auth,
  editorial,
  platform_private
as $function$
declare
  v_actor uuid;
  v_contribution public.community_contributions%rowtype;
  v_context record;
  v_existing_receipt platform_private.command_receipts%rowtype;
  v_request_payload jsonb;
  v_request_fingerprint text;
  v_begin record;
  v_result jsonb;
begin
  v_actor :=
    platform_private.assert_correction_capability(
      'triage_corrections'
    );

  if p_contribution_id is null
     or p_correlation_id is null
     or nullif(btrim(p_origin_summary), '') is null
     or length(p_origin_summary) > 8000
  then
    raise exception
      using errcode = '22023',
      message = 'Contribution, summary, and correlation identity are required.';
  end if;

  if not exists (
    select 1
    from editorial.correction_kinds kind
    where kind.correction_kind = p_correction_kind
      and kind.enabled
  ) then
    raise exception
      using errcode = '22023',
      message = 'The correction kind is not enabled.';
  end if;

  select contribution.*
  into v_contribution
  from public.community_contributions contribution
  where contribution.id = p_contribution_id;

  if not found then
    raise exception
      using errcode = 'P0002',
      message = 'The contribution does not exist.';
  end if;

  v_request_payload := jsonb_build_object(
    'contribution_id', p_contribution_id,
    'origin_summary', btrim(p_origin_summary),
    'correction_kind', p_correction_kind,
    'correlation_id', p_correlation_id
  );

  select *
  into v_context
  from platform_private.correction_actor_context();

  v_request_fingerprint :=
    platform_private.correction_request_fingerprint(
      'correction.case.create_from_contribution',
      null,
      v_request_payload
    );

  select receipt.*
  into v_existing_receipt
  from platform_private.command_receipts receipt
  where receipt.principal_key =
      v_context.principal_key
    and receipt.command_type =
      'correction.case.create_from_contribution'
    and receipt.idempotency_key =
      p_idempotency_key
  for update;

  if found then
    if v_existing_receipt.request_fingerprint
         <> v_request_fingerprint
    then
      raise exception
        using
          errcode = '23505',
          message = 'The idempotency key was already used for a different request.';
    end if;

    return query
    select *
    from platform_private.read_correction_command_result(
      v_existing_receipt.id,
      true
    );
    return;
  end if;

  if exists (
    select 1
    from editorial.correction_cases correction_case
    where correction_case.origin_contribution_id =
      p_contribution_id
  ) then
    raise exception
      using errcode = '23505',
      message = 'The contribution already has a controlling correction case.';
  end if;

  select *
  into v_begin
  from platform_private.begin_correction_create_command(
    'correction.case.create_from_contribution',
    p_idempotency_key,
    v_request_payload
  );

  if v_begin.idempotent_replay then
    return query
    select *
    from platform_private.read_correction_command_result(
      v_begin.command_receipt_id,
      true
    );
    return;
  end if;

  insert into editorial.correction_cases (
    resource_id,
    origin_type,
    origin_contribution_id,
    origin_submitter_user_id,
    origin_submitted_at,
    origin_type_snapshot,
    origin_summary_snapshot,
    correction_kind,
    created_by,
    updated_by
  )
  values (
    v_begin.case_resource_id,
    'community_contribution',
    v_contribution.id,
    v_contribution.user_id,
    v_contribution.created_at,
    v_contribution.contribution_type,
    btrim(p_origin_summary),
    p_correction_kind,
    v_actor,
    v_actor
  );

  insert into editorial.correction_events (
    case_resource_id,
    event_number,
    event_type,
    case_revision_before,
    case_revision_after,
    prior_state,
    resulting_state,
    actor_id,
    reason,
    command_receipt_id,
    correlation_id,
    metadata
  )
  values (
    v_begin.case_resource_id,
    1,
    'case_created',
    1,
    1,
    null,
    'submitted',
    v_actor,
    'Created from community contribution.',
    v_begin.command_receipt_id,
    p_correlation_id,
    jsonb_build_object(
      'principal_key',
      (
        select receipt.principal_key
        from platform_private.command_receipts receipt
        where receipt.id =
          v_begin.command_receipt_id
      ),
      'origin_type',
      'community_contribution',
      'origin_contribution_id',
      v_contribution.id,
      'origin_contribution_type',
      v_contribution.contribution_type,
      'origin_entity_type',
      v_contribution.entity_type,
      'origin_entity_id',
      v_contribution.entity_id,
      'origin_entity_slug',
      v_contribution.entity_slug
    )
  );

  v_result := jsonb_build_object(
    'case_resource_id', v_begin.case_resource_id,
    'case_revision', 1,
    'case_state', 'submitted',
    'origin_contribution_id', v_contribution.id
  );

  perform platform_private.complete_resource_command(
    v_begin.command_receipt_id,
    v_result
  );

  return query
  select *
  from platform_private.read_correction_command_result(
    v_begin.command_receipt_id,
    false
  );
end;
$function$;

create or replace function
  public.create_internal_correction_case(
    p_origin_summary text,
    p_correction_kind text,
    p_priority text,
    p_idempotency_key text,
    p_correlation_id uuid
  )
returns table (
  command_receipt_id uuid,
  receipt_status text,
  case_resource_id uuid,
  case_revision bigint,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path =
  pg_catalog,
  public,
  auth,
  editorial,
  platform_private
as $function$
declare
  v_actor uuid;
  v_begin record;
  v_result jsonb;
begin
  v_actor :=
    platform_private.assert_correction_capability(
      'triage_corrections'
    );

  if p_correlation_id is null
     or nullif(btrim(p_origin_summary), '') is null
     or length(p_origin_summary) > 8000
     or p_priority not in (
       'low',
       'normal',
       'high',
       'urgent'
     )
  then
    raise exception
      using errcode = '22023',
      message = 'Summary, priority, and correlation identity are required.';
  end if;

  if not exists (
    select 1
    from editorial.correction_kinds kind
    where kind.correction_kind = p_correction_kind
      and kind.enabled
  ) then
    raise exception
      using errcode = '22023',
      message = 'The correction kind is not enabled.';
  end if;

  select *
  into v_begin
  from platform_private.begin_correction_create_command(
    'correction.case.create_internal',
    p_idempotency_key,
    jsonb_build_object(
      'origin_summary', btrim(p_origin_summary),
      'correction_kind', p_correction_kind,
      'priority', p_priority,
      'correlation_id', p_correlation_id
    )
  );

  if v_begin.idempotent_replay then
    return query
    select *
    from platform_private.read_correction_command_result(
      v_begin.command_receipt_id,
      true
    );
    return;
  end if;

  insert into editorial.correction_cases (
    resource_id,
    origin_type,
    origin_summary_snapshot,
    correction_kind,
    priority,
    created_by,
    updated_by
  )
  values (
    v_begin.case_resource_id,
    'internal_editorial',
    btrim(p_origin_summary),
    p_correction_kind,
    p_priority,
    v_actor,
    v_actor
  );

  insert into editorial.correction_events (
    case_resource_id,
    event_number,
    event_type,
    case_revision_before,
    case_revision_after,
    prior_state,
    resulting_state,
    actor_id,
    reason,
    command_receipt_id,
    correlation_id,
    metadata
  )
  values (
    v_begin.case_resource_id,
    1,
    'case_created',
    1,
    1,
    null,
    'submitted',
    v_actor,
    'Created through internal editorial authority.',
    v_begin.command_receipt_id,
    p_correlation_id,
    jsonb_build_object(
      'principal_key',
      (
        select receipt.principal_key
        from platform_private.command_receipts receipt
        where receipt.id =
          v_begin.command_receipt_id
      ),
      'origin_type',
      'internal_editorial'
    )
  );

  v_result := jsonb_build_object(
    'case_resource_id', v_begin.case_resource_id,
    'case_revision', 1,
    'case_state', 'submitted'
  );

  perform platform_private.complete_resource_command(
    v_begin.command_receipt_id,
    v_result
  );

  return query
  select *
  from platform_private.read_correction_command_result(
    v_begin.command_receipt_id,
    false
  );
end;
$function$;

create or replace function
  public.triage_correction_case(
    p_case_resource_id uuid,
    p_expected_case_revision bigint,
    p_correction_kind text,
    p_priority text,
    p_target_resource_id uuid,
    p_target_version_id uuid,
    p_target_summary text,
    p_reason text,
    p_idempotency_key text,
    p_correlation_id uuid
  )
returns table (
  command_receipt_id uuid,
  receipt_status text,
  case_resource_id uuid,
  case_revision bigint,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path =
  pg_catalog,
  public,
  auth,
  editorial,
  platform_private
as $function$
declare
  v_actor uuid;
  v_begin record;
  v_case editorial.correction_cases%rowtype;
  v_target_id uuid;
  v_result jsonb;
begin
  v_actor :=
    platform_private.assert_correction_capability(
      'triage_corrections'
    );

  if p_case_resource_id is null
     or p_expected_case_revision < 1
     or p_target_resource_id is null
     or p_target_version_id is null
     or p_correlation_id is null
     or p_priority not in (
       'low',
       'normal',
       'high',
       'urgent'
     )
     or nullif(btrim(p_reason), '') is null
  then
    raise exception
      using errcode = '22023',
      message = 'Case, revision, target, priority, reason, and correlation identity are required.';
  end if;

  if not exists (
    select 1
    from editorial.correction_kinds kind
    where kind.correction_kind = p_correction_kind
      and kind.enabled
  ) then
    raise exception
      using errcode = '22023',
      message = 'The correction kind is not enabled.';
  end if;

  select *
  into v_begin
  from platform_private.begin_resource_command(
    'correction.case.triage',
    p_case_resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'expected_case_revision', p_expected_case_revision,
      'correction_kind', p_correction_kind,
      'priority', p_priority,
      'target_resource_id', p_target_resource_id,
      'target_version_id', p_target_version_id,
      'target_summary', nullif(btrim(p_target_summary), ''),
      'reason', btrim(p_reason),
      'correlation_id', p_correlation_id
    )
  );

  if v_begin.idempotent_replay then
    return query
    select *
    from platform_private.read_correction_command_result(
      v_begin.command_receipt_id,
      true
    );
    return;
  end if;

  select correction_case.*
  into v_case
  from editorial.correction_cases correction_case
  where correction_case.resource_id =
    p_case_resource_id
  for update;

  if not found then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'case_not_found',
      'The correction case does not exist.',
      jsonb_build_object(
        'case_revision', null
      )
    );

    return query
    select *
    from platform_private.read_correction_command_result(
      v_begin.command_receipt_id,
      false
    );
    return;
  end if;

  if v_case.current_revision <>
     p_expected_case_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'case_revision_changed',
      'The correction case revision changed.',
      jsonb_build_object(
        'case_revision', v_case.current_revision,
        'case_state', v_case.case_state
      )
    );

    return query
    select *
    from platform_private.read_correction_command_result(
      v_begin.command_receipt_id,
      false
    );
    return;
  end if;

  if v_case.case_state <> 'submitted' then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'invalid_transition',
      'Only submitted correction cases may be triaged.',
      jsonb_build_object(
        'case_revision', v_case.current_revision,
        'case_state', v_case.case_state
      )
    );

    return query
    select *
    from platform_private.read_correction_command_result(
      v_begin.command_receipt_id,
      false
    );
    return;
  end if;

  if not exists (
    select 1
    from editorial.resources resource
    join editorial.article_versions version
      on version.id = p_target_version_id
     and version.resource_id =
       p_target_resource_id
    where resource.id = p_target_resource_id
      and resource.resource_kind = 'article'
      and resource.current_published_version_id =
        p_target_version_id
  ) then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'target_changed',
      'The primary target must identify the current published Article version.',
      jsonb_build_object(
        'case_revision', v_case.current_revision,
        'case_state', v_case.case_state
      )
    );

    return query
    select *
    from platform_private.read_correction_command_result(
      v_begin.command_receipt_id,
      false
    );
    return;
  end if;

  update editorial.correction_cases
  set
    correction_kind = p_correction_kind,
    priority = p_priority,
    case_state = 'triaged',
    current_revision =
      v_case.current_revision + 1,
    triage_reason = btrim(p_reason),
    triaged_by = v_actor,
    triaged_at = now(),
    updated_by = v_actor,
    updated_at = now()
  where resource_id = p_case_resource_id;

  insert into editorial.correction_targets (
    case_resource_id,
    target_resource_id,
    target_resource_kind,
    target_version_type,
    target_version_id,
    target_role,
    target_summary,
    created_by
  )
  values (
    p_case_resource_id,
    p_target_resource_id,
    'article',
    'article_version',
    p_target_version_id,
    'primary',
    nullif(btrim(p_target_summary), ''),
    v_actor
  )
  returning id
  into v_target_id;

  perform platform_private.append_correction_event(
    p_case_resource_id,
    'case_triaged',
    v_case.current_revision,
    v_case.current_revision + 1,
    v_case.case_state,
    'triaged',
    v_actor,
    btrim(p_reason),
    null,
    v_target_id,
    null,
    null,
    v_begin.command_receipt_id,
    p_correlation_id,
    jsonb_build_object(
      'correction_kind', p_correction_kind,
      'priority', p_priority
    )
  );

  perform platform_private.append_correction_event(
    p_case_resource_id,
    'target_attached',
    v_case.current_revision,
    v_case.current_revision + 1,
    v_case.case_state,
    'triaged',
    v_actor,
    btrim(p_reason),
    null,
    v_target_id,
    null,
    null,
    v_begin.command_receipt_id,
    p_correlation_id,
    jsonb_build_object(
      'target_resource_id', p_target_resource_id,
      'target_resource_kind', 'article',
      'target_version_type', 'article_version',
      'target_version_id', p_target_version_id,
      'target_role', 'primary'
    )
  );

  v_result := jsonb_build_object(
    'case_resource_id', p_case_resource_id,
    'case_revision', v_case.current_revision + 1,
    'case_state', 'triaged',
    'target_id', v_target_id
  );

  perform platform_private.complete_resource_command(
    v_begin.command_receipt_id,
    v_result
  );

  return query
  select *
  from platform_private.read_correction_command_result(
    v_begin.command_receipt_id,
    false
  );
end;
$function$;

create or replace function
  public.assign_correction_case(
    p_case_resource_id uuid,
    p_expected_case_revision bigint,
    p_investigator_id uuid,
    p_reason text,
    p_idempotency_key text,
    p_correlation_id uuid
  )
returns table (
  command_receipt_id uuid,
  receipt_status text,
  case_resource_id uuid,
  case_revision bigint,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path =
  pg_catalog,
  public,
  auth,
  editorial,
  platform_private
as $function$
declare
  v_actor uuid;
  v_begin record;
  v_case editorial.correction_cases%rowtype;
  v_event_type text;
  v_result jsonb;
begin
  v_actor :=
    platform_private.assert_correction_capability(
      'triage_corrections'
    );

  if p_case_resource_id is null
     or p_expected_case_revision < 1
     or p_investigator_id is null
     or p_correlation_id is null
     or nullif(btrim(p_reason), '') is null
  then
    raise exception
      using errcode = '22023',
      message = 'Case, revision, investigator, reason, and correlation identity are required.';
  end if;

  if not exists (
    select 1
    from auth.users user_row
    where user_row.id = p_investigator_id
  ) then
    raise exception
      using errcode = 'P0002',
      message = 'The investigator does not exist.';
  end if;

  select *
  into v_begin
  from platform_private.begin_resource_command(
    'correction.case.assign',
    p_case_resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'expected_case_revision', p_expected_case_revision,
      'investigator_id', p_investigator_id,
      'reason', btrim(p_reason),
      'correlation_id', p_correlation_id
    )
  );

  if v_begin.idempotent_replay then
    return query
    select *
    from platform_private.read_correction_command_result(
      v_begin.command_receipt_id,
      true
    );
    return;
  end if;

  select correction_case.*
  into v_case
  from editorial.correction_cases correction_case
  where correction_case.resource_id =
    p_case_resource_id
  for update;

  if not found then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'case_not_found',
      'The correction case does not exist.',
      jsonb_build_object('case_revision', null)
    );
  elsif v_case.current_revision <>
        p_expected_case_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'case_revision_changed',
      'The correction case revision changed.',
      jsonb_build_object(
        'case_revision', v_case.current_revision,
        'case_state', v_case.case_state
      )
    );
  elsif v_case.case_state not in (
    'triaged',
    'investigating'
  ) then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'invalid_transition',
      'Investigator assignment requires a triaged or investigating case.',
      jsonb_build_object(
        'case_revision', v_case.current_revision,
        'case_state', v_case.case_state
      )
    );
  else
    v_event_type :=
      case
        when v_case.assigned_investigator_id
          is null
          then 'investigator_assigned'
        else 'investigator_reassigned'
      end;

    update editorial.correction_cases
    set
      case_state = 'investigating',
      current_revision =
        v_case.current_revision + 1,
      assigned_investigator_id =
        p_investigator_id,
      assignment_reason = btrim(p_reason),
      assigned_at = now(),
      updated_by = v_actor,
      updated_at = now()
    where resource_id = p_case_resource_id;

    perform platform_private.append_correction_event(
      p_case_resource_id,
      v_event_type,
      v_case.current_revision,
      v_case.current_revision + 1,
      v_case.case_state,
      'investigating',
      v_actor,
      btrim(p_reason),
      null,
      null,
      null,
      null,
      v_begin.command_receipt_id,
      p_correlation_id,
      jsonb_build_object(
        'prior_investigator_id',
        v_case.assigned_investigator_id,
        'investigator_id',
        p_investigator_id
      )
    );

    v_result := jsonb_build_object(
      'case_resource_id', p_case_resource_id,
      'case_revision', v_case.current_revision + 1,
      'case_state', 'investigating',
      'investigator_id', p_investigator_id
    );

    perform platform_private.complete_resource_command(
      v_begin.command_receipt_id,
      v_result
    );
  end if;

  return query
  select *
  from platform_private.read_correction_command_result(
    v_begin.command_receipt_id,
    false
  );
end;
$function$;

create or replace function
  public.link_correction_evidence(
    p_case_resource_id uuid,
    p_expected_case_revision bigint,
    p_source_id uuid,
    p_source_version_id uuid,
    p_citation_id uuid,
    p_evidence_role text,
    p_internal_note text,
    p_reason text,
    p_idempotency_key text,
    p_correlation_id uuid
  )
returns table (
  command_receipt_id uuid,
  receipt_status text,
  case_resource_id uuid,
  case_revision bigint,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path =
  pg_catalog,
  public,
  auth,
  editorial,
  platform_private
as $function$
declare
  v_actor uuid;
  v_begin record;
  v_case editorial.correction_cases%rowtype;
  v_evidence_id uuid;
  v_result jsonb;
begin
  v_actor :=
    platform_private.assert_correction_capability(
      'investigate_corrections'
    );

  if p_case_resource_id is null
     or p_expected_case_revision < 1
     or p_source_id is null
     or p_source_version_id is null
     or p_correlation_id is null
     or nullif(btrim(p_reason), '') is null
     or not exists (
       select 1
       from editorial.correction_evidence_roles role_row
       where role_row.evidence_role =
         p_evidence_role
         and role_row.enabled
     )
  then
    raise exception
      using errcode = '22023',
      message = 'Case, revision, evidence identity, role, reason, and correlation identity are required.';
  end if;

  select *
  into v_begin
  from platform_private.begin_resource_command(
    'correction.evidence.link',
    p_case_resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'expected_case_revision', p_expected_case_revision,
      'source_id', p_source_id,
      'source_version_id', p_source_version_id,
      'citation_id', p_citation_id,
      'evidence_role', p_evidence_role,
      'internal_note', nullif(btrim(p_internal_note), ''),
      'reason', btrim(p_reason),
      'correlation_id', p_correlation_id
    )
  );

  if v_begin.idempotent_replay then
    return query
    select *
    from platform_private.read_correction_command_result(
      v_begin.command_receipt_id,
      true
    );
    return;
  end if;

  select correction_case.*
  into v_case
  from editorial.correction_cases correction_case
  where correction_case.resource_id =
    p_case_resource_id
  for update;

  if not found then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'case_not_found',
      'The correction case does not exist.',
      jsonb_build_object('case_revision', null)
    );
  elsif v_case.current_revision <>
        p_expected_case_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'case_revision_changed',
      'The correction case revision changed.',
      jsonb_build_object(
        'case_revision', v_case.current_revision,
        'case_state', v_case.case_state
      )
    );
  elsif v_case.case_state <> 'investigating' then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'invalid_transition',
      'Evidence may be linked only while the case is investigating.',
      jsonb_build_object(
        'case_revision', v_case.current_revision,
        'case_state', v_case.case_state
      )
    );
  elsif not exists (
    select 1
    from editorial.sources source
    join editorial.source_versions version
      on version.id = p_source_version_id
     and version.source_id = p_source_id
    where source.id = p_source_id
      and source.source_state = 'active'
      and source.review_status = 'approved'
      and source.current_approved_version_id =
        p_source_version_id
      and (
        p_citation_id is null
        or exists (
          select 1
          from editorial.citations citation
          where citation.id = p_citation_id
            and citation.source_id = p_source_id
            and citation.source_version_id =
              p_source_version_id
            and citation.citation_state = 'active'
        )
      )
  ) then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'evidence_invalid',
      'Evidence must use an active approved Source version and a matching active Citation when supplied.',
      jsonb_build_object(
        'case_revision', v_case.current_revision,
        'case_state', v_case.case_state
      )
    );
  else
    insert into editorial.correction_evidence_links (
      case_resource_id,
      source_id,
      source_version_id,
      citation_id,
      evidence_role,
      internal_note,
      created_by
    )
    values (
      p_case_resource_id,
      p_source_id,
      p_source_version_id,
      p_citation_id,
      p_evidence_role,
      nullif(btrim(p_internal_note), ''),
      v_actor
    )
    returning id
    into v_evidence_id;

    update editorial.correction_cases
    set
      current_revision =
        v_case.current_revision + 1,
      updated_by = v_actor,
      updated_at = now()
    where resource_id = p_case_resource_id;

    perform platform_private.append_correction_event(
      p_case_resource_id,
      'evidence_linked',
      v_case.current_revision,
      v_case.current_revision + 1,
      v_case.case_state,
      v_case.case_state,
      v_actor,
      btrim(p_reason),
      null,
      null,
      v_evidence_id,
      null,
      v_begin.command_receipt_id,
      p_correlation_id,
      jsonb_build_object(
        'source_id', p_source_id,
        'source_version_id', p_source_version_id,
        'citation_id', p_citation_id,
        'evidence_role', p_evidence_role
      )
    );

    v_result := jsonb_build_object(
      'case_resource_id', p_case_resource_id,
      'case_revision', v_case.current_revision + 1,
      'case_state', v_case.case_state,
      'evidence_link_id', v_evidence_id
    );

    perform platform_private.complete_resource_command(
      v_begin.command_receipt_id,
      v_result
    );
  end if;

  return query
  select *
  from platform_private.read_correction_command_result(
    v_begin.command_receipt_id,
    false
  );
end;
$function$;

create or replace function
  public.unlink_correction_evidence(
    p_case_resource_id uuid,
    p_expected_case_revision bigint,
    p_evidence_link_id uuid,
    p_reason text,
    p_idempotency_key text,
    p_correlation_id uuid
  )
returns table (
  command_receipt_id uuid,
  receipt_status text,
  case_resource_id uuid,
  case_revision bigint,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path =
  pg_catalog,
  public,
  auth,
  editorial,
  platform_private
as $function$
declare
  v_actor uuid;
  v_begin record;
  v_case editorial.correction_cases%rowtype;
  v_link editorial.correction_evidence_links%rowtype;
  v_result jsonb;
begin
  v_actor :=
    platform_private.assert_correction_capability(
      'investigate_corrections'
    );

  if p_case_resource_id is null
     or p_expected_case_revision < 1
     or p_evidence_link_id is null
     or p_correlation_id is null
     or nullif(btrim(p_reason), '') is null
  then
    raise exception
      using errcode = '22023',
      message = 'Case, revision, evidence link, reason, and correlation identity are required.';
  end if;

  select *
  into v_begin
  from platform_private.begin_resource_command(
    'correction.evidence.unlink',
    p_case_resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'expected_case_revision', p_expected_case_revision,
      'evidence_link_id', p_evidence_link_id,
      'reason', btrim(p_reason),
      'correlation_id', p_correlation_id
    )
  );

  if v_begin.idempotent_replay then
    return query
    select *
    from platform_private.read_correction_command_result(
      v_begin.command_receipt_id,
      true
    );
    return;
  end if;

  select correction_case.*
  into v_case
  from editorial.correction_cases correction_case
  where correction_case.resource_id =
    p_case_resource_id
  for update;

  if not found then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'case_not_found',
      'The correction case does not exist.',
      jsonb_build_object('case_revision', null)
    );
  elsif v_case.current_revision <>
        p_expected_case_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'case_revision_changed',
      'The correction case revision changed.',
      jsonb_build_object(
        'case_revision', v_case.current_revision,
        'case_state', v_case.case_state
      )
    );
  elsif v_case.case_state <> 'investigating' then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'invalid_transition',
      'Evidence may be unlinked only while the case is investigating.',
      jsonb_build_object(
        'case_revision', v_case.current_revision,
        'case_state', v_case.case_state
      )
    );
  else
    select evidence.*
    into v_link
    from editorial.correction_evidence_links evidence
    where evidence.id = p_evidence_link_id
      and evidence.case_resource_id =
        p_case_resource_id
    for update;

    if not found then
      perform platform_private.reject_resource_command(
        v_begin.command_receipt_id,
        'evidence_link_not_found',
        'The correction evidence link does not exist.',
        jsonb_build_object(
          'case_revision', v_case.current_revision,
          'case_state', v_case.case_state
        )
      );
    else
      delete from editorial.correction_evidence_links
      where id = p_evidence_link_id;

      update editorial.correction_cases
      set
        current_revision =
          v_case.current_revision + 1,
        updated_by = v_actor,
        updated_at = now()
      where resource_id = p_case_resource_id;

      perform platform_private.append_correction_event(
        p_case_resource_id,
        'evidence_unlinked',
        v_case.current_revision,
        v_case.current_revision + 1,
        v_case.case_state,
        v_case.case_state,
        v_actor,
        btrim(p_reason),
        null,
        null,
        v_link.id,
        null,
        v_begin.command_receipt_id,
        p_correlation_id,
        jsonb_build_object(
          'evidence_link_id', v_link.id,
          'case_resource_id', v_link.case_resource_id,
          'source_id', v_link.source_id,
          'source_version_id', v_link.source_version_id,
          'citation_id', v_link.citation_id,
          'evidence_role', v_link.evidence_role,
          'link_created_by', v_link.created_by,
          'link_created_at', v_link.created_at,
          'unlinking_actor_id', v_actor,
          'unlink_reason', btrim(p_reason),
          'command_receipt_id',
          v_begin.command_receipt_id,
          'correlation_id', p_correlation_id
        )
      );

      v_result := jsonb_build_object(
        'case_resource_id', p_case_resource_id,
        'case_revision', v_case.current_revision + 1,
        'case_state', v_case.case_state,
        'evidence_link_id', v_link.id
      );

      perform platform_private.complete_resource_command(
        v_begin.command_receipt_id,
        v_result
      );
    end if;
  end if;

  return query
  select *
  from platform_private.read_correction_command_result(
    v_begin.command_receipt_id,
    false
  );
end;
$function$;

create or replace function
  public.update_correction_investigation(
    p_case_resource_id uuid,
    p_expected_case_revision bigint,
    p_investigation_summary text,
    p_investigator_recommendation text,
    p_evidence_ready boolean,
    p_reason text,
    p_idempotency_key text,
    p_correlation_id uuid
  )
returns table (
  command_receipt_id uuid,
  receipt_status text,
  case_resource_id uuid,
  case_revision bigint,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path =
  pg_catalog,
  public,
  auth,
  editorial,
  platform_private
as $function$
declare
  v_actor uuid;
  v_begin record;
  v_case editorial.correction_cases%rowtype;
  v_result jsonb;
begin
  v_actor :=
    platform_private.assert_correction_capability(
      'investigate_corrections'
    );

  if p_case_resource_id is null
     or p_expected_case_revision < 1
     or p_correlation_id is null
     or nullif(btrim(p_reason), '') is null
     or length(coalesce(p_investigation_summary, '')) > 16000
     or length(coalesce(p_investigator_recommendation, '')) > 8000
  then
    raise exception
      using errcode = '22023',
      message = 'Case, revision, reason, and correlation identity are required.';
  end if;

  select *
  into v_begin
  from platform_private.begin_resource_command(
    'correction.investigation.update',
    p_case_resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'expected_case_revision', p_expected_case_revision,
      'investigation_summary',
      nullif(btrim(p_investigation_summary), ''),
      'investigator_recommendation',
      nullif(btrim(p_investigator_recommendation), ''),
      'evidence_ready', p_evidence_ready,
      'reason', btrim(p_reason),
      'correlation_id', p_correlation_id
    )
  );

  if v_begin.idempotent_replay then
    return query
    select *
    from platform_private.read_correction_command_result(
      v_begin.command_receipt_id,
      true
    );
    return;
  end if;

  select correction_case.*
  into v_case
  from editorial.correction_cases correction_case
  where correction_case.resource_id =
    p_case_resource_id
  for update;

  if not found then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'case_not_found',
      'The correction case does not exist.',
      jsonb_build_object('case_revision', null)
    );
  elsif v_case.current_revision <>
        p_expected_case_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'case_revision_changed',
      'The correction case revision changed.',
      jsonb_build_object(
        'case_revision', v_case.current_revision,
        'case_state', v_case.case_state
      )
    );
  elsif v_case.case_state <> 'investigating' then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'invalid_transition',
      'Investigation updates require an investigating case.',
      jsonb_build_object(
        'case_revision', v_case.current_revision,
        'case_state', v_case.case_state
      )
    );
  elsif p_evidence_ready
        and (
          nullif(btrim(p_investigation_summary), '')
            is null
          or nullif(
            btrim(p_investigator_recommendation),
            ''
          ) is null
          or not exists (
            select 1
            from editorial.correction_evidence_links evidence
            where evidence.case_resource_id =
              p_case_resource_id
          )
        )
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'investigation_incomplete',
      'Evidence-ready investigations require a summary and recommendation.',
      jsonb_build_object(
        'case_revision', v_case.current_revision,
        'case_state', v_case.case_state
      )
    );
  else
    update editorial.correction_cases
    set
      current_revision =
        v_case.current_revision + 1,
      investigation_summary =
        nullif(btrim(p_investigation_summary), ''),
      investigator_recommendation =
        nullif(
          btrim(p_investigator_recommendation),
          ''
        ),
      evidence_ready = p_evidence_ready,
      updated_by = v_actor,
      updated_at = now()
    where resource_id = p_case_resource_id;

    perform platform_private.append_correction_event(
      p_case_resource_id,
      'investigation_updated',
      v_case.current_revision,
      v_case.current_revision + 1,
      v_case.case_state,
      v_case.case_state,
      v_actor,
      btrim(p_reason),
      null,
      null,
      null,
      null,
      v_begin.command_receipt_id,
      p_correlation_id,
      jsonb_build_object(
        'evidence_ready', p_evidence_ready
      )
    );

    v_result := jsonb_build_object(
      'case_resource_id', p_case_resource_id,
      'case_revision', v_case.current_revision + 1,
      'case_state', v_case.case_state,
      'evidence_ready', p_evidence_ready
    );

    perform platform_private.complete_resource_command(
      v_begin.command_receipt_id,
      v_result
    );
  end if;

  return query
  select *
  from platform_private.read_correction_command_result(
    v_begin.command_receipt_id,
    false
  );
end;
$function$;

create or replace function
  public.submit_correction_for_decision(
    p_case_resource_id uuid,
    p_expected_case_revision bigint,
    p_reason text,
    p_idempotency_key text,
    p_correlation_id uuid
  )
returns table (
  command_receipt_id uuid,
  receipt_status text,
  case_resource_id uuid,
  case_revision bigint,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path =
  pg_catalog,
  public,
  auth,
  editorial,
  platform_private
as $function$
declare
  v_actor uuid;
  v_begin record;
  v_case editorial.correction_cases%rowtype;
  v_result jsonb;
begin
  v_actor :=
    platform_private.assert_correction_capability(
      'investigate_corrections'
    );

  if p_case_resource_id is null
     or p_expected_case_revision < 1
     or p_correlation_id is null
     or nullif(btrim(p_reason), '') is null
  then
    raise exception
      using errcode = '22023',
      message = 'Case, revision, reason, and correlation identity are required.';
  end if;

  select *
  into v_begin
  from platform_private.begin_resource_command(
    'correction.case.submit_for_decision',
    p_case_resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'expected_case_revision', p_expected_case_revision,
      'reason', btrim(p_reason),
      'correlation_id', p_correlation_id
    )
  );

  if v_begin.idempotent_replay then
    return query
    select *
    from platform_private.read_correction_command_result(
      v_begin.command_receipt_id,
      true
    );
    return;
  end if;

  select correction_case.*
  into v_case
  from editorial.correction_cases correction_case
  where correction_case.resource_id =
    p_case_resource_id
  for update;

  if not found then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'case_not_found',
      'The correction case does not exist.',
      jsonb_build_object('case_revision', null)
    );
  elsif v_case.current_revision <>
        p_expected_case_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'case_revision_changed',
      'The correction case revision changed.',
      jsonb_build_object(
        'case_revision', v_case.current_revision,
        'case_state', v_case.case_state
      )
    );
  elsif v_case.case_state <> 'investigating' then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'invalid_transition',
      'Only investigating cases may be submitted for decision.',
      jsonb_build_object(
        'case_revision', v_case.current_revision,
        'case_state', v_case.case_state
      )
    );
  elsif v_case.assigned_investigator_id is null
        or nullif(
          btrim(v_case.investigation_summary),
          ''
        ) is null
        or nullif(
          btrim(v_case.investigator_recommendation),
          ''
        ) is null
        or not v_case.evidence_ready
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'investigation_incomplete',
      'The case is not ready for institutional decision.',
      jsonb_build_object(
        'case_revision', v_case.current_revision,
        'case_state', v_case.case_state
      )
    );
  else
    update editorial.correction_cases
    set
      case_state = 'awaiting_decision',
      current_revision =
        v_case.current_revision + 1,
      submitted_for_decision_by = v_actor,
      submitted_for_decision_at = now(),
      updated_by = v_actor,
      updated_at = now()
    where resource_id = p_case_resource_id;

    perform platform_private.append_correction_event(
      p_case_resource_id,
      'submitted_for_decision',
      v_case.current_revision,
      v_case.current_revision + 1,
      v_case.case_state,
      'awaiting_decision',
      v_actor,
      btrim(p_reason),
      null,
      null,
      null,
      null,
      v_begin.command_receipt_id,
      p_correlation_id,
      '{}'::jsonb
    );

    v_result := jsonb_build_object(
      'case_resource_id', p_case_resource_id,
      'case_revision', v_case.current_revision + 1,
      'case_state', 'awaiting_decision'
    );

    perform platform_private.complete_resource_command(
      v_begin.command_receipt_id,
      v_result
    );
  end if;

  return query
  select *
  from platform_private.read_correction_command_result(
    v_begin.command_receipt_id,
    false
  );
end;
$function$;

create or replace function
  public.return_correction_to_investigation(
    p_case_resource_id uuid,
    p_expected_case_revision bigint,
    p_reason text,
    p_idempotency_key text,
    p_correlation_id uuid
  )
returns table (
  command_receipt_id uuid,
  receipt_status text,
  case_resource_id uuid,
  case_revision bigint,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path =
  pg_catalog,
  public,
  auth,
  editorial,
  platform_private
as $function$
declare
  v_actor uuid;
  v_begin record;
  v_case editorial.correction_cases%rowtype;
  v_result jsonb;
begin
  v_actor :=
    platform_private.assert_correction_capability(
      'investigate_corrections'
    );

  if p_case_resource_id is null
     or p_expected_case_revision < 1
     or p_correlation_id is null
     or nullif(btrim(p_reason), '') is null
  then
    raise exception
      using errcode = '22023',
      message = 'Case, revision, reason, and correlation identity are required.';
  end if;

  select *
  into v_begin
  from platform_private.begin_resource_command(
    'correction.case.return_to_investigation',
    p_case_resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'expected_case_revision', p_expected_case_revision,
      'reason', btrim(p_reason),
      'correlation_id', p_correlation_id
    )
  );

  if v_begin.idempotent_replay then
    return query
    select *
    from platform_private.read_correction_command_result(
      v_begin.command_receipt_id,
      true
    );
    return;
  end if;

  select correction_case.*
  into v_case
  from editorial.correction_cases correction_case
  where correction_case.resource_id =
    p_case_resource_id
  for update;

  if not found then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'case_not_found',
      'The correction case does not exist.',
      jsonb_build_object('case_revision', null)
    );
  elsif v_case.current_revision <>
        p_expected_case_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'case_revision_changed',
      'The correction case revision changed.',
      jsonb_build_object(
        'case_revision', v_case.current_revision,
        'case_state', v_case.case_state
      )
    );
  elsif v_case.case_state <>
        'awaiting_decision'
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'invalid_transition',
      'Only awaiting-decision cases may return to investigation.',
      jsonb_build_object(
        'case_revision', v_case.current_revision,
        'case_state', v_case.case_state
      )
    );
  else
    update editorial.correction_cases
    set
      case_state = 'investigating',
      current_revision =
        v_case.current_revision + 1,
      submitted_for_decision_by = null,
      submitted_for_decision_at = null,
      evidence_ready = false,
      updated_by = v_actor,
      updated_at = now()
    where resource_id = p_case_resource_id;

    perform platform_private.append_correction_event(
      p_case_resource_id,
      'returned_to_investigation',
      v_case.current_revision,
      v_case.current_revision + 1,
      v_case.case_state,
      'investigating',
      v_actor,
      btrim(p_reason),
      null,
      null,
      null,
      null,
      v_begin.command_receipt_id,
      p_correlation_id,
      '{}'::jsonb
    );

    v_result := jsonb_build_object(
      'case_resource_id', p_case_resource_id,
      'case_revision', v_case.current_revision + 1,
      'case_state', 'investigating'
    );

    perform platform_private.complete_resource_command(
      v_begin.command_receipt_id,
      v_result
    );
  end if;

  return query
  select *
  from platform_private.read_correction_command_result(
    v_begin.command_receipt_id,
    false
  );
end;
$function$;

create or replace function
  public.record_correction_decision(
    p_case_resource_id uuid,
    p_expected_case_revision bigint,
    p_outcome text,
    p_reason text,
    p_private_analysis text,
    p_public_safe_explanation text,
    p_target_state_observed jsonb,
    p_duplicate_of_case_resource_id uuid,
    p_idempotency_key text,
    p_correlation_id uuid
  )
returns table (
  command_receipt_id uuid,
  receipt_status text,
  case_resource_id uuid,
  case_revision bigint,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path =
  pg_catalog,
  public,
  auth,
  editorial,
  platform_private
as $function$
declare
  v_actor uuid;
  v_begin record;
  v_case editorial.correction_cases%rowtype;
  v_prior_decision_id uuid;
  v_decision_id uuid;
  v_decision_number bigint;
  v_result jsonb;
begin
  v_actor :=
    platform_private.assert_correction_capability(
      'decide_corrections'
    );

  if p_case_resource_id is null
     or p_expected_case_revision < 1
     or p_correlation_id is null
     or nullif(btrim(p_reason), '') is null
     or p_outcome not in (
       'correction_required',
       'no_change_required',
       'insufficient_evidence',
       'duplicate',
       'out_of_scope'
     )
     or (
       p_outcome = 'duplicate'
       and p_duplicate_of_case_resource_id is null
     )
     or (
       p_outcome <> 'duplicate'
       and p_duplicate_of_case_resource_id is not null
     )
     or p_target_state_observed is null
     or jsonb_typeof(p_target_state_observed) <> 'object'
     or octet_length(p_target_state_observed::text) > 32768
  then
    raise exception
      using errcode = '22023',
      message = 'Case, revision, decision, reason, target state, and correlation identity are required.';
  end if;

  select *
  into v_begin
  from platform_private.begin_resource_command(
    'correction.decision.record',
    p_case_resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'expected_case_revision', p_expected_case_revision,
      'outcome', p_outcome,
      'reason', btrim(p_reason),
      'private_analysis',
      nullif(btrim(p_private_analysis), ''),
      'public_safe_explanation',
      nullif(btrim(p_public_safe_explanation), ''),
      'target_state_observed', p_target_state_observed,
      'duplicate_of_case_resource_id',
      p_duplicate_of_case_resource_id,
      'correlation_id', p_correlation_id
    )
  );

  if v_begin.idempotent_replay then
    return query
    select *
    from platform_private.read_correction_command_result(
      v_begin.command_receipt_id,
      true
    );
    return;
  end if;

  select correction_case.*
  into v_case
  from editorial.correction_cases correction_case
  where correction_case.resource_id =
    p_case_resource_id
  for update;

  if not found then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'case_not_found',
      'The correction case does not exist.',
      jsonb_build_object('case_revision', null)
    );
  elsif v_case.current_revision <>
        p_expected_case_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'case_revision_changed',
      'The correction case revision changed.',
      jsonb_build_object(
        'case_revision', v_case.current_revision,
        'case_state', v_case.case_state
      )
    );
  elsif v_case.case_state not in (
    'awaiting_decision',
    'decided'
  ) then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'invalid_transition',
      'Decisions may be recorded only from awaiting_decision or decided.',
      jsonb_build_object(
        'case_revision', v_case.current_revision,
        'case_state', v_case.case_state
      )
    );
  elsif p_duplicate_of_case_resource_id =
        p_case_resource_id
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'invalid_duplicate_case',
      'A correction case cannot duplicate itself.',
      jsonb_build_object(
        'case_revision', v_case.current_revision,
        'case_state', v_case.case_state
      )
    );
  elsif p_duplicate_of_case_resource_id
        is not null
        and not exists (
          select 1
          from editorial.correction_cases duplicate_case
          where duplicate_case.resource_id =
            p_duplicate_of_case_resource_id
        )
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'duplicate_case_not_found',
      'The controlling duplicate correction case does not exist.',
      jsonb_build_object(
        'case_revision', v_case.current_revision,
        'case_state', v_case.case_state
      )
    );
  else
    v_prior_decision_id :=
      v_case.current_decision_id;

    select coalesce(
      max(decision.decision_number),
      0
    ) + 1
    into v_decision_number
    from editorial.correction_decisions decision
    where decision.case_resource_id =
      p_case_resource_id;

    insert into editorial.correction_decisions (
      case_resource_id,
      decision_number,
      outcome,
      reason,
      private_analysis,
      public_safe_explanation,
      case_revision_observed,
      target_state_observed,
      duplicate_of_case_resource_id,
      supersedes_decision_id,
      decided_by,
      correlation_id
    )
    values (
      p_case_resource_id,
      v_decision_number,
      p_outcome,
      btrim(p_reason),
      nullif(btrim(p_private_analysis), ''),
      nullif(
        btrim(p_public_safe_explanation),
        ''
      ),
      v_case.current_revision,
      p_target_state_observed,
      p_duplicate_of_case_resource_id,
      v_prior_decision_id,
      v_actor,
      p_correlation_id
    )
    returning id
    into v_decision_id;

    update editorial.correction_cases
    set
      case_state = 'decided',
      current_revision =
        v_case.current_revision + 1,
      current_decision_id = v_decision_id,
      updated_by = v_actor,
      updated_at = now()
    where resource_id = p_case_resource_id;

    if v_prior_decision_id is not null then
      perform platform_private.append_correction_event(
        p_case_resource_id,
        'decision_superseded',
        v_case.current_revision,
        v_case.current_revision + 1,
        v_case.case_state,
        'decided',
        v_actor,
        btrim(p_reason),
        v_decision_id,
        null,
        null,
        null,
        v_begin.command_receipt_id,
        p_correlation_id,
        jsonb_build_object(
          'prior_decision_id',
          v_prior_decision_id,
          'new_decision_id',
          v_decision_id
        )
      );
    end if;

    perform platform_private.append_correction_event(
      p_case_resource_id,
      'decision_recorded',
      v_case.current_revision,
      v_case.current_revision + 1,
      v_case.case_state,
      'decided',
      v_actor,
      btrim(p_reason),
      v_decision_id,
      null,
      null,
      null,
      v_begin.command_receipt_id,
      p_correlation_id,
      jsonb_build_object(
        'decision_id', v_decision_id,
        'decision_number', v_decision_number,
        'outcome', p_outcome,
        'supersedes_decision_id',
        v_prior_decision_id
      )
    );

    v_result := jsonb_build_object(
      'case_resource_id', p_case_resource_id,
      'case_revision', v_case.current_revision + 1,
      'case_state', 'decided',
      'decision_id', v_decision_id,
      'decision_number', v_decision_number,
      'outcome', p_outcome
    );

    perform platform_private.complete_resource_command(
      v_begin.command_receipt_id,
      v_result
    );
  end if;

  return query
  select *
  from platform_private.read_correction_command_result(
    v_begin.command_receipt_id,
    false
  );
end;
$function$;

create or replace function
  public.add_related_resource_review(
    p_case_resource_id uuid,
    p_expected_case_revision bigint,
    p_related_resource_id uuid,
    p_reason text,
    p_idempotency_key text,
    p_correlation_id uuid
  )
returns table (
  command_receipt_id uuid,
  receipt_status text,
  case_resource_id uuid,
  case_revision bigint,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path =
  pg_catalog,
  public,
  auth,
  editorial,
  platform_private
as $function$
declare
  v_actor uuid;
  v_begin record;
  v_case editorial.correction_cases%rowtype;
  v_related_kind text;
  v_review_id uuid;
  v_result jsonb;
begin
  v_actor :=
    platform_private.assert_correction_capability(
      'investigate_corrections'
    );

  if p_case_resource_id is null
     or p_expected_case_revision < 1
     or p_related_resource_id is null
     or p_correlation_id is null
     or nullif(btrim(p_reason), '') is null
  then
    raise exception
      using errcode = '22023',
      message = 'Case, revision, related resource, reason, and correlation identity are required.';
  end if;

  select resource.resource_kind
  into v_related_kind
  from editorial.resources resource
  where resource.id = p_related_resource_id;

  if not found then
    raise exception
      using errcode = 'P0002',
      message = 'The related resource does not exist.';
  end if;

  select *
  into v_begin
  from platform_private.begin_resource_command(
    'correction.related_resource.add',
    p_case_resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'expected_case_revision', p_expected_case_revision,
      'related_resource_id', p_related_resource_id,
      'related_resource_kind', v_related_kind,
      'reason', btrim(p_reason),
      'correlation_id', p_correlation_id
    )
  );

  if v_begin.idempotent_replay then
    return query
    select *
    from platform_private.read_correction_command_result(
      v_begin.command_receipt_id,
      true
    );
    return;
  end if;

  select correction_case.*
  into v_case
  from editorial.correction_cases correction_case
  where correction_case.resource_id =
    p_case_resource_id
  for update;

  if not found then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'case_not_found',
      'The correction case does not exist.',
      jsonb_build_object('case_revision', null)
    );
  elsif v_case.current_revision <>
        p_expected_case_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'case_revision_changed',
      'The correction case revision changed.',
      jsonb_build_object(
        'case_revision', v_case.current_revision,
        'case_state', v_case.case_state
      )
    );
  elsif v_case.case_state not in (
    'investigating',
    'awaiting_decision',
    'decided'
  ) then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'invalid_transition',
      'Related-resource reviews require an active investigated case.',
      jsonb_build_object(
        'case_revision', v_case.current_revision,
        'case_state', v_case.case_state
      )
    );
  elsif p_related_resource_id =
        p_case_resource_id
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'invalid_related_resource',
      'A correction case cannot be its own related resource.',
      jsonb_build_object(
        'case_revision', v_case.current_revision,
        'case_state', v_case.case_state
      )
    );
  else
    insert into editorial.correction_related_resource_reviews (
      case_resource_id,
      related_resource_id,
      related_resource_kind,
      created_by,
      updated_by
    )
    values (
      p_case_resource_id,
      p_related_resource_id,
      v_related_kind,
      v_actor,
      v_actor
    )
    returning id
    into v_review_id;

    update editorial.correction_cases
    set
      current_revision =
        v_case.current_revision + 1,
      updated_by = v_actor,
      updated_at = now()
    where resource_id = p_case_resource_id;

    perform platform_private.append_correction_event(
      p_case_resource_id,
      'related_resource_added',
      v_case.current_revision,
      v_case.current_revision + 1,
      v_case.case_state,
      v_case.case_state,
      v_actor,
      btrim(p_reason),
      null,
      null,
      null,
      v_review_id,
      v_begin.command_receipt_id,
      p_correlation_id,
      jsonb_build_object(
        'related_resource_review_id',
        v_review_id,
        'related_resource_id',
        p_related_resource_id,
        'related_resource_kind',
        v_related_kind
      )
    );

    v_result := jsonb_build_object(
      'case_resource_id', p_case_resource_id,
      'case_revision', v_case.current_revision + 1,
      'case_state', v_case.case_state,
      'related_resource_review_id',
      v_review_id,
      'review_revision', 1
    );

    perform platform_private.complete_resource_command(
      v_begin.command_receipt_id,
      v_result
    );
  end if;

  return query
  select *
  from platform_private.read_correction_command_result(
    v_begin.command_receipt_id,
    false
  );
end;
$function$;

create or replace function
  public.set_related_resource_disposition(
    p_case_resource_id uuid,
    p_expected_case_revision bigint,
    p_related_resource_review_id uuid,
    p_expected_review_revision bigint,
    p_disposition text,
    p_reason text,
    p_linked_correction_case_resource_id uuid,
    p_idempotency_key text,
    p_correlation_id uuid
  )
returns table (
  command_receipt_id uuid,
  receipt_status text,
  case_resource_id uuid,
  case_revision bigint,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path =
  pg_catalog,
  public,
  auth,
  editorial,
  platform_private
as $function$
declare
  v_actor uuid;
  v_begin record;
  v_case editorial.correction_cases%rowtype;
  v_review editorial.correction_related_resource_reviews%rowtype;
  v_result jsonb;
begin
  v_actor :=
    platform_private.assert_correction_capability(
      'decide_corrections'
    );

  if p_case_resource_id is null
     or p_expected_case_revision < 1
     or p_related_resource_review_id is null
     or p_expected_review_revision < 1
     or p_correlation_id is null
     or nullif(btrim(p_reason), '') is null
     or p_disposition not in (
       'review_required',
       'correction_required',
       'no_action_required',
       'notification_only',
       'deferred'
     )
  then
    raise exception
      using errcode = '22023',
      message = 'Case, revisions, review, disposition, reason, and correlation identity are required.';
  end if;

  if p_linked_correction_case_resource_id
       is not null
     and not exists (
       select 1
       from editorial.correction_cases linked_case
       where linked_case.resource_id =
         p_linked_correction_case_resource_id
     )
  then
    raise exception
      using errcode = 'P0002',
      message = 'The linked correction case does not exist.';
  end if;

  select *
  into v_begin
  from platform_private.begin_resource_command(
    'correction.related_resource.disposition',
    p_case_resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'expected_case_revision', p_expected_case_revision,
      'related_resource_review_id',
      p_related_resource_review_id,
      'expected_review_revision',
      p_expected_review_revision,
      'disposition', p_disposition,
      'reason', btrim(p_reason),
      'linked_correction_case_resource_id',
      p_linked_correction_case_resource_id,
      'correlation_id', p_correlation_id
    )
  );

  if v_begin.idempotent_replay then
    return query
    select *
    from platform_private.read_correction_command_result(
      v_begin.command_receipt_id,
      true
    );
    return;
  end if;

  select correction_case.*
  into v_case
  from editorial.correction_cases correction_case
  where correction_case.resource_id =
    p_case_resource_id
  for update;

  if not found then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'case_not_found',
      'The correction case does not exist.',
      jsonb_build_object('case_revision', null)
    );
  elsif v_case.current_revision <>
        p_expected_case_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'case_revision_changed',
      'The correction case revision changed.',
      jsonb_build_object(
        'case_revision', v_case.current_revision,
        'case_state', v_case.case_state
      )
    );
  elsif v_case.case_state not in (
    'investigating',
    'awaiting_decision',
    'decided'
  ) then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'invalid_transition',
      'Related-resource disposition requires an active correction case.',
      jsonb_build_object(
        'case_revision', v_case.current_revision,
        'case_state', v_case.case_state
      )
    );
  else
    select review.*
    into v_review
    from editorial.correction_related_resource_reviews review
    where review.id =
      p_related_resource_review_id
      and review.case_resource_id =
        p_case_resource_id
    for update;

    if not found then
      perform platform_private.reject_resource_command(
        v_begin.command_receipt_id,
        'related_review_not_found',
        'The related-resource review does not exist.',
        jsonb_build_object(
          'case_revision', v_case.current_revision,
          'case_state', v_case.case_state
        )
      );
    elsif v_review.review_revision <>
          p_expected_review_revision
    then
      perform platform_private.reject_resource_command(
        v_begin.command_receipt_id,
        'review_revision_changed',
        'The related-resource review revision changed.',
        jsonb_build_object(
          'case_revision', v_case.current_revision,
          'case_state', v_case.case_state,
          'review_revision',
          v_review.review_revision
        )
      );
    elsif v_review.review_state <> 'pending' then
      perform platform_private.reject_resource_command(
        v_begin.command_receipt_id,
        'review_already_resolved',
        'The related-resource review is already resolved.',
        jsonb_build_object(
          'case_revision', v_case.current_revision,
          'case_state', v_case.case_state,
          'review_revision',
          v_review.review_revision
        )
      );
    else
      update editorial.correction_related_resource_reviews
      set
        review_state = 'resolved',
        disposition = p_disposition,
        reason = btrim(p_reason),
        linked_correction_case_resource_id =
          p_linked_correction_case_resource_id,
        review_revision =
          v_review.review_revision + 1,
        updated_by = v_actor,
        resolved_by = v_actor,
        resolved_at = now()
      where id = p_related_resource_review_id;

      update editorial.correction_cases
      set
        current_revision =
          v_case.current_revision + 1,
        updated_by = v_actor,
        updated_at = now()
      where resource_id = p_case_resource_id;

      perform platform_private.append_correction_event(
        p_case_resource_id,
        'related_resource_dispositioned',
        v_case.current_revision,
        v_case.current_revision + 1,
        v_case.case_state,
        v_case.case_state,
        v_actor,
        btrim(p_reason),
        null,
        null,
        null,
        v_review.id,
        v_begin.command_receipt_id,
        p_correlation_id,
        jsonb_build_object(
          'related_resource_review_id',
          v_review.id,
          'related_resource_id',
          v_review.related_resource_id,
          'related_resource_kind',
          v_review.related_resource_kind,
          'prior_review_revision',
          v_review.review_revision,
          'review_revision',
          v_review.review_revision + 1,
          'disposition',
          p_disposition,
          'linked_correction_case_resource_id',
          p_linked_correction_case_resource_id
        )
      );

      v_result := jsonb_build_object(
        'case_resource_id', p_case_resource_id,
        'case_revision',
        v_case.current_revision + 1,
        'case_state', v_case.case_state,
        'related_resource_review_id',
        v_review.id,
        'review_revision',
        v_review.review_revision + 1,
        'disposition', p_disposition
      );

      perform platform_private.complete_resource_command(
        v_begin.command_receipt_id,
        v_result
      );
    end if;
  end if;

  return query
  select *
  from platform_private.read_correction_command_result(
    v_begin.command_receipt_id,
    false
  );
end;
$function$;

create or replace function
  public.close_correction_case(
    p_case_resource_id uuid,
    p_expected_case_revision bigint,
    p_reason text,
    p_idempotency_key text,
    p_correlation_id uuid
  )
returns table (
  command_receipt_id uuid,
  receipt_status text,
  case_resource_id uuid,
  case_revision bigint,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path =
  pg_catalog,
  public,
  auth,
  editorial,
  platform_private
as $function$
declare
  v_actor uuid;
  v_begin record;
  v_case editorial.correction_cases%rowtype;
  v_outcome text;
  v_result jsonb;
begin
  v_actor :=
    platform_private.assert_correction_capability(
      'decide_corrections'
    );

  if p_case_resource_id is null
     or p_expected_case_revision < 1
     or p_correlation_id is null
     or nullif(btrim(p_reason), '') is null
  then
    raise exception
      using errcode = '22023',
      message = 'Case, revision, reason, and correlation identity are required.';
  end if;

  select *
  into v_begin
  from platform_private.begin_resource_command(
    'correction.case.close',
    p_case_resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'expected_case_revision', p_expected_case_revision,
      'reason', btrim(p_reason),
      'correlation_id', p_correlation_id
    )
  );

  if v_begin.idempotent_replay then
    return query
    select *
    from platform_private.read_correction_command_result(
      v_begin.command_receipt_id,
      true
    );
    return;
  end if;

  select correction_case.*
  into v_case
  from editorial.correction_cases correction_case
  where correction_case.resource_id =
    p_case_resource_id
  for update;

  if not found then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'case_not_found',
      'The correction case does not exist.',
      jsonb_build_object('case_revision', null)
    );
  elsif v_case.current_revision <>
        p_expected_case_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'case_revision_changed',
      'The correction case revision changed.',
      jsonb_build_object(
        'case_revision', v_case.current_revision,
        'case_state', v_case.case_state
      )
    );
  elsif v_case.case_state <> 'decided'
        or v_case.current_decision_id is null
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'invalid_transition',
      'Only decided correction cases may close.',
      jsonb_build_object(
        'case_revision', v_case.current_revision,
        'case_state', v_case.case_state
      )
    );
  else
    select decision.outcome
    into v_outcome
    from editorial.correction_decisions decision
    where decision.id =
      v_case.current_decision_id
      and decision.case_resource_id =
        p_case_resource_id;

    if v_outcome = 'correction_required' then
      perform platform_private.reject_resource_command(
        v_begin.command_receipt_id,
        'application_required',
        'Correction-required cases cannot close before application and public-note authority exist.',
        jsonb_build_object(
          'case_revision', v_case.current_revision,
          'case_state', v_case.case_state,
          'decision_outcome', v_outcome
        )
      );
    elsif exists (
      select 1
      from editorial.correction_related_resource_reviews review
      where review.case_resource_id =
        p_case_resource_id
        and review.review_state = 'pending'
    ) then
      perform platform_private.reject_resource_command(
        v_begin.command_receipt_id,
        'related_reviews_pending',
        'All related-resource reviews must be resolved before closure.',
        jsonb_build_object(
          'case_revision', v_case.current_revision,
          'case_state', v_case.case_state,
          'decision_outcome', v_outcome
        )
      );
    else
      update editorial.correction_cases
      set
        case_state = 'closed',
        current_revision =
          v_case.current_revision + 1,
        closed_reason = btrim(p_reason),
        closed_by = v_actor,
        closed_at = now(),
        updated_by = v_actor,
        updated_at = now()
      where resource_id = p_case_resource_id;

      perform platform_private.append_correction_event(
        p_case_resource_id,
        'case_closed',
        v_case.current_revision,
        v_case.current_revision + 1,
        v_case.case_state,
        'closed',
        v_actor,
        btrim(p_reason),
        v_case.current_decision_id,
        null,
        null,
        null,
        v_begin.command_receipt_id,
        p_correlation_id,
        jsonb_build_object(
          'decision_outcome', v_outcome
        )
      );

      v_result := jsonb_build_object(
        'case_resource_id', p_case_resource_id,
        'case_revision',
        v_case.current_revision + 1,
        'case_state', 'closed',
        'decision_outcome', v_outcome
      );

      perform platform_private.complete_resource_command(
        v_begin.command_receipt_id,
        v_result
      );
    end if;
  end if;

  return query
  select *
  from platform_private.read_correction_command_result(
    v_begin.command_receipt_id,
    false
  );
end;
$function$;

create or replace function
  public.reopen_correction_case(
    p_case_resource_id uuid,
    p_expected_case_revision bigint,
    p_reason text,
    p_idempotency_key text,
    p_correlation_id uuid
  )
returns table (
  command_receipt_id uuid,
  receipt_status text,
  case_resource_id uuid,
  case_revision bigint,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path =
  pg_catalog,
  public,
  auth,
  editorial,
  platform_private
as $function$
declare
  v_actor uuid;
  v_begin record;
  v_case editorial.correction_cases%rowtype;
  v_result jsonb;
begin
  v_actor :=
    platform_private.assert_correction_capability(
      'decide_corrections'
    );

  if p_case_resource_id is null
     or p_expected_case_revision < 1
     or p_correlation_id is null
     or nullif(btrim(p_reason), '') is null
  then
    raise exception
      using errcode = '22023',
      message = 'Case, revision, reason, and correlation identity are required.';
  end if;

  select *
  into v_begin
  from platform_private.begin_resource_command(
    'correction.case.reopen',
    p_case_resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'expected_case_revision', p_expected_case_revision,
      'reason', btrim(p_reason),
      'correlation_id', p_correlation_id
    )
  );

  if v_begin.idempotent_replay then
    return query
    select *
    from platform_private.read_correction_command_result(
      v_begin.command_receipt_id,
      true
    );
    return;
  end if;

  select correction_case.*
  into v_case
  from editorial.correction_cases correction_case
  where correction_case.resource_id =
    p_case_resource_id
  for update;

  if not found then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'case_not_found',
      'The correction case does not exist.',
      jsonb_build_object('case_revision', null)
    );
  elsif v_case.current_revision <>
        p_expected_case_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'case_revision_changed',
      'The correction case revision changed.',
      jsonb_build_object(
        'case_revision', v_case.current_revision,
        'case_state', v_case.case_state
      )
    );
  elsif v_case.case_state <> 'closed' then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'invalid_transition',
      'Only closed correction cases may reopen.',
      jsonb_build_object(
        'case_revision', v_case.current_revision,
        'case_state', v_case.case_state
      )
    );
  elsif v_case.assigned_investigator_id
        is null
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'investigator_required',
      'A reopened correction case must retain an investigator.',
      jsonb_build_object(
        'case_revision', v_case.current_revision,
        'case_state', v_case.case_state
      )
    );
  else
    update editorial.correction_cases
    set
      case_state = 'investigating',
      current_revision =
        v_case.current_revision + 1,
      submitted_for_decision_by = null,
      submitted_for_decision_at = null,
      evidence_ready = false,
      closed_reason = null,
      closed_by = null,
      closed_at = null,
      updated_by = v_actor,
      updated_at = now()
    where resource_id = p_case_resource_id;

    perform platform_private.append_correction_event(
      p_case_resource_id,
      'case_reopened',
      v_case.current_revision,
      v_case.current_revision + 1,
      v_case.case_state,
      'investigating',
      v_actor,
      btrim(p_reason),
      v_case.current_decision_id,
      null,
      null,
      null,
      v_begin.command_receipt_id,
      p_correlation_id,
      '{}'::jsonb
    );

    v_result := jsonb_build_object(
      'case_resource_id', p_case_resource_id,
      'case_revision',
      v_case.current_revision + 1,
      'case_state', 'investigating',
      'current_decision_id',
      v_case.current_decision_id
    );

    perform platform_private.complete_resource_command(
      v_begin.command_receipt_id,
      v_result
    );
  end if;

  return query
  select *
  from platform_private.read_correction_command_result(
    v_begin.command_receipt_id,
    false
  );
end;
$function$;


create or replace function
  public.list_correction_cases(
    p_case_state text default null,
    p_assigned_investigator_id uuid default null,
    p_limit integer default 100,
    p_offset integer default 0
  )
returns table (
  case_resource_id uuid,
  case_reference text,
  origin_type text,
  correction_kind text,
  priority text,
  case_state text,
  current_revision bigint,
  primary_target_resource_kind text,
  primary_target_summary text,
  assigned_investigator_id uuid,
  current_decision_outcome text,
  created_at timestamptz,
  updated_at timestamptz,
  closed_at timestamptz
)
language plpgsql
stable
security definer
set search_path =
  pg_catalog,
  public,
  auth,
  editorial
as $function$
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not coalesce(
       public.current_user_is_administrator(),
       false
     )
     and not coalesce(
       public.current_user_has_capability(
         'view_corrections'
       ),
       false
     )
  then
    raise exception
      using
        errcode = '42501',
        message = 'The caller cannot view correction cases.';
  end if;

  if p_case_state is not null
     and p_case_state not in (
       'submitted',
       'triaged',
       'investigating',
       'awaiting_decision',
       'decided',
       'applied',
       'closed'
     )
  then
    raise exception
      using
        errcode = '22023',
        message = 'case_state is invalid.';
  end if;

  if p_limit not between 1 and 500
     or p_offset < 0
  then
    raise exception
      using
        errcode = '22023',
        message = 'limit must be between 1 and 500 and offset cannot be negative.';
  end if;

  return query
  select
    correction_case.resource_id,
    'COR-' ||
      lpad(
        correction_case.case_number::text,
        8,
        '0'
      ),
    correction_case.origin_type,
    correction_case.correction_kind,
    correction_case.priority,
    correction_case.case_state,
    correction_case.current_revision,
    primary_target.target_resource_kind,
    primary_target.target_summary,
    correction_case.assigned_investigator_id,
    current_decision.outcome,
    correction_case.created_at,
    correction_case.updated_at,
    correction_case.closed_at
  from editorial.correction_cases correction_case
  left join lateral (
    select
      target.target_resource_kind,
      target.target_summary
    from editorial.correction_targets target
    where target.case_resource_id =
      correction_case.resource_id
      and target.target_role = 'primary'
    order by target.created_at, target.id
    limit 1
  ) primary_target on true
  left join editorial.correction_decisions current_decision
    on current_decision.id =
      correction_case.current_decision_id
  where (
      p_case_state is null
      or correction_case.case_state =
        p_case_state
    )
    and (
      p_assigned_investigator_id is null
      or correction_case.assigned_investigator_id =
        p_assigned_investigator_id
    )
  order by
    correction_case.updated_at desc,
    correction_case.resource_id
  limit p_limit
  offset p_offset;
end;
$function$;

create or replace function
  public.get_correction_case_workspace(
    p_case_resource_id uuid
  )
returns jsonb
language plpgsql
stable
security definer
set search_path =
  pg_catalog,
  public,
  auth,
  editorial,
  platform_private
as $function$
declare
  v_workspace jsonb;
  v_can_view_restricted_source boolean;
begin
  if p_case_resource_id is null then
    raise exception
      using
        errcode = '22023',
        message = 'case_resource_id is required.';
  end if;

  if coalesce(auth.role(), '') <> 'service_role'
     and not coalesce(
       public.current_user_is_administrator(),
       false
     )
     and not coalesce(
       public.current_user_has_capability(
         'view_corrections'
       ),
       false
     )
  then
    raise exception
      using
        errcode = '42501',
        message = 'The caller cannot view correction cases.';
  end if;

  v_can_view_restricted_source :=
    coalesce(auth.role(), '') = 'service_role'
    or coalesce(
      public.current_user_is_administrator(),
      false
    )
    or coalesce(
      public.current_user_has_capability(
        'view_trust_records'
      ),
      false
    )
    or coalesce(
      public.current_user_has_capability(
        'manage_sources'
      ),
      false
    )
    or coalesce(
      public.current_user_has_capability(
        'review_sources'
      ),
      false
    );

  select jsonb_build_object(
    'case',
    jsonb_build_object(
      'resource_id', correction_case.resource_id,
      'case_reference',
      'COR-' ||
        lpad(
          correction_case.case_number::text,
          8,
          '0'
        ),
      'origin_type', correction_case.origin_type,
      'origin_contribution_id',
      correction_case.origin_contribution_id,
      'origin_submitter_user_id',
      correction_case.origin_submitter_user_id,
      'origin_submitted_at',
      correction_case.origin_submitted_at,
      'origin_type_snapshot',
      correction_case.origin_type_snapshot,
      'origin_summary_snapshot',
      correction_case.origin_summary_snapshot,
      'correction_kind',
      correction_case.correction_kind,
      'priority', correction_case.priority,
      'case_state', correction_case.case_state,
      'current_revision',
      correction_case.current_revision,
      'assigned_investigator_id',
      correction_case.assigned_investigator_id,
      'assignment_reason',
      correction_case.assignment_reason,
      'assigned_at', correction_case.assigned_at,
      'triage_reason',
      correction_case.triage_reason,
      'triaged_by', correction_case.triaged_by,
      'triaged_at', correction_case.triaged_at,
      'investigation_summary',
      correction_case.investigation_summary,
      'investigator_recommendation',
      correction_case.investigator_recommendation,
      'evidence_ready',
      correction_case.evidence_ready,
      'submitted_for_decision_by',
      correction_case.submitted_for_decision_by,
      'submitted_for_decision_at',
      correction_case.submitted_for_decision_at,
      'current_decision_id',
      correction_case.current_decision_id,
      'closed_reason',
      correction_case.closed_reason,
      'closed_by', correction_case.closed_by,
      'closed_at', correction_case.closed_at,
      'created_by', correction_case.created_by,
      'updated_by', correction_case.updated_by,
      'created_at', correction_case.created_at,
      'updated_at', correction_case.updated_at
    ),
    'targets',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', target.id,
            'target_resource_id',
            target.target_resource_id,
            'target_resource_kind',
            target.target_resource_kind,
            'target_version_type',
            target.target_version_type,
            'target_version_id',
            target.target_version_id,
            'target_role', target.target_role,
            'target_summary',
            target.target_summary,
            'observed_resource_revision',
            target.observed_resource_revision,
            'observed_content_fingerprint',
            target.observed_content_fingerprint,
            'created_by', target.created_by,
            'created_at', target.created_at
          )
          order by
            case
              when target.target_role = 'primary'
                then 0
              else 1
            end,
            target.created_at,
            target.id
        )
        from editorial.correction_targets target
        where target.case_resource_id =
          correction_case.resource_id
      ),
      '[]'::jsonb
    ),
    'evidence',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', evidence.id,
            'source_id', evidence.source_id,
            'source_version_id',
            evidence.source_version_id,
            'citation_id',
            evidence.citation_id,
            'evidence_role',
            evidence.evidence_role,
            'internal_note',
            evidence.internal_note,
            'source_restricted',
            source.exposure_class in (
              'restricted',
              'confidential'
            ),
            'source_title',
            case
              when source.exposure_class in (
                'restricted',
                'confidential'
              )
              and not v_can_view_restricted_source
                then null
              else source.title
            end,
            'citation_public_label',
            case
              when source.exposure_class in (
                'restricted',
                'confidential'
              )
              and not v_can_view_restricted_source
                then null
              else citation.public_label
            end,
            'created_by', evidence.created_by,
            'created_at', evidence.created_at
          )
          order by evidence.created_at, evidence.id
        )
        from editorial.correction_evidence_links evidence
        join editorial.sources source
          on source.id = evidence.source_id
        left join editorial.citations citation
          on citation.id = evidence.citation_id
        where evidence.case_resource_id =
          correction_case.resource_id
      ),
      '[]'::jsonb
    ),
    'decisions',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', decision.id,
            'decision_number',
            decision.decision_number,
            'outcome', decision.outcome,
            'reason', decision.reason,
            'private_analysis',
            decision.private_analysis,
            'public_safe_explanation',
            decision.public_safe_explanation,
            'case_revision_observed',
            decision.case_revision_observed,
            'target_state_observed',
            decision.target_state_observed,
            'duplicate_of_case_resource_id',
            decision.duplicate_of_case_resource_id,
            'supersedes_decision_id',
            decision.supersedes_decision_id,
            'decided_by',
            decision.decided_by,
            'correlation_id',
            decision.correlation_id,
            'created_at', decision.created_at,
            'is_current',
            decision.id =
              correction_case.current_decision_id
          )
          order by
            decision.decision_number,
            decision.id
        )
        from editorial.correction_decisions decision
        where decision.case_resource_id =
          correction_case.resource_id
      ),
      '[]'::jsonb
    ),
    'related_resource_reviews',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', review.id,
            'related_resource_id',
            review.related_resource_id,
            'related_resource_kind',
            review.related_resource_kind,
            'review_state',
            review.review_state,
            'disposition',
            review.disposition,
            'reason', review.reason,
            'linked_correction_case_resource_id',
            review.linked_correction_case_resource_id,
            'review_revision',
            review.review_revision,
            'created_by', review.created_by,
            'updated_by', review.updated_by,
            'resolved_by', review.resolved_by,
            'resolved_at', review.resolved_at,
            'created_at', review.created_at,
            'updated_at', review.updated_at
          )
          order by review.created_at, review.id
        )
        from editorial.correction_related_resource_reviews review
        where review.case_resource_id =
          correction_case.resource_id
      ),
      '[]'::jsonb
    ),
    'events',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', event.id,
            'event_number',
            event.event_number,
            'event_type', event.event_type,
            'case_revision_before',
            event.case_revision_before,
            'case_revision_after',
            event.case_revision_after,
            'prior_state', event.prior_state,
            'resulting_state',
            event.resulting_state,
            'actor_id', event.actor_id,
            'reason', event.reason,
            'decision_id',
            event.decision_id,
            'target_id', event.target_id,
            'evidence_link_id',
            event.evidence_link_id,
            'related_resource_review_id',
            event.related_resource_review_id,
            'command_receipt_id',
            event.command_receipt_id,
            'correlation_id',
            event.correlation_id,
            'metadata', event.metadata,
            'created_at', event.created_at
          )
          order by event.event_number
        )
        from editorial.correction_events event
        where event.case_resource_id =
          correction_case.resource_id
      ),
      '[]'::jsonb
    ),
    'command_receipts',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', receipt.id,
            'command_type',
            receipt.command_type,
            'status', receipt.status,
            'error_code',
            receipt.error_code,
            'error_message',
            receipt.error_message,
            'accepted_at',
            receipt.accepted_at,
            'completed_at',
            receipt.completed_at
          )
          order by receipt.accepted_at, receipt.id
        )
        from platform_private.command_receipts receipt
        where receipt.resource_id =
          correction_case.resource_id
          and receipt.command_type like
            'correction.%'
      ),
      '[]'::jsonb
    )
  )
  into v_workspace
  from editorial.correction_cases correction_case
  where correction_case.resource_id =
    p_case_resource_id;

  if v_workspace is null then
    raise exception
      using
        errcode = 'P0002',
        message = 'The correction case does not exist.';
  end if;

  return v_workspace;
end;
$function$;

create or replace function
  public.list_correction_case_events(
    p_case_resource_id uuid,
    p_after_event_number bigint default 0,
    p_limit integer default 200
  )
returns table (
  event_id uuid,
  event_number bigint,
  event_type text,
  case_revision_before bigint,
  case_revision_after bigint,
  prior_state text,
  resulting_state text,
  actor_id uuid,
  reason text,
  decision_id uuid,
  target_id uuid,
  evidence_link_id uuid,
  related_resource_review_id uuid,
  command_receipt_id uuid,
  correlation_id uuid,
  metadata jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path =
  pg_catalog,
  public,
  auth,
  editorial
as $function$
begin
  if p_case_resource_id is null
     or p_after_event_number < 0
     or p_limit not between 1 and 500
  then
    raise exception
      using
        errcode = '22023',
        message = 'Case, event cursor, and limit are invalid.';
  end if;

  if coalesce(auth.role(), '') <> 'service_role'
     and not coalesce(
       public.current_user_is_administrator(),
       false
     )
     and not coalesce(
       public.current_user_has_capability(
         'view_corrections'
       ),
       false
     )
  then
    raise exception
      using
        errcode = '42501',
        message = 'The caller cannot view correction cases.';
  end if;

  if not exists (
    select 1
    from editorial.correction_cases correction_case
    where correction_case.resource_id =
      p_case_resource_id
  ) then
    raise exception
      using
        errcode = 'P0002',
        message = 'The correction case does not exist.';
  end if;

  return query
  select
    event.id,
    event.event_number,
    event.event_type,
    event.case_revision_before,
    event.case_revision_after,
    event.prior_state,
    event.resulting_state,
    event.actor_id,
    event.reason,
    event.decision_id,
    event.target_id,
    event.evidence_link_id,
    event.related_resource_review_id,
    event.command_receipt_id,
    event.correlation_id,
    event.metadata,
    event.created_at
  from editorial.correction_events event
  where event.case_resource_id =
      p_case_resource_id
    and event.event_number >
      p_after_event_number
  order by event.event_number
  limit p_limit;
end;
$function$;

alter table editorial.correction_evidence_links
  enable row level security;

alter table editorial.correction_decisions
  enable row level security;

alter table editorial.correction_related_resource_reviews
  enable row level security;

revoke all
on editorial.correction_evidence_links,
   editorial.correction_decisions,
   editorial.correction_related_resource_reviews
from public, anon, authenticated;

grant all
on editorial.correction_evidence_links,
   editorial.correction_decisions,
   editorial.correction_related_resource_reviews
to service_role;

revoke all on function
  editorial.assert_correction_evidence_integrity(),
  editorial.prevent_correction_evidence_update(),
  editorial.assert_correction_decision_integrity(),
  editorial.protect_correction_decision(),
  editorial.touch_correction_related_review_updated_at(),
  editorial.assert_correction_evidence_case_integrity(),
  editorial.assert_correction_decision_case_integrity(),
  editorial.assert_correction_related_review_case_integrity()
from public, anon, authenticated;

grant execute on function
  editorial.assert_correction_evidence_integrity(),
  editorial.prevent_correction_evidence_update(),
  editorial.assert_correction_decision_integrity(),
  editorial.protect_correction_decision(),
  editorial.touch_correction_related_review_updated_at(),
  editorial.assert_correction_evidence_case_integrity(),
  editorial.assert_correction_decision_case_integrity(),
  editorial.assert_correction_related_review_case_integrity()
to service_role;

revoke all on function
  platform_private.correction_actor_context(),
  platform_private.assert_correction_capability(text),
  platform_private.correction_request_fingerprint(
    text,
    uuid,
    jsonb
  ),
  platform_private.begin_resource_command(
    text,
    uuid,
    text,
    jsonb
  ),
  platform_private.begin_correction_create_command(
    text,
    text,
    jsonb
  ),
  platform_private.complete_resource_command(
    uuid,
    jsonb
  ),
  platform_private.reject_resource_command(
    uuid,
    text,
    text,
    jsonb
  ),
  platform_private.append_correction_event(
    uuid,
    text,
    bigint,
    bigint,
    text,
    text,
    uuid,
    text,
    uuid,
    uuid,
    uuid,
    uuid,
    uuid,
    uuid,
    jsonb
  ),
  platform_private.read_correction_command_result(
    uuid,
    boolean
  )
from public, anon, authenticated;

grant execute on function
  platform_private.correction_actor_context(),
  platform_private.assert_correction_capability(text),
  platform_private.correction_request_fingerprint(
    text,
    uuid,
    jsonb
  ),
  platform_private.begin_resource_command(
    text,
    uuid,
    text,
    jsonb
  ),
  platform_private.begin_correction_create_command(
    text,
    text,
    jsonb
  ),
  platform_private.complete_resource_command(
    uuid,
    jsonb
  ),
  platform_private.reject_resource_command(
    uuid,
    text,
    text,
    jsonb
  ),
  platform_private.append_correction_event(
    uuid,
    text,
    bigint,
    bigint,
    text,
    text,
    uuid,
    text,
    uuid,
    uuid,
    uuid,
    uuid,
    uuid,
    uuid,
    jsonb
  ),
  platform_private.read_correction_command_result(
    uuid,
    boolean
  )
to service_role;

revoke execute on function
  public.create_correction_case_from_contribution(
    uuid,
    text,
    text,
    text,
    uuid
  ),
  public.create_internal_correction_case(
    text,
    text,
    text,
    text,
    uuid
  ),
  public.triage_correction_case(
    uuid,
    bigint,
    text,
    text,
    uuid,
    uuid,
    text,
    text,
    text,
    uuid
  ),
  public.assign_correction_case(
    uuid,
    bigint,
    uuid,
    text,
    text,
    uuid
  ),
  public.link_correction_evidence(
    uuid,
    bigint,
    uuid,
    uuid,
    uuid,
    text,
    text,
    text,
    text,
    uuid
  ),
  public.unlink_correction_evidence(
    uuid,
    bigint,
    uuid,
    text,
    text,
    uuid
  ),
  public.update_correction_investigation(
    uuid,
    bigint,
    text,
    text,
    boolean,
    text,
    text,
    uuid
  ),
  public.submit_correction_for_decision(
    uuid,
    bigint,
    text,
    text,
    uuid
  ),
  public.return_correction_to_investigation(
    uuid,
    bigint,
    text,
    text,
    uuid
  ),
  public.record_correction_decision(
    uuid,
    bigint,
    text,
    text,
    text,
    text,
    jsonb,
    uuid,
    text,
    uuid
  ),
  public.add_related_resource_review(
    uuid,
    bigint,
    uuid,
    text,
    text,
    uuid
  ),
  public.set_related_resource_disposition(
    uuid,
    bigint,
    uuid,
    bigint,
    text,
    text,
    uuid,
    text,
    uuid
  ),
  public.close_correction_case(
    uuid,
    bigint,
    text,
    text,
    uuid
  ),
  public.reopen_correction_case(
    uuid,
    bigint,
    text,
    text,
    uuid
  ),
  public.list_correction_cases(
    text,
    uuid,
    integer,
    integer
  ),
  public.get_correction_case_workspace(uuid),
  public.list_correction_case_events(
    uuid,
    bigint,
    integer
  )
from public, anon;

grant execute on function
  public.create_correction_case_from_contribution(
    uuid,
    text,
    text,
    text,
    uuid
  ),
  public.create_internal_correction_case(
    text,
    text,
    text,
    text,
    uuid
  ),
  public.triage_correction_case(
    uuid,
    bigint,
    text,
    text,
    uuid,
    uuid,
    text,
    text,
    text,
    uuid
  ),
  public.assign_correction_case(
    uuid,
    bigint,
    uuid,
    text,
    text,
    uuid
  ),
  public.link_correction_evidence(
    uuid,
    bigint,
    uuid,
    uuid,
    uuid,
    text,
    text,
    text,
    text,
    uuid
  ),
  public.unlink_correction_evidence(
    uuid,
    bigint,
    uuid,
    text,
    text,
    uuid
  ),
  public.update_correction_investigation(
    uuid,
    bigint,
    text,
    text,
    boolean,
    text,
    text,
    uuid
  ),
  public.submit_correction_for_decision(
    uuid,
    bigint,
    text,
    text,
    uuid
  ),
  public.return_correction_to_investigation(
    uuid,
    bigint,
    text,
    text,
    uuid
  ),
  public.record_correction_decision(
    uuid,
    bigint,
    text,
    text,
    text,
    text,
    jsonb,
    uuid,
    text,
    uuid
  ),
  public.add_related_resource_review(
    uuid,
    bigint,
    uuid,
    text,
    text,
    uuid
  ),
  public.set_related_resource_disposition(
    uuid,
    bigint,
    uuid,
    bigint,
    text,
    text,
    uuid,
    text,
    uuid
  ),
  public.close_correction_case(
    uuid,
    bigint,
    text,
    text,
    uuid
  ),
  public.reopen_correction_case(
    uuid,
    bigint,
    text,
    text,
    uuid
  ),
  public.list_correction_cases(
    text,
    uuid,
    integer,
    integer
  ),
  public.get_correction_case_workspace(uuid),
  public.list_correction_case_events(
    uuid,
    bigint,
    integer
  )
to authenticated, service_role;

comment on table editorial.correction_evidence_links is
  'Current governed links from correction cases to exact approved Source and Citation evidence.';

comment on table editorial.correction_decisions is
  'Append-only institutional correction decisions.';

comment on table editorial.correction_related_resource_reviews is
  'Governed reviews of resources related to a correction case.';

comment on column editorial.correction_cases.current_decision_id is
  'Current append-only institutional correction decision for the case.';

comment on function
  public.list_correction_cases(
    text,
    uuid,
    integer,
    integer
  ) is
  'Narrow internal correction queue for callers with correction read authority.';

comment on function
  public.get_correction_case_workspace(uuid) is
  'Governed internal correction workspace with private and restricted evidence separation.';

comment on function
  public.list_correction_case_events(
    uuid,
    bigint,
    integer
  ) is
  'Ordered internal correction event history.';

commit;
