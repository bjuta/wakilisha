\set ON_ERROR_STOP on

-- Verify People / Contributor Identity Migration C:
-- Person Follow + one-source Person adoption.
--
-- All runtime fixtures are rollback-only.
-- Production content must be byte-equivalent after this verifier exits.

begin;

do $verify_people_migration_c_structure$
declare
  v_definition text;
begin
  if to_regprocedure(
       'editorial.resolve_person_follow_target(uuid)'
     ) is null
     or to_regprocedure(
       'public.community_get_person_follow_state(uuid)'
     ) is null
     or to_regprocedure(
       'public.get_public_person_social_summary(uuid)'
     ) is null
  then
    raise exception
      'STOP: Migration C Person Follow read/normalization surface is incomplete';
  end if;

  if has_function_privilege(
       'anon',
       'editorial.resolve_person_follow_target(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'editorial.resolve_person_follow_target(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'editorial.resolve_person_follow_target(uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: private Person Follow resolver grants are invalid';
  end if;

  if has_function_privilege(
       'anon',
       'public.community_get_person_follow_state(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.community_get_person_follow_state(uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: viewer Person Follow-state grants are invalid';
  end if;

  if not has_function_privilege(
       'anon',
       'public.get_public_person_social_summary(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.get_public_person_social_summary(uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: public Person social-summary grants are invalid';
  end if;

  if has_function_privilege(
       'anon',
       'public.community_set_follow_state(text,text,text,boolean)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.community_follow_target(text,text,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.community_set_follow_state(text,text,text,boolean)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.community_follow_target(text,text,text)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: governed Follow write grants are invalid';
  end if;

  if has_table_privilege(
       'anon',
       'public.community_follows',
       'SELECT'
     )
     or has_table_privilege(
       'anon',
       'public.community_follows',
       'INSERT'
     )
     or has_table_privilege(
       'anon',
       'public.community_follows',
       'UPDATE'
     )
     or has_table_privilege(
       'anon',
       'public.community_follows',
       'DELETE'
     )
     or has_table_privilege(
       'authenticated',
       'public.community_follows',
       'SELECT'
     )
     or has_table_privilege(
       'authenticated',
       'public.community_follows',
       'INSERT'
     )
     or has_table_privilege(
       'authenticated',
       'public.community_follows',
       'UPDATE'
     )
     or has_table_privilege(
       'authenticated',
       'public.community_follows',
       'DELETE'
     )
  then
    raise exception
      'STOP: browser role can bypass governed Follow RPCs';
  end if;

  if not has_table_privilege(
       'service_role',
       'public.community_follows',
       'SELECT'
     )
     or not has_table_privilege(
       'service_role',
       'public.community_follows',
       'INSERT'
     )
     or not has_table_privilege(
       'service_role',
       'public.community_follows',
       'UPDATE'
     )
     or not has_table_privilege(
       'service_role',
       'public.community_follows',
       'DELETE'
     )
  then
    raise exception
      'STOP: existing trusted service-role Follow authority changed';
  end if;

  if md5(
       pg_get_functiondef(
         'public.community_get_user_follows(uuid)'::regprocedure
       )
     ) <>
     'cdbfca495b27c6b2b240c2958d68e381'
  then
    raise exception
      'STOP: existing private generic Follow reader changed in Migration C';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid =
          'public.user_profiles'::regclass
      and trigger_row.tgname =
          'user_profiles_person_provisioning'
      and trigger_row.tgdeferrable
      and trigger_row.tginitdeferred
      and not trigger_row.tgisinternal
  )
     or not exists (
       select 1
       from pg_trigger trigger_row
       where trigger_row.tgrelid =
             'public.registry_authors'::regclass
         and trigger_row.tgname =
             'registry_authors_person_provisioning'
         and trigger_row.tgdeferrable
         and trigger_row.tginitdeferred
         and not trigger_row.tgisinternal
     )
     or not exists (
       select 1
       from pg_trigger trigger_row
       where trigger_row.tgrelid =
             'editorial.external_contributors'::regclass
         and trigger_row.tgname =
             'external_contributors_person_provisioning'
         and trigger_row.tgdeferrable
         and trigger_row.tginitdeferred
         and not trigger_row.tgisinternal
     )
  then
    raise exception
      'STOP: deferred one-source Person provisioning hooks are incomplete';
  end if;

  if exists (
    select 1
    from public.user_profiles profile
    left join editorial.person_identity_links link
      on link.user_id = profile.user_id
     and link.link_state = 'active'
    where link.id is null
  )
     or exists (
       select 1
       from public.registry_authors author
       left join editorial.person_identity_links link
         on link.registry_author_id = author.id
        and link.link_state = 'active'
       where link.id is null
     )
     or exists (
       select 1
       from editorial.external_contributors contributor
       left join editorial.person_identity_links link
         on link.external_contributor_id = contributor.id
        and link.link_state = 'active'
       where link.id is null
     )
  then
    raise exception
      'STOP: Migration C source adoption left an unlinked source identity';
  end if;

  if not exists (
    select 1
    from private.phase_0a_rpc_classification
    where function_signature =
          'get_public_person_social_summary(uuid)'
      and access_class =
          'public_read'
  )
     or not exists (
       select 1
       from private.phase_0a_rpc_classification
       where function_signature =
             'community_get_person_follow_state(uuid)'
         and access_class =
             'authenticated_read'
     )
  then
    raise exception
      'STOP: Migration C public/authenticated read classification is incomplete';
  end if;

  v_definition :=
    lower(
      pg_get_functiondef(
        'public.community_set_follow_state(text,text,text,boolean)'::regprocedure
      )
    );

  if position(
       'resolve_person_follow_target'
       in v_definition
     ) = 0
     or position(
       'a user cannot follow their own person'
       in v_definition
     ) = 0
  then
    raise exception
      'STOP: Person validation or self-follow rejection is missing from setter';
  end if;

  v_definition :=
    lower(
      pg_get_functiondef(
        'public.community_follow_target(text,text,text)'::regprocedure
      )
    );

  if position(
       'resolve_person_follow_target'
       in v_definition
     ) = 0
     or position(
       'select exists'
       in v_definition
     ) = 0
  then
    raise exception
      'STOP: Person-aware toggle normalization is missing';
  end if;
end;
$verify_people_migration_c_structure$;


insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-00000000c001',
    'authenticated',
    'authenticated',
    'people-c-verifier-viewer@local.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"People C Verifier Viewer"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-00000000c002',
    'authenticated',
    'authenticated',
    'people-c-verifier-target@local.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"People C Verifier Target"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-00000000c003',
    'authenticated',
    'authenticated',
    'people-c-verifier-private@local.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"People C Verifier Private"}'::jsonb,
    now(),
    now()
  );


do $verify_people_migration_c_runtime$
declare
  v_viewer constant uuid :=
    '00000000-0000-4000-8000-00000000c001';
  v_target_user constant uuid :=
    '00000000-0000-4000-8000-00000000c002';
  v_private_user constant uuid :=
    '00000000-0000-4000-8000-00000000c003';
  v_deferred_user constant uuid :=
    '00000000-0000-4000-8000-00000000c004';

  v_viewer_person uuid;
  v_target_person uuid;
  v_private_person uuid;
  v_deferred_person uuid;
  v_target_path text;

  v_merge_source constant uuid :=
    '00000000-0000-4000-8000-00000000c101';
  v_merge_target constant uuid :=
    '00000000-0000-4000-8000-00000000c102';
  v_archived_person constant uuid :=
    '00000000-0000-4000-8000-00000000c103';
  v_nonperson_resource constant uuid :=
    '00000000-0000-4000-8000-00000000c104';

  v_registry_author constant uuid :=
    '00000000-0000-4000-8000-00000000c201';
  v_external_contributor constant uuid :=
    '00000000-0000-4000-8000-00000000c202';

  v_result jsonb;
  v_state jsonb;
  v_summary jsonb;

  v_follow_hash_before text;
  v_follow_hash_after text;
  v_nonperson_follow_hash_before text;
  v_nonperson_follow_hash_after text;
  v_credit_hash_before text;
  v_credit_hash_after text;

  v_rejected boolean;
  v_first_person uuid;
  v_second_person uuid;
  v_registry_person uuid;
  v_external_person uuid;
begin
  select md5(
    coalesce(
      jsonb_agg(
        to_jsonb(follow_row)
        order by follow_row.id
      )::text,
      '[]'
    )
  )
  into v_follow_hash_before
  from public.community_follows follow_row;

  select md5(
    coalesce(
      jsonb_agg(
        to_jsonb(follow_row)
        order by follow_row.id
      )::text,
      '[]'
    )
  )
  into v_nonperson_follow_hash_before
  from public.community_follows follow_row
  where follow_row.target_type <>
        'person';

  select md5(
    coalesce(
      jsonb_agg(
        to_jsonb(credit)
        order by credit.id
      )::text,
      '[]'
    )
  )
  into v_credit_hash_before
  from editorial.credits credit;

  perform set_config(
    'request.jwt.claim.role',
    'authenticated',
    true
  );
  perform set_config(
    'request.jwt.claim.sub',
    v_viewer::text,
    true
  );
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'role',
        'authenticated',
      'sub',
        v_viewer
    )::text,
    true
  );

  perform public.community_ensure_user_account(
    v_viewer
  );

  select link.person_resource_id
  into v_viewer_person
  from editorial.person_identity_links link
  where link.user_id =
        v_viewer
    and link.link_state =
        'active';

  if v_viewer_person is null then
    raise exception
      'STOP: account runtime provisioning did not create viewer Person';
  end if;

  v_first_person :=
    editorial.ensure_person_for_user(
      v_viewer
    );
  v_second_person :=
    editorial.ensure_person_for_user(
      v_viewer
    );

  if v_first_person is distinct from
     v_viewer_person
     or v_second_person is distinct from
        v_viewer_person
     or (
       select count(*)
       from editorial.person_identity_links link
       where link.user_id =
             v_viewer
         and link.link_state =
             'active'
     ) <> 1
  then
    raise exception
      'STOP: account one-source Person provisioning is not idempotent';
  end if;

  perform set_config(
    'request.jwt.claim.sub',
    v_target_user::text,
    true
  );
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'role',
        'authenticated',
      'sub',
        v_target_user
    )::text,
    true
  );

  perform public.community_ensure_user_account(
    v_target_user
  );

  select link.person_resource_id
  into v_target_person
  from editorial.person_identity_links link
  where link.user_id =
        v_target_user
    and link.link_state =
        'active';

  if v_target_person is null then
    raise exception
      'STOP: account runtime provisioning did not create target Person';
  end if;

  select alias.path
  into v_target_path
  from editorial.resource_aliases alias
  where alias.resource_id =
        v_target_person
    and alias.is_canonical
    and alias.retired_at is null;

  perform set_config(
    'request.jwt.claim.sub',
    v_private_user::text,
    true
  );
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'role',
        'authenticated',
      'sub',
        v_private_user
    )::text,
    true
  );

  perform public.community_ensure_user_account(
    v_private_user
  );

  select link.person_resource_id
  into v_private_person
  from editorial.person_identity_links link
  where link.user_id =
        v_private_user
    and link.link_state =
        'active';

  update public.user_profiles
  set
    is_public =
      false,
    updated_at =
      now()
  where user_id =
        v_private_user;

  if (
    select resource.visibility
    from editorial.resources resource
    where resource.id =
          v_private_person
  ) <> 'internal'
  then
    raise exception
      'STOP: Migration A account privacy synchronization was not preserved';
  end if;

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    v_deferred_user,
    'authenticated',
    'authenticated',
    'people-c-verifier-deferred@local.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"People C Verifier Deferred"}'::jsonb,
    now(),
    now()
  );

  insert into public.user_profiles (
    user_id,
    email,
    display_name,
    status,
    metadata,
    is_public,
    username,
    username_normalized
  )
  values (
    v_deferred_user,
    'people-c-verifier-deferred@local.invalid',
    'People C Verifier Deferred',
    'active',
    '{"fixture":"people_migration_c_deferred"}'::jsonb,
    true,
    'people_c_verifier_deferred',
    'people_c_verifier_deferred'
  )
  on conflict (user_id)
  do update
  set
    display_name = excluded.display_name,
    status = 'active',
    is_public = true,
    username = excluded.username,
    username_normalized = excluded.username_normalized,
    updated_at = now();

  execute
    'set constraints public.user_profiles_person_provisioning immediate';

  select link.person_resource_id
  into v_deferred_person
  from editorial.person_identity_links link
  where link.user_id =
        v_deferred_user
    and link.link_state =
        'active';

  if v_deferred_person is null
     or (
       select count(*)
       from editorial.person_identity_links link
       where link.user_id =
             v_deferred_user
         and link.link_state =
             'active'
     ) <> 1
  then
    raise exception
      'STOP: deferred account-profile Person provisioning did not create exactly one Person';
  end if;

  perform set_config(
    'request.jwt.claim.sub',
    v_viewer::text,
    true
  );
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'role',
        'authenticated',
      'sub',
        v_viewer
    )::text,
    true
  );

  v_result :=
    public.community_set_follow_state(
      'artist',
      'people-c-verifier-artist',
      'people-c-verifier-artist',
      true
    );

  if (
       v_result
         ->> 'followed'
     )::boolean is distinct from true
     or not exists (
       select 1
       from public.community_follows follow
       where follow.user_id =
             v_viewer
         and follow.target_type =
             'artist'
         and follow.target_id =
             'people-c-verifier-artist'
     )
  then
    raise exception
      'STOP: existing Artist Follow setter behavior changed';
  end if;

  v_result :=
    public.community_follow_target(
      'artist',
      'people-c-verifier-artist',
      'people-c-verifier-artist'
    );

  if (
       v_result
         ->> 'followed'
     )::boolean is distinct from false
     or exists (
       select 1
       from public.community_follows follow
       where follow.user_id =
             v_viewer
         and follow.target_type =
             'artist'
         and follow.target_id =
             'people-c-verifier-artist'
     )
  then
    raise exception
      'STOP: existing Artist Follow toggle behavior changed';
  end if;

  v_rejected :=
    false;
  begin
    perform public.community_set_follow_state(
      'person',
      'not-a-uuid',
      'caller-controlled',
      true
    );
  exception
    when others then
      v_rejected :=
        true;
  end;

  if not v_rejected then
    raise exception
      'STOP: malformed Person Follow target was accepted';
  end if;

  insert into editorial.resources (
    id,
    resource_kind,
    visibility,
    lifecycle_state,
    created_by
  )
  values (
    v_nonperson_resource,
    'article',
    'public',
    'published',
    v_viewer
  );

  v_rejected :=
    false;
  begin
    perform public.community_set_follow_state(
      'person',
      v_nonperson_resource::text,
      'caller-controlled',
      true
    );
  exception
    when others then
      v_rejected :=
        true;
  end;

  if not v_rejected then
    raise exception
      'STOP: non-Person Resource UUID was accepted as Person Follow target';
  end if;

  v_rejected :=
    false;
  begin
    perform public.community_set_follow_state(
      'person',
      v_private_person::text,
      'caller-controlled',
      true
    );
  exception
    when others then
      v_rejected :=
        true;
  end;

  if not v_rejected then
    raise exception
      'STOP: internal/private Person Follow creation was accepted';
  end if;

  v_rejected :=
    false;
  begin
    perform public.community_set_follow_state(
      'person',
      v_viewer_person::text,
      'caller-controlled',
      true
    );
  exception
    when others then
      v_rejected :=
        true;
  end;

  if not v_rejected then
    raise exception
      'STOP: self-follow creation was accepted';
  end if;

  v_result :=
    public.community_set_follow_state(
      'person',
      v_target_person::text,
      'caller-controlled',
      true
    );

  if coalesce(
       (
         v_result
           ->> 'followed'
       )::boolean,
       false
     ) is distinct from true
  then
    raise exception
      'STOP: valid public Person Follow did not succeed';
  end if;

  if not exists (
    select 1
    from public.community_follows follow
    where follow.user_id =
          v_viewer
      and follow.target_type =
          'person'
      and follow.target_id =
          v_target_person::text
      and follow.target_slug =
          split_part(
            v_target_path,
            '/',
            3
          )
  ) then
    raise exception
      'STOP: Person Follow did not persist canonical Person identity/slug';
  end if;

  v_state :=
    public.community_get_person_follow_state(
      v_target_person
    );

  if (
       v_state
         ->> 'person_id'
     )::uuid is distinct from
     v_target_person
     or (
       v_state
         ->> 'followed'
     )::boolean is distinct from true
     or (
       select count(*)
       from jsonb_object_keys(
         v_state
       )
     ) <> 2
  then
    raise exception
      'STOP: viewer Person Follow state is not narrow/correct';
  end if;

  v_summary :=
    public.get_public_person_social_summary(
      v_target_person
    );

  if (
       v_summary
         ->> 'person_id'
     )::uuid is distinct from
     v_target_person
     or (
       v_summary
         ->> 'follower_count'
     )::integer <> 1
     or (
       select count(*)
       from jsonb_object_keys(
         v_summary
       )
     ) <> 2
  then
    raise exception
      'STOP: public Person social summary is not aggregate-only/correct';
  end if;

  v_rejected :=
    false;
  begin
    perform public.community_get_user_follows(
      v_target_user
    );
  exception
    when others then
      v_rejected :=
        true;
  end;

  if not v_rejected then
    raise exception
      'STOP: generic Follow reader exposed another user''s state';
  end if;

  v_result :=
    public.community_set_follow_state(
      'person',
      v_target_person::text,
      null,
      false
    );

  if (
       v_result
         ->> 'followed'
     )::boolean is distinct from false
     or exists (
       select 1
       from public.community_follows follow
       where follow.user_id =
             v_viewer
         and follow.target_type =
             'person'
         and follow.target_id =
             v_target_person::text
     )
  then
    raise exception
      'STOP: Person unfollow did not succeed';
  end if;

  insert into editorial.resources (
    id,
    resource_kind,
    visibility,
    lifecycle_state,
    created_by
  )
  values
    (
      v_merge_source,
      'person',
      'internal',
      'active',
      v_viewer
    ),
    (
      v_merge_target,
      'person',
      'public',
      'active',
      v_viewer
    ),
    (
      v_archived_person,
      'person',
      'internal',
      'archived',
      v_viewer
    );

  insert into editorial.people (
    resource_id,
    resource_kind,
    person_state,
    identity_revision,
    merged_into_person_resource_id,
    created_by,
    updated_by
  )
  values
    (
      v_merge_source,
      'person',
      'merged',
      1,
      v_merge_target,
      v_viewer,
      v_viewer
    ),
    (
      v_merge_target,
      'person',
      'active',
      1,
      null,
      v_viewer,
      v_viewer
    ),
    (
      v_archived_person,
      'person',
      'archived',
      1,
      null,
      v_viewer,
      v_viewer
    );

  insert into editorial.resource_aliases (
    resource_id,
    path,
    is_canonical,
    created_by
  )
  values
    (
      v_merge_source,
      '/people/people-c-verifier-merged-source',
      true,
      v_viewer
    ),
    (
      v_merge_target,
      '/people/people-c-verifier-merged-target',
      true,
      v_viewer
    ),
    (
      v_archived_person,
      '/people/people-c-verifier-archived',
      true,
      v_viewer
    );

  v_rejected :=
    false;
  begin
    perform public.community_set_follow_state(
      'person',
      v_archived_person::text,
      null,
      true
    );
  exception
    when others then
      v_rejected :=
        true;
  end;

  if not v_rejected then
    raise exception
      'STOP: archived Person Follow creation was accepted';
  end if;

  v_result :=
    public.community_set_follow_state(
      'person',
      v_merge_source::text,
      'caller-controlled',
      true
    );

  if not exists (
    select 1
    from public.community_follows follow
    where follow.user_id =
          v_viewer
      and follow.target_type =
          'person'
      and follow.target_id =
          v_merge_target::text
      and follow.target_slug =
          'people-c-verifier-merged-target'
  )
     or exists (
       select 1
       from public.community_follows follow
       where follow.user_id =
             v_viewer
         and follow.target_type =
             'person'
         and follow.target_id =
             v_merge_source::text
     )
  then
    raise exception
      'STOP: merged Person Follow did not canonicalize to survivor';
  end if;

  v_state :=
    public.community_get_person_follow_state(
      v_merge_source
    );

  if (
       v_state
         ->> 'person_id'
     )::uuid is distinct from
     v_merge_target
     or (
       v_state
         ->> 'followed'
     )::boolean is distinct from true
  then
    raise exception
      'STOP: merged Person viewer state did not resolve survivor';
  end if;

  v_result :=
    public.community_follow_target(
      'person',
      v_merge_source::text,
      'caller-controlled'
    );

  if (
       v_result
         ->> 'followed'
     )::boolean is distinct from false
     or exists (
       select 1
       from public.community_follows follow
       where follow.user_id =
             v_viewer
         and follow.target_type =
             'person'
         and follow.target_id =
             v_merge_target::text
     )
  then
    raise exception
      'STOP: merged Person toggle did not read survivor state before unfollow';
  end if;

  v_result :=
    public.community_follow_target(
      'person',
      v_merge_source::text,
      'caller-controlled'
    );

  if (
       v_result
         ->> 'followed'
     )::boolean is distinct from true
     or not exists (
       select 1
       from public.community_follows follow
       where follow.user_id =
             v_viewer
         and follow.target_type =
             'person'
         and follow.target_id =
             v_merge_target::text
     )
  then
    raise exception
      'STOP: merged Person toggle did not recreate canonical survivor Follow';
  end if;

  perform public.community_set_follow_state(
    'person',
    v_merge_source::text,
    null,
    false
  );

  insert into public.registry_authors (
    id,
    slug,
    name,
    source_kind,
    source_ingestion_run_id,
    source_staging_record_id,
    raw_record,
    mapped_record
  )
  values (
    v_registry_author,
    'people-c-verifier-viewer',
    'People C Verifier Viewer',
    'wordpress_export_zip',
    '00000000-0000-4000-8000-00000000ce01',
    '00000000-0000-4000-8000-00000000ce02',
    '{}'::jsonb,
    '{}'::jsonb
  );

  insert into editorial.external_contributors (
    id,
    display_name,
    public_role,
    consent_status,
    public_safe,
    contributor_state,
    created_by,
    updated_by
  )
  values (
    v_external_contributor,
    'People C Verifier Viewer',
    'Contributor',
    'not_required',
    true,
    'active',
    v_viewer,
    v_viewer
  );

  execute
    'set constraints public.registry_authors_person_provisioning, editorial.external_contributors_person_provisioning immediate';

  select link.person_resource_id
  into v_registry_person
  from editorial.person_identity_links link
  where link.registry_author_id =
        v_registry_author
    and link.link_state =
        'active';

  select link.person_resource_id
  into v_external_person
  from editorial.person_identity_links link
  where link.external_contributor_id =
        v_external_contributor
    and link.link_state =
        'active';

  if v_registry_person is null
     or v_external_person is null
     or v_registry_person =
        v_external_person
     or v_registry_person =
        v_viewer_person
     or v_external_person =
        v_viewer_person
  then
    raise exception
      'STOP: one-source provisioning merged distinct source identities automatically';
  end if;

  select md5(
    coalesce(
      jsonb_agg(
        to_jsonb(follow_row)
        order by follow_row.id
      )::text,
      '[]'
    )
  )
  into v_follow_hash_after
  from public.community_follows follow_row
  where follow_row.user_id not in (
    v_viewer,
    v_target_user,
    v_private_user
  );

  if v_follow_hash_after <>
     v_follow_hash_before
  then
    raise exception
      'STOP: Migration C verifier changed pre-existing Follow rows';
  end if;

  select md5(
    coalesce(
      jsonb_agg(
        to_jsonb(follow_row)
        order by follow_row.id
      )::text,
      '[]'
    )
  )
  into v_nonperson_follow_hash_after
  from public.community_follows follow_row
  where follow_row.target_type <>
        'person';

  if v_nonperson_follow_hash_after <>
     v_nonperson_follow_hash_before
  then
    raise exception
      'STOP: Migration C changed existing Artist/Article Follow authority';
  end if;

  select md5(
    coalesce(
      jsonb_agg(
        to_jsonb(credit)
        order by credit.id
      )::text,
      '[]'
    )
  )
  into v_credit_hash_after
  from editorial.credits credit;

  if v_credit_hash_after <>
     v_credit_hash_before
  then
    raise exception
      'STOP: Migration C verifier mutated Shared Credits';
  end if;
end;
$verify_people_migration_c_runtime$;


select jsonb_build_object(
  'verification',
    'PASS',
  'person_follow_state',
    to_regprocedure(
      'public.community_get_person_follow_state(uuid)'
    ) is not null,
  'public_person_social_summary',
    to_regprocedure(
      'public.get_public_person_social_summary(uuid)'
    ) is not null,
  'browser_follow_table_crud',
    (
      has_table_privilege(
        'authenticated',
        'public.community_follows',
        'SELECT'
      )
      or has_table_privilege(
        'authenticated',
        'public.community_follows',
        'INSERT'
      )
      or has_table_privilege(
        'authenticated',
        'public.community_follows',
        'UPDATE'
      )
      or has_table_privilege(
        'authenticated',
        'public.community_follows',
        'DELETE'
      )
    ),
  'unlinked_accounts',
    (
      select count(*)
      from public.user_profiles profile
      left join editorial.person_identity_links link
        on link.user_id = profile.user_id
       and link.link_state = 'active'
      where link.id is null
        and profile.user_id not in (
          '00000000-0000-4000-8000-00000000c001'::uuid,
          '00000000-0000-4000-8000-00000000c002'::uuid,
          '00000000-0000-4000-8000-00000000c003'::uuid,
          '00000000-0000-4000-8000-00000000c004'::uuid
        )
    ),
  'unlinked_registry_authors',
    (
      select count(*)
      from public.registry_authors author
      left join editorial.person_identity_links link
        on link.registry_author_id = author.id
       and link.link_state = 'active'
      where link.id is null
        and author.id <>
            '00000000-0000-4000-8000-00000000c201'::uuid
    ),
  'unlinked_external_contributors',
    (
      select count(*)
      from editorial.external_contributors contributor
      left join editorial.person_identity_links link
        on link.external_contributor_id = contributor.id
       and link.link_state = 'active'
      where link.id is null
        and contributor.id <>
            '00000000-0000-4000-8000-00000000c202'::uuid
    )
) as people_person_migration_c_acceptance;

rollback;

