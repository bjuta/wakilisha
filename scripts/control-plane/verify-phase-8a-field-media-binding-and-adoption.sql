-- Permanent read-only verifier for Phase 8A.2B Field Media binding and adoption.

begin;
set local transaction read only;
set local statement_timeout = '120s';
set local lock_timeout = '5s';

do $verify_phase_8a_2b$
declare
  v_definition text;
  v_constraint text;
  v_count bigint;
begin
  if to_regclass('editorial.field_submission_media_intakes') is null then
    raise exception
      'PHASE_8A_2B_FAIL: Field Media intake table is missing';
  end if;

  if (
    select count(*) from media.asset_purposes
    where asset_purpose = 'field_original' and enabled
  ) <> 1
  or (
    select count(*) from media.usage_roles
    where usage_role = 'field_original' and enabled
  ) <> 1
  then
    raise exception
      'PHASE_8A_2B_FAIL: field_original Media vocabulary is incomplete';
  end if;

  if media.usage_role_matches_target(
       'field_original', 'editorial', 'field_submission'
     ) is distinct from true
     or media.usage_role_matches_target(
       'field_original', 'editorial', 'article'
     ) is distinct from false
     or media.usage_role_matches_target(
       'other', 'editorial', 'field_submission'
     ) is distinct from false
  then
    raise exception
      'PHASE_8A_2B_FAIL: Field Media usage-role matching is too broad';
  end if;

  if media.usage_role_matches_target('article_hero','editorial','article') is distinct from true
     or media.usage_role_matches_target('article_inline','editorial','article') is distinct from true
     or media.usage_role_matches_target('playlist_cover','editorial','playlist') is distinct from true
     or media.usage_role_matches_target('chart_artwork','charts','chart_entry') is distinct from true
     or media.usage_role_matches_target('artist_portrait','registry','artist') is distinct from true
     or media.usage_role_matches_target('author_avatar','registry','author') is distinct from true
     or media.usage_role_matches_target('author_cover','registry','author') is distinct from true
     or media.usage_role_matches_target('release_artwork','registry','release') is distinct from true
     or media.usage_role_matches_target('track_artwork','registry','track') is distinct from true
     or media.usage_role_matches_target('guide_hero','guides','guide') is distinct from true
     or media.usage_role_matches_target('highlight_artwork','registry','highlight') is distinct from true
     or media.usage_role_matches_target('source_attachment','sources','source') is distinct from true
     or media.usage_role_matches_target('video_master','video','video_publication') is distinct from true
     or media.usage_role_matches_target('video_poster','video','video_publication') is distinct from true
     or media.usage_role_matches_target('video_caption','video','video_publication') is distinct from true
     or media.usage_role_matches_target('video_transcript','video','video_publication') is distinct from true
  then
    raise exception
      'PHASE_8A_2B_FAIL: predecessor Media usage-role matching drifted';
  end if;

  select pg_get_constraintdef(constraint_row.oid, true)
  into v_constraint
  from pg_constraint constraint_row
  where constraint_row.conrelid = 'media.usage_links'::regclass
    and constraint_row.conname = 'usage_links_target_kind_check';

  if v_constraint is null
     or position('field_submission' in v_constraint) = 0
     or position('video_publication' in v_constraint) = 0
     or position('audio_publication' in v_constraint) = 0
  then
    raise exception
      'PHASE_8A_2B_FAIL: Media target storage vocabulary drifted';
  end if;

  v_definition := pg_get_functiondef(
    'media.validate_usage_target(uuid,text,text,uuid,text,uuid,boolean,boolean)'::regprocedure
  );

  if position('field_submission' in v_definition) = 0
     or position('editorial.user_has_field_capability_v1' in v_definition) = 0
     or position('p_target_authority = ''video''' in v_definition) = 0
     or position('p_target_kind = ''video_publication''' in v_definition) = 0
     or position('editorial.current_user_can_edit_video' in v_definition) = 0
  then
    raise exception
      'PHASE_8A_2B_FAIL: Media target validator lost predecessor support or Field extension';
  end if;

  if md5(pg_get_functiondef(
       'public.create_media_upload_session_v2(text,text,text,bigint,text,integer,uuid)'::regprocedure
     )) <> '2a8f50b8775563fa99f9348ccdb4e250'
     or md5(pg_get_functiondef(
       'public.attach_media_usage(uuid,text,text,text,uuid,text,uuid,text,uuid,jsonb,integer,text,text,text,uuid)'::regprocedure
     )) <> 'eb7ad07f8bed953a4da4e50f6776bb33'
     or md5(pg_get_functiondef(
       'public.adopt_verified_media_upload_session_v1(uuid,text,text,uuid,uuid)'::regprocedure
     )) <> '75ac38d001edec77802d5e7525dd6daf'
     or md5(pg_get_functiondef(
       'public.cancel_media_upload_session_v1(uuid,text)'::regprocedure
     )) <> '8433654899bfa8cd6c2eddbff378a846'
     or md5(pg_get_functiondef(
       'public.verify_media_upload_session_v1(uuid,text,bigint,text,uuid)'::regprocedure
     )) <> 'e93620ff030b1102372291b880d9c010'
     or md5(pg_get_functiondef(
       'public.expire_media_upload_session_v1(uuid,text)'::regprocedure
     )) <> 'f9921bbc7097d126d51f5090d60c26d1'
     or md5(pg_get_functiondef(
       'public.fail_media_upload_session_v1(uuid,text)'::regprocedure
     )) <> 'b0520b2469e7894e1f3386f4b5a20d36'
  then
    raise exception
      'PHASE_8A_2B_FAIL: existing Media admin/receiver workflow definitions changed';
  end if;

  select count(*)
  into v_count
  from information_schema.columns column_row
  where column_row.table_schema = 'editorial'
    and column_row.table_name = 'field_submission_media_intakes';

  if v_count <> 16 then
    raise exception
      'PHASE_8A_2B_FAIL: Field Media intake column count is %, expected 16',
      v_count;
  end if;

  if exists (
    select 1
    from information_schema.columns column_row
    where column_row.table_schema = 'editorial'
      and column_row.table_name = 'field_submission_media_intakes'
      and column_row.column_name in (
        'storage_path',
        'expected_sha256',
        'sha256',
        'expected_byte_size',
        'byte_size',
        'mime_type',
        'original_filename',
        'file_object_id'
      )
  ) then
    raise exception
      'PHASE_8A_2B_FAIL: Field intake duplicated canonical Media file facts';
  end if;

  if exists (
    select 1
    from (
      values
        ('field_submission_media_intakes_submission_fkey', 'editorial.field_submissions'::regclass),
        ('field_submission_media_intakes_upload_session_fkey', 'media.upload_sessions'::regclass),
        ('field_submission_media_intakes_usage_link_fkey', 'media.usage_links'::regclass),
        ('field_submission_events_media_intake_fkey', 'editorial.field_submission_media_intakes'::regclass)
    ) expected(constraint_name, referenced_relation)
    where not exists (
      select 1
      from pg_constraint constraint_row
      where constraint_row.conname = expected.constraint_name
        and constraint_row.confrelid = expected.referenced_relation
        and constraint_row.confdeltype = 'r'
    )
  ) then
    raise exception
      'PHASE_8A_2B_FAIL: Field Media foreign keys are missing or unsafe';
  end if;

  if exists (
    select 1
    from (
      values
        ('field_submission_media_intakes_one_inflight_slot_idx'),
        ('field_submission_media_intakes_one_adopted_slot_idx'),
        ('field_submission_media_intakes_submission_updated_idx'),
        ('field_submission_media_intakes_upload_session_idx'),
        ('media_field_original_active_slot_key')
    ) expected(index_name)
    where not exists (
      select 1
      from pg_indexes actual
      where actual.indexname = expected.index_name
    )
  ) then
    raise exception
      'PHASE_8A_2B_FAIL: Field Media indexes are incomplete';
  end if;

  if not exists (
    select 1 from pg_trigger trigger_row
    where trigger_row.tgrelid =
      'editorial.field_submission_media_intakes'::regclass
      and trigger_row.tgname =
        'field_submission_media_intakes_protect_mutation'
      and not trigger_row.tgisinternal
  )
  or not exists (
    select 1 from pg_trigger trigger_row
    where trigger_row.tgrelid = 'media.assets'::regclass
      and trigger_row.tgname = 'media_assets_field_original_protection'
      and not trigger_row.tgisinternal
  )
  or not exists (
    select 1 from pg_trigger trigger_row
    where trigger_row.tgrelid = 'media.usage_links'::regclass
      and trigger_row.tgname = 'media_usage_field_original_protection'
      and not trigger_row.tgisinternal
  )
  or not exists (
    select 1 from pg_trigger trigger_row
    where trigger_row.tgrelid =
      'media.asset_governance_versions'::regclass
      and trigger_row.tgname =
        'media_governance_field_original_protection'
      and not trigger_row.tgisinternal
  )
  then
    raise exception
      'PHASE_8A_2B_FAIL: Field Media protection triggers are incomplete';
  end if;

  v_definition := pg_get_functiondef(
    'media.protect_field_original_asset_v1()'::regprocedure
  );

  if position('new.current_revision_id is distinct from old.current_revision_id' in v_definition) = 0
     or position('new.current_governance_version_id' in v_definition) = 0
     or position('old.current_revision_id is null' in v_definition) = 0
     or position('old.current_governance_version_id is null' in v_definition) = 0
     or position('old.authority_revision = 1' in v_definition) = 0
     or position('new.authority_revision = 2' in v_definition) = 0
     or position('new.lifecycle_state <> ''active''' in v_definition) = 0
     or position('new.compatibility_folder_id is not null' in v_definition) = 0
  then
    raise exception
      'PHASE_8A_2B_FAIL: protected Field original initial activation or later immutability can drift';
  end if;

  v_definition := pg_get_functiondef(
    'media.protect_field_original_usage_v1()'::regprocedure
  );

  if position('Field original Media usage is immutable' in v_definition) = 0
  then
    raise exception
      'PHASE_8A_2B_FAIL: protected Field original usage lifecycle can drift';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants grant_row
    where grant_row.table_schema = 'editorial'
      and grant_row.table_name = 'field_submission_media_intakes'
      and grant_row.grantee in (
        'PUBLIC', 'anon', 'authenticated', 'service_role'
      )
  ) then
    raise exception
      'PHASE_8A_2B_FAIL: application role has direct Field Media intake table authority';
  end if;

  if exists (
    select 1
    from public.role_capabilities
    where role_key = 'field_contributor'
      and capability_key in (
        'manage_media_assets',
        'manage_media_usage',
        'view_media_records',
        'review_media_governance'
      )
  ) then
    raise exception
      'PHASE_8A_2B_FAIL: field_contributor received forbidden Media authority';
  end if;

  if (
    select count(*)
    from platform_private.command_types
    where command_type in (
      'field.submission.create',
      'field.submission.declarations.update',
      'field.submission.media.start',
      'field.submission.media.adopt',
      'field.submission.finalize',
      'field.submission.cancel'
    )
      and enabled
  ) <> 6 then
    raise exception
      'PHASE_8A_2B_FAIL: complete Field command vocabulary is not enabled';
  end if;

  if to_regprocedure(
       'public.create_field_media_upload_session_v1(uuid,bigint,integer,text,text,bigint,text,text,integer,uuid)'
     ) is null
     or to_regprocedure(
       'public.adopt_verified_field_media_upload_session_v1(uuid,bigint,uuid,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.finalize_field_submission_v1(uuid,bigint,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.get_field_media_receiver_session_v1(uuid,uuid,uuid)'
     ) is null
     or to_regprocedure(
       'public.record_field_media_upload_resume_v1(uuid,uuid,uuid,uuid)'
     ) is null
     or to_regprocedure(
       'public.sync_field_media_intake_v1(uuid,uuid,uuid,uuid)'
     ) is null
  then
    raise exception
      'PHASE_8A_2B_FAIL: Field Media or receipt RPC authority is incomplete';
  end if;

  if has_function_privilege(
       'anon',
       'public.create_field_media_upload_session_v1(uuid,bigint,integer,text,text,bigint,text,text,integer,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.create_field_media_upload_session_v1(uuid,bigint,integer,text,text,bigint,text,text,integer,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.create_field_media_upload_session_v1(uuid,bigint,integer,text,text,bigint,text,text,integer,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.adopt_verified_field_media_upload_session_v1(uuid,bigint,uuid,text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.adopt_verified_field_media_upload_session_v1(uuid,bigint,uuid,text,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.adopt_verified_field_media_upload_session_v1(uuid,bigint,uuid,text,uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'PHASE_8A_2B_FAIL: Field browser command grants are unsafe';
  end if;

  if has_function_privilege(
       'authenticated',
       'public.get_field_media_receiver_session_v1(uuid,uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.get_field_media_receiver_session_v1(uuid,uuid,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.get_field_media_receiver_session_v1(uuid,uuid,uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'PHASE_8A_2B_FAIL: Field receiver metadata hook grant boundary is unsafe';
  end if;

  v_definition := pg_get_functiondef(
    'public.create_field_media_upload_session_v1(uuid,bigint,integer,text,text,bigint,text,text,integer,uuid)'::regprocedure
  );

  if position('media.create_field_video_upload_session_v1' in v_definition) = 0
     or position('platform_private.begin_authenticated_resource_command' in v_definition) = 0
     or position('platform_private.complete_resource_command' in v_definition) = 0
  then
    raise exception
      'PHASE_8A_2B_FAIL: Field Media start lost helper composition or receipt authority';
  end if;

  v_definition := pg_get_functiondef(
    'media.create_field_video_upload_session_v1(uuid,uuid,integer,integer,text,text,text,bigint,text,integer,uuid)'::regprocedure
  );

  if position('video/%' in v_definition) = 0
     or position('''mp4''' in v_definition) = 0
     or position('''mov''' in v_definition) = 0
     or position('''m4v''' in v_definition) = 0
     or position('''webm''' in v_definition) = 0
     or position('''mkv''' in v_definition) = 0
     or position('2147483648' in v_definition) = 0
     or position('8388608' in v_definition) = 0
     or position('p_ttl_seconds not between 300 and 86400' in v_definition) = 0
     or position('''masters/video/''' in v_definition) = 0
     or position('editorial.assert_field_media_actor_v1' in v_definition) = 0
  then
    raise exception
      'PHASE_8A_2B_FAIL: Field video upload helper lost accepted Media session limits';
  end if;

  v_definition := pg_get_functiondef(
    'public.adopt_verified_field_media_upload_session_v1(uuid,bigint,uuid,text,uuid)'::regprocedure
  );

  if position('media.create_protected_field_original_v1' in v_definition) = 0
     or position('v_field.submission_state not in (''receiving'', ''received'')' in v_definition) = 0
     or position('if v_field.submission_state = ''receiving'' then' in v_definition) = 0
     or position('submission_state = ''received''' in v_definition) = 0
     or position('current_revision = field.current_revision + 1' in v_definition) = 0
     or position('submit_media_processing_command_v1' in v_definition) > 0
     or position('registry_media_assets' in v_definition) > 0
  then
    raise exception
      'PHASE_8A_2B_FAIL: Field adoption lost protected semantics or gained forbidden work';
  end if;

  v_definition := pg_get_functiondef(
    'media.create_protected_field_original_v1(uuid,uuid,integer,uuid,text,text,text,text,timestamptz,uuid)'::regprocedure
  );

  if position('''needs_clearance''' in v_definition) = 0
     or position('''unknown''' in v_definition) = 0
     or position('''internal''' in v_definition) = 0
     or position('''preservation_candidate''' in v_definition) = 0
     or position('''field_original''' in v_definition) = 0
  then
    raise exception
      'PHASE_8A_2B_FAIL: protected Field original governance is not conservative';
  end if;

  v_definition := pg_get_functiondef(
    'public.finalize_field_submission_v1(uuid,bigint,text,uuid)'::regprocedure
  );

  if position('submission_state = ''submitted''' in v_definition) = 0
     or position('field_media_intake_in_progress' in v_definition) = 0
     or position('count(*) filter (where intake.slot_number = 1)' in v_definition) = 0
     or position('submission_finalized' in v_definition) = 0
     or position('receipt_issued' in v_definition) = 0
     or position('We received your submission for review.' in v_definition) = 0
  then
    raise exception
      'PHASE_8A_2B_FAIL: final submission or safe receipt authority is incomplete';
  end if;

  if pg_get_function_identity_arguments(
       'public.cancel_field_submission_v1(uuid,bigint,text,text,uuid)'::regprocedure
     ) <> 'p_submission_resource_id uuid, p_expected_current_revision bigint, p_idempotency_key text, p_reason text, p_correlation_id uuid'
     or pg_get_function_arguments(
       'public.cancel_field_submission_v1(uuid,bigint,text,text,uuid)'::regprocedure
     ) <> 'p_submission_resource_id uuid, p_expected_current_revision bigint, p_idempotency_key text, p_reason text DEFAULT NULL::text, p_correlation_id uuid DEFAULT NULL::uuid'
  then
    raise exception
      'PHASE_8A_2B_FAIL: cancellation RPC parameter identity drifted from Phase 8A.2A';
  end if;

  v_definition := pg_get_functiondef(
    'public.cancel_field_submission_v1(uuid,bigint,text,text,uuid)'::regprocedure
  );

  if position('media.cancel_field_upload_session_v1' in v_definition) = 0
     or position('field_cancellation_after_verified_media_not_allowed' in v_definition) = 0
     or position('for v_attempt in' in v_definition) = 0
     or position('current_revision = field.current_revision + 1' in v_definition) = 0
  then
    raise exception
      'PHASE_8A_2B_FAIL: cancellation does not preserve verified or adopted Media';
  end if;

  v_definition := pg_get_functiondef(
    'public.get_my_field_submission_v1(uuid)'::regprocedure
  );

  if position('field_submission_media_intakes' in v_definition) = 0
     or position('storage_path' in v_definition) > 0
     or position('expected_sha256' in v_definition) > 0
     or position('capability_token' in lower(v_definition)) > 0
     or position('delivery_url' in v_definition) > 0
  then
    raise exception
      'PHASE_8A_2B_FAIL: contributor read leaks protected receiver facts';
  end if;

  if exists (
    select 1
    from media.usage_links usage
    join media.assets asset
      on asset.id = usage.asset_id
    join media.asset_revisions revision
      on revision.id = usage.asset_revision_id
     and revision.asset_id = asset.id
    join media.file_objects file_object
      on file_object.id = revision.original_file_object_id
    join media.asset_governance_versions governance
      on governance.id = asset.current_governance_version_id
     and governance.asset_id = asset.id
    where usage.target_authority = 'editorial'
      and usage.target_kind = 'field_submission'
      and (
        usage.usage_role <> 'field_original'
        or usage.resolution_mode <> 'exact_revision'
        or usage.asset_revision_id is null
        or usage.target_version_id is not null
        or usage.target_version_kind is not null
        or asset.asset_purpose <> 'field_original'
        or asset.asset_kind <> 'video'
        or file_object.verification_state <> 'verified'
        or governance.rights_status <> 'needs_clearance'
        or governance.consent_status <> 'unknown'
        or governance.public_safety_state <> 'internal'
        or governance.source_protection_class not in (
          'internal', 'restricted', 'confidential'
        )
      )
  ) then
    raise exception
      'PHASE_8A_2B_FAIL: stored Field Media usage violates protected exact-revision semantics';
  end if;

  if exists (
    select 1
    from editorial.field_submission_media_intakes intake
    join media.upload_sessions session_row
      on session_row.id = intake.media_upload_session_id
    left join media.usage_links usage
      on usage.id = intake.usage_link_id
    left join media.asset_revisions revision
      on revision.id = usage.asset_revision_id
    where intake.created_by <> session_row.actor_id
       or (
         intake.intake_state = 'adopted'
         and (
           usage.id is null
           or usage.target_id <> intake.submission_resource_id
           or (usage.placement_data ->> 'slot_number')::integer <> intake.slot_number
           or revision.original_file_object_id <> session_row.file_object_id
         )
       )
  ) then
    raise exception
      'PHASE_8A_2B_FAIL: Field intake, Media session, usage, or file identity diverged';
  end if;

  if exists (
    select 1
    from editorial.resource_versions
    where resource_kind = 'field_submission'
  )
  or exists (
    select 1
    from editorial.resource_aliases alias
    join editorial.resources resource_row
      on resource_row.id = alias.resource_id
    where resource_row.resource_kind = 'field_submission'
  )
  then
    raise exception
      'PHASE_8A_2B_FAIL: Field Submission gained a Resource Version or public route';
  end if;

  raise notice
    'PHASE 8A.2B FIELD MEDIA BINDING + ADOPTION VERIFIER: PASS';
end;
$verify_phase_8a_2b$;

rollback;
