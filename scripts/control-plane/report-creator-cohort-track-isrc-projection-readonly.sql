-- WAKILISHA creator cohort Track ISRC projection candidate report.
--
-- Read-only classification of retained typed Apple provider-link evidence.
-- No provider network calls. No Registry mutation.

begin transaction read only;

with apple as (
  select
    l.id as provider_link_id,
    l.track_id,
    l.provider_track_id,
    upper(nullif(btrim(l.isrc),'')) as candidate_isrc,
    upper(
      nullif(
        btrim(l.raw_payload#>>'{song,attributes,isrc}'),
        ''
      )
    ) as payload_isrc,
    nullif(
      btrim(
        l.raw_payload#>>'{song,attributes,composerName}'
      ),
      ''
    ) as composer_name,
    l.match_status,
    l.match_method,
    l.match_confidence,
    t.title as track_title,
    t.status as track_status,
    upper(nullif(btrim(t.isrc),'')) as registry_isrc
  from public.registry_track_provider_links l
  join public.registry_tracks t
    on t.id=l.track_id
  where l.provider_key='apple_music'
    and coalesce(l.match_status,'') not in (
      'rejected',
      'superseded'
    )
    and t.status<>'archived'
),
missing as (
  select *
  from apple
  where registry_isrc is null
    and candidate_isrc is not null
    and payload_isrc is not null
),
candidate_counts as (
  select
    candidate_isrc,
    count(distinct track_id)::integer
      as candidate_track_count
  from missing
  group by candidate_isrc
),
existing_registry as (
  select
    upper(nullif(btrim(t.isrc),'')) as registry_isrc,
    count(distinct t.id)::integer
      as registry_track_count
  from public.registry_tracks t
  where t.status<>'archived'
    and nullif(btrim(t.isrc),'') is not null
  group by upper(nullif(btrim(t.isrc),''))
),
classified as (
  select
    m.*,
    c.candidate_track_count,
    coalesce(
      e.registry_track_count,
      0
    ) as existing_registry_track_count,
    case
      when m.candidate_isrc<>m.payload_isrc
        then 'review_provider_payload_conflict'
      when m.match_status='matched'
       and m.match_method='exact_title_artist'
       and coalesce(m.match_confidence,0)>=0.93
       and c.candidate_track_count=1
       and coalesce(e.registry_track_count,0)=0
        then 'deterministic_projection_candidate'
      when c.candidate_track_count>1
        then 'review_duplicate_candidate_isrc'
      when coalesce(e.registry_track_count,0)>0
        then 'review_existing_registry_isrc'
      else 'review_provider_match'
    end as candidate_state
  from missing m
  join candidate_counts c
    using (candidate_isrc)
  left join existing_registry e
    on e.registry_isrc=m.candidate_isrc
)
select
  provider_link_id,
  track_id,
  track_title,
  provider_track_id,
  candidate_isrc,
  composer_name,
  match_status,
  match_method,
  match_confidence,
  candidate_track_count,
  existing_registry_track_count,
  candidate_state
from classified
order by
  candidate_state,
  track_title,
  track_id;

rollback;
