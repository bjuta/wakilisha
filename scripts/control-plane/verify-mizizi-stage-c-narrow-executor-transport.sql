do $verify$
begin
  if not exists (
    select 1 from supabase_migrations.schema_migrations
    where name='mizizi_stage_c_narrow_executor_transport_v1'
  ) then
    raise exception 'STOP: exact Stage C migration identity is absent';
  end if;

  if not exists (
    select 1 from platform_private.system_actor_executor_bindings
    where actor_key='mizizi' and executor_kind='database_role'
      and executor_key='mizizi_executor' and status='active'
  ) or not exists (
    select 1 from platform_private.system_actor_executor_bindings
    where actor_key='mizizi' and executor_kind='database_role'
      and executor_key='postgres' and status='disabled'
  ) then
    raise exception 'STOP: Stage C executor binding state is wrong';
  end if;

  if has_schema_privilege('mizizi_executor','platform_private','USAGE') then
    raise exception 'STOP: executor has ambient platform_private access';
  end if;
  if has_table_privilege('mizizi_executor','public.user_role_assignments','SELECT')
     or has_schema_privilege('mizizi_executor','editorial','USAGE') then
    raise exception 'STOP: executor has direct admin identity read authority';
  end if;

  if not has_column_privilege('mizizi_executor','public.registry_tracks','id','SELECT')
     or not has_column_privilege('mizizi_executor','public.registry_tracks','slug','SELECT')
     or not has_column_privilege('mizizi_executor','public.registry_artists','metadata','SELECT')
     or not has_column_privilege('mizizi_executor','public.wk_chart_entries_v2','canonical_track_id','SELECT') then
    raise exception 'STOP: executor read surface is incomplete';
  end if;

  if has_table_privilege('mizizi_executor','public.registry_tracks','UPDATE')
     or has_table_privilege('mizizi_executor','public.registry_releases','UPDATE')
     or has_table_privilege('mizizi_executor','public.registry_artists','UPDATE')
     or has_table_privilege('mizizi_executor','public.wk_chart_entries_v2','UPDATE') then
    raise exception 'STOP: executor has direct canonical mutation authority';
  end if;

  if not has_function_privilege('mizizi_executor','mizizi_private.record_artist_origin_evidence_v1(text,uuid,text,numeric,text,text,text,timestamptz)','EXECUTE')
     or not has_function_privilege('mizizi_executor','mizizi_private.issue_artist_origin_execution_grant_v1(text,uuid,text)','EXECUTE')
     or not has_function_privilege('mizizi_executor','mizizi_private.execute_artist_origin_admission_v1(text,uuid)','EXECUTE')
     or not has_function_privilege('mizizi_executor','mizizi_private.verify_artist_origin_admission_v1(uuid)','EXECUTE')
     or not has_function_privilege('mizizi_executor','mizizi_private.send_operational_standup_v1(text,text)','EXECUTE') then
    raise exception 'STOP: Stage C exact wrapper EXECUTE surface is incomplete';
  end if;

  if exists (
    select 1 from platform_private.system_actor_capability_grants
    where actor_key='mizizi' and status='active'
      and valid_from<=now() and expires_at>now() and revoked_at is null
  ) or exists (
    select 1 from platform_private.registry_execution_grants
    where actor_key='mizizi' and status='active'
      and expires_at>now() and revoked_at is null and consumed_at is null
  ) then
    raise exception 'STOP: Stage C left active MIZIZI authority at rest';
  end if;
end
$verify$;

select 'MIZIZI_STAGE_C_NARROW_EXECUTOR_TRANSPORT_PASS'::text as status;
