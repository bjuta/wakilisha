-- Phase 2A Article editor runtime fix.
--
-- Fixes:
-- 1. ambiguous resource_id reference in get_latest_article_autosave
-- 2. exposes authorized Article version history through a public RPC
--    so the frontend no longer queries legacy wk_article_revisions.

create or replace function public.get_latest_article_autosave(
  p_article_id uuid
)
returns table (
  version_id uuid,
  version_number bigint,
  source_draft_version bigint,
  title text,
  slug text,
  excerpt text,
  content_html text,
  author_display text,
  seo jsonb,
  category_snapshot jsonb,
  tag_snapshot jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $function$
declare
  v_resource_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select binding.resource_id
  into v_resource_id
  from editorial.article_resources binding
  where binding.article_id = p_article_id;

  if v_resource_id is null then
    raise exception 'Article resource identity not found';
  end if;

  if not editorial.current_user_can_edit_article(
    v_resource_id
  ) then
    raise exception 'Permission denied';
  end if;

  return query
  select
    version.id,
    version.version_number,
    version.source_draft_version,
    version.title,
    version.slug,
    version.excerpt,
    version.content_html,
    version.author_display,
    version.seo,
    version.category_snapshot,
    version.tag_snapshot,
    version.created_at
  from editorial.article_versions version
  where version.resource_id = v_resource_id
    and version.version_kind = 'autosave'
    and version.created_by = auth.uid()
  order by version.created_at desc
  limit 1;
end;
$function$;

create or replace function public.list_article_versions(
  p_article_id uuid,
  p_limit integer default 30
)
returns table (
  id uuid,
  revision_number bigint,
  version_kind text,
  created_at timestamptz,
  created_by text,
  title text,
  content_html text,
  excerpt text,
  author text,
  categories jsonb,
  tags jsonb,
  seo jsonb,
  wp_status text,
  published_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $function$
declare
  v_resource_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select binding.resource_id
  into v_resource_id
  from editorial.article_resources binding
  where binding.article_id = p_article_id;

  if v_resource_id is null then
    raise exception 'Article resource identity not found';
  end if;

  if not editorial.current_user_can_edit_article(
    v_resource_id
  ) then
    raise exception 'Permission denied';
  end if;

  return query
  select
    version.id,
    version.version_number,
    version.version_kind,
    version.created_at,
    case
      when version.version_kind = 'autosave'
        then 'autosave'
      when version.created_by is null
        then 'System'
      else version.created_by::text
    end,
    version.title,
    version.content_html,
    version.excerpt,
    version.author_display,
    version.category_snapshot,
    version.tag_snapshot,
    version.seo,
    version.wp_status,
    version.published_at
  from editorial.article_versions version
  where version.resource_id = v_resource_id
    and version.version_kind in (
      'baseline',
      'autosave',
      'manual_save',
      'submitted'
    )
  order by version.version_number desc
  limit greatest(
    1,
    least(
      coalesce(p_limit, 30),
      100
    )
  );
end;
$function$;

revoke all
on function public.get_latest_article_autosave(uuid)
from public, anon;

grant execute
on function public.get_latest_article_autosave(uuid)
to authenticated;

revoke all
on function public.list_article_versions(uuid, integer)
from public, anon;

grant execute
on function public.list_article_versions(uuid, integer)
to authenticated;

comment on function public.list_article_versions(uuid, integer) is
  'Authorized Phase 2A Article version history reader for the admin editor.';
