-- MIZIZI Slice 3 D1 repair: Top Songs service-role boundary V1
--
-- D1 public gateways require service-role EXECUTE on the read RPC only.
-- They do not require direct table authority. Keep presentation mutation
-- caller-bound to the authenticated manage_registry writer.

begin;
set local statement_timeout = '60s';
set local lock_timeout = '5s';

do $preflight$
begin
  if to_regclass('public.artist_top_song_curations') is null
     or to_regclass('public.artist_top_song_curation_migration_map') is null
     or to_regclass('public.artist_top_song_curation_events') is null
     or to_regprocedure('public.get_artist_top_songs_v1(uuid,text)') is null
     or to_regprocedure('public.admin_replace_artist_top_songs_v1(uuid,uuid[],text)') is null
  then
    raise exception 'STOP: D1 Top Songs presentation authority is incomplete';
  end if;
end
$preflight$;

revoke all on table public.artist_top_song_curations
  from service_role;
revoke all on table public.artist_top_song_curation_migration_map
  from service_role;
revoke all on table public.artist_top_song_curation_events
  from service_role;

revoke all on function public.get_artist_top_songs_v1(uuid,text)
  from service_role;
grant execute on function public.get_artist_top_songs_v1(uuid,text)
  to service_role;

revoke all on function public.admin_replace_artist_top_songs_v1(uuid,uuid[],text)
  from service_role;

revoke all on function platform_private.artist_top_song_fingerprint_v1(uuid)
  from service_role;

commit;
