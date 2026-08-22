-- Phase 6B M2: public Show, Episode collection, and stable RSS delivery authority.
--
-- M1 made one exact published Audio publication publicly readable. M2 adds the
-- parent Show projection and the stable enclosure resolver required by RSS.
-- Audio, Media, Trust, Review, and feed identity remain privately governed.

-- ---------------------------------------------------------------------------
-- A published Episode necessarily makes its parent Show and optional Season
-- publicly addressable. Shows and Seasons are container identities, not a
-- second publication/review lifecycle, so their lifecycle_state remains active.
-- ---------------------------------------------------------------------------

create or replace function audio.ensure_published_episode_parent_visibility()
returns trigger
language plpgsql
security invoker
set search_path to 'pg_catalog', 'audio', 'editorial'
as $function$
begin
  if new.publication_kind <> 'episode'
     or new.status <> 'published'
  then
    return new;
  end if;

  if new.show_id is null then
    raise exception
      'Published Audio Episode requires a Show identity';
  end if;

  update editorial.resources resource_row
  set
    visibility = 'public',
    updated_at = now()
  from editorial.audio_show_resources show_binding
  where show_binding.show_id = new.show_id
    and show_binding.resource_id = resource_row.id
    and show_binding.resource_kind = 'audio_show'
    and resource_row.resource_kind = 'audio_show'
    and resource_row.lifecycle_state = 'active';

  if not found then
    raise exception
      'Published Audio Episode requires an active typed Show Resource';
  end if;

  if new.season_id is not null then
    update editorial.resources resource_row
    set
      visibility = 'public',
      updated_at = now()
    from editorial.audio_season_resources season_binding
    join audio.seasons season_row
      on season_row.id = season_binding.season_id
     and season_row.show_id = new.show_id
    where season_binding.season_id = new.season_id
      and season_binding.resource_id = resource_row.id
      and season_binding.resource_kind = 'audio_season'
      and resource_row.resource_kind = 'audio_season'
      and resource_row.lifecycle_state = 'active';

    if not found then
      raise exception
        'Published Audio Episode requires an active typed Season Resource belonging to its Show';
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists audio_published_episode_parent_visibility
on audio.publications;

create trigger audio_published_episode_parent_visibility
after update of status
on audio.publications
for each row
when (
  new.publication_kind = 'episode'
  and new.status = 'published'
)
execute function audio.ensure_published_episode_parent_visibility();

-- Backfill the invariant if a replay target already contains published
-- Episodes created before this trigger existed.
update editorial.resources resource_row
set
  visibility = 'public',
  updated_at = now()
from audio.publications publication
join editorial.audio_show_resources show_binding
  on show_binding.show_id = publication.show_id
 and show_binding.resource_kind = 'audio_show'
where publication.publication_kind = 'episode'
  and publication.status = 'published'
  and show_binding.resource_id = resource_row.id
  and resource_row.resource_kind = 'audio_show'
  and resource_row.lifecycle_state = 'active'
  and resource_row.visibility <> 'public';

update editorial.resources resource_row
set
  visibility = 'public',
  updated_at = now()
from audio.publications publication
join audio.seasons season_row
  on season_row.id = publication.season_id
 and season_row.show_id = publication.show_id
join editorial.audio_season_resources season_binding
  on season_binding.season_id = season_row.id
 and season_binding.resource_kind = 'audio_season'
where publication.publication_kind = 'episode'
  and publication.status = 'published'
  and publication.season_id is not null
  and season_binding.resource_id = resource_row.id
  and resource_row.resource_kind = 'audio_season'
  and resource_row.lifecycle_state = 'active'
  and resource_row.visibility <> 'public';

-- ---------------------------------------------------------------------------
-- Public Show projection. Every Episode is resolved through the M1 function,
-- so current Media safety, exact published version identity, Trust filtering,
-- and raw-metadata closure are inherited instead of rebuilt here.
-- ---------------------------------------------------------------------------

create or replace function public.get_public_audio_show(
  p_slug text
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'editorial', 'audio'
as $function$
declare
  v_slug text := nullif(btrim(p_slug), '');
  v_show audio.shows%rowtype;
  v_show_resource_id uuid;
  v_episodes jsonb := '[]'::jsonb;
  v_seasons jsonb := '[]'::jsonb;
begin
  if v_slug is null then
    return null;
  end if;

  select
    show_row,
    show_binding.resource_id
  into
    v_show,
    v_show_resource_id
  from audio.shows show_row
  join editorial.audio_show_resources show_binding
    on show_binding.show_id = show_row.id
   and show_binding.resource_kind = 'audio_show'
  join editorial.resources show_resource
    on show_resource.id = show_binding.resource_id
   and show_resource.resource_kind = 'audio_show'
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
        coalesce(
          nullif(
            resolved.payload #>> '{provenance,published_at}',
            ''
          )::timestamptz,
          '-infinity'::timestamptz
        ) desc,
        coalesce(
          nullif(
            resolved.payload ->> 'episode_number',
            ''
          )::integer,
          -1
        ) desc,
        resolved.payload ->> 'slug'
    ),
    '[]'::jsonb
  )
  into v_episodes
  from audio.publications publication
  join editorial.audio_publication_resources binding
    on binding.publication_id = publication.id
   and binding.resource_kind = 'audio_episode'
   and binding.current_published_version_id is not null
  join editorial.resources episode_resource
    on episode_resource.id = binding.resource_id
   and episode_resource.resource_kind = 'audio_episode'
   and episode_resource.lifecycle_state = 'published'
   and episode_resource.visibility = 'public'
  join audio.publication_versions version_row
    on version_row.id = binding.current_published_version_id
   and version_row.publication_id = publication.id
   and version_row.resource_id = binding.resource_id
   and version_row.version_kind = 'published'
   and version_row.status = 'published'
   and version_row.publication_kind = 'episode'
   and version_row.show_id = v_show.id
  cross join lateral (
    select public.get_public_audio_publication(
      publication.slug
    ) as payload
  ) resolved
  where publication.publication_kind = 'episode'
    and publication.status = 'published'
    and publication.show_id = v_show.id
    and resolved.payload is not null;

  -- A public Show surface exists only when at least one current published
  -- Episode still passes the exact M1 public-safety projection.
  if jsonb_array_length(v_episodes) = 0 then
    return null;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', season_row.id,
        'resource_id', season_binding.resource_id,
        'season_number', season_row.season_number,
        'title', season_row.title,
        'description', season_row.description
      )
      order by season_row.season_number, season_row.id
    ),
    '[]'::jsonb
  )
  into v_seasons
  from audio.seasons season_row
  join editorial.audio_season_resources season_binding
    on season_binding.season_id = season_row.id
   and season_binding.resource_kind = 'audio_season'
  join editorial.resources season_resource
    on season_resource.id = season_binding.resource_id
   and season_resource.resource_kind = 'audio_season'
   and season_resource.lifecycle_state = 'active'
   and season_resource.visibility = 'public'
  where season_row.show_id = v_show.id
    and exists (
      select 1
      from jsonb_array_elements(v_episodes) episode(value)
      where episode.value #>> '{season,id}' = season_row.id::text
    );

  return jsonb_build_object(
    'show', jsonb_build_object(
      'id', v_show.id,
      'resource_id', v_show_resource_id,
      'slug', v_show.slug,
      'title', v_show.title,
      'description', v_show.description,
      'canonical_path', '/audio/shows/' || v_show.slug,
      'feed_path', '/audio/shows/' || v_show.slug || '/feed.xml',
      'episode_count', jsonb_array_length(v_episodes)
    ),
    'seasons', v_seasons,
    'episodes', v_episodes
  );
end;
$function$;

revoke all
on function public.get_public_audio_show(text)
from public;

grant execute
on function public.get_public_audio_show(text)
to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Stable enclosure presentation. This returns only the currently public-safe
-- source behind the immutable Phase 6A enclosure identity. The HTTP transport
-- adapter redirects the branded enclosure URL to this exact source.
-- ---------------------------------------------------------------------------

create or replace function public.get_public_audio_enclosure(
  p_publication_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'audio'
as $function$
declare
  v_slug text;
  v_payload jsonb;
begin
  if p_publication_id is null then
    return null;
  end if;

  select publication.slug
  into v_slug
  from audio.publications publication
  where publication.id = p_publication_id
    and publication.status = 'published'
  limit 1;

  if not found then
    return null;
  end if;

  v_payload := public.get_public_audio_publication(v_slug);

  if v_payload is null
     or v_payload ->> 'publication_id'
          is distinct from p_publication_id::text
  then
    return null;
  end if;

  return jsonb_build_object(
    'publication_id', p_publication_id,
    'guid', v_payload #>> '{feed,guid}',
    'enclosure_url', v_payload #>> '{feed,enclosure_url}',
    'source_url', v_payload #>> '{delivery,url}',
    'mime_type', v_payload #>> '{delivery,mime_type}',
    'byte_size', nullif(
      v_payload #>> '{delivery,byte_size}',
      ''
    )::bigint,
    'sha256', v_payload #>> '{delivery,sha256}',
    'duration_seconds', nullif(
      v_payload #>> '{delivery,duration_seconds}',
      ''
    )::numeric
  );
end;
$function$;

revoke all
on function public.get_public_audio_enclosure(uuid)
from public;

grant execute
on function public.get_public_audio_enclosure(uuid)
to anon, authenticated;

comment on function public.get_public_audio_show(text) is
  'Phase 6B public Show projection. Returns only currently public-safe published Episodes by reusing the exact M1 Audio publication resolver.';

comment on function public.get_public_audio_enclosure(uuid) is
  'Phase 6B stable enclosure projection. Resolves an immutable branded enclosure identity to the exact currently public-safe Media delivery source.';
