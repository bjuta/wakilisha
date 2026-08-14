create table if not exists public.seo_growth_tasks (
  id uuid primary key default gen_random_uuid(),
  target_url text not null,
  query text,
  action text not null,
  reason text,
  priority text not null default 'Watch' check (priority in ('High', 'Medium', 'Watch')),
  score integer not null default 0,
  metrics text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'done', 'ignored')),
  source text not null default 'search_console_growth_queue',
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (target_url, query, action)
);

create table if not exists public.seo_growth_drafts (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.seo_growth_tasks(id) on delete set null,
  target_url text not null,
  query text,
  action text not null,
  content_kind text not null check (content_kind in ('seo_meta', 'page_copy', 'supporting_article', 'internal_links', 'refresh_checklist')),
  title text not null,
  summary text,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  generated_by uuid references auth.users(id),
  published_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  unique (target_url, query, action, content_kind)
);

create table if not exists public.seo_artist_trend_signals (
  id uuid primary key default gen_random_uuid(),
  artist_slug text not null,
  artist_name text not null,
  artist_url text not null,
  source_run_id uuid references public.seo_search_console_sync_runs(id) on delete set null,
  window_start date not null,
  window_end date not null,
  clicks integer not null default 0,
  impressions integer not null default 0,
  ctr numeric not null default 0,
  average_position numeric not null default 0,
  trend_score integer not null default 0,
  top_queries text[] not null default '{}',
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'candidate' check (status in ('candidate', 'approved', 'rejected', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (artist_slug, window_start, window_end)
);

create index if not exists seo_growth_tasks_status_idx
  on public.seo_growth_tasks (status);

create index if not exists seo_growth_tasks_priority_idx
  on public.seo_growth_tasks (priority);

create index if not exists seo_growth_tasks_created_at_idx
  on public.seo_growth_tasks (created_at desc);

create index if not exists seo_growth_drafts_status_idx
  on public.seo_growth_drafts (status);

create index if not exists seo_growth_drafts_task_id_idx
  on public.seo_growth_drafts (task_id);

create index if not exists seo_artist_trend_signals_score_idx
  on public.seo_artist_trend_signals (trend_score desc);

create index if not exists seo_artist_trend_signals_window_idx
  on public.seo_artist_trend_signals (window_start desc, window_end desc);

alter table public.seo_growth_tasks enable row level security;
alter table public.seo_growth_drafts enable row level security;
alter table public.seo_artist_trend_signals enable row level security;

drop policy if exists "Admins can read SEO growth tasks" on public.seo_growth_tasks;
create policy "Admins can read SEO growth tasks"
on public.seo_growth_tasks
for select
to authenticated
using (
  exists (
    select 1
    from public.user_role_assignments ura
    where ura.user_id = auth.uid()
      and ura.status = 'active'
      and ura.role_key = 'administrator'
      and (ura.expires_at is null or ura.expires_at > now())
  )
);

drop policy if exists "Admins can insert SEO growth tasks" on public.seo_growth_tasks;
create policy "Admins can insert SEO growth tasks"
on public.seo_growth_tasks
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_role_assignments ura
    where ura.user_id = auth.uid()
      and ura.status = 'active'
      and ura.role_key = 'administrator'
      and (ura.expires_at is null or ura.expires_at > now())
  )
);

drop policy if exists "Admins can update SEO growth tasks" on public.seo_growth_tasks;
create policy "Admins can update SEO growth tasks"
on public.seo_growth_tasks
for update
to authenticated
using (
  exists (
    select 1
    from public.user_role_assignments ura
    where ura.user_id = auth.uid()
      and ura.status = 'active'
      and ura.role_key = 'administrator'
      and (ura.expires_at is null or ura.expires_at > now())
  )
)
with check (
  exists (
    select 1
    from public.user_role_assignments ura
    where ura.user_id = auth.uid()
      and ura.status = 'active'
      and ura.role_key = 'administrator'
      and (ura.expires_at is null or ura.expires_at > now())
  )
);

drop policy if exists "Admins can read SEO growth drafts" on public.seo_growth_drafts;
create policy "Admins can read SEO growth drafts"
on public.seo_growth_drafts
for select
to authenticated
using (
  exists (
    select 1
    from public.user_role_assignments ura
    where ura.user_id = auth.uid()
      and ura.status = 'active'
      and ura.role_key = 'administrator'
      and (ura.expires_at is null or ura.expires_at > now())
  )
);

drop policy if exists "Admins can insert SEO growth drafts" on public.seo_growth_drafts;
create policy "Admins can insert SEO growth drafts"
on public.seo_growth_drafts
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_role_assignments ura
    where ura.user_id = auth.uid()
      and ura.status = 'active'
      and ura.role_key = 'administrator'
      and (ura.expires_at is null or ura.expires_at > now())
  )
);

drop policy if exists "Admins can update SEO growth drafts" on public.seo_growth_drafts;
create policy "Admins can update SEO growth drafts"
on public.seo_growth_drafts
for update
to authenticated
using (
  exists (
    select 1
    from public.user_role_assignments ura
    where ura.user_id = auth.uid()
      and ura.status = 'active'
      and ura.role_key = 'administrator'
      and (ura.expires_at is null or ura.expires_at > now())
  )
)
with check (
  exists (
    select 1
    from public.user_role_assignments ura
    where ura.user_id = auth.uid()
      and ura.status = 'active'
      and ura.role_key = 'administrator'
      and (ura.expires_at is null or ura.expires_at > now())
  )
);

drop policy if exists "Admins can read SEO artist trend signals" on public.seo_artist_trend_signals;
create policy "Admins can read SEO artist trend signals"
on public.seo_artist_trend_signals
for select
to authenticated
using (
  exists (
    select 1
    from public.user_role_assignments ura
    where ura.user_id = auth.uid()
      and ura.status = 'active'
      and ura.role_key = 'administrator'
      and (ura.expires_at is null or ura.expires_at > now())
  )
);

drop policy if exists "Admins can insert SEO artist trend signals" on public.seo_artist_trend_signals;
create policy "Admins can insert SEO artist trend signals"
on public.seo_artist_trend_signals
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_role_assignments ura
    where ura.user_id = auth.uid()
      and ura.status = 'active'
      and ura.role_key = 'administrator'
      and (ura.expires_at is null or ura.expires_at > now())
  )
);

drop policy if exists "Admins can update SEO artist trend signals" on public.seo_artist_trend_signals;
create policy "Admins can update SEO artist trend signals"
on public.seo_artist_trend_signals
for update
to authenticated
using (
  exists (
    select 1
    from public.user_role_assignments ura
    where ura.user_id = auth.uid()
      and ura.status = 'active'
      and ura.role_key = 'administrator'
      and (ura.expires_at is null or ura.expires_at > now())
  )
)
with check (
  exists (
    select 1
    from public.user_role_assignments ura
    where ura.user_id = auth.uid()
      and ura.status = 'active'
      and ura.role_key = 'administrator'
      and (ura.expires_at is null or ura.expires_at > now())
  )
);
