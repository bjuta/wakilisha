create or replace function editorial.current_user_can_review_article()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, editorial
as $function$
  select
    auth.role() = 'service_role'
    or coalesce(public.current_user_is_administrator(), false)
    or coalesce(public.current_user_has_capability('manage_review_queue'), false);
$function$;

revoke all on function editorial.current_user_can_review_article() from public;
grant execute on function editorial.current_user_can_review_article() to authenticated, service_role;

comment on function editorial.current_user_can_review_article()
is 'Returns true for users allowed to make governed Article review decisions.';

create or replace function public.list_article_lifecycle_events(
  p_article_id uuid,
  p_limit integer default 50
)
returns table (
  id uuid,
  article_id uuid,
  version_id uuid,
  version_number bigint,
  action text,
  prior_status text,
  resulting_status text,
  note text,
  metadata jsonb,
  actor_id uuid,
  actor_label text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $function$
declare
  v_limit integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_article_id is null then
    raise exception 'Article id is required';
  end if;

  v_limit := least(greatest(coalesce(p_limit, 50), 1), 100);

  if not exists (
    select 1
    from public.wk_articles article
    where article.id = p_article_id
  ) then
    raise exception 'Article not found';
  end if;

  return query
  select
    event.id,
    event.article_id,
    event.version_id,
    version.version_number,
    event.action,
    event.prior_status,
    event.resulting_status,
    event.note,
    event.metadata,
    event.actor_id,
    coalesce(actor.email, event.actor_id::text, 'system') as actor_label,
    event.created_at
  from editorial.article_lifecycle_events event
  left join editorial.article_versions version
    on version.id = event.version_id
  left join auth.users actor
    on actor.id = event.actor_id
  where event.article_id = p_article_id
  order by event.created_at desc, event.id desc
  limit v_limit;
end;
$function$;

revoke execute on function public.list_article_lifecycle_events(uuid, integer) from public;
grant execute on function public.list_article_lifecycle_events(uuid, integer) to authenticated;

comment on function public.list_article_lifecycle_events(uuid, integer)
is 'Returns article lifecycle history for the governed Article editor.';

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
    and version.kind = 'approved';

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
  v_publish_at timestamptz;
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

  v_source_version_id := coalesce(p_version_id, v_resource.current_approved_version_id);

  if v_source_version_id is null then
    raise exception 'Article must be approved before scheduling';
  end if;

  if v_resource.current_approved_version_id is null
    or v_source_version_id <> v_resource.current_approved_version_id
  then
    raise exception 'Only the approved article version can be scheduled';
  end if;

  perform 1
  from editorial.article_versions version
  where version.id = v_source_version_id
    and version.article_id = p_article_id
    and version.kind = 'approved';

  if not found then
    raise exception 'Only an approved article version can be scheduled';
  end if;

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
    current_approved_version_id = v_source_version_id,
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

revoke execute on function public.publish_article_version(uuid, uuid, timestamptz, text) from public;
revoke execute on function public.schedule_article_publication(uuid, uuid, timestamptz, text) from public;

grant execute on function public.publish_article_version(uuid, uuid, timestamptz, text) to authenticated;
grant execute on function public.schedule_article_publication(uuid, uuid, timestamptz, text) to authenticated;


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

  if nullif(btrim(p_note), '') is null then
    raise exception 'Requested changes note is required';
  end if;

  if not editorial.current_user_can_review_article() then
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

  if not editorial.current_user_can_review_article() then
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

revoke execute on function public.request_article_changes(uuid, uuid, text) from public;
revoke execute on function public.approve_article_version(uuid, uuid, text) from public;

grant execute on function public.request_article_changes(uuid, uuid, text) to authenticated;
grant execute on function public.approve_article_version(uuid, uuid, text) to authenticated;
