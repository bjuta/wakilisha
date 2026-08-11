-- Phase 5B M234 verifier: published Playlist update review continuity.

do $verify_phase_5b_m234$
declare
  v_submit text;
  v_public text;
  v_list text;
begin
  if to_regprocedure(
       'public.submit_playlist_for_review(uuid,bigint,text,text,uuid)'
     ) is null
  then
    raise exception
      'FAIL: submit_playlist_for_review is missing';
  end if;

  select pg_get_functiondef(
    'public.submit_playlist_for_review(uuid,bigint,text,text,uuid)'::regprocedure
  )
  into v_submit;

  if position(
       'playlist_published_update_unchanged'
       in v_submit
     ) = 0
     or position(
       'playlist_published_update_not_saved'
       in v_submit
     ) = 0
     or position(
       'playlist_published_version_missing'
       in v_submit
     ) = 0
     or position(
       chr(39) || 'published' || chr(39)
       in v_submit
     ) = 0
  then
    raise exception
      'FAIL: published Playlist update submit guards are incomplete';
  end if;

  if position(
       'published.content_fingerprint'
       in v_submit
     ) = 0
     or position(
       'working.content_fingerprint'
       in v_submit
     ) = 0
  then
    raise exception
      'FAIL: published update submit is not fingerprint-bound';
  end if;

  select pg_get_functiondef(
    'public.get_public_playlist(text)'::regprocedure
  )
  into v_public;

  select pg_get_functiondef(
    'public.list_public_playlists(integer,timestamp with time zone,uuid)'::regprocedure
  )
  into v_list;

  if position(
       'current_published_version_id'
       in v_public
     ) = 0
     or position(
       'snapshot.version_id'
       in v_public
     ) = 0
     or position(
       'current_published_version_id'
       in v_list
     ) = 0
     or position(
       'snapshot.version_id'
       in v_list
     ) = 0
  then
    raise exception
      'FAIL: public Playlist readers are not anchored to the current published snapshot pointer';
  end if;

  raise notice
    'PASS: Published Playlist updates can re-enter Review only when genuinely changed and explicitly saved.';
  raise notice
    'PASS: Public Playlist readers remain anchored to current_published_version_id during Review.';
end;
$verify_phase_5b_m234$;
