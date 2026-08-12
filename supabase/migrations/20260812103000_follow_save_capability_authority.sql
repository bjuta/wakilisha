-- Following Experience M1
-- Follow / Save capability authority.
--
-- Product contract:
-- Follow = maintain a relationship with an ongoing subject that can produce
-- meaningful future output.
-- Save = privately retain a specific published item for later return.
--
-- Followable:
--   person, artist, genre, label, chart_program
--
-- Saveable in executable M1 authority:
--   article, playlist, track, release, chart_edition
--
-- Explicit product capability debt:
--   Guide is Saveable by product intent, but Guide Save execution is deferred
--   until WAKILISHA has one canonical Guide identity/editorial authority.
--   Current guide_pages / guides records must not be blessed accidentally.
--
-- The one reviewed legacy Article Follow is redundant: the same Article was
-- already Saved four days earlier. M1 preserves the existing Save and Save
-- activity exactly, then removes only the later Article Follow and its Follow
-- activity.
--
-- It does not:
-- - create a Following feed;
-- - expose Following identities publicly;
-- - change Person merge / Credit authority;
-- - add recommendation ranking;
-- - add contributor claiming;
-- - change frontend interaction surfaces.

begin;


do $follow_save_m1_preflight$
declare
  v_article_follow_count integer;
  v_unexpected_follow_count integer;
  v_unexpected_save_count integer;
  v_follow_trigger_count integer;
  v_save_trigger_count integer;
begin
  if to_regclass(
       'public.community_follows'
     ) is null
     or to_regclass(
       'public.community_saves'
     ) is null
     or to_regclass(
       'public.community_activity'
     ) is null
     or to_regclass(
       'public.registry_artists'
     ) is null
     or to_regclass(
       'public.registry_genres'
     ) is null
     or to_regclass(
       'public.registry_labels'
     ) is null
     or to_regclass(
       'public.registry_tracks'
     ) is null
     or to_regclass(
       'public.registry_track_artists'
     ) is null
     or to_regclass(
       'public.registry_releases'
     ) is null
     or to_regclass(
       'public.registry_release_artists'
     ) is null
     or to_regclass(
       'public.registry_release_tracks'
     ) is null
     or to_regclass(
       'public.wk_chart_programs_v2'
     ) is null
     or to_regclass(
       'public.wk_chart_editions_v2'
     ) is null
     or to_regclass(
       'editorial.article_resources'
     ) is null
     or to_regclass(
       'editorial.playlist_resources'
     ) is null
     or to_regclass(
       'editorial.resources'
     ) is null
  then
    raise exception
      'STOP: Required Follow/Save target authority is missing';
  end if;

  if to_regprocedure(
       'editorial.resolve_person_follow_target(uuid)'
     ) is null
     or to_regprocedure(
       'public.community_set_follow_state(text,text,text,boolean)'
     ) is null
     or to_regprocedure(
       'public.community_follow_target(text,text,text)'
     ) is null
     or to_regprocedure(
       'public.community_set_saved_state(text,text,text,text,text,text,text,boolean)'
     ) is null
     or to_regprocedure(
       'public.community_save_entity(text,text,text,text,text,text,text)'
     ) is null
     or to_regprocedure(
       'public.community_get_user_follows(uuid)'
     ) is null
     or to_regprocedure(
       'public.community_get_user_saves(uuid)'
     ) is null
  then
    raise exception
      'STOP: Existing Community command/read authority is incomplete';
  end if;

  if to_regprocedure(
       'private.community_resolve_follow_target(text,text,text)'
     ) is not null
     or to_regprocedure(
       'private.community_resolve_save_target(text,text,text,text)'
     ) is not null
  then
    raise exception
      'STOP: Follow/Save M1 resolver authority already exists';
  end if;

  select count(*)::integer
  into v_article_follow_count
  from public.community_follows
  where target_type = 'article';

  if v_article_follow_count <> 1 then
    raise exception
      'STOP: Expected exactly one reviewed legacy Article Follow, found %',
      v_article_follow_count;
  end if;

  select count(*)::integer
  into v_unexpected_follow_count
  from public.community_follows
  where target_type not in (
    'article',
    'person',
    'artist',
    'genre',
    'label',
    'chart_program'
  );

  if v_unexpected_follow_count <> 0 then
    raise exception
      'STOP: Unexpected existing Follow target rows: %',
      v_unexpected_follow_count;
  end if;

  select count(*)::integer
  into v_unexpected_save_count
  from public.community_saves
  where entity_type not in (
    'article',
    'playlist',
    'track',
    'release',
    'chart_edition'
  );

  if v_unexpected_save_count <> 0 then
    raise exception
      'STOP: Existing Save rows include non-content entity types: %',
      v_unexpected_save_count;
  end if;

  select count(*)::integer
  into v_follow_trigger_count
  from pg_trigger trigger_row
  join pg_proc procedure
    on procedure.oid =
       trigger_row.tgfoid
  join pg_class relation
    on relation.oid =
       trigger_row.tgrelid
  join pg_namespace namespace
    on namespace.oid =
       relation.relnamespace
  where not trigger_row.tgisinternal
    and namespace.nspname =
        'public'
    and relation.relname =
        'community_follows'
    and procedure.proname =
        'community_activity_on_follow'
    and trigger_row.tgenabled =
        'O';

  select count(*)::integer
  into v_save_trigger_count
  from pg_trigger trigger_row
  join pg_proc procedure
    on procedure.oid =
       trigger_row.tgfoid
  join pg_class relation
    on relation.oid =
       trigger_row.tgrelid
  join pg_namespace namespace
    on namespace.oid =
       relation.relnamespace
  where not trigger_row.tgisinternal
    and namespace.nspname =
        'public'
    and relation.relname =
        'community_saves'
    and procedure.proname =
        'community_activity_on_save'
    and trigger_row.tgenabled =
        'O';

  if v_follow_trigger_count <> 1
     or v_save_trigger_count <> 1
  then
    raise exception
      'STOP: Follow/Save activity trigger authority changed before M1';
  end if;
end;
$follow_save_m1_preflight$;


create or replace function
  private.community_resolve_follow_target(
    p_target_type text,
    p_target_id text,
    p_target_slug text
  )
returns table(
  canonical_type text,
  canonical_id text,
  canonical_slug text,
  followable boolean
)
language plpgsql
stable
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial',
  'private'
as $function$
declare
  v_type text :=
    nullif(
      btrim(
        coalesce(
          p_target_type,
          ''
        )
      ),
      ''
    );
  v_id text :=
    nullif(
      btrim(
        coalesce(
          p_target_id,
          ''
        )
      ),
      ''
    );
  v_slug text :=
    nullif(
      btrim(
        coalesce(
          p_target_slug,
          ''
        )
      ),
      ''
    );
  v_person_id uuid;
  v_person record;
  v_status text;
begin
  if v_type not in (
    'person',
    'artist',
    'genre',
    'label',
    'chart_program'
  ) then
    raise exception
      'Unsupported Follow target type'
      using errcode = '22023';
  end if;

  if v_id is null then
    raise exception
      'Stable Follow target identity is required'
      using errcode = '22023';
  end if;

  canonical_type :=
    v_type;

  if v_type = 'person' then
    begin
      v_person_id :=
        v_id::uuid;
    exception
      when invalid_text_representation then
        raise exception
          'Person Follow target must be a UUID'
          using errcode = '22023';
    end;

    select *
    into v_person
    from editorial.resolve_person_follow_target(
      v_person_id
    );

    canonical_id :=
      v_person.person_resource_id::text;

    canonical_slug :=
      case
        when v_person.canonical_path
               ~ '^/people/[^/]+$'
          then split_part(
            v_person.canonical_path,
            '/',
            3
          )
        else null
      end;

    followable :=
      coalesce(
        v_person.followable,
        false
      );

    return next;
    return;
  end if;

  if v_type = 'artist' then
    select
      artist.id::text,
      artist.slug,
      artist.status
    into
      canonical_id,
      canonical_slug,
      v_status
    from public.registry_artists artist
    where artist.id::text =
          v_id
    limit 1;

    if canonical_id is null then
      select
        resolved.canonical_artist_id::text,
        resolved.canonical_slug,
        'active'::text
      into
        canonical_id,
        canonical_slug,
        v_status
      from public.registry_resolve_artist_slug_for_public(
        coalesce(
          v_slug,
          v_id
        )
      ) resolved
      limit 1;
    end if;

    if canonical_id is null then
      raise exception
        'Artist Follow target does not exist'
        using errcode = 'P0002';
    end if;

    followable :=
      v_status = 'active';

    return next;
    return;
  end if;

  if v_type = 'genre' then
    select
      genre.id::text,
      genre.slug,
      genre.status
    into
      canonical_id,
      canonical_slug,
      v_status
    from public.registry_genres genre
    where genre.id::text =
          v_id
       or lower(
            genre.slug
          ) =
          lower(
            coalesce(
              v_slug,
              v_id
            )
          )
    order by
      case
        when genre.id::text =
             v_id
          then 0
        else 1
      end
    limit 1;

    if canonical_id is null then
      raise exception
        'Genre Follow target does not exist'
        using errcode = 'P0002';
    end if;

    followable :=
      v_status = 'active';

    return next;
    return;
  end if;

  if v_type = 'label' then
    select
      label.id::text,
      label.slug,
      label.status
    into
      canonical_id,
      canonical_slug,
      v_status
    from public.registry_labels label
    where label.id::text =
          v_id
       or lower(
            label.slug
          ) =
          lower(
            coalesce(
              v_slug,
              v_id
            )
          )
    order by
      case
        when label.id::text =
             v_id
          then 0
        else 1
      end
    limit 1;

    if canonical_id is null then
      raise exception
        'Label Follow target does not exist'
        using errcode = 'P0002';
    end if;

    followable :=
      v_status = 'active';

    return next;
    return;
  end if;

  select
    program.id,
    program.public_slug
  into
    canonical_id,
    canonical_slug
  from public.wk_chart_programs_v2 program
  where program.id =
        v_id
     or lower(
          program.public_slug
        ) =
        lower(
          coalesce(
            v_slug,
            v_id
          )
        )
  order by
    case
      when program.id =
           v_id
        then 0
      else 1
    end
  limit 1;

  if canonical_id is null then
    raise exception
      'Chart programme Follow target does not exist'
      using errcode = 'P0002';
  end if;

  followable :=
    true;

  return next;
end;
$function$;


revoke all on function
  private.community_resolve_follow_target(
    text,
    text,
    text
  )
from public;

revoke execute on function
  private.community_resolve_follow_target(
    text,
    text,
    text
  )
from anon, authenticated, service_role;


create or replace function
  private.community_resolve_save_target(
    p_entity_type text,
    p_entity_id text,
    p_entity_slug text,
    p_entity_url text
  )
returns table(
  canonical_type text,
  canonical_id text,
  canonical_slug text,
  canonical_url text,
  saveable boolean
)
language plpgsql
stable
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial',
  'private'
as $function$
declare
  v_type text :=
    nullif(
      btrim(
        coalesce(
          p_entity_type,
          ''
        )
      ),
      ''
    );
  v_id text :=
    nullif(
      btrim(
        coalesce(
          p_entity_id,
          ''
        )
      ),
      ''
    );
  v_slug text :=
    nullif(
      btrim(
        coalesce(
          p_entity_slug,
          ''
        )
      ),
      ''
    );
  v_url text :=
    nullif(
      btrim(
        coalesce(
          p_entity_url,
          ''
        )
      ),
      ''
    );
  v_status text;
  v_visibility text;
  v_lifecycle text;
  v_published_version uuid;
  v_primary_artist_slug text;
  v_primary_artist_count integer;
begin
  if v_type not in (
    'article',
    'playlist',
    'track',
    'release',
    'chart_edition'
  ) then
    raise exception
      'Unsupported Save entity type'
      using errcode = '22023';
  end if;

  canonical_type :=
    v_type;

  if v_type = 'article' then
    select
      article.id::text,
      article.slug,
      coalesce(
        alias.path,
        '/magazine/' || article.slug
      ),
      resource.visibility,
      resource.lifecycle_state,
      resource.current_published_version_id
    into
      canonical_id,
      canonical_slug,
      canonical_url,
      v_visibility,
      v_lifecycle,
      v_published_version
    from editorial.article_resources
      article_resource
    join public.wk_articles article
      on article.id =
         article_resource.article_id
    join editorial.resources resource
      on resource.id =
         article_resource.resource_id
     and resource.resource_kind =
         'article'
    left join lateral (
      select
        resource_alias.path
      from editorial.resource_aliases
        resource_alias
      where resource_alias.resource_id =
            article_resource.resource_id
        and resource_alias.is_canonical
        and resource_alias.retired_at
            is null
      order by
        resource_alias.created_at,
        resource_alias.path
      limit 1
    ) alias
      on true
    where article.id::text =
          v_id
       or article_resource.resource_id::text =
          v_id
       or lower(
            article.slug
          ) =
          lower(
            coalesce(
              v_slug,
              v_id
            )
          )
    order by
      case
        when article.id::text =
             v_id
          then 0
        when article_resource.resource_id::text =
             v_id
          then 1
        else 2
      end
    limit 1;

    if canonical_id is null then
      raise exception
        'Article Save target does not exist'
        using errcode = 'P0002';
    end if;

    saveable :=
      (
        v_visibility = 'public'
        and v_lifecycle = 'published'
        and v_published_version is not null
      );

    return next;
    return;
  end if;

  if v_type = 'playlist' then
    select
      playlist.id::text,
      playlist.slug,
      coalesce(
        alias.path,
        '/playlists/' || playlist.slug
      ),
      resource.visibility,
      resource.lifecycle_state,
      playlist_resource.current_published_version_id
    into
      canonical_id,
      canonical_slug,
      canonical_url,
      v_visibility,
      v_lifecycle,
      v_published_version
    from editorial.playlist_resources
      playlist_resource
    join public.wk_playlists playlist
      on playlist.id =
         playlist_resource.playlist_id
    join editorial.resources resource
      on resource.id =
         playlist_resource.resource_id
     and resource.resource_kind =
         'playlist'
    left join lateral (
      select
        resource_alias.path
      from editorial.resource_aliases
        resource_alias
      where resource_alias.resource_id =
            playlist_resource.resource_id
        and resource_alias.is_canonical
        and resource_alias.retired_at
            is null
      order by
        resource_alias.created_at,
        resource_alias.path
      limit 1
    ) alias
      on true
    where playlist.id::text =
          v_id
       or playlist_resource.resource_id::text =
          v_id
       or lower(
            playlist.slug
          ) =
          lower(
            coalesce(
              v_slug,
              v_id
            )
          )
    order by
      case
        when playlist.id::text =
             v_id
          then 0
        when playlist_resource.resource_id::text =
             v_id
          then 1
        else 2
      end
    limit 1;

    if canonical_id is null then
      raise exception
        'Playlist Save target does not exist'
        using errcode = 'P0002';
    end if;

    saveable :=
      (
        v_visibility = 'public'
        and v_lifecycle = 'published'
        and v_published_version is not null
      );

    return next;
    return;
  end if;

  if v_type = 'track' then
    -- Track Saveability mirrors the public Track read contract. The public
    -- gateway intentionally serves Registry Tracks and Track/Artist links in
    -- active, needs_review, or draft state. Stable Registry UUID remains the
    -- only accepted identity; artist-scoped route is derived server-side.
    select
      track.id::text,
      track.slug,
      case
        when primary_artist.routable_primary_count = 1
         and track.slug is not null
          then '/tracks/'
               || primary_artist.artist_slug
               || '/'
               || track.slug
        else null
      end,
      track.status,
      primary_artist.artist_slug,
      primary_artist.routable_primary_count
    into
      canonical_id,
      canonical_slug,
      canonical_url,
      v_status,
      v_primary_artist_slug,
      v_primary_artist_count
    from public.registry_tracks track
    left join lateral (
      select
        count(*)::integer as routable_primary_count,
        min(link.artist_slug) as artist_slug
      from public.registry_track_artists link
      where link.track_id = track.id
        and link.status in (
          'active',
          'needs_review',
          'draft'
        )
        and link.is_primary is true
        and nullif(
              btrim(
                coalesce(
                  link.artist_slug,
                  ''
                )
              ),
              ''
            ) is not null
    ) primary_artist
      on true
    where track.id::text =
          v_id
    limit 1;

    if canonical_id is null then
      raise exception
        'Track Save target requires stable Registry Track identity'
        using errcode = 'P0002';
    end if;

    saveable :=
      (
        v_status in (
          'active',
          'needs_review',
          'draft'
        )
        and canonical_slug is not null
        and v_primary_artist_count = 1
        and v_primary_artist_slug is not null
        and canonical_url is not null
      );

    return next;
    return;
  end if;

  if v_type = 'release' then
    -- Release Saveability mirrors the public Release read contract: active
    -- Artist links may expose active or draft Registry Releases publicly.
    select
      release.id::text,
      release.slug,
      case
        when primary_artist.active_primary_count = 1
         and release.slug is not null
          then '/releases/'
               || primary_artist.artist_slug
               || '/'
               || release.slug
        else null
      end,
      release.status,
      primary_artist.artist_slug,
      primary_artist.active_primary_count
    into
      canonical_id,
      canonical_slug,
      canonical_url,
      v_status,
      v_primary_artist_slug,
      v_primary_artist_count
    from public.registry_releases release
    left join lateral (
      select
        count(*)::integer as active_primary_count,
        min(link.artist_slug) as artist_slug
      from public.registry_release_artists link
      where link.release_id = release.id
        and link.status = 'active'
        and link.is_primary is true
        and nullif(
              btrim(
                coalesce(
                  link.artist_slug,
                  ''
                )
              ),
              ''
            ) is not null
    ) primary_artist
      on true
    where release.id::text =
          v_id
    limit 1;

    if canonical_id is null then
      raise exception
        'Release Save target requires stable Registry Release identity'
        using errcode = 'P0002';
    end if;

    saveable :=
      (
        v_status in (
          'active',
          'draft'
        )
        and canonical_slug is not null
        and v_primary_artist_count = 1
        and v_primary_artist_slug is not null
        and canonical_url is not null
      );

    return next;
    return;
  end if;

  select
    edition.id,
    edition.edition_slug,
    '/charts/'
      || program.public_slug
      || '/'
      || edition.edition_slug,
    edition.status
  into
    canonical_id,
    canonical_slug,
    canonical_url,
    v_status
  from public.wk_chart_editions_v2 edition
  join public.wk_chart_programs_v2 program
    on program.id =
       edition.program_id
  where edition.id =
        v_id
  limit 1;

  if canonical_id is null then
    raise exception
      'Chart edition Save target does not exist'
      using errcode = 'P0002';
  end if;

  saveable :=
    v_status = 'published';

  return next;
end;
$function$;


revoke all on function
  private.community_resolve_save_target(
    text,
    text,
    text,
    text
  )
from public;

revoke execute on function
  private.community_resolve_save_target(
    text,
    text,
    text,
    text
  )
from anon, authenticated, service_role;


do $disable_activity_triggers$
declare
  trigger_record record;
begin
  for trigger_record in
    select
      namespace.nspname as schema_name,
      relation.relname as table_name,
      trigger_row.tgname as trigger_name
    from pg_trigger trigger_row
    join pg_proc procedure
      on procedure.oid =
         trigger_row.tgfoid
    join pg_class relation
      on relation.oid =
         trigger_row.tgrelid
    join pg_namespace namespace
      on namespace.oid =
         relation.relnamespace
    where not trigger_row.tgisinternal
      and namespace.nspname =
          'public'
      and (
        (
          relation.relname =
            'community_follows'
          and procedure.proname =
              'community_activity_on_follow'
        )
        or (
          relation.relname =
            'community_saves'
          and procedure.proname =
              'community_activity_on_save'
        )
      )
  loop
    execute format(
      'alter table %I.%I disable trigger %I',
      trigger_record.schema_name,
      trigger_record.table_name,
      trigger_record.trigger_name
    );
  end loop;
end;
$disable_activity_triggers$;


do $reconcile_legacy_article_follow$
declare
  v_follow public.community_follows%rowtype;
  v_article_id uuid;
  v_resource_id uuid;
  v_slug text;
  v_existing_save_id uuid;
  v_existing_save_created_at timestamptz;
  v_follow_activity_id uuid;
  v_existing_save_activity_id uuid;
begin
  select *
  into strict v_follow
  from public.community_follows
  where target_type =
        'article';

  select
    article_resource.article_id,
    article_resource.resource_id,
    article.slug
  into
    v_article_id,
    v_resource_id,
    v_slug
  from editorial.article_resources
    article_resource
  join public.wk_articles article
    on article.id =
       article_resource.article_id
  where article_resource.article_id::text =
        v_follow.target_id
     or article_resource.resource_id::text =
        v_follow.target_id
     or (
       v_follow.target_slug is not null
       and article.slug =
           v_follow.target_slug
     )
  order by
    case
      when article_resource.article_id::text =
           v_follow.target_id
        then 0
      when article_resource.resource_id::text =
           v_follow.target_id
        then 1
      else 2
    end
  limit 1;

  if v_article_id is null
     or v_resource_id is null
  then
    raise exception
      'STOP: Legacy Article Follow cannot be resolved for reconciliation';
  end if;

  select
    saved.id,
    saved.created_at
  into strict
    v_existing_save_id,
    v_existing_save_created_at
  from public.community_saves saved
  where saved.user_id =
        v_follow.user_id
    and saved.entity_type =
        'article'
    and (
      saved.entity_id =
        v_article_id::text
      or saved.entity_id =
         v_resource_id::text
      or saved.entity_id =
         v_follow.target_id
      or saved.entity_slug =
         v_slug
      or (
        v_follow.target_slug is not null
        and saved.entity_slug =
            v_follow.target_slug
      )
    );

  if v_existing_save_created_at >=
     v_follow.created_at
  then
    raise exception
      'STOP: Reviewed Article Save is not older than the redundant Article Follow';
  end if;

  select activity.id
  into strict v_existing_save_activity_id
  from public.community_activity activity
  where activity.user_id =
        v_follow.user_id
    and activity.activity_type =
        'save'
    and activity.entity_type =
        'article'
    and (
      activity.entity_id =
        v_article_id::text
      or activity.entity_id =
         v_resource_id::text
      or activity.entity_id =
         v_follow.target_id
      or activity.entity_slug =
         v_slug
      or (
        v_follow.target_slug is not null
        and activity.entity_slug =
            v_follow.target_slug
      )
    );

  select activity.id
  into strict v_follow_activity_id
  from public.community_activity activity
  where activity.user_id =
        v_follow.user_id
    and activity.activity_type =
        'follow'
    and activity.entity_type =
        'article'
    and activity.entity_id =
        v_follow.target_id
    and activity.entity_slug
        is not distinct from
        v_follow.target_slug
    and activity.created_at =
        v_follow.created_at;

  -- The content was already Saved before it was Followed.
  -- Preserve the existing Save and Save activity byte-for-byte.
  -- Remove only the later, now-invalid Follow semantics.
  delete from public.community_activity
  where id =
        v_follow_activity_id;

  delete from public.community_follows
  where id =
        v_follow.id;

  if not exists (
    select 1
    from public.community_saves saved
    where saved.id =
          v_existing_save_id
      and saved.created_at =
          v_existing_save_created_at
  ) then
    raise exception
      'STOP: Existing Article Save changed during redundant-Follow cleanup';
  end if;

  if not exists (
    select 1
    from public.community_activity activity
    where activity.id =
          v_existing_save_activity_id
      and activity.activity_type =
          'save'
  ) then
    raise exception
      'STOP: Existing Article Save activity changed during redundant-Follow cleanup';
  end if;
end;
$reconcile_legacy_article_follow$;


do $reconcile_pre_m1_save_identity$
declare
  v_saved public.community_saves%rowtype;
  v_candidate_count integer;
  v_track_id uuid;
  v_track_slug text;
  v_track_artist_slug text;
  v_primary_artist_count integer;
  v_canonical_url text;
  v_activity_count integer;
  v_conflict_count integer;
begin
  -- This Save came from the reviewed DEV-only draft Playlist interaction
  -- preview. Saving unpublished content is outside the M1 product contract.
  select *
  into strict v_saved
  from public.community_saves saved
  where saved.id =
        '0172f8cc-7d6f-4578-ac9c-cbe14d1ab3f9'::uuid
    and saved.entity_type = 'playlist'
    and saved.entity_id =
        '8b7808f6-4c6d-4d0a-965c-ff6b08e2ed57'
    and saved.entity_slug =
        'top-kenyan-songs-2026'
    and saved.created_at =
        '2026-08-09T15:28:28.992842+00:00'::timestamptz;

  select count(*)::integer
  into v_activity_count
  from public.community_activity activity
  where activity.user_id = v_saved.user_id
    and activity.activity_type = 'save'
    and activity.entity_type = v_saved.entity_type
    and activity.entity_id = v_saved.entity_id
    and activity.entity_slug
        is not distinct from
        v_saved.entity_slug
    and activity.created_at = v_saved.created_at;

  if v_activity_count <> 1 then
    raise exception
      'STOP: Draft Playlist preview Save activity no longer matches reviewed state';
  end if;

  delete from public.community_activity activity
  where activity.user_id = v_saved.user_id
    and activity.activity_type = 'save'
    and activity.entity_type = v_saved.entity_type
    and activity.entity_id = v_saved.entity_id
    and activity.entity_slug
        is not distinct from
        v_saved.entity_slug
    and activity.created_at = v_saved.created_at;

  delete from public.community_saves
  where id = v_saved.id;

  -- This Save came from the reviewed Phase 5B provider/player lab fixture and
  -- has no canonical Registry Track identity. Remove only that exact residue.
  select *
  into strict v_saved
  from public.community_saves saved
  where saved.id =
        '64ee2a95-6833-4f4e-8425-f8eb70c49b98'::uuid
    and saved.entity_type = 'track'
    and saved.entity_id = 'phase5b-youtube-twist'
    and saved.entity_slug = 'phase5b-youtube-twist'
    and saved.title = 'Twist'
    and saved.created_at =
        '2026-08-09T08:45:30.303398+00:00'::timestamptz;

  select count(*)::integer
  into v_activity_count
  from public.community_activity activity
  where activity.user_id = v_saved.user_id
    and activity.activity_type = 'save'
    and activity.entity_type = 'track'
    and activity.entity_id = v_saved.entity_id
    and activity.entity_slug
        is not distinct from
        v_saved.entity_slug
    and activity.created_at = v_saved.created_at;

  if v_activity_count <> 1 then
    raise exception
      'STOP: Provider/player lab Track Save activity no longer matches reviewed state';
  end if;

  delete from public.community_activity activity
  where activity.user_id = v_saved.user_id
    and activity.activity_type = 'save'
    and activity.entity_type = 'track'
    and activity.entity_id = v_saved.entity_id
    and activity.entity_slug
        is not distinct from
        v_saved.entity_slug
    and activity.created_at = v_saved.created_at;

  delete from public.community_saves
  where id = v_saved.id;

  -- Canonicalize every reviewed pre-Registry Track Save in place. The stored
  -- artist-scoped route is resolution evidence only. Track routability mirrors
  -- the public Track read contract: active, needs_review, and draft Registry
  -- Track/Artist rows are legitimate public route authority.
  for v_saved in
    select saved.*
    from public.community_saves saved
    where saved.entity_type = 'track'
      and saved.entity_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    order by saved.created_at, saved.id
  loop
    v_track_id := null;
    v_track_slug := null;
    v_track_artist_slug := null;
    v_primary_artist_count := 0;
    v_canonical_url := null;
    v_candidate_count := 0;
    v_conflict_count := 0;

    if v_saved.entity_url ~ '^/tracks/[^/]+/[^/#?]+$' then
      with candidate as (
        select distinct
          track.id,
          track.slug
        from public.registry_tracks track
        join public.registry_track_artists route_artist
          on route_artist.track_id = track.id
         and route_artist.status in (
           'active',
           'needs_review',
           'draft'
         )
         and route_artist.artist_slug =
             split_part(v_saved.entity_url, '/', 3)
        where track.status in (
                'active',
                'needs_review',
                'draft'
              )
          and track.slug = v_saved.entity_slug
      ), counted as (
        select count(*)::integer as candidate_count
        from candidate
      )
      select
        counted.candidate_count,
        candidate.id,
        candidate.slug
      into
        v_candidate_count,
        v_track_id,
        v_track_slug
      from counted
      left join candidate
        on counted.candidate_count = 1;

    elsif v_saved.entity_url ~ '^/releases/[^/]+/[^/]+/[^/#?]+$' then
      with candidate as (
        select distinct
          track.id,
          track.slug
        from public.registry_releases release
        join public.registry_release_artists route_artist
          on route_artist.release_id = release.id
         and route_artist.status = 'active'
         and route_artist.artist_slug =
             split_part(v_saved.entity_url, '/', 3)
        join public.registry_release_tracks release_track
          on release_track.release_id = release.id
         and release_track.status = 'active'
        join public.registry_tracks track
          on track.id = release_track.track_id
         and track.status in (
           'active',
           'needs_review',
           'draft'
         )
        where release.status in (
                'active',
                'draft'
              )
          and release.slug =
              split_part(v_saved.entity_url, '/', 4)
          and track.slug = v_saved.entity_slug
      ), counted as (
        select count(*)::integer as candidate_count
        from candidate
      )
      select
        counted.candidate_count,
        candidate.id,
        candidate.slug
      into
        v_candidate_count,
        v_track_id,
        v_track_slug
      from counted
      left join candidate
        on counted.candidate_count = 1;
    else
      raise exception
        'STOP: Legacy Track Save route is not an approved artist-scoped route: %',
        v_saved.entity_url;
    end if;

    if v_candidate_count <> 1
       or v_track_id is null
       or v_track_slug is null
    then
      raise exception
        'STOP: Legacy Track Save % resolves to % Registry candidates',
        v_saved.id,
        v_candidate_count;
    end if;

    select
      count(*)::integer,
      min(link.artist_slug)
    into
      v_primary_artist_count,
      v_track_artist_slug
    from public.registry_track_artists link
    where link.track_id = v_track_id
      and link.status in (
        'active',
        'needs_review',
        'draft'
      )
      and link.is_primary is true
      and nullif(
            btrim(
              coalesce(link.artist_slug, '')
            ),
            ''
          ) is not null;

    if v_primary_artist_count <> 1
       or v_track_artist_slug is null
    then
      raise exception
        'STOP: Resolved legacy Track Save % does not have exactly one routable primary Artist',
        v_saved.id;
    end if;

    v_canonical_url :=
      '/tracks/'
      || v_track_artist_slug
      || '/'
      || v_track_slug;

    select count(*)::integer
    into v_conflict_count
    from public.community_saves conflict
    where conflict.user_id = v_saved.user_id
      and conflict.entity_type = 'track'
      and conflict.entity_id = v_track_id::text
      and conflict.id <> v_saved.id;

    if v_conflict_count > 0 then
      -- The only reviewed canonical collision is Siaka. The July slug-backed
      -- Save is the older durable Save intent. The August UUID-backed Save was
      -- created only because identity drift made the same Track look unsaved.
      -- Keep the older Save row/timestamp and remove only the exact later
      -- duplicate Save plus its exact matching current-state Save activity.
      if v_saved.id <>
           '886f67eb-c766-4c98-9f61-681844b0b75b'::uuid
         or v_track_id <>
           '208e0284-93b8-43fd-991e-b17ffa624c4b'::uuid
         or v_conflict_count <> 1
      then
        raise exception
          'STOP: Legacy Track Save % conflicts with unreviewed canonical Save state',
          v_saved.id;
      end if;

      if not exists (
        select 1
        from public.community_saves conflict
        where conflict.id =
              '12d1eda5-dcb1-42e2-8665-e9998d370903'::uuid
          and conflict.user_id = v_saved.user_id
          and conflict.entity_type = 'track'
          and conflict.entity_id =
              '208e0284-93b8-43fd-991e-b17ffa624c4b'
          and conflict.entity_slug = 'siaka'
          and conflict.title = 'Siaka'
          and conflict.created_at =
              '2026-08-09T15:32:35.307328+00:00'::timestamptz
      ) then
        raise exception
          'STOP: Reviewed later Siaka duplicate Save changed';
      end if;

      if not exists (
        select 1
        from public.community_activity activity
        where activity.id =
              '55fc27af-6464-4bce-90d2-1f930d911158'::uuid
          and activity.user_id = v_saved.user_id
          and activity.activity_type = 'save'
          and activity.entity_type = 'track'
          and activity.entity_id =
              '208e0284-93b8-43fd-991e-b17ffa624c4b'
          and activity.entity_slug = 'siaka'
          and activity.created_at =
              '2026-08-09T15:32:35.307328+00:00'::timestamptz
      ) then
        raise exception
          'STOP: Reviewed later Siaka duplicate Save activity changed';
      end if;

      if not exists (
        select 1
        from public.community_activity activity
        where activity.id =
              '9fdd8e56-f8a4-45e7-a426-3baa9e207ab4'::uuid
          and activity.user_id = v_saved.user_id
          and activity.activity_type = 'save'
          and activity.entity_type = 'track'
          and activity.entity_id =
              '208e0284-93b8-43fd-991e-b17ffa624c4b'
          and activity.entity_slug = 'siaka'
          and activity.created_at =
              '2026-08-09T15:29:04.783231+00:00'::timestamptz
      ) then
        raise exception
          'STOP: Reviewed earlier canonical Siaka Save activity history changed';
      end if;

      delete from public.community_activity
      where id =
        '55fc27af-6464-4bce-90d2-1f930d911158'::uuid;

      delete from public.community_saves
      where id =
        '12d1eda5-dcb1-42e2-8665-e9998d370903'::uuid;
    end if;

    select count(*)::integer
    into v_activity_count
    from public.community_activity activity
    where activity.user_id = v_saved.user_id
      and activity.activity_type = 'save'
      and activity.entity_type = 'track'
      and activity.entity_id = v_saved.entity_id
      and activity.entity_slug
          is not distinct from
          v_saved.entity_slug
      and activity.created_at = v_saved.created_at;

    if v_activity_count <> 1 then
      raise exception
        'STOP: Legacy Track Save % does not have exactly one matching Save activity',
        v_saved.id;
    end if;

    update public.community_activity
    set
      entity_id = v_track_id::text,
      entity_slug = v_track_slug,
      metadata = jsonb_set(
        coalesce(metadata, '{}'::jsonb),
        '{entity_slug}',
        to_jsonb(v_track_slug),
        true
      )
    where user_id = v_saved.user_id
      and activity_type = 'save'
      and entity_type = 'track'
      and entity_id = v_saved.entity_id
      and entity_slug
          is not distinct from
          v_saved.entity_slug
      and created_at = v_saved.created_at;

    update public.community_saves
    set
      entity_id = v_track_id::text,
      entity_slug = v_track_slug,
      entity_url = v_canonical_url
    where id = v_saved.id;
  end loop;

  -- Canonicalize the return path of every surviving stable Track Save. This
  -- also moves Playlist-anchor saves back to the Track's durable public route.
  for v_saved in
    select saved.*
    from public.community_saves saved
    where saved.entity_type = 'track'
    order by saved.created_at, saved.id
  loop
    select
      target.canonical_slug,
      target.canonical_url
    into
      v_track_slug,
      v_canonical_url
    from private.community_resolve_save_target(
      'track',
      v_saved.entity_id,
      v_saved.entity_slug,
      v_saved.entity_url
    ) target
    where target.saveable;

    if v_track_slug is null
       or v_canonical_url is null
    then
      raise exception
        'STOP: Surviving Track Save % is not canonically saveable',
        v_saved.id;
    end if;

    update public.community_saves
    set
      entity_slug = v_track_slug,
      entity_url = v_canonical_url
    where id = v_saved.id;
  end loop;

  if exists (
    select 1
    from public.community_saves saved
    where saved.entity_type = 'track'
      and saved.entity_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ) then
    raise exception
      'STOP: Non-canonical Track Save identity survived reconciliation';
  end if;

  if (
    select count(*)
    from public.community_saves saved
    where saved.entity_type = 'track'
  ) <> 13 then
    raise exception
      'STOP: Expected exactly 13 surviving canonical Track Saves after reviewed reconciliation';
  end if;

  if not exists (
    select 1
    from public.community_saves saved
    where saved.id =
          'd35f5faf-6ff7-4ade-bc33-3cfe4d8ac750'::uuid
      and saved.entity_id =
          'b99137ed-bfa1-4256-995c-cca36ac6c3a1'
      and saved.entity_slug =
          'baddies-need-love'
      and saved.entity_url =
          '/tracks/maandy/baddies-need-love'
  ) then
    raise exception
      'STOP: Baddies Need Love legacy Save did not converge to reviewed Registry identity';
  end if;

  if not exists (
    select 1
    from public.community_saves saved
    where saved.id =
          'f1f6c5b3-7d71-4a5d-8d12-e90e0774aa50'::uuid
      and saved.entity_id =
          'cc3f0cf0-0f3d-4c79-ba34-7453065e5822'
      and saved.entity_slug =
          'aje'
      and saved.entity_url =
          '/tracks/kethan/aje'
  ) then
    raise exception
      'STOP: Aje legacy Save did not converge to reviewed Kethan Registry identity';
  end if;

  if not exists (
    select 1
    from public.community_saves saved
    where saved.id =
          '886f67eb-c766-4c98-9f61-681844b0b75b'::uuid
      and saved.entity_id =
          '208e0284-93b8-43fd-991e-b17ffa624c4b'
      and saved.entity_slug = 'siaka'
      and saved.entity_url =
          '/tracks/mejja/siaka'
      and saved.created_at =
          '2026-07-03T12:38:51.309431+00:00'::timestamptz
  ) then
    raise exception
      'STOP: Older Siaka Save intent was not preserved as canonical state';
  end if;

  if exists (
    select 1
    from public.community_saves saved
    where saved.id =
          '12d1eda5-dcb1-42e2-8665-e9998d370903'::uuid
  ) then
    raise exception
      'STOP: Later duplicate Siaka Save survived reconciliation';
  end if;

  if not exists (
    select 1
    from public.community_activity activity
    where activity.id =
          'e6b02a3c-a11d-4c23-8a01-3539538e8494'::uuid
      and activity.entity_id =
          '208e0284-93b8-43fd-991e-b17ffa624c4b'
      and activity.entity_slug = 'siaka'
      and activity.created_at =
          '2026-07-03T12:38:51.309431+00:00'::timestamptz
  ) then
    raise exception
      'STOP: Older Siaka Save activity was not canonicalized in place';
  end if;

  if exists (
    select 1
    from public.community_activity activity
    where activity.id =
          '55fc27af-6464-4bce-90d2-1f930d911158'::uuid
  ) then
    raise exception
      'STOP: Later duplicate Siaka Save activity survived reconciliation';
  end if;

  if not exists (
    select 1
    from public.community_activity activity
    where activity.id =
          '9fdd8e56-f8a4-45e7-a426-3baa9e207ab4'::uuid
      and activity.entity_id =
          '208e0284-93b8-43fd-991e-b17ffa624c4b'
      and activity.entity_slug = 'siaka'
      and activity.created_at =
          '2026-08-09T15:29:04.783231+00:00'::timestamptz
  ) then
    raise exception
      'STOP: Historical canonical Siaka Save activity was not preserved';
  end if;
end;
$reconcile_pre_m1_save_identity$;



do $enable_activity_triggers$
declare
  trigger_record record;
begin
  for trigger_record in
    select
      namespace.nspname as schema_name,
      relation.relname as table_name,
      trigger_row.tgname as trigger_name
    from pg_trigger trigger_row
    join pg_proc procedure
      on procedure.oid =
         trigger_row.tgfoid
    join pg_class relation
      on relation.oid =
         trigger_row.tgrelid
    join pg_namespace namespace
      on namespace.oid =
         relation.relnamespace
    where not trigger_row.tgisinternal
      and namespace.nspname =
          'public'
      and (
        (
          relation.relname =
            'community_follows'
          and procedure.proname =
              'community_activity_on_follow'
        )
        or (
          relation.relname =
            'community_saves'
          and procedure.proname =
              'community_activity_on_save'
        )
      )
  loop
    execute format(
      'alter table %I.%I enable trigger %I',
      trigger_record.schema_name,
      trigger_record.table_name,
      trigger_record.trigger_name
    );
  end loop;
end;
$enable_activity_triggers$;


alter table public.community_follows
  drop constraint if exists
    community_follows_target_type_capability_check;

alter table public.community_follows
  add constraint
    community_follows_target_type_capability_check
  check (
    target_type in (
      'person',
      'artist',
      'genre',
      'label',
      'chart_program'
    )
  )
  not valid;

alter table public.community_follows
  validate constraint
    community_follows_target_type_capability_check;


alter table public.community_saves
  drop constraint if exists
    community_saves_entity_type_capability_check;

alter table public.community_saves
  add constraint
    community_saves_entity_type_capability_check
  check (
    entity_type in (
      'article',
      'playlist',
      'track',
      'release',
      'chart_edition'
    )
  )
  not valid;

alter table public.community_saves
  validate constraint
    community_saves_entity_type_capability_check;


create or replace function
  public.community_set_follow_state(
    p_target_type text,
    p_target_id text,
    p_target_slug text,
    p_followed boolean
  )
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial',
  'private'
as $function$
declare
  v_user_id uuid :=
    auth.uid();
  v_followed boolean :=
    coalesce(
      p_followed,
      false
    );
  v_target record;
begin
  if v_user_id is null then
    raise exception
      'Not authenticated'
      using errcode = '42501';
  end if;

  select *
  into v_target
  from private.community_resolve_follow_target(
    p_target_type,
    p_target_id,
    p_target_slug
  );

  if v_followed
     and not v_target.followable
  then
    raise exception
      'Target is not publicly followable'
      using errcode = '22023';
  end if;

  if v_followed
     and v_target.canonical_type =
         'person'
     and exists (
       select 1
       from editorial.person_identity_links link
       where link.person_resource_id =
             v_target.canonical_id::uuid
         and link.link_state =
             'active'
         and link.user_id =
             v_user_id
     )
  then
    raise exception
      'A user cannot follow their own Person'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_user_id::text
      || '|follow|'
      || v_target.canonical_type
      || '|'
      || v_target.canonical_id,
      0
    )
  );

  if v_followed then
    insert into public.community_follows (
      user_id,
      target_type,
      target_id,
      target_slug
    )
    values (
      v_user_id,
      v_target.canonical_type,
      v_target.canonical_id,
      v_target.canonical_slug
    )
    on conflict (
      user_id,
      target_type,
      target_id
    )
    do update
    set target_slug =
      excluded.target_slug;
  else
    delete from public.community_follows
    where user_id =
          v_user_id
      and target_type =
          v_target.canonical_type
      and target_id =
          v_target.canonical_id;
  end if;

  return jsonb_build_object(
    'followed',
      v_followed,
    'target_type',
      v_target.canonical_type,
    'target_id',
      v_target.canonical_id,
    'target_slug',
      v_target.canonical_slug
  );
end;
$function$;


create or replace function
  public.community_follow_target(
    p_target_type text,
    p_target_id text,
    p_target_slug text default null
  )
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'private'
as $function$
declare
  v_user_id uuid :=
    auth.uid();
  v_target record;
  v_current boolean;
begin
  if v_user_id is null then
    raise exception
      'Not authenticated'
      using errcode = '42501';
  end if;

  select *
  into v_target
  from private.community_resolve_follow_target(
    p_target_type,
    p_target_id,
    p_target_slug
  );

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_user_id::text
      || '|follow|'
      || v_target.canonical_type
      || '|'
      || v_target.canonical_id,
      0
    )
  );

  select exists (
    select 1
    from public.community_follows follow
    where follow.user_id =
          v_user_id
      and follow.target_type =
          v_target.canonical_type
      and follow.target_id =
          v_target.canonical_id
  )
  into v_current;

  return public.community_set_follow_state(
    v_target.canonical_type,
    v_target.canonical_id,
    v_target.canonical_slug,
    not v_current
  );
end;
$function$;


create or replace function
  public.community_set_saved_state(
    p_entity_type text,
    p_entity_id text,
    p_entity_slug text,
    p_entity_url text,
    p_title text,
    p_subtitle text,
    p_image_url text,
    p_saved boolean
  )
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'private'
as $function$
declare
  v_user_id uuid :=
    auth.uid();
  v_saved boolean :=
    coalesce(
      p_saved,
      false
    );
  v_title text :=
    nullif(
      btrim(
        coalesce(
          p_title,
          ''
        )
      ),
      ''
    );
  v_subtitle text :=
    nullif(
      btrim(
        coalesce(
          p_subtitle,
          ''
        )
      ),
      ''
    );
  v_image_url text :=
    nullif(
      btrim(
        coalesce(
          p_image_url,
          ''
        )
      ),
      ''
    );
  v_target record;
begin
  if v_user_id is null then
    raise exception
      'Not authenticated'
      using errcode = '42501';
  end if;

  select *
  into v_target
  from private.community_resolve_save_target(
    p_entity_type,
    p_entity_id,
    p_entity_slug,
    p_entity_url
  );

  if v_saved
     and not v_target.saveable
  then
    raise exception
      'Target is not publicly saveable'
      using errcode = '22023';
  end if;

  if v_saved
     and v_title is null
  then
    raise exception
      'Title is required when saving'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_user_id::text
      || '|save|'
      || v_target.canonical_type
      || '|'
      || v_target.canonical_id,
      0
    )
  );

  if v_saved then
    insert into public.community_saves (
      user_id,
      entity_type,
      entity_id,
      entity_slug,
      entity_url,
      title,
      subtitle,
      image_url
    )
    values (
      v_user_id,
      v_target.canonical_type,
      v_target.canonical_id,
      v_target.canonical_slug,
      coalesce(
        v_target.canonical_url,
        nullif(
          btrim(
            coalesce(
              p_entity_url,
              ''
            )
          ),
          ''
        )
      ),
      v_title,
      v_subtitle,
      v_image_url
    )
    on conflict (
      user_id,
      entity_type,
      entity_id
    )
    do update
    set
      entity_slug =
        excluded.entity_slug,
      entity_url =
        excluded.entity_url,
      title =
        excluded.title,
      subtitle =
        excluded.subtitle,
      image_url =
        excluded.image_url;
  else
    delete from public.community_saves
    where user_id =
          v_user_id
      and entity_type =
          v_target.canonical_type
      and entity_id =
          v_target.canonical_id;
  end if;

  return jsonb_build_object(
    'saved',
      v_saved,
    'entity_type',
      v_target.canonical_type,
    'entity_id',
      v_target.canonical_id,
    'entity_slug',
      v_target.canonical_slug,
    'entity_url',
      v_target.canonical_url
  );
end;
$function$;


create or replace function
  public.community_save_entity(
    p_entity_type text,
    p_entity_id text default null,
    p_entity_slug text default null,
    p_entity_url text default null,
    p_title text default null,
    p_subtitle text default null,
    p_image_url text default null
  )
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'private'
as $function$
declare
  v_user_id uuid :=
    auth.uid();
  v_title text :=
    nullif(
      btrim(
        coalesce(
          p_title,
          ''
        )
      ),
      ''
    );
  v_subtitle text :=
    nullif(
      btrim(
        coalesce(
          p_subtitle,
          ''
        )
      ),
      ''
    );
  v_image_url text :=
    nullif(
      btrim(
        coalesce(
          p_image_url,
          ''
        )
      ),
      ''
    );
  v_target record;
  v_save public.community_saves%rowtype;
begin
  if v_user_id is null then
    raise exception
      'Not authenticated'
      using errcode = '42501';
  end if;

  if v_title is null then
    raise exception
      'Title is required'
      using errcode = '22023';
  end if;

  select *
  into v_target
  from private.community_resolve_save_target(
    p_entity_type,
    p_entity_id,
    p_entity_slug,
    p_entity_url
  );

  if not v_target.saveable then
    raise exception
      'Target is not publicly saveable'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_user_id::text
      || '|save|'
      || v_target.canonical_type
      || '|'
      || v_target.canonical_id,
      0
    )
  );

  select *
  into v_save
  from public.community_saves saved
  where saved.user_id =
        v_user_id
    and saved.entity_type =
        v_target.canonical_type
    and (
      saved.entity_id =
        v_target.canonical_id
      or (
        v_target.canonical_type not in (
          'track',
          'release'
        )
        and v_target.canonical_slug is not null
        and saved.entity_slug =
            v_target.canonical_slug
      )
      or (
        v_target.canonical_url is not null
        and saved.entity_url =
            v_target.canonical_url
      )
    )
  order by
    saved.created_at,
    saved.id
  limit 1;

  if found then
    update public.community_saves
    set
      entity_id =
        v_target.canonical_id,
      entity_slug =
        v_target.canonical_slug,
      entity_url =
        coalesce(
          v_target.canonical_url,
          entity_url
        ),
      title =
        v_title,
      subtitle =
        v_subtitle,
      image_url =
        v_image_url
    where id =
          v_save.id
    returning *
    into v_save;

    return jsonb_build_object(
      'saved',
        true,
      'existing',
        true,
      'save',
        to_jsonb(
          v_save
        )
    );
  end if;

  insert into public.community_saves (
    user_id,
    entity_type,
    entity_id,
    entity_slug,
    entity_url,
    title,
    subtitle,
    image_url
  )
  values (
    v_user_id,
    v_target.canonical_type,
    v_target.canonical_id,
    v_target.canonical_slug,
    coalesce(
      v_target.canonical_url,
      nullif(
        btrim(
          coalesce(
            p_entity_url,
            ''
          )
        ),
        ''
      )
    ),
    v_title,
    v_subtitle,
    v_image_url
  )
  returning *
  into v_save;

  return jsonb_build_object(
    'saved',
      true,
    'existing',
      false,
    'save',
      to_jsonb(
        v_save
      )
  );
end;
$function$;


revoke all on function
  public.community_set_follow_state(
    text,
    text,
    text,
    boolean
  )
from public;

revoke all on function
  public.community_follow_target(
    text,
    text,
    text
  )
from public;

revoke all on function
  public.community_set_saved_state(
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    boolean
  )
from public;

revoke all on function
  public.community_save_entity(
    text,
    text,
    text,
    text,
    text,
    text,
    text
  )
from public;

revoke execute on function
  public.community_set_follow_state(
    text,
    text,
    text,
    boolean
  )
from anon;

revoke execute on function
  public.community_follow_target(
    text,
    text,
    text
  )
from anon;

revoke execute on function
  public.community_set_saved_state(
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    boolean
  )
from anon;

revoke execute on function
  public.community_save_entity(
    text,
    text,
    text,
    text,
    text,
    text,
    text
  )
from anon;

grant execute on function
  public.community_set_follow_state(
    text,
    text,
    text,
    boolean
  )
to authenticated;

grant execute on function
  public.community_follow_target(
    text,
    text,
    text
  )
to authenticated;

grant execute on function
  public.community_set_saved_state(
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    boolean
  )
to authenticated;

grant execute on function
  public.community_save_entity(
    text,
    text,
    text,
    text,
    text,
    text,
    text
  )
to authenticated;


do $follow_save_m1_postflight$
declare
  v_follow_trigger_count integer;
  v_save_trigger_count integer;
begin
  if exists (
    select 1
    from public.community_follows
    where target_type not in (
      'person',
      'artist',
      'genre',
      'label',
      'chart_program'
    )
  ) then
    raise exception
      'STOP: Unsupported Follow target survived M1';
  end if;

  if exists (
    select 1
    from public.community_saves
    where entity_type not in (
      'article',
      'playlist',
      'track',
      'release',
      'chart_edition'
    )
  ) then
    raise exception
      'STOP: Unsupported Save target survived M1';
  end if;

  if position(
       'field_guide'
       in pg_get_functiondef(
         'private.community_resolve_save_target(text,text,text,text)'::regprocedure
       )
     ) > 0
  then
    raise exception
      'STOP: Guide Save execution leaked into M1 resolver authority';
  end if;

  if exists (
    select 1
    from public.community_follows
    where target_type =
          'article'
  ) then
    raise exception
      'STOP: Legacy Article Follow survived M1 reconciliation';
  end if;

  if (
    select count(*)
    from public.community_saves
    where entity_type =
          'article'
  ) < 1 then
    raise exception
      'STOP: M1 did not preserve the legacy Article relationship as a Save';
  end if;

  select count(*)::integer
  into v_follow_trigger_count
  from pg_trigger trigger_row
  join pg_proc procedure
    on procedure.oid =
       trigger_row.tgfoid
  join pg_class relation
    on relation.oid =
       trigger_row.tgrelid
  join pg_namespace namespace
    on namespace.oid =
       relation.relnamespace
  where not trigger_row.tgisinternal
    and namespace.nspname =
        'public'
    and relation.relname =
        'community_follows'
    and procedure.proname =
        'community_activity_on_follow'
    and trigger_row.tgenabled =
        'O';

  select count(*)::integer
  into v_save_trigger_count
  from pg_trigger trigger_row
  join pg_proc procedure
    on procedure.oid =
       trigger_row.tgfoid
  join pg_class relation
    on relation.oid =
       trigger_row.tgrelid
  join pg_namespace namespace
    on namespace.oid =
       relation.relnamespace
  where not trigger_row.tgisinternal
    and namespace.nspname =
        'public'
    and relation.relname =
        'community_saves'
    and procedure.proname =
        'community_activity_on_save'
    and trigger_row.tgenabled =
        'O';

  if v_follow_trigger_count <> 1
     or v_save_trigger_count <> 1
  then
    raise exception
      'STOP: Follow/Save activity triggers were not restored after reconciliation';
  end if;

  if has_function_privilege(
       'anon',
       'public.community_set_follow_state(text,text,text,boolean)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.community_follow_target(text,text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.community_set_saved_state(text,text,text,text,text,text,text,boolean)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.community_save_entity(text,text,text,text,text,text,text)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: Anonymous Follow/Save command execution is open';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.community_set_follow_state(text,text,text,boolean)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.community_follow_target(text,text,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.community_set_saved_state(text,text,text,text,text,text,text,boolean)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.community_save_entity(text,text,text,text,text,text,text)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: Authenticated Follow/Save command execution is missing';
  end if;

  if has_function_privilege(
       'authenticated',
       'private.community_resolve_follow_target(text,text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'private.community_resolve_save_target(text,text,text,text)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: Internal Follow/Save resolvers are browser-executable';
  end if;
end;
$follow_save_m1_postflight$;


commit;
