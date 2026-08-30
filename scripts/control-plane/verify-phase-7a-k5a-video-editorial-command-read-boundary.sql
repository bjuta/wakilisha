begin;
set local transaction read only;
set local statement_timeout='120s';
set local lock_timeout='5s';

do $verify$
declare
  v_count bigint;
  v_definition text;
  v_signature text;
begin
  if (
    select count(*)
    from platform_private.command_types c
    where c.command_type in (
      'video.publication.create',
      'video.publication.metadata.update',
      'video.source.register',
      'video.publication.source.set',
      'video.publication.show_episode.bind',
      'video.publication.poster.set',
      'video.publication.transcript.set',
      'video.publication.captions.replace',
      'video.publication.chapters.replace'
    ) and c.enabled
  ) <> 9 then
    raise exception 'PHASE_7A_K5A_FAIL: Video editorial command vocabulary is incomplete';
  end if;

  select count(*) into v_count
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.prosecdef
    and p.proname in (
      'create_video_publication',
      'update_video_publication_metadata',
      'register_video_source',
      'set_video_publication_source',
      'bind_video_publication_show_episode',
      'set_video_publication_poster',
      'set_video_publication_transcript',
      'replace_video_publication_captions',
      'replace_video_publication_chapters',
      'list_admin_video_publications',
      'get_admin_video_publication_workspace'
    );
  if v_count<>11 then
    raise exception 'PHASE_7A_K5A_FAIL: governed public Video function count is %',v_count;
  end if;

  foreach v_signature in array array[
    'public.create_video_publication(text,text,text,text,text,uuid,text,text,jsonb,uuid)',
    'public.update_video_publication_metadata(uuid,bigint,jsonb,text,uuid)',
    'public.register_video_source(uuid,bigint,text,text,uuid,uuid,text,text,text,jsonb,uuid)',
    'public.set_video_publication_source(uuid,bigint,uuid,text,uuid)',
    'public.bind_video_publication_show_episode(uuid,bigint,uuid,text,uuid)',
    'public.set_video_publication_poster(uuid,bigint,uuid,uuid,jsonb,text,uuid)',
    'public.set_video_publication_transcript(uuid,bigint,uuid,uuid,jsonb,text,uuid)',
    'public.replace_video_publication_captions(uuid,bigint,jsonb,text,uuid)',
    'public.replace_video_publication_chapters(uuid,bigint,jsonb,text,uuid)',
    'public.list_admin_video_publications()',
    'public.get_admin_video_publication_workspace(uuid)'
  ]
  loop
    if to_regprocedure(v_signature) is null then
      raise exception 'PHASE_7A_K5A_FAIL: missing %',v_signature;
    end if;
    if not has_function_privilege('authenticated',v_signature,'EXECUTE')
       or has_function_privilege('anon',v_signature,'EXECUTE')
    then
      raise exception 'PHASE_7A_K5A_FAIL: browser EXECUTE boundary drifted for %',v_signature;
    end if;
  end loop;

  if has_schema_privilege('anon','video','USAGE')
     or has_schema_privilege('authenticated','video','USAGE')
     or has_schema_privilege('service_role','video','USAGE')
     or exists(
       select 1 from information_schema.role_table_grants g
       where g.table_schema='video'
         and g.grantee in ('anon','authenticated','service_role')
     )
  then
    raise exception 'PHASE_7A_K5A_FAIL: private Video schema/table authority leaked';
  end if;

  foreach v_signature in array array[
    'video.normalize_slug(text)',
    'video.assert_exact_media_revision(uuid,uuid,text)',
    'video.replace_working_media_usage(uuid,text,uuid,uuid,jsonb,uuid,uuid)',
    'video.source_capabilities(uuid)',
    'video.set_single_media_command(uuid,bigint,text,uuid,uuid,jsonb,text,text,uuid)'
  ]
  loop
    if to_regprocedure(v_signature) is null then
      raise exception 'PHASE_7A_K5A_FAIL: missing private helper %',v_signature;
    end if;
    if has_function_privilege('authenticated',v_signature,'EXECUTE')
       or has_function_privilege('anon',v_signature,'EXECUTE')
    then
      raise exception 'PHASE_7A_K5A_FAIL: private helper EXECUTE leaked for %',v_signature;
    end if;
  end loop;

  v_definition:=pg_get_functiondef(
    'video.assert_exact_media_revision(uuid,uuid,text)'::regprocedure
  );
  if position('asset_governance_versions' in v_definition)=0
     or position('verification_state' in v_definition)=0
     or position('approved_public' in v_definition)=0
     or position('owned' in v_definition)=0
     or position('consent_status' in v_definition)=0
  then
    raise exception 'PHASE_7A_K5A_FAIL: exact Media governance proof drifted';
  end if;

  v_definition:=pg_get_functiondef(
    'video.replace_working_media_usage(uuid,text,uuid,uuid,jsonb,uuid,uuid)'::regprocedure
  );
  if position('current_user_can_edit_video' in v_definition)=0
     or position('media.validate_usage_target' in v_definition)=0
     or position('media.usage_links' in v_definition)=0
     or position('media.events' in v_definition)=0
     or position('manage_media_usage' in v_definition)>0
  then
    raise exception 'PHASE_7A_K5A_FAIL: Video-scoped Media composition contract drifted';
  end if;

  v_definition:=pg_get_functiondef(
    'public.create_video_publication(text,text,text,text,text,uuid,text,text,jsonb,uuid)'::regprocedure
  );
  if position('editorial.show_episodes' in v_definition)=0
     or position('editorial.video_episode_shared_links' in v_definition)=0
     or position('video.publication.create' in v_definition)=0
  then
    raise exception 'PHASE_7A_K5A_FAIL: shared Show Episode create contract drifted';
  end if;

  v_definition:=pg_get_functiondef(
    'public.get_admin_video_publication_workspace(uuid)'::regprocedure
  );
  if position('editorial.resource_review_events' in v_definition)=0
     or position('editorial.resource_lifecycle_events' in v_definition)=0
     or position('video.source_capabilities' in v_definition)=0
     or position('editorial.show_episodes' in v_definition)=0
  then
    raise exception 'PHASE_7A_K5A_FAIL: Video workspace shared-authority read contract drifted';
  end if;

  if to_regclass('video.publication_review_events') is not null
     or to_regclass('video.publication_lifecycle_events') is not null
     or to_regclass('video.video_series') is not null
     or to_regclass('video.shows') is not null
     or to_regclass('video.series') is not null
  then
    raise exception 'PHASE_7A_K5A_FAIL: competing Video lifecycle/Show authority exists';
  end if;

  if to_regprocedure('public.snapshot_video_publication_working_version(uuid,bigint,text,uuid)') is null
     or to_regprocedure('public.submit_video_publication_for_review(uuid,bigint,text,text,uuid)') is null
     or to_regprocedure('public.review_video_publication(uuid,bigint,uuid,text,text,text,uuid)') is null
     or to_regprocedure('public.publish_video_publication_version(uuid,bigint,uuid,text,text,uuid)') is null
  then
    raise exception 'PHASE_7A_K5A_FAIL: K4B lifecycle authority is missing';
  end if;

  v_definition:=pg_get_functiondef(
    'editorial.resolve_resource_version_identity(text,uuid)'::regprocedure
  );
  if position('video_publication_version' in v_definition)=0 then
    raise exception 'PHASE_7A_K5A_FAIL: shared Discovery version identity lost Video support';
  end if;
end;
$verify$;

select
  'PHASE_7A_K5A_VIDEO_EDITORIAL_COMMAND_READ_BOUNDARY_PASS' verification_result,
  (select count(*) from video.publications) video_publication_count,
  (select count(*) from video.sources) video_source_count,
  (select count(*) from editorial.resource_versions where version_type='video_publication_version') video_resource_version_count;

rollback;
