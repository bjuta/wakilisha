do $verify$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    to_regprocedure(
      'public.remove_publishing_item_assignee(uuid,bigint,uuid,text,text)'
    )
  )
  into v_definition;

  if v_definition is null then
    raise exception
      'remove_publishing_item_assignee is missing';
  end if;

  if v_definition !~
     'delete from editorial\.publishing_item_assignees[[:space:]]+as assignee'
  then
    raise exception
      'Remove-assignee function does not alias its delete target';
  end if;

  if v_definition ~
     '(where|and)[[:space:]]+(item_id|user_id|assignment_role)[[:space:]]*='
  then
    raise exception
      'Remove-assignee function still contains an unqualified predicate';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.remove_publishing_item_assignee(uuid,bigint,uuid,text,text)',
    'execute'
  ) then
    raise exception
      'Authenticated users cannot execute remove_publishing_item_assignee';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.remove_publishing_item_assignee(uuid,bigint,uuid,text,text)',
    'execute'
  ) then
    raise exception
      'Service role cannot execute remove_publishing_item_assignee';
  end if;

  if has_function_privilege(
    'anon',
    'public.remove_publishing_item_assignee(uuid,bigint,uuid,text,text)',
    'execute'
  ) then
    raise exception
      'Anonymous users can execute remove_publishing_item_assignee';
  end if;
end;
$verify$;
