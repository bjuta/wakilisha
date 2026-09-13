do $$
declare
  v_function regprocedure;
  v_view_options text[];
  v_view_definition text;
  v_document_count bigint;
  v_distinct_count bigint;
  v_page_count bigint;
  v_cursor_score integer;
  v_cursor_type_rank integer;
  v_cursor_title text;
  v_cursor_id uuid;
  v_overlap_count bigint;
begin
  if to_regclass(
    'public.public_search_documents_v1'
  ) is null then
    raise exception
      'public_search_documents_v1 is missing';
  end if;

  select c.reloptions
  into v_view_options
  from pg_class c
  join pg_namespace n
    on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'public_search_documents_v1'
    and c.relkind = 'v';

  if not coalesce(
    v_view_options @> array[
      'security_invoker=true'
    ],
    false
  ) then
    raise exception
      'public_search_documents_v1 must be security_invoker';
  end if;

  v_view_definition :=
    lower(
      pg_get_viewdef(
        'public.public_search_documents_v1'::regclass,
        true
      )
    );

  if strpos(
    v_view_definition,
    '''artist''::text as entity_type'
  ) = 0
    or strpos(
      v_view_definition,
      '''track''::text as entity_type'
    ) = 0
    or strpos(
      v_view_definition,
      '''release''::text as entity_type'
    ) = 0
    or strpos(
      v_view_definition,
      '''genre''::text as entity_type'
    ) = 0
    or strpos(
      v_view_definition,
      '''label''::text as entity_type'
    ) = 0
  then
    raise exception
      'public_search_documents_v1 does not structurally own all five Registry domains';
  end if;

  if has_table_privilege(
    'anon',
    'public.public_search_documents_v1',
    'SELECT'
  ) then
    raise exception
      'anon must not SELECT public_search_documents_v1 directly';
  end if;

  if has_table_privilege(
    'authenticated',
    'public.public_search_documents_v1',
    'SELECT'
  ) then
    raise exception
      'authenticated must not SELECT public_search_documents_v1 directly';
  end if;

  v_function := to_regprocedure(
    'public.search_public_registry_v1(text,text[],integer,integer,integer,text,uuid)'
  );

  if v_function is null then
    raise exception
      'search_public_registry_v1 is missing';
  end if;

  if not has_function_privilege(
    'anon',
    v_function,
    'EXECUTE'
  ) then
    raise exception
      'anon EXECUTE is missing on search_public_registry_v1';
  end if;

  if not has_function_privilege(
    'authenticated',
    v_function,
    'EXECUTE'
  ) then
    raise exception
      'authenticated EXECUTE is missing on search_public_registry_v1';
  end if;

  if to_regclass(
    'public.idx_registry_tracks_title_trgm'
  ) is null
    or to_regclass(
      'public.idx_registry_tracks_slug_trgm'
    ) is null
    or to_regclass(
      'public.idx_registry_releases_title_trgm'
    ) is null
    or to_regclass(
      'public.idx_registry_releases_slug_trgm'
    ) is null
    or to_regclass(
      'public.idx_registry_genres_name_trgm'
    ) is null
    or to_regclass(
      'public.idx_registry_genres_slug_trgm'
    ) is null
    or to_regclass(
      'public.idx_registry_labels_name_trgm'
    ) is null
    or to_regclass(
      'public.idx_registry_labels_slug_trgm'
    ) is null
  then
    raise exception
      'one or more canonical trigram indexes are missing';
  end if;

  select
    count(*),
    count(
      distinct (
        entity_type,
        entity_id
      )
    )
  into
    v_document_count,
    v_distinct_count
  from public.public_search_documents_v1;

  if v_document_count
    <> v_distinct_count then
    raise exception
      'public_search_documents_v1 contains duplicate entity documents';
  end if;

  select count(*)
  into v_page_count
  from public.search_public_registry_v1(
    'a',
    null,
    5,
    null,
    null,
    null,
    null
  );

  if v_page_count > 5 then
    raise exception
      'search_public_registry_v1 exceeded p_limit';
  end if;

  if v_page_count >= 2 then
    select
      score,
      type_rank,
      cursor_title,
      entity_id
    into
      v_cursor_score,
      v_cursor_type_rank,
      v_cursor_title,
      v_cursor_id
    from public.search_public_registry_v1(
      'a',
      null,
      2,
      null,
      null,
      null,
      null
    )
    order by
      score desc,
      type_rank asc,
      cursor_title asc,
      entity_id asc
    offset 1
    limit 1;

    select count(*)
    into v_overlap_count
    from public.search_public_registry_v1(
      'a',
      null,
      2,
      null,
      null,
      null,
      null
    ) first_page
    join public.search_public_registry_v1(
      'a',
      null,
      2,
      v_cursor_score,
      v_cursor_type_rank,
      v_cursor_title,
      v_cursor_id
    ) second_page
      on second_page.entity_type
        = first_page.entity_type
     and second_page.entity_id
        = first_page.entity_id;

    if v_overlap_count <> 0 then
      raise exception
        'search_public_registry_v1 cursor pages overlap';
    end if;
  end if;

  if exists (
    select 1
    from public.search_public_registry_v1(
      '',
      null,
      20,
      null,
      null,
      null,
      null
    )
  ) then
    raise exception
      'empty public search query must return zero rows';
  end if;
end
$$;

select
  'PUBLIC_SEARCH_AUTHORITY_PASS'
    as result;
