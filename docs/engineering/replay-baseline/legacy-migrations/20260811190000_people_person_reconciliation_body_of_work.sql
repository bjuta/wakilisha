-- People / Contributor Identity Migration B:
-- governed reconciliation, merge continuity, and current-public body of work.
--
-- This migration:
-- 1. adds least-privilege People identity capabilities;
-- 2. registers durable link, unlink, and merge Resource commands;
-- 3. adds append-only Person Follow merge-transfer history;
-- 4. adds schema-level merge-cycle protection;
-- 5. adds governed identity link, unlink, and merge commands;
-- 6. resolves immutable Shared Credits to stable Person identity;
-- 7. exposes current-public Article and Playlist body of work;
-- 8. extends public Person presentation with Shared Credit roles.
--
-- This migration does not:
-- - enable public Person Follow;
-- - expose follower counts or follower identities;
-- - create a Person split command;
-- - bulk backfill People;
-- - bulk backfill Article or Playlist Resource aliases;
-- - mutate historical Credits;
-- - change frontend routes;
-- - add Guide body-of-work authority.

begin;

do $people_migration_b_preflight$
declare
  v_required_function text;
  v_required_table text;
begin
  foreach v_required_table in array array[
    'editorial.people',
    'editorial.person_identity_links',
    'editorial.person_identity_events',
    'editorial.resources',
    'editorial.resource_aliases',
    'editorial.resource_credits',
    'editorial.credits',
    'editorial.credit_governance',
    'editorial.article_versions',
    'editorial.playlist_resources',
    'editorial.playlist_publication_snapshots',
    'editorial.external_contributors',
    'public.user_profiles',
    'public.registry_authors',
    'public.community_follows',
    'public.capability_definitions',
    'public.role_capabilities',
    'public.role_definitions',
    'platform_private.command_types',
    'platform_private.command_receipts',
    'platform_private.outbox_events'
  ]
  loop
    if to_regclass(v_required_table) is null then
      raise exception
        'STOP: Required Migration B authority is missing: %',
        v_required_table;
    end if;
  end loop;

  foreach v_required_function in array array[
    'public.current_user_has_capability(text)',
    'public.get_public_person(text)',
    'public.community_get_user_follows(uuid)',
    'editorial.refresh_person_visibility(uuid)',
    'editorial.resolve_person_presentation(uuid)',
    'platform_private.begin_authenticated_resource_command(text,uuid,text,jsonb)',
    'platform_private.read_authenticated_resource_command_result(uuid,boolean)',
    'platform_private.complete_resource_command(uuid,jsonb)',
    'platform_private.reject_resource_command(uuid,text,text,jsonb)'
  ]
  loop
    if to_regprocedure(v_required_function) is null then
      raise exception
        'STOP: Required Migration B function is missing: %',
        v_required_function;
    end if;
  end loop;

  if to_regclass(
       'editorial.person_follow_merge_transfers'
     ) is not null
  then
    raise exception
      'STOP: Person Follow merge-transfer history already exists';
  end if;

  if exists (
    select 1
    from public.capability_definitions
    where capability_key in (
      'view_people_identity',
      'manage_people_identity',
      'merge_people_identity'
    )
  ) then
    raise exception
      'STOP: One or more Migration B People capabilities already exist';
  end if;

  if exists (
    select 1
    from platform_private.command_types
    where command_type in (
      'person.identity_link',
      'person.identity_unlink',
      'person.merge',
      'person.split'
    )
  ) then
    raise exception
      'STOP: One or more Migration B Person commands already exist';
  end if;

  if to_regprocedure(
       'editorial.resolve_credit_person(uuid)'
     ) is not null
     or to_regprocedure(
          'editorial.list_current_public_person_work(uuid)'
        ) is not null
     or to_regprocedure(
          'public.list_public_person_work(uuid,integer,timestamp with time zone,uuid)'
        ) is not null
     or to_regprocedure(
          'public.link_person_identity(uuid,bigint,uuid,uuid,uuid,text,text,text,uuid)'
        ) is not null
     or to_regprocedure(
          'public.unlink_person_identity(uuid,bigint,uuid,text,text,uuid)'
        ) is not null
     or to_regprocedure(
          'public.merge_people(uuid,uuid,bigint,bigint,text,text,uuid)'
        ) is not null
  then
    raise exception
      'STOP: One or more Migration B functions already exist';
  end if;

  if exists (
    select 1
    from (
      values
        ('administrator'),
        ('editor'),
        ('registry_editor')
    ) required(role_key)
    where not exists (
      select 1
      from public.role_definitions definition
      where definition.role_key = required.role_key
    )
  ) then
    raise exception
      'STOP: One or more required People role definitions are missing';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'editorial'
      and tablename = 'person_identity_links'
      and indexname =
        'person_identity_links_active_user_unique'
  )
     or not exists (
       select 1
       from pg_indexes
       where schemaname = 'editorial'
         and tablename = 'person_identity_links'
         and indexname =
           'person_identity_links_active_registry_author_unique'
     )
     or not exists (
       select 1
       from pg_indexes
       where schemaname = 'editorial'
         and tablename = 'person_identity_links'
         and indexname =
           'person_identity_links_active_external_contributor_unique'
     )
  then
    raise exception
      'STOP: Migration A active-source uniqueness authority is missing';
  end if;
end;
$people_migration_b_preflight$;

insert into public.capability_definitions (
  capability_key,
  label,
  description,
  domain
)
values
  (
    'view_people_identity',
    'View People identity',
    'Read governed Person reconciliation and contributor identity state.',
    'content'
  ),
  (
    'manage_people_identity',
    'Manage People identity',
    'Link or unlink governed identity authorities on a Person.',
    'content'
  ),
  (
    'merge_people_identity',
    'Merge People identity',
    'Merge duplicate Person Resources while preserving identity and Follow continuity.',
    'content'
  );

insert into public.role_capabilities (
  role_key,
  capability_key
)
values
  ('administrator', 'view_people_identity'),
  ('administrator', 'manage_people_identity'),
  ('administrator', 'merge_people_identity'),
  ('editor', 'view_people_identity'),
  ('registry_editor', 'view_people_identity');

insert into platform_private.command_types (
  command_type,
  job_type,
  accepted_event_type,
  success_event_type,
  failure_event_type,
  retry_event_type,
  enabled
)
values
  (
    'person.identity_link',
    'person.identity_link.sync',
    'person.identity_link.accepted',
    'person.identity_link.succeeded',
    'person.identity_link.failed',
    'person.identity_link.retry_scheduled',
    true
  ),
  (
    'person.identity_unlink',
    'person.identity_unlink.sync',
    'person.identity_unlink.accepted',
    'person.identity_unlink.succeeded',
    'person.identity_unlink.failed',
    'person.identity_unlink.retry_scheduled',
    true
  ),
  (
    'person.merge',
    'person.merge.sync',
    'person.merge.accepted',
    'person.merge.succeeded',
    'person.merge.failed',
    'person.merge.retry_scheduled',
    true
  );

create table editorial.person_follow_merge_transfers (
  id uuid primary key default gen_random_uuid(),
  merge_event_id uuid not null,
  user_id uuid not null,
  source_person_resource_id uuid not null,
  target_person_resource_id uuid not null,
  source_follow_id uuid not null,
  target_follow_id uuid not null,
  transfer_mode text not null,
  source_follow_created_at timestamptz not null,
  target_follow_preexisted boolean not null,
  created_at timestamptz not null default now(),

  constraint person_follow_merge_transfers_merge_event_fkey
    foreign key (merge_event_id)
    references editorial.person_identity_events(id)
    on update restrict
    on delete restrict,

  constraint person_follow_merge_transfers_source_person_fkey
    foreign key (source_person_resource_id)
    references editorial.people(resource_id)
    on update restrict
    on delete restrict,

  constraint person_follow_merge_transfers_target_person_fkey
    foreign key (target_person_resource_id)
    references editorial.people(resource_id)
    on update restrict
    on delete restrict,

  constraint person_follow_merge_transfers_person_check
    check (
      source_person_resource_id <>
      target_person_resource_id
    ),

  constraint person_follow_merge_transfers_mode_check
    check (
      transfer_mode in (
        'moved',
        'deduplicated'
      )
    ),

  constraint person_follow_merge_transfers_mode_integrity_check
    check (
      (
        transfer_mode = 'moved'
        and source_follow_id = target_follow_id
        and not target_follow_preexisted
      )
      or
      (
        transfer_mode = 'deduplicated'
        and source_follow_id <> target_follow_id
        and target_follow_preexisted
      )
    ),

  constraint person_follow_merge_transfers_merge_source_unique
    unique (
      merge_event_id,
      source_follow_id
    )
);

comment on table editorial.person_follow_merge_transfers is
  'Private append-only evidence of Person Follow intent transferred or deduplicated by a governed Person merge. Follow row ids are intentionally not foreign keys because later user action may remove them.';

create index
  person_follow_merge_transfers_source_idx
on editorial.person_follow_merge_transfers(
  source_person_resource_id,
  created_at desc
);

create index
  person_follow_merge_transfers_target_idx
on editorial.person_follow_merge_transfers(
  target_person_resource_id,
  created_at desc
);

alter table editorial.person_follow_merge_transfers
  enable row level security;

revoke all
on table editorial.person_follow_merge_transfers
from public, anon, authenticated;

grant select, insert
on table editorial.person_follow_merge_transfers
to service_role;

create or replace function
  editorial.protect_person_follow_merge_transfer()
returns trigger
language plpgsql
set search_path to 'pg_catalog'
as $function$
begin
  raise exception
    'Person Follow merge-transfer history is append-only.';
end;
$function$;

create trigger person_follow_merge_transfers_append_only
before update or delete
on editorial.person_follow_merge_transfers
for each row
execute function
  editorial.protect_person_follow_merge_transfer();

revoke all
on function
  editorial.protect_person_follow_merge_transfer()
from public, anon, authenticated;

grant execute
on function
  editorial.protect_person_follow_merge_transfer()
to service_role;

create or replace function
  editorial.assert_person_merge_cycle_integrity()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'editorial'
as $function$
declare
  v_next uuid;
  v_seen uuid[];
  v_depth integer;
begin
  if new.person_state <> 'merged' then
    return null;
  end if;

  v_next :=
    new.merged_into_person_resource_id;
  v_seen :=
    array[new.resource_id];

  for v_depth in 1..64
  loop
    if v_next is null then
      return null;
    end if;

    if v_next = any(v_seen) then
      raise exception
        'Person merge cycle is not permitted.';
    end if;

    v_seen :=
      array_append(
        v_seen,
        v_next
      );

    select
      case
        when person.person_state = 'merged'
          then person.merged_into_person_resource_id
        else null
      end
    into v_next
    from editorial.people person
    where person.resource_id =
          v_next;

    if not found then
      return null;
    end if;
  end loop;

  raise exception
    'Person merge chain exceeds the supported safety depth.';
end;
$function$;

create constraint trigger people_merge_cycle_integrity
after insert or update
on editorial.people
deferrable initially deferred
for each row
execute function
  editorial.assert_person_merge_cycle_integrity();

revoke all
on function
  editorial.assert_person_merge_cycle_integrity()
from public, anon, authenticated;

grant execute
on function
  editorial.assert_person_merge_cycle_integrity()
to service_role;

create or replace function
  editorial.resolve_credit_person(
    p_credit_id uuid
  )
returns uuid
language sql
stable
security definer
set search_path to
  'pg_catalog',
  'editorial'
as $function$
  select person.resource_id
  from editorial.credits credit
  join editorial.person_identity_links link
    on link.link_state = 'active'
   and (
     (
       credit.user_id is not null
       and link.user_id = credit.user_id
     )
     or
     (
       credit.registry_author_id is not null
       and link.registry_author_id =
           credit.registry_author_id
     )
     or
     (
       credit.external_contributor_id is not null
       and link.external_contributor_id =
           credit.external_contributor_id
     )
   )
  join editorial.people person
    on person.resource_id =
       link.person_resource_id
   and person.person_state = 'active'
  where credit.id = p_credit_id
  limit 1;
$function$;

revoke all
on function
  editorial.resolve_credit_person(uuid)
from public, anon, authenticated;

grant execute
on function
  editorial.resolve_credit_person(uuid)
to service_role;

create or replace function
  editorial.list_current_public_person_work(
    p_person_resource_id uuid
  )
returns table (
  resource_id uuid,
  resource_kind text,
  canonical_path text,
  title text,
  summary text,
  image_url text,
  published_at timestamptz,
  roles jsonb,
  is_primary boolean
)
language sql
stable
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
  with eligible_person as (
    select person.resource_id
    from editorial.people person
    join editorial.resources person_resource
      on person_resource.id =
         person.resource_id
     and person_resource.resource_kind =
         'person'
    where person.resource_id =
          p_person_resource_id
      and person.person_state = 'active'
      and person_resource.visibility =
          'public'
      and person_resource.lifecycle_state =
          'active'
  ),
  article_work as (
    select
      resource.id as resource_id,
      'article'::text as resource_kind,
      coalesce(
        canonical_alias.path,
        '/magazine/' || version.slug
      ) as canonical_path,
      version.title,
      version.excerpt as summary,
      version.hero_image_url as image_url,
      version.published_at,
      jsonb_agg(
        jsonb_build_object(
          'role',
            credit.credit_role,
          'role_label',
            coalesce(
              nullif(
                btrim(
                  credit.role_label_snapshot
                ),
                ''
              ),
              credit.credit_role
            ),
          'display_order',
            attachment.display_order,
          'is_primary',
            attachment.is_primary
        )
        order by
          attachment.display_order,
          credit.id
      ) as roles,
      bool_or(
        attachment.is_primary
      ) as is_primary
    from eligible_person person
    join editorial.resources resource
      on resource.resource_kind = 'article'
     and resource.visibility = 'public'
     and resource.lifecycle_state =
         'published'
     and resource.current_published_version_id
         is not null
    join editorial.article_versions version
      on version.id =
         resource.current_published_version_id
     and version.resource_id =
         resource.id
     and version.published_at is not null
    join editorial.resource_credits attachment
      on attachment.resource_id =
         resource.id
     and attachment.resource_kind =
         'article'
     and attachment.target_version_type =
         'article_version'
     and attachment.target_version_id =
         version.id
     and attachment.public_safe
    join editorial.credits credit
      on credit.id =
         attachment.credit_id
    join editorial.credit_governance governance
      on governance.credit_id =
         credit.id
     and governance.public_safe
     and governance.credit_state =
         'active'
    left join editorial.external_contributors contributor
      on contributor.id =
         credit.external_contributor_id
    left join lateral (
      select alias.path
      from editorial.resource_aliases alias
      where alias.resource_id =
            resource.id
        and alias.is_canonical
        and alias.retired_at is null
      limit 1
    ) canonical_alias
      on true
    where editorial.resolve_credit_person(
            credit.id
          ) = person.resource_id
      and (
        credit.external_contributor_id is null
        or (
          contributor.contributor_state =
            'active'
          and contributor.public_safe
          and contributor.consent_status in (
            'granted',
            'not_required'
          )
        )
      )
    group by
      resource.id,
      canonical_alias.path,
      version.title,
      version.excerpt,
      version.hero_image_url,
      version.published_at,
      version.slug
  ),
  playlist_work as (
    select
      resource.id as resource_id,
      'playlist'::text as resource_kind,
      coalesce(
        canonical_alias.path,
        '/playlists/' || snapshot.slug
      ) as canonical_path,
      snapshot.title,
      snapshot.description as summary,
      snapshot.cover_url as image_url,
      snapshot.published_at,
      jsonb_agg(
        jsonb_build_object(
          'role',
            credit.credit_role,
          'role_label',
            coalesce(
              nullif(
                btrim(
                  credit.role_label_snapshot
                ),
                ''
              ),
              credit.credit_role
            ),
          'display_order',
            attachment.display_order,
          'is_primary',
            attachment.is_primary
        )
        order by
          attachment.display_order,
          credit.id
      ) as roles,
      bool_or(
        attachment.is_primary
      ) as is_primary
    from eligible_person person
    join editorial.resources resource
      on resource.resource_kind =
         'playlist'
     and resource.visibility = 'public'
     and resource.lifecycle_state =
         'published'
    join editorial.playlist_resources binding
      on binding.resource_id =
         resource.id
     and binding.current_published_version_id
         is not null
    join editorial.playlist_publication_snapshots snapshot
      on snapshot.resource_id =
         binding.resource_id
     and snapshot.playlist_id =
         binding.playlist_id
     and snapshot.version_id =
         binding.current_published_version_id
    join editorial.resource_credits attachment
      on attachment.resource_id =
         resource.id
     and attachment.resource_kind =
         'playlist'
     and attachment.target_version_type =
         'playlist_version'
     and attachment.target_version_id =
         snapshot.version_id
     and attachment.public_safe
    join editorial.credits credit
      on credit.id =
         attachment.credit_id
    join editorial.credit_governance governance
      on governance.credit_id =
         credit.id
     and governance.public_safe
     and governance.credit_state =
         'active'
    left join editorial.external_contributors contributor
      on contributor.id =
         credit.external_contributor_id
    left join lateral (
      select alias.path
      from editorial.resource_aliases alias
      where alias.resource_id =
            resource.id
        and alias.is_canonical
        and alias.retired_at is null
      limit 1
    ) canonical_alias
      on true
    where editorial.resolve_credit_person(
            credit.id
          ) = person.resource_id
      and (
        credit.external_contributor_id is null
        or (
          contributor.contributor_state =
            'active'
          and contributor.public_safe
          and contributor.consent_status in (
            'granted',
            'not_required'
          )
        )
      )
    group by
      resource.id,
      canonical_alias.path,
      snapshot.title,
      snapshot.description,
      snapshot.cover_url,
      snapshot.published_at,
      snapshot.slug
  )
  select *
  from article_work

  union all

  select *
  from playlist_work;
$function$;

revoke all
on function
  editorial.list_current_public_person_work(uuid)
from public, anon, authenticated;

grant execute
on function
  editorial.list_current_public_person_work(uuid)
to service_role;

create or replace function
  public.list_public_person_work(
    p_person_resource_id uuid,
    p_limit integer default 24,
    p_before_published_at timestamptz default null,
    p_before_resource_id uuid default null
  )
returns table (
  resource_id uuid,
  resource_kind text,
  canonical_path text,
  title text,
  summary text,
  image_url text,
  published_at timestamptz,
  roles jsonb,
  is_primary boolean
)
language sql
stable
security definer
set search_path to
  'pg_catalog',
  'editorial'
as $function$
  select
    work.resource_id,
    work.resource_kind,
    work.canonical_path,
    work.title,
    work.summary,
    work.image_url,
    work.published_at,
    work.roles,
    work.is_primary
  from editorial.list_current_public_person_work(
    p_person_resource_id
  ) work
  where (
    p_before_published_at is null
    or (
      work.published_at,
      work.resource_id
    ) < (
      p_before_published_at,
      coalesce(
        p_before_resource_id,
        'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid
      )
    )
  )
  order by
    work.published_at desc,
    work.resource_id desc
  limit least(
    greatest(
      coalesce(
        p_limit,
        24
      ),
      1
    ),
    50
  );
$function$;

revoke all
on function
  public.list_public_person_work(
    uuid,
    integer,
    timestamptz,
    uuid
  )
from public, anon, authenticated, service_role;

grant execute
on function
  public.list_public_person_work(
    uuid,
    integer,
    timestamptz,
    uuid
  )
to anon, authenticated, service_role;

create or replace function
  public.link_person_identity(
    p_person_resource_id uuid,
    p_expected_identity_revision bigint,
    p_user_id uuid,
    p_registry_author_id uuid,
    p_external_contributor_id uuid,
    p_link_method text,
    p_reason text,
    p_idempotency_key text,
    p_correlation_id uuid default null
  )
returns table (
  command_receipt_id uuid,
  receipt_status text,
  person_resource_id uuid,
  identity_revision bigint,
  identity_link_id uuid,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'auth',
  'editorial',
  'platform_private'
as $function$
declare
  v_actor_id uuid;
  v_person editorial.people%rowtype;
  v_begin record;
  v_read record;
  v_request jsonb;
  v_result jsonb;
  v_correlation_id uuid;
  v_source_key text;
  v_source_exists boolean;
  v_existing_source_link
    editorial.person_identity_links%rowtype;
  v_conflicting_link_id uuid;
  v_new_link_id uuid;
  v_prior_revision bigint;
begin
  if p_person_resource_id is null
     or p_expected_identity_revision is null
     or p_expected_identity_revision < 1
     or num_nonnulls(
          p_user_id,
          p_registry_author_id,
          p_external_contributor_id
        ) <> 1
     or p_link_method <>
        'admin_reconciliation'
     or nullif(
          btrim(
            coalesce(
              p_reason,
              ''
            )
          ),
          ''
        ) is null
  then
    raise exception
      using
        errcode = '22023',
        message =
          'Valid Person, expected revision, one typed source, admin_reconciliation method, and reason are required.';
  end if;

  if coalesce(
       auth.role(),
       ''
     ) <> 'authenticated'
     or auth.uid() is null
     or not public.current_user_has_capability(
       'manage_people_identity'
     )
  then
    raise exception
      using
        errcode = '42501',
        message =
          'People identity management permission is required.';
  end if;

  v_actor_id :=
    auth.uid();

  if p_user_id is not null then
    v_source_key :=
      'person-source|user|' ||
      p_user_id::text;
  elsif p_registry_author_id is not null then
    v_source_key :=
      'person-source|registry-author|' ||
      p_registry_author_id::text;
  else
    v_source_key :=
      'person-source|external-contributor|' ||
      p_external_contributor_id::text;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_source_key,
      0
    )
  );

  select person.*
  into v_person
  from editorial.people person
  where person.resource_id =
        p_person_resource_id
  for update;

  if not exists (
    select 1
    from editorial.resources resource
    where resource.id =
          p_person_resource_id
  ) then
    raise exception
      using
        errcode = 'P0002',
        message =
          'The Person Resource does not exist.';
  end if;

  v_request :=
    jsonb_build_object(
      'person_resource_id',
        p_person_resource_id,
      'expected_identity_revision',
        p_expected_identity_revision,
      'user_id',
        p_user_id,
      'registry_author_id',
        p_registry_author_id,
      'external_contributor_id',
        p_external_contributor_id,
      'link_method',
        p_link_method,
      'reason',
        p_reason,
      'correlation_id',
        p_correlation_id
    );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'person.identity_link',
    p_person_resource_id,
    p_idempotency_key,
    v_request
  );

  if v_begin.idempotent_replay then
    select *
    into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_begin.command_receipt_id,
      true
    );

    command_receipt_id :=
      v_read.command_receipt_id;
    receipt_status :=
      v_read.receipt_status;
    person_resource_id :=
      p_person_resource_id;
    identity_revision :=
      nullif(
        v_read.result_payload
          ->> 'identity_revision',
        ''
      )::bigint;
    identity_link_id :=
      nullif(
        v_read.result_payload
          ->> 'identity_link_id',
        ''
      )::uuid;
    result_payload :=
      v_read.result_payload;
    idempotent_replay :=
      true;
    return next;
    return;
  end if;

  v_correlation_id :=
    coalesce(
      p_correlation_id,
      gen_random_uuid()
    );

  if v_person.resource_id is null then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'person_not_found',
      'The Person does not exist.',
      jsonb_build_object(
        'person_resource_id',
          p_person_resource_id,
        'identity_revision',
          null
      )
    );

  elsif v_person.person_state <> 'active' then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'person_not_active',
      'Only an active Person may receive a reconciled identity.',
      jsonb_build_object(
        'person_resource_id',
          p_person_resource_id,
        'identity_revision',
          v_person.identity_revision,
        'person_state',
          v_person.person_state
      )
    );

  elsif v_person.identity_revision <>
        p_expected_identity_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'person_identity_revision_changed',
      'The Person identity changed before this link could be applied.',
      jsonb_build_object(
        'person_resource_id',
          p_person_resource_id,
        'identity_revision',
          v_person.identity_revision
      )
    );

  else
    if p_user_id is not null then
      select exists (
        select 1
        from public.user_profiles profile
        where profile.user_id =
              p_user_id
      )
      into v_source_exists;

      select link.*
      into v_existing_source_link
      from editorial.person_identity_links link
      where link.user_id =
            p_user_id
        and link.link_state = 'active';

    elsif p_registry_author_id is not null then
      select exists (
        select 1
        from public.registry_authors author
        where author.id =
              p_registry_author_id
      )
      into v_source_exists;

      select link.*
      into v_existing_source_link
      from editorial.person_identity_links link
      where link.registry_author_id =
            p_registry_author_id
        and link.link_state = 'active';

    else
      select exists (
        select 1
        from editorial.external_contributors contributor
        where contributor.id =
              p_external_contributor_id
      )
      into v_source_exists;

      select link.*
      into v_existing_source_link
      from editorial.person_identity_links link
      where link.external_contributor_id =
            p_external_contributor_id
        and link.link_state = 'active';
    end if;

    if not v_source_exists then
      perform platform_private.reject_resource_command(
        v_begin.command_receipt_id,
        'person_identity_source_not_found',
        'The requested Person identity source does not exist.',
        jsonb_build_object(
          'person_resource_id',
            p_person_resource_id,
          'identity_revision',
            v_person.identity_revision
        )
      );

    elsif v_existing_source_link.id is not null
          and v_existing_source_link.person_resource_id =
              p_person_resource_id
    then
      v_result :=
        jsonb_build_object(
          'person_resource_id',
            p_person_resource_id,
          'identity_revision',
            v_person.identity_revision,
          'identity_link_id',
            v_existing_source_link.id,
          'changed',
            false,
          'correlation_id',
            v_correlation_id
        );

      perform platform_private.complete_resource_command(
        v_begin.command_receipt_id,
        v_result
      );

    elsif v_existing_source_link.id is not null then
      perform platform_private.reject_resource_command(
        v_begin.command_receipt_id,
        'person_identity_source_already_linked',
        'The identity source is already linked to another Person.',
        jsonb_build_object(
          'person_resource_id',
            p_person_resource_id,
          'identity_revision',
            v_person.identity_revision,
          'linked_person_resource_id',
            v_existing_source_link.person_resource_id
        )
      );

    else
      v_conflicting_link_id := null;

      if p_user_id is not null then
        select link.id
        into v_conflicting_link_id
        from editorial.person_identity_links link
        where link.person_resource_id =
              p_person_resource_id
          and link.link_state = 'active'
          and link.user_id is not null
        limit 1;

      elsif p_registry_author_id is not null then
        select link.id
        into v_conflicting_link_id
        from editorial.person_identity_links link
        where link.person_resource_id =
              p_person_resource_id
          and link.link_state = 'active'
          and link.registry_author_id is not null
        limit 1;
      end if;

      if v_conflicting_link_id is not null then
        perform platform_private.reject_resource_command(
          v_begin.command_receipt_id,
          'person_identity_kind_conflict',
          'The Person already has a different active identity of this kind.',
          jsonb_build_object(
            'person_resource_id',
              p_person_resource_id,
            'identity_revision',
              v_person.identity_revision,
            'conflicting_identity_link_id',
              v_conflicting_link_id
          )
        );

      else
        v_new_link_id :=
          gen_random_uuid();
        v_prior_revision :=
          v_person.identity_revision;

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
          v_new_link_id,
          p_person_resource_id,
          'person',
          p_user_id,
          p_registry_author_id,
          p_external_contributor_id,
          'active',
          'admin_reconciliation',
          p_reason,
          v_actor_id
        );

        update editorial.people person
        set
          preferred_identity_link_id =
            coalesce(
              person.preferred_identity_link_id,
              v_new_link_id
            ),
          identity_revision =
            person.identity_revision + 1,
          updated_by =
            v_actor_id,
          updated_at =
            now()
        where person.resource_id =
              p_person_resource_id
        returning person.*
        into v_person;

        insert into editorial.person_identity_events (
          person_resource_id,
          actor_id,
          event_type,
          identity_link_id,
          prior_identity_revision,
          resulting_identity_revision,
          reason,
          correlation_id
        )
        values (
          p_person_resource_id,
          v_actor_id,
          'identity_linked',
          v_new_link_id,
          v_prior_revision,
          v_person.identity_revision,
          p_reason,
          v_correlation_id
        );

        perform editorial.refresh_person_visibility(
          p_person_resource_id
        );

        v_result :=
          jsonb_build_object(
            'person_resource_id',
              p_person_resource_id,
            'identity_revision',
              v_person.identity_revision,
            'identity_link_id',
              v_new_link_id,
            'changed',
              true,
            'correlation_id',
              v_correlation_id
          );

        perform platform_private.complete_resource_command(
          v_begin.command_receipt_id,
          v_result
        );
      end if;
    end if;
  end if;

  select *
  into v_read
  from platform_private.read_authenticated_resource_command_result(
    v_begin.command_receipt_id,
    false
  );

  command_receipt_id :=
    v_read.command_receipt_id;
  receipt_status :=
    v_read.receipt_status;
  person_resource_id :=
    p_person_resource_id;
  identity_revision :=
    nullif(
      v_read.result_payload
        ->> 'identity_revision',
      ''
    )::bigint;
  identity_link_id :=
    nullif(
      v_read.result_payload
        ->> 'identity_link_id',
      ''
    )::uuid;
  result_payload :=
    v_read.result_payload;
  idempotent_replay :=
    false;
  return next;
end;
$function$;

revoke all
on function
  public.link_person_identity(
    uuid,
    bigint,
    uuid,
    uuid,
    uuid,
    text,
    text,
    text,
    uuid
  )
from public, anon, authenticated, service_role;

grant execute
on function
  public.link_person_identity(
    uuid,
    bigint,
    uuid,
    uuid,
    uuid,
    text,
    text,
    text,
    uuid
  )
to authenticated, service_role;

create or replace function
  public.unlink_person_identity(
    p_person_resource_id uuid,
    p_expected_identity_revision bigint,
    p_identity_link_id uuid,
    p_reason text,
    p_idempotency_key text,
    p_correlation_id uuid default null
  )
returns table (
  command_receipt_id uuid,
  receipt_status text,
  person_resource_id uuid,
  identity_revision bigint,
  identity_link_id uuid,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'auth',
  'editorial',
  'platform_private'
as $function$
declare
  v_actor_id uuid;
  v_person editorial.people%rowtype;
  v_link editorial.person_identity_links%rowtype;
  v_begin record;
  v_read record;
  v_request jsonb;
  v_result jsonb;
  v_correlation_id uuid;
  v_prior_revision bigint;
begin
  if p_person_resource_id is null
     or p_expected_identity_revision is null
     or p_expected_identity_revision < 1
     or p_identity_link_id is null
     or nullif(
          btrim(
            coalesce(
              p_reason,
              ''
            )
          ),
          ''
        ) is null
  then
    raise exception
      using
        errcode = '22023',
        message =
          'Valid Person, expected revision, identity link, and reason are required.';
  end if;

  if coalesce(
       auth.role(),
       ''
     ) <> 'authenticated'
     or auth.uid() is null
     or not public.current_user_has_capability(
       'manage_people_identity'
     )
  then
    raise exception
      using
        errcode = '42501',
        message =
          'People identity management permission is required.';
  end if;

  v_actor_id :=
    auth.uid();

  select person.*
  into v_person
  from editorial.people person
  where person.resource_id =
        p_person_resource_id
  for update;

  if not exists (
    select 1
    from editorial.resources resource
    where resource.id =
          p_person_resource_id
  ) then
    raise exception
      using
        errcode = 'P0002',
        message =
          'The Person Resource does not exist.';
  end if;

  v_request :=
    jsonb_build_object(
      'person_resource_id',
        p_person_resource_id,
      'expected_identity_revision',
        p_expected_identity_revision,
      'identity_link_id',
        p_identity_link_id,
      'reason',
        p_reason,
      'correlation_id',
        p_correlation_id
    );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'person.identity_unlink',
    p_person_resource_id,
    p_idempotency_key,
    v_request
  );

  if v_begin.idempotent_replay then
    select *
    into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_begin.command_receipt_id,
      true
    );

    command_receipt_id :=
      v_read.command_receipt_id;
    receipt_status :=
      v_read.receipt_status;
    person_resource_id :=
      p_person_resource_id;
    identity_revision :=
      nullif(
        v_read.result_payload
          ->> 'identity_revision',
        ''
      )::bigint;
    identity_link_id :=
      p_identity_link_id;
    result_payload :=
      v_read.result_payload;
    idempotent_replay :=
      true;
    return next;
    return;
  end if;

  v_correlation_id :=
    coalesce(
      p_correlation_id,
      gen_random_uuid()
    );

  if v_person.resource_id is null then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'person_not_found',
      'The Person does not exist.',
      jsonb_build_object(
        'person_resource_id',
          p_person_resource_id,
        'identity_revision',
          null,
        'identity_link_id',
          p_identity_link_id
      )
    );

  elsif v_person.person_state <> 'active' then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'person_not_active',
      'Only an active Person may unlink an identity.',
      jsonb_build_object(
        'person_resource_id',
          p_person_resource_id,
        'identity_revision',
          v_person.identity_revision,
        'identity_link_id',
          p_identity_link_id,
        'person_state',
          v_person.person_state
      )
    );

  elsif v_person.identity_revision <>
        p_expected_identity_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'person_identity_revision_changed',
      'The Person identity changed before this unlink could be applied.',
      jsonb_build_object(
        'person_resource_id',
          p_person_resource_id,
        'identity_revision',
          v_person.identity_revision,
        'identity_link_id',
          p_identity_link_id
      )
    );

  else
    select link.*
    into v_link
    from editorial.person_identity_links link
    where link.id =
          p_identity_link_id
      and link.person_resource_id =
          p_person_resource_id
    for update;

    if v_link.id is null then
      perform platform_private.reject_resource_command(
        v_begin.command_receipt_id,
        'person_identity_link_not_found',
        'The Person identity link does not exist.',
        jsonb_build_object(
          'person_resource_id',
            p_person_resource_id,
          'identity_revision',
            v_person.identity_revision,
          'identity_link_id',
            p_identity_link_id
        )
      );

    elsif v_link.link_state <> 'active' then
      perform platform_private.reject_resource_command(
        v_begin.command_receipt_id,
        'person_identity_link_not_active',
        'Only an active Person identity link may be unlinked.',
        jsonb_build_object(
          'person_resource_id',
            p_person_resource_id,
          'identity_revision',
            v_person.identity_revision,
          'identity_link_id',
            p_identity_link_id,
          'link_state',
            v_link.link_state
        )
      );

    else
      v_prior_revision :=
        v_person.identity_revision;

      update editorial.people person
      set
        preferred_identity_link_id =
          case
            when person.preferred_identity_link_id =
                 p_identity_link_id
              then null
            else person.preferred_identity_link_id
          end,
        identity_revision =
          person.identity_revision + 1,
        updated_by =
          v_actor_id,
        updated_at =
          now()
      where person.resource_id =
            p_person_resource_id
      returning person.*
      into v_person;

      update editorial.person_identity_links link
      set
        link_state =
          'retired',
        retired_by =
          v_actor_id,
        retired_at =
          now(),
        retired_reason =
          p_reason
      where link.id =
            p_identity_link_id;

      insert into editorial.person_identity_events (
        person_resource_id,
        actor_id,
        event_type,
        identity_link_id,
        prior_identity_revision,
        resulting_identity_revision,
        reason,
        correlation_id
      )
      values (
        p_person_resource_id,
        v_actor_id,
        'identity_unlinked',
        p_identity_link_id,
        v_prior_revision,
        v_person.identity_revision,
        p_reason,
        v_correlation_id
      );

      perform editorial.refresh_person_visibility(
        p_person_resource_id
      );

      v_result :=
        jsonb_build_object(
          'person_resource_id',
            p_person_resource_id,
          'identity_revision',
            v_person.identity_revision,
          'identity_link_id',
            p_identity_link_id,
          'changed',
            true,
          'correlation_id',
            v_correlation_id
        );

      perform platform_private.complete_resource_command(
        v_begin.command_receipt_id,
        v_result
      );
    end if;
  end if;

  select *
  into v_read
  from platform_private.read_authenticated_resource_command_result(
    v_begin.command_receipt_id,
    false
  );

  command_receipt_id :=
    v_read.command_receipt_id;
  receipt_status :=
    v_read.receipt_status;
  person_resource_id :=
    p_person_resource_id;
  identity_revision :=
    nullif(
      v_read.result_payload
        ->> 'identity_revision',
      ''
    )::bigint;
  identity_link_id :=
    p_identity_link_id;
  result_payload :=
    v_read.result_payload;
  idempotent_replay :=
    false;
  return next;
end;
$function$;

revoke all
on function
  public.unlink_person_identity(
    uuid,
    bigint,
    uuid,
    text,
    text,
    uuid
  )
from public, anon, authenticated, service_role;

grant execute
on function
  public.unlink_person_identity(
    uuid,
    bigint,
    uuid,
    text,
    text,
    uuid
  )
to authenticated, service_role;

create or replace function
  public.merge_people(
    p_source_person_resource_id uuid,
    p_target_person_resource_id uuid,
    p_expected_source_identity_revision bigint,
    p_expected_target_identity_revision bigint,
    p_reason text,
    p_idempotency_key text,
    p_correlation_id uuid default null
  )
returns table (
  command_receipt_id uuid,
  receipt_status text,
  source_person_resource_id uuid,
  target_person_resource_id uuid,
  source_identity_revision bigint,
  target_identity_revision bigint,
  merge_event_id uuid,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'auth',
  'editorial',
  'platform_private'
as $function$
declare
  v_actor_id uuid;
  v_source editorial.people%rowtype;
  v_target editorial.people%rowtype;
  v_source_prior_revision bigint;
  v_target_prior_revision bigint;
  v_source_user_id uuid;
  v_target_user_id uuid;
  v_source_registry_author_id uuid;
  v_target_registry_author_id uuid;
  v_begin record;
  v_read record;
  v_request jsonb;
  v_result jsonb;
  v_correlation_id uuid;
  v_source_merge_event_id uuid;
  v_target_merge_event_id uuid;
  v_target_path text;
  v_target_slug text;
  v_link editorial.person_identity_links%rowtype;
  v_new_link_id uuid;
  v_follow public.community_follows%rowtype;
  v_existing_target_follow_id uuid;
  v_moved_follow_count integer := 0;
  v_deduplicated_follow_count integer := 0;
begin
  if p_source_person_resource_id is null
     or p_target_person_resource_id is null
     or p_source_person_resource_id =
        p_target_person_resource_id
     or p_expected_source_identity_revision
        is null
     or p_expected_source_identity_revision < 1
     or p_expected_target_identity_revision
        is null
     or p_expected_target_identity_revision < 1
     or nullif(
          btrim(
            coalesce(
              p_reason,
              ''
            )
          ),
          ''
        ) is null
  then
    raise exception
      using
        errcode = '22023',
        message =
          'Distinct source and target People, expected revisions, and reason are required.';
  end if;

  if coalesce(
       auth.role(),
       ''
     ) <> 'authenticated'
     or auth.uid() is null
     or not public.current_user_has_capability(
       'merge_people_identity'
     )
  then
    raise exception
      using
        errcode = '42501',
        message =
          'People merge permission is required.';
  end if;

  v_actor_id :=
    auth.uid();

  if not exists (
    select 1
    from editorial.resources resource
    where resource.id =
          p_source_person_resource_id
  ) then
    raise exception
      using
        errcode = 'P0002',
        message =
          'The source Person Resource does not exist.';
  end if;

  perform person.resource_id
  from editorial.people person
  where person.resource_id in (
    p_source_person_resource_id,
    p_target_person_resource_id
  )
  order by person.resource_id
  for update;

  select person.*
  into v_source
  from editorial.people person
  where person.resource_id =
        p_source_person_resource_id;

  select person.*
  into v_target
  from editorial.people person
  where person.resource_id =
        p_target_person_resource_id;

  v_request :=
    jsonb_build_object(
      'source_person_resource_id',
        p_source_person_resource_id,
      'target_person_resource_id',
        p_target_person_resource_id,
      'expected_source_identity_revision',
        p_expected_source_identity_revision,
      'expected_target_identity_revision',
        p_expected_target_identity_revision,
      'reason',
        p_reason,
      'correlation_id',
        p_correlation_id
    );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'person.merge',
    p_source_person_resource_id,
    p_idempotency_key,
    v_request
  );

  if v_begin.idempotent_replay then
    select *
    into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_begin.command_receipt_id,
      true
    );

    command_receipt_id :=
      v_read.command_receipt_id;
    receipt_status :=
      v_read.receipt_status;
    source_person_resource_id :=
      p_source_person_resource_id;
    target_person_resource_id :=
      p_target_person_resource_id;
    source_identity_revision :=
      nullif(
        v_read.result_payload
          ->> 'source_identity_revision',
        ''
      )::bigint;
    target_identity_revision :=
      nullif(
        v_read.result_payload
          ->> 'target_identity_revision',
        ''
      )::bigint;
    merge_event_id :=
      nullif(
        v_read.result_payload
          ->> 'merge_event_id',
        ''
      )::uuid;
    result_payload :=
      v_read.result_payload;
    idempotent_replay :=
      true;
    return next;
    return;
  end if;

  v_correlation_id :=
    coalesce(
      p_correlation_id,
      gen_random_uuid()
    );

  if v_source.resource_id is null then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'person_merge_source_not_found',
      'The source Person does not exist.',
      jsonb_build_object(
        'source_person_resource_id',
          p_source_person_resource_id,
        'target_person_resource_id',
          p_target_person_resource_id,
        'source_identity_revision',
          null,
        'target_identity_revision',
          case
            when v_target.resource_id is null
              then null
            else v_target.identity_revision
          end
      )
    );

  elsif v_target.resource_id is null then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'person_merge_target_not_found',
      'The target Person does not exist.',
      jsonb_build_object(
        'source_person_resource_id',
          p_source_person_resource_id,
        'target_person_resource_id',
          p_target_person_resource_id,
        'source_identity_revision',
          v_source.identity_revision,
        'target_identity_revision',
          null
      )
    );

  elsif v_source.person_state <> 'active'
        or v_target.person_state <> 'active'
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'person_merge_state_invalid',
      'Both source and target People must be active.',
      jsonb_build_object(
        'source_person_resource_id',
          p_source_person_resource_id,
        'target_person_resource_id',
          p_target_person_resource_id,
        'source_identity_revision',
          v_source.identity_revision,
        'target_identity_revision',
          v_target.identity_revision,
        'source_person_state',
          v_source.person_state,
        'target_person_state',
          v_target.person_state
      )
    );

  elsif v_source.identity_revision <>
        p_expected_source_identity_revision
        or v_target.identity_revision <>
           p_expected_target_identity_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'person_merge_revision_changed',
      'The source or target Person identity changed before this merge could be applied.',
      jsonb_build_object(
        'source_person_resource_id',
          p_source_person_resource_id,
        'target_person_resource_id',
          p_target_person_resource_id,
        'source_identity_revision',
          v_source.identity_revision,
        'target_identity_revision',
          v_target.identity_revision
      )
    );

  else
    select link.user_id
    into v_source_user_id
    from editorial.person_identity_links link
    where link.person_resource_id =
          p_source_person_resource_id
      and link.link_state = 'active'
      and link.user_id is not null
    limit 1;

    select link.user_id
    into v_target_user_id
    from editorial.person_identity_links link
    where link.person_resource_id =
          p_target_person_resource_id
      and link.link_state = 'active'
      and link.user_id is not null
    limit 1;

    select link.registry_author_id
    into v_source_registry_author_id
    from editorial.person_identity_links link
    where link.person_resource_id =
          p_source_person_resource_id
      and link.link_state = 'active'
      and link.registry_author_id is not null
    limit 1;

    select link.registry_author_id
    into v_target_registry_author_id
    from editorial.person_identity_links link
    where link.person_resource_id =
          p_target_person_resource_id
      and link.link_state = 'active'
      and link.registry_author_id is not null
    limit 1;

    select alias.path
    into v_target_path
    from editorial.resource_aliases alias
    where alias.resource_id =
          p_target_person_resource_id
      and alias.is_canonical
      and alias.retired_at is null;

    if v_source_user_id is not null
       and v_target_user_id is not null
       and v_source_user_id <>
           v_target_user_id
    then
      perform platform_private.reject_resource_command(
        v_begin.command_receipt_id,
        'person_merge_account_conflict',
        'Source and target People have different active account identities.',
        jsonb_build_object(
          'source_person_resource_id',
            p_source_person_resource_id,
          'target_person_resource_id',
            p_target_person_resource_id,
          'source_identity_revision',
            v_source.identity_revision,
          'target_identity_revision',
            v_target.identity_revision
        )
      );

    elsif v_source_registry_author_id is not null
          and v_target_registry_author_id is not null
          and v_source_registry_author_id <>
              v_target_registry_author_id
    then
      perform platform_private.reject_resource_command(
        v_begin.command_receipt_id,
        'person_merge_registry_author_conflict',
        'Source and target People have different active Registry Author identities.',
        jsonb_build_object(
          'source_person_resource_id',
            p_source_person_resource_id,
          'target_person_resource_id',
            p_target_person_resource_id,
          'source_identity_revision',
            v_source.identity_revision,
          'target_identity_revision',
            v_target.identity_revision
        )
      );

    elsif v_target_path is null
          or v_target_path !~ '^/people/[^/]+$'
    then
      perform platform_private.reject_resource_command(
        v_begin.command_receipt_id,
        'person_merge_target_route_invalid',
        'The target Person does not have a valid canonical Person route.',
        jsonb_build_object(
          'source_person_resource_id',
            p_source_person_resource_id,
          'target_person_resource_id',
            p_target_person_resource_id,
          'source_identity_revision',
            v_source.identity_revision,
          'target_identity_revision',
            v_target.identity_revision
        )
      );

    else
      v_target_slug :=
        split_part(
          v_target_path,
          '/',
          3
        );

      v_source_prior_revision :=
        v_source.identity_revision;
      v_target_prior_revision :=
        v_target.identity_revision;

      update editorial.people person
      set
        preferred_identity_link_id =
          null,
        identity_revision =
          person.identity_revision + 1,
        updated_by =
          v_actor_id,
        updated_at =
          now()
      where person.resource_id =
            p_source_person_resource_id
      returning person.*
      into v_source;

      for v_link in
        select link.*
        from editorial.person_identity_links link
        where link.person_resource_id =
              p_source_person_resource_id
          and link.link_state = 'active'
        order by link.id
        for update
      loop
        v_new_link_id :=
          gen_random_uuid();

        update editorial.person_identity_links link
        set
          link_state =
            'superseded',
          superseded_by_link_id =
            v_new_link_id,
          retired_by =
            v_actor_id,
          retired_at =
            now(),
          retired_reason =
            p_reason
        where link.id =
              v_link.id;

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
          supersedes_link_id,
          created_by
        )
        values (
          v_new_link_id,
          p_target_person_resource_id,
          'person',
          v_link.user_id,
          v_link.registry_author_id,
          v_link.external_contributor_id,
          'active',
          'person_merge',
          p_reason,
          v_link.id,
          v_actor_id
        );
      end loop;

      update editorial.people person
      set
        identity_revision =
          person.identity_revision + 1,
        updated_by =
          v_actor_id,
        updated_at =
          now()
      where person.resource_id =
            p_target_person_resource_id
      returning person.*
      into v_target;

      v_source_merge_event_id :=
        gen_random_uuid();
      v_target_merge_event_id :=
        gen_random_uuid();

      insert into editorial.person_identity_events (
        id,
        person_resource_id,
        actor_id,
        event_type,
        related_person_resource_id,
        prior_identity_revision,
        resulting_identity_revision,
        reason,
        correlation_id
      )
      values
        (
          v_source_merge_event_id,
          p_source_person_resource_id,
          v_actor_id,
          'person_merged',
          p_target_person_resource_id,
          v_source_prior_revision,
          v_source.identity_revision,
          p_reason,
          v_correlation_id
        ),
        (
          v_target_merge_event_id,
          p_target_person_resource_id,
          v_actor_id,
          'person_merged',
          p_source_person_resource_id,
          v_target_prior_revision,
          v_target.identity_revision,
          p_reason,
          v_correlation_id
        );

      for v_follow in
        select follow_row.*
        from public.community_follows follow_row
        where follow_row.target_type =
              'person'
          and follow_row.target_id =
              p_source_person_resource_id::text
        order by follow_row.id
        for update
      loop
        v_existing_target_follow_id :=
          null;

        select target_follow.id
        into v_existing_target_follow_id
        from public.community_follows target_follow
        where target_follow.user_id =
              v_follow.user_id
          and target_follow.target_type =
              'person'
          and target_follow.target_id =
              p_target_person_resource_id::text
        for update;

        if v_existing_target_follow_id is not null then
          insert into editorial.person_follow_merge_transfers (
            merge_event_id,
            user_id,
            source_person_resource_id,
            target_person_resource_id,
            source_follow_id,
            target_follow_id,
            transfer_mode,
            source_follow_created_at,
            target_follow_preexisted
          )
          values (
            v_source_merge_event_id,
            v_follow.user_id,
            p_source_person_resource_id,
            p_target_person_resource_id,
            v_follow.id,
            v_existing_target_follow_id,
            'deduplicated',
            v_follow.created_at,
            true
          );

          delete from public.community_follows follow_row
          where follow_row.id =
                v_follow.id;

          v_deduplicated_follow_count :=
            v_deduplicated_follow_count + 1;

        else
          begin
            update public.community_follows follow_row
            set
              target_id =
                p_target_person_resource_id::text,
              target_slug =
                v_target_slug
            where follow_row.id =
                  v_follow.id;

            insert into editorial.person_follow_merge_transfers (
              merge_event_id,
              user_id,
              source_person_resource_id,
              target_person_resource_id,
              source_follow_id,
              target_follow_id,
              transfer_mode,
              source_follow_created_at,
              target_follow_preexisted
            )
            values (
              v_source_merge_event_id,
              v_follow.user_id,
              p_source_person_resource_id,
              p_target_person_resource_id,
              v_follow.id,
              v_follow.id,
              'moved',
              v_follow.created_at,
              false
            );

            v_moved_follow_count :=
              v_moved_follow_count + 1;

          exception
            when unique_violation then
              select target_follow.id
              into v_existing_target_follow_id
              from public.community_follows target_follow
              where target_follow.user_id =
                    v_follow.user_id
                and target_follow.target_type =
                    'person'
                and target_follow.target_id =
                    p_target_person_resource_id::text
              for update;

              if v_existing_target_follow_id is null then
                raise;
              end if;

              insert into editorial.person_follow_merge_transfers (
                merge_event_id,
                user_id,
                source_person_resource_id,
                target_person_resource_id,
                source_follow_id,
                target_follow_id,
                transfer_mode,
                source_follow_created_at,
                target_follow_preexisted
              )
              values (
                v_source_merge_event_id,
                v_follow.user_id,
                p_source_person_resource_id,
                p_target_person_resource_id,
                v_follow.id,
                v_existing_target_follow_id,
                'deduplicated',
                v_follow.created_at,
                true
              );

              delete from public.community_follows follow_row
              where follow_row.id =
                    v_follow.id;

              v_deduplicated_follow_count :=
                v_deduplicated_follow_count + 1;
          end;
        end if;
      end loop;

      update editorial.people person
      set
        person_state =
          'merged',
        merged_into_person_resource_id =
          p_target_person_resource_id,
        updated_by =
          v_actor_id,
        updated_at =
          now()
      where person.resource_id =
            p_source_person_resource_id
      returning person.*
      into v_source;

      perform editorial.refresh_person_visibility(
        p_source_person_resource_id
      );

      perform editorial.refresh_person_visibility(
        p_target_person_resource_id
      );

      v_result :=
        jsonb_build_object(
          'source_person_resource_id',
            p_source_person_resource_id,
          'target_person_resource_id',
            p_target_person_resource_id,
          'source_identity_revision',
            v_source.identity_revision,
          'target_identity_revision',
            v_target.identity_revision,
          'merge_event_id',
            v_source_merge_event_id,
          'moved_follow_count',
            v_moved_follow_count,
          'deduplicated_follow_count',
            v_deduplicated_follow_count,
          'changed',
            true,
          'correlation_id',
            v_correlation_id
        );

      perform platform_private.complete_resource_command(
        v_begin.command_receipt_id,
        v_result
      );
    end if;
  end if;

  select *
  into v_read
  from platform_private.read_authenticated_resource_command_result(
    v_begin.command_receipt_id,
    false
  );

  command_receipt_id :=
    v_read.command_receipt_id;
  receipt_status :=
    v_read.receipt_status;
  source_person_resource_id :=
    p_source_person_resource_id;
  target_person_resource_id :=
    p_target_person_resource_id;
  source_identity_revision :=
    nullif(
      v_read.result_payload
        ->> 'source_identity_revision',
      ''
    )::bigint;
  target_identity_revision :=
    nullif(
      v_read.result_payload
        ->> 'target_identity_revision',
      ''
    )::bigint;
  merge_event_id :=
    nullif(
      v_read.result_payload
        ->> 'merge_event_id',
      ''
    )::uuid;
  result_payload :=
    v_read.result_payload;
  idempotent_replay :=
    false;
  return next;
end;
$function$;

revoke all
on function
  public.merge_people(
    uuid,
    uuid,
    bigint,
    bigint,
    text,
    text,
    uuid
  )
from public, anon, authenticated, service_role;

grant execute
on function
  public.merge_people(
    uuid,
    uuid,
    bigint,
    bigint,
    text,
    text,
    uuid
  )
to authenticated, service_role;

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
  v_public_roles jsonb;
  v_depth integer := 0;
begin
  v_input :=
    lower(
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
    v_path :=
      regexp_replace(
        v_input,
        '/+$',
        ''
      );
  else
    v_input :=
      trim(
        both '/'
        from v_input
      );

    if v_input = '' then
      return null;
    end if;

    v_path :=
      '/people/' ||
      v_input;
  end if;

  select alias.resource_id
  into v_requested_person_id
  from editorial.resource_aliases alias
  join editorial.resources resource
    on resource.id =
       alias.resource_id
   and resource.resource_kind =
       'person'
  where alias.path =
        v_path
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
    v_depth :=
      v_depth + 1;

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
      v_person.person_state <>
      'merged';

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
  where resource.id =
        v_person_id
    and resource.resource_kind =
        'person';

  if not found
     or v_resource.visibility <>
        'public'
     or v_resource.lifecycle_state <>
        'active'
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
  where alias.resource_id =
        v_person_id
    and alias.is_canonical
    and alias.retired_at is null;

  if v_canonical_path is null then
    return null;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'role',
          role_summary.role_key,
        'label',
          role_summary.role_label
      )
      order by
        role_summary.first_display_order,
        role_summary.role_key
    ),
    '[]'::jsonb
  )
  into v_public_roles
  from (
    select
      role_item ->> 'role'
        as role_key,
      (
        array_agg(
          coalesce(
            nullif(
              btrim(
                role_item
                  ->> 'role_label'
              ),
              ''
            ),
            role_item ->> 'role'
          )
          order by
            (
              role_item
                ->> 'display_order'
            )::integer,
            coalesce(
              nullif(
                btrim(
                  role_item
                    ->> 'role_label'
                ),
                ''
              ),
              role_item ->> 'role'
            )
        )
      )[1] as role_label,
      min(
        (
          role_item
            ->> 'display_order'
        )::integer
      ) as first_display_order
    from editorial.list_current_public_person_work(
      v_person_id
    ) work
    cross join lateral
      jsonb_array_elements(
        work.roles
      ) role_item
    group by
      role_item ->> 'role'
  ) role_summary;

  return jsonb_strip_nulls(
    jsonb_build_object(
      'person_id',
        v_person_id,
      'canonical_path',
        v_canonical_path,
      'display_name',
        v_presentation
          ->> 'display_name',
      'bio',
        v_presentation
          ->> 'bio',
      'avatar_url',
        v_presentation
          ->> 'avatar_url',
      'cover_url',
        v_presentation
          ->> 'cover_url',
      'location',
        v_presentation
          ->> 'location',
      'username',
        v_presentation
          ->> 'username',
      'registry_author_slug',
        v_presentation
          ->> 'registry_author_slug',
      'public_roles',
        v_public_roles,
      'redirect_to',
        case
          when v_requested_person_id
                 is distinct from
               v_person_id
            then v_canonical_path
          else null
        end
    )
  );
end;
$function$;

revoke all
on function
  public.get_public_person(text)
from public, anon, authenticated, service_role;

grant execute
on function
  public.get_public_person(text)
to anon, authenticated, service_role;

do $people_migration_b_postflight$
declare
  v_function text;
begin
  if (
    select count(*)
    from public.capability_definitions
    where capability_key in (
      'view_people_identity',
      'manage_people_identity',
      'merge_people_identity'
    )
  ) <> 3 then
    raise exception
      'STOP: Migration B People capability registration is incomplete';
  end if;

  if (
    select count(*)
    from platform_private.command_types
    where command_type in (
      'person.identity_link',
      'person.identity_unlink',
      'person.merge'
    )
      and enabled
  ) <> 3 then
    raise exception
      'STOP: Migration B Person command registration is incomplete';
  end if;

  if exists (
    select 1
    from platform_private.command_types
    where command_type =
          'person.split'
  ) then
    raise exception
      'STOP: person.split leaked into Migration B';
  end if;

  foreach v_function in array array[
    'editorial.resolve_credit_person(uuid)',
    'editorial.list_current_public_person_work(uuid)',
    'public.list_public_person_work(uuid,integer,timestamp with time zone,uuid)',
    'public.link_person_identity(uuid,bigint,uuid,uuid,uuid,text,text,text,uuid)',
    'public.unlink_person_identity(uuid,bigint,uuid,text,text,uuid)',
    'public.merge_people(uuid,uuid,bigint,bigint,text,text,uuid)',
    'public.get_public_person(text)'
  ]
  loop
    if to_regprocedure(v_function) is null then
      raise exception
        'STOP: Migration B function is missing after creation: %',
        v_function;
    end if;
  end loop;

  if to_regclass(
       'editorial.person_follow_merge_transfers'
     ) is null
  then
    raise exception
      'STOP: Migration B Follow-transfer history is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid =
          'editorial.people'::regclass
      and trigger_row.tgname =
          'people_merge_cycle_integrity'
      and trigger_row.tgconstraint <> 0
  ) then
    raise exception
      'STOP: Migration B merge-cycle constraint trigger is missing';
  end if;
end;
$people_migration_b_postflight$;

commit;
