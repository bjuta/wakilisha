-- Verify Phase 3A Migration 1 trust identity foundation.

do $verify_phase_3a_trust_identity$
declare
  v_missing text[];
  v_table text;
begin
  select array_agg(required_table)
  into v_missing
  from (
    values
      ('editorial.source_types'),
      ('editorial.citation_locator_types'),
      ('editorial.credit_roles'),
      ('editorial.sources'),
      ('editorial.source_versions'),
      ('editorial.source_review_events'),
      ('editorial.external_contributors'),
      ('editorial.credits'),
      ('editorial.credit_governance')
  ) expected(required_table)
  where to_regclass(required_table) is null;

  if coalesce(array_length(v_missing, 1), 0) > 0 then
    raise exception
      'Missing Phase 3A identity tables: %',
      array_to_string(v_missing, ', ');
  end if;

  if exists (
    select 1
    from (
      values
        ('view_trust_records'),
        ('manage_sources'),
        ('review_sources'),
        ('withdraw_sources'),
        ('manage_citations'),
        ('manage_credits')
    ) expected(capability_key)
    where not exists (
      select 1
      from public.capability_definitions definition
      where definition.capability_key =
        expected.capability_key
    )
  ) then
    raise exception
      'One or more Phase 3A trust capabilities are missing';
  end if;

  if exists (
    select 1
    from (
      values
        ('administrator', 'view_trust_records'),
        ('administrator', 'manage_sources'),
        ('administrator', 'review_sources'),
        ('administrator', 'withdraw_sources'),
        ('administrator', 'manage_citations'),
        ('administrator', 'manage_credits'),
        ('editor', 'view_trust_records'),
        ('editor', 'manage_sources'),
        ('editor', 'manage_citations'),
        ('editor', 'manage_credits'),
        ('reviewer', 'view_trust_records'),
        ('reviewer', 'review_sources'),
        ('registry_editor', 'view_trust_records'),
        ('registry_editor', 'manage_sources'),
        ('registry_editor', 'manage_citations')
    ) expected(role_key, capability_key)
    where not exists (
      select 1
      from public.role_capabilities assigned
      where assigned.role_key = expected.role_key
        and assigned.capability_key =
          expected.capability_key
    )
  ) then
    raise exception
      'One or more Phase 3A trust role assignments are missing';
  end if;

  if exists (
    select 1
    from public.role_capabilities
    where role_key = 'author'
      and capability_key in (
        'view_trust_records',
        'manage_sources',
        'review_sources',
        'withdraw_sources',
        'manage_citations',
        'manage_credits'
      )
  ) then
    raise exception
      'Author received a Phase 3A trust capability';
  end if;

  foreach v_table in array array[
    'source_types',
    'citation_locator_types',
    'credit_roles',
    'sources',
    'source_versions',
    'source_review_events',
    'external_contributors',
    'credits',
    'credit_governance'
  ]
  loop
    if not exists (
      select 1
      from pg_class relation
      join pg_namespace namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname = 'editorial'
        and relation.relname = v_table
        and relation.relrowsecurity
    ) then
      raise exception
        'RLS is not enabled on editorial.%', v_table;
    end if;
  end loop;

  if to_regprocedure(
    'editorial.source_snapshot_fingerprint(text,text,text,text,text,uuid,text,date,date,date,text,text,text,text,text,text,text,text,text)'
  ) is null then
    raise exception
      'Source snapshot fingerprint function is missing';
  end if;

  if to_regprocedure(
    'editorial.assert_source_version_pointer_integrity()'
  ) is null then
    raise exception
      'Source pointer-integrity function is missing';
  end if;

  if to_regprocedure(
    'editorial.protect_source_version()'
  ) is null then
    raise exception
      'Source-version immutability function is missing';
  end if;

  if to_regprocedure(
    'editorial.protect_source_review_event()'
  ) is null then
    raise exception
      'Source-review append-only function is missing';
  end if;

  if to_regprocedure(
    'editorial.assert_credit_governance_integrity()'
  ) is null then
    raise exception
      'Credit-governance integrity function is missing';
  end if;

  if to_regprocedure(
    'editorial.protect_credit()'
  ) is null then
    raise exception
      'Credit immutability function is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'sources_version_pointer_integrity'
      and not tgisinternal
  ) then
    raise exception
      'Source-version pointer-integrity trigger is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'source_versions_immutable'
      and not tgisinternal
  ) then
    raise exception
      'Source-version immutability trigger is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'source_review_events_append_only'
      and not tgisinternal
  ) then
    raise exception
      'Source-review append-only trigger is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'credit_governance_integrity'
      and not tgisinternal
  ) then
    raise exception
      'Credit-governance integrity trigger is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'credits_immutable'
      and not tgisinternal
  ) then
    raise exception
      'Credit immutability trigger is missing';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'editorial.credits'::regclass
      and conname = 'credits_exactly_one_party_check'
      and pg_get_constraintdef(oid, true)
        ilike '%num_nonnulls%'
  ) then
    raise exception
      'Exactly-one credited-party constraint is missing';
  end if;

  if exists (
    select 1
    from pg_constraint
    where conrelid = 'editorial.credits'::regclass
      and conname in (
        'credits_user_id_fkey',
        'credits_registry_author_id_fkey',
        'credits_external_contributor_id_fkey'
      )
      and confdeltype <> 'r'
  ) then
    raise exception
      'One or more credited-party foreign keys do not use delete restriction';
  end if;

  if (
    select count(*)
    from pg_constraint
    where conrelid = 'editorial.credits'::regclass
      and conname in (
        'credits_user_id_fkey',
        'credits_registry_author_id_fkey',
        'credits_external_contributor_id_fkey'
      )
      and confdeltype = 'r'
  ) <> 3 then
    raise exception
      'All three credited-party delete-restriction foreign keys were not found';
  end if;

  if (
    select count(*)
    from pg_constraint
    where conrelid = 'editorial.sources'::regclass
      and conname in (
        'sources_current_working_version_fkey',
        'sources_current_submitted_version_fkey',
        'sources_current_approved_version_fkey'
      )
      and condeferrable
      and condeferred
      and confdeltype = 'r'
  ) <> 3 then
    raise exception
      'Source-version pointers are not deferred delete-restriction foreign keys';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'editorial.source_versions'::regclass
      and conname = 'source_versions_media_asset_id_fkey'
      and confdeltype = 'r'
  ) then
    raise exception
      'Immutable Source-version Media identity does not use delete restriction';
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname in (
      'sources_reviewed_by_fkey',
      'sources_withdrawn_by_fkey',
      'source_versions_created_by_fkey',
      'source_review_events_actor_id_fkey',
      'credits_created_by_fkey'
    )
      and conrelid in (
        'editorial.sources'::regclass,
        'editorial.source_versions'::regclass,
        'editorial.source_review_events'::regclass,
        'editorial.credits'::regclass
      )
  ) then
    raise exception
      'Historical actor UUID snapshots unexpectedly have foreign keys';
  end if;

  if exists (
    select 1
    from pg_constraint
    where conrelid = 'editorial.source_versions'::regclass
      and confdeltype = 'n'
  ) then
    raise exception
      'Immutable Source versions contain a set-null foreign key';
  end if;

  if exists (
    select 1
    from pg_constraint
    where conrelid = 'editorial.source_review_events'::regclass
      and confdeltype = 'n'
  ) then
    raise exception
      'Append-only Source review events contain a set-null foreign key';
  end if;

  if exists (
    select 1
    from pg_constraint
    where conrelid = 'editorial.credits'::regclass
      and confdeltype = 'n'
  ) then
    raise exception
      'Immutable Credits contain a set-null foreign key';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'editorial.credit_governance'::regclass
      and conname = 'credit_governance_credit_id_fkey'
      and confdeltype = 'r'
  ) then
    raise exception
      'Credit governance does not preserve immutable Credit identity';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'editorial'
      and table_name = 'credits'
      and column_name in (
        'public_safe',
        'credit_state',
        'governance_revision'
      )
  ) then
    raise exception
      'Mutable governance fields remain on immutable Credits';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'editorial'
      and table_name = 'credit_governance'
      and column_name = 'governance_revision'
      and data_type = 'bigint'
  ) then
    raise exception
      'Credit-governance revision authority is missing';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants grant_row
    where grant_row.table_schema = 'editorial'
      and grant_row.table_name in (
        'source_types',
        'citation_locator_types',
        'credit_roles',
        'sources',
        'source_versions',
        'source_review_events',
        'external_contributors',
        'credits',
        'credit_governance'
      )
      and grant_row.grantee in ('anon', 'PUBLIC')
  ) then
    raise exception
      'Anonymous or public grants exist on canonical trust tables';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants grant_row
    where grant_row.table_schema = 'editorial'
      and grant_row.table_name in (
        'source_types',
        'citation_locator_types',
        'credit_roles',
        'sources',
        'source_versions',
        'source_review_events',
        'external_contributors',
        'credits',
        'credit_governance'
      )
      and grant_row.grantee = 'authenticated'
      and grant_row.privilege_type <> 'SELECT'
  ) then
    raise exception
      'Authenticated has direct mutation grants on trust tables';
  end if;

  if (
    select count(*)
    from editorial.source_types
  ) <> 15 then
    raise exception
      'Unexpected Source-type seed count';
  end if;

  if (
    select count(*)
    from editorial.citation_locator_types
  ) <> 15 then
    raise exception
      'Unexpected Citation-locator seed count';
  end if;

  if (
    select count(*)
    from editorial.credit_roles
  ) <> 16 then
    raise exception
      'Unexpected Credit-role seed count';
  end if;
end;
$verify_phase_3a_trust_identity$;

select
  'PASS: Phase 3A trust identity foundation verified.'
    as result;
