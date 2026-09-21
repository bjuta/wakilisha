-- MIZIZI Slice 3 Track Intake workflow-only finalization.
--
-- Finalization proves independently durable canonical child authorities are
-- current, then closes only Track Intake workflow/evidence state. It performs
-- no canonical Registry Track, Release, Artist-credit, or provider-link DML.

begin;
set local statement_timeout='180s';
set local lock_timeout='5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'mizizi-slice3-track-intake-workflow-finalization-v1',
    0
  )
);

do $preflight$
begin
  if to_regprocedure(
       'public.admin_get_registry_track_intake_queue(text,integer,integer,uuid,uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_track_intake_current_admin_v1()'
     ) is null
     or to_regprocedure(
       'platform_private.registry_track_intake_deterministic_track_uuid_v1(uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_track_intake_credit_set_review_snapshot_v1(uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_track_intake_credit_review_snapshot_v1(uuid,uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_track_intake_track_profile_snapshot_v1(uuid,uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_track_intake_release_profile_snapshot_v1(uuid,uuid)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_track_intake_release_label_match_state_v1(text)'
     ) is null
     or to_regprocedure(
       'platform_private.registry_subject_state_fingerprint(text,uuid)'
     ) is null
  then
    raise exception
      'STOP: Track Intake workflow finalization dependency is missing';
  end if;

  if to_regprocedure(
       'platform_private.registry_track_intake_finalization_state_v1(uuid,uuid)'
     ) is not null
     or to_regprocedure(
       'public.admin_finalize_registry_track_intake_v1(uuid,uuid,text)'
     ) is not null
  then
    raise exception
      'STOP: Track Intake workflow finalization V1 already exists; audit before reapplying';
  end if;
end
$preflight$;

-- Extend the read contract with the immutable source credit UUID. Write
-- authority must never be keyed only by credit_order.
create or replace function public.admin_get_registry_track_intake_queue(
  p_status text default 'needs_review',
  p_limit integer default 100,
  p_offset integer default 0,
  p_suggestion_id uuid default null,
  p_playlist_item_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog','auth','public','editorial'
as $function$
declare
  v_status text :=
    lower(btrim(coalesce(p_status,'needs_review')));
  v_limit integer :=
    greatest(1,least(coalesce(p_limit,100),250));
  v_offset integer :=
    greatest(0,coalesce(p_offset,0));
  v_total integer;
  v_rows jsonb;
begin
  if auth.uid() is null then
    raise exception using
      errcode='42501',
      message='Authentication is required.';
  end if;

  if not (
    public.current_user_is_administrator()
    or public.current_user_has_capability('manage_registry')
  ) then
    raise exception using
      errcode='42501',
      message='Registry management permission is required.';
  end if;

  if v_status not in (
    'needs_review','rejected','canonicalized','all'
  ) then
    raise exception 'Track Intake status filter is invalid.';
  end if;

  select count(*)::integer
  into v_total
  from public.registry_provider_track_suggestions suggestion
  where (
      v_status='all'
      or suggestion.status=v_status
    )
    and (
      p_suggestion_id is null
      or suggestion.id=p_suggestion_id
    )
    and (
      p_playlist_item_id is null
      or suggestion.source_playlist_item_id=p_playlist_item_id
    );

  select coalesce(
    jsonb_agg(
      queue_row.payload
      order by queue_row.created_at desc
    ),
    '[]'::jsonb
  )
  into v_rows
  from (
    select
      suggestion.created_at,
      jsonb_build_object(
        'suggestion_id',suggestion.id,
        'status',suggestion.status,
        'intake_origin',suggestion.intake_origin,
        'source_contribution_id',suggestion.source_contribution_id,
        'contribution_status',contribution.status,
        'contribution_payload',coalesce(contribution.payload,'{}'::jsonb),
        'submitted_track_title',suggestion.submitted_track_title,
        'playlist_id',suggestion.source_playlist_id,
        'playlist_title',playlist.title,
        'playlist_item_id',suggestion.source_playlist_item_id,
        'playlist_position',item.position,
        'playlist_note',item.notes,
        'provider_key',suggestion.provider_key,
        'provider_object_id',suggestion.provider_object_id,
        'provider_url',suggestion.provider_url,
        'provider_title',suggestion.provider_title,
        'provider_release_title',suggestion.provider_release_title,
        'provider_artist_names',suggestion.provider_artist_names,
        'playback_kind',suggestion.playback_kind,
        'artwork_url',suggestion.validation_snapshot->>'artwork_url',
        'preview_url',suggestion.validation_snapshot->>'preview_url',
        'requested_by',suggestion.requested_by,
        'requested_by_name',requester.display_name,
        'created_at',suggestion.created_at,
        'reviewed_at',suggestion.reviewed_at,
        'review_note',suggestion.review_note,
        'canonical_track_id',suggestion.canonical_track_id,
        'canonical_track_title',canonical_track.title,
        'canonicalized_track_id',suggestion.canonicalized_track_id,
        'canonicalized_track_title',canonical_track.title,
        'artist_credits',
          coalesce(
            (
              select jsonb_agg(
                jsonb_build_object(
                  'credit_id',credit.id,
                  'credit_order',credit.credit_order,
                  'credit_role',credit.credit_role,
                  'resolution_mode',credit.resolution_mode,
                  'registry_artist_id',credit.registry_artist_id,
                  'observed_name',credit.observed_name,
                  'display_name',
                    coalesce(artist.display_name,credit.observed_name)
                )
                order by credit.credit_order,credit.id
              )
              from public.registry_provider_track_suggestion_artists credit
              left join public.registry_artists artist
                on artist.id=credit.registry_artist_id
              where credit.suggestion_id=suggestion.id
            ),
            '[]'::jsonb
          )
      ) as payload
    from public.registry_provider_track_suggestions suggestion
    left join public.wk_playlists playlist
      on playlist.id=suggestion.source_playlist_id
    left join public.wk_playlist_items item
      on item.id=suggestion.source_playlist_item_id
    left join public.user_profiles requester
      on requester.user_id=suggestion.requested_by
    left join public.registry_tracks canonical_track
      on canonical_track.id=coalesce(
        suggestion.canonicalized_track_id,
        suggestion.canonical_track_id
      )
    left join public.community_contributions contribution
      on contribution.id=suggestion.source_contribution_id
    where (
        v_status='all'
        or suggestion.status=v_status
      )
      and (
        p_suggestion_id is null
        or suggestion.id=p_suggestion_id
      )
      and (
        p_playlist_item_id is null
        or suggestion.source_playlist_item_id=p_playlist_item_id
      )
    order by suggestion.created_at desc
    limit v_limit
    offset v_offset
  ) queue_row;

  return jsonb_build_object(
    'status',v_status,
    'total',v_total,
    'limit',v_limit,
    'offset',v_offset,
    'rows',v_rows
  );
end
$function$;

create function platform_private.registry_track_intake_finalization_state_v1(
  p_suggestion_id uuid,
  p_track_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,platform_private,auth
as $$
declare
  v_user_id uuid;
  v_suggestion public.registry_provider_track_suggestions%rowtype;
  v_track public.registry_tracks%rowtype;
  v_release public.registry_releases%rowtype;
  v_credit public.registry_provider_track_suggestion_artists%rowtype;
  v_credit_review jsonb;
  v_credit_set_review jsonb;
  v_credit_operation platform_private.registry_mutation_operations%rowtype;
  v_relation_id uuid;
  v_credit_expected integer:=0;
  v_credit_verified integer:=0;
  v_track_profile jsonb;
  v_track_fields jsonb;
  v_release_profile jsonb;
  v_release_fields jsonb;
  v_label_state jsonb;
  v_label_name text;
  v_expected_label_id uuid;
  v_track_profile_applicable boolean:=false;
  v_track_profile_current boolean:=true;
  v_release_profile_applicable boolean:=false;
  v_release_profile_current boolean:=true;
  v_provider_expected integer:=0;
  v_provider_verified integer:=0;
  v_new_track boolean;
  v_identity_verified boolean:=true;
  v_activation_verified boolean:=true;
  v_isrc text;
  v_normalized_release_title text;
begin
  v_user_id:=platform_private.registry_track_intake_current_admin_v1();

  select suggestion.*
  into v_suggestion
  from public.registry_provider_track_suggestions suggestion
  where suggestion.id=p_suggestion_id;

  if not found then
    raise exception using errcode='P0002',
      message='Track Intake item does not exist.';
  end if;

  if v_suggestion.status<>'needs_review' then
    raise exception using errcode='42501',
      message='Track Intake item is not awaiting workflow finalization.';
  end if;

  if (
       v_suggestion.canonical_track_id is not null
       and v_suggestion.canonical_track_id<>p_track_id
     )
     or (
       v_suggestion.canonicalized_track_id is not null
       and v_suggestion.canonicalized_track_id<>p_track_id
     )
  then
    raise exception using errcode='23514',
      message='Track Intake target changed before workflow finalization.';
  end if;

  select track.*
  into v_track
  from public.registry_tracks track
  where track.id=p_track_id
    and track.status='active';

  if not found then
    raise exception using errcode='23514',
      message='Workflow finalization requires the exact active Registry Track.';
  end if;

  v_new_track:=
    p_track_id=
      platform_private.registry_track_intake_deterministic_track_uuid_v1(
        p_suggestion_id
      );

  if v_new_track then
    select exists (
      select 1
      from platform_private.registry_mutation_operations operation
      join platform_private.registry_execution_grants execution_grant
        on execution_grant.id=operation.execution_grant_id
      where operation.actor_key='registry_track_intake_admin'
        and operation.operation_key='registry.track.create'
        and operation.operation_version=2
        and operation.status='succeeded'
        and operation.verifier_status='passed'
        and execution_grant.plan_payload->>'track_id'=p_track_id::text
    )
    into v_identity_verified;

    v_credit_set_review:=
      platform_private.registry_track_intake_credit_set_review_snapshot_v1(
        p_suggestion_id
      );

    select exists (
      select 1
      from platform_private.registry_mutation_operations operation
      join platform_private.registry_execution_grants execution_grant
        on execution_grant.id=operation.execution_grant_id
      where operation.actor_key='registry_track_intake_admin'
        and operation.operation_key='registry.track.activate'
        and operation.operation_version=1
        and operation.status='succeeded'
        and operation.verifier_status='passed'
        and execution_grant.plan_payload->>'track_id'=p_track_id::text
        and execution_grant.plan_payload->>'review_fingerprint'=
            v_credit_set_review->>'review_fingerprint'
    )
    into v_activation_verified;
  end if;

  for v_credit in
    select credit.*
    from public.registry_provider_track_suggestion_artists credit
    where credit.suggestion_id=p_suggestion_id
    order by credit.credit_order,credit.id
  loop
    v_credit_expected:=v_credit_expected+1;

    v_credit_review:=
      platform_private.registry_track_intake_credit_review_snapshot_v1(
        p_suggestion_id,
        v_credit.id
      );

    select operation.*
    into v_credit_operation
    from platform_private.registry_mutation_operations operation
    join platform_private.registry_execution_grants execution_grant
      on execution_grant.id=operation.execution_grant_id
    where operation.actor_key='registry_track_intake_admin'
      and operation.operation_key=
          'registry.track_artist_credit.reviewed_reconcile'
      and operation.operation_version=1
      and operation.status='succeeded'
      and operation.verifier_status='passed'
      and execution_grant.plan_payload->>'track_id'=p_track_id::text
      and execution_grant.plan_payload->>'source_credit_id'=v_credit.id::text
      and execution_grant.plan_payload->>'review_fingerprint'=
          v_credit_review->>'review_fingerprint'
    order by operation.completed_at desc nulls last,operation.created_at desc
    limit 1;

    if found then
      v_relation_id:=
        nullif(v_credit_operation.result_payload->>'relation_id','')::uuid;

      if v_relation_id is not null
         and platform_private.registry_subject_state_fingerprint(
               'track_artist_credit',
               v_relation_id
             ) is not distinct from
             v_credit_operation.result_payload->>'relation_state_fingerprint'
      then
        v_credit_verified:=v_credit_verified+1;
      end if;
    end if;
  end loop;

  -- Track reviewed-profile facts must be materially current. A matching
  -- pre-existing value legitimately requires no mutation receipt.
  v_track_profile:=
    platform_private.registry_track_intake_track_profile_snapshot_v1(
      p_suggestion_id,
      p_track_id
    );
  v_track_fields:=v_track_profile->'approved_track_fields';
  v_track_profile_applicable:=v_track_fields<>'{}'::jsonb;

  if v_track_profile_applicable then
    if v_track_fields ? 'isrc' then
      v_isrc:=
        platform_private.registry_identity_canonical_isrc_v1(
          nullif(btrim(v_track_fields->>'isrc'),'')
        );
      v_track_profile_current:=
        v_track_profile_current
        and v_track.isrc is not distinct from v_isrc;
    end if;

    if v_track_fields ? 'duration_ms' then
      v_track_profile_current:=
        v_track_profile_current
        and v_track.duration_ms is not distinct from
            nullif(v_track_fields->>'duration_ms','')::integer;
    end if;

    if v_track_fields ? 'track_artwork_url' then
      v_track_profile_current:=
        v_track_profile_current
        and v_track.artwork_url is not distinct from
            nullif(btrim(v_track_fields->>'track_artwork_url'),'');
    end if;

    if v_track_fields ? 'preview_url' then
      v_track_profile_current:=
        v_track_profile_current
        and v_track.preview_url is not distinct from
            nullif(btrim(v_track_fields->>'preview_url'),'');
    end if;

    if v_track_fields ? 'track_number' then
      v_track_profile_current:=
        v_track_profile_current
        and v_track.track_number is not distinct from
            nullif(v_track_fields->>'track_number','')::integer;
    end if;

    if v_track_fields ? 'disc_number' then
      v_track_profile_current:=
        v_track_profile_current
        and v_track.disc_number is not distinct from
            nullif(v_track_fields->>'disc_number','')::integer;
    end if;

    if v_track_fields ? 'explicit' then
      v_track_profile_current:=
        v_track_profile_current
        and v_track.explicit is not distinct from
            nullif(v_track_fields->>'explicit','')::boolean;
    end if;

    if v_track_fields ? 'genre' then
      v_track_profile_current:=
        v_track_profile_current
        and v_track.metadata->>'provider_genre' is not distinct from
            nullif(btrim(v_track_fields->>'genre'),'');
    end if;
  end if;

  -- Release facts are applicable only when the target Track already has a
  -- Release. This preserves the accepted no-implicit-Release-creation rule.
  if v_track.release_id is not null then
    select release.*
    into v_release
    from public.registry_releases release
    where release.id=v_track.release_id
      and release.status<>'archived';

    if found then
      v_release_profile:=
        platform_private.registry_track_intake_release_profile_snapshot_v1(
          p_suggestion_id,
          p_track_id
        );
      v_release_fields:=v_release_profile->'approved_release_fields';
      v_release_profile_applicable:=v_release_fields<>'{}'::jsonb;

      if v_release_profile_applicable then
        if v_release_fields ? 'release_title' then
          v_normalized_release_title:=
            trim(
              regexp_replace(
                lower(
                  nullif(
                    btrim(v_release_fields->>'release_title'),
                    ''
                  )
                ),
                '[^[:alnum:]]+',
                ' ',
                'g'
              )
            );

          v_release_profile_current:=
            v_release_profile_current
            and v_release.title is not distinct from
                nullif(btrim(v_release_fields->>'release_title'),'')
            and v_release.normalized_title is not distinct from
                v_normalized_release_title;
        end if;

        if v_release_fields ? 'release_date' then
          v_release_profile_current:=
            v_release_profile_current
            and v_release.release_date is not distinct from
                nullif(v_release_fields->>'release_date','')::date;
        end if;

        if v_release_fields ? 'release_date_precision' then
          v_release_profile_current:=
            v_release_profile_current
            and v_release.release_date_precision is not distinct from
                nullif(
                  btrim(v_release_fields->>'release_date_precision'),
                  ''
                );
        end if;

        if v_release_fields ? 'release_artwork_url' then
          v_release_profile_current:=
            v_release_profile_current
            and v_release.artwork_url is not distinct from
                nullif(
                  btrim(v_release_fields->>'release_artwork_url'),
                  ''
                );
        end if;

        if v_release_fields ? 'upc' then
          v_release_profile_current:=
            v_release_profile_current
            and v_release.upc is not distinct from
                nullif(btrim(v_release_fields->>'upc'),'');
        end if;

        if v_release_fields ? 'imprint_name' then
          v_release_profile_current:=
            v_release_profile_current
            and v_release.metadata->>'imprint_name' is not distinct from
                nullif(btrim(v_release_fields->>'imprint_name'),'');
        end if;

        if v_release_fields ? 'copyright_text' then
          v_release_profile_current:=
            v_release_profile_current
            and v_release.metadata->>'copyright_text' is not distinct from
                nullif(btrim(v_release_fields->>'copyright_text'),'');
        end if;

        if v_release_fields ? 'genre' then
          v_release_profile_current:=
            v_release_profile_current
            and v_release.metadata->>'provider_genre' is not distinct from
                nullif(btrim(v_release_fields->>'genre'),'');
        end if;

        if v_release_fields ? 'label_name' then
          v_label_name:=
            nullif(btrim(v_release_fields->>'label_name'),'');
          v_label_state:=
            platform_private.registry_track_intake_release_label_match_state_v1(
              v_label_name
            );

          if v_release.label_id is null
             and jsonb_array_length(v_label_state)=1
          then
            v_expected_label_id:=(v_label_state->0->>'id')::uuid;
            v_release_profile_current:=
              v_release_profile_current
              and v_release.label_id is not distinct from v_expected_label_id;
          elsif v_release.label_id is null then
            v_release_profile_current:=
              v_release_profile_current
              and v_release.metadata->>'label_name_observation'
                    is not distinct from v_label_name;
          end if;
        end if;
      end if;
    end if;
  end if;

  select count(*)::integer
  into v_provider_expected
  from public.provider_entity_links evidence_link
  where evidence_link.registry_entity_type='track'
    and evidence_link.registry_entity_id=p_suggestion_id::text
    and evidence_link.match_status='confirmed';

  select count(*)::integer
  into v_provider_verified
  from public.provider_entity_links evidence_link
  where evidence_link.registry_entity_type='track'
    and evidence_link.registry_entity_id=p_suggestion_id::text
    and evidence_link.match_status='confirmed'
    and exists (
      select 1
      from public.registry_track_provider_links canonical_link
      where canonical_link.track_id=p_track_id
        and canonical_link.provider_key=lower(evidence_link.provider)
        and canonical_link.provider_track_id=evidence_link.provider_entity_id
        and canonical_link.match_status='matched'
    );

  return jsonb_build_object(
    'ready',
      v_identity_verified
      and v_activation_verified
      and v_credit_expected>0
      and v_credit_verified=v_credit_expected
      and (
        not v_track_profile_applicable
        or v_track_profile_current
      )
      and (
        not v_release_profile_applicable
        or v_release_profile_current
      )
      and v_provider_verified=v_provider_expected,
    'mode',case when v_new_track then 'new_track' else 'existing_track' end,
    'identity_verified',v_identity_verified,
    'activation_verified',v_activation_verified,
    'credit_expected',v_credit_expected,
    'credit_verified',v_credit_verified,
    'credit_set_review_fingerprint',
      case
        when v_credit_set_review is null then null
        else v_credit_set_review->>'review_fingerprint'
      end,
    'track_profile_applicable',v_track_profile_applicable,
    'track_profile_current',v_track_profile_current,
    'release_profile_applicable',v_release_profile_applicable,
    'release_profile_current',v_release_profile_current,
    'provider_expected',v_provider_expected,
    'provider_verified',v_provider_verified
  );
end
$$;

create function public.admin_finalize_registry_track_intake_v1(
  p_suggestion_id uuid,
  p_registry_track_id uuid,
  p_review_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,platform_private,auth
as $$
declare
  v_user_id uuid;
  v_suggestion public.registry_provider_track_suggestions%rowtype;
  v_track public.registry_tracks%rowtype;
  v_state jsonb;
  v_evidence_links_inserted integer:=0;
begin
  v_user_id:=platform_private.registry_track_intake_current_admin_v1();

  select suggestion.*
  into v_suggestion
  from public.registry_provider_track_suggestions suggestion
  where suggestion.id=p_suggestion_id
  for update;

  if not found then
    raise exception using errcode='P0002',
      message='Track Intake item does not exist.';
  end if;

  if v_suggestion.status='canonicalized' then
    if v_suggestion.canonicalized_track_id=p_registry_track_id
       and v_suggestion.canonical_track_id=p_registry_track_id
    then
      select track.*
      into v_track
      from public.registry_tracks track
      where track.id=p_registry_track_id;

      return jsonb_build_object(
        'suggestion_id',p_suggestion_id,
        'playlist_id',v_suggestion.source_playlist_id,
        'playlist_item_id',v_suggestion.source_playlist_item_id,
        'intake_origin',v_suggestion.intake_origin,
        'source_contribution_id',v_suggestion.source_contribution_id,
        'status','canonicalized',
        'registry_track_id',p_registry_track_id,
        'registry_track_title',v_track.title,
        'idempotent_replay',true
      );
    end if;

    raise exception using errcode='23514',
      message='Track Intake item was already finalized to a different Registry Track.';
  end if;

  if v_suggestion.status<>'needs_review' then
    raise exception using errcode='42501',
      message='Only Track Intake items awaiting review can be finalized.';
  end if;

  if v_suggestion.source_playlist_item_id is null
     and v_suggestion.intake_origin not in (
       'public_contribution','artist_submission'
     )
  then
    raise exception using errcode='23514',
      message='Track Intake item has not been materialized into its Playlist.';
  end if;

  select track.*
  into v_track
  from public.registry_tracks track
  where track.id=p_registry_track_id
    and track.status='active';

  if not found then
    raise exception using errcode='23514',
      message='Selected Music Registry Track is unavailable.';
  end if;

  v_state:=
    platform_private.registry_track_intake_finalization_state_v1(
      p_suggestion_id,
      p_registry_track_id
    );

  if coalesce((v_state->>'ready')::boolean,false) is not true then
    raise exception using
      errcode='23514',
      message='Track Intake canonical child authority is incomplete.',
      detail=v_state::text;
  end if;

  -- Preserve the legacy review/evidence navigation surface. These rows are
  -- not canonical Registry provider-link authority.
  insert into public.provider_entity_links (
    registry_entity_type,
    registry_entity_id,
    provider,
    provider_entity_id,
    provider_url,
    match_status,
    confidence_score,
    created_at,
    updated_at
  )
  select
    'track',
    p_registry_track_id::text,
    evidence_link.provider,
    evidence_link.provider_entity_id,
    evidence_link.provider_url,
    'confirmed',
    evidence_link.confidence_score,
    now(),
    now()
  from public.provider_entity_links evidence_link
  where evidence_link.registry_entity_type='track'
    and evidence_link.registry_entity_id=p_suggestion_id::text
    and evidence_link.match_status='confirmed'
    and exists (
      select 1
      from public.registry_track_provider_links canonical_link
      where canonical_link.track_id=p_registry_track_id
        and canonical_link.provider_key=lower(evidence_link.provider)
        and canonical_link.provider_track_id=evidence_link.provider_entity_id
        and canonical_link.match_status='matched'
    )
    and not exists (
      select 1
      from public.provider_entity_links canonical_evidence
      where canonical_evidence.registry_entity_type='track'
        and canonical_evidence.registry_entity_id=p_registry_track_id::text
        and canonical_evidence.provider=evidence_link.provider
        and canonical_evidence.provider_entity_id=
            evidence_link.provider_entity_id
    );

  get diagnostics v_evidence_links_inserted=row_count;

  update public.registry_provider_track_suggestions suggestion
  set
    status='canonicalized',
    canonical_track_id=p_registry_track_id,
    canonicalized_track_id=p_registry_track_id,
    reviewed_by=v_user_id,
    reviewed_at=now(),
    review_note=nullif(btrim(p_review_note),'')
  where suggestion.id=p_suggestion_id
    and suggestion.status='needs_review';

  if not found then
    raise exception using errcode='23514',
      message='Track Intake workflow state changed before finalization.';
  end if;

  return jsonb_build_object(
    'suggestion_id',p_suggestion_id,
    'playlist_id',v_suggestion.source_playlist_id,
    'playlist_item_id',v_suggestion.source_playlist_item_id,
    'intake_origin',v_suggestion.intake_origin,
    'source_contribution_id',v_suggestion.source_contribution_id,
    'status','canonicalized',
    'registry_track_id',p_registry_track_id,
    'registry_track_title',v_track.title,
    'finalization_state',v_state,
    'evidence_links_inserted',v_evidence_links_inserted,
    'idempotent_replay',false
  );
end
$$;

revoke all on function
  platform_private.registry_track_intake_finalization_state_v1(uuid,uuid)
  from public,anon,authenticated,service_role;

revoke all on function
  public.admin_finalize_registry_track_intake_v1(uuid,uuid,text)
  from public,anon,service_role;
grant execute on function
  public.admin_finalize_registry_track_intake_v1(uuid,uuid,text)
  to authenticated;

commit;
