create table if not exists public.wk_article_preview_links (
  id uuid primary key default gen_random_uuid(),
  nonce text not null unique default gen_random_uuid()::text,
  article_id uuid not null
    references public.wk_articles(id)
    on delete cascade,
  version_id uuid not null
    references editorial.article_versions(id)
    on delete cascade,
  created_by uuid
    references auth.users(id)
    on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  constraint wk_article_preview_links_nonce_not_blank
    check (btrim(nonce) <> ''),
  constraint wk_article_preview_links_expiry_after_created
    check (expires_at > created_at)
);

create index if not exists wk_article_preview_links_active_nonce_idx
  on public.wk_article_preview_links (nonce)
  where revoked_at is null;

create index if not exists wk_article_preview_links_article_created_idx
  on public.wk_article_preview_links (article_id, created_at desc);

alter table public.wk_article_preview_links
  enable row level security;

drop policy if exists wk_article_preview_links_service_role_all
  on public.wk_article_preview_links;

create policy wk_article_preview_links_service_role_all
on public.wk_article_preview_links
for all
to service_role
using (true)
with check (true);

revoke all on table public.wk_article_preview_links
  from anon, authenticated;

grant select, insert, update, delete
  on table public.wk_article_preview_links
  to service_role;

create or replace function public.create_article_preview_link(
  p_article_id uuid,
  p_version_id uuid default null,
  p_expires_at timestamptz default null
)
returns table (
  nonce text,
  expires_at timestamptz,
  version_id uuid
)
language plpgsql
security definer
set search_path = public, editorial, pg_temp
as $$
declare
  v_version editorial.article_versions%rowtype;
  v_nonce text := gen_random_uuid()::text;
  v_expires_at timestamptz := coalesce(
    p_expires_at,
    now() + interval '7 days'
  );
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if p_article_id is null then
    raise exception 'article id is required';
  end if;

  if v_expires_at <= now() then
    raise exception 'preview expiry must be in the future';
  end if;

  if p_version_id is null then
    select version.*
      into v_version
    from editorial.article_versions version
    where version.article_id = p_article_id
    order by version.version_number desc
    limit 1;
  else
    select version.*
      into v_version
    from editorial.article_versions version
    where version.id = p_version_id
      and version.article_id = p_article_id
    limit 1;
  end if;

  if v_version.id is null then
    raise exception 'article version not found';
  end if;

  insert into public.wk_article_preview_links (
    nonce,
    article_id,
    version_id,
    created_by,
    expires_at
  )
  values (
    v_nonce,
    p_article_id,
    v_version.id,
    auth.uid(),
    v_expires_at
  );

  update public.wk_articles article
     set preview_nonce = v_nonce,
         preview_nonce_expires_at = v_expires_at,
         updated_at = now()
   where article.id = p_article_id;

  return query
  select
    v_nonce,
    v_expires_at,
    v_version.id;
end;
$$;

create or replace function public.resolve_article_preview_nonce(
  p_nonce text
)
returns table (
  id uuid,
  slug text,
  title text,
  excerpt text,
  content_html text,
  author text,
  published_at timestamptz,
  categories jsonb,
  tags jsonb,
  hero_image_url text,
  seo jsonb,
  wp_status text,
  raw_meta jsonb,
  version_id uuid,
  version_number integer,
  preview_expires_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  draft_version integer
)
language sql
stable
security definer
set search_path = public, editorial, pg_temp
as $$
  select
    article.id,
    version.slug,
    version.title,
    version.excerpt,
    version.content_html,
    coalesce(version.author_display, article.author) as author,
    version.published_at,
    version.category_snapshot as categories,
    version.tag_snapshot as tags,
    version.hero_image_url,
    version.seo,
    coalesce(version.wp_status, article.wp_status, 'draft') as wp_status,
    article.raw_meta,
    version.id as version_id,
    version.version_number,
    link.expires_at as preview_expires_at,
    article.created_at,
    article.updated_at,
    article.draft_version
  from public.wk_article_preview_links link
  join editorial.article_versions version
    on version.id = link.version_id
  join public.wk_articles article
    on article.id = link.article_id
  where link.nonce = p_nonce
    and link.revoked_at is null
    and link.expires_at > now()
  limit 1;
$$;

revoke all on function public.create_article_preview_link(
  uuid,
  uuid,
  timestamptz
)
from public;

grant execute on function public.create_article_preview_link(
  uuid,
  uuid,
  timestamptz
)
to authenticated, service_role;

revoke all on function public.resolve_article_preview_nonce(text)
from public;

grant execute on function public.resolve_article_preview_nonce(text)
to anon, authenticated, service_role;

comment on table public.wk_article_preview_links is
  'Version bound article preview links. Each nonce resolves to one immutable article version.';

comment on function public.create_article_preview_link(
  uuid,
  uuid,
  timestamptz
) is
  'Creates a preview nonce for an immutable article version.';

comment on function public.resolve_article_preview_nonce(text) is
  'Resolves a preview nonce to immutable article version content.';
