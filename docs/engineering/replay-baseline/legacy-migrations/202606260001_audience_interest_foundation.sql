-- PR 182: Audience Interest Foundation
-- Normalized subscriber interests for commercial-grade targeting:
-- e.g. confirmed subscribers who opted into artist-signals AND follow artist v-be.

create table if not exists public.audience_interests (
  id uuid primary key default gen_random_uuid(),

  subscriber_id uuid not null references public.briefing_subscribers(id) on delete cascade,

  entity_type text not null check (
    entity_type in (
      'artist',
      'track',
      'release',
      'guide',
      'chart',
      'genre',
      'label',
      'article',
      'briefing'
    )
  ),
  entity_slug text not null,
  entity_name text,
  entity_id uuid,

  interest_kind text not null default 'follow' check (
    interest_kind in (
      'follow',
      'subscribe',
      'download',
      'save',
      'click',
      'read',
      'manual'
    )
  ),

  source_form text not null default 'unknown',
  source_page text,
  source_context jsonb not null default '{}'::jsonb,

  interest_strength integer not null default 1 check (interest_strength between 1 and 100),

  status text not null default 'active' check (
    status in ('active', 'suppressed', 'unsubscribed')
  ),

  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists audience_interests_unique_subscriber_entity
  on public.audience_interests (subscriber_id, entity_type, entity_slug);

create index if not exists audience_interests_entity_status_idx
  on public.audience_interests (entity_type, entity_slug, status);

create index if not exists audience_interests_subscriber_status_idx
  on public.audience_interests (subscriber_id, status);

create index if not exists audience_interests_source_form_idx
  on public.audience_interests (source_form, status);

create index if not exists audience_interests_last_seen_idx
  on public.audience_interests (last_seen_at desc);

alter table public.audience_interests enable row level security;

drop policy if exists "Admins can read audience interests" on public.audience_interests;
create policy "Admins can read audience interests"
  on public.audience_interests
  for select
  to authenticated
  using (public.is_current_user_administrator());

drop policy if exists "Admins can insert audience interests" on public.audience_interests;
create policy "Admins can insert audience interests"
  on public.audience_interests
  for insert
  to authenticated
  with check (public.is_current_user_administrator());

drop policy if exists "Admins can update audience interests" on public.audience_interests;
create policy "Admins can update audience interests"
  on public.audience_interests
  for update
  to authenticated
  using (public.is_current_user_administrator())
  with check (public.is_current_user_administrator());

drop policy if exists "Admins can delete audience interests" on public.audience_interests;
create policy "Admins can delete audience interests"
  on public.audience_interests
  for delete
  to authenticated
  using (public.is_current_user_administrator());

grant select, insert, update, delete on public.audience_interests to authenticated;

comment on table public.audience_interests is
  'Normalized audience interests attached to briefing subscribers. Used for fan/artist/topic segmentation without scraping raw form JSON.';

comment on column public.audience_interests.entity_type is
  'Audience entity type: artist, track, release, guide, chart, genre, label, article, or briefing.';

comment on column public.audience_interests.entity_slug is
  'Stable public slug for targeting, e.g. v-be for /artists/v-be.';

comment on column public.audience_interests.interest_strength is
  '1 to 100 score. Future forms can score stronger actions like follow/download higher than passive clicks.';
