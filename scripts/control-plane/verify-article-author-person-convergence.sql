-- Permanent read-only verification for Article Author → Person convergence.

do $verify_article_author_person_convergence$
declare
  v_human_count bigint;
  v_author_credit_count bigint;
  v_person_resolved_count bigint;
begin
  if not exists (
    select 1
    from editorial.people
    where resource_id =
          '891bbfed-1d67-42a5-93d2-984e3f4ffe9f'::uuid
      and person_state = 'active'
  ) then
    raise exception
      'STOP: canonical Beautah Person is not active';
  end if;


  if not exists (
    select 1
    from editorial.person_identity_links
    where person_resource_id =
          '891bbfed-1d67-42a5-93d2-984e3f4ffe9f'::uuid
      and registry_author_id =
          '9262021a-6b53-422f-96ae-d970004e04a9'::uuid
      and link_state = 'active'
  ) then
    raise exception
      'STOP: Muiruri Registry Author did not converge to Beautah';
  end if;

  if not exists (
    select 1
    from editorial.person_identity_links
    where person_resource_id =
          '891bbfed-1d67-42a5-93d2-984e3f4ffe9f'::uuid
      and external_contributor_id =
          '9c2d46a6-97f3-4d71-bb76-40211abce2e3'::uuid
      and link_state = 'active'
  ) then
    raise exception
      'STOP: Muiruri external identity did not converge to Beautah';
  end if;

  if exists (
    select 1
    from editorial.people
    where resource_id in (
      '75100f5b-0e76-47c4-91b8-d5f5557212c0'::uuid,
      'e0fa2ef4-8ec4-49f5-8fff-4b4230a9a65a'::uuid
    )
      and (
        person_state <> 'merged'
        or merged_into_person_resource_id <>
           '891bbfed-1d67-42a5-93d2-984e3f4ffe9f'::uuid
      )
  ) then
    raise exception
      'STOP: a reviewed Muiruri source Person did not merge into Beautah';
  end if;

  if public.get_public_person(
       'muiruri-beautah'
     ) ->> 'canonical_path'
       is distinct from
       '/people/beautah'
  then
    raise exception
      'STOP: legacy Muiruri Person route does not resolve to Beautah';
  end if;

  if public.get_public_person(
       'muiruri-beautah-e0fa2ef4'
     ) ->> 'canonical_path'
       is distinct from
       '/people/beautah'
  then
    raise exception
      'STOP: Registry Author Muiruri Person route does not resolve to Beautah';
  end if;


  if (
    select count(*)
    from public.wk_articles article
    join editorial.article_resources binding
      on binding.article_id = article.id
    join editorial.resources resource
      on resource.id = binding.resource_id
    where resource.resource_kind = 'article'
      and resource.visibility = 'public'
      and resource.lifecycle_state = 'published'
      and resource.current_published_version_id is not null
      and btrim(
        coalesce(
          to_jsonb(article) ->> 'author',
          ''
        )
      ) <> 'Wakilisha Staff'
  ) <> 134 then
    raise exception
      'STOP: current public human Article count is not 134';
  end if;

  select count(*)
  into v_human_count
  from public.wk_articles article
  join editorial.article_resources binding
    on binding.article_id = article.id
  join editorial.resources resource
    on resource.id = binding.resource_id
  join public.registry_authors author_record
    on lower(btrim(author_record.name)) =
       lower(
         btrim(
           coalesce(
             to_jsonb(article) ->> 'author',
             ''
           )
         )
       )
  where resource.resource_kind = 'article'
    and resource.visibility = 'public'
    and resource.lifecycle_state = 'published'
    and resource.current_published_version_id is not null;

  select count(*)
  into v_author_credit_count
  from public.wk_articles article
  join editorial.article_resources binding
    on binding.article_id = article.id
  join editorial.resources resource
    on resource.id = binding.resource_id
  where resource.resource_kind = 'article'
    and resource.visibility = 'public'
    and resource.lifecycle_state = 'published'
    and resource.current_published_version_id is not null
    and btrim(
      coalesce(
        to_jsonb(article) ->> 'author',
        ''
      )
    ) <> 'Wakilisha Staff'
    and exists (
      select 1
      from editorial.resource_credits attachment
      join editorial.credits credit
        on credit.id = attachment.credit_id
      join editorial.credit_governance governance
        on governance.credit_id = credit.id
      where attachment.target_version_id =
            resource.current_published_version_id
        and attachment.resource_id =
            resource.id
        and attachment.resource_kind =
            'article'
        and attachment.target_version_type =
            'article_version'
        and attachment.display_order = 0
        and attachment.is_primary
        and attachment.public_safe
        and credit.credit_role = 'author'
        and governance.credit_state = 'active'
        and governance.public_safe
    );

  select count(*)
  into v_person_resolved_count
  from public.wk_articles article
  join editorial.article_resources binding
    on binding.article_id = article.id
  join editorial.resources resource
    on resource.id = binding.resource_id
  where resource.resource_kind = 'article'
    and resource.visibility = 'public'
    and resource.lifecycle_state = 'published'
    and resource.current_published_version_id is not null
    and btrim(
      coalesce(
        to_jsonb(article) ->> 'author',
        ''
      )
    ) <> 'Wakilisha Staff'
    and exists (
      select 1
      from editorial.resource_credits attachment
      where attachment.target_version_id =
            resource.current_published_version_id
        and attachment.resource_id =
            resource.id
        and attachment.is_primary
        and editorial.resolve_credit_person(
              attachment.credit_id
            ) is not null
    );

  if v_human_count <> 134
     or v_author_credit_count <> 134
     or v_person_resolved_count <> 134
  then
    raise exception
      'STOP: human Article Person convergence incomplete: human %, credited %, resolved %',
      v_human_count,
      v_author_credit_count,
      v_person_resolved_count;
  end if;

  if (
    select count(*)
    from public.wk_articles article
    join editorial.article_resources binding
      on binding.article_id = article.id
    join editorial.resources resource
      on resource.id = binding.resource_id
    where resource.resource_kind = 'article'
      and resource.visibility = 'public'
      and resource.lifecycle_state = 'published'
      and resource.current_published_version_id is not null
      and btrim(
        coalesce(
          to_jsonb(article) ->> 'author',
          ''
        )
      ) = 'Wakilisha Staff'
  ) <> 73 then
    raise exception
      'STOP: Wakilisha Staff boundary changed';
  end if;

  if public.resolve_public_registry_author_person(
       'muiruri-beautah'
     ) ->> 'canonical_path'
       is distinct from
       '/people/beautah'
  then
    raise exception
      'STOP: Registry Author compatibility resolver does not return Beautah';
  end if;
end;
$verify_article_author_person_convergence$;

select jsonb_build_object(
  'verification',
    'PASS',
  'canonical_beautah_path',
    '/people/beautah',
  'human_articles',
    134,
  'staff_articles_deferred',
    73
) as article_author_person_convergence;
