begin;
set local transaction read only;

do $verify$
declare
  v_def text;
  v_security_definer boolean;
  v_provolatile "char";
begin
  if to_regprocedure('public.list_admin_video_publications()') is null then
    raise exception 'PHASE_7A_K5B_FAIL: list_admin_video_publications() is missing';
  end if;

  select p.prosecdef,p.provolatile,pg_get_functiondef(p.oid)
  into v_security_definer,v_provolatile,v_def
  from pg_proc p
  where p.oid='public.list_admin_video_publications()'::regprocedure;

  if not v_security_definer or v_provolatile<>'s' then
    raise exception 'PHASE_7A_K5B_FAIL: Video admin index is not stable SECURITY DEFINER';
  end if;

  if position('''shows''' in v_def)=0
     or position('''show_episodes''' in v_def)=0
     or position('editorial.video_episode_shared_links' in v_def)=0
     or position('''video_publication_id''' in v_def)=0
  then
    raise exception 'PHASE_7A_K5B_FAIL: shared Show catalog is missing from Video admin index';
  end if;

  if not has_function_privilege('authenticated','public.list_admin_video_publications()','EXECUTE')
     or has_function_privilege('anon','public.list_admin_video_publications()','EXECUTE')
  then
    raise exception 'PHASE_7A_K5B_FAIL: Video admin index execute boundary is wrong';
  end if;
end;
$verify$;

select
  'PHASE_7A_K5B_VIDEO_EDITOR_SHARED_SHOW_CATALOG_PASS' as verification_result,
  (select count(*) from editorial.shows) as show_count,
  (select count(*) from editorial.show_episodes) as show_episode_count,
  (select count(*) from editorial.video_episode_shared_links) as video_episode_link_count;

rollback;
