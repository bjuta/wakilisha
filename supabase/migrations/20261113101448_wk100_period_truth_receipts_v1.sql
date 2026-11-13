-- WK100 issue #1366: truthful service-receipt period evidence.
-- Generated filename is the actual Mac Supabase CLI authority, not guessed.
-- Backwards compatible: original v1 RPC and every immutable historical row stay untouched.
begin;

do $wk100_prior$ begin
  if to_regprocedure('public.wk_chart_runtime_commit_v1(uuid,uuid,text,jsonb,text,timestamptz,timestamptz,text,text)') is null
    or to_regclass('platform_private.wk100_source_method_decisions_v1') is null
    or to_regclass('platform_private.wk100_source_proposals_v1') is null
  then raise exception 'WK100 period truth prerequisite missing'; end if;
end $wk100_prior$;

alter table public.wk_chart_capture_attempts_v1
  drop constraint wk_chart_capture_attempts_v1_native_period_authority_check,
  add constraint wk_chart_capture_attempts_v1_native_period_authority_check
    check (native_period_authority in
      ('unknown','provider_defined','observed_as_of','provider_declared_end_date'));

alter table public.wk_chart_capture_attempts_v1
  drop constraint wk_chart_capture_attempt_native_period,
  add constraint wk_chart_capture_attempt_native_period check (
    (native_period_authority='unknown' and
      native_period_start is null and native_period_end is null and
      native_period_evidence_ref is null)
    or (native_period_authority='provider_defined' and
      native_period_start is not null and native_period_end is not null and
      native_period_start<native_period_end and native_period_evidence_ref is not null)
    or (native_period_authority='observed_as_of' and
      native_period_start is null and native_period_end is null and
      native_period_evidence_ref is not null and native_period_evidence_ref ~
        '^observed_as_of/[a-z0-9][a-z0-9_.-]{2,119}$')
    or (native_period_authority='provider_declared_end_date' and
      native_period_start is null and native_period_end is null and
      native_period_evidence_ref is not null and native_period_evidence_ref ~
        '^youtube_week_end:[0-9]{4}-[0-9]{2}-[0-9]{2}$')
  );

create function public.wk_chart_runtime_commit_v2(
  p_reservation_id uuid,p_lease_id uuid,p_outcome text,
  p_rows jsonb,p_upstream_reference text,
  p_native_period_start timestamptz default null,p_native_period_end timestamptz default null,
  p_native_period_evidence_ref text default null,p_failure_code text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $fn$
declare r private.wk_chart_runtime_reservations_v1%rowtype;
  c public.wk_chart_capture_contracts_v1%rowtype;
  v_id uuid;
  v_count integer;
  v_rank integer;
  v_item jsonb;
  v_native text;
  v_period_ref text;
  v_youtube_end date;
  v_method platform_private.wk100_source_method_decisions_v1%rowtype;
  v_state text;
begin
  r:=private.wk_chart_runtime_lock_v1(p_reservation_id,p_lease_id);
  select * into strict c from public.wk_chart_capture_contracts_v1 where id=r.contract_id;
  if c.admission_state<>'candidate' or r.state<>'verified'
    or p_outcome not in ('succeeded','partial_depth','parse_failed','target_period_unavailable')
    or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>c.expected_depth
    or p_upstream_reference is null or length(btrim(p_upstream_reference)) not between 3 and 200
    or p_upstream_reference~'[?&=]'
  then raise exception 'WK100 receipt commit boundary rejected'; end if;
  v_count:=jsonb_array_length(p_rows);
  if (p_outcome='succeeded' and v_count<>c.expected_depth)
    or (p_outcome='partial_depth' and (v_count<1 or v_count>=c.expected_depth))
    or (p_outcome in ('parse_failed','target_period_unavailable') and
      (v_count<>0 or p_failure_code !~ '^[a-z][a-z0-9_]{2,63}$'))
  then raise exception 'WK100 inconsistent native depth/status'; end if;
  for v_rank in 1..v_count loop
    v_item:=p_rows->(v_rank-1);
    if jsonb_typeof(v_item)<>'object'
       or (select count(*) from jsonb_object_keys(v_item) k where k not in
         ('rank','provider_track_id','title','artist','view_count'))>0
       or (v_item->>'rank') is distinct from v_rank::text
       or (v_item->>'provider_track_id') is null and (v_item->>'title') is null
       or (v_item ? 'view_count' and c.native_metric<>'rank_and_count')
       or (not (v_item ? 'view_count') and c.native_metric='rank_and_count')
    then raise exception 'WK100 invalid native rank/metric row'; end if;
  end loop;
  -- A second admission check at COMMIT prevents a stale/revoked W2A method
  -- from granting period status after the original was fetched/archived.
  select * into v_method from platform_private.wk100_source_method_decisions_v1
    where source_key=c.source_key order by decision_revision desc limit 1;
  if v_method.source_key is null
    or v_method.decision_state is distinct from 'collector_admitted'
    or v_method.provider_key is distinct from c.provider_key
    or v_method.parser_class is distinct from c.adapter_version
    or v_method.authorization_ref is distinct from p_upstream_reference
    or v_method.authorization_expires_at is null
    or v_method.authorization_expires_at<=clock_timestamp()
    or v_method.proposal_revision is distinct from
       (select max(p.revision) from platform_private.wk100_source_proposals_v1 p
        where p.source_key=c.source_key)
  then raise exception using errcode='42501',
    message='WK100 current period method authority revoked or mismatched'; end if;
  -- A calendar date is not a UTC interval; prohibit manufactured boundaries.
  if p_native_period_start is not null or p_native_period_end is not null
  then raise exception 'WK100 period-v2 invented UTC interval forbidden'; end if;
  v_native:='unknown';v_period_ref:=null;
  if p_outcome in ('parse_failed','target_period_unavailable') then
    if p_native_period_evidence_ref is not null
    then raise exception 'WK100 failed capture cannot attest provider period'; end if;
  elsif v_method.native_period_authority='observed_as_of' and
        c.provider_key in ('apple_ke','shazam_ke','mdundo_ke','audiomack_ke') then
    -- The exact reviewed policy label is sourced from privileged SQL, NEVER
    -- from browser input or a purported provider weekly period.
    if p_native_period_evidence_ref is not null or
      v_method.native_period_evidence_ref is null or
      v_method.native_period_evidence_ref !~
        '^observed_as_of/[a-z0-9][a-z0-9_.-]{2,119}$'
    then raise exception 'WK100 observed-as-of authority invalid'; end if;
    v_native:='observed_as_of';
    v_period_ref:=v_method.native_period_evidence_ref;
  elsif c.provider_key='youtube_ke' and
        v_method.native_period_authority='provider_defined' and
        v_method.method_class='provider_api' then
    -- The first-party raw original declares chart type + endDate only.
    -- Its source-owned endDate was independently parsed by the worker and
    -- must be replayed against the immutable original before any W8 claim.
    if p_native_period_evidence_ref is null or
       p_native_period_evidence_ref !~ '^youtube_week_end:[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    then raise exception 'WK100 YouTube original week end missing'; end if;
    v_youtube_end:=split_part(p_native_period_evidence_ref,':',2)::date;
    if extract(isodow from v_youtube_end)<>4 or
       v_youtube_end>(r.fetched_at at time zone 'Africa/Nairobi')::date or
       v_youtube_end<(r.fetched_at at time zone 'Africa/Nairobi')::date-21
    then raise exception 'WK100 YouTube native calendar end invalid'; end if;
    v_native:='provider_declared_end_date';
    v_period_ref:=p_native_period_evidence_ref;
  else
    raise exception 'WK100 unsupported period authority for service receipt';
  end if;
  insert into public.wk_chart_capture_attempts_v1(contract_id,week_start_eat,scheduled_at,
    attempt_number,fetched_at,status,http_status,observed_depth,record_count,payload_sha256,
    raw_object_key,native_period_authority,native_period_start,native_period_end,
    native_period_evidence_ref,upstream_reference,failure_code)
  values(r.contract_id,r.week_start_eat,r.scheduled_at,r.attempt_number,r.fetched_at,
    p_outcome,200,v_count,v_count,r.payload_sha256,r.object_key,v_native,
    null,null,v_period_ref,
    p_upstream_reference,p_failure_code)
  returning id into v_id;
  for v_rank in 1..v_count loop
    v_item:=p_rows->(v_rank-1);
    insert into public.wk_chart_capture_rows_v1(attempt_id,source_rank,provider_track_id,
      title_observed,artist_observed,source_native_count)
    values(v_id,v_rank,v_item->>'provider_track_id',v_item->>'title',v_item->>'artist',
       case when v_item ? 'view_count' then (v_item->>'view_count')::bigint else null end);
  end loop;
  update private.wk_chart_runtime_reservations_v1
    set state='committed',receipt_id=v_id,updated_at=clock_timestamp() where id=r.id;
  return jsonb_build_object('receipt_id',v_id,'status',p_outcome,'rows',v_count,'can_publish',false);
end; $fn$;

-- Service role alone may invoke the new audited atomic commit. Frontend users
-- and anonymous clients cannot forge source periods or write immutable rows.
revoke all on function public.wk_chart_runtime_commit_v2(uuid,uuid,text,jsonb,text,timestamptz,timestamptz,text,text) from public,anon,authenticated,service_role;
grant execute on function public.wk_chart_runtime_commit_v2(uuid,uuid,text,jsonb,text,timestamptz,timestamptz,text,text) to service_role;

do $wk100_post$ begin
  if has_function_privilege('anon','public.wk_chart_runtime_commit_v2(uuid,uuid,text,jsonb,text,timestamptz,timestamptz,text,text)','EXECUTE') or
     has_function_privilege('authenticated','public.wk_chart_runtime_commit_v2(uuid,uuid,text,jsonb,text,timestamptz,timestamptz,text,text)','EXECUTE') or
     not has_function_privilege('service_role','public.wk_chart_runtime_commit_v2(uuid,uuid,text,jsonb,text,timestamptz,timestamptz,text,text)','EXECUTE') or
     not exists (select 1 from pg_constraint where
       conrelid='public.wk_chart_capture_attempts_v1'::regclass and
       conname='wk_chart_capture_attempt_native_period')
  then raise exception 'WK100 period truth service privilege/constraint drift'; end if;
  raise notice 'WK100_PERIOD_TRUTH_SERVICE_ONLY_NO_BACKFILL_NO_CRON_PASS';
end $wk100_post$;
commit;
