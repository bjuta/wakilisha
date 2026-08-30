begin;
set local transaction read only;

do $verify$
declare
  v_constraint text;
  v_def text;
begin
  select pg_get_constraintdef(oid)
  into v_constraint
  from pg_constraint
  where conrelid='editorial.correction_targets'::regclass
    and conname='correction_targets_resource_version_fkey';

  if position('resource_versions' in coalesce(v_constraint,''))=0 then
    raise exception 'PHASE_7A_K5D_FAIL: Correction targets do not use canonical Resource Version identity';
  end if;

  select pg_get_constraintdef(oid)
  into v_constraint
  from pg_constraint
  where conrelid='editorial.correction_targets'::regclass
    and conname='correction_targets_kind_version_pair_check';

  if position('standalone_video' in coalesce(v_constraint,''))=0
     or position('video_episode' in coalesce(v_constraint,''))=0
     or position('video_publication_version' in coalesce(v_constraint,''))=0
  then
    raise exception 'PHASE_7A_K5D_FAIL: Video Correction target pairing is incomplete';
  end if;

  if to_regprocedure('public.get_admin_video_correction_provenance(uuid)') is null then
    raise exception 'PHASE_7A_K5D_FAIL: governed Video correction provenance reader is missing';
  end if;

  if has_function_privilege(
       'anon',
       'public.get_admin_video_correction_provenance(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.get_admin_video_correction_provenance(uuid)',
       'EXECUTE'
     )
  then
    raise exception 'PHASE_7A_K5D_FAIL: Video correction provenance reader grants are wrong';
  end if;

  v_def:=pg_get_functiondef(
    'editorial.assert_correction_target_integrity()'::regprocedure
  );
  if position('editorial.resource_versions' in v_def)=0
     or position('video_publication_resources' in v_def)=0
  then
    raise exception 'PHASE_7A_K5D_FAIL: shared Correction target integrity is not Resource-Version/Video aware';
  end if;

  v_def:=pg_get_functiondef(
    'public.triage_correction_case(uuid,bigint,text,text,uuid,uuid,text,text,text,uuid)'::regprocedure
  );
  if position('editorial.resource_versions' in v_def)=0
     or position('video_publication_version' in v_def)=0
     or position('observed_content_fingerprint' in v_def)=0
  then
    raise exception 'PHASE_7A_K5D_FAIL: correction triage does not preserve exact Video target provenance';
  end if;

  v_def:=pg_get_functiondef(
    'public.get_admin_video_publication_workspace(uuid)'::regprocedure
  );
  if position('get_admin_video_correction_provenance' in v_def)=0 then
    raise exception 'PHASE_7A_K5D_FAIL: Video workspace lacks shared Correction provenance';
  end if;

  if to_regclass('video.correction_cases') is not null
     or to_regclass('video.corrections') is not null
     or exists (
       select 1
       from pg_proc p
       join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public'
         and p.proname='apply_video_correction'
     )
  then
    raise exception 'PHASE_7A_K5D_FAIL: competing or premature Video correction authority exists';
  end if;
end;
$verify$;

select
  'PHASE_7A_K5D_VIDEO_CORRECTION_PROVENANCE_CONVERGENCE_PASS' as verification_result,
  (select count(*) from editorial.correction_targets where target_resource_kind in ('standalone_video','video_episode')) as video_correction_target_count;

rollback;
