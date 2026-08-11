-- Verify People / Contributor Identity Migration B:
-- reconciliation, merge continuity, and current-public body of work.
--
-- The verifier:
-- - checks the permanent schema and grants;
-- - proves current-public Article and Playlist work with rollback-only fixtures;
-- - performs reconciliation and merge acceptance only on rollback-only fixtures;
-- - leaves production data unchanged.

begin;

do $verify_people_migration_b_structure$
declare
  v_function text;
  v_definition text;
begin
  if to_regclass(
       'editorial.person_follow_merge_transfers'
     ) is null
  then
    raise exception
      'STOP: Migration B Follow-transfer history table is missing';
  end if;

  if not exists (
    select 1
    from pg_class relation
    where relation.oid =
          'editorial.person_follow_merge_transfers'::regclass
      and relation.relrowsecurity
  ) then
    raise exception
      'STOP: Follow-transfer history does not have RLS enabled';
  end if;

  if has_table_privilege(
       'anon',
       'editorial.person_follow_merge_transfers',
       'SELECT'
     )
     or has_table_privilege(
       'authenticated',
       'editorial.person_follow_merge_transfers',
       'SELECT'
     )
     or has_table_privilege(
       'authenticated',
       'editorial.person_follow_merge_transfers',
       'INSERT'
     )
     or has_table_privilege(
       'authenticated',
       'editorial.person_follow_merge_transfers',
       'UPDATE'
     )
     or has_table_privilege(
       'authenticated',
       'editorial.person_follow_merge_transfers',
       'DELETE'
     )
  then
    raise exception
      'STOP: Browser role has direct Follow-transfer history access';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid =
          'editorial.person_follow_merge_transfers'::regclass
      and trigger_row.tgname =
          'person_follow_merge_transfers_append_only'
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'STOP: Follow-transfer append-only protection is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    join pg_constraint constraint_row
      on constraint_row.oid =
         trigger_row.tgconstraint
    where trigger_row.tgrelid =
          'editorial.people'::regclass
      and trigger_row.tgname =
          'people_merge_cycle_integrity'
      and constraint_row.condeferrable
      and constraint_row.condeferred
  ) then
    raise exception
      'STOP: Deferred Person merge-cycle integrity is missing';
  end if;

  if (
    select count(*)
    from public.capability_definitions definition
    where definition.capability_key in (
      'view_people_identity',
      'manage_people_identity',
      'merge_people_identity'
    )
      and definition.domain =
          'content'
  ) <> 3 then
    raise exception
      'STOP: Migration B People capability definitions are invalid';
  end if;

  if (
    select count(*)
    from public.role_capabilities grant_row
    where grant_row.capability_key in (
      'view_people_identity',
      'manage_people_identity',
      'merge_people_identity'
    )
  ) <> 5 then
    raise exception
      'STOP: Migration B People capability grant count is not 5';
  end if;

  if not exists (
    select 1
    from public.role_capabilities
    where role_key =
          'administrator'
      and capability_key =
          'view_people_identity'
  )
     or not exists (
       select 1
       from public.role_capabilities
       where role_key =
             'administrator'
         and capability_key =
             'manage_people_identity'
     )
     or not exists (
       select 1
       from public.role_capabilities
       where role_key =
             'administrator'
         and capability_key =
             'merge_people_identity'
     )
     or not exists (
       select 1
       from public.role_capabilities
       where role_key =
             'editor'
         and capability_key =
             'view_people_identity'
     )
     or not exists (
       select 1
       from public.role_capabilities
       where role_key =
             'registry_editor'
         and capability_key =
             'view_people_identity'
     )
  then
    raise exception
      'STOP: Migration B least-privilege People grants are incomplete';
  end if;

  if exists (
    select 1
    from public.role_capabilities grant_row
    where grant_row.capability_key in (
      'manage_people_identity',
      'merge_people_identity'
    )
      and grant_row.role_key <>
          'administrator'
  ) then
    raise exception
      'STOP: Manage or merge People authority leaked beyond Administrator';
  end if;

  if (
    select count(*)
    from platform_private.command_types command_type
    where command_type.command_type like
          'person.%'
  ) <> 3 then
    raise exception
      'STOP: Migration B must register exactly three Person commands';
  end if;

  if exists (
    select 1
    from platform_private.command_types command_type
    where command_type.command_type =
          'person.split'
  ) then
    raise exception
      'STOP: person.split is executable in Migration B';
  end if;

  if not exists (
    select 1
    from platform_private.command_types command_type
    where command_type.command_type =
          'person.identity_link'
      and command_type.job_type =
          'person.identity_link.sync'
      and command_type.accepted_event_type =
          'person.identity_link.accepted'
      and command_type.success_event_type =
          'person.identity_link.succeeded'
      and command_type.failure_event_type =
          'person.identity_link.failed'
      and command_type.retry_event_type =
          'person.identity_link.retry_scheduled'
      and command_type.enabled
  )
     or not exists (
       select 1
       from platform_private.command_types command_type
       where command_type.command_type =
             'person.identity_unlink'
         and command_type.job_type =
             'person.identity_unlink.sync'
         and command_type.enabled
     )
     or not exists (
       select 1
       from platform_private.command_types command_type
       where command_type.command_type =
             'person.merge'
         and command_type.job_type =
             'person.merge.sync'
         and command_type.enabled
     )
  then
    raise exception
      'STOP: Person command vocabulary is invalid';
  end if;

  foreach v_function in array array[
    'public.link_person_identity(uuid,bigint,uuid,uuid,uuid,text,text,text,uuid)',
    'public.unlink_person_identity(uuid,bigint,uuid,text,text,uuid)',
    'public.merge_people(uuid,uuid,bigint,bigint,text,text,uuid)'
  ]
  loop
    if to_regprocedure(v_function) is null then
      raise exception
        'STOP: Missing Migration B command: %',
        v_function;
    end if;

    if has_function_privilege(
         'anon',
         v_function,
         'EXECUTE'
       )
       or not has_function_privilege(
         'authenticated',
         v_function,
         'EXECUTE'
       )
       or not has_function_privilege(
         'service_role',
         v_function,
         'EXECUTE'
       )
    then
      raise exception
        'STOP: Migration B command grants are invalid: %',
        v_function;
    end if;
  end loop;

  foreach v_function in array array[
    'editorial.resolve_credit_person(uuid)',
    'editorial.list_current_public_person_work(uuid)'
  ]
  loop
    if to_regprocedure(v_function) is null then
      raise exception
        'STOP: Missing private Migration B read helper: %',
        v_function;
    end if;

    if has_function_privilege(
         'anon',
         v_function,
         'EXECUTE'
       )
       or has_function_privilege(
         'authenticated',
         v_function,
         'EXECUTE'
       )
       or not has_function_privilege(
         'service_role',
         v_function,
         'EXECUTE'
       )
    then
      raise exception
        'STOP: Private Migration B helper grants are invalid: %',
        v_function;
    end if;
  end loop;

  if to_regprocedure(
       'public.list_public_person_work(uuid,integer,timestamp with time zone,uuid)'
     ) is null
  then
    raise exception
      'STOP: Public Person body-of-work reader is missing';
  end if;

  if has_function_privilege(
       'public',
       'public.list_public_person_work(uuid,integer,timestamp with time zone,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'anon',
       'public.list_public_person_work(uuid,integer,timestamp with time zone,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.list_public_person_work(uuid,integer,timestamp with time zone,uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: Public Person body-of-work grants are invalid';
  end if;

  v_definition :=
    pg_get_functiondef(
      'editorial.list_current_public_person_work(uuid)'::regprocedure
    );

  if position(
       'resource.current_published_version_id'
       in v_definition
     ) = 0
     or position(
       'binding.current_published_version_id'
       in v_definition
     ) = 0
     or position(
       '/magazine/'
       in v_definition
     ) = 0
     or position(
       '/playlists/'
       in v_definition
     ) = 0
     or position(
       'playlist_item'
       in v_definition
     ) <> 0
     or position(
       '''credit_id'''
       in v_definition
     ) <> 0
  then
    raise exception
      'STOP: Current-public Person work helper does not preserve typed pointer and route boundaries';
  end if;

  v_definition :=
    pg_get_functiondef(
      'public.list_public_person_work(uuid,integer,timestamp with time zone,uuid)'::regprocedure
    );

  if position(
       'published_at desc'
       in lower(v_definition)
     ) = 0
     or position(
       'resource_id desc'
       in lower(v_definition)
     ) = 0
  then
    raise exception
      'STOP: Person body-of-work cursor order is not stable';
  end if;

  v_definition :=
    pg_get_functiondef(
      'public.get_public_person(text)'::regprocedure
    );

  if position(
       'public_roles'
       in v_definition
     ) = 0
     or position(
       'list_current_public_person_work'
       in v_definition
     ) = 0
     or position(
       'follower_count'
       in v_definition
     ) <> 0
  then
    raise exception
      'STOP: Public Person role summary boundary is invalid';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.community_get_user_follows(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.community_get_user_follows(uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: Existing private Follow reader grants changed';
  end if;
end;
$verify_people_migration_b_structure$;

insert into editorial.resource_kinds (
  kind,
  label,
  description,
  enabled
)
values
  (
    'person',
    'Person',
    'Migration B verifier Person Resource vocabulary.',
    true
  ),
  (
    'article',
    'Article',
    'Migration B verifier Article Resource vocabulary.',
    true
  ),
  (
    'playlist',
    'Playlist',
    'Migration B verifier Playlist Resource vocabulary.',
    true
  )
on conflict (kind)
do nothing;

insert into public.role_definitions (
  role_key,
  label,
  description,
  priority,
  is_system
)
values (
  'subscriber',
  'Subscriber',
  'Rollback-only Migration B verifier public signup role vocabulary.',
  100,
  true
)
on conflict (role_key)
do nothing;

insert into editorial.credit_roles (
  credit_role,
  label,
  description,
  enabled,
  sort_order
)
values
  (
    'author',
    'Author',
    'Primary or contributing author.',
    true,
    10
  ),
  (
    'contributor',
    'Contributor',
    'General named contributor.',
    true,
    130
  ),
  (
    'reviewer',
    'Reviewer',
    'Editorial or subject reviewer.',
    true,
    140
  )
on conflict (credit_role)
do nothing;

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
    '00000000-0000-4000-8000-00000000b000',
    'authenticated',
    'authenticated',
    'people-b-verifier-admin@local.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"People B Verifier Admin"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-00000000b001',
    'authenticated',
    'authenticated',
    'people-b-verifier-a@local.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"People B Verifier A"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-00000000b002',
    'authenticated',
    'authenticated',
    'people-b-verifier-b@local.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"People B Verifier B"}'::jsonb,
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
values
  (
    '00000000-0000-4000-8000-00000000b000',
    'people-b-verifier-admin@local.invalid',
    'People B Verifier Admin',
    'active',
    '{"fixture":"people_migration_b"}'::jsonb,
    false,
    'people_b_verifier_admin',
    'people_b_verifier_admin'
  ),
  (
    '00000000-0000-4000-8000-00000000b001',
    'people-b-verifier-a@local.invalid',
    'People B Verifier A',
    'active',
    '{"fixture":"people_migration_b"}'::jsonb,
    true,
    'people_b_verifier_a',
    'people_b_verifier_a'
  ),
  (
    '00000000-0000-4000-8000-00000000b002',
    'people-b-verifier-b@local.invalid',
    'People B Verifier B',
    'active',
    '{"fixture":"people_migration_b"}'::jsonb,
    true,
    'people_b_verifier_b',
    'people_b_verifier_b'
  )
on conflict (user_id)
do update set
  email = excluded.email,
  display_name = excluded.display_name,
  status = excluded.status,
  metadata = excluded.metadata,
  is_public = excluded.is_public,
  username = excluded.username,
  username_normalized =
    excluded.username_normalized,
  updated_at = now();

insert into public.user_role_assignments (
  user_id,
  role_key,
  status,
  assigned_by,
  assigned_at,
  notes
)
values (
  '00000000-0000-4000-8000-00000000b000',
  'administrator',
  'active',
  null,
  now(),
  'Rollback-only Migration B verifier Administrator.'
);

do $verify_people_migration_b_runtime$
declare
  v_actor constant uuid :=
    '00000000-0000-4000-8000-00000000b000';

  v_link_person constant uuid :=
    '00000000-0000-4000-8000-00000000b101';
  v_link_result record;
  v_link_replay record;
  v_link_stale record;
  v_unlink_result record;
  v_unlink_replay record;
  v_link_id uuid;

  v_target_person constant uuid :=
    '00000000-0000-4000-8000-00000000b201';
  v_source_person constant uuid :=
    '00000000-0000-4000-8000-00000000b202';
  v_target_link constant uuid :=
    '00000000-0000-4000-8000-00000000b211';
  v_source_link constant uuid :=
    '00000000-0000-4000-8000-00000000b212';
  v_external_id constant uuid :=
    '00000000-0000-4000-8000-00000000b301';

  v_registry_person constant uuid :=
    '00000000-0000-4000-8000-00000000b203';
  v_registry_link constant uuid :=
    '00000000-0000-4000-8000-00000000b213';
  v_registry_author_id constant uuid :=
    '00000000-0000-4000-8000-00000000b302';

  v_article_resource constant uuid :=
    '00000000-0000-4000-8000-00000000b401';
  v_article_version constant uuid :=
    '00000000-0000-4000-8000-00000000b411';
  v_article_id constant uuid :=
    '00000000-0000-4000-8000-00000000b421';
  v_article_credit constant uuid :=
    '00000000-0000-4000-8000-00000000b431';

  v_playlist_resource constant uuid :=
    '00000000-0000-4000-8000-00000000b501';
  v_playlist_id constant uuid :=
    '00000000-0000-4000-8000-00000000b511';
  v_playlist_working_version constant uuid :=
    '00000000-0000-4000-8000-00000000b520';
  v_playlist_current_version constant uuid :=
    '00000000-0000-4000-8000-00000000b521';
  v_playlist_historical_version constant uuid :=
    '00000000-0000-4000-8000-00000000b522';
  v_playlist_submitted_version constant uuid :=
    '00000000-0000-4000-8000-00000000b523';
  v_playlist_credit constant uuid :=
    '00000000-0000-4000-8000-00000000b541';
  v_registry_credit constant uuid :=
    '00000000-0000-4000-8000-00000000b542';

  v_moved_follow constant uuid :=
    '00000000-0000-4000-8000-00000000bf01';
  v_dedup_source_follow constant uuid :=
    '00000000-0000-4000-8000-00000000bf02';
  v_dedup_target_follow constant uuid :=
    '00000000-0000-4000-8000-00000000bf03';
  v_moved_created_at constant timestamptz :=
    '2026-08-11 18:00:00+00';

  v_merge_stale record;
  v_merge_result record;
  v_merge_replay record;
  v_merge_event_id uuid;
  v_redirect jsonb;

  v_credits_before text;
  v_fixture_credits_before text;
  v_nonperson_follows_before text;
  v_target_preferred_before uuid;
  v_transferred_link_id uuid;
  v_target_profile jsonb;
  v_first_work record;
  v_second_work record;
  v_cycle_rejected boolean := false;

  v_cycle_a constant uuid :=
    '00000000-0000-4000-8000-00000000bc01';
  v_cycle_b constant uuid :=
    '00000000-0000-4000-8000-00000000bc02';
begin
  perform set_config(
    'request.jwt.claim.role',
    'authenticated',
    true
  );

  perform set_config(
    'request.jwt.claim.sub',
    v_actor::text,
    true
  );

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'role',
        'authenticated',
      'sub',
        v_actor
    )::text,
    true
  );

  if auth.role() <>
     'authenticated'
     or auth.uid() is distinct from
        v_actor
     or not public.current_user_has_capability(
       'manage_people_identity'
     )
     or not public.current_user_has_capability(
       'merge_people_identity'
     )
  then
    raise exception
      'STOP: Runtime verifier could not establish People command authority';
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
  into v_credits_before
  from editorial.credits credit
  where credit.id not in (
    v_article_credit,
    v_playlist_credit,
    v_registry_credit
  );

  select md5(
    coalesce(
      jsonb_agg(
        to_jsonb(follow_row)
        order by follow_row.id
      )::text,
      '[]'
    )
  )
  into v_nonperson_follows_before
  from public.community_follows follow_row
  where follow_row.target_type <>
        'person';

  insert into editorial.resources (
    id,
    resource_kind,
    visibility,
    lifecycle_state,
    created_by
  )
  values (
    v_link_person,
    'person',
    'internal',
    'active',
    v_actor
  );

  insert into editorial.people (
    resource_id,
    resource_kind,
    person_state,
    identity_revision,
    created_by,
    updated_by
  )
  values (
    v_link_person,
    'person',
    'active',
    1,
    v_actor,
    v_actor
  );

  insert into editorial.resource_aliases (
    resource_id,
    path,
    is_canonical,
    created_by
  )
  values (
    v_link_person,
    '/people/people-b-verifier-link',
    true,
    v_actor
  );

  select *
  into v_link_result
  from public.link_person_identity(
    v_link_person,
    1,
    '00000000-0000-4000-8000-00000000b001',
    null,
    null,
    'admin_reconciliation',
    'Migration B verifier link.',
    'people-b-link-success',
    '00000000-0000-4000-8000-00000000ba01'
  );

  if v_link_result.receipt_status <>
     'succeeded'
     or v_link_result.identity_revision <> 2
     or v_link_result.idempotent_replay
     or (
       v_link_result.result_payload
         ->> 'changed'
     )::boolean is distinct from true
  then
    raise exception
      'STOP: Person identity link command did not succeed exactly once';
  end if;

  v_link_id :=
    v_link_result.identity_link_id;

  if v_link_id is null
     or (
       select count(*)
       from editorial.person_identity_events event
       where event.person_resource_id =
             v_link_person
         and event.event_type =
             'identity_linked'
     ) <> 1
  then
    raise exception
      'STOP: Person link history is invalid';
  end if;

  select *
  into v_link_replay
  from public.link_person_identity(
    v_link_person,
    1,
    '00000000-0000-4000-8000-00000000b001',
    null,
    null,
    'admin_reconciliation',
    'Migration B verifier link.',
    'people-b-link-success',
    '00000000-0000-4000-8000-00000000ba01'
  );

  if v_link_replay.receipt_status <>
     'succeeded'
     or not v_link_replay.idempotent_replay
     or v_link_replay.command_receipt_id <>
        v_link_result.command_receipt_id
     or v_link_replay.identity_revision <> 2
  then
    raise exception
      'STOP: Person identity link replay is not durable';
  end if;

  select *
  into v_link_stale
  from public.link_person_identity(
    v_link_person,
    1,
    '00000000-0000-4000-8000-00000000b002',
    null,
    null,
    'admin_reconciliation',
    'Migration B verifier stale link.',
    'people-b-link-stale',
    '00000000-0000-4000-8000-00000000ba02'
  );

  if v_link_stale.receipt_status <>
     'rejected'
     or v_link_stale.identity_revision <> 2
     or (
       select receipt.error_code
       from platform_private.command_receipts receipt
       where receipt.id =
             v_link_stale.command_receipt_id
     ) <>
        'person_identity_revision_changed'
  then
    raise exception
      'STOP: Stale Person identity link was not durably rejected';
  end if;

  select *
  into v_unlink_result
  from public.unlink_person_identity(
    v_link_person,
    2,
    v_link_id,
    'Migration B verifier unlink.',
    'people-b-unlink-success',
    '00000000-0000-4000-8000-00000000ba03'
  );

  if v_unlink_result.receipt_status <>
     'succeeded'
     or v_unlink_result.identity_revision <> 3
     or v_unlink_result.idempotent_replay
  then
    raise exception
      'STOP: Person identity unlink command did not succeed';
  end if;

  if not exists (
    select 1
    from editorial.person_identity_links link
    where link.id =
          v_link_id
      and link.link_state =
          'retired'
      and link.retired_at is not null
      and nullif(
            btrim(
              link.retired_reason
            ),
            ''
          ) is not null
  )
     or (
       select count(*)
       from editorial.person_identity_events event
       where event.person_resource_id =
             v_link_person
         and event.event_type =
             'identity_unlinked'
     ) <> 1
  then
    raise exception
      'STOP: Person unlink did not preserve historical link authority';
  end if;

  select *
  into v_unlink_replay
  from public.unlink_person_identity(
    v_link_person,
    2,
    v_link_id,
    'Migration B verifier unlink.',
    'people-b-unlink-success',
    '00000000-0000-4000-8000-00000000ba03'
  );

  if v_unlink_replay.receipt_status <>
     'succeeded'
     or not v_unlink_replay.idempotent_replay
     or v_unlink_replay.command_receipt_id <>
        v_unlink_result.command_receipt_id
     or v_unlink_replay.identity_revision <> 3
  then
    raise exception
      'STOP: Person identity unlink replay is not durable';
  end if;

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
    v_external_id,
    'People B Merge Source',
    'Contributor',
    'not_required',
    true,
    'active',
    v_actor,
    v_actor
  );

  insert into editorial.resources (
    id,
    resource_kind,
    owner_id,
    visibility,
    lifecycle_state,
    created_by
  )
  values
    (
      v_target_person,
      'person',
      '00000000-0000-4000-8000-00000000b001',
      'public',
      'active',
      v_actor
    ),
    (
      v_source_person,
      'person',
      null,
      'public',
      'active',
      v_actor
    );

  insert into editorial.people (
    resource_id,
    resource_kind,
    person_state,
    identity_revision,
    preferred_identity_link_id,
    created_by,
    updated_by
  )
  values
    (
      v_target_person,
      'person',
      'active',
      1,
      null,
      v_actor,
      v_actor
    ),
    (
      v_source_person,
      'person',
      'active',
      1,
      null,
      v_actor,
      v_actor
    );

  insert into editorial.person_identity_links (
    id,
    person_resource_id,
    person_resource_kind,
    user_id,
    external_contributor_id,
    link_state,
    link_method,
    link_reason,
    created_by
  )
  values
    (
      v_target_link,
      v_target_person,
      'person',
      '00000000-0000-4000-8000-00000000b001',
      null,
      'active',
      'migration_seed',
      'Migration B target fixture.',
      v_actor
    ),
    (
      v_source_link,
      v_source_person,
      'person',
      null,
      v_external_id,
      'active',
      'migration_seed',
      'Migration B source fixture.',
      v_actor
    );

  update editorial.people person
  set
    preferred_identity_link_id =
      case
        when person.resource_id =
             v_target_person
          then v_target_link
        else v_source_link
      end
  where person.resource_id in (
    v_target_person,
    v_source_person
  );

  insert into editorial.resource_aliases (
    resource_id,
    path,
    is_canonical,
    created_by
  )
  values
    (
      v_target_person,
      '/people/people-b-verifier-target',
      true,
      v_actor
    ),
    (
      v_source_person,
      '/people/people-b-verifier-source',
      true,
      v_actor
    );

  perform editorial.refresh_person_visibility(
    v_target_person
  );

  perform editorial.refresh_person_visibility(
    v_source_person
  );

  select person.preferred_identity_link_id
  into v_target_preferred_before
  from editorial.people person
  where person.resource_id =
        v_target_person;

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
    v_registry_author_id,
    'people-b-verifier-registry-author',
    'People B Verifier Registry Author',
    'wordpress_export_zip',
    '00000000-0000-4000-8000-00000000be01',
    '00000000-0000-4000-8000-00000000be02',
    '{}'::jsonb,
    '{}'::jsonb
  );

  insert into editorial.resources (
    id,
    resource_kind,
    visibility,
    lifecycle_state,
    created_by
  )
  values
    (
      v_registry_person,
      'person',
      'internal',
      'active',
      v_actor
    ),
    (
      v_article_resource,
      'article',
      'public',
      'published',
      v_actor
    ),
    (
      v_playlist_resource,
      'playlist',
      'public',
      'published',
      v_actor
    );

  insert into public.wk_articles (
    id,
    slug,
    title,
    excerpt,
    content_html,
    author,
    published_at,
    wp_status
  )
  values (
    v_article_id,
    'people-b-verifier-article',
    'People B Verifier Article',
    'Synthetic current-public Article body-of-work fixture.',
    '<p>Migration B verifier Article.</p>',
    'People B Verifier A',
    '2026-08-11 18:30:00+00',
    'publish'
  );

  insert into public.wk_playlists (
    id,
    title,
    slug,
    description,
    status,
    created_by,
    published_at,
    authority_revision
  )
  values (
    v_playlist_id,
    'People B Verifier Playlist',
    'people-b-verifier-playlist',
    'Synthetic current-public Playlist body-of-work fixture.',
    'published',
    v_actor,
    '2026-08-11 18:20:00+00',
    1
  );

  insert into editorial.article_resources (
    resource_id,
    resource_kind,
    article_id
  )
  values (
    v_article_resource,
    'article',
    v_article_id
  );

  insert into editorial.people (
    resource_id,
    resource_kind,
    person_state,
    identity_revision,
    created_by,
    updated_by
  )
  values (
    v_registry_person,
    'person',
    'active',
    1,
    v_actor,
    v_actor
  );

  insert into editorial.person_identity_links (
    id,
    person_resource_id,
    person_resource_kind,
    registry_author_id,
    link_state,
    link_method,
    link_reason,
    created_by
  )
  values (
    v_registry_link,
    v_registry_person,
    'person',
    v_registry_author_id,
    'active',
    'migration_seed',
    'Migration B Registry Author resolver fixture.',
    v_actor
  );

  update editorial.people person
  set preferred_identity_link_id =
        v_registry_link
  where person.resource_id =
        v_registry_person;

  perform editorial.refresh_person_visibility(
    v_registry_person
  );

  insert into editorial.article_versions (
    id,
    resource_id,
    article_id,
    version_number,
    version_kind,
    source_draft_version,
    title,
    slug,
    excerpt,
    content_html,
    author_display,
    seo,
    lifecycle_state,
    wp_status,
    published_at,
    category_snapshot,
    tag_snapshot,
    created_by,
    content_fingerprint
  )
  values (
    v_article_version,
    v_article_resource,
    v_article_id,
    1,
    'published',
    1,
    'People B Verifier Article',
    'people-b-verifier-article',
    'Synthetic current-public Article body-of-work fixture.',
    '<p>Migration B verifier Article.</p>',
    'People B Verifier A',
    '{}'::jsonb,
    'published',
    'publish',
    '2026-08-11 18:30:00+00',
    '[]'::jsonb,
    '[]'::jsonb,
    v_actor,
    repeat('a', 64)
  );

  update editorial.resources resource
  set current_published_version_id =
        v_article_version
  where resource.id =
        v_article_resource;

  insert into editorial.playlist_resources (
    resource_id,
    resource_kind,
    playlist_id
  )
  values (
    v_playlist_resource,
    'playlist',
    v_playlist_id
  );

  insert into editorial.playlist_versions (
    id,
    resource_id,
    playlist_id,
    version_number,
    version_kind,
    source_authority_revision,
    title,
    slug,
    description,
    status,
    metadata,
    item_count,
    content_fingerprint,
    created_by
  )
  values
    (
      v_playlist_working_version,
      v_playlist_resource,
      v_playlist_id,
      1,
      'working',
      1,
      'People B Verifier Playlist',
      'people-b-verifier-playlist',
      'Synthetic governed Playlist Trust source fixture.',
      'draft',
      '{}'::jsonb,
      0,
      repeat('b', 64),
      v_actor
    ),
    (
      v_playlist_submitted_version,
      v_playlist_resource,
      v_playlist_id,
      2,
      'submitted',
      1,
      'People B Verifier Playlist',
      'people-b-verifier-playlist',
      'Synthetic governed Playlist submitted fixture.',
      'ready_for_review',
      '{}'::jsonb,
      0,
      repeat('b', 64),
      v_actor
    ),
    (
      v_playlist_historical_version,
      v_playlist_resource,
      v_playlist_id,
      3,
      'approved',
      1,
      'People B Verifier Playlist',
      'people-b-verifier-playlist',
      'Synthetic governed Playlist approved fixture.',
      'approved',
      '{}'::jsonb,
      0,
      repeat('b', 64),
      v_actor
    ),
    (
      v_playlist_current_version,
      v_playlist_resource,
      v_playlist_id,
      4,
      'published',
      1,
      'People B Verifier Playlist',
      'people-b-verifier-playlist',
      'Synthetic current-public Playlist body-of-work fixture.',
      'published',
      '{}'::jsonb,
      0,
      repeat('b', 64),
      v_actor
    );

  update editorial.playlist_resources binding
  set
    current_working_version_id =
      v_playlist_working_version,
    current_submitted_version_id =
      v_playlist_submitted_version,
    current_approved_version_id =
      v_playlist_historical_version,
    current_published_version_id =
      v_playlist_current_version
  where binding.resource_id =
        v_playlist_resource;

  insert into platform_private.command_types (
    command_type,
    job_type,
    accepted_event_type,
    success_event_type,
    failure_event_type,
    retry_event_type,
    enabled
  )
  values (
    'playlist.publish',
    'playlist.publish.sync',
    'playlist.publish.accepted',
    'playlist.publish.succeeded',
    'playlist.publish.failed',
    'playlist.publish.retry_scheduled',
    true
  )
  on conflict (command_type)
  do nothing;

  insert into platform_private.command_receipts (
    id,
    command_type,
    resource_id,
    principal_key,
    actor_user_id,
    idempotency_key,
    request_fingerprint,
    request_payload,
    status,
    result_payload,
    completed_at
  )
  values (
    '00000000-0000-4000-8000-00000000b591',
    'playlist.publish',
    v_playlist_resource,
    'user:' || v_actor::text,
    v_actor,
    'people-b-playlist-publish',
    repeat('c', 64),
    '{}'::jsonb,
    'succeeded',
    '{}'::jsonb,
    now()
  );

  insert into editorial.playlist_publication_snapshots (
    id,
    resource_id,
    playlist_id,
    version_id,
    command_receipt_id,
    slug,
    title,
    description,
    cover_url,
    item_count,
    content_fingerprint,
    payload,
    published_at,
    first_published_at,
    published_by
  )
  values (
    '00000000-0000-4000-8000-00000000b531',
    v_playlist_resource,
    v_playlist_id,
    v_playlist_current_version,
    '00000000-0000-4000-8000-00000000b591',
    'people-b-verifier-playlist',
    'People B Verifier Playlist',
    'Synthetic current-public Playlist body-of-work fixture.',
    'https://example.invalid/people-b-verifier-playlist.jpg',
    0,
    repeat('b', 64),
    '{}'::jsonb,
    '2026-08-11 18:20:00+00',
    '2026-08-11 18:20:00+00',
    v_actor
  );

  insert into editorial.credits (
    id,
    credit_role,
    user_id,
    registry_author_id,
    external_contributor_id,
    display_name_snapshot,
    role_label_snapshot,
    registry_author_slug_snapshot,
    created_by
  )
  values
    (
      v_article_credit,
      'author',
      '00000000-0000-4000-8000-00000000b001',
      null,
      null,
      'People B Verifier A',
      'Author',
      null,
      v_actor
    ),
    (
      v_playlist_credit,
      'contributor',
      null,
      null,
      v_external_id,
      'People B Merge Source',
      'Contributor',
      null,
      v_actor
    ),
    (
      v_registry_credit,
      'reviewer',
      null,
      v_registry_author_id,
      null,
      'People B Verifier Registry Author',
      'Reviewer',
      'people-b-verifier-registry-author',
      v_actor
    );

  insert into editorial.credit_governance (
    credit_id,
    public_safe,
    credit_state,
    reason,
    updated_by
  )
  values
    (
      v_article_credit,
      true,
      'active',
      'Migration B verifier current-public Article Credit.',
      v_actor
    ),
    (
      v_playlist_credit,
      true,
      'active',
      'Migration B verifier governed Playlist Credit.',
      v_actor
    ),
    (
      v_registry_credit,
      true,
      'active',
      'Migration B verifier Registry Author resolver Credit.',
      v_actor
    );

  insert into editorial.resource_credits (
    id,
    resource_id,
    resource_kind,
    target_version_type,
    target_version_id,
    credit_id,
    display_order,
    is_primary,
    public_safe,
    created_by
  )
  values (
    '00000000-0000-4000-8000-00000000b601',
    v_article_resource,
    'article',
    'article_version',
    v_article_version,
    v_article_credit,
    0,
    true,
    true,
    v_actor
  );

  insert into editorial.resource_credits (
    id,
    resource_id,
    resource_kind,
    target_version_type,
    target_version_id,
    credit_id,
    display_order,
    is_primary,
    public_safe,
    created_by
  )
  values (
    '00000000-0000-4000-8000-00000000b602',
    v_playlist_resource,
    'playlist',
    'playlist_version',
    v_playlist_working_version,
    v_playlist_credit,
    0,
    true,
    true,
    v_actor
  );

  perform
    platform_private.begin_playlist_trust_copy_authorization(
      v_playlist_working_version,
      v_playlist_submitted_version
    );

  insert into editorial.resource_credits (
    id,
    resource_id,
    resource_kind,
    target_version_type,
    target_version_id,
    credit_id,
    display_order,
    is_primary,
    public_safe,
    created_by
  )
  values (
    '00000000-0000-4000-8000-00000000b603',
    v_playlist_resource,
    'playlist',
    'playlist_version',
    v_playlist_submitted_version,
    v_playlist_credit,
    0,
    true,
    true,
    v_actor
  );

  perform
    platform_private.begin_playlist_trust_copy_authorization(
      v_playlist_submitted_version,
      v_playlist_historical_version
    );

  insert into editorial.resource_credits (
    id,
    resource_id,
    resource_kind,
    target_version_type,
    target_version_id,
    credit_id,
    display_order,
    is_primary,
    public_safe,
    created_by
  )
  values (
    '00000000-0000-4000-8000-00000000b604',
    v_playlist_resource,
    'playlist',
    'playlist_version',
    v_playlist_historical_version,
    v_playlist_credit,
    0,
    true,
    true,
    v_actor
  );

  perform
    platform_private.begin_playlist_trust_copy_authorization(
      v_playlist_historical_version,
      v_playlist_current_version
    );

  insert into editorial.resource_credits (
    id,
    resource_id,
    resource_kind,
    target_version_type,
    target_version_id,
    credit_id,
    display_order,
    is_primary,
    public_safe,
    created_by
  )
  values (
    '00000000-0000-4000-8000-00000000b605',
    v_playlist_resource,
    'playlist',
    'playlist_version',
    v_playlist_current_version,
    v_playlist_credit,
    0,
    true,
    true,
    v_actor
  );

  if editorial.resolve_credit_person(
       v_article_credit
     ) is distinct from
     v_target_person
     or editorial.resolve_credit_person(
          v_playlist_credit
        ) is distinct from
        v_source_person
     or editorial.resolve_credit_person(
          v_registry_credit
        ) is distinct from
        v_registry_person
  then
    raise exception
      'STOP: Credit-to-Person resolver did not prove all three typed identity kinds before merge';
  end if;

  select md5(
    jsonb_agg(
      to_jsonb(credit)
      order by credit.id
    )::text
  )
  into v_fixture_credits_before
  from editorial.credits credit
  where credit.id in (
    v_article_credit,
    v_playlist_credit,
    v_registry_credit
  );

  insert into public.community_follows (
    id,
    user_id,
    target_type,
    target_id,
    target_slug,
    created_at
  )
  values
    (
      v_moved_follow,
      '00000000-0000-4000-8000-00000000b002',
      'person',
      v_source_person::text,
      'people-b-verifier-source',
      v_moved_created_at
    ),
    (
      v_dedup_source_follow,
      '00000000-0000-4000-8000-00000000b001',
      'person',
      v_source_person::text,
      'people-b-verifier-source',
      '2026-08-11 18:01:00+00'
    ),
    (
      v_dedup_target_follow,
      '00000000-0000-4000-8000-00000000b001',
      'person',
      v_target_person::text,
      'people-b-verifier-target',
      '2026-08-11 17:59:00+00'
    );

  select *
  into v_merge_stale
  from public.merge_people(
    v_source_person,
    v_target_person,
    99,
    1,
    'Migration B verifier stale merge.',
    'people-b-merge-stale',
    '00000000-0000-4000-8000-00000000ba04'
  );

  if v_merge_stale.receipt_status <>
     'rejected'
     or (
       select receipt.error_code
       from platform_private.command_receipts receipt
       where receipt.id =
             v_merge_stale.command_receipt_id
     ) <>
        'person_merge_revision_changed'
  then
    raise exception
      'STOP: Stale Person merge was not durably rejected';
  end if;

  select *
  into v_merge_result
  from public.merge_people(
    v_source_person,
    v_target_person,
    1,
    1,
    'Migration B verifier merge.',
    'people-b-merge-success',
    '00000000-0000-4000-8000-00000000ba05'
  );

  if v_merge_result.receipt_status <>
     'succeeded'
     or v_merge_result.idempotent_replay
     or v_merge_result.source_identity_revision <> 2
     or v_merge_result.target_identity_revision <> 2
     or coalesce(
       (
         v_merge_result.result_payload
           ->> 'moved_follow_count'
       )::integer,
       -1
     ) <> 1
     or coalesce(
       (
         v_merge_result.result_payload
           ->> 'deduplicated_follow_count'
       )::integer,
       -1
     ) <> 1
  then
    raise exception
      'STOP: Person merge result is invalid';
  end if;

  v_merge_event_id :=
    v_merge_result.merge_event_id;

  if v_merge_event_id is null then
    raise exception
      'STOP: Person merge did not return its source merge event';
  end if;

  if not exists (
    select 1
    from editorial.people person
    where person.resource_id =
          v_source_person
      and person.person_state =
          'merged'
      and person.merged_into_person_resource_id =
          v_target_person
      and person.identity_revision =
          2
      and person.preferred_identity_link_id
          is null
  )
     or not exists (
       select 1
       from editorial.people person
       where person.resource_id =
             v_target_person
         and person.person_state =
             'active'
         and person.identity_revision =
             2
         and person.preferred_identity_link_id =
             v_target_preferred_before
     )
  then
    raise exception
      'STOP: Merge Person states, revisions, or preferred identity are invalid';
  end if;

  select new_link.id
  into v_transferred_link_id
  from editorial.person_identity_links old_link
  join editorial.person_identity_links new_link
    on new_link.supersedes_link_id =
       old_link.id
   and new_link.person_resource_id =
       v_target_person
   and new_link.link_state =
       'active'
   and new_link.link_method =
       'person_merge'
  where old_link.id =
        v_source_link
    and old_link.person_resource_id =
        v_source_person
    and old_link.link_state =
        'superseded'
    and old_link.superseded_by_link_id =
        new_link.id;

  if v_transferred_link_id is null then
    raise exception
      'STOP: Merge identity-link supersession chain is invalid';
  end if;

  if (
    select count(*)
    from editorial.person_identity_events event
    where event.event_type =
          'person_merged'
      and event.correlation_id =
          '00000000-0000-4000-8000-00000000ba05'::uuid
      and (
        (
          event.person_resource_id =
            v_source_person
          and event.related_person_resource_id =
            v_target_person
          and event.prior_identity_revision = 1
          and event.resulting_identity_revision = 2
        )
        or
        (
          event.person_resource_id =
            v_target_person
          and event.related_person_resource_id =
            v_source_person
          and event.prior_identity_revision = 1
          and event.resulting_identity_revision = 2
        )
      )
  ) <> 2 then
    raise exception
      'STOP: Merge did not append exactly two Person merge events';
  end if;

  if not exists (
    select 1
    from public.community_follows follow_row
    where follow_row.id =
          v_moved_follow
      and follow_row.target_type =
          'person'
      and follow_row.target_id =
          v_target_person::text
      and follow_row.target_slug =
          'people-b-verifier-target'
      and follow_row.created_at =
          v_moved_created_at
  ) then
    raise exception
      'STOP: Moved Person Follow did not preserve row id and created time';
  end if;

  if exists (
    select 1
    from public.community_follows follow_row
    where follow_row.id =
          v_dedup_source_follow
  )
     or not exists (
       select 1
       from public.community_follows follow_row
       where follow_row.id =
             v_dedup_target_follow
         and follow_row.target_id =
             v_target_person::text
     )
  then
    raise exception
      'STOP: Deduplicated Person Follow did not preserve the pre-existing target row';
  end if;

  if (
    select count(*)
    from editorial.person_follow_merge_transfers transfer
    where transfer.merge_event_id =
          v_merge_event_id
  ) <> 2
     or not exists (
       select 1
       from editorial.person_follow_merge_transfers transfer
       where transfer.merge_event_id =
             v_merge_event_id
         and transfer.transfer_mode =
             'moved'
         and transfer.source_follow_id =
             v_moved_follow
         and transfer.target_follow_id =
             v_moved_follow
         and not transfer.target_follow_preexisted
     )
     or not exists (
       select 1
       from editorial.person_follow_merge_transfers transfer
       where transfer.merge_event_id =
             v_merge_event_id
         and transfer.transfer_mode =
             'deduplicated'
         and transfer.source_follow_id =
             v_dedup_source_follow
         and transfer.target_follow_id =
             v_dedup_target_follow
         and transfer.target_follow_preexisted
     )
  then
    raise exception
      'STOP: Person Follow merge-transfer history is incomplete';
  end if;

  v_redirect :=
    public.get_public_person(
      'people-b-verifier-source'
    );

  if nullif(
       v_redirect
         ->> 'person_id',
       ''
     )::uuid is distinct from
     v_target_person
     or v_redirect
          ->> 'canonical_path' is distinct from
        '/people/people-b-verifier-target'
     or v_redirect
          ->> 'redirect_to' is distinct from
        '/people/people-b-verifier-target'
  then
    raise exception
      'STOP: Merged source Person route does not resolve to the survivor';
  end if;

  if editorial.resolve_credit_person(
       v_article_credit
     ) is distinct from
     v_target_person
     or editorial.resolve_credit_person(
          v_playlist_credit
        ) is distinct from
        v_target_person
     or editorial.resolve_credit_person(
          v_registry_credit
        ) is distinct from
        v_registry_person
  then
    raise exception
      'STOP: Credit-to-Person resolution did not follow the governed merge';
  end if;

  if (
    select count(*)
    from public.list_public_person_work(
      v_target_person,
      50,
      null,
      null
    ) work
  ) <> 2
     or (
       select count(*)
       from public.list_public_person_work(
         v_target_person,
         50,
         null,
         null
       ) work
       where work.resource_id =
             v_article_resource
         and work.resource_kind =
             'article'
         and work.canonical_path =
             '/magazine/people-b-verifier-article'
         and exists (
           select 1
           from jsonb_array_elements(
             work.roles
           ) role_item
           where role_item
                   ->> 'role' =
                 'author'
         )
     ) <> 1
     or (
       select count(*)
       from public.list_public_person_work(
         v_target_person,
         50,
         null,
         null
       ) work
       where work.resource_id =
             v_playlist_resource
         and work.resource_kind =
             'playlist'
         and work.canonical_path =
             '/playlists/people-b-verifier-playlist'
         and exists (
           select 1
           from jsonb_array_elements(
             work.roles
           ) role_item
           where role_item
                   ->> 'role' =
                 'contributor'
         )
     ) <> 1
     or exists (
       select 1
       from public.list_public_person_work(
         v_target_person,
         50,
         null,
         null
       ) work
       cross join lateral
         jsonb_array_elements(
           work.roles
         ) role_item
       where role_item ? 'credit_id'
     )
  then
    raise exception
      'STOP: Synthetic current-public Person body of work is invalid or leaks Credit ids';
  end if;

  if (
    select count(*)
    from public.list_public_person_work(
      v_target_person,
      50,
      null,
      null
    ) work
    where work.resource_id =
          v_playlist_resource
  ) <> 1
     or (
       select count(*)
       from editorial.resource_credits attachment
       where attachment.resource_id =
             v_playlist_resource
         and attachment.credit_id =
             v_playlist_credit
     ) <> 4
     or (
       select count(*)
       from editorial.resource_credits attachment
       where attachment.resource_id =
             v_playlist_resource
         and attachment.credit_id =
             v_playlist_credit
         and attachment.target_version_id =
             v_playlist_current_version
     ) <> 1
  then
    raise exception
      'STOP: Governed Playlist Trust history leaked or fixture is incomplete';
  end if;

  select *
  into v_first_work
  from public.list_public_person_work(
    v_target_person,
    1,
    null,
    null
  );

  if v_first_work.resource_id is distinct from
     v_article_resource
  then
    raise exception
      'STOP: Person work first page is not ordered by published_at desc, resource_id desc';
  end if;

  select *
  into v_second_work
  from public.list_public_person_work(
    v_target_person,
    1,
    v_first_work.published_at,
    v_first_work.resource_id
  );

  if v_second_work.resource_id is distinct from
     v_playlist_resource
  then
    raise exception
      'STOP: Person work cursor pagination is not deterministic';
  end if;

  v_target_profile :=
    public.get_public_person(
      'people-b-verifier-target'
    );

  if coalesce(
       (
         v_target_profile
           -> 'public_roles'
       ) @> '[{"role":"author"},{"role":"contributor"}]'::jsonb,
       false
     ) = false
     or v_target_profile ? 'follower_count'
  then
    raise exception
      'STOP: Public Person role summary is not current-public Shared Credit authority';
  end if;

  select *
  into v_merge_replay
  from public.merge_people(
    v_source_person,
    v_target_person,
    1,
    1,
    'Migration B verifier merge.',
    'people-b-merge-success',
    '00000000-0000-4000-8000-00000000ba05'
  );

  if v_merge_replay.receipt_status <>
     'succeeded'
     or not v_merge_replay.idempotent_replay
     or v_merge_replay.command_receipt_id <>
        v_merge_result.command_receipt_id
     or v_merge_replay.merge_event_id <>
        v_merge_event_id
  then
    raise exception
      'STOP: Successful merge replay was blocked by merged source state';
  end if;

  if (
    select md5(
      coalesce(
        jsonb_agg(
          to_jsonb(credit)
          order by credit.id
        )::text,
        '[]'
      )
    )
    from editorial.credits credit
    where credit.id not in (
      v_article_credit,
      v_playlist_credit,
      v_registry_credit
    )
  ) is distinct from
     v_credits_before
     or (
       select md5(
         jsonb_agg(
           to_jsonb(credit)
           order by credit.id
         )::text
       )
       from editorial.credits credit
       where credit.id in (
         v_article_credit,
         v_playlist_credit,
         v_registry_credit
       )
     ) is distinct from
        v_fixture_credits_before
  then
    raise exception
      'STOP: Reconciliation mutated historical or synthetic Shared Credits';
  end if;

  if (
    select md5(
      coalesce(
        jsonb_agg(
          to_jsonb(follow_row)
          order by follow_row.id
        )::text,
        '[]'
      )
    )
    from public.community_follows follow_row
    where follow_row.target_type <>
          'person'
  ) is distinct from
     v_nonperson_follows_before
  then
    raise exception
      'STOP: Person merge changed a non-Person Follow row';
  end if;

  begin
    perform *
    from public.community_get_user_follows(
      '00000000-0000-4000-8000-00000000b001'
    );

    raise exception
      'Verifier expected private Follow reader to reject another user';
  exception
    when insufficient_privilege then
      null;
  end;

  insert into editorial.resources (
    id,
    resource_kind,
    visibility,
    lifecycle_state,
    created_by
  )
  values
    (
      v_cycle_a,
      'person',
      'internal',
      'active',
      v_actor
    ),
    (
      v_cycle_b,
      'person',
      'internal',
      'active',
      v_actor
    );

  insert into editorial.people (
    resource_id,
    resource_kind,
    person_state,
    identity_revision,
    created_by,
    updated_by
  )
  values
    (
      v_cycle_a,
      'person',
      'active',
      1,
      v_actor,
      v_actor
    ),
    (
      v_cycle_b,
      'person',
      'active',
      1,
      v_actor,
      v_actor
    );

  begin
    update editorial.people person
    set
      person_state =
        'merged',
      merged_into_person_resource_id =
        v_cycle_b
    where person.resource_id =
          v_cycle_a;

    update editorial.people person
    set
      person_state =
        'merged',
      merged_into_person_resource_id =
        v_cycle_a
    where person.resource_id =
          v_cycle_b;

    execute
      'set constraints editorial.people_merge_cycle_integrity immediate';

    raise exception
      'Verifier expected schema merge-cycle rejection';
  exception
    when others then
      if sqlerrm =
         'Verifier expected schema merge-cycle rejection'
      then
        raise;
      end if;

      if position(
           'merge cycle'
           in lower(sqlerrm)
         ) = 0
      then
        raise;
      end if;

      v_cycle_rejected :=
        true;
  end;

  execute
    'set constraints editorial.people_merge_cycle_integrity deferred';

  if not v_cycle_rejected then
    raise exception
      'STOP: Schema merge-cycle authority was not exercised';
  end if;

  raise notice
    'PASS: Migration B runtime acceptance completed in rollback-only fixtures.';
end;
$verify_people_migration_b_runtime$;

select jsonb_build_object(
  'verification',
    'PASS',
  'person_command_types',
    (
      select count(*)
      from platform_private.command_types
      where command_type like
            'person.%'
    ),
  'people_capabilities',
    (
      select count(*)
      from public.capability_definitions
      where capability_key in (
        'view_people_identity',
        'manage_people_identity',
        'merge_people_identity'
      )
    ),
  'fixture_target_work_count',
    (
      select count(*)
      from public.list_public_person_work(
        '00000000-0000-4000-8000-00000000b201'::uuid,
        50,
        null,
        null
      )
    ),
  'fixture_article_work_count',
    (
      select count(*)
      from public.list_public_person_work(
        '00000000-0000-4000-8000-00000000b201'::uuid,
        50,
        null,
        null
      ) work
      where work.resource_id =
            '00000000-0000-4000-8000-00000000b401'::uuid
    ),
  'fixture_playlist_work_count',
    (
      select count(*)
      from public.list_public_person_work(
        '00000000-0000-4000-8000-00000000b201'::uuid,
        50,
        null,
        null
      ) work
      where work.resource_id =
            '00000000-0000-4000-8000-00000000b501'::uuid
    ),
  'fixture_merge_transfer_rows',
    (
      select count(*)
      from editorial.person_follow_merge_transfers
      where merge_event_id in (
        select id
        from editorial.person_identity_events
        where correlation_id =
          '00000000-0000-4000-8000-00000000ba05'::uuid
          and person_resource_id =
            '00000000-0000-4000-8000-00000000b202'::uuid
      )
    )
) as people_person_migration_b_acceptance;
rollback;
