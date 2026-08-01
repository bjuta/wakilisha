begin;

do $verify$
declare
  v_workspace_definition text;
  v_public_definition text;
  v_workspace_compact text;
  v_public_compact text;

  v_workspace_security_definer boolean;
  v_public_security_definer boolean;

  v_workspace_volatility "char";
  v_public_volatility "char";

  v_workspace_config text[];
  v_public_config text[];

  v_ordering_needle constant text :=
    'order by attachment.display_order, attachment.created_at, attachment.id';
begin
  if to_regprocedure(
       'public.get_article_version_trust_workspace(uuid)'
     ) is null then
    raise exception
      'STOP: Workspace trust read function is missing';
  end if;

  if to_regprocedure(
       'public.public_get_article_trust(text)'
     ) is null then
    raise exception
      'STOP: Public Article trust read function is missing';
  end if;

  select
    function_record.prosecdef,
    function_record.provolatile,
    function_record.proconfig,
    pg_get_functiondef(function_record.oid)
  into
    v_workspace_security_definer,
    v_workspace_volatility,
    v_workspace_config,
    v_workspace_definition
  from pg_proc function_record
  where function_record.oid =
    'public.get_article_version_trust_workspace(uuid)'::regprocedure;

  select
    function_record.prosecdef,
    function_record.provolatile,
    function_record.proconfig,
    pg_get_functiondef(function_record.oid)
  into
    v_public_security_definer,
    v_public_volatility,
    v_public_config,
    v_public_definition
  from pg_proc function_record
  where function_record.oid =
    'public.public_get_article_trust(text)'::regprocedure;

  v_workspace_compact := regexp_replace(
    lower(v_workspace_definition),
    '[[:space:]]+',
    ' ',
    'g'
  );

  v_public_compact := regexp_replace(
    lower(v_public_definition),
    '[[:space:]]+',
    ' ',
    'g'
  );

  if not v_workspace_security_definer
     or v_workspace_volatility <> 's'
     or not exists (
       select 1
       from unnest(
         coalesce(v_workspace_config, '{}'::text[])
       ) as setting(value)
       where regexp_replace(
         lower(setting.value),
         '[[:space:]]+',
         '',
         'g'
       ) = 'search_path=pg_catalog,public,editorial'
     ) then
    raise exception
      'STOP: Workspace trust read security contract is incomplete';
  end if;

  if not v_public_security_definer
     or v_public_volatility <> 's'
     or not exists (
       select 1
       from unnest(
         coalesce(v_public_config, '{}'::text[])
       ) as setting(value)
       where regexp_replace(
         lower(setting.value),
         '[[:space:]]+',
         '',
         'g'
       ) = 'search_path=pg_catalog,public,editorial'
     ) then
    raise exception
      'STOP: Public trust read security contract is incomplete';
  end if;

  if position(
       'editorial.current_user_can_edit_article'
       in v_workspace_compact
     ) = 0 then
    raise exception
      'STOP: Workspace trust read lacks Article edit authority';
  end if;

  if position(
       'citation_revision'
       in v_workspace_compact
     ) = 0
     or position(
       'credit_revision'
       in v_workspace_compact
     ) = 0
     or position(
       $needle$'[]'::jsonb$needle$
       in v_workspace_compact
     ) = 0 then
    raise exception
      'STOP: Workspace trust bundle contract is incomplete';
  end if;

  if (
       length(v_workspace_compact)
       - length(
           replace(
             v_workspace_compact,
             v_ordering_needle,
             ''
           )
         )
     ) / length(v_ordering_needle) < 2 then
    raise exception
      'STOP: Workspace trust ordering is incomplete';
  end if;

  if has_function_privilege(
       'anon',
       'public.get_article_version_trust_workspace(uuid)',
       'EXECUTE'
     ) then
    raise exception
      'STOP: Anonymous role can execute workspace trust read';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.get_article_version_trust_workspace(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.get_article_version_trust_workspace(uuid)',
       'EXECUTE'
     ) then
    raise exception
      'STOP: Workspace trust read execution grants are incomplete';
  end if;

  if position(
       'current_published_version_id'
       in v_public_compact
     ) = 0
     or position(
       'attachment.target_version_id = v_published_version_id'
       in v_public_compact
     ) = 0 then
    raise exception
      'STOP: Public trust read does not derive the published version';
  end if;

  if position(
       'p_article_version_id'
       in v_public_compact
     ) > 0 then
    raise exception
      'STOP: Public trust read accepts an Article version identifier';
  end if;

  if position(
       'source.current_approved_version_id'
       in v_public_compact
     ) = 0
     or position(
       'citation.citation_state = ''active'''
       in v_public_compact
     ) = 0
     or position(
       'source.source_state = ''active'''
       in v_public_compact
     ) = 0
     or position(
       'source.withdrawn_at is null'
       in v_public_compact
     ) = 0
     or position(
       'governance.credit_state = ''active'''
       in v_public_compact
     ) = 0 then
    raise exception
      'STOP: Public eligibility is not recalculated at read time';
  end if;

  if position('internal_notes' in v_public_compact) > 0
     or position('editor_note' in v_public_compact) > 0
     or position('governance_reason' in v_public_compact) > 0
     or position('contact_email' in v_public_compact) > 0
     or position('contact_phone' in v_public_compact) > 0
     or position('citation.quotation' in v_public_compact) > 0 then
    raise exception
      'STOP: Public trust read exposes a prohibited field';
  end if;

  if position(
       'when citation.locator_type = ''quotation'' then null else citation.locator_data end'
       in v_public_compact
     ) = 0 then
    raise exception
      'STOP: Quotation locator content is not redacted from the public payload';
  end if;

  if (
       length(v_public_compact)
       - length(
           replace(
             v_public_compact,
             v_ordering_needle,
             ''
           )
         )
     ) / length(v_ordering_needle) < 2 then
    raise exception
      'STOP: Public trust ordering is incomplete';
  end if;

  if position(
       $needle$'[]'::jsonb$needle$
       in v_public_compact
     ) = 0 then
    raise exception
      'STOP: Public trust empty-family contract is incomplete';
  end if;

  if has_function_privilege(
       'anon',
       'public.public_get_article_trust(text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.public_get_article_trust(text)',
       'EXECUTE'
     ) then
    raise exception
      'STOP: Public trust read must remain server-owned';
  end if;

  if not has_function_privilege(
       'service_role',
       'public.public_get_article_trust(text)',
       'EXECUTE'
     ) then
    raise exception
      'STOP: Service role cannot execute public trust read';
  end if;

  if has_table_privilege(
       'anon',
       'editorial.sources',
       'SELECT'
     )
     or has_table_privilege(
       'anon',
       'editorial.citations',
       'SELECT'
     )
     or has_table_privilege(
       'anon',
       'editorial.credits',
       'SELECT'
     )
     or has_table_privilege(
       'anon',
       'editorial.resource_citations',
       'SELECT'
     )
     or has_table_privilege(
       'anon',
       'editorial.resource_credits',
       'SELECT'
     ) then
    raise exception
      'STOP: Anonymous role can directly read editorial trust tables';
  end if;
end;
$verify$;

rollback;
