-- Permanent read-only verifier for Music Provenance Slice 2 participation/public authority.

do $verify$
declare
  v_definition text;
  v_signature text;
  v_private_table_privileges integer;
  v_canonical_dml_privileges integer;
begin
  if to_regclass(
       'platform_private.registry_contribution_invitations'
     ) is null
     or to_regclass(
       'platform_private.registry_contribution_invitation_events'
     ) is null
  then
    raise exception
      'Music provenance Slice 2 invitation authority is incomplete';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema='platform_private'
      and table_name='registry_contribution_invitations'
      and column_name in ('raw_token','invite_token','token')
  ) then
    raise exception
      'Contribution invitation authority stores a raw bearer token';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid=
          'platform_private.registry_contribution_invitations'::regclass
      and tgname='registry_contribution_invitations_append_only'
      and not tgisinternal
  )
     or not exists (
       select 1
       from pg_trigger
       where tgrelid=
             'platform_private.registry_contribution_invitation_events'::regclass
         and tgname='registry_contribution_invitation_events_append_only'
         and not tgisinternal
     )
  then
    raise exception
      'Contribution invitation append-only history is incomplete';
  end if;

  select count(*)::integer
  into v_private_table_privileges
  from information_schema.role_table_grants grant_row
  where grant_row.table_schema='platform_private'
    and grant_row.table_name in (
      'registry_contribution_invitations',
      'registry_contribution_invitation_events'
    )
    and grant_row.grantee in (
      'anon','authenticated','service_role'
    )
    and grant_row.privilege_type in (
      'SELECT','INSERT','UPDATE','DELETE'
    );

  if v_private_table_privileges<>0 then
    raise exception
      'Contribution invitation private tables leaked client table authority';
  end if;

  foreach v_signature in array array[
    'public.search_music_credit_people_v1(text,integer)',
    'public.create_my_music_credit_attestation_v1(text,uuid,text,text,text,text,uuid,uuid,text,jsonb,text)',
    'public.set_my_music_credit_permission_v1(uuid,boolean,text[],text[],boolean,text)',
    'public.transition_my_music_credit_attestation_v1(uuid,text,text)',
    'public.create_music_credit_invitation_v1(uuid,uuid,text,integer)',
    'public.revoke_my_music_credit_invitation_v1(uuid,text)',
    'public.respond_music_credit_invitation_v1(text,text,text)',
    'public.get_my_music_credits_v1()'
  ]
  loop
    if to_regprocedure(v_signature) is null then
      raise exception 'Missing creator provenance function: %',v_signature;
    end if;

    if not has_function_privilege(
         'authenticated',
         v_signature,
         'EXECUTE'
       )
       or has_function_privilege(
            'anon',
            v_signature,
            'EXECUTE'
          )
       or has_function_privilege(
            'service_role',
            v_signature,
            'EXECUTE'
          )
    then
      raise exception 'Creator provenance function ACL drifted: %',v_signature;
    end if;
  end loop;

  foreach v_signature in array array[
    'public.get_music_credit_invite_v1(text)',
    'public.get_public_track_provenance_v1(uuid)',
    'public.get_public_person_music_credits_v1(uuid)',
    'public.get_public_artist_music_provenance_v1(uuid)'
  ]
  loop
    if to_regprocedure(v_signature) is null then
      raise exception 'Missing public provenance read function: %',v_signature;
    end if;

    if not has_function_privilege('anon',v_signature,'EXECUTE')
       or not has_function_privilege('authenticated',v_signature,'EXECUTE')
       or not has_function_privilege('service_role',v_signature,'EXECUTE')
    then
      raise exception 'Public provenance read ACL drifted: %',v_signature;
    end if;
  end loop;

  select count(*)::integer
  into v_canonical_dml_privileges
  from information_schema.role_table_grants grant_row
  where grant_row.table_schema='public'
    and grant_row.table_name in (
      'registry_works',
      'registry_track_work_links',
      'registry_track_contributions',
      'registry_work_contributions'
    )
    and grant_row.grantee in (
      'anon','authenticated','service_role'
    )
    and grant_row.privilege_type in (
      'INSERT','UPDATE','DELETE'
    );

  if v_canonical_dml_privileges<>0 then
    raise exception
      'Slice 2 changed canonical Work/Contribution mutation authority';
  end if;

  select pg_get_functiondef(
    'public.create_my_music_credit_attestation_v1(text,uuid,text,text,text,text,uuid,uuid,text,jsonb,text)'::regprocedure
  )
  into v_definition;

  if position(
       'insert into public.registry_track_contributions'
       in lower(v_definition)
     )<>0
     or position(
          'insert into public.registry_work_contributions'
          in lower(v_definition)
        )<>0
     or position(
          'registry_rights_claims'
          in lower(v_definition)
        )<>0
  then
    raise exception
      'Creator attestation gained canonical Contribution or Rights mutation authority';
  end if;

  if position(
       'suggested_confirmation'
       in v_definition
     )=0
     or position(
          'candidate_shown_payload'
          in v_definition
        )=0
     or position(
          'self_claim'
          in v_definition
        )=0
  then
    raise exception
      'Creator attestation elicitation provenance is incomplete';
  end if;

  select pg_get_functiondef(
    'public.create_music_credit_invitation_v1(uuid,uuid,text,integer)'::regprocedure
  )
  into v_definition;

  if position(
       'community_notifications'
       in v_definition
     )=0
     or position(
          'inviter_share_only'
          in v_definition
        )=0
     or position(
          'http_post'
          in lower(v_definition)
        )<>0
     or position(
          'net.http'
          in lower(v_definition)
        )<>0
  then
    raise exception
      'Credit invitation notification/outreach boundary drifted';
  end if;

  select pg_get_functiondef(
    'public.respond_music_credit_invitation_v1(text,text,text)'::regprocedure
  )
  into v_definition;

  if position('counterparty_confirmation' in v_definition)=0
     or position('parent_attestation_id' in v_definition)=0
     or position('candidate_shown_payload' in v_definition)=0
     or position('registry_rights_claims' in lower(v_definition))<>0
  then
    raise exception
      'Counterparty confirmation lineage or rights boundary drifted';
  end if;

  foreach v_signature in array array[
    'public.get_public_track_provenance_v1(uuid)',
    'public.get_public_person_music_credits_v1(uuid)',
    'public.get_public_artist_music_provenance_v1(uuid)'
  ]
  loop
    select pg_get_functiondef(v_signature::regprocedure)
    into v_definition;

    if position('''verified''' in v_definition)=0
       or position(
            'registry_contribution_attestations'
            in v_definition
          )<>0
    then
      raise exception
        'Public provenance read is not sealed to verified canonical authority: %',
        v_signature;
    end if;
  end loop;

  select pg_get_functiondef(
    'public.get_public_track_provenance_v1(uuid)'::regprocedure
  )
  into v_definition;

  if position('registry_track_contributions' in v_definition)=0
     or position('registry_work_contributions' in v_definition)=0
     or position('registry_track_work_links' in v_definition)=0
  then
    raise exception
      'Public Track provenance does not derive from canonical structured authority';
  end if;

  select pg_get_functiondef(
    'public.get_public_person_music_credits_v1(uuid)'::regprocedure
  )
  into v_definition;

  if position('registry_track_contributions' in v_definition)=0
     or position('registry_work_contributions' in v_definition)=0
     or position('resource.visibility' in v_definition)=0
  then
    raise exception
      'Public Person music portfolio authority is incomplete';
  end if;

  select pg_get_functiondef(
    'public.get_public_artist_music_provenance_v1(uuid)'::regprocedure
  )
  into v_definition;

  if position('registry_track_contributions' in v_definition)=0
     or position('registry_work_contributions' in v_definition)=0
     or position('registry_artist_person_memberships' in v_definition)=0
  then
    raise exception
      'Public Artist/Group provenance authority is incomplete';
  end if;

  raise notice 'MUSIC_PROVENANCE_SLICE2_PARTICIPATION_V1_PASS';
end
$verify$;
