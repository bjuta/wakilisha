-- Chart Source Soak V3
-- Supabase-hosted public-source accessibility preflight.
--
-- Credential-free source contract:
--   1. Apple
--   2. YouTube
--   3. Mdundo
--   4. Audiomack
--   5. Boomplay
--   6. Shazam
--   7. Spotify UGC Kenya panel (20 frozen public embed playlists)
--
-- Spotify API credentials, Spotify login sessions, and authenticated
-- Spotify Charts endpoints are intentionally excluded from Attempt 3.
--
-- This migration intentionally DOES NOT schedule cron jobs.
-- The seven-day Attempt 3 clock must not begin until one manual
-- preflight enqueue/collect cycle has been accepted.

create table private.chart_source_soak_v3_runs (
  run_id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('preflight','soak')),
  source_contract_version text not null
    default 'v3-supabase-20260905-credential-free-7src',
  scheduled_for_utc timestamptz,
  enqueued_at_utc timestamptz not null default clock_timestamp(),
  last_collect_attempt_at_utc timestamptz,
  completed_at_utc timestamptz,
  status text not null default 'pending'
    check (status in ('pending','partial','complete')),
  expected_source_count integer not null default 7
    check (expected_source_count = 7)
);

create table private.chart_source_soak_v3_requests (
  run_id uuid not null
    references private.chart_source_soak_v3_runs(run_id)
    on delete restrict,
  source text not null
    check (
      source in (
        'apple',
        'youtube',
        'mdundo',
        'audiomack',
        'boomplay',
        'shazam'
      )
    ),
  request_id bigint not null unique,
  method text not null
    check (method in ('GET','POST')),
  source_url text not null,
  request_headers jsonb not null default '{}'::jsonb,
  request_body jsonb,
  enqueued_at_utc timestamptz not null default clock_timestamp(),
  primary key (run_id, source)
);

create table private.chart_source_soak_v3_observations (
  run_id uuid not null
    references private.chart_source_soak_v3_runs(run_id)
    on delete restrict,
  source text not null
    check (
      source in (
        'apple',
        'youtube',
        'mdundo',
        'audiomack',
        'boomplay',
        'shazam'
      )
    ),
  request_id bigint not null unique,
  method text not null
    check (method in ('GET','POST')),
  source_url text not null,
  request_headers jsonb not null,
  request_body jsonb,
  status_code integer,
  content_type text,
  response_headers jsonb not null default '{}'::jsonb,
  timed_out boolean not null default false,
  error_msg text,
  response_body_text text,
  body_bytes bigint,
  body_sha256 text,
  response_created_at_utc timestamptz,
  sealed_at_utc timestamptz not null default clock_timestamp(),
  primary key (run_id, source),
  check (body_bytes is null or body_bytes >= 0),
  check (
    body_sha256 is null
    or body_sha256 ~ '^[0-9a-f]{64}$'
  )
);

create table private.chart_source_soak_v3_spotify_ugc_panel (
  panel_order integer primary key,
  playlist_id text not null unique,
  owner_label text not null,
  active boolean not null default true,
  selected_at_utc timestamptz not null
    default '2026-09-05 16:45:00+00'::timestamptz,
  check (playlist_id ~ '^[A-Za-z0-9]{22}$')
);

insert into private.chart_source_soak_v3_spotify_ugc_panel (
  panel_order,
  playlist_id,
  owner_label
)
values
  (1,  '3I4rXWzBCaHD55SNmJ0sCa', 'GandaChartsRadar'),
  (2,  '24oMBOqiZvwRCeHhV4kwbD', 'Kenyan Muziki'),
  (3,  '32WnrNF4wAd0L7hKju0L6J', 'Tee''s Promos'),
  (4,  '5YfT0ckQ9dZ3waOJJ5wxZh', 'inlisted'),
  (5,  '3Dqz2LlDsBoftaKGchdv5E', 'Kinges'),
  (6,  '57pcccH9xNkb00cZeCPasG', 'Redlist - Vibey Songs'),
  (7,  '0D8CUtatfyGZ0HZONPgsIK', 'djfeeshy'),
  (8,  '5rce6cZMpMmhuaPxQrxpCC', 'Ngoma Charts'),
  (9,  '0Vx15JLmQpkcIUEofR9QPh', 'UGA CHARTS Radar'),
  (10, '54jXUJnmmMi2aBJZx2Ejmj', 'Eugene Gitonga'),
  (11, '4pqThSSsvIhH3UFSwDsNuu', 'pete'),
  (12, '3Tz3Wkw0zOMA606zodX0XF', 'CulturalReads'),
  (13, '2ZXvyPMLt7AZrGmCsEcLET', 'Blacknation'),
  (14, '0hnjDMIQwslzxJTPbo3HZm', 'P'),
  (15, '784MfdpL8HofhzcYnBzopW', 'Modern Hits'),
  (16, '4p7Ai3DNyfXLqYSS92geUD', 'ELLAN HK'),
  (17, '3UqOPcAIltZWFztL9wbqNR', 'Fredrickmuruga'),
  (18, '10BPAzO98u0yvjzDCannhX', 'Afrikan Radar'),
  (19, '5hPER9wSmkCXf3hbneWJbj', 'Waves Ke'),
  (20, '753WyE2mX61WUx9PsouRot', 'Glative');

create table private.chart_source_soak_v3_spotify_ugc_requests (
  run_id uuid not null
    references private.chart_source_soak_v3_runs(run_id)
    on delete restrict,
  playlist_id text not null
    references private.chart_source_soak_v3_spotify_ugc_panel(playlist_id)
    on delete restrict,
  request_id bigint not null unique,
  source_url text not null,
  request_headers jsonb not null default '{}'::jsonb,
  enqueued_at_utc timestamptz not null default clock_timestamp(),
  primary key (run_id, playlist_id)
);

create table private.chart_source_soak_v3_spotify_ugc_observations (
  run_id uuid not null
    references private.chart_source_soak_v3_runs(run_id)
    on delete restrict,
  playlist_id text not null
    references private.chart_source_soak_v3_spotify_ugc_panel(playlist_id)
    on delete restrict,
  request_id bigint not null unique,
  source_url text not null,
  request_headers jsonb not null,
  status_code integer,
  content_type text,
  response_headers jsonb not null default '{}'::jsonb,
  timed_out boolean not null default false,
  error_msg text,
  response_body_text text,
  body_bytes bigint,
  body_sha256 text,
  has_next_data boolean not null default false,
  parse_ok boolean not null default false,
  track_count integer,
  track_ids jsonb,
  response_created_at_utc timestamptz,
  sealed_at_utc timestamptz not null default clock_timestamp(),
  primary key (run_id, playlist_id),
  check (body_bytes is null or body_bytes >= 0),
  check (
    body_sha256 is null
    or body_sha256 ~ '^[0-9a-f]{64}$'
  ),
  check (track_count is null or track_count >= 0),
  check (
    track_ids is null
    or jsonb_typeof(track_ids) = 'array'
  )
);

revoke all
on table private.chart_source_soak_v3_runs
from public, anon, authenticated;

revoke all
on table private.chart_source_soak_v3_requests
from public, anon, authenticated;

revoke all
on table private.chart_source_soak_v3_observations
from public, anon, authenticated;

revoke all
on table private.chart_source_soak_v3_spotify_ugc_panel
from public, anon, authenticated;

revoke all
on table private.chart_source_soak_v3_spotify_ugc_requests
from public, anon, authenticated;

revoke all
on table private.chart_source_soak_v3_spotify_ugc_observations
from public, anon, authenticated;

create or replace function private.chart_source_soak_v3_enqueue(
  p_mode text default 'preflight',
  p_scheduled_for_utc timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, private, net
as $$
declare
  v_run_id uuid := gen_random_uuid();
  v_request_id bigint;
  v_panel record;

  v_common_headers jsonb := jsonb_build_object(
    'User-Agent',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/150 Safari/537.36',
    'Accept',
    '*/*'
  );

  v_youtube_headers jsonb := jsonb_build_object(
    'User-Agent',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/150 Safari/537.36',
    'Accept',
    'application/json',
    'Content-Type',
    'application/json'
  );

  v_youtube_body jsonb := jsonb_build_object(
    'browseId',
    'FEmusic_analytics_charts_home',
    'context',
    jsonb_build_object(
      'capabilities',
      '{}'::jsonb,
      'client',
      jsonb_build_object(
        'clientName',
        'WEB_MUSIC_ANALYTICS',
        'clientVersion',
        '0.2',
        'experimentIds',
        '[]'::jsonb,
        'experimentsToken',
        '',
        'gl',
        'US',
        'hl',
        'en',
        'theme',
        'MUSIC'
      ),
      'request',
      jsonb_build_object(
        'internalExperimentFlags',
        '[]'::jsonb
      )
    ),
    'query',
    'chart_params_type=WEEK&perspective=CHART&flags=viral_video_chart&selected_chart=TRACKS&chart_params_id=weekly:0:0:ke'
  );

  v_shazam_headers jsonb := jsonb_build_object(
    'User-Agent',
    'Dalvik/2.1.0 (Linux; U; Android 6.0.1; SM-G920F Build/MMB29K)',
    'X-Shazam-Platform',
    'IPHONE',
    'X-Shazam-AppVersion',
    '14.1.0',
    'Accept',
    '*/*',
    'Accept-Language',
    'en-US'
  );

  v_spotify_headers jsonb := jsonb_build_object(
    'User-Agent',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/150 Safari/537.36',
    'Accept',
    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  );

begin
  if p_mode not in ('preflight','soak') then
    raise exception
      'unsupported chart source soak mode: %',
      p_mode;
  end if;

  insert into private.chart_source_soak_v3_runs(
    run_id,
    mode,
    scheduled_for_utc
  )
  values (
    v_run_id,
    p_mode,
    p_scheduled_for_utc
  );

  v_request_id := net.http_get(
    url :=
      'https://rss.applemarketingtools.com/api/v2/ke/music/most-played/100/songs.json',
    params := '{}'::jsonb,
    headers := v_common_headers,
    timeout_milliseconds := 30000
  );

  insert into private.chart_source_soak_v3_requests(
    run_id,
    source,
    request_id,
    method,
    source_url,
    request_headers
  )
  values (
    v_run_id,
    'apple',
    v_request_id,
    'GET',
    'https://rss.applemarketingtools.com/api/v2/ke/music/most-played/100/songs.json',
    v_common_headers
  );

  v_request_id := net.http_post(
    url :=
      'https://charts.youtube.com/youtubei/v1/browse?alt=json',
    body := v_youtube_body,
    params := '{}'::jsonb,
    headers := v_youtube_headers,
    timeout_milliseconds := 30000
  );

  insert into private.chart_source_soak_v3_requests(
    run_id,
    source,
    request_id,
    method,
    source_url,
    request_headers,
    request_body
  )
  values (
    v_run_id,
    'youtube',
    v_request_id,
    'POST',
    'https://charts.youtube.com/youtubei/v1/browse?alt=json',
    v_youtube_headers,
    v_youtube_body
  );

  v_request_id := net.http_get(
    url := 'https://play.mdundo.com/top-charts/ke',
    params := '{}'::jsonb,
    headers := v_common_headers,
    timeout_milliseconds := 30000
  );

  insert into private.chart_source_soak_v3_requests(
    run_id,
    source,
    request_id,
    method,
    source_url,
    request_headers
  )
  values (
    v_run_id,
    'mdundo',
    v_request_id,
    'GET',
    'https://play.mdundo.com/top-charts/ke',
    v_common_headers
  );

  v_request_id := net.http_get(
    url := 'https://audiomack.com/geo-charts/playlist/kenya',
    params := '{}'::jsonb,
    headers := v_common_headers,
    timeout_milliseconds := 30000
  );

  insert into private.chart_source_soak_v3_requests(
    run_id,
    source,
    request_id,
    method,
    source_url,
    request_headers
  )
  values (
    v_run_id,
    'audiomack',
    v_request_id,
    'GET',
    'https://audiomack.com/geo-charts/playlist/kenya',
    v_common_headers
  );

  v_request_id := net.http_get(
    url :=
      'https://www-isp.boomplay.com/playlists/EQFJCbNTS0vEbeOL9pQjOToi?from=charts',
    params := '{}'::jsonb,
    headers := v_common_headers,
    timeout_milliseconds := 30000
  );

  insert into private.chart_source_soak_v3_requests(
    run_id,
    source,
    request_id,
    method,
    source_url,
    request_headers
  )
  values (
    v_run_id,
    'boomplay',
    v_request_id,
    'GET',
    'https://www-isp.boomplay.com/playlists/EQFJCbNTS0vEbeOL9pQjOToi?from=charts',
    v_common_headers
  );

  v_request_id := net.http_get(
    url :=
      'https://www.shazam.com/services/charts/csv/top-200/kenya',
    params := '{}'::jsonb,
    headers := v_shazam_headers,
    timeout_milliseconds := 30000
  );

  insert into private.chart_source_soak_v3_requests(
    run_id,
    source,
    request_id,
    method,
    source_url,
    request_headers
  )
  values (
    v_run_id,
    'shazam',
    v_request_id,
    'GET',
    'https://www.shazam.com/services/charts/csv/top-200/kenya',
    v_shazam_headers
  );

  for v_panel in
    select playlist_id
    from private.chart_source_soak_v3_spotify_ugc_panel
    where active
    order by panel_order
  loop
    v_request_id := net.http_get(
      url :=
        'https://open.spotify.com/embed/playlist/'
        || v_panel.playlist_id,
      params := '{}'::jsonb,
      headers := v_spotify_headers,
      timeout_milliseconds := 30000
    );

    insert into private.chart_source_soak_v3_spotify_ugc_requests(
      run_id,
      playlist_id,
      request_id,
      source_url,
      request_headers
    )
    values (
      v_run_id,
      v_panel.playlist_id,
      v_request_id,
      'https://open.spotify.com/embed/playlist/'
        || v_panel.playlist_id,
      v_spotify_headers
    );
  end loop;

  return v_run_id;
end;
$$;

create or replace function private.chart_source_soak_v3_collect(
  p_run_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, private, net, extensions
as $$
declare
  v_singleton_inserted integer := 0;
  v_ugc_inserted integer := 0;
  v_singleton_sealed integer := 0;
  v_ugc_sealed integer := 0;
  v_ugc_expected integer := 0;
  v_logical_sealed integer := 0;
  v_expected integer := 0;
  v_status text;
begin
  if not exists (
    select 1
    from private.chart_source_soak_v3_runs
    where run_id = p_run_id
  ) then
    raise exception
      'unknown chart source soak run: %',
      p_run_id;
  end if;

  insert into private.chart_source_soak_v3_observations(
    run_id,
    source,
    request_id,
    method,
    source_url,
    request_headers,
    request_body,
    status_code,
    content_type,
    response_headers,
    timed_out,
    error_msg,
    response_body_text,
    body_bytes,
    body_sha256,
    response_created_at_utc
  )
  select
    q.run_id,
    q.source,
    q.request_id,
    q.method,
    q.source_url,
    q.request_headers,
    q.request_body,
    r.status_code,
    r.content_type,
    coalesce(r.headers, '{}'::jsonb),
    coalesce(r.timed_out, false),
    r.error_msg,
    r.content,
    case
      when r.content is null then null
      else octet_length(r.content)
    end,
    case
      when r.content is null then null
      else encode(
        extensions.digest(r.content, 'sha256'),
        'hex'
      )
    end,
    r.created
  from private.chart_source_soak_v3_requests q
  join net._http_response r
    on r.id = q.request_id
  where q.run_id = p_run_id
  on conflict (run_id, source) do nothing;

  get diagnostics v_singleton_inserted = row_count;

  insert into private.chart_source_soak_v3_spotify_ugc_observations(
    run_id,
    playlist_id,
    request_id,
    source_url,
    request_headers,
    status_code,
    content_type,
    response_headers,
    timed_out,
    error_msg,
    response_body_text,
    body_bytes,
    body_sha256,
    has_next_data,
    parse_ok,
    track_count,
    track_ids,
    response_created_at_utc
  )
  select
    q.run_id,
    q.playlist_id,
    q.request_id,
    q.source_url,
    q.request_headers,
    r.status_code,
    r.content_type,
    coalesce(r.headers, '{}'::jsonb),
    coalesce(r.timed_out, false),
    r.error_msg,
    r.content,
    case
      when r.content is null then null
      else octet_length(r.content)
    end,
    case
      when r.content is null then null
      else encode(
        extensions.digest(r.content, 'sha256'),
        'hex'
      )
    end,
    position(
      '__NEXT_DATA__'
      in coalesce(r.content, '')
    ) > 0,
    (
      r.status_code = 200
      and position(
        '__NEXT_DATA__'
        in coalesce(r.content, '')
      ) > 0
      and coalesce(p.track_count, 0) > 0
    ),
    p.track_count,
    p.track_ids,
    r.created
  from private.chart_source_soak_v3_spotify_ugc_requests q
  join net._http_response r
    on r.id = q.request_id
  left join lateral (
    select
      count(*)::integer as track_count,
      coalesce(
        jsonb_agg(track_id order by first_ord),
        '[]'::jsonb
      ) as track_ids
    from (
      select
        m[1] as track_id,
        min(ord) as first_ord
      from regexp_matches(
        coalesce(r.content, ''),
        'spotify:track:([A-Za-z0-9]{22})',
        'g'
      ) with ordinality as rm(m, ord)
      group by m[1]
    ) d
  ) p on true
  where q.run_id = p_run_id
  on conflict (run_id, playlist_id) do nothing;

  get diagnostics v_ugc_inserted = row_count;

  select expected_source_count
    into v_expected
  from private.chart_source_soak_v3_runs
  where run_id = p_run_id;

  select count(*)
    into v_singleton_sealed
  from private.chart_source_soak_v3_observations
  where run_id = p_run_id;

  select count(*)
    into v_ugc_expected
  from private.chart_source_soak_v3_spotify_ugc_panel
  where active;

  select count(*)
    into v_ugc_sealed
  from private.chart_source_soak_v3_spotify_ugc_observations
  where run_id = p_run_id;

  v_logical_sealed :=
    v_singleton_sealed
    + case
        when v_ugc_sealed = v_ugc_expected
             and v_ugc_expected > 0
        then 1
        else 0
      end;

  v_status := case
    when v_logical_sealed = v_expected then 'complete'
    when v_singleton_sealed > 0 or v_ugc_sealed > 0 then 'partial'
    else 'pending'
  end;

  update private.chart_source_soak_v3_runs
  set
    last_collect_attempt_at_utc = clock_timestamp(),
    status = v_status,
    completed_at_utc = case
      when
        v_status = 'complete'
        and completed_at_utc is null
      then clock_timestamp()
      else completed_at_utc
    end
  where run_id = p_run_id;

  return jsonb_build_object(
    'run_id',
    p_run_id,
    'status',
    v_status,
    'singleton_inserted_now',
    v_singleton_inserted,
    'spotify_ugc_inserted_now',
    v_ugc_inserted,
    'singleton_sealed_count',
    v_singleton_sealed,
    'spotify_ugc_sealed_count',
    v_ugc_sealed,
    'spotify_ugc_expected_count',
    v_ugc_expected,
    'logical_source_sealed_count',
    v_logical_sealed,
    'expected_source_count',
    v_expected,
    'pending_logical_source_count',
    v_expected - v_logical_sealed
  );
end;
$$;

revoke all
on function private.chart_source_soak_v3_enqueue(
  text,
  timestamptz
)
from public, anon, authenticated;

revoke all
on function private.chart_source_soak_v3_collect(uuid)
from public, anon, authenticated;

comment on table private.chart_source_soak_v3_observations is
  'Temporary raw public-source accessibility evidence for Charts Soak Attempt 3. No production chart authority.';

comment on table private.chart_source_soak_v3_spotify_ugc_panel is
  'Frozen credential-free Kenya-relevant Spotify UGC panel for Charts Soak Attempt 3.';

comment on table private.chart_source_soak_v3_spotify_ugc_observations is
  'Credential-free Spotify public embed evidence. Twenty playlist members constitute one logical source.';

comment on function private.chart_source_soak_v3_enqueue(
  text,
  timestamptz
) is
  'Enqueues six singleton public sources plus the frozen 20-playlist credential-free Spotify UGC panel. No cron scheduling.';

comment on function private.chart_source_soak_v3_collect(uuid) is
  'Seals pg_net responses for six singleton sources and all Spotify UGC panel members before pg_net response expiry.';
