-- Disposable PostgreSQL fixture only. All rows and claim settings roll back.
begin;
do $guard$
begin
 if (select count(*) from mizizi_private.desk_resource_policy_versions_v1)<>0
 or (select count(*) from mizizi_private.desk_resource_reservations_v1)<>0
 or (select count(*) from mizizi_private.desk_resource_events_v1)<>0
 or (select count(*) from supabase_migrations.schema_migrations where version='20261127073652')<>1
 then raise exception 'STOP_MIZIZI_SYNC_FIXTURE_PREIMAGE';end if;
end $guard$;
insert into mizizi_private.desk_resource_policy_versions_v1(
 resource,revision,enabled,workspace_id,account_fingerprint,entitlement_ref,billing_safeguard_ref,
 allowance_start,allowance_end,valid_until,account_limit,daily_limit,case_limit,model_tariffs)
values('anthropic',1,false,'00000000-0000-4000-8000-000000000001',repeat('a',64),
 'fixture:disabled','fixture:disabled',now()-interval '1 hour',now()+interval '1 hour',
 now()+interval '30 minutes',5000000,5000000,5000000,
 '{"fixture-haiku":{"pricingRef":"pricing:fixture","maxInputTokens":5000,"maxOutputTokens":2500,"inputRate":100000,"outputRate":500000}}');
insert into mizizi_private.desk_resource_reservations_v1(
 id,resource,policy_revision,request_sha256,binding_sha256,job_id,case_id,workspace_id,
 expected_revision,worker_id,lease_expires_at,membership_sha256,observation_sha256,account_fingerprint,
 units,model,pricing_ref,max_input_tokens,max_output_tokens,reserved_at,valid_until,consumed_at)
select ('00000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'anthropic',1,
 repeat(i::text,64),repeat('b',64),'00000000-0000-4000-8000-000000000010',
 '00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000001',2,
 'mizizi-chart:00000000-0000-4000-8000-000000000012',now()+interval '5 minutes',
 repeat('c',64),repeat('d',64),repeat('a',64),1750,'fixture-haiku','pricing:fixture',5000,2500,
 now()-interval '2 seconds',now()+interval '2 minutes',case when i=6 then null else now()-interval '1 second' end
from generate_series(1,6) i;
-- Use the established disposable service-role claim fixture; never hosted.
select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $proof$
declare i integer; rid uuid; req text; account text:=repeat('a',64);
 usage jsonb:='{"inputTokens":500,"outputTokens":100,"cacheCreationTokens":0,"cacheReadTokens":0}';
 exact jsonb; actual bigint;
begin
 exact:=usage||jsonb_build_object('responseModel','fixture-haiku');
 for i in 1..6 loop
  rid:=('00000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;
  req:=repeat(i::text,64);
  if public.mizizi_read_desk_resource_encumbrance_v1(rid,req,account) is distinct from 1750::bigint
   then raise exception 'STOP_SYNC_INITIAL_HOLD';end if;
  if i=6 then continue;end if;
  if public.mizizi_record_desk_resource_event_v1(rid,req,account,'send_pending','{}') is distinct from true
   then raise exception 'STOP_SYNC_SEND_PENDING';end if;
  case i
   when 1 then
    if public.mizizi_record_desk_resource_event_v1(rid,req,account,'response_metered',exact) is distinct from true
     then raise exception 'STOP_SYNC_METER';end if;
    if public.mizizi_record_desk_resource_event_v1(rid,req,account,'response_metered',exact) is distinct from true
     then raise exception 'STOP_SYNC_EXACT_REPLAY';end if;
    if public.mizizi_record_desk_resource_event_v1(rid,req,account,'response_metered',exact||'{"inputTokens":1}') is distinct from false
     then raise exception 'STOP_SYNC_CONFLICT_REPLAY';end if;
   when 2 then
    if public.mizizi_record_desk_resource_event_v1(rid,req,account,'response_unconfirmed','{}') is distinct from true
     or public.mizizi_record_desk_resource_event_v1(rid,req,account,'response_metered',exact) is distinct from false
     then raise exception 'STOP_SYNC_UNKNOWN_HOLD';end if;
   when 3 then
    if public.mizizi_record_desk_resource_event_v1(rid,req,account,'response_metered',usage) is distinct from true
     then raise exception 'STOP_SYNC_LEGACY_COMPATIBILITY';end if;
   when 4 then
    if public.mizizi_record_desk_resource_event_v1(rid,req,account,'response_metered',exact||'{"cacheReadTokens":5}') is distinct from true
     then raise exception 'STOP_SYNC_CACHE_RECORD';end if;
   when 5 then
    if public.mizizi_record_desk_resource_event_v1(rid,req,account,'response_metered',exact||'{"responseModel":"other-model"}') is distinct from false
     or public.mizizi_record_desk_resource_event_v1(rid,req,account,'response_metered',exact||'{"inputTokens":5001}') is distinct from false
     then raise exception 'STOP_SYNC_INVALID_METER';end if;
  end case;
  actual:=public.mizizi_read_desk_resource_encumbrance_v1(rid,req,account);
  if actual is distinct from case when i=1 then 100::bigint else 1750::bigint end
   then raise exception 'STOP_SYNC_CHARGE_%_%',i,actual;end if;
  if public.mizizi_read_desk_resource_encumbrance_v1(rid,req,repeat('f',64)) is not null
   or public.mizizi_read_desk_resource_encumbrance_v1(rid,repeat('f',64),account) is not null
   then raise exception 'STOP_SYNC_READBACK_SCOPE';end if;
 end loop;
 if (select sum(mizizi_private.desk_resource_encumbered_units_v1(r))
     from mizizi_private.desk_resource_reservations_v1 r)<>8850
  then raise exception 'STOP_SYNC_AGGREGATE';end if;
 if (select sum(units) from mizizi_private.desk_resource_reservations_v1)<>10500
  then raise exception 'STOP_SYNC_IMMUTABLE_RESERVATION';end if;
 raise notice 'MIZIZI_SYNC_METER_EXACT_AND_CONSERVATIVE_NEGATIVES=PASS';
end $proof$;
rollback;
