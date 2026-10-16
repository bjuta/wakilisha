-- MIZIZI Slice 2: one private, immutable pass history for an existing case/job.
-- CLI-minted authority: 20261016064245_mizizi_research_pass_memory_v1.sql
-- No new queue, canonical Registry writer, grants or public case reader.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';

do $wk_preflight$
begin
 if current_user <> 'postgres'
    or to_regclass('mizizi_private.cases') is null
    or to_regclass('platform_private.jobs') is null
    or to_regprocedure('public.mizizi_claim_case_research_jobs_v1(text,integer,integer)') is null
 then
  raise exception 'MIZIZI research-pass substrate or migration authority absent';
 end if;
 if to_regclass('mizizi_private.research_passes') is not null
    or to_regprocedure('public.mizizi_append_research_pass_v1(uuid,text,text,text,text)') is not null
    or to_regprocedure('public.mizizi_read_research_passes_v1(uuid,text)') is not null
 then
  raise exception 'MIZIZI research-pass schema collision';
 end if;
 if has_schema_privilege('service_role','mizizi_private','USAGE')
    or has_schema_privilege('authenticated','mizizi_private','USAGE')
    or has_schema_privilege('anon','mizizi_private','USAGE')
 then
  raise exception 'MIZIZI private-schema role authority drift';
 end if;
end;
$wk_preflight$;

create table mizizi_private.research_passes (
  id bigint generated always as identity primary key,
  case_id uuid not null,
  workspace_id uuid not null,
  job_id uuid not null references platform_private.jobs(id) on delete restrict,
  ordinal integer not null check (ordinal between 1 and 10000),
  predecessor_fingerprint text,
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  body_text text not null check (octet_length(body_text)<=32768),
  recorded_at timestamptz not null default now(),
  constraint mizizi_research_pass_case_fk
    foreign key(workspace_id,case_id)
    references mizizi_private.cases(workspace_id,id)
    on update restrict on delete restrict,
  constraint mizizi_research_pass_chain_shape
    check ((ordinal=1 and predecessor_fingerprint is null) or
           (ordinal>1 and predecessor_fingerprint ~ '^[a-f0-9]{64}$')),
  constraint mizizi_research_pass_order_unique unique(case_id,ordinal),
  constraint mizizi_research_pass_fingerprint_unique unique(case_id,fingerprint)
);
create index mizizi_research_pass_job_idx
 on mizizi_private.research_passes(job_id);
alter table mizizi_private.research_passes enable row level security;
alter table mizizi_private.research_passes force row level security;
revoke all on mizizi_private.research_passes from public,anon,authenticated,service_role,mizizi_executor;
revoke all on sequence mizizi_private.research_passes_id_seq from public,anon,authenticated,service_role,mizizi_executor;

create function mizizi_private.block_research_pass_mutation_v1()
returns trigger language plpgsql security invoker
set search_path=pg_catalog as $block$
begin
 raise exception 'MIZIZI research passes are immutable' using errcode='55000';
end;
$block$;
create trigger mizizi_research_pass_immutable
before update or delete on mizizi_private.research_passes
for each row execute function mizizi_private.block_research_pass_mutation_v1();
revoke all on function mizizi_private.block_research_pass_mutation_v1()
 from public,anon,authenticated,service_role,mizizi_executor;

-- The service may read a case's private pass history only while it holds
-- the actual currently leased research job belonging to that same case.
create function public.mizizi_read_research_passes_v1(
 p_job_id uuid,p_worker_id text
)
returns table (ordinal integer,body_text text,fingerprint text)
language plpgsql security definer set search_path=pg_catalog
as $read$
declare v_case_id uuid;
begin
 if coalesce(auth.role(),'')<>'service_role' then
  raise exception 'Service-role research authority required' using errcode='42501';
 end if;
 if p_job_id is null or p_worker_id is null or
    p_worker_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$'
 then raise exception 'Invalid leased research identity' using errcode='22023';
 end if;
 select c.id into v_case_id
  from platform_private.jobs j
  join mizizi_private.case_resource_bindings b
   on b.resource_id=j.resource_id and b.case_id=j.resource_id
  join mizizi_private.cases c
   on c.id=b.case_id and c.workspace_id=b.workspace_id
 where j.id=p_job_id
   and j.command_type='mizizi.case_research_v1'
   and j.job_type='mizizi.case_research_v1'
   and j.status='running' and j.locked_by=p_worker_id
   and j.lease_expires_at>now()
   and (j.input_payload->>'case_id')::uuid=c.id
   and (j.input_payload->>'workspace_id')::uuid=c.workspace_id
   and c.current_stage='research'
   and c.revision=(j.input_payload->>'expected_case_revision')::integer;
 if v_case_id is null then
  raise exception 'Research case/worker lease not current' using errcode='55000';
 end if;
 return query
  select p.ordinal,p.body_text,p.fingerprint
  from mizizi_private.research_passes p
  where p.case_id=v_case_id order by p.ordinal;
end;
$read$;
revoke all on function public.mizizi_read_research_passes_v1(uuid,text)
 from public,anon,authenticated,mizizi_executor;
grant execute on function public.mizizi_read_research_passes_v1(uuid,text)
 to service_role;

-- Atomically append one SHA-verified pass. JSON stays as exact UTF-8 text so
-- Postgres jsonb key reordering cannot invalidate the research fingerprint.
-- This never modifies Registry, case stage, human decisions or job status.
create function public.mizizi_append_research_pass_v1(
 p_job_id uuid,p_worker_id text,p_body_text text,
 p_fingerprint text,p_predecessor text
)
returns table (case_id uuid,ordinal integer,fingerprint text,outcome text)
language plpgsql security definer set search_path=pg_catalog
as $append$
declare
 v_case_id uuid;
 v_workspace_id uuid;
 v_body jsonb;
 v_ordinal integer;
 v_last_ordinal integer;
 v_last_fingerprint text;
 v_existing text;
begin
 if coalesce(auth.role(),'')<>'service_role' then
  raise exception 'Service-role research authority required' using errcode='42501';
 end if;
 if p_job_id is null or p_worker_id is null or
    p_worker_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$' or
    p_body_text is null or octet_length(p_body_text)>32768 or
    (p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$')
 then raise exception 'Invalid bounded research-pass request' using errcode='22023';
 end if;
 if encode(sha256(convert_to(p_body_text,'UTF8')),'hex')<>p_fingerprint
 then raise exception 'Research-pass content fingerprint mismatch' using errcode='22023';
 end if;
 begin
  v_body:=p_body_text::jsonb;
 exception when others then
  raise exception 'Invalid research-pass JSON' using errcode='22023';
 end;
 if jsonb_typeof(v_body)<>'object'
    or v_body->>'contract' is distinct from 'mizizi.adaptive_investigation.v1'
    or v_body ? 'fingerprint'
    or jsonb_typeof(v_body->'sourceReceipts')<>'array'
    or jsonb_array_length(v_body->'sourceReceipts')>30
    or jsonb_typeof(v_body->'findings')<>'array'
    or jsonb_typeof(v_body->'proposedLeads')<>'array'
    or jsonb_typeof(v_body->'decision')<>'object'
 then
  raise exception 'Invalid research-pass contract' using errcode='22023';
 end if;
 begin
  v_ordinal:=(v_body->>'ordinal')::integer;
 exception when others then
  raise exception 'Research-pass ordinal is invalid' using errcode='22023';
 end;
 if (v_ordinal is null or v_ordinal not between 1 and 10000)
    or nullif(v_body->>'question','') is null
    or (v_body->>'predecessorFingerprint') is distinct from p_predecessor
 then raise exception 'Invalid research-pass identity' using errcode='22023';
 end if;
 -- Serialize appenders on the actual case row, and verify the worker's
 -- current lease and exact case revision inside this very transaction.
 select c.id,c.workspace_id into v_case_id,v_workspace_id
 from platform_private.jobs j
 join platform_private.command_receipts cr
  on cr.id=j.command_receipt_id
   and cr.resource_id=j.resource_id and cr.command_type=j.command_type
 join mizizi_private.case_resource_bindings b
  on b.resource_id=j.resource_id and b.case_id=j.resource_id
 join mizizi_private.cases c
  on c.id=b.case_id and c.workspace_id=b.workspace_id
 where j.id=p_job_id
  and j.command_type='mizizi.case_research_v1'
  and j.job_type='mizizi.case_research_v1'
  and j.status='running' and j.locked_by=p_worker_id
  and j.lease_expires_at>now() and cr.status='accepted'
  and (j.input_payload->>'case_id')::uuid=c.id
  and (j.input_payload->>'workspace_id')::uuid=c.workspace_id
  and j.input_payload->>'operation'='read_only_research'
  and c.case_state in ('open','in_progress')
  and c.current_stage='research'
  and c.revision=(j.input_payload->>'expected_case_revision')::integer
 for update of j,c;
 if v_case_id is null then
  raise exception 'Research pass is not authorized by a current job lease' using errcode='55000';
 end if;
 if v_body->>'caseId' is distinct from v_case_id::text
    or v_body->>'workspaceId' is distinct from v_workspace_id::text
 then raise exception 'Research-pass workspace or case mismatch' using errcode='42501';
 end if;
 select p.fingerprint into v_existing
  from mizizi_private.research_passes p
 where p.case_id=v_case_id and p.ordinal=v_ordinal;
 if v_existing is not null then
  if v_existing<>p_fingerprint then
   raise exception 'Conflicting immutable pass ordinal' using errcode='55000';
  end if;
  return query select v_case_id,v_ordinal,p_fingerprint,'replayed'::text;
  return;
 end if;
 select p.ordinal,p.fingerprint into v_last_ordinal,v_last_fingerprint
 from mizizi_private.research_passes p
 where p.case_id=v_case_id order by p.ordinal desc limit 1;
 if v_ordinal<>coalesce(v_last_ordinal,0)+1
    or p_predecessor is distinct from v_last_fingerprint
 then raise exception 'Research-pass chain stale or out of order' using errcode='55000';
 end if;
 insert into mizizi_private.research_passes(
  case_id,workspace_id,job_id,ordinal,predecessor_fingerprint,fingerprint,body_text
 ) values(
  v_case_id,v_workspace_id,p_job_id,v_ordinal,p_predecessor,p_fingerprint,p_body_text
 );
 return query select v_case_id,v_ordinal,p_fingerprint,'created'::text;
end;
$append$;
revoke all on function public.mizizi_append_research_pass_v1(uuid,text,text,text,text)
 from public,anon,authenticated,mizizi_executor;
grant execute on function public.mizizi_append_research_pass_v1(uuid,text,text,text,text)
 to service_role;
commit;
