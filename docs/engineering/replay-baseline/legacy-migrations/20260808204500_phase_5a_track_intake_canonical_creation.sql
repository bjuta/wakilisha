begin;

do $phase_5a_m217_preflight$
begin
  if to_regprocedure(
       'public.admin_resolve_registry_track_intake_enriched(uuid,uuid,text,boolean)'
     ) is null
     or to_regclass(
       'public.registry_provider_track_suggestion_artists'
     ) is null
     or to_regclass('public.registry_track_artists') is null
  then
    raise exception
      'M217 requires the live Phase 5A Track Intake authority.';
  end if;
end;
$phase_5a_m217_preflight$;

create or replace function public.admin_create_registry_track_from_intake_enriched(
  p_suggestion_id uuid,
  p_title text,
  p_review_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'auth', 'public'
as $function$
declare
  v_suggestion public.registry_provider_track_suggestions%rowtype;
  v_title text;
  v_title_slug text;
  v_normalized_title text;
  v_track_id uuid := gen_random_uuid();
  v_slug text;
  v_primary_artist_id uuid;
  v_primary_artist_slug text;
  v_existing_track_id uuid;
  v_artist_count integer := 0;
  v_unresolved_artist_count integer := 0;
  v_fields jsonb := '{}'::jsonb;
  v_isrc text;
  v_result jsonb;
  v_after jsonb;
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
      'Only Track Intake items awaiting review can create a canonical track.';
  end if;

  if v_suggestion.canonical_track_id is not null
     or v_suggestion.canonicalized_track_id is not null
  then
    raise exception
      'This Track Intake item already has canonical Registry identity.';
  end if;

  v_title := nullif(btrim(p_title), '');

  if v_title is null then
    raise exception
      'Confirm the canonical track title before creating the Registry track.';
  end if;

  v_title_slug := public.wk_slugify_text(v_title);

  if nullif(v_title_slug, '') is null then
    raise exception
      'Canonical track title cannot produce a valid Registry slug.';
  end if;

  v_normalized_title := trim(
    regexp_replace(
      lower(v_title),
      '[^[:alnum:]]+',
      ' ',
      'g'
    )
  );

  select
    count(*)::integer,
    count(*) filter (
      where artist_credit.resolution_mode <> 'existing_artist'
         or artist_credit.registry_artist_id is null
         or artist.id is null
         or artist.status <> 'active'
    )::integer
  into
    v_artist_count,
    v_unresolved_artist_count
  from public.registry_provider_track_suggestion_artists artist_credit
  left join public.registry_artists artist
    on artist.id = artist_credit.registry_artist_id
  where artist_credit.suggestion_id = p_suggestion_id;

  if v_artist_count = 0 then
    raise exception
      'A canonical Registry track requires at least one reviewed artist credit.';
  end if;

  if v_unresolved_artist_count > 0 then
    raise exception
      'Resolve every artist credit to an active existing Registry artist before creating the canonical track.';
  end if;

  select
    artist_credit.registry_artist_id,
    artist.slug
  into
    v_primary_artist_id,
    v_primary_artist_slug
  from public.registry_provider_track_suggestion_artists artist_credit
  join public.registry_artists artist
    on artist.id = artist_credit.registry_artist_id
  where artist_credit.suggestion_id = p_suggestion_id
    and artist_credit.credit_role = 'primary'
    and artist_credit.resolution_mode = 'existing_artist'
    and artist.status = 'active'
  order by artist_credit.credit_order, artist_credit.id
  limit 1;

  if v_primary_artist_id is null then
    raise exception
      'A canonical Registry track requires a reviewed primary artist.';
  end if;

  select coalesce(
    jsonb_object_agg(
      suggestion.field_name,
      suggestion.suggested_value
    ),
    '{}'::jsonb
  )
  into v_fields
  from public.registry_enrichment_suggestions suggestion
  where suggestion.registry_entity_type = 'track'
    and suggestion.registry_entity_id = p_suggestion_id::text
    and suggestion.decision_status = 'approved';

  v_isrc := nullif(btrim(v_fields ->> 'isrc'), '');

  if v_isrc is not null then
    select track.id
    into v_existing_track_id
    from public.registry_tracks track
    where track.isrc = v_isrc
      and track.status <> 'archived'
    order by track.created_at
    limit 1;

    if v_existing_track_id is not null then
      raise exception
        'A Registry track with accepted ISRC % already exists (%). Select that canonical track instead.',
        v_isrc,
        v_existing_track_id;
    end if;
  end if;

  v_existing_track_id := null;

  select track.id
  into v_existing_track_id
  from public.registry_tracks track
  join public.registry_track_artists track_artist
    on track_artist.track_id = track.id
   and track_artist.artist_id = v_primary_artist_id
   and track_artist.status = 'active'
  where track.normalized_title = v_normalized_title
    and track.status <> 'archived'
  order by track.created_at
  limit 1;

  if v_existing_track_id is not null then
    raise exception
      'A Registry track with this reviewed title and primary artist already exists (%). Select that canonical track instead.',
      v_existing_track_id;
  end if;

  v_slug :=
    coalesce(
      nullif(btrim(v_primary_artist_slug), ''),
      'track'
    )
    || '--'
    || v_title_slug;

  if exists (
    select 1
    from public.registry_tracks track
    where track.slug = v_slug
      and track.status <> 'archived'
  ) then
    v_slug :=
      v_slug
      || '--'
      || left(replace(v_track_id::text, '-', ''), 8);
  end if;

  insert into public.registry_tracks (
    id,
    slug,
    title,
    normalized_title,
    release_id,
    status,
    metadata,
    created_at,
    updated_at
  )
  values (
    v_track_id,
    v_slug,
    v_title,
    v_normalized_title,
    null,
    'active',
    jsonb_strip_nulls(
      jsonb_build_object(
        'track_intake_source_suggestion_id',
          p_suggestion_id::text,
        'track_intake_created_at',
          now(),
        'release_evidence',
          jsonb_strip_nulls(
            jsonb_build_object(
              'title',
                nullif(
                  btrim(v_fields ->> 'release_title'),
                  ''
                ),
              'release_date',
                nullif(
                  btrim(v_fields ->> 'release_date'),
                  ''
                ),
              'release_date_precision',
                nullif(
                  btrim(
                    v_fields ->> 'release_date_precision'
                  ),
                  ''
                ),
              'artwork_url',
                nullif(
                  btrim(
                    v_fields ->> 'release_artwork_url'
                  ),
                  ''
                ),
              'label_name',
                nullif(
                  btrim(v_fields ->> 'label_name'),
                  ''
                ),
              'imprint_name',
                nullif(
                  btrim(v_fields ->> 'imprint_name'),
                  ''
                ),
              'upc',
                nullif(btrim(v_fields ->> 'upc'), ''),
              'copyright_text',
                nullif(
                  btrim(v_fields ->> 'copyright_text'),
                  ''
                )
            )
          )
      )
    ),
    now(),
    now()
  );

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
  select
    v_track_id,
    artist.id,
    artist.slug,
    artist.display_name,
    case
      when artist_credit.credit_role = 'featured'
        then 'featured_artist'
      else 'primary_artist'
    end,
    artist_credit.credit_role = 'primary',
    artist_credit.credit_role = 'featured',
    artist_credit.credit_order,
    artist.display_name,
    'track_intake_review',
    100,
    'active',
    jsonb_build_object(
      'source_suggestion_id',
        p_suggestion_id::text,
      'observed_name',
        artist_credit.observed_name
    ),
    now(),
    now()
  from public.registry_provider_track_suggestion_artists artist_credit
  join public.registry_artists artist
    on artist.id = artist_credit.registry_artist_id
  where artist_credit.suggestion_id = p_suggestion_id
    and artist_credit.resolution_mode = 'existing_artist'
    and artist.status = 'active'
  order by artist_credit.credit_order, artist_credit.id;

  select public.admin_resolve_registry_track_intake_enriched(
    p_suggestion_id,
    v_track_id,
    p_review_note,
    false
  )
  into v_result;

  select to_jsonb(track)
  into v_after
  from public.registry_tracks track
  where track.id = v_track_id;

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
  values (
    'track',
    v_track_id::text,
    p_suggestion_id::text,
    'registry_provider_track_suggestions',
    'canonical_identity',
    'registry_tracks',
    null,
    v_after,
    'create_from_track_intake',
    'applied',
    null,
    auth.uid()::text,
    now()
  );

  return coalesce(v_result, '{}'::jsonb)
    || jsonb_build_object(
      'created_registry_track_id',
        v_track_id,
      'created_registry_track_title',
        v_title,
      'created_registry_track_slug',
        v_slug,
      'created',
        true
    );
end;
$function$;

comment on function public.admin_create_registry_track_from_intake_enriched(
  uuid,
  text,
  text
)
is
  'Creates one canonical Registry track from reviewed Track Intake evidence using only pre-resolved existing artist identities, then atomically applies accepted enrichment and resolves the same Playlist item.';

revoke all
on function public.admin_create_registry_track_from_intake_enriched(
  uuid,
  text,
  text
)
from public;

revoke all
on function public.admin_create_registry_track_from_intake_enriched(
  uuid,
  text,
  text
)
from anon;

grant execute
on function public.admin_create_registry_track_from_intake_enriched(
  uuid,
  text,
  text
)
to authenticated;

commit;
