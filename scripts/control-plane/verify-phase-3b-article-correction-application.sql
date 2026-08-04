-- Verify Phase 3B Migration 3 Article correction application authority.

begin;

do $verify_phase_3b_m3_structure$
declare
  v_function text;
  v_trigger text;
begin
  if to_regclass(
       'editorial.correction_applications'
     ) is null
  then
    raise exception
      'STOP: Missing Migration 3 application table';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'editorial'
      and table_name = 'correction_cases'
      and column_name = 'current_application_id'
      and udt_name = 'uuid'
      and is_nullable = 'YES'
  ) then
    raise exception
      'STOP: current_application_id is missing or invalid';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid =
        'editorial.correction_cases'::regclass
      and constraint_row.conname =
        'correction_cases_current_application_fkey'
      and constraint_row.contype = 'f'
      and constraint_row.condeferrable
      and constraint_row.condeferred
  ) then
    raise exception
      'STOP: Current-application foreign key is not deferred';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid =
        'editorial.correction_events'::regclass
      and constraint_row.conname =
        'correction_events_application_fkey'
      and constraint_row.contype = 'f'
      and constraint_row.condeferrable
  ) then
    raise exception
      'STOP: Correction-event application foreign key is missing';
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
      ) like '%correction%'
  ) then
    raise exception
      'STOP: Correction Article version kind is missing';
  end if;

  foreach v_trigger in array array[
    'correction_applications_append_only',
    'correction_applications_integrity',
    'correction_applications_case_integrity'
  ]
  loop
    if not exists (
      select 1
      from pg_trigger trigger_row
      where trigger_row.tgname = v_trigger
        and not trigger_row.tgisinternal
    ) then
      raise exception
        'STOP: Missing Migration 3 trigger: %',
        v_trigger;
    end if;
  end loop;

  if not exists (
    select 1
    from pg_class relation
    where relation.oid =
      'editorial.correction_applications'::regclass
      and relation.relrowsecurity
  ) then
    raise exception
      'STOP: RLS is not enabled on correction_applications';
  end if;

  if has_table_privilege(
       'anon',
       'editorial.correction_applications',
       'SELECT'
     )
     or has_table_privilege(
       'anon',
       'editorial.correction_applications',
       'INSERT'
     )
     or has_table_privilege(
       'authenticated',
       'editorial.correction_applications',
       'SELECT'
     )
     or has_table_privilege(
       'authenticated',
       'editorial.correction_applications',
       'INSERT'
     )
     or has_table_privilege(
       'authenticated',
       'editorial.correction_applications',
       'UPDATE'
     )
     or has_table_privilege(
       'authenticated',
       'editorial.correction_applications',
       'DELETE'
     )
  then
    raise exception
      'STOP: Browser role has direct correction application table access';
  end if;

  if not has_table_privilege(
       'service_role',
       'editorial.correction_applications',
       'SELECT'
     )
     or not has_table_privilege(
       'service_role',
       'editorial.correction_applications',
       'INSERT'
     )
     or not has_table_privilege(
       'service_role',
       'editorial.correction_applications',
       'UPDATE'
     )
     or not has_table_privilege(
       'service_role',
       'editorial.correction_applications',
       'DELETE'
     )
  then
    raise exception
      'STOP: service_role application table authority is incomplete';
  end if;

  if (
    select count(*)
    from platform_private.command_types command_type
    where command_type.command_type like
      'correction.%'
  ) <> 15 then
    raise exception
      'STOP: Migration 3 must leave exactly 15 correction command types';
  end if;

  if not exists (
    select 1
    from platform_private.command_types command_type
    where command_type.command_type =
      'correction.article.apply'
      and command_type.job_type =
        'correction.article.apply.sync'
      and command_type.accepted_event_type =
        'correction.article.apply.accepted'
      and command_type.success_event_type =
        'correction.article.apply.succeeded'
      and command_type.failure_event_type =
        'correction.article.apply.failed'
      and command_type.retry_event_type =
        'correction.article.apply.retry_scheduled'
      and command_type.enabled
  ) then
    raise exception
      'STOP: Article correction application command type is invalid';
  end if;

  if exists (
    select 1
    from platform_private.command_types
    where command_type =
      'correction.apply_article'
  ) then
    raise exception
      'STOP: Inconsistent correction.apply_article command type exists';
  end if;

  foreach v_function in array array[
    'public.apply_article_correction(uuid,bigint,uuid,uuid,uuid,uuid,uuid,text,jsonb,uuid[],text,text,uuid)',
    'public.get_correction_case_workspace(uuid)'
  ]
  loop
    if to_regprocedure(v_function) is null then
      raise exception
        'STOP: Missing Migration 3 public function: %',
        v_function;
    end if;

    if has_function_privilege(
         'anon',
         v_function,
         'EXECUTE'
       )
       or not has_function_privilege(
         'authenticated',
         v_function,
         'EXECUTE'
       )
       or not has_function_privilege(
         'service_role',
         v_function,
         'EXECUTE'
       )
    then
      raise exception
        'STOP: Migration 3 public function grants are invalid: %',
        v_function;
    end if;
  end loop;

  foreach v_function in array array[
    'platform_private.append_correction_application_event(uuid,text,bigint,bigint,text,text,uuid,text,uuid,uuid,uuid,uuid,uuid,jsonb)',
    'platform_private.get_correction_case_workspace_base(uuid)'
  ]
  loop
    if to_regprocedure(v_function) is null then
      raise exception
        'STOP: Missing Migration 3 private helper: %',
        v_function;
    end if;

    if has_function_privilege(
         'anon',
         v_function,
         'EXECUTE'
       )
       or has_function_privilege(
         'authenticated',
         v_function,
         'EXECUTE'
       )
       or not has_function_privilege(
         'service_role',
         v_function,
         'EXECUTE'
       )
    then
      raise exception
        'STOP: Migration 3 private helper grants are invalid: %',
        v_function;
    end if;
  end loop;

  if to_regclass(
       'editorial.correction_public_notes'
     ) is not null
     or exists (
       select 1
       from pg_proc procedure_row
       join pg_namespace namespace
         on namespace.oid =
           procedure_row.pronamespace
       where namespace.nspname = 'public'
         and procedure_row.proname in (
           'publish_correction_note',
           'public_get_article_correction_notes'
         )
     )
  then
    raise exception
      'STOP: Migration 4 public-note authority leaked into Migration 3';
  end if;

  if exists (
    select 1
    from editorial.correction_cases
  ) or exists (
    select 1
    from editorial.correction_applications
  ) then
    raise exception
      'STOP: Migration 3 created production correction rows';
  end if;
end;
$verify_phase_3b_m3_structure$;

set local session_replication_role = replica;

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
select
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000000501',
  'authenticated',
  'authenticated',
  'phase3b-m3-verifier@local.invalid',
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
where not exists (
  select 1
  from auth.users
);

set local session_replication_role = origin;

set constraints all deferred;

insert into editorial.resource_kinds (
  kind,
  label,
  description,
  enabled
)
values (
  'article',
  'Article',
  'Canonical Article content stored in public.wk_articles.',
  true
)
on conflict (kind)
do nothing;

insert into public.wk_articles (
  id,
  slug,
  title,
  excerpt,
  content_html,
  author,
  wp_status,
  published_at,
  categories,
  tags,
  seo,
  draft_version
)
values (
  '00000000-0000-4000-8000-000000000511',
  'phase3b-m3-verifier-article',
  'Phase 3B Migration 3 Verifier Article',
  'Verifier excerpt.',
  '<p>Original verifier content.</p>',
  'Verifier Author',
  'publish',
  now(),
  '[]'::jsonb,
  '[]'::jsonb,
  '{}'::jsonb,
  1
);

insert into editorial.resources (
  id,
  resource_kind,
  visibility,
  lifecycle_state,
  owner_id,
  created_by
)
values (
  '00000000-0000-4000-8000-000000000521',
  'article',
  'public',
  'published',
  '00000000-0000-4000-8000-000000000501',
  '00000000-0000-4000-8000-000000000501'
);

insert into editorial.article_resources (
  resource_id,
  resource_kind,
  article_id
)
values (
  '00000000-0000-4000-8000-000000000521',
  'article',
  '00000000-0000-4000-8000-000000000511'
);

insert into editorial.article_versions (
  id,
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
  seo,
  lifecycle_state,
  wp_status,
  published_at,
  category_snapshot,
  tag_snapshot,
  created_by,
  content_fingerprint
)
select
  '00000000-0000-4000-8000-000000000531',
  '00000000-0000-4000-8000-000000000521',
  article.id,
  1,
  'published',
  1,
  article.title,
  article.slug,
  article.excerpt,
  article.content_html,
  article.author,
  '00000000-0000-4000-8000-000000000501',
  article.seo,
  'published',
  article.wp_status,
  article.published_at,
  article.categories,
  article.tags,
  '00000000-0000-4000-8000-000000000501',
  editorial.article_snapshot_fingerprint(
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
  )
from public.wk_articles article
where article.id =
  '00000000-0000-4000-8000-000000000511';

update editorial.resources
set
  current_published_version_id =
    '00000000-0000-4000-8000-000000000531',
  current_working_version_id =
    '00000000-0000-4000-8000-000000000531'
where id =
  '00000000-0000-4000-8000-000000000521';

insert into editorial.resources (
  id,
  resource_kind,
  visibility,
  lifecycle_state,
  created_by
)
values (
  '00000000-0000-4000-8000-000000000541',
  'correction_case',
  'internal',
  'active',
  '00000000-0000-4000-8000-000000000501'
);

insert into editorial.correction_cases (
  resource_id,
  origin_type,
  origin_summary_snapshot,
  correction_kind,
  priority,
  case_state,
  current_revision,
  assigned_investigator_id,
  assignment_reason,
  assigned_at,
  triage_reason,
  triaged_by,
  triaged_at,
  investigation_summary,
  investigator_recommendation,
  evidence_ready,
  submitted_for_decision_by,
  submitted_for_decision_at,
  created_by,
  updated_by
)
values (
  '00000000-0000-4000-8000-000000000541',
  'internal_editorial',
  'Verifier Article correction case.',
  'factual_error',
  'high',
  'decided',
  5,
  '00000000-0000-4000-8000-000000000501',
  'Verifier assignment.',
  now(),
  'Verifier triage.',
  '00000000-0000-4000-8000-000000000501',
  now(),
  'Verifier investigation summary.',
  'Apply the corrected Article snapshot.',
  true,
  '00000000-0000-4000-8000-000000000501',
  now(),
  '00000000-0000-4000-8000-000000000501',
  '00000000-0000-4000-8000-000000000501'
);

insert into editorial.correction_targets (
  id,
  case_resource_id,
  target_resource_id,
  target_resource_kind,
  target_version_type,
  target_version_id,
  target_role,
  target_summary,
  observed_resource_revision,
  observed_content_fingerprint,
  created_by
)
select
  '00000000-0000-4000-8000-000000000551',
  '00000000-0000-4000-8000-000000000541',
  version.resource_id,
  'article',
  'article_version',
  version.id,
  'primary',
  'Verifier published Article target.',
  1,
  version.content_fingerprint,
  '00000000-0000-4000-8000-000000000501'
from editorial.article_versions version
where version.id =
  '00000000-0000-4000-8000-000000000531';

insert into editorial.correction_decisions (
  id,
  case_resource_id,
  decision_number,
  outcome,
  reason,
  private_analysis,
  public_safe_explanation,
  case_revision_observed,
  target_state_observed,
  decided_by,
  correlation_id
)
values (
  '00000000-0000-4000-8000-000000000561',
  '00000000-0000-4000-8000-000000000541',
  1,
  'correction_required',
  'Verifier correction-required decision.',
  'Verifier private analysis.',
  'Verifier public-safe explanation.',
  4,
  jsonb_build_object(
    'target_resource_id',
    '00000000-0000-4000-8000-000000000521',
    'target_version_id',
    '00000000-0000-4000-8000-000000000531'
  ),
  '00000000-0000-4000-8000-000000000501',
  gen_random_uuid()
);

update editorial.correction_cases
set current_decision_id =
  '00000000-0000-4000-8000-000000000561'
where resource_id =
  '00000000-0000-4000-8000-000000000541';

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
  metadata
)
values
  (
    '00000000-0000-4000-8000-000000000541',
    1,
    'case_created',
    1,
    1,
    null,
    'submitted',
    '00000000-0000-4000-8000-000000000501',
    'Verifier case created.',
    null,
    null,
    '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000541',
    2,
    'case_triaged',
    1,
    2,
    'submitted',
    'triaged',
    '00000000-0000-4000-8000-000000000501',
    'Verifier case triaged.',
    null,
    '00000000-0000-4000-8000-000000000551',
    '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000541',
    3,
    'investigator_assigned',
    2,
    3,
    'triaged',
    'investigating',
    '00000000-0000-4000-8000-000000000501',
    'Verifier investigator assigned.',
    null,
    null,
    '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000541',
    4,
    'submitted_for_decision',
    3,
    4,
    'investigating',
    'awaiting_decision',
    '00000000-0000-4000-8000-000000000501',
    'Verifier submitted for decision.',
    null,
    null,
    '{}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000541',
    5,
    'decision_recorded',
    4,
    5,
    'awaiting_decision',
    'decided',
    '00000000-0000-4000-8000-000000000501',
    'Verifier decision recorded.',
    '00000000-0000-4000-8000-000000000561',
    null,
    '{}'::jsonb
  );

set constraints all immediate;
set constraints all deferred;

do $verify_phase_3b_m3_runtime$
declare
  v_actor constant uuid :=
    '00000000-0000-4000-8000-000000000501';
  v_case_id constant uuid :=
    '00000000-0000-4000-8000-000000000541';
  v_decision_id constant uuid :=
    '00000000-0000-4000-8000-000000000561';
  v_target_id constant uuid :=
    '00000000-0000-4000-8000-000000000551';
  v_resource_id constant uuid :=
    '00000000-0000-4000-8000-000000000521';
  v_article_id constant uuid :=
    '00000000-0000-4000-8000-000000000511';
  v_published_version_id constant uuid :=
    '00000000-0000-4000-8000-000000000531';
  v_working_fingerprint text;
  v_payload jsonb;
  v_article_before jsonb;
  v_resource_before jsonb;
  v_case_before jsonb;
  v_version_count_before bigint;
  v_application_count_before bigint;
  v_event_count_before bigint;
  v_command record;
  v_replay record;
  v_receipt_id uuid;
  v_application_id uuid;
  v_resulting_version_id uuid;
  v_error_code text;
  v_event_count_after_stale bigint;
  v_workspace jsonb;
begin
  perform set_config(
    'request.jwt.claim.role',
    'service_role',
    true
  );

  perform set_config(
    'request.jwt.claim.sub',
    v_actor::text,
    true
  );

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'role',
      'service_role',
      'sub',
      v_actor
    )::text,
    true
  );

  if auth.role() <> 'service_role'
     or auth.uid() is distinct from v_actor
  then
    raise exception
      'STOP: Runtime verifier could not establish service actor context';
  end if;

  select version.content_fingerprint
  into v_working_fingerprint
  from editorial.article_versions version
  where version.id =
    v_published_version_id;

  v_payload := jsonb_build_object(
    'title',
    'Phase 3B Migration 3 Corrected Article',
    'slug',
    'phase3b-m3-verifier-article',
    'excerpt',
    'Corrected verifier excerpt.',
    'content_html',
    '<p>Corrected verifier content.</p>',
    'author',
    'Verifier Author',
    'published_at',
    (
      select article.published_at
      from public.wk_articles article
      where article.id = v_article_id
    ),
    'seo',
    jsonb_build_object(
      'title',
      'Corrected verifier Article'
    ),
    'hero_image_id',
    null,
    'hero_image_url',
    null
  );

  select to_jsonb(article)
  into v_article_before
  from public.wk_articles article
  where article.id = v_article_id;

  select to_jsonb(resource)
  into v_resource_before
  from editorial.resources resource
  where resource.id = v_resource_id;

  select to_jsonb(correction_case)
  into v_case_before
  from editorial.correction_cases correction_case
  where correction_case.resource_id =
    v_case_id;

  select count(*)
  into v_version_count_before
  from editorial.article_versions version
  where version.resource_id =
    v_resource_id;

  select count(*)
  into v_application_count_before
  from editorial.correction_applications application
  where application.case_resource_id =
    v_case_id;

  select count(*)
  into v_event_count_before
  from editorial.correction_events event
  where event.case_resource_id =
    v_case_id;

  select *
  into v_command
  from public.apply_article_correction(
    v_case_id,
    4,
    v_decision_id,
    v_target_id,
    v_published_version_id,
    v_published_version_id,
    v_published_version_id,
    v_working_fingerprint,
    v_payload,
    '{}'::uuid[],
    'Verifier stale application.',
    'verify-m3-stale-application',
    gen_random_uuid()
  );

  if v_command.receipt_status <> 'rejected'
     or v_command.case_revision <> 5
     or v_command.idempotent_replay
  then
    raise exception
      'STOP: Stale Article application was not durably rejected';
  end if;

  v_receipt_id :=
    v_command.command_receipt_id;

  select receipt.error_code
  into v_error_code
  from platform_private.command_receipts receipt
  where receipt.id = v_receipt_id;

  if v_error_code <>
     'case_revision_changed'
  then
    raise exception
      'STOP: Stale Article application used the wrong rejection code';
  end if;

  if (
    select to_jsonb(article)
    from public.wk_articles article
    where article.id = v_article_id
  ) is distinct from v_article_before
     or (
       select to_jsonb(resource)
       from editorial.resources resource
       where resource.id = v_resource_id
     ) is distinct from v_resource_before
     or (
       select to_jsonb(correction_case)
       from editorial.correction_cases correction_case
       where correction_case.resource_id =
         v_case_id
     ) is distinct from v_case_before
     or (
       select count(*)
       from editorial.article_versions version
       where version.resource_id =
         v_resource_id
     ) <> v_version_count_before
     or (
       select count(*)
       from editorial.correction_applications application
       where application.case_resource_id =
         v_case_id
     ) <> v_application_count_before
  then
    raise exception
      'STOP: Stale Article application changed canonical Article or correction state';
  end if;

  select count(*)
  into v_event_count_after_stale
  from editorial.correction_events event
  where event.case_resource_id =
    v_case_id;

  if v_event_count_after_stale <>
       v_event_count_before + 2
     or (
       select count(*)
       from editorial.correction_events event
       where event.case_resource_id =
           v_case_id
         and event.command_receipt_id =
           v_receipt_id
         and event.event_type in (
           'application_accepted',
           'application_rejected_stale'
         )
         and event.case_revision_before = 5
         and event.case_revision_after = 5
         and event.prior_state = 'decided'
         and event.resulting_state = 'decided'
     ) <> 2
  then
    raise exception
      'STOP: Stale Article application history is incomplete';
  end if;

  select *
  into v_replay
  from public.apply_article_correction(
    v_case_id,
    4,
    v_decision_id,
    v_target_id,
    v_published_version_id,
    v_published_version_id,
    v_published_version_id,
    v_working_fingerprint,
    v_payload,
    '{}'::uuid[],
    'Verifier stale application.',
    'verify-m3-stale-application',
    (
      select (
        receipt.request_payload ->>
          'correlation_id'
      )::uuid
      from platform_private.command_receipts receipt
      where receipt.id = v_receipt_id
    )
  );

  if v_replay.command_receipt_id
       is distinct from v_receipt_id
     or not v_replay.idempotent_replay
     or v_replay.receipt_status <>
       'rejected'
     or (
       select count(*)
       from editorial.correction_events event
       where event.case_resource_id =
         v_case_id
     ) <> v_event_count_after_stale
  then
    raise exception
      'STOP: Rejected Article application replay is invalid';
  end if;

  begin
    perform 1
    from public.apply_article_correction(
      v_case_id,
      4,
      v_decision_id,
      v_target_id,
      v_published_version_id,
      v_published_version_id,
      v_published_version_id,
      v_working_fingerprint,
      v_payload ||
        jsonb_build_object(
          'content_html',
          '<p>Conflicting verifier content.</p>'
        ),
      '{}'::uuid[],
      'Conflicting verifier application.',
      'verify-m3-stale-application',
      (
        select (
          receipt.request_payload ->>
            'correlation_id'
        )::uuid
        from platform_private.command_receipts receipt
        where receipt.id = v_receipt_id
      )
    );

    raise exception
      'STOP: Conflicting Article application idempotency reuse was accepted';
  exception
    when unique_violation then
      null;
  end;

  select *
  into v_command
  from public.apply_article_correction(
    v_case_id,
    5,
    v_decision_id,
    v_target_id,
    v_published_version_id,
    v_published_version_id,
    v_published_version_id,
    v_working_fingerprint,
    v_payload,
    '{}'::uuid[],
    'Apply the verified corrected Article snapshot.',
    'verify-m3-valid-application',
    gen_random_uuid()
  );

  if v_command.receipt_status <> 'succeeded'
     or v_command.case_revision <> 6
     or v_command.idempotent_replay
  then
    raise exception
      'STOP: Valid Article correction application failed';
  end if;

  v_receipt_id :=
    v_command.command_receipt_id;
  v_application_id :=
    (
      v_command.result_payload ->>
        'application_id'
    )::uuid;
  v_resulting_version_id :=
    (
      v_command.result_payload ->>
        'resulting_version_id'
    )::uuid;

  set constraints all immediate;
  set constraints all deferred;

  if (
    select correction_case.case_state
    from editorial.correction_cases correction_case
    where correction_case.resource_id =
      v_case_id
  ) <> 'applied'
     or (
       select correction_case.current_revision
       from editorial.correction_cases correction_case
       where correction_case.resource_id =
         v_case_id
     ) <> 6
     or (
       select correction_case.current_application_id
       from editorial.correction_cases correction_case
       where correction_case.resource_id =
         v_case_id
     ) is distinct from v_application_id
  then
    raise exception
      'STOP: Valid Article application did not advance the correction case';
  end if;

  if (
    select resource.current_published_version_id
    from editorial.resources resource
    where resource.id = v_resource_id
  ) is distinct from v_published_version_id
     or (
       select resource.current_working_version_id
       from editorial.resources resource
       where resource.id = v_resource_id
     ) is distinct from v_resulting_version_id
  then
    raise exception
      'STOP: Article correction application changed the wrong version pointer';
  end if;

  if not exists (
    select 1
    from editorial.article_versions version
    where version.id =
        v_resulting_version_id
      and version.resource_id =
        v_resource_id
      and version.article_id =
        v_article_id
      and version.version_kind =
        'correction'
      and version.version_number = 2
      and version.source_draft_version = 2
      and version.content_html =
        '<p>Corrected verifier content.</p>'
      and version.content_fingerprint =
        editorial.article_snapshot_fingerprint(
          version.title,
          version.slug,
          version.excerpt,
          version.content_html,
          version.author_display,
          version.hero_image_id,
          version.hero_image_url,
          version.seo,
          version.wp_status,
          version.published_at,
          version.category_snapshot,
          version.tag_snapshot
        )
  ) then
    raise exception
      'STOP: Resulting correction Article version is invalid';
  end if;

  if not exists (
    select 1
    from public.wk_articles article
    where article.id = v_article_id
      and article.draft_version = 2
      and article.title =
        'Phase 3B Migration 3 Corrected Article'
      and article.content_html =
        '<p>Corrected verifier content.</p>'
      and article.wp_status = 'publish'
  ) then
    raise exception
      'STOP: Mutable Article working state was not updated correctly';
  end if;

  if not exists (
    select 1
    from editorial.correction_applications application
    where application.id =
        v_application_id
      and application.case_resource_id =
        v_case_id
      and application.decision_id =
        v_decision_id
      and application.command_receipt_id =
        v_receipt_id
      and application.command_type =
        'correction.article.apply'
      and application.adapter_type =
        'article'
      and application.target_id =
        v_target_id
      and application.target_resource_id =
        v_resource_id
      and application.challenged_version_id =
        v_published_version_id
      and application.expected_published_version_id =
        v_published_version_id
      and application.expected_working_version_id =
        v_published_version_id
      and application.expected_working_fingerprint =
        v_working_fingerprint
      and application.resulting_version_id =
        v_resulting_version_id
      and application.applied_by =
        v_actor
  ) then
    raise exception
      'STOP: Immutable correction application record is invalid';
  end if;

  if (
    select count(*)
    from editorial.correction_events event
    where event.case_resource_id =
        v_case_id
      and event.command_receipt_id =
        v_receipt_id
      and event.event_type in (
        'application_accepted',
        'application_succeeded'
      )
  ) <> 2
     or not exists (
       select 1
       from editorial.correction_events event
       where event.case_resource_id =
           v_case_id
         and event.command_receipt_id =
           v_receipt_id
         and event.event_type =
           'application_succeeded'
         and event.application_id =
           v_application_id
         and event.case_revision_before = 5
         and event.case_revision_after = 6
         and event.prior_state = 'decided'
         and event.resulting_state = 'applied'
     )
  then
    raise exception
      'STOP: Successful Article application history is incomplete';
  end if;

  if (
    select count(*)
    from platform_private.outbox_events outbox_event
    where outbox_event.command_receipt_id =
      v_receipt_id
      and outbox_event.event_type in (
        'correction.article.apply.accepted',
        'correction.article.apply.succeeded'
      )
  ) <> 2 then
    raise exception
      'STOP: Article application outbox history is incomplete';
  end if;

  select *
  into v_replay
  from public.apply_article_correction(
    v_case_id,
    5,
    v_decision_id,
    v_target_id,
    v_published_version_id,
    v_published_version_id,
    v_published_version_id,
    v_working_fingerprint,
    v_payload,
    '{}'::uuid[],
    'Apply the verified corrected Article snapshot.',
    'verify-m3-valid-application',
    (
      select (
        receipt.request_payload ->>
          'correlation_id'
      )::uuid
      from platform_private.command_receipts receipt
      where receipt.id = v_receipt_id
    )
  );

  if v_replay.command_receipt_id
       is distinct from v_receipt_id
     or not v_replay.idempotent_replay
     or v_replay.receipt_status <>
       'succeeded'
  then
    raise exception
      'STOP: Successful Article application replay is invalid';
  end if;

  select *
  into v_command
  from public.apply_article_correction(
    v_case_id,
    6,
    v_decision_id,
    v_target_id,
    v_published_version_id,
    v_published_version_id,
    v_resulting_version_id,
    (
      select version.content_fingerprint
      from editorial.article_versions version
      where version.id =
        v_resulting_version_id
    ),
    v_payload,
    '{}'::uuid[],
    'Verifier duplicate successful application.',
    'verify-m3-duplicate-application',
    gen_random_uuid()
  );

  if v_command.receipt_status <> 'rejected'
     or v_command.case_revision <> 6
  then
    raise exception
      'STOP: Duplicate successful application was not durably rejected';
  end if;

  select receipt.error_code
  into v_error_code
  from platform_private.command_receipts receipt
  where receipt.id =
    v_command.command_receipt_id;

  if v_error_code <>
     'application_already_succeeded'
     or (
       select count(*)
       from editorial.correction_applications application
       where application.case_resource_id =
         v_case_id
     ) <> 1
     or (
       select count(*)
       from editorial.article_versions version
       where version.resource_id =
         v_resource_id
     ) <> v_version_count_before + 1
  then
    raise exception
      'STOP: Duplicate successful application rejection changed canonical state';
  end if;

  begin
    update editorial.correction_applications
    set application_summary =
      'Forbidden application rewrite.'
    where id = v_application_id;

    raise exception
      'STOP: Append-only correction application was updated';
  exception
    when others then
      if position(
        'immutable'
        in sqlerrm
      ) = 0 then
        raise;
      end if;
  end;

  begin
    delete from editorial.correction_applications
    where id = v_application_id;

    raise exception
      'STOP: Append-only correction application was deleted';
  exception
    when others then
      if position(
        'immutable'
        in sqlerrm
      ) = 0 then
        raise;
      end if;
  end;

  v_workspace :=
    public.get_correction_case_workspace(
      v_case_id
    );

  if v_workspace #>>
       '{case,current_application_id}'
       is distinct from
         v_application_id::text
     or jsonb_array_length(
       v_workspace -> 'applications'
     ) <> 1
     or v_workspace #>>
       '{applications,0,resulting_version_id}'
       is distinct from
         v_resulting_version_id::text
  then
    raise exception
      'STOP: Correction workspace application history is invalid';
  end if;
end;
$verify_phase_3b_m3_runtime$;

select
  'PASS: Phase 3B Article correction application authority verified.'
  as result;

rollback;
