begin;

do $wk_registry_artist_hard_delete_retirement$
begin
  if to_regprocedure(
    'public.admin_delete_registry_draft_artist_v1(uuid,timestamp with time zone)'
  ) is null then
    raise exception
      'STOP: expected draft Artist hard-delete authority is missing before retirement';
  end if;

  if to_regclass('editorial.registry_artist_resources') is null
     or to_regclass('editorial.resources') is null
  then
    raise exception
      'STOP: Resource identity authority is missing before Artist hard-delete retirement';
  end if;
end
$wk_registry_artist_hard_delete_retirement$;

revoke all
  on function public.admin_delete_registry_draft_artist_v1(uuid,timestamptz)
  from public, anon, authenticated, service_role;

drop function public.admin_delete_registry_draft_artist_v1(uuid,timestamptz);

commit;
