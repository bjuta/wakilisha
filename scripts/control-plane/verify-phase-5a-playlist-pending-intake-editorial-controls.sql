do $verify_phase_5a_m215$
declare
  v_definition text;
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'registry_provider_track_suggestions'
      and column_name = 'playlist_note'
  ) then
    raise exception 'FAIL: pending Registry intake playlist_note is missing';
  end if;

  if to_regprocedure(
       'public.get_playlist_pending_registry_intake_editorial(uuid)'
     ) is null
     or to_regprocedure(
       'public.save_playlist_pending_registry_note(uuid,uuid,bigint,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.move_playlist_pending_registry_intake(uuid,uuid,bigint,text,text,uuid)'
     ) is null
  then
    raise exception 'FAIL: one or more M215 Playlist editorial RPCs are missing';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    where trigger_row.tgrelid =
      'public.registry_provider_track_suggestions'::regclass
      and trigger_row.tgname =
        'registry_provider_track_suggestion_carry_playlist_note'
      and not trigger_row.tgisinternal
  ) then
    raise exception 'FAIL: pending note carry-forward trigger is missing';
  end if;

  if has_function_privilege(
       'anon',
       'public.save_playlist_pending_registry_note(uuid,uuid,bigint,text,text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.move_playlist_pending_registry_intake(uuid,uuid,bigint,text,text,uuid)',
       'EXECUTE'
     )
  then
    raise exception 'FAIL: anonymous M215 command execution is exposed';
  end if;

  if to_regprocedure(
       'editorial.ensure_playlist_registry_intake_item(uuid)'
     ) is null
  then
    if not has_function_privilege(
         'authenticated',
         'public.save_playlist_pending_registry_note(uuid,uuid,bigint,text,text,uuid)',
         'EXECUTE'
       )
       or not has_function_privilege(
         'authenticated',
         'public.move_playlist_pending_registry_intake(uuid,uuid,bigint,text,text,uuid)',
         'EXECUTE'
       )
    then
      raise exception
        'FAIL: authenticated Playlist editors cannot use M215 commands before M216 supersession';
    end if;
  else
    if has_function_privilege(
         'authenticated',
         'public.save_playlist_pending_registry_note(uuid,uuid,bigint,text,text,uuid)',
         'EXECUTE'
       )
       or has_function_privilege(
         'authenticated',
         'public.move_playlist_pending_registry_intake(uuid,uuid,bigint,text,text,uuid)',
         'EXECUTE'
       )
    then
      raise exception
        'FAIL: M215 special commands remain authenticated after M216 supersession';
    end if;

    if not has_function_privilege(
         'authenticated',
         'public.save_playlist_item_note(uuid,uuid,bigint,text,text,uuid)',
         'EXECUTE'
       )
       or not has_function_privilege(
         'authenticated',
         'public.reorder_playlist_items_with_intake_slots(uuid,bigint,uuid[],text,uuid)',
         'EXECUTE'
       )
    then
      raise exception
        'FAIL: M216 did not preserve pending-track editing through ordinary Playlist commands';
    end if;
  end if;

  select pg_get_functiondef(
    'public.move_playlist_pending_registry_intake(uuid,uuid,bigint,text,text,uuid)'::regprocedure
  )
  into v_definition;

  if position('playlist.items.reorder' in v_definition) = 0
     or position('authority_revision' in v_definition) = 0
     or position('for update' in lower(v_definition)) = 0
  then
    raise exception 'FAIL: pending Registry move is not governed by Playlist reorder authority';
  end if;

  select pg_get_functiondef(
    'public.save_playlist_pending_registry_note(uuid,uuid,bigint,text,text,uuid)'::regprocedure
  )
  into v_definition;

  if position('playlist.item.note.save' in v_definition) = 0
     or position('playlist_note' in v_definition) = 0
  then
    raise exception 'FAIL: pending Registry note is not governed by Playlist note authority';
  end if;

  raise notice
    'PASS: M215 pending Registry tracks retain Playlist editorial controls, including after M216 command unification.';
end;
$verify_phase_5a_m215$;
