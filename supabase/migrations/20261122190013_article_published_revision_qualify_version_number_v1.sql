-- Forward-only hotfix for a production submit failure after published Article edits.
-- ERROR: column reference "version_number" is ambiguous (PL/pgSQL RETURNS TABLE parameter).
-- Keep the complete previously reviewed RPC body, ACL, definer and locks unchanged;
-- qualify the one Article Version field in the published-revision eligibility check.
-- No Article data, lifecycle pointers, publications, permissions or other RPCs changed.
BEGIN;
DO $guard$ BEGIN
  IF md5(pg_get_functiondef('public.submit_article_for_review(uuid,bigint,text)'::regprocedure)) <> '476e81ba62ef40f866728380e6a4027b' THEN
    RAISE EXCEPTION 'STOP: published revision submit RPC definition drift';
  END IF;
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
      select published_version.version_number from editorial.article_versions as published_version where published_version.id = v_resource.current_published_version_id
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

DO $verify$ BEGIN
  IF strpos(pg_get_functiondef('public.submit_article_for_review(uuid,bigint,text)'::regprocedure),
      'select published_version.version_number from editorial.article_versions as published_version') = 0 THEN
    RAISE EXCEPTION 'STOP: published revision submit qualification not installed';
  END IF;
END; $verify$;
COMMIT;
