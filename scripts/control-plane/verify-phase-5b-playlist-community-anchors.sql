do $$
declare
  v_constraint text;
  v_create_definition text;
  v_summary_definition text;
begin
  select pg_get_constraintdef(c.oid)
  into v_constraint
  from pg_constraint c
  where c.conrelid = 'public.community_comments'::regclass
    and c.conname = 'community_comments_anchor_type_check';

  if v_constraint is null
    or position('playlist_track' in v_constraint) = 0
  then
    raise exception
      'Playlist track anchor is missing from community_comments constraint';
  end if;

  select pg_get_functiondef(
    'public.community_create_context_anchor_comment(uuid,text,text,text,text,text,text,text,text,text)'::regprocedure
  )
  into v_create_definition;

  if position(
    'playlist_track'
    in coalesce(v_create_definition, '')
  ) = 0
  then
    raise exception
      'Playlist track anchor is missing from community create RPC';
  end if;

  select pg_get_functiondef(
    'public.community_get_context_anchor_summary(uuid,text,integer)'::regprocedure
  )
  into v_summary_definition;

  if position(
    'playlist_track'
    in coalesce(v_summary_definition, '')
  ) = 0
  then
    raise exception
      'Playlist track anchor is missing from community summary RPC';
  end if;

  if has_function_privilege(
    'anon',
    'public.community_create_context_anchor_comment(uuid,text,text,text,text,text,text,text,text,text)',
    'EXECUTE'
  )
  then
    raise exception
      'Anonymous users must not create Playlist track comments';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.community_create_context_anchor_comment(uuid,text,text,text,text,text,text,text,text,text)',
    'EXECUTE'
  )
  then
    raise exception
      'Authenticated Playlist track comment execution is missing';
  end if;

  if not has_function_privilege(
    'anon',
    'public.community_get_context_anchor_summary(uuid,text,integer)',
    'EXECUTE'
  )
  then
    raise exception
      'Anonymous Playlist track discussion summary access is missing';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.community_get_context_anchor_summary(uuid,text,integer)',
    'EXECUTE'
  )
  then
    raise exception
      'Authenticated Playlist track discussion summary access is missing';
  end if;
end;
$$;

select jsonb_build_object(
  'verification',
  'PASS',
  'community_entity_type',
  (
    select data_type
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'community_threads'
      and column_name = 'entity_type'
  ),
  'playlist_anchor',
  'playlist_track'
) as phase_5b_playlist_community_anchor_acceptance;

do $$
declare
  v_security_definer boolean;
  v_function_config text[];
  v_public_execute boolean;
begin
  select
    p.prosecdef,
    p.proconfig,
    exists (
      select 1
      from aclexplode(
        coalesce(
          p.proacl,
          acldefault(
            'f',
            p.proowner
          )
        )
      ) acl
      where acl.grantee = 0
        and acl.privilege_type = 'EXECUTE'
    )
  into
    v_security_definer,
    v_function_config,
    v_public_execute
  from pg_proc p
  where p.oid =
    'public.community_get_thread_by_entity(text,text,text)'::regprocedure;

  if v_security_definer is distinct from true
  then
    raise exception
      'community_get_thread_by_entity is no longer SECURITY DEFINER';
  end if;

  if not (
    'search_path=public' =
    any(
      coalesce(
        v_function_config,
        array[]::text[]
      )
    )
  )
  then
    raise exception
      'community_get_thread_by_entity does not have a fixed public search_path';
  end if;

  if v_public_execute
  then
    raise exception
      'community_get_thread_by_entity still inherits PUBLIC execute';
  end if;

  if not has_function_privilege(
    'anon',
    'public.community_get_thread_by_entity(text,text,text)',
    'EXECUTE'
  )
  then
    raise exception
      'Anonymous community thread read access is missing';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.community_get_thread_by_entity(text,text,text)',
    'EXECUTE'
  )
  then
    raise exception
      'Authenticated community thread read access is missing';
  end if;
end;
$$;

select jsonb_build_object(
  'verification',
  'PASS',
  'playlist_anchor',
  'playlist_track',
  'thread_read_search_path',
  (
    select p.proconfig
    from pg_proc p
    where p.oid =
      'public.community_get_thread_by_entity(text,text,text)'::regprocedure
  ),
  'anon_thread_read',
  has_function_privilege(
    'anon',
    'public.community_get_thread_by_entity(text,text,text)',
    'EXECUTE'
  ),
  'authenticated_thread_read',
  has_function_privilege(
    'authenticated',
    'public.community_get_thread_by_entity(text,text,text)',
    'EXECUTE'
  )
) as phase_5b_playlist_community_security_acceptance;

do $$
declare
  v_signature text;
  v_oid oid;
  v_function_config text[];
  v_public_execute boolean;
begin
  foreach v_signature in array array[
    'public.community_get_context_anchor_comments(uuid,text,text,text,text,integer)',
    'public.community_get_thread_comments(uuid,text,integer,integer)'
  ]
  loop
    v_oid :=
      v_signature::regprocedure::oid;

    select
      p.proconfig,
      exists (
        select 1
        from aclexplode(
          coalesce(
            p.proacl,
            acldefault(
              'f',
              p.proowner
            )
          )
        ) acl
        where acl.grantee = 0
          and acl.privilege_type = 'EXECUTE'
      )
    into
      v_function_config,
      v_public_execute
    from pg_proc p
    where p.oid = v_oid;

    if not (
      'search_path=public' =
      any(
        coalesce(
          v_function_config,
          array[]::text[]
        )
      )
    )
    then
      raise exception
        'Shared community read RPC does not have a fixed public search_path: %',
        v_signature;
    end if;

    if v_public_execute
    then
      raise exception
        'Shared community read RPC still inherits PUBLIC execute: %',
        v_signature;
    end if;

    if not has_function_privilege(
      'anon',
      v_signature,
      'EXECUTE'
    )
    then
      raise exception
        'Anonymous shared community read access is missing: %',
        v_signature;
    end if;

    if not has_function_privilege(
      'authenticated',
      v_signature,
      'EXECUTE'
    )
    then
      raise exception
        'Authenticated shared community read access is missing: %',
        v_signature;
    end if;
  end loop;
end;
$$;

select jsonb_build_object(
  'verification',
  'PASS',
  'context_comments_anon',
  has_function_privilege(
    'anon',
    'public.community_get_context_anchor_comments(uuid,text,text,text,text,integer)',
    'EXECUTE'
  ),
  'context_comments_authenticated',
  has_function_privilege(
    'authenticated',
    'public.community_get_context_anchor_comments(uuid,text,text,text,text,integer)',
    'EXECUTE'
  ),
  'thread_comments_anon',
  has_function_privilege(
    'anon',
    'public.community_get_thread_comments(uuid,text,integer,integer)',
    'EXECUTE'
  ),
  'thread_comments_authenticated',
  has_function_privilege(
    'authenticated',
    'public.community_get_thread_comments(uuid,text,integer,integer)',
    'EXECUTE'
  )
) as phase_5b_playlist_community_read_grants_acceptance;
