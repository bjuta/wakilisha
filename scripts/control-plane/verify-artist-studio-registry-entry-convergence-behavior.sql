-- Rollback-only behavior proof for Artist Studio Registry Entry Convergence.

begin;
set local statement_timeout = '120s';
set local lock_timeout = '5s';

insert into public.registry_artists (
  id,
  slug,
  display_name,
  normalized_name,
  artist_type,
  origin_iso2,
  public_image_url,
  status,
  metadata
)
values
(
  '00000000-0000-4000-8000-00000000a501'::uuid,
  'artist-studio-draft-fixture',
  'Artist Studio Draft Fixture',
  'artist studio draft fixture',
  'solo',
  'KE',
  'https://example.invalid/non-public-artist.jpg',
  'draft',
  '{"fixture":"artist_studio_registry_entry"}'::jsonb
),
(
  '00000000-0000-4000-8000-00000000a502'::uuid,
  'artist-studio-resolution-target',
  'Artist Studio Resolution Target',
  'artist studio resolution target',
  'group',
  'KE',
  'https://example.invalid/resolution-target.jpg',
  'needs_review',
  '{"fixture":"artist_studio_registry_entry"}'::jsonb
),
(
  '00000000-0000-4000-8000-00000000a503'::uuid,
  'artist-studio-archived-fixture',
  'Artist Studio Archived Fixture',
  'artist studio archived fixture',
  'solo',
  'KE',
  'https://example.invalid/archived-artist.jpg',
  'archived',
  '{"fixture":"artist_studio_registry_entry"}'::jsonb
);

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
values
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-00000000a511'::uuid,
  'authenticated',
  'authenticated',
  'artist-studio-applicant@local.invalid',
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"name":"Artist Studio Applicant"}'::jsonb,
  now(),
  now()
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-00000000a512'::uuid,
  'authenticated',
  'authenticated',
  'artist-studio-reviewer@local.invalid',
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"name":"Artist Studio Reviewer"}'::jsonb,
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
values
(
  '00000000-0000-4000-8000-00000000a511'::uuid,
  'artist-studio-applicant@local.invalid',
  'Artist Studio Applicant',
  'active',
  '{"fixture":"artist_studio_registry_entry"}'::jsonb,
  true,
  'artiststudioapplicant',
  'artiststudioapplicant'
),
(
  '00000000-0000-4000-8000-00000000a512'::uuid,
  'artist-studio-reviewer@local.invalid',
  'Artist Studio Reviewer',
  'active',
  '{"fixture":"artist_studio_registry_entry"}'::jsonb,
  true,
  'artiststudioreviewer',
  'artiststudioreviewer'
)
on conflict (user_id)
do update
set
  email = excluded.email,
  display_name = excluded.display_name,
  status = 'active',
  metadata = excluded.metadata,
  is_public = true,
  username = excluded.username,
  username_normalized = excluded.username_normalized,
  updated_at = now();

insert into public.user_role_assignments (
  user_id,
  role_key,
  status,
  assigned_by,
  assigned_at,
  notes
)
values (
  '00000000-0000-4000-8000-00000000a512'::uuid,
  'administrator',
  'active',
  '00000000-0000-4000-8000-00000000a512'::uuid,
  now(),
  'Rollback-only Artist Studio convergence verifier'
)
on conflict (
  user_id,
  role_key
)
do update
set
  status = 'active',
  assigned_by = excluded.assigned_by,
  assigned_at = now(),
  expires_at = null,
  notes = excluded.notes,
  updated_at = now();


do $artist_studio_behavior$
declare
  v_applicant constant uuid :=
    '00000000-0000-4000-8000-00000000a511'::uuid;
  v_reviewer constant uuid :=
    '00000000-0000-4000-8000-00000000a512'::uuid;
  v_draft_artist constant uuid :=
    '00000000-0000-4000-8000-00000000a501'::uuid;
  v_resolution_target constant uuid :=
    '00000000-0000-4000-8000-00000000a502'::uuid;

  v_review_before integer;
  v_review_after integer;
  v_existing_claim jsonb;
  v_existing_replay jsonb;
  v_state jsonb;
  v_resolve_submission jsonb;
  v_resolve_replay jsonb;
  v_create_submission jsonb;
  v_queue jsonb;
  v_resolution jsonb;
  v_creation jsonb;
  v_workspace jsonb;
  v_resolved_claim_id uuid;
  v_created_claim_id uuid;
  v_created_artist_id uuid;
  v_created_artist_slug text;
  v_exact_rejected boolean := false;
begin
  select count(*)::integer
  into v_review_before
  from public.registry_review_items;

  if not exists (
    select 1
    from public.get_artist_studio_registry_candidates(
      'Artist Studio Draft Fixture',
      8
    ) candidate
    where candidate.artist_id =
          v_draft_artist
      and candidate.registry_state =
          'draft'
      and candidate.match_tier =
          'exact'
      and candidate.public_path is null
      and candidate.image_url is null
  ) then
    raise exception
      'ARTIST_STUDIO_BEHAVIOR_FAIL: bounded public search did not expose the draft identity safely';
  end if;

  if exists (
    select 1
    from public.get_artist_studio_registry_candidates(
      'Artist Studio Archived Fixture',
      8
    ) candidate
    where candidate.artist_id =
          '00000000-0000-4000-8000-00000000a503'::uuid
  ) then
    raise exception
      'ARTIST_STUDIO_BEHAVIOR_FAIL: archived Artist leaked through public identity candidate search';
  end if;

  perform set_config(
    'request.jwt.claim.role',
    'authenticated',
    true
  );
  perform set_config(
    'request.jwt.claim.sub',
    v_applicant::text,
    true
  );
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'role',
        'authenticated',
      'sub',
        v_applicant
    )::text,
    true
  );

  v_existing_claim :=
    public.community_submit_artist_claim(
      v_draft_artist,
      'artist',
      'I am the Artist and can verify this Registry identity.',
      jsonb_build_array(
        jsonb_build_object(
          'type',
            'official_social',
          'reference',
            'https://example.invalid/artist-studio-draft-proof'
        )
      )
    );

  v_existing_replay :=
    public.community_submit_artist_claim(
      v_draft_artist,
      'artist',
      'I am the Artist and can verify this Registry identity.',
      jsonb_build_array(
        jsonb_build_object(
          'type',
            'official_social',
          'reference',
            'https://example.invalid/artist-studio-draft-proof'
        )
      )
    );

  if v_existing_claim->>'claim_id' is distinct from
     v_existing_replay->>'claim_id'
     or coalesce(
          (v_existing_replay->>'idempotent_replay')::boolean,
          false
        ) is not true
     or (
       select count(*)
       from public.artist_claim_requests claim
       where claim.artist_id =
             v_draft_artist
         and claim.claimant_user_id =
             v_applicant
         and claim.status =
             'pending'
     ) <> 1
  then
    raise exception
      'ARTIST_STUDIO_BEHAVIOR_FAIL: existing Artist claim retry is not idempotent';
  end if;

  v_state :=
    public.community_get_artist_representation_state(
      v_draft_artist
    );

  if v_state #>> '{artist,status}' <> 'draft'
     or v_state #>> '{latest_claim,status}' <> 'pending'
     or coalesce(
          (v_state->>'can_claim')::boolean,
          true
        ) is not false
  then
    raise exception
      'ARTIST_STUDIO_BEHAVIOR_FAIL: draft Artist claim state is not representation-aware';
  end if;

  begin
    perform public.community_submit_new_artist_claim(
      'Artist Studio Draft Fixture',
      'solo',
      'KE',
      array[]::text[],
      'artist',
      'I am proposing this Artist but the Registry already knows the identity.',
      '[]'::jsonb
    );

    raise exception
      'ARTIST_STUDIO_BEHAVIOR_FAIL: exact Registry match created a proposed new Artist claim';
  exception
    when others then
      if sqlerrm =
         'artist_registry_match_found'
      then
        v_exact_rejected :=
          true;
      elsif sqlerrm like
            'ARTIST_STUDIO_BEHAVIOR_FAIL:%'
      then
        raise;
      else
        raise exception
          'ARTIST_STUDIO_BEHAVIOR_FAIL: exact Registry match failed for the wrong reason: %',
          sqlerrm;
      end if;
  end;

  if not v_exact_rejected then
    raise exception
      'ARTIST_STUDIO_BEHAVIOR_FAIL: exact Registry identity was not rejected from new Artist intake';
  end if;

  v_resolve_submission :=
    public.community_submit_new_artist_claim(
      'Kivuli Meridian Fixture',
      'group',
      'KE',
      array['Kivuli Meridian'],
      'manager',
      'I manage this Artist and can verify the relationship.',
      jsonb_build_array(
        jsonb_build_object(
          'type',
            'official_website',
          'reference',
            'https://example.invalid/kivuli-meridian'
        )
      )
    );

  v_resolve_replay :=
    public.community_submit_new_artist_claim(
      'Kivuli Meridian Fixture',
      'group',
      'KE',
      array['Kivuli Meridian'],
      'manager',
      'I manage this Artist and can verify the relationship.',
      jsonb_build_array(
        jsonb_build_object(
          'type',
            'official_website',
          'reference',
            'https://example.invalid/kivuli-meridian'
        )
      )
    );

  v_resolved_claim_id :=
    (v_resolve_submission->>'claim_id')::uuid;

  if v_resolved_claim_id is null
     or v_resolve_replay->>'claim_id' is distinct from
        v_resolve_submission->>'claim_id'
     or coalesce(
          (v_resolve_replay->>'idempotent_replay')::boolean,
          false
        ) is not true
  then
    raise exception
      'ARTIST_STUDIO_BEHAVIOR_FAIL: proposed Artist claim retry is not idempotent';
  end if;

  if exists (
    select 1
    from public.registry_artists artist
    where artist.display_name =
          'Kivuli Meridian Fixture'
  ) then
    raise exception
      'ARTIST_STUDIO_BEHAVIOR_FAIL: new Artist submission mutated canonical Registry truth before review';
  end if;

  if not exists (
    select 1
    from public.artist_claim_requests claim
    join public.artist_claim_proposed_identities proposal
      on proposal.claim_id =
         claim.id
    where claim.id =
          v_resolved_claim_id
      and claim.claim_kind =
          'proposed_artist'
      and claim.artist_id is null
      and claim.status =
          'pending'
      and proposal.display_name =
          'Kivuli Meridian Fixture'
      and proposal.accepted_artist_id is null
  ) then
    raise exception
      'ARTIST_STUDIO_BEHAVIOR_FAIL: proposed Artist did not land inside Artist Claim authority';
  end if;

  v_create_submission :=
    public.community_submit_new_artist_claim(
      'Taa Northbound Fixture',
      'collective',
      'KE',
      array['Taa Northbound'],
      'artist',
      'I am part of this Artist collective and can verify the relationship.',
      jsonb_build_array(
        jsonb_build_object(
          'type',
            'public_announcement',
          'reference',
            'https://example.invalid/taa-northbound'
        )
      )
    );

  v_created_claim_id :=
    (v_create_submission->>'claim_id')::uuid;

  perform set_config(
    'request.jwt.claim.sub',
    v_reviewer::text,
    true
  );
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'role',
        'authenticated',
      'sub',
        v_reviewer
    )::text,
    true
  );

  v_queue :=
    public.community_admin_get_artist_claims(
      'pending',
      200
    );

  if not exists (
    select 1
    from jsonb_array_elements(
      coalesce(
        v_queue,
        '[]'::jsonb
      )
    ) item
    where item->>'id' =
          v_resolved_claim_id::text
      and item->>'claim_kind' =
          'proposed_artist'
      and item #>> '{proposed_identity,display_name}' =
          'Kivuli Meridian Fixture'
  ) then
    raise exception
      'ARTIST_STUDIO_BEHAVIOR_FAIL: existing Artist Claims review surface omitted proposed identity';
  end if;

  v_resolution :=
    public.community_admin_resolve_artist_claim_existing(
      v_resolved_claim_id,
      v_resolution_target,
      'Resolved to the canonical Registry Artist during review.',
      null,
      null,
      null,
      null
    );

  if v_resolution->>'status' <> 'verified'
     or v_resolution->>'artist_id' <>
        v_resolution_target::text
     or v_resolution->>'resolution' <>
        'existing_artist'
  then
    raise exception
      'ARTIST_STUDIO_BEHAVIOR_FAIL: proposed Artist did not resolve through existing claim verification';
  end if;

  if not exists (
    select 1
    from public.artist_claim_proposed_identities proposal
    where proposal.claim_id =
          v_resolved_claim_id
      and proposal.accepted_artist_id =
          v_resolution_target
  )
     or not exists (
       select 1
       from public.artist_representations representation
       where representation.artist_id =
             v_resolution_target
         and representation.user_id =
             v_applicant
         and representation.status =
             'active'
     )
  then
    raise exception
      'ARTIST_STUDIO_BEHAVIOR_FAIL: resolved existing Artist did not produce canonical representation authority';
  end if;

  v_creation :=
    public.community_admin_decide_artist_claim(
      v_created_claim_id,
      'verified',
      'Accepted as a new Registry Artist after duplicate review.',
      null,
      null,
      null,
      null
    );

  v_created_artist_id :=
    (v_creation->>'artist_id')::uuid;

  if v_created_artist_id is null
     or v_creation->>'artist_status' <>
        'active'
  then
    raise exception
      'ARTIST_STUDIO_BEHAVIOR_FAIL: accepted new Artist did not create one Registry draft';
  end if;

  select artist.slug
  into v_created_artist_slug
  from public.registry_artists artist
  where artist.id =
        v_created_artist_id;

  if v_created_artist_slug <>
     public.wk_slugify_text(
       'Taa Northbound Fixture'
     )
     or (
       select count(*)
       from public.registry_artists artist
       where artist.id =
             v_created_artist_id
         and artist.display_name =
             'Taa Northbound Fixture'
         and artist.status =
             'active'
     ) <> 1
     or not exists (
       select 1
       from public.artist_claim_proposed_identities proposal
       where proposal.claim_id =
             v_created_claim_id
         and proposal.accepted_artist_id =
             v_created_artist_id
     )
     or not exists (
       select 1
       from public.registry_canonical_write_events event_row
       where event_row.registry_entity_type =
             'artist'
         and event_row.registry_entity_id =
             v_created_artist_id::text
         and event_row.source_suggestion_id =
             v_created_claim_id::text
         and event_row.source_table =
             'artist_claim_proposed_identities'
         and event_row.action =
             'create_from_artist_claim'
         and event_row.status =
             'applied'
     )
  then
    raise exception
      'ARTIST_STUDIO_BEHAVIOR_FAIL: new Artist Registry creation lost deterministic identity or provenance';
  end if;

  perform set_config(
    'request.jwt.claim.sub',
    v_applicant::text,
    true
  );
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'role',
        'authenticated',
      'sub',
        v_applicant
    )::text,
    true
  );

  v_workspace :=
    public.community_get_artist_management_workspace(
      v_created_artist_slug
    );

  if v_workspace #>> '{artist,id}' <>
     v_created_artist_id::text
     or v_workspace #>> '{artist,status}' <>
        'active'
     or v_workspace #>> '{representation,status}' <>
        'active'
     or coalesce(
          (v_workspace #>> '{representation,permissions,profile}')::boolean,
          false
        ) is not true
  then
    raise exception
      'ARTIST_STUDIO_BEHAVIOR_FAIL: approved representative cannot enter Artist Studio for the accepted draft Artist';
  end if;

  if not exists (
    select 1
    from public.get_artist_studio_registry_candidates(
      'Taa Northbound Fixture',
      8
    ) candidate
    where candidate.artist_id =
          v_created_artist_id
      and candidate.registry_state =
          'active'
      and candidate.public_path =
          '/artists/' || v_created_artist_slug
      and candidate.image_url is null
  ) then
    raise exception
      'ARTIST_STUDIO_BEHAVIOR_FAIL: accepted Registry draft is not safely discoverable for duplicate prevention';
  end if;

  select count(*)::integer
  into v_review_after
  from public.registry_review_items;

  if v_review_after <>
     v_review_before
  then
    raise exception
      'ARTIST_STUDIO_BEHAVIOR_FAIL: Artist Studio intake manufactured generic Registry review items';
  end if;

  raise notice
    'ARTIST_STUDIO_REGISTRY_ENTRY_CONVERGENCE_BEHAVIOR_PASS';
end;
$artist_studio_behavior$;

rollback;
