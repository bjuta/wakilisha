select set_config(
  'request.jwt.claim.role',
  'service_role',
  true
);

do $verify$
declare
  v_function_oid oid;
  v_definition text;
  v_article public.wk_articles%rowtype;
  v_resource editorial.resources%rowtype;
  v_admin_user_id uuid;
  v_taxonomy_ids uuid[];
  v_original_version_count bigint;
  v_result record;
  v_test_succeeded boolean := false;
  v_error_message text;
  v_after_status text;
  v_after_visibility text;
  v_after_lifecycle text;
  v_after_working uuid;
begin
  v_function_oid := to_regprocedure(
    'public.save_article_versioned(uuid,jsonb,bigint,text,uuid[])'
  );

  if v_function_oid is null then
    raise exception 'STOP: save_article_versioned is missing';
  end if;

  select pg_get_functiondef(v_function_oid)
  into v_definition;

  if position(
       'effective_wp_status := current_article.wp_status'
       in v_definition
     ) = 0 then
    raise exception
      'STOP: Working save does not preserve the current Article status';
  end if;

  if position(
       $needle$when p_payload ? 'wp_status'$needle$
       in v_definition
     ) > 0 then
    raise exception
      'STOP: Working save still consumes a requested publication status';
  end if;

  if position('lifecycle_state = case' in v_definition) > 0
     or position('visibility = case' in v_definition) > 0 then
    raise exception
      'STOP: Working save still owns resource publication transitions';
  end if;

  if not has_function_privilege(
       'authenticated',
       v_function_oid,
       'EXECUTE'
     ) then
    raise exception
      'STOP: Authenticated cannot execute save_article_versioned';
  end if;

  if has_function_privilege(
       'anon',
       v_function_oid,
       'EXECUTE'
     ) then
    raise exception
      'STOP: Anonymous can execute save_article_versioned';
  end if;

  select article.*
  into v_article
  from public.wk_articles article
  where article.slug =
    'why-i-keep-postponing-my-hair-appointment';

  select resource.*
  into v_resource
  from editorial.article_resources binding
  join editorial.resources resource
    on resource.id = binding.resource_id
  where binding.article_id = v_article.id
    and resource.resource_kind = 'article';

  if v_article.id is null or v_resource.id is null then
    raise exception 'STOP: Acceptance Article identity is incomplete';
  end if;

  select coalesce(
    array_agg(
      relation.term_id
      order by relation.taxonomy, relation.term_id
    ),
    '{}'::uuid[]
  )
  into v_taxonomy_ids
  from editorial.article_taxonomy_terms relation
  where relation.resource_id = v_resource.id;

  select count(*)
  into v_original_version_count
  from editorial.article_versions version
  where version.resource_id = v_resource.id;

  select assignment.user_id
  into v_admin_user_id
  from public.user_role_assignments assignment
  where assignment.role_key = 'administrator'
    and assignment.status = 'active'
    and (
      assignment.expires_at is null
      or assignment.expires_at > now()
    )
  order by assignment.assigned_at desc
  limit 1;

  if v_admin_user_id is null then
    raise exception
      'STOP: No active administrator exists for the runtime test';
  end if;

  perform set_config(
    'request.jwt.claim.role',
    'authenticated',
    true
  );
  perform set_config(
    'request.jwt.claim.sub',
    v_admin_user_id::text,
    true
  );

  begin
    update public.wk_articles article
    set wp_status = 'publish'
    where article.id = v_article.id;

    update editorial.resources resource
    set
      visibility = 'public',
      lifecycle_state = 'published'
    where resource.id = v_resource.id;

    select *
    into v_result
    from public.save_article_versioned(
      v_article.id,
      jsonb_build_object(
        'wp_status',
        'draft'
      ),
      v_article.draft_version,
      'manual_save',
      v_taxonomy_ids
    );

    select article.wp_status
    into v_after_status
    from public.wk_articles article
    where article.id = v_article.id;

    select
      resource.visibility,
      resource.lifecycle_state,
      resource.current_working_version_id
    into
      v_after_visibility,
      v_after_lifecycle,
      v_after_working
    from editorial.resources resource
    where resource.id = v_resource.id;

    if v_after_status <> 'publish' then
      raise exception
        'STOP: Manual save demoted the Article status';
    end if;

    if v_after_visibility <> 'public'
       or v_after_lifecycle <> 'published' then
      raise exception
        'STOP: Manual save demoted the resource publication gate';
    end if;

    if v_after_working is distinct from v_result.version_id then
      raise exception
        'STOP: Manual save did not advance the working pointer';
    end if;

    raise exception using
      errcode = 'P0001',
      message = 'WK_PUBLISHED_WORKING_SAVE_ROLLBACK';
  exception
    when others then
      get stacked diagnostics
        v_error_message = message_text;

      if v_error_message =
           'WK_PUBLISHED_WORKING_SAVE_ROLLBACK' then
        v_test_succeeded := true;
      else
        raise;
      end if;
  end;

  perform set_config(
    'request.jwt.claim.role',
    'service_role',
    true
  );
  perform set_config(
    'request.jwt.claim.sub',
    '',
    true
  );

  if not v_test_succeeded then
    raise exception
      'STOP: Published working-save runtime test did not complete';
  end if;

  if (
    select article.wp_status
    from public.wk_articles article
    where article.id = v_article.id
  ) is distinct from v_article.wp_status then
    raise exception
      'STOP: Runtime verifier changed the Article status';
  end if;

  if (
    select resource.visibility
    from editorial.resources resource
    where resource.id = v_resource.id
  ) is distinct from v_resource.visibility
     or (
       select resource.lifecycle_state
       from editorial.resources resource
       where resource.id = v_resource.id
     ) is distinct from v_resource.lifecycle_state
     or (
       select resource.current_working_version_id
       from editorial.resources resource
       where resource.id = v_resource.id
     ) is distinct from v_resource.current_working_version_id then
    raise exception
      'STOP: Runtime verifier changed the resource state';
  end if;

  if (
    select article.draft_version
    from public.wk_articles article
    where article.id = v_article.id
  ) is distinct from v_article.draft_version then
    raise exception
      'STOP: Runtime verifier changed the draft version';
  end if;

  if (
    select count(*)
    from editorial.article_versions version
    where version.resource_id = v_resource.id
  ) <> v_original_version_count then
    raise exception
      'STOP: Runtime verifier persisted an Article version';
  end if;
end;
$verify$;

select
  'PASS: Manual Article saves advance the working version without changing publication status, resource visibility, or lifecycle state.'
    as verification_result;
