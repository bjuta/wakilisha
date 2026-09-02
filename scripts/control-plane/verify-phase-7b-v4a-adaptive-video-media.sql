-- Permanent read-only verifier for Phase 7B V4A adaptive Video Media authority.

begin;

do $phase_7b_v4a_verify$
declare
  v_video_v1_submit text;
  v_video_v1_register text;
  v_submit text;
  v_register text;
begin
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
     ) is null
     or to_regprocedure(
       'public.register_video_adaptive_processing_outputs_v1(uuid,text,jsonb)'
     ) is null
  then
    raise exception
      'V4A verification failed: adaptive Video processing adapters are missing';
  end if;

  v_video_v1_submit := pg_get_functiondef(
    'public.submit_media_processing_command_v1(uuid,uuid,text,text,uuid)'::regprocedure
  );
  v_video_v1_register := pg_get_functiondef(
    'public.register_media_processing_outputs_v1(uuid,text,jsonb)'::regprocedure
  );

  if position(
       'video-adaptive-v1'
       in v_video_v1_submit
     ) > 0
     or position(
       'video-adaptive-v1'
       in v_video_v1_register
     ) > 0
  then
    raise exception
      'V4A verification failed: accepted Phase 4 video-v1 functions were broadened';
  end if;

  v_submit := pg_get_functiondef(
    'public.submit_video_adaptive_processing_v1(uuid,uuid,text,uuid)'::regprocedure
  );
  v_register := pg_get_functiondef(
    'public.register_video_adaptive_processing_outputs_v1(uuid,text,jsonb)'::regprocedure
  );

  if position('video-adaptive-v1' in v_submit) = 0
     or position('media.process_revision' in v_submit) = 0
     or position('video_master' in v_submit) = 0
     or position('video-adaptive-v1' in v_register) = 0
     or position('phase7b-v4a-v1' in v_register) = 0
     or position('single_file_byte_range' in v_register) = 0
  then
    raise exception
      'V4A verification failed: adaptive Video adapter contract drifted';
  end if;

  if exists (
    select 1
    from media.variants variant
    join media.file_objects file_row
      on file_row.id = variant.derived_file_object_id
    where variant.variant_role in (
      'video_hls_master',
      'video_hls_360p_playlist',
      'video_hls_360p_media',
      'video_hls_720p_playlist',
      'video_hls_720p_media'
    )
      and (
        file_row.verification_state is distinct from 'verified'
        or file_row.storage_provider is distinct from 'lightsail_media'
        or coalesce(file_row.storage_namespace, '')
             is distinct from 'lightsail-media'
        or file_row.storage_path !~
             '^derived-objects/[0-9a-f-]+/[0-9a-f-]+/video-adaptive-v1/[0-9a-f-]+/video_hls_.+[.](m3u8|ts)$'
        or file_row.delivery_url !~
             '^https://media[.]wakilisha[.]africa/derivatives/[0-9a-f-]+/[0-9a-f-]+/video-adaptive-v1/[0-9a-f-]+/video_hls_.+[.](m3u8|ts)$'
        or variant.generator_name is distinct from 'wakilisha-media-processor'
        or variant.generator_version is distinct from 'phase7b-v4a-v1'
        or variant.transformation_spec ->> 'profile'
             is distinct from 'video-adaptive-v1'
        or variant.transformation_spec ->> 'segment_mode'
             is distinct from 'single_file_byte_range'
        or nullif(
             variant.transformation_spec ->> 'hls_version',
             ''
           )::integer is distinct from 6
        or nullif(
             variant.transformation_spec ->> 'segment_seconds',
             ''
           )::integer is distinct from 4
        or (
          variant.variant_role like '%playlist'
          or variant.variant_role = 'video_hls_master'
        ) and file_row.mime_type
              is distinct from 'application/vnd.apple.mpegurl'
        or variant.variant_role like '%media'
           and file_row.mime_type is distinct from 'video/mp2t'
      )
  ) then
    raise exception
      'V4A verification failed: registered adaptive Video derivative authority is invalid';
  end if;

  if exists (
    select 1
    from (
      select
        selection.asset_revision_id,
        count(*) filter (
          where selection.variant_role in (
            'video_hls_master',
            'video_hls_360p_playlist',
            'video_hls_360p_media',
            'video_hls_720p_playlist',
            'video_hls_720p_media'
          )
        ) as selected_count,
        count(*) filter (
          where selection.variant_role = 'video_hls_master'
        ) as master_count
      from media.variant_selections selection
      where selection.variant_role in (
        'video_hls_master',
        'video_hls_360p_playlist',
        'video_hls_360p_media',
        'video_hls_720p_playlist',
        'video_hls_720p_media'
      )
      group by selection.asset_revision_id
    ) selected
    where selected.master_count > 0
      and selected.selected_count <> 5
  ) then
    raise exception
      'V4A verification failed: selected adaptive Video package is incomplete';
  end if;
end;
$phase_7b_v4a_verify$;

select
  'PASS: Phase 7B V4A adaptive Video Media processing authority is intact.'
    as verification_result;

rollback;
