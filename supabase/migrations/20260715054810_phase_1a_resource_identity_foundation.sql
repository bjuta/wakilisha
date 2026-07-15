begin;

create schema if not exists editorial;

comment on schema editorial is
  'Internal platform authority for stable WAKILISHA resource identity.';

revoke all on schema editorial from public;

grant usage on schema editorial
  to anon, authenticated, service_role;

alter default privileges for role postgres
  in schema editorial
  revoke all on tables
  from public, anon, authenticated;

alter default privileges for role postgres
  in schema editorial
  revoke execute on functions
  from public, anon, authenticated;

create table editorial.resource_kinds (
  kind text primary key,
  label text not null,
  description text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),

  constraint resource_kinds_kind_format_check
    check (kind ~ '^[a-z][a-z0-9_]*$')
);

comment on table editorial.resource_kinds is
  'Controlled registry of resource kinds supported by the shared identity layer.';

create table editorial.resources (
  id uuid primary key default gen_random_uuid(),
  resource_kind text not null,
  owner_id uuid,
  visibility text not null,
  lifecycle_state text not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint resources_resource_kind_fkey
    foreign key (resource_kind)
    references editorial.resource_kinds(kind)
    on update cascade
    on delete restrict,

  constraint resources_owner_id_fkey
    foreign key (owner_id)
    references auth.users(id)
    on delete set null,

  constraint resources_created_by_fkey
    foreign key (created_by)
    references auth.users(id)
    on delete set null,

  constraint resources_visibility_check
    check (
      visibility in (
        'private',
        'internal',
        'public'
      )
    ),

  constraint resources_lifecycle_state_check
    check (
      lifecycle_state in (
        'draft',
        'active',
        'published',
        'archived'
      )
    ),

  constraint resources_id_kind_key
    unique (id, resource_kind)
);

comment on table editorial.resources is
  'Stable global identity shared by WAKILISHA cultural resources.';

create table editorial.article_resources (
  resource_id uuid primary key,
  resource_kind text not null default 'article',
  article_id uuid not null unique,

  constraint article_resources_kind_check
    check (resource_kind = 'article'),

  constraint article_resources_resource_fkey
    foreign key (resource_id, resource_kind)
    references editorial.resources(id, resource_kind)
    on update cascade
    on delete cascade,

  constraint article_resources_article_fkey
    foreign key (article_id)
    references public.wk_articles(id)
    on update cascade
    on delete restrict
);

comment on table editorial.article_resources is
  'Typed canonical binding between a resource and an Article.';

create table editorial.playlist_resources (
  resource_id uuid primary key,
  resource_kind text not null default 'playlist',
  playlist_id uuid not null unique,

  constraint playlist_resources_kind_check
    check (resource_kind = 'playlist'),

  constraint playlist_resources_resource_fkey
    foreign key (resource_id, resource_kind)
    references editorial.resources(id, resource_kind)
    on update cascade
    on delete cascade,

  constraint playlist_resources_playlist_fkey
    foreign key (playlist_id)
    references public.wk_playlists(id)
    on update cascade
    on delete restrict
);

comment on table editorial.playlist_resources is
  'Typed canonical binding between a resource and a Playlist.';

create table editorial.registry_artist_resources (
  resource_id uuid primary key,
  resource_kind text not null default 'registry_artist',
  artist_id uuid not null unique,

  constraint registry_artist_resources_kind_check
    check (resource_kind = 'registry_artist'),

  constraint registry_artist_resources_resource_fkey
    foreign key (resource_id, resource_kind)
    references editorial.resources(id, resource_kind)
    on update cascade
    on delete cascade,

  constraint registry_artist_resources_artist_fkey
    foreign key (artist_id)
    references public.registry_artists(id)
    on update cascade
    on delete restrict
);

comment on table editorial.registry_artist_resources is
  'Typed canonical binding between a resource and a Registry artist.';

create table editorial.resource_aliases (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null,
  path text not null,
  is_canonical boolean not null default false,
  redirect_status smallint not null default 308,
  retired_at timestamptz,
  replacement_alias_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),

  constraint resource_aliases_resource_fkey
    foreign key (resource_id)
    references editorial.resources(id)
    on update cascade
    on delete cascade,

  constraint resource_aliases_created_by_fkey
    foreign key (created_by)
    references auth.users(id)
    on delete set null,

  constraint resource_aliases_redirect_status_check
    check (redirect_status in (301, 308)),

  constraint resource_aliases_path_leading_slash_check
    check (path like '/%'),

  constraint resource_aliases_path_lowercase_check
    check (path = lower(path)),

  constraint resource_aliases_path_no_query_check
    check (
      position('?' in path) = 0
      and position('#' in path) = 0
    ),

  constraint resource_aliases_path_no_double_slash_check
    check (path !~ '//'),

  constraint resource_aliases_path_no_trailing_slash_check
    check (
      path = '/'
      or right(path, 1) <> '/'
    ),

  constraint resource_aliases_active_canonical_check
    check (
      not is_canonical
      or retired_at is null
    ),

  constraint resource_aliases_replacement_check
    check (
      replacement_alias_id is null
      or replacement_alias_id <> id
    ),

  constraint resource_aliases_path_key
    unique (path),

  constraint resource_aliases_id_resource_key
    unique (id, resource_id),

  constraint resource_aliases_replacement_fkey
    foreign key (
      replacement_alias_id,
      resource_id
    )
    references editorial.resource_aliases(
      id,
      resource_id
    )
    deferrable initially deferred
);

comment on table editorial.resource_aliases is
  'Permanent route identities attached to stable resources. Retired paths are never reused.';

create unique index resource_aliases_one_canonical_idx
  on editorial.resource_aliases(resource_id)
  where is_canonical
    and retired_at is null;

create index resources_kind_state_idx
  on editorial.resources(
    resource_kind,
    lifecycle_state
  );

create index resources_visibility_idx
  on editorial.resources(visibility);

create index resources_owner_id_idx
  on editorial.resources(owner_id)
  where owner_id is not null;

create index resource_aliases_resource_id_idx
  on editorial.resource_aliases(resource_id);

create or replace function editorial.prevent_resource_identity_retarget()
returns trigger
language plpgsql
set search_path = pg_catalog, editorial
as $function$
begin
  if new.id is distinct from old.id then
    raise exception
      'Resource identity % cannot be changed.',
      old.id;
  end if;

  if new.resource_kind is distinct from old.resource_kind then
    raise exception
      'Resource % kind cannot change from % to %.',
      old.id,
      old.resource_kind,
      new.resource_kind;
  end if;

  return new;
end
$function$;

revoke execute
  on function editorial.prevent_resource_identity_retarget()
  from public, anon, authenticated;

create or replace function editorial.prevent_resource_binding_retarget()
returns trigger
language plpgsql
set search_path = pg_catalog, editorial
as $function$
begin
  if to_jsonb(new) is distinct from to_jsonb(old) then
    raise exception
      'Typed binding on editorial.% for resource % is immutable.',
      tg_table_name,
      old.resource_id;
  end if;

  return new;
end
$function$;

revoke execute
  on function editorial.prevent_resource_binding_retarget()
  from public, anon, authenticated;

create or replace function editorial.assert_resource_binding_integrity()
returns trigger
language plpgsql
set search_path = pg_catalog, editorial
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
      select count(*)
        into binding_count
      from editorial.article_resources
      where resource_id = target_resource_id;

    when 'playlist' then
      select count(*)
        into binding_count
      from editorial.playlist_resources
      where resource_id = target_resource_id;

    when 'registry_artist' then
      select count(*)
        into binding_count
      from editorial.registry_artist_resources
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
end
$function$;

revoke execute
  on function editorial.assert_resource_binding_integrity()
  from public, anon, authenticated;

create trigger resources_prevent_identity_retarget
before update of id, resource_kind
on editorial.resources
for each row
execute function editorial.prevent_resource_identity_retarget();

create trigger article_resources_prevent_retarget
before update
on editorial.article_resources
for each row
execute function editorial.prevent_resource_binding_retarget();

create trigger playlist_resources_prevent_retarget
before update
on editorial.playlist_resources
for each row
execute function editorial.prevent_resource_binding_retarget();

create trigger registry_artist_resources_prevent_retarget
before update
on editorial.registry_artist_resources
for each row
execute function editorial.prevent_resource_binding_retarget();

create constraint trigger resources_binding_integrity
after insert or update
on editorial.resources
deferrable initially deferred
for each row
execute function editorial.assert_resource_binding_integrity();

create constraint trigger article_resources_binding_integrity
after insert or update or delete
on editorial.article_resources
deferrable initially deferred
for each row
execute function editorial.assert_resource_binding_integrity();

create constraint trigger playlist_resources_binding_integrity
after insert or update or delete
on editorial.playlist_resources
deferrable initially deferred
for each row
execute function editorial.assert_resource_binding_integrity();

create constraint trigger registry_artist_resources_binding_integrity
after insert or update or delete
on editorial.registry_artist_resources
deferrable initially deferred
for each row
execute function editorial.assert_resource_binding_integrity();

alter table editorial.resource_kinds
  enable row level security;

alter table editorial.resources
  enable row level security;

alter table editorial.article_resources
  enable row level security;

alter table editorial.playlist_resources
  enable row level security;

alter table editorial.registry_artist_resources
  enable row level security;

alter table editorial.resource_aliases
  enable row level security;

create policy resource_kinds_public_read
on editorial.resource_kinds
for select
to anon, authenticated
using (enabled);

create policy resources_public_read
on editorial.resources
for select
to anon, authenticated
using (visibility = 'public');

create policy article_resources_public_read
on editorial.article_resources
for select
to anon, authenticated
using (
  exists (
    select 1
    from editorial.resources
    where resources.id = article_resources.resource_id
      and resources.visibility = 'public'
  )
);

create policy playlist_resources_public_read
on editorial.playlist_resources
for select
to anon, authenticated
using (
  exists (
    select 1
    from editorial.resources
    where resources.id = playlist_resources.resource_id
      and resources.visibility = 'public'
  )
);

create policy registry_artist_resources_public_read
on editorial.registry_artist_resources
for select
to anon, authenticated
using (
  exists (
    select 1
    from editorial.resources
    where resources.id = registry_artist_resources.resource_id
      and resources.visibility = 'public'
  )
);

create policy resource_aliases_public_read
on editorial.resource_aliases
for select
to anon, authenticated
using (
  exists (
    select 1
    from editorial.resources
    where resources.id = resource_aliases.resource_id
      and resources.visibility = 'public'
  )
);

revoke all
  on all tables in schema editorial
  from public, anon, authenticated;

grant select
  on editorial.resource_kinds,
     editorial.resources,
     editorial.article_resources,
     editorial.playlist_resources,
     editorial.registry_artist_resources,
     editorial.resource_aliases
  to anon, authenticated;

grant all
  on editorial.resource_kinds,
     editorial.resources,
     editorial.article_resources,
     editorial.playlist_resources,
     editorial.registry_artist_resources,
     editorial.resource_aliases
  to service_role;

create or replace view public.wk_resource_index
with (
  security_invoker = true,
  security_barrier = true
)
as
select
  resources.id as resource_id,
  resources.resource_kind,
  article_resources.article_id
    as canonical_record_id,
  canonical_alias.path
    as canonical_path,
  resources.visibility,
  resources.lifecycle_state,
  resources.created_at,
  resources.updated_at
from editorial.resources
join editorial.article_resources
  on article_resources.resource_id = resources.id
left join editorial.resource_aliases as canonical_alias
  on canonical_alias.resource_id = resources.id
 and canonical_alias.is_canonical
 and canonical_alias.retired_at is null

union all

select
  resources.id as resource_id,
  resources.resource_kind,
  playlist_resources.playlist_id
    as canonical_record_id,
  canonical_alias.path
    as canonical_path,
  resources.visibility,
  resources.lifecycle_state,
  resources.created_at,
  resources.updated_at
from editorial.resources
join editorial.playlist_resources
  on playlist_resources.resource_id = resources.id
left join editorial.resource_aliases as canonical_alias
  on canonical_alias.resource_id = resources.id
 and canonical_alias.is_canonical
 and canonical_alias.retired_at is null

union all

select
  resources.id as resource_id,
  resources.resource_kind,
  registry_artist_resources.artist_id
    as canonical_record_id,
  canonical_alias.path
    as canonical_path,
  resources.visibility,
  resources.lifecycle_state,
  resources.created_at,
  resources.updated_at
from editorial.resources
join editorial.registry_artist_resources
  on registry_artist_resources.resource_id = resources.id
left join editorial.resource_aliases as canonical_alias
  on canonical_alias.resource_id = resources.id
 and canonical_alias.is_canonical
 and canonical_alias.retired_at is null;

comment on view public.wk_resource_index is
  'Narrow stable resource reference index. Canonical domain tables remain authoritative.';

revoke all
  on public.wk_resource_index
  from public, anon, authenticated;

grant select
  on public.wk_resource_index
  to anon, authenticated, service_role;

insert into editorial.resource_kinds (
  kind,
  label,
  description
)
values
  (
    'article',
    'Article',
    'Canonical Article content stored in public.wk_articles.'
  ),
  (
    'playlist',
    'Playlist',
    'Canonical Playlist content stored in public.wk_playlists.'
  ),
  (
    'registry_artist',
    'Registry artist',
    'Canonical artist record stored in public.registry_artists.'
  );

-- Proof seeds are conditional because fresh no-data branches do not
-- contain production editorial records. Production verification checks the
-- three pinned records separately after migration application.

do $block$
declare
  article_record public.wk_articles%rowtype;
  playlist_record public.wk_playlists%rowtype;
  artist_record public.registry_artists%rowtype;
  article_resource_id uuid;
  playlist_resource_id uuid;
  artist_resource_id uuid;
begin
  select *
    into article_record
  from public.wk_articles
  where slug = 'the-rise-of-music-playlists'
    and published_at is not null
    and coalesce(wp_status, 'publish') = 'publish';

  if found then
    insert into editorial.resources (
      resource_kind,
      visibility,
      lifecycle_state
    )
    values (
      'article',
      'public',
      'published'
    )
    returning id
      into article_resource_id;

    insert into editorial.article_resources (
      resource_id,
      article_id
    )
    values (
      article_resource_id,
      article_record.id
    );

    insert into editorial.resource_aliases (
      resource_id,
      path,
      is_canonical
    )
    values (
      article_resource_id,
      '/magazine/' || article_record.slug,
      true
    );
  else
    raise notice
      'Skipping Phase 1A Article proof seed because the pinned published Article is absent.';
  end if;

  select *
    into playlist_record
  from public.wk_playlists
  where slug = 'between-2018-and-2024-in-what-ways-did-sheng-function-inside-kenyan-gengeton-2';

  if found then
    insert into editorial.resources (
      resource_kind,
      owner_id,
      visibility,
      lifecycle_state,
      created_by
    )
    values (
      'playlist',
      playlist_record.created_by,
      'internal',
      case
        when playlist_record.status = 'published'
          then 'published'
        when playlist_record.status = 'archived'
          then 'archived'
        when playlist_record.status = 'draft'
          then 'draft'
        else 'active'
      end,
      playlist_record.created_by
    )
    returning id
      into playlist_resource_id;

    insert into editorial.playlist_resources (
      resource_id,
      playlist_id
    )
    values (
      playlist_resource_id,
      playlist_record.id
    );
  else
    raise notice
      'Skipping Phase 1A Playlist proof seed because the pinned Playlist is absent.';
  end if;

  select *
    into artist_record
  from public.registry_artists
  where slug = 'khaligraph-jones'
    and status = 'active';

  if found then
    insert into editorial.resources (
      resource_kind,
      visibility,
      lifecycle_state
    )
    values (
      'registry_artist',
      'public',
      'active'
    )
    returning id
      into artist_resource_id;

    insert into editorial.registry_artist_resources (
      resource_id,
      artist_id
    )
    values (
      artist_resource_id,
      artist_record.id
    );

    insert into editorial.resource_aliases (
      resource_id,
      path,
      is_canonical
    )
    values (
      artist_resource_id,
      '/artists/' || artist_record.slug,
      true
    );
  else
    raise notice
      'Skipping Phase 1A Registry artist proof seed because the pinned active artist is absent.';
  end if;
end
$block$;

commit;
