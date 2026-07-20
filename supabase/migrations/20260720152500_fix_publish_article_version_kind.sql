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

  v_source_version_id := coalesce(p_version_id, v_resource.current_approved_version_id);

  if v_source_version_id is null then
    raise exception 'Article must be approved before publication';
  end if;

  if v_resource.current_approved_version_id is null
    or v_source_version_id <> v_resource.current_approved_version_id
  then
    raise exception 'Only the approved article version can be published';
  end if;

  perform 1
  from editorial.article_versions version
  where version.id = v_source_version_id
    and version.article_id = p_article_id
    and version.version_kind = 'approved';

  if not found then
    raise exception 'Only an approved article version can be published';
  end if;

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

revoke execute on function public.publish_article_version(uuid, uuid, timestamptz, text) from public;
grant execute on function public.publish_article_version(uuid, uuid, timestamptz, text) to authenticated;

comment on function public.publish_article_version(uuid, uuid, timestamptz, text)
is 'Publishes the approved article version.';
