-- Artist-scoped music slugs
-- Public URLs are /tracks/:artistSlug/:trackSlug and /releases/:artistSlug/:releaseSlug.
-- So the same title slug must be allowed across different artists.

begin;

alter table public.registry_tracks
  drop constraint if exists registry_tracks_slug_key;

alter table public.registry_releases
  drop constraint if exists registry_releases_slug_key;

drop index if exists public.registry_releases_title_key;

create index if not exists registry_tracks_slug_idx
  on public.registry_tracks (slug);

create index if not exists registry_releases_slug_idx
  on public.registry_releases (slug);

create index if not exists registry_releases_title_idx
  on public.registry_releases (title);

create index if not exists registry_track_artists_artist_slug_track_id_idx
  on public.registry_track_artists (artist_slug, track_id)
  where status in ('active', 'needs_review', 'draft');

create index if not exists registry_release_artists_artist_slug_release_id_idx
  on public.registry_release_artists (artist_slug, release_id)
  where status = 'active';

commit;
