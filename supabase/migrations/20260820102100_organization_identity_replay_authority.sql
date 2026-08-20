-- Replay-safe Organization identity foundation.
--
-- Locked product rules:
-- - /organizations/:slug is canonical institutional public identity.
-- - Organization is identity authority, not the institutional taxonomy bucket.
-- - Organization types are explicit many-to-many classifications.
-- - Typed domain pairings remain separate; Registry Label is the first supported pairing.
-- - WAKILISHA is the first canonical Organization.
-- - WAKILISHA is primarily a Cultural Platform and secondarily a Publication.
-- - production Article attribution reconciliation remains historical evidence only.
-- - enduring Organization schema, WAKILISHA identity, and public readers remain active replay authority.

begin;

insert into editorial.resource_kinds (
  kind,
  label,
  description,
  enabled
)
values (
  'organization',
  'Organization',
  'Stable cross-domain institutional identity for publications, labels, festivals, countries, collectives, cultural bodies, and other non-human entities.',
  true
)
on conflict (kind) do update
set
  label = excluded.label,
  description = excluded.description,
  enabled = excluded.enabled;

create table if not exists editorial.organizations (
  resource_id uuid primary key,
  resource_kind text not null default 'organization',
  organization_state text not null default 'active',
  display_name text not null,
  description text,
  logo_url text,
  cover_url text,
  location_text text,
  website_url text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_kind_check
    check (resource_kind = 'organization'),
  constraint organizations_state_check
    check (organization_state in ('active', 'archived')),
  constraint organizations_display_name_check
    check (nullif(btrim(display_name), '') is not null),
  constraint organizations_resource_fkey
    foreign key (resource_id, resource_kind)
    references editorial.resources(id, resource_kind)
    on update cascade
    on delete cascade,
  constraint organizations_created_by_fkey
    foreign key (created_by)
    references auth.users(id)
    on delete set null,
  constraint organizations_updated_by_fkey
    foreign key (updated_by)
    references auth.users(id)
    on delete set null
);

create table if not exists editorial.organization_types (
  organization_type text primary key,
  label text not null,
  description text not null,
  enabled boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  constraint organization_types_key_check
    check (organization_type ~ '^[a-z][a-z0-9_]*$'),
  constraint organization_types_label_check
    check (nullif(btrim(label), '') is not null),
  constraint organization_types_description_check
    check (nullif(btrim(description), '') is not null)
);

insert into editorial.organization_types (
  organization_type,
  label,
  description,
  enabled,
  sort_order
)
values
  ('publication', 'Publication', 'Editorial publication or publishing identity.', true, 10),
  ('cultural_platform', 'Cultural platform', 'Cross-format cultural platform or cultural media identity.', true, 20),
  ('record_label', 'Record label', 'Music label or recorded-music imprint identity.', true, 30),
  ('festival', 'Festival', 'Recurring or durable festival identity.', true, 40),
  ('collective', 'Collective', 'Creative, cultural, artistic, or professional collective.', true, 50),
  ('country', 'Country', 'Sovereign country represented as an institutional identity.', true, 60),
  ('government_body', 'Government body', 'Public authority, ministry, agency, or other government body.', true, 70),
  ('museum', 'Museum', 'Museum or museum-like cultural institution.', true, 80),
  ('gallery', 'Gallery', 'Gallery or exhibition institution.', true, 90),
  ('cultural_centre', 'Cultural centre', 'Cultural centre or cultural hub.', true, 100),
  ('foundation', 'Foundation', 'Foundation or grantmaking institution.', true, 110),
  ('studio', 'Studio', 'Creative, recording, production, or design studio.', true, 120),
  ('agency', 'Agency', 'Agency or representative institutional identity.', true, 130),
  ('venue', 'Venue', 'Durable event, performance, or cultural venue identity.', true, 140),
  ('university', 'University', 'University or higher-learning institution.', true, 150),
  ('archive', 'Archive', 'Archive, library, or collection-holding institution.', true, 160),
  ('media_house', 'Media house', 'Media company or multi-publication media institution.', true, 170),
  ('nonprofit', 'Nonprofit', 'Nonprofit or civil-society organization.', true, 180),
  ('company', 'Company', 'Commercial company or corporate institutional identity.', true, 190),
  ('brand', 'Brand', 'Public brand identity when it is institutionally distinct and durable.', true, 200)
on conflict (organization_type) do update
set
  label = excluded.label,
  description = excluded.description,
  enabled = excluded.enabled,
  sort_order = excluded.sort_order;

create table if not exists editorial.organization_type_assignments (
  organization_resource_id uuid not null,
  organization_type text not null,
  is_primary boolean not null default false,
  display_order integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  primary key (
    organization_resource_id,
    organization_type
  ),
  constraint organization_type_assignments_org_fkey
    foreign key (organization_resource_id)
    references editorial.organizations(resource_id)
    on delete cascade,
  constraint organization_type_assignments_type_fkey
    foreign key (organization_type)
    references editorial.organization_types(organization_type)
    on update cascade
    on delete restrict,
  constraint organization_type_assignments_display_order_check
    check (display_order >= 0),
  constraint organization_type_assignments_created_by_fkey
    foreign key (created_by)
    references auth.users(id)
    on delete set null
);

create unique index if not exists
organization_type_assignments_one_primary_idx
on editorial.organization_type_assignments (
  organization_resource_id
)
where is_primary;

create table if not exists editorial.organization_registry_label_links (
  organization_resource_id uuid not null,
  registry_label_id uuid not null unique,
  link_state text not null default 'active',
  link_reason text not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  retired_by uuid,
  retired_at timestamptz,
  retired_reason text,
  primary key (
    organization_resource_id,
    registry_label_id
  ),
  constraint organization_registry_label_links_org_fkey
    foreign key (organization_resource_id)
    references editorial.organizations(resource_id)
    on delete restrict,
  constraint organization_registry_label_links_label_fkey
    foreign key (registry_label_id)
    references public.registry_labels(id)
    on delete restrict,
  constraint organization_registry_label_links_state_check
    check (link_state in ('active', 'retired')),
  constraint organization_registry_label_links_reason_check
    check (nullif(btrim(link_reason), '') is not null),
  constraint organization_registry_label_links_retirement_check
    check (
      (
        link_state = 'active'
        and retired_at is null
        and retired_by is null
        and retired_reason is null
      )
      or
      (
        link_state = 'retired'
        and retired_at is not null
        and nullif(btrim(retired_reason), '') is not null
      )
    ),
  constraint organization_registry_label_links_created_by_fkey
    foreign key (created_by)
    references auth.users(id)
    on delete set null,
  constraint organization_registry_label_links_retired_by_fkey
    foreign key (retired_by)
    references auth.users(id)
    on delete set null
);

create unique index if not exists
organization_registry_label_links_one_active_org_idx
on editorial.organization_registry_label_links (
  organization_resource_id
)
where link_state = 'active';

create or replace function editorial.assert_resource_binding_integrity()
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
      select count(*) into binding_count
      from editorial.article_resources
      where resource_id = target_resource_id;
    when 'playlist' then
      select count(*) into binding_count
      from editorial.playlist_resources
      where resource_id = target_resource_id;
    when 'playlist_item' then
      select count(*) into binding_count
      from editorial.playlist_item_resources
      where resource_id = target_resource_id;
    when 'registry_artist' then
      select count(*) into binding_count
      from editorial.registry_artist_resources
      where resource_id = target_resource_id;
    when 'correction_case' then
      select count(*) into binding_count
      from editorial.correction_cases
      where resource_id = target_resource_id;
    when 'media_asset' then
      select count(*) into binding_count
      from editorial.media_asset_resources
      where resource_id = target_resource_id;
    when 'person' then
      select count(*) into binding_count
      from editorial.people
      where resource_id = target_resource_id;
    when 'organization' then
      select count(*) into binding_count
      from editorial.organizations
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

drop trigger if exists organizations_binding_integrity
on editorial.organizations;

create constraint trigger organizations_binding_integrity
after insert or delete or update
on editorial.organizations
deferrable initially deferred
for each row
execute function editorial.assert_resource_binding_integrity();

drop trigger if exists organizations_prevent_resource_binding_retarget
on editorial.organizations;

create trigger organizations_prevent_resource_binding_retarget
before update of resource_id, resource_kind
on editorial.organizations
for each row
execute function editorial.prevent_resource_binding_retarget();

alter table editorial.credits
  add column if not exists organization_resource_id uuid;

do $credits_org_fk$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'credits_organization_resource_id_fkey'
      and conrelid = 'editorial.credits'::regclass
  ) then
    alter table editorial.credits
      add constraint credits_organization_resource_id_fkey
      foreign key (organization_resource_id)
      references editorial.organizations(resource_id)
      on delete restrict;
  end if;
end;
$credits_org_fk$;

alter table editorial.credits
  drop constraint if exists credits_exactly_one_party_check;

alter table editorial.credits
  add constraint credits_exactly_one_party_check
  check (
    num_nonnulls(
      user_id,
      registry_author_id,
      external_contributor_id,
      organization_resource_id
    ) = 1
  );

create or replace function editorial.resolve_credit_organization(
  p_credit_id uuid
)
returns uuid
language sql
stable
security definer
set search_path to 'pg_catalog', 'editorial'
as $function$
  select organization.resource_id
  from editorial.credits credit
  join editorial.organizations organization
    on organization.resource_id =
       credit.organization_resource_id
   and organization.organization_state = 'active'
  join editorial.resources resource
    on resource.id = organization.resource_id
   and resource.resource_kind = 'organization'
   and resource.visibility = 'public'
   and resource.lifecycle_state = 'active'
  where credit.id = p_credit_id
  limit 1;
$function$;

revoke all
on function editorial.resolve_credit_organization(uuid)
from public;

grant execute
on function editorial.resolve_credit_organization(uuid)
to service_role;

do $seed_wakilisha_organization$
declare
  v_org_id uuid;
begin
  select alias.resource_id
  into v_org_id
  from editorial.resource_aliases alias
  join editorial.resources resource
    on resource.id = alias.resource_id
   and resource.resource_kind = 'organization'
  where alias.path = '/organizations/wakilisha'
    and alias.is_canonical
    and alias.retired_at is null
  limit 1;

  if v_org_id is null then
    v_org_id := '97d2dd8c-ff4d-48a0-95a7-5167f5e378d9'::uuid;

    if exists (
      select 1
      from editorial.resources existing_resource
      where existing_resource.id = v_org_id
    ) then
      raise exception
        'STOP: canonical WAKILISHA Organization UUID is already bound to another Resource';
    end if;

    insert into editorial.resources (
      id,
      resource_kind,
      owner_id,
      visibility,
      lifecycle_state,
      created_by,
      created_at,
      updated_at
    )
    values (
      v_org_id,
      'organization',
      null,
      'public',
      'active',
      null,
      now(),
      now()
    );

    insert into editorial.organizations (
      resource_id,
      resource_kind,
      organization_state,
      display_name,
      description,
      logo_url,
      cover_url,
      location_text,
      website_url,
      created_by,
      updated_by
    )
    values (
      v_org_id,
      'organization',
      'active',
      'WAKILISHA',
      null,
      null,
      null,
      null,
      'https://wakilisha.africa',
      null,
      null
    );

    insert into editorial.resource_aliases (
      id,
      resource_id,
      path,
      is_canonical,
      redirect_status,
      created_by
    )
    values (
      gen_random_uuid(),
      v_org_id,
      '/organizations/wakilisha',
      true,
      308,
      null
    );
  end if;

  if not exists (
    select 1
    from editorial.organizations organization
    join editorial.resources resource
      on resource.id = organization.resource_id
    where organization.resource_id = v_org_id
      and organization.organization_state = 'active'
      and organization.display_name = 'WAKILISHA'
      and resource.resource_kind = 'organization'
      and resource.visibility = 'public'
      and resource.lifecycle_state = 'active'
  ) then
    raise exception
      'STOP: /organizations/wakilisha does not resolve to the expected active WAKILISHA Organization';
  end if;

  insert into editorial.organization_type_assignments (
    organization_resource_id,
    organization_type,
    is_primary,
    display_order,
    created_by
  )
  values
    (v_org_id, 'cultural_platform', true, 0, null),
    (v_org_id, 'publication', false, 1, null)
  on conflict (
    organization_resource_id,
    organization_type
  ) do update
  set
    is_primary = excluded.is_primary,
    display_order = excluded.display_order;
end;
$seed_wakilisha_organization$;

-- Production-only institutional Article attribution block retired from
-- active replay authority. The exact original block remains preserved in the
-- retired migration receipt.


create or replace function public.get_public_organization(
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
  v_slug text;
  v_org_id uuid;
  v_org editorial.organizations%rowtype;
  v_path text;
  v_types jsonb;
  v_primary_type text;
begin
  v_slug := lower(
    trim(
      both '/'
      from regexp_replace(
        btrim(coalesce(p_slug, '')),
        '^organizations/',
        ''
      )
    )
  );

  if v_slug = '' then
    return null;
  end if;

  select alias.resource_id, alias.path
  into v_org_id, v_path
  from editorial.resource_aliases alias
  join editorial.resources resource
    on resource.id = alias.resource_id
   and resource.resource_kind = 'organization'
   and resource.visibility = 'public'
   and resource.lifecycle_state = 'active'
  where alias.path =
        '/organizations/' || v_slug
    and alias.is_canonical
    and alias.retired_at is null
  limit 1;

  if v_org_id is null then
    return null;
  end if;

  select organization.*
  into v_org
  from editorial.organizations organization
  where organization.resource_id = v_org_id
    and organization.organization_state = 'active';

  if not found then
    return null;
  end if;

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'type',
            assignment.organization_type,
          'label',
            type_row.label,
          'is_primary',
            assignment.is_primary,
          'display_order',
            assignment.display_order
        )
        order by
          assignment.display_order,
          type_row.sort_order,
          assignment.organization_type
      ),
      '[]'::jsonb
    ),
    max(assignment.organization_type)
      filter (where assignment.is_primary)
  into
    v_types,
    v_primary_type
  from editorial.organization_type_assignments assignment
  join editorial.organization_types type_row
    on type_row.organization_type =
       assignment.organization_type
   and type_row.enabled
  where assignment.organization_resource_id =
        v_org_id;

  return jsonb_strip_nulls(
    jsonb_build_object(
      'organization_id',
        v_org.resource_id,
      'canonical_path',
        v_path,
      'display_name',
        v_org.display_name,
      'description',
        v_org.description,
      'logo_url',
        v_org.logo_url,
      'cover_url',
        v_org.cover_url,
      'location',
        v_org.location_text,
      'website_url',
        v_org.website_url,
      'primary_type',
        v_primary_type,
      'organization_types',
        v_types
    )
  );
end;
$function$;

revoke all
on function public.get_public_organization(text)
from public;

grant execute
on function public.get_public_organization(text)
to anon, authenticated;

create or replace function public.list_public_article_author_organization_paths(
  p_article_slug text default null
)
returns table(
  article_id uuid,
  article_slug text,
  author_organization_id uuid,
  author_organization_path text
)
language sql
stable
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
  with current_articles as (
    select
      article.id as article_id,
      article.slug as article_slug,
      resource.id as resource_id,
      resource.current_published_version_id
    from public.wk_articles article
    join editorial.article_resources binding
      on binding.article_id = article.id
    join editorial.resources resource
      on resource.id = binding.resource_id
     and resource.resource_kind = 'article'
     and resource.visibility = 'public'
     and resource.lifecycle_state = 'published'
     and resource.current_published_version_id is not null
    where p_article_slug is null
       or article.slug = p_article_slug
  ),
  primary_author_credit as (
    select distinct on (
      current_article.article_id
    )
      current_article.article_id,
      current_article.article_slug,
      credit.organization_resource_id
        as author_organization_id
    from current_articles current_article
    join editorial.resource_credits attachment
      on attachment.resource_id =
         current_article.resource_id
     and attachment.resource_kind = 'article'
     and attachment.target_version_type =
         'article_version'
     and attachment.target_version_id =
         current_article.current_published_version_id
     and attachment.is_primary
     and attachment.public_safe
    join editorial.credits credit
      on credit.id = attachment.credit_id
     and credit.credit_role = 'author'
     and credit.organization_resource_id is not null
    join editorial.credit_governance governance
      on governance.credit_id = credit.id
     and governance.credit_state = 'active'
     and governance.public_safe
    order by
      current_article.article_id,
      attachment.display_order,
      attachment.created_at,
      attachment.id
  )
  select
    primary_credit.article_id,
    primary_credit.article_slug,
    primary_credit.author_organization_id,
    alias.path as author_organization_path
  from primary_author_credit primary_credit
  join editorial.organizations organization
    on organization.resource_id =
       primary_credit.author_organization_id
   and organization.organization_state = 'active'
  join editorial.resources organization_resource
    on organization_resource.id =
       organization.resource_id
   and organization_resource.resource_kind =
       'organization'
   and organization_resource.visibility = 'public'
   and organization_resource.lifecycle_state = 'active'
  join editorial.resource_aliases alias
    on alias.resource_id =
       organization.resource_id
   and alias.is_canonical
   and alias.retired_at is null
  order by
    primary_credit.article_slug,
    primary_credit.article_id;
$function$;

revoke all
on function
public.list_public_article_author_organization_paths(text)
from public;

grant execute
on function
public.list_public_article_author_organization_paths(text)
to service_role;

create or replace function public.list_public_organization_work(
  p_organization_resource_id uuid,
  p_limit integer default 24,
  p_before_published_at timestamptz default null,
  p_before_resource_id uuid default null
)
returns table(
  resource_id uuid,
  resource_kind text,
  canonical_path text,
  title text,
  summary text,
  image_url text,
  published_at timestamptz,
  credit_role text,
  role_label text,
  is_primary boolean,
  byline text
)
language sql
stable
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
  select
    resource.id as resource_id,
    'article'::text as resource_kind,
    '/magazine/' || article.slug as canonical_path,
    article.title,
    article.excerpt as summary,
    article.hero_image_url as image_url,
    article.published_at,
    credit.credit_role,
    coalesce(
      credit.role_label_snapshot,
      role.label,
      credit.credit_role
    ) as role_label,
    attachment.is_primary,
    article.author as byline
  from editorial.organizations organization
  join editorial.resources organization_resource
    on organization_resource.id =
       organization.resource_id
   and organization_resource.resource_kind =
       'organization'
   and organization_resource.visibility = 'public'
   and organization_resource.lifecycle_state = 'active'
  join editorial.credits credit
    on credit.organization_resource_id =
       organization.resource_id
  join editorial.credit_governance governance
    on governance.credit_id = credit.id
   and governance.credit_state = 'active'
   and governance.public_safe
  join editorial.resource_credits attachment
    on attachment.credit_id = credit.id
   and attachment.resource_kind = 'article'
   and attachment.target_version_type =
       'article_version'
   and attachment.public_safe
  join editorial.resources resource
    on resource.id = attachment.resource_id
   and resource.resource_kind = 'article'
   and resource.visibility = 'public'
   and resource.lifecycle_state = 'published'
   and resource.current_published_version_id =
       attachment.target_version_id
  join editorial.article_resources binding
    on binding.resource_id = resource.id
  join public.wk_article_publication_snapshots article
    on article.article_id = binding.article_id
   and article.resource_id = resource.id
   and article.version_id = attachment.target_version_id
   and article.is_active
  left join editorial.credit_roles role
    on role.credit_role = credit.credit_role
  where organization.resource_id =
        p_organization_resource_id
    and organization.organization_state = 'active'
    and (
      p_before_published_at is null
      or article.published_at <
         p_before_published_at
      or (
        article.published_at =
          p_before_published_at
        and resource.id <
          p_before_resource_id
      )
    )
  order by
    article.published_at desc,
    resource.id desc
  limit least(
    greatest(coalesce(p_limit, 24), 1),
    100
  );
$function$;

revoke all
on function
public.list_public_organization_work(
  uuid,
  integer,
  timestamptz,
  uuid
)
from public;

grant execute
on function
public.list_public_organization_work(
  uuid,
  integer,
  timestamptz,
  uuid
)
to anon, authenticated;

commit;
