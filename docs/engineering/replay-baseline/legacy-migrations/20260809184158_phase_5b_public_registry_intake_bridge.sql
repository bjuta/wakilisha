begin;

do $phase_5b_m224_preflight$
begin
  if to_regclass(
       'public.registry_provider_track_suggestions'
     ) is null
     or to_regclass(
       'public.registry_provider_track_suggestion_artists'
     ) is null
     or to_regclass(
       'public.community_contributions'
     ) is null
     or to_regclass(
       'editorial.playlist_publication_snapshots'
     ) is null
     or to_regprocedure(
       'public.admin_resolve_registry_track_intake(uuid,uuid,text)'
     ) is null
     or to_regprocedure(
       'public.admin_resolve_registry_track_intake_enriched(uuid,uuid,text,boolean)'
     ) is null
     or to_regprocedure(
       'public.admin_create_registry_track_from_intake_enriched(uuid,text,text)'
     ) is null
     or to_regprocedure(
       'editorial.sync_playlist_registry_intake_item_artists()'
     ) is null
     or to_regprocedure(
       'editorial.materialize_canonicalized_playlist_registry_intake()'
     ) is null
  then
    raise exception
      'STOP: Required Community, Playlist, or Registry intake authority is missing.';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'registry_provider_track_suggestions'
      and column_name in (
        'intake_origin',
        'source_contribution_id'
      )
  ) then
    raise exception
      'STOP: One or more M224 Registry intake origin columns already exist.';
  end if;

  if to_regprocedure(
       'public.create_public_playlist_missing_track_submission(uuid,uuid,text,text,text[],text,jsonb,text)'
     ) is not null
     or to_regprocedure(
       'public.admin_update_registry_track_intake_artist_credit(uuid,integer,text,text,uuid,text)'
     ) is not null
  then
    raise exception
      'STOP: One or more M224 commands already exist.';
  end if;
end;
$phase_5b_m224_preflight$;


alter table public.registry_provider_track_suggestions
  add column intake_origin text not null default 'playlist_editor',
  add column source_contribution_id uuid,
  add column submitted_track_title text;

alter table public.registry_provider_track_suggestions
  alter column provider_key drop not null,
  alter column provider_object_id drop not null,
  alter column provider_url drop not null,
  alter column playback_kind drop not null;

alter table public.registry_provider_track_suggestions
  add constraint registry_provider_track_suggestions_intake_origin_check
  check (
    intake_origin in (
      'playlist_editor',
      'public_contribution'
    )
  ),
  add constraint registry_provider_track_suggestions_contribution_origin_check
  check (
    intake_origin = 'public_contribution'
    or source_contribution_id is null
  ),
  add constraint registry_provider_track_suggestions_public_title_check
  check (
    intake_origin <> 'public_contribution'
    or nullif(
         btrim(submitted_track_title),
         ''
       ) is not null
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
  ),
  add constraint registry_provider_track_suggestions_source_contribution_fkey
  foreign key (source_contribution_id)
  references public.community_contributions(id)
  on delete set null;

create unique index registry_provider_track_suggestions_source_contribution_uq
  on public.registry_provider_track_suggestions (
    source_contribution_id
  )
  where source_contribution_id is not null;


alter table public.registry_provider_track_suggestions
  drop constraint registry_provider_track_suggestions_pending_slot_check;

alter table public.registry_provider_track_suggestions
  add constraint registry_provider_track_suggestions_pending_slot_check
  check (
    not (
      status = 'needs_review'
      and source_playlist_item_id is null
      and canonical_track_id is null
    )
    or intake_origin = 'public_contribution'
    or reserved_position is not null
  );


alter table public.registry_provider_track_suggestion_artists
  drop constraint registry_provider_track_suggestion_artists_role_check;

alter table public.registry_provider_track_suggestion_artists
  add constraint registry_provider_track_suggestion_artists_role_check
  check (
    credit_role in (
      'primary',
      'featured',
      'unresolved'
    )
  );


create unique index community_missing_track_submission_key_uq
  on public.community_contributions (
    user_id,
    entity_id,
    ((payload ->> 'submission_key'))
  )
  where contribution_type = 'missing_track'
    and nullif(
      btrim(payload ->> 'submission_key'),
      ''
    ) is not null;


create or replace function editorial.sync_playlist_registry_intake_item_artists()
returns trigger
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_suggestion_id uuid;
  v_intake_origin text;
  v_item_id uuid;
  v_artist_names text[];
begin
  v_suggestion_id :=
    coalesce(
      new.suggestion_id,
      old.suggestion_id
    );

  select suggestion.intake_origin
  into v_intake_origin
  from public.registry_provider_track_suggestions suggestion
  where suggestion.id = v_suggestion_id;

  if not found
     or v_intake_origin = 'public_contribution'
  then
    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
  end if;

  v_item_id :=
    editorial.ensure_playlist_registry_intake_item(
      v_suggestion_id
    );

  if v_item_id is null then
    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
  end if;

  select coalesce(
    array_agg(
      coalesce(
        artist.display_name,
        credit.observed_name
      )
      order by credit.credit_order
    ) filter (
      where coalesce(
        artist.display_name,
        credit.observed_name
      ) is not null
    ),
    '{}'::text[]
  )
  into v_artist_names
  from public.registry_provider_track_suggestion_artists credit
  left join public.registry_artists artist
    on artist.id = credit.registry_artist_id
  where credit.suggestion_id = v_suggestion_id;

  update public.wk_playlist_items item
  set artist_names =
    coalesce(
      v_artist_names,
      '{}'::text[]
    )
  where item.id = v_item_id
    and item.lifecycle_state = 'active';

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$function$;


drop trigger if exists
  registry_provider_track_suggestion_materialize_playlist_slot
on public.registry_provider_track_suggestions;

create trigger registry_provider_track_suggestion_materialize_playlist_slot
after update of status, canonicalized_track_id
on public.registry_provider_track_suggestions
for each row
when (
  new.intake_origin = 'playlist_editor'
)
execute function editorial.materialize_canonicalized_playlist_registry_intake();


create or replace function public.admin_resolve_registry_track_intake(
  p_suggestion_id uuid,
  p_registry_track_id uuid,
  p_review_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'auth',
  'public'
as $function$
declare
  v_suggestion public.registry_provider_track_suggestions%rowtype;
  v_track public.registry_tracks%rowtype;
begin
  if auth.uid() is null then
    raise exception
      using
        errcode = '42501',
        message = 'Authentication is required.';
  end if;

  if not (
    public.current_user_is_administrator()
    or public.current_user_has_capability(
      'manage_registry'
    )
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
    raise exception
      'Selected Music Registry track is unavailable.';
  end if;

  update public.registry_provider_track_suggestions suggestion
  set
    status = 'canonicalized',
    canonical_track_id = p_registry_track_id,
    canonicalized_track_id = p_registry_track_id,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    review_note =
      nullif(
        btrim(p_review_note),
        ''
      )
  where suggestion.id = p_suggestion_id;

  return jsonb_build_object(
    'suggestion_id',
      p_suggestion_id,
    'playlist_id',
      v_suggestion.source_playlist_id,
    'playlist_item_id',
      v_suggestion.source_playlist_item_id,
    'intake_origin',
      v_suggestion.intake_origin,
    'source_contribution_id',
      v_suggestion.source_contribution_id,
    'status',
      'canonicalized',
    'registry_track_id',
      p_registry_track_id,
    'registry_track_title',
      v_track.title
  );
end;
$function$;

revoke all
on function public.admin_resolve_registry_track_intake(
  uuid,
  uuid,
  text
)
from public, anon, service_role;

grant execute
on function public.admin_resolve_registry_track_intake(
  uuid,
  uuid,
  text
)
to authenticated;


create or replace function public.admin_update_registry_track_intake_artist_credit(
  p_suggestion_id uuid,
  p_credit_order integer,
  p_credit_role text,
  p_resolution_mode text,
  p_registry_artist_id uuid default null,
  p_observed_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'auth',
  'public'
as $function$
declare
  v_suggestion public.registry_provider_track_suggestions%rowtype;
  v_credit public.registry_provider_track_suggestion_artists%rowtype;
  v_role text :=
    lower(
      btrim(
        coalesce(
          p_credit_role,
          ''
        )
      )
    );
  v_mode text :=
    lower(
      btrim(
        coalesce(
          p_resolution_mode,
          ''
        )
      )
    );
  v_observed_name text :=
    nullif(
      btrim(p_observed_name),
      ''
    );
  v_artist_name text;
begin
  if auth.uid() is null then
    raise exception
      using
        errcode = '42501',
        message = 'Authentication is required.';
  end if;

  if not (
    public.current_user_is_administrator()
    or public.current_user_has_capability(
      'manage_registry'
    )
  ) then
    raise exception
      using
        errcode = '42501',
        message = 'Registry management permission is required.';
  end if;

  if p_suggestion_id is null
     or p_credit_order is null
     or p_credit_order < 1
  then
    raise exception
      'Track Intake artist credit is required.';
  end if;

  if v_role not in (
    'primary',
    'featured',
    'unresolved'
  ) then
    raise exception
      'Artist credit role must be Primary, Featured, or Unresolved.';
  end if;

  if v_mode not in (
    'existing_artist',
    'alias_candidate',
    'new_artist',
    'unresolved'
  ) then
    raise exception
      'Artist resolution is invalid.';
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
      'Only Track Intake items awaiting review can change artist credits.';
  end if;

  select credit.*
  into v_credit
  from public.registry_provider_track_suggestion_artists credit
  where credit.suggestion_id = p_suggestion_id
    and credit.credit_order = p_credit_order
  for update;

  if not found then
    raise exception
      using
        errcode = 'P0002',
        message = 'Track Intake artist credit does not exist.';
  end if;

  if v_mode in (
    'existing_artist',
    'alias_candidate'
  ) then
    if p_registry_artist_id is null then
      raise exception
        'Select a Music Registry artist for this credit.';
    end if;

    select artist.display_name
    into v_artist_name
    from public.registry_artists artist
    where artist.id = p_registry_artist_id
      and artist.status = 'active';

    if not found then
      raise exception
        'Selected Music Registry artist is unavailable.';
    end if;

    v_observed_name :=
      coalesce(
        v_observed_name,
        v_artist_name
      );
  else
    if p_registry_artist_id is not null then
      raise exception
        'Unresolved and new artist credits cannot claim Registry identity.';
    end if;

    if v_observed_name is null then
      raise exception
        'Artist name is required.';
    end if;
  end if;

  if p_registry_artist_id is not null
     and exists (
       select 1
       from public.registry_provider_track_suggestion_artists other_credit
       where other_credit.suggestion_id = p_suggestion_id
         and other_credit.credit_order <> p_credit_order
         and other_credit.registry_artist_id =
               p_registry_artist_id
     )
  then
    raise exception
      'The same Registry artist cannot appear twice in one Track Intake item.';
  end if;

  if p_registry_artist_id is null
     and exists (
       select 1
       from public.registry_provider_track_suggestion_artists other_credit
       where other_credit.suggestion_id = p_suggestion_id
         and other_credit.credit_order <> p_credit_order
         and other_credit.registry_artist_id is null
         and lower(
               btrim(
                 other_credit.observed_name
               )
             ) =
             lower(
               btrim(
                 v_observed_name
               )
             )
     )
  then
    raise exception
      'The same observed artist cannot appear twice in one Track Intake item.';
  end if;

  update public.registry_provider_track_suggestion_artists credit
  set
    credit_role = v_role,
    resolution_mode = v_mode,
    registry_artist_id =
      case
        when v_mode in (
          'existing_artist',
          'alias_candidate'
        )
        then p_registry_artist_id
        else null
      end,
    observed_name = v_observed_name
  where credit.suggestion_id = p_suggestion_id
    and credit.credit_order = p_credit_order
  returning credit.*
  into v_credit;

  return jsonb_build_object(
    'suggestion_id',
      p_suggestion_id,
    'credit_order',
      v_credit.credit_order,
    'credit_role',
      v_credit.credit_role,
    'resolution_mode',
      v_credit.resolution_mode,
    'registry_artist_id',
      v_credit.registry_artist_id,
    'observed_name',
      v_credit.observed_name,
    'display_name',
      coalesce(
        v_artist_name,
        v_credit.observed_name
      )
  );
end;
$function$;

revoke all
on function public.admin_update_registry_track_intake_artist_credit(
  uuid,
  integer,
  text,
  text,
  uuid,
  text
)
from public, anon, service_role;

grant execute
on function public.admin_update_registry_track_intake_artist_credit(
  uuid,
  integer,
  text,
  text,
  uuid,
  text
)
to authenticated;


create or replace function editorial.sync_public_registry_intake_contribution_status()
returns trigger
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public'
as $function$
declare
  v_contribution_status text;
begin
  if new.source_contribution_id is null
     or new.intake_origin <> 'public_contribution'
     or new.status is not distinct from old.status
  then
    return new;
  end if;

  v_contribution_status :=
    case
      when new.status in (
        'accepted',
        'canonicalized'
      )
      then 'accepted'
      when new.status = 'rejected'
      then 'rejected'
      else null
    end;

  if v_contribution_status is null then
    return new;
  end if;

  update public.community_contributions contribution
  set
    status = v_contribution_status,
    reviewed_by = new.reviewed_by,
    reviewed_at =
      coalesce(
        new.reviewed_at,
        now()
      ),
    updated_at = now(),
    payload =
      coalesce(
        contribution.payload,
        '{}'::jsonb
      )
      || jsonb_strip_nulls(
           jsonb_build_object(
             'registry_status',
               new.status,
             'registry_track_id',
               coalesce(
                 new.canonicalized_track_id,
                 new.canonical_track_id
               )
           )
         )
  where contribution.id =
    new.source_contribution_id;

  return new;
end;
$function$;

drop trigger if exists
  registry_track_intake_sync_public_contribution
on public.registry_provider_track_suggestions;

create trigger registry_track_intake_sync_public_contribution
after update of status, canonical_track_id, canonicalized_track_id
on public.registry_provider_track_suggestions
for each row
execute function editorial.sync_public_registry_intake_contribution_status();


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
set search_path to
  'pg_catalog',
  'auth',
  'public',
  'editorial'
as $function$
declare
  v_status text :=
    lower(
      btrim(
        coalesce(
          p_status,
          'needs_review'
        )
      )
    );
  v_limit integer :=
    greatest(
      1,
      least(
        coalesce(
          p_limit,
          100
        ),
        250
      )
    );
  v_offset integer :=
    greatest(
      0,
      coalesce(
        p_offset,
        0
      )
    );
  v_total integer;
  v_rows jsonb;
begin
  if auth.uid() is null then
    raise exception
      using
        errcode = '42501',
        message = 'Authentication is required.';
  end if;

  if not (
    public.current_user_is_administrator()
    or public.current_user_has_capability(
      'manage_registry'
    )
  ) then
    raise exception
      using
        errcode = '42501',
        message = 'Registry management permission is required.';
  end if;

  if v_status not in (
    'needs_review',
    'rejected',
    'canonicalized',
    'all'
  ) then
    raise exception
      'Track Intake status filter is invalid.';
  end if;

  select count(*)::integer
  into v_total
  from public.registry_provider_track_suggestions suggestion
  where (
      v_status = 'all'
      or suggestion.status = v_status
    )
    and (
      p_suggestion_id is null
      or suggestion.id = p_suggestion_id
    )
    and (
      p_playlist_item_id is null
      or suggestion.source_playlist_item_id =
           p_playlist_item_id
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
        'suggestion_id',
          suggestion.id,
        'status',
          suggestion.status,
        'intake_origin',
          suggestion.intake_origin,
        'source_contribution_id',
          suggestion.source_contribution_id,
        'contribution_status',
          contribution.status,
        'contribution_payload',
          coalesce(
            contribution.payload,
            '{}'::jsonb
          ),
        'submitted_track_title',
          suggestion.submitted_track_title,
        'playlist_id',
          suggestion.source_playlist_id,
        'playlist_title',
          playlist.title,
        'playlist_item_id',
          suggestion.source_playlist_item_id,
        'playlist_position',
          item.position,
        'playlist_note',
          item.notes,
        'provider_key',
          suggestion.provider_key,
        'provider_object_id',
          suggestion.provider_object_id,
        'provider_url',
          suggestion.provider_url,
        'provider_title',
          suggestion.provider_title,
        'provider_release_title',
          suggestion.provider_release_title,
        'provider_artist_names',
          suggestion.provider_artist_names,
        'playback_kind',
          suggestion.playback_kind,
        'artwork_url',
          suggestion.validation_snapshot
            ->> 'artwork_url',
        'preview_url',
          suggestion.validation_snapshot
            ->> 'preview_url',
        'requested_by',
          suggestion.requested_by,
        'requested_by_name',
          requester.display_name,
        'created_at',
          suggestion.created_at,
        'reviewed_at',
          suggestion.reviewed_at,
        'review_note',
          suggestion.review_note,
        'canonical_track_id',
          suggestion.canonical_track_id,
        'canonical_track_title',
          canonical_track.title,
        'canonicalized_track_id',
          suggestion.canonicalized_track_id,
        'canonicalized_track_title',
          canonical_track.title,
        'artist_credits',
          coalesce(
            (
              select jsonb_agg(
                jsonb_build_object(
                  'credit_order',
                    credit.credit_order,
                  'credit_role',
                    credit.credit_role,
                  'resolution_mode',
                    credit.resolution_mode,
                  'registry_artist_id',
                    credit.registry_artist_id,
                  'observed_name',
                    credit.observed_name,
                  'display_name',
                    coalesce(
                      artist.display_name,
                      credit.observed_name
                    )
                )
                order by credit.credit_order
              )
              from public.registry_provider_track_suggestion_artists credit
              left join public.registry_artists artist
                on artist.id =
                     credit.registry_artist_id
              where credit.suggestion_id =
                    suggestion.id
            ),
            '[]'::jsonb
          )
      ) as payload
    from public.registry_provider_track_suggestions suggestion
    left join public.wk_playlists playlist
      on playlist.id =
           suggestion.source_playlist_id
    left join public.wk_playlist_items item
      on item.id =
           suggestion.source_playlist_item_id
    left join public.user_profiles requester
      on requester.user_id =
           suggestion.requested_by
    left join public.registry_tracks canonical_track
      on canonical_track.id =
           coalesce(
             suggestion.canonicalized_track_id,
             suggestion.canonical_track_id
           )
    left join public.community_contributions contribution
      on contribution.id =
           suggestion.source_contribution_id
    where (
        v_status = 'all'
        or suggestion.status = v_status
      )
      and (
        p_suggestion_id is null
        or suggestion.id = p_suggestion_id
      )
      and (
        p_playlist_item_id is null
        or suggestion.source_playlist_item_id =
             p_playlist_item_id
      )
    order by suggestion.created_at desc
    limit v_limit
    offset v_offset
  ) queue_row;

  return jsonb_build_object(
    'status',
      v_status,
    'total',
      v_total,
    'limit',
      v_limit,
    'offset',
      v_offset,
    'rows',
      v_rows
  );
end;
$function$;

revoke all
on function public.admin_get_registry_track_intake_queue(
  text,
  integer,
  integer,
  uuid,
  uuid
)
from public, anon, service_role;

grant execute
on function public.admin_get_registry_track_intake_queue(
  text,
  integer,
  integer,
  uuid,
  uuid
)
to authenticated;


create or replace function public.create_public_playlist_missing_track_submission(
  p_user_id uuid,
  p_playlist_id uuid,
  p_playlist_slug text,
  p_track_title text,
  p_artist_names text[],
  p_details text default null,
  p_provider jsonb default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_slug text :=
    nullif(
      btrim(p_playlist_slug),
      ''
    );
  v_title text :=
    nullif(
      btrim(p_track_title),
      ''
    );
  v_details text :=
    nullif(
      btrim(p_details),
      ''
    );
  v_key text :=
    nullif(
      btrim(p_idempotency_key),
      ''
    );
  v_resource_id uuid;
  v_artist_names text[];
  v_provider jsonb :=
    coalesce(
      p_provider,
      '{}'::jsonb
    );
  v_has_provider boolean :=
    p_provider is not null
    and p_provider <> '{}'::jsonb;
  v_provider_key text;
  v_provider_object_id text;
  v_provider_url text;
  v_canonical_url text;
  v_provider_title text;
  v_provider_artist_names text[] :=
    '{}'::text[];
  v_provider_release_title text;
  v_playback_kind text;
  v_provider_metadata jsonb :=
    '{}'::jsonb;
  v_contribution_id uuid;
  v_suggestion_id uuid;
  v_existing_suggestion_id uuid;
  v_payload jsonb;
begin
  if p_user_id is null
     or not exists (
       select 1
       from auth.users account
       where account.id = p_user_id
     )
  then
    raise exception
      'A signed-in WAKILISHA account is required.';
  end if;

  if p_playlist_id is null
     or v_slug is null
  then
    raise exception
      'Playlist context is required.';
  end if;

  select snapshot.resource_id
  into v_resource_id
  from editorial.playlist_publication_snapshots snapshot
  join editorial.playlist_resources binding
    on binding.resource_id =
         snapshot.resource_id
   and binding.playlist_id =
         snapshot.playlist_id
   and binding.current_published_version_id =
         snapshot.version_id
  where snapshot.playlist_id = p_playlist_id
    and snapshot.slug = v_slug
  order by snapshot.published_at desc
  limit 1;

  if not found then
    raise exception
      'This Playlist is not publicly available.';
  end if;

  if v_title is null
     or length(v_title) > 500
  then
    raise exception
      'Track title must be between 1 and 500 characters.';
  end if;

  select coalesce(
    array_agg(
      artist_name
      order by ordinal_position
    ),
    '{}'::text[]
  )
  into v_artist_names
  from (
    select
      nullif(
        btrim(raw_artist_name),
        ''
      ) as artist_name,
      ordinal_position
    from unnest(
      coalesce(
        p_artist_names,
        '{}'::text[]
      )
    )
    with ordinality
      as submitted_artist(
        raw_artist_name,
        ordinal_position
      )
  ) normalized_artist
  where artist_name is not null;

  if cardinality(v_artist_names) < 1
     or cardinality(v_artist_names) > 20
  then
    raise exception
      'Add between 1 and 20 artist names.';
  end if;

  if exists (
    select 1
    from unnest(v_artist_names) artist_name
    where length(artist_name) > 300
  ) then
    raise exception
      'Artist names cannot exceed 300 characters.';
  end if;

  if v_details is not null
     and length(v_details) > 10000
  then
    raise exception
      'Additional details cannot exceed 10000 characters.';
  end if;

  if v_key is null
     or length(v_key) > 200
  then
    raise exception
      'Submission key is required.';
  end if;

  if jsonb_typeof(v_provider) <> 'object' then
    raise exception
      'Provider evidence must be a JSON object.';
  end if;

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_user_id::text
      || '|playlist-missing-track|'
      || p_playlist_id::text
      || '|'
      || v_key,
      0
    )
  );

  select contribution.id
  into v_contribution_id
  from public.community_contributions contribution
  where contribution.user_id = p_user_id
    and contribution.entity_type = 'playlist'
    and contribution.entity_id =
          v_resource_id::text
    and contribution.contribution_type =
          'missing_track'
    and contribution.payload
          ->> 'submission_key' =
          v_key
  order by contribution.created_at
  limit 1;

  if found then
    select suggestion.id
    into v_existing_suggestion_id
    from public.registry_provider_track_suggestions suggestion
    where suggestion.source_contribution_id =
          v_contribution_id
    order by suggestion.created_at
    limit 1;

    return jsonb_build_object(
      'contribution_id',
        v_contribution_id,
      'registry_suggestion_id',
        v_existing_suggestion_id,
      'registry_queued',
        v_existing_suggestion_id is not null,
      'created',
        false
    );
  end if;

  if v_has_provider then
    v_provider_key :=
      lower(
        btrim(
          coalesce(
            v_provider
              ->> 'provider_key',
            ''
          )
        )
      );

    if v_provider_key not in (
      'youtube',
      'spotify',
      'apple_music',
      'soundcloud'
    ) then
      raise exception
        'Unsupported music provider.';
    end if;

    v_provider_object_id :=
      nullif(
        btrim(
          v_provider
            ->> 'provider_object_id'
        ),
        ''
      );

    v_provider_url :=
      nullif(
        btrim(
          v_provider
            ->> 'provider_url'
        ),
        ''
      );

    v_canonical_url :=
      nullif(
        btrim(
          coalesce(
            v_provider
              ->> 'canonical_url',
            v_provider_url
          )
        ),
        ''
      );

    v_provider_title :=
      nullif(
        btrim(
          v_provider
            ->> 'provider_title'
        ),
        ''
      );

    v_provider_release_title :=
      nullif(
        btrim(
          v_provider
            ->> 'provider_release_title'
        ),
        ''
      );

    v_playback_kind :=
      lower(
        btrim(
          coalesce(
            v_provider
              ->> 'playback_kind',
            ''
          )
        )
      );

    if v_provider_object_id is null
       or v_provider_url is null
       or v_canonical_url is null
       or v_playback_kind not in (
         'audio',
         'video'
       )
    then
      raise exception
        'Complete provider evidence is required for Registry intake.';
    end if;

    select coalesce(
      array_agg(
        artist_name
        order by ordinal_position
      ),
      '{}'::text[]
    )
    into v_provider_artist_names
    from (
      select
        nullif(
          btrim(raw_artist_name),
          ''
        ) as artist_name,
        ordinal_position
      from jsonb_array_elements_text(
        case
          when jsonb_typeof(
            v_provider
              -> 'provider_artist_names'
          ) = 'array'
          then v_provider
                 -> 'provider_artist_names'
          else '[]'::jsonb
        end
      )
      with ordinality
        as observed_artist(
          raw_artist_name,
          ordinal_position
        )
    ) normalized_provider_artist
    where artist_name is not null;

    v_provider_metadata :=
      case
        when jsonb_typeof(
          v_provider
            -> 'provider_metadata'
        ) = 'object'
        then v_provider
               -> 'provider_metadata'
        else '{}'::jsonb
      end;
  else
    v_provider_url := null;
  end if;

  v_payload :=
    jsonb_strip_nulls(
      jsonb_build_object(
        'submission_key',
          v_key,
        'track_title',
          v_title,
        'artist_names',
          to_jsonb(v_artist_names),
        'track_url',
          v_provider_url,
        'details',
          v_details,
        'registry_queued',
          true
      )
    );

  insert into public.community_contributions (
    user_id,
    source_comment_id,
    entity_type,
    entity_id,
    entity_slug,
    contribution_type,
    payload,
    status
  )
  values (
    p_user_id,
    null,
    'playlist',
    v_resource_id::text,
    v_slug,
    'missing_track',
    v_payload,
    'pending'
  )
  returning id
  into v_contribution_id;

  v_suggestion_id :=
    gen_random_uuid();

  insert into public.registry_provider_track_suggestions (
    id,
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
    submitted_track_title
  )
  values (
    v_suggestion_id,
    p_playlist_id,
    null,
    p_user_id,
    null,
    null,
    'unresolved',
    v_provider_key,
    v_provider_object_id,
    v_canonical_url,
    v_provider_title,
    v_provider_artist_names,
    v_provider_release_title,
    v_playback_kind,
    jsonb_strip_nulls(
      jsonb_build_object(
        'embed_url',
          nullif(
            btrim(
              v_provider
                ->> 'embed_url'
            ),
            ''
          ),
        'preview_url',
          nullif(
            btrim(
              v_provider
                ->> 'preview_url'
            ),
            ''
          ),
        'artwork_url',
          nullif(
            btrim(
              v_provider
                ->> 'artwork_url'
            ),
            ''
          ),
        'provider_metadata',
          v_provider_metadata,
        'checked_at',
          coalesce(
            nullif(
              btrim(
                v_provider
                  ->> 'checked_at'
              ),
              ''
            ),
            now()::text
          ),
        'validation_mode',
          case
            when v_has_provider
              then 'public_missing_track_submission'
            else 'public_missing_track_manual'
          end
      )
    ),
    'needs_review',
    null,
    'public_contribution',
    v_contribution_id,
    v_title
  );

  insert into public.registry_provider_track_suggestion_artists (
    suggestion_id,
    credit_order,
    credit_role,
    resolution_mode,
    registry_artist_id,
    observed_name
  )
  select
    v_suggestion_id,
    ordinal_position::integer,
    'unresolved',
    'unresolved',
    null,
    artist_name
  from unnest(v_artist_names)
    with ordinality
      as submitted_artist(
        artist_name,
        ordinal_position
      );

  update public.community_contributions contribution
  set
    payload =
      contribution.payload
      || jsonb_build_object(
           'registry_suggestion_id',
             v_suggestion_id,
           'registry_queued',
             true
         ),
    updated_at = now()
  where contribution.id =
    v_contribution_id;

  return jsonb_build_object(
    'contribution_id',
      v_contribution_id,
    'registry_suggestion_id',
      v_suggestion_id,
    'registry_queued',
      true,
    'created',
      true
  );
end;
$function$;

revoke all
on function public.create_public_playlist_missing_track_submission(
  uuid,
  uuid,
  text,
  text,
  text[],
  text,
  jsonb,
  text
)
from public, anon, authenticated;

grant execute
on function public.create_public_playlist_missing_track_submission(
  uuid,
  uuid,
  text,
  text,
  text[],
  text,
  jsonb,
  text
)
to service_role;


comment on column public.registry_provider_track_suggestions.intake_origin is
  'Distinguishes editor-decided Playlist intake from public contributions that require Registry review without Playlist insertion.';

comment on column public.registry_provider_track_suggestions.source_contribution_id is
  'Optional Community contribution that supplied public missing-track evidence.';

comment on column public.registry_provider_track_suggestions.submitted_track_title is
  'Contributor-supplied track title preserved separately from provider-observed title evidence.';

comment on function public.create_public_playlist_missing_track_submission(
  uuid,
  uuid,
  text,
  text,
  text[],
  text,
  jsonb,
  text
) is
  'Service-only atomic bridge from a signed-in public Playlist missing-track submission into Community contribution authority and, when validated provider evidence exists, Registry Track Intake.';

comment on function public.admin_update_registry_track_intake_artist_credit(
  uuid,
  integer,
  text,
  text,
  uuid,
  text
) is
  'Registry-review command for assigning submitted artist evidence to Primary, Featured, or unresolved roles and resolving canonical artist identity without automatic merging.';


do $phase_5b_m224_postflight$
declare
  v_pending_slot text;
  v_materialize_trigger text;
begin
  select pg_get_constraintdef(constraint_info.oid)
  into v_pending_slot
  from pg_constraint constraint_info
  where constraint_info.conrelid =
        'public.registry_provider_track_suggestions'::regclass
    and constraint_info.conname =
        'registry_provider_track_suggestions_pending_slot_check';

  if v_pending_slot is null
     or position(
          'public_contribution'
          in v_pending_slot
        ) = 0
  then
    raise exception
      'STOP: Public contribution intake is still forced to reserve a Playlist position.';
  end if;

  select pg_get_triggerdef(
    trigger_info.oid,
    true
  )
  into v_materialize_trigger
  from pg_trigger trigger_info
  where trigger_info.tgrelid =
        'public.registry_provider_track_suggestions'::regclass
    and trigger_info.tgname =
        'registry_provider_track_suggestion_materialize_playlist_slot'
    and not trigger_info.tgisinternal;

  if v_materialize_trigger is null
     or position(
          'playlist_editor'
          in v_materialize_trigger
        ) = 0
  then
    raise exception
      'STOP: Playlist materialization is not gated by intake origin.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'registry_provider_track_suggestions'
      and column_name = 'submitted_track_title'
  ) then
    raise exception
      'STOP: M224 submitted track title was not installed.';
  end if;

  if to_regprocedure(
       'public.create_public_playlist_missing_track_submission(uuid,uuid,text,text,text[],text,jsonb,text)'
     ) is null
     or to_regprocedure(
       'public.admin_update_registry_track_intake_artist_credit(uuid,integer,text,text,uuid,text)'
     ) is null
  then
    raise exception
      'STOP: M224 command surface is incomplete.';
  end if;
end;
$phase_5b_m224_postflight$;

commit;
