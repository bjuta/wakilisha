-- Phase 7A K4C-A3: Audio pointer compatibility retirement.
--
-- Retire the remaining Audio half of K1 lifecycle-position duplication only
-- after K4C-A1/K4C-A2 moved Audio event and pointer authority to shared
-- Resource primitives.

begin;

create temporary table phase_7a_k4c_a3_data_baseline
on commit drop
as
select
  (
    select count(*)
    from editorial.audio_publication_resources
  ) as audio_binding_count,
  (
    select md5(
      coalesce(
        string_agg(
          (
            to_jsonb(binding)
            - 'current_working_version_id'
            - 'current_submitted_version_id'
            - 'current_approved_version_id'
            - 'current_published_version_id'
          )::text,
          E'\n'
          order by binding.resource_id::text
        ),
        ''
      )
    )
    from editorial.audio_publication_resources binding
  ) as audio_nonpointer_fingerprint,
  (
    select md5(
      coalesce(
        string_agg(
          to_jsonb(resource)::text,
          E'\n'
          order by resource.id::text
        ),
        ''
      )
    )
    from editorial.resources resource
    join editorial.audio_publication_resources binding
      on binding.resource_id = resource.id
  ) as audio_resource_fingerprint,
  (
    select md5(
      coalesce(
        string_agg(
          constraint_row.conname
          || '|'
          || pg_get_constraintdef(constraint_row.oid, true),
          E'\n'
          order by constraint_row.conname
        ),
        ''
      )
    )
    from pg_constraint constraint_row
    where constraint_row.conrelid =
            'editorial.audio_publication_resources'::regclass
      and constraint_row.conname not in (
        'audio_publication_resources_working_version_fkey',
        'audio_publication_resources_submitted_version_fkey',
        'audio_publication_resources_approved_version_fkey',
        'audio_publication_resources_published_version_fkey'
      )
  ) as audio_nonpointer_constraint_fingerprint;

create temporary table phase_7a_k4c_a3_function_baseline (
  procedure_oid oid primary key,
  signature text not null,
  definition_md5 text not null,
  owner_oid oid not null,
  security_definer boolean not null,
  volatility "char" not null,
  function_config text not null,
  function_acl text not null
)
on commit drop;

insert into phase_7a_k4c_a3_function_baseline (
  procedure_oid,
  signature,
  definition_md5,
  owner_oid,
  security_definer,
  volatility,
  function_config,
  function_acl
)
select
  procedure_row.oid,
  procedure_row.oid::regprocedure::text,
  md5(pg_get_functiondef(procedure_row.oid)),
  procedure_row.proowner,
  procedure_row.prosecdef,
  procedure_row.provolatile,
  coalesce(procedure_row.proconfig::text, ''),
  coalesce(procedure_row.proacl::text, '')
from pg_proc procedure_row
join pg_namespace namespace_row
  on namespace_row.oid = procedure_row.pronamespace
where procedure_row.prokind in ('f', 'p')
  and namespace_row.nspname not in (
    'pg_catalog',
    'information_schema'
  )
  and procedure_row.oid not in (
    'editorial.sync_resource_lifecycle_from_typed_binding()'::regprocedure,
    'editorial.sync_typed_lifecycle_from_resource()'::regprocedure
  )
  and pg_get_functiondef(procedure_row.oid)
    ~ 'editorial[.]audio_publication_resources';

do $phase_7a_k4c_a3_preflight$
declare
  v_count bigint;
  v_definition text;
begin
  -- A2 exact accepted business bodies must still be present.
  if exists (
    select 1
    from (
      values
        (
          'public.archive_audio_publication(uuid,bigint,text,text,uuid)',
          '54fd407decbc70816bb174589e7411fb'
        ),
        (
          'audio.insert_current_publication_snapshot(uuid,bigint,text,uuid)',
          'a0c3b0c9ef0f77b87389250bbf971a4b'
        ),
        (
          'audio.publication_content_fingerprint(uuid)',
          'ecb29761c632e3da1ba823e3f2cd516c'
        ),
        (
          'public.create_audio_publication(text,text,text,text,uuid,uuid,integer,text,text,jsonb,uuid)',
          '4c4afedcf8320a02337128c325e53c0d'
        ),
        (
          'public.get_public_audio_publication_m1(text)',
          '1688adaa942a4075cd37603c9d96fd2e'
        ),
        (
          'public.replace_audio_publication_version_citations(uuid,jsonb,bigint,text,uuid)',
          'c3777c4bffb0b4cb738ca9e2fcd333ef'
        ),
        (
          'public.replace_audio_publication_version_credits(uuid,jsonb,bigint,text,uuid)',
          'b17e6ea50a73dd4aa654c41f5d722e17'
        ),
        (
          'public.restore_audio_publication_from_archive(uuid,bigint,text,text,uuid)',
          '287d39ea790c900ce0637018804f2a52'
        ),
        (
          'public.save_resource_version_editorial_metadata(text,uuid,bigint,uuid[],uuid[],text,text,text[],text,text,uuid)',
          '29c6262375c537571611a01ae02ad03c'
        ),
        (
          'public.snapshot_audio_publication_working_version(uuid,bigint,text,uuid)',
          '5f84c8ace1bacd2ca3586adbbc7e4a1b'
        )
    ) accepted(signature, definition_md5)
    left join pg_proc procedure_row
      on procedure_row.oid = to_regprocedure(accepted.signature)
    where procedure_row.oid is null
       or md5(pg_get_functiondef(procedure_row.oid))
            <> accepted.definition_md5
  ) then
    raise exception
      'STOP: K4C-A3 accepted A2 Audio business definition drift exists';
  end if;

  select count(*)
  into v_count
  from information_schema.columns
  where table_schema = 'editorial'
    and table_name = 'audio_publication_resources'
    and column_name in (
      'current_working_version_id',
      'current_submitted_version_id',
      'current_approved_version_id',
      'current_published_version_id'
    );

  if v_count <> 4 then
    raise exception
      'STOP: K4C-A3 expected four Audio typed pointer columns, found %',
      v_count;
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid =
            'editorial.audio_publication_resources'::regclass
      and trigger_row.tgname =
            'audio_publication_resources_sync_shared_lifecycle'
      and trigger_row.tgfoid =
            'editorial.sync_resource_lifecycle_from_typed_binding()'::regprocedure
      and pg_get_triggerdef(trigger_row.oid, true) =
            'CREATE TRIGGER audio_publication_resources_sync_shared_lifecycle AFTER INSERT OR UPDATE OF current_working_version_id, current_submitted_version_id, current_approved_version_id, current_published_version_id ON editorial.audio_publication_resources FOR EACH ROW EXECUTE FUNCTION editorial.sync_resource_lifecycle_from_typed_binding()'
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'STOP: K4C-A3 Audio typed-to-Resource compatibility trigger drifted';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid =
            'editorial.resources'::regclass
      and trigger_row.tgname =
            'resources_sync_typed_lifecycle_compatibility'
      and trigger_row.tgfoid =
            'editorial.sync_typed_lifecycle_from_resource()'::regprocedure
      and pg_get_triggerdef(trigger_row.oid, true) =
            'CREATE TRIGGER resources_sync_typed_lifecycle_compatibility AFTER INSERT OR UPDATE OF current_working_version_id, current_submitted_version_id, current_approved_version_id, current_published_version_id ON editorial.resources FOR EACH ROW EXECUTE FUNCTION editorial.sync_typed_lifecycle_from_resource()'
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'STOP: K4C-A3 Resource-to-typed compatibility trigger drifted';
  end if;

  if md5(
    pg_get_functiondef(
      'editorial.sync_resource_lifecycle_from_typed_binding()'::regprocedure
    )
  ) <> '1a9a366b7a26d023aa589767a2024651' then
    raise exception
      'STOP: K4C-A3 typed-to-Resource compatibility helper drifted';
  end if;

  if md5(
    pg_get_functiondef(
      'editorial.sync_typed_lifecycle_from_resource()'::regprocedure
    )
  ) <> '619a2bd22f9066594f84dada7a119902' then
    raise exception
      'STOP: K4C-A3 Resource-to-typed compatibility helper drifted';
  end if;

  select count(*)
  into v_count
  from pg_depend dependency_row
  where dependency_row.refclassid = 'pg_proc'::regclass
    and dependency_row.refobjid =
          'editorial.sync_resource_lifecycle_from_typed_binding()'::regprocedure
    and dependency_row.classid = 'pg_trigger'::regclass
    and dependency_row.deptype = 'n';

  if v_count <> 1 then
    raise exception
      'STOP: K4C-A3 expected exactly one typed-to-Resource trigger dependency, found %',
      v_count;
  end if;

  if exists (
    select 1
    from pg_depend dependency_row
    where dependency_row.refclassid = 'pg_proc'::regclass
      and dependency_row.refobjid =
            'editorial.sync_resource_lifecycle_from_typed_binding()'::regprocedure
      and dependency_row.classid in (
        'pg_proc'::regclass,
        'pg_rewrite'::regclass
      )
      and dependency_row.deptype in ('n', 'a')
  ) then
    raise exception
      'STOP: K4C-A3 typed-to-Resource helper has a non-trigger consumer';
  end if;

  select count(*)
  into v_count
  from pg_depend dependency_row
  where dependency_row.refclassid = 'pg_proc'::regclass
    and dependency_row.refobjid =
          'editorial.sync_typed_lifecycle_from_resource()'::regprocedure
    and dependency_row.classid = 'pg_trigger'::regclass
    and dependency_row.deptype = 'n';

  if v_count <> 1 then
    raise exception
      'STOP: K4C-A3 expected exactly one Resource-to-typed trigger dependency, found %',
      v_count;
  end if;

  if exists (
    select 1
    from pg_depend dependency_row
    where dependency_row.refclassid = 'pg_proc'::regclass
      and dependency_row.refobjid =
            'editorial.sync_typed_lifecycle_from_resource()'::regprocedure
      and dependency_row.classid in (
        'pg_proc'::regclass,
        'pg_rewrite'::regclass
      )
      and dependency_row.deptype in ('n', 'a')
  ) then
    raise exception
      'STOP: K4C-A3 Resource-to-typed helper has a non-trigger consumer';
  end if;

  if exists (
    select 1
    from (
      values
        (
          'audio_publication_resources_working_version_fkey',
          'FOREIGN KEY (current_working_version_id, resource_id, publication_id) REFERENCES audio.publication_versions(id, resource_id, publication_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED'
        ),
        (
          'audio_publication_resources_submitted_version_fkey',
          'FOREIGN KEY (current_submitted_version_id, resource_id, publication_id) REFERENCES audio.publication_versions(id, resource_id, publication_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED'
        ),
        (
          'audio_publication_resources_approved_version_fkey',
          'FOREIGN KEY (current_approved_version_id, resource_id, publication_id) REFERENCES audio.publication_versions(id, resource_id, publication_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED'
        ),
        (
          'audio_publication_resources_published_version_fkey',
          'FOREIGN KEY (current_published_version_id, resource_id, publication_id) REFERENCES audio.publication_versions(id, resource_id, publication_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED'
        )
    ) expected(conname, definition)
    left join pg_constraint constraint_row
      on constraint_row.conrelid =
           'editorial.audio_publication_resources'::regclass
     and constraint_row.conname = expected.conname
    where constraint_row.oid is null
       or pg_get_constraintdef(constraint_row.oid, true)
            <> expected.definition
  ) then
    raise exception
      'STOP: K4C-A3 Audio typed pointer foreign key definition drift exists';
  end if;

  select count(*)
  into v_count
  from editorial.audio_publication_resources binding
  join editorial.resources resource
    on resource.id = binding.resource_id
  where (
    binding.current_working_version_id,
    binding.current_submitted_version_id,
    binding.current_approved_version_id,
    binding.current_published_version_id
  ) is distinct from (
    resource.current_working_version_id,
    resource.current_submitted_version_id,
    resource.current_approved_version_id,
    resource.current_published_version_id
  );

  if v_count <> 0 then
    raise exception
      'STOP: K4C-A3 Audio pointer parity drift is %',
      v_count;
  end if;

  select count(*)
  into v_count
  from pg_proc procedure_row
  where procedure_row.prokind in ('f', 'p')
    and (
      pg_get_functiondef(procedure_row.oid)
        ~* 'update[[:space:]]+editorial[.]audio_publication_resources[[:space:][:print:]]{0,200}set[[:space:][:print:]]{0,200}current_(working|submitted|approved|published)_version_id'
      or pg_get_functiondef(procedure_row.oid)
        ~* 'insert[[:space:]]+into[[:space:]]+editorial[.]audio_publication_resources[[:space:]]*[(][^)]*current_(working|submitted|approved|published)_version_id'
    );

  if v_count <> 1 then
    raise exception
      'STOP: K4C-A3 expected only the K1 Resource-to-typed compatibility writer, found %',
      v_count;
  end if;

  select count(*)
  into v_count
  from pg_proc procedure_row
  where procedure_row.prokind in ('f', 'p')
    and procedure_row.oid <>
      'editorial.sync_typed_lifecycle_from_resource()'::regprocedure
    and pg_get_functiondef(procedure_row.oid)
      ~ 'editorial[.]audio_publication_resources'
    and pg_get_functiondef(procedure_row.oid)
      ~ '(v_binding|binding|audio_binding)[.]current_(working|submitted|approved|published)_version_id';

  if v_count <> 0 then
    raise exception
      'STOP: K4C-A3 % live business function(s) still read typed Audio pointers',
      v_count;
  end if;

  if exists (
    select 1
    from pg_index index_row
    cross join lateral unnest(index_row.indkey) indexed_attribute(attnum)
    join pg_attribute attribute
      on attribute.attrelid = index_row.indrelid
     and attribute.attnum = indexed_attribute.attnum
    where index_row.indrelid =
            'editorial.audio_publication_resources'::regclass
      and attribute.attname in (
        'current_working_version_id',
        'current_submitted_version_id',
        'current_approved_version_id',
        'current_published_version_id'
      )
  ) then
    raise exception
      'STOP: K4C-A3 typed Audio pointer column participates in an index';
  end if;

  if exists (
    select 1
    from pg_proc procedure_row
    where procedure_row.prokind in ('f', 'p')
      and pg_get_functiondef(procedure_row.oid)
        ~* 'insert[[:space:]]+into[[:space:]]+audio[.]publication_(review|lifecycle)_events'
  ) then
    raise exception
      'STOP: K4C-A3 A1 typed Audio event-writer retirement regressed';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'editorial'
      and table_name = 'playlist_resources'
      and column_name in (
        'current_working_version_id',
        'current_submitted_version_id',
        'current_approved_version_id',
        'current_published_version_id'
      )
  ) then
    raise exception
      'STOP: K4C-A3 Playlist P3 pointer retirement regressed';
  end if;

  if to_regclass('video.review_events') is not null
     or to_regclass('video.lifecycle_events') is not null
     or to_regclass('video.publication_review_events') is not null
     or to_regclass('video.publication_lifecycle_events') is not null
  then
    raise exception
      'STOP: K4C-A3 typed Video event authority exists';
  end if;

  select pg_get_functiondef(
    'editorial.sync_typed_lifecycle_from_resource()'::regprocedure
  )
  into v_definition;

  if v_definition ilike '%editorial.playlist_resources%'
     or v_definition not ilike '%editorial.audio_publication_resources%'
  then
    raise exception
      'STOP: K4C-A3 Resource-to-typed helper is not Audio-only at retirement';
  end if;
end;
$phase_7a_k4c_a3_preflight$;

drop trigger
  audio_publication_resources_sync_shared_lifecycle
on editorial.audio_publication_resources;

drop trigger
  resources_sync_typed_lifecycle_compatibility
on editorial.resources;

drop function editorial.sync_resource_lifecycle_from_typed_binding();

drop function editorial.sync_typed_lifecycle_from_resource();

alter table editorial.audio_publication_resources
  drop constraint audio_publication_resources_working_version_fkey,
  drop constraint audio_publication_resources_submitted_version_fkey,
  drop constraint audio_publication_resources_approved_version_fkey,
  drop constraint audio_publication_resources_published_version_fkey;

alter table editorial.audio_publication_resources
  drop column current_working_version_id,
  drop column current_submitted_version_id,
  drop column current_approved_version_id,
  drop column current_published_version_id;

do $phase_7a_k4c_a3_postconditions$
declare
  v_count bigint;
  v_baseline record;
begin
  select *
  into v_baseline
  from phase_7a_k4c_a3_data_baseline;

  select count(*)
  into v_count
  from information_schema.columns
  where table_schema = 'editorial'
    and table_name = 'audio_publication_resources'
    and column_name in (
      'current_working_version_id',
      'current_submitted_version_id',
      'current_approved_version_id',
      'current_published_version_id'
    );

  if v_count <> 0 then
    raise exception
      'STOP: K4C-A3 Audio typed pointer columns remain';
  end if;

  if (
    select array_agg(column_name::text order by column_name::text)
    from information_schema.columns
    where table_schema = 'editorial'
      and table_name = 'audio_publication_resources'
  ) is distinct from array[
    'publication_id',
    'resource_id',
    'resource_kind'
  ]::text[] then
    raise exception
      'STOP: K4C-A3 Audio binding identity column set changed';
  end if;

  if exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid =
            'editorial.audio_publication_resources'::regclass
      and constraint_row.conname in (
        'audio_publication_resources_working_version_fkey',
        'audio_publication_resources_submitted_version_fkey',
        'audio_publication_resources_approved_version_fkey',
        'audio_publication_resources_published_version_fkey'
      )
  ) then
    raise exception
      'STOP: K4C-A3 Audio typed pointer foreign key remains';
  end if;

  if exists (
    select 1
    from pg_trigger trigger_row
    where not trigger_row.tgisinternal
      and trigger_row.tgname in (
        'audio_publication_resources_sync_shared_lifecycle',
        'resources_sync_typed_lifecycle_compatibility'
      )
  ) then
    raise exception
      'STOP: K4C-A3 compatibility trigger remains';
  end if;

  if to_regprocedure(
       'editorial.sync_resource_lifecycle_from_typed_binding()'
     ) is not null
     or to_regprocedure(
       'editorial.sync_typed_lifecycle_from_resource()'
     ) is not null
  then
    raise exception
      'STOP: K4C-A3 compatibility helper remains';
  end if;

  if v_baseline.audio_binding_count is distinct from (
    select count(*)
    from editorial.audio_publication_resources
  ) then
    raise exception
      'STOP: K4C-A3 changed Audio binding row count';
  end if;

  if v_baseline.audio_nonpointer_fingerprint
       is distinct from (
         select md5(
           coalesce(
             string_agg(
               to_jsonb(binding)::text,
               E'\n'
               order by binding.resource_id::text
             ),
             ''
           )
         )
         from editorial.audio_publication_resources binding
       )
  then
    raise exception
      'STOP: K4C-A3 mutated non-pointer Audio binding data';
  end if;

  if v_baseline.audio_resource_fingerprint
       is distinct from (
         select md5(
           coalesce(
             string_agg(
               to_jsonb(resource)::text,
               E'\n'
               order by resource.id::text
             ),
             ''
           )
         )
         from editorial.resources resource
         join editorial.audio_publication_resources binding
           on binding.resource_id = resource.id
       )
  then
    raise exception
      'STOP: K4C-A3 mutated canonical Audio Resource rows';
  end if;

  if v_baseline.audio_nonpointer_constraint_fingerprint
       is distinct from (
         select md5(
           coalesce(
             string_agg(
               constraint_row.conname
               || '|'
               || pg_get_constraintdef(constraint_row.oid, true),
               E'\n'
               order by constraint_row.conname
             ),
             ''
           )
         )
         from pg_constraint constraint_row
         where constraint_row.conrelid =
                 'editorial.audio_publication_resources'::regclass
       )
  then
    raise exception
      'STOP: K4C-A3 changed non-pointer Audio binding constraints';
  end if;

  if exists (
    select 1
    from phase_7a_k4c_a3_function_baseline baseline
    left join pg_proc procedure_row
      on procedure_row.oid = baseline.procedure_oid
    where procedure_row.oid is null
       or md5(pg_get_functiondef(procedure_row.oid))
            is distinct from baseline.definition_md5
       or procedure_row.proowner
            is distinct from baseline.owner_oid
       or procedure_row.prosecdef
            is distinct from baseline.security_definer
       or procedure_row.provolatile
            is distinct from baseline.volatility
       or coalesce(procedure_row.proconfig::text, '')
            is distinct from baseline.function_config
       or coalesce(procedure_row.proacl::text, '')
            is distinct from baseline.function_acl
  ) then
    raise exception
      'STOP: K4C-A3 changed an Audio business/helper function outside compatibility retirement';
  end if;

  if exists (
    select 1
    from pg_proc procedure_row
    where procedure_row.prokind in ('f', 'p')
      and pg_get_functiondef(procedure_row.oid)
        ~ '(v_binding|binding|audio_binding)[.]current_(working|submitted|approved|published)_version_id'
      and pg_get_functiondef(procedure_row.oid)
        ~ 'editorial[.]audio_publication_resources'
  ) then
    raise exception
      'STOP: K4C-A3 left a direct Audio typed pointer reader';
  end if;

  if exists (
    select 1
    from pg_proc procedure_row
    where procedure_row.prokind in ('f', 'p')
      and (
        pg_get_functiondef(procedure_row.oid)
          ~* 'update[[:space:]]+editorial[.]audio_publication_resources[[:space:][:print:]]{0,200}set[[:space:][:print:]]{0,200}current_(working|submitted|approved|published)_version_id'
        or pg_get_functiondef(procedure_row.oid)
          ~* 'insert[[:space:]]+into[[:space:]]+editorial[.]audio_publication_resources[[:space:]]*[(][^)]*current_(working|submitted|approved|published)_version_id'
      )
  ) then
    raise exception
      'STOP: K4C-A3 left a typed Audio pointer writer';
  end if;

  if exists (
    select 1
    from pg_proc procedure_row
    where procedure_row.prokind in ('f', 'p')
      and pg_get_functiondef(procedure_row.oid)
        ~* 'insert[[:space:]]+into[[:space:]]+audio[.]publication_(review|lifecycle)_events'
  ) then
    raise exception
      'STOP: K4C-A3 renewed typed Audio event authority';
  end if;

  if to_regclass('audio.publication_review_events') is null
     or to_regclass('audio.publication_lifecycle_events') is null
  then
    raise exception
      'STOP: K4C-A3 removed typed Audio historical event compatibility';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'editorial'
      and table_name = 'playlist_resources'
      and column_name in (
        'current_working_version_id',
        'current_submitted_version_id',
        'current_approved_version_id',
        'current_published_version_id'
      )
  ) then
    raise exception
      'STOP: K4C-A3 regressed Playlist P3 pointer retirement';
  end if;

  if exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgname =
            'playlist_resources_sync_shared_lifecycle'
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'STOP: K4C-A3 restored Playlist pointer compatibility trigger';
  end if;

  if to_regclass('video.review_events') is not null
     or to_regclass('video.lifecycle_events') is not null
     or to_regclass('video.publication_review_events') is not null
     or to_regclass('video.publication_lifecycle_events') is not null
  then
    raise exception
      'STOP: K4C-A3 renewed typed Video event authority';
  end if;
end;
$phase_7a_k4c_a3_postconditions$;

commit;
