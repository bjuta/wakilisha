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
      'list_article_trust_sources'
    and pg_get_function_identity_arguments(
      procedure.oid
    ) = 'p_limit integer';

  if v_function_oid is null then
    raise exception
      'STOP: list_article_trust_sources(integer) does not exist';
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
      'STOP: Article Source Library read is not SECURITY DEFINER';
  end if;

  if v_volatility <> 's' then
    raise exception
      'STOP: Article Source Library read is not STABLE';
  end if;

  if not (
    coalesce(v_config, '{}'::text[])
    @> array[
      'search_path=pg_catalog, public, editorial'
    ]
  ) then
    raise exception
      'STOP: Article Source Library read search path is not fixed';
  end if;

  if position(
    'p_limit < 1'
    in v_normalized_definition
  ) = 0
     or position(
       'p_limit > 100'
       in v_normalized_definition
     ) = 0 then
    raise exception
      'STOP: Source Library limit is not bounded';
  end if;

  if position(
    'auth.uid() is null'
    in v_normalized_definition
  ) = 0
     or position(
       'public.current_user_is_administrator()'
       in v_normalized_definition
     ) = 0
     or position(
       '''view_trust_records'''
       in v_normalized_definition
     ) = 0
     or position(
       '''manage_sources'''
       in v_normalized_definition
     ) = 0
     or position(
       '''review_sources'''
       in v_normalized_definition
     ) = 0
     or position(
       '''withdraw_sources'''
       in v_normalized_definition
     ) = 0 then
    raise exception
      'STOP: Source Library authorization is incomplete';
  end if;

  if position(
    'from editorial.source_types'
    in v_normalized_definition
  ) = 0
     or position(
       'where source_type.enabled'
       in v_normalized_definition
     ) = 0
     or position(
       'from editorial.sources'
       in v_normalized_definition
     ) = 0 then
    raise exception
      'STOP: Source Library read does not use canonical Source authority';
  end if;

  if position(
    'order by source_type.sort_order'
    in v_normalized_definition
  ) = 0
     or position(
       'source.updated_at desc'
       in v_normalized_definition
     ) = 0
     or position(
       'limit p_limit'
       in v_normalized_definition
     ) = 0 then
    raise exception
      'STOP: Source Library ordering or limit is not deterministic';
  end if;

  if position(
    '''source_types'''
    in v_normalized_definition
  ) = 0
     or position(
       '''sources'''
       in v_normalized_definition
     ) = 0
     or position(
       '''current_working_version_id'''
       in v_normalized_definition
     ) = 0
     or position(
       '''current_approved_version_id'''
       in v_normalized_definition
     ) = 0
     or position(
       '''working_revision'''
       in v_normalized_definition
     ) = 0 then
    raise exception
      'STOP: Source Library response omits required read context';
  end if;

  if position(
    'internal_notes'
    in v_normalized_definition
  ) > 0
     or position(
       'media_asset_id'
       in v_normalized_definition
     ) > 0
     or position(
       'created_by'
       in v_normalized_definition
     ) > 0
     or position(
       'updated_by'
       in v_normalized_definition
     ) > 0
     or position(
       'reviewed_by'
       in v_normalized_definition
     ) > 0
     or position(
       'withdrawal_reason'
       in v_normalized_definition
     ) > 0 then
    raise exception
      'STOP: Source Library response includes unnecessary private fields';
  end if;

  if has_function_privilege(
    'anon',
    'public.list_article_trust_sources(integer)',
    'EXECUTE'
  ) then
    raise exception
      'STOP: anon can execute Article Source Library read';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.list_article_trust_sources(integer)',
    'EXECUTE'
  ) then
    raise exception
      'STOP: authenticated cannot execute Article Source Library read';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.list_article_trust_sources(integer)',
    'EXECUTE'
  ) then
    raise exception
      'STOP: service_role cannot execute Article Source Library read';
  end if;
end;
$verify$;

select
  'PASS: Article Source Library read authority is structurally complete.'
    as verification_result;
