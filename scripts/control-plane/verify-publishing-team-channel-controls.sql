do $verify$
declare
  v_assignable_definition text;
  v_primary_definition text;
  v_event_constraint text;
begin
  if to_regprocedure(
    'public.list_publishing_assignable_users()'
  ) is null then
    raise exception
      'Missing list_publishing_assignable_users()';
  end if;

  if to_regprocedure(
    'public.set_publishing_item_primary_channel(uuid,bigint,text,text)'
  ) is null then
    raise exception
      'Missing set_publishing_item_primary_channel(uuid,bigint,text,text)';
  end if;

  select pg_get_functiondef(
    to_regprocedure(
      'public.list_publishing_assignable_users()'
    )
  )
  into v_assignable_definition;

  if position(
    'current_user_can_manage_publishing'
    in v_assignable_definition
  ) = 0 then
    raise exception
      'Assignable-user function is not guarded by manage_publishing';
  end if;

  if position(
    'profile.status = ''active'''
    in v_assignable_definition
  ) = 0 then
    raise exception
      'Assignable-user function does not require active profiles';
  end if;

  if position(
    'assignment.status = ''active'''
    in v_assignable_definition
  ) = 0 then
    raise exception
      'Assignable-user function does not require active role assignments';
  end if;

  if position(
    '''edit_own_articles'''
    in v_assignable_definition
  ) = 0 then
    raise exception
      'Assignable-user function does not include operational writers';
  end if;

  if has_function_privilege(
    'anon',
    'public.list_publishing_assignable_users()',
    'execute'
  ) then
    raise exception
      'Anonymous users can execute the assignable-user function';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.list_publishing_assignable_users()',
    'execute'
  ) then
    raise exception
      'Authenticated users cannot execute the assignable-user function';
  end if;

  select pg_get_functiondef(
    to_regprocedure(
      'public.set_publishing_item_primary_channel(uuid,bigint,text,text)'
    )
  )
  into v_primary_definition;

  if position(
    'current_user_can_manage_publishing'
    in v_primary_definition
  ) = 0 then
    raise exception
      'Primary-channel function is not guarded by manage_publishing';
  end if;

  if position(
    'STALE_PUBLISHING_ITEM_VERSION'
    in v_primary_definition
  ) = 0 then
    raise exception
      'Primary-channel function does not enforce optimistic concurrency';
  end if;

  if position(
    'Publishing channel attachment not found'
    in v_primary_definition
  ) = 0 then
    raise exception
      'Primary-channel function does not require an attached channel';
  end if;

  if position(
    'channel_primary_changed'
    in v_primary_definition
  ) = 0 then
    raise exception
      'Primary-channel function does not write the required event';
  end if;

  if has_function_privilege(
    'anon',
    'public.set_publishing_item_primary_channel(uuid,bigint,text,text)',
    'execute'
  ) then
    raise exception
      'Anonymous users can execute the primary-channel function';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.set_publishing_item_primary_channel(uuid,bigint,text,text)',
    'execute'
  ) then
    raise exception
      'Authenticated users cannot execute the primary-channel function';
  end if;

  select pg_get_constraintdef(
    constraint_record.oid
  )
  into v_event_constraint
  from pg_constraint constraint_record
  where constraint_record.conrelid =
      'editorial.publishing_item_events'::regclass
    and constraint_record.conname =
      'publishing_item_events_action_check';

  if v_event_constraint is null then
    raise exception
      'Publishing event action constraint is missing';
  end if;

  if position(
    'channel_primary_changed'
    in v_event_constraint
  ) = 0 then
    raise exception
      'Publishing event action constraint does not allow channel_primary_changed';
  end if;
end;
$verify$;
