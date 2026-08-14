-- Repair one known Apple Music duplicate shell:
-- canonical: keki-willy-paul
-- duplicate: keki-willy-paul-2
--
-- Do not merge same-title tracks globally. "keki" by Fena Gitu/Bensoul is a different track.
-- This only repairs the Willy Paul/Bahati Apple Music duplicate.

with canonical as (
  select id, slug
  from public.registry_tracks
  where slug = 'keki-willy-paul'
  limit 1
),
duplicate as (
  select id, slug
  from public.registry_tracks
  where slug = 'keki-willy-paul-2'
  limit 1
),
repaired_chart_entries as (
  update public.wk_chart_entries_v2 ce
  set
    canonical_track_id = c.id::text,
    track_slug = c.slug
  from canonical c, duplicate d
  where (
      ce.canonical_track_id::text = d.id::text
      or ce.track_slug = d.slug
    )
    and ce.track_title = 'Keki'
    and coalesce(ce.artist_slug, '') = 'willy-paul'
  returning ce.id
),
repaired_provider_links as (
  update public.registry_track_provider_links l
  set
    track_id = c.id,
    updated_at = now()
  from canonical c, duplicate d
  where l.track_id = d.id
    and l.provider_key = 'apple_music'
    and l.provider_track_id = '1792819752'
  returning l.track_id
)
update public.registry_tracks dt
set
  metadata = coalesce(dt.metadata, '{}'::jsonb) || jsonb_build_object(
    'superseded_by_track_id', (select id::text from canonical),
    'superseded_by_slug', (select slug from canonical),
    'dedupe_note', 'Duplicate Apple Music shell repaired by 202606260001_repair_keki_apple_music_duplicate.sql',
    'deduped_at', now()::text
  ),
  updated_at = now()
from duplicate d
where dt.id = d.id;
