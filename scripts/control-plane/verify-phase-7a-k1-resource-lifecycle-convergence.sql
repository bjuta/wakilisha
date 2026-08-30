-- HISTORICAL CHECKPOINT VERIFIER ONLY.
-- This script proves the named migration checkpoint, not the current post-kernel end state.
-- For current authority use scripts/control-plane/verify-phase-7a-kernel-closure.sql.
-- Permanent read-only verifier for Phase 7A K1 Resource lifecycle convergence.

begin;
set local transaction read only;
set local statement_timeout = '120s';

do $verify_phase_7a_k1_resource_lifecycle_convergence$
declare
  v_count bigint;
  v_definition text;
begin
  if to_regclass('editorial.resource_versions') is null then
    raise exception
      'PHASE_7A_K1_FAIL: Resource Version authority is missing';
  end if;

  if to_regprocedure(
       'editorial.assert_resource_version_pointer_integrity()'
     ) is null
     or to_regprocedure(
       'editorial.sync_resource_lifecycle_from_typed_binding()'
     ) is null
     or to_regprocedure(
       'editorial.sync_typed_lifecycle_from_resource()'
     ) is null
  then
    raise exception
      'PHASE_7A_K1_FAIL: one or more Resource lifecycle convergence functions are missing';
  end if;

  if to_regprocedure(
       'editorial.assert_article_version_pointer_integrity()'
     ) is not null
  then
    raise exception
      'PHASE_7A_K1_FAIL: Article-only Resource pointer integrity authority remains';
  end if;

  select count(*)
  into v_count
  from pg_constraint constraint_row
  where constraint_row.conrelid = 'editorial.resources'::regclass
    and constraint_row.confrelid = 'editorial.resource_versions'::regclass
    and constraint_row.conname in (
      'resources_current_working_resource_version_fkey',
      'resources_current_submitted_resource_version_fkey',
      'resources_current_approved_resource_version_fkey',
      'resources_current_published_resource_version_fkey'
    )
    and constraint_row.contype = 'f'
    and constraint_row.condeferrable
    and constraint_row.condeferred;

  if v_count <> 4 then
    raise exception
      'PHASE_7A_K1_FAIL: expected 4 deferred Resource Version lifecycle foreign keys, found %',
      v_count;
  end if;

  if exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid = 'editorial.resources'::regclass
      and constraint_row.conname in (
        'resources_current_working_resource_version_fkey',
        'resources_current_submitted_resource_version_fkey',
        'resources_current_approved_resource_version_fkey',
        'resources_current_published_resource_version_fkey'
      )
      and (
        constraint_row.confdeltype <> 'r'
        or position(
             case constraint_row.conname
               when 'resources_current_working_resource_version_fkey'
                 then 'FOREIGN KEY (id, current_working_version_id)'
               when 'resources_current_submitted_resource_version_fkey'
                 then 'FOREIGN KEY (id, current_submitted_version_id)'
               when 'resources_current_approved_resource_version_fkey'
                 then 'FOREIGN KEY (id, current_approved_version_id)'
               when 'resources_current_published_resource_version_fkey'
                 then 'FOREIGN KEY (id, current_published_version_id)'
             end
             in pg_get_constraintdef(constraint_row.oid, true)
           ) = 0
        or position(
             'REFERENCES editorial.resource_versions(resource_id, id)'
             in pg_get_constraintdef(constraint_row.oid, true)
           ) = 0
      )
  ) then
    raise exception
      'PHASE_7A_K1_FAIL: Resource lifecycle foreign-key shape drifted';
  end if;

  if exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid = 'editorial.resources'::regclass
      and constraint_row.conname in (
        'resources_current_working_version_fkey',
        'resources_current_submitted_version_fkey',
        'resources_current_approved_version_id_fkey',
        'resources_current_published_version_id_fkey'
      )
  ) then
    raise exception
      'PHASE_7A_K1_FAIL: Article-only lifecycle foreign keys remain';
  end if;

  select count(*)
  into v_count
  from pg_trigger trigger_row
  where not trigger_row.tgisinternal
    and (
      (
        trigger_row.tgrelid = 'editorial.resources'::regclass
        and trigger_row.tgname in (
          'resources_resource_version_pointer_integrity',
          'resources_sync_typed_lifecycle_compatibility'
        )
      )
      or (
        trigger_row.tgrelid = 'editorial.playlist_resources'::regclass
        and trigger_row.tgname = 'playlist_resources_sync_shared_lifecycle'
      )
      or (
        trigger_row.tgrelid = 'editorial.audio_publication_resources'::regclass
        and trigger_row.tgname = 'audio_publication_resources_sync_shared_lifecycle'
      )
    );

  if v_count <> 4 then
    raise exception
      'PHASE_7A_K1_FAIL: expected 4 Resource lifecycle convergence triggers, found %',
      v_count;
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid = 'editorial.resources'::regclass
      and trigger_row.tgname = 'resources_resource_version_pointer_integrity'
      and trigger_row.tgdeferrable
      and trigger_row.tginitdeferred
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'PHASE_7A_K1_FAIL: Resource pointer integrity trigger is not deferred';
  end if;

  v_definition := pg_get_functiondef(
    'editorial.assert_resource_version_pointer_integrity()'::regprocedure
  );

  if position('version_kind = ''submitted''' in v_definition) = 0
     or position('version_row.resource_id = new.id' in v_definition) = 0
  then
    raise exception
      'PHASE_7A_K1_FAIL: shared Resource pointer integrity contract drifted';
  end if;

  select count(*)
  into v_count
  from pg_proc function_row
  join pg_namespace schema_row
    on schema_row.oid = function_row.pronamespace
  where schema_row.nspname = 'editorial'
    and function_row.proname in (
      'assert_resource_version_pointer_integrity',
      'sync_resource_lifecycle_from_typed_binding',
      'sync_typed_lifecycle_from_resource'
    )
    and function_row.prokind = 'f'
    and function_row.prosecdef
    and coalesce(function_row.proconfig, '{}'::text[])
          @> array['search_path=pg_catalog, editorial']::text[];

  if v_count <> 3 then
    raise exception
      'PHASE_7A_K1_FAIL: Resource lifecycle helper security/search-path contract drifted';
  end if;

  if has_function_privilege(
       'anon',
       'editorial.assert_resource_version_pointer_integrity()'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'editorial.assert_resource_version_pointer_integrity()'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'editorial.assert_resource_version_pointer_integrity()'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'editorial.sync_resource_lifecycle_from_typed_binding()'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'editorial.sync_resource_lifecycle_from_typed_binding()'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'editorial.sync_resource_lifecycle_from_typed_binding()'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'editorial.sync_typed_lifecycle_from_resource()'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'editorial.sync_typed_lifecycle_from_resource()'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'editorial.sync_typed_lifecycle_from_resource()'::regprocedure,
       'EXECUTE'
     )
  then
    raise exception
      'PHASE_7A_K1_FAIL: Resource lifecycle internal helper EXECUTE leaked to application roles';
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
      'PHASE_7A_K1_FAIL: % Playlist lifecycle mirror mismatch(es)',
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
      'PHASE_7A_K1_FAIL: % Audio lifecycle mirror mismatch(es)',
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
    left join editorial.resource_versions version_row
      on version_row.id = pointer.version_id
     and version_row.resource_id = resource_row.id
    where pointer.version_id is not null
      and version_row.id is null
  ) then
    raise exception
      'PHASE_7A_K1_FAIL: a shared lifecycle pointer targets another Resource or a missing Resource Version';
  end if;

  if exists (
    select 1
    from editorial.resources resource_row
    join editorial.resource_versions version_row
      on version_row.id = resource_row.current_submitted_version_id
     and version_row.resource_id = resource_row.id
    where resource_row.current_submitted_version_id is not null
      and version_row.version_kind <> 'submitted'
  ) then
    raise exception
      'PHASE_7A_K1_FAIL: a submitted pointer targets a non-submitted Resource Version';
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
    join editorial.resource_versions version_row
      on version_row.id = pointer.version_id
     and version_row.resource_id = resource_row.id
    where pointer.version_id is not null
      and (
        (resource_row.resource_kind = 'article' and version_row.version_type <> 'article_version')
        or (resource_row.resource_kind = 'playlist' and version_row.version_type <> 'playlist_version')
        or (
          resource_row.resource_kind in ('audio_episode', 'standalone_audio')
          and version_row.version_type <> 'audio_publication_version'
        )
      )
  ) then
    raise exception
      'PHASE_7A_K1_FAIL: a lifecycle pointer targets the wrong typed Resource Version authority';
  end if;

  if exists (
    select 1
    from editorial.resources resource_row
    where resource_row.resource_kind in ('audio_show', 'audio_season')
      and (
        resource_row.current_working_version_id is not null
        or resource_row.current_submitted_version_id is not null
        or resource_row.current_approved_version_id is not null
        or resource_row.current_published_version_id is not null
      )
  ) then
    raise exception
      'PHASE_7A_K1_FAIL: non-versioned Audio hierarchy Resources acquired lifecycle pointers';
  end if;
end;
$verify_phase_7a_k1_resource_lifecycle_convergence$;

select
  'PHASE_7A_K1_RESOURCE_LIFECYCLE_CONVERGENCE_PASS' as verification_result,
  (
    select count(*)
    from editorial.resources
    where current_working_version_id is not null
       or current_submitted_version_id is not null
       or current_approved_version_id is not null
       or current_published_version_id is not null
  ) as resources_with_lifecycle_position,
  (
    select count(*)
    from editorial.playlist_resources
  ) as playlist_compatibility_bindings,
  (
    select count(*)
    from editorial.audio_publication_resources
  ) as audio_compatibility_bindings;

rollback;
