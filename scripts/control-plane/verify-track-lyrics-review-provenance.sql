do $verify$
declare
  v_function text;
  v_direct_grants integer;
begin
  if to_regclass('editorial.track_lyrics_contributions') is null
     or to_regclass('editorial.track_lyrics_versions') is null
     or to_regclass('editorial.track_lyrics_documents') is null then
    raise exception 'Track Lyrics authority tables are incomplete';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'editorial'
      and table_name = 'track_lyrics_contributions'
      and column_name = 'contribution_kind'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'editorial'
      and table_name = 'track_lyrics_contributions'
      and column_name = 'acceptance_mode'
  ) then
    raise exception 'Track Lyrics contribution review provenance columns are missing';
  end if;

  for v_function in
    select unnest(array[
      'public.get_admin_track_lyrics_contribution_inbox(text,text,integer,integer)',
      'public.search_admin_track_lyrics_tracks(text,integer)',
      'public.review_track_lyrics_contribution(uuid,bigint,text,text,jsonb,text,text)',
      'public.get_admin_track_lyrics_history(uuid,integer)',
      'public.get_public_track_lyrics(uuid)'
    ])
  loop
    if to_regprocedure(v_function) is null then
      raise exception 'Missing Track Lyrics function: %', v_function;
    end if;
  end loop;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'editorial'
      and table_name = 'track_lyrics_versions'
      and column_name = 'source_contribution_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'editorial'
      and table_name = 'track_lyrics_versions'
      and column_name = 'source_contributor_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'editorial'
      and table_name = 'track_lyrics_versions'
      and column_name = 'source_contributor_label'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'editorial'
      and table_name = 'track_lyrics_versions'
      and column_name = 'community_revision_mode'
  ) then
    raise exception 'Track Lyrics structural version provenance is incomplete';
  end if;

  if exists (
    select 1
    from pg_constraint constraint_row
    join pg_class table_row on table_row.oid = constraint_row.conrelid
    join pg_namespace namespace_row on namespace_row.oid = table_row.relnamespace
    where namespace_row.nspname = 'editorial'
      and table_row.relname = 'track_lyrics_versions'
      and constraint_row.conname = 'track_lyrics_versions_source_contributor_fkey'
  ) then
    raise exception 'Immutable Lyrics versions must not carry a mutating auth-user FK';
  end if;

  if to_regprocedure('editorial.protect_track_lyrics_contribution_payload()') is null then
    raise exception 'Immutable Lyrics contribution payload guard is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    join pg_class table_row on table_row.oid = trigger_row.tgrelid
    join pg_namespace namespace_row on namespace_row.oid = table_row.relnamespace
    where namespace_row.nspname = 'editorial'
      and table_row.relname = 'track_lyrics_contributions'
      and trigger_row.tgname = 'track_lyrics_contributions_payload_immutable'
      and not trigger_row.tgisinternal
  ) then
    raise exception 'Lyrics contribution immutable-payload trigger is missing';
  end if;

  select count(*)
  into v_direct_grants
  from information_schema.role_table_grants grant_row
  where grant_row.table_schema = 'editorial'
    and grant_row.table_name in (
      'track_lyrics_contributions',
      'track_lyrics_versions',
      'track_lyrics_documents'
    )
    and grant_row.grantee in ('anon', 'authenticated', 'PUBLIC');

  if v_direct_grants <> 0 then
    raise exception 'Browser roles have direct Track Lyrics authority table grants';
  end if;

  select pg_get_functiondef(
    'public.get_admin_track_lyrics_workspace(uuid)'::regprocedure
  ) into v_function;
  if v_function like '%save_content%' then
    raise exception 'Lyrics workspace still treats public save_content as editorial authority';
  end if;
  if v_function not like '%view_audio%'
     or v_function not like '%manage_review_queue%' then
    raise exception 'Lyrics workspace capability composition is incomplete';
  end if;

  select pg_get_functiondef(
    'public.save_track_lyrics_draft(uuid,bigint,text,text,jsonb,text,text)'::regprocedure
  ) into v_function;
  if v_function like '%save_content%'
     or (v_function not like '%edit_own_audio%' and v_function not like '%edit_others_audio%') then
    raise exception 'Lyrics draft authority is not bound to Audio editorial capabilities';
  end if;

  select pg_get_functiondef(
    'public.publish_track_lyrics_version(uuid,uuid,bigint)'::regprocedure
  ) into v_function;
  if v_function not like '%publish_audio%' then
    raise exception 'Lyrics publication is not bound to publish_audio';
  end if;

  select pg_get_functiondef(
    'public.community_create_contribution(uuid,text,text,text,text,jsonb)'::regprocedure
  ) into v_function;
  if v_function not like '%lyrics_correction%governed Track Lyrics contribution flow%' then
    raise exception 'Generic community Lyrics correction creation remains enabled';
  end if;

  if has_function_privilege(
    'anon',
    'public.get_admin_track_lyrics_contribution_inbox(text,text,integer,integer)',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.get_admin_track_lyrics_history(uuid,integer)',
    'EXECUTE'
  ) then
    raise exception 'Anonymous role can execute Track Lyrics admin readers';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.get_admin_track_lyrics_contribution_inbox(text,text,integer,integer)',
    'EXECUTE'
  ) or not has_function_privilege(
    'authenticated',
    'public.search_admin_track_lyrics_tracks(text,integer)',
    'EXECUTE'
  ) or not has_function_privilege(
    'authenticated',
    'public.review_track_lyrics_contribution(uuid,bigint,text,text,jsonb,text,text)',
    'EXECUTE'
  ) or not has_function_privilege(
    'authenticated',
    'public.get_admin_track_lyrics_history(uuid,integer)',
    'EXECUTE'
  ) then
    raise exception 'Authenticated Track Lyrics editorial RPC grants are incomplete';
  end if;

  if not has_function_privilege(
    'anon',
    'public.get_public_track_lyrics(uuid)',
    'EXECUTE'
  ) then
    raise exception 'Public Lyrics reader is not available to anon';
  end if;
end;
$verify$;

select 'TRACK_LYRICS_REVIEW_PROVENANCE_PASS' as verification;
