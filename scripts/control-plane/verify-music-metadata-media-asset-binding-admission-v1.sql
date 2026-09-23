-- Permanent verifier for Slice 3 governed exact Track/Artist Media binding.
-- Safe to run repeatedly. Raises on authority or runtime drift.

do $verify$
declare
  v_candidate_definition text;
  v_executor_definition text;
begin
  if to_regclass('public.registry_tracks') is null
     or to_regclass('public.registry_artists') is null
     or to_regclass('public.registry_media_assets') is null
     or to_regclass('platform_private.registry_evidence_assertions') is null
     or to_regclass('platform_private.registry_operation_types') is null
     or to_regclass('platform_private.registry_execution_grants') is null
     or to_regclass('platform_private.registry_mutation_operations') is null
     or to_regclass('platform_private.registry_operation_write_events') is null
     or to_regclass('public.registry_canonical_write_events') is null
  then
    raise exception 'Slice 3 Media binding authority is incomplete';
  end if;

  if (
       select count(*)
       from public.capability_definitions capability
       where capability.capability_key in (
         'admit_registry_track_media_asset_binding',
         'admit_registry_artist_media_asset_binding'
       )
         and capability.domain='registry'
     )<>2
  then
    raise exception 'Media binding capabilities are missing';
  end if;

  if not exists (
    select 1
    from platform_private.registry_operation_types operation_type
    where operation_type.operation_key=
            'registry.track.media_asset_binding.admit'
      and operation_type.operation_version=1
      and operation_type.capability_key=
            'admit_registry_track_media_asset_binding'
      and operation_type.risk_class='medium'
      and operation_type.allowed_subject_types=array['track']::text[]
      and operation_type.requires_existing_target
      and operation_type.max_targets=1
      and operation_type.max_rows_ceiling=1
      and operation_type.max_grant_ttl_seconds=300
      and operation_type.requires_human_approval
      and operation_type.requires_verifier
      and operation_type.enabled
  ) then
    raise exception 'Track Media binding operation type drifted';
  end if;

  if not exists (
    select 1
    from platform_private.registry_operation_types operation_type
    where operation_type.operation_key=
            'registry.artist.media_asset_binding.admit'
      and operation_type.operation_version=1
      and operation_type.capability_key=
            'admit_registry_artist_media_asset_binding'
      and operation_type.risk_class='medium'
      and operation_type.allowed_subject_types=array['artist']::text[]
      and operation_type.requires_existing_target
      and operation_type.max_targets=1
      and operation_type.max_rows_ceiling=1
      and operation_type.max_grant_ttl_seconds=300
      and operation_type.requires_human_approval
      and operation_type.requires_verifier
      and operation_type.enabled
  ) then
    raise exception 'Artist Media binding operation type drifted';
  end if;

  if not exists (
    select 1
    from platform_private.system_actors actor
    where actor.actor_key='registry_media_asset_binding_admin'
      and actor.status='active'
      and actor.capability_profile->'operation_family'
          @> '[
            "registry.track.media_asset_binding.admit/v1",
            "registry.artist.media_asset_binding.admit/v1"
          ]'::jsonb
  ) then
    raise exception 'Media binding admin actor is missing or malformed';
  end if;

  if not exists (
    select 1
    from platform_private.system_actor_executor_bindings binding
    where binding.actor_key='registry_media_asset_binding_admin'
      and binding.executor_kind='database_role'
      and binding.executor_key='authenticator'
      and binding.status='active'
  ) then
    raise exception 'Media binding authenticator binding drifted';
  end if;

  if exists (
    select 1
    from platform_private.system_actor_capability_grants standing_grant
    where standing_grant.actor_key='registry_media_asset_binding_admin'
      and standing_grant.status='active'
      and standing_grant.valid_from<=now()
      and standing_grant.expires_at>now()
  ) then
    raise exception 'Media binding actor gained standing autonomous authority';
  end if;

  if to_regprocedure(
       'platform_private.registry_media_asset_binding_admin_current_user_v1()'
     ) is null
     or to_regprocedure(
       'platform_private.registry_media_asset_state_fingerprint_v1(uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_media_asset_binding_candidate_state_v1(text,uuid,uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.record_registry_media_asset_binding_evidence_v1(text,uuid,uuid,jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.issue_registry_media_asset_binding_admin_grant_v1(uuid,text,uuid,jsonb,text,text)'
     ) is null
     or to_regprocedure(
       'platform_private.execute_registry_media_asset_binding_admin_v1(uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.verify_registry_media_asset_binding_admin_v1(uuid)'
     ) is null
     or to_regprocedure(
       'public.admin_admit_registry_track_media_asset_candidate_v1(uuid,uuid)'
     ) is null
     or to_regprocedure(
       'public.admin_admit_registry_artist_media_asset_candidate_v1(uuid,uuid)'
     ) is null
  then
    raise exception 'Media binding runtime functions are incomplete';
  end if;

  if has_function_privilege(
       'anon',
       'public.admin_admit_registry_track_media_asset_candidate_v1(uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_admit_registry_track_media_asset_candidate_v1(uuid,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_admit_registry_track_media_asset_candidate_v1(uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.admin_admit_registry_artist_media_asset_candidate_v1(uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_admit_registry_artist_media_asset_candidate_v1(uuid,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.admin_admit_registry_artist_media_asset_candidate_v1(uuid,uuid)',
       'EXECUTE'
     )
  then
    raise exception 'Media binding public wrapper ACL drifted';
  end if;

  if has_function_privilege(
       'authenticated',
       'platform_private.execute_registry_media_asset_binding_admin_v1(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.execute_registry_media_asset_binding_admin_v1(uuid)',
       'EXECUTE'
     )
  then
    raise exception 'Media binding private executor leaked execution authority';
  end if;

  select pg_get_functiondef(
    'platform_private.registry_media_asset_binding_candidate_state_v1(text,uuid,uuid)'::regprocedure
  )
  into v_candidate_definition;

  if position('asset.url=v_source_url' in v_candidate_definition)=0
     or position('exact_active_asset_match_count' in v_candidate_definition)=0
     or position('exact_url_reuse_candidate' in v_candidate_definition)=0
     or position('artwork_url' in v_candidate_definition)=0
     or position('public_image_url' in v_candidate_definition)=0
     or position('similarity' in lower(v_candidate_definition))>0
     or position('levenshtein' in lower(v_candidate_definition))>0
     or position('trigram' in lower(v_candidate_definition))>0
  then
    raise exception 'Media binding exact candidate-state contract drifted';
  end if;

  select pg_get_functiondef(
    'platform_private.execute_registry_media_asset_binding_admin_v1(uuid)'::regprocedure
  )
  into v_executor_definition;

  if position('artwork_image_id=v_asset_id' in v_executor_definition)=0
     or position('public_image_id=v_asset_id' in v_executor_definition)=0
     or position('admit_track_media_asset_binding' in v_executor_definition)=0
     or position('admit_artist_media_asset_binding' in v_executor_definition)=0
     or position('format(' in lower(v_executor_definition))>0
  then
    raise exception 'Media binding typed executor contract drifted';
  end if;

  if exists (
    select 1
    from platform_private.registry_evidence_assertions evidence
    where evidence.claim_key in (
      'registry.track.media_asset_binding.admit',
      'registry.artist.media_asset_binding.admit'
    )
      and (
        (
          evidence.claim_key='registry.track.media_asset_binding.admit'
          and evidence.subject_type<>'track'
        )
        or (
          evidence.claim_key='registry.artist.media_asset_binding.admit'
          and evidence.subject_type<>'artist'
        )
        or evidence.trust_class<>'INTERNAL_FACT'
        or evidence.source_kind<>'retained_registry_metadata'
        or evidence.claim_payload->>'candidate_state'<>
             'exact_url_reuse_candidate'
        or coalesce(
             (
               evidence.claim_payload->
                 'exact_active_asset_match_count'
             )::integer,
             0
           )<>1
        or evidence.claim_payload->>'source_url'
             <>evidence.claim_payload->>'target_media_asset_url'
      )
  ) then
    raise exception 'Media binding evidence lifecycle drifted';
  end if;

  if exists (
    select 1
    from platform_private.registry_mutation_operations operation
    where operation.actor_key='registry_media_asset_binding_admin'
      and operation.status='succeeded'
      and (
        operation.affected_rows<>1
        or operation.verifier_status<>'passed'
        or (
          select count(*)
          from platform_private.registry_operation_write_events link
          where link.operation_id=operation.id
        )<>1
      )
  ) then
    raise exception 'Completed Media binding operations are not exactly verified';
  end if;

  if exists (
    select 1
    from platform_private.registry_operation_write_events link
    join platform_private.registry_mutation_operations operation
      on operation.id=link.operation_id
    join public.registry_canonical_write_events event
      on event.id=link.canonical_write_event_id
    where operation.actor_key='registry_media_asset_binding_admin'
      and (
        (
          operation.operation_key=
            'registry.track.media_asset_binding.admit'
          and (
            event.registry_entity_type<>'track'
            or event.field_name<>'artwork_image_id'
            or event.target_path<>
                 'public.registry_tracks.artwork_image_id'
            or event.action<>'admit_track_media_asset_binding'
          )
        )
        or (
          operation.operation_key=
            'registry.artist.media_asset_binding.admit'
          and (
            event.registry_entity_type<>'artist'
            or event.field_name<>'public_image_id'
            or event.target_path<>
                 'public.registry_artists.public_image_id'
            or event.action<>'admit_artist_media_asset_binding'
          )
        )
        or event.source_table<>
             'platform_private.registry_evidence_assertions'
        or event.status<>'succeeded'
        or event.actor<>'system:registry_media_asset_binding_admin'
      )
  ) then
    raise exception 'Media binding canonical write-event causality drifted';
  end if;

  raise notice 'MUSIC_METADATA_SLICE3_MEDIA_ASSET_BINDING_ADMISSION_V1_PASS';
end
$verify$;
