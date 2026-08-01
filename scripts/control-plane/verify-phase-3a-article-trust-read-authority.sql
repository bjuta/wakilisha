begin;

do $verify$
declare
  v_workspace_definition text;
  v_public_definition text;
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

  select pg_get_functiondef(
    'public.get_article_version_trust_workspace(uuid)'::regprocedure
  )
  into v_workspace_definition;

  select pg_get_functiondef(
    'public.public_get_article_trust(text)'::regprocedure
  )
  into v_public_definition;

  if position(
       'SECURITY DEFINER'
       in upper(v_workspace_definition)
     ) = 0
     or position(
       'SET search_path TO pg_catalog, public, editorial'
       in v_workspace_definition
     ) = 0 then
    raise exception
      'STOP: Workspace trust read security contract is incomplete';
  end if;

  if position(
       'SECURITY DEFINER'
       in upper(v_public_definition)
     ) = 0
     or position(
       'SET search_path TO pg_catalog, public, editorial'
       in v_public_definition
     ) = 0 then
    raise exception
      'STOP: Public trust read security contract is incomplete';
  end if;

  if position(
       'editorial.current_user_can_edit_article'
       in v_workspace_definition
     ) = 0 then
    raise exception
      'STOP: Workspace trust read lacks Article edit authority';
  end if;

  if position(
       'citation_revision'
       in v_workspace_definition
     ) = 0
     or position(
       'credit_revision'
       in v_workspace_definition
     ) = 0
     or position(
       '[]'::jsonb'
       in v_workspace_definition
     ) = 0 then
    raise exception
      'STOP: Workspace trust bundle contract is incomplete';
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
     ) then
    raise exception
      'STOP: Authenticated role cannot execute workspace trust read';
  end if;

  if position(
       'current_published_version_id'
       in v_public_definition
     ) = 0
     or position(
       'target_version_id = v_published_version_id'
       in v_public_definition
     ) = 0 then
    raise exception
      'STOP: Public trust read does not derive the published version';
  end if;

  if position(
       'p_article_version_id'
       in v_public_definition
     ) > 0 then
    raise exception
      'STOP: Public trust read accepts an Article version identifier';
  end if;

  if position(
       'source.current_approved_version_id'
       in v_public_definition
     ) = 0
     or position(
       'citation.citation_state = ''active'''
       in v_public_definition
     ) = 0
     or position(
       'governance.credit_state = ''active'''
       in v_public_definition
     ) = 0 then
    raise exception
      'STOP: Public eligibility is not recalculated at read time';
  end if;

  if position('internal_notes' in v_public_definition) > 0
     or position('editor_note' in v_public_definition) > 0
     or position('governance_reason' in v_public_definition) > 0
     or position('contact_email' in v_public_definition) > 0
     or position('contact_phone' in v_public_definition) > 0
     or position('citation.quotation' in v_public_definition) > 0 then
    raise exception
      'STOP: Public trust read exposes a prohibited field';
  end if;

  if position(
       'citation.locator_type = ''quotation'''
       in v_public_definition
     ) = 0
     or position(
       'then null'
       in v_public_definition
     ) = 0 then
    raise exception
      'STOP: Quotation locator content is not redacted from the public payload';
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
