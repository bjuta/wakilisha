-- Phase 8B.3 browser-acceptance correction.
--
-- Existing direct-conversation reuse in start_message_conversation() used
-- unqualified conversation_id references inside a RETURNS TABLE function whose
-- output column is also named conversation_id. PostgreSQL therefore raises
-- "column reference \"conversation_id\" is ambiguous" when the pair already
-- has an active direct conversation.
--
-- This forward correction changes only the two existing-conversation
-- participant lookups to use an explicit table alias.

begin;

set local statement_timeout = '30s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'phase-8b-messages-existing-conversation-ambiguity-fix',
    0
  )
);

do $phase_8b_existing_conversation_preflight$
declare
  v_definition text;
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260906154236'
      and name = 'phase_8b_messages_user_commands_reads'
  ) then
    raise exception
      'STOP: Messages user-command authority is missing';
  end if;

  select pg_catalog.pg_get_functiondef(proc.oid)
  into v_definition
  from pg_catalog.pg_proc proc
  join pg_catalog.pg_namespace namespace
    on namespace.oid = proc.pronamespace
  where namespace.nspname = 'public'
    and proc.proname = 'start_message_conversation'
    and pg_catalog.pg_get_function_identity_arguments(
      proc.oid
    ) =
      'p_recipient_person_resource_id uuid, p_body text, p_resource_references jsonb, p_idempotency_key text, p_correlation_id uuid, p_client_created_at timestamp with time zone';

  if v_definition is null then
    raise exception
      'STOP: start_message_conversation authority is missing';
  end if;

  if position(
       'where conversation_id=conv' in
       replace(v_definition, ' ', '')
     ) = 0
     and position(
       'whereconversation_id=conv' in
       replace(v_definition, ' ', '')
     ) = 0
  then
    -- The exact historical defect is expected before this correction. Avoid
    -- refusing a replay merely because PostgreSQL normalized whitespace.
    null;
  end if;
end;
$phase_8b_existing_conversation_preflight$;

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
    select cp.id into sp from messaging.conversation_participants cp where cp.conversation_id=conv and cp.person_resource_id=me.person_resource_id and cp.membership_status='active';
    select cp.id,cp.mailbox_folder,cp.first_contact_state into rp,folder,fcs from messaging.conversation_participants cp where cp.conversation_id=conv and cp.person_resource_id=p_recipient_person_resource_id and cp.membership_status='active' for update;
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

do $phase_8b_existing_conversation_postcheck$
declare
  v_definition text;
begin
  select pg_catalog.pg_get_functiondef(proc.oid)
  into v_definition
  from pg_catalog.pg_proc proc
  join pg_catalog.pg_namespace namespace
    on namespace.oid = proc.pronamespace
  where namespace.nspname = 'public'
    and proc.proname = 'start_message_conversation'
    and pg_catalog.pg_get_function_identity_arguments(
      proc.oid
    ) =
      'p_recipient_person_resource_id uuid, p_body text, p_resource_references jsonb, p_idempotency_key text, p_correlation_id uuid, p_client_created_at timestamp with time zone';

  if v_definition is null
     or position(
       'cp.conversation_id' in v_definition
     ) = 0
     or position(
       'cp.person_resource_id' in v_definition
     ) = 0
  then
    raise exception
      'STOP: qualified existing-conversation lookup did not land';
  end if;
end;
$phase_8b_existing_conversation_postcheck$;

commit;
