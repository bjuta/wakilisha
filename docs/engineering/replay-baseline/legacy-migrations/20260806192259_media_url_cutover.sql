begin;

set local statement_timeout = '180s';
set local lock_timeout = '5s';

create temporary table media_url_cutover_playback_preimage (
  id uuid primary key,
  expected_md5 text not null
) on commit drop;

insert into media_url_cutover_playback_preimage (
  id,
  expected_md5
)
values
  (
    '4ee42475-5b9a-4194-8a12-66a862a71894',
    '40c1e2406d56c1de42d3f74b1e5b4406'
  ),
  (
    '70a576e3-9339-49e4-9f24-9995a088dbdb',
    '8362e24cf47baa04df499d2890dc8a8b'
  ),
  (
    '97f1287d-8aaa-4a83-b89f-ea5f663c935a',
    'cf63ad6484e3f1a6d5c7dcd5409f2fee'
  ),
  (
    '9975611b-cabe-4772-bc14-76f68da9e12b',
    'c238b9d882bacf2336949e5f442c76df'
  ),
  (
    'cf35c67c-995d-4ce2-bdb5-b3d72e343eb3',
    '40c1e2406d56c1de42d3f74b1e5b4406'
  ),
  (
    'eee67133-93c9-4f17-952d-ea64f9040c24',
    'cf63ad6484e3f1a6d5c7dcd5409f2fee'
  ),
  (
    'fd82e762-77e1-4058-be17-e5e3cfed48be',
    '8362e24cf47baa04df499d2890dc8a8b'
  ),
  (
    'ff16c000-507c-49e4-8dbb-d817fcf31735',
    'c238b9d882bacf2336949e5f442c76df'
  );

do $preflight$
declare
  v_count bigint;
begin
  if (
    select count(*)
    from public.briefing_issues
    where id =
      '6e68878d-69ff-4ebf-b3eb-d173cf19eca4'
      and md5(curated_content::text) =
        '451acfe8396f5b9596e0942fd36c2a5c'
      and md5(html_body) =
        '085b2b552a7ba0eaa1e122ace24540b5'
  ) <> 1 then
    raise exception
      'STOP: Briefing preimage changed';
  end if;

  if (
    select count(*)
    from public.registry_artists
    where (
      id = '5c1dd075-0f99-4898-aaf8-7693274f91f5'
      and md5(metadata::text) =
        'fdc4e26c448ef33b0e2f5bb68db22ddc'
    ) or (
      id = '7b50a82f-db6a-4c3b-9773-3c354dcea127'
      and md5(metadata::text) =
        'ff17aa2a02958865f2411e312be05c1c'
    )
  ) <> 2 then
    raise exception
      'STOP: Artist metadata preimage changed';
  end if;

  select count(*)
  into v_count
  from wakilisha_repaired.track_playback_sources source_row
  join media_url_cutover_playback_preimage expected
    on expected.id = source_row.id
   and expected.expected_md5 =
       md5(source_row.artwork_url);

  if v_count <> 8 then
    raise exception
      'STOP: Playback artwork preimage changed';
  end if;

  if (
    select count(*)
    from editorial.article_versions
    where id =
      '98a3aa59-fa83-4130-99fc-0f8441c5aa46'
      and md5(content_html) =
        '0cfcde59dbcd982173934c33a8f790cb'
  ) <> 1
  or (
    select count(*)
    from public.wk_article_publication_snapshots
    where id =
      '62e14f66-9955-46dc-bde0-8cacc7174592'
      and md5(content_html) =
        '0cfcde59dbcd982173934c33a8f790cb'
  ) <> 1
  or (
    select count(*)
    from public.wk_articles
    where id =
      'd874e79a-8730-4eec-bbb1-e14c1b81fb33'
      and md5(content_html) =
        '0cfcde59dbcd982173934c33a8f790cb'
  ) <> 1 then
    raise exception
      'STOP: Maasai Market article preimage changed';
  end if;

  if (
    select count(*)
    from wakilisha_repaired.content_route_classification
    where (
      id = '3dcbe175-490c-4686-b52d-e45f8999d8b3'
      and md5(source_payload::text) =
        '300c3856016b47f9a4569fed5c45388b'
    ) or (
      id = 'c002503b-b7cb-476a-bf35-9d9f2cbcceac'
      and md5(source_payload::text) =
        '6c698e1a9f6b6199fff164546b8a7461'
    )
  ) <> 2 then
    raise exception
      'STOP: Content-route provenance changed';
  end if;

  if (
    select count(*)
    from wakilisha_repaired.track_playback_sources
    where (
      id = '70a576e3-9339-49e4-9f24-9995a088dbdb'
      and md5(source_payload::text) =
        '583ea82a7d08983cc3dbd6d5dc292940'
    ) or (
      id = 'cf35c67c-995d-4ce2-bdb5-b3d72e343eb3'
      and md5(source_payload::text) =
        '9a6922750e273e687db58c50de19528e'
    ) or (
      id = 'eee67133-93c9-4f17-952d-ea64f9040c24'
      and md5(source_payload::text) =
        '7a5640ae6c7636aa0c28a92aa1808178'
    ) or (
      id = 'ff16c000-507c-49e4-8dbb-d817fcf31735'
      and md5(source_payload::text) =
        'cdb846caff8501c2c415a624952e5bee'
    )
  ) <> 4 then
    raise exception
      'STOP: Playback provenance changed';
  end if;

  if (
    select count(*)
    from public.analytics_events
    where id between 9320 and 9327
      and page_url like '%wp-content%'
  ) <> 8 then
    raise exception
      'STOP: Historical analytics baseline changed';
  end if;

  if (
    select count(*)
    from public.registry_media_assets
    where (
      id = '05151bd9-5f1e-4db2-bfed-367cc79274af'
      and status = 'archived'
      and md5(url) =
        'c877b7156e3eb01b244e96042d7a9828'
    ) or (
      id = 'fe59fbdb-45e3-49c6-aed5-cb67f50ee137'
      and status = 'archived'
      and md5(url) =
        '03aea99ec6e4cb622b302f3578709004'
    )
  ) <> 2 then
    raise exception
      'STOP: Archived guide Media tombstones changed';
  end if;

  if (
    select count(*)
    from editorial.article_versions
    where id =
      '1a095311-1e21-45a6-83cc-9f32d8ade636'
      and md5(content_html) =
        '1e93afb17826eb36b51bd3e5370a2be3'
  ) <> 1
  or (
    select count(*)
    from public.wk_article_publication_snapshots
    where id =
      '873f364a-2c08-46d3-8cc7-7901d82f08f0'
      and md5(content_html) =
        '1e93afb17826eb36b51bd3e5370a2be3'
  ) <> 1
  or (
    select count(*)
    from public.wk_articles
    where id =
      '6cb9d191-308a-4eec-b08c-c228b2113743'
      and md5(content_html) =
        '1e93afb17826eb36b51bd3e5370a2be3'
  ) <> 1 then
    raise exception
      'STOP: External document article copies changed';
  end if;
end
$preflight$;

update public.briefing_issues
set
  curated_content = replace(
    curated_content::text,
    'https://wakilisha.africa/wp-content/uploads/',
    'https://media.wakilisha.africa/uploads/'
  )::jsonb,
  html_body = replace(
    html_body,
    'https://wakilisha.africa/wp-content/uploads/',
    'https://media.wakilisha.africa/uploads/'
  )
where id =
  '6e68878d-69ff-4ebf-b3eb-d173cf19eca4';

update public.registry_artists
set metadata = replace(
  metadata::text,
  'https://wakilisha.africa/wp-content/uploads/',
  'https://media.wakilisha.africa/uploads/'
)::jsonb
where id in (
  '5c1dd075-0f99-4898-aaf8-7693274f91f5',
  '7b50a82f-db6a-4c3b-9773-3c354dcea127'
);

update wakilisha_repaired.track_playback_sources
set artwork_url = replace(
  artwork_url,
  'https://wakilisha.africa/wp-content/uploads/',
  'https://media.wakilisha.africa/uploads/'
)
where id in (
  select id
  from media_url_cutover_playback_preimage
);

do $article_cutover$
declare
  v_article_id constant uuid :=
    'd874e79a-8730-4eec-bbb1-e14c1b81fb33';
  v_resource_id constant uuid :=
    'edcc3982-fd2e-4d92-a8c7-27066ccc5448';
  v_old_version_id constant uuid :=
    '98a3aa59-fa83-4130-99fc-0f8441c5aa46';
  v_old_snapshot_id constant uuid :=
    '62e14f66-9955-46dc-bde0-8cacc7174592';

  v_new_version_id uuid;
  v_new_content text;
  v_new_fingerprint text;
begin
  select
    replace(
      replace(
        replace(
          replace(
            version.content_html,
            'https://i0.wp.com/wakilisha.africa/wp-content/uploads/2018/07/A-Walk-Through-Ngara-Market-By-Wakilisha-58.jpg?ssl=1',
            'https://media.wakilisha.africa/uploads/2018/07/A-Walk-Through-Ngara-Market-By-Wakilisha-58.jpg'
          ),
          'https://i1.wp.com/wakilisha.africa/wp-content/uploads/2018/07/A-Walk-Through-Ngara-Market-By-Wakilisha-57.jpg?ssl=1',
          'https://media.wakilisha.africa/uploads/2018/07/A-Walk-Through-Ngara-Market-By-Wakilisha-57.jpg'
        ),
        'https://i1.wp.com/wakilisha.africa/wp-content/uploads/2018/07/A-Walk-Through-Ngara-Market-By-Wakilisha-65.jpg?ssl=1',
        'https://media.wakilisha.africa/uploads/2018/07/A-Walk-Through-Ngara-Market-By-Wakilisha-65.jpg'
      ),
      'https://i2.wp.com/wakilisha.africa/wp-content/uploads/2018/07/A-Walk-Through-Ngara-Market-By-Wakilisha-67.jpg?ssl=1',
      'https://media.wakilisha.africa/uploads/2018/07/A-Walk-Through-Ngara-Market-By-Wakilisha-67.jpg'
    )
  into v_new_content
  from editorial.article_versions version
  where version.id = v_old_version_id
    and version.resource_id = v_resource_id
    and version.article_id = v_article_id
    and version.version_number = 1
    and version.version_kind = 'baseline'
    and md5(version.content_html) =
      '0cfcde59dbcd982173934c33a8f790cb';

  if v_new_content is null then
    raise exception
      'STOP: Maasai Market source version changed';
  end if;

  if v_new_content like '%i_.wp.com%' then
    raise exception
      'STOP: Rewritten Article content still contains Jetpack URLs';
  end if;

  select editorial.article_snapshot_fingerprint(
    version.title,
    version.slug,
    version.excerpt,
    v_new_content,
    version.author_display,
    version.hero_image_id,
    version.hero_image_url,
    version.seo,
    version.wp_status,
    version.published_at,
    version.category_snapshot,
    version.tag_snapshot
  )
  into v_new_fingerprint
  from editorial.article_versions version
  where version.id = v_old_version_id;

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
  select
    version.resource_id,
    version.article_id,
    2,
    'published',
    version.source_draft_version,
    version.title,
    version.slug,
    version.excerpt,
    v_new_content,
    version.author_display,
    version.owner_id,
    version.hero_image_id,
    version.hero_image_url,
    version.seo,
    'published',
    'publish',
    version.published_at,
    version.category_snapshot,
    version.tag_snapshot,
    null,
    v_new_fingerprint
  from editorial.article_versions version
  where version.id = v_old_version_id
  returning id
  into v_new_version_id;

  update public.wk_articles article
  set
    content_html = v_new_content,
    updated_at = now()
  where article.id = v_article_id
    and md5(article.content_html) =
      '0cfcde59dbcd982173934c33a8f790cb';

  if not found then
    raise exception
      'STOP: Public Article projection changed';
  end if;

  update public.wk_article_publication_snapshots snapshot
  set
    is_active = false,
    updated_at = now()
  where snapshot.id = v_old_snapshot_id
    and snapshot.article_id = v_article_id
    and snapshot.version_id = v_old_version_id
    and snapshot.is_active;

  if not found then
    raise exception
      'STOP: Active publication snapshot changed';
  end if;

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
    snapshot.article_id,
    snapshot.resource_id,
    v_new_version_id,
    snapshot.slug,
    snapshot.title,
    snapshot.excerpt,
    v_new_content,
    snapshot.author,
    snapshot.published_at,
    snapshot.modified_at,
    snapshot.categories,
    snapshot.tags,
    snapshot.seo,
    snapshot.hero_image_id,
    snapshot.hero_image_url,
    snapshot.raw_meta,
    snapshot.wp_status,
    snapshot.first_published_at,
    snapshot.last_materially_updated_at,
    snapshot.published_by,
    true
  from public.wk_article_publication_snapshots snapshot
  where snapshot.id = v_old_snapshot_id;

  update editorial.resources resource
  set
    current_working_version_id = v_new_version_id,
    current_published_version_id = v_new_version_id,
    updated_at = now()
  where resource.id = v_resource_id
    and resource.current_working_version_id = v_old_version_id
    and resource.current_published_version_id = v_old_version_id;

  if not found then
    raise exception
      'STOP: Article resource publication pointers changed';
  end if;

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
    v_resource_id,
    v_article_id,
    v_new_version_id,
    'published',
    'publish',
    'publish',
    'Normalize legacy Jetpack Media URLs to the canonical WAKILISHA Media origin.',
    jsonb_build_object(
      'migration',
        '20260806192259_media_url_cutover',
      'priorVersionId',
        v_old_version_id,
      'changeKind',
        'media_url_normalization',
      'materialEditorialChange',
        false
    )
  );
end
$article_cutover$;

do $verification$
begin
  if exists (
    select 1
    from public.briefing_issues
    where id =
      '6e68878d-69ff-4ebf-b3eb-d173cf19eca4'
      and (
        curated_content::text like
          '%wakilisha.africa/wp-content/uploads/%'
        or html_body like
          '%wakilisha.africa/wp-content/uploads/%'
      )
  ) then
    raise exception
      'STOP: Briefing still contains legacy upload URLs';
  end if;

  if exists (
    select 1
    from public.registry_artists
    where id in (
      '5c1dd075-0f99-4898-aaf8-7693274f91f5',
      '7b50a82f-db6a-4c3b-9773-3c354dcea127'
    )
      and metadata::text like
        '%wakilisha.africa/wp-content/uploads/%'
  ) then
    raise exception
      'STOP: Artist metadata still contains legacy upload URLs';
  end if;

  if exists (
    select 1
    from wakilisha_repaired.track_playback_sources
    where id in (
      select id
      from media_url_cutover_playback_preimage
    )
      and artwork_url like
        '%wakilisha.africa/wp-content/uploads/%'
  ) then
    raise exception
      'STOP: Playback artwork still contains legacy upload URLs';
  end if;

  if (
    select count(*)
    from editorial.resources resource
    join editorial.article_versions version
      on version.id =
        resource.current_published_version_id
    where resource.id =
      'edcc3982-fd2e-4d92-a8c7-27066ccc5448'
      and version.article_id =
        'd874e79a-8730-4eec-bbb1-e14c1b81fb33'
      and version.version_number = 2
      and version.version_kind = 'published'
      and version.content_html not like '%i_.wp.com%'
  ) <> 1
  or (
    select count(*)
    from public.wk_article_publication_snapshots snapshot
    where snapshot.article_id =
      'd874e79a-8730-4eec-bbb1-e14c1b81fb33'
      and snapshot.is_active
      and snapshot.content_html not like '%i_.wp.com%'
  ) <> 1
  or (
    select count(*)
    from public.wk_articles article
    where article.id =
      'd874e79a-8730-4eec-bbb1-e14c1b81fb33'
      and article.content_html not like '%i_.wp.com%'
  ) <> 1
  or (
    select count(*)
    from editorial.article_versions version
    where version.id =
      '98a3aa59-fa83-4130-99fc-0f8441c5aa46'
      and md5(version.content_html) =
        '0cfcde59dbcd982173934c33a8f790cb'
  ) <> 1 then
    raise exception
      'STOP: Append-only Maasai Market cutover failed';
  end if;

  if (
    select count(*)
    from public.analytics_events
    where id between 9320 and 9327
      and page_url like '%wp-content%'
  ) <> 8 then
    raise exception
      'STOP: Historical analytics were modified';
  end if;

  if (
    select count(*)
    from public.registry_media_assets
    where id in (
      '05151bd9-5f1e-4db2-bfed-367cc79274af',
      'fe59fbdb-45e3-49c6-aed5-cb67f50ee137'
    )
      and status = 'archived'
      and url like '%wp-content/plugins/%'
  ) <> 2 then
    raise exception
      'STOP: Archived Media tombstones were modified';
  end if;

  if (
    select count(*)
    from wakilisha_repaired.content_route_classification
    where (
      id = '3dcbe175-490c-4686-b52d-e45f8999d8b3'
      and md5(source_payload::text) =
        '300c3856016b47f9a4569fed5c45388b'
    ) or (
      id = 'c002503b-b7cb-476a-bf35-9d9f2cbcceac'
      and md5(source_payload::text) =
        '6c698e1a9f6b6199fff164546b8a7461'
    )
  ) <> 2 then
    raise exception
      'STOP: Content-route provenance was modified';
  end if;

  if (
    select count(*)
    from wakilisha_repaired.track_playback_sources
    where (
      id = '70a576e3-9339-49e4-9f24-9995a088dbdb'
      and md5(source_payload::text) =
        '583ea82a7d08983cc3dbd6d5dc292940'
    ) or (
      id = 'cf35c67c-995d-4ce2-bdb5-b3d72e343eb3'
      and md5(source_payload::text) =
        '9a6922750e273e687db58c50de19528e'
    ) or (
      id = 'eee67133-93c9-4f17-952d-ea64f9040c24'
      and md5(source_payload::text) =
        '7a5640ae6c7636aa0c28a92aa1808178'
    ) or (
      id = 'ff16c000-507c-49e4-8dbb-d817fcf31735'
      and md5(source_payload::text) =
        'cdb846caff8501c2c415a624952e5bee'
    )
  ) <> 4 then
    raise exception
      'STOP: Playback provenance was modified';
  end if;

  if (
    select count(*)
    from editorial.article_versions
    where id =
      '1a095311-1e21-45a6-83cc-9f32d8ade636'
      and md5(content_html) =
        '1e93afb17826eb36b51bd3e5370a2be3'
  ) <> 1
  or (
    select count(*)
    from public.wk_article_publication_snapshots
    where id =
      '873f364a-2c08-46d3-8cc7-7901d82f08f0'
      and md5(content_html) =
        '1e93afb17826eb36b51bd3e5370a2be3'
  ) <> 1
  or (
    select count(*)
    from public.wk_articles
    where id =
      '6cb9d191-308a-4eec-b08c-c228b2113743'
      and md5(content_html) =
        '1e93afb17826eb36b51bd3e5370a2be3'
  ) <> 1 then
    raise exception
      'STOP: External document rows were modified';
  end if;
end
$verification$;

commit;
