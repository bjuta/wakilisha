-- Phase 2A: durable Article drafts and immutable versions.
--
-- This migration establishes:
-- 1. monotonic Article draft versions
-- 2. complete immutable Article snapshots
-- 3. normalized Article taxonomy relationships
-- 4. resource version pointers
-- 5. durable autosave and recovery commands
-- 6. transactional Article saves and slug redirects
-- 7. resource-based ownership enforcement

do $phase_2a_preflight$
declare
  revision_count bigint;
begin
  if to_regclass('public.wk_articles') is null then
    raise exception 'STOP: public.wk_articles does not exist';
  end if;

  if to_regclass('public.wk_article_revisions') is null then
    raise exception 'STOP: public.wk_article_revisions does not exist';
  end if;

  if to_regclass('editorial.resources') is null then
    raise exception 'STOP: editorial.resources does not exist';
  end if;

  if to_regclass('editorial.article_resources') is null then
    raise exception 'STOP: editorial.article_resources does not exist';
  end if;

  if to_regclass('public.registry_taxonomy_terms') is null then
    raise exception 'STOP: public.registry_taxonomy_terms does not exist';
  end if;

  select count(*)
  into revision_count
  from public.wk_article_revisions;

  if revision_count <> 0 then
    raise exception
      'STOP: Expected zero legacy Article revisions, found %',
      revision_count;
  end if;
end;
$phase_2a_preflight$;

alter table public.wk_articles
  add column if not exists draft_version bigint;

update public.wk_articles
set draft_version = 1
where draft_version is null;

alter table public.wk_articles
  alter column draft_version set default 1,
  alter column draft_version set not null;

alter table public.wk_articles
  drop constraint if exists wk_articles_draft_version_check;

alter table public.wk_articles
  add constraint wk_articles_draft_version_check
  check (draft_version >= 1);

create table editorial.article_versions (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null,
  article_id uuid not null,
  version_number bigint not null,
  version_kind text not null,
  source_draft_version bigint not null,
  title text,
  slug text not null,
  excerpt text,
  content_html text,
  author_display text,
  owner_id uuid,
  hero_image_id uuid,
  hero_image_url text,
  seo jsonb not null default '{}'::jsonb,
  lifecycle_state text,
  wp_status text,
  published_at timestamptz,
  category_snapshot jsonb not null default '[]'::jsonb,
  tag_snapshot jsonb not null default '[]'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  content_fingerprint text not null,

  constraint article_versions_resource_fkey
    foreign key (resource_id)
    references editorial.resources(id)
    on update cascade
    on delete cascade,

  constraint article_versions_article_fkey
    foreign key (article_id)
    references public.wk_articles(id)
    on update cascade
    on delete restrict,

  constraint article_versions_owner_fkey
    foreign key (owner_id)
    references auth.users(id)
    on delete set null,

  constraint article_versions_created_by_fkey
    foreign key (created_by)
    references auth.users(id)
    on delete set null,

  constraint article_versions_kind_check
    check (
      version_kind in (
        'baseline',
        'autosave',
        'manual_save',
        'submitted'
      )
    ),

  constraint article_versions_number_check
    check (version_number >= 1),

  constraint article_versions_source_version_check
    check (source_draft_version >= 1),

  constraint article_versions_slug_not_blank
    check (btrim(slug) <> ''),

  constraint article_versions_fingerprint_not_blank
    check (btrim(content_fingerprint) <> ''),

  constraint article_versions_resource_number_unique
    unique (resource_id, version_number)
);

create index article_versions_article_created_idx
  on editorial.article_versions (
    article_id,
    created_at desc
  );

create index article_versions_resource_kind_idx
  on editorial.article_versions (
    resource_id,
    version_kind,
    created_at desc
  );

create index article_versions_recovery_idx
  on editorial.article_versions (
    article_id,
    created_by,
    created_at desc
  )
  where version_kind = 'autosave';

create table editorial.article_taxonomy_terms (
  resource_id uuid not null,
  term_id uuid not null,
  taxonomy text not null,
  created_by uuid,
  created_at timestamptz not null default now(),

  constraint article_taxonomy_terms_pkey
    primary key (
      resource_id,
      taxonomy,
      term_id
    ),

  constraint article_taxonomy_terms_resource_fkey
    foreign key (resource_id)
    references editorial.resources(id)
    on update cascade
    on delete cascade,

  constraint article_taxonomy_terms_term_fkey
    foreign key (term_id)
    references public.registry_taxonomy_terms(id)
    on update cascade
    on delete restrict,

  constraint article_taxonomy_terms_created_by_fkey
    foreign key (created_by)
    references auth.users(id)
    on delete set null,

  constraint article_taxonomy_terms_taxonomy_check
    check (
      taxonomy in (
        'category',
        'post_tag'
      )
    )
);

create index article_taxonomy_terms_term_idx
  on editorial.article_taxonomy_terms (
    term_id,
    resource_id
  );

alter table editorial.resources
  add column if not exists current_working_version_id uuid,
  add column if not exists current_submitted_version_id uuid;

alter table editorial.resources
  drop constraint if exists resources_current_working_version_fkey;

alter table editorial.resources
  add constraint resources_current_working_version_fkey
  foreign key (current_working_version_id)
  references editorial.article_versions(id)
  on delete set null
  deferrable initially deferred;

alter table editorial.resources
  drop constraint if exists resources_current_submitted_version_fkey;

alter table editorial.resources
  add constraint resources_current_submitted_version_fkey
  foreign key (current_submitted_version_id)
  references editorial.article_versions(id)
  on delete set null
  deferrable initially deferred;

create or replace function editorial.assert_article_version_pointer_integrity()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, editorial
as $function$
begin
  if new.current_working_version_id is not null
     and not exists (
       select 1
       from editorial.article_versions version
       where version.id = new.current_working_version_id
         and version.resource_id = new.id
     )
  then
    raise exception
      'Current working version must belong to the same resource';
  end if;

  if new.current_submitted_version_id is not null
     and not exists (
       select 1
       from editorial.article_versions version
       where version.id = new.current_submitted_version_id
         and version.resource_id = new.id
         and version.version_kind = 'submitted'
     )
  then
    raise exception
      'Current submitted version must be a submitted version belonging to the same resource';
  end if;

  return new;
end;
$function$;

drop trigger if exists resources_article_version_pointer_integrity
  on editorial.resources;

create constraint trigger resources_article_version_pointer_integrity
after insert or update of
  current_working_version_id,
  current_submitted_version_id
on editorial.resources
deferrable initially deferred
for each row
execute function editorial.assert_article_version_pointer_integrity();

create or replace function editorial.protect_article_version()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, editorial
as $function$
begin
  if tg_op = 'UPDATE' then
    raise exception 'Article versions are immutable';
  end if;

  if old.version_kind in ('baseline', 'submitted') then
    raise exception
      'Baseline and submitted Article versions cannot be deleted';
  end if;

  if exists (
    select 1
    from editorial.resources resource
    where resource.current_working_version_id = old.id
       or resource.current_submitted_version_id = old.id
  ) then
    raise exception
      'An Article version referenced by a resource pointer cannot be deleted';
  end if;

  return old;
end;
$function$;

drop trigger if exists article_versions_immutable
  on editorial.article_versions;

create trigger article_versions_immutable
before update or delete
on editorial.article_versions
for each row
execute function editorial.protect_article_version();

create or replace function editorial.article_snapshot_fingerprint(
  p_title text,
  p_slug text,
  p_excerpt text,
  p_content_html text,
  p_author_display text,
  p_hero_image_id uuid,
  p_hero_image_url text,
  p_seo jsonb,
  p_wp_status text,
  p_published_at timestamptz,
  p_categories jsonb,
  p_tags jsonb
)
returns text
language sql
immutable
parallel safe
set search_path = pg_catalog
as $function$
  select encode(
    extensions.digest(
      concat_ws(
        chr(31),
        coalesce(p_title, ''),
        coalesce(p_slug, ''),
        coalesce(p_excerpt, ''),
        coalesce(p_content_html, ''),
        coalesce(p_author_display, ''),
        coalesce(p_hero_image_id::text, ''),
        coalesce(p_hero_image_url, ''),
        coalesce(p_seo, '{}'::jsonb)::text,
        coalesce(p_wp_status, ''),
        coalesce(p_published_at::text, ''),
        coalesce(p_categories, '[]'::jsonb)::text,
        coalesce(p_tags, '[]'::jsonb)::text
      ),
      'sha256'
    ),
    'hex'
  );
$function$;

do $article_resource_backfill$
declare
  article public.wk_articles%rowtype;
  new_resource_id uuid;
begin
  for article in
    select source_article.*
    from public.wk_articles source_article
    where not exists (
      select 1
      from editorial.article_resources binding
      where binding.article_id = source_article.id
    )
    order by source_article.created_at, source_article.id
  loop
    insert into editorial.resources (
      resource_kind,
      owner_id,
      visibility,
      lifecycle_state,
      created_by,
      created_at,
      updated_at
    )
    values (
      'article',
      null,
      case
        when article.wp_status = 'publish' then 'public'
        when article.wp_status = 'future' then 'internal'
        else 'private'
      end,
      case
        when article.wp_status = 'publish' then 'published'
        when article.wp_status = 'trash' then 'archived'
        when article.wp_status = 'future' then 'active'
        else 'draft'
      end,
      null::uuid,
      article.created_at,
      article.updated_at
    )
    returning id
    into new_resource_id;

    insert into editorial.article_resources (
      resource_id,
      resource_kind,
      article_id
    )
    values (
      new_resource_id,
      'article',
      article.id
    );
  end loop;
end;
$article_resource_backfill$;

do $article_resource_backfill_gate$
declare
  article_count bigint;
  binding_count bigint;
begin
  select count(*)
  into article_count
  from public.wk_articles;

  select count(*)
  into binding_count
  from editorial.article_resources;

  if article_count <> binding_count then
    raise exception
      'STOP: Expected one resource binding for each Article. Articles %, bindings %',
      article_count,
      binding_count;
  end if;
end;
$article_resource_backfill_gate$;

insert into editorial.article_taxonomy_terms (
  resource_id,
  term_id,
  taxonomy,
  created_by
)
select distinct
  binding.resource_id,
  term.id,
  'category',
  null::uuid
from public.wk_articles article
join editorial.article_resources binding
  on binding.article_id = article.id
cross join lateral jsonb_array_elements(
  coalesce(article.categories, '[]'::jsonb)
) category_value
join public.registry_taxonomy_terms term
  on term.taxonomy = 'category'
 and term.slug = case
   when jsonb_typeof(category_value) = 'object'
     then category_value ->> 'slug'
   when jsonb_typeof(category_value) = 'string'
     then category_value #>> '{}'
   else null
 end
on conflict do nothing;

insert into editorial.article_taxonomy_terms (
  resource_id,
  term_id,
  taxonomy,
  created_by
)
select distinct
  binding.resource_id,
  term.id,
  'post_tag',
  null::uuid
from public.wk_articles article
join editorial.article_resources binding
  on binding.article_id = article.id
cross join lateral jsonb_array_elements(
  coalesce(article.tags, '[]'::jsonb)
) tag_value
join public.registry_taxonomy_terms term
  on term.taxonomy = 'post_tag'
 and term.slug = case
   when jsonb_typeof(tag_value) = 'object'
     then tag_value ->> 'slug'
   when jsonb_typeof(tag_value) = 'string'
     then tag_value #>> '{}'
   else null
 end
on conflict do nothing;

insert into editorial.article_versions (
  resource_id,
  article_id,
  version_number,
  version_kind,
  source_draft_version,
  title,
  slug,
  excerpt,
  content_html,
  author_display,
  owner_id,
  hero_image_id,
  hero_image_url,
  seo,
  lifecycle_state,
  wp_status,
  published_at,
  category_snapshot,
  tag_snapshot,
  created_by,
  created_at,
  content_fingerprint
)
select
  binding.resource_id,
  article.id,
  1,
  'baseline',
  article.draft_version,
  article.title,
  article.slug,
  article.excerpt,
  article.content_html,
  article.author,
  resource.owner_id,
  article.hero_image_id,
  article.hero_image_url,
  article.seo,
  resource.lifecycle_state,
  article.wp_status,
  article.published_at,
  article.categories,
  article.tags,
  resource.created_by,
  article.updated_at,
  editorial.article_snapshot_fingerprint(
    article.title,
    article.slug,
    article.excerpt,
    article.content_html,
    article.author,
    article.hero_image_id,
    article.hero_image_url,
    article.seo,
    article.wp_status,
    article.published_at,
    article.categories,
    article.tags
  )
from public.wk_articles article
join editorial.article_resources binding
  on binding.article_id = article.id
join editorial.resources resource
  on resource.id = binding.resource_id
where not exists (
  select 1
  from editorial.article_versions version
  where version.resource_id = binding.resource_id
);

update editorial.resources resource
set
  current_working_version_id = baseline.id,
  updated_at = greatest(
    resource.updated_at,
    baseline.created_at
  )
from editorial.article_versions baseline
where baseline.resource_id = resource.id
  and baseline.version_kind = 'baseline'
  and baseline.version_number = 1
  and resource.current_working_version_id is null;

create or replace function editorial.current_user_can_edit_article(
  p_resource_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, editorial
as $function$
  select
    auth.uid() is not null
    and (
      public.current_user_is_administrator()
      or public.current_user_has_capability(
        'edit_others_articles'
      )
      or (
        public.current_user_has_capability(
          'edit_own_articles'
        )
        and exists (
          select 1
          from editorial.resources resource
          where resource.id = p_resource_id
            and resource.owner_id = auth.uid()
        )
      )
    );
$function$;

create or replace function editorial.next_article_version_number(
  p_resource_id uuid
)
returns bigint
language sql
stable
security invoker
set search_path = pg_catalog, editorial
as $function$
  select coalesce(
    max(version.version_number),
    0
  ) + 1
  from editorial.article_versions version
  where version.resource_id = p_resource_id;
$function$;

create or replace function public.save_article_versioned(
  p_article_id uuid,
  p_payload jsonb,
  p_expected_draft_version bigint,
  p_version_kind text default 'manual_save',
  p_taxonomy_term_ids uuid[] default '{}'::uuid[]
)
returns table (
  article_id uuid,
  article_slug text,
  draft_version bigint,
  version_id uuid,
  version_number bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $function$
declare
  current_article public.wk_articles%rowtype;
  current_resource editorial.resources%rowtype;
  new_version_id uuid;
  new_version_number bigint;
  new_slug text;
  new_categories jsonb;
  new_tags jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_version_kind not in (
    'manual_save',
    'submitted'
  ) then
    raise exception
      'Unsupported Article version kind: %',
      p_version_kind;
  end if;

  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
  then
    raise exception 'Article payload must be a JSON object';
  end if;

  if p_payload - array[
    'title',
    'slug',
    'excerpt',
    'content_html',
    'author',
    'published_at',
    'seo',
    'wp_status',
    'hero_image_id',
    'hero_image_url'
  ] <> '{}'::jsonb
  then
    raise exception
      'Article payload contains unsupported fields';
  end if;

  select article.*
  into current_article
  from public.wk_articles article
  where article.id = p_article_id
  for update;

  if not found then
    raise exception 'Article not found';
  end if;

  select resource.*
  into current_resource
  from editorial.article_resources binding
  join editorial.resources resource
    on resource.id = binding.resource_id
  where binding.article_id = p_article_id
  for update of resource;

  if not found then
    raise exception 'Article resource identity not found';
  end if;

  if not editorial.current_user_can_edit_article(
    current_resource.id
  ) then
    raise exception 'Permission denied';
  end if;

  if p_expected_draft_version is null then
    raise exception
      'Expected draft version is required';
  end if;

  if current_article.draft_version
     <> p_expected_draft_version
  then
    raise exception
      'STALE_ARTICLE_VERSION: expected %, current %',
      p_expected_draft_version,
      current_article.draft_version;
  end if;

  new_slug := case
    when p_payload ? 'slug'
      then nullif(
        btrim(p_payload ->> 'slug'),
        ''
      )
    else current_article.slug
  end;

  if new_slug is null then
    raise exception 'Article slug cannot be blank';
  end if;

  if new_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Article slug is invalid';
  end if;

  if new_slug <> current_article.slug
     and exists (
       select 1
       from public.wk_articles other_article
       where other_article.slug = new_slug
         and other_article.id <> p_article_id
     )
  then
    raise exception
      'Article slug already exists: %',
      new_slug;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name',
        term.name,
        'slug',
        term.slug
      )
      order by term.name
    ),
    '[]'::jsonb
  )
  into new_categories
  from public.registry_taxonomy_terms term
  where term.id = any(
    coalesce(
      p_taxonomy_term_ids,
      '{}'::uuid[]
    )
  )
    and term.taxonomy = 'category'
    and term.status = 'active';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name',
        term.name,
        'slug',
        term.slug
      )
      order by term.name
    ),
    '[]'::jsonb
  )
  into new_tags
  from public.registry_taxonomy_terms term
  where term.id = any(
    coalesce(
      p_taxonomy_term_ids,
      '{}'::uuid[]
    )
  )
    and term.taxonomy = 'post_tag'
    and term.status = 'active';

  if new_slug <> current_article.slug then
    insert into public.wk_slug_redirects (
      old_slug,
      new_slug,
      entity_type,
      created_by,
      old_path,
      new_path,
      redirect_status,
      updated_at
    )
    values (
      current_article.slug,
      new_slug,
      'article',
      auth.uid()::text,
      '/magazine/' || current_article.slug,
      '/magazine/' || new_slug,
      308,
      now()
    );
  end if;

  update public.wk_articles
  set
    title = case
      when p_payload ? 'title'
        then p_payload ->> 'title'
      else title
    end,
    slug = new_slug,
    excerpt = case
      when p_payload ? 'excerpt'
        then p_payload ->> 'excerpt'
      else excerpt
    end,
    content_html = case
      when p_payload ? 'content_html'
        then p_payload ->> 'content_html'
      else content_html
    end,
    author = case
      when p_payload ? 'author'
        then p_payload ->> 'author'
      else author
    end,
    published_at = case
      when p_payload ? 'published_at'
        then nullif(
          p_payload ->> 'published_at',
          ''
        )::timestamptz
      else published_at
    end,
    seo = case
      when p_payload ? 'seo'
        then coalesce(
          p_payload -> 'seo',
          '{}'::jsonb
        )
      else seo
    end,
    wp_status = case
      when p_payload ? 'wp_status'
        then p_payload ->> 'wp_status'
      else wp_status
    end,
    hero_image_id = case
      when p_payload ? 'hero_image_id'
        then nullif(
          p_payload ->> 'hero_image_id',
          ''
        )::uuid
      else hero_image_id
    end,
    hero_image_url = case
      when p_payload ? 'hero_image_url'
        then p_payload ->> 'hero_image_url'
      else hero_image_url
    end,
    categories = new_categories,
    tags = new_tags,
    draft_version = draft_version + 1,
    modified_at = now(),
    updated_at = now()
  where id = p_article_id
  returning *
  into current_article;

  delete from editorial.article_taxonomy_terms
  where resource_id = current_resource.id;

  insert into editorial.article_taxonomy_terms (
    resource_id,
    term_id,
    taxonomy,
    created_by
  )
  select
    current_resource.id,
    term.id,
    term.taxonomy,
    auth.uid()
  from public.registry_taxonomy_terms term
  where term.id = any(
    coalesce(
      p_taxonomy_term_ids,
      '{}'::uuid[]
    )
  )
    and term.taxonomy in (
      'category',
      'post_tag'
    )
    and term.status = 'active'
  on conflict do nothing;

  new_version_number :=
    editorial.next_article_version_number(
      current_resource.id
    );

  insert into editorial.article_versions (
    resource_id,
    article_id,
    version_number,
    version_kind,
    source_draft_version,
    title,
    slug,
    excerpt,
    content_html,
    author_display,
    owner_id,
    hero_image_id,
    hero_image_url,
    seo,
    lifecycle_state,
    wp_status,
    published_at,
    category_snapshot,
    tag_snapshot,
    created_by,
    content_fingerprint
  )
  values (
    current_resource.id,
    current_article.id,
    new_version_number,
    p_version_kind,
    current_article.draft_version,
    current_article.title,
    current_article.slug,
    current_article.excerpt,
    current_article.content_html,
    current_article.author,
    current_resource.owner_id,
    current_article.hero_image_id,
    current_article.hero_image_url,
    current_article.seo,
    current_resource.lifecycle_state,
    current_article.wp_status,
    current_article.published_at,
    current_article.categories,
    current_article.tags,
    auth.uid(),
    editorial.article_snapshot_fingerprint(
      current_article.title,
      current_article.slug,
      current_article.excerpt,
      current_article.content_html,
      current_article.author,
      current_article.hero_image_id,
      current_article.hero_image_url,
      current_article.seo,
      current_article.wp_status,
      current_article.published_at,
      current_article.categories,
      current_article.tags
    )
  )
  returning id
  into new_version_id;

  update editorial.resources
  set
    current_working_version_id = new_version_id,
    current_submitted_version_id = case
      when p_version_kind = 'submitted'
        then new_version_id
      else current_submitted_version_id
    end,
    lifecycle_state = case
      when current_article.wp_status = 'publish'
        then 'published'
      when current_article.wp_status = 'trash'
        then 'archived'
      when current_article.wp_status = 'future'
        then 'active'
      else 'draft'
    end,
    visibility = case
      when current_article.wp_status = 'publish'
        then 'public'
      when current_article.wp_status = 'future'
        then 'internal'
      else 'private'
    end,
    updated_at = now()
  where id = current_resource.id;

  delete from editorial.article_versions old_version
  where old_version.resource_id = current_resource.id
    and old_version.version_kind = 'manual_save'
    and old_version.id not in (
      select retained.id
      from editorial.article_versions retained
      where retained.resource_id =
        current_resource.id
        and retained.version_kind =
          'manual_save'
      order by retained.created_at desc
      limit 20
    );

  article_id := current_article.id;
  article_slug := current_article.slug;
  draft_version := current_article.draft_version;
  version_id := new_version_id;
  version_number := new_version_number;

  return next;
end;
$function$;

create or replace function public.create_article_autosave(
  p_article_id uuid,
  p_payload jsonb,
  p_expected_draft_version bigint
)
returns table (
  version_id uuid,
  version_number bigint,
  source_draft_version bigint,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $function$
declare
  current_article public.wk_articles%rowtype;
  current_resource editorial.resources%rowtype;
  new_version_id uuid;
  new_version_number bigint;
  new_created_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
  then
    raise exception 'Autosave payload must be a JSON object';
  end if;

  select article.*
  into current_article
  from public.wk_articles article
  where article.id = p_article_id;

  if not found then
    raise exception 'Article not found';
  end if;

  select resource.*
  into current_resource
  from editorial.article_resources binding
  join editorial.resources resource
    on resource.id = binding.resource_id
  where binding.article_id = p_article_id
  for update of resource;

  if not found then
    raise exception 'Article resource identity not found';
  end if;

  if not editorial.current_user_can_edit_article(
    current_resource.id
  ) then
    raise exception 'Permission denied';
  end if;

  if p_expected_draft_version is null
     or current_article.draft_version
        <> p_expected_draft_version
  then
    raise exception
      'STALE_ARTICLE_VERSION: expected %, current %',
      p_expected_draft_version,
      current_article.draft_version;
  end if;

  new_version_number :=
    editorial.next_article_version_number(
      current_resource.id
    );

  insert into editorial.article_versions (
    resource_id,
    article_id,
    version_number,
    version_kind,
    source_draft_version,
    title,
    slug,
    excerpt,
    content_html,
    author_display,
    owner_id,
    hero_image_id,
    hero_image_url,
    seo,
    lifecycle_state,
    wp_status,
    published_at,
    category_snapshot,
    tag_snapshot,
    created_by,
    content_fingerprint
  )
  values (
    current_resource.id,
    current_article.id,
    new_version_number,
    'autosave',
    current_article.draft_version,
    case
      when p_payload ? 'title'
        then p_payload ->> 'title'
      else current_article.title
    end,
    current_article.slug,
    case
      when p_payload ? 'excerpt'
        then p_payload ->> 'excerpt'
      else current_article.excerpt
    end,
    case
      when p_payload ? 'content_html'
        then p_payload ->> 'content_html'
      else current_article.content_html
    end,
    case
      when p_payload ? 'author'
        then p_payload ->> 'author'
      else current_article.author
    end,
    current_resource.owner_id,
    current_article.hero_image_id,
    current_article.hero_image_url,
    case
      when p_payload ? 'seo'
        then coalesce(
          p_payload -> 'seo',
          '{}'::jsonb
        )
      else current_article.seo
    end,
    current_resource.lifecycle_state,
    current_article.wp_status,
    current_article.published_at,
    current_article.categories,
    current_article.tags,
    auth.uid(),
    editorial.article_snapshot_fingerprint(
      case
        when p_payload ? 'title'
          then p_payload ->> 'title'
        else current_article.title
      end,
      current_article.slug,
      case
        when p_payload ? 'excerpt'
          then p_payload ->> 'excerpt'
        else current_article.excerpt
      end,
      case
        when p_payload ? 'content_html'
          then p_payload ->> 'content_html'
        else current_article.content_html
      end,
      case
        when p_payload ? 'author'
          then p_payload ->> 'author'
        else current_article.author
      end,
      current_article.hero_image_id,
      current_article.hero_image_url,
      case
        when p_payload ? 'seo'
          then coalesce(
            p_payload -> 'seo',
            '{}'::jsonb
          )
        else current_article.seo
      end,
      current_article.wp_status,
      current_article.published_at,
      current_article.categories,
      current_article.tags
    )
  )
  returning
    id,
    editorial.article_versions.created_at
  into
    new_version_id,
    new_created_at;

  delete from editorial.article_versions old_version
  where old_version.resource_id = current_resource.id
    and old_version.version_kind = 'autosave'
    and old_version.created_by = auth.uid()
    and old_version.id not in (
      select retained.id
      from editorial.article_versions retained
      where retained.resource_id =
        current_resource.id
        and retained.version_kind =
          'autosave'
        and retained.created_by =
          auth.uid()
      order by retained.created_at desc
      limit 20
    );

  version_id := new_version_id;
  version_number := new_version_number;
  source_draft_version :=
    current_article.draft_version;
  created_at := new_created_at;

  return next;
end;
$function$;

create or replace function public.get_latest_article_autosave(
  p_article_id uuid
)
returns table (
  version_id uuid,
  version_number bigint,
  source_draft_version bigint,
  title text,
  slug text,
  excerpt text,
  content_html text,
  author_display text,
  seo jsonb,
  category_snapshot jsonb,
  tag_snapshot jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $function$
declare
  resource_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select binding.resource_id
  into resource_id
  from editorial.article_resources binding
  where binding.article_id = p_article_id;

  if resource_id is null then
    raise exception 'Article resource identity not found';
  end if;

  if not editorial.current_user_can_edit_article(
    resource_id
  ) then
    raise exception 'Permission denied';
  end if;

  return query
  select
    version.id,
    version.version_number,
    version.source_draft_version,
    version.title,
    version.slug,
    version.excerpt,
    version.content_html,
    version.author_display,
    version.seo,
    version.category_snapshot,
    version.tag_snapshot,
    version.created_at
  from editorial.article_versions version
  where version.resource_id = resource_id
    and version.version_kind = 'autosave'
    and version.created_by = auth.uid()
  order by version.created_at desc
  limit 1;
end;
$function$;

alter table editorial.article_versions
  enable row level security;

alter table editorial.article_taxonomy_terms
  enable row level security;

revoke all
on table editorial.article_versions
from public, anon, authenticated;

revoke all
on table editorial.article_taxonomy_terms
from public, anon, authenticated;

grant select
on table editorial.article_versions
to authenticated;

grant select
on table editorial.article_taxonomy_terms
to authenticated;

create policy article_versions_authenticated_read
on editorial.article_versions
for select
to authenticated
using (
  editorial.current_user_can_edit_article(
    resource_id
  )
  or version_kind = 'submitted'
);

create policy article_taxonomy_terms_authenticated_read
on editorial.article_taxonomy_terms
for select
to authenticated
using (
  editorial.current_user_can_edit_article(
    resource_id
  )
);

revoke all
on function public.save_article_versioned(
  uuid,
  jsonb,
  bigint,
  text,
  uuid[]
)
from public, anon;

grant execute
on function public.save_article_versioned(
  uuid,
  jsonb,
  bigint,
  text,
  uuid[]
)
to authenticated;

revoke all
on function public.create_article_autosave(
  uuid,
  jsonb,
  bigint
)
from public, anon;

grant execute
on function public.create_article_autosave(
  uuid,
  jsonb,
  bigint
)
to authenticated;

revoke all
on function public.get_latest_article_autosave(
  uuid
)
from public, anon;

grant execute
on function public.get_latest_article_autosave(
  uuid
)
to authenticated;

revoke all
on function editorial.current_user_can_edit_article(
  uuid
)
from public, anon;

grant execute
on function editorial.current_user_can_edit_article(
  uuid
)
to authenticated;

comment on table editorial.article_versions is
  'Immutable reconstructable Article snapshots for autosave, manual save, submission and baseline history.';

comment on table editorial.article_taxonomy_terms is
  'Canonical normalized relationships between Article resources and registry taxonomy terms.';

comment on column public.wk_articles.draft_version is
  'Monotonic optimistic concurrency token for versioned Article saves.';

do $phase_2a_exit_gate$
declare
  article_count bigint;
  binding_count bigint;
  baseline_count bigint;
  pointer_count bigint;
begin
  select count(*)
  into article_count
  from public.wk_articles;

  select count(*)
  into binding_count
  from editorial.article_resources;

  select count(*)
  into baseline_count
  from editorial.article_versions
  where version_kind = 'baseline';

  select count(*)
  into pointer_count
  from editorial.resources
  where resource_kind = 'article'
    and current_working_version_id is not null;

  if binding_count <> article_count then
    raise exception
      'STOP: Article resource binding count mismatch';
  end if;

  if baseline_count <> article_count then
    raise exception
      'STOP: Article baseline version count mismatch';
  end if;

  if pointer_count <> article_count then
    raise exception
      'STOP: Article working version pointer count mismatch';
  end if;

  if exists (
    select 1
    from editorial.article_versions version
    join editorial.resources resource
      on resource.id = version.resource_id
    where resource.resource_kind <> 'article'
  ) then
    raise exception
      'STOP: Article version attached to a non-Article resource';
  end if;
end;
$phase_2a_exit_gate$;
