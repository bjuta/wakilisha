-- Preview ONLY. Exactly one contract and one reservation, then rollback all.
-- Tests service-only no-duplicate lease and transaction-safe failure receipt.
begin;
set local lock_timeout='5s';
set local statement_timeout='50s';
do $fixture$
declare c uuid; first_receipt jsonb; lease jsonb; success_lease jsonb; bad_lease jsonb; success_receipt jsonb; raw_key text; digest text;
 slot timestamptz; eat_time timestamp; week_date date;
begin
 if (select count(*) from public.wk_chart_capture_contracts_v1)<>0
   or (select count(*) from private.wk_chart_runtime_reservations_v1)<>0
 then raise exception 'STOP: preview acceptance requires clean zero-candidate state'; end if;
 slot:=date_trunc('minute',now())-interval '1 minute';
 eat_time:=slot at time zone 'Africa/Nairobi';
 week_date:=date_trunc('week',eat_time)::date;
 insert into public.wk_chart_capture_contracts_v1(source_key,contract_version,provider_key,
  source_surface,behavior,native_metric,expected_depth,cadence_kind,
  eat_hour,eat_minute,minimum_healthy_checkpoints,adapter_version,adapter_sha256)
 values('mdundo_ke','preview-rollback-v1','mdundo','Isolated synthetic fixture',
  'consumption','rank',1,'daily',extract(hour from eat_time)::int,
  extract(minute from eat_time)::int,1,'fixture-v1',repeat('a',64)) returning id into c;
 perform set_config('request.jwt.claim.role','service_role',true);
 lease:=public.wk_chart_runtime_reserve_v1(c,week_date,slot,1::smallint);
 if lease->>'state'<>'reserved' then raise exception 'WK100 reserve not reserved'; end if;
 begin
   perform public.wk_chart_runtime_reserve_v1(c,week_date,slot,1::smallint);
   raise exception 'WK100 duplicate claim illegally accepted';
 exception when lock_not_available then null;
 end;
 first_receipt:=public.wk_chart_runtime_fail_v1(
   (lease->>'reservation_id')::uuid,(lease->>'lease_id')::uuid,
   'transport_failed','preview_fixture_ref','network_unavailable');
 if first_receipt->>'status'<>'transport_failed'
   or (select count(*) from public.wk_chart_capture_attempts_v1)<>1
   or (select count(*) from public.wk_chart_capture_rows_v1)<>0
 then raise exception 'WK100 transaction receipt failed'; end if;
 success_lease:=public.wk_chart_runtime_reserve_v1(c,week_date,slot,2::smallint);
 digest:=repeat('b',64);
 raw_key:=format('v1/%s/mdundo_ke/%s-2/%s.html',week_date,to_char(slot at time zone 'UTC','YYYYMMDD"T"HH24MISS"Z"'),digest);
 perform public.wk_chart_runtime_advance_v1((success_lease->>'reservation_id')::uuid,(success_lease->>'lease_id')::uuid,'bind',raw_key,digest,'text/html',20,slot+interval '10 seconds');
 insert into storage.objects(bucket_id,name,metadata) values('wk-chart-raw-evidence-v1',raw_key,'{"size":20,"mimetype":"text/html"}'::jsonb);
 perform public.wk_chart_runtime_advance_v1((success_lease->>'reservation_id')::uuid,(success_lease->>'lease_id')::uuid,'uploaded');
 perform public.wk_chart_runtime_advance_v1((success_lease->>'reservation_id')::uuid,(success_lease->>'lease_id')::uuid,'verified');
 success_receipt:=public.wk_chart_runtime_commit_v1((success_lease->>'reservation_id')::uuid,(success_lease->>'lease_id')::uuid,'succeeded',
  '[{"rank":1,"provider_track_id":"123","title":"Song","artist":"Singer"}]'::jsonb,'preview_fixture_ref');
 if success_receipt->>'status'<>'succeeded' or (select count(*) from public.wk_chart_capture_attempts_v1)<>2
  or (select count(*) from public.wk_chart_capture_rows_v1)<>1 then raise exception 'WK100 atomic success missing'; end if;
 bad_lease:=public.wk_chart_runtime_reserve_v1(c,week_date,slot,3::smallint);
 raw_key:=format('v1/%s/mdundo_ke/%s-3/%s.html',week_date,to_char(slot at time zone 'UTC','YYYYMMDD"T"HH24MISS"Z"'),digest);
 perform public.wk_chart_runtime_advance_v1((bad_lease->>'reservation_id')::uuid,(bad_lease->>'lease_id')::uuid,'bind',raw_key,digest,'text/html',20,slot+interval '10 seconds');
 insert into storage.objects(bucket_id,name,metadata) values('wk-chart-raw-evidence-v1',raw_key,'{"size":20,"mimetype":"text/html"}'::jsonb);
 perform public.wk_chart_runtime_advance_v1((bad_lease->>'reservation_id')::uuid,(bad_lease->>'lease_id')::uuid,'uploaded');
 perform public.wk_chart_runtime_advance_v1((bad_lease->>'reservation_id')::uuid,(bad_lease->>'lease_id')::uuid,'verified');
 begin
  perform public.wk_chart_runtime_commit_v1((bad_lease->>'reservation_id')::uuid,(bad_lease->>'lease_id')::uuid,'succeeded',
    jsonb_build_array(jsonb_build_object('rank',1,'provider_track_id',repeat('x',181))),'preview_fixture_ref');
  raise exception 'WK100 invalid native row illegally committed';
 exception when check_violation then null;
 end;
 if (select count(*) from public.wk_chart_capture_attempts_v1)<>2
  or (select count(*) from public.wk_chart_capture_rows_v1)<>1
  or not exists(select 1 from private.wk_chart_runtime_reservations_v1 where id=(bad_lease->>'reservation_id')::uuid and state='verified')
 then raise exception 'WK100 atomic rollback failed'; end if;
 perform set_config('request.jwt.claim.role','anon',true);
 begin
   perform public.wk_chart_runtime_reserve_v1(c,week_date,slot,2::smallint);
   raise exception 'WK100 anonymous source reservation illegally accepted';
 exception when insufficient_privilege then null;
 end;
 raise notice 'WK100_RUNTIME_SQL_LEASE_ATOMIC_SUCCESS_FAILURE_AND_ROLLBACK=PASS';
end; $fixture$;
select 'WK100_RUNTIME_SQL_FIXTURE=PASS_ROLLBACK' as result;
rollback;
