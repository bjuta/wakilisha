-- Permanent rollback-only verifier for Phase 8B.4 Candidate B.
-- Proves Field contact-policy convergence, governed newsroom -> contributor
-- Messages start, exact Resource reference, workflow-scoped reply under internal
-- audience, idempotency, privilege boundaries, current-policy revocation, and
-- no Field authority leakage through Conversation membership.

begin;

set constraints all deferred;

do $structural$
declare
  v_send_definition text;
  v_access_definition text;
  v_scope_definition text;
  v_bridge_definition text;
begin
  if (select count(*) from supabase_migrations.schema_migrations) < 108
     or not exists(select 1 from supabase_migrations.schema_migrations where version='20260907075239' and name='phase_8b4_field_messages')
     or not exists(select 1 from supabase_migrations.schema_migrations where version='20260907075350' and name='phase_8b4_field_messages_uuid_resolution_fix')
     or not exists(select 1 from supabase_migrations.schema_migrations where version='20260907075655' and name='phase_8b4_field_messages_hardening')
     or not exists(select 1 from supabase_migrations.schema_migrations where version='20260907075816' and name='phase_8b4_field_messages_scope_policy_guard') then
    raise exception 'PHASE_8B4_FIELD_FAIL: Candidate B migration authority is incomplete';
  end if;

  if not exists(select 1 from information_schema.columns where table_schema='editorial' and table_name='field_submissions' and column_name='follow_up_permission' and is_nullable='NO')
     or not exists(select 1 from information_schema.columns where table_schema='editorial' and table_name='field_submissions' and column_name='preferred_contact_channel')
     or not exists(select 1 from information_schema.columns where table_schema='editorial' and table_name='field_submissions' and column_name='contact_point_id') then
    raise exception 'PHASE_8B4_FIELD_FAIL: Field contact-policy columns are incomplete';
  end if;

  if not exists(select 1 from platform_private.command_types where command_type='field.submission.contact_policy.update' and enabled)
     or not exists(select 1 from platform_private.command_types where command_type='field.submission.message.start' and enabled) then
    raise exception 'PHASE_8B4_FIELD_FAIL: Candidate B command vocabulary is incomplete';
  end if;

  if to_regprocedure('public.create_field_submission_v2(jsonb,text,uuid)') is null
     or to_regprocedure('public.update_field_submission_contact_policy_v1(uuid,bigint,text,text,text,uuid)') is null
     or to_regprocedure('public.list_field_submission_intakes_v1(integer)') is null
     or to_regprocedure('public.get_field_submission_intake_v2(uuid)') is null
     or to_regprocedure('public.start_field_submission_message_v1(uuid,bigint,text,text,uuid,timestamptz)') is null
     or to_regprocedure('messaging.field_submission_conversation_scope(uuid,uuid)') is null then
    raise exception 'PHASE_8B4_FIELD_FAIL: Candidate B functions are incomplete';
  end if;

  if has_function_privilege('anon','public.start_field_submission_message_v1(uuid,bigint,text,text,uuid,timestamptz)','EXECUTE')
     or has_function_privilege('service_role','public.start_field_submission_message_v1(uuid,bigint,text,text,uuid,timestamptz)','EXECUTE')
     or not has_function_privilege('authenticated','public.start_field_submission_message_v1(uuid,bigint,text,text,uuid,timestamptz)','EXECUTE') then
    raise exception 'PHASE_8B4_FIELD_FAIL: Field Messages bridge privilege boundary drifted';
  end if;

  if (select audience_mode from messaging.runtime_policy where singleton)<>'internal' then
    raise exception 'PHASE_8B4_FIELD_FAIL: global Messages audience broadened';
  end if;

  v_send_definition:=pg_get_functiondef('public.send_message(uuid,text,jsonb,text,uuid,timestamptz)'::regprocedure);
  v_access_definition:=pg_get_functiondef('public.get_my_message_access()'::regprocedure);
  v_scope_definition:=pg_get_functiondef('messaging.field_submission_conversation_scope(uuid,uuid)'::regprocedure);
  v_bridge_definition:=pg_get_functiondef('public.start_field_submission_message_v1(uuid,bigint,text,text,uuid,timestamptz)'::regprocedure);

  if position('allow_human_reply' in v_send_definition)=0
     or position('field_submission_conversation_scope' in v_send_definition)=0 then
    raise exception 'PHASE_8B4_FIELD_FAIL: send_message lost Candidate A or Candidate B guard';
  end if;
  if position('can_start' in v_access_definition)=0
     or position('has_field_scope' in v_access_definition)=0 then
    raise exception 'PHASE_8B4_FIELD_FAIL: Messages access projection lacks scoped-start split';
  end if;
  if position('follow_up_permission' in v_scope_definition)=0
     or position('preferred_contact_channel' in v_scope_definition)=0
     or position('count(*)' in v_scope_definition)=0 then
    raise exception 'PHASE_8B4_FIELD_FAIL: Field Conversation scope is not current-policy constrained';
  end if;
  if position('view_field_intake' in v_bridge_definition)=0
     or position('view_restricted_field_sources' in v_bridge_definition)=0
     or position('expected_submission_revision' in v_bridge_definition)=0 then
    raise exception 'PHASE_8B4_FIELD_FAIL: newsroom bridge authorization drifted';
  end if;
end
$structural$;

do $fixture$
declare
  v_editor uuid:=gen_random_uuid();
  v_contributor uuid:=gen_random_uuid();
  v_author uuid:=gen_random_uuid();
  v_retired uuid:=gen_random_uuid();
begin
  create temporary table phase8b4_field_fixture(
    editor_id uuid,
    contributor_id uuid,
    author_id uuid,
    retired_id uuid,
    editor_person uuid,
    contributor_person uuid,
    author_person uuid,
    retired_person uuid,
    field_resource_id uuid,
    alternate_field_resource_id uuid,
    retired_field_resource_id uuid,
    conversation_id uuid,
    message_id uuid,
    receipt_id uuid
  ) on commit drop;

  insert into phase8b4_field_fixture(editor_id,contributor_id,author_id,retired_id,field_resource_id,alternate_field_resource_id,retired_field_resource_id)
  values(v_editor,v_contributor,v_author,v_retired,gen_random_uuid(),gen_random_uuid(),gen_random_uuid());

  insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_sso_user,is_anonymous)
  values
    (v_editor,'authenticated','authenticated','phase8b4-field-editor@example.invalid',jsonb_build_object('provider','email','providers',jsonb_build_array('email')),jsonb_build_object('name','Phase 8B4 Field Editor'),now(),now(),false,false),
    (v_contributor,'authenticated','authenticated','phase8b4-field-contributor@example.invalid',jsonb_build_object('provider','email','providers',jsonb_build_array('email')),jsonb_build_object('name','Phase 8B4 Field Contributor'),now(),now(),false,false),
    (v_author,'authenticated','authenticated','phase8b4-field-author@example.invalid',jsonb_build_object('provider','email','providers',jsonb_build_array('email')),jsonb_build_object('name','Phase 8B4 Field Author'),now(),now(),false,false),
    (v_retired,'authenticated','authenticated','phase8b4-field-retired@example.invalid',jsonb_build_object('provider','email','providers',jsonb_build_array('email')),jsonb_build_object('name','Phase 8B4 Field Retired'),now(),now(),false,false);
end
$fixture$;

set constraints all immediate;
set constraints all deferred;

insert into public.user_role_assignments(user_id,role_key,status,assigned_by,assigned_at,notes,created_at,updated_at)
select editor_id,'editor','active',null::uuid,now(),'Phase 8B.4 rollback verifier',now(),now() from phase8b4_field_fixture
union all
select contributor_id,'field_contributor','active',null::uuid,now(),'Phase 8B.4 rollback verifier',now(),now() from phase8b4_field_fixture
union all
select author_id,'author','active',null::uuid,now(),'Phase 8B.4 rollback verifier',now(),now() from phase8b4_field_fixture
union all
select retired_id,'field_contributor','active',null::uuid,now(),'Phase 8B.4 rollback verifier',now(),now() from phase8b4_field_fixture;

update phase8b4_field_fixture f set editor_person=l.person_resource_id from editorial.person_identity_links l where l.user_id=f.editor_id and l.link_state='active';
update phase8b4_field_fixture f set contributor_person=l.person_resource_id from editorial.person_identity_links l where l.user_id=f.contributor_id and l.link_state='active';
update phase8b4_field_fixture f set author_person=l.person_resource_id from editorial.person_identity_links l where l.user_id=f.author_id and l.link_state='active';
update phase8b4_field_fixture f set retired_person=l.person_resource_id from editorial.person_identity_links l where l.user_id=f.retired_id and l.link_state='active';

do $identity_assert$
begin
  if exists(select 1 from phase8b4_field_fixture where editor_person is null or contributor_person is null or author_person is null or retired_person is null) then
    raise exception 'PHASE_8B4_FIELD_FAIL: fixture canonical Person provisioning failed';
  end if;
end
$identity_assert$;

insert into editorial.resources(id,resource_kind,owner_id,visibility,lifecycle_state,created_by)
select field_resource_id,'field_submission',contributor_id,'private','active',contributor_id from phase8b4_field_fixture
union all
select alternate_field_resource_id,'field_submission',contributor_id,'private','active',contributor_id from phase8b4_field_fixture
union all
select retired_field_resource_id,'field_submission',retired_id,'private','active',retired_id from phase8b4_field_fixture;

insert into editorial.field_submissions(
  resource_id,resource_kind,submission_reference,owner_user_id,submitter_mode,current_revision,submission_state,
  newsroom_identity_mode,public_attribution_preference,contact_preference,follow_up_permission,preferred_contact_channel,
  rights_declaration,consent_declaration,declared_sensitivity,source_protection_request,embargo_request_mode,location_mode,
  created_by,updated_by,received_at,correlation_id
)
select field_resource_id,'field_submission','FS-20260907-A1B2C3D4E5',contributor_id,'authenticated',1,'received','standard','do_not_name','account_contact','allowed','messages','owns_or_controls','granted','none','internal','none','not_collected',contributor_id,contributor_id,now(),gen_random_uuid() from phase8b4_field_fixture
union all
select alternate_field_resource_id,'field_submission','FS-20260907-A1B2C3D4E6',contributor_id,'authenticated',1,'received','standard','do_not_name','account_contact','allowed','email','owns_or_controls','granted','none','internal','none','not_collected',contributor_id,contributor_id,now(),gen_random_uuid() from phase8b4_field_fixture
union all
select retired_field_resource_id,'field_submission','FS-20260907-A1B2C3D4E7',retired_id,'authenticated',1,'received','standard','do_not_name','account_contact','allowed','messages','owns_or_controls','granted','none','internal','none','not_collected',retired_id,retired_id,now(),gen_random_uuid() from phase8b4_field_fixture;

update editorial.person_identity_links
set link_state='retired',updated_at=now()
where user_id=(select retired_id from phase8b4_field_fixture)
  and person_resource_id=(select retired_person from phase8b4_field_fixture)
  and link_state='active';

grant select,update on phase8b4_field_fixture to authenticated;

select set_config('request.jwt.claims',(select jsonb_build_object('sub',editor_id::text,'role','authenticated')::text from phase8b4_field_fixture),true);
set local role authenticated;

do $stale_revision$
begin
  begin
    perform * from public.start_field_submission_message_v1((select field_resource_id from phase8b4_field_fixture),99,'Stale attempt must fail','phase8b4-field-stale-0001',null,null);
    raise exception 'PHASE_8B4_FIELD_FAIL: stale Field revision was accepted';
  exception when sqlstate '40001' then null;
  end;
end
$stale_revision$;

do $wrong_channel$
begin
  begin
    perform * from public.start_field_submission_message_v1((select alternate_field_resource_id from phase8b4_field_fixture),1,'Email-selected intake must not become a Message','phase8b4-field-channel-0001',null,null);
    raise exception 'PHASE_8B4_FIELD_FAIL: non-Messages preferred channel was accepted';
  exception when sqlstate '42501' then null;
  end;
end
$wrong_channel$;

do $retired_identity$
begin
  begin
    perform * from public.start_field_submission_message_v1((select retired_field_resource_id from phase8b4_field_fixture),1,'Retired identity must fail','phase8b4-field-retired-0001',null,null);
    raise exception 'PHASE_8B4_FIELD_FAIL: retired contributor identity was accepted';
  exception when sqlstate '42501' then null;
  end;
end
$retired_identity$;

with started as (
  select * from public.start_field_submission_message_v1((select field_resource_id from phase8b4_field_fixture),1,'Could you share a little more context for the newsroom?','phase8b4-field-start-0001',null,null)
)
update phase8b4_field_fixture f
set conversation_id=s.conversation_id,message_id=s.message_id,receipt_id=s.command_receipt_id
from started s;

create temporary table phase8b4_field_replay as
select * from public.start_field_submission_message_v1((select field_resource_id from phase8b4_field_fixture),1,'Could you share a little more context for the newsroom?','phase8b4-field-start-0001',null,null);

create temporary table phase8b4_editor_detail as
select public.get_my_message_conversation((select conversation_id from phase8b4_field_fixture),null,null,50) as payload;

do $mismatch$
begin
  begin
    perform * from public.start_field_submission_message_v1((select field_resource_id from phase8b4_field_fixture),1,'Changed body must fail','phase8b4-field-start-0001',null,null);
    raise exception 'PHASE_8B4_FIELD_FAIL: changed idempotent request was accepted';
  exception when unique_violation then null;
  end;
end
$mismatch$;

reset role;

select set_config('request.jwt.claims',(select jsonb_build_object('sub',contributor_id::text,'role','authenticated')::text from phase8b4_field_fixture),true);
set local role authenticated;
create temporary table phase8b4_contributor_access as select public.get_my_message_access() as payload;
create temporary table phase8b4_contributor_detail as select public.get_my_message_conversation((select conversation_id from phase8b4_field_fixture),null,null,50) as payload;
create temporary table phase8b4_contributor_search as select count(*)::int as result_count from public.search_message_recipients('phase',8);
create temporary table phase8b4_contributor_reply as
select * from public.send_message((select conversation_id from phase8b4_field_fixture),'Thanks. I can add more context here.','[]'::jsonb,'phase8b4-field-reply-0001',null,null);

do $contributor_cannot_bridge$
begin
  begin
    perform * from public.start_field_submission_message_v1((select field_resource_id from phase8b4_field_fixture),1,'Contributor cannot invoke newsroom bridge','phase8b4-field-contributor-bridge-0001',null,null);
    raise exception 'PHASE_8B4_FIELD_FAIL: contributor invoked newsroom bridge';
  exception when sqlstate '42501' then null;
  end;
end
$contributor_cannot_bridge$;
reset role;

select set_config('request.jwt.claims',(select jsonb_build_object('sub',author_id::text,'role','authenticated')::text from phase8b4_field_fixture),true);
set local role authenticated;
do $unauthorized_bridge$
begin
  begin
    perform * from public.start_field_submission_message_v1((select field_resource_id from phase8b4_field_fixture),1,'Unauthorized newsroom attempt','phase8b4-field-author-0001',null,null);
    raise exception 'PHASE_8B4_FIELD_FAIL: staff user without view_field_intake was accepted';
  exception when sqlstate '42501' then null;
  end;
end
$unauthorized_bridge$;
reset role;

insert into messaging.conversation_participants(conversation_id,actor_kind,person_resource_id,user_id,membership_status,mailbox_folder,first_contact_state)
select conversation_id,'human',author_person,author_id,'active','inbox','accepted' from phase8b4_field_fixture;

select set_config('request.jwt.claims',(select jsonb_build_object('sub',author_id::text,'role','authenticated')::text from phase8b4_field_fixture),true);
set local role authenticated;
create temporary table phase8b4_author_detail as select public.get_my_message_conversation((select conversation_id from phase8b4_field_fixture),null,null,50) as payload;
reset role;

delete from messaging.conversation_participants where conversation_id=(select conversation_id from phase8b4_field_fixture) and user_id=(select author_id from phase8b4_field_fixture);

update editorial.field_submissions f
set follow_up_permission='not_allowed',preferred_contact_channel=null,contact_point_id=null,current_revision=f.current_revision+1,updated_by=f.owner_user_id,updated_at=now()
where f.resource_id=(select field_resource_id from phase8b4_field_fixture);

select set_config('request.jwt.claims',(select jsonb_build_object('sub',contributor_id::text,'role','authenticated')::text from phase8b4_field_fixture),true);
set local role authenticated;
do $revoked_scope$
begin
  begin
    perform * from public.send_message((select conversation_id from phase8b4_field_fixture),'This must fail after contact revocation.','[]'::jsonb,'phase8b4-field-reply-0002',null,null);
    raise exception 'PHASE_8B4_FIELD_FAIL: Field contact revocation did not kill scoped send';
  exception when sqlstate '42501' then null;
  end;
end
$revoked_scope$;
reset role;

do $assertions$
declare
  v_replay boolean;
  v_message_count integer;
  v_ref_count integer;
  v_notification_count integer;
  v_access jsonb;
  v_editor_detail jsonb;
  v_contributor_detail jsonb;
  v_author_detail jsonb;
  v_search integer;
  v_receipt_principal text;
begin
  select idempotent_replay into v_replay from phase8b4_field_replay;
  select count(*) into v_message_count from messaging.messages m join phase8b4_field_fixture f on m.conversation_id=f.conversation_id;
  select count(*) into v_ref_count from messaging.message_resource_references r join phase8b4_field_fixture f on r.message_id=f.message_id and r.resource_id=f.field_resource_id and r.resource_version_id is null and r.presentation_kind='resource';
  select count(*) into v_notification_count from public.community_notifications n join phase8b4_field_fixture f on n.user_id=f.contributor_id and n.entity_id=f.message_id::text where n.notification_type='direct_message' and n.actor_id=f.editor_id and not(n.metadata ? 'body');
  select payload into v_access from phase8b4_contributor_access;
  select payload into v_editor_detail from phase8b4_editor_detail;
  select payload into v_contributor_detail from phase8b4_contributor_detail;
  select payload into v_author_detail from phase8b4_author_detail;
  select result_count into v_search from phase8b4_contributor_search;
  select r.principal_key into v_receipt_principal from platform_private.command_receipts r join phase8b4_field_fixture f on r.id=f.receipt_id;

  if v_replay is distinct from true then raise exception 'PHASE_8B4_FIELD_FAIL: bridge replay was not idempotent'; end if;
  if v_message_count<>2 then raise exception 'PHASE_8B4_FIELD_FAIL: expected first Message plus contributor reply, got %',v_message_count; end if;
  if v_ref_count<>1 then raise exception 'PHASE_8B4_FIELD_FAIL: exact Field Resource reference count was %',v_ref_count; end if;
  if v_notification_count<>1 then raise exception 'PHASE_8B4_FIELD_FAIL: safe contributor notification count was %',v_notification_count; end if;
  if v_receipt_principal<>(select 'user:'||editor_id::text from phase8b4_field_fixture) then raise exception 'PHASE_8B4_FIELD_FAIL: bridge receipt principal mismatch %',v_receipt_principal; end if;
  if v_access->>'audience_mode'<>'internal' or (v_access->>'can_start')::boolean or not (v_access->>'can_send')::boolean then raise exception 'PHASE_8B4_FIELD_FAIL: contributor scoped access projection invalid %',v_access; end if;
  if v_search<>0 then raise exception 'PHASE_8B4_FIELD_FAIL: contributor recipient search broadened under internal audience'; end if;
  if jsonb_array_length(v_editor_detail->'messages'->0->'resource_references')<>1 then raise exception 'PHASE_8B4_FIELD_FAIL: authorized newsroom Resource reference missing'; end if;
  if jsonb_array_length(v_contributor_detail->'messages'->0->'resource_references')<>1 then raise exception 'PHASE_8B4_FIELD_FAIL: contributor owner Resource reference missing'; end if;
  if exists(select 1 from jsonb_array_elements(v_author_detail->'messages') m where jsonb_array_length(coalesce(m->'resource_references','[]'::jsonb))>0) then raise exception 'PHASE_8B4_FIELD_FAIL: Conversation membership leaked Field Resource reference'; end if;
end
$assertions$;

rollback;
select 'PHASE_8B4_FIELD_MESSAGES_VERIFIER_PASS' as result;
