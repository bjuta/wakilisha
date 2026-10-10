-- MIZIZI Headquarters Slice 1: real typed Resource -> shared jobs bridge.
-- Candidate payload: MUST be CLI-minted into a canonical migration on the Mac,
-- clean-replayed, independently verified, and proof-sealed before PR acceptance.
-- No public/anon/authenticated/service-role case write API. No new queue.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '90s';

-- Do not silently reinterpret the known 221-migration Preview substrate.
do $prereq$
begin
  if to_regclass('mizizi_private.cases') is null
     or to_regclass('mizizi_private.case_receipt_links') is null
     or to_regclass('platform_private.jobs') is null
     or to_regclass('platform_private.command_receipts') is null
     or to_regclass('platform_private.outbox_events') is null
     or to_regclass('editorial.resources') is null
     or to_regprocedure('editorial.assert_resource_binding_integrity()') is null
     or to_regprocedure('mizizi_private.assert_executor_v1()') is null
  then
    raise exception 'MIZIZI case shared-jobs gateway substrate missing';
  end if;
  if (select count(*) from supabase_migrations.schema_migrations) <> 221
     or (select max(version) from supabase_migrations.schema_migrations) <> '20261010122222' then
    raise exception 'MIZIZI shared-jobs migration must follow accepted 221-version canonical substrate';
  end if;
  if to_regclass('mizizi_private.case_resource_bindings') is not null
     or to_regprocedure('mizizi_private.admit_case_research_job_v1(uuid,uuid,integer,text,text,text,text)') is not null
     or exists (select 1 from editorial.resource_kinds where kind='mizizi_case')
     or exists (select 1 from platform_private.command_types where command_type='mizizi.case_research_v1')
  then
    raise exception 'MIZIZI shared-jobs bridge already registered; stop before replay';
  end if;
end;
$prereq$;

insert into editorial.resource_kinds(kind,label,description,enabled)
values ('mizizi_case','MIZIZI internal case',
        'Private orchestration identity; not a public cultural entity or correction case.',false);

create table mizizi_private.case_resource_bindings (
  case_id uuid primary key,
  workspace_id uuid not null,
  resource_id uuid not null unique,
  resource_kind text not null default 'mizizi_case',
  bound_at timestamptz not null default clock_timestamp(),
  constraint wk_case_resource_binding_identity_check check (resource_id=case_id and resource_kind='mizizi_case'),
  constraint wk_case_resource_binding_case_fk foreign key(workspace_id,case_id)
    references mizizi_private.cases(workspace_id,id) on update restrict on delete restrict,
  constraint wk_case_resource_binding_resource_fk foreign key(resource_id,resource_kind)
    references editorial.resources(id,resource_kind) on update restrict on delete restrict
);
alter table mizizi_private.case_resource_bindings enable row level security;
alter table mizizi_private.case_resource_bindings force row level security;
revoke all on mizizi_private.case_resource_bindings from public,anon,authenticated,service_role,mizizi_executor;

-- Existing Resource engine insists on exactly one typed binding per Resource.
-- Preserve the installed implementation byte-for-byte except this one new kind.
do $extend_resource_binding$
declare
  old_definition text;
  new_definition text;
  anchor text := E'    else\n      raise exception\n        ''Unsupported resource kind: %'',';
  replacement text := E'    when ''mizizi_case'' then\n      select count(*) into binding_count\n      from mizizi_private.case_resource_bindings b\n      where b.resource_id = target_resource_id and b.case_id=target_resource_id;\n    else\n      raise exception\n        ''Unsupported resource kind: %'',';
begin
  select pg_get_functiondef('editorial.assert_resource_binding_integrity()'::regprocedure)
  into strict old_definition;
  if position('SECURITY DEFINER' in old_definition)=0
     or position('editorial.field_submissions' in old_definition)=0
     or position('SET search_path TO ''pg_catalog'', ''editorial'', ''audio''' in old_definition)=0
     or position('mizizi_private.case_resource_bindings' in old_definition)<>0
     or length(old_definition)-length(replace(old_definition,anchor,''))<>length(anchor)
  then
    raise exception 'Existing Resource binding enforcement has drifted; no blind replacement permitted';
  end if;
  new_definition := replace(old_definition,anchor,replacement);
  if new_definition = old_definition then
    raise exception 'MIZIZI resource kind insertion anchor missing';
  end if;
  execute new_definition;
end;
$extend_resource_binding$;

-- New internal Resource rows can only originate from the JIT executor gateway;
-- existing Resource kinds retain their existing identity and policies.
create function mizizi_private.guard_case_resource_identity_v1()
returns trigger language plpgsql set search_path to 'pg_catalog' as $guard$
begin
  if tg_op='DELETE' then
    if old.resource_kind='mizizi_case' then
      raise exception 'MIZIZI resource identity is immutable' using errcode='42501';
    end if;
    return old;
  end if;
  if tg_op='UPDATE' then
    if old.resource_kind='mizizi_case' or new.resource_kind='mizizi_case' then
      raise exception 'MIZIZI resource identity cannot be updated' using errcode='42501';
    end if;
    return new;
  end if;
  if new.resource_kind='mizizi_case' then
    if session_user <> 'mizizi_executor' then
      raise exception 'MIZIZI case resources require the approved executor session' using errcode='42501';
    end if;
    if new.visibility <> 'internal' or new.lifecycle_state <> 'active'
       or new.owner_id is not null or new.created_by is not null
       or new.current_working_version_id is not null
       or new.current_submitted_version_id is not null
       or new.current_approved_version_id is not null
       or new.current_published_version_id is not null then
      raise exception 'MIZIZI cases are internal non-editorial resources only' using errcode='23514';
    end if;
  end if;
  return new;
end;
$guard$;
revoke all on function mizizi_private.guard_case_resource_identity_v1() from public,anon,authenticated,service_role,mizizi_executor;
create trigger wk_mizizi_case_resource_identity_guard
before insert or update or delete on editorial.resources
for each row execute function mizizi_private.guard_case_resource_identity_v1();

create function mizizi_private.guard_case_resource_binding_immutable_v1()
returns trigger language plpgsql set search_path to 'pg_catalog' as $guard$
begin
  raise exception 'MIZIZI case Resource binding is immutable' using errcode='42501';
end;
$guard$;
revoke all on function mizizi_private.guard_case_resource_binding_immutable_v1() from public,anon,authenticated,service_role,mizizi_executor;
create trigger wk_mizizi_case_resource_bindings_immutable
before update or delete on mizizi_private.case_resource_bindings
for each row execute function mizizi_private.guard_case_resource_binding_immutable_v1();

-- The existing deferred editorial Resource identity check also runs when
-- the MIZIZI binding is created; no unbound private Resource can commit.
create constraint trigger wk_mizizi_case_resource_binding_integrity
after insert or update or delete on mizizi_private.case_resource_bindings
deferrable initially deferred for each row
execute function editorial.assert_resource_binding_integrity();

insert into platform_private.command_types (
  command_type,job_type,accepted_event_type,success_event_type,failure_event_type,retry_event_type,enabled
) values (
  'mizizi.case_research_v1','mizizi.case_research_v1',
  'mizizi.case_research_v1.accepted',
  'mizizi.case_research_v1.succeeded',
  'mizizi.case_research_v1.failed',
  'mizizi.case_research_v1.retry_scheduled',true
);

-- One research job per case/revision even if callers submit different idempotency keys.
create unique index wk_mizizi_case_research_stage_unique
on platform_private.jobs(resource_id,job_key)
where command_type='mizizi.case_research_v1';

-- A single JIT-only, atomic command admission. This is a queue submission,
-- NOT permission to mutate the Registry or an assertion that work succeeded.
create function mizizi_private.admit_case_research_job_v1(
  p_case_id uuid,
  p_workspace_id uuid,
  p_expected_revision integer,
  p_principal_key text,
  p_idempotency_key text,
  p_request_fingerprint text,
  p_reason text
)
returns table (
  case_id uuid,
  workspace_id uuid,
  resource_id uuid,
  case_revision integer,
  command_receipt_id uuid,
  job_id uuid,
  job_status text,
  outcome text
)
language plpgsql security definer set search_path to 'pg_catalog' as $admit$
declare
  v_case mizizi_private.cases%rowtype;
  v_workspace uuid;
  v_resource editorial.resources%rowtype;
  v_binding mizizi_private.case_resource_bindings%rowtype;
  v_request jsonb;
  v_fp text;
  v_receipt platform_private.command_receipts%rowtype;
  v_job platform_private.jobs%rowtype;
  v_link mizizi_private.case_receipt_links%rowtype;
  v_created boolean := false;
  v_reason text;
begin
  perform mizizi_private.assert_executor_v1();
  if session_user <> 'mizizi_executor' then
    raise exception 'Only approved MIZIZI JIT executor may admit research jobs' using errcode='42501';
  end if;
  v_reason := btrim(p_reason);
  if p_case_id is null or p_workspace_id is null
     or p_expected_revision is null or p_expected_revision < 1
     or p_principal_key is distinct from 'system:mizizi'
     or p_idempotency_key is null
     or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
     or p_request_fingerprint is null
     or p_request_fingerprint !~ '^[0-9a-f]{64}$'
     or p_reason is null or char_length(v_reason) < 8
     or octet_length(v_reason) > 2000
  then
    raise exception 'Invalid MIZIZI shared research command' using errcode='22023';
  end if;
  v_fp := encode(extensions.digest(convert_to(
    p_case_id::text || E'\n' || p_workspace_id::text || E'\n' ||
    p_expected_revision::text || E'\nread_only_research\n' || v_reason,
    'UTF8'), 'sha256'),'hex');
  if p_request_fingerprint <> v_fp then
    raise exception 'MIZIZI research command fingerprint mismatch' using errcode='23514';
  end if;
  select w.id into strict v_workspace from mizizi_private.workspaces w
  where w.id=p_workspace_id and w.workspace_key='wakilisha-internal'
    and w.workspace_kind='internal' and w.status='active';
  select c.* into strict v_case from mizizi_private.cases c
  where c.id=p_case_id and c.workspace_id=v_workspace for update;
  if v_case.revision <> p_expected_revision
     or v_case.case_state not in ('open','in_progress') or v_case.current_stage <> 'research'
  then
    raise exception 'MIZIZI case revision or stage not eligible for research' using errcode='55000';
  end if;
  -- Make the exact case ID an actual typed editorial Resource, not a cast.
  insert into editorial.resources(id,resource_kind,visibility,lifecycle_state)
  values (v_case.id,'mizizi_case','internal','active')
  on conflict (id) do nothing;
  select res.* into strict v_resource from editorial.resources res
  where res.id=v_case.id for update;
  if v_resource.resource_kind <> 'mizizi_case'
     or v_resource.visibility <> 'internal'
     or v_resource.lifecycle_state <> 'active' then
    raise exception 'MIZIZI case Resource ID collided with another authority' using errcode='23514';
  end if;
  insert into mizizi_private.case_resource_bindings(case_id,workspace_id,resource_id)
  values(v_case.id,v_workspace,v_case.id) on conflict (case_id) do nothing;
  select b.* into strict v_binding from mizizi_private.case_resource_bindings b
  where b.case_id=v_case.id for update;
  if v_binding.workspace_id <> v_workspace or v_binding.resource_id <> v_case.id
     or v_binding.resource_kind <> 'mizizi_case' then
    raise exception 'MIZIZI case Resource binding drift' using errcode='23514';
  end if;

  v_request := jsonb_build_object(
    'case_id',v_case.id,'workspace_id',v_workspace,
    'expected_case_revision',p_expected_revision,
    'operation','read_only_research','reason',v_reason);
  insert into platform_private.command_receipts(
    command_type,resource_id,principal_key,actor_user_id,idempotency_key,
    request_fingerprint,request_payload
  ) values (
    'mizizi.case_research_v1',v_case.id,p_principal_key,null,p_idempotency_key,
    v_fp,v_request
  ) on conflict (principal_key,command_type,idempotency_key) do nothing
  returning * into v_receipt;
  if v_receipt.id is null then
    select cr.* into strict v_receipt from platform_private.command_receipts cr
    where cr.principal_key=p_principal_key and cr.command_type='mizizi.case_research_v1'
      and cr.idempotency_key=p_idempotency_key for update;
    if v_receipt.resource_id <> v_case.id
       or v_receipt.request_fingerprint <> v_fp
       or v_receipt.request_payload <> v_request then
      raise exception 'MIZIZI job idempotency key was reused for a different command' using errcode='23505';
    end if;
  else
    v_created := true;
  end if;

  insert into platform_private.jobs (
    command_receipt_id,resource_id,command_type,job_key,job_type,
    status,input_payload
  ) values (
    v_receipt.id,v_case.id,'mizizi.case_research_v1',
    'research:' || p_expected_revision::text,'mizizi.case_research_v1',
    'queued',v_request
  ) on conflict (command_receipt_id,job_key) do nothing returning * into v_job;
  if v_job.id is null then
    select j.* into strict v_job from platform_private.jobs j
    where j.command_receipt_id=v_receipt.id
      and j.job_key='research:' || p_expected_revision::text for update;
    if v_job.resource_id <> v_case.id
       or v_job.command_type <> 'mizizi.case_research_v1'
       or v_job.job_type <> 'mizizi.case_research_v1'
       or v_job.input_payload <> v_request then
      raise exception 'MIZIZI job replay disagrees with immutable command' using errcode='23514';
    end if;
  end if;
  if v_job.status not in ('queued','retry_wait','running','succeeded') then
    raise exception 'MIZIZI job is terminal and requires a separate reviewed retry' using errcode='55000';
  end if;
  -- Reuse DB02's immutable, existence-checked typed authority links, rather
  -- than inventing a parallel receipt table or copying private payloads.
  insert into mizizi_private.case_receipt_links (
    workspace_id,case_id,relation_type,authority_schema,authority_object_type,
    authority_id,authority_fingerprint,linked_by_actor_key,link_reason
  ) values (
    v_workspace,v_case.id,'command_receipt','platform_private','command_receipts',
    v_receipt.id,v_fp,'system:mizizi',
    'MIZIZI read-only research stage accepted by the shared platform jobs ledger.'
  ) on conflict (case_id,relation_type,authority_schema,authority_object_type,authority_id)
    do nothing;
  select l.* into strict v_link from mizizi_private.case_receipt_links l
  where l.case_id=v_case.id and l.relation_type='command_receipt'
    and l.authority_schema='platform_private'
    and l.authority_object_type='command_receipts'
    and l.authority_id=v_receipt.id;
  if v_link.workspace_id <> v_workspace or v_link.authority_fingerprint <> v_fp
     or v_link.linked_by_actor_key <> 'system:mizizi' then
    raise exception 'MIZIZI command receipt link identity/fingerprint drift' using errcode='23514';
  end if;
  insert into platform_private.outbox_events (
    event_key,command_receipt_id,job_id,command_type,aggregate_id,event_type,payload
  ) values (
    'command:' || v_receipt.id::text || ':accepted',v_receipt.id,v_job.id,
    'mizizi.case_research_v1',v_case.id,'mizizi.case_research_v1.accepted',
    jsonb_build_object('case_id',v_case.id,'workspace_id',v_workspace,
      'case_revision',v_case.revision,'job_id',v_job.id,
      'command_receipt_id',v_receipt.id)
  ) on conflict (event_key) do nothing;

  return query select v_case.id,v_workspace,v_case.id,v_case.revision,
    v_receipt.id,v_job.id,v_job.status,
    case when v_created then 'created'::text else 'replayed'::text end;
end;
$admit$;

revoke all on function mizizi_private.admit_case_research_job_v1(uuid,uuid,integer,text,text,text,text)
from public,anon,authenticated,service_role;
grant execute on function mizizi_private.admit_case_research_job_v1(uuid,uuid,integer,text,text,text,text)
to mizizi_executor;

commit;
