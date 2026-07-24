do $verify$
declare
  v_function regprocedure;
  v_definition text;
  v_owner_nullable text;
begin
  v_function :=
    'public.create_publishing_item(
      text,
      text,
      uuid,
      uuid,
      text,
      text,
      text,
      timestamptz,
      timestamptz,
      text
    )'::regprocedure;

  select pg_get_functiondef(v_function)
  into v_definition;

  if position(
    'coalesce(p_owner_id, auth.uid())'
    in v_definition
  ) > 0 then
    raise exception
      'create_publishing_item still forces the creator as owner';
  end if;

  if position(
    E'\n    p_owner_id,\n'
    in v_definition
  ) = 0 then
    raise exception
      'create_publishing_item does not persist p_owner_id directly';
  end if;

  select column_info.is_nullable
  into v_owner_nullable
  from information_schema.columns column_info
  where column_info.table_schema = 'editorial'
    and column_info.table_name = 'publishing_items'
    and column_info.column_name = 'owner_id';

  if v_owner_nullable is distinct from 'YES' then
    raise exception
      'editorial.publishing_items.owner_id must remain nullable';
  end if;

  if has_function_privilege(
    'anon',
    v_function,
    'EXECUTE'
  ) then
    raise exception
      'Anonymous users can execute create_publishing_item';
  end if;

  if not has_function_privilege(
    'authenticated',
    v_function,
    'EXECUTE'
  ) then
    raise exception
      'Authenticated users cannot execute create_publishing_item';
  end if;

  raise notice
    'PASS: Publishing create owner semantics are correct.';
end;
$verify$;
