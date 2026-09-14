-- Phase 9A.3: retire public-content redirect writers.
-- Existing rows remain historical evidence. New mutations are blocked.

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

create or replace function
  public.apply_article_correction(
    p_case_resource_id uuid,
    p_expected_case_revision bigint,
    p_expected_current_decision_id uuid,
    p_primary_target_id uuid,
    p_challenged_article_version_id uuid,
    p_expected_published_article_version_id uuid,
    p_expected_working_article_version_id uuid,
    p_expected_working_fingerprint text,
    p_corrected_payload jsonb,
    p_taxonomy_term_ids uuid[],
    p_application_summary text,
    p_idempotency_key text,
    p_correlation_id uuid
  )
returns table (
  command_receipt_id uuid,
  receipt_status text,
  case_resource_id uuid,
  case_revision bigint,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path =
  pg_catalog,
  public,
  auth,
  editorial,
  platform_private,
  extensions
as $function$
declare
  v_actor uuid;
  v_context record;
  v_begin record;
  v_case editorial.correction_cases%rowtype;
  v_decision editorial.correction_decisions%rowtype;
  v_target editorial.correction_targets%rowtype;
  v_case_resource editorial.resources%rowtype;
  v_article_resource editorial.resources%rowtype;
  v_article public.wk_articles%rowtype;
  v_working_version editorial.article_versions%rowtype;
  v_taxonomy_term_ids uuid[];
  v_taxonomy_count bigint;
  v_categories jsonb;
  v_tags jsonb;
  v_payload_hash text;
  v_request_payload jsonb;
  v_rejection_code text;
  v_rejection_message text;
  v_new_slug text;
  v_new_published_at timestamptz;
  v_new_hero_image_id uuid;
  v_new_version_id uuid;
  v_new_version_number bigint;
  v_new_fingerprint text;
  v_application_id uuid;
  v_result jsonb;
begin
  v_actor :=
    platform_private.assert_correction_capability(
      'apply_corrections'
    );

  select *
  into v_context
  from platform_private.correction_actor_context();

  if v_context.auth_role <> 'service_role'
     and not coalesce(
       public.current_user_is_administrator(),
       false
     )
     and not coalesce(
       public.current_user_has_capability(
         'edit_others_articles'
       ),
       false
     )
  then
    raise exception
      using
        errcode = '42501',
        message = 'The caller does not hold Article correction application authority.';
  end if;

  if p_case_resource_id is null
     or p_expected_case_revision < 1
     or p_expected_current_decision_id is null
     or p_primary_target_id is null
     or p_challenged_article_version_id is null
     or p_expected_published_article_version_id is null
     or p_correlation_id is null
     or nullif(
       btrim(p_application_summary),
       ''
     ) is null
     or length(p_application_summary) > 8000
     or p_corrected_payload is null
     or jsonb_typeof(p_corrected_payload) <>
       'object'
     or octet_length(
       p_corrected_payload::text
     ) > 4194304
  then
    raise exception
      using
        errcode = '22023',
        message = 'Case, revision, decision, target, Article state, corrected snapshot, summary, and correlation identity are required.';
  end if;

  if p_expected_working_article_version_id is null
     and p_expected_working_fingerprint is not null
  then
    raise exception
      using
        errcode = '22023',
        message = 'A working fingerprint requires an expected working Article version.';
  end if;

  if p_expected_working_article_version_id is not null
     and coalesce(
       p_expected_working_fingerprint,
       ''
     ) !~ '^[0-9a-f]{64}$'
  then
    raise exception
      using
        errcode = '22023',
        message = 'Expected working fingerprint must be a SHA-256 value.';
  end if;

  if not (
    p_corrected_payload ?& array[
      'title',
      'slug',
      'excerpt',
      'content_html',
      'author',
      'published_at',
      'seo',
      'hero_image_id',
      'hero_image_url'
    ]
  )
     or p_corrected_payload - array[
       'title',
       'slug',
       'excerpt',
       'content_html',
       'author',
       'published_at',
       'seo',
       'hero_image_id',
       'hero_image_url'
     ] <> '{}'::jsonb
  then
    raise exception
      using
        errcode = '22023',
        message = 'Corrected Article payload must contain exactly the complete supported snapshot fields.';
  end if;

  if nullif(
       btrim(
         p_corrected_payload ->> 'title'
       ),
       ''
     ) is null
     or nullif(
       btrim(
         p_corrected_payload ->> 'slug'
       ),
       ''
     ) is null
     or p_corrected_payload ->> 'content_html'
       is null
     or coalesce(
       jsonb_typeof(
         p_corrected_payload -> 'seo'
       ),
       ''
     ) <> 'object'
  then
    raise exception
      using
        errcode = '22023',
        message = 'Corrected Article title, slug, content, and SEO object are required.';
  end if;

  v_new_slug := btrim(
    p_corrected_payload ->> 'slug'
  );

  if v_new_slug !~
     '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  then
    raise exception
      using
        errcode = '22023',
        message = 'Corrected Article slug is invalid.';
  end if;

  begin
    v_new_published_at :=
      nullif(
        p_corrected_payload ->>
          'published_at',
        ''
      )::timestamptz;

    v_new_hero_image_id :=
      nullif(
        p_corrected_payload ->>
          'hero_image_id',
        ''
      )::uuid;
  exception
    when invalid_text_representation
      or datetime_field_overflow
    then
      raise exception
        using
          errcode = '22023',
          message = 'Corrected Article publication or hero-image identity is invalid.';
  end;

  select coalesce(
    array_agg(
      distinct term_id
      order by term_id
    ),
    '{}'::uuid[]
  )
  into v_taxonomy_term_ids
  from unnest(
    coalesce(
      p_taxonomy_term_ids,
      '{}'::uuid[]
    )
  ) term_id;

  select count(*)
  into v_taxonomy_count
  from public.registry_taxonomy_terms term
  where term.id = any(
      v_taxonomy_term_ids
    )
    and term.taxonomy in (
      'category',
      'post_tag'
    )
    and term.status = 'active';

  if v_taxonomy_count <>
     cardinality(v_taxonomy_term_ids)
  then
    raise exception
      using
        errcode = '22023',
        message = 'Every corrected Article taxonomy identity must be active and supported.';
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
  into v_categories
  from public.registry_taxonomy_terms term
  where term.id = any(
      v_taxonomy_term_ids
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
  into v_tags
  from public.registry_taxonomy_terms term
  where term.id = any(
      v_taxonomy_term_ids
    )
    and term.taxonomy = 'post_tag'
    and term.status = 'active';

  v_payload_hash := encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'corrected_payload',
          p_corrected_payload,
          'taxonomy_term_ids',
          to_jsonb(v_taxonomy_term_ids)
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  v_request_payload := jsonb_build_object(
    'expected_case_revision',
    p_expected_case_revision,
    'expected_current_decision_id',
    p_expected_current_decision_id,
    'primary_target_id',
    p_primary_target_id,
    'challenged_article_version_id',
    p_challenged_article_version_id,
    'expected_published_article_version_id',
    p_expected_published_article_version_id,
    'expected_working_article_version_id',
    p_expected_working_article_version_id,
    'expected_working_fingerprint',
    p_expected_working_fingerprint,
    'corrected_snapshot_request_fingerprint',
    v_payload_hash,
    'application_summary',
    btrim(p_application_summary),
    'correlation_id',
    p_correlation_id
  );

  select *
  into v_begin
  from platform_private.begin_resource_command(
    'correction.article.apply',
    p_case_resource_id,
    p_idempotency_key,
    v_request_payload
  );

  if v_begin.idempotent_replay then
    return query
    select *
    from platform_private.read_correction_command_result(
      v_begin.command_receipt_id,
      true
    );
    return;
  end if;

  select resource.*
  into v_case_resource
  from editorial.resources resource
  where resource.id =
    p_case_resource_id
    and resource.resource_kind =
      'correction_case'
  for update;

  select correction_case.*
  into v_case
  from editorial.correction_cases correction_case
  where correction_case.resource_id =
    p_case_resource_id
  for update;

  if not found
     or v_case_resource.id is null
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'case_not_found',
      'The correction case does not exist.',
      jsonb_build_object(
        'case_revision',
        null,
        'case_state',
        null
      )
    );

    return query
    select *
    from platform_private.read_correction_command_result(
      v_begin.command_receipt_id,
      false
    );
    return;
  end if;

  perform platform_private.append_correction_application_event(
    p_case_resource_id,
    'application_accepted',
    v_case.current_revision,
    v_case.current_revision,
    v_case.case_state,
    v_case.case_state,
    v_actor,
    'Article correction application command accepted.',
    v_case.current_decision_id,
    null,
    p_primary_target_id,
    v_begin.command_receipt_id,
    p_correlation_id,
    jsonb_build_object(
      'expected_case_revision',
      p_expected_case_revision,
      'expected_current_decision_id',
      p_expected_current_decision_id,
      'expected_published_article_version_id',
      p_expected_published_article_version_id,
      'expected_working_article_version_id',
      p_expected_working_article_version_id,
      'corrected_snapshot_request_fingerprint',
      v_payload_hash
    )
  );

  if v_case.current_revision <>
     p_expected_case_revision
  then
    v_rejection_code :=
      'case_revision_changed';
    v_rejection_message :=
      'The correction case revision changed.';
  elsif v_case.current_application_id is not null
        or exists (
          select 1
          from editorial.correction_applications application
          where application.decision_id =
            p_expected_current_decision_id
        )
  then
    v_rejection_code :=
      'application_already_succeeded';
    v_rejection_message :=
      'The current correction decision already has a successful application.';
  elsif v_case.case_state <> 'decided'
        or v_case.current_decision_id
          is distinct from
            p_expected_current_decision_id
  then
    v_rejection_code :=
      'decision_changed';
    v_rejection_message :=
      'The current correction decision or case state changed.';
  else
    select decision.*
    into v_decision
    from editorial.correction_decisions decision
    where decision.id =
      p_expected_current_decision_id;

    if not found
       or v_decision.case_resource_id
         is distinct from
           p_case_resource_id
    then
      v_rejection_code :=
        'decision_changed';
      v_rejection_message :=
        'The current correction decision changed.';
    elsif v_decision.outcome <>
          'correction_required'
    then
      v_rejection_code :=
        'decision_not_correction_required';
      v_rejection_message :=
        'The current correction decision does not require a correction.';
    end if;
  end if;

  if v_rejection_code is null then
    select target.*
    into v_target
    from editorial.correction_targets target
    where target.id =
      p_primary_target_id
    for update;

    if not found
       or v_target.case_resource_id
         is distinct from
           p_case_resource_id
       or v_target.target_role <> 'primary'
       or v_target.target_resource_kind <>
         'article'
       or v_target.target_version_type <>
         'article_version'
       or v_target.target_version_id
         is distinct from
           p_challenged_article_version_id
    then
      v_rejection_code :=
        'target_changed';
      v_rejection_message :=
        'The primary correction target changed.';
    end if;
  end if;

  if v_rejection_code is null then
    select resource.*
    into v_article_resource
    from editorial.resources resource
    where resource.id =
      v_target.target_resource_id
      and resource.resource_kind = 'article'
    for update;

    if not found then
      v_rejection_code :=
        'target_changed';
      v_rejection_message :=
        'The target Article resource changed.';
    end if;
  end if;

  if v_rejection_code is null then
    select article.*
    into v_article
    from editorial.article_resources binding
    join public.wk_articles article
      on article.id = binding.article_id
    where binding.resource_id =
      v_article_resource.id
      and binding.resource_kind = 'article'
    for update of article;

    if not found then
      v_rejection_code :=
        'target_changed';
      v_rejection_message :=
        'The target Article binding changed.';
    end if;
  end if;

  if v_rejection_code is null
     and (
       v_article_resource.current_published_version_id
         is distinct from
           p_expected_published_article_version_id
       or p_expected_published_article_version_id
         is distinct from
           p_challenged_article_version_id
       or v_target.target_resource_id
         is distinct from
           v_article_resource.id
     )
  then
    v_rejection_code :=
      'published_version_changed';
    v_rejection_message :=
      'The current published Article version changed.';
  end if;

  if v_rejection_code is null
     and v_article_resource.current_working_version_id
       is distinct from
         p_expected_working_article_version_id
  then
    v_rejection_code :=
      'working_version_changed';
    v_rejection_message :=
      'The current working Article version changed.';
  end if;

  if v_rejection_code is null
     and p_expected_working_article_version_id
       is not null
  then
    select version.*
    into v_working_version
    from editorial.article_versions version
    where version.id =
      p_expected_working_article_version_id;

    if not found
       or v_working_version.resource_id
         is distinct from
           v_article_resource.id
       or v_working_version.content_fingerprint
         is distinct from
           p_expected_working_fingerprint
    then
      v_rejection_code :=
        'working_fingerprint_changed';
      v_rejection_message :=
        'The current working Article fingerprint changed.';
    end if;
  end if;

  if v_rejection_code is null
     and (
       select count(*)
       from public.registry_taxonomy_terms term
       where term.id = any(
           v_taxonomy_term_ids
         )
         and term.taxonomy in (
           'category',
           'post_tag'
         )
         and term.status = 'active'
     ) <> cardinality(v_taxonomy_term_ids)
  then
    v_rejection_code :=
      'target_changed';
    v_rejection_message :=
      'The corrected Article taxonomy authority changed.';
  end if;

  if v_rejection_code is null
     and v_new_slug <> v_article.slug
     and exists (
       select 1
       from public.wk_articles other_article
       where other_article.slug =
           v_new_slug
         and other_article.id <>
           v_article.id
     )
  then
    v_rejection_code :=
      'target_changed';
    v_rejection_message :=
      'The corrected Article slug is no longer available.';
  end if;

  if v_rejection_code is not null then
    v_result := jsonb_build_object(
      'case_resource_id',
      p_case_resource_id,
      'case_revision',
      v_case.current_revision,
      'case_state',
      v_case.case_state,
      'rejection_code',
      v_rejection_code
    );

    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      v_rejection_code,
      v_rejection_message,
      v_result
    );

    perform platform_private.append_correction_application_event(
      p_case_resource_id,
      'application_rejected_stale',
      v_case.current_revision,
      v_case.current_revision,
      v_case.case_state,
      v_case.case_state,
      v_actor,
      v_rejection_message,
      v_case.current_decision_id,
      null,
      p_primary_target_id,
      v_begin.command_receipt_id,
      p_correlation_id,
      jsonb_build_object(
        'rejection_code',
        v_rejection_code,
        'expected_case_revision',
        p_expected_case_revision,
        'actual_case_revision',
        v_case.current_revision,
        'expected_current_decision_id',
        p_expected_current_decision_id,
        'actual_current_decision_id',
        v_case.current_decision_id,
        'expected_published_article_version_id',
        p_expected_published_article_version_id,
        'actual_published_article_version_id',
        v_article_resource.current_published_version_id,
        'expected_working_article_version_id',
        p_expected_working_article_version_id,
        'actual_working_article_version_id',
        v_article_resource.current_working_version_id
      )
    );

    return query
    select *
    from platform_private.read_correction_command_result(
      v_begin.command_receipt_id,
      false
    );
    return;
  end if;


  update public.wk_articles as article
  set
    title =
      p_corrected_payload ->> 'title',
    slug = v_new_slug,
    excerpt =
      p_corrected_payload ->> 'excerpt',
    content_html =
      p_corrected_payload ->> 'content_html',
    author =
      p_corrected_payload ->> 'author',
    published_at =
      v_new_published_at,
    seo =
      p_corrected_payload -> 'seo',
    hero_image_id =
      v_new_hero_image_id,
    hero_image_url =
      p_corrected_payload ->>
        'hero_image_url',
    categories = v_categories,
    tags = v_tags,
    draft_version =
      article.draft_version + 1,
    modified_at = now(),
    updated_at = now()
  where article.id = v_article.id
  returning article.*
  into v_article;

  delete from editorial.article_taxonomy_terms
  where resource_id =
    v_article_resource.id;

  insert into editorial.article_taxonomy_terms (
    resource_id,
    term_id,
    taxonomy,
    created_by
  )
  select
    v_article_resource.id,
    term.id,
    term.taxonomy,
    v_actor
  from public.registry_taxonomy_terms term
  where term.id = any(
      v_taxonomy_term_ids
    )
    and term.taxonomy in (
      'category',
      'post_tag'
    )
    and term.status = 'active'
  on conflict do nothing;

  v_new_version_number :=
    editorial.next_article_version_number(
      v_article_resource.id
    );

  v_new_fingerprint :=
    editorial.article_snapshot_fingerprint(
      v_article.title,
      v_article.slug,
      v_article.excerpt,
      v_article.content_html,
      v_article.author,
      v_article.hero_image_id,
      v_article.hero_image_url,
      v_article.seo,
      v_article.wp_status,
      v_article.published_at,
      v_article.categories,
      v_article.tags
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
    v_article_resource.id,
    v_article.id,
    v_new_version_number,
    'correction',
    v_article.draft_version,
    v_article.title,
    v_article.slug,
    v_article.excerpt,
    v_article.content_html,
    v_article.author,
    v_article_resource.owner_id,
    v_article.hero_image_id,
    v_article.hero_image_url,
    v_article.seo,
    v_article_resource.lifecycle_state,
    v_article.wp_status,
    v_article.published_at,
    v_article.categories,
    v_article.tags,
    v_actor,
    v_new_fingerprint
  )
  returning id
  into v_new_version_id;

  update editorial.resources
  set
    current_working_version_id =
      v_new_version_id,
    updated_at = now()
  where id = v_article_resource.id;

  insert into editorial.correction_applications (
    case_resource_id,
    decision_id,
    command_receipt_id,
    target_id,
    target_resource_id,
    challenged_version_id,
    expected_published_version_id,
    expected_working_version_id,
    expected_working_fingerprint,
    resulting_version_id,
    application_summary,
    applied_by,
    correlation_id
  )
  values (
    p_case_resource_id,
    v_decision.id,
    v_begin.command_receipt_id,
    v_target.id,
    v_article_resource.id,
    p_challenged_article_version_id,
    p_expected_published_article_version_id,
    p_expected_working_article_version_id,
    p_expected_working_fingerprint,
    v_new_version_id,
    btrim(p_application_summary),
    v_actor,
    p_correlation_id
  )
  returning id
  into v_application_id;

  update editorial.correction_cases
  set
    case_state = 'applied',
    current_revision =
      v_case.current_revision + 1,
    current_application_id =
      v_application_id,
    updated_by = v_actor,
    updated_at = now()
  where resource_id =
    p_case_resource_id;

  perform platform_private.append_correction_application_event(
    p_case_resource_id,
    'application_succeeded',
    v_case.current_revision,
    v_case.current_revision + 1,
    v_case.case_state,
    'applied',
    v_actor,
    btrim(p_application_summary),
    v_decision.id,
    v_application_id,
    v_target.id,
    v_begin.command_receipt_id,
    p_correlation_id,
    jsonb_build_object(
      'application_id',
      v_application_id,
      'target_resource_id',
      v_article_resource.id,
      'challenged_version_id',
      p_challenged_article_version_id,
      'expected_published_version_id',
      p_expected_published_article_version_id,
      'expected_working_version_id',
      p_expected_working_article_version_id,
      'resulting_version_id',
      v_new_version_id,
      'resulting_version_number',
      v_new_version_number,
      'resulting_content_fingerprint',
      v_new_fingerprint,
      'published_pointer_changed',
      false
    )
  );

  v_result := jsonb_build_object(
    'case_resource_id',
    p_case_resource_id,
    'case_revision',
    v_case.current_revision + 1,
    'case_state',
    'applied',
    'application_id',
    v_application_id,
    'decision_id',
    v_decision.id,
    'target_id',
    v_target.id,
    'target_resource_id',
    v_article_resource.id,
    'resulting_version_id',
    v_new_version_id,
    'resulting_version_number',
    v_new_version_number,
    'resulting_content_fingerprint',
    v_new_fingerprint,
    'current_published_version_id',
    p_expected_published_article_version_id,
    'current_working_version_id',
    v_new_version_id
  );

  perform platform_private.complete_resource_command(
    v_begin.command_receipt_id,
    v_result
  );

  return query
  select *
  from platform_private.read_correction_command_result(
    v_begin.command_receipt_id,
    false
  );
end;
$function$;

create or replace function platform_private.reject_slug_redirect_mutation()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public', 'platform_private'
as $$
begin
  raise exception
    using
      errcode = '55000',
      message = 'wk_slug_redirects is historical evidence and is read-only.';
end;
$$;

revoke all on function platform_private.reject_slug_redirect_mutation()
from public;

drop trigger if exists wk_slug_redirects_historical_read_only
on public.wk_slug_redirects;

create trigger wk_slug_redirects_historical_read_only
before insert or update or delete
on public.wk_slug_redirects
for each statement
execute function platform_private.reject_slug_redirect_mutation();

comment on table public.wk_slug_redirects is
  'Historical public-content redirect evidence. Runtime reads and writes retired in Phase 9A.3.';
