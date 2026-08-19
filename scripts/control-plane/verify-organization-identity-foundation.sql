do $verify$
declare
  v_org_id uuid;
  v_staff_count bigint;
  v_org_path_count bigint;
  v_org_work_count bigint;
  v_human_path_count bigint;
begin
  if to_regclass('editorial.organizations') is null
     or to_regclass('editorial.organization_types') is null
     or to_regclass('editorial.organization_type_assignments') is null
     or to_regclass('editorial.organization_registry_label_links') is null
  then
    raise exception
      'STOP: Organization foundation tables are missing';
  end if;

  if not exists (
    select 1
    from editorial.resource_kinds
    where kind = 'organization'
      and enabled
  ) then
    raise exception
      'STOP: organization Resource kind is missing';
  end if;

  select alias.resource_id
  into v_org_id
  from editorial.resource_aliases alias
  join editorial.resources resource
    on resource.id = alias.resource_id
   and resource.resource_kind = 'organization'
   and resource.visibility = 'public'
   and resource.lifecycle_state = 'active'
  join editorial.organizations organization
    on organization.resource_id = resource.id
   and organization.organization_state = 'active'
   and organization.display_name = 'WAKILISHA'
  where alias.path = '/organizations/wakilisha'
    and alias.is_canonical
    and alias.retired_at is null;

  if v_org_id is null then
    raise exception
      'STOP: canonical WAKILISHA Organization is missing';
  end if;

  if (
    select count(*)
    from editorial.organization_type_assignments
    where organization_resource_id = v_org_id
      and organization_type = 'cultural_platform'
      and is_primary
  ) <> 1
  then
    raise exception
      'STOP: WAKILISHA primary Cultural platform classification is missing';
  end if;

  if (
    select count(*)
    from editorial.organization_type_assignments
    where organization_resource_id = v_org_id
      and organization_type = 'publication'
      and not is_primary
  ) <> 1
  then
    raise exception
      'STOP: WAKILISHA secondary Publication classification is missing';
  end if;

  if (
    select count(*)
    from editorial.organization_registry_label_links
  ) <> 0
  then
    raise exception
      'STOP: foundation migration must not silently pair existing Registry Labels';
  end if;

  select count(*)
  into v_staff_count
  from public.wk_articles article
  join editorial.article_resources binding
    on binding.article_id = article.id
  join editorial.resources resource
    on resource.id = binding.resource_id
   and resource.resource_kind = 'article'
   and resource.visibility = 'public'
   and resource.lifecycle_state = 'published'
   and resource.current_published_version_id is not null
  join editorial.article_versions version
    on version.id =
       resource.current_published_version_id
  where btrim(coalesce(article.author, '')) =
        'Wakilisha Staff'
    and btrim(coalesce(version.author_display, '')) =
        'Wakilisha Staff';

  if v_staff_count <> 73 then
    raise exception
      'STOP: expected 73 preserved Wakilisha Staff current Article snapshots, got %',
      v_staff_count;
  end if;

  if (
    select count(*)
    from public.wk_articles article
    join editorial.article_resources binding
      on binding.article_id = article.id
    join editorial.resources resource
      on resource.id = binding.resource_id
     and resource.resource_kind = 'article'
     and resource.visibility = 'public'
     and resource.lifecycle_state = 'published'
     and resource.current_published_version_id is not null
    join editorial.resource_credits attachment
      on attachment.resource_id = resource.id
     and attachment.target_version_id =
         resource.current_published_version_id
     and attachment.resource_kind = 'article'
     and attachment.target_version_type =
         'article_version'
     and attachment.is_primary
     and attachment.public_safe
    join editorial.credits credit
      on credit.id = attachment.credit_id
     and credit.credit_role = 'author'
     and credit.organization_resource_id =
         v_org_id
     and credit.display_name_snapshot =
         'WAKILISHA'
    join editorial.credit_governance governance
      on governance.credit_id = credit.id
     and governance.credit_state = 'active'
     and governance.public_safe
    where btrim(coalesce(article.author, '')) =
          'Wakilisha Staff'
  ) <> 73
  then
    raise exception
      'STOP: all 73 Staff Articles must carry one WAKILISHA institutional Author Credit';
  end if;

  select count(*)
  into v_org_path_count
  from public.list_public_article_author_organization_paths(null)
  where author_organization_id = v_org_id
    and author_organization_path =
        '/organizations/wakilisha';

  if v_org_path_count <> 73 then
    raise exception
      'STOP: expected 73 WAKILISHA Article organization paths, got %',
      v_org_path_count;
  end if;

  select count(*)
  into v_org_work_count
  from public.list_public_organization_work(
    v_org_id,
    100,
    null,
    null
  );

  if v_org_work_count <> 73 then
    raise exception
      'STOP: expected 73 WAKILISHA public Organization work rows, got %',
      v_org_work_count;
  end if;

  select count(*)
  into v_human_path_count
  from public.list_public_article_author_paths(null);

  if v_human_path_count <> 134 then
    raise exception
      'STOP: accepted human Article Person path count moved from 134 to %',
      v_human_path_count;
  end if;

  if exists (
    select 1
    from public.list_public_article_author_paths(null) human
    join public.wk_articles article
      on article.id = human.article_id
    where btrim(coalesce(article.author, '')) =
          'Wakilisha Staff'
  ) then
    raise exception
      'STOP: Wakilisha Staff must remain outside Person authority';
  end if;

  if (
    select count(*)
    from public.list_public_article_author_organization_paths(null) org_path
    join public.wk_articles article
      on article.id = org_path.article_id
    where btrim(coalesce(article.author, '')) <>
          'Wakilisha Staff'
  ) <> 0
  then
    raise exception
      'STOP: foundation Organization attribution must not capture named-human Articles';
  end if;

  if public.get_public_organization('wakilisha')
       ->> 'canonical_path'
     <> '/organizations/wakilisha'
  then
    raise exception
      'STOP: public WAKILISHA Organization resolver is not canonical';
  end if;
end;
$verify$;

select jsonb_build_object(
  'verification', 'PASS',
  'organization_path', '/organizations/wakilisha',
  'organization_types', jsonb_build_array(
    'cultural_platform',
    'publication'
  ),
  'staff_articles', 73,
  'human_article_paths_preserved', 134,
  'registry_label_pairings_seeded', 0
) as organization_identity_foundation;

