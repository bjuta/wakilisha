-- Phase 5B M230:
-- 1. repair the generic existing-Track Track Intake path so reviewed artist
--    credits are synchronized before canonicalization;
-- 2. provide a later, idempotent convergence point for the historical Top 50
--    artist-credit repair whose original production timestamp sorted too early;
-- 3. remain safe on empty/local schema replay where production editorial data
--    is intentionally absent.

begin;

create or replace function public.sync_registry_track_intake_artist_credits(
  p_suggestion_id uuid,
  p_registry_track_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_suggestion public.registry_provider_track_suggestions%rowtype;
  v_track public.registry_tracks%rowtype;
  v_credit record;
  v_existing_id uuid;
  v_existing_count integer;
  v_target_collision_count integer;
  v_expected_role text;
  v_expected_primary boolean;
  v_expected_featured boolean;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_unchanged integer := 0;
  v_reviewed integer := 0;
begin
  select suggestion.*
  into v_suggestion
  from public.registry_provider_track_suggestions suggestion
  where suggestion.id = p_suggestion_id;

  if not found then
    raise exception 'Track Intake item does not exist.';
  end if;

  if v_suggestion.status not in ('needs_review', 'canonicalized') then
    raise exception
      'Track Intake artist synchronization requires a reviewable or canonicalized suggestion.';
  end if;

  select track.*
  into v_track
  from public.registry_tracks track
  where track.id = p_registry_track_id
    and track.status = 'active';

  if not found then
    raise exception 'Selected Music Registry track is unavailable.';
  end if;

  for v_credit in
    select
      credit.id as source_credit_id,
      credit.credit_order,
      credit.credit_role,
      credit.observed_name,
      credit.registry_artist_id,
      artist.id as artist_id,
      artist.slug as artist_slug,
      artist.display_name as artist_name
    from public.registry_provider_track_suggestion_artists credit
    join public.registry_artists artist
      on artist.id = credit.registry_artist_id
     and artist.status = 'active'
    where credit.suggestion_id = p_suggestion_id
      and credit.resolution_mode = 'existing_artist'
      and credit.credit_role in ('primary', 'featured')
    order by credit.credit_order, credit.id
  loop
    v_reviewed := v_reviewed + 1;

    v_expected_role :=
      case
        when v_credit.credit_role = 'featured'
          then 'featured_artist'
        else 'primary_artist'
      end;

    v_expected_primary := v_credit.credit_role = 'primary';
    v_expected_featured := v_credit.credit_role = 'featured';

    select count(*)::integer
    into v_existing_count
    from public.registry_track_artists track_artist
    where track_artist.track_id = p_registry_track_id
      and (
        track_artist.artist_id = v_credit.artist_id
        or lower(coalesce(track_artist.artist_slug, '')) =
           lower(v_credit.artist_slug)
      )
      and track_artist.status = 'active';

    if v_existing_count > 1 then
      raise exception
        'Registry Track has more than one active relationship for reviewed artist %.',
        v_credit.artist_name;
    end if;

    v_existing_id := null;

    select track_artist.id
    into v_existing_id
    from public.registry_track_artists track_artist
    where track_artist.track_id = p_registry_track_id
      and (
        track_artist.artist_id = v_credit.artist_id
        or lower(coalesce(track_artist.artist_slug, '')) =
           lower(v_credit.artist_slug)
      )
    order by
      case
        when track_artist.status = 'active' then 0
        when track_artist.status = 'needs_review' then 1
        else 2
      end,
      case
        when track_artist.artist_id = v_credit.artist_id then 0
        else 1
      end,
      track_artist.created_at,
      track_artist.id
    limit 1
    for update;

    select count(*)::integer
    into v_target_collision_count
    from public.registry_track_artists track_artist
    where track_artist.track_id = p_registry_track_id
      and track_artist.artist_id = v_credit.artist_id
      and track_artist.role = v_expected_role
      and track_artist.credit_order = v_credit.credit_order
      and (
        v_existing_id is null
        or track_artist.id <> v_existing_id
      );

    if v_target_collision_count > 0 then
      raise exception
        'Registry Track artist synchronization would collide with an existing reviewed target key for %.',
        v_credit.artist_name;
    end if;

    if v_existing_id is null then
      insert into public.registry_track_artists (
        track_id,
        artist_id,
        artist_slug,
        artist_name_text,
        role,
        is_primary,
        is_featured,
        credit_order,
        display_credit,
        source,
        confidence,
        status,
        metadata,
        created_at,
        updated_at
      )
      values (
        p_registry_track_id,
        v_credit.artist_id,
        v_credit.artist_slug,
        v_credit.artist_name,
        v_expected_role,
        v_expected_primary,
        v_expected_featured,
        v_credit.credit_order,
        v_credit.artist_name,
        'track_intake_review',
        100,
        'active',
        jsonb_build_object(
          'source_suggestion_id', p_suggestion_id::text,
          'source_credit_id', v_credit.source_credit_id::text,
          'observed_name', v_credit.observed_name,
          'sync_contract', 'phase5b_registry_artist_credit_parity_v2'
        ),
        now(),
        now()
      );

      v_inserted := v_inserted + 1;
    elsif exists (
      select 1
      from public.registry_track_artists track_artist
      where track_artist.id = v_existing_id
        and track_artist.artist_id is not distinct from v_credit.artist_id
        and track_artist.artist_slug is not distinct from v_credit.artist_slug
        and track_artist.artist_name_text is not distinct from v_credit.artist_name
        and track_artist.role = v_expected_role
        and track_artist.is_primary = v_expected_primary
        and track_artist.is_featured = v_expected_featured
        and track_artist.credit_order = v_credit.credit_order
        and track_artist.display_credit is not distinct from v_credit.artist_name
        and track_artist.status = 'active'
    ) then
      v_unchanged := v_unchanged + 1;
    else
      update public.registry_track_artists track_artist
      set
        artist_id = v_credit.artist_id,
        artist_slug = v_credit.artist_slug,
        artist_name_text = v_credit.artist_name,
        role = v_expected_role,
        is_primary = v_expected_primary,
        is_featured = v_expected_featured,
        credit_order = v_credit.credit_order,
        display_credit = v_credit.artist_name,
        source = 'track_intake_review',
        confidence = 100,
        status = 'active',
        metadata =
          coalesce(track_artist.metadata, '{}'::jsonb)
          || jsonb_build_object(
            'source_suggestion_id', p_suggestion_id::text,
            'source_credit_id', v_credit.source_credit_id::text,
            'observed_name', v_credit.observed_name,
            'sync_contract', 'phase5b_registry_artist_credit_parity_v2'
          ),
        updated_at = now()
      where track_artist.id = v_existing_id;

      v_updated := v_updated + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'suggestion_id', p_suggestion_id,
    'registry_track_id', p_registry_track_id,
    'reviewed_artist_credits', v_reviewed,
    'inserted_artist_credits', v_inserted,
    'updated_artist_credits', v_updated,
    'unchanged_artist_credits', v_unchanged
  );
end;
$function$;

revoke all
on function public.sync_registry_track_intake_artist_credits(uuid, uuid)
from public, anon, authenticated, service_role;

create or replace function public.admin_resolve_registry_track_intake(
  p_suggestion_id uuid,
  p_registry_track_id uuid,
  p_review_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'auth', 'public'
as $function$
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
     and v_suggestion.intake_origin <> 'public_contribution'
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
$function$;

revoke all
on function public.admin_resolve_registry_track_intake(uuid, uuid, text)
from public, anon;

grant execute
on function public.admin_resolve_registry_track_intake(uuid, uuid, text)
to authenticated;

-- Idempotent convergence for the first real Playlist.
do $top50_convergence$
declare
  v_playlist_id uuid;
  v_suggestion record;
  v_result jsonb;
  v_parity integer;
begin
  select id
  into v_playlist_id
  from public.wk_playlists
  where slug = 'top-50-kenyan-songs-of-2025'
  for update;

  if v_playlist_id is null then
    raise notice
      'REPLAY SKIP: Top 50 production Playlist is absent; generic M230 authority is installed with no editorial data mutation.';
    return;
  end if;

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
    error_message,
    actor,
    created_at
  )
  select
    'track',
    suggestion.canonical_track_id::text,
    suggestion.id::text,
    'registry_provider_track_suggestion_artists',
    'credit_role',
    'registry_provider_track_suggestion_artists.credit_role',
    jsonb_build_object(
      'credit_id', credit.id,
      'observed_name', credit.observed_name,
      'credit_role', credit.credit_role
    ),
    jsonb_build_object(
      'credit_id', credit.id,
      'observed_name', credit.observed_name,
      'credit_role', 'featured'
    ),
    'record_review_decision',
    'applied',
    null,
    'phase5b_m230_replay_convergence',
    now()
  from public.registry_provider_track_suggestion_artists credit
  join public.registry_provider_track_suggestions suggestion
    on suggestion.id = credit.suggestion_id
  join public.wk_playlist_items item
    on item.id = suggestion.source_playlist_item_id
  where suggestion.source_playlist_id = v_playlist_id
    and credit.credit_role = 'unresolved'
    and (
      (item.position = 2 and credit.observed_name = 'Dyana Cods')
      or (item.position = 32 and credit.observed_name = 'Liboi')
      or (item.position = 48 and credit.observed_name = 'Soundkraft')
    );

  update public.registry_provider_track_suggestion_artists credit
  set credit_role = 'featured'
  from public.registry_provider_track_suggestions suggestion,
       public.wk_playlist_items item
  where suggestion.id = credit.suggestion_id
    and item.id = suggestion.source_playlist_item_id
    and suggestion.source_playlist_id = v_playlist_id
    and credit.credit_role = 'unresolved'
    and (
      (item.position = 2 and credit.observed_name = 'Dyana Cods')
      or (item.position = 32 and credit.observed_name = 'Liboi')
      or (item.position = 48 and credit.observed_name = 'Soundkraft')
    );

  if exists (
    select 1
    from public.registry_provider_track_suggestion_artists credit
    join public.registry_provider_track_suggestions suggestion
      on suggestion.id = credit.suggestion_id
    where suggestion.source_playlist_id = v_playlist_id
      and (
        credit.resolution_mode <> 'existing_artist'
        or credit.registry_artist_id is null
        or credit.credit_role not in ('primary', 'featured')
      )
  ) then
    raise exception
      'STOP: Top 50 replay convergence found unresolved Registry artist decisions.';
  end if;

  for v_suggestion in
    select id, canonical_track_id
    from public.registry_provider_track_suggestions
    where source_playlist_id = v_playlist_id
      and status = 'canonicalized'
      and canonical_track_id is not null
    order by created_at, id
  loop
    select public.sync_registry_track_intake_artist_credits(
      v_suggestion.id,
      v_suggestion.canonical_track_id
    )
    into v_result;
  end loop;

  with reviewed as (
    select
      suggestion.canonical_track_id as track_id,
      credit.registry_artist_id as artist_id,
      credit.credit_role,
      credit.credit_order
    from public.registry_provider_track_suggestion_artists credit
    join public.registry_provider_track_suggestions suggestion
      on suggestion.id = credit.suggestion_id
    where suggestion.source_playlist_id = v_playlist_id
  )
  select count(*)::integer
  into v_parity
  from reviewed
  join public.registry_track_artists track_artist
    on track_artist.track_id = reviewed.track_id
   and track_artist.artist_id = reviewed.artist_id
   and track_artist.status = 'active'
  where (
    (
      reviewed.credit_role = 'primary'
      and track_artist.role = 'primary_artist'
      and track_artist.is_primary
      and not track_artist.is_featured
    )
    or (
      reviewed.credit_role = 'featured'
      and track_artist.role = 'featured_artist'
      and not track_artist.is_primary
      and track_artist.is_featured
    )
  )
    and track_artist.credit_order = reviewed.credit_order;

  if v_parity <> 107 then
    raise exception
      'STOP: Top 50 replay convergence expected 107/107 reviewed artist-credit parity, found %.',
      v_parity;
  end if;

  if (
    select count(*)::integer
    from public.wk_playlist_items item
    where item.playlist_id = v_playlist_id
      and item.lifecycle_state = 'active'
      and exists (
        select 1
        from public.registry_track_artists track_artist
        join public.registry_artists artist
          on artist.id = track_artist.artist_id
         and artist.status = 'active'
        where track_artist.track_id = item.registry_track_id
          and track_artist.status = 'active'
          and track_artist.is_primary
      )
  ) <> 50 then
    raise exception
      'STOP: Top 50 replay convergence requires all 50 canonical Tracks to retain an active Primary artist.';
  end if;
end;
$top50_convergence$;

commit;
