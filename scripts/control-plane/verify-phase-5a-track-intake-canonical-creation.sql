do $verify_phase_5a_m217$
declare
  v_definition text;
begin
  if to_regprocedure(
       'public.admin_create_registry_track_from_intake_enriched(uuid,text,text)'
     ) is null
  then
    raise exception
      'FAIL: M217 missing canonical Track Intake creation authority';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.admin_create_registry_track_from_intake_enriched(uuid,text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.admin_create_registry_track_from_intake_enriched(uuid,text,text)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: M217 canonical creation privilege boundary is wrong';
  end if;

  select pg_get_functiondef(
    'public.admin_create_registry_track_from_intake_enriched(uuid,text,text)'::regprocedure
  )
  into v_definition;

  if position(
       'current_user_has_capability(''manage_registry'')'
       in v_definition
     ) = 0
     or position(
       'suggestion.status <> ''needs_review'''
       in v_definition
     ) = 0
     or position(
       'suggestion.decision_status = ''approved'''
       in v_definition
     ) = 0
     or position(
       'insert into public.registry_tracks'
       in v_definition
     ) = 0
     or position(
       'insert into public.registry_track_artists'
       in v_definition
     ) = 0
     or position(
       'admin_resolve_registry_track_intake_enriched'
       in v_definition
     ) = 0
     or position(
       'A Registry track with accepted ISRC'
       in v_definition
     ) = 0
  then
    raise exception
      'FAIL: M217 canonical creation command is missing a required authority or duplicate guard';
  end if;

  if position(
       'insert into public.registry_artists'
       in v_definition
     ) > 0
     or position(
       'insert into public.registry_releases'
       in v_definition
     ) > 0
     or position(
       'insert into public.registry_labels'
       in v_definition
     ) > 0
  then
    raise exception
      'FAIL: M217 can silently create adjacent Registry identities';
  end if;
end;
$verify_phase_5a_m217$;
