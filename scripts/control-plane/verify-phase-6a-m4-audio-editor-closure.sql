-- Permanent read-only verifier for the final Phase 6A Audio Editor closure.
do $verify_phase_6a_m4_audio_editor_closure$
declare
  v_fingerprint text;
  v_snapshot text;
  v_copy text;
  v_media_gate text;
  v_admin_list text;
  v_generic_media_validator text;
  v_trust_guard text;
  v_bad_transcripts bigint;
  v_bad_chapters bigint;
  v_bad_trust bigint;
  v_bad_generic_pointers bigint;
  v_public_audio_grants bigint;
begin
  if to_regclass('audio.publication_chapters') is null
     or to_regclass('audio.publication_version_chapters') is null
     or to_regclass('editorial.audio_publication_version_trust_revisions') is null
  then
    raise exception 'FAIL: final Phase 6A Audio chapter or Trust tables are missing';
  end if;

  if not exists (
    select 1
    from media.usage_roles
    where usage_role = 'audio_transcript'
      and enabled
  ) then
    raise exception 'FAIL: audio_transcript Media usage role is missing';
  end if;

  if exists (
    select 1
    from (
      values
        ('audio.publication.transcript.set'),
        ('audio.publication.chapters.replace'),
        ('audio.publication.trust.citations.replace'),
        ('audio.publication.trust.credits.replace')
    ) required(command_type)
    where not exists (
      select 1
      from platform_private.command_types command_row
      where command_row.command_type = required.command_type
        and command_row.enabled
    )
  ) then
    raise exception 'FAIL: one or more final Phase 6A Audio command types are missing';
  end if;

  if exists (
    select 1
    from (
      values
        ('transcript_media_asset_id'),
        ('transcript_media_revision_id')
    ) required(column_name)
    where not exists (
      select 1
      from information_schema.columns column_row
      where column_row.table_schema = 'audio'
        and column_row.table_name = 'publication_versions'
        and column_row.column_name = required.column_name
    )
  ) then
    raise exception 'FAIL: immutable Audio transcript identity columns are incomplete';
  end if;

  if to_regprocedure('audio.current_publication_transcript(uuid)') is null
     or to_regprocedure('public.set_audio_publication_transcript(uuid,bigint,uuid,uuid,text,uuid)') is null
     or to_regprocedure('public.replace_audio_publication_chapters(uuid,bigint,jsonb,text,uuid)') is null
     or to_regprocedure('public.replace_audio_publication_version_citations(uuid,jsonb,bigint,text,uuid)') is null
     or to_regprocedure('public.replace_audio_publication_version_credits(uuid,jsonb,bigint,text,uuid)') is null
     or to_regprocedure('public.list_admin_audio_publications()') is null
     or to_regprocedure('public.get_admin_audio_publication_workspace(uuid)') is null
     or to_regprocedure('editorial.copy_audio_version_trust_to_version(uuid,uuid)') is null
  then
    raise exception 'FAIL: one or more final Phase 6A Audio functions are missing';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid = 'media.usage_links'::regclass
      and trigger_row.tgname = 'audio_transcript_usage_governed_mutation'
      and not trigger_row.tgisinternal
  ) or not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid = 'audio.publication_chapters'::regclass
      and trigger_row.tgname = 'audio_publication_chapters_governed_mutation'
      and not trigger_row.tgisinternal
  ) or not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid = 'audio.publication_version_chapters'::regclass
      and trigger_row.tgname = 'audio_publication_version_chapters_immutable'
      and not trigger_row.tgisinternal
  ) or not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid = 'editorial.resource_citations'::regclass
      and trigger_row.tgname = 'resource_citations_audio_immutable_guard'
      and not trigger_row.tgisinternal
  ) or not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid = 'editorial.resource_credits'::regclass
      and trigger_row.tgname = 'resource_credits_audio_immutable_guard'
      and not trigger_row.tgisinternal
  ) then
    raise exception 'FAIL: one or more final Phase 6A governed-mutation guards are missing';
  end if;

  if has_function_privilege(
       'anon',
       'public.list_admin_audio_publications()'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.get_admin_audio_publication_workspace(uuid)'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.set_audio_publication_transcript(uuid,bigint,uuid,uuid,text,uuid)'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.replace_audio_publication_chapters(uuid,bigint,jsonb,text,uuid)'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.replace_audio_publication_version_citations(uuid,jsonb,bigint,text,uuid)'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.replace_audio_publication_version_credits(uuid,jsonb,bigint,text,uuid)'::regprocedure,
       'EXECUTE'
     )
  then
    raise exception 'FAIL: anon can execute one or more final Phase 6A Audio SECURITY DEFINER endpoints';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.list_admin_audio_publications()'::regprocedure,
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.get_admin_audio_publication_workspace(uuid)'::regprocedure,
       'EXECUTE'
     )
  then
    raise exception 'FAIL: authenticated Audio Editor read access is not explicitly granted';
  end if;

  if has_function_privilege(
       'authenticated',
       'audio.current_publication_transcript(uuid)'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'editorial.copy_audio_version_trust_to_version(uuid,uuid)'::regprocedure,
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.begin_audio_trust_copy_authorization(uuid,uuid)'::regprocedure,
       'EXECUTE'
     )
  then
    raise exception 'FAIL: internal final Phase 6A Audio helpers remain directly executable by authenticated';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid = 'editorial.resource_citations'::regclass
      and constraint_row.conname = 'resource_citations_resource_kind_check'
      and pg_get_constraintdef(constraint_row.oid) like '%audio_episode%'
      and pg_get_constraintdef(constraint_row.oid) like '%standalone_audio%'
  ) or not exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid = 'editorial.resource_citations'::regclass
      and constraint_row.conname = 'resource_citations_target_type_check'
      and pg_get_constraintdef(constraint_row.oid) like '%audio_publication_version%'
  ) or not exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid = 'editorial.resource_credits'::regclass
      and constraint_row.conname = 'resource_credits_resource_kind_check'
      and pg_get_constraintdef(constraint_row.oid) like '%audio_episode%'
      and pg_get_constraintdef(constraint_row.oid) like '%standalone_audio%'
  ) or not exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.conrelid = 'editorial.resource_credits'::regclass
      and constraint_row.conname = 'resource_credits_target_type_check'
      and pg_get_constraintdef(constraint_row.oid) like '%audio_publication_version%'
  ) then
    raise exception 'FAIL: shared Trust storage does not admit typed Audio publication versions';
  end if;

  v_fingerprint :=
    pg_get_functiondef('audio.publication_content_fingerprint(uuid)'::regprocedure);
  v_snapshot :=
    pg_get_functiondef('audio.insert_current_publication_snapshot(uuid,bigint,text,uuid)'::regprocedure);
  v_copy :=
    pg_get_functiondef('audio.copy_publication_version_snapshot(uuid,text,text,uuid)'::regprocedure);
  v_media_gate :=
    pg_get_functiondef('audio.assert_publishable_version_media(uuid)'::regprocedure);
  v_admin_list :=
    pg_get_functiondef('public.list_admin_audio_publications()'::regprocedure);
  v_generic_media_validator :=
    pg_get_functiondef('media.validate_usage_target(uuid,text,text,uuid,text,uuid,boolean,boolean)'::regprocedure);
  v_trust_guard :=
    pg_get_functiondef('editorial.assert_resource_version_trust_attachment()'::regprocedure);

  if position('transcript_media_asset_id' in v_fingerprint) = 0
     or position('transcript_media_revision_id' in v_fingerprint) = 0
     or position('publication_chapters' in v_fingerprint) = 0
     or position('publication_version_chapters' in v_snapshot) = 0
     or position('copy_audio_version_trust_to_version' in v_snapshot) = 0
     or position('publication_version_chapters' in v_copy) = 0
     or position('copy_audio_version_trust_to_version' in v_copy) = 0
  then
    raise exception 'FAIL: Audio immutable snapshots no longer freeze transcript, chapters, or Trust';
  end if;

  if position('transcript_media_asset_id' in v_media_gate) = 0
     or position('approved_public' in v_media_gate) = 0
     or position('approved_redacted' in v_media_gate) = 0
     or position('Transcript Media is not approved' in v_media_gate) = 0
  then
    raise exception 'FAIL: optional Transcript Media is not rechecked for public safety';
  end if;

  if position('audio_publication' in v_generic_media_validator) > 0 then
    raise exception 'FAIL: generic Media target validation was broadened to Audio';
  end if;

  if position('audio_publication_version' in v_trust_guard) = 0
     or position('audio_episode' in v_trust_guard) = 0
     or position('standalone_audio' in v_trust_guard) = 0
  then
    raise exception 'FAIL: shared Trust attachment integrity does not understand Audio';
  end if;

  if position('resource_row.owner_id = v_actor' in v_admin_list) = 0
     or position('edit_own_audio' in v_admin_list) = 0
     or position('edit_others_audio' in v_admin_list) = 0
  then
    raise exception 'FAIL: Audio admin list read model is not owner-scoped for edit-own users';
  end if;

  select count(*)
  into v_bad_transcripts
  from audio.publication_versions version_row
  left join media.assets asset
    on asset.id = version_row.transcript_media_asset_id
  left join media.asset_revisions revision
    on revision.id = version_row.transcript_media_revision_id
   and revision.asset_id = version_row.transcript_media_asset_id
  where version_row.transcript_media_asset_id is not null
    and (
      asset.asset_kind is distinct from 'transcript'
      or revision.id is null
    );

  if v_bad_transcripts <> 0 then
    raise exception 'FAIL: % Audio version transcript identities are invalid', v_bad_transcripts;
  end if;

  select count(*)
  into v_bad_chapters
  from audio.publication_version_chapters chapter
  join audio.publication_versions version_row
    on version_row.id = chapter.publication_version_id
  where chapter.chapter_number < 1
     or chapter.start_seconds < 0
     or nullif(btrim(chapter.title), '') is null
     or exists (
       select 1
       from audio.publication_version_chapters prior
       where prior.publication_version_id = chapter.publication_version_id
         and prior.chapter_number < chapter.chapter_number
         and prior.start_seconds >= chapter.start_seconds
     );

  if v_bad_chapters <> 0 then
    raise exception 'FAIL: % immutable Audio chapter rows are invalid', v_bad_chapters;
  end if;

  select count(*)
  into v_bad_trust
  from (
    select attachment.id
    from editorial.resource_citations attachment
    left join audio.publication_versions version_row
      on version_row.id = attachment.target_version_id
    where attachment.target_version_type = 'audio_publication_version'
      and (
        attachment.resource_kind not in ('audio_episode','standalone_audio')
        or version_row.id is null
        or version_row.resource_id <> attachment.resource_id
      )
    union all
    select attachment.id
    from editorial.resource_credits attachment
    left join audio.publication_versions version_row
      on version_row.id = attachment.target_version_id
    where attachment.target_version_type = 'audio_publication_version'
      and (
        attachment.resource_kind not in ('audio_episode','standalone_audio')
        or version_row.id is null
        or version_row.resource_id <> attachment.resource_id
      )
  ) bad;

  if v_bad_trust <> 0 then
    raise exception 'FAIL: % Audio Trust attachments do not match their immutable version identity', v_bad_trust;
  end if;

  select count(*)
  into v_bad_generic_pointers
  from editorial.resources resource_row
  where resource_row.resource_kind in (
    'audio_show',
    'audio_season',
    'audio_episode',
    'standalone_audio'
  )
    and (
      resource_row.current_working_version_id is not null
      or resource_row.current_submitted_version_id is not null
      or resource_row.current_approved_version_id is not null
      or resource_row.current_published_version_id is not null
    );

  if v_bad_generic_pointers <> 0 then
    raise exception 'FAIL: Audio wrote into Article-only generic Resource version pointers';
  end if;

  select count(*)
  into v_public_audio_grants
  from information_schema.table_privileges privilege
  where privilege.table_schema = 'audio'
    and privilege.grantee in ('PUBLIC','anon','authenticated');

  if v_public_audio_grants <> 0 then
    raise exception 'FAIL: direct public/authenticated Audio table grants remain';
  end if;

  raise notice 'PASS: final Phase 6A Audio Editor, Chapters, Transcript, and Trust authority is intact.';
end;
$verify_phase_6a_m4_audio_editor_closure$;
