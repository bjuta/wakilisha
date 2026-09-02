-- Permanent read-only verifier for Phase 7B V4A
-- Media processing-profile convergence + adaptive Video authority.

begin;

do $phase_7b_v4a_verify$
declare
  v_base_submit text;
  v_base_register text;
  v_shared_submit text;
  v_shared_register text;
  v_audio_submit text;
  v_audio_register text;
begin
  if to_regclass('media.processing_profiles') is null
     or to_regclass('media.processing_profile_outputs') is null
     or to_regprocedure(
       'public.submit_media_processing_profile_v1(uuid,uuid,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.register_media_processing_profile_outputs_v1(uuid,text,jsonb)'
     ) is null
  then
    raise exception
      'V4A verification failed: canonical Media processing-profile authority is missing';
  end if;

  if exists (
    select 1
    from pg_class relation
    where relation.oid in (
      'media.processing_profiles'::regclass,
      'media.processing_profile_outputs'::regclass
    )
      and not relation.relrowsecurity
  ) then
    raise exception
      'V4A verification failed: processing-profile authority lacks RLS';
  end if;

  if exists (
    select 1
    from (
      values
        (
          'audio-publication-v1',
          'audio',
          'phase6a-m2-v1',
          'editorial',
          'audio_publication',
          'audio_master',
          null::text,
          false,
          1
        ),
        (
          'video-adaptive-v1',
          'video',
          'phase7b-v4a-v1',
          'video',
          'video_publication',
          'video_master',
          'video_publication_version',
          true,
          5
        )
    ) expected(
      profile_version,
      asset_kind,
      generator_version,
      usage_authority,
      usage_target_kind,
      usage_role,
      target_version_kind,
      require_target_version,
      output_count
    )
    left join media.processing_profiles profile
      on profile.profile_version = expected.profile_version
    where profile.profile_version is null
       or not profile.enabled
       or profile.asset_kind is distinct from expected.asset_kind
       or profile.generator_name
            is distinct from 'wakilisha-media-processor'
       or profile.generator_version
            is distinct from expected.generator_version
       or profile.required_usage_authority
            is distinct from expected.usage_authority
       or profile.required_usage_target_kind
            is distinct from expected.usage_target_kind
       or profile.required_usage_role
            is distinct from expected.usage_role
       or profile.required_usage_target_version_kind
            is distinct from expected.target_version_kind
       or profile.require_usage_target_version
            is distinct from expected.require_target_version
       or (
         select count(*)
         from media.processing_profile_outputs output_contract
         where output_contract.profile_version =
               expected.profile_version
       ) <> expected.output_count
  ) then
    raise exception
      'V4A verification failed: canonical Audio/Video profile contracts drifted';
  end if;

  if exists (
    select 1
    from (
      values
        ('video_hls_master'),
        ('video_hls_360p_playlist'),
        ('video_hls_360p_media'),
        ('video_hls_720p_playlist'),
        ('video_hls_720p_media')
    ) required(variant_role)
    where not exists (
      select 1
      from media.variant_roles role_row
      where role_row.variant_role = required.variant_role
        and role_row.enabled
    )
  ) then
    raise exception
      'V4A verification failed: adaptive Video variant roles are incomplete';
  end if;

  if to_regprocedure(
       'public.submit_video_adaptive_processing_v1(uuid,uuid,text,uuid)'
     ) is not null
     or to_regprocedure(
       'public.register_video_adaptive_processing_outputs_v1(uuid,text,jsonb)'
     ) is not null
  then
    raise exception
      'V4A verification failed: competing Video-specific processing authority exists';
  end if;

  v_base_submit := pg_get_functiondef(
    'public.submit_media_processing_command_v1(uuid,uuid,text,text,uuid)'::regprocedure
  );
  v_base_register := pg_get_functiondef(
    'public.register_media_processing_outputs_v1(uuid,text,jsonb)'::regprocedure
  );

  if position('audio-publication-v1' in v_base_submit) > 0
     or position('video-adaptive-v1' in v_base_submit) > 0
     or position('audio-publication-v1' in v_base_register) > 0
     or position('video-adaptive-v1' in v_base_register) > 0
  then
    raise exception
      'V4A verification failed: accepted Phase 4 base processing functions were broadened';
  end if;

  v_shared_submit := pg_get_functiondef(
    'public.submit_media_processing_profile_v1(uuid,uuid,text,text,uuid)'::regprocedure
  );
  v_shared_register := pg_get_functiondef(
    'public.register_media_processing_profile_outputs_v1(uuid,text,jsonb)'::regprocedure
  );
  v_audio_submit := pg_get_functiondef(
    'public.submit_audio_delivery_processing_v1(uuid,uuid,text,uuid)'::regprocedure
  );
  v_audio_register := pg_get_functiondef(
    'public.register_audio_delivery_processing_outputs_v1(uuid,text,jsonb)'::regprocedure
  );

  if position('media.processing_profiles' in v_shared_submit) = 0
     or position('media.usage_links' in v_shared_submit) = 0
     or position('media.process_revision' in v_shared_submit) = 0
     or position('media.processing_profile_outputs' in v_shared_register) = 0
     or position('media.insert_verified_file_object_v2' in v_shared_register) = 0
     or position('media.variant_selections' in v_shared_register) = 0
     or position('submit_media_processing_profile_v1' in v_audio_submit) = 0
     or position('register_media_processing_profile_outputs_v1' in v_audio_register) = 0
  then
    raise exception
      'V4A verification failed: processing-profile convergence contract drifted';
  end if;

  if exists (
    select 1
    from media.variants variant
    join media.processing_profile_outputs contract
      on contract.variant_role = variant.variant_role
     and contract.profile_version =
         variant.transformation_spec ->> 'profile'
    join media.processing_profiles profile
      on profile.profile_version = contract.profile_version
    join media.file_objects file_row
      on file_row.id = variant.derived_file_object_id
    where contract.profile_version in (
      'audio-publication-v1',
      'video-adaptive-v1'
    )
      and (
        file_row.verification_state is distinct from 'verified'
        or file_row.storage_provider is distinct from 'lightsail_media'
        or coalesce(file_row.storage_namespace, '')
             is distinct from 'lightsail-media'
        or file_row.mime_type is distinct from contract.mime_type
        or variant.transformation_spec
             is distinct from contract.transformation_spec
        or variant.generator_name
             is distinct from profile.generator_name
        or variant.generator_version
             is distinct from profile.generator_version
      )
  ) then
    raise exception
      'V4A verification failed: registered profile derivative violates canonical contract';
  end if;

  if exists (
    select 1
    from media.variant_selections selection
    join media.variants variant
      on variant.id = selection.variant_id
     and variant.variant_role = selection.variant_role
    join media.processing_profile_outputs contract
      on contract.variant_role = selection.variant_role
     and contract.profile_version =
         variant.transformation_spec ->> 'profile'
    where contract.profile_version = 'video-adaptive-v1'
    group by selection.asset_revision_id
    having count(*) filter (
      where selection.variant_role in (
        'video_hls_master',
        'video_hls_360p_playlist',
        'video_hls_360p_media',
        'video_hls_720p_playlist',
        'video_hls_720p_media'
      )
    ) not in (0, 5)
  ) then
    raise exception
      'V4A verification failed: selected adaptive Video package is incomplete';
  end if;
end;
$phase_7b_v4a_verify$;

select
  'PASS: Phase 7B V4A canonical Media processing-profile and adaptive Video authority is intact.'
    as verification_result;

rollback;
