do $verify$
declare
  v_oid oid := to_regprocedure('public.get_public_audio_index(integer)');
  v_definition text;
  v_security_definer boolean;
begin
  if v_oid is null then
    raise exception 'get_public_audio_index(integer) is missing';
  end if;

  select pg_get_functiondef(v_oid), p.prosecdef
  into v_definition, v_security_definer
  from pg_proc p
  where p.oid = v_oid;

  if not v_security_definer then
    raise exception 'get_public_audio_index must remain SECURITY DEFINER';
  end if;

  if position('get_public_audio_publication' in v_definition) = 0
     or position('get_public_show' in v_definition) = 0 then
    raise exception 'public Audio index must resolve through governed public readers';
  end if;

  if not has_function_privilege('anon', v_oid, 'EXECUTE')
     or not has_function_privilege('authenticated', v_oid, 'EXECUTE') then
    raise exception 'public Audio index is not executable by public application roles';
  end if;

  if has_table_privilege('anon', 'audio.publications', 'SELECT')
     or has_table_privilege('authenticated', 'audio.publications', 'SELECT')
     or has_table_privilege('anon', 'audio.shows', 'SELECT')
     or has_table_privilege('authenticated', 'audio.shows', 'SELECT') then
    raise exception 'Audio index must not expose direct Audio table reads';
  end if;
end;
$verify$;

select 'PUBLIC_AUDIO_INDEX_AUTHORITY_PASS' as result;
