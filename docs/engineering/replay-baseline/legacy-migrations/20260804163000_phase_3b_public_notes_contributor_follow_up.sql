-- Phase 3B Migration 4: public correction notes and contributor follow-up.
--
-- Creates:
-- 1. immutable public correction notes
-- 2. governed public-note publication and supersession
-- 3. contributor follow-up request jobs through the shared command/job/outbox authority
-- 4. corrected-publication proof across correction and published Article versions
-- 5. correction-required closure
-- 6. anonymous public Article correction-note reads
-- 7. internal correction workspace note and follow-up history
--
-- This migration intentionally does not:
-- - publish an Article
-- - deliver contributor notifications
-- - add frontend authority
-- - add Supabase Edge Function code
-- - create production correction cases or notes

begin;

do $phase_3b_m4_preflight$
declare
  v_name text;
  v_count bigint;
begin
  foreach v_name in array array[
    'editorial.correction_cases',
    'editorial.correction_targets',
    'editorial.correction_events',
    'editorial.correction_decisions',
    'editorial.correction_applications',
    'editorial.correction_related_resource_reviews',
    'editorial.resources',
    'editorial.article_resources',
    'editorial.article_versions',
    'editorial.article_lifecycle_events',
    'public.wk_articles',
    'public.wk_article_publication_snapshots',
    'public.community_contributions',
    'platform_private.command_types',
    'platform_private.command_receipts',
    'platform_private.jobs',
    'platform_private.outbox_events'
  ]
  loop
    if to_regclass(v_name) is null then
      raise exception
        'STOP: Required Migration 4 dependency is missing: %',
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
    'platform_private.append_correction_event(uuid,text,bigint,bigint,text,text,uuid,text,uuid,uuid,uuid,uuid,uuid,uuid,jsonb)',
    'editorial.article_snapshot_fingerprint(text,text,text,text,text,uuid,text,jsonb,text,timestamptz,jsonb,jsonb)',
    'public.get_correction_case_workspace(uuid)',
    'public.close_correction_case(uuid,bigint,text,text,uuid)',
    'public.reopen_correction_case(uuid,bigint,text,text,uuid)'
  ]
  loop
    if to_regprocedure(v_name) is null then
      raise exception
        'STOP: Required Migration 4 function is missing: %',
        v_name;
    end if;
  end loop;

  if to_regclass(
       'editorial.correction_public_notes'
     ) is not null
  then
    raise exception
      'STOP: editorial.correction_public_notes already exists';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'editorial'
      and table_name = 'correction_cases'
      and column_name like 'contributor_follow_up%'
  ) then
    raise exception
      'STOP: Contributor follow-up case authority already exists';
  end if;

  if exists (
    select 1
    from platform_private.command_types
    where command_type in (
      'correction.note.publish',
      'correction.contributor_notification.request'
    )
  ) then
    raise exception
      'STOP: Migration 4 correction command authority already exists';
  end if;

  if exists (
    select 1
    from pg_proc procedure_row
    join pg_namespace namespace
      on namespace.oid = procedure_row.pronamespace
    where namespace.nspname = 'public'
      and procedure_row.proname in (
        'publish_correction_note',
        'public_get_article_correction_notes'
      )
  ) then
    raise exception
      'STOP: Migration 4 public-note function already exists';
  end if;

  select count(*)
  into v_count
  from platform_private.command_types
  where command_type like 'correction.%';

  if v_count <> 15 then
    raise exception
      'STOP: Expected 15 pre-Migration-4 correction command types, found %',
      v_count;
  end if;

  if not exists (
    select 1
    from editorial.correction_event_types
    where event_type = 'public_note_published'
      and enabled
  ) or not exists (
    select 1
    from editorial.correction_event_types
    where event_type = 'public_note_superseded'
      and enabled
  ) or not exists (
    select 1
    from editorial.correction_event_types
    where event_type = 'contributor_notification_requested'
      and enabled
  ) then
    raise exception
      'STOP: Required Migration 4 event vocabulary is missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'editorial'
      and table_name = 'correction_cases'
      and column_name = 'public_note_disposition'
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'editorial'
      and table_name = 'correction_cases'
      and column_name = 'public_note_no_note_reason'
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'editorial'
      and table_name = 'correction_cases'
      and column_name = 'current_application_id'
  ) then
    raise exception
      'STOP: Accepted correction-case public-note or application columns are missing';
  end if;

  if exists (
    select 1
    from editorial.correction_cases
  ) or exists (
    select 1
    from editorial.correction_targets
  ) or exists (
    select 1
    from editorial.correction_decisions
  ) or exists (
    select 1
    from editorial.correction_applications
  ) or exists (
    select 1
    from editorial.correction_events
  ) or exists (
    select 1
    from platform_private.command_receipts
    where command_type like 'correction.%'
  ) or exists (
    select 1
    from platform_private.outbox_events
    where command_type like 'correction.%'
  ) then
    raise exception
      'STOP: Migration 4 requires the accepted empty production correction state';
  end if;
end;
$phase_3b_m4_preflight$;
alter table editorial.correction_cases
  drop constraint correction_cases_public_note_disposition_check;

alter table editorial.correction_cases
  drop constraint correction_cases_public_note_reason_check;

alter table editorial.correction_cases
  add column contributor_follow_up_disposition text,
  add column contributor_follow_up_reason text,
  add column contributor_follow_up_job_id uuid,
  add column contributor_follow_up_requested_at timestamptz;

alter table editorial.correction_cases
  add constraint correction_cases_contributor_follow_up_job_fkey
  foreign key (contributor_follow_up_job_id)
  references platform_private.jobs(id)
  on delete restrict;

alter table editorial.correction_cases
  add constraint correction_cases_public_note_contract_check
  check (
    (
      public_note_disposition is null
      and public_note_no_note_reason is null
    )
    or (
      public_note_disposition = 'published'
      and public_note_no_note_reason is null
    )
    or (
      public_note_disposition = 'not_required'
      and nullif(
        btrim(public_note_no_note_reason),
        ''
      ) is not null
      and length(public_note_no_note_reason) <= 2000
    )
  );

alter table editorial.correction_cases
  add constraint correction_cases_contributor_follow_up_disposition_check
  check (
    contributor_follow_up_disposition is null
    or contributor_follow_up_disposition in (
      'requested',
      'unavailable',
      'unsafe'
    )
  );

alter table editorial.correction_cases
  add constraint correction_cases_contributor_follow_up_reason_check
  check (
    contributor_follow_up_reason is null
    or (
      nullif(
        btrim(contributor_follow_up_reason),
        ''
      ) is not null
      and length(contributor_follow_up_reason) <= 2000
    )
  );

alter table editorial.correction_cases
  add constraint correction_cases_contributor_follow_up_contract_check
  check (
    (
      origin_type = 'internal_editorial'
      and contributor_follow_up_disposition is null
      and contributor_follow_up_reason is null
      and contributor_follow_up_job_id is null
      and contributor_follow_up_requested_at is null
    )
    or (
      origin_type = 'community_contribution'
      and (
        (
          contributor_follow_up_disposition is null
          and contributor_follow_up_reason is null
          and contributor_follow_up_job_id is null
          and contributor_follow_up_requested_at is null
        )
        or (
          contributor_follow_up_disposition = 'requested'
          and contributor_follow_up_reason is null
          and contributor_follow_up_job_id is not null
          and contributor_follow_up_requested_at is not null
        )
        or (
          contributor_follow_up_disposition in (
            'unavailable',
            'unsafe'
          )
          and contributor_follow_up_reason is not null
          and contributor_follow_up_job_id is null
          and contributor_follow_up_requested_at is null
        )
      )
    )
  );

create index correction_cases_contributor_follow_up_job_idx
on editorial.correction_cases (
  contributor_follow_up_job_id
)
where contributor_follow_up_job_id is not null;
create table editorial.correction_public_notes (
  id uuid primary key default gen_random_uuid(),
  case_resource_id uuid not null,
  application_id uuid not null,
  affected_resource_id uuid not null,
  affected_resource_kind text not null,
  challenged_version_id uuid not null,
  corrected_version_id uuid not null,
  note_text text not null,
  note_fingerprint text not null,
  supersedes_note_id uuid,
  published_by uuid,
  published_at timestamptz not null default now(),

  constraint correction_public_notes_case_fkey
    foreign key (case_resource_id)
    references editorial.correction_cases(resource_id)
    on delete restrict,

  constraint correction_public_notes_application_fkey
    foreign key (application_id)
    references editorial.correction_applications(id)
    on delete restrict,

  constraint correction_public_notes_resource_fkey
    foreign key (
      affected_resource_id,
      affected_resource_kind
    )
    references editorial.resources(
      id,
      resource_kind
    )
    on update cascade
    on delete restrict,

  constraint correction_public_notes_challenged_version_fkey
    foreign key (challenged_version_id)
    references editorial.article_versions(id)
    on delete restrict,

  constraint correction_public_notes_corrected_version_fkey
    foreign key (corrected_version_id)
    references editorial.article_versions(id)
    on delete restrict,

  constraint correction_public_notes_supersedes_fkey
    foreign key (supersedes_note_id)
    references editorial.correction_public_notes(id)
    on delete restrict,

  constraint correction_public_notes_published_by_fkey
    foreign key (published_by)
    references auth.users(id)
    on delete set null,

  constraint correction_public_notes_resource_kind_check
    check (
      affected_resource_kind = 'article'
    ),

  constraint correction_public_notes_text_check
    check (
      note_text = btrim(note_text)
      and nullif(
        note_text,
        ''
      ) is not null
      and length(note_text) <= 8000
    ),

  constraint correction_public_notes_fingerprint_check
    check (
      note_fingerprint ~ '^[0-9a-f]{64}$'
    ),

  constraint correction_public_notes_version_identity_check
    check (
      corrected_version_id <>
        challenged_version_id
    ),

  constraint correction_public_notes_identity_unique
    unique (
      case_resource_id,
      affected_resource_id,
      corrected_version_id,
      note_fingerprint
    ),

  constraint correction_public_notes_supersedes_unique
    unique (supersedes_note_id)
);

create index correction_public_notes_case_published_idx
on editorial.correction_public_notes (
  case_resource_id,
  published_at,
  id
);

create index correction_public_notes_resource_published_idx
on editorial.correction_public_notes (
  affected_resource_id,
  published_at desc,
  id
);

create index correction_public_notes_application_published_idx
on editorial.correction_public_notes (
  application_id,
  published_at,
  id
);

alter table editorial.correction_events
  add constraint correction_events_public_note_fkey
  foreign key (public_note_id)
  references editorial.correction_public_notes(id)
  on delete restrict
  deferrable initially deferred;
create or replace function
  editorial.correction_public_note_fingerprint(
    p_case_resource_id uuid,
    p_application_id uuid,
    p_affected_resource_id uuid,
    p_challenged_version_id uuid,
    p_corrected_version_id uuid,
    p_note_text text
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
          'case_resource_id',
          p_case_resource_id,
          'application_id',
          p_application_id,
          'affected_resource_id',
          p_affected_resource_id,
          'challenged_version_id',
          p_challenged_version_id,
          'corrected_version_id',
          p_corrected_version_id,
          'note_text',
          btrim(p_note_text)
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$function$;

create or replace function
  editorial.correction_article_publication_proof(
    p_application_id uuid
  )
returns table (
  case_resource_id uuid,
  application_id uuid,
  affected_resource_id uuid,
  article_id uuid,
  challenged_version_id uuid,
  application_resulting_version_id uuid,
  corrected_version_id uuid,
  content_fingerprint text,
  article_slug text
)
language sql
stable
security invoker
set search_path =
  pg_catalog,
  public,
  editorial
as $function$
  select
    application.case_resource_id,
    application.id,
    application.target_resource_id,
    application_version.article_id,
    application.challenged_version_id,
    application.resulting_version_id,
    published_version.id,
    published_version.content_fingerprint,
    article.slug
  from editorial.correction_applications application
  join editorial.article_versions application_version
    on application_version.id =
      application.resulting_version_id
   and application_version.resource_id =
      application.target_resource_id
   and application_version.version_kind =
      'correction'
  join editorial.resources resource
    on resource.id =
      application.target_resource_id
   and resource.resource_kind = 'article'
  join editorial.article_versions published_version
    on published_version.id =
      resource.current_published_version_id
   and published_version.resource_id =
      application.target_resource_id
   and published_version.article_id =
      application_version.article_id
   and published_version.version_kind =
      'published'
   and published_version.content_fingerprint =
      application_version.content_fingerprint
  join editorial.article_resources binding
    on binding.resource_id =
      application.target_resource_id
   and binding.resource_kind = 'article'
   and binding.article_id =
      application_version.article_id
  join public.wk_articles article
    on article.id =
      application_version.article_id
  join public.wk_article_publication_snapshots snapshot
    on snapshot.article_id =
      application_version.article_id
   and snapshot.resource_id =
      application.target_resource_id
   and snapshot.version_id =
      published_version.id
   and snapshot.is_active
  where application.id =
      p_application_id
    and exists (
      select 1
      from editorial.article_lifecycle_events lifecycle_event
      where lifecycle_event.resource_id =
          application.target_resource_id
        and lifecycle_event.article_id =
          application_version.article_id
        and lifecycle_event.version_id =
          published_version.id
        and lifecycle_event.action =
          'published'
    )
    and editorial.article_snapshot_fingerprint(
      article.title,
      article.slug,
      article.excerpt,
      article.content_html,
      article.author,
      article.hero_image_id,
      article.hero_image_url,
      article.seo,
      article.wp_status,
      article.published_at,
      article.categories,
      article.tags
    ) = published_version.content_fingerprint;
$function$;

create or replace function
  editorial.protect_correction_public_note()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
begin
  if tg_op = 'UPDATE'
     and new.published_by is null
     and old.published_by is not null
     and new.id is not distinct from old.id
     and new.case_resource_id
       is not distinct from old.case_resource_id
     and new.application_id
       is not distinct from old.application_id
     and new.affected_resource_id
       is not distinct from old.affected_resource_id
     and new.affected_resource_kind
       is not distinct from old.affected_resource_kind
     and new.challenged_version_id
       is not distinct from old.challenged_version_id
     and new.corrected_version_id
       is not distinct from old.corrected_version_id
     and new.note_text
       is not distinct from old.note_text
     and new.note_fingerprint
       is not distinct from old.note_fingerprint
     and new.supersedes_note_id
       is not distinct from old.supersedes_note_id
     and new.published_at
       is not distinct from old.published_at
  then
    return new;
  end if;

  raise exception
    'Correction public notes are immutable';
end;
$function$;

create trigger correction_public_notes_append_only
before update or delete
on editorial.correction_public_notes
for each row
execute function
  editorial.protect_correction_public_note();

create or replace function
  editorial.assert_correction_public_note_integrity()
returns trigger
language plpgsql
security invoker
set search_path =
  pg_catalog,
  editorial
as $function$
declare
  v_case editorial.correction_cases%rowtype;
  v_application editorial.correction_applications%rowtype;
  v_decision_outcome text;
  v_proof record;
  v_superseded editorial.correction_public_notes%rowtype;
  v_expected_fingerprint text;
begin
  v_expected_fingerprint :=
    editorial.correction_public_note_fingerprint(
      new.case_resource_id,
      new.application_id,
      new.affected_resource_id,
      new.challenged_version_id,
      new.corrected_version_id,
      new.note_text
    );

  if new.note_fingerprint <>
     v_expected_fingerprint
  then
    raise exception
      'Correction public-note fingerprint is invalid';
  end if;

  select correction_case.*
  into v_case
  from editorial.correction_cases correction_case
  where correction_case.resource_id =
    new.case_resource_id;

  if not found
     or v_case.case_state
       is distinct from 'applied'
     or v_case.current_application_id
       is distinct from new.application_id
     or v_case.public_note_disposition
       is distinct from 'published'
  then
    raise exception
      'Correction public note must bind to the current published-note application state';
  end if;

  select application.*
  into v_application
  from editorial.correction_applications application
  where application.id =
    new.application_id;

  if not found
     or v_application.case_resource_id
       is distinct from new.case_resource_id
     or v_application.target_resource_id
       is distinct from new.affected_resource_id
     or v_application.challenged_version_id
       is distinct from new.challenged_version_id
  then
    raise exception
      'Correction public-note application identity is invalid';
  end if;

  select decision.outcome
  into v_decision_outcome
  from editorial.correction_decisions decision
  where decision.id =
      v_application.decision_id
    and decision.case_resource_id =
      new.case_resource_id;

  if not found
     or v_decision_outcome <>
       'correction_required'
  then
    raise exception
      'Correction public note requires a correction-required decision';
  end if;

  select *
  into v_proof
  from editorial.correction_article_publication_proof(
    new.application_id
  );

  if not found
     or v_proof.corrected_version_id
       is distinct from new.corrected_version_id
     or v_proof.affected_resource_id
       is distinct from new.affected_resource_id
     or v_proof.challenged_version_id
       is distinct from new.challenged_version_id
  then
    raise exception
      'Correction public note lacks exact corrected publication proof';
  end if;

  if new.supersedes_note_id is null then
    if exists (
      select 1
      from editorial.correction_public_notes note
      where note.case_resource_id =
          new.case_resource_id
        and note.application_id =
          new.application_id
        and note.id <> new.id
        and not exists (
          select 1
          from editorial.correction_public_notes later_note
          where later_note.supersedes_note_id =
            note.id
        )
    ) then
      raise exception
        'A later public note must supersede the current note explicitly';
    end if;
  else
    select note.*
    into v_superseded
    from editorial.correction_public_notes note
    where note.id =
      new.supersedes_note_id;

    if not found
       or v_superseded.case_resource_id
         is distinct from new.case_resource_id
       or v_superseded.application_id
         is distinct from new.application_id
       or v_superseded.affected_resource_id
         is distinct from new.affected_resource_id
       or v_superseded.challenged_version_id
         is distinct from new.challenged_version_id
       or v_superseded.corrected_version_id
         is distinct from new.corrected_version_id
       or exists (
         select 1
         from editorial.correction_public_notes later_note
         where later_note.supersedes_note_id =
           v_superseded.id
           and later_note.id <> new.id
       )
    then
      raise exception
        'Correction public-note supersession identity is invalid';
    end if;
  end if;

  perform editorial.validate_correction_case_history(
    new.case_resource_id
  );

  return new;
end;
$function$;

create constraint trigger correction_public_notes_integrity
after insert
on editorial.correction_public_notes
deferrable initially deferred
for each row
execute function
  editorial.assert_correction_public_note_integrity();
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
    'correction.note.publish',
    'correction.note.publish.sync',
    'correction.note.publish.accepted',
    'correction.note.publish.succeeded',
    'correction.note.publish.failed',
    'correction.note.publish.retry_scheduled'
  ),
  (
    'correction.contributor_notification.request',
    'correction.contributor_notification',
    'correction.contributor_notification.requested',
    'correction.contributor_notification.succeeded',
    'correction.contributor_notification.failed',
    'correction.contributor_notification.retry_scheduled'
  );

create or replace function
  platform_private.append_correction_public_event(
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
    p_public_note_id uuid,
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
      using
        errcode = '22023',
        message = 'Correction public event metadata must be a JSON object no larger than 32 KB.';
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
    public_note_id,
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
    p_public_note_id,
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
  platform_private.request_correction_contributor_notification(
    p_case_resource_id uuid,
    p_origin_contribution_id uuid,
    p_contributor_user_id uuid,
    p_current_decision_id uuid,
    p_current_application_id uuid,
    p_public_note_id uuid,
    p_public_safe_outcome text,
    p_notification_reason text,
    p_parent_command_receipt_id uuid,
    p_actor_id uuid,
    p_case_revision bigint,
    p_case_state text,
    p_correlation_id uuid
  )
returns table (
  child_command_receipt_id uuid,
  contributor_job_id uuid,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path =
  pg_catalog,
  auth,
  editorial,
  platform_private,
  extensions
as $function$
declare
  v_case editorial.correction_cases%rowtype;
  v_begin record;
  v_request_payload jsonb;
  v_idempotency_key text;
  v_job_id uuid;
  v_target_id uuid;
begin
  if p_case_resource_id is null
     or p_origin_contribution_id is null
     or p_contributor_user_id is null
     or p_current_decision_id is null
     or p_current_application_id is null
     or p_parent_command_receipt_id is null
     or p_actor_id is null
     or p_case_revision < 1
     or p_correlation_id is null
     or nullif(
       btrim(p_public_safe_outcome),
       ''
     ) is null
     or length(p_public_safe_outcome) > 200
     or nullif(
       btrim(p_notification_reason),
       ''
     ) is null
     or length(p_notification_reason) > 2000
  then
    raise exception
      using
        errcode = '22023',
        message = 'Contributor follow-up identity, public-safe outcome, reason, revision, and correlation are required.';
  end if;

  select correction_case.*
  into v_case
  from editorial.correction_cases correction_case
  where correction_case.resource_id =
    p_case_resource_id
  for update;

  if not found
     or v_case.origin_type <>
       'community_contribution'
     or v_case.origin_contribution_id
       is distinct from
         p_origin_contribution_id
     or v_case.origin_submitter_user_id
       is distinct from
         p_contributor_user_id
     or v_case.current_decision_id
       is distinct from
         p_current_decision_id
     or v_case.current_application_id
       is distinct from
         p_current_application_id
     or v_case.current_revision <>
       p_case_revision
     or v_case.case_state <>
       p_case_state
  then
    raise exception
      'Contributor follow-up must use the exact immutable community-origin case state';
  end if;

  if not exists (
    select 1
    from platform_private.command_receipts parent_receipt
    where parent_receipt.id =
        p_parent_command_receipt_id
      and parent_receipt.resource_id =
        p_case_resource_id
      and parent_receipt.status =
        'accepted'
      and parent_receipt.command_type in (
        'correction.note.publish',
        'correction.case.close'
      )
  ) then
    raise exception
      'Contributor follow-up requires an accepted governing parent command';
  end if;

  select application.target_id
  into v_target_id
  from editorial.correction_applications application
  where application.id =
      p_current_application_id
    and application.case_resource_id =
      p_case_resource_id
    and application.decision_id =
      p_current_decision_id;

  if not found then
    raise exception
      'Contributor follow-up requires the current successful correction application';
  end if;

  v_request_payload := jsonb_build_object(
    'case_resource_id',
    p_case_resource_id,
    'origin_contribution_id',
    p_origin_contribution_id,
    'contributor_user_id',
    p_contributor_user_id,
    'current_decision_id',
    p_current_decision_id,
    'current_application_id',
    p_current_application_id,
    'public_note_id',
    p_public_note_id,
    'public_safe_outcome',
    btrim(p_public_safe_outcome),
    'notification_reason',
    btrim(p_notification_reason),
    'parent_command_receipt_id',
    p_parent_command_receipt_id,
    'correlation_id',
    p_correlation_id
  );

  v_idempotency_key :=
    'm4-follow-up:' ||
    encode(
      extensions.digest(
        convert_to(
          jsonb_build_object(
            'case_resource_id',
            p_case_resource_id,
            'origin_contribution_id',
            p_origin_contribution_id,
            'current_application_id',
            p_current_application_id,
            'public_note_id',
            p_public_note_id,
            'parent_command_receipt_id',
            p_parent_command_receipt_id
          )::text,
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    );

  select *
  into v_begin
  from platform_private.begin_resource_command(
    'correction.contributor_notification.request',
    p_case_resource_id,
    v_idempotency_key,
    v_request_payload
  );

  if v_begin.idempotent_replay then
    select job.id
    into v_job_id
    from platform_private.jobs job
    where job.command_receipt_id =
      v_begin.command_receipt_id
      and job.job_key =
        'contributor-notification';

    if not found then
      raise exception
        'Contributor follow-up receipt exists without its durable job';
    end if;

    return query
    select
      v_begin.command_receipt_id,
      v_job_id,
      true;
    return;
  end if;

  insert into platform_private.jobs (
    command_receipt_id,
    resource_id,
    command_type,
    job_key,
    job_type,
    status,
    priority,
    input_payload
  )
  values (
    v_begin.command_receipt_id,
    p_case_resource_id,
    'correction.contributor_notification.request',
    'contributor-notification',
    'correction.contributor_notification',
    'queued',
    100,
    v_request_payload
  )
  returning id
  into v_job_id;

  perform platform_private.append_correction_public_event(
    p_case_resource_id,
    'contributor_notification_requested',
    p_case_revision,
    p_case_revision,
    p_case_state,
    p_case_state,
    p_actor_id,
    btrim(p_notification_reason),
    p_current_decision_id,
    p_current_application_id,
    v_target_id,
    p_public_note_id,
    v_begin.command_receipt_id,
    p_correlation_id,
    jsonb_build_object(
      'origin_contribution_id',
      p_origin_contribution_id,
      'contributor_job_id',
      v_job_id,
      'public_safe_outcome',
      btrim(p_public_safe_outcome),
      'parent_command_receipt_id',
      p_parent_command_receipt_id
    )
  );

  return query
  select
    v_begin.command_receipt_id,
    v_job_id,
    false;
end;
$function$;
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
  v_application_target_resource_id uuid;
  v_application_resulting_version_id uuid;
  v_current_note_count bigint;
  v_job_status text;
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
       or v_case.public_note_disposition is not null
       or v_case.public_note_no_note_reason is not null
       or v_case.contributor_follow_up_disposition is not null
       or v_case.contributor_follow_up_reason is not null
       or v_case.contributor_follow_up_job_id is not null
       or v_case.contributor_follow_up_requested_at is not null
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
      application.decision_id,
      application.target_resource_id,
      application.resulting_version_id
    into
      v_application_case_id,
      v_application_decision_id,
      v_application_target_resource_id,
      v_application_resulting_version_id
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

  if v_case.case_state = 'closed'
     and v_decision_outcome = 'correction_required'
     and v_case.current_application_id is null
  then
    raise exception
      'Closed correction-required case requires a current application';
  end if;

  if v_case.current_application_id is not null
     and v_case.case_state not in (
       'applied',
       'closed'
     )
  then
    raise exception
      'Current correction application requires applied or closed state';
  end if;

  if v_case.current_application_id is not null
     and v_decision_outcome is distinct from
       'correction_required'
  then
    raise exception
      'Current correction application requires a correction-required decision';
  end if;

  if v_decision_outcome is distinct from
     'correction_required'
  then
    if v_case.public_note_disposition is not null
       or v_case.public_note_no_note_reason is not null
       or v_case.contributor_follow_up_disposition is not null
       or v_case.contributor_follow_up_reason is not null
       or v_case.contributor_follow_up_job_id is not null
       or v_case.contributor_follow_up_requested_at is not null
    then
      raise exception
        'Non-correction outcomes cannot retain public-note or contributor follow-up state';
    end if;
  else
    if v_case.public_note_disposition is null then
      if v_case.public_note_no_note_reason is not null then
        raise exception
          'A public-note reason requires a public-note disposition';
      end if;
    elsif v_case.public_note_disposition = 'published' then
      if v_case.public_note_no_note_reason is not null
         or v_case.current_application_id is null
      then
        raise exception
          'Published public-note disposition requires a current application and no no-note reason';
      end if;

      select count(*)
      into v_current_note_count
      from editorial.correction_public_notes note
      where note.case_resource_id =
          p_case_resource_id
        and note.application_id =
          v_case.current_application_id
        and exists (
          select 1
          from editorial.correction_article_publication_proof(
            v_case.current_application_id
          ) proof
          where proof.corrected_version_id =
            note.corrected_version_id
        )
        and not exists (
          select 1
          from editorial.correction_public_notes later_note
          where later_note.supersedes_note_id =
            note.id
        );

      if v_current_note_count <> 1 then
        raise exception
          'Published public-note disposition requires exactly one current note';
      end if;
    elsif v_case.public_note_disposition = 'not_required' then
      if v_case.current_application_id is null
         or nullif(
           btrim(
             v_case.public_note_no_note_reason
           ),
           ''
         ) is null
         or length(
           v_case.public_note_no_note_reason
         ) > 2000
      then
        raise exception
          'No-note disposition requires a current application and bounded reason';
      end if;

      if exists (
        select 1
        from editorial.correction_public_notes note
        where note.case_resource_id =
            p_case_resource_id
          and note.application_id =
            v_case.current_application_id
      ) then
        raise exception
          'No-note disposition cannot coexist with a public note for the current application';
      end if;
    else
      raise exception
        'Public-note disposition is invalid';
    end if;

    if v_case.origin_type = 'internal_editorial' then
      if v_case.contributor_follow_up_disposition is not null
         or v_case.contributor_follow_up_reason is not null
         or v_case.contributor_follow_up_job_id is not null
         or v_case.contributor_follow_up_requested_at is not null
      then
        raise exception
          'Internal correction cases cannot retain contributor follow-up state';
      end if;
    elsif v_case.origin_type = 'community_contribution' then
      if v_case.contributor_follow_up_disposition is null then
        if v_case.contributor_follow_up_reason is not null
           or v_case.contributor_follow_up_job_id is not null
           or v_case.contributor_follow_up_requested_at is not null
        then
          raise exception
            'Contributor follow-up metadata requires a disposition';
        end if;
      elsif v_case.contributor_follow_up_disposition = 'requested' then
        if v_case.contributor_follow_up_reason is not null
           or v_case.contributor_follow_up_job_id is null
           or v_case.contributor_follow_up_requested_at is null
        then
          raise exception
            'Requested contributor follow-up requires a durable job and request time';
        end if;

        select job.status
        into v_job_status
        from platform_private.jobs job
        join platform_private.command_receipts receipt
          on receipt.id =
            job.command_receipt_id
        where job.id =
            v_case.contributor_follow_up_job_id
          and job.resource_id =
            p_case_resource_id
          and job.command_type =
            'correction.contributor_notification.request'
          and job.job_type =
            'correction.contributor_notification'
          and receipt.command_type =
            'correction.contributor_notification.request'
          and receipt.resource_id =
            p_case_resource_id
          and receipt.status in (
            'accepted',
            'succeeded'
          );

        if not found
           or v_job_status not in (
             'queued',
             'running',
             'retry_wait',
             'succeeded',
             'dead_letter'
           )
        then
          raise exception
            'Requested contributor follow-up requires a durable queued or later-state job';
        end if;
      elsif v_case.contributor_follow_up_disposition in (
        'unavailable',
        'unsafe'
      ) then
        if nullif(
             btrim(
               v_case.contributor_follow_up_reason
             ),
             ''
           ) is null
           or length(
             v_case.contributor_follow_up_reason
           ) > 2000
           or v_case.contributor_follow_up_job_id is not null
           or v_case.contributor_follow_up_requested_at is not null
        then
          raise exception
            'Contributor follow-up exception requires a bounded reason and no job';
        end if;
      else
        raise exception
          'Contributor follow-up disposition is invalid';
      end if;
    end if;
  end if;

  if v_case.case_state = 'closed' then
    if nullif(btrim(v_case.closed_reason), '') is null
       or v_case.closed_by is null
       or v_case.closed_at is null
    then
      raise exception
        'Closed correction case requires complete closure metadata';
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

    if v_decision_outcome = 'correction_required' then
      if v_case.public_note_disposition is null then
        raise exception
          'Closed correction-required case requires a public-note disposition';
      end if;

      if v_case.origin_type = 'community_contribution'
         and v_case.contributor_follow_up_disposition is null
      then
        raise exception
          'Closed community-origin correction requires contributor follow-up disposition';
      end if;

      if not exists (
        select 1
        from editorial.correction_article_publication_proof(
          v_case.current_application_id
        ) proof
      ) then
        raise exception
          'Closed correction-required case lacks corrected publication proof';
      end if;
    elsif v_case.current_application_id is not null then
      raise exception
        'Non-correction closure cannot retain a current application';
    end if;
  elsif v_case.closed_reason is not null
        or v_case.closed_by is not null
        or v_case.closed_at is not null
  then
    raise exception
      'Closure metadata requires closed state';
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
  public.publish_correction_note(
    p_case_resource_id uuid,
    p_expected_case_revision bigint,
    p_expected_current_application_id uuid,
    p_expected_current_published_article_version_id uuid,
    p_note_text text,
    p_supersedes_note_id uuid,
    p_contributor_follow_up_disposition text,
    p_contributor_follow_up_reason text,
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
  v_context record;
  v_begin record;
  v_case editorial.correction_cases%rowtype;
  v_application editorial.correction_applications%rowtype;
  v_decision_outcome text;
  v_proof record;
  v_current_note editorial.correction_public_notes%rowtype;
  v_note_id uuid;
  v_note_fingerprint text;
  v_child_receipt_id uuid;
  v_contributor_job_id uuid;
  v_result jsonb;
  v_rejection_code text;
  v_rejection_message text;
  v_new_revision bigint;
begin
  v_actor :=
    platform_private.assert_correction_capability(
      'publish_correction_notes'
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
         'publish_articles'
       ),
       false
     )
  then
    raise exception
      using
        errcode = '42501',
        message = 'The caller does not hold Article publication authority.';
  end if;

  if p_case_resource_id is null
     or p_expected_case_revision < 1
     or p_expected_current_application_id is null
     or p_expected_current_published_article_version_id is null
     or p_correlation_id is null
     or nullif(
       btrim(p_note_text),
       ''
     ) is null
     or length(p_note_text) > 8000
  then
    raise exception
      using
        errcode = '22023',
        message = 'Case, revision, application, published version, bounded public note, and correlation identity are required.';
  end if;

  if p_contributor_follow_up_disposition is not null
     and p_contributor_follow_up_disposition not in (
       'requested',
       'unavailable',
       'unsafe'
     )
  then
    raise exception
      using
        errcode = '22023',
        message = 'Contributor follow-up disposition is invalid.';
  end if;

  if p_contributor_follow_up_disposition = 'requested'
     and p_contributor_follow_up_reason is not null
  then
    raise exception
      using
        errcode = '22023',
        message = 'Requested contributor follow-up cannot use an exception reason.';
  end if;

  if p_contributor_follow_up_disposition in (
       'unavailable',
       'unsafe'
     )
     and (
       nullif(
         btrim(p_contributor_follow_up_reason),
         ''
       ) is null
       or length(
         p_contributor_follow_up_reason
       ) > 2000
     )
  then
    raise exception
      using
        errcode = '22023',
        message = 'Contributor follow-up exception requires a bounded reason.';
  end if;

  select *
  into v_begin
  from platform_private.begin_resource_command(
    'correction.note.publish',
    p_case_resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'expected_case_revision',
      p_expected_case_revision,
      'expected_current_application_id',
      p_expected_current_application_id,
      'expected_current_published_article_version_id',
      p_expected_current_published_article_version_id,
      'note_text',
      btrim(p_note_text),
      'supersedes_note_id',
      p_supersedes_note_id,
      'contributor_follow_up_disposition',
      p_contributor_follow_up_disposition,
      'contributor_follow_up_reason',
      p_contributor_follow_up_reason,
      'correlation_id',
      p_correlation_id
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
    v_rejection_code := 'case_not_found';
    v_rejection_message :=
      'The correction case does not exist.';
  elsif v_case.current_revision <>
        p_expected_case_revision
  then
    v_rejection_code :=
      'case_revision_changed';
    v_rejection_message :=
      'The correction case revision changed.';
  elsif v_case.case_state <> 'applied'
        or v_case.current_application_id
          is distinct from
            p_expected_current_application_id
  then
    v_rejection_code :=
      'application_changed';
    v_rejection_message :=
      'The correction case is not in the expected applied state.';
  end if;

  if v_rejection_code is null then
    select application.*
    into v_application
    from editorial.correction_applications application
    where application.id =
        p_expected_current_application_id
      and application.case_resource_id =
        p_case_resource_id;

    if not found then
      v_rejection_code :=
        'application_changed';
      v_rejection_message :=
        'The current correction application changed.';
    end if;
  end if;

  if v_rejection_code is null then
    select decision.outcome
    into v_decision_outcome
    from editorial.correction_decisions decision
    where decision.id =
        v_application.decision_id
      and decision.case_resource_id =
        p_case_resource_id;

    if not found
       or v_decision_outcome <>
         'correction_required'
       or v_case.current_decision_id
         is distinct from
           v_application.decision_id
    then
      v_rejection_code :=
        'decision_changed';
      v_rejection_message :=
        'The current correction-required decision changed.';
    end if;
  end if;

  if v_rejection_code is null then
    select *
    into v_proof
    from editorial.correction_article_publication_proof(
      p_expected_current_application_id
    );

    if not found
       or v_proof.corrected_version_id
         is distinct from
           p_expected_current_published_article_version_id
    then
      v_rejection_code :=
        'publication_proof_missing';
      v_rejection_message :=
        'The corrected Article publication proof changed or is incomplete.';
    end if;
  end if;

  if v_rejection_code is null then
    select note.*
    into v_current_note
    from editorial.correction_public_notes note
    where note.case_resource_id =
        p_case_resource_id
      and note.application_id =
        p_expected_current_application_id
      and not exists (
        select 1
        from editorial.correction_public_notes later_note
        where later_note.supersedes_note_id =
          note.id
      )
    order by
      note.published_at desc,
      note.id desc
    limit 1;

    if p_supersedes_note_id is null
       and found
    then
      v_rejection_code :=
        'supersedes_note_required';
      v_rejection_message :=
        'A later public note must supersede the current note explicitly.';
    elsif p_supersedes_note_id is not null
          and (
            not found
            or v_current_note.id
              is distinct from
                p_supersedes_note_id
          )
    then
      v_rejection_code :=
        'superseded_note_changed';
      v_rejection_message :=
        'The current public note changed.';
    end if;
  end if;

  if v_rejection_code is null then
    if v_case.origin_type =
       'internal_editorial'
    then
      if p_contributor_follow_up_disposition is not null
         or p_contributor_follow_up_reason is not null
      then
        v_rejection_code :=
          'contributor_follow_up_not_applicable';
        v_rejection_message :=
          'Internal correction cases cannot request contributor follow-up.';
      end if;
    elsif v_case.origin_type =
          'community_contribution'
    then
      if p_contributor_follow_up_disposition is null then
        v_rejection_code :=
          'contributor_follow_up_required';
        v_rejection_message :=
          'Community-origin correction notes require contributor follow-up disposition.';
      elsif p_contributor_follow_up_disposition = 'requested' then
        if p_contributor_follow_up_reason is not null then
          v_rejection_code :=
            'contributor_follow_up_invalid';
          v_rejection_message :=
            'Requested contributor follow-up cannot include an exception reason.';
        end if;
      elsif nullif(
              btrim(
                p_contributor_follow_up_reason
              ),
              ''
            ) is null
            or length(
              p_contributor_follow_up_reason
            ) > 2000
      then
        v_rejection_code :=
          'contributor_follow_up_invalid';
        v_rejection_message :=
          'Contributor follow-up exception requires a bounded reason.';
      end if;
    end if;
  end if;

  if v_rejection_code is null then
    v_note_fingerprint :=
      editorial.correction_public_note_fingerprint(
        p_case_resource_id,
        p_expected_current_application_id,
        v_application.target_resource_id,
        v_application.challenged_version_id,
        p_expected_current_published_article_version_id,
        btrim(p_note_text)
      );

    if exists (
      select 1
      from editorial.correction_public_notes note
      where note.case_resource_id =
          p_case_resource_id
        and note.affected_resource_id =
          v_application.target_resource_id
        and note.corrected_version_id =
          p_expected_current_published_article_version_id
        and note.note_fingerprint =
          v_note_fingerprint
    ) then
      v_rejection_code :=
        'note_already_published';
      v_rejection_message :=
        'The same public correction note already exists.';
    end if;
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

    return query
    select *
    from platform_private.read_correction_command_result(
      v_begin.command_receipt_id,
      false
    );
    return;
  end if;

  insert into editorial.correction_public_notes (
    case_resource_id,
    application_id,
    affected_resource_id,
    affected_resource_kind,
    challenged_version_id,
    corrected_version_id,
    note_text,
    note_fingerprint,
    supersedes_note_id,
    published_by
  )
  values (
    p_case_resource_id,
    p_expected_current_application_id,
    v_application.target_resource_id,
    'article',
    v_application.challenged_version_id,
    p_expected_current_published_article_version_id,
    btrim(p_note_text),
    v_note_fingerprint,
    p_supersedes_note_id,
    v_actor
  )
  returning id
  into v_note_id;

  v_new_revision :=
    v_case.current_revision + 1;

  update editorial.correction_cases
  set
    current_revision =
      v_new_revision,
    public_note_disposition =
      'published',
    public_note_no_note_reason =
      null,
    contributor_follow_up_disposition =
      case
        when origin_type =
          'community_contribution'
          and p_contributor_follow_up_disposition in (
            'unavailable',
            'unsafe'
          )
        then p_contributor_follow_up_disposition
        when origin_type =
          'internal_editorial'
        then null
        else contributor_follow_up_disposition
      end,
    contributor_follow_up_reason =
      case
        when origin_type =
          'community_contribution'
          and p_contributor_follow_up_disposition in (
            'unavailable',
            'unsafe'
          )
        then btrim(
          p_contributor_follow_up_reason
        )
        when origin_type =
          'internal_editorial'
        then null
        else contributor_follow_up_reason
      end,
    contributor_follow_up_job_id =
      case
        when origin_type =
          'community_contribution'
          and p_contributor_follow_up_disposition in (
            'unavailable',
            'unsafe'
          )
        then null
        when origin_type =
          'internal_editorial'
        then null
        else contributor_follow_up_job_id
      end,
    contributor_follow_up_requested_at =
      case
        when origin_type =
          'community_contribution'
          and p_contributor_follow_up_disposition in (
            'unavailable',
            'unsafe'
          )
        then null
        when origin_type =
          'internal_editorial'
        then null
        else contributor_follow_up_requested_at
      end,
    updated_by = v_actor,
    updated_at = now()
  where resource_id =
    p_case_resource_id;

  if p_supersedes_note_id is not null then
    perform platform_private.append_correction_public_event(
      p_case_resource_id,
      'public_note_superseded',
      v_case.current_revision,
      v_new_revision,
      v_case.case_state,
      v_case.case_state,
      v_actor,
      'A later public-safe correction note superseded the prior note.',
      v_case.current_decision_id,
      p_expected_current_application_id,
      v_application.target_id,
      p_supersedes_note_id,
      v_begin.command_receipt_id,
      p_correlation_id,
      jsonb_build_object(
        'superseded_note_id',
        p_supersedes_note_id,
        'superseding_note_id',
        v_note_id,
        'corrected_version_id',
        p_expected_current_published_article_version_id
      )
    );
  end if;

  perform platform_private.append_correction_public_event(
    p_case_resource_id,
    'public_note_published',
    v_case.current_revision,
    v_new_revision,
    v_case.case_state,
    v_case.case_state,
    v_actor,
    btrim(p_note_text),
    v_case.current_decision_id,
    p_expected_current_application_id,
    v_application.target_id,
    v_note_id,
    v_begin.command_receipt_id,
    p_correlation_id,
    jsonb_build_object(
      'public_note_id',
      v_note_id,
      'supersedes_note_id',
      p_supersedes_note_id,
      'affected_resource_id',
      v_application.target_resource_id,
      'challenged_version_id',
      v_application.challenged_version_id,
      'corrected_version_id',
      p_expected_current_published_article_version_id,
      'note_fingerprint',
      v_note_fingerprint
    )
  );

  if v_case.origin_type =
       'community_contribution'
     and p_contributor_follow_up_disposition =
       'requested'
  then
    select
      notification.child_command_receipt_id,
      notification.contributor_job_id
    into
      v_child_receipt_id,
      v_contributor_job_id
    from platform_private.request_correction_contributor_notification(
      p_case_resource_id,
      v_case.origin_contribution_id,
      v_case.origin_submitter_user_id,
      v_case.current_decision_id,
      p_expected_current_application_id,
      v_note_id,
      'correction_published',
      'The submitted correction was applied and the corrected Article was published.',
      v_begin.command_receipt_id,
      v_actor,
      v_new_revision,
      v_case.case_state,
      p_correlation_id
    ) notification;

    update editorial.correction_cases
    set
      contributor_follow_up_disposition =
        'requested',
      contributor_follow_up_reason =
        null,
      contributor_follow_up_job_id =
        v_contributor_job_id,
      contributor_follow_up_requested_at =
        now(),
      updated_by = v_actor,
      updated_at = now()
    where resource_id =
      p_case_resource_id;
  end if;

  v_result := jsonb_build_object(
    'case_resource_id',
    p_case_resource_id,
    'case_revision',
    v_new_revision,
    'case_state',
    v_case.case_state,
    'public_note_id',
    v_note_id,
    'supersedes_note_id',
    p_supersedes_note_id,
    'application_id',
    p_expected_current_application_id,
    'affected_resource_id',
    v_application.target_resource_id,
    'challenged_version_id',
    v_application.challenged_version_id,
    'corrected_version_id',
    p_expected_current_published_article_version_id,
    'note_fingerprint',
    v_note_fingerprint,
    'contributor_follow_up_disposition',
    p_contributor_follow_up_disposition,
    'contributor_follow_up_job_id',
    v_contributor_job_id,
    'contributor_follow_up_command_receipt_id',
    v_child_receipt_id
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
drop function
  public.close_correction_case(
    uuid,
    bigint,
    text,
    text,
    uuid
  );

create or replace function
  public.close_correction_case(
    p_case_resource_id uuid,
    p_expected_case_revision bigint,
    p_reason text,
    p_idempotency_key text,
    p_correlation_id uuid,
    p_public_note_disposition text default null,
    p_public_note_no_note_reason text default null,
    p_contributor_follow_up_disposition text default null,
    p_contributor_follow_up_reason text default null
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
  v_application editorial.correction_applications%rowtype;
  v_outcome text;
  v_proof record;
  v_current_note_id uuid;
  v_effective_note_disposition text;
  v_effective_note_reason text;
  v_effective_follow_up_disposition text;
  v_effective_follow_up_reason text;
  v_effective_follow_up_job_id uuid;
  v_effective_follow_up_requested_at timestamptz;
  v_child_receipt_id uuid;
  v_new_job_id uuid;
  v_job_status text;
  v_rejection_code text;
  v_rejection_message text;
  v_result jsonb;
begin
  v_actor :=
    platform_private.assert_correction_capability(
      'decide_corrections'
    );

  if p_case_resource_id is null
     or p_expected_case_revision < 1
     or p_correlation_id is null
     or nullif(
       btrim(p_reason),
       ''
     ) is null
  then
    raise exception
      using
        errcode = '22023',
        message = 'Case, revision, reason, and correlation identity are required.';
  end if;

  if p_public_note_disposition is not null
     and p_public_note_disposition not in (
       'published',
       'not_required'
     )
  then
    raise exception
      using
        errcode = '22023',
        message = 'Public-note disposition is invalid.';
  end if;

  if p_public_note_disposition is null
     and p_public_note_no_note_reason is not null
  then
    raise exception
      using
        errcode = '22023',
        message = 'A no-note reason requires the not_required disposition.';
  end if;

  if p_public_note_disposition = 'published'
     and p_public_note_no_note_reason is not null
  then
    raise exception
      using
        errcode = '22023',
        message = 'Published public-note disposition cannot use a no-note reason.';
  end if;

  if p_public_note_disposition = 'not_required'
     and (
       nullif(
         btrim(p_public_note_no_note_reason),
         ''
       ) is null
       or length(
         p_public_note_no_note_reason
       ) > 2000
     )
  then
    raise exception
      using
        errcode = '22023',
        message = 'No-note disposition requires a bounded reason.';
  end if;

  if p_contributor_follow_up_disposition is not null
     and p_contributor_follow_up_disposition not in (
       'requested',
       'unavailable',
       'unsafe'
     )
  then
    raise exception
      using
        errcode = '22023',
        message = 'Contributor follow-up disposition is invalid.';
  end if;

  if p_contributor_follow_up_disposition is null
     and p_contributor_follow_up_reason is not null
  then
    raise exception
      using
        errcode = '22023',
        message = 'A contributor follow-up reason requires a contributor follow-up disposition.';
  end if;

  if p_contributor_follow_up_disposition = 'requested'
     and p_contributor_follow_up_reason is not null
  then
    raise exception
      using
        errcode = '22023',
        message = 'Requested contributor follow-up cannot use an exception reason.';
  end if;

  if p_contributor_follow_up_disposition in (
       'unavailable',
       'unsafe'
     )
     and (
       nullif(
         btrim(p_contributor_follow_up_reason),
         ''
       ) is null
       or length(
         p_contributor_follow_up_reason
       ) > 2000
     )
  then
    raise exception
      using
        errcode = '22023',
        message = 'Contributor follow-up exception requires a bounded reason.';
  end if;

  select *
  into v_begin
  from platform_private.begin_resource_command(
    'correction.case.close',
    p_case_resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'expected_case_revision',
      p_expected_case_revision,
      'reason',
      btrim(p_reason),
      'public_note_disposition',
      p_public_note_disposition,
      'public_note_no_note_reason',
      p_public_note_no_note_reason,
      'contributor_follow_up_disposition',
      p_contributor_follow_up_disposition,
      'contributor_follow_up_reason',
      p_contributor_follow_up_reason,
      'correlation_id',
      p_correlation_id
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
    v_rejection_code :=
      'case_not_found';
    v_rejection_message :=
      'The correction case does not exist.';
  elsif v_case.current_revision <>
        p_expected_case_revision
  then
    v_rejection_code :=
      'case_revision_changed';
    v_rejection_message :=
      'The correction case revision changed.';
  elsif v_case.current_decision_id is null then
    v_rejection_code :=
      'decision_required';
    v_rejection_message :=
      'A correction decision is required before closure.';
  end if;

  if v_rejection_code is null then
    select decision.outcome
    into v_outcome
    from editorial.correction_decisions decision
    where decision.id =
        v_case.current_decision_id
      and decision.case_resource_id =
        p_case_resource_id;

    if not found then
      v_rejection_code :=
        'decision_changed';
      v_rejection_message :=
        'The current correction decision changed.';
    end if;
  end if;

  if v_rejection_code is null
     and v_outcome <>
       'correction_required'
  then
    if v_case.case_state <> 'decided' then
      v_rejection_code :=
        'invalid_transition';
      v_rejection_message :=
        'Only decided non-correction cases may close.';
    elsif p_public_note_disposition is not null
          or p_public_note_no_note_reason is not null
          or p_contributor_follow_up_disposition is not null
          or p_contributor_follow_up_reason is not null
    then
      v_rejection_code :=
        'follow_up_not_applicable';
      v_rejection_message :=
        'Non-correction closure cannot set public-note or contributor follow-up state.';
    elsif exists (
      select 1
      from editorial.correction_related_resource_reviews review
      where review.case_resource_id =
        p_case_resource_id
        and review.review_state =
          'pending'
    ) then
      v_rejection_code :=
        'related_reviews_pending';
      v_rejection_message :=
        'All related-resource reviews must be resolved before closure.';
    end if;
  end if;

  if v_rejection_code is null
     and v_outcome =
       'correction_required'
  then
    if v_case.case_state <> 'applied'
       or v_case.current_application_id is null
    then
      v_rejection_code :=
        'application_required';
      v_rejection_message :=
        'Correction-required closure requires the current applied correction.';
    else
      select application.*
      into v_application
      from editorial.correction_applications application
      where application.id =
          v_case.current_application_id
        and application.case_resource_id =
          p_case_resource_id
        and application.decision_id =
          v_case.current_decision_id;

      if not found then
        v_rejection_code :=
          'application_changed';
        v_rejection_message :=
          'The current correction application changed.';
      end if;
    end if;
  end if;

  if v_rejection_code is null
     and v_outcome =
       'correction_required'
  then
    select *
    into v_proof
    from editorial.correction_article_publication_proof(
      v_case.current_application_id
    );

    if not found then
      v_rejection_code :=
        'publication_proof_missing';
      v_rejection_message :=
        'The corrected Article has not completed governed publication.';
    elsif exists (
      select 1
      from editorial.correction_related_resource_reviews review
      where review.case_resource_id =
        p_case_resource_id
        and review.review_state =
          'pending'
    ) then
      v_rejection_code :=
        'related_reviews_pending';
      v_rejection_message :=
        'All related-resource reviews must be resolved before closure.';
    end if;
  end if;

  if v_rejection_code is null
     and v_outcome =
       'correction_required'
  then
    v_effective_note_disposition :=
      v_case.public_note_disposition;
    v_effective_note_reason :=
      v_case.public_note_no_note_reason;

    if v_effective_note_disposition is null then
      if p_public_note_disposition is distinct from
           'not_required'
         or nullif(
           btrim(
             p_public_note_no_note_reason
           ),
           ''
         ) is null
      then
        v_rejection_code :=
          'public_note_disposition_required';
        v_rejection_message :=
          'Closure requires a published public note or governed no-note disposition.';
      else
        v_effective_note_disposition :=
          'not_required';
        v_effective_note_reason :=
          btrim(
            p_public_note_no_note_reason
          );
      end if;
    elsif v_effective_note_disposition =
          'published'
    then
      if p_public_note_disposition is not null
         and p_public_note_disposition <>
           'published'
      then
        v_rejection_code :=
          'public_note_disposition_changed';
        v_rejection_message :=
          'The public-note disposition changed.';
      elsif p_public_note_no_note_reason is not null then
        v_rejection_code :=
          'public_note_disposition_invalid';
        v_rejection_message :=
          'Published public-note disposition cannot use a no-note reason.';
      else
        select note.id
        into v_current_note_id
        from editorial.correction_public_notes note
        where note.case_resource_id =
            p_case_resource_id
          and note.application_id =
            v_case.current_application_id
          and note.corrected_version_id =
            v_proof.corrected_version_id
          and not exists (
            select 1
            from editorial.correction_public_notes later_note
            where later_note.supersedes_note_id =
              note.id
          )
        order by
          note.published_at desc,
          note.id desc
        limit 1;

        if not found then
          v_rejection_code :=
            'public_note_missing';
          v_rejection_message :=
            'The current published public note is missing.';
        end if;
      end if;
    elsif v_effective_note_disposition =
          'not_required'
    then
      if p_public_note_disposition is not null
         and p_public_note_disposition <>
           'not_required'
      then
        v_rejection_code :=
          'public_note_disposition_changed';
        v_rejection_message :=
          'The public-note disposition changed.';
      elsif p_public_note_no_note_reason is not null
            and btrim(
              p_public_note_no_note_reason
            ) <>
              v_effective_note_reason
      then
        v_rejection_code :=
          'public_note_reason_changed';
        v_rejection_message :=
          'The governed no-note reason changed.';
      elsif exists (
        select 1
        from editorial.correction_public_notes note
        where note.case_resource_id =
            p_case_resource_id
          and note.application_id =
            v_case.current_application_id
      ) then
        v_rejection_code :=
          'public_note_conflict';
        v_rejection_message :=
          'No-note disposition cannot coexist with a public note for the current application.';
      end if;
    end if;
  end if;

  if v_rejection_code is null
     and v_outcome =
       'correction_required'
  then
    v_effective_follow_up_disposition :=
      v_case.contributor_follow_up_disposition;
    v_effective_follow_up_reason :=
      v_case.contributor_follow_up_reason;
    v_effective_follow_up_job_id :=
      v_case.contributor_follow_up_job_id;
    v_effective_follow_up_requested_at :=
      v_case.contributor_follow_up_requested_at;

    if v_case.origin_type =
       'internal_editorial'
    then
      if v_effective_follow_up_disposition is not null
         or v_effective_follow_up_reason is not null
         or v_effective_follow_up_job_id is not null
         or v_effective_follow_up_requested_at is not null
         or p_contributor_follow_up_disposition is not null
         or p_contributor_follow_up_reason is not null
      then
        v_rejection_code :=
          'contributor_follow_up_not_applicable';
        v_rejection_message :=
          'Internal correction closure cannot use contributor follow-up.';
      end if;
    elsif v_case.origin_type =
          'community_contribution'
    then
      if v_effective_follow_up_disposition is null then
        if p_contributor_follow_up_disposition is null then
          v_rejection_code :=
            'contributor_follow_up_required';
          v_rejection_message :=
            'Community-origin correction closure requires contributor follow-up disposition.';
        elsif p_contributor_follow_up_disposition =
              'requested'
        then
          v_effective_follow_up_disposition :=
            'requested';
          v_effective_follow_up_reason :=
            null;
        else
          v_effective_follow_up_disposition :=
            p_contributor_follow_up_disposition;
          v_effective_follow_up_reason :=
            btrim(
              p_contributor_follow_up_reason
            );
        end if;
      elsif p_contributor_follow_up_disposition is not null
            and p_contributor_follow_up_disposition <>
              v_effective_follow_up_disposition
      then
        v_rejection_code :=
          'contributor_follow_up_changed';
        v_rejection_message :=
          'The contributor follow-up disposition changed.';
      elsif v_effective_follow_up_disposition in (
              'unavailable',
              'unsafe'
            )
            and p_contributor_follow_up_reason is not null
            and btrim(
              p_contributor_follow_up_reason
            ) <>
              v_effective_follow_up_reason
      then
        v_rejection_code :=
          'contributor_follow_up_changed';
        v_rejection_message :=
          'The contributor follow-up reason changed.';
      end if;

      if v_rejection_code is null
         and v_effective_follow_up_disposition =
           'requested'
         and v_effective_follow_up_job_id is not null
      then
        select job.status
        into v_job_status
        from platform_private.jobs job
        join platform_private.command_receipts receipt
          on receipt.id =
            job.command_receipt_id
        where job.id =
            v_effective_follow_up_job_id
          and job.resource_id =
            p_case_resource_id
          and job.command_type =
            'correction.contributor_notification.request'
          and job.job_type =
            'correction.contributor_notification'
          and receipt.command_type =
            'correction.contributor_notification.request'
          and receipt.resource_id =
            p_case_resource_id
          and receipt.status in (
            'accepted',
            'succeeded'
          );

        if not found
           or v_job_status not in (
             'queued',
             'running',
             'retry_wait',
             'succeeded',
             'dead_letter'
           )
        then
          v_rejection_code :=
            'contributor_follow_up_job_invalid';
          v_rejection_message :=
            'The contributor follow-up job is missing or invalid.';
        end if;
      elsif v_rejection_code is null
            and v_effective_follow_up_disposition in (
              'unavailable',
              'unsafe'
            )
            and (
              nullif(
                btrim(
                  v_effective_follow_up_reason
                ),
                ''
              ) is null
              or length(
                v_effective_follow_up_reason
              ) > 2000
            )
      then
        v_rejection_code :=
          'contributor_follow_up_invalid';
        v_rejection_message :=
          'Contributor follow-up exception requires a bounded reason.';
      end if;
    end if;
  end if;

  if v_rejection_code is not null then
    v_result := jsonb_build_object(
      'case_resource_id',
      p_case_resource_id,
      'case_revision',
      v_case.current_revision,
      'case_state',
      v_case.case_state,
      'decision_outcome',
      v_outcome,
      'rejection_code',
      v_rejection_code
    );

    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      v_rejection_code,
      v_rejection_message,
      v_result
    );

    return query
    select *
    from platform_private.read_correction_command_result(
      v_begin.command_receipt_id,
      false
    );
    return;
  end if;

  if v_outcome <>
     'correction_required'
  then
    update editorial.correction_cases
    set
      case_state = 'closed',
      current_revision =
        v_case.current_revision + 1,
      closed_reason =
        btrim(p_reason),
      closed_by = v_actor,
      closed_at = now(),
      updated_by = v_actor,
      updated_at = now()
    where resource_id =
      p_case_resource_id;

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
        'decision_outcome',
        v_outcome
      )
    );
  else
    if v_case.origin_type =
         'community_contribution'
       and v_effective_follow_up_disposition =
         'requested'
       and v_effective_follow_up_job_id is null
    then
      select
        notification.child_command_receipt_id,
        notification.contributor_job_id
      into
        v_child_receipt_id,
        v_new_job_id
      from platform_private.request_correction_contributor_notification(
        p_case_resource_id,
        v_case.origin_contribution_id,
        v_case.origin_submitter_user_id,
        v_case.current_decision_id,
        v_case.current_application_id,
        null,
        case
          when v_effective_note_disposition =
            'published'
          then 'correction_published'
          else 'correction_closed_without_public_note'
        end,
        case
          when v_effective_note_disposition =
            'published'
          then 'The submitted correction was applied and the corrected Article was published.'
          else 'The submitted correction was resolved after the corrected Article was published.'
        end,
        v_begin.command_receipt_id,
        v_actor,
        v_case.current_revision,
        v_case.case_state,
        p_correlation_id
      ) notification;

      v_effective_follow_up_job_id :=
        v_new_job_id;
      v_effective_follow_up_requested_at :=
        now();
    end if;

    update editorial.correction_cases
    set
      case_state = 'closed',
      current_revision =
        v_case.current_revision + 1,
      public_note_disposition =
        v_effective_note_disposition,
      public_note_no_note_reason =
        v_effective_note_reason,
      contributor_follow_up_disposition =
        case
          when origin_type =
            'community_contribution'
          then v_effective_follow_up_disposition
          else null
        end,
      contributor_follow_up_reason =
        case
          when origin_type =
            'community_contribution'
          then v_effective_follow_up_reason
          else null
        end,
      contributor_follow_up_job_id =
        case
          when origin_type =
            'community_contribution'
          then v_effective_follow_up_job_id
          else null
        end,
      contributor_follow_up_requested_at =
        case
          when origin_type =
            'community_contribution'
          then v_effective_follow_up_requested_at
          else null
        end,
      closed_reason =
        btrim(p_reason),
      closed_by = v_actor,
      closed_at = now(),
      updated_by = v_actor,
      updated_at = now()
    where resource_id =
      p_case_resource_id;

    perform platform_private.append_correction_public_event(
      p_case_resource_id,
      'case_closed',
      v_case.current_revision,
      v_case.current_revision + 1,
      v_case.case_state,
      'closed',
      v_actor,
      btrim(p_reason),
      v_case.current_decision_id,
      v_case.current_application_id,
      v_application.target_id,
      v_current_note_id,
      v_begin.command_receipt_id,
      p_correlation_id,
      jsonb_build_object(
        'decision_outcome',
        v_outcome,
        'corrected_version_id',
        v_proof.corrected_version_id,
        'public_note_disposition',
        v_effective_note_disposition,
        'public_note_id',
        v_current_note_id,
        'contributor_follow_up_disposition',
        v_effective_follow_up_disposition,
        'contributor_follow_up_job_id',
        v_effective_follow_up_job_id
      )
    );
  end if;

  v_result := jsonb_build_object(
    'case_resource_id',
    p_case_resource_id,
    'case_revision',
    v_case.current_revision + 1,
    'case_state',
    'closed',
    'decision_outcome',
    v_outcome,
    'application_id',
    v_case.current_application_id,
    'corrected_version_id',
    case
      when v_outcome =
        'correction_required'
      then v_proof.corrected_version_id
      else null
    end,
    'public_note_disposition',
    v_effective_note_disposition,
    'public_note_id',
    v_current_note_id,
    'contributor_follow_up_disposition',
    v_effective_follow_up_disposition,
    'contributor_follow_up_job_id',
    v_effective_follow_up_job_id,
    'contributor_follow_up_command_receipt_id',
    v_child_receipt_id
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
  v_outcome text;
  v_resulting_state text;
  v_result jsonb;
begin
  v_actor :=
    platform_private.assert_correction_capability(
      'decide_corrections'
    );

  if p_case_resource_id is null
     or p_expected_case_revision < 1
     or p_correlation_id is null
     or nullif(
       btrim(p_reason),
       ''
     ) is null
  then
    raise exception
      using
        errcode = '22023',
        message = 'Case, revision, reason, and correlation identity are required.';
  end if;

  select *
  into v_begin
  from platform_private.begin_resource_command(
    'correction.case.reopen',
    p_case_resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'expected_case_revision',
      p_expected_case_revision,
      'reason',
      btrim(p_reason),
      'correlation_id',
      p_correlation_id
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
        'case_revision',
        null
      )
    );
  elsif v_case.current_revision <>
        p_expected_case_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'case_revision_changed',
      'The correction case revision changed.',
      jsonb_build_object(
        'case_revision',
        v_case.current_revision,
        'case_state',
        v_case.case_state
      )
    );
  elsif v_case.case_state <> 'closed' then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'invalid_transition',
      'Only closed correction cases may reopen.',
      jsonb_build_object(
        'case_revision',
        v_case.current_revision,
        'case_state',
        v_case.case_state
      )
    );
  elsif v_case.assigned_investigator_id is null then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'investigator_required',
      'A reopened correction case must retain an investigator.',
      jsonb_build_object(
        'case_revision',
        v_case.current_revision,
        'case_state',
        v_case.case_state
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

    if not found then
      perform platform_private.reject_resource_command(
        v_begin.command_receipt_id,
        'decision_changed',
        'The current correction decision changed.',
        jsonb_build_object(
          'case_revision',
          v_case.current_revision,
          'case_state',
          v_case.case_state
        )
      );
    else
      v_resulting_state :=
        case
          when v_outcome =
            'correction_required'
            and v_case.current_application_id
              is not null
          then 'applied'
          else 'investigating'
        end;

      update editorial.correction_cases
      set
        case_state =
          v_resulting_state,
        current_revision =
          v_case.current_revision + 1,
        current_application_id =
          case
            when v_resulting_state =
              'applied'
            then v_case.current_application_id
            else null
          end,
        submitted_for_decision_by =
          case
            when v_resulting_state =
              'applied'
            then v_case.submitted_for_decision_by
            else null
          end,
        submitted_for_decision_at =
          case
            when v_resulting_state =
              'applied'
            then v_case.submitted_for_decision_at
            else null
          end,
        evidence_ready =
          case
            when v_resulting_state =
              'applied'
            then v_case.evidence_ready
            else false
          end,
        public_note_disposition = null,
        public_note_no_note_reason = null,
        contributor_follow_up_disposition = null,
        contributor_follow_up_reason = null,
        contributor_follow_up_job_id = null,
        contributor_follow_up_requested_at = null,
        closed_reason = null,
        closed_by = null,
        closed_at = null,
        updated_by = v_actor,
        updated_at = now()
      where resource_id =
        p_case_resource_id;

      perform platform_private.append_correction_public_event(
        p_case_resource_id,
        'case_reopened',
        v_case.current_revision,
        v_case.current_revision + 1,
        v_case.case_state,
        v_resulting_state,
        v_actor,
        btrim(p_reason),
        v_case.current_decision_id,
        v_case.current_application_id,
        null,
        null,
        v_begin.command_receipt_id,
        p_correlation_id,
        jsonb_build_object(
          'decision_outcome',
          v_outcome,
          'prior_application_id',
          v_case.current_application_id,
          'current_application_retained',
          v_resulting_state = 'applied',
          'prior_public_note_disposition',
          v_case.public_note_disposition,
          'prior_contributor_follow_up_disposition',
          v_case.contributor_follow_up_disposition,
          'historical_notes_preserved',
          true
        )
      );

      v_result := jsonb_build_object(
        'case_resource_id',
        p_case_resource_id,
        'case_revision',
        v_case.current_revision + 1,
        'case_state',
        v_resulting_state,
        'current_decision_id',
        v_case.current_decision_id,
        'current_application_id',
        case
          when v_resulting_state =
            'applied'
          then v_case.current_application_id
          else null
        end,
        'historical_notes_preserved',
        true
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
alter function
  public.get_correction_case_workspace(uuid)
set schema platform_private;

alter function
  platform_private.get_correction_case_workspace(uuid)
rename to get_correction_case_workspace_application_base;

revoke all on function
  platform_private.get_correction_case_workspace_application_base(uuid)
from public, anon, authenticated;

grant execute on function
  platform_private.get_correction_case_workspace_application_base(uuid)
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
  v_case editorial.correction_cases%rowtype;
  v_notes jsonb;
  v_follow_up_job jsonb;
begin
  v_workspace :=
    platform_private.get_correction_case_workspace_application_base(
      p_case_resource_id
    );

  select correction_case.*
  into v_case
  from editorial.correction_cases correction_case
  where correction_case.resource_id =
    p_case_resource_id;

  if not found then
    raise exception
      using
        errcode = 'P0002',
        message = 'The correction case does not exist.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',
        note.id,
        'application_id',
        note.application_id,
        'affected_resource_id',
        note.affected_resource_id,
        'affected_resource_kind',
        note.affected_resource_kind,
        'challenged_version_id',
        note.challenged_version_id,
        'corrected_version_id',
        note.corrected_version_id,
        'note_text',
        note.note_text,
        'note_fingerprint',
        note.note_fingerprint,
        'supersedes_note_id',
        note.supersedes_note_id,
        'published_by',
        note.published_by,
        'published_at',
        note.published_at,
        'is_current',
        note.application_id =
          v_case.current_application_id
        and not exists (
          select 1
          from editorial.correction_public_notes later_note
          where later_note.supersedes_note_id =
            note.id
        )
      )
      order by
        note.published_at,
        note.id
    ),
    '[]'::jsonb
  )
  into v_notes
  from editorial.correction_public_notes note
  where note.case_resource_id =
    p_case_resource_id;

  if v_case.contributor_follow_up_job_id is not null then
    select jsonb_build_object(
      'id',
      job.id,
      'command_receipt_id',
      job.command_receipt_id,
      'job_type',
      job.job_type,
      'status',
      job.status,
      'attempt_count',
      job.attempt_count,
      'max_attempts',
      job.max_attempts,
      'available_at',
      job.available_at,
      'started_at',
      job.started_at,
      'finished_at',
      job.finished_at,
      'created_at',
      job.created_at,
      'updated_at',
      job.updated_at
    )
    into v_follow_up_job
    from platform_private.jobs job
    where job.id =
      v_case.contributor_follow_up_job_id;
  end if;

  v_workspace := jsonb_set(
    v_workspace,
    '{case,public_note_disposition}',
    coalesce(
      to_jsonb(
        v_case.public_note_disposition
      ),
      'null'::jsonb
    ),
    true
  );

  v_workspace := jsonb_set(
    v_workspace,
    '{case,public_note_no_note_reason}',
    coalesce(
      to_jsonb(
        v_case.public_note_no_note_reason
      ),
      'null'::jsonb
    ),
    true
  );

  v_workspace := jsonb_set(
    v_workspace,
    '{case,contributor_follow_up_disposition}',
    coalesce(
      to_jsonb(
        v_case.contributor_follow_up_disposition
      ),
      'null'::jsonb
    ),
    true
  );

  v_workspace := jsonb_set(
    v_workspace,
    '{case,contributor_follow_up_reason}',
    coalesce(
      to_jsonb(
        v_case.contributor_follow_up_reason
      ),
      'null'::jsonb
    ),
    true
  );

  v_workspace := jsonb_set(
    v_workspace,
    '{case,contributor_follow_up_job_id}',
    coalesce(
      to_jsonb(
        v_case.contributor_follow_up_job_id
      ),
      'null'::jsonb
    ),
    true
  );

  v_workspace := jsonb_set(
    v_workspace,
    '{case,contributor_follow_up_requested_at}',
    coalesce(
      to_jsonb(
        v_case.contributor_follow_up_requested_at
      ),
      'null'::jsonb
    ),
    true
  );

  v_workspace := jsonb_set(
    v_workspace,
    '{public_notes}',
    v_notes,
    true
  );

  v_workspace := jsonb_set(
    v_workspace,
    '{contributor_follow_up_job}',
    coalesce(
      v_follow_up_job,
      'null'::jsonb
    ),
    true
  );

  return v_workspace;
end;
$function$;

create or replace function
  public.public_get_article_correction_notes(
    p_slug text
  )
returns table (
  article_id uuid,
  article_resource_id uuid,
  case_reference text,
  correction_note_id uuid,
  challenged_version_id uuid,
  corrected_version_id uuid,
  note_text text,
  note_published_at timestamptz
)
language plpgsql
stable
security definer
set search_path =
  pg_catalog,
  public,
  editorial
as $function$
begin
  if nullif(
       btrim(p_slug),
       ''
     ) is null
  then
    raise exception
      using
        errcode = '22023',
        message = 'Article slug is required.';
  end if;

  return query
  select
    binding.article_id,
    note.affected_resource_id,
    'COR-' ||
      lpad(
        correction_case.case_number::text,
        8,
        '0'
      ),
    note.id,
    note.challenged_version_id,
    note.corrected_version_id,
    note.note_text,
    note.published_at
  from editorial.correction_public_notes note
  join editorial.correction_cases correction_case
    on correction_case.resource_id =
      note.case_resource_id
   and correction_case.current_application_id =
      note.application_id
   and correction_case.public_note_disposition =
      'published'
  join editorial.article_resources binding
    on binding.resource_id =
      note.affected_resource_id
   and binding.resource_kind = 'article'
  join public.wk_articles article
    on article.id =
      binding.article_id
   and article.slug =
      btrim(p_slug)
  join lateral
    editorial.correction_article_publication_proof(
      note.application_id
    ) proof
    on proof.corrected_version_id =
      note.corrected_version_id
   and proof.affected_resource_id =
      note.affected_resource_id
   and proof.article_id =
      binding.article_id
   and proof.challenged_version_id =
      note.challenged_version_id
  where not exists (
    select 1
    from editorial.correction_public_notes later_note
    where later_note.supersedes_note_id =
      note.id
  )
  order by
    note.published_at,
    note.id;
end;
$function$;
alter table editorial.correction_public_notes
  enable row level security;

revoke all
on editorial.correction_public_notes
from public, anon, authenticated;

grant all
on editorial.correction_public_notes
to service_role;

revoke all on function
  editorial.correction_public_note_fingerprint(
    uuid,
    uuid,
    uuid,
    uuid,
    uuid,
    text
  ),
  editorial.correction_article_publication_proof(uuid),
  editorial.protect_correction_public_note(),
  editorial.assert_correction_public_note_integrity()
from public, anon, authenticated;

grant execute on function
  editorial.correction_public_note_fingerprint(
    uuid,
    uuid,
    uuid,
    uuid,
    uuid,
    text
  ),
  editorial.correction_article_publication_proof(uuid),
  editorial.protect_correction_public_note(),
  editorial.assert_correction_public_note_integrity()
to service_role;

revoke all on function
  platform_private.append_correction_public_event(
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
  platform_private.request_correction_contributor_notification(
    uuid,
    uuid,
    uuid,
    uuid,
    uuid,
    uuid,
    text,
    text,
    uuid,
    uuid,
    bigint,
    text,
    uuid
  ),
  platform_private.get_correction_case_workspace_application_base(uuid)
from public, anon, authenticated;

grant execute on function
  platform_private.append_correction_public_event(
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
  platform_private.request_correction_contributor_notification(
    uuid,
    uuid,
    uuid,
    uuid,
    uuid,
    uuid,
    text,
    text,
    uuid,
    uuid,
    bigint,
    text,
    uuid
  ),
  platform_private.get_correction_case_workspace_application_base(uuid)
to service_role;

revoke execute on function
  public.publish_correction_note(
    uuid,
    bigint,
    uuid,
    uuid,
    text,
    uuid,
    text,
    text,
    text,
    uuid
  ),
  public.close_correction_case(
    uuid,
    bigint,
    text,
    text,
    uuid,
    text,
    text,
    text,
    text
  ),
  public.reopen_correction_case(
    uuid,
    bigint,
    text,
    text,
    uuid
  ),
  public.get_correction_case_workspace(uuid)
from public, anon;

grant execute on function
  public.publish_correction_note(
    uuid,
    bigint,
    uuid,
    uuid,
    text,
    uuid,
    text,
    text,
    text,
    uuid
  ),
  public.close_correction_case(
    uuid,
    bigint,
    text,
    text,
    uuid,
    text,
    text,
    text,
    text
  ),
  public.reopen_correction_case(
    uuid,
    bigint,
    text,
    text,
    uuid
  ),
  public.get_correction_case_workspace(uuid)
to authenticated, service_role;

revoke execute on function
  public.public_get_article_correction_notes(text)
from public;

grant execute on function
  public.public_get_article_correction_notes(text)
to anon, authenticated, service_role;

comment on table editorial.correction_public_notes is
  'Immutable public-safe Article correction notes. Supersession creates a later row and preserves history.';

comment on column editorial.correction_cases.public_note_disposition is
  'Current governed correction-note disposition: published or not_required.';

comment on column editorial.correction_cases.contributor_follow_up_disposition is
  'Current contributor follow-up disposition for community-origin correction cases.';

comment on function
  public.publish_correction_note(
    uuid,
    bigint,
    uuid,
    uuid,
    text,
    uuid,
    text,
    text,
    text,
    uuid
  )
is
  'Publishes one immutable public-safe correction note after exact application and normal Article publication proof.';

comment on function
  public.public_get_article_correction_notes(text)
is
  'Returns only the latest public-safe correction note for an Article slug.';

comment on function
  public.close_correction_case(
    uuid,
    bigint,
    text,
    text,
    uuid,
    text,
    text,
    text,
    text
  )
is
  'Closes non-correction cases compatibly and correction-required cases only after application, publication, note disposition, related-review, and contributor follow-up gates.';

notify pgrst, 'reload schema';

commit;
