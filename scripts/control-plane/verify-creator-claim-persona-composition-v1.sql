-- Permanent read-only verifier for creator claim -> Person↔Artist persona composition.

do $verify$
declare
  v_private text;
  v_trigger text;
begin
  if to_regprocedure(
       'platform_private.compose_verified_artist_claim_persona_v1(uuid,text)'
     ) is null
     or to_regprocedure(
       'public.admin_finalize_verified_artist_claim_persona_v1(uuid,text)'
     ) is null
     or to_regprocedure(
       'platform_private.compose_verified_artist_claim_persona_trigger_v1()'
     ) is null
  then
    raise exception
      'CREATOR_CLAIM_PERSONA_COMPOSITION_FAIL: required functions are missing';
  end if;

  if not exists (
       select 1
       from pg_trigger
       where tgname='artist_claim_verified_persona_composition_v1'
         and tgrelid='public.artist_claim_requests'::regclass
         and tgenabled='O'
         and not tgisinternal
     )
  then
    raise exception
      'CREATOR_CLAIM_PERSONA_COMPOSITION_FAIL: claim trigger missing or disabled';
  end if;

  select pg_get_functiondef(
    'platform_private.compose_verified_artist_claim_persona_v1(uuid,text)'::regprocedure
  )
  into v_private;

  if position('manage_registry' in v_private)=0
     or position('manage_people_identity' in v_private)=0
     or position('registry.person_artist.link' in v_private)=0
     or position('artist_claim_review' in v_private)=0
     or position('admin_link_person_registry_artist_v1' in v_private)=0
  then
    raise exception
      'CREATOR_CLAIM_PERSONA_COMPOSITION_FAIL: private authority contract drifted';
  end if;

  select pg_get_functiondef(
    'platform_private.compose_verified_artist_claim_persona_trigger_v1()'::regprocedure
  )
  into v_trigger;

  if position(
       'claimant_role=''artist''' in
       replace(v_trigger,' ','')
     )=0
     or position('manage_registry' in v_trigger)=0
     or position('manage_people_identity' in v_trigger)=0
  then
    raise exception
      'CREATOR_CLAIM_PERSONA_COMPOSITION_FAIL: trigger widened self-Artist identity authority';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.admin_finalize_verified_artist_claim_persona_v1(uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.admin_finalize_verified_artist_claim_persona_v1(uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.admin_finalize_verified_artist_claim_persona_v1(uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'platform_private.compose_verified_artist_claim_persona_v1(uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'platform_private.compose_verified_artist_claim_persona_v1(uuid,text)',
       'EXECUTE'
     )
  then
    raise exception
      'CREATOR_CLAIM_PERSONA_COMPOSITION_FAIL: execution privilege drift';
  end if;

  if exists (
       select 1
       from information_schema.role_table_grants grant_row
       where grant_row.table_schema='editorial'
         and grant_row.table_name='person_registry_artist_links'
         and grant_row.grantee in ('anon','authenticated','service_role')
         and grant_row.privilege_type in ('INSERT','UPDATE','DELETE')
     )
  then
    raise exception
      'CREATOR_CLAIM_PERSONA_COMPOSITION_FAIL: direct persona-link DML leaked';
  end if;
end
$verify$;

select 'CREATOR_CLAIM_PERSONA_COMPOSITION_V1_PASS'::text as status;
