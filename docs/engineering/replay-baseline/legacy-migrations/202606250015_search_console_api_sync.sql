create table if not exists public.seo_search_console_sync_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending', 'running', 'succeeded', 'failed')),
  site_url text not null,
  start_date date not null,
  end_date date not null,
  dimensions text[] not null default array['query','page'],
  row_count integer not null default 0,
  total_clicks numeric not null default 0,
  total_impressions numeric not null default 0,
  average_ctr numeric not null default 0,
  average_position numeric not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_by uuid references auth.users(id)
);

create table if not exists public.seo_search_console_rows (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.seo_search_console_sync_runs(id) on delete cascade,
  site_url text not null,
  start_date date not null,
  end_date date not null,
  dimension_set text not null default 'query_page',
  query text,
  page_url text,
  country text,
  device text,
  date date,
  clicks numeric not null default 0,
  impressions numeric not null default 0,
  ctr numeric not null default 0,
  position numeric not null default 0,
  raw_row jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists seo_search_console_runs_started_at_idx
  on public.seo_search_console_sync_runs (started_at desc);

create index if not exists seo_search_console_rows_run_id_idx
  on public.seo_search_console_rows (run_id);

create index if not exists seo_search_console_rows_page_url_idx
  on public.seo_search_console_rows (page_url);

create index if not exists seo_search_console_rows_query_idx
  on public.seo_search_console_rows (query);

alter table public.seo_search_console_sync_runs enable row level security;
alter table public.seo_search_console_rows enable row level security;

drop policy if exists "Admins can read search console sync runs" on public.seo_search_console_sync_runs;
create policy "Admins can read search console sync runs"
on public.seo_search_console_sync_runs
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

drop policy if exists "Admins can read search console rows" on public.seo_search_console_rows;
create policy "Admins can read search console rows"
on public.seo_search_console_rows
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
