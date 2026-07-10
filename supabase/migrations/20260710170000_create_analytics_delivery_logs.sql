create table if not exists public.analytics_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_name text not null,
  page_url text,
  page_path text,
  client_id text,
  delivery_target text not null default 'ga4_measurement_protocol',
  status_code integer,
  ok boolean not null default false,
  error_message text,
  request_id text
);

create index if not exists analytics_delivery_logs_created_at_idx
  on public.analytics_delivery_logs (created_at desc);

create index if not exists analytics_delivery_logs_delivery_target_created_at_idx
  on public.analytics_delivery_logs (delivery_target, created_at desc);

alter table public.analytics_delivery_logs enable row level security;
