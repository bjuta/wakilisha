-- Permanent rollback-only verifier for Phase 8B.5 Candidate C.
-- Proves separate Legal authority, exact preservation, deliberate evidence access,
-- exact-fingerprint approval, durable generation, immutable package identity,
-- controlled release, and rollback cleanliness.

begin;
set constraints all deferred;

-- Structural authority.
do $structural$
declare
  v_count bigint;
  v_definition text;
begin
  select count(*),max(version) into v_count,v_definition
  from supabase_migrations.schema_migrations;
  if v_count<>112 or v_definition<>'20260909080000' then
    raise exception 'PHASE_8B5_C_FAIL: expected 112 migrations at Candidate C head';
  end if;
  if not exists(
    select 1 from supabase_migrations.schema_migrations
    where version='20260909080000'
      and name='phase_8b5_candidate_c_legal_preservation_scoped_disclosure'
  ) then raise exception 'PHASE_8B5_C_FAIL: Candidate C migration history missing'; end if;

  if (
    select count(*) from information_schema.tables
    where table_schema='messaging'
      and table_name in (
        'legal_request_cases','legal_preservation_scopes','legal_preserved_objects',
        'legal_disclosure_packages','legal_disclosure_objects','legal_disclosure_approvals','legal_case_events'
      )
  )<>7 then raise exception 'PHASE_8B5_C_FAIL: seven Legal tables missing'; end if;

  if (
    select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='messaging'
      and c.relname in (
        'legal_request_cases','legal_preservation_scopes','legal_preserved_objects',
        'legal_disclosure_packages','legal_disclosure_objects','legal_disclosure_approvals','legal_case_events'
      ) and c.relrowsecurity
  )<>7 then raise exception 'PHASE_8B5_C_FAIL: Legal RLS incomplete'; end if;

  if exists(
    select 1 from information_schema.role_table_grants
    where table_schema='messaging' and table_name like 'legal_%'
      and grantee in ('anon','authenticated','service_role')
  ) then raise exception 'PHASE_8B5_C_FAIL: direct Legal table grants exist'; end if;

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
  if v_count<>13 then raise exception 'PHASE_8B5_C_FAIL: command family incomplete'; end if;

  if (
    select count(*) from public.role_capabilities
    where role_key='super_admin'
      and capability_key in (
        'view_messages_legal_cases','inspect_messages_legal_evidence',
        'manage_messages_legal_cases','approve_messages_legal_disclosure'
      )
  )<>4 then raise exception 'PHASE_8B5_C_FAIL: Super Admin Legal capabilities incomplete'; end if;

  if not exists(select 1 from media.asset_purposes where asset_purpose='legal_disclosure' and enabled) then
    raise exception 'PHASE_8B5_C_FAIL: Legal Media purpose missing';
  end if;

  if has_function_privilege('anon','public.list_messages_legal_cases_v1(text,integer)'::regprocedure,'EXECUTE')
     or not has_function_privilege('authenticated','public.list_messages_legal_cases_v1(text,integer)'::regprocedure,'EXECUTE')
     or has_function_privilege('service_role','public.list_messages_legal_cases_v1(text,integer)'::regprocedure,'EXECUTE')
     or has_function_privilege('authenticated','public.claim_messages_legal_disclosure_jobs_v1(text,integer,integer)'::regprocedure,'EXECUTE')
     or not has_function_privilege('service_role','public.claim_messages_legal_disclosure_jobs_v1(text,integer,integer)'::regprocedure,'EXECUTE') then
    raise exception 'PHASE_8B5_C_FAIL: Legal RPC grants incorrect';
  end if;

  if not exists(
    select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='messaging' and c.relname='legal_case_events'
      and t.tgname='legal_case_events_immutable' and not t.tgisinternal
  ) or not exists(
    select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='messaging' and c.relname='legal_disclosure_packages'
      and t.tgname='legal_disclosure_packages_generated_guard' and not t.tgisinternal
  ) then raise exception 'PHASE_8B5_C_FAIL: Legal immutability guards missing'; end if;

  v_definition:=pg_get_functiondef('public.materialize_messages_legal_preservation_v1(uuid,uuid,bigint,text,text,uuid)'::regprocedure);
  if position('m.conversation_id=v_scope.conversation_id' in v_definition)=0
     or position('m.accepted_at>=v_scope.accepted_from' in v_definition)=0
     or position('m.accepted_at<v_scope.accepted_until' in v_definition)=0
     or position('message_resource_references' in v_definition)>0 then
    raise exception 'PHASE_8B5_C_FAIL: preservation can widen through related graph';
  end if;

  v_definition:=pg_get_functiondef('public.get_messages_legal_disclosure_source_v1(uuid,text,uuid)'::regprocedure);
  if position('resource_references' in v_definition)=0 or position('[]' in v_definition)=0 then
    raise exception 'PHASE_8B5_C_FAIL: Message disclosure may implicitly expand Resource references';
  end if;

  v_definition:=pg_get_functiondef('public.submit_messages_legal_disclosure_generation_v1(uuid,bigint,text,uuid)'::regprocedure);
  if position('Active exact-fingerprint package approval is required' in v_definition)=0
     or position('Every elevated-review Legal object requires exact-fingerprint elevated approval' in v_definition)=0
     or position('platform_private.jobs' in v_definition)=0 then
    raise exception 'PHASE_8B5_C_FAIL: disclosure approval/job boundary incomplete';
  end if;
end
$structural$;

-- Rollback-only identities and state.
create temporary table phase8b5_c_fixture(k text primary key,id uuid not null) on commit drop;
create temporary table phase8b5_c_state(
  case_id uuid,case_revision bigint,scope_id uuid,preserved_object_id uuid,object_revision bigint,
  package_id uuid,package_revision bigint,fingerprint text,job_id uuid,plan jsonb,
  evidence_body text,source_body text,manifest_text text,manifest_sha text
) on commit drop;
insert into phase8b5_c_fixture values
  ('super_admin',gen_random_uuid()),('ordinary_admin',gen_random_uuid()),
  ('sender',gen_random_uuid()),('recipient',gen_random_uuid()),
  ('conversation',gen_random_uuid()),('message',gen_random_uuid()),('adjacent_message',gen_random_uuid());
insert into phase8b5_c_state default values;

insert into auth.users(
  id,aud,role,email,raw_app_meta_data,raw_user_meta_data,
  created_at,updated_at,is_sso_user,is_anonymous
)
select id,'authenticated','authenticated',
  'phase8b5-c-'||k||'-'||left(id::text,8)||'@example.invalid',
  jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
  jsonb_build_object('name','Phase 8B5 C '||k),now(),now(),false,false
from phase8b5_c_fixture where k in ('super_admin','ordinary_admin','sender','recipient');
set constraints all immediate;
set constraints all deferred;

create temporary table phase8b5_c_people as
select f.k,f.id user_id,l.person_resource_id
from phase8b5_c_fixture f
join editorial.person_identity_links l on l.user_id=f.id and l.link_state='active'
where f.k in ('super_admin','ordinary_admin','sender','recipient');

do $identity$
begin
  if (select count(*) from phase8b5_c_people)<>4 then
    raise exception 'PHASE_8B5_C_FAIL: canonical Person fixture provisioning failed';
  end if;
end
$identity$;

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
select id,'standard','active',now(),now(),gen_random_uuid() from phase8b5_c_fixture where k='conversation';
insert into messaging.conversation_participants(
  conversation_id,actor_kind,person_resource_id,user_id,membership_status,mailbox_folder,first_contact_state
)
select (select id from phase8b5_c_fixture where k='conversation'),'human',person_resource_id,user_id,'active','inbox','accepted'
from phase8b5_c_people where k in ('sender','recipient');
update messaging.conversations c set created_by_participant_id=p.id
from messaging.conversation_participants p,phase8b5_c_people u
where c.id=(select id from phase8b5_c_fixture where k='conversation')
  and p.conversation_id=c.id and p.user_id=u.user_id and u.k='sender';

insert into messaging.messages(id,conversation_id,sender_participant_id,message_kind,body,accepted_at,client_created_at,correlation_id)
select (select id from phase8b5_c_fixture where k='message'),
       (select id from phase8b5_c_fixture where k='conversation'),p.id,'text',
       'Candidate C exact Message fixture',now()-interval '2 minutes',now()-interval '2 minutes',gen_random_uuid()
from messaging.conversation_participants p,phase8b5_c_people u
where p.conversation_id=(select id from phase8b5_c_fixture where k='conversation') and p.user_id=u.user_id and u.k='sender';
insert into messaging.messages(id,conversation_id,sender_participant_id,message_kind,body,accepted_at,client_created_at,correlation_id)
select (select id from phase8b5_c_fixture where k='adjacent_message'),
       (select id from phase8b5_c_fixture where k='conversation'),p.id,'text',
       'Candidate C adjacent Message must not leak',now()-interval '1 minute',now()-interval '1 minute',gen_random_uuid()
from messaging.conversation_participants p,phase8b5_c_people u
where p.conversation_id=(select id from phase8b5_c_fixture where k='conversation') and p.user_id=u.user_id and u.k='sender';

grant select on phase8b5_c_fixture,phase8b5_c_people to authenticated,service_role;
grant select,update on phase8b5_c_state to authenticated,service_role;

-- Ordinary Administrator denial.
select set_config('request.jwt.claims',
  (select jsonb_build_object('sub',user_id::text,'role','authenticated')::text from phase8b5_c_people where k='ordinary_admin'),true);
set local role authenticated;
do $ordinary_denial$
begin
  begin
    perform public.list_messages_legal_cases_v1(null,50);
    raise exception 'PHASE_8B5_C_FAIL: ordinary Administrator read Legal cases';
  exception when sqlstate '42501' then null; end;
end
$ordinary_denial$;
reset role;

-- Super Admin Legal case, exact scope, preservation, classification, evidence.
select set_config('request.jwt.claims',
  (select jsonb_build_object('sub',user_id::text,'role','authenticated')::text from phase8b5_c_people where k='super_admin'),true);
set local role authenticated;
with x as (
  select public.open_messages_legal_request_case_v1(
    'WK-C-VERIFY-0001','disclosure','Controlled verifier authority','Candidate C verifier',
    timestamp with time zone '2026-09-09 00:00:00+00','Exact Message only','none',
    (select user_id from phase8b5_c_people where k='super_admin'),'phase8b5-c-open-0001',null) p
)
update phase8b5_c_state set case_id=(x.p->>'legal_request_case_id')::uuid,case_revision=(x.p->>'revision')::bigint from x;
with x as (
  select public.start_messages_legal_review_v1(
    (select case_id from phase8b5_c_state),(select case_revision from phase8b5_c_state),
    (select user_id from phase8b5_c_people where k='super_admin'),'Begin review','phase8b5-c-review-0001',null) p
)
update phase8b5_c_state set case_revision=(x.p->>'revision')::bigint from x;
with x as (
  select public.update_messages_legal_scope_v1(
    (select case_id from phase8b5_c_state),'add',null,'exact_message',
    (select id from phase8b5_c_fixture where k='message'),null,null,null,null,null,'Exact Message',
    (select case_revision from phase8b5_c_state),'Add exact Message','phase8b5-c-scope-0001',null) p
)
update phase8b5_c_state set scope_id=(x.p->>'scope_id')::uuid,case_revision=(x.p->>'case_revision')::bigint from x;
with x as (
  select public.materialize_messages_legal_preservation_v1(
    (select case_id from phase8b5_c_state),(select scope_id from phase8b5_c_state),
    (select case_revision from phase8b5_c_state),'Apply exact preservation','phase8b5-c-materialize-0001',null) p
)
update phase8b5_c_state set case_revision=(x.p->>'case_revision')::bigint from x;
reset role;

update phase8b5_c_state s set preserved_object_id=o.id,object_revision=o.revision
from messaging.legal_preserved_objects o
where o.legal_request_case_id=s.case_id and o.message_id=(select id from phase8b5_c_fixture where k='message');
do $scope_assert$
begin
  if (select count(*) from messaging.legal_preserved_objects where legal_request_case_id=(select case_id from phase8b5_c_state))<>1
     or exists(
       select 1 from messaging.legal_preserved_objects
       where legal_request_case_id=(select case_id from phase8b5_c_state)
         and message_id=(select id from phase8b5_c_fixture where k='adjacent_message')
     ) then raise exception 'PHASE_8B5_C_FAIL: exact scope leaked adjacent Conversation content'; end if;
end
$scope_assert$;

set local role authenticated;
with x as (
  select public.classify_messages_legal_object_v1(
    (select case_id from phase8b5_c_state),(select preserved_object_id from phase8b5_c_state),
    (select object_revision from phase8b5_c_state),'responsive','Exact Message is responsive',
    'phase8b5-c-classify-0001',null) p
)
update phase8b5_c_state set object_revision=(x.p->>'revision')::bigint from x;
with x as (
  select public.inspect_message_legal_evidence_v1(
    (select case_id from phase8b5_c_state),(select preserved_object_id from phase8b5_c_state),
    'Controlled exact evidence inspection','phase8b5-c-inspect-0001',null) p
)
update phase8b5_c_state set evidence_body=x.p#>>'{evidence,body}' from x;
perform public.inspect_message_legal_evidence_v1(
  (select case_id from phase8b5_c_state),(select preserved_object_id from phase8b5_c_state),
  'Controlled exact evidence inspection','phase8b5-c-inspect-0001',null);
reset role;

do $evidence_assert$
begin
  if (select evidence_body from phase8b5_c_state)<>'Candidate C exact Message fixture' then
    raise exception 'PHASE_8B5_C_FAIL: evidence returned wrong Message';
  end if;
  if (
    select count(*) from messaging.legal_case_events
    where legal_request_case_id=(select case_id from phase8b5_c_state)
      and legal_preserved_object_id=(select preserved_object_id from phase8b5_c_state)
      and event_kind='evidence_viewed'
  )<>1 then raise exception 'PHASE_8B5_C_FAIL: idempotent evidence replay duplicated audit history'; end if;
end
$evidence_assert$;

-- Package preparation and exact-fingerprint approval.
set local role authenticated;
with x as (
  select public.prepare_messages_legal_disclosure_v1(
    (select case_id from phase8b5_c_state),'WK-C-PROD-0001','Exact Message only',
    array['No adjacent Conversation or reachable Resource content'],array[(select preserved_object_id from phase8b5_c_state)],
    'phase8b5-c-prepare-0001',null) p
)
update phase8b5_c_state set package_id=(x.p->>'legal_disclosure_package_id')::uuid,package_revision=1,fingerprint=x.p->>'selection_fingerprint' from x;
with x as (
  select public.update_messages_legal_disclosure_approval_v1(
    (select package_id from phase8b5_c_state),'record_package',null,(select package_revision from phase8b5_c_state),
    (select fingerprint from phase8b5_c_state),'Human exact-fingerprint package approval','phase8b5-c-approve-0001',null) p
)
update phase8b5_c_state set package_revision=(x.p->>'package_revision')::bigint from x;

do $release_denied$
begin
  begin
    perform public.release_messages_legal_disclosure_v1(
      (select package_id from phase8b5_c_state),(select package_revision from phase8b5_c_state),
      'Premature release','phase8b5-c-release-denied-0001',null);
    raise exception 'PHASE_8B5_C_FAIL: ungenerated package released';
  exception when sqlstate '55000' then null; end;
end
$release_denied$;

with x as (
  select public.submit_messages_legal_disclosure_generation_v1(
    (select package_id from phase8b5_c_state),(select package_revision from phase8b5_c_state),
    'phase8b5-c-generate-0001',null) p
)
update phase8b5_c_state set job_id=(x.p->>'job_id')::uuid,package_revision=(x.p->>'package_revision')::bigint from x;
reset role;
update phase8b5_c_state set
  manifest_text='{"archive_version":"wk-legal-disclosure-zip-v1","manifest_version":"wk-legal-disclosure-manifest-v1","test":"candidate-c-verifier"}',
  manifest_sha=encode(extensions.digest(convert_to('{"archive_version":"wk-legal-disclosure-zip-v1","manifest_version":"wk-legal-disclosure-manifest-v1","test":"candidate-c-verifier"}','UTF8'),'sha256'),'hex');

-- Filtered service-role worker claim and exact source descriptor.
select set_config('request.jwt.claims',jsonb_build_object('role','service_role')::text,true);
set local role service_role;
with c as (select * from public.claim_messages_legal_disclosure_jobs_v1('candidate-c-verifier',1,900))
update phase8b5_c_state s set job_id=c.job_id from c where c.legal_disclosure_package_id=s.package_id;
do $wrong_worker$
begin
  begin
    perform public.get_messages_legal_disclosure_plan_v1((select job_id from phase8b5_c_state),'wrong-worker');
    raise exception 'PHASE_8B5_C_FAIL: wrong worker read Legal plan';
  exception when sqlstate '55000' then null; end;
end
$wrong_worker$;
with x as (select public.get_messages_legal_disclosure_plan_v1((select job_id from phase8b5_c_state),'candidate-c-verifier') p)
update phase8b5_c_state set plan=x.p from x;
with x as (
  select public.get_messages_legal_disclosure_source_v1(
    (select job_id from phase8b5_c_state),'candidate-c-verifier',
    ((select plan from phase8b5_c_state)#>>'{objects,0,legal_disclosure_object_id}')::uuid) p
)
update phase8b5_c_state set source_body=x.p#>>'{representation,body}' from x;

with result as (
  select jsonb_build_object(
    'manifest_text',(select manifest_text from phase8b5_c_state),
    'manifest_sha256',(select manifest_sha from phase8b5_c_state),
    'package_sha256',repeat('a',64),'package_byte_size',1234,
    'storage_path',(select plan->>'storage_path' from phase8b5_c_state),
    'objects',jsonb_build_array(jsonb_build_object(
      'legal_disclosure_object_id',((select plan from phase8b5_c_state)#>>'{objects,0,legal_disclosure_object_id}')::uuid,
      'output_path',(select plan#>>'{objects,0,output_path}' from phase8b5_c_state),
      'output_mime_type','application/json','object_sha256',repeat('b',64),'object_byte_size',42
    ))
  ) payload
)
select public.complete_messages_legal_disclosure_job_v1(
  (select job_id from phase8b5_c_state),'candidate-c-verifier',result.payload) from result;
reset role;

update phase8b5_c_state s set package_revision=p.revision
from messaging.legal_disclosure_packages p where p.id=s.package_id;
do $generated_assert$
begin
  if (select source_body from phase8b5_c_state)<>'Candidate C exact Message fixture'
     or jsonb_array_length((select plan->'objects' from phase8b5_c_state))<>1 then
    raise exception 'PHASE_8B5_C_FAIL: worker source widened or changed exact selection';
  end if;
  if not exists(
    select 1 from messaging.legal_disclosure_packages p
    join media.assets a on a.id=p.package_asset_id
    join media.file_objects f on f.id=p.package_file_object_id
    where p.id=(select package_id from phase8b5_c_state)
      and p.status='generated' and a.asset_purpose='legal_disclosure'
      and f.verification_state='verified' and f.storage_provider='lightsail_media'
  ) then raise exception 'PHASE_8B5_C_FAIL: generated package lacks canonical restricted Media identity'; end if;
end
$generated_assert$;

-- Human release remains separate from generation; preservation release remains separate from canonical deletion.
select set_config('request.jwt.claims',
  (select jsonb_build_object('sub',user_id::text,'role','authenticated')::text from phase8b5_c_people where k='super_admin'),true);
set local role authenticated;
with x as (
  select public.release_messages_legal_disclosure_v1(
    (select package_id from phase8b5_c_state),(select package_revision from phase8b5_c_state),
    'Controlled disclosure release','phase8b5-c-release-package-0001',null) p
)
update phase8b5_c_state set package_revision=(x.p->>'revision')::bigint from x;
with x as (
  select public.update_messages_legal_scope_v1(
    (select case_id from phase8b5_c_state),'release',(select scope_id from phase8b5_c_state),
    null,null,null,null,null,null,null,null,(select case_revision from phase8b5_c_state),
    'Scope duty ended','phase8b5-c-release-scope-0001',null) p
)
update phase8b5_c_state set case_revision=(x.p->>'case_revision')::bigint from x;
with x as (
  select public.release_messages_legal_preservation_v1(
    (select case_id from phase8b5_c_state),(select preserved_object_id from phase8b5_c_state),
    (select object_revision from phase8b5_c_state),'Preservation duty ended','phase8b5-c-release-object-0001',null) p
)
update phase8b5_c_state set object_revision=(x.p->>'revision')::bigint from x;
with x as (
  select public.close_messages_legal_request_case_v1(
    (select case_id from phase8b5_c_state),(select case_revision from phase8b5_c_state),
    'Candidate C rollback verifier complete','phase8b5-c-close-0001',null) p
)
update phase8b5_c_state set case_revision=(x.p->>'revision')::bigint from x;
reset role;

do $final_assert$
begin
  if (select status from messaging.legal_request_cases where id=(select case_id from phase8b5_c_state))<>'closed'
     or (select status from messaging.legal_preservation_scopes where id=(select scope_id from phase8b5_c_state))<>'released'
     or (select preservation_status from messaging.legal_preserved_objects where id=(select preserved_object_id from phase8b5_c_state))<>'released'
     or (select status from messaging.legal_disclosure_packages where id=(select package_id from phase8b5_c_state))<>'released' then
    raise exception 'PHASE_8B5_C_FAIL: final Legal recovery/closure state is incomplete';
  end if;
end
$final_assert$;

select 'PASS'::text as verification,
       (select count(*) from supabase_migrations.schema_migrations)::int as migration_count,
       (select max(version) from supabase_migrations.schema_migrations) as migration_head,
       1::int as legal_cases,
       1::int as preserved_objects,
       1::int as packages,
       (select count(*) from messaging.legal_case_events where legal_request_case_id=(select case_id from phase8b5_c_state))::int as legal_events;
rollback;
