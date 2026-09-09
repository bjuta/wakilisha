-- Permanent rollback-only verifier for Phase 8B.5 Candidate C.
-- Proves separate Legal authority, exact preservation, deliberate evidence access,
-- exact-fingerprint approval, durable generation, immutable package identity,
-- controlled release, and rollback cleanliness.

begin;
set constraints all deferred;

do $structural$
declare
  v_count bigint;
  v_definition text;
begin
  select count(*),max(version) into v_count,v_definition from supabase_migrations.schema_migrations;
  if v_count<>112 or v_definition<>'20260909080000' then raise exception 'PHASE_8B5_C_FAIL: expected 112 migrations at Candidate C head'; end if;
  if not exists(select 1 from supabase_migrations.schema_migrations where version='20260909080000' and name='phase_8b5_candidate_c_legal_preservation_scoped_disclosure') then raise exception 'PHASE_8B5_C_FAIL: Candidate C migration history missing'; end if;
  if (select count(*) from information_schema.tables where table_schema='messaging' and table_name in ('legal_request_cases','legal_preservation_scopes','legal_preserved_objects','legal_disclosure_packages','legal_disclosure_objects','legal_disclosure_approvals','legal_case_events'))<>7 then raise exception 'PHASE_8B5_C_FAIL: seven Legal tables missing'; end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='messaging' and c.relname in ('legal_request_cases','legal_preservation_scopes','legal_preserved_objects','legal_disclosure_packages','legal_disclosure_objects','legal_disclosure_approvals','legal_case_events') and c.relrowsecurity)<>7 then raise exception 'PHASE_8B5_C_FAIL: Legal RLS incomplete'; end if;
  if exists(select 1 from information_schema.role_table_grants where table_schema='messaging' and table_name like 'legal_%' and grantee in ('anon','authenticated','service_role')) then raise exception 'PHASE_8B5_C_FAIL: direct Legal table grants exist'; end if;
  with expected(command_type) as (values ('messages.legal.case.open'),('messages.legal.review.start'),('messages.legal.scope.update'),('messages.legal.preservation.materialize'),('messages.legal.preservation.release'),('messages.legal.classification.update'),('messages.legal.evidence.inspect'),('messages.legal.disclosure.prepare'),('messages.legal.disclosure.approval.update'),('messages.legal.disclosure.generate'),('messages.legal.disclosure.release'),('messages.legal.disclosure.void'),('messages.legal.case.close')) select count(*) into v_count from expected e join platform_private.command_types c using(command_type) where c.enabled;
  if v_count<>13 then raise exception 'PHASE_8B5_C_FAIL: command family incomplete'; end if;
  if (select count(*) from public.role_capabilities where role_key='super_admin' and capability_key in ('view_messages_legal_cases','inspect_messages_legal_evidence','manage_messages_legal_cases','approve_messages_legal_disclosure'))<>4 then raise exception 'PHASE_8B5_C_FAIL: Super Admin Legal capabilities incomplete'; end if;
  if not exists(select 1 from media.asset_purposes where asset_purpose='legal_disclosure' and enabled) then raise exception 'PHASE_8B5_C_FAIL: Legal Media purpose missing'; end if;
  if has_function_privilege('anon','public.list_messages_legal_cases_v1(text,integer)'::regprocedure,'EXECUTE') or not has_function_privilege('authenticated','public.list_messages_legal_cases_v1(text,integer)'::regprocedure,'EXECUTE') or has_function_privilege('service_role','public.list_messages_legal_cases_v1(text,integer)'::regprocedure,'EXECUTE') or has_function_privilege('authenticated','public.claim_messages_legal_disclosure_jobs_v1(text,integer,integer)'::regprocedure,'EXECUTE') or not has_function_privilege('service_role','public.claim_messages_legal_disclosure_jobs_v1(text,integer,integer)'::regprocedure,'EXECUTE') then raise exception 'PHASE_8B5_C_FAIL: Legal RPC grants incorrect'; end if;
  if not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='messaging' and c.relname='legal_case_events' and t.tgname='legal_case_events_immutable' and not t.tgisinternal) or not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='messaging' and c.relname='legal_disclosure_packages' and t.tgname='legal_disclosure_packages_generated_guard' and not t.tgisinternal) then raise exception 'PHASE_8B5_C_FAIL: Legal immutability guards missing'; end if;
  v_definition:=pg_get_functiondef('public.materialize_messages_legal_preservation_v1(uuid,uuid,bigint,text,text,uuid)'::regprocedure);
  if position('m.conversation_id=v_scope.conversation_id' in v_definition)=0 or position('m.accepted_at>=v_scope.accepted_from' in v_definition)=0 or position('m.accepted_at<v_scope.accepted_until' in v_definition)=0 or position('message_resource_references' in v_definition)>0 then raise exception 'PHASE_8B5_C_FAIL: preservation can widen through related graph'; end if;
  v_definition:=pg_get_functiondef('public.get_messages_legal_disclosure_source_v1(uuid,text,uuid)'::regprocedure);
  if position('messaging.message_resource_references' in v_definition)=0
     or position('messaging.legal_preserved_objects' in v_definition)=0
     or position('messaging.legal_disclosure_objects' in v_definition)=0
     or position('reference.resource_version_id is not null' in v_definition)=0
     or position('reference.presentation_kind=''version''' in v_definition)=0
     or position('held_reference.preservation_status=''held''' in v_definition)=0
     or position('held_reference.response_classification in (''responsive'',''elevated_review'')' in v_definition)=0
     or position('selected_reference.legal_disclosure_package_id=v_package.id' in v_definition)=0
     or position('selected_reference.legal_preserved_object_id=held_reference.id' in v_definition)=0
     or position('selected_reference.response_classification=held_reference.response_classification' in v_definition)=0
     or position('''resource_id'',reference.resource_id' in v_definition)=0
     or position('''resource_version_id'',reference.resource_version_id' in v_definition)=0
     or position('''presentation_kind'',reference.presentation_kind' in v_definition)=0
  then raise exception 'PHASE_8B5_C_FAIL: Message disclosure exact Resource Version scope boundary is incomplete'; end if;
  if to_regprocedure('public.list_messages_legal_preserved_objects_v1(uuid,text,text,integer)') is null then
    raise exception 'PHASE_8B5_C_FAIL: safe Legal preserved-object read RPC is missing';
  end if;
  if has_function_privilege('anon','public.list_messages_legal_preserved_objects_v1(uuid,text,text,integer)'::regprocedure,'EXECUTE')
     or not has_function_privilege('authenticated','public.list_messages_legal_preserved_objects_v1(uuid,text,text,integer)'::regprocedure,'EXECUTE')
     or has_function_privilege('service_role','public.list_messages_legal_preserved_objects_v1(uuid,text,text,integer)'::regprocedure,'EXECUTE')
  then
    raise exception 'PHASE_8B5_C_FAIL: safe Legal preserved-object read grants are incorrect';
  end if;
  v_definition:=pg_get_functiondef('public.list_messages_legal_preserved_objects_v1(uuid,text,text,integer)'::regprocedure);
  if position('classification_reason' in v_definition)>0
     or position('message_kind' in v_definition)>0
     or position('body' in v_definition)>0
     or position('storage_path' in v_definition)>0
  then
    raise exception 'PHASE_8B5_C_FAIL: safe Legal preserved-object read exposes restricted content or internal rationale';
  end if;
  v_definition:=pg_get_functiondef('public.update_messages_legal_disclosure_approval_v1(uuid,text,uuid,bigint,text,text,text,uuid)'::regprocedure);
  if position('Elevated-review approvals must be recorded before package approval.' in v_definition)=0 then
    raise exception 'PHASE_8B5_C_FAIL: package approval can precede required elevated-object approvals';
  end if;
  v_definition:=pg_get_functiondef('public.submit_messages_legal_disclosure_generation_v1(uuid,bigint,text,uuid)'::regprocedure);
  if position('Active exact-fingerprint package approval is required' in v_definition)=0 or position('Every elevated-review Legal object requires exact-fingerprint elevated approval' in v_definition)=0 or position('platform_private.jobs' in v_definition)=0 then raise exception 'PHASE_8B5_C_FAIL: disclosure approval/job boundary incomplete'; end if;
  if to_regprocedure('public.get_messages_legal_disclosure_delivery_target_v1(uuid,text,text,uuid)') is null then
    raise exception 'PHASE_8B5_C_FAIL: dedicated Legal disclosure delivery RPC is missing';
  end if;
  if has_function_privilege('anon','public.get_messages_legal_disclosure_delivery_target_v1(uuid,text,text,uuid)'::regprocedure,'EXECUTE')
     or not has_function_privilege('authenticated','public.get_messages_legal_disclosure_delivery_target_v1(uuid,text,text,uuid)'::regprocedure,'EXECUTE')
     or has_function_privilege('service_role','public.get_messages_legal_disclosure_delivery_target_v1(uuid,text,text,uuid)'::regprocedure,'EXECUTE')
  then
    raise exception 'PHASE_8B5_C_FAIL: Legal disclosure delivery RPC grants are incorrect';
  end if;
  v_definition:=pg_get_functiondef('messaging.legal_package_storage_path_v1(uuid,uuid)'::regprocedure);
  if position('private-files/legal-disclosures/' in v_definition)=0
     or position('derived-objects/legal-disclosures/' in v_definition)>0
  then
    raise exception 'PHASE_8B5_C_FAIL: Legal package storage path is outside the dedicated private Legal root';
  end if;
  v_definition:=pg_get_functiondef('public.get_media_private_delivery_target_v1(uuid)'::regprocedure);
  if position('legal_disclosure_packages' in v_definition)>0
     or position('messages.legal' in v_definition)>0
  then
    raise exception 'PHASE_8B5_C_FAIL: generic Media private delivery was widened into Legal authority';
  end if;
  v_definition:=pg_get_functiondef('public.get_messages_legal_disclosure_delivery_target_v1(uuid,text,text,uuid)'::regprocedure);
  if position('messages.legal.evidence.inspect' in v_definition)=0
     or position('legal_package_storage_path_v1' in v_definition)=0
     or position('inspect_messages_legal_evidence' in v_definition)=0
  then
    raise exception 'PHASE_8B5_C_FAIL: Legal disclosure delivery is not case/capability/audit bound';
  end if;
  if not has_function_privilege(
       'authenticated',
       'public.create_media_asset(text,text,text,uuid,uuid)'::regprocedure,
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.create_media_asset_revision(uuid,bigint,uuid,text,uuid)'::regprocedure,
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.create_media_governance_version(uuid,bigint,jsonb,text,uuid)'::regprocedure,
       'EXECUTE'
     )
  then
    raise exception 'PHASE_8B5_C_FAIL: accepted generic Media administrator command authority is missing';
  end if;
  with expected(table_name,trigger_name) as (
    values
      ('file_objects','file_objects_legal_disclosure_guard'),
      ('assets','assets_legal_disclosure_guard'),
      ('asset_governance_versions','governance_legal_disclosure_guard'),
      ('asset_revisions','asset_revisions_legal_disclosure_guard'),
      ('variants','variants_legal_disclosure_guard'),
      ('usage_links','usage_links_legal_disclosure_guard')
  )
  select count(*) into v_count
  from expected e
  join pg_namespace n on n.nspname='media'
  join pg_class c on c.relnamespace=n.oid and c.relname=e.table_name
  join pg_trigger t on t.tgrelid=c.oid and t.tgname=e.trigger_name and not t.tgisinternal;
  if v_count<>6 then
    raise exception 'PHASE_8B5_C_FAIL: Legal Media immutability/anti-reuse trigger boundary is incomplete';
  end if;
end
$structural$;

create temporary table phase8b5_c_fixture(k text primary key,id uuid not null) on commit drop;
create temporary table phase8b5_c_state(case_id uuid,case_revision bigint,scope_id uuid,preserved_object_id uuid,object_revision bigint,selected_resource_scope_id uuid,unselected_resource_scope_id uuid,selected_resource_preserved_object_id uuid,selected_resource_object_revision bigint,unselected_resource_preserved_object_id uuid,unselected_resource_object_revision bigint,package_id uuid,package_revision bigint,fingerprint text,job_id uuid,plan jsonb,evidence_body text,source_body text,source_references jsonb,resource_source_version_id text,manifest_text text,manifest_sha text,delivery_path text) on commit drop;
insert into phase8b5_c_fixture values ('super_admin',gen_random_uuid()),('ordinary_admin',gen_random_uuid()),('sender',gen_random_uuid()),('recipient',gen_random_uuid()),('conversation',gen_random_uuid()),('message',gen_random_uuid()),('adjacent_message',gen_random_uuid()),('selected_resource_version',gen_random_uuid()),('unselected_resource_version',gen_random_uuid());
insert into phase8b5_c_state default values;
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_sso_user,is_anonymous)
select id,'authenticated','authenticated','phase8b5-c-'||k||'-'||left(id::text,8)||'@example.invalid',jsonb_build_object('provider','email','providers',jsonb_build_array('email')),jsonb_build_object('name','Phase 8B5 C '||k),now(),now(),false,false from phase8b5_c_fixture where k in ('super_admin','ordinary_admin','sender','recipient');
set constraints all immediate;
set constraints all deferred;
create temporary table phase8b5_c_people as select f.k,f.id user_id,l.person_resource_id from phase8b5_c_fixture f join editorial.person_identity_links l on l.user_id=f.id and l.link_state='active' where f.k in ('super_admin','ordinary_admin','sender','recipient');
do $identity$ begin if (select count(*) from phase8b5_c_people)<>4 then raise exception 'PHASE_8B5_C_FAIL: canonical Person fixture provisioning failed'; end if; end $identity$;
insert into public.user_role_assignments(user_id,role_key,status,assigned_by,assigned_at,notes,created_at,updated_at)
select user_id,'super_admin','active',null::uuid,now(),'Candidate C rollback verifier',now(),now() from phase8b5_c_people where k='super_admin'
union all select user_id,'administrator','active',null::uuid,now(),'Candidate C rollback verifier',now(),now() from phase8b5_c_people where k='ordinary_admin'
union all select user_id,'author','active',null::uuid,now(),'Candidate C rollback verifier',now(),now() from phase8b5_c_people where k in ('sender','recipient');

-- Rollback-only exact Resource Version envelopes. They use the already-created
-- canonical Super Admin Person Resource only as a stable Resource identity.
-- No typed payload is disclosed or copied into Messages.
insert into editorial.resource_version_types(
  version_type,label,description,source_table_schema,source_table_name,enabled
)
values (
  'phase8b5_c_verifier_person_version',
  'Candidate C verifier Person version',
  'Rollback-only Resource Version envelope for Candidate C exact-reference scope verification.',
  'editorial',
  'phase8b5_c_verifier_resource_versions',
  true
);
insert into editorial.resource_version_type_kinds(version_type,resource_kind)
select 'phase8b5_c_verifier_person_version',r.resource_kind
from editorial.resources r
join phase8b5_c_people p on p.k='super_admin' and p.person_resource_id=r.id;
insert into editorial.resource_versions(
  id,resource_id,resource_kind,version_type,version_kind,version_number,
  content_fingerprint,created_by,created_at,registered_at
)
select
  f.id,
  r.id,
  r.resource_kind,
  'phase8b5_c_verifier_person_version',
  'snapshot',
  case f.k when 'selected_resource_version' then 900000001 else 900000002 end,
  case f.k when 'selected_resource_version' then repeat('c',64) else repeat('d',64) end,
  p.user_id,
  now()-interval '5 minutes',
  now()-interval '5 minutes'
from phase8b5_c_fixture f
cross join phase8b5_c_people p
join editorial.resources r on r.id=p.person_resource_id
where p.k='super_admin'
  and f.k in ('selected_resource_version','unselected_resource_version');

insert into messaging.conversations(id,security_classification,status,created_at,last_activity_at,correlation_id) select id,'standard','active',now(),now(),gen_random_uuid() from phase8b5_c_fixture where k='conversation';
insert into messaging.conversation_participants(conversation_id,actor_kind,person_resource_id,user_id,membership_status,mailbox_folder,first_contact_state) select (select id from phase8b5_c_fixture where k='conversation'),'human',person_resource_id,user_id,'active','inbox','accepted' from phase8b5_c_people where k in ('sender','recipient');
update messaging.conversations c set created_by_participant_id=p.id from messaging.conversation_participants p,phase8b5_c_people u where c.id=(select id from phase8b5_c_fixture where k='conversation') and p.conversation_id=c.id and p.user_id=u.user_id and u.k='sender';
insert into messaging.messages(id,conversation_id,sender_participant_id,message_kind,body,accepted_at,client_created_at,correlation_id) select (select id from phase8b5_c_fixture where k='message'),(select id from phase8b5_c_fixture where k='conversation'),p.id,'text','Candidate C exact Message fixture',now()-interval '2 minutes',now()-interval '2 minutes',gen_random_uuid() from messaging.conversation_participants p,phase8b5_c_people u where p.conversation_id=(select id from phase8b5_c_fixture where k='conversation') and p.user_id=u.user_id and u.k='sender';
insert into messaging.messages(id,conversation_id,sender_participant_id,message_kind,body,accepted_at,client_created_at,correlation_id) select (select id from phase8b5_c_fixture where k='adjacent_message'),(select id from phase8b5_c_fixture where k='conversation'),p.id,'text','Candidate C adjacent Message must not leak',now()-interval '1 minute',now()-interval '1 minute',gen_random_uuid() from messaging.conversation_participants p,phase8b5_c_people u where p.conversation_id=(select id from phase8b5_c_fixture where k='conversation') and p.user_id=u.user_id and u.k='sender';

-- The Message carries one moving Resource reference and two exact-version
-- references. Only the separately held + separately selected exact version may
-- appear in the Legal Message representation.
insert into messaging.message_resource_references(
  message_id,resource_id,resource_version_id,presentation_kind
)
select
  (select id from phase8b5_c_fixture where k='message'),
  p.person_resource_id,
  null::uuid,
  'resource'
from phase8b5_c_people p where p.k='super_admin'
union all
select
  (select id from phase8b5_c_fixture where k='message'),
  p.person_resource_id,
  (select id from phase8b5_c_fixture where k='selected_resource_version'),
  'version'
from phase8b5_c_people p where p.k='super_admin'
union all
select
  (select id from phase8b5_c_fixture where k='message'),
  p.person_resource_id,
  (select id from phase8b5_c_fixture where k='unselected_resource_version'),
  'version'
from phase8b5_c_people p where p.k='super_admin';

grant select on phase8b5_c_fixture,phase8b5_c_people to authenticated,service_role;
grant select,update on phase8b5_c_state to authenticated,service_role;
select set_config('request.jwt.claims',(select jsonb_build_object('sub',user_id::text,'role','authenticated')::text from phase8b5_c_people where k='ordinary_admin'),true);
set local role authenticated;
do $ordinary_denial$ begin begin perform public.list_messages_legal_cases_v1(null,50); raise exception 'PHASE_8B5_C_FAIL: ordinary Administrator read Legal cases'; exception when sqlstate '42501' then null; end; end $ordinary_denial$;
reset role;
select set_config('request.jwt.claims',(select jsonb_build_object('sub',user_id::text,'role','authenticated')::text from phase8b5_c_people where k='super_admin'),true);
set local role authenticated;
with x as (select public.open_messages_legal_request_case_v1('WK-C-VERIFY-0001','disclosure','Controlled verifier authority','Candidate C verifier',timestamp with time zone '2026-09-09 00:00:00+00','Exact Message only','none',(select user_id from phase8b5_c_people where k='super_admin'),'phase8b5-c-open-0001',null) p) update phase8b5_c_state set case_id=(x.p->>'legal_request_case_id')::uuid,case_revision=(x.p->>'revision')::bigint from x;
with x as (select public.start_messages_legal_review_v1((select case_id from phase8b5_c_state),(select case_revision from phase8b5_c_state),(select user_id from phase8b5_c_people where k='super_admin'),'Begin review','phase8b5-c-review-0001',null) p) update phase8b5_c_state set case_revision=(x.p->>'revision')::bigint from x;
with x as (select public.update_messages_legal_scope_v1((select case_id from phase8b5_c_state),'add',null,'exact_message',(select id from phase8b5_c_fixture where k='message'),null,null,null,null,null,'Exact Message',(select case_revision from phase8b5_c_state),'Add exact Message','phase8b5-c-scope-0001',null) p) update phase8b5_c_state set scope_id=(x.p->>'scope_id')::uuid,case_revision=(x.p->>'case_revision')::bigint from x;
with x as (select public.materialize_messages_legal_preservation_v1((select case_id from phase8b5_c_state),(select scope_id from phase8b5_c_state),(select case_revision from phase8b5_c_state),'Apply exact preservation','phase8b5-c-materialize-0001',null) p) update phase8b5_c_state set case_revision=(x.p->>'case_revision')::bigint from x;
reset role;
update phase8b5_c_state s set preserved_object_id=o.id,object_revision=o.revision from messaging.legal_preserved_objects o where o.legal_request_case_id=s.case_id and o.message_id=(select id from phase8b5_c_fixture where k='message');
do $scope_assert$ begin if (select count(*) from messaging.legal_preserved_objects where legal_request_case_id=(select case_id from phase8b5_c_state))<>1 or exists(select 1 from messaging.legal_preserved_objects where legal_request_case_id=(select case_id from phase8b5_c_state) and message_id=(select id from phase8b5_c_fixture where k='adjacent_message')) then raise exception 'PHASE_8B5_C_FAIL: exact scope leaked adjacent Conversation content'; end if; end $scope_assert$;
set local role authenticated;
with x as (select public.classify_messages_legal_object_v1((select case_id from phase8b5_c_state),(select preserved_object_id from phase8b5_c_state),(select object_revision from phase8b5_c_state),'responsive','Exact Message is responsive','phase8b5-c-classify-0001',null) p) update phase8b5_c_state set object_revision=(x.p->>'revision')::bigint from x;
with x as (select public.inspect_message_legal_evidence_v1((select case_id from phase8b5_c_state),(select preserved_object_id from phase8b5_c_state),'Controlled exact evidence inspection','phase8b5-c-inspect-0001',null) p) update phase8b5_c_state set evidence_body=x.p#>>'{evidence,body}' from x;
select public.inspect_message_legal_evidence_v1((select case_id from phase8b5_c_state),(select preserved_object_id from phase8b5_c_state),'Controlled exact evidence inspection','phase8b5-c-inspect-0001',null);
reset role;
do $evidence_assert$ begin if (select evidence_body from phase8b5_c_state)<>'Candidate C exact Message fixture' then raise exception 'PHASE_8B5_C_FAIL: evidence returned wrong Message'; end if; if (select count(*) from messaging.legal_case_events where legal_request_case_id=(select case_id from phase8b5_c_state) and legal_preserved_object_id=(select preserved_object_id from phase8b5_c_state) and event_kind='evidence_viewed')<>1 then raise exception 'PHASE_8B5_C_FAIL: idempotent evidence replay duplicated audit history'; end if; end $evidence_assert$;
set local role authenticated;

with x as (
  select public.update_messages_legal_scope_v1(
    (select case_id from phase8b5_c_state),'add',null,'exact_resource_version',
    null,null,null,null,null,
    (select id from phase8b5_c_fixture where k='selected_resource_version'),
    'Selected exact Resource Version',(select case_revision from phase8b5_c_state),
    'Add selected exact Resource Version','phase8b5-c-scope-resource-selected-0001',null
  ) p
) update phase8b5_c_state set selected_resource_scope_id=(x.p->>'scope_id')::uuid,case_revision=(x.p->>'case_revision')::bigint from x;
with x as (
  select public.materialize_messages_legal_preservation_v1(
    (select case_id from phase8b5_c_state),(select selected_resource_scope_id from phase8b5_c_state),
    (select case_revision from phase8b5_c_state),'Apply selected Resource Version preservation',
    'phase8b5-c-materialize-resource-selected-0001',null
  ) p
) update phase8b5_c_state set case_revision=(x.p->>'case_revision')::bigint from x;
reset role;
update phase8b5_c_state s
set selected_resource_preserved_object_id=o.id,selected_resource_object_revision=o.revision
from messaging.legal_preserved_objects o
where o.legal_request_case_id=s.case_id
  and o.resource_version_id=(select id from phase8b5_c_fixture where k='selected_resource_version');
set local role authenticated;
with x as (
  select public.classify_messages_legal_object_v1(
    (select case_id from phase8b5_c_state),(select selected_resource_preserved_object_id from phase8b5_c_state),
    (select selected_resource_object_revision from phase8b5_c_state),'elevated_review',
    'Selected exact Resource Version requires elevated review',
    'phase8b5-c-classify-resource-selected-0001',null
  ) p
) update phase8b5_c_state set selected_resource_object_revision=(x.p->>'revision')::bigint from x;
with x as (
  select public.update_messages_legal_scope_v1(
    (select case_id from phase8b5_c_state),'add',null,'exact_resource_version',
    null,null,null,null,null,
    (select id from phase8b5_c_fixture where k='unselected_resource_version'),
    'Held but unselected exact Resource Version',(select case_revision from phase8b5_c_state),
    'Add held unselected exact Resource Version','phase8b5-c-scope-resource-unselected-0001',null
  ) p
) update phase8b5_c_state set unselected_resource_scope_id=(x.p->>'scope_id')::uuid,case_revision=(x.p->>'case_revision')::bigint from x;
with x as (
  select public.materialize_messages_legal_preservation_v1(
    (select case_id from phase8b5_c_state),(select unselected_resource_scope_id from phase8b5_c_state),
    (select case_revision from phase8b5_c_state),'Apply held unselected Resource Version preservation',
    'phase8b5-c-materialize-resource-unselected-0001',null
  ) p
) update phase8b5_c_state set case_revision=(x.p->>'case_revision')::bigint from x;
reset role;
update phase8b5_c_state s
set unselected_resource_preserved_object_id=o.id,unselected_resource_object_revision=o.revision
from messaging.legal_preserved_objects o
where o.legal_request_case_id=s.case_id
  and o.resource_version_id=(select id from phase8b5_c_fixture where k='unselected_resource_version');
set local role authenticated;
with x as (
  select public.classify_messages_legal_object_v1(
    (select case_id from phase8b5_c_state),(select unselected_resource_preserved_object_id from phase8b5_c_state),
    (select unselected_resource_object_revision from phase8b5_c_state),'responsive',
    'Held exact Resource Version deliberately omitted from this package',
    'phase8b5-c-classify-resource-unselected-0001',null
  ) p
) update phase8b5_c_state set unselected_resource_object_revision=(x.p->>'revision')::bigint from x;


do $safe_preserved_list_assert$
declare
  v_list jsonb;
begin
  v_list:=public.list_messages_legal_preserved_objects_v1(
    (select case_id from phase8b5_c_state),null,null,200
  );
  if jsonb_typeof(v_list)<>'array' or jsonb_array_length(v_list)<>3 then
    raise exception 'PHASE_8B5_C_FAIL: safe Legal preserved-object read returned the wrong exact object set';
  end if;
  if v_list::text like '%Candidate C exact Message fixture%'
     or v_list::text like '%classification_reason%'
     or v_list::text like '%storage_path%'
  then
    raise exception 'PHASE_8B5_C_FAIL: safe Legal preserved-object read leaked restricted evidence or internal rationale';
  end if;
end
$safe_preserved_list_assert$;

with x as (select public.prepare_messages_legal_disclosure_v1((select case_id from phase8b5_c_state),'WK-C-PROD-0001','Exact Message only',array['No adjacent Conversation or reachable Resource content'],array[(select preserved_object_id from phase8b5_c_state),(select selected_resource_preserved_object_id from phase8b5_c_state)],'phase8b5-c-prepare-0001',null) p) update phase8b5_c_state set package_id=(x.p->>'legal_disclosure_package_id')::uuid,package_revision=1,fingerprint=x.p->>'selection_fingerprint' from x;
do $package_approval_before_elevated_denied$
begin
  begin
    perform public.update_messages_legal_disclosure_approval_v1(
      (select package_id from phase8b5_c_state),'record_package',null,
      (select package_revision from phase8b5_c_state),(select fingerprint from phase8b5_c_state),
      'Package approval must wait for elevated review','phase8b5-c-approve-before-elevated-denied-0001',null
    );
    raise exception 'PHASE_8B5_C_FAIL: package approval succeeded before required elevated-object approval';
  exception when sqlstate '55000' then null;
  end;
end
$package_approval_before_elevated_denied$;
with x as (
  select public.update_messages_legal_disclosure_approval_v1(
    (select package_id from phase8b5_c_state),'record_elevated',
    (select selected_resource_preserved_object_id from phase8b5_c_state),
    (select package_revision from phase8b5_c_state),(select fingerprint from phase8b5_c_state),
    'Human elevated-object approval','phase8b5-c-approve-elevated-0001',null
  ) p
) update phase8b5_c_state set package_revision=(x.p->>'package_revision')::bigint from x;
with x as (select public.update_messages_legal_disclosure_approval_v1((select package_id from phase8b5_c_state),'record_package',null,(select package_revision from phase8b5_c_state),(select fingerprint from phase8b5_c_state),'Human exact-fingerprint package approval','phase8b5-c-approve-0001',null) p) update phase8b5_c_state set package_revision=(x.p->>'package_revision')::bigint from x;
do $release_denied$ begin begin perform public.release_messages_legal_disclosure_v1((select package_id from phase8b5_c_state),(select package_revision from phase8b5_c_state),'Premature release','phase8b5-c-release-denied-0001',null); raise exception 'PHASE_8B5_C_FAIL: ungenerated package released'; exception when sqlstate '55000' then null; end; end $release_denied$;
with x as (select public.submit_messages_legal_disclosure_generation_v1((select package_id from phase8b5_c_state),(select package_revision from phase8b5_c_state),'phase8b5-c-generate-0001',null) p) update phase8b5_c_state set job_id=(x.p->>'job_id')::uuid,package_revision=(x.p->>'package_revision')::bigint from x;
reset role;
update phase8b5_c_state set manifest_text='{"archive_version":"wk-legal-disclosure-zip-v1","manifest_version":"wk-legal-disclosure-manifest-v1","test":"candidate-c-verifier"}',manifest_sha=encode(extensions.digest(convert_to('{"archive_version":"wk-legal-disclosure-zip-v1","manifest_version":"wk-legal-disclosure-manifest-v1","test":"candidate-c-verifier"}','UTF8'),'sha256'),'hex');
select set_config('request.jwt.claims',jsonb_build_object('role','service_role')::text,true);
set local role service_role;
with c as (select * from public.claim_messages_legal_disclosure_jobs_v1('candidate-c-verifier',1,900)) update phase8b5_c_state s set job_id=c.job_id from c where c.legal_disclosure_package_id=s.package_id;
do $wrong_worker$ begin begin perform public.get_messages_legal_disclosure_plan_v1((select job_id from phase8b5_c_state),'wrong-worker'); raise exception 'PHASE_8B5_C_FAIL: wrong worker read Legal plan'; exception when sqlstate '55000' then null; end; end $wrong_worker$;
with x as (select public.get_messages_legal_disclosure_plan_v1((select job_id from phase8b5_c_state),'candidate-c-verifier') p) update phase8b5_c_state set plan=x.p from x;
with message_object as (
  select (item->>'legal_disclosure_object_id')::uuid legal_disclosure_object_id
  from jsonb_array_elements((select plan->'objects' from phase8b5_c_state)) item
  where item->>'object_kind'='message'
  limit 1
), x as (
  select public.get_messages_legal_disclosure_source_v1(
    (select job_id from phase8b5_c_state),'candidate-c-verifier',message_object.legal_disclosure_object_id
  ) p from message_object
) update phase8b5_c_state
set source_body=x.p#>>'{representation,body}',
    source_references=coalesce(x.p#>'{representation,resource_references}','[]'::jsonb)
from x;
with resource_object as (
  select (item->>'legal_disclosure_object_id')::uuid legal_disclosure_object_id
  from jsonb_array_elements((select plan->'objects' from phase8b5_c_state)) item
  where item->>'object_kind'='resource_version'
  limit 1
), x as (
  select public.get_messages_legal_disclosure_source_v1(
    (select job_id from phase8b5_c_state),'candidate-c-verifier',resource_object.legal_disclosure_object_id
  ) p from resource_object
) update phase8b5_c_state
set resource_source_version_id=x.p#>>'{representation,id}'
from x;
with result as (
  select jsonb_build_object(
    'manifest_text',(select manifest_text from phase8b5_c_state),
    'manifest_sha256',(select manifest_sha from phase8b5_c_state),
    'package_sha256',repeat('a',64),
    'package_byte_size',1234,
    'storage_path',(select plan->>'storage_path' from phase8b5_c_state),
    'objects',(
      select jsonb_agg(
        jsonb_build_object(
          'legal_disclosure_object_id',(item->>'legal_disclosure_object_id')::uuid,
          'output_path',item->>'output_path',
          'output_mime_type','application/json',
          'object_sha256',case when item->>'object_kind'='message' then repeat('b',64) else repeat('c',64) end,
          'object_byte_size',42
        )
        order by (item->>'manifest_order')::integer
      )
      from jsonb_array_elements((select plan->'objects' from phase8b5_c_state)) item
    )
  ) payload
) select public.complete_messages_legal_disclosure_job_v1(
  (select job_id from phase8b5_c_state),'candidate-c-verifier',result.payload
) from result;
reset role;
update phase8b5_c_state s set package_revision=p.revision from messaging.legal_disclosure_packages p where p.id=s.package_id;

do $resource_reference_assert$
declare
  v_refs jsonb:=(select source_references from phase8b5_c_state);
  v_selected_version text:=(select id::text from phase8b5_c_fixture where k='selected_resource_version');
  v_unselected_version text:=(select id::text from phase8b5_c_fixture where k='unselected_resource_version');
  v_resource_id text:=(select person_resource_id::text from phase8b5_c_people where k='super_admin');
begin
  if v_refs is null or jsonb_typeof(v_refs)<>'array' or jsonb_array_length(v_refs)<>1 then
    raise exception 'PHASE_8B5_C_FAIL: Legal Message did not emit exactly one separately selected exact Resource Version reference';
  end if;
  if v_refs#>>'{0,resource_id}'<>v_resource_id
     or v_refs#>>'{0,resource_version_id}'<>v_selected_version
     or v_refs#>>'{0,presentation_kind}'<>'version'
  then
    raise exception 'PHASE_8B5_C_FAIL: Legal Message emitted the wrong exact Resource Version identity envelope';
  end if;
  if v_refs::text like '%'||v_unselected_version||'%' then
    raise exception 'PHASE_8B5_C_FAIL: held but unselected Resource Version leaked into Legal Message representation';
  end if;
  if (select resource_source_version_id from phase8b5_c_state)<>v_selected_version then
    raise exception 'PHASE_8B5_C_FAIL: separately selected Resource Version source identity drifted';
  end if;
end
$resource_reference_assert$;

do $generated_assert$ begin if (select source_body from phase8b5_c_state)<>'Candidate C exact Message fixture' or jsonb_array_length((select plan->'objects' from phase8b5_c_state))<>2 then raise exception 'PHASE_8B5_C_FAIL: worker source widened or changed exact selection'; end if; if not exists(select 1 from messaging.legal_disclosure_packages p join media.assets a on a.id=p.package_asset_id join media.file_objects f on f.id=p.package_file_object_id where p.id=(select package_id from phase8b5_c_state) and p.status='generated' and a.asset_purpose='legal_disclosure' and f.verification_state='verified' and f.storage_provider='lightsail_media') then raise exception 'PHASE_8B5_C_FAIL: generated package lacks canonical restricted Media identity'; end if; end $generated_assert$;
do $legal_media_binding_assert$ begin
  if not exists(
    select 1
    from messaging.legal_disclosure_packages package
    join media.assets asset on asset.id=package.package_asset_id
    join media.asset_revisions revision
      on revision.id=package.package_asset_revision_id
     and revision.asset_id=asset.id
    join media.file_objects file_object
      on file_object.id=package.package_file_object_id
     and file_object.id=revision.original_file_object_id
    join media.asset_governance_versions governance
      on governance.id=asset.current_governance_version_id
     and governance.asset_id=asset.id
    where package.id=(select package_id from phase8b5_c_state)
      and package.status='generated'
      and asset.asset_kind='document'
      and asset.asset_purpose='legal_disclosure'
      and asset.lifecycle_state='active'
      and asset.current_revision_id=package.package_asset_revision_id
      and file_object.storage_path=messaging.legal_package_storage_path_v1(
        package.legal_request_case_id,
        package.id
      )
      and file_object.verification_state='verified'
      and governance.source_protection_class in ('restricted','confidential')
      and governance.preservation_state='preserved'
      and governance.retention_state='retain'
      and governance.public_safety_state='internal'
  ) then
    raise exception 'PHASE_8B5_C_FAIL: generated Legal package Media binding/governance is not canonical and restricted';
  end if;
  if exists(
    select 1
    from media.variants variant
    join messaging.legal_disclosure_packages package
      on package.id=(select package_id from phase8b5_c_state)
    where variant.asset_id=package.package_asset_id
       or variant.source_file_object_id=package.package_file_object_id
       or variant.derived_file_object_id=package.package_file_object_id
  ) then
    raise exception 'PHASE_8B5_C_FAIL: generated Legal package escaped into generic Media variants';
  end if;
  if exists(
    select 1
    from media.usage_links usage
    join messaging.legal_disclosure_packages package
      on package.id=(select package_id from phase8b5_c_state)
    where usage.asset_id=package.package_asset_id
  ) then
    raise exception 'PHASE_8B5_C_FAIL: generated Legal package escaped into generic Media usage';
  end if;
end $legal_media_binding_assert$;

select set_config(
  'request.jwt.claims',
  (select jsonb_build_object('sub',user_id::text,'role','authenticated')::text
   from phase8b5_c_people where k='ordinary_admin'),
  true
);
set local role authenticated;

do $ordinary_media_admin_fixture$ begin
  if not public.current_user_is_administrator() then
    raise exception 'PHASE_8B5_C_FAIL: ordinary Administrator fixture lacks generic Media administrator authority';
  end if;
end $ordinary_media_admin_fixture$;

do $ordinary_media_governance_denied$ begin
  begin
    perform public.create_media_governance_version(
      (select package_asset_id
       from messaging.legal_disclosure_packages
       where id=(select package_id from phase8b5_c_state)),
      (select asset.authority_revision
       from media.assets asset
       join messaging.legal_disclosure_packages package
         on package.package_asset_id=asset.id
       where package.id=(select package_id from phase8b5_c_state)),
      jsonb_build_object(
        'rights_status','owned',
        'consent_status','not_required',
        'sensitivity','none',
        'embargo_state','none',
        'source_protection_class','public',
        'preservation_state','unassessed',
        'retention_state','retain',
        'public_safety_state','approved_public'
      ),
      'Ordinary Media Administrator must not publicize a Legal disclosure package',
      null
    );
    raise exception 'PHASE_8B5_C_FAIL: ordinary Media Administrator changed Legal package governance';
  exception when sqlstate '42501' then null;
  end;
end $ordinary_media_governance_denied$;

do $ordinary_media_asset_mint_denied$ begin
  begin
    perform public.create_media_asset(
      'document',
      'legal_disclosure',
      'Unauthorized Legal disclosure Media asset',
      null,
      null
    );
    raise exception 'PHASE_8B5_C_FAIL: ordinary Media Administrator minted Legal disclosure Media identity';
  exception when sqlstate '42501' then null;
  end;
end $ordinary_media_asset_mint_denied$;

do $ordinary_media_revision_denied$ begin
  begin
    perform public.create_media_asset_revision(
      (select package_asset_id
       from messaging.legal_disclosure_packages
       where id=(select package_id from phase8b5_c_state)),
      (select asset.authority_revision
       from media.assets asset
       join messaging.legal_disclosure_packages package
         on package.package_asset_id=asset.id
       where package.id=(select package_id from phase8b5_c_state)),
      (select package_file_object_id
       from messaging.legal_disclosure_packages
       where id=(select package_id from phase8b5_c_state)),
      'Ordinary Media Administrator must not create another Legal package revision',
      null
    );
    raise exception 'PHASE_8B5_C_FAIL: ordinary Media Administrator created another Legal package revision';
  exception when sqlstate '42501' then null;
  end;
end $ordinary_media_revision_denied$;

reset role;
select set_config('request.jwt.claims',(select jsonb_build_object('sub',user_id::text,'role','authenticated')::text from phase8b5_c_people where k='super_admin'),true);
set local role authenticated;
do $delivery_before_release_denied$ begin
  begin
    perform public.get_messages_legal_disclosure_delivery_target_v1(
      (select package_id from phase8b5_c_state),
      'Premature package delivery',
      'phase8b5-c-delivery-denied-0001',
      null
    );
    raise exception 'PHASE_8B5_C_FAIL: generated but unreleased package was deliverable';
  exception when sqlstate '42501' then null;
  end;
end $delivery_before_release_denied$;
with x as (select public.release_messages_legal_disclosure_v1((select package_id from phase8b5_c_state),(select package_revision from phase8b5_c_state),'Controlled disclosure release','phase8b5-c-release-package-0001',null) p) update phase8b5_c_state set package_revision=(x.p->>'revision')::bigint from x;
with x as (
  select public.get_messages_legal_disclosure_delivery_target_v1(
    (select package_id from phase8b5_c_state),
    'Controlled released package delivery',
    'phase8b5-c-delivery-0001',
    null
  ) p
)
update phase8b5_c_state
set delivery_path=x.p->>'storage_path'
from x;
select public.get_messages_legal_disclosure_delivery_target_v1(
  (select package_id from phase8b5_c_state),
  'Controlled released package delivery',
  'phase8b5-c-delivery-0001',
  null
);
reset role;
do $delivery_assert$ begin
  if (select delivery_path from phase8b5_c_state) is distinct from messaging.legal_package_storage_path_v1(
       (select case_id from phase8b5_c_state),
       (select package_id from phase8b5_c_state)
     )
     or (select delivery_path from phase8b5_c_state) !~ '^private-files/legal-disclosures/'
  then
    raise exception 'PHASE_8B5_C_FAIL: released package delivery path is not the exact private Legal path';
  end if;
  if (select count(*) from messaging.legal_case_events
      where legal_request_case_id=(select case_id from phase8b5_c_state)
        and legal_disclosure_package_id=(select package_id from phase8b5_c_state)
        and event_kind='evidence_viewed'
        and metadata->>'operation'='released_legal_package_delivery'
        and metadata->>'purpose'='Controlled released package delivery')<>1
  then
    raise exception 'PHASE_8B5_C_FAIL: idempotent Legal package delivery audit history is incorrect';
  end if;
  if exists(
    select 1 from messaging.legal_case_events
    where legal_request_case_id=(select case_id from phase8b5_c_state)
      and metadata::text ~* 'https?://'
  ) then
    raise exception 'PHASE_8B5_C_FAIL: Legal event metadata contains a signed or absolute URL';
  end if;
end $delivery_assert$;
select set_config('request.jwt.claims',(select jsonb_build_object('sub',user_id::text,'role','authenticated')::text from phase8b5_c_people where k='ordinary_admin'),true);
set local role authenticated;
do $ordinary_delivery_denial$ begin
  begin
    perform public.get_messages_legal_disclosure_delivery_target_v1(
      (select package_id from phase8b5_c_state),
      'Ordinary Administrator must not deliver Legal package',
      'phase8b5-c-ordinary-delivery-denied-0001',
      null
    );
    raise exception 'PHASE_8B5_C_FAIL: ordinary Administrator delivered a Legal package';
  exception when sqlstate '42501' then null;
  end;
end $ordinary_delivery_denial$;
reset role;
select set_config('request.jwt.claims',(select jsonb_build_object('sub',user_id::text,'role','authenticated')::text from phase8b5_c_people where k='super_admin'),true);
set local role authenticated;
do $generic_delivery_denial$ begin
  begin
    perform public.get_media_private_delivery_target_v1(
      (
        (
          public.get_messages_legal_disclosure_package_v1(
            (select package_id from phase8b5_c_state)
          )->'package'->>'package_file_object_id'
        )::uuid
      )
    );
    raise exception 'PHASE_8B5_C_FAIL: generic Media private delivery retrieved a Legal package';
  exception when sqlstate '55000' then null;
  end;
end $generic_delivery_denial$;
with x as (select public.update_messages_legal_scope_v1((select case_id from phase8b5_c_state),'release',(select scope_id from phase8b5_c_state),null,null,null,null,null,null,null,null,(select case_revision from phase8b5_c_state),'Scope duty ended','phase8b5-c-release-scope-0001',null) p) update phase8b5_c_state set case_revision=(x.p->>'case_revision')::bigint from x;
with x as (select public.update_messages_legal_scope_v1((select case_id from phase8b5_c_state),'release',(select selected_resource_scope_id from phase8b5_c_state),null,null,null,null,null,null,null,null,(select case_revision from phase8b5_c_state),'Selected Resource Version scope duty ended','phase8b5-c-release-selected-resource-scope-0001',null) p) update phase8b5_c_state set case_revision=(x.p->>'case_revision')::bigint from x;
with x as (select public.update_messages_legal_scope_v1((select case_id from phase8b5_c_state),'release',(select unselected_resource_scope_id from phase8b5_c_state),null,null,null,null,null,null,null,null,(select case_revision from phase8b5_c_state),'Unselected Resource Version scope duty ended','phase8b5-c-release-unselected-resource-scope-0001',null) p) update phase8b5_c_state set case_revision=(x.p->>'case_revision')::bigint from x;
with x as (select public.release_messages_legal_preservation_v1((select case_id from phase8b5_c_state),(select preserved_object_id from phase8b5_c_state),(select object_revision from phase8b5_c_state),'Preservation duty ended','phase8b5-c-release-object-0001',null) p) update phase8b5_c_state set object_revision=(x.p->>'revision')::bigint from x;
with x as (select public.release_messages_legal_preservation_v1((select case_id from phase8b5_c_state),(select selected_resource_preserved_object_id from phase8b5_c_state),(select selected_resource_object_revision from phase8b5_c_state),'Selected Resource Version preservation duty ended','phase8b5-c-release-selected-resource-object-0001',null) p) update phase8b5_c_state set selected_resource_object_revision=(x.p->>'revision')::bigint from x;
with x as (select public.release_messages_legal_preservation_v1((select case_id from phase8b5_c_state),(select unselected_resource_preserved_object_id from phase8b5_c_state),(select unselected_resource_object_revision from phase8b5_c_state),'Unselected Resource Version preservation duty ended','phase8b5-c-release-unselected-resource-object-0001',null) p) update phase8b5_c_state set unselected_resource_object_revision=(x.p->>'revision')::bigint from x;
with x as (select public.close_messages_legal_request_case_v1((select case_id from phase8b5_c_state),(select case_revision from phase8b5_c_state),'Candidate C rollback verifier complete','phase8b5-c-close-0001',null) p) update phase8b5_c_state set case_revision=(x.p->>'revision')::bigint from x;
reset role;
do $final_assert$
begin
  if (select status from messaging.legal_request_cases where id=(select case_id from phase8b5_c_state))<>'closed'
     or (select status from messaging.legal_preservation_scopes where id=(select scope_id from phase8b5_c_state))<>'released'
     or (select status from messaging.legal_preservation_scopes where id=(select selected_resource_scope_id from phase8b5_c_state))<>'released'
     or (select status from messaging.legal_preservation_scopes where id=(select unselected_resource_scope_id from phase8b5_c_state))<>'released'
     or (select preservation_status from messaging.legal_preserved_objects where id=(select preserved_object_id from phase8b5_c_state))<>'released'
     or (select preservation_status from messaging.legal_preserved_objects where id=(select selected_resource_preserved_object_id from phase8b5_c_state))<>'released'
     or (select preservation_status from messaging.legal_preserved_objects where id=(select unselected_resource_preserved_object_id from phase8b5_c_state))<>'released'
     or (select status from messaging.legal_disclosure_packages where id=(select package_id from phase8b5_c_state))<>'released'
  then
    raise exception 'PHASE_8B5_C_FAIL: final Legal recovery/closure state is incomplete';
  end if;
end
$final_assert$;
select 'PASS'::text as verification,(select count(*) from supabase_migrations.schema_migrations)::int as migration_count,(select max(version) from supabase_migrations.schema_migrations) as migration_head,1::int as legal_cases,1::int as preserved_objects,1::int as packages,(select count(*) from messaging.legal_case_events where legal_request_case_id=(select case_id from phase8b5_c_state))::int as legal_events;
rollback;
