-- Read-only independent acceptance for MIZIZI Headquarters DB01.
-- Run on isolated Preview after canonical migration replay and target DB01.
do $mizizi_db01_verifier$
declare
  v_table text;
  v_trigger text;
  v_count bigint;
begin
  if to_regnamespace('mizizi_private') is null then
    raise exception 'DB01 verifier: missing existing schema';
  end if;

  foreach v_table in array array['workspaces','workspace_memberships','workspace_events'] loop
    if to_regclass('mizizi_private.' || v_table) is null then
      raise exception 'DB01 verifier: missing %.%', 'mizizi_private', v_table;
    end if;

    if not exists (
      select 1 from pg_class c
      where c.oid = ('mizizi_private.' || v_table)::regclass
        and c.relrowsecurity and c.relforcerowsecurity
    ) then
      raise exception 'DB01 verifier: RLS / FORCE RLS missing for %', v_table;
    end if;

    if has_table_privilege('anon', ('mizizi_private.' || v_table)::regclass, 'SELECT')
      or has_table_privilege('authenticated', ('mizizi_private.' || v_table)::regclass, 'SELECT')
      or has_table_privilege('authenticated', ('mizizi_private.' || v_table)::regclass, 'INSERT')
      or has_table_privilege('authenticated', ('mizizi_private.' || v_table)::regclass, 'UPDATE')
      or has_table_privilege('authenticated', ('mizizi_private.' || v_table)::regclass, 'DELETE')
      or has_table_privilege('service_role', ('mizizi_private.' || v_table)::regclass, 'SELECT')
      or has_table_privilege('service_role', ('mizizi_private.' || v_table)::regclass, 'INSERT')
      or has_table_privilege('service_role', ('mizizi_private.' || v_table)::regclass, 'UPDATE')
      or has_table_privilege('service_role', ('mizizi_private.' || v_table)::regclass, 'DELETE')
      or has_table_privilege('mizizi_executor', ('mizizi_private.' || v_table)::regclass, 'INSERT') then
      raise exception 'DB01 verifier: unauthorized table grant exists on %', v_table;
    end if;

  end loop;

  select count(*) into v_count from mizizi_private.workspaces;
  if v_count <> 1 or not exists (
    select 1 from mizizi_private.workspaces
    where workspace_key='wakilisha-internal'
      and workspace_kind='internal'
      and owner_type='platform'
      and owner_ref='wakilisha'
      and display_name='WAKILISHA'
      and status='active'
      and retention_policy_key='pending_policy_review'
  ) then
    raise exception 'DB01 verifier: internal workspace seed mismatch';
  end if;

  if not exists (
    select 1 from mizizi_private.workspace_events
    where event_key='workspace:wakilisha-internal:created:v1'
      and event_type='workspace_created'
      and actor_key='system:mizizi_db01_seed'
  ) then
    raise exception 'DB01 verifier: missing immutable workspace creation receipt';
  end if;

  foreach v_trigger in array array[
    'mizizi_workspaces_immutable',
    'mizizi_workspaces_creation_journal',
    'mizizi_workspace_memberships_guard',
    'mizizi_workspace_memberships_journal',
    'mizizi_workspace_events_append_only'
  ] loop
    if not exists (
      select 1 from pg_trigger t
      where t.tgname=v_trigger and not t.tgisinternal and t.tgenabled='O'
    ) then
      raise exception 'DB01 verifier: required trigger % missing or disabled', v_trigger;
    end if;
  end loop;

  if not exists (
    select 1 from pg_constraint
    where conname='mizizi_workspace_memberships_start_unique'
      and conrelid='mizizi_private.workspace_memberships'::regclass
      and contype='u'
  ) or not exists (
    select 1 from pg_indexes
    where schemaname='mizizi_private'
      and tablename='workspace_memberships'
      and indexname='mizizi_workspace_memberships_unrevoked_unique'
  ) then
    raise exception 'DB01 verifier: membership uniqueness boundary missing';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname='workspace_memberships_user_id_fkey'
      and conrelid='mizizi_private.workspace_memberships'::regclass
      and contype='f'
  ) then
    raise exception 'DB01 verifier: auth.users membership FK missing';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname='mizizi_private'
      and tablename='workspace_events'
      and indexname='mizizi_workspace_events_membership_revision_unique'
  ) then
    raise exception 'DB01 verifier: immutable membership event uniqueness missing';
  end if;

  if has_function_privilege('anon','mizizi_private.journal_workspace_membership_v1()','EXECUTE')
    or has_function_privilege('authenticated','mizizi_private.journal_workspace_membership_v1()','EXECUTE')
    or has_function_privilege('service_role','mizizi_private.journal_workspace_membership_v1()','EXECUTE') then
    raise exception 'DB01 verifier: journal trigger function exposed';
  end if;

  raise notice 'MIZIZI_DB01_VERIFIER=PASS';
end;
$mizizi_db01_verifier$;
