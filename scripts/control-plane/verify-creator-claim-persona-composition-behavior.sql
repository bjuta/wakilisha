-- Permanent rollback-only behavioral acceptance for creator claim -> Person↔Artist persona composition.

begin;
set local statement_timeout='120s';
set local lock_timeout='5s';

insert into auth.users (
  instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
)
values
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-00000000c611'::uuid,
  'authenticated','authenticated',
  'claim-persona-strong-applicant@local.invalid','',now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"name":"Claim Persona Strong Applicant"}'::jsonb,
  now(),now()
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-00000000c612'::uuid,
  'authenticated','authenticated',
  'claim-persona-strong-reviewer@local.invalid','',now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"name":"Claim Persona Strong Reviewer"}'::jsonb,
  now(),now()
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-00000000c613'::uuid,
  'authenticated','authenticated',
  'claim-persona-weak-applicant@local.invalid','',now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"name":"Claim Persona Weak Applicant"}'::jsonb,
  now(),now()
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-00000000c614'::uuid,
  'authenticated','authenticated',
  'claim-persona-weak-reviewer@local.invalid','',now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"name":"Claim Persona Weak Reviewer"}'::jsonb,
  now(),now()
);

insert into public.user_profiles (
  user_id,email,display_name,status,metadata,is_public,username,username_normalized
)
values
(
  '00000000-0000-4000-8000-00000000c611'::uuid,
  'claim-persona-strong-applicant@local.invalid',
  'Claim Persona Strong Applicant','active',
  '{"fixture":"creator_claim_persona"}'::jsonb,true,
  'claimpersonastrongapplicant','claimpersonastrongapplicant'
),
(
  '00000000-0000-4000-8000-00000000c612'::uuid,
  'claim-persona-strong-reviewer@local.invalid',
  'Claim Persona Strong Reviewer','active',
  '{"fixture":"creator_claim_persona"}'::jsonb,true,
  'claimpersonastrongreviewer','claimpersonastrongreviewer'
),
(
  '00000000-0000-4000-8000-00000000c613'::uuid,
  'claim-persona-weak-applicant@local.invalid',
  'Claim Persona Weak Applicant','active',
  '{"fixture":"creator_claim_persona"}'::jsonb,true,
  'claimpersonaweakapplicant','claimpersonaweakapplicant'
),
(
  '00000000-0000-4000-8000-00000000c614'::uuid,
  'claim-persona-weak-reviewer@local.invalid',
  'Claim Persona Weak Reviewer','active',
  '{"fixture":"creator_claim_persona"}'::jsonb,true,
  'claimpersonaweakreviewer','claimpersonaweakreviewer'
)
on conflict (user_id)
do update
set
  email=excluded.email,
  display_name=excluded.display_name,
  status='active',
  metadata=excluded.metadata,
  is_public=true,
  username=excluded.username,
  username_normalized=excluded.username_normalized,
  updated_at=now();

select editorial.create_person_for_identity(
  '00000000-0000-4000-8000-00000000c611'::uuid,
  null,null,
  'account_provisioning',
  'Rollback-only creator claim persona acceptance fixture.'
);
select editorial.create_person_for_identity(
  '00000000-0000-4000-8000-00000000c613'::uuid,
  null,null,
  'account_provisioning',
  'Rollback-only creator claim persona acceptance fixture.'
);

insert into public.user_role_assignments (
  user_id,role_key,status,assigned_by,assigned_at,notes
)
values
(
  '00000000-0000-4000-8000-00000000c612'::uuid,
  'administrator','active',
  '00000000-0000-4000-8000-00000000c612'::uuid,
  now(),'Rollback-only strong creator-claim persona reviewer'
),
(
  '00000000-0000-4000-8000-00000000c614'::uuid,
  'registry_editor','active',
  '00000000-0000-4000-8000-00000000c614'::uuid,
  now(),'Rollback-only weaker creator-claim reviewer'
);

-- Direct SQL acceptance runs as the database operator rather than PostgREST's
-- authenticator. Bind only this rollback transaction's session_user to the
-- already-accepted reviewed Artist identity broker.
insert into platform_private.system_actor_executor_bindings (
  actor_key,executor_kind,executor_key,status
)
values (
  'registry_artist_identity_review',
  'database_role',
  session_user,
  'active'
)
on conflict (actor_key,executor_kind,executor_key)
do update set status='active',updated_at=now();

do $behavior$
declare
  v_strong_applicant constant uuid :=
    '00000000-0000-4000-8000-00000000c611'::uuid;
  v_strong_reviewer constant uuid :=
    '00000000-0000-4000-8000-00000000c612'::uuid;
  v_weak_applicant constant uuid :=
    '00000000-0000-4000-8000-00000000c613'::uuid;
  v_weak_reviewer constant uuid :=
    '00000000-0000-4000-8000-00000000c614'::uuid;

  v_strong_submission jsonb;
  v_strong_claim uuid;
  v_strong_result jsonb;
  v_strong_artist uuid;
  v_strong_person uuid;
  v_strong_replay jsonb;

  v_weak_submission jsonb;
  v_weak_claim uuid;
  v_weak_result jsonb;
  v_weak_artist uuid;
  v_weak_person uuid;
  v_weak_denied boolean:=false;
  v_weak_final jsonb;
begin
  select link.person_resource_id
  into v_strong_person
  from editorial.person_identity_links link
  where link.user_id=v_strong_applicant
    and link.link_state='active';

  select link.person_resource_id
  into v_weak_person
  from editorial.person_identity_links link
  where link.user_id=v_weak_applicant
    and link.link_state='active';

  if v_strong_person is null or v_weak_person is null then
    raise exception
      'CLAIM_PERSONA_BEHAVIOR_FAIL: fixture applicants did not resolve to canonical People';
  end if;

  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claim.sub',v_strong_applicant::text,true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('role','authenticated','sub',v_strong_applicant)::text,
    true
  );

  v_strong_submission :=
    public.community_submit_new_artist_claim(
      'WK Fixture QZX 7F3C91 C611',
      'solo',
      'KE',
      array[]::text[],
      'artist',
      'I am this Artist and this is a rollback-only provenance fixture.',
      jsonb_build_array(
        jsonb_build_object(
          'type','official_social',
          'reference','https://example.invalid/claim-persona-strong'
        )
      )
    );

  v_strong_claim:=(v_strong_submission->>'claim_id')::uuid;

  perform set_config('request.jwt.claim.sub',v_strong_reviewer::text,true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('role','authenticated','sub',v_strong_reviewer)::text,
    true
  );

  v_strong_result :=
    public.community_admin_decide_artist_claim(
      v_strong_claim,
      'verified',
      'Rollback-only verified self-Artist identity with strong People authority.',
      null,null,null,null
    );

  v_strong_artist:=(v_strong_result->>'artist_id')::uuid;

  if v_strong_artist is null
     or v_strong_result->>'status'<>'verified'
     or (
       select count(*)
       from editorial.person_registry_artist_links link
       where link.person_resource_id=v_strong_person
         and link.registry_artist_id=v_strong_artist
         and link.link_state='active'
     )<>1
     or (
       select count(*)
       from platform_private.registry_evidence_assertions evidence
       where evidence.subject_type='artist'
         and evidence.subject_id=v_strong_artist
         and evidence.claim_key='registry.person_artist.link'
         and evidence.claim_payload=jsonb_build_object(
           'person_resource_id',v_strong_person::text,
           'registry_artist_id',v_strong_artist::text
         )
         and evidence.source_kind='artist_claim_review'
         and evidence.source_ref=
           'artist-claim:'||v_strong_claim::text||':person-artist-link'
     )<>1
  then
    raise exception
      'CLAIM_PERSONA_BEHAVIOR_FAIL: strong reviewer did not compose exact claim-derived persona authority';
  end if;

  v_strong_replay :=
    public.admin_finalize_verified_artist_claim_persona_v1(
      v_strong_claim,
      'Rollback-only idempotent persona replay.'
    );

  if coalesce(
       (v_strong_replay #>> '{persona_link,changed}')::boolean,
       true
     ) is not false
  then
    raise exception
      'CLAIM_PERSONA_BEHAVIOR_FAIL: strong persona replay was not idempotent';
  end if;

  perform set_config('request.jwt.claim.sub',v_weak_applicant::text,true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('role','authenticated','sub',v_weak_applicant)::text,
    true
  );

  v_weak_submission :=
    public.community_submit_new_artist_claim(
      'WK Fixture NVR 2B8D47 C613',
      'solo',
      'KE',
      array[]::text[],
      'artist',
      'I am this Artist and this is a rollback-only weaker-reviewer fixture.',
      jsonb_build_array(
        jsonb_build_object(
          'type','official_social',
          'reference','https://example.invalid/claim-persona-weak'
        )
      )
    );

  v_weak_claim:=(v_weak_submission->>'claim_id')::uuid;

  perform set_config('request.jwt.claim.sub',v_weak_reviewer::text,true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('role','authenticated','sub',v_weak_reviewer)::text,
    true
  );

  v_weak_result :=
    public.community_admin_decide_artist_claim(
      v_weak_claim,
      'verified',
      'Rollback-only representation review without People identity authority.',
      null,null,null,null
    );

  v_weak_artist:=(v_weak_result->>'artist_id')::uuid;

  if v_weak_artist is null
     or v_weak_result->>'status'<>'verified'
     or not exists (
       select 1
       from public.artist_representations representation
       where representation.artist_id=v_weak_artist
         and representation.user_id=v_weak_applicant
         and representation.status='active'
     )
     or exists (
       select 1
       from editorial.person_registry_artist_links link
       where link.registry_artist_id=v_weak_artist
         and link.link_state in ('active','disputed')
     )
  then
    raise exception
      'CLAIM_PERSONA_BEHAVIOR_FAIL: weaker reviewer semantics were escalated or broken';
  end if;

  begin
    perform public.admin_finalize_verified_artist_claim_persona_v1(
      v_weak_claim,
      'This weaker reviewer must not gain People identity authority.'
    );

    raise exception
      'CLAIM_PERSONA_BEHAVIOR_FAIL: weaker reviewer finalized persona authority';
  exception
    when insufficient_privilege then
      v_weak_denied:=true;
    when others then
      if sqlerrm like 'CLAIM_PERSONA_BEHAVIOR_FAIL:%' then
        raise;
      end if;
      if sqlstate='42501' then
        v_weak_denied:=true;
      else
        raise;
      end if;
  end;

  if not v_weak_denied then
    raise exception
      'CLAIM_PERSONA_BEHAVIOR_FAIL: weaker reviewer denial was not proven';
  end if;

  perform set_config('request.jwt.claim.sub',v_strong_reviewer::text,true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('role','authenticated','sub',v_strong_reviewer)::text,
    true
  );

  v_weak_final :=
    public.admin_finalize_verified_artist_claim_persona_v1(
      v_weak_claim,
      'Rollback-only stronger-admin persona finalization after ordinary claim review.'
    );

  if (
       select count(*)
       from editorial.person_registry_artist_links link
       where link.person_resource_id=v_weak_person
         and link.registry_artist_id=v_weak_artist
         and link.link_state='active'
     )<>1
     or (v_weak_final->>'registry_artist_id')::uuid<>v_weak_artist
  then
    raise exception
      'CLAIM_PERSONA_BEHAVIOR_FAIL: stronger later finalization did not create exact persona authority';
  end if;

  raise notice 'CREATOR_CLAIM_PERSONA_STRONG_AUTO_COMPOSITION=PASS';
  raise notice 'CREATOR_CLAIM_PERSONA_WEAK_REVIEW_NO_ESCALATION=PASS';
  raise notice 'CREATOR_CLAIM_PERSONA_STRONG_LATER_FINALIZATION=PASS';
  raise notice 'CREATOR_CLAIM_PERSONA_COMPOSITION_BEHAVIOR=PASS';
end
$behavior$;

rollback;
