-- WAKILISHA Phase 8B.3 Messages Product + Super Admin Control Center verifier.
-- Read-only. Rolls back its transaction.

begin;

do $verify$
declare
  v_migration_count bigint;
  v_head text;
  v_super_assignments bigint;
  v_bad_capability_mappings bigint;
  v_rpc_count bigint;
  v_anon_exec bigint;
  v_authenticated_exec bigint;
  v_search_def text;
  v_access_def text;
  v_control_def text;
begin
  select count(*), max(version)
  into v_migration_count,v_head
  from supabase_migrations.schema_migrations;

  if v_migration_count<>102
     or v_head<>'20260907003000' then
    raise exception
      'STOP: expected 102 migrations at final Phase 8B.3 head 20260907003000, got count=% head=%',
      v_migration_count,
      v_head;
  end if;

  if not coalesce((messaging.verify_core_foundation()->>'ok')::boolean,false) then
    raise exception 'STOP: Candidate A Messages core verifier failed';
  end if;

  select count(*)
  into v_bad_capability_mappings
  from public.role_capabilities
  where capability_key='manage_messages_control_center'
    and role_key<>'super_admin';

  if v_bad_capability_mappings<>0 then
    raise exception 'STOP: Messages Control Center capability leaked beyond super_admin';
  end if;

  if not exists (
    select 1
    from public.role_capabilities
    where role_key='super_admin'
      and capability_key='manage_messages_control_center'
  ) then
    raise exception 'STOP: super_admin lacks Messages Control Center capability';
  end if;

  select count(*)
  into v_super_assignments
  from public.user_role_assignments
  where role_key='super_admin'
    and status='active'
    and (expires_at is null or expires_at>now());

  select count(*)
  into v_rpc_count
  from pg_proc procedure
  join pg_namespace namespace
    on namespace.oid=procedure.pronamespace
  where namespace.nspname='public'
    and pg_get_function_identity_arguments(procedure.oid) in (
      'p_query text, p_limit integer',
      ''
    )
    and procedure.proname in (
      'search_message_recipients',
      'get_my_message_access',
      'get_messages_control_center_status'
    )
    and procedure.prosecdef;

  if v_rpc_count<>3 then
    raise exception 'STOP: expected three SECURITY DEFINER Phase 8B.3 Messages RPCs, got %',v_rpc_count;
  end if;

  select count(*)
  into v_anon_exec
  from pg_proc procedure
  join pg_namespace namespace
    on namespace.oid=procedure.pronamespace
  where namespace.nspname='public'
    and procedure.proname in (
      'search_message_recipients',
      'get_my_message_access',
      'get_messages_control_center_status'
    )
    and has_function_privilege(
      'anon',
      procedure.oid,
      'EXECUTE'
    );

  if v_anon_exec<>0 then
    raise exception 'STOP: anon can execute a Phase 8B.3 Messages RPC';
  end if;

  select count(*)
  into v_authenticated_exec
  from pg_proc procedure
  join pg_namespace namespace
    on namespace.oid=procedure.pronamespace
  where namespace.nspname='public'
    and procedure.proname in (
      'search_message_recipients',
      'get_my_message_access',
      'get_messages_control_center_status'
    )
    and has_function_privilege(
      'authenticated',
      procedure.oid,
      'EXECUTE'
    );

  if v_authenticated_exec<>3 then
    raise exception 'STOP: authenticated execute contract incomplete for Phase 8B.3 Messages RPCs';
  end if;

  select pg_get_functiondef(
    'public.search_message_recipients(text,integer)'::regprocedure
  )
  into v_search_def;

  if position('audience_allows_category' in v_search_def)=0
     or position('person_blocked_between' in v_search_def)=0
     or position('current_human_identity' in v_search_def)=0 then
    raise exception 'STOP: recipient search is missing audience/block/identity enforcement';
  end if;

  select pg_get_functiondef(
    'public.get_my_message_access()'::regprocedure
  )
  into v_access_def;

  if position('audience_allows_category' in v_access_def)=0
     or position('has_conversations' in v_access_def)=0
     or position('current_human_identity' in v_access_def)=0 then
    raise exception 'STOP: Messages access RPC is missing audience/history/identity enforcement';
  end if;

  select pg_get_functiondef(
    'public.get_messages_control_center_status()'::regprocedure
  )
  into v_control_def;

  if position('super_admin' in v_control_def)=0
     or position('manage_messages_control_center' in v_control_def)=0
     or position('current_user_has_capability' in v_control_def)=0 then
    raise exception 'STOP: Control Center RPC is missing explicit Super Admin authority checks';
  end if;

  if position('body' in lower(v_control_def))>0 then
    raise exception 'STOP: Control Center aggregate RPC must not expose Message bodies';
  end if;
end
$verify$;

select jsonb_build_object(
  'verification','PASS',
  'migration_count',(
    select count(*)
    from supabase_migrations.schema_migrations
  ),
  'migration_head',(
    select max(version)
    from supabase_migrations.schema_migrations
  ),
  'audience_mode',(
    select audience_mode
    from messaging.runtime_policy
    where singleton
  ),
  'phase_8b_3_rpcs',3,
  'super_admin_assignments',(
    select count(*)
    from public.user_role_assignments
    where role_key='super_admin'
      and status='active'
      and (expires_at is null or expires_at>now())
  ),
  'candidate_a_verifier',messaging.verify_core_foundation()
) as phase_8b_3_messages_product_control_center_verification;

rollback;
