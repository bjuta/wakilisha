-- WK100 W5C correction decision ledger.
-- Forward migration filename minted by Supabase CLI v2.107.0 on 2026-11-12,
-- in isolated GitHub Actions run 43261577325, no DB operations.
-- Original Preview-only W5C v1 (20261110190405) remains preserved at
-- docs/engineering/replay-baseline/preview-only/20261110190405_wk100_correction_decision_ledger_v1.sql.
-- Same operational SQL, forwarded after already-applied 20261112123805
-- withdrawal migration; canonical SQL acceptance required before Production.
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
     or to_regprocedure('public.admin_patch_registry_track_profile_v1(uuid,jsonb,timestamptz)') is null
     or to_regprocedure('public.admin_patch_registry_release_profile_v1(uuid,jsonb,timestamptz)') is null
     or to_regclass('public.registry_track_provider_links') is null
     or to_regclass('public.provider_entity_links') is null
     or to_regclass('public.registry_tracks') is null
     or to_regclass('public.registry_releases') is null
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
    ('hold','request_registry_review','closed_no_change','applied_registry')),
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
    ('hold','request_registry_review','closed_no_change','applied_registry')),
  reason text not null check (length(btrim(reason)) between 12 and 800),
  writer_authority text,
  writer_entity_type text,
  writer_entity_id uuid,
  writer_before_value jsonb,
  writer_after_value jsonb,
  writer_before_updated_at timestamptz,
  writer_after_updated_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  unique (case_id,revision),
  constraint wk100_correction_applied_event_only_with_provenance check (
    (decision='applied_registry'
      and writer_authority in ('admin_patch_registry_track_profile_v1',
                               'admin_patch_registry_release_profile_v1')
      and writer_entity_type in ('track','release')
      and writer_entity_id is not null and writer_before_value is not null
      and writer_after_value is not null
      and writer_before_value is distinct from writer_after_value
      and writer_before_updated_at is not null
      and writer_after_updated_at is not null)
    or (decision<>'applied_registry'
      and writer_authority is null and writer_entity_type is null
      and writer_entity_id is null and writer_before_value is null
      and writer_after_value is null and writer_before_updated_at is null
      and writer_after_updated_at is null)
  )
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
     or old.state in ('closed_no_change','applied_registry')
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
  if v_operation is null then
    raise exception 'WK100 correction operation ID required' using errcode='22023';
  end if;
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
  -- Serialize duplicate operation IDs BEFORE examining event history.
  -- Concurrent identical retries then read the committed event, not a
  -- unique-key violation; collisions still fail with the explicit 40001.
  -- Transaction-scoped lock is released on commit or rollback.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('wk100-correction:'||v_operation::text,0));
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
       or v_case.state in ('closed_no_change','applied_registry')
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


-- Case-bound W5C canonical application: the typed Registry writer is invoked
-- inside THIS transaction before the private immutable event is appended.
-- Existing public registry_audit_log/write_events rows are not trusted proof.
create function public.wk100_apply_reviewed_registry_correction_v1(
 p_case_id uuid,p_expected_case_revision bigint,
 p_expected_entity_updated_at timestamptz,p_new_value jsonb,
 p_operation_id uuid,p_reason text
) returns jsonb language plpgsql security definer set search_path=pg_catalog
as $apply$
declare
 v_actor uuid:=auth.uid();
 v_case platform_private.wk100_correction_cases_v1%rowtype;
 v_retry platform_private.wk100_correction_events_v1%rowtype;
 v_attempt public.wk_chart_capture_attempts_v1%rowtype;
 v_source_row public.wk_chart_capture_rows_v1%rowtype;
 v_draft platform_private.wk100_admin_weekly_drafts_v1%rowtype;
 v_provider text;
 v_matches integer;
 v_track_id uuid;
 v_entity_id uuid;
 v_entity_type text;
 v_field text;
 v_writer text;
 v_before jsonb;
 v_after jsonb;
 v_readback jsonb;
 v_patch jsonb;
 v_hash text;
 v_event uuid;
 v_now timestamptz:=clock_timestamp();
begin
 if v_actor is null
    or coalesce(public.current_user_has_capability('manage_ingest'),false) is not true
    or coalesce(public.current_user_has_capability('manage_charts'),false) is not true
    or coalesce(public.current_user_has_capability('view_registry'),false) is not true
    or coalesce(public.current_user_has_capability('manage_registry'),false) is not true
 then
   raise exception 'W5C canonical application needs ingest, chart and Registry steward capabilities'
     using errcode='42501';
 end if;
 if p_case_id is null or p_operation_id is null
    or p_expected_case_revision is null or p_expected_case_revision<1
    or p_expected_entity_updated_at is null or p_new_value is null
    or p_reason is null or length(btrim(p_reason)) not between 12 and 800
 then
   raise exception 'W5C canonical correction request invalid' using errcode='22023';
 end if;
 v_hash:=encode(extensions.digest(jsonb_build_object(
   'caseId',p_case_id,'expectedCaseRevision',p_expected_case_revision,
   'expectedEntityUpdatedAt',p_expected_entity_updated_at,
   'newValue',p_new_value,'operationId',p_operation_id,
   'reason',btrim(p_reason))::text,'sha256'),'hex');
 perform pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended('wk100-correction:'||p_operation_id::text,0));
 select * into v_retry from platform_private.wk100_correction_events_v1
   where operation_id=p_operation_id;
 if found then
   if v_retry.actor_id is distinct from v_actor
      or v_retry.case_id is distinct from p_case_id
      or v_retry.request_sha256 is distinct from v_hash
      or v_retry.decision<>'applied_registry'
   then
     raise exception 'W5C correction operation ID collision' using errcode='40001';
   end if;
   return jsonb_build_object('persisted',true,'alreadyRecorded',true,
     'caseId',p_case_id,'eventId',v_retry.id,'revision',v_retry.revision,
     'state','applied_registry','writerAuthority',v_retry.writer_authority,
     'registryEntityType',v_retry.writer_entity_type,
     'registryEntityId',v_retry.writer_entity_id,
     'verifiedWriterExecuted',true,'canScore',false,'canPublish',false);
 end if;
 -- Prevent an approval/staging insert or a provider-identity reassignment
 -- from racing the canonical write after the point-in-time checks below.
 -- These locks are transaction-scoped and used only for the rare accepted
 -- Registry correction, never for routine W5 preview or case review reads.
 lock table platform_private.wk100_governed_editorial_approvals_v1,
   platform_private.wk100_governed_staged_editions_v1 in share mode;
 lock table public.registry_track_provider_links,
   public.provider_entity_links in share mode;
 select * into v_case from platform_private.wk100_correction_cases_v1
   where id=p_case_id for update;
 if v_case.id is null or v_case.revision is distinct from p_expected_case_revision
    or v_case.state<>'request_registry_review'
    or v_case.field_path not in (
      'track.title','track.isrc','track.explicit','track.duration_ms',
      'release.release_type','release.release_date')
 then
   raise exception 'W5C correction case missing, stale or not canonical-writable'
     using errcode='40001';
 end if;
 select * into v_attempt from public.wk_chart_capture_attempts_v1
   where id=v_case.receipt_id and contract_id=v_case.contract_id
     and week_start_eat=v_case.week_start_eat;
 select * into v_source_row from public.wk_chart_capture_rows_v1
   where id=v_case.capture_row_id and attempt_id=v_case.receipt_id;
 if v_attempt.id is null or v_source_row.id is null
    or v_attempt.status not in ('succeeded','partial_depth')
    or v_attempt.payload_sha256 is distinct from v_case.original_sha256
    or v_source_row.source_rank is distinct from v_case.source_rank
    or v_source_row.provider_track_id is distinct from v_case.provider_track_id
    or v_source_row.provider_track_id is null
 then
   raise exception 'W5C source receipt or position changed' using errcode='40001';
 end if;
 select * into v_draft from platform_private.wk100_admin_weekly_drafts_v1
   where week_start_eat=v_case.week_start_eat for share;
 if v_draft.week_start_eat is null
    or v_draft.revision is distinct from v_case.policy_revision
    or v_draft.config_json->>'ingestPolicySha256'
       is distinct from v_case.policy_sha256
    or exists(select 1 from platform_private.wk100_governed_editorial_approvals_v1
       where week_start_eat=v_case.week_start_eat)
    or exists(select 1 from platform_private.wk100_governed_staged_editions_v1
       where week_start_eat=v_case.week_start_eat)
 then
   raise exception 'W5C Edition policy or approval state changed' using errcode='40001';
 end if;
 select case when c.provider_key='apple_ke' then 'apple_music'
             else c.provider_key end into v_provider
   from public.wk_chart_capture_contracts_v1 c
   where c.id=v_case.contract_id and c.market='KE';
 if v_provider is null then
   raise exception 'W5C capture contract missing' using errcode='40001';
 end if;
 -- Exact W4 provider namespace. Check ALL matched and confirmed links,
 -- including links pointing to inactive Tracks, before active admission.
 select count(distinct x.track_id),min(x.track_id)::uuid
   into v_matches,v_track_id from (
     select l.track_id::text track_id from public.registry_track_provider_links l
       where l.provider_key=v_provider and
         l.provider_track_id=v_source_row.provider_track_id and l.match_status='matched'
     union
     select l.registry_entity_id track_id from public.provider_entity_links l
       where l.provider=v_provider and
         l.provider_entity_id=v_source_row.provider_track_id
         and l.registry_entity_type='track' and l.match_status='confirmed'
         and l.registry_entity_id ~ '^[0-9a-f-]{36}$'
   ) x;
 if v_matches<>1 or v_track_id is null
    or not exists(select 1 from public.registry_tracks
      where id=v_track_id and status='active')
 then
   raise exception 'W5C canonical recording link is not uniquely active'
     using errcode='40001';
 end if;
 v_field:=split_part(v_case.field_path,'.',2);
 if v_case.field_path like 'track.%' then
   v_entity_type:='track';v_entity_id:=v_track_id;
   v_writer:='admin_patch_registry_track_profile_v1';
 else
   v_entity_type:='release';
   select t.release_id into v_entity_id from public.registry_tracks t
     where t.id=v_track_id and t.status='active';
   v_writer:='admin_patch_registry_release_profile_v1';
 end if;
 if v_entity_id is null then
   raise exception 'W5C canonical target missing' using errcode='40001';
 end if;
 -- A single field from the existing typed profile-writer allowlist.
 if (v_field='title' and
      (jsonb_typeof(p_new_value)<>'string'
       or length(btrim(p_new_value#>>'{}')) not between 1 and 300
       or btrim(p_new_value#>>'{}')<>p_new_value#>>'{}'))
    or (v_field='isrc' and
      (jsonb_typeof(p_new_value) not in ('string','null')
       or (jsonb_typeof(p_new_value)='string' and
          (length(p_new_value#>>'{}') not between 1 and 32 or
           btrim(p_new_value#>>'{}')<>p_new_value#>>'{}'))))
    or (v_field='explicit' and
      jsonb_typeof(p_new_value) not in ('boolean','null'))
    or (v_field='duration_ms' and
      (jsonb_typeof(p_new_value) not in ('number','null') or
       (jsonb_typeof(p_new_value)='number' and
        ((p_new_value#>>'{}') !~ '^[0-9]{1,8}$' or
         (p_new_value#>>'{}')::integer>86400000))))
    or (v_field='release_type' and
      (jsonb_typeof(p_new_value)<>'string' or p_new_value#>>'{}' not in
       ('single','ep','album','mixtape','compilation','video','live','unknown')))
    or (v_field='release_date' and
      (jsonb_typeof(p_new_value) not in ('string','null') or
       (jsonb_typeof(p_new_value)='string' and
        p_new_value#>>'{}' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')))
 then
   raise exception 'W5C canonical patch violates field authority'
     using errcode='22023';
 end if;
 v_patch:=jsonb_build_object(v_field,p_new_value);
 if v_entity_type='track' then
   select to_jsonb(t) into v_before from public.registry_tracks t
     where t.id=v_entity_id and t.status='active' for update;
 else
   select to_jsonb(r) into v_before from public.registry_releases r
     where r.id=v_entity_id and r.status='active' for update;
 end if;
 if v_before is null or (v_before->>'updated_at')::timestamptz
     is distinct from p_expected_entity_updated_at
    or v_before->v_field is not distinct from p_new_value
 then
   raise exception 'W5C canonical fact changed or no factual difference'
     using errcode='40001';
 end if;
 -- The application proof is created after the canonical writer's real
 -- execution, in the SAME PostgreSQL transaction. Failure rolls both back.
 if v_entity_type='track' then
   v_after:=public.admin_patch_registry_track_profile_v1(
     v_entity_id,v_patch,p_expected_entity_updated_at);
   select to_jsonb(t) into v_readback from public.registry_tracks t where t.id=v_entity_id;
 else
   v_after:=public.admin_patch_registry_release_profile_v1(
     v_entity_id,v_patch,p_expected_entity_updated_at);
   select to_jsonb(r) into v_readback from public.registry_releases r where r.id=v_entity_id;
 end if;
 if v_after is null or v_after->>'id' is distinct from v_entity_id::text
    or v_after is distinct from v_readback
    or v_after->v_field is distinct from p_new_value
    or v_after->>'updated_at' is null
 then
   raise exception 'W5C typed canonical writer readback mismatch'
     using errcode='40001';
 end if;
 insert into platform_private.wk100_correction_events_v1 (
   case_id,revision,operation_id,request_sha256,actor_id,decision,reason,
   writer_authority,writer_entity_type,writer_entity_id,
   writer_before_value,writer_after_value,
   writer_before_updated_at,writer_after_updated_at,created_at)
 values (v_case.id,v_case.revision+1,p_operation_id,v_hash,v_actor,
   'applied_registry',btrim(p_reason),v_writer,v_entity_type,v_entity_id,
   v_before->v_field,v_after->v_field,
   (v_before->>'updated_at')::timestamptz,
   (v_after->>'updated_at')::timestamptz,v_now)
 returning id into v_event;
 update platform_private.wk100_correction_cases_v1
   set revision=revision+1,state='applied_registry',
     updated_by=v_actor,updated_at=v_now
   where id=v_case.id and revision=v_case.revision;
 if not found then
   raise exception 'W5C case changed during canonical application'
     using errcode='40001';
 end if;
 return jsonb_build_object('persisted',true,'alreadyRecorded',false,
   'caseId',v_case.id,'eventId',v_event,'revision',v_case.revision+1,
   'state','applied_registry','writerAuthority',v_writer,
   'registryEntityType',v_entity_type,'registryEntityId',v_entity_id,
   'verifiedWriterExecuted',true,'canScore',false,'canPublish',false);
end
$apply$;
revoke all on function public.wk100_apply_reviewed_registry_correction_v1(
 uuid,bigint,timestamptz,jsonb,uuid,text)
 from public,anon,authenticated,service_role;
grant execute on function public.wk100_apply_reviewed_registry_correction_v1(
 uuid,bigint,timestamptz,jsonb,uuid,text) to authenticated;


-- W6 independent live Registry readback. Proof is sourced exclusively from
-- a private event committed by the case-bound typed Registry writer above.
-- Later edits invalidate the "current" comparison, never change history.
create function public.wk100_read_correction_application_v1(p_case_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $proof$
declare
 v_actor uuid:=auth.uid();
 v_case platform_private.wk100_correction_cases_v1%rowtype;
 v_event platform_private.wk100_correction_events_v1%rowtype;
 v_now jsonb;
 v_field text;
 v_current boolean:=false;
begin
 if v_actor is null
    or coalesce(public.current_user_has_capability('manage_ingest'),false) is not true
    or coalesce(public.current_user_has_capability('manage_charts'),false) is not true
    or coalesce(public.current_user_has_capability('view_registry'),false) is not true
 then
   raise exception 'W6 correction proof read denied' using errcode='42501';
 end if;
 if p_case_id is null then
   raise exception 'W6 proof needs a case ID' using errcode='22023';
 end if;
 select * into v_case from platform_private.wk100_correction_cases_v1
   where id=p_case_id and state='applied_registry';
 if v_case.id is null then
   raise exception 'W6 applied Registry case unavailable' using errcode='40001';
 end if;
 select * into v_event from platform_private.wk100_correction_events_v1
   where case_id=v_case.id and revision=v_case.revision
     and decision='applied_registry';
 if v_event.id is null then
   raise exception 'W6 application event unavailable' using errcode='40001';
 end if;
 v_field:=split_part(v_case.field_path,'.',2);
 if v_event.writer_entity_type='track' then
   select to_jsonb(t) into v_now from public.registry_tracks t
     where t.id=v_event.writer_entity_id and t.status='active';
 elsif v_event.writer_entity_type='release' then
   select to_jsonb(r) into v_now from public.registry_releases r
     where r.id=v_event.writer_entity_id and r.status='active';
 end if;
 v_current:=v_now is not null
   and v_now->v_field is not distinct from v_event.writer_after_value
   and (v_now->>'updated_at')::timestamptz
       is not distinct from v_event.writer_after_updated_at;
 return jsonb_build_object(
   'schemaVersion','wk100-correction-application-proof/v1',
   'caseId',v_case.id,'eventId',v_event.id,
   'weekStartEat',v_case.week_start_eat,'contractId',v_case.contract_id,
   'receiptId',v_case.receipt_id,'captureRowId',v_case.capture_row_id,
   'sourceRank',v_case.source_rank,'originalSha256',v_case.original_sha256,
   'policyRevision',v_case.policy_revision,'policySha256',v_case.policy_sha256,
   'registryFactsBeforeSha256',v_case.asserted_registry_facts_sha256,
   'fieldPath',v_case.field_path,'writerAuthority',v_event.writer_authority,
   'registryEntityType',v_event.writer_entity_type,
   'registryEntityId',v_event.writer_entity_id,
   'beforeValue',v_event.writer_before_value,
   'afterValue',v_event.writer_after_value,
   'expectedUpdatedAt',v_event.writer_before_updated_at,
   'appliedUpdatedAt',v_event.writer_after_updated_at,
   'appliedAt',v_event.created_at,
   'verifiedWriterExecuted',true,'canonicalAfterMatchesCurrent',v_current,
   'canScore',false,'canPublish',false
 );
end
$proof$;
revoke all on function public.wk100_read_correction_application_v1(uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.wk100_read_correction_application_v1(uuid)
  to authenticated;

comment on table platform_private.wk100_correction_cases_v1 is
  'Private, source-bound WK100 correction case heads. No direct browser access.';
comment on table platform_private.wk100_correction_events_v1 is
  'Immutable W5C review and typed Registry application events. The only applied event is created atomically with existing Track/Release profile writers.';
commit;
