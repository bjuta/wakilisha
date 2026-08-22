do $verify$
declare
  v_access_oid oid :=
    to_regprocedure(
      'editorial.current_user_can_use_credit_identity()'
    );
  v_picker_oid oid :=
    to_regprocedure(
      'public.list_editorial_credit_picker_options(text,integer)'
    );
  v_resolver_oid oid :=
    to_regprocedure(
      'public.resolve_editorial_credit(text,uuid,text,boolean)'
    );
  v_access_definition text;
  v_picker_definition text;
  v_resolver_definition text;
  v_legacy_create_count integer;
begin
  if v_access_oid is null
     or v_picker_oid is null
     or v_resolver_oid is null
  then
    raise exception
      'Editorial Credit identity primitive RPC is missing.';
  end if;

  select pg_get_functiondef(v_access_oid)
  into v_access_definition;

  select pg_get_functiondef(v_picker_oid)
  into v_picker_definition;

  select pg_get_functiondef(v_resolver_oid)
  into v_resolver_definition;

  if not exists (
    select 1
    from pg_proc function_row
    where function_row.oid = v_picker_oid
      and function_row.prosecdef
      and function_row.provolatile = 's'
  ) then
    raise exception
      'Credit picker options must remain STABLE SECURITY DEFINER.';
  end if;

  if not exists (
    select 1
    from pg_proc function_row
    where function_row.oid = v_resolver_oid
      and function_row.prosecdef
      and function_row.provolatile = 'v'
  ) then
    raise exception
      'Credit resolver must remain VOLATILE SECURITY DEFINER.';
  end if;

  if has_function_privilege(
       'public',
       'public.list_editorial_credit_picker_options(text,integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.list_editorial_credit_picker_options(text,integer)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.list_editorial_credit_picker_options(text,integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'public',
       'public.resolve_editorial_credit(text,uuid,text,boolean)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.resolve_editorial_credit(text,uuid,text,boolean)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.resolve_editorial_credit(text,uuid,text,boolean)',
       'EXECUTE'
     )
  then
    raise exception
      'Editorial Credit primitive execution grants are incorrect.';
  end if;

  if position('view_trust_records' in v_access_definition) = 0
     or position('edit_own_articles' in v_access_definition) = 0
     or position('edit_own_playlists' in v_access_definition) = 0
     or position('edit_own_audio' in v_access_definition) = 0
     or position('manage_credits' in v_access_definition) = 0
  then
    raise exception
      'Editorial Credit access no longer composes shared editorial authority.';
  end if;

  if position('editorial.resolve_person_presentation' in v_picker_definition) = 0
     or position('editorial.resolve_credit_person' in v_picker_definition) = 0
     or position('editorial.resolve_credit_organization' in v_picker_definition) = 0
     or position('available_credit_roles' in v_picker_definition) = 0
     or position('can_create_credit' in v_picker_definition) = 0
  then
    raise exception
      'Credit picker no longer composes canonical party identity and governed Credit availability.';
  end if;

  if position('editorial.resolve_credit_person' in v_resolver_definition) = 0
     or position('editorial.resolve_credit_organization' in v_resolver_definition) = 0
     or position('editorial.assert_credit_command_actor' in v_resolver_definition) = 0
     or position('preferred_identity_link_id' in v_resolver_definition) = 0
     or position('organization_resource_id' in v_resolver_definition) = 0
     or position('''created'', false' in v_resolver_definition) = 0
     or position('''created'', true' in v_resolver_definition) = 0
  then
    raise exception
      'Credit resolver no longer reuses canonical governed identity before privileged creation.';
  end if;

  if position('''user_id''' in v_picker_definition) > 0
     or position('''registry_author_id''' in v_picker_definition) > 0
     or position('''external_contributor_id''' in v_picker_definition) > 0
  then
    raise exception
      'Credit picker payload leaked raw source-identity ids.';
  end if;

  select count(*)
  into v_legacy_create_count
  from pg_proc function_row
  join pg_namespace namespace_row
    on namespace_row.oid = function_row.pronamespace
  where namespace_row.nspname = 'public'
    and function_row.proname = 'create_credit'
    and pg_get_function_identity_arguments(function_row.oid) =
      'p_credit_role text, p_user_id uuid, p_registry_author_id uuid, p_external_contributor_id uuid, p_role_label_override text, p_credit_note text, p_public_safe boolean';

  if v_legacy_create_count <> 1 then
    raise exception
      'Legacy create_credit compatibility signature changed unexpectedly.';
  end if;

  raise notice
    'PASS: Editorial Credit identity primitive keeps canonical party semantics above raw identity transport and preserves privileged Credit creation.';
end;
$verify$;
