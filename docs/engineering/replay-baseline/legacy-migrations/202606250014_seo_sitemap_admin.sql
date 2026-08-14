create table if not exists public.seo_sitemap_snapshots (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'generated'
    check (status in ('generated', 'published', 'failed')),
  source text not null default 'internal'
    check (source in ('internal', 'pro_sitemaps', 'mixed')),
  base_url text not null,
  url_count integer not null default 0,
  xml_content text not null,
  xml_sha256 text,
  pro_sitemaps_site_id text,
  pro_sitemaps_result_json jsonb not null default '{}'::jsonb,
  error_message text,
  generated_by uuid default auth.uid(),
  generated_at timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists seo_sitemap_snapshots_generated_at_idx
  on public.seo_sitemap_snapshots(generated_at desc);

create table if not exists public.seo_sitemap_url_items (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.seo_sitemap_snapshots(id) on delete cascade,
  loc text not null,
  lastmod timestamptz,
  url_type text not null,
  source_table text,
  source_id text,
  priority_hint numeric,
  included boolean not null default true,
  exclusion_reason text,
  created_at timestamptz not null default now()
);

create index if not exists seo_sitemap_url_items_snapshot_idx
  on public.seo_sitemap_url_items(snapshot_id);

alter table public.seo_sitemap_snapshots enable row level security;
alter table public.seo_sitemap_url_items enable row level security;

drop policy if exists "admins can read sitemap snapshots" on public.seo_sitemap_snapshots;
create policy "admins can read sitemap snapshots"
on public.seo_sitemap_snapshots
for select
to authenticated
using (public.current_user_has_capability('manage_settings'));

drop policy if exists "admins can read sitemap items" on public.seo_sitemap_url_items;
create policy "admins can read sitemap items"
on public.seo_sitemap_url_items
for select
to authenticated
using (public.current_user_has_capability('manage_settings'));
