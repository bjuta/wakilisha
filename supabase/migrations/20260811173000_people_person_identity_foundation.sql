-- People / Contributor Identity Migration A:
-- stable Person Resource identity foundation.
--
-- This migration creates only:
-- 1. the Person Resource kind and typed Person authority;
-- 2. explicit typed identity links to account, Registry Author, or external contributor;
-- 3. append-only Person identity events;
-- 4. public-safe Person presentation and canonical /people/ aliases;
-- 5. immediate account privacy and external-contributor consent visibility sync;
-- 6. exactly three conditional proof People in production data:
--    Hafare Segelan, one conservative public-account proof, and one
--    conservative public-safe external-contributor proof.
--
-- This migration does not:
-- - bulk backfill People;
-- - merge identities;
-- - expose current-public body of work;
-- - validate or enable Person Follow;
-- - expose follower counts;
-- - change frontend routes.

begin;

do $people_migration_a_preflight$
declare
  v_resource_index_dependents integer;
  v_owner_index_dependents integer;
  v_binding_definition text;
begin
  if to_regclass('editorial.resources') is null
     or to_regclass('editorial.resource_kinds') is null
     or to_regclass('editorial.resource_aliases') is null
     or to_regclass('public.user_profiles') is null
     or to_regclass('public.registry_authors') is null
     or to_regclass('editorial.external_contributors') is null
     or to_regclass('public.wk_resource_index') is null
     or to_regclass('public.wk_resource_owner_index') is null
  then
    raise exception
      'STOP: Required Resource or identity authority is missing';
  end if;

  if to_regprocedure(
       'editorial.assert_resource_binding_integrity()'
     ) is null
  then
    raise exception
      'STOP: Resource binding integrity authority is missing';
  end if;

  select pg_get_functiondef(
    'editorial.assert_resource_binding_integrity()'::regprocedure
  )
  into v_binding_definition;

  if position('playlist_item' in v_binding_definition) = 0
     or position('registry_artist' in v_binding_definition) = 0
     or position('correction_case' in v_binding_definition) = 0
     or position('media_asset' in v_binding_definition) = 0
  then
    raise exception
      'STOP: Resource binding integrity is older than the accepted authority';
  end if;

  if exists (
    select 1
    from editorial.resource_kinds
    where kind = 'person'
  )
     or to_regclass('editorial.people') is not null
     or to_regclass('editorial.person_identity_links') is not null
     or to_regclass('editorial.person_identity_events') is not null
     or to_regprocedure(
          'public.get_public_person(text)'
        ) is not null
  then
    raise exception
      'STOP: Person identity authority already exists';
  end if;

  if exists (
    select 1
    from editorial.resource_aliases
    where path like '/people/%'
  ) then
    raise exception
      'STOP: /people/ Resource aliases already exist';
  end if;

  select count(*)
  into v_resource_index_dependents
  from pg_depend dependency
  join pg_rewrite rewrite_rule
    on rewrite_rule.oid = dependency.objid
  join pg_class dependent_relation
    on dependent_relation.oid = rewrite_rule.ev_class
  where dependency.refobjid =
        'public.wk_resource_index'::regclass
    and dependent_relation.oid <>
        'public.wk_resource_index'::regclass;

  if v_resource_index_dependents <> 0 then
    raise exception
      'STOP: public.wk_resource_index has % dependent database objects',
      v_resource_index_dependents;
  end if;

  select count(*)
  into v_owner_index_dependents
  from pg_depend dependency
  join pg_rewrite rewrite_rule
    on rewrite_rule.oid = dependency.objid
  join pg_class dependent_relation
    on dependent_relation.oid = rewrite_rule.ev_class
  where dependency.refobjid =
        'public.wk_resource_owner_index'::regclass
    and dependent_relation.oid <>
        'public.wk_resource_owner_index'::regclass;

  if v_owner_index_dependents <> 0 then
    raise exception
      'STOP: public.wk_resource_owner_index has % dependent database objects',
      v_owner_index_dependents;
  end if;
end;
$people_migration_a_preflight$;

insert into editorial.resource_kinds (
  kind,
  label,
  description,
  enabled
)
values (
  'person',
  'Person',
  'Stable cross-domain identity for a human represented across WAKILISHA account, Registry Author, external-contributor, and Credit authorities.',
  true
);

create table editorial.people (
  resource_id uuid primary key,
  resource_kind text not null default 'person',
  person_state text not null default 'active',
  identity_revision bigint not null default 1,
  preferred_identity_link_id uuid,
  merged_into_person_resource_id uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint people_resource_kind_check
    check (resource_kind = 'person'),

  constraint people_resource_id_kind_key
    unique (resource_id, resource_kind),

  constraint people_resource_fkey
    foreign key (resource_id, resource_kind)
    references editorial.resources(id, resource_kind)
    on update cascade
    on delete restrict,

  constraint people_merged_into_fkey
    foreign key (merged_into_person_resource_id)
    references editorial.people(resource_id)
    on update restrict
    on delete restrict
    deferrable initially deferred,

  constraint people_created_by_fkey
    foreign key (created_by)
    references auth.users(id)
    on delete set null,

  constraint people_updated_by_fkey
    foreign key (updated_by)
    references auth.users(id)
    on delete set null,

  constraint people_state_check
    check (
      person_state in (
        'active',
        'merged',
        'archived'
      )
    ),

  constraint people_identity_revision_check
    check (identity_revision >= 1),

  constraint people_merge_state_check
    check (
      (
        person_state = 'merged'
        and merged_into_person_resource_id is not null
        and merged_into_person_resource_id <> resource_id
      )
      or
      (
        person_state <> 'merged'
        and merged_into_person_resource_id is null
      )
    )
);

comment on table editorial.people is
  'Typed Person authority. The Person Resource UUID is the permanent human identity; source profile authorities remain separate.';

create table editorial.person_identity_links (
  id uuid primary key default gen_random_uuid(),
  person_resource_id uuid not null,
  person_resource_kind text not null default 'person',
  user_id uuid,
  registry_author_id uuid,
  external_contributor_id uuid,
  link_state text not null default 'active',
  link_method text not null,
  link_reason text not null,
  supersedes_link_id uuid,
  superseded_by_link_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  retired_by uuid,
  retired_at timestamptz,
  retired_reason text,

  constraint person_identity_links_person_kind_check
    check (person_resource_kind = 'person'),

  constraint person_identity_links_person_fkey
    foreign key (
      person_resource_id,
      person_resource_kind
    )
    references editorial.people(
      resource_id,
      resource_kind
    )
    on update restrict
    on delete restrict,

  constraint person_identity_links_user_fkey
    foreign key (user_id)
    references public.user_profiles(user_id)
    on update restrict
    on delete restrict,

  constraint person_identity_links_registry_author_fkey
    foreign key (registry_author_id)
    references public.registry_authors(id)
    on update restrict
    on delete restrict,

  constraint person_identity_links_external_contributor_fkey
    foreign key (external_contributor_id)
    references editorial.external_contributors(id)
    on update restrict
    on delete restrict,

  constraint person_identity_links_supersedes_fkey
    foreign key (supersedes_link_id)
    references editorial.person_identity_links(id)
    on update restrict
    on delete restrict
    deferrable initially deferred,

  constraint person_identity_links_superseded_by_fkey
    foreign key (superseded_by_link_id)
    references editorial.person_identity_links(id)
    on update restrict
    on delete restrict
    deferrable initially deferred,

  constraint person_identity_links_created_by_fkey
    foreign key (created_by)
    references auth.users(id)
    on delete set null,

  constraint person_identity_links_retired_by_fkey
    foreign key (retired_by)
    references auth.users(id)
    on delete set null,

  constraint person_identity_links_exactly_one_source_check
    check (
      num_nonnulls(
        user_id,
        registry_author_id,
        external_contributor_id
      ) = 1
    ),

  constraint person_identity_links_state_check
    check (
      link_state in (
        'active',
        'disputed',
        'superseded',
        'retired'
      )
    ),

  constraint person_identity_links_method_check
    check (
      link_method in (
        'migration_seed',
        'account_provisioning',
        'registry_author_provisioning',
        'external_contributor_provisioning',
        'admin_reconciliation',
        'claim_approved',
        'person_merge',
        'person_split'
      )
    ),

  constraint person_identity_links_reason_check
    check (
      nullif(btrim(link_reason), '') is not null
    ),

  constraint person_identity_links_retirement_check
    check (
      (
        link_state in ('active', 'disputed')
        and retired_at is null
        and retired_reason is null
      )
      or
      (
        link_state in ('superseded', 'retired')
        and retired_at is not null
        and nullif(btrim(retired_reason), '') is not null
      )
    ),

  constraint person_identity_links_supersession_check
    check (
      supersedes_link_id is null
      or supersedes_link_id <> id
    ),

  constraint person_identity_links_superseded_by_check
    check (
      superseded_by_link_id is null
      or superseded_by_link_id <> id
    ),

  constraint person_identity_links_id_person_key
    unique (id, person_resource_id)
);

comment on table editorial.person_identity_links is
  'Explicit typed reconciliation between one stable Person and existing account, Registry Author, or external-contributor identity authority.';

create unique index
  person_identity_links_active_user_unique
on editorial.person_identity_links(user_id)
where link_state = 'active'
  and user_id is not null;

create unique index
  person_identity_links_active_registry_author_unique
on editorial.person_identity_links(registry_author_id)
where link_state = 'active'
  and registry_author_id is not null;

create unique index
  person_identity_links_active_external_contributor_unique
on editorial.person_identity_links(external_contributor_id)
where link_state = 'active'
  and external_contributor_id is not null;

create unique index
  person_identity_links_one_active_user_per_person
on editorial.person_identity_links(person_resource_id)
where link_state = 'active'
  and user_id is not null;

create unique index
  person_identity_links_one_active_registry_author_per_person
on editorial.person_identity_links(person_resource_id)
where link_state = 'active'
  and registry_author_id is not null;

create index
  person_identity_links_person_state_idx
on editorial.person_identity_links(
  person_resource_id,
  link_state,
  created_at
);

alter table editorial.people
  add constraint people_preferred_identity_link_fkey
  foreign key (
    preferred_identity_link_id,
    resource_id
  )
  references editorial.person_identity_links(
    id,
    person_resource_id
  )
  on update restrict
  on delete restrict
  deferrable initially deferred;

create table editorial.person_identity_events (
  id uuid primary key default gen_random_uuid(),
  person_resource_id uuid not null,
  actor_id uuid,
  event_type text not null,
  identity_link_id uuid,
  related_person_resource_id uuid,
  prior_identity_revision bigint,
  resulting_identity_revision bigint not null,
  reason text,
  correlation_id uuid,
  created_at timestamptz not null default now(),

  constraint person_identity_events_person_fkey
    foreign key (person_resource_id)
    references editorial.people(resource_id)
    on update restrict
    on delete restrict,

  constraint person_identity_events_actor_fkey
    foreign key (actor_id)
    references auth.users(id)
    on delete set null,

  constraint person_identity_events_link_fkey
    foreign key (identity_link_id)
    references editorial.person_identity_links(id)
    on update restrict
    on delete restrict,

  constraint person_identity_events_related_person_fkey
    foreign key (related_person_resource_id)
    references editorial.people(resource_id)
    on update restrict
    on delete restrict,

  constraint person_identity_events_type_check
    check (
      event_type in (
        'person_created',
        'identity_linked',
        'identity_disputed',
        'identity_unlinked',
        'preferred_identity_changed',
        'person_merged',
        'person_split',
        'person_archived',
        'person_restored'
      )
    ),

  constraint person_identity_events_revision_check
    check (
      resulting_identity_revision >= 1
      and (
        prior_identity_revision is null
        or prior_identity_revision >= 1
      )
    )
);

comment on table editorial.person_identity_events is
  'Append-only Person identity governance history.';

create index
  person_identity_events_person_created_idx
on editorial.person_identity_events(
  person_resource_id,
  created_at desc,
  id desc
);

create or replace function
  editorial.protect_person_resource_binding()
returns trigger
language plpgsql
set search_path to 'pg_catalog'
as $function$
begin
  if new.resource_id is distinct from old.resource_id
     or new.resource_kind is distinct from old.resource_kind
  then
    raise exception
      'Person Resource binding cannot be retargeted.';
  end if;

  return new;
end;
$function$;

create trigger people_protect_resource_binding
before update of resource_id, resource_kind
on editorial.people
for each row
execute function editorial.protect_person_resource_binding();

create or replace function
  editorial.protect_person_identity_link_target()
returns trigger
language plpgsql
set search_path to 'pg_catalog'
as $function$
begin
  if new.person_resource_id
       is distinct from old.person_resource_id
     or new.person_resource_kind
       is distinct from old.person_resource_kind
     or new.user_id
       is distinct from old.user_id
     or new.registry_author_id
       is distinct from old.registry_author_id
     or new.external_contributor_id
       is distinct from old.external_contributor_id
  then
    raise exception
      'Person identity links cannot be retargeted.';
  end if;

  return new;
end;
$function$;

create trigger person_identity_links_protect_target
before update of
  person_resource_id,
  person_resource_kind,
  user_id,
  registry_author_id,
  external_contributor_id
on editorial.person_identity_links
for each row
execute function editorial.protect_person_identity_link_target();

create or replace function
  editorial.protect_person_identity_event()
returns trigger
language plpgsql
set search_path to 'pg_catalog'
as $function$
begin
  raise exception
    'Person identity events are append-only.';
end;
$function$;

create trigger person_identity_events_append_only
before update or delete
on editorial.person_identity_events
for each row
execute function editorial.protect_person_identity_event();

create or replace function
  editorial.assert_person_identity_integrity()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'editorial'
as $function$
declare
  v_person_resource_id uuid;
  v_preferred_identity_link_id uuid;
begin
  if tg_table_name = 'people' then
    v_person_resource_id := new.resource_id;
  elsif tg_op = 'DELETE' then
    v_person_resource_id := old.person_resource_id;
  else
    v_person_resource_id := new.person_resource_id;
  end if;

  select person.preferred_identity_link_id
  into v_preferred_identity_link_id
  from editorial.people person
  where person.resource_id = v_person_resource_id;

  if not found then
    return null;
  end if;

  if v_preferred_identity_link_id is not null
     and not exists (
       select 1
       from editorial.person_identity_links link
       where link.id = v_preferred_identity_link_id
         and link.person_resource_id = v_person_resource_id
         and link.link_state = 'active'
     )
  then
    raise exception
      'Preferred Person identity link must be active and belong to the same Person.';
  end if;

  return null;
end;
$function$;

create constraint trigger people_identity_integrity
after insert or update of preferred_identity_link_id
on editorial.people
deferrable initially deferred
for each row
execute function editorial.assert_person_identity_integrity();

create constraint trigger person_identity_links_preferred_integrity
after insert or update or delete
on editorial.person_identity_links
deferrable initially deferred
for each row
execute function editorial.assert_person_identity_integrity();

create or replace function
  editorial.assert_resource_binding_integrity()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'editorial'
as $function$
declare
  target_resource_id uuid;
  target_kind text;
  binding_count integer;
begin
  if tg_table_name = 'resources' then
    if tg_op = 'DELETE' then
      return null;
    end if;

    target_resource_id := new.id;
  else
    if tg_op = 'DELETE' then
      target_resource_id := old.resource_id;
    else
      target_resource_id := new.resource_id;
    end if;
  end if;

  select resource_kind
  into target_kind
  from editorial.resources
  where id = target_resource_id;

  if not found then
    return null;
  end if;

  case target_kind
    when 'article' then
      select count(*)
      into binding_count
      from editorial.article_resources
      where resource_id = target_resource_id;

    when 'playlist' then
      select count(*)
      into binding_count
      from editorial.playlist_resources
      where resource_id = target_resource_id;

    when 'playlist_item' then
      select count(*)
      into binding_count
      from editorial.playlist_item_resources
      where resource_id = target_resource_id;

    when 'registry_artist' then
      select count(*)
      into binding_count
      from editorial.registry_artist_resources
      where resource_id = target_resource_id;

    when 'correction_case' then
      select count(*)
      into binding_count
      from editorial.correction_cases
      where resource_id = target_resource_id;

    when 'media_asset' then
      select count(*)
      into binding_count
      from editorial.media_asset_resources
      where resource_id = target_resource_id;

    when 'person' then
      select count(*)
      into binding_count
      from editorial.people
      where resource_id = target_resource_id;

    else
      raise exception
        'Unsupported resource kind: %',
        target_kind;
  end case;

  if binding_count <> 1 then
    raise exception
      'Resource % with kind % must have exactly one typed binding.',
      target_resource_id,
      target_kind;
  end if;

  return null;
end;
$function$;

comment on function
  editorial.assert_resource_binding_integrity()
is
  'Deferred integrity check requiring exactly one typed binding for every supported WAKILISHA Resource kind, including Person.';

create constraint trigger people_binding_integrity
after insert or update or delete
on editorial.people
deferrable initially deferred
for each row
execute function editorial.assert_resource_binding_integrity();

create or replace function
  editorial.normalize_person_slug(
    p_seed text
  )
returns text
language plpgsql
immutable
set search_path to 'pg_catalog'
as $function$
declare
  v_slug text;
begin
  v_slug := lower(
    regexp_replace(
      btrim(
        coalesce(
          p_seed,
          ''
        )
      ),
      '[^[:alnum:]]+',
      '-',
      'g'
    )
  );

  v_slug := regexp_replace(
    v_slug,
    '(^-+|-+$)',
    '',
    'g'
  );

  return nullif(v_slug, '');
end;
$function$;

create or replace function
  editorial.allocate_person_path(
    p_seed text,
    p_person_resource_id uuid
  )
returns text
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'editorial'
as $function$
declare
  v_slug text;
  v_path text;
  v_suffix text;
begin
  if p_person_resource_id is null then
    raise exception
      'Person Resource id is required.';
  end if;

  v_slug := coalesce(
    editorial.normalize_person_slug(p_seed),
    'person'
  );

  v_path := '/people/' || v_slug;

  if exists (
    select 1
    from editorial.resource_aliases alias
    where alias.path = v_path
  ) then
    v_suffix := substr(
      replace(
        p_person_resource_id::text,
        '-',
        ''
      ),
      1,
      8
    );

    v_path :=
      '/people/'
      || v_slug
      || '-'
      || v_suffix;
  end if;

  if exists (
    select 1
    from editorial.resource_aliases alias
    where alias.path = v_path
  ) then
    v_path :=
      '/people/person-'
      || replace(
           p_person_resource_id::text,
           '-',
           ''
         );
  end if;

  if exists (
    select 1
    from editorial.resource_aliases alias
    where alias.path = v_path
  ) then
    raise exception
      'Could not allocate a unique Person path.';
  end if;

  return v_path;
end;
$function$;

create or replace function
  editorial.resolve_person_presentation(
    p_person_resource_id uuid
  )
returns jsonb
language sql
stable
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
  with person as (
    select
      row.resource_id,
      row.preferred_identity_link_id
    from editorial.people row
    where row.resource_id = p_person_resource_id
      and row.person_state = 'active'
  ),
  candidates as (
    select
      link.id as identity_link_id,
      case
        when link.id = person.preferred_identity_link_id
          then 0
        else 10
      end as presentation_order,
      jsonb_strip_nulls(
        jsonb_build_object(
          'identity_kind', 'registry_author',
          'display_name', author.name,
          'bio', author.bio,
          'avatar_url', author.avatar_url,
          'cover_url', author.cover_url,
          'location', author.location,
          'registry_author_slug', author.slug
        )
      ) as presentation
    from person
    join editorial.person_identity_links link
      on link.person_resource_id = person.resource_id
     and link.link_state = 'active'
     and link.registry_author_id is not null
    join public.registry_authors author
      on author.id = link.registry_author_id

    union all

    select
      link.id,
      case
        when link.id = person.preferred_identity_link_id
          then 0
        else 20
      end,
      jsonb_strip_nulls(
        jsonb_build_object(
          'identity_kind', 'user',
          'display_name',
            coalesce(
              nullif(
                btrim(profile.display_name),
                ''
              ),
              profile.username_normalized
            ),
          'bio', profile.bio,
          'avatar_url', profile.avatar_url,
          'cover_url', profile.cover_url,
          'location',
            nullif(
              concat_ws(
                ', ',
                nullif(
                  btrim(profile.city),
                  ''
                ),
                nullif(
                  btrim(profile.country),
                  ''
                )
              ),
              ''
            ),
          'username', profile.username_normalized
        )
      )
    from person
    join editorial.person_identity_links link
      on link.person_resource_id = person.resource_id
     and link.link_state = 'active'
     and link.user_id is not null
    join public.user_profiles profile
      on profile.user_id = link.user_id
     and profile.status = 'active'
     and profile.is_public
     and profile.username_normalized is not null

    union all

    select
      link.id,
      case
        when link.id = person.preferred_identity_link_id
          then 0
        else 30
      end,
      jsonb_strip_nulls(
        jsonb_build_object(
          'identity_kind', 'external_contributor',
          'display_name', contributor.display_name,
          'location', contributor.location_text
        )
      )
    from person
    join editorial.person_identity_links link
      on link.person_resource_id = person.resource_id
     and link.link_state = 'active'
     and link.external_contributor_id is not null
    join editorial.external_contributors contributor
      on contributor.id =
         link.external_contributor_id
     and contributor.contributor_state = 'active'
     and contributor.public_safe
     and contributor.consent_status in (
       'granted',
       'not_required'
     )
  )
  select candidate.presentation
  from candidates candidate
  order by
    candidate.presentation_order,
    candidate.identity_link_id
  limit 1;
$function$;

create or replace function
  editorial.refresh_person_visibility(
    p_person_resource_id uuid
  )
returns void
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_person editorial.people%rowtype;
  v_public_eligible boolean := false;
  v_owner_id uuid;
  v_visibility text;
  v_lifecycle text;
begin
  select person.*
  into v_person
  from editorial.people person
  where person.resource_id =
        p_person_resource_id;

  if not found then
    return;
  end if;

  select link.user_id
  into v_owner_id
  from editorial.person_identity_links link
  where link.person_resource_id =
        p_person_resource_id
    and link.link_state = 'active'
    and link.user_id is not null
  limit 1;

  if v_person.person_state = 'active' then
    select exists (
      select 1
      from editorial.person_identity_links link
      join public.user_profiles profile
        on profile.user_id = link.user_id
      where link.person_resource_id =
            p_person_resource_id
        and link.link_state = 'active'
        and link.user_id is not null
        and profile.status = 'active'
        and profile.is_public

      union all

      select 1
      from editorial.person_identity_links link
      join public.registry_authors author
        on author.id =
           link.registry_author_id
      where link.person_resource_id =
            p_person_resource_id
        and link.link_state = 'active'
        and link.registry_author_id is not null

      union all

      select 1
      from editorial.person_identity_links link
      join editorial.external_contributors contributor
        on contributor.id =
           link.external_contributor_id
      where link.person_resource_id =
            p_person_resource_id
        and link.link_state = 'active'
        and link.external_contributor_id is not null
        and contributor.contributor_state = 'active'
        and contributor.public_safe
        and contributor.consent_status in (
          'granted',
          'not_required'
        )
    )
    into v_public_eligible;
  end if;

  if v_person.person_state = 'archived' then
    v_visibility := 'internal';
    v_lifecycle := 'archived';
  elsif v_person.person_state = 'merged' then
    v_visibility := 'internal';
    v_lifecycle := 'active';
  else
    v_visibility :=
      case
        when v_public_eligible then 'public'
        else 'internal'
      end;
    v_lifecycle := 'active';
  end if;

  update editorial.resources resource
  set
    owner_id = v_owner_id,
    visibility = v_visibility,
    lifecycle_state = v_lifecycle,
    updated_at = now()
  where resource.id =
        p_person_resource_id
    and resource.resource_kind = 'person'
    and (
      resource.owner_id
        is distinct from v_owner_id
      or resource.visibility
        is distinct from v_visibility
      or resource.lifecycle_state
        is distinct from v_lifecycle
    );
end;
$function$;

create or replace function
  editorial.sync_person_visibility_from_identity_link()
returns trigger
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'editorial'
as $function$
begin
  if tg_op = 'DELETE' then
    perform editorial.refresh_person_visibility(
      old.person_resource_id
    );
    return old;
  end if;

  perform editorial.refresh_person_visibility(
    new.person_resource_id
  );

  if tg_op = 'UPDATE'
     and old.person_resource_id
         is distinct from new.person_resource_id
  then
    perform editorial.refresh_person_visibility(
      old.person_resource_id
    );
  end if;

  return new;
end;
$function$;

create trigger person_identity_links_visibility_sync
after insert or update or delete
on editorial.person_identity_links
for each row
execute function
  editorial.sync_person_visibility_from_identity_link();

create or replace function
  editorial.sync_person_visibility_from_user_profile()
returns trigger
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'editorial'
as $function$
declare
  v_person_resource_id uuid;
begin
  for v_person_resource_id in
    select link.person_resource_id
    from editorial.person_identity_links link
    where link.user_id = new.user_id
      and link.link_state = 'active'
  loop
    perform editorial.refresh_person_visibility(
      v_person_resource_id
    );
  end loop;

  return new;
end;
$function$;

create trigger user_profiles_person_visibility_sync
after update of status, is_public
on public.user_profiles
for each row
when (
  old.status is distinct from new.status
  or old.is_public is distinct from new.is_public
)
execute function
  editorial.sync_person_visibility_from_user_profile();

create or replace function
  editorial.sync_person_visibility_from_external_contributor()
returns trigger
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'editorial'
as $function$
declare
  v_person_resource_id uuid;
begin
  for v_person_resource_id in
    select link.person_resource_id
    from editorial.person_identity_links link
    where link.external_contributor_id =
          new.id
      and link.link_state = 'active'
  loop
    perform editorial.refresh_person_visibility(
      v_person_resource_id
    );
  end loop;

  return new;
end;
$function$;

create trigger external_contributors_person_visibility_sync
after update of
  contributor_state,
  public_safe,
  consent_status
on editorial.external_contributors
for each row
when (
  old.contributor_state
    is distinct from new.contributor_state
  or old.public_safe
    is distinct from new.public_safe
  or old.consent_status
    is distinct from new.consent_status
)
execute function
  editorial.sync_person_visibility_from_external_contributor();

create or replace function
  editorial.sync_person_visibility_from_person_state()
returns trigger
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'editorial'
as $function$
begin
  perform editorial.refresh_person_visibility(
    new.resource_id
  );

  return new;
end;
$function$;

create trigger people_state_visibility_sync
after update of
  person_state,
  merged_into_person_resource_id
on editorial.people
for each row
when (
  old.person_state
    is distinct from new.person_state
  or old.merged_into_person_resource_id
    is distinct from new.merged_into_person_resource_id
)
execute function
  editorial.sync_person_visibility_from_person_state();

create or replace function
  editorial.create_person_for_identity(
    p_user_id uuid,
    p_registry_author_id uuid,
    p_external_contributor_id uuid,
    p_link_method text,
    p_link_reason text
  )
returns uuid
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'auth',
  'public',
  'editorial'
as $function$
declare
  v_person_resource_id uuid;
  v_existing_person_resource_id uuid;
  v_identity_link_id uuid;
  v_seed text;
  v_owner_id uuid;
  v_actor_id uuid := auth.uid();
  v_path text;
begin
  if num_nonnulls(
       p_user_id,
       p_registry_author_id,
       p_external_contributor_id
     ) <> 1
  then
    raise exception
      'Exactly one Person source identity is required.';
  end if;

  if p_link_method not in (
    'migration_seed',
    'account_provisioning',
    'registry_author_provisioning',
    'external_contributor_provisioning',
    'admin_reconciliation',
    'claim_approved',
    'person_merge',
    'person_split'
  ) then
    raise exception
      'Unsupported Person identity link method.';
  end if;

  if nullif(
       btrim(
         coalesce(
           p_link_reason,
           ''
         )
       ),
       ''
     ) is null
  then
    raise exception
      'Person identity link reason is required.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      case
        when p_user_id is not null
          then 'person-source|user|' || p_user_id::text
        when p_registry_author_id is not null
          then 'person-source|registry-author|' || p_registry_author_id::text
        else 'person-source|external-contributor|' || p_external_contributor_id::text
      end,
      0
    )
  );

  if p_user_id is not null then
    select link.person_resource_id
    into v_existing_person_resource_id
    from editorial.person_identity_links link
    where link.user_id = p_user_id
      and link.link_state = 'active';

    if found then
      return v_existing_person_resource_id;
    end if;

    select
      coalesce(
        profile.username_normalized,
        profile.display_name
      ),
      profile.user_id
    into
      v_seed,
      v_owner_id
    from public.user_profiles profile
    where profile.user_id = p_user_id;

    if not found then
      raise exception
        'WAKILISHA account profile does not exist.';
    end if;

  elsif p_registry_author_id is not null then
    select link.person_resource_id
    into v_existing_person_resource_id
    from editorial.person_identity_links link
    where link.registry_author_id =
          p_registry_author_id
      and link.link_state = 'active';

    if found then
      return v_existing_person_resource_id;
    end if;

    select author.slug
    into v_seed
    from public.registry_authors author
    where author.id =
          p_registry_author_id;

    if not found then
      raise exception
        'Registry Author does not exist.';
    end if;

  else
    select link.person_resource_id
    into v_existing_person_resource_id
    from editorial.person_identity_links link
    where link.external_contributor_id =
          p_external_contributor_id
      and link.link_state = 'active';

    if found then
      return v_existing_person_resource_id;
    end if;

    select contributor.display_name
    into v_seed
    from editorial.external_contributors contributor
    where contributor.id =
          p_external_contributor_id;

    if not found then
      raise exception
        'External contributor does not exist.';
    end if;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'person-path|'
      || coalesce(
           editorial.normalize_person_slug(v_seed),
           'person'
         ),
      0
    )
  );

  v_person_resource_id := gen_random_uuid();

  insert into editorial.resources (
    id,
    resource_kind,
    owner_id,
    visibility,
    lifecycle_state,
    created_by
  )
  values (
    v_person_resource_id,
    'person',
    v_owner_id,
    'internal',
    'active',
    v_actor_id
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
    v_person_resource_id,
    'person',
    'active',
    1,
    v_actor_id,
    v_actor_id
  );

  v_identity_link_id := gen_random_uuid();

  insert into editorial.person_identity_links (
    id,
    person_resource_id,
    person_resource_kind,
    user_id,
    registry_author_id,
    external_contributor_id,
    link_state,
    link_method,
    link_reason,
    created_by
  )
  values (
    v_identity_link_id,
    v_person_resource_id,
    'person',
    p_user_id,
    p_registry_author_id,
    p_external_contributor_id,
    'active',
    p_link_method,
    p_link_reason,
    v_actor_id
  );

  update editorial.people
  set
    preferred_identity_link_id =
      v_identity_link_id,
    updated_by = v_actor_id,
    updated_at = now()
  where resource_id =
        v_person_resource_id;

  v_path :=
    editorial.allocate_person_path(
      v_seed,
      v_person_resource_id
    );

  insert into editorial.resource_aliases (
    resource_id,
    path,
    is_canonical,
    created_by
  )
  values (
    v_person_resource_id,
    v_path,
    true,
    v_actor_id
  );

  insert into editorial.person_identity_events (
    person_resource_id,
    actor_id,
    event_type,
    identity_link_id,
    prior_identity_revision,
    resulting_identity_revision,
    reason
  )
  values (
    v_person_resource_id,
    v_actor_id,
    'person_created',
    v_identity_link_id,
    null,
    1,
    p_link_reason
  );

  perform editorial.refresh_person_visibility(
    v_person_resource_id
  );

  return v_person_resource_id;
end;
$function$;

create or replace function
  editorial.ensure_person_for_user(
    p_user_id uuid
  )
returns uuid
language sql
security definer
set search_path to
  'pg_catalog',
  'editorial'
as $function$
  select editorial.create_person_for_identity(
    p_user_id,
    null,
    null,
    'account_provisioning',
    'One-source Person provisioning for an existing WAKILISHA account profile.'
  );
$function$;

create or replace function
  editorial.ensure_person_for_registry_author(
    p_registry_author_id uuid
  )
returns uuid
language sql
security definer
set search_path to
  'pg_catalog',
  'editorial'
as $function$
  select editorial.create_person_for_identity(
    null,
    p_registry_author_id,
    null,
    'registry_author_provisioning',
    'One-source Person provisioning for an existing Registry Author.'
  );
$function$;

create or replace function
  editorial.ensure_person_for_external_contributor(
    p_external_contributor_id uuid
  )
returns uuid
language sql
security definer
set search_path to
  'pg_catalog',
  'editorial'
as $function$
  select editorial.create_person_for_identity(
    null,
    null,
    p_external_contributor_id,
    'external_contributor_provisioning',
    'One-source Person provisioning for an existing external contributor.'
  );
$function$;

create or replace function
  public.get_public_person(
    p_slug text
  )
returns jsonb
language plpgsql
stable
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_input text;
  v_path text;
  v_requested_person_id uuid;
  v_person_id uuid;
  v_person editorial.people%rowtype;
  v_resource editorial.resources%rowtype;
  v_presentation jsonb;
  v_canonical_path text;
  v_depth integer := 0;
begin
  v_input := lower(
    btrim(
      coalesce(
        p_slug,
        ''
      )
    )
  );

  if v_input = '' then
    return null;
  end if;

  if v_input like '/people/%' then
    v_path := regexp_replace(
      v_input,
      '/+$',
      ''
    );
  else
    v_input := trim(
      both '/'
      from v_input
    );

    if v_input = '' then
      return null;
    end if;

    v_path :=
      '/people/'
      || v_input;
  end if;

  select alias.resource_id
  into v_requested_person_id
  from editorial.resource_aliases alias
  join editorial.resources resource
    on resource.id = alias.resource_id
   and resource.resource_kind = 'person'
  where alias.path = v_path
    and alias.retired_at is null
  order by
    alias.is_canonical desc,
    alias.created_at
  limit 1;

  if not found then
    return null;
  end if;

  v_person_id :=
    v_requested_person_id;

  loop
    v_depth := v_depth + 1;

    if v_depth > 8 then
      return null;
    end if;

    select person.*
    into v_person
    from editorial.people person
    where person.resource_id =
          v_person_id;

    if not found then
      return null;
    end if;

    exit when
      v_person.person_state <> 'merged';

    if v_person.merged_into_person_resource_id
         is null
    then
      return null;
    end if;

    v_person_id :=
      v_person.merged_into_person_resource_id;
  end loop;

  if v_person.person_state <> 'active' then
    return null;
  end if;

  select resource.*
  into v_resource
  from editorial.resources resource
  where resource.id = v_person_id
    and resource.resource_kind = 'person';

  if not found
     or v_resource.visibility <> 'public'
     or v_resource.lifecycle_state <> 'active'
  then
    return null;
  end if;

  v_presentation :=
    editorial.resolve_person_presentation(
      v_person_id
    );

  if v_presentation is null then
    return null;
  end if;

  select alias.path
  into v_canonical_path
  from editorial.resource_aliases alias
  where alias.resource_id = v_person_id
    and alias.is_canonical
    and alias.retired_at is null;

  if v_canonical_path is null then
    return null;
  end if;

  return jsonb_strip_nulls(
    jsonb_build_object(
      'person_id',
        v_person_id,
      'canonical_path',
        v_canonical_path,
      'display_name',
        v_presentation ->> 'display_name',
      'bio',
        v_presentation ->> 'bio',
      'avatar_url',
        v_presentation ->> 'avatar_url',
      'cover_url',
        v_presentation ->> 'cover_url',
      'location',
        v_presentation ->> 'location',
      'username',
        v_presentation ->> 'username',
      'registry_author_slug',
        v_presentation
          ->> 'registry_author_slug',
      'redirect_to',
        case
          when v_requested_person_id
                 is distinct from v_person_id
            then v_canonical_path
          else null
        end
    )
  );
end;
$function$;

revoke all
on function public.get_public_person(text)
from public, anon, authenticated;

grant execute
on function public.get_public_person(text)
to anon, authenticated, service_role;

comment on function
  public.get_public_person(text)
is
  'Narrow public Person identity read. Migration A intentionally excludes body-of-work roles and social Follow counts.';

revoke all
on function
  editorial.protect_person_resource_binding()
from public, anon, authenticated;

revoke all
on function
  editorial.protect_person_identity_link_target()
from public, anon, authenticated;

revoke all
on function
  editorial.protect_person_identity_event()
from public, anon, authenticated;

revoke all
on function
  editorial.assert_person_identity_integrity()
from public, anon, authenticated;

revoke all
on function
  editorial.normalize_person_slug(text)
from public, anon, authenticated;

revoke all
on function
  editorial.allocate_person_path(text,uuid)
from public, anon, authenticated;

revoke all
on function
  editorial.resolve_person_presentation(uuid)
from public, anon, authenticated;

revoke all
on function
  editorial.refresh_person_visibility(uuid)
from public, anon, authenticated;

revoke all
on function
  editorial.sync_person_visibility_from_identity_link()
from public, anon, authenticated;

revoke all
on function
  editorial.sync_person_visibility_from_user_profile()
from public, anon, authenticated;

revoke all
on function
  editorial.sync_person_visibility_from_external_contributor()
from public, anon, authenticated;

revoke all
on function
  editorial.sync_person_visibility_from_person_state()
from public, anon, authenticated;

revoke all
on function
  editorial.create_person_for_identity(uuid,uuid,uuid,text,text)
from public, anon, authenticated;

revoke all
on function
  editorial.ensure_person_for_user(uuid)
from public, anon, authenticated;

revoke all
on function
  editorial.ensure_person_for_registry_author(uuid)
from public, anon, authenticated;

revoke all
on function
  editorial.ensure_person_for_external_contributor(uuid)
from public, anon, authenticated;

revoke execute
on function
  editorial.ensure_person_for_user(uuid),
  editorial.ensure_person_for_registry_author(uuid),
  editorial.ensure_person_for_external_contributor(uuid)
from service_role;

alter table editorial.people
  enable row level security;

alter table editorial.person_identity_links
  enable row level security;

alter table editorial.person_identity_events
  enable row level security;

revoke all
on editorial.people,
   editorial.person_identity_links,
   editorial.person_identity_events
from public, anon, authenticated;

grant all
on editorial.people,
   editorial.person_identity_links,
   editorial.person_identity_events
to service_role;

drop view public.wk_resource_index;

create view public.wk_resource_index
with (
  security_invoker = true,
  security_barrier = true
)
as
select
  resources.id as resource_id,
  resources.resource_kind,
  article_resources.article_id
    as canonical_record_id,
  canonical_alias.path
    as canonical_path,
  resources.visibility,
  resources.lifecycle_state,
  resources.created_at,
  resources.updated_at
from editorial.resources
join editorial.article_resources
  on article_resources.resource_id =
     resources.id
left join editorial.resource_aliases
  as canonical_alias
  on canonical_alias.resource_id =
     resources.id
 and canonical_alias.is_canonical
 and canonical_alias.retired_at is null

union all

select
  resources.id,
  resources.resource_kind,
  playlist_resources.playlist_id,
  canonical_alias.path,
  resources.visibility,
  resources.lifecycle_state,
  resources.created_at,
  resources.updated_at
from editorial.resources
join editorial.playlist_resources
  on playlist_resources.resource_id =
     resources.id
left join editorial.resource_aliases
  as canonical_alias
  on canonical_alias.resource_id =
     resources.id
 and canonical_alias.is_canonical
 and canonical_alias.retired_at is null

union all

select
  resources.id,
  resources.resource_kind,
  registry_artist_resources.artist_id,
  canonical_alias.path,
  resources.visibility,
  resources.lifecycle_state,
  resources.created_at,
  resources.updated_at
from editorial.resources
join editorial.registry_artist_resources
  on registry_artist_resources.resource_id =
     resources.id
left join editorial.resource_aliases
  as canonical_alias
  on canonical_alias.resource_id =
     resources.id
 and canonical_alias.is_canonical
 and canonical_alias.retired_at is null

union all

select
  resources.id,
  resources.resource_kind,
  resources.id as canonical_record_id,
  canonical_alias.path,
  resources.visibility,
  resources.lifecycle_state,
  resources.created_at,
  resources.updated_at
from editorial.resources
left join editorial.resource_aliases
  as canonical_alias
  on canonical_alias.resource_id =
     resources.id
 and canonical_alias.is_canonical
 and canonical_alias.retired_at is null
where resources.resource_kind = 'person';

comment on view public.wk_resource_index is
  'Narrow stable public resource reference index. Person uses Resource UUID as canonical record identity without exposing internal Person governance tables.';

revoke all
on public.wk_resource_index
from public, anon, authenticated;

grant select
on public.wk_resource_index
to anon, authenticated, service_role;

drop view public.wk_resource_owner_index;

create view public.wk_resource_owner_index
with (
  security_invoker = true,
  security_barrier = true
)
as
select
  resources.id as resource_id,
  resources.resource_kind,
  article_resources.article_id
    as canonical_record_id,
  resources.owner_id
from editorial.resources
join editorial.article_resources
  on article_resources.resource_id =
     resources.id

union all

select
  resources.id,
  resources.resource_kind,
  playlist_resources.playlist_id,
  resources.owner_id
from editorial.resources
join editorial.playlist_resources
  on playlist_resources.resource_id =
     resources.id

union all

select
  resources.id,
  resources.resource_kind,
  registry_artist_resources.artist_id,
  resources.owner_id
from editorial.resources
join editorial.registry_artist_resources
  on registry_artist_resources.resource_id =
     resources.id

union all

select
  resources.id,
  resources.resource_kind,
  resources.id as canonical_record_id,
  resources.owner_id
from editorial.resources
where resources.resource_kind = 'person';

comment on view public.wk_resource_owner_index is
  'Authenticated canonical account ownership read model for resource authority checks, including Person ownership without exposing Person governance tables.';

revoke all
on public.wk_resource_owner_index
from public, anon, authenticated;

grant select
on public.wk_resource_owner_index
to authenticated, service_role;

do $people_migration_a_proof_seed$
declare
  v_registry_author_id uuid;
  v_user_id uuid;
  v_external_contributor_id uuid;
begin
  select author.id
  into v_registry_author_id
  from public.registry_authors author
  where author.slug = 'hafare-segelan';

  if found then
    perform editorial.create_person_for_identity(
      null,
      v_registry_author_id,
      null,
      'migration_seed',
      'Migration A Registry Author proof using Hafare Segelan.'
    );
  else
    raise notice
      'Skipping Hafare Person proof because Registry Author hafare-segelan is absent.';
  end if;

  -- Email equality is not used as identity authority.
  -- For the one account proof only, accounts whose email happens to match an
  -- existing Registry Author or external contributor are conservatively
  -- excluded so the proof does not manufacture an obvious duplicate while
  -- explicit reconciliation is still intentionally unavailable.
  select profile.user_id
  into v_user_id
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
      where contributor.contact_email is not null
        and profile.email is not null
        and lower(
              btrim(contributor.contact_email)
            ) =
            lower(
              btrim(profile.email)
            )
    )
  order by
    profile.created_at,
    profile.user_id
  limit 1;

  if found then
    perform editorial.create_person_for_identity(
      v_user_id,
      null,
      null,
      'migration_seed',
      'Migration A conservative public-account Person proof.'
    );
  else
    raise notice
      'Skipping account Person proof because no conservative public account candidate exists.';
  end if;

  select contributor.id
  into v_external_contributor_id
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
  order by
    contributor.created_at,
    contributor.id
  limit 1;

  if found then
    perform editorial.create_person_for_identity(
      null,
      null,
      v_external_contributor_id,
      'migration_seed',
      'Migration A conservative public-safe external-contributor Person proof.'
    );
  else
    raise notice
      'Skipping external-contributor Person proof because no conservative public-safe candidate exists.';
  end if;
end;
$people_migration_a_proof_seed$;

do $people_migration_a_postconditions$
declare
  v_binding_definition text;
  v_public_definition text;
  v_presentation_definition text;
begin
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
      'STOP: Person Resource binding integrity was not installed';
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
  then
    raise exception
      'STOP: Migration A Person read exposes deferred social/body-of-work or private contributor data';
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
      'STOP: Person presentation resolver exposes private identity data';
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
      'STOP: Internal Person governance tables are directly granted to browser roles';
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
      'STOP: Migration A exposes Person provisioning authority before Migration C';
  end if;
end;
$people_migration_a_postconditions$;

commit;
