do $verify$
declare
  v_function_oid oid;
  v_acl text;
  v_definition text;
begin
  v_function_oid :=
    to_regprocedure(
      'public.get_article_trust_citation_intake_options()'
    );

  if v_function_oid is null then
    raise exception
      'STOP: Citation intake options function is missing';
  end if;

  select
    coalesce(proacl::text, ''),
    pg_get_functiondef(oid)
  into
    v_acl,
    v_definition
  from pg_proc
  where oid = v_function_oid;

  if not exists (
    select 1
    from pg_proc
    where oid = v_function_oid
      and provolatile = 's'
      and prosecdef
  ) then
    raise exception
      'STOP: Citation intake options function must be stable and security definer';
  end if;

  if position(
       'SET search_path TO ''pg_catalog'', ''public'', ''editorial'''
       in v_definition
     ) = 0 then
    raise exception
      'STOP: Citation intake options function has no fixed search path';
  end if;

  if position('anon=X/' in v_acl) > 0
     or position('PUBLIC=X/' in v_acl) > 0 then
    raise exception
      'STOP: Anonymous Citation option execution is granted';
  end if;

  if position('authenticated=X/' in v_acl) = 0
     or position('service_role=X/' in v_acl) = 0 then
    raise exception
      'STOP: Citation option execution grants are incomplete';
  end if;

  if position(
       'manage_citations'
       in v_definition
     ) = 0
     or position(
       'view_trust_records'
       in v_definition
     ) = 0 then
    raise exception
      'STOP: Citation option capability gates are incomplete';
  end if;

  if position(
       'editorial.citation_locator_types'
       in v_definition
     ) = 0 then
    raise exception
      'STOP: Citation locator vocabulary is not database-backed';
  end if;
end;
$verify$;

select
  'PASS: Article Citation intake options read authority is structurally complete.'
    as verification_result;
