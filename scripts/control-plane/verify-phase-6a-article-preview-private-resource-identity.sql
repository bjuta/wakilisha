do $verify$
declare
  function_oid oid;
  function_definition text;
  function_config text;
  orphan_count bigint;
begin
  select p.oid,
         pg_get_functiondef(p.oid),
         coalesce(array_to_string(p.proconfig, ','), '')
  into function_oid,
       function_definition,
       function_config
  from pg_proc p
  join pg_namespace n
    on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'get_admin_article_resource_identities'
    and pg_get_function_identity_arguments(p.oid) = 'p_article_ids uuid[]';

  if function_oid is null then
    raise exception
      'get_admin_article_resource_identities(uuid[]) is missing';
  end if;

  if not (
    select p.prosecdef
    from pg_proc p
    where p.oid = function_oid
  ) then
    raise exception
      'get_admin_article_resource_identities(uuid[]) must be SECURITY DEFINER';
  end if;

  if (
    select p.provolatile
    from pg_proc p
    where p.oid = function_oid
  ) <> 's' then
    raise exception
      'get_admin_article_resource_identities(uuid[]) must be STABLE';
  end if;

  if function_config not like
    '%search_path=pg_catalog, public, editorial%' then
    raise exception
      'get_admin_article_resource_identities(uuid[]) must have the fixed canonical search_path';
  end if;

  if not has_function_privilege(
    'authenticated',
    function_oid,
    'EXECUTE'
  ) then
    raise exception
      'authenticated must be able to execute get_admin_article_resource_identities(uuid[])';
  end if;

  if has_function_privilege(
    'anon',
    function_oid,
    'EXECUTE'
  ) then
    raise exception
      'anon must not be able to execute get_admin_article_resource_identities(uuid[])';
  end if;

  if position(
    'current_user_has_capability(''view_dashboard''::text)'
    in function_definition
  ) = 0
     and position(
       'current_user_has_capability(''view_dashboard'')'
       in function_definition
     ) = 0 then
    raise exception
      'Article identity RPC must require view_dashboard capability';
  end if;

  if position(
    'current_user_is_administrator()'
    in function_definition
  ) = 0 then
    raise exception
      'Article identity RPC must preserve administrator override';
  end if;

  select count(*)
  into orphan_count
  from public.wk_articles article
  where not exists (
    select 1
    from editorial.article_resources binding
    where binding.article_id = article.id
  );

  if orphan_count <> 0 then
    raise exception
      'Article Resource identity invariant failed: % orphan Article(s)',
      orphan_count;
  end if;

  raise notice
    'PASS: private draft Article Resource identity is available through authenticated admin authority without broadening public Resource RLS.';
end;
$verify$;
