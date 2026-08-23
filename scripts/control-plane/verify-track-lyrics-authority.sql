do $verify$
begin
  if to_regclass('editorial.track_lyrics_versions') is null then raise exception 'missing track_lyrics_versions'; end if;
  if to_regclass('editorial.track_lyrics_documents') is null then raise exception 'missing track_lyrics_documents'; end if;
  if to_regprocedure('public.get_admin_track_lyrics_workspace(uuid)') is null then raise exception 'missing admin lyrics read'; end if;
  if to_regprocedure('public.save_track_lyrics_draft(uuid,bigint,text,text,jsonb,text,text)') is null then raise exception 'missing lyrics save'; end if;
  if to_regprocedure('public.publish_track_lyrics_version(uuid,uuid,bigint)') is null then raise exception 'missing lyrics publish'; end if;
  if to_regprocedure('public.get_public_track_lyrics(uuid)') is null then raise exception 'missing public lyrics read'; end if;
  if has_table_privilege('anon', 'editorial.track_lyrics_versions', 'select') then raise exception 'anon may select lyrics versions directly'; end if;
  if has_table_privilege('authenticated', 'editorial.track_lyrics_versions', 'select') then raise exception 'authenticated may select lyrics versions directly'; end if;
  if not has_function_privilege('anon', 'public.get_public_track_lyrics(uuid)', 'execute') then raise exception 'anon cannot execute public lyrics read'; end if;
  if has_function_privilege('anon', 'public.get_admin_track_lyrics_workspace(uuid)', 'execute') then raise exception 'anon can execute admin lyrics read'; end if;
  if has_function_privilege('anon', 'public.save_track_lyrics_draft(uuid,bigint,text,text,jsonb,text,text)', 'execute') then raise exception 'anon can save lyrics'; end if;
  if has_function_privilege('anon', 'public.publish_track_lyrics_version(uuid,uuid,bigint)', 'execute') then raise exception 'anon can publish lyrics'; end if;
  if not exists (select 1 from pg_trigger where tgrelid='editorial.track_lyrics_versions'::regclass and tgname='track_lyrics_versions_immutable' and not tgisinternal) then raise exception 'lyrics immutability trigger missing'; end if;
end;
$verify$;

select 'TRACK_LYRICS_AUTHORITY_PASS' as verifier;
