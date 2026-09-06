-- WAKILISHA Phase 8B Messages core verifier runtime-state independence.
-- Read-only structural verification; transaction is rolled back.

begin;

do $verify$
declare
  v_def text;
  v_result jsonb;
  v_migration_count bigint;
  v_head text;
begin
  select count(*), max(version)
  into v_migration_count, v_head
  from supabase_migrations.schema_migrations;

  if v_migration_count <> 102
     or v_head <> '20260907003000'
  then
    raise exception
      'STOP: expected 102 migrations at Phase 8B.3 repaired head 20260907003000, got count=% head=%',
      v_migration_count,
      v_head;
  end if;

  if to_regprocedure(
       'messaging.verify_core_foundation()'
     ) is null
  then
    raise exception
      'STOP: Messages core verifier is missing';
  end if;

  select pg_get_functiondef(
    'messaging.verify_core_foundation()'::regprocedure
  )
  into v_def;

  if position(
       'structural Messages migration unexpectedly assigned super_admin'
       in v_def
     ) <> 0
  then
    raise exception
      'STOP: Messages core verifier is still coupled to runtime super_admin assignments';
  end if;

  if position(
       'manage_messages_control_center'
       in v_def
     ) = 0
     or position(
          'browser role has direct Messages table privilege'
          in v_def
        ) = 0
     or position(
          'Messages runtime policy singleton is invalid'
          in v_def
        ) = 0
  then
    raise exception
      'STOP: repaired Messages core verifier lost structural checks';
  end if;

  v_result := messaging.verify_core_foundation();

  if not coalesce(
       (v_result ->> 'ok')::boolean,
       false
     )
  then
    raise exception
      'STOP: repaired Messages core verifier did not pass';
  end if;
end;
$verify$;

select jsonb_build_object(
  'verification', 'PASS',
  'migration_count', (
    select count(*)
    from supabase_migrations.schema_migrations
  ),
  'migration_head', (
    select max(version)
    from supabase_migrations.schema_migrations
  ),
  'core_verifier',
    messaging.verify_core_foundation(),
  'active_super_admin_assignments', (
    select count(*)
    from public.user_role_assignments
    where role_key='super_admin'
      and status='active'
      and (
        expires_at is null
        or expires_at > now()
      )
  ),
  'runtime_assignment_independence',
    true
) as phase_8b_messages_core_verifier_runtime_state_independence;

rollback;
