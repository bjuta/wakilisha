begin;
set local transaction read only;

do $verify$
declare
  v_legacy bigint;
  v_mapped bigint;
begin
  if to_regclass('public.artist_top_song_curations') is null
     or to_regclass('public.artist_top_song_curation_migration_map') is null
     or to_regclass('public.artist_top_song_curation_events') is null
     or to_regprocedure('public.get_artist_top_songs_v1(uuid,text)') is null
     or to_regprocedure('public.admin_replace_artist_top_songs_v1(uuid,uuid[],text)') is null
     or to_regprocedure('platform_private.artist_top_song_fingerprint_v1(uuid)') is null
  then
    raise exception 'Artist Top Songs presentation authority is incomplete';
  end if;

  if has_table_privilege('anon', 'public.artist_top_song_curations', 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated', 'public.artist_top_song_curations', 'INSERT,UPDATE,DELETE')
     or has_table_privilege('anon', 'public.artist_top_song_curation_migration_map', 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated', 'public.artist_top_song_curation_migration_map', 'INSERT,UPDATE,DELETE')
     or has_table_privilege('anon', 'public.artist_top_song_curation_events', 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated', 'public.artist_top_song_curation_events', 'INSERT,UPDATE,DELETE')
  then
    raise exception 'Browser direct Top Songs presentation DML grant detected';
  end if;

  if has_function_privilege('anon', 'public.get_artist_top_songs_v1(uuid,text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.admin_replace_artist_top_songs_v1(uuid,uuid[],text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_artist_top_songs_v1(uuid,text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.admin_replace_artist_top_songs_v1(uuid,uuid[],text)', 'EXECUTE')
  then
    raise exception 'Top Songs RPC execution grants drifted';
  end if;

  select count(*)
  into v_legacy
  from public.registry_entity_relationships relationship
  where relationship.source_entity_type = 'artist'
    and relationship.target_entity_type = 'track'
    and relationship.relationship_type = 'popular_track'
    and relationship.relationship_role = 'top_song'
    and relationship.relationship_status = 'active';

  select count(*)
  into v_mapped
  from public.artist_top_song_curation_migration_map;

  if v_legacy <> v_mapped then
    raise exception 'Legacy Top Songs lineage map does not cover the exact active relationship set: legacy %, mapped %', v_legacy, v_mapped;
  end if;

  if exists (
    select 1
    from public.artist_top_song_curation_migration_map map
    where map.resolution_status = 'resolved'
      and map.resolved_track_id is null
  ) or exists (
    select 1
    from public.artist_top_song_curation_migration_map map
    where map.resolution_status = 'needs_review'
      and map.resolved_track_id is not null
  ) then
    raise exception 'Top Songs lineage resolution status is inconsistent';
  end if;

  if exists (
    select 1
    from public.artist_top_song_curations c
    join public.registry_tracks track on track.id = c.track_id
    join public.registry_artists artist on artist.id = c.artist_id
    where track.status <> 'active'
       or artist.status <> 'active'
  ) then
    raise exception 'Top Songs presentation points at inactive canonical identity';
  end if;

  if exists (
    select 1
    from public.artist_top_song_curations
    group by artist_id, sort_order
    having count(*) > 1
  ) or exists (
    select 1
    from public.artist_top_song_curations
    group by artist_id, track_id
    having count(*) > 1
  ) then
    raise exception 'Top Songs presentation contains duplicate order or Track identity';
  end if;

  if exists (
    select 1
    from public.artist_top_song_curation_migration_map map
    where map.resolution_status = 'needs_review'
      and cardinality(map.candidate_track_ids) = 1
  ) then
    raise exception 'A Top Songs migration exception is safely resolvable and should not remain quarantined';
  end if;

  raise notice 'MIZIZI_TOP_SONG_PRESENTATION_AUTHORITY_PASS';
end
$verify$;

rollback;
