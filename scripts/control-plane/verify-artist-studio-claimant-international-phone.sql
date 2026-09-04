\set ON_ERROR_STOP on

do $verify$
declare
  v_expected_columns integer;
begin
  select count(*)
  into v_expected_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'artist_claim_requests'
    and column_name in (
      'claimant_phone_country_iso2',
      'claimant_phone_calling_code',
      'claimant_phone_national_number',
      'claimant_phone_e164'
    );

  if v_expected_columns <> 4 then
    raise exception
      'FAIL: claimant phone columns are incomplete';
  end if;

  if to_regprocedure('public.community_submit_artist_claim(uuid,text,text,jsonb)') is null
     or to_regprocedure('public.community_submit_new_artist_claim(text,text,text,text[],text,text,jsonb)') is null
  then
    raise exception
      'FAIL: backward-compatible v1 claim RPC authority is missing';
  end if;

  if to_regprocedure('public.community_submit_artist_claim_v2(uuid,text,text,text,text,text,text,jsonb)') is null
     or to_regprocedure('public.community_submit_new_artist_claim_v2(text,text,text,text[],text,text,text,text,text,text,jsonb)') is null
     or to_regprocedure('public.community_admin_get_artist_claims_v2(text,integer)') is null
  then
    raise exception
      'FAIL: claimant phone v2 RPC authority is incomplete';
  end if;

  if has_function_privilege(
       'anon',
       'public.community_submit_artist_claim_v2(uuid,text,text,text,text,text,text,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.community_submit_new_artist_claim_v2(text,text,text,text[],text,text,text,text,text,text,jsonb)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: anon can execute authenticated claimant phone submission RPCs';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.community_submit_artist_claim_v2(uuid,text,text,text,text,text,text,jsonb)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.community_submit_new_artist_claim_v2(text,text,text,text[],text,text,text,text,text,text,jsonb)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: authenticated claimant phone submission grants are missing';
  end if;


  if has_function_privilege(
       'anon',
       'public.community_admin_get_artist_claims_v2(text,integer)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: anon can execute claimant phone review RPC';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.community_admin_get_artist_claims_v2(text,integer)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: authenticated claimant phone review grant is missing';
  end if;

  if position(
       'community_submit_artist_claim(' in
       pg_get_functiondef(
         'public.community_submit_artist_claim_v2(uuid,text,text,text,text,text,text,jsonb)'::regprocedure
       )
     ) = 0
     or position(
       'community_submit_new_artist_claim(' in
       pg_get_functiondef(
         'public.community_submit_new_artist_claim_v2(text,text,text,text[],text,text,text,text,text,text,jsonb)'::regprocedure
       )
     ) = 0
     or position(
       'community_admin_get_artist_claims(' in
       pg_get_functiondef(
         'public.community_admin_get_artist_claims_v2(text,integer)'::regprocedure
       )
     ) = 0
  then
    raise exception
      'FAIL: claimant phone v2 authority no longer delegates to accepted v1 authority';
  end if;
end;
$verify$;

select
  'ARTIST_STUDIO_CLAIMANT_INTERNATIONAL_PHONE_PASS'
    as verification_result;
