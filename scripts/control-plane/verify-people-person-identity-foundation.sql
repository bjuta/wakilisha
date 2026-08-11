-- Verify People / Contributor Identity Migration A.
--
-- Read-only acceptance:
-- - Person is a typed Resource;
-- - internal identity governance stays private;
-- - exact proof People exist when the production proof sources exist;
-- - public Person read exposes identity only;
-- - no Person Follow authority was created by Migration A.

do $verify_people_person_identity_foundation$
declare
  v_binding_definition text;
  v_public_definition text;
  v_presentation_definition text;
  v_create_person_definition text;
  v_resource_index_definition text;
  v_owner_index_definition text;
  v_expected_proof_count integer := 0;
  v_person_count integer;
  v_person_alias_count integer;
  v_public_person_count integer;
  v_hafare_person_id uuid;
  v_hafare_path text;
  v_hafare_public jsonb;
  v_active_user_link_count integer;
  v_active_registry_link_count integer;
  v_active_external_link_count integer;
  v_active_link_count integer;
  v_multi_link_person_count integer;
  v_creation_event_count integer;
  v_person_follow_count integer;
begin
  if not exists (
    select 1
    from editorial.resource_kinds kind
    where kind.kind = 'person'
      and kind.enabled
  ) then
    raise exception
      'VERIFY FAIL: Person Resource kind is missing or disabled';
  end if;

  if to_regclass('editorial.people') is null
     or to_regclass('editorial.person_identity_links') is null
     or to_regclass('editorial.person_identity_events') is null
  then
    raise exception
      'VERIFY FAIL: Person authority tables are incomplete';
  end if;

  if to_regprocedure(
       'editorial.refresh_person_visibility(uuid)'
     ) is null
     or to_regprocedure(
          'editorial.ensure_person_for_user(uuid)'
        ) is null
     or to_regprocedure(
          'editorial.ensure_person_for_registry_author(uuid)'
        ) is null
     or to_regprocedure(
          'editorial.ensure_person_for_external_contributor(uuid)'
        ) is null
     or to_regprocedure(
          'public.get_public_person(text)'
        ) is null
  then
    raise exception
      'VERIFY FAIL: Person foundation functions are incomplete';
  end if;

  select pg_get_functiondef(
    'editorial.assert_resource_binding_integrity()'::regprocedure
  )
  into v_binding_definition;

  if position(
       'when ''person'''
       in lower(v_binding_definition)
     ) = 0
  then
    raise exception
      'VERIFY FAIL: Resource binding integrity does not understand Person';
  end if;

  select pg_get_functiondef(
    'public.get_public_person(text)'::regprocedure
  )
  into v_public_definition;

  if position(
       'follower_count'
       in lower(v_public_definition)
     ) > 0
     or position(
          'public_roles'
          in lower(v_public_definition)
        ) > 0
     or position(
          'contact_email'
          in lower(v_public_definition)
        ) > 0
     or position(
          'contact_phone'
          in lower(v_public_definition)
        ) > 0
     or position(
          'internal_notes'
          in lower(v_public_definition)
        ) > 0
     or position(
          '''email'''
          in lower(v_public_definition)
        ) > 0
  then
    raise exception
      'VERIFY FAIL: Migration A public Person read exceeds identity-only or private-data boundary';
  end if;

  select pg_get_functiondef(
    'editorial.resolve_person_presentation(uuid)'::regprocedure
  )
  into v_presentation_definition;

  if position(
       'contact_email'
       in lower(v_presentation_definition)
     ) > 0
     or position(
          'contact_phone'
          in lower(v_presentation_definition)
        ) > 0
     or position(
          'internal_notes'
          in lower(v_presentation_definition)
        ) > 0
     or position(
          'profile.email'
          in lower(v_presentation_definition)
        ) > 0
  then
    raise exception
      'VERIFY FAIL: Person presentation resolver exposes private identity data';
  end if;

  select pg_get_functiondef(
    'editorial.create_person_for_identity(uuid,uuid,uuid,text,text)'::regprocedure
  )
  into v_create_person_definition;

  if position(
       'pg_advisory_xact_lock'
       in lower(v_create_person_definition)
     ) = 0
  then
    raise exception
      'VERIFY FAIL: One-source Person provisioning is not concurrency-serialized';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid =
          'editorial.person_identity_links'::regclass
      and trigger_row.tgname =
          'person_identity_links_preferred_integrity'
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'VERIFY FAIL: Preferred identity integrity is not enforced from identity-link mutations';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid =
          'public.user_profiles'::regclass
      and trigger_row.tgname =
          'user_profiles_person_visibility_sync'
      and not trigger_row.tgisinternal
  )
     or not exists (
          select 1
          from pg_trigger trigger_row
          where trigger_row.tgrelid =
                'editorial.external_contributors'::regclass
            and trigger_row.tgname =
                'external_contributors_person_visibility_sync'
            and not trigger_row.tgisinternal
        )
     or not exists (
          select 1
          from pg_trigger trigger_row
          where trigger_row.tgrelid =
                'editorial.people'::regclass
            and trigger_row.tgname =
                'people_state_visibility_sync'
            and not trigger_row.tgisinternal
        )
  then
    raise exception
      'VERIFY FAIL: Migration A visibility synchronization triggers are incomplete';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants grant_row
    where grant_row.table_schema = 'editorial'
      and grant_row.table_name in (
        'people',
        'person_identity_links',
        'person_identity_events'
      )
      and lower(grant_row.grantee) in (
        'public',
        'anon',
        'authenticated'
      )
  ) then
    raise exception
      'VERIFY FAIL: Browser roles have direct Person governance-table grants';
  end if;

  if has_function_privilege(
       'anon',
       'editorial.create_person_for_identity(uuid,uuid,uuid,text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
          'authenticated',
          'editorial.create_person_for_identity(uuid,uuid,uuid,text,text)',
          'EXECUTE'
        )
     or has_function_privilege(
          'service_role',
          'editorial.ensure_person_for_user(uuid)',
          'EXECUTE'
        )
     or has_function_privilege(
          'service_role',
          'editorial.ensure_person_for_registry_author(uuid)',
          'EXECUTE'
        )
     or has_function_privilege(
          'service_role',
          'editorial.ensure_person_for_external_contributor(uuid)',
          'EXECUTE'
        )
     or has_function_privilege(
          'anon',
          'editorial.resolve_person_presentation(uuid)',
          'EXECUTE'
        )
     or has_function_privilege(
          'authenticated',
          'editorial.resolve_person_presentation(uuid)',
          'EXECUTE'
        )
  then
    raise exception
      'VERIFY FAIL: Migration A exposes Person provisioning authority before Migration C';
  end if;

  select pg_get_viewdef(
    'public.wk_resource_index'::regclass,
    true
  )
  into v_resource_index_definition;

  if position(
       'resource_kind = ''person'''
       in lower(v_resource_index_definition)
     ) = 0
     or position(
          'editorial.people'
          in lower(v_resource_index_definition)
        ) > 0
  then
    raise exception
      'VERIFY FAIL: Public Resource index Person branch is missing or exposes internal Person table';
  end if;

  select pg_get_viewdef(
    'public.wk_resource_owner_index'::regclass,
    true
  )
  into v_owner_index_definition;

  if position(
       'resource_kind = ''person'''
       in lower(v_owner_index_definition)
     ) = 0
     or position(
          'editorial.people'
          in lower(v_owner_index_definition)
        ) > 0
  then
    raise exception
      'VERIFY FAIL: Owner index Person branch is missing or exposes internal Person table';
  end if;

  if exists (
    select 1
    from public.registry_authors author
    where author.slug = 'hafare-segelan'
  ) then
    v_expected_proof_count :=
      v_expected_proof_count + 1;

    select link.person_resource_id
    into v_hafare_person_id
    from editorial.person_identity_links link
    join public.registry_authors author
      on author.id = link.registry_author_id
    where author.slug = 'hafare-segelan'
      and link.link_state = 'active';

    if v_hafare_person_id is null then
      raise exception
        'VERIFY FAIL: Hafare Registry Author proof Person is missing';
    end if;

    select alias.path
    into v_hafare_path
    from editorial.resource_aliases alias
    where alias.resource_id =
          v_hafare_person_id
      and alias.is_canonical
      and alias.retired_at is null;

    if v_hafare_path is null
       or v_hafare_path not like '/people/%'
    then
      raise exception
        'VERIFY FAIL: Hafare Person has no canonical /people/ path';
    end if;

    v_hafare_public :=
      public.get_public_person(
        substring(
          v_hafare_path
          from length('/people/') + 1
        )
      );

    if v_hafare_public is null
       or v_hafare_public ->> 'person_id'
            is distinct from
            v_hafare_person_id::text
       or v_hafare_public
            ? 'follower_count'
       or v_hafare_public
            ? 'public_roles'
       or v_hafare_public
            ? 'email'
       or v_hafare_public
            ? 'contact_email'
       or v_hafare_public
            ? 'contact_phone'
       or v_hafare_public
            ? 'internal_notes'
    then
      raise exception
        'VERIFY FAIL: Hafare public Person read is missing or exceeds Migration A boundary';
    end if;
  end if;

  if exists (
    select 1
    from public.user_profiles profile
    where profile.status = 'active'
      and profile.is_public
      and profile.username_normalized
          is not null
      and not exists (
        select 1
        from public.registry_authors author
        where author.email is not null
          and profile.email is not null
          and lower(
                btrim(author.email)
              ) =
              lower(
                btrim(profile.email)
              )
      )
      and not exists (
        select 1
        from editorial.external_contributors contributor
        where contributor.contact_email
                is not null
          and profile.email is not null
          and lower(
                btrim(
                  contributor.contact_email
                )
              ) =
              lower(
                btrim(profile.email)
              )
      )
  ) then
    v_expected_proof_count :=
      v_expected_proof_count + 1;

    if not exists (
      select 1
      from editorial.person_identity_links link
      where link.user_id is not null
        and link.link_state = 'active'
    ) then
      raise exception
        'VERIFY FAIL: Public-account proof Person is missing';
    end if;
  end if;

  if exists (
    select 1
    from editorial.external_contributors contributor
    where contributor.contributor_state =
          'active'
      and contributor.public_safe
      and contributor.consent_status in (
        'granted',
        'not_required'
      )
      and not exists (
        select 1
        from public.registry_authors author
        where contributor.contact_email
                is not null
          and author.email is not null
          and lower(
                btrim(
                  contributor.contact_email
                )
              ) =
              lower(
                btrim(author.email)
              )
      )
      and not exists (
        select 1
        from public.user_profiles profile
        where contributor.contact_email
                is not null
          and profile.email is not null
          and lower(
                btrim(
                  contributor.contact_email
                )
              ) =
              lower(
                btrim(profile.email)
              )
      )
  ) then
    v_expected_proof_count :=
      v_expected_proof_count + 1;

    if not exists (
      select 1
      from editorial.person_identity_links link
      where link.external_contributor_id
              is not null
        and link.link_state = 'active'
    ) then
      raise exception
        'VERIFY FAIL: Public-safe external-contributor proof Person is missing';
    end if;
  end if;

  select count(*)
  into v_person_count
  from editorial.people;

  select count(*)
  into v_person_alias_count
  from editorial.resource_aliases alias
  join editorial.resources resource
    on resource.id = alias.resource_id
   and resource.resource_kind = 'person'
  where alias.is_canonical
    and alias.retired_at is null
    and alias.path like '/people/%';

  select count(*)
  into v_public_person_count
  from editorial.resources resource
  where resource.resource_kind = 'person'
    and resource.visibility = 'public'
    and resource.lifecycle_state = 'active';

  select count(*)
  into v_active_user_link_count
  from editorial.person_identity_links link
  where link.link_state = 'active'
    and link.user_id is not null;

  select count(*)
  into v_active_registry_link_count
  from editorial.person_identity_links link
  where link.link_state = 'active'
    and link.registry_author_id is not null;

  select count(*)
  into v_active_external_link_count
  from editorial.person_identity_links link
  where link.link_state = 'active'
    and link.external_contributor_id is not null;

  select count(*)
  into v_active_link_count
  from editorial.person_identity_links link
  where link.link_state = 'active';

  select count(*)
  into v_creation_event_count
  from editorial.person_identity_events event
  where event.event_type = 'person_created';

  select count(*)
  into v_multi_link_person_count
  from (
    select link.person_resource_id
    from editorial.person_identity_links link
    where link.link_state = 'active'
    group by link.person_resource_id
    having count(*) > 1
  ) multi;

  if v_person_count <>
       v_expected_proof_count
     or v_person_alias_count <>
        v_expected_proof_count
     or v_public_person_count <>
        v_expected_proof_count
  then
    raise exception
      'VERIFY FAIL: Migration A proof cardinality mismatch. expected %, people %, aliases %, public %',
      v_expected_proof_count,
      v_person_count,
      v_person_alias_count,
      v_public_person_count;
  end if;

  if v_active_link_count <> v_person_count
     or v_creation_event_count <> v_person_count
     or exists (
          select 1
          from editorial.people person
          where person.identity_revision <> 1
            or person.preferred_identity_link_id is null
            or not exists (
                 select 1
                 from editorial.person_identity_links link
                 where link.id = person.preferred_identity_link_id
                   and link.person_resource_id = person.resource_id
                   and link.link_state = 'active'
               )
        )
  then
    raise exception
      'VERIFY FAIL: Migration A Person/link/event revision invariants are incomplete';
  end if;

  if v_multi_link_person_count <> 0 then
    raise exception
      'VERIFY FAIL: Migration A auto-reconciled different source identities into one Person';
  end if;

  if exists (
    select 1
    from editorial.person_identity_links link
    join editorial.resources resource
      on resource.id =
         link.person_resource_id
    where link.link_state = 'active'
      and link.user_id is not null
      and resource.owner_id
            is distinct from link.user_id
  ) then
    raise exception
      'VERIFY FAIL: Account-backed Person ownership does not match its account identity';
  end if;

  select count(*)
  into v_person_follow_count
  from public.community_follows follow
  where follow.target_type = 'person';

  if v_person_follow_count <> 0 then
    raise exception
      'VERIFY FAIL: Person Follow rows exist before Migration C authority';
  end if;

  raise notice
    'PEOPLE_PERSON_IDENTITY_FOUNDATION_VERIFIED expected_proofs=% people=% aliases=% public=% account_links=% registry_links=% external_links=% person_follows=%',
    v_expected_proof_count,
    v_person_count,
    v_person_alias_count,
    v_public_person_count,
    v_active_user_link_count,
    v_active_registry_link_count,
    v_active_external_link_count,
    v_person_follow_count;
end;
$verify_people_person_identity_foundation$;

select jsonb_build_object(
  'verification',
    'PASS',
  'person_count',
    (
      select count(*)
      from editorial.people
    ),
  'public_person_count',
    (
      select count(*)
      from editorial.resources resource
      where resource.resource_kind =
            'person'
        and resource.visibility =
            'public'
    ),
  'canonical_people_paths',
    (
      select count(*)
      from editorial.resource_aliases alias
      join editorial.resources resource
        on resource.id =
           alias.resource_id
       and resource.resource_kind =
           'person'
      where alias.is_canonical
        and alias.retired_at is null
        and alias.path like '/people/%'
    ),
  'active_account_links',
    (
      select count(*)
      from editorial.person_identity_links link
      where link.link_state = 'active'
        and link.user_id is not null
    ),
  'active_registry_author_links',
    (
      select count(*)
      from editorial.person_identity_links link
      where link.link_state = 'active'
        and link.registry_author_id
              is not null
    ),
  'active_external_contributor_links',
    (
      select count(*)
      from editorial.person_identity_links link
      where link.link_state = 'active'
        and link.external_contributor_id
              is not null
    ),
  'person_creation_events',
    (
      select count(*)
      from editorial.person_identity_events event
      where event.event_type = 'person_created'
    ),
  'person_follow_rows',
    (
      select count(*)
      from public.community_follows follow
      where follow.target_type = 'person'
    )
) as people_person_identity_foundation_acceptance;
