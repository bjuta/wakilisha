begin;

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
  effective_wp_status text;
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

  /*
   * Saving a working version must not perform a publication transition.
   * Dedicated lifecycle commands own publish, schedule, unpublish and archive.
   */
  effective_wp_status := current_article.wp_status;

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

  update public.wk_articles as article
  set
    title = case
      when p_payload ? 'title'
        then p_payload ->> 'title'
      else article.title
    end,
    slug = new_slug,
    excerpt = case
      when p_payload ? 'excerpt'
        then p_payload ->> 'excerpt'
      else article.excerpt
    end,
    content_html = case
      when p_payload ? 'content_html'
        then p_payload ->> 'content_html'
      else article.content_html
    end,
    author = case
      when p_payload ? 'author'
        then p_payload ->> 'author'
      else article.author
    end,
    published_at = case
      when p_payload ? 'published_at'
        then nullif(
          p_payload ->> 'published_at',
          ''
        )::timestamptz
      else article.published_at
    end,
    seo = case
      when p_payload ? 'seo'
        then coalesce(
          p_payload -> 'seo',
          '{}'::jsonb
        )
      else article.seo
    end,
    wp_status = effective_wp_status,
    hero_image_id = case
      when p_payload ? 'hero_image_id'
        then nullif(
          p_payload ->> 'hero_image_id',
          ''
        )::uuid
      else article.hero_image_id
    end,
    hero_image_url = case
      when p_payload ? 'hero_image_url'
        then p_payload ->> 'hero_image_url'
      else article.hero_image_url
    end,
    categories = new_categories,
    tags = new_tags,
    draft_version = article.draft_version + 1,
    modified_at = now(),
    updated_at = now()
  where article.id = p_article_id
  returning article.*
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

revoke all on function
  public.save_article_versioned(
    uuid,
    jsonb,
    bigint,
    text,
    uuid[]
  )
  from public, anon;

grant execute on function
  public.save_article_versioned(
    uuid,
    jsonb,
    bigint,
    text,
    uuid[]
  )
  to authenticated, service_role;

comment on function
  public.save_article_versioned(
    uuid,
    jsonb,
    bigint,
    text,
    uuid[]
  )
  is
  'Creates an immutable Article working or submitted version without changing publication status, visibility, or lifecycle state. Publication transitions remain owned by dedicated lifecycle commands.';

notify pgrst, 'reload schema';

commit;
