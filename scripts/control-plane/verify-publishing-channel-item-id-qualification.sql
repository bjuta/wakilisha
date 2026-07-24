do $verify$
declare
  v_add_definition text;
  v_remove_definition text;
  v_primary_definition text;
begin
  select pg_get_functiondef(
    to_regprocedure(
      'public.add_publishing_item_channel(uuid,bigint,text,boolean,text)'
    )
  )
  into v_add_definition;

  select pg_get_functiondef(
    to_regprocedure(
      'public.remove_publishing_item_channel(uuid,bigint,text,text)'
    )
  )
  into v_remove_definition;

  select pg_get_functiondef(
    to_regprocedure(
      'public.set_publishing_item_primary_channel(uuid,bigint,text,text)'
    )
  )
  into v_primary_definition;

  if v_add_definition is null
     or v_remove_definition is null
     or v_primary_definition is null
  then
    raise exception
      'One or more Publishing channel functions are missing';
  end if;

  if v_add_definition !~
     'update editorial\.publishing_item_channels[[:space:]]+as item_channel'
  then
    raise exception
      'Add-channel function does not alias its update target';
  end if;

  if v_remove_definition !~
     'delete from editorial\.publishing_item_channels[[:space:]]+as item_channel'
  then
    raise exception
      'Remove-channel function does not alias its delete target';
  end if;

  if v_primary_definition !~
     'update editorial\.publishing_item_channels[[:space:]]+as item_channel'
  then
    raise exception
      'Primary-channel function does not alias its update target';
  end if;

  if v_add_definition ~
     '(where|and)[[:space:]]+item_id[[:space:]]*=[[:space:]]*p_item_id'
  then
    raise exception
      'Add-channel function still contains an unqualified item_id predicate';
  end if;

  if v_remove_definition ~
     '(where|and)[[:space:]]+item_id[[:space:]]*=[[:space:]]*p_item_id'
  then
    raise exception
      'Remove-channel function still contains an unqualified item_id predicate';
  end if;

  if v_primary_definition ~
     '(where|and)[[:space:]]+item_id[[:space:]]*=[[:space:]]*p_item_id'
  then
    raise exception
      'Primary-channel function still contains an unqualified item_id predicate';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.add_publishing_item_channel(uuid,bigint,text,boolean,text)',
    'execute'
  ) then
    raise exception
      'Authenticated users cannot execute add_publishing_item_channel';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.remove_publishing_item_channel(uuid,bigint,text,text)',
    'execute'
  ) then
    raise exception
      'Authenticated users cannot execute remove_publishing_item_channel';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.set_publishing_item_primary_channel(uuid,bigint,text,text)',
    'execute'
  ) then
    raise exception
      'Authenticated users cannot execute set_publishing_item_primary_channel';
  end if;

  if has_function_privilege(
    'anon',
    'public.add_publishing_item_channel(uuid,bigint,text,boolean,text)',
    'execute'
  ) then
    raise exception
      'Anonymous users can execute add_publishing_item_channel';
  end if;

  if has_function_privilege(
    'anon',
    'public.remove_publishing_item_channel(uuid,bigint,text,text)',
    'execute'
  ) then
    raise exception
      'Anonymous users can execute remove_publishing_item_channel';
  end if;

  if has_function_privilege(
    'anon',
    'public.set_publishing_item_primary_channel(uuid,bigint,text,text)',
    'execute'
  ) then
    raise exception
      'Anonymous users can execute set_publishing_item_primary_channel';
  end if;
end;
$verify$;
