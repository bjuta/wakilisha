do $verify_phase_5a_m214$
declare
  v_definition text;
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'registry_provider_track_suggestions'
      and column_name = 'reserved_position'
  ) then
    raise exception
      'FAIL: Registry intake reserved_position is missing';
  end if;

  if to_regclass(
       'public.registry_provider_track_suggestion_artists'
     ) is null
  then
    raise exception
      'FAIL: Registry intake artist-credit authority is missing';
  end if;

  if to_regprocedure(
       'public.submit_playlist_registry_intake(uuid,bigint,uuid,jsonb,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.get_playlist_pending_registry_intake(uuid)'
     ) is null
     or to_regprocedure(
       'public.add_playlist_registry_track_with_intake_slots(uuid,bigint,uuid,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.add_playlist_validated_provider_track_with_intake_slots(uuid,bigint,uuid,uuid,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.remove_playlist_item_with_intake_slots(uuid,uuid,bigint,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.reorder_playlist_items_with_intake_slots(uuid,bigint,uuid[],text,uuid)'
     ) is null
  then
    raise exception
      'FAIL: One or more M214 Playlist slot RPCs are missing';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid =
      'public.registry_provider_track_suggestions'::regclass
      and trigger_row.tgname =
        'registry_provider_track_suggestion_materialize_playlist_slot'
      and not trigger_row.tgisinternal
  ) then
    raise exception
      'FAIL: Canonicalized Registry intake slot materializer is missing';
  end if;

  select pg_get_functiondef(
    'public.submit_playlist_registry_intake(uuid,bigint,uuid,jsonb,text,uuid)'::regprocedure
  )
  into v_definition;

  if position('credit_role' in v_definition) = 0
     or position('featured' in v_definition) = 0
     or position('reserved_position' in v_definition) = 0
     or position('new_artist' in v_definition) = 0
     or position('alias_candidate' in v_definition) = 0
  then
    raise exception
      'FAIL: Registry intake does not preserve artist roles and Playlist slot reservation';
  end if;

  select pg_get_functiondef(
    'editorial.guard_playlist_review_registry_integrity()'::regprocedure
  )
  into v_definition;

  if position(
       'pending Music Registry intake slot'
       in v_definition
     ) = 0
  then
    raise exception
      'FAIL: Playlist review does not block unresolved Registry intake slots';
  end if;

  if has_function_privilege(
       'authenticated',
       'public.create_registry_track_intake_suggestion(uuid,uuid,text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.add_playlist_item(uuid,bigint,text,uuid,text,text,text,text,text[],text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.reorder_playlist_items(uuid,bigint,uuid[],text,uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'FAIL: Legacy slot-unaware Playlist writes remain authenticated';
  end if;

  raise notice
    'PASS: M214 Registry intake slots, artist credits, materialization, and review guard are structurally complete.';
end;
$verify_phase_5a_m214$;
