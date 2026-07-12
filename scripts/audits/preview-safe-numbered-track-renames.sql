with numbered_tracks as (
  select
    t.id,
    t.title,
    t.slug as current_slug,
    regexp_replace(
      t.slug,
      '-[0-9]+$',
      ''
    ) as proposed_slug,
    trim(
      both '-'
      from regexp_replace(
        lower(t.normalized_title),
        '[^a-z0-9]+',
        '-',
        'g'
      )
    ) as title_slug,
    array_remove(
      array_agg(
        distinct ta.artist_slug
      ) filter (
        where ta.artist_slug is not null
          and ta.artist_slug <> ''
      ),
      null
    ) as artist_slugs
  from public.registry_tracks t
  left join public.registry_track_artists ta
    on ta.track_id = t.id
   and ta.status in (
     'active',
     'needs_review',
     'draft'
   )
   and coalesce(
     ta.is_primary,
     false
   ) = true
  where t.slug ~ '-[0-9]+$'
  group by
    t.id,
    t.title,
    t.slug,
    t.normalized_title
),
classified as (
  select
    nt.*,
    exists (
      select 1
      from public.registry_tracks t2
      join public.registry_track_artists ta2
        on ta2.track_id = t2.id
       and ta2.status in (
         'active',
         'needs_review',
         'draft'
       )
       and coalesce(
         ta2.is_primary,
         false
       ) = true
      where t2.id <> nt.id
        and t2.slug = nt.proposed_slug
        and ta2.artist_slug = any(
          nt.artist_slugs
        )
    ) as same_artist_collision,
    exists (
      select 1
      from public.wk_slug_redirects red
      where red.entity_type = 'track'
        and red.old_slug = nt.current_slug
    ) as already_redirected
  from numbered_tracks nt
),
initial_candidates as (
  select *
  from classified
  where cardinality(artist_slugs) > 0
    and current_slug <> title_slug
    and proposed_slug = title_slug
    and same_artist_collision = false
    and already_redirected = false
),
candidate_paths as (
  select
    ic.*,
    '/tracks/'
      || ic.artist_slugs[1]
      || '/'
      || ic.current_slug
      as old_path,
    '/tracks/'
      || ic.artist_slugs[1]
      || '/'
      || ic.proposed_slug
      as new_path
  from initial_candidates ic
),
ranked_candidates as (
  select
    cp.*,
    count(*) over (
      partition by cp.new_path
    ) as proposed_path_candidate_count
  from candidate_paths cp
),
safe_candidates as (
  select *
  from ranked_candidates
  where proposed_path_candidate_count = 1
)
select
  id as track_id,
  title,
  artist_slugs,
  current_slug,
  proposed_slug,
  old_path,
  new_path,
  same_artist_collision,
  already_redirected,
  proposed_path_candidate_count
from safe_candidates
order by
  artist_slugs[1],
  proposed_slug,
  id;
