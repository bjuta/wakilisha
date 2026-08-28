begin;
set local transaction read only;
set local statement_timeout = '120s';
set local lock_timeout = '5s';

do $phase_7a_k4c_a2_verify$
declare
  v_definition text;
  v_count bigint;
begin
  if to_regprocedure(
       'public.create_audio_publication(text,text,text,text,uuid,uuid,integer,text,text,jsonb,uuid)'
     ) is null
     or to_regprocedure(
       'public.snapshot_audio_publication_working_version(uuid,bigint,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.archive_audio_publication(uuid,bigint,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.restore_audio_publication_from_archive(uuid,bigint,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'audio.insert_current_publication_snapshot(uuid,bigint,text,uuid)'
     ) is null
     or to_regprocedure(
       'audio.publication_content_fingerprint(uuid)'
     ) is null
     or to_regprocedure(
       'public.get_public_audio_publication_m1(text)'
     ) is null
     or to_regprocedure(
       'public.replace_audio_publication_version_citations(uuid,jsonb,bigint,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.replace_audio_publication_version_credits(uuid,jsonb,bigint,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.save_resource_version_editorial_metadata(text,uuid,bigint,uuid[],uuid[],text,text,text[],text,text,uuid)'
     ) is null
  then
    raise exception
      'PHASE_7A_K4C_A2_FAIL: exact 10-function Audio dependency set is incomplete';
  end if;

  -- Durable owner/security/volatility/search-path perimeter for the exact A2 target set.
  -- Execute privileges are verified semantically below rather than by raw proacl array order.
  if exists (
    select 1
    from (
      values
        ('public.archive_audio_publication(uuid,bigint,text,text,uuid)', true, 'v', 'search_path=pg_catalog, public, auth, editorial, platform_private, audio, extensions'),
        ('audio.insert_current_publication_snapshot(uuid,bigint,text,uuid)', true, 'v', 'search_path=pg_catalog, audio, editorial, media, extensions'),
        ('audio.publication_content_fingerprint(uuid)', false, 's', 'search_path=pg_catalog, audio, media, editorial, extensions'),
        ('public.create_audio_publication(text,text,text,text,uuid,uuid,integer,text,text,jsonb,uuid)', true, 'v', 'search_path=pg_catalog, public, auth, editorial, platform_private, audio, extensions'),
        ('public.get_public_audio_publication_m1(text)', true, 's', 'search_path=pg_catalog, public, editorial, audio, media'),
        ('public.replace_audio_publication_version_citations(uuid,jsonb,bigint,text,uuid)', true, 'v', 'search_path=pg_catalog, auth, public, editorial, audio, platform_private, extensions'),
        ('public.replace_audio_publication_version_credits(uuid,jsonb,bigint,text,uuid)', true, 'v', 'search_path=pg_catalog, auth, public, editorial, audio, platform_private, extensions'),
        ('public.restore_audio_publication_from_archive(uuid,bigint,text,text,uuid)', true, 'v', 'search_path=pg_catalog, public, auth, editorial, platform_private, audio, extensions'),
        ('public.save_resource_version_editorial_metadata(text,uuid,bigint,uuid[],uuid[],text,text,text[],text,text,uuid)', true, 'v', 'search_path=pg_catalog, public, auth, editorial, audio, platform_private, extensions'),
        ('public.snapshot_audio_publication_working_version(uuid,bigint,text,uuid)', true, 'v', 'search_path=pg_catalog, public, auth, editorial, platform_private, audio, extensions')
    ) expected(signature, security_definer, volatility, search_path_setting)
    join pg_proc procedure_row
      on procedure_row.oid=to_regprocedure(expected.signature)
    where pg_get_userbyid(procedure_row.proowner) <> 'postgres'
       or procedure_row.prosecdef <> expected.security_definer
       or procedure_row.provolatile::text <> expected.volatility
       or not coalesce(procedure_row.proconfig,'{}'::text[]) @>
            array[expected.search_path_setting]::text[]
  ) then
    raise exception
      'PHASE_7A_K4C_A2_FAIL: target function owner/security/volatility/search_path perimeter drifted';
  end if;

  select count(*)
  into v_count
  from information_schema.columns
  where table_schema='editorial'
    and table_name='audio_publication_resources'
    and column_name in (
      'current_working_version_id',
      'current_submitted_version_id',
      'current_approved_version_id',
      'current_published_version_id'
    );

  if v_count <> 4 then
    raise exception
      'PHASE_7A_K4C_A2_FAIL: A2 must retain four typed Audio compatibility columns';
  end if;

  select count(*)
  into v_count
  from pg_proc procedure_row
  where procedure_row.prokind in ('f','p')
    and (
      pg_get_functiondef(procedure_row.oid)
        ~* 'update[[:space:]]+editorial[.]audio_publication_resources[[:space:][:print:]]{0,200}set[[:space:][:print:]]{0,200}current_(working|submitted|approved|published)_version_id'
      or pg_get_functiondef(procedure_row.oid)
        ~* 'insert[[:space:]]+into[[:space:]]+editorial[.]audio_publication_resources[[:space:]]*[(][^)]*current_(working|submitted|approved|published)_version_id'
    );

  if v_count <> 1 then
    raise exception
      'PHASE_7A_K4C_A2_FAIL: expected only K1 compatibility typed-pointer writer, found %',
      v_count;
  end if;

  select count(*)
  into v_count
  from pg_proc procedure_row
  where procedure_row.prokind in ('f','p')
    and procedure_row.oid <>
      'editorial.sync_typed_lifecycle_from_resource()'::regprocedure
    and pg_get_functiondef(procedure_row.oid)
      ~ 'editorial[.]audio_publication_resources'
    and pg_get_functiondef(procedure_row.oid)
      ~ '(v_binding|binding|audio_binding)[.]current_(working|submitted|approved|published)_version_id';

  if v_count <> 0 then
    raise exception
      'PHASE_7A_K4C_A2_FAIL: % business function(s) still read typed Audio pointers',
      v_count;
  end if;

  select count(*)
  into v_count
  from editorial.audio_publication_resources binding
  join editorial.resources resource
    on resource.id=binding.resource_id
  where (
    binding.current_working_version_id,
    binding.current_submitted_version_id,
    binding.current_approved_version_id,
    binding.current_published_version_id
  ) is distinct from (
    resource.current_working_version_id,
    resource.current_submitted_version_id,
    resource.current_approved_version_id,
    resource.current_published_version_id
  );

  if v_count <> 0 then
    raise exception
      'PHASE_7A_K4C_A2_FAIL: Audio pointer parity drift is %',
      v_count;
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid=
            'editorial.audio_publication_resources'::regclass
      and trigger_row.tgname=
            'audio_publication_resources_sync_shared_lifecycle'
      and trigger_row.tgfoid=
            'editorial.sync_resource_lifecycle_from_typed_binding()'::regprocedure
      and not trigger_row.tgisinternal
  ) or not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid='editorial.resources'::regclass
      and trigger_row.tgname=
            'resources_sync_typed_lifecycle_compatibility'
      and trigger_row.tgfoid=
            'editorial.sync_typed_lifecycle_from_resource()'::regprocedure
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'PHASE_7A_K4C_A2_FAIL: K1 Audio compatibility trigger boundary changed before A3';
  end if;

  if md5(
       pg_get_functiondef(
         'editorial.sync_resource_lifecycle_from_typed_binding()'::regprocedure
       )
     ) <> '1a9a366b7a26d023aa589767a2024651'
     or md5(
       pg_get_functiondef(
         'editorial.sync_typed_lifecycle_from_resource()'::regprocedure
       )
     ) <> '619a2bd22f9066594f84dada7a119902'
  then
    raise exception
      'PHASE_7A_K4C_A2_FAIL: K1 Audio compatibility helper changed before A3';
  end if;

  select pg_get_functiondef(
    'public.create_audio_publication(text,text,text,text,uuid,uuid,integer,text,text,jsonb,uuid)'::regprocedure
  ) into v_definition;
  if position('update editorial.resources resource_update' in v_definition)=0
     or position('current_working_version_id' in v_definition)=0
     or position('update editorial.audio_publication_resources' in v_definition)<>0
  then
    raise exception 'PHASE_7A_K4C_A2_FAIL: Audio create pointer authority drifted';
  end if;

  select pg_get_functiondef(
    'public.snapshot_audio_publication_working_version(uuid,bigint,text,uuid)'::regprocedure
  ) into v_definition;
  if position('v_resource.current_working_version_id' in v_definition)=0
     or position('update editorial.resources resource_update' in v_definition)=0
     or position('v_binding.current_working_version_id' in v_definition)<>0
     or position('update editorial.audio_publication_resources' in v_definition)<>0
  then
    raise exception 'PHASE_7A_K4C_A2_FAIL: Audio working snapshot pointer authority drifted';
  end if;

  select pg_get_functiondef(
    'public.archive_audio_publication(uuid,bigint,text,text,uuid)'::regprocedure
  ) into v_definition;
  if position('v_resource.current_working_version_id' in v_definition)=0
     or position('v_resource.current_published_version_id' in v_definition)=0
     or position('update editorial.resources resource_pointer' in v_definition)=0
     or position('v_binding.current_' in v_definition)<>0
     or position('update editorial.audio_publication_resources' in v_definition)<>0
  then
    raise exception 'PHASE_7A_K4C_A2_FAIL: Audio archive pointer authority drifted';
  end if;

  select pg_get_functiondef(
    'public.restore_audio_publication_from_archive(uuid,bigint,text,text,uuid)'::regprocedure
  ) into v_definition;
  if position('v_resource.current_working_version_id' in v_definition)=0
     or position('v_resource.current_published_version_id' in v_definition)=0
     or position('v_binding.current_' in v_definition)<>0
  then
    raise exception 'PHASE_7A_K4C_A2_FAIL: Audio restore pointer authority drifted';
  end if;

  select pg_get_functiondef(
    'audio.insert_current_publication_snapshot(uuid,bigint,text,uuid)'::regprocedure
  ) into v_definition;
  if position('v_resource.current_working_version_id' in v_definition)=0
     or position('v_binding.current_working_version_id' in v_definition)<>0
     or position('editorial.copy_audio_version_trust_to_version' in v_definition)=0
  then
    raise exception 'PHASE_7A_K4C_A2_FAIL: Audio snapshot helper canonical working identity drifted';
  end if;

  select pg_get_functiondef(
    'audio.publication_content_fingerprint(uuid)'::regprocedure
  ) into v_definition;
  if position('resource.current_working_version_id' in v_definition)=0
     or position('binding.current_working_version_id' in v_definition)<>0
     or position('join editorial.resources resource' in v_definition)=0
  then
    raise exception 'PHASE_7A_K4C_A2_FAIL: Audio content fingerprint pointer authority drifted';
  end if;

  select pg_get_functiondef(
    'public.get_public_audio_publication_m1(text)'::regprocedure
  ) into v_definition;
  if position('v_resource.current_published_version_id' in v_definition)=0
     or position('v_binding.current_published_version_id' in v_definition)<>0
     or position('audio.assert_publishable_version_media' in v_definition)=0
     or position('audio.publication_snapshots' in v_definition)=0
     or position('audio.publication_feed_identities' in v_definition)=0
  then
    raise exception 'PHASE_7A_K4C_A2_FAIL: public Audio read pointer/media contract drifted';
  end if;

  select pg_get_functiondef(
    'public.replace_audio_publication_version_citations(uuid,jsonb,bigint,text,uuid)'::regprocedure
  ) into v_definition;
  if position('v_resource.current_working_version_id' in v_definition)=0
     or position('v_binding.current_working_version_id' in v_definition)<>0
  then
    raise exception 'PHASE_7A_K4C_A2_FAIL: Audio Citation current-working authority drifted';
  end if;

  select pg_get_functiondef(
    'public.replace_audio_publication_version_credits(uuid,jsonb,bigint,text,uuid)'::regprocedure
  ) into v_definition;
  if position('v_resource.current_working_version_id' in v_definition)=0
     or position('v_binding.current_working_version_id' in v_definition)<>0
  then
    raise exception 'PHASE_7A_K4C_A2_FAIL: Audio Credit current-working authority drifted';
  end if;

  select pg_get_functiondef(
    'public.save_resource_version_editorial_metadata(text,uuid,bigint,uuid[],uuid[],text,text,text[],text,text,uuid)'::regprocedure
  ) into v_definition;
  if position('select resource.current_working_version_id into v_current_working_version_id' in v_definition)=0
     or position('update editorial.resources resource_update' in v_definition)=0
     or position('select binding.current_working_version_id into v_current_working_version_id' in v_definition)<>0
     or position('update editorial.audio_publication_resources binding' in v_definition)<>0
     or position('update editorial.resources resource_update' in v_definition)=0
  then
    raise exception 'PHASE_7A_K4C_A2_FAIL: shared Discovery Audio pointer authority drifted';
  end if;

  if exists (
    select 1
    from pg_proc procedure_row
    where procedure_row.prokind in ('f','p')
      and pg_get_functiondef(procedure_row.oid)
        ~* 'insert[[:space:]]+into[[:space:]]+audio[.]publication_(review|lifecycle)_events'
  ) then
    raise exception 'PHASE_7A_K4C_A2_FAIL: A1 typed Audio event authority regressed';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema='editorial'
      and table_name='playlist_resources'
      and column_name in (
        'current_working_version_id',
        'current_submitted_version_id',
        'current_approved_version_id',
        'current_published_version_id'
      )
  ) then
    raise exception 'PHASE_7A_K4C_A2_FAIL: Playlist P3 pointer retirement regressed';
  end if;

  if to_regclass('video.review_events') is not null
     or to_regclass('video.lifecycle_events') is not null
     or to_regclass('video.publication_review_events') is not null
     or to_regclass('video.publication_lifecycle_events') is not null
  then
    raise exception 'PHASE_7A_K4C_A2_FAIL: typed Video event authority exists';
  end if;

  -- Public RPC ACL perimeter.
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
    where has_function_privilege('public',signature.value,'EXECUTE')
       or has_function_privilege('anon',signature.value,'EXECUTE')
       or not has_function_privilege('authenticated',signature.value,'EXECUTE')
       or not has_function_privilege('service_role',signature.value,'EXECUTE')
  ) then
    raise exception 'PHASE_7A_K4C_A2_FAIL: Audio mutation RPC execution perimeter drifted';
  end if;

  -- Internal/read helper ACLs remain closed to application roles.
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
    raise exception 'PHASE_7A_K4C_A2_FAIL: internal Audio helper execution leaked';
  end if;
end;
$phase_7a_k4c_a2_verify$;

select
  'PHASE_7A_K4C_A2_AUDIO_REMAINING_POINTER_CONVERGENCE_PASS'
    as verification_result,
  (
    select count(*)
    from pg_proc procedure_row
    where procedure_row.prokind in ('f','p')
      and procedure_row.oid <>
        'editorial.sync_typed_lifecycle_from_resource()'::regprocedure
      and pg_get_functiondef(procedure_row.oid)
        ~ '(v_binding|binding|audio_binding)[.]current_(working|submitted|approved|published)_version_id'
  ) as business_typed_pointer_reader_count,
  (
    select count(*)
    from pg_proc procedure_row
    where procedure_row.prokind in ('f','p')
      and (
        pg_get_functiondef(procedure_row.oid)
          ~* 'update[[:space:]]+editorial[.]audio_publication_resources[[:space:][:print:]]{0,200}set[[:space:][:print:]]{0,200}current_(working|submitted|approved|published)_version_id'
        or pg_get_functiondef(procedure_row.oid)
          ~* 'insert[[:space:]]+into[[:space:]]+editorial[.]audio_publication_resources[[:space:]]*[(][^)]*current_(working|submitted|approved|published)_version_id'
      )
  ) as total_typed_pointer_writer_count,
  (
    select count(*)
    from editorial.audio_publication_resources binding
    join editorial.resources resource
      on resource.id=binding.resource_id
    where (
      binding.current_working_version_id,
      binding.current_submitted_version_id,
      binding.current_approved_version_id,
      binding.current_published_version_id
    ) is distinct from (
      resource.current_working_version_id,
      resource.current_submitted_version_id,
      resource.current_approved_version_id,
      resource.current_published_version_id
    )
  ) as pointer_drift;

rollback;
