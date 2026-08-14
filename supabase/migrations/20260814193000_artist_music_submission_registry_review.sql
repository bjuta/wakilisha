-- WAKILISHA M5: Artist music submission + Registry review SLA.
--
-- Constitution:
-- - Artist music submissions enter the existing Registry Track Intake queue.
-- - can_submit_releases is the only Artist-side submission authority.
-- - Provider catalog evidence is not canonical Registry identity.
-- - Registry review remains the only path to canonical Track identity.
-- - Artist submissions carry a three-business-day review target.
-- - Existing Playlist and Community intake authority remains intact.

begin;

do $m5_preflight$
begin
  if to_regclass('public.registry_provider_track_suggestions') is null
     or to_regclass('public.registry_provider_track_suggestion_artists') is null
     or to_regclass('public.artist_representations') is null
     or to_regclass('public.artist_representation_events') is null
     or to_regclass('platform_private.playlist_playback_validations') is null
     or to_regclass('private.phase_0a_rpc_classification') is null
  then
    raise exception
      'STOP: Required Track Intake, Artist representation, or RPC authority is missing';
  end if;

  if to_regprocedure('editorial.current_artist_representation(uuid)') is null
     or to_regprocedure('editorial.record_artist_representation_event(uuid,text,uuid,uuid,uuid,jsonb)') is null
     or to_regprocedure('public.admin_resolve_registry_track_intake(uuid,uuid,text)') is null
  then
    raise exception
      'STOP: Required M2/M5 predecessor command authority is incomplete';
  end if;

  if to_regclass('platform_private.artist_music_submission_validations') is not null
     or to_regprocedure('public.record_artist_music_submission_validation(uuid,uuid,text,text,text,text,text[],text,text,jsonb,timestamp with time zone)') is not null
     or to_regprocedure('public.community_submit_artist_music(uuid,uuid,jsonb,text)') is not null
     or to_regprocedure('public.community_get_artist_music_submissions(uuid,integer)') is not null
  then
    raise exception
      'STOP: M5 Artist music submission authority already exists';
  end if;
end;
$m5_preflight$;

create or replace function editorial.artist_music_submission_review_due_at(
  p_submitted_at timestamptz
)
returns timestamptz
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_due timestamptz := p_submitted_at;
  v_business_days integer := 0;
begin
  if p_submitted_at is null then
    return null;
  end if;

  while v_business_days < 3 loop
    v_due := v_due + interval '1 day';

    if extract(
      isodow
      from v_due at time zone 'Africa/Nairobi'
    ) between 1 and 5
    then
      v_business_days := v_business_days + 1;
    end if;
  end loop;

  return v_due;
end;
$$;

revoke all
on function editorial.artist_music_submission_review_due_at(timestamptz)
from public, anon, authenticated;

create table platform_private.artist_music_submission_validations (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null
    references auth.users(id)
    on delete cascade,
  artist_id uuid not null
    references public.registry_artists(id)
    on delete restrict,
  representation_id uuid not null
    references public.artist_representations(id)
    on delete restrict,
  provider_key text not null,
  provider_object_id text not null,
  provider_url text not null,
  provider_title text not null,
  provider_artist_names text[] not null default '{}'::text[],
  provider_release_title text,
  playback_kind text not null,
  validation_snapshot jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint artist_music_submission_validation_provider_check
    check (
      provider_key in (
        'apple_music',
        'spotify'
      )
    ),
  constraint artist_music_submission_validation_playback_check
    check (
      playback_kind = 'audio'
    ),
  constraint artist_music_submission_validation_provider_object_check
    check (
      nullif(btrim(provider_object_id), '') is not null
      and nullif(btrim(provider_url), '') is not null
      and nullif(btrim(provider_title), '') is not null
    ),
  constraint artist_music_submission_validation_snapshot_check
    check (
      jsonb_typeof(validation_snapshot) = 'object'
    ),
  constraint artist_music_submission_validation_expiry_check
    check (
      expires_at > checked_at
    )
);

create index artist_music_submission_validations_actor_idx
on platform_private.artist_music_submission_validations (
  requested_by,
  artist_id,
  expires_at desc
);

alter table platform_private.artist_music_submission_validations
  enable row level security;

revoke all
on table platform_private.artist_music_submission_validations
from public, anon, authenticated;

grant select, insert
on table platform_private.artist_music_submission_validations
to service_role;

alter table public.registry_provider_track_suggestions
  alter column source_playlist_id drop not null;

alter table public.registry_provider_track_suggestions
  add column submitted_for_artist_id uuid
    references public.registry_artists(id)
    on delete restrict,
  add column submitted_by_representation_id uuid
    references public.artist_representations(id)
    on delete restrict,
  add column review_due_at timestamptz,
  add column artist_submission_key text,
  add column source_artist_validation_id uuid;

alter table public.registry_provider_track_suggestions
  drop constraint registry_provider_track_suggestions_intake_origin_check,
  drop constraint registry_provider_track_suggestions_pending_slot_check,
  drop constraint registry_provider_track_suggestions_provider_evidence_check,
  drop constraint registry_provider_track_suggestions_public_title_check;

alter table public.registry_provider_track_suggestions
  add constraint registry_provider_track_suggestions_intake_origin_check
  check (
    intake_origin in (
      'playlist_editor',
      'public_contribution',
      'artist_submission'
    )
  ),
  add constraint registry_provider_track_suggestions_pending_slot_check
  check (
    not (
      status = 'needs_review'
      and source_playlist_item_id is null
      and canonical_track_id is null
    )
    or intake_origin in (
      'public_contribution',
      'artist_submission'
    )
    or reserved_position is not null
  ),
  add constraint registry_provider_track_suggestions_provider_evidence_check
  check (
    (
      intake_origin = 'playlist_editor'
      and provider_key is not null
      and provider_object_id is not null
      and provider_url is not null
      and playback_kind is not null
    )
    or (
      intake_origin = 'public_contribution'
      and (
        (
          provider_key is null
          and provider_object_id is null
          and provider_url is null
          and playback_kind is null
        )
        or (
          provider_key is not null
          and provider_object_id is not null
          and provider_url is not null
          and playback_kind is not null
        )
      )
    )
    or (
      intake_origin = 'artist_submission'
      and provider_key is not null
      and provider_object_id is not null
      and provider_url is not null
      and playback_kind is not null
    )
  ),
  add constraint registry_provider_track_suggestions_public_title_check
  check (
    intake_origin not in (
      'public_contribution',
      'artist_submission'
    )
    or nullif(
      btrim(submitted_track_title),
      ''
    ) is not null
  ),
  add constraint registry_provider_track_suggestions_artist_submission_context_check
  check (
    (
      intake_origin = 'artist_submission'
      and source_playlist_id is null
      and source_playlist_item_id is null
      and source_contribution_id is null
      and reserved_position is null
      and submitted_for_artist_id is not null
      and submitted_by_representation_id is not null
      and review_due_at is not null
      and source_artist_validation_id is not null
      and nullif(btrim(artist_submission_key), '') is not null
      and length(artist_submission_key) <= 200
    )
    or (
      intake_origin <> 'artist_submission'
      and submitted_for_artist_id is null
      and submitted_by_representation_id is null
      and review_due_at is null
      and source_artist_validation_id is null
      and artist_submission_key is null
    )
  ),
  add constraint registry_provider_track_suggestions_artist_submission_due_check
  check (
    review_due_at is null
    or review_due_at > created_at
  );

create unique index registry_provider_track_suggestions_artist_submission_key_uq
on public.registry_provider_track_suggestions (
  requested_by,
  submitted_for_artist_id,
  artist_submission_key
)
where intake_origin = 'artist_submission';

create unique index registry_provider_track_suggestions_artist_validation_uq
on public.registry_provider_track_suggestions (
  source_artist_validation_id
)
where source_artist_validation_id is not null;

create index registry_provider_track_suggestions_artist_submission_review_idx
on public.registry_provider_track_suggestions (
  status,
  review_due_at,
  created_at
)
where intake_origin = 'artist_submission';

alter table public.artist_representation_events
  drop constraint artist_representation_events_event_type_check;

alter table public.artist_representation_events
  add constraint artist_representation_events_event_type_check
  check (
    event_type in (
      'claim_submitted',
      'claim_withdrawn',
      'claim_verified',
      'claim_rejected',
      'representation_invited',
      'representation_accepted',
      'representation_updated',
      'representation_revoked',
      'profile_presentation_updated',
      'artist_update_published',
      'artist_update_edited',
      'artist_update_withdrawn',
      'music_submission_created'
    )
  );

create or replace function public.record_artist_music_submission_validation(
  p_requested_by uuid,
  p_artist_id uuid,
  p_provider_key text,
  p_provider_object_id text,
  p_provider_url text,
  p_provider_title text,
  p_provider_artist_names text[],
  p_provider_release_title text,
  p_playback_kind text,
  p_validation_snapshot jsonb,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, platform_private
as $$
declare
  v_rep public.artist_representations%rowtype;
  v_provider text :=
    lower(
      btrim(
        coalesce(
          p_provider_key,
          ''
        )
      )
    );
  v_object_id text :=
    nullif(
      btrim(p_provider_object_id),
      ''
    );
  v_url text :=
    nullif(
      btrim(p_provider_url),
      ''
    );
  v_title text :=
    nullif(
      btrim(p_provider_title),
      ''
    );
  v_id uuid := gen_random_uuid();
begin
  if p_requested_by is null
     or p_artist_id is null
  then
    raise exception
      'Artist submission validation requires a user and Artist.';
  end if;

  select representation.*
  into v_rep
  from public.artist_representations representation
  where representation.artist_id = p_artist_id
    and representation.user_id = p_requested_by
    and representation.status = 'active'
    and representation.can_submit_releases
  order by representation.created_at desc
  limit 1;

  if v_rep.id is null then
    raise exception
      'Artist music submission permission is required.';
  end if;

  if not exists (
    select 1
    from public.registry_artists artist
    where artist.id = p_artist_id
      and artist.status = 'active'
  ) then
    raise exception
      'Artist is unavailable for music submission.';
  end if;

  if v_provider not in (
    'apple_music',
    'spotify'
  )
     or v_object_id is null
     or v_url is null
     or v_title is null
     or p_playback_kind <> 'audio'
     or p_validation_snapshot is null
     or jsonb_typeof(p_validation_snapshot) <> 'object'
     or p_expires_at is null
     or p_expires_at <= now()
     or p_expires_at > now() + interval '1 hour'
  then
    raise exception
      'Complete provider evidence is required for Artist music submission.';
  end if;

  insert into platform_private.artist_music_submission_validations (
    id,
    requested_by,
    artist_id,
    representation_id,
    provider_key,
    provider_object_id,
    provider_url,
    provider_title,
    provider_artist_names,
    provider_release_title,
    playback_kind,
    validation_snapshot,
    checked_at,
    expires_at
  )
  values (
    v_id,
    p_requested_by,
    p_artist_id,
    v_rep.id,
    v_provider,
    v_object_id,
    v_url,
    v_title,
    coalesce(
      p_provider_artist_names,
      '{}'::text[]
    ),
    nullif(
      btrim(p_provider_release_title),
      ''
    ),
    p_playback_kind,
    p_validation_snapshot,
    now(),
    p_expires_at
  );

  return v_id;
end;
$$;

revoke all
on function public.record_artist_music_submission_validation(
  uuid,uuid,text,text,text,text,text[],text,text,jsonb,timestamptz
)
from public, anon, authenticated;

grant execute
on function public.record_artist_music_submission_validation(
  uuid,uuid,text,text,text,text,text[],text,text,jsonb,timestamptz
)
to service_role;

create or replace function public.community_submit_artist_music(
  p_artist_id uuid,
  p_validation_id uuid,
  p_artist_credits jsonb,
  p_submission_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, editorial, platform_private
as $$
declare
  v_actor uuid := auth.uid();
  v_rep public.artist_representations%rowtype;
  v_artist public.registry_artists%rowtype;
  v_validation platform_private.artist_music_submission_validations%rowtype;
  v_suggestion public.registry_provider_track_suggestions%rowtype;
  v_key text :=
    nullif(
      btrim(p_submission_key),
      ''
    );
  v_submitted_at timestamptz := now();
  v_review_due_at timestamptz;
  v_credit jsonb;
  v_credit_order integer := 1;
  v_credit_role text;
  v_observed_name text;
  v_seen_names text[] := '{}'::text[];
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;

  select *
  into v_rep
  from editorial.current_artist_representation(p_artist_id);

  if v_rep.id is null
     or not v_rep.can_submit_releases
  then
    raise exception 'insufficient_artist_music_privilege';
  end if;

  select artist.*
  into v_artist
  from public.registry_artists artist
  where artist.id = p_artist_id
    and artist.status = 'active';

  if not found then
    raise exception 'artist_not_found';
  end if;

  if v_key is null
     or length(v_key) > 200
  then
    raise exception 'invalid_artist_music_submission_key';
  end if;

  if p_artist_credits is null then
    p_artist_credits := '[]'::jsonb;
  end if;

  if jsonb_typeof(p_artist_credits) <> 'array'
     or jsonb_array_length(p_artist_credits) > 19
  then
    raise exception 'invalid_artist_music_credits';
  end if;

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_actor::text
      || '|artist-music|'
      || p_artist_id::text
      || '|'
      || v_key,
      0
    )
  );

  select suggestion.*
  into v_suggestion
  from public.registry_provider_track_suggestions suggestion
  where suggestion.intake_origin = 'artist_submission'
    and suggestion.requested_by = v_actor
    and suggestion.submitted_for_artist_id = p_artist_id
    and suggestion.artist_submission_key = v_key
  order by suggestion.created_at
  limit 1;

  if found then
    return jsonb_build_object(
      'id', v_suggestion.id,
      'artist_id', v_suggestion.submitted_for_artist_id,
      'status', v_suggestion.status,
      'track_title', v_suggestion.submitted_track_title,
      'release_title', v_suggestion.provider_release_title,
      'provider_key', v_suggestion.provider_key,
      'provider_url', v_suggestion.provider_url,
      'created_at', v_suggestion.created_at,
      'review_due_at', v_suggestion.review_due_at,
      'reviewed_at', v_suggestion.reviewed_at,
      'created', false
    );
  end if;

  select validation.*
  into v_validation
  from platform_private.artist_music_submission_validations validation
  where validation.id = p_validation_id
    and validation.requested_by = v_actor
    and validation.artist_id = p_artist_id
    and validation.representation_id = v_rep.id
    and validation.expires_at > now()
  for update;

  if not found then
    raise exception 'artist_music_validation_missing_or_expired';
  end if;

  v_review_due_at :=
    editorial.artist_music_submission_review_due_at(
      v_submitted_at
    );

  insert into public.registry_provider_track_suggestions (
    source_playlist_id,
    source_playlist_item_id,
    requested_by,
    canonical_track_id,
    registry_artist_id,
    artist_resolution_mode,
    provider_key,
    provider_object_id,
    provider_url,
    provider_title,
    provider_artist_names,
    provider_release_title,
    playback_kind,
    validation_snapshot,
    status,
    reserved_position,
    intake_origin,
    source_contribution_id,
    submitted_track_title,
    submitted_for_artist_id,
    submitted_by_representation_id,
    review_due_at,
    artist_submission_key,
    source_artist_validation_id,
    created_at,
    updated_at
  )
  values (
    null,
    null,
    v_actor,
    null,
    p_artist_id,
    'existing_artist',
    v_validation.provider_key,
    v_validation.provider_object_id,
    v_validation.provider_url,
    v_validation.provider_title,
    v_validation.provider_artist_names,
    v_validation.provider_release_title,
    v_validation.playback_kind,
    jsonb_strip_nulls(
      jsonb_build_object(
        'artist_submission_validation_id',
          v_validation.id,
        'validation_mode',
          'artist_submission',
        'checked_at',
          v_validation.checked_at,
        'artwork_url',
          v_validation.validation_snapshot
            #>> '{enrichment,track_artwork_url}',
        'preview_url',
          v_validation.validation_snapshot
            #>> '{enrichment,preview_url}',
        'provider_metadata',
          v_validation.validation_snapshot
      )
    ),
    'needs_review',
    null,
    'artist_submission',
    null,
    v_validation.provider_title,
    p_artist_id,
    v_rep.id,
    v_review_due_at,
    v_key,
    v_validation.id,
    v_submitted_at,
    v_submitted_at
  )
  returning *
  into v_suggestion;

  insert into public.registry_provider_track_suggestion_artists (
    suggestion_id,
    credit_order,
    credit_role,
    resolution_mode,
    registry_artist_id,
    observed_name
  )
  values (
    v_suggestion.id,
    1,
    'primary',
    'existing_artist',
    p_artist_id,
    v_artist.display_name
  );

  v_seen_names :=
    array[
      lower(
        btrim(v_artist.display_name)
      )
    ];

  for v_credit in
    select value
    from jsonb_array_elements(p_artist_credits)
  loop
    v_credit_role :=
      lower(
        btrim(
          coalesce(
            v_credit ->> 'credit_role',
            ''
          )
        )
      );

    v_observed_name :=
      nullif(
        btrim(
          v_credit ->> 'observed_name'
        ),
        ''
      );

    if v_credit_role not in (
      'primary',
      'featured'
    )
       or v_observed_name is null
       or length(v_observed_name) > 300
    then
      raise exception 'invalid_artist_music_credit';
    end if;

    if lower(v_observed_name) = any(v_seen_names) then
      raise exception 'duplicate_artist_music_credit';
    end if;

    v_seen_names :=
      array_append(
        v_seen_names,
        lower(v_observed_name)
      );

    v_credit_order := v_credit_order + 1;

    insert into public.registry_provider_track_suggestion_artists (
      suggestion_id,
      credit_order,
      credit_role,
      resolution_mode,
      registry_artist_id,
      observed_name
    )
    values (
      v_suggestion.id,
      v_credit_order,
      v_credit_role,
      'unresolved',
      null,
      v_observed_name
    );
  end loop;

  perform editorial.record_artist_representation_event(
    p_artist_id,
    'music_submission_created',
    null,
    v_rep.id,
    v_actor,
    jsonb_build_object(
      'registry_track_intake_id',
        v_suggestion.id,
      'provider_key',
        v_suggestion.provider_key,
      'provider_object_id',
        v_suggestion.provider_object_id,
      'review_due_at',
        v_suggestion.review_due_at
    )
  );

  return jsonb_build_object(
    'id', v_suggestion.id,
    'artist_id', v_suggestion.submitted_for_artist_id,
    'status', v_suggestion.status,
    'track_title', v_suggestion.submitted_track_title,
    'release_title', v_suggestion.provider_release_title,
    'provider_key', v_suggestion.provider_key,
    'provider_url', v_suggestion.provider_url,
    'artwork_url',
      v_suggestion.validation_snapshot
        ->> 'artwork_url',
    'created_at', v_suggestion.created_at,
    'review_due_at', v_suggestion.review_due_at,
    'reviewed_at', v_suggestion.reviewed_at,
    'created', true
  );
end;
$$;

revoke all
on function public.community_submit_artist_music(uuid,uuid,jsonb,text)
from public, anon;

grant execute
on function public.community_submit_artist_music(uuid,uuid,jsonb,text)
to authenticated;

create or replace function public.community_get_artist_music_submissions(
  p_artist_id uuid,
  p_limit integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, editorial
as $$
declare
  v_actor uuid := auth.uid();
  v_rep public.artist_representations%rowtype;
  v_limit integer :=
    least(
      greatest(
        coalesce(p_limit, 30),
        1
      ),
      100
    );
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;

  select *
  into v_rep
  from editorial.current_artist_representation(p_artist_id);

  if v_rep.id is null
     or not v_rep.can_submit_releases
  then
    raise exception 'insufficient_artist_music_privilege';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_strip_nulls(
        jsonb_build_object(
          'id', submission.id,
          'artist_id', submission.submitted_for_artist_id,
          'status', submission.status,
          'track_title', submission.submitted_track_title,
          'release_title', submission.provider_release_title,
          'provider_key', submission.provider_key,
          'provider_url', submission.provider_url,
          'artwork_url',
            submission.validation_snapshot
              ->> 'artwork_url',
          'created_at', submission.created_at,
          'review_due_at', submission.review_due_at,
          'reviewed_at', submission.reviewed_at,
          'sla_status',
            case
              when submission.reviewed_at is not null
                and submission.reviewed_at <= submission.review_due_at
                then 'reviewed_on_time'
              when submission.reviewed_at is not null
                then 'reviewed_late'
              when now() > submission.review_due_at
                then 'overdue'
              else 'on_time'
            end,
          'canonical_track_id',
            coalesce(
              submission.canonicalized_track_id,
              submission.canonical_track_id
            ),
          'canonical_track_title',
            canonical_track.title
        )
      )
      order by submission.created_at desc, submission.id desc
    ),
    '[]'::jsonb
  )
  into v_result
  from (
    select suggestion.*
    from public.registry_provider_track_suggestions suggestion
    where suggestion.intake_origin = 'artist_submission'
      and suggestion.submitted_for_artist_id = p_artist_id
    order by suggestion.created_at desc, suggestion.id desc
    limit v_limit
  ) submission
  left join public.registry_tracks canonical_track
    on canonical_track.id =
      coalesce(
        submission.canonicalized_track_id,
        submission.canonical_track_id
      );

  return v_result;
end;
$$;

revoke all
on function public.community_get_artist_music_submissions(uuid,integer)
from public, anon;

grant execute
on function public.community_get_artist_music_submissions(uuid,integer)
to authenticated;

create or replace function public.admin_resolve_registry_track_intake(
  p_suggestion_id uuid,
  p_registry_track_id uuid,
  p_review_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, auth, public
as $$
declare
  v_suggestion public.registry_provider_track_suggestions%rowtype;
  v_track public.registry_tracks%rowtype;
  v_artist_sync jsonb;
begin
  if auth.uid() is null then
    raise exception
      using
        errcode = '42501',
        message = 'Authentication is required.';
  end if;

  if not (
    public.current_user_is_administrator()
    or public.current_user_has_capability('manage_registry')
  ) then
    raise exception
      using
        errcode = '42501',
        message = 'Registry management permission is required.';
  end if;

  select suggestion.*
  into v_suggestion
  from public.registry_provider_track_suggestions suggestion
  where suggestion.id = p_suggestion_id
  for update;

  if not found then
    raise exception
      using
        errcode = 'P0002',
        message = 'Track Intake item does not exist.';
  end if;

  if v_suggestion.status <> 'needs_review' then
    raise exception
      'Only Track Intake items awaiting review can be resolved.';
  end if;

  if v_suggestion.source_playlist_item_id is null
     and v_suggestion.intake_origin not in (
       'public_contribution',
       'artist_submission'
     )
  then
    raise exception
      'Track Intake item has not been materialized into its Playlist.';
  end if;

  select track.*
  into v_track
  from public.registry_tracks track
  where track.id = p_registry_track_id
    and track.status = 'active';

  if not found then
    raise exception 'Selected Music Registry track is unavailable.';
  end if;

  select public.sync_registry_track_intake_artist_credits(
    p_suggestion_id,
    p_registry_track_id
  )
  into v_artist_sync;

  update public.registry_provider_track_suggestions suggestion
  set
    status = 'canonicalized',
    canonical_track_id = p_registry_track_id,
    canonicalized_track_id = p_registry_track_id,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    review_note = nullif(btrim(p_review_note), '')
  where suggestion.id = p_suggestion_id;

  return jsonb_build_object(
    'suggestion_id', p_suggestion_id,
    'playlist_id', v_suggestion.source_playlist_id,
    'playlist_item_id', v_suggestion.source_playlist_item_id,
    'intake_origin', v_suggestion.intake_origin,
    'source_contribution_id', v_suggestion.source_contribution_id,
    'status', 'canonicalized',
    'registry_track_id', p_registry_track_id,
    'registry_track_title', v_track.title,
    'artist_sync', v_artist_sync
  );
end;
$$;

insert into private.phase_0a_rpc_classification (
  function_signature,
  access_class,
  rationale
)
values
  (
    'record_artist_music_submission_validation(uuid,uuid,text,text,text,text,text[],text,text,jsonb,timestamp with time zone)',
    'service_command',
    'Records short-lived provider evidence only after service-side Artist representation authorization.'
  ),
  (
    'community_submit_artist_music(uuid,uuid,jsonb,text)',
    'authenticated_command',
    'Creates a non-canonical Artist submission in the existing Registry Track Intake queue only for active can_submit_releases authority.'
  ),
  (
    'community_get_artist_music_submissions(uuid,integer)',
    'authenticated_read',
    'Returns bounded Registry review status for one Artist only to an active representative with can_submit_releases.'
  )
on conflict (function_signature)
do update
set
  access_class = excluded.access_class,
  rationale = excluded.rationale,
  reviewed_at = now();

do $m5_postflight$
declare
  v_origin_constraint text;
  v_event_constraint text;
  v_submit_definition text;
  v_reader_definition text;
  v_resolver_definition text;
begin
  if to_regclass('platform_private.artist_music_submission_validations') is null then
    raise exception 'FAIL: Artist music validation table was not created';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'registry_provider_track_suggestions'
      and column_name = 'source_playlist_id'
      and is_nullable = 'YES'
  ) then
    raise exception 'FAIL: Track Intake still requires Playlist identity';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'registry_provider_track_suggestions'
      and column_name = 'review_due_at'
      and data_type = 'timestamp with time zone'
  ) then
    raise exception 'FAIL: Artist submission review deadline is missing';
  end if;

  select pg_get_constraintdef(oid)
  into v_origin_constraint
  from pg_constraint
  where conrelid = 'public.registry_provider_track_suggestions'::regclass
    and conname = 'registry_provider_track_suggestions_intake_origin_check';

  if position('artist_submission' in coalesce(v_origin_constraint, '')) = 0 then
    raise exception 'FAIL: Track Intake does not recognize Artist submission origin';
  end if;

  select pg_get_constraintdef(oid)
  into v_event_constraint
  from pg_constraint
  where conrelid = 'public.artist_representation_events'::regclass
    and conname = 'artist_representation_events_event_type_check';

  if position('music_submission_created' in coalesce(v_event_constraint, '')) = 0 then
    raise exception 'FAIL: Artist representation audit does not include music submission';
  end if;

  select pg_get_functiondef(
    'public.community_submit_artist_music(uuid,uuid,jsonb,text)'::regprocedure
  )
  into v_submit_definition;

  select pg_get_functiondef(
    'public.community_get_artist_music_submissions(uuid,integer)'::regprocedure
  )
  into v_reader_definition;

  select pg_get_functiondef(
    'public.admin_resolve_registry_track_intake(uuid,uuid,text)'::regprocedure
  )
  into v_resolver_definition;

  if position('can_submit_releases' in v_submit_definition) = 0
     or position('artist_submission' in v_submit_definition) = 0
     or position('artist_music_submission_review_due_at' in v_submit_definition) = 0
  then
    raise exception 'FAIL: Artist music submit authority or review SLA is incomplete';
  end if;

  if position('submitted_for_artist_id = p_artist_id' in v_reader_definition) = 0
     or position('can_submit_releases' in v_reader_definition) = 0
  then
    raise exception 'FAIL: Artist music history is not bounded to Artist authority';
  end if;

  if position('artist_submission' in v_resolver_definition) = 0 then
    raise exception 'FAIL: Registry review cannot resolve Artist submissions';
  end if;

  if v_submit_definition ~* '(insert|update|delete)[[:space:]]+(into[[:space:]]+)?public[.](registry_tracks|registry_releases|registry_artists)'
  then
    raise exception 'FAIL: Artist submission command can write canonical Registry rows';
  end if;

  if has_table_privilege(
       'authenticated',
       'platform_private.artist_music_submission_validations',
       'SELECT'
     )
     or has_table_privilege(
       'authenticated',
       'platform_private.artist_music_submission_validations',
       'INSERT'
     )
  then
    raise exception 'FAIL: Artist validation storage leaked to authenticated clients';
  end if;
end;
$m5_postflight$;

commit;
