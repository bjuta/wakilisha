-- Phase 3B Migration 1 structural verifier.
-- Read-only verification for the correction identity foundation.

do $verify_phase_3b_correction_identity$
declare
  v_table text;
  v_function text;
  v_trigger record;
  v_sequence text;
  v_expected_assignment_count integer;
  v_actual_assignment_count integer;
begin
  foreach v_table in array array[
    'correction_kinds',
    'correction_evidence_roles',
    'correction_event_types',
    'correction_cases',
    'correction_targets',
    'correction_events'
  ]
  loop
    if to_regclass(
      format('editorial.%I', v_table)
    ) is null
    then
      raise exception
        'Missing Phase 3B Migration 1 table: editorial.%',
        v_table;
    end if;
  end loop;

  if not exists (
    select 1
    from editorial.resource_kinds
    where kind = 'correction_case'
      and enabled
  ) then
    raise exception
      'correction_case resource kind is missing or disabled';
  end if;

  if exists (
    select 1
    from (
      values
        ('view_corrections'),
        ('triage_corrections'),
        ('investigate_corrections'),
        ('decide_corrections'),
        ('apply_corrections'),
        ('publish_correction_notes')
    ) expected(capability_key)
    where not exists (
      select 1
      from public.capability_definitions definition
      where definition.capability_key =
        expected.capability_key
        and definition.domain = 'content'
    )
  ) then
    raise exception
      'One or more Phase 3B correction capabilities are missing';
  end if;

  select count(*)
  into v_expected_assignment_count
  from (
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

      ('registry_editor', 'view_corrections')
  ) expected(role_key, capability_key);

  select count(*)
  into v_actual_assignment_count
  from public.role_capabilities assignment
  where assignment.capability_key in (
    'view_corrections',
    'triage_corrections',
    'investigate_corrections',
    'decide_corrections',
    'apply_corrections',
    'publish_correction_notes'
  );

  if v_actual_assignment_count <>
     v_expected_assignment_count
  then
    raise exception
      'Unexpected correction capability assignment count: expected %, found %',
      v_expected_assignment_count,
      v_actual_assignment_count;
  end if;

  if exists (
    select 1
    from (
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

        ('registry_editor', 'view_corrections')
    ) expected(role_key, capability_key)
    where not exists (
      select 1
      from public.role_capabilities assignment
      where assignment.role_key =
        expected.role_key
        and assignment.capability_key =
          expected.capability_key
    )
  ) then
    raise exception
      'One or more expected correction role assignments are missing';
  end if;

  if exists (
    select 1
    from public.role_capabilities assignment
    where assignment.capability_key in (
      'view_corrections',
      'triage_corrections',
      'investigate_corrections',
      'decide_corrections',
      'apply_corrections',
      'publish_correction_notes'
    )
      and not exists (
        select 1
        from (
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

            ('registry_editor', 'view_corrections')
        ) expected(role_key, capability_key)
        where expected.role_key =
          assignment.role_key
          and expected.capability_key =
            assignment.capability_key
      )
  ) then
    raise exception
      'An unexpected role received a correction capability';
  end if;

  if (
    select count(*)
    from editorial.correction_kinds
  ) <> 9 then
    raise exception
      'Unexpected correction-kind seed count';
  end if;

  if (
    select count(*)
    from editorial.correction_evidence_roles
  ) <> 7 then
    raise exception
      'Unexpected correction-evidence-role seed count';
  end if;

  if (
    select count(*)
    from editorial.correction_event_types
  ) <> 24 then
    raise exception
      'Unexpected correction-event-type seed count';
  end if;

  if exists (
    select 1
    from (
      values
        ('factual_error'),
        ('attribution_error'),
        ('missing_credit'),
        ('classification_error'),
        ('outdated_information'),
        ('transcription_error'),
        ('broken_reference'),
        ('rights_or_consent'),
        ('other')
    ) expected(correction_kind)
    where not exists (
      select 1
      from editorial.correction_kinds actual
      where actual.correction_kind =
        expected.correction_kind
    )
  ) then
    raise exception
      'Correction-kind vocabulary is incomplete';
  end if;

  if exists (
    select 1
    from (
      values
        ('supports_correction'),
        ('challenges_correction'),
        ('context'),
        ('identity'),
        ('rights_or_consent'),
        ('methodology'),
        ('other')
    ) expected(evidence_role)
    where not exists (
      select 1
      from editorial.correction_evidence_roles actual
      where actual.evidence_role =
        expected.evidence_role
    )
  ) then
    raise exception
      'Correction-evidence-role vocabulary is incomplete';
  end if;

  if exists (
    select 1
    from (
      values
        ('case_created'),
        ('case_triaged'),
        ('target_attached'),
        ('target_replaced'),
        ('investigator_assigned'),
        ('investigator_reassigned'),
        ('evidence_linked'),
        ('evidence_unlinked'),
        ('investigation_updated'),
        ('submitted_for_decision'),
        ('returned_to_investigation'),
        ('decision_recorded'),
        ('decision_superseded'),
        ('application_accepted'),
        ('application_rejected_stale'),
        ('application_failed'),
        ('application_succeeded'),
        ('public_note_published'),
        ('public_note_superseded'),
        ('related_resource_added'),
        ('related_resource_dispositioned'),
        ('contributor_notification_requested'),
        ('case_closed'),
        ('case_reopened')
    ) expected(event_type)
    where not exists (
      select 1
      from editorial.correction_event_types actual
      where actual.event_type =
        expected.event_type
    )
  ) then
    raise exception
      'Correction-event-type vocabulary is incomplete';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'editorial'
      and table_name = 'correction_cases'
      and column_name in (
        'current_decision_id',
        'current_application_id'
      )
  ) then
    raise exception
      'Later correction decision or application pointers exist in Migration 1';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid =
      'editorial.correction_cases'::regclass
      and conname =
        'correction_cases_resource_fkey'
      and confrelid =
        'editorial.resources'::regclass
      and confdeltype = 'r'
  ) then
    raise exception
      'Correction case resource identity does not use delete restriction';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid =
      'editorial.correction_cases'::regclass
      and conname =
        'correction_cases_origin_contribution_fkey'
      and confrelid =
        'public.community_contributions'::regclass
      and confdeltype = 'r'
  ) then
    raise exception
      'Correction contribution origin does not use live intake identity with delete restriction';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid =
      'editorial.correction_targets'::regclass
      and conname =
        'correction_targets_version_fkey'
      and confrelid =
        'editorial.article_versions'::regclass
      and confdeltype = 'r'
  ) then
    raise exception
      'Correction target does not preserve immutable Article-version identity';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid =
      'editorial.correction_events'::regclass
      and conname =
        'correction_events_command_receipt_fkey'
      and confrelid =
        'platform_private.command_receipts'::regclass
      and confdeltype = 'r'
  ) then
    raise exception
      'Correction event command receipt identity is not preserved';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid =
      'editorial.correction_events'::regclass
      and conname =
        'correction_events_revision_check'
      and pg_get_constraintdef(
        oid,
        true
      ) ilike '%case_revision_before + 1%'
      and pg_get_constraintdef(
        oid,
        true
      ) ilike '%case_revision_before%'
  ) then
    raise exception
      'Correction event revision-step constraint is missing';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid =
      'editorial.correction_events'::regclass
      and conname =
        'correction_events_creation_contract_check'
      and pg_get_constraintdef(
        oid,
        true
      ) ilike '%case_created%'
      and pg_get_constraintdef(
        oid,
        true
      ) ilike '%actor_id is not null%'
  ) then
    raise exception
      'Correction case-created event contract is missing';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'editorial'
      and indexname =
        'correction_cases_origin_contribution_unique'
  ) then
    raise exception
      'Correction contribution origin uniqueness is missing';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'editorial'
      and indexname =
        'correction_targets_one_primary_per_case'
  ) then
    raise exception
      'One-primary-target protection is missing';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'editorial'
      and indexname =
        'correction_targets_resource_version_idx'
  ) then
    raise exception
      'Correction target resource-version lookup is missing';
  end if;

  foreach v_function in array array[
    'assert_resource_binding_integrity()',
    'prevent_correction_case_identity_retarget()',
    'assert_correction_target_integrity()',
    'validate_correction_case_history(uuid)',
    'assert_correction_target_case_integrity()',
    'assert_correction_case_integrity()',
    'assert_correction_event_integrity()',
    'protect_correction_event()',
    'current_user_can_view_correction(uuid)',
    'current_user_can_triage_correction(uuid)',
    'current_user_can_investigate_correction(uuid)',
    'current_user_can_decide_correction(uuid)',
    'current_user_can_apply_correction(uuid)',
    'current_user_can_publish_correction_note(uuid)'
  ]
  loop
    if to_regprocedure(
      format('editorial.%s', v_function)
    ) is null
    then
      raise exception
        'Missing Phase 3B function: editorial.%',
        v_function;
    end if;
  end loop;

  for v_trigger in
    select *
    from (
      values
        (
          'correction_targets',
          'correction_targets_integrity',
          true
        ),
        (
          'correction_targets',
          'correction_targets_case_integrity',
          true
        ),
        (
          'correction_cases',
          'correction_cases_resource_identity_immutable',
          false
        ),
        (
          'correction_cases',
          'correction_cases_resource_binding_integrity',
          true
        ),
        (
          'correction_cases',
          'correction_cases_integrity',
          true
        ),
        (
          'correction_events',
          'correction_events_integrity',
          true
        ),
        (
          'correction_events',
          'correction_events_append_only',
          false
        )
    ) required_trigger(
      table_name,
      trigger_name,
      must_be_deferred
    )
  loop
    if not exists (
      select 1
      from pg_trigger trigger_row
      join pg_class relation
        on relation.oid =
          trigger_row.tgrelid
      join pg_namespace namespace
        on namespace.oid =
          relation.relnamespace
      where namespace.nspname = 'editorial'
        and relation.relname =
          v_trigger.table_name
        and trigger_row.tgname =
          v_trigger.trigger_name
        and not trigger_row.tgisinternal
        and (
          not v_trigger.must_be_deferred
          or (
            trigger_row.tgconstraint <> 0
            and trigger_row.tgdeferrable
            and trigger_row.tginitdeferred
          )
        )
    ) then
      raise exception
        'Missing or invalid trigger editorial.%.%',
        v_trigger.table_name,
        v_trigger.trigger_name;
    end if;
  end loop;

  if not (
    pg_get_functiondef(
      'editorial.assert_resource_binding_integrity()'::regprocedure
    ) like '%when ''correction_case'' then%'
    and pg_get_functiondef(
      'editorial.assert_resource_binding_integrity()'::regprocedure
    ) like '%from editorial.correction_cases%'
  ) then
    raise exception
      'Shared resource-binding authority does not support correction_case';
  end if;

  if not (
    pg_get_functiondef(
      'editorial.prevent_correction_case_identity_retarget()'::regprocedure
    ) like '%Correction case resource identity cannot be changed%'
  ) then
    raise exception
      'Correction case resource-identity immutability guard is incomplete';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    join pg_class relation
      on relation.oid =
        trigger_row.tgrelid
    join pg_namespace namespace
      on namespace.oid =
        relation.relnamespace
    where namespace.nspname = 'editorial'
      and relation.relname = 'correction_cases'
      and trigger_row.tgname =
        'correction_cases_resource_binding_integrity'
      and not trigger_row.tgisinternal
      and trigger_row.tgconstraint <> 0
      and trigger_row.tgdeferrable
      and trigger_row.tginitdeferred
      and pg_get_triggerdef(
        trigger_row.oid,
        true
      ) ilike '%after insert%'
      and pg_get_triggerdef(
        trigger_row.oid,
        true
      ) ilike '%or delete%'
      and pg_get_triggerdef(
        trigger_row.oid,
        true
      ) ilike '%or update%'
  ) then
    raise exception
      'Correction case resource-binding trigger is incomplete';
  end if;

  if not (
    pg_get_functiondef(
      'editorial.assert_correction_target_integrity()'::regprocedure
    ) like '%current_published_version_id%'
    and pg_get_functiondef(
      'editorial.assert_correction_target_integrity()'::regprocedure
    ) like '%Primary correction target must identify the current published Article version%'
  ) then
    raise exception
      'Primary correction target published-version guard is incomplete';
  end if;

  if not (
    pg_get_functiondef(
      'editorial.assert_correction_target_case_integrity()'::regprocedure
    ) like '%validate_correction_case_history%'
    and pg_get_functiondef(
      'editorial.assert_correction_target_case_integrity()'::regprocedure
    ) like '%old.case_resource_id%'
    and pg_get_functiondef(
      'editorial.assert_correction_target_case_integrity()'::regprocedure
    ) like '%new.case_resource_id%'
  ) then
    raise exception
      'Correction target changes do not revalidate affected cases';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    join pg_class relation
      on relation.oid =
        trigger_row.tgrelid
    join pg_namespace namespace
      on namespace.oid =
        relation.relnamespace
    where namespace.nspname = 'editorial'
      and relation.relname = 'correction_targets'
      and trigger_row.tgname =
        'correction_targets_case_integrity'
      and not trigger_row.tgisinternal
      and trigger_row.tgconstraint <> 0
      and trigger_row.tgdeferrable
      and trigger_row.tginitdeferred
      and pg_get_triggerdef(
        trigger_row.oid,
        true
      ) ilike '%after insert%'
      and pg_get_triggerdef(
        trigger_row.oid,
        true
      ) ilike '%or delete%'
      and pg_get_triggerdef(
        trigger_row.oid,
        true
      ) ilike '%or update%'
  ) then
    raise exception
      'Correction target case-integrity trigger is incomplete';
  end if;

  if not (
    pg_get_functiondef(
      'editorial.validate_correction_case_history(uuid)'::regprocedure
    ) like '%Correction event numbers must be contiguous from 1%'
    and pg_get_functiondef(
      'editorial.validate_correction_case_history(uuid)'::regprocedure
    ) like '%Correction event revision chain is discontinuous%'
    and pg_get_functiondef(
      'editorial.validate_correction_case_history(uuid)'::regprocedure
    ) like '%Phase 3B decision authority is not installed%'
  ) then
    raise exception
      'Correction case history or staged-authority guard is incomplete';
  end if;

  if not (
    pg_get_functiondef(
      'editorial.protect_correction_event()'::regprocedure
    ) like '%Correction events are append-only%'
  ) then
    raise exception
      'Correction event append-only guard is incomplete';
  end if;

  foreach v_table in array array[
    'correction_kinds',
    'correction_evidence_roles',
    'correction_event_types',
    'correction_cases',
    'correction_targets',
    'correction_events'
  ]
  loop
    if not exists (
      select 1
      from pg_class relation
      join pg_namespace namespace
        on namespace.oid =
          relation.relnamespace
      where namespace.nspname = 'editorial'
        and relation.relname = v_table
        and relation.relrowsecurity
    ) then
      raise exception
        'RLS is not enabled on editorial.%',
        v_table;
    end if;
  end loop;

  if exists (
    select 1
    from information_schema.role_table_grants grant_row
    where grant_row.table_schema = 'editorial'
      and grant_row.table_name in (
        'correction_kinds',
        'correction_evidence_roles',
        'correction_event_types',
        'correction_cases',
        'correction_targets',
        'correction_events'
      )
      and grant_row.grantee in (
        'anon',
        'PUBLIC'
      )
  ) then
    raise exception
      'Anonymous or public grants exist on correction tables';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants grant_row
    where grant_row.table_schema = 'editorial'
      and grant_row.table_name in (
        'correction_kinds',
        'correction_evidence_roles',
        'correction_event_types',
        'correction_cases',
        'correction_targets',
        'correction_events'
      )
      and grant_row.grantee = 'authenticated'
      and grant_row.privilege_type <> 'SELECT'
  ) then
    raise exception
      'Authenticated has direct mutation grants on correction tables';
  end if;

  if exists (
    select 1
    from pg_policies policy
    where policy.schemaname = 'editorial'
      and policy.tablename in (
        'correction_kinds',
        'correction_evidence_roles',
        'correction_event_types',
        'correction_cases',
        'correction_targets',
        'correction_events'
      )
      and (
        'anon' = any(policy.roles)
        or 'public' = any(policy.roles)
      )
  ) then
    raise exception
      'Anonymous or public policies exist on correction tables';
  end if;

  if (
    select count(*)
    from pg_policies policy
    where policy.schemaname = 'editorial'
      and policy.tablename in (
        'correction_kinds',
        'correction_evidence_roles',
        'correction_event_types',
        'correction_cases',
        'correction_targets',
        'correction_events'
      )
  ) <> 3 then
    raise exception
      'Unexpected correction RLS policy count';
  end if;

  if exists (
    select 1
    from pg_policies policy
    where policy.schemaname = 'editorial'
      and policy.tablename in (
        'correction_cases',
        'correction_targets',
        'correction_events'
      )
  ) then
    raise exception
      'Direct authenticated correction-record policies exist';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants grant_row
    where grant_row.table_schema = 'editorial'
      and grant_row.table_name in (
        'correction_cases',
        'correction_targets',
        'correction_events'
      )
      and grant_row.grantee = 'authenticated'
  ) then
    raise exception
      'Authenticated has direct correction-record table grants';
  end if;

  v_sequence := pg_get_serial_sequence(
    'editorial.correction_cases',
    'case_number'
  );

  if v_sequence is null then
    raise exception
      'Correction case-number identity sequence is missing';
  end if;

  if has_sequence_privilege(
       'anon',
       v_sequence,
       'USAGE'
     )
     or has_sequence_privilege(
       'authenticated',
       v_sequence,
       'USAGE'
     )
  then
    raise exception
      'Browser roles have correction case-number sequence usage';
  end if;

  if not has_sequence_privilege(
    'service_role',
    v_sequence,
    'USAGE'
  ) then
    raise exception
      'Service role lacks correction case-number sequence usage';
  end if;

  if to_regclass(
       'public.community_contributions'
     ) is null
     or not exists (
       select 1
       from pg_constraint
       where conrelid =
         'public.community_contributions'::regclass
         and contype = 'p'
         and pg_get_constraintdef(
           oid,
           true
         ) = 'PRIMARY KEY (id)'
     )
  then
    raise exception
      'Live community contribution intake identity is unavailable';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'editorial'
      and table_name = 'resources'
      and column_name =
        'current_published_version_id'
      and udt_name = 'uuid'
  ) then
    raise exception
      'Article published-version pointer is unavailable';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    join pg_class relation
      on relation.oid =
        trigger_row.tgrelid
    join pg_namespace namespace
      on namespace.oid =
        relation.relnamespace
    where namespace.nspname = 'editorial'
      and relation.relname =
        'article_versions'
      and trigger_row.tgname =
        'article_versions_immutable'
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'Article-version immutability authority regressed';
  end if;
end;
$verify_phase_3b_correction_identity$;

select
  'PASS: Phase 3B correction identity foundation verified.'
  as result;
