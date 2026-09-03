-- Permanent read-only verifier for Phase 7B V4C governed Video quality selection.

begin;
set local transaction read only;

do $phase_7b_v4c_verify$
declare
  v_reader text;
begin
  if to_regprocedure(
       'public.get_public_video_publication(text,text)'
     ) is null
  then
    raise exception
      'PHASE_7B_V4C_FAIL: public Video reader is missing';
  end if;

  if to_regprocedure(
       'platform_private.get_public_video_publication_phase_7b(text,text)'
     ) is null
  then
    raise exception
      'PHASE_7B_VIDEO_DELIVERY_FAIL: preserved internal Video delivery reader is missing';
  end if;

  v_reader := pg_get_functiondef(
    'platform_private.get_public_video_publication_phase_7b(text,text)'::regprocedure
  );

  if position('''renditions'', jsonb_build_array' in v_reader) = 0
     or position('''height'', 360' in v_reader) = 0
     or position('''label'', ''360p''' in v_reader) = 0
     or position('''height'', 720' in v_reader) = 0
     or position('''label'', ''720p''' in v_reader) = 0
     or position('video_hls_360p_playlist' in v_reader) = 0
     or position('video_hls_720p_playlist' in v_reader) = 0
     or position('video-adaptive-v1' in v_reader) = 0
     or position('source_revision.original_file_object_id' in v_reader) = 0
  then
    raise exception
      'PHASE_7B_V4C_FAIL: governed rendition read contract drifted';
  end if;

  if position(
       'if v_delivery is null then'
       in v_reader
     ) = 0
  then
    raise exception
      'PHASE_7B_V4C_FAIL: MP4 fallback is no longer mandatory';
  end if;

  if has_function_privilege(
       'public',
       'public.get_public_video_publication(text,text)',
       'EXECUTE'
     )
  then
    raise exception
      'PHASE_7B_V4C_FAIL: PUBLIC gained direct execute on public Video reader';
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
      'PHASE_7B_V4C_FAIL: accepted public Video reader grants drifted';
  end if;
end;
$phase_7b_v4c_verify$;

select
  'PASS: Phase 7B V4C governed Video quality selection authority is intact.'
    as verification_result;

rollback;
