-- Verify Phase 3B Migration 2 correction evidence and decision authority.

begin;

do $verify_phase_3b_m2_structure$
declare
  v_name text;
  v_function text;
  v_trigger text;
  v_command_type text;
begin
  foreach v_name in array array[
    'editorial.correction_evidence_links',
    'editorial.correction_decisions',
    'editorial.correction_related_resource_reviews'
  ]
  loop
    if to_regclass(v_name) is null then
      raise exception
        'STOP: Missing Migration 2 table: %',
        v_name;
    end if;
  end loop;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'editorial'
      and table_name = 'correction_cases'
      and column_name = 'current_decision_id'
      and udt_name = 'uuid'
      and is_nullable = 'YES'
  ) then
    raise exception
      'STOP: correction_cases.current_decision_id is missing or invalid';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid =
        'editorial.correction_cases'::regclass
      and constraint_row.conname =
        'correction_cases_current_decision_fkey'
      and constraint_row.contype = 'f'
      and constraint_row.condeferrable
      and constraint_row.condeferred
  ) then
    raise exception
      'STOP: Current-decision foreign key is not deferred';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid =
        'editorial.correction_events'::regclass
      and constraint_row.conname =
        'correction_events_decision_fkey'
      and constraint_row.contype = 'f'
  ) then
    raise exception
      'STOP: Correction-event decision foreign key is missing';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid =
        'editorial.correction_events'::regclass
      and constraint_row.conname =
        'correction_events_related_review_fkey'
      and constraint_row.contype = 'f'
  ) then
    raise exception
      'STOP: Correction-event related-review foreign key is missing';
  end if;

  if exists (
    select 1
    from pg_constraint constraint_row
    join pg_attribute attribute_row
      on attribute_row.attrelid =
        constraint_row.conrelid
     and attribute_row.attnum =
       any(constraint_row.conkey)
    where constraint_row.conrelid =
        'editorial.correction_events'::regclass
      and constraint_row.contype = 'f'
      and attribute_row.attname =
        'evidence_link_id'
  ) then
    raise exception
      'STOP: Historical evidence_link_id must not have a foreign key';
  end if;

  foreach v_trigger in array array[
    'correction_evidence_links_integrity',
    'correction_evidence_links_no_update',
    'correction_evidence_links_case_integrity',
    'correction_decisions_integrity',
    'correction_decisions_append_only',
    'correction_decisions_case_integrity',
    'correction_related_reviews_touch_updated_at',
    'correction_related_reviews_case_integrity'
  ]
  loop
    if not exists (
      select 1
      from pg_trigger trigger_row
      where trigger_row.tgname = v_trigger
        and not trigger_row.tgisinternal
    ) then
      raise exception
        'STOP: Missing Migration 2 trigger: %',
        v_trigger;
    end if;
  end loop;

  foreach v_name in array array[
    'editorial.correction_evidence_links',
    'editorial.correction_decisions',
    'editorial.correction_related_resource_reviews'
  ]
  loop
    if not exists (
      select 1
      from pg_class relation
      where relation.oid = v_name::regclass
        and relation.relrowsecurity
    ) then
      raise exception
        'STOP: RLS is not enabled on %',
        v_name;
    end if;

    if has_table_privilege(
         'anon',
         v_name,
         'SELECT'
       )
       or has_table_privilege(
         'anon',
         v_name,
         'INSERT'
       )
       or has_table_privilege(
         'anon',
         v_name,
         'UPDATE'
       )
       or has_table_privilege(
         'anon',
         v_name,
         'DELETE'
       )
       or has_table_privilege(
         'authenticated',
         v_name,
         'SELECT'
       )
       or has_table_privilege(
         'authenticated',
         v_name,
         'INSERT'
       )
       or has_table_privilege(
         'authenticated',
         v_name,
         'UPDATE'
       )
       or has_table_privilege(
         'authenticated',
         v_name,
         'DELETE'
       )
    then
      raise exception
        'STOP: Browser role has direct canonical-table access on %',
        v_name;
    end if;

    if not has_table_privilege(
         'service_role',
         v_name,
         'SELECT'
       )
       or not has_table_privilege(
         'service_role',
         v_name,
         'INSERT'
       )
       or not has_table_privilege(
         'service_role',
         v_name,
         'UPDATE'
       )
       or not has_table_privilege(
         'service_role',
         v_name,
         'DELETE'
       )
    then
      raise exception
        'STOP: service_role canonical-table authority is incomplete on %',
        v_name;
    end if;
  end loop;

  if (
    select count(*)
    from platform_private.command_types command_type
    where command_type.command_type like
      'correction.%'
  ) <> 14 then
    raise exception
      'STOP: Migration 2 must register exactly 14 correction command types';
  end if;

  foreach v_command_type in array array[
    'correction.case.create_from_contribution',
    'correction.case.create_internal',
    'correction.case.triage',
    'correction.case.assign',
    'correction.evidence.link',
    'correction.evidence.unlink',
    'correction.investigation.update',
    'correction.case.submit_for_decision',
    'correction.case.return_to_investigation',
    'correction.decision.record',
    'correction.related_resource.add',
    'correction.related_resource.disposition',
    'correction.case.close',
    'correction.case.reopen'
  ]
  loop
    if not exists (
      select 1
      from platform_private.command_types command_type
      where command_type.command_type =
        v_command_type
        and command_type.enabled
        and nullif(
          btrim(command_type.job_type),
          ''
        ) is not null
        and nullif(
          btrim(command_type.accepted_event_type),
          ''
        ) is not null
        and nullif(
          btrim(command_type.success_event_type),
          ''
        ) is not null
        and nullif(
          btrim(command_type.failure_event_type),
          ''
        ) is not null
        and nullif(
          btrim(command_type.retry_event_type),
          ''
        ) is not null
    ) then
      raise exception
        'STOP: Missing or incomplete correction command type: %',
        v_command_type;
    end if;
  end loop;

  foreach v_function in array array[
    'public.create_correction_case_from_contribution(uuid,text,text,text,uuid)',
    'public.create_internal_correction_case(text,text,text,text,uuid)',
    'public.triage_correction_case(uuid,bigint,text,text,uuid,uuid,text,text,text,uuid)',
    'public.assign_correction_case(uuid,bigint,uuid,text,text,uuid)',
    'public.link_correction_evidence(uuid,bigint,uuid,uuid,uuid,text,text,text,text,uuid)',
    'public.unlink_correction_evidence(uuid,bigint,uuid,text,text,uuid)',
    'public.update_correction_investigation(uuid,bigint,text,text,boolean,text,text,uuid)',
    'public.submit_correction_for_decision(uuid,bigint,text,text,uuid)',
    'public.return_correction_to_investigation(uuid,bigint,text,text,uuid)',
    'public.record_correction_decision(uuid,bigint,text,text,text,text,jsonb,uuid,text,uuid)',
    'public.add_related_resource_review(uuid,bigint,uuid,text,text,uuid)',
    'public.set_related_resource_disposition(uuid,bigint,uuid,bigint,text,text,uuid,text,uuid)',
    'public.close_correction_case(uuid,bigint,text,text,uuid)',
    'public.reopen_correction_case(uuid,bigint,text,text,uuid)',
    'public.list_correction_cases(text,uuid,integer,integer)',
    'public.get_correction_case_workspace(uuid)',
    'public.list_correction_case_events(uuid,bigint,integer)'
  ]
  loop
    if to_regprocedure(v_function) is null then
      raise exception
        'STOP: Missing Migration 2 public function: %',
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
        'STOP: Public function grants are invalid: %',
        v_function;
    end if;
  end loop;

  foreach v_function in array array[
    'platform_private.correction_actor_context()',
    'platform_private.assert_correction_capability(text)',
    'platform_private.correction_request_fingerprint(text,uuid,jsonb)',
    'platform_private.begin_resource_command(text,uuid,text,jsonb)',
    'platform_private.begin_correction_create_command(text,text,jsonb)',
    'platform_private.complete_resource_command(uuid,jsonb)',
    'platform_private.reject_resource_command(uuid,text,text,jsonb)',
    'platform_private.append_correction_event(uuid,text,bigint,bigint,text,text,uuid,text,uuid,uuid,uuid,uuid,uuid,uuid,jsonb)',
    'platform_private.read_correction_command_result(uuid,boolean)'
  ]
  loop
    if to_regprocedure(v_function) is null then
      raise exception
        'STOP: Missing Migration 2 private helper: %',
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
        'STOP: Private helper grants are invalid: %',
        v_function;
    end if;
  end loop;

  if to_regclass(
       'editorial.correction_applications'
     ) is not null
     or to_regclass(
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
           'apply_article_correction',
           'publish_correction_note',
           'public_get_article_correction_notes'
         )
     )
     or exists (
       select 1
       from information_schema.columns
       where table_schema = 'editorial'
         and table_name = 'correction_cases'
         and column_name =
           'current_application_id'
     )
  then
    raise exception
      'STOP: Later correction application or public-note authority leaked into Migration 2';
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
    from editorial.correction_evidence_links
  ) or exists (
    select 1
    from editorial.correction_decisions
  ) or exists (
    select 1
    from editorial.correction_related_resource_reviews
  ) then
    raise exception
      'STOP: Migration 2 created production correction rows';
  end if;
end;
$verify_phase_3b_m2_structure$;

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
  '00000000-0000-4000-8000-000000000401',
  'authenticated',
  'authenticated',
  'phase3b-m2-verifier@local.invalid',
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
  wp_status,
  draft_version
)
values (
  '00000000-0000-4000-8000-000000000411',
  'phase3b-m2-verifier-article',
  'Phase 3B Migration 2 Verifier Article',
  'publish',
  1
);

insert into editorial.resources (
  id,
  resource_kind,
  visibility,
  lifecycle_state,
  created_by
)
values (
  '00000000-0000-4000-8000-000000000421',
  'article',
  'public',
  'published',
  '00000000-0000-4000-8000-000000000401'
);

insert into editorial.article_resources (
  resource_id,
  resource_kind,
  article_id
)
values (
  '00000000-0000-4000-8000-000000000421',
  'article',
  '00000000-0000-4000-8000-000000000411'
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
  content_html,
  lifecycle_state,
  wp_status,
  published_at,
  created_by,
  content_fingerprint
)
values (
  '00000000-0000-4000-8000-000000000431',
  '00000000-0000-4000-8000-000000000421',
  '00000000-0000-4000-8000-000000000411',
  1,
  'published',
  1,
  'Phase 3B Migration 2 Verifier Article',
  'phase3b-m2-verifier-article',
  '<p>Phase 3B Migration 2 verifier Article.</p>',
  'published',
  'publish',
  now(),
  '00000000-0000-4000-8000-000000000401',
  repeat('a', 64)
);

update editorial.resources
set
  current_published_version_id =
    '00000000-0000-4000-8000-000000000431',
  current_working_version_id =
    '00000000-0000-4000-8000-000000000431'
where id =
  '00000000-0000-4000-8000-000000000421';

insert into editorial.source_types (
  source_type,
  label,
  description,
  enabled,
  sort_order
)
values (
  'website',
  'Website',
  'Website page or web-native publication.',
  true,
  130
)
on conflict (source_type)
do nothing;

insert into editorial.sources (
  id,
  source_type,
  title,
  source_url,
  review_status,
  exposure_class,
  source_state,
  created_by,
  updated_by
)
values (
  '00000000-0000-4000-8000-000000000461',
  'website',
  'Phase 3B Migration 2 Verifier Source',
  'https://example.invalid/phase3b-m2-verifier-source',
  'draft',
  'internal',
  'active',
  '00000000-0000-4000-8000-000000000401',
  '00000000-0000-4000-8000-000000000401'
);

insert into editorial.source_versions (
  id,
  source_id,
  version_number,
  source_type,
  title,
  source_url,
  rights_status,
  consent_status,
  sensitivity,
  created_by,
  content_fingerprint
)
values (
  '00000000-0000-4000-8000-000000000462',
  '00000000-0000-4000-8000-000000000461',
  1,
  'website',
  'Phase 3B Migration 2 Verifier Source',
  'https://example.invalid/phase3b-m2-verifier-source',
  'unknown',
  'not_required',
  'none',
  '00000000-0000-4000-8000-000000000401',
  repeat('b', 64)
);

update editorial.sources
set
  current_working_version_id =
    '00000000-0000-4000-8000-000000000462',
  current_approved_version_id =
    '00000000-0000-4000-8000-000000000462',
  review_status = 'approved',
  reviewed_by =
    '00000000-0000-4000-8000-000000000401',
  reviewed_at = now(),
  updated_by =
    '00000000-0000-4000-8000-000000000401'
where id =
  '00000000-0000-4000-8000-000000000461';

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
  '00000000-0000-4000-8000-000000000471',
  '00000000-0000-4000-8000-000000000401',
  'article',
  '00000000-0000-4000-8000-000000000411',
  'phase3b-m2-verifier-article',
  'bio_correction',
  jsonb_build_object(
    'description',
    'The verifier Article contains a factual error.',
    'submitted_value',
    'Old verifier value',
    'suggested_value',
    'Corrected verifier value'
  ),
  'pending',
  now(),
  now()
);

set constraints all immediate;
set constraints all deferred;

do $verify_phase_3b_m2_runtime$
declare
  v_actor uuid;
  v_contribution_id uuid;
  v_contribution_before jsonb;
  v_contribution_after jsonb;
  v_target_resource_id uuid;
  v_target_version_id uuid;
  v_related_resource_id uuid;
  v_source_id uuid;
  v_source_version_id uuid;
  v_citation_id uuid;
  v_contribution_case_id uuid;
  v_case_id uuid;
  v_evidence_link_id uuid;
  v_related_review_id uuid;
  v_first_decision_id uuid;
  v_second_decision_id uuid;
  v_first_receipt_id uuid;
  v_event_count bigint;
  v_case_revision bigint;
  v_review_revision bigint;
  v_count bigint;
  v_metadata jsonb;
  v_workspace jsonb;
  v_command record;
  v_replay record;
  v_error_code text;
  v_correlation_id uuid;
begin
  select user_row.id
  into v_actor
  from auth.users user_row
  order by user_row.id
  limit 1;

  if v_actor is null then
    raise exception
      'STOP: Runtime verification requires one existing auth user';
  end if;

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
      'STOP: Runtime verification could not establish service actor context';
  end if;

  select
    resource.id,
    resource.current_published_version_id
  into
    v_target_resource_id,
    v_target_version_id
  from editorial.resources resource
  join editorial.article_versions version
    on version.id =
      resource.current_published_version_id
   and version.resource_id =
      resource.id
  where resource.resource_kind = 'article'
    and resource.current_published_version_id
      is not null
  order by resource.id
  limit 1;

  if v_target_resource_id is null
     or v_target_version_id is null
  then
    raise exception
      'STOP: Runtime verification requires one published Article resource';
  end if;

  select resource.id
  into v_related_resource_id
  from editorial.resources resource
  where resource.resource_kind <>
      'correction_case'
    and resource.id <>
      v_target_resource_id
  order by resource.id
  limit 1;

  v_related_resource_id :=
    coalesce(
      v_related_resource_id,
      v_target_resource_id
    );

  select
    source.id,
    source.current_approved_version_id,
    citation.id
  into
    v_source_id,
    v_source_version_id,
    v_citation_id
  from editorial.sources source
  left join lateral (
    select citation_row.id
    from editorial.citations citation_row
    where citation_row.source_id =
        source.id
      and citation_row.source_version_id =
        source.current_approved_version_id
      and citation_row.citation_state =
        'active'
    order by citation_row.id
    limit 1
  ) citation on true
  where source.source_state = 'active'
    and source.review_status = 'approved'
    and source.current_approved_version_id
      is not null
    and exists (
      select 1
      from editorial.source_versions version
      where version.id =
        source.current_approved_version_id
        and version.source_id = source.id
    )
  order by
    case when citation.id is null then 1 else 0 end,
    source.id
  limit 1;

  if v_source_id is null
     or v_source_version_id is null
  then
    raise exception
      'STOP: Runtime verification requires one active approved Source version';
  end if;

  select contribution.id
  into v_contribution_id
  from public.community_contributions contribution
  order by contribution.id
  limit 1;

  if v_contribution_id is null then
    raise exception
      'STOP: Runtime verification requires one community contribution';
  end if;

  select to_jsonb(contribution)
  into v_contribution_before
  from public.community_contributions contribution
  where contribution.id =
    v_contribution_id;

  v_correlation_id := gen_random_uuid();

  select *
  into v_command
  from public.create_correction_case_from_contribution(
    v_contribution_id,
    'Verifier contribution correction case.',
    'factual_error',
    'verify-m2-contribution-create',
    v_correlation_id
  );

  if v_command.receipt_status <> 'succeeded'
     or v_command.case_revision <> 1
     or v_command.idempotent_replay
  then
    raise exception
      'STOP: Contribution-origin case creation failed';
  end if;

  v_contribution_case_id :=
    v_command.case_resource_id;
  v_first_receipt_id :=
    v_command.command_receipt_id;

  set constraints all immediate;
  set constraints all deferred;

  select *
  into v_replay
  from public.create_correction_case_from_contribution(
    v_contribution_id,
    'Verifier contribution correction case.',
    'factual_error',
    'verify-m2-contribution-create',
    v_correlation_id
  );

  if v_replay.command_receipt_id
       is distinct from v_first_receipt_id
     or v_replay.case_resource_id
       is distinct from v_contribution_case_id
     or not v_replay.idempotent_replay
     or v_replay.receipt_status <> 'succeeded'
  then
    raise exception
      'STOP: Contribution-origin idempotent replay failed';
  end if;

  begin
    perform 1
    from public.create_correction_case_from_contribution(
      v_contribution_id,
      'Conflicting verifier request.',
      'factual_error',
      'verify-m2-contribution-create',
      v_correlation_id
    );

    raise exception
      'STOP: Conflicting idempotency reuse was accepted';
  exception
    when unique_violation then
      null;
  end;

  select to_jsonb(contribution)
  into v_contribution_after
  from public.community_contributions contribution
  where contribution.id =
    v_contribution_id;

  if v_contribution_after is distinct from
     v_contribution_before
  then
    raise exception
      'STOP: Case creation changed the originating contribution';
  end if;

  if (
    select count(*)
    from editorial.correction_cases correction_case
    where correction_case.origin_contribution_id =
      v_contribution_id
  ) <> 1 then
    raise exception
      'STOP: Contribution did not produce exactly one controlling case';
  end if;

  v_correlation_id := gen_random_uuid();

  select *
  into v_command
  from public.create_internal_correction_case(
    'Verifier internal correction case.',
    'factual_error',
    'normal',
    'verify-m2-internal-create',
    v_correlation_id
  );

  if v_command.receipt_status <> 'succeeded'
     or v_command.case_revision <> 1
     or v_command.idempotent_replay
  then
    raise exception
      'STOP: Internal correction case creation failed';
  end if;

  v_case_id := v_command.case_resource_id;

  set constraints all immediate;
  set constraints all deferred;

  select *
  into v_command
  from public.triage_correction_case(
    v_case_id,
    1,
    'factual_error',
    'high',
    v_target_resource_id,
    v_target_version_id,
    'Verifier published Article target.',
    'Verifier triage.',
    'verify-m2-triage-case',
    gen_random_uuid()
  );

  if v_command.receipt_status <> 'succeeded'
     or v_command.case_revision <> 2
  then
    raise exception
      'STOP: Correction triage failed';
  end if;

  set constraints all immediate;
  set constraints all deferred;

  select *
  into v_command
  from public.assign_correction_case(
    v_case_id,
    2,
    v_actor,
    'Verifier assignment.',
    'verify-m2-assign-case',
    gen_random_uuid()
  );

  if v_command.receipt_status <> 'succeeded'
     or v_command.case_revision <> 3
  then
    raise exception
      'STOP: Investigator assignment failed';
  end if;

  set constraints all immediate;
  set constraints all deferred;

  select *
  into v_command
  from public.link_correction_evidence(
    v_case_id,
    3,
    v_source_id,
    v_source_version_id,
    v_citation_id,
    'supports_correction',
    'Verifier evidence note.',
    'Verifier evidence link.',
    'verify-m2-link-evidence',
    gen_random_uuid()
  );

  if v_command.receipt_status <> 'succeeded'
     or v_command.case_revision <> 4
  then
    raise exception
      'STOP: Evidence link command failed';
  end if;

  v_evidence_link_id :=
    (v_command.result_payload ->>
      'evidence_link_id')::uuid;
  v_first_receipt_id :=
    v_command.command_receipt_id;

  set constraints all immediate;
  set constraints all deferred;

  select *
  into v_replay
  from public.link_correction_evidence(
    v_case_id,
    3,
    v_source_id,
    v_source_version_id,
    v_citation_id,
    'supports_correction',
    'Verifier evidence note.',
    'Verifier evidence link.',
    'verify-m2-link-evidence',
    (
      select receipt.request_payload
        ->> 'correlation_id'
      from platform_private.command_receipts receipt
      where receipt.id =
        v_first_receipt_id
    )::uuid
  );

  if v_replay.command_receipt_id
       is distinct from v_first_receipt_id
     or not v_replay.idempotent_replay
     or v_replay.receipt_status <> 'succeeded'
  then
    raise exception
      'STOP: Evidence-link idempotent replay failed';
  end if;

  begin
    update editorial.correction_evidence_links
    set internal_note = 'Forbidden direct update.'
    where id = v_evidence_link_id;

    raise exception
      'STOP: Direct correction evidence update was accepted';
  exception
    when others then
      if position(
        'governed link and unlink commands'
        in sqlerrm
      ) = 0 then
        raise;
      end if;
  end;

  select *
  into v_command
  from public.unlink_correction_evidence(
    v_case_id,
    4,
    v_evidence_link_id,
    'Verifier evidence unlink.',
    'verify-m2-unlink-evidence',
    gen_random_uuid()
  );

  if v_command.receipt_status <> 'succeeded'
     or v_command.case_revision <> 5
  then
    raise exception
      'STOP: Evidence unlink command failed';
  end if;

  if exists (
    select 1
    from editorial.correction_evidence_links evidence
    where evidence.id = v_evidence_link_id
  ) then
    raise exception
      'STOP: Governed evidence unlink left the current link';
  end if;

  select event.metadata
  into v_metadata
  from editorial.correction_events event
  where event.case_resource_id = v_case_id
    and event.event_type =
      'evidence_unlinked'
  order by event.event_number desc
  limit 1;

  if v_metadata ->> 'evidence_link_id'
       is distinct from
       v_evidence_link_id::text
     or v_metadata ->> 'source_id'
       is distinct from v_source_id::text
     or v_metadata ->> 'source_version_id'
       is distinct from
       v_source_version_id::text
     or v_metadata ->> 'evidence_role'
       is distinct from
       'supports_correction'
     or v_metadata ->> 'link_created_at'
       is null
     or v_metadata ->> 'unlinking_actor_id'
       is distinct from v_actor::text
     or v_metadata ->> 'command_receipt_id'
       is null
     or v_metadata ->> 'correlation_id'
       is null
  then
    raise exception
      'STOP: Evidence unlink history snapshot is incomplete';
  end if;

  set constraints all immediate;
  set constraints all deferred;

  select *
  into v_command
  from public.link_correction_evidence(
    v_case_id,
    5,
    v_source_id,
    v_source_version_id,
    v_citation_id,
    'supports_correction',
    'Verifier replacement evidence note.',
    'Verifier evidence relink.',
    'verify-m2-relink-evidence',
    gen_random_uuid()
  );

  if v_command.receipt_status <> 'succeeded'
     or v_command.case_revision <> 6
  then
    raise exception
      'STOP: Evidence relink failed';
  end if;

  set constraints all immediate;
  set constraints all deferred;

  select count(*)
  into v_event_count
  from editorial.correction_events event
  where event.case_resource_id = v_case_id;

  select *
  into v_command
  from public.update_correction_investigation(
    v_case_id,
    5,
    'Stale verifier summary.',
    'Stale verifier recommendation.',
    true,
    'Verifier stale update.',
    'verify-m2-stale-investigation',
    gen_random_uuid()
  );

  if v_command.receipt_status <> 'rejected'
     or v_command.case_revision <> 6
  then
    raise exception
      'STOP: Stale case revision was not durably rejected';
  end if;

  select receipt.error_code
  into v_error_code
  from platform_private.command_receipts receipt
  where receipt.id =
    v_command.command_receipt_id;

  if v_error_code <>
     'case_revision_changed'
  then
    raise exception
      'STOP: Stale case revision used the wrong rejection code';
  end if;

  if (
    select correction_case.current_revision
    from editorial.correction_cases correction_case
    where correction_case.resource_id =
      v_case_id
  ) <> 6
     or (
       select count(*)
       from editorial.correction_events event
       where event.case_resource_id =
         v_case_id
     ) <> v_event_count
  then
    raise exception
      'STOP: Stale case revision changed canonical correction state';
  end if;

  select *
  into v_command
  from public.update_correction_investigation(
    v_case_id,
    6,
    'Verifier investigation summary.',
    'Verifier recommendation.',
    true,
    'Verifier investigation update.',
    'verify-m2-update-investigation-one',
    gen_random_uuid()
  );

  if v_command.receipt_status <> 'succeeded'
     or v_command.case_revision <> 7
  then
    raise exception
      'STOP: Investigation update failed';
  end if;

  set constraints all immediate;
  set constraints all deferred;

  select *
  into v_command
  from public.add_related_resource_review(
    v_case_id,
    7,
    v_related_resource_id,
    'Verifier related-resource review.',
    'verify-m2-add-related',
    gen_random_uuid()
  );

  if v_command.receipt_status <> 'succeeded'
     or v_command.case_revision <> 8
  then
    raise exception
      'STOP: Related-resource review creation failed';
  end if;

  v_related_review_id :=
    (v_command.result_payload ->>
      'related_resource_review_id')::uuid;

  set constraints all immediate;
  set constraints all deferred;

  select *
  into v_command
  from public.submit_correction_for_decision(
    v_case_id,
    8,
    'Verifier decision submission.',
    'verify-m2-submit-one',
    gen_random_uuid()
  );

  if v_command.receipt_status <> 'succeeded'
     or v_command.case_revision <> 9
  then
    raise exception
      'STOP: First decision submission failed';
  end if;

  set constraints all immediate;
  set constraints all deferred;

  select *
  into v_command
  from public.return_correction_to_investigation(
    v_case_id,
    9,
    'Verifier requested more investigation.',
    'verify-m2-return-investigation',
    gen_random_uuid()
  );

  if v_command.receipt_status <> 'succeeded'
     or v_command.case_revision <> 10
  then
    raise exception
      'STOP: Return-to-investigation command failed';
  end if;

  set constraints all immediate;
  set constraints all deferred;

  select *
  into v_command
  from public.update_correction_investigation(
    v_case_id,
    10,
    'Verifier final investigation summary.',
    'Verifier final recommendation.',
    true,
    'Verifier final investigation update.',
    'verify-m2-update-investigation-two',
    gen_random_uuid()
  );

  if v_command.receipt_status <> 'succeeded'
     or v_command.case_revision <> 11
  then
    raise exception
      'STOP: Final investigation update failed';
  end if;

  set constraints all immediate;
  set constraints all deferred;

  select *
  into v_command
  from public.submit_correction_for_decision(
    v_case_id,
    11,
    'Verifier final decision submission.',
    'verify-m2-submit-two',
    gen_random_uuid()
  );

  if v_command.receipt_status <> 'succeeded'
     or v_command.case_revision <> 12
  then
    raise exception
      'STOP: Final decision submission failed';
  end if;

  set constraints all immediate;
  set constraints all deferred;

  select *
  into v_command
  from public.record_correction_decision(
    v_case_id,
    12,
    'correction_required',
    'Verifier correction-required decision.',
    'Verifier private analysis.',
    'Verifier public-safe explanation.',
    jsonb_build_object(
      'target_resource_id',
      v_target_resource_id,
      'target_version_id',
      v_target_version_id
    ),
    null,
    'verify-m2-decision-one',
    gen_random_uuid()
  );

  if v_command.receipt_status <> 'succeeded'
     or v_command.case_revision <> 13
  then
    raise exception
      'STOP: First correction decision failed';
  end if;

  v_first_decision_id :=
    (v_command.result_payload ->>
      'decision_id')::uuid;

  set constraints all immediate;
  set constraints all deferred;

  select *
  into v_command
  from public.close_correction_case(
    v_case_id,
    13,
    'Verifier premature closure.',
    'verify-m2-close-required',
    gen_random_uuid()
  );

  if v_command.receipt_status <> 'rejected'
     or v_command.case_revision <> 13
  then
    raise exception
      'STOP: Correction-required closure was not rejected';
  end if;

  select receipt.error_code
  into v_error_code
  from platform_private.command_receipts receipt
  where receipt.id =
    v_command.command_receipt_id;

  if v_error_code <> 'application_required'
     or (
       select correction_case.case_state
       from editorial.correction_cases correction_case
       where correction_case.resource_id =
         v_case_id
     ) <> 'decided'
  then
    raise exception
      'STOP: Correction-required closure gate failed';
  end if;

  select *
  into v_command
  from public.record_correction_decision(
    v_case_id,
    13,
    'no_change_required',
    'Verifier superseding no-change decision.',
    'Verifier superseding analysis.',
    'Verifier superseding explanation.',
    jsonb_build_object(
      'target_resource_id',
      v_target_resource_id,
      'target_version_id',
      v_target_version_id,
      'supersedes',
      v_first_decision_id
    ),
    null,
    'verify-m2-decision-two',
    gen_random_uuid()
  );

  if v_command.receipt_status <> 'succeeded'
     or v_command.case_revision <> 14
  then
    raise exception
      'STOP: Superseding correction decision failed';
  end if;

  v_second_decision_id :=
    (v_command.result_payload ->>
      'decision_id')::uuid;

  if (
    select decision.supersedes_decision_id
    from editorial.correction_decisions decision
    where decision.id =
      v_second_decision_id
  ) is distinct from v_first_decision_id
  then
    raise exception
      'STOP: Decision supersession pointer is invalid';
  end if;

  if (
    select count(*)
    from editorial.correction_events event
    where event.case_resource_id = v_case_id
      and event.decision_id =
        v_second_decision_id
      and event.event_type in (
        'decision_superseded',
        'decision_recorded'
      )
      and event.case_revision_before = 13
      and event.case_revision_after = 14
  ) <> 2 then
    raise exception
      'STOP: Decision supersession event sequence is invalid';
  end if;

  set constraints all immediate;
  set constraints all deferred;

  begin
    update editorial.correction_decisions
    set reason = 'Forbidden decision rewrite.'
    where id = v_first_decision_id;

    raise exception
      'STOP: Append-only correction decision was updated';
  exception
    when others then
      if position(
        'append-only'
        in sqlerrm
      ) = 0 then
        raise;
      end if;
  end;

  select *
  into v_command
  from public.set_related_resource_disposition(
    v_case_id,
    14,
    v_related_review_id,
    1,
    'no_action_required',
    'Verifier related-resource disposition.',
    null,
    'verify-m2-disposition-related',
    gen_random_uuid()
  );

  if v_command.receipt_status <> 'succeeded'
     or v_command.case_revision <> 15
  then
    raise exception
      'STOP: Related-resource disposition failed';
  end if;

  select review.review_revision
  into v_review_revision
  from editorial.correction_related_resource_reviews review
  where review.id = v_related_review_id;

  if v_review_revision <> 2 then
    raise exception
      'STOP: Related-resource review revision did not increment exactly once';
  end if;

  set constraints all immediate;
  set constraints all deferred;

  select *
  into v_command
  from public.close_correction_case(
    v_case_id,
    15,
    'Verifier non-correction closure.',
    'verify-m2-close-no-change',
    gen_random_uuid()
  );

  if v_command.receipt_status <> 'succeeded'
     or v_command.case_revision <> 16
  then
    raise exception
      'STOP: Non-correction closure failed';
  end if;

  set constraints all immediate;
  set constraints all deferred;

  select *
  into v_command
  from public.reopen_correction_case(
    v_case_id,
    16,
    'Verifier reopen for material follow-up.',
    'verify-m2-reopen-case',
    gen_random_uuid()
  );

  if v_command.receipt_status <> 'succeeded'
     or v_command.case_revision <> 17
  then
    raise exception
      'STOP: Correction case reopen failed';
  end if;

  set constraints all immediate;
  set constraints all deferred;

  begin
    update editorial.correction_cases
    set
      case_state = 'applied',
      current_revision =
        current_revision + 1
    where resource_id = v_case_id;

    set constraints all immediate;

    raise exception
      'STOP: Applied state was accepted before application authority';
  exception
    when others then
      if position(
        'application authority is not installed'
        in sqlerrm
      ) = 0 then
        raise;
      end if;
  end;

  set constraints all deferred;

  select public.get_correction_case_workspace(
    v_case_id
  )
  into v_workspace;

  if v_workspace -> 'case' ->>
       'resource_id'
       is distinct from v_case_id::text
     or jsonb_array_length(
       v_workspace -> 'targets'
     ) <> 1
     or jsonb_array_length(
       v_workspace -> 'evidence'
     ) <> 1
     or jsonb_array_length(
       v_workspace -> 'decisions'
     ) <> 2
     or jsonb_array_length(
       v_workspace ->
         'related_resource_reviews'
     ) <> 1
  then
    raise exception
      'STOP: Correction workspace read is incomplete';
  end if;

  select count(*)
  into v_count
  from public.list_correction_cases(
    null,
    null,
    100,
    0
  ) queue_row
  where queue_row.case_resource_id in (
    v_case_id,
    v_contribution_case_id
  );

  if v_count <> 2 then
    raise exception
      'STOP: Correction queue read did not return both verifier cases';
  end if;

  select count(*)
  into v_event_count
  from public.list_correction_case_events(
    v_case_id,
    0,
    200
  );

  if v_event_count <> 19 then
    raise exception
      'STOP: Ordered correction history did not return 19 events';
  end if;

  select
    correction_case.current_revision
  into v_case_revision
  from editorial.correction_cases correction_case
  where correction_case.resource_id =
    v_case_id;

  if v_case_revision <> 17
     or (
       select correction_case.case_state
       from editorial.correction_cases correction_case
       where correction_case.resource_id =
         v_case_id
     ) <> 'investigating'
     or (
       select correction_case.current_decision_id
       from editorial.correction_cases correction_case
       where correction_case.resource_id =
         v_case_id
     ) is distinct from v_second_decision_id
  then
    raise exception
      'STOP: Final correction case state is invalid';
  end if;

  if (
    select count(*)
    from platform_private.command_receipts receipt
    where receipt.command_type like
      'correction.%'
  ) <> 20
     or (
       select count(*)
       from platform_private.command_receipts receipt
       where receipt.command_type like
         'correction.%'
         and receipt.status = 'succeeded'
     ) <> 18
     or (
       select count(*)
       from platform_private.command_receipts receipt
       where receipt.command_type like
         'correction.%'
         and receipt.status = 'rejected'
     ) <> 2
  then
    raise exception
      'STOP: Correction command receipt counts are invalid';
  end if;

  if (
    select count(*)
    from platform_private.outbox_events outbox
    where outbox.command_type like
      'correction.%'
  ) <> 40
     or exists (
       select 1
       from platform_private.jobs job
       where job.command_type like
         'correction.%'
     )
  then
    raise exception
      'STOP: Synchronous correction outbox or job contract is invalid';
  end if;

  if (
    select count(*)
    from editorial.correction_cases
  ) <> 2
     or (
       select count(*)
       from editorial.correction_decisions
     ) <> 2
     or (
       select count(*)
       from editorial.correction_related_resource_reviews
     ) <> 1
     or (
       select count(*)
       from editorial.correction_evidence_links
     ) <> 1
     or (
       select count(*)
       from editorial.correction_events
     ) <> 20
  then
    raise exception
      'STOP: Runtime correction row counts are invalid';
  end if;

  set constraints all immediate;
end;
$verify_phase_3b_m2_runtime$;

select
  'PASS: Phase 3B correction evidence and decision authority verified.'
  as result;

rollback;
