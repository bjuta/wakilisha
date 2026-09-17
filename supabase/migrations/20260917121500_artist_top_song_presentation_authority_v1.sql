-- MIZIZI Slice 3 Candidate D1: Artist Top Songs Presentation Authority V1
--
-- Separates editorial Top Songs presentation from evidence-backed Registry
-- relationship truth. Existing registry_entity_relationships are read for
-- lineage only and are never updated or deleted by this migration.

begin;
set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'mizizi-slice3-artist-top-song-presentation-authority-v1',
    0
  )
);

do $preflight$
begin
  if to_regclass('public.registry_artists') is null
     or to_regclass('public.registry_tracks') is null
     or to_regclass('public.registry_entity_relationships') is null
     or to_regclass('public.registry_track_artists') is null
     or to_regclass('public.registry_release_artists') is null
     or to_regclass('public.registry_release_tracks') is null
     or to_regprocedure('public.current_user_has_capability(text)') is null
  then
    raise exception 'STOP: Top Songs presentation authority foundation is missing';
  end if;

  if to_regclass('public.artist_top_song_curations') is not null
     or to_regclass('public.artist_top_song_curation_migration_map') is not null
     or to_regclass('public.artist_top_song_curation_events') is not null
     or to_regprocedure('public.get_artist_top_songs_v1(uuid,text)') is not null
     or to_regprocedure('public.admin_replace_artist_top_songs_v1(uuid,uuid[],text)') is not null
     or to_regprocedure('platform_private.artist_top_song_fingerprint_v1(uuid)') is not null
  then
    raise exception 'STOP: Artist Top Songs Presentation Authority V1 already exists';
  end if;
end
$preflight$;

create table public.artist_top_song_curations (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.registry_artists(id) on delete cascade,
  track_id uuid not null references public.registry_tracks(id) on delete restrict,
  sort_order integer not null check (sort_order between 0 and 19),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (artist_id, track_id),
  unique (artist_id, sort_order)
);

comment on table public.artist_top_song_curations is
  'Editorial Artist Top Songs presentation order. This is presentation authority, not evidence-backed Registry relationship truth.';

create table public.artist_top_song_curation_migration_map (
  source_relationship_id uuid primary key,
  artist_id uuid not null references public.registry_artists(id) on delete cascade,
  resolved_track_id uuid references public.registry_tracks(id) on delete restrict,
  legacy_source_slug text not null,
  legacy_target_slug text not null,
  legacy_sort_order integer,
  resolution_status text not null check (resolution_status in ('resolved','needs_review')),
  resolution_reason text not null check (
    resolution_reason in ('canonical_id','unique_active_slug','no_active_track_match','ambiguous_active_track_slug')
  ),
  candidate_track_ids uuid[] not null default '{}'::uuid[],
  captured_at timestamptz not null default now()
);

comment on table public.artist_top_song_curation_migration_map is
  'Immutable lineage map from historical popular_track/top_song relationships into presentation authority, including unresolved identity exceptions.';

create table public.artist_top_song_curation_events (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.registry_artists(id) on delete cascade,
  actor_id uuid,
  event_kind text not null check (event_kind in ('migration_backfill','replace_exact_set')),
  before_track_ids uuid[] not null default '{}'::uuid[],
  after_track_ids uuid[] not null default '{}'::uuid[],
  expected_fingerprint text,
  resulting_fingerprint text not null,
  created_at timestamptz not null default now()
);

comment on table public.artist_top_song_curation_events is
  'Append-only editorial Top Songs write receipt stream.';

create index artist_top_song_curations_artist_order_idx
  on public.artist_top_song_curations (artist_id, sort_order);
create index artist_top_song_migration_map_artist_idx
  on public.artist_top_song_curation_migration_map (artist_id, resolution_status, legacy_sort_order);
create index artist_top_song_events_artist_created_idx
  on public.artist_top_song_curation_events (artist_id, created_at desc);

alter table public.artist_top_song_curations enable row level security;
alter table public.artist_top_song_curation_migration_map enable row level security;
alter table public.artist_top_song_curation_events enable row level security;

revoke all on table public.artist_top_song_curations from public, anon, authenticated;
revoke all on table public.artist_top_song_curation_migration_map from public, anon, authenticated;
revoke all on table public.artist_top_song_curation_events from public, anon, authenticated;

create temporary table wk_top_song_d1_backfill on commit drop as
with legacy as (
  select
    r.id as source_relationship_id,
    r.source_entity_id,
    r.target_entity_id,
    r.source_slug,
    r.target_slug,
    coalesce(r.sort_order, 0) as sort_order
  from public.registry_entity_relationships r
  where r.source_entity_type = 'artist'
    and r.target_entity_type = 'track'
    and r.relationship_type = 'popular_track'
    and r.relationship_role = 'top_song'
    and r.relationship_status = 'active'
), resolved as (
  select
    legacy.*,
    coalesce(
      active_artist_by_id.id,
      case when artist_slug_match.match_count = 1 then artist_slug_match.artist_id end
    ) as artist_id,
    coalesce(
      active_track_by_id.id,
      case when track_slug_match.match_count = 1 then track_slug_match.track_id end
    ) as resolved_track_id,
    case
      when active_track_by_id.id is not null then 'canonical_id'
      when track_slug_match.match_count = 1 then 'unique_active_slug'
      when track_slug_match.match_count = 0 then 'no_active_track_match'
      else 'ambiguous_active_track_slug'
    end as resolution_reason,
    coalesce(track_slug_match.candidate_track_ids, '{}'::uuid[]) as candidate_track_ids
  from legacy
  left join public.registry_artists active_artist_by_id
    on active_artist_by_id.id = legacy.source_entity_id
   and active_artist_by_id.status = 'active'
  left join lateral (
    select
      count(*)::integer as match_count,
      min(artist.id::text)::uuid as artist_id
    from public.registry_artists artist
    where artist.slug = legacy.source_slug
      and artist.status = 'active'
  ) artist_slug_match on true
  left join public.registry_tracks active_track_by_id
    on active_track_by_id.id = legacy.target_entity_id
   and active_track_by_id.status = 'active'
  left join lateral (
    select
      count(*)::integer as match_count,
      min(track.id::text)::uuid as track_id,
      coalesce(array_agg(track.id order by track.id), '{}'::uuid[]) as candidate_track_ids
    from public.registry_tracks track
    where track.slug = legacy.target_slug
      and track.status = 'active'
  ) track_slug_match on true
)
select
  source_relationship_id,
  artist_id,
  resolved_track_id,
  source_slug,
  target_slug,
  sort_order,
  resolution_reason,
  candidate_track_ids
from resolved;

do $backfill_preflight$
begin
  if exists (
    select 1
    from wk_top_song_d1_backfill
    where artist_id is null
  ) then
    raise exception 'STOP: a legacy Top Songs relationship cannot resolve to exactly one active Artist';
  end if;

  if exists (
    select 1
    from wk_top_song_d1_backfill
    group by artist_id, sort_order
    having count(*) > 1
  ) then
    raise exception 'STOP: duplicate Artist Top Songs sort positions exist';
  end if;

  if exists (
    select 1
    from wk_top_song_d1_backfill
    where resolved_track_id is not null
    group by artist_id, resolved_track_id
    having count(*) > 1
  ) then
    raise exception 'STOP: duplicate resolved Track selections exist for an Artist';
  end if;
end
$backfill_preflight$;

insert into public.artist_top_song_curation_migration_map (
  source_relationship_id,
  artist_id,
  resolved_track_id,
  legacy_source_slug,
  legacy_target_slug,
  legacy_sort_order,
  resolution_status,
  resolution_reason,
  candidate_track_ids
)
select
  source_relationship_id,
  artist_id,
  resolved_track_id,
  source_slug,
  target_slug,
  sort_order,
  case when resolved_track_id is null then 'needs_review' else 'resolved' end,
  resolution_reason,
  candidate_track_ids
from wk_top_song_d1_backfill;

insert into public.artist_top_song_curations (
  artist_id,
  track_id,
  sort_order
)
select
  artist_id,
  resolved_track_id,
  sort_order
from wk_top_song_d1_backfill
where resolved_track_id is not null
order by artist_id, sort_order;

create function platform_private.artist_top_song_fingerprint_v1(
  p_artist_id uuid
)
returns text
language sql
stable
security definer
set search_path = pg_catalog, public, platform_private
as $$
  select md5(
    coalesce((
      select string_agg(
        c.track_id::text || ':' || c.sort_order::text,
        '|' order by c.sort_order, c.track_id
      )
      from public.artist_top_song_curations c
      where c.artist_id = p_artist_id
    ), '')
    || '#'
    || coalesce((
      select string_agg(
        m.source_relationship_id::text || ':' || m.resolution_reason,
        '|' order by m.legacy_sort_order, m.source_relationship_id
      )
      from public.artist_top_song_curation_migration_map m
      where m.artist_id = p_artist_id
        and m.resolution_status = 'needs_review'
    ), '')
  );
$$;

revoke all on function platform_private.artist_top_song_fingerprint_v1(uuid)
  from public, anon, authenticated, service_role;

insert into public.artist_top_song_curation_events (
  artist_id,
  actor_id,
  event_kind,
  before_track_ids,
  after_track_ids,
  expected_fingerprint,
  resulting_fingerprint
)
select
  artist.id,
  null,
  'migration_backfill',
  '{}'::uuid[],
  coalesce(array_agg(c.track_id order by c.sort_order) filter (where c.track_id is not null), '{}'::uuid[]),
  null,
  platform_private.artist_top_song_fingerprint_v1(artist.id)
from (
  select distinct artist_id as id
  from public.artist_top_song_curation_migration_map
) artist
left join public.artist_top_song_curations c
  on c.artist_id = artist.id
group by artist.id;

create function public.get_artist_top_songs_v1(
  p_artist_id uuid default null,
  p_artist_slug text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, platform_private
as $$
declare
  v_artist public.registry_artists%rowtype;
begin
  if auth.role() <> 'service_role'
     and (
       auth.uid() is null
       or not (
         coalesce(public.current_user_has_capability('manage_registry'), false)
         or public.current_user_is_administrator()
       )
     )
  then
    raise exception using errcode='42501', message='manage_registry is required.';
  end if;

  if p_artist_id is null and nullif(btrim(coalesce(p_artist_slug,'')), '') is null then
    raise exception using errcode='22023', message='Artist id or slug is required.';
  end if;

  select artist.*
  into v_artist
  from public.registry_artists artist
  where artist.status = 'active'
    and (
      (p_artist_id is not null and artist.id = p_artist_id)
      or (
        p_artist_id is null
        and artist.slug = btrim(p_artist_slug)
      )
    )
  order by case when artist.id = p_artist_id then 0 else 1 end
  limit 1;

  if not found then
    raise exception using errcode='P0002', message='Registry Artist not found.';
  end if;

  return jsonb_build_object(
    'artistId', v_artist.id,
    'artistSlug', v_artist.slug,
    'fingerprint', platform_private.artist_top_song_fingerprint_v1(v_artist.id),
    'tracks', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'trackId', track.id,
          'trackSlug', track.slug,
          'title', track.title,
          'durationMs', track.duration_ms,
          'artworkUrl', track.artwork_url,
          'previewUrl', track.preview_url,
          'sortOrder', c.sort_order,
          'primaryArtistSlug', coalesce((
            select credit.artist_slug
            from public.registry_track_artists credit
            where credit.track_id = track.id
              and credit.status = 'active'
            order by credit.is_primary desc, credit.credit_order asc, credit.id asc
            limit 1
          ), v_artist.slug),
          'artistNames', coalesce((
            select case
              when max(names.name) filter (where names.is_primary) is not null then
                max(names.name) filter (where names.is_primary)
                || case
                  when count(*) filter (where not names.is_primary) > 0 then
                    ' (feat. '
                    || string_agg(names.name, ', ' order by names.credit_order)
                       filter (where not names.is_primary)
                    || ')'
                  else ''
                end
              else string_agg(names.name, ', ' order by names.credit_order)
            end
            from (
              select
                coalesce(
                  nullif(btrim(credit.artist_name_text), ''),
                  linked_artist.display_name,
                  credit.artist_slug
                ) as name,
                credit.is_primary,
                credit.credit_order
              from public.registry_track_artists credit
              left join public.registry_artists linked_artist
                on linked_artist.id = credit.artist_id
              where credit.track_id = track.id
                and credit.status = 'active'
              order by credit.credit_order, credit.id
            ) names
          ), '')
        )
        order by c.sort_order, c.track_id
      )
      from public.artist_top_song_curations c
      join public.registry_tracks track
        on track.id = c.track_id
       and track.status = 'active'
      where c.artist_id = v_artist.id
    ), '[]'::jsonb),
    'unresolvedLegacy', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'relationshipId', m.source_relationship_id,
          'targetSlug', m.legacy_target_slug,
          'sortOrder', m.legacy_sort_order,
          'reason', m.resolution_reason,
          'candidateTrackIds', to_jsonb(m.candidate_track_ids)
        )
        order by m.legacy_sort_order, m.source_relationship_id
      )
      from public.artist_top_song_curation_migration_map m
      where m.artist_id = v_artist.id
        and m.resolution_status = 'needs_review'
    ), '[]'::jsonb)
  );
end
$$;

revoke all on function public.get_artist_top_songs_v1(uuid,text)
  from public, anon;
grant execute on function public.get_artist_top_songs_v1(uuid,text)
  to authenticated, service_role;

create function public.admin_replace_artist_top_songs_v1(
  p_artist_id uuid,
  p_track_ids uuid[],
  p_expected_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, platform_private
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_fingerprint text;
  v_before_ids uuid[] := '{}'::uuid[];
  v_input_count integer;
  v_distinct_count integer;
begin
  if v_user_id is null
     or not (
       coalesce(public.current_user_has_capability('manage_registry'), false)
       or public.current_user_is_administrator()
     )
  then
    raise exception using errcode='42501', message='manage_registry is required.';
  end if;

  if p_artist_id is null
     or p_track_ids is null
     or nullif(btrim(coalesce(p_expected_fingerprint,'')), '') is null
  then
    raise exception using errcode='22023',
      message='Artist id, exact Track set, and expected fingerprint are required.';
  end if;

  perform 1
  from public.registry_artists artist
  where artist.id = p_artist_id
    and artist.status = 'active'
  for update;

  if not found then
    raise exception using errcode='P0002', message='Registry Artist not found.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('artist-top-songs:' || p_artist_id::text, 0)
  );

  select coalesce(array_agg(c.track_id order by c.sort_order), '{}'::uuid[])
  into v_before_ids
  from public.artist_top_song_curations c
  where c.artist_id = p_artist_id;

  v_current_fingerprint := platform_private.artist_top_song_fingerprint_v1(p_artist_id);
  if v_current_fingerprint is distinct from p_expected_fingerprint then
    raise exception using errcode='40001',
      message='Artist Top Songs changed after this editor loaded them.';
  end if;

  v_input_count := coalesce(cardinality(p_track_ids), 0);
  select count(distinct item)
  into v_distinct_count
  from unnest(p_track_ids) item;

  if v_input_count > 20 then
    raise exception using errcode='22023', message='An Artist can have at most 20 Top Songs.';
  end if;

  if v_distinct_count <> v_input_count then
    raise exception using errcode='22023', message='Top Songs cannot contain the same Track twice.';
  end if;

  if exists (
    select 1
    from unnest(p_track_ids) requested(track_id)
    left join public.registry_tracks track
      on track.id = requested.track_id
     and track.status = 'active'
    where track.id is null
  ) then
    raise exception using errcode='22023', message='Every Top Song must be an active canonical Registry Track.';
  end if;

  if exists (
    select 1
    from unnest(p_track_ids) requested(track_id)
    where not (requested.track_id = any(v_before_ids))
      and not exists (
        select 1
        from public.registry_track_artists credit
        where credit.track_id = requested.track_id
          and credit.artist_id = p_artist_id
          and credit.status = 'active'
      )
      and not exists (
        select 1
        from public.registry_release_tracks release_track
        join public.registry_release_artists release_artist
          on release_artist.release_id = release_track.release_id
         and release_artist.status = 'active'
        where release_track.track_id = requested.track_id
          and release_track.status = 'active'
          and release_artist.artist_id = p_artist_id
      )
  ) then
    raise exception using errcode='22023',
      message='New Top Songs must belong to the Artist through active Track credit or active Release discography.';
  end if;

  delete from public.artist_top_song_curations
  where artist_id = p_artist_id;

  insert into public.artist_top_song_curations (
    artist_id,
    track_id,
    sort_order,
    created_by,
    updated_by
  )
  select
    p_artist_id,
    requested.track_id,
    requested.ordinality::integer - 1,
    v_user_id,
    v_user_id
  from unnest(p_track_ids) with ordinality requested(track_id, ordinality)
  order by requested.ordinality;

  insert into public.artist_top_song_curation_events (
    artist_id,
    actor_id,
    event_kind,
    before_track_ids,
    after_track_ids,
    expected_fingerprint,
    resulting_fingerprint
  ) values (
    p_artist_id,
    v_user_id,
    'replace_exact_set',
    v_before_ids,
    p_track_ids,
    p_expected_fingerprint,
    platform_private.artist_top_song_fingerprint_v1(p_artist_id)
  );

  return public.get_artist_top_songs_v1(p_artist_id, null);
end
$$;

revoke all on function public.admin_replace_artist_top_songs_v1(uuid,uuid[],text)
  from public, anon, service_role;
grant execute on function public.admin_replace_artist_top_songs_v1(uuid,uuid[],text)
  to authenticated;

comment on function public.get_artist_top_songs_v1(uuid,text) is
  'Caller-aware read authority for editorial Artist Top Songs presentation. Service-role public gateways may read; authenticated callers require Registry management authority.';

comment on function public.admin_replace_artist_top_songs_v1(uuid,uuid[],text) is
  'Caller-bound manage_registry exact-set writer for editorial Artist Top Songs presentation with stale-state fingerprint protection and append-only receipts.';

commit;
