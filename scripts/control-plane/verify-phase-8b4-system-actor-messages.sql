-- Permanent verifier for Phase 8B.4 Candidate A.
-- Proves accountable System Actor principal, scoped MIZIZI send, idempotency,
-- safe notification projection, mixed-actor reads, blocked human reply,
-- Super Admin recipient scope, and Messages-only kill-control isolation.

begin;

set constraints all deferred;

do $fixture$
declare
  v_admin uuid:=gen_random_uuid();
  v_member uuid:=gen_random_uuid();
begin
  create temporary table phase8b4_fixture(
    admin_id uuid,
    member_id uuid,
    admin_person uuid,
    member_person uuid,
    conversation_id uuid,
    message_id uuid,
    receipt_id uuid
  ) on commit drop;

  insert into phase8b4_fixture(admin_id,member_id)
  values(v_admin,v_member);

  insert into auth.users(
    id,aud,role,email,raw_app_meta_data,raw_user_meta_data,
    created_at,updated_at,is_sso_user,is_anonymous
  )
  values
  (
    v_admin,
    'authenticated',
    'authenticated',
    'phase8b4-admin@example.invalid',
    jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
    jsonb_build_object('name','Phase 8B4 Admin'),
    now(),now(),false,false
  ),
  (
    v_member,
    'authenticated',
    'authenticated',
    'phase8b4-member@example.invalid',
    jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
    jsonb_build_object('name','Phase 8B4 Member'),
    now(),now(),false,false
  );
end
$fixture$;

set constraints all immediate;
set constraints all deferred;

insert into public.user_role_assignments(
  user_id,role_key,status,assigned_by,assigned_at,notes,created_at,updated_at
)
select
  admin_id,'super_admin','active',null::uuid,now(),
  'Phase 8B.4 rollback-only verifier',now(),now()
from phase8b4_fixture
union all
select
  member_id,'member','active',null::uuid,now(),
  'Phase 8B.4 rollback-only verifier',now(),now()
from phase8b4_fixture;

update phase8b4_fixture f
set admin_person=l.person_resource_id
from editorial.person_identity_links l
where l.user_id=f.admin_id and l.link_state='active';

update phase8b4_fixture f
set member_person=l.person_resource_id
from editorial.person_identity_links l
where l.user_id=f.member_id and l.link_state='active';

do $identity_assert$
begin
  if exists(
    select 1 from phase8b4_fixture
    where admin_person is null or member_person is null
  ) then
    raise exception 'STOP: fixture Person identity missing';
  end if;
end
$identity_assert$;

with sent as (
  select *
  from platform_private.send_system_message(
    'mizizi',
    (select admin_person from phase8b4_fixture),
    'operational_update',
    'MIZIZI rollback-only operational update',
    '[]'::jsonb,
    'phase8b4-system-send-0001',
    null,
    null
  )
)
update phase8b4_fixture f
set
  conversation_id=s.conversation_id,
  message_id=s.message_id,
  receipt_id=s.command_receipt_id
from sent s;

create temporary table phase8b4_replay as
select *
from platform_private.send_system_message(
  'mizizi',
  (select admin_person from phase8b4_fixture),
  'operational_update',
  'MIZIZI rollback-only operational update',
  '[]'::jsonb,
  'phase8b4-system-send-0001',
  null,
  null
);

do $system_assert$
declare
  v_messages integer;
  v_notifications integer;
  v_principal text;
  v_replay boolean;
begin
  select count(*) into v_messages
  from messaging.messages m
  join phase8b4_fixture f on m.id=f.message_id;

  select count(*) into v_notifications
  from public.community_notifications n
  join phase8b4_fixture f
    on n.user_id=f.admin_id
   and n.entity_id=f.message_id::text
  where n.notification_type='direct_message'
    and n.actor_id is null
    and n.metadata->>'sender_actor_key'='mizizi'
    and n.metadata->>'sender_display_name'='MIZIZI Cultural Data Steward'
    and not(n.metadata ? 'body');

  select r.principal_key into v_principal
  from platform_private.command_receipts r
  join phase8b4_fixture f on r.id=f.receipt_id;

  select idempotent_replay into v_replay
  from phase8b4_replay;

  if v_messages<>1
     or v_notifications<>1
     or v_principal<>'system:mizizi'
     or v_replay is distinct from true
  then
    raise exception
      'STOP: system send assertion failed messages=% notifications=% principal=% replay=%',
      v_messages,v_notifications,v_principal,v_replay;
  end if;
end
$system_assert$;

do $scope_assert$
begin
  begin
    perform *
    from platform_private.send_system_message(
      'mizizi',
      (select member_person from phase8b4_fixture),
      'operational_update',
      'Denied recipient',
      '[]'::jsonb,
      'phase8b4-system-send-0002',
      null,
      null
    );
    raise exception 'STOP: non-Super-Admin scope rejection did not fire';
  exception when sqlstate '42501' then
    null;
  end;
end
$scope_assert$;

grant select on phase8b4_fixture to authenticated;

select set_config(
  'request.jwt.claims',
  (
    select jsonb_build_object(
      'sub',admin_id::text,
      'role','authenticated'
    )::text
    from phase8b4_fixture
  ),
  true
);

set local role authenticated;

create temporary table phase8b4_list_result as
select public.list_my_message_conversations('inbox',null,null,30) as payload;

create temporary table phase8b4_detail_result as
select public.get_my_message_conversation(
  (select conversation_id from phase8b4_fixture),
  null,
  null,
  50
) as payload;

do $reply_block$
begin
  begin
    perform *
    from public.send_message(
      (select conversation_id from phase8b4_fixture),
      'Human reply must fail',
      null,
      'phase8b4-human-reply-0001',
      null,
      null
    );
    raise exception 'STOP: human reply rejection did not fire';
  exception when sqlstate '42501' then
    null;
  end;
end
$reply_block$;

create temporary table phase8b4_agents_before as
select public.get_messages_system_actors() as payload;

create temporary table phase8b4_disable as
select public.set_messages_system_actor_enabled(
  'mizizi',
  1,
  false,
  'phase8b4-disable-0001',
  null
) as payload;

reset role;

do $read_admin_assert$
declare
  v_list jsonb;
  v_detail jsonb;
  v_agents jsonb;
  v_disable jsonb;
begin
  select payload into v_list from phase8b4_list_result;
  select payload into v_detail from phase8b4_detail_result;
  select payload into v_agents from phase8b4_agents_before;
  select payload into v_disable from phase8b4_disable;

  if v_list->0->'other_participant'->>'actor_key'<>'mizizi'
     or v_list->0->'other_participant'->'presentation'->>'label'<>
        'MIZIZI Cultural Data Steward'
  then
    raise exception 'STOP: list projection failed: %',v_list;
  end if;

  if not exists(
    select 1
    from jsonb_array_elements(v_detail->'participants') participant
    where participant->>'actor_key'='mizizi'
      and participant->'presentation'->>'label'=
          'MIZIZI Cultural Data Steward'
  ) then
    raise exception 'STOP: detail projection failed: %',v_detail;
  end if;

  if v_agents->0->>'actor_key'<>'mizizi'
     or (v_agents->0->>'messaging_enabled')::boolean is distinct from true
  then
    raise exception 'STOP: Agents read failed: %',v_agents;
  end if;

  if (v_disable->>'messaging_enabled')::boolean is distinct from false
     or (v_disable->>'revision')::bigint<>2
  then
    raise exception 'STOP: Messages kill control failed: %',v_disable;
  end if;
end
$read_admin_assert$;

do $kill_assert$
begin
  if (
    select status
    from platform_private.system_actors
    where actor_key='mizizi'
  )<>'active'
  then
    raise exception 'STOP: Messages kill control changed actor identity status';
  end if;

  begin
    perform *
    from platform_private.send_system_message(
      'mizizi',
      (select admin_person from phase8b4_fixture),
      'operational_update',
      'Must be blocked while messaging disabled',
      '[]'::jsonb,
      'phase8b4-system-send-0003',
      null,
      null
    );
    raise exception 'STOP: disabled messaging rejection did not fire';
  exception when sqlstate '42501' then
    null;
  end;
end
$kill_assert$;

select jsonb_build_object(
  'verification','PASS',
  'system_principal','system:mizizi',
  'idempotent_replay',true,
  'notification_actor_id',null,
  'notification_body_projected',false,
  'mixed_actor_projection','pass',
  'human_reply_blocked',true,
  'non_super_admin_recipient_blocked',true,
  'messages_kill_control','pass',
  'actor_identity_remains_active',true,
  'fixture_persistence','rollback-only'
) as phase_8b4_candidate_a_verification;

rollback;
