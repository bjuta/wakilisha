select
  case
    when
      to_regprocedure(
        'public.get_public_registry_artists_for_search(integer)'
      ) is not null
      and has_function_privilege(
        'anon',
        'public.get_public_registry_artists_for_search(integer)',
        'EXECUTE'
      )
      and has_function_privilege(
        'authenticated',
        'public.get_public_registry_artists_for_search(integer)',
        'EXECUTE'
      )
      and not has_table_privilege(
        'anon',
        'public.registry_artists',
        'SELECT'
      )
    then 'PUBLIC_ARTIST_SEARCH_AUTHORITY_PASS'
    else 'PUBLIC_ARTIST_SEARCH_AUTHORITY_FAIL'
  end as result;
