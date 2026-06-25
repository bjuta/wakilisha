do $wk$
declare
  v_sql text;
begin
  select pg_get_functiondef('public.admin_safe_merge_registry_artists(uuid,uuid,text,boolean,text)'::regprocedure)
  into v_sql;

  if v_sql is null then
    raise exception 'admin_safe_merge_registry_artists_not_found';
  end if;

  v_sql := replace(v_sql, '''manual_artist_merge''', '''similarity_match''');

  execute v_sql;
end
$wk$;

grant execute on function public.admin_safe_merge_registry_artists(uuid, uuid, text, boolean, text) to authenticated;
