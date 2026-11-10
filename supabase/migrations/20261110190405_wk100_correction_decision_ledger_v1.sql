-- WK100 W5C correction decision ledger.
-- Exact filename minted by Supabase CLI v2.107.0 on 2026-11-10.
-- CANDIDATE ONLY. Not applied to Production; isolated SQL acceptance required.
-- No canonical Registry/source/policy writes, scoring, staging, or publication.
begin;

do $preflight$
begin
  if to_regclass('public.wk_chart_capture_attempts_v1') is null
     or to_regclass('public.wk_chart_capture_rows_v1') is null
     or to_regclass('public.wk_chart_capture_contracts_v1') is null
     or to_regclass('platform_private.wk100_admin_weekly_drafts_v1') is null
     or to_regclass('platform_private.wk100_governed_editorial_approvals_v1') is null
     or to_regclass('platform_private.wk100_governed_staged_editions_v1') is null
     or to_regprocedure('public.current_user_has_capability(text)') is null
  then
    raise exception 'WK100 correction ledger requires accepted source, Registry, and Edition authorities'
      using errcode='55000';
  end if;
  if to_regclass('platform_private.wk100_correction_cases_v1') is not null
     or to_regclass('platform_private.wk100_correction_events_v1') is not null
     or to_regprocedure('public.wk100_record_correction_decision_v1(jsonb)') is not null
     or to_regprocedure('public.wk100_read_correction_cases_v1(date,uuid,uuid)') is not null
  then
    raise exception 'WK100 correction ledger already installed' using errcode='55000';
  end if;
end
$preflight$;

create table platform_private.wk100_correction_cases_v1 (
  id uuid primary key default gen_random_uuid(),
  week_start_eat date not null check (extract(isodow from week_start_eat)=1),
  contract_id uuid not null references public.wk_chart_capture_contracts_v1(id) on delete restrict,
  receipt_id uuid not null references public.wk_chart_capture_attempts_v1(id) on delete restrict,
  capture_row_id uuid not null references public.wk_chart_capture_rows_v1(id) on delete restrict,
  source_rank integer not null check (source_rank between 1 and 200),
  provider_track_id text,
  field_path text not null check (field_path in (
    'track.title','track.isrc','track.explicit','track.duration_ms',
    'release.release_type','release.release_date','artist.origin_iso2',
    'credits.primary_featured','recording.identity','track.genres','track.languages')),
  original_sha256 text not null check (original_sha256 ~ '^[a-f0-9]{64}$'),
  policy_revision bigint not null check (policy_revision>=1),
  policy_sha256 text not null check (policy_sha256 ~ '^[a-f0-9]{64}$'),
  asserted_registry_facts_sha256 text not null
    check (asserted_registry_facts_sha256 ~ '^[a-f0-9]{64}$'),
  revision bigint not null check (revision>=1),
  state text not null check (state in
    ('hold','request_registry_review','closed_no_change')),
  opened_by uuid not null references auth.users(id) on delete restrict,
  opened_at timestamptz not null default clock_timestamp(),
  updated_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default clock_timestamp(),
  unique (receipt_id,capture_row_id,field_path,policy_revision)
);
create index wk100_correction_cases_receipt_idx
  on platform_private.wk100_correction_cases_v1
  (week_start_eat,receipt_id,capture_row_id,field_path);

create table platform_private.wk100_correction_events_v1 (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references platform_private.wk100_correction_cases_v1(id) on delete restrict,
  revision bigint not null check (revision>=1),
  operation_id uuid not null unique,
  request_sha256 text not null check (request_sha256 ~ '^[a-f0-9]{64}$'),
  actor_id uuid not null references auth.users(id) on delete restrict,
  decision text not null check (decision in
    ('hold','request_registry_review','closed_no_change')),
  reason text not null check (length(btrim(reason)) between 12 and 800),
  created_at timestamptz not null default clock_timestamp(),
  unique (case_id,revision)
);
create index wk100_correction_events_case_idx
  on platform_private.wk100_correction_events_v1(case_id,revision desc);

alter table platform_private.wk100_correction_cases_v1 enable row level security;
alter table platform_private.wk100_correction_events_v1 enable row level security;
revoke all on platform_private.wk100_correction_cases_v1 from public,anon,authenticated,service_role;
revoke all on platform_private.wk100_correction_events_v1 from public,anon,authenticated,service_role;

create function platform_private.wk100_correction_events_immutable_v1()
returns trigger language plpgsql security invoker set search_path=pg_catalog
as $function$
begin
  raise exception 'WK100 correction history is append-only' using errcode='42501';
end
$function$;
revoke all on function platform_private.wk100_correction_events_immutable_v1()
  from public,anon,authenticated,service_role;
create trigger wk100_correction_events_no_update_delete_v1
before update or delete on platform_private.wk100_correction_events_v1
for each row execute function platform_private.wk100_correction_events_immutable_v1();
create trigger wk100_correction_events_no_truncate_v1
before truncate on platform_private.wk100_correction_events_v1
for each statement execute function platform_private.wk100_correction_events_immutable_v1();

create function platform_private.wk100_correction_case_guard_v1()
returns trigger language plpgsql security invoker set search_path=pg_catalog
as $function$
begin
  if tg_op='DELETE' or tg_op='TRUNCATE' then
    raise exception 'WK100 correction cases cannot be deleted' using errcode='42501';
  end if;
  if row(new.id,new.week_start_eat,new.contract_id,new.receipt_id,
      new.capture_row_id,new.source_rank,new.provider_track_id,new.field_path,
      new.original_sha256,new.policy_revision,new.policy_sha256,
      new.asserted_registry_facts_sha256,new.opened_by,new.opened_at)
     is distinct from
     row(old.id,old.week_start_eat,old.contract_id,old.receipt_id,
      old.capture_row_id,old.source_rank,old.provider_track_id,old.field_path,
      old.original_sha256,old.policy_revision,old.policy_sha256,
      old.asserted_registry_facts_sha256,old.opened_by,old.opened_at)
     or new.revision<>old.revision+1
     or old.state='closed_no_change'
  then
    raise exception 'WK100 correction case lineage or terminal state cannot change'
      using errcode='42501';
  end if;
  return new;
end
$function$;
revoke all on function platform_private.wk100_correction_case_guard_v1()
  from public,anon,authenticated,service_role;
create trigger wk100_correction_cases_update_guard_v1
before update on platform_private.wk100_correction_cases_v1
for each row execute function platform_private.wk100_correction_case_guard_v1();
create trigger wk100_correction_cases_delete_guard_v1
before delete on platform_private.wk100_correction_cases_v1
for each row execute function platform_private.wk100_correction_case_guard_v1();
create trigger wk100_correction_cases_truncate_guard_v1
before truncate on platform_private.wk100_correction_cases_v1
for each statement execute function platform_private.wk100_correction_case_guard_v1();

-- The only write entrypoint. Every operation belongs to an exact immutable
-- receipt row and current, server-read Edition policy. Source/Registry writes
-- remain owned by their established typed authorities.
create function public.wk100_record_correction_decision_v1(p_request jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $function$
declare
  v_actor uuid:=auth.uid();
  v_week date;
  v_contract uuid;
  v_receipt uuid;
  v_capture_row uuid;
  v_operation uuid;
  v_input_hash text;
  v_field text;
  v_reason text;
  v_decision text;
  v_policy_revision bigint;
  v_expected_revision bigint;
  v_attempt public.wk_chart_capture_attempts_v1%rowtype;
  v_row public.wk_chart_capture_rows_v1%rowtype;
  v_draft platform_private.wk100_admin_weekly_drafts_v1%rowtype;
  v_case platform_private.wk100_correction_cases_v1%rowtype;
  v_retry platform_private.wk100_correction_events_v1%rowtype;
  v_new_revision bigint;
  v_event_id uuid;
  v_now timestamptz:=clock_timestamp();
begin
  if v_actor is null
     or coalesce(public.current_user_has_capability('manage_ingest'),false) is not true
     or coalesce(public.current_user_has_capability('manage_charts'),false) is not true
     or coalesce(public.current_user_has_capability('view_registry'),false) is not true
  then
    raise exception 'WK100 correction review requires ingest and Registry read capability'
      using errcode='42501';
  end if;
  if p_request is null or jsonb_typeof(p_request)<>'object' then
    raise exception 'WK100 correction request malformed' using errcode='22023';
  end if;
  if length(p_request::text)>5500
     or not (p_request ?& array[
       'schemaVersion','weekStartEat','contractId','receiptId','captureRowId',
       'fieldPath','originalSha256','policyRevision','policySha256',
       'registryFactsBeforeSha256','expectedCaseRevision','operationId',
       'decision','reason','canonicalWriteEventId'])
     or exists (select 1 from jsonb_object_keys(p_request) as k(key)
       where k.key <> all(array[
       'schemaVersion','weekStartEat','contractId','receiptId','captureRowId',
       'fieldPath','originalSha256','policyRevision','policySha256',
       'registryFactsBeforeSha256','expectedCaseRevision','operationId',
       'decision','reason','canonicalWriteEventId']))
     or p_request->>'schemaVersion'<>'wk100-correction-decision/v1'
     or coalesce(p_request->>'weekStartEat','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     or coalesce(p_request->>'policyRevision','') !~ '^[1-9][0-9]{0,8}$'
     or coalesce(p_request->>'expectedCaseRevision','') !~ '^(0|[1-9][0-9]{0,8})$'
     or coalesce(p_request->>'originalSha256','') !~ '^[a-f0-9]{64}$'
     or coalesce(p_request->>'policySha256','') !~ '^[a-f0-9]{64}$'
     or coalesce(p_request->>'registryFactsBeforeSha256','') !~ '^[a-f0-9]{64}$'
  then
    raise exception 'WK100 correction request malformed' using errcode='22023';
  end if;
  v_week:=(p_request->>'weekStartEat')::date;
  v_contract:=(p_request->>'contractId')::uuid;
  v_receipt:=(p_request->>'receiptId')::uuid;
  v_capture_row:=(p_request->>'captureRowId')::uuid;
  v_operation:=(p_request->>'operationId')::uuid;
  v_policy_revision:=(p_request->>'policyRevision')::bigint;
  v_expected_revision:=(p_request->>'expectedCaseRevision')::bigint;
  v_field:=p_request->>'fieldPath';
  v_decision:=p_request->>'decision';
  v_reason:=p_request->>'reason';
  v_input_hash:=encode(extensions.digest(p_request::text,'sha256'),'hex');

  if extract(isodow from v_week)<>1
     or v_field is null or v_field not in (
       'track.title','track.isrc','track.explicit','track.duration_ms',
       'release.release_type','release.release_date','artist.origin_iso2',
       'credits.primary_featured','recording.identity','track.genres','track.languages')
     or v_decision is null or v_decision not in (
       'hold','request_registry_review','closed_no_change')
     or v_reason is null or length(btrim(v_reason)) not between 12 and 800
  then
    raise exception 'WK100 correction field, decision, week, or reason invalid'
      using errcode='22023';
  end if;
  -- Existing Registry audit rows are caller-insertable for manage_registry.
  -- They are not independent evidence that the typed writer ran.
  if p_request->'canonicalWriteEventId' is distinct from 'null'::jsonb then
    raise exception 'WK100 review cannot claim a canonical write' using errcode='22023';
  end if;
  -- A lost-ack replay is idempotent even after the case has progressed.
  -- The token must still have the current caller capability.
  select * into v_retry from platform_private.wk100_correction_events_v1
    where operation_id=v_operation;
  if found then
    if v_retry.actor_id<>v_actor or v_retry.request_sha256<>v_input_hash then
      raise exception 'WK100 correction operation ID collision' using errcode='40001';
    end if;
    return jsonb_build_object(
      'persisted',true,'alreadyRecorded',true,'caseId',v_retry.case_id,
      'eventId',v_retry.id,'revision',v_retry.revision,
      'state',v_retry.decision,'canWriteRegistry',false,
      'canReEvaluate',false,'canScore',false,'canPublish',false);
  end if;

  select * into v_attempt from public.wk_chart_capture_attempts_v1
    where id=v_receipt and contract_id=v_contract and week_start_eat=v_week;
  select * into v_row from public.wk_chart_capture_rows_v1
    where id=v_capture_row and attempt_id=v_receipt;
  if v_attempt.id is null or v_row.id is null
     or v_attempt.status not in ('succeeded','partial_depth')
     or v_attempt.payload_sha256 is distinct from p_request->>'originalSha256'
     or not exists (select 1 from public.wk_chart_capture_contracts_v1 c
       where c.id=v_contract and c.market='KE')
  then
    raise exception 'WK100 correction original receipt or row changed'
      using errcode='40001';
  end if;
  select * into v_draft from platform_private.wk100_admin_weekly_drafts_v1
    where week_start_eat=v_week for share;
  if v_draft.week_start_eat is null
     or v_draft.revision<>v_policy_revision
     or v_draft.config_json->>'ingestPolicySha256'
        is distinct from p_request->>'policySha256'
     or exists (select 1 from platform_private.wk100_governed_editorial_approvals_v1
       where week_start_eat=v_week)
     or exists (select 1 from platform_private.wk100_governed_staged_editions_v1
       where week_start_eat=v_week)
  then
    raise exception 'WK100 correction Edition policy changed or week is locked'
      using errcode='40001';
  end if;

  select * into v_case from platform_private.wk100_correction_cases_v1
    where receipt_id=v_receipt and capture_row_id=v_capture_row
      and field_path=v_field and policy_revision=v_policy_revision
    for update;
  if found then
    if v_case.revision<>v_expected_revision
       or v_case.original_sha256<>v_attempt.payload_sha256
       or v_case.policy_sha256<>p_request->>'policySha256'
       or v_case.asserted_registry_facts_sha256
            <>p_request->>'registryFactsBeforeSha256'
       or v_case.contract_id<>v_contract
       or v_case.week_start_eat<>v_week
       or v_case.source_rank<>v_row.source_rank
       or v_case.provider_track_id is distinct from v_row.provider_track_id
       or v_case.state='closed_no_change'
    then
      raise exception 'WK100 correction case stale or terminal' using errcode='40001';
    end if;
    v_new_revision:=v_case.revision+1;
  else
    if v_expected_revision<>0 then
      raise exception 'WK100 correction case must begin with a review decision'
        using errcode='40001';
    end if;
    insert into platform_private.wk100_correction_cases_v1 (
      week_start_eat,contract_id,receipt_id,capture_row_id,
      source_rank,provider_track_id,field_path,original_sha256,
      policy_revision,policy_sha256,asserted_registry_facts_sha256,
      revision,state,opened_by,opened_at,updated_by,updated_at)
    values (v_week,v_contract,v_receipt,v_capture_row,
      v_row.source_rank,v_row.provider_track_id,v_field,
      v_attempt.payload_sha256,v_policy_revision,p_request->>'policySha256',
      p_request->>'registryFactsBeforeSha256',1,v_decision,
      v_actor,v_now,v_actor,v_now)
    on conflict do nothing returning * into v_case;
    if v_case.id is null then
      raise exception 'WK100 correction case concurrent creation' using errcode='40001';
    end if;
    v_new_revision:=1;
  end if;

  -- A review case is not evidence of an applied canonical correction.
  -- A separate trusted writer receipt and W6 acceptance remain required.
  insert into platform_private.wk100_correction_events_v1 (
    case_id,revision,operation_id,request_sha256,actor_id,decision,
    reason,created_at)
  values (v_case.id,v_new_revision,v_operation,v_input_hash,v_actor,v_decision,
    btrim(v_reason),v_now)
  returning id into v_event_id;
  if v_new_revision>1 then
    update platform_private.wk100_correction_cases_v1
      set revision=v_new_revision,state=v_decision,updated_by=v_actor,
          updated_at=v_now where id=v_case.id and revision=v_expected_revision;
    if not found then
      raise exception 'WK100 correction revision conflict' using errcode='40001';
    end if;
  end if;
  return jsonb_build_object(
    'persisted',true,'alreadyRecorded',false,'caseId',v_case.id,
    'eventId',v_event_id,'revision',v_new_revision,'state',v_decision,
    'canonicalWriteVerified',false,
    'canWriteRegistry',false,'canReEvaluate',false,
    'canScore',false,'canPublish',false);
end
$function$;
revoke all on function public.wk100_record_correction_decision_v1(jsonb)
  from public,anon,authenticated,service_role;
grant execute on function public.wk100_record_correction_decision_v1(jsonb)
  to authenticated;

-- Bounded private read model, caller JWT and the same W5 permissions.
create function public.wk100_read_correction_cases_v1(
  p_week date,p_receipt_id uuid,p_capture_row_id uuid
) returns jsonb language plpgsql security definer set search_path=pg_catalog
as $function$
declare v_actor uuid:=auth.uid(); v_payload jsonb;
begin
  if v_actor is null
     or coalesce(public.current_user_has_capability('manage_ingest'),false) is not true
     or coalesce(public.current_user_has_capability('manage_charts'),false) is not true
     or coalesce(public.current_user_has_capability('view_registry'),false) is not true
  then
    raise exception 'WK100 correction read denied' using errcode='42501';
  end if;
  if p_week is null or extract(isodow from p_week)<>1
     or p_receipt_id is null or p_capture_row_id is null
     or not exists(select 1 from public.wk_chart_capture_attempts_v1 a
       join public.wk_chart_capture_rows_v1 r on r.attempt_id=a.id
       where a.id=p_receipt_id and a.week_start_eat=p_week and r.id=p_capture_row_id)
  then
    raise exception 'WK100 correction read row invalid' using errcode='22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
     'caseId',c.id,'captureRowId',c.capture_row_id,'fieldPath',c.field_path,
     'policyRevision',c.policy_revision,'policySha256',c.policy_sha256,
     'originalSha256',c.original_sha256,'assertedRegistryFactsSha256',
       c.asserted_registry_facts_sha256,
     'revision',c.revision,'state',c.state,'updatedAt',c.updated_at,
     'eventCount',(select count(*) from platform_private.wk100_correction_events_v1 e
       where e.case_id=c.id)
   ) order by c.field_path,c.policy_revision),'[]'::jsonb)
   into v_payload from platform_private.wk100_correction_cases_v1 c
   where c.week_start_eat=p_week and c.receipt_id=p_receipt_id
     and c.capture_row_id=p_capture_row_id;
  return jsonb_build_object(
    'schemaVersion','wk100-correction-case-list/v1',
    'weekStartEat',p_week,'receiptId',p_receipt_id,
    'captureRowId',p_capture_row_id,'cases',v_payload,
    'canWriteRegistry',false,'canScore',false,'canPublish',false);
end
$function$;
revoke all on function public.wk100_read_correction_cases_v1(date,uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.wk100_read_correction_cases_v1(date,uuid,uuid)
  to authenticated;

comment on table platform_private.wk100_correction_cases_v1 is
  'Private, source-bound WK100 correction case heads. No direct browser access.';
comment on table platform_private.wk100_correction_events_v1 is
  'Immutable W5C case decisions. Registry edits must use existing canonical writers.';
commit;
