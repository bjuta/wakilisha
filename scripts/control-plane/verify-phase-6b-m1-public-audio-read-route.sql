do $verify$
declare
  v_function_oid oid := to_regprocedure('public.get_public_audio_publication(text)');
  v_definition text;
  v_security_definer boolean;
  v_volatility "char";
  v_public_execute boolean;
begin
  if v_function_oid is null then
    raise exception 'public.get_public_audio_publication(text) is missing.';
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
    v_security_definer,
    v_volatility,
    v_definition,
    v_public_execute
  from pg_proc p
  where p.oid = v_function_oid;

  if not v_security_definer then
    raise exception 'Public Audio resolver must remain SECURITY DEFINER.';
  end if;

  if v_volatility <> 's' then
    raise exception 'Public Audio resolver must remain STABLE.';
  end if;

  if v_public_execute then
    raise exception 'PUBLIC must not receive blanket Audio resolver execution.';
  end if;

  if not has_function_privilege(
    'anon',
    'public.get_public_audio_publication(text)',
    'EXECUTE'
  ) then
    raise exception 'anon cannot execute the intended public Audio resolver.';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.get_public_audio_publication(text)',
    'EXECUTE'
  ) then
    raise exception 'authenticated cannot execute the intended public Audio resolver.';
  end if;

  if has_schema_privilege('anon', 'audio', 'USAGE')
     or has_schema_privilege('authenticated', 'audio', 'USAGE')
  then
    raise exception 'Private Audio schema usage leaked to API roles.';
  end if;

  if has_table_privilege('anon', 'audio.publications', 'SELECT')
     or has_table_privilege('anon', 'audio.publication_versions', 'SELECT')
     or has_table_privilege('anon', 'audio.publication_snapshots', 'SELECT')
     or has_table_privilege('anon', 'audio.publication_version_chapters', 'SELECT')
  then
    raise exception 'anon received direct private Audio table access.';
  end if;

  if has_function_privilege(
    'anon',
    'public.get_admin_audio_publication_workspace(uuid)',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.get_audio_editorial_workbench(uuid)',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.get_audio_editorial_media_context(uuid)',
    'EXECUTE'
  ) then
    raise exception 'Admin or Editorial Audio RPC execution leaked to anon.';
  end if;

  for v_definition in
    select v_definition
  loop
    if position('current_published_version_id' in v_definition) = 0
       or position("version_row.version_kind = 'published'" in v_definition) = 0
       or position("version_row.status = 'published'" in v_definition) = 0
       or position('audio.publication_snapshots' in v_definition) = 0
       or position('audio.assert_publishable_version_media' in v_definition) = 0
       or position('audio.publication_version_chapters' in v_definition) = 0
       or position("attachment.target_version_type = 'audio_publication_version'" in v_definition) = 0
       or position('attachment.public_safe' in v_definition) = 0
       or position('governance.public_safe' in v_definition) = 0
       or position("source.exposure_class in ('public', 'public_redacted')" in v_definition) = 0
       or position("'canonical_path', '/audio/' || v_version.slug" in v_definition) = 0
    then
      raise exception 'Public Audio resolver lost an exact-version, Media, Trust, or route authority guard.';
    end if;

    if position('binding.current_working_version_id' in v_definition) > 0
       or position('binding.current_submitted_version_id' in v_definition) > 0
       or position('binding.current_approved_version_id' in v_definition) > 0
       or position('publication_review_events' in v_definition) > 0
       or position('publication_review_threads' in v_definition) > 0
       or position('publication_review_comments' in v_definition) > 0
       or position("'metadata'" in v_definition) > 0
    then
      raise exception 'Public Audio resolver exposes moving, Review, or raw metadata authority.';
    end if;
  end loop;

  raise notice 'PASS: Phase 6B M1 public Audio resolves only the exact current published version through current Media safety and public-safe Trust, while private Audio authority remains closed.';
end;
$verify$;
