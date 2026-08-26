-- Phase 7A K0: Resource Version foundation.
--
-- Resource identity is already shared platform authority, but immutable version
-- identity is split across Article, Playlist, and Audio. This migration adds a
-- global Resource Version envelope without moving typed content or changing any
-- current lifecycle pointer.
--
-- The invariant is deliberate:
--   editorial.resource_versions.id = the existing typed domain version UUID.
--
-- Typed domain version tables remain the payload and immutability authority.

begin;

set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'phase-7a-k0-resource-version-foundation',
    0
  )
);

create temporary table phase_7a_k0_baseline
on commit drop
as
select
  (
    select md5(
      coalesce(
        string_agg(
          concat_ws(
            '|',
            resource_row.id::text,
            resource_row.resource_kind,
            coalesce(resource_row.current_working_version_id::text, ''),
            coalesce(resource_row.current_submitted_version_id::text, ''),
            coalesce(resource_row.current_approved_version_id::text, ''),
            coalesce(resource_row.current_published_version_id::text, '')
          ),
          E'\n'
          order by resource_row.id::text
        ),
        ''
      )
    )
    from editorial.resources resource_row
  ) as resource_pointer_fingerprint,
  (
    select md5(
      coalesce(
        string_agg(
          concat_ws(
            '|',
            binding.resource_id::text,
            coalesce(binding.current_working_version_id::text, ''),
            coalesce(binding.current_submitted_version_id::text, ''),
            coalesce(binding.current_approved_version_id::text, ''),
            coalesce(binding.current_published_version_id::text, '')
          ),
          E'\n'
          order by binding.resource_id::text
        ),
        ''
      )
    )
    from editorial.playlist_resources binding
  ) as playlist_pointer_fingerprint,
  (
    select md5(
      coalesce(
        string_agg(
          concat_ws(
            '|',
            binding.resource_id::text,
            coalesce(binding.current_working_version_id::text, ''),
            coalesce(binding.current_submitted_version_id::text, ''),
            coalesce(binding.current_approved_version_id::text, ''),
            coalesce(binding.current_published_version_id::text, '')
          ),
          E'\n'
          order by binding.resource_id::text
        ),
        ''
      )
    )
    from editorial.audio_publication_resources binding
  ) as audio_pointer_fingerprint,
  (
    select md5(
      coalesce(
        string_agg(
          concat_ws(
            '|',
            version_row.id::text,
            version_row.resource_id::text,
            version_row.version_number::text,
            version_row.version_kind,
            version_row.content_fingerprint,
            coalesce(version_row.created_by::text, ''),
            version_row.created_at::text
          ),
          E'\n'
          order by version_row.id::text
        ),
        ''
      )
    )
    from editorial.article_versions version_row
  ) as article_version_fingerprint,
  (
    select md5(
      coalesce(
        string_agg(
          concat_ws(
            '|',
            version_row.id::text,
            version_row.resource_id::text,
            version_row.version_number::text,
            version_row.version_kind,
            version_row.content_fingerprint,
            coalesce(version_row.created_by::text, ''),
            version_row.created_at::text
          ),
          E'\n'
          order by version_row.id::text
        ),
        ''
      )
    )
    from editorial.playlist_versions version_row
  ) as playlist_version_fingerprint,
  (
    select md5(
      coalesce(
        string_agg(
          concat_ws(
            '|',
            version_row.id::text,
            version_row.resource_id::text,
            version_row.version_number::text,
            version_row.version_kind,
            version_row.content_fingerprint,
            coalesce(version_row.created_by::text, ''),
            version_row.created_at::text
          ),
          E'\n'
          order by version_row.id::text
        ),
        ''
      )
    )
    from audio.publication_versions version_row
  ) as audio_version_fingerprint;

do $phase_7a_k0_preflight$
declare
  v_collision_count bigint;
  v_mismatch_count bigint;
begin
  if to_regclass('editorial.resources') is null
     or to_regclass('editorial.resource_kinds') is null
     or to_regclass('editorial.article_versions') is null
     or to_regclass('editorial.playlist_versions') is null
     or to_regclass('editorial.playlist_resources') is null
     or to_regclass('audio.publication_versions') is null
     or to_regclass('editorial.audio_publication_resources') is null
  then
    raise exception
      'STOP: required Resource, Article, Playlist, or Audio version authority is incomplete';
  end if;

  if to_regclass('editorial.resource_version_types') is not null
     or to_regclass('editorial.resource_version_type_kinds') is not null
     or to_regclass('editorial.resource_versions') is not null
     or to_regprocedure(
       'editorial.register_resource_version(uuid,uuid,text,text,bigint,text,uuid,timestamp with time zone)'
     ) is not null
     or to_regprocedure(
       'editorial.register_typed_resource_version()'
     ) is not null
  then
    raise exception
      'STOP: Resource Version foundation already exists';
  end if;

  select count(*)
  into v_collision_count
  from (
    select version_id
    from (
      select version_row.id as version_id
      from editorial.article_versions version_row

      union all

      select version_row.id
      from editorial.playlist_versions version_row

      union all

      select version_row.id
      from audio.publication_versions version_row
    ) all_versions
    group by version_id
    having count(*) > 1
  ) collisions;

  if v_collision_count <> 0 then
    raise exception
      'STOP: % typed version UUID collision(s) exist across Article, Playlist, and Audio',
      v_collision_count;
  end if;

  select count(*)
  into v_mismatch_count
  from editorial.article_versions version_row
  left join editorial.resources resource_row
    on resource_row.id = version_row.resource_id
  where resource_row.id is null
     or resource_row.resource_kind <> 'article';

  if v_mismatch_count <> 0 then
    raise exception
      'STOP: % Article version(s) do not map to an Article Resource',
      v_mismatch_count;
  end if;

  select count(*)
  into v_mismatch_count
  from editorial.playlist_versions version_row
  left join editorial.resources resource_row
    on resource_row.id = version_row.resource_id
  where resource_row.id is null
     or resource_row.resource_kind <> 'playlist';

  if v_mismatch_count <> 0 then
    raise exception
      'STOP: % Playlist version(s) do not map to a Playlist Resource',
      v_mismatch_count;
  end if;

  select count(*)
  into v_mismatch_count
  from audio.publication_versions version_row
  left join editorial.resources resource_row
    on resource_row.id = version_row.resource_id
  where resource_row.id is null
     or resource_row.resource_kind not in (
       'audio_episode',
       'standalone_audio'
     );

  if v_mismatch_count <> 0 then
    raise exception
      'STOP: % Audio publication version(s) do not map to an Audio publication Resource',
      v_mismatch_count;
  end if;

  if exists (
    select 1
    from (
      select resource_id, version_number
      from editorial.article_versions

      union all

      select resource_id, version_number
      from editorial.playlist_versions

      union all

      select resource_id, version_number
      from audio.publication_versions
    ) all_versions
    group by resource_id, version_number
    having count(*) > 1
  ) then
    raise exception
      'STOP: duplicate typed version numbers exist for one Resource identity';
  end if;

  if exists (
    select 1
    from (
      select content_fingerprint
      from editorial.article_versions

      union all

      select content_fingerprint
      from editorial.playlist_versions

      union all

      select content_fingerprint
      from audio.publication_versions
    ) all_versions
    where content_fingerprint !~ '^[0-9a-f]{64}$'
  ) then
    raise exception
      'STOP: a typed Resource version has an invalid content fingerprint';
  end if;
end;
$phase_7a_k0_preflight$;

-- ---------------------------------------------------------------------------
-- Controlled global version-type vocabulary.
-- ---------------------------------------------------------------------------

create table editorial.resource_version_types (
  version_type text primary key
    check (
      length(version_type) between 3 and 100
      and version_type ~ '^[a-z][a-z0-9_]*$'
    ),
  label text not null
    check (length(label) between 1 and 200),
  description text not null
    check (length(description) between 1 and 2000),
  source_table_schema text not null
    check (
      length(source_table_schema) between 1 and 63
      and source_table_schema ~ '^[a-z_][a-z0-9_]*$'
    ),
  source_table_name text not null
    check (
      length(source_table_name) between 1 and 63
      and source_table_name ~ '^[a-z_][a-z0-9_]*$'
    ),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (source_table_schema, source_table_name)
);

create table editorial.resource_version_type_kinds (
  version_type text not null
    references editorial.resource_version_types(version_type)
    on update cascade
    on delete restrict,
  resource_kind text not null
    references editorial.resource_kinds(kind)
    on update cascade
    on delete restrict,
  created_at timestamptz not null default now(),
  primary key (version_type, resource_kind)
);

insert into editorial.resource_version_types (
  version_type,
  label,
  description,
  source_table_schema,
  source_table_name,
  enabled
)
values
  (
    'article_version',
    'Article Version',
    'Global Resource Version identity for an immutable Article version.',
    'editorial',
    'article_versions',
    true
  ),
  (
    'playlist_version',
    'Playlist Version',
    'Global Resource Version identity for an immutable Playlist version.',
    'editorial',
    'playlist_versions',
    true
  ),
  (
    'audio_publication_version',
    'Audio Publication Version',
    'Global Resource Version identity for an immutable Audio publication version.',
    'audio',
    'publication_versions',
    true
  );

insert into editorial.resource_version_type_kinds (
  version_type,
  resource_kind
)
values
  ('article_version', 'article'),
  ('playlist_version', 'playlist'),
  ('audio_publication_version', 'audio_episode'),
  ('audio_publication_version', 'standalone_audio');

-- ---------------------------------------------------------------------------
-- Global Resource Version identity envelope.
-- ---------------------------------------------------------------------------

create table editorial.resource_versions (
  id uuid primary key,
  resource_id uuid not null,
  resource_kind text not null,
  version_type text not null,
  version_kind text not null
    check (
      length(version_kind) between 1 and 100
      and version_kind ~ '^[a-z][a-z0-9_]*$'
    ),
  version_number bigint not null
    check (version_number >= 1),
  content_fingerprint text not null
    check (content_fingerprint ~ '^[0-9a-f]{64}$'),
  created_by uuid
    references auth.users(id)
    on delete set null,
  created_at timestamptz not null,
  registered_at timestamptz not null default now(),
  constraint resource_versions_resource_fkey
    foreign key (resource_id, resource_kind)
    references editorial.resources(id, resource_kind)
    on update cascade
    on delete restrict,
  constraint resource_versions_type_kind_fkey
    foreign key (version_type, resource_kind)
    references editorial.resource_version_type_kinds(
      version_type,
      resource_kind
    )
    on update cascade
    on delete restrict,
  constraint resource_versions_resource_id_id_key
    unique (resource_id, id),
  constraint resource_versions_resource_version_number_key
    unique (resource_id, version_number)
);

create index resource_versions_resource_created_idx
  on editorial.resource_versions(
    resource_id,
    created_at desc,
    id
  );

create index resource_versions_type_created_idx
  on editorial.resource_versions(
    version_type,
    created_at desc,
    id
  );

alter table editorial.resource_version_types enable row level security;
alter table editorial.resource_version_type_kinds enable row level security;
alter table editorial.resource_versions enable row level security;

revoke all
  on editorial.resource_version_types,
     editorial.resource_version_type_kinds,
     editorial.resource_versions
  from public, anon, authenticated, service_role;

create or replace function editorial.reject_resource_version_mutation()
returns trigger
language plpgsql
set search_path to 'pg_catalog'
as $function$
begin
  raise exception
    'Resource Versions are immutable.';
end;
$function$;

revoke execute
  on function editorial.reject_resource_version_mutation()
  from public, anon, authenticated, service_role;

create trigger resource_versions_immutable
before update or delete
on editorial.resource_versions
for each row
execute function editorial.reject_resource_version_mutation();

-- Register one already-created typed immutable version. The typed row must
-- exist and match the supplied common version envelope exactly.
create or replace function editorial.register_resource_version(
  p_version_id uuid,
  p_resource_id uuid,
  p_version_type text,
  p_version_kind text,
  p_version_number bigint,
  p_content_fingerprint text,
  p_created_by uuid,
  p_created_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog', 'editorial'
as $function$
declare
  v_resource_kind text;
  v_source_schema text;
  v_source_table text;
  v_source_matches boolean := false;
  v_existing editorial.resource_versions%rowtype;
  v_sql text;
begin
  if p_version_id is null
     or p_resource_id is null
     or nullif(btrim(coalesce(p_version_type, '')), '') is null
     or nullif(btrim(coalesce(p_version_kind, '')), '') is null
     or p_version_number is null
     or p_version_number < 1
     or p_content_fingerprint !~ '^[0-9a-f]{64}$'
     or p_created_at is null
  then
    raise exception
      'Resource Version registration requires a complete immutable version envelope';
  end if;

  select resource_row.resource_kind
  into v_resource_kind
  from editorial.resources resource_row
  where resource_row.id = p_resource_id;

  if not found then
    raise exception
      'Resource Version registration target Resource does not exist';
  end if;

  select
    type_row.source_table_schema,
    type_row.source_table_name
  into
    v_source_schema,
    v_source_table
  from editorial.resource_version_types type_row
  join editorial.resource_version_type_kinds kind_row
    on kind_row.version_type = type_row.version_type
  where type_row.version_type = p_version_type
    and kind_row.resource_kind = v_resource_kind
    and type_row.enabled;

  if not found then
    raise exception
      'Resource Version type % is not enabled for Resource kind %',
      p_version_type,
      v_resource_kind;
  end if;

  if to_regclass(
       pg_catalog.format(
         '%I.%I',
         v_source_schema,
         v_source_table
       )
     ) is null
  then
    raise exception
      'Resource Version source table %.% does not exist',
      v_source_schema,
      v_source_table;
  end if;

  v_sql := pg_catalog.format(
    'select exists (
       select 1
       from %I.%I version_row
       where version_row.id = $1
         and version_row.resource_id = $2
         and version_row.version_number = $3
         and version_row.version_kind = $4
         and version_row.content_fingerprint = $5
         and version_row.created_at = $6
         and version_row.created_by is not distinct from $7
     )',
    v_source_schema,
    v_source_table
  );

  execute v_sql
  into v_source_matches
  using
    p_version_id,
    p_resource_id,
    p_version_number,
    p_version_kind,
    p_content_fingerprint,
    p_created_at,
    p_created_by;

  if not v_source_matches then
    raise exception
      'Resource Version registration does not match typed %.% version %',
      v_source_schema,
      v_source_table,
      p_version_id;
  end if;

  insert into editorial.resource_versions (
    id,
    resource_id,
    resource_kind,
    version_type,
    version_kind,
    version_number,
    content_fingerprint,
    created_by,
    created_at
  )
  values (
    p_version_id,
    p_resource_id,
    v_resource_kind,
    p_version_type,
    p_version_kind,
    p_version_number,
    p_content_fingerprint,
    p_created_by,
    p_created_at
  )
  on conflict (id) do nothing;

  select version_row.*
  into v_existing
  from editorial.resource_versions version_row
  where version_row.id = p_version_id;

  if not found
     or v_existing.resource_id <> p_resource_id
     or v_existing.resource_kind <> v_resource_kind
     or v_existing.version_type <> p_version_type
     or v_existing.version_kind <> p_version_kind
     or v_existing.version_number <> p_version_number
     or v_existing.content_fingerprint <> p_content_fingerprint
     or v_existing.created_by is distinct from p_created_by
     or v_existing.created_at <> p_created_at
  then
    raise exception
      'Resource Version % already exists with a conflicting immutable envelope',
      p_version_id;
  end if;

  return p_version_id;
end;
$function$;

revoke execute
  on function editorial.register_resource_version(
    uuid,
    uuid,
    text,
    text,
    bigint,
    text,
    uuid,
    timestamptz
  )
  from public, anon, authenticated, service_role;

-- Generic adapter for typed immutable version tables that share the common
-- Resource Version envelope. Version-type registration supplies the table ->
-- version-type mapping, so future domains extend vocabulary instead of cloning
-- trigger logic.
create or replace function editorial.register_typed_resource_version()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'editorial'
as $function$
declare
  v_version_type text;
begin
  select type_row.version_type
  into strict v_version_type
  from editorial.resource_version_types type_row
  where type_row.source_table_schema = tg_table_schema
    and type_row.source_table_name = tg_table_name
    and type_row.enabled;

  perform editorial.register_resource_version(
    new.id,
    new.resource_id,
    v_version_type,
    new.version_kind,
    new.version_number,
    new.content_fingerprint,
    new.created_by,
    new.created_at
  );

  return new;
end;
$function$;

revoke execute
  on function editorial.register_typed_resource_version()
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Backfill existing immutable typed versions through the same registration
-- contract future inserts will use.
-- ---------------------------------------------------------------------------

select editorial.register_resource_version(
  version_row.id,
  version_row.resource_id,
  'article_version',
  version_row.version_kind,
  version_row.version_number,
  version_row.content_fingerprint,
  version_row.created_by,
  version_row.created_at
)
from editorial.article_versions version_row
order by version_row.resource_id, version_row.version_number;

select editorial.register_resource_version(
  version_row.id,
  version_row.resource_id,
  'playlist_version',
  version_row.version_kind,
  version_row.version_number,
  version_row.content_fingerprint,
  version_row.created_by,
  version_row.created_at
)
from editorial.playlist_versions version_row
order by version_row.resource_id, version_row.version_number;

select editorial.register_resource_version(
  version_row.id,
  version_row.resource_id,
  'audio_publication_version',
  version_row.version_kind,
  version_row.version_number,
  version_row.content_fingerprint,
  version_row.created_by,
  version_row.created_at
)
from audio.publication_versions version_row
order by version_row.resource_id, version_row.version_number;

-- Every future typed version insert must register its global Resource Version
-- identity in the same transaction.
create trigger article_versions_register_resource_version
after insert
on editorial.article_versions
for each row
execute function editorial.register_typed_resource_version();

create trigger playlist_versions_register_resource_version
after insert
on editorial.playlist_versions
for each row
execute function editorial.register_typed_resource_version();

create trigger audio_publication_versions_register_resource_version
after insert
on audio.publication_versions
for each row
execute function editorial.register_typed_resource_version();

-- ---------------------------------------------------------------------------
-- Migration-local proof: complete backfill, exact envelope parity, no lifecycle
-- pointer mutation, and no typed version mutation.
-- ---------------------------------------------------------------------------

do $phase_7a_k0_verify$
declare
  v_expected bigint;
  v_actual bigint;
  v_mismatch bigint;
  v_text text;
begin
  select
    (select count(*) from editorial.article_versions)
    + (select count(*) from editorial.playlist_versions)
    + (select count(*) from audio.publication_versions)
  into v_expected;

  select count(*)
  into v_actual
  from editorial.resource_versions;

  if v_actual <> v_expected then
    raise exception
      'STOP: Resource Version backfill expected % rows, found %',
      v_expected,
      v_actual;
  end if;

  select count(*)
  into v_mismatch
  from editorial.article_versions typed
  left join editorial.resource_versions global_version
    on global_version.id = typed.id
   and global_version.resource_id = typed.resource_id
   and global_version.version_type = 'article_version'
   and global_version.version_kind = typed.version_kind
   and global_version.version_number = typed.version_number
   and global_version.content_fingerprint = typed.content_fingerprint
   and global_version.created_by is not distinct from typed.created_by
   and global_version.created_at = typed.created_at
  where global_version.id is null;

  if v_mismatch <> 0 then
    raise exception
      'STOP: % Article Resource Version envelope mismatch(es)',
      v_mismatch;
  end if;

  select count(*)
  into v_mismatch
  from editorial.playlist_versions typed
  left join editorial.resource_versions global_version
    on global_version.id = typed.id
   and global_version.resource_id = typed.resource_id
   and global_version.version_type = 'playlist_version'
   and global_version.version_kind = typed.version_kind
   and global_version.version_number = typed.version_number
   and global_version.content_fingerprint = typed.content_fingerprint
   and global_version.created_by is not distinct from typed.created_by
   and global_version.created_at = typed.created_at
  where global_version.id is null;

  if v_mismatch <> 0 then
    raise exception
      'STOP: % Playlist Resource Version envelope mismatch(es)',
      v_mismatch;
  end if;

  select count(*)
  into v_mismatch
  from audio.publication_versions typed
  left join editorial.resource_versions global_version
    on global_version.id = typed.id
   and global_version.resource_id = typed.resource_id
   and global_version.version_type = 'audio_publication_version'
   and global_version.version_kind = typed.version_kind
   and global_version.version_number = typed.version_number
   and global_version.content_fingerprint = typed.content_fingerprint
   and global_version.created_by is not distinct from typed.created_by
   and global_version.created_at = typed.created_at
  where global_version.id is null;

  if v_mismatch <> 0 then
    raise exception
      'STOP: % Audio Resource Version envelope mismatch(es)',
      v_mismatch;
  end if;

  select resource_pointer_fingerprint
  into v_text
  from phase_7a_k0_baseline;

  if v_text is distinct from (
    select md5(
      coalesce(
        string_agg(
          concat_ws(
            '|',
            resource_row.id::text,
            resource_row.resource_kind,
            coalesce(resource_row.current_working_version_id::text, ''),
            coalesce(resource_row.current_submitted_version_id::text, ''),
            coalesce(resource_row.current_approved_version_id::text, ''),
            coalesce(resource_row.current_published_version_id::text, '')
          ),
          E'\n'
          order by resource_row.id::text
        ),
        ''
      )
    )
    from editorial.resources resource_row
  ) then
    raise exception
      'STOP: K0 changed editorial.resources lifecycle pointers';
  end if;

  select playlist_pointer_fingerprint
  into v_text
  from phase_7a_k0_baseline;

  if v_text is distinct from (
    select md5(
      coalesce(
        string_agg(
          concat_ws(
            '|',
            binding.resource_id::text,
            coalesce(binding.current_working_version_id::text, ''),
            coalesce(binding.current_submitted_version_id::text, ''),
            coalesce(binding.current_approved_version_id::text, ''),
            coalesce(binding.current_published_version_id::text, '')
          ),
          E'\n'
          order by binding.resource_id::text
        ),
        ''
      )
    )
    from editorial.playlist_resources binding
  ) then
    raise exception
      'STOP: K0 changed Playlist lifecycle pointers';
  end if;

  select audio_pointer_fingerprint
  into v_text
  from phase_7a_k0_baseline;

  if v_text is distinct from (
    select md5(
      coalesce(
        string_agg(
          concat_ws(
            '|',
            binding.resource_id::text,
            coalesce(binding.current_working_version_id::text, ''),
            coalesce(binding.current_submitted_version_id::text, ''),
            coalesce(binding.current_approved_version_id::text, ''),
            coalesce(binding.current_published_version_id::text, '')
          ),
          E'\n'
          order by binding.resource_id::text
        ),
        ''
      )
    )
    from editorial.audio_publication_resources binding
  ) then
    raise exception
      'STOP: K0 changed Audio lifecycle pointers';
  end if;

  select article_version_fingerprint
  into v_text
  from phase_7a_k0_baseline;

  if v_text is distinct from (
    select md5(
      coalesce(
        string_agg(
          concat_ws(
            '|',
            version_row.id::text,
            version_row.resource_id::text,
            version_row.version_number::text,
            version_row.version_kind,
            version_row.content_fingerprint,
            coalesce(version_row.created_by::text, ''),
            version_row.created_at::text
          ),
          E'\n'
          order by version_row.id::text
        ),
        ''
      )
    )
    from editorial.article_versions version_row
  ) then
    raise exception
      'STOP: K0 mutated Article versions';
  end if;

  select playlist_version_fingerprint
  into v_text
  from phase_7a_k0_baseline;

  if v_text is distinct from (
    select md5(
      coalesce(
        string_agg(
          concat_ws(
            '|',
            version_row.id::text,
            version_row.resource_id::text,
            version_row.version_number::text,
            version_row.version_kind,
            version_row.content_fingerprint,
            coalesce(version_row.created_by::text, ''),
            version_row.created_at::text
          ),
          E'\n'
          order by version_row.id::text
        ),
        ''
      )
    )
    from editorial.playlist_versions version_row
  ) then
    raise exception
      'STOP: K0 mutated Playlist versions';
  end if;

  select audio_version_fingerprint
  into v_text
  from phase_7a_k0_baseline;

  if v_text is distinct from (
    select md5(
      coalesce(
        string_agg(
          concat_ws(
            '|',
            version_row.id::text,
            version_row.resource_id::text,
            version_row.version_number::text,
            version_row.version_kind,
            version_row.content_fingerprint,
            coalesce(version_row.created_by::text, ''),
            version_row.created_at::text
          ),
          E'\n'
          order by version_row.id::text
        ),
        ''
      )
    )
    from audio.publication_versions version_row
  ) then
    raise exception
      'STOP: K0 mutated Audio publication versions';
  end if;
end;
$phase_7a_k0_verify$;

commit;
