-- Issue #1441; pinned CLI 2.107.0 mint run 45959639120.
-- Settle positively metered ordinary Messages usage against the original
-- immutable upper-bound tariff. No lower opening quote, budget reset,
-- policy grant, batch retention change or new paid resource.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';
do $guard$
begin
 if current_user<>'postgres'
 or to_regprocedure('public.mizizi_read_desk_resource_encumbrance_v1(uuid,text,text)') is not null
 or encode(sha256(convert_to(pg_get_functiondef(to_regprocedure('public.mizizi_record_desk_resource_event_v1(uuid,text,text,text,jsonb)')),'UTF8')),'hex')
 is distinct from '499e6642e97c0ce539e573ce28f4e18d15f6d691e849913971ac63cbb8234d1d'
 or encode(sha256(convert_to(pg_get_functiondef(to_regprocedure('mizizi_private.desk_resource_encumbered_units_v1(mizizi_private.desk_resource_reservations_v1)')),'UTF8')),'hex')
 is distinct from 'f1f18b508b949707d70969f97b79d212dd77e50bc0c3ebb3d2f77bcf3ab5153a'
 then raise exception 'STOP_MIZIZI_SYNC_METER_PREIMAGE';end if;
end $guard$;

create or replace function public.mizizi_record_desk_resource_event_v1(p_reservation_id uuid,p_request_sha256 text,
 p_account_fingerprint text,p_state text,p_detail jsonb)
returns boolean language plpgsql security definer set search_path=pg_catalog as $record$
declare r mizizi_private.desk_resource_reservations_v1%rowtype;
 last_event mizizi_private.desk_resource_events_v1%rowtype;
 prev_session text; k text; n numeric;input_sum numeric:=0;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service-role required' using errcode='42501';end if;
 if p_detail is null or jsonb_typeof(p_detail)<>'object' or octet_length(p_detail::text)>1024 then return false;end if;
 perform pg_advisory_xact_lock(214781521,61430);
 select * into r from mizizi_private.desk_resource_reservations_v1
 where id=p_reservation_id and request_sha256=p_request_sha256 and account_fingerprint=p_account_fingerprint for update;
 if not found or r.consumed_at is null or r.resource='native_https' then return false;end if;
 select * into last_event from mizizi_private.desk_resource_events_v1 where reservation_id=r.id order by ordinal desc limit 1;
 if exists(select 1 from mizizi_private.desk_resource_events_v1 where reservation_id=r.id and state=p_state and detail=p_detail) then return true;end if;
 if r.resource='anthropic' then
  if last_event.ordinal is null then
   if p_state<>'send_pending' or p_detail<>'{}'::jsonb or clock_timestamp()>=r.valid_until then return false;end if;
  elsif last_event.state='send_pending' then
   if p_state='response_unconfirmed' then
    if p_detail<>'{}'::jsonb then return false;end if;
   elsif p_state='response_metered' then
    if not(p_detail ?& array['inputTokens','outputTokens','cacheCreationTokens','cacheReadTokens'])
     or (select count(*) from jsonb_object_keys(p_detail))<>case when p_detail ? 'responseModel' then 5 else 4 end
     then return false;end if;
    -- Only an exact ordinary Messages response may qualify for sync settlement.
    -- Legacy and asynchronous four-field usage receipts retain their existing semantics.
    if p_detail ? 'responseModel' and (
      jsonb_typeof(p_detail->'responseModel') is distinct from 'string'
      or p_detail->>'responseModel' is distinct from r.model
      or exists(select 1 from mizizi_private.desk_async_batch_requests_v1 a where a.reservation_id=r.id)
    ) then return false;end if;
    for k in select key from jsonb_object_keys(p_detail) as keys(key) where key<>'responseModel' loop
     if jsonb_typeof(p_detail->k)<>'number' or coalesce(p_detail->>k,'') !~ '^(0|[1-9][0-9]{0,7})$' then return false;end if;
     n:=(p_detail->>k)::numeric;
     if k='outputTokens' then if n>r.max_output_tokens then return false;end if;
     else input_sum:=input_sum+n;end if;
    end loop;
    if input_sum>r.max_input_tokens or input_sum+(p_detail->>'outputTokens')::numeric<1 then return false;end if;
   else return false;end if;
  else return false;end if;
 else
  if last_event.ordinal is null then
   if p_state<>'open_pending' or p_detail<>'{}'::jsonb or clock_timestamp()>=r.valid_until then return false;end if;
  elsif last_event.state='open_pending' then
   if p_state='opened' then
    if (select count(*) from jsonb_object_keys(p_detail))<>1 or coalesce(p_detail->>'sessionId','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then return false;end if;
   elsif p_state='cleanup_unconfirmed' then
    if p_detail<>'{}'::jsonb then return false;end if;
   else return false;end if;
  elsif last_event.state='opened' then
   if p_state not in ('close_acknowledged','cleanup_unconfirmed') or p_detail<>last_event.detail then return false;end if;
  else return false;end if;
 end if;
 insert into mizizi_private.desk_resource_events_v1(reservation_id,ordinal,state,detail)
 values(r.id,coalesce(last_event.ordinal,0)+1,p_state,p_detail);
 return true;
end $record$;

create or replace function mizizi_private.desk_resource_encumbered_units_v1(r mizizi_private.desk_resource_reservations_v1)
returns bigint language plpgsql stable security definer set search_path=pg_catalog as $f$
declare u jsonb;tariff jsonb;charge numeric;batch_exists boolean;
begin
 if r.resource<>'anthropic' or r.consumed_at is null then return r.units;end if;
 select detail into u from mizizi_private.desk_resource_events_v1
 where reservation_id=r.id and state='response_metered';
 if u is null or not exists(select 1 from mizizi_private.desk_resource_events_v1
  where reservation_id=r.id and ordinal=1 and state='send_pending')
 or exists(select 1 from mizizi_private.desk_resource_events_v1 where reservation_id=r.id and state='response_unconfirmed')
 then return r.units;end if;
 select exists(select 1 from mizizi_private.desk_async_batch_requests_v1 where reservation_id=r.id) into batch_exists;
 if batch_exists then
  if not exists(select 1 from mizizi_private.desk_async_batch_events_v1 e where e.reservation_id=r.id and e.state='metered')
  then return r.units;end if;
 elsif u->>'responseModel' is distinct from r.model then
  -- No retrospective release of ordinary legacy events without exact model proof.
  return r.units;
 end if;
 select p.model_tariffs->r.model into tariff from mizizi_private.desk_resource_policy_versions_v1 p
 where p.resource=r.resource and p.revision=r.policy_revision;
 if tariff is null or tariff->>'pricingRef' is distinct from r.pricing_ref
 or u->>'cacheCreationTokens' is distinct from '0' or u->>'cacheReadTokens' is distinct from '0'
 or coalesce(u->>'inputTokens','') !~ '^(0|[1-9][0-9]{0,7})$'
 or coalesce(u->>'outputTokens','') !~ '^(0|[1-9][0-9]{0,7})$'
 or (u->>'inputTokens')::numeric>r.max_input_tokens or (u->>'outputTokens')::numeric>r.max_output_tokens
 then return r.units;end if;
 charge:=ceil((u->>'inputTokens')::numeric*(tariff->>'inputRate')::numeric/1000000+
  (u->>'outputTokens')::numeric*(tariff->>'outputRate')::numeric/1000000);
 if charge is null or charge<1 or charge>r.units then return r.units;end if;
 return charge::bigint;
end $f$;

-- Service-only exact readback for the in-process pass budget; does not
-- authorize acquisition, change receipts, release a hold, or reserve funds.
create function public.mizizi_read_desk_resource_encumbrance_v1(
 p_reservation_id uuid,p_request_sha256 text,p_account_fingerprint text
) returns bigint language plpgsql stable security definer set search_path=pg_catalog as $f$
declare r mizizi_private.desk_resource_reservations_v1%rowtype;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service-role required' using errcode='42501';end if;
 select * into r from mizizi_private.desk_resource_reservations_v1
 where id=p_reservation_id and request_sha256=p_request_sha256 and account_fingerprint=p_account_fingerprint and resource='anthropic';
 if not found then return null;end if;
 return mizizi_private.desk_resource_encumbered_units_v1(r);
end $f$;
revoke all on function public.mizizi_read_desk_resource_encumbrance_v1(uuid,text,text)
 from public,anon,authenticated,service_role,mizizi_executor;
grant execute on function public.mizizi_read_desk_resource_encumbrance_v1(uuid,text,text) to service_role;
do $acl$
begin
 if not has_function_privilege('service_role','public.mizizi_read_desk_resource_encumbrance_v1(uuid,text,text)','EXECUTE')
 or has_function_privilege('anon','public.mizizi_read_desk_resource_encumbrance_v1(uuid,text,text)','EXECUTE')
 or has_function_privilege('authenticated','public.mizizi_read_desk_resource_encumbrance_v1(uuid,text,text)','EXECUTE')
 or has_function_privilege('mizizi_executor','public.mizizi_read_desk_resource_encumbrance_v1(uuid,text,text)','EXECUTE')
 or has_function_privilege('service_role','mizizi_private.desk_resource_encumbered_units_v1(mizizi_private.desk_resource_reservations_v1)','EXECUTE')
 then raise exception 'STOP_MIZIZI_SYNC_METER_ACL';end if;
end $acl$;
commit;
