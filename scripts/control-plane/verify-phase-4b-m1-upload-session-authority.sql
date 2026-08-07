\set ON_ERROR_STOP on

begin;

set local statement_timeout = '60s';
set local lock_timeout = '5s';

do $verify_phase_4b_m1$
declare
  v_count bigint;
begin
  if to_regclass('media.upload_sessions') is null then
    raise exception 'FAIL: media.upload_sessions is absent';
  end if;

  if to_regprocedure(
    'public.create_media_upload_session_v1(text,text,text,bigint,text,integer,uuid)'
  ) is null
     or to_regprocedure(
       'public.get_media_upload_session_v1(uuid)'
     ) is null
     or to_regprocedure(
       'public.verify_media_upload_session_v1(uuid,text,bigint,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.expire_media_upload_session_v1(uuid,text)'
     ) is null
     or to_regprocedure(
       'public.fail_media_upload_session_v1(uuid,text)'
     ) is null
     or to_regprocedure(
       'public.cancel_media_upload_session_v1(uuid,text)'
     ) is null
  then
    raise exception 'FAIL: Phase 4B M1 function contract is incomplete';
  end if;

  select count(*)
  into v_count
  from information_schema.role_routine_grants grant_row
  where grant_row.routine_schema = 'public'
    and grant_row.routine_name in (
      'create_media_upload_session_v1',
      'get_media_upload_session_v1',
      'verify_media_upload_session_v1',
      'expire_media_upload_session_v1',
      'fail_media_upload_session_v1',
      'cancel_media_upload_session_v1'
    )
    and grant_row.grantee in ('anon', 'PUBLIC');

  if v_count <> 0 then
    raise exception 'FAIL: anonymous or public upload-session execution grant exists';
  end if;

  if has_table_privilege('authenticated', 'media.upload_sessions', 'select')
     or has_table_privilege('authenticated', 'media.upload_sessions', 'insert')
     or has_table_privilege('authenticated', 'media.upload_sessions', 'update')
     or has_table_privilege('authenticated', 'media.upload_sessions', 'delete')
  then
    raise exception 'FAIL: authenticated has direct upload-session table authority';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.create_media_upload_session_v1(text,text,text,bigint,text,integer,uuid)',
    'execute'
  )
     or not has_function_privilege(
       'authenticated',
       'public.get_media_upload_session_v1(uuid)',
       'execute'
     )
     or not has_function_privilege(
       'authenticated',
       'public.cancel_media_upload_session_v1(uuid,text)',
       'execute'
     )
  then
    raise exception 'FAIL: authenticated control-plane grants are incomplete';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.verify_media_upload_session_v1(uuid,text,bigint,text,uuid)',
    'execute'
  )
     or has_function_privilege(
       'authenticated',
       'public.expire_media_upload_session_v1(uuid,text)',
       'execute'
     )
     or has_function_privilege(
       'authenticated',
       'public.fail_media_upload_session_v1(uuid,text)',
       'execute'
     )
  then
    raise exception 'FAIL: trusted receiver verification escaped service role';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.verify_media_upload_session_v1(uuid,text,bigint,text,uuid)',
    'execute'
  )
     or not has_function_privilege(
       'service_role',
       'public.expire_media_upload_session_v1(uuid,text)',
       'execute'
     )
     or not has_function_privilege(
       'service_role',
       'public.fail_media_upload_session_v1(uuid,text)',
       'execute'
     )
  then
    raise exception 'FAIL: service-role verification grants are incomplete';
  end if;

  if coalesce(position(
    'expired' in (
      select pg_get_constraintdef(constraint_row.oid)
      from pg_constraint constraint_row
      join pg_class table_row
        on table_row.oid = constraint_row.conrelid
      join pg_namespace namespace_row
        on namespace_row.oid = table_row.relnamespace
      where namespace_row.nspname = 'media'
        and table_row.relname = 'upload_sessions'
        and constraint_row.conname = 'upload_sessions_state_check'
    )
  ), 0) = 0 then
    raise exception 'FAIL: expired upload-session state is absent';
  end if;

  if to_regprocedure(
    'media.insert_verified_file_object_v2(jsonb,uuid,uuid)'
  ) is null then
    raise exception 'FAIL: canonical Media file completion authority is absent';
  end if;

  if not exists (
    select 1
    from pg_class table_row
    join pg_namespace namespace_row
      on namespace_row.oid = table_row.relnamespace
    where namespace_row.nspname = 'media'
      and table_row.relname = 'upload_sessions'
      and table_row.relrowsecurity
  ) then
    raise exception 'FAIL: upload-session RLS is not enabled';
  end if;

  select count(*)
  into v_count
  from pg_proc procedure_row
  join pg_namespace namespace_row
    on namespace_row.oid = procedure_row.pronamespace
  where namespace_row.nspname = 'public'
    and procedure_row.proname in (
      'create_media_upload_session_v1',
      'get_media_upload_session_v1',
      'verify_media_upload_session_v1',
      'expire_media_upload_session_v1',
      'fail_media_upload_session_v1',
      'cancel_media_upload_session_v1'
    )
    and procedure_row.prosecdef;

  if v_count <> 6 then
    raise exception 'FAIL: upload-session functions are not all SECURITY DEFINER';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_row
    join pg_class table_row
      on table_row.oid = constraint_row.conrelid
    join pg_namespace namespace_row
      on namespace_row.oid = table_row.relnamespace
    where namespace_row.nspname = 'media'
      and table_row.relname = 'upload_sessions'
      and constraint_row.conname = 'upload_sessions_actor_idempotency_unique'
      and constraint_row.contype = 'u'
  )
     or not exists (
       select 1
       from pg_constraint constraint_row
       join pg_class table_row
         on table_row.oid = constraint_row.conrelid
       join pg_namespace namespace_row
         on namespace_row.oid = table_row.relnamespace
       where namespace_row.nspname = 'media'
         and table_row.relname = 'upload_sessions'
         and constraint_row.conname = 'upload_sessions_storage_path_unique'
         and constraint_row.contype = 'u'
     )
     or not exists (
       select 1
       from pg_constraint constraint_row
       join pg_class table_row
         on table_row.oid = constraint_row.conrelid
       join pg_namespace namespace_row
         on namespace_row.oid = table_row.relnamespace
       where namespace_row.nspname = 'media'
         and table_row.relname = 'upload_sessions'
         and constraint_row.conname = 'upload_sessions_file_object_unique'
         and constraint_row.contype = 'u'
     )
  then
    raise exception 'FAIL: upload-session uniqueness authority is incomplete';
  end if;

  if coalesce(position(
    'VERIFIED_BYTE_SIZE IS NULL' in upper((
      select pg_get_constraintdef(constraint_row.oid)
      from pg_constraint constraint_row
      join pg_class table_row
        on table_row.oid = constraint_row.conrelid
      join pg_namespace namespace_row
        on namespace_row.oid = table_row.relnamespace
      where namespace_row.nspname = 'media'
        and table_row.relname = 'upload_sessions'
        and constraint_row.conname = 'upload_sessions_verified_integrity_check'
    ))
  ), 0) = 0
     or coalesce(position(
       'VERIFIED_SHA256 IS NULL' in upper((
         select pg_get_constraintdef(constraint_row.oid)
         from pg_constraint constraint_row
         join pg_class table_row
           on table_row.oid = constraint_row.conrelid
         join pg_namespace namespace_row
           on namespace_row.oid = table_row.relnamespace
         where namespace_row.nspname = 'media'
           and table_row.relname = 'upload_sessions'
           and constraint_row.conname = 'upload_sessions_verified_integrity_check'
       ))
     ), 0) = 0
  then
    raise exception 'FAIL: terminal-state verification evidence is not constrained';
  end if;

  if coalesce(position(
    'v_session.state in (''failed'', ''cancelled'', ''expired'')'
    in pg_get_functiondef(
      'public.cancel_media_upload_session_v1(uuid,text)'::regprocedure
    )
  ), 0) = 0
  then
    raise exception 'FAIL: cancellation can rewrite a terminal upload-session outcome';
  end if;

  if coalesce(position(
    'v_session.state in (''failed'', ''cancelled'', ''expired'')'
    in pg_get_functiondef(
      'public.fail_media_upload_session_v1(uuid,text)'::regprocedure
    )
  ), 0) = 0
  then
    raise exception 'FAIL: failure retry can rewrite terminal upload-session evidence';
  end if;
end;
$verify_phase_4b_m1$;

select jsonb_build_object(
  'upload_sessions', (
    select count(*)
    from media.upload_sessions
  ),
  'verification', 'PHASE_4B_M1_UPLOAD_SESSION_AUTHORITY_PASS'
) as phase_4b_m1_upload_session_authority;

rollback;
