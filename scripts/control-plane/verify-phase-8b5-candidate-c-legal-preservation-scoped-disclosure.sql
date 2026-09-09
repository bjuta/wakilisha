-- Permanent rollback-only verifier for Phase 8B.5 Candidate C.
-- Proves separate Legal Request Case authority, exact preservation scope,
-- deliberate evidence inspection, scoped disclosure approval, durable generation,
-- immutable generated identity, controlled release, and zero durable fixture residue.

begin;
set constraints all deferred;

-- ---------------------------------------------------------------------------
-- Structural authority.
-- ---------------------------------------------------------------------------

do $structural$
declare
  v_count bigint;
  v_definition text;
begin
  select count(*) into v_count from supabase_migrations.schema_migrations;
  if v_count<>112 or (select max(version) from supabase_migrations.schema_migrations)<>'20260909080000' then
    raise exception 'PHASE_8B5_C_FAIL: expected 112 migrations at Candidate C head 20260909080000';
  end if;

  if not exists(
    select 1 from supabase_migrations.schema_migrations
    where version='20260909080000'
      and name='phase_8b5_candidate_c_legal_preservation_scoped_disclosure'
  ) then
    raise exception 'PHASE_8B5_C_FAIL: canonical Candidate C migration history is missing';
  end if;

  select count(*) into v_count
  from information_schema.tables
  where table_schema='messaging'
    and table_name in (
      'legal_request_cases','legal_preservation_scopes','legal_preserved_objects',
      'legal_disclosure_packages','legal_disclosure_objects','legal_disclosure_approvals','legal_case_events'
    );
  if v_count<>7 then
    raise exception 'PHASE_8B5_C_FAIL: expected exactly seven Candidate C Legal tables, got %',v_count;
  end if;

  select count(*) into v_count
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='messaging'
    and c.relname in (
      'legal_request_cases','legal_preservation_scopes','legal_preserved_objects',
      'legal_disclosure_packages','legal_disclosure_objects','legal_disclosure_approvals','legal_case_events'
    ) and c.relrowsecurity;
  if v_count<>7 then
    raise exception 'PHASE_8B5_C_FAIL: Candidate C RLS coverage is incomplete';
  end if;

  if exists(
    select 1 from information_schema.role_table_grants
    where table_schema='messaging'
      and table_name like 'legal_%'
      and grantee in ('anon','authenticated','service_role')
  ) then
    raise exception 'PHASE_8B5_C_FAIL: runtime roles have direct Candidate C table grants';
  end if;

  with expected(command_type) as (
    values
      ('messages.legal.case.open'),('messages.legal.review.start'),('messages.legal.scope.update'),
      ('messages.legal.preservation.materialize'),('messages.legal.preservation.release'),
      ('messages.legal.classification.update'),('messages.legal.evidence.inspect'),
      ('messages.legal.disclosure.prepare'),('messages.legal.disclosure.approval.update'),
      ('messages.legal.disclosure.generate'),('messages.legal.disclosure.release'),
      ('messages.legal.disclosure.void'),('messages.legal.case.close')
  )
  select count(*) into v_count
  from expected e join platform_private.command_types c using(command_type)
  where c.enabled;
  if v_count<>13 then
    raise exception 'PHASE_8B5_C_FAIL: thirteen Candidate C command contracts are not enabled';
  end if;

  if (
    select count(*) from public.capability_definitions
    where domain='messages'
      and capability_key in (
        'view_messages_legal_cases','inspect_messages_legal_evidence',
        'manage_messages_legal_cases','approve_messages_legal_disclosure'
      )
  )<>4 then
    raise exception 'PHASE_8B5_C_FAIL: Candidate C narrow capability family is incomplete';
  end if;

  if (
    select count(*) from public.role_capabilities
    where role_key='super_admin'
      and capability_key in (
        'view_messages_legal_cases','inspect_messages_legal_evidence',
        'manage_messages_legal_cases','approve_messages_legal_disclosure'
      )
  )<>4 then
    raise exception 'PHASE_8B5_C_FAIL: Super Admin Candidate C capability assignment is incomplete';
  end if;

  if not exists(select 1 from media.asset_purposes where asset_purpose='legal_disclosure' and enabled) then
    raise exception 'PHASE_8B5_C_FAIL: restricted Legal disclosure Media purpose is missing';
  end if;

  if to_regprocedure('public.list_messages_legal_cases_v1(text,integer)') is null
     or to_regprocedure('public.get_messages_legal_case_v1(uuid)') is null
     or to_regprocedure('public.open_messages_legal_request_case_v1(text,text,text,text,timestamptz,text,text,uuid,text,uuid)') is null
     or to_regprocedure('public.start_messages_legal_review_v1(uuid,bigint,uuid,text,text,uuid)') is null
     or to_regprocedure('public.update_messages_legal_scope_v1(uuid,text,uuid,text,uuid,uuid,timestamptz,timestamptz,uuid,uuid,text,bigint,text,text,uuid)') is null
     or to_regprocedure('public.materialize_messages_legal_preservation_v1(uuid,uuid,bigint,text,text,uuid)') is null
     or to_regprocedure('public.release_messages_legal_preservation_v1(uuid,uuid,bigint,text,text,uuid)') is null
     or to_regprocedure('public.classify_messages_legal_object_v1(uuid,uuid,bigint,text,text,text,uuid)') is null
     or to_regprocedure('public.inspect_message_legal_evidence_v1(uuid,uuid,text,text,uuid)') is null
     or to_regprocedure('public.prepare_messages_legal_disclosure_v1(uuid,text,text,text[],uuid[],text,uuid)') is null
     or to_regprocedure('public.update_messages_legal_disclosure_approval_v1(uuid,text,uuid,bigint,text,text,text,uuid)') is null
     or to_regprocedure('public.submit_messages_legal_disclosure_generation_v1(uuid,bigint,text,uuid)') is null
     or to_regprocedure('public.get_messages_legal_disclosure_package_v1(uuid)') is null
     or to_regprocedure('public.release_messages_legal_disclosure_v1(uuid,bigint,text,text,uuid)') is null
     or to_regprocedure('public.void_messages_legal_disclosure_v1(uuid,bigint,text,text,uuid)') is null
     or to_regprocedure('public.close_messages_legal_request_case_v1(uuid,bigint,text,text,uuid)') is null then
    raise exception 'PHASE_8B5_C_FAIL: Candidate C browser/admin RPC family is incomplete';
  end if;

  if to_regprocedure('public.claim_messages_legal_disclosure_jobs_v1(text,integer,integer)') is null
     or to_regprocedure('public.renew_messages_legal_disclosure_lease_v1(uuid,text,integer)') is null
     or to_regprocedure('public.get_messages_legal_disclosure_plan_v1(uuid,text)') is null
     or to_regprocedure('public.get_messages_legal_disclosure_source_v1(uuid,text,uuid)') is null
     or to_regprocedure('public.complete_messages_legal_disclosure_job_v1(uuid,text,jsonb)') is null
     or to_regprocedure('public.fail_messages_legal_disclosure_job_v1(uuid,text,text,boolean,integer)') is null
     or to_regprocedure('public.recover_expired_messages_legal_disclosure_jobs_v1(integer,integer)') is null then
    raise exception 'PHASE_8B5_C_FAIL: Candidate C worker RPC family is incomplete';
  end if;

  if has_function_privilege('anon','public.list_messages_legal_cases_v1(text,integer)'::regprocedure,'EXECUTE')
     or not has_function_privilege('authenticated','public.list_messages_legal_cases_v1(text,integer)'::regprocedure,'EXECUTE')
     or has_function_privilege('service_role','public.list_messages_legal_cases_v1(text,integer)'::regprocedure,'EXECUTE')
     or has_function_privilege('authenticated','public.claim_messages_legal_disclosure_jobs_v1(text,integer,integer)'::regprocedure,'EXECUTE')
     or not has_function_privilege('service_role','public.claim_messages_legal_disclosure_jobs_v1(text,integer,integer)'::regprocedure,'EXECUTE') then
    raise exception 'PHASE_8B5_C_FAIL: Candidate C RPC grants are broader or narrower than designed';
  end if;

  if not exists(
    select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='messaging' and c.relname='legal_case_events' and t.tgname='legal_case_events_immutable' and not t.tgisinternal
  ) then
    raise exception 'PHASE_8B5_C_FAIL: append-only Legal case event guard is missing';
  end if;

  if not exists(
    select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='messaging' and c.relname='legal_disclosure_packages' and t.tgname='legal_disclosure_packages_generated_guard' and not t.tgisinternal
  ) or not exists(
    select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='messaging' and c.relname='legal_disclosure_objects' and t.tgname='legal_disclosure_objects_mutation_guard' and not t.tgisinternal
  ) then
    raise exception 'PHASE_8B5_C_FAIL: generated Legal package/object immutability guards are missing';
  end if;

  v_definition:=pg_get_functiondef('public.prepare_messages_legal_disclosure_v1(uuid,text,text,text[],uuid[],text,uuid)'::regprocedure);
  if position('unnest(p_preserved_object_ids)' in v_definition)=0
     or position('legal_request_case_id=p_case_id' in v_definition)=0
     or position('unclassified' in v_definition)=0
     or position('excluded' in v_definition)=0 then
    raise exception 'PHASE_8B5_C_FAIL: disclosure preparation is not exact-case/exact-object scoped';
  end if;

  v_definition:=pg_get_functiondef('public.materialize_messages_legal_preservation_v1(uuid,uuid,bigint,text,text,uuid)'::regprocedure);
  if position('m.conversation_id=v_scope.conversation_id' in v_definition)=0
     or position('m.accepted_at>=v_scope.accepted_from' in v_definition)=0
     or position('m.accepted_at<v_scope.accepted_until' in v_definition)=0
     or position('message_resource_references' in v_definition)>0 then
    raise exception 'PHASE_8B5_C_FAIL: Conversation-window materialization can widen beyond exact Message/time scope';
  end if;

  v_definition:=pg_get_functiondef('public.get_messages_legal_disclosure_source_v1(uuid,text,uuid)'::regprocedure);
  if position('resource_references' in v_definition)=0
     or position('[]'::text in v_definition)=0 then
    raise exception 'PHASE_8B5_C_FAIL: Message disclosure representation does not explicitly refuse implicit Resource expansion';
  end if;

  v_definition:=pg_get_functiondef('public.submit_messages_legal_disclosure_generation_v1(uuid,bigint,text,uuid)'::regprocedure);
  if position('Active exact-fingerprint package approval is required' in v_definition)=0
     or position('Every elevated-review Legal object requires exact-fingerprint elevated approval' in v_definition)=0
     or position('platform_private.jobs' in v_definition)=0 then
    raise exception 'PHASE_8B5_C_FAIL: generation approval/job boundary is incomplete';
  end if;
end
$structural$;

-- ---------------------------------------------------------------------------
-- Controlled rollback-only behavior fixture.
-- ---------------------------------------------------------------------------

create temporary table phase8b5_c_fixture(k text primary key,id uuid not null) on commit drop;
create temporary table phase8b5_c_state(
  case_id uuid,
  case_revision bigint,
  scope_one_id uuid,
  scope_two_id uuid,
  object_one_id uuid,
  object_two_id uuid,
  object_one_revision bigint,
  object_two_revision bigint,
  package_id uuid,
  package_revision bigint,
  fingerprint text,
  job_id uuid,
  plan jsonb,
  source_one text,
  source_two text,
  manifest_text text,
  manifest_sha text
) on commit drop;

insert into phase8b5_c_fixture values
  ('super_admin',gen_random_uuid()),
  ('ordinary_admin',gen_random_uuid()),
  ('sender',gen_random_uuid()),
  ('recipient',gen_random_uuid()),
  ('conversation',gen_random_uuid()),
  ('message_one',gen_random_uuid()),
  ('message_two',gen_random_uuid());
insert into phase8b5_c_state default values;

insert into auth.users(
  id,aud,role,email,raw_app_meta_data,raw_user_meta_data,
  created_at,updated_at,is_sso_user,is_anonymous
)
select
  id,'authenticated','authenticated',
  'phase8b5-c-'||k||'-'||left(id::text,8)||'@example.invalid',
  jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
  jsonb_build_object('name','Phase 8B5 C '||k),
  now(),now(),false,false
from phase8b5_c_fixture
where k in ('super_admin','ordinary_admin','sender','recipient');

set constraints all immediate;
set constraints all deferred;

create temporary table phase8b5_c_people as
select f.k,f.id user_id,l.person_resource_id
from phase8b5_c_fixture f
join editorial.person_identity_links l on l.user_id=f.id and l.link_state='active'
where f.k in ('super_admin','ordinary_admin','sender','recipient');

if false then null; end if;

insert into public.user_role_assignments(user_id,role_key,status,assigned_by,assigned_at,notes,created_at,updated_at)
select user_id,'super_admin','active',null::uuid,now(),'Candidate C rollback verifier',now(),now()
from phase8b5_c_people where k='super_admin'
union all
select user_id,'administrator','active',null::uuid,now(),'Candidate C rollback verifier',now(),now()
from phase8b5_c_people where k='ordinary_admin'
union all
select user_id,'author','active',null::uuid,now(),'Candidate C rollback verifier',now(),now()
from phase8b5_c_people where k in ('sender','recipient');

insert into messaging.conversations(id,security_classification,status,created_at,last_activity_at,correlation_id)
select id,'standard','active',now(),now(),gen_random_uuid()
from phase8b5_c_fixture where k='conversation';

insert into messaging.conversation_participants(
  conversation_id,actor_kind,person_resource_id,user_id,membership_status,mailbox_folder,first_contact_state
)
select (select id from phase8b5_c_fixture where k='conversation'),'human',person_resource_id,user_id,'active','inbox','accepted'
from phase8b5_c_people where k in ('sender','recipient');

update messaging.conversations c
set created_by_participant_id=p.id
from messaging.conversation_participants p,phase8b5_c_people u
where c.id=(select id from phase8b5_c_fixture where k='conversation')
  and p.conversation_id=c.id and p.user_id=u.user_id and u.k='sender';

insert into messaging.messages(id,conversation_id,sender_participant_id,message_kind,body,accepted_at,client_created_at,correlation_id)
select (select id from phase8b5_c_fixture where k='message_one'),
       (select id from phase8b5_c_fixture where k='conversation'),p.id,'text',
       'Candidate C exact Message one',now()-interval '2 minutes',now()-interval '2 minutes',gen_random_uuid()
from messaging.conversation_participants p,phase8b5_c_people u
where p.conversation_id=(select id from phase8b5_c_fixture where k='conversation') and p.user_id=u.user_id and u.k='sender';

insert into messaging.messages(id,conversation_id,sender_participant_id,message_kind,body,accepted_at,client_created_at,correlation_id)
select (select id from phase8b5_c_fixture where k='message_two'),
       (select id from phase8b5_c_fixture where k='conversation'),p.id,'text',
       'Candidate C adjacent Message two',now()-interval '1 minute',now()-interval '1 minute',gen_random_uuid()
from messaging.conversation_participants p,phase8b5_c_people u
where p.conversation_id=(select id from phase8b5_c_fixture where k='conversation') and p.user_id=u.user_id and u.k='sender';

grant select on phase8b5_c_fixture,phase8b5_c_people to authenticated,service_role;
grant select,update on phase8b5_c_state to authenticated,service_role;

-- Ordinary Administrator has no Legal capability.
select set_config(
  'request.jwt.claims',
  (select jsonb_build_object('sub',user_id::text,'role','authenticated')::text from phase8b5_c_people where k='ordinary_admin'),
  true
);
set local role authenticated;
do $ordinary_admin_denial$
begin
  begin
    perform public.list_messages_legal_cases_v1(null,50);
    raise exception 'PHASE_8B5_C_FAIL: ordinary Administrator read Legal cases';
  exception when sqlstate '42501' then null; end;
  begin
    perform public.open_messages_legal_request_case_v1(
      'WK-C-DENIED','disclosure','Denied authority','Candidate C verifier',now(),
      'Denied scope','none',null,'phase8b5-c-denied-open-0001',null
    );
    raise exception 'PHASE_8B5_C_FAIL: ordinary Administrator opened a Legal case';
  exception when sqlstate '42501' then null; end;
end
$ordinary_admin_denial$;
reset role;

-- Super Admin opens and reviews one exact Legal Request Case.
select set_config(
  'request.jwt.claims',
  (select jsonb_build_object('sub',user_id::text,'role','authenticated')::text from phase8b5_c_people where k='super_admin'),
  true
);
set local role authenticated;

with x as (
  select public.open_messages_legal_request_case_v1(
    'WK-C-VERIFY-0001','disclosure','Controlled verifier authority','Candidate C verifier',
    timestamp with time zone '2026-09-09 00:00:00+00','Two exact Messages only','none',
    (select user_id from phase8b5_c_people where k='super_admin'),
    'phase8b5-c-open-0001',null
  ) p
)
update phase8b5_c_state
set case_id=(x.p->>'legal_request_case_id')::uuid,
    case_revision=(x.p->>'revision')::bigint
from x;

with x as (
  select public.start_messages_legal_review_v1(
    (select case_id from phase8b5_c_state),(select case_revision from phase8b5_c_state),
    (select user_id from phase8b5_c_people where k='super_admin'),
    'Begin controlled Legal review','phase8b5-c-review-0001',null
  ) p
)
update phase8b5_c_state set case_revision=(x.p->>'revision')::bigint from x;

-- Exact scope one.
with x as (
  select public.update_messages_legal_scope_v1(
    (select case_id from phase8b5_c_state),'add',null,'exact_message',
    (select id from phase8b5_c_fixture where k='message_one'),null,null,null,null,null,
    'Exact Message one',(select case_revision from phase8b5_c_state),
    'Add exact Message one','phase8b5-c-scope-one-0001',null
  ) p
)
update phase8b5_c_state
set scope_one_id=(x.p->>'scope_id')::uuid,
    case_revision=(x.p->>'case_revision')::bigint
from x;

with x as (
  select public.materialize_messages_legal_preservation_v1(
    (select case_id from phase8b5_c_state),(select scope_one_id from phase8b5_c_state),
    (select case_revision from phase8b5_c_state),'Apply exact preservation one',
    'phase8b5-c-materialize-one-0001',null
  ) p
)
update phase8b5_c_state set case_revision=(x.p->>'case_revision')::bigint from x;

-- Exact scope two. This adjacent Message is included only because it receives its own scope.
with x as (
  select public.update_messages_legal_scope_v1(
    (select case_id from phase8b5_c_state),'add',null,'exact_message',
    (select id from phase8b5_c_fixture where k='message_two'),null,null,null,null,null,
    'Exact Message two',(select case_revision from phase8b5_c_state),
    'Add exact Message two','phase8b5-c-scope-two-0001',null
  ) p
)
update phase8b5_c_state
set scope_two_id=(x.p->>'scope_id')::uuid,
    case_revision=(x.p->>'case_revision')::bigint
from x;

with x as (
  select public.materialize_messages_legal_preservation_v1(
    (select case_id from phase8b5_c_state),(select scope_two_id from phase8b5_c_state),
    (select case_revision from phase8b5_c_state),'Apply exact preservation two',
    'phase8b5-c-materialize-two-0001',null
  ) p
)
update phase8b5_c_state set case_revision=(x.p->>'case_revision')::bigint from x;
reset role;

-- Root verifier inspection may read canonical rows; browser roles may not.
update phase8b5_c_state s
set object_one_id=o.id,object_one_revision=o.revision
from messaging.legal_preserved_objects o
where o.legal_request_case_id=s.case_id
  and o.message_id=(select id from phase8b5_c_fixture where k='message_one');
update phase8b5_c_state s
set object_two_id=o.id,object_two_revision=o.revision
from messaging.legal_preserved_objects o
where o.legal_request_case_id=s.case_id
  and o.message_id=(select id from phase8b5_c_fixture where k='message_two');

do $exact_materialization$
begin
  if (select count(*) from messaging.legal_preserved_objects where legal_request_case_id=(select case_id from phase8b5_c_state))<>2 then
    raise exception 'PHASE_8B5_C_FAIL: exact preservation materialization widened or lost scope';
  end if;
  if exists(
    select 1 from messaging.legal_preserved_objects
    where legal_request_case_id=(select case_id from phase8b5_c_state)
      and message_id not in (
        (select id from phase8b5_c_fixture where k='message_one'),
        (select id from phase8b5_c_fixture where k='message_two')
      )
  ) then
    raise exception 'PHASE_8B5_C_FAIL: unrelated Message entered exact Legal preservation';
  end if;
end
$exact_materialization$;

set local role authenticated;
with x as (
  select public.classify_messages_legal_object_v1(
    (select case_id from phase8b5_c_state),(select object_one_id from phase8b5_c_state),
    (select object_one_revision from phase8b5_c_state),'responsive','Exact Message one is responsive',
    'phase8b5-c-classify-one-0001',null
  ) p
)
update phase8b5_c_state set object_one_revision=(x.p->>'revision')::bigint from x;

with x as (
  select public.classify_messages_legal_object_v1(
    (select case_id from phase8b5_c_state),(select object_two_id from phase8b5_c_state),
    (select object_two_revision from phase8b5_c_state),'elevated_review','Exact Message two requires elevated review',
    'phase8b5-c-classify-two-0001',null
  ) p
)
update phase8b5_c_state set object_two_revision=(x.p->>'revision')::bigint from x;

-- Deliberate evidence inspection returns only the exact held Message.
with x as (
  select public.inspect_message_legal_evidence_v1(
    (select case_id from phase8b5_c_state),(select object_one_id from phase8b5_c_state),
    'Verify exact Message evidence','phase8b5-c-inspect-one-0001',null
  ) p
)
update phase8b5_c_state set source_one=x.p#>>'{evidence,body}' from x;

-- Idempotent replay must not duplicate evidence history.
perform public.inspect_message_legal_evidence_v1(
  (select case_id from phase8b5_c_state),(select object_one_id from phase8b5_c_state),
  'Verify exact Message evidence','phase8b5-c-inspect-one-0001',null
);
reset role;

do $evidence_assert$
begin
  if (select source_one from phase8b5_c_state)<>'Candidate C exact Message one' then
    raise exception 'PHASE_8B5_C_FAIL: exact evidence inspection returned wrong Message body';
  end if;
  if (
    select count(*) from messaging.legal_case_events
    where legal_request_case_id=(select case_id from phase8b5_c_state)
      and event_kind='evidence_viewed'
      and legal_preserved_object_id=(select object_one_id from phase8b5_c_state)
  )<>1 then
    raise exception 'PHASE_8B5_C_FAIL: idempotent evidence replay duplicated Legal audit history';
  end if;
end
$evidence_assert$;

set local role authenticated;
with x as (
  select public.prepare_messages_legal_disclosure_v1(
    (select case_id from phase8b5_c_state),'WK-C-PROD-0001','Two exact Messages only',
    array['No adjacent Conversation or reachable Resource content'],
    array[(select object_one_id from phase8b5_c_state),(select object_two_id from phase8b5_c_state)],
    'phase8b5-c-prepare-0001',null
  ) p
)
update phase8b5_c_state
set package_id=(x.p->>'legal_disclosure_package_id')::uuid,
    package_revision=1,
    fingerprint=x.p->>'selection_fingerprint'
from x;

with x as (
  select public.update_messages_legal_disclosure_approval_v1(
    (select package_id from phase8b5_c_state),'record_package',null,
    (select package_revision from phase8b5_c_state),(select fingerprint from phase8b5_c_state),
    'Human approval for exact scoped package','phase8b5-c-approve-package-0001',null
  ) p
)
update phase8b5_c_state set package_revision=(x.p->>'package_revision')::bigint from x;

-- Generation must fail closed until the selected elevated object has exact-fingerprint approval.
do $elevated_required$
begin
  begin
    perform public.submit_messages_legal_disclosure_generation_v1(
      (select package_id from phase8b5_c_state),(select package_revision from phase8b5_c_state),
      'phase8b5-c-generate-denied-0001',null
    );
    raise exception 'PHASE_8B5_C_FAIL: package queued without elevated-object approval';
  exception when sqlstate '55000' then null; end;
end
$elevated_required$;

-- Release is a separate operation and cannot happen before generation.
do $release_before_generation$
begin
  begin
    perform public.release_messages_legal_disclosure_v1(
      (select package_id from phase8b5_c_state),(select package_revision from phase8b5_c_state),
      'Premature release must fail','phase8b5-c-release-denied-0001',null
    );
    raise exception 'PHASE_8B5_C_FAIL: ungenerated package was released';
  exception when sqlstate '55000' then null; end;
end
$release_before_generation$;

with x as (
  select public.update_messages_legal_disclosure_approval_v1(
    (select package_id from phase8b5_c_state),'record_elevated',(select object_two_id from phase8b5_c_state),
    (select package_revision from phase8b5_c_state),(select fingerprint from phase8b5_c_state),
    'Human elevated review approval','phase8b5-c-approve-elevated-0001',null
  ) p
)
update phase8b5_c_state set package_revision=(x.p->>'package_revision')::bigint from x;

with x as (
  select public.submit_messages_legal_disclosure_generation_v1(
    (select package_id from phase8b5_c_state),(select package_revision from phase8b5_c_state),
    'phase8b5-c-generate-0001',null
  ) p
)
update phase8b5_c_state
set job_id=(x.p->>'job_id')::uuid,
    package_revision=(x.p->>'package_revision')::bigint
from x;
reset role;

update phase8b5_c_state
set manifest_text='{"archive_version":"wk-legal-disclosure-zip-v1","manifest_version":"wk-legal-disclosure-manifest-v1","test":"candidate-c-verifier"}',
    manifest_sha=encode(extensions.digest(convert_to('{"archive_version":"wk-legal-disclosure-zip-v1","manifest_version":"wk-legal-disclosure-manifest-v1","test":"candidate-c-verifier"}','UTF8'),'sha256'),'hex');

-- ---------------------------------------------------------------------------
-- Filtered service-role worker boundary.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',jsonb_build_object('role','service_role')::text,true);
set local role service_role;

with claimed as (
  select * from public.claim_messages_legal_disclosure_jobs_v1('candidate-c-verifier',1,900)
)
update phase8b5_c_state s set job_id=claimed.job_id
from claimed where claimed.legal_disclosure_package_id=s.package_id;

do $lease_scope$
begin
  begin
    perform public.get_messages_legal_disclosure_plan_v1((select job_id from phase8b5_c_state),'wrong-worker');
    raise exception 'PHASE_8B5_C_FAIL: wrong worker read leased Legal disclosure plan';
  exception when sqlstate '55000' then null; end;
end
$lease_scope$;

with x as (
  select public.get_messages_legal_disclosure_plan_v1((select job_id from phase8b5_c_state),'candidate-c-verifier') p
)
update phase8b5_c_state set plan=x.p from x;

with x as (
  select public.get_messages_legal_disclosure_source_v1(
    (select job_id from phase8b5_c_state),'candidate-c-verifier',
    ((select plan from phase8b5_c_state)#>>'{objects,0,legal_disclosure_object_id}')::uuid
  ) p
)
update phase8b5_c_state set source_one=x.p#>>'{representation,body}' from x;

with x as (
  select public.get_messages_legal_disclosure_source_v1(
    (select job_id from phase8b5_c_state),'candidate-c-verifier',
    ((select plan from phase8b5_c_state)#>>'{objects,1,legal_disclosure_object_id}')::uuid
  ) p
)
update phase8b5_c_state set source_two=x.p#>>'{representation,body}' from x;

-- Database completion authority receives the deterministic worker result.
with result as (
  select jsonb_build_object(
    'manifest_text',(select manifest_text from phase8b5_c_state),
    'manifest_sha256',(select manifest_sha from phase8b5_c_state),
    'package_sha256',repeat('a',64),
    'package_byte_size',1234,
    'storage_path',(select plan->>'storage_path' from phase8b5_c_state),
    'objects',jsonb_build_array(
      jsonb_build_object(
        'legal_disclosure_object_id',((select plan from phase8b5_c_state)#>>'{objects,0,legal_disclosure_object_id}')::uuid,
        'output_path',(select plan#>>'{objects,0,output_path}' from phase8b5_c_state),
        'output_mime_type','application/json','object_sha256',repeat('b',64),'object_byte_size',42
      ),
      jsonb_build_object(
        'legal_disclosure_object_id',((select plan from phase8b5_c_state)#>>'{objects,1,legal_disclosure_object_id}')::uuid,
        'output_path',(select plan#>>'{objects,1,output_path}' from phase8b5_c_state),
        'output_mime_type','application/json','object_sha256',repeat('c',64),'object_byte_size',43
      )
    )
  ) payload
)
select public.complete_messages_legal_disclosure_job_v1(
  (select job_id from phase8b5_c_state),'candidate-c-verifier',result.payload
)
from result;
reset role;

-- Generated package identity and exact Media artifact are now frozen.
update phase8b5_c_state s
set package_revision=p.revision
from messaging.legal_disclosure_packages p where p.id=s.package_id;

do $generated_assert$
begin
  if (select source_one from phase8b5_c_state)<>'Candidate C exact Message one'
     or (select source_two from phase8b5_c_state)<>'Candidate C adjacent Message two' then
    raise exception 'PHASE_8B5_C_FAIL: worker source descriptors returned wrong Message content';
  end if;
  if jsonb_array_length((select plan->'objects' from phase8b5_c_state))<>2 then
    raise exception 'PHASE_8B5_C_FAIL: disclosure plan widened or lost selected objects';
  end if;
  if exists(
    select 1 from messaging.legal_disclosure_packages p
    join media.assets a on a.id=p.package_asset_id
    join media.file_objects f on f.id=p.package_file_object_id
    where p.id=(select package_id from phase8b5_c_state)
      and (p.status<>'generated' or a.asset_purpose<>'legal_disclosure' or f.verification_state<>'verified' or f.storage_provider<>'lightsail_media')
  ) or not exists(
    select 1 from messaging.legal_disclosure_packages p
    join media.assets a on a.id=p.package_asset_id
    join media.file_objects f on f.id=p.package_file_object_id
    where p.id=(select package_id from phase8b5_c_state)
  ) then
    raise exception 'PHASE_8B5_C_FAIL: generated package is not a verified restricted canonical Media artifact';
  end if;

  begin
    update messaging.legal_disclosure_packages
    set manifest_text=manifest_text||'x'
    where id=(select package_id from phase8b5_c_state);
    raise exception 'PHASE_8B5_C_FAIL: generated package bytes were mutable';
  exception when raise_exception then
    if sqlerrm='PHASE_8B5_C_FAIL: generated package bytes were mutable' then raise; end if;
  end;
end
$generated_assert$;

-- ---------------------------------------------------------------------------
-- Human release, hold release, and closure remain separate decisions.
-- ---------------------------------------------------------------------------
select set_config(
  'request.jwt.claims',
  (select jsonb_build_object('sub',user_id::text,'role','authenticated')::text from phase8b5_c_people where k='super_admin'),
  true
);
set local role authenticated;

with x as (
  select public.release_messages_legal_disclosure_v1(
    (select package_id from phase8b5_c_state),(select package_revision from phase8b5_c_state),
    'Controlled disclosure release','phase8b5-c-release-package-0001',null
  ) p
)
update phase8b5_c_state set package_revision=(x.p->>'revision')::bigint from x;

with x as (
  select public.update_messages_legal_scope_v1(
    (select case_id from phase8b5_c_state),'release',(select scope_one_id from phase8b5_c_state),
    null,null,null,null,null,null,null,null,(select case_revision from phase8b5_c_state),
    'Scope one duty ended','phase8b5-c-release-scope-one-0001',null
  ) p
)
update phase8b5_c_state set case_revision=(x.p->>'case_revision')::bigint from x;

with x as (
  select public.release_messages_legal_preservation_v1(
    (select case_id from phase8b5_c_state),(select object_one_id from phase8b5_c_state),
    (select object_one_revision from phase8b5_c_state),'Preservation one duty ended',
    'phase8b5-c-release-object-one-0001',null
  ) p
)
update phase8b5_c_state set object_one_revision=(x.p->>'revision')::bigint from x;

with x as (
  select public.update_messages_legal_scope_v1(
    (select case_id from phase8b5_c_state),'release',(select scope_two_id from phase8b5_c_state),
    null,null,null,null,null,null,null,null,(select case_revision from phase8b5_c_state),
    'Scope two duty ended','phase8b5-c-release-scope-two-0001',null
  ) p
)
update phase8b5_c_state set case_revision=(x.p->>'case_revision')::bigint from x;

with x as (
  select public.release_messages_legal_preservation_v1(
    (select case_id from phase8b5_c_state),(select object_two_id from phase8b5_c_state),
    (select object_two_revision from phase8b5_c_state),'Preservation two duty ended',
    'phase8b5-c-release-object-two-0001',null
  ) p
)
update phase8b5_c_state set object_two_revision=(x.p->>'revision')::bigint from x;

with x as (
  select public.close_messages_legal_request_case_v1(
    (select case_id from phase8b5_c_state),(select case_revision from phase8b5_c_state),
    'Candidate C rollback verifier complete','phase8b5-c-close-0001',null
  ) p
)
update phase8b5_c_state set case_revision=(x.p->>'revision')::bigint from x;
reset role;

do $final_assert$
begin
  if (select status from messaging.legal_request_cases where id=(select case_id from phase8b5_c_state))<>'closed' then
    raise exception 'PHASE_8B5_C_FAIL: Legal Request Case did not close';
  end if;
  if exists(select 1 from messaging.legal_preservation_scopes where legal_request_case_id=(select case_id from phase8b5_c_state) and status<>'released') then
    raise exception 'PHASE_8B5_C_FAIL: Legal preservation scope remained active';
  end if;
  if exists(select 1 from messaging.legal_preserved_objects where legal_request_case_id=(select case_id from phase8b5_c_state) and preservation_status<>'released') then
    raise exception 'PHASE_8B5_C_FAIL: Legal preserved object remained held';
  end if;
  if (select status from messaging.legal_disclosure_packages where id=(select package_id from phase8b5_c_state))<>'released' then
    raise exception 'PHASE_8B5_C_FAIL: generated disclosure package was not explicitly released';
  end if;
  if not exists(
    select 1 from messaging.legal_case_events
    where legal_request_case_id=(select case_id from phase8b5_c_state) and event_kind='case_closed'
  ) then
    raise exception 'PHASE_8B5_C_FAIL: Legal closure event is missing';
  end if;
end
$final_assert$;

select
  'PASS'::text as verification,
  (select count(*) from supabase_migrations.schema_migrations)::int as migration_count,
  (select max(version) from supabase_migrations.schema_migrations) as migration_head,
  (select count(*) from messaging.legal_request_cases where id=(select case_id from phase8b5_c_state))::int as legal_cases,
  (select count(*) from messaging.legal_preserved_objects where legal_request_case_id=(select case_id from phase8b5_c_state))::int as preserved_objects,
  (select count(*) from messaging.legal_disclosure_packages where id=(select package_id from phase8b5_c_state))::int as packages,
  (select count(*) from messaging.legal_case_events where legal_request_case_id=(select case_id from phase8b5_c_state))::int as legal_events;

rollback;
