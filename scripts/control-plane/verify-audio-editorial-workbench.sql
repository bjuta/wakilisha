do $verify$
declare
  v_threads_rls boolean;
  v_comments_rls boolean;
  v_integrity_definition text;
  v_workspace_definition text;
  v_media_definition text;
  v_create_definition text;
begin
  if to_regclass('audio.publication_review_threads') is null then
    raise exception 'audio.publication_review_threads is missing';
  end if;

  if to_regclass('audio.publication_review_comments') is null then
    raise exception 'audio.publication_review_comments is missing';
  end if;

  select relrowsecurity
  into v_threads_rls
  from pg_class
  where oid = 'audio.publication_review_threads'::regclass;

  select relrowsecurity
  into v_comments_rls
  from pg_class
  where oid = 'audio.publication_review_comments'::regclass;

  if not coalesce(v_threads_rls, false)
     or not coalesce(v_comments_rls, false)
  then
    raise exception 'Audio review tables must keep RLS enabled';
  end if;

  if has_table_privilege(
       'authenticated',
       'audio.publication_review_threads',
       'INSERT,UPDATE,DELETE'
     )
     or has_table_privilege(
       'authenticated',
       'audio.publication_review_comments',
       'INSERT,UPDATE,DELETE'
     )
  then
    raise exception
      'authenticated must not mutate Audio review tables directly';
  end if;

  if to_regprocedure(
       'public.get_audio_editorial_media_context(uuid)'
     ) is null
     or to_regprocedure(
       'public.get_audio_editorial_workbench(uuid)'
     ) is null
     or to_regprocedure(
       'public.create_audio_time_review_thread(uuid,uuid,text,numeric,numeric,text,text)'
     ) is null
     or to_regprocedure(
       'public.add_audio_review_comment(uuid,text,text)'
     ) is null
     or to_regprocedure(
       'public.set_audio_review_thread_status(uuid,text)'
     ) is null
  then
    raise exception 'Audio Editorial Workbench RPCs are incomplete';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.get_audio_editorial_media_context(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.get_audio_editorial_workbench(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.create_audio_time_review_thread(uuid,uuid,text,numeric,numeric,text,text)',
       'EXECUTE'
     )
  then
    raise exception
      'authenticated must be able to execute governed Audio workbench RPCs';
  end if;

  if has_function_privilege(
       'anon',
       'public.get_audio_editorial_media_context(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.get_audio_editorial_workbench(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.create_audio_time_review_thread(uuid,uuid,text,numeric,numeric,text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.add_audio_review_comment(uuid,text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.set_audio_review_thread_status(uuid,text)',
       'EXECUTE'
     )
  then
    raise exception
      'anon must not execute Audio Editorial Workbench RPCs';
  end if;

  select pg_get_functiondef(
    'audio.assert_publication_review_thread_integrity()'::regprocedure
  )
  into v_integrity_definition;

  if position(
       'current_submitted_version_id'
       in v_integrity_definition
     ) = 0
     or position(
       'duration_seconds'
       in v_integrity_definition
     ) = 0
     or position(
       'version_kind <> ''submitted'''
       in v_integrity_definition
     ) = 0
  then
    raise exception
      'Audio review integrity must bind anchors to the exact submitted version and duration';
  end if;

  select pg_get_functiondef(
    'public.get_audio_editorial_media_context(uuid)'::regprocedure
  )
  into v_media_definition;

  if position(
       'current_user_has_capability(''view_audio'')'
       in v_media_definition
     ) = 0
     or position(
       'current_user_can_edit_audio'
       in v_media_definition
     ) = 0
     or position(
       'waveform_data'
       in v_media_definition
     ) = 0
     or position(
       'source_probe'
       in v_media_definition
     ) = 0
  then
    raise exception
      'Current Audio Media context must preserve Audio access and canonical Media facts';
  end if;

  select pg_get_functiondef(
    'public.get_audio_editorial_workbench(uuid)'::regprocedure
  )
  into v_workspace_definition;

  if position(
       'current_user_can_participate_audio_review'
       in v_workspace_definition
     ) = 0
     or position(
       'waveform_url'
       in v_workspace_definition
     ) = 0
     or position(
       'source_probe'
       in v_workspace_definition
     ) = 0
  then
    raise exception
      'Audio review workspace must preserve review authority and canonical Media context';
  end if;

  select pg_get_functiondef(
    'public.create_audio_time_review_thread(uuid,uuid,text,numeric,numeric,text,text)'::regprocedure
  )
  into v_create_definition;

  if position(
       'current_user_can_participate_audio_review'
       in v_create_definition
     ) = 0
     or position(
       'current_submitted_version_id'
       in v_create_definition
     ) = 0
     or position(
       'ready_for_review'
       in v_create_definition
     ) = 0
  then
    raise exception
      'Audio thread creation must enforce review authority, lifecycle, and exact submitted target';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'audio'
      and table_name = 'publication_review_comments'
      and column_name = 'body_html'
  )
     or not exists (
       select 1
       from information_schema.columns
       where table_schema = 'audio'
         and table_name = 'publication_review_comments'
         and column_name = 'body_text'
     )
  then
    raise exception
      'Audio review comments must preserve rich HTML plus searchable plain text';
  end if;

  raise notice
    'PASS: Audio Editorial Workbench authority is present, governed, Media-backed, exact-version-bound, duration-bound, and closed to anon.';
end;
$verify$;
