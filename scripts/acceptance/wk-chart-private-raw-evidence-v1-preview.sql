-- Preview-only, rollback-only SQL role/access fixture. No API request and
-- no binary payload; a Storage API object round-trip remains a separate gate.
-- Never execute on Production. Runs ONLY after independent Preview 233 proof.
begin;
set local statement_timeout='60s';
set local lock_timeout='5s';

do $wk_raw_preview_preflight$
begin
 if (select count(*) from supabase_migrations.schema_migrations)<>233
    or (select max(version) from supabase_migrations.schema_migrations)<>'20261019203244'
    or exists(select 1 from storage.objects where bucket_id='wk-chart-raw-evidence-v1')
    or exists(select 1 from public.wk_chart_capture_attempts_v1)
 then raise exception 'STOP_WK100_RAW_PREVIEW_REQUIRES_CLEAN_233_NO_FIXTURES'; end if;
end;
$wk_raw_preview_preflight$;

-- No storage.objects SELECT/INSERT grants should be usable for this private
-- bucket by either client role. Probe actual RLS roles, not just policy names.
set local role anon;
do $wk_probe_anon$
declare v_denied boolean:=false;
begin
  begin
    if exists(select 1 from storage.buckets where id='wk-chart-raw-evidence-v1')
       or exists(select 1 from storage.objects where bucket_id='wk-chart-raw-evidence-v1')
    then raise exception 'STOP_WK100_ANON_READ_PRIVATE_METADATA'; end if;
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects(bucket_id,name)
    values ('wk-chart-raw-evidence-v1','v1/fixture/anon_denied.json');
  exception when insufficient_privilege then v_denied:=true;
  end;
  if not v_denied then raise exception 'STOP_WK100_ANON_STORAGE_INSERT_ALLOWED'; end if;
end;
$wk_probe_anon$;
reset role;

set local role authenticated;
do $wk_probe_authenticated$
declare v_denied boolean:=false;
begin
  begin
    if exists(select 1 from storage.buckets where id='wk-chart-raw-evidence-v1')
      or exists(select 1 from storage.objects where bucket_id='wk-chart-raw-evidence-v1')
    then raise exception 'STOP_WK100_AUTHENTICATED_READ_PRIVATE_METADATA'; end if;
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects(bucket_id,name)
    values ('wk-chart-raw-evidence-v1','v1/fixture/auth_denied.json');
  exception when insufficient_privilege then v_denied:=true;
  end;
  if not v_denied then raise exception 'STOP_WK100_AUTHENTICATED_STORAGE_INSERT_ALLOWED'; end if;
end;
$wk_probe_authenticated$;
reset role;

set local role service_role;
do $wk_probe_service$
begin
  if (select public from storage.buckets where id='wk-chart-raw-evidence-v1')
     is distinct from false
  then raise exception 'STOP_WK100_SERVICE_ROLE_PRIVATE_BUCKET_INVISIBLE_OR_PUBLIC'; end if;
  if exists(select 1 from storage.objects where bucket_id='wk-chart-raw-evidence-v1')
  then raise exception 'STOP_WK100_SERVICE_ROLE_RAW_BUCKET_NOT_EMPTY'; end if;
end;
$wk_probe_service$;
reset role;

select 'WK100_PRIVATE_BUCKET_SQL_RLS_ROLES=PASS_ROLLBACK' as result;
rollback;
