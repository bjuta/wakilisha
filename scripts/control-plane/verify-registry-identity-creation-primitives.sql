-- Permanent verifier for #939 Boundary A identity-creation foundation.
--
-- Expected state:
-- - Artist / Track creation V1 are enabled only behind exact chart grants;
-- - Release creation V1 remains disabled;
-- - registry_chart_admission is bound only to PostgREST authenticator transport;
-- - no product role or standing System Actor grant carries the new capabilities;
-- - no exact grants / mutation operations exist for these inert operations;
-- - normalization/canonical identifier helpers retain their V1 semantics;
-- - collision helpers remain private.

do $verify$
declare
  v_count integer;
begin
  if platform_private.registry_identity_normalize_text_v1(
       '  Café   del Mar  '
     ) <> 'café del mar'
  then
    raise exception
      'Registry canonical text normalization V1 drifted';
  end if;

  if platform_private.registry_identity_comparison_key_v1(
       'K’naan'
     ) <> 'k naan'
     or platform_private.registry_identity_comparison_key_v1(
       'K''naan'
     ) <> 'k naan'
  then
    raise exception
      'Registry identity comparison key V1 drifted';
  end if;

  if platform_private.registry_identity_canonical_isrc_v1(
       'us-abc-12-34567'
     ) <> 'USABC1234567'
  then
    raise exception
      'Registry ISRC canonicalization V1 drifted';
  end if;

  if platform_private.registry_identity_canonical_upc_v1(
       '0 123456789012'
     ) <> '0123456789012'
  then
    raise exception
      'Registry UPC canonicalization V1 drifted';
  end if;

  select count(*)::integer
  into v_count
  from platform_private.registry_operation_types operation_type
  where (
        operation_type.operation_key,
        operation_type.operation_version,
        operation_type.capability_key,
        operation_type.risk_class,
        operation_type.requires_existing_target,
        operation_type.max_targets,
        operation_type.max_rows_ceiling,
        operation_type.max_grant_ttl_seconds,
        operation_type.requires_human_approval,
        operation_type.requires_verifier,
        operation_type.enabled
      ) in (
        (
          'registry.artist.create', 1, 'create_registry_artist',
          'medium', false, 1, 1, 300, true, true, true
        ),
        (
          'registry.track.create', 1, 'create_registry_track',
          'medium', false, 1, 1, 300, true, true, true
        ),
        (
          'registry.release.create', 1, 'create_registry_release',
          'medium', false, 1, 1, 300, true, true, false
        )
      );

  if v_count <> 3 then
    raise exception
      'Registry identity creation operation contracts drifted';
  end if;

  if not exists (
       select 1
       from platform_private.system_actors actor
       where actor.actor_key = 'registry_chart_admission'
         and actor.actor_kind = 'automation'
         and actor.status = 'active'
     )
     or not exists (
       select 1
       from platform_private.system_actor_executor_bindings binding
       where binding.actor_key = 'registry_chart_admission'
         and binding.executor_kind = 'database_role'
         and binding.executor_key = 'authenticator'
         and binding.status = 'active'
     )
  then
    raise exception
      'Registry chart admission transport actor drifted';
  end if;

  if exists (
    select 1
    from public.role_capabilities role_capability
    where role_capability.capability_key in (
      'create_registry_artist',
      'create_registry_track',
      'create_registry_release'
    )
  ) then
    raise exception
      'Identity-creation capability leaked to a product role before Boundary B';
  end if;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants standing_grant
    where standing_grant.capability_key in (
      'create_registry_artist',
      'create_registry_track',
      'create_registry_release'
    )
      and standing_grant.status = 'active'
      and standing_grant.valid_from <= now()
      and standing_grant.expires_at > now()
  ) then
    raise exception
      'Standing identity-creation authority exists before Boundary B';
  end if;

  if exists (
    select 1
    from platform_private.registry_execution_grants execution_grant
    where execution_grant.actor_key = 'registry_chart_admission'
      and execution_grant.operation_key in (
        'registry.artist.create',
        'registry.track.create',
        'registry.release.create'
      )
  ) then
    raise exception
      'Inert identity-creation foundation unexpectedly has exact grants';
  end if;

  if exists (
    select 1
    from platform_private.registry_mutation_operations operation
    where operation.actor_key = 'registry_chart_admission'
      and operation.operation_key in (
        'registry.artist.create',
        'registry.track.create',
        'registry.release.create'
      )
  ) then
    raise exception
      'Inert identity-creation foundation unexpectedly has mutation operations';
  end if;

  if has_function_privilege(
       'authenticated',
       'platform_private.registry_artist_creation_collision_state_v1(uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.registry_artist_creation_collision_state_v1(uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.registry_track_creation_collision_state_v1(uuid,text,uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.registry_track_creation_collision_state_v1(uuid,text,uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.registry_release_creation_collision_state_v1(uuid,text,uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.registry_release_creation_collision_state_v1(uuid,text,uuid,text)',
       'EXECUTE'
     )
  then
    raise exception
      'Private identity-collision authority leaked executable privileges';
  end if;

  raise notice
    'REGISTRY_IDENTITY_CREATION_FOUNDATION_PASS operations=3 enabled=0 product_role_grants=0 standing_grants=0';
end
$verify$;
