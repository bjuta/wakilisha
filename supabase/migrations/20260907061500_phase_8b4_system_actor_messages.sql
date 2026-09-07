-- Phase 8B.4 Candidate A: accountable System Actors + governed System Messages.
--
-- This migration deliberately reuses the accepted Messages, command-receipt,
-- notification, Person, and role/capability authorities. It does not create a
-- second scheduler, jobs queue, outbox, notification store, Person/Auth
-- identity, Field messaging authority, or workflow engine.

begin;

set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'phase-8b4-system-actor-messages',
    0
  )
);

do $phase_8b4_preflight$
begin
  if pg_catalog.to_regnamespace('messaging') is null
     or pg_catalog.to_regclass('messaging.messages') is null
     or pg_catalog.to_regclass('messaging.conversation_participants') is null
     or pg_catalog.to_regclass('messaging.sender_approvals') is null
     or pg_catalog.to_regclass('platform_private.command_receipts') is null
     or pg_catalog.to_regclass('platform_private.command_types') is null
     or pg_catalog.to_regclass('public.community_notifications') is null
  then
    raise exception 'STOP: accepted Messages/platform authority is missing';
  end if;

  if pg_catalog.to_regprocedure(
       'platform_private.begin_authenticated_resource_command(text,uuid,text,jsonb)'
     ) is null
     or pg_catalog.to_regprocedure(
       'platform_private.command_request_fingerprint(text,uuid,jsonb)'
     ) is null
     or pg_catalog.to_regprocedure(
       'platform_private.complete_resource_command(uuid,jsonb)'
     ) is null
     or pg_catalog.to_regprocedure(
       'messaging.emit_direct_message_notification()'
     ) is null
  then
    raise exception 'STOP: accepted command/notification helpers are missing';
  end if;

  if pg_catalog.to_regclass('platform_private.system_actors') is not null
     or pg_catalog.to_regclass('platform_private.system_actor_executor_bindings') is not null
     or pg_catalog.to_regclass('platform_private.system_actor_message_policies') is not null
     or pg_catalog.to_regprocedure(
       'platform_private.send_system_message(text,uuid,text,text,jsonb,text,uuid,timestamp with time zone)'
     ) is not null
  then
    raise exception 'STOP: Phase 8B.4 Candidate A authority already exists';
  end if;
end;
$phase_8b4_preflight$;

-- -------------------------------------------------------------------------
-- Accountable System Actor identity and executor binding.
-- -------------------------------------------------------------------------

create table platform_private.system_actors (
  actor_key text primary key,
  label text not null,
  actor_kind text not null default 'system',
  status text not null default 'active',
  capability_profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint system_actors_key_check
    check (actor_key ~ '^[a-z][a-z0-9_.:-]{1,99}$'),
  constraint system_actors_label_check
    check (btrim(label) <> '' and octet_length(label) <= 160),
  constraint system_actors_kind_check
    check (actor_kind in ('system','automation')),
  constraint system_actors_status_check
    check (status in ('active','disabled')),
  constraint system_actors_capability_profile_check
    check (
      jsonb_typeof(capability_profile) = 'object'
      and octet_length(capability_profile::text) <= 8192
    )
);

create table platform_private.system_actor_executor_bindings (
  actor_key text not null,
  executor_kind text not null,
  executor_key text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (actor_key, executor_kind, executor_key),
  foreign key (actor_key)
    references platform_private.system_actors(actor_key)
    on update restrict on delete restrict,
  constraint system_actor_executor_kind_check
    check (executor_kind in ('database_role')),
  constraint system_actor_executor_key_check
    check (btrim(executor_key) <> '' and octet_length(executor_key) <= 128),
  constraint system_actor_executor_status_check
    check (status in ('active','disabled'))
);

create table platform_private.system_actor_message_policies (
  actor_key text primary key,
  enabled boolean not null default false,
  permitted_purposes text[] not null,
  recipient_scope text not null,
  allow_links boolean not null default false,
  allow_resource_references boolean not null default false,
  allow_human_reply boolean not null default false,
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),

  foreign key (actor_key)
    references platform_private.system_actors(actor_key)
    on update restrict on delete restrict,
  constraint system_actor_message_purposes_check
    check (
      cardinality(permitted_purposes) between 1 and 32
      and not exists (
        select 1
        from unnest(permitted_purposes) purpose
        where purpose !~ '^[a-z][a-z0-9_.:-]{1,99}$'
      )
    ),
  constraint system_actor_message_recipient_scope_check
    check (recipient_scope in ('super_admin_only')),
  constraint system_actor_message_revision_check
    check (revision > 0)
);

comment on table platform_private.system_actors is
  'Accountable non-human actor identity. Executor credentials remain separate.';
comment on table platform_private.system_actor_executor_bindings is
  'Explicit binding between an accountable System Actor and an accepted runtime executor identity.';
comment on table platform_private.system_actor_message_policies is
  'Messages-only scope and kill control for accountable System Actors.';

revoke all on table
  platform_private.system_actors,
  platform_private.system_actor_executor_bindings,
  platform_private.system_actor_message_policies
from public, anon, authenticated, service_role;

insert into platform_private.system_actors (
  actor_key,
  label,
  actor_kind,
  status,
  capability_profile
)
values (
  'mizizi',
  'MIZIZI Cultural Data Steward',
  'system',
  'active',
  pg_catalog.jsonb_build_object(
    'domain','registry',
    'agent','mizizi',
    'ruleset_version','1.1.0'
  )
);

insert into platform_private.system_actor_executor_bindings (
  actor_key,
  executor_kind,
  executor_key,
  status
)
values (
  'mizizi',
  'database_role',
  'postgres',
  'active'
);

insert into platform_private.system_actor_message_policies (
  actor_key,
  enabled,
  permitted_purposes,
  recipient_scope,
  allow_links,
  allow_resource_references,
  allow_human_reply,
  revision
)
values (
  'mizizi',
  true,
  array['operational_update']::text[],
  'super_admin_only',
  false,
  false,
  false,
  1
);

-- -------------------------------------------------------------------------
-- Extend the shared durable principal grammar, not the receipt subsystem.
-- -------------------------------------------------------------------------

alter table platform_private.command_receipts
  drop constraint command_receipts_principal_key_check;

alter table platform_private.command_receipts
  add constraint command_receipts_principal_key_check
  check (
    principal_key = 'service:service_role'
    or principal_key ~
      '^user:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or principal_key ~
      '^system:[a-z][a-z0-9_.:-]{1,99}$'
  );

insert into platform_private.command_types (
  command_type,
  job_type,
  accepted_event_type,
  success_event_type,
  failure_event_type,
  retry_event_type,
  enabled
)
values
(
  'messages.system.send',
  'messages.system.send.sync',
  'messages.system.send.accepted',
  'messages.system.send.succeeded',
  'messages.system.send.failed',
  'messages.system.send.retry_scheduled',
  true
),
(
  'messages.system_actor.messaging.update',
  'messages.system_actor.messaging.update.sync',
  'messages.system_actor.messaging.update.accepted',
  'messages.system_actor.messaging.update.succeeded',
  'messages.system_actor.messaging.update.failed',
  'messages.system_actor.messaging.update.retry_scheduled',
  true
);

-- -------------------------------------------------------------------------
-- Private actor presentation and command primitives.
-- -------------------------------------------------------------------------

create function messaging.system_actor_presentation(p_actor_key text)
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog', 'platform_private'
as $function$
  select case
    when actor.actor_key is null then null
    else pg_catalog.jsonb_build_object(
      'actor_key', actor.actor_key,
      'label', actor.label,
      'actor_kind', actor.actor_kind,
      'status', actor.status
    )
  end
  from (select 1) seed
  left join platform_private.system_actors actor
    on actor.actor_key = p_actor_key
$function$;

create function messaging.participant_identity_json(
  p_actor_kind text,
  p_person_resource_id uuid,
  p_actor_key text
)
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog', 'editorial', 'messaging'
as $function$
  select case
    when p_actor_kind = 'human' then
      pg_catalog.jsonb_build_object(
        'actor_kind','human',
        'person_resource_id',p_person_resource_id,
        'actor_key',null,
        'presentation',editorial.resolve_person_presentation(p_person_resource_id)
      )
    when p_actor_kind in ('system','automation') then
      pg_catalog.jsonb_build_object(
        'actor_kind',p_actor_kind,
        'person_resource_id',null,
        'actor_key',p_actor_key,
        'presentation',messaging.system_actor_presentation(p_actor_key)
      )
    else null
  end
$function$;

create function platform_private.begin_system_resource_command(
  p_actor_key text,
  p_command_type text,
  p_resource_id uuid,
  p_idempotency_key text,
  p_request_payload jsonb
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'editorial', 'platform_private'
as $function$
declare
  v_fingerprint text;
  v_receipt platform_private.command_receipts%rowtype;
  v_created boolean;
  v_principal text;
begin
  if p_actor_key is null
     or p_actor_key !~ '^[a-z][a-z0-9_.:-]{1,99}$'
  then
    raise exception using errcode='22023', message='A valid System Actor key is required.';
  end if;

  if not exists (
    select 1
    from platform_private.system_actors actor
    where actor.actor_key=p_actor_key
      and actor.status='active'
  ) then
    raise exception using errcode='42501', message='The System Actor is not active.';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings binding
    where binding.actor_key=p_actor_key
      and binding.executor_kind='database_role'
      and binding.executor_key=session_user
      and binding.status='active'
  ) then
    raise exception using errcode='42501', message='The current executor is not bound to this System Actor.';
  end if;

  if p_resource_id is null
     or not exists (
       select 1 from editorial.resources resource_row
       where resource_row.id=p_resource_id
     )
  then
    raise exception using errcode='P0002', message='The command Resource does not exist.';
  end if;

  if p_idempotency_key is null
     or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
  then
    raise exception using errcode='22023', message='A valid idempotency key is required.';
  end if;

  if p_request_payload is null
     or pg_catalog.jsonb_typeof(p_request_payload) <> 'object'
     or octet_length(p_request_payload::text) > 32768
  then
    raise exception using errcode='22023', message='request_payload is invalid.';
  end if;

  if not exists (
    select 1 from platform_private.command_types command_type
    where command_type.command_type=p_command_type
      and command_type.enabled
  ) then
    raise exception using errcode='22023', message='The command type is missing or disabled.';
  end if;

  v_principal := 'system:' || p_actor_key;
  v_fingerprint := platform_private.command_request_fingerprint(
    p_command_type,
    p_resource_id,
    p_request_payload
  );

  insert into platform_private.command_receipts (
    command_type,
    resource_id,
    principal_key,
    actor_user_id,
    idempotency_key,
    request_fingerprint,
    request_payload
  )
  values (
    p_command_type,
    p_resource_id,
    v_principal,
    null,
    p_idempotency_key,
    v_fingerprint,
    p_request_payload
  )
  on conflict (principal_key,command_type,idempotency_key)
  do nothing
  returning * into v_receipt;

  v_created := found;

  if not v_created then
    select receipt.* into v_receipt
    from platform_private.command_receipts receipt
    where receipt.principal_key=v_principal
      and receipt.command_type=p_command_type
      and receipt.idempotency_key=p_idempotency_key
    for update;

    if not found then
      raise exception 'The System Actor idempotency receipt disappeared.';
    end if;

    if v_receipt.resource_id <> p_resource_id
       or v_receipt.request_fingerprint <> v_fingerprint
    then
      raise exception using
        errcode='23505',
        message='The idempotency key was already used for a different System Actor request.';
    end if;

    command_receipt_id := v_receipt.id;
    receipt_status := v_receipt.status;
    result_payload := v_receipt.result_payload;
    idempotent_replay := true;
    return next;
    return;
  end if;

  command_receipt_id := v_receipt.id;
  receipt_status := v_receipt.status;
  result_payload := v_receipt.result_payload;
  idempotent_replay := false;
  return next;
end;
$function$;

revoke all on function
  messaging.system_actor_presentation(text),
  messaging.participant_identity_json(text,uuid,text),
  platform_private.begin_system_resource_command(text,text,uuid,text,jsonb)
from public, anon, authenticated, service_role;

-- System is a first-class sender category under every recognized audience mode.
create or replace function messaging.audience_allows_category(p_category text)
returns boolean
language sql
stable
security definer
set search_path=pg_catalog,messaging
as $function$
  select case
    when p_category='system' then audience_mode in ('internal','contributors','members','public')
    when audience_mode='internal' then p_category='staff'
    when audience_mode='contributors' then p_category in('staff','contributors')
    when audience_mode='members' then p_category in('staff','contributors','members')
    when audience_mode='public' then p_category in('staff','contributors','members','public')
    else false
  end
  from messaging.runtime_policy
  where singleton
$function$;

revoke all on function messaging.audience_allows_category(text)
from public, anon, authenticated, service_role;

-- -------------------------------------------------------------------------
-- Governed System Actor -> Messages command.
-- -------------------------------------------------------------------------

create function platform_private.send_system_message(
  p_actor_key text,
  p_recipient_person_resource_id uuid,
  p_purpose text,
  p_body text,
  p_resource_references jsonb,
  p_idempotency_key text,
  p_correlation_id uuid default null,
  p_client_created_at timestamptz default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  conversation_id uuid,
  message_id uuid,
  mailbox_folder text,
  first_contact_state text,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to
  'pg_catalog','auth','public','editorial','messaging','platform_private'
as $function$
declare
  v_actor platform_private.system_actors%rowtype;
  v_policy platform_private.system_actor_message_policies%rowtype;
  v_recipient_user uuid;
  v_body text;
  v_purpose text;
  v_correlation uuid;
  v_request jsonb;
  v_begin record;
  v_result jsonb;
  v_conversation uuid;
  v_sender_participant uuid;
  v_recipient_participant uuid;
  v_message uuid;
  v_disposition text;
  v_folder text;
  v_first_contact text;
  v_approved boolean;
  v_refs jsonb;
begin
  select actor.* into v_actor
  from platform_private.system_actors actor
  where actor.actor_key=p_actor_key
    and actor.status='active';

  select policy.* into v_policy
  from platform_private.system_actor_message_policies policy
  where policy.actor_key=p_actor_key
    and policy.enabled;

  if v_actor.actor_key is null or v_policy.actor_key is null then
    raise exception using errcode='42501', message='System Actor messaging is not enabled.';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings binding
    where binding.actor_key=p_actor_key
      and binding.executor_kind='database_role'
      and binding.executor_key=session_user
      and binding.status='active'
  ) then
    raise exception using errcode='42501', message='The current executor is not bound to this System Actor.';
  end if;

  v_purpose := lower(btrim(coalesce(p_purpose,'')));
  if v_purpose='' or not (v_purpose = any(v_policy.permitted_purposes)) then
    raise exception using errcode='42501', message='The System Actor Message purpose is not permitted.';
  end if;

  v_body := nullif(btrim(coalesce(p_body,'')),'');
  if v_body is null or octet_length(v_body)>10000 then
    raise exception using errcode='22023', message='Message body is required and must not exceed 10 KB.';
  end if;

  if not v_policy.allow_links and messaging.message_contains_link(v_body) then
    raise exception using errcode='42501', message='This System Actor may not send links.';
  end if;

  v_refs := coalesce(p_resource_references,'[]'::jsonb);
  if pg_catalog.jsonb_typeof(v_refs)<>'array'
     or pg_catalog.jsonb_array_length(v_refs)>0
  then
    raise exception using errcode='42501', message='System Actor Resource references are not enabled in Candidate A.';
  end if;

  v_recipient_user := messaging.active_user_for_person(p_recipient_person_resource_id);
  if v_recipient_user is null then
    raise exception using errcode='P0002', message='The recipient is not available for Messages.';
  end if;

  if v_policy.recipient_scope <> 'super_admin_only'
     or not exists (
       select 1
       from public.user_role_assignments assignment
       where assignment.user_id=v_recipient_user
         and assignment.role_key='super_admin'
         and assignment.status='active'
         and (assignment.expires_at is null or assignment.expires_at>now())
     )
  then
    raise exception using errcode='42501', message='The recipient is outside the System Actor scope.';
  end if;

  if not messaging.audience_allows_category('system')
     or not messaging.audience_allows_category(
       messaging.user_sender_category(v_recipient_user)
     )
     or not messaging.recipient_content_allows(
       v_recipient_user,'system',v_body,v_refs
     )
  then
    raise exception using errcode='42501', message='The recipient does not allow this System Message.';
  end if;

  v_correlation := coalesce(
    p_correlation_id,
    pg_catalog.md5(
      p_actor_key || ':messages.system.send:' || coalesce(p_idempotency_key,'')
    )::uuid
  );

  v_request := pg_catalog.jsonb_build_object(
    'actor_key',p_actor_key,
    'recipient_person_resource_id',p_recipient_person_resource_id,
    'purpose',v_purpose,
    'body',v_body,
    'resource_references',v_refs,
    'client_created_at',p_client_created_at,
    'correlation_id',v_correlation
  );

  select * into v_begin
  from platform_private.begin_system_resource_command(
    p_actor_key,
    'messages.system.send',
    p_recipient_person_resource_id,
    p_idempotency_key,
    v_request
  );

  if v_begin.idempotent_replay then
    v_result := v_begin.result_payload;
    command_receipt_id := v_begin.command_receipt_id;
    receipt_status := v_begin.receipt_status;
    conversation_id := nullif(v_result->>'conversation_id','')::uuid;
    message_id := nullif(v_result->>'message_id','')::uuid;
    mailbox_folder := v_result->>'mailbox_folder';
    first_contact_state := v_result->>'first_contact_state';
    idempotent_replay := true;
    return next;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'messages-system-pair:' || p_actor_key || ':' || p_recipient_person_resource_id::text,
      0
    )
  );

  select conversation.id into v_conversation
  from messaging.conversations conversation
  where conversation.conversation_kind='direct'
    and conversation.status='active'
    and (
      select count(*)
      from messaging.conversation_participants participant
      where participant.conversation_id=conversation.id
        and participant.membership_status='active'
    )=2
    and exists (
      select 1
      from messaging.conversation_participants participant
      where participant.conversation_id=conversation.id
        and participant.actor_kind in ('system','automation')
        and participant.actor_key=p_actor_key
        and participant.membership_status='active'
    )
    and exists (
      select 1
      from messaging.conversation_participants participant
      where participant.conversation_id=conversation.id
        and participant.actor_kind='human'
        and participant.person_resource_id=p_recipient_person_resource_id
        and participant.membership_status='active'
    )
  order by conversation.created_at desc
  limit 1;

  if v_conversation is not null then
    select participant.id into v_sender_participant
    from messaging.conversation_participants participant
    where participant.conversation_id=v_conversation
      and participant.actor_kind in ('system','automation')
      and participant.actor_key=p_actor_key
      and participant.membership_status='active';

    select participant.id,participant.mailbox_folder,participant.first_contact_state
    into v_recipient_participant,v_folder,v_first_contact
    from messaging.conversation_participants participant
    where participant.conversation_id=v_conversation
      and participant.actor_kind='human'
      and participant.person_resource_id=p_recipient_person_resource_id
      and participant.membership_status='active'
    for update;

    if v_first_contact='declined' then
      raise exception using errcode='42501', message='The recipient declined this System Actor.';
    end if;
  else
    select exists (
      select 1
      from messaging.sender_approvals approval
      where approval.recipient_person_resource_id=p_recipient_person_resource_id
        and approval.sender_actor_kind=v_actor.actor_kind
        and approval.sender_actor_key=p_actor_key
        and approval.status='active'
    ) into v_approved;

    select coalesce(
      (
        select sender_policy.first_contact_disposition
        from messaging.user_sender_policies sender_policy
        where sender_policy.user_id=v_recipient_user
          and sender_policy.sender_category='system'
      ),
      messaging.default_first_contact_disposition('system')
    ) into v_disposition;

    if v_disposition='reject' then
      raise exception using errcode='42501', message='The recipient is not accepting new System Messages.';
    end if;

    if v_approved or v_disposition='inbox' then
      v_folder := 'inbox';
      v_first_contact := 'accepted';
    else
      v_folder := 'requests';
      v_first_contact := 'pending';
    end if;

    insert into messaging.conversations (
      security_classification,
      status,
      created_at,
      last_activity_at,
      correlation_id
    )
    values ('standard','active',now(),now(),v_correlation)
    returning id into v_conversation;

    insert into messaging.conversation_participants (
      conversation_id,
      actor_kind,
      actor_key,
      membership_status,
      mailbox_folder,
      first_contact_state
    )
    values (
      v_conversation,
      v_actor.actor_kind,
      p_actor_key,
      'active',
      'inbox',
      'not_applicable'
    )
    returning id into v_sender_participant;

    insert into messaging.conversation_participants (
      conversation_id,
      actor_kind,
      person_resource_id,
      user_id,
      membership_status,
      mailbox_folder,
      first_contact_state
    )
    values (
      v_conversation,
      'human',
      p_recipient_person_resource_id,
      v_recipient_user,
      'active',
      v_folder,
      v_first_contact
    )
    returning id into v_recipient_participant;

    update messaging.conversations
    set created_by_participant_id=v_sender_participant
    where id=v_conversation;
  end if;

  insert into messaging.messages (
    conversation_id,
    sender_participant_id,
    message_kind,
    body,
    accepted_at,
    client_created_at,
    correlation_id,
    command_receipt_id
  )
  values (
    v_conversation,
    v_sender_participant,
    'text',
    v_body,
    now(),
    p_client_created_at,
    v_correlation,
    v_begin.command_receipt_id
  )
  returning id into v_message;

  insert into messaging.message_receipts (
    message_id,
    participant_id,
    conversation_id,
    delivery_state,
    delivered_at
  )
  values (
    v_message,
    v_recipient_participant,
    v_conversation,
    'delivered',
    now()
  );

  update messaging.conversations
  set last_activity_at=now()
  where id=v_conversation;

  v_result := pg_catalog.jsonb_build_object(
    'conversation_id',v_conversation,
    'message_id',v_message,
    'mailbox_folder',v_folder,
    'first_contact_state',v_first_contact,
    'actor_key',p_actor_key,
    'purpose',v_purpose,
    'correlation_id',v_correlation
  );

  perform platform_private.complete_resource_command(
    v_begin.command_receipt_id,
    v_result
  );

  command_receipt_id := v_begin.command_receipt_id;
  receipt_status := 'succeeded';
  conversation_id := v_conversation;
  message_id := v_message;
  mailbox_folder := v_folder;
  first_contact_state := v_first_contact;
  idempotent_replay := false;
  return next;
end;
$function$;

revoke all on function platform_private.send_system_message(
  text,uuid,text,text,jsonb,text,uuid,timestamptz
)
from public, anon, authenticated, service_role;

-- -------------------------------------------------------------------------
-- Existing human commands become mixed-actor safe.
-- -------------------------------------------------------------------------

create or replace function public.accept_message_request(
  p_conversation_id uuid,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,auth,public,editorial,messaging,platform_private
as $function$
declare
  me record;
  cp messaging.conversation_participants%rowtype;
  s messaging.conversation_participants%rowtype;
  b record;
  r jsonb;
  corr uuid;
begin
  select * into me from messaging.current_human_identity();
  corr:=messaging.command_correlation(me.user_id,'messages.request.accept',p_idempotency_key,p_correlation_id);
  select * into b from platform_private.begin_authenticated_resource_command(
    'messages.request.accept',
    me.person_resource_id,
    p_idempotency_key,
    pg_catalog.jsonb_build_object('conversation_id',p_conversation_id,'correlation_id',corr)
  );
  if b.idempotent_replay then return b.result_payload; end if;

  select x.* into cp
  from messaging.conversation_participants x
  where x.conversation_id=p_conversation_id
    and x.person_resource_id=me.person_resource_id
    and x.user_id=me.user_id
    and x.membership_status='active'
  for update;

  if cp.id is null or cp.first_contact_state<>'pending' then
    raise exception using errcode='22023',message='A pending Message request is required.';
  end if;

  select x.* into s
  from messaging.conversation_participants x
  where x.conversation_id=p_conversation_id
    and x.id<>cp.id
    and x.membership_status='active'
  order by x.joined_at,x.id
  limit 1;

  if s.id is null then
    raise exception using errcode='P0002',message='The sender participant is missing.';
  end if;

  if s.actor_kind='human' then
    insert into messaging.sender_approvals (
      recipient_person_resource_id,
      recipient_user_id,
      sender_actor_kind,
      sender_person_resource_id,
      status,
      approved_at,
      revoked_at,
      created_from_conversation_id,
      updated_at
    )
    values (
      me.person_resource_id,
      me.user_id,
      'human',
      s.person_resource_id,
      'active',
      now(),
      null,
      p_conversation_id,
      now()
    )
    on conflict(recipient_person_resource_id,sender_person_resource_id)
      where sender_actor_kind='human'
    do update set
      status='active',
      revoked_at=null,
      recipient_user_id=excluded.recipient_user_id,
      approved_at=now(),
      created_from_conversation_id=excluded.created_from_conversation_id,
      updated_at=now();
  elsif s.actor_kind in ('system','automation') then
    insert into messaging.sender_approvals (
      recipient_person_resource_id,
      recipient_user_id,
      sender_actor_kind,
      sender_actor_key,
      status,
      approved_at,
      revoked_at,
      created_from_conversation_id,
      updated_at
    )
    values (
      me.person_resource_id,
      me.user_id,
      s.actor_kind,
      s.actor_key,
      'active',
      now(),
      null,
      p_conversation_id,
      now()
    )
    on conflict(recipient_person_resource_id,sender_actor_kind,sender_actor_key)
      where sender_actor_kind in ('system','automation')
    do update set
      status='active',
      revoked_at=null,
      recipient_user_id=excluded.recipient_user_id,
      approved_at=now(),
      created_from_conversation_id=excluded.created_from_conversation_id,
      updated_at=now();
  else
    raise exception using errcode='42501',message='The sender participant kind is not approvable.';
  end if;

  update messaging.conversation_participants
  set first_contact_state='accepted',mailbox_folder='inbox',mailbox_updated_at=now()
  where id=cp.id;

  r:=pg_catalog.jsonb_build_object(
    'conversation_id',p_conversation_id,
    'accepted',true,
    'sender_actor_kind',s.actor_kind,
    'sender_actor_key',s.actor_key,
    'correlation_id',corr
  );
  perform platform_private.complete_resource_command(b.command_receipt_id,r);
  return r;
end;
$function$;

create or replace function public.send_message(
  p_conversation_id uuid,
  p_body text,
  p_resource_references jsonb,
  p_idempotency_key text,
  p_correlation_id uuid default null,
  p_client_created_at timestamptz default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  conversation_id uuid,
  message_id uuid,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path=pg_catalog,auth,public,editorial,messaging,platform_private
as $function$
declare
  me record;
  sp uuid;
  body text;
  corr uuid;
  req jsonb;
  b record;
  msg uuid;
  o record;
begin
  select * into me from messaging.current_human_identity();
  body:=nullif(btrim(coalesce(p_body,'')),'');
  if body is null or octet_length(body)>10000 then
    raise exception using errcode='22023',message='Message body is required and must not exceed 10 KB.';
  end if;
  corr:=messaging.command_correlation(me.user_id,'messages.message.send',p_idempotency_key,p_correlation_id);
  req:=pg_catalog.jsonb_build_object(
    'conversation_id',p_conversation_id,
    'body',body,
    'resource_references',coalesce(p_resource_references,'[]'::jsonb),
    'client_created_at',p_client_created_at,
    'correlation_id',corr
  );
  select * into b from platform_private.begin_authenticated_resource_command(
    'messages.message.send',me.person_resource_id,p_idempotency_key,req
  );
  if b.idempotent_replay then
    command_receipt_id:=b.command_receipt_id;
    receipt_status:=b.receipt_status;
    conversation_id:=nullif(b.result_payload->>'conversation_id','')::uuid;
    message_id:=nullif(b.result_payload->>'message_id','')::uuid;
    idempotent_replay:=true;
    return next;
    return;
  end if;

  perform messaging.validate_resource_references(me.user_id,p_resource_references);

  select cp.id into sp
  from messaging.conversation_participants cp
  join messaging.conversations c on c.id=cp.conversation_id
  where cp.conversation_id=p_conversation_id
    and cp.person_resource_id=me.person_resource_id
    and cp.user_id=me.user_id
    and cp.membership_status='active'
    and c.status='active'
  for update;

  if sp is null then
    raise exception using errcode='42501',message='Active conversation membership is required.';
  end if;

  if exists (
    select 1
    from messaging.conversation_participants system_participant
    left join platform_private.system_actor_message_policies system_policy
      on system_policy.actor_key=system_participant.actor_key
    where system_participant.conversation_id=p_conversation_id
      and system_participant.id<>sp
      and system_participant.membership_status='active'
      and system_participant.actor_kind in ('system','automation')
      and coalesce(system_policy.allow_human_reply,false)=false
  ) then
    raise exception using errcode='42501',message='Replies are not enabled for this System Actor.';
  end if;

  for o in
    select cp.*
    from messaging.conversation_participants cp
    where cp.conversation_id=p_conversation_id
      and cp.id<>sp
      and cp.membership_status='active'
      and cp.actor_kind='human'
  loop
    if not messaging.audience_allows_category(me.sender_category)
       or not messaging.audience_allows_category(messaging.user_sender_category(o.user_id))
       or messaging.person_blocked_between(me.user_id,o.person_resource_id)
       or o.first_contact_state='declined'
       or not messaging.recipient_content_allows(o.user_id,me.sender_category,body,p_resource_references)
    then
      raise exception using errcode='42501',message='This Message cannot be delivered.';
    end if;
  end loop;

  insert into messaging.messages (
    conversation_id,sender_participant_id,message_kind,body,
    accepted_at,client_created_at,correlation_id,command_receipt_id
  )
  values (
    p_conversation_id,sp,'text',body,
    now(),p_client_created_at,corr,b.command_receipt_id
  )
  returning id into msg;

  perform messaging.insert_resource_references(msg,p_resource_references);

  insert into messaging.message_receipts (
    message_id,participant_id,conversation_id,delivery_state,delivered_at
  )
  select msg,cp.id,p_conversation_id,'delivered',now()
  from messaging.conversation_participants cp
  where cp.conversation_id=p_conversation_id
    and cp.id<>sp
    and cp.membership_status='active';

  update messaging.conversations set last_activity_at=now()
  where id=p_conversation_id;

  perform platform_private.complete_resource_command(
    b.command_receipt_id,
    pg_catalog.jsonb_build_object(
      'conversation_id',p_conversation_id,
      'message_id',msg,
      'correlation_id',corr
    )
  );

  command_receipt_id:=b.command_receipt_id;
  receipt_status:='succeeded';
  conversation_id:=p_conversation_id;
  message_id:=msg;
  idempotent_replay:=false;
  return next;
end;
$function$;

-- -------------------------------------------------------------------------
-- Mixed Human/System read projection.
-- -------------------------------------------------------------------------

create or replace function public.list_my_message_conversations(
  p_folder text default 'inbox',
  p_before_last_activity_at timestamptz default null,
  p_before_conversation_id uuid default null,
  p_limit integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,auth,public,editorial,messaging
as $function$
declare me record; f text; lim integer;
begin
  select * into me from messaging.current_human_identity();
  f:=lower(btrim(coalesce(p_folder,'inbox')));
  lim:=greatest(1,least(coalesce(p_limit,30),100));
  if f not in('inbox','requests','spam','archived') then
    raise exception using errcode='22023',message='Message folder is invalid.';
  end if;

  return coalesce((
    select pg_catalog.jsonb_agg(
      item
      order by (item->>'last_activity_at')::timestamptz desc,
               (item->>'conversation_id')::uuid desc
    )
    from (
      select pg_catalog.jsonb_build_object(
        'conversation_id',c.id,
        'security_classification',c.security_classification,
        'status',c.status,
        'mailbox_folder',m.mailbox_folder,
        'first_contact_state',m.first_contact_state,
        'last_activity_at',c.last_activity_at,
        'other_participant',messaging.participant_identity_json(
          o.actor_kind,o.person_resource_id,o.actor_key
        ),
        'latest_message',(
          select pg_catalog.jsonb_build_object(
            'id',x.id,
            'body',x.body,
            'accepted_at',x.accepted_at,
            'sender',messaging.participant_identity_json(
              s.actor_kind,s.person_resource_id,s.actor_key
            ),
            'sender_actor_kind',s.actor_kind,
            'sender_person_resource_id',s.person_resource_id,
            'sender_actor_key',s.actor_key
          )
          from messaging.messages x
          join messaging.conversation_participants s
            on s.id=x.sender_participant_id
          where x.conversation_id=c.id
          order by x.accepted_at desc,x.id desc
          limit 1
        ),
        'unread_count',(
          select count(*)
          from messaging.message_receipts r
          where r.participant_id=m.id
            and r.read_at is null
        )
      ) item
      from messaging.conversation_participants m
      join messaging.conversations c on c.id=m.conversation_id
      left join messaging.conversation_participants o
        on o.conversation_id=c.id
       and o.id<>m.id
       and o.membership_status='active'
      where m.user_id=me.user_id
        and m.person_resource_id=me.person_resource_id
        and m.membership_status='active'
        and m.mailbox_folder=f
        and (
          p_before_last_activity_at is null
          or (c.last_activity_at,c.id)<(
            p_before_last_activity_at,
            coalesce(p_before_conversation_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)
          )
        )
      order by c.last_activity_at desc,c.id desc
      limit lim
    ) q
  ),'[]'::jsonb);
end;
$function$;

create or replace function public.get_my_message_conversation(
  p_conversation_id uuid,
  p_before_accepted_at timestamptz default null,
  p_before_message_id uuid default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,auth,public,editorial,messaging
as $function$
declare
  me record;
  mine messaging.conversation_participants%rowtype;
  lim integer;
begin
  select * into me from messaging.current_human_identity();
  lim:=greatest(1,least(coalesce(p_limit,50),100));

  select x.* into mine
  from messaging.conversation_participants x
  where x.conversation_id=p_conversation_id
    and x.user_id=me.user_id
    and x.person_resource_id=me.person_resource_id
    and x.membership_status='active';

  if mine.id is null then
    raise exception using errcode='42501',message='Active conversation membership is required.';
  end if;

  return pg_catalog.jsonb_build_object(
    'conversation',(
      select pg_catalog.jsonb_build_object(
        'id',c.id,
        'security_classification',c.security_classification,
        'status',c.status,
        'mailbox_folder',mine.mailbox_folder,
        'first_contact_state',mine.first_contact_state,
        'created_at',c.created_at,
        'last_activity_at',c.last_activity_at
      )
      from messaging.conversations c
      where c.id=p_conversation_id
    ),
    'participants',(
      select pg_catalog.jsonb_agg(
        messaging.participant_identity_json(
          x.actor_kind,x.person_resource_id,x.actor_key
        ) || pg_catalog.jsonb_build_object(
          'membership_status',x.membership_status
        )
        order by x.joined_at,x.id
      )
      from messaging.conversation_participants x
      where x.conversation_id=p_conversation_id
    ),
    'messages',coalesce((
      select pg_catalog.jsonb_agg(j order by at desc,id desc)
      from (
        select
          m.id,
          m.accepted_at at,
          pg_catalog.jsonb_build_object(
            'id',m.id,
            'message_kind',m.message_kind,
            'body',m.body,
            'accepted_at',m.accepted_at,
            'client_created_at',m.client_created_at,
            'sender',messaging.participant_identity_json(
              s.actor_kind,s.person_resource_id,s.actor_key
            ),
            'sender_actor_kind',s.actor_kind,
            'sender_person_resource_id',s.person_resource_id,
            'sender_actor_key',s.actor_key,
            'my_read_at',mr.read_at,
            'recipient_read_at',case
              when s.id=mine.id then (
                select case
                  when coalesce(
                    pol.show_read_receipts,
                    messaging.default_show_read_receipts(
                      messaging.user_sender_category(me.user_id)
                    )
                  ) then rr.read_at
                  else null
                end
                from messaging.message_receipts rr
                join messaging.conversation_participants rec
                  on rec.id=rr.participant_id
                left join messaging.user_sender_policies pol
                  on pol.user_id=rec.user_id
                 and pol.sender_category=messaging.user_sender_category(me.user_id)
                where rr.message_id=m.id
                  and rec.id<>mine.id
                order by rec.id
                limit 1
              )
              else null
            end,
            'resource_references',coalesce((
              select pg_catalog.jsonb_agg(
                pg_catalog.jsonb_build_object(
                  'resource_id',ref.resource_id,
                  'resource_version_id',ref.resource_version_id,
                  'presentation_kind',ref.presentation_kind
                )
                order by ref.created_at,ref.id
              )
              from messaging.message_resource_references ref
              where ref.message_id=m.id
                and messaging.can_user_reference_resource(
                  me.user_id,ref.resource_id,ref.resource_version_id
                )
            ),'[]'::jsonb)
          ) j
        from messaging.messages m
        join messaging.conversation_participants s
          on s.id=m.sender_participant_id
        left join messaging.message_receipts mr
          on mr.message_id=m.id
         and mr.participant_id=mine.id
        where m.conversation_id=p_conversation_id
          and (
            p_before_accepted_at is null
            or (m.accepted_at,m.id)<(
              p_before_accepted_at,
              coalesce(p_before_message_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)
            )
          )
        order by m.accepted_at desc,m.id desc
        limit lim
      ) pg
    ),'[]'::jsonb)
  );
end;
$function$;

-- -------------------------------------------------------------------------
-- Existing Notifications bridge, now System-aware without fake auth actor.
-- -------------------------------------------------------------------------

create or replace function messaging.emit_direct_message_notification()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','public','messaging','platform_private'
as $function$
declare
  v_sender_kind text;
  v_sender_user_id uuid;
  v_sender_actor_key text;
  v_sender_display_name text;
begin
  select
    participant.actor_kind,
    participant.user_id,
    participant.actor_key
  into
    v_sender_kind,
    v_sender_user_id,
    v_sender_actor_key
  from messaging.conversation_participants participant
  where participant.id=new.sender_participant_id
    and participant.conversation_id=new.conversation_id
    and participant.membership_status='active';

  if v_sender_kind='human' then
    if v_sender_user_id is null then return new; end if;
    select coalesce(
      nullif(btrim(profile.display_name),''),
      nullif(btrim(profile.username_normalized),''),
      'Someone'
    ) into v_sender_display_name
    from public.user_profiles profile
    where profile.user_id=v_sender_user_id
      and profile.status='active';
  elsif v_sender_kind in ('system','automation') then
    select actor.label into v_sender_display_name
    from platform_private.system_actors actor
    where actor.actor_key=v_sender_actor_key;
    if v_sender_display_name is null then return new; end if;
  else
    return new;
  end if;

  insert into public.community_notifications (
    user_id,
    actor_id,
    notification_type,
    entity_type,
    entity_id,
    entity_slug,
    comment_id,
    metadata
  )
  select
    recipient.user_id,
    case when v_sender_kind='human' then v_sender_user_id else null end,
    'direct_message',
    'direct_message',
    new.id::text,
    null,
    null,
    pg_catalog.jsonb_strip_nulls(
      pg_catalog.jsonb_build_object(
        'canonical_path','/messages',
        'conversation_id',new.conversation_id,
        'message_id',new.id,
        'sender_display_name',coalesce(v_sender_display_name,'Someone'),
        'sender_actor_kind',v_sender_kind,
        'sender_actor_key',case
          when v_sender_kind in ('system','automation') then v_sender_actor_key
          else null
        end
      )
    )
  from messaging.conversation_participants recipient
  where recipient.conversation_id=new.conversation_id
    and recipient.id<>new.sender_participant_id
    and recipient.actor_kind='human'
    and recipient.user_id is not null
    and (v_sender_user_id is null or recipient.user_id<>v_sender_user_id)
    and recipient.membership_status='active'
    and recipient.mailbox_folder in ('inbox','archived')
    and recipient.first_contact_state in ('accepted','not_applicable')
    and not exists (
      select 1
      from public.community_notifications existing
      where existing.user_id=recipient.user_id
        and existing.notification_type='direct_message'
        and existing.entity_type='direct_message'
        and existing.entity_id=new.id::text
    );

  return new;
end;
$function$;

revoke all on function messaging.emit_direct_message_notification()
from public, anon, authenticated, service_role;

-- -------------------------------------------------------------------------
-- Minimum Super Admin Agents read + Messages-only kill control.
-- -------------------------------------------------------------------------

create function public.get_messages_system_actors()
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,auth,public,messaging,platform_private
as $function$
declare me record;
begin
  select * into me from messaging.current_human_identity();

  if not exists (
    select 1
    from public.user_role_assignments assignment
    where assignment.user_id=me.user_id
      and assignment.role_key='super_admin'
      and assignment.status='active'
      and (assignment.expires_at is null or assignment.expires_at>now())
  ) or not public.current_user_has_capability('manage_messages_control_center') then
    raise exception using errcode='42501',message='Messages Agents requires active Super Admin authority.';
  end if;

  return coalesce((
    select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'actor_key',actor.actor_key,
        'label',actor.label,
        'actor_kind',actor.actor_kind,
        'actor_status',actor.status,
        'messaging_enabled',policy.enabled,
        'permitted_purposes',policy.permitted_purposes,
        'recipient_scope',policy.recipient_scope,
        'allow_links',policy.allow_links,
        'allow_resource_references',policy.allow_resource_references,
        'allow_human_reply',policy.allow_human_reply,
        'revision',policy.revision,
        'latest_message_at',(
          select max(message.accepted_at)
          from messaging.conversation_participants participant
          join messaging.messages message
            on message.sender_participant_id=participant.id
          where participant.actor_kind in ('system','automation')
            and participant.actor_key=actor.actor_key
        )
      ) order by actor.actor_key
    )
    from platform_private.system_actors actor
    join platform_private.system_actor_message_policies policy
      on policy.actor_key=actor.actor_key
  ),'[]'::jsonb);
end;
$function$;

create function public.set_messages_system_actor_enabled(
  p_actor_key text,
  p_expected_revision bigint,
  p_enabled boolean,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,auth,public,editorial,messaging,platform_private
as $function$
declare
  me record;
  current_policy platform_private.system_actor_message_policies%rowtype;
  b record;
  corr uuid;
  result jsonb;
begin
  select * into me from messaging.current_human_identity();

  if not exists (
    select 1
    from public.user_role_assignments assignment
    where assignment.user_id=me.user_id
      and assignment.role_key='super_admin'
      and assignment.status='active'
      and (assignment.expires_at is null or assignment.expires_at>now())
  ) or not public.current_user_has_capability('manage_messages_control_center') then
    raise exception using errcode='42501',message='Messages Agents requires active Super Admin authority.';
  end if;

  if p_actor_key is null or p_expected_revision is null or p_expected_revision<1 or p_enabled is null then
    raise exception using errcode='22023',message='System Actor messaging update input is invalid.';
  end if;

  corr:=messaging.command_correlation(
    me.user_id,
    'messages.system_actor.messaging.update',
    p_idempotency_key,
    p_correlation_id
  );

  select * into b
  from platform_private.begin_authenticated_resource_command(
    'messages.system_actor.messaging.update',
    me.person_resource_id,
    p_idempotency_key,
    pg_catalog.jsonb_build_object(
      'actor_key',p_actor_key,
      'expected_revision',p_expected_revision,
      'enabled',p_enabled,
      'correlation_id',corr
    )
  );

  if b.idempotent_replay then return b.result_payload; end if;

  select policy.* into current_policy
  from platform_private.system_actor_message_policies policy
  where policy.actor_key=p_actor_key
  for update;

  if current_policy.actor_key is null then
    raise exception using errcode='P0002',message='System Actor Messages policy was not found.';
  end if;

  if current_policy.revision<>p_expected_revision then
    raise exception using errcode='40001',message='System Actor Messages policy revision changed.';
  end if;

  update platform_private.system_actor_message_policies
  set enabled=p_enabled,
      revision=revision+1,
      updated_at=now()
  where actor_key=p_actor_key
  returning pg_catalog.jsonb_build_object(
    'actor_key',actor_key,
    'messaging_enabled',enabled,
    'revision',revision,
    'correlation_id',corr
  ) into result;

  perform platform_private.complete_resource_command(b.command_receipt_id,result);
  return result;
end;
$function$;

create or replace function public.get_messages_control_center_status()
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,auth,public,messaging,platform_private
as $function$
declare
  me record;
  allowed boolean;
begin
  select * into me from messaging.current_human_identity();
  select
    exists (
      select 1
      from public.user_role_assignments assignment
      where assignment.user_id=me.user_id
        and assignment.role_key='super_admin'
        and assignment.status='active'
        and (assignment.expires_at is null or assignment.expires_at>now())
    )
    and public.current_user_has_capability('manage_messages_control_center')
  into allowed;

  if not allowed then
    raise exception using errcode='42501',message='Messages Control Center requires active Super Admin authority.';
  end if;

  return pg_catalog.jsonb_build_object(
    'audience_mode',(select policy.audience_mode from messaging.runtime_policy policy where policy.singleton),
    'policy_revision',(select policy.revision from messaging.runtime_policy policy where policy.singleton),
    'active_conversations',(select count(*) from messaging.conversations conversation where conversation.status='active'),
    'messages',(select count(*) from messaging.messages),
    'pending_requests',(select count(*) from messaging.conversation_participants participant where participant.membership_status='active' and participant.first_contact_state='pending'),
    'spam_conversations',(select count(*) from messaging.conversation_participants participant where participant.membership_status='active' and participant.mailbox_folder='spam'),
    'active_human_participants',(select count(*) from messaging.conversation_participants participant where participant.membership_status='active' and participant.actor_kind='human'),
    'registered_system_actors',(select count(*) from platform_private.system_actors),
    'messages_enabled_system_actors',(select count(*) from platform_private.system_actor_message_policies policy where policy.enabled)
  );
end;
$function$;

revoke all on function
  public.get_messages_system_actors(),
  public.set_messages_system_actor_enabled(text,bigint,boolean,text,uuid)
from public, anon, service_role;

grant execute on function
  public.get_messages_system_actors(),
  public.set_messages_system_actor_enabled(text,bigint,boolean,text,uuid)
to authenticated;

-- Existing public functions retain their authenticated-only boundary.
revoke all on function
  public.accept_message_request(uuid,text,uuid),
  public.send_message(uuid,text,jsonb,text,uuid,timestamptz),
  public.list_my_message_conversations(text,timestamptz,uuid,integer),
  public.get_my_message_conversation(uuid,timestamptz,uuid,integer),
  public.get_messages_control_center_status()
from public, anon;

grant execute on function
  public.accept_message_request(uuid,text,uuid),
  public.send_message(uuid,text,jsonb,text,uuid,timestamptz),
  public.list_my_message_conversations(text,timestamptz,uuid,integer),
  public.get_my_message_conversation(uuid,timestamptz,uuid,integer),
  public.get_messages_control_center_status()
to authenticated;

-- -------------------------------------------------------------------------
-- Structural postcheck.
-- -------------------------------------------------------------------------

do $phase_8b4_postcheck$
declare
  v_system_send text;
  v_notification text;
  v_human_send text;
  v_accept text;
  v_list text;
  v_detail text;
begin
  if not exists (
    select 1 from platform_private.system_actors
    where actor_key='mizizi'
      and label='MIZIZI Cultural Data Steward'
      and actor_kind='system'
      and status='active'
  ) then
    raise exception 'STOP: MIZIZI accountable actor seed is missing';
  end if;

  if not exists (
    select 1 from platform_private.system_actor_executor_bindings
    where actor_key='mizizi'
      and executor_kind='database_role'
      and executor_key='postgres'
      and status='active'
  ) then
    raise exception 'STOP: MIZIZI executor binding is missing';
  end if;

  if not exists (
    select 1 from platform_private.system_actor_message_policies
    where actor_key='mizizi'
      and enabled
      and recipient_scope='super_admin_only'
      and permitted_purposes=array['operational_update']::text[]
      and not allow_links
      and not allow_resource_references
      and not allow_human_reply
  ) then
    raise exception 'STOP: MIZIZI Messages policy is incorrect';
  end if;

  if not exists (
    select 1 from platform_private.command_types
    where command_type='messages.system.send' and enabled
  ) or not exists (
    select 1 from platform_private.command_types
    where command_type='messages.system_actor.messaging.update' and enabled
  ) then
    raise exception 'STOP: Candidate A command types are missing';
  end if;

  select pg_catalog.pg_get_functiondef(proc.oid) into v_system_send
  from pg_catalog.pg_proc proc
  join pg_catalog.pg_namespace namespace on namespace.oid=proc.pronamespace
  where namespace.nspname='platform_private'
    and proc.proname='send_system_message';

  select pg_catalog.pg_get_functiondef(proc.oid) into v_notification
  from pg_catalog.pg_proc proc
  join pg_catalog.pg_namespace namespace on namespace.oid=proc.pronamespace
  where namespace.nspname='messaging'
    and proc.proname='emit_direct_message_notification';

  select pg_catalog.pg_get_functiondef(proc.oid) into v_human_send
  from pg_catalog.pg_proc proc
  join pg_catalog.pg_namespace namespace on namespace.oid=proc.pronamespace
  where namespace.nspname='public' and proc.proname='send_message';

  select pg_catalog.pg_get_functiondef(proc.oid) into v_accept
  from pg_catalog.pg_proc proc
  join pg_catalog.pg_namespace namespace on namespace.oid=proc.pronamespace
  where namespace.nspname='public' and proc.proname='accept_message_request';

  select pg_catalog.pg_get_functiondef(proc.oid) into v_list
  from pg_catalog.pg_proc proc
  join pg_catalog.pg_namespace namespace on namespace.oid=proc.pronamespace
  where namespace.nspname='public' and proc.proname='list_my_message_conversations';

  select pg_catalog.pg_get_functiondef(proc.oid) into v_detail
  from pg_catalog.pg_proc proc
  join pg_catalog.pg_namespace namespace on namespace.oid=proc.pronamespace
  where namespace.nspname='public' and proc.proname='get_my_message_conversation';

  if v_system_send is null
     or position('system:' in v_system_send)=0
     or position('super_admin_only' in v_system_send)=0
     or position('begin_system_resource_command' in v_system_send)=0
  then
    raise exception 'STOP: governed System send boundary is incomplete';
  end if;

  if v_notification is null
     or position('sender_actor_key' in v_notification)=0
     or position('actor_id' in v_notification)=0
     or position('new.body' in lower(v_notification))<>0
  then
    raise exception 'STOP: System-aware notification projection is unsafe/incomplete';
  end if;

  if v_human_send is null
     or position('allow_human_reply' in v_human_send)=0
     or v_accept is null
     or position('sender_actor_key' in v_accept)=0
     or v_list is null
     or position('participant_identity_json' in v_list)=0
     or v_detail is null
     or position('participant_identity_json' in v_detail)=0
  then
    raise exception 'STOP: mixed-actor Messages convergence is incomplete';
  end if;

  if pg_catalog.has_function_privilege(
       'authenticated',
       'platform_private.send_system_message(text,uuid,text,text,jsonb,text,uuid,timestamp with time zone)',
       'EXECUTE'
     )
     or pg_catalog.has_function_privilege(
       'service_role',
       'platform_private.send_system_message(text,uuid,text,text,jsonb,text,uuid,timestamp with time zone)',
       'EXECUTE'
     )
  then
    raise exception 'STOP: System send command is executable by a client/service role';
  end if;
end;
$phase_8b4_postcheck$;

commit;
