do $verify$
declare
  v_function_oid oid;
  v_definition text;
  v_normalized_definition text;
  v_security_definer boolean;
  v_volatility "char";
  v_config text[];
begin
  select
    procedure.oid,
    pg_get_functiondef(procedure.oid),
    procedure.prosecdef,
    procedure.provolatile,
    procedure.proconfig
  into
    v_function_oid,
    v_definition,
    v_security_definer,
    v_volatility,
    v_config
  from pg_proc procedure
  join pg_namespace namespace
    on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname =
      'get_article_working_version_identity'
    and pg_get_function_identity_arguments(
      procedure.oid
    ) = 'p_article_id uuid';

  if v_function_oid is null then
    raise exception
      'STOP: get_article_working_version_identity(uuid) does not exist';
  end if;

  v_normalized_definition :=
    regexp_replace(
      lower(v_definition),
      E'\\s+',
      ' ',
      'g'
    );

  if not v_security_definer then
    raise exception
      'STOP: Article working version identity is not SECURITY DEFINER';
  end if;

  if v_volatility <> 's' then
    raise exception
      'STOP: Article working version identity is not STABLE';
  end if;

  if not (
    coalesce(v_config, '{}'::text[])
    @> array[
      'search_path=pg_catalog, public, editorial'
    ]
  ) then
    raise exception
      'STOP: Article working version identity search path is not fixed';
  end if;

  if position(
    'resource.current_working_version_id'
    in v_normalized_definition
  ) = 0 then
    raise exception
      'STOP: Function does not use the authoritative working-version pointer';
  end if;

  if position(
    'editorial.current_user_can_edit_article'
    in v_normalized_definition
  ) = 0 then
    raise exception
      'STOP: Function does not enforce Article edit authority';
  end if;

  if position(
    'version.resource_id = v_resource.id'
    in v_normalized_definition
  ) = 0
     or position(
       'version.article_id = p_article_id'
       in v_normalized_definition
     ) = 0 then
    raise exception
      'STOP: Function does not validate working-version ownership';
  end if;

  if position(
    'order by version.version_number desc'
    in v_normalized_definition
  ) > 0 then
    raise exception
      'STOP: Function infers the working version from ordering';
  end if;

  if position(
    'working_version_id'
    in v_normalized_definition
  ) = 0
     or position(
       'working_version_number'
       in v_normalized_definition
     ) = 0
     or position(
       'working_version_kind'
       in v_normalized_definition
     ) = 0
     or position(
       'article_draft_version'
       in v_normalized_definition
     ) = 0 then
    raise exception
      'STOP: Function response omits required working-version context';
  end if;

  if has_function_privilege(
    'anon',
    'public.get_article_working_version_identity(uuid)',
    'EXECUTE'
  ) then
    raise exception
      'STOP: anon can execute Article working version identity';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.get_article_working_version_identity(uuid)',
    'EXECUTE'
  ) then
    raise exception
      'STOP: authenticated cannot execute Article working version identity';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.get_article_working_version_identity(uuid)',
    'EXECUTE'
  ) then
    raise exception
      'STOP: service_role cannot execute Article working version identity';
  end if;
end;
$verify$;

select
  'PASS: Article working version identity authority is structurally complete.'
    as verification_result;
