do $verify$
declare
  v_total bigint;
  v_distinct bigint;
begin
  if to_regprocedure(
       'public.list_public_article_author_paths(text)'
     ) is null
  then
    raise exception
      'STOP: public Article author Person path authority is missing';
  end if;

  select
    count(*),
    count(distinct article_id)
  into
    v_total,
    v_distinct
  from public.list_public_article_author_paths(null);

  if v_total <> 134
     or v_distinct <> 134
  then
    raise exception
      'STOP: expected 134 unique current human Article Person paths, got % rows / % Articles',
      v_total,
      v_distinct;
  end if;

  if exists (
    select 1
    from public.list_public_article_author_paths(null) path_row
    where path_row.author_person_path not like '/people/%'
       or path_row.author_person_id is null
  )
  then
    raise exception
      'STOP: a public Article author path is not canonical Person authority';
  end if;

  if exists (
    select 1
    from public.list_public_article_author_paths(null) path_row
    join public.wk_articles article
      on article.id = path_row.article_id
    where btrim(
      coalesce(
        to_jsonb(article) ->> 'author',
        ''
      )
    ) = 'Wakilisha Staff'
  )
  then
    raise exception
      'STOP: Wakilisha Staff must remain outside Person authority';
  end if;

  if (
    select count(*)
    from public.list_public_article_author_paths(null) path_row
    join public.wk_articles article
      on article.id = path_row.article_id
    where btrim(
      coalesce(
        to_jsonb(article) ->> 'author',
        ''
      )
    ) = 'Muiruri Beautah'
      and path_row.author_person_path =
          '/people/beautah'
  ) <> 31
  then
    raise exception
      'STOP: all 31 Muiruri Beautah Articles must resolve to /people/beautah';
  end if;
end;
$verify$;

select jsonb_build_object(
  'verification', 'PASS',
  'human_article_paths', (
    select count(*)
    from public.list_public_article_author_paths(null)
  ),
  'canonical_beautah_path', '/people/beautah',
  'staff_articles_unlinked', 73
) as article_author_person_public_paths;
