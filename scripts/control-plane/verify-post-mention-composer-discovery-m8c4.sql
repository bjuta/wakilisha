\set ON_ERROR_STOP on

-- Permanent read-only verifier for M8C.4-M2 Mention composer discovery.

do $verify$
declare
  v_oid regprocedure;
  v_definition text;
begin
  v_oid:=to_regprocedure(
    'public.community_search_mention_suggestions(text,integer)'
  );

  if v_oid is null then
    raise exception 'FAIL: Mention composer discovery RPC is missing';
  end if;

  select pg_get_functiondef(v_oid::oid)
  into v_definition;

  if not exists (
    select 1
    from pg_proc function_record
    where function_record.oid=v_oid::oid
      and function_record.prosecdef
      and function_record.provolatile='s'
  ) then
    raise exception 'FAIL: Mention discovery must remain stable and security definer';
  end if;

  if has_function_privilege(
    'anon',
    'public.community_search_mention_suggestions(text,integer)',
    'EXECUTE'
  ) then
    raise exception 'FAIL: anonymous callers can execute Mention discovery';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.community_search_mention_suggestions(text,integer)',
    'EXECUTE'
  ) then
    raise exception 'FAIL: authenticated callers cannot execute Mention discovery';
  end if;

  if position('profile.status=''active''' in replace(v_definition,' ',''))=0
     or position('profile.is_public' in v_definition)=0
     or position('resolve_person_follow_target' in v_definition)=0
     or position('resolved.followable' in v_definition)=0 then
    raise exception 'FAIL: Mention discovery moved away from accepted public Person authority';
  end if;

  if exists (
    select 1
    from public.community_search_mention_suggestions('',8)
  ) then
    raise exception 'FAIL: empty Mention discovery query returned rows';
  end if;

  if exists (
    select 1
    from public.community_search_mention_suggestions('%',8)
  ) then
    raise exception 'FAIL: invalid Mention discovery query returned rows';
  end if;
end;
$verify$;

select 'PASS: M8C.4-M2 Mention composer discovery authority is exact.' as result;
