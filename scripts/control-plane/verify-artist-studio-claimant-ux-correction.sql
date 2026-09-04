do $verify$
declare
  v_existing text;
  v_new text;
  v_admin text;
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'artist_claim_requests'
      and column_name = 'claimant_role_other'
      and data_type = 'text'
      and is_nullable = 'YES'
  ) then
    raise exception
      'VERIFY_FAIL: claimant_role_other column missing';
  end if;

  if to_regprocedure(
       'public.community_submit_artist_claim_v2(uuid,text,text,text,text,text,text,jsonb)'
     ) is null
     or to_regprocedure(
       'public.community_submit_new_artist_claim_v2(text,text,text,text[],text,text,text,text,text,text,jsonb)'
     ) is null
     or to_regprocedure(
       'public.community_admin_get_artist_claims_v2(text,integer)'
     ) is null
  then
    raise exception
      'VERIFY_FAIL: accepted v2 authority was not preserved';
  end if;

  if to_regprocedure(
       'public.community_submit_artist_claim_v3(uuid,text,text,text,text,text,text,text,jsonb)'
     ) is null
     or to_regprocedure(
       'public.community_submit_new_artist_claim_v3(text,text,text,text[],text,text,text,text,text,text,text,jsonb)'
     ) is null
     or to_regprocedure(
       'public.community_admin_get_artist_claims_v3(text,integer)'
     ) is null
  then
    raise exception
      'VERIFY_FAIL: v3 claimant UX authority missing';
  end if;

  if has_function_privilege(
       'anon',
       'public.community_submit_artist_claim_v3(uuid,text,text,text,text,text,text,text,jsonb)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.community_submit_artist_claim_v3(uuid,text,text,text,text,text,text,text,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.community_submit_new_artist_claim_v3(text,text,text,text[],text,text,text,text,text,text,text,jsonb)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.community_submit_new_artist_claim_v3(text,text,text,text[],text,text,text,text,text,text,text,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.community_admin_get_artist_claims_v3(text,integer)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.community_admin_get_artist_claims_v3(text,integer)',
       'EXECUTE'
     )
  then
    raise exception
      'VERIFY_FAIL: v3 execute boundary mismatch';
  end if;

  select pg_get_functiondef(
    'public.community_submit_artist_claim_v3(uuid,text,text,text,text,text,text,text,jsonb)'::regprocedure
  )
  into v_existing;

  select pg_get_functiondef(
    'public.community_submit_new_artist_claim_v3(text,text,text,text[],text,text,text,text,text,text,text,jsonb)'::regprocedure
  )
  into v_new;

  select pg_get_functiondef(
    'public.community_admin_get_artist_claims_v3(text,integer)'::regprocedure
  )
  into v_admin;

  if position(
       'community_submit_artist_claim_v2'
       in v_existing
     ) = 0
     or position(
       'community_submit_new_artist_claim_v2'
       in v_new
     ) = 0
     or position(
       'community_admin_get_artist_claims_v2'
       in v_admin
     ) = 0
  then
    raise exception
      'VERIFY_FAIL: v3 functions do not delegate to accepted v2 authority';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname =
      'artist_claim_requests_role_other_shape'
      and conrelid =
        'public.artist_claim_requests'::regclass
  ) then
    raise exception
      'VERIFY_FAIL: claimant role-detail constraint missing';
  end if;
end;
$verify$;

select
  'ARTIST_STUDIO_CLAIMANT_UX_CORRECTION_PASS'
    as verification_result;
