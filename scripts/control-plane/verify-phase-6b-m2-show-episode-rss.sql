do $verify$
declare
  v_show_oid oid := to_regprocedure('public.get_public_audio_show(text)');
  v_enclosure_oid oid := to_regprocedure('public.get_public_audio_enclosure(uuid)');
  v_parent_oid oid := to_regprocedure('audio.ensure_published_episode_parent_visibility()');
  v_show_definition text;
  v_enclosure_definition text;
  v_parent_definition text;
  v_show_security_definer boolean;
  v_show_volatility "char";
  v_enclosure_security_definer boolean;
  v_enclosure_volatility "char";
  v_public_show_execute boolean;
  v_public_enclosure_execute boolean;
  v_trigger_enabled "char";
begin
  if v_show_oid is null then
    raise exception 'public.get_public_audio_show(text) is missing.';
  end if;

  if v_enclosure_oid is null then
    raise exception 'public.get_public_audio_enclosure(uuid) is missing.';
  end if;

  if v_parent_oid is null then
    raise exception 'audio.ensure_published_episode_parent_visibility() is missing.';
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
    v_show_security_definer,
    v_show_volatility,
    v_show_definition,
    v_public_show_execute
  from pg_proc p
  where p.oid = v_show_oid;

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

  select pg_get_functiondef(v_parent_oid)
  into v_parent_definition;

  if not v_show_security_definer
     or v_show_volatility <> 's'
  then
    raise exception 'Public Audio Show resolver must remain STABLE SECURITY DEFINER.';
  end if;

  if not v_enclosure_security_definer
     or v_enclosure_volatility <> 's'
  then
    raise exception 'Public Audio enclosure resolver must remain STABLE SECURITY DEFINER.';
  end if;

  if v_public_show_execute or v_public_enclosure_execute then
    raise exception 'PUBLIC received blanket Phase 6B M2 resolver execution.';
  end if;

  if not has_function_privilege(
    'anon',
    'public.get_public_audio_show(text)',
    'EXECUTE'
  ) or not has_function_privilege(
    'authenticated',
    'public.get_public_audio_show(text)',
    'EXECUTE'
  ) then
    raise exception 'API roles cannot execute the intended public Audio Show resolver.';
  end if;

  if not has_function_privilege(
    'anon',
    'public.get_public_audio_enclosure(uuid)',
    'EXECUTE'
  ) or not has_function_privilege(
    'authenticated',
    'public.get_public_audio_enclosure(uuid)',
    'EXECUTE'
  ) then
    raise exception 'API roles cannot execute the intended public Audio enclosure resolver.';
  end if;

  if has_schema_privilege('anon', 'audio', 'USAGE')
     or has_schema_privilege('authenticated', 'audio', 'USAGE')
  then
    raise exception 'Private Audio schema usage leaked to API roles.';
  end if;

  if has_table_privilege('anon', 'audio.shows', 'SELECT')
     or has_table_privilege('anon', 'audio.seasons', 'SELECT')
     or has_table_privilege('anon', 'audio.publications', 'SELECT')
     or has_table_privilege('anon', 'audio.publication_feed_identities', 'SELECT')
     or has_table_privilege('anon', 'audio.publication_snapshots', 'SELECT')
  then
    raise exception 'anon received direct private Audio table access.';
  end if;

  select trigger_row.tgenabled
  into v_trigger_enabled
  from pg_trigger trigger_row
  where trigger_row.tgrelid = 'audio.publications'::regclass
    and trigger_row.tgname = 'audio_published_episode_parent_visibility'
    and not trigger_row.tgisinternal;

  if v_trigger_enabled is null
     or v_trigger_enabled = 'D'
  then
    raise exception 'Published Episode parent-visibility invariant trigger is missing or disabled.';
  end if;

  if position('new.publication_kind <> ''episode''' in v_parent_definition) = 0
     or position('new.status <> ''published''' in v_parent_definition) = 0
     or position('visibility = ''public''' in v_parent_definition) = 0
     or position('audio_show' in v_parent_definition) = 0
     or position('audio_season' in v_parent_definition) = 0
     or position('resource_row.lifecycle_state = ''active''' in v_parent_definition) = 0
  then
    raise exception 'Published Episode parent visibility invariant lost its typed Show/Season guards.';
  end if;

  if position('public.get_public_audio_publication' in v_show_definition) = 0
     or position('publication.publication_kind = ''episode''' in v_show_definition) = 0
     or position('publication.status = ''published''' in v_show_definition) = 0
     or position('binding.current_published_version_id is not null' in v_show_definition) = 0
     or position('episode_resource.lifecycle_state = ''published''' in v_show_definition) = 0
     or position('episode_resource.visibility = ''public''' in v_show_definition) = 0
     or position('show_resource.lifecycle_state = ''active''' in v_show_definition) = 0
     or position('show_resource.visibility = ''public''' in v_show_definition) = 0
     or position('''canonical_path'', ''/audio/shows/'' || v_show.slug' in v_show_definition) = 0
     or position('''feed_path'', ''/audio/shows/'' || v_show.slug || ''/feed.xml''' in v_show_definition) = 0
  then
    raise exception 'Public Audio Show resolver lost an exact published-Episode or route/feed guard.';
  end if;

  if position('current_working_version_id' in v_show_definition) > 0
     or position('current_submitted_version_id' in v_show_definition) > 0
     or position('current_approved_version_id' in v_show_definition) > 0
     or position('publication_review_events' in v_show_definition) > 0
     or position('''metadata''' in v_show_definition) > 0
  then
    raise exception 'Public Audio Show resolver exposes moving, Review, or raw metadata authority.';
  end if;

  if position('public.get_public_audio_publication' in v_enclosure_definition) = 0
     or position('''enclosure_url''' in v_enclosure_definition) = 0
     or position('''source_url''' in v_enclosure_definition) = 0
     or position('''sha256''' in v_enclosure_definition) = 0
  then
    raise exception 'Public Audio enclosure resolver no longer inherits the M1 public-safety projection.';
  end if;

  if position('publication_feed_identities' in v_enclosure_definition) > 0
     or position('publication_snapshots' in v_enclosure_definition) > 0
  then
    raise exception 'Public Audio enclosure resolver rebuilt private feed/snapshot authority instead of reusing M1.';
  end if;

  raise notice 'PASS: Phase 6B M2 exposes only public Shows with currently safe published Episodes, preserves canonical Episode identity, and resolves stable enclosures through the M1 Audio authority.';
end;
$verify$;
