-- Curated genre source of truth

create extension if not exists pgcrypto;

-- Artist genres are editorial identity.
-- Release and track genres are classification evidence, usually provider/imported data.

create table if not exists public.registry_genre_aliases (
  id uuid primary key default gen_random_uuid(),
  raw_label text not null,
  normalized_key text not null,
  genre_id uuid null references public.registry_genres(id) on delete set null,
  status text not null default 'active',
  source text not null default 'editorial',
  notes text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists registry_genre_aliases_normalized_key_uidx
  on public.registry_genre_aliases (normalized_key)
  where status = 'active';

create index if not exists registry_genre_aliases_genre_id_idx
  on public.registry_genre_aliases (genre_id);

create table if not exists public.registry_artist_genres (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.registry_artists(id) on delete cascade,
  genre_id uuid not null references public.registry_genres(id) on delete restrict,
  raw_genre_name text null,
  genre_role text not null default 'secondary',
  sort_order integer not null default 100,
  status text not null default 'active',
  source text not null default 'editorial',
  source_context text null,
  confidence numeric(5,4) not null default 1.0,
  editorial_note text null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists registry_artist_genres_artist_genre_active_uidx
  on public.registry_artist_genres (artist_id, genre_id)
  where status = 'active';

create index if not exists registry_artist_genres_artist_id_idx
  on public.registry_artist_genres (artist_id);

create index if not exists registry_artist_genres_artist_sort_idx
  on public.registry_artist_genres (artist_id, sort_order);

create index if not exists registry_artist_genres_genre_id_idx
  on public.registry_artist_genres (genre_id);

create table if not exists public.registry_release_genres (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.registry_releases(id) on delete cascade,
  genre_id uuid null references public.registry_genres(id) on delete set null,
  raw_genre_name text not null,
  normalized_key text not null,
  provider text null,
  source text not null default 'provider',
  source_context text null,
  is_primary boolean not null default false,
  sort_order integer not null default 100,
  classification_status text not null default 'provider_claimed',
  confidence numeric(5,4) null,
  editorial_note text null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists registry_release_genres_release_key_provider_uidx
  on public.registry_release_genres (release_id, normalized_key, coalesce(provider, ''), source)
  where classification_status <> 'archived';

create index if not exists registry_release_genres_release_id_idx
  on public.registry_release_genres (release_id);

create index if not exists registry_release_genres_genre_id_idx
  on public.registry_release_genres (genre_id);

create index if not exists registry_release_genres_status_idx
  on public.registry_release_genres (classification_status);

create table if not exists public.registry_track_genres (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.registry_tracks(id) on delete cascade,
  genre_id uuid null references public.registry_genres(id) on delete set null,
  raw_genre_name text not null,
  normalized_key text not null,
  provider text null,
  source text not null default 'provider',
  source_context text null,
  is_primary boolean not null default false,
  sort_order integer not null default 100,
  classification_status text not null default 'provider_claimed',
  confidence numeric(5,4) null,
  editorial_note text null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists registry_track_genres_track_key_provider_uidx
  on public.registry_track_genres (track_id, normalized_key, coalesce(provider, ''), source)
  where classification_status <> 'archived';

create index if not exists registry_track_genres_track_id_idx
  on public.registry_track_genres (track_id);

create index if not exists registry_track_genres_genre_id_idx
  on public.registry_track_genres (genre_id);

create index if not exists registry_track_genres_status_idx
  on public.registry_track_genres (classification_status);


alter table public.registry_genre_aliases
  add constraint registry_genre_aliases_status_chk
  check (status in ('active', 'inactive', 'archived', 'needs_review')) not valid;

alter table public.registry_genre_aliases
  validate constraint registry_genre_aliases_status_chk;

alter table public.registry_artist_genres
  add constraint registry_artist_genres_status_chk
  check (status in ('active', 'inactive', 'archived', 'needs_review')) not valid;

alter table public.registry_artist_genres
  validate constraint registry_artist_genres_status_chk;

alter table public.registry_artist_genres
  add constraint registry_artist_genres_role_chk
  check (genre_role in ('primary', 'secondary', 'influence', 'legacy')) not valid;

alter table public.registry_artist_genres
  validate constraint registry_artist_genres_role_chk;

alter table public.registry_artist_genres
  add constraint registry_artist_genres_confidence_chk
  check (confidence >= 0 and confidence <= 1) not valid;

alter table public.registry_artist_genres
  validate constraint registry_artist_genres_confidence_chk;

alter table public.registry_release_genres
  add constraint registry_release_genres_status_chk
  check (classification_status in ('provider_claimed', 'editorially_verified', 'editorially_rejected', 'suspected_misclassified', 'archived', 'needs_review')) not valid;

alter table public.registry_release_genres
  validate constraint registry_release_genres_status_chk;

alter table public.registry_release_genres
  add constraint registry_release_genres_confidence_chk
  check (confidence is null or (confidence >= 0 and confidence <= 1)) not valid;

alter table public.registry_release_genres
  validate constraint registry_release_genres_confidence_chk;

alter table public.registry_track_genres
  add constraint registry_track_genres_status_chk
  check (classification_status in ('provider_claimed', 'editorially_verified', 'editorially_rejected', 'suspected_misclassified', 'archived', 'needs_review')) not valid;

alter table public.registry_track_genres
  validate constraint registry_track_genres_status_chk;

alter table public.registry_track_genres
  add constraint registry_track_genres_confidence_chk
  check (confidence is null or (confidence >= 0 and confidence <= 1)) not valid;

alter table public.registry_track_genres
  validate constraint registry_track_genres_confidence_chk;

alter table public.registry_genre_aliases enable row level security;
alter table public.registry_artist_genres enable row level security;
alter table public.registry_release_genres enable row level security;
alter table public.registry_track_genres enable row level security;

drop policy if exists "registry_genre_aliases_service_all" on public.registry_genre_aliases;
create policy "registry_genre_aliases_service_all"
  on public.registry_genre_aliases
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "registry_artist_genres_service_all" on public.registry_artist_genres;
create policy "registry_artist_genres_service_all"
  on public.registry_artist_genres
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "registry_release_genres_service_all" on public.registry_release_genres;
create policy "registry_release_genres_service_all"
  on public.registry_release_genres
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "registry_track_genres_service_all" on public.registry_track_genres;
create policy "registry_track_genres_service_all"
  on public.registry_track_genres
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Public read access is intentionally not granted here.
-- Public APIs should expose curated genre data through Edge Functions, not direct table reads.
