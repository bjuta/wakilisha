-- Rollback-only behavioral acceptance for Music Provenance Slice 1 / #1113.
--
-- Run only after both Slice 1 migrations are applied to a disposable Preview.
-- The entire fixture rolls back. It must never be used as a corpus backfill.

begin;

set local statement_timeout='180s';
set local lock_timeout='5s';

do $behavior$
declare
  v_admin uuid:=gen_random_uuid();
  v_person uuid:=gen_random_uuid();
  v_track uuid:=gen_random_uuid();
  v_group_artist uuid:=gen_random_uuid();
  v_solo_artist uuid:=gen_random_uuid();
  v_work uuid:=gen_random_uuid();
  v_track_work_link uuid:=gen_random_uuid();

  v_work_evidence uuid:=gen_random_uuid();
  v_track_work_evidence uuid:=gen_random_uuid();
  v_track_attestation_evidence uuid:=gen_random_uuid();
  v_work_attestation_evidence uuid:=gen_random_uuid();
  v_membership_evidence uuid:=gen_random_uuid();
  v_person_artist_evidence uuid:=gen_random_uuid();

  v_track_attestation uuid:=gen_random_uuid();
  v_work_attestation uuid:=gen_random_uuid();
  v_permission_root uuid:=gen_random_uuid();
  v_permission_withdraw uuid:=gen_random_uuid();

  v_work_result jsonb;
  v_work_replay jsonb;
  v_link_result jsonb;
  v_link_replay jsonb;
  v_track_contribution_result jsonb;
  v_track_contribution_replay jsonb;
  v_work_contribution_result jsonb;
  v_membership_result jsonb;
  v_person_artist_result jsonb;

  v_track_contribution_id uuid;
  v_work_contribution_id uuid;

  v_rights_before bigint;
  v_rights_after bigint;
  v_track_contributions_before_membership bigint;
  v_track_contributions_after_membership bigint;
  v_active_grants bigint;
  v_failed_verifiers bigint;
  v_passed_operations bigint;
  v_state_count bigint;
  v_permission_count bigint;
  v_update_blocked boolean:=false;
  v_self_claim_blocked boolean:=false;
  v_withdrawn_replay_blocked boolean:=false;
begin
  if to_regclass('platform_private.registry_contribution_attestations') is null
     or to_regclass('editorial.person_registry_artist_links') is null
     or to_regclass('public.registry_artist_person_memberships') is null
     or to_regprocedure('public.admin_create_registry_work_v1(uuid)') is null
     or to_regprocedure('public.admin_admit_registry_track_work_link_v1(uuid)') is null
     or to_regprocedure('public.admin_admit_registry_track_contribution_v1(uuid)') is null
     or to_regprocedure('public.admin_admit_registry_work_contribution_v1(uuid)') is null
  then
    raise exception
      'MUSIC_PROVENANCE_SLICE1_BEHAVIOR_FAIL: Slice 1 authority is not installed';
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version='20260929160420'
  )
  or not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version='20260929160423'
  ) then
    raise exception
      'MUSIC_PROVENANCE_SLICE1_BEHAVIOR_FAIL: exact Slice 1 migration identities are not present';
  end if;

  -- Rollback-only authenticated reviewer.
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  values (
    '00000000-0000-0000-0000-000000000000'::uuid,
    v_admin,
    'authenticated',
    'authenticated',
    'provenance-slice1-'||replace(v_admin::text,'-','')||'@local.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Provenance Slice 1 Verifier"}'::jsonb,
    now(),
    now()
  );

  insert into public.user_profiles (
    user_id,
    email,
    display_name,
    status,
    metadata,
    is_public,
    username,
    username_normalized
  )
  values (
    v_admin,
    'provenance-slice1-'||replace(v_admin::text,'-','')||'@local.invalid',
    'Provenance Slice 1 Verifier',
    'active',
    '{"fixture":"music_provenance_slice1"}'::jsonb,
    false,
    'provenance'||left(replace(v_admin::text,'-',''),12),
    'provenance'||left(replace(v_admin::text,'-',''),12)
  )
  on conflict (user_id)
  do update
  set
    status='active',
    metadata=excluded.metadata,
    updated_at=now();

  insert into public.user_role_assignments (
    user_id,
    role_key,
    status,
    assigned_by,
    assigned_at,
    notes
  )
  values (
    v_admin,
    'administrator',
    'active',
    v_admin,
    now(),
    'Rollback-only Music Provenance Slice 1 verifier'
  )
  on conflict (user_id,role_key)
  do update
  set
    status='active',
    assigned_by=excluded.assigned_by,
    assigned_at=now(),
    expires_at=null,
    notes=excluded.notes,
    updated_at=now();

  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'role','authenticated',
      'sub',v_admin
    )::text,
    true
  );

  if not coalesce(public.current_user_has_capability('manage_registry'),false)
     or not coalesce(
       public.current_user_has_capability('manage_people_identity'),
       false
     )
  then
    raise exception
      'MUSIC_PROVENANCE_SLICE1_BEHAVIOR_FAIL: verifier fixture lacks required capabilities';
  end if;

  -- Direct SQL acceptance uses a rollback-only executor binding because
  -- session_user is the database operator rather than the API authenticator.
  insert into platform_private.system_actor_executor_bindings (
    actor_key,
    executor_kind,
    executor_key,
    status
  )
  values (
    'registry_provenance_admin',
    'database_role',
    session_user,
    'active'
  )
  on conflict (actor_key,executor_kind,executor_key)
  do update
  set
    status='active',
    updated_at=now();

  -- One canonical Person fixture, independent of Registry Artist identity.
  insert into editorial.resources (
    id,
    resource_kind,
    owner_id,
    visibility,
    lifecycle_state,
    created_by
  )
  values (
    v_person,
    'person',
    null,
    'internal',
    'active',
    v_admin
  );

  insert into editorial.people (
    resource_id,
    resource_kind,
    person_state,
    identity_revision,
    created_by,
    updated_by
  )
  values (
    v_person,
    'person',
    'active',
    1,
    v_admin,
    v_admin
  );

  -- Canonical fixture identities used by the provenance graph.
  insert into public.registry_tracks (
    id,
    slug,
    title,
    normalized_title,
    status,
    metadata
  )
  values (
    v_track,
    'provenance-slice1-'||left(replace(v_track::text,'-',''),12),
    'Provenance Slice 1 Recording',
    'provenance slice 1 recording',
    'active',
    '{"fixture":"music_provenance_slice1"}'::jsonb
  );

  insert into public.registry_artists (
    id,
    slug,
    display_name,
    normalized_name,
    artist_type,
    status,
    metadata
  )
  values
  (
    v_group_artist,
    'provenance-group-'||left(replace(v_group_artist::text,'-',''),12),
    'Provenance Fixture Group',
    'provenance fixture group',
    'group',
    'active',
    '{"fixture":"music_provenance_slice1"}'::jsonb
  ),
  (
    v_solo_artist,
    'provenance-solo-'||left(replace(v_solo_artist::text,'-',''),12),
    'Provenance Fixture Solo Artist',
    'provenance fixture solo artist',
    'solo',
    'active',
    '{"fixture":"music_provenance_slice1"}'::jsonb
  );

  select count(*)
  into v_rights_before
  from public.registry_rights_claims;

  -- -----------------------------------------------------------------------
  -- Evidence -> Work.
  -- -----------------------------------------------------------------------

  insert into platform_private.registry_evidence_assertions (
    id,
    subject_type,
    subject_id,
    claim_key,
    claim_payload,
    trust_class,
    source_kind,
    source_ref,
    source_payload_fingerprint,
    observed_at,
    recorded_by_principal_key,
    assertion_fingerprint,
    originator_ref,
    lineage_key,
    verification_method,
    source_use_basis
  )
  values (
    v_work_evidence,
    'work',
    v_work,
    'registry.work.create',
    jsonb_build_object(
      'title','Provenance Slice 1 Work',
      'normalized_title','provenance slice 1 work',
      'metadata',jsonb_build_object(
        'fixture','music_provenance_slice1'
      )
    ),
    'INTERNAL_FACT',
    'rollback_verifier',
    'music-provenance-slice1:work',
    encode(
      extensions.digest(
        ('work-source:'||v_work::text)::text,
        'sha256'
      ),
      'hex'
    ),
    clock_timestamp(),
    'user:'||v_admin::text,
    encode(
      extensions.digest(
        ('work-assertion:'||v_work::text)::text,
        'sha256'
      ),
      'hex'
    ),
    'rollback-verifier',
    'music-provenance-slice1-fixture',
    'controlled_fixture',
    'internal_acceptance'
  );

  v_work_result:=
    public.admin_create_registry_work_v1(v_work_evidence);

  if (v_work_result->>'id')::uuid<>v_work
     or coalesce(
          (v_work_result#>>'{_authority,verified}')::boolean,
          false
        ) is not true
  then
    raise exception
      'MUSIC_PROVENANCE_SLICE1_BEHAVIOR_FAIL: governed Work creation did not verify';
  end if;

  v_work_replay:=
    public.admin_create_registry_work_v1(v_work_evidence);

  if (v_work_replay->>'id')::uuid<>v_work
     or v_work_replay#>>'{_authority,mode}'<>'already_current'
     or (
       select count(*)
       from public.registry_works work
       where work.id=v_work
     )<>1
  then
    raise exception
      'MUSIC_PROVENANCE_SLICE1_BEHAVIOR_FAIL: Work admission retry is not idempotent';
  end if;

  -- -----------------------------------------------------------------------
  -- Evidence -> exact Track↔Work relation.
  -- -----------------------------------------------------------------------

  insert into platform_private.registry_evidence_assertions (
    id,
    subject_type,
    subject_id,
    claim_key,
    claim_payload,
    trust_class,
    source_kind,
    source_ref,
    source_payload_fingerprint,
    observed_at,
    recorded_by_principal_key,
    assertion_fingerprint,
    originator_ref,
    lineage_key,
    verification_method,
    source_use_basis
  )
  values (
    v_track_work_evidence,
    'track_work_link',
    v_track_work_link,
    'registry.track_work_link.admit',
    jsonb_build_object(
      'track_id',v_track::text,
      'work_id',v_work::text,
      'relationship_kind','embodies'
    ),
    'INTERNAL_FACT',
    'rollback_verifier',
    'music-provenance-slice1:track-work',
    encode(
      extensions.digest(
        ('track-work-source:'||v_track_work_link::text)::text,
        'sha256'
      ),
      'hex'
    ),
    clock_timestamp(),
    'user:'||v_admin::text,
    encode(
      extensions.digest(
        ('track-work-assertion:'||v_track_work_link::text)::text,
        'sha256'
      ),
      'hex'
    ),
    'rollback-verifier',
    'music-provenance-slice1-fixture',
    'controlled_fixture',
    'internal_acceptance'
  );

  v_link_result:=
    public.admin_admit_registry_track_work_link_v1(
      v_track_work_evidence
    );

  v_link_replay:=
    public.admin_admit_registry_track_work_link_v1(
      v_track_work_evidence
    );

  if (v_link_result->>'id')::uuid<>v_track_work_link
     or (v_link_replay->>'id')::uuid<>v_track_work_link
     or v_link_replay#>>'{_authority,mode}'<>'already_current'
     or (
       select count(*)
       from public.registry_track_work_links link
       where link.id=v_track_work_link
         and link.track_id=v_track
         and link.work_id=v_work
         and link.relationship_kind='embodies'
         and link.status='verified'
     )<>1
  then
    raise exception
      'MUSIC_PROVENANCE_SLICE1_BEHAVIOR_FAIL: governed Track-to-Work admission or replay failed';
  end if;

  -- -----------------------------------------------------------------------
  -- Self-claim is evidence, not a canonical contribution until confirmed.
  -- No Person is manufactured: credited_as remains enough.
  -- -----------------------------------------------------------------------

  insert into platform_private.registry_evidence_assertions (
    id,
    subject_type,
    subject_id,
    claim_key,
    claim_payload,
    trust_class,
    source_kind,
    source_ref,
    source_payload_fingerprint,
    observed_at,
    recorded_by_principal_key,
    assertion_fingerprint,
    originator_ref,
    lineage_key,
    verification_method,
    source_use_basis
  )
  values (
    v_track_attestation_evidence,
    'track',
    v_track,
    'registry.contribution.attestation',
    jsonb_build_object(
      'credited_as','Unresolved Fixture Producer',
      'role_key','producer',
      'elicitation_method','self_claim'
    ),
    'USER_CONTENT',
    'first_party_attestation',
    'music-provenance-slice1:self-claim',
    encode(
      extensions.digest(
        ('track-attestation-source:'||v_track_attestation::text)::text,
        'sha256'
      ),
      'hex'
    ),
    clock_timestamp(),
    'user:'||v_admin::text,
    encode(
      extensions.digest(
        ('track-attestation-assertion:'||v_track_attestation::text)::text,
        'sha256'
      ),
      'hex'
    ),
    'user:'||v_admin::text,
    'music-provenance-slice1-self-claim',
    'self_attestation',
    'creator_attestation'
  );

  insert into platform_private.registry_contribution_attestations (
    id,
    evidence_assertion_id,
    track_id,
    credited_as,
    role_key,
    asserting_user_id,
    stated_relationship,
    elicitation_method,
    prompt_key,
    prompt_version,
    candidate_shown
  )
  values (
    v_track_attestation,
    v_track_attestation_evidence,
    v_track,
    'Unresolved Fixture Producer',
    'producer',
    v_admin,
    'self',
    'self_claim',
    'provenance.rollback.track.producer',
    'v1',
    false
  );

  insert into platform_private.registry_contribution_attestation_state_events (
    attestation_id,
    state,
    supporting_evidence_assertion_id,
    actor_principal_key,
    actor_user_id,
    reason
  )
  values (
    v_track_attestation,
    'asserted',
    v_track_attestation_evidence,
    'user:'||v_admin::text,
    v_admin,
    'Rollback verifier initial self-claim.'
  );

  begin
    perform public.admin_admit_registry_track_contribution_v1(
      v_track_attestation
    );
  exception
    when others then
      if sqlerrm like
         'WK_PROVENANCE_ATTESTATION_REVIEW_REQUIRED:%'
      then
        v_self_claim_blocked:=true;
      else
        raise;
      end if;
  end;

  if not v_self_claim_blocked
     or exists (
       select 1
       from public.registry_track_contributions contribution
       where contribution.evidence_assertion_id=
             v_track_attestation_evidence
     )
  then
    raise exception
      'MUSIC_PROVENANCE_SLICE1_BEHAVIOR_FAIL: unconfirmed self-claim was silently promoted';
  end if;

  insert into platform_private.registry_contribution_attestation_state_events (
    attestation_id,
    state,
    supporting_evidence_assertion_id,
    actor_principal_key,
    actor_user_id,
    reason
  )
  values (
    v_track_attestation,
    'confirmed',
    v_track_attestation_evidence,
    'user:'||v_admin::text,
    v_admin,
    'Rollback verifier reviewed confirmation.'
  );

  v_track_contribution_result:=
    public.admin_admit_registry_track_contribution_v1(
      v_track_attestation
    );

  v_track_contribution_id:=
    (v_track_contribution_result->>'id')::uuid;

  if v_track_contribution_id is null
     or coalesce(
          (v_track_contribution_result#>>'{_authority,verified}')::boolean,
          false
        ) is not true
     or (
       select count(*)
       from public.registry_track_contributions contribution
       where contribution.id=v_track_contribution_id
         and contribution.track_id=v_track
         and contribution.person_resource_id is null
         and contribution.organization_resource_id is null
         and contribution.artist_id is null
         and contribution.credited_as='Unresolved Fixture Producer'
         and contribution.role_key='producer'
         and contribution.status='verified'
         and contribution.evidence_assertion_id=
             v_track_attestation_evidence
     )<>1
  then
    raise exception
      'MUSIC_PROVENANCE_SLICE1_BEHAVIOR_FAIL: unresolved credited_as contribution was not admitted exactly';
  end if;

  v_track_contribution_replay:=
    public.admin_admit_registry_track_contribution_v1(
      v_track_attestation
    );

  if (v_track_contribution_replay->>'id')::uuid<>
       v_track_contribution_id
     or v_track_contribution_replay#>>'{_authority,mode}'<>
        'already_current'
  then
    raise exception
      'MUSIC_PROVENANCE_SLICE1_BEHAVIOR_FAIL: Recording contribution retry created duplicate authority';
  end if;

  -- Creator-controlled sharing versions preserve grants and withdrawal.
  insert into platform_private.registry_contribution_attestation_permission_versions (
    id,
    attestation_id,
    change_kind,
    policy_key,
    policy_version,
    public_display,
    cmo_rights_contexts,
    approved_partner_keys,
    third_party_commercial_reuse,
    actor_user_id,
    reason
  )
  values (
    v_permission_root,
    v_track_attestation,
    'grant',
    'creator-sharing',
    'v1',
    true,
    array['fixture_cmo']::text[],
    array['fixture_partner']::text[],
    false,
    v_admin,
    'Rollback verifier scoped sharing grant.'
  );

  insert into platform_private.registry_contribution_attestation_permission_versions (
    id,
    attestation_id,
    supersedes_permission_id,
    change_kind,
    policy_key,
    policy_version,
    public_display,
    cmo_rights_contexts,
    approved_partner_keys,
    third_party_commercial_reuse,
    actor_user_id,
    reason
  )
  values (
    v_permission_withdraw,
    v_track_attestation,
    v_permission_root,
    'withdraw',
    'creator-sharing',
    'v1',
    false,
    '{}'::text[],
    '{}'::text[],
    false,
    v_admin,
    'Rollback verifier sharing withdrawal.'
  );

  select count(*)
  into v_permission_count
  from platform_private.registry_contribution_attestation_permission_versions permission
  where permission.attestation_id=v_track_attestation;

  if v_permission_count<>2
     or not exists (
       select 1
       from platform_private.registry_contribution_attestation_permission_versions permission
       where permission.id=v_permission_root
         and permission.change_kind='grant'
         and permission.public_display
     )
     or not exists (
       select 1
       from platform_private.registry_contribution_attestation_permission_versions permission
       where permission.id=v_permission_withdraw
         and permission.supersedes_permission_id=v_permission_root
         and permission.change_kind='withdraw'
         and not permission.public_display
     )
  then
    raise exception
      'MUSIC_PROVENANCE_SLICE1_BEHAVIOR_FAIL: sharing withdrawal destroyed or forked permission history';
  end if;

  begin
    update platform_private.registry_contribution_attestation_permission_versions
    set reason='Illegal destructive rewrite'
    where id=v_permission_root;
  exception
    when sqlstate '55000' then
      v_update_blocked:=true;
  end;

  if not v_update_blocked then
    raise exception
      'MUSIC_PROVENANCE_SLICE1_BEHAVIOR_FAIL: permission history is mutable';
  end if;

  -- Dispute and withdrawal are history, not destructive deletion.
  insert into platform_private.registry_contribution_attestation_state_events (
    attestation_id,
    state,
    supporting_evidence_assertion_id,
    actor_principal_key,
    actor_user_id,
    reason
  )
  values
  (
    v_track_attestation,
    'disputed',
    v_track_attestation_evidence,
    'user:'||v_admin::text,
    v_admin,
    'Rollback verifier dispute.'
  ),
  (
    v_track_attestation,
    'withdrawn',
    v_track_attestation_evidence,
    'user:'||v_admin::text,
    v_admin,
    'Rollback verifier withdrawal.'
  );

  select count(*)
  into v_state_count
  from platform_private.registry_contribution_attestation_state_events event
  where event.attestation_id=v_track_attestation;

  if v_state_count<>4
     or platform_private.registry_contribution_attestation_current_state_v1(
          v_track_attestation
        )<>'withdrawn'
     or not exists (
       select 1
       from public.registry_track_contributions contribution
       where contribution.id=v_track_contribution_id
     )
  then
    raise exception
      'MUSIC_PROVENANCE_SLICE1_BEHAVIOR_FAIL: dispute/withdrawal destroyed historical attestation or canonical history';
  end if;

  begin
    perform public.admin_admit_registry_track_contribution_v1(
      v_track_attestation
    );
  exception
    when others then
      if sqlerrm like
         'WK_PROVENANCE_ATTESTATION_REVIEW_REQUIRED:%'
      then
        v_withdrawn_replay_blocked:=true;
      else
        raise;
      end if;
  end;

  if not v_withdrawn_replay_blocked then
    raise exception
      'MUSIC_PROVENANCE_SLICE1_BEHAVIOR_FAIL: withdrawn attestation remained admissible';
  end if;

  -- -----------------------------------------------------------------------
  -- Work contribution stays distinct from Recording contribution.
  -- -----------------------------------------------------------------------

  insert into platform_private.registry_evidence_assertions (
    id,
    subject_type,
    subject_id,
    claim_key,
    claim_payload,
    trust_class,
    source_kind,
    source_ref,
    source_payload_fingerprint,
    observed_at,
    recorded_by_principal_key,
    assertion_fingerprint,
    originator_ref,
    lineage_key,
    verification_method,
    source_use_basis
  )
  values (
    v_work_attestation_evidence,
    'work',
    v_work,
    'registry.contribution.attestation',
    jsonb_build_object(
      'credited_as','Unresolved Fixture Composer',
      'role_key','composer',
      'elicitation_method','open_response'
    ),
    'USER_CONTENT',
    'first_party_attestation',
    'music-provenance-slice1:work-attestation',
    encode(
      extensions.digest(
        ('work-attestation-source:'||v_work_attestation::text)::text,
        'sha256'
      ),
      'hex'
    ),
    clock_timestamp(),
    'user:'||v_admin::text,
    encode(
      extensions.digest(
        ('work-attestation-assertion:'||v_work_attestation::text)::text,
        'sha256'
      ),
      'hex'
    ),
    'user:'||v_admin::text,
    'music-provenance-slice1-open-response',
    'reviewed_attestation',
    'creator_attestation'
  );

  insert into platform_private.registry_contribution_attestations (
    id,
    evidence_assertion_id,
    work_id,
    credited_as,
    role_key,
    asserting_user_id,
    stated_relationship,
    elicitation_method,
    prompt_key,
    prompt_version,
    candidate_shown
  )
  values (
    v_work_attestation,
    v_work_attestation_evidence,
    v_work,
    'Unresolved Fixture Composer',
    'composer',
    v_admin,
    'creator',
    'open_response',
    'provenance.rollback.work.composer',
    'v1',
    false
  );

  insert into platform_private.registry_contribution_attestation_state_events (
    attestation_id,
    state,
    supporting_evidence_assertion_id,
    actor_principal_key,
    actor_user_id,
    reason
  )
  values
  (
    v_work_attestation,
    'asserted',
    v_work_attestation_evidence,
    'user:'||v_admin::text,
    v_admin,
    'Rollback verifier open response.'
  ),
  (
    v_work_attestation,
    'corroborated',
    v_work_attestation_evidence,
    'user:'||v_admin::text,
    v_admin,
    'Rollback verifier corroboration.'
  );

  v_work_contribution_result:=
    public.admin_admit_registry_work_contribution_v1(
      v_work_attestation
    );

  v_work_contribution_id:=
    (v_work_contribution_result->>'id')::uuid;

  if v_work_contribution_id is null
     or (
       select count(*)
       from public.registry_work_contributions contribution
       where contribution.id=v_work_contribution_id
         and contribution.work_id=v_work
         and contribution.person_resource_id is null
         and contribution.organization_resource_id is null
         and contribution.artist_id is null
         and contribution.credited_as='Unresolved Fixture Composer'
         and contribution.role_key='composer'
         and contribution.status='verified'
     )<>1
  then
    raise exception
      'MUSIC_PROVENANCE_SLICE1_BEHAVIOR_FAIL: Work contribution admission failed';
  end if;

  -- -----------------------------------------------------------------------
  -- Explicit Person↔Artist evidence and typed Group membership.
  -- Neither path creates a Recording contribution.
  -- -----------------------------------------------------------------------

  insert into platform_private.registry_evidence_assertions (
    id,
    subject_type,
    subject_id,
    claim_key,
    claim_payload,
    trust_class,
    source_kind,
    source_ref,
    source_payload_fingerprint,
    observed_at,
    recorded_by_principal_key,
    assertion_fingerprint
  )
  values (
    v_person_artist_evidence,
    'artist',
    v_solo_artist,
    'registry.person_artist.link',
    jsonb_build_object(
      'person_resource_id',v_person::text,
      'registry_artist_id',v_solo_artist::text
    ),
    'INTERNAL_FACT',
    'rollback_verifier',
    'music-provenance-slice1:person-artist',
    encode(
      extensions.digest(
        ('person-artist-source:'||v_solo_artist::text)::text,
        'sha256'
      ),
      'hex'
    ),
    clock_timestamp(),
    'user:'||v_admin::text,
    encode(
      extensions.digest(
        ('person-artist-assertion:'||v_solo_artist::text)::text,
        'sha256'
      ),
      'hex'
    )
  );

  v_person_artist_result:=
    public.admin_link_person_registry_artist_v1(
      v_person,
      1,
      v_solo_artist,
      v_person_artist_evidence,
      'Rollback verifier exact Person-to-Artist identity.'
    );

  if (v_person_artist_result->>'person_resource_id')::uuid<>v_person
     or (
       select count(*)
       from editorial.person_registry_artist_links link
       where link.person_resource_id=v_person
         and link.registry_artist_id=v_solo_artist
         and link.link_state='active'
         and link.evidence_assertion_id=v_person_artist_evidence
     )<>1
  then
    raise exception
      'MUSIC_PROVENANCE_SLICE1_BEHAVIOR_FAIL: Person-to-Registry-Artist bridge admission failed';
  end if;

  select count(*)
  into v_track_contributions_before_membership
  from public.registry_track_contributions;

  insert into platform_private.registry_evidence_assertions (
    id,
    subject_type,
    subject_id,
    claim_key,
    claim_payload,
    trust_class,
    source_kind,
    source_ref,
    source_payload_fingerprint,
    observed_at,
    recorded_by_principal_key,
    assertion_fingerprint
  )
  values (
    v_membership_evidence,
    'artist',
    v_group_artist,
    'registry.artist.person_membership',
    jsonb_build_object(
      'group_artist_id',v_group_artist::text,
      'person_resource_id',v_person::text,
      'role_key','member'
    ),
    'INTERNAL_FACT',
    'rollback_verifier',
    'music-provenance-slice1:group-membership',
    encode(
      extensions.digest(
        ('membership-source:'||v_group_artist::text)::text,
        'sha256'
      ),
      'hex'
    ),
    clock_timestamp(),
    'user:'||v_admin::text,
    encode(
      extensions.digest(
        ('membership-assertion:'||v_group_artist::text)::text,
        'sha256'
      ),
      'hex'
    )
  );

  v_membership_result:=
    public.admin_admit_registry_artist_person_membership_v1(
      v_group_artist,
      v_person,
      'member',
      null,
      null,
      null,
      v_membership_evidence
    );

  select count(*)
  into v_track_contributions_after_membership
  from public.registry_track_contributions;

  if (v_membership_result->>'group_artist_id')::uuid<>v_group_artist
     or (v_membership_result->>'person_resource_id')::uuid<>v_person
     or v_track_contributions_after_membership<>
        v_track_contributions_before_membership
  then
    raise exception
      'MUSIC_PROVENANCE_SLICE1_BEHAVIOR_FAIL: Group membership inferred Recording participation';
  end if;

  -- -----------------------------------------------------------------------
  -- Contribution never creates Rights Claims; verifier passes; authority
  -- returns to zero at rest.
  -- -----------------------------------------------------------------------

  select count(*)
  into v_rights_after
  from public.registry_rights_claims;

  if v_rights_after<>v_rights_before then
    raise exception
      'MUSIC_PROVENANCE_SLICE1_BEHAVIOR_FAIL: contribution admission inferred a Rights Claim';
  end if;

  select count(*)
  into v_active_grants
  from platform_private.registry_execution_grants execution_grant
  where execution_grant.actor_key='registry_provenance_admin'
    and execution_grant.status='active'
    and execution_grant.expires_at>now();

  if v_active_grants<>0 then
    raise exception
      'MUSIC_PROVENANCE_SLICE1_BEHAVIOR_FAIL: exact Registry authority remained active at rest';
  end if;

  select count(*)
  into v_failed_verifiers
  from platform_private.registry_mutation_operations operation
  where operation.actor_key='registry_provenance_admin'
    and operation.verifier_status is distinct from 'passed';

  if v_failed_verifiers<>0 then
    raise exception
      'MUSIC_PROVENANCE_SLICE1_BEHAVIOR_FAIL: provenance operation lacks independent verifier PASS';
  end if;

  select count(*)
  into v_passed_operations
  from platform_private.registry_mutation_operations operation
  where operation.actor_key='registry_provenance_admin'
    and operation.status='succeeded'
    and operation.verifier_status='passed';

  if v_passed_operations<>4 then
    raise exception
      'MUSIC_PROVENANCE_SLICE1_BEHAVIOR_FAIL: expected exactly four verified canonical fixture operations, got %',
      v_passed_operations;
  end if;

  if (
    select count(*)
    from platform_private.registry_operation_write_events write_event
    join platform_private.registry_mutation_operations operation
      on operation.id=write_event.operation_id
    where operation.actor_key='registry_provenance_admin'
  )<>4
  then
    raise exception
      'MUSIC_PROVENANCE_SLICE1_BEHAVIOR_FAIL: canonical event causality is not exactly one event per fixture operation';
  end if;

  raise notice 'MUSIC_PROVENANCE_SLICE1_BEHAVIOR_V1_PASS';
end
$behavior$;

rollback;
