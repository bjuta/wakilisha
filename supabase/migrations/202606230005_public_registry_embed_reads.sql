-- Public magazine articles render registry embeds from the browser.
-- Grant only the non-sensitive fields needed by article artist/track embeds.

grant usage on schema public to anon, authenticated;

-- Artist embeds and artist metadata lookup.
grant select (
  slug,
  display_name,
  public_image_url,
  metadata,
  chart_entry_count,
  top_chart_position,
  status
) on table public.registry_artists to anon, authenticated;

drop policy if exists registry_artists_public_embed_read on public.registry_artists;

create policy registry_artists_public_embed_read
on public.registry_artists
for select
to anon, authenticated
using (status = 'active');

-- Track embeds.
grant select (
  id,
  slug,
  title,
  duration_ms,
  preview_url,
  artwork_url,
  metadata,
  release_id,
  status
) on table public.registry_tracks to anon, authenticated;

drop policy if exists registry_tracks_public_embed_read on public.registry_tracks;

create policy registry_tracks_public_embed_read
on public.registry_tracks
for select
to anon, authenticated
using (status = 'active');

-- Track → artist join rows used by embedded tracks.
grant select (
  track_id,
  artist_name_text,
  artist_slug,
  is_primary,
  status
) on table public.registry_track_artists to anon, authenticated;

drop policy if exists registry_track_artists_public_embed_read on public.registry_track_artists;

create policy registry_track_artists_public_embed_read
on public.registry_track_artists
for select
to anon, authenticated
using (status = 'active');

-- Release metadata used only to show label text in embedded tracks.
grant select (
  id,
  metadata,
  status
) on table public.registry_releases to anon, authenticated;

drop policy if exists registry_releases_public_embed_read on public.registry_releases;

create policy registry_releases_public_embed_read
on public.registry_releases
for select
to anon, authenticated
using (status = 'active');
