-- HISTORICAL CHECKPOINT VERIFIER ONLY.
-- This script proves the named migration checkpoint, not the current post-kernel end state.
-- For current authority use scripts/control-plane/verify-phase-7a-kernel-closure.sql.
begin;
set local transaction read only;
set local statement_timeout = '120s';
set local lock_timeout = '5s';

do $phase_7a_k4c_a3_verify$
declare
  v_count bigint;
begin
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
      'PHASE_7A_K4C_A3_FAIL: Audio typed pointer columns remain';
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
      'PHASE_7A_K4C_A3_FAIL: Audio binding identity column set drifted';
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
      'PHASE_7A_K4C_A3_FAIL: Audio typed pointer foreign key remains';
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
      'PHASE_7A_K4C_A3_FAIL: pointer compatibility trigger remains';
  end if;

  if to_regprocedure(
       'editorial.sync_resource_lifecycle_from_typed_binding()'
     ) is not null
     or to_regprocedure(
       'editorial.sync_typed_lifecycle_from_resource()'
     ) is not null
  then
    raise exception
      'PHASE_7A_K4C_A3_FAIL: pointer compatibility helper remains';
  end if;

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
       or pg_get_userbyid(procedure_row.proowner) <> 'postgres'
  ) then
    raise exception
      'PHASE_7A_K4C_A3_FAIL: A2 Audio business/RPC body or owner drifted';
  end if;

  if exists (
    select 1
    from (
      values
        (
          'public.archive_audio_publication(uuid,bigint,text,text,uuid)',
          true,
          'v',
          'search_path=pg_catalog, public, auth, editorial, platform_private, audio, extensions'
        ),
        (
          'audio.insert_current_publication_snapshot(uuid,bigint,text,uuid)',
          true,
          'v',
          'search_path=pg_catalog, audio, editorial, media, extensions'
        ),
        (
          'audio.publication_content_fingerprint(uuid)',
          false,
          's',
          'search_path=pg_catalog, audio, media, editorial, extensions'
        ),
        (
          'public.create_audio_publication(text,text,text,text,uuid,uuid,integer,text,text,jsonb,uuid)',
          true,
          'v',
          'search_path=pg_catalog, public, auth, editorial, platform_private, audio, extensions'
        ),
        (
          'public.get_public_audio_publication_m1(text)',
          true,
          's',
          'search_path=pg_catalog, public, editorial, audio, media'
        ),
        (
          'public.replace_audio_publication_version_citations(uuid,jsonb,bigint,text,uuid)',
          true,
          'v',
          'search_path=pg_catalog, auth, public, editorial, audio, platform_private, extensions'
        ),
        (
          'public.replace_audio_publication_version_credits(uuid,jsonb,bigint,text,uuid)',
          true,
          'v',
          'search_path=pg_catalog, auth, public, editorial, audio, platform_private, extensions'
        ),
        (
          'public.restore_audio_publication_from_archive(uuid,bigint,text,text,uuid)',
          true,
          'v',
          'search_path=pg_catalog, public, auth, editorial, platform_private, audio, extensions'
        ),
        (
          'public.save_resource_version_editorial_metadata(text,uuid,bigint,uuid[],uuid[],text,text,text[],text,text,uuid)',
          true,
          'v',
          'search_path=pg_catalog, public, auth, editorial, audio, platform_private, extensions'
        ),
        (
          'public.snapshot_audio_publication_working_version(uuid,bigint,text,uuid)',
          true,
          'v',
          'search_path=pg_catalog, public, auth, editorial, platform_private, audio, extensions'
        )
    ) expected(signature, security_definer, volatility, search_path_setting)
    join pg_proc procedure_row
      on procedure_row.oid = to_regprocedure(expected.signature)
    where procedure_row.prosecdef <> expected.security_definer
       or procedure_row.provolatile::text <> expected.volatility
       or not coalesce(procedure_row.proconfig, '{}'::text[])
            @> array[expected.search_path_setting]::text[]
  ) then
    raise exception
      'PHASE_7A_K4C_A3_FAIL: A2 Audio security/volatility/search_path perimeter drifted';
  end if;

  if exists (
    select 1
    from (
      values
        ('public.create_audio_publication(text,text,text,text,uuid,uuid,integer,text,text,jsonb,uuid)'),
        ('public.snapshot_audio_publication_working_version(uuid,bigint,text,uuid)'),
        ('public.archive_audio_publication(uuid,bigint,text,text,uuid)'),
        ('public.restore_audio_publication_from_archive(uuid,bigint,text,text,uuid)'),
        ('public.replace_audio_publication_version_citations(uuid,jsonb,bigint,text,uuid)'),
        ('public.replace_audio_publication_version_credits(uuid,jsonb,bigint,text,uuid)'),
        ('public.save_resource_version_editorial_metadata(text,uuid,bigint,uuid[],uuid[],text,text,text[],text,text,uuid)')
    ) signature(value)
    where has_function_privilege('public', signature.value, 'EXECUTE')
       or has_function_privilege('anon', signature.value, 'EXECUTE')
       or not has_function_privilege(
            'authenticated',
            signature.value,
            'EXECUTE'
          )
       or not has_function_privilege(
            'service_role',
            signature.value,
            'EXECUTE'
          )
  ) then
    raise exception
      'PHASE_7A_K4C_A3_FAIL: Audio mutation RPC execution perimeter drifted';
  end if;

  if has_function_privilege(
       'anon',
       'audio.insert_current_publication_snapshot(uuid,bigint,text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'audio.insert_current_publication_snapshot(uuid,bigint,text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'audio.insert_current_publication_snapshot(uuid,bigint,text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'audio.publication_content_fingerprint(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'audio.publication_content_fingerprint(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'audio.publication_content_fingerprint(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.get_public_audio_publication_m1(text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.get_public_audio_publication_m1(text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.get_public_audio_publication_m1(text)',
       'EXECUTE'
     )
  then
    raise exception
      'PHASE_7A_K4C_A3_FAIL: internal Audio helper execution leaked';
  end if;

  if exists (
    select 1
    from pg_proc procedure_row
    where procedure_row.prokind in ('f', 'p')
      and pg_get_functiondef(procedure_row.oid)
        ~ 'editorial[.]audio_publication_resources'
      and pg_get_functiondef(procedure_row.oid)
        ~ '(v_binding|binding|audio_binding)[.]current_(working|submitted|approved|published)_version_id'
  ) then
    raise exception
      'PHASE_7A_K4C_A3_FAIL: direct Audio typed pointer reader remains';
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
      'PHASE_7A_K4C_A3_FAIL: typed Audio pointer writer remains';
  end if;

  if exists (
    select 1
    from pg_proc procedure_row
    where procedure_row.prokind in ('f', 'p')
      and pg_get_functiondef(procedure_row.oid)
        ~* 'insert[[:space:]]+into[[:space:]]+audio[.]publication_(review|lifecycle)_events'
  ) then
    raise exception
      'PHASE_7A_K4C_A3_FAIL: typed Audio event writer exists';
  end if;

  if to_regclass('audio.publication_review_events') is null
     or to_regclass('audio.publication_lifecycle_events') is null
  then
    raise exception
      'PHASE_7A_K4C_A3_FAIL: typed Audio historical event compatibility is missing';
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
      'PHASE_7A_K4C_A3_FAIL: Playlist P3 pointer retirement regressed';
  end if;

  if exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgname =
            'playlist_resources_sync_shared_lifecycle'
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'PHASE_7A_K4C_A3_FAIL: Playlist pointer compatibility trigger returned';
  end if;

  if to_regclass('video.review_events') is not null
     or to_regclass('video.lifecycle_events') is not null
     or to_regclass('video.publication_review_events') is not null
     or to_regclass('video.publication_lifecycle_events') is not null
  then
    raise exception
      'PHASE_7A_K4C_A3_FAIL: typed Video event authority exists';
  end if;
end;
$phase_7a_k4c_a3_verify$;

select
  'PHASE_7A_K4C_A3_AUDIO_POINTER_COMPATIBILITY_RETIREMENT_PASS'
    as verification_result,
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'editorial'
      and table_name = 'audio_publication_resources'
      and column_name in (
        'current_working_version_id',
        'current_submitted_version_id',
        'current_approved_version_id',
        'current_published_version_id'
      )
  ) as audio_typed_pointer_column_count,
  (
    select count(*)
    from pg_trigger trigger_row
    where not trigger_row.tgisinternal
      and trigger_row.tgname in (
        'audio_publication_resources_sync_shared_lifecycle',
        'resources_sync_typed_lifecycle_compatibility'
      )
  ) as compatibility_trigger_count,
  (
    select count(*)
    from (
      values
        ('editorial.sync_resource_lifecycle_from_typed_binding()'),
        ('editorial.sync_typed_lifecycle_from_resource()')
    ) helper(signature)
    where to_regprocedure(helper.signature) is not null
  ) as compatibility_helper_count,
  (
    select count(*)
    from pg_proc procedure_row
    where procedure_row.prokind in ('f', 'p')
      and pg_get_functiondef(procedure_row.oid)
        ~ 'editorial[.]audio_publication_resources'
      and pg_get_functiondef(procedure_row.oid)
        ~ '(v_binding|binding|audio_binding)[.]current_(working|submitted|approved|published)_version_id'
  ) as business_typed_pointer_reader_count,
  (
    select count(*)
    from pg_proc procedure_row
    where procedure_row.prokind in ('f', 'p')
      and (
        pg_get_functiondef(procedure_row.oid)
          ~* 'update[[:space:]]+editorial[.]audio_publication_resources[[:space:][:print:]]{0,200}set[[:space:][:print:]]{0,200}current_(working|submitted|approved|published)_version_id'
        or pg_get_functiondef(procedure_row.oid)
          ~* 'insert[[:space:]]+into[[:space:]]+editorial[.]audio_publication_resources[[:space:]]*[(][^)]*current_(working|submitted|approved|published)_version_id'
      )
  ) as typed_pointer_writer_count;

rollback;
