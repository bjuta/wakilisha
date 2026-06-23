-- WAKILISHA track moment comments
-- Adds timestamp anchors to the existing community comment system.

alter table public.community_comments
  add column if not exists anchor_type text,
  add column if not exists anchor_time_ms integer,
  add column if not exists anchor_end_time_ms integer,
  add column if not exists anchor_label text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'community_comments_anchor_type_check'
  ) then
    alter table public.community_comments
      add constraint community_comments_anchor_type_check
      check (
        anchor_type is null
        or anchor_type in ('whole_entity', 'timestamp', 'time_range')
      );
  end if;
end $$;

create index if not exists idx_community_comments_track_moments
  on public.community_comments (thread_id, anchor_type, anchor_time_ms)
  where deleted_at is null
    and status::text not in ('deleted', 'removed', 'spam');

create or replace function public.community_create_track_moment_comment(
  p_thread_id uuid,
  p_body_markdown text,
  p_body_plain text default null,
  p_body_html text default null,
  p_anchor_time_ms integer default null,
  p_anchor_end_time_ms integer default null,
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

  if p_anchor_time_ms is null or p_anchor_time_ms < 0 then
    raise exception 'Moment timestamp is required' using errcode = '22023';
  end if;

  v_anchor_type := case
    when p_anchor_end_time_ms is not null and p_anchor_end_time_ms > p_anchor_time_ms then 'time_range'
    else 'timestamp'
  end;

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
    anchor_time_ms = p_anchor_time_ms,
    anchor_end_time_ms = case
      when p_anchor_end_time_ms is not null and p_anchor_end_time_ms > p_anchor_time_ms
      then p_anchor_end_time_ms
      else null
    end,
    anchor_label = nullif(trim(coalesce(p_anchor_label, '')), ''),
    updated_at = now()
  where id = v_comment_id
  returning * into v_comment;

  return jsonb_build_object('comment', to_jsonb(v_comment));
end;
$$;

create or replace function public.community_get_track_moment_comments(
  p_thread_id uuid,
  p_anchor_time_ms integer default null,
  p_window_ms integer default 2500,
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
  anchor_label text
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
    c.anchor_label
  from public.community_comments c
  where c.thread_id = p_thread_id
    and c.parent_id is null
    and c.anchor_type in ('timestamp', 'time_range')
    and c.anchor_time_ms is not null
    and c.deleted_at is null
    and c.status::text not in ('deleted', 'removed', 'spam')
    and (
      p_anchor_time_ms is null
      or abs(c.anchor_time_ms - p_anchor_time_ms) <= greatest(coalesce(p_window_ms, 2500), 0)
    )
  order by
    case when p_anchor_time_ms is not null then abs(c.anchor_time_ms - p_anchor_time_ms) else 0 end asc,
    coalesce(c.score, 0) desc,
    coalesce(c.reaction_count, 0) desc,
    c.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

create or replace function public.community_get_track_moment_summary(
  p_thread_id uuid,
  p_limit integer default 6
)
returns table (
  anchor_time_ms integer,
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
  with bucketed as (
    select
      (floor(c.anchor_time_ms::numeric / 5000) * 5000)::integer as bucket_ms,
      count(*)::integer as comment_count,
      coalesce(sum(c.reaction_count), 0)::integer as reaction_count,
      coalesce(sum(c.score), 0)::integer as score,
      max(c.created_at) as latest_comment_at
    from public.community_comments c
    where c.thread_id = p_thread_id
      and c.parent_id is null
      and c.anchor_type in ('timestamp', 'time_range')
      and c.anchor_time_ms is not null
      and c.deleted_at is null
      and c.status::text not in ('deleted', 'removed', 'spam')
    group by 1
  )
  select
    bucket_ms as anchor_time_ms,
    (floor(bucket_ms / 60000)::integer)::text || ':' ||
      lpad((floor((bucket_ms % 60000) / 1000)::integer)::text, 2, '0') as anchor_label,
    comment_count,
    reaction_count,
    score,
    latest_comment_at
  from bucketed
  order by
    comment_count desc,
    reaction_count desc,
    score desc,
    latest_comment_at desc
  limit least(greatest(coalesce(p_limit, 6), 1), 20);
$$;

grant execute on function public.community_create_track_moment_comment(uuid, text, text, text, integer, integer, text) to authenticated;
grant execute on function public.community_get_track_moment_comments(uuid, integer, integer, integer) to anon, authenticated;
grant execute on function public.community_get_track_moment_summary(uuid, integer) to anon, authenticated;
