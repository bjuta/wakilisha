-- #1094 permanent static authority verifier: forward feature review admission.
do $verify$
declare
  v_definition text;
begin
  if to_regprocedure(
    'public.admin_materialize_public_music_identity_feature_review_v1(uuid,text)'
  ) is null then
    raise exception 'WK_1094_FORWARD_FEATURE_REVIEW_AUTHORITY_MISSING';
  end if;

  select pg_get_functiondef(
    'public.admin_materialize_public_music_identity_feature_review_v1(uuid,text)'::regprocedure
  ) into v_definition;

  if position('registry_subject_state_fingerprint' in v_definition)=0
     or position('manage_registry' in v_definition)=0
     or position('registry_track_semantic_title_v1' in v_definition)=0
     or position('Existing or historical scoped review' in v_definition)=0
     or position('registry_review_items' in v_definition)=0
     or position('wk_chart_entries_v2' in v_definition)=0
     or position('community_threads' in v_definition)=0
     or position('humanDecisionRequired' in v_definition)=0
     or v_definition ~* '(update|delete[[:space:]]+from|insert[[:space:]]+into)[[:space:]]+public[.](registry_tracks|wk_chart_entries_v2|community_threads)'
  then
    raise exception 'WK_1094_FORWARD_FEATURE_REVIEW_AUTHORITY_DRIFT';
  end if;

  if has_function_privilege(
       'anon',
       'public.admin_materialize_public_music_identity_feature_review_v1(uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_materialize_public_music_identity_feature_review_v1(uuid,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_materialize_public_music_identity_feature_review_v1(uuid,text)',
       'EXECUTE'
     )
  then
    raise exception 'WK_1094_FORWARD_FEATURE_REVIEW_EXECUTE_BOUNDARY_DRIFT';
  end if;

  raise notice 'WK_1094_FORWARD_FEATURE_REVIEW_AUTHORITY_PASS';
end
$verify$;
