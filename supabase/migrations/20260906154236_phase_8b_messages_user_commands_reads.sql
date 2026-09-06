begin;
set local statement_timeout='180s';
set local lock_timeout='5s';
select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('phase-8b-messages-user-commands-reads',0));

do $p$
begin
  if to_regnamespace('messaging') is null
     or not exists (
       select 1 from supabase_migrations.schema_migrations
       where version='20260906121902' and name='phase_8b_messages_core_foundation'
     ) then
    raise exception 'STOP: exact Messages Core authority missing';
  end if;
  if exists(select 1 from platform_private.command_types where command_type like 'messages.%') then
    raise exception 'STOP: Messages user commands already exist';
  end if;
end
$p$;

insert into platform_private.command_types(command_type,job_type,accepted_event_type,success_event_type,failure_event_type,retry_event_type)
values
('messages.conversation.start','messages.conversation.start.sync','messages.conversation.start.accepted','messages.conversation.start.succeeded','messages.conversation.start.failed','messages.conversation.start.retry_scheduled'),
('messages.message.send','messages.message.send.sync','messages.message.send.accepted','messages.message.send.succeeded','messages.message.send.failed','messages.message.send.retry_scheduled'),
('messages.request.accept','messages.request.accept.sync','messages.request.accept.accepted','messages.request.accept.succeeded','messages.request.accept.failed','messages.request.accept.retry_scheduled'),
('messages.request.decline','messages.request.decline.sync','messages.request.decline.accepted','messages.request.decline.succeeded','messages.request.decline.failed','messages.request.decline.retry_scheduled'),
('messages.mailbox.move','messages.mailbox.move.sync','messages.mailbox.move.accepted','messages.mailbox.move.succeeded','messages.mailbox.move.failed','messages.mailbox.move.retry_scheduled'),
('messages.sender_approval.revoke','messages.sender_approval.revoke.sync','messages.sender_approval.revoke.accepted','messages.sender_approval.revoke.succeeded','messages.sender_approval.revoke.failed','messages.sender_approval.revoke.retry_scheduled'),
('messages.preferences.update','messages.preferences.update.sync','messages.preferences.update.accepted','messages.preferences.update.succeeded','messages.preferences.update.failed','messages.preferences.update.retry_scheduled');

alter table messaging.messages
  add constraint messages_command_receipt_fkey
  foreign key(command_receipt_id)
  references platform_private.command_receipts(id)
  on update restrict on delete restrict;

create index messages_command_receipt_idx
  on messaging.messages(command_receipt_id)
  where command_receipt_id is not null;

create or replace function messaging.current_human_identity()
returns table(user_id uuid, person_resource_id uuid, sender_category text)
language plpgsql stable security definer
set search_path=pg_catalog,auth,public,editorial
as $$
declare u uuid; p uuid; c text;
begin
  if coalesce(auth.role(),'') <> 'authenticated' or auth.uid() is null then
    raise exception using errcode='42501', message='Authentication is required.';
  end if;
  u := auth.uid();
  select l.person_resource_id into p
  from editorial.person_identity_links l
  join editorial.people pe on pe.resource_id=l.person_resource_id and pe.person_state='active'
  join public.user_profiles up on up.user_id=l.user_id and up.status='active'
  where l.user_id=u and l.link_state='active'
  limit 1;
  if p is null then
    raise exception using errcode='42501', message='An active canonical Person identity is required.';
  end if;
  if exists(
    select 1 from public.user_role_assignments a
    where a.user_id=u and a.status='active' and (a.expires_at is null or a.expires_at>now())
      and a.role_key in('super_admin','administrator','developer','editor','chart_editor_global','chart_editor_regional','registry_editor','media_editor','reviewer','moderator','support_agent','author','analyst','writer','viewer')
  ) then c:='staff';
  elsif exists(
    select 1 from public.user_role_assignments a
    where a.user_id=u and a.status='active' and (a.expires_at is null or a.expires_at>now())
      and a.role_key in('field_contributor','chart_partner','label_partner','artist_manager','artist_claimant','brand_partner','research_partner')
  ) then c:='contributors';
  elsif exists(
    select 1 from public.user_role_assignments a
    where a.user_id=u and a.status='active' and (a.expires_at is null or a.expires_at>now())
      and a.role_key in('premium_member','member','subscriber','customer')
  ) then c:='members';
  else c:='public'; end if;
  return query select u,p,c;
end $$;

create or replace function messaging.command_correlation(p_user_id uuid,p_command_type text,p_idempotency_key text,p_correlation_id uuid)
returns uuid language sql immutable set search_path=pg_catalog
as $$
  select coalesce(p_correlation_id, md5(p_user_id::text || ':' || p_command_type || ':' || coalesce(p_idempotency_key,''))::uuid)
$$;

create or replace function messaging.active_user_for_person(p_person_resource_id uuid)
returns uuid language sql stable security definer
set search_path=pg_catalog,public,editorial
as $$
  select l.user_id
  from editorial.person_identity_links l
  join editorial.people p on p.resource_id=l.person_resource_id and p.person_state='active'
  join public.user_profiles u on u.user_id=l.user_id and u.status='active'
  where l.person_resource_id=p_person_resource_id and l.user_id is not null and l.link_state='active'
  limit 1
$$;

create or replace function messaging.user_sender_category(p_user_id uuid)
returns text language plpgsql stable security definer
set search_path=pg_catalog,public
as $$
begin
  if exists(select 1 from public.user_role_assignments a where a.user_id=p_user_id and a.status='active' and (a.expires_at is null or a.expires_at>now()) and a.role_key in('super_admin','administrator','developer','editor','chart_editor_global','chart_editor_regional','registry_editor','media_editor','reviewer','moderator','support_agent','author','analyst','writer','viewer')) then return 'staff';
  elsif exists(select 1 from public.user_role_assignments a where a.user_id=p_user_id and a.status='active' and (a.expires_at is null or a.expires_at>now()) and a.role_key in('field_contributor','chart_partner','label_partner','artist_manager','artist_claimant','brand_partner','research_partner')) then return 'contributors';
  elsif exists(select 1 from public.user_role_assignments a where a.user_id=p_user_id and a.status='active' and (a.expires_at is null or a.expires_at>now()) and a.role_key in('premium_member','member','subscriber','customer')) then return 'members';
  else return 'public'; end if;
end $$;

create or replace function messaging.audience_allows_category(p_category text)
returns boolean language sql stable security definer
set search_path=pg_catalog,messaging
as $$
  select case audience_mode
    when 'internal' then p_category='staff'
    when 'contributors' then p_category in('staff','contributors')
    when 'members' then p_category in('staff','contributors','members')
    when 'public' then p_category in('staff','contributors','members','public')
    else false end
  from messaging.runtime_policy where singleton
$$;

create or replace function messaging.person_blocked_between(p_user_id uuid,p_other_person_resource_id uuid)
returns boolean language sql stable security definer
set search_path=pg_catalog,public,editorial
as $$
  select
    exists(
      select 1 from public.community_blocks b
      where b.user_id=p_user_id and b.target_type='person' and b.target_id=p_other_person_resource_id::text and b.status='active'
    )
    or exists(
      select 1
      from editorial.person_identity_links o
      join public.community_blocks b
        on b.user_id=o.user_id
       and b.target_type='person'
       and b.target_id=(select s.person_resource_id::text from editorial.person_identity_links s where s.user_id=p_user_id and s.link_state='active' limit 1)
       and b.status='active'
      where o.person_resource_id=p_other_person_resource_id and o.link_state='active' and o.user_id is not null
    )
$$;

create or replace function messaging.can_user_reference_resource(p_user_id uuid,p_resource_id uuid,p_resource_version_id uuid)
returns boolean language sql stable security definer
set search_path=pg_catalog,editorial
as $$
  select exists(
    select 1 from editorial.resources r
    where r.id=p_resource_id and r.lifecycle_state<>'archived'
      and (r.visibility='public' or r.owner_id=p_user_id or r.created_by=p_user_id)
      and (p_resource_version_id is null or exists(select 1 from editorial.resource_versions v where v.resource_id=r.id and v.id=p_resource_version_id))
  )
$$;

create or replace function messaging.validate_resource_references(p_user_id uuid,p_references jsonb)
returns void language plpgsql stable security definer
set search_path=pg_catalog,editorial,messaging
as $$
declare i jsonb; r uuid; v uuid; k text;
begin
  if p_references is null then return; end if;
  if jsonb_typeof(p_references)<>'array' or jsonb_array_length(p_references)>4 then
    raise exception using errcode='22023', message='resource_references must be an array of at most four items.';
  end if;
  for i in select value from jsonb_array_elements(p_references) loop
    r:=nullif(i->>'resource_id','')::uuid;
    v:=nullif(i->>'resource_version_id','')::uuid;
    k:=coalesce(nullif(i->>'presentation_kind',''),'resource');
    if r is null or k not in('resource','version') or (k='resource' and v is not null) or (k='version' and v is null) or not messaging.can_user_reference_resource(p_user_id,r,v) then
      raise exception using errcode='42501', message='The Resource reference is not permitted.';
    end if;
  end loop;
end $$;

create or replace function messaging.default_first_contact_disposition(p_sender_category text)
returns text language sql immutable set search_path=pg_catalog
as $$ select case when p_sender_category in('staff','system') then 'inbox' else 'requests' end $$;

create or replace function messaging.default_allow_links(p_sender_category text)
returns boolean language sql immutable set search_path=pg_catalog
as $$ select p_sender_category in('staff','system') $$;

create or replace function messaging.default_allow_media(p_sender_category text)
returns boolean language sql immutable set search_path=pg_catalog
as $$ select false $$;

create or replace function messaging.default_allow_resource_references(p_sender_category text)
returns boolean language sql immutable set search_path=pg_catalog
as $$ select p_sender_category in('staff','system') $$;

create or replace function messaging.default_show_read_receipts(p_sender_category text)
returns boolean language sql immutable set search_path=pg_catalog
as $$ select false $$;

create or replace function messaging.message_contains_link(p_body text)
returns boolean language sql immutable set search_path=pg_catalog
as $$ select coalesce(p_body,'') ~* '(^|[[:space:]])(https?://|www\.)' $$;

create or replace function messaging.recipient_content_allows(p_recipient_user_id uuid,p_sender_category text,p_body text,p_references jsonb)
returns boolean language sql stable security definer
set search_path=pg_catalog,messaging
as $$
  select
    (not messaging.message_contains_link(p_body) or coalesce(p.allow_links,messaging.default_allow_links(p_sender_category)))
    and (coalesce(jsonb_array_length(coalesce(p_references,'[]'::jsonb)),0)=0 or coalesce(p.allow_resource_references,messaging.default_allow_resource_references(p_sender_category)))
  from (select 1) seed
  left join messaging.user_sender_policies p
    on p.user_id=p_recipient_user_id and p.sender_category=p_sender_category
$$;

create or replace function messaging.insert_resource_references(p_message_id uuid,p_references jsonb)
returns void language plpgsql security definer
set search_path=pg_catalog,messaging
as $$
declare i jsonb;
begin
  if p_references is null then return; end if;
  for i in select value from jsonb_array_elements(p_references) loop
    insert into messaging.message_resource_references(message_id,resource_id,resource_version_id,presentation_kind)
    values(p_message_id,(i->>'resource_id')::uuid,nullif(i->>'resource_version_id','')::uuid,coalesce(nullif(i->>'presentation_kind',''),'resource'));
  end loop;
end $$;

create or replace function public.start_message_conversation(
  p_recipient_person_resource_id uuid,
  p_body text,
  p_resource_references jsonb,
  p_idempotency_key text,
  p_correlation_id uuid default null,
  p_client_created_at timestamptz default null
)
returns table(command_receipt_id uuid,receipt_status text,conversation_id uuid,message_id uuid,mailbox_folder text,first_contact_state text,idempotent_replay boolean)
language plpgsql security definer
set search_path=pg_catalog,auth,public,editorial,messaging,platform_private
as $$
declare
  me record; ru uuid; rc text; body text; corr uuid; req jsonb; b record; res jsonb;
  conv uuid; sp uuid; rp uuid; msg uuid; disp text; fcs text; folder text; approved boolean;
begin
  select * into me from messaging.current_human_identity();
  if p_recipient_person_resource_id is null or p_recipient_person_resource_id=me.person_resource_id then
    raise exception using errcode='22023',message='A different recipient Person is required.';
  end if;
  body:=nullif(btrim(coalesce(p_body,'')),'');
  if body is null or octet_length(body)>10000 then raise exception using errcode='22023',message='Message body is required and must not exceed 10 KB.'; end if;
  corr:=messaging.command_correlation(me.user_id,'messages.conversation.start',p_idempotency_key,p_correlation_id);
  req:=jsonb_build_object('recipient_person_resource_id',p_recipient_person_resource_id,'body',body,'resource_references',coalesce(p_resource_references,'[]'::jsonb),'client_created_at',p_client_created_at,'correlation_id',corr);
  select * into b from platform_private.begin_authenticated_resource_command('messages.conversation.start',me.person_resource_id,p_idempotency_key,req);
  if b.idempotent_replay then
    res:=b.result_payload;
    command_receipt_id:=b.command_receipt_id; receipt_status:=b.receipt_status;
    conversation_id:=nullif(res->>'conversation_id','')::uuid; message_id:=nullif(res->>'message_id','')::uuid;
    mailbox_folder:=res->>'mailbox_folder'; first_contact_state:=res->>'first_contact_state'; idempotent_replay:=true;
    return next; return;
  end if;
  perform messaging.validate_resource_references(me.user_id,p_resource_references);
  ru:=messaging.active_user_for_person(p_recipient_person_resource_id);
  if ru is null then raise exception using errcode='P0002',message='The recipient is not available for Messages.'; end if;
  rc:=messaging.user_sender_category(ru);
  if not messaging.audience_allows_category(me.sender_category) or not messaging.audience_allows_category(rc) then
    raise exception using errcode='42501',message='Messages is not enabled for this audience.';
  end if;
  if messaging.person_blocked_between(me.user_id,p_recipient_person_resource_id) then
    raise exception using errcode='42501',message='This conversation cannot be started.';
  end if;
  if not messaging.recipient_content_allows(ru,me.sender_category,body,p_resource_references) then
    raise exception using errcode='42501',message='The recipient does not allow this Message content.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('messages-direct-pair:'||least(me.person_resource_id::text,p_recipient_person_resource_id::text)||':'||greatest(me.person_resource_id::text,p_recipient_person_resource_id::text),0));
  select c.id into conv
  from messaging.conversations c
  where c.conversation_kind='direct' and c.status='active'
    and (select count(*) from messaging.conversation_participants x where x.conversation_id=c.id and x.actor_kind='human' and x.membership_status='active')=2
    and exists(select 1 from messaging.conversation_participants x where x.conversation_id=c.id and x.person_resource_id=me.person_resource_id and x.membership_status='active')
    and exists(select 1 from messaging.conversation_participants x where x.conversation_id=c.id and x.person_resource_id=p_recipient_person_resource_id and x.membership_status='active')
  order by c.created_at desc limit 1;
  if conv is not null then
    select id into sp from messaging.conversation_participants where conversation_id=conv and person_resource_id=me.person_resource_id and membership_status='active';
    select id,mailbox_folder,first_contact_state into rp,folder,fcs from messaging.conversation_participants where conversation_id=conv and person_resource_id=p_recipient_person_resource_id and membership_status='active' for update;
    if fcs='declined' then raise exception using errcode='42501',message='The recipient declined this Message request.'; end if;
  else
    select exists(select 1 from messaging.sender_approvals a where a.recipient_person_resource_id=p_recipient_person_resource_id and a.sender_actor_kind='human' and a.sender_person_resource_id=me.person_resource_id and a.status='active') into approved;
    select coalesce((select first_contact_disposition from messaging.user_sender_policies where user_id=ru and sender_category=me.sender_category),messaging.default_first_contact_disposition(me.sender_category)) into disp;
    if disp='reject' then raise exception using errcode='42501',message='The recipient is not accepting new Messages from this sender category.'; end if;
    if approved or disp='inbox' then folder:='inbox'; fcs:='accepted'; else folder:='requests'; fcs:='pending'; end if;
    insert into messaging.conversations(security_classification,status,created_at,last_activity_at,correlation_id)
    values('standard','active',now(),now(),corr) returning id into conv;
    insert into messaging.conversation_participants(conversation_id,actor_kind,person_resource_id,user_id,membership_status,mailbox_folder,first_contact_state)
    values(conv,'human',me.person_resource_id,me.user_id,'active','inbox','not_applicable') returning id into sp;
    insert into messaging.conversation_participants(conversation_id,actor_kind,person_resource_id,user_id,membership_status,mailbox_folder,first_contact_state)
    values(conv,'human',p_recipient_person_resource_id,ru,'active',folder,fcs) returning id into rp;
    update messaging.conversations set created_by_participant_id=sp where id=conv;
  end if;
  insert into messaging.messages(conversation_id,sender_participant_id,message_kind,body,accepted_at,client_created_at,correlation_id,command_receipt_id)
  values(conv,sp,'text',body,now(),p_client_created_at,corr,b.command_receipt_id) returning id into msg;
  perform messaging.insert_resource_references(msg,p_resource_references);
  insert into messaging.message_receipts(message_id,participant_id,conversation_id,delivery_state,delivered_at)
  values(msg,rp,conv,'delivered',now());
  update messaging.conversations set last_activity_at=now() where id=conv;
  perform platform_private.complete_resource_command(b.command_receipt_id,jsonb_build_object('conversation_id',conv,'message_id',msg,'mailbox_folder',folder,'first_contact_state',fcs,'correlation_id',corr));
  command_receipt_id:=b.command_receipt_id; receipt_status:='succeeded'; conversation_id:=conv; message_id:=msg; mailbox_folder:=folder; first_contact_state:=fcs; idempotent_replay:=false;
  return next;
end $$;

create or replace function public.send_message(
  p_conversation_id uuid,
  p_body text,
  p_resource_references jsonb,
  p_idempotency_key text,
  p_correlation_id uuid default null,
  p_client_created_at timestamptz default null
)
returns table(command_receipt_id uuid,receipt_status text,conversation_id uuid,message_id uuid,idempotent_replay boolean)
language plpgsql security definer
set search_path=pg_catalog,auth,public,editorial,messaging,platform_private
as $$
declare me record; sp uuid; body text; corr uuid; req jsonb; b record; msg uuid; o record;
begin
  select * into me from messaging.current_human_identity();
  body:=nullif(btrim(coalesce(p_body,'')),'');
  if body is null or octet_length(body)>10000 then raise exception using errcode='22023',message='Message body is required and must not exceed 10 KB.'; end if;
  corr:=messaging.command_correlation(me.user_id,'messages.message.send',p_idempotency_key,p_correlation_id);
  req:=jsonb_build_object('conversation_id',p_conversation_id,'body',body,'resource_references',coalesce(p_resource_references,'[]'::jsonb),'client_created_at',p_client_created_at,'correlation_id',corr);
  select * into b from platform_private.begin_authenticated_resource_command('messages.message.send',me.person_resource_id,p_idempotency_key,req);
  if b.idempotent_replay then
    command_receipt_id:=b.command_receipt_id; receipt_status:=b.receipt_status;
    conversation_id:=nullif(b.result_payload->>'conversation_id','')::uuid; message_id:=nullif(b.result_payload->>'message_id','')::uuid; idempotent_replay:=true;
    return next; return;
  end if;
  perform messaging.validate_resource_references(me.user_id,p_resource_references);
  select cp.id into sp
  from messaging.conversation_participants cp join messaging.conversations c on c.id=cp.conversation_id
  where cp.conversation_id=p_conversation_id and cp.person_resource_id=me.person_resource_id and cp.user_id=me.user_id and cp.membership_status='active' and c.status='active'
  for update;
  if sp is null then raise exception using errcode='42501',message='Active conversation membership is required.'; end if;
  for o in select cp.* from messaging.conversation_participants cp where cp.conversation_id=p_conversation_id and cp.id<>sp and cp.membership_status='active' and cp.actor_kind='human' loop
    if not messaging.audience_allows_category(me.sender_category)
       or not messaging.audience_allows_category(messaging.user_sender_category(o.user_id))
       or messaging.person_blocked_between(me.user_id,o.person_resource_id)
       or o.first_contact_state='declined'
       or not messaging.recipient_content_allows(o.user_id,me.sender_category,body,p_resource_references)
    then raise exception using errcode='42501',message='This Message cannot be delivered.'; end if;
  end loop;
  insert into messaging.messages(conversation_id,sender_participant_id,message_kind,body,accepted_at,client_created_at,correlation_id,command_receipt_id)
  values(p_conversation_id,sp,'text',body,now(),p_client_created_at,corr,b.command_receipt_id) returning id into msg;
  perform messaging.insert_resource_references(msg,p_resource_references);
  insert into messaging.message_receipts(message_id,participant_id,conversation_id,delivery_state,delivered_at)
  select msg,cp.id,p_conversation_id,'delivered',now() from messaging.conversation_participants cp where cp.conversation_id=p_conversation_id and cp.id<>sp and cp.membership_status='active';
  update messaging.conversations set last_activity_at=now() where id=p_conversation_id;
  perform platform_private.complete_resource_command(b.command_receipt_id,jsonb_build_object('conversation_id',p_conversation_id,'message_id',msg,'correlation_id',corr));
  command_receipt_id:=b.command_receipt_id; receipt_status:='succeeded'; conversation_id:=p_conversation_id; message_id:=msg; idempotent_replay:=false;
  return next;
end $$;

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
  select x.* into s from messaging.conversation_participants x where x.conversation_id=p_conversation_id and x.id<>cp.id and x.membership_status='active' and x.actor_kind='human' limit 1;
  insert into messaging.sender_approvals(recipient_person_resource_id,recipient_user_id,sender_actor_kind,sender_person_resource_id,status,approved_at,revoked_at,created_from_conversation_id,updated_at)
  values(me.person_resource_id,me.user_id,'human',s.person_resource_id,'active',now(),null,p_conversation_id,now())
  on conflict(recipient_person_resource_id,sender_person_resource_id) where sender_actor_kind='human'
  do update set status='active',revoked_at=null,recipient_user_id=excluded.recipient_user_id,approved_at=now(),created_from_conversation_id=excluded.created_from_conversation_id,updated_at=now();
  update messaging.conversation_participants set first_contact_state='accepted',mailbox_folder='inbox',mailbox_updated_at=now() where id=cp.id;
  r:=jsonb_build_object('conversation_id',p_conversation_id,'accepted',true,'correlation_id',corr);
  perform platform_private.complete_resource_command(b.command_receipt_id,r); return r;
end $$;

create or replace function public.decline_message_request(p_conversation_id uuid,p_idempotency_key text,p_correlation_id uuid default null)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,auth,public,editorial,messaging,platform_private
as $$
declare me record; cp messaging.conversation_participants%rowtype; b record; r jsonb; corr uuid;
begin
  select * into me from messaging.current_human_identity();
  corr:=messaging.command_correlation(me.user_id,'messages.request.decline',p_idempotency_key,p_correlation_id);
  select * into b from platform_private.begin_authenticated_resource_command('messages.request.decline',me.person_resource_id,p_idempotency_key,jsonb_build_object('conversation_id',p_conversation_id,'correlation_id',corr));
  if b.idempotent_replay then return b.result_payload; end if;
  select x.* into cp from messaging.conversation_participants x where x.conversation_id=p_conversation_id and x.person_resource_id=me.person_resource_id and x.user_id=me.user_id and x.membership_status='active' for update;
  if cp.id is null or cp.first_contact_state<>'pending' then raise exception using errcode='22023',message='A pending Message request is required.'; end if;
  update messaging.conversation_participants set first_contact_state='declined',mailbox_folder='archived',mailbox_updated_at=now() where id=cp.id;
  r:=jsonb_build_object('conversation_id',p_conversation_id,'declined',true,'correlation_id',corr);
  perform platform_private.complete_resource_command(b.command_receipt_id,r); return r;
end $$;

create or replace function public.move_message_conversation(p_conversation_id uuid,p_folder text,p_idempotency_key text,p_correlation_id uuid default null)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,auth,public,editorial,messaging,platform_private
as $$
declare me record; cp messaging.conversation_participants%rowtype; f text; b record; r jsonb; corr uuid;
begin
  select * into me from messaging.current_human_identity();
  f:=lower(btrim(coalesce(p_folder,'')));
  if f not in('inbox','requests','spam','archived') then raise exception using errcode='22023',message='Message folder is invalid.'; end if;
  corr:=messaging.command_correlation(me.user_id,'messages.mailbox.move',p_idempotency_key,p_correlation_id);
  select * into b from platform_private.begin_authenticated_resource_command('messages.mailbox.move',me.person_resource_id,p_idempotency_key,jsonb_build_object('conversation_id',p_conversation_id,'folder',f,'correlation_id',corr));
  if b.idempotent_replay then return b.result_payload; end if;
  select x.* into cp from messaging.conversation_participants x where x.conversation_id=p_conversation_id and x.person_resource_id=me.person_resource_id and x.user_id=me.user_id and x.membership_status='active' for update;
  if cp.id is null then raise exception using errcode='42501',message='Active conversation membership is required.'; end if;
  if cp.first_contact_state='pending' and f not in('requests','spam') then raise exception using errcode='42501',message='Accept or decline the Message request before moving it out of Requests or Spam.'; end if;
  if cp.first_contact_state='declined' and f<>'archived' then raise exception using errcode='42501',message='A declined Message request remains archived.'; end if;
  if cp.first_contact_state in('accepted','not_applicable') and f='requests' then raise exception using errcode='42501',message='Only pending Message requests may use the Requests folder.'; end if;
  update messaging.conversation_participants set mailbox_folder=f,mailbox_updated_at=now() where id=cp.id;
  r:=jsonb_build_object('conversation_id',p_conversation_id,'folder',f,'correlation_id',corr);
  perform platform_private.complete_resource_command(b.command_receipt_id,r); return r;
end $$;

create or replace function public.revoke_message_sender_approval(p_sender_person_resource_id uuid,p_idempotency_key text,p_correlation_id uuid default null)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,auth,public,editorial,messaging,platform_private
as $$
declare me record; b record; r jsonb; changed boolean; corr uuid;
begin
  select * into me from messaging.current_human_identity();
  if p_sender_person_resource_id is null or p_sender_person_resource_id=me.person_resource_id then raise exception using errcode='22023',message='A different sender Person is required.'; end if;
  corr:=messaging.command_correlation(me.user_id,'messages.sender_approval.revoke',p_idempotency_key,p_correlation_id);
  select * into b from platform_private.begin_authenticated_resource_command('messages.sender_approval.revoke',me.person_resource_id,p_idempotency_key,jsonb_build_object('sender_person_resource_id',p_sender_person_resource_id,'correlation_id',corr));
  if b.idempotent_replay then return b.result_payload; end if;
  update messaging.sender_approvals set status='revoked',revoked_at=now(),updated_at=now()
  where recipient_person_resource_id=me.person_resource_id and sender_actor_kind='human' and sender_person_resource_id=p_sender_person_resource_id and status='active';
  changed:=found;
  r:=jsonb_build_object('sender_person_resource_id',p_sender_person_resource_id,'revoked',changed,'correlation_id',corr);
  perform platform_private.complete_resource_command(b.command_receipt_id,r); return r;
end $$;

create or replace function public.update_my_message_sender_policy(
  p_sender_category text,p_expected_revision bigint,p_first_contact_disposition text,
  p_allow_links boolean,p_allow_media boolean,p_allow_resource_references boolean,p_show_read_receipts boolean,
  p_idempotency_key text,p_correlation_id uuid default null
)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,auth,public,editorial,messaging,platform_private
as $$
declare me record; c text; d text; cur messaging.user_sender_policies%rowtype; b record; rev bigint; r jsonb; corr uuid;
begin
  select * into me from messaging.current_human_identity();
  c:=lower(btrim(coalesce(p_sender_category,''))); d:=lower(btrim(coalesce(p_first_contact_disposition,'')));
  if c not in('staff','system','contributors','members','public') or d not in('inbox','requests','reject') or p_expected_revision is null or p_expected_revision<0 then
    raise exception using errcode='22023',message='Message sender policy input is invalid.';
  end if;
  corr:=messaging.command_correlation(me.user_id,'messages.preferences.update',p_idempotency_key,p_correlation_id);
  select * into b from platform_private.begin_authenticated_resource_command('messages.preferences.update',me.person_resource_id,p_idempotency_key,jsonb_build_object('sender_category',c,'expected_revision',p_expected_revision,'first_contact_disposition',d,'allow_links',coalesce(p_allow_links,false),'allow_media',coalesce(p_allow_media,false),'allow_resource_references',coalesce(p_allow_resource_references,false),'show_read_receipts',coalesce(p_show_read_receipts,false),'correlation_id',corr));
  if b.idempotent_replay then return b.result_payload; end if;
  select x.* into cur from messaging.user_sender_policies x where x.user_id=me.user_id and x.sender_category=c for update;
  if cur.user_id is null then
    if p_expected_revision<>0 then raise exception using errcode='40001',message='Message sender policy revision changed.'; end if;
    rev:=1;
  else
    if cur.revision<>p_expected_revision then raise exception using errcode='40001',message='Message sender policy revision changed.'; end if;
    rev:=cur.revision+1;
  end if;
  insert into messaging.user_sender_policies(user_id,sender_category,first_contact_disposition,allow_links,allow_media,allow_resource_references,show_read_receipts,updated_at,revision)
  values(me.user_id,c,d,coalesce(p_allow_links,false),coalesce(p_allow_media,false),coalesce(p_allow_resource_references,false),coalesce(p_show_read_receipts,false),now(),rev)
  on conflict(user_id,sender_category) do update set first_contact_disposition=excluded.first_contact_disposition,allow_links=excluded.allow_links,allow_media=excluded.allow_media,allow_resource_references=excluded.allow_resource_references,show_read_receipts=excluded.show_read_receipts,updated_at=excluded.updated_at,revision=excluded.revision;
  r:=jsonb_build_object('sender_category',c,'revision',rev,'first_contact_disposition',d,'allow_links',coalesce(p_allow_links,false),'allow_media',coalesce(p_allow_media,false),'allow_resource_references',coalesce(p_allow_resource_references,false),'show_read_receipts',coalesce(p_show_read_receipts,false),'correlation_id',corr);
  perform platform_private.complete_resource_command(b.command_receipt_id,r); return r;
end $$;

create or replace function public.mark_my_message_conversation_read(p_conversation_id uuid,p_through_message_id uuid default null)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,auth,public,editorial,messaging
as $$
declare me record; pid uuid; cutoff timestamptz; at timestamptz:=now(); n bigint;
begin
  select * into me from messaging.current_human_identity();
  select id into pid from messaging.conversation_participants where conversation_id=p_conversation_id and person_resource_id=me.person_resource_id and user_id=me.user_id and membership_status='active';
  if pid is null then raise exception using errcode='42501',message='Active conversation membership is required.'; end if;
  if p_through_message_id is null then cutoff:='infinity'::timestamptz;
  else
    select accepted_at into cutoff from messaging.messages where id=p_through_message_id and conversation_id=p_conversation_id;
    if cutoff is null then raise exception using errcode='P0002',message='The Message does not belong to this Conversation.'; end if;
  end if;
  update messaging.message_receipts r set read_at=coalesce(r.read_at,at)
  from messaging.messages m
  where r.message_id=m.id and r.participant_id=pid and r.conversation_id=p_conversation_id and m.accepted_at<=cutoff and r.read_at is null;
  get diagnostics n=row_count;
  return jsonb_build_object('conversation_id',p_conversation_id,'marked_read',n,'read_at',at);
end $$;

create or replace function public.get_my_message_preferences()
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,auth,public,editorial,messaging
as $$
declare me record;
begin
  select * into me from messaging.current_human_identity();
  return (
    select jsonb_agg(jsonb_build_object(
      'sender_category',c.category,
      'first_contact_disposition',coalesce(p.first_contact_disposition,messaging.default_first_contact_disposition(c.category)),
      'allow_links',coalesce(p.allow_links,messaging.default_allow_links(c.category)),
      'allow_media',coalesce(p.allow_media,messaging.default_allow_media(c.category)),
      'allow_resource_references',coalesce(p.allow_resource_references,messaging.default_allow_resource_references(c.category)),
      'show_read_receipts',coalesce(p.show_read_receipts,messaging.default_show_read_receipts(c.category)),
      'revision',coalesce(p.revision,0)
    ) order by c.ordinality)
    from unnest(array['staff','system','contributors','members','public']) with ordinality c(category,ordinality)
    left join messaging.user_sender_policies p on p.user_id=me.user_id and p.sender_category=c.category
  );
end $$;

create or replace function public.get_my_message_unread_counts()
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,auth,public,editorial,messaging
as $$
declare me record;
begin
  select * into me from messaging.current_human_identity();
  return coalesce((
    select jsonb_object_agg(folder,n)
    from (
      select cp.mailbox_folder folder,count(*)::bigint n
      from messaging.message_receipts r
      join messaging.conversation_participants cp on cp.id=r.participant_id
      where cp.user_id=me.user_id and cp.person_resource_id=me.person_resource_id and cp.membership_status='active' and r.read_at is null
      group by cp.mailbox_folder
    ) x
  ),'{}'::jsonb);
end $$;

create or replace function public.list_my_message_conversations(
  p_folder text default 'inbox',p_before_last_activity_at timestamptz default null,p_before_conversation_id uuid default null,p_limit integer default 30
)
returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,auth,public,editorial,messaging
as $$
declare me record; f text; lim integer;
begin
  select * into me from messaging.current_human_identity();
  f:=lower(btrim(coalesce(p_folder,'inbox'))); lim:=greatest(1,least(coalesce(p_limit,30),100));
  if f not in('inbox','requests','spam','archived') then raise exception using errcode='22023',message='Message folder is invalid.'; end if;
  return coalesce((
    select jsonb_agg(item order by (item->>'last_activity_at')::timestamptz desc,(item->>'conversation_id')::uuid desc)
    from (
      select jsonb_build_object(
        'conversation_id',c.id,
        'security_classification',c.security_classification,
        'status',c.status,
        'mailbox_folder',m.mailbox_folder,
        'first_contact_state',m.first_contact_state,
        'last_activity_at',c.last_activity_at,
        'other_participant',jsonb_build_object('person_resource_id',o.person_resource_id,'presentation',editorial.resolve_person_presentation(o.person_resource_id)),
        'latest_message',(select jsonb_build_object('id',x.id,'body',x.body,'accepted_at',x.accepted_at,'sender_person_resource_id',s.person_resource_id) from messaging.messages x join messaging.conversation_participants s on s.id=x.sender_participant_id where x.conversation_id=c.id order by x.accepted_at desc,x.id desc limit 1),
        'unread_count',(select count(*) from messaging.message_receipts r where r.participant_id=m.id and r.read_at is null)
      ) item
      from messaging.conversation_participants m
      join messaging.conversations c on c.id=m.conversation_id
      left join messaging.conversation_participants o on o.conversation_id=c.id and o.id<>m.id and o.membership_status='active'
      where m.user_id=me.user_id and m.person_resource_id=me.person_resource_id and m.membership_status='active' and m.mailbox_folder=f
        and (p_before_last_activity_at is null or (c.last_activity_at,c.id)<(p_before_last_activity_at,coalesce(p_before_conversation_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
      order by c.last_activity_at desc,c.id desc limit lim
    ) q
  ),'[]'::jsonb);
end $$;

create or replace function public.get_my_message_conversation(
  p_conversation_id uuid,p_before_accepted_at timestamptz default null,p_before_message_id uuid default null,p_limit integer default 50
)
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
    'participants',(select jsonb_agg(jsonb_build_object('person_resource_id',x.person_resource_id,'presentation',editorial.resolve_person_presentation(x.person_resource_id),'membership_status',x.membership_status) order by x.joined_at,x.id) from messaging.conversation_participants x where x.conversation_id=p_conversation_id and x.actor_kind='human'),
    'messages',coalesce((
      select jsonb_agg(j order by at desc,id desc)
      from (
        select m.id,m.accepted_at at,
          jsonb_build_object(
            'id',m.id,'message_kind',m.message_kind,'body',m.body,'accepted_at',m.accepted_at,'client_created_at',m.client_created_at,'sender_person_resource_id',s.person_resource_id,
            'my_read_at',mr.read_at,
            'recipient_read_at',case when s.id=mine.id then (
              select case when coalesce(pol.show_read_receipts,messaging.default_show_read_receipts(messaging.user_sender_category(me.user_id))) then rr.read_at else null end
              from messaging.message_receipts rr
              join messaging.conversation_participants rec on rec.id=rr.participant_id
              left join messaging.user_sender_policies pol on pol.user_id=rec.user_id and pol.sender_category=messaging.user_sender_category(me.user_id)
              where rr.message_id=m.id and rec.id<>mine.id order by rec.id limit 1
            ) else null end,
            'resource_references',coalesce((
              select jsonb_agg(jsonb_build_object('resource_id',ref.resource_id,'resource_version_id',ref.resource_version_id,'presentation_kind',ref.presentation_kind) order by ref.created_at,ref.id)
              from messaging.message_resource_references ref
              where ref.message_id=m.id and messaging.can_user_reference_resource(me.user_id,ref.resource_id,ref.resource_version_id)
            ),'[]'::jsonb)
          ) j
        from messaging.messages m
        join messaging.conversation_participants s on s.id=m.sender_participant_id
        left join messaging.message_receipts mr on mr.message_id=m.id and mr.participant_id=mine.id
        where m.conversation_id=p_conversation_id
          and (p_before_accepted_at is null or (m.accepted_at,m.id)<(p_before_accepted_at,coalesce(p_before_message_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
        order by m.accepted_at desc,m.id desc limit lim
      ) pg
    ),'[]'::jsonb)
  );
end $$;

revoke all on function messaging.current_human_identity(),messaging.command_correlation(uuid,text,text,uuid),messaging.active_user_for_person(uuid),messaging.user_sender_category(uuid),messaging.audience_allows_category(text),messaging.person_blocked_between(uuid,uuid),messaging.can_user_reference_resource(uuid,uuid,uuid),messaging.validate_resource_references(uuid,jsonb),messaging.default_first_contact_disposition(text),messaging.default_allow_links(text),messaging.default_allow_media(text),messaging.default_allow_resource_references(text),messaging.default_show_read_receipts(text),messaging.message_contains_link(text),messaging.recipient_content_allows(uuid,text,text,jsonb),messaging.insert_resource_references(uuid,jsonb) from public,anon,authenticated,service_role;

revoke all on function public.start_message_conversation(uuid,text,jsonb,text,uuid,timestamptz),public.send_message(uuid,text,jsonb,text,uuid,timestamptz),public.accept_message_request(uuid,text,uuid),public.decline_message_request(uuid,text,uuid),public.move_message_conversation(uuid,text,text,uuid),public.revoke_message_sender_approval(uuid,text,uuid),public.update_my_message_sender_policy(text,bigint,text,boolean,boolean,boolean,boolean,text,uuid),public.mark_my_message_conversation_read(uuid,uuid),public.get_my_message_preferences(),public.get_my_message_unread_counts(),public.list_my_message_conversations(text,timestamptz,uuid,integer),public.get_my_message_conversation(uuid,timestamptz,uuid,integer) from public,anon;

grant execute on function public.start_message_conversation(uuid,text,jsonb,text,uuid,timestamptz),public.send_message(uuid,text,jsonb,text,uuid,timestamptz),public.accept_message_request(uuid,text,uuid),public.decline_message_request(uuid,text,uuid),public.move_message_conversation(uuid,text,text,uuid),public.revoke_message_sender_approval(uuid,text,uuid),public.update_my_message_sender_policy(text,bigint,text,boolean,boolean,boolean,boolean,text,uuid),public.mark_my_message_conversation_read(uuid,uuid),public.get_my_message_preferences(),public.get_my_message_unread_counts(),public.list_my_message_conversations(text,timestamptz,uuid,integer),public.get_my_message_conversation(uuid,timestamptz,uuid,integer) to authenticated;

commit;