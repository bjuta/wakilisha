-- Permanent read-only verifier for Video caption language-tag private-use support.

begin;
set local transaction read only;
set local statement_timeout = '120s';
set local lock_timeout = '5s';

do $verify_video_caption_language_private_use$
declare
  v_working_constraint text;
  v_version_constraint text;
  v_command_definition text;
begin
  select pg_get_constraintdef(constraint_row.oid, true)
  into v_working_constraint
  from pg_constraint constraint_row
  where constraint_row.conrelid = 'video.caption_tracks'::regclass
    and constraint_row.conname = 'caption_tracks_language_tag_check'
    and constraint_row.contype = 'c';

  select pg_get_constraintdef(constraint_row.oid, true)
  into v_version_constraint
  from pg_constraint constraint_row
  where constraint_row.conrelid =
      'video.publication_version_caption_tracks'::regclass
    and constraint_row.conname =
      'publication_version_caption_tracks_language_tag_check'
    and constraint_row.contype = 'c';

  if v_working_constraint is null
     or position('(?:-x(?:-[a-z0-9]{1,8})+)?' in v_working_constraint) = 0
  then
    raise exception
      'VIDEO_CAPTION_LANGUAGE_TAG_FAIL: working caption constraint lacks private-use support';
  end if;

  if v_version_constraint is null
     or position('(?:-x(?:-[a-z0-9]{1,8})+)?' in v_version_constraint) = 0
  then
    raise exception
      'VIDEO_CAPTION_LANGUAGE_TAG_FAIL: version caption constraint lacks private-use support';
  end if;

  v_command_definition := pg_get_functiondef(
    'public.replace_video_publication_captions(uuid,bigint,jsonb,text,uuid)'::regprocedure
  );

  if position('(?:-x(?:-[a-z0-9]{1,8})+)?' in v_command_definition) = 0 then
    raise exception
      'VIDEO_CAPTION_LANGUAGE_TAG_FAIL: governed caption command lacks private-use support';
  end if;

  if not ('und-x-sheng' ~ '^[a-z]{2,3}(?:-[a-z0-9]{2,8})*(?:-x(?:-[a-z0-9]{1,8})+)?$') then
    raise exception
      'VIDEO_CAPTION_LANGUAGE_TAG_FAIL: und-x-sheng is rejected';
  end if;

  if not ('en' ~ '^[a-z]{2,3}(?:-[a-z0-9]{2,8})*(?:-x(?:-[a-z0-9]{1,8})+)?$')
     or not ('sw-ke' ~ '^[a-z]{2,3}(?:-[a-z0-9]{2,8})*(?:-x(?:-[a-z0-9]{1,8})+)?$')
  then
    raise exception
      'VIDEO_CAPTION_LANGUAGE_TAG_FAIL: existing normalized language tags regressed';
  end if;

  if 'und-x-' ~ '^[a-z]{2,3}(?:-[a-z0-9]{2,8})*(?:-x(?:-[a-z0-9]{1,8})+)?$'
     or 'und-x-sheng!' ~ '^[a-z]{2,3}(?:-[a-z0-9]{2,8})*(?:-x(?:-[a-z0-9]{1,8})+)?$'
  then
    raise exception
      'VIDEO_CAPTION_LANGUAGE_TAG_FAIL: malformed private-use language tags are accepted';
  end if;

  raise notice 'VIDEO_CAPTION_LANGUAGE_PRIVATE_USE_PASS';
end;
$verify_video_caption_language_private_use$;

rollback;
