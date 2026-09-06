-- Permanent verifier for the Phase 8B.3 existing-conversation ambiguity fix.
--
-- Creates two rollback-only staff identities, starts a direct conversation,
-- then starts the same pair again. The second call must reuse the same
-- conversation without a PL/pgSQL conversation_id ambiguity.

begin;

do $phase_8b_existing_conversation_static$
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
     or position('cp.conversation_id' in v_definition) = 0
  then
    raise exception
      'STOP: qualified existing-conversation lookup is missing';
  end if;
end;
$phase_8b_existing_conversation_static$;

set constraints all deferred;

do $phase_8b_existing_conversation_fixture$
declare
  v_sender uuid := pg_catalog.gen_random_uuid();
  v_recipient uuid := pg_catalog.gen_random_uuid();
begin
  create temporary table phase_8b_existing_conversation_fixture (
    sender_id uuid not null,
    recipient_id uuid not null,
    recipient_person_id uuid,
    first_conversation_id uuid,
    second_conversation_id uuid,
    first_message_id uuid,
    second_message_id uuid
  ) on commit drop;

  insert into phase_8b_existing_conversation_fixture (
    sender_id,
    recipient_id
  )
  values (
    v_sender,
    v_recipient
  );

  insert into auth.users (
    id,
    aud,
    role,
    email,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_sso_user,
    is_anonymous
  )
  values
  (
    v_sender,
    'authenticated',
    'authenticated',
    'phase8b-existing-sender@example.invalid',
    pg_catalog.jsonb_build_object(
      'provider',
      'email',
      'providers',
      pg_catalog.jsonb_build_array('email')
    ),
    pg_catalog.jsonb_build_object(
      'name',
      'Existing Conversation Sender'
    ),
    now(),
    now(),
    false,
    false
  ),
  (
    v_recipient,
    'authenticated',
    'authenticated',
    'phase8b-existing-recipient@example.invalid',
    pg_catalog.jsonb_build_object(
      'provider',
      'email',
      'providers',
      pg_catalog.jsonb_build_array('email')
    ),
    pg_catalog.jsonb_build_object(
      'name',
      'Existing Conversation Recipient'
    ),
    now(),
    now(),
    false,
    false
  );
end;
$phase_8b_existing_conversation_fixture$;

set constraints all immediate;
set constraints all deferred;

do $phase_8b_existing_conversation_roles$
begin
  insert into public.user_role_assignments (
    user_id,
    role_key,
    status,
    assigned_by,
    assigned_at,
    notes,
    created_at,
    updated_at
  )
  select
    fixture.sender_id,
    'editor',
    'active',
    null::uuid,
    now(),
    'Rollback-only existing-conversation sender.',
    now(),
    now()
  from phase_8b_existing_conversation_fixture fixture
  union all
  select
    fixture.recipient_id,
    'editor',
    'active',
    null::uuid,
    now(),
    'Rollback-only existing-conversation recipient.',
    now(),
    now()
  from phase_8b_existing_conversation_fixture fixture;

  update phase_8b_existing_conversation_fixture fixture
  set recipient_person_id = link.person_resource_id
  from editorial.person_identity_links link
  where link.user_id = fixture.recipient_id
    and link.link_state = 'active';

  if exists (
    select 1
    from phase_8b_existing_conversation_fixture
    where recipient_person_id is null
  ) then
    raise exception
      'STOP: rollback-only recipient Person was not provisioned';
  end if;
end;
$phase_8b_existing_conversation_roles$;

grant select, update
on phase_8b_existing_conversation_fixture
to authenticated;

select pg_catalog.set_config(
  'request.jwt.claims',
  (
    select pg_catalog.jsonb_build_object(
      'sub',
      fixture.sender_id::text,
      'role',
      'authenticated'
    )::text
    from phase_8b_existing_conversation_fixture fixture
  ),
  true
);

set local role authenticated;

with started as (
  select *
  from public.start_message_conversation(
    (
      select recipient_person_id
      from phase_8b_existing_conversation_fixture
    ),
    'First rollback-only message',
    null,
    'phase8b-existing-conversation-first',
    null,
    null
  )
)
update phase_8b_existing_conversation_fixture fixture
set
  first_conversation_id = started.conversation_id,
  first_message_id = started.message_id
from started;

with started_again as (
  select *
  from public.start_message_conversation(
    (
      select recipient_person_id
      from phase_8b_existing_conversation_fixture
    ),
    'Second rollback-only message',
    null,
    'phase8b-existing-conversation-second',
    null,
    null
  )
)
update phase_8b_existing_conversation_fixture fixture
set
  second_conversation_id = started_again.conversation_id,
  second_message_id = started_again.message_id
from started_again;

reset role;

do $phase_8b_existing_conversation_assertion$
declare
  v_conversation_count integer;
  v_message_count integer;
begin
  if exists (
    select 1
    from phase_8b_existing_conversation_fixture
    where first_conversation_id is null
       or second_conversation_id is null
       or first_message_id is null
       or second_message_id is null
       or first_conversation_id <> second_conversation_id
       or first_message_id = second_message_id
  ) then
    raise exception
      'STOP: same-pair conversation reuse failed';
  end if;

  select count(*)
  into v_conversation_count
  from messaging.conversations conversation
  join phase_8b_existing_conversation_fixture fixture
    on conversation.id = fixture.first_conversation_id;

  select count(*)
  into v_message_count
  from messaging.messages message
  join phase_8b_existing_conversation_fixture fixture
    on message.conversation_id = fixture.first_conversation_id
  where message.id in (
    fixture.first_message_id,
    fixture.second_message_id
  );

  if v_conversation_count <> 1
     or v_message_count <> 2
  then
    raise exception
      'STOP: expected one reused conversation and two messages, got conversations=%, messages=%',
      v_conversation_count,
      v_message_count;
  end if;
end;
$phase_8b_existing_conversation_assertion$;

select pg_catalog.jsonb_build_object(
  'verification',
  'PASS',
  'existing_conversation_reuse',
  'same-conversation',
  'second_message',
  'created',
  'conversation_id_ambiguity',
  'absent',
  'fixture_persistence',
  'rollback-only'
) as phase_8b_existing_conversation_verification;

rollback;
