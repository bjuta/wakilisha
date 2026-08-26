-- Phase 7A K1: Resource lifecycle convergence.
--
-- Resource lifecycle position becomes shared Resource authority backed by
-- global Resource Version identity. Playlist and Audio typed lifecycle columns
-- remain synchronized compatibility mirrors until their legacy writers retire.
--
-- K0 Resource Version foundation must already be present.

begin;

set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'phase-7a-k1-resource-lifecycle-convergence',
    0
  )
);

create temporary table phase_7a_k1_baseline
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
    where resource_row.resource_kind = 'article'
  ) as article_resource_pointer_fingerprint,
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
  ) as audio_pointer_fingerprint;

do $phase_7a_k1_preflight$
declare
  v_count bigint;
begin
  if to_regclass('editorial.resource_versions') is null
     or to_regclass('editorial.resource_version_types') is null
     or to_regclass('editorial.resource_version_type_kinds') is null
  then
    raise exception
      'STOP: Phase 7A K0 Resource Version foundation is missing';
  end if;

  if to_regprocedure(
       'editorial.register_resource_version(uuid,uuid,text,text,bigint,text,uuid,timestamp with time zone)'
     ) is null
  then
    raise exception
      'STOP: K0 Resource Version registration authority is missing';
  end if;

  if to_regprocedure(
       'editorial.assert_resource_version_pointer_integrity()'
     ) is not null
     or to_regprocedure(
       'editorial.sync_resource_lifecycle_from_typed_binding()'
     ) is not null
     or to_regprocedure(
       'editorial.sync_typed_lifecycle_from_resource()'
     ) is not null
  then
    raise exception
      'STOP: K1 Resource lifecycle convergence already exists';
  end if;

  select count(*)
  into v_count
  from editorial.article_versions typed
  left join editorial.resource_versions global_version
    on global_version.id = typed.id
   and global_version.resource_id = typed.resource_id
   and global_version.version_type = 'article_version'
  where global_version.id is null;

  if v_count <> 0 then
    raise exception
      'STOP: K0 is incomplete for % Article version(s)',
      v_count;
  end if;

  select count(*)
  into v_count
  from editorial.playlist_versions typed
  left join editorial.resource_versions global_version
    on global_version.id = typed.id
   and global_version.resource_id = typed.resource_id
   and global_version.version_type = 'playlist_version'
  where global_version.id is null;

  if v_count <> 0 then
    raise exception
      'STOP: K0 is incomplete for % Playlist version(s)',
      v_count;
  end if;

  select count(*)
  into v_count
  from audio.publication_versions typed
  left join editorial.resource_versions global_version
    on global_version.id = typed.id
   and global_version.resource_id = typed.resource_id
   and global_version.version_type = 'audio_publication_version'
  where global_version.id is null;

  if v_count <> 0 then
    raise exception
      'STOP: K0 is incomplete for % Audio publication version(s)',
      v_count;
  end if;

  -- K1 owns the first non-Article population of shared Resource lifecycle
  -- pointers. Any pre-existing non-Article value requires separate diagnosis.
  if exists (
    select 1
    from editorial.resources resource_row
    where resource_row.resource_kind <> 'article'
      and (
        resource_row.current_working_version_id is not null
        or resource_row.current_submitted_version_id is not null
        or resource_row.current_approved_version_id is not null
        or resource_row.current_published_version_id is not null
      )
  ) then
    raise exception
      'STOP: a non-Article Resource already carries shared lifecycle pointers';
  end if;

  -- Every current Article pointer must already resolve through K0 before its
  -- Article-only FK is removed.
  if exists (
    select 1
    from editorial.resources resource_row
    cross join lateral (
      values
        (resource_row.current_working_version_id),
        (resource_row.current_submitted_version_id),
        (resource_row.current_approved_version_id),
        (resource_row.current_published_version_id)
    ) pointer(version_id)
    left join editorial.resource_versions global_version
      on global_version.id = pointer.version_id
     and global_version.resource_id = resource_row.id
    where resource_row.resource_kind = 'article'
      and pointer.version_id is not null
      and global_version.id is null
  ) then
    raise exception
      'STOP: an existing Article lifecycle pointer does not resolve through K0 Resource Version identity';
  end if;

  -- Existing typed pointers must resolve through K0 before they are copied.
  if exists (
    select 1
    from editorial.playlist_resources binding
    cross join lateral (
      values
        (binding.current_working_version_id),
        (binding.current_submitted_version_id),
        (binding.current_approved_version_id),
        (binding.current_published_version_id)
    ) pointer(version_id)
    left join editorial.resource_versions global_version
      on global_version.id = pointer.version_id
     and global_version.resource_id = binding.resource_id
    where pointer.version_id is not null
      and global_version.id is null
  ) then
    raise exception
      'STOP: a Playlist lifecycle pointer does not resolve through K0 Resource Version identity';
  end if;

  if exists (
    select 1
    from editorial.audio_publication_resources binding
    cross join lateral (
      values
        (binding.current_working_version_id),
        (binding.current_submitted_version_id),
        (binding.current_approved_version_id),
        (binding.current_published_version_id)
    ) pointer(version_id)
    left join editorial.resource_versions global_version
      on global_version.id = pointer.version_id
     and global_version.resource_id = binding.resource_id
    where pointer.version_id is not null
      and global_version.id is null
  ) then
    raise exception
      'STOP: an Audio lifecycle pointer does not resolve through K0 Resource Version identity';
  end if;
end;
$phase_7a_k1_preflight$;

-- ---------------------------------------------------------------------------
-- Replace Article-only pointer foreign keys with Resource Version identity.
-- ---------------------------------------------------------------------------

alter table editorial.resources
  drop constraint resources_current_working_version_fkey,
  drop constraint resources_current_submitted_version_fkey,
  drop constraint resources_current_approved_version_id_fkey,
  drop constraint resources_current_published_version_id_fkey;

alter table editorial.resources
  add constraint resources_current_working_resource_version_fkey
    foreign key (id, current_working_version_id)
    references editorial.resource_versions(resource_id, id)
    on delete restrict
    deferrable initially deferred,
  add constraint resources_current_submitted_resource_version_fkey
    foreign key (id, current_submitted_version_id)
    references editorial.resource_versions(resource_id, id)
    on delete restrict
    deferrable initially deferred,
  add constraint resources_current_approved_resource_version_fkey
    foreign key (id, current_approved_version_id)
    references editorial.resource_versions(resource_id, id)
    on delete restrict
    deferrable initially deferred,
  add constraint resources_current_published_resource_version_fkey
    foreign key (id, current_published_version_id)
    references editorial.resource_versions(resource_id, id)
    on delete restrict
    deferrable initially deferred;

-- Replace the Article-specific pointer trigger with the shared Resource Version
-- contract. Historical working/published version kinds are intentionally not
-- reinterpreted.
drop trigger if exists resources_article_version_pointer_integrity
  on editorial.resources;

drop function if exists editorial.assert_article_version_pointer_integrity();

create or replace function editorial.assert_resource_version_pointer_integrity()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'editorial'
as $function$
begin
  if new.current_working_version_id is not null
     and not exists (
       select 1
       from editorial.resource_versions version_row
       where version_row.id = new.current_working_version_id
         and version_row.resource_id = new.id
     )
  then
    raise exception
      'Current working Resource Version must belong to the same Resource';
  end if;

  if new.current_submitted_version_id is not null
     and not exists (
       select 1
       from editorial.resource_versions version_row
       where version_row.id = new.current_submitted_version_id
         and version_row.resource_id = new.id
         and version_row.version_kind = 'submitted'
     )
  then
    raise exception
      'Current submitted Resource Version must be a submitted version belonging to the same Resource';
  end if;

  if new.current_approved_version_id is not null
     and not exists (
       select 1
       from editorial.resource_versions version_row
       where version_row.id = new.current_approved_version_id
         and version_row.resource_id = new.id
     )
  then
    raise exception
      'Current approved Resource Version must belong to the same Resource';
  end if;

  if new.current_published_version_id is not null
     and not exists (
       select 1
       from editorial.resource_versions version_row
       where version_row.id = new.current_published_version_id
         and version_row.resource_id = new.id
     )
  then
    raise exception
      'Current published Resource Version must belong to the same Resource';
  end if;

  return new;
end;
$function$;

revoke execute
  on function editorial.assert_resource_version_pointer_integrity()
  from public, anon, authenticated, service_role;

create constraint trigger resources_resource_version_pointer_integrity
after insert or update of
  current_working_version_id,
  current_submitted_version_id,
  current_approved_version_id,
  current_published_version_id
on editorial.resources
deferrable initially deferred
for each row
execute function editorial.assert_resource_version_pointer_integrity();

-- ---------------------------------------------------------------------------
-- Populate shared Resource lifecycle position from the two typed domains that
-- had to carry compatibility pointers before K0/K1 existed.
-- ---------------------------------------------------------------------------

update editorial.resources resource_row
set
  current_working_version_id = binding.current_working_version_id,
  current_submitted_version_id = binding.current_submitted_version_id,
  current_approved_version_id = binding.current_approved_version_id,
  current_published_version_id = binding.current_published_version_id
from editorial.playlist_resources binding
where resource_row.id = binding.resource_id
  and resource_row.resource_kind = 'playlist';

update editorial.resources resource_row
set
  current_working_version_id = binding.current_working_version_id,
  current_submitted_version_id = binding.current_submitted_version_id,
  current_approved_version_id = binding.current_approved_version_id,
  current_published_version_id = binding.current_published_version_id
from editorial.audio_publication_resources binding
where resource_row.id = binding.resource_id
  and resource_row.resource_kind in (
    'audio_episode',
    'standalone_audio'
  );

-- ---------------------------------------------------------------------------
-- Compatibility synchronization.
--
-- `editorial.resources` is canonical after K1. Existing Playlist and Audio
-- command functions still write typed binding pointers, so those columns remain
-- synchronized mirrors until their writer dependency is retired deliberately.
-- ---------------------------------------------------------------------------

create or replace function editorial.sync_resource_lifecycle_from_typed_binding()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'editorial'
as $function$
begin
  update editorial.resources resource_row
  set
    current_working_version_id = new.current_working_version_id,
    current_submitted_version_id = new.current_submitted_version_id,
    current_approved_version_id = new.current_approved_version_id,
    current_published_version_id = new.current_published_version_id
  where resource_row.id = new.resource_id
    and (
      resource_row.current_working_version_id,
      resource_row.current_submitted_version_id,
      resource_row.current_approved_version_id,
      resource_row.current_published_version_id
    ) is distinct from (
      new.current_working_version_id,
      new.current_submitted_version_id,
      new.current_approved_version_id,
      new.current_published_version_id
    );

  if not found then
    if not exists (
      select 1
      from editorial.resources resource_row
      where resource_row.id = new.resource_id
    ) then
      raise exception
        'Typed lifecycle binding targets a missing Resource';
    end if;
  end if;

  return new;
end;
$function$;

revoke execute
  on function editorial.sync_resource_lifecycle_from_typed_binding()
  from public, anon, authenticated, service_role;

create or replace function editorial.sync_typed_lifecycle_from_resource()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'editorial'
as $function$
begin
  if new.resource_kind = 'playlist' then
    update editorial.playlist_resources binding
    set
      current_working_version_id = new.current_working_version_id,
      current_submitted_version_id = new.current_submitted_version_id,
      current_approved_version_id = new.current_approved_version_id,
      current_published_version_id = new.current_published_version_id
    where binding.resource_id = new.id
      and (
        binding.current_working_version_id,
        binding.current_submitted_version_id,
        binding.current_approved_version_id,
        binding.current_published_version_id
      ) is distinct from (
        new.current_working_version_id,
        new.current_submitted_version_id,
        new.current_approved_version_id,
        new.current_published_version_id
      );

  elsif new.resource_kind in (
    'audio_episode',
    'standalone_audio'
  ) then
    update editorial.audio_publication_resources binding
    set
      current_working_version_id = new.current_working_version_id,
      current_submitted_version_id = new.current_submitted_version_id,
      current_approved_version_id = new.current_approved_version_id,
      current_published_version_id = new.current_published_version_id
    where binding.resource_id = new.id
      and (
        binding.current_working_version_id,
        binding.current_submitted_version_id,
        binding.current_approved_version_id,
        binding.current_published_version_id
      ) is distinct from (
        new.current_working_version_id,
        new.current_submitted_version_id,
        new.current_approved_version_id,
        new.current_published_version_id
      );
  end if;

  return new;
end;
$function$;

revoke execute
  on function editorial.sync_typed_lifecycle_from_resource()
  from public, anon, authenticated, service_role;

create trigger playlist_resources_sync_shared_lifecycle
after insert or update of
  current_working_version_id,
  current_submitted_version_id,
  current_approved_version_id,
  current_published_version_id
on editorial.playlist_resources
for each row
execute function editorial.sync_resource_lifecycle_from_typed_binding();

create trigger audio_publication_resources_sync_shared_lifecycle
after insert or update of
  current_working_version_id,
  current_submitted_version_id,
  current_approved_version_id,
  current_published_version_id
on editorial.audio_publication_resources
for each row
execute function editorial.sync_resource_lifecycle_from_typed_binding();

create trigger resources_sync_typed_lifecycle_compatibility
after insert or update of
  current_working_version_id,
  current_submitted_version_id,
  current_approved_version_id,
  current_published_version_id
on editorial.resources
for each row
execute function editorial.sync_typed_lifecycle_from_resource();

-- ---------------------------------------------------------------------------
-- Migration-local proof.
-- ---------------------------------------------------------------------------

do $phase_7a_k1_verify$
declare
  v_text text;
  v_count bigint;
begin
  -- Existing Article pointer identity must be byte-for-byte unchanged.
  select article_resource_pointer_fingerprint
  into v_text
  from phase_7a_k1_baseline;

  if v_text is distinct from (
    select md5(
      coalesce(
        string_agg(
          concat_ws(
            '|',
            resource_row.id::text,
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
    where resource_row.resource_kind = 'article'
  ) then
    raise exception
      'STOP: K1 changed existing Article lifecycle position';
  end if;

  -- Typed compatibility mirrors themselves must be unchanged by the initial
  -- convergence backfill.
  select playlist_pointer_fingerprint
  into v_text
  from phase_7a_k1_baseline;

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
      'STOP: K1 changed Playlist typed lifecycle position';
  end if;

  select audio_pointer_fingerprint
  into v_text
  from phase_7a_k1_baseline;

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
      'STOP: K1 changed Audio typed lifecycle position';
  end if;

  select count(*)
  into v_count
  from editorial.playlist_resources binding
  join editorial.resources resource_row
    on resource_row.id = binding.resource_id
  where (
    resource_row.current_working_version_id,
    resource_row.current_submitted_version_id,
    resource_row.current_approved_version_id,
    resource_row.current_published_version_id
  ) is distinct from (
    binding.current_working_version_id,
    binding.current_submitted_version_id,
    binding.current_approved_version_id,
    binding.current_published_version_id
  );

  if v_count <> 0 then
    raise exception
      'STOP: % Playlist Resource lifecycle mirror mismatch(es) remain',
      v_count;
  end if;

  select count(*)
  into v_count
  from editorial.audio_publication_resources binding
  join editorial.resources resource_row
    on resource_row.id = binding.resource_id
  where (
    resource_row.current_working_version_id,
    resource_row.current_submitted_version_id,
    resource_row.current_approved_version_id,
    resource_row.current_published_version_id
  ) is distinct from (
    binding.current_working_version_id,
    binding.current_submitted_version_id,
    binding.current_approved_version_id,
    binding.current_published_version_id
  );

  if v_count <> 0 then
    raise exception
      'STOP: % Audio Resource lifecycle mirror mismatch(es) remain',
      v_count;
  end if;

  if exists (
    select 1
    from editorial.resources resource_row
    cross join lateral (
      values
        (resource_row.current_working_version_id),
        (resource_row.current_submitted_version_id),
        (resource_row.current_approved_version_id),
        (resource_row.current_published_version_id)
    ) pointer(version_id)
    left join editorial.resource_versions global_version
      on global_version.id = pointer.version_id
     and global_version.resource_id = resource_row.id
    where pointer.version_id is not null
      and global_version.id is null
  ) then
    raise exception
      'STOP: a shared Resource lifecycle pointer does not belong to the same Resource';
  end if;

  if exists (
    select 1
    from editorial.resources resource_row
    join editorial.resource_versions global_version
      on global_version.id = resource_row.current_submitted_version_id
     and global_version.resource_id = resource_row.id
    where resource_row.current_submitted_version_id is not null
      and global_version.version_kind <> 'submitted'
  ) then
    raise exception
      'STOP: a submitted Resource pointer targets a non-submitted Resource Version';
  end if;
end;
$phase_7a_k1_verify$;

commit;
