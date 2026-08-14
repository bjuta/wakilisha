-- Phase 5B: Playlist publication must not write Playlist version UUIDs
-- into editorial.resources Article-only version foreign keys.
-- Production-applied migration version: 20260810001635.

do $repair$
declare
  v_definition text;
  v_old text := E'      update editorial.resources resource\n      set\n        current_published_version_id =\n          v_published.version_id,\n        lifecycle_state = \'published\',';
  v_new text := E'      update editorial.resources resource\n      set\n        lifecycle_state = \'published\',';
begin
  select pg_get_functiondef(
    'public.publish_playlist_version(uuid,bigint,uuid,text,text,uuid)'::regprocedure
  )
  into v_definition;

  if position(v_old in v_definition) = 0 then
    raise exception
      'STOP: Expected Playlist publication Resource-pointer block was not found exactly.';
  end if;

  v_definition := replace(v_definition,v_old,v_new);
  execute v_definition;

  select pg_get_functiondef(
    'public.publish_playlist_version(uuid,bigint,uuid,text,text,uuid)'::regprocedure
  )
  into v_definition;

  if position(v_old in v_definition) > 0 then
    raise exception
      'STOP: Generic Resource Playlist-version pointer write still exists.';
  end if;

  if position(
    E'update editorial.playlist_resources binding_update\n      set current_published_version_id ='
    in v_definition
  ) = 0 then
    raise exception
      'STOP: Playlist-specific published-version pointer was lost.';
  end if;
end;
$repair$;
