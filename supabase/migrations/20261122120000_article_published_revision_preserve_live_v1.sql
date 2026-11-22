-- Published Article corrections retain the active publication until explicit republish.
-- Exact Production RPC source definitions pinned; no historical or snapshot DML.
BEGIN;
DO $guard$ BEGIN
  if md5(pg_get_functiondef('public.approve_article_version(uuid,uuid,text)'::regprocedure)) <> '707058aadc9c53746bfcaaa62d893f7f' then raise exception 'STOP: approve_article_version definition drift'; end if;
  if md5(pg_get_functiondef('public.request_article_changes(uuid,uuid,text)'::regprocedure)) <> '0421228df4bf205da2f663cc14c41e80' then raise exception 'STOP: request_article_changes definition drift'; end if;
  if md5(pg_get_functiondef('public.submit_article_for_review(uuid,bigint,text)'::regprocedure)) <> '414fa3d92f21697bf4737a73e5b580bb' then raise exception 'STOP: submit_article_for_review definition drift'; end if;
END; $guard$;

CREATE OR REPLACE FUNCTION public.submit_article_for_review(p_article_id uuid, p_expected_draft_version bigint, p_note text DEFAULT NULL::text)
 RETURNS TABLE(article_id uuid, article_slug text, draft_version bigint, version_id uuid, version_number bigint, lifecycle_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'editorial'
AS $function$
declare
  v_article public.wk_articles%rowtype;
  v_resource editorial.resources%rowtype;
  v_working_version editorial.article_versions%rowtype;
  v_prior_status text;
  v_version_id uuid;
  v_version_number bigint;
  v_command record;
  v_preserve_live boolean := false;
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
  v_preserve_live := v_article.wp_status = 'publish'
    and v_resource.current_published_version_id is not null
    and exists (
      select 1 from public.wk_article_publication_snapshots snap
      where snap.article_id = p_article_id and snap.is_active
        and snap.wp_status = 'publish'
        and snap.version_id = v_resource.current_published_version_id
    );
  if v_article.wp_status = 'publish' and not v_preserve_live then
    raise exception 'Published Article snapshot authority is inconsistent';
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

  if v_resource.current_working_version_id is not null then
    select version.*
    into v_working_version
    from editorial.article_versions version
    where version.id = v_resource.current_working_version_id
      and version.resource_id = v_resource.id
      and version.article_id = p_article_id;
  end if;

  if v_preserve_live and (
    v_working_version.id is null
    or v_working_version.version_kind not in ('manual_save','correction')
    or v_working_version.source_draft_version is distinct from p_expected_draft_version
    or v_working_version.version_number <= (
      select version_number from editorial.article_versions where id = v_resource.current_published_version_id
    )
  ) then
    raise exception 'Save a newer working Article version before submitting a published revision';
  end if;
  v_prior_status := v_article.wp_status;

  select *
  into v_command
  from platform_private.begin_legacy_authenticated_article_command(
    'article.review.submit',
    v_resource.id,
    jsonb_build_object(
      'article_id', p_article_id,
      'expected_draft_version', p_expected_draft_version,
      'note', nullif(btrim(coalesce(p_note, '')), '')
    )
  );

  update public.wk_articles as article
  set
    wp_status = case when v_preserve_live then 'publish' else 'pending' end,
    draft_version = article.draft_version + 1,
    updated_at = now(),
    modified_at = now()
  where article.id = p_article_id
  returning article.*
  into v_article;

  if v_working_version.id is not null
     and v_working_version.version_kind = 'correction'
     and v_working_version.source_draft_version = p_expected_draft_version
     and v_working_version.content_fingerprint =
       editorial.article_snapshot_fingerprint(
         v_article.title,
         v_article.slug,
         v_article.excerpt,
         v_article.content_html,
         v_article.author,
         v_article.hero_image_id,
         v_article.hero_image_url,
         v_article.seo,
         v_prior_status,
         v_article.published_at,
         v_article.categories,
         v_article.tags
       )
  then
    select created.version_id, created.version_number
    into v_version_id, v_version_number
    from editorial.copy_article_lifecycle_version(
      v_working_version.id,
      'submitted',
      'submitted',
      'pending',
      v_article.published_at
    ) created;
  else
    select created.version_id, created.version_number
    into v_version_id, v_version_number
    from editorial.insert_article_lifecycle_version_from_article(
      v_resource,
      v_article,
      'submitted',
      'submitted'
    ) created;
  end if;

  update editorial.resources
  set
    current_submitted_version_id = v_version_id,
    lifecycle_state = case when v_preserve_live then 'published' else 'active' end,
    visibility = case when v_preserve_live then 'public' else 'private' end,
    updated_at = now()
  where id = v_resource.id;

  perform editorial.append_resource_lifecycle_event(
    v_resource.id,
    v_version_id,
    'submitted',
    v_prior_status,
    case when v_preserve_live then 'publish' else 'pending' end,
    p_note,
    jsonb_build_object('article_id', p_article_id),
    auth.uid(),
    v_command.command_receipt_id,
    v_command.correlation_id
  );

  perform editorial.append_resource_review_event(
    v_resource.id,
    v_version_id,
    null,
    'submitted',
    v_prior_status,
    case when v_preserve_live then 'publish' else 'pending' end,
    p_note,
    auth.uid(),
    v_command.command_receipt_id,
    v_command.correlation_id
  );

  perform platform_private.complete_resource_command(
    v_command.command_receipt_id,
    jsonb_build_object(
      'article_id', p_article_id,
      'article_slug', v_article.slug,
      'draft_version', v_article.draft_version,
      'version_id', v_version_id,
      'version_number', v_version_number,
      'lifecycle_status', 'submitted',
      'correlation_id', v_command.correlation_id
    )
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

CREATE OR REPLACE FUNCTION public.request_article_changes(p_article_id uuid, p_version_id uuid DEFAULT NULL::uuid, p_note text DEFAULT NULL::text)
 RETURNS TABLE(article_id uuid, article_slug text, draft_version bigint, version_id uuid, version_number bigint, lifecycle_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'editorial'
AS $function$
declare
  v_article public.wk_articles%rowtype;
  v_resource editorial.resources%rowtype;
  v_target_version_id uuid;
  v_target_number bigint;
  v_prior_status text;
  v_command record;
  v_preserve_live boolean := false;
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
  v_preserve_live := v_article.wp_status = 'publish'
    and v_resource.current_published_version_id is not null
    and exists (
      select 1 from public.wk_article_publication_snapshots snap
      where snap.article_id = p_article_id and snap.is_active
        and snap.wp_status = 'publish'
        and snap.version_id = v_resource.current_published_version_id
    );
  if v_article.wp_status = 'publish' and not v_preserve_live then
    raise exception 'Published Article snapshot authority is inconsistent';
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

  if v_preserve_live and (
    v_target_version_id is distinct from v_resource.current_submitted_version_id
    or not exists (
      select 1 from editorial.article_versions candidate
      join editorial.article_versions published on published.id = v_resource.current_published_version_id
      join editorial.article_versions working on working.id = v_resource.current_working_version_id
      where candidate.id = v_target_version_id
        and candidate.article_id = p_article_id
        and candidate.version_kind = 'submitted'
        and candidate.version_number > published.version_number
        and candidate.content_fingerprint = working.content_fingerprint
    )
    or not exists (
      select 1 from editorial.resource_lifecycle_events e
      where e.resource_id = v_resource.id and e.action = 'submitted'
        and e.event_number = (select max(n.event_number)
          from editorial.resource_lifecycle_events n where n.resource_id = v_resource.id)
    )
  ) then
    raise exception 'Published Article revision is not the current submitted version';
  end if;
  v_prior_status := v_article.wp_status;

  select *
  into v_command
  from platform_private.begin_legacy_authenticated_article_command(
    'article.review.request_changes',
    v_resource.id,
    jsonb_build_object(
      'article_id', p_article_id,
      'target_version_id', v_target_version_id,
      'note', nullif(btrim(p_note), '')
    )
  );

  update public.wk_articles as article
  set
    wp_status = case when v_preserve_live then 'publish' else 'draft' end,
    draft_version = article.draft_version + 1,
    updated_at = now(),
    modified_at = now()
  where article.id = p_article_id
  returning article.*
  into v_article;

  update editorial.resources
  set
    lifecycle_state = case when v_preserve_live then 'published' else 'draft' end,
    visibility = case when v_preserve_live then 'public' else 'private' end,
    updated_at = now()
  where id = v_resource.id;

  perform editorial.append_resource_lifecycle_event(
    v_resource.id,
    v_target_version_id,
    'changes_requested',
    v_prior_status,
    case when v_preserve_live then 'publish' else 'draft' end,
    p_note,
    jsonb_build_object('article_id', p_article_id),
    auth.uid(),
    v_command.command_receipt_id,
    v_command.correlation_id
  );

  perform editorial.append_resource_review_event(
    v_resource.id,
    v_target_version_id,
    null,
    'changes_requested',
    v_prior_status,
    case when v_preserve_live then 'publish' else 'draft' end,
    p_note,
    auth.uid(),
    v_command.command_receipt_id,
    v_command.correlation_id
  );

  perform platform_private.complete_resource_command(
    v_command.command_receipt_id,
    jsonb_build_object(
      'article_id', p_article_id,
      'article_slug', v_article.slug,
      'draft_version', v_article.draft_version,
      'version_id', v_target_version_id,
      'version_number', v_target_number,
      'lifecycle_status', 'changes_requested',
      'correlation_id', v_command.correlation_id
    )
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

CREATE OR REPLACE FUNCTION public.approve_article_version(p_article_id uuid, p_version_id uuid DEFAULT NULL::uuid, p_note text DEFAULT NULL::text)
 RETURNS TABLE(article_id uuid, article_slug text, draft_version bigint, version_id uuid, version_number bigint, lifecycle_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'editorial'
AS $function$
declare
  v_article public.wk_articles%rowtype;
  v_resource editorial.resources%rowtype;
  v_source_version_id uuid;
  v_version_id uuid;
  v_version_number bigint;
  v_command record;
  v_preserve_live boolean := false;
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
  v_preserve_live := v_article.wp_status = 'publish'
    and v_resource.current_published_version_id is not null
    and exists (
      select 1 from public.wk_article_publication_snapshots snap
      where snap.article_id = p_article_id and snap.is_active
        and snap.wp_status = 'publish'
        and snap.version_id = v_resource.current_published_version_id
    );
  if v_article.wp_status = 'publish' and not v_preserve_live then
    raise exception 'Published Article snapshot authority is inconsistent';
  end if;


  v_source_version_id :=
    coalesce(
      p_version_id,
      v_resource.current_submitted_version_id,
      v_resource.current_working_version_id
    );

  if v_preserve_live and (
    v_source_version_id is distinct from v_resource.current_submitted_version_id
    or not exists (
      select 1 from editorial.article_versions candidate
      join editorial.article_versions published on published.id = v_resource.current_published_version_id
      join editorial.article_versions working on working.id = v_resource.current_working_version_id
      where candidate.id = v_source_version_id
        and candidate.article_id = p_article_id
        and candidate.version_kind = 'submitted'
        and candidate.version_number > published.version_number
        and candidate.content_fingerprint = working.content_fingerprint
    )
    or not exists (
      select 1 from editorial.resource_lifecycle_events e
      where e.resource_id = v_resource.id and e.action = 'submitted'
        and e.event_number = (select max(n.event_number)
          from editorial.resource_lifecycle_events n where n.resource_id = v_resource.id)
    )
  ) then
    raise exception 'Published Article revision is not the current submitted version';
  end if;
  select *
  into v_command
  from platform_private.begin_legacy_authenticated_article_command(
    'article.review.approve',
    v_resource.id,
    jsonb_build_object(
      'article_id', p_article_id,
      'source_version_id', v_source_version_id,
      'note', nullif(btrim(coalesce(p_note, '')), '')
    )
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
    lifecycle_state = case when v_preserve_live then 'published' else 'active' end,
    visibility = case when v_preserve_live then 'public' else 'private' end,
    updated_at = now()
  where id = v_resource.id;

  perform editorial.append_resource_lifecycle_event(
    v_resource.id,
    v_version_id,
    'approved',
    v_article.wp_status,
    'approved',
    p_note,
    jsonb_build_object('article_id', p_article_id),
    auth.uid(),
    v_command.command_receipt_id,
    v_command.correlation_id
  );

  perform editorial.append_resource_review_event(
    v_resource.id,
    v_source_version_id,
    v_version_id,
    'approved',
    v_article.wp_status,
    'approved',
    p_note,
    auth.uid(),
    v_command.command_receipt_id,
    v_command.correlation_id
  );

  perform platform_private.complete_resource_command(
    v_command.command_receipt_id,
    jsonb_build_object(
      'article_id', p_article_id,
      'article_slug', v_article.slug,
      'draft_version', v_article.draft_version,
      'version_id', v_version_id,
      'version_number', v_version_number,
      'lifecycle_status', 'approved',
      'correlation_id', v_command.correlation_id
    )
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

COMMIT;
