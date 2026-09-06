-- Phase 8B.3 Messages notification bridge.
--
-- Messages already owns delivery and mailbox state. Community Notifications
-- already owns the sitewide notification bell and notification feed.
--
-- This bridge reuses that existing notification primitive. It does not create
-- a second notification store or queue.
--
-- Privacy boundary:
-- - notify only another active human participant;
-- - notify only when that participant currently receives the conversation in
--   Inbox or Archive and first contact is accepted/not-applicable;
-- - never copy the Message body into notification metadata;
-- - expose only routing identifiers and sender presentation.

begin;

set local statement_timeout = '30s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'phase-8b-messages-notification-bridge',
    0
  )
);

do $phase_8b_messages_notification_preflight$
begin
  if pg_catalog.to_regclass('messaging.messages') is null
     or pg_catalog.to_regclass(
       'messaging.conversation_participants'
     ) is null
     or pg_catalog.to_regclass(
       'public.community_notifications'
     ) is null
  then
    raise exception
      'STOP: Messages or Notifications authority is missing';
  end if;

  if pg_catalog.to_regprocedure(
       'public.community_get_unread_count()'
     ) is null
     or pg_catalog.to_regprocedure(
       'public.community_get_user_notifications(uuid,integer)'
     ) is null
  then
    raise exception
      'STOP: canonical Notifications read authority is missing';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_trigger trigger_row
    where trigger_row.tgrelid =
          'messaging.messages'::pg_catalog.regclass
      and trigger_row.tgname =
          'messages_emit_direct_notification'
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'STOP: Messages notification trigger already exists';
  end if;

  if pg_catalog.to_regprocedure(
       'messaging.emit_direct_message_notification()'
     ) is not null
  then
    raise exception
      'STOP: Messages notification function already exists';
  end if;
end;
$phase_8b_messages_notification_preflight$;

create function messaging.emit_direct_message_notification()
returns trigger
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'messaging'
as $function$
declare
  v_sender_user_id uuid;
  v_sender_display_name text;
begin
  select participant.user_id
  into v_sender_user_id
  from messaging.conversation_participants participant
  where participant.id = new.sender_participant_id
    and participant.conversation_id = new.conversation_id
    and participant.actor_kind = 'human'
    and participant.user_id is not null
    and participant.membership_status = 'active';

  if v_sender_user_id is null then
    return new;
  end if;

  select coalesce(
    nullif(btrim(profile.display_name), ''),
    nullif(btrim(profile.username_normalized), ''),
    'Someone'
  )
  into v_sender_display_name
  from public.user_profiles profile
  where profile.user_id = v_sender_user_id
    and profile.status = 'active';

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
    v_sender_user_id,
    'direct_message',
    'direct_message',
    new.id::text,
    null,
    null,
    pg_catalog.jsonb_build_object(
      'canonical_path',
      '/messages',
      'conversation_id',
      new.conversation_id,
      'message_id',
      new.id,
      'sender_display_name',
      coalesce(v_sender_display_name, 'Someone')
    )
  from messaging.conversation_participants recipient
  where recipient.conversation_id = new.conversation_id
    and recipient.id <> new.sender_participant_id
    and recipient.actor_kind = 'human'
    and recipient.user_id is not null
    and recipient.user_id <> v_sender_user_id
    and recipient.membership_status = 'active'
    and recipient.mailbox_folder in ('inbox', 'archive')
    and recipient.first_contact_state in (
      'accepted',
      'not_applicable'
    )
    and not exists (
      select 1
      from public.community_notifications existing
      where existing.user_id = recipient.user_id
        and existing.notification_type = 'direct_message'
        and existing.entity_type = 'direct_message'
        and existing.entity_id = new.id::text
    );

  return new;
end;
$function$;

revoke all
on function messaging.emit_direct_message_notification()
from public, anon, authenticated;

create trigger messages_emit_direct_notification
after insert
on messaging.messages
for each row
execute function messaging.emit_direct_message_notification();

do $phase_8b_messages_notification_postcheck$
declare
  v_definition text;
  v_owner text;
  v_security_definer boolean;
  v_config text[];
  v_trigger_count integer;
begin
  select
    pg_catalog.pg_get_functiondef(proc.oid),
    pg_catalog.pg_get_userbyid(proc.proowner),
    proc.prosecdef,
    proc.proconfig
  into
    v_definition,
    v_owner,
    v_security_definer,
    v_config
  from pg_catalog.pg_proc proc
  join pg_catalog.pg_namespace namespace
    on namespace.oid = proc.pronamespace
  where namespace.nspname = 'messaging'
    and proc.proname =
        'emit_direct_message_notification'
    and pg_catalog.pg_get_function_identity_arguments(
      proc.oid
    ) = '';

  if v_definition is null
     or position(
       '''direct_message''' in v_definition
     ) = 0
     or position(
       '''/messages''' in v_definition
     ) = 0
     or position(
       'recipient.mailbox_folder' in v_definition
     ) = 0
     or position(
       'recipient.first_contact_state' in v_definition
     ) = 0
  then
    raise exception
      'STOP: Messages notification bridge definition is incomplete';
  end if;

  if position('new.body' in lower(v_definition)) <> 0
     or position(
       '''body''' in lower(v_definition)
     ) <> 0
  then
    raise exception
      'STOP: Messages notification bridge may expose Message body';
  end if;

  if v_owner <> 'postgres'
     or not v_security_definer
     or v_config is distinct from
        array[
          'search_path=pg_catalog, public, messaging'
        ]::text[]
  then
    raise exception
      'STOP: Messages notification bridge security posture drifted';
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
      'STOP: Messages notification trigger function is client-executable';
  end if;

  select count(*)
  into v_trigger_count
  from pg_catalog.pg_trigger trigger_row
  where trigger_row.tgrelid =
        'messaging.messages'::pg_catalog.regclass
    and trigger_row.tgname =
        'messages_emit_direct_notification'
    and not trigger_row.tgisinternal
    and trigger_row.tgenabled <> 'D';

  if v_trigger_count <> 1 then
    raise exception
      'STOP: Messages notification trigger is not active exactly once';
  end if;
end;
$phase_8b_messages_notification_postcheck$;

commit;
