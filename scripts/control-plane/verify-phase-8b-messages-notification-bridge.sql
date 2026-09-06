-- Permanent verifier for the Phase 8B.3 Messages notification bridge.
--
-- Proves:
-- - the bridge is an AFTER INSERT trigger on canonical messaging.messages;
-- - the trigger function is not browser-executable;
-- - no Message body is projected into Notifications;
-- - both first-message and later-message delivery create recipient-only
--   direct_message notifications;
-- - the canonical unread Notifications count sees those messages;
-- - all verifier fixture state rolls back.

begin;

do $phase_8b_messages_notification_static$
declare
  v_definition text;
  v_trigger_definition text;
begin
  select pg_catalog.pg_get_functiondef(proc.oid)
  into v_definition
  from pg_catalog.pg_proc proc
  join pg_catalog.pg_namespace namespace
    on namespace.oid = proc.pronamespace
  where namespace.nspname = 'messaging'
    and proc.proname =
        'emit_direct_message_notification'
    and pg_catalog.pg_get_function_identity_arguments(
      proc.oid
    ) = '';

  select pg_catalog.pg_get_triggerdef(
    trigger_row.oid,
    true
  )
  into v_trigger_definition
  from pg_catalog.pg_trigger trigger_row
  where trigger_row.tgrelid =
        'messaging.messages'::pg_catalog.regclass
    and trigger_row.tgname =
        'messages_emit_direct_notification'
    and not trigger_row.tgisinternal;

  if v_definition is null
     or v_trigger_definition is null
     or position(
       'AFTER INSERT' in v_trigger_definition
     ) = 0
     or position(
       'emit_direct_message_notification()'
       in v_trigger_definition
     ) = 0
  then
    raise exception
      'STOP: Messages notification trigger contract is missing';
  end if;

  if position(
       'recipient.mailbox_folder' in v_definition
     ) = 0
     or position(
       'recipient.first_contact_state' in v_definition
     ) = 0
     or position(
       '''direct_message''' in v_definition
     ) = 0
     or position(
       '''/messages''' in v_definition
     ) = 0
  then
    raise exception
      'STOP: Messages notification privacy/routing contract drifted';
  end if;

  if position('new.body' in lower(v_definition)) <> 0
     or position(
       '''body''' in lower(v_definition)
     ) <> 0
  then
    raise exception
      'STOP: Message body appears in notification bridge definition';
  end if;

  if pg_catalog.has_function_privilege(
       'anon',
       'messaging.emit_direct_message_notification()',
       'EXECUTE'
     )
     or pg_catalog.has_function_privilege(
       'authenticated',
       'messaging.emit_direct_message_notification()',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: notification trigger function is client-executable';
  end if;
end;
$phase_8b_messages_notification_static$;

set constraints all deferred;

do $phase_8b_messages_notification_fixture$
declare
  v_sender uuid := pg_catalog.gen_random_uuid();
  v_recipient uuid := pg_catalog.gen_random_uuid();
begin
  create temporary table phase_8b_message_notification_fixture_ids (
    sender_id uuid not null,
    recipient_id uuid not null,
    recipient_person_id uuid,
    conversation_id uuid,
    first_message_id uuid,
    second_message_id uuid
  ) on commit drop;

  insert into phase_8b_message_notification_fixture_ids (
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
    'phase8b-notification-sender@example.invalid',
    pg_catalog.jsonb_build_object(
      'provider',
      'email',
      'providers',
      pg_catalog.jsonb_build_array('email')
    ),
    pg_catalog.jsonb_build_object(
      'name',
      'Notification Sender'
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
    'phase8b-notification-recipient@example.invalid',
    pg_catalog.jsonb_build_object(
      'provider',
      'email',
      'providers',
      pg_catalog.jsonb_build_array('email')
    ),
    pg_catalog.jsonb_build_object(
      'name',
      'Notification Recipient'
    ),
    now(),
    now(),
    false,
    false
  );
end;
$phase_8b_messages_notification_fixture$;

set constraints all immediate;
set constraints all deferred;

do $phase_8b_messages_notification_staff_roles$
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
    'Rollback-only Messages notification sender.',
    now(),
    now()
  from phase_8b_message_notification_fixture_ids fixture
  union all
  select
    fixture.recipient_id,
    'editor',
    'active',
    null::uuid,
    now(),
    'Rollback-only Messages notification recipient.',
    now(),
    now()
  from phase_8b_message_notification_fixture_ids fixture;

  update phase_8b_message_notification_fixture_ids fixture
  set recipient_person_id = link.person_resource_id
  from editorial.person_identity_links link
  where link.user_id = fixture.recipient_id
    and link.link_state = 'active';

  if exists (
    select 1
    from phase_8b_message_notification_fixture_ids
    where recipient_person_id is null
  ) then
    raise exception
      'STOP: verifier recipient canonical Person is missing';
  end if;
end;
$phase_8b_messages_notification_staff_roles$;

grant select, update
on phase_8b_message_notification_fixture_ids
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
    from phase_8b_message_notification_fixture_ids fixture
  ),
  true
);

set local role authenticated;

with started as (
  select *
  from public.start_message_conversation(
    (
      select recipient_person_id
      from phase_8b_message_notification_fixture_ids
    ),
    'First verifier message',
    null,
    'phase8b-notification-first',
    null,
    null
  )
)
update phase_8b_message_notification_fixture_ids fixture
set
  conversation_id = started.conversation_id,
  first_message_id = started.message_id
from started;

reset role;

do $phase_8b_messages_notification_first_assertion$
declare
  v_notification_count integer;
  v_sender_notification_count integer;
  v_body_metadata_count integer;
begin
  select count(*)
  into v_notification_count
  from public.community_notifications notification
  join phase_8b_message_notification_fixture_ids fixture
    on notification.user_id = fixture.recipient_id
  where notification.notification_type = 'direct_message'
    and notification.entity_type = 'direct_message'
    and notification.entity_id = fixture.first_message_id::text
    and notification.actor_id = fixture.sender_id
    and notification.metadata->>'canonical_path' = '/messages'
    and notification.metadata->>'conversation_id' =
        fixture.conversation_id::text
    and notification.metadata->>'message_id' =
        fixture.first_message_id::text;

  select count(*)
  into v_sender_notification_count
  from public.community_notifications notification
  join phase_8b_message_notification_fixture_ids fixture
    on notification.user_id = fixture.sender_id
  where notification.notification_type = 'direct_message'
    and notification.entity_id =
        fixture.first_message_id::text;

  select count(*)
  into v_body_metadata_count
  from public.community_notifications notification
  join phase_8b_message_notification_fixture_ids fixture
    on notification.user_id = fixture.recipient_id
  where notification.notification_type = 'direct_message'
    and notification.entity_id =
        fixture.first_message_id::text
    and notification.metadata ? 'body';

  if v_notification_count <> 1
     or v_sender_notification_count <> 0
     or v_body_metadata_count <> 0
  then
    raise exception
      'STOP: first Message notification failed: recipient=%, sender=%, body=%',
      v_notification_count,
      v_sender_notification_count,
      v_body_metadata_count;
  end if;
end;
$phase_8b_messages_notification_first_assertion$;

select pg_catalog.set_config(
  'request.jwt.claims',
  (
    select pg_catalog.jsonb_build_object(
      'sub',
      fixture.sender_id::text,
      'role',
      'authenticated'
    )::text
    from phase_8b_message_notification_fixture_ids fixture
  ),
  true
);

set local role authenticated;

with sent as (
  select *
  from public.send_message(
    (
      select conversation_id
      from phase_8b_message_notification_fixture_ids
    ),
    'Second verifier message',
    null,
    'phase8b-notification-second',
    null,
    null
  )
)
update phase_8b_message_notification_fixture_ids fixture
set second_message_id = sent.message_id
from sent;

reset role;

do $phase_8b_messages_notification_second_assertion$
declare
  v_total integer;
  v_distinct_messages integer;
  v_body_metadata_count integer;
begin
  select
    count(*),
    count(distinct notification.entity_id)
  into
    v_total,
    v_distinct_messages
  from public.community_notifications notification
  join phase_8b_message_notification_fixture_ids fixture
    on notification.user_id = fixture.recipient_id
  where notification.notification_type = 'direct_message'
    and notification.actor_id = fixture.sender_id
    and notification.entity_id in (
      fixture.first_message_id::text,
      fixture.second_message_id::text
    );

  select count(*)
  into v_body_metadata_count
  from public.community_notifications notification
  join phase_8b_message_notification_fixture_ids fixture
    on notification.user_id = fixture.recipient_id
  where notification.notification_type = 'direct_message'
    and notification.entity_id in (
      fixture.first_message_id::text,
      fixture.second_message_id::text
    )
    and notification.metadata ? 'body';

  if v_total <> 2
     or v_distinct_messages <> 2
     or v_body_metadata_count <> 0
  then
    raise exception
      'STOP: later Message notification failed: total=%, distinct=%, body=%',
      v_total,
      v_distinct_messages,
      v_body_metadata_count;
  end if;
end;
$phase_8b_messages_notification_second_assertion$;

select pg_catalog.set_config(
  'request.jwt.claims',
  (
    select pg_catalog.jsonb_build_object(
      'sub',
      fixture.recipient_id::text,
      'role',
      'authenticated'
    )::text
    from phase_8b_message_notification_fixture_ids fixture
  ),
  true
);

set local role authenticated;

create temporary table phase_8b_message_notification_unread (
  unread_count integer not null
) on commit drop;

grant select, insert
on phase_8b_message_notification_unread
to authenticated;

insert into phase_8b_message_notification_unread (
  unread_count
)
select coalesce(
  (
    public.community_get_unread_count()
    ->> 'count'
  )::integer,
  0
);

reset role;

do $phase_8b_messages_notification_unread_assertion$
declare
  v_unread integer;
begin
  select unread_count
  into v_unread
  from phase_8b_message_notification_unread;

  if v_unread <> 2 then
    raise exception
      'STOP: canonical notification unread count is %, expected 2',
      v_unread;
  end if;
end;
$phase_8b_messages_notification_unread_assertion$;

select pg_catalog.jsonb_build_object(
  'verification',
  'PASS',
  'first_message_notification',
  'pass',
  'later_message_notification',
  'pass',
  'recipient_only',
  true,
  'message_body_projected',
  false,
  'canonical_unread_count',
  2,
  'notification_target',
  '/messages',
  'fixture_persistence',
  'rollback-only'
) as phase_8b_messages_notification_verification;

rollback;
