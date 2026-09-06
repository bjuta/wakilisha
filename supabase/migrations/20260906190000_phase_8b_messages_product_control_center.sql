begin;

set local statement_timeout='180s';
set local lock_timeout='5s';
select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'phase-8b-messages-product-control-center',
    0
  )
);

do $preflight$
begin
  if to_regnamespace('messaging') is null
     or to_regprocedure('public.start_message_conversation(uuid,text,jsonb,text,uuid,timestamptz)') is null
     or to_regprocedure('public.list_my_message_conversations(text,timestamptz,uuid,integer)') is null
     or to_regprocedure('public.current_user_has_capability(text)') is null then
    raise exception 'STOP: accepted Phase 8B.2 Messages authority is missing';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version='20260906154236'
      and name='phase_8b_messages_user_commands_reads'
  ) then
    raise exception 'STOP: exact Phase 8B.2 migration authority is missing';
  end if;

  if to_regprocedure('public.search_message_recipients(text,integer)') is not null
     or to_regprocedure('public.get_messages_control_center_status()') is not null then
    raise exception 'STOP: Phase 8B.3 Messages product reads already exist';
  end if;

  if not exists (
    select 1
    from public.role_capabilities
    where role_key='super_admin'
      and capability_key='manage_messages_control_center'
  ) then
    raise exception 'STOP: Messages Control Center capability authority is missing';
  end if;

  if exists (
    select 1
    from public.role_capabilities
    where capability_key='manage_messages_control_center'
      and role_key<>'super_admin'
  ) then
    raise exception 'STOP: Messages Control Center capability leaked beyond super_admin';
  end if;
end
$preflight$;

create function public.search_message_recipients(
  p_query text,
  p_limit integer default 8
)
returns table (
  person_resource_id uuid,
  handle text,
  display_name text,
  avatar_url text,
  sender_category text
)
language plpgsql
stable
security definer
set search_path=pg_catalog,auth,public,editorial,messaging
as $function$
declare
  me record;
  q text;
  lim integer;
begin
  select * into me
  from messaging.current_human_identity();

  if not messaging.audience_allows_category(me.sender_category) then
    return;
  end if;

  q := lower(btrim(coalesce(p_query,'')));
  lim := least(greatest(coalesce(p_limit,8),1),12);

  if length(q) < 1 then
    return;
  end if;

  return query
  select
    link.person_resource_id,
    coalesce(
      nullif(presentation->>'username',''),
      profile.username_normalized
    ) as handle,
    coalesce(
      nullif(presentation->>'display_name',''),
      nullif(btrim(profile.display_name),''),
      profile.username_normalized,
      'WAKILISHA member'
    ) as display_name,
    coalesce(
      nullif(presentation->>'avatar_url',''),
      profile.avatar_url
    ) as avatar_url,
    messaging.user_sender_category(profile.user_id) as sender_category
  from public.user_profiles profile
  join editorial.person_identity_links link
    on link.user_id=profile.user_id
   and link.link_state='active'
  join editorial.people person
    on person.resource_id=link.person_resource_id
   and person.person_state='active'
  cross join lateral editorial.resolve_person_presentation(
    link.person_resource_id
  ) presentation
  where profile.status='active'
    and profile.user_id<>me.user_id
    and messaging.audience_allows_category(
      messaging.user_sender_category(profile.user_id)
    )
    and not messaging.person_blocked_between(
      me.user_id,
      link.person_resource_id
    )
    and coalesce(
      (
        select policy.first_contact_disposition
        from messaging.user_sender_policies policy
        where policy.user_id=profile.user_id
          and policy.sender_category=me.sender_category
      ),
      messaging.default_first_contact_disposition(me.sender_category)
    )<>'reject'
    and (
      position(
        q in lower(coalesce(profile.username_normalized,''))
      ) > 0
      or position(
        q in lower(coalesce(profile.display_name,''))
      ) > 0
    )
  order by
    case
      when left(
        lower(coalesce(profile.username_normalized,'')),
        length(q)
      )=q then 0
      else 1
    end,
    case
      when left(
        lower(coalesce(profile.display_name,'')),
        length(q)
      )=q then 0
      else 1
    end,
    lower(
      coalesce(
        nullif(btrim(profile.display_name),''),
        profile.username_normalized,
        ''
      )
    ),
    link.person_resource_id
  limit lim;
end
$function$;

comment on function public.search_message_recipients(text,integer) is
  'Authenticated Messages recipient discovery constrained by canonical Person identity, active Messages audience policy, and existing person blocks.';

create function public.get_my_message_access()
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,auth,public,editorial,messaging
as $function$
declare
  me record;
  can_send boolean;
  has_conversations boolean;
begin
  select * into me
  from messaging.current_human_identity();

  can_send := messaging.audience_allows_category(
    me.sender_category
  );

  select exists (
    select 1
    from messaging.conversation_participants participant
    where participant.user_id=me.user_id
      and participant.person_resource_id=me.person_resource_id
      and participant.membership_status='active'
  )
  into has_conversations;

  return jsonb_build_object(
    'audience_mode',(
      select policy.audience_mode
      from messaging.runtime_policy policy
      where policy.singleton
    ),
    'sender_category',me.sender_category,
    'can_send',can_send,
    'has_conversations',has_conversations,
    'visible',can_send or has_conversations
  );
end
$function$;

comment on function public.get_my_message_access() is
  'Authenticated Messages product availability. Audience policy controls new delivery while existing participants may retain conversation visibility.';

create function public.get_messages_control_center_status()
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,auth,public,messaging
as $function$
declare
  me record;
  allowed boolean;
begin
  select * into me
  from messaging.current_human_identity();

  select
    exists (
      select 1
      from public.user_role_assignments assignment
      where assignment.user_id=me.user_id
        and assignment.role_key='super_admin'
        and assignment.status='active'
        and (
          assignment.expires_at is null
          or assignment.expires_at>now()
        )
    )
    and public.current_user_has_capability(
      'manage_messages_control_center'
    )
  into allowed;

  if not allowed then
    raise exception using
      errcode='42501',
      message='Messages Control Center requires active Super Admin authority.';
  end if;

  return jsonb_build_object(
    'audience_mode',(
      select policy.audience_mode
      from messaging.runtime_policy policy
      where policy.singleton
    ),
    'policy_revision',(
      select policy.revision
      from messaging.runtime_policy policy
      where policy.singleton
    ),
    'active_conversations',(
      select count(*)
      from messaging.conversations conversation
      where conversation.status='active'
    ),
    'messages',(
      select count(*)
      from messaging.messages
    ),
    'pending_requests',(
      select count(*)
      from messaging.conversation_participants participant
      where participant.membership_status='active'
        and participant.first_contact_state='pending'
    ),
    'spam_conversations',(
      select count(*)
      from messaging.conversation_participants participant
      where participant.membership_status='active'
        and participant.mailbox_folder='spam'
    ),
    'active_human_participants',(
      select count(*)
      from messaging.conversation_participants participant
      where participant.membership_status='active'
        and participant.actor_kind='human'
    )
  );
end
$function$;

comment on function public.get_messages_control_center_status() is
  'Super Admin-only Messages operational status. Returns aggregate control-plane state and never ambient private Message bodies.';

revoke all
on function public.search_message_recipients(text,integer),
            public.get_my_message_access(),
            public.get_messages_control_center_status()
from public,anon,authenticated;

grant execute
on function public.search_message_recipients(text,integer),
            public.get_my_message_access(),
            public.get_messages_control_center_status()
to authenticated,service_role;

commit;
