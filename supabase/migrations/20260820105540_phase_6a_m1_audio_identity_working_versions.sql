-- Phase 6A M1: canonical Audio identity and immutable working versions.
--
-- This migration establishes the first Audio publication-domain authority.
--
-- It intentionally does not:
-- - publish Audio;
-- - add public Audio read routes;
-- - add a full-length Audio Media derivative;
-- - attach Media masters, transcripts, Chapters, Sources, Citations, or Credits;
-- - create Audio Review or publication commands;
-- - alter the global player.
--
-- Audio domain state lives in the non-exposed audio schema.
-- Browser writes enter only through governed public RPCs.
-- Shared Resource version pointers remain Article-only and MUST stay null for Audio.
--
-- M1 resource kinds:
--   audio_show
--   audio_season
--   audio_episode
--   standalone_audio

begin;

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'phase-6a-audio-authority',
    0
  )
);

do $phase_6a_m1_preflight$
declare
  v_binding_definition text;
begin
  if exists (
    select 1
    from pg_namespace
    where nspname = 'audio'
  ) then
    raise exception
      'STOP: audio schema already exists';
  end if;

  if to_regclass('editorial.resources') is null
     or to_regclass('editorial.resource_kinds') is null
     or to_regclass('public.capability_definitions') is null
     or to_regclass('public.role_capabilities') is null
     or to_regclass('platform_private.command_types') is null
     or to_regclass('platform_private.command_receipts') is null
     or to_regclass('platform_private.outbox_events') is null
  then
    raise exception
      'STOP: permanent platform kernel authority is incomplete';
  end if;

  if to_regprocedure(
       'platform_private.command_actor_context()'
     ) is null
     or to_regprocedure(
       'platform_private.command_request_fingerprint(text,uuid,jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.begin_authenticated_resource_command(text,uuid,text,jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.read_authenticated_resource_command_result(uuid,boolean)'
     ) is null
     or to_regprocedure(
       'platform_private.complete_resource_command(uuid,jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.reject_resource_command(uuid,text,text,jsonb)'
     ) is null
     or to_regprocedure(
       'public.current_user_has_capability(text)'
     ) is null
     or to_regprocedure(
       'public.current_user_is_administrator()'
     ) is null
     or to_regprocedure(
       'editorial.assert_resource_binding_integrity()'
     ) is null
  then
    raise exception
      'STOP: required command, capability, or Resource helper is missing';
  end if;

  if exists (
    select 1
    from editorial.resource_kinds
    where kind in (
      'audio_show',
      'audio_season',
      'audio_episode',
      'standalone_audio'
    )
  ) then
    raise exception
      'STOP: one or more Audio Resource kinds already exist';
  end if;

  if exists (
    select 1
    from public.capability_definitions
    where capability_key in (
      'view_audio',
      'edit_own_audio',
      'edit_others_audio',
      'publish_audio',
      'delete_audio'
    )
  ) then
    raise exception
      'STOP: one or more Audio capabilities already exist';
  end if;

  if exists (
    select 1
    from platform_private.command_types
    where command_type in (
      'audio.show.create',
      'audio.show.metadata.update',
      'audio.season.create',
      'audio.season.metadata.update',
      'audio.publication.create',
      'audio.publication.metadata.update',
      'audio.publication.version.snapshot_working'
    )
  ) then
    raise exception
      'STOP: one or more Audio M1 command types already exist';
  end if;

  if exists (
    select 1
    from (
      values
        ('administrator'),
        ('editor'),
        ('reviewer'),
        ('author'),
        ('writer')
    ) required(role_key)
    where not exists (
      select 1
      from public.role_definitions role_row
      where role_row.role_key = required.role_key
    )
  ) then
    raise exception
      'STOP: expected editorial role vocabulary is incomplete';
  end if;

  v_binding_definition :=
    pg_get_functiondef(
      'editorial.assert_resource_binding_integrity()'::regprocedure
    );

  if position(
       'when ''playlist'''
       in v_binding_definition
     ) = 0
     or position(
       'when ''media_asset'''
       in v_binding_definition
     ) = 0
     or position(
       'when ''person'''
       in v_binding_definition
     ) = 0
     or position(
       'when ''organization'''
       in v_binding_definition
     ) = 0
     or position(
       'Unsupported resource kind'
       in v_binding_definition
     ) = 0
     or position(
       'when ''audio_show'''
       in v_binding_definition
     ) > 0
  then
    raise exception
      'STOP: Resource binding integrity authority drifted after the Phase 6A audit';
  end if;
end;
$phase_6a_m1_preflight$;

create schema audio;

revoke all
  on schema audio
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Canonical Audio domain.
-- ---------------------------------------------------------------------------

create table audio.shows (
  id uuid primary key,
  slug text not null unique
    check (
      length(slug) between 1 and 200
      and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    ),
  title text not null
    check (
      length(title) between 1 and 300
    ),
  description text
    check (
      length(coalesce(description, '')) <= 20000
    ),
  authority_revision bigint not null default 1
    check (authority_revision >= 1),
  metadata jsonb not null default '{}'::jsonb
    check (
      jsonb_typeof(metadata) = 'object'
      and octet_length(metadata::text) <= 32768
    ),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table audio.seasons (
  id uuid primary key,
  show_id uuid not null
    references audio.shows(id)
    on update cascade
    on delete restrict,
  season_number integer not null
    check (
      season_number >= 0
      and season_number <= 10000
    ),
  title text not null
    check (
      length(title) between 1 and 300
    ),
  description text
    check (
      length(coalesce(description, '')) <= 20000
    ),
  authority_revision bigint not null default 1
    check (authority_revision >= 1),
  metadata jsonb not null default '{}'::jsonb
    check (
      jsonb_typeof(metadata) = 'object'
      and octet_length(metadata::text) <= 32768
    ),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (show_id, season_number),
  unique (id, show_id)
);

create table audio.publications (
  id uuid primary key,
  publication_kind text not null
    check (
      publication_kind in (
        'episode',
        'standalone'
      )
    ),
  show_id uuid
    references audio.shows(id)
    on update cascade
    on delete restrict,
  season_id uuid,
  episode_number integer
    check (
      episode_number is null
      or (
        episode_number >= 0
        and episode_number <= 100000
      )
    ),
  slug text not null unique
    check (
      length(slug) between 1 and 200
      and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    ),
  title text not null
    check (
      length(title) between 1 and 300
    ),
  summary text
    check (
      length(coalesce(summary, '')) <= 30000
    ),
  status text not null default 'draft'
    check (
      status in (
        'draft',
        'ready_for_review',
        'in_review',
        'changes_requested',
        'approved',
        'scheduled',
        'published',
        'archived'
      )
    ),
  authority_revision bigint not null default 1
    check (authority_revision >= 1),
  metadata jsonb not null default '{}'::jsonb
    check (
      jsonb_typeof(metadata) = 'object'
      and octet_length(metadata::text) <= 32768
    ),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint audio_publications_identity_shape_check
    check (
      (
        publication_kind = 'episode'
        and show_id is not null
      )
      or (
        publication_kind = 'standalone'
        and show_id is null
        and season_id is null
        and episode_number is null
      )
    ),
  constraint audio_publications_season_show_fkey
    foreign key (season_id, show_id)
    references audio.seasons(id, show_id)
    on update cascade
    on delete restrict
);

create index audio_publications_show_id_idx
  on audio.publications(show_id)
  where show_id is not null;

create index audio_publications_season_id_idx
  on audio.publications(season_id)
  where season_id is not null;

create index audio_publications_status_created_idx
  on audio.publications(status, created_at desc, id);

-- Immutable snapshots for playable Audio publications.
create table audio.publication_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  resource_id uuid not null,
  publication_id uuid not null
    references audio.publications(id)
    on update cascade
    on delete restrict,
  version_number bigint not null
    check (version_number >= 1),
  version_kind text not null
    check (
      version_kind in (
        'working',
        'submitted',
        'approved',
        'published'
      )
    ),
  source_authority_revision bigint not null
    check (source_authority_revision >= 1),
  publication_kind text not null
    check (
      publication_kind in (
        'episode',
        'standalone'
      )
    ),
  show_id uuid,
  season_id uuid,
  episode_number integer,
  title text not null,
  slug text not null,
  summary text,
  status text not null,
  metadata jsonb not null default '{}'::jsonb,
  content_fingerprint text not null
    check (
      content_fingerprint ~ '^[0-9a-f]{64}$'
    ),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (publication_id, version_number),
  unique (id, resource_id, publication_id)
);

create index audio_publication_versions_publication_created_idx
  on audio.publication_versions(
    publication_id,
    created_at desc,
    id
  );

-- ---------------------------------------------------------------------------
-- Stable global Resource identity.
-- ---------------------------------------------------------------------------

insert into editorial.resource_kinds (
  kind,
  label,
  description,
  enabled
)
values
  (
    'audio_show',
    'Audio Show',
    'Canonical Audio show identity.',
    true
  ),
  (
    'audio_season',
    'Audio Season',
    'Canonical Audio season identity.',
    true
  ),
  (
    'audio_episode',
    'Audio Episode',
    'Canonical Audio episode publication identity.',
    true
  ),
  (
    'standalone_audio',
    'Standalone Audio',
    'Canonical standalone Audio publication identity.',
    true
  );

create table editorial.audio_show_resources (
  resource_id uuid primary key,
  resource_kind text not null
    default 'audio_show'
    check (
      resource_kind = 'audio_show'
    ),
  show_id uuid not null unique
    references audio.shows(id)
    on update cascade
    on delete restrict,
  unique (resource_id, show_id),
  constraint audio_show_resources_resource_fkey
    foreign key (resource_id, resource_kind)
    references editorial.resources(id, resource_kind)
    on update cascade
    on delete cascade
);

create table editorial.audio_season_resources (
  resource_id uuid primary key,
  resource_kind text not null
    default 'audio_season'
    check (
      resource_kind = 'audio_season'
    ),
  season_id uuid not null unique
    references audio.seasons(id)
    on update cascade
    on delete restrict,
  unique (resource_id, season_id),
  constraint audio_season_resources_resource_fkey
    foreign key (resource_id, resource_kind)
    references editorial.resources(id, resource_kind)
    on update cascade
    on delete cascade
);

create table editorial.audio_publication_resources (
  resource_id uuid primary key,
  resource_kind text not null
    check (
      resource_kind in (
        'audio_episode',
        'standalone_audio'
      )
    ),
  publication_id uuid not null unique
    references audio.publications(id)
    on update cascade
    on delete restrict,
  current_working_version_id uuid,
  current_submitted_version_id uuid,
  current_approved_version_id uuid,
  current_published_version_id uuid,
  unique (resource_id, publication_id),
  constraint audio_publication_resources_resource_fkey
    foreign key (resource_id, resource_kind)
    references editorial.resources(id, resource_kind)
    on update cascade
    on delete cascade,
  constraint audio_publication_resources_working_version_fkey
    foreign key (
      current_working_version_id,
      resource_id,
      publication_id
    )
    references audio.publication_versions(
      id,
      resource_id,
      publication_id
    )
    on delete restrict
    deferrable initially deferred,
  constraint audio_publication_resources_submitted_version_fkey
    foreign key (
      current_submitted_version_id,
      resource_id,
      publication_id
    )
    references audio.publication_versions(
      id,
      resource_id,
      publication_id
    )
    on delete restrict
    deferrable initially deferred,
  constraint audio_publication_resources_approved_version_fkey
    foreign key (
      current_approved_version_id,
      resource_id,
      publication_id
    )
    references audio.publication_versions(
      id,
      resource_id,
      publication_id
    )
    on delete restrict
    deferrable initially deferred,
  constraint audio_publication_resources_published_version_fkey
    foreign key (
      current_published_version_id,
      resource_id,
      publication_id
    )
    references audio.publication_versions(
      id,
      resource_id,
      publication_id
    )
    on delete restrict
    deferrable initially deferred
);

alter table audio.publication_versions
  add constraint audio_publication_versions_resource_fkey
  foreign key (resource_id)
  references editorial.resources(id)
  on update cascade
  on delete restrict;

-- Extend the established binding verifier. Audio version pointers remain in the
-- typed Audio binding and never enter editorial.resources Article-only pointers.
create or replace function editorial.assert_resource_binding_integrity()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'editorial', 'audio'
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
    when 'audio_show' then
      select count(*) into binding_count
      from editorial.audio_show_resources
      where resource_id = target_resource_id;
    when 'audio_season' then
      select count(*) into binding_count
      from editorial.audio_season_resources
      where resource_id = target_resource_id;
    when 'audio_episode' then
      select count(*) into binding_count
      from editorial.audio_publication_resources
      where resource_id = target_resource_id
        and resource_kind = 'audio_episode';
    when 'standalone_audio' then
      select count(*) into binding_count
      from editorial.audio_publication_resources
      where resource_id = target_resource_id
        and resource_kind = 'standalone_audio';
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

create constraint trigger audio_show_resources_binding_integrity
after insert or update or delete
on editorial.audio_show_resources
deferrable initially deferred
for each row
execute function editorial.assert_resource_binding_integrity();

create constraint trigger audio_season_resources_binding_integrity
after insert or update or delete
on editorial.audio_season_resources
deferrable initially deferred
for each row
execute function editorial.assert_resource_binding_integrity();

create constraint trigger audio_publication_resources_binding_integrity
after insert or update or delete
on editorial.audio_publication_resources
deferrable initially deferred
for each row
execute function editorial.assert_resource_binding_integrity();

-- Immutable means immutable.
create or replace function audio.reject_publication_version_mutation()
returns trigger
language plpgsql
set search_path to 'pg_catalog'
as $function$
begin
  raise exception
    'Audio publication versions are immutable.';
end;
$function$;

revoke execute
  on function audio.reject_publication_version_mutation()
  from public, anon, authenticated, service_role;

create trigger audio_publication_versions_immutable
before update or delete
on audio.publication_versions
for each row
execute function audio.reject_publication_version_mutation();

-- Defense in depth. The audio schema is not browser-exposed and direct domain
-- writes are not part of the authenticated client contract.
alter table audio.shows enable row level security;
alter table audio.seasons enable row level security;
alter table audio.publications enable row level security;
alter table audio.publication_versions enable row level security;

revoke all
  on all tables in schema audio
  from public, anon, authenticated;

revoke all
  on editorial.audio_show_resources,
     editorial.audio_season_resources,
     editorial.audio_publication_resources
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Audio capability vocabulary.
-- ---------------------------------------------------------------------------

insert into public.capability_definitions (
  capability_key,
  label,
  description,
  domain
)
values
  (
    'view_audio',
    'View Audio',
    'View internal Audio publication work where Audio authority allows it.',
    'content'
  ),
  (
    'edit_own_audio',
    'Edit own Audio',
    'Create and edit Audio work owned by the current worker.',
    'content'
  ),
  (
    'edit_others_audio',
    'Edit others Audio',
    'Edit Audio work owned by other workers.',
    'content'
  ),
  (
    'publish_audio',
    'Publish Audio',
    'Approve publication actions for reviewed Audio versions.',
    'content'
  ),
  (
    'delete_audio',
    'Delete Audio',
    'Perform authorized destructive Audio administration.',
    'content'
  );

insert into public.role_capabilities (
  role_key,
  capability_key
)
values
  ('administrator', 'view_audio'),
  ('editor', 'view_audio'),
  ('reviewer', 'view_audio'),
  ('administrator', 'edit_own_audio'),
  ('editor', 'edit_own_audio'),
  ('author', 'edit_own_audio'),
  ('writer', 'edit_own_audio'),
  ('administrator', 'edit_others_audio'),
  ('editor', 'edit_others_audio'),
  ('administrator', 'publish_audio'),
  ('editor', 'publish_audio'),
  ('administrator', 'delete_audio'),
  ('editor', 'delete_audio');

-- ---------------------------------------------------------------------------
-- Audio M1 command vocabulary.
-- ---------------------------------------------------------------------------

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
    'audio.show.create',
    'audio.show.create.sync',
    'audio.show.create.accepted',
    'audio.show.create.succeeded',
    'audio.show.create.failed',
    'audio.show.create.retry_scheduled',
    true
  ),
  (
    'audio.show.metadata.update',
    'audio.show.metadata.update.sync',
    'audio.show.metadata.update.accepted',
    'audio.show.metadata.update.succeeded',
    'audio.show.metadata.update.failed',
    'audio.show.metadata.update.retry_scheduled',
    true
  ),
  (
    'audio.season.create',
    'audio.season.create.sync',
    'audio.season.create.accepted',
    'audio.season.create.succeeded',
    'audio.season.create.failed',
    'audio.season.create.retry_scheduled',
    true
  ),
  (
    'audio.season.metadata.update',
    'audio.season.metadata.update.sync',
    'audio.season.metadata.update.accepted',
    'audio.season.metadata.update.succeeded',
    'audio.season.metadata.update.failed',
    'audio.season.metadata.update.retry_scheduled',
    true
  ),
  (
    'audio.publication.create',
    'audio.publication.create.sync',
    'audio.publication.create.accepted',
    'audio.publication.create.succeeded',
    'audio.publication.create.failed',
    'audio.publication.create.retry_scheduled',
    true
  ),
  (
    'audio.publication.metadata.update',
    'audio.publication.metadata.update.sync',
    'audio.publication.metadata.update.accepted',
    'audio.publication.metadata.update.succeeded',
    'audio.publication.metadata.update.failed',
    'audio.publication.metadata.update.retry_scheduled',
    true
  ),
  (
    'audio.publication.version.snapshot_working',
    'audio.publication.version.snapshot_working.sync',
    'audio.publication.version.snapshot_working.accepted',
    'audio.publication.version.snapshot_working.succeeded',
    'audio.publication.version.snapshot_working.failed',
    'audio.publication.version.snapshot_working.retry_scheduled',
    true
  );

-- ---------------------------------------------------------------------------
-- Internal Audio helpers.
-- ---------------------------------------------------------------------------

create or replace function audio.normalize_slug(
  p_value text
)
returns text
language sql
immutable
set search_path to 'pg_catalog'
as $function$
  select nullif(
    btrim(
      lower(
        coalesce(p_value, '')
      )
    ),
    ''
  );
$function$;

revoke execute
  on function audio.normalize_slug(text)
  from public, anon, authenticated, service_role;

create or replace function editorial.current_user_can_view_audio(
  p_resource_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'editorial'
as $function$
  select
    auth.uid() is not null
    and exists (
      select 1
      from editorial.resources resource_row
      where resource_row.id = p_resource_id
        and resource_row.resource_kind in (
          'audio_show',
          'audio_season',
          'audio_episode',
          'standalone_audio'
        )
        and (
          public.current_user_is_administrator()
          or public.current_user_has_capability('view_audio')
          or (
            public.current_user_has_capability('edit_own_audio')
            and resource_row.owner_id = auth.uid()
          )
          or public.current_user_has_capability('edit_others_audio')
        )
    );
$function$;

revoke execute
  on function editorial.current_user_can_view_audio(uuid)
  from public, anon, authenticated, service_role;

create or replace function editorial.current_user_can_edit_audio(
  p_resource_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'editorial'
as $function$
  select
    auth.uid() is not null
    and exists (
      select 1
      from editorial.resources resource_row
      where resource_row.id = p_resource_id
        and resource_row.resource_kind in (
          'audio_show',
          'audio_season',
          'audio_episode',
          'standalone_audio'
        )
        and (
          public.current_user_is_administrator()
          or public.current_user_has_capability('edit_others_audio')
          or (
            public.current_user_has_capability('edit_own_audio')
            and resource_row.owner_id = auth.uid()
          )
        )
    );
$function$;

revoke execute
  on function editorial.current_user_can_edit_audio(uuid)
  from public, anon, authenticated, service_role;

create or replace function audio.publication_content_fingerprint(
  p_publication_id uuid
)
returns text
language sql
stable
set search_path to 'pg_catalog', 'audio', 'extensions'
as $function$
  select encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'publication_kind',
            publication.publication_kind,
          'show_id',
            publication.show_id,
          'season_id',
            publication.season_id,
          'episode_number',
            publication.episode_number,
          'slug',
            publication.slug,
          'title',
            publication.title,
          'summary',
            publication.summary,
          'status',
            publication.status,
          'metadata',
            publication.metadata
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  )
  from audio.publications publication
  where publication.id = p_publication_id;
$function$;

revoke execute
  on function audio.publication_content_fingerprint(uuid)
  from public, anon, authenticated, service_role;

create or replace function audio.insert_current_publication_snapshot(
  p_publication_id uuid,
  p_expected_authority_revision bigint,
  p_version_kind text,
  p_actor_id uuid
)
returns table(
  version_id uuid,
  version_number bigint,
  content_fingerprint text
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'audio',
  'editorial',
  'extensions'
as $function$
declare
  v_publication audio.publications%rowtype;
  v_binding editorial.audio_publication_resources%rowtype;
  v_version_number bigint;
  v_fingerprint text;
  v_version_id uuid;
begin
  if p_version_kind not in (
    'working',
    'submitted',
    'approved',
    'published'
  ) then
    raise exception
      'Unsupported Audio version kind.';
  end if;

  select publication.*
  into v_publication
  from audio.publications publication
  where publication.id = p_publication_id;

  if not found then
    raise exception
      'Audio publication does not exist.';
  end if;

  if v_publication.authority_revision
       <> p_expected_authority_revision
  then
    raise exception
      'Audio publication revision changed.';
  end if;

  select binding.*
  into v_binding
  from editorial.audio_publication_resources binding
  where binding.publication_id = p_publication_id;

  if not found then
    raise exception
      'Audio publication Resource binding does not exist.';
  end if;

  v_fingerprint :=
    audio.publication_content_fingerprint(
      p_publication_id
    );

  if v_fingerprint is null then
    raise exception
      'Audio publication fingerprint could not be created.';
  end if;

  select coalesce(
    max(version.version_number),
    0
  ) + 1
  into v_version_number
  from audio.publication_versions version
  where version.publication_id = p_publication_id;

  v_version_id :=
    extensions.gen_random_uuid();

  insert into audio.publication_versions (
    id,
    resource_id,
    publication_id,
    version_number,
    version_kind,
    source_authority_revision,
    publication_kind,
    show_id,
    season_id,
    episode_number,
    title,
    slug,
    summary,
    status,
    metadata,
    content_fingerprint,
    created_by
  )
  values (
    v_version_id,
    v_binding.resource_id,
    v_publication.id,
    v_version_number,
    p_version_kind,
    v_publication.authority_revision,
    v_publication.publication_kind,
    v_publication.show_id,
    v_publication.season_id,
    v_publication.episode_number,
    v_publication.title,
    v_publication.slug,
    v_publication.summary,
    v_publication.status,
    v_publication.metadata,
    v_fingerprint,
    p_actor_id
  );

  version_id := v_version_id;
  version_number := v_version_number;
  content_fingerprint := v_fingerprint;
  return next;
end;
$function$;

revoke execute
  on function audio.insert_current_publication_snapshot(
    uuid,
    bigint,
    text,
    uuid
  )
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Governed create/update RPCs.
-- ---------------------------------------------------------------------------

create or replace function public.create_audio_show(
  p_title text,
  p_slug text,
  p_idempotency_key text,
  p_description text default null,
  p_visibility text default 'internal',
  p_metadata jsonb default '{}'::jsonb,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  show_id uuid,
  resource_id uuid,
  authority_revision bigint,
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
  'platform_private',
  'audio',
  'extensions'
as $function$
declare
  v_actor uuid;
  v_principal_key text;
  v_title text;
  v_slug text;
  v_description text;
  v_visibility text;
  v_metadata jsonb;
  v_correlation_id uuid;
  v_request jsonb;
  v_existing platform_private.command_receipts%rowtype;
  v_expected_fingerprint text;
  v_resource_id uuid;
  v_begin record;
  v_read record;
  v_result jsonb;
begin
  select
    context.actor_user_id,
    context.principal_key
  into
    v_actor,
    v_principal_key
  from platform_private.command_actor_context() context;

  if not (
    public.current_user_is_administrator()
    or public.current_user_has_capability('edit_own_audio')
    or public.current_user_has_capability('edit_others_audio')
  ) then
    raise exception
      using
        errcode = '42501',
        message = 'Audio creation permission is required.';
  end if;

  if p_idempotency_key is null
     or p_idempotency_key !~
       '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
  then
    raise exception
      using
        errcode = '22023',
        message = 'idempotency_key is invalid.';
  end if;

  v_title := nullif(btrim(p_title), '');
  v_slug := audio.normalize_slug(p_slug);
  v_description := nullif(btrim(p_description), '');
  v_visibility := lower(coalesce(p_visibility, 'internal'));
  v_metadata := coalesce(p_metadata, '{}'::jsonb);
  v_correlation_id :=
    coalesce(
      p_correlation_id,
      extensions.gen_random_uuid()
    );

  if v_title is null
     or length(v_title) > 300
     or v_slug is null
     or length(v_slug) > 200
     or v_slug !~
       '^[a-z0-9]+(?:-[a-z0-9]+)*$'
     or length(coalesce(v_description, '')) > 20000
     or v_visibility not in (
       'private',
       'internal',
       'public'
     )
     or jsonb_typeof(v_metadata) <> 'object'
     or octet_length(v_metadata::text) > 32768
  then
    raise exception
      using
        errcode = '22023',
        message = 'Audio Show input is invalid.';
  end if;

  v_request := jsonb_build_object(
    'title', v_title,
    'slug', v_slug,
    'description', v_description,
    'visibility', v_visibility,
    'metadata', v_metadata,
    'correlation_id', v_correlation_id
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_principal_key
        || ':audio.show.create:'
        || p_idempotency_key,
      0
    )
  );

  select receipt.*
  into v_existing
  from platform_private.command_receipts receipt
  where receipt.principal_key = v_principal_key
    and receipt.command_type = 'audio.show.create'
    and receipt.idempotency_key = p_idempotency_key
  for update;

  if found then
    v_expected_fingerprint :=
      platform_private.command_request_fingerprint(
        'audio.show.create',
        v_existing.resource_id,
        v_request
      );

    if v_existing.request_fingerprint
         <> v_expected_fingerprint
    then
      raise exception
        using
          errcode = '23505',
          message =
            'The idempotency key was already used for a different Audio Show create request.';
    end if;

    select *
    into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_existing.id,
      true
    );

    command_receipt_id :=
      v_read.command_receipt_id;
    receipt_status :=
      v_read.receipt_status;
    show_id :=
      nullif(
        v_read.result_payload ->> 'show_id',
        ''
      )::uuid;
    resource_id :=
      v_read.resource_id;
    authority_revision :=
      nullif(
        v_read.result_payload
          ->> 'authority_revision',
        ''
      )::bigint;
    result_payload :=
      v_read.result_payload;
    idempotent_replay := true;
    return next;
    return;
  end if;

  if exists (
    select 1
    from audio.shows show_row
    where show_row.slug = v_slug
  ) then
    raise exception
      using
        errcode = '23505',
        message = 'Audio Show slug already exists.';
  end if;

  v_resource_id :=
    extensions.gen_random_uuid();

  insert into editorial.resources (
    id,
    resource_kind,
    owner_id,
    visibility,
    lifecycle_state,
    created_by
  )
  values (
    v_resource_id,
    'audio_show',
    v_actor,
    v_visibility,
    'active',
    v_actor
  );

  insert into audio.shows (
    id,
    slug,
    title,
    description,
    authority_revision,
    metadata,
    created_by,
    updated_by
  )
  values (
    v_resource_id,
    v_slug,
    v_title,
    v_description,
    1,
    v_metadata,
    v_actor,
    v_actor
  );

  insert into editorial.audio_show_resources (
    resource_id,
    resource_kind,
    show_id
  )
  values (
    v_resource_id,
    'audio_show',
    v_resource_id
  );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'audio.show.create',
    v_resource_id,
    p_idempotency_key,
    v_request
  );

  if v_begin.idempotent_replay then
    raise exception
      'Unexpected Audio Show create replay after serialized preflight.';
  end if;

  v_result := jsonb_build_object(
    'show_id', v_resource_id,
    'resource_id', v_resource_id,
    'slug', v_slug,
    'authority_revision', 1,
    'correlation_id', v_correlation_id
  );

  perform platform_private.complete_resource_command(
    v_begin.command_receipt_id,
    v_result
  );

  command_receipt_id :=
    v_begin.command_receipt_id;
  receipt_status := 'succeeded';
  show_id := v_resource_id;
  resource_id := v_resource_id;
  authority_revision := 1;
  result_payload := v_result;
  idempotent_replay := false;
  return next;
end;
$function$;

revoke execute
  on function public.create_audio_show(
    text,
    text,
    text,
    text,
    text,
    jsonb,
    uuid
  )
  from public, anon;

grant execute
  on function public.create_audio_show(
    text,
    text,
    text,
    text,
    text,
    jsonb,
    uuid
  )
  to authenticated, service_role;

create or replace function public.update_audio_show_metadata(
  p_show_id uuid,
  p_expected_authority_revision bigint,
  p_payload jsonb,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  show_id uuid,
  resource_id uuid,
  authority_revision bigint,
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
  'platform_private',
  'audio',
  'extensions'
as $function$
declare
  v_show audio.shows%rowtype;
  v_resource editorial.resources%rowtype;
  v_begin record;
  v_read record;
  v_result jsonb;
  v_title text;
  v_slug text;
  v_description text;
  v_visibility text;
  v_metadata jsonb;
  v_correlation_id uuid :=
    coalesce(
      p_correlation_id,
      extensions.gen_random_uuid()
    );
begin
  if p_show_id is null
     or p_expected_authority_revision is null
     or p_expected_authority_revision < 1
     or p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or p_payload = '{}'::jsonb
     or p_payload - array[
       'title',
       'slug',
       'description',
       'visibility',
       'metadata'
     ] <> '{}'::jsonb
  then
    raise exception
      using
        errcode = '22023',
        message = 'Audio Show metadata request is invalid.';
  end if;

  select show_row.*
  into v_show
  from audio.shows show_row
  where show_row.id = p_show_id
  for update;

  if not found then
    raise exception
      using
        errcode = 'P0002',
        message = 'Audio Show does not exist.';
  end if;

  select resource_row.*
  into v_resource
  from editorial.resources resource_row
  where resource_row.id = p_show_id
    and resource_row.resource_kind = 'audio_show'
  for update;

  if not found then
    raise exception
      'Audio Show Resource identity is missing.';
  end if;

  if not editorial.current_user_can_edit_audio(
    p_show_id
  ) then
    raise exception
      using
        errcode = '42501',
        message = 'Audio edit permission is required.';
  end if;

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'audio.show.metadata.update',
    p_show_id,
    p_idempotency_key,
    jsonb_build_object(
      'show_id', p_show_id,
      'expected_authority_revision',
        p_expected_authority_revision,
      'payload', p_payload,
      'correlation_id', v_correlation_id
    )
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
    show_id := p_show_id;
    resource_id :=
      v_read.resource_id;
    authority_revision :=
      nullif(
        v_read.result_payload
          ->> 'authority_revision',
        ''
      )::bigint;
    result_payload :=
      v_read.result_payload;
    idempotent_replay := true;
    return next;
    return;
  end if;

  if v_show.authority_revision
       <> p_expected_authority_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'audio_show_revision_changed',
      'The Audio Show changed before this update could be applied.',
      jsonb_build_object(
        'show_id', p_show_id,
        'authority_revision',
          v_show.authority_revision
      )
    );
  else
    v_title := case
      when p_payload ? 'title'
        then nullif(
          btrim(p_payload ->> 'title'),
          ''
        )
      else v_show.title
    end;

    v_slug := case
      when p_payload ? 'slug'
        then audio.normalize_slug(
          p_payload ->> 'slug'
        )
      else v_show.slug
    end;

    v_description := case
      when p_payload ? 'description'
        then nullif(
          btrim(
            p_payload ->> 'description'
          ),
          ''
        )
      else v_show.description
    end;

    v_visibility := case
      when p_payload ? 'visibility'
        then lower(
          coalesce(
            p_payload ->> 'visibility',
            ''
          )
        )
      else v_resource.visibility
    end;

    v_metadata := case
      when p_payload ? 'metadata'
        then coalesce(
          p_payload -> 'metadata',
          '{}'::jsonb
        )
      else v_show.metadata
    end;

    if v_title is null
       or length(v_title) > 300
       or v_slug is null
       or length(v_slug) > 200
       or v_slug !~
         '^[a-z0-9]+(?:-[a-z0-9]+)*$'
       or length(
         coalesce(v_description, '')
       ) > 20000
       or v_visibility not in (
         'private',
         'internal',
         'public'
       )
       or jsonb_typeof(v_metadata) <> 'object'
       or octet_length(v_metadata::text) > 32768
    then
      raise exception
        using
          errcode = '22023',
          message = 'Audio Show metadata values are invalid.';
    end if;

    if v_slug <> v_show.slug
       and exists (
         select 1
         from audio.shows other_show
         where other_show.slug = v_slug
           and other_show.id <> p_show_id
       )
    then
      raise exception
        using
          errcode = '23505',
          message = 'Audio Show slug already exists.';
    end if;

    update audio.shows show_row
    set
      title = v_title,
      slug = v_slug,
      description = v_description,
      metadata = v_metadata,
      authority_revision =
        show_row.authority_revision + 1,
      updated_by = auth.uid(),
      updated_at = now()
    where show_row.id = p_show_id
    returning show_row.*
    into v_show;

    update editorial.resources resource_row
    set
      visibility = v_visibility,
      updated_at = now()
    where resource_row.id = p_show_id;

    v_result := jsonb_build_object(
      'show_id', p_show_id,
      'resource_id', p_show_id,
      'slug', v_show.slug,
      'authority_revision',
        v_show.authority_revision,
      'correlation_id', v_correlation_id
    );

    perform platform_private.complete_resource_command(
      v_begin.command_receipt_id,
      v_result
    );
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
  show_id := p_show_id;
  resource_id :=
    v_read.resource_id;
  authority_revision :=
    nullif(
      v_read.result_payload
        ->> 'authority_revision',
      ''
    )::bigint;
  result_payload :=
    v_read.result_payload;
  idempotent_replay := false;
  return next;
end;
$function$;

revoke execute
  on function public.update_audio_show_metadata(
    uuid,
    bigint,
    jsonb,
    text,
    uuid
  )
  from public, anon;

grant execute
  on function public.update_audio_show_metadata(
    uuid,
    bigint,
    jsonb,
    text,
    uuid
  )
  to authenticated, service_role;

create or replace function public.create_audio_season(
  p_show_id uuid,
  p_season_number integer,
  p_title text,
  p_idempotency_key text,
  p_description text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  season_id uuid,
  resource_id uuid,
  authority_revision bigint,
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
  'platform_private',
  'audio',
  'extensions'
as $function$
declare
  v_context record;
  v_show audio.shows%rowtype;
  v_show_resource editorial.resources%rowtype;
  v_title text;
  v_description text;
  v_metadata jsonb;
  v_correlation_id uuid :=
    coalesce(
      p_correlation_id,
      extensions.gen_random_uuid()
    );
  v_request jsonb;
  v_existing platform_private.command_receipts%rowtype;
  v_expected_fingerprint text;
  v_resource_id uuid;
  v_begin record;
  v_read record;
  v_result jsonb;
begin
  select *
  into v_context
  from platform_private.command_actor_context();

  if p_idempotency_key is null
     or p_idempotency_key !~
       '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
  then
    raise exception
      using
        errcode = '22023',
        message = 'idempotency_key is invalid.';
  end if;

  if p_show_id is null
     or p_season_number is null
     or p_season_number < 0
     or p_season_number > 10000
  then
    raise exception
      using
        errcode = '22023',
        message = 'Audio Season identity is invalid.';
  end if;

  select show_row.*
  into v_show
  from audio.shows show_row
  where show_row.id = p_show_id;

  if not found then
    raise exception
      using
        errcode = 'P0002',
        message = 'Audio Show does not exist.';
  end if;

  select resource_row.*
  into v_show_resource
  from editorial.resources resource_row
  where resource_row.id = p_show_id
    and resource_row.resource_kind = 'audio_show';

  if not found
     or not editorial.current_user_can_edit_audio(
       p_show_id
     )
  then
    raise exception
      using
        errcode = '42501',
        message = 'Audio Show edit permission is required.';
  end if;

  v_title := nullif(btrim(p_title), '');
  v_description :=
    nullif(btrim(p_description), '');
  v_metadata :=
    coalesce(p_metadata, '{}'::jsonb);

  if v_title is null
     or length(v_title) > 300
     or length(
       coalesce(v_description, '')
     ) > 20000
     or jsonb_typeof(v_metadata) <> 'object'
     or octet_length(v_metadata::text) > 32768
  then
    raise exception
      using
        errcode = '22023',
        message = 'Audio Season input is invalid.';
  end if;

  v_request := jsonb_build_object(
    'show_id', p_show_id,
    'season_number', p_season_number,
    'title', v_title,
    'description', v_description,
    'metadata', v_metadata,
    'correlation_id', v_correlation_id
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_context.principal_key
        || ':audio.season.create:'
        || p_idempotency_key,
      0
    )
  );

  select receipt.*
  into v_existing
  from platform_private.command_receipts receipt
  where receipt.principal_key =
          v_context.principal_key
    and receipt.command_type =
          'audio.season.create'
    and receipt.idempotency_key =
          p_idempotency_key
  for update;

  if found then
    v_expected_fingerprint :=
      platform_private.command_request_fingerprint(
        'audio.season.create',
        v_existing.resource_id,
        v_request
      );

    if v_existing.request_fingerprint
         <> v_expected_fingerprint
    then
      raise exception
        using
          errcode = '23505',
          message =
            'The idempotency key was already used for a different Audio Season create request.';
    end if;

    select *
    into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_existing.id,
      true
    );

    command_receipt_id :=
      v_read.command_receipt_id;
    receipt_status :=
      v_read.receipt_status;
    season_id :=
      nullif(
        v_read.result_payload ->> 'season_id',
        ''
      )::uuid;
    resource_id :=
      v_read.resource_id;
    authority_revision :=
      nullif(
        v_read.result_payload
          ->> 'authority_revision',
        ''
      )::bigint;
    result_payload :=
      v_read.result_payload;
    idempotent_replay := true;
    return next;
    return;
  end if;

  if exists (
    select 1
    from audio.seasons season_row
    where season_row.show_id = p_show_id
      and season_row.season_number =
            p_season_number
  ) then
    raise exception
      using
        errcode = '23505',
        message = 'Audio Season number already exists for this Show.';
  end if;

  v_resource_id :=
    extensions.gen_random_uuid();

  insert into editorial.resources (
    id,
    resource_kind,
    owner_id,
    visibility,
    lifecycle_state,
    created_by
  )
  values (
    v_resource_id,
    'audio_season',
    coalesce(
      v_show_resource.owner_id,
      v_context.actor_user_id
    ),
    v_show_resource.visibility,
    'active',
    v_context.actor_user_id
  );

  insert into audio.seasons (
    id,
    show_id,
    season_number,
    title,
    description,
    authority_revision,
    metadata,
    created_by,
    updated_by
  )
  values (
    v_resource_id,
    p_show_id,
    p_season_number,
    v_title,
    v_description,
    1,
    v_metadata,
    v_context.actor_user_id,
    v_context.actor_user_id
  );

  insert into editorial.audio_season_resources (
    resource_id,
    resource_kind,
    season_id
  )
  values (
    v_resource_id,
    'audio_season',
    v_resource_id
  );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'audio.season.create',
    v_resource_id,
    p_idempotency_key,
    v_request
  );

  if v_begin.idempotent_replay then
    raise exception
      'Unexpected Audio Season create replay after serialized preflight.';
  end if;

  v_result := jsonb_build_object(
    'season_id', v_resource_id,
    'show_id', p_show_id,
    'resource_id', v_resource_id,
    'season_number', p_season_number,
    'authority_revision', 1,
    'correlation_id', v_correlation_id
  );

  perform platform_private.complete_resource_command(
    v_begin.command_receipt_id,
    v_result
  );

  command_receipt_id :=
    v_begin.command_receipt_id;
  receipt_status := 'succeeded';
  season_id := v_resource_id;
  resource_id := v_resource_id;
  authority_revision := 1;
  result_payload := v_result;
  idempotent_replay := false;
  return next;
end;
$function$;

revoke execute
  on function public.create_audio_season(
    uuid,
    integer,
    text,
    text,
    text,
    jsonb,
    uuid
  )
  from public, anon;

grant execute
  on function public.create_audio_season(
    uuid,
    integer,
    text,
    text,
    text,
    jsonb,
    uuid
  )
  to authenticated, service_role;

create or replace function public.update_audio_season_metadata(
  p_season_id uuid,
  p_expected_authority_revision bigint,
  p_payload jsonb,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  season_id uuid,
  resource_id uuid,
  authority_revision bigint,
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
  'platform_private',
  'audio',
  'extensions'
as $function$
declare
  v_season audio.seasons%rowtype;
  v_title text;
  v_description text;
  v_metadata jsonb;
  v_season_number integer;
  v_begin record;
  v_read record;
  v_result jsonb;
  v_correlation_id uuid :=
    coalesce(
      p_correlation_id,
      extensions.gen_random_uuid()
    );
begin
  if p_season_id is null
     or p_expected_authority_revision is null
     or p_expected_authority_revision < 1
     or p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or p_payload = '{}'::jsonb
     or p_payload - array[
       'season_number',
       'title',
       'description',
       'metadata'
     ] <> '{}'::jsonb
  then
    raise exception
      using
        errcode = '22023',
        message = 'Audio Season metadata request is invalid.';
  end if;

  select season_row.*
  into v_season
  from audio.seasons season_row
  where season_row.id = p_season_id
  for update;

  if not found then
    raise exception
      using
        errcode = 'P0002',
        message = 'Audio Season does not exist.';
  end if;

  if not editorial.current_user_can_edit_audio(
    p_season_id
  ) then
    raise exception
      using
        errcode = '42501',
        message = 'Audio edit permission is required.';
  end if;

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'audio.season.metadata.update',
    p_season_id,
    p_idempotency_key,
    jsonb_build_object(
      'season_id', p_season_id,
      'expected_authority_revision',
        p_expected_authority_revision,
      'payload', p_payload,
      'correlation_id', v_correlation_id
    )
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
    season_id := p_season_id;
    resource_id :=
      v_read.resource_id;
    authority_revision :=
      nullif(
        v_read.result_payload
          ->> 'authority_revision',
        ''
      )::bigint;
    result_payload :=
      v_read.result_payload;
    idempotent_replay := true;
    return next;
    return;
  end if;

  if v_season.authority_revision
       <> p_expected_authority_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'audio_season_revision_changed',
      'The Audio Season changed before this update could be applied.',
      jsonb_build_object(
        'season_id', p_season_id,
        'authority_revision',
          v_season.authority_revision
      )
    );
  else
    v_title := case
      when p_payload ? 'title'
        then nullif(
          btrim(p_payload ->> 'title'),
          ''
        )
      else v_season.title
    end;

    v_description := case
      when p_payload ? 'description'
        then nullif(
          btrim(
            p_payload ->> 'description'
          ),
          ''
        )
      else v_season.description
    end;

    v_season_number := case
      when p_payload ? 'season_number'
        then nullif(
          p_payload ->> 'season_number',
          ''
        )::integer
      else v_season.season_number
    end;

    v_metadata := case
      when p_payload ? 'metadata'
        then coalesce(
          p_payload -> 'metadata',
          '{}'::jsonb
        )
      else v_season.metadata
    end;

    if v_title is null
       or length(v_title) > 300
       or v_season_number is null
       or v_season_number < 0
       or v_season_number > 10000
       or length(
         coalesce(v_description, '')
       ) > 20000
       or jsonb_typeof(v_metadata) <> 'object'
       or octet_length(v_metadata::text) > 32768
    then
      raise exception
        using
          errcode = '22023',
          message = 'Audio Season metadata values are invalid.';
    end if;

    if v_season_number
         <> v_season.season_number
       and exists (
         select 1
         from audio.seasons other_season
         where other_season.show_id =
                 v_season.show_id
           and other_season.season_number =
                 v_season_number
           and other_season.id <> p_season_id
       )
    then
      raise exception
        using
          errcode = '23505',
          message = 'Audio Season number already exists for this Show.';
    end if;

    update audio.seasons season_row
    set
      season_number = v_season_number,
      title = v_title,
      description = v_description,
      metadata = v_metadata,
      authority_revision =
        season_row.authority_revision + 1,
      updated_by = auth.uid(),
      updated_at = now()
    where season_row.id = p_season_id
    returning season_row.*
    into v_season;

    v_result := jsonb_build_object(
      'season_id', p_season_id,
      'show_id', v_season.show_id,
      'resource_id', p_season_id,
      'season_number',
        v_season.season_number,
      'authority_revision',
        v_season.authority_revision,
      'correlation_id', v_correlation_id
    );

    perform platform_private.complete_resource_command(
      v_begin.command_receipt_id,
      v_result
    );
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
  season_id := p_season_id;
  resource_id :=
    v_read.resource_id;
  authority_revision :=
    nullif(
      v_read.result_payload
        ->> 'authority_revision',
      ''
    )::bigint;
  result_payload :=
    v_read.result_payload;
  idempotent_replay := false;
  return next;
end;
$function$;

revoke execute
  on function public.update_audio_season_metadata(
    uuid,
    bigint,
    jsonb,
    text,
    uuid
  )
  from public, anon;

grant execute
  on function public.update_audio_season_metadata(
    uuid,
    bigint,
    jsonb,
    text,
    uuid
  )
  to authenticated, service_role;

create or replace function public.create_audio_publication(
  p_publication_kind text,
  p_title text,
  p_slug text,
  p_idempotency_key text,
  p_show_id uuid default null,
  p_season_id uuid default null,
  p_episode_number integer default null,
  p_summary text default null,
  p_visibility text default 'internal',
  p_metadata jsonb default '{}'::jsonb,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  publication_id uuid,
  resource_id uuid,
  resource_kind text,
  authority_revision bigint,
  version_id uuid,
  version_number bigint,
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
  'platform_private',
  'audio',
  'extensions'
as $function$
declare
  v_context record;
  v_kind text;
  v_resource_kind text;
  v_title text;
  v_slug text;
  v_summary text;
  v_visibility text;
  v_metadata jsonb;
  v_show_resource editorial.resources%rowtype;
  v_owner_id uuid;
  v_correlation_id uuid :=
    coalesce(
      p_correlation_id,
      extensions.gen_random_uuid()
    );
  v_request jsonb;
  v_existing platform_private.command_receipts%rowtype;
  v_expected_fingerprint text;
  v_resource_id uuid;
  v_begin record;
  v_read record;
  v_result jsonb;
  v_snapshot record;
begin
  select *
  into v_context
  from platform_private.command_actor_context();

  if p_idempotency_key is null
     or p_idempotency_key !~
       '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
  then
    raise exception
      using
        errcode = '22023',
        message = 'idempotency_key is invalid.';
  end if;

  if not (
    public.current_user_is_administrator()
    or public.current_user_has_capability('edit_own_audio')
    or public.current_user_has_capability('edit_others_audio')
  ) then
    raise exception
      using
        errcode = '42501',
        message = 'Audio creation permission is required.';
  end if;

  v_kind :=
    lower(
      coalesce(p_publication_kind, '')
    );

  if v_kind not in (
    'episode',
    'standalone'
  ) then
    raise exception
      using
        errcode = '22023',
        message = 'Audio publication kind is invalid.';
  end if;

  if v_kind = 'episode' then
    if p_show_id is null then
      raise exception
        using
          errcode = '22023',
          message = 'An Audio Episode requires a Show.';
    end if;

    select resource_row.*
    into v_show_resource
    from editorial.resources resource_row
    where resource_row.id = p_show_id
      and resource_row.resource_kind =
            'audio_show';

    if not found then
      raise exception
        using
          errcode = 'P0002',
          message = 'Audio Show does not exist.';
    end if;

    if not editorial.current_user_can_edit_audio(
      p_show_id
    ) then
      raise exception
        using
          errcode = '42501',
          message = 'Audio Show edit permission is required.';
    end if;

    if p_season_id is not null
       and not exists (
         select 1
         from audio.seasons season_row
         where season_row.id = p_season_id
           and season_row.show_id = p_show_id
       )
    then
      raise exception
        using
          errcode = '22023',
          message = 'Audio Season does not belong to this Show.';
    end if;

    if p_episode_number is not null
       and (
         p_episode_number < 0
         or p_episode_number > 100000
       )
    then
      raise exception
        using
          errcode = '22023',
          message = 'Audio Episode number is invalid.';
    end if;

    v_resource_kind := 'audio_episode';
    v_owner_id :=
      coalesce(
        v_show_resource.owner_id,
        v_context.actor_user_id
      );
  else
    if p_show_id is not null
       or p_season_id is not null
       or p_episode_number is not null
    then
      raise exception
        using
          errcode = '22023',
          message =
            'Standalone Audio cannot carry Show, Season, or Episode numbering.';
    end if;

    v_resource_kind := 'standalone_audio';
    v_owner_id := v_context.actor_user_id;
  end if;

  v_title := nullif(btrim(p_title), '');
  v_slug := audio.normalize_slug(p_slug);
  v_summary := nullif(btrim(p_summary), '');
  v_visibility :=
    lower(
      coalesce(p_visibility, 'internal')
    );
  v_metadata :=
    coalesce(p_metadata, '{}'::jsonb);

  if v_title is null
     or length(v_title) > 300
     or v_slug is null
     or length(v_slug) > 200
     or v_slug !~
       '^[a-z0-9]+(?:-[a-z0-9]+)*$'
     or length(
       coalesce(v_summary, '')
     ) > 30000
     or v_visibility not in (
       'private',
       'internal',
       'public'
     )
     or jsonb_typeof(v_metadata) <> 'object'
     or octet_length(v_metadata::text) > 32768
  then
    raise exception
      using
        errcode = '22023',
        message = 'Audio publication input is invalid.';
  end if;

  v_request := jsonb_build_object(
    'publication_kind', v_kind,
    'show_id', p_show_id,
    'season_id', p_season_id,
    'episode_number', p_episode_number,
    'title', v_title,
    'slug', v_slug,
    'summary', v_summary,
    'visibility', v_visibility,
    'metadata', v_metadata,
    'correlation_id', v_correlation_id
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_context.principal_key
        || ':audio.publication.create:'
        || p_idempotency_key,
      0
    )
  );

  select receipt.*
  into v_existing
  from platform_private.command_receipts receipt
  where receipt.principal_key =
          v_context.principal_key
    and receipt.command_type =
          'audio.publication.create'
    and receipt.idempotency_key =
          p_idempotency_key
  for update;

  if found then
    v_expected_fingerprint :=
      platform_private.command_request_fingerprint(
        'audio.publication.create',
        v_existing.resource_id,
        v_request
      );

    if v_existing.request_fingerprint
         <> v_expected_fingerprint
    then
      raise exception
        using
          errcode = '23505',
          message =
            'The idempotency key was already used for a different Audio publication create request.';
    end if;

    select *
    into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_existing.id,
      true
    );

    command_receipt_id :=
      v_read.command_receipt_id;
    receipt_status :=
      v_read.receipt_status;
    publication_id :=
      nullif(
        v_read.result_payload
          ->> 'publication_id',
        ''
      )::uuid;
    resource_id :=
      v_read.resource_id;
    resource_kind :=
      v_read.result_payload
        ->> 'resource_kind';
    authority_revision :=
      nullif(
        v_read.result_payload
          ->> 'authority_revision',
        ''
      )::bigint;
    version_id :=
      nullif(
        v_read.result_payload
          ->> 'version_id',
        ''
      )::uuid;
    version_number :=
      nullif(
        v_read.result_payload
          ->> 'version_number',
        ''
      )::bigint;
    result_payload :=
      v_read.result_payload;
    idempotent_replay := true;
    return next;
    return;
  end if;

  if exists (
    select 1
    from audio.publications publication
    where publication.slug = v_slug
  ) then
    raise exception
      using
        errcode = '23505',
        message = 'Audio publication slug already exists.';
  end if;

  v_resource_id :=
    extensions.gen_random_uuid();

  insert into editorial.resources (
    id,
    resource_kind,
    owner_id,
    visibility,
    lifecycle_state,
    created_by
  )
  values (
    v_resource_id,
    v_resource_kind,
    v_owner_id,
    v_visibility,
    'active',
    v_context.actor_user_id
  );

  insert into audio.publications (
    id,
    publication_kind,
    show_id,
    season_id,
    episode_number,
    slug,
    title,
    summary,
    status,
    authority_revision,
    metadata,
    created_by,
    updated_by
  )
  values (
    v_resource_id,
    v_kind,
    p_show_id,
    p_season_id,
    p_episode_number,
    v_slug,
    v_title,
    v_summary,
    'draft',
    1,
    v_metadata,
    v_context.actor_user_id,
    v_context.actor_user_id
  );

  insert into editorial.audio_publication_resources (
    resource_id,
    resource_kind,
    publication_id
  )
  values (
    v_resource_id,
    v_resource_kind,
    v_resource_id
  );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'audio.publication.create',
    v_resource_id,
    p_idempotency_key,
    v_request
  );

  if v_begin.idempotent_replay then
    raise exception
      'Unexpected Audio publication create replay after serialized preflight.';
  end if;

  select *
  into v_snapshot
  from audio.insert_current_publication_snapshot(
    v_resource_id,
    1,
    'working',
    v_context.actor_user_id
  );

  update editorial.audio_publication_resources binding
  set current_working_version_id =
        v_snapshot.version_id
  where binding.publication_id =
        v_resource_id;

  v_result := jsonb_build_object(
    'publication_id', v_resource_id,
    'resource_id', v_resource_id,
    'resource_kind', v_resource_kind,
    'publication_kind', v_kind,
    'slug', v_slug,
    'authority_revision', 1,
    'status', 'draft',
    'version_id', v_snapshot.version_id,
    'version_number', v_snapshot.version_number,
    'content_fingerprint',
      v_snapshot.content_fingerprint,
    'correlation_id', v_correlation_id
  );

  perform platform_private.complete_resource_command(
    v_begin.command_receipt_id,
    v_result
  );

  command_receipt_id :=
    v_begin.command_receipt_id;
  receipt_status := 'succeeded';
  publication_id := v_resource_id;
  resource_id := v_resource_id;
  resource_kind := v_resource_kind;
  authority_revision := 1;
  version_id := v_snapshot.version_id;
  version_number := v_snapshot.version_number;
  result_payload := v_result;
  idempotent_replay := false;
  return next;
end;
$function$;

revoke execute
  on function public.create_audio_publication(
    text,
    text,
    text,
    text,
    uuid,
    uuid,
    integer,
    text,
    text,
    jsonb,
    uuid
  )
  from public, anon;

grant execute
  on function public.create_audio_publication(
    text,
    text,
    text,
    text,
    uuid,
    uuid,
    integer,
    text,
    text,
    jsonb,
    uuid
  )
  to authenticated, service_role;

create or replace function public.update_audio_publication_metadata(
  p_publication_id uuid,
  p_expected_authority_revision bigint,
  p_payload jsonb,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  publication_id uuid,
  resource_id uuid,
  resource_kind text,
  authority_revision bigint,
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
  'platform_private',
  'audio',
  'extensions'
as $function$
declare
  v_publication audio.publications%rowtype;
  v_resource editorial.resources%rowtype;
  v_title text;
  v_slug text;
  v_summary text;
  v_visibility text;
  v_metadata jsonb;
  v_season_id uuid;
  v_episode_number integer;
  v_begin record;
  v_read record;
  v_result jsonb;
  v_correlation_id uuid :=
    coalesce(
      p_correlation_id,
      extensions.gen_random_uuid()
    );
begin
  if p_publication_id is null
     or p_expected_authority_revision is null
     or p_expected_authority_revision < 1
     or p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or p_payload = '{}'::jsonb
     or p_payload - array[
       'season_id',
       'episode_number',
       'title',
       'slug',
       'summary',
       'visibility',
       'metadata'
     ] <> '{}'::jsonb
  then
    raise exception
      using
        errcode = '22023',
        message = 'Audio publication metadata request is invalid.';
  end if;

  select publication.*
  into v_publication
  from audio.publications publication
  where publication.id = p_publication_id
  for update;

  if not found then
    raise exception
      using
        errcode = 'P0002',
        message = 'Audio publication does not exist.';
  end if;

  select resource_row.*
  into v_resource
  from editorial.resources resource_row
  where resource_row.id = p_publication_id
    and resource_row.resource_kind in (
      'audio_episode',
      'standalone_audio'
    )
  for update;

  if not found then
    raise exception
      'Audio publication Resource identity is missing.';
  end if;

  if not editorial.current_user_can_edit_audio(
    p_publication_id
  ) then
    raise exception
      using
        errcode = '42501',
        message = 'Audio edit permission is required.';
  end if;

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'audio.publication.metadata.update',
    p_publication_id,
    p_idempotency_key,
    jsonb_build_object(
      'publication_id', p_publication_id,
      'expected_authority_revision',
        p_expected_authority_revision,
      'payload', p_payload,
      'correlation_id', v_correlation_id
    )
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
    publication_id := p_publication_id;
    resource_id :=
      v_read.resource_id;
    resource_kind :=
      v_resource.resource_kind;
    authority_revision :=
      nullif(
        v_read.result_payload
          ->> 'authority_revision',
        ''
      )::bigint;
    result_payload :=
      v_read.result_payload;
    idempotent_replay := true;
    return next;
    return;
  end if;

  if v_publication.authority_revision
       <> p_expected_authority_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'audio_publication_revision_changed',
      'The Audio publication changed before this update could be applied.',
      jsonb_build_object(
        'publication_id', p_publication_id,
        'authority_revision',
          v_publication.authority_revision
      )
    );
  else
    v_title := case
      when p_payload ? 'title'
        then nullif(
          btrim(p_payload ->> 'title'),
          ''
        )
      else v_publication.title
    end;

    v_slug := case
      when p_payload ? 'slug'
        then audio.normalize_slug(
          p_payload ->> 'slug'
        )
      else v_publication.slug
    end;

    v_summary := case
      when p_payload ? 'summary'
        then nullif(
          btrim(p_payload ->> 'summary'),
          ''
        )
      else v_publication.summary
    end;

    v_visibility := case
      when p_payload ? 'visibility'
        then lower(
          coalesce(
            p_payload ->> 'visibility',
            ''
          )
        )
      else v_resource.visibility
    end;

    v_metadata := case
      when p_payload ? 'metadata'
        then coalesce(
          p_payload -> 'metadata',
          '{}'::jsonb
        )
      else v_publication.metadata
    end;

    if v_publication.publication_kind =
         'episode'
    then
      v_season_id := case
        when p_payload ? 'season_id'
          then nullif(
            p_payload ->> 'season_id',
            ''
          )::uuid
        else v_publication.season_id
      end;

      v_episode_number := case
        when p_payload ? 'episode_number'
          then nullif(
            p_payload ->> 'episode_number',
            ''
          )::integer
        else v_publication.episode_number
      end;
    else
      if p_payload ? 'season_id'
         or p_payload ? 'episode_number'
      then
        raise exception
          using
            errcode = '22023',
            message =
              'Standalone Audio cannot carry Season or Episode numbering.';
      end if;

      v_season_id := null;
      v_episode_number := null;
    end if;

    if v_title is null
       or length(v_title) > 300
       or v_slug is null
       or length(v_slug) > 200
       or v_slug !~
         '^[a-z0-9]+(?:-[a-z0-9]+)*$'
       or length(
         coalesce(v_summary, '')
       ) > 30000
       or v_visibility not in (
         'private',
         'internal',
         'public'
       )
       or jsonb_typeof(v_metadata) <> 'object'
       or octet_length(v_metadata::text) > 32768
       or (
         v_episode_number is not null
         and (
           v_episode_number < 0
           or v_episode_number > 100000
         )
       )
    then
      raise exception
        using
          errcode = '22023',
          message = 'Audio publication metadata values are invalid.';
    end if;

    if v_season_id is not null
       and not exists (
         select 1
         from audio.seasons season_row
         where season_row.id = v_season_id
           and season_row.show_id =
                 v_publication.show_id
       )
    then
      raise exception
        using
          errcode = '22023',
          message = 'Audio Season does not belong to this Show.';
    end if;

    if v_slug <> v_publication.slug
       and exists (
         select 1
         from audio.publications other_publication
         where other_publication.slug = v_slug
           and other_publication.id
                 <> p_publication_id
       )
    then
      raise exception
        using
          errcode = '23505',
          message = 'Audio publication slug already exists.';
    end if;

    update audio.publications publication
    set
      season_id = v_season_id,
      episode_number = v_episode_number,
      title = v_title,
      slug = v_slug,
      summary = v_summary,
      metadata = v_metadata,
      authority_revision =
        publication.authority_revision + 1,
      updated_by = auth.uid(),
      updated_at = now()
    where publication.id = p_publication_id
    returning publication.*
    into v_publication;

    update editorial.resources resource_row
    set
      visibility = v_visibility,
      updated_at = now()
    where resource_row.id =
          p_publication_id;

    v_result := jsonb_build_object(
      'publication_id', p_publication_id,
      'resource_id', p_publication_id,
      'resource_kind',
        v_resource.resource_kind,
      'publication_kind',
        v_publication.publication_kind,
      'slug', v_publication.slug,
      'authority_revision',
        v_publication.authority_revision,
      'correlation_id', v_correlation_id
    );

    perform platform_private.complete_resource_command(
      v_begin.command_receipt_id,
      v_result
    );
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
  publication_id := p_publication_id;
  resource_id :=
    v_read.resource_id;
  resource_kind :=
    v_resource.resource_kind;
  authority_revision :=
    nullif(
      v_read.result_payload
        ->> 'authority_revision',
      ''
    )::bigint;
  result_payload :=
    v_read.result_payload;
  idempotent_replay := false;
  return next;
end;
$function$;

revoke execute
  on function public.update_audio_publication_metadata(
    uuid,
    bigint,
    jsonb,
    text,
    uuid
  )
  from public, anon;

grant execute
  on function public.update_audio_publication_metadata(
    uuid,
    bigint,
    jsonb,
    text,
    uuid
  )
  to authenticated, service_role;

create or replace function public.snapshot_audio_publication_working_version(
  p_publication_id uuid,
  p_expected_authority_revision bigint,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  publication_id uuid,
  resource_id uuid,
  resource_kind text,
  authority_revision bigint,
  version_id uuid,
  version_number bigint,
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
  'platform_private',
  'audio',
  'extensions'
as $function$
declare
  v_publication audio.publications%rowtype;
  v_binding editorial.audio_publication_resources%rowtype;
  v_current audio.publication_versions%rowtype;
  v_snapshot record;
  v_fingerprint text;
  v_begin record;
  v_read record;
  v_result jsonb;
  v_reused boolean := false;
  v_correlation_id uuid :=
    coalesce(
      p_correlation_id,
      extensions.gen_random_uuid()
    );
begin
  if auth.uid() is null then
    raise exception
      using
        errcode = '42501',
        message = 'Not authenticated.';
  end if;

  select publication.*
  into v_publication
  from audio.publications publication
  where publication.id = p_publication_id
  for update;

  if not found then
    raise exception
      using
        errcode = 'P0002',
        message = 'Audio publication does not exist.';
  end if;

  select binding.*
  into v_binding
  from editorial.audio_publication_resources binding
  where binding.publication_id =
        p_publication_id
  for update;

  if not found then
    raise exception
      'Audio publication Resource binding does not exist.';
  end if;

  if not editorial.current_user_can_edit_audio(
    v_binding.resource_id
  ) then
    raise exception
      using
        errcode = '42501',
        message = 'Audio edit permission is required.';
  end if;

  v_fingerprint :=
    audio.publication_content_fingerprint(
      p_publication_id
    );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'audio.publication.version.snapshot_working',
    v_binding.resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'publication_id', p_publication_id,
      'expected_authority_revision',
        p_expected_authority_revision,
      'content_fingerprint',
        v_fingerprint,
      'correlation_id',
        v_correlation_id
    )
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
    publication_id := p_publication_id;
    resource_id :=
      v_read.resource_id;
    resource_kind :=
      v_binding.resource_kind;
    authority_revision :=
      nullif(
        v_read.result_payload
          ->> 'authority_revision',
        ''
      )::bigint;
    version_id :=
      nullif(
        v_read.result_payload
          ->> 'version_id',
        ''
      )::uuid;
    version_number :=
      nullif(
        v_read.result_payload
          ->> 'version_number',
        ''
      )::bigint;
    result_payload :=
      v_read.result_payload;
    idempotent_replay := true;
    return next;
    return;
  end if;

  if p_expected_authority_revision is null
     or p_expected_authority_revision < 1
     or v_publication.authority_revision
          <> p_expected_authority_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'audio_publication_revision_changed',
      'The Audio publication changed before the working snapshot could be created.',
      jsonb_build_object(
        'publication_id',
          p_publication_id,
        'authority_revision',
          v_publication.authority_revision
      )
    );
  else
    if v_binding.current_working_version_id
         is not null
    then
      select version.*
      into v_current
      from audio.publication_versions version
      where version.id =
        v_binding.current_working_version_id;

      if found
         and v_current.version_kind =
               'working'
         and v_current.content_fingerprint =
               v_fingerprint
      then
        v_snapshot.version_id :=
          v_current.id;
        v_snapshot.version_number :=
          v_current.version_number;
        v_snapshot.content_fingerprint :=
          v_current.content_fingerprint;
        v_reused := true;
      end if;
    end if;

    if not v_reused then
      select *
      into v_snapshot
      from audio.insert_current_publication_snapshot(
        p_publication_id,
        v_publication.authority_revision,
        'working',
        auth.uid()
      );

      update editorial.audio_publication_resources binding
      set current_working_version_id =
            v_snapshot.version_id
      where binding.publication_id =
            p_publication_id;
    end if;

    v_result := jsonb_build_object(
      'publication_id',
        p_publication_id,
      'resource_id',
        v_binding.resource_id,
      'resource_kind',
        v_binding.resource_kind,
      'authority_revision',
        v_publication.authority_revision,
      'version_id',
        v_snapshot.version_id,
      'version_number',
        v_snapshot.version_number,
      'content_fingerprint',
        v_snapshot.content_fingerprint,
      'reused_existing_snapshot',
        v_reused,
      'correlation_id',
        v_correlation_id
    );

    perform platform_private.complete_resource_command(
      v_begin.command_receipt_id,
      v_result
    );
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
  publication_id := p_publication_id;
  resource_id :=
    v_read.resource_id;
  resource_kind :=
    v_binding.resource_kind;
  authority_revision :=
    nullif(
      v_read.result_payload
        ->> 'authority_revision',
      ''
    )::bigint;
  version_id :=
    nullif(
      v_read.result_payload
        ->> 'version_id',
      ''
    )::uuid;
  version_number :=
    nullif(
      v_read.result_payload
        ->> 'version_number',
      ''
    )::bigint;
  result_payload :=
    v_read.result_payload;
  idempotent_replay := false;
  return next;
end;
$function$;

revoke execute
  on function public.snapshot_audio_publication_working_version(
    uuid,
    bigint,
    text,
    uuid
  )
  from public, anon;

grant execute
  on function public.snapshot_audio_publication_working_version(
    uuid,
    bigint,
    text,
    uuid
  )
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Permanent invariants.
-- ---------------------------------------------------------------------------

do $phase_6a_m1_postcheck$
declare
  v_audio_kind_count integer;
  v_audio_capability_count integer;
  v_audio_command_count integer;
  v_binding_definition text;
begin
  select count(*)
  into v_audio_kind_count
  from editorial.resource_kinds
  where kind in (
    'audio_show',
    'audio_season',
    'audio_episode',
    'standalone_audio'
  )
    and enabled;

  select count(*)
  into v_audio_capability_count
  from public.capability_definitions
  where capability_key in (
    'view_audio',
    'edit_own_audio',
    'edit_others_audio',
    'publish_audio',
    'delete_audio'
  );

  select count(*)
  into v_audio_command_count
  from platform_private.command_types
  where command_type in (
    'audio.show.create',
    'audio.show.metadata.update',
    'audio.season.create',
    'audio.season.metadata.update',
    'audio.publication.create',
    'audio.publication.metadata.update',
    'audio.publication.version.snapshot_working'
  )
    and enabled;

  v_binding_definition :=
    pg_get_functiondef(
      'editorial.assert_resource_binding_integrity()'::regprocedure
    );

  if v_audio_kind_count <> 4
     or v_audio_capability_count <> 5
     or v_audio_command_count <> 7
     or position(
       'when ''audio_show'''
       in v_binding_definition
     ) = 0
     or position(
       'when ''audio_season'''
       in v_binding_definition
     ) = 0
     or position(
       'when ''audio_episode'''
       in v_binding_definition
     ) = 0
     or position(
       'when ''standalone_audio'''
       in v_binding_definition
     ) = 0
  then
    raise exception
      'STOP: Phase 6A M1 postcheck failed';
  end if;
end;
$phase_6a_m1_postcheck$;

commit;

