-- Phase 6B M2: shared Show identity, Show Episode identity, and Audio RSS.
--
-- Public Show identity is cross-media. Audio is the first real consumer.
-- Audio publication/version, Media, Trust, Review, Season organization, and
-- enclosure delivery remain Audio-domain authority.
--
-- Canonical public paths:
--   /shows/:showSlug
--   /shows/:showSlug/:episodeSlug
--   /shows/:showSlug/feed.xml
--   /audio/:slug                    Standalone Audio only
--
-- The existing M1 Audio resolver remains the exact Audio safety projection.
-- Show resolvers wrap that projection rather than rebuilding it.

begin;

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'phase-6b-m2-shared-show-hierarchy-rss',
    0
  )
);

-- ---------------------------------------------------------------------------
-- Shared Show and Show Episode Resource identity.
-- ---------------------------------------------------------------------------

insert into editorial.resource_kinds (
  kind,
  label,
  description,
  enabled
)
values
  (
    'show',
    'Show',
    'Stable cross-media Show identity. Audio is the first consumer; future media verticals must bind to this identity instead of creating a competing Show.',
    true
  ),
  (
    'show_episode',
    'Show Episode',
    'Stable child identity inside a Show. Audio is the first rendition consumer; future media verticals may bind to the same Episode identity.',
    true
  );

create table editorial.shows (
  resource_id uuid primary key,
  resource_kind text not null default 'show'
    check (resource_kind = 'show'),
  slug text not null unique
    check (
      length(slug) between 1 and 200
      and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    ),
  title text not null
    check (length(title) between 1 and 300),
  description text
    check (length(coalesce(description, '')) <= 20000),
  authority_revision bigint not null default 1
    check (authority_revision >= 1),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shows_resource_fkey
    foreign key (resource_id, resource_kind)
    references editorial.resources(id, resource_kind)
    on update cascade
    on delete cascade
);

create table editorial.show_episodes (
  resource_id uuid primary key,
  resource_kind text not null default 'show_episode'
    check (resource_kind = 'show_episode'),
  show_resource_id uuid not null
    references editorial.shows(resource_id)
    on update cascade
    on delete restrict,
  slug text not null
    check (
      length(slug) between 1 and 200
      and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    ),
  title text not null
    check (length(title) between 1 and 300),
  summary text
    check (length(coalesce(summary, '')) <= 30000),
  episode_number integer
    check (
      episode_number is null
      or (
        episode_number >= 0
        and episode_number <= 100000
      )
    ),
  authority_revision bigint not null default 1
    check (authority_revision >= 1),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (show_resource_id, slug),
  unique (resource_id, show_resource_id),
  constraint show_episodes_resource_fkey
    foreign key (resource_id, resource_kind)
    references editorial.resources(id, resource_kind)
    on update cascade
    on delete cascade
);

create table editorial.audio_show_shared_links (
  audio_show_id uuid primary key
    references audio.shows(id)
    on update cascade
    on delete restrict,
  show_resource_id uuid not null unique
    references editorial.shows(resource_id)
    on update cascade
    on delete restrict,
  created_at timestamptz not null default now()
);

create table editorial.audio_episode_shared_links (
  audio_publication_id uuid primary key
    references audio.publications(id)
    on update cascade
    on delete restrict,
  show_episode_resource_id uuid not null unique
    references editorial.show_episodes(resource_id)
    on update cascade
    on delete restrict,
  created_at timestamptz not null default now()
);

create index show_episodes_show_resource_id_idx
  on editorial.show_episodes(show_resource_id, resource_id);

alter table editorial.shows enable row level security;
alter table editorial.show_episodes enable row level security;
alter table editorial.audio_show_shared_links enable row level security;
alter table editorial.audio_episode_shared_links enable row level security;

revoke all
  on editorial.shows,
     editorial.show_episodes,
     editorial.audio_show_shared_links,
     editorial.audio_episode_shared_links
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Extend exact current Resource binding integrity.
-- ---------------------------------------------------------------------------

create or replace function editorial.assert_resource_binding_integrity()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'editorial', 'audio'
as $function$
declare
  target_resource_id uuid;
  target_kind text;
  binding_count integer;
begin
  if tg_table_name = 'resources' then
    if tg_op = 'DELETE' then
      return null;
    end if;
    target_resource_id := new.id;
  else
    if tg_op = 'DELETE' then
      target_resource_id := old.resource_id;
    else
      target_resource_id := new.resource_id;
    end if;
  end if;

  select resource_kind
  into target_kind
  from editorial.resources
  where id = target_resource_id;

  if not found then
    return null;
  end if;

  case target_kind
    when 'article' then
      select count(*) into binding_count
      from editorial.article_resources
      where resource_id = target_resource_id;
    when 'playlist' then
      select count(*) into binding_count
      from editorial.playlist_resources
      where resource_id = target_resource_id;
    when 'playlist_item' then
      select count(*) into binding_count
      from editorial.playlist_item_resources
      where resource_id = target_resource_id;
    when 'registry_artist' then
      select count(*) into binding_count
      from editorial.registry_artist_resources
      where resource_id = target_resource_id;
    when 'correction_case' then
      select count(*) into binding_count
      from editorial.correction_cases
      where resource_id = target_resource_id;
    when 'media_asset' then
      select count(*) into binding_count
      from editorial.media_asset_resources
      where resource_id = target_resource_id;
    when 'person' then
      select count(*) into binding_count
      from editorial.people
      where resource_id = target_resource_id;
    when 'organization' then
      select count(*) into binding_count
      from editorial.organizations
      where resource_id = target_resource_id;
    when 'audio_show' then
      select count(*) into binding_count
      from editorial.audio_show_resources
      where resource_id = target_resource_id;
    when 'audio_season' then
      select count(*) into binding_count
      from editorial.audio_season_resources
      where resource_id = target_resource_id;
    when 'audio_episode' then
      select count(*) into binding_count
      from editorial.audio_publication_resources
      where resource_id = target_resource_id
        and resource_kind = 'audio_episode';
    when 'standalone_audio' then
      select count(*) into binding_count
      from editorial.audio_publication_resources
      where resource_id = target_resource_id
        and resource_kind = 'standalone_audio';
    when 'show' then
      select count(*) into binding_count
      from editorial.shows
      where resource_id = target_resource_id;
    when 'show_episode' then
      select count(*) into binding_count
      from editorial.show_episodes
      where resource_id = target_resource_id;
    else
      raise exception
        'Unsupported resource kind: %',
        target_kind;
  end case;

  if binding_count <> 1 then
    raise exception
      'Resource % with kind % must have exactly one typed binding.',
      target_resource_id,
      target_kind;
  end if;

  return null;
end;
$function$;

create constraint trigger shows_binding_integrity
after insert or update or delete
on editorial.shows
deferrable initially deferred
for each row
execute function editorial.assert_resource_binding_integrity();

create constraint trigger show_episodes_binding_integrity
after insert or update or delete
on editorial.show_episodes
deferrable initially deferred
for each row
execute function editorial.assert_resource_binding_integrity();

-- ---------------------------------------------------------------------------
-- Audio consumer adapters into shared Show identity.
-- Existing governed Audio commands remain the first writer.
-- ---------------------------------------------------------------------------

create or replace function editorial.ensure_audio_show_shared_identity(
  p_audio_show_id uuid
)
returns uuid
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'editorial',
  'audio',
  'extensions'
as $function$
declare
  v_audio_show audio.shows%rowtype;
  v_audio_resource editorial.resources%rowtype;
  v_show_resource_id uuid;
  v_shared_resource editorial.resources%rowtype;
  v_shared_show editorial.shows%rowtype;
begin
  if p_audio_show_id is null then
    raise exception 'Audio Show id is required.';
  end if;

  select show_row.*
  into v_audio_show
  from audio.shows show_row
  where show_row.id = p_audio_show_id;

  if not found then
    raise exception 'Audio Show does not exist.';
  end if;

  select resource_row.*
  into v_audio_resource
  from editorial.resources resource_row
  where resource_row.id = p_audio_show_id
    and resource_row.resource_kind = 'audio_show';

  if not found then
    raise exception 'Audio Show Resource identity is missing.';
  end if;

  select link.show_resource_id
  into v_show_resource_id
  from editorial.audio_show_shared_links link
  where link.audio_show_id = p_audio_show_id;

  if not found then
    v_show_resource_id := extensions.gen_random_uuid();

    insert into editorial.resources (
      id,
      resource_kind,
      owner_id,
      visibility,
      lifecycle_state,
      created_by,
      created_at,
      updated_at
    )
    values (
      v_show_resource_id,
      'show',
      v_audio_resource.owner_id,
      v_audio_resource.visibility,
      'active',
      coalesce(v_audio_show.created_by, v_audio_resource.created_by),
      v_audio_show.created_at,
      v_audio_show.updated_at
    );

    insert into editorial.shows (
      resource_id,
      resource_kind,
      slug,
      title,
      description,
      authority_revision,
      created_by,
      updated_by,
      created_at,
      updated_at
    )
    values (
      v_show_resource_id,
      'show',
      v_audio_show.slug,
      v_audio_show.title,
      v_audio_show.description,
      v_audio_show.authority_revision,
      v_audio_show.created_by,
      v_audio_show.updated_by,
      v_audio_show.created_at,
      v_audio_show.updated_at
    );

    insert into editorial.audio_show_shared_links (
      audio_show_id,
      show_resource_id
    )
    values (
      p_audio_show_id,
      v_show_resource_id
    );

    return v_show_resource_id;
  end if;

  select resource_row.*
  into v_shared_resource
  from editorial.resources resource_row
  where resource_row.id = v_show_resource_id
    and resource_row.resource_kind = 'show';

  select show_row.*
  into v_shared_show
  from editorial.shows show_row
  where show_row.resource_id = v_show_resource_id;

  if v_shared_resource.id is null
     or v_shared_show.resource_id is null
  then
    raise exception 'Shared Show identity binding is incomplete.';
  end if;

  if v_shared_show.slug <> v_audio_show.slug
     and exists (
       select 1
       from audio.publications publication
       where publication.show_id = p_audio_show_id
         and publication.publication_kind = 'episode'
         and exists (
           select 1
           from audio.publication_snapshots snapshot
           where snapshot.publication_id = publication.id
         )
     )
  then
    raise exception
      'Published Show slug is immutable until governed redirect support exists.';
  end if;

  update editorial.shows show_row
  set
    slug = v_audio_show.slug,
    title = v_audio_show.title,
    description = v_audio_show.description,
    authority_revision = v_audio_show.authority_revision,
    updated_by = v_audio_show.updated_by,
    updated_at = v_audio_show.updated_at
  where show_row.resource_id = v_show_resource_id;

  update editorial.resources resource_row
  set
    owner_id = v_audio_resource.owner_id,
    visibility = v_audio_resource.visibility,
    updated_at = greatest(
      resource_row.updated_at,
      v_audio_resource.updated_at
    )
  where resource_row.id = v_show_resource_id;

  return v_show_resource_id;
end;
$function$;

revoke execute
  on function editorial.ensure_audio_show_shared_identity(uuid)
  from public, anon, authenticated, service_role;

create or replace function editorial.ensure_audio_episode_shared_identity(
  p_audio_publication_id uuid
)
returns uuid
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'editorial',
  'audio',
  'extensions'
as $function$
declare
  v_publication audio.publications%rowtype;
  v_audio_resource editorial.resources%rowtype;
  v_show_resource_id uuid;
  v_episode_resource_id uuid;
  v_shared_resource editorial.resources%rowtype;
  v_shared_episode editorial.show_episodes%rowtype;
begin
  if p_audio_publication_id is null then
    raise exception 'Audio publication id is required.';
  end if;

  select publication.*
  into v_publication
  from audio.publications publication
  where publication.id = p_audio_publication_id;

  if not found then
    raise exception 'Audio publication does not exist.';
  end if;

  if v_publication.publication_kind <> 'episode' then
    return null;
  end if;

  if v_publication.show_id is null then
    raise exception 'Audio Episode requires a Show.';
  end if;

  select resource_row.*
  into v_audio_resource
  from editorial.resources resource_row
  where resource_row.id = p_audio_publication_id
    and resource_row.resource_kind = 'audio_episode';

  if not found then
    raise exception 'Audio Episode Resource identity is missing.';
  end if;

  v_show_resource_id :=
    editorial.ensure_audio_show_shared_identity(
      v_publication.show_id
    );

  select link.show_episode_resource_id
  into v_episode_resource_id
  from editorial.audio_episode_shared_links link
  where link.audio_publication_id = p_audio_publication_id;

  if not found then
    v_episode_resource_id := extensions.gen_random_uuid();

    insert into editorial.resources (
      id,
      resource_kind,
      owner_id,
      visibility,
      lifecycle_state,
      created_by,
      created_at,
      updated_at
    )
    values (
      v_episode_resource_id,
      'show_episode',
      v_audio_resource.owner_id,
      v_audio_resource.visibility,
      'active',
      coalesce(v_publication.created_by, v_audio_resource.created_by),
      v_publication.created_at,
      v_publication.updated_at
    );

    insert into editorial.show_episodes (
      resource_id,
      resource_kind,
      show_resource_id,
      slug,
      title,
      summary,
      episode_number,
      authority_revision,
      created_by,
      updated_by,
      created_at,
      updated_at
    )
    values (
      v_episode_resource_id,
      'show_episode',
      v_show_resource_id,
      v_publication.slug,
      v_publication.title,
      v_publication.summary,
      v_publication.episode_number,
      v_publication.authority_revision,
      v_publication.created_by,
      v_publication.updated_by,
      v_publication.created_at,
      v_publication.updated_at
    );

    insert into editorial.audio_episode_shared_links (
      audio_publication_id,
      show_episode_resource_id
    )
    values (
      p_audio_publication_id,
      v_episode_resource_id
    );

    return v_episode_resource_id;
  end if;

  select resource_row.*
  into v_shared_resource
  from editorial.resources resource_row
  where resource_row.id = v_episode_resource_id
    and resource_row.resource_kind = 'show_episode';

  select episode_row.*
  into v_shared_episode
  from editorial.show_episodes episode_row
  where episode_row.resource_id = v_episode_resource_id;

  if v_shared_resource.id is null
     or v_shared_episode.resource_id is null
     or v_shared_episode.show_resource_id <> v_show_resource_id
  then
    raise exception 'Shared Show Episode identity binding is incomplete.';
  end if;

  if v_shared_episode.slug <> v_publication.slug
     and exists (
       select 1
       from audio.publication_snapshots snapshot
       where snapshot.publication_id = p_audio_publication_id
     )
  then
    raise exception
      'Published Show Episode slug is immutable until governed redirect support exists.';
  end if;

  update editorial.show_episodes episode_row
  set
    slug = v_publication.slug,
    title = v_publication.title,
    summary = v_publication.summary,
    episode_number = v_publication.episode_number,
    authority_revision = v_publication.authority_revision,
    updated_by = v_publication.updated_by,
    updated_at = v_publication.updated_at
  where episode_row.resource_id = v_episode_resource_id;

  update editorial.resources resource_row
  set
    owner_id = v_audio_resource.owner_id,
    visibility = v_audio_resource.visibility,
    updated_at = greatest(
      resource_row.updated_at,
      v_audio_resource.updated_at
    )
  where resource_row.id = v_episode_resource_id;

  return v_episode_resource_id;
end;
$function$;

revoke execute
  on function editorial.ensure_audio_episode_shared_identity(uuid)
  from public, anon, authenticated, service_role;

create or replace function editorial.sync_audio_show_shared_identity()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'editorial'
as $function$
begin
  perform editorial.ensure_audio_show_shared_identity(new.id);
  return new;
end;
$function$;

revoke execute
  on function editorial.sync_audio_show_shared_identity()
  from public, anon, authenticated, service_role;

create trigger audio_show_shared_identity_sync
after insert or update of slug, title, description, authority_revision
on audio.shows
for each row
execute function editorial.sync_audio_show_shared_identity();

create or replace function editorial.sync_audio_episode_shared_identity()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'editorial'
as $function$
begin
  if new.publication_kind = 'episode' then
    perform editorial.ensure_audio_episode_shared_identity(new.id);
  end if;
  return new;
end;
$function$;

revoke execute
  on function editorial.sync_audio_episode_shared_identity()
  from public, anon, authenticated, service_role;

create trigger audio_episode_shared_identity_sync
after insert or update of slug, title, summary, episode_number, authority_revision
on audio.publications
for each row
when (new.publication_kind = 'episode')
execute function editorial.sync_audio_episode_shared_identity();

create or replace function editorial.sync_audio_resource_shared_visibility()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'editorial'
as $function$
begin
  if new.resource_kind = 'audio_show' then
    perform editorial.ensure_audio_show_shared_identity(new.id);
  elsif new.resource_kind = 'audio_episode' then
    perform editorial.ensure_audio_episode_shared_identity(new.id);
  end if;
  return new;
end;
$function$;

revoke execute
  on function editorial.sync_audio_resource_shared_visibility()
  from public, anon, authenticated, service_role;

create trigger audio_resource_shared_visibility_sync
after update of owner_id, visibility
on editorial.resources
for each row
when (new.resource_kind in ('audio_show', 'audio_episode'))
execute function editorial.sync_audio_resource_shared_visibility();

-- Backfill any pre-existing governed episodic identity. Production currently
-- has none, but replay and long-lived development targets remain supported.
do $backfill$
declare
  v_id uuid;
begin
  for v_id in
    select show_row.id
    from audio.shows show_row
    order by show_row.id
  loop
    perform editorial.ensure_audio_show_shared_identity(v_id);
  end loop;

  for v_id in
    select publication.id
    from audio.publications publication
    where publication.publication_kind = 'episode'
    order by publication.id
  loop
    perform editorial.ensure_audio_episode_shared_identity(v_id);
  end loop;
end;
$backfill$;

-- ---------------------------------------------------------------------------
-- Publication invariant: a published Audio Episode makes its parent Audio
-- Show/Season public. Shared Show visibility follows the Audio Show Resource
-- through the synchronization trigger above.
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
      'Published Audio Episode requires a Show identity.';
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
      'Published Audio Episode requires an active typed Audio Show Resource.';
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
        'Published Audio Episode requires an active typed Audio Season Resource belonging to its Show.';
    end if;
  end if;

  perform editorial.ensure_audio_episode_shared_identity(new.id);
  return new;
end;
$function$;

revoke execute
  on function audio.ensure_published_episode_parent_visibility()
  from public, anon, authenticated, service_role;

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

-- ---------------------------------------------------------------------------
-- Shared public Show Episode projection.
-- The nested Audio value always comes from the exact M1 safety resolver.
-- ---------------------------------------------------------------------------

create or replace function public.get_public_show_episode(
  p_show_slug text,
  p_episode_slug text
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'editorial', 'audio'
as $function$
declare
  v_show_slug text := nullif(btrim(p_show_slug), '');
  v_episode_slug text := nullif(btrim(p_episode_slug), '');
  v_show editorial.shows%rowtype;
  v_episode editorial.show_episodes%rowtype;
  v_audio_publication audio.publications%rowtype;
  v_audio jsonb;
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

  select publication.*
  into v_audio_publication
  from editorial.audio_episode_shared_links episode_link
  join audio.publications publication
    on publication.id = episode_link.audio_publication_id
   and publication.publication_kind = 'episode'
   and publication.status = 'published'
  join editorial.audio_show_shared_links show_link
    on show_link.audio_show_id = publication.show_id
   and show_link.show_resource_id = v_show.resource_id
  where episode_link.show_episode_resource_id = v_episode.resource_id
  limit 1;

  if not found then
    return null;
  end if;

  v_audio :=
    public.get_public_audio_publication(
      v_audio_publication.slug
    );

  if v_audio is null
     or v_audio ->> 'publication_kind' <> 'episode'
     or v_audio ->> 'publication_id' <> v_audio_publication.id::text
  then
    return null;
  end if;

  v_canonical_path :=
    '/shows/' || v_show.slug || '/' || v_episode.slug;

  v_audio := jsonb_set(
    v_audio,
    '{canonical_path}',
    to_jsonb(v_canonical_path),
    true
  );

  v_audio := jsonb_set(
    v_audio,
    '{show}',
    jsonb_build_object(
      'id', v_show.resource_id,
      'resource_id', v_show.resource_id,
      'slug', v_show.slug,
      'title', v_show.title,
      'description', v_show.description
    ),
    true
  );

  return jsonb_build_object(
    'episode', jsonb_build_object(
      'resource_id', v_episode.resource_id,
      'show_resource_id', v_show.resource_id,
      'slug', v_episode.slug,
      'canonical_path', v_canonical_path,
      'title', v_audio ->> 'title',
      'summary', v_audio ->> 'summary',
      'episode_number', v_audio -> 'episode_number'
    ),
    'audio', v_audio
  );
end;
$function$;

revoke all
  on function public.get_public_show_episode(text, text)
  from public;

grant execute
  on function public.get_public_show_episode(text, text)
  to anon, authenticated;

create or replace function public.get_public_show(
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
  v_show editorial.shows%rowtype;
  v_audio_show_id uuid;
  v_episodes jsonb := '[]'::jsonb;
  v_seasons jsonb := '[]'::jsonb;
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

  select link.audio_show_id
  into v_audio_show_id
  from editorial.audio_show_shared_links link
  where link.show_resource_id = v_show.resource_id;

  if not found then
    return null;
  end if;

  select coalesce(
    jsonb_agg(
      resolved.payload
      order by
        coalesce(
          nullif(
            resolved.payload #>> '{audio,provenance,published_at}',
            ''
          )::timestamptz,
          '-infinity'::timestamptz
        ) desc,
        coalesce(
          nullif(
            resolved.payload #>> '{audio,episode_number}',
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
  join editorial.audio_episode_shared_links episode_link
    on episode_link.show_episode_resource_id = episode_row.resource_id
  join audio.publications publication
    on publication.id = episode_link.audio_publication_id
   and publication.publication_kind = 'episode'
   and publication.show_id = v_audio_show_id
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
    select distinct on (episode.value #>> '{audio,season,id}')
      episode.value -> 'audio' -> 'season' as value
    from jsonb_array_elements(v_episodes) episode(value)
    where episode.value #> '{audio,season}' is not null
      and jsonb_typeof(episode.value #> '{audio,season}') = 'object'
      and coalesce(episode.value #>> '{audio,season,id}', '') <> ''
    order by
      episode.value #>> '{audio,season,id}',
      episode.value #>> '{audio,season,season_number}'
  ) season;

  return jsonb_build_object(
    'show', jsonb_build_object(
      'resource_id', v_show.resource_id,
      'slug', v_show.slug,
      'title', v_show.title,
      'description', v_show.description,
      'canonical_path', '/shows/' || v_show.slug,
      'feed_path', '/shows/' || v_show.slug || '/feed.xml',
      'episode_count', jsonb_array_length(v_episodes)
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
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Stable Audio enclosure projection. The branded enclosure remains Audio
-- transport identity even though the Episode cultural URL is Show-scoped.
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

comment on table editorial.shows is
  'Shared cross-media Show identity. Audio is the first consumer; future media verticals bind here rather than create competing Show identity.';

comment on table editorial.show_episodes is
  'Shared child identity inside a Show. Media-specific publication/rendition authority remains in its vertical.';

comment on function public.get_public_show(text) is
  'Shared public Show projection. M2 exposes only Show Episodes with a current public-safe Audio rendition from the exact M1 Audio resolver.';

comment on function public.get_public_show_episode(text, text) is
  'Shared Show Episode projection. Returns shared Episode identity plus the current public-safe Audio rendition when available.';

comment on function public.get_public_audio_enclosure(uuid) is
  'Stable Audio enclosure projection over the exact current public-safe M1 Audio publication resolver.';

commit;
