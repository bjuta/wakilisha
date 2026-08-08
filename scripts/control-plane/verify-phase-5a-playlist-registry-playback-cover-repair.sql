-- Verify Phase 5A M213 Registry-first Playlist, playback, and cover repair.

do $verify_phase_5a_m213$
declare
  v_definition text;
begin
  if to_regclass('platform_private.playlist_playback_validations') is null then
    raise exception 'FAIL: Playlist playback validation receipts are missing';
  end if;

  if to_regclass('public.registry_provider_track_suggestions') is null then
    raise exception 'FAIL: Registry provider-track suggestion queue is missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'registry_provider_track_suggestions'
      and column_name = 'requested_by'
      and is_nullable = 'YES'
  ) then
    raise exception
      'FAIL: Registry intake suggestion actor history is not deletion-safe';
  end if;

  if to_regprocedure(
       'public.add_playlist_validated_provider_track(uuid,bigint,uuid,uuid,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.create_registry_track_intake_suggestion(uuid,uuid,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.get_playlist_cover_source(uuid,uuid)'
     ) is null
     or to_regprocedure(
       'public.current_user_can_edit_playlist_id(uuid)'
     ) is null
     or to_regprocedure(
       'public.record_playlist_playback_probe_candidate(uuid,uuid,text,text,text,text,text,text,text,text[],text,jsonb,timestamptz,uuid)'
     ) is null
     or to_regprocedure(
       'public.confirm_playlist_playback_validation(uuid,uuid,uuid,jsonb)'
     ) is null
  then
    raise exception 'FAIL: One or more M213 Playlist product RPCs are missing';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid = 'public.wk_playlist_items'::regclass
      and trigger_row.tgname = 'playlist_item_registry_identity_guard'
      and not trigger_row.tgisinternal
  ) then
    raise exception 'FAIL: New Playlist-item Registry identity guard is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid = 'public.wk_playlists'::regclass
      and trigger_row.tgname = 'playlist_review_registry_integrity_guard'
      and not trigger_row.tgisinternal
  ) then
    raise exception 'FAIL: Playlist Review Registry integrity guard is missing';
  end if;

  select pg_get_functiondef(
    'public.confirm_playlist_playback_validation(uuid,uuid,uuid,jsonb)'::regprocedure
  )
  into v_definition;

  if position('probe_required' in v_definition) = 0
     or position('iframe_cued' in v_definition) = 0
     or position($needle$validation_status = 'playable'$needle$ in v_definition) = 0
  then
    raise exception
      'FAIL: Browser playback probe confirmation authority is incomplete';
  end if;

  select pg_get_functiondef(
    'public.add_playlist_validated_provider_track(uuid,bigint,uuid,uuid,text,uuid)'::regprocedure
  )
  into v_definition;

  if position(
       'validation_status = ''playable'''
       in v_definition
     ) = 0
     or position(
       'public.add_playlist_item('
       in v_definition
     ) = 0
     or position(
       'registry_provider_track_suggestions'
       in v_definition
     ) = 0
  then
    raise exception
      'FAIL: Validated provider add command does not preserve Registry-first/playback authority';
  end if;

  select pg_get_functiondef(
    'public.set_playlist_cover(uuid,bigint,uuid,text,jsonb,text,text,text,uuid)'::regprocedure
  )
  into v_definition;

  if position('playlist_cover_variant' in v_definition) = 0
     or position('verified image revision' in v_definition) = 0
  then
    raise exception
      'FAIL: Playlist cover command does not accept prepared verified variants';
  end if;

  raise notice
    'PASS: M213 Registry-first Playlist, playback validation, and cover repair is structurally complete.';
end;
$verify_phase_5a_m213$;
