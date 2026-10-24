-- Rollback-only Preview acceptance. NO external provider calls.
-- Must run only on an independently verified disposable Preview at the exact
-- 232 / 20261019152307 migration head. It leaves zero fixtures on completion.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

do $wk_chart_receipts_preview_fixture$
declare
  v_contract uuid;
  v_attempt uuid;
  v_row uuid;
  v_freeze uuid;
  v_denied boolean;
begin
  if (select count(*) from supabase_migrations.schema_migrations)<>232
     or (select max(version) from supabase_migrations.schema_migrations)<>'20261019152307' then
    raise exception 'STOP: Preview target migration not replayed exactly';
  end if;
  if exists(select 1 from public.wk_chart_capture_contracts_v1) then
    raise exception 'STOP: preview fixture must start with empty contract ledger';
  end if;
  insert into public.wk_chart_capture_contracts_v1 (
    source_key,contract_version,provider_key,source_surface,behavior,native_metric,
    expected_depth,cadence_kind,eat_hour,eat_minute,weekday_eat,minimum_healthy_checkpoints,
    adapter_version,adapter_sha256
  ) values (
    'fixture_youtube_ke','fixture-1','youtube','test-only',
    'video_consumption','rank_and_count',1,'weekly',12,0,3,1,
    'fixture-adapter-1',repeat('a',64)
  ) returning id into v_contract;
  insert into public.wk_chart_capture_attempts_v1 (
    contract_id,week_start_eat,scheduled_at,attempt_number,fetched_at,status,
    observed_depth,record_count,payload_sha256,raw_object_key,
    native_period_authority,native_period_start,native_period_end,
    native_period_evidence_ref,upstream_reference
  ) values (
    v_contract,'2026-10-19','2026-10-22T09:00:00Z',1,
    '2026-10-22T09:01:00Z','succeeded',1,1,repeat('b',64),
    'fixtures/youtube/20261022/001.json',
    'provider_defined','2026-10-18T21:00:00Z','2026-10-25T21:00:00Z',
    'fixture-week-2026-43','fixture-chart-ke'
  ) returning id into v_attempt;
  insert into public.wk_chart_capture_rows_v1 (
    attempt_id,source_rank,provider_track_id,title_observed,artist_observed,
    source_native_count
  ) values (v_attempt,1,'v1','Fixture Song','Fixture Artist',1200)
  returning id into v_row;
  insert into public.wk_chart_weekly_freezes_v1 (
    week_start_eat,constitution_version,methodology_version,receipt_ids,
    receipts_sha256,manifest_sha256,blocking_summary
  ) values (
    '2026-10-19','fixture-constitution-v1','fixture-method-v1',array[v_attempt],
    repeat('c',64),repeat('d',64),
    'Fixture state is blocked pending authorization and independent replay.'
  ) returning id into v_freeze;

  v_denied:=false;
  begin
    update public.wk_chart_capture_attempts_v1 set record_count=1 where id=v_attempt;
  exception when insufficient_privilege then v_denied:=true;
  end;
  if not v_denied then raise exception 'STOP: mutation of immutable receipt was allowed'; end if;
  v_denied:=false;
  begin
    delete from public.wk_chart_capture_rows_v1 where id=v_row;
  exception when insufficient_privilege then v_denied:=true;
  end;
  if not v_denied then raise exception 'STOP: deletion of immutable source row was allowed'; end if;
  v_denied:=false;
  begin
    insert into public.wk_chart_capture_rows_v1 (
      attempt_id,source_rank,provider_track_id,source_native_count
    ) values (v_attempt,2,'out-of-depth',3);
  exception when check_violation then v_denied:=true;
  end;
  if not v_denied then raise exception 'STOP: out-of-depth ranked row accepted'; end if;
  v_denied:=false;
  begin
    insert into public.wk_chart_weekly_freezes_v1 (
      week_start_eat,constitution_version,methodology_version,receipt_ids,
      receipts_sha256,manifest_sha256,blocking_summary
    ) values (
      '2026-10-26','fixture-constitution-v1','fixture-method-v1',array[v_attempt],
      repeat('c',64),repeat('e',64),'Cross-week evidence must not be accepted.'
    );
  exception when check_violation then v_denied:=true;
  end;
  if not v_denied then raise exception 'STOP: cross-week freeze accepted'; end if;
  v_denied:=false;
  begin
    insert into public.wk_chart_weekly_freezes_v1 (
      week_start_eat,constitution_version,methodology_version,receipt_ids,
      receipts_sha256,manifest_sha256,blocking_summary,can_publish
    ) values (
      '2026-10-19','fixture-constitution-v1','fixture-method-v1',array[v_attempt],
      repeat('c',64),repeat('f',64),'Do not issue chart edition automatically.',true
    );
  exception when check_violation then v_denied:=true;
  end;
  if not v_denied then raise exception 'STOP: publication permission accepted'; end if;
  raise notice 'WK100_PREVIEW_TRANSACTIONAL_CONSTRAINT_TEST=PASS (rollback next)';
end;
$wk_chart_receipts_preview_fixture$;
rollback;
