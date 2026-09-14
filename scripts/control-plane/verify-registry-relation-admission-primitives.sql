-- Permanent verifier for #939 Boundary A relation-admission foundation.

do $verify$
declare
  v_count integer;
begin
  if platform_private.registry_credit_role_v1(
       ' PRIMARY_ARTIST '
     ) <> 'primary_artist'
     or platform_private.registry_credit_role_v1(
       'featured_artist'
     ) <> 'featured_artist'
  then
    raise exception 'Registry credit role V1 drifted';
  end if;

  if platform_private.registry_relation_confidence_v1(1) <> 1
     or platform_private.registry_relation_confidence_v1(100) <> 100
  then
    raise exception 'Registry relation confidence V1 drifted';
  end if;

  if platform_private.registry_credit_order_v1(1) <> 1
     or platform_private.registry_release_disc_number_v1(1) <> 1
     or platform_private.registry_release_track_number_v1(null) is not null
     or platform_private.registry_release_track_number_v1(1) <> 1
  then
    raise exception 'Registry relation ordering V1 drifted';
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
          'registry.track_artist_credit.admit', 1,
          'admit_registry_track_artist_credit',
          'medium', false, 1, 1, 300, true, true, false
        ),
        (
          'registry.release_track.admit', 1,
          'admit_registry_release_track',
          'medium', false, 1, 1, 300, true, true, false
        ),
        (
          'registry.release_artist_credit.admit', 1,
          'admit_registry_release_artist_credit',
          'medium', false, 1, 1, 300, true, true, false
        )
      );

  if exists (
    select 1
    from platform_private.registry_operation_types operation_type
    where (
      operation_type.operation_key = 'registry.track_artist_credit.admit'
      and operation_type.allowed_subject_types
          <> array['track_artist_credit']::text[]
    )
    or (
      operation_type.operation_key = 'registry.release_track.admit'
      and operation_type.allowed_subject_types
          <> array['release_track_membership']::text[]
    )
    or (
      operation_type.operation_key = 'registry.release_artist_credit.admit'
      and operation_type.allowed_subject_types
          <> array['release_artist_credit']::text[]
    )
  ) then
    raise exception 'Registry relation subject-type contracts drifted';
  end if;

  if not (
    pg_get_constraintdef(
      (
        select constraint_row.oid
        from pg_constraint constraint_row
        where constraint_row.conrelid =
              'platform_private.registry_operation_types'::regclass
          and constraint_row.conname =
              'registry_operation_types_subjects_check'
      )
    ) like '%track_artist_credit%'
    and pg_get_constraintdef(
      (
        select constraint_row.oid
        from pg_constraint constraint_row
        where constraint_row.conrelid =
              'platform_private.registry_operation_types'::regclass
          and constraint_row.conname =
              'registry_operation_types_subjects_check'
      )
    ) like '%release_track_membership%'
    and pg_get_constraintdef(
      (
        select constraint_row.oid
        from pg_constraint constraint_row
        where constraint_row.conrelid =
              'platform_private.registry_operation_types'::regclass
          and constraint_row.conname =
              'registry_operation_types_subjects_check'
      )
    ) like '%release_artist_credit%'
  ) then
    raise exception 'Registry operation subject vocabulary did not converge for relation V1';
  end if;

  if position(
       'registry_track_artists'
       in pg_get_functiondef(
            'platform_private.registry_subject_exists(text,uuid)'::regprocedure
          )
     ) = 0
     or position(
       'registry_release_tracks'
       in pg_get_functiondef(
            'platform_private.registry_subject_exists(text,uuid)'::regprocedure
          )
     ) = 0
     or position(
       'registry_release_artists'
       in pg_get_functiondef(
            'platform_private.registry_subject_exists(text,uuid)'::regprocedure
          )
     ) = 0
     or position(
       'registry_track_artists'
       in pg_get_functiondef(
            'platform_private.registry_subject_state_fingerprint(text,uuid)'::regprocedure
          )
     ) = 0
     or position(
       'registry_release_tracks'
       in pg_get_functiondef(
            'platform_private.registry_subject_state_fingerprint(text,uuid)'::regprocedure
          )
     ) = 0
     or position(
       'registry_release_artists'
       in pg_get_functiondef(
            'platform_private.registry_subject_state_fingerprint(text,uuid)'::regprocedure
          )
     ) = 0
  then
    raise exception 'Registry relation subject resolver mapping drifted';
  end if;

  if v_count <> 3 then
    raise exception 'Registry relation-admission operation contracts drifted';
  end if;

  if exists (
    select 1 from public.role_capabilities
    where capability_key in (
      'admit_registry_track_artist_credit',
      'admit_registry_release_track',
      'admit_registry_release_artist_credit'
    )
  ) then
    raise exception 'Relation-admission capability leaked to a product role before Boundary B';
  end if;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants
    where capability_key in (
      'admit_registry_track_artist_credit',
      'admit_registry_release_track',
      'admit_registry_release_artist_credit'
    )
      and status='active'
      and valid_from<=now()
      and expires_at>now()
  ) then
    raise exception 'Standing relation-admission authority exists before Boundary B';
  end if;

  if exists (
    select 1
    from platform_private.registry_execution_grants
    where actor_key='registry_chart_admission'
      and operation_key in (
        'registry.track_artist_credit.admit',
        'registry.release_track.admit',
        'registry.release_artist_credit.admit'
      )
  ) then
    raise exception 'Inert relation-admission foundation unexpectedly has exact grants';
  end if;

  if exists (
    select 1
    from platform_private.registry_mutation_operations
    where actor_key='registry_chart_admission'
      and operation_key in (
        'registry.track_artist_credit.admit',
        'registry.release_track.admit',
        'registry.release_artist_credit.admit'
      )
  ) then
    raise exception 'Inert relation-admission foundation unexpectedly has mutation operations';
  end if;

  if has_function_privilege(
       'authenticated',
       'platform_private.registry_track_artist_credit_collision_state_v1(uuid,uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.registry_track_artist_credit_collision_state_v1(uuid,uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.registry_release_track_collision_state_v1(uuid,uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.registry_release_track_collision_state_v1(uuid,uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.registry_release_artist_credit_collision_state_v1(uuid,uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.registry_release_artist_credit_collision_state_v1(uuid,uuid,uuid)',
       'EXECUTE'
     )
  then
    raise exception 'Private relation-collision authority leaked executable privileges';
  end if;

  raise notice
    'REGISTRY_RELATION_ADMISSION_FOUNDATION_PASS operations=3 enabled=0 product_role_grants=0 standing_grants=0';
end
$verify$;
