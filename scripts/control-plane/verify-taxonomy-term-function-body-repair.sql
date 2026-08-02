select set_config(
  'request.jwt.claim.role',
  'service_role',
  true
);

do $verify$
declare
  v_function_oid oid;
  v_definition text;
  v_admin_user_id uuid;
  v_test_slug text :=
    'wk-taxonomy-verifier-' ||
    replace(gen_random_uuid()::text, '-', '');
  v_returned_id uuid;
  v_returned_slug text;
  v_call_succeeded boolean := false;
  v_error_message text;
begin
  v_function_oid :=
    to_regprocedure(
      'public.create_taxonomy_term(text,text,text,text,text,text,text)'
    );

  if v_function_oid is null then
    raise exception
      'STOP: Canonical create_taxonomy_term function is missing';
  end if;

  if (
    select count(*)
    from pg_proc procedure
    join pg_namespace namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = 'create_taxonomy_term'
  ) <> 1 then
    raise exception
      'STOP: create_taxonomy_term is overloaded again';
  end if;

  select pg_get_functiondef(v_function_oid)
  into v_definition;

  if position(
       'existing_term.slug = p_slug'
       in v_definition
     ) = 0
     or position(
          'existing_term.taxonomy = p_taxonomy'
          in v_definition
        ) = 0 then
    raise exception
      'STOP: Duplicate detection does not qualify registry columns';
  end if;

  if position(
       'returning inserted_term.id'
       in lower(v_definition)
     ) = 0 then
    raise exception
      'STOP: Insert return value does not qualify the registry id';
  end if;

  if position(
       'when ''category'' then ''manage_categories'''
       in lower(v_definition)
     ) = 0
     or position(
          'when ''post_tag'' then ''manage_tags'''
          in lower(v_definition)
        ) = 0 then
    raise exception
      'STOP: Taxonomy-specific capability mapping is incomplete';
  end if;

  if not has_function_privilege(
       'authenticated',
       v_function_oid,
       'EXECUTE'
     ) then
    raise exception
      'STOP: Authenticated role cannot execute create_taxonomy_term';
  end if;

  if has_function_privilege(
       'anon',
       v_function_oid,
       'EXECUTE'
     ) then
    raise exception
      'STOP: Anonymous role can execute create_taxonomy_term';
  end if;

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
      'STOP: No active administrator exists for the rollback-safe runtime test';
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
    select
      created.id,
      created.slug
    into
      v_returned_id,
      v_returned_slug
    from public.create_taxonomy_term(
      'post_tag',
      v_test_slug,
      'WAKILISHA Taxonomy Verifier',
      null,
      null,
      null,
      null
    ) created;

    if v_returned_id is null
       or v_returned_slug is distinct from v_test_slug then
      raise exception
        'STOP: Runtime taxonomy creation returned an invalid row';
    end if;

    raise exception using
      errcode = 'P0001',
      message = 'WK_TAXONOMY_VERIFIER_ROLLBACK';
  exception
    when others then
      get stacked diagnostics
        v_error_message = message_text;

      if v_error_message =
           'WK_TAXONOMY_VERIFIER_ROLLBACK' then
        v_call_succeeded := true;
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

  if not v_call_succeeded then
    raise exception
      'STOP: Runtime taxonomy creation did not complete';
  end if;

  if exists (
    select 1
    from public.registry_taxonomy_terms term
    where term.slug = v_test_slug
  ) then
    raise exception
      'STOP: Runtime verifier term escaped its rollback';
  end if;
end;
$verify$;

select
  'PASS: create_taxonomy_term qualifies registry columns, applies taxonomy-specific capabilities, and creates a post tag under an authenticated administrator without persisting verifier data.'
    as verification_result;
