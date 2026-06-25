create table if not exists public.seo_content_overrides (
  id uuid primary key default gen_random_uuid(),
  target_url text not null,
  title text,
  description text,
  social_title text,
  social_description text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'archived')),
  source_draft_id uuid references public.seo_growth_drafts(id) on delete set null,
  task_id uuid references public.seo_growth_tasks(id) on delete set null,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  applied_at timestamptz not null default now(),
  archived_at timestamptz
);

create unique index if not exists seo_content_overrides_active_target_idx
  on public.seo_content_overrides (target_url)
  where status = 'active';

create index if not exists seo_content_overrides_status_idx
  on public.seo_content_overrides (status);

create index if not exists seo_content_overrides_source_draft_idx
  on public.seo_content_overrides (source_draft_id);

create table if not exists public.seo_draft_publish_events (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid references public.seo_growth_drafts(id) on delete set null,
  task_id uuid references public.seo_growth_tasks(id) on delete set null,
  override_id uuid references public.seo_content_overrides(id) on delete set null,
  target_url text not null,
  event_type text not null check (event_type in ('applied', 'published', 'archived', 'reverted')),
  before_payload jsonb not null default '{}'::jsonb,
  after_payload jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists seo_draft_publish_events_draft_idx
  on public.seo_draft_publish_events (draft_id);

create index if not exists seo_draft_publish_events_target_idx
  on public.seo_draft_publish_events (target_url, created_at desc);

alter table public.seo_content_overrides enable row level security;
alter table public.seo_draft_publish_events enable row level security;

grant select, insert, update on public.seo_content_overrides to authenticated;
grant select, insert on public.seo_draft_publish_events to authenticated;

drop policy if exists "Admins can read SEO content overrides" on public.seo_content_overrides;
create policy "Admins can read SEO content overrides"
on public.seo_content_overrides
for select
to authenticated
using (public.is_current_user_administrator());

drop policy if exists "Admins can insert SEO content overrides" on public.seo_content_overrides;
create policy "Admins can insert SEO content overrides"
on public.seo_content_overrides
for insert
to authenticated
with check (public.is_current_user_administrator());

drop policy if exists "Admins can update SEO content overrides" on public.seo_content_overrides;
create policy "Admins can update SEO content overrides"
on public.seo_content_overrides
for update
to authenticated
using (public.is_current_user_administrator())
with check (public.is_current_user_administrator());

drop policy if exists "Admins can read SEO draft publish events" on public.seo_draft_publish_events;
create policy "Admins can read SEO draft publish events"
on public.seo_draft_publish_events
for select
to authenticated
using (public.is_current_user_administrator());

drop policy if exists "Admins can insert SEO draft publish events" on public.seo_draft_publish_events;
create policy "Admins can insert SEO draft publish events"
on public.seo_draft_publish_events
for insert
to authenticated
with check (public.is_current_user_administrator());
