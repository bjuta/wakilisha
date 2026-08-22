do $verify$
declare
  v_episode_helper_oid oid :=
    to_regprocedure('editorial.ensure_audio_episode_shared_identity(uuid)');
  v_audio_reader_oid oid :=
    to_regprocedure('public.get_public_audio_publication(text)');
  v_episode_reader_oid oid :=
    to_regprocedure('public.get_public_show_episode(text,text)');
  v_enclosure_oid oid :=
    to_regprocedure('public.get_public_audio_enclosure(uuid)');
  v_slug_guard_oid oid :=
    to_regprocedure('audio.enforce_publication_slug_identity()');
  v_trust_candidates_oid oid :=
    to_regprocedure('public.list_audio_trust_attachment_candidates()');
  v_episode_helper_definition text;
  v_audio_reader_definition text;
  v_episode_reader_definition text;
  v_enclosure_definition text;
  v_slug_guard_definition text;
  v_trust_candidates_definition text;
begin
  if v_episode_helper_oid is null
     or v_audio_reader_oid is null
     or v_episode_reader_oid is null
     or v_enclosure_oid is null
     or v_slug_guard_oid is null
     or v_trust_candidates_oid is null
  then
    raise exception
      'Phase 6B M2 Audio ontology closure function is missing.';
  end if;

  select pg_get_functiondef(v_episode_helper_oid)
  into v_episode_helper_definition;
  select pg_get_functiondef(v_audio_reader_oid)
  into v_audio_reader_definition;
  select pg_get_functiondef(v_episode_reader_oid)
  into v_episode_reader_definition;
  select pg_get_functiondef(v_enclosure_oid)
  into v_enclosure_definition;
  select pg_get_functiondef(v_slug_guard_oid)
  into v_slug_guard_definition;
  select pg_get_functiondef(v_trust_candidates_oid)
  into v_trust_candidates_definition;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgname =
            'audio_publication_slug_identity_guard'
      and not trigger_row.tgisinternal
      and trigger_row.tgenabled <> 'D'
  ) then
    raise exception
      'Audio publication slug identity guard is missing or disabled.';
  end if;

  if position(
       'Audio URL identity is system-managed'
       in v_slug_guard_definition
     ) = 0
     or position(
       '''ep-'' || new.show_id::text || ''-'''
       in v_slug_guard_definition
     ) = 0
     or position(
       'new.slug is distinct from old.slug'
       in v_slug_guard_definition
     ) = 0
  then
    raise exception
      'Audio publication URL identity is no longer system-managed and immutable.';
  end if;

  if position(
       'v_internal_prefix'
       in v_episode_helper_definition
     ) = 0
     or position(
       'v_episode_slug'
       in v_episode_helper_definition
     ) = 0
     or position(
       'editorial.show_episodes'
       in v_episode_helper_definition
     ) = 0
     or position(
       'slug = v_publication.slug'
       in v_episode_helper_definition
     ) > 0
  then
    raise exception
      'Audio Episode no longer derives stable shared Show Episode identity from its internal lookup key.';
  end if;

  if position(
       'public.get_public_audio_publication_m1'
       in v_audio_reader_definition
     ) = 0
     or position(
       '''standalone'''
       in v_audio_reader_definition
     ) = 0
     or position(
       '''/audio/'''
       in v_audio_reader_definition
     ) = 0
  then
    raise exception
      'Plain Audio resolver is no longer Standalone-only over the exact M1 safety projection.';
  end if;

  if position(
       'public.get_public_audio_publication_m1'
       in v_episode_reader_definition
     ) = 0
     or position(
       'v_audio_publication.slug'
       in v_episode_reader_definition
     ) = 0
     or position(
       'to_jsonb(v_episode.slug)'
       in v_episode_reader_definition
     ) = 0
     or position(
       '''/shows/'' ||'
       in v_episode_reader_definition
     ) = 0
  then
    raise exception
      'Public Show Episode resolver no longer composes shared identity with the exact M1 Audio safety projection.';
  end if;

  if position(
       'public.get_public_audio_publication_m1'
       in v_enclosure_definition
     ) = 0
     or position(
       '''enclosure_url'''
       in v_enclosure_definition
     ) = 0
     or position(
       '''source_url'''
       in v_enclosure_definition
     ) = 0
  then
    raise exception
      'Audio enclosure no longer inherits the exact M1 public-safety authority.';
  end if;

  if not exists (
    select 1
    from pg_proc p
    where p.oid = v_audio_reader_oid
      and p.prosecdef
      and p.provolatile = 's'
  ) or not exists (
    select 1
    from pg_proc p
    where p.oid = v_episode_reader_oid
      and p.prosecdef
      and p.provolatile = 's'
  ) or not exists (
    select 1
    from pg_proc p
    where p.oid = v_enclosure_oid
      and p.prosecdef
      and p.provolatile = 's'
  ) then
    raise exception
      'Phase 6B M2 public Audio readers must remain STABLE SECURITY DEFINER.';
  end if;

  if has_function_privilege(
       'public',
       'public.get_public_audio_publication(text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'public',
       'public.get_public_show_episode(text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'public',
       'public.get_public_audio_enclosure(uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'PUBLIC received blanket Phase 6B M2 Audio resolver execution.';
  end if;

  if not has_function_privilege(
       'anon',
       'public.get_public_audio_publication(text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.get_public_audio_publication(text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'anon',
       'public.get_public_show_episode(text,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.get_public_show_episode(text,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'anon',
       'public.get_public_audio_enclosure(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.get_public_audio_enclosure(uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'Intended API roles cannot execute Phase 6B M2 Audio public readers.';
  end if;

  if has_function_privilege(
       'public',
       'public.list_audio_trust_attachment_candidates()',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.list_audio_trust_attachment_candidates()',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.list_audio_trust_attachment_candidates()',
       'EXECUTE'
     )
     or position(
       'edit_own_audio'
       in v_trust_candidates_definition
     ) = 0
     or position(
       'edit_others_audio'
       in v_trust_candidates_definition
     ) = 0
     or position(
       'credit_note'
       in v_trust_candidates_definition
     ) > 0
     or position(
       'editor_note'
       in v_trust_candidates_definition
     ) > 0
  then
    raise exception
      'Audio Trust candidate picker authority leaked access or private Trust notes.';
  end if;

  if has_schema_privilege(
       'anon',
       'audio',
       'USAGE'
     )
     or has_schema_privilege(
       'authenticated',
       'audio',
       'USAGE'
     )
  then
    raise exception
      'Private Audio schema usage leaked to API roles.';
  end if;

  raise notice
    'PASS: Phase 6B M2 Audio ontology closure keeps public identity semantic, Audio lookup identity internal, and Trust attachment IDs behind governed controls.';
end;
$verify$;
