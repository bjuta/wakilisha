-- WAKILISHA Music Work Resolution
-- Read-only provider evidence readiness audit.
--
-- This report does not call provider APIs, create Works, create Track→Work
-- links, mutate provider links, or promote any provider field into canonical
-- Registry authority.

begin transaction read only;

-- Report A: catalogue-wide provider identity and Work-link coverage.
with active_tracks as (
  select
    t.id,
    nullif(btrim(t.isrc), '') as isrc,
    nullif(
      btrim(coalesce(t.metadata->>'apple_music_track_id', '')),
      ''
    ) as apple_music_track_id
  from public.registry_tracks t
  where t.status <> 'archived'
),
apple_assignment_counts as (
  select
    apple_music_track_id,
    count(*)::integer as assignment_count
  from active_tracks
  where apple_music_track_id is not null
  group by apple_music_track_id
),
current_work_links as (
  select
    l.track_id,
    count(*)::integer as current_work_link_count
  from public.registry_track_work_links l
  join public.registry_works w
    on w.id = l.work_id
   and w.status <> 'archived'
  where l.status not in ('superseded', 'rejected')
    and (l.valid_to is null or l.valid_to > now())
  group by l.track_id
),
typed_provider_links as (
  select
    l.track_id,
    l.provider_key,
    count(*)::integer as link_count
  from public.registry_track_provider_links l
  where coalesce(l.match_status, '') not in ('rejected', 'superseded')
  group by l.track_id, l.provider_key
),
retained_composer_evidence as (
  select distinct
    nullif(
      btrim(p.raw_payload#>>'{data,0,id}'),
      ''
    ) as apple_music_track_id,
    nullif(
      btrim(p.raw_payload#>>'{data,0,attributes,composerName}'),
      ''
    ) as composer_name
  from public.provider_field_observations p
  where p.provider = 'apple_music'
),
retained_composer_counts as (
  select
    apple_music_track_id,
    count(distinct composer_name)::integer as composer_string_count
  from retained_composer_evidence
  where apple_music_track_id is not null
    and composer_name is not null
  group by apple_music_track_id
)
select
  (select count(*) from active_tracks) as active_track_count,
  (
    select count(*)
    from active_tracks
    where isrc is not null
  ) as tracks_with_isrc,
  (
    select count(*)
    from active_tracks
    where apple_music_track_id is not null
  ) as tracks_with_legacy_apple_music_id,
  (
    select count(*)
    from active_tracks t
    join apple_assignment_counts a
      using (apple_music_track_id)
    where a.assignment_count = 1
  ) as tracks_with_unique_legacy_apple_music_id,
  (
    select count(*)
    from active_tracks t
    join apple_assignment_counts a
      using (apple_music_track_id)
    where a.assignment_count > 1
  ) as tracks_on_duplicated_legacy_apple_music_ids,
  (
    select count(*)
    from active_tracks t
    join current_work_links w
      on w.track_id = t.id
    where w.current_work_link_count > 0
  ) as tracks_with_current_work_link,
  (
    select count(*)
    from active_tracks t
    join retained_composer_counts c
      using (apple_music_track_id)
    where c.composer_string_count > 0
  ) as tracks_with_retained_composer_evidence,
  (
    select count(*)
    from typed_provider_links
    where provider_key = 'apple_music'
  ) as typed_apple_music_track_link_rows,
  (
    select count(*)
    from typed_provider_links
    where provider_key = 'spotify'
  ) as typed_spotify_track_link_rows;

-- Report B: per-Track external Work-resolution readiness.
with active_tracks as (
  select
    t.id as track_id,
    t.title as track_title,
    nullif(btrim(t.isrc), '') as isrc,
    nullif(
      btrim(coalesce(t.metadata->>'apple_music_track_id', '')),
      ''
    ) as apple_music_track_id
  from public.registry_tracks t
  where t.status <> 'archived'
),
apple_assignment_counts as (
  select
    apple_music_track_id,
    count(*)::integer as assignment_count
  from active_tracks
  where apple_music_track_id is not null
  group by apple_music_track_id
),
current_work_links as (
  select
    l.track_id,
    count(*)::integer as current_work_link_count
  from public.registry_track_work_links l
  join public.registry_works w
    on w.id = l.work_id
   and w.status <> 'archived'
  where l.status not in ('superseded', 'rejected')
    and (l.valid_to is null or l.valid_to > now())
  group by l.track_id
),
typed_provider_links as (
  select
    l.track_id,
    bool_or(l.provider_key = 'apple_music') as has_typed_apple_link,
    bool_or(l.provider_key = 'spotify') as has_typed_spotify_link
  from public.registry_track_provider_links l
  where coalesce(l.match_status, '') not in ('rejected', 'superseded')
  group by l.track_id
),
retained_composer_evidence as (
  select distinct
    nullif(
      btrim(p.raw_payload#>>'{data,0,id}'),
      ''
    ) as apple_music_track_id,
    nullif(
      btrim(p.raw_payload#>>'{data,0,attributes,composerName}'),
      ''
    ) as composer_name
  from public.provider_field_observations p
  where p.provider = 'apple_music'
),
retained_composer_counts as (
  select
    apple_music_track_id,
    count(distinct composer_name)::integer as composer_string_count
  from retained_composer_evidence
  where apple_music_track_id is not null
    and composer_name is not null
  group by apple_music_track_id
)
select
  t.track_id,
  t.track_title,
  t.isrc,
  t.apple_music_track_id,
  coalesce(a.assignment_count, 0) as apple_id_assignment_count,
  coalesce(w.current_work_link_count, 0) as current_work_link_count,
  coalesce(p.has_typed_apple_link, false) as has_typed_apple_link,
  coalesce(p.has_typed_spotify_link, false) as has_typed_spotify_link,
  coalesce(c.composer_string_count, 0) as retained_composer_string_count,
  (
    t.apple_music_track_id is not null
    and coalesce(a.assignment_count, 0) > 1
  ) as has_apple_id_collision,
  case
    when coalesce(w.current_work_link_count, 0) > 0
      then 'already_work_linked'
    when t.isrc is not null
     and coalesce(c.composer_string_count, 0) > 0
      then 'external_work_resolution_ready_with_retained_composer'
    when t.isrc is not null
      then 'external_work_resolution_ready_isrc'
    when t.apple_music_track_id is not null
     and coalesce(a.assignment_count, 0) > 1
      then 'provider_collision_review'
    when t.apple_music_track_id is not null
     and coalesce(a.assignment_count, 0) = 1
      then 'recording_identity_only_apple_policy_restricted'
    else 'insufficient_provider_identity'
  end as resolution_state,
  case
    when coalesce(w.current_work_link_count, 0) > 0
      then 'none'
    when t.isrc is not null
      then 'musicbrainz_isrc_then_mlc_or_acrcloud'
    when t.apple_music_track_id is not null
      then 'review_provider_identity_and_seek_non_apple_work_source'
    else 'creator_or_partner_evidence_required'
  end as preferred_next_evidence_path
from active_tracks t
left join apple_assignment_counts a
  using (apple_music_track_id)
left join current_work_links w
  on w.track_id = t.track_id
left join typed_provider_links p
  on p.track_id = t.track_id
left join retained_composer_counts c
  using (apple_music_track_id)
order by
  resolution_state,
  t.track_title,
  t.track_id;

-- Report C: summary of the readiness states above.
with active_tracks as (
  select
    t.id as track_id,
    nullif(btrim(t.isrc), '') as isrc,
    nullif(
      btrim(coalesce(t.metadata->>'apple_music_track_id', '')),
      ''
    ) as apple_music_track_id
  from public.registry_tracks t
  where t.status <> 'archived'
),
apple_assignment_counts as (
  select
    apple_music_track_id,
    count(*)::integer as assignment_count
  from active_tracks
  where apple_music_track_id is not null
  group by apple_music_track_id
),
current_work_links as (
  select
    l.track_id,
    count(*)::integer as current_work_link_count
  from public.registry_track_work_links l
  join public.registry_works w
    on w.id = l.work_id
   and w.status <> 'archived'
  where l.status not in ('superseded', 'rejected')
    and (l.valid_to is null or l.valid_to > now())
  group by l.track_id
),
retained_composer_evidence as (
  select distinct
    nullif(
      btrim(p.raw_payload#>>'{data,0,id}'),
      ''
    ) as apple_music_track_id,
    nullif(
      btrim(p.raw_payload#>>'{data,0,attributes,composerName}'),
      ''
    ) as composer_name
  from public.provider_field_observations p
  where p.provider = 'apple_music'
),
retained_composer_counts as (
  select
    apple_music_track_id,
    count(distinct composer_name)::integer as composer_string_count
  from retained_composer_evidence
  where apple_music_track_id is not null
    and composer_name is not null
  group by apple_music_track_id
),
classified as (
  select
    case
      when coalesce(w.current_work_link_count, 0) > 0
        then 'already_work_linked'
      when t.apple_music_track_id is not null
       and coalesce(a.assignment_count, 0) > 1
        then 'provider_collision_review'
      when t.isrc is not null
       and coalesce(c.composer_string_count, 0) > 0
        then 'external_work_resolution_ready_with_retained_composer'
      when t.isrc is not null
        then 'external_work_resolution_ready_isrc'
      when t.apple_music_track_id is not null
       and coalesce(a.assignment_count, 0) = 1
        then 'recording_identity_only_apple_policy_restricted'
      else 'insufficient_provider_identity'
    end as resolution_state
  from active_tracks t
  left join apple_assignment_counts a
    using (apple_music_track_id)
  left join current_work_links w
    on w.track_id = t.track_id
  left join retained_composer_counts c
    using (apple_music_track_id)
)
select
  resolution_state,
  count(*)::integer as track_count
from classified
group by resolution_state
order by resolution_state;

rollback;
