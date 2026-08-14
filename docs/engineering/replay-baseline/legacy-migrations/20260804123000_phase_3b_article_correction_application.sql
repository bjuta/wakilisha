-- Phase 3B Migration 3: Article correction application adapter.
--
-- Creates:
-- 1. the durable correction Article version kind
-- 2. immutable correction application records
-- 3. the current application pointer
-- 4. the correction.article.apply command type
-- 5. governed Article correction application authority
-- 6. durable stale rejection history
-- 7. application history in the correction workspace
--
-- This migration intentionally does not:
-- - publish an Article
-- - create public correction notes
-- - create contributor notification jobs
-- - add frontend authority
--
-- It creates no production correction cases or applications.

begin;

do $phase_3b_m3_preflight$
declare
  v_name text;
begin
  foreach v_name in array array[
    'editorial.correction_cases',
    'editorial.correction_targets',
    'editorial.correction_events',
    'editorial.correction_decisions',
    'editorial.resources',
    'editorial.article_resources',
    'editorial.article_versions',
    'editorial.article_taxonomy_terms',
    'public.wk_articles',
    'public.wk_slug_redirects',
    'public.registry_taxonomy_terms',
    'platform_private.command_types',
    'platform_private.command_receipts',
    'platform_private.outbox_events'
  ]
  loop
    if to_regclass(v_name) is null then
      raise exception
        'STOP: Required Migration 3 dependency is missing: %',
        v_name;
    end if;
  end loop;

  foreach v_name in array array[
    'platform_private.correction_actor_context()',
    'platform_private.assert_correction_capability(text)',
    'platform_private.begin_resource_command(text,uuid,text,jsonb)',
    'platform_private.complete_resource_command(uuid,jsonb)',
    'platform_private.reject_resource_command(uuid,text,text,jsonb)',
    'platform_private.read_correction_command_result(uuid,boolean)',
    'editorial.article_snapshot_fingerprint(text,text,text,text,text,uuid,text,jsonb,text,timestamptz,jsonb,jsonb)',
    'editorial.next_article_version_number(uuid)',
    'public.get_correction_case_workspace(uuid)'
  ]
  loop
    if to_regprocedure(v_name) is null then
      raise exception
        'STOP: Required Migration 3 function is missing: %',
        v_name;
    end if;
  end loop;

  if to_regclass(
       'editorial.correction_applications'
     ) is not null
  then
    raise exception
      'STOP: editorial.correction_applications already exists';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'editorial'
      and table_name = 'correction_cases'
      and column_name = 'current_application_id'
  ) then
    raise exception
      'STOP: correction_cases.current_application_id already exists';
  end if;

  if exists (
    select 1
    from platform_private.command_types
    where command_type in (
      'correction.article.apply',
      'correction.apply_article'
    )
  ) then
    raise exception
      'STOP: Article correction application command already exists';
  end if;

  if to_regprocedure(
       'public.apply_article_correction(uuid,bigint,uuid,uuid,uuid,uuid,uuid,text,jsonb,uuid[],text,text,uuid)'
     ) is not null
  then
    raise exception
      'STOP: public.apply_article_correction already exists';
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
  ) or exists (
    select 1
    from editorial.correction_decisions
  ) or exists (
    select 1
    from platform_private.command_receipts
    where command_type like 'correction.%'
  ) then
    raise exception
      'STOP: Migration 3 requires the accepted empty production correction state';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid =
        'editorial.article_versions'::regclass
      and constraint_row.conname =
        'article_versions_kind_check'
      and pg_get_constraintdef(
        constraint_row.oid,
        true
      ) like '%review_applied%'
      and pg_get_constraintdef(
        constraint_row.oid,
        true
      ) not like '%correction%'
  ) then
    raise exception
      'STOP: Article version-kind authority is not at the accepted pre-Migration 3 state';
  end if;
end;
$phase_3b_m3_preflight$;

alter table editorial.article_versions
  drop constraint article_versions_kind_check;

alter table editorial.article_versions
  add constraint article_versions_kind_check
  check (
    version_kind in (
      'baseline',
      'autosave',
      'manual_save',
      'submitted',
      'approved',
      'scheduled',
      'published',
      'review_applied',
      'correction'
    )
  );

create or replace function
  editorial.protect_article_version()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, editorial
as $function$
begin
  if tg_op = 'UPDATE' then
    raise exception
      'Article versions are immutable';
  end if;

  if old.version_kind in (
    'baseline',
    'submitted',
    'correction'
  ) then
    raise exception
      'Baseline, submitted, and correction Article versions cannot be deleted';
  end if;

  if exists (
    select 1
    from editorial.resources resource
    where resource.current_working_version_id = old.id
       or resource.current_submitted_version_id = old.id
  ) then
    raise exception
      'An Article version referenced by a resource pointer cannot be deleted';
  end if;

  return old;
end;
$function$;

create table editorial.correction_applications (
  id uuid primary key default gen_random_uuid(),
  case_resource_id uuid not null,
  decision_id uuid not null,
  command_receipt_id uuid not null,
  command_type text not null default 'correction.article.apply',
  adapter_type text not null default 'article',
  target_id uuid not null,
  target_resource_id uuid not null,
  challenged_version_id uuid not null,
  expected_published_version_id uuid not null,
  expected_working_version_id uuid,
  expected_working_fingerprint text,
  resulting_version_id uuid not null,
  application_summary text not null,
  applied_by uuid not null,
  correlation_id uuid not null,
  applied_at timestamptz not null default now(),

  constraint correction_applications_case_fkey
    foreign key (case_resource_id)
    references editorial.correction_cases(resource_id)
    on delete restrict,

  constraint correction_applications_decision_fkey
    foreign key (decision_id)
    references editorial.correction_decisions(id)
    on delete restrict,

  constraint correction_applications_target_fkey
    foreign key (target_id)
    references editorial.correction_targets(id)
    on delete restrict,

  constraint correction_applications_resource_fkey
    foreign key (target_resource_id)
    references editorial.resources(id)
    on delete restrict,

  constraint correction_applications_challenged_version_fkey
    foreign key (challenged_version_id)
    references editorial.article_versions(id)
    on delete restrict,

  constraint correction_applications_expected_published_version_fkey
    foreign key (expected_published_version_id)
    references editorial.article_versions(id)
    on delete restrict,

  constraint correction_applications_expected_working_version_fkey
    foreign key (expected_working_version_id)
    references editorial.article_versions(id)
    on delete restrict,

  constraint correction_applications_resulting_version_fkey
    foreign key (resulting_version_id)
    references editorial.article_versions(id)
    on delete restrict,

  constraint correction_applications_receipt_fkey
    foreign key (
      command_receipt_id,
      case_resource_id,
      command_type
    )
    references platform_private.command_receipts(
      id,
      resource_id,
      command_type
    )
    on delete restrict,

  constraint correction_applications_receipt_unique
    unique (command_receipt_id),

  constraint correction_applications_decision_unique
    unique (decision_id),

  constraint correction_applications_command_type_check
    check (
      command_type = 'correction.article.apply'
    ),

  constraint correction_applications_adapter_type_check
    check (
      adapter_type = 'article'
    ),

  constraint correction_applications_summary_check
    check (
      nullif(
        btrim(application_summary),
        ''
      ) is not null
      and length(application_summary) <= 8000
    ),

  constraint correction_applications_working_fingerprint_check
    check (
      (
        expected_working_version_id is null
        and expected_working_fingerprint is null
      )
      or (
        expected_working_version_id is not null
        and expected_working_fingerprint ~
          '^[0-9a-f]{64}$'
      )
    ),

  constraint correction_applications_version_identity_check
    check (
      expected_published_version_id =
        challenged_version_id
      and resulting_version_id <>
        challenged_version_id
      and (
        expected_working_version_id is null
        or resulting_version_id <>
          expected_working_version_id
      )
    )
);

create index correction_applications_case_applied_idx
on editorial.correction_applications (
  case_resource_id,
  applied_at desc,
  id
);

create index correction_applications_resource_applied_idx
on editorial.correction_applications (
  target_resource_id,
  applied_at desc,
  id
);

create index correction_applications_resulting_version_idx
on editorial.correction_applications (
  resulting_version_id
);

alter table editorial.correction_cases
  add column current_application_id uuid;

alter table editorial.correction_cases
  add constraint correction_cases_current_application_fkey
  foreign key (current_application_id)
  references editorial.correction_applications(id)
  on delete restrict
  deferrable initially deferred;

create index correction_cases_current_application_idx
on editorial.correction_cases (
  current_application_id
)
where current_application_id is not null;

alter table editorial.correction_events
  add constraint correction_events_application_fkey
  foreign key (application_id)
  references editorial.correction_applications(id)
  on delete restrict
  deferrable initially deferred;

create or replace function
  editorial.protect_correction_application()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
begin
  raise exception
    'Correction applications are immutable';
end;
$function$;

create trigger correction_applications_append_only
before update or delete
on editorial.correction_applications
for each row
execute function
  editorial.protect_correction_application();

create or replace function
  editorial.assert_correction_application_integrity()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, editorial, platform_private
as $function$
declare
  v_case editorial.correction_cases%rowtype;
  v_decision editorial.correction_decisions%rowtype;
  v_target editorial.correction_targets%rowtype;
  v_resource editorial.resources%rowtype;
  v_challenged editorial.article_versions%rowtype;
  v_expected_working editorial.article_versions%rowtype;
  v_resulting editorial.article_versions%rowtype;
  v_receipt platform_private.command_receipts%rowtype;
begin
  select correction_case.*
  into v_case
  from editorial.correction_cases correction_case
  where correction_case.resource_id =
    new.case_resource_id;

  if not found
     or v_case.case_state <> 'applied'
     or v_case.current_decision_id
       is distinct from new.decision_id
     or v_case.current_application_id
       is distinct from new.id
  then
    raise exception
      'Correction application must be the current application of an applied case';
  end if;

  select decision.*
  into v_decision
  from editorial.correction_decisions decision
  where decision.id = new.decision_id;

  if not found
     or v_decision.case_resource_id
       is distinct from new.case_resource_id
     or v_decision.outcome <>
       'correction_required'
  then
    raise exception
      'Correction application requires the current correction-required decision';
  end if;

  select target.*
  into v_target
  from editorial.correction_targets target
  where target.id = new.target_id;

  if not found
     or v_target.case_resource_id
       is distinct from new.case_resource_id
     or v_target.target_role <> 'primary'
     or v_target.target_resource_kind <> 'article'
     or v_target.target_version_type <>
       'article_version'
     or v_target.target_resource_id
       is distinct from new.target_resource_id
     or v_target.target_version_id
       is distinct from new.challenged_version_id
  then
    raise exception
      'Correction application target identity is invalid';
  end if;

  select resource.*
  into v_resource
  from editorial.resources resource
  where resource.id =
    new.target_resource_id
    and resource.resource_kind = 'article';

  if not found
     or v_resource.current_published_version_id
       is distinct from
         new.expected_published_version_id
     or v_resource.current_working_version_id
       is distinct from
         new.resulting_version_id
  then
    raise exception
      'Correction application Article pointers are invalid';
  end if;

  if not exists (
    select 1
    from editorial.article_resources binding
    where binding.resource_id =
      new.target_resource_id
      and binding.resource_kind = 'article'
  ) then
    raise exception
      'Correction application requires an Article resource binding';
  end if;

  select version.*
  into v_challenged
  from editorial.article_versions version
  where version.id =
    new.challenged_version_id;

  if not found
     or v_challenged.resource_id
       is distinct from new.target_resource_id
  then
    raise exception
      'Challenged Article version does not belong to the target resource';
  end if;

  if new.expected_working_version_id is not null then
    select version.*
    into v_expected_working
    from editorial.article_versions version
    where version.id =
      new.expected_working_version_id;

    if not found
       or v_expected_working.resource_id
         is distinct from new.target_resource_id
       or v_expected_working.content_fingerprint
         is distinct from
           new.expected_working_fingerprint
    then
      raise exception
        'Expected working Article version proof is invalid';
    end if;
  end if;

  select version.*
  into v_resulting
  from editorial.article_versions version
  where version.id =
    new.resulting_version_id;

  if not found
     or v_resulting.resource_id
       is distinct from new.target_resource_id
     or v_resulting.article_id
       is distinct from v_challenged.article_id
     or v_resulting.version_kind <>
       'correction'
  then
    raise exception
      'Resulting correction Article version is invalid';
  end if;

  select receipt.*
  into v_receipt
  from platform_private.command_receipts receipt
  where receipt.id =
    new.command_receipt_id;

  if not found
     or v_receipt.resource_id
       is distinct from new.case_resource_id
     or v_receipt.command_type <>
       'correction.article.apply'
     or v_receipt.status <> 'succeeded'
  then
    raise exception
      'Correction application command receipt is invalid';
  end if;

  perform editorial.validate_correction_case_history(
    new.case_resource_id
  );

  return new;
end;
$function$;

create constraint trigger correction_applications_integrity
after insert
on editorial.correction_applications
deferrable initially deferred
for each row
execute function
  editorial.assert_correction_application_integrity();

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
  v_application_case_id uuid;
  v_application_decision_id uuid;
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
       or v_case.current_application_id is not null
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
    'applied',
    'closed'
  ) then
    if v_case.assigned_investigator_id is null
       or nullif(
         btrim(v_case.assignment_reason),
         ''
       ) is null
       or v_case.assigned_at is null
    then
      raise exception
        'Active correction case requires complete assignment metadata';
    end if;
  end if;

  if v_case.case_state in (
    'awaiting_decision',
    'decided',
    'applied',
    'closed'
  ) then
    if nullif(
         btrim(v_case.investigation_summary),
         ''
       ) is null
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
      'Decision-submission metadata requires awaiting_decision, decided, applied, or closed state';
  end if;

  if v_case.current_decision_id is not null then
    select
      decision.case_resource_id,
      decision.outcome
    into
      v_decision_case_id,
      v_decision_outcome
    from editorial.correction_decisions decision
    where decision.id =
      v_case.current_decision_id;

    if not found
       or v_decision_case_id is distinct from
         p_case_resource_id
    then
      raise exception
        'Current correction decision must belong to the same case';
    end if;
  end if;

  if v_case.current_application_id is not null then
    select
      application.case_resource_id,
      application.decision_id
    into
      v_application_case_id,
      v_application_decision_id
    from editorial.correction_applications application
    where application.id =
      v_case.current_application_id;

    if not found
       or v_application_case_id is distinct from
         p_case_resource_id
       or v_application_decision_id is distinct from
         v_case.current_decision_id
    then
      raise exception
        'Current correction application must belong to the same case and current decision';
    end if;
  end if;

  if v_case.case_state in (
    'decided',
    'applied',
    'closed'
  )
     and v_case.current_decision_id is null
  then
    raise exception
      'Decided, applied, or closed correction case requires a current decision';
  end if;

  if v_case.case_state = 'applied'
     and v_case.current_application_id is null
  then
    raise exception
      'Applied correction case requires a current application';
  end if;

  if v_case.case_state <> 'applied'
     and v_case.current_application_id is not null
  then
    raise exception
      'Current correction application requires applied state';
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
        'Correction-required cases cannot close before public-note and contributor follow-up authority exists';
    end if;

    if exists (
      select 1
      from editorial.correction_related_resource_reviews review
      where review.case_resource_id =
        p_case_resource_id
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
  editorial.assert_correction_application_case_integrity()
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

create constraint trigger correction_applications_case_integrity
after insert
on editorial.correction_applications
deferrable initially deferred
for each row
execute function
  editorial.assert_correction_application_case_integrity();

insert into platform_private.command_types (
  command_type,
  job_type,
  accepted_event_type,
  success_event_type,
  failure_event_type,
  retry_event_type
)
values (
  'correction.article.apply',
  'correction.article.apply.sync',
  'correction.article.apply.accepted',
  'correction.article.apply.succeeded',
  'correction.article.apply.failed',
  'correction.article.apply.retry_scheduled'
);

create or replace function
  platform_private.append_correction_application_event(
    p_case_resource_id uuid,
    p_event_type text,
    p_case_revision_before bigint,
    p_case_revision_after bigint,
    p_prior_state text,
    p_resulting_state text,
    p_actor_id uuid,
    p_reason text,
    p_decision_id uuid,
    p_application_id uuid,
    p_target_id uuid,
    p_command_receipt_id uuid,
    p_correlation_id uuid,
    p_metadata jsonb
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
      message = 'Correction application event metadata must be a JSON object no larger than 32 KB.';
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

  select coalesce(
    max(event.event_number),
    0
  ) + 1
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
    application_id,
    target_id,
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
    p_application_id,
    p_target_id,
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
  public.apply_article_correction(
    p_case_resource_id uuid,
    p_expected_case_revision bigint,
    p_expected_current_decision_id uuid,
    p_primary_target_id uuid,
    p_challenged_article_version_id uuid,
    p_expected_published_article_version_id uuid,
    p_expected_working_article_version_id uuid,
    p_expected_working_fingerprint text,
    p_corrected_payload jsonb,
    p_taxonomy_term_ids uuid[],
    p_application_summary text,
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
  platform_private,
  extensions
as $function$
declare
  v_actor uuid;
  v_context record;
  v_begin record;
  v_case editorial.correction_cases%rowtype;
  v_decision editorial.correction_decisions%rowtype;
  v_target editorial.correction_targets%rowtype;
  v_case_resource editorial.resources%rowtype;
  v_article_resource editorial.resources%rowtype;
  v_article public.wk_articles%rowtype;
  v_working_version editorial.article_versions%rowtype;
  v_taxonomy_term_ids uuid[];
  v_taxonomy_count bigint;
  v_categories jsonb;
  v_tags jsonb;
  v_payload_hash text;
  v_request_payload jsonb;
  v_rejection_code text;
  v_rejection_message text;
  v_new_slug text;
  v_new_published_at timestamptz;
  v_new_hero_image_id uuid;
  v_new_version_id uuid;
  v_new_version_number bigint;
  v_new_fingerprint text;
  v_application_id uuid;
  v_result jsonb;
begin
  v_actor :=
    platform_private.assert_correction_capability(
      'apply_corrections'
    );

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
         'edit_others_articles'
       ),
       false
     )
  then
    raise exception
      using
        errcode = '42501',
        message = 'The caller does not hold Article correction application authority.';
  end if;

  if p_case_resource_id is null
     or p_expected_case_revision < 1
     or p_expected_current_decision_id is null
     or p_primary_target_id is null
     or p_challenged_article_version_id is null
     or p_expected_published_article_version_id is null
     or p_correlation_id is null
     or nullif(
       btrim(p_application_summary),
       ''
     ) is null
     or length(p_application_summary) > 8000
     or p_corrected_payload is null
     or jsonb_typeof(p_corrected_payload) <>
       'object'
     or octet_length(
       p_corrected_payload::text
     ) > 4194304
  then
    raise exception
      using
        errcode = '22023',
        message = 'Case, revision, decision, target, Article state, corrected snapshot, summary, and correlation identity are required.';
  end if;

  if p_expected_working_article_version_id is null
     and p_expected_working_fingerprint is not null
  then
    raise exception
      using
        errcode = '22023',
        message = 'A working fingerprint requires an expected working Article version.';
  end if;

  if p_expected_working_article_version_id is not null
     and coalesce(
       p_expected_working_fingerprint,
       ''
     ) !~ '^[0-9a-f]{64}$'
  then
    raise exception
      using
        errcode = '22023',
        message = 'Expected working fingerprint must be a SHA-256 value.';
  end if;

  if not (
    p_corrected_payload ?& array[
      'title',
      'slug',
      'excerpt',
      'content_html',
      'author',
      'published_at',
      'seo',
      'hero_image_id',
      'hero_image_url'
    ]
  )
     or p_corrected_payload - array[
       'title',
       'slug',
       'excerpt',
       'content_html',
       'author',
       'published_at',
       'seo',
       'hero_image_id',
       'hero_image_url'
     ] <> '{}'::jsonb
  then
    raise exception
      using
        errcode = '22023',
        message = 'Corrected Article payload must contain exactly the complete supported snapshot fields.';
  end if;

  if nullif(
       btrim(
         p_corrected_payload ->> 'title'
       ),
       ''
     ) is null
     or nullif(
       btrim(
         p_corrected_payload ->> 'slug'
       ),
       ''
     ) is null
     or p_corrected_payload ->> 'content_html'
       is null
     or coalesce(
       jsonb_typeof(
         p_corrected_payload -> 'seo'
       ),
       ''
     ) <> 'object'
  then
    raise exception
      using
        errcode = '22023',
        message = 'Corrected Article title, slug, content, and SEO object are required.';
  end if;

  v_new_slug := btrim(
    p_corrected_payload ->> 'slug'
  );

  if v_new_slug !~
     '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  then
    raise exception
      using
        errcode = '22023',
        message = 'Corrected Article slug is invalid.';
  end if;

  begin
    v_new_published_at :=
      nullif(
        p_corrected_payload ->>
          'published_at',
        ''
      )::timestamptz;

    v_new_hero_image_id :=
      nullif(
        p_corrected_payload ->>
          'hero_image_id',
        ''
      )::uuid;
  exception
    when invalid_text_representation
      or datetime_field_overflow
    then
      raise exception
        using
          errcode = '22023',
          message = 'Corrected Article publication or hero-image identity is invalid.';
  end;

  select coalesce(
    array_agg(
      distinct term_id
      order by term_id
    ),
    '{}'::uuid[]
  )
  into v_taxonomy_term_ids
  from unnest(
    coalesce(
      p_taxonomy_term_ids,
      '{}'::uuid[]
    )
  ) term_id;

  select count(*)
  into v_taxonomy_count
  from public.registry_taxonomy_terms term
  where term.id = any(
      v_taxonomy_term_ids
    )
    and term.taxonomy in (
      'category',
      'post_tag'
    )
    and term.status = 'active';

  if v_taxonomy_count <>
     cardinality(v_taxonomy_term_ids)
  then
    raise exception
      using
        errcode = '22023',
        message = 'Every corrected Article taxonomy identity must be active and supported.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name',
        term.name,
        'slug',
        term.slug
      )
      order by term.name
    ),
    '[]'::jsonb
  )
  into v_categories
  from public.registry_taxonomy_terms term
  where term.id = any(
      v_taxonomy_term_ids
    )
    and term.taxonomy = 'category'
    and term.status = 'active';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name',
        term.name,
        'slug',
        term.slug
      )
      order by term.name
    ),
    '[]'::jsonb
  )
  into v_tags
  from public.registry_taxonomy_terms term
  where term.id = any(
      v_taxonomy_term_ids
    )
    and term.taxonomy = 'post_tag'
    and term.status = 'active';

  v_payload_hash := encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'corrected_payload',
          p_corrected_payload,
          'taxonomy_term_ids',
          to_jsonb(v_taxonomy_term_ids)
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  v_request_payload := jsonb_build_object(
    'expected_case_revision',
    p_expected_case_revision,
    'expected_current_decision_id',
    p_expected_current_decision_id,
    'primary_target_id',
    p_primary_target_id,
    'challenged_article_version_id',
    p_challenged_article_version_id,
    'expected_published_article_version_id',
    p_expected_published_article_version_id,
    'expected_working_article_version_id',
    p_expected_working_article_version_id,
    'expected_working_fingerprint',
    p_expected_working_fingerprint,
    'corrected_snapshot_request_fingerprint',
    v_payload_hash,
    'application_summary',
    btrim(p_application_summary),
    'correlation_id',
    p_correlation_id
  );

  select *
  into v_begin
  from platform_private.begin_resource_command(
    'correction.article.apply',
    p_case_resource_id,
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

  select resource.*
  into v_case_resource
  from editorial.resources resource
  where resource.id =
    p_case_resource_id
    and resource.resource_kind =
      'correction_case'
  for update;

  select correction_case.*
  into v_case
  from editorial.correction_cases correction_case
  where correction_case.resource_id =
    p_case_resource_id
  for update;

  if not found
     or v_case_resource.id is null
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'case_not_found',
      'The correction case does not exist.',
      jsonb_build_object(
        'case_revision',
        null,
        'case_state',
        null
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

  perform platform_private.append_correction_application_event(
    p_case_resource_id,
    'application_accepted',
    v_case.current_revision,
    v_case.current_revision,
    v_case.case_state,
    v_case.case_state,
    v_actor,
    'Article correction application command accepted.',
    v_case.current_decision_id,
    null,
    p_primary_target_id,
    v_begin.command_receipt_id,
    p_correlation_id,
    jsonb_build_object(
      'expected_case_revision',
      p_expected_case_revision,
      'expected_current_decision_id',
      p_expected_current_decision_id,
      'expected_published_article_version_id',
      p_expected_published_article_version_id,
      'expected_working_article_version_id',
      p_expected_working_article_version_id,
      'corrected_snapshot_request_fingerprint',
      v_payload_hash
    )
  );

  if v_case.current_revision <>
     p_expected_case_revision
  then
    v_rejection_code :=
      'case_revision_changed';
    v_rejection_message :=
      'The correction case revision changed.';
  elsif v_case.current_application_id is not null
        or exists (
          select 1
          from editorial.correction_applications application
          where application.decision_id =
            p_expected_current_decision_id
        )
  then
    v_rejection_code :=
      'application_already_succeeded';
    v_rejection_message :=
      'The current correction decision already has a successful application.';
  elsif v_case.case_state <> 'decided'
        or v_case.current_decision_id
          is distinct from
            p_expected_current_decision_id
  then
    v_rejection_code :=
      'decision_changed';
    v_rejection_message :=
      'The current correction decision or case state changed.';
  else
    select decision.*
    into v_decision
    from editorial.correction_decisions decision
    where decision.id =
      p_expected_current_decision_id;

    if not found
       or v_decision.case_resource_id
         is distinct from
           p_case_resource_id
    then
      v_rejection_code :=
        'decision_changed';
      v_rejection_message :=
        'The current correction decision changed.';
    elsif v_decision.outcome <>
          'correction_required'
    then
      v_rejection_code :=
        'decision_not_correction_required';
      v_rejection_message :=
        'The current correction decision does not require a correction.';
    end if;
  end if;

  if v_rejection_code is null then
    select target.*
    into v_target
    from editorial.correction_targets target
    where target.id =
      p_primary_target_id
    for update;

    if not found
       or v_target.case_resource_id
         is distinct from
           p_case_resource_id
       or v_target.target_role <> 'primary'
       or v_target.target_resource_kind <>
         'article'
       or v_target.target_version_type <>
         'article_version'
       or v_target.target_version_id
         is distinct from
           p_challenged_article_version_id
    then
      v_rejection_code :=
        'target_changed';
      v_rejection_message :=
        'The primary correction target changed.';
    end if;
  end if;

  if v_rejection_code is null then
    select resource.*
    into v_article_resource
    from editorial.resources resource
    where resource.id =
      v_target.target_resource_id
      and resource.resource_kind = 'article'
    for update;

    if not found then
      v_rejection_code :=
        'target_changed';
      v_rejection_message :=
        'The target Article resource changed.';
    end if;
  end if;

  if v_rejection_code is null then
    select article.*
    into v_article
    from editorial.article_resources binding
    join public.wk_articles article
      on article.id = binding.article_id
    where binding.resource_id =
      v_article_resource.id
      and binding.resource_kind = 'article'
    for update of article;

    if not found then
      v_rejection_code :=
        'target_changed';
      v_rejection_message :=
        'The target Article binding changed.';
    end if;
  end if;

  if v_rejection_code is null
     and (
       v_article_resource.current_published_version_id
         is distinct from
           p_expected_published_article_version_id
       or p_expected_published_article_version_id
         is distinct from
           p_challenged_article_version_id
       or v_target.target_resource_id
         is distinct from
           v_article_resource.id
     )
  then
    v_rejection_code :=
      'published_version_changed';
    v_rejection_message :=
      'The current published Article version changed.';
  end if;

  if v_rejection_code is null
     and v_article_resource.current_working_version_id
       is distinct from
         p_expected_working_article_version_id
  then
    v_rejection_code :=
      'working_version_changed';
    v_rejection_message :=
      'The current working Article version changed.';
  end if;

  if v_rejection_code is null
     and p_expected_working_article_version_id
       is not null
  then
    select version.*
    into v_working_version
    from editorial.article_versions version
    where version.id =
      p_expected_working_article_version_id;

    if not found
       or v_working_version.resource_id
         is distinct from
           v_article_resource.id
       or v_working_version.content_fingerprint
         is distinct from
           p_expected_working_fingerprint
    then
      v_rejection_code :=
        'working_fingerprint_changed';
      v_rejection_message :=
        'The current working Article fingerprint changed.';
    end if;
  end if;

  if v_rejection_code is null
     and (
       select count(*)
       from public.registry_taxonomy_terms term
       where term.id = any(
           v_taxonomy_term_ids
         )
         and term.taxonomy in (
           'category',
           'post_tag'
         )
         and term.status = 'active'
     ) <> cardinality(v_taxonomy_term_ids)
  then
    v_rejection_code :=
      'target_changed';
    v_rejection_message :=
      'The corrected Article taxonomy authority changed.';
  end if;

  if v_rejection_code is null
     and v_new_slug <> v_article.slug
     and exists (
       select 1
       from public.wk_articles other_article
       where other_article.slug =
           v_new_slug
         and other_article.id <>
           v_article.id
     )
  then
    v_rejection_code :=
      'target_changed';
    v_rejection_message :=
      'The corrected Article slug is no longer available.';
  end if;

  if v_rejection_code is not null then
    v_result := jsonb_build_object(
      'case_resource_id',
      p_case_resource_id,
      'case_revision',
      v_case.current_revision,
      'case_state',
      v_case.case_state,
      'rejection_code',
      v_rejection_code
    );

    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      v_rejection_code,
      v_rejection_message,
      v_result
    );

    perform platform_private.append_correction_application_event(
      p_case_resource_id,
      'application_rejected_stale',
      v_case.current_revision,
      v_case.current_revision,
      v_case.case_state,
      v_case.case_state,
      v_actor,
      v_rejection_message,
      v_case.current_decision_id,
      null,
      p_primary_target_id,
      v_begin.command_receipt_id,
      p_correlation_id,
      jsonb_build_object(
        'rejection_code',
        v_rejection_code,
        'expected_case_revision',
        p_expected_case_revision,
        'actual_case_revision',
        v_case.current_revision,
        'expected_current_decision_id',
        p_expected_current_decision_id,
        'actual_current_decision_id',
        v_case.current_decision_id,
        'expected_published_article_version_id',
        p_expected_published_article_version_id,
        'actual_published_article_version_id',
        v_article_resource.current_published_version_id,
        'expected_working_article_version_id',
        p_expected_working_article_version_id,
        'actual_working_article_version_id',
        v_article_resource.current_working_version_id
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

  if v_new_slug <> v_article.slug then
    insert into public.wk_slug_redirects (
      old_slug,
      new_slug,
      entity_type,
      created_by,
      old_path,
      new_path,
      redirect_status,
      updated_at
    )
    values (
      v_article.slug,
      v_new_slug,
      'article',
      v_actor::text,
      '/magazine/' || v_article.slug,
      '/magazine/' || v_new_slug,
      308,
      now()
    );
  end if;

  update public.wk_articles as article
  set
    title =
      p_corrected_payload ->> 'title',
    slug = v_new_slug,
    excerpt =
      p_corrected_payload ->> 'excerpt',
    content_html =
      p_corrected_payload ->> 'content_html',
    author =
      p_corrected_payload ->> 'author',
    published_at =
      v_new_published_at,
    seo =
      p_corrected_payload -> 'seo',
    hero_image_id =
      v_new_hero_image_id,
    hero_image_url =
      p_corrected_payload ->>
        'hero_image_url',
    categories = v_categories,
    tags = v_tags,
    draft_version =
      article.draft_version + 1,
    modified_at = now(),
    updated_at = now()
  where article.id = v_article.id
  returning article.*
  into v_article;

  delete from editorial.article_taxonomy_terms
  where resource_id =
    v_article_resource.id;

  insert into editorial.article_taxonomy_terms (
    resource_id,
    term_id,
    taxonomy,
    created_by
  )
  select
    v_article_resource.id,
    term.id,
    term.taxonomy,
    v_actor
  from public.registry_taxonomy_terms term
  where term.id = any(
      v_taxonomy_term_ids
    )
    and term.taxonomy in (
      'category',
      'post_tag'
    )
    and term.status = 'active'
  on conflict do nothing;

  v_new_version_number :=
    editorial.next_article_version_number(
      v_article_resource.id
    );

  v_new_fingerprint :=
    editorial.article_snapshot_fingerprint(
      v_article.title,
      v_article.slug,
      v_article.excerpt,
      v_article.content_html,
      v_article.author,
      v_article.hero_image_id,
      v_article.hero_image_url,
      v_article.seo,
      v_article.wp_status,
      v_article.published_at,
      v_article.categories,
      v_article.tags
    );

  insert into editorial.article_versions (
    resource_id,
    article_id,
    version_number,
    version_kind,
    source_draft_version,
    title,
    slug,
    excerpt,
    content_html,
    author_display,
    owner_id,
    hero_image_id,
    hero_image_url,
    seo,
    lifecycle_state,
    wp_status,
    published_at,
    category_snapshot,
    tag_snapshot,
    created_by,
    content_fingerprint
  )
  values (
    v_article_resource.id,
    v_article.id,
    v_new_version_number,
    'correction',
    v_article.draft_version,
    v_article.title,
    v_article.slug,
    v_article.excerpt,
    v_article.content_html,
    v_article.author,
    v_article_resource.owner_id,
    v_article.hero_image_id,
    v_article.hero_image_url,
    v_article.seo,
    v_article_resource.lifecycle_state,
    v_article.wp_status,
    v_article.published_at,
    v_article.categories,
    v_article.tags,
    v_actor,
    v_new_fingerprint
  )
  returning id
  into v_new_version_id;

  update editorial.resources
  set
    current_working_version_id =
      v_new_version_id,
    updated_at = now()
  where id = v_article_resource.id;

  insert into editorial.correction_applications (
    case_resource_id,
    decision_id,
    command_receipt_id,
    target_id,
    target_resource_id,
    challenged_version_id,
    expected_published_version_id,
    expected_working_version_id,
    expected_working_fingerprint,
    resulting_version_id,
    application_summary,
    applied_by,
    correlation_id
  )
  values (
    p_case_resource_id,
    v_decision.id,
    v_begin.command_receipt_id,
    v_target.id,
    v_article_resource.id,
    p_challenged_article_version_id,
    p_expected_published_article_version_id,
    p_expected_working_article_version_id,
    p_expected_working_fingerprint,
    v_new_version_id,
    btrim(p_application_summary),
    v_actor,
    p_correlation_id
  )
  returning id
  into v_application_id;

  update editorial.correction_cases
  set
    case_state = 'applied',
    current_revision =
      v_case.current_revision + 1,
    current_application_id =
      v_application_id,
    updated_by = v_actor,
    updated_at = now()
  where resource_id =
    p_case_resource_id;

  perform platform_private.append_correction_application_event(
    p_case_resource_id,
    'application_succeeded',
    v_case.current_revision,
    v_case.current_revision + 1,
    v_case.case_state,
    'applied',
    v_actor,
    btrim(p_application_summary),
    v_decision.id,
    v_application_id,
    v_target.id,
    v_begin.command_receipt_id,
    p_correlation_id,
    jsonb_build_object(
      'application_id',
      v_application_id,
      'target_resource_id',
      v_article_resource.id,
      'challenged_version_id',
      p_challenged_article_version_id,
      'expected_published_version_id',
      p_expected_published_article_version_id,
      'expected_working_version_id',
      p_expected_working_article_version_id,
      'resulting_version_id',
      v_new_version_id,
      'resulting_version_number',
      v_new_version_number,
      'resulting_content_fingerprint',
      v_new_fingerprint,
      'published_pointer_changed',
      false
    )
  );

  v_result := jsonb_build_object(
    'case_resource_id',
    p_case_resource_id,
    'case_revision',
    v_case.current_revision + 1,
    'case_state',
    'applied',
    'application_id',
    v_application_id,
    'decision_id',
    v_decision.id,
    'target_id',
    v_target.id,
    'target_resource_id',
    v_article_resource.id,
    'resulting_version_id',
    v_new_version_id,
    'resulting_version_number',
    v_new_version_number,
    'resulting_content_fingerprint',
    v_new_fingerprint,
    'current_published_version_id',
    p_expected_published_article_version_id,
    'current_working_version_id',
    v_new_version_id
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

alter function
  public.get_correction_case_workspace(uuid)
set schema platform_private;

alter function
  platform_private.get_correction_case_workspace(uuid)
rename to get_correction_case_workspace_base;

revoke all on function
  platform_private.get_correction_case_workspace_base(uuid)
from public, anon, authenticated;

grant execute on function
  platform_private.get_correction_case_workspace_base(uuid)
to service_role;

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
  v_current_application_id uuid;
  v_applications jsonb;
begin
  v_workspace :=
    platform_private.get_correction_case_workspace_base(
      p_case_resource_id
    );

  select correction_case.current_application_id
  into v_current_application_id
  from editorial.correction_cases correction_case
  where correction_case.resource_id =
    p_case_resource_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',
        application.id,
        'decision_id',
        application.decision_id,
        'command_receipt_id',
        application.command_receipt_id,
        'command_type',
        application.command_type,
        'adapter_type',
        application.adapter_type,
        'target_id',
        application.target_id,
        'target_resource_id',
        application.target_resource_id,
        'challenged_version_id',
        application.challenged_version_id,
        'expected_published_version_id',
        application.expected_published_version_id,
        'expected_working_version_id',
        application.expected_working_version_id,
        'expected_working_fingerprint',
        application.expected_working_fingerprint,
        'resulting_version_id',
        application.resulting_version_id,
        'application_summary',
        application.application_summary,
        'applied_by',
        application.applied_by,
        'correlation_id',
        application.correlation_id,
        'applied_at',
        application.applied_at,
        'is_current',
        application.id =
          v_current_application_id
      )
      order by
        application.applied_at,
        application.id
    ),
    '[]'::jsonb
  )
  into v_applications
  from editorial.correction_applications application
  where application.case_resource_id =
    p_case_resource_id;

  v_workspace := jsonb_set(
    v_workspace,
    '{case,current_application_id}',
    coalesce(
      to_jsonb(v_current_application_id),
      'null'::jsonb
    ),
    true
  );

  v_workspace := jsonb_set(
    v_workspace,
    '{applications}',
    v_applications,
    true
  );

  return v_workspace;
end;
$function$;

alter table editorial.correction_applications
  enable row level security;

revoke all
on editorial.correction_applications
from public, anon, authenticated;

grant all
on editorial.correction_applications
to service_role;

revoke all on function
  editorial.protect_correction_application(),
  editorial.assert_correction_application_integrity(),
  editorial.assert_correction_application_case_integrity()
from public, anon, authenticated;

grant execute on function
  editorial.protect_correction_application(),
  editorial.assert_correction_application_integrity(),
  editorial.assert_correction_application_case_integrity()
to service_role;

revoke all on function
  platform_private.append_correction_application_event(
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
    jsonb
  )
from public, anon, authenticated;

grant execute on function
  platform_private.append_correction_application_event(
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
    jsonb
  )
to service_role;

revoke execute on function
  public.apply_article_correction(
    uuid,
    bigint,
    uuid,
    uuid,
    uuid,
    uuid,
    uuid,
    text,
    jsonb,
    uuid[],
    text,
    text,
    uuid
  )
from public, anon;

grant execute on function
  public.apply_article_correction(
    uuid,
    bigint,
    uuid,
    uuid,
    uuid,
    uuid,
    uuid,
    text,
    jsonb,
    uuid[],
    text,
    text,
    uuid
  )
to authenticated, service_role;

revoke execute on function
  public.get_correction_case_workspace(uuid)
from public, anon;

grant execute on function
  public.get_correction_case_workspace(uuid)
to authenticated, service_role;

comment on table editorial.correction_applications is
  'Immutable successful Article correction application records. Rejected attempts remain in durable receipts, correction events, and outbox history.';

comment on column editorial.correction_cases.current_application_id is
  'The current successful correction application. Migration 3 supports Article application only.';

comment on function
  public.apply_article_correction(
    uuid,
    bigint,
    uuid,
    uuid,
    uuid,
    uuid,
    uuid,
    text,
    jsonb,
    uuid[],
    text,
    text,
    uuid
  )
is
  'Creates one immutable correction Article version after exact case, decision, target, publication, working-version, and fingerprint verification. It never changes the current published pointer.';

notify pgrst, 'reload schema';

commit;
