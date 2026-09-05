-- Charts Public-Source Accessibility Soak V3 replay verifier.
-- Structural only: no external HTTP requests and no cron scheduling.
-- Any verifier fixture is transactionally rolled back.

begin;

do $verify$
declare
  v_run_id uuid;
  v_expected_source_count integer;
  v_contract_version text;
  v_enqueue_definition text;
  v_collect_definition text;
  v_enqueue_oid oid;
  v_collect_oid oid;
  v_has_soak_cron boolean := false;
begin
  if (select count(*) from supabase_migrations.schema_migrations) <> 93
     or (select max(version) from supabase_migrations.schema_migrations)
        <> '20260905170000'
  then
    raise exception
      'STOP: expected exact 93 / 20260905170000 migration authority';
  end if;

  if to_regclass('private.chart_source_soak_v3_runs') is null
     or to_regclass('private.chart_source_soak_v3_requests') is null
     or to_regclass('private.chart_source_soak_v3_observations') is null
     or to_regclass('private.chart_source_soak_v3_spotify_ugc_panel') is null
     or to_regclass('private.chart_source_soak_v3_spotify_ugc_requests') is null
     or to_regclass('private.chart_source_soak_v3_spotify_ugc_observations') is null
  then
    raise exception
      'STOP: one or more Charts Soak V3 private relations are missing';
  end if;

  if (
    select count(*)
    from private.chart_source_soak_v3_spotify_ugc_panel
    where active
  ) <> 20
  then
    raise exception
      'STOP: Spotify UGC active panel must contain exactly 20 playlists';
  end if;

  if (
    select count(distinct playlist_id)
    from private.chart_source_soak_v3_spotify_ugc_panel
    where active
  ) <> 20
     or (
       select count(distinct owner_label)
       from private.chart_source_soak_v3_spotify_ugc_panel
       where active
     ) <> 20
  then
    raise exception
      'STOP: Spotify UGC panel lost playlist or owner independence';
  end if;

  insert into private.chart_source_soak_v3_runs(mode)
  values ('preflight')
  returning
    run_id,
    expected_source_count,
    source_contract_version
  into
    v_run_id,
    v_expected_source_count,
    v_contract_version;

  if v_expected_source_count <> 7 then
    raise exception
      'STOP: Charts Soak V3 logical source count is not seven';
  end if;

  if v_contract_version <>
     'v3-supabase-20260905-credential-free-7src'
  then
    raise exception
      'STOP: Charts Soak V3 source contract version drifted: %',
      v_contract_version;
  end if;

  if to_regclass('cron.job') is not null then
    execute $sql$
      select exists (
        select 1
        from cron.job
        where coalesce(jobname, '') ilike '%chart%soak%'
           or command ilike '%chart_source_soak_v3%'
      )
    $sql$
    into v_has_soak_cron;
  end if;

  if v_has_soak_cron then
    raise exception
      'STOP: preflight migration unexpectedly scheduled Charts Soak cron';
  end if;

  select p.oid
  into v_enqueue_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname = 'chart_source_soak_v3_enqueue'
    and pg_get_function_identity_arguments(p.oid) =
      'p_mode text, p_scheduled_for_utc timestamp with time zone';

  select p.oid
  into v_collect_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname = 'chart_source_soak_v3_collect'
    and pg_get_function_identity_arguments(p.oid) =
      'p_run_id uuid';

  if v_enqueue_oid is null or v_collect_oid is null then
    raise exception
      'STOP: Charts Soak V3 enqueue/collect function identity is missing';
  end if;

  if not (select prosecdef from pg_proc where oid = v_enqueue_oid)
     or not (select prosecdef from pg_proc where oid = v_collect_oid)
  then
    raise exception
      'STOP: Charts Soak V3 functions lost SECURITY DEFINER';
  end if;

  if (
    select proconfig
    from pg_proc
    where oid = v_enqueue_oid
  ) is distinct from
    array['search_path=pg_catalog, private, net']::text[]
  then
    raise exception
      'STOP: Charts Soak V3 enqueue search_path drifted';
  end if;

  if (
    select proconfig
    from pg_proc
    where oid = v_collect_oid
  ) is distinct from
    array['search_path=pg_catalog, private, net, extensions']::text[]
  then
    raise exception
      'STOP: Charts Soak V3 collect search_path drifted';
  end if;

  if has_function_privilege('anon', v_enqueue_oid, 'EXECUTE')
     or has_function_privilege('authenticated', v_enqueue_oid, 'EXECUTE')
     or has_function_privilege('anon', v_collect_oid, 'EXECUTE')
     or has_function_privilege('authenticated', v_collect_oid, 'EXECUTE')
  then
    raise exception
      'STOP: Charts Soak V3 private functions are publicly executable';
  end if;

  if has_table_privilege(
       'anon',
       'private.chart_source_soak_v3_runs',
       'SELECT'
     )
     or has_table_privilege(
       'authenticated',
       'private.chart_source_soak_v3_runs',
       'SELECT'
     )
     or has_table_privilege(
       'anon',
       'private.chart_source_soak_v3_observations',
       'SELECT'
     )
     or has_table_privilege(
       'authenticated',
       'private.chart_source_soak_v3_observations',
       'SELECT'
     )
     or has_table_privilege(
       'anon',
       'private.chart_source_soak_v3_spotify_ugc_observations',
       'SELECT'
     )
     or has_table_privilege(
       'authenticated',
       'private.chart_source_soak_v3_spotify_ugc_observations',
       'SELECT'
     )
  then
    raise exception
      'STOP: Charts Soak V3 private evidence is publicly readable';
  end if;

  v_enqueue_definition :=
    pg_get_functiondef(v_enqueue_oid);

  v_collect_definition :=
    pg_get_functiondef(v_collect_oid);

  if position(
       'rss.applemarketingtools.com/api/v2/ke/music/most-played/100/songs.json'
       in v_enqueue_definition
     ) = 0
     or position(
       'charts.youtube.com/youtubei/v1/browse?alt=json'
       in v_enqueue_definition
     ) = 0
     or position(
       'play.mdundo.com/top-charts/ke'
       in v_enqueue_definition
     ) = 0
     or position(
       'audiomack.com/geo-charts/playlist/kenya'
       in v_enqueue_definition
     ) = 0
     or position(
       'www-isp.boomplay.com/playlists/EQFJCbNTS0vEbeOL9pQjOToi?from=charts'
       in v_enqueue_definition
     ) = 0
     or position(
       'www.shazam.com/services/charts/csv/top-200/kenya'
       in v_enqueue_definition
     ) = 0
     or position(
       'open.spotify.com/embed/playlist/'
       in v_enqueue_definition
     ) = 0
  then
    raise exception
      'STOP: one or more credential-free source routes drifted';
  end if;

  if position(
       'www.boomplay.com/playlists/EQFJCbNTS0vEbeOL9pQjOToi?from=charts'
       in v_enqueue_definition
     ) > 0
  then
    raise exception
      'STOP: retired Boomplay www route reappeared';
  end if;

  if position('api.spotify.com' in lower(v_enqueue_definition)) > 0
     or position(
       'charts-spotify-com-service'
       in lower(v_enqueue_definition)
     ) > 0
     or position('bearer ' in lower(v_enqueue_definition)) > 0
     or position('authorization' in lower(v_enqueue_definition)) > 0
  then
    raise exception
      'STOP: Spotify credential surface appeared in credential-free soak';
  end if;

  if position('accept-encoding' in lower(v_enqueue_definition)) > 0 then
    raise exception
      'STOP: explicit Accept-Encoding reappeared in soak request contract';
  end if;

  if position(
       'spotify_ugc_expected_count'
       in v_collect_definition
     ) = 0
     or position(
       'logical_source_sealed_count'
       in v_collect_definition
     ) = 0
     or position(
       'spotify_ugc_sealed_count'
       in v_collect_definition
     ) = 0
  then
    raise exception
      'STOP: Spotify UGC logical-source completion contract drifted';
  end if;
end;
$verify$;

select jsonb_build_object(
  'verification', 'PASS',
  'migration_count',
    (select count(*) from supabase_migrations.schema_migrations),
  'migration_head',
    (select max(version) from supabase_migrations.schema_migrations),
  'logical_source_count', 7,
  'singleton_source_count', 6,
  'spotify_ugc_panel_size',
    (
      select count(*)
      from private.chart_source_soak_v3_spotify_ugc_panel
      where active
    ),
  'cron_scheduled', false,
  'credential_free', true
) as chart_source_soak_v3_preflight_acceptance;

rollback;
