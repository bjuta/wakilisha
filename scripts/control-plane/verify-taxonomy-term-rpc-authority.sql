select set_config(
  'request.jwt.claim.role',
  'service_role',
  true
);

do $verify$
declare
  v_function_oid oid;
  v_function_count integer;
  v_default_count integer;
  v_security_definer boolean;
  v_search_path_hardened boolean;
begin
  select count(*)::integer
  into v_function_count
  from pg_proc procedure
  join pg_namespace namespace
    on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname =
      'create_taxonomy_term';

  if v_function_count <> 1 then
    raise exception
      'STOP: Expected exactly one create_taxonomy_term function, found %',
      v_function_count;
  end if;

  v_function_oid :=
    to_regprocedure(
      'public.create_taxonomy_term(text,text,text,text,text,text,text)'
    );

  if v_function_oid is null then
    raise exception
      'STOP: Canonical seven-argument create_taxonomy_term function is missing';
  end if;

  if to_regprocedure(
       'public.create_taxonomy_term(text,text,text,text)'
     ) is not null then
    raise exception
      'STOP: Legacy four-argument create_taxonomy_term overload remains';
  end if;

  select
    procedure.pronargdefaults,
    procedure.prosecdef,
    exists (
      select 1
      from unnest(
        coalesce(
          procedure.proconfig,
          array[]::text[]
        )
      ) configuration(value)
      where configuration.value
        like 'search_path=%public%auth%'
    )
  into
    v_default_count,
    v_security_definer,
    v_search_path_hardened
  from pg_proc procedure
  where procedure.oid = v_function_oid;

  if v_default_count <> 4 then
    raise exception
      'STOP: Canonical create_taxonomy_term defaults changed';
  end if;

  if not v_security_definer then
    raise exception
      'STOP: Canonical create_taxonomy_term is not SECURITY DEFINER';
  end if;

  if not v_search_path_hardened then
    raise exception
      'STOP: Canonical create_taxonomy_term search_path is not hardened';
  end if;

  if has_function_privilege(
       'anon',
       v_function_oid,
       'EXECUTE'
     ) then
    raise exception
      'STOP: Anonymous role can execute create_taxonomy_term';
  end if;

  if not has_function_privilege(
       'authenticated',
       v_function_oid,
       'EXECUTE'
     ) then
    raise exception
      'STOP: Authenticated role cannot execute create_taxonomy_term';
  end if;

  if not has_function_privilege(
       'service_role',
       v_function_oid,
       'EXECUTE'
     ) then
    raise exception
      'STOP: Service role cannot execute create_taxonomy_term';
  end if;

  if position(
       'manage_categories'
       in pg_get_functiondef(
         v_function_oid
       )
     ) = 0 then
    raise exception
      'STOP: Canonical create_taxonomy_term lost capability validation';
  end if;
end;
$verify$;

select
  'PASS: create_taxonomy_term has one canonical signature, hardened search path, capability validation, and correct execute grants.'
    as verification_result;
