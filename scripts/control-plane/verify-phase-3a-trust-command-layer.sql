do $verify$
declare
  v_function_name text;
  v_identity_arguments text;
  v_definition text;
  v_security_definer boolean;
  v_config text[];
  v_public_execute boolean;
  v_anon_execute boolean;
  v_authenticated_execute boolean;
  v_service_execute boolean;
begin
  for
    v_function_name,
    v_identity_arguments
  in
    values
      (
        'create_source',
        'p_metadata jsonb, p_registry_links jsonb, p_correlation_id uuid'
      ),
      (
        'save_source_version',
        'p_source_id uuid, p_expected_working_revision bigint, p_metadata jsonb, p_registry_links jsonb, p_reason text, p_correlation_id uuid'
      ),
      (
        'submit_source_version_for_review',
        'p_source_id uuid, p_source_version_id uuid, p_expected_working_revision bigint, p_reason text, p_correlation_id uuid'
      ),
      (
        'review_source_version',
        'p_source_id uuid, p_source_version_id uuid, p_decision text, p_reason text, p_exposure_class text, p_correlation_id uuid'
      ),
      (
        'withdraw_source',
        'p_source_id uuid, p_reason text, p_withdrawal_public_mode text, p_correlation_id uuid'
      ),
      (
        'restore_source',
        'p_source_id uuid, p_reason text, p_correlation_id uuid'
      )
  loop
    select
      procedure.prosecdef,
      procedure.proconfig,
      pg_get_functiondef(procedure.oid),
      has_function_privilege(
        'public',
        procedure.oid,
        'EXECUTE'
      ),
      has_function_privilege(
        'anon',
        procedure.oid,
        'EXECUTE'
      ),
      has_function_privilege(
        'authenticated',
        procedure.oid,
        'EXECUTE'
      ),
      has_function_privilege(
        'service_role',
        procedure.oid,
        'EXECUTE'
      )
    into
      v_security_definer,
      v_config,
      v_definition,
      v_public_execute,
      v_anon_execute,
      v_authenticated_execute,
      v_service_execute
    from pg_proc procedure
    join pg_namespace namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = v_function_name
      and pg_get_function_identity_arguments(
            procedure.oid
          ) = v_identity_arguments;

    if not found then
      raise exception
        'STOP: public.% (%) does not exist',
        v_function_name,
        v_identity_arguments;
    end if;

    if not v_security_definer then
      raise exception
        'STOP: public.% is not SECURITY DEFINER',
        v_function_name;
    end if;

    if v_config is null
       or not exists (
         select 1
         from unnest(v_config) setting
         where setting like 'search_path=%'
       ) then
      raise exception
        'STOP: public.% does not have a fixed search path',
        v_function_name;
    end if;

    if v_public_execute or v_anon_execute then
      raise exception
        'STOP: public or anon can execute public.%',
        v_function_name;
    end if;

    if not v_authenticated_execute
       or not v_service_execute then
      raise exception
        'STOP: intended roles cannot execute public.%',
        v_function_name;
    end if;
  end loop;

  select pg_get_functiondef(
    'public.create_source(jsonb,jsonb,uuid)'::regprocedure
  )
  into v_definition;

  if position(
       'manage_sources'
       in v_definition
     ) = 0
     or position(
       'source_review_events'
       in v_definition
     ) = 0 then
    raise exception
      'STOP: create_source lacks Source capability or event authority';
  end if;

  select pg_get_functiondef(
    'public.save_source_version(uuid,bigint,jsonb,jsonb,text,uuid)'::regprocedure
  )
  into v_definition;

  if position('for update' in lower(v_definition)) = 0
     or position(
          'working_revision'
          in v_definition
        ) = 0
     or position(
          'content_fingerprint'
          in v_definition
        ) = 0 then
    raise exception
      'STOP: save_source_version lacks concurrency or fingerprint authority';
  end if;

  select pg_get_functiondef(
    'public.review_source_version(uuid,uuid,text,text,text,uuid)'::regprocedure
  )
  into v_definition;

  if position(
       'review_sources'
       in v_definition
     ) = 0
     or position(
       'current_approved_version_id'
       in v_definition
     ) = 0 then
    raise exception
      'STOP: review_source_version lacks review or approval authority';
  end if;

  select pg_get_functiondef(
    'public.withdraw_source(uuid,text,text,uuid)'::regprocedure
  )
  into v_definition;

  if position(
       'withdraw_sources'
       in v_definition
     ) = 0
     or position(
       'withdrawn_by'
       in v_definition
     ) = 0 then
    raise exception
      'STOP: withdraw_source lacks withdrawal authority';
  end if;

  select pg_get_functiondef(
    'public.restore_source(uuid,text,uuid)'::regprocedure
  )
  into v_definition;

  if position(
       'changes_requested'
       in v_definition
     ) = 0
     or position(
       'current_approved_version_id = null'
       in lower(v_definition)
     ) = 0 then
    raise exception
      'STOP: restore_source does not require fresh review';
  end if;

  raise notice
    'PASS: Phase 3A Source command layer verified.';
end;
$verify$;

do $citation_verify$
declare
  v_function_name text;
  v_identity_arguments text;
  v_definition text;
  v_security_definer boolean;
  v_config text[];
  v_public_execute boolean;
  v_anon_execute boolean;
  v_authenticated_execute boolean;
  v_service_execute boolean;
begin
  for
    v_function_name,
    v_identity_arguments
  in
    values
      (
        'create_citation',
        'p_source_id uuid, p_source_version_id uuid, p_locator_type text, p_locator_data jsonb, p_quotation text, p_editor_note text, p_public_label text, p_public_safe boolean'
      ),
      (
        'attach_article_version_citation',
        'p_article_version_id uuid, p_citation_id uuid, p_citation_purpose text, p_target_anchor_type text, p_target_anchor_data jsonb, p_display_order integer, p_public_safe boolean, p_expected_citation_revision bigint'
      ),
      (
        'replace_article_version_citations',
        'p_article_version_id uuid, p_attachments jsonb, p_expected_citation_revision bigint, p_correlation_id uuid'
      )
  loop
    select
      procedure.prosecdef,
      procedure.proconfig,
      pg_get_functiondef(procedure.oid),
      has_function_privilege(
        'public',
        procedure.oid,
        'EXECUTE'
      ),
      has_function_privilege(
        'anon',
        procedure.oid,
        'EXECUTE'
      ),
      has_function_privilege(
        'authenticated',
        procedure.oid,
        'EXECUTE'
      ),
      has_function_privilege(
        'service_role',
        procedure.oid,
        'EXECUTE'
      )
    into
      v_security_definer,
      v_config,
      v_definition,
      v_public_execute,
      v_anon_execute,
      v_authenticated_execute,
      v_service_execute
    from pg_proc procedure
    join pg_namespace namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = v_function_name
      and pg_get_function_identity_arguments(
            procedure.oid
          ) = v_identity_arguments;

    if not found then
      raise exception
        'STOP: public.% (%) does not exist',
        v_function_name,
        v_identity_arguments;
    end if;

    if not v_security_definer then
      raise exception
        'STOP: public.% is not SECURITY DEFINER',
        v_function_name;
    end if;

    if v_config is null
       or not exists (
         select 1
         from unnest(v_config) setting
         where setting like 'search_path=%'
       ) then
      raise exception
        'STOP: public.% does not have a fixed search path',
        v_function_name;
    end if;

    if v_public_execute or v_anon_execute then
      raise exception
        'STOP: public or anon can execute public.%',
        v_function_name;
    end if;

    if not v_authenticated_execute
       or not v_service_execute then
      raise exception
        'STOP: intended roles cannot execute public.%',
        v_function_name;
    end if;

    if position(
         'manage_citations'
         in v_definition
       ) = 0
       and position(
         'assert_citation_command_actor'
         in v_definition
       ) = 0 then
      raise exception
        'STOP: public.% lacks Citation authority',
        v_function_name;
    end if;
  end loop;

  select pg_get_functiondef(
    'public.create_citation(uuid,uuid,text,jsonb,text,text,text,boolean)'::regprocedure
  )
  into v_definition;

  if position(
       'validate_citation_locator'
       in v_definition
     ) = 0
     or position(
       'current_approved_version_id'
       in v_definition
     ) = 0
     or position(
       'public_redacted'
       in v_definition
     ) = 0 then
    raise exception
      'STOP: create_citation lacks locator or public-safety authority';
  end if;

  select pg_get_functiondef(
    'public.attach_article_version_citation(uuid,uuid,text,text,jsonb,integer,boolean,bigint)'::regprocedure
  )
  into v_definition;

  if position(
       'current_user_can_edit_article'
       in v_definition
     ) = 0
     or position(
       'for update'
       in lower(v_definition)
     ) = 0
     or position(
       'citation_revision'
       in v_definition
     ) = 0
     or position(
       'validate_citation_target_anchor'
       in v_definition
     ) = 0 then
    raise exception
      'STOP: attach_article_version_citation lacks Article, revision, or anchor authority';
  end if;

  select pg_get_functiondef(
    'public.replace_article_version_citations(uuid,jsonb,bigint,uuid)'::regprocedure
  )
  into v_definition;

  if position(
       'jsonb_typeof(p_attachments)'
       in v_definition
     ) = 0
     or position(
       'for update'
       in lower(v_definition)
     ) = 0
     or position(
       'current_user_can_edit_article'
       in v_definition
     ) = 0
     or position(
       'display order must be zero-based and contiguous'
       in lower(v_definition)
     ) = 0
     or position(
       'delete from editorial.resource_citations'
       in lower(v_definition)
     ) = 0 then
    raise exception
      'STOP: replace_article_version_citations lacks payload, concurrency, ordering, or replacement authority';
  end if;

  if position(
       'credit_revision ='
       in lower(v_definition)
     ) > 0 then
    raise exception
      'STOP: Citation replacement mutates Credit revision';
  end if;

  raise notice
    'PASS: Phase 3A Citation command layer verified.';
end;
$citation_verify$;

do $credit_identity_verify$
declare
  v_function_name text;
  v_identity_arguments text;
  v_definition text;
  v_security_definer boolean;
  v_config text[];
  v_public_execute boolean;
  v_anon_execute boolean;
  v_authenticated_execute boolean;
  v_service_execute boolean;
begin
  for
    v_function_name,
    v_identity_arguments
  in
    values
      (
        'create_external_contributor',
        'p_display_name text, p_public_role text, p_public_url text, p_location_text text, p_contact_email text, p_contact_phone text, p_consent_status text, p_public_safe boolean, p_internal_notes text'
      ),
      (
        'update_external_contributor',
        'p_external_contributor_id uuid, p_display_name text, p_public_role text, p_public_url text, p_location_text text, p_contact_email text, p_contact_phone text, p_consent_status text, p_public_safe boolean, p_contributor_state text, p_internal_notes text'
      ),
      (
        'create_credit',
        'p_credit_role text, p_user_id uuid, p_registry_author_id uuid, p_external_contributor_id uuid, p_role_label_override text, p_credit_note text, p_public_safe boolean'
      ),
      (
        'set_credit_governance',
        'p_credit_id uuid, p_credit_state text, p_public_safe boolean, p_expected_governance_revision bigint, p_reason text'
      )
  loop
    select
      procedure.prosecdef,
      procedure.proconfig,
      pg_get_functiondef(procedure.oid),
      has_function_privilege(
        'public',
        procedure.oid,
        'EXECUTE'
      ),
      has_function_privilege(
        'anon',
        procedure.oid,
        'EXECUTE'
      ),
      has_function_privilege(
        'authenticated',
        procedure.oid,
        'EXECUTE'
      ),
      has_function_privilege(
        'service_role',
        procedure.oid,
        'EXECUTE'
      )
    into
      v_security_definer,
      v_config,
      v_definition,
      v_public_execute,
      v_anon_execute,
      v_authenticated_execute,
      v_service_execute
    from pg_proc procedure
    join pg_namespace namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = v_function_name
      and pg_get_function_identity_arguments(
            procedure.oid
          ) = v_identity_arguments;

    if not found then
      raise exception
        'STOP: public.% (%) does not exist',
        v_function_name,
        v_identity_arguments;
    end if;

    if not v_security_definer then
      raise exception
        'STOP: public.% is not SECURITY DEFINER',
        v_function_name;
    end if;

    if v_config is null
       or not exists (
         select 1
         from unnest(v_config) setting
         where setting like 'search_path=%'
       ) then
      raise exception
        'STOP: public.% does not have a fixed search path',
        v_function_name;
    end if;

    if v_public_execute or v_anon_execute then
      raise exception
        'STOP: public or anon can execute public.%',
        v_function_name;
    end if;

    if not v_authenticated_execute
       or not v_service_execute then
      raise exception
        'STOP: intended roles cannot execute public.%',
        v_function_name;
    end if;

    if position(
         'assert_credit_command_actor'
         in v_definition
       ) = 0 then
      raise exception
        'STOP: public.% lacks Credit authority',
        v_function_name;
    end if;
  end loop;

  select pg_get_functiondef(
    'public.create_credit(text,uuid,uuid,uuid,text,text,boolean)'::regprocedure
  )
  into v_definition;

  if position(
       'num_nonnulls'
       in v_definition
     ) = 0
     or position(
       'user_profiles'
       in v_definition
     ) = 0
     or position(
       'registry_authors'
       in v_definition
     ) = 0
     or position(
       'external_contributors'
       in v_definition
     ) = 0
     or position(
       'credit_governance'
       in v_definition
     ) = 0 then
    raise exception
      'STOP: create_credit lacks identity resolution or governance creation';
  end if;

  if not exists (
    select 1
    from information_schema.columns column_record
    where column_record.table_schema = 'editorial'
      and column_record.table_name = 'credits'
      and column_record.column_name =
        'registry_author_slug_snapshot'
  ) then
    raise exception
      'STOP: Credit Registry-author slug snapshot column is missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns column_record
    where column_record.table_schema = 'editorial'
      and column_record.table_name = 'credits'
      and column_record.column_name =
        'user_username_snapshot'
  ) then
    raise exception
      'STOP: Credit authenticated-user username snapshot column is missing';
  end if;

  select pg_get_functiondef(
    'public.create_credit(text,uuid,uuid,uuid,text,text,boolean)'::regprocedure
  )
  into v_definition;

  if position(
       'registry_author_slug_snapshot'
       in v_definition
     ) = 0
     or position(
       'user_username_snapshot'
       in v_definition
     ) = 0 then
    raise exception
      'STOP: create_credit does not persist separate identity snapshots';
  end if;

  if position(
       'coalesce(nullif(btrim(p_role_label_override)'
       in replace(
         replace(v_definition, E'\n', ''),
         ' ',
         ''
       )
     ) > 0 then
    raise exception
      'STOP: role_label_snapshot is overloaded with identity snapshots';
  end if;

  select pg_get_functiondef(
    'public.set_credit_governance(uuid,text,boolean,bigint,text)'::regprocedure
  )
  into v_definition;

  if position(
       'for update'
       in lower(v_definition)
     ) = 0
     or position(
       'governance_revision'
       in v_definition
     ) = 0
     or position(
       'granted'
       in v_definition
     ) = 0
     or position(
       'not_required'
       in v_definition
     ) = 0 then
    raise exception
      'STOP: set_credit_governance lacks revision or consent authority';
  end if;

  raise notice
    'PASS: Phase 3A Credit identity and governance commands verified.';
end;
$credit_identity_verify$;

do $credit_attachment_verify$
declare
  v_function_name text;
  v_identity_arguments text;
  v_definition text;
  v_security_definer boolean;
  v_config text[];
  v_public_execute boolean;
  v_anon_execute boolean;
  v_authenticated_execute boolean;
  v_service_execute boolean;
  v_command_count integer;
begin
  for
    v_function_name,
    v_identity_arguments
  in
    values
      (
        'attach_article_version_credit',
        'p_article_version_id uuid, p_credit_id uuid, p_display_order integer, p_is_primary boolean, p_public_safe boolean, p_expected_credit_revision bigint'
      ),
      (
        'replace_article_version_credits',
        'p_article_version_id uuid, p_attachments jsonb, p_expected_credit_revision bigint, p_correlation_id uuid'
      )
  loop
    select
      procedure.prosecdef,
      procedure.proconfig,
      pg_get_functiondef(procedure.oid),
      has_function_privilege(
        'public',
        procedure.oid,
        'EXECUTE'
      ),
      has_function_privilege(
        'anon',
        procedure.oid,
        'EXECUTE'
      ),
      has_function_privilege(
        'authenticated',
        procedure.oid,
        'EXECUTE'
      ),
      has_function_privilege(
        'service_role',
        procedure.oid,
        'EXECUTE'
      )
    into
      v_security_definer,
      v_config,
      v_definition,
      v_public_execute,
      v_anon_execute,
      v_authenticated_execute,
      v_service_execute
    from pg_proc procedure
    join pg_namespace namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname = v_function_name
      and pg_get_function_identity_arguments(
            procedure.oid
          ) = v_identity_arguments;

    if not found then
      raise exception
        'STOP: public.% (%) does not exist',
        v_function_name,
        v_identity_arguments;
    end if;

    if not v_security_definer then
      raise exception
        'STOP: public.% is not SECURITY DEFINER',
        v_function_name;
    end if;

    if v_config is null
       or not exists (
         select 1
         from unnest(v_config) setting
         where setting like 'search_path=%'
       ) then
      raise exception
        'STOP: public.% does not have a fixed search path',
        v_function_name;
    end if;

    if v_public_execute or v_anon_execute then
      raise exception
        'STOP: public or anon can execute public.%',
        v_function_name;
    end if;

    if not v_authenticated_execute
       or not v_service_execute then
      raise exception
        'STOP: intended roles cannot execute public.%',
        v_function_name;
    end if;

    if position(
         'assert_credit_command_actor'
         in v_definition
       ) = 0
       or position(
         'current_user_can_edit_article'
         in v_definition
       ) = 0
       or position(
         'credit_revision'
         in v_definition
       ) = 0
       or position(
         'for update'
         in lower(v_definition)
       ) = 0 then
      raise exception
        'STOP: public.% lacks Credit, Article, or revision authority',
        v_function_name;
    end if;
  end loop;

  select pg_get_functiondef(
    'public.attach_article_version_credit(uuid,uuid,integer,boolean,boolean,bigint)'::regprocedure
  )
  into v_definition;

  if position(
       'single credit attachment must append'
       in lower(v_definition)
     ) = 0
     or position(
       'at most one primary author'
       in lower(v_definition)
     ) = 0
     or position(
       'credit_governance'
       in v_definition
     ) = 0 then
    raise exception
      'STOP: attach_article_version_credit lacks append, primary-author, or governance authority';
  end if;

  select pg_get_functiondef(
    'public.replace_article_version_credits(uuid,jsonb,bigint,uuid)'::regprocedure
  )
  into v_definition;

  if position(
       'jsonb_typeof(p_attachments)'
       in v_definition
     ) = 0
     or position(
       'display order must be zero-based and contiguous'
       in lower(v_definition)
     ) = 0
     or position(
       'at most one primary author'
       in lower(v_definition)
     ) = 0
     or position(
       'delete from editorial.resource_credits'
       in lower(v_definition)
     ) = 0 then
    raise exception
      'STOP: replace_article_version_credits lacks payload, ordering, primary-author, or replacement authority';
  end if;

  if position(
       'citation_revision ='
       in lower(v_definition)
     ) > 0 then
    raise exception
      'STOP: Credit replacement mutates Citation revision';
  end if;

  select count(*)
  into v_command_count
  from pg_proc procedure
  join pg_namespace namespace
    on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname in (
      'create_source',
      'save_source_version',
      'submit_source_version_for_review',
      'review_source_version',
      'withdraw_source',
      'restore_source',
      'create_citation',
      'attach_article_version_citation',
      'replace_article_version_citations',
      'create_external_contributor',
      'update_external_contributor',
      'create_credit',
      'set_credit_governance',
      'attach_article_version_credit',
      'replace_article_version_credits'
    );

  if v_command_count <> 15 then
    raise exception
      'STOP: Expected 15 Migration 3 commands, found %',
      v_command_count;
  end if;

  raise notice
    'PASS: Complete Phase 3A command layer verified with 15 commands.';
end;
$credit_attachment_verify$;
