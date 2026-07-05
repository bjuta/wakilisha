-- Phase 2: durable chart playback enrichment job tracking.
-- This migration adds stateful run/item tracking only.
-- It does not call providers, change runners, or alter chart scoring.

create table if not exists public.wk_chart_playback_enrichment_runs (
  id uuid primary key default gen_random_uuid(),
  source_run_id uuid null,
  chart_program_id uuid null,
  chart_edition_id uuid null,
  provider text not null default 'apple_music',
  storefront text not null default 'ke',
  status text not null default 'queued',
  write_mode boolean not null default false,
  min_auto_accept numeric(5,4) not null default 0.9000,
  requested_by uuid null,
  total_candidates integer not null default 0,
  processed_count integer not null default 0,
  matched_count integer not null default 0,
  accepted_count integer not null default 0,
  needs_review_count integer not null default 0,
  failed_count integer not null default 0,
  top_ten_coverage_count integer not null default 0,
  full_coverage_count integer not null default 0,
  started_at timestamptz null,
  finished_at timestamptz null,
  error_message text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint wk_chart_playback_enrichment_runs_status_check
    check (status in ('queued','running','completed','partial','failed','cancelled')),
  constraint wk_chart_playback_enrichment_runs_provider_check
    check (length(trim(provider)) > 0),
  constraint wk_chart_playback_enrichment_runs_storefront_check
    check (length(trim(storefront)) > 0),
  constraint wk_chart_playback_enrichment_runs_min_auto_accept_check
    check (min_auto_accept >= 0 and min_auto_accept <= 1),
  constraint wk_chart_playback_enrichment_runs_counts_check
    check (
      total_candidates >= 0
      and processed_count >= 0
      and matched_count >= 0
      and accepted_count >= 0
      and needs_review_count >= 0
      and failed_count >= 0
      and top_ten_coverage_count >= 0
      and full_coverage_count >= 0
    )
);

create table if not exists public.wk_chart_playback_enrichment_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.wk_chart_playback_enrichment_runs(id) on delete cascade,
  chart_entry_id uuid null,
  registry_track_id uuid null,
  rank integer null,
  track_title text not null,
  artist_name text null,
  isrc text null,
  provider text not null default 'apple_music',
  storefront text not null default 'ke',
  status text not null default 'queued',
  match_method text null,
  confidence numeric(5,4) null,
  auto_accept boolean not null default false,
  provider_track_id text null,
  provider_url text null,
  preview_url text null,
  artwork_url text null,
  error_message text null,
  raw_match_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint wk_chart_playback_enrichment_items_status_check
    check (status in ('queued','running','matched','accepted','needs_review','not_found','failed','skipped')),
  constraint wk_chart_playback_enrichment_items_provider_check
    check (length(trim(provider)) > 0),
  constraint wk_chart_playback_enrichment_items_storefront_check
    check (length(trim(storefront)) > 0),
  constraint wk_chart_playback_enrichment_items_confidence_check
    check (confidence is null or (confidence >= 0 and confidence <= 1))
);

create index if not exists wk_chart_playback_enrichment_runs_source_run_id_idx
  on public.wk_chart_playback_enrichment_runs(source_run_id);

create index if not exists wk_chart_playback_enrichment_runs_status_created_at_idx
  on public.wk_chart_playback_enrichment_runs(status, created_at desc);

create index if not exists wk_chart_playback_enrichment_runs_provider_storefront_idx
  on public.wk_chart_playback_enrichment_runs(provider, storefront);

create index if not exists wk_chart_playback_enrichment_items_run_id_idx
  on public.wk_chart_playback_enrichment_items(run_id);

create index if not exists wk_chart_playback_enrichment_items_run_id_status_idx
  on public.wk_chart_playback_enrichment_items(run_id, status);

create index if not exists wk_chart_playback_enrichment_items_chart_entry_id_idx
  on public.wk_chart_playback_enrichment_items(chart_entry_id);

create index if not exists wk_chart_playback_enrichment_items_provider_track_idx
  on public.wk_chart_playback_enrichment_items(provider, provider_track_id);

create index if not exists wk_chart_playback_enrichment_items_registry_track_id_idx
  on public.wk_chart_playback_enrichment_items(registry_track_id);

create unique index if not exists wk_chart_playback_enrichment_items_run_chart_entry_uidx
  on public.wk_chart_playback_enrichment_items(run_id, chart_entry_id)
  where chart_entry_id is not null;

create unique index if not exists wk_chart_playback_enrichment_items_run_registry_track_uidx
  on public.wk_chart_playback_enrichment_items(run_id, registry_track_id)
  where registry_track_id is not null;

create or replace function public.wk_touch_chart_playback_enrichment_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists wk_chart_playback_enrichment_runs_touch_updated_at
  on public.wk_chart_playback_enrichment_runs;

create trigger wk_chart_playback_enrichment_runs_touch_updated_at
before update on public.wk_chart_playback_enrichment_runs
for each row
execute function public.wk_touch_chart_playback_enrichment_updated_at();

drop trigger if exists wk_chart_playback_enrichment_items_touch_updated_at
  on public.wk_chart_playback_enrichment_items;

create trigger wk_chart_playback_enrichment_items_touch_updated_at
before update on public.wk_chart_playback_enrichment_items
for each row
execute function public.wk_touch_chart_playback_enrichment_updated_at();

alter table public.wk_chart_playback_enrichment_runs enable row level security;
alter table public.wk_chart_playback_enrichment_items enable row level security;

grant select, insert, update, delete on public.wk_chart_playback_enrichment_runs to authenticated;
grant select, insert, update, delete on public.wk_chart_playback_enrichment_items to authenticated;

drop policy if exists wk_chart_playback_enrichment_runs_admin_read
  on public.wk_chart_playback_enrichment_runs;

create policy wk_chart_playback_enrichment_runs_admin_read
on public.wk_chart_playback_enrichment_runs
for select
to authenticated
using (
  public.current_user_is_administrator()
  or public.current_user_has_capability('view_charts_admin')
  or public.current_user_has_capability('manage_charts')
);

drop policy if exists wk_chart_playback_enrichment_runs_admin_write
  on public.wk_chart_playback_enrichment_runs;

create policy wk_chart_playback_enrichment_runs_admin_write
on public.wk_chart_playback_enrichment_runs
for all
to authenticated
using (
  public.current_user_is_administrator()
  or public.current_user_has_capability('manage_charts')
)
with check (
  public.current_user_is_administrator()
  or public.current_user_has_capability('manage_charts')
);

drop policy if exists wk_chart_playback_enrichment_items_admin_read
  on public.wk_chart_playback_enrichment_items;

create policy wk_chart_playback_enrichment_items_admin_read
on public.wk_chart_playback_enrichment_items
for select
to authenticated
using (
  public.current_user_is_administrator()
  or public.current_user_has_capability('view_charts_admin')
  or public.current_user_has_capability('manage_charts')
);

drop policy if exists wk_chart_playback_enrichment_items_admin_write
  on public.wk_chart_playback_enrichment_items;

create policy wk_chart_playback_enrichment_items_admin_write
on public.wk_chart_playback_enrichment_items
for all
to authenticated
using (
  public.current_user_is_administrator()
  or public.current_user_has_capability('manage_charts')
)
with check (
  public.current_user_is_administrator()
  or public.current_user_has_capability('manage_charts')
);
