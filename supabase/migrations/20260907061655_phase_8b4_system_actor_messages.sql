-- Phase 8B.4 Candidate A: accountable System Actors + governed System Messages.
--
-- Reuses canonical Messages, command receipts, Notifications, Person identity,
-- and Super Admin authority. No second scheduler/jobs/outbox/notification store.

begin;
set local statement_timeout='180s';
set local lock_timeout='5s';
select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('phase-8b4-system-actor-messages',0));

do $preflight$
begin
  if to_regclass('messaging.messages') is null
     or to_regclass('messaging.conversation_participants') is null
     or to_regclass('messaging.sender_approvals') is null
     or to_regclass('platform_private.command_receipts') is null
     or to_regclass('platform_private.command_types') is null
     or to_regclass('public.community_notifications') is null
     or to_regprocedure('platform_private.begin_authenticated_resource_command(text,uuid,text,jsonb)') is null
     or to_regprocedure('platform_private.command_request_fingerprint(text,uuid,jsonb)') is null
     or to_regprocedure('platform_private.complete_resource_command(uuid,jsonb)') is null
     or to_regprocedure('messaging.emit_direct_message_notification()') is null
  then
    raise exception 'STOP: accepted Messages/platform authority is missing';
  end if;
  if to_regclass('platform_private.system_actors') is not null
     or to_regprocedure('platform_private.send_system_message(text,uuid,text,text,jsonb,text,uuid,timestamp with time zone)') is not null
  then
    raise exception 'STOP: Candidate A authority already exists';
  end if;
end
$preflight$;

create table platform_private.system_actors (
  actor_key text primary key,
  label text not null,
  actor_kind text not null default 'system',
  status text not null default 'active',
  capability_profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint system_actors_key_check check (actor_key ~ '^[a-z][a-z0-9_.:-]{1,99}$'),
  constraint system_actors_label_check check (btrim(label)<>'' and octet_length(label)<=160),
  constraint system_actors_kind_check check (actor_kind in ('system','automation')),
  constraint system_actors_status_check check (status in ('active','disabled')),
  constraint system_actors_capability_profile_check check (jsonb_typeof(capability_profile)='object' and octet_length(capability_profile::text)<=8192)
);

create table platform_private.system_actor_executor_bindings (
  actor_key text not null references platform_private.system_actors(actor_key) on update restrict on delete restrict,
  executor_kind text not null,
  executor_key text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(actor_key,executor_kind,executor_key),
  constraint system_actor_executor_kind_check check (executor_kind='database_role'),
  constraint system_actor_executor_key_check check (btrim(executor_key)<>'' and octet_length(executor_key)<=128),
  constraint system_actor_executor_status_check check (status in ('active','disabled'))
);

create table platform_private.system_actor_message_policies (
  actor_key text primary key references platform_private.system_actors(actor_key) on update restrict on delete restrict,
  enabled boolean not null default false,
  permitted_purposes text[] not null,
  recipient_scope text not null,
  allow_links boolean not null default false,
  allow_resource_references boolean not null default false,
  allow_human_reply boolean not null default false,
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  constraint system_actor_message_purposes_check check (cardinality(permitted_purposes) between 1 and 32 and array_position(permitted_purposes,null) is null),
  constraint system_actor_message_recipient_scope_check check (recipient_scope='super_admin_only'),
  constraint system_actor_message_revision_check check (revision>0)
);

comment on table platform_private.system_actors is 'Accountable non-human actor identity. Executor credentials remain separate.';
comment on table platform_private.system_actor_executor_bindings is 'Explicit bindings from accountable actors to accepted runtime executor identities.';
comment on table platform_private.system_actor_message_policies is 'Messages-only scope and kill control for accountable System Actors.';

revoke all on table platform_private.system_actors,platform_private.system_actor_executor_bindings,platform_private.system_actor_message_policies from public,anon,authenticated,service_role;

insert into platform_private.system_actors(actor_key,label,actor_kind,status,capability_profile)
values('mizizi','MIZIZI Cultural Data Steward','system','active',jsonb_build_object('domain','registry','agent','mizizi','ruleset_version','1.1.0'));
insert into platform_private.system_actor_executor_bindings(actor_key,executor_kind,executor_key,status)
values('mizizi','database_role','postgres','active');
insert into platform_private.system_actor_message_policies(actor_key,enabled,permitted_purposes,recipient_scope,allow_links,allow_resource_references,allow_human_reply,revision)
values('mizizi',true,array['operational_update']::text[],'super_admin_only',false,false,false,1);

alter table platform_private.command_receipts drop constraint command_receipts_principal_key_check;
alter table platform_private.command_receipts add constraint command_receipts_principal_key_check check (
  principal_key='service:service_role'
  or principal_key ~ '^user:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  or principal_key ~ '^system:[a-z][a-z0-9_.:-]{1,99}$'
);

insert into platform_private.command_types(command_type,job_type,accepted_event_type,success_event_type,failure_event_type,retry_event_type,enabled)
values
('messages.system.send','messages.system.send.sync','messages.system.send.accepted','messages.system.send.succeeded','messages.system.send.failed','messages.system.send.retry_scheduled',true),
('messages.system_actor.messaging.update','messages.system_actor.messaging.update.sync','messages.system_actor.messaging.update.accepted','messages.system_actor.messaging.update.succeeded','messages.system_actor.messaging.update.failed','messages.system_actor.messaging.update.retry_scheduled',true);

create function messaging.system_actor_presentation(p_actor_key text)
returns jsonb language sql stable security definer
set search_path=pg_catalog,platform_private
as $$
  select case when a.actor_key is null then null else jsonb_build_object('actor_key',a.actor_key,'label',a.label,'actor_kind',a.actor_kind,'status',a.status) end
  from (select 1) seed left join platform_private.system_actors a on a.actor_key=p_actor_key
$$;

create function messaging.participant_identity_json(p_actor_kind text,p_person_resource_id uuid,p_actor_key text)
returns jsonb language sql stable security definer
set search_path=pg_catalog,editorial,messaging
as $$
  select case
    when p_actor_kind='human' then jsonb_build_object('actor_kind','human','person_resource_id',p_person_resource_id,'actor_key',null,'presentation',editorial.resolve_person_presentation(p_person_resource_id))
    when p_actor_kind in ('system','automation') then jsonb_build_object('actor_kind',p_actor_kind,'person_resource_id',null,'actor_key',p_actor_key,'presentation',messaging.system_actor_presentation(p_actor_key))
    else null end
$$;

create function platform_private.begin_system_resource_command(p_actor_key text,p_command_type text,p_resource_id uuid,p_idempotency_key text,p_request_payload jsonb)
returns table(command_receipt_id uuid,receipt_status text,result_payload jsonb,idempotent_replay boolean)
language plpgsql security definer
set search_path=pg_catalog,editorial,platform_private
as $$
declare v_fp text; v_receipt platform_private.command_receipts%rowtype; v_principal text;
begin
  if p_actor_key is null or p_actor_key !~ '^[a-z][a-z0-9_.:-]{1,99}$' then raise exception using errcode='22023',message='A valid System Actor key is required.'; end if;
  if not exists(select 1 from platform_private.system_actors a where a.actor_key=p_actor_key and a.status='active') then raise exception using errcode='42501',message='The System Actor is not active.'; end if;
  if not exists(select 1 from platform_private.system_actor_executor_bindings b where b.actor_key=p_actor_key and b.executor_kind='database_role' and b.executor_key=session_user and b.status='active') then raise exception using errcode='42501',message='The current executor is not bound to this System Actor.'; end if;
  if p_resource_id is null or not exists(select 1 from editorial.resources r where r.id=p_resource_id) then raise exception using errcode='P0002',message='The command Resource does not exist.'; end if;
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then raise exception using errcode='22023',message='A valid idempotency key is required.'; end if;
  if p_request_payload is null or jsonb_typeof(p_request_payload)<>'object' or octet_length(p_request_payload::text)>32768 then raise exception using errcode='22023',message='request_payload is invalid.'; end if;
  if not exists(select 1 from platform_private.command_types c where c.command_type=p_command_type and c.enabled) then raise exception using errcode='22023',message='The command type is missing or disabled.'; end if;
  v_principal:='system:'||p_actor_key;
  v_fp:=platform_private.command_request_fingerprint(p_command_type,p_resource_id,p_request_payload);
  insert into platform_private.command_receipts(command_type,resource_id,principal_key,actor_user_id,idempotency_key,request_fingerprint,request_payload)
  values(p_command_type,p_resource_id,v_principal,null,p_idempotency_key,v_fp,p_request_payload)
  on conflict(principal_key,command_type,idempotency_key) do nothing returning * into v_receipt;
  if not found then
    select r.* into v_receipt from platform_private.command_receipts r where r.principal_key=v_principal and r.command_type=p_command_type and r.idempotency_key=p_idempotency_key for update;
    if not found then raise exception 'The System Actor idempotency receipt disappeared.'; end if;
    if v_receipt.resource_id<>p_resource_id or v_receipt.request_fingerprint<>v_fp then raise exception using errcode='23505',message='The idempotency key was already used for a different System Actor request.'; end if;
    command_receipt_id:=v_receipt.id; receipt_status:=v_receipt.status; result_payload:=v_receipt.result_payload; idempotent_replay:=true; return next; return;
  end if;
  command_receipt_id:=v_receipt.id; receipt_status:=v_receipt.status; result_payload:=v_receipt.result_payload; idempotent_replay:=false; return next;
end
$$;

revoke all on function messaging.system_actor_presentation(text),messaging.participant_identity_json(text,uuid,text),platform_private.begin_system_resource_command(text,text,uuid,text,jsonb) from public,anon,authenticated,service_role;

create or replace function messaging.audience_allows_category(p_category text)
returns boolean language sql stable security definer set search_path=pg_catalog,messaging
as $$
  select case
    when p_category='system' then audience_mode in('internal','contributors','members','public')
    when audience_mode='internal' then p_category='staff'
    when audience_mode='contributors' then p_category in('staff','contributors')
    when audience_mode='members' then p_category in('staff','contributors','members')
    when audience_mode='public' then p_category in('staff','contributors','members','public')
    else false end
  from messaging.runtime_policy where singleton
$$;
revoke all on function messaging.audience_allows_category(text) from public,anon,authenticated,service_role;

create function platform_private.send_system_message(p_actor_key text,p_recipient_person_resource_id uuid,p_purpose text,p_body text,p_resource_references jsonb,p_idempotency_key text,p_correlation_id uuid default null,p_client_created_at timestamptz default null)
returns table(command_receipt_id uuid,receipt_status text,conversation_id uuid,message_id uuid,mailbox_folder text,first_contact_state text,idempotent_replay boolean)
language plpgsql security definer
set search_path=pg_catalog,auth,public,editorial,messaging,platform_private
as $$
declare a platform_private.system_actors%rowtype; pol platform_private.system_actor_message_policies%rowtype; ru uuid; body text; purpose text; refs jsonb; corr uuid; req jsonb; b record; result jsonb; conv uuid; sp uuid; rp uuid; msg uuid; disp text; folder text; fcs text; approved boolean;
begin
  select x.* into a from platform_private.system_actors x where x.actor_key=p_actor_key and x.status='active';
  select x.* into pol from platform_private.system_actor_message_policies x where x.actor_key=p_actor_key and x.enabled;
  if a.actor_key is null or pol.actor_key is null then raise exception using errcode='42501',message='System Actor messaging is not enabled.'; end if;
  if not exists(select 1 from platform_private.system_actor_executor_bindings x where x.actor_key=p_actor_key and x.executor_kind='database_role' and x.executor_key=session_user and x.status='active') then raise exception using errcode='42501',message='The current executor is not bound to this System Actor.'; end if;
  purpose:=lower(btrim(coalesce(p_purpose,'')));
  if purpose='' or purpose !~ '^[a-z][a-z0-9_.:-]{1,99}$' or not(purpose=any(pol.permitted_purposes)) then raise exception using errcode='42501',message='The System Actor Message purpose is not permitted.'; end if;
  body:=nullif(btrim(coalesce(p_body,'')),'');
  if body is null or octet_length(body)>10000 then raise exception using errcode='22023',message='Message body is required and must not exceed 10 KB.'; end if;
  if not pol.allow_links and messaging.message_contains_link(body) then raise exception using errcode='42501',message='This System Actor may not send links.'; end if;
  refs:=coalesce(p_resource_references,'[]'::jsonb);
  if jsonb_typeof(refs)<>'array' or jsonb_array_length(refs)>0 then raise exception using errcode='42501',message='System Actor Resource references are not enabled in Candidate A.'; end if;
  ru:=messaging.active_user_for_person(p_recipient_person_resource_id);
  if ru is null then raise exception using errcode='P0002',message='The recipient is not available for Messages.'; end if;
  if pol.recipient_scope<>'super_admin_only' or not exists(select 1 from public.user_role_assignments x where x.user_id=ru and x.role_key='super_admin' and x.status='active' and (x.expires_at is null or x.expires_at>now())) then raise exception using errcode='42501',message='The recipient is outside the System Actor scope.'; end if;
  if not messaging.audience_allows_category('system') or not messaging.audience_allows_category(messaging.user_sender_category(ru)) or not messaging.recipient_content_allows(ru,'system',body,refs) then raise exception using errcode='42501',message='The recipient does not allow this System Message.'; end if;
  corr:=coalesce(p_correlation_id,md5(p_actor_key||':messages.system.send:'||coalesce(p_idempotency_key,''))::uuid);
  req:=jsonb_build_object('actor_key',p_actor_key,'recipient_person_resource_id',p_recipient_person_resource_id,'purpose',purpose,'body',body,'resource_references',refs,'client_created_at',p_client_created_at,'correlation_id',corr);
  select * into b from platform_private.begin_system_resource_command(p_actor_key,'messages.system.send',p_recipient_person_resource_id,p_idempotency_key,req);
  if b.idempotent_replay then result:=b.result_payload; command_receipt_id:=b.command_receipt_id; receipt_status:=b.receipt_status; conversation_id:=nullif(result->>'conversation_id','')::uuid; message_id:=nullif(result->>'message_id','')::uuid; mailbox_folder:=result->>'mailbox_folder'; first_contact_state:=result->>'first_contact_state'; idempotent_replay:=true; return next; return; end if;
  perform pg_advisory_xact_lock(hashtextextended('messages-system-pair:'||p_actor_key||':'||p_recipient_person_resource_id::text,0));
  select c.id into conv from messaging.conversations c where c.conversation_kind='direct' and c.status='active'
    and (select count(*) from messaging.conversation_participants x where x.conversation_id=c.id and x.membership_status='active')=2
    and exists(select 1 from messaging.conversation_participants x where x.conversation_id=c.id and x.actor_kind in('system','automation') and x.actor_key=p_actor_key and x.membership_status='active')
    and exists(select 1 from messaging.conversation_participants x where x.conversation_id=c.id and x.actor_kind='human' and x.person_resource_id=p_recipient_person_resource_id and x.membership_status='active')
    order by c.created_at desc limit 1;
  if conv is not null then
    select x.id into sp from messaging.conversation_participants x where x.conversation_id=conv and x.actor_kind in('system','automation') and x.actor_key=p_actor_key and x.membership_status='active';
    select x.id,x.mailbox_folder,x.first_contact_state into rp,folder,fcs from messaging.conversation_participants x where x.conversation_id=conv and x.actor_kind='human' and x.person_resource_id=p_recipient_person_resource_id and x.membership_status='active' for update;
    if fcs='declined' then raise exception using errcode='42501',message='The recipient declined this System Actor.'; end if;
  else
    select exists(select 1 from messaging.sender_approvals x where x.recipient_person_resource_id=p_recipient_person_resource_id and x.sender_actor_kind=a.actor_kind and x.sender_actor_key=p_actor_key and x.status='active') into approved;
    select coalesce((select x.first_contact_disposition from messaging.user_sender_policies x where x.user_id=ru and x.sender_category='system'),messaging.default_first_contact_disposition('system')) into disp;
    if disp='reject' then raise exception using errcode='42501',message='The recipient is not accepting new System Messages.'; end if;
    if approved or disp='inbox' then folder:='inbox'; fcs:='accepted'; else folder:='requests'; fcs:='pending'; end if;
    insert into messaging.conversations(security_classification,status,created_at,last_activity_at,correlation_id) values('standard','active',now(),now(),corr) returning id into conv;
    insert into messaging.conversation_participants(conversation_id,actor_kind,actor_key,membership_status,mailbox_folder,first_contact_state) values(conv,a.actor_kind,p_actor_key,'active','inbox','not_applicable') returning id into sp;
    insert into messaging.conversation_participants(conversation_id,actor_kind,person_resource_id,user_id,membership_status,mailbox_folder,first_contact_state) values(conv,'human',p_recipient_person_resource_id,ru,'active',folder,fcs) returning id into rp;
    update messaging.conversations set created_by_participant_id=sp where id=conv;
  end if;
  insert into messaging.messages(conversation_id,sender_participant_id,message_kind,body,accepted_at,client_created_at,correlation_id,command_receipt_id) values(conv,sp,'text',body,now(),p_client_created_at,corr,b.command_receipt_id) returning id into msg;
  insert into messaging.message_receipts(message_id,participant_id,conversation_id,delivery_state,delivered_at) values(msg,rp,conv,'delivered',now());
  update messaging.conversations set last_activity_at=now() where id=conv;
  result:=jsonb_build_object('conversation_id',conv,'message_id',msg,'mailbox_folder',folder,'first_contact_state',fcs,'actor_key',p_actor_key,'purpose',purpose,'correlation_id',corr);
  perform platform_private.complete_resource_command(b.command_receipt_id,result);
  command_receipt_id:=b.command_receipt_id; receipt_status:='succeeded'; conversation_id:=conv; message_id:=msg; mailbox_folder:=folder; first_contact_state:=fcs; idempotent_replay:=false; return next;
end
$$;
revoke all on function platform_private.send_system_message(text,uuid,text,text,jsonb,text,uuid,timestamptz) from public,anon,authenticated,service_role;

create or replace function public.accept_message_request(p_conversation_id uuid,p_idempotency_key text,p_correlation_id uuid default null)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,auth,public,editorial,messaging,platform_private
as $$
declare me record; cp messaging.conversation_participants%rowtype; s messaging.conversation_participants%rowtype; b record; r jsonb; corr uuid;
begin
  select * into me from messaging.current_human_identity();
  corr:=messaging.command_correlation(me.user_id,'messages.request.accept',p_idempotency_key,p_correlation_id);
  select * into b from platform_private.begin_authenticated_resource_command('messages.request.accept',me.person_resource_id,p_idempotency_key,jsonb_build_object('conversation_id',p_conversation_id,'correlation_id',corr));
  if b.idempotent_replay then return b.result_payload; end if;
  select x.* into cp from messaging.conversation_participants x where x.conversation_id=p_conversation_id and x.person_resource_id=me.person_resource_id and x.user_id=me.user_id and x.membership_status='active' for update;
  if cp.id is null or cp.first_contact_state<>'pending' then raise exception using errcode='22023',message='A pending Message request is required.'; end if;
  select x.* into s from messaging.conversation_participants x where x.conversation_id=p_conversation_id and x.id<>cp.id and x.membership_status='active' order by x.joined_at,x.id limit 1;
  if s.id is null then raise exception using errcode='P0002',message='The sender participant is missing.'; end if;
  if s.actor_kind='human' then
    insert into messaging.sender_approvals(recipient_person_resource_id,recipient_user_id,sender_actor_kind,sender_person_resource_id,status,approved_at,revoked_at,created_from_conversation_id,updated_at)
    values(me.person_resource_id,me.user_id,'human',s.person_resource_id,'active',now(),null,p_conversation_id,now())
    on conflict(recipient_person_resource_id,sender_person_resource_id) where sender_actor_kind='human'
    do update set status='active',revoked_at=null,recipient_user_id=excluded.recipient_user_id,approved_at=now(),created_from_conversation_id=excluded.created_from_conversation_id,updated_at=now();
  elsif s.actor_kind in('system','automation') then
    insert into messaging.sender_approvals(recipient_person_resource_id,recipient_user_id,sender_actor_kind,sender_actor_key,status,approved_at,revoked_at,created_from_conversation_id,updated_at)
    values(me.person_resource_id,me.user_id,s.actor_kind,s.actor_key,'active',now(),null,p_conversation_id,now())
    on conflict(recipient_person_resource_id,sender_actor_kind,sender_actor_key) where sender_actor_kind in('system','automation')
    do update set status='active',revoked_at=null,recipient_user_id=excluded.recipient_user_id,approved_at=now(),created_from_conversation_id=excluded.created_from_conversation_id,updated_at=now();
  else raise exception using errcode='42501',message='The sender participant kind is not approvable.'; end if;
  update messaging.conversation_participants set first_contact_state='accepted',mailbox_folder='inbox',mailbox_updated_at=now() where id=cp.id;
  r:=jsonb_build_object('conversation_id',p_conversation_id,'accepted',true,'sender_actor_kind',s.actor_kind,'sender_actor_key',s.actor_key,'correlation_id',corr);
  perform platform_private.complete_resource_command(b.command_receipt_id,r); return r;
end
$$;

create or replace function public.send_message(p_conversation_id uuid,p_body text,p_resource_references jsonb,p_idempotency_key text,p_correlation_id uuid default null,p_client_created_at timestamptz default null)
returns table(command_receipt_id uuid,receipt_status text,conversation_id uuid,message_id uuid,idempotent_replay boolean)
language plpgsql security definer
set search_path=pg_catalog,auth,public,editorial,messaging,platform_private
as $$
declare me record; sp uuid; body text; corr uuid; req jsonb; b record; msg uuid; o record;
begin
  select * into me from messaging.current_human_identity(); body:=nullif(btrim(coalesce(p_body,'')),'');
  if body is null or octet_length(body)>10000 then raise exception using errcode='22023',message='Message body is required and must not exceed 10 KB.'; end if;
  corr:=messaging.command_correlation(me.user_id,'messages.message.send',p_idempotency_key,p_correlation_id);
  req:=jsonb_build_object('conversation_id',p_conversation_id,'body',body,'resource_references',coalesce(p_resource_references,'[]'::jsonb),'client_created_at',p_client_created_at,'correlation_id',corr);
  select * into b from platform_private.begin_authenticated_resource_command('messages.message.send',me.person_resource_id,p_idempotency_key,req);
  if b.idempotent_replay then command_receipt_id:=b.command_receipt_id; receipt_status:=b.receipt_status; conversation_id:=nullif(b.result_payload->>'conversation_id','')::uuid; message_id:=nullif(b.result_payload->>'message_id','')::uuid; idempotent_replay:=true; return next; return; end if;
  perform messaging.validate_resource_references(me.user_id,p_resource_references);
  select cp.id into sp from messaging.conversation_participants cp join messaging.conversations c on c.id=cp.conversation_id where cp.conversation_id=p_conversation_id and cp.person_resource_id=me.person_resource_id and cp.user_id=me.user_id and cp.membership_status='active' and c.status='active' for update;
  if sp is null then raise exception using errcode='42501',message='Active conversation membership is required.'; end if;
  if exists(select 1 from messaging.conversation_participants sy left join platform_private.system_actor_message_policies p on p.actor_key=sy.actor_key where sy.conversation_id=p_conversation_id and sy.id<>sp and sy.membership_status='active' and sy.actor_kind in('system','automation') and coalesce(p.allow_human_reply,false)=false) then raise exception using errcode='42501',message='Replies are not enabled for this System Actor.'; end if;
  for o in select cp.* from messaging.conversation_participants cp where cp.conversation_id=p_conversation_id and cp.id<>sp and cp.membership_status='active' and cp.actor_kind='human' loop
    if not messaging.audience_allows_category(me.sender_category) or not messaging.audience_allows_category(messaging.user_sender_category(o.user_id)) or messaging.person_blocked_between(me.user_id,o.person_resource_id) or o.first_contact_state='declined' or not messaging.recipient_content_allows(o.user_id,me.sender_category,body,p_resource_references) then raise exception using errcode='42501',message='This Message cannot be delivered.'; end if;
  end loop;
  insert into messaging.messages(conversation_id,sender_participant_id,message_kind,body,accepted_at,client_created_at,correlation_id,command_receipt_id) values(p_conversation_id,sp,'text',body,now(),p_client_created_at,corr,b.command_receipt_id) returning id into msg;
  perform messaging.insert_resource_references(msg,p_resource_references);
  insert into messaging.message_receipts(message_id,participant_id,conversation_id,delivery_state,delivered_at) select msg,cp.id,p_conversation_id,'delivered',now() from messaging.conversation_participants cp where cp.conversation_id=p_conversation_id and cp.id<>sp and cp.membership_status='active';
  update messaging.conversations set last_activity_at=now() where id=p_conversation_id;
  perform platform_private.complete_resource_command(b.command_receipt_id,jsonb_build_object('conversation_id',p_conversation_id,'message_id',msg,'correlation_id',corr));
  command_receipt_id:=b.command_receipt_id; receipt_status:='succeeded'; conversation_id:=p_conversation_id; message_id:=msg; idempotent_replay:=false; return next;
end
$$;

create or replace function public.list_my_message_conversations(p_folder text default 'inbox',p_before_last_activity_at timestamptz default null,p_before_conversation_id uuid default null,p_limit integer default 30)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,auth,public,editorial,messaging
as $$
declare me record; f text; lim integer;
begin
  select * into me from messaging.current_human_identity(); f:=lower(btrim(coalesce(p_folder,'inbox'))); lim:=greatest(1,least(coalesce(p_limit,30),100));
  if f not in('inbox','requests','spam','archived') then raise exception using errcode='22023',message='Message folder is invalid.'; end if;
  return coalesce((select jsonb_agg(item order by (item->>'last_activity_at')::timestamptz desc,(item->>'conversation_id')::uuid desc) from (
    select jsonb_build_object('conversation_id',c.id,'security_classification',c.security_classification,'status',c.status,'mailbox_folder',m.mailbox_folder,'first_contact_state',m.first_contact_state,'last_activity_at',c.last_activity_at,
      'other_participant',messaging.participant_identity_json(o.actor_kind,o.person_resource_id,o.actor_key),
      'latest_message',(select jsonb_build_object('id',x.id,'body',x.body,'accepted_at',x.accepted_at,'sender',messaging.participant_identity_json(s.actor_kind,s.person_resource_id,s.actor_key),'sender_actor_kind',s.actor_kind,'sender_person_resource_id',s.person_resource_id,'sender_actor_key',s.actor_key) from messaging.messages x join messaging.conversation_participants s on s.id=x.sender_participant_id where x.conversation_id=c.id order by x.accepted_at desc,x.id desc limit 1),
      'unread_count',(select count(*) from messaging.message_receipts r where r.participant_id=m.id and r.read_at is null)) item
    from messaging.conversation_participants m join messaging.conversations c on c.id=m.conversation_id left join messaging.conversation_participants o on o.conversation_id=c.id and o.id<>m.id and o.membership_status='active'
    where m.user_id=me.user_id and m.person_resource_id=me.person_resource_id and m.membership_status='active' and m.mailbox_folder=f
      and (p_before_last_activity_at is null or (c.last_activity_at,c.id)<(p_before_last_activity_at,coalesce(p_before_conversation_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
    order by c.last_activity_at desc,c.id desc limit lim) q),'[]'::jsonb);
end
$$;

create or replace function public.get_my_message_conversation(p_conversation_id uuid,p_before_accepted_at timestamptz default null,p_before_message_id uuid default null,p_limit integer default 50)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,auth,public,editorial,messaging
as $$
declare me record; mine messaging.conversation_participants%rowtype; lim integer;
begin
  select * into me from messaging.current_human_identity(); lim:=greatest(1,least(coalesce(p_limit,50),100));
  select x.* into mine from messaging.conversation_participants x where x.conversation_id=p_conversation_id and x.user_id=me.user_id and x.person_resource_id=me.person_resource_id and x.membership_status='active';
  if mine.id is null then raise exception using errcode='42501',message='Active conversation membership is required.'; end if;
  return jsonb_build_object(
    'conversation',(select jsonb_build_object('id',c.id,'security_classification',c.security_classification,'status',c.status,'mailbox_folder',mine.mailbox_folder,'first_contact_state',mine.first_contact_state,'created_at',c.created_at,'last_activity_at',c.last_activity_at) from messaging.conversations c where c.id=p_conversation_id),
    'participants',(select jsonb_agg(messaging.participant_identity_json(x.actor_kind,x.person_resource_id,x.actor_key)||jsonb_build_object('membership_status',x.membership_status) order by x.joined_at,x.id) from messaging.conversation_participants x where x.conversation_id=p_conversation_id),
    'messages',coalesce((select jsonb_agg(j order by at desc,id desc) from (
      select m.id,m.accepted_at at,jsonb_build_object('id',m.id,'message_kind',m.message_kind,'body',m.body,'accepted_at',m.accepted_at,'client_created_at',m.client_created_at,
        'sender',messaging.participant_identity_json(s.actor_kind,s.person_resource_id,s.actor_key),'sender_actor_kind',s.actor_kind,'sender_person_resource_id',s.person_resource_id,'sender_actor_key',s.actor_key,
        'my_read_at',mr.read_at,
        'recipient_read_at',case when s.id=mine.id then (select case when coalesce(pol.show_read_receipts,messaging.default_show_read_receipts(messaging.user_sender_category(me.user_id))) then rr.read_at else null end from messaging.message_receipts rr join messaging.conversation_participants rec on rec.id=rr.participant_id left join messaging.user_sender_policies pol on pol.user_id=rec.user_id and pol.sender_category=messaging.user_sender_category(me.user_id) where rr.message_id=m.id and rec.id<>mine.id order by rec.id limit 1) else null end,
        'resource_references',coalesce((select jsonb_agg(jsonb_build_object('resource_id',ref.resource_id,'resource_version_id',ref.resource_version_id,'presentation_kind',ref.presentation_kind) order by ref.created_at,ref.id) from messaging.message_resource_references ref where ref.message_id=m.id and messaging.can_user_reference_resource(me.user_id,ref.resource_id,ref.resource_version_id)),'[]'::jsonb)) j
      from messaging.messages m join messaging.conversation_participants s on s.id=m.sender_participant_id left join messaging.message_receipts mr on mr.message_id=m.id and mr.participant_id=mine.id
      where m.conversation_id=p_conversation_id and (p_before_accepted_at is null or (m.accepted_at,m.id)<(p_before_accepted_at,coalesce(p_before_message_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
      order by m.accepted_at desc,m.id desc limit lim) pg),'[]'::jsonb));
end
$$;

create or replace function messaging.emit_direct_message_notification()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,messaging,platform_private
as $$
declare kind text; sender_user uuid; actor_key text; sender_name text;
begin
  select p.actor_kind,p.user_id,p.actor_key into kind,sender_user,actor_key from messaging.conversation_participants p where p.id=new.sender_participant_id and p.conversation_id=new.conversation_id and p.membership_status='active';
  if kind='human' then
    if sender_user is null then return new; end if;
    select coalesce(nullif(btrim(u.display_name),''),nullif(btrim(u.username_normalized),''),'Someone') into sender_name from public.user_profiles u where u.user_id=sender_user and u.status='active';
  elsif kind in('system','automation') then
    select a.label into sender_name from platform_private.system_actors a where a.actor_key=actor_key;
    if sender_name is null then return new; end if;
  else return new; end if;
  insert into public.community_notifications(user_id,actor_id,notification_type,entity_type,entity_id,entity_slug,comment_id,metadata)
  select r.user_id,case when kind='human' then sender_user else null end,'direct_message','direct_message',new.id::text,null,null,
    jsonb_strip_nulls(jsonb_build_object('canonical_path','/messages','conversation_id',new.conversation_id,'message_id',new.id,'sender_display_name',coalesce(sender_name,'Someone'),'sender_actor_kind',kind,'sender_actor_key',case when kind in('system','automation') then actor_key else null end))
  from messaging.conversation_participants r
  where r.conversation_id=new.conversation_id and r.id<>new.sender_participant_id and r.actor_kind='human' and r.user_id is not null and (sender_user is null or r.user_id<>sender_user) and r.membership_status='active' and r.mailbox_folder in('inbox','archived') and r.first_contact_state in('accepted','not_applicable')
    and not exists(select 1 from public.community_notifications e where e.user_id=r.user_id and e.notification_type='direct_message' and e.entity_type='direct_message' and e.entity_id=new.id::text);
  return new;
end
$$;
revoke all on function messaging.emit_direct_message_notification() from public,anon,authenticated,service_role;

create function public.get_messages_system_actors()
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,auth,public,messaging,platform_private
as $$
declare me record;
begin
  select * into me from messaging.current_human_identity();
  if not exists(select 1 from public.user_role_assignments x where x.user_id=me.user_id and x.role_key='super_admin' and x.status='active' and (x.expires_at is null or x.expires_at>now())) or not public.current_user_has_capability('manage_messages_control_center') then raise exception using errcode='42501',message='Messages Agents requires active Super Admin authority.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('actor_key',a.actor_key,'label',a.label,'actor_kind',a.actor_kind,'actor_status',a.status,'messaging_enabled',p.enabled,'permitted_purposes',p.permitted_purposes,'recipient_scope',p.recipient_scope,'allow_links',p.allow_links,'allow_resource_references',p.allow_resource_references,'allow_human_reply',p.allow_human_reply,'revision',p.revision,'latest_message_at',(select max(m.accepted_at) from messaging.conversation_participants cp join messaging.messages m on m.sender_participant_id=cp.id where cp.actor_kind in('system','automation') and cp.actor_key=a.actor_key)) order by a.actor_key) from platform_private.system_actors a join platform_private.system_actor_message_policies p on p.actor_key=a.actor_key),'[]'::jsonb);
end
$$;

create function public.set_messages_system_actor_enabled(p_actor_key text,p_expected_revision bigint,p_enabled boolean,p_idempotency_key text,p_correlation_id uuid default null)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,auth,public,editorial,messaging,platform_private
as $$
declare me record; cur platform_private.system_actor_message_policies%rowtype; b record; corr uuid; result jsonb;
begin
  select * into me from messaging.current_human_identity();
  if not exists(select 1 from public.user_role_assignments x where x.user_id=me.user_id and x.role_key='super_admin' and x.status='active' and (x.expires_at is null or x.expires_at>now())) or not public.current_user_has_capability('manage_messages_control_center') then raise exception using errcode='42501',message='Messages Agents requires active Super Admin authority.'; end if;
  if p_actor_key is null or p_expected_revision is null or p_expected_revision<1 or p_enabled is null then raise exception using errcode='22023',message='System Actor messaging update input is invalid.'; end if;
  corr:=messaging.command_correlation(me.user_id,'messages.system_actor.messaging.update',p_idempotency_key,p_correlation_id);
  select * into b from platform_private.begin_authenticated_resource_command('messages.system_actor.messaging.update',me.person_resource_id,p_idempotency_key,jsonb_build_object('actor_key',p_actor_key,'expected_revision',p_expected_revision,'enabled',p_enabled,'correlation_id',corr));
  if b.idempotent_replay then return b.result_payload; end if;
  select x.* into cur from platform_private.system_actor_message_policies x where x.actor_key=p_actor_key for update;
  if cur.actor_key is null then raise exception using errcode='P0002',message='System Actor Messages policy was not found.'; end if;
  if cur.revision<>p_expected_revision then raise exception using errcode='40001',message='System Actor Messages policy revision changed.'; end if;
  update platform_private.system_actor_message_policies set enabled=p_enabled,revision=revision+1,updated_at=now() where actor_key=p_actor_key returning jsonb_build_object('actor_key',actor_key,'messaging_enabled',enabled,'revision',revision,'correlation_id',corr) into result;
  perform platform_private.complete_resource_command(b.command_receipt_id,result); return result;
end
$$;

create or replace function public.get_messages_control_center_status()
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,auth,public,messaging,platform_private
as $$
declare me record; allowed boolean;
begin
  select * into me from messaging.current_human_identity();
  select exists(select 1 from public.user_role_assignments x where x.user_id=me.user_id and x.role_key='super_admin' and x.status='active' and (x.expires_at is null or x.expires_at>now())) and public.current_user_has_capability('manage_messages_control_center') into allowed;
  if not allowed then raise exception using errcode='42501',message='Messages Control Center requires active Super Admin authority.'; end if;
  return jsonb_build_object('audience_mode',(select p.audience_mode from messaging.runtime_policy p where p.singleton),'policy_revision',(select p.revision from messaging.runtime_policy p where p.singleton),'active_conversations',(select count(*) from messaging.conversations c where c.status='active'),'messages',(select count(*) from messaging.messages),'pending_requests',(select count(*) from messaging.conversation_participants p where p.membership_status='active' and p.first_contact_state='pending'),'spam_conversations',(select count(*) from messaging.conversation_participants p where p.membership_status='active' and p.mailbox_folder='spam'),'active_human_participants',(select count(*) from messaging.conversation_participants p where p.membership_status='active' and p.actor_kind='human'),'registered_system_actors',(select count(*) from platform_private.system_actors),'messages_enabled_system_actors',(select count(*) from platform_private.system_actor_message_policies p where p.enabled));
end
$$;

revoke all on function public.get_messages_system_actors(),public.set_messages_system_actor_enabled(text,bigint,boolean,text,uuid) from public,anon,service_role;
grant execute on function public.get_messages_system_actors(),public.set_messages_system_actor_enabled(text,bigint,boolean,text,uuid) to authenticated;
revoke all on function public.accept_message_request(uuid,text,uuid),public.send_message(uuid,text,jsonb,text,uuid,timestamptz),public.list_my_message_conversations(text,timestamptz,uuid,integer),public.get_my_message_conversation(uuid,timestamptz,uuid,integer),public.get_messages_control_center_status() from public,anon;
grant execute on function public.accept_message_request(uuid,text,uuid),public.send_message(uuid,text,jsonb,text,uuid,timestamptz),public.list_my_message_conversations(text,timestamptz,uuid,integer),public.get_my_message_conversation(uuid,timestamptz,uuid,integer),public.get_messages_control_center_status() to authenticated;

do $postcheck$
declare s text; n text; h text; a text; l text; d text;
begin
  if not exists(select 1 from platform_private.system_actors where actor_key='mizizi' and label='MIZIZI Cultural Data Steward' and actor_kind='system' and status='active') then raise exception 'STOP: MIZIZI actor seed missing'; end if;
  if not exists(select 1 from platform_private.system_actor_executor_bindings where actor_key='mizizi' and executor_kind='database_role' and executor_key='postgres' and status='active') then raise exception 'STOP: MIZIZI executor binding missing'; end if;
  if not exists(select 1 from platform_private.system_actor_message_policies where actor_key='mizizi' and enabled and recipient_scope='super_admin_only' and permitted_purposes=array['operational_update']::text[] and not allow_links and not allow_resource_references and not allow_human_reply) then raise exception 'STOP: MIZIZI Messages policy drifted'; end if;
  select pg_get_functiondef(p.oid) into s from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace where ns.nspname='platform_private' and p.proname='send_system_message';
  select pg_get_functiondef(p.oid) into n from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace where ns.nspname='messaging' and p.proname='emit_direct_message_notification';
  select pg_get_functiondef(p.oid) into h from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace where ns.nspname='public' and p.proname='send_message';
  select pg_get_functiondef(p.oid) into a from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace where ns.nspname='public' and p.proname='accept_message_request';
  select pg_get_functiondef(p.oid) into l from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace where ns.nspname='public' and p.proname='list_my_message_conversations';
  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace where ns.nspname='public' and p.proname='get_my_message_conversation';
  if s is null or position('begin_system_resource_command' in s)=0 or position('super_admin_only' in s)=0 then raise exception 'STOP: governed System send incomplete'; end if;
  if n is null or position('sender_actor_key' in n)=0 or position('new.body' in lower(n))<>0 then raise exception 'STOP: notification bridge incomplete/unsafe'; end if;
  if h is null or position('allow_human_reply' in h)=0 or a is null or position('sender_actor_key' in a)=0 or l is null or position('participant_identity_json' in l)=0 or d is null or position('participant_identity_json' in d)=0 then raise exception 'STOP: mixed-actor convergence incomplete'; end if;
  if has_function_privilege('authenticated','platform_private.send_system_message(text,uuid,text,text,jsonb,text,uuid,timestamp with time zone)','EXECUTE') or has_function_privilege('service_role','platform_private.send_system_message(text,uuid,text,text,jsonb,text,uuid,timestamp with time zone)','EXECUTE') then raise exception 'STOP: System send is client/service executable'; end if;
end
$postcheck$;

commit;
