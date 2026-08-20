-- Read-only verifier for the Phase 6A closure Article/admin authority repair.

do $verify$
declare
  orphan_article_count bigint;
  missing_working_version_count bigint;
begin
  if to_regprocedure(
    'editorial.ensure_article_resource_identity(uuid,uuid)'
  ) is null then
    raise exception
      'STOP: ensure_article_resource_identity is missing';
  end if;

  if to_regprocedure(
    'editorial.provision_article_resource_identity_after_insert()'
  ) is null then
    raise exception
      'STOP: Article provisioning trigger function is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid =
      'public.wk_articles'::regclass
      and trigger_row.tgname =
        'wk_articles_provision_resource_identity'
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'STOP: Article provisioning trigger is missing';
  end if;

  if has_function_privilege(
    'public',
    'editorial.ensure_article_resource_identity(uuid,uuid)',
    'execute'
  ) then
    raise exception
      'STOP: PUBLIC can execute Article identity helper';
  end if;

  if has_function_privilege(
    'public',
    'editorial.provision_article_resource_identity_after_insert()',
    'execute'
  ) then
    raise exception
      'STOP: PUBLIC can execute Article provisioning trigger function';
  end if;

  if not has_table_privilege(
    'authenticated',
    'public.admin_user_invites',
    'select'
  ) then
    raise exception
      'STOP: authenticated lacks admin_user_invites SELECT';
  end if;

  if not has_table_privilege(
    'authenticated',
    'public.admin_audit_events',
    'select'
  ) then
    raise exception
      'STOP: authenticated lacks admin_audit_events SELECT';
  end if;

  if not has_table_privilege(
    'authenticated',
    'public.admin_account_recovery_events',
    'select'
  ) then
    raise exception
      'STOP: authenticated lacks admin_account_recovery_events SELECT';
  end if;

  if has_table_privilege(
    'anon',
    'public.admin_user_invites',
    'select'
  ) or has_table_privilege(
    'anon',
    'public.admin_audit_events',
    'select'
  ) or has_table_privilege(
    'anon',
    'public.admin_account_recovery_events',
    'select'
  ) then
    raise exception
      'STOP: anon unexpectedly has administrator table SELECT';
  end if;

  if not exists (
    select 1
    from pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename = 'admin_user_invites'
      and policy.policyname =
        'admin_user_invites_admin_read'
      and policy.cmd = 'SELECT'
      and policy.qual like
        '%current_user_is_administrator()%'
  ) then
    raise exception
      'STOP: admin_user_invites administrator RLS is missing';
  end if;

  if not exists (
    select 1
    from pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename = 'admin_audit_events'
      and policy.policyname =
        'admin_audit_events_admin_read'
      and policy.cmd = 'SELECT'
      and policy.qual like
        '%current_user_is_administrator()%'
  ) then
    raise exception
      'STOP: admin_audit_events administrator RLS is missing';
  end if;

  if not exists (
    select 1
    from pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename =
        'admin_account_recovery_events'
      and policy.policyname =
        'admin_account_recovery_events_admin_read'
      and policy.cmd = 'SELECT'
      and policy.qual like
        '%current_user_is_administrator()%'
  ) then
    raise exception
      'STOP: admin_account_recovery_events administrator RLS is missing';
  end if;

  select count(*)
  into orphan_article_count
  from public.wk_articles article
  where not exists (
    select 1
    from editorial.article_resources binding
    where binding.article_id = article.id
  );

  if orphan_article_count <> 0 then
    raise exception
      'STOP: % Article rows lack canonical resource identity',
      orphan_article_count;
  end if;

  select count(*)
  into missing_working_version_count
  from editorial.article_resources binding
  join editorial.resources resource
    on resource.id = binding.resource_id
  where resource.current_working_version_id is null;

  if missing_working_version_count <> 0 then
    raise exception
      'STOP: % Article resources lack a working version',
      missing_working_version_count;
  end if;

  raise notice
    'PASS: Phase 6A closure admin reads and Article identity authority are intact.';
end;
$verify$;
