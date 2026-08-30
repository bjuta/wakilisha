begin;
set local transaction read only;
set local statement_timeout = '120s';
set local lock_timeout = '5s';

do $verify$
declare
  v_definition text;
begin
  v_definition := pg_get_functiondef(
    'video.enforce_source_integrity()'::regprocedure
  );

  if position('asset.asset_kind' in v_definition)=0
     or position('asset.lifecycle_state' in v_definition)=0
     or position('file_row.verification_state' in v_definition)=0
     or position('revision.asset_id' in v_definition)=0
  then
    raise exception
      'PHASE_7A_K5E_NATIVE_SOURCE_FAIL: native source exactness checks are incomplete';
  end if;

  if position('rights_status' in v_definition)>0
     or position('consent_status' in v_definition)>0
     or position('public_safety_state' in v_definition)>0
     or position('source_protection_class' in v_definition)>0
     or position('retention_state' in v_definition)>0
     or position('embargo_state' in v_definition)>0
  then
    raise exception
      'PHASE_7A_K5E_NATIVE_SOURCE_FAIL: public governance still blocks native source registration';
  end if;

  v_definition := pg_get_functiondef(
    'video.assert_publishable_media_revision(uuid,uuid,text)'::regprocedure
  );

  if position('rights_status' in v_definition)=0
     or position('consent_status' in v_definition)=0
     or position('public_safety_state' in v_definition)=0
     or position('source_protection_class' in v_definition)=0
     or position('retention_state' in v_definition)=0
     or position('embargo_state' in v_definition)=0
  then
    raise exception
      'PHASE_7A_K5E_NATIVE_SOURCE_FAIL: publish-time Media governance is incomplete';
  end if;

  v_definition := pg_get_functiondef(
    'video.assert_publishable_publication_version(uuid)'::regprocedure
  );

  if position('assert_publishable_media_revision' in v_definition)=0
     or position('video_master' in v_definition)=0
  then
    raise exception
      'PHASE_7A_K5E_NATIVE_SOURCE_FAIL: governed Video publication no longer checks Media publishability';
  end if;

  if has_function_privilege(
       'anon',
       'video.enforce_source_integrity()',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'video.enforce_source_integrity()',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'video.enforce_source_integrity()',
       'EXECUTE'
     )
  then
    raise exception
      'PHASE_7A_K5E_NATIVE_SOURCE_FAIL: internal Video source helper EXECUTE leaked';
  end if;
end;
$verify$;

select
  'PHASE_7A_K5E_NATIVE_SOURCE_INTEGRITY_CONVERGENCE_PASS' as verification_result;

rollback;
