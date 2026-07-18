-- Phase 2B Article lifecycle authority.
--
-- Establishes first-class review, approval, scheduling, publication,
-- archive, restore, and stable public publication snapshots for Articles.

alter table editorial.article_versions
  drop constraint if exists article_versions_kind_check;

alter table editorial.article_versions
  add constraint article_versions_kind_check
  check (
    version_kind in (
      'baseline',
      'autosave',
      'manual_save',
      'submitted',
      'approved',
      'scheduled',
      'published'
    )
  );

alter table editorial.resources
  add column if not exists current_approved_version_id uuid
    references editorial.article_versions(id)
    on delete set null,
  add column if not exists current_published_version_id uuid
    references editorial.article_versions(id)
    on delete set null;

create table if not exists editorial.article_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null
    references editorial.resources(id)
    on update cascade
    on delete cascade,
  article_id uuid not null
    references public.wk_articles(id)
    on update cascade
    on delete cascade,
  version_id uuid
    references editorial.article_versions(id)
    on update cascade
    on delete set null,
  action text not null,
  prior_status text,
  resulting_status text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  actor_id uuid default auth.uid()
    references auth.users(id)
    on delete set null,
  created_at timestamptz not null default now(),

  constraint article_lifecycle_events_action_check
    check (
      action in (
        'submitted',
        'changes_requested',
        'approved',
        'scheduled',
        'published',
        'unpublished',
        'archived',
        'restored'
      )
    )
);

create index if not exists article_lifecycle_events_article_idx
  on editorial.article_lifecycle_events (
    article_id,
    created_at desc
  );

create index if not exists article_lifecycle_events_resource_idx
  on editorial.article_lifecycle_events (
    resource_id,
    created_at desc
  );

create table if not exists editorial.article_scheduled_publications (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null
    references editorial.resources(id)
    on update cascade
    on delete cascade,
  article_id uuid not null
    references public.wk_articles(id)
    on update cascade
    on delete cascade,
  version_id uuid not null
    references editorial.article_versions(id)
    on update cascade
    on delete restrict,
  run_after timestamptz not null,
  status text not null default 'scheduled',
  note text,
  created_by uuid default auth.uid()
    references auth.users(id)
    on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint article_scheduled_publications_status_check
    check (
      status in (
        'scheduled',
        'published',
        'cancelled',
        'failed'
      )
    )
);

create index if not exists article_scheduled_publications_due_idx
  on editorial.article_scheduled_publications (
    status,
    run_after
  );

create table if not exists public.wk_article_publication_snapshots (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null
    references public.wk_articles(id)
    on update cascade
    on delete cascade,
  resource_id uuid not null
    references editorial.resources(id)
    on update cascade
    on delete cascade,
  version_id uuid not null
    references editorial.article_versions(id)
    on update cascade
    on delete restrict,
  slug text not null,
  title text,
  excerpt text,
  content_html text,
  author text,
  published_at timestamptz,
  modified_at timestamptz,
  categories jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  seo jsonb not null default '{}'::jsonb,
  hero_image_id uuid,
  hero_image_url text,
  raw_meta jsonb not null default '{}'::jsonb,
  wp_status text not null default 'publish',
  first_published_at timestamptz,
  last_materially_updated_at timestamptz,
  published_by uuid
    references auth.users(id)
    on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint wk_article_publication_snapshots_slug_not_blank
    check (btrim(slug) <> '')
);

create unique index if not exists wk_article_publication_snapshots_active_article_uidx
  on public.wk_article_publication_snapshots(article_id)
  where is_active;

create unique index if not exists wk_article_publication_snapshots_active_slug_uidx
  on public.wk_article_publication_snapshots(slug)
  where is_active;

create index if not exists wk_article_publication_snapshots_published_idx
  on public.wk_article_publication_snapshots (
    is_active,
    published_at desc
  );

alter table public.wk_article_publication_snapshots
  enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'wk_article_publication_snapshots'
      and policyname = 'Active article publication snapshots are public readable'
  ) then
    create policy "Active article publication snapshots are public readable"
      on public.wk_article_publication_snapshots
      for select
      using (is_active = true);
  end if;
end;
$$;

grant select on public.wk_article_publication_snapshots
  to anon, authenticated;

create or replace function editorial.current_user_can_publish_article()
returns boolean
language sql
security definer
set search_path = pg_catalog, public
as $function$
  select coalesce(public.current_user_is_administrator(), false)
      or coalesce(public.current_user_has_capability('publish_articles'), false);
$function$;

revoke all on function editorial.current_user_can_publish_article()
  from public;

create or replace function editorial.insert_article_lifecycle_version_from_article(
  p_resource editorial.resources,
  p_article public.wk_articles,
  p_version_kind text,
  p_lifecycle_state text
)
returns table (
  version_id uuid,
  version_number bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $function$
declare
  v_version_id uuid;
  v_version_number bigint;
begin
  v_version_number :=
    editorial.next_article_version_number(
      p_resource.id
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
    p_resource.id,
    p_article.id,
    v_version_number,
    p_version_kind,
    p_article.draft_version,
    p_article.title,
    p_article.slug,
    p_article.excerpt,
    p_article.content_html,
    p_article.author,
    p_resource.owner_id,
    p_article.hero_image_id,
    p_article.hero_image_url,
    p_article.seo,
    p_lifecycle_state,
    p_article.wp_status,
    p_article.published_at,
    p_article.categories,
    p_article.tags,
    auth.uid(),
    editorial.article_snapshot_fingerprint(
      p_article.title,
      p_article.slug,
      p_article.excerpt,
      p_article.content_html,
      p_article.author,
      p_article.hero_image_id,
      p_article.hero_image_url,
      p_article.seo,
      p_article.wp_status,
      p_article.published_at,
      p_article.categories,
      p_article.tags
    )
  )
  returning id
  into v_version_id;

  version_id := v_version_id;
  version_number := v_version_number;
  return next;
end;
$function$;

revoke all on function editorial.insert_article_lifecycle_version_from_article(
  editorial.resources,
  public.wk_articles,
  text,
  text
)
from public;

create or replace function editorial.copy_article_lifecycle_version(
  p_source_version_id uuid,
  p_version_kind text,
  p_lifecycle_state text,
  p_wp_status text,
  p_published_at timestamptz default null
)
returns table (
  version_id uuid,
  version_number bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $function$
declare
  v_source editorial.article_versions%rowtype;
  v_version_id uuid;
  v_version_number bigint;
begin
  select version.*
  into v_source
  from editorial.article_versions version
  where version.id = p_source_version_id;

  if not found then
    raise exception 'Article version not found';
  end if;

  v_version_number :=
    editorial.next_article_version_number(
      v_source.resource_id
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
    v_source.resource_id,
    v_source.article_id,
    v_version_number,
    p_version_kind,
    v_source.source_draft_version,
    v_source.title,
    v_source.slug,
    v_source.excerpt,
    v_source.content_html,
    v_source.author_display,
    v_source.owner_id,
    v_source.hero_image_id,
    v_source.hero_image_url,
    v_source.seo,
    p_lifecycle_state,
    p_wp_status,
    coalesce(p_published_at, v_source.published_at),
    v_source.category_snapshot,
    v_source.tag_snapshot,
    auth.uid(),
    v_source.content_fingerprint
  )
  returning id
  into v_version_id;

  version_id := v_version_id;
  version_number := v_version_number;
  return next;
end;
$function$;

revoke all on function editorial.copy_article_lifecycle_version(
  uuid,
  text,
  text,
  text,
  timestamptz
)
from public;

create or replace function editorial.publish_article_snapshot(
  p_version_id uuid,
  p_published_at timestamptz,
  p_material_update boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $function$
declare
  v_version editorial.article_versions%rowtype;
  v_article public.wk_articles%rowtype;
  v_previous public.wk_article_publication_snapshots%rowtype;
  v_snapshot_id uuid;
  v_first_published_at timestamptz;
begin
  select version.*
  into v_version
  from editorial.article_versions version
  where version.id = p_version_id;

  if not found then
    raise exception 'Article version not found';
  end if;

  select article.*
  into v_article
  from public.wk_articles article
  where article.id = v_version.article_id;

  if not found then
    raise exception 'Article not found';
  end if;

  select snapshot.*
  into v_previous
  from public.wk_article_publication_snapshots snapshot
  where snapshot.article_id = v_version.article_id
    and snapshot.is_active = true
  order by snapshot.created_at desc
  limit 1;

  v_first_published_at :=
    coalesce(
      v_previous.first_published_at,
      p_published_at,
      now()
    );

  update public.wk_article_publication_snapshots snapshot
  set
    is_active = false,
    updated_at = now()
  where snapshot.article_id = v_version.article_id
    and snapshot.is_active = true;

  insert into public.wk_article_publication_snapshots (
    article_id,
    resource_id,
    version_id,
    slug,
    title,
    excerpt,
    content_html,
    author,
    published_at,
    modified_at,
    categories,
    tags,
    seo,
    hero_image_id,
    hero_image_url,
    raw_meta,
    wp_status,
    first_published_at,
    last_materially_updated_at,
    published_by,
    is_active
  )
  values (
    v_version.article_id,
    v_version.resource_id,
    v_version.id,
    v_version.slug,
    v_version.title,
    v_version.excerpt,
    v_version.content_html,
    v_version.author_display,
    coalesce(p_published_at, now()),
    now(),
    v_version.category_snapshot,
    v_version.tag_snapshot,
    v_version.seo,
    v_version.hero_image_id,
    v_version.hero_image_url,
    coalesce(v_article.raw_meta, '{}'::jsonb),
    'publish',
    v_first_published_at,
    case
      when p_material_update
        then now()
      else coalesce(v_previous.last_materially_updated_at, now())
    end,
    auth.uid(),
    true
  )
  returning id
  into v_snapshot_id;

  return v_snapshot_id;
end;
$function$;

revoke all on function editorial.publish_article_snapshot(
  uuid,
  timestamptz,
  boolean
)
from public;

create or replace function public.submit_article_for_review(
  p_article_id uuid,
  p_expected_draft_version bigint,
  p_note text default null
)
returns table (
  article_id uuid,
  article_slug text,
  draft_version bigint,
  version_id uuid,
  version_number bigint,
  lifecycle_status text
)
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $function$
declare
  v_article public.wk_articles%rowtype;
  v_resource editorial.resources%rowtype;
  v_prior_status text;
  v_version_id uuid;
  v_version_number bigint;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select article.*
  into v_article
  from public.wk_articles article
  where article.id = p_article_id
  for update;

  if not found then
    raise exception 'Article not found';
  end if;

  select resource.*
  into v_resource
  from editorial.article_resources binding
  join editorial.resources resource
    on resource.id = binding.resource_id
  where binding.article_id = p_article_id
  for update of resource;

  if not found then
    raise exception 'Article resource identity not found';
  end if;

  if not editorial.current_user_can_edit_article(v_resource.id) then
    raise exception 'Permission denied';
  end if;

  if v_article.draft_version <> p_expected_draft_version then
    raise exception
      'STALE_ARTICLE_VERSION: expected %, current %',
      p_expected_draft_version,
      v_article.draft_version;
  end if;

  v_prior_status := v_article.wp_status;

  update public.wk_articles as article
  set
    wp_status = 'pending',
    draft_version = article.draft_version + 1,
    updated_at = now(),
    modified_at = now()
  where article.id = p_article_id
  returning article.*
  into v_article;

  select created.version_id, created.version_number
  into v_version_id, v_version_number
  from editorial.insert_article_lifecycle_version_from_article(
    v_resource,
    v_article,
    'submitted',
    'submitted'
  ) created;

  update editorial.resources
  set
    current_submitted_version_id = v_version_id,
    lifecycle_state = 'active',
    visibility = 'private',
    updated_at = now()
  where id = v_resource.id;

  insert into editorial.article_lifecycle_events (
    resource_id,
    article_id,
    version_id,
    action,
    prior_status,
    resulting_status,
    note
  )
  values (
    v_resource.id,
    p_article_id,
    v_version_id,
    'submitted',
    v_prior_status,
    'pending',
    p_note
  );

  article_id := p_article_id;
  article_slug := v_article.slug;
  draft_version := v_article.draft_version;
  version_id := v_version_id;
  version_number := v_version_number;
  lifecycle_status := 'submitted';
  return next;
end;
$function$;

create or replace function public.request_article_changes(
  p_article_id uuid,
  p_version_id uuid default null,
  p_note text default null
)
returns table (
  article_id uuid,
  article_slug text,
  draft_version bigint,
  version_id uuid,
  version_number bigint,
  lifecycle_status text
)
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $function$
declare
  v_article public.wk_articles%rowtype;
  v_resource editorial.resources%rowtype;
  v_target_version_id uuid;
  v_target_number bigint;
  v_prior_status text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not editorial.current_user_can_publish_article() then
    raise exception 'Permission denied';
  end if;

  select article.*
  into v_article
  from public.wk_articles article
  where article.id = p_article_id
  for update;

  if not found then
    raise exception 'Article not found';
  end if;

  select resource.*
  into v_resource
  from editorial.article_resources binding
  join editorial.resources resource
    on resource.id = binding.resource_id
  where binding.article_id = p_article_id
  for update of resource;

  if not found then
    raise exception 'Article resource identity not found';
  end if;

  v_target_version_id :=
    coalesce(
      p_version_id,
      v_resource.current_submitted_version_id,
      v_resource.current_working_version_id
    );

  select version.version_number
  into v_target_number
  from editorial.article_versions version
  where version.id = v_target_version_id
    and version.article_id = p_article_id;

  if not found then
    raise exception 'Article version not found';
  end if;

  v_prior_status := v_article.wp_status;

  update public.wk_articles as article
  set
    wp_status = 'draft',
    draft_version = article.draft_version + 1,
    updated_at = now(),
    modified_at = now()
  where article.id = p_article_id
  returning article.*
  into v_article;

  update editorial.resources
  set
    lifecycle_state = 'draft',
    visibility = 'private',
    updated_at = now()
  where id = v_resource.id;

  insert into editorial.article_lifecycle_events (
    resource_id,
    article_id,
    version_id,
    action,
    prior_status,
    resulting_status,
    note
  )
  values (
    v_resource.id,
    p_article_id,
    v_target_version_id,
    'changes_requested',
    v_prior_status,
    'draft',
    p_note
  );

  article_id := p_article_id;
  article_slug := v_article.slug;
  draft_version := v_article.draft_version;
  version_id := v_target_version_id;
  version_number := v_target_number;
  lifecycle_status := 'changes_requested';
  return next;
end;
$function$;

create or replace function public.approve_article_version(
  p_article_id uuid,
  p_version_id uuid default null,
  p_note text default null
)
returns table (
  article_id uuid,
  article_slug text,
  draft_version bigint,
  version_id uuid,
  version_number bigint,
  lifecycle_status text
)
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $function$
declare
  v_article public.wk_articles%rowtype;
  v_resource editorial.resources%rowtype;
  v_source_version_id uuid;
  v_version_id uuid;
  v_version_number bigint;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not editorial.current_user_can_publish_article() then
    raise exception 'Permission denied';
  end if;

  select article.*
  into v_article
  from public.wk_articles article
  where article.id = p_article_id
  for update;

  if not found then
    raise exception 'Article not found';
  end if;

  select resource.*
  into v_resource
  from editorial.article_resources binding
  join editorial.resources resource
    on resource.id = binding.resource_id
  where binding.article_id = p_article_id
  for update of resource;

  if not found then
    raise exception 'Article resource identity not found';
  end if;

  v_source_version_id :=
    coalesce(
      p_version_id,
      v_resource.current_submitted_version_id,
      v_resource.current_working_version_id
    );

  select copied.version_id, copied.version_number
  into v_version_id, v_version_number
  from editorial.copy_article_lifecycle_version(
    v_source_version_id,
    'approved',
    'approved',
    'pending',
    null
  ) copied;

  update editorial.resources
  set
    current_approved_version_id = v_version_id,
    lifecycle_state = 'active',
    visibility = 'private',
    updated_at = now()
  where id = v_resource.id;

  insert into editorial.article_lifecycle_events (
    resource_id,
    article_id,
    version_id,
    action,
    prior_status,
    resulting_status,
    note
  )
  values (
    v_resource.id,
    p_article_id,
    v_version_id,
    'approved',
    v_article.wp_status,
    'approved',
    p_note
  );

  article_id := p_article_id;
  article_slug := v_article.slug;
  draft_version := v_article.draft_version;
  version_id := v_version_id;
  version_number := v_version_number;
  lifecycle_status := 'approved';
  return next;
end;
$function$;

create or replace function public.publish_article_version(
  p_article_id uuid,
  p_version_id uuid default null,
  p_published_at timestamptz default now(),
  p_note text default null
)
returns table (
  article_id uuid,
  article_slug text,
  draft_version bigint,
  version_id uuid,
  version_number bigint,
  lifecycle_status text
)
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $function$
declare
  v_article public.wk_articles%rowtype;
  v_resource editorial.resources%rowtype;
  v_source_version_id uuid;
  v_version_id uuid;
  v_version_number bigint;
  v_prior_status text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not editorial.current_user_can_publish_article() then
    raise exception 'Permission denied';
  end if;

  select article.*
  into v_article
  from public.wk_articles article
  where article.id = p_article_id
  for update;

  if not found then
    raise exception 'Article not found';
  end if;

  select resource.*
  into v_resource
  from editorial.article_resources binding
  join editorial.resources resource
    on resource.id = binding.resource_id
  where binding.article_id = p_article_id
  for update of resource;

  if not found then
    raise exception 'Article resource identity not found';
  end if;

  v_source_version_id :=
    coalesce(
      p_version_id,
      v_resource.current_approved_version_id,
      v_resource.current_submitted_version_id,
      v_resource.current_working_version_id
    );

  v_prior_status := v_article.wp_status;

  select copied.version_id, copied.version_number
  into v_version_id, v_version_number
  from editorial.copy_article_lifecycle_version(
    v_source_version_id,
    'published',
    'published',
    'publish',
    p_published_at
  ) copied;

  perform editorial.publish_article_snapshot(
    v_version_id,
    p_published_at,
    true
  );

  update public.wk_articles as article
  set
    wp_status = 'publish',
    published_at = p_published_at,
    updated_at = now()
  where article.id = p_article_id
  returning article.*
  into v_article;

  update editorial.resources
  set
    current_published_version_id = v_version_id,
    lifecycle_state = 'published',
    visibility = 'public',
    updated_at = now()
  where id = v_resource.id;

  insert into editorial.article_lifecycle_events (
    resource_id,
    article_id,
    version_id,
    action,
    prior_status,
    resulting_status,
    note
  )
  values (
    v_resource.id,
    p_article_id,
    v_version_id,
    'published',
    v_prior_status,
    'publish',
    p_note
  );

  article_id := p_article_id;
  article_slug := v_article.slug;
  draft_version := v_article.draft_version;
  version_id := v_version_id;
  version_number := v_version_number;
  lifecycle_status := 'published';
  return next;
end;
$function$;

create or replace function public.schedule_article_publication(
  p_article_id uuid,
  p_version_id uuid default null,
  p_publish_at timestamptz default null,
  p_note text default null
)
returns table (
  article_id uuid,
  article_slug text,
  draft_version bigint,
  version_id uuid,
  version_number bigint,
  lifecycle_status text
)
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $function$
declare
  v_article public.wk_articles%rowtype;
  v_resource editorial.resources%rowtype;
  v_source_version_id uuid;
  v_version_id uuid;
  v_version_number bigint;
  v_publish_at timestamptz;
  v_prior_status text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not editorial.current_user_can_publish_article() then
    raise exception 'Permission denied';
  end if;

  v_publish_at := coalesce(p_publish_at, now());

  if v_publish_at <= now() then
    raise exception 'Scheduled publish time must be in the future';
  end if;

  select article.*
  into v_article
  from public.wk_articles article
  where article.id = p_article_id
  for update;

  if not found then
    raise exception 'Article not found';
  end if;

  select resource.*
  into v_resource
  from editorial.article_resources binding
  join editorial.resources resource
    on resource.id = binding.resource_id
  where binding.article_id = p_article_id
  for update of resource;

  if not found then
    raise exception 'Article resource identity not found';
  end if;

  v_source_version_id :=
    coalesce(
      p_version_id,
      v_resource.current_approved_version_id,
      v_resource.current_submitted_version_id,
      v_resource.current_working_version_id
    );

  v_prior_status := v_article.wp_status;

  select copied.version_id, copied.version_number
  into v_version_id, v_version_number
  from editorial.copy_article_lifecycle_version(
    v_source_version_id,
    'scheduled',
    'scheduled',
    'future',
    v_publish_at
  ) copied;

  insert into editorial.article_scheduled_publications (
    resource_id,
    article_id,
    version_id,
    run_after,
    note
  )
  values (
    v_resource.id,
    p_article_id,
    v_version_id,
    v_publish_at,
    p_note
  );

  update public.wk_articles as article
  set
    wp_status = 'future',
    published_at = v_publish_at,
    updated_at = now()
  where article.id = p_article_id
  returning article.*
  into v_article;

  update editorial.resources
  set
    current_approved_version_id = coalesce(current_approved_version_id, v_source_version_id),
    lifecycle_state = 'active',
    visibility = 'private',
    updated_at = now()
  where id = v_resource.id;

  insert into editorial.article_lifecycle_events (
    resource_id,
    article_id,
    version_id,
    action,
    prior_status,
    resulting_status,
    note,
    metadata
  )
  values (
    v_resource.id,
    p_article_id,
    v_version_id,
    'scheduled',
    v_prior_status,
    'future',
    p_note,
    jsonb_build_object(
      'publishAt',
      v_publish_at
    )
  );

  article_id := p_article_id;
  article_slug := v_article.slug;
  draft_version := v_article.draft_version;
  version_id := v_version_id;
  version_number := v_version_number;
  lifecycle_status := 'scheduled';
  return next;
end;
$function$;


create or replace function public.unpublish_article(
  p_article_id uuid,
  p_note text default null
)
returns table (
  article_id uuid,
  article_slug text,
  draft_version bigint,
  version_id uuid,
  version_number bigint,
  lifecycle_status text
)
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $function$
declare
  v_article public.wk_articles%rowtype;
  v_resource editorial.resources%rowtype;
  v_prior_status text;
  v_target_version_id uuid;
  v_target_number bigint;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not editorial.current_user_can_publish_article() then
    raise exception 'Permission denied';
  end if;

  select article.*
  into v_article
  from public.wk_articles article
  where article.id = p_article_id
  for update;

  if not found then
    raise exception 'Article not found';
  end if;

  select resource.*
  into v_resource
  from editorial.article_resources binding
  join editorial.resources resource
    on resource.id = binding.resource_id
  where binding.article_id = p_article_id
  for update of resource;

  if not found then
    raise exception 'Article resource identity not found';
  end if;

  v_prior_status := v_article.wp_status;
  v_target_version_id :=
    coalesce(
      v_resource.current_published_version_id,
      v_resource.current_working_version_id
    );

  select version.version_number
  into v_target_number
  from editorial.article_versions version
  where version.id = v_target_version_id;

  update public.wk_article_publication_snapshots snapshot
  set
    is_active = false,
    updated_at = now()
  where snapshot.article_id = p_article_id
    and snapshot.is_active = true;

  update public.wk_articles as article
  set
    wp_status = 'draft',
    draft_version = article.draft_version + 1,
    updated_at = now(),
    modified_at = now()
  where article.id = p_article_id
  returning article.*
  into v_article;

  update editorial.resources
  set
    lifecycle_state = 'draft',
    visibility = 'private',
    updated_at = now()
  where id = v_resource.id;

  insert into editorial.article_lifecycle_events (
    resource_id,
    article_id,
    version_id,
    action,
    prior_status,
    resulting_status,
    note
  )
  values (
    v_resource.id,
    p_article_id,
    v_target_version_id,
    'unpublished',
    v_prior_status,
    'draft',
    p_note
  );

  article_id := p_article_id;
  article_slug := v_article.slug;
  draft_version := v_article.draft_version;
  version_id := v_target_version_id;
  version_number := coalesce(v_target_number, 0);
  lifecycle_status := 'unpublished';
  return next;
end;
$function$;

create or replace function public.archive_article(
  p_article_id uuid,
  p_note text default null
)
returns table (
  article_id uuid,
  article_slug text,
  draft_version bigint,
  version_id uuid,
  version_number bigint,
  lifecycle_status text
)
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $function$
declare
  v_article public.wk_articles%rowtype;
  v_resource editorial.resources%rowtype;
  v_prior_status text;
  v_target_version_id uuid;
  v_target_number bigint;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not editorial.current_user_can_publish_article() then
    raise exception 'Permission denied';
  end if;

  select article.*
  into v_article
  from public.wk_articles article
  where article.id = p_article_id
  for update;

  if not found then
    raise exception 'Article not found';
  end if;

  select resource.*
  into v_resource
  from editorial.article_resources binding
  join editorial.resources resource
    on resource.id = binding.resource_id
  where binding.article_id = p_article_id
  for update of resource;

  if not found then
    raise exception 'Article resource identity not found';
  end if;

  v_prior_status := v_article.wp_status;
  v_target_version_id :=
    coalesce(
      v_resource.current_published_version_id,
      v_resource.current_working_version_id
    );

  select version.version_number
  into v_target_number
  from editorial.article_versions version
  where version.id = v_target_version_id;

  update public.wk_articles as article
  set
    wp_status = 'trash',
    draft_version = article.draft_version + 1,
    updated_at = now(),
    modified_at = now()
  where article.id = p_article_id
  returning article.*
  into v_article;

  update public.wk_article_publication_snapshots snapshot
  set
    is_active = false,
    updated_at = now()
  where snapshot.article_id = p_article_id
    and snapshot.is_active = true;

  update editorial.resources
  set
    lifecycle_state = 'archived',
    visibility = 'private',
    updated_at = now()
  where id = v_resource.id;

  insert into editorial.article_lifecycle_events (
    resource_id,
    article_id,
    version_id,
    action,
    prior_status,
    resulting_status,
    note
  )
  values (
    v_resource.id,
    p_article_id,
    v_target_version_id,
    'archived',
    v_prior_status,
    'trash',
    p_note
  );

  article_id := p_article_id;
  article_slug := v_article.slug;
  draft_version := v_article.draft_version;
  version_id := v_target_version_id;
  version_number := coalesce(v_target_number, 0);
  lifecycle_status := 'archived';
  return next;
end;
$function$;

create or replace function public.restore_article_from_archive(
  p_article_id uuid,
  p_note text default null
)
returns table (
  article_id uuid,
  article_slug text,
  draft_version bigint,
  version_id uuid,
  version_number bigint,
  lifecycle_status text
)
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $function$
declare
  v_article public.wk_articles%rowtype;
  v_resource editorial.resources%rowtype;
  v_prior_status text;
  v_target_version_id uuid;
  v_target_number bigint;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select article.*
  into v_article
  from public.wk_articles article
  where article.id = p_article_id
  for update;

  if not found then
    raise exception 'Article not found';
  end if;

  select resource.*
  into v_resource
  from editorial.article_resources binding
  join editorial.resources resource
    on resource.id = binding.resource_id
  where binding.article_id = p_article_id
  for update of resource;

  if not found then
    raise exception 'Article resource identity not found';
  end if;

  if not editorial.current_user_can_edit_article(v_resource.id) then
    raise exception 'Permission denied';
  end if;

  v_prior_status := v_article.wp_status;
  v_target_version_id :=
    coalesce(
      v_resource.current_working_version_id,
      v_resource.current_published_version_id
    );

  select version.version_number
  into v_target_number
  from editorial.article_versions version
  where version.id = v_target_version_id;

  update public.wk_articles as article
  set
    wp_status = 'draft',
    draft_version = article.draft_version + 1,
    updated_at = now(),
    modified_at = now()
  where article.id = p_article_id
  returning article.*
  into v_article;

  update editorial.resources
  set
    lifecycle_state = 'draft',
    visibility = 'private',
    updated_at = now()
  where id = v_resource.id;

  insert into editorial.article_lifecycle_events (
    resource_id,
    article_id,
    version_id,
    action,
    prior_status,
    resulting_status,
    note
  )
  values (
    v_resource.id,
    p_article_id,
    v_target_version_id,
    'restored',
    v_prior_status,
    'draft',
    p_note
  );

  article_id := p_article_id;
  article_slug := v_article.slug;
  draft_version := v_article.draft_version;
  version_id := v_target_version_id;
  version_number := coalesce(v_target_number, 0);
  lifecycle_status := 'restored';
  return next;
end;
$function$;


create or replace function public.publish_due_article_publications(
  p_limit integer default 25
)
returns table (
  article_id uuid,
  article_slug text,
  schedule_id uuid,
  version_id uuid,
  published_at timestamptz,
  status text
)
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $function$
declare
  due_schedule editorial.article_scheduled_publications%rowtype;
  v_article public.wk_articles%rowtype;
  v_resource editorial.resources%rowtype;
  v_version_id uuid;
  v_version_number bigint;
  v_limit integer;
begin
  if auth.role() <> 'service_role'
     and not editorial.current_user_can_publish_article()
  then
    raise exception 'Permission denied';
  end if;

  v_limit := least(greatest(coalesce(p_limit, 25), 1), 100);

  for due_schedule in
    select scheduled.*
    from editorial.article_scheduled_publications scheduled
    where scheduled.status = 'scheduled'
      and scheduled.run_after <= now()
    order by scheduled.run_after asc
    limit v_limit
    for update skip locked
  loop
    select article.*
    into v_article
    from public.wk_articles article
    where article.id = due_schedule.article_id
    for update;

    if not found then
      update editorial.article_scheduled_publications
      set
        status = 'failed',
        updated_at = now()
      where id = due_schedule.id;

      continue;
    end if;

    select resource.*
    into v_resource
    from editorial.resources resource
    where resource.id = due_schedule.resource_id
    for update;

    if not found then
      update editorial.article_scheduled_publications
      set
        status = 'failed',
        updated_at = now()
      where id = due_schedule.id;

      continue;
    end if;

    select copied.version_id, copied.version_number
    into v_version_id, v_version_number
    from editorial.copy_article_lifecycle_version(
      due_schedule.version_id,
      'published',
      'published',
      'publish',
      due_schedule.run_after
    ) copied;

    perform editorial.publish_article_snapshot(
      v_version_id,
      due_schedule.run_after,
      true
    );

    update public.wk_articles as article
    set
      wp_status = 'publish',
      published_at = due_schedule.run_after,
      updated_at = now()
    where article.id = due_schedule.article_id
    returning article.*
    into v_article;

    update editorial.resources
    set
      current_published_version_id = v_version_id,
      lifecycle_state = 'published',
      visibility = 'public',
      updated_at = now()
    where id = due_schedule.resource_id;

    update editorial.article_scheduled_publications
    set
      status = 'published',
      updated_at = now()
    where id = due_schedule.id;

    insert into editorial.article_lifecycle_events (
      resource_id,
      article_id,
      version_id,
      action,
      prior_status,
      resulting_status,
      note,
      metadata
    )
    values (
      due_schedule.resource_id,
      due_schedule.article_id,
      v_version_id,
      'published',
      'future',
      'publish',
      due_schedule.note,
      jsonb_build_object(
        'scheduledPublicationId',
        due_schedule.id,
        'scheduledFor',
        due_schedule.run_after
      )
    );

    article_id := due_schedule.article_id;
    article_slug := v_article.slug;
    schedule_id := due_schedule.id;
    version_id := v_version_id;
    published_at := due_schedule.run_after;
    status := 'published';
    return next;
  end loop;
end;
$function$;

revoke execute on function public.submit_article_for_review(uuid, bigint, text) from public;
revoke execute on function public.request_article_changes(uuid, uuid, text) from public;
revoke execute on function public.approve_article_version(uuid, uuid, text) from public;
revoke execute on function public.publish_article_version(uuid, uuid, timestamptz, text) from public;
revoke execute on function public.schedule_article_publication(uuid, uuid, timestamptz, text) from public;
revoke execute on function public.unpublish_article(uuid, text) from public;
revoke execute on function public.archive_article(uuid, text) from public;
revoke execute on function public.restore_article_from_archive(uuid, text) from public;
revoke execute on function public.publish_due_article_publications(integer) from public;

grant execute on function public.submit_article_for_review(uuid, bigint, text) to authenticated;
grant execute on function public.request_article_changes(uuid, uuid, text) to authenticated;
grant execute on function public.approve_article_version(uuid, uuid, text) to authenticated;
grant execute on function public.publish_article_version(uuid, uuid, timestamptz, text) to authenticated;
grant execute on function public.schedule_article_publication(uuid, uuid, timestamptz, text) to authenticated;
grant execute on function public.unpublish_article(uuid, text) to authenticated;
grant execute on function public.archive_article(uuid, text) to authenticated;
grant execute on function public.restore_article_from_archive(uuid, text) to authenticated;
grant execute on function public.publish_due_article_publications(integer) to authenticated, service_role;

insert into public.wk_article_publication_snapshots (
  article_id,
  resource_id,
  version_id,
  slug,
  title,
  excerpt,
  content_html,
  author,
  published_at,
  modified_at,
  categories,
  tags,
  seo,
  hero_image_id,
  hero_image_url,
  raw_meta,
  wp_status,
  first_published_at,
  last_materially_updated_at,
  published_by,
  is_active
)
select
  article.id,
  binding.resource_id,
  version.id,
  article.slug,
  article.title,
  article.excerpt,
  article.content_html,
  article.author,
  article.published_at,
  article.modified_at,
  article.categories,
  article.tags,
  article.seo,
  article.hero_image_id,
  article.hero_image_url,
  coalesce(article.raw_meta, '{}'::jsonb),
  'publish',
  article.published_at,
  article.modified_at,
  null::uuid,
  true
from public.wk_articles article
join editorial.article_resources binding
  on binding.article_id = article.id
left join lateral (
  select article_version.*
  from editorial.article_versions article_version
  where article_version.article_id = article.id
  order by article_version.created_at desc
  limit 1
) version on true
where article.wp_status = 'publish'
  and version.id is not null
  and not exists (
    select 1
    from public.wk_article_publication_snapshots snapshot
    where snapshot.article_id = article.id
      and snapshot.is_active = true
  );

update editorial.resources resource
set
  current_published_version_id = snapshot.version_id,
  lifecycle_state = 'published',
  visibility = 'public',
  updated_at = now()
from public.wk_article_publication_snapshots snapshot
where snapshot.resource_id = resource.id
  and snapshot.is_active = true
  and resource.current_published_version_id is null;
