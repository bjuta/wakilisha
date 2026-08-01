-- Phase 3A Migration 2 verifier.
-- Read-only verification for the trust attachment foundation.

do $verify$
declare
  v_table text;
  v_function text;
  v_trigger record;
  v_rls_enabled boolean;
  v_has_authenticated_write boolean;
  v_has_anon_policy boolean;
  v_validation_failed boolean;
begin
  foreach v_table in array array[
    'source_registry_links',
    'citations',
    'resource_citations',
    'resource_credits',
    'article_version_trust_revisions'
  ]
  loop
    if to_regclass(
      format('editorial.%I', v_table)
    ) is null
    then
      raise exception
        'Missing Phase 3A Migration 2 table: editorial.%',
        v_table;
    end if;
  end loop;

  foreach v_function in array array[
    'validate_citation_locator(text,jsonb)',
    'validate_citation_target_anchor(text,jsonb)',
    'assert_source_registry_link_integrity()',
    'protect_source_registry_link()',
    'assert_citation_integrity()',
    'protect_citation()',
    'assert_article_version_trust_attachment()',
    'assert_primary_author_credit()'
  ]
  loop
    if to_regprocedure(
      format('editorial.%s', v_function)
    ) is null
    then
      raise exception
        'Missing Phase 3A Migration 2 function: editorial.%',
        v_function;
    end if;
  end loop;

  for v_trigger in
    select *
    from (
      values
        (
          'source_registry_links',
          'source_registry_links_integrity'
        ),
        (
          'source_registry_links',
          'source_registry_links_append_only'
        ),
        (
          'citations',
          'citations_integrity'
        ),
        (
          'citations',
          'citations_immutable'
        ),
        (
          'resource_citations',
          'resource_citations_integrity'
        ),
        (
          'resource_credits',
          'resource_credits_integrity'
        ),
        (
          'resource_credits',
          'resource_credits_primary_author'
        )
    ) required_trigger(table_name, trigger_name)
  loop
    if not exists (
      select 1
      from pg_trigger trigger_row
      join pg_class relation
        on relation.oid = trigger_row.tgrelid
      join pg_namespace namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname = 'editorial'
        and relation.relname = v_trigger.table_name
        and trigger_row.tgname = v_trigger.trigger_name
        and not trigger_row.tgisinternal
        and (
          v_trigger.trigger_name <> 'source_registry_links_integrity'
          or (
            trigger_row.tgconstraint <> 0
            and trigger_row.tgdeferrable
          )
        )
    )
    then
      raise exception
        'Missing trigger editorial.%.%',
        v_trigger.table_name,
        v_trigger.trigger_name;
    end if;
  end loop;

  foreach v_table in array array[
    'source_registry_links',
    'citations',
    'resource_citations',
    'resource_credits',
    'article_version_trust_revisions'
  ]
  loop
    select relation.relrowsecurity
    into v_rls_enabled
    from pg_class relation
    join pg_namespace namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'editorial'
      and relation.relname = v_table;

    if not coalesce(v_rls_enabled, false) then
      raise exception
        'RLS is not enabled on editorial.%',
        v_table;
    end if;
  end loop;

  select exists (
    select 1
    from information_schema.role_table_grants privilege
    where privilege.table_schema = 'editorial'
      and privilege.table_name in (
        'source_registry_links',
        'citations',
        'resource_citations',
        'resource_credits',
        'article_version_trust_revisions'
      )
      and privilege.grantee = 'authenticated'
      and privilege.privilege_type in (
        'INSERT',
        'UPDATE',
        'DELETE',
        'TRUNCATE'
      )
  )
  into v_has_authenticated_write;

  if v_has_authenticated_write then
    raise exception
      'Authenticated direct writes exist on Phase 3A Migration 2 tables';
  end if;

  select exists (
    select 1
    from pg_policies policy
    where policy.schemaname = 'editorial'
      and policy.tablename in (
        'source_registry_links',
        'citations',
        'resource_citations',
        'resource_credits',
        'article_version_trust_revisions'
      )
      and (
        'anon' = any(policy.roles)
        or 'public' = any(policy.roles)
      )
  )
  into v_has_anon_policy;

  if v_has_anon_policy then
    raise exception
      'Anonymous or public policies exist on Phase 3A Migration 2 tables';
  end if;

  if not (
    pg_get_functiondef(
      'editorial.protect_citation()'::regprocedure
    ) like '%wakilisha.trusted_citation_lifecycle%'
    and pg_get_functiondef(
      'editorial.protect_citation()'::regprocedure
    ) like '%new.citation_state not in (%'
    and pg_get_functiondef(
      'editorial.protect_citation()'::regprocedure
    ) like '%Citations cannot be deleted%'
    and pg_get_functiondef(
      'editorial.protect_citation()'::regprocedure
    ) like '%may only change citation_state%'
  )
  then
    raise exception
      'Citation lifecycle guard is incomplete';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'editorial'
      and indexname = 'resource_citations_identity_unique'
  )
  then
    raise exception
      'Missing resource Citation identity protection';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'editorial'
      and indexname = 'resource_citations_order_unique'
  )
  then
    raise exception
      'Missing resource Citation ordering protection';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'editorial'
      and indexname = 'resource_credits_identity_unique'
  )
  then
    raise exception
      'Missing resource Credit identity protection';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'editorial'
      and indexname = 'resource_credits_order_unique'
  )
  then
    raise exception
      'Missing resource Credit ordering protection';
  end if;

  perform editorial.validate_citation_locator(
    'page',
    '{"page": 1}'::jsonb
  );

  perform editorial.validate_citation_locator(
    'page_range',
    '{"startPage": 1, "endPage": 2}'::jsonb
  );

  perform editorial.validate_citation_locator(
    'timestamp_range',
    '{"startMilliseconds": 0, "endMilliseconds": 1}'::jsonb
  );

  perform editorial.validate_citation_locator(
    'spreadsheet_cell',
    '{"sheet": "Sheet1", "cell": "C24"}'::jsonb
  );

  perform editorial.validate_citation_locator(
    'whole_source',
    '{}'::jsonb
  );

  perform editorial.validate_citation_target_anchor(
    'whole_version',
    '{}'::jsonb
  );

  perform editorial.validate_citation_target_anchor(
    'character_range',
    '{"start": 0, "end": 1}'::jsonb
  );

  v_validation_failed := false;

  begin
    perform editorial.validate_citation_locator(
      'page',
      '{"page": 0}'::jsonb
    );
  exception
    when others then
      v_validation_failed := true;
  end;

  if not v_validation_failed then
    raise exception
      'Page locator validator accepted an invalid page';
  end if;

  v_validation_failed := false;

  begin
    perform editorial.validate_citation_locator(
      'page_range',
      '{"startPage": 5, "endPage": 2}'::jsonb
    );
  exception
    when others then
      v_validation_failed := true;
  end;

  if not v_validation_failed then
    raise exception
      'Page-range validator accepted an inverted range';
  end if;

  v_validation_failed := false;

  begin
    perform editorial.validate_citation_locator(
      'whole_source',
      '{"extra": true}'::jsonb
    );
  exception
    when others then
      v_validation_failed := true;
  end;

  if not v_validation_failed then
    raise exception
      'Whole-source validator accepted extra keys';
  end if;

  v_validation_failed := false;

  begin
    perform editorial.validate_citation_target_anchor(
      'character_range',
      '{"start": 5, "end": 2}'::jsonb
    );
  exception
    when others then
      v_validation_failed := true;
  end;

  if not v_validation_failed then
    raise exception
      'Character-range validator accepted an inverted range';
  end if;

  if to_regclass('editorial.sources') is null
     or to_regclass('editorial.source_versions') is null
     or to_regclass('editorial.credits') is null
     or to_regclass('editorial.credit_governance') is null
  then
    raise exception
      'Phase 3A Migration 1 trust identity objects are missing';
  end if;
end;
$verify$;

select
  'PASS: Phase 3A trust attachment foundation verified.'
  as result;
