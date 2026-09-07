-- Phase 8B.4 Candidate A forward repair.
-- Resolve the PL/pgSQL actor_key variable/column ambiguity in the mixed-actor
-- Messages notification bridge. No authority or scope expansion.

begin;
set local statement_timeout='30s';
set local lock_timeout='5s';
select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('phase-8b4-system-actor-notification-fix',0));

create or replace function messaging.emit_direct_message_notification()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,messaging,platform_private
as $$
declare
  v_sender_kind text;
  v_sender_user_id uuid;
  v_sender_actor_key text;
  v_sender_name text;
begin
  select p.actor_kind,p.user_id,p.actor_key
  into v_sender_kind,v_sender_user_id,v_sender_actor_key
  from messaging.conversation_participants p
  where p.id=new.sender_participant_id
    and p.conversation_id=new.conversation_id
    and p.membership_status='active';

  if v_sender_kind='human' then
    if v_sender_user_id is null then return new; end if;
    select coalesce(nullif(btrim(u.display_name),''),nullif(btrim(u.username_normalized),''),'Someone')
    into v_sender_name
    from public.user_profiles u
    where u.user_id=v_sender_user_id and u.status='active';
  elsif v_sender_kind in('system','automation') then
    select a.label
    into v_sender_name
    from platform_private.system_actors a
    where a.actor_key=v_sender_actor_key;
    if v_sender_name is null then return new; end if;
  else
    return new;
  end if;

  insert into public.community_notifications(
    user_id,actor_id,notification_type,entity_type,entity_id,entity_slug,comment_id,metadata
  )
  select
    r.user_id,
    case when v_sender_kind='human' then v_sender_user_id else null end,
    'direct_message',
    'direct_message',
    new.id::text,
    null,
    null,
    jsonb_strip_nulls(jsonb_build_object(
      'canonical_path','/messages',
      'conversation_id',new.conversation_id,
      'message_id',new.id,
      'sender_display_name',coalesce(v_sender_name,'Someone'),
      'sender_actor_kind',v_sender_kind,
      'sender_actor_key',case when v_sender_kind in('system','automation') then v_sender_actor_key else null end
    ))
  from messaging.conversation_participants r
  where r.conversation_id=new.conversation_id
    and r.id<>new.sender_participant_id
    and r.actor_kind='human'
    and r.user_id is not null
    and (v_sender_user_id is null or r.user_id<>v_sender_user_id)
    and r.membership_status='active'
    and r.mailbox_folder in('inbox','archived')
    and r.first_contact_state in('accepted','not_applicable')
    and not exists(
      select 1
      from public.community_notifications e
      where e.user_id=r.user_id
        and e.notification_type='direct_message'
        and e.entity_type='direct_message'
        and e.entity_id=new.id::text
    );

  return new;
end
$$;

revoke all on function messaging.emit_direct_message_notification()
from public,anon,authenticated,service_role;

do $postcheck$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='messaging' and p.proname='emit_direct_message_notification';
  if d is null
     or position('v_sender_actor_key' in d)=0
     or position('sender_actor_key' in d)=0
     or position('new.body' in lower(d))<>0
  then
    raise exception 'STOP: repaired System Actor notification projection is incomplete';
  end if;
end
$postcheck$;

commit;
