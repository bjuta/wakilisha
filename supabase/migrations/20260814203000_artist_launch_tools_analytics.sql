-- WAKILISHA M6: Artist launch tools + analytics.
--
-- Constitution:
-- - Reuse the existing analytics_events ledger and attribution contract.
-- - Return aggregates only to an active Artist representative.
-- - Do not expose visitor, follower, session, or referrer identity.
-- - Launch links are client-generated UTM links and do not create a second campaign store.
-- - Canonical public content paths come from Registry credit authority.

begin;

do $m6_preflight$
begin
  if to_regclass('public.analytics_events') is null
     or to_regclass('public.community_follows') is null
     or to_regclass('public.registry_release_artists') is null
     or to_regclass('public.registry_track_artists') is null
     or to_regclass('public.registry_release_tracks') is null
     or to_regclass('public.artist_updates') is null
     or to_regclass('private.phase_0a_rpc_classification') is null
  then
    raise exception
      'STOP: Required analytics, Follow, Registry credit, or RPC authority is missing';
  end if;

  if to_regprocedure('editorial.current_artist_representation(uuid)') is null
     or to_regprocedure('public.track_analytics_event(text,text,text,text,text,jsonb,text,uuid,text)') is null
  then
    raise exception
      'STOP: Required Artist representation or analytics writer authority is incomplete';
  end if;

  if to_regprocedure('public.community_get_artist_launch_analytics(uuid,integer)') is not null then
    raise exception
      'STOP: M6 Artist launch analytics authority already exists';
  end if;
end;
$m6_preflight$;

create or replace function public.community_get_artist_launch_analytics(
  p_artist_id uuid,
  p_days integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, editorial
as $$
declare
  v_actor uuid := auth.uid();
  v_rep public.artist_representations%rowtype;
  v_artist public.registry_artists%rowtype;
  v_days integer :=
    case
      when p_days in (7, 30, 90) then p_days
      else 30
    end;
  v_since timestamptz;
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;

  select *
  into v_rep
  from editorial.current_artist_representation(
    p_artist_id
  );

  if v_rep.id is null then
    raise exception 'insufficient_artist_analytics_privilege';
  end if;

  select artist.*
  into v_artist
  from public.registry_artists artist
  where artist.id = p_artist_id
    and artist.status = 'active';

  if not found then
    raise exception 'artist_not_found';
  end if;

  v_since :=
    (
      date_trunc(
        'day',
        now() at time zone 'Africa/Nairobi'
      )
      at time zone 'Africa/Nairobi'
    )
    - ((v_days - 1) * interval '1 day');

  with
  release_targets as (
    select distinct on (release.id)
      'release'::text as target_type,
      release.id::text as target_id,
      release.slug as target_slug,
      release.title as title,
      release.artwork_url as image_url,
      (
        '/releases/'
        || coalesce(
             primary_credit.artist_slug,
             v_artist.slug
           )
        || '/'
        || release.slug
      ) as path,
      release.release_date::timestamptz as published_at
    from public.registry_release_artists artist_credit
    join public.registry_releases release
      on release.id = artist_credit.release_id
    left join lateral (
      select coalesce(
        nullif(
          btrim(credit.artist_slug),
          ''
        ),
        credited_artist.slug
      ) as artist_slug
      from public.registry_release_artists credit
      left join public.registry_artists credited_artist
        on credited_artist.id = credit.artist_id
       and credited_artist.status = 'active'
      where credit.release_id = release.id
        and credit.status = 'active'
        and (
          nullif(
            btrim(credit.artist_slug),
            ''
          ) is not null
          or credited_artist.slug is not null
        )
      order by
        credit.is_primary desc,
        credit.credit_order asc,
        credit.id asc
      limit 1
    ) primary_credit
      on true
    where artist_credit.artist_id = p_artist_id
      and artist_credit.status = 'active'
      and release.status = 'active'
    order by
      release.id,
      artist_credit.is_primary desc,
      artist_credit.credit_order asc,
      artist_credit.id asc
  ),
  track_targets as (
    select distinct on (track.id)
      'track'::text as target_type,
      track.id::text as target_id,
      public_route.public_track_slug as target_slug,
      track.title as title,
      track.artwork_url as image_url,
      public_route.path as path,
      track.created_at as published_at
    from public.registry_track_artists artist_credit
    join public.registry_tracks track
      on track.id = artist_credit.track_id
    left join lateral (
      select coalesce(
        nullif(
          btrim(credit.artist_slug),
          ''
        ),
        credited_artist.slug
      ) as artist_slug
      from public.registry_track_artists credit
      left join public.registry_artists credited_artist
        on credited_artist.id = credit.artist_id
       and credited_artist.status = 'active'
      where credit.track_id = track.id
        and credit.status = 'active'
        and (
          nullif(
            btrim(credit.artist_slug),
            ''
          ) is not null
          or credited_artist.slug is not null
        )
      order by
        credit.is_primary desc,
        credit.credit_order asc,
        credit.id asc
      limit 1
    ) primary_track_credit
      on true
    left join lateral (
      select
        release.id as release_id,
        release.slug as release_slug,
        coalesce(
          primary_release_credit.artist_slug,
          primary_track_credit.artist_slug,
          nullif(
            btrim(artist_credit.artist_slug),
            ''
          ),
          v_artist.slug
        ) as release_artist_slug
      from public.registry_release_tracks membership
      join public.registry_releases release
        on release.id = membership.release_id
       and release.status = 'active'
      left join lateral (
        select coalesce(
          nullif(
            btrim(credit.artist_slug),
            ''
          ),
          credited_artist.slug
        ) as artist_slug
        from public.registry_release_artists credit
        left join public.registry_artists credited_artist
          on credited_artist.id = credit.artist_id
         and credited_artist.status = 'active'
        where credit.release_id = release.id
          and credit.status = 'active'
          and (
            nullif(
              btrim(credit.artist_slug),
              ''
            ) is not null
            or credited_artist.slug is not null
          )
        order by
          credit.is_primary desc,
          credit.credit_order asc,
          credit.id asc
        limit 1
      ) primary_release_credit
        on true
      where membership.track_id = track.id
        and membership.status = 'active'
      order by
        case
          when lower(
            coalesce(
              release.release_type,
              ''
            )
          ) in (
            'album',
            'ep',
            'compilation',
            'mixtape',
            'soundtrack',
            'deluxe'
          )
          then 0
          else 1
        end,
        release.release_date desc nulls last,
        release.id asc
      limit 1
    ) canonical_release
      on true
    cross join lateral (
      select
        trim(
          both '-'
          from regexp_replace(
            lower(
              coalesce(
                track.slug,
                ''
              )
            ),
            '[^a-z0-9]+',
            '-',
            'g'
          )
        ) as stored_slug,
        trim(
          both '-'
          from regexp_replace(
            lower(
              coalesce(
                track.title,
                ''
              )
            ),
            '[^a-z0-9]+',
            '-',
            'g'
          )
        ) as title_slug,
        trim(
          both '-'
          from regexp_replace(
            lower(
              coalesce(
                primary_track_credit.artist_slug,
                nullif(
                  btrim(
                    artist_credit.artist_slug
                  ),
                  ''
                ),
                v_artist.slug,
                ''
              )
            ),
            '[^a-z0-9]+',
            '-',
            'g'
          )
        ) as artist_slug
    ) normalized_track_slug
    cross join lateral (
      select
        case
          when normalized_track_slug.stored_slug =
               normalized_track_slug.title_slug
          then normalized_track_slug.title_slug
          when normalized_track_slug.artist_slug <> ''
           and (
             normalized_track_slug.stored_slug =
               normalized_track_slug.title_slug
               || '-'
               || normalized_track_slug.artist_slug
             or normalized_track_slug.stored_slug like
               normalized_track_slug.title_slug
               || '-'
               || normalized_track_slug.artist_slug
               || '-%'
           )
          then normalized_track_slug.title_slug
          when normalized_track_slug.artist_slug <> ''
           and (
             normalized_track_slug.stored_slug =
               normalized_track_slug.artist_slug
               || '-'
               || normalized_track_slug.title_slug
             or normalized_track_slug.stored_slug like
               normalized_track_slug.artist_slug
               || '-'
               || normalized_track_slug.title_slug
               || '-%'
           )
          then normalized_track_slug.title_slug
          else normalized_track_slug.stored_slug
        end as public_track_slug
    ) public_slug
    cross join lateral (
      select
        public_slug.public_track_slug,
        case
          when canonical_release.release_id is not null
          then
            '/releases/'
            || canonical_release.release_artist_slug
            || '/'
            || canonical_release.release_slug
            || '/'
            || public_slug.public_track_slug
          else
            '/tracks/'
            || coalesce(
                 primary_track_credit.artist_slug,
                 nullif(
                   btrim(
                     artist_credit.artist_slug
                   ),
                   ''
                 ),
                 v_artist.slug
               )
            || '/'
            || public_slug.public_track_slug
        end as path
    ) public_route
    where artist_credit.artist_id = p_artist_id
      and artist_credit.status = 'active'
      and track.status = 'active'
      and public_route.public_track_slug <> ''
    order by
      track.id,
      artist_credit.is_primary desc,
      artist_credit.credit_order asc,
      artist_credit.id asc
  ),
  update_targets as (
    select
      'artist_update'::text as target_type,
      update.id::text as target_id,
      update.id::text as target_slug,
      left(
        regexp_replace(
          update.body,
          E'[\\n\\r]+',
          ' ',
          'g'
        ),
        90
      ) as title,
      update.image_url as image_url,
      (
        '/artists/'
        || v_artist.slug
        || '/updates/'
        || update.id::text
      ) as path,
      update.published_at as published_at
    from public.artist_updates update
    where update.artist_id = p_artist_id
      and update.status = 'published'
  ),
  targets as (
    select
      'artist'::text as target_type,
      v_artist.id::text as target_id,
      v_artist.slug as target_slug,
      v_artist.display_name as title,
      v_artist.public_image_url as image_url,
      '/artists/' || v_artist.slug as path,
      null::timestamptz as published_at

    union all

    select * from release_targets

    union all

    select * from track_targets

    union all

    select * from update_targets
  ),
  target_urls as (
    select
      target.*,
      'https://wakilisha.africa'
        || target.path as page_url
    from targets target
  ),
  relevant_events as (
    select
      event.id,
      event.event_name,
      event.page_url,
      event.context,
      event.session_id,
      event.created_at,
      target.target_type,
      target.target_id,
      target.target_slug,
      target.title,
      target.image_url,
      target.path,
      target.published_at
    from public.analytics_events event
    join target_urls target
      on target.page_url = event.page_url
    where event.created_at >= v_since
      and event.event_name in (
        'page_view',
        'player_play',
        'player_complete',
        'share_copy',
        'share_click'
      )
      and coalesce(
            event.context ->> 'analytics_traffic_type',
            'external'
          ) <> 'internal'
  ),
  target_metrics as (
    select
      target.target_type,
      target.target_id,
      target.target_slug,
      target.title,
      target.image_url,
      target.path,
      target.published_at,
      count(event.id)
        filter (
          where event.event_name = 'page_view'
        )::bigint as views,
      count(event.id)
        filter (
          where event.event_name = 'player_play'
            and target.target_type in (
              'track',
              'release'
            )
        )::bigint as plays,
      count(event.id)
        filter (
          where event.event_name = 'player_complete'
            and target.target_type in (
              'track',
              'release'
            )
        )::bigint as completed_plays,
      count(event.id)
        filter (
          where event.event_name in (
            'share_copy',
            'share_click'
          )
        )::bigint as shares
    from target_urls target
    left join relevant_events event
      on event.target_type = target.target_type
     and event.target_id = target.target_id
    group by
      target.target_type,
      target.target_id,
      target.target_slug,
      target.title,
      target.image_url,
      target.path,
      target.published_at
  ),
  summary as (
    select jsonb_build_object(
      'views',
        count(*)
          filter (
            where event_name = 'page_view'
          ),
      'profile_views',
        count(*)
          filter (
            where event_name = 'page_view'
              and target_type = 'artist'
          ),
      'music_views',
        count(*)
          filter (
            where event_name = 'page_view'
              and target_type in (
                'track',
                'release'
              )
          ),
      'update_views',
        count(*)
          filter (
            where event_name = 'page_view'
              and target_type = 'artist_update'
          ),
      'plays',
        count(*)
          filter (
            where event_name = 'player_play'
              and target_type in (
                'track',
                'release'
              )
          ),
      'completed_plays',
        count(*)
          filter (
            where event_name = 'player_complete'
              and target_type in (
                'track',
                'release'
              )
          ),
      'shares',
        count(*)
          filter (
            where event_name in (
              'share_copy',
              'share_click'
            )
          ),
      'visitors',
        count(
          distinct session_id
        )
          filter (
            where event_name = 'page_view'
              and nullif(
                    btrim(session_id),
                    ''
                  ) is not null
          )
    ) as value
    from relevant_events
  ),
  follower_summary as (
    select jsonb_build_object(
      'total',
        count(*),
      'new_in_period',
        count(*)
          filter (
            where follow.created_at >= v_since
          )
    ) as value
    from public.community_follows follow
    where follow.target_type = 'artist'
      and follow.target_id = p_artist_id::text
  ),
  launch_campaigns as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'campaign',
            campaign,
          'source',
            source,
          'views',
            views,
          'visitors',
            visitors
        )
        order by
          views desc,
          campaign asc,
          source asc
      ),
      '[]'::jsonb
    ) as value
    from (
      select
        event.context
          #>> '{attribution,current,utm_campaign}'
          as campaign,
        coalesce(
          nullif(
            event.context
              #>> '{attribution,current,utm_source}',
            ''
          ),
          'unknown'
        ) as source,
        count(*)::bigint as views,
        count(
          distinct event.session_id
        )::bigint as visitors
      from relevant_events event
      where event.event_name = 'page_view'
        and event.context
              #>> '{attribution,current,utm_medium}'
            = 'artist_launch'
        and nullif(
              event.context
                #>> '{attribution,current,utm_campaign}',
              ''
            ) is not null
      group by
        campaign,
        source
      order by
        views desc,
        campaign asc,
        source asc
    ) campaign_rows
  ),
  top_content as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'type',
            target_type,
          'id',
            target_id,
          'slug',
            target_slug,
          'title',
            title,
          'image_url',
            image_url,
          'path',
            path,
          'views',
            views,
          'plays',
            plays,
          'completed_plays',
            completed_plays,
          'shares',
            shares
        )
        order by
          (
            views
            + plays
            + shares
          ) desc,
          views desc,
          title asc
      ),
      '[]'::jsonb
    ) as value
    from (
      select *
      from target_metrics
      where (
        views
        + plays
        + shares
      ) > 0
      order by
        (
          views
          + plays
          + shares
        ) desc,
        views desc,
        title asc
      limit 12
    ) ranked
  ),
  launch_targets as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'type',
            target_type,
          'id',
            target_id,
          'slug',
            target_slug,
          'title',
            title,
          'image_url',
            image_url,
          'path',
            path,
          'published_at',
            published_at
        )
        order by
          case target_type
            when 'artist' then 0
            when 'release' then 1
            when 'track' then 2
            else 3
          end,
          published_at desc nulls first,
          title asc
      ),
      '[]'::jsonb
    ) as value
    from (
      select *
      from target_urls
      order by
        case target_type
          when 'artist' then 0
          when 'release' then 1
          when 'track' then 2
          else 3
        end,
        published_at desc nulls first,
        title asc
    ) bounded_targets
  )
  select jsonb_build_object(
    'artist',
      jsonb_build_object(
        'id',
          v_artist.id,
        'slug',
          v_artist.slug,
        'name',
          v_artist.display_name
      ),
    'range_days',
      v_days,
    'since',
      v_since,
    'generated_at',
      now(),
    'summary',
      coalesce(
        (
          select value
          from summary
        ),
        '{}'::jsonb
      )
      || jsonb_build_object(
           'followers',
             coalesce(
               (
                 select value -> 'total'
                 from follower_summary
               ),
               '0'::jsonb
             ),
           'new_followers',
             coalesce(
               (
                 select value -> 'new_in_period'
                 from follower_summary
               ),
               '0'::jsonb
             )
         ),
    'launch_targets',
      (
        select value
        from launch_targets
      ),
    'top_content',
      (
        select value
        from top_content
      ),
    'launch_campaigns',
      (
        select value
        from launch_campaigns
      )
  )
  into v_result;

  return v_result;
end;
$$;

revoke all
on function public.community_get_artist_launch_analytics(uuid,integer)
from public, anon;

grant execute
on function public.community_get_artist_launch_analytics(uuid,integer)
to authenticated;

insert into private.phase_0a_rpc_classification (
  function_signature,
  access_class,
  rationale
)
values (
  'community_get_artist_launch_analytics(uuid,integer)',
  'authenticated_read',
  'Returns aggregate-only public performance and launch attribution for one active Registry Artist to an active Artist representative without exposing visitor or follower identity.'
)
on conflict (function_signature)
do update
set
  access_class = excluded.access_class,
  rationale = excluded.rationale,
  reviewed_at = now();

do $m6_postflight$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.community_get_artist_launch_analytics(uuid,integer)'::regprocedure
  )
  into v_definition;

  if position(
       'editorial.current_artist_representation'
       in v_definition
     ) = 0
     or position(
       'public.analytics_events'
       in v_definition
     ) = 0
     or position(
       'public.community_follows'
       in v_definition
     ) = 0
     or position(
       'public.registry_release_artists'
       in v_definition
     ) = 0
     or position(
       'public.registry_track_artists'
       in v_definition
     ) = 0
     or position(
         'public.registry_release_tracks'
         in v_definition
       ) = 0
     or position(
         'public_track_slug'
         in v_definition
       ) = 0
     or position(
       'public.artist_updates'
       in v_definition
     ) = 0
     or position(
       '''artist_launch'''
       in v_definition
     ) = 0
  then
    raise exception
      'FAIL: M6 Artist launch analytics authority is incomplete';
  end if;

  if has_function_privilege(
       'anon',
       'public.community_get_artist_launch_analytics(uuid,integer)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: Anonymous users can read Artist launch analytics';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.community_get_artist_launch_analytics(uuid,integer)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: Authenticated Artist representatives cannot read launch analytics';
  end if;

  if not exists (
    select 1
    from private.phase_0a_rpc_classification
    where function_signature =
      'community_get_artist_launch_analytics(uuid,integer)'
      and access_class =
        'authenticated_read'
  ) then
    raise exception
      'FAIL: M6 Artist launch analytics RPC classification is missing';
  end if;
end;
$m6_postflight$;

commit;
