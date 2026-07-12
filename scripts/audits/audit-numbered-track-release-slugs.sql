with numbered_tracks as (
  select
    t.id,
    t.title,
    t.slug as current_slug,
    regexp_replace(t.slug, '-[0-9]+$', '') as proposed_slug,
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
      array_agg(distinct ta.artist_slug)
        filter (
          where ta.artist_slug is not null
            and ta.artist_slug <> ''
        ),
      null
    ) as artist_slugs
  from public.registry_tracks t
  left join public.registry_track_artists ta
    on ta.track_id = t.id
   and ta.status in ('active', 'needs_review', 'draft')
   and coalesce(ta.is_primary, false) = true
  where t.slug ~ '-[0-9]+$'
  group by
    t.id,
    t.title,
    t.slug
),
track_candidates as (
  select
    'track'::text as entity_type,
    nt.id,
    nt.title,
    nt.current_slug,
    nt.proposed_slug,
    nt.title_slug,
    nt.artist_slugs,
    exists (
      select 1
      from public.registry_tracks t2
      join public.registry_track_artists ta2
        on ta2.track_id = t2.id
       and ta2.status in ('active', 'needs_review', 'draft')
       and coalesce(ta2.is_primary, false) = true
      where t2.id <> nt.id
        and t2.slug = nt.proposed_slug
        and ta2.artist_slug = any(nt.artist_slugs)
    ) as same_artist_collision,
    exists (
      select 1
      from public.wk_slug_redirects red
      where red.entity_type = 'track'
        and red.old_slug = nt.current_slug
    ) as already_redirected
  from numbered_tracks nt
),
numbered_releases as (
  select
    r.id,
    r.title,
    r.slug as current_slug,
    regexp_replace(r.slug, '-[0-9]+$', '') as proposed_slug,
    trim(
      both '-'
      from regexp_replace(
        lower(r.normalized_title),
        '[^a-z0-9]+',
        '-',
        'g'
      )
    ) as title_slug,
    array_remove(
      array_agg(distinct ra.artist_slug)
        filter (
          where ra.artist_slug is not null
            and ra.artist_slug <> ''
        ),
      null
    ) as artist_slugs
  from public.registry_releases r
  left join public.registry_release_artists ra
    on ra.release_id = r.id
   and ra.status = 'active'
   and coalesce(ra.is_primary, false) = true
  where r.slug ~ '-[0-9]+$'
  group by
    r.id,
    r.title,
    r.slug
),
release_candidates as (
  select
    'release'::text as entity_type,
    nr.id,
    nr.title,
    nr.current_slug,
    nr.proposed_slug,
    nr.title_slug,
    nr.artist_slugs,
    exists (
      select 1
      from public.registry_releases r2
      join public.registry_release_artists ra2
        on ra2.release_id = r2.id
       and ra2.status = 'active'
       and coalesce(ra2.is_primary, false) = true
      where r2.id <> nr.id
        and r2.slug = nr.proposed_slug
        and ra2.artist_slug = any(nr.artist_slugs)
    ) as same_artist_collision,
    exists (
      select 1
      from public.wk_slug_redirects red
      where red.entity_type = 'release'
        and red.old_slug = nr.current_slug
    ) as already_redirected
  from numbered_releases nr
),
all_candidates as (
  select * from track_candidates
  union all
  select * from release_candidates
)
select
  entity_type,
  id,
  title,
  current_slug,
  proposed_slug,
  artist_slugs,
  case
    when cardinality(artist_slugs) = 0
      then 'missing_primary_artist'
    when current_slug = title_slug
      then 'legitimate_numeric_title_slug'
    when proposed_slug <> title_slug
      then case
        when same_artist_collision
          then 'title_slug_mismatch_with_collision'
        else 'title_slug_mismatch_needs_review'
      end
    when same_artist_collision
      then 'suffix_artifact_with_collision'
    when already_redirected
      then 'suffix_artifact_already_redirected'
    else 'safe_suffix_artifact'
  end as classification,
  same_artist_collision,
  already_redirected
from all_candidates
order by
  entity_type,
  classification,
  artist_slugs,
  current_slug;
