begin;

create or replace function public.admin_refresh_signal_os_rollups(
  p_start_date date default current_date - 30,
  p_end_date date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start date := p_start_date;
  v_end date := p_end_date;
  v_entity_rows integer := 0;
  v_score_rows integer := 0;
  v_search_rows integer := 0;
  v_journey_rows integer := 0;
  v_opportunity_rows integer := 0;
  v_jwt_role text := coalesce(
    current_setting('request.jwt.claim.role', true),
    current_setting('role', true),
    ''
  );
begin
  if session_user not in ('postgres', 'service_role', 'supabase_admin')
    and v_jwt_role <> 'service_role'
    and not public.current_user_has_capability('manage_analytics')
    and not public.current_user_has_capability('manage_registry') then
    raise exception 'insufficient_privilege';
  end if;

  delete from public.signal_os_entity_daily_metrics
  where metric_date between v_start and v_end;

  delete from public.signal_os_entity_signal_scores
  where score_date between v_start and v_end;

  delete from public.signal_os_journey_edges_daily
  where metric_date between v_start and v_end;

  delete from public.signal_os_search_demand_gaps
  where metric_date between v_start and v_end;

  delete from public.signal_os_content_opportunities
  where opportunity_date between v_start and v_end
    and status = 'open'
    and opportunity_type in ('rising_entity', 'search_gap', 'page_fix');

  insert into public.signal_os_entity_daily_metrics (
    metric_date,
    entity_type,
    entity_slug,
    entity_title,
    page_path,
    page_views,
    unique_sessions,
    share_events,
    share_copy_events,
    share_click_events,
    newsletter_events,
    playback_events,
    video_events,
    scroll_events,
    search_mentions,
    referrer_domains,
    first_seen_at,
    last_seen_at,
    sample_context,
    updated_at
  )
  with normalized as (
    select
      date(created_at) as metric_date,
      coalesce(
        nullif(entity_type, ''),
        nullif(context->>'entity_type', ''),
        nullif(context->>'entityType', ''),
        nullif(page_type, ''),
        'page'
      ) as entity_type,
      coalesce(
        nullif(entity_slug, ''),
        nullif(context->>'entity_slug', ''),
        nullif(context->>'entitySlug', ''),
        nullif(context->>'target_slug', ''),
        public.signal_os_slug_from_path(coalesce(context->>'target_url', page_url))
      ) as entity_slug,
      coalesce(
        nullif(context->>'target_title', ''),
        nullif(context->>'entity_title', ''),
        nullif(context->>'entityTitle', ''),
        nullif(context->>'share_title', '')
      ) as entity_title,
      public.signal_os_path_from_url(coalesce(context->>'target_url', page_url)) as page_path,
      event_name,
      session_id,
      referrer,
      created_at,
      coalesce(context, '{}'::jsonb) as context
    from public.analytics_events
    where created_at >= v_start
      and created_at < (v_end + 1)
  ),
  filtered as (
    select *
    from normalized
    where entity_slug is not null
      and entity_slug <> ''
      and entity_type not in ('admin', 'auth', 'settings', 'profile')
      and page_path not like '/admin%'
      and page_path not like '/auth%'
      and page_path not like '/settings%'
      and page_path not like '/profile%'
      and page_path not like '/preview%'
  )
  select
    metric_date,
    entity_type,
    entity_slug,
    max(entity_title) filter (where entity_title is not null) as entity_title,
    max(page_path) as page_path,
    count(*) filter (where event_name = 'page_view')::integer as page_views,
    count(distinct session_id)::integer as unique_sessions,
    count(*) filter (where event_name in ('share_click', 'share_copy'))::integer as share_events,
    count(*) filter (where event_name = 'share_copy')::integer as share_copy_events,
    count(*) filter (where event_name = 'share_click')::integer as share_click_events,
    count(*) filter (where event_name in ('newsletter_signup', 'briefing_subscribe'))::integer as newsletter_events,
    count(*) filter (where event_name = 'player_play')::integer as playback_events,
    count(*) filter (where event_name = 'video_play')::integer as video_events,
    count(*) filter (where event_name = 'scroll_depth')::integer as scroll_events,
    count(*) filter (where event_name = 'search_query')::integer as search_mentions,
    count(distinct nullif(regexp_replace(coalesce(referrer, ''), '^https?://([^/]+).*$', '\1'), ''))::integer as referrer_domains,
    min(created_at) as first_seen_at,
    max(created_at) as last_seen_at,
    coalesce((array_agg(context order by created_at desc))[1], '{}'::jsonb) as sample_context,
    now()
  from filtered
  group by metric_date, entity_type, entity_slug;

  get diagnostics v_entity_rows = row_count;

  delete from public.signal_os_entity_daily_metrics
  where metric_date between v_start and v_end
    and (
      entity_type not in ('artist', 'track', 'release', 'article', 'guide', 'chart', 'chart_edition', 'genre', 'label', 'author')
      or entity_slug ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or page_path = '/'
      or page_path like '/admin%'
      or page_path like '/auth%'
      or page_path like '/settings%'
      or page_path like '/profile%'
      or page_path like '/preview%'
      or page_path like '/search%'
      or page_path like '/contact%'
      or page_path like '/about%'
      or page_path like '/privacy%'
      or page_path like '/terms%'
      or page_path like '/faqs%'
    );

  select count(*)::integer
  into v_entity_rows
  from public.signal_os_entity_daily_metrics
  where metric_date between v_start and v_end;

  insert into public.signal_os_entity_signal_scores (
    score_date,
    entity_type,
    entity_slug,
    entity_title,
    page_path,
    signal_score,
    signal_label,
    page_views,
    unique_sessions,
    share_events,
    search_mentions,
    newsletter_events,
    playback_events,
    referrer_domains,
    explanation,
    recommended_action,
    evidence,
    updated_at
  )
  select
    metric_date as score_date,
    entity_type,
    entity_slug,
    entity_title,
    page_path,
    least(100, greatest(0,
      page_views * 4
      + unique_sessions * 7
      + share_events * 16
      + search_mentions * 10
      + newsletter_events * 20
      + playback_events * 12
      + video_events * 8
      + referrer_domains * 6
    ))::integer as signal_score,
    public.signal_os_label_for_score(least(100, greatest(0,
      page_views * 4
      + unique_sessions * 7
      + share_events * 16
      + search_mentions * 10
      + newsletter_events * 20
      + playback_events * 12
      + video_events * 8
      + referrer_domains * 6
    ))::integer) as signal_label,
    page_views,
    unique_sessions,
    share_events,
    search_mentions,
    newsletter_events,
    playback_events,
    referrer_domains,
    concat_ws(
      ', ',
      case when page_views > 0 then page_views || ' page views' end,
      case when unique_sessions > 0 then unique_sessions || ' sessions' end,
      case when share_events > 0 then share_events || ' shares' end,
      case when search_mentions > 0 then search_mentions || ' search mentions' end,
      case when newsletter_events > 0 then newsletter_events || ' newsletter events' end,
      case when playback_events > 0 then playback_events || ' plays' end
    ) as explanation,
    case
      when share_events > 0 then 'Create or boost a tracked campaign around this signal.'
      when search_mentions > 0 then 'Turn this demand into search-friendly content.'
      when playback_events > 0 then 'Check track context, chart movement, and artist page links.'
      when newsletter_events > 0 then 'Feature this in the next relevant briefing.'
      else 'Open the entity and decide the next editorial move.'
    end as recommended_action,
    jsonb_build_array(
      jsonb_build_object('label', 'Page views', 'value', page_views),
      jsonb_build_object('label', 'Sessions', 'value', unique_sessions),
      jsonb_build_object('label', 'Shares', 'value', share_events),
      jsonb_build_object('label', 'Search mentions', 'value', search_mentions),
      jsonb_build_object('label', 'Newsletter events', 'value', newsletter_events),
      jsonb_build_object('label', 'Playback events', 'value', playback_events)
    ) as evidence,
    now()
  from public.signal_os_entity_daily_metrics
  where metric_date between v_start and v_end;

  get diagnostics v_score_rows = row_count;

  delete from public.signal_os_entity_signal_scores
  where score_date between v_start and v_end
    and (
      entity_type not in ('artist', 'track', 'release', 'article', 'guide', 'chart', 'chart_edition', 'genre', 'label', 'author')
      or entity_slug ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or page_path = '/'
      or page_path like '/admin%'
      or page_path like '/auth%'
      or page_path like '/settings%'
      or page_path like '/profile%'
      or page_path like '/preview%'
      or page_path like '/search%'
      or page_path like '/contact%'
      or page_path like '/about%'
      or page_path like '/privacy%'
      or page_path like '/terms%'
      or page_path like '/faqs%'
    );

  select count(*)::integer
  into v_score_rows
  from public.signal_os_entity_signal_scores
  where score_date between v_start and v_end;

  insert into public.signal_os_search_demand_gaps (
    metric_date,
    query,
    searches,
    unique_sessions,
    zero_result_events,
    matched_entity_type,
    matched_entity_slug,
    opportunity_score,
    recommended_action,
    sample_context,
    updated_at
  )
  with search_events as (
    select
      date(created_at) as metric_date,
      lower(trim(coalesce(context->>'search_query', context->>'query', ''))) as query,
      session_id,
      coalesce((context->>'results_count')::integer, null) as results_count,
      coalesce(context->>'entity_type', entity_type) as matched_entity_type,
      coalesce(context->>'entity_slug', entity_slug) as matched_entity_slug,
      coalesce(context, '{}'::jsonb) as context,
      created_at
    from public.analytics_events
    where created_at >= v_start
      and created_at < (v_end + 1)
      and event_name = 'search_query'
  )
  select
    metric_date,
    query,
    count(*)::integer as searches,
    count(distinct session_id)::integer as unique_sessions,
    count(*) filter (where results_count = 0)::integer as zero_result_events,
    max(matched_entity_type) filter (where matched_entity_type is not null),
    max(matched_entity_slug) filter (where matched_entity_slug is not null),
    least(100, count(*) * 12 + count(*) filter (where results_count = 0) * 20)::integer as opportunity_score,
    case
      when count(*) filter (where results_count = 0) > 0 then 'Fix this demand gap: ingest entity, add alias, write content, or improve search mapping.'
      else 'Refresh the best answer and add stronger entity links.'
    end,
    coalesce((array_agg(context order by created_at desc))[1], '{}'::jsonb),
    now()
  from search_events
  where query <> ''
  group by metric_date, query;

  get diagnostics v_search_rows = row_count;

  insert into public.signal_os_journey_edges_daily (
    metric_date,
    from_type,
    from_slug,
    from_title,
    from_path,
    to_type,
    to_slug,
    to_title,
    to_path,
    sessions,
    transitions,
    updated_at
  )
  with page_events as (
    select
      date(created_at) as metric_date,
      session_id,
      created_at,
      coalesce(nullif(entity_type, ''), nullif(context->>'entity_type', ''), nullif(context->>'entityType', ''), nullif(page_type, ''), 'page') as entity_type,
      coalesce(nullif(entity_slug, ''), nullif(context->>'entity_slug', ''), nullif(context->>'entitySlug', ''), public.signal_os_slug_from_path(page_url)) as entity_slug,
      coalesce(nullif(context->>'target_title', ''), nullif(context->>'entity_title', ''), nullif(context->>'share_title', '')) as entity_title,
      public.signal_os_path_from_url(page_url) as page_path,
      lead(coalesce(nullif(entity_type, ''), nullif(context->>'entity_type', ''), nullif(context->>'entityType', ''), nullif(page_type, ''), 'page')) over (partition by session_id, date(created_at) order by created_at) as next_type,
      lead(coalesce(nullif(entity_slug, ''), nullif(context->>'entity_slug', ''), nullif(context->>'entitySlug', ''), public.signal_os_slug_from_path(page_url))) over (partition by session_id, date(created_at) order by created_at) as next_slug,
      lead(coalesce(nullif(context->>'target_title', ''), nullif(context->>'entity_title', ''), nullif(context->>'share_title', ''))) over (partition by session_id, date(created_at) order by created_at) as next_title,
      lead(public.signal_os_path_from_url(page_url)) over (partition by session_id, date(created_at) order by created_at) as next_path
    from public.analytics_events
    where created_at >= v_start
      and created_at < (v_end + 1)
      and event_name = 'page_view'
      and session_id is not null
  )
  select
    metric_date,
    entity_type as from_type,
    entity_slug as from_slug,
    max(entity_title) as from_title,
    max(page_path) as from_path,
    next_type as to_type,
    next_slug as to_slug,
    max(next_title) as to_title,
    max(next_path) as to_path,
    count(distinct session_id)::integer as sessions,
    count(*)::integer as transitions,
    now()
  from page_events
  where entity_slug is not null
    and next_slug is not null
    and entity_slug <> next_slug
    and page_path not like '/admin%'
    and page_path not like '/preview%'
    and next_path not like '/admin%'
    and next_path not like '/preview%'
  group by metric_date, entity_type, entity_slug, next_type, next_slug;

  get diagnostics v_journey_rows = row_count;

  delete from public.signal_os_journey_edges_daily
  where metric_date between v_start and v_end
    and (
      from_type not in ('artist', 'track', 'release', 'article', 'guide', 'chart', 'chart_edition', 'genre', 'label', 'author')
      or to_type not in ('artist', 'track', 'release', 'article', 'guide', 'chart', 'chart_edition', 'genre', 'label', 'author')
      or from_slug ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or to_slug ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or from_path = '/'
      or to_path = '/'
      or from_path like '/admin%'
      or to_path like '/admin%'
      or from_path like '/auth%'
      or to_path like '/auth%'
      or from_path like '/settings%'
      or to_path like '/settings%'
      or from_path like '/profile%'
      or to_path like '/profile%'
      or from_path like '/preview%'
      or to_path like '/preview%'
      or from_path like '/search%'
      or to_path like '/search%'
      or from_path like '/contact%'
      or to_path like '/contact%'
      or from_path like '/about%'
      or to_path like '/about%'
      or from_path like '/privacy%'
      or to_path like '/privacy%'
      or from_path like '/terms%'
      or to_path like '/terms%'
      or from_path like '/faqs%'
      or to_path like '/faqs%'
    );

  select count(*)::integer
  into v_journey_rows
  from public.signal_os_journey_edges_daily
  where metric_date between v_start and v_end;

  insert into public.signal_os_content_opportunities (
    opportunity_date,
    opportunity_type,
    entity_type,
    entity_slug,
    entity_title,
    query,
    page_path,
    opportunity_score,
    title,
    reason,
    recommended_action,
    evidence,
    status,
    updated_at
  )
  select
    score_date,
    'rising_entity',
    entity_type,
    entity_slug,
    entity_title,
    null,
    page_path,
    signal_score,
    'Lean into ' || coalesce(entity_title, replace(entity_slug, '-', ' ')),
    signal_label || ' signal: ' || coalesce(explanation, 'activity is moving.'),
    recommended_action,
    evidence,
    'open',
    now()
  from public.signal_os_entity_signal_scores
  where score_date between v_start and v_end
    and signal_score >= 50
  order by signal_score desc
  limit 50;

  insert into public.signal_os_content_opportunities (
    opportunity_date,
    opportunity_type,
    query,
    opportunity_score,
    title,
    reason,
    recommended_action,
    evidence,
    status,
    updated_at
  )
  select
    metric_date,
    'search_gap',
    query,
    opportunity_score,
    'Fix search demand for "' || query || '"',
    searches || ' searches' || case when zero_result_events > 0 then ', including zero-result events.' else '.' end,
    recommended_action,
    jsonb_build_array(
      jsonb_build_object('label', 'Searches', 'value', searches),
      jsonb_build_object('label', 'Sessions', 'value', unique_sessions),
      jsonb_build_object('label', 'Zero-result events', 'value', zero_result_events)
    ),
    'open',
    now()
  from public.signal_os_search_demand_gaps
  where metric_date between v_start and v_end
    and opportunity_score >= 25
  order by opportunity_score desc
  limit 50;

  select count(*)::integer
  into v_opportunity_rows
  from public.signal_os_content_opportunities
  where opportunity_date between v_start and v_end
    and status = 'open';

  return jsonb_build_object(
    'ok', true,
    'startDate', v_start,
    'endDate', v_end,
    'entityMetricRows', v_entity_rows,
    'scoreRows', v_score_rows,
    'searchGapRows', v_search_rows,
    'journeyRows', v_journey_rows,
    'opportunityRows', v_opportunity_rows
  );
end;
$$;

grant execute on function public.admin_refresh_signal_os_rollups(date, date) to authenticated;

commit;
