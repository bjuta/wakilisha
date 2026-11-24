-- Forward-only extension of the exact Production Track Intake queue reader.
-- CLI-minted path: GitHub run 45451513807, Supabase CLI 2.107.0.
-- Read only. Never infer canonical identity from a deterministic UUID alone.
-- The existing caller-bound create, child, activation and finalizer RPCs remain sole write authority.
begin;
CREATE OR REPLACE FUNCTION public.admin_get_registry_track_intake_queue(p_status text DEFAULT 'needs_review'::text, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0, p_suggestion_id uuid DEFAULT NULL::uuid, p_playlist_item_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'auth', 'public', 'editorial'
AS $function$
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
        'recovery',recovery.payload,
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
    left join lateral (
      -- A deterministic identity alone is not proof. Require the exact
      -- successful, independently verified create receipt and its target.
      select case
        when created.verified and pending_track.status='draft'
          and create_grant.issued_by_user_id=auth.uid()
          and nullif(btrim(create_grant.plan_payload->>'title'),'') is not null
        then jsonb_build_object(
          'state','draft','track_id',pending_track.id,
          'title',create_grant.plan_payload->>'title')
        when created.verified and pending_track.status='active'
          and exists (
            select 1
            from platform_private.registry_execution_grants activation_grant
            join platform_private.registry_mutation_operations activation
              on activation.execution_grant_id=activation_grant.id
            where activation_grant.actor_key='registry_track_intake_admin'
              and activation_grant.operation_key='registry.track.activate'
              and activation_grant.operation_version=1
              and activation_grant.idempotency_key='track-intake-activate-v1:'||suggestion.id::text
              and activation_grant.plan_payload->>'track_id'=pending_track.id::text
              and activation_grant.plan_payload->>'suggestion_id'=suggestion.id::text
              and activation.actor_key='registry_track_intake_admin'
              and activation.operation_key='registry.track.activate'
              and activation.operation_version=1
              and activation.status='succeeded'
              and activation.verifier_status='passed'
          )
        then jsonb_build_object(
          'state','active','track_id',pending_track.id,'title',pending_track.title)
        else jsonb_build_object('state','blocked')
      end as payload
      from (select platform_private.registry_track_intake_deterministic_track_uuid_v1(suggestion.id) as id) expected
      left join public.registry_tracks pending_track on pending_track.id=expected.id
      left join platform_private.registry_execution_grants create_grant
        on create_grant.actor_key='registry_track_intake_admin'
        and create_grant.operation_key='registry.track.create'
        and create_grant.operation_version=2
        and create_grant.idempotency_key='track-intake-create-v2:'||suggestion.id::text
      cross join lateral (
        select exists (
          select 1
          from platform_private.registry_mutation_operations operation
          join platform_private.registry_execution_grant_targets target
            on target.execution_grant_id=create_grant.id
          join platform_private.registry_evidence_assertions evidence
            on evidence.id::text=create_grant.plan_payload->>'evidence_assertion_id'
          where operation.execution_grant_id=create_grant.id
            and operation.actor_key='registry_track_intake_admin'
            and operation.operation_key='registry.track.create'
            and operation.operation_version=2
            and operation.status='succeeded'
            and operation.verifier_status='passed'
            and create_grant.plan_payload->>'track_id'=expected.id::text
            and target.subject_type='track' and target.subject_id=expected.id
            and evidence.subject_type='track' and evidence.subject_id=expected.id
            and evidence.source_kind='track_intake_review'
            and evidence.source_ref='track-intake-suggestion:'||suggestion.id::text
        ) as verified
      ) created
      where suggestion.status='needs_review'
        and suggestion.canonical_track_id is null
        and suggestion.canonicalized_track_id is null
        and (pending_track.id is not null or create_grant.id is not null)
    ) recovery on true
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
commit;
