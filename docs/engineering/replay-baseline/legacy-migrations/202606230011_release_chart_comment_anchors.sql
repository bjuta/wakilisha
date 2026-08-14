-- WAKILISHA release + chart anchored comments
-- Extends community comments so a thread can hold comments for a specific release track or chart entry.

alter table public.community_comments
  add column if not exists context_entity_type text,
  add column if not exists context_entity_id text,
  add column if not exists context_entity_slug text,
  add column if not exists context_label text;

alter table public.community_comments
  drop constraint if exists community_comments_anchor_type_check;

alter table public.community_comments
  add constraint community_comments_anchor_type_check
  check (
    anchor_type is null
    or anchor_type in (
      'whole_entity',
      'timestamp',
      'time_range',
      'release_track',
      'chart_entry'
    )
  );

create index if not exists idx_community_comments_context_anchors
  on public.community_comments (
    thread_id,
    anchor_type,
    context_entity_type,
    context_entity_slug
  )
  where deleted_at is null
    and status::text not in ('deleted', 'removed', 'spam');

create or replace function public.community_create_context_anchor_comment(
  p_thread_id uuid,
  p_body_markdown text,
  p_body_plain text default null,
  p_body_html text default null,
  p_anchor_type text default null,
  p_context_entity_type text default null,
  p_context_entity_id text default null,
  p_context_entity_slug text default null,
  p_context_label text default null,
  p_anchor_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_comment_id uuid;
  v_comment public.community_comments%rowtype;
  v_anchor_type text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if nullif(trim(coalesce(p_body_markdown, '')), '') is null then
    raise exception 'Comment body cannot be empty' using errcode = '22023';
  end if;

  v_anchor_type := nullif(trim(coalesce(p_anchor_type, '')), '');

  if v_anchor_type is null or v_anchor_type not in ('release_track', 'chart_entry') then
    raise exception 'Unsupported context anchor type' using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_context_entity_type, '')), '') is null then
    raise exception 'Context entity type is required' using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_context_entity_id, p_context_entity_slug, '')), '') is null then
    raise exception 'Context entity id or slug is required' using errcode = '22023';
  end if;

  select public.community_create_comment(
    p_thread_id,
    null,
    p_body_markdown,
    p_body_plain,
    p_body_html,
    'visible'
  )
  into v_result;

  v_comment_id := (v_result->'comment'->>'id')::uuid;

  update public.community_comments
  set
    anchor_type = v_anchor_type,
    context_entity_type = nullif(trim(coalesce(p_context_entity_type, '')), ''),
    context_entity_id = nullif(trim(coalesce(p_context_entity_id, '')), ''),
    context_entity_slug = nullif(trim(coalesce(p_context_entity_slug, '')), ''),
    context_label = nullif(trim(coalesce(p_context_label, '')), ''),
    anchor_label = nullif(trim(coalesce(p_anchor_label, p_context_label, '')), ''),
    updated_at = now()
  where id = v_comment_id
  returning * into v_comment;

  return jsonb_build_object('comment', to_jsonb(v_comment));
end;
$$;

create or replace function public.community_get_context_anchor_comments(
  p_thread_id uuid,
  p_anchor_type text,
  p_context_entity_type text default null,
  p_context_entity_id text default null,
  p_context_entity_slug text default null,
  p_limit integer default 30
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
    and c.anchor_type = p_anchor_type
    and c.deleted_at is null
    and c.status::text not in ('deleted', 'removed', 'spam')
    and (p_context_entity_type is null or c.context_entity_type = p_context_entity_type)
    and (
      p_context_entity_id is null
      or c.context_entity_id = p_context_entity_id
    )
    and (
      p_context_entity_slug is null
      or c.context_entity_slug = p_context_entity_slug
    )
  order by
    coalesce(c.score, 0) desc,
    coalesce(c.reaction_count, 0) desc,
    c.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

create or replace function public.community_get_context_anchor_summary(
  p_thread_id uuid,
  p_anchor_type text default null,
  p_limit integer default 8
)
returns table (
  anchor_type text,
  context_entity_type text,
  context_entity_id text,
  context_entity_slug text,
  context_label text,
  anchor_label text,
  comment_count integer,
  reaction_count integer,
  score integer,
  latest_comment_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    c.anchor_type,
    c.context_entity_type,
    c.context_entity_id,
    c.context_entity_slug,
    coalesce(c.context_label, c.anchor_label, c.context_entity_slug, c.context_entity_id) as context_label,
    coalesce(c.anchor_label, c.context_label, c.context_entity_slug, c.context_entity_id) as anchor_label,
    count(*)::integer as comment_count,
    coalesce(sum(c.reaction_count), 0)::integer as reaction_count,
    coalesce(sum(c.score), 0)::integer as score,
    max(c.created_at) as latest_comment_at
  from public.community_comments c
  where c.thread_id = p_thread_id
    and c.parent_id is null
    and c.anchor_type in ('release_track', 'chart_entry')
    and (p_anchor_type is null or c.anchor_type = p_anchor_type)
    and c.deleted_at is null
    and c.status::text not in ('deleted', 'removed', 'spam')
  group by
    c.anchor_type,
    c.context_entity_type,
    c.context_entity_id,
    c.context_entity_slug,
    coalesce(c.context_label, c.anchor_label, c.context_entity_slug, c.context_entity_id),
    coalesce(c.anchor_label, c.context_label, c.context_entity_slug, c.context_entity_id)
  order by
    count(*) desc,
    coalesce(sum(c.reaction_count), 0) desc,
    coalesce(sum(c.score), 0) desc,
    max(c.created_at) desc
  limit least(greatest(coalesce(p_limit, 8), 1), 40);
$$;

grant execute on function public.community_create_context_anchor_comment(uuid, text, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.community_get_context_anchor_comments(uuid, text, text, text, text, integer) to anon, authenticated;
grant execute on function public.community_get_context_anchor_summary(uuid, text, integer) to anon, authenticated;
