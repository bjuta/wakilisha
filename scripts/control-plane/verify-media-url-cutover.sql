select jsonb_build_object(
  'verification',
    case
      when
        not exists (
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
        )
        and not exists (
          select 1
          from public.registry_artists
          where id in (
            '5c1dd075-0f99-4898-aaf8-7693274f91f5',
            '7b50a82f-db6a-4c3b-9773-3c354dcea127'
          )
            and metadata::text like
              '%wakilisha.africa/wp-content/uploads/%'
        )
        and not exists (
          select 1
          from wakilisha_repaired.track_playback_sources
          where id in (
            '4ee42475-5b9a-4194-8a12-66a862a71894',
            '70a576e3-9339-49e4-9f24-9995a088dbdb',
            '97f1287d-8aaa-4a83-b89f-ea5f663c935a',
            '9975611b-cabe-4772-bc14-76f68da9e12b',
            'cf35c67c-995d-4ce2-bdb5-b3d72e343eb3',
            'eee67133-93c9-4f17-952d-ea64f9040c24',
            'fd82e762-77e1-4058-be17-e5e3cfed48be',
            'ff16c000-507c-49e4-8dbb-d817fcf31735'
          )
            and artwork_url like
              '%wakilisha.africa/wp-content/uploads/%'
        )
        and (
          select count(*)
          from editorial.resources resource
          join editorial.article_versions version
            on version.id =
              resource.current_published_version_id
          where resource.id =
            'edcc3982-fd2e-4d92-a8c7-27066ccc5448'
            and version.article_id =
              'd874e79a-8730-4eec-bbb1-e14c1b81fb33'
            and version.version_kind = 'published'
            and version.content_html not like '%i_.wp.com%'
        ) = 1
        and (
          select count(*)
          from public.wk_article_publication_snapshots snapshot
          where snapshot.article_id =
            'd874e79a-8730-4eec-bbb1-e14c1b81fb33'
            and snapshot.is_active
            and snapshot.content_html not like '%i_.wp.com%'
        ) = 1
        and (
          select count(*)
          from public.wk_articles article
          where article.id =
            'd874e79a-8730-4eec-bbb1-e14c1b81fb33'
            and article.content_html not like '%i_.wp.com%'
        ) = 1
        and (
          select count(*)
          from editorial.article_versions version
          where version.id =
            '98a3aa59-fa83-4130-99fc-0f8441c5aa46'
            and md5(version.content_html) =
              '0cfcde59dbcd982173934c33a8f790cb'
        ) = 1
      then 'MEDIA_URL_CUTOVER_PASS'
      else 'MEDIA_URL_CUTOVER_FAIL'
    end,
  'active_legacy_rows',
    (
      select count(*)
      from (
        select id::text
        from public.briefing_issues
        where curated_content::text like
          '%wakilisha.africa/wp-content/uploads/%'
           or html_body like
          '%wakilisha.africa/wp-content/uploads/%'

        union all

        select id::text
        from public.registry_artists
        where metadata::text like
          '%wakilisha.africa/wp-content/uploads/%'

        union all

        select id::text
        from wakilisha_repaired.track_playback_sources
        where artwork_url like
          '%wakilisha.africa/wp-content/uploads/%'
      ) remaining
    ),
  'accepted_analytics_rows',
    (
      select count(*)
      from public.analytics_events
      where id between 9320 and 9327
        and page_url like '%wp-content%'
    ),
  'accepted_archived_media_rows',
    (
      select count(*)
      from public.registry_media_assets
      where id in (
        '05151bd9-5f1e-4db2-bfed-367cc79274af',
        'fe59fbdb-45e3-49c6-aed5-cb67f50ee137'
      )
        and status = 'archived'
        and url like '%wp-content/plugins/%'
    ),
  'accepted_external_document_rows',
    (
      select
        (select count(*)
         from editorial.article_versions
         where id =
           '1a095311-1e21-45a6-83cc-9f32d8ade636'
           and content_html like
             '%communityengagementhub.org/wp-content/%')
        +
        (select count(*)
         from public.wk_article_publication_snapshots
         where id =
           '873f364a-2c08-46d3-8cc7-7901d82f08f0'
           and content_html like
             '%communityengagementhub.org/wp-content/%')
        +
        (select count(*)
         from public.wk_articles
         where id =
           '6cb9d191-308a-4eec-b08c-c228b2113743'
           and content_html like
             '%communityengagementhub.org/wp-content/%')
    ),
  'preserved_provenance_rows',
    (
      select
        (select count(*)
         from wakilisha_repaired.content_route_classification
         where id in (
           '3dcbe175-490c-4686-b52d-e45f8999d8b3',
           'c002503b-b7cb-476a-bf35-9d9f2cbcceac'
         ))
        +
        (select count(*)
         from wakilisha_repaired.track_playback_sources
         where id in (
           '70a576e3-9339-49e4-9f24-9995a088dbdb',
           'cf35c67c-995d-4ce2-bdb5-b3d72e343eb3',
           'eee67133-93c9-4f17-952d-ea64f9040c24',
           'ff16c000-507c-49e4-8dbb-d817fcf31735'
         ))
    )
) as media_url_cutover_acceptance;
