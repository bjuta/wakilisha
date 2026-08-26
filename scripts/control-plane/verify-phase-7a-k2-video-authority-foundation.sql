-- Permanent read-only verifier for Phase 7A K2 Video authority foundation.

begin;
set local transaction read only;
set local statement_timeout = '120s';
set local lock_timeout = '5s';

do $verify_phase_7a_k2_video_authority_foundation$
declare
  v_count bigint;
  v_definition text;
  v_constraint_definition text;
begin
  if to_regnamespace('video') is null then
    raise exception
      'PHASE_7A_K2_FAIL: private Video schema is missing';
  end if;

  if exists (
    select 1
    from (
      values
        ('video.publication_classifications'),
        ('video.source_providers'),
        ('video.caption_track_kinds'),
        ('video.sources'),
        ('video.publications'),
        ('video.caption_tracks'),
        ('video.publication_chapters'),
        ('video.publication_versions'),
        ('video.publication_version_caption_tracks'),
        ('video.publication_version_chapters'),
        ('editorial.video_publication_resources'),
        ('editorial.video_episode_shared_links')
    ) required(relation_name)
    where to_regclass(required.relation_name) is null
  ) then
    raise exception
      'PHASE_7A_K2_FAIL: one or more Video authority relations are missing';
  end if;

  if (
    select count(*)
    from editorial.resource_kinds kind_row
    where kind_row.kind in ('standalone_video', 'video_episode')
      and kind_row.enabled
  ) <> 2 then
    raise exception
      'PHASE_7A_K2_FAIL: Video Resource kind vocabulary is incomplete';
  end if;

  select count(*)
  into v_count
  from information_schema.columns column_row
  where column_row.table_schema = 'editorial'
    and column_row.table_name = 'video_publication_resources';

  if v_count <> 3 then
    raise exception
      'PHASE_7A_K2_FAIL: Video Resource binding must contain exactly 3 identity columns, found %',
      v_count;
  end if;

  if exists (
    select 1
    from information_schema.columns column_row
    where column_row.table_schema = 'editorial'
      and column_row.table_name = 'video_publication_resources'
      and column_row.column_name in (
        'current_working_version_id',
        'current_submitted_version_id',
        'current_approved_version_id',
        'current_published_version_id'
      )
  ) then
    raise exception
      'PHASE_7A_K2_FAIL: Video renewed typed lifecycle-pointer mirrors';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid =
      'editorial.video_publication_resources'::regclass
      and constraint_row.conname =
        'video_publication_resources_resource_fkey'
      and constraint_row.contype = 'f'
      and constraint_row.confrelid = 'editorial.resources'::regclass
      and position(
        'FOREIGN KEY (resource_id, resource_kind) REFERENCES editorial.resources(id, resource_kind)'
        in pg_get_constraintdef(constraint_row.oid, true)
      ) > 0
  ) then
    raise exception
      'PHASE_7A_K2_FAIL: Video Resource binding does not use shared Resource identity';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid =
      'editorial.video_publication_resources'::regclass
      and trigger_row.tgname =
        'video_publication_resources_binding_integrity'
      and trigger_row.tgdeferrable
      and trigger_row.tginitdeferred
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'PHASE_7A_K2_FAIL: Video Resource binding integrity is not deferred';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid = 'video.publications'::regclass
      and trigger_row.tgname =
        'video_publications_episode_binding_integrity'
      and trigger_row.tgdeferrable
      and trigger_row.tginitdeferred
      and not trigger_row.tgisinternal
  )
  or not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid =
      'editorial.video_episode_shared_links'::regclass
      and trigger_row.tgname =
        'video_episode_shared_links_integrity'
      and trigger_row.tgdeferrable
      and trigger_row.tginitdeferred
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'PHASE_7A_K2_FAIL: shared Show Episode membership integrity is incomplete';
  end if;

  if not exists (
    select 1
    from editorial.resource_version_types type_row
    where type_row.version_type = 'video_publication_version'
      and type_row.source_table_schema = 'video'
      and type_row.source_table_name = 'publication_versions'
      and type_row.enabled
  )
  or (
    select count(*)
    from editorial.resource_version_type_kinds kind_row
    where kind_row.version_type = 'video_publication_version'
      and kind_row.resource_kind in ('standalone_video', 'video_episode')
  ) <> 2 then
    raise exception
      'PHASE_7A_K2_FAIL: Video Resource Version type registration is incomplete';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid = 'video.publication_versions'::regclass
      and trigger_row.tgname =
        'video_publication_versions_register_resource_version'
      and trigger_row.tgfoid =
        'editorial.register_typed_resource_version()'::regprocedure
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'PHASE_7A_K2_FAIL: Video versions do not register global Resource Version identity';
  end if;

  if exists (
    select 1
    from video.publication_versions version_row
    left join editorial.resource_versions global_row
      on global_row.id = version_row.id
     and global_row.resource_id = version_row.resource_id
     and global_row.version_type = 'video_publication_version'
     and global_row.version_kind = version_row.version_kind
     and global_row.version_number = version_row.version_number
     and global_row.content_fingerprint = version_row.content_fingerprint
    where global_row.id is null
  ) then
    raise exception
      'PHASE_7A_K2_FAIL: a typed Video version is missing its exact Resource Version envelope';
  end if;

  v_definition := pg_get_functiondef(
    'editorial.resolve_resource_version_identity(text,uuid)'::regprocedure
  );

  if position('video_publication_version' in v_definition) = 0
     or position('from video.publication_versions version' in v_definition) = 0
  then
    raise exception
      'PHASE_7A_K2_FAIL: shared Resource Version resolver does not understand Video';
  end if;

  select pg_get_constraintdef(constraint_row.oid, true)
  into v_constraint_definition
  from pg_constraint constraint_row
  where constraint_row.conrelid =
      'editorial.resource_version_editorial_metadata'::regclass
    and constraint_row.conname =
      'resource_version_editorial_metadata_target_version_type_check';

  if v_constraint_definition is null
     or position('video_publication_version' in v_constraint_definition) = 0
  then
    raise exception
      'PHASE_7A_K2_FAIL: shared Discovery metadata storage rejects Video versions';
  end if;

  select pg_get_constraintdef(constraint_row.oid, true)
  into v_constraint_definition
  from pg_constraint constraint_row
  where constraint_row.conrelid =
      'editorial.resource_version_taxonomy_terms'::regclass
    and constraint_row.conname =
      'resource_version_taxonomy_terms_target_version_type_check';

  if v_constraint_definition is null
     or position('video_publication_version' in v_constraint_definition) = 0
  then
    raise exception
      'PHASE_7A_K2_FAIL: shared Discovery taxonomy storage rejects Video versions';
  end if;

  if to_regprocedure(
       'editorial.materialize_video_resource_version_editorial_metadata()'
     ) is null
     or not exists (
       select 1
       from pg_trigger trigger_row
       where trigger_row.tgrelid = 'video.publication_versions'::regclass
         and trigger_row.tgname =
           'video_publication_versions_materialize_editorial_metadata'
         and not trigger_row.tgisinternal
     )
  then
    raise exception
      'PHASE_7A_K2_FAIL: Video Discovery materialization adapter is missing';
  end if;

  if exists (
    select 1
    from video.publication_versions version_row
    left join editorial.resource_version_editorial_metadata metadata_row
      on metadata_row.target_version_type = 'video_publication_version'
     and metadata_row.target_version_id = version_row.id
     and metadata_row.resource_id = version_row.resource_id
    where metadata_row.target_version_id is null
  ) then
    raise exception
      'PHASE_7A_K2_FAIL: a Video version is missing shared Discovery metadata identity';
  end if;

  select pg_get_constraintdef(constraint_row.oid, true)
  into v_definition
  from pg_constraint constraint_row
  where constraint_row.conrelid = 'media.usage_links'::regclass
    and constraint_row.conname = 'usage_links_target_authority_check'
    and constraint_row.contype = 'c';

  if v_definition is null
     or position('video' in v_definition) = 0
  then
    raise exception
      'PHASE_7A_K2_FAIL: Media usage storage does not accept Video target authority';
  end if;

  select pg_get_constraintdef(constraint_row.oid, true)
  into v_definition
  from pg_constraint constraint_row
  where constraint_row.conrelid = 'media.usage_links'::regclass
    and constraint_row.conname = 'usage_links_target_kind_check'
    and constraint_row.contype = 'c';

  if v_definition is null
     or position('video_publication' in v_definition) = 0
  then
    raise exception
      'PHASE_7A_K2_FAIL: Media usage storage does not accept Video publication targets';
  end if;

  if (
    select count(*)
    from media.usage_roles role_row
    where role_row.usage_role in (
      'video_master',
      'video_poster',
      'video_caption',
      'video_transcript'
    )
      and role_row.enabled
  ) <> 4 then
    raise exception
      'PHASE_7A_K2_FAIL: Video Media usage-role vocabulary is incomplete';
  end if;

  v_definition := pg_get_functiondef(
    'media.usage_role_matches_target(text,text,text)'::regprocedure
  );

  if position('video_master' in v_definition) = 0
     or position('video_poster' in v_definition) = 0
     or position('video_caption' in v_definition) = 0
     or position('video_transcript' in v_definition) = 0
     or position('video_publication' in v_definition) = 0
  then
    raise exception
      'PHASE_7A_K2_FAIL: Media usage-role target matching does not include Video';
  end if;

  v_definition := pg_get_functiondef(
    'media.validate_usage_target(uuid,text,text,uuid,text,uuid,boolean,boolean)'::regprocedure
  );

  if position('p_target_authority = ''video''' in v_definition) = 0
     or position('p_target_kind = ''video_publication''' in v_definition) = 0
     or position('p_target_version_kind <> ''video_publication_version''' in v_definition) = 0
     or position('editorial.current_user_can_edit_video' in v_definition) = 0
  then
    raise exception
      'PHASE_7A_K2_FAIL: generic Media target validation does not support Video correctly';
  end if;

  v_definition := pg_get_functiondef(
    'media.enforce_usage_link_integrity()'::regprocedure
  );

  if position('video_master' in v_definition) = 0
     or position('video_poster' in v_definition) = 0
     or position('video_caption' in v_definition) = 0
     or position('video_transcript' in v_definition) = 0
     or position('resolution_mode <> ''exact_revision''' in v_definition) = 0
  then
    raise exception
      'PHASE_7A_K2_FAIL: Video Media semantic integrity is incomplete';
  end if;

  if to_regclass('media.media_video_singleton_active_usage_key') is null then
    raise exception
      'PHASE_7A_K2_FAIL: singleton Video master/poster/transcript usage index is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid = 'video.publications'::regclass
      and trigger_row.tgname =
        'video_publications_selected_source_usage_integrity'
      and trigger_row.tgdeferrable
      and trigger_row.tginitdeferred
      and not trigger_row.tgisinternal
  )
  or not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid = 'media.usage_links'::regclass
      and trigger_row.tgname =
        'media_usage_video_master_selection_integrity'
      and trigger_row.tgdeferrable
      and trigger_row.tginitdeferred
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'PHASE_7A_K2_FAIL: selected native source and video_master agreement is not deferred across both authorities';
  end if;

  if exists (
    select 1
    from video.publications publication
    join video.sources source
      on source.id = publication.selected_source_id
    where source.source_kind = 'external_provider'
      and exists (
        select 1
        from media.usage_links usage
        where usage.target_authority = 'video'
          and usage.target_kind = 'video_publication'
          and usage.target_id = publication.id
          and usage.target_version_id is null
          and usage.usage_role = 'video_master'
          and usage.usage_state = 'active'
      )
  ) then
    raise exception
      'PHASE_7A_K2_FAIL: provider-backed Video carries a native master usage';
  end if;

  if exists (
    select 1
    from video.publications publication
    join video.sources source
      on source.id = publication.selected_source_id
    where source.source_kind = 'native_media'
      and not exists (
        select 1
        from media.usage_links usage
        where usage.target_authority = 'video'
          and usage.target_kind = 'video_publication'
          and usage.target_id = publication.id
          and usage.target_version_id is null
          and usage.usage_role = 'video_master'
          and usage.usage_state = 'active'
          and usage.resolution_mode = 'exact_revision'
          and usage.asset_id = source.media_asset_id
          and usage.asset_revision_id = source.media_asset_revision_id
      )
  ) then
    raise exception
      'PHASE_7A_K2_FAIL: native Video source and video_master usage diverged';
  end if;

  if exists (
    select 1
    from media.usage_links usage
    join media.assets asset
      on asset.id = usage.asset_id
    where usage.target_authority = 'video'
      and usage.target_kind = 'video_publication'
      and usage.usage_role in (
        'video_master',
        'video_poster',
        'video_caption',
        'video_transcript'
      )
      and (
        usage.resolution_mode <> 'exact_revision'
        or usage.asset_revision_id is null
        or (
          usage.usage_role = 'video_master'
          and asset.asset_kind <> 'video'
        )
        or (
          usage.usage_role = 'video_poster'
          and asset.asset_kind <> 'image'
        )
        or (
          usage.usage_role = 'video_caption'
          and asset.asset_kind <> 'caption'
        )
        or (
          usage.usage_role = 'video_transcript'
          and asset.asset_kind <> 'transcript'
        )
        or (
          usage.target_version_id is not null
          and usage.target_version_kind <> 'video_publication_version'
        )
      )
  ) then
    raise exception
      'PHASE_7A_K2_FAIL: stored Video Media usage violates exact typed semantics';
  end if;

  if exists (
    select 1
    from editorial.video_publication_resources binding
    join video.publications publication
      on publication.id = binding.publication_id
    where (
      publication.publication_kind = 'episode'
      and binding.resource_kind <> 'video_episode'
    )
    or (
      publication.publication_kind = 'standalone'
      and binding.resource_kind <> 'standalone_video'
    )
  ) then
    raise exception
      'PHASE_7A_K2_FAIL: Video publication and Resource kinds diverged';
  end if;

  if exists (
    select 1
    from video.publications publication
    left join editorial.video_episode_shared_links link
      on link.video_publication_id = publication.id
    group by publication.id, publication.publication_kind
    having (
      publication.publication_kind = 'episode'
      and count(link.video_publication_id) <> 1
    )
    or (
      publication.publication_kind = 'standalone'
      and count(link.video_publication_id) <> 0
    )
  ) then
    raise exception
      'PHASE_7A_K2_FAIL: Video Episode shared Show Episode membership is invalid';
  end if;

  if exists (
    select 1
    from video.publication_versions version_row
    join editorial.video_publication_resources binding
      on binding.resource_id = version_row.resource_id
     and binding.publication_id = version_row.publication_id
    left join editorial.video_episode_shared_links link
      on link.video_publication_id = version_row.publication_id
    left join editorial.show_episodes episode
      on episode.resource_id = link.show_episode_resource_id
    where (
      version_row.publication_kind = 'standalone'
      and (
        binding.resource_kind <> 'standalone_video'
        or version_row.show_resource_id is not null
        or version_row.show_episode_resource_id is not null
      )
    )
    or (
      version_row.publication_kind = 'episode'
      and (
        binding.resource_kind <> 'video_episode'
        or version_row.show_episode_resource_id is distinct from
          link.show_episode_resource_id
        or version_row.show_resource_id is distinct from
          episode.show_resource_id
      )
    )
  ) then
    raise exception
      'PHASE_7A_K2_FAIL: immutable Video version identity does not match typed/shared Resource identity';
  end if;

  if exists (
    select 1
    from video.caption_tracks track
    join media.assets asset
      on asset.id = track.media_asset_id
    join media.asset_revisions revision
      on revision.id = track.media_asset_revision_id
    join media.file_objects file_row
      on file_row.id = revision.original_file_object_id
    where asset.asset_kind <> 'caption'
      or revision.asset_id <> track.media_asset_id
      or file_row.verification_state <> 'verified'
  )
  or exists (
    select 1
    from video.publication_version_caption_tracks track
    join media.assets asset
      on asset.id = track.media_asset_id
    join media.asset_revisions revision
      on revision.id = track.media_asset_revision_id
    join media.file_objects file_row
      on file_row.id = revision.original_file_object_id
    where asset.asset_kind <> 'caption'
      or revision.asset_id <> track.media_asset_id
      or file_row.verification_state <> 'verified'
  ) then
    raise exception
      'PHASE_7A_K2_FAIL: Video caption semantics do not resolve to exact verified Caption Media';
  end if;

  if exists (
    select 1
    from (
      select
        chapter.publication_id as parent_id,
        chapter.chapter_number,
        chapter.start_seconds,
        count(*) over (
          partition by chapter.publication_id
        ) as chapter_count,
        min(chapter.chapter_number) over (
          partition by chapter.publication_id
        ) as min_number,
        max(chapter.chapter_number) over (
          partition by chapter.publication_id
        ) as max_number,
        lag(chapter.start_seconds) over (
          partition by chapter.publication_id
          order by chapter.chapter_number
        ) as prior_start
      from video.publication_chapters chapter
    ) ordered
    where ordered.min_number <> 1
      or ordered.max_number <> ordered.chapter_count
      or (
        ordered.prior_start is not null
        and ordered.start_seconds <= ordered.prior_start
      )
  )
  or exists (
    select 1
    from (
      select
        chapter.publication_version_id as parent_id,
        chapter.chapter_number,
        chapter.start_seconds,
        count(*) over (
          partition by chapter.publication_version_id
        ) as chapter_count,
        min(chapter.chapter_number) over (
          partition by chapter.publication_version_id
        ) as min_number,
        max(chapter.chapter_number) over (
          partition by chapter.publication_version_id
        ) as max_number,
        lag(chapter.start_seconds) over (
          partition by chapter.publication_version_id
          order by chapter.chapter_number
        ) as prior_start
      from video.publication_version_chapters chapter
    ) ordered
    where ordered.min_number <> 1
      or ordered.max_number <> ordered.chapter_count
      or (
        ordered.prior_start is not null
        and ordered.start_seconds <= ordered.prior_start
      )
  ) then
    raise exception
      'PHASE_7A_K2_FAIL: Video chapter ordering or timing integrity drifted';
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
    where resource_row.resource_kind in ('standalone_video', 'video_episode')
      and pointer.version_id is not null
      and version_row.version_type <> 'video_publication_version'
  ) then
    raise exception
      'PHASE_7A_K2_FAIL: Video Resource lifecycle points at the wrong typed Resource Version authority';
  end if;

  if (
    select count(*)
    from public.capability_definitions capability
    where capability.capability_key in (
      'view_video',
      'edit_own_video',
      'edit_others_video',
      'publish_video',
      'delete_video'
    )
  ) <> 5 then
    raise exception
      'PHASE_7A_K2_FAIL: Video capability vocabulary is incomplete';
  end if;

  if (
    select count(*)
    from platform_private.command_types command_row
    where command_row.command_type in (
      'video.source.register',
      'video.publication.create',
      'video.publication.metadata.update',
      'video.publication.source.set',
      'video.publication.show_episode.bind',
      'video.publication.poster.set',
      'video.publication.captions.replace',
      'video.publication.transcript.set',
      'video.publication.chapters.replace',
      'video.publication.version.snapshot_working'
    )
      and command_row.enabled
  ) <> 10 then
    raise exception
      'PHASE_7A_K2_FAIL: Video command vocabulary is incomplete';
  end if;

  if (
    select count(*)
    from pg_class table_row
    join pg_namespace schema_row
      on schema_row.oid = table_row.relnamespace
    where schema_row.nspname = 'video'
      and table_row.relkind = 'r'
      and table_row.relname in (
        'publication_classifications',
        'source_providers',
        'caption_track_kinds',
        'sources',
        'publications',
        'caption_tracks',
        'publication_chapters',
        'publication_versions',
        'publication_version_caption_tracks',
        'publication_version_chapters'
      )
      and table_row.relrowsecurity
  ) <> 10 then
    raise exception
      'PHASE_7A_K2_FAIL: one or more Video tables lack RLS defense in depth';
  end if;

  if (
    select count(*)
    from pg_class table_row
    join pg_namespace schema_row
      on schema_row.oid = table_row.relnamespace
    where schema_row.nspname = 'editorial'
      and table_row.relname in (
        'video_publication_resources',
        'video_episode_shared_links'
      )
      and table_row.relrowsecurity
  ) <> 2 then
    raise exception
      'PHASE_7A_K2_FAIL: Video editorial bindings lack RLS defense in depth';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants grant_row
    where (
      grant_row.table_schema = 'video'
      or (
        grant_row.table_schema = 'editorial'
        and grant_row.table_name in (
          'video_publication_resources',
          'video_episode_shared_links'
        )
      )
    )
      and grant_row.grantee in (
        'PUBLIC',
        'anon',
        'authenticated',
        'service_role'
      )
  ) then
    raise exception
      'PHASE_7A_K2_FAIL: direct Video table privilege leaked to application roles';
  end if;

  if exists (
    select 1
    from pg_proc function_row
    join pg_namespace schema_row
      on schema_row.oid = function_row.pronamespace
    where (
      (
        schema_row.nspname = 'video'
        and function_row.proname in (
          'enforce_source_integrity',
          'assert_publication_episode_binding_integrity',
          'enforce_caption_media_integrity',
          'assert_chapter_sequence_integrity',
          'enforce_publication_version_identity_integrity',
          'assert_selected_source_media_usage_integrity'
        )
      )
      or (
        schema_row.nspname = 'editorial'
        and function_row.proname in (
          'assert_video_publication_resource_kind_integrity',
          'materialize_video_resource_version_editorial_metadata',
          'current_user_can_view_video',
          'current_user_can_edit_video',
          'current_user_can_publish_video'
        )
      )
    )
      and (
        not function_row.prosecdef
        or not exists (
          select 1
          from unnest(
            coalesce(function_row.proconfig, '{}'::text[])
          ) setting(value)
          where setting.value like 'search_path=%'
        )
      )
  ) then
    raise exception
      'PHASE_7A_K2_FAIL: privileged Video helper security/search-path contract drifted';
  end if;

  if has_function_privilege(
       'anon',
       'editorial.current_user_can_edit_video(uuid)'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'editorial.current_user_can_edit_video(uuid)'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'editorial.current_user_can_edit_video(uuid)'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'video.enforce_source_integrity()'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'video.enforce_source_integrity()'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'video.enforce_source_integrity()'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'video.assert_selected_source_media_usage_integrity()'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'video.assert_selected_source_media_usage_integrity()'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'video.assert_selected_source_media_usage_integrity()'::regprocedure,
       'EXECUTE'
     )
  then
    raise exception
      'PHASE_7A_K2_FAIL: internal Video helper EXECUTE leaked to application roles';
  end if;

  if to_regclass('video.publication_review_events') is not null
     or to_regclass('video.review_events') is not null
  then
    raise exception
      'PHASE_7A_K2_FAIL: K2 invented typed Video Review event authority';
  end if;
end;
$verify_phase_7a_k2_video_authority_foundation$;

select
  'PHASE_7A_K2_VIDEO_AUTHORITY_FOUNDATION_PASS' as verification_result,
  (
    select count(*)
    from video.publications
  ) as video_publication_count,
  (
    select count(*)
    from video.publication_versions
  ) as video_version_count,
  (
    select count(*)
    from video.sources
  ) as video_source_count;

rollback;
