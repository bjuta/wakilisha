begin;
set local transaction read only;

do $verify$
declare
  v_def text;
  v_constraint text;
  v_count bigint;
begin
  if to_regclass('editorial.video_publication_version_trust_revisions') is null
     or to_regclass('platform_private.video_trust_copy_authorizations') is null
  then
    raise exception 'PHASE_7A_K5C_FAIL: Video Trust revision/copy authority is missing';
  end if;

  select pg_get_constraintdef(oid)
  into v_constraint
  from pg_constraint
  where conrelid='editorial.resource_credits'::regclass
    and conname='resource_credits_resource_kind_check';

  if position('standalone_video' in coalesce(v_constraint,''))=0
     or position('video_episode' in coalesce(v_constraint,''))=0
  then
    raise exception 'PHASE_7A_K5C_FAIL: shared Credit attachment authority does not include Video';
  end if;

  select pg_get_constraintdef(oid)
  into v_constraint
  from pg_constraint
  where conrelid='editorial.resource_citations'::regclass
    and conname='resource_citations_target_type_check';

  if position('video_publication_version' in coalesce(v_constraint,''))=0 then
    raise exception 'PHASE_7A_K5C_FAIL: shared Citation attachment authority does not include Video versions';
  end if;

  if to_regprocedure('public.replace_video_publication_version_credits(uuid,jsonb,bigint,text,uuid)') is null
     or to_regprocedure('public.replace_video_publication_version_citations(uuid,jsonb,bigint,text,uuid)') is null
     or to_regprocedure('public.list_video_trust_attachment_candidates()') is null
     or to_regprocedure('editorial.copy_video_version_trust_to_version(uuid,uuid)') is null
     or to_regprocedure('editorial.prevent_immutable_video_trust_mutation()') is null
  then
    raise exception 'PHASE_7A_K5C_FAIL: governed Video Trust command/read/copy surface is incomplete';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.replace_video_publication_version_credits(uuid,jsonb,bigint,text,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.replace_video_publication_version_citations(uuid,jsonb,bigint,text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.replace_video_publication_version_credits(uuid,jsonb,bigint,text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.replace_video_publication_version_citations(uuid,jsonb,bigint,text,uuid)',
       'EXECUTE'
     )
  then
    raise exception 'PHASE_7A_K5C_FAIL: Video Trust execute boundary is wrong';
  end if;

  v_def:=pg_get_functiondef(
    'editorial.assert_resource_version_trust_attachment()'::regprocedure
  );
  if position('video_publication_version' in v_def)=0
     or position('video_publication_version_trust_revisions' in v_def)=0
  then
    raise exception 'PHASE_7A_K5C_FAIL: shared Trust integrity does not validate Video versions';
  end if;

  v_def:=pg_get_functiondef(
    'video.insert_current_publication_snapshot(uuid,bigint,text,uuid)'::regprocedure
  );
  if position('copy_video_version_trust_to_version' in v_def)=0 then
    raise exception 'PHASE_7A_K5C_FAIL: working Video snapshots do not preserve Trust';
  end if;

  v_def:=pg_get_functiondef(
    'video.copy_publication_version_snapshot(uuid,text,uuid)'::regprocedure
  );
  if position('copy_video_version_trust_to_version' in v_def)=0 then
    raise exception 'PHASE_7A_K5C_FAIL: immutable Video snapshots do not preserve Trust';
  end if;

  v_def:=pg_get_functiondef(
    'public.get_admin_video_publication_workspace(uuid)'::regprocedure
  );
  if position('''trust''' in v_def)=0
     or position('video_publication_version_trust_revisions' in v_def)=0
  then
    raise exception 'PHASE_7A_K5C_FAIL: Video workspace does not read current working Trust';
  end if;

  select count(*) into v_count
  from platform_private.command_types
  where command_type in (
    'video.publication.trust.credits.replace',
    'video.publication.trust.citations.replace'
  ) and enabled;

  if v_count<>2 then
    raise exception 'PHASE_7A_K5C_FAIL: Video Trust command types are incomplete';
  end if;

  if to_regclass('video.credits') is not null
     or to_regclass('video.citations') is not null
  then
    raise exception 'PHASE_7A_K5C_FAIL: competing Video Trust identity exists';
  end if;
end;
$verify$;

select
  'PHASE_7A_K5C_VIDEO_VERSION_TRUST_CONVERGENCE_PASS' as verification_result,
  (select count(*) from editorial.video_publication_version_trust_revisions) as trust_revision_count,
  (select count(*) from editorial.resource_credits where resource_kind in ('standalone_video','video_episode')) as video_credit_attachment_count,
  (select count(*) from editorial.resource_citations where resource_kind in ('standalone_video','video_episode')) as video_citation_attachment_count;

rollback;
