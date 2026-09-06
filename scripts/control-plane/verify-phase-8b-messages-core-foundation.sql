-- Phase 8B.2 Messages Core Foundation replay verifier.
-- Read-only structural verification; transaction is rolled back.

begin;

do $verify$
declare
  v_admin_capabilities bigint;
  v_super_capabilities bigint;
  v_super_assignments bigint;
  v_missing_admin_capabilities bigint;
  v_control_center_roles bigint;
begin
  if (select count(*) from supabase_migrations.schema_migrations) <> 95
     or (select max(version) from supabase_migrations.schema_migrations)
        <> '20260906121902'
  then
    raise exception
      'STOP: expected exact 95 / 20260906121902 migration authority';
  end if;

  if to_regnamespace('messaging') is null then
    raise exception 'STOP: messaging schema is missing';
  end if;

  if to_regclass('messaging.conversations') is null
     or to_regclass('messaging.conversation_participants') is null
     or to_regclass('messaging.messages') is null
     or to_regclass('messaging.message_receipts') is null
     or to_regclass('messaging.message_resource_references') is null
     or to_regclass('messaging.user_sender_policies') is null
     or to_regclass('messaging.sender_approvals') is null
     or to_regclass('messaging.runtime_policy') is null
  then
    raise exception 'STOP: one or more Messages core tables are missing';
  end if;

  if not exists (
    select 1
    from public.role_definitions
    where role_key='super_admin'
      and priority=1
      and is_system
  ) then
    raise exception 'STOP: super_admin role definition is invalid';
  end if;

  if not exists (
    select 1
    from public.capability_definitions
    where capability_key='manage_messages_control_center'
      and domain='messages'
  ) then
    raise exception 'STOP: Messages Control Center capability is missing';
  end if;

  select count(*) into v_admin_capabilities
  from public.role_capabilities
  where role_key='administrator';

  select count(*) into v_super_capabilities
  from public.role_capabilities
  where role_key='super_admin';

  select count(*) into v_missing_admin_capabilities
  from public.role_capabilities admin_cap
  where admin_cap.role_key='administrator'
    and not exists (
      select 1
      from public.role_capabilities super_cap
      where super_cap.role_key='super_admin'
        and super_cap.capability_key=admin_cap.capability_key
    );

  select count(*) into v_control_center_roles
  from public.role_capabilities
  where capability_key='manage_messages_control_center';

  select count(*) into v_super_assignments
  from public.user_role_assignments
  where role_key='super_admin';

  if v_missing_admin_capabilities <> 0
     or v_super_capabilities <> v_admin_capabilities + 1
  then
    raise exception
      'STOP: super_admin capability inheritance is invalid';
  end if;

  if v_control_center_roles <> 1
     or not exists (
       select 1
       from public.role_capabilities
       where role_key='super_admin'
         and capability_key='manage_messages_control_center'
     )
  then
    raise exception
      'STOP: Messages Control Center capability leaked beyond super_admin';
  end if;

  if v_super_assignments <> 0 then
    raise exception
      'STOP: structural migration unexpectedly assigned super_admin';
  end if;

  if (select count(*) from messaging.runtime_policy) <> 1
     or not exists (
       select 1
       from messaging.runtime_policy
       where singleton
         and audience_mode='internal'
         and revision=1
         and updated_by is null
     )
  then
    raise exception 'STOP: Messages runtime policy singleton is invalid';
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='messaging'
      and c.relkind='r'
      and not c.relrowsecurity
  ) then
    raise exception 'STOP: one or more Messages tables lost RLS';
  end if;

  if exists (
    select 1
    from information_schema.table_privileges
    where table_schema='messaging'
      and grantee in ('anon','authenticated')
  ) then
    raise exception 'STOP: browser role has direct Messages table privilege';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname='messaging'
      and tablename='message_resource_references'
      and indexname='message_resource_references_resource_identity_key'
      and indexdef ilike '%where (presentation_kind = ''resource''::text)%'
  )
     or not exists (
       select 1
       from pg_indexes
       where schemaname='messaging'
         and tablename='message_resource_references'
         and indexname='message_resource_references_version_identity_key'
         and indexdef ilike '%where (presentation_kind = ''version''::text)%'
     )
  then
    raise exception
      'STOP: Resource reference partial uniqueness contract drifted';
  end if;

  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='messaging'
      and c.relname='messages'
      and t.tgname='messages_immutable'
      and not t.tgisinternal
  )
     or not exists (
       select 1
       from pg_trigger t
       join pg_class c on c.oid=t.tgrelid
       join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='messaging'
         and c.relname='message_resource_references'
         and t.tgname='message_resource_references_immutable'
         and not t.tgisinternal
     )
  then
    raise exception 'STOP: immutable Messages trigger contract drifted';
  end if;
end;
$verify$;

select messaging.verify_core_foundation() as messages_core_foundation;

select jsonb_build_object(
  'verification', 'PASS',
  'migration_count',
    (select count(*) from supabase_migrations.schema_migrations),
  'migration_head',
    (select max(version) from supabase_migrations.schema_migrations),
  'administrator_capabilities',
    (select count(*) from public.role_capabilities where role_key='administrator'),
  'super_admin_capabilities',
    (select count(*) from public.role_capabilities where role_key='super_admin'),
  'super_admin_assignments',
    (select count(*) from public.user_role_assignments where role_key='super_admin'),
  'audience_mode',
    (select audience_mode from messaging.runtime_policy),
  'messaging_tables',
    (
      select count(*)
      from pg_class c
      join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='messaging' and c.relkind='r'
    )
) as phase_8b_messages_core_foundation_acceptance;

rollback;
