-- Permanent read-only verifier for Phase 7B V4B public adaptive Video playback.

begin;
set local transaction read only;

do $phase_7b_v4b_verify$
declare
  v_reader text;
begin
  if to_regprocedure(
       'public.get_public_video_publication(text,text)'
     ) is null
  then
    raise exception
      'PHASE_7B_V4B_FAIL: public Video reader is missing';
  end if;

  v_reader := pg_get_functiondef(
    'public.get_public_video_publication(text,text)'::regprocedure
  );

  if position('''delivery'', v_delivery' in v_reader) = 0
     or position('video_transcode' in v_reader) = 0
     or position('''adaptive_delivery'', v_adaptive_delivery' in v_reader) = 0
     or position('media.variant_selections' in v_reader) = 0
     or position('video_hls_master' in v_reader) = 0
     or position('video_hls_360p_playlist' in v_reader) = 0
     or position('video_hls_360p_media' in v_reader) = 0
     or position('video_hls_720p_playlist' in v_reader) = 0
     or position('video_hls_720p_media' in v_reader) = 0
     or position('phase7b-v4a-v1' in v_reader) = 0
     or position('video-adaptive-v1' in v_reader) = 0
     or position('source_revision.original_file_object_id' in v_reader) = 0
  then
    raise exception
      'PHASE_7B_V4B_FAIL: public adaptive Video read contract drifted';
  end if;

  if position(
       'if v_delivery is null then'
       in v_reader
     ) = 0
  then
    raise exception
      'PHASE_7B_V4B_FAIL: MP4 fallback is no longer mandatory';
  end if;

  if has_function_privilege(
       'public',
       'public.get_public_video_publication(text,text)',
       'EXECUTE'
     )
  then
    raise exception
      'PHASE_7B_V4B_FAIL: PUBLIC gained direct execute on public Video reader';
  end if;

  if not has_function_privilege(
       'anon',
       'public.get_public_video_publication(text,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.get_public_video_publication(text,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.get_public_video_publication(text,text)',
       'EXECUTE'
     )
  then
    raise exception
      'PHASE_7B_V4B_FAIL: accepted public Video reader grants drifted';
  end if;
end;
$phase_7b_v4b_verify$;

select
  'PASS: Phase 7B V4B public adaptive Video read authority is intact.'
    as verification_result;

rollback;
