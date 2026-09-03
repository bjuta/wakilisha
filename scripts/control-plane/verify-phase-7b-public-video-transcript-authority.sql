-- Permanent read-only verifier for governed public Video transcript authority.

begin;
set local transaction read only;
set local statement_timeout = '120s';
set local lock_timeout = '5s';

do $verify_phase_7b_public_video_transcript$
declare
  v_reader text;
  v_target text;
begin
  if to_regprocedure(
       'public.get_public_video_transcript_delivery_target(uuid)'
     ) is null
  then
    raise exception
      'PHASE_7B_VIDEO_TRANSCRIPT_FAIL: transcript delivery target is missing';
  end if;

  if to_regprocedure(
       'platform_private.get_public_video_publication_phase_7b(text,text)'
     ) is null
  then
    raise exception
      'PHASE_7B_VIDEO_TRANSCRIPT_FAIL: preserved internal Video delivery reader is missing';
  end if;

  v_reader := pg_get_functiondef(
    'platform_private.get_public_video_publication_phase_7b(text,text)'::regprocedure
  );

  v_target := pg_get_functiondef(
    'public.get_public_video_transcript_delivery_target(uuid)'::regprocedure
  );

  if position('''transcript''' in v_reader) = 0
     or position('usage_role = ''video_transcript''' in v_reader) = 0
     or position('resolution_mode = ''exact_revision''' in v_reader) = 0
     or position('asset_row.asset_kind = ''transcript''' in v_reader) = 0
     or position('^private-files/transcripts/' in v_reader) = 0
     or position('/video/transcripts/' in v_reader) = 0
  then
    raise exception
      'PHASE_7B_VIDEO_TRANSCRIPT_FAIL: reader lacks governed transcript authority';
  end if;

  if has_function_privilege(
       'anon',
       'public.get_public_video_transcript_delivery_target(uuid)'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.get_public_video_transcript_delivery_target(uuid)'::regprocedure,
       'EXECUTE'
     )
  then
    raise exception
      'PHASE_7B_VIDEO_TRANSCRIPT_FAIL: transcript target leaked to browser roles';
  end if;

  if not has_function_privilege(
       'service_role',
       'public.get_public_video_transcript_delivery_target(uuid)'::regprocedure,
       'EXECUTE'
     )
  then
    raise exception
      'PHASE_7B_VIDEO_TRANSCRIPT_FAIL: service role lacks transcript target';
  end if;

  if position(
       'resource_row.current_published_version_id = version_row.id'
       in v_target
     ) = 0
     or position(
       'video.assert_publishable_publication_version'
       in v_target
     ) = 0
     or position(
       'usage_row.usage_role = ''video_transcript'''
       in v_target
     ) = 0
     or position(
       'usage_row.resolution_mode = ''exact_revision'''
       in v_target
     ) = 0
     or position(
       'asset_row.asset_kind = ''transcript'''
       in v_target
     ) = 0
     or position(
       '^private-files/transcripts/'
       in v_target
     ) = 0
     or position(
       'file_row.mime_type = ''text/plain'''
       in v_target
     ) = 0
  then
    raise exception
      'PHASE_7B_VIDEO_TRANSCRIPT_FAIL: transcript target lacks exact published authority';
  end if;

  raise notice 'PHASE_7B_PUBLIC_VIDEO_TRANSCRIPT_AUTHORITY_PASS';
end;
$verify_phase_7b_public_video_transcript$;

rollback;
