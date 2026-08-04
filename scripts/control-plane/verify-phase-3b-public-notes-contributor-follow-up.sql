-- Verify Phase 3B Migration 4 public notes and contributor follow-up.

begin;

do $verify_phase_3b_m4_structure$
declare
  v_function text;
  v_trigger text;
  v_result text;
begin
  if to_regclass(
       'editorial.correction_public_notes'
     ) is null
  then
    raise exception
      'STOP: Missing Migration 4 public-note table';
  end if;

  foreach v_function in array array[
    'editorial.correction_public_note_fingerprint(uuid,uuid,uuid,uuid,uuid,text)',
    'editorial.correction_article_publication_proof(uuid)',
    'platform_private.append_correction_public_event(uuid,text,bigint,bigint,text,text,uuid,text,uuid,uuid,uuid,uuid,uuid,uuid,jsonb)',
    'platform_private.request_correction_contributor_notification(uuid,uuid,uuid,uuid,uuid,uuid,text,text,uuid,uuid,bigint,text,uuid)',
    'platform_private.get_correction_case_workspace_application_base(uuid)',
    'public.publish_correction_note(uuid,bigint,uuid,uuid,text,uuid,text,text,text,uuid)',
    'public.close_correction_case(uuid,bigint,text,text,uuid,text,text,text,text)',
    'public.reopen_correction_case(uuid,bigint,text,text,uuid)',
    'public.public_get_article_correction_notes(text)',
    'public.get_correction_case_workspace(uuid)'
  ]
  loop
    if to_regprocedure(v_function) is null then
      raise exception
        'STOP: Missing Migration 4 function: %',
        v_function;
    end if;
  end loop;

  if to_regprocedure(
       'public.close_correction_case(uuid,bigint,text,text,uuid)'
     ) is not null
  then
    raise exception
      'STOP: Stale five-argument close function remains';
  end if;

  if (
    select count(*)
    from information_schema.columns
    where table_schema = 'editorial'
      and table_name = 'correction_cases'
      and column_name in (
        'contributor_follow_up_disposition',
        'contributor_follow_up_reason',
        'contributor_follow_up_job_id',
        'contributor_follow_up_requested_at'
      )
  ) <> 4 then
    raise exception
      'STOP: Contributor follow-up case columns are incomplete';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid =
        'editorial.correction_cases'::regclass
      and constraint_row.conname =
        'correction_cases_contributor_follow_up_job_fkey'
      and constraint_row.contype = 'f'
  ) then
    raise exception
      'STOP: Contributor follow-up job foreign key is missing';
  end if;

  foreach v_trigger in array array[
    'correction_public_notes_append_only',
    'correction_public_notes_integrity'
  ]
  loop
    if not exists (
      select 1
      from pg_trigger trigger_row
      where trigger_row.tgname =
        v_trigger
        and not trigger_row.tgisinternal
    ) then
      raise exception
        'STOP: Missing Migration 4 trigger: %',
        v_trigger;
    end if;
  end loop;

  if not exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid =
        'editorial.correction_events'::regclass
      and constraint_row.conname =
        'correction_events_public_note_fkey'
      and constraint_row.contype = 'f'
      and constraint_row.condeferrable
  ) then
    raise exception
      'STOP: Correction-event public-note foreign key is invalid';
  end if;

  if not exists (
    select 1
    from pg_class relation
    where relation.oid =
      'editorial.correction_public_notes'::regclass
      and relation.relrowsecurity
  ) then
    raise exception
      'STOP: RLS is not enabled on correction_public_notes';
  end if;

  if has_table_privilege(
       'anon',
       'editorial.correction_public_notes',
       'SELECT'
     )
     or has_table_privilege(
       'anon',
       'editorial.correction_public_notes',
       'INSERT'
     )
     or has_table_privilege(
       'authenticated',
       'editorial.correction_public_notes',
       'SELECT'
     )
     or has_table_privilege(
       'authenticated',
       'editorial.correction_public_notes',
       'INSERT'
     )
     or has_table_privilege(
       'authenticated',
       'editorial.correction_public_notes',
       'UPDATE'
     )
     or has_table_privilege(
       'authenticated',
       'editorial.correction_public_notes',
       'DELETE'
     )
  then
    raise exception
      'STOP: Browser role has direct correction public-note authority';
  end if;

  if not has_table_privilege(
       'service_role',
       'editorial.correction_public_notes',
       'SELECT'
     )
     or not has_table_privilege(
       'service_role',
       'editorial.correction_public_notes',
       'INSERT'
     )
     or not has_table_privilege(
       'service_role',
       'editorial.correction_public_notes',
       'UPDATE'
     )
     or not has_table_privilege(
       'service_role',
       'editorial.correction_public_notes',
       'DELETE'
     )
  then
    raise exception
      'STOP: service_role public-note table authority is incomplete';
  end if;

  if (
    select count(*)
    from platform_private.command_types
    where command_type like 'correction.%'
  ) <> 17 then
    raise exception
      'STOP: Migration 4 must leave exactly 17 correction command types';
  end if;

  if not exists (
    select 1
    from platform_private.command_types
    where command_type =
        'correction.note.publish'
      and job_type =
        'correction.note.publish.sync'
      and accepted_event_type =
        'correction.note.publish.accepted'
      and success_event_type =
        'correction.note.publish.succeeded'
      and failure_event_type =
        'correction.note.publish.failed'
      and retry_event_type =
        'correction.note.publish.retry_scheduled'
      and enabled
  ) then
    raise exception
      'STOP: correction.note.publish registry row is invalid';
  end if;

  if not exists (
    select 1
    from platform_private.command_types
    where command_type =
        'correction.contributor_notification.request'
      and job_type =
        'correction.contributor_notification'
      and accepted_event_type =
        'correction.contributor_notification.requested'
      and success_event_type =
        'correction.contributor_notification.succeeded'
      and failure_event_type =
        'correction.contributor_notification.failed'
      and retry_event_type =
        'correction.contributor_notification.retry_scheduled'
      and enabled
  ) then
    raise exception
      'STOP: Contributor notification command registry row is invalid';
  end if;

  foreach v_function in array array[
    'editorial.correction_public_note_fingerprint(uuid,uuid,uuid,uuid,uuid,text)',
    'editorial.correction_article_publication_proof(uuid)',
    'editorial.protect_correction_public_note()',
    'editorial.assert_correction_public_note_integrity()',
    'platform_private.append_correction_public_event(uuid,text,bigint,bigint,text,text,uuid,text,uuid,uuid,uuid,uuid,uuid,uuid,jsonb)',
    'platform_private.request_correction_contributor_notification(uuid,uuid,uuid,uuid,uuid,uuid,text,text,uuid,uuid,bigint,text,uuid)',
    'platform_private.get_correction_case_workspace_application_base(uuid)'
  ]
  loop
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
        'STOP: Private Migration 4 helper grants are invalid: %',
        v_function;
    end if;
  end loop;

  foreach v_function in array array[
    'public.publish_correction_note(uuid,bigint,uuid,uuid,text,uuid,text,text,text,uuid)',
    'public.close_correction_case(uuid,bigint,text,text,uuid,text,text,text,text)',
    'public.reopen_correction_case(uuid,bigint,text,text,uuid)',
    'public.get_correction_case_workspace(uuid)'
  ]
  loop
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
        'STOP: Internal Migration 4 RPC grants are invalid: %',
        v_function;
    end if;
  end loop;

  if not has_function_privilege(
       'anon',
       'public.public_get_article_correction_notes(text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.public_get_article_correction_notes(text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.public_get_article_correction_notes(text)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: Public correction-note read grants are invalid';
  end if;

  select pg_get_function_result(
    'public.public_get_article_correction_notes(text)'::regprocedure
  )
  into v_result;

  if v_result not like '%article_id uuid%'
     or v_result not like '%article_resource_id uuid%'
     or v_result not like '%case_reference text%'
     or v_result not like '%correction_note_id uuid%'
     or v_result not like '%challenged_version_id uuid%'
     or v_result not like '%corrected_version_id uuid%'
     or v_result not like '%note_text text%'
     or v_result not like '%note_published_at timestamp with time zone%'
     or v_result like '%case_resource_id%'
     or v_result like '%contributor%'
     or v_result like '%receipt%'
  then
    raise exception
      'STOP: Public correction-note return allowlist is invalid: %',
      v_result;
  end if;

  if exists (
    select 1
    from editorial.correction_cases
  ) or exists (
    select 1
    from editorial.correction_public_notes
  ) or exists (
    select 1
    from platform_private.command_receipts
    where command_type like 'correction.%'
  ) then
    raise exception
      'STOP: Migration 4 created production correction rows';
  end if;
end;
$verify_phase_3b_m4_structure$;

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
  '00000000-0000-4000-8000-000000000901',
  'authenticated',
  'authenticated',
  'phase3b-m4-verifier@local.invalid',
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
  '00000000-0000-4000-8000-000000000911',
  'phase3b-m4-verifier-article',
  'Phase 3B Migration 4 Original Article',
  'Original verifier excerpt.',
  '<p>Original verifier content.</p>',
  'Verifier Author',
  'publish',
  '2026-08-04T12:00:00Z'::timestamptz,
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
  '00000000-0000-4000-8000-000000000921',
  'article',
  'public',
  'published',
  '00000000-0000-4000-8000-000000000901',
  '00000000-0000-4000-8000-000000000901'
);

insert into editorial.article_resources (
  resource_id,
  resource_kind,
  article_id
)
values (
  '00000000-0000-4000-8000-000000000921',
  'article',
  '00000000-0000-4000-8000-000000000911'
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
  '00000000-0000-4000-8000-000000000931',
  '00000000-0000-4000-8000-000000000921',
  article.id,
  1,
  'published',
  1,
  article.title,
  article.slug,
  article.excerpt,
  article.content_html,
  article.author,
  '00000000-0000-4000-8000-000000000901',
  article.seo,
  'published',
  article.wp_status,
  article.published_at,
  article.categories,
  article.tags,
  '00000000-0000-4000-8000-000000000901',
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
  '00000000-0000-4000-8000-000000000911';

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
  version_id,
  '00000000-0000-4000-8000-000000000921',
  '00000000-0000-4000-8000-000000000911',
  version_number,
  'correction',
  version_number,
  'Phase 3B Migration 4 Corrected Article',
  'phase3b-m4-verifier-article',
  'Corrected verifier excerpt.',
  '<p>Corrected verifier content.</p>',
  'Verifier Author',
  '00000000-0000-4000-8000-000000000901',
  jsonb_build_object(
    'title',
    'Corrected verifier Article'
  ),
  'published',
  'publish',
  '2026-08-04T12:00:00Z'::timestamptz,
  '[]'::jsonb,
  '[]'::jsonb,
  '00000000-0000-4000-8000-000000000901',
  editorial.article_snapshot_fingerprint(
    'Phase 3B Migration 4 Corrected Article',
    'phase3b-m4-verifier-article',
    'Corrected verifier excerpt.',
    '<p>Corrected verifier content.</p>',
    'Verifier Author',
    null,
    null,
    jsonb_build_object(
      'title',
      'Corrected verifier Article'
    ),
    'publish',
    '2026-08-04T12:00:00Z'::timestamptz,
    '[]'::jsonb,
    '[]'::jsonb
  )
from (
  values
    (
      '00000000-0000-4000-8000-000000000932'::uuid,
      2::bigint
    ),
    (
      '00000000-0000-4000-8000-000000000933'::uuid,
      3::bigint
    ),
    (
      '00000000-0000-4000-8000-000000000934'::uuid,
      4::bigint
    )
) correction_version(
  version_id,
  version_number
);

update editorial.resources
set
  current_published_version_id =
    '00000000-0000-4000-8000-000000000931',
  current_working_version_id =
    '00000000-0000-4000-8000-000000000931'
where id =
  '00000000-0000-4000-8000-000000000921';

insert into public.community_contributions (
  id,
  user_id,
  entity_type,
  entity_id,
  entity_slug,
  contribution_type,
  payload,
  status,
  created_at,
  updated_at
)
values (
  '00000000-0000-4000-8000-000000000990',
  '00000000-0000-4000-8000-000000000901',
  'article',
  '00000000-0000-4000-8000-000000000911',
  'phase3b-m4-verifier-article',
  'bio_correction',
  jsonb_build_object(
    'description',
    'The verifier Article contains a factual error.',
    'submitted_value',
    'Original verifier value',
    'suggested_value',
    'Corrected verifier value'
  ),
  'pending',
  now(),
  now()
);

create or replace function
  pg_temp.create_m4_applied_case(
    p_case_id uuid,
    p_target_id uuid,
    p_decision_id uuid,
    p_application_id uuid,
    p_application_receipt_id uuid,
    p_application_resulting_version_id uuid,
    p_origin_type text,
    p_origin_contribution_id uuid,
    p_origin_submitter_user_id uuid,
    p_summary text,
    p_key_suffix text
  )
returns void
language plpgsql
set search_path =
  pg_catalog,
  auth,
  editorial,
  platform_private,
  public
as $function$
declare
  v_actor constant uuid :=
    '00000000-0000-4000-8000-000000000901';
  v_article_resource constant uuid :=
    '00000000-0000-4000-8000-000000000921';
  v_challenged_version constant uuid :=
    '00000000-0000-4000-8000-000000000931';
  v_expected_working_fingerprint text;
begin
  select version.content_fingerprint
  into v_expected_working_fingerprint
  from editorial.article_versions version
  where version.id =
    v_challenged_version;

  insert into editorial.resources (
    id,
    resource_kind,
    visibility,
    lifecycle_state,
    created_by
  )
  values (
    p_case_id,
    'correction_case',
    'internal',
    'active',
    v_actor
  );

  insert into editorial.correction_cases (
    resource_id,
    origin_type,
    origin_contribution_id,
    origin_submitter_user_id,
    origin_submitted_at,
    origin_type_snapshot,
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
    current_decision_id,
    current_application_id,
    created_by,
    updated_by
  )
  values (
    p_case_id,
    p_origin_type,
    p_origin_contribution_id,
    p_origin_submitter_user_id,
    case
      when p_origin_type =
        'community_contribution'
      then now()
      else null
    end,
    case
      when p_origin_type =
        'community_contribution'
      then 'bio_correction'
      else null
    end,
    p_summary,
    'factual_error',
    'high',
    'applied',
    6,
    v_actor,
    'Verifier assignment.',
    now(),
    'Verifier triage.',
    v_actor,
    now(),
    'Verifier investigation summary.',
    'Apply the corrected Article snapshot.',
    true,
    v_actor,
    now(),
    p_decision_id,
    p_application_id,
    v_actor,
    v_actor
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
    p_target_id,
    p_case_id,
    v_article_resource,
    'article',
    'article_version',
    v_challenged_version,
    'primary',
    'Verifier challenged published Article.',
    1,
    version.content_fingerprint,
    v_actor
  from editorial.article_versions version
  where version.id =
    v_challenged_version;

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
    p_decision_id,
    p_case_id,
    1,
    'correction_required',
    'Verifier correction-required decision.',
    'Verifier private analysis.',
    'Verifier public-safe explanation.',
    4,
    jsonb_build_object(
      'target_resource_id',
      v_article_resource,
      'target_version_id',
      v_challenged_version
    ),
    v_actor,
    gen_random_uuid()
  );

  insert into platform_private.command_receipts (
    id,
    command_type,
    resource_id,
    principal_key,
    actor_user_id,
    idempotency_key,
    request_fingerprint,
    request_payload,
    status,
    result_payload,
    accepted_at,
    completed_at
  )
  values (
    p_application_receipt_id,
    'correction.article.apply',
    p_case_id,
    'service:service_role',
    v_actor,
    'verify-m4-application-' ||
      p_key_suffix,
    repeat('a', 64),
    jsonb_build_object(
      'fixture',
      p_key_suffix
    ),
    'succeeded',
    jsonb_build_object(
      'case_resource_id',
      p_case_id,
      'case_revision',
      6,
      'case_state',
      'applied',
      'application_id',
      p_application_id,
      'resulting_version_id',
      p_application_resulting_version_id
    ),
    now(),
    now()
  );

  insert into editorial.correction_applications (
    id,
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
    p_application_id,
    p_case_id,
    p_decision_id,
    p_application_receipt_id,
    p_target_id,
    v_article_resource,
    v_challenged_version,
    v_challenged_version,
    v_challenged_version,
    v_expected_working_fingerprint,
    p_application_resulting_version_id,
    'Verifier successful correction application.',
    v_actor,
    gen_random_uuid()
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
    decision_id,
    application_id,
    target_id,
    command_receipt_id,
    metadata
  )
  values
    (
      p_case_id,
      1,
      'case_created',
      1,
      1,
      null,
      'submitted',
      v_actor,
      'Verifier case created.',
      null,
      null,
      null,
      null,
      '{}'::jsonb
    ),
    (
      p_case_id,
      2,
      'case_triaged',
      1,
      2,
      'submitted',
      'triaged',
      v_actor,
      'Verifier case triaged.',
      null,
      null,
      p_target_id,
      null,
      '{}'::jsonb
    ),
    (
      p_case_id,
      3,
      'investigator_assigned',
      2,
      3,
      'triaged',
      'investigating',
      v_actor,
      'Verifier investigator assigned.',
      null,
      null,
      null,
      null,
      '{}'::jsonb
    ),
    (
      p_case_id,
      4,
      'submitted_for_decision',
      3,
      4,
      'investigating',
      'awaiting_decision',
      v_actor,
      'Verifier submitted for decision.',
      null,
      null,
      null,
      null,
      '{}'::jsonb
    ),
    (
      p_case_id,
      5,
      'decision_recorded',
      4,
      5,
      'awaiting_decision',
      'decided',
      v_actor,
      'Verifier decision recorded.',
      p_decision_id,
      null,
      null,
      null,
      '{}'::jsonb
    ),
    (
      p_case_id,
      6,
      'application_accepted',
      5,
      5,
      'decided',
      'decided',
      v_actor,
      'Verifier application accepted.',
      p_decision_id,
      null,
      p_target_id,
      p_application_receipt_id,
      '{}'::jsonb
    ),
    (
      p_case_id,
      7,
      'application_succeeded',
      5,
      6,
      'decided',
      'applied',
      v_actor,
      'Verifier application succeeded.',
      p_decision_id,
      p_application_id,
      p_target_id,
      p_application_receipt_id,
      '{}'::jsonb
    );

  update editorial.resources
  set
    current_published_version_id =
      v_challenged_version,
    current_working_version_id =
      p_application_resulting_version_id
  where id =
    v_article_resource;
end;
$function$;

select pg_temp.create_m4_applied_case(
  '00000000-0000-4000-8000-000000000941',
  '00000000-0000-4000-8000-000000000951',
  '00000000-0000-4000-8000-000000000961',
  '00000000-0000-4000-8000-000000000971',
  '00000000-0000-4000-8000-000000000981',
  '00000000-0000-4000-8000-000000000932',
  'internal_editorial',
  null,
  null,
  'Verifier internal public-note case.',
  'internal-note'
);

set constraints all immediate;
set constraints all deferred;

select pg_temp.create_m4_applied_case(
  '00000000-0000-4000-8000-000000000942',
  '00000000-0000-4000-8000-000000000952',
  '00000000-0000-4000-8000-000000000962',
  '00000000-0000-4000-8000-000000000972',
  '00000000-0000-4000-8000-000000000982',
  '00000000-0000-4000-8000-000000000933',
  'community_contribution',
  '00000000-0000-4000-8000-000000000990',
  '00000000-0000-4000-8000-000000000901',
  'Verifier community public-note case.',
  'community-note'
);

set constraints all immediate;
set constraints all deferred;

select pg_temp.create_m4_applied_case(
  '00000000-0000-4000-8000-000000000943',
  '00000000-0000-4000-8000-000000000953',
  '00000000-0000-4000-8000-000000000963',
  '00000000-0000-4000-8000-000000000973',
  '00000000-0000-4000-8000-000000000983',
  '00000000-0000-4000-8000-000000000934',
  'internal_editorial',
  null,
  null,
  'Verifier internal no-note closure case.',
  'internal-no-note'
);

set constraints all immediate;
set constraints all deferred;

update public.wk_articles
set
  title =
    'Phase 3B Migration 4 Corrected Article',
  excerpt =
    'Corrected verifier excerpt.',
  content_html =
    '<p>Corrected verifier content.</p>',
  seo =
    jsonb_build_object(
      'title',
      'Corrected verifier Article'
    ),
  draft_version = 4,
  modified_at = now(),
  updated_at = now()
where id =
  '00000000-0000-4000-8000-000000000911';

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
  '00000000-0000-4000-8000-000000000935',
  '00000000-0000-4000-8000-000000000921',
  article.id,
  5,
  'published',
  4,
  article.title,
  article.slug,
  article.excerpt,
  article.content_html,
  article.author,
  '00000000-0000-4000-8000-000000000901',
  article.seo,
  'published',
  article.wp_status,
  article.published_at,
  article.categories,
  article.tags,
  '00000000-0000-4000-8000-000000000901',
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
  '00000000-0000-4000-8000-000000000911';

update editorial.resources
set
  current_published_version_id =
    '00000000-0000-4000-8000-000000000935',
  current_working_version_id =
    '00000000-0000-4000-8000-000000000934',
  lifecycle_state =
    'published',
  visibility =
    'public',
  updated_at = now()
where id =
  '00000000-0000-4000-8000-000000000921';

insert into public.wk_article_publication_snapshots (
  article_id,
  resource_id,
  version_id,
  slug,
  title,
  excerpt,
  content_html,
  author,
  published_at,
  modified_at,
  categories,
  tags,
  seo,
  hero_image_id,
  hero_image_url,
  raw_meta,
  wp_status,
  first_published_at,
  last_materially_updated_at,
  published_by,
  is_active
)
select
  article.id,
  '00000000-0000-4000-8000-000000000921',
  '00000000-0000-4000-8000-000000000935',
  article.slug,
  article.title,
  article.excerpt,
  article.content_html,
  article.author,
  article.published_at,
  article.modified_at,
  article.categories,
  article.tags,
  article.seo,
  article.hero_image_id,
  article.hero_image_url,
  coalesce(
    article.raw_meta,
    '{}'::jsonb
  ),
  article.wp_status,
  article.published_at,
  article.modified_at,
  '00000000-0000-4000-8000-000000000901',
  true
from public.wk_articles article
where article.id =
  '00000000-0000-4000-8000-000000000911';

insert into editorial.article_lifecycle_events (
  resource_id,
  article_id,
  version_id,
  action,
  prior_status,
  resulting_status,
  note,
  actor_id
)
values (
  '00000000-0000-4000-8000-000000000921',
  '00000000-0000-4000-8000-000000000911',
  '00000000-0000-4000-8000-000000000935',
  'published',
  'approved',
  'publish',
  'Verifier corrected Article publication.',
  '00000000-0000-4000-8000-000000000901'
);

set constraints all immediate;
set constraints all deferred;
do $verify_phase_3b_m4_runtime$
declare
  v_actor constant uuid :=
    '00000000-0000-4000-8000-000000000901';
  v_article_id constant uuid :=
    '00000000-0000-4000-8000-000000000911';
  v_resource_id constant uuid :=
    '00000000-0000-4000-8000-000000000921';
  v_challenged_version_id constant uuid :=
    '00000000-0000-4000-8000-000000000931';
  v_corrected_published_version_id constant uuid :=
    '00000000-0000-4000-8000-000000000935';

  v_internal_case constant uuid :=
    '00000000-0000-4000-8000-000000000941';
  v_internal_target constant uuid :=
    '00000000-0000-4000-8000-000000000951';
  v_internal_decision constant uuid :=
    '00000000-0000-4000-8000-000000000961';
  v_internal_application constant uuid :=
    '00000000-0000-4000-8000-000000000971';

  v_community_case constant uuid :=
    '00000000-0000-4000-8000-000000000942';
  v_community_target constant uuid :=
    '00000000-0000-4000-8000-000000000952';
  v_community_decision constant uuid :=
    '00000000-0000-4000-8000-000000000962';
  v_community_application constant uuid :=
    '00000000-0000-4000-8000-000000000972';

  v_no_note_case constant uuid :=
    '00000000-0000-4000-8000-000000000943';
  v_no_note_application constant uuid :=
    '00000000-0000-4000-8000-000000000973';

  v_command record;
  v_replay record;
  v_receipt_id uuid;
  v_note_id uuid;
  v_first_note_id uuid;
  v_second_note_id uuid;
  v_community_note_id uuid;
  v_child_receipt_id uuid;
  v_job_id uuid;
  v_requested_at timestamptz;
  v_error_code text;
  v_count bigint;
  v_event_number_one bigint;
  v_event_number_two bigint;
  v_case_before jsonb;
  v_note_count_before bigint;
  v_job_count_before bigint;
  v_corr uuid;
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

  if (
    select count(*)
    from editorial.correction_article_publication_proof(
      v_internal_application
    )
  ) <> 1
     or (
       select proof.corrected_version_id
       from editorial.correction_article_publication_proof(
         v_internal_application
       ) proof
     ) is distinct from
       v_corrected_published_version_id
  then
    raise exception
      'STOP: Corrected publication proof does not bind correction and published lifecycle versions';
  end if;

  select to_jsonb(correction_case)
  into v_case_before
  from editorial.correction_cases correction_case
  where correction_case.resource_id =
    v_internal_case;

  select count(*)
  into v_note_count_before
  from editorial.correction_public_notes
  where case_resource_id =
    v_internal_case;

  v_corr := gen_random_uuid();

  select *
  into v_command
  from public.publish_correction_note(
    v_internal_case,
    5,
    v_internal_application,
    v_corrected_published_version_id,
    'Stale verifier public correction note.',
    null,
    null,
    null,
    'verify-m4-stale-note',
    v_corr
  );

  if v_command.receipt_status <>
       'rejected'
     or v_command.case_revision <> 6
     or v_command.idempotent_replay
  then
    raise exception
      'STOP: Stale note publication was not durably rejected';
  end if;

  v_receipt_id :=
    v_command.command_receipt_id;

  select receipt.error_code
  into v_error_code
  from platform_private.command_receipts receipt
  where receipt.id =
    v_receipt_id;

  if v_error_code <>
     'case_revision_changed'
     or (
       select to_jsonb(correction_case)
       from editorial.correction_cases correction_case
       where correction_case.resource_id =
         v_internal_case
     ) is distinct from v_case_before
     or (
       select count(*)
       from editorial.correction_public_notes
       where case_resource_id =
         v_internal_case
     ) <> v_note_count_before
  then
    raise exception
      'STOP: Stale note publication changed canonical state';
  end if;

  select *
  into v_replay
  from public.publish_correction_note(
    v_internal_case,
    5,
    v_internal_application,
    v_corrected_published_version_id,
    'Stale verifier public correction note.',
    null,
    null,
    null,
    'verify-m4-stale-note',
    v_corr
  );

  if v_replay.command_receipt_id
       is distinct from v_receipt_id
     or not v_replay.idempotent_replay
     or v_replay.receipt_status <>
       'rejected'
  then
    raise exception
      'STOP: Rejected note publication replay is invalid';
  end if;

  begin
    perform 1
    from public.publish_correction_note(
      v_internal_case,
      5,
      v_internal_application,
      v_corrected_published_version_id,
      'Conflicting verifier public correction note.',
      null,
      null,
      null,
      'verify-m4-stale-note',
      v_corr
    );

    raise exception
      'STOP: Conflicting note idempotency reuse was accepted';
  exception
    when unique_violation then
      null;
  end;

  v_corr := gen_random_uuid();

  select *
  into v_command
  from public.publish_correction_note(
    v_internal_case,
    6,
    v_internal_application,
    v_corrected_published_version_id,
    'We corrected the factual statement in this Article.',
    null,
    null,
    null,
    'verify-m4-internal-note',
    v_corr
  );

  if v_command.receipt_status <>
       'succeeded'
     or v_command.case_revision <> 7
     or v_command.idempotent_replay
  then
    raise exception
      'STOP: Valid internal correction note publication failed';
  end if;

  v_receipt_id :=
    v_command.command_receipt_id;
  v_first_note_id :=
    (
      v_command.result_payload ->>
        'public_note_id'
    )::uuid;

  set constraints all immediate;
  set constraints all deferred;

  if not exists (
    select 1
    from editorial.correction_public_notes note
    where note.id =
        v_first_note_id
      and note.case_resource_id =
        v_internal_case
      and note.application_id =
        v_internal_application
      and note.corrected_version_id =
        v_corrected_published_version_id
      and note.note_text =
        'We corrected the factual statement in this Article.'
  )
     or (
       select correction_case.public_note_disposition
       from editorial.correction_cases correction_case
       where correction_case.resource_id =
         v_internal_case
     ) <> 'published'
  then
    raise exception
      'STOP: Internal public note or case disposition is invalid';
  end if;

  if exists (
    select 1
    from platform_private.jobs job
    join platform_private.command_receipts receipt
      on receipt.id =
        job.command_receipt_id
    where receipt.resource_id =
        v_internal_case
      and receipt.command_type =
        'correction.contributor_notification.request'
  ) then
    raise exception
      'STOP: Internal correction note created contributor follow-up work';
  end if;

  select *
  into v_replay
  from public.publish_correction_note(
    v_internal_case,
    6,
    v_internal_application,
    v_corrected_published_version_id,
    'We corrected the factual statement in this Article.',
    null,
    null,
    null,
    'verify-m4-internal-note',
    v_corr
  );

  if v_replay.command_receipt_id
       is distinct from v_receipt_id
     or not v_replay.idempotent_replay
     or v_replay.receipt_status <>
       'succeeded'
  then
    raise exception
      'STOP: Successful note publication replay is invalid';
  end if;

  select *
  into v_command
  from public.publish_correction_note(
    v_internal_case,
    7,
    v_internal_application,
    v_corrected_published_version_id,
    'We corrected the factual statement and clarified the public explanation.',
    v_first_note_id,
    null,
    null,
    'verify-m4-supersede-note',
    gen_random_uuid()
  );

  if v_command.receipt_status <>
       'succeeded'
     or v_command.case_revision <> 8
  then
    raise exception
      'STOP: Public correction-note supersession failed';
  end if;

  v_second_note_id :=
    (
      v_command.result_payload ->>
        'public_note_id'
    )::uuid;
  v_receipt_id :=
    v_command.command_receipt_id;

  select event.event_number
  into v_event_number_one
  from editorial.correction_events event
  where event.case_resource_id =
      v_internal_case
    and event.command_receipt_id =
      v_receipt_id
    and event.event_type =
      'public_note_superseded';

  select event.event_number
  into v_event_number_two
  from editorial.correction_events event
  where event.case_resource_id =
      v_internal_case
    and event.command_receipt_id =
      v_receipt_id
    and event.event_type =
      'public_note_published';

  if v_event_number_one is null
     or v_event_number_two is null
     or v_event_number_one >=
       v_event_number_two
     or (
       select count(*)
       from editorial.correction_events event
       where event.case_resource_id =
           v_internal_case
         and event.command_receipt_id =
           v_receipt_id
         and event.event_type in (
           'public_note_superseded',
           'public_note_published'
         )
         and event.case_revision_before = 7
         and event.case_revision_after = 8
         and event.prior_state = 'applied'
         and event.resulting_state = 'applied'
     ) <> 2
  then
    raise exception
      'STOP: Public correction-note supersession history is invalid';
  end if;

  if (
    select count(*)
    from public.public_get_article_correction_notes(
      'phase3b-m4-verifier-article'
    ) public_note
    where public_note.correction_note_id =
      v_second_note_id
  ) <> 1
     or exists (
       select 1
       from public.public_get_article_correction_notes(
         'phase3b-m4-verifier-article'
       ) public_note
       where public_note.correction_note_id =
         v_first_note_id
     )
  then
    raise exception
      'STOP: Public correction-note read did not expose only the latest note';
  end if;

  begin
    update editorial.correction_public_notes
    set note_text =
      'Forbidden public-note rewrite.'
    where id =
      v_second_note_id;

    raise exception
      'STOP: Immutable public note was updated';
  exception
    when others then
      if position(
        'immutable'
        in lower(sqlerrm)
      ) = 0 then
        raise;
      end if;
  end;

  begin
    delete from editorial.correction_public_notes
    where id =
      v_second_note_id;

    raise exception
      'STOP: Immutable public note was deleted';
  exception
    when others then
      if position(
        'immutable'
        in lower(sqlerrm)
      ) = 0 then
        raise;
      end if;
  end;

  update editorial.correction_public_notes
  set published_by = null
  where id =
    v_second_note_id;

  if not exists (
    select 1
    from editorial.correction_public_notes note
    where note.id =
        v_second_note_id
      and note.published_by is null
      and note.note_text =
        'We corrected the factual statement and clarified the public explanation.'
  ) then
    raise exception
      'STOP: Historical publisher deletion nulling changed immutable note content';
  end if;

  select count(*)
  into v_job_count_before
  from platform_private.jobs job
  join platform_private.command_receipts receipt
    on receipt.id =
      job.command_receipt_id
  where receipt.resource_id =
      v_community_case
    and receipt.command_type =
      'correction.contributor_notification.request';

  select *
  into v_command
  from public.publish_correction_note(
    v_community_case,
    6,
    v_community_application,
    v_corrected_published_version_id,
    'We applied and published the correction submitted by a community contributor.',
    null,
    'requested',
    null,
    'verify-m4-community-note',
    gen_random_uuid()
  );

  if v_command.receipt_status <>
       'succeeded'
     or v_command.case_revision <> 7
  then
    raise exception
      'STOP: Community-origin correction note publication failed';
  end if;

  v_community_note_id :=
    (
      v_command.result_payload ->>
        'public_note_id'
    )::uuid;
  v_job_id :=
    (
      v_command.result_payload ->>
        'contributor_follow_up_job_id'
    )::uuid;
  v_child_receipt_id :=
    (
      v_command.result_payload ->>
        'contributor_follow_up_command_receipt_id'
    )::uuid;

  set constraints all immediate;
  set constraints all deferred;

  select correction_case.contributor_follow_up_requested_at
  into v_requested_at
  from editorial.correction_cases correction_case
  where correction_case.resource_id =
    v_community_case;

  if v_job_id is null
     or v_child_receipt_id is null
     or v_requested_at is null
     or (
       select count(*)
       from platform_private.jobs job
       where job.id = v_job_id
         and job.command_receipt_id =
           v_child_receipt_id
         and job.resource_id =
           v_community_case
         and job.command_type =
           'correction.contributor_notification.request'
         and job.job_type =
           'correction.contributor_notification'
         and job.status = 'queued'
     ) <> 1
     or (
       select count(*)
       from platform_private.command_receipts receipt
       where receipt.id =
           v_child_receipt_id
         and receipt.resource_id =
           v_community_case
         and receipt.command_type =
           'correction.contributor_notification.request'
         and receipt.status = 'accepted'
     ) <> 1
     or (
       select count(*)
       from platform_private.outbox_events outbox_event
       where outbox_event.command_receipt_id =
           v_child_receipt_id
         and outbox_event.job_id is null
         and outbox_event.event_type =
           'correction.contributor_notification.requested'
     ) <> 1
     or (
       select count(*)
       from editorial.correction_events event
       where event.case_resource_id =
           v_community_case
         and event.command_receipt_id =
           v_child_receipt_id
         and event.event_type =
           'contributor_notification_requested'
         and event.application_id =
           v_community_application
         and event.public_note_id =
           v_community_note_id
     ) <> 1
     or (
       select count(*)
       from platform_private.jobs job
       join platform_private.command_receipts receipt
         on receipt.id =
           job.command_receipt_id
       where receipt.resource_id =
           v_community_case
         and receipt.command_type =
           'correction.contributor_notification.request'
     ) <> v_job_count_before + 1
  then
    raise exception
      'STOP: Community contributor follow-up authority is incomplete';
  end if;

  select to_jsonb(correction_case)
  into v_case_before
  from editorial.correction_cases correction_case
  where correction_case.resource_id =
    v_community_case;

  update editorial.resources
  set current_published_version_id =
    v_challenged_version_id
  where id = v_resource_id;

  select *
  into v_command
  from public.close_correction_case(
    v_community_case,
    7,
    'Verifier stale publication closure.',
    'verify-m4-close-before-publication',
    gen_random_uuid()
  );

  if v_command.receipt_status <>
       'rejected'
  then
    raise exception
      'STOP: Correction-required closure succeeded without publication proof';
  end if;

  select receipt.error_code
  into v_error_code
  from platform_private.command_receipts receipt
  where receipt.id =
    v_command.command_receipt_id;

  if v_error_code <>
     'publication_proof_missing'
     or (
       select to_jsonb(correction_case)
       from editorial.correction_cases correction_case
       where correction_case.resource_id =
         v_community_case
     ) is distinct from v_case_before
  then
    raise exception
      'STOP: Missing publication proof rejection changed correction state';
  end if;

  update editorial.resources
  set current_published_version_id =
    v_corrected_published_version_id
  where id = v_resource_id;

  insert into editorial.correction_related_resource_reviews (
    id,
    case_resource_id,
    related_resource_id,
    related_resource_kind,
    review_state,
    review_revision,
    created_by,
    updated_by
  )
  values (
    '00000000-0000-4000-8000-000000000995',
    v_community_case,
    v_resource_id,
    'article',
    'pending',
    1,
    v_actor,
    v_actor
  );

  select *
  into v_command
  from public.close_correction_case(
    v_community_case,
    7,
    'Verifier pending-related-review closure.',
    'verify-m4-close-pending-review',
    gen_random_uuid()
  );

  if v_command.receipt_status <>
       'rejected'
  then
    raise exception
      'STOP: Correction-required closure succeeded with a pending related review';
  end if;

  select receipt.error_code
  into v_error_code
  from platform_private.command_receipts receipt
  where receipt.id =
    v_command.command_receipt_id;

  if v_error_code <>
     'related_reviews_pending'
  then
    raise exception
      'STOP: Pending related review used the wrong rejection code';
  end if;

  delete from editorial.correction_related_resource_reviews
  where id =
    '00000000-0000-4000-8000-000000000995';

  update editorial.correction_cases
  set
    contributor_follow_up_disposition = null,
    contributor_follow_up_reason = null,
    contributor_follow_up_job_id = null,
    contributor_follow_up_requested_at = null
  where resource_id =
    v_community_case;

  select *
  into v_command
  from public.close_correction_case(
    v_community_case,
    7,
    'Verifier missing contributor follow-up closure.',
    'verify-m4-close-missing-follow-up',
    gen_random_uuid()
  );

  if v_command.receipt_status <>
       'rejected'
  then
    raise exception
      'STOP: Community-origin closure succeeded without contributor follow-up proof';
  end if;

  select receipt.error_code
  into v_error_code
  from platform_private.command_receipts receipt
  where receipt.id =
    v_command.command_receipt_id;

  if v_error_code <>
     'contributor_follow_up_required'
  then
    raise exception
      'STOP: Missing contributor follow-up used the wrong rejection code';
  end if;

  update editorial.correction_cases
  set
    contributor_follow_up_disposition =
      'requested',
    contributor_follow_up_reason = null,
    contributor_follow_up_job_id =
      v_job_id,
    contributor_follow_up_requested_at =
      v_requested_at
  where resource_id =
    v_community_case;

  v_corr := gen_random_uuid();

  select *
  into v_command
  from public.close_correction_case(
    v_community_case,
    7,
    'Close the verified community-origin correction case.',
    'verify-m4-close-community',
    v_corr
  );

  if v_command.receipt_status <>
       'succeeded'
     or v_command.case_revision <> 8
  then
    raise exception
      'STOP: Valid correction-required community closure failed';
  end if;

  v_receipt_id :=
    v_command.command_receipt_id;

  set constraints all immediate;
  set constraints all deferred;

  if not exists (
    select 1
    from editorial.correction_cases correction_case
    where correction_case.resource_id =
        v_community_case
      and correction_case.case_state =
        'closed'
      and correction_case.current_revision = 8
      and correction_case.public_note_disposition =
        'published'
      and correction_case.contributor_follow_up_disposition =
        'requested'
      and correction_case.contributor_follow_up_job_id =
        v_job_id
  )
     or (
       select count(*)
       from editorial.correction_events event
       where event.case_resource_id =
           v_community_case
         and event.command_receipt_id =
           v_receipt_id
         and event.event_type =
           'case_closed'
         and event.case_revision_before = 7
         and event.case_revision_after = 8
         and event.prior_state = 'applied'
         and event.resulting_state = 'closed'
     ) <> 1
     or (
       select count(*)
       from platform_private.outbox_events outbox_event
       where outbox_event.command_receipt_id =
           v_receipt_id
         and outbox_event.event_type in (
           'correction.case.close.accepted',
           'correction.case.close.succeeded'
         )
     ) <> 2
  then
    raise exception
      'STOP: Valid correction-required closure history is incomplete';
  end if;

  select *
  into v_replay
  from public.close_correction_case(
    v_community_case,
    7,
    'Close the verified community-origin correction case.',
    'verify-m4-close-community',
    v_corr
  );

  if v_replay.command_receipt_id
       is distinct from v_receipt_id
     or not v_replay.idempotent_replay
     or v_replay.receipt_status <>
       'succeeded'
  then
    raise exception
      'STOP: Correction-required closure replay is invalid';
  end if;

  select *
  into v_command
  from public.close_correction_case(
    p_case_resource_id =>
      v_no_note_case,
    p_expected_case_revision =>
      6,
    p_reason =>
      'Close the verified no-note correction case.',
    p_idempotency_key =>
      'verify-m4-close-no-note',
    p_correlation_id =>
      gen_random_uuid(),
    p_public_note_disposition =>
      'not_required',
    p_public_note_no_note_reason =>
      'The corrected statement is not material enough to require a separate public note.'
  );

  if v_command.receipt_status <>
       'succeeded'
     or v_command.case_revision <> 7
  then
    raise exception
      'STOP: Governed no-note correction-required closure failed';
  end if;

  set constraints all immediate;
  set constraints all deferred;

  if not exists (
    select 1
    from editorial.correction_cases correction_case
    where correction_case.resource_id =
        v_no_note_case
      and correction_case.case_state =
        'closed'
      and correction_case.public_note_disposition =
        'not_required'
      and correction_case.public_note_no_note_reason =
        'The corrected statement is not material enough to require a separate public note.'
      and correction_case.contributor_follow_up_disposition is null
  )
     or exists (
       select 1
       from editorial.correction_public_notes note
       where note.case_resource_id =
         v_no_note_case
     )
     or exists (
       select 1
       from platform_private.jobs job
       join platform_private.command_receipts receipt
         on receipt.id =
           job.command_receipt_id
       where receipt.resource_id =
           v_no_note_case
         and receipt.command_type =
           'correction.contributor_notification.request'
     )
  then
    raise exception
      'STOP: Governed no-note closure state is invalid';
  end if;

  select *
  into v_command
  from public.reopen_correction_case(
    v_no_note_case,
    7,
    'Reopen the verifier no-note case for public disposition review.',
    'verify-m4-reopen-no-note',
    gen_random_uuid()
  );

  if v_command.receipt_status <>
       'succeeded'
     or v_command.case_revision <> 8
  then
    raise exception
      'STOP: Governed correction-case reopening failed';
  end if;

  set constraints all immediate;
  set constraints all deferred;

  if not exists (
    select 1
    from editorial.correction_cases correction_case
    where correction_case.resource_id =
        v_no_note_case
      and correction_case.case_state =
        'applied'
      and correction_case.current_application_id =
        v_no_note_application
      and correction_case.public_note_disposition is null
      and correction_case.public_note_no_note_reason is null
      and correction_case.contributor_follow_up_disposition is null
  )
     or (
       select count(*)
       from editorial.correction_applications application
       where application.case_resource_id =
         v_no_note_case
     ) <> 1
  then
    raise exception
      'STOP: Reopening did not retain the correction application while clearing closure dispositions';
  end if;

  v_workspace :=
    public.get_correction_case_workspace(
      v_community_case
    );

  if jsonb_array_length(
       v_workspace -> 'public_notes'
     ) <> 1
     or v_workspace #>>
       '{public_notes,0,id}'
       is distinct from
         v_community_note_id::text
     or v_workspace #>>
       '{contributor_follow_up_job,id}'
       is distinct from
         v_job_id::text
     or v_workspace #>>
       '{contributor_follow_up_job,status}'
       is distinct from
         'queued'
  then
    raise exception
      'STOP: Internal correction workspace note or contributor follow-up history is invalid';
  end if;

  if (
    select count(*)
    from public.public_get_article_correction_notes(
      'phase3b-m4-verifier-article'
    )
  ) <> 2
  then
    raise exception
      'STOP: Public Article correction-note read returned an invalid current-note count';
  end if;
end;
$verify_phase_3b_m4_runtime$;

select
  'PASS: Phase 3B public correction notes and contributor follow-up verified.'
  as result;

rollback;
