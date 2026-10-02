-- WAKILISHA Artist Claim Evidence Follow-Up v1
-- Narrow forward repair for Artist Claim evidence continuity.
-- Existing pending claims remain authoritative and may receive bounded,
-- duplicate-safe evidence on idempotent replay. Verification fails closed
-- when no claim evidence exists. Rejection remains available without evidence.

begin;

set local check_function_bodies = on;

do $artist_claim_evidence_followup_preflight$
declare
  v_decide_definition text;
begin
  if to_regclass('public.artist_claim_requests') is null
     or to_regclass('public.artist_claim_evidence') is null
     or to_regclass('public.artist_claim_proposed_identities') is null
  then
    raise exception
      'ARTIST_CLAIM_EVIDENCE_FOLLOWUP_PREFLIGHT_FAIL: required Artist Claim tables are missing';
  end if;

  if to_regprocedure(
       'public.community_submit_artist_claim(uuid,text,text,jsonb)'
     ) is null
     or to_regprocedure(
       'public.community_submit_new_artist_claim(text,text,text,text[],text,text,jsonb)'
     ) is null
     or to_regprocedure(
       'public.community_submit_artist_claim_v3(uuid,text,text,text,text,text,text,text,jsonb)'
     ) is null
     or to_regprocedure(
       'public.community_submit_new_artist_claim_v3(text,text,text,text[],text,text,text,text,text,text,text,jsonb)'
     ) is null
     or to_regprocedure(
       'public.community_admin_decide_artist_claim(uuid,text,text,boolean,boolean,boolean,boolean)'
     ) is null
  then
    raise exception
      'ARTIST_CLAIM_EVIDENCE_FOLLOWUP_PREFLIGHT_FAIL: accepted Artist Claim authority is incomplete';
  end if;

  select pg_get_functiondef(
    'public.community_admin_decide_artist_claim(uuid,text,text,boolean,boolean,boolean,boolean)'::regprocedure
  )
  into v_decide_definition;

  if position(
       'execute_registry_reviewed_artist_identity_materialization_v1'
       in v_decide_definition
     ) = 0
     or position(
       'execute_registry_artist_alias_state_v1'
       in v_decide_definition
     ) = 0
  then
    raise exception
      'ARTIST_CLAIM_EVIDENCE_FOLLOWUP_PREFLIGHT_FAIL: reviewed Artist identity governance authority has drifted';
  end if;
end;
$artist_claim_evidence_followup_preflight$;

-- Existing Artist claims keep their original authority, but replay can append
-- evidence to the same pending claim and new claims must provide evidence.
create or replace function public.community_submit_artist_claim(
  p_artist_id uuid,
  p_claimant_role text,
  p_statement text,
  p_evidence jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public, editorial
as $function$
declare
  v_actor uuid := auth.uid();
  v_role text := lower(trim(coalesce(p_claimant_role, '')));
  v_statement text := trim(coalesce(p_statement, ''));
  v_claim_id uuid;
  v_evidence jsonb;
  v_type text;
  v_reference text;
  v_note text;
  v_idempotent_replay boolean := false;
  v_evidence_count integer;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;

  if not exists (
    select 1
    from public.registry_artists artist
    where artist.id = p_artist_id
      and artist.status in ('active', 'draft', 'needs_review')
  ) then
    raise exception 'artist_not_claimable';
  end if;

  if v_role not in ('artist', 'manager', 'label', 'publicist', 'team_member', 'other') then
    raise exception 'invalid_claimant_role';
  end if;

  if char_length(v_statement) < 10
     or char_length(v_statement) > 4000
  then
    raise exception 'invalid_claim_statement';
  end if;

  if coalesce(jsonb_typeof(p_evidence), 'null') <> 'array' then
    raise exception 'claim_evidence_must_be_array';
  end if;

  if jsonb_array_length(p_evidence) > 10 then
    raise exception 'too_many_claim_evidence_items';
  end if;

  if exists (
    select 1
    from public.artist_representations representation
    where representation.artist_id = p_artist_id
      and representation.user_id = v_actor
      and representation.status in ('pending', 'active')
  ) then
    raise exception 'representation_already_exists';
  end if;

  select claim.id
  into v_claim_id
  from public.artist_claim_requests claim
  where claim.artist_id = p_artist_id
    and claim.claimant_user_id = v_actor
    and claim.status = 'pending'
  order by claim.submitted_at desc
  limit 1
  for update;

  v_idempotent_replay := v_claim_id is not null;

  if not v_idempotent_replay
     and jsonb_array_length(p_evidence) = 0
  then
    raise exception 'claim_evidence_required';
  end if;

  if not v_idempotent_replay then
    insert into public.artist_claim_requests (
      artist_id,
      claimant_user_id,
      claimant_role,
      statement,
      claim_kind
    )
    values (
      p_artist_id,
      v_actor,
      v_role,
      v_statement,
      'existing_artist'
    )
    returning id into v_claim_id;
  end if;

  for v_evidence in
    select value
    from jsonb_array_elements(p_evidence)
  loop
    v_type := lower(trim(coalesce(v_evidence->>'type', '')));
    v_reference := nullif(trim(coalesce(v_evidence->>'reference', '')), '');
    v_note := nullif(trim(coalesce(v_evidence->>'note', '')), '');

    if v_type not in (
      'official_website',
      'official_social',
      'business_email',
      'label_or_distributor',
      'public_announcement',
      'other'
    ) then
      raise exception 'invalid_claim_evidence_type';
    end if;

    if v_reference is null and v_note is null then
      raise exception 'claim_evidence_requires_content';
    end if;

    if v_reference is not null and char_length(v_reference) > 2048 then
      raise exception 'claim_evidence_reference_too_long';
    end if;

    if v_note is not null and char_length(v_note) > 2000 then
      raise exception 'claim_evidence_note_too_long';
    end if;

    if not exists (
      select 1
      from public.artist_claim_evidence evidence
      where evidence.claim_id = v_claim_id
        and evidence.evidence_type = v_type
        and evidence.reference is not distinct from v_reference
        and evidence.note is not distinct from v_note
    ) then
      select count(*)::integer
      into v_evidence_count
      from public.artist_claim_evidence evidence
      where evidence.claim_id = v_claim_id;

      if v_evidence_count >= 10 then
        raise exception 'too_many_claim_evidence_items';
      end if;

      insert into public.artist_claim_evidence (
        claim_id,
        evidence_type,
        reference,
        note
      )
      values (
        v_claim_id,
        v_type,
        v_reference,
        v_note
      );
    end if;
  end loop;

  if not v_idempotent_replay then
    perform editorial.record_artist_representation_event(
      p_artist_id,
      'claim_submitted',
      v_claim_id,
      null,
      v_actor,
      jsonb_build_object('claimant_role', v_role)
    );

    perform editorial.sync_artist_portal_roles(v_actor);
  end if;

  return jsonb_build_object(
    'claim_id', v_claim_id,
    'artist_id', p_artist_id,
    'status', 'pending',
    'claimant_role', v_role,
    'idempotent_replay', v_idempotent_replay
  );
end;
$function$;

-- Proposed Artist claims keep MIZIZI identity resolution and the same pending
-- claim identity. Replay can append evidence instead of returning before it.
create or replace function public.community_submit_new_artist_claim(
  p_display_name text,
  p_artist_type text,
  p_origin_iso2 text,
  p_alternate_names text[],
  p_claimant_role text,
  p_statement text,
  p_evidence jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public, editorial, platform_private, extensions
as $function$
declare
  v_actor uuid := auth.uid();
  v_display_name text := regexp_replace(trim(coalesce(p_display_name, '')), '[[:space:]]+', ' ', 'g');
  v_normalized_name text;
  v_artist_type text := nullif(lower(trim(coalesce(p_artist_type, ''))), '');
  v_origin_iso2 text := nullif(upper(trim(coalesce(p_origin_iso2, ''))), '');
  v_role text := lower(trim(coalesce(p_claimant_role, '')));
  v_statement text := trim(coalesce(p_statement, ''));
  v_alternate_names text[] := '{}'::text[];
  v_alt text;
  v_fingerprint text;
  v_claim_id uuid;
  v_evidence jsonb;
  v_type text;
  v_reference text;
  v_note text;
  v_idempotent_replay boolean := false;
  v_evidence_count integer;
  v_pending_name_match_count integer := 0;
  v_candidate_count integer := 0;
  v_strong_match_count integer := 0;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;

  if char_length(v_display_name) < 2
     or char_length(v_display_name) > 200
  then
    raise exception 'invalid_artist_display_name';
  end if;

  v_normalized_name := lower(v_display_name);

  if v_artist_type is not null
     and v_artist_type not in ('solo', 'band', 'group', 'collective', 'unknown')
  then
    raise exception 'invalid_artist_type';
  end if;

  if v_origin_iso2 is not null
     and v_origin_iso2 !~ '^[A-Z]{2}$'
  then
    raise exception 'invalid_artist_origin';
  end if;

  if v_role not in ('artist', 'manager', 'label', 'publicist', 'team_member', 'other') then
    raise exception 'invalid_claimant_role';
  end if;

  if char_length(v_statement) < 10
     or char_length(v_statement) > 4000
  then
    raise exception 'invalid_claim_statement';
  end if;

  if coalesce(jsonb_typeof(p_evidence), 'null') <> 'array' then
    raise exception 'claim_evidence_must_be_array';
  end if;

  if jsonb_array_length(p_evidence) > 10 then
    raise exception 'too_many_claim_evidence_items';
  end if;

  if cardinality(coalesce(p_alternate_names, '{}'::text[])) > 20 then
    raise exception 'too_many_artist_alternate_names';
  end if;

  foreach v_alt in array coalesce(p_alternate_names, '{}'::text[])
  loop
    v_alt := regexp_replace(trim(coalesce(v_alt, '')), '[[:space:]]+', ' ', 'g');
    if char_length(v_alt) > 200 then
      raise exception 'artist_alternate_name_too_long';
    end if;
    if char_length(v_alt) >= 2
       and lower(v_alt) <> v_normalized_name
       and not exists (
         select 1
         from unnest(v_alternate_names) existing(value)
         where lower(existing.value) = lower(v_alt)
       )
    then
      v_alternate_names := array_append(v_alternate_names, v_alt);
    end if;
  end loop;

  select
    count(*)::integer,
    count(*) filter (
      where candidate.match_tier in ('exact', 'strong')
    )::integer
  into
    v_candidate_count,
    v_strong_match_count
  from platform_private.mizizi_resolve_artist_identity_candidates(
    v_display_name,
    v_artist_type,
    v_origin_iso2,
    8
  ) candidate;

  if v_strong_match_count > 0 then
    raise exception 'artist_registry_match_found';
  end if;

  v_fingerprint := encode(
    extensions.digest(
      concat_ws(
        '|',
        v_normalized_name,
        coalesce(v_artist_type, ''),
        coalesce(v_origin_iso2, ''),
        array_to_string(
          array(
            select lower(value)
            from unnest(v_alternate_names) value
            order by lower(value)
          ),
          ','
        )
      ),
      'sha256'
    ),
    'hex'
  );

  select claim.id
  into v_claim_id
  from public.artist_claim_requests claim
  join public.artist_claim_proposed_identities proposal
    on proposal.claim_id = claim.id
  where claim.claimant_user_id = v_actor
    and claim.claim_kind = 'proposed_artist'
    and claim.status = 'pending'
    and proposal.mizizi_fingerprint = v_fingerprint
  order by claim.submitted_at desc
  limit 1
  for update of claim;

  if v_claim_id is null then
    select count(*)::integer
    into v_pending_name_match_count
    from public.artist_claim_requests claim
    join public.artist_claim_proposed_identities proposal
      on proposal.claim_id = claim.id
    where claim.claimant_user_id = v_actor
      and claim.claim_kind = 'proposed_artist'
      and claim.status = 'pending'
      and proposal.normalized_name = v_normalized_name;

    if v_pending_name_match_count > 1 then
      raise exception 'artist_claim_pending_identity_ambiguous';
    elsif v_pending_name_match_count = 1 then
      select claim.id
      into v_claim_id
      from public.artist_claim_requests claim
      join public.artist_claim_proposed_identities proposal
        on proposal.claim_id = claim.id
      where claim.claimant_user_id = v_actor
        and claim.claim_kind = 'proposed_artist'
        and claim.status = 'pending'
        and proposal.normalized_name = v_normalized_name
      order by claim.submitted_at desc
      limit 1
      for update of claim;
    end if;
  end if;

  v_idempotent_replay := v_claim_id is not null;

  if not v_idempotent_replay
     and jsonb_array_length(p_evidence) = 0
  then
    raise exception 'claim_evidence_required';
  end if;

  if not v_idempotent_replay then
    insert into public.artist_claim_requests (
      artist_id,
      claimant_user_id,
      claimant_role,
      statement,
      claim_kind
    )
    values (
      null,
      v_actor,
      v_role,
      v_statement,
      'proposed_artist'
    )
    returning id into v_claim_id;

    insert into public.artist_claim_proposed_identities (
      claim_id,
      display_name,
      normalized_name,
      artist_type,
      origin_iso2,
      alternate_names,
      mizizi_fingerprint,
      mizizi_assessment
    )
    values (
      v_claim_id,
      v_display_name,
      v_normalized_name,
      v_artist_type,
      v_origin_iso2,
      v_alternate_names,
      v_fingerprint,
      jsonb_build_object(
        'rule_version', 'artist_identity_v1',
        'candidate_count', v_candidate_count,
        'strong_match_count', v_strong_match_count,
        'resolved_at', now()
      )
    );
  end if;

  for v_evidence in
    select value
    from jsonb_array_elements(p_evidence)
  loop
    v_type := lower(trim(coalesce(v_evidence->>'type', '')));
    v_reference := nullif(trim(coalesce(v_evidence->>'reference', '')), '');
    v_note := nullif(trim(coalesce(v_evidence->>'note', '')), '');

    if v_type not in (
      'official_website',
      'official_social',
      'business_email',
      'label_or_distributor',
      'public_announcement',
      'other'
    ) then
      raise exception 'invalid_claim_evidence_type';
    end if;

    if v_reference is null and v_note is null then
      raise exception 'claim_evidence_requires_content';
    end if;

    if v_reference is not null and char_length(v_reference) > 2048 then
      raise exception 'claim_evidence_reference_too_long';
    end if;

    if v_note is not null and char_length(v_note) > 2000 then
      raise exception 'claim_evidence_note_too_long';
    end if;

    if not exists (
      select 1
      from public.artist_claim_evidence evidence
      where evidence.claim_id = v_claim_id
        and evidence.evidence_type = v_type
        and evidence.reference is not distinct from v_reference
        and evidence.note is not distinct from v_note
    ) then
      select count(*)::integer
      into v_evidence_count
      from public.artist_claim_evidence evidence
      where evidence.claim_id = v_claim_id;

      if v_evidence_count >= 10 then
        raise exception 'too_many_claim_evidence_items';
      end if;

      insert into public.artist_claim_evidence (
        claim_id,
        evidence_type,
        reference,
        note
      )
      values (
        v_claim_id,
        v_type,
        v_reference,
        v_note
      );
    end if;
  end loop;

  return jsonb_build_object(
    'claim_id', v_claim_id,
    'status', 'pending',
    'claim_kind', 'proposed_artist',
    'idempotent_replay', v_idempotent_replay,
    'mizizi_fingerprint', v_fingerprint
  );
end;
$function$;

-- Preserve the September 21 governed Registry materialization authority.
-- Only the verified decision path gains the evidence gate.
create or replace function public.community_admin_decide_artist_claim(
  p_claim_id uuid,
  p_decision text,
  p_reason text,
  p_can_manage_profile boolean default null,
  p_can_submit_releases boolean default null,
  p_can_post_updates boolean default null,
  p_can_manage_team boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public, editorial, platform_private
as $function$
declare
  v_actor uuid := auth.uid();
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_reason text := trim(coalesce(p_reason, ''));
  v_claim public.artist_claim_requests%rowtype;
  v_proposal public.artist_claim_proposed_identities%rowtype;
  v_defaults record;
  v_representation_id uuid;
  v_profile boolean;
  v_releases boolean;
  v_updates boolean;
  v_team boolean;
  v_artist_id uuid;
  v_artist_slug text;
  v_match_count integer := 0;
  v_alt text;
  v_materialized jsonb;
  v_required_capability text;
  v_before_artist jsonb;
  v_after_artist jsonb;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;

  if not editorial.current_user_can_review_artist_claims() then
    raise exception 'insufficient_privilege';
  end if;

  if v_decision not in ('verified', 'rejected') then
    raise exception 'invalid_claim_decision';
  end if;

  if char_length(v_reason) < 3
     or char_length(v_reason) > 4000
  then
    raise exception 'invalid_claim_decision_reason';
  end if;

  select *
  into v_claim
  from public.artist_claim_requests
  where id = p_claim_id
  for update;

  if not found then
    raise exception 'claim_not_found';
  end if;

  if v_claim.status <> 'pending' then
    raise exception 'claim_not_pending';
  end if;

  if v_claim.claimant_user_id is null then
    raise exception 'claimant_account_missing';
  end if;

  if v_decision = 'rejected' then
    update public.artist_claim_requests
    set
      status = 'rejected',
      decided_at = now(),
      decided_by = v_actor,
      decision_reason = v_reason,
      updated_at = now()
    where id = v_claim.id;

    if v_claim.artist_id is not null then
      perform editorial.record_artist_representation_event(
        v_claim.artist_id,
        'claim_rejected',
        v_claim.id,
        null,
        v_claim.claimant_user_id,
        jsonb_build_object('reason', v_reason)
      );
    end if;

    insert into public.admin_audit_events (
      actor_user_id,
      target_user_id,
      event_type,
      target_table,
      target_record_id,
      message,
      metadata
    )
    values (
      v_actor,
      v_claim.claimant_user_id,
      'artist_claim_rejected',
      'artist_claim_requests',
      v_claim.id::text,
      v_reason,
      jsonb_build_object(
        'artist_id', v_claim.artist_id,
        'claim_kind', v_claim.claim_kind
      )
    );

    perform editorial.sync_artist_portal_roles(v_claim.claimant_user_id);

    return jsonb_build_object(
      'claim_id', v_claim.id,
      'status', 'rejected',
      'claim_kind', v_claim.claim_kind
    );
  end if;

  if not exists (
    select 1
    from public.artist_claim_evidence evidence
    where evidence.claim_id = v_claim.id
  ) then
    raise exception 'claim_evidence_required';
  end if;

  if v_claim.claim_kind = 'proposed_artist'
     and v_claim.artist_id is null
  then
    select *
    into v_proposal
    from public.artist_claim_proposed_identities proposal
    where proposal.claim_id = v_claim.id
    for update;

    if not found then
      raise exception 'proposed_artist_identity_missing';
    end if;

    select count(*)::integer
    into v_match_count
    from platform_private.mizizi_resolve_artist_identity_candidates(
      v_proposal.display_name,
      v_proposal.artist_type,
      v_proposal.origin_iso2,
      8
    ) candidate
    where candidate.match_tier in ('exact', 'strong');

    if v_match_count > 0 then
      raise exception 'artist_identity_resolution_required';
    end if;

    v_artist_slug := public.wk_slugify_text(v_proposal.display_name);

    if char_length(v_artist_slug) < 2 then
      raise exception 'artist_slug_invalid';
    end if;

    if exists (
      select 1
      from public.registry_artists artist
      where artist.slug = v_artist_slug
    )
       or exists (
         select 1
         from public.registry_artist_aliases alias
         where alias.alias_slug = v_artist_slug
           and coalesce(alias.status, 'active') = 'active'
       )
    then
      raise exception 'artist_slug_conflict';
    end if;

    v_required_capability := case
      when coalesce(public.current_user_has_capability('manage_users'), false)
        then 'manage_users'
      when coalesce(public.current_user_has_capability('manage_registry'), false)
        then 'manage_registry'
      else null
    end;

    if v_required_capability is null then
      raise exception 'artist_claim_exact_grant_capability_missing';
    end if;

    v_materialized :=
      platform_private.execute_registry_reviewed_artist_identity_materialization_v1(
        'artist_claim_review',
        'artist-claim:' || v_claim.id::text,
        v_proposal.display_name,
        v_proposal.normalized_name,
        v_artist_slug,
        v_proposal.mizizi_fingerprint,
        jsonb_build_object(
          'claim_id', v_claim.id,
          'claim_kind', v_claim.claim_kind,
          'artist_type', v_proposal.artist_type,
          'origin_iso2', v_proposal.origin_iso2,
          'alternate_names', to_jsonb(v_proposal.alternate_names),
          'decision_reason', v_reason
        ),
        v_required_capability
      );

    v_artist_id := (v_materialized ->> 'artist_id')::uuid;

    select to_jsonb(artist)
    into v_before_artist
    from public.registry_artists artist
    where artist.id = v_artist_id;

    update public.registry_artists artist
    set
      artist_type = v_proposal.artist_type,
      origin_iso2 = v_proposal.origin_iso2,
      origin_confidence =
        case when v_proposal.origin_iso2 is null then null else 1.0 end,
      status = 'active',
      metadata = coalesce(artist.metadata, '{}'::jsonb) || jsonb_build_object(
        'source', 'artist_claim',
        'claim_id', v_claim.id,
        'approved_by', v_actor,
        'identity_operation_id', v_materialized ->> 'operation_id'
      ),
      updated_at = now()
    where artist.id = v_artist_id
      and artist.status = 'draft'
    returning to_jsonb(artist)
    into v_after_artist;

    if v_after_artist is null then
      raise exception 'artist_claim_materialized_identity_not_draft';
    end if;

    foreach v_alt in array v_proposal.alternate_names
    loop
      if char_length(public.wk_slugify_text(v_alt)) >= 2 then
        perform platform_private.execute_registry_artist_alias_state_v1(
          public.wk_slugify_text(v_alt),
          v_artist_id,
          v_alt,
          'manual',
          'active',
          'Accepted from reviewed Artist claim ' || v_claim.id::text,
          v_actor,
          'artist_claim_review'
        );
      end if;
    end loop;

    update public.artist_claim_proposed_identities
    set
      accepted_artist_id = v_artist_id,
      updated_at = now()
    where claim_id = v_claim.id;

    update public.artist_claim_requests
    set
      artist_id = v_artist_id,
      updated_at = now()
    where id = v_claim.id;

    v_claim.artist_id := v_artist_id;

    insert into public.registry_canonical_write_events (
      registry_entity_type,
      registry_entity_id,
      source_suggestion_id,
      source_table,
      field_name,
      target_path,
      before_value,
      after_value,
      action,
      status,
      actor
    )
    values (
      'artist',
      v_artist_id::text,
      v_claim.id::text,
      'artist_claim_proposed_identities',
      'identity',
      'registry_artists',
      null,
      jsonb_build_object(
        'id', v_artist_id,
        'slug', v_after_artist ->> 'slug',
        'display_name', v_after_artist ->> 'display_name',
        'artist_type', v_after_artist ->> 'artist_type',
        'origin_iso2', v_after_artist ->> 'origin_iso2',
        'status', v_after_artist ->> 'status'
      ),
      'create_from_artist_claim',
      'applied',
      v_actor::text
    );

  end if;

  if v_claim.artist_id is null then
    raise exception 'artist_identity_resolution_required';
  end if;

  select *
  into v_defaults
  from editorial.artist_representation_defaults(v_claim.claimant_role);

  v_profile := coalesce(p_can_manage_profile, v_defaults.can_manage_profile);
  v_releases := coalesce(p_can_submit_releases, v_defaults.can_submit_releases);
  v_updates := coalesce(p_can_post_updates, v_defaults.can_post_updates);
  v_team := coalesce(p_can_manage_team, v_defaults.can_manage_team);

  select representation.id
  into v_representation_id
  from public.artist_representations representation
  where representation.artist_id = v_claim.artist_id
    and representation.user_id = v_claim.claimant_user_id
    and representation.status in ('pending', 'active')
  order by representation.created_at desc
  limit 1
  for update;

  if v_representation_id is null then
    insert into public.artist_representations (
      artist_id,
      user_id,
      representation_role,
      status,
      source_claim_id,
      can_manage_profile,
      can_submit_releases,
      can_post_updates,
      can_manage_team,
      accepted_at,
      verified_by,
      verified_at
    )
    values (
      v_claim.artist_id,
      v_claim.claimant_user_id,
      v_claim.claimant_role,
      'active',
      v_claim.id,
      v_profile,
      v_releases,
      v_updates,
      v_team,
      now(),
      v_actor,
      now()
    )
    returning id into v_representation_id;
  else
    update public.artist_representations
    set
      representation_role = v_claim.claimant_role,
      status = 'active',
      source_claim_id = v_claim.id,
      can_manage_profile = v_profile,
      can_submit_releases = v_releases,
      can_post_updates = v_updates,
      can_manage_team = v_team,
      accepted_at = coalesce(accepted_at, now()),
      verified_by = v_actor,
      verified_at = now(),
      revoked_by = null,
      revoked_at = null,
      revocation_reason = null,
      updated_at = now()
    where id = v_representation_id;
  end if;

  update public.artist_claim_requests
  set
    status = 'verified',
    decided_at = now(),
    decided_by = v_actor,
    decision_reason = v_reason,
    updated_at = now()
  where id = v_claim.id;

  perform editorial.record_artist_representation_event(
    v_claim.artist_id,
    'claim_verified',
    v_claim.id,
    v_representation_id,
    v_claim.claimant_user_id,
    jsonb_build_object(
      'reason', v_reason,
      'role', v_claim.claimant_role,
      'permissions', jsonb_build_object(
        'profile', v_profile,
        'releases', v_releases,
        'updates', v_updates,
        'team', v_team
      )
    )
  );

  insert into public.admin_audit_events (
    actor_user_id,
    target_user_id,
    event_type,
    target_table,
    target_record_id,
    message,
    metadata
  )
  values (
    v_actor,
    v_claim.claimant_user_id,
    'artist_claim_verified',
    'artist_claim_requests',
    v_claim.id::text,
    v_reason,
    jsonb_build_object(
      'artist_id', v_claim.artist_id,
      'claim_kind', v_claim.claim_kind,
      'representation_id', v_representation_id,
      'role', v_claim.claimant_role,
      'permissions', jsonb_build_object(
        'profile', v_profile,
        'releases', v_releases,
        'updates', v_updates,
        'team', v_team
      )
    )
  );

  perform editorial.sync_artist_portal_roles(v_claim.claimant_user_id);

  return jsonb_build_object(
    'claim_id', v_claim.id,
    'status', 'verified',
    'claim_kind', v_claim.claim_kind,
    'artist_id', v_claim.artist_id,
    'artist_status', (
      select artist.status
      from public.registry_artists artist
      where artist.id = v_claim.artist_id
    ),
    'representation_id', v_representation_id,
    'permissions', jsonb_build_object(
      'profile', v_profile,
      'releases', v_releases,
      'updates', v_updates,
      'team', v_team
    )
  );
end;
$function$;

revoke all on function public.community_submit_artist_claim(uuid,text,text,jsonb)
  from public, anon;
grant execute on function public.community_submit_artist_claim(uuid,text,text,jsonb)
  to authenticated, service_role;

revoke all on function public.community_submit_new_artist_claim(text,text,text,text[],text,text,jsonb)
  from public, anon;
grant execute on function public.community_submit_new_artist_claim(text,text,text,text[],text,text,jsonb)
  to authenticated, service_role;

revoke all on function public.community_admin_decide_artist_claim(
  uuid,text,text,boolean,boolean,boolean,boolean
)
from public, anon;
grant execute on function public.community_admin_decide_artist_claim(
  uuid,text,text,boolean,boolean,boolean,boolean
)
to authenticated, service_role;

commit;
