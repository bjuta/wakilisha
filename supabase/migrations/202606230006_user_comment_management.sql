-- WAKILISHA community profile comment management
-- Adds profile-safe comment context, 1-hour user edit, and owner delete support.

drop function if exists public.community_get_user_comments(uuid, integer);
drop function if exists public.community_get_user_replies(uuid, integer);
drop function if exists public.community_update_comment(uuid, text, text, text);

create or replace function public.community_get_user_comments(
  p_user_id uuid,
  p_limit integer default 20
)
returns table (
  id uuid,
  thread_id uuid,
  parent_id uuid,
  root_id uuid,
  author_id uuid,
  body_markdown text,
  body_plain text,
  body_html text,
  depth integer,
  path text,
  status text,
  is_pinned boolean,
  is_editor_pick boolean,
  upvote_count integer,
  downvote_count integer,
  reply_count integer,
  reaction_count integer,
  report_count integer,
  score integer,
  created_at timestamptz,
  updated_at timestamptz,
  edited_at timestamptz,
  deleted_at timestamptz,
  thread_title text,
  thread_entity_type text,
  thread_entity_id text,
  thread_entity_slug text,
  thread_entity_url text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  return query
  select
    c.id,
    c.thread_id,
    c.parent_id,
    c.root_id,
    c.author_id,
    c.body_markdown,
    c.body_plain,
    c.body_html,
    coalesce(c.depth, 0)::integer,
    c.path::text,
    c.status::text,
    coalesce(c.is_pinned, false),
    coalesce(c.is_editor_pick, false),
    coalesce(c.upvote_count, 0)::integer,
    coalesce(c.downvote_count, 0)::integer,
    coalesce(c.reply_count, 0)::integer,
    coalesce(c.reaction_count, 0)::integer,
    coalesce(c.report_count, 0)::integer,
    coalesce(c.score, 0)::integer,
    c.created_at,
    c.updated_at,
    c.edited_at,
    c.deleted_at,
    t.title,
    t.entity_type::text,
    t.entity_id::text,
    t.entity_slug,
    t.entity_url
  from public.community_comments c
  left join public.community_threads t on t.id = c.thread_id
  where c.author_id = p_user_id
    and c.parent_id is null
    and c.deleted_at is null
    and c.status::text not in ('deleted', 'removed', 'spam')
  order by c.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
end;
$$;

create or replace function public.community_get_user_replies(
  p_user_id uuid,
  p_limit integer default 20
)
returns table (
  id uuid,
  thread_id uuid,
  parent_id uuid,
  root_id uuid,
  author_id uuid,
  body_markdown text,
  body_plain text,
  body_html text,
  depth integer,
  path text,
  status text,
  is_pinned boolean,
  is_editor_pick boolean,
  upvote_count integer,
  downvote_count integer,
  reply_count integer,
  reaction_count integer,
  report_count integer,
  score integer,
  created_at timestamptz,
  updated_at timestamptz,
  edited_at timestamptz,
  deleted_at timestamptz,
  thread_title text,
  thread_entity_type text,
  thread_entity_id text,
  thread_entity_slug text,
  thread_entity_url text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  return query
  select
    c.id,
    c.thread_id,
    c.parent_id,
    c.root_id,
    c.author_id,
    c.body_markdown,
    c.body_plain,
    c.body_html,
    coalesce(c.depth, 0)::integer,
    c.path::text,
    c.status::text,
    coalesce(c.is_pinned, false),
    coalesce(c.is_editor_pick, false),
    coalesce(c.upvote_count, 0)::integer,
    coalesce(c.downvote_count, 0)::integer,
    coalesce(c.reply_count, 0)::integer,
    coalesce(c.reaction_count, 0)::integer,
    coalesce(c.report_count, 0)::integer,
    coalesce(c.score, 0)::integer,
    c.created_at,
    c.updated_at,
    c.edited_at,
    c.deleted_at,
    t.title,
    t.entity_type::text,
    t.entity_id::text,
    t.entity_slug,
    t.entity_url
  from public.community_comments c
  left join public.community_threads t on t.id = c.thread_id
  where c.author_id = p_user_id
    and c.parent_id is not null
    and c.deleted_at is null
    and c.status::text not in ('deleted', 'removed', 'spam')
  order by c.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
end;
$$;

create or replace function public.community_update_comment(
  p_comment_id uuid,
  p_body_markdown text,
  p_body_plain text default null,
  p_body_html text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comment public.community_comments%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if nullif(trim(coalesce(p_body_markdown, '')), '') is null then
    raise exception 'Comment body cannot be empty' using errcode = '22023';
  end if;

  select *
  into v_comment
  from public.community_comments
  where id = p_comment_id;

  if not found then
    raise exception 'Comment not found' using errcode = 'P0002';
  end if;

  if v_comment.author_id <> auth.uid() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if v_comment.deleted_at is not null or v_comment.status::text in ('deleted', 'removed', 'spam') then
    raise exception 'Comment is no longer editable' using errcode = 'P0003';
  end if;

  if v_comment.created_at < now() - interval '1 hour' then
    raise exception 'Comment edit window has expired' using errcode = 'P0004';
  end if;

  update public.community_comments
  set
    body_markdown = trim(p_body_markdown),
    body_plain = coalesce(nullif(trim(p_body_plain), ''), trim(p_body_markdown)),
    body_html = p_body_html,
    edited_at = now(),
    updated_at = now()
  where id = p_comment_id
  returning * into v_comment;

  return jsonb_build_object('comment', to_jsonb(v_comment));
end;
$$;

grant execute on function public.community_get_user_comments(uuid, integer) to authenticated;
grant execute on function public.community_get_user_replies(uuid, integer) to authenticated;
grant execute on function public.community_update_comment(uuid, text, text, text) to authenticated;
