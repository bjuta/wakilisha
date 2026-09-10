-- Permanent read-only verifier for Messages Operations UX Gate C picker reads.

begin;
set transaction read only;

do $verify$
declare
  v_count bigint;
  v_head text;
  v_scope_def text;
  v_reviewer_def text;
  v_scope_normalized text;
  v_reviewer_normalized text;
begin
  select count(*), max(version)
  into v_count, v_head
  from supabase_migrations.schema_migrations;

  if v_count <> 113
     or v_head <> '20260910103000'
  then
    raise exception
      'GATE_C_PICKER_READ_FAIL: expected exact 113 / 20260910103000 migration authority';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260910103000'
      and name = 'messages_operations_ux_gate_c_legal_picker_reads'
  ) then
    raise exception
      'GATE_C_PICKER_READ_FAIL: Gate C picker migration history missing';
  end if;

  if to_regprocedure(
       'public.search_messages_legal_scope_targets_v1(uuid,text,text,integer)'
     ) is null
     or to_regprocedure(
       'public.search_messages_legal_reviewers_v1(uuid,text,integer)'
     ) is null
  then
    raise exception
      'GATE_C_PICKER_READ_FAIL: required picker RPC signatures are missing';
  end if;

  if pg_get_function_result(
       'public.search_messages_legal_scope_targets_v1(uuid,text,text,integer)'::regprocedure
     ) <> 'TABLE(target_kind text, target_id uuid, label text, context text, occurred_at timestamp with time zone, related_id uuid)'
  then
    raise exception
      'GATE_C_PICKER_READ_FAIL: scope target return contract drifted';
  end if;

  if pg_get_function_result(
       'public.search_messages_legal_reviewers_v1(uuid,text,integer)'::regprocedure
     ) <> 'TABLE(user_id uuid, display_name text, secondary_label text)'
  then
    raise exception
      'GATE_C_PICKER_READ_FAIL: reviewer return contract drifted';
  end if;

  if not exists (
    select 1
    from pg_proc procedure_row
    join pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'search_messages_legal_scope_targets_v1'
      and procedure_row.provolatile = 's'
      and procedure_row.prosecdef
  ) or not exists (
    select 1
    from pg_proc procedure_row
    join pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and procedure_row.proname = 'search_messages_legal_reviewers_v1'
      and procedure_row.provolatile = 's'
      and procedure_row.prosecdef
  ) then
    raise exception
      'GATE_C_PICKER_READ_FAIL: picker RPC volatility/security metadata is incorrect';
  end if;

  if exists (
       select 1
       from information_schema.routine_privileges privilege_row
       where privilege_row.routine_schema = 'public'
         and privilege_row.routine_name = 'search_messages_legal_scope_targets_v1'
         and privilege_row.grantee = 'PUBLIC'
         and privilege_row.privilege_type = 'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.search_messages_legal_scope_targets_v1(uuid,text,text,integer)'::regprocedure,
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.search_messages_legal_scope_targets_v1(uuid,text,text,integer)'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.search_messages_legal_scope_targets_v1(uuid,text,text,integer)'::regprocedure,
       'EXECUTE'
     )
  then
    raise exception
      'GATE_C_PICKER_READ_FAIL: scope target RPC grants are incorrect';
  end if;

  if exists (
       select 1
       from information_schema.routine_privileges privilege_row
       where privilege_row.routine_schema = 'public'
         and privilege_row.routine_name = 'search_messages_legal_reviewers_v1'
         and privilege_row.grantee = 'PUBLIC'
         and privilege_row.privilege_type = 'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.search_messages_legal_reviewers_v1(uuid,text,integer)'::regprocedure,
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.search_messages_legal_reviewers_v1(uuid,text,integer)'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.search_messages_legal_reviewers_v1(uuid,text,integer)'::regprocedure,
       'EXECUTE'
     )
  then
    raise exception
      'GATE_C_PICKER_READ_FAIL: reviewer RPC grants are incorrect';
  end if;

  v_scope_def := lower(
    pg_get_functiondef(
      'public.search_messages_legal_scope_targets_v1(uuid,text,text,integer)'::regprocedure
    )
  );
  v_reviewer_def := lower(
    pg_get_functiondef(
      'public.search_messages_legal_reviewers_v1(uuid,text,integer)'::regprocedure
    )
  );

  v_scope_normalized := regexp_replace(v_scope_def, '\s+', '', 'g');
  v_reviewer_normalized := regexp_replace(v_reviewer_def, '\s+', '', 'g');

  if position(
       'require_messages_legal_capability(''manage_messages_legal_cases'')'
       in v_scope_normalized
     ) = 0
     or position(
       'frommessaging.legal_request_cases'
       in v_scope_normalized
     ) = 0
     or position(
       'wherelegal_case.id=p_case_id'
       in v_scope_normalized
     ) = 0
     or position(
       'least(greatest(coalesce(p_limit,20),1),20)'
       in v_scope_normalized
     ) = 0
     or position('messaging.messages' in v_scope_normalized) = 0
     or position('messaging.conversations' in v_scope_normalized) = 0
     or position('media.file_objects' in v_scope_normalized) = 0
     or position('editorial.resource_versions' in v_scope_normalized) = 0
  then
    raise exception
      'GATE_C_PICKER_READ_FAIL: scope target capability/case/bound/search authority is incomplete';
  end if;

  if v_scope_def ~ '\m(insert|update|delete)\M'
     or position('platform_private.' in v_scope_def) > 0
     or position('legal_case_events' in v_scope_def) > 0
     or position('.body' in v_scope_def) > 0
     or position('storage_path' in v_scope_def) > 0
     or position('delivery_url' in v_scope_def) > 0
     or position('technical_metadata' in v_scope_def) > 0
     or position('content_fingerprint' in v_scope_def) > 0
     or position('sha256' in v_scope_def) > 0
  then
    raise exception
      'GATE_C_PICKER_READ_FAIL: scope target projection exposes or mutates prohibited authority';
  end if;

  if position(
       'require_messages_legal_capability(''manage_messages_legal_cases'')'
       in v_reviewer_normalized
     ) = 0
     or position(
       'frommessaging.legal_request_cases'
       in v_reviewer_normalized
     ) = 0
     or position(
       'wherelegal_case.id=p_case_id'
       in v_reviewer_normalized
     ) = 0
     or position(
       'assignment.role_key=''super_admin'''
       in v_reviewer_normalized
     ) = 0
     or position(
       'assignment.status=''active'''
       in v_reviewer_normalized
     ) = 0
     or position(
       'role_capability.capability_key=''manage_messages_legal_cases'''
       in v_reviewer_normalized
     ) = 0
     or position(
       'profile.status=''active'''
       in v_reviewer_normalized
     ) = 0
     or position(
       'person.person_state=''active'''
       in v_reviewer_normalized
     ) = 0
     or position(
       'identity_link.link_state=''active'''
       in v_reviewer_normalized
     ) = 0
     or position(
       'least(greatest(coalesce(p_limit,20),1),20)'
       in v_reviewer_normalized
     ) = 0
  then
    raise exception
      'GATE_C_PICKER_READ_FAIL: reviewer eligibility/case/bound authority is incomplete';
  end if;

  if v_reviewer_def ~ '\m(insert|update|delete)\M'
     or position('platform_private.' in v_reviewer_def) > 0
     or position('legal_case_events' in v_reviewer_def) > 0
     or position('profile.email' in v_reviewer_def) > 0
     or position('profile.metadata' in v_reviewer_def) > 0
     or position('auth.users' in v_reviewer_def) > 0
  then
    raise exception
      'GATE_C_PICKER_READ_FAIL: reviewer projection exposes or mutates prohibited authority';
  end if;

  if (select count(*) from information_schema.tables
      where table_type = 'BASE TABLE' and table_schema = 'editorial') <> 90
     or (select count(*) from information_schema.tables
         where table_type = 'BASE TABLE' and table_schema = 'media') <> 17
     or (select count(*) from information_schema.tables
         where table_type = 'BASE TABLE' and table_schema = 'messaging') <> 22
     or (select count(*) from information_schema.tables
         where table_type = 'BASE TABLE' and table_schema = 'public') <> 212
  then
    raise exception
      'GATE_C_PICKER_READ_FAIL: Gate C introduced table authority';
  end if;

  raise notice 'GATE_C_PICKER_READ_VERIFIER=PASS';
end
$verify$;

rollback;
