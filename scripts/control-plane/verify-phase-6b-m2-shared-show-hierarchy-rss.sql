do $verify$
declare
  v_binding_definition text;
  v_show_helper_oid oid :=
    to_regprocedure('editorial.ensure_audio_show_shared_identity(uuid)');
  v_episode_helper_oid oid :=
    to_regprocedure('editorial.ensure_audio_episode_shared_identity(uuid)');
  v_show_reader_oid oid :=
    to_regprocedure('public.get_public_show(text)');
  v_episode_reader_oid oid :=
    to_regprocedure('public.get_public_show_episode(text,text)');
  v_audio_reader_oid oid :=
    to_regprocedure('public.get_public_audio_publication(text)');
  v_enclosure_oid oid :=
    to_regprocedure('public.get_public_audio_enclosure(uuid)');
  v_slug_guard_oid oid :=
    to_regprocedure('audio.enforce_publication_slug_identity()');
  v_trust_candidates_oid oid :=
    to_regprocedure('public.list_audio_trust_attachment_candidates()');
  v_show_helper_definition text;
  v_episode_helper_definition text;
  v_show_reader_definition text;
  v_episode_reader_definition text;
  v_audio_reader_definition text;
  v_enclosure_definition text;
  v_slug_guard_definition text;
  v_trust_candidates_definition text;
  v_trigger_count integer;
begin
  if not exists (
    select 1
    from editorial.resource_kinds
    where kind = 'show'
      and enabled
  ) or not exists (
    select 1
    from editorial.resource_kinds
    where kind = 'show_episode'
      and enabled
  ) then
    raise exception
      'Shared Show Resource kinds are missing or disabled.';
  end if;

  if to_regclass('editorial.shows') is null
     or to_regclass('editorial.show_episodes') is null
     or to_regclass('editorial.audio_show_shared_links') is null
     or to_regclass('editorial.audio_episode_shared_links') is null
  then
    raise exception
      'Shared Show hierarchy tables or Audio consumer bindings are missing.';
  end if;

  if v_show_helper_oid is null
     or v_episode_helper_oid is null
     or v_show_reader_oid is null
     or v_episode_reader_oid is null
     or v_audio_reader_oid is null
     or v_enclosure_oid is null
     or v_slug_guard_oid is null
     or v_trust_candidates_oid is null
  then
    raise exception
      'Phase 6B M2 shared Show, Audio identity, or Trust helper is missing.';
  end if;

  select pg_get_functiondef(
    'editorial.assert_resource_binding_integrity()'::regprocedure
  ) into v_binding_definition;

  if position('when ''show''' in v_binding_definition) = 0
     or position('from editorial.shows' in v_binding_definition) = 0
     or position('when ''show_episode''' in v_binding_definition) = 0
     or position('from editorial.show_episodes' in v_binding_definition) = 0
     or position('when ''audio_show''' in v_binding_definition) = 0
     or position('when ''audio_episode''' in v_binding_definition) = 0
     or position('when ''organization''' in v_binding_definition) = 0
     or position('when ''person''' in v_binding_definition) = 0
  then
    raise exception
      'Resource binding integrity lost shared Show or accepted existing authority.';
  end if;

  select pg_get_functiondef(v_show_helper_oid)
  into v_show_helper_definition;
  select pg_get_functiondef(v_episode_helper_oid)
  into v_episode_helper_definition;
  select pg_get_functiondef(v_show_reader_oid)
  into v_show_reader_definition;
  select pg_get_functiondef(v_episode_reader_oid)
  into v_episode_reader_definition;
  select pg_get_functiondef(v_audio_reader_oid)
  into v_audio_reader_definition;
  select pg_get_functiondef(v_enclosure_oid)
  into v_enclosure_definition;
  select pg_get_functiondef(v_slug_guard_oid)
  into v_slug_guard_definition;
  select pg_get_functiondef(v_trust_candidates_oid)
  into v_trust_candidates_definition;

  if position('editorial.audio_show_shared_links' in v_show_helper_definition) = 0
     or position('editorial.shows' in v_show_helper_definition) = 0
     or position('Published Show slug is immutable' in v_show_helper_definition) = 0
  then
    raise exception
      'Audio Show no longer maintains shared Show identity or canonical slug stability.';
  end if;

  if position('editorial.audio_episode_shared_links' in v_episode_helper_definition) = 0
     or position('editorial.show_episodes' in v_episode_helper_definition) = 0
     or position('editorial.ensure_audio_show_shared_identity' in v_episode_helper_definition) = 0
     or position('v_internal_prefix' in v_episode_helper_definition) = 0
     or position('v_episode_slug' in v_episode_helper_definition) = 0
     or position('set' || chr(10) || '    title = v_publication.title' in v_episode_helper_definition) = 0
     or position('slug = v_publication.slug' in v_episode_helper_definition) > 0
  then
    raise exception
      'Audio Episode no longer derives immutable shared Show Episode identity from the Audio lookup key.';
  end if;

  if position('Audio URL identity is system-managed' in v_slug_guard_definition) = 0
     or position('''ep-'' || new.show_id::text || ''-''' in v_slug_guard_definition) = 0
     or position('new.slug is distinct from old.slug' in v_slug_guard_definition) = 0
  then
    raise exception
      'Audio publication slug guard no longer keeps URL identity system-managed.';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgname = 'audio_publication_slug_identity_guard'
      and not trigger_row.tgisinternal
      and trigger_row.tgenabled <> 'D'
  ) then
    raise exception
      'Audio publication slug identity guard is missing or disabled.';
  end if;

  select count(*)
  into v_trigger_count
  from pg_trigger trigger_row
  where not trigger_row.tgisinternal
    and trigger_row.tgenabled <> 'D'
    and trigger_row.tgname in (
      'audio_show_shared_identity_sync',
      'audio_episode_shared_identity_sync',
      'audio_resource_shared_visibility_sync',
      'audio_published_episode_parent_visibility'
    );

  if v_trigger_count <> 4 then
    raise exception
      'One or more shared Show or Audio invariant triggers are missing or disabled.';
  end if;

  if not exists (
    select 1
    from pg_proc p
    where p.oid = v_show_reader_oid
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
    where p.oid = v_audio_reader_oid
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
      'Phase 6B M2 public readers must remain STABLE SECURITY DEFINER.';
  end if;

  if has_function_privilege('public', 'public.get_public_show(text)', 'EXECUTE')
     or has_function_privilege('public', 'public.get_public_show_episode(text,text)', 'EXECUTE')
     or has_function_privilege('public', 'public.get_public_audio_publication(text)', 'EXECUTE')
     or has_function_privilege('public', 'public.get_public_audio_enclosure(uuid)', 'EXECUTE')
  then
    raise exception
      'PUBLIC received blanket Phase 6B M2 resolver execution.';
  end if;

  if not has_function_privilege('anon', 'public.get_public_show(text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_public_show(text)', 'EXECUTE')
     or not has_function_privilege('anon', 'public.get_public_show_episode(text,text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_public_show_episode(text,text)', 'EXECUTE')
     or not has_function_privilege('anon', 'public.get_public_audio_publication(text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_public_audio_publication(text)', 'EXECUTE')
     or not has_function_privilege('anon', 'public.get_public_audio_enclosure(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.get_public_audio_enclosure(uuid)', 'EXECUTE')
  then
    raise exception
      'Intended API roles cannot execute the Phase 6B M2 public readers.';
  end if;

  if has_schema_privilege('anon', 'audio', 'USAGE')
     or has_schema_privilege('authenticated', 'audio', 'USAGE')
  then
    raise exception
      'Private Audio schema usage leaked to API roles.';
  end if;

  if has_table_privilege('anon', 'editorial.shows', 'SELECT')
     or has_table_privilege('anon', 'editorial.show_episodes', 'SELECT')
     or has_table_privilege('anon', 'editorial.audio_show_shared_links', 'SELECT')
     or has_table_privilege('anon', 'editorial.audio_episode_shared_links', 'SELECT')
     or has_table_privilege('anon', 'audio.shows', 'SELECT')
     or has_table_privilege('anon', 'audio.publications', 'SELECT')
  then
    raise exception
      'anon received direct shared Show or private Audio table access.';
  end if;

  if position('public.get_public_show_episode' in v_show_reader_definition) = 0
     or position('''canonical_path'', ''/shows/'' || v_show.slug' in v_show_reader_definition) = 0
     or position('''feed_path'', ''/shows/'' || v_show.slug || ''/feed.xml''' in v_show_reader_definition) = 0
  then
    raise exception
      'Public Show resolver lost shared identity or canonical Show and feed paths.';
  end if;

  if position('public.get_public_audio_publication_m1' in v_episode_reader_definition) = 0
     or position('v_audio_publication.slug' in v_episode_reader_definition) = 0
     or position('''/shows/'' ||' in v_episode_reader_definition) = 0
     or position('to_jsonb(v_episode.slug)' in v_episode_reader_definition) = 0
     or position('''audio'',' in v_episode_reader_definition) = 0
  then
    raise exception
      'Public Show Episode resolver no longer composes shared identity with the exact M1 Audio safety projection.';
  end if;

  if position('public.get_public_audio_publication_m1' in v_audio_reader_definition) = 0
     or position('''standalone''' in v_audio_reader_definition) = 0
     or position('''/audio/''' in v_audio_reader_definition) = 0
  then
    raise exception
      'Plain Audio resolver is no longer Standalone-only over the exact M1 safety projection.';
  end if;

  if position('public.get_public_audio_publication_m1' in v_enclosure_definition) = 0
     or position('''enclosure_url''' in v_enclosure_definition) = 0
     or position('''source_url''' in v_enclosure_definition) = 0
  then
    raise exception
      'Audio enclosure no longer inherits the exact M1 public-safety authority.';
  end if;

  if position('/audio/shows/' in v_show_reader_definition) > 0
     or position('/audio/shows/' in v_episode_reader_definition) > 0
     or position('/episodes/' in v_show_reader_definition) > 0
     or position('/episodes/' in v_episode_reader_definition) > 0
  then
    raise exception
      'Rejected Audio-bucket or redundant Episode URL grammar returned.';
  end if;

  if has_function_privilege('public', 'public.list_audio_trust_attachment_candidates()', 'EXECUTE')
     or has_function_privilege('anon', 'public.list_audio_trust_attachment_candidates()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.list_audio_trust_attachment_candidates()', 'EXECUTE')
     or position('edit_own_audio' in v_trust_candidates_definition) = 0
     or position('edit_others_audio' in v_trust_candidates_definition) = 0
     or position('credit_note' in v_trust_candidates_definition) > 0
     or position('editor_note' in v_trust_candidates_definition) > 0
  then
    raise exception
      'Audio Trust candidate picker authority leaked access or private Trust notes.';
  end if;

  raise notice
    'PASS: Phase 6B M2 keeps shared Show identity canonical, keeps Audio lookup identity internal, and removes raw Trust IDs from the editor contract.';
end;
$verify$;
