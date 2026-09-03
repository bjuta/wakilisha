-- Shared Show and Video public-route convergence.
--
-- Standalone Video keeps /video/:slug.
-- Show Episodes use the existing shared /shows/:showSlug/:episodeSlug identity.
-- The mature Phase 7B Video delivery reader remains intact behind a private
-- internal function. This migration changes public identity composition,
-- shared Show visibility, and cross-media Show reads only.

begin;

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'show-video-public-route-convergence',
    0
  )
);

do $show_video_convergence_preflight$
declare
  v_video_reader text;
  v_show_reader text;
begin
  if to_regprocedure(
       'public.get_public_video_publication(text,text)'
     ) is null
     or to_regprocedure(
       'public.get_public_video_index(integer)'
     ) is null
     or to_regprocedure(
       'public.get_public_show(text)'
     ) is null
     or to_regprocedure(
       'public.get_public_show_episode(text,text)'
     ) is null
  then
    raise exception
      'STOP: accepted public Video / Show readers are incomplete';
  end if;

  if to_regprocedure(
       'platform_private.get_public_video_publication_phase_7b(text,text)'
     ) is not null
     or to_regprocedure(
       'platform_private.get_public_audio_show_episode_phase_6b(text,text)'
     ) is not null
     or to_regprocedure(
       'public.get_public_show_index(integer)'
     ) is not null
  then
    raise exception
      'STOP: Show / Video convergence authority already exists';
  end if;

  v_video_reader := pg_get_functiondef(
    'public.get_public_video_publication(text,text)'::regprocedure
  );

  if position('adaptive_delivery' in v_video_reader) = 0
     or position('video_hls_360p_playlist' in v_video_reader) = 0
     or position('video_hls_720p_playlist' in v_video_reader) = 0
     or position('''transcript''' in v_video_reader) = 0
     or position('usage_role = ''video_transcript''' in v_video_reader) = 0
     or position('usage_role = ''video_caption''' in v_video_reader) = 0
  then
    raise exception
      'STOP: public Video reader is not at the accepted Phase 7B delivery baseline';
  end if;

  v_show_reader := pg_get_functiondef(
    'public.get_public_show(text)'::regprocedure
  );

  if position('editorial.audio_show_shared_links' in v_show_reader) = 0
     or position('public.get_public_show_episode' in v_show_reader) = 0
  then
    raise exception
      'STOP: public Show reader is not at the accepted Audio-first baseline';
  end if;
end;
$show_video_convergence_preflight$;

alter function public.get_public_video_publication(text,text)
  rename to get_public_video_publication_phase_7b;

alter function public.get_public_video_publication_phase_7b(text,text)
  set schema platform_private;

revoke all
  on function platform_private.get_public_video_publication_phase_7b(text,text)
  from public, anon, authenticated, service_role;

alter function public.get_public_show_episode(text,text)
  rename to get_public_audio_show_episode_phase_6b;

alter function public.get_public_audio_show_episode_phase_6b(text,text)
  set schema platform_private;

revoke all
  on function platform_private.get_public_audio_show_episode_phase_6b(text,text)
  from public, anon, authenticated, service_role;

create or replace function editorial.sync_published_video_episode_shared_visibility()
returns trigger
language plpgsql
security invoker
set search_path to 'pg_catalog', 'editorial', 'video'
as $function$
declare
  v_version video.publication_versions%rowtype;
  v_updated integer := 0;
begin
  if new.resource_kind <> 'video_episode'
     or new.visibility <> 'public'
     or new.lifecycle_state <> 'published'
     or new.current_published_version_id is null
  then
    return new;
  end if;

  select version_row.*
  into v_version
  from video.publication_versions version_row
  where version_row.id = new.current_published_version_id
    and version_row.resource_id = new.id
    and version_row.version_kind = 'published'
    and version_row.publication_kind = 'episode'
  limit 1;

  if not found
     or v_version.show_resource_id is null
     or v_version.show_episode_resource_id is null
  then
    raise exception
      'Published Video Episode requires exact shared Show and Show Episode identity.';
  end if;

  update editorial.resources resource_row
  set
    visibility = 'public',
    updated_at = now()
  where (
      resource_row.id = v_version.show_resource_id
      and resource_row.resource_kind = 'show'
      and resource_row.lifecycle_state = 'active'
    )
    or (
      resource_row.id = v_version.show_episode_resource_id
      and resource_row.resource_kind = 'show_episode'
      and resource_row.lifecycle_state = 'active'
    );

  get diagnostics v_updated = row_count;

  if v_updated <> 2 then
    raise exception
      'Published Video Episode shared Show hierarchy is incomplete.';
  end if;

  return new;
end;
$function$;

revoke execute
  on function editorial.sync_published_video_episode_shared_visibility()
  from public, anon, authenticated, service_role;

drop trigger if exists video_episode_shared_visibility_sync
on editorial.resources;

create trigger video_episode_shared_visibility_sync
after insert or update
on editorial.resources
for each row
when (
  new.resource_kind = 'video_episode'
  and new.visibility = 'public'
  and new.lifecycle_state = 'published'
  and new.current_published_version_id is not null
)
execute function editorial.sync_published_video_episode_shared_visibility();

with published_episode_versions as (
  select distinct
    version_row.show_resource_id,
    version_row.show_episode_resource_id
  from editorial.video_publication_resources binding_row
  join editorial.resources video_resource
    on video_resource.id = binding_row.resource_id
   and video_resource.resource_kind = 'video_episode'
   and video_resource.lifecycle_state = 'published'
   and video_resource.visibility = 'public'
   and video_resource.current_published_version_id is not null
  join video.publication_versions version_row
    on version_row.id = video_resource.current_published_version_id
   and version_row.resource_id = video_resource.id
   and version_row.publication_id = binding_row.publication_id
   and version_row.version_kind = 'published'
   and version_row.publication_kind = 'episode'
),
shared_targets as (
  select
    published_episode_versions.show_resource_id as resource_id,
    'show'::text as resource_kind
  from published_episode_versions
  where published_episode_versions.show_resource_id is not null

  union

  select
    published_episode_versions.show_episode_resource_id as resource_id,
    'show_episode'::text as resource_kind
  from published_episode_versions
  where published_episode_versions.show_episode_resource_id is not null
)
update editorial.resources resource_row
set
  visibility = 'public',
  updated_at = now()
from shared_targets target
where resource_row.id = target.resource_id
  and resource_row.resource_kind = target.resource_kind
  and resource_row.lifecycle_state = 'active'
  and resource_row.visibility is distinct from 'public';

create or replace function public.get_public_video_publication(
  p_slug text,
  p_show_slug text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial',
  'platform_private'
as $function$
declare
  v_payload jsonb;
  v_kind text;
  v_show_slug text;
  v_episode_slug text;
  v_show_resource_id uuid;
  v_episode_resource_id uuid;
  v_canonical_path text;
begin
  v_payload :=
    platform_private.get_public_video_publication_phase_7b(
      p_slug,
      p_show_slug
    );

  if v_payload is null then
    return null;
  end if;

  v_kind := v_payload ->> 'publication_kind';

  if v_kind = 'standalone' then
    if nullif(btrim(p_show_slug), '') is not null then
      return null;
    end if;

    v_canonical_path :=
      '/video/' || (v_payload ->> 'slug');

    return jsonb_set(
      v_payload,
      '{canonical_path}',
      to_jsonb(v_canonical_path),
      true
    );
  end if;

  if v_kind <> 'episode'
     or nullif(btrim(p_show_slug), '') is null
  then
    return null;
  end if;

  v_show_slug := v_payload #>> '{show,slug}';
  v_episode_slug := v_payload #>> '{episode,slug}';
  v_show_resource_id :=
    nullif(v_payload #>> '{show,resource_id}', '')::uuid;
  v_episode_resource_id :=
    nullif(v_payload #>> '{episode,resource_id}', '')::uuid;

  if v_show_slug is null
     or v_episode_slug is null
     or v_show_resource_id is null
     or v_episode_resource_id is null
     or lower(btrim(p_show_slug)) <> lower(v_show_slug)
  then
    return null;
  end if;

  if not exists (
       select 1
       from editorial.shows show_row
       join editorial.resources show_resource
         on show_resource.id = show_row.resource_id
        and show_resource.resource_kind = 'show'
        and show_resource.lifecycle_state = 'active'
        and show_resource.visibility = 'public'
       where show_row.resource_id = v_show_resource_id
         and show_row.slug = v_show_slug
     )
     or not exists (
       select 1
       from editorial.show_episodes episode_row
       join editorial.resources episode_resource
         on episode_resource.id = episode_row.resource_id
        and episode_resource.resource_kind = 'show_episode'
        and episode_resource.lifecycle_state = 'active'
        and episode_resource.visibility = 'public'
       where episode_row.resource_id = v_episode_resource_id
         and episode_row.show_resource_id = v_show_resource_id
         and episode_row.slug = v_episode_slug
     )
  then
    return null;
  end if;

  v_canonical_path :=
    '/shows/' || v_show_slug || '/' || v_episode_slug;

  v_payload := jsonb_set(
    v_payload,
    '{canonical_path}',
    to_jsonb(v_canonical_path),
    true
  );

  v_payload := jsonb_set(
    v_payload,
    '{show,canonical_path}',
    to_jsonb('/shows/' || v_show_slug),
    true
  );

  return v_payload;
end;
$function$;

revoke all
  on function public.get_public_video_publication(text,text)
  from public;

grant execute
  on function public.get_public_video_publication(text,text)
  to anon, authenticated, service_role;

create or replace function public.get_public_video_index(
  p_limit integer default 24
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog','public','editorial','video'
as $function$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 24), 60));
  v_items jsonb := '[]'::jsonb;
begin
  select coalesce(
    jsonb_agg(
      candidate.payload
      order by
        coalesce(
          nullif(
            candidate.payload #>> '{provenance,published_at}',
            ''
          )::timestamptz,
          '-infinity'::timestamptz
        ) desc,
        candidate.payload ->> 'canonical_path'
    ),
    '[]'::jsonb
  )
  into v_items
  from (
    select resolved.payload
    from editorial.video_publication_resources binding_row
    join editorial.resources resource_row
      on resource_row.id = binding_row.resource_id
     and resource_row.resource_kind = binding_row.resource_kind
     and resource_row.lifecycle_state = 'published'
     and resource_row.visibility = 'public'
     and resource_row.current_published_version_id is not null
    join video.publication_versions version_row
      on version_row.id = resource_row.current_published_version_id
     and version_row.publication_id = binding_row.publication_id
     and version_row.resource_id = binding_row.resource_id
     and version_row.version_kind = 'published'
    left join editorial.shows show_row
      on show_row.resource_id = version_row.show_resource_id
    cross join lateral (
      select public.get_public_video_publication(
        version_row.slug_snapshot,
        case
          when version_row.publication_kind = 'episode'
          then show_row.slug
          else null
        end
      ) as payload
    ) resolved
    where resolved.payload is not null
    order by
      coalesce(
        nullif(
          resolved.payload #>> '{provenance,published_at}',
          ''
        )::timestamptz,
        '-infinity'::timestamptz
      ) desc,
      resolved.payload ->> 'canonical_path'
    limit v_limit
  ) candidate;

  return jsonb_build_object('items', v_items);
end;
$function$;

revoke all
  on function public.get_public_video_index(integer)
  from public;

grant execute
  on function public.get_public_video_index(integer)
  to anon, authenticated, service_role;

create or replace function public.get_public_show_episode(
  p_show_slug text,
  p_episode_slug text
)
returns jsonb
language plpgsql
stable
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial',
  'platform_private'
as $function$
declare
  v_show_slug text := nullif(lower(btrim(p_show_slug)), '');
  v_episode_slug text := nullif(lower(btrim(p_episode_slug)), '');
  v_show editorial.shows%rowtype;
  v_episode editorial.show_episodes%rowtype;
  v_audio_episode jsonb := null;
  v_audio jsonb := null;
  v_video jsonb := null;
  v_canonical_path text;
begin
  if v_show_slug is null or v_episode_slug is null then
    return null;
  end if;

  select show_row.*
  into v_show
  from editorial.shows show_row
  join editorial.resources show_resource
    on show_resource.id = show_row.resource_id
   and show_resource.resource_kind = 'show'
   and show_resource.lifecycle_state = 'active'
   and show_resource.visibility = 'public'
  where show_row.slug = v_show_slug
  limit 1;

  if not found then
    return null;
  end if;

  select episode_row.*
  into v_episode
  from editorial.show_episodes episode_row
  join editorial.resources episode_resource
    on episode_resource.id = episode_row.resource_id
   and episode_resource.resource_kind = 'show_episode'
   and episode_resource.lifecycle_state = 'active'
   and episode_resource.visibility = 'public'
  where episode_row.show_resource_id = v_show.resource_id
    and episode_row.slug = v_episode_slug
  limit 1;

  if not found then
    return null;
  end if;

  v_audio_episode :=
    platform_private.get_public_audio_show_episode_phase_6b(
      v_show_slug,
      v_episode_slug
    );

  if v_audio_episode is not null then
    v_audio := v_audio_episode -> 'audio';
  end if;

  v_video :=
    public.get_public_video_publication(
      v_episode_slug,
      v_show_slug
    );

  if v_audio is null and v_video is null then
    return null;
  end if;

  v_canonical_path :=
    '/shows/' || v_show_slug || '/' || v_episode_slug;

  return jsonb_build_object(
    'episode',
    jsonb_build_object(
      'resource_id', v_episode.resource_id,
      'show_resource_id', v_show.resource_id,
      'slug', v_episode.slug,
      'canonical_path', v_canonical_path,
      'title', v_episode.title,
      'summary', v_episode.summary,
      'episode_number', v_episode.episode_number
    ),
    'audio', v_audio,
    'video', v_video
  );
end;
$function$;

revoke all
  on function public.get_public_show_episode(text,text)
  from public;

grant execute
  on function public.get_public_show_episode(text,text)
  to anon, authenticated, service_role;

create or replace function public.get_public_show(
  p_slug text
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'editorial'
as $function$
declare
  v_slug text := nullif(lower(btrim(p_slug)), '');
  v_show editorial.shows%rowtype;
  v_episodes jsonb := '[]'::jsonb;
  v_seasons jsonb := '[]'::jsonb;
  v_audio_count bigint := 0;
  v_video_count bigint := 0;
begin
  if v_slug is null then
    return null;
  end if;

  select show_row.*
  into v_show
  from editorial.shows show_row
  join editorial.resources show_resource
    on show_resource.id = show_row.resource_id
   and show_resource.resource_kind = 'show'
   and show_resource.lifecycle_state = 'active'
   and show_resource.visibility = 'public'
  where show_row.slug = v_slug
  limit 1;

  if not found then
    return null;
  end if;

  select coalesce(
    jsonb_agg(
      resolved.payload
      order by
        greatest(
          coalesce(
            nullif(
              resolved.payload #>> '{video,provenance,published_at}',
              ''
            )::timestamptz,
            '-infinity'::timestamptz
          ),
          coalesce(
            nullif(
              resolved.payload #>> '{audio,provenance,published_at}',
              ''
            )::timestamptz,
            '-infinity'::timestamptz
          )
        ) desc,
        coalesce(
          nullif(
            resolved.payload #>> '{episode,episode_number}',
            ''
          )::integer,
          -1
        ) desc,
        resolved.payload #>> '{episode,slug}'
    ),
    '[]'::jsonb
  )
  into v_episodes
  from editorial.show_episodes episode_row
  join editorial.resources episode_resource
    on episode_resource.id = episode_row.resource_id
   and episode_resource.resource_kind = 'show_episode'
   and episode_resource.lifecycle_state = 'active'
   and episode_resource.visibility = 'public'
  cross join lateral (
    select public.get_public_show_episode(
      v_show.slug,
      episode_row.slug
    ) as payload
  ) resolved
  where episode_row.show_resource_id = v_show.resource_id
    and resolved.payload is not null;

  if jsonb_array_length(v_episodes) = 0 then
    return null;
  end if;

  select
    count(*) filter (
      where jsonb_typeof(episode.value -> 'audio') = 'object'
    ),
    count(*) filter (
      where jsonb_typeof(episode.value -> 'video') = 'object'
    )
  into
    v_audio_count,
    v_video_count
  from jsonb_array_elements(v_episodes) episode(value);

  select coalesce(
    jsonb_agg(
      season.value
      order by
        coalesce(
          nullif(
            season.value ->> 'season_number',
            ''
          )::integer,
          0
        ),
        season.value ->> 'id'
    ),
    '[]'::jsonb
  )
  into v_seasons
  from (
    select distinct on (
      episode.value #>> '{audio,season,id}'
    )
      episode.value -> 'audio' -> 'season' as value
    from jsonb_array_elements(v_episodes) episode(value)
    where jsonb_typeof(
            episode.value #> '{audio,season}'
          ) = 'object'
      and coalesce(
            episode.value #>> '{audio,season,id}',
            ''
          ) <> ''
    order by
      episode.value #>> '{audio,season,id}',
      episode.value #>> '{audio,season,season_number}'
  ) season;

  return jsonb_build_object(
    'show',
    jsonb_build_object(
      'resource_id', v_show.resource_id,
      'slug', v_show.slug,
      'title', v_show.title,
      'description', v_show.description,
      'canonical_path', '/shows/' || v_show.slug,
      'feed_path',
        case
          when v_audio_count > 0
          then '/shows/' || v_show.slug || '/feed.xml'
          else null
        end,
      'episode_count', jsonb_array_length(v_episodes),
      'audio_episode_count', v_audio_count,
      'video_episode_count', v_video_count
    ),
    'seasons', v_seasons,
    'episodes', v_episodes
  );
end;
$function$;

revoke all
  on function public.get_public_show(text)
  from public;

grant execute
  on function public.get_public_show(text)
  to anon, authenticated, service_role;

create or replace function public.get_public_show_index(
  p_limit integer default 24
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'editorial'
as $function$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 24), 60));
  v_items jsonb := '[]'::jsonb;
begin
  select coalesce(
    jsonb_agg(
      candidate.show_payload
      order by candidate.title, candidate.slug
    ),
    '[]'::jsonb
  )
  into v_items
  from (
    select
      resolved.payload -> 'show' as show_payload,
      lower(show_row.title) as title,
      show_row.slug
    from editorial.shows show_row
    join editorial.resources show_resource
      on show_resource.id = show_row.resource_id
     and show_resource.resource_kind = 'show'
     and show_resource.lifecycle_state = 'active'
     and show_resource.visibility = 'public'
    cross join lateral (
      select public.get_public_show(show_row.slug) as payload
    ) resolved
    where resolved.payload is not null
    order by lower(show_row.title), show_row.slug
    limit v_limit
  ) candidate;

  return jsonb_build_object('items', v_items);
end;
$function$;

revoke all
  on function public.get_public_show_index(integer)
  from public;

grant execute
  on function public.get_public_show_index(integer)
  to anon, authenticated, service_role;

do $show_video_convergence_proof$
declare
  v_public_video text;
  v_internal_video text;
  v_show_episode text;
  v_show text;
begin
  if to_regprocedure(
       'platform_private.get_public_video_publication_phase_7b(text,text)'
     ) is null
     or to_regprocedure(
       'platform_private.get_public_audio_show_episode_phase_6b(text,text)'
     ) is null
     or to_regprocedure(
       'public.get_public_show_index(integer)'
     ) is null
  then
    raise exception
      'STOP: Show / Video convergence functions are incomplete';
  end if;

  v_public_video := pg_get_functiondef(
    'public.get_public_video_publication(text,text)'::regprocedure
  );
  v_internal_video := pg_get_functiondef(
    'platform_private.get_public_video_publication_phase_7b(text,text)'::regprocedure
  );
  v_show_episode := pg_get_functiondef(
    'public.get_public_show_episode(text,text)'::regprocedure
  );
  v_show := pg_get_functiondef(
    'public.get_public_show(text)'::regprocedure
  );

  if position(
       'platform_private.get_public_video_publication_phase_7b'
       in v_public_video
     ) = 0
     or position('''/shows/''' in v_public_video) = 0
     or position('''/video/''' in v_public_video) = 0
  then
    raise exception
      'STOP: public Video identity projection is incomplete';
  end if;

  if position('adaptive_delivery' in v_internal_video) = 0
     or position('video_hls_360p_playlist' in v_internal_video) = 0
     or position('video_hls_720p_playlist' in v_internal_video) = 0
     or position('''transcript''' in v_internal_video) = 0
     or position('usage_role = ''video_caption''' in v_internal_video) = 0
  then
    raise exception
      'STOP: preserved internal Video delivery authority drifted';
  end if;

  if position(
       'platform_private.get_public_audio_show_episode_phase_6b'
       in v_show_episode
     ) = 0
     or position(
       'public.get_public_video_publication'
       in v_show_episode
     ) = 0
     or position('''audio''' in v_show_episode) = 0
     or position('''video''' in v_show_episode) = 0
  then
    raise exception
      'STOP: shared Show Episode is not cross-media';
  end if;

  if position('public.get_public_show_episode' in v_show) = 0
     or position('audio_episode_count' in v_show) = 0
     or position('video_episode_count' in v_show) = 0
  then
    raise exception
      'STOP: shared public Show projection is incomplete';
  end if;

  if has_function_privilege(
       'anon',
       'platform_private.get_public_video_publication_phase_7b(text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.get_public_video_publication_phase_7b(text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.get_public_video_publication_phase_7b(text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'platform_private.get_public_audio_show_episode_phase_6b(text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.get_public_audio_show_episode_phase_6b(text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.get_public_audio_show_episode_phase_6b(text,text)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: preserved internal public readers leaked to API roles';
  end if;

  if not has_function_privilege(
       'anon',
       'public.get_public_video_publication(text,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'anon',
       'public.get_public_video_index(integer)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'anon',
       'public.get_public_show(text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'anon',
       'public.get_public_show_episode(text,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'anon',
       'public.get_public_show_index(integer)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: anonymous shared public read authority is incomplete';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid = 'editorial.resources'::regclass
      and trigger_row.tgname = 'video_episode_shared_visibility_sync'
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'STOP: Video Episode shared visibility trigger is missing';
  end if;

  if exists (
    select 1
    from editorial.video_publication_resources binding_row
    join editorial.resources video_resource
      on video_resource.id = binding_row.resource_id
     and video_resource.resource_kind = 'video_episode'
     and video_resource.lifecycle_state = 'published'
     and video_resource.visibility = 'public'
     and video_resource.current_published_version_id is not null
    join video.publication_versions version_row
      on version_row.id = video_resource.current_published_version_id
     and version_row.resource_id = video_resource.id
     and version_row.publication_id = binding_row.publication_id
     and version_row.version_kind = 'published'
     and version_row.publication_kind = 'episode'
    join editorial.resources show_resource
      on show_resource.id = version_row.show_resource_id
     and show_resource.resource_kind = 'show'
     and show_resource.lifecycle_state = 'active'
    join editorial.resources episode_resource
      on episode_resource.id = version_row.show_episode_resource_id
     and episode_resource.resource_kind = 'show_episode'
     and episode_resource.lifecycle_state = 'active'
    where show_resource.visibility <> 'public'
       or episode_resource.visibility <> 'public'
  ) then
    raise exception
      'STOP: current published Video Episode has a non-public shared hierarchy';
  end if;
end;
$show_video_convergence_proof$;

comment on function public.get_public_video_publication(text,text) is
  'Public Video resolver. Standalone Video is /video/:slug. Show Episode Video uses the shared /shows/:showSlug/:episodeSlug identity.';

comment on function public.get_public_show_episode(text,text) is
  'Public shared Show Episode resolver. One cultural Episode may compose published Audio, Video, or both without creating competing identities.';

comment on function public.get_public_show(text) is
  'Public cross-media Show resolver over shared Show identity and published Audio / Video Episode consumers.';

comment on function public.get_public_show_index(integer) is
  'Public directory of shared Shows with at least one currently resolvable published Episode.';

commit;
