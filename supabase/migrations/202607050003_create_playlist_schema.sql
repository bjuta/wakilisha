create table if not exists public.wk_playlists (
  id uuid primary key default gen_random_uuid(),

  title text not null,
  slug text not null unique,
  description text,
  curator_label text,

  status text not null default 'draft' check (
    status in (
      'draft',
      'in_progress',
      'submitted_for_review',
      'approved',
      'rejected',
      'published',
      'archived'
    )
  ),

  cover_image_url text,
  canonical_url text,

  source_inquiry_id uuid references public.institute_inquiries(id) on delete set null,
  source_work_product_link_id uuid references public.institute_work_product_links(id) on delete set null,

  metadata jsonb not null default '{}'::jsonb,

  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wk_playlist_items (
  id uuid primary key default gen_random_uuid(),

  playlist_id uuid not null references public.wk_playlists(id) on delete cascade,
  position integer not null check (position > 0),

  registry_track_id uuid references public.registry_tracks(id) on delete set null,
  registry_release_id uuid references public.registry_releases(id) on delete set null,

  provider_key text check (
    provider_key is null
    or (
      provider_key = lower(provider_key)
      and provider_key ~ '^[a-z0-9_]+$'
    )
  ),
  provider_track_id text,
  provider_url text,

  title text,
  artist_names text[] not null default '{}'::text[],
  release_title text,
  artwork_url text,
  preview_url text,
  duration_ms integer check (duration_ms is null or duration_ms > 0),
  isrc text,

  match_status text not null default 'pending' check (
    match_status in (
      'matched',
      'external_only',
      'missing_registry_track',
      'needs_review',
      'rejected',
      'pending'
    )
  ),
  match_confidence numeric(5,4) check (
    match_confidence is null
    or (match_confidence >= 0 and match_confidence <= 1)
  ),

  normalization_payload jsonb not null default '{}'::jsonb,
  notes text,

  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (playlist_id, position)
);

create index if not exists wk_playlists_status_idx
  on public.wk_playlists(status);

create index if not exists wk_playlists_source_inquiry_idx
  on public.wk_playlists(source_inquiry_id);

create index if not exists wk_playlist_items_playlist_position_idx
  on public.wk_playlist_items(playlist_id, position);

create index if not exists wk_playlist_items_registry_track_idx
  on public.wk_playlist_items(registry_track_id)
  where registry_track_id is not null;

create index if not exists wk_playlist_items_provider_idx
  on public.wk_playlist_items(provider_key, provider_track_id)
  where provider_key is not null and provider_track_id is not null;

create index if not exists wk_playlist_items_isrc_idx
  on public.wk_playlist_items(isrc)
  where isrc is not null;

drop trigger if exists wk_playlists_set_updated_at on public.wk_playlists;
create trigger wk_playlists_set_updated_at
before update on public.wk_playlists
for each row execute function public.institute_set_updated_at();

drop trigger if exists wk_playlist_items_set_updated_at on public.wk_playlist_items;
create trigger wk_playlist_items_set_updated_at
before update on public.wk_playlist_items
for each row execute function public.institute_set_updated_at();

alter table public.wk_playlists enable row level security;
alter table public.wk_playlist_items enable row level security;

drop policy if exists wk_playlists_public_published_read on public.wk_playlists;
create policy wk_playlists_public_published_read
on public.wk_playlists
for select
to anon, authenticated
using (status = 'published');

drop policy if exists wk_playlists_institute_read on public.wk_playlists;
create policy wk_playlists_institute_read
on public.wk_playlists
for select
to authenticated
using (
  public.current_user_is_administrator()
  or public.current_user_has_capability('institute_read')
  or public.current_user_has_capability('institute_write')
  or public.current_user_has_capability('institute_review')
);

drop policy if exists wk_playlists_institute_insert on public.wk_playlists;
create policy wk_playlists_institute_insert
on public.wk_playlists
for insert
to authenticated
with check (
  public.current_user_is_administrator()
  or public.current_user_has_capability('institute_write')
);

drop policy if exists wk_playlists_institute_update on public.wk_playlists;
create policy wk_playlists_institute_update
on public.wk_playlists
for update
to authenticated
using (
  public.current_user_is_administrator()
  or public.current_user_has_capability('institute_write')
  or public.current_user_has_capability('institute_review')
)
with check (
  public.current_user_is_administrator()
  or public.current_user_has_capability('institute_write')
  or public.current_user_has_capability('institute_review')
);

drop policy if exists wk_playlists_institute_delete on public.wk_playlists;
create policy wk_playlists_institute_delete
on public.wk_playlists
for delete
to authenticated
using (
  public.current_user_is_administrator()
  or public.current_user_has_capability('institute_admin')
);

drop policy if exists wk_playlist_items_public_published_read on public.wk_playlist_items;
create policy wk_playlist_items_public_published_read
on public.wk_playlist_items
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.wk_playlists p
    where p.id = wk_playlist_items.playlist_id
      and p.status = 'published'
  )
);

drop policy if exists wk_playlist_items_institute_read on public.wk_playlist_items;
create policy wk_playlist_items_institute_read
on public.wk_playlist_items
for select
to authenticated
using (
  public.current_user_is_administrator()
  or public.current_user_has_capability('institute_read')
  or public.current_user_has_capability('institute_write')
  or public.current_user_has_capability('institute_review')
);

drop policy if exists wk_playlist_items_institute_insert on public.wk_playlist_items;
create policy wk_playlist_items_institute_insert
on public.wk_playlist_items
for insert
to authenticated
with check (
  public.current_user_is_administrator()
  or public.current_user_has_capability('institute_write')
);

drop policy if exists wk_playlist_items_institute_update on public.wk_playlist_items;
create policy wk_playlist_items_institute_update
on public.wk_playlist_items
for update
to authenticated
using (
  public.current_user_is_administrator()
  or public.current_user_has_capability('institute_write')
  or public.current_user_has_capability('institute_review')
)
with check (
  public.current_user_is_administrator()
  or public.current_user_has_capability('institute_write')
  or public.current_user_has_capability('institute_review')
);

drop policy if exists wk_playlist_items_institute_delete on public.wk_playlist_items;
create policy wk_playlist_items_institute_delete
on public.wk_playlist_items
for delete
to authenticated
using (
  public.current_user_is_administrator()
  or public.current_user_has_capability('institute_admin')
);

grant select on public.wk_playlists to anon, authenticated;
grant insert, update, delete on public.wk_playlists to authenticated;

grant select on public.wk_playlist_items to anon, authenticated;
grant insert, update, delete on public.wk_playlist_items to authenticated;
