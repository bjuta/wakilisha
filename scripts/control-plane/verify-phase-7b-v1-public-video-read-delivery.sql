-- Permanent read-only verifier for Phase 7B V1 public Video reads and caption delivery.

begin;
set local transaction read only;
set local statement_timeout = '120s';
set local lock_timeout = '5s';

do $verify_phase_7b_v1_public_video$
declare
  v_public_def text;
  v_delivery_def text;
  v_index_def text;
  v_caption_def text;
begin
  v_public_def := pg_get_functiondef(
    'public.get_public_video_publication(text,text)'::regprocedure
  );
  v_delivery_def := pg_get_functiondef(
    'platform_private.get_public_video_publication_phase_7b(text,text)'::regprocedure
  );
  v_index_def := pg_get_functiondef(
    'public.get_public_video_index(integer)'::regprocedure
  );
  v_caption_def := pg_get_functiondef(
    'public.get_public_video_caption_delivery_target(uuid,integer)'::regprocedure
  );

  if not has_function_privilege(
    'anon',
    'public.get_public_video_publication(text,text)'::regprocedure,
    'EXECUTE'
  ) then
    raise exception 'PHASE_7B_V1_FAIL: anon cannot execute public Video publication read';
  end if;

  if not has_function_privilege(
    'anon',
    'public.get_public_video_index(integer)'::regprocedure,
    'EXECUTE'
  ) then
    raise exception 'PHASE_7B_V1_FAIL: anon cannot execute public Video index read';
  end if;

  if has_function_privilege(
    'anon',
    'public.get_public_video_caption_delivery_target(uuid,integer)'::regprocedure,
    'EXECUTE'
  )
  or has_function_privilege(
    'authenticated',
    'public.get_public_video_caption_delivery_target(uuid,integer)'::regprocedure,
    'EXECUTE'
  ) then
    raise exception 'PHASE_7B_V1_FAIL: caption delivery target leaked to browser roles';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.get_public_video_caption_delivery_target(uuid,integer)'::regprocedure,
    'EXECUTE'
  ) then
    raise exception 'PHASE_7B_V1_FAIL: service role lacks caption delivery target';
  end if;

  if position(
       'platform_private.get_public_video_publication_phase_7b'
       in v_public_def
     ) = 0
     or position('''/shows/''' in v_public_def) = 0
     or position('publication_kind' in v_public_def) = 0
  then
    raise exception 'PHASE_7B_V1_FAIL: public Video identity projection is not Show-scoped';
  end if;

  if position('current_published_version_id' in v_delivery_def) = 0
     or position('video.assert_publishable_publication_version' in v_delivery_def) = 0
     or position('variant_role = ''video_transcode''' in v_delivery_def) = 0
     or position('https://media.wakilisha.africa/derivatives/' in v_delivery_def) = 0
  then
    raise exception 'PHASE_7B_V1_FAIL: internal Video delivery reader lacks immutable/public derivative guards';
  end if;

  if position('/video/captions/' in v_delivery_def) = 0
     or position('private-files/captions/' in v_delivery_def) = 0
  then
    raise exception 'PHASE_7B_V1_FAIL: internal Video delivery reader lacks governed caption relationship';
  end if;

  if position('storage_path' in v_delivery_def) > 0
     and position('''storage_path''' in v_delivery_def) > 0
  then
    raise exception 'PHASE_7B_V1_FAIL: public Video payload exposes protected caption storage path';
  end if;

  if position('public.get_public_video_publication' in v_index_def) = 0
     or position('resolved.payload is not null' in v_index_def) = 0
  then
    raise exception 'PHASE_7B_V1_FAIL: Video index bypasses canonical public publication reader';
  end if;

  if position('current_published_version_id = version_row.id' in v_caption_def) = 0
     or position('video.assert_publishable_publication_version' in v_caption_def) = 0
     or position('usage_role = ''video_caption''' in v_caption_def) = 0
     or position('resolution_mode = ''exact_revision''' in v_caption_def) = 0
     or position('private-files/captions/' in v_caption_def) = 0
  then
    raise exception 'PHASE_7B_V1_FAIL: caption target lacks published exact-revision authority';
  end if;

  raise notice 'PHASE_7B_V1_PUBLIC_VIDEO_READ_DELIVERY_PASS';
end;
$verify_phase_7b_v1_public_video$;

rollback;
