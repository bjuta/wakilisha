do $verify$
declare
  v_direct_table_grants integer;
  v_anon_submit boolean;
  v_auth_submit boolean;
  v_auth_admin_read boolean;
  v_auth_promote boolean;
  v_auth_reject boolean;
begin
  if to_regclass('editorial.track_lyrics_contributions') is null then
    raise exception 'Missing editorial.track_lyrics_contributions';
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'editorial'
      and c.relname = 'track_lyrics_contributions'
      and c.relrowsecurity
  ) then
    raise exception 'Track Lyrics contributions RLS is not enabled';
  end if;

  if to_regprocedure('public.submit_track_lyrics_contribution(uuid,text,text,jsonb,text)') is null
     or to_regprocedure('public.get_admin_track_lyrics_contributions(uuid)') is null
     or to_regprocedure('public.promote_track_lyrics_contribution_to_draft(uuid,bigint)') is null
     or to_regprocedure('public.reject_track_lyrics_contribution(uuid,text)') is null then
    raise exception 'Track Lyrics contribution RPC surface is incomplete';
  end if;

  select count(*)
  into v_direct_table_grants
  from information_schema.role_table_grants grant_row
  where grant_row.table_schema = 'editorial'
    and grant_row.table_name = 'track_lyrics_contributions'
    and grant_row.grantee in ('anon', 'authenticated', 'PUBLIC');

  if v_direct_table_grants <> 0 then
    raise exception 'Browser roles have direct Track Lyrics contribution table grants';
  end if;

  select has_function_privilege('anon', 'public.submit_track_lyrics_contribution(uuid,text,text,jsonb,text)', 'EXECUTE'),
         has_function_privilege('authenticated', 'public.submit_track_lyrics_contribution(uuid,text,text,jsonb,text)', 'EXECUTE'),
         has_function_privilege('authenticated', 'public.get_admin_track_lyrics_contributions(uuid)', 'EXECUTE'),
         has_function_privilege('authenticated', 'public.promote_track_lyrics_contribution_to_draft(uuid,bigint)', 'EXECUTE'),
         has_function_privilege('authenticated', 'public.reject_track_lyrics_contribution(uuid,text)', 'EXECUTE')
  into v_anon_submit, v_auth_submit, v_auth_admin_read, v_auth_promote, v_auth_reject;

  if v_anon_submit then
    raise exception 'Anonymous Lyrics contribution execute grant must remain revoked';
  end if;

  if not v_auth_submit or not v_auth_admin_read or not v_auth_promote or not v_auth_reject then
    raise exception 'Authenticated Lyrics contribution RPC grants are incomplete';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_row
    join pg_class table_row on table_row.oid = constraint_row.conrelid
    join pg_namespace namespace_row on namespace_row.oid = table_row.relnamespace
    where namespace_row.nspname = 'editorial'
      and table_row.relname = 'track_lyrics_contributions'
      and constraint_row.conname = 'track_lyrics_contributions_status_check'
  ) then
    raise exception 'Track Lyrics contribution lifecycle constraint is missing';
  end if;
end;
$verify$;

select 'TRACK_LYRICS_CONTRIBUTION_AUTHORITY_PASS' as verification;
