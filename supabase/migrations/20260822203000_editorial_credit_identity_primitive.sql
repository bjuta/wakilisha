-- Shared Editorial Credit identity primitive.
--
-- Product rules:
-- - editors choose canonical People or Organizations plus a semantic Credit role;
-- - raw account / Registry Author / external-contributor ids remain behind authority;
-- - an existing exact governed Credit is reused deterministically;
-- - only actors with manage_credits may mint a missing Credit;
-- - consumers that may edit content but not manage Credit authority may still attach
--   an already-governed public-safe Credit;
-- - this migration does not replace or overload the legacy public.create_credit RPC.

begin;

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'editorial-credit-identity-primitive',
    0
  )
);

do $editorial_credit_preflight$
begin
  if to_regclass('editorial.credits') is null
     or to_regclass('editorial.credit_governance') is null
     or to_regclass('editorial.credit_roles') is null
     or to_regclass('editorial.people') is null
     or to_regclass('editorial.person_identity_links') is null
     or to_regclass('editorial.organizations') is null
     or to_regprocedure('editorial.resolve_credit_person(uuid)') is null
     or to_regprocedure('editorial.resolve_credit_organization(uuid)') is null
     or to_regprocedure('editorial.resolve_person_presentation(uuid)') is null
     or to_regprocedure('editorial.assert_credit_command_actor()') is null
     or to_regprocedure('public.create_credit(text,uuid,uuid,uuid,text,text,boolean)') is null
  then
    raise exception
      'STOP: shared Credit, Person, or Organization authority is incomplete.';
  end if;
end;
$editorial_credit_preflight$;

create or replace function editorial.current_user_can_use_credit_identity()
returns boolean
language sql
stable
security definer
set search_path to
  'pg_catalog',
  'auth',
  'public'
as $function$
  select
    auth.uid() is not null
    and (
      coalesce(public.current_user_is_administrator(), false)
      or coalesce(public.current_user_has_capability('view_trust_records'), false)
      or coalesce(public.current_user_has_capability('manage_credits'), false)
      or coalesce(public.current_user_has_capability('edit_own_articles'), false)
      or coalesce(public.current_user_has_capability('edit_others_articles'), false)
      or coalesce(public.current_user_has_capability('edit_own_playlists'), false)
      or coalesce(public.current_user_has_capability('edit_others_playlists'), false)
      or coalesce(public.current_user_has_capability('edit_own_audio'), false)
      or coalesce(public.current_user_has_capability('edit_others_audio'), false)
    );
$function$;

revoke all
  on function editorial.current_user_can_use_credit_identity()
  from public, anon, authenticated, service_role;

create or replace function public.list_editorial_credit_picker_options(
  p_query text default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path to
  'pg_catalog',
  'auth',
  'public',
  'editorial'
as $function$
declare
  v_query text :=
    nullif(lower(btrim(coalesce(p_query, ''))), '');
  v_limit integer :=
    least(greatest(coalesce(p_limit, 50), 1), 100);
  v_can_create_credit boolean;
  v_roles jsonb;
  v_parties jsonb;
begin
  if not coalesce(
    editorial.current_user_can_use_credit_identity(),
    false
  ) then
    raise exception using
      errcode = '42501',
      message = 'Editorial Credit access is required.';
  end if;

  v_can_create_credit :=
    coalesce(public.current_user_is_administrator(), false)
    or coalesce(
      public.current_user_has_capability('manage_credits'),
      false
    );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'credit_role', role.credit_role,
        'label', role.label
      )
      order by role.sort_order, role.credit_role
    ),
    '[]'::jsonb
  )
  into v_roles
  from editorial.credit_roles role
  where role.enabled;

  with person_parties as (
    select
      'person'::text as party_kind,
      person.resource_id,
      presentation.payload ->> 'display_name'
        as display_name,
      alias.path as canonical_path,
      presentation.payload ->> 'identity_kind'
        as identity_kind,
      coalesce(
        (
          select jsonb_agg(role_name order by role_name)
          from (
            select distinct credit.credit_role as role_name
            from editorial.credits credit
            join editorial.credit_governance governance
              on governance.credit_id = credit.id
            where governance.credit_state = 'active'
              and governance.public_safe
              and editorial.resolve_credit_person(credit.id) =
                    person.resource_id
          ) available
        ),
        '[]'::jsonb
      ) as available_credit_roles
    from editorial.people person
    join editorial.resources resource
      on resource.id = person.resource_id
     and resource.resource_kind = 'person'
     and resource.lifecycle_state = 'active'
     and resource.visibility = 'public'
    join lateral (
      select editorial.resolve_person_presentation(
        person.resource_id
      ) as payload
    ) presentation
      on presentation.payload is not null
    join lateral (
      select resource_alias.path
      from editorial.resource_aliases resource_alias
      where resource_alias.resource_id = person.resource_id
        and resource_alias.is_canonical
        and resource_alias.retired_at is null
        and resource_alias.path like '/people/%'
      order by resource_alias.created_at, resource_alias.path
      limit 1
    ) alias on true
    where person.person_state = 'active'
      and nullif(
            btrim(presentation.payload ->> 'display_name'),
            ''
          ) is not null
  ),
  organization_parties as (
    select
      'organization'::text as party_kind,
      organization.resource_id,
      organization.display_name,
      alias.path as canonical_path,
      'organization'::text as identity_kind,
      coalesce(
        (
          select jsonb_agg(role_name order by role_name)
          from (
            select distinct credit.credit_role as role_name
            from editorial.credits credit
            join editorial.credit_governance governance
              on governance.credit_id = credit.id
            where governance.credit_state = 'active'
              and governance.public_safe
              and editorial.resolve_credit_organization(credit.id) =
                    organization.resource_id
          ) available
        ),
        '[]'::jsonb
      ) as available_credit_roles
    from editorial.organizations organization
    join editorial.resources resource
      on resource.id = organization.resource_id
     and resource.resource_kind = 'organization'
     and resource.lifecycle_state = 'active'
     and resource.visibility = 'public'
    join lateral (
      select resource_alias.path
      from editorial.resource_aliases resource_alias
      where resource_alias.resource_id = organization.resource_id
        and resource_alias.is_canonical
        and resource_alias.retired_at is null
        and resource_alias.path like '/organizations/%'
      order by resource_alias.created_at, resource_alias.path
      limit 1
    ) alias on true
    where organization.organization_state = 'active'
      and nullif(btrim(organization.display_name), '') is not null
  ),
  filtered as (
    select *
    from (
      select * from person_parties
      union all
      select * from organization_parties
    ) party
    where v_query is null
       or lower(party.display_name) like '%' || v_query || '%'
       or lower(party.canonical_path) like '%' || v_query || '%'
    order by
      lower(party.display_name),
      party.party_kind,
      party.resource_id
    limit v_limit
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'party_kind', party.party_kind,
        'resource_id', party.resource_id,
        'display_name', party.display_name,
        'canonical_path', party.canonical_path,
        'identity_kind', party.identity_kind,
        'available_credit_roles', party.available_credit_roles
      )
      order by
        lower(party.display_name),
        party.party_kind,
        party.resource_id
    ),
    '[]'::jsonb
  )
  into v_parties
  from filtered party;

  return jsonb_build_object(
    'can_create_credit', v_can_create_credit,
    'roles', v_roles,
    'parties', v_parties
  );
end;
$function$;

revoke all
  on function public.list_editorial_credit_picker_options(text,integer)
  from public, anon;

grant execute
  on function public.list_editorial_credit_picker_options(text,integer)
  to authenticated;

comment on function public.list_editorial_credit_picker_options(text,integer) is
  'Semantic Credit picker options over canonical public Person and Organization identity. Raw source-identity ids are not returned.';

create or replace function public.resolve_editorial_credit(
  p_party_kind text,
  p_party_resource_id uuid,
  p_credit_role text,
  p_public_safe boolean default true
)
returns jsonb
language plpgsql
volatile
security definer
set search_path to
  'pg_catalog',
  'auth',
  'public',
  'editorial'
as $function$
declare
  v_party_kind text :=
    lower(btrim(coalesce(p_party_kind, '')));
  v_credit_role text :=
    lower(btrim(coalesce(p_credit_role, '')));
  v_public_safe boolean :=
    coalesce(p_public_safe, true);
  v_actor_id uuid;
  v_credit_id uuid;
  v_existing_public_safe boolean;
  v_display_name text;
  v_registry_author_slug text;
  v_user_username text;
  v_person editorial.people%rowtype;
  v_person_presentation jsonb;
  v_identity_link editorial.person_identity_links%rowtype;
  v_organization editorial.organizations%rowtype;
begin
  if not coalesce(
    editorial.current_user_can_use_credit_identity(),
    false
  ) then
    raise exception using
      errcode = '42501',
      message = 'Editorial Credit access is required.';
  end if;

  if p_party_resource_id is null
     or v_party_kind not in ('person', 'organization')
  then
    raise exception using
      errcode = '22023',
      message = 'Choose a canonical Person or Organization.';
  end if;

  if not exists (
    select 1
    from editorial.credit_roles role
    where role.credit_role = v_credit_role
      and role.enabled
  ) then
    raise exception using
      errcode = '22023',
      message = 'Choose an enabled Credit role.';
  end if;

  -- One canonical party + role must converge on one governed Credit even
  -- when two editors resolve the same missing role concurrently.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'editorial-credit:' ||
      v_party_kind || ':' ||
      p_party_resource_id::text || ':' ||
      v_credit_role || ':' ||
      v_public_safe::text,
      0
    )
  );

  if v_party_kind = 'person' then
    select person.*
    into v_person
    from editorial.people person
    join editorial.resources resource
      on resource.id = person.resource_id
     and resource.resource_kind = 'person'
     and resource.lifecycle_state = 'active'
     and resource.visibility = 'public'
    where person.resource_id = p_party_resource_id
      and person.person_state = 'active';

    if not found or not exists (
      select 1
      from editorial.resource_aliases resource_alias
      where resource_alias.resource_id = p_party_resource_id
        and resource_alias.is_canonical
        and resource_alias.retired_at is null
        and resource_alias.path like '/people/%'
    ) then
      raise exception
        'The selected Person is not an active canonical public identity.';
    end if;

    v_person_presentation :=
      editorial.resolve_person_presentation(
        p_party_resource_id
      );

    if v_person_presentation is null then
      raise exception
        'The selected Person has no public presentation identity.';
    end if;

    select
      credit.id,
      governance.public_safe
    into
      v_credit_id,
      v_existing_public_safe
    from editorial.credits credit
    join editorial.credit_governance governance
      on governance.credit_id = credit.id
    where credit.credit_role = v_credit_role
      and governance.credit_state = 'active'
      and (
        not v_public_safe
        or governance.public_safe
      )
      and editorial.resolve_credit_person(credit.id) =
            p_party_resource_id
    order by
      governance.public_safe desc,
      credit.created_at,
      credit.id
    limit 1;

    if v_credit_id is not null then
      return jsonb_build_object(
        'credit_id', v_credit_id,
        'party_kind', v_party_kind,
        'party_resource_id', p_party_resource_id,
        'credit_role', v_credit_role,
        'display_name',
          v_person_presentation ->> 'display_name',
        'public_safe', v_existing_public_safe,
        'created', false
      );
    end if;

    -- Missing Credit creation is a Trust-authority mutation.
    v_actor_id := editorial.assert_credit_command_actor();

    select link.*
    into v_identity_link
    from editorial.person_identity_links link
    where link.person_resource_id = p_party_resource_id
      and link.link_state = 'active'
      and (
        (
          v_person_presentation ->> 'identity_kind' =
            'registry_author'
          and link.registry_author_id is not null
        )
        or (
          v_person_presentation ->> 'identity_kind' =
            'user'
          and link.user_id is not null
        )
        or (
          v_person_presentation ->> 'identity_kind' =
            'external_contributor'
          and link.external_contributor_id is not null
        )
      )
    order by
      case
        when link.id = v_person.preferred_identity_link_id
          then 0
        else 1
      end,
      link.created_at,
      link.id
    limit 1;

    if not found then
      raise exception
        'The selected Person public presentation has no active identity binding.';
    end if;

    v_display_name :=
      nullif(
        btrim(v_person_presentation ->> 'display_name'),
        ''
      );

    if v_display_name is null then
      raise exception
        'The selected Person display name is missing.';
    end if;

    if v_identity_link.registry_author_id is not null then
      v_registry_author_slug :=
        nullif(
          btrim(
            v_person_presentation ->>
              'registry_author_slug'
          ),
          ''
        );

      if v_registry_author_slug is null then
        raise exception
          'Registry Author Credit identity is incomplete.';
      end if;
    elsif v_identity_link.user_id is not null then
      v_user_username :=
        nullif(
          btrim(
            v_person_presentation ->> 'username'
          ),
          ''
        );
    else
      if v_public_safe and not exists (
        select 1
        from editorial.external_contributors contributor
        where contributor.id =
              v_identity_link.external_contributor_id
          and contributor.contributor_state = 'active'
          and contributor.public_safe
          and contributor.consent_status in (
            'granted',
            'not_required'
          )
      ) then
        raise exception
          'Public-safe external-contributor Credits require active public-safe consent.';
      end if;
    end if;

    insert into editorial.credits (
      credit_role,
      user_id,
      registry_author_id,
      external_contributor_id,
      organization_resource_id,
      display_name_snapshot,
      role_label_snapshot,
      registry_author_slug_snapshot,
      user_username_snapshot,
      credit_note,
      created_by
    )
    values (
      v_credit_role,
      v_identity_link.user_id,
      v_identity_link.registry_author_id,
      v_identity_link.external_contributor_id,
      null,
      v_display_name,
      null,
      v_registry_author_slug,
      v_user_username,
      null,
      v_actor_id
    )
    returning id
    into v_credit_id;

  else
    select organization.*
    into v_organization
    from editorial.organizations organization
    join editorial.resources resource
      on resource.id = organization.resource_id
     and resource.resource_kind = 'organization'
     and resource.lifecycle_state = 'active'
     and resource.visibility = 'public'
    where organization.resource_id =
          p_party_resource_id
      and organization.organization_state = 'active';

    if not found or not exists (
      select 1
      from editorial.resource_aliases resource_alias
      where resource_alias.resource_id = p_party_resource_id
        and resource_alias.is_canonical
        and resource_alias.retired_at is null
        and resource_alias.path like '/organizations/%'
    ) then
      raise exception
        'The selected Organization is not an active canonical public identity.';
    end if;

    select
      credit.id,
      governance.public_safe
    into
      v_credit_id,
      v_existing_public_safe
    from editorial.credits credit
    join editorial.credit_governance governance
      on governance.credit_id = credit.id
    where credit.credit_role = v_credit_role
      and governance.credit_state = 'active'
      and (
        not v_public_safe
        or governance.public_safe
      )
      and editorial.resolve_credit_organization(credit.id) =
            p_party_resource_id
    order by
      governance.public_safe desc,
      credit.created_at,
      credit.id
    limit 1;

    if v_credit_id is not null then
      return jsonb_build_object(
        'credit_id', v_credit_id,
        'party_kind', v_party_kind,
        'party_resource_id', p_party_resource_id,
        'credit_role', v_credit_role,
        'display_name', v_organization.display_name,
        'public_safe', v_existing_public_safe,
        'created', false
      );
    end if;

    v_actor_id := editorial.assert_credit_command_actor();
    v_display_name :=
      nullif(btrim(v_organization.display_name), '');

    insert into editorial.credits (
      credit_role,
      user_id,
      registry_author_id,
      external_contributor_id,
      organization_resource_id,
      display_name_snapshot,
      role_label_snapshot,
      registry_author_slug_snapshot,
      user_username_snapshot,
      credit_note,
      created_by
    )
    values (
      v_credit_role,
      null,
      null,
      null,
      p_party_resource_id,
      v_display_name,
      null,
      null,
      null,
      null,
      v_actor_id
    )
    returning id
    into v_credit_id;
  end if;

  insert into editorial.credit_governance (
    credit_id,
    public_safe,
    credit_state,
    governance_revision,
    reason,
    updated_by,
    updated_at
  )
  values (
    v_credit_id,
    v_public_safe,
    'active',
    1,
    null,
    v_actor_id,
    now()
  );

  return jsonb_build_object(
    'credit_id', v_credit_id,
    'party_kind', v_party_kind,
    'party_resource_id', p_party_resource_id,
    'credit_role', v_credit_role,
    'display_name', v_display_name,
    'public_safe', v_public_safe,
    'created', true
  );
end;
$function$;

revoke all
  on function public.resolve_editorial_credit(text,uuid,text,boolean)
  from public, anon;

grant execute
  on function public.resolve_editorial_credit(text,uuid,text,boolean)
  to authenticated;

comment on function public.resolve_editorial_credit(text,uuid,text,boolean) is
  'Resolve or create one exact governed Credit for a canonical Person/Organization plus semantic role. Existing Credits are reusable by authenticated consumers; minting a missing Credit still requires manage_credits authority.';

commit;
