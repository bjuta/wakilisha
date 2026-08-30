begin;
set local transaction read only;

do $verify$
declare
  v_def text;
begin
  if to_regprocedure('video.assert_exact_media_revision(uuid,uuid,text)') is null then
    raise exception 'PHASE_7A_K5E_FAIL: exact Video Media working guard is missing';
  end if;

  v_def := pg_get_functiondef(
    'video.assert_exact_media_revision(uuid,uuid,text)'::regprocedure
  );

  if position('verification_state' in v_def)=0
     or position('asset_kind' in v_def)=0
     or position('lifecycle_state' in v_def)=0
  then
    raise exception 'PHASE_7A_K5E_FAIL: working Video Media exactness checks are incomplete';
  end if;

  if position('rights_status' in v_def)>0
     or position('consent_status' in v_def)>0
     or position('public_safety_state' in v_def)>0
     or position('source_protection_class' in v_def)>0
     or position('retention_state' in v_def)>0
  then
    raise exception 'PHASE_7A_K5E_FAIL: public Media governance still blocks working Video composition';
  end if;

  v_def := pg_get_functiondef(
    'video.assert_publishable_publication_version(uuid)'::regprocedure
  );

  if position('assert_publishable_media_revision' in v_def)=0
     or position('video_master' in v_def)=0
  then
    raise exception 'PHASE_7A_K5E_FAIL: public Video publish Media gate is missing';
  end if;

  v_def := pg_get_functiondef(
    'video.assert_publishable_media_revision(uuid,uuid,text)'::regprocedure
  );

  if position('rights_status' in v_def)=0
     or position('consent_status' in v_def)=0
     or position('public_safety_state' in v_def)=0
     or position('source_protection_class' in v_def)=0
     or position('retention_state' in v_def)=0
  then
    raise exception 'PHASE_7A_K5E_FAIL: public Media governance is not preserved at publication';
  end if;

  if to_regprocedure('public.get_media_asset_governance_admin(uuid)') is null then
    raise exception 'PHASE_7A_K5E_FAIL: governed Media governance read is missing';
  end if;

  if has_function_privilege(
       'anon',
       'public.get_media_asset_governance_admin(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.get_media_asset_governance_admin(uuid)',
       'EXECUTE'
     )
  then
    raise exception 'PHASE_7A_K5E_FAIL: Media governance read grants are wrong';
  end if;

  v_def := pg_get_functiondef(
    'public.get_media_asset_governance_admin(uuid)'::regprocedure
  );

  if position('review_media_governance' in v_def)=0
     or position('asset_governance_versions' in v_def)=0
  then
    raise exception 'PHASE_7A_K5E_FAIL: Media governance read is not capability checked';
  end if;

  if to_regprocedure(
       'public.create_media_governance_version(uuid,bigint,jsonb,text,uuid)'
     ) is null
     or not has_function_privilege(
       'authenticated',
       'public.create_media_governance_version(uuid,bigint,jsonb,text,uuid)',
       'EXECUTE'
     )
  then
    raise exception 'PHASE_7A_K5E_FAIL: canonical Media governance write authority is unavailable';
  end if;
end;
$verify$;

select
  'PHASE_7A_K5E_REAL_VIDEO_MEDIA_GOVERNANCE_BOUNDARY_PASS' as verification_result;

rollback;
