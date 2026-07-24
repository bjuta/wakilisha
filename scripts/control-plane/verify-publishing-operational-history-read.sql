do $verify$
declare
  v_function regprocedure;
  v_definition text;
  v_result text;
  v_security_definer boolean;
  v_volatility "char";
  v_index_definition text;
begin
  v_function := to_regprocedure(
    'public.list_publishing_item_events(uuid,timestamptz,uuid,integer)'
  );

  if v_function is null then
    raise exception
      'list_publishing_item_events is missing';
  end if;

  select
    pg_get_functiondef(v_function),
    pg_get_function_result(v_function),
    procedure.prosecdef,
    procedure.provolatile
  into
    v_definition,
    v_result,
    v_security_definer,
    v_volatility
  from pg_proc procedure
  where procedure.oid = v_function;

  if not v_security_definer then
    raise exception
      'Publishing history function is not SECURITY DEFINER';
  end if;

  if v_volatility <> 's' then
    raise exception
      'Publishing history function is not STABLE';
  end if;

  if v_definition !~
     'current_user_can_view_publishing_item'
  then
    raise exception
      'Publishing history does not preserve item read authority';
  end if;

  if v_definition !~
     'Publishing event cursor requires both created_at and event_id'
  then
    raise exception
      'Publishing history does not validate the paired cursor';
  end if;

  if v_definition !~
     'history\.created_at,[[:space:]]+history\.id'
  then
    raise exception
      'Publishing history does not use the stable composite cursor';
  end if;

  if v_definition !~
     'least\([[:space:]]+greatest\('
  then
    raise exception
      'Publishing history does not enforce a bounded page size';
  end if;

  if v_definition !~
     'history\.prior_values[[:space:]]+->[[:space:]]+''productionStage'''
  then
    raise exception
      'Publishing history does not derive production-stage transitions';
  end if;

  if v_definition !~
     'history\.prior_values[[:space:]]+->[[:space:]]+''planningState'''
  then
    raise exception
      'Publishing history does not derive planning-state transitions';
  end if;

  if v_definition !~
     'previousPrimaryChannelKey'
  then
    raise exception
      'Publishing history does not resolve primary-channel transitions';
  end if;

  if v_definition !~
     'assignmentRole'
  then
    raise exception
      'Publishing history does not resolve assignment roles';
  end if;

  if v_result !~ 'actor_label text' then
    raise exception
      'Publishing history does not return actor labels';
  end if;

  if v_result !~ 'subject_user_label text' then
    raise exception
      'Publishing history does not return assignment-subject labels';
  end if;

  if v_result !~ 'channel_label text' then
    raise exception
      'Publishing history does not return channel labels';
  end if;

  if v_result !~ 'changed_fields text\[\]' then
    raise exception
      'Publishing history does not return changed-field names';
  end if;

  if v_result ~
     '(prior_values|resulting_values|metadata)'
  then
    raise exception
      'Publishing history exposes raw snapshots or metadata';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.list_publishing_item_events(uuid,timestamptz,uuid,integer)',
    'execute'
  ) then
    raise exception
      'Authenticated users cannot execute Publishing history';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.list_publishing_item_events(uuid,timestamptz,uuid,integer)',
    'execute'
  ) then
    raise exception
      'Service role cannot execute Publishing history';
  end if;

  if has_function_privilege(
    'anon',
    'public.list_publishing_item_events(uuid,timestamptz,uuid,integer)',
    'execute'
  ) then
    raise exception
      'Anonymous users can execute Publishing history';
  end if;

  select pg_get_indexdef(
    to_regclass(
      'editorial.publishing_item_events_cursor_idx'
    )
  )
  into v_index_definition;

  if v_index_definition is null then
    raise exception
      'Publishing history cursor index is missing';
  end if;

  if v_index_definition !~
     'item_id, created_at DESC, id DESC'
  then
    raise exception
      'Publishing history cursor index does not match the cursor order';
  end if;
end;
$verify$;
