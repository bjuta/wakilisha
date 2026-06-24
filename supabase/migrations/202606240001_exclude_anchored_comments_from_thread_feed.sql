-- Keep timestamp/release/chart anchored comments out of the generic Community feed.
-- Anchored comments remain available through their dedicated moment/context RPCs.

drop function if exists public.community_get_thread_comments(uuid, text, integer, integer);

create or replace function public.community_get_thread_comments(
  p_thread_id uuid,
  p_sort_by text default 'best',
  p_limit integer default 50,
  p_offset integer default 0
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
  anchor_type text,
  anchor_time_ms integer,
  anchor_end_time_ms integer,
  anchor_label text,
  context_entity_type text,
  context_entity_id text,
  context_entity_slug text,
  context_label text
)
language sql
security definer
set search_path = public
stable
as $$
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
    c.anchor_type,
    c.anchor_time_ms,
    c.anchor_end_time_ms,
    c.anchor_label,
    c.context_entity_type,
    c.context_entity_id,
    c.context_entity_slug,
    c.context_label
  from public.community_comments c
  where c.thread_id = p_thread_id
    and c.parent_id is null
    and c.deleted_at is null
    and c.status::text not in ('deleted', 'removed', 'spam')
    and (c.anchor_type is null or c.anchor_type = 'whole_entity')
  order by
    c.is_pinned desc,
    case when p_sort_by = 'editor_picks' then c.is_editor_pick else false end desc,
    case when p_sort_by = 'newest' then c.created_at end desc,
    case when p_sort_by = 'oldest' then c.created_at end asc,
    case when p_sort_by = 'most_replied' then coalesce(c.reply_count, 0) end desc,
    case when p_sort_by = 'best' then coalesce(c.score, 0) end desc,
    case when p_sort_by = 'best' then coalesce(c.reaction_count, 0) end desc,
    c.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.community_get_thread_comments(uuid, text, integer, integer) to anon, authenticated;
