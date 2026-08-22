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
  v_enclosure_oid oid :=
    to_regprocedure('public.get_public_audio_enclosure(uuid)');
  v_show_helper_definition text;
  v_episode_helper_definition text;
  v_show_reader_definition text;
  v_episode_reader_definition text;
  v_enclosure_definition text;
  v_show_reader_security_definer boolean;
  v_show_reader_volatility "char";
  v_episode_reader_security_definer boolean;
  v_episode_reader_volatility "char";
  v_enclosure_security_definer boolean;
  v_enclosure_volatility "char";
  v_public_show_execute boolean;
  v_public_episode_execute boolean;
  v_public_enclosure_execute boolean;
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
     or v_enclosure_oid is null
  then
    raise exception
      'Phase 6B M2 shared Show helper or public resolver is missing.';
  end if;

  select pg_get_functiondef(
    'editorial.assert_resource_binding_integrity()'::regprocedure
  )
  into v_binding_definition;

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
     or position('Published Show Episode slug is immutable' in v_episode_helper_definition) = 0
  then
    raise exception
      'Audio Episode no longer maintains shared Show Episode identity or canonical slug stability.';
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
      'One or more shared Show/Audio invariant triggers are missing or disabled.';
  end if;

  select
    p.prosecdef,
    p.provolatile,
    pg_get_functiondef(p.oid),
    exists (
      select 1
      from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
      where acl.grantee = 0
        and acl.privilege_type = 'EXECUTE'
    )
  into
    v_show_reader_security_definer,
    v_show_reader_volatility,
    v_show_reader_definition,
    v_public_show_execute
  from pg_proc p
  where p.oid = v_show_reader_oid;

  select
    p.prosecdef,
    p.provolatile,
    pg_get_functiondef(p.oid),
    exists (
      select 1
      from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
      where acl.grantee = 0
        and acl.privilege_type = 'EXECUTE'
    )
  into
    v_episode_reader_security_definer,
    v_episode_reader_volatility,
    v_episode_reader_definition,
    v_public_episode_execute
  from pg_proc p
  where p.oid = v_episode_reader_oid;

  select
    p.prosecdef,
    p.provolatile,
    pg_get_functiondef(p.oid),
    exists (
      select 1
      from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
      where acl.grantee = 0
        and acl.privilege_type = 'EXECUTE'
    )
  into
    v_enclosure_security_definer,
    v_enclosure_volatility,
    v_enclosure_definition,
    v_public_enclosure_execute
  from pg_proc p
  where p.oid = v_enclosure_oid;

  if not v_show_reader_security_definer
     or v_show_reader_volatility <> 's'
     or not v_episode_reader_security_definer
     or v_episode_reader_volatility <> 's'
     or not v_enclosure_security_definer
     or v_enclosure_volatility <> 's'
  then
    raise exception
      'Shared Show public readers must remain STABLE SECURITY DEFINER.';
  end if;

  if v_public_show_execute
     or v_public_episode_execute
     or v_public_enclosure_execute
  then
    raise exception
      'PUBLIC received blanket Phase 6B M2 resolver execution.';
  end if;

  if not has_function_privilege(
    'anon',
    'public.get_public_show(text)',
    'EXECUTE'
  ) or not has_function_privilege(
    'authenticated',
    'public.get_public_show(text)',
    'EXECUTE'
  ) or not has_function_privilege(
    'anon',
    'public.get_public_show_episode(text,text)',
    'EXECUTE'
  ) or not has_function_privilege(
    'authenticated',
    'public.get_public_show_episode(text,text)',
    'EXECUTE'
  ) or not has_function_privilege(
    'anon',
    'public.get_public_audio_enclosure(uuid)',
    'EXECUTE'
  ) or not has_function_privilege(
    'authenticated',
    'public.get_public_audio_enclosure(uuid)',
    'EXECUTE'
  ) then
    raise exception
      'Intended API roles cannot execute the shared Show public readers.';
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
      'Public Show resolver lost shared identity or canonical Show/feed paths.';
  end if;

  if position('public.get_public_audio_publication' in v_episode_reader_definition) = 0
     or position('''/shows/'' || v_show.slug || ''/'' || v_episode.slug' in v_episode_reader_definition) = 0
     or position('''audio'', v_audio' in v_episode_reader_definition) = 0
  then
    raise exception
      'Public Show Episode resolver no longer wraps the exact M1 Audio safety projection.';
  end if;

  if position('/audio/shows/' in v_show_reader_definition) > 0
     or position('/audio/shows/' in v_episode_reader_definition) > 0
     or position('/episodes/' in v_show_reader_definition) > 0
     or position('/episodes/' in v_episode_reader_definition) > 0
  then
    raise exception
      'Rejected Audio-bucket or redundant Episode URL grammar returned.';
  end if;

  if position('current_working_version_id' in v_show_reader_definition) > 0
     or position('current_submitted_version_id' in v_show_reader_definition) > 0
     or position('current_approved_version_id' in v_show_reader_definition) > 0
     or position('publication_review_events' in v_show_reader_definition) > 0
     or position('''metadata''' in v_show_reader_definition) > 0
  then
    raise exception
      'Public Show resolver exposes moving Audio, Review, or raw metadata authority.';
  end if;

  if position('public.get_public_audio_publication' in v_enclosure_definition) = 0
     or position('''enclosure_url''' in v_enclosure_definition) = 0
     or position('''source_url''' in v_enclosure_definition) = 0
  then
    raise exception
      'Audio enclosure no longer inherits M1 public-safety authority.';
  end if;

  raise notice
    'PASS: Phase 6B M2 keeps Show and Show Episode identity shared, nests Episode URLs directly under Show, and keeps Audio as the first media consumer.';
end;
$verify$;
