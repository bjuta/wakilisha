-- WAKILISHA M8C.4-M1: canonical Post mentions and notification preference enforcement.
-- Mentions remain authored Post text. Durable authority resolves a published @handle to
-- the canonical Person UUID, while Drafts remain private text until publication.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $m8c4_preflight$
begin
  if to_regclass('public.community_posts') is null
     or to_regclass('public.community_notifications') is null
     or to_regclass('public.community_notification_preferences') is null
     or to_regclass('public.community_blocks') is null
     or to_regclass('public.user_profiles') is null
     or to_regclass('editorial.people') is null
     or to_regclass('editorial.person_identity_links') is null
     or to_regclass('private.community_post_drafts') is null
     or to_regclass('private.phase_0a_rpc_classification') is null
     or to_regprocedure('public.community_normalize_username(text)') is null
     or to_regprocedure('public.community_username_is_valid(text)') is null
     or to_regprocedure('editorial.resolve_person_follow_target(uuid)') is null
     or to_regprocedure('private.community_is_blocked_target(uuid,text,text)') is null
     or to_regprocedure('public.community_get_post(uuid)') is null
     or to_regprocedure('public.community_publish_post(text,uuid,text,text,text,text,uuid)') is null
     or to_regprocedure('public.community_edit_post(uuid,text,text,text,text,uuid)') is null
     or to_regprocedure('public.community_quote_post(text,uuid,uuid,text,text,text,text,uuid)') is null
     or to_regprocedure('public.community_distribute_notifications(uuid,uuid,uuid,uuid)') is null then
    raise exception 'STOP: M8C.4 requires final M8B/M8C.3 Post, Block, Person, and notification authority';
  end if;

  if to_regclass('public.community_post_mentions') is not null
     or to_regprocedure('private.community_notification_preference_enabled(uuid,text)') is not null
     or to_regprocedure('private.community_extract_post_mention_handles(text)') is not null
     or to_regprocedure('private.community_resolve_post_mentions(text)') is not null
     or to_regprocedure('private.community_reconcile_post_mentions(uuid)') is not null
     or to_regprocedure('public.community_get_post_mentions(uuid)') is not null
     or to_regprocedure('public.community_get_post_legacy_m8c4(uuid)') is not null then
    raise exception 'STOP: M8C.4 mention authority already exists';
  end if;

  if exists (
    select 1
    from public.community_notifications notification
    where notification.notification_type='post_mention'
  ) then
    raise exception 'STOP: post_mention notifications already exist without M8C.4 authority';
  end if;
end;
$m8c4_preflight$;

create table public.community_post_mentions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null,
  person_resource_id uuid not null,
  mentioned_user_id uuid,
  handle_at_mention text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint community_post_mentions_post_fkey
    foreign key (post_id)
    references public.community_posts(id)
    on update restrict on delete restrict,
  constraint community_post_mentions_person_fkey
    foreign key (person_resource_id)
    references editorial.people(resource_id)
    on update restrict on delete restrict,
  constraint community_post_mentions_user_fkey
    foreign key (mentioned_user_id)
    references auth.users(id)
    on update restrict on delete set null,
  constraint community_post_mentions_handle_check
    check (
      char_length(handle_at_mention) between 3 and 30
      and handle_at_mention = lower(handle_at_mention)
      and handle_at_mention ~ '^[a-z0-9][a-z0-9_]*[a-z0-9]$'
    ),
  constraint community_post_mentions_post_person_key
    unique (post_id,person_resource_id),
  constraint community_post_mentions_post_handle_key
    unique (post_id,handle_at_mention)
);

create index community_post_mentions_person_idx
on public.community_post_mentions (person_resource_id,created_at desc,id desc);

create index community_post_mentions_user_idx
on public.community_post_mentions (mentioned_user_id,created_at desc,id desc)
where mentioned_user_id is not null;

alter table public.community_post_mentions enable row level security;

revoke all on table public.community_post_mentions
from public,anon,authenticated;

grant select on table public.community_post_mentions
to service_role;

comment on table public.community_post_mentions is
  'Resolved canonical Person mentions derived from published Post text. Browser access is reader-RPC only.';

create unique index community_notifications_post_mention_once
on public.community_notifications (
  user_id,
  notification_type,
  entity_type,
  entity_id
)
where notification_type='post_mention';

create or replace function private.community_notification_preference_enabled(
  p_user_id uuid,
  p_notification_type text
)
returns boolean
language sql
stable
security definer
set search_path=pg_catalog,public,private
as $function$
  select case lower(btrim(coalesce(p_notification_type,'')))
    when 'reply' then coalesce(
      (
        select preference.reply_notifications
        from public.community_notification_preferences preference
        where preference.user_id=p_user_id
      ),
      true
    )
    when 'mention' then coalesce(
      (
        select preference.mention_notifications
        from public.community_notification_preferences preference
        where preference.user_id=p_user_id
      ),
      true
    )
    when 'post_mention' then coalesce(
      (
        select preference.mention_notifications
        from public.community_notification_preferences preference
        where preference.user_id=p_user_id
      ),
      true
    )
    when 'follow' then coalesce(
      (
        select preference.follow_notifications
        from public.community_notification_preferences preference
        where preference.user_id=p_user_id
      ),
      false
    )
    else true
  end;
$function$;

revoke all
on function private.community_notification_preference_enabled(uuid,text)
from public,anon,authenticated;

grant execute
on function private.community_notification_preference_enabled(uuid,text)
to service_role;

-- Extract authored mention tokens independently from current username ownership.
-- Existing durable rows use this token set during edits so a released handle cannot
-- silently retarget an old mention if somebody else later claims that username.
create or replace function private.community_extract_post_mention_handles(
  p_body text
)
returns table (
  handle text
)
language sql
immutable
security definer
set search_path=pg_catalog,public,private
as $function$
  with sanitized as (
    select regexp_replace(
      coalesce(p_body,''),
      'https?://[^[:space:]]+',
      ' ',
      'gi'
    ) as body
  ),
  candidates as (
    select distinct
      public.community_normalize_username(
        (matched.captures)[2]
      ) as handle
    from sanitized
    cross join lateral regexp_matches(
      sanitized.body,
      '(^|[^[:alnum:]_])@([[:alnum:]_]{3,30})(?=$|[^[:alnum:]_])',
      'g'
    ) as matched(captures)
  )
  select candidate.handle
  from candidates candidate
  where candidate.handle is not null
    and public.community_username_is_valid(candidate.handle)
  order by candidate.handle;
$function$;

revoke all
on function private.community_extract_post_mention_handles(text)
from public,anon,authenticated;

grant execute
on function private.community_extract_post_mention_handles(text)
to service_role;

create or replace function private.community_resolve_post_mentions(
  p_body text
)
returns table (
  person_resource_id uuid,
  mentioned_user_id uuid,
  handle_at_mention text,
  canonical_path text
)
language sql
stable
security definer
set search_path=pg_catalog,public,editorial,private
as $function$
  with candidate_handles as (
    select extracted.handle
    from private.community_extract_post_mention_handles(p_body) extracted
  ),
  resolved_handles as (
    select
      resolved.person_resource_id,
      profile.user_id as mentioned_user_id,
      candidate.handle as handle_at_mention,
      resolved.canonical_path
    from candidate_handles candidate
    join public.user_profiles profile
      on profile.username_normalized=candidate.handle
     and profile.status='active'
     and profile.is_public
    join editorial.person_identity_links link
      on link.user_id=profile.user_id
     and link.link_state='active'
    cross join lateral editorial.resolve_person_follow_target(
      link.person_resource_id
    ) resolved
    where candidate.handle is not null
      and public.community_username_is_valid(candidate.handle)
      and resolved.followable
  )
  select distinct on (resolved.person_resource_id)
    resolved.person_resource_id,
    resolved.mentioned_user_id,
    resolved.handle_at_mention,
    resolved.canonical_path
  from resolved_handles resolved
  order by
    resolved.person_resource_id,
    resolved.handle_at_mention,
    resolved.mentioned_user_id;
$function$;

revoke all
on function private.community_resolve_post_mentions(text)
from public,anon,authenticated;

grant execute
on function private.community_resolve_post_mentions(text)
to service_role;

create or replace function public.community_get_post_mentions(
  p_post_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,editorial,private
as $function$
declare
  v_status text;
  v_mentions jsonb;
begin
  select post.status
  into v_status
  from public.community_posts post
  where post.id=p_post_id;

  if not found or v_status<>'published' then
    return '[]'::jsonb;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'handle',mention.handle_at_mention,
        'person_id',resolved.person_resource_id,
        'canonical_path',resolved.canonical_path
      )
      order by mention.handle_at_mention,mention.id
    ),
    '[]'::jsonb
  )
  into v_mentions
  from public.community_post_mentions mention
  cross join lateral editorial.resolve_person_follow_target(
    mention.person_resource_id
  ) resolved
  where mention.post_id=p_post_id
    and resolved.followable;

  return v_mentions;
end;
$function$;

revoke all
on function public.community_get_post_mentions(uuid)
from public;

grant execute
on function public.community_get_post_mentions(uuid)
to anon,authenticated;

create or replace function private.community_reconcile_post_mentions(
  p_post_id uuid
)
returns void
language plpgsql
security definer
set search_path=pg_catalog,public,editorial,private
as $function$
declare
  v_post public.community_posts%rowtype;
  v_target record;
  v_existing public.community_post_mentions%rowtype;
  v_actor_id text;
  v_post_path text;
  v_handles text[];
begin
  select *
  into v_post
  from public.community_posts post
  where post.id=p_post_id;

  if not found then
    return;
  end if;

  if v_post.status<>'published' then
    delete from public.community_notifications notification
    where notification.notification_type='post_mention'
      and notification.entity_type='post'
      and notification.entity_id=p_post_id::text;

    delete from public.community_post_mentions mention
    where mention.post_id=p_post_id;
    return;
  end if;

  select coalesce(
    array_agg(extracted.handle order by extracted.handle),
    array[]::text[]
  )
  into v_handles
  from private.community_extract_post_mention_handles(v_post.body) extracted;

  -- If the authored text now resolves another handle to the same canonical Person,
  -- update only the presentation handle. This is still the same durable mention
  -- and must not produce another alert.
  update public.community_post_mentions mention
  set
    mentioned_user_id=resolved.mentioned_user_id,
    handle_at_mention=resolved.handle_at_mention,
    updated_at=now()
  from private.community_resolve_post_mentions(v_post.body) resolved
  where mention.post_id=p_post_id
    and mention.person_resource_id=resolved.person_resource_id
    and (
      mention.mentioned_user_id is distinct from resolved.mentioned_user_id
      or mention.handle_at_mention is distinct from resolved.handle_at_mention
    );

  -- A username may be released and later claimed by another account. If the
  -- original authored token is still in the Post, preserve its UUID-backed
  -- relationship instead of silently retargeting it during an unrelated edit.
  -- Only remove authority when neither the original token nor the same Person
  -- remains in the edited text.
  delete from public.community_notifications notification
  using public.community_post_mentions mention
  where mention.post_id=p_post_id
    and mention.mentioned_user_id is not null
    and notification.user_id=mention.mentioned_user_id
    and notification.notification_type='post_mention'
    and notification.entity_type='post'
    and notification.entity_id=p_post_id::text
    and not (mention.handle_at_mention=any(v_handles))
    and not exists (
      select 1
      from private.community_resolve_post_mentions(v_post.body) resolved
      where resolved.person_resource_id=mention.person_resource_id
    );

  delete from public.community_post_mentions mention
  where mention.post_id=p_post_id
    and not (mention.handle_at_mention=any(v_handles))
    and not exists (
      select 1
      from private.community_resolve_post_mentions(v_post.body) resolved
      where resolved.person_resource_id=mention.person_resource_id
    );

  v_actor_id:=case
    when v_post.actor_type='person' then v_post.person_resource_id::text
    else v_post.artist_id::text
  end;

  v_post_path:=public.community_get_post(p_post_id)->>'canonical_path';

  for v_target in
    select *
    from private.community_resolve_post_mentions(v_post.body)
  loop
    select *
    into v_existing
    from public.community_post_mentions mention
    where mention.post_id=p_post_id
      and mention.person_resource_id=v_target.person_resource_id;

    if v_existing.id is null then
      -- If this exact authored token is already durably bound to another Person,
      -- retain that original binding. Username reuse must never retarget it.
      perform 1
      from public.community_post_mentions mention
      where mention.post_id=p_post_id
        and mention.handle_at_mention=v_target.handle_at_mention;

      if found then
        continue;
      end if;

      insert into public.community_post_mentions (
        post_id,
        person_resource_id,
        mentioned_user_id,
        handle_at_mention
      )
      values (
        p_post_id,
        v_target.person_resource_id,
        v_target.mentioned_user_id,
        v_target.handle_at_mention
      )
      returning * into v_existing;

      if v_target.mentioned_user_id is not null
         and v_post.author_user_id is not null
         and v_target.mentioned_user_id<>v_post.author_user_id
         and private.community_notification_preference_enabled(
           v_target.mentioned_user_id,
           'post_mention'
         )
         and not private.community_is_blocked_target(
           v_target.mentioned_user_id,
           v_post.actor_type,
           v_actor_id
         )
         and not private.community_is_blocked_target(
           v_post.author_user_id,
           'person',
           v_target.person_resource_id::text
         ) then
        insert into public.community_notifications (
          user_id,
          actor_id,
          notification_type,
          entity_type,
          entity_id,
          metadata
        )
        values (
          v_target.mentioned_user_id,
          v_post.author_user_id,
          'post_mention',
          'post',
          p_post_id::text,
          jsonb_build_object(
            'handle',v_target.handle_at_mention,
            'mentioned_person_id',v_target.person_resource_id,
            'actor_type',v_post.actor_type,
            'actor_id',v_actor_id,
            'canonical_path',v_post_path
          )
        )
        on conflict (
          user_id,
          notification_type,
          entity_type,
          entity_id
        ) where notification_type='post_mention'
        do nothing;
      end if;
    else
      update public.community_post_mentions mention
      set
        mentioned_user_id=v_target.mentioned_user_id,
        handle_at_mention=v_target.handle_at_mention,
        updated_at=now()
      where mention.id=v_existing.id
        and (
          mention.mentioned_user_id is distinct from v_target.mentioned_user_id
          or mention.handle_at_mention is distinct from v_target.handle_at_mention
        );
    end if;
  end loop;
end;
$function$;

revoke all
on function private.community_reconcile_post_mentions(uuid)
from public,anon,authenticated;

grant execute
on function private.community_reconcile_post_mentions(uuid)
to service_role;

create or replace function private.community_reconcile_post_mentions_trigger()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $function$
begin
  perform private.community_reconcile_post_mentions(new.id);
  return null;
end;
$function$;

revoke all
on function private.community_reconcile_post_mentions_trigger()
from public,anon,authenticated,service_role;

create trigger trg_community_posts_mentions
  after insert or update of body,status
  on public.community_posts
  for each row
  execute function private.community_reconcile_post_mentions_trigger();

-- Existing Posts gain canonical mention presentation without sending retroactive alerts.
insert into public.community_post_mentions (
  post_id,
  person_resource_id,
  mentioned_user_id,
  handle_at_mention
)
select
  post.id,
  mention.person_resource_id,
  mention.mentioned_user_id,
  mention.handle_at_mention
from public.community_posts post
cross join lateral private.community_resolve_post_mentions(post.body) mention
where post.status='published'
on conflict (post_id,person_resource_id)
do update set
  mentioned_user_id=excluded.mentioned_user_id,
  handle_at_mention=excluded.handle_at_mention,
  updated_at=now();

-- Wrap the canonical Post reader so every existing Post surface inherits mentions.
alter function public.community_get_post(uuid)
rename to community_get_post_legacy_m8c4;

revoke all
on function public.community_get_post_legacy_m8c4(uuid)
from public,anon,authenticated;

create function public.community_get_post(
  p_post_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $function$
declare
  v_payload jsonb;
  v_quote_id uuid;
begin
  v_payload:=public.community_get_post_legacy_m8c4(p_post_id);

  if v_payload is null then
    return null;
  end if;

  v_payload:=jsonb_set(
    v_payload,
    '{mentions}',
    public.community_get_post_mentions(p_post_id),
    true
  );

  if coalesce(v_payload->'quoted_post'->>'available','false')='true' then
    v_quote_id:=nullif(v_payload->'quoted_post'->>'id','')::uuid;
    if v_quote_id is not null then
      v_payload:=jsonb_set(
        v_payload,
        '{quoted_post,mentions}',
        public.community_get_post_mentions(v_quote_id),
        true
      );
    end if;
  end if;

  return v_payload;
end;
$function$;

revoke all
on function public.community_get_post(uuid)
from public;

grant execute
on function public.community_get_post(uuid)
to anon,authenticated;

-- The stored Reply preference becomes authoritative for Reply alerts.
create or replace function public.community_distribute_notifications(
  p_thread_id uuid,
  p_comment_id uuid,
  p_author_id uuid,
  p_parent_id uuid default null
)
returns void
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $function$
declare
  v_thread_record record;
  v_parent_author_id uuid;
  v_follower record;
  v_actor_username text;
begin
  select entity_type,entity_slug,entity_id,title
  into v_thread_record
  from public.community_threads
  where id=p_thread_id;

  select username
  into v_actor_username
  from public.community_profiles
  where user_id=p_author_id;

  if p_parent_id is not null then
    select author_id
    into v_parent_author_id
    from public.community_comments
    where id=p_parent_id;

    if v_parent_author_id is not null
       and v_parent_author_id<>p_author_id
       and private.community_notification_preference_enabled(
         v_parent_author_id,
         'reply'
       ) then
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
      values (
        v_parent_author_id,
        p_author_id,
        'reply',
        v_thread_record.entity_type,
        v_thread_record.entity_id,
        v_thread_record.entity_slug,
        p_comment_id,
        jsonb_build_object(
          'thread_title',v_thread_record.title,
          'actor_username',v_actor_username
        )
      );
    end if;
  end if;

  for v_follower in
    select follow.user_id
    from public.community_follows follow
    where follow.target_type='thread'
      and follow.target_id=p_thread_id::text
      and follow.user_id<>p_author_id
  loop
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
    values (
      v_follower.user_id,
      p_author_id,
      'new_comment',
      v_thread_record.entity_type,
      v_thread_record.entity_id,
      v_thread_record.entity_slug,
      p_comment_id,
      jsonb_build_object(
        'thread_title',v_thread_record.title,
        'actor_username',v_actor_username
      )
    );
  end loop;
end;
$function$;

revoke all
on function public.community_distribute_notifications(uuid,uuid,uuid,uuid)
from public,anon,authenticated;

grant execute
on function public.community_distribute_notifications(uuid,uuid,uuid,uuid)
to service_role;

insert into private.phase_0a_rpc_classification (
  function_signature,
  access_class,
  rationale,
  reviewed_at
)
values (
  'community_get_post_mentions(uuid)',
  'public_read',
  'Reads resolved canonical Person mentions only for a published canonical Post.',
  now()
)
on conflict(function_signature)
do update set
  access_class=excluded.access_class,
  rationale=excluded.rationale,
  reviewed_at=excluded.reviewed_at;

commit;
