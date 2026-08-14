-- WAKILISHA M5 repair: keep Playlist item synchronization exclusive to Playlist intake.
--
-- Artist submissions intentionally enter Registry Track Intake without Playlist identity.
-- The shared Artist-credit trigger must therefore ignore every intake origin except
-- playlist_editor.

begin;

do $m5_trigger_boundary_preflight$
declare
  v_definition text;
begin
  if to_regprocedure('editorial.sync_playlist_registry_intake_item_artists()') is null
     or to_regprocedure('editorial.ensure_playlist_registry_intake_item(uuid)') is null
  then
    raise exception 'STOP: Playlist Registry intake synchronization authority is missing';
  end if;

  select pg_get_functiondef(
    'editorial.sync_playlist_registry_intake_item_artists()'::regprocedure
  )
  into v_definition;

  if position(
       'v_intake_origin = ''public_contribution'''
       in v_definition
     ) = 0
  then
    raise exception
      'STOP: Expected pre-repair Playlist Artist-credit synchronization definition is not present';
  end if;

  if position(
       'v_intake_origin <> ''playlist_editor'''
       in v_definition
     ) > 0
  then
    raise exception
      'STOP: Playlist Artist-credit synchronization boundary is already repaired';
  end if;
end;
$m5_trigger_boundary_preflight$;

create or replace function editorial.sync_playlist_registry_intake_item_artists()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $$
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
     or v_intake_origin <> 'playlist_editor'
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
$$;

do $m5_trigger_boundary_postflight$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'editorial.sync_playlist_registry_intake_item_artists()'::regprocedure
  )
  into v_definition;

  if position(
       'v_intake_origin <> ''playlist_editor'''
       in v_definition
     ) = 0
  then
    raise exception
      'FAIL: Playlist synchronization is not bounded to playlist_editor intake';
  end if;

  if position(
       'editorial.ensure_playlist_registry_intake_item'
       in v_definition
     ) = 0
  then
    raise exception
      'FAIL: Playlist intake synchronization lost its Playlist materialization authority';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where not trigger_row.tgisinternal
      and trigger_row.tgrelid =
        'public.registry_provider_track_suggestion_artists'::regclass
      and trigger_row.tgname =
        'registry_provider_track_suggestion_sync_playlist_item_artists'
  ) then
    raise exception
      'FAIL: Registry intake Artist-credit synchronization trigger is missing';
  end if;
end;
$m5_trigger_boundary_postflight$;

commit;
